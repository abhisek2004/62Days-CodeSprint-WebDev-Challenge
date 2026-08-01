const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

let webhookSubscriptions = [
  { id: "sub_101", targetUrl: "https://api.merchant.com/webhooks", secret: "whsec_99a81b7c2e4f", active: true }
];

let deliveryLogs = [];
let deadLetterQueue = [];

app.get("/api/webhooks/subscriptions", (req, res) => {
  res.json({ success: true, subscriptions: webhookSubscriptions, dlq: deadLetterQueue, logs: deliveryLogs });
});

app.post("/api/webhooks/dispatch", (req, res) => {
  const { eventType, payload, simulateFailure } = req.body;
  const sub = webhookSubscriptions[0];
  const bodyStr = JSON.stringify(payload || { event: eventType, timestamp: new Date().toISOString() });

  // Generate HMAC SHA-256 signature header
  const signature = crypto.createHmac("sha256", sub.secret).update(bodyStr).digest("hex");

  if (simulateFailure) {
    // Add to Dead Letter Queue (DLQ)
    const dlqItem = {
      id: `dlq_${Math.floor(Math.random() * 9000 + 1000)}`,
      targetUrl: sub.targetUrl,
      eventType,
      payload,
      attemptsCount: 3,
      failedAt: new Date().toISOString(),
      reason: "504 Gateway Timeout (Endpoint Unreachable)"
    };
    deadLetterQueue.unshift(dlqItem);

    deliveryLogs.unshift({
      timestamp: new Date().toISOString(),
      status: 504,
      targetUrl: sub.targetUrl,
      eventType,
      signature: `sha256=${signature.substring(0, 16)}...`,
      result: "FAILED ➔ Sent to Dead-Letter Queue (DLQ)"
    });

    return res.status(502).json({ success: false, message: "Webhook dispatch failed. Moved to DLQ.", dlqItem });
  }

  // Success
  deliveryLogs.unshift({
    timestamp: new Date().toISOString(),
    status: 200,
    targetUrl: sub.targetUrl,
    eventType,
    signature: `sha256=${signature.substring(0, 16)}...`,
    result: "200 OK (Verified Signature)"
  });

  res.json({
    success: true,
    message: "Webhook delivered & verified",
    signatureHeader: `X-Signature: sha256=${signature}`
  });
});

app.post("/api/webhooks/dlq/replay", (req, res) => {
  const { dlqId } = req.body;
  const itemIdx = deadLetterQueue.findIndex(d => d.id === dlqId);

  if (itemIdx !== -1) {
    const item = deadLetterQueue.splice(itemIdx, 1)[0];
    deliveryLogs.unshift({
      timestamp: new Date().toISOString(),
      status: 200,
      targetUrl: item.targetUrl,
      eventType: item.eventType,
      signature: `sha256=replayed_valid_sig`,
      result: `REPLAY SUCCESSFUL (Manual DLQ Retry for ${item.id})`
    });
    return res.json({ success: true, message: `Replayed DLQ webhook ${dlqId} successfully.` });
  }

  res.status(404).json({ success: false, message: "DLQ item not found" });
});

const PORT = process.env.PORT || 5012;
app.listen(PORT, () => {
  console.log(`Webhook Relay Gateway running on port ${PORT}`);
});
