import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const API_BASE_URL = 'http://localhost:5000';

export default function App() {
  // Navigation State
  const [activeTab, setActiveTab] = useState('live-tail'); // 'overview' | 'live-tail' | 'elastic-search' | 'api-keys'

  // Socket & Telemetry State
  const [isConnected, setIsConnected] = useState(false);
  const [stats, setStats] = useState({
    totalLogs: 0,
    throughputPerSec: '0.0',
    errorRatePercent: '0.0',
    levelCounts: { INFO: 0, WARN: 0, ERROR: 0, FATAL: 0 },
    serviceCounts: {},
    serviceErrors: {},
    timeSeries: [],
    services: []
  });

  // Real-Time Log Tailing State
  const [liveLogs, setLiveLogs] = useState([]);
  const [isTailingPaused, setIsTailingPaused] = useState(false);
  const [tailSearch, setTailSearch] = useState('');
  const [tailLevelFilter, setTailLevelFilter] = useState('ALL');
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef(null);

  // Elastic Search Engine State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLevel, setSearchLevel] = useState('ALL');
  const [searchService, setSearchService] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [searchPage, setSearchPage] = useState(1);
  const [isSearching, setIsSearching] = useState(false);

  // API Key Management State
  const [masterKey, setMasterKey] = useState('log_live_key_9f8a7b6c5d4e');
  const [apiKeys, setApiKeys] = useState([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyService, setNewKeyService] = useState('');

  // Simulator & Ingestion Test State
  const [simulatorActive, setSimulatorActive] = useState(true);
  const [simulatorSpeed, setSimulatorSpeed] = useState(1500);
  const [testLog, setTestLog] = useState({
    service: 'payment-gateway',
    level: 'ERROR',
    endpoint: '/api/v1/checkout/stripe',
    message: 'Stripe Gateway Error: Card declined by issuing bank (Code 402)',
    httpStatus: 402,
    traceId: 'tr_test_' + Math.random().toString(36).substr(2, 6)
  });
  const [ingestStatus, setIngestStatus] = useState(null);

  // Alerts State
  const [alerts, setAlerts] = useState([]);
  const [expandedLogId, setExpandedLogId] = useState(null);

  const socketRef = useRef(null);

  // Initialize Socket.io Connection
  useEffect(() => {
    const socket = io(API_BASE_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('init_state', (data) => {
      if (data.stats) setStats(data.stats);
      if (data.recentLogs) setLiveLogs(data.recentLogs);
      if (data.masterApiKey) setMasterKey(data.masterApiKey);
      if (data.simulatorActive !== undefined) setSimulatorActive(data.simulatorActive);
    });

    socket.on('stats_update', (newStats) => {
      setStats(newStats);
    });

    socket.on('new_log', (log) => {
      setLiveLogs((prev) => {
        const updated = [log, ...prev];
        return updated.slice(0, 500); // keep max 500 in live tail view
      });
    });

    socket.on('error_alert', (alert) => {
      setAlerts((prev) => [alert, ...prev].slice(0, 10));
    });

    fetchApiKeys();
    executeElasticSearch();

    return () => {
      socket.disconnect();
    };
  }, []);

  // Auto Scroll Live Console
  useEffect(() => {
    if (autoScroll && !isTailingPaused && logContainerRef.current) {
      logContainerRef.current.scrollTop = 0;
    }
  }, [liveLogs, autoScroll, isTailingPaused]);

  // Fetch API Keys
  const fetchApiKeys = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/keys`);
      if (res.ok) {
        const data = await res.json();
        setApiKeys(data);
      }
    } catch (err) {
      console.error('Failed to fetch API keys:', err);
    }
  };

  // Generate New API Key
  const handleCreateApiKey = async (e) => {
    e.preventDefault();
    if (!newKeyName) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/keys/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName, service: newKeyService })
      });
      if (res.ok) {
        setNewKeyName('');
        setNewKeyService('');
        fetchApiKeys();
      }
    } catch (err) {
      console.error('Failed to generate API Key:', err);
    }
  };

  // Execute Elastic Search
  const executeElasticSearch = async (page = 1) => {
    setIsSearching(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.append('q', searchQuery);
      if (searchLevel !== 'ALL') params.append('level', searchLevel);
      if (searchService !== 'ALL') params.append('service', searchService);
      if (fromDate) params.append('from', fromDate);
      if (toDate) params.append('to', toDate);
      params.append('page', page);
      params.append('limit', 15);

      const res = await fetch(`${API_BASE_URL}/api/logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
        setSearchPage(page);
      }
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Trigger Log Ingest via API Key
  const handleTestIngest = async (e) => {
    e.preventDefault();
    setIngestStatus({ loading: true, msg: 'Ingesting log via API...' });
    try {
      const res = await fetch(`${API_BASE_URL}/api/logs/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': masterKey
        },
        body: JSON.stringify(testLog)
      });
      const data = await res.json();
      if (res.ok) {
        setIngestStatus({ success: true, msg: `Ingested ${data.count} log(s) successfully!` });
      } else {
        setIngestStatus({ error: true, msg: data.message || 'Ingestion failed' });
      }
    } catch (err) {
      setIngestStatus({ error: true, msg: 'Network error connecting to ingestion endpoint' });
    }
  };

  // Toggle Log Simulator
  const handleToggleSimulator = async () => {
    const nextState = !simulatorActive;
    setSimulatorActive(nextState);
    try {
      await fetch(`${API_BASE_URL}/api/simulator/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: nextState, speedMs: simulatorSpeed })
      });
    } catch (err) {
      console.error('Simulator toggle error:', err);
    }
  };

  // Seed sample logs
  const handleSeedLogs = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/logs/seed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 40 })
      });
      executeElasticSearch(1);
    } catch (err) {
      console.error('Failed to seed logs:', err);
    }
  };

  // Export CSV / JSON
  const handleExport = (format) => {
    const params = new URLSearchParams();
    params.append('format', format);
    if (searchQuery) params.append('q', searchQuery);
    if (searchLevel !== 'ALL') params.append('level', searchLevel);
    if (searchService !== 'ALL') params.append('service', searchService);

    window.open(`${API_BASE_URL}/api/logs/export?${params.toString()}`, '_blank');
  };

  // Filtered Live Logs
  const filteredLiveLogs = liveLogs.filter((log) => {
    if (tailLevelFilter !== 'ALL' && log.level !== tailLevelFilter) return false;
    if (tailSearch) {
      const term = tailSearch.toLowerCase();
      const text = `${log.message} ${log.service} ${log.traceId} ${log.endpoint}`.toLowerCase();
      return text.includes(term);
    }
    return true;
  });

  return (
    <div className="app-container">
      {/* HEADER BAR */}
      <header className="top-header">
        <div className="brand">
          <div className="brand-logo">⚡</div>
          <div>
            <h1 className="brand-title">LogPulse Engine</h1>
            <p className="brand-subtitle">Distributed Elastic Log Aggregation & Real-Time Analytics</p>
          </div>
        </div>

        <div className="status-group">
          <div className={`connection-badge ${isConnected ? 'online' : 'offline'}`}>
            <span className="dot"></span>
            {isConnected ? 'LIVE SOCKET CONNECTED' : 'DISCONNECTED'}
          </div>

          <button
            className={`btn-sim ${simulatorActive ? 'btn-sim-active' : 'btn-sim-inactive'}`}
            onClick={handleToggleSimulator}
          >
            {simulatorActive ? '⏸ Pause Stream' : '▶ Resume Stream'}
          </button>

          <button className="btn-secondary" onClick={handleSeedLogs}>
            ⚡ Ingest Sample Logs
          </button>
        </div>
      </header>

      {/* METRICS CAROUSEL BANNER */}
      <section className="metrics-banner">
        <div className="metric-card">
          <span className="metric-label">TOTAL INGESTED LOGS</span>
          <span className="metric-value text-cyan">{stats.totalLogs.toLocaleString()}</span>
          <span className="metric-sub">Indexed in Memory Engine</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">INGEST THROUGHPUT</span>
          <span className="metric-value text-emerald">{stats.throughputPerSec} <small>logs/s</small></span>
          <span className="metric-sub">Real-Time Ingestion Velocity</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">ERROR RATE</span>
          <span className="metric-value text-red">{stats.errorRatePercent}%</span>
          <span className="metric-sub">ERROR & FATAL ratio</span>
        </div>

        <div className="metric-card">
          <span className="metric-label">ACTIVE MICROSERVICES</span>
          <span className="metric-value text-amber">{stats.services.length}</span>
          <span className="metric-sub">{stats.services.join(', ')}</span>
        </div>
      </section>

      {/* REAL-TIME ALERTS BANNER (IF ANY) */}
      {alerts.length > 0 && (
        <div className="alerts-bar">
          <div className="alert-badge font-mono">🚨 ALERT SPIKE DETECTED</div>
          <div className="alert-text">
            <strong>{alerts[0].title}:</strong> {alerts[0].message}
          </div>
          <button className="alert-close" onClick={() => setAlerts([])}>✕</button>
        </div>
      )}

      {/* NAVIGATION TABS */}
      <nav className="tab-nav">
        <button
          className={`tab-item ${activeTab === 'live-tail' ? 'active' : ''}`}
          onClick={() => setActiveTab('live-tail')}
        >
          💻 Real-Time Log Console
        </button>
        <button
          className={`tab-item ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          📊 Visual Analytics & Metrics
        </button>
        <button
          className={`tab-item ${activeTab === 'elastic-search' ? 'active' : ''}`}
          onClick={() => setActiveTab('elastic-search')}
        >
          🔍 Full-Text Elastic Search
        </button>
        <button
          className={`tab-item ${activeTab === 'api-keys' ? 'active' : ''}`}
          onClick={() => setActiveTab('api-keys')}
        >
          🔑 API Key Manager & Ingest Docs
        </button>
      </nav>

      {/* TAB CONTENT PANELS */}
      <main className="main-content">
        {/* ========================================== */}
        {/* TAB 1: REAL-TIME LOG STREAM TAILING CONSOLE */}
        {/* ========================================== */}
        {activeTab === 'live-tail' && (
          <section className="tail-section">
            <div className="tail-controls">
              <div className="search-box">
                <span className="search-icon">🔍</span>
                <input
                  type="text"
                  placeholder="Filter stream logs by keyword, traceId, service..."
                  value={tailSearch}
                  onChange={(e) => setTailSearch(e.target.value)}
                />
              </div>

              <div className="filter-group">
                <label>Severity:</label>
                {['ALL', 'INFO', 'WARN', 'ERROR', 'FATAL'].map((lvl) => (
                  <button
                    key={lvl}
                    className={`badge-filter ${lvl} ${tailLevelFilter === lvl ? 'active' : ''}`}
                    onClick={() => setTailLevelFilter(lvl)}
                  >
                    {lvl}
                  </button>
                ))}
              </div>

              <div className="tail-toggles">
                <button
                  className={`toggle-btn ${isTailingPaused ? 'paused' : ''}`}
                  onClick={() => setIsTailingPaused(!isTailingPaused)}
                >
                  {isTailingPaused ? '▶ Resume Live Stream' : '⏸ Pause Live View'}
                </button>
                <button
                  className={`toggle-btn ${autoScroll ? 'active' : ''}`}
                  onClick={() => setAutoScroll(!autoScroll)}
                >
                  {autoScroll ? '⬇ Auto-Scroll ON' : '⏸ Auto-Scroll OFF'}
                </button>
              </div>
            </div>

            {/* TERMINAL LOG CONSOLE CONTAINER */}
            <div className="log-console font-mono" ref={logContainerRef}>
              {filteredLiveLogs.length === 0 ? (
                <div className="console-empty">
                  <p>📡 Waiting for incoming log stream...</p>
                  <small>Logs will appear in real time via Socket.io broadcast.</small>
                </div>
              ) : (
                filteredLiveLogs.map((log) => {
                  const isExpanded = expandedLogId === log.id;
                  return (
                    <div key={log.id} className={`log-row ${log.level.toLowerCase()}`}>
                      <div className="log-summary" onClick={() => setExpandedLogId(isExpanded ? null : log.id)}>
                        <span className="log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                        <span className={`log-level-badge ${log.level}`}>{log.level}</span>
                        <span className="log-service">[{log.service}]</span>
                        <span className="log-endpoint">{log.endpoint}</span>
                        <span className="log-msg">{log.message}</span>
                        <span className="log-expand-icon">{isExpanded ? '▼' : '▶'}</span>
                      </div>

                      {isExpanded && (
                        <div className="log-details">
                          <div className="details-grid">
                            <div><strong>Trace ID:</strong> <span className="text-cyan">{log.traceId}</span></div>
                            <div><strong>User ID:</strong> {log.userId}</div>
                            <div><strong>HTTP Status:</strong> <span className={log.httpStatus >= 400 ? 'text-red' : 'text-emerald'}>{log.httpStatus}</span></div>
                            <div><strong>Latency:</strong> {log.durationMs}ms</div>
                          </div>
                          <div className="metadata-box">
                            <strong>Metadata JSON:</strong>
                            <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </section>
        )}

        {/* ========================================== */}
        {/* TAB 2: VISUAL ANALYTICS & TIME-SERIES      */}
        {/* ========================================== */}
        {activeTab === 'overview' && (
          <section className="analytics-section">
            <div className="charts-grid">
              {/* TIME SERIES VOLUME CHART */}
              <div className="chart-card">
                <div className="card-header">
                  <h3>📈 Log Ingestion Volume (Past 30 Mins)</h3>
                  <small>Real-Time Minute Buckets</small>
                </div>
                <div className="time-series-container">
                  <div className="bars-wrapper">
                    {stats.timeSeries.map((bucket, idx) => {
                      const maxVal = Math.max(...stats.timeSeries.map((b) => b.total), 1);
                      const heightPct = Math.min(100, Math.round((bucket.total / maxVal) * 100));
                      return (
                        <div key={idx} className="bar-column" title={`${bucket.label}: ${bucket.total} logs`}>
                          <div className="bar-stack font-mono" style={{ height: `${Math.max(heightPct, 4)}%` }}>
                            <div className="bar-segment fatal" style={{ height: `${bucket.total ? (bucket.FATAL / bucket.total) * 100 : 0}%` }}></div>
                            <div className="bar-segment error" style={{ height: `${bucket.total ? (bucket.ERROR / bucket.total) * 100 : 0}%` }}></div>
                            <div className="bar-segment warn" style={{ height: `${bucket.total ? (bucket.WARN / bucket.total) * 100 : 0}%` }}></div>
                            <div className="bar-segment info" style={{ height: `${bucket.total ? (bucket.INFO / bucket.total) * 100 : 0}%` }}></div>
                          </div>
                          <span className="bar-label">{idx % 5 === 0 ? bucket.label : ''}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* SEVERITY DISTRIBUTION */}
              <div className="chart-card">
                <div className="card-header">
                  <h3>🎯 Severity Level Breakdown</h3>
                  <small>Log Distribution ratio</small>
                </div>
                <div className="severity-breakdown">
                  {Object.entries(stats.levelCounts).map(([lvl, count]) => {
                    const pct = stats.totalLogs > 0 ? ((count / stats.totalLogs) * 100).toFixed(1) : 0;
                    return (
                      <div key={lvl} className="severity-bar-item">
                        <div className="severity-info">
                          <span className={`badge-filter ${lvl}`}>{lvl}</span>
                          <span className="font-mono">{count} ({pct}%)</span>
                        </div>
                        <div className="progress-bg">
                          <div
                            className={`progress-fill ${lvl.toLowerCase()}`}
                            style={{ width: `${pct}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* SERVICE HEALTH MATRIX TABLE */}
            <div className="chart-card mt-20">
              <div className="card-header">
                <h3>🖥️ Microservice Cluster Health Matrix</h3>
                <small>Logs per microservice & error rate tracking</small>
              </div>
              <table className="cluster-table">
                <thead>
                  <tr>
                    <th>Service Name</th>
                    <th>Total Ingested</th>
                    <th>Errors / Fatals</th>
                    <th>Health Score</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(stats.serviceCounts).length === 0 ? (
                    <tr>
                      <td colSpan="5" className="text-center">No service telemetry received yet.</td>
                    </tr>
                  ) : (
                    Object.entries(stats.serviceCounts).map(([svc, total]) => {
                      const errs = stats.serviceErrors[svc] || 0;
                      const errRate = ((errs / total) * 100).toFixed(1);
                      const isHealthy = errRate < 10;
                      return (
                        <tr key={svc}>
                          <td className="font-mono text-cyan"><strong>{svc}</strong></td>
                          <td>{total} logs</td>
                          <td className={errs > 0 ? 'text-red' : 'text-emerald'}>{errs} errors ({errRate}%)</td>
                          <td>
                            <div className="progress-bg">
                              <div
                                className={`progress-fill ${isHealthy ? 'info' : 'error'}`}
                                style={{ width: `${Math.max(100 - errRate, 5)}%` }}
                              ></div>
                            </div>
                          </td>
                          <td>
                            <span className={`status-pill ${isHealthy ? 'healthy' : 'degraded'}`}>
                              {isHealthy ? '🟢 HEALTHY' : '🔴 DEGRADED'}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ========================================== */}
        {/* TAB 3: FULL-TEXT ELASTIC SEARCH ENGINE     */}
        {/* ========================================== */}
        {activeTab === 'elastic-search' && (
          <section className="search-section">
            <div className="search-card">
              <div className="search-input-wrapper">
                <span className="search-icon-big">🔍</span>
                <input
                  type="text"
                  className="elastic-input"
                  placeholder="Enter full-text query (e.g. 'Connection timed out', 'service:auth-service', 'level:ERROR')..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && executeElasticSearch(1)}
                />
                <button
                  className="btn-primary"
                  onClick={() => executeElasticSearch(1)}
                  disabled={isSearching}
                >
                  {isSearching ? 'Indexing & Searching...' : 'Execute Elastic Search'}
                </button>
              </div>

              {/* SEARCH FILTERS ROW */}
              <div className="search-filters-row">
                <div className="filter-item">
                  <label>Severity:</label>
                  <select value={searchLevel} onChange={(e) => setSearchLevel(e.target.value)}>
                    <option value="ALL">All Levels</option>
                    <option value="INFO">INFO</option>
                    <option value="WARN">WARN</option>
                    <option value="ERROR">ERROR</option>
                    <option value="FATAL">FATAL</option>
                  </select>
                </div>

                <div className="filter-item">
                  <label>Microservice:</label>
                  <select value={searchService} onChange={(e) => setSearchService(e.target.value)}>
                    <option value="ALL">All Services</option>
                    {stats.services.map((svc) => (
                      <option key={svc} value={svc}>{svc}</option>
                    ))}
                  </select>
                </div>

                <div className="filter-item">
                  <label>From:</label>
                  <input type="datetime-local" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
                </div>

                <div className="filter-item">
                  <label>To:</label>
                  <input type="datetime-local" value={toDate} onChange={(e) => setToDate(e.target.value)} />
                </div>

                <div className="export-actions">
                  <button className="btn-small-export" onClick={() => handleExport('json')}>
                    📥 Export JSON
                  </button>
                  <button className="btn-small-export" onClick={() => handleExport('csv')}>
                    📊 Export CSV
                  </button>
                </div>
              </div>
            </div>

            {/* SEARCH RESULTS DISPLAY */}
            {searchResults && (
              <div className="results-container mt-20">
                <div className="results-header">
                  <div>
                    <span>Found <strong>{searchResults.total}</strong> documents</span>
                    <span className="text-cyan font-mono ml-10">(Executed in {searchResults.tookMs} ms)</span>
                  </div>
                  <span className="font-mono text-muted">Page {searchResults.page} of {searchResults.totalPages}</span>
                </div>

                <div className="results-list font-mono">
                  {searchResults.results.length === 0 ? (
                    <div className="no-results">No log records matched your query terms.</div>
                  ) : (
                    searchResults.results.map(({ log, score, highlights }) => (
                      <div key={log.id} className={`result-card level-${log.level.toLowerCase()}`}>
                        <div className="result-top">
                          <span className={`log-level-badge ${log.level}`}>{log.level}</span>
                          <span className="text-cyan">[{log.service}]</span>
                          <span className="text-muted">{new Date(log.timestamp).toLocaleString()}</span>
                          <span className="score-badge font-mono">BM25 Score: {score}</span>
                        </div>

                        <div className="result-body">
                          <p className="result-msg">{log.message}</p>
                          <div className="result-meta">
                            <span>Endpoint: <code>{log.endpoint}</code></span>
                            <span>Status: <code className={log.httpStatus >= 400 ? 'text-red' : 'text-emerald'}>{log.httpStatus}</code></span>
                            <span>Trace: <code>{log.traceId}</code></span>
                          </div>

                          {highlights.length > 0 && (
                            <div className="match-highlights">
                              <small>Matched Terms:</small>
                              {highlights.map((h, i) => (
                                <span key={i} className="highlight-tag">{h}</span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* PAGINATION CONTROLS */}
                {searchResults.totalPages > 1 && (
                  <div className="pagination-bar">
                    <button
                      disabled={searchPage <= 1}
                      onClick={() => executeElasticSearch(searchPage - 1)}
                    >
                      ◀ Previous
                    </button>
                    <span>Page {searchPage} / {searchResults.totalPages}</span>
                    <button
                      disabled={searchPage >= searchResults.totalPages}
                      onClick={() => executeElasticSearch(searchPage + 1)}
                    >
                      Next ▶
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ========================================== */}
        {/* TAB 4: API KEYS & INGESTION DOCUMENTATION */}
        {/* ========================================== */}
        {activeTab === 'api-keys' && (
          <section className="apikeys-section">
            <div className="keys-grid">
              {/* CREATE & MANAGE API KEYS */}
              <div className="chart-card">
                <div className="card-header">
                  <h3>🔑 API Ingestion Key Manager</h3>
                  <small>Manage authorization tokens for microservice telemetry</small>
                </div>

                <form onSubmit={handleCreateApiKey} className="key-form">
                  <div className="form-group">
                    <label>Application / Service Name:</label>
                    <input
                      type="text"
                      placeholder="e.g. billing-microservice"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>Target Scope / Service Tag:</label>
                    <input
                      type="text"
                      placeholder="e.g. billing-service"
                      value={newKeyService}
                      onChange={(e) => setNewKeyService(e.target.value)}
                    />
                  </div>
                  <button type="submit" className="btn-primary">
                    + Generate New API Key
                  </button>
                </form>

                <div className="keys-list font-mono mt-20">
                  <h4>Active API Keys</h4>
                  {apiKeys.map((k) => (
                    <div key={k.key} className="key-item">
                      <div className="key-item-header">
                        <strong>{k.name}</strong>
                        <span className="text-cyan">({k.service})</span>
                      </div>
                      <div className="key-string">
                        <code>{k.key}</code>
                        <button
                          className="btn-copy"
                          onClick={() => navigator.clipboard.writeText(k.key)}
                        >
                          📋 Copy
                        </button>
                      </div>
                      <div className="key-meta text-muted">
                        <span>Created: {new Date(k.createdAt).toLocaleDateString()}</span>
                        <span>Requests Processed: {k.requestsCount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* TEST INGESTION & DOCUMENTATION */}
              <div className="chart-card">
                <div className="card-header">
                  <h3>⚡ Live Test Log Ingest Sandbox</h3>
                  <small>Submit a log payload with API Key authentication</small>
                </div>

                <form onSubmit={handleTestIngest} className="ingest-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label>Service Tag:</label>
                      <input
                        type="text"
                        value={testLog.service}
                        onChange={(e) => setTestLog({ ...testLog, service: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Severity Level:</label>
                      <select
                        value={testLog.level}
                        onChange={(e) => setTestLog({ ...testLog, level: e.target.value })}
                      >
                        <option value="INFO">INFO</option>
                        <option value="WARN">WARN</option>
                        <option value="ERROR">ERROR</option>
                        <option value="FATAL">FATAL</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Endpoint / Route:</label>
                    <input
                      type="text"
                      value={testLog.endpoint}
                      onChange={(e) => setTestLog({ ...testLog, endpoint: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Log Message Body:</label>
                    <textarea
                      rows="3"
                      value={testLog.message}
                      onChange={(e) => setTestLog({ ...testLog, message: e.target.value })}
                    ></textarea>
                  </div>

                  <button type="submit" className="btn-primary btn-full">
                    🚀 Dispatch Log Ingest POST Request
                  </button>

                  {ingestStatus && (
                    <div className={`status-box mt-10 ${ingestStatus.error ? 'error' : 'success'}`}>
                      {ingestStatus.msg}
                    </div>
                  )}
                </form>

                <div className="code-doc-box mt-20">
                  <h4>cURL Ingestion Snippet:</h4>
                  <pre className="font-mono">
{`curl -X POST http://localhost:5000/api/logs/ingest \\
  -H "X-API-Key: ${masterKey}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "level": "ERROR",
    "service": "auth-service",
    "endpoint": "/api/v1/login",
    "message": "User authentication failed",
    "httpStatus": 401
  }'`}
                  </pre>
                </div>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
