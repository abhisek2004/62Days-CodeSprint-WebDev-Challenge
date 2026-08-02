import React, { useState, useEffect } from "react";

function App() {
  const [data, setData] = useState({ status: "NORMAL", walLogs: [], pages: [] });

  const fetchStatus = async () => {
    try {
      const res = await fetch("http://localhost:5017/api/wal/status");
      const result = await res.json();
      if (result.success) setData(result);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleTransaction = async () => {
    try {
      await fetch("http://localhost:5017/api/wal/transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transId: "T3", pageId: 4, newVal: 950 }),
      });
      fetchStatus();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSimulateCrash = async () => {
    try {
      await fetch("http://localhost:5017/api/wal/simulate-crash", { method: "POST" });
      fetchStatus();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAriesRecovery = async () => {
    try {
      await fetch("http://localhost:5017/api/wal/aries-recovery", { method: "POST" });
      fetchStatus();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="wal-container">
      <header>
        <div>
          <h1>💾 Write-Ahead Logging (WAL) & ARIES Crash Recovery</h1>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Buffer Pool Dirty Pages, Log Sequence Numbers (LSN), and Analysis/Redo/Undo Recovery
          </p>
        </div>
        <div>
          <span style={{ padding: "0.4rem 0.8rem", borderRadius: "6px", fontSize: "0.8rem", fontWeight: "bold", background: data.status === "CRASHED" ? "#ef4444" : "#0284c7", color: "#fff" }}>
            Engine Status: {data.status}
          </span>
        </div>
      </header>

      {/* Control Buttons */}
      <div className="card" style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", gap: "1rem" }}>
          <button className="btn" onClick={handleTransaction}>
            📝 Execute DB Transaction (Write LSN)
          </button>
          <button className="btn btn-danger" onClick={handleSimulateCrash}>
            💥 Trigger Sudden Power/Process Crash
          </button>
          <button className="btn" style={{ background: "#22c55e" }} onClick={handleAriesRecovery} disabled={data.status !== "CRASHED"}>
            🛠️ Run ARIES Crash Recovery Engine
          </button>
        </div>
      </div>

      <div className="grid-2">
        {/* Append-Only WAL Records Log */}
        <div className="card">
          <h3 style={{ color: "#38bdf8", marginBottom: "1rem" }}>Append-Only WAL Disk Log Records</h3>
          <div style={{ background: "#0b0f19", padding: "1rem", borderRadius: "6px", maxHeight: "250px", overflowY: "auto", fontFamily: "monospace", fontSize: "0.85rem" }}>
            {data.walLogs.map((w) => (
              <div key={w.lsn} style={{ color: "#38bdf8", marginBottom: "0.4rem" }}>
                [LSN #{w.lsn}] {w.transId} UPDATE Page-{w.pageId}: {w.prevVal} ➔ {w.newVal}
              </div>
            ))}
          </div>
        </div>

        {/* RAM Buffer Pool Pages */}
        <div className="card">
          <h3 style={{ color: "#38bdf8", marginBottom: "1rem" }}>RAM Buffer Pool Pages</h3>
          {data.pages.map((p) => (
            <div key={p.pageId} style={{ padding: "0.8rem", background: "#0b0f19", borderRadius: "6px", marginBottom: "0.75rem", border: "1px solid #1e293b" }}>
              <div style={{ fontWeight: "bold" }}>Page #{p.pageId}</div>
              <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>{p.data}</div>
              <div style={{ fontSize: "0.75rem", color: p.isDirty ? "#f59e0b" : "#22c55e", fontWeight: "bold" }}>
                {p.isDirty ? "⚠️ Dirty Page (Unflushed to disk)" : "✅ Clean Page (Flushed)"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
