const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/resume/parse-and-match', (req, res) => {
  const { resumeText, targetJobDescription } = req.body;

  const requiredSkills = ['React', 'Node.js', 'TypeScript', 'Docker', 'GraphQL', 'MongoDB', 'AWS', 'Jest'];
  const extractedSkills = requiredSkills.filter(skill => 
    new RegExp(`\\b${skill}\\b`, 'i').test(resumeText)
  );

  const missingSkills = requiredSkills.filter(skill => !extractedSkills.includes(skill));
  const matchPercentage = Math.round((extractedSkills.length / requiredSkills.length) * 100);

  res.json({
    success: true,
    analysis: {
      matchPercentage,
      extractedSkills,
      missingSkills,
      recommendations: missingSkills.map(skill => `Complete hands-on projects in ${skill} to pass target ATS filters.`)
    }
  });
});

const PORT = process.env.PORT || 5007;
app.listen(PORT, () => {
  console.log(`Smart Resume Parser & Skill Gap Analyzer Server running on port ${PORT}`);
});
