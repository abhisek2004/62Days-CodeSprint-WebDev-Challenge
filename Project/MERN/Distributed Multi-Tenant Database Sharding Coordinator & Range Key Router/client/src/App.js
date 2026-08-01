import React, { useState, useEffect } from "react";

function App() {
  const [data, setData] = useState({ strategy: "range", totalRecords: 0, shards: [], hotspotDetected: false });
  const [queryType, setQueryType] = useState("single_shard");
  const [targetId, setTargetId] = useState("450");
  const [queryResult, setQueryResult] = useState(null);

  const fetchShards = async () => {
    try {
      const res = await fetch("http://localhost:5002/api/shards");
      const result = await res.json();
      if (result.success) setData(result);
    } catch (err) {
      console.error("Error fetching shard status:", err);
    }
  };

  useEffect(() => {
    fetchShards();
  }, []);

  const handleStrategyChange = async (strategy) => {
    try {
      await fetch("http://localhost:5002/api/shards/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy }),
      });
      fetchShards();
    } catch (err) {
      console.error(err);
    }
  };

  const handleQueryExecute = async () => {
    try {
      const res = await fetch("http://localhost:5002/api/shards/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queryType, targetId }),
      });
      const result = await res.json();
      if (result.success) setQueryResult(result);
    } catch (err) {
      console.error(err);
    }
  };

  const handleHotspotSimulate = async () => {
    try {
      await fetch("http://localhost:5002/api/shards/simulate-hotspot", { method: "POST" });
      fetchShards();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="dashboard-container">
      <header>
        <div>
          <h1>🔀 Multi-Tenant Database Sharding Coordinator</h1>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Range Key Router & Hash Partitioning Engine
          </p>
        </div>
        <div>
          <button
            className={`btn ${data.strategy === "range" ? "" : "btn-secondary"}`}
            style={{ marginRight: "0.5rem" }}
            onClick={() => handleStrategyChange("range")}
          >
            Range Sharding
          </button>
          <button
            className={`btn ${data.strategy === "hash" ? "" : "btn-secondary"}`}
            onClick={() => handleStrategyChange("hash")}
          >
            Hash Sharding
          </button>
        </div>
      </header>

      {data.hotspotDetected && (
        <div className="alert-banner">
          <div>
            ⚠️ <strong>Hotspot Warning:</strong> Imbalanced workload detected on {data.hotspotShard}!
          </div>
          <button className="btn btn-secondary" onClick={() => handleStrategyChange(data.strategy)}>
            Re-balance Shards
          </button>
        </div>
      )}

      {/* Live Shards Map */}
      <div className="grid-3">
        {data.shards.map((s) => (
          <div className="card" key={s.name}>
            <div className="shard-header">
              <span className="shard-title">{s.name}</span>
              <span className="shard-badge">Range: {s.range[0]} - {s.range[1]}</span>
            </div>
            <div style={{ fontSize: "1.5rem", fontWeight: "bold", marginBottom: "0.5rem" }}>
              {s.count} <span style={{ fontSize: "0.85rem", color: "#94a3b8", fontWeight: "normal" }}>records</span>
            </div>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${s.percentage}%` }}></div>
            </div>
            <div style={{ fontSize: "0.8rem", color: "#94a3b8", textAlign: "right" }}>
              {s.percentage}% Total Share
            </div>
          </div>
        ))}
      </div>

      {/* Query Execution Engine Box */}
      <div className="card" style={{ marginBottom: "2rem" }}>
        <h3 style={{ color: "#38bdf8", marginBottom: "1rem" }}>⚡ Scatter-Gather vs Single-Shard Query Router</h3>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <select
            className="input-field"
            style={{ width: "220px" }}
            value={queryType}
            onChange={(e) => setQueryType(e.target.value)}
          >
            <option value="single_shard">Targeted Single Shard</option>
            <option value="scatter_gather">Scatter-Gather (All Shards)</option>
          </select>

          {queryType === "single_shard" && (
            <input
              type="number"
              className="input-field"
              placeholder="Record ID"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
            />
          )}

          <button className="btn" onClick={handleQueryExecute}>
            Execute Query
          </button>
          <button className="btn btn-danger" onClick={handleHotspotSimulate}>
            Simulate Hotspot Traffic
          </button>
        </div>

        {queryResult && (
          <div style={{ marginTop: "1.25rem", padding: "1rem", backgroundColor: "#0b0f19", borderRadius: "6px", fontSize: "0.9rem" }}>
            <div style={{ color: "#22c55e", marginBottom: "0.5rem" }}>
              ✅ Query Complete in {queryResult.latencyMs} ms
            </div>
            <div>Shards Queried: {queryResult.shardsQueried.join(", ")}</div>
            <div>Records Returned: {queryResult.resultsCount}</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
