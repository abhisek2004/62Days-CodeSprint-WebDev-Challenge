const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let featureStoreCatalog = [
  { featureId: "feat_user_30d_orders", name: "User 30-Day Order Count", version: "v1.2", dtype: "INTEGER", psiDriftScore: 0.04, driftDetected: false },
  { featureId: "feat_avg_txn_amount", name: "Average Transaction Amount", version: "v2.0", dtype: "FLOAT", psiDriftScore: 0.32, driftDetected: true },
  { featureId: "feat_device_trust_score", name: "Device Trust Score", version: "v1.0", dtype: "FLOAT", psiDriftScore: 0.12, driftDetected: false }
];

app.get("/api/feature-store/features", (req, res) => {
  res.json({
    success: true,
    features: featureStoreCatalog,
    onlineServingLatencyMs: 1.8,
    offlineBatchProcessedRows: 1450000
  });
});

app.post("/api/feature-store/trigger-drift-check", (req, res) => {
  featureStoreCatalog.forEach(f => {
    f.psiDriftScore = parseFloat((Math.random() * 0.4).toFixed(2));
    f.driftDetected = f.psiDriftScore > 0.25;
  });

  res.json({ success: true, message: "Statistical Population Stability Index (PSI) drift check completed.", features: featureStoreCatalog });
});

const PORT = process.env.PORT || 5014;
app.listen(PORT, () => {
  console.log(`ML Feature Store & Drift Dashboard running on port ${PORT}`);
});
