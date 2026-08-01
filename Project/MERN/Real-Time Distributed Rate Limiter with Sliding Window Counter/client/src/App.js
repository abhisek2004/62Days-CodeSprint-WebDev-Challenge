import React, { useState, useEffect } from "react";

function App() {
  const [clientId, setClientId] = useState("client-ip-192.168.1.10");
  const [tier, setTier] = useState("free");
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState([]);

  const fetchStats = async () => {
    try {
      const res = await fetch("http://localhost:5005/api/gateway/stats");
      const data = await res.json();
      if (data.success) setStats(data.stats);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const sendRequest = async () => {
    try {
      const res = await fetch("http://localhost:5005/api/gateway/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, tier }),
      });
      const data = await res.json();
      
      const newLog = {
        time: new Date().toLocaleTimeString(),
        status: data.status,
        message: data.success ? `200 OK (${data.remaining} reqs remaining)` : `429 Rate Exceeded (Retry after ${data.retryAfterSec}s)`,
        isError: !data.success
      };

      setLogs((prev) => [newLog, ...prev]);
      fetchStats();
    } catch (err) {
      console.error(err);
    }
  };

  const sendBurstTraffic = async () => {
    for (let i = 0; i < 12; i++) {
      await sendRequest();
    }
  };

  const handleReset = async () => {
    try {
      await fetch("http://localhost:5005/api/gateway/reset", { method: "POST" });
      setLogs([]);
      fetchStats();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="limiter-container">
      <header>
        <div>
          <h1>⏱️ Distributed Rate Limiter with Sliding Window</h1>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Redis Cluster Synchronized API Rate Limiting Gateway
          </p>
        </div>
        <button className="btn btn-danger" onClick={handleReset}>Reset Cluster Buckets</button>
      </header>

      <div className="grid-2">
        <div className="card">
          <h3 style={{ color: "#38bdf8", marginBottom: "1rem" }}>Client Quota Tester</h3>
          <label style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Client Identifier (IP / API Key)</label>
          <input
            type="text"
            className="input-field"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
          />

          <label style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Tier Level</label>
          <select className="input-field" value={tier} onChange={(e) => setTier(e.target.value)}>
            <option value="free">Free Tier (10 req / 60s)</option>
            <option value="enterprise">Enterprise Tier (100 req / 60s)</option>
          </select>

          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="btn" style={{ flex: 1 }} onClick={sendRequest}>
              Send Single Request
            </button>
            <button className="btn btn-danger" style={{ flex: 1 }} onClick={sendBurstTraffic}>
              🚀 Launch 12x Burst Traffic
            </button>
          </div>
        </div>

        <div className="card">
          <h3 style={{ color: "#38bdf8", marginBottom: "1rem" }}>Live Redis Gateway Logs</h3>
          <div className="log-box">
            {logs.length === 0 ? (
              <div style={{ color: "#64748b" }}>No requests sent yet...</div>
            ) : (
              logs.map((l, idx) => (
                <div key={idx} style={{ color: l.isError ? "#ef4444" : "#22c55e", marginBottom: "0.3rem" }}>
                  [{l.time}] {l.message}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
