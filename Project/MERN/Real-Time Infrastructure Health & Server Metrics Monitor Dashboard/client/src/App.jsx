import React, { useState, useEffect } from 'react';

export default function App() {
  const [endpoints, setEndpoints] = useState([
    { id: 'ep_1', name: 'Authentication API', url: 'https://api.auth.service/health', status: 'HEALTHY', latency: 42, uptime: '99.98%' },
    { id: 'ep_2', name: 'Payment Gateway Node', url: 'https://pay.gateway.internal/ping', status: 'HEALTHY', latency: 85, uptime: '99.91%' },
    { id: 'ep_3', name: 'Database Primary Replica', url: 'https://db-node1.cluster:5432', status: 'DEGRADED', latency: 1240, uptime: '98.50%' }
  ]);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  // Simulate ping updates
  useEffect(() => {
    const interval = setInterval(() => {
      setEndpoints(prev => prev.map(ep => ({
        ...ep,
        latency: Math.max(15, Math.floor(ep.latency + (Math.random() * 40 - 20)))
      })));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleAddEndpoint = (e) => {
    e.preventDefault();
    if (!name || !url) return;
    setEndpoints([...endpoints, {
      id: `ep_${Date.now()}`,
      name, url, status: 'HEALTHY', latency: 35, uptime: '100%'
    }]);
    setName(''); setUrl('');
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '24px' }}>
      <header style={{ borderBottom: '1px solid #334155', pb: '16px', marginBottom: '24px' }}>
        <h2 style={{ color: '#10b981', margin: 0 }}>🖥️ Real-Time Infrastructure Health & Metrics Monitor</h2>
        <small style={{ color: '#94a3b8' }}>API Ping Latency Tracker & Outage Alerting Engine</small>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
        <div>
          <h3>Registered Endpoint Monitors ({endpoints.length})</h3>
          <div style={{ display: 'grid', gap: '16px', marginTop: '12px' }}>
            {endpoints.map(ep => (
              <div key={ep.id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: '0 0 4px', color: '#38bdf8' }}>{ep.name}</h4>
                  <code style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{ep.url}</code>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', background: ep.status === 'HEALTHY' ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)', color: ep.status === 'HEALTHY' ? '#10b981' : '#ef4444' }}>
                    {ep.status}
                  </span>
                  <div style={{ marginTop: '6px', fontSize: '0.9rem' }}>
                    Latency: <strong>{ep.latency} ms</strong> | Uptime: <strong>{ep.uptime}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
          <h3>Register Target Endpoint</h3>
          <form onSubmit={handleAddEndpoint}>
            <div style={{ margin: '14px 0' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px' }}>Service Name:</label>
              <input type="text" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. User Profile API" style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} />
            </div>
            <div style={{ margin: '14px 0' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px' }}>Endpoint URL:</label>
              <input type="url" required value={url} onChange={e => setUrl(e.target.value)} placeholder="https://api.domain.com/health" style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} />
            </div>
            <button type="submit" style={{ width: '100%', background: '#10b981', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
              + Add Health Check Target
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
