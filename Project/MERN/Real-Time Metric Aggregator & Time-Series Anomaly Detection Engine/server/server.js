const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// In-Memory Time-Series Database
let telemetryMetrics = [];

// Seed past 20 time-series points
const nowSec = Math.floor(Date.now() / 1000);
for (let i = 20; i >= 1; i--) {
  telemetryMetrics.push({
    timestamp: nowSec - i * 5,
    cpuUsagePct: Math.floor(Math.random() * 25 + 30),
    memoryUsageMb: Math.floor(Math.random() * 100 + 1024),
    apiRequestsPerSec: Math.floor(Math.random() * 50 + 120),
    isAnomaly: false
  });
}

// Ingest Metric
app.post("/api/metrics/ingest", (req, res) => {
  const { cpuUsagePct, memoryUsageMb, apiRequestsPerSec } = req.body;
  const point = {
    timestamp: Math.floor(Date.now() / 1000),
    cpuUsagePct: Number(cpuUsagePct),
    memoryUsageMb: Number(memoryUsageMb),
    apiRequestsPerSec: Number(apiRequestsPerSec),
    isAnomaly: false
  };

  // Z-Score Statistical Anomaly Detector
  const avgCpu = telemetryMetrics.reduce((acc, m) => acc + m.cpuUsagePct, 0) / (telemetryMetrics.length || 1);
  const stdDevCpu = Math.sqrt(telemetryMetrics.reduce((acc, m) => acc + Math.pow(m.cpuUsagePct - avgCpu, 2), 0) / (telemetryMetrics.length || 1)) || 1;
  const zScore = Math.abs((point.cpuUsagePct - avgCpu) / stdDevCpu);

  if (zScore > 2.2 || point.cpuUsagePct > 85) {
    point.isAnomaly = true;
  }

  telemetryMetrics.push(point);
  if (telemetryMetrics.length > 50) telemetryMetrics.shift();

  res.json({ success: true, ingestedPoint: point, zScore: zScore.toFixed(2), anomalyDetected: point.isAnomaly });
});

// Fetch Aggregated Time-Series metrics
app.get("/api/metrics/series", (req, res) => {
  const anomaliesCount = telemetryMetrics.filter(m => m.isAnomaly).length;
  const latest = telemetryMetrics[telemetryMetrics.length - 1];

  res.json({
    success: true,
    series: telemetryMetrics,
    anomaliesCount,
    latestPoint: latest,
    alertActive: latest ? latest.cpuUsagePct > 85 || latest.isAnomaly : false
  });
});

const PORT = process.env.PORT || 5007;
app.listen(PORT, () => {
  console.log(`Time-Series Anomaly Detection Engine running on port ${PORT}`);
});
