import React, { useState, useEffect } from "react";

function App() {
  const [data, setData] = useState({ jobs: [], manifest: {} });
  const [newFilename, setNewFilename] = useState("clinical_demo_recording.mp4");

  const fetchJobs = async () => {
    try {
      const res = await fetch("http://localhost:5009/api/hls/jobs");
      const result = await res.json();
      if (result.success) setData(result);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleStartTranscode = async () => {
    try {
      const res = await fetch("http://localhost:5009/api/hls/start-job", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: newFilename }),
      });
      const result = await res.json();
      if (result.success) fetchJobs();
    } catch (err) {
      console.error(err);
    }
  };

  const manifest = data.manifest || {};

  return (
    <div className="hls-container">
      <header>
        <div>
          <h1>🎬 HLS Video Transcoding Pipeline Monitor</h1>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Adaptive Bitrate (.m3u8) & TS Segment Packaging Engine
          </p>
        </div>
      </header>

      {/* Transcoding Queue */}
      <div className="card" style={{ marginBottom: "2rem" }}>
        <h3 style={{ color: "#38bdf8", marginBottom: "1rem" }}>Launch Transcoding Pipeline Job</h3>
        <div style={{ display: "flex", gap: "1rem" }}>
          <input
            type="text"
            className="btn"
            style={{ background: "#0f172a", border: "1px solid #334155", color: "#fff", flex: 1 }}
            value={newFilename}
            onChange={(e) => setNewFilename(e.target.value)}
          />
          <button className="btn" onClick={handleStartTranscode}>
            Start FFmpeg HLS Transcode
          </button>
        </div>
      </div>

      <div className="grid-2">
        {/* Jobs Queue */}
        <div className="card">
          <h3 style={{ color: "#38bdf8", marginBottom: "1rem" }}>Active Transcoding Jobs</h3>
          {data.jobs.map((j) => (
            <div key={j.jobId} style={{ padding: "0.8rem", background: "#0f172a", borderRadius: "6px", marginBottom: "0.75rem", border: "1px solid #334155" }}>
              <div style={{ fontWeight: "bold" }}>{j.filename}</div>
              <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                Job ID: {j.jobId} • Duration: {j.durationSec}s
              </div>
              <div style={{ color: j.status === "COMPLETED" ? "#22c55e" : "#f59e0b", fontSize: "0.85rem", marginTop: "0.25rem", fontWeight: "bold" }}>
                Status: {j.status} ({j.progressPct}%)
              </div>
            </div>
          ))}
        </div>

        {/* Dynamic HLS Master Manifest Inspector */}
        <div className="card">
          <h3 style={{ color: "#38bdf8", marginBottom: "1rem" }}>Generated master.m3u8 Playlist</h3>
          <div className="manifest-box">{manifest.masterPlaylist}</div>
        </div>
      </div>
    </div>
  );
}

export default App;
