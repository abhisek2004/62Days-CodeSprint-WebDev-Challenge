const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Simulated In-Memory Redis Cluster Store
// Key: clientId -> array of timestamps in milliseconds
const redisClusterBuckets = {};

const TIER_LIMITS = {
  free: { limit: 10, windowSec: 60 },
  enterprise: { limit: 100, windowSec: 60 }
};

// Rate Limiter API Gateway endpoint
app.post("/api/gateway/request", (req, res) => {
  const { clientId = "client-ip-127.0.0.1", tier = "free" } = req.body;
  const now = Date.now();
  const config = TIER_LIMITS[tier] || TIER_LIMITS.free;
  const windowMs = config.windowSec * 1000;

  if (!redisClusterBuckets[clientId]) {
    redisClusterBuckets[clientId] = [];
  }

  // Sliding Window Counter calculation: filter out timestamps outside current sliding window
  const validTimestamps = redisClusterBuckets[clientId].filter(ts => now - ts < windowMs);
  redisClusterBuckets[clientId] = validTimestamps;

  if (validTimestamps.length >= config.limit) {
    const oldestTimestamp = validTimestamps[0];
    const retryAfterSec = Math.ceil((oldestTimestamp + windowMs - now) / 1000);

    return res.status(429).json({
      success: false,
      status: 429,
      error: "Too Many Requests",
      message: `Rate limit exceeded. Tier limit: ${config.limit} req / ${config.windowSec}s`,
      retryAfterSec,
      currentCount: validTimestamps.length,
      limit: config.limit
    });
  }

  // Allow request and push timestamp to sliding window
  redisClusterBuckets[clientId].push(now);

  res.json({
    success: true,
    status: 200,
    message: "Request passed rate limiter gateway",
    remaining: config.limit - redisClusterBuckets[clientId].length,
    currentCount: redisClusterBuckets[clientId].length,
    limit: config.limit,
    tier
  });
});

app.get("/api/gateway/stats", (req, res) => {
  const now = Date.now();
  const stats = Object.keys(redisClusterBuckets).map(cid => {
    const active = redisClusterBuckets[cid].filter(ts => now - ts < 60000).length;
    return { clientId: cid, activeRequests: active };
  });

  res.json({ success: true, stats, totalClients: stats.length });
});

app.post("/api/gateway/reset", (req, res) => {
  Object.keys(redisClusterBuckets).forEach(k => delete redisClusterBuckets[k]);
  res.json({ success: true, message: "Redis cluster rate limiter buckets reset" });
});

const PORT = process.env.PORT || 5005;
app.listen(PORT, () => {
  console.log(`Distributed Rate Limiter Gateway running on port ${PORT}`);
});
