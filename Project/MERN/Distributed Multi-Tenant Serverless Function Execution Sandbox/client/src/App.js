import React, { useState, useEffect } from "react";

function App() {
  const [data, setData] = useState({ functions: [] });
  const [code, setCode] = useState(`module.exports = async function handler(req, res) {\n  return { status: 200, message: "Hello from isolated VM serverless function!" };\n};`);
  const [executionResult, setExecutionResult] = useState(null);

  const fetchFunctions = async () => {
    try {
      const res = await fetch("http://localhost:5019/api/serverless/functions");
      const result = await res.json();
      if (result.success) setData(result);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchFunctions();
  }, []);

  const handleInvoke = async (fnId) => {
    try {
      const res = await fetch("http://localhost:5019/api/serverless/invoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fnId: fnId || "fn_image_thumbnail", code }),
      });
      const result = await res.json();
      if (result.success) {
        setExecutionResult(result);
        fetchFunctions();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="sandbox-container">
      <header>
        <div>
          <h1>⚡ Multi-Tenant Serverless Function Execution Sandbox</h1>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Isolated VM Container Execution & Cold Start Latency Telemetry
          </p>
        </div>
      </header>

      <div className="grid-2">
        {/* Code Editor */}
        <div className="card">
          <h3 style={{ color: "#38bdf8", marginBottom: "1rem" }}>Serverless Handler Editor</h3>
          <textarea
            className="code-editor"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <button className="btn" style={{ width: "100%" }} onClick={() => handleInvoke("fn_image_thumbnail")}>
            🚀 Trigger Execution HTTP Sandbox
          </button>
        </div>

        {/* Telemetry Output */}
        <div className="card">
          <h3 style={{ color: "#38bdf8", marginBottom: "1rem" }}>Execution Telemetry & VM Output</h3>
          {executionResult ? (
            <div style={{ background: "#0f172a", padding: "1rem", borderRadius: "6px" }}>
              <div style={{ color: "#22c55e", fontWeight: "bold", marginBottom: "0.5rem" }}>
                ✅ Status 200 OK (Latency: {executionResult.telemetry.totalLatencyMs} ms)
              </div>
              <div style={{ fontSize: "0.85rem", color: "#94a3b8", marginBottom: "0.5rem" }}>
                Cold Start: {executionResult.telemetry.isColdStart ? `Yes (${executionResult.telemetry.coldStartMs} ms)` : "No (Hot Container)"} <br />
                Memory Used: {executionResult.telemetry.memoryPeakMb} MB
              </div>
              <div style={{ background: "#1e293b", padding: "0.8rem", borderRadius: "4px", fontFamily: "monospace", fontSize: "0.8rem", color: "#38bdf8" }}>
                {JSON.stringify(executionResult.result, null, 2)}
              </div>
            </div>
          ) : (
            <div style={{ color: "#64748b" }}>Click Trigger Execution to view latency metrics.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
