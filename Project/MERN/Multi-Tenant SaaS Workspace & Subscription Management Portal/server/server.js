const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let organizations = [
  { org_id: 'org_enterprise_01', name: 'Acme Corp', tier: 'ENTERPRISE', members: 42, role: 'Owner' },
  { org_id: 'org_startup_02', name: 'DevStudio Labs', tier: 'PRO_TIER', members: 5, role: 'Admin' }
];

app.get('/api/tenants', (req, res) => {
  res.json({ success: true, organizations });
});

app.post('/api/tenants/create', (req, res) => {
  const { name, tier } = req.body;
  const newOrg = {
    org_id: `org_${Math.floor(1000 + Math.random() * 9000)}`,
    name,
    tier,
    members: 1,
    role: 'Owner'
  };
  organizations.push(newOrg);
  res.status(201).json({ success: true, organization: newOrg });
});

const PORT = process.env.PORT || 5010;
app.listen(PORT, () => {
  console.log(`Multi-Tenant SaaS Portal Server running on port ${PORT}`);
});
