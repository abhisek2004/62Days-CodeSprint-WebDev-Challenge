const express = require('express');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(express.json());

let certificates = {};

app.post('/api/credentials/mint', (req, res) => {
  const { recipientName, courseName, issuer } = req.body;
  const certId = `CERT-${Math.floor(100000 + Math.random() * 900000)}`;
  const hash = crypto.createHash('sha256').update(`${certId}-${recipientName}-${courseName}`).digest('hex');

  certificates[certId] = {
    certId,
    recipientName,
    courseName,
    issuer,
    sha256Hash: hash,
    issuedAt: new Date().toISOString()
  };

  res.status(201).json({ success: true, certificate: certificates[certId] });
});

app.get('/api/credentials/verify/:certId', (req, res) => {
  const cert = certificates[req.params.certId];
  if (!cert) return res.status(404).json({ success: false, message: 'Tampered or Invalid Certificate' });
  res.json({ success: true, certificate: cert, verified: true });
});

const PORT = process.env.PORT || 5009;
app.listen(PORT, () => {
  console.log(`Blockchain Credentials Verification Server running on port ${PORT}`);
});
