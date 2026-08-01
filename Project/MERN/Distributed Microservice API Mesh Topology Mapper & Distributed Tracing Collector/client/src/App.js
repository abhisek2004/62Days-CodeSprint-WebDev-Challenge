import React, { useState, useEffect } from "react";

function App() {
  const [data, setData] = useState({ services: [], spans: [] });

  const fetchTopology = async () => {
    try {
      const res = await fetch("http://localhost:5021/api/tracing/topology");
      const result = await res.json();
      if (result.success) setData(result);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchTopology();
  }, []);

  const handleSimulateRequest = async () => {
    try {
      await fetch("http://localhost:5021/api/tracing/simulate-request", { method: "POST" });
      fetchTopology();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="tracing-container">
      <header>
        <div>
          <h1>🌐 Microservice API Mesh & Distributed Tracing</h1>
          <p style={{ color: "#8b949e", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            OpenTelemetry Span Collector & Latency Percentiles (P50/P90/P99)
          </p>
        </div>
        <button className="btn" onClick={handleSimulateRequest}>
          🚀 Simulate Distributed Request Chain
        </button>
      </header>

      {/* Services Mesh Topology Cards */}
      <h3 style={{ color: "#58a6ff", marginBottom: "1rem" }}>Microservices Mesh Health</h3>
      <div className="grid-2">
        {data.services.map((s) => (
          <div key={s.id} className="card">
            <h4 style={{ color: "#58a6ff", marginBottom: "0.5rem" }}>{s.name} ({s.id})</h4>
            <div style={{ fontSize: "0.85rem", color: "#8b949e" }}>
              Throughput: {s.rps} req/sec • Error Rate: {s.errorRate}%
            </div>
            <div style={{ fontSize: "0.9rem", color: "#238636", fontWeight: "bold", marginTop: "0.25rem" }}>
              P99 Latency: {s.p99LatencyMs} ms
            </div>
          </div>
        ))}
      </div>

      {/* Waterfall Trace Spans Debugger */}
      <div className="card">
        <h3 style={{ color: "#58a6ff", marginBottom: "1rem" }}>Waterfall Trace Execution Timeline</h3>
        <div style={{ background: "#0d1117", padding: "1rem", borderRadius: "6px", fontFamily: "monospace", fontSize: "0.8rem" }}>
          {data.spans.map((sp, idx) => (
            <div key={idx} style={{ marginBottom: "0.6rem" }}>
              <span style={{ color: "#58a6ff" }}>[{sp.traceId}]</span>{" "}
              <strong>{sp.service}</strong> ➔ {sp.name} ({sp.durationMs} ms)
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
