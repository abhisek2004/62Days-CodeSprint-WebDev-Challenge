import React, { useState, useEffect } from "react";

function App() {
  const [data, setData] = useState({ topic: "", partitions: {}, consumers: [] });
  const [msgKey, setMsgKey] = useState("user_105");
  const [msgVal, setMsgVal] = useState("Order Placed #105");

  const fetchStatus = async () => {
    try {
      const res = await fetch("http://localhost:5018/api/kafka/status");
      const result = await res.json();
      if (result.success) setData(result);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handlePublish = async () => {
    try {
      await fetch("http://localhost:5018/api/kafka/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: msgKey, value: msgVal }),
      });
      fetchStatus();
    } catch (err) {
      console.error(err);
    }
  };

  const partitions = data.partitions || {};

  return (
    <div className="kafka-container">
      <header>
        <div>
          <h1>🐘 Kafka-Lite Event Streaming Broker Dashboard</h1>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Topic: <strong style={{ color: "#38bdf8" }}>{data.topic}</strong> • Key Hash Partitioning & Offset Replay
          </p>
        </div>
      </header>

      {/* Message Publisher */}
      <div className="card" style={{ marginBottom: "2rem" }}>
        <h3 style={{ color: "#38bdf8", marginBottom: "1rem" }}>Produce Stream Event Message</h3>
        <div style={{ display: "flex", gap: "1rem" }}>
          <input
            type="text"
            className="input-field"
            style={{ marginBottom: 0 }}
            placeholder="Partition Key"
            value={msgKey}
            onChange={(e) => setMsgKey(e.target.value)}
          />
          <input
            type="text"
            className="input-field"
            style={{ marginBottom: 0 }}
            placeholder="Message Value"
            value={msgVal}
            onChange={(e) => setMsgVal(e.target.value)}
          />
          <button className="btn" style={{ minWidth: "160px" }} onClick={handlePublish}>
            Publish Message
          </button>
        </div>
      </div>

      {/* Partitions Streams */}
      <h3 style={{ color: "#38bdf8", marginBottom: "1rem" }}>Topic Partitions & Commit Log</h3>
      <div className="grid-3">
        {Object.keys(partitions).map((pKey) => (
          <div key={pKey} className="card">
            <h4 style={{ color: "#38bdf8", marginBottom: "0.75rem" }}>{pKey}</h4>
            <div style={{ background: "#0f172a", padding: "0.8rem", borderRadius: "6px", maxHeight: "200px", overflowY: "auto", fontFamily: "monospace", fontSize: "0.8rem" }}>
              {partitions[pKey].map((m) => (
                <div key={m.offset} style={{ marginBottom: "0.4rem", color: "#38bdf8" }}>
                  [Offset #{m.offset}] {m.key}: {m.value}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
