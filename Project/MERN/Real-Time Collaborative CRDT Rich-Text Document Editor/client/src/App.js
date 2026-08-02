import React, { useState, useEffect } from "react";

function App() {
  const [doc, setDoc] = useState({ title: "", content: "", version: 0, activeUsers: [], versionHistory: [] });

  const fetchDoc = async () => {
    try {
      const res = await fetch("http://localhost:5020/api/crdt/document");
      const result = await res.json();
      if (result.success) setDoc(result.document);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDoc();
  }, []);

  const handleContentChange = async (newContent) => {
    setDoc(prev => ({ ...prev, content: newContent }));
    try {
      await fetch("http://localhost:5020/api/crdt/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newContent, author: "Dr. Sarah Jenkins" }),
      });
      fetchDoc();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="crdt-container">
      <header>
        <div>
          <h1>📝 Collaborative CRDT Rich-Text Document Editor</h1>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Yjs/Automerge Sequence CRDT Model & Operational Conflict Resolution
          </p>
        </div>
      </header>

      {/* User Presence Badges */}
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
        {doc.activeUsers.map((u) => (
          <span key={u.userId} style={{ background: "#1e293b", border: `1px solid ${u.color}`, padding: "0.4rem 0.8rem", borderRadius: "20px", fontSize: "0.85rem", color: u.color, fontWeight: "bold" }}>
            🟢 {u.name} (Cursor #{u.cursorIndex})
          </span>
        ))}
      </div>

      <div className="grid-2">
        {/* Collaborative Editor Workspace */}
        <div className="card">
          <h3 style={{ color: "#38bdf8", marginBottom: "0.5rem" }}>{doc.title || "Document"}</h3>
          <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "1rem" }}>
            Version: <strong style={{ color: "#38bdf8" }}>v{doc.version}</strong>
          </div>
          <textarea
            className="editor-textarea"
            value={doc.content}
            onChange={(e) => handleContentChange(e.target.value)}
          />
        </div>

        {/* CRDT Revision Timeline */}
        <div className="card">
          <h3 style={{ color: "#38bdf8", marginBottom: "1rem" }}>CRDT Delta Revision Timeline</h3>
          <div style={{ background: "#0f172a", padding: "1rem", borderRadius: "6px", maxHeight: "250px", overflowY: "auto", fontSize: "0.85rem" }}>
            {doc.versionHistory.map((h, idx) => (
              <div key={idx} style={{ marginBottom: "0.75rem", borderBottom: "1px solid #334155", paddingBottom: "0.5rem" }}>
                <strong style={{ color: "#38bdf8" }}>v{h.version}</strong> - {h.changeSummary}
                <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                  By {h.author} at {new Date(h.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
