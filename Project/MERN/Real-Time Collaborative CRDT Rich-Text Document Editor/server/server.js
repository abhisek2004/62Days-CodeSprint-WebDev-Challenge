const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let documentState = {
  docId: "doc_clinical_notes_901",
  title: "Patient Consultation Clinical Summary",
  content: "Patient presents with mild fever and sore throat. Recommended hydration and rest.",
  version: 14,
  activeUsers: [
    { userId: "u1", name: "Dr. Sarah Jenkins", color: "#38bdf8", cursorIndex: 12 },
    { userId: "u2", name: "Dr. Michael Chen", color: "#f59e0b", cursorIndex: 45 }
  ],
  versionHistory: [
    { version: 14, timestamp: new Date().toISOString(), author: "Dr. Sarah Jenkins", changeSummary: "Added diagnosis details" }
  ]
};

app.get("/api/crdt/document", (req, res) => {
  res.json({ success: true, document: documentState });
});

app.post("/api/crdt/update", (req, res) => {
  const { content, author } = req.body;
  documentState.content = content;
  documentState.version++;
  documentState.versionHistory.unshift({
    version: documentState.version,
    timestamp: new Date().toISOString(),
    author: author || "Anonymous Contributor",
    changeSummary: `CRDT delta update v${documentState.version}`
  });

  res.json({ success: true, document: documentState });
});

const PORT = process.env.PORT || 5020;
app.listen(PORT, () => {
  console.log(`CRDT Rich-Text Editor Server running on port ${PORT}`);
});
