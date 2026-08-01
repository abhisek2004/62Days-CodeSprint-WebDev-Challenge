const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let currentTerm = 3;
let raftCluster = [
  { id: "node-1", role: "LEADER", term: currentTerm, committedIndex: 4, isPartitioned: false },
  { id: "node-2", role: "FOLLOWER", term: currentTerm, committedIndex: 4, isPartitioned: false },
  { id: "node-3", role: "FOLLOWER", term: currentTerm, committedIndex: 4, isPartitioned: false },
  { id: "node-4", role: "FOLLOWER", term: currentTerm, committedIndex: 4, isPartitioned: false },
  { id: "node-5", role: "FOLLOWER", term: currentTerm, committedIndex: 4, isPartitioned: false }
];

let raftLogs = [
  { term: 1, index: 1, command: "SET key1 = 100", status: "COMMITTED" },
  { term: 2, index: 2, command: "SET key2 = 200", status: "COMMITTED" },
  { term: 3, index: 3, command: "SET key3 = 300", status: "COMMITTED" },
  { term: 3, index: 4, command: "SET key4 = 400", status: "COMMITTED" }
];

app.get("/api/raft/cluster", (req, res) => {
  res.json({ success: true, term: currentTerm, cluster: raftCluster, logs: raftLogs });
});

app.post("/api/raft/trigger-election", (req, res) => {
  currentTerm++;
  // Reset roles
  raftCluster.forEach(n => { n.role = "FOLLOWER"; n.term = currentTerm; });
  // Elect Node-2 as new leader
  const newLeader = raftCluster[1];
  newLeader.role = "LEADER";

  res.json({ success: true, message: `Term ${currentTerm} election completed. ${newLeader.id} elected Leader.`, cluster: raftCluster });
});

app.post("/api/raft/replicate-log", (req, res) => {
  const { command } = req.body;
  const newIdx = raftLogs.length + 1;
  const entry = { term: currentTerm, index: newIdx, command: command || "SET val = 500", status: "COMMITTED" };
  raftLogs.push(entry);

  raftCluster.forEach(n => { n.committedIndex = newIdx; });

  res.json({ success: true, entry, cluster: raftCluster });
});

const PORT = process.env.PORT || 5023;
app.listen(PORT, () => {
  console.log(`Raft Consensus State Machine Visualizer running on port ${PORT}`);
});
