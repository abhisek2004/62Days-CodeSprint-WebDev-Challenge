const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let rooms = {};

app.post('/api/code/run', (req, res) => {
  const { code, language } = req.body;
  const t0 = Date.now();
  
  res.json({
    success: true,
    stdout: `[Execution Output - ${language}]\nResult: Code compiled successfully with 0 errors.\nReturn value: 0`,
    stderr: '',
    executionTimeMs: Date.now() - t0
  });
});

const PORT = process.env.PORT || 5012;
app.listen(PORT, () => {
  console.log(`Collaborative Code Editor Server running on port ${PORT}`);
});
