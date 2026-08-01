import React, { useState, useEffect } from "react";

function App() {
  const [data, setData] = useState({ participants: [], topologyStats: {} });

  const fetchData = async () => {
    try {
      const res = await fetch("http://localhost:5003/api/sfu/participants");
      const result = await res.json();
      if (result.success) setData(result);
    } catch (err) {
      console.error("Error fetching SFU stats:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleQualityChange = async (participantId, quality) => {
    try {
      await fetch("http://localhost:5003/api/sfu/quality", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId, quality }),
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const handleActiveSpeaker = async (participantId) => {
    try {
      await fetch("http://localhost:5003/api/sfu/active-speaker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId }),
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  const stats = data.topologyStats || {};

  return (
    <div className="sfu-container">
      <header>
        <div>
          <h1>📹 WebRTC Selective Forwarding Unit (SFU) Simulator</h1>
          <p style={{ fontSize: "0.85rem", color: "#8b949e", marginTop: "0.25rem" }}>
            Multi-Party Video Topology & Simulcast Quality Layer Controller
          </p>
        </div>
      </header>

      {/* Network Bandwidth Savings Banner */}
      <div className="stats-banner">
        <div className="stat-item">
          <div className="stat-val">{stats.participantCount || 0}</div>
          <div className="stat-lbl">Active Participants</div>
        </div>
        <div className="stat-item">
          <div className="stat-val" style={{ color: "#f85149" }}>{stats.meshBandwidthMbps || 0} Mbps</div>
          <div className="stat-lbl">Mesh Mesh Bandwidth Required</div>
        </div>
        <div className="stat-item">
          <div className="stat-val" style={{ color: "#2ea043" }}>{stats.sfuBandwidthMbps || 0} Mbps</div>
          <div className="stat-lbl">SFU Server Bandwidth Used</div>
        </div>
        <div className="stat-item">
          <div className="stat-val" style={{ color: "#e3b341" }}>{stats.bandwidthSavedPercentage || 0}%</div>
          <div className="stat-lbl">Uplink Bandwidth Savings</div>
        </div>
      </div>

      {/* Video Call Grid */}
      <div className="video-grid">
        {data.participants.map((p) => (
          <div key={p.id} className={`video-card ${p.activeSpeaker ? "active-speaker" : ""}`}>
            <div className="avatar">{p.name.charAt(0)}</div>

            {p.activeSpeaker && (
              <span style={{ position: "absolute", top: 10, left: 10, background: "#238636", color: "#fff", padding: "0.2rem 0.5rem", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "bold" }}>
                🎙️ Speaking
              </span>
            )}

            <div className="participant-overlay">
              <div>
                <div style={{ fontWeight: "600", fontSize: "0.9rem" }}>{p.name}</div>
                <div style={{ fontSize: "0.75rem", color: "#8b949e" }}>{p.role} • {p.bitrateKbps} Kbps</div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <select
                  className="select-box"
                  value={p.quality}
                  onChange={(e) => handleQualityChange(p.id, e.target.value)}
                >
                  <option value="720p">720p (High)</option>
                  <option value="360p">360p (Med)</option>
                  <option value="180p">180p (Low)</option>
                </select>
                <button className="btn" onClick={() => handleActiveSpeaker(p.id)}>
                  Speak
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
