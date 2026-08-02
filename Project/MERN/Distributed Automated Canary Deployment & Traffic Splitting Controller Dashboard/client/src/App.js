import React, { useState, useEffect } from "react";

function App() {
  const [canaryState, setCanaryState] = useState(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch("http://localhost:5004/api/canary/status");
      const data = await res.json();
      if (data.success) setCanaryState(data.state);
    } catch (err) {
      console.error("Error fetching canary state:", err);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleWeightChange = async (weight) => {
    try {
      const res = await fetch("http://localhost:5004/api/canary/set-weight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weight }),
      });
      const data = await res.json();
      if (data.success) setCanaryState(data.state);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSimulateTraffic = async (injectError) => {
    try {
      const res = await fetch("http://localhost:5004/api/canary/simulate-traffic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ injectError }),
      });
      const data = await res.json();
      if (data.success) setCanaryState(data.state);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePromote = async () => {
    try {
      const res = await fetch("http://localhost:5004/api/canary/promote", { method: "POST" });
      const data = await res.json();
      if (data.success) setCanaryState(data.state);
    } catch (err) {
      console.error(err);
    }
  };

  if (!canaryState) return <div style={{ color: "#fff", padding: "2rem" }}>Loading Canary Controller...</div>;

  const stablePct = 100 - canaryState.canaryWeight;
  const canaryPct = canaryState.canaryWeight;

  return (
    <div className="canary-container">
      <header>
        <div>
          <h1>🐤 Automated Canary Deployment & Traffic Splitter</h1>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Progressive Rollout Controller & Auto-Rollback Engine
          </p>
        </div>
        <div>
          <span style={{ padding: "0.4rem 0.8rem", borderRadius: "6px", fontSize: "0.8rem", fontWeight: "bold", background: canaryState.status === "ROLLED_BACK" ? "#ef4444" : "#22c55e", color: "#fff" }}>
            Status: {canaryState.status}
          </span>
        </div>
      </header>

      {/* Traffic Splitting Slider Control */}
      <div className="card" style={{ marginBottom: "2rem" }}>
        <h3 style={{ color: "#38bdf8", marginBottom: "0.5rem" }}>🚦 Dynamic Traffic Split Ratio</h3>
        <div style={{ display: "flex", justifyContent: "space-between", fontWeight: "bold", fontSize: "1.1rem" }}>
          <span style={{ color: "#38bdf8" }}>Stable ({canaryState.stableVersion}): {stablePct}%</span>
          <span style={{ color: "#f59e0b" }}>Canary ({canaryState.canaryVersion}): {canaryPct}%</span>
        </div>

        <div className="slider-container">
          <input
            type="range"
            min="0"
            max="100"
            step="5"
            value={canaryPct}
            onChange={(e) => handleWeightChange(e.target.value)}
            className="traffic-slider"
          />
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button className="btn" onClick={() => handleWeightChange(10)}>10% Stage</button>
          <button className="btn" onClick={() => handleWeightChange(25)}>25% Stage</button>
          <button className="btn" onClick={() => handleWeightChange(50)}>50% Stage</button>
          <button className="btn btn-success" onClick={handlePromote}>Promote 100% Canary</button>
        </div>
      </div>

      {/* Version Telemetry comparison */}
      <div className="grid-2">
        <div className="card">
          <h4 style={{ color: "#38bdf8", marginBottom: "0.75rem" }}>Stable Target ({canaryState.stableVersion})</h4>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "0.25rem" }}>{canaryState.metrics.stable.requestCount} <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>reqs</span></div>
          <div style={{ color: "#22c55e", fontSize: "0.9rem" }}>Error Rate: {canaryState.metrics.stable.errorRatePct}%</div>
          <div style={{ color: "#94a3b8", fontSize: "0.9rem" }}>Avg Latency: {canaryState.metrics.stable.avgLatencyMs} ms</div>
        </div>

        <div className="card">
          <h4 style={{ color: "#f59e0b", marginBottom: "0.75rem" }}>Canary Target ({canaryState.canaryVersion})</h4>
          <div style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "0.25rem" }}>{canaryState.metrics.canary.requestCount} <span style={{ fontSize: "0.85rem", color: "#94a3b8" }}>reqs</span></div>
          <div style={{ color: canaryState.metrics.canary.errorRatePct > canaryState.autoRollbackThresholdPct ? "#ef4444" : "#22c55e", fontSize: "0.9rem", fontWeight: "bold" }}>
            Error Rate: {canaryState.metrics.canary.errorRatePct}%
          </div>
          <div style={{ color: "#94a3b8", fontSize: "0.9rem" }}>Avg Latency: {canaryState.metrics.canary.avgLatencyMs} ms</div>

          <div style={{ marginTop: "1rem" }}>
            <button className="btn btn-danger" style={{ width: "100%" }} onClick={() => handleSimulateTraffic(true)}>
              💥 Inject Canary Fault (Trigger Auto-Rollback)
            </button>
          </div>
        </div>
      </div>

      {/* Deployment Audit Log */}
      <div className="card">
        <h3 style={{ color: "#38bdf8", marginBottom: "0.75rem" }}>📜 Deployment Audit History Log</h3>
        <div className="audit-log">
          {canaryState.history.map((h, idx) => (
            <div key={idx} className="log-item">
              <span style={{ color: "#94a3b8" }}>[{new Date(h.timestamp).toLocaleTimeString()}]</span>{" "}
              <strong style={{ color: h.action.includes("ROLLBACK") ? "#ef4444" : "#38bdf8" }}>{h.action}</strong>: {h.note}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
