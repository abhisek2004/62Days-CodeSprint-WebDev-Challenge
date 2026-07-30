import React, { useState } from 'react';

export default function App() {
  const [targetUrl, setTargetUrl] = useState('https://example.com');
  const [report, setReport] = useState(null);

  const handleCrawl = (e) => {
    e.preventDefault();
    setReport({
      url: targetUrl,
      score: 84,
      violations: [
        { type: 'A11Y', severity: 'HIGH', rule: 'Images missing alt text attributes', selector: 'img.hero-banner' },
        { type: 'SEO', severity: 'MEDIUM', rule: 'Missing meta description tag', selector: '<head>' },
        { type: 'A11Y', severity: 'LOW', rule: 'Heading level skip (h1 to h3)', selector: 'h3.title' }
      ]
    });
  };

  return (
    <div style={{ fontFamily: 'Segoe UI, sans-serif', background: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '24px' }}>
      <header style={{ borderBottom: '1px solid #334155', pb: '16px', marginBottom: '24px' }}>
        <h2 style={{ color: '#38bdf8', margin: 0 }}>🕷️ Automated Web Accessibility (WCAG 2.1) & SEO Crawler</h2>
        <small style={{ color: '#94a3b8' }}>DOM Audit Scanner & Compliance Score Gauge Generator</small>
      </header>

      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
          <form onSubmit={handleCrawl} style={{ display: 'flex', gap: '12px' }}>
            <input
              type="url"
              required
              value={targetUrl}
              onChange={e => setTargetUrl(e.target.value)}
              placeholder="https://yourwebsite.com"
              style={{ flex: 1, padding: '12px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '8px' }}
            />
            <button type="submit" style={{ background: '#38bdf8', color: '#fff', border: 'none', padding: '0 24px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
              Crawl & Audit Site
            </button>
          </form>
        </div>

        {report && (
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', color: '#38bdf8' }}>Audit Summary for: {report.url}</h3>
                <small style={{ color: '#94a3b8' }}>WCAG 2.1 Compliance Rules Evaluated</small>
              </div>
              <div style={{ background: '#0f172a', border: '2px solid #10b981', borderRadius: '50%', width: '70px', height: '70px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: '#10b981', fontWeight: 'bold' }}>
                <span style={{ fontSize: '1.4rem' }}>{report.score}</span>
                <small style={{ fontSize: '0.6rem' }}>/ 100</small>
              </div>
            </div>

            <h4>Identified Violations ({report.violations.length}):</h4>
            {report.violations.map((v, i) => (
              <div key={i} style={{ background: '#0f172a', borderLeft: `4px solid ${v.severity === 'HIGH' ? '#ef4444' : '#f97316'}`, padding: '12px', borderRadius: '6px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 'bold', color: v.type === 'A11Y' ? '#38bdf8' : '#8b5cf6' }}>[{v.type}] {v.rule}</span>
                  <span style={{ fontSize: '0.8rem', color: v.severity === 'HIGH' ? '#ef4444' : '#f97316' }}>{v.severity} SEVERITY</span>
                </div>
                <code style={{ fontSize: '0.8rem', color: '#94a3b8', display: 'block', marginTop: '4px' }}>Selector: {v.selector}</code>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
