const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let endpoints = [
  { id: 'ep_1', name: 'Authentication API', url: 'https://api.auth.service/health', status: 'HEALTHY', latency: 42, uptime: '99.98%' },
  { id: 'ep_2', name: 'Payment Gateway Node', url: 'https://pay.gateway.internal/ping', status: 'HEALTHY', latency: 85, uptime: '99.91%' },
  { id: 'ep_3', name: 'Database Primary Replica', url: 'https://db-node1.cluster:5432', status: 'DEGRADED', latency: 1240, uptime: '98.50%' }
];

app.get('/api/metrics/endpoints', (req, res) => {
  res.json({ success: true, endpoints });
});

app.post('/api/metrics/endpoints', (req, res) => {
  const { name, url } = req.body;
  const newEp = {
    id: `ep_${Date.now()}`,
    name,
    url,
    status: 'HEALTHY',
    latency: Math.floor(20 + Math.random() * 80),
    uptime: '100.0%'
  };
  endpoints.push(newEp);
  res.status(201).json({ success: true, endpoint: newEp });
});

const PORT = process.env.PORT || 5006;
app.listen(PORT, () => {
  console.log(`Infrastructure Health & Metrics Server running on port ${PORT}`);
});
