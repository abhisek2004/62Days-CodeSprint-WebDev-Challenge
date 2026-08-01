const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// In-Memory Shards state
let shardingStrategy = "range"; // "range" or "hash"
let shards = {
  "Shard-1": { range: [1, 1000], records: [] },
  "Shard-2": { range: [1001, 2000], records: [] },
  "Shard-3": { range: [2001, 3000], records: [] }
};

// Seed mock records
for (let i = 1; i <= 600; i++) {
  const tenantId = `tenant-${Math.floor(Math.random() * 100) + 1}`;
  const record = { id: i, tenantId, payload: `Data payload for ID ${i}` };
  const shardKey = getShardForId(i, tenantId, shardingStrategy);
  shards[shardKey].records.push(record);
}

function getShardForId(id, tenantId, strategy) {
  if (strategy === "range") {
    if (id <= 1000) return "Shard-1";
    if (id <= 2000) return "Shard-2";
    return "Shard-3";
  } else {
    // Hash-based sharding on tenantId
    let hash = 0;
    for (let char of tenantId) {
      hash = (hash << 5) - hash + char.charCodeAt(0);
    }
    const shardIdx = (Math.abs(hash) % 3) + 1;
    return `Shard-${shardIdx}`;
  }
}

// Get Shards map and stats
app.get("/api/shards", (req, res) => {
  const shardSummary = Object.keys(shards).map(key => ({
    name: key,
    range: shards[key].range,
    count: shards[key].records.length,
    percentage: Math.round((shards[key].records.length / getTotalRecords()) * 100) || 0
  }));

  const total = getTotalRecords();
  const counts = shardSummary.map(s => s.count);
  const avg = total / 3;
  const hotspot = shardSummary.find(s => s.count > avg * 1.4);

  res.json({
    success: true,
    strategy: shardingStrategy,
    totalRecords: total,
    shards: shardSummary,
    hotspotDetected: !!hotspot,
    hotspotShard: hotspot ? hotspot.name : null
  });
});

function getTotalRecords() {
  return Object.values(shards).reduce((acc, s) => acc + s.records.length, 0);
}

// Re-configure strategy & re-balance data
app.post("/api/shards/configure", (req, res) => {
  const { strategy } = req.body;
  shardingStrategy = strategy;

  // Collect all records and re-distribute
  const allRecords = [];
  Object.keys(shards).forEach(k => {
    allRecords.push(...shards[k].records);
    shards[k].records = [];
  });

  allRecords.forEach(rec => {
    const targetShard = getShardForId(rec.id, rec.tenantId, shardingStrategy);
    shards[targetShard].records.push(rec);
  });

  res.json({ success: true, message: `Strategy changed to ${strategy}`, strategy });
});

// Execute Query (Single Shard vs Scatter-Gather)
app.post("/api/shards/query", (req, res) => {
  const { queryType, targetId, tenantId } = req.body;
  const startTime = Date.now();

  if (queryType === "single_shard") {
    const targetShardKey = getShardForId(Number(targetId), tenantId || "tenant-1", shardingStrategy);
    const rec = shards[targetShardKey].records.find(r => r.id === Number(targetId));
    return res.json({
      success: true,
      queryType,
      shardsQueried: [targetShardKey],
      latencyMs: Math.floor(Math.random() * 4) + 1,
      resultsCount: rec ? 1 : 0,
      record: rec || null
    });
  } else {
    // Scatter-Gather across all shards
    let totalResults = 0;
    const shardsQueried = Object.keys(shards);
    shardsQueried.forEach(k => {
      totalResults += shards[k].records.length;
    });

    return res.json({
      success: true,
      queryType,
      shardsQueried,
      latencyMs: Math.floor(Math.random() * 25) + 15,
      resultsCount: totalResults
    });
  }
});

// Simulate Hotspot workload
app.post("/api/shards/simulate-hotspot", (req, res) => {
  const targetShard = "Shard-1";
  for (let i = 3001; i <= 3500; i++) {
    shards[targetShard].records.push({ id: i, tenantId: "tenant-hotspot", payload: `Hotspot traffic payload ${i}` });
  }
  res.json({ success: true, message: "Hotspot workload injected into Shard-1" });
});

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
  console.log(`Sharding Coordinator Server running on port ${PORT}`);
});
