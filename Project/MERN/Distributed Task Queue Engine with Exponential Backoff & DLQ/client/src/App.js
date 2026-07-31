import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const API_BASE_URL = 'http://localhost:5000';

export default function App() {
  const [isConnected, setIsConnected] = useState(false);
  const [metrics, setMetrics] = useState({
    pendingCount: 0,
    activeCount: 0,
    retryingCount: 0,
    dlqCount: 0,
    completedCount: 0,
    totalSubmitted: 0,
    totalRetriesExecuted: 0,
    targetWorkerCount: 4,
    activeWorkers: 0,
    totalWorkers: 4,
    avgLatencyMs: 0,
    throughputJobsPerMin: 0,
    history: []
  });

  const [workers, setWorkers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [dlqTasks, setDlqTasks] = useState([]);
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTask, setSelectedTask] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Task Form State
  const [formData, setFormData] = useState({
    name: 'Order Processing Task',
    type: 'order_process',
    priority: 'high',
    maxRetries: 3,
    baseInterval: 1000,
    backoffMultiplier: 2,
    failureRate: 0.3,
    duration: 1200
  });

  const socketRef = useRef(null);

  useEffect(() => {
    // Establish Socket.IO connection
    const socket = io(API_BASE_URL, {
      transports: ['websocket', 'polling']
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('initial_state', (data) => {
      if (data.metrics) setMetrics(data.metrics);
      if (data.workers) setWorkers(data.workers);
      if (data.dlqTasks) setDlqTasks(data.dlqTasks);
      if (data.recentTasks) setTasks(data.recentTasks);
    });

    socket.on('metrics_tick', (newMetrics) => {
      setMetrics(newMetrics);
    });

    socket.on('workers_updated', (data) => {
      setWorkers(data.workers);
      setMetrics(prev => ({ ...prev, targetWorkerCount: data.targetWorkerCount, totalWorkers: data.workers.length }));
    });

    socket.on('task_created', (newTask) => {
      setTasks(prev => [newTask, ...prev.filter(t => t.id !== newTask.id)].slice(0, 200));
    });

    socket.on('task_updated', (updatedTask) => {
      setTasks(prev => {
        const index = prev.findIndex(t => t.id === updatedTask.id);
        if (index !== -1) {
          const newArr = [...prev];
          newArr[index] = updatedTask;
          return newArr;
        }
        return [updatedTask, ...prev].slice(0, 200);
      });

      setSelectedTask(prev => (prev && prev.id === updatedTask.id ? updatedTask : prev));
    });

    socket.on('dlq_updated', (dlqList) => {
      setDlqTasks(dlqList);
    });

    socket.on('queue_cleared', () => {
      setTasks([]);
      setDlqTasks([]);
      setSelectedTask(null);
    });

    // Fetch initial REST task snapshot
    fetchTasks();

    return () => {
      socket.disconnect();
    };
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/tasks?limit=150`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data);
      }
      const dlqRes = await fetch(`${API_BASE_URL}/api/dlq`);
      if (dlqRes.ok) {
        const dlqData = await dlqRes.json();
        setDlqTasks(dlqData);
      }
    } catch (err) {
      console.error('Error fetching REST snapshot:', err);
    }
  };

  const handleWorkerScale = async (count) => {
    try {
      await fetch(`${API_BASE_URL}/api/workers/scale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count })
      });
    } catch (err) {
      console.error('Scale error:', err);
    }
  };

  const handleInjectBatch = async (count = 15, failureRate = 0.35) => {
    try {
      await fetch(`${API_BASE_URL}/api/simulation/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count, failureRate })
      });
    } catch (err) {
      console.error('Batch inject error:', err);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        type: formData.type,
        priority: formData.priority,
        maxRetries: parseInt(formData.maxRetries, 10),
        baseInterval: parseInt(formData.baseInterval, 10),
        backoffMultiplier: parseFloat(formData.backoffMultiplier),
        payload: {
          duration: parseInt(formData.duration, 10),
          failureRate: parseFloat(formData.failureRate)
        }
      };

      await fetch(`${API_BASE_URL}/api/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      setShowCreateModal(false);
    } catch (err) {
      console.error('Create task error:', err);
    }
  };

  const handleReplayDLQ = async (taskId) => {
    try {
      await fetch(`${API_BASE_URL}/api/dlq/replay/${taskId}`, { method: 'POST' });
    } catch (err) {
      console.error('Replay task error:', err);
    }
  };

  const handleReplayAllDLQ = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/dlq/replay-all`, { method: 'POST' });
    } catch (err) {
      console.error('Replay all error:', err);
    }
  };

  const handlePurgeDLQ = async () => {
    if (!window.confirm('Are you sure you want to purge all Dead-Letter Queue tasks?')) return;
    try {
      await fetch(`${API_BASE_URL}/api/dlq`, { method: 'DELETE' });
    } catch (err) {
      console.error('Purge DLQ error:', err);
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Reset all engine queues and wipe task history?')) return;
    try {
      await fetch(`${API_BASE_URL}/api/tasks/clear`, { method: 'POST' });
    } catch (err) {
      console.error('Clear all error:', err);
    }
  };

  // Filter tasks based on activeTab & searchQuery
  const filteredTasks = tasks.filter(task => {
    if (activeTab === 'pending' && task.status !== 'pending') return false;
    if (activeTab === 'active' && task.status !== 'active') return false;
    if (activeTab === 'retrying' && task.status !== 'retrying') return false;
    if (activeTab === 'completed' && task.status !== 'completed') return false;
    if (activeTab === 'dlq' && task.status !== 'dlq') return false;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return task.id.toLowerCase().includes(q) ||
             task.name.toLowerCase().includes(q) ||
             task.type.toLowerCase().includes(q);
    }
    return true;
  });

  // Calculate exponential backoff simulation preview
  const getBackoffPreview = (attempts, baseMs, multiplier) => {
    const raw = baseMs * Math.pow(multiplier, attempts - 1);
    const capped = Math.min(30000, raw);
    return `${capped}ms (+ jitter)`;
  };

  return (
    <div className="app-container">
      {/* HEADER BAR */}
      <header className="navbar">
        <div className="nav-brand">
          <div className="brand-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
          <div>
            <h1>TaskPulse Engine</h1>
            <span className="subtitle">Distributed Task Queue with Exponential Backoff & DLQ</span>
          </div>
        </div>

        <div className="nav-actions">
          <div className={`status-badge ${isConnected ? 'online' : 'offline'}`}>
            <span className="dot"></span>
            {isConnected ? 'Engine Online' : 'Connecting...'}
          </div>

          <button className="btn btn-secondary" onClick={() => handleInjectBatch(15, 0.35)}>
            ⚡ Inject 15 Jobs
          </button>
          <button className="btn btn-warning" onClick={() => handleInjectBatch(10, 0.85)}>
            🔥 Failure Storm (DLQ Test)
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            + Custom Task
          </button>
          <button className="btn btn-danger-ghost" onClick={handleClearAll} title="Reset Engine">
            🗑️
          </button>
        </div>
      </header>

      {/* METRICS DASHBOARD CARDS */}
      <section className="metrics-grid">
        <div className="metric-card workers-card">
          <div className="card-header">
            <span className="card-title">Worker Threads Pool</span>
            <span className="worker-count-tag">{metrics.activeWorkers} / {metrics.totalWorkers} Active</span>
          </div>
          <div className="worker-scale-control">
            <label>Concurrent Capacity: <strong>{metrics.targetWorkerCount} Workers</strong></label>
            <div className="scale-buttons">
              {[1, 2, 4, 6, 8, 10].map(cnt => (
                <button
                  key={cnt}
                  className={`scale-btn ${metrics.targetWorkerCount === cnt ? 'active' : ''}`}
                  onClick={() => handleWorkerScale(cnt)}
                >
                  {cnt}W
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="metric-card">
          <span className="card-title">Pending Queue</span>
          <div className="metric-value pending-color">{metrics.pendingCount}</div>
          <span className="card-meta">Tasks waiting for worker</span>
        </div>

        <div className="metric-card">
          <span className="card-title">Active Processing</span>
          <div className="metric-value active-color">{metrics.activeCount}</div>
          <span className="card-meta">Executing on threads</span>
        </div>

        <div className="metric-card">
          <span className="card-title">Backoff & Retrying</span>
          <div className="metric-value retrying-color">{metrics.retryingCount}</div>
          <span className="card-meta">Exponential delay active</span>
        </div>

        <div className="metric-card highlight-dlq">
          <div className="card-header">
            <span className="card-title">Dead-Letter Queue</span>
            {metrics.dlqCount > 0 && <span className="dlq-alert-badge">Action Required</span>}
          </div>
          <div className="metric-value dlq-color">{metrics.dlqCount}</div>
          <div className="dlq-card-actions">
            {metrics.dlqCount > 0 && (
              <button className="btn-sm btn-success" onClick={handleReplayAllDLQ}>
                Replay All ({metrics.dlqCount})
              </button>
            )}
          </div>
        </div>

        <div className="metric-card">
          <span className="card-title">Completed Jobs</span>
          <div className="metric-value completed-color">{metrics.completedCount}</div>
          <span className="card-meta">Success execution rate</span>
        </div>

        <div className="metric-card">
          <span className="card-title">Latency & Throughput</span>
          <div className="metric-value text-accent">
            {metrics.avgLatencyMs}<span className="unit">ms</span>
          </div>
          <span className="card-meta">Throughput: {metrics.throughputJobsPerMin} jobs/min</span>
        </div>
      </section>

      {/* REAL-TIME WORKERS POOL VISUALIZER */}
      <section className="section-container">
        <h2 className="section-title">
          <span>Worker Pool Topology</span>
          <span className="live-indicator">● LIVE</span>
        </h2>
        <div className="workers-grid">
          {workers.map((w) => (
            <div key={w.id} className={`worker-node ${w.status}`}>
              <div className="node-header">
                <span className="worker-name">{w.name}</span>
                <span className={`status-pill ${w.status}`}>{w.status.toUpperCase()}</span>
              </div>
              <div className="node-body">
                {w.status === 'busy' ? (
                  <div className="busy-details">
                    <span className="task-id-lbl">Working on:</span>
                    <span className="task-id-val">{w.currentTaskId}</span>
                    <div className="progress-bar-container">
                      <div className="progress-bar-fill"></div>
                    </div>
                  </div>
                ) : (
                  <div className="idle-details">
                    <span className="idle-text">Ready for task assignment</span>
                  </div>
                )}
              </div>
              <div className="node-footer">
                <span>Done: <strong>{w.completedCount}</strong></span>
                <span>Failed: <strong>{w.failedCount}</strong></span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* REAL-TIME TIME-SERIES SPARKLINE CHART */}
      {metrics.history && metrics.history.length > 1 && (
        <section className="section-container chart-section">
          <h2 className="section-title">Queue Telemetry & Latency Real-Time Chart</h2>
          <div className="sparkline-wrapper">
            <svg viewBox="0 0 800 120" className="chart-svg">
              <defs>
                <linearGradient id="gradPending" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.4"/>
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0"/>
                </linearGradient>
                <linearGradient id="gradLatency" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity="0.4"/>
                  <stop offset="100%" stopColor="#a855f7" stopOpacity="0.0"/>
                </linearGradient>
              </defs>

              {/* Render Pending Task Line */}
              {(() => {
                const maxVal = Math.max(10, ...metrics.history.map(h => h.pending + h.active + h.retrying));
                const points = metrics.history.map((h, i) => {
                  const x = (i / (metrics.history.length - 1)) * 780 + 10;
                  const y = 110 - ((h.pending + h.active) / maxVal) * 90;
                  return `${x},${y}`;
                }).join(' ');

                const areaPoints = `10,110 ${points} 790,110`;

                return (
                  <>
                    <polygon points={areaPoints} fill="url(#gradPending)" />
                    <polyline fill="none" stroke="#38bdf8" strokeWidth="2.5" points={points} />
                  </>
                );
              })()}

              {/* Render Avg Latency Line */}
              {(() => {
                const maxVal = Math.max(1000, ...metrics.history.map(h => h.avgLatency));
                const points = metrics.history.map((h, i) => {
                  const x = (i / (metrics.history.length - 1)) * 780 + 10;
                  const y = 110 - (h.avgLatency / maxVal) * 90;
                  return `${x},${y}`;
                }).join(' ');

                return (
                  <polyline fill="none" stroke="#a855f7" strokeWidth="2" strokeDasharray="4 2" points={points} />
                );
              })()}
            </svg>
            <div className="chart-legend">
              <span className="legend-item"><span className="color-box bg-pending"></span> Queue Depth (Pending + Active)</span>
              <span className="legend-item"><span className="color-box bg-latency"></span> Avg Processing Latency (ms)</span>
            </div>
          </div>
        </section>
      )}

      {/* DEAD-LETTER QUEUE (DLQ) SPECIAL INSPECTOR PANEL */}
      {dlqTasks.length > 0 && (
        <section className="section-container dlq-panel">
          <div className="dlq-panel-header">
            <div>
              <h2 className="dlq-title">🚨 Dead-Letter Queue (DLQ) Inspection & Recovery</h2>
              <p className="dlq-sub">Tasks that exceeded max retry attempts require manual intervention or replay.</p>
            </div>
            <div className="dlq-header-btns">
              <button className="btn btn-success" onClick={handleReplayAllDLQ}>
                🔄 Replay All ({dlqTasks.length})
              </button>

              <button className="btn btn-danger" onClick={handlePurgeDLQ}>
                🔥 Purge DLQ
              </button>
            </div>
          </div>

          <div className="dlq-cards-list">
            {dlqTasks.map((t) => {
              const lastErr = t.errorHistory && t.errorHistory.length > 0 ? t.errorHistory[t.errorHistory.length - 1] : null;
              return (
                <div key={t.id} className="dlq-item-card">
                  <div className="dlq-item-top">
                    <div>
                      <span className="dlq-task-id">{t.id}</span>
                      <h3 className="dlq-task-name">{t.name}</h3>
                    </div>
                    <div className="dlq-item-meta">
                      <span className="retry-exhausted-tag">Attempts Exhausted: {t.attempts}/{t.maxRetries}</span>
                      <button className="btn-sm btn-success" onClick={() => handleReplayDLQ(t.id)}>
                        Replay Task
                      </button>
                      <button className="btn-sm btn-secondary" onClick={() => setSelectedTask(t)}>
                        View Stacktrace
                      </button>
                    </div>
                  </div>

                  {lastErr && (
                    <div className="dlq-error-box">
                      <span className="err-msg">❌ {lastErr.error}</span>
                      <pre className="stack-preview">{lastErr.stackTrace}</pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* TASK LIST & CONTROLS */}
      <section className="section-container">
        <div className="controls-bar">
          <div className="tabs">
            {['all', 'pending', 'active', 'retrying', 'completed', 'dlq'].map(tab => (
              <button
                key={tab}
                className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab.toUpperCase()}
                {tab === 'dlq' && dlqTasks.length > 0 && <span className="tab-badge">{dlqTasks.length}</span>}
              </button>
            ))}
          </div>

          <div className="search-box">
            <input
              type="text"
              placeholder="Search by Task ID or Name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* TASK CARDS / TABLE */}
        <div className="task-table-container">
          <table className="task-table">
            <thead>
              <tr>
                <th>Task ID & Name</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Attempts</th>
                <th>Backoff Config</th>
                <th>Worker / Timing</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan="7" className="empty-state">
                    No tasks found matching current filter or search criteria.
                  </td>
                </tr>
              ) : (
                filteredTasks.map(t => (
                  <tr key={t.id} className={`task-row status-${t.status}`}>
                    <td>
                      <div className="task-name-cell">
                        <span className="task-id-code">{t.id}</span>
                        <strong className="task-name-title">{t.name}</strong>
                      </div>
                    </td>
                    <td>
                      <span className={`priority-badge ${t.priority}`}>
                        {t.priority.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge-inline ${t.status}`}>
                        {t.status === 'retrying' ? '🔄 RETRYING' : t.status.toUpperCase()}
                      </span>
                    </td>
                    <td>
                      <span className="attempt-counter">
                        {t.attempts} / {t.maxRetries}
                      </span>
                    </td>
                    <td>
                      <div className="backoff-info">
                        <span>Base: {t.baseInterval}ms | Mult: {t.backoffMultiplier}x</span>
                        {t.status === 'retrying' && t.backoffDelayMs && (
                          <span className="next-delay-text">Next: {(t.backoffDelayMs / 1000).toFixed(1)}s</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {t.status === 'active' && t.workerId && (
                        <span className="worker-assigned">Worker: {t.workerId.substring(0, 12)}</span>
                      )}
                      {t.status === 'completed' && t.executionTimeMs && (
                        <span className="exec-time">Time: {t.executionTimeMs}ms</span>
                      )}
                      {t.status === 'pending' && <span className="text-muted">Queued</span>}
                      {t.status === 'dlq' && <span className="text-danger">Exhausted</span>}
                    </td>
                    <td>
                      <button className="btn-sm btn-secondary" onClick={() => setSelectedTask(t)}>
                        Details & Logs
                      </button>
                      {t.status === 'dlq' && (
                        <button className="btn-sm btn-success" onClick={() => handleReplayDLQ(t.id)}>
                          Replay
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* TASK LOGS & EXPONENTIAL BACKOFF DETAIL MODAL */}
      {selectedTask && (
        <div className="modal-overlay" onClick={() => setSelectedTask(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2>Task Telemetry & Execution Audit Log</h2>
                <span className="task-id-code">{selectedTask.id}</span>
              </div>
              <button className="close-btn" onClick={() => setSelectedTask(null)}>✕</button>
            </div>

            <div className="modal-body">
              <div className="detail-grid">
                <div><strong>Name:</strong> {selectedTask.name}</div>
                <div><strong>Type:</strong> {selectedTask.type}</div>
                <div><strong>Priority:</strong> {selectedTask.priority.toUpperCase()}</div>
                <div><strong>Status:</strong> <span className={`status-badge-inline ${selectedTask.status}`}>{selectedTask.status}</span></div>
                <div><strong>Attempts:</strong> {selectedTask.attempts} / {selectedTask.maxRetries}</div>
                <div><strong>Backoff Config:</strong> Base {selectedTask.baseInterval}ms | {selectedTask.backoffMultiplier}x Multiplier</div>
              </div>

              {/* Backoff Formula Preview */}
              <div className="backoff-formula-box">
                <h4>📐 Exponential Backoff Schedule</h4>
                <div className="formula-steps">
                  {[1, 2, 3, 4].map(att => (
                    <div key={att} className={`step-pill ${selectedTask.attempts === att ? 'current' : ''}`}>
                      Attempt #{att}: {getBackoffPreview(att, selectedTask.baseInterval, selectedTask.backoffMultiplier)}
                    </div>
                  ))}
                </div>
              </div>

              {/* Execution Audit Log Timeline */}
              <h4>📜 Lifecycle Event Logs</h4>
              <div className="logs-timeline">
                {selectedTask.logs.map((log, idx) => (
                  <div key={idx} className={`log-entry log-${log.type}`}>
                    <span className="log-time">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    <span className="log-msg">{log.message}</span>
                  </div>
                ))}
              </div>

              {/* Stack Traces if any errors occurred */}
              {selectedTask.errorHistory && selectedTask.errorHistory.length > 0 && (
                <div className="error-history-section">
                  <h4>❌ Error Traceback History</h4>
                  {selectedTask.errorHistory.map((err, idx) => (
                    <div key={idx} className="err-history-card">
                      <div className="err-header">Attempt #{err.attempt} Failure - {new Date(err.timestamp).toLocaleTimeString()}</div>
                      <div className="err-body">{err.error}</div>
                      <pre className="stack-preview">{err.stackTrace}</pre>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              {selectedTask.status === 'dlq' && (
                <button className="btn btn-success" onClick={() => { handleReplayDLQ(selectedTask.id); setSelectedTask(null); }}>
                  🔄 Replay Task From DLQ
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setSelectedTask(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE CUSTOM TASK MODAL */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Enqueue Custom Task</h2>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateTask}>
              <div className="modal-body form-body">
                <div className="form-group">
                  <label>Task Display Name</label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Task Type</label>
                    <select
                      value={formData.type}
                      onChange={e => setFormData({ ...formData, type: e.target.value })}
                    >
                      <option value="order_process">Order Processing</option>
                      <option value="email_dispatch">Email Dispatch</option>
                      <option value="image_convert">Image Optimization</option>
                      <option value="pdf_generator">PDF Report Gen</option>
                      <option value="webhook_push">Webhook Push</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Priority</label>
                    <select
                      value={formData.priority}
                      onChange={e => setFormData({ ...formData, priority: e.target.value })}
                    >
                      <option value="high">High (High Priority First)</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Max Retries (DLQ Limit)</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={formData.maxRetries}
                      onChange={e => setFormData({ ...formData, maxRetries: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Base Interval (ms)</label>
                    <input
                      type="number"
                      min="100"
                      step="100"
                      value={formData.baseInterval}
                      onChange={e => setFormData({ ...formData, baseInterval: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Backoff Multiplier</label>
                    <input
                      type="number"
                      step="0.5"
                      min="1"
                      max="5"
                      value={formData.backoffMultiplier}
                      onChange={e => setFormData({ ...formData, backoffMultiplier: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label>Simulated Failure Probability</label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="1"
                      value={formData.failureRate}
                      onChange={e => setFormData({ ...formData, failureRate: e.target.value })}
                    />
                    <small className="help-text">0.0 = 0% failure, 1.0 = 100% failure (force DLQ)</small>
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="submit" className="btn btn-primary">Enqueue Task</button>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
