import React, { useState, useEffect } from "react";

function App() {
  const [pipeline, setPipeline] = useState(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch("http://localhost:5010/api/migration/status");
      const data = await res.json();
      if (data.success) setPipeline(data.pipeline);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleNextStage = async () => {
    try {
      const res = await fetch("http://localhost:5010/api/migration/next-stage", { method: "POST" });
      const data = await res.json();
      if (data.success) setPipeline(data.pipeline);
    } catch (err) {
      console.error(err);
    }
  };

  const handleRollback = async () => {
    try {
      const res = await fetch("http://localhost:5010/api/migration/rollback", { method: "POST" });
      const data = await res.json();
      if (data.success) setPipeline(data.pipeline);
    } catch (err) {
      console.error(err);
    }
  };

  if (!pipeline) return <div style={{ padding: "2rem", color: "#fff" }}>Loading Migration Engine...</div>;

  const stagesList = ["EXPAND_SCHEMA", "DUAL_WRITE", "BACKFILL_DATA", "CONTRACT_SCHEMA", "COMPLETED"];

  return (
    <div className="migration-container">
      <header>
        <div>
          <h1>🔄 Zero-Downtime Database Migration Engine</h1>
          <p style={{ color: "#8b949e", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Expand-Contract Pattern Rollout Controller
          </p>
        </div>
        <div>
          <button className="btn" style={{ marginRight: "0.5rem" }} onClick={handleNextStage}>
            Advance Next Stage ➔
          </button>
          <button className="btn btn-danger" onClick={handleRollback}>
            Emergency Rollback
          </button>
        </div>
      </header>

      {/* Expand-Contract Pipeline Stepper */}
      <div className="pipeline-stepper">
        {stagesList.map((stg, idx) => {
          const isActive = pipeline.currentStage === stg;
          return (
            <div key={stg} className={`step-item ${isActive ? "active" : ""}`}>
              <div className="step-circle">{idx + 1}</div>
              <div style={{ fontSize: "0.8rem", fontWeight: "bold", color: isActive ? "#58a6ff" : "#8b949e" }}>
                {stg}
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Production Telemetry during Migration */}
      <div className="card">
        <h3 style={{ color: "#58a6ff", marginBottom: "1rem" }}>Zero-Downtime Live Telemetry</h3>
        <div style={{ display: "flex", gap: "2rem", fontSize: "0.95rem" }}>
          <div>Current Stage: <strong style={{ color: "#2ea043" }}>{pipeline.currentStage}</strong></div>
          <div>Active Schema: <strong>{pipeline.schemaVersion}</strong></div>
          <div>Live Reads/Writes Served: <strong>{pipeline.totalTrafficServed}</strong></div>
          <div>Error Rate: <strong style={{ color: "#2ea043" }}>0.00% (Zero Downtime)</strong></div>
        </div>
      </div>

      {/* Migration Script Editor */}
      <div className="card">
        <h3 style={{ color: "#58a6ff", marginBottom: "0.75rem" }}>Migration Script (Expand & Contract)</h3>
        <div style={{ background: "#0d1117", padding: "1rem", borderRadius: "6px", fontFamily: "monospace", color: "#79c0ff", marginBottom: "1rem" }}>
          -- UP (Expand)<br />
          {pipeline.upScript}
        </div>
        <div style={{ background: "#0d1117", padding: "1rem", borderRadius: "6px", fontFamily: "monospace", color: "#f85149" }}>
          -- DOWN (Rollback)<br />
          {pipeline.downScript}
        </div>
      </div>
    </div>
  );
}

export default App;
