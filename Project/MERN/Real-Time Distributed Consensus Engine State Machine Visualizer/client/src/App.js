import React, { useState, useEffect } from "react";

function App() {
  const [data, setData] = useState({ term: 0, cluster: [], logs: [] });
  const [command, setCommand] = useState("SET key = 500");

  const fetchCluster = async () => {
    try {
      const res = await fetch("http://localhost:5023/api/raft/cluster");
      const result = await res.json();
      if (result.success) setData(result);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCluster();
  }, []);

  const handleTriggerElection = async () => {
    try {
      await fetch("http://localhost:5023/api/raft/trigger-election", { method: "POST" });
      fetchCluster();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReplicateLog = async () => {
    try {
      await fetch("http://localhost:5023/api/raft/replicate-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
      fetchCluster();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="raft-container">
      <header>
        <div>
          <h1>🗳️ Raft Distributed Consensus State Machine</h1>
          <p style={{ color: "#8b949e", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Current Term: <strong style={{ color: "#58a6ff" }}>Term {data.term}</strong> • Leader Election & Log Replication
          </p>
        </div>
        <button className="btn" onClick={handleTriggerElection}>
          ⚡ Trigger Leader Election Timeout
        </button>
      </header>

      {/* Cluster Nodes */}
      <h3 style={{ color: "#58a6ff", marginBottom: "1rem" }}>Raft Cluster Node States</h3>
      <div className="grid-3">
        {data.cluster.map((n) => (
          <div key={n.id} className="card" style={{ border: n.role === "LEADER" ? "2px solid #238636" : "1px solid #30363d" }}>
            <h4 style={{ color: n.role === "LEADER" ? "#2ea043" : "#58a6ff", marginBottom: "0.5rem" }}>{n.id}</h4>
            <div style={{ fontSize: "0.9rem", fontWeight: "bold" }}>Role: {n.role}</div>
            <div style={{ fontSize: "0.8rem", color: "#8b949e" }}>
              Term: {n.term} • Committed LSN: #{n.committedIndex}
            </div>
          </div>
        ))}
      </div>

      {/* Log Replication */}
      <div className="card">
        <h3 style={{ color: "#58a6ff", marginBottom: "1rem" }}>Leader Log Replication Timeline</h3>
        <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
          <input
            type="text"
            className="btn"
            style={{ background: "#0d1117", border: "1px solid #30363d", color: "#fff", flex: 1 }}
            value={command}
            onChange={(e) => setCommand(e.target.value)}
          />
          <button className="btn" onClick={handleReplicateLog}>
            Publish Command to Leader
          </button>
        </div>

        <div style={{ background: "#0d1117", padding: "1rem", borderRadius: "6px", fontFamily: "monospace", fontSize: "0.85rem" }}>
          {data.logs.map((l) => (
            <div key={l.index} style={{ marginBottom: "0.4rem", color: "#58a6ff" }}>
              [Log Index #{l.index} | Term {l.term}] {l.command} ➔ <span style={{ color: "#238636" }}>{l.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
