import React, { useState, useEffect } from "react";

function App() {
  const [data, setData] = useState({ features: [], onlineServingLatencyMs: 1.8 });

  const fetchFeatures = async () => {
    try {
      const res = await fetch("http://localhost:5014/api/feature-store/features");
      const result = await res.json();
      if (result.success) setData(result);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchFeatures();
  }, []);

  const handleRunDriftCheck = async () => {
    try {
      const res = await fetch("http://localhost:5014/api/feature-store/trigger-drift-check", { method: "POST" });
      const result = await res.json();
      if (result.success) setData(prev => ({ ...prev, features: result.features }));
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="ml-container">
      <header>
        <div>
          <h1>📊 Distributed ML Feature Store & Drift Telemetry</h1>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Online/Offline Feature Serving & Kolmogorov-Smirnov / PSI Drift Detector
          </p>
        </div>
        <button className="btn" onClick={handleRunDriftCheck}>
          🧪 Trigger PSI Feature Drift Scan
        </button>
      </header>

      {/* Serving Latency Banner */}
      <div className="card" style={{ marginBottom: "2rem" }}>
        <h3 style={{ color: "#38bdf8", marginBottom: "0.5rem" }}>ML Infrastructure Serving Health</h3>
        <div style={{ display: "flex", gap: "2rem", fontSize: "0.9rem", color: "#94a3b8" }}>
          <div>Online Low-Latency Serving: <strong style={{ color: "#22c55e" }}>{data.onlineServingLatencyMs} ms</strong></div>
          <div>Offline Batch Processing Engine: <strong style={{ color: "#38bdf8" }}>1.45M rows/sec</strong></div>
        </div>
      </div>

      {/* Feature Catalog Table */}
      <div className="card">
        <h3 style={{ color: "#38bdf8", marginBottom: "1rem" }}>Centralized Feature Catalog & PSI Scores</h3>
        {data.features.map((f) => (
          <div key={f.featureId} style={{ padding: "0.8rem", background: "#0f172a", borderRadius: "6px", marginBottom: "0.75rem", border: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong style={{ color: "#38bdf8" }}>{f.name}</strong> ({f.version})
              <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>ID: {f.featureId} • Type: {f.dtype}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "0.9rem", fontWeight: "bold", color: f.driftDetected ? "#ef4444" : "#22c55e" }}>
                PSI Score: {f.psiDriftScore}
              </div>
              <div style={{ fontSize: "0.75rem", color: f.driftDetected ? "#ef4444" : "#94a3b8" }}>
                {f.driftDetected ? "⚠️ DRIFT DETECTED (>0.25)" : "✅ Population Stable"}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
