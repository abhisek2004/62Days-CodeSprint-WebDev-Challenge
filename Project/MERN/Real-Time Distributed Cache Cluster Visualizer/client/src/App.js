import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { io } from 'socket.io-client';

const SOCKET_SERVER_URL = process.env.REACT_APP_SERVER_URL || 'http://localhost:5000';

// Deterministic Hash Function for Client-side Lookups
function clientHashKey(str, ringSize = 1000) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash) % ringSize;
}

export default function App() {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [clusterState, setClusterState] = useState({
    ringSize: 1000,
    vnodesPerNode: 4,
    defaultCapacity: 8,
    defaultPolicy: 'LRU',
    nodes: [],
    ring: [],
    stats: { hits: 0, misses: 0, evictions: 0, totalOps: 0, totalStoredKeys: 0, hitRate: 0 },
    logs: [],
    autoTraffic: false
  });

  // Forms & Inputs state
  const [setForm, setSetForm] = useState({ key: '', value: '', ttl: '0' });
  const [getForm, setGetForm] = useState({ key: '' });
  const [newNodeForm, setNewNodeForm] = useState({ name: '' });
  const [configForm, setConfigForm] = useState({ capacity: '8', policy: 'LRU', vnodes: '4' });

  // Lookup simulation state
  const [activeLookup, setActiveLookup] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState(null);

  // Initialize Socket.io connection
  useEffect(() => {
    const s = io(SOCKET_SERVER_URL, {
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    s.on('connect', () => {
      setIsConnected(true);
      console.log('Connected to Distributed Cache Server socket');
    });

    s.on('disconnect', () => {
      setIsConnected(false);
    });

    s.on('cluster_state', (state) => {
      setClusterState(state);
      setConfigForm({
        capacity: String(state.defaultCapacity || 8),
        policy: state.defaultPolicy || 'LRU',
        vnodes: String(state.vnodesPerNode || 4)
      });
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  // Handlers for Socket events
  const handleSetKey = (e) => {
    e.preventDefault();
    if (!setForm.key || !setForm.value) return;
    if (socket) {
      socket.emit('set_key', { key: setForm.key, value: setForm.value, ttl: setForm.ttl });
      setSetForm({ key: '', value: '', ttl: '0' });
    }
  };

  const handleGetKey = (e) => {
    if (e) e.preventDefault();
    if (!getForm.key) return;
    const khash = clientHashKey(getForm.key, clusterState.ringSize || 1000);
    setActiveLookup({ key: getForm.key, hash: khash });

    if (socket) {
      socket.emit('get_key', { key: getForm.key });
    }
  };

  const handleDeleteKey = (key) => {
    if (socket) {
      socket.emit('delete_key', { key });
    }
  };

  const handleAddNode = (e) => {
    e.preventDefault();
    const name = newNodeForm.name.trim() || `Cache Node ${String.fromCharCode(65 + clusterState.nodes.length)}`;
    if (socket) {
      socket.emit('add_node', { name });
      setNewNodeForm({ name: '' });
    }
  };

  const handleRemoveNode = (nodeId) => {
    if (socket) {
      socket.emit('remove_node', { nodeId });
    }
  };

  const handleUpdateConfig = (e) => {
    e.preventDefault();
    if (socket) {
      socket.emit('update_config', {
        capacity: Number(configForm.capacity),
        policy: configForm.policy,
        vnodes: Number(configForm.vnodes)
      });
    }
  };

  const handleToggleTraffic = () => {
    if (socket) {
      socket.emit('toggle_traffic', { enabled: !clusterState.autoTraffic });
    }
  };

  const handleSeedKeys = () => {
    if (socket) socket.emit('seed_keys');
  };

  const handleFlushCluster = () => {
    if (socket) socket.emit('flush_cluster');
  };

  // Flatten all keys across all nodes for the Memory Inspector table & Ring
  const allStoredKeys = useMemo(() => {
    const list = [];
    clusterState.nodes.forEach(node => {
      node.keys.forEach(k => {
        list.push({ ...k, nodeName: node.name, nodeColor: node.color });
      });
    });
    return list;
  }, [clusterState.nodes]);

  // Coordinates helper for Consistent Hash Ring SVG
  const calculateRingPoint = (hashVal, radius, centerX = 220, centerY = 220, ringSize = 1000) => {
    const angle = (hashVal / ringSize) * 2 * Math.PI - Math.PI / 2;
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
      angle
    };
  };

  return (
    <div className="app-container">
      {/* Top Navbar */}
      <header className="navbar">
        <div className="brand-section">
          <div className="logo-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <h1 className="brand-title">Distributed Cache Visualizer</h1>
            <p className="brand-subtitle">Consistent Hashing & Real-Time Memory Eviction Cluster Engine</p>
          </div>
        </div>

        <div className="nav-actions">
          <div className={`status-pill ${isConnected ? '' : 'disconnected'}`}>
            <span className="status-dot"></span>
            <span>{isConnected ? 'Cluster Online' : 'Connecting Server...'}</span>
          </div>

          <button
            className={`btn ${clusterState.autoTraffic ? 'btn-traffic-active' : 'btn-secondary'}`}
            onClick={handleToggleTraffic}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            {clusterState.autoTraffic ? 'Stop Traffic Generator' : 'Simulate Traffic'}
          </button>

          <button className="btn btn-secondary" onClick={handleSeedKeys}>
            Seed Demo Keys
          </button>

          <button className="btn btn-danger" onClick={handleFlushCluster}>
            Flush Cluster
          </button>
        </div>
      </header>

      {/* Analytics Metric Cards Grid */}
      <div className="stats-grid">
        <div className="stat-card" style={{ '--card-accent': '#6366f1' }}>
          <div className="stat-header">
            <span>Cache Hit Rate</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div className="stat-value">{clusterState.stats.hitRate}%</div>
          <div className="stat-subtext">
            {clusterState.stats.hits} Hits / {clusterState.stats.misses} Misses ({clusterState.stats.totalOps} Ops)
          </div>
        </div>

        <div className="stat-card" style={{ '--card-accent': '#10b981' }}>
          <div className="stat-header">
            <span>Cluster Stored Keys</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <div className="stat-value">{clusterState.stats.totalStoredKeys}</div>
          <div className="stat-subtext">
            Max Capacity: {clusterState.nodes.length * (clusterState.defaultCapacity || 8)} Keys
          </div>
        </div>

        <div className="stat-card" style={{ '--card-accent': '#ec4899' }}>
          <div className="stat-header">
            <span>Active Physical Nodes</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <div className="stat-value">{clusterState.nodes.length}</div>
          <div className="stat-subtext">
            {clusterState.ring.length} Virtual Nodes on Hash Ring
          </div>
        </div>

        <div className="stat-card" style={{ '--card-accent': '#f59e0b' }}>
          <div className="stat-header">
            <span>Evictions & Purges</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </div>
          <div className="stat-value">{clusterState.stats.evictions}</div>
          <div className="stat-subtext">
            Eviction Policy: <strong style={{ color: '#f59e0b' }}>{clusterState.defaultPolicy}</strong>
          </div>
        </div>
      </div>

      {/* Main Dashboard Section */}
      <div className="dashboard-grid">
        {/* Left Column: Consistent Hash Ring Visualizer */}
        <div className="card-panel">
          <div className="panel-header">
            <div className="panel-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
              Consistent Hashing Ring Visualizer
            </div>
            <span className="badge-policy-tag">0 - 999 Hash Slots</span>
          </div>

          <div className="ring-container">
            <svg className="ring-svg" viewBox="0 0 440 440">
              {/* Outer Hash Ring Circle */}
              <circle
                cx="220"
                cy="220"
                r="160"
                fill="none"
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth="6"
                strokeDasharray="4 4"
              />

              {/* Hash Slot Ticks around circle */}
              {Array.from({ length: 12 }).map((_, idx) => {
                const tickHash = (idx / 12) * 1000;
                const pt = calculateRingPoint(tickHash, 172);
                return (
                  <text
                    key={idx}
                    x={pt.x}
                    y={pt.y}
                    fill="rgba(255, 255, 255, 0.25)"
                    fontSize="9"
                    fontFamily="JetBrains Mono"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {Math.round(tickHash)}
                  </text>
                );
              })}

              {/* Connect Key to Nodes Arcs */}
              {allStoredKeys.map((item) => {
                const kPt = calculateRingPoint(item.hash, 160);
                const assignedNode = clusterState.nodes.find(n => n.id === item.physicalNodeId);
                const nodeColor = assignedNode ? assignedNode.color : '#ffffff';
                return (
                  <line
                    key={`line-${item.key}`}
                    x1="220"
                    y1="220"
                    x2={kPt.x}
                    y2={kPt.y}
                    stroke={nodeColor}
                    strokeWidth="1"
                    strokeOpacity="0.2"
                  />
                );
              })}

              {/* Active Lookup Indicator Arc */}
              {activeLookup && (
                <g>
                  {(() => {
                    const lPt = calculateRingPoint(activeLookup.hash, 160);
                    return (
                      <>
                        <line
                          x1="220"
                          y1="220"
                          x2={lPt.x}
                          y2={lPt.y}
                          stroke="#06b6d4"
                          strokeWidth="3"
                          strokeDasharray="6 3"
                        >
                          <animate attributeName="stroke-dashoffset" from="18" to="0" dur="0.8s" repeatCount="indefinite" />
                        </line>
                        <circle cx={lPt.x} cy={lPt.y} r="8" fill="none" stroke="#06b6d4" strokeWidth="2">
                          <animate attributeName="r" values="6;12;6" dur="1.2s" repeatCount="indefinite" />
                        </circle>
                      </>
                    );
                  })()}
                </g>
              )}

              {/* Virtual Node Markers on Hash Ring */}
              {clusterState.ring.map((vnode) => {
                const pt = calculateRingPoint(vnode.hash, 160);
                const isNodeSelected = selectedNodeId === vnode.nodeId;
                return (
                  <g key={vnode.vnodeId} style={{ cursor: 'pointer' }} onClick={() => setSelectedNodeId(vnode.nodeId)}>
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r={isNodeSelected ? "9" : "6"}
                      fill={vnode.color}
                      stroke="#090d16"
                      strokeWidth="2"
                    />
                  </g>
                );
              })}

              {/* Stored Key Dots on Ring */}
              {allStoredKeys.map((item) => {
                const pt = calculateRingPoint(item.hash, 160);
                return (
                  <circle
                    key={`dot-${item.key}`}
                    cx={pt.x}
                    cy={pt.y}
                    r="4"
                    fill="#ffffff"
                    stroke={item.nodeColor}
                    strokeWidth="2"
                  >
                    <title>{`${item.key} -> ${item.nodeName} (Slot: ${item.hash})`}</title>
                  </circle>
                );
              })}

              {/* Center Info Ring Hub */}
              <foreignObject x="130" y="130" width="180" height="180">
                <div className="ring-center-info">
                  <span className="ring-center-title">Cluster Nodes</span>
                  <span className="ring-center-val">{clusterState.nodes.length} Nodes</span>
                  <span className="ring-center-sub">{clusterState.ring.length} Virtual Replicas</span>
                </div>
              </foreignObject>
            </svg>
          </div>

          {/* Node Chip Quick List & Management */}
          <div className="panel-header" style={{ marginTop: '0.5rem' }}>
            <span className="form-label">Physical Cluster Nodes</span>
            <form onSubmit={handleAddNode} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                className="form-input"
                placeholder="New Node Name..."
                value={newNodeForm.name}
                onChange={(e) => setNewNodeForm({ name: e.target.value })}
                style={{ width: '150px', padding: '0.35rem 0.65rem' }}
              />
              <button type="submit" className="btn btn-primary" style={{ padding: '0.35rem 0.75rem' }}>
                + Add Node
              </button>
            </form>
          </div>

          <div className="nodes-list">
            {clusterState.nodes.map((node) => (
              <div
                key={node.id}
                className="node-chip"
                style={{ borderColor: selectedNodeId === node.id ? node.color : 'rgba(255, 255, 255, 0.08)' }}
                onClick={() => setSelectedNodeId(node.id === selectedNodeId ? null : node.id)}
              >
                <span className="node-color-dot" style={{ backgroundColor: node.color }}></span>
                <span>{node.name}</span>
                <span className="node-chip-badge">{node.keyCount}/{node.capacity}</span>
                <button
                  className="node-del-btn"
                  title="Remove Node (Trigger Failover)"
                  onClick={(e) => { e.stopPropagation(); handleRemoveNode(node.id); }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {/* Cluster Eviction Policy & Virtual Node Settings Form */}
          <form onSubmit={handleUpdateConfig} className="control-row" style={{ marginTop: '0.5rem' }}>
            <div className="form-group">
              <label className="form-label">Eviction Policy</label>
              <select
                className="form-select"
                value={configForm.policy}
                onChange={(e) => setConfigForm({ ...configForm, policy: e.target.value })}
              >
                <option value="LRU">LRU (Least Recently Used)</option>
                <option value="LFU">LFU (Least Frequently Used)</option>
                <option value="TTL">TTL (Time To Live Expiration)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Node Max Capacity</label>
              <input
                type="number"
                min="2"
                max="30"
                className="form-input"
                value={configForm.capacity}
                onChange={(e) => setConfigForm({ ...configForm, capacity: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">VNodes / Physical Node</label>
              <input
                type="number"
                min="1"
                max="8"
                className="form-input"
                value={configForm.vnodes}
                onChange={(e) => setConfigForm({ ...configForm, vnodes: e.target.value })}
              />
            </div>

            <div className="form-group" style={{ justifyContent: 'flex-end' }}>
              <button type="submit" className="btn btn-secondary">
                Apply Settings
              </button>
            </div>
          </form>
        </div>

        {/* Right Column: Eviction Policy Simulator & Slot Distribution */}
        <div className="card-panel">
          <div className="panel-header">
            <div className="panel-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="8" rx="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" />
                <line x1="6" y1="6" x2="6.01" y2="6" />
                <line x1="6" y1="18" x2="6.01" y2="18" />
              </svg>
              Memory Eviction & Queue Inspector
            </div>
            <span className="badge-policy-tag" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
              Active Policy: {clusterState.defaultPolicy}
            </span>
          </div>

          {/* Node Cache Memory Memory Boxes */}
          <div className="policy-visualizer-grid">
            {clusterState.nodes.map((node) => {
              const fillPct = Math.min(100, Math.round((node.keyCount / node.capacity) * 100));
              return (
                <div key={node.id} className="node-cache-box">
                  <div className="node-box-header">
                    <div className="node-box-title">
                      <span className="node-color-dot" style={{ backgroundColor: node.color }}></span>
                      <span>{node.name}</span>
                    </div>
                    <span className="mono-cell" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {node.keyCount} / {node.capacity} Keys
                    </span>
                  </div>

                  <div className="node-meter-bar">
                    <div
                      className="node-meter-fill"
                      style={{
                        width: `${fillPct}%`,
                        backgroundColor: fillPct > 85 ? '#ef4444' : fillPct > 60 ? '#f59e0b' : node.color
                      }}
                    />
                  </div>

                  <div className="key-list-mini">
                    {node.keys.length === 0 ? (
                      <div className="empty-state" style={{ padding: '0.75rem' }}>
                        <span>Empty Cache Memory</span>
                      </div>
                    ) : (
                      node.keys.map((item) => (
                        <div key={item.key} className="key-item-card">
                          <div className="key-item-left">
                            <span className="key-name">{item.key}</span>
                            <span className="key-val">{item.value}</span>
                          </div>

                          <div className="key-item-right">
                            {node.policy === 'LRU' && (
                              <span className="badge-policy-tag" title="Last accessed timestamp">
                                {Math.max(0, Math.round((Date.now() - item.lastAccessed) / 1000))}s ago
                              </span>
                            )}
                            {node.policy === 'LFU' && (
                              <span className="badge-policy-tag" style={{ background: 'rgba(236, 72, 153, 0.15)', color: '#f472b6' }} title="Access Count">
                                {item.accessCount} Hits
                              </span>
                            )}
                            {node.policy === 'TTL' && (
                              <span className="badge-policy-tag" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' }} title="TTL Seconds Remaining">
                                {item.ttlRemaining !== null ? `${item.ttlRemaining}s TTL` : 'No TTL'}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Key Hash Slot Distribution Graph */}
          <div className="panel-header" style={{ marginTop: '0.5rem' }}>
            <div className="panel-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
              Key Partition Distribution Across Nodes
            </div>
          </div>

          <div className="dist-chart-container">
            {clusterState.nodes.map((node) => {
              const totalKeys = clusterState.stats.totalStoredKeys || 1;
              const pct = Math.round((node.keyCount / totalKeys) * 100);
              return (
                <div key={`dist-${node.id}`} className="dist-bar-item">
                  <div className="dist-bar-label">
                    <span>{node.name}</span>
                    <span className="mono-cell">{node.keyCount} keys ({pct}%)</span>
                  </div>
                  <div className="dist-bar-track">
                    <div
                      className="dist-bar-fill"
                      style={{ width: `${Math.max(5, pct)}%`, backgroundColor: node.color }}
                    >
                      {pct > 10 && `${pct}%`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Interactive Key-Value Operations & Memory Inspector */}
      <div className="card-panel">
        <div className="panel-header">
          <div className="panel-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Interactive Cache Key Inspector & Operation Simulator
          </div>
        </div>

        {/* Quick Operations Bar */}
        <div className="action-bar">
          {/* SET Form */}
          <form onSubmit={handleSetKey} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flex: 1 }}>
            <input
              type="text"
              className="form-input"
              placeholder="Key (e.g. user:200)"
              value={setForm.key}
              onChange={(e) => setSetForm({ ...setForm, key: e.target.value })}
              style={{ minWidth: '140px' }}
            />
            <input
              type="text"
              className="form-input"
              placeholder="Value..."
              value={setForm.value}
              onChange={(e) => setSetForm({ ...setForm, value: e.target.value })}
              style={{ minWidth: '160px' }}
            />
            <input
              type="number"
              min="0"
              className="form-input"
              placeholder="TTL (s)"
              value={setForm.ttl}
              onChange={(e) => setSetForm({ ...setForm, ttl: e.target.value })}
              style={{ width: '80px' }}
            />
            <button type="submit" className="btn btn-primary">
              SET Key
            </button>
          </form>

          {/* GET Form */}
          <form onSubmit={handleGetKey} style={{ display: 'flex', gap: '0.5rem', minWidth: '260px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="Lookup Key..."
              value={getForm.key}
              onChange={(e) => setGetForm({ key: e.target.value })}
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-secondary">
              GET Key
            </button>
          </form>
        </div>

        {/* Memory Inspector Data Table */}
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Key Name</th>
                <th>Stored Value</th>
                <th>Target Node</th>
                <th>Ring Hash Slot</th>
                <th>Access Count</th>
                <th>TTL Remaining</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {allStoredKeys.length === 0 ? (
                <tr>
                  <td colSpan="7">
                    <div className="empty-state">
                      <p>No keys currently stored in the cache cluster.</p>
                      <button className="btn btn-secondary" onClick={handleSeedKeys} style={{ marginTop: '0.5rem' }}>
                        Seed Sample Keys
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                allStoredKeys.map((item) => (
                  <tr key={item.key}>
                    <td className="mono-cell" style={{ fontWeight: '700', color: 'var(--accent-cyan)' }}>
                      {item.key}
                    </td>
                    <td>{item.value}</td>
                    <td>
                      <span className="node-chip" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
                        <span className="node-color-dot" style={{ backgroundColor: item.nodeColor }}></span>
                        {item.nodeName}
                      </span>
                    </td>
                    <td className="mono-cell">{item.hash} / 999</td>
                    <td className="mono-cell">{item.accessCount} accesses</td>
                    <td className="mono-cell">
                      {item.ttlRemaining !== null ? (
                        <span style={{ color: '#f59e0b' }}>{item.ttlRemaining}s</span>
                      ) : (
                        <span style={{ color: 'var(--text-dim)' }}>Persistent</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                          onClick={() => {
                            setGetForm({ key: item.key });
                            if (socket) socket.emit('get_key', { key: item.key });
                          }}
                        >
                          GET
                        </button>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '0.2rem 0.5rem', fontSize: '0.72rem' }}
                          onClick={() => handleDeleteKey(item.key)}
                        >
                          DEL
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Real-time Activity Audit Feed */}
      <div className="card-panel">
        <div className="panel-header">
          <div className="panel-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            Real-Time Cluster Audit Log
          </div>
          <span className="mono-cell" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Showing latest {clusterState.logs.length} events
          </span>
        </div>

        <div className="log-feed">
          {clusterState.logs.length === 0 ? (
            <div className="empty-state">
              <span>No cluster activity logged yet.</span>
            </div>
          ) : (
            clusterState.logs.map((log) => (
              <div key={log.id} className="log-item">
                <span className="log-time">{log.timestamp}</span>
                <span className={`log-type-tag log-${log.type}`}>{log.type}</span>
                <span className="log-msg">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="footer">
        Distributed Cache Cluster Simulator & Visualizer • Consistent Hashing & Memory Eviction Engine
      </footer>
    </div>
  );
}
