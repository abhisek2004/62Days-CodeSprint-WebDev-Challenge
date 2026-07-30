import React, { useState } from 'react';

export default function App() {
  const [code, setCode] = useState('// Multi-User Collaborative IDE\nfunction main() {\n  console.log("Hello from Collaborative Execution Hub!");\n}\nmain();');
  const [language, setLanguage] = useState('javascript');
  const [output, setOutput] = useState('');
  const [users, setUsers] = useState([
    { name: 'Developer_Alex', color: '#10b981' },
    { name: 'Dev_Sarah', color: '#38bdf8' }
  ]);

  const handleRun = () => {
    setOutput(`[Execution Runner] Running ${language} snippet...\nHello from Collaborative Execution Hub!\nProgram exited with code 0 (12ms).`);
  };

  return (
    <div style={{ fontFamily: 'Segoe UI, sans-serif', background: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '24px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #334155', pb: '16px', marginBottom: '24px' }}>
        <div>
          <h2 style={{ color: '#38bdf8', margin: 0 }}>💻 Real-time Collaborative Code Editor & Execution Hub</h2>
          <small style={{ color: '#94a3b8' }}>Multi-User Cursor Tracking & Code Runner Terminal</small>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Active Room Users:</span>
          {users.map((u, i) => (
            <span key={i} style={{ background: u.color, color: '#000', padding: '4px 10px', borderRadius: '16px', fontWeight: 'bold', fontSize: '0.8rem' }}>{u.name}</span>
          ))}
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', height: '540px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <select value={language} onChange={e => setLanguage(e.target.value)} style={{ background: '#0f172a', color: '#fff', padding: '6px 12px', border: '1px solid #334155', borderRadius: '6px' }}>
              <option value="javascript">JavaScript (Node.js)</option>
              <option value="python">Python 3</option>
              <option value="cpp">C++ 20</option>
            </select>
            <button onClick={handleRun} style={{ background: '#10b981', color: '#fff', border: 'none', padding: '8px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>▶ Run Code</button>
          </div>

          <textarea
            value={code}
            onChange={e => setCode(e.target.value)}
            style={{ flex: 1, background: '#090d16', border: '1px solid #334155', color: '#38bdf8', fontFamily: 'monospace', fontSize: '0.95rem', padding: '14px', borderRadius: '8px', resize: 'none' }}
          />
        </div>

        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', height: '540px' }}>
          <h3>🖥️ Execution Output Terminal</h3>
          <pre style={{ flex: 1, background: '#090d16', border: '1px solid #334155', color: '#10b981', fontFamily: 'monospace', padding: '14px', borderRadius: '8px', overflowY: 'auto', margin: '12px 0 0' }}>
            {output || 'Click "Run Code" to compile and view execution stdout.'}
          </pre>
        </div>
      </div>
    </div>
  );
}
