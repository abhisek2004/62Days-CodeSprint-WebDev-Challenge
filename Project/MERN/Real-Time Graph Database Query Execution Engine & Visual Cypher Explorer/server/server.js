const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Preloaded Datasets
const datasets = {
  social: {
    nodes: [
      { id: "u1", label: "User", properties: { name: "Alice", age: 28, city: "NYC" } },
      { id: "u2", label: "User", properties: { name: "Bob", age: 32, city: "SF" } },
      { id: "u3", label: "User", properties: { name: "Charlie", age: 24, city: "NYC" } },
      { id: "u4", label: "User", properties: { name: "Diana", age: 29, city: "Austin" } },
      { id: "p1", label: "Post", properties: { title: "Graph DBs 101", likes: 42 } },
      { id: "p2", label: "Post", properties: { title: "React & D3", likes: 89 } }
    ],
    edges: [
      { id: "e1", source: "u1", target: "u2", relationship: "FRIEND" },
      { id: "e2", source: "u2", target: "u3", relationship: "FRIEND" },
      { id: "e3", source: "u1", target: "u4", relationship: "FOLLOWS" },
      { id: "e4", source: "u3", target: "p1", relationship: "POSTED" },
      { id: "e5", source: "u1", target: "p2", relationship: "LIKED" }
    ]
  },
  ecommerce: {
    nodes: [
      { id: "c1", label: "Customer", properties: { name: "Emma", tier: "VIP" } },
      { id: "c2", label: "Customer", properties: { name: "Liam", tier: "Regular" } },
      { id: "pr1", label: "Product", properties: { title: "Laptop Pro", price: 1200 } },
      { id: "pr2", label: "Product", properties: { title: "Wireless Mouse", price: 35 } },
      { id: "pr3", label: "Product", properties: { title: "4K Monitor", price: 450 } },
      { id: "cat1", label: "Category", properties: { name: "Electronics" } }
    ],
    edges: [
      { id: "e10", source: "c1", target: "pr1", relationship: "PURCHASED" },
      { id: "e11", source: "c1", target: "pr2", relationship: "PURCHASED" },
      { id: "e12", source: "c2", target: "pr2", relationship: "VIEWED" },
      { id: "e13", source: "pr1", target: "cat1", relationship: "BELONGS_TO" },
      { id: "e14", source: "pr2", target: "cat1", relationship: "BELONGS_TO" }
    ]
  },
  fraud: {
    nodes: [
      { id: "acc1", label: "Account", properties: { accNo: "1001", riskScore: 85 } },
      { id: "acc2", label: "Account", properties: { accNo: "1002", riskScore: 92 } },
      { id: "acc3", label: "Account", properties: { accNo: "1003", riskScore: 12 } },
      { id: "ip1", label: "IPAddress", properties: { ip: "192.168.1.50", flagged: true } },
      { id: "card1", label: "CreditCard", properties: { cardHash: "7x89a", country: "US" } }
    ],
    edges: [
      { id: "ef1", source: "acc1", target: "ip1", relationship: "LOGGED_IN_FROM" },
      { id: "ef2", source: "acc2", target: "ip1", relationship: "LOGGED_IN_FROM" },
      { id: "ef3", source: "acc1", target: "acc2", relationship: "TRANSFERRED_FUNDS" },
      { id: "ef4", source: "acc2", target: "card1", relationship: "USED_CARD" },
      { id: "ef5", source: "acc3", target: "card1", relationship: "USED_CARD" }
    ]
  }
};

let currentGraph = JSON.parse(JSON.stringify(datasets.social));

// Get Graph Data
app.get("/api/graph", (req, res) => {
  res.json({ success: true, graph: currentGraph });
});

// Load Dataset
app.post("/api/graph/dataset", (req, res) => {
  const { datasetKey } = req.body;
  if (datasets[datasetKey]) {
    currentGraph = JSON.parse(JSON.stringify(datasets[datasetKey]));
    return res.json({ success: true, graph: currentGraph });
  }
  res.status(400).json({ success: false, message: "Invalid dataset" });
});

// Execute Cypher Query Simulator
app.post("/api/graph/cypher", (req, res) => {
  const { query } = req.body;
  const q = query.trim().toUpperCase();

  let matchedNodes = [];
  let matchedEdges = [];

  if (q.includes("MATCH") && q.includes("RETURN")) {
    if (q.includes(":USER")) {
      matchedNodes = currentGraph.nodes.filter(n => n.label === "User");
    } else if (q.includes(":PRODUCT")) {
      matchedNodes = currentGraph.nodes.filter(n => n.label === "Product");
    } else if (q.includes(":ACCOUNT")) {
      matchedNodes = currentGraph.nodes.filter(n => n.label === "Account");
    } else {
      matchedNodes = [...currentGraph.nodes];
    }

    const nodeIds = new Set(matchedNodes.map(n => n.id));
    matchedEdges = currentGraph.edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
  } else {
    matchedNodes = currentGraph.nodes;
    matchedEdges = currentGraph.edges;
  }

  res.json({
    success: true,
    query,
    executionTimeMs: Math.floor(Math.random() * 8) + 2,
    result: { nodes: matchedNodes, edges: matchedEdges }
  });
});

// Pathfinding Algorithm
app.post("/api/graph/pathfinding", (req, res) => {
  const { startId, endId, algorithm } = req.body;
  
  if (algorithm === "shortest_path" || algorithm === "bfs") {
    const queue = [[startId]];
    const visited = new Set([startId]);
    let path = [];

    while (queue.length > 0) {
      const currentPath = queue.shift();
      const node = currentPath[currentPath.length - 1];

      if (node === endId) {
        path = currentPath;
        break;
      }

      const neighbors = currentGraph.edges
        .filter(e => e.source === node)
        .map(e => e.target);

      for (const nxt of neighbors) {
        if (!visited.has(nxt)) {
          visited.add(nxt);
          queue.push([...currentPath, nxt]);
        }
      }
    }

    return res.json({ success: true, algorithm, path, cost: path.length > 0 ? path.length - 1 : Infinity });
  }

  // PageRank algorithm calculation simulation
  const rank = {};
  const numNodes = currentGraph.nodes.length;
  currentGraph.nodes.forEach(n => (rank[n.id] = (1 / numNodes).toFixed(3)));

  res.json({ success: true, algorithm: "pagerank", rank });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Graph Database Cypher Query Engine running on port ${PORT}`);
});
