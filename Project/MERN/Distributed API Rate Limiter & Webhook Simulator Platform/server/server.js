const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let webhooks = [];

app.post('/api/webhooks/incoming', (req, res) => {
  const payload = {
    webhook_id: `WH-${Math.floor(100000 + Math.random() * 900000)}`,
    headers: req.headers,
    body: req.body,
    receivedAt: new Date().toISOString()
  };
  webhooks.unshift(payload);
  res.status(200).json({ success: true, message: 'Webhook event received and logged', webhook_id: payload.webhook_id });
});

app.get('/api/webhooks', (req, res) => {
  res.json({ success: true, webhooks });
});

const PORT = process.env.PORT || 5011;
app.listen(PORT, () => {
  console.log(`Rate Limiter & Webhook Simulator Server running on port ${PORT}`);
});
