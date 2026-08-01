import React, { useState, useEffect } from "react";

function App() {
  const [data, setData] = useState({ lock: null, queue: [], logs: [] });
  const [workerId, setWorkerId] = useState("Worker-Node-A");

  const fetchLockStatus = async () => {
    try {
      const res = await fetch("http://localhost:5011/api/lock/status");
      const result = await res.json();
      if (result.success) setData(result);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchLockStatus();
    const interval = setInterval(fetchLockStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleAcquire = async (wId) => {
    try {
      await fetch("http://localhost:5011/api/lock/acquire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: "resource-db-row-42", workerId: wId || workerId, ttlSec: 15 }),
      });
      fetchLockStatus();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRenew = async () => {
    if (!data.lock) return;
    try {
      await fetch("http://localhost:5011/api/lock/renew", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId: data.lock.owner, fencingToken: data.lock.fencingToken, extendSec: 10 }),
      });
      fetchLockStatus();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRelease = async () => {
    if (!data.lock) return;
    try {
      await fetch("http://localhost:5011/api/lock/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workerId: data.lock.owner, fencingToken: data.lock.fencingToken }),
      });
      fetchLockStatus();
    } catch (err) {
      console.error(err);
    }
  };

  const lock = data.lock;
  const ttlRemaining = lock ? Math.max(0, Math.ceil((lock.expiresAt - Date.now()) / 1000)) : 0;

  return (
    <div className="lock-container">
      <header>
        <div>
          <h1>🔒 Distributed Shared Memory Lock Manager</h1>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Monotonic Fencing Tokens & TTL Lease Heartbeat Renewal Engine
          </p>
        </div>
      </header>

      {/* Active Lock Status */}
      <div className="card" style={{ marginBottom: "2rem" }}>
        <h3 style={{ color: "#38bdf8", marginBottom: "0.5rem" }}>Shared Resource: resource-db-row-42</h3>
        {lock ? (
          <div style={{ padding: "1rem", background: "#0f172a", borderRadius: "8px", border: "1px solid #0284c7" }}>
            <div style={{ color: "#22c55e", fontWeight: "bold", fontSize: "1.2rem", marginBottom: "0.25rem" }}>
              🔒 LOCKED by {lock.owner}
            </div>
            <div style={{ fontSize: "0.9rem", color: "#94a3b8" }}>
              Monotonic Fencing Token: <strong style={{ color: "#f59e0b" }}>#{lock.fencingToken}</strong>
            </div>
            <div style={{ fontSize: "0.9rem", color: "#94a3b8", marginTop: "0.25rem" }}>
              Lease TTL Remaining: <strong style={{ color: ttlRemaining < 5 ? "#ef4444" : "#38bdf8" }}>{ttlRemaining} seconds</strong>
            </div>

            <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
              <button className="btn" onClick={handleRenew}>⚡ Extend Lease (+10s)</button>
              <button className="btn btn-danger" onClick={handleRelease}>🔓 Release Lock</button>
            </div>
          </div>
        ) : (
          <div style={{ padding: "1rem", background: "#0f172a", borderRadius: "8px", color: "#94a3b8" }}>
            🔓 UNLOCKED (Resource Available)
          </div>
        )}
      </div>

      {/* Contention Simulator */}
      <h3 style={{ color: "#38bdf8", marginBottom: "1rem" }}>Worker Lock Contention Simulator</h3>
      <div className="grid-3">
        {["Worker-Node-A", "Worker-Node-B", "Worker-Node-C"].map((w) => (
          <div key={w} className="card" style={{ textAlign: "center" }}>
            <h4 style={{ color: "#38bdf8", marginBottom: "0.75rem" }}>{w}</h4>
            <button className="btn" style={{ width: "100%" }} onClick={() => handleAcquire(w)}>
              Acquire Lock
            </button>
          </div>
        ))}
      </div>

      {/* Audit Trail */}
      <div className="card">
        <h3 style={{ color: "#38bdf8", marginBottom: "0.75rem" }}>📜 Distributed Lock Audit Trail</h3>
        <div className="log-box">
          {data.logs.map((l, idx) => (
            <div key={idx} style={{ marginBottom: "0.4rem" }}>
              <span style={{ color: "#94a3b8" }}>[{new Date(l.timestamp).toLocaleTimeString()}]</span>{" "}
              <strong style={{ color: "#38bdf8" }}>{l.action}</strong>: {l.details}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
