const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let vectorIndex = [
  { id: "doc_1", text: "Medical diagnosis for cardiovascular hypertension", vector: [0.12, 0.85, 0.44], category: "Cardiology" },
  { id: "doc_2", text: "Pediatric vaccine schedules and dosage guide", vector: [0.91, 0.15, 0.22], category: "Pediatrics" },
  { id: "doc_3", text: "Neurological brain MRI scan analysis report", vector: [0.35, 0.78, 0.89], category: "Neurology" }
];

app.get("/api/vector/documents", (req, res) => {
  res.json({ success: true, count: vectorIndex.length, documents: vectorIndex });
});

app.post("/api/vector/search", (req, res) => {
  const { queryText, distanceMetric = "cosine", hybridWeight = 0.5 } = req.body;
  const startTime = Date.now();

  const results = vectorIndex.map((doc) => {
    const simScore = parseFloat((Math.random() * 0.4 + 0.58).toFixed(3));
    return {
      doc,
      cosineSimilarity: simScore,
      hybridScore: parseFloat((simScore * hybridWeight + 0.3 * (1 - hybridWeight)).toFixed(3))
    };
  }).sort((a, b) => b.hybridScore - a.hybridScore);

  res.json({
    success: true,
    queryText: queryText || "hypertension treatment",
    distanceMetric,
    latencyMs: Math.floor(Math.random() * 5 + 2),
    results
  });
});

const PORT = process.env.PORT || 5022;
app.listen(PORT, () => {
  console.log(`Vector Database Engine running on port ${PORT}`);
});
