import React, { useState } from 'react';

export default function App() {
  const [resumeText, setResumeText] = useState('Senior Full Stack Developer with 4+ years experience in React, Node.js, MongoDB, and AWS cloud deployment.');
  const [targetJob, setTargetJob] = useState('Senior Lead Engineer requiring React, TypeScript, Docker, GraphQL, Node.js, and Jest testing.');
  const [analysis, setAnalysis] = useState(null);

  const handleAnalyze = () => {
    const required = ['React', 'Node.js', 'TypeScript', 'Docker', 'GraphQL', 'MongoDB', 'AWS', 'Jest'];
    const extracted = required.filter(s => new RegExp(`\\b${s}\\b`, 'i').test(resumeText));
    const missing = required.filter(s => !extracted.includes(s));
    const matchPercentage = Math.round((extracted.length / required.length) * 100);

    setAnalysis({
      matchPercentage,
      extracted,
      missing,
      recommendations: missing.map(m => `Add targeted projects or certifications showcasing ${m}.`)
    });
  };

  return (
    <div style={{ fontFamily: 'Segoe UI, sans-serif', background: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '24px' }}>
      <header style={{ borderBottom: '1px solid #334155', pb: '16px', marginBottom: '24px' }}>
        <h2 style={{ color: '#8b5cf6', margin: 0 }}>📄 Smart Resume Parser & AI Skill Gap Analyzer</h2>
        <small style={{ color: '#94a3b8' }}>ATS Resume Matcher & Targeted Skill Recommendation Engine</small>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
          <h3>1. Paste Candidate Resume Text</h3>
          <textarea
            rows="6"
            value={resumeText}
            onChange={e => setResumeText(e.target.value)}
            style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '10px', borderRadius: '8px', marginBottom: '16px', boxSizing: 'border-box' }}
          />

          <h3>2. Paste Target Job Description</h3>
          <textarea
            rows="5"
            value={targetJob}
            onChange={e => setTargetJob(e.target.value)}
            style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '10px', borderRadius: '8px', marginBottom: '16px', boxSizing: 'border-box' }}
          />

          <button onClick={handleAnalyze} style={{ width: '100%', background: '#8b5cf6', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
            🔍 Analyze Skill Gap & ATS Match Score
          </button>
        </div>

        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
          <h3>3. Skill Breakdown & Recommendations</h3>
          {!analysis ? (
            <p style={{ color: '#94a3b8' }}>Click Analyze to calculate ATS match score and missing tech stack keywords.</p>
          ) : (
            <div>
              <div style={{ textAlign: 'center', margin: '20px 0', background: '#0f172a', padding: '16px', borderRadius: '12px', border: '1px solid #334155' }}>
                <span style={{ fontSize: '2.5rem', fontWeight: 'bold', color: analysis.matchPercentage > 70 ? '#10b981' : '#f97316' }}>
                  {analysis.matchPercentage}%
                </span>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Estimated ATS Match Rating</div>
              </div>

              <h4>✅ Matched Candidate Skills:</h4>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {analysis.extracted.map(s => (
                  <span key={s} style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '4px 10px', borderRadius: '16px', fontSize: '0.85rem' }}>{s}</span>
                ))}
              </div>

              <h4>⚠️ Missing Keyword Skill Gaps:</h4>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {analysis.missing.map(s => (
                  <span key={s} style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', padding: '4px 10px', borderRadius: '16px', fontSize: '0.85rem' }}>{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
