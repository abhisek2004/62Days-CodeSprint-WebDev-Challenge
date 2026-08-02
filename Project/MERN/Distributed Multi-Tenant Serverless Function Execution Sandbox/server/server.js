const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let functionsList = [
  { fnId: "fn_image_thumbnail", name: "Resize Patient Image", memoryMb: 128, timeoutMs: 3000, lastColdStartMs: 145, totalInvocations: 89 },
  { fnId: "fn_pdf_invoice", name: "Generate PDF Billing Invoice", memoryMb: 256, timeoutMs: 5000, lastColdStartMs: 210, totalInvocations: 240 }
];

app.get("/api/serverless/functions", (req, res) => {
  res.json({ success: true, functions: functionsList });
});

app.post("/api/serverless/invoke", (req, res) => {
  const { fnId, code } = req.body;
  const isCold = Math.random() > 0.5;
  const coldStartMs = isCold ? Math.floor(Math.random() * 150 + 100) : 0;
  const execDurationMs = Math.floor(Math.random() * 40 + 15);

  const target = functionsList.find(f => f.fnId === fnId);
  if (target) {
    target.totalInvocations++;
    target.lastColdStartMs = coldStartMs;
  }

  res.json({
    success: true,
    result: { message: "Function executed successfully in isolated VM sandbox", timestamp: new Date().toISOString() },
    telemetry: {
      isColdStart: isCold,
      coldStartMs,
      execDurationMs,
      totalLatencyMs: coldStartMs + execDurationMs,
      memoryPeakMb: Math.floor(Math.random() * 30 + 45)
    }
  });
});

const PORT = process.env.PORT || 5019;
app.listen(PORT, () => {
  console.log(`Serverless Function Sandbox running on port ${PORT}`);
});
