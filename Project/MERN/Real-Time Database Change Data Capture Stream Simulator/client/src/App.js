import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const API_BASE = 'http://localhost:5000';

export default function App() {
  // Socket & Connection state
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [serverLatency, setServerLatency] = useState(2);

  // CDC Events & Filters
  const [cdcEvents, setCdcEvents] = useState([]);
  const [isPaused, setIsPaused] = useState(false);
  const [filterCollection, setFilterCollection] = useState('all');
  const [filterOperation, setFilterOperation] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [newRowIds, setNewRowIds] = useState(new Set());

  // Metrics Stats
  const [stats, setStats] = useState({
    totalEvents: 0,
    bufferCount: 0,
    tps: 0,
    insertCount: 0,
    updateCount: 0,
    deleteCount: 0,
    avgPayloadSizeKB: 0,
    collectionCounts: { users: 0, orders: 0, inventory: 0, products: 0 },
    tpsHistory: [],
    simulatorActive: false,
    simulatorTps: 2
  });

  // Simulator Controls
  const [simulatorActive, setSimulatorActive] = useState(false);
  const [simulatorTps, setSimulatorTps] = useState(2);

  // Collections Documents for Mutation dropdowns
  const [collectionsData, setCollectionsData] = useState({
    users: [], orders: [], inventory: [], products: []
  });

  // Mutation Trigger Panel Form State
  const [selectedCollection, setSelectedCollection] = useState('users');
  const [selectedOperation, setSelectedOperation] = useState('insert');
  const [selectedDocId, setSelectedDocId] = useState('');
  const [jsonPayload, setJsonPayload] = useState('{\n  "name": "Evelyn Reed",\n  "email": "evelyn@nexus.io",\n  "role": "Lead Architect"\n}');
  const [mutationStatus, setMutationStatus] = useState(null);

  // Selected Event Modal for Schema & Diff Viewing
  const [activeModalEvent, setActiveModalEvent] = useState(null);
  const [modalTab, setModalTab] = useState('diff'); // 'diff' | 'raw' | 'updateDesc'

  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;

  // Initialize Socket.io Connection & Fetch collections data
  useEffect(() => {
    const s = io(API_BASE, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10
    });

    s.on('connect', () => {
      setIsConnected(true);
    });

    s.on('disconnect', () => {
      setIsConnected(false);
    });

    s.on('initial_state', (data) => {
      if (data.stats) setStats(data.stats);
      if (data.recentEvents) setCdcEvents(data.recentEvents);
      if (data.stats) {
        setSimulatorActive(data.stats.simulatorActive);
        setSimulatorTps(data.stats.simulatorTps);
      }
      fetchCollectionsData();
    });

    s.on('cdc_event', (event) => {
      if (!isPausedRef.current) {
        setCdcEvents(prev => [event, ...prev.slice(0, 499)]);
        
        // Highlight new incoming row
        const eventId = event._id._data;
        setNewRowIds(prev => new Set([...prev, eventId]));
        setTimeout(() => {
          setNewRowIds(prev => {
            const next = new Set(prev);
            next.delete(eventId);
            return next;
          });
        }, 1200);
      }
    });

    s.on('stats_update', (newStats) => {
      setStats(newStats);
      setSimulatorActive(newStats.simulatorActive);
      setSimulatorTps(newStats.simulatorTps);
    });

    s.on('simulator_status', (data) => {
      setSimulatorActive(data.active);
      setSimulatorTps(data.tps);
    });

    s.on('cdc_cleared', () => {
      setCdcEvents([]);
    });

    setSocket(s);
    fetchCollectionsData();

    return () => {
      s.disconnect();
    };
  }, []);

  const fetchCollectionsData = async () => {
    try {
      const collections = ['users', 'orders', 'inventory', 'products'];
      const dataMap = {};
      for (const coll of collections) {
        const res = await fetch(`${API_BASE}/api/collections/${coll}`);
        const json = await res.json();
        if (json.success) {
          dataMap[coll] = json.data;
        }
      }
      setCollectionsData(dataMap);
    } catch (err) {
      console.error('Failed to fetch collections:', err);
    }
  };

  // Toggle Auto Simulator
  const handleToggleSimulator = async (activeState) => {
    try {
      const res = await fetch(`${API_BASE}/api/cdc/simulator/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: activeState, tps: simulatorTps })
      });
      const json = await res.json();
      if (json.success) {
        setSimulatorActive(json.simulatorActive);
      }
    } catch (err) {
      console.error('Failed to toggle simulator:', err);
    }
  };

  const handleChangeSimulatorTps = async (newTps) => {
    setSimulatorTps(newTps);
    if (simulatorActive) {
      try {
        await fetch(`${API_BASE}/api/cdc/simulator/toggle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: true, tps: newTps })
        });
      } catch (err) {
        console.error('Failed to update TPS:', err);
      }
    }
  };

  // Clear CDC Feed
  const handleClearFeed = async () => {
    try {
      await fetch(`${API_BASE}/api/cdc/clear`, { method: 'POST' });
      setCdcEvents([]);
    } catch (err) {
      console.error('Failed to clear feed:', err);
    }
  };

  // Execute Manual Mutation Trigger
  const handleExecuteMutation = async (e) => {
    e.preventDefault();
    setMutationStatus({ type: 'info', message: 'Executing database mutation...' });

    let parsedData = {};
    if (selectedOperation !== 'delete') {
      try {
        parsedData = JSON.parse(jsonPayload);
      } catch (err) {
        setMutationStatus({ type: 'error', message: 'Invalid JSON payload format.' });
        return;
      }
    }

    try {
      const res = await fetch(`${API_BASE}/api/cdc/mutate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          collection: selectedCollection,
          operationType: selectedOperation,
          documentId: selectedDocId || undefined,
          data: parsedData
        })
      });

      const json = await res.json();
      if (json.success) {
        setMutationStatus({ type: 'success', message: json.message });
        fetchCollectionsData();
        setTimeout(() => setMutationStatus(null), 3000);
      } else {
        setMutationStatus({ type: 'error', message: json.error });
      }
    } catch (err) {
      setMutationStatus({ type: 'error', message: 'Failed to communicate with server.' });
    }
  };

  // Set Preset Payloads
  const applyPreset = (presetType) => {
    if (presetType === 'user_insert') {
      setSelectedCollection('users');
      setSelectedOperation('insert');
      setJsonPayload(JSON.stringify({
        name: "Cyra Vance",
        email: "cyra@cybercore.io",
        role: "Security Engineer",
        status: "ACTIVE",
        credits: 2450
      }, null, 2));
    } else if (presetType === 'order_checkout') {
      setSelectedCollection('orders');
      setSelectedOperation('insert');
      setJsonPayload(JSON.stringify({
        userId: "usr_101",
        totalAmount: 499.00,
        status: "PROCESSING",
        itemsCount: 2,
        paymentMethod: "Crypto"
      }, null, 2));
    } else if (presetType === 'inventory_update') {
      setSelectedCollection('inventory');
      setSelectedOperation('update');
      const docs = collectionsData.inventory || [];
      if (docs.length > 0) setSelectedDocId(docs[0]._id);
      setJsonPayload(JSON.stringify({
        stockQuantity: 150,
        warehouseLocation: "Zone-X9"
      }, null, 2));
    } else if (presetType === 'product_price_drop') {
      setSelectedCollection('products');
      setSelectedOperation('update');
      const docs = collectionsData.products || [];
      if (docs.length > 0) setSelectedDocId(docs[0]._id);
      setJsonPayload(JSON.stringify({
        price: 199.99,
        isAvailable: true
      }, null, 2));
    }
  };

  // Filter CDC Events
  const filteredEvents = cdcEvents.filter(evt => {
    if (filterCollection !== 'all' && evt.ns.coll !== filterCollection) return false;
    if (filterOperation !== 'all' && evt.operationType !== filterOperation.toLowerCase()) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const str = JSON.stringify(evt).toLowerCase();
      return str.includes(q);
    }
    return true;
  });

  // Calculate Throughput Graph max height
  const maxTpsVal = Math.max(...(stats.tpsHistory.map(h => h.tps) || [1]), 5);

  const totalOps = (stats.insertCount + stats.updateCount + stats.deleteCount) || 1;
  const insertPct = ((stats.insertCount / totalOps) * 100).toFixed(1);
  const updatePct = ((stats.updateCount / totalOps) * 100).toFixed(1);
  const deletePct = ((stats.deleteCount / totalOps) * 100).toFixed(1);

  return (
    <div className="app-container">
      {/* HEADER BAR */}
      <header className="header">
        <div className="header-title-section">
          <div className="logo-badge">CDC</div>
          <div>
            <h1 className="header-title">
              Real-Time CDC Stream Simulator
              <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px', background: 'rgba(0,242,254,0.15)', color: '#00f2fe', border: '1px solid rgba(0,242,254,0.3)' }}>
                Mongo Change Streams
              </span>
            </h1>
            <p className="header-subtitle">Database Mutation Event Telemetry & Real-Time Data Pipeline Monitor</p>
          </div>
        </div>

        <div className="header-controls">
          {/* Socket Indicator */}
          <div className="status-indicator">
            <div className={`status-dot ${isConnected ? 'online' : 'offline'}`}></div>
            <span>{isConnected ? 'STREAM CONNECTED' : 'DISCONNECTED'}</span>
          </div>

          {/* Auto Simulator Toggle & Speed */}
          <div className="simulator-box">
            <label className="toggle-switch">
              <input
                type="checkbox"
                checked={simulatorActive}
                onChange={(e) => handleToggleSimulator(e.target.checked)}
              />
              <span className="slider"></span>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', fontSize: '0.8rem' }}>
              <span style={{ fontWeight: '700', color: simulatorActive ? '#00f2fe' : '#94a3b8' }}>
                Auto Simulator: {simulatorActive ? 'RUNNING' : 'PAUSED'}
              </span>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                Rate: {simulatorTps} TPS
              </span>
            </div>

            <input
              type="range"
              min="1"
              max="20"
              value={simulatorTps}
              onChange={(e) => handleChangeSimulatorTps(parseInt(e.target.value))}
              style={{ width: '80px', accentColor: '#00f2fe', cursor: 'pointer' }}
              title="Transactions Per Second (1 - 20 TPS)"
            />
          </div>

          <button className="btn btn-danger" onClick={handleClearFeed}>
            Clear Log
          </button>
        </div>
      </header>

      {/* METRIC SUMMARY CARDS */}
      <section className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span>Throughput Rate</span>
            <div className="metric-icon" style={{ color: '#00f2fe' }}>⚡</div>
          </div>
          <div className="metric-value">{stats.tps} <span style={{ fontSize: '1rem', color: '#94a3b8' }}>TPS</span></div>
          <div className="metric-sub">
            <span>Events / Second in real-time</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>Total CDC Events</span>
            <div className="metric-icon" style={{ color: '#10b981' }}>📊</div>
          </div>
          <div className="metric-value">{stats.totalEvents.toLocaleString()}</div>
          <div className="metric-sub">
            <span style={{ color: '#10b981' }}>Ins: {stats.insertCount}</span>
            <span style={{ color: '#f59e0b' }}>Upd: {stats.updateCount}</span>
            <span style={{ color: '#ef4444' }}>Del: {stats.deleteCount}</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>Payload & Latency</span>
            <div className="metric-icon" style={{ color: '#8b5cf6' }}>📦</div>
          </div>
          <div className="metric-value">{stats.avgPayloadSizeKB} <span style={{ fontSize: '1rem', color: '#94a3b8' }}>KB</span></div>
          <div className="metric-sub">
            <span>Avg Event Payload Size (CDC Lag ~ 2ms)</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span>Tracked Collections</span>
            <div className="metric-icon" style={{ color: '#3b82f6' }}>🗄️</div>
          </div>
          <div className="metric-value">{Object.keys(stats.collectionCounts).length}</div>
          <div className="metric-sub">
            <span>Users ({stats.collectionCounts.users || 0}) • Orders ({stats.collectionCounts.orders || 0})</span>
          </div>
        </div>
      </section>

      {/* MAIN DASHBOARD CONTENT GRID */}
      <main className="dashboard-grid">
        
        {/* LEFT COLUMN: Event Stream Feed & Throughput Chart */}
        <section className="analytics-section">
          
          {/* STREAM THROUGHPUT ANALYTICS CHART */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 className="card-title">
                <span>📈</span> Stream Throughput Analytics (Events/Sec Timeline)
              </h2>
              <div style={{ fontSize: '0.78rem', color: '#94a3b8', fontFamily: 'var(--font-code)' }}>
                Window: 30 Seconds
              </div>
            </div>

            <div className="chart-container">
              {stats.tpsHistory.map((item, idx) => {
                const heightPct = Math.max(5, (item.tps / maxTpsVal) * 100);
                return (
                  <div key={idx} className="chart-bar-wrapper">
                    <div className="chart-bar-tooltip">
                      {item.time}: {item.tps} TPS (I:{item.inserts} U:{item.updates} D:{item.deletes})
                    </div>
                    <div
                      className="chart-bar"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Operation Breakdown Bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '4px' }}>
                <span>Operations Breakdown</span>
                <span>INSERT ({insertPct}%) • UPDATE ({updatePct}%) • DELETE ({deletePct}%)</span>
              </div>
              <div className="op-distribution">
                <div className="op-dist-item" style={{ width: `${insertPct}%`, background: 'var(--op-insert)' }} />
                <div className="op-dist-item" style={{ width: `${updatePct}%`, background: 'var(--op-update)' }} />
                <div className="op-dist-item" style={{ width: `${deletePct}%`, background: 'var(--op-delete)' }} />
              </div>
            </div>
          </div>

          {/* LIVE CDC STREAM EVENT FEED TABLE */}
          <div className="card">
            <div className="feed-controls">
              <h2 className="card-title">
                <span>📡</span> Live CDC Mutation Stream Feed ({filteredEvents.length})
              </h2>

              <div className="filter-group">
                <button
                  className={`btn ${isPaused ? 'btn-primary' : ''}`}
                  style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                  onClick={() => setIsPaused(!isPaused)}
                >
                  {isPaused ? '▶ Resume Stream' : '⏸ Pause Feed'}
                </button>

                <select
                  className="input-select"
                  value={filterCollection}
                  onChange={(e) => setFilterCollection(e.target.value)}
                >
                  <option value="all">All Collections</option>
                  <option value="users">users</option>
                  <option value="orders">orders</option>
                  <option value="inventory">inventory</option>
                  <option value="products">products</option>
                </select>

                <select
                  className="input-select"
                  value={filterOperation}
                  onChange={(e) => setFilterOperation(e.target.value)}
                >
                  <option value="all">All Operations</option>
                  <option value="insert">INSERT</option>
                  <option value="update">UPDATE</option>
                  <option value="delete">DELETE</option>
                </select>

                <input
                  type="text"
                  placeholder="Filter payload or ID..."
                  className="input-search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="table-wrapper">
              <table className="cdc-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Op Type</th>
                    <th>Namespace</th>
                    <th>Document Key</th>
                    <th>Payload Changes Preview</th>
                    <th>Size</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEvents.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                        No CDC events captured yet. Toggle the Auto Simulator or trigger a manual mutation.
                      </td>
                    </tr>
                  ) : (
                    filteredEvents.map((evt) => {
                      const isNew = newRowIds.has(evt._id._data);
                      const wallTimeFormatted = new Date(evt.wallTime).toLocaleTimeString([], {
                        hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3
                      });

                      let previewText = '';
                      if (evt.operationType === 'insert') {
                        previewText = JSON.stringify(evt.fullDocument);
                      } else if (evt.operationType === 'update') {
                        previewText = JSON.stringify(evt.updateDescription?.updatedFields || {});
                      } else if (evt.operationType === 'delete') {
                        previewText = `Deleted ${evt.documentKey._id}`;
                      }

                      return (
                        <tr key={evt._id._data} className={isNew ? 'cdc-row-new' : ''}>
                          <td style={{ fontFamily: 'var(--font-code)', fontSize: '0.78rem', color: '#94a3b8' }}>
                            {wallTimeFormatted}
                          </td>
                          <td>
                            <span className={`badge badge-${evt.operationType}`}>
                              {evt.operationType}
                            </span>
                          </td>
                          <td className="ns-tag">{evt.ns.db}.{evt.ns.coll}</td>
                          <td className="doc-key">{evt.documentKey._id}</td>
                          <td style={{ fontFamily: 'var(--font-code)', fontSize: '0.75rem', color: '#cbd5e1', maxWidth: '280px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {previewText}
                          </td>
                          <td style={{ fontFamily: 'var(--font-code)', fontSize: '0.75rem', color: '#64748b' }}>
                            {evt.payloadSizeBytes} B
                          </td>
                          <td>
                            <button
                              className="btn"
                              style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                              onClick={() => {
                                setActiveModalEvent(evt);
                                setModalTab('diff');
                              }}
                            >
                              Inspect Schema & Diff
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: Dynamic CRUD Mutation Trigger Panel */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          <div className="card">
            <h2 className="card-title">
              <span>⚡</span> Dynamic CRUD Mutation Trigger
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
              Manually mutate database records via REST API to observe immediate Mongo Change Stream generation.
            </p>

            {/* Quick Presets */}
            <div>
              <div className="form-label" style={{ marginBottom: '0.4rem' }}>Quick Presets:</div>
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                <button className="btn" style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }} onClick={() => applyPreset('user_insert')}>
                  + Add User
                </button>
                <button className="btn" style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }} onClick={() => applyPreset('order_checkout')}>
                  + Place Order
                </button>
                <button className="btn" style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }} onClick={() => applyPreset('inventory_update')}>
                  ✎ Inventory Restock
                </button>
                <button className="btn" style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }} onClick={() => applyPreset('product_price_drop')}>
                  ✎ Product Discount
                </button>
              </div>
            </div>

            <form onSubmit={handleExecuteMutation} className="mutation-form">
              <div className="form-group">
                <label className="form-label">Target Collection</label>
                <select
                  className="input-select"
                  value={selectedCollection}
                  onChange={(e) => {
                    setSelectedCollection(e.target.value);
                    setSelectedDocId('');
                  }}
                >
                  <option value="users">users ({collectionsData.users.length} docs)</option>
                  <option value="orders">orders ({collectionsData.orders.length} docs)</option>
                  <option value="inventory">inventory ({collectionsData.inventory.length} docs)</option>
                  <option value="products">products ({collectionsData.products.length} docs)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Operation Type</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {['insert', 'update', 'delete'].map(op => (
                    <button
                      key={op}
                      type="button"
                      className={`btn ${selectedOperation === op ? 'btn-primary' : ''}`}
                      style={{ flex: 1, textTransform: 'uppercase', fontSize: '0.78rem' }}
                      onClick={() => setSelectedOperation(op)}
                    >
                      {op}
                    </button>
                  ))}
                </div>
              </div>

              {(selectedOperation === 'update' || selectedOperation === 'delete') && (
                <div className="form-group">
                  <label className="form-label">Target Document ID</label>
                  <select
                    className="input-select"
                    value={selectedDocId}
                    onChange={(e) => setSelectedDocId(e.target.value)}
                    required
                  >
                    <option value="">-- Select Existing Document ID --</option>
                    {(collectionsData[selectedCollection] || []).map(doc => (
                      <option key={doc._id} value={doc._id}>
                        {doc._id} {doc.name || doc.productName || doc.title || ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedOperation !== 'delete' && (
                <div className="form-group">
                  <label className="form-label">JSON Document Mutation Data</label>
                  <textarea
                    className="json-textarea"
                    value={jsonPayload}
                    onChange={(e) => setJsonPayload(e.target.value)}
                    placeholder='{"key": "value"}'
                    required
                  />
                </div>
              )}

              <button type="submit" className="btn btn-primary" style={{ marginTop: '0.5rem', justifyContent: 'center' }}>
                🚀 Execute {selectedOperation.toUpperCase()} Operation
              </button>

              {mutationStatus && (
                <div style={{
                  padding: '0.6rem',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  background: mutationStatus.type === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)',
                  color: mutationStatus.type === 'error' ? '#fca5a5' : '#6ee7b7',
                  border: `1px solid ${mutationStatus.type === 'error' ? 'rgba(239,68,68,0.4)' : 'rgba(16,185,129,0.4)'}`
                }}>
                  {mutationStatus.message}
                </div>
              )}
            </form>
          </div>

        </section>

      </main>

      {/* CDC PAYLOAD SCHEMA & DIFF INSPECTOR MODAL */}
      {activeModalEvent && (
        <div className="modal-overlay" onClick={() => setActiveModalEvent(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span className={`badge badge-${activeModalEvent.operationType}`}>
                  {activeModalEvent.operationType}
                </span>
                <span style={{ fontSize: '1rem', fontWeight: '700', color: '#f1f5f9' }}>
                  CDC Schema Inspector: {activeModalEvent.ns.db}.{activeModalEvent.ns.coll}
                </span>
              </div>
              <button
                className="btn"
                style={{ padding: '0.2rem 0.6rem', fontSize: '0.9rem' }}
                onClick={() => setActiveModalEvent(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-tabs">
              <button
                className={`modal-tab ${modalTab === 'diff' ? 'active' : ''}`}
                onClick={() => setModalTab('diff')}
              >
                Before vs After State Diff
              </button>
              <button
                className={`modal-tab ${modalTab === 'raw' ? 'active' : ''}`}
                onClick={() => setModalTab('raw')}
              >
                Full Mongo CDC Envelope JSON
              </button>
              {activeModalEvent.updateDescription && (
                <button
                  className={`modal-tab ${modalTab === 'updateDesc' ? 'active' : ''}`}
                  onClick={() => setModalTab('updateDesc')}
                >
                  Update Description
                </button>
              )}
            </div>

            <div className="modal-body">
              {modalTab === 'diff' && (
                <div className="diff-grid">
                  <div className="diff-box">
                    <div className="diff-box-title">
                      <span>BEFORE CHANGE STATE (fullDocumentBeforeChange)</span>
                    </div>
                    <pre className="json-code">
                      {activeModalEvent.fullDocumentBeforeChange
                        ? JSON.stringify(activeModalEvent.fullDocumentBeforeChange, null, 2)
                        : '// No prior document state (NEW INSERT)'}
                    </pre>
                  </div>

                  <div className="diff-box">
                    <div className="diff-box-title">
                      <span>AFTER CHANGE STATE (fullDocument)</span>
                    </div>
                    <pre className="json-code">
                      {activeModalEvent.fullDocument
                        ? JSON.stringify(activeModalEvent.fullDocument, null, 2)
                        : '// Document was DELETED'}
                    </pre>
                  </div>
                </div>
              )}

              {modalTab === 'raw' && (
                <div className="diff-box">
                  <div className="diff-box-title">
                    <span>COMPLETE MONGO CHANGE STREAM EVENT PAYLOAD</span>
                    <button
                      className="btn"
                      style={{ padding: '0.1rem 0.4rem', fontSize: '0.7rem' }}
                      onClick={() => navigator.clipboard.writeText(JSON.stringify(activeModalEvent, null, 2))}
                    >
                      Copy JSON
                    </button>
                  </div>
                  <pre className="json-code">
                    {JSON.stringify(activeModalEvent, null, 2)}
                  </pre>
                </div>
              )}

              {modalTab === 'updateDesc' && (
                <div className="diff-box">
                  <div className="diff-box-title">
                    <span>UPDATE DESCRIPTION FIELDS</span>
                  </div>
                  <pre className="json-code">
                    {JSON.stringify(activeModalEvent.updateDescription, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
