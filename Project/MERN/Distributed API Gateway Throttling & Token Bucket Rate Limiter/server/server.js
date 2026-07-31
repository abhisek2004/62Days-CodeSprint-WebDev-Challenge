const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ==========================================
// 1. DATA STORES & DEFAULT CONFIGURATIONS
// ==========================================

// Quota Tier Definitions
const TIER_DEFAULTS = {
  Free: {
    capacity: 15,
    refillRate: 1, // tokens/sec
    maxRequests: 30, // for window algorithms
    windowMs: 60000,
    label: 'Free Tier (15 tokens, 1 tok/s)'
  },
  Pro: {
    capacity: 60,
    refillRate: 5,
    maxRequests: 120,
    windowMs: 60000,
    label: 'Pro Tier (60 tokens, 5 tok/s)'
  },
  Enterprise: {
    capacity: 250,
    refillRate: 25,
    maxRequests: 600,
    windowMs: 60000,
    label: 'Enterprise Tier (250 tokens, 25 tok/s)'
  }
};

// In-Memory API Keys Store
const apiKeys = {
  'gw_free_demo_89324': {
    key: 'gw_free_demo_89324',
    name: 'Starter Mobile App',
    tier: 'Free',
    active: true,
    quotaUsed: 0,
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(),
    // Per-key rate limit states
    tokenBucket: { tokens: 15, lastRefill: Date.now() },
    slidingWindow: { timestamps: [] },
    fixedWindow: { windowIndex: Math.floor(Date.now() / 60000), count: 0 }
  },
  'gw_pro_key_44129': {
    key: 'gw_pro_key_44129',
    name: 'FinTech Payment Gateway',
    tier: 'Pro',
    active: true,
    quotaUsed: 0,
    createdAt: new Date(Date.now() - 86400000 * 12).toISOString(),
    tokenBucket: { tokens: 60, lastRefill: Date.now() },
    slidingWindow: { timestamps: [] },
    fixedWindow: { windowIndex: Math.floor(Date.now() / 60000), count: 0 }
  },
  'gw_ent_key_99012': {
    key: 'gw_ent_key_99012',
    name: 'High-Volume Enterprise Service',
    tier: 'Enterprise',
    active: true,
    quotaUsed: 0,
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(),
    tokenBucket: { tokens: 250, lastRefill: Date.now() },
    slidingWindow: { timestamps: [] },
    fixedWindow: { windowIndex: Math.floor(Date.now() / 60000), count: 0 }
  }
};

// Route Rate Limiting Policies
let routePolicies = {
  '/api/v1/users': {
    path: '/api/v1/users',
    name: 'User Management API',
    algorithm: 'Token Bucket',
    capacity: 20,
    refillRate: 2, // tokens/sec
    windowMs: 60000,
    maxRequests: 40,
    delayMs: 0,
    enabled: true
  },
  '/api/v1/products': {
    path: '/api/v1/products',
    name: 'Product Catalog Service',
    algorithm: 'Fixed Window',
    capacity: 30,
    refillRate: 3,
    windowMs: 30000, // 30 sec window
    maxRequests: 25,
    delayMs: 0,
    enabled: true
  },
  '/api/v1/orders': {
    path: '/api/v1/orders',
    name: 'Order Processing Engine',
    algorithm: 'Sliding Window',
    capacity: 10,
    refillRate: 1,
    windowMs: 60000,
    maxRequests: 15,
    delayMs: 50,
    enabled: true
  },
  '/api/v1/analytics': {
    path: '/api/v1/analytics',
    name: 'Telemetry & Analytics Engine',
    algorithm: 'Token Bucket',
    capacity: 8,
    refillRate: 0.8,
    windowMs: 60000,
    maxRequests: 20,
    delayMs: 0,
    enabled: true
  },
  '/api/v1/heavy-compute': {
    path: '/api/v1/heavy-compute',
    name: 'AI & Heavy Compute Task',
    algorithm: 'Token Bucket',
    capacity: 4,
    refillRate: 0.4,
    windowMs: 60000,
    maxRequests: 5,
    delayMs: 250, // Throttling latency simulation
    enabled: true
  }
};

// System Metrics & Request Log History
const requestLogs = [];
const MAX_LOG_SIZE = 400;

const metrics = {
  totalRequests: 0,
  allowedRequests: 0,
  blockedRequests: 0,
  unauthorizedRequests: 0,
  latencySum: 0,
  statusCounts: { 200: 0, 429: 0, 401: 0, 500: 0 },
  endpointCounts: {},
  keyCounts: {}
};

// ==========================================
// 2. RATE LIMITING ALGORITHM EVALUATORS
// ==========================================

// Token Bucket Algorithm
function checkTokenBucket(bucket, capacity, refillRate) {
  const now = Date.now();
  const elapsedSec = Math.max(0, (now - bucket.lastRefill) / 1000);
  bucket.tokens = Math.min(capacity, bucket.tokens + elapsedSec * refillRate);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    const remaining = Math.floor(bucket.tokens);
    const resetSec = Math.ceil((capacity - bucket.tokens) / (refillRate || 1));
    return {
      allowed: true,
      remaining,
      limit: capacity,
      resetSec: Math.max(1, resetSec)
    };
  } else {
    const requiredTokens = 1 - bucket.tokens;
    const retryAfter = Math.ceil(requiredTokens / (refillRate || 1));
    return {
      allowed: false,
      remaining: 0,
      limit: capacity,
      retryAfter: Math.max(1, retryAfter),
      resetSec: Math.max(1, retryAfter)
    };
  }
}

// Sliding Window Log Algorithm
function checkSlidingWindow(sw, windowMs, maxRequests) {
  const now = Date.now();
  // Filter out timestamps outside window
  sw.timestamps = (sw.timestamps || []).filter(ts => now - ts < windowMs);

  if (sw.timestamps.length < maxRequests) {
    sw.timestamps.push(now);
    const remaining = maxRequests - sw.timestamps.length;
    const oldestTs = sw.timestamps[0] || now;
    const resetSec = Math.ceil((windowMs - (now - oldestTs)) / 1000);
    return {
      allowed: true,
      remaining,
      limit: maxRequests,
      resetSec: Math.max(1, resetSec)
    };
  } else {
    const oldestTs = sw.timestamps[0] || now;
    const retryAfter = Math.ceil((windowMs - (now - oldestTs)) / 1000);
    return {
      allowed: false,
      remaining: 0,
      limit: maxRequests,
      retryAfter: Math.max(1, retryAfter),
      resetSec: Math.max(1, retryAfter)
    };
  }
}

// Fixed Window Counter Algorithm
function checkFixedWindow(fw, windowMs, maxRequests) {
  const now = Date.now();
  const currentWindowIndex = Math.floor(now / windowMs);

  if (fw.windowIndex !== currentWindowIndex) {
    fw.windowIndex = currentWindowIndex;
    fw.count = 0;
  }

  const windowEndTime = (currentWindowIndex + 1) * windowMs;
  const resetSec = Math.ceil((windowEndTime - now) / 1000);

  if (fw.count < maxRequests) {
    fw.count += 1;
    const remaining = maxRequests - fw.count;
    return {
      allowed: true,
      remaining,
      limit: maxRequests,
      resetSec: Math.max(1, resetSec)
    };
  } else {
    return {
      allowed: false,
      remaining: 0,
      limit: maxRequests,
      retryAfter: Math.max(1, resetSec),
      resetSec: Math.max(1, resetSec)
    };
  }
}

// ==========================================
// 3. API GATEWAY RATE LIMITER MIDDLEWARE
// ==========================================

function gatewayRateLimiter(req, res, next) {
  const startTime = Date.now();
  const reqPath = req.path;
  const apiKeyStr = req.headers['x-api-key'] || req.query.apiKey;

  metrics.totalRequests += 1;
  metrics.endpointCounts[reqPath] = (metrics.endpointCounts[reqPath] || 0) + 1;

  // 1. Validate API Key
  if (!apiKeyStr || !apiKeys[apiKeyStr]) {
    metrics.blockedRequests += 1;
    metrics.unauthorizedRequests += 1;
    metrics.statusCounts[401] = (metrics.statusCounts[401] || 0) + 1;

    const logEntry = {
      id: 'req_' + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      method: req.method,
      path: reqPath,
      apiKey: apiKeyStr || 'MISSING',
      clientName: 'Unauthorized Client',
      status: 401,
      latencyMs: Date.now() - startTime,
      algorithm: 'N/A',
      remaining: 0,
      message: 'Unauthorized: Invalid or missing x-api-key header'
    };

    pushLog(logEntry);

    return res.status(401).json({
      status: 401,
      error: 'Unauthorized',
      message: 'Invalid or missing API key. Provide a valid key in x-api-key header or ?apiKey query parameter.'
    });
  }

  const keyObj = apiKeys[apiKeyStr];
  if (!keyObj.active) {
    metrics.blockedRequests += 1;
    metrics.unauthorizedRequests += 1;
    metrics.statusCounts[401] = (metrics.statusCounts[401] || 0) + 1;

    const logEntry = {
      id: 'req_' + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      method: req.method,
      path: reqPath,
      apiKey: apiKeyStr,
      clientName: keyObj.name,
      status: 401,
      latencyMs: Date.now() - startTime,
      algorithm: 'N/A',
      remaining: 0,
      message: 'API Key visually revoked or suspended'
    };
    pushLog(logEntry);

    return res.status(401).json({
      status: 401,
      error: 'Key Suspended',
      message: `API Key '${apiKeyStr}' is deactivated. Contact gateway administrator.`
    });
  }

  metrics.keyCounts[keyObj.name] = (metrics.keyCounts[keyObj.name] || 0) + 1;

  // 2. Check Route Policy
  const policy = routePolicies[reqPath];
  if (!policy || !policy.enabled) {
    // If route doesn't have restrictive policy, allow request
    metrics.allowedRequests += 1;
    metrics.statusCounts[200] = (metrics.statusCounts[200] || 0) + 1;
    keyObj.quotaUsed += 1;
    req.gatewayMeta = { keyObj, remaining: 999, algorithm: 'Bypassed' };
    return next();
  }

  // Determine Effective Rate Limit Settings (Route policy merged with Key Tier)
  const tierConfig = TIER_DEFAULTS[keyObj.tier] || TIER_DEFAULTS.Free;
  const capacity = policy.capacity || tierConfig.capacity;
  const refillRate = policy.refillRate || tierConfig.refillRate;
  const windowMs = policy.windowMs || tierConfig.windowMs;
  const maxRequests = policy.maxRequests || tierConfig.maxRequests;
  const algorithm = policy.algorithm || 'Token Bucket';

  let evaluationResult;

  if (algorithm === 'Token Bucket') {
    evaluationResult = checkTokenBucket(keyObj.tokenBucket, capacity, refillRate);
  } else if (algorithm === 'Sliding Window') {
    evaluationResult = checkSlidingWindow(keyObj.slidingWindow, windowMs, maxRequests);
  } else {
    // Fixed Window
    evaluationResult = checkFixedWindow(keyObj.fixedWindow, windowMs, maxRequests);
  }

  // Set standard RateLimit headers
  res.setHeader('X-RateLimit-Limit', evaluationResult.limit);
  res.setHeader('X-RateLimit-Remaining', evaluationResult.remaining);
  res.setHeader('X-RateLimit-Reset', evaluationResult.resetSec);

  // 3. Handle Rate Limit Rejection (HTTP 429)
  if (!evaluationResult.allowed) {
    metrics.blockedRequests += 1;
    metrics.statusCounts[429] = (metrics.statusCounts[429] || 0) + 1;

    res.setHeader('Retry-After', evaluationResult.retryAfter);

    const latency = Date.now() - startTime;
    metrics.latencySum += latency;

    const logEntry = {
      id: 'req_' + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      method: req.method,
      path: reqPath,
      apiKey: apiKeyStr,
      clientName: keyObj.name,
      tier: keyObj.tier,
      status: 429,
      latencyMs: latency,
      algorithm,
      remaining: 0,
      retryAfter: evaluationResult.retryAfter,
      message: `Throttled by ${algorithm}. Exceeded quota threshold.`
    };
    pushLog(logEntry);

    return res.status(429).json({
      status: 429,
      error: 'Too Many Requests',
      message: `Rate limit quota exceeded for key '${keyObj.name}' (${keyObj.tier} tier) on route '${reqPath}'.`,
      algorithmUsed: algorithm,
      retryAfterSeconds: evaluationResult.retryAfter,
      limits: {
        limit: evaluationResult.limit,
        remaining: 0,
        resetInSeconds: evaluationResult.resetSec
      }
    });
  }

  // 4. Request Allowed
  metrics.allowedRequests += 1;
  metrics.statusCounts[200] = (metrics.statusCounts[200] || 0) + 1;
  keyObj.quotaUsed += 1;

  // Artificial throttling delay if route has delayMs
  const delayMs = policy.delayMs || 0;
  setTimeout(() => {
    const latency = Date.now() - startTime;
    metrics.latencySum += latency;

    const logEntry = {
      id: 'req_' + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      method: req.method,
      path: reqPath,
      apiKey: apiKeyStr,
      clientName: keyObj.name,
      tier: keyObj.tier,
      status: 200,
      latencyMs: latency,
      algorithm,
      remaining: evaluationResult.remaining,
      message: 'Request allowed & proxied successfully'
    };
    pushLog(logEntry);

    req.gatewayMeta = {
      keyObj,
      remaining: evaluationResult.remaining,
      algorithm,
      latencyMs: latency
    };
    next();
  }, delayMs);
}

function pushLog(entry) {
  requestLogs.unshift(entry);
  if (requestLogs.length > MAX_LOG_SIZE) {
    requestLogs.pop();
  }
}

// ==========================================
// 4. GATEWAY MANAGEMENT API ENDPOINTS
// ==========================================

// Gateway Health & Summary
app.get('/api/gateway/health', (req, res) => {
  res.json({
    status: 'healthy',
    gateway: 'Distributed API Gateway & Token Bucket Rate Limiter',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Gateway Metrics & Real-time Statistics
app.get('/api/gateway/metrics', (req, res) => {
  const avgLatency = metrics.totalRequests > 0
    ? Math.round(metrics.latencySum / metrics.totalRequests)
    : 0;

  res.json({
    summary: {
      totalRequests: metrics.totalRequests,
      allowedRequests: metrics.allowedRequests,
      blockedRequests: metrics.blockedRequests,
      unauthorizedRequests: metrics.unauthorizedRequests,
      successRatePct: metrics.totalRequests > 0
        ? Math.round((metrics.allowedRequests / metrics.totalRequests) * 100)
        : 100,
      avgLatencyMs: avgLatency
    },
    statusCounts: metrics.statusCounts,
    endpointCounts: metrics.endpointCounts,
    keyCounts: metrics.keyCounts,
    timestamp: new Date().toISOString()
  });
});

// Gateway Request Logs Stream
app.get('/api/gateway/logs', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  res.json({
    totalLogs: requestLogs.length,
    logs: requestLogs.slice(0, limit)
  });
});

// Manage API Keys
app.get('/api/gateway/keys', (req, res) => {
  const keyList = Object.values(apiKeys).map(k => ({
    key: k.key,
    name: k.name,
    tier: k.tier,
    active: k.active,
    quotaUsed: k.quotaUsed,
    createdAt: k.createdAt,
    currentTokenBucket: k.tokenBucket ? Math.floor(k.tokenBucket.tokens * 10) / 10 : null
  }));
  res.json(keyList);
});

app.post('/api/gateway/keys', (req, res) => {
  const { name, tier } = req.body;
  if (!name || !tier) {
    return res.status(400).json({ error: 'Name and Tier are required' });
  }

  const newKeyStr = 'gw_' + tier.toLowerCase() + '_' + Math.random().toString(36).substr(2, 8);
  const tierInfo = TIER_DEFAULTS[tier] || TIER_DEFAULTS.Free;

  apiKeys[newKeyStr] = {
    key: newKeyStr,
    name,
    tier,
    active: true,
    quotaUsed: 0,
    createdAt: new Date().toISOString(),
    tokenBucket: { tokens: tierInfo.capacity, lastRefill: Date.now() },
    slidingWindow: { timestamps: [] },
    fixedWindow: { windowIndex: Math.floor(Date.now() / 60000), count: 0 }
  };

  res.status(201).json({
    message: 'API Key generated successfully',
    key: apiKeys[newKeyStr]
  });
});

app.patch('/api/gateway/keys/:key', (req, res) => {
  const keyStr = req.params.key;
  if (!apiKeys[keyStr]) {
    return res.status(404).json({ error: 'API Key not found' });
  }

  const { tier, active, name } = req.body;
  if (tier !== undefined) {
    apiKeys[keyStr].tier = tier;
    const tierInfo = TIER_DEFAULTS[tier] || TIER_DEFAULTS.Free;
    apiKeys[keyStr].tokenBucket.tokens = tierInfo.capacity;
  }
  if (active !== undefined) apiKeys[keyStr].active = active;
  if (name !== undefined) apiKeys[keyStr].name = name;

  res.json({ message: 'API Key updated', key: apiKeys[keyStr] });
});

app.delete('/api/gateway/keys/:key', (req, res) => {
  const keyStr = req.params.key;
  if (!apiKeys[keyStr]) {
    return res.status(404).json({ error: 'API Key not found' });
  }
  delete apiKeys[keyStr];
  res.json({ message: `API Key '${keyStr}' revoked & deleted.` });
});

// Manage Route Policies
app.get('/api/gateway/routes', (req, res) => {
  res.json(Object.values(routePolicies));
});

app.post('/api/gateway/routes', (req, res) => {
  const { path, name, algorithm, capacity, refillRate, windowMs, maxRequests, delayMs, enabled } = req.body;
  if (!path) {
    return res.status(400).json({ error: 'Route path is required' });
  }

  routePolicies[path] = {
    path,
    name: name || routePolicies[path]?.name || 'Custom Endpoint',
    algorithm: algorithm || 'Token Bucket',
    capacity: capacity !== undefined ? Number(capacity) : 20,
    refillRate: refillRate !== undefined ? Number(refillRate) : 2,
    windowMs: windowMs !== undefined ? Number(windowMs) : 60000,
    maxRequests: maxRequests !== undefined ? Number(maxRequests) : 30,
    delayMs: delayMs !== undefined ? Number(delayMs) : 0,
    enabled: enabled !== undefined ? enabled : true
  };

  res.json({ message: 'Route rate limit policy updated successfully', policy: routePolicies[path] });
});

// Reset metrics and logs
app.post('/api/gateway/reset-metrics', (req, res) => {
  metrics.totalRequests = 0;
  metrics.allowedRequests = 0;
  metrics.blockedRequests = 0;
  metrics.unauthorizedRequests = 0;
  metrics.latencySum = 0;
  metrics.statusCounts = { 200: 0, 429: 0, 401: 0, 500: 0 };
  metrics.endpointCounts = {};
  metrics.keyCounts = {};
  requestLogs.length = 0;

  res.json({ message: 'Gateway metrics & request logs reset' });
});

// Interactive Traffic Burst Simulator Endpoint
app.post('/api/gateway/simulate-burst', async (req, res) => {
  const { apiKey, path, count, delayBetweenMs } = req.body;
  const targetPath = path || '/api/v1/users';
  const targetKey = apiKey || 'gw_free_demo_89324';
  const totalCount = Math.min(100, Math.max(1, parseInt(count) || 15));
  const delay = Math.max(0, parseInt(delayBetweenMs) || 10);

  const results = [];

  for (let i = 0; i < totalCount; i++) {
    const start = Date.now();

    // Internal simulation call logic
    const mockReq = {
      method: 'GET',
      path: targetPath,
      headers: { 'x-api-key': targetKey },
      query: {}
    };

    let status = 200;
    let resHeaders = {};
    let resPayload = {};

    const mockRes = {
      setHeader: (h, v) => { resHeaders[h] = v; },
      status: (code) => {
        status = code;
        return mockRes;
      },
      json: (data) => {
        resPayload = data;
        return mockRes;
      }
    };

    let calledNext = false;
    gatewayRateLimiter(mockReq, mockRes, () => {
      calledNext = true;
    });

    if (calledNext) {
      status = 200;
      resPayload = {
        status: 200,
        message: `Proxied successfully to ${targetPath}`,
        timestamp: new Date().toISOString()
      };
    }

    const elapsed = Date.now() - start;
    results.push({
      requestIndex: i + 1,
      status,
      latencyMs: elapsed,
      remainingTokens: resHeaders['X-RateLimit-Remaining'] ?? null,
      retryAfter: resHeaders['Retry-After'] ?? null,
      message: resPayload.message || 'OK'
    });

    if (delay > 0 && i < totalCount - 1) {
      await new Promise(r => setTimeout(r, delay));
    }
  }

  const passed = results.filter(r => r.status === 200).length;
  const throttled = results.filter(r => r.status === 429).length;

  res.json({
    targetPath,
    apiKey: targetKey,
    totalSimulated: totalCount,
    passed,
    throttled,
    results
  });
});

// ==========================================
// 5. PROXIED BUSINESS ENDPOINTS (BEHIND GATEWAY)
// ==========================================

app.get('/api/v1/users', gatewayRateLimiter, (req, res) => {
  res.json({
    status: 200,
    service: 'User Management API',
    data: [
      { id: 101, name: 'Alice Smith', email: 'alice@example.com', role: 'Admin' },
      { id: 102, name: 'Bob Jones', email: 'bob@example.com', role: 'Doctor' },
      { id: 103, name: 'Charlie Brown', email: 'charlie@example.com', role: 'Patient' }
    ],
    gatewayMeta: req.gatewayMeta
  });
});

app.get('/api/v1/products', gatewayRateLimiter, (req, res) => {
  res.json({
    status: 200,
    service: 'Product Catalog Service',
    data: [
      { id: 'p1', name: 'Digital Stethoscope', price: 299.99, stock: 45 },
      { id: 'p2', name: 'ECG Monitor Monitor Pro', price: 899.00, stock: 12 },
      { id: 'p3', name: 'Smart BP Cuff', price: 120.50, stock: 100 }
    ],
    gatewayMeta: req.gatewayMeta
  });
});

app.post('/api/v1/orders', gatewayRateLimiter, (req, res) => {
  res.json({
    status: 200,
    service: 'Order Processing Engine',
    orderId: 'ORD-' + Math.floor(100000 + Math.random() * 900000),
    paymentStatus: 'ACCEPTED',
    processedAt: new Date().toISOString(),
    gatewayMeta: req.gatewayMeta
  });
});

app.get('/api/v1/analytics', gatewayRateLimiter, (req, res) => {
  res.json({
    status: 200,
    service: 'Telemetry & Analytics Engine',
    metrics: {
      activeSessions: 1420,
      cpuUsage: '28%',
      memoryUsage: '1.4 GB',
      networkIn: '45.2 MB/s'
    },
    gatewayMeta: req.gatewayMeta
  });
});

app.post('/api/v1/heavy-compute', gatewayRateLimiter, (req, res) => {
  res.json({
    status: 200,
    service: 'AI & Heavy Compute Task',
    taskResult: 'Neural Inference Complete: Medical Image Segmentation Score 98.4%',
    executionTimeMs: req.gatewayMeta?.latencyMs || 250,
    gatewayMeta: req.gatewayMeta
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` 🚀 DISTRIBUTED API GATEWAY SERVER RUNNING ON PORT ${PORT}`);
  console.log(` 🛡️  Algorithms Active: Token Bucket, Sliding Window, Fixed Window`);
  console.log(` 🌐 Endpoint: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
