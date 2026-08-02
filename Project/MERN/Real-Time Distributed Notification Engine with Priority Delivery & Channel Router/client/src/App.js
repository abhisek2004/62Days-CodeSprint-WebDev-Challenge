import React, { useState, useEffect } from "react";

function App() {
  const [data, setData] = useState({ feed: [] });
  const [recipient, setRecipient] = useState("patient_john_doe");
  const [priority, setPriority] = useState("HIGH");
  const [channel, setChannel] = useState("In-App");

  const fetchFeed = async () => {
    try {
      const res = await fetch("http://localhost:5015/api/notifications/feed");
      const result = await res.json();
      if (result.success) setData(result);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchFeed();
  }, []);

  const handleDispatchNotif = async () => {
    try {
      await fetch("http://localhost:5015/api/notifications/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient,
          priority,
          primaryChannel: channel,
          template: "Prescription Ready Notification"
        }),
      });
      fetchFeed();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="notif-container">
      <header>
        <div>
          <h1>🔔 Distributed Notification Engine & Channel Router</h1>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Multi-Channel Delivery Routing & Fallback Policy Engine
          </p>
        </div>
      </header>

      <div className="grid-2">
        {/* Notification Builder */}
        <div className="card">
          <h3 style={{ color: "#38bdf8", marginBottom: "1rem" }}>Dispatch Notification Template</h3>
          <label style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Recipient ID</label>
          <input
            type="text"
            className="input-field"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />

          <label style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Priority Level</label>
          <select className="input-field" value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="NORMAL">NORMAL (In-App Feed)</option>
            <option value="HIGH">HIGH (Push Notification)</option>
            <option value="URGENT">URGENT (Fallback Push ➔ Email)</option>
          </select>

          <label style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Primary Channel</label>
          <select className="input-field" value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="In-App">In-App Socket.io Feed</option>
            <option value="WebPush">WebPush Browser Notification</option>
            <option value="Email">Email Delivery Service</option>
            <option value="Webhook">Webhook Relay Gateway</option>
          </select>

          <button className="btn" style={{ width: "100%" }} onClick={handleDispatchNotif}>
            🚀 Dispatch Notification
          </button>
        </div>

        {/* Live Delivery Feed */}
        <div className="card">
          <h3 style={{ color: "#38bdf8", marginBottom: "1rem" }}>Live Priority Delivery Feed</h3>
          {data.feed.map((item) => (
            <div key={item.id} style={{ padding: "0.8rem", background: "#0f172a", borderRadius: "6px", marginBottom: "0.75rem", border: "1px solid #334155" }}>
              <div style={{ fontWeight: "bold", color: item.priority === "URGENT" ? "#ef4444" : "#38bdf8" }}>
                [{item.priority}] {item.template}
              </div>
              <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                Recipient: {item.recipient} • Route: {item.channel}
              </div>
              <div style={{ color: "#22c55e", fontSize: "0.8rem", fontWeight: "bold", marginTop: "0.25rem" }}>
                Status: {item.status}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
