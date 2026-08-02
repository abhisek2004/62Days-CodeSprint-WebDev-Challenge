const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Migration State
let migrationPipeline = {
  currentStage: "IDLE", // IDLE, EXPAND_SCHEMA, DUAL_WRITE, BACKFILL_DATA, CONTRACT_SCHEMA, COMPLETED
  schemaVersion: "v1.2",
  targetVersion: "v2.0",
  backfillProgressPct: 0,
  trafficErrorsCount: 0,
  totalTrafficServed: 14500,
  upScript: "ALTER TABLE users ADD COLUMN full_name VARCHAR(255);",
  downScript: "ALTER TABLE users DROP COLUMN full_name;"
};

app.get("/api/migration/status", (req, res) => {
  res.json({ success: true, pipeline: migrationPipeline });
});

app.post("/api/migration/next-stage", (req, res) => {
  const stages = ["IDLE", "EXPAND_SCHEMA", "DUAL_WRITE", "BACKFILL_DATA", "CONTRACT_SCHEMA", "COMPLETED"];
  const currentIdx = stages.indexOf(migrationPipeline.currentStage);

  if (currentIdx < stages.length - 1) {
    migrationPipeline.currentStage = stages[currentIdx + 1];
    if (migrationPipeline.currentStage === "BACKFILL_DATA") {
      migrationPipeline.backfillProgressPct = 50;
    } else if (migrationPipeline.currentStage === "COMPLETED") {
      migrationPipeline.backfillProgressPct = 100;
      migrationPipeline.schemaVersion = migrationPipeline.targetVersion;
    }
  }

  res.json({ success: true, pipeline: migrationPipeline });
});

app.post("/api/migration/rollback", (req, res) => {
  migrationPipeline.currentStage = "IDLE";
  migrationPipeline.backfillProgressPct = 0;
  migrationPipeline.trafficErrorsCount = 0;
  res.json({ success: true, message: "Migration rolled back successfully.", pipeline: migrationPipeline });
});

const PORT = process.env.PORT || 5010;
app.listen(PORT, () => {
  console.log(`Zero-Downtime Migration Execution Engine running on port ${PORT}`);
});
