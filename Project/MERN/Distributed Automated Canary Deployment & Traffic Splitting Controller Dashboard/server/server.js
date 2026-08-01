const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let canaryState = {
  stableVersion: "v1.4.0",
  canaryVersion: "v2.0.0-rc1",
  canaryWeight: 10, // 10% Canary, 90% Stable
  status: "PROGRESSIVE_ROLLOUT", // "STABLE", "PROGRESSIVE_ROLLOUT", "ROLLED_BACK"
  autoRollbackThresholdPct: 2.0,
  metrics: {
    stable: { requestCount: 8900, errorRatePct: 0.12, avgLatencyMs: 42 },
    canary: { requestCount: 1100, errorRatePct: 0.85, avgLatencyMs: 48 }
  },
  history: [
    { timestamp: new Date().toISOString(), action: "CANARY_STARTED", weight: 10, note: "Initiated 10% canary traffic rollout" }
  ]
};

app.get("/api/canary/status", (req, res) => {
  res.json({ success: true, state: canaryState });
});

app.post("/api/canary/set-weight", (req, res) => {
  const { weight } = req.body;
  canaryState.canaryWeight = Number(weight);
  canaryState.history.unshift({
    timestamp: new Date().toISOString(),
    action: "TRAFFIC_SPLIT_UPDATED",
    weight: canaryState.canaryWeight,
    note: `Traffic weight adjusted to ${100 - canaryState.canaryWeight}% Stable / ${canaryState.canaryWeight}% Canary`
  });
  res.json({ success: true, state: canaryState });
});

app.post("/api/canary/simulate-traffic", (req, res) => {
  const { injectError } = req.body;
  
  if (injectError) {
    canaryState.metrics.canary.errorRatePct = (Math.random() * 3 + 2.5).toFixed(2);
    
    // Auto Rollback Trigger Check
    if (canaryState.metrics.canary.errorRatePct > canaryState.autoRollbackThresholdPct) {
      canaryState.canaryWeight = 0;
      canaryState.status = "ROLLED_BACK";
      canaryState.history.unshift({
        timestamp: new Date().toISOString(),
        action: "AUTO_ROLLBACK_TRIGGERED",
        weight: 0,
        note: `CRITICAL: Canary error rate (${canaryState.metrics.canary.errorRatePct}%) exceeded threshold (${canaryState.autoRollbackThresholdPct}%). Auto-reverted 100% traffic to Stable V1.`
      });
    }
  } else {
    canaryState.metrics.canary.errorRatePct = (Math.random() * 0.5 + 0.2).toFixed(2);
    canaryState.metrics.stable.errorRatePct = (Math.random() * 0.2 + 0.1).toFixed(2);
  }

  res.json({ success: true, state: canaryState });
});

app.post("/api/canary/promote", (req, res) => {
  canaryState.canaryWeight = 100;
  canaryState.stableVersion = canaryState.canaryVersion;
  canaryState.status = "STABLE";
  canaryState.history.unshift({
    timestamp: new Date().toISOString(),
    action: "PROMOTED_TO_STABLE",
    weight: 100,
    note: `Canary build ${canaryState.canaryVersion} successfully promoted to 100% Stable production.`
  });
  res.json({ success: true, state: canaryState });
});

const PORT = process.env.PORT || 5004;
app.listen(PORT, () => {
  console.log(`Canary Deployment Controller running on port ${PORT}`);
});
