import React, { useState, useEffect, useCallback, useRef } from 'react';

// Default Server URL
const DEFAULT_SERVER = 'http://localhost:5000';

export default function App() {
  // Navigation & Server state
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER);
  const [isOnline, setIsOnline] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // Gateway state
  const [metrics, setMetrics] = useState({
    summary: { totalRequests: 0, allowedRequests: 0, blockedRequests: 0, unauthorizedRequests: 0, successRatePct: 100, avgLatencyMs: 0 },
    statusCounts: { 200: 0, 429: 0, 401: 0, 500: 0 },
    endpointCounts: {},
    keyCounts: {}
  });
  const [logs, setLogs] = useState([]);
  const [keys, setKeys] = useState([]);
  const [routes, setRoutes] = useState([]);

  // Filters & Modal States
  const [logFilter, setLogFilter] = useState('ALL');
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [newKeyModal, setNewKeyModal] = useState(false);
  const [newKeyForm, setNewKeyForm] = useState({ name: '', tier: 'Free' });
  const [copiedKey, setCopiedKey] = useState(null);

  // Simulator State
  const [simConfig, setSimConfig] = useState({
    apiKey: '',
    targetRoute: '/api/v1/users',
    count: 20,
    delayMs: 20
  });
  const [simRunning, setSimRunning] = useState(false);
  const [simResults, setSimResults] = useState(null);

  // Algorithm Sandbox State
  const [sbAlgo, setSbAlgo] = useState('Token Bucket');
  const [sbCapacity, setSbCapacity] = useState(10);
  const [sbRefillRate, setSbRefillRate] = useState(2);
  const [sbTokens, setSbTokens] = useState(10);
  const [sbLogs, setSbLogs] = useState([]);
  const [sbTimestamps, setSbTimestamps] = useState([]);
  const [sbWindowSec, setSbWindowSec] = useState(10);
  const [sbWindowLimit, setSbWindowLimit] = useState(5);
  const [sbFixedCount, setSbFixedCount] = useState(0);
  const [sbFixedTimeLeft, setSbFixedTimeLeft] = useState(10);

  // Fetch metrics & gateway data
  const fetchData = useCallback(async () => {
    try {
      // Health check
      const healthRes = await fetch(`${serverUrl}/api/gateway/health`).catch(() => null);
      if (!healthRes || !healthRes.ok) {
        setIsOnline(false);
        return;
      }
      setIsOnline(true);

      // Metrics
      const mRes = await fetch(`${serverUrl}/api/gateway/metrics`);
      if (mRes.ok) {
        const mData = await mRes.json();
        setMetrics(mData);
      }

      // Logs
      const lRes = await fetch(`${serverUrl}/api/gateway/logs?limit=80`);
      if (lRes.ok) {
        const lData = await lRes.json();
        setLogs(lData.logs || []);
      }

      // Keys
      const kRes = await fetch(`${serverUrl}/api/gateway/keys`);
      if (kRes.ok) {
        const kData = await kRes.json();
        setKeys(kData);
        if (!simConfig.apiKey && kData.length > 0) {
          setSimConfig(prev => ({ ...prev, apiKey: kData[0].key }));
        }
      }

      // Routes
      const rRes = await fetch(`${serverUrl}/api/gateway/routes`);
      if (rRes.ok) {
        const rData = await rRes.json();
        setRoutes(rData);
      }

      setLastRefreshed(new Date().toLocaleTimeString());
    } catch (err) {
      console.error('Error fetching gateway data:', err);
      setIsOnline(false);
    }
  }, [serverUrl, simConfig.apiKey]);

  // Periodic polling
  useEffect(() => {
    fetchData();
    let interval = null;
    if (autoRefresh) {
      interval = setInterval(fetchData, 2000);
    }
    return () => clearInterval(interval);
  }, [fetchData, autoRefresh]);

  // Sandbox Token Bucket Refill Loop
  useEffect(() => {
    const timer = setInterval(() => {
      setSbTokens(prev => Math.min(sbCapacity, prev + sbRefillRate * 0.1));

      // Fixed window countdown
      setSbFixedTimeLeft(prev => {
        if (prev <= 1) {
          setSbFixedCount(0);
          return sbWindowSec;
        }
        return prev - 1;
      });

      // Sliding window cleanup
      const now = Date.now();
      setSbTimestamps(prev => prev.filter(ts => now - ts < sbWindowSec * 1000));
    }, 100);

    return () => clearInterval(timer);
  }, [sbCapacity, sbRefillRate, sbWindowSec]);

  // Sandbox Request Trigger
  const triggerSandboxRequest = () => {
    const now = Date.now();
    let allowed = false;
    let msg = '';

    if (sbAlgo === 'Token Bucket') {
      if (sbTokens >= 1) {
        setSbTokens(prev => Math.max(0, prev - 1));
        allowed = true;
        msg = `Token consumed. ${Math.floor(sbTokens - 1)} tokens remaining.`;
      } else {
        allowed = false;
        msg = `HTTP 429: Token bucket empty! Refilling at ${sbRefillRate} tok/sec.`;
      }
    } else if (sbAlgo === 'Sliding Window') {
      const activeWindowTs = sbTimestamps.filter(ts => now - ts < sbWindowSec * 1000);
      if (activeWindowTs.length < sbWindowLimit) {
        setSbTimestamps(prev => [...prev, now]);
        allowed = true;
        msg = `Request logged in window. Count: ${activeWindowTs.length + 1}/${sbWindowLimit}`;
      } else {
        allowed = false;
        msg = `HTTP 429: Window limit reached (${sbWindowLimit} reqs / ${sbWindowSec}s).`;
      }
    } else {
      // Fixed Window
      if (sbFixedCount < sbWindowLimit) {
        setSbFixedCount(prev => prev + 1);
        allowed = true;
        msg = `Request counted in fixed frame. Count: ${sbFixedCount + 1}/${sbWindowLimit}`;
      } else {
        allowed = false;
        msg = `HTTP 429: Fixed window full! Resets in ${sbFixedTimeLeft}s.`;
      }
    }

    setSbLogs(prev => [
      { id: Date.now(), time: new Date().toLocaleTimeString(), allowed, msg, algo: sbAlgo },
      ...prev.slice(0, 25)
    ]);
  };

  // Create Key Handler
  const handleCreateKey = async (e) => {
    e.preventDefault();
    if (!newKeyForm.name.trim()) return;

    try {
      const res = await fetch(`${serverUrl}/api/gateway/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newKeyForm)
      });
      if (res.ok) {
        setNewKeyForm({ name: '', tier: 'Free' });
        setNewKeyModal(false);
        fetchData();
      }
    } catch (err) {
      alert('Failed to generate key: ' + err.message);
    }
  };

  // Toggle Key Status
  const toggleKeyActive = async (keyObj) => {
    try {
      await fetch(`${serverUrl}/api/gateway/keys/${keyObj.key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !keyObj.active })
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Revoke Key
  const handleRevokeKey = async (keyStr) => {
    if (!window.confirm(`Revoke and delete API Key '${keyStr}'?`)) return;
    try {
      await fetch(`${serverUrl}/api/gateway/keys/${keyStr}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Update Route Policy
  const handleSaveRoutePolicy = async (e) => {
    e.preventDefault();
    if (!selectedRoute) return;

    try {
      const res = await fetch(`${serverUrl}/api/gateway/routes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(selectedRoute)
      });
      if (res.ok) {
        setSelectedRoute(null);
        fetchData();
      }
    } catch (err) {
      alert('Failed to update route policy');
    }
  };

  // Reset Metrics
  const handleResetMetrics = async () => {
    if (!window.confirm('Reset all gateway analytics counters and request logs?')) return;
    try {
      await fetch(`${serverUrl}/api/gateway/reset-metrics`, { method: 'POST' });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Launch Traffic Burst Simulator
  const handleRunSimulator = async () => {
    setSimRunning(true);
    setSimResults(null);

    try {
      const res = await fetch(`${serverUrl}/api/gateway/simulate-burst`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: simConfig.apiKey,
          path: simConfig.targetRoute,
          count: simConfig.count,
          delayBetweenMs: simConfig.delayMs
        })
      });

      if (res.ok) {
        const data = await res.json();
        setSimResults(data);
        fetchData();
      } else {
        alert('Simulator execution error');
      }
    } catch (err) {
      alert('Traffic burst simulation failed: ' + err.message);
    } finally {
      setSimRunning(false);
    }
  };

  // Copy Key to Clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(text);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Filtered Logs
  const filteredLogs = logs.filter(log => {
    if (logFilter === '200') return log.status === 200;
    if (logFilter === '429') return log.status === 429;
    if (logFilter === '401') return log.status === 401;
    return true;
  });

  return (
    <div className="app-container">
      {/* HEADER BAR */}
      <header className="header-nav">
        <div className="header-left">
          <div className="brand-logo">
            <span className="logo-icon">🛡️</span>
            <div>
              <h1 className="brand-title">AURA GATEWAY</h1>
              <p className="brand-subtitle">Distributed API Throttling & Token Bucket Rate Limiter</p>
            </div>
          </div>
        </div>

        <div className="header-center">
          <div className="server-selector">
            <span className="server-label">Backend:</span>
            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              className="server-input"
            />
            <span className={`status-badge ${isOnline ? 'online' : 'offline'}`}>
              <span className="pulse-dot"></span>
              {isOnline ? 'Active' : 'Offline'}
            </span>
          </div>
        </div>

        <div className="header-right">
          <button
            className={`btn-refresh ${autoRefresh ? 'active' : ''}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
            title="Auto refresh every 2 seconds"
          >
            {autoRefresh ? '⚡ Live Sync On' : '⏸️ Sync Paused'}
          </button>
          <span className="refresh-time">Refreshed: {lastRefreshed || '—'}</span>
        </div>
      </header>

      {/* NAVIGATION TABS */}
      <nav className="nav-tabs">
        <button
          className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          📊 Dashboard & Metrics
        </button>
        <button
          className={`tab-btn ${activeTab === 'routes' ? 'active' : ''}`}
          onClick={() => setActiveTab('routes')}
        >
          🎛️ Route Proxy Policies ({routes.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'apikeys' ? 'active' : ''}`}
          onClick={() => setActiveTab('apikeys')}
        >
          🔑 API Keys & Tiers ({keys.length})
        </button>
        <button
          className={`tab-btn ${activeTab === 'sandbox' ? 'active' : ''}`}
          onClick={() => setActiveTab('sandbox')}
        >
          🧪 Algorithm Sandbox
        </button>
        <button
          className={`tab-btn ${activeTab === 'simulator' ? 'active' : ''}`}
          onClick={() => setActiveTab('simulator')}
        >
          🚀 Traffic Burst Simulator
        </button>
      </nav>

      {/* MAIN CONTENT AREA */}
      <main className="main-content">
        {!isOnline && (
          <div className="warning-banner">
            ⚠️ Gateway Server is currently offline or unreachable at <code>{serverUrl}</code>. Make sure the Node server is running with <code>npm start</code> in the <code>server/</code> folder.
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 1: DASHBOARD & REAL-TIME METRICS */}
        {/* ==================================================== */}
        {activeTab === 'dashboard' && (
          <div className="tab-pane">
            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-header">
                  <span className="metric-title">Total Gateway Traffic</span>
                  <span className="metric-icon">🌐</span>
                </div>
                <div className="metric-value">{metrics.summary.totalRequests.toLocaleString()}</div>
                <div className="metric-footer">Lifetime gateway API requests</div>
              </div>

              <div className="metric-card success">
                <div className="metric-header">
                  <span className="metric-title">Allowed Requests (200 OK)</span>
                  <span className="metric-icon">✅</span>
                </div>
                <div className="metric-value">{metrics.summary.allowedRequests.toLocaleString()}</div>
                <div className="metric-footer text-emerald">
                  {metrics.summary.successRatePct}% Success Rate
                </div>
              </div>

              <div className="metric-card warning">
                <div className="metric-header">
                  <span className="metric-title">Throttled Requests (429)</span>
                  <span className="metric-icon">🚨</span>
                </div>
                <div className="metric-value">{metrics.summary.blockedRequests.toLocaleString()}</div>
                <div className="metric-footer text-rose">
                  {metrics.summary.totalRequests > 0
                    ? Math.round((metrics.summary.blockedRequests / metrics.summary.totalRequests) * 100)
                    : 0}% Rate Limited
                </div>
              </div>

              <div className="metric-card info">
                <div className="metric-header">
                  <span className="metric-title">Avg Latency & Unauthorized</span>
                  <span className="metric-icon">⚡</span>
                </div>
                <div className="metric-value">{metrics.summary.avgLatencyMs} <span className="unit">ms</span></div>
                <div className="metric-footer text-cyan">
                  401 Errors: {metrics.summary.unauthorizedRequests}
                </div>
              </div>
            </div>

            {/* VISUAL CHARTS & BREAKDOWN */}
            <div className="charts-row">
              {/* Status Code Distribution */}
              <div className="card chart-card">
                <div className="card-header">
                  <h3>HTTP Response Status Distribution</h3>
                  <button className="btn-secondary sm" onClick={handleResetMetrics}>Reset Counters</button>
                </div>
                <div className="status-bars">
                  <div className="bar-group">
                    <div className="bar-info">
                      <span className="badge status-200">200 OK</span>
                      <span className="bar-count">{metrics.statusCounts[200] || 0} reqs</span>
                    </div>
                    <div className="bar-track">
                      <div
                        className="bar-fill bg-emerald"
                        style={{
                          width: `${metrics.summary.totalRequests ? ((metrics.statusCounts[200] || 0) / metrics.summary.totalRequests) * 100 : 0}%`
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="bar-group">
                    <div className="bar-info">
                      <span className="badge status-429">429 Rate Limited</span>
                      <span className="bar-count">{metrics.statusCounts[429] || 0} reqs</span>
                    </div>
                    <div className="bar-track">
                      <div
                        className="bar-fill bg-rose"
                        style={{
                          width: `${metrics.summary.totalRequests ? ((metrics.statusCounts[429] || 0) / metrics.summary.totalRequests) * 100 : 0}%`
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="bar-group">
                    <div className="bar-info">
                      <span className="badge status-401">401 Unauthorized</span>
                      <span className="bar-count">{metrics.statusCounts[401] || 0} reqs</span>
                    </div>
                    <div className="bar-track">
                      <div
                        className="bar-fill bg-amber"
                        style={{
                          width: `${metrics.summary.totalRequests ? ((metrics.statusCounts[401] || 0) / metrics.summary.totalRequests) * 100 : 0}%`
                        }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Endpoint Breakdown */}
              <div className="card chart-card">
                <div className="card-header">
                  <h3>Per-Route Endpoint Traffic Breakdown</h3>
                </div>
                <div className="route-usage-list">
                  {Object.keys(metrics.endpointCounts).length === 0 ? (
                    <div className="empty-state">No route traffic recorded yet. Run a test from Traffic Burst Simulator!</div>
                  ) : (
                    Object.entries(metrics.endpointCounts).map(([endpoint, count]) => (
                      <div key={endpoint} className="route-bar-item">
                        <div className="route-bar-label">
                          <code>{endpoint}</code>
                          <span>{count} reqs</span>
                        </div>
                        <div className="bar-track">
                          <div
                            className="bar-fill bg-cyan"
                            style={{
                              width: `${(count / (metrics.summary.totalRequests || 1)) * 100}%`
                            }}
                          ></div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* LIVE STREAM REQUEST LOGS */}
            <div className="card logs-card">
              <div className="card-header flex-between">
                <div>
                  <h3>Live Gateway Request Log Stream</h3>
                  <p className="card-sub">Real-time HTTP requests processed by rate limiter algorithms</p>
                </div>
                <div className="log-filters">
                  <span className="filter-label">Filter:</span>
                  <button
                    className={`filter-btn ${logFilter === 'ALL' ? 'active' : ''}`}
                    onClick={() => setLogFilter('ALL')}
                  >
                    All ({logs.length})
                  </button>
                  <button
                    className={`filter-btn ${logFilter === '200' ? 'active' : ''}`}
                    onClick={() => setLogFilter('200')}
                  >
                    200 OK
                  </button>
                  <button
                    className={`filter-btn ${logFilter === '429' ? 'active' : ''}`}
                    onClick={() => setLogFilter('429')}
                  >
                    429 Throttled
                  </button>
                  <button
                    className={`filter-btn ${logFilter === '401' ? 'active' : ''}`}
                    onClick={() => setLogFilter('401')}
                  >
                    401 Invalid
                  </button>
                </div>
              </div>

              <div className="table-responsive">
                <table className="logs-table">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Method & Path</th>
                      <th>Client / API Key</th>
                      <th>Tier</th>
                      <th>Status</th>
                      <th>Algorithm</th>
                      <th>Tokens Left</th>
                      <th>Latency</th>
                      <th>Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="text-center py-4 text-muted">
                          No request logs match the selected filter.
                        </td>
                      </tr>
                    ) : (
                      filteredLogs.map(log => (
                        <tr key={log.id} className={`log-row status-${log.status}`}>
                          <td className="font-mono text-xs">{new Date(log.timestamp).toLocaleTimeString()}</td>
                          <td>
                            <span className="method-tag">{log.method}</span>{' '}
                            <code className="path-tag">{log.path}</code>
                          </td>
                          <td>
                            <div className="client-name">{log.clientName || 'Anonymous'}</div>
                            <div className="key-sub font-mono">{log.apiKey}</div>
                          </td>
                          <td>
                            {log.tier ? (
                              <span className={`tier-badge ${log.tier.toLowerCase()}`}>{log.tier}</span>
                            ) : (
                              '—'
                            )}
                          </td>
                          <td>
                            <span className={`badge status-${log.status}`}>
                              {log.status === 200 ? '200 OK' : log.status === 429 ? '429 Rate Limit' : '401 Auth'}
                            </span>
                          </td>
                          <td><span className="algo-tag">{log.algorithm}</span></td>
                          <td className="font-mono">{log.remaining !== undefined ? log.remaining : '—'}</td>
                          <td className="font-mono">{log.latencyMs} ms</td>
                          <td className="text-sm text-secondary">{log.message}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 2: ROUTE PROXY POLICIES */}
        {/* ==================================================== */}
        {activeTab === 'routes' && (
          <div className="tab-pane">
            <div className="section-header">
              <h2>Gateway Route Proxy & Rate Limiting Policies</h2>
              <p>Configure custom throttling algorithms, capacity, refill rates, and window durations per API route.</p>
            </div>

            <div className="routes-grid">
              {routes.map(rt => (
                <div key={rt.path} className={`route-card ${!rt.enabled ? 'disabled' : ''}`}>
                  <div className="route-header">
                    <div>
                      <h3 className="route-name">{rt.name}</h3>
                      <code className="route-path">{rt.path}</code>
                    </div>
                    <span className={`status-pill ${rt.enabled ? 'active' : 'inactive'}`}>
                      {rt.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>

                  <div className="route-details">
                    <div className="detail-row">
                      <span className="detail-label">Algorithm:</span>
                      <span className="detail-val algo-highlight">{rt.algorithm}</span>
                    </div>

                    {rt.algorithm === 'Token Bucket' ? (
                      <>
                        <div className="detail-row">
                          <span className="detail-label">Max Token Capacity:</span>
                          <span className="detail-val">{rt.capacity} tokens</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Refill Rate:</span>
                          <span className="detail-val">{rt.refillRate} tokens / sec</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="detail-row">
                          <span className="detail-label">Max Requests:</span>
                          <span className="detail-val">{rt.maxRequests} reqs</span>
                        </div>
                        <div className="detail-row">
                          <span className="detail-label">Window Duration:</span>
                          <span className="detail-val">{rt.windowMs / 1000} seconds</span>
                        </div>
                      </>
                    )}

                    <div className="detail-row">
                      <span className="detail-label">Throttle Delay:</span>
                      <span className="detail-val">{rt.delayMs || 0} ms</span>
                    </div>
                  </div>

                  <div className="route-actions">
                    <button
                      className="btn-primary sm"
                      onClick={() => setSelectedRoute({ ...rt })}
                    >
                      ✏️ Edit Policy
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* EDIT ROUTE POLICY MODAL */}
            {selectedRoute && (
              <div className="modal-overlay">
                <div className="modal-content">
                  <div className="modal-header">
                    <h3>Configure Rate Limiting: {selectedRoute.path}</h3>
                    <button className="btn-close" onClick={() => setSelectedRoute(null)}>✕</button>
                  </div>

                  <form onSubmit={handleSaveRoutePolicy} className="modal-body">
                    <div className="form-group">
                      <label>Route Display Name</label>
                      <input
                        type="text"
                        value={selectedRoute.name}
                        onChange={(e) => setSelectedRoute({ ...selectedRoute, name: e.target.value })}
                        className="form-input"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Algorithm Selection</label>
                      <select
                        value={selectedRoute.algorithm}
                        onChange={(e) => setSelectedRoute({ ...selectedRoute, algorithm: e.target.value })}
                        className="form-select"
                      >
                        <option value="Token Bucket">Token Bucket (Continuous Refill)</option>
                        <option value="Sliding Window">Sliding Window Log (Precise Timestamps)</option>
                        <option value="Fixed Window">Fixed Window Counter (Time Frame Reset)</option>
                      </select>
                    </div>

                    {selectedRoute.algorithm === 'Token Bucket' ? (
                      <div className="form-row">
                        <div className="form-group col">
                          <label>Bucket Capacity (Tokens)</label>
                          <input
                            type="number"
                            min="1"
                            max="1000"
                            value={selectedRoute.capacity}
                            onChange={(e) => setSelectedRoute({ ...selectedRoute, capacity: Number(e.target.value) })}
                            className="form-input"
                          />
                        </div>
                        <div className="form-group col">
                          <label>Refill Rate (Tokens / Sec)</label>
                          <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            max="500"
                            value={selectedRoute.refillRate}
                            onChange={(e) => setSelectedRoute({ ...selectedRoute, refillRate: Number(e.target.value) })}
                            className="form-input"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="form-row">
                        <div className="form-group col">
                          <label>Max Requests per Window</label>
                          <input
                            type="number"
                            min="1"
                            max="1000"
                            value={selectedRoute.maxRequests}
                            onChange={(e) => setSelectedRoute({ ...selectedRoute, maxRequests: Number(e.target.value) })}
                            className="form-input"
                          />
                        </div>
                        <div className="form-group col">
                          <label>Window Duration (ms)</label>
                          <input
                            type="number"
                            min="1000"
                            step="1000"
                            value={selectedRoute.windowMs}
                            onChange={(e) => setSelectedRoute({ ...selectedRoute, windowMs: Number(e.target.value) })}
                            className="form-input"
                          />
                        </div>
                      </div>
                    )}

                    <div className="form-group">
                      <label>Artificial Latency Throttling Delay (ms)</label>
                      <input
                        type="number"
                        min="0"
                        max="5000"
                        value={selectedRoute.delayMs}
                        onChange={(e) => setSelectedRoute({ ...selectedRoute, delayMs: Number(e.target.value) })}
                        className="form-input"
                      />
                      <span className="help-text">Simulates server queue / backend processing latency</span>
                    </div>

                    <div className="form-group checkbox-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={selectedRoute.enabled}
                          onChange={(e) => setSelectedRoute({ ...selectedRoute, enabled: e.target.checked })}
                        />
                        <span>Enable Gateway Rate Limiting for this endpoint</span>
                      </label>
                    </div>

                    <div className="modal-footer">
                      <button type="button" className="btn-secondary" onClick={() => setSelectedRoute(null)}>
                        Cancel
                      </button>
                      <button type="submit" className="btn-primary">
                        Save Changes
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 3: API KEYS & QUOTA TIERS */}
        {/* ==================================================== */}
        {activeTab === 'apikeys' && (
          <div className="tab-pane">
            <div className="section-header flex-between">
              <div>
                <h2>API Key & Tier Quota Management</h2>
                <p>Manage authenticated API clients, tier allocations, and live token bucket states.</p>
              </div>
              <button className="btn-primary" onClick={() => setNewKeyModal(true)}>
                ➕ Generate New API Key
              </button>
            </div>

            <div className="keys-grid">
              {keys.map(k => (
                <div key={k.key} className={`key-card ${!k.active ? 'suspended' : ''}`}>
                  <div className="key-card-header">
                    <div>
                      <h3 className="key-client-name">{k.name}</h3>
                      <span className={`tier-badge ${k.tier.toLowerCase()}`}>{k.tier} Tier</span>
                    </div>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={k.active}
                        onChange={() => toggleKeyActive(k)}
                      />
                      <span className="slider round"></span>
                    </label>
                  </div>

                  <div className="key-box">
                    <span className="key-text font-mono">{k.key}</span>
                    <button
                      className="btn-copy"
                      onClick={() => copyToClipboard(k.key)}
                      title="Copy Key"
                    >
                      {copiedKey === k.key ? '✅ Copied' : '📋 Copy'}
                    </button>
                  </div>

                  <div className="key-stats">
                    <div className="key-stat-item">
                      <span className="stat-label">Current Available Tokens</span>
                      <span className="stat-val font-mono text-cyan">
                        {k.currentTokenBucket !== null ? `${k.currentTokenBucket} tok` : '—'}
                      </span>
                    </div>
                    <div className="key-stat-item">
                      <span className="stat-label">Requests Processed</span>
                      <span className="stat-val font-mono">{k.quotaUsed}</span>
                    </div>
                  </div>

                  <div className="key-card-footer">
                    <span className="created-at text-xs">Created: {new Date(k.createdAt).toLocaleDateString()}</span>
                    <button
                      className="btn-danger-outline sm"
                      onClick={() => handleRevokeKey(k.key)}
                    >
                      🗑️ Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* GENERATE KEY MODAL */}
            {newKeyModal && (
              <div className="modal-overlay">
                <div className="modal-content">
                  <div className="modal-header">
                    <h3>Generate New Gateway API Key</h3>
                    <button className="btn-close" onClick={() => setNewKeyModal(false)}>✕</button>
                  </div>

                  <form onSubmit={handleCreateKey} className="modal-body">
                    <div className="form-group">
                      <label>Client / Application Name</label>
                      <input
                        type="text"
                        placeholder="e.g., Mobile Android App / Billing Service"
                        value={newKeyForm.name}
                        onChange={(e) => setNewKeyForm({ ...newKeyForm, name: e.target.value })}
                        className="form-input"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label>Select Quota Tier</label>
                      <div className="tier-options">
                        <label className={`tier-option ${newKeyForm.tier === 'Free' ? 'selected' : ''}`}>
                          <input
                            type="radio"
                            name="tier"
                            value="Free"
                            checked={newKeyForm.tier === 'Free'}
                            onChange={(e) => setNewKeyForm({ ...newKeyForm, tier: e.target.value })}
                          />
                          <div className="tier-info">
                            <span className="tier-title">Free Tier</span>
                            <span className="tier-desc">15 Tokens capacity • 1 Token/sec refill</span>
                          </div>
                        </label>

                        <label className={`tier-option ${newKeyForm.tier === 'Pro' ? 'selected' : ''}`}>
                          <input
                            type="radio"
                            name="tier"
                            value="Pro"
                            checked={newKeyForm.tier === 'Pro'}
                            onChange={(e) => setNewKeyForm({ ...newKeyForm, tier: e.target.value })}
                          />
                          <div className="tier-info">
                            <span className="tier-title">Pro Tier</span>
                            <span className="tier-desc">60 Tokens capacity • 5 Tokens/sec refill</span>
                          </div>
                        </label>

                        <label className={`tier-option ${newKeyForm.tier === 'Enterprise' ? 'selected' : ''}`}>
                          <input
                            type="radio"
                            name="tier"
                            value="Enterprise"
                            checked={newKeyForm.tier === 'Enterprise'}
                            onChange={(e) => setNewKeyForm({ ...newKeyForm, tier: e.target.value })}
                          />
                          <div className="tier-info">
                            <span className="tier-title">Enterprise Tier</span>
                            <span className="tier-desc">250 Tokens capacity • 25 Tokens/sec refill</span>
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="modal-footer">
                      <button type="button" className="btn-secondary" onClick={() => setNewKeyModal(false)}>
                        Cancel
                      </button>
                      <button type="submit" className="btn-primary">
                        Generate Key
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 4: ALGORITHM SANDBOX */}
        {/* ==================================================== */}
        {activeTab === 'sandbox' && (
          <div className="tab-pane">
            <div className="section-header">
              <h2>Interactive Rate Limit Algorithm Sandbox</h2>
              <p>Visualize how Token Bucket continuous refill, Sliding Window logs, and Fixed Window counters handle request bursts.</p>
            </div>

            <div className="sandbox-layout">
              {/* CONTROL PANEL */}
              <div className="card sandbox-controls">
                <h3>Algorithm Configuration</h3>

                <div className="form-group">
                  <label>Selected Algorithm</label>
                  <select
                    value={sbAlgo}
                    onChange={(e) => setSbAlgo(e.target.value)}
                    className="form-select"
                  >
                    <option value="Token Bucket">Token Bucket</option>
                    <option value="Sliding Window">Sliding Window Log</option>
                    <option value="Fixed Window">Fixed Window Counter</option>
                  </select>
                </div>

                {sbAlgo === 'Token Bucket' && (
                  <>
                    <div className="form-group">
                      <label>Max Bucket Capacity: {sbCapacity} tokens</label>
                      <input
                        type="range"
                        min="2"
                        max="30"
                        value={sbCapacity}
                        onChange={(e) => {
                          setSbCapacity(Number(e.target.value));
                          setSbTokens(Number(e.target.value));
                        }}
                        className="form-range"
                      />
                    </div>

                    <div className="form-group">
                      <label>Refill Rate: {sbRefillRate} tokens / sec</label>
                      <input
                        type="range"
                        min="0.5"
                        max="10"
                        step="0.5"
                        value={sbRefillRate}
                        onChange={(e) => setSbRefillRate(Number(e.target.value))}
                        className="form-range"
                      />
                    </div>
                  </>
                )}

                {(sbAlgo === 'Sliding Window' || sbAlgo === 'Fixed Window') && (
                  <>
                    <div className="form-group">
                      <label>Window Duration: {sbWindowSec} seconds</label>
                      <input
                        type="range"
                        min="5"
                        max="30"
                        value={sbWindowSec}
                        onChange={(e) => setSbWindowSec(Number(e.target.value))}
                        className="form-range"
                      />
                    </div>

                    <div className="form-group">
                      <label>Window Limit: {sbWindowLimit} max requests</label>
                      <input
                        type="range"
                        min="2"
                        max="20"
                        value={sbWindowLimit}
                        onChange={(e) => setSbWindowLimit(Number(e.target.value))}
                        className="form-range"
                      />
                    </div>
                  </>
                )}

                <button className="btn-primary lg block" onClick={triggerSandboxRequest}>
                  ⚡ Send 1 Request
                </button>
              </div>

              {/* VISUALIZATION PANEL */}
              <div className="card sandbox-vis">
                <h3>Visual Simulation State: {sbAlgo}</h3>

                {sbAlgo === 'Token Bucket' && (
                  <div className="vis-token-bucket">
                    <div className="tank-container">
                      <div
                        className="tank-fill"
                        style={{ height: `${(sbTokens / sbCapacity) * 100}%` }}
                      >
                        <div className="water-wave"></div>
                      </div>
                      <div className="tank-overlay font-mono">
                        {Math.floor(sbTokens)} / {sbCapacity} Tokens Available
                      </div>
                    </div>
                    <div className="vis-metrics font-mono">
                      <span>Refilling: +{sbRefillRate} tok/s</span>
                      <span>Status: {sbTokens >= 1 ? 'Ready' : 'THROTTLED (Empty)'}</span>
                    </div>
                  </div>
                )}

                {sbAlgo === 'Sliding Window' && (
                  <div className="vis-sliding-window">
                    <div className="window-timeline font-mono">
                      <div className="timeline-header">
                        Active Log Timestamps in {sbWindowSec}s Window ({sbTimestamps.length} / {sbWindowLimit})
                      </div>
                      <div className="timeline-track">
                        {sbTimestamps.map((ts, idx) => (
                          <div key={idx} className="timestamp-dot" title={new Date(ts).toLocaleTimeString()}>
                            📍 {Math.round((Date.now() - ts) / 1000)}s ago
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {sbAlgo === 'Fixed Window' && (
                  <div className="vis-fixed-window">
                    <div className="fixed-clock font-mono">
                      <div className="clock-counter">
                        Count: {sbFixedCount} / {sbWindowLimit}
                      </div>
                      <div className="clock-timer text-cyan">
                        Window Resets in: {sbFixedTimeLeft}s
                      </div>
                    </div>
                  </div>
                )}

                {/* SANDBOX EVENT LOG */}
                <div className="sandbox-event-log font-mono">
                  <div className="event-log-title">Sandbox Execution Feed</div>
                  {sbLogs.length === 0 ? (
                    <div className="text-muted">Click "Send 1 Request" to test algorithm responses.</div>
                  ) : (
                    sbLogs.map(log => (
                      <div key={log.id} className={`event-item ${log.allowed ? 'allowed' : 'rejected'}`}>
                        <span className="event-time">[{log.time}]</span>{' '}
                        <span className="event-algo">[{log.algo}]</span>{' '}
                        <span className="event-msg">{log.msg}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* TAB 5: TRAFFIC BURST SIMULATOR */}
        {/* ==================================================== */}
        {activeTab === 'simulator' && (
          <div className="tab-pane">
            <div className="section-header">
              <h2>Interactive Traffic Burst Simulator</h2>
              <p>Simulate high-concurrency client requests to test distributed rate limiting under heavy load.</p>
            </div>

            <div className="simulator-card card">
              <div className="sim-controls-grid">
                <div className="form-group">
                  <label>Select API Key Client</label>
                  <select
                    value={simConfig.apiKey}
                    onChange={(e) => setSimConfig({ ...simConfig, apiKey: e.target.value })}
                    className="form-select"
                  >
                    {keys.map(k => (
                      <option key={k.key} value={k.key}>
                        {k.name} ({k.tier} Tier) - {k.key}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Target API Endpoint</label>
                  <select
                    value={simConfig.targetRoute}
                    onChange={(e) => setSimConfig({ ...simConfig, targetRoute: e.target.value })}
                    className="form-select"
                  >
                    {routes.map(r => (
                      <option key={r.path} value={r.path}>
                        {r.path} ({r.name} - {r.algorithm})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label>Burst Request Count: {simConfig.count} reqs</label>
                  <input
                    type="range"
                    min="5"
                    max="100"
                    step="5"
                    value={simConfig.count}
                    onChange={(e) => setSimConfig({ ...simConfig, count: Number(e.target.value) })}
                    className="form-range"
                  />
                </div>

                <div className="form-group">
                  <label>Delay Between Reqs: {simConfig.delayMs} ms</label>
                  <input
                    type="range"
                    min="0"
                    max="200"
                    step="10"
                    value={simConfig.delayMs}
                    onChange={(e) => setSimConfig({ ...simConfig, delayMs: Number(e.target.value) })}
                    className="form-range"
                  />
                </div>
              </div>

              <button
                className="btn-primary lg block mt-4"
                onClick={handleRunSimulator}
                disabled={simRunning || !isOnline}
              >
                {simRunning ? '🚀 Executing Traffic Burst...' : '🚀 LAUNCH TRAFFIC BURST'}
              </button>

              {/* SIMULATION RESULTS */}
              {simResults && (
                <div className="sim-results-section mt-6">
                  <div className="sim-summary-row">
                    <div className="sim-stat">
                      <span className="stat-label">Total Fired</span>
                      <span className="stat-num">{simResults.totalSimulated}</span>
                    </div>
                    <div className="sim-stat text-emerald">
                      <span className="stat-label">Passed (200 OK)</span>
                      <span className="stat-num">{simResults.passed}</span>
                    </div>
                    <div className="sim-stat text-rose">
                      <span className="stat-label">Throttled (429)</span>
                      <span className="stat-num">{simResults.throttled}</span>
                    </div>
                  </div>

                  <h4 className="mt-4">Batch Request Execution Timeline</h4>
                  <div className="sim-stream font-mono">
                    {simResults.results.map((r) => (
                      <div key={r.requestIndex} className={`sim-log-item status-${r.status}`}>
                        <span className="req-idx">#{r.requestIndex}</span>
                        <span className={`badge status-${r.status}`}>
                          {r.status === 200 ? '200 OK' : '429 Rate Limit'}
                        </span>
                        <span className="rem-tokens">Tokens Left: {r.remainingTokens ?? 0}</span>
                        {r.retryAfter && (
                          <span className="retry-sec text-rose">Retry-After: {r.retryAfter}s</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
