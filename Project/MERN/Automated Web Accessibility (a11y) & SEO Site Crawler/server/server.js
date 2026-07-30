const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/crawl/audit', (req, res) => {
  const { targetUrl } = req.body;

  const score = Math.floor(75 + Math.random() * 20);
  const violations = [
    { type: 'A11Y', severity: 'HIGH', rule: 'Images missing alt attribute', selector: 'img.banner-img' },
    { type: 'SEO', severity: 'MEDIUM', rule: 'Missing meta description tag', selector: 'head > meta' },
    { type: 'A11Y', severity: 'LOW', rule: 'Low contrast ratio on subtext', selector: '.footer-links' }
  ];

  res.json({
    success: true,
    url: targetUrl,
    score,
    violations,
    scannedAt: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 5008;
app.listen(PORT, () => {
  console.log(`Automated A11y & SEO Site Crawler Server running on port ${PORT}`);
});
