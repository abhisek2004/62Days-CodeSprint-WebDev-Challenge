import React, { useState, useEffect } from "react";

function App() {
  const [saga, setSaga] = useState({ sagaId: "", status: "", steps: [], log: [] });

  const fetchStatus = async () => {
    try {
      const res = await fetch("http://localhost:5024/api/saga/status");
      const result = await res.json();
      if (result.success) setSaga(result.saga);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleExecuteSaga = async (failAtStep) => {
    try {
      const res = await fetch("http://localhost:5024/api/saga/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ failAtStep }),
      });
      const result = await res.json();
      if (result.success) setSaga(result.saga);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="saga-container">
      <header>
        <div>
          <h1>🔄 Distributed Saga Orchestrator & Compensation Engine</h1>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Saga ID: <strong style={{ color: "#38bdf8" }}>{saga.sagaId}</strong> • Eventual Consistency Rollback Manager
          </p>
        </div>
      </header>

      {/* Control Buttons */}
      <div className="card" style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", gap: "1rem" }}>
          <button className="btn" onClick={() => handleExecuteSaga(null)}>
            🚀 Trigger Successful Multi-Service Saga
          </button>
          <button className="btn btn-danger" onClick={() => handleExecuteSaga("payment")}>
            💥 Inject Payment Failure (Trigger Compensating Rollbacks)
          </button>
        </div>
      </div>

      <div className="grid-2">
        {/* Workflow Steps Stepper */}
        <div className="card">
          <h3 style={{ color: "#38bdf8", marginBottom: "1rem" }}>Saga Orchestration Workflow Steps</h3>
          {saga.steps.map((st, idx) => (
            <div key={idx} style={{ padding: "0.8rem", background: "#0f172a", borderRadius: "6px", marginBottom: "0.75rem", border: "1px solid #334155" }}>
              <div style={{ fontWeight: "bold" }}>Step {idx + 1}: {st.name}</div>
              <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>{st.service}</div>
              <div style={{ fontSize: "0.85rem", fontWeight: "bold", marginTop: "0.25rem", color: st.status === "SUCCESS" ? "#22c55e" : st.status === "COMPENSATED" ? "#f59e0b" : "#ef4444" }}>
                Status: {st.status}
              </div>
            </div>
          ))}
        </div>

        {/* Live Saga Log */}
        <div className="card">
          <h3 style={{ color: "#38bdf8", marginBottom: "1rem" }}>📜 Transaction Log Feed</h3>
          <div style={{ background: "#0f172a", padding: "1rem", borderRadius: "6px", fontFamily: "monospace", fontSize: "0.85rem", maxHeight: "280px", overflowY: "auto" }}>
            {saga.log.map((l, idx) => (
              <div key={idx} style={{ marginBottom: "0.5rem", color: l.includes("COMPENSATING") || l.includes("ERROR") ? "#f59e0b" : "#38bdf8" }}>
                {l}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
