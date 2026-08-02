import React, { useState, useEffect } from "react";

function App() {
  const [datasetKey, setDatasetKey] = useState("social");
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [query, setQuery] = useState("MATCH (n) RETURN n");
  const [selectedNode, setSelectedNode] = useState(null);
  const [execTime, setExecTime] = useState(null);
  const [algorithm, setAlgorithm] = useState("shortest_path");
  const [startNodeId, setStartNodeId] = useState("");
  const [endNodeId, setEndNodeId] = useState("");
  const [pathResult, setPathResult] = useState(null);

  const fetchGraph = async (dsKey) => {
    try {
      const res = await fetch("http://localhost:5001/api/graph/dataset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datasetKey: dsKey }),
      });
      const data = await res.json();
      if (data.success) {
        setGraphData(data.graph);
        if (data.graph.nodes.length > 0) {
          setStartNodeId(data.graph.nodes[0].id);
          setEndNodeId(data.graph.nodes[data.graph.nodes.length - 1].id);
        }
      }
    } catch (err) {
      console.error("Error fetching graph data:", err);
    }
  };

  useEffect(() => {
    fetchGraph(datasetKey);
  }, [datasetKey]);

  const handleQueryRun = async () => {
    try {
      const res = await fetch("http://localhost:5001/api/graph/cypher", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (data.success) {
        setGraphData(data.result);
        setExecTime(data.executionTimeMs);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAlgorithmRun = async () => {
    try {
      const res = await fetch("http://localhost:5001/api/graph/pathfinding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startId: startNodeId, endId: endNodeId, algorithm }),
      });
      const data = await res.json();
      if (data.success) {
        setPathResult(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Basic node positions layout for visual representation
  const getNodePosition = (index, total) => {
    const angle = (index / total) * 2 * Math.PI;
    const radius = 180;
    const centerX = 350;
    const centerY = 250;
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  };

  const nodePosMap = {};
  graphData.nodes.forEach((n, idx) => {
    nodePosMap[n.id] = getNodePosition(idx, graphData.nodes.length || 1);
  });

  return (
    <div className="app-container">
      <header>
        <h1>🌐 Real-Time Graph DB & Visual Cypher Explorer</h1>
        <div>
          <span style={{ fontSize: "0.85rem", color: "#94a3b8", marginRight: "0.5rem" }}>Dataset:</span>
          <select
            className="dataset-select"
            style={{ width: "auto" }}
            value={datasetKey}
            onChange={(e) => setDatasetKey(e.target.value)}
          >
            <option value="social">Social Network</option>
            <option value="ecommerce">E-Commerce Graph</option>
            <option value="fraud">Fraud Detection Ring</option>
          </select>
        </div>
      </header>

      <div className="main-content">
        {/* Left Sidebar Controls */}
        <div className="sidebar">
          <div className="card">
            <div className="card-title">Cypher Query Shortcuts</div>
            <button className="btn btn-secondary" style={{ width: "100%", marginBottom: "0.5rem" }} onClick={() => setQuery("MATCH (n) RETURN n")}>
              Match All Nodes
            </button>
            <button className="btn btn-secondary" style={{ width: "100%" }} onClick={() => setQuery("MATCH (u:User) RETURN u")}>
              Match User Nodes
            </button>
          </div>

          <div className="card">
            <div className="card-title">Graph Traversal & Pathfinding</div>
            <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: "0.25rem" }}>Algorithm</label>
            <select className="select-input" value={algorithm} onChange={(e) => setAlgorithm(e.target.value)} style={{ marginBottom: "0.75rem" }}>
              <option value="shortest_path">Shortest Path (BFS)</option>
              <option value="pagerank">PageRank Centrality</option>
            </select>

            {algorithm !== "pagerank" && (
              <>
                <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: "0.25rem" }}>Start Node</label>
                <select className="select-input" value={startNodeId} onChange={(e) => setStartNodeId(e.target.value)} style={{ marginBottom: "0.5rem" }}>
                  {graphData.nodes.map(n => <option key={n.id} value={n.id}>{n.id} ({n.label})</option>)}
                </select>

                <label style={{ fontSize: "0.8rem", color: "#94a3b8", display: "block", marginBottom: "0.25rem" }}>Target Node</label>
                <select className="select-input" value={endNodeId} onChange={(e) => setEndNodeId(e.target.value)} style={{ marginBottom: "0.75rem" }}>
                  {graphData.nodes.map(n => <option key={n.id} value={n.id}>{n.id} ({n.label})</option>)}
                </select>
              </>
            )}

            <button className="btn" style={{ width: "100%" }} onClick={handleAlgorithmRun}>
              Run Pathfinding
            </button>

            {pathResult && (
              <div style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#38bdf8" }}>
                {pathResult.algorithm === "pagerank" ? (
                  <div>PageRank Scores Calculated</div>
                ) : (
                  <div>Path: {pathResult.path ? pathResult.path.join(" ➔ ") : "No path"}</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Central Canvas & Cypher Input */}
        <div className="canvas-section">
          <div className="query-bar">
            <input
              type="text"
              className="query-input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. MATCH (u:User)-[:FRIEND]->(f) RETURN f"
            />
            <button className="btn" onClick={handleQueryRun}>Execute Cypher</button>
          </div>

          {execTime && (
            <div style={{ padding: "0.5rem 1rem", backgroundColor: "#0f172a", borderBottom: "1px solid #334155", fontSize: "0.8rem", color: "#22c55e" }}>
              ⚡ Query executed in {execTime} ms ({graphData.nodes.length} nodes, {graphData.edges.length} relationships)
            </div>
          )}

          <div className="graph-canvas">
            <svg className="svg-canvas" viewBox="0 0 700 500">
              {/* Edges */}
              {graphData.edges.map((e) => {
                const sPos = nodePosMap[e.source];
                const tPos = nodePosMap[e.target];
                if (!sPos || !tPos) return null;
                const isHighlight = pathResult && pathResult.path && pathResult.path.includes(e.source) && pathResult.path.includes(e.target);
                return (
                  <g key={e.id}>
                    <line
                      x1={sPos.x}
                      y1={sPos.y}
                      x2={tPos.x}
                      y2={tPos.y}
                      stroke={isHighlight ? "#f59e0b" : "#475569"}
                      strokeWidth={isHighlight ? 3 : 2}
                      strokeDasharray={isHighlight ? "4 4" : "none"}
                    />
                    <text
                      x={(sPos.x + tPos.x) / 2}
                      y={(sPos.y + tPos.y) / 2 - 5}
                      fill="#94a3b8"
                      fontSize="10"
                      textAnchor="middle"
                    >
                      {e.relationship}
                    </text>
                  </g>
                );
              })}

              {/* Nodes */}
              {graphData.nodes.map((n) => {
                const pos = nodePosMap[n.id] || { x: 350, y: 250 };
                const isSelected = selectedNode && selectedNode.id === n.id;
                const isPathNode = pathResult && pathResult.path && pathResult.path.includes(n.id);
                return (
                  <g
                    key={n.id}
                    className="node-element"
                    onClick={() => setSelectedNode(n)}
                    transform={`translate(${pos.x}, ${pos.y})`}
                  >
                    <circle
                      r="22"
                      fill={isSelected ? "#0284c7" : isPathNode ? "#f59e0b" : "#1e293b"}
                      stroke={isSelected ? "#38bdf8" : isPathNode ? "#fbbf24" : "#38bdf8"}
                      strokeWidth="2.5"
                    />
                    <text
                      textAnchor="middle"
                      dy="4"
                      fill="#f8fafc"
                      fontSize="11"
                      fontWeight="bold"
                    >
                      {n.id}
                    </text>
                    <text
                      textAnchor="middle"
                      dy="34"
                      fill="#94a3b8"
                      fontSize="10"
                    >
                      {n.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        </div>

        {/* Right Node & Edge Inspector Drawer */}
        <div className="inspector-drawer">
          <div className="card">
            <div className="card-title">Property Inspector</div>
            {selectedNode ? (
              <div>
                <div className="property-row">
                  <span className="property-key">ID:</span>
                  <span className="property-val">{selectedNode.id}</span>
                </div>
                <div className="property-row">
                  <span className="property-key">Label:</span>
                  <span className="property-val">{selectedNode.label}</span>
                </div>
                <hr style={{ borderColor: "#334155", margin: "0.75rem 0" }} />
                <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.5rem", fontWeight: "bold" }}>Properties:</div>
                {Object.entries(selectedNode.properties || {}).map(([k, v]) => (
                  <div key={k} className="property-row">
                    <span className="property-key">{k}:</span>
                    <span className="property-val">{String(v)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: "#64748b", fontSize: "0.85rem" }}>
                Select any node on the graph to inspect properties.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
