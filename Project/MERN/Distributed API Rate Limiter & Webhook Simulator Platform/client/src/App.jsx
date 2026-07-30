import React, { useState } from 'react';

export default function App() {
  const [logs, setLogs] = useState([]);
  const [algo, setAlgo] = useState('Token Bucket');
  const [payloadText, setPayloadText] = useState('{\n  "event": "payment.succeeded",\n  "amount": 9900,\n  "currency": "USD"\n}');

  const handleSimulateSend = () => {
    const newLog = {
      id: `WH-${Math.floor(100000 + Math.random() * 900000)}`,
      time: new Date().toLocaleTimeString(),
      algo,
      status: Math.random() > 0.2 ? '200 OK (Delivered)' : '429 Rate Limited (Sliding Window)',
      payload: JSON.parse(payloadText || '{}')
    };
    setLogs([newLog, ...logs]);
  };

  return (
    <div style={{ fontFamily: 'Segoe UI, sans-serif', background: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '24px' }}>
      <header style={{ borderBottom: '1px solid #334155', pb: '16px', marginBottom: '24px' }}>
        <h2 style={{ color: '#8b5cf6', margin: 0 }}>⚡ Distributed API Rate Limiter & Webhook Simulator Platform</h2>
        <small style={{ color: '#94a3b8' }}>Token Bucket & Sliding Window Counter Algorithm Sandbox</small>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
          <h3>Webhook Simulator & Rate Limiting Strategy</h3>
          <div style={{ margin: '14px 0' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px' }}>Algorithm Strategy:</label>
            <select value={algo} onChange={e => setAlgo(e.target.value)} style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}>
              <option value="Token Bucket">Token Bucket Algorithm</option>
              <option value="Leaky Bucket">Leaky Bucket Algorithm</option>
              <option value="Sliding Window">Sliding Window Counter</option>
            </select>
          </div>

          <div style={{ margin: '14px 0' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px' }}>Simulated Event Payload (JSON):</label>
            <textarea
              rows="6"
              value={payloadText}
              onChange={e => setPayloadText(e.target.value)}
              style={{ width: '100%', background: '#0f172a', border: '1px solid #334155', color: '#10b981', fontFamily: 'monospace', padding: '10px', borderRadius: '6px', boxSizing: 'border-box' }}
            />
          </div>

          <button onClick={handleSimulateSend} style={{ width: '100%', background: '#8b5cf6', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
            🚀 Dispatch Webhook Event Payload
          </button>
        </div>

        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
          <h3>Incoming Webhook Payload Logger ({logs.length})</h3>
          <div style={{ height: '420px', overflowY: 'auto' }}>
            {logs.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>No webhook events logged. Click Dispatch Webhook to trigger payload delivery.</p>
            ) : (
              logs.map(log => (
                <div key={log.id} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '12px', marginBottom: '12px', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#38bdf8' }}>
                    <strong>{log.id}</strong>
                    <span>{log.time}</span>
                  </div>
                  <div style={{ color: log.status.includes('200') ? '#10b981' : '#ef4444', margin: '4px 0' }}>{log.status} ({log.algo})</div>
                  <pre style={{ background: '#090d16', padding: '8px', borderRadius: '4px', color: '#10b981', margin: '6px 0 0' }}>{JSON.stringify(log.payload, null, 2)}</pre>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
