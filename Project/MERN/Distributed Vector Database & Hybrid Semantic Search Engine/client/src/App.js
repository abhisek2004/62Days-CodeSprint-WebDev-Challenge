import React, { useState, useEffect } from "react";

function App() {
  const [data, setData] = useState({ documents: [] });
  const [queryText, setQueryText] = useState("cardiovascular symptoms");
  const [distanceMetric, setDistanceMetric] = useState("cosine");
  const [hybridResults, setHybridResults] = useState(null);

  const fetchDocs = async () => {
    try {
      const res = await fetch("http://localhost:5022/api/vector/documents");
      const result = await res.json();
      if (result.success) setData(result);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const handleSearch = async () => {
    try {
      const res = await fetch("http://localhost:5022/api/vector/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queryText, distanceMetric, hybridWeight: 0.6 }),
      });
      const result = await res.json();
      if (result.success) setHybridResults(result);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="vector-container">
      <header>
        <div>
          <h1>📐 Distributed Vector DB & Hybrid Semantic Search</h1>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            HNSW Hierarchical Indexing & BM25 + Dense Vector Hybrid Search
          </p>
        </div>
      </header>

      {/* Semantic Search Box */}
      <div className="card" style={{ marginBottom: "2rem" }}>
        <h3 style={{ color: "#38bdf8", marginBottom: "1rem" }}>Execute Vector Semantic Query</h3>
        <div style={{ display: "flex", gap: "1rem" }}>
          <input
            type="text"
            className="input-field"
            style={{ marginBottom: 0 }}
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
          />
          <select className="input-field" style={{ marginBottom: 0, width: "200px" }} value={distanceMetric} onChange={(e) => setDistanceMetric(e.target.value)}>
            <option value="cosine">Cosine Similarity</option>
            <option value="euclidean">Euclidean Distance</option>
            <option value="dot_product">Dot Product</option>
          </select>
          <button className="btn" style={{ minWidth: "160px" }} onClick={handleSearch}>
            Search Vector Space
          </button>
        </div>

        {hybridResults && (
          <div style={{ marginTop: "1rem", padding: "1rem", background: "#0f172a", borderRadius: "6px" }}>
            <div style={{ color: "#22c55e", fontWeight: "bold" }}>
              ⚡ HNSW Query executed in {hybridResults.latencyMs} ms ({hybridResults.results.length} matches)
            </div>
            {hybridResults.results.map((r, idx) => (
              <div key={idx} style={{ marginTop: "0.5rem", borderTop: "1px solid #334155", paddingTop: "0.5rem" }}>
                <strong>{r.doc.text}</strong>
                <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                  Hybrid Score: <span style={{ color: "#38bdf8" }}>{r.hybridScore}</span> • Cosine Similarity: {r.cosineSimilarity}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Embedded Documents Catalog */}
      <div className="card">
        <h3 style={{ color: "#38bdf8", marginBottom: "1rem" }}>Vector Index Document Catalog</h3>
        {data.documents.map((d) => (
          <div key={d.id} style={{ padding: "0.8rem", background: "#0f172a", borderRadius: "6px", marginBottom: "0.75rem", border: "1px solid #334155" }}>
            <strong style={{ color: "#38bdf8" }}>{d.id}</strong> - {d.text}
            <div style={{ fontSize: "0.8rem", color: "#94a3b8", fontFamily: "monospace" }}>
              Embedding Vector: [{d.vector.join(", ")}]
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
