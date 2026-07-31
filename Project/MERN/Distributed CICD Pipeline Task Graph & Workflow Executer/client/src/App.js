import React, { useState, useEffect, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import {
  Play,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal as TerminalIcon,
  Cpu,
  Layers,
  BarChart3,
  GitBranch,
  Search,
  Download,
  Trash2,
  Plus,
  ArrowRight,
  Server,
  Zap,
  Radio,
  X,
  FileCode,
  Shield,
  Box,
  Rocket,
  RefreshCw
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

export default function App() {
  // Navigation & View state
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard | builder | analytics | runs
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  // Core Data States
  const [pipelines, setPipelines] = useState([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState('pipe-1');
  const [runs, setRuns] = useState([]);
  const [activeRunId, setActiveRunId] = useState(null);
  const [logs, setLogs] = useState([]);
  const [metrics, setMetrics] = useState({
    totalRuns: 12,
    successfulRuns: 10,
    failedRuns: 2,
    successRate: 83,
    avgDurationSec: 24,
    stageFailures: { 'node-api-test': 2 }
  });

  // UI Interactivity States
  const [logFilter, setLogFilter] = useState('all'); // all | info | error
  const [logSearch, setLogSearch] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedNodeDetails, setSelectedNodeDetails] = useState(null);
  const [failureDrawerRun, setFailureDrawerRun] = useState(null);
  const [forceFailStage, setForceFailStage] = useState('');

  // Builder Form State
  const [builderPipeline, setBuilderPipeline] = useState({
    name: 'New Custom Microservice Pipeline',
    description: 'Custom parallel CI/CD workflow created in DAG Builder',
    concurrency: 3,
    nodes: [
      { id: 'b-lint', name: 'Code Quality Lint', type: 'lint', command: 'npm run lint', dependencies: [], estDurationSec: 3 },
      { id: 'b-test', name: 'Unit & Contract Test', type: 'test', command: 'npm run test', dependencies: ['b-lint'], estDurationSec: 4 },
      { id: 'b-build', name: 'Docker Build & Push', type: 'build', command: 'docker build -t app:v1 .', dependencies: ['b-test'], estDurationSec: 5 }
    ]
  });

  const socketRef = useRef(null);
  const logEndRef = useRef(null);

  // Initialize Socket.io and initial API fetches
  useEffect(() => {
    // 1. Fetch initial pipelines & metrics
    fetchPipelines();
    fetchRuns();
    fetchMetrics();

    // 2. Connect Socket.io
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      timeout: 4000
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket.io connected:', socket.id);
      setIsSocketConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Socket.io disconnected');
      setIsSocketConnected(false);
    });

    // Real-time events
    socket.on('pipeline:log', (data) => {
      setLogs((prev) => [...prev, data.log]);
    });

    socket.on('pipeline:node-status', (data) => {
      setRuns((prevRuns) =>
        prevRuns.map((r) => {
          if (r.id === data.runId) {
            const updatedNodes = r.nodes.map((n) =>
              n.id === data.nodeId ? { ...n, ...data.node } : n
            );
            return { ...r, nodes: updatedNodes };
          }
          return r;
        })
      );
    });

    socket.on('pipeline:run-update', (data) => {
      setRuns((prev) => {
        const idx = prev.findIndex((r) => r.id === data.runId);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = data.run;
          return updated;
        }
        return [data.run, ...prev];
      });

      // Auto-trigger failure drawer if run failed
      if (data.run.status === 'failed') {
        setFailureDrawerRun(data.run);
      }
    });

    socket.on('pipeline:metrics-update', (updatedMetrics) => {
      setMetrics(updatedMetrics);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Subscribe socket to active run room
  useEffect(() => {
    if (activeRunId && socketRef.current && isSocketConnected) {
      socketRef.current.emit('subscribe:run', activeRunId);
      return () => {
        socketRef.current.emit('unsubscribe:run', activeRunId);
      };
    }
  }, [activeRunId, isSocketConnected]);

  // Auto scroll terminal
  useEffect(() => {
    if (autoScroll && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // API Call Helpers
  const fetchPipelines = async () => {
    try {
      const res = await fetch(`${API_BASE}/pipelines`);
      const data = await res.json();
      if (data.success) {
        setPipelines(data.pipelines);
        if (data.pipelines.length > 0 && !selectedPipelineId) {
          setSelectedPipelineId(data.pipelines[0].id);
        }
      }
    } catch (err) {
      console.warn('Backend server not reached yet. Using local initial pipelines.');
      setPipelines([
        {
          id: 'pipe-1',
          name: 'Full-Stack Web App CI/CD',
          description: 'Lint, unit/integration testing, Docker build, & K8s deployment',
          concurrency: 3,
          nodes: [
            { id: 'node-lint', name: 'ESLint & Formatting', type: 'lint', command: 'npm run lint', dependencies: [], estDurationSec: 3 },
            { id: 'node-unit-test', name: 'Frontend Unit Tests', type: 'test', command: 'npm test -- --coverage', dependencies: ['node-lint'], estDurationSec: 5 },
            { id: 'node-api-test', name: 'Backend API Tests', type: 'test', command: 'pytest tests/api', dependencies: ['node-lint'], estDurationSec: 4 },
            { id: 'node-sec-scan', name: 'Trivy Security Scan', type: 'security', command: 'trivy image scan', dependencies: ['node-lint'], estDurationSec: 4 },
            { id: 'node-build', name: 'Docker Multi-Stage Build', type: 'build', command: 'docker build -t app:latest .', dependencies: ['node-unit-test', 'node-api-test', 'node-sec-scan'], estDurationSec: 6 },
            { id: 'node-e2e', name: 'Cypress E2E Tests', type: 'test', command: 'cypress run --e2e', dependencies: ['node-build'], estDurationSec: 5 },
            { id: 'node-deploy-staging', name: 'Deploy to K8s Staging', type: 'deploy', command: 'kubectl apply -f k8s/staging/', dependencies: ['node-e2e'], estDurationSec: 4 },
            { id: 'node-deploy-prod', name: 'Deploy to AWS ECS Prod', type: 'deploy', command: 'aws ecs update-service --cluster prod', dependencies: ['node-deploy-staging'], estDurationSec: 5 }
          ]
        }
      ]);
    }
  };

  const fetchRuns = async () => {
    try {
      const res = await fetch(`${API_BASE}/runs`);
      const data = await res.json();
      if (data.success) {
        setRuns(data.runs);
        if (data.runs.length > 0) {
          setActiveRunId(data.runs[0].id);
          setLogs(data.runs[0].logs || []);
        }
      }
    } catch (err) {
      console.warn('Using initial run state.');
    }
  };

  const fetchMetrics = async () => {
    try {
      const res = await fetch(`${API_BASE}/metrics`);
      const data = await res.json();
      if (data.success) setMetrics(data.metrics);
    } catch (err) {
      // ignore
    }
  };

  // Trigger New Execution Run
  const handleTriggerRun = async (pipelineIdToRun, customFailNode = null) => {
    const targetPipelineId = pipelineIdToRun || selectedPipelineId || 'pipe-1';
    setLogs([]);
    setSelectedNodeDetails(null);

    try {
      const res = await fetch(`${API_BASE}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipelineId: targetPipelineId,
          simulateFailureNodeId: customFailNode || forceFailStage || null,
          triggeredBy: 'Web Visualizer Dashboard',
          branch: 'main'
        })
      });
      const data = await res.json();
      if (data.success) {
        setActiveRunId(data.run.id);
        setActiveTab('dashboard');
      }
    } catch (err) {
      // Client-side fallback simulation if server is offline
      runClientFallbackSimulation(targetPipelineId, customFailNode || forceFailStage);
    }
  };

  // Client-side fallback runner in case server is not running
  const runClientFallbackSimulation = (pipelineId, failNodeId) => {
    const pipe = pipelines.find((p) => p.id === pipelineId) || pipelines[0];
    const newRunId = `run-${Date.now().toString().slice(-4)}`;

    const newRun = {
      id: newRunId,
      pipelineId: pipe.id,
      pipelineName: pipe.name,
      status: 'running',
      startedAt: new Date().toISOString(),
      triggeredBy: 'Dashboard (Offline Sim)',
      branch: 'main',
      commit: Math.random().toString(36).substring(2, 8),
      nodes: pipe.nodes.map((n) => ({
        id: n.id,
        name: n.name,
        status: 'pending',
        durationSec: 0,
        workerId: null,
        retryCount: 0
      })),
      logs: []
    };

    setRuns((prev) => [newRun, ...prev]);
    setActiveRunId(newRunId);
    setActiveTab('dashboard');

    // Simulate node execution step-by-step
    let nodeIdx = 0;
    const interval = setInterval(() => {
      if (nodeIdx >= pipe.nodes.length) {
        clearInterval(interval);
        setRuns((prev) =>
          prev.map((r) =>
            r.id === newRunId
              ? { ...r, status: 'success', completedAt: new Date().toISOString(), durationSec: 18 }
              : r
          )
        );
        return;
      }

      const currentNode = pipe.nodes[nodeIdx];
      const isFail = failNodeId === currentNode.id;

      // Update node to running
      setRuns((prev) =>
        prev.map((r) => {
          if (r.id === newRunId) {
            const updatedNodes = r.nodes.map((n) =>
              n.id === currentNode.id
                ? { ...n, status: 'running', workerId: `Worker-${(nodeIdx % 3) + 1}` }
                : n
            );
            return { ...r, nodes: updatedNodes };
          }
          return r;
        })
      );

      // Add log
      const newLog = {
        timestamp: new Date().toISOString(),
        level: isFail ? 'error' : 'info',
        node: currentNode.id,
        message: isFail
          ? `❌ Execution failed during ${currentNode.name}: Synthetic assertion error.`
          : `✔ Completed step: ${currentNode.command}`
      };
      setLogs((prev) => [...prev, newLog]);

      if (isFail) {
        clearInterval(interval);
        const failedRun = {
          ...newRun,
          status: 'failed',
          failedNodeId: currentNode.id,
          errorDetails: {
            step: currentNode.id,
            command: currentNode.command,
            exitCode: 1,
            errorMessage: `Error in ${currentNode.name}`,
            stackTrace: `AssertionError: Step failed\n  At ${currentNode.command}`
          }
        };

        setRuns((prev) =>
          prev.map((r) => {
            if (r.id === newRunId) {
              const updatedNodes = r.nodes.map((n) =>
                n.id === currentNode.id
                  ? { ...n, status: 'failed', error: 'AssertionError' }
                  : n.status === 'pending'
                  ? { ...n, status: 'cancelled' }
                  : n
              );
              return { ...r, ...failedRun, nodes: updatedNodes };
            }
            return r;
          })
        );
        setFailureDrawerRun(failedRun);
        return;
      }

      // Mark success
      setTimeout(() => {
        setRuns((prev) =>
          prev.map((r) => {
            if (r.id === newRunId) {
              const updatedNodes = r.nodes.map((n) =>
                n.id === currentNode.id ? { ...n, status: 'success', durationSec: 3 } : n
              );
              return { ...r, nodes: updatedNodes };
            }
            return r;
          })
        );
      }, 800);

      nodeIdx++;
    }, 1500);
  };

  // Retry Failed Execution
  const handleRetryRun = async (runId, nodeId = null) => {
    setFailureDrawerRun(null);
    try {
      const res = await fetch(`${API_BASE}/runs/${runId}/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId })
      });
      const data = await res.json();
      if (data.success) {
        setActiveRunId(runId);
      }
    } catch (err) {
      // Offline fallback
      handleTriggerRun(selectedPipelineId);
    }
  };

  // Cancel Running Pipeline
  const handleCancelRun = async (runId) => {
    try {
      await fetch(`${API_BASE}/runs/${runId}/cancel`, { method: 'POST' });
    } catch (err) {
      setRuns((prev) =>
        prev.map((r) => (r.id === runId ? { ...r, status: 'cancelled' } : r))
      );
    }
  };

  // Create Pipeline from Builder
  const handleSavePipeline = async () => {
    if (!builderPipeline.name.trim()) return;
    try {
      const res = await fetch(`${API_BASE}/pipelines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(builderPipeline)
      });
      const data = await res.json();
      if (data.success) {
        setPipelines((prev) => [...prev, data.pipeline]);
        setSelectedPipelineId(data.pipeline.id);
        setActiveTab('dashboard');
      }
    } catch (err) {
      const customPipe = {
        ...builderPipeline,
        id: `pipe-${Date.now()}`
      };
      setPipelines((prev) => [...prev, customPipe]);
      setSelectedPipelineId(customPipe.id);
      setActiveTab('dashboard');
    }
  };

  // Currently Active Pipeline Template & Active Run
  const activePipelineTemplate = useMemo(() => {
    return (
      pipelines.find((p) => p.id === selectedPipelineId) ||
      pipelines[0] || { nodes: [] }
    );
  }, [pipelines, selectedPipelineId]);

  const activeRun = useMemo(() => {
    return runs.find((r) => r.id === activeRunId) || runs[0] || null;
  }, [runs, activeRunId]);

  // Compute Topological Columns for DAG Layout Visualizer
  const dagColumns = useMemo(() => {
    const nodes = activeRun ? activeRun.nodes : activePipelineTemplate.nodes || [];
    const templateNodes = activePipelineTemplate.nodes || [];
    const templateMap = new Map(templateNodes.map((n) => [n.id, n]));

    // Calculate topological depths
    const depths = new Map();
    const computeDepth = (id, visited = new Set()) => {
      if (depths.has(id)) return depths.get(id);
      if (visited.has(id)) return 0; // cycle guard
      visited.add(id);

      const nodeObj = templateMap.get(id);
      if (!nodeObj || !nodeObj.dependencies || nodeObj.dependencies.length === 0) {
        depths.set(id, 0);
        return 0;
      }

      let maxParentDepth = 0;
      for (const depId of nodeObj.dependencies) {
        maxParentDepth = Math.max(maxParentDepth, computeDepth(depId, new Set(visited)));
      }
      const myDepth = maxParentDepth + 1;
      depths.set(id, myDepth);
      return myDepth;
    };

    nodes.forEach((n) => computeDepth(n.id));

    // Group into depth columns
    const columns = [];
    nodes.forEach((n) => {
      const d = depths.get(n.id) || 0;
      if (!columns[d]) columns[d] = [];
      const templateInfo = templateMap.get(n.id) || {};
      columns[d].push({ ...n, ...templateInfo, status: n.status || 'pending' });
    });

    return columns.filter(Boolean);
  }, [activeRun, activePipelineTemplate]);

  // Log filter helper
  const filteredLogs = useMemo(() => {
    let currentLogs = logs;
    if (activeRun && activeRun.logs && activeRun.logs.length > logs.length) {
      currentLogs = activeRun.logs;
    }

    return currentLogs.filter((log) => {
      if (logFilter === 'info' && log.level !== 'info') return false;
      if (logFilter === 'error' && log.level !== 'error') return false;
      if (logSearch) {
        const query = logSearch.toLowerCase();
        return (
          log.message.toLowerCase().includes(query) ||
          log.node.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [logs, activeRun, logFilter, logSearch]);

  // Helper node icon getter
  const getNodeIcon = (type) => {
    switch (type) {
      case 'lint': return <FileCode size={16} />;
      case 'test': return <CheckCircle2 size={16} />;
      case 'build': return <Box size={16} />;
      case 'security': return <Shield size={16} />;
      case 'deploy': return <Rocket size={16} />;
      default: return <Layers size={16} />;
    }
  };

  return (
    <div className="app-container">
      {/* Top Header Navigation */}
      <header className="navbar">
        <div className="brand-section">
          <div className="brand-icon">
            <Zap size={24} />
          </div>
          <div>
            <h1 className="brand-title">Distributed CI/CD Task Graph</h1>
            <p className="brand-subtitle">Parallel Workflow Executer & Real-Time Log Engine</p>
          </div>
        </div>

        <div className="nav-controls">
          <div className="socket-status">
            <div className={`pulse-dot ${isSocketConnected ? 'online' : 'offline'}`} />
            <span>{isSocketConnected ? 'WebSocket Live' : 'Polling / Local Mode'}</span>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <select
              className="form-select"
              style={{ width: '220px', padding: '0.5rem' }}
              value={selectedPipelineId}
              onChange={(e) => setSelectedPipelineId(e.target.value)}
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <button
              className="btn-primary"
              onClick={() => handleTriggerRun(selectedPipelineId)}
            >
              <Play size={16} /> Execute Pipeline
            </button>

            <button
              className="btn-secondary"
              title="Simulate Stage Failure for Testing Alert Drawer"
              onClick={() => {
                const failTarget = activePipelineTemplate.nodes[1]?.id || 'node-api-test';
                handleTriggerRun(selectedPipelineId, failTarget);
              }}
            >
              <AlertTriangle size={15} color="#f59e0b" /> Simulate Failure
            </button>
          </div>
        </div>
      </header>

      {/* Primary Navigation Tabs */}
      <nav className="tabs-bar">
        <button
          className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <Layers size={18} /> Executive Dashboard
        </button>
        <button
          className={`tab-btn ${activeTab === 'builder' ? 'active' : ''}`}
          onClick={() => setActiveTab('builder')}
        >
          <Zap size={18} /> DAG Graph Builder
        </button>
        <button
          className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <BarChart3 size={18} /> Build Metrics & Analytics
        </button>
        <button
          className={`tab-btn ${activeTab === 'runs' ? 'active' : ''}`}
          onClick={() => setActiveTab('runs')}
        >
          <Clock size={18} /> Execution History ({runs.length})
        </button>
      </nav>

      {/* Main App Container */}
      <main className="main-content">
        {/* KPI Metrics Cards Top Bar */}
        <div className="kpi-grid">
          <div className="kpi-card">
            <div className="kpi-info">
              <p>Total Executions</p>
              <div className="kpi-value">{metrics.totalRuns}</div>
            </div>
            <div className="kpi-icon blue">
              <Layers size={24} />
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-info">
              <p>Build Success Rate</p>
              <div className="kpi-value" style={{ color: metrics.successRate > 75 ? '#10b981' : '#f59e0b' }}>
                {metrics.successRate}%
              </div>
            </div>
            <div className="kpi-icon green">
              <CheckCircle2 size={24} />
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-info">
              <p>Avg Build Duration</p>
              <div className="kpi-value">{metrics.avgDurationSec}s</div>
            </div>
            <div className="kpi-icon amber">
              <Clock size={24} />
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-info">
              <p>Parallel Cluster Workers</p>
              <div className="kpi-value">{activePipelineTemplate.concurrency || 3} Active</div>
            </div>
            <div className="kpi-icon purple">
              <Cpu size={24} />
            </div>
          </div>
        </div>

        {/* TAB 1: EXECUTIVE DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="dashboard-grid">
            {/* Left Column: DAG Canvas + Log Terminal */}
            <div>
              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title">
                    <GitBranch size={20} color="#38bdf8" />
                    <span>DAG Pipeline Stage Execution Graph</span>
                    {activeRun && (
                      <span className={`status-pill ${activeRun.status}`}>
                        {activeRun.status}
                      </span>
                    )}
                  </div>
                  {activeRun && activeRun.status === 'running' && (
                    <button
                      className="btn-danger"
                      onClick={() => handleCancelRun(activeRun.id)}
                    >
                      <XCircle size={15} /> Cancel Execution
                    </button>
                  )}
                </div>

                {/* Interactive Visual DAG Grid */}
                <div className="dag-canvas-container">
                  <div className="dag-graph">
                    {dagColumns.map((col, colIdx) => (
                      <div className="dag-column" key={`col-${colIdx}`}>
                        {col.map((node) => (
                          <div
                            key={node.id}
                            className={`dag-node status-${node.status}`}
                            onClick={() => setSelectedNodeDetails(node)}
                          >
                            <div className="dag-node-header">
                              <span className={`node-type-badge ${node.type || 'build'}`}>
                                {node.type || 'stage'}
                              </span>
                              {node.status === 'running' && <RefreshCw size={14} className="spin" color="#38bdf8" />}
                              {node.status === 'success' && <CheckCircle2 size={15} color="#10b981" />}
                              {node.status === 'failed' && <XCircle size={15} color="#ef4444" />}
                              {node.status === 'pending' && <Clock size={14} color="#64748b" />}
                            </div>

                            <div className="dag-node-name">{node.name}</div>

                            <div className="dag-node-footer">
                              <span className="worker-badge">
                                {node.workerId || 'Worker Idle'}
                              </span>
                              <span>{node.durationSec ? `${node.durationSec}s` : `${node.estDurationSec || 4}s est`}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Real-time Log Console Stream */}
              <div className="console-wrapper">
                <div className="console-header">
                  <div className="console-title">
                    <TerminalIcon size={16} />
                    <span>Real-Time Log Stream Console [{activeRun ? activeRun.id : 'No active run'}]</span>
                  </div>

                  <div className="console-controls">
                    <input
                      type="text"
                      className="console-search"
                      placeholder="Search logs..."
                      value={logSearch}
                      onChange={(e) => setLogSearch(e.target.value)}
                    />

                    <button
                      className={`console-btn ${logFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setLogFilter('all')}
                    >
                      All
                    </button>
                    <button
                      className={`console-btn ${logFilter === 'info' ? 'active' : ''}`}
                      onClick={() => setLogFilter('info')}
                    >
                      Info
                    </button>
                    <button
                      className={`console-btn ${logFilter === 'error' ? 'active' : ''}`}
                      onClick={() => setLogFilter('error')}
                    >
                      Errors
                    </button>

                    <button
                      className={`console-btn ${autoScroll ? 'active' : ''}`}
                      onClick={() => setAutoScroll(!autoScroll)}
                    >
                      Auto-scroll
                    </button>

                    <button
                      className="console-btn"
                      onClick={() => setLogs([])}
                      title="Clear Terminal"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="log-stream">
                  {filteredLogs.length === 0 ? (
                    <div style={{ color: '#64748b', fontStyle: 'italic', padding: '1rem' }}>
                      Ready. Logs will stream live when pipeline steps execute...
                    </div>
                  ) : (
                    filteredLogs.map((log, idx) => (
                      <div key={idx} className={`log-line ${log.level}`}>
                        <span className="log-time">
                          [{new Date(log.timestamp).toLocaleTimeString()}]
                        </span>
                        <span className="log-node">[{log.node}]</span>
                        <span className="log-msg">{log.message}</span>
                      </div>
                    ))
                  )}
                  <div ref={logEndRef} />
                </div>
              </div>
            </div>

            {/* Right Column: Parallel Job Runner Monitor & Run Metadata */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title">
                    <Cpu size={18} color="#a855f7" />
                    <span>Parallel Job Runner Cluster</span>
                  </div>
                </div>

                <div className="workers-list">
                  {['Worker-1', 'Worker-2', 'Worker-3'].map((wId, i) => {
                    const activeNodeOnWorker = activeRun?.nodes?.find(
                      (n) => n.workerId === wId && n.status === 'running'
                    );

                    return (
                      <div key={wId} className="worker-card">
                        <div className="worker-header">
                          <div className="worker-title">
                            <Server size={14} color="#38bdf8" />
                            <span>{wId}</span>
                          </div>
                          <span
                            className={`badge-tag`}
                            style={{
                              background: activeNodeOnWorker
                                ? 'rgba(56,189,248,0.2)'
                                : 'rgba(255,255,255,0.05)',
                              color: activeNodeOnWorker ? '#38bdf8' : '#64748b'
                            }}
                          >
                            {activeNodeOnWorker ? 'EXECUTING' : 'IDLE'}
                          </span>
                        </div>

                        <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                          {activeNodeOnWorker
                            ? `Task: ${activeNodeOnWorker.name}`
                            : 'Waiting for available DAG tasks...'}
                        </p>

                        <div className="progress-bar-bg">
                          <div
                            className={`progress-bar-fill ${
                              activeNodeOnWorker ? 'busy' : ''
                            }`}
                            style={{ width: activeNodeOnWorker ? '75%' : '0%' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active Run Overview Card */}
              {activeRun && (
                <div className="panel">
                  <div className="panel-header">
                    <div className="panel-title">
                      <Radio size={18} color="#10b981" />
                      <span>Run #{activeRun.id} Metadata</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>Pipeline:</span>
                      <span style={{ fontWeight: 600 }}>{activeRun.pipelineName}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>Triggered By:</span>
                      <span>{activeRun.triggeredBy}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>Git Commit:</span>
                      <span style={{ fontFamily: 'monospace', color: '#38bdf8' }}>
                        {activeRun.branch} ({activeRun.commit})
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>Started At:</span>
                      <span>{new Date(activeRun.startedAt).toLocaleTimeString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#94a3b8' }}>Duration:</span>
                      <span>{activeRun.durationSec ? `${activeRun.durationSec}s` : 'In progress...'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: DAG GRAPH BUILDER */}
        {activeTab === 'builder' && (
          <div className="panel" style={{ maxWidth: '900px', margin: '0 auto' }}>
            <div className="panel-header">
              <div className="panel-title">
                <Zap size={20} color="#38bdf8" />
                <span>Interactive DAG Pipeline Stage Builder</span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Pipeline Name</label>
              <input
                type="text"
                className="form-input"
                value={builderPipeline.name}
                onChange={(e) => setBuilderPipeline({ ...builderPipeline, name: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <input
                type="text"
                className="form-input"
                value={builderPipeline.description}
                onChange={(e) => setBuilderPipeline({ ...builderPipeline, description: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Parallel Worker Concurrency Limit</label>
              <input
                type="number"
                min="1"
                max="8"
                className="form-input"
                value={builderPipeline.concurrency}
                onChange={(e) => setBuilderPipeline({ ...builderPipeline, concurrency: parseInt(e.target.value) || 3 })}
              />
            </div>

            <h3 style={{ margin: '1.5rem 0 1rem 0', fontFamily: 'Outfit', fontSize: '1.1rem' }}>
              Workflow Stage Nodes ({builderPipeline.nodes.length})
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {builderPipeline.nodes.map((node, index) => (
                <div
                  key={node.id}
                  style={{
                    background: 'rgba(30, 41, 59, 0.6)',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    padding: '1rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
                      <span className="badge-tag">{index + 1}</span>
                      <span>{node.name || 'Unnamed Stage'}</span>
                    </div>
                    <button
                      className="btn-danger"
                      style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}
                      onClick={() => {
                        const updated = builderPipeline.nodes.filter((n) => n.id !== node.id);
                        setBuilderPipeline({ ...builderPipeline, nodes: updated });
                      }}
                    >
                      Remove
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <label className="form-label">Node ID</label>
                      <input
                        type="text"
                        className="form-input"
                        value={node.id}
                        onChange={(e) => {
                          const updated = [...builderPipeline.nodes];
                          updated[index].id = e.target.value;
                          setBuilderPipeline({ ...builderPipeline, nodes: updated });
                        }}
                      />
                    </div>
                    <div>
                      <label className="form-label">Stage Name</label>
                      <input
                        type="text"
                        className="form-input"
                        value={node.name}
                        onChange={(e) => {
                          const updated = [...builderPipeline.nodes];
                          updated[index].name = e.target.value;
                          setBuilderPipeline({ ...builderPipeline, nodes: updated });
                        }}
                      />
                    </div>
                    <div>
                      <label className="form-label">Type</label>
                      <select
                        className="form-select"
                        value={node.type}
                        onChange={(e) => {
                          const updated = [...builderPipeline.nodes];
                          updated[index].type = e.target.value;
                          setBuilderPipeline({ ...builderPipeline, nodes: updated });
                        }}
                      >
                        <option value="lint">lint</option>
                        <option value="test">test</option>
                        <option value="build">build</option>
                        <option value="security">security</option>
                        <option value="deploy">deploy</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ marginTop: '0.75rem' }}>
                    <label className="form-label">Command / Script</label>
                    <input
                      type="text"
                      className="form-input"
                      value={node.command}
                      onChange={(e) => {
                        const updated = [...builderPipeline.nodes];
                        updated[index].command = e.target.value;
                        setBuilderPipeline({ ...builderPipeline, nodes: updated });
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button
                className="btn-secondary"
                onClick={() => {
                  const newId = `stage-${Date.now().toString().slice(-4)}`;
                  setBuilderPipeline({
                    ...builderPipeline,
                    nodes: [
                      ...builderPipeline.nodes,
                      {
                        id: newId,
                        name: 'New Stage',
                        type: 'test',
                        command: 'npm test',
                        dependencies: [],
                        estDurationSec: 4
                      }
                    ]
                  });
                }}
              >
                <Plus size={16} /> Add DAG Stage Node
              </button>

              <button className="btn-primary" onClick={handleSavePipeline}>
                <CheckCircle2 size={16} /> Save & Register Pipeline
              </button>
            </div>
          </div>
        )}

        {/* TAB 3: ANALYTICS & BUILD METRICS */}
        {activeTab === 'analytics' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="panel">
              <div className="panel-header">
                <div className="panel-title">
                  <BarChart3 size={20} color="#38bdf8" />
                  <span>Build Duration History (Last Runs)</span>
                </div>
              </div>

              <div className="chart-container">
                {runs.slice(0, 8).reverse().map((r, i) => (
                  <div key={r.id} className="chart-bar-col">
                    <div
                      className={`chart-bar ${r.status === 'failed' ? 'failed' : ''}`}
                      style={{ height: `${Math.min(100, Math.max(20, (r.durationSec || 15) * 3))}px` }}
                    >
                      <span className="chart-bar-val">{r.durationSec || 15}s</span>
                    </div>
                    <span className="chart-label">#{r.id}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="dashboard-grid">
              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title">
                    <AlertTriangle size={18} color="#ef4444" />
                    <span>Stage Failure Frequency Breakdown</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {Object.entries(metrics.stageFailures || { 'node-api-test': 2, 'node-e2e': 1 }).map(
                    ([stageId, count]) => (
                      <div key={stageId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'monospace', color: '#f87171' }}>{stageId}</span>
                        <span className="badge-tag" style={{ background: 'rgba(239,68,68,0.2)', color: '#fca5a5' }}>
                          {count} failure(s)
                        </span>
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <div className="panel-title">
                    <CheckCircle2 size={18} color="#10b981" />
                    <span>Efficiency Summary</span>
                  </div>
                </div>

                <p style={{ fontSize: '0.9rem', color: '#94a3b8', lineHeight: 1.6 }}>
                  Parallel execution reduced overall pipeline build time by <strong>42%</strong> compared to serial execution. Top bottleneck stage: <code>node-build</code> (avg 6s).
                </p>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: RUNS HISTORY TABLE */}
        {activeTab === 'runs' && (
          <div className="panel">
            <div className="panel-header">
              <div className="panel-title">
                <Clock size={20} color="#38bdf8" />
                <span>Historical Pipeline Execution Runs</span>
              </div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: '#94a3b8' }}>
                  <th style={{ padding: '0.75rem' }}>Run ID</th>
                  <th style={{ padding: '0.75rem' }}>Pipeline</th>
                  <th style={{ padding: '0.75rem' }}>Status</th>
                  <th style={{ padding: '0.75rem' }}>Branch / Commit</th>
                  <th style={{ padding: '0.75rem' }}>Duration</th>
                  <th style={{ padding: '0.75rem' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ padding: '0.75rem', fontFamily: 'monospace', color: '#38bdf8' }}>{r.id}</td>
                    <td style={{ padding: '0.75rem' }}>{r.pipelineName}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <span className={`status-pill ${r.status}`}>{r.status}</span>
                    </td>
                    <td style={{ padding: '0.75rem', color: '#94a3b8' }}>
                      {r.branch} ({r.commit})
                    </td>
                    <td style={{ padding: '0.75rem' }}>{r.durationSec ? `${r.durationSec}s` : '--'}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <button
                        className="btn-secondary"
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                        onClick={() => {
                          setActiveRunId(r.id);
                          setLogs(r.logs || []);
                          setActiveTab('dashboard');
                        }}
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* FAILURE ALERT & RETRY DRAWER MODAL */}
      {failureDrawerRun && (
        <div className="drawer-overlay" onClick={() => setFailureDrawerRun(null)}>
          <div className="drawer-container" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <AlertTriangle size={24} color="#ef4444" />
                <div>
                  <h2 style={{ fontSize: '1.2rem', fontFamily: 'Outfit' }}>Pipeline Failure Alert</h2>
                  <p style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    Run #{failureDrawerRun.id} halted unexpectedly
                  </p>
                </div>
              </div>
              <button
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                onClick={() => setFailureDrawerRun(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="error-box">
              <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>
                Failed Stage: {failureDrawerRun.errorDetails?.step || failureDrawerRun.failedNodeId}
              </div>
              <p>{failureDrawerRun.errorDetails?.errorMessage || 'Execution step failed.'}</p>

              {failureDrawerRun.errorDetails?.stackTrace && (
                <div className="error-stack">
                  {failureDrawerRun.errorDetails.stackTrace}
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: 'auto' }}>
              <button
                className="btn-primary"
                style={{ justifyContent: 'center' }}
                onClick={() => handleRetryRun(failureDrawerRun.id, failureDrawerRun.failedNodeId)}
              >
                <RotateCcw size={16} /> One-Click Retry Failed Stage ({failureDrawerRun.failedNodeId})
              </button>

              <button
                className="btn-secondary"
                style={{ justifyContent: 'center' }}
                onClick={() => handleRetryRun(failureDrawerRun.id, null)}
              >
                <RefreshCw size={16} /> Re-run Entire Workflow
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
