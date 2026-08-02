const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Storage Nodes cluster (K=4 Data Chunks, M=2 Parity Chunks)
let storageNodes = [
  { id: "node-1", type: "DATA", chunk: "DATA_PART_1_908a", status: "HEALTHY" },
  { id: "node-2", type: "DATA", chunk: "DATA_PART_2_311b", status: "HEALTHY" },
  { id: "node-3", type: "DATA", chunk: "DATA_PART_3_77cf", status: "HEALTHY" },
  { id: "node-4", type: "DATA", chunk: "DATA_PART_4_12ed", status: "HEALTHY" },
  { id: "node-5", type: "PARITY", chunk: "PARITY_XOR_M1_44", status: "HEALTHY" },
  { id: "node-6", type: "PARITY", chunk: "PARITY_RS_M2_99", status: "HEALTHY" }
];

let storedBlob = {
  filename: "medical_scan_patient_1042.dicom",
  originalSizeBytes: 4194304, // 4MB
  dataChunksCount: 4,
  parityChunksCount: 2,
  reconstructionPossible: true
};

app.get("/api/storage/cluster", (req, res) => {
  const healthyCount = storageNodes.filter(n => n.status === "HEALTHY").length;
  // Reed-Solomon Rule: Reconstruction is possible if healthy nodes >= K (4)
  const canReconstruct = healthyCount >= storedBlob.dataChunksCount;

  res.json({
    success: true,
    blob: storedBlob,
    nodes: storageNodes,
    reconstructionPossible: canReconstruct,
    healthyCount,
    failedCount: storageNodes.length - healthyCount,
    storageOverheadPct: Math.round(((storageNodes.length - storedBlob.dataChunksCount) / storedBlob.dataChunksCount) * 100)
  });
});

app.post("/api/storage/node/fail", (req, res) => {
  const { nodeId } = req.body;
  const node = storageNodes.find(n => n.id === nodeId);
  if (node) {
    node.status = node.status === "HEALTHY" ? "FAILED" : "HEALTHY";
  }
  res.json({ success: true, nodes: storageNodes });
});

app.post("/api/storage/reconstruct", (req, res) => {
  const healthyCount = storageNodes.filter(n => n.status === "HEALTHY").length;
  if (healthyCount < storedBlob.dataChunksCount) {
    return res.status(400).json({
      success: false,
      message: `File UNRECOVERABLE. Required at least 4 healthy nodes, but only ${healthyCount} are healthy.`
    });
  }

  // Restore all failed nodes via Reed-Solomon parity matrix solver
  storageNodes.forEach(n => { n.status = "HEALTHY"; });

  res.json({
    success: true,
    message: `Reed-Solomon Erasure Coding solver successfully reconstructed file '${storedBlob.filename}'! All storage nodes repaired.`,
    nodes: storageNodes
  });
});

const PORT = process.env.PORT || 5006;
app.listen(PORT, () => {
  console.log(`Blob Storage Reed-Solomon Simulator running on port ${PORT}`);
});
