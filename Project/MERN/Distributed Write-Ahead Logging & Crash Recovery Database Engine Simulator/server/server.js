const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let currentLsn = 101;
let walLogs = [
  { lsn: 100, transId: "T1", type: "UPDATE", pageId: 4, prevVal: 100, newVal: 150 },
  { lsn: 101, transId: "T2", type: "UPDATE", pageId: 9, prevVal: 500, newVal: 750 }
];

let bufferPoolPages = [
  { pageId: 4, isDirty: true, lsn: 100, data: "User 101 balance = $150" },
  { pageId: 9, isDirty: true, lsn: 101, data: "User 102 balance = $750" }
];

let systemStatus = "NORMAL"; // "NORMAL", "CRASHED", "RECOVERED"
let recoveryPhase = null;

app.get("/api/wal/status", (req, res) => {
  res.json({ success: true, status: systemStatus, phase: recoveryPhase, walLogs, pages: bufferPoolPages });
});

app.post("/api/wal/transaction", (req, res) => {
  const { transId, pageId, newVal } = req.body;
  currentLsn++;

  walLogs.push({
    lsn: currentLsn,
    transId: transId || "T3",
    type: "UPDATE",
    pageId: Number(pageId) || 5,
    prevVal: 200,
    newVal: Number(newVal) || 300
  });

  const page = bufferPoolPages.find(p => p.pageId === Number(pageId));
  if (page) {
    page.isDirty = true;
    page.lsn = currentLsn;
    page.data = `Page ${pageId} updated to ${newVal}`;
  } else {
    bufferPoolPages.push({ pageId: Number(pageId), isDirty: true, lsn: currentLsn, data: `Page ${pageId} value = ${newVal}` });
  }

  res.json({ success: true, lsn: currentLsn, walLogs });
});

app.post("/api/wal/simulate-crash", (req, res) => {
  systemStatus = "CRASHED";
  // Unflushed dirty pages lost from RAM Buffer Pool
  bufferPoolPages = bufferPoolPages.filter(p => !p.isDirty);
  res.json({ success: true, message: "CRASH! Dirty pages in RAM lost. WAL log preserved on disk.", status: systemStatus });
});

app.post("/api/wal/aries-recovery", (req, res) => {
  systemStatus = "RECOVERED";
  recoveryPhase = "ARIES COMPLETE (Analysis ➔ Redo ➔ Undo)";

  // Reconstruct dirty pages from append-only WAL log records
  walLogs.forEach(w => {
    let p = bufferPoolPages.find(page => page.pageId === w.pageId);
    if (!p) {
      p = { pageId: w.pageId, isDirty: false, lsn: w.lsn, data: "" };
      bufferPoolPages.push(p);
    }
    p.data = `Page ${w.pageId} restored to ${w.newVal} (LSN #${w.lsn})`;
    p.isDirty = false;
  });

  res.json({ success: true, message: "ARIES Crash Recovery successfully restored ACID durability!", pages: bufferPoolPages });
});

const PORT = process.env.PORT || 5017;
app.listen(PORT, () => {
  console.log(`WAL Crash Recovery Database Engine running on port ${PORT}`);
});
