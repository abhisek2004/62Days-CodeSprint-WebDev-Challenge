const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

app.use(cors());
app.use(express.json());

// In-Memory Database Store
const pipelines = [
  {
    id: 'pipe-1',
    name: 'Full-Stack Web App CI/CD',
    description: 'Lint, multi-stage unit & integration testing, container build, and staging deployment.',
    concurrency: 3,
    nodes: [
      { id: 'node-lint', name: 'ESLint & Formatting', type: 'lint', command: 'npm run lint', dependencies: [], estDurationSec: 3 },
      { id: 'node-unit-test', name: 'Frontend Unit Tests', type: 'test', command: 'npm test -- --coverage', dependencies: ['node-lint'], estDurationSec: 5 },
      { id: 'node-api-test', name: 'Backend API Tests', type: 'test', command: 'pytest tests/api', dependencies: ['node-lint'], estDurationSec: 4 },
      { id: 'node-sec-scan', name: 'Trivy Security Scan', type: 'security', command: 'trivy image scan', dependencies: ['node-lint'], estDurationSec: 4 },
      { id: 'node-build', name: 'Docker Multi-Stage Build', type: 'build', command: 'docker build -t app:latest .', dependencies: ['node-unit-test', 'node-api-test', 'node-sec-scan'], estDurationSec: 6 },
      { id: 'node-e2e', name: 'Cypress E2E Tests', type: 'test', command: 'cypress run --e2e', dependencies: ['node-build'], estDurationSec: 5 },
      { id: 'node-deploy-staging', name: 'Deploy to Kubernetes Staging', type: 'deploy', command: 'kubectl apply -f k8s/staging/', dependencies: ['node-e2e'], estDurationSec: 4 },
      { id: 'node-deploy-prod', name: 'Deploy to AWS ECS Production', type: 'deploy', command: 'aws ecs update-service --cluster prod', dependencies: ['node-deploy-staging'], estDurationSec: 5 }
    ]
  },
  {
    id: 'pipe-2',
    name: 'Microservice Container Matrix',
    description: 'Parallel microservices build, vulnerability checking, and Helm release.',
    concurrency: 4,
    nodes: [
      { id: 'm-deps', name: 'Fetch Dependencies & Cache', type: 'lint', command: 'go mod download', dependencies: [], estDurationSec: 3 },
      { id: 'm-auth', name: 'Auth Service Test & Build', type: 'build', command: 'docker build -t auth-svc .', dependencies: ['m-deps'], estDurationSec: 5 },
      { id: 'm-payment', name: 'Payment Gateway Test & Build', type: 'build', command: 'docker build -t pay-svc .', dependencies: ['m-deps'], estDurationSec: 6 },
      { id: 'm-notify', name: 'Notification Service Test', type: 'test', command: 'cargo test', dependencies: ['m-deps'], estDurationSec: 4 },
      { id: 'm-helm', name: 'Helm Chart Deployment', type: 'deploy', command: 'helm upgrade --install prod ./charts', dependencies: ['m-auth', 'm-payment', 'm-notify'], estDurationSec: 4 }
    ]
  }
];

// Runs history store
let runCounter = 104;
const runs = [
  {
    id: 'run-101',
    pipelineId: 'pipe-1',
    pipelineName: 'Full-Stack Web App CI/CD',
    status: 'success',
    startedAt: new Date(Date.now() - 3600000).toISOString(),
    completedAt: new Date(Date.now() - 3570000).toISOString(),
    durationSec: 30,
    triggeredBy: 'GitHub Webhook (push main)',
    branch: 'main',
    commit: 'a8f9c12',
    nodes: [
      { id: 'node-lint', name: 'ESLint & Formatting', status: 'success', durationSec: 3, workerId: 'Worker-1', retryCount: 0 },
      { id: 'node-unit-test', name: 'Frontend Unit Tests', status: 'success', durationSec: 5, workerId: 'Worker-1', retryCount: 0 },
      { id: 'node-api-test', name: 'Backend API Tests', status: 'success', durationSec: 4, workerId: 'Worker-2', retryCount: 0 },
      { id: 'node-sec-scan', name: 'Trivy Security Scan', status: 'success', durationSec: 4, workerId: 'Worker-3', retryCount: 0 },
      { id: 'node-build', name: 'Docker Multi-Stage Build', status: 'success', durationSec: 6, workerId: 'Worker-1', retryCount: 0 },
      { id: 'node-e2e', name: 'Cypress E2E Tests', status: 'success', durationSec: 5, workerId: 'Worker-2', retryCount: 0 },
      { id: 'node-deploy-staging', name: 'Deploy to Kubernetes Staging', status: 'success', durationSec: 4, workerId: 'Worker-1', retryCount: 0 },
      { id: 'node-deploy-prod', name: 'Deploy to AWS ECS Production', status: 'success', durationSec: 5, workerId: 'Worker-1', retryCount: 0 }
    ],
    logs: [
      { timestamp: new Date(Date.now() - 3600000).toISOString(), level: 'info', node: 'SYSTEM', message: 'Pipeline execution initialized.' },
      { timestamp: new Date(Date.now() - 3598000).toISOString(), level: 'info', node: 'node-lint', message: 'Executing ESLint & Formatting... 0 errors, 0 warnings.' },
      { timestamp: new Date(Date.now() - 3590000).toISOString(), level: 'info', node: 'node-build', message: 'Docker image app:latest compiled successfully.' },
      { timestamp: new Date(Date.now() - 3570000).toISOString(), level: 'info', node: 'SYSTEM', message: 'Pipeline finished with status: SUCCESS' }
    ]
  },
  {
    id: 'run-102',
    pipelineId: 'pipe-1',
    pipelineName: 'Full-Stack Web App CI/CD',
    status: 'failed',
    startedAt: new Date(Date.now() - 1800000).toISOString(),
    completedAt: new Date(Date.now() - 1780000).toISOString(),
    durationSec: 20,
    triggeredBy: 'Manual Trigger',
    branch: 'feature/auth-refactor',
    commit: '7b21e09',
    failedNodeId: 'node-api-test',
    errorDetails: {
      step: 'node-api-test',
      command: 'pytest tests/api',
      exitCode: 1,
      errorMessage: 'AssertionError: Expected HTTP status 200 OK, got 401 Unauthorized in test_jwt_verify()',
      stackTrace: 'tests/api/test_auth.py:42: in test_jwt_verify\n    assert res.status_code == 200\nE   AssertionError: assert 401 == 200'
    },
    nodes: [
      { id: 'node-lint', name: 'ESLint & Formatting', status: 'success', durationSec: 3, workerId: 'Worker-1', retryCount: 0 },
      { id: 'node-unit-test', name: 'Frontend Unit Tests', status: 'success', durationSec: 5, workerId: 'Worker-1', retryCount: 0 },
      { id: 'node-api-test', name: 'Backend API Tests', status: 'failed', durationSec: 4, workerId: 'Worker-2', retryCount: 0, error: 'AssertionError: Expected HTTP status 200 OK, got 401 Unauthorized' },
      { id: 'node-sec-scan', name: 'Trivy Security Scan', status: 'success', durationSec: 4, workerId: 'Worker-3', retryCount: 0 },
      { id: 'node-build', name: 'Docker Multi-Stage Build', status: 'cancelled', durationSec: 0, workerId: null, retryCount: 0 },
      { id: 'node-e2e', name: 'Cypress E2E Tests', status: 'cancelled', durationSec: 0, workerId: null, retryCount: 0 },
      { id: 'node-deploy-staging', name: 'Deploy to Kubernetes Staging', status: 'cancelled', durationSec: 0, workerId: null, retryCount: 0 },
      { id: 'node-deploy-prod', name: 'Deploy to AWS ECS Production', status: 'cancelled', durationSec: 0, workerId: null, retryCount: 0 }
    ],
    logs: [
      { timestamp: new Date(Date.now() - 1800000).toISOString(), level: 'info', node: 'SYSTEM', message: 'Pipeline execution started for feature/auth-refactor' },
      { timestamp: new Date(Date.now() - 1795000).toISOString(), level: 'info', node: 'node-lint', message: 'Lint checks passed cleanly.' },
      { timestamp: new Date(Date.now() - 1785000).toISOString(), level: 'error', node: 'node-api-test', message: 'FAIL: test_jwt_verify - Expected HTTP status 200 OK, got 401 Unauthorized' },
      { timestamp: new Date(Date.now() - 1780000).toISOString(), level: 'error', node: 'SYSTEM', message: 'Pipeline execution HALTED due to failure in stage node-api-test' }
    ]
  },
  {
    id: 'run-103',
    pipelineId: 'pipe-2',
    pipelineName: 'Microservice Container Matrix',
    status: 'success',
    startedAt: new Date(Date.now() - 600000).toISOString(),
    completedAt: new Date(Date.now() - 580000).toISOString(),
    durationSec: 20,
    triggeredBy: 'PR #42 Merged',
    branch: 'main',
    commit: 'c9012bb',
    nodes: [
      { id: 'm-deps', name: 'Fetch Dependencies & Cache', status: 'success', durationSec: 3, workerId: 'Worker-1', retryCount: 0 },
      { id: 'm-auth', name: 'Auth Service Test & Build', status: 'success', durationSec: 5, workerId: 'Worker-1', retryCount: 0 },
      { id: 'm-payment', name: 'Payment Gateway Test & Build', status: 'success', durationSec: 6, workerId: 'Worker-2', retryCount: 0 },
      { id: 'm-notify', name: 'Notification Service Test', status: 'success', durationSec: 4, workerId: 'Worker-3', retryCount: 0 },
      { id: 'm-helm', name: 'Helm Chart Deployment', status: 'success', durationSec: 4, workerId: 'Worker-1', retryCount: 0 }
    ],
    logs: [
      { timestamp: new Date(Date.now() - 600000).toISOString(), level: 'info', node: 'SYSTEM', message: 'Microservices DAG pipeline started.' },
      { timestamp: new Date(Date.now() - 580000).toISOString(), level: 'info', node: 'm-helm', message: 'Helm release deployment completed cleanly.' }
    ]
  }
];

// Active running executions state tracker
const activeExecutions = new Map();

// Helper: Execution Engine for DAG Pipeline Simulation
class PipelineExecuter {
  constructor(runObj, template, ioServer, options = {}) {
    this.run = runObj;
    this.template = template;
    this.io = ioServer;
    this.simulateFailureNodeId = options.simulateFailureNodeId || null;
    this.maxConcurrency = template.concurrency || 3;
    this.aborted = false;
    this.workers = [
      { id: 'Worker-1', busy: false, activeTask: null, cpu: 12 },
      { id: 'Worker-2', busy: false, activeTask: null, cpu: 18 },
      { id: 'Worker-3', busy: false, activeTask: null, cpu: 15 }
    ];
  }

  log(nodeId, level, message) {
    const logItem = {
      timestamp: new Date().toISOString(),
      level,
      node: nodeId,
      message
    };
    this.run.logs.push(logItem);
    this.io.to(this.run.id).emit('pipeline:log', { runId: this.run.id, log: logItem });
    this.io.emit('pipeline:global-log', { runId: this.run.id, log: logItem });
  }

  updateNodeStatus(nodeId, status, extra = {}) {
    const node = this.run.nodes.find(n => n.id === nodeId);
    if (node) {
      node.status = status;
      Object.assign(node, extra);
    }
    this.io.to(this.run.id).emit('pipeline:node-status', {
      runId: this.run.id,
      nodeId,
      status,
      node
    });
    this.io.emit('pipeline:run-update', { runId: this.run.id, run: this.run });
  }

  async start() {
    this.run.status = 'running';
    this.run.startedAt = new Date().toISOString();
    this.log('SYSTEM', 'info', `🚀 Pipeline run ${this.run.id} started. Dispatching DAG tasks across ${this.maxConcurrency} parallel worker agents...`);
    this.io.emit('pipeline:run-update', { runId: this.run.id, run: this.run });

    const startTime = Date.now();
    let hasFailure = false;

    // Node state tracking
    const nodeMap = new Map(this.run.nodes.map(n => [n.id, n]));
    const templateMap = new Map(this.template.nodes.map(n => [n.id, n]));

    // Helper: evaluate runnable nodes
    const getRunnableNodes = () => {
      return this.run.nodes.filter(n => {
        if (n.status !== 'pending') return false;
        const tNode = templateMap.get(n.id);
        const deps = tNode ? tNode.dependencies : [];
        return deps.every(depId => {
          const depNode = nodeMap.get(depId);
          return depNode && depNode.status === 'success';
        });
      });
    };

    while (!this.aborted) {
      // Check if all completed
      const allDone = this.run.nodes.every(n => n.status === 'success' || n.status === 'failed' || n.status === 'cancelled');
      if (allDone) break;

      // Check for failed state without progress possible
      const hasFailed = this.run.nodes.some(n => n.status === 'failed');
      if (hasFailed && !hasFailure) {
        hasFailure = true;
        // Cancel all remaining pending nodes
        this.run.nodes.forEach(n => {
          if (n.status === 'pending') {
            this.updateNodeStatus(n.id, 'cancelled');
            this.log(n.id, 'warn', `Stage skipped/cancelled due to upstream dependency failure.`);
          }
        });
        break;
      }

      const readyNodes = getRunnableNodes();
      const availableWorkers = this.workers.filter(w => !w.busy);

      if (readyNodes.length > 0 && availableWorkers.length > 0) {
        const nodeToRun = readyNodes[0];
        const worker = availableWorkers[0];

        worker.busy = true;
        worker.activeTask = nodeToRun.name;
        nodeToRun.workerId = worker.id;

        // Execute task concurrently
        this.executeNode(nodeToRun, templateMap.get(nodeToRun.id), worker).finally(() => {
          worker.busy = false;
          worker.activeTask = null;
        });
      }

      await new Promise(r => setTimeout(r, 400));
    }

    // Wrap up
    this.run.completedAt = new Date().toISOString();
    this.run.durationSec = Math.round((Date.now() - startTime) / 1000);

    if (this.aborted) {
      this.run.status = 'cancelled';
      this.log('SYSTEM', 'warn', `⛔ Pipeline run ${this.run.id} was manually CANCELLED.`);
    } else if (this.run.nodes.some(n => n.status === 'failed')) {
      this.run.status = 'failed';
      this.log('SYSTEM', 'error', `❌ Pipeline run ${this.run.id} FAILED.`);
    } else {
      this.run.status = 'success';
      this.log('SYSTEM', 'info', `🎉 Pipeline run ${this.run.id} PASSED successfully in ${this.run.durationSec}s!`);
    }

    activeExecutions.delete(this.run.id);
    this.io.emit('pipeline:run-update', { runId: this.run.id, run: this.run });
    this.io.emit('pipeline:metrics-update', getMetrics());
  }

  async executeNode(node, templateNode, worker) {
    this.updateNodeStatus(node.id, 'running', { workerId: worker.id });
    this.log(node.id, 'info', `[${worker.id}] Starting execution: ${templateNode.command}`);

    const totalSteps = 4;
    const estSec = templateNode.estDurationSec || 4;
    const stepDelay = Math.floor((estSec * 1000) / totalSteps);

    const logsForNode = [
      `[${worker.id}] Initializing build container environment...`,
      `[${worker.id}] Executing: $ ${templateNode.command}`,
      `[${worker.id}] Step 2/3: Processing assets & compiling scripts...`,
      `[${worker.id}] Step 3/3: Running verification suite...`
    ];

    for (let i = 0; i < totalSteps; i++) {
      if (this.aborted) return;
      await new Promise(r => setTimeout(r, stepDelay));
      this.log(node.id, 'info', logsForNode[i]);
    }

    // Check if this node is configured to fail
    const isSimulatedFail = (this.simulateFailureNodeId === node.id) || (node.id === 'node-api-test' && this.simulateFailureNodeId === 'auto-fail-api');

    if (isSimulatedFail) {
      const errMessage = `Error: Step failed during ${node.name} execution [Command '${templateNode.command}' exited with status 1]`;
      const stackTrace = `Failed at ${templateNode.command} (line 14)\n  Exit code: 1\n  Reason: Synthetic error injected for testing retry & alert workflow.`;

      this.run.failedNodeId = node.id;
      this.run.errorDetails = {
        step: node.id,
        command: templateNode.command,
        exitCode: 1,
        errorMessage: errMessage,
        stackTrace: stackTrace
      };

      this.log(node.id, 'error', `❌ ${errMessage}`);
      this.log(node.id, 'error', `Stack Trace:\n${stackTrace}`);
      this.updateNodeStatus(node.id, 'failed', { durationSec: estSec, error: errMessage });
    } else {
      this.log(node.id, 'info', `✔ Stage '${node.name}' completed cleanly.`);
      this.updateNodeStatus(node.id, 'success', { durationSec: estSec });
    }
  }

  cancel() {
    this.aborted = true;
    this.run.nodes.forEach(n => {
      if (n.status === 'running' || n.status === 'pending') {
        n.status = 'cancelled';
      }
    });
  }
}

// Metrics calculator helper
function getMetrics() {
  const totalRuns = runs.length;
  const successfulRuns = runs.filter(r => r.status === 'success').length;
  const failedRuns = runs.filter(r => r.status === 'failed').length;
  const successRate = totalRuns > 0 ? Math.round((successfulRuns / totalRuns) * 100) : 0;

  const totalDuration = runs.reduce((acc, r) => acc + (r.durationSec || 0), 0);
  const avgDuration = totalRuns > 0 ? Math.round(totalDuration / totalRuns) : 0;

  // Node failure frequency
  const stageFailures = {};
  runs.forEach(r => {
    if (r.failedNodeId) {
      stageFailures[r.failedNodeId] = (stageFailures[r.failedNodeId] || 0) + 1;
    }
  });

  return {
    totalRuns,
    successfulRuns,
    failedRuns,
    successRate,
    avgDurationSec: avgDuration,
    stageFailures,
    recentRuns: runs.slice(-10)
  };
}

// Socket.io Connection Handlers
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  socket.on('subscribe:run', (runId) => {
    socket.join(runId);
    console.log(`[Socket.io] Client ${socket.id} joined run room: ${runId}`);
  });

  socket.on('unsubscribe:run', (runId) => {
    socket.leave(runId);
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// REST API Endpoints

// GET /api/pipelines - List all pipeline DAG definitions
app.get('/api/pipelines', (req, res) => {
  res.json({ success: true, pipelines });
});

// POST /api/pipelines - Create or update a pipeline DAG definition
app.post('/api/pipelines', (req, res) => {
  const { name, description, concurrency, nodes } = req.body;
  if (!name || !nodes || !Array.isArray(nodes)) {
    return res.status(400).json({ success: false, message: 'Invalid pipeline definition. Name and nodes array required.' });
  }

  const newPipeline = {
    id: `pipe-${Date.now()}`,
    name,
    description: description || 'Custom User DAG Workflow',
    concurrency: concurrency || 3,
    nodes
  };

  pipelines.push(newPipeline);
  io.emit('pipelines:updated', pipelines);
  res.status(201).json({ success: true, pipeline: newPipeline });
});

// GET /api/runs - List execution history
app.get('/api/runs', (req, res) => {
  res.json({ success: true, runs });
});

// GET /api/runs/:id - Get specific run details
app.get('/api/runs/:id', (req, res) => {
  const run = runs.find(r => r.id === req.params.id);
  if (!run) {
    return res.status(404).json({ success: false, message: 'Run execution not found' });
  }
  res.json({ success: true, run });
});

// POST /api/runs - Trigger a new pipeline run
app.post('/api/runs', (req, res) => {
  const { pipelineId, simulateFailureNodeId, branch, triggeredBy } = req.body;
  const template = pipelines.find(p => p.id === (pipelineId || 'pipe-1'));

  if (!template) {
    return res.status(404).json({ success: false, message: 'Pipeline template not found' });
  }

  runCounter++;
  const runId = `run-${runCounter}`;

  const initialNodes = template.nodes.map(n => ({
    id: n.id,
    name: n.name,
    status: 'pending',
    durationSec: 0,
    workerId: null,
    retryCount: 0
  }));

  const newRun = {
    id: runId,
    pipelineId: template.id,
    pipelineName: template.name,
    status: 'pending',
    startedAt: new Date().toISOString(),
    completedAt: null,
    durationSec: 0,
    triggeredBy: triggeredBy || 'Web Dashboard User',
    branch: branch || 'main',
    commit: Math.random().toString(36).substring(2, 9),
    nodes: initialNodes,
    logs: []
  };

  runs.unshift(newRun);

  // Initialize Executer Engine
  const executer = new PipelineExecuter(newRun, template, io, { simulateFailureNodeId });
  activeExecutions.set(runId, executer);

  // Start in background
  executer.start();

  res.status(201).json({ success: true, run: newRun });
});

// POST /api/runs/:id/retry - Retry a failed node or rerun the pipeline
app.post('/api/runs/:id/retry', (req, res) => {
  const { id } = req.params;
  const { nodeId } = req.body;

  const run = runs.find(r => r.id === id);
  if (!run) {
    return res.status(404).json({ success: false, message: 'Run execution not found' });
  }

  const template = pipelines.find(p => p.id === run.pipelineId) || pipelines[0];

  // Reset target node and downstream nodes
  if (nodeId) {
    const targetNode = run.nodes.find(n => n.id === nodeId);
    if (targetNode) {
      targetNode.status = 'pending';
      targetNode.retryCount = (targetNode.retryCount || 0) + 1;
      delete targetNode.error;
    }
  } else {
    // Reset all failed or cancelled nodes
    run.nodes.forEach(n => {
      if (n.status === 'failed' || n.status === 'cancelled') {
        n.status = 'pending';
        n.retryCount = (n.retryCount || 0) + 1;
        delete n.error;
      }
    });
  }

  delete run.failedNodeId;
  delete run.errorDetails;
  run.status = 'running';

  const executer = new PipelineExecuter(run, template, io, { simulateFailureNodeId: null });
  activeExecutions.set(run.id, executer);
  executer.start();

  res.json({ success: true, message: `Retrying pipeline ${run.id}...`, run });
});

// POST /api/runs/:id/cancel - Cancel active running pipeline
app.post('/api/runs/:id/cancel', (req, res) => {
  const { id } = req.params;
  const executer = activeExecutions.get(id);

  if (executer) {
    executer.cancel();
    res.json({ success: true, message: `Pipeline ${id} cancellation requested.` });
  } else {
    res.status(400).json({ success: false, message: `No active running execution found for ${id}` });
  }
});

// GET /api/metrics - Get metrics & analytics summary
app.get('/api/metrics', (req, res) => {
  res.json({ success: true, metrics: getMetrics() });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`🚀 Distributed CI/CD Pipeline Server is running on port ${PORT}`);
  console.log(`📡 Socket.io WebSocket server enabled for log streaming.`);
  console.log(`===================================================`);
});
