import React, { useState, useEffect } from "react";

function App() {
  const [data, setData] = useState({ subscriptions: [], dlq: [], logs: [] });
  const [eventType, setEventType] = useState("payment.succeeded");

  const fetchData = async () => {
    try {
      const res = await fetch("http://localhost:5012/api/webhooks/subscriptions");
      const result = await res.json();
      if (result.success) setData(result);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDispatch = async (simulateFailure) => {
    try {
      await fetch("http://localhost:5012/api/webhooks/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType,
          payload: { orderId: "ord_9901", amount: 149.99, status: "paid" },
          simulateFailure
        }),
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleReplayDlq = async (dlqId) => {
    try {
      await fetch("http://localhost:5012/api/webhooks/dlq/replay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dlqId }),
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="webhook-container">
      <header>
        <div>
          <h1>⚓ Distributed Webhook Relay Gateway & DLQ</h1>
          <p style={{ color: "#8b949e", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            HMAC SHA-256 Signature Inspector & Dead-Letter Queue Replay
          </p>
        </div>
      </header>

      {/* Webhook Simulator Dispatch */}
      <div className="card" style={{ marginBottom: "2rem" }}>
        <h3 style={{ color: "#58a6ff", marginBottom: "1rem" }}>Dispatch Test Webhook Event</h3>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <select
            className="btn"
            style={{ background: "#0d1117", border: "1px solid #30363d", color: "#c9d1d9" }}
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
          >
            <option value="payment.succeeded">payment.succeeded</option>
            <option value="subscription.updated">subscription.updated</option>
            <option value="customer.created">customer.created</option>
          </select>
          <button className="btn" onClick={() => handleDispatch(false)}>
            🚀 Dispatch Successful Webhook (200 OK)
          </button>
          <button className="btn btn-danger" onClick={() => handleDispatch(true)}>
            💥 Simulate Target Endpoint Down (Send to DLQ)
          </button>
        </div>
      </div>

      <div className="grid-2">
        {/* Dead Letter Queue (DLQ) */}
        <div className="card">
          <h3 style={{ color: "#f85149", marginBottom: "1rem" }}>
            ☠️ Dead-Letter Queue (DLQ) ({data.dlq.length})
          </h3>
          {data.dlq.length === 0 ? (
            <div style={{ color: "#8b949e", fontSize: "0.9rem" }}>No failed webhooks in DLQ.</div>
          ) : (
            data.dlq.map((item) => (
              <div key={item.id} style={{ padding: "0.8rem", background: "#0d1117", borderRadius: "6px", marginBottom: "0.75rem", border: "1px solid #da3633" }}>
                <div style={{ fontWeight: "bold", color: "#f85149" }}>{item.eventType}</div>
                <div style={{ fontSize: "0.8rem", color: "#8b949e" }}>
                  Attempts: {item.attemptsCount} • Reason: {item.reason}
                </div>
                <button className="btn" style={{ marginTop: "0.5rem", fontSize: "0.75rem" }} onClick={() => handleReplayDlq(item.id)}>
                  🔄 Manual Replay Webhook
                </button>
              </div>
            ))
          )}
        </div>

        {/* Live Delivery Logs */}
        <div className="card">
          <h3 style={{ color: "#58a6ff", marginBottom: "1rem" }}>📜 Live Delivery Audit Logs</h3>
          <div style={{ background: "#0d1117", padding: "1rem", borderRadius: "6px", maxHeight: "250px", overflowY: "auto", fontFamily: "monospace", fontSize: "0.8rem" }}>
            {data.logs.map((l, idx) => (
              <div key={idx} style={{ marginBottom: "0.5rem", color: l.status === 200 ? "#238636" : "#da3633" }}>
                [{new Date(l.timestamp).toLocaleTimeString()}] {l.result} <br />
                <span style={{ color: "#8b949e" }}>Sig: {l.signature}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
