import React, { useState, useEffect } from "react";

function App() {
  const [data, setData] = useState({ blob: {}, nodes: [], reconstructionPossible: true });
  const [message, setMessage] = useState("");

  const fetchCluster = async () => {
    try {
      const res = await fetch("http://localhost:5006/api/storage/cluster");
      const result = await res.json();
      if (result.success) setData(result);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCluster();
  }, []);

  const toggleNodeFail = async (nodeId) => {
    try {
      await fetch("http://localhost:5006/api/storage/node/fail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodeId }),
      });
      fetchCluster();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReconstruct = async () => {
    try {
      const res = await fetch("http://localhost:5006/api/storage/reconstruct", { method: "POST" });
      const result = await res.json();
      if (result.success) {
        setMessage(result.message);
        fetchCluster();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const blob = data.blob || {};

  return (
    <div className="storage-container">
      <header>
        <div>
          <h1>💾 Reed-Solomon Erasure Coding Blob Storage Simulator</h1>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            4 Data Chunks + 2 Parity Chunks Storage Node Fault Tolerance
          </p>
        </div>
        <button className="btn" onClick={handleReconstruct} disabled={!data.reconstructionPossible}>
          🛠️ Run Reed-Solomon Reconstruction
        </button>
      </header>

      {/* Blob Info Banner */}
      <div className="card" style={{ marginBottom: "2rem" }}>
        <h3 style={{ color: "#38bdf8", marginBottom: "0.5rem" }}>File Object: {blob.filename}</h3>
        <div style={{ display: "flex", gap: "2rem", fontSize: "0.9rem", color: "#94a3b8" }}>
          <div>Original Size: {(blob.originalSizeBytes / 1024 / 1024).toFixed(1)} MB</div>
          <div>Encoding Scheme: 4 Data (K) + 2 Parity (M)</div>
          <div>Storage Overhead: {data.storageOverheadPct}%</div>
          <div style={{ color: data.reconstructionPossible ? "#22c55e" : "#ef4444", fontWeight: "bold" }}>
            {data.reconstructionPossible ? "✅ Reconstruction Status: HEALTHY / RECOVERABLE" : "❌ File UNRECOVERABLE (>2 Nodes Failed)"}
          </div>
        </div>
      </div>

      {message && (
        <div style={{ backgroundColor: "#064e3b", border: "1px solid #059669", color: "#6ee7b7", padding: "1rem", borderRadius: "8px", marginBottom: "1.5rem" }}>
          {message}
        </div>
      )}

      {/* Storage Node Cluster */}
      <h3 style={{ color: "#38bdf8", marginBottom: "1rem" }}>Storage Disks Node Cluster (Click to Simulate Failure / Corruption)</h3>
      <div className="grid-3">
        {data.nodes.map((n) => (
          <div key={n.id} className={`node-card ${n.status === "FAILED" ? "failed" : ""}`}>
            <div style={{ fontWeight: "bold", fontSize: "1.1rem", marginBottom: "0.25rem", color: n.type === "PARITY" ? "#f59e0b" : "#38bdf8" }}>
              {n.id} ({n.type})
            </div>
            <div style={{ fontSize: "0.8rem", color: "#94a3b8", fontFamily: "monospace", marginBottom: "1rem" }}>
              Chunk: {n.chunk}
            </div>
            <button
              className={`btn ${n.status === "HEALTHY" ? "btn-danger" : ""}`}
              onClick={() => toggleNodeFail(n.id)}
            >
              {n.status === "HEALTHY" ? "Corrupt / Fail Node" : "Repair Node"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
