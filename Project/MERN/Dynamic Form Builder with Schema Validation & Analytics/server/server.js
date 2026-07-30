const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let forms = [];
let submissions = [];

app.post('/api/forms/create', (req, res) => {
  const { title, description, fields } = req.body;
  const form = {
    form_id: `FORM-${Math.floor(1000 + Math.random() * 9000)}`,
    title,
    description,
    fields,
    createdAt: new Date().toISOString()
  };
  forms.push(form);
  res.status(201).json({ success: true, form });
});

app.post('/api/forms/:form_id/submit', (req, res) => {
  const { responseData } = req.body;
  const submission = {
    submission_id: `SUB-${Date.now()}`,
    form_id: req.params.form_id,
    responseData,
    submittedAt: new Date().toISOString()
  };
  submissions.push(submission);
  res.status(201).json({ success: true, submission });
});

app.get('/api/forms/:form_id/analytics', (req, res) => {
  const formSubs = submissions.filter(s => s.form_id === req.params.form_id);
  res.json({
    success: true,
    totalSubmissions: formSubs.length,
    submissions: formSubs
  });
});

const PORT = process.env.PORT || 5005;
app.listen(PORT, () => {
  console.log(`Dynamic Form Builder Server running on port ${PORT}`);
});
