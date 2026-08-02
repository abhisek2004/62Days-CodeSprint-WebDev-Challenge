import React, { useState, useEffect } from "react";

function App() {
  const [data, setData] = useState({ series: [], anomaliesCount: 0, latestPoint: null, alertActive: false });

  const fetchMetrics = async () => {
    try {
      const res = await fetch("http://localhost:5007/api/metrics/series");
      const result = await res.json();
      if (result.success) setData(result);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3000);
    return () => clearInterval(interval);
  }, []);

  const injectNormalMetric = async () => {
    try {
      await fetch("http://localhost:5007/api/metrics/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cpuUsagePct: Math.floor(Math.random() * 20 + 35),
          memoryUsageMb: 1024,
          apiRequestsPerSec: 140
        }),
      });
      fetchMetrics();
    } catch (err) {
      console.error(err);
    }
  };

  const injectAnomalySpike = async () => {
    try {
      await fetch("http://localhost:5007/api/metrics/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cpuUsagePct: 98, // Spike anomaly
          memoryUsageMb: 4096,
          apiRequestsPerSec: 1200
        }),
      });
      fetchMetrics();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="metrics-container">
      <header>
        <div>
          <h1>📈 Real-Time Metric Aggregator & Anomaly Detector</h1>
          <p style={{ color: "#8b949e", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Z-Score Statistical Telemetry Anomaly Detection Engine
          </p>
        </div>
        <div>
          <span style={{ padding: "0.4rem 0.8rem", borderRadius: "6px", fontSize: "0.8rem", fontWeight: "bold", background: data.alertActive ? "#da3633" : "#238636", color: "#fff" }}>
            {data.alertActive ? "🚨 CRITICAL ANOMALY ALERT" : "✅ System Metrics Normal"}
          </span>
        </div>
      </header>

      {/* Control Buttons */}
      <div className="card">
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <button className="btn" onClick={injectNormalMetric}>
            ➕ Ingest Normal Telemetry Point
          </button>
          <button className="btn btn-danger" onClick={injectAnomalySpike}>
            💥 Inject CPU Load Anomaly Spike (98% Usage)
          </button>
          <div style={{ marginLeft: "auto", fontSize: "0.9rem", color: "#8b949e" }}>
            Total Anomalies Detected: <strong style={{ color: "#f85149" }}>{data.anomaliesCount}</strong>
          </div>
        </div>
      </div>

      {/* Time-Series Visualization Chart */}
      <div className="card">
        <h3 style={{ color: "#58a6ff", marginBottom: "1rem" }}>CPU Usage Telemetry Time-Series Chart (% Usage)</h3>
        <div className="chart-bar-container">
          {data.series.map((m, idx) => (
            <div
              key={idx}
              className={`bar ${m.isAnomaly ? "anomaly" : ""}`}
              style={{ height: `${Math.min(m.cpuUsagePct, 100)}%` }}
              title={`[${new Date(m.timestamp * 1000).toLocaleTimeString()}] CPU: ${m.cpuUsagePct}% | ${m.isAnomaly ? "ANOMALY DETECTED" : "Normal"}`}
            />
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#8b949e", marginTop: "0.5rem" }}>
          <span>Past 50 Telemetry Intervals</span>
          <span><span style={{ color: "#da3633" }}>■</span> Red = Z-Score Anomaly Triggered</span>
        </div>
      </div>
    </div>
  );
}

export default App;
