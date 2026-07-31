const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ==========================================
// 1. IN-MEMORY ELASTIC SEARCH & INDEX ENGINE
// ==========================================
class ElasticSearchEngine {
  constructor() {
    this.logs = []; // Master log store (max 20,000 logs)
    this.invertedIndex = new Map(); // term -> Set(logId)
    this.fieldIndex = {
      service: new Map(), // service -> Set(logId)
      level: new Map(),   // level -> Set(logId)
      traceId: new Map()  // traceId -> Set(logId)
    };
    this.maxLogs = 20000;
  }

  // Tokenize text into normalized searchable terms
  tokenize(text) {
    if (!text) return [];
    return String(text)
      .toLowerCase()
      .replace(/[^a-z0-9_\-\.\:\/]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 1);
  }

  // Index a single log document
  indexLog(log) {
    this.logs.unshift(log);

    // Maintain max log buffer capacity
    if (this.logs.length > this.maxLogs) {
      const removed = this.logs.pop();
      this.removeFromIndex(removed);
    }

    const logId = log.id;

    // Index full-text fields (message, endpoint, metadata, stack)
    const fullText = `${log.message || ''} ${log.endpoint || ''} ${log.service || ''} ${JSON.stringify(log.metadata || {})}`;
    const tokens = this.tokenize(fullText);

    tokens.forEach(token => {
      if (!this.invertedIndex.has(token)) {
        this.invertedIndex.set(token, new Set());
      }
      this.invertedIndex.get(token).add(logId);
    });

    // Field indexing for fast exact lookup
    if (log.service) {
      const svc = log.service.toLowerCase();
      if (!this.fieldIndex.service.has(svc)) this.fieldIndex.service.set(svc, new Set());
      this.fieldIndex.service.get(svc).add(logId);
    }

    if (log.level) {
      const lvl = log.level.toUpperCase();
      if (!this.fieldIndex.level.has(lvl)) this.fieldIndex.level.set(lvl, new Set());
      this.fieldIndex.level.get(lvl).add(logId);
    }

    if (log.traceId) {
      const tid = log.traceId.toLowerCase();
      if (!this.fieldIndex.traceId.has(tid)) this.fieldIndex.traceId.set(tid, new Set());
      this.fieldIndex.traceId.get(tid).add(logId);
    }
  }

  // Remove log from index on buffer eviction
  removeFromIndex(log) {
    const logId = log.id;
    const fullText = `${log.message || ''} ${log.endpoint || ''} ${log.service || ''} ${JSON.stringify(log.metadata || {})}`;
    const tokens = this.tokenize(fullText);

    tokens.forEach(token => {
      if (this.invertedIndex.has(token)) {
        this.invertedIndex.get(token).delete(logId);
        if (this.invertedIndex.get(token).size === 0) {
          this.invertedIndex.delete(token);
        }
      }
    });

    if (log.service && this.fieldIndex.service.has(log.service.toLowerCase())) {
      this.fieldIndex.service.get(log.service.toLowerCase()).delete(logId);
    }
    if (log.level && this.fieldIndex.level.has(log.level.toUpperCase())) {
      this.fieldIndex.level.get(log.level.toUpperCase()).delete(logId);
    }
    if (log.traceId && this.fieldIndex.traceId.has(log.traceId.toLowerCase())) {
      this.fieldIndex.traceId.get(log.traceId.toLowerCase()).delete(logId);
    }
  }

  // Execute full-text query with BM25 / TF-IDF score computation and field filters
  search({ q, level, service, from, to, page = 1, limit = 50 }) {
    const startTime = process.hrtime();

    let candidateIds = null;

    // 1. Field Filters (level, service)
    if (level && level !== 'ALL') {
      const lvlSet = this.fieldIndex.level.get(level.toUpperCase()) || new Set();
      candidateIds = new Set(lvlSet);
    }

    if (service && service !== 'ALL') {
      const svcSet = this.fieldIndex.service.get(service.toLowerCase()) || new Set();
      if (candidateIds === null) {
        candidateIds = new Set(svcSet);
      } else {
        candidateIds = new Set([...candidateIds].filter(id => svcSet.has(id)));
      }
    }

    // Parse specific field query tokens like "service:auth" or "level:error"
    let cleanQuery = q || '';
    if (cleanQuery) {
      const fieldMatches = cleanQuery.match(/(service|level|traceid|status)\:([\w\-]+)/gi);
      if (fieldMatches) {
        fieldMatches.forEach(fm => {
          const [key, val] = fm.split(':');
          cleanQuery = cleanQuery.replace(fm, '').trim();
          if (key.toLowerCase() === 'service') {
            const sSet = this.fieldIndex.service.get(val.toLowerCase()) || new Set();
            candidateIds = candidateIds ? new Set([...candidateIds].filter(id => sSet.has(id))) : new Set(sSet);
          } else if (key.toLowerCase() === 'level') {
            const lSet = this.fieldIndex.level.get(val.toUpperCase()) || new Set();
            candidateIds = candidateIds ? new Set([...candidateIds].filter(id => lSet.has(id))) : new Set(lSet);
          }
        });
      }
    }

    // 2. Full-Text Query Evaluation
    const queryTokens = this.tokenize(cleanQuery);
    let scoredLogs = [];

    let searchScope = candidateIds ? this.logs.filter(l => candidateIds.has(l.id)) : this.logs;

    // Date Filtering
    if (from) {
      const fromTime = new Date(from).getTime();
      searchScope = searchScope.filter(l => new Date(l.timestamp).getTime() >= fromTime);
    }
    if (to) {
      const toTime = new Date(to).getTime();
      searchScope = searchScope.filter(l => new Date(l.timestamp).getTime() <= toTime);
    }

    if (queryTokens.length === 0) {
      scoredLogs = searchScope.map(log => ({ log, score: 1.0, highlights: [] }));
    } else {
      const totalDocs = this.logs.length || 1;

      searchScope.forEach(log => {
        let score = 0;
        const highlights = [];
        const logText = `${log.message} ${log.service} ${log.endpoint || ''} ${JSON.stringify(log.metadata || {})}`.toLowerCase();

        queryTokens.forEach(token => {
          // Document frequency for inverse document frequency (IDF)
          const matchingDocSet = this.invertedIndex.get(token);
          const docFreq = matchingDocSet ? matchingDocSet.size : 0;

          if (docFreq > 0) {
            const idf = Math.log(1 + (totalDocs - docFreq + 0.5) / (docFreq + 0.5));
            
            // Term frequency in current log
            const regex = new RegExp(token.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
            const termMatches = (logText.match(regex) || []).length;

            if (termMatches > 0) {
              score += idf * (termMatches / (termMatches + 1.2));
              highlights.push(token);
            }
          } else if (logText.includes(token)) {
            // Substring fallback score
            score += 0.5;
            highlights.push(token);
          }
        });

        if (score > 0) {
          scoredLogs.push({ log, score: Number(score.toFixed(4)), highlights });
        }
      });

      // Sort by relevance score descending, then timestamp descending
      scoredLogs.sort((a, b) => b.score - a.score || new Date(b.log.timestamp) - new Date(a.log.timestamp));
    }

    const totalCount = scoredLogs.length;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);
    const startIndex = (pageNum - 1) * limitNum;
    const paginatedResults = scoredLogs.slice(startIndex, startIndex + limitNum);

    const diff = process.hrtime(startTime);
    const executionTimeMs = (diff[0] * 1000 + diff[1] / 1e6).toFixed(2);

    return {
      total: totalCount,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(totalCount / limitNum) || 1,
      tookMs: executionTimeMs,
      results: paginatedResults
    };
  }

  // Get aggregated stats & time series metrics
  getStats() {
    const totalLogs = this.logs.length;
    const levelCounts = { INFO: 0, WARN: 0, ERROR: 0, FATAL: 0 };
    const serviceCounts = {};
    const serviceErrors = {};

    const now = Date.now();
    const pastOneMin = now - 60000;
    let lastMinCount = 0;

    // Time-series volume (last 30 minutes in 1-minute buckets)
    const bucketCount = 30;
    const bucketInterval = 60 * 1000;
    const timeBuckets = Array.from({ length: bucketCount }, (_, i) => {
      const bucketTime = new Date(now - (bucketCount - 1 - i) * bucketInterval);
      return {
        timestamp: bucketTime.toISOString(),
        label: bucketTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        INFO: 0,
        WARN: 0,
        ERROR: 0,
        FATAL: 0,
        total: 0
      };
    });

    this.logs.forEach(log => {
      // Level count
      if (levelCounts[log.level] !== undefined) {
        levelCounts[log.level]++;
      }

      // Service count
      const svc = log.service || 'unknown';
      serviceCounts[svc] = (serviceCounts[svc] || 0) + 1;

      if (log.level === 'ERROR' || log.level === 'FATAL') {
        serviceErrors[svc] = (serviceErrors[svc] || 0) + 1;
      }

      const logTime = new Date(log.timestamp).getTime();
      if (logTime >= pastOneMin) {
        lastMinCount++;
      }

      // Bucket attribution
      const ageMs = now - logTime;
      const bucketIdx = bucketCount - 1 - Math.floor(ageMs / bucketInterval);
      if (bucketIdx >= 0 && bucketIdx < bucketCount) {
        timeBuckets[bucketIdx].total++;
        if (timeBuckets[bucketIdx][log.level] !== undefined) {
          timeBuckets[bucketIdx][log.level]++;
        }
      }
    });

    const totalErrors = levelCounts.ERROR + levelCounts.FATAL;
    const errorRatePercent = totalLogs > 0 ? ((totalErrors / totalLogs) * 100).toFixed(1) : 0;
    const throughputPerSec = (lastMinCount / 60).toFixed(1);

    return {
      totalLogs,
      throughputPerSec,
      errorRatePercent,
      levelCounts,
      serviceCounts,
      serviceErrors,
      timeSeries: timeBuckets,
      services: Object.keys(serviceCounts)
    };
  }
}

const searchEngine = new ElasticSearchEngine();

// ==========================================
// 2. API KEY MANAGEMENT & SECURITY
// ==========================================
const apiKeys = new Map();

// Seed initial master API key for easy testing
const DEFAULT_API_KEY = 'log_live_key_9f8a7b6c5d4e';
apiKeys.set(DEFAULT_API_KEY, {
  key: DEFAULT_API_KEY,
  name: 'Master Aggregator Key',
  service: 'all-services',
  createdAt: new Date().toISOString(),
  requestsCount: 0
});

const validateApiKey = (req, res, next) => {
  const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '') || req.query.apiKey;

  if (!apiKey || !apiKeys.has(apiKey)) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or missing API key. Please pass a valid X-API-Key header.'
    });
  }

  const keyData = apiKeys.get(apiKey);
  keyData.requestsCount++;
  req.apiKeyData = keyData;
  next();
};

// ==========================================
// 3. MOCK SERVICE LOG GENERATOR & SIMULATOR
// ==========================================
let simulatorActive = true;
let simulatorInterval = null;
let simulatorSpeedMs = 1500; // default 1 log every 1.5 sec

const MOCK_SERVICES = [
  { name: 'auth-service', endpoints: ['/api/v1/auth/login', '/api/v1/auth/token', '/api/v1/auth/mfa'] },
  { name: 'payment-gateway', endpoints: ['/api/v1/checkout/stripe', '/api/v1/refund', '/api/v1/webhooks/paypal'] },
  { name: 'order-processor', endpoints: ['/api/v1/orders/create', '/api/v1/orders/fulfill', '/api/v1/inventory/deduct'] },
  { name: 'user-db', endpoints: ['POST /users/query', 'UPDATE /users/profile', 'DELETE /users/session'] },
  { name: 'k8s-ingress', endpoints: ['GET /healthz', 'PROXIED /api/v1/*', 'INGRESS /ssl/handshake'] }
];

const LOG_TEMPLATES = [
  { level: 'INFO', msg: (svc, ep) => `Successfully processed HTTP request for ${ep}`, status: 200 },
  { level: 'INFO', msg: (svc, ep) => `Cache hit for request context in ${svc}`, status: 200 },
  { level: 'WARN', msg: (svc, ep) => `High memory consumption threshold reached (84%) on instance node-03`, status: 200 },
  { level: 'WARN', msg: (svc, ep) => `Slow query detected in ${svc} taking ${Math.floor(Math.random() * 800 + 400)}ms`, status: 200 },
  { level: 'ERROR', msg: (svc, ep) => `Failed database transaction on ${ep}: Connection timed out after 3000ms`, status: 500 },
  { level: 'ERROR', msg: (svc, ep) => `Invalid JWT Signature presented to ${ep} from IP 192.168.1.104`, status: 401 },
  { level: 'FATAL', msg: (svc, ep) => `Uncaught Exception in ${svc}: OOM Heap Limit Exceeded. Worker process crashed!`, status: 503 }
];

function generateRandomLog() {
  const serviceObj = MOCK_SERVICES[Math.floor(Math.random() * MOCK_SERVICES.length)];
  const endpoint = serviceObj.endpoints[Math.floor(Math.random() * serviceObj.endpoints.length)];
  
  // Weight levels: 60% INFO, 20% WARN, 15% ERROR, 5% FATAL
  const rand = Math.random();
  let selectedTemplate;
  if (rand < 0.60) {
    selectedTemplate = LOG_TEMPLATES[0];
  } else if (rand < 0.80) {
    selectedTemplate = LOG_TEMPLATES[Math.random() > 0.5 ? 1 : 2];
  } else if (rand < 0.95) {
    selectedTemplate = LOG_TEMPLATES[Math.random() > 0.5 ? 3 : 4];
  } else {
    selectedTemplate = LOG_TEMPLATES[6];
  }

  const traceId = 'tr_' + crypto.randomBytes(6).toString('hex');
  const userId = 'usr_' + Math.floor(Math.random() * 9000 + 1000);

  return {
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
    timestamp: new Date().toISOString(),
    level: selectedTemplate.level,
    service: serviceObj.name,
    endpoint,
    message: selectedTemplate.msg(serviceObj.name, endpoint),
    httpStatus: selectedTemplate.status,
    durationMs: Math.floor(Math.random() * 450 + 15),
    traceId,
    userId,
    metadata: {
      environment: 'production',
      region: 'us-east-1',
      hostname: `${serviceObj.name}-pod-${Math.floor(Math.random() * 5 + 1)}`
    }
  };
}

function startSimulator() {
  if (simulatorInterval) clearInterval(simulatorInterval);
  simulatorInterval = setInterval(() => {
    if (!simulatorActive) return;
    const log = generateRandomLog();
    searchEngine.indexLog(log);

    // Broadcast log in real time to connected clients
    io.emit('new_log', log);
    io.emit('stats_update', searchEngine.getStats());

    // Check for high error spike alert trigger
    if (log.level === 'ERROR' || log.level === 'FATAL') {
      io.emit('error_alert', {
        title: `${log.level} detected in ${log.service}`,
        message: log.message,
        timestamp: log.timestamp,
        log
      });
    }
  }, simulatorSpeedMs);
}

// Seed initial 120 logs so user immediately sees rich telemetry
function seedInitialData() {
  const baseTime = Date.now() - 15 * 60 * 1000; // past 15 mins
  for (let i = 0; i < 120; i++) {
    const log = generateRandomLog();
    log.timestamp = new Date(baseTime + i * 7500).toISOString();
    searchEngine.indexLog(log);
  }
}

seedInitialData();
startSimulator();

// ==========================================
// 4. REST API ROUTES
// ==========================================

// Ingest Log Endpoint (Secured by API Key)
app.post('/api/logs/ingest', validateApiKey, (req, res) => {
  const payload = req.body;
  const logsToIngest = Array.isArray(payload) ? payload : [payload];
  const ingested = [];

  logsToIngest.forEach(rawLog => {
    const log = {
      id: rawLog.id || 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      timestamp: rawLog.timestamp || new Date().toISOString(),
      level: (rawLog.level || 'INFO').toUpperCase(),
      service: rawLog.service || req.apiKeyData.service || 'external-service',
      endpoint: rawLog.endpoint || '/api',
      message: rawLog.message || 'No message provided',
      httpStatus: rawLog.httpStatus || 200,
      durationMs: rawLog.durationMs || 0,
      traceId: rawLog.traceId || 'tr_' + crypto.randomBytes(6).toString('hex'),
      userId: rawLog.userId || 'system',
      metadata: rawLog.metadata || {}
    };

    searchEngine.indexLog(log);
    ingested.push(log);

    // Broadcast to real-time subscribers
    io.emit('new_log', log);
  });

  io.emit('stats_update', searchEngine.getStats());

  return res.status(201).json({
    success: true,
    count: ingested.length,
    ingestedLogs: ingested
  });
});

// Full-Text Search Logs Endpoint
app.get('/api/logs', (req, res) => {
  const { q, level, service, from, to, page, limit } = req.query;
  const result = searchEngine.search({ q, level, service, from, to, page, limit });
  res.json(result);
});

// Aggregated Metrics & Real-time Stats
app.get('/api/logs/stats', (req, res) => {
  res.json(searchEngine.getStats());
});

// Export Logs Endpoint (CSV & JSON)
app.get('/api/logs/export', (req, res) => {
  const { format = 'json', q, level, service } = req.query;
  const searchResult = searchEngine.search({ q, level, service, limit: 5000 });
  const logs = searchResult.results.map(r => r.log);

  if (format.toLowerCase() === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=logs_export_${Date.now()}.csv`);

    const headers = ['id', 'timestamp', 'level', 'service', 'httpStatus', 'durationMs', 'traceId', 'message'];
    const csvRows = [headers.join(',')];

    logs.forEach(l => {
      const row = [
        `"${l.id}"`,
        `"${l.timestamp}"`,
        `"${l.level}"`,
        `"${l.service}"`,
        l.httpStatus,
        l.durationMs,
        `"${l.traceId}"`,
        `"${(l.message || '').replace(/"/g, '""')}"`
      ];
      csvRows.push(row.join(','));
    });

    return res.send(csvRows.join('\n'));
  }

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=logs_export_${Date.now()}.json`);
  return res.json(logs);
});

// API Key Management Routes
app.get('/api/keys', (req, res) => {
  const keysList = Array.from(apiKeys.values());
  res.json(keysList);
});

app.post('/api/keys/generate', (req, res) => {
  const { name, service } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Name is required to generate API Key' });
  }

  const newKeyStr = 'log_key_' + crypto.randomBytes(16).toString('hex');
  const keyObj = {
    key: newKeyStr,
    name,
    service: service || 'custom-service',
    createdAt: new Date().toISOString(),
    requestsCount: 0
  };

  apiKeys.set(newKeyStr, keyObj);
  res.status(201).json(keyObj);
});

// Simulator Control Route
app.post('/api/simulator/toggle', (req, res) => {
  const { active, speedMs } = req.body;
  if (typeof active === 'boolean') {
    simulatorActive = active;
  }
  if (speedMs && !isNaN(speedMs)) {
    simulatorSpeedMs = parseInt(speedMs, 10);
    startSimulator();
  }
  res.json({
    simulatorActive,
    simulatorSpeedMs
  });
});

// Seed mock logs endpoint
app.post('/api/logs/seed', (req, res) => {
  const { count = 50 } = req.body;
  const created = [];
  for (let i = 0; i < count; i++) {
    const log = generateRandomLog();
    searchEngine.indexLog(log);
    created.push(log);
    io.emit('new_log', log);
  }
  io.emit('stats_update', searchEngine.getStats());
  res.json({ success: true, seededCount: created.length });
});

// Clear logs endpoint
app.post('/api/logs/clear', (req, res) => {
  searchEngine.logs = [];
  searchEngine.invertedIndex.clear();
  searchEngine.fieldIndex.service.clear();
  searchEngine.fieldIndex.level.clear();
  searchEngine.fieldIndex.traceId.clear();
  io.emit('stats_update', searchEngine.getStats());
  res.json({ success: true, message: 'Log database & search indices cleared.' });
});

// ==========================================
// 5. SOCKET.IO REAL-TIME TAILING & EVENTS
// ==========================================
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  // Send initial state & top 30 logs
  socket.emit('init_state', {
    stats: searchEngine.getStats(),
    recentLogs: searchEngine.logs.slice(0, 40),
    masterApiKey: DEFAULT_API_KEY,
    simulatorActive,
    simulatorSpeedMs
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// Start Server
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Elastic Log Search & Aggregator Engine Server`);
  console.log(`📡 HTTP & Socket.io Server running on port: ${PORT}`);
  console.log(`🔑 Master API Key: ${DEFAULT_API_KEY}`);
  console.log(`====================================================`);
});
