const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// In-Memory Shared Memory Lock Store
let currentLock = null; // { resourceId, owner, fencingToken, leaseTtlSec, expiresAt }
let fencingTokenCounter = 100;
let waitingQueue = [];
let auditLogs = [];

function logAudit(action, details) {
  auditLogs.unshift({
    timestamp: new Date().toISOString(),
    action,
    details
  });
  if (auditLogs.length > 50) auditLogs.pop();
}

app.get("/api/lock/status", (req, res) => {
  const now = Date.now();
  if (currentLock && now > currentLock.expiresAt) {
    logAudit("LEASE_EXPIRED", `Lock lease expired for owner ${currentLock.owner} on resource ${currentLock.resourceId}`);
    currentLock = null;
    
    // Process next waiting worker
    if (waitingQueue.length > 0) {
      const nextWorker = waitingQueue.shift();
      fencingTokenCounter++;
      currentLock = {
        resourceId: "resource-db-row-42",
        owner: nextWorker.workerId,
        fencingToken: fencingTokenCounter,
        leaseTtlSec: 15,
        expiresAt: Date.now() + 15000
      };
      logAudit("LOCK_GRANTED_FROM_QUEUE", `Lock granted to queued worker ${nextWorker.workerId} with fencing token #${fencingTokenCounter}`);
    }
  }

  res.json({
    success: true,
    lock: currentLock,
    queue: waitingQueue,
    logs: auditLogs
  });
});

app.post("/api/lock/acquire", (req, res) => {
  const { resourceId, workerId, ttlSec = 15 } = req.body;
  const now = Date.now();

  if (currentLock && now <= currentLock.expiresAt) {
    if (currentLock.owner === workerId) {
      return res.json({ success: true, message: "Worker already holds lock", lock: currentLock });
    }
    // Add to waiting queue if not present
    if (!waitingQueue.find(w => w.workerId === workerId)) {
      waitingQueue.push({ workerId, requestedAt: new Date().toISOString() });
      logAudit("LOCK_QUEUED", `Worker ${workerId} queued waiting for lock on ${resourceId}`);
    }
    return res.status(409).json({ success: false, message: `Resource locked by ${currentLock.owner}. Added to queue.`, queuePosition: waitingQueue.length });
  }

  // Grant lock
  fencingTokenCounter++;
  currentLock = {
    resourceId: resourceId || "resource-db-row-42",
    owner: workerId,
    fencingToken: fencingTokenCounter,
    leaseTtlSec: ttlSec,
    expiresAt: Date.now() + ttlSec * 1000
  };

  logAudit("LOCK_ACQUIRED", `Worker ${workerId} acquired lock with fencing token #${fencingTokenCounter}`);
  res.json({ success: true, lock: currentLock });
});

app.post("/api/lock/renew", (req, res) => {
  const { workerId, fencingToken, extendSec = 10 } = req.body;

  if (currentLock && currentLock.owner === workerId && currentLock.fencingToken === Number(fencingToken)) {
    currentLock.expiresAt += extendSec * 1000;
    logAudit("LEASE_EXTENDED", `Worker ${workerId} extended lease by ${extendSec}s`);
    return res.json({ success: true, lock: currentLock });
  }

  res.status(403).json({ success: false, message: "Stale fencing token or expired lock. Lease renewal rejected." });
});

app.post("/api/lock/release", (req, res) => {
  const { workerId, fencingToken } = req.body;

  if (currentLock && currentLock.owner === workerId && currentLock.fencingToken === Number(fencingToken)) {
    logAudit("LOCK_RELEASED", `Worker ${workerId} released lock explicitly`);
    currentLock = null;

    if (waitingQueue.length > 0) {
      const nextWorker = waitingQueue.shift();
      fencingTokenCounter++;
      currentLock = {
        resourceId: "resource-db-row-42",
        owner: nextWorker.workerId,
        fencingToken: fencingTokenCounter,
        leaseTtlSec: 15,
        expiresAt: Date.now() + 15000
      };
      logAudit("LOCK_GRANTED_FROM_QUEUE", `Lock granted to queued worker ${nextWorker.workerId} with fencing token #${fencingTokenCounter}`);
    }

    return res.json({ success: true, message: "Lock released successfully" });
  }

  res.status(403).json({ success: false, message: "Cannot release lock: Invalid owner or stale fencing token" });
});

const PORT = process.env.PORT || 5011;
app.listen(PORT, () => {
  console.log(`Distributed Shared Memory Lock Manager running on port ${PORT}`);
});
