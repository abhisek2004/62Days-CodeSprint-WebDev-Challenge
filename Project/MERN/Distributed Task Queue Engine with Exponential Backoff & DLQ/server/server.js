const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  }
});

app.use(cors());
app.use(express.json());

// --- IN-MEMORY QUEUE & WORKER ENGINE STATE ---
let workers = [];
let targetWorkerCount = 4;

const tasksMap = new Map(); // taskId -> Task object
let pendingQueue = [];      // Array of taskIds sorted by priority & timestamp
const dlqQueue = [];        // Array of taskIds in Dead-Letter Queue
const completedTasks = [];  // Array of completed taskIds (max 1000)
const retryingTasks = new Map(); // taskId -> { timerId, executeAt, delay }

// System Statistics & Time-Series History
const stats = {
  totalSubmitted: 0,
  totalCompleted: 0,
  totalFailedDLQ: 0,
  totalRetriesExecuted: 0,
  latencyHistory: [], // { timestamp, avgLatency, throughput }
  startTime: Date.now()
};

// Calculate exponential backoff delay with full jitter
function calculateBackoffDelay(attempts, baseInterval = 1000, maxInterval = 30000, multiplier = 2) {
  // Formula: min(maxInterval, baseInterval * multiplier^(attempts - 1)) + jitter
  const exponential = baseInterval * Math.pow(multiplier, attempts - 1);
  const cappedDelay = Math.min(maxInterval, exponential);
  // Full jitter range: 0 to 20% of calculated delay
  const jitter = Math.floor(Math.random() * (cappedDelay * 0.2));
  return cappedDelay + jitter;
}

// Initialize Workers Pool
function syncWorkerPool() {
  // Scale down if target < current
  while (workers.length > targetWorkerCount) {
    const idleIdx = workers.findIndex(w => w.status === 'idle');
    if (idleIdx !== -1) {
      workers.splice(idleIdx, 1);
    } else {
      // If all are busy, stop popping for now (it will adjust on task completion)
      break;
    }
  }

  // Scale up if target > current
  while (workers.length < targetWorkerCount) {
    const newWorkerId = `worker_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    workers.push({
      id: newWorkerId,
      name: `Worker #${workers.length + 1}`,
      status: 'idle',
      currentTaskId: null,
      completedCount: 0,
      failedCount: 0,
      startedAt: Date.now()
    });
  }

  io.emit('workers_updated', { workers, targetWorkerCount });
}

// Helper to sort pending queue by priority (high=3, medium=2, low=1) and creation time
function sortPendingQueue() {
  const priorityWeight = { high: 3, medium: 2, low: 1 };
  pendingQueue.sort((aId, bId) => {
    const a = tasksMap.get(aId);
    const b = tasksMap.get(bId);
    if (!a || !b) return 0;
    const weightDiff = (priorityWeight[b.priority] || 1) - (priorityWeight[a.priority] || 1);
    if (weightDiff !== 0) return weightDiff;
    return a.createdAt - b.createdAt;
  });
}

// Core Task Dispatcher Loop
function dispatchTasks() {
  syncWorkerPool();

  if (pendingQueue.length === 0) return;

  // Find available idle workers
  const idleWorkers = workers.filter(w => w.status === 'idle');
  if (idleWorkers.length === 0) return;

  for (const worker of idleWorkers) {
    if (pendingQueue.length === 0) break;

    sortPendingQueue();
    const taskId = pendingQueue.shift();
    const task = tasksMap.get(taskId);

    if (!task || task.status === 'cancelled') continue;

    // Assign task to worker
    worker.status = 'busy';
    worker.currentTaskId = task.id;

    task.status = 'active';
    task.workerId = worker.id;
    task.startedAt = Date.now();
    task.logs.push({
      timestamp: Date.now(),
      message: `Assigned to ${worker.name} (Attempt ${task.attempts + 1}/${task.maxRetries})`,
      type: 'info'
    });

    io.emit('task_updated', task);
    io.emit('workers_updated', { workers, targetWorkerCount });

    // Execute asynchronous job simulation
    executeJob(worker, task);
  }
}

// Simulate Task Execution
function executeJob(worker, task) {
  const executionDuration = task.payload?.duration || Math.floor(Math.random() * 1500) + 800;
  const simulatedFailureProbability = task.payload?.failureRate !== undefined ? task.payload.failureRate : 0.25;

  setTimeout(() => {
    const isFailure = Math.random() < simulatedFailureProbability;

    if (!isFailure) {
      // SUCCESS PATH
      task.status = 'completed';
      task.completedAt = Date.now();
      const durationMs = task.completedAt - task.startedAt;
      task.executionTimeMs = durationMs;
      task.logs.push({
        timestamp: Date.now(),
        message: `Task completed successfully in ${durationMs}ms`,
        type: 'success'
      });

      worker.status = 'idle';
      worker.currentTaskId = null;
      worker.completedCount += 1;

      completedTasks.unshift(task.id);
      if (completedTasks.length > 1000) completedTasks.pop();

      stats.totalCompleted += 1;

      io.emit('task_updated', task);
      io.emit('workers_updated', { workers, targetWorkerCount });

      // Trigger next job dispatch
      dispatchTasks();
    } else {
      // FAILURE PATH -> EXPONENTIAL BACKOFF OR DLQ
      task.attempts += 1;
      worker.failedCount += 1;
      worker.status = 'idle';
      worker.currentTaskId = null;

      const errorMessage = task.payload?.errorMessage || `Execution failed on ${worker.name} (Simulated internal timeout/error)`;
      const errorEntry = {
        attempt: task.attempts,
        timestamp: Date.now(),
        error: errorMessage,
        stackTrace: `Error: ${errorMessage}\n    at WorkerProcess.execute (${task.type}.js:${Math.floor(Math.random() * 80) + 10}:${Math.floor(Math.random() * 30) + 1})\n    at TaskQueueEngine.dispatch (server.js:142:12)`
      };

      task.errorHistory.push(errorEntry);

      if (task.attempts < task.maxRetries) {
        // Schedule Exponential Backoff Retry
        stats.totalRetriesExecuted += 1;
        const delayMs = calculateBackoffDelay(
          task.attempts,
          task.baseInterval || 1000,
          task.maxInterval || 30000,
          task.backoffMultiplier || 2
        );

        task.status = 'retrying';
        task.nextAttemptAt = Date.now() + delayMs;
        task.backoffDelayMs = delayMs;
        task.logs.push({
          timestamp: Date.now(),
          message: `Attempt ${task.attempts} failed: "${errorMessage}". Retrying in ${(delayMs / 1000).toFixed(1)}s (Exponential Backoff)`,
          type: 'warning'
        });

        // Set backoff timer
        const timerId = setTimeout(() => {
          retryingTasks.delete(task.id);
          task.status = 'pending';
          task.logs.push({
            timestamp: Date.now(),
            message: `Backoff delay elapsed. Re-queued for execution.`,
            type: 'info'
          });
          pendingQueue.push(task.id);
          io.emit('task_updated', task);
          dispatchTasks();
        }, delayMs);

        retryingTasks.set(task.id, { timerId, executeAt: task.nextAttemptAt, delayMs });

        io.emit('task_updated', task);
        io.emit('workers_updated', { workers, targetWorkerCount });

        // Dispatch next job while this worker is now free
        dispatchTasks();
      } else {
        // DEAD-LETTER QUEUE (DLQ) ESCALATION
        task.status = 'dlq';
        task.failedAt = Date.now();
        task.logs.push({
          timestamp: Date.now(),
          message: `Max retries (${task.maxRetries}) reached. Escalated to Dead-Letter Queue (DLQ).`,
          type: 'error'
        });

        dlqQueue.unshift(task.id);
        stats.totalFailedDLQ += 1;

        io.emit('task_updated', task);
        io.emit('dlq_updated', getDLQTasksDetails());
        io.emit('workers_updated', { workers, targetWorkerCount });

        dispatchTasks();
      }
    }
  }, executionDuration);
}

// Utility to gather full DLQ objects
function getDLQTasksDetails() {
  return dlqQueue.map(id => tasksMap.get(id)).filter(Boolean);
}

// Calculate Summary & Time-Series Metrics
function computeMetrics() {
  const allTasks = Array.from(tasksMap.values());
  const pendingCount = pendingQueue.length;
  const activeCount = workers.filter(w => w.status === 'busy').length;
  const retryingCount = retryingTasks.size;
  const dlqCount = dlqQueue.length;
  const completedCount = stats.totalCompleted;

  // Calculate average latency for completed tasks in last 60 sec
  const now = Date.now();
  const recentCompleted = allTasks.filter(t => t.status === 'completed' && t.completedAt && (now - t.completedAt < 60000));
  const avgLatency = recentCompleted.length > 0
    ? Math.round(recentCompleted.reduce((acc, t) => acc + (t.executionTimeMs || 0), 0) / recentCompleted.length)
    : 0;

  // Throughput: jobs completed per minute
  const throughput = recentCompleted.length;

  const point = {
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    timestamp: now,
    pending: pendingCount,
    active: activeCount,
    completed: completedCount,
    dlq: dlqCount,
    retrying: retryingCount,
    avgLatency,
    throughput
  };

  stats.latencyHistory.push(point);
  if (stats.latencyHistory.length > 30) stats.latencyHistory.shift();

  return {
    pendingCount,
    activeCount,
    retryingCount,
    dlqCount,
    completedCount,
    totalSubmitted: stats.totalSubmitted,
    totalRetriesExecuted: stats.totalRetriesExecuted,
    targetWorkerCount,
    activeWorkers: activeCount,
    totalWorkers: workers.length,
    avgLatencyMs: avgLatency,
    throughputJobsPerMin: throughput,
    history: stats.latencyHistory
  };
}

// Periodically broadcast metrics via WebSockets
setInterval(() => {
  const metrics = computeMetrics();
  io.emit('metrics_tick', metrics);
}, 1000);

// Initialize initial worker pool
syncWorkerPool();

// --- REST API ENDPOINTS ---

// GET /api/stats - Detailed Metrics Summary
app.get('/api/stats', (req, res) => {
  res.json(computeMetrics());
});

// GET /api/tasks - List all tasks filtered optional by status
app.get('/api/tasks', (req, res) => {
  const { status, limit = 100 } = req.query;
  let list = Array.from(tasksMap.values());

  if (status) {
    list = list.filter(t => t.status === status);
  }

  // Sort by updatedAt / createdAt descending
  list.sort((a, b) => b.createdAt - a.createdAt);

  res.json(list.slice(0, parseInt(limit, 10)));
});

// GET /api/tasks/:id - Single task detail
app.get('/api/tasks/:id', (req, res) => {
  const task = tasksMap.get(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

// POST /api/tasks - Submit new task
app.post('/api/tasks', (req, res) => {
  const {
    name = 'Background Processing Job',
    type = 'data_export',
    payload = {},
    priority = 'medium',
    maxRetries = 3,
    baseInterval = 1000,
    backoffMultiplier = 2
  } = req.body;

  const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newTask = {
    id: taskId,
    name,
    type,
    payload,
    priority: ['high', 'medium', 'low'].includes(priority) ? priority : 'medium',
    maxRetries: parseInt(maxRetries, 10) || 3,
    baseInterval: parseInt(baseInterval, 10) || 1000,
    backoffMultiplier: parseFloat(backoffMultiplier) || 2,
    attempts: 0,
    status: 'pending',
    createdAt: Date.now(),
    startedAt: null,
    completedAt: null,
    failedAt: null,
    logs: [{
      timestamp: Date.now(),
      message: `Task created and enqueued with priority [${priority.toUpperCase()}]. Max Retries: ${maxRetries}`,
      type: 'info'
    }],
    errorHistory: []
  };

  tasksMap.set(taskId, newTask);
  pendingQueue.push(taskId);
  stats.totalSubmitted += 1;

  io.emit('task_created', newTask);
  dispatchTasks();

  res.status(201).json(newTask);
});

// POST /api/tasks/:id/cancel - Cancel pending/retrying task
app.post('/api/tasks/:id/cancel', (req, res) => {
  const taskId = req.params.id;
  const task = tasksMap.get(taskId);

  if (!task) return res.status(404).json({ error: 'Task not found' });
  if (['completed', 'dlq', 'cancelled'].includes(task.status)) {
    return res.status(400).json({ error: `Cannot cancel task in state: ${task.status}` });
  }

  // Remove from pending if there
  pendingQueue = pendingQueue.filter(id => id !== taskId);

  // Clear retry timer if retrying
  if (retryingTasks.has(taskId)) {
    clearTimeout(retryingTasks.get(taskId).timerId);
    retryingTasks.delete(taskId);
  }

  task.status = 'cancelled';
  task.logs.push({
    timestamp: Date.now(),
    message: 'Task manually cancelled by operator',
    type: 'warning'
  });

  io.emit('task_updated', task);
  res.json({ message: 'Task cancelled successfully', task });
});

// GET /api/dlq - List all tasks in Dead-Letter Queue
app.get('/api/dlq', (req, res) => {
  res.json(getDLQTasksDetails());
});

// POST /api/dlq/replay/:id - Replay single task from DLQ
app.post('/api/dlq/replay/:id', (req, res) => {
  const taskId = req.params.id;
  const dlqIndex = dlqQueue.indexOf(taskId);

  if (dlqIndex === -1) {
    return res.status(404).json({ error: 'Task not found in Dead-Letter Queue' });
  }

  const task = tasksMap.get(taskId);
  if (!task) return res.status(404).json({ error: 'Task object missing' });

  // Remove from DLQ
  dlqQueue.splice(dlqIndex, 1);

  // Reset retries and re-enqueue
  task.attempts = 0;
  task.status = 'pending';
  task.logs.push({
    timestamp: Date.now(),
    message: 'Task replayed from Dead-Letter Queue (DLQ). Attempt counter reset to 0.',
    type: 'info'
  });

  pendingQueue.push(task.id);

  io.emit('task_updated', task);
  io.emit('dlq_updated', getDLQTasksDetails());

  dispatchTasks();

  res.json({ message: 'Task replayed successfully from DLQ', task });
});

// POST /api/dlq/replay-all - Bulk replay all DLQ tasks
app.post('/api/dlq/replay-all', (req, res) => {
  const count = dlqQueue.length;
  const replayedTasks = [];

  while (dlqQueue.length > 0) {
    const taskId = dlqQueue.pop();
    const task = tasksMap.get(taskId);
    if (task) {
      task.attempts = 0;
      task.status = 'pending';
      task.logs.push({
        timestamp: Date.now(),
        message: 'Bulk replayed from Dead-Letter Queue.',
        type: 'info'
      });
      pendingQueue.push(task.id);
      replayedTasks.push(task);
      io.emit('task_updated', task);
    }
  }

  io.emit('dlq_updated', []);
  dispatchTasks();

  res.json({ message: `Replayed ${replayedTasks.length} tasks from DLQ`, count: replayedTasks.length });
});

// DELETE /api/dlq - Clear/Purge DLQ
app.delete('/api/dlq', (req, res) => {
  const purgedCount = dlqQueue.length;
  dlqQueue.forEach(taskId => {
    const task = tasksMap.get(taskId);
    if (task) {
      task.status = 'purged';
      task.logs.push({
        timestamp: Date.now(),
        message: 'Purged permanently from DLQ',
        type: 'error'
      });
      io.emit('task_updated', task);
    }
  });
  dlqQueue.length = 0;

  io.emit('dlq_updated', []);
  res.json({ message: 'Dead-Letter Queue purged successfully', count: purgedCount });
});

// POST /api/workers/scale - Dynamic worker scaling (1 - 10)
app.post('/api/workers/scale', (req, res) => {
  const { count } = req.body;
  const parsedCount = parseInt(count, 10);

  if (isNaN(parsedCount) || parsedCount < 1 || parsedCount > 10) {
    return res.status(400).json({ error: 'Worker count must be an integer between 1 and 10' });
  }

  targetWorkerCount = parsedCount;
  syncWorkerPool();
  dispatchTasks();

  res.json({ message: `Worker pool target set to ${targetWorkerCount}`, workers, targetWorkerCount });
});

// POST /api/simulation/batch - Inject simulated workload batch
app.post('/api/simulation/batch', (req, res) => {
  const { count = 15, failureRate = 0.4 } = req.body;
  const created = [];

  const jobTemplates = [
    { type: 'email_dispatch', name: 'User Welcome Email Batch', priority: 'high', duration: 1200 },
    { type: 'image_processing', name: 'Thumbnail & Watermark Gen', priority: 'medium', duration: 1800 },
    { type: 'db_backup', name: 'Hourly Delta DB Snapshot', priority: 'low', duration: 2500 },
    { type: 'webhook_notify', name: 'Stripe Payment Webhook Dispatch', priority: 'high', duration: 900 },
    { type: 'analytics_aggregation', name: 'Realtime Traffic Metric Rollup', priority: 'medium', duration: 1500 }
  ];

  for (let i = 0; i < parseInt(count, 10); i++) {
    const tmpl = jobTemplates[i % jobTemplates.length];
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newTask = {
      id: taskId,
      name: `${tmpl.name} #${i + 1}`,
      type: tmpl.type,
      payload: {
        duration: tmpl.duration + Math.floor(Math.random() * 400) - 200,
        failureRate: parseFloat(failureRate),
        errorMessage: `Simulated transient error during ${tmpl.type}`
      },
      priority: tmpl.priority,
      maxRetries: Math.floor(Math.random() * 3) + 2, // 2 to 4 retries
      baseInterval: 1000,
      backoffMultiplier: 2,
      attempts: 0,
      status: 'pending',
      createdAt: Date.now() + i, // slight timestamp stagger
      startedAt: null,
      completedAt: null,
      failedAt: null,
      logs: [{
        timestamp: Date.now(),
        message: `Batch job generated with failure probability ${(failureRate * 100).toFixed(0)}%`,
        type: 'info'
      }],
      errorHistory: []
    };

    tasksMap.set(taskId, newTask);
    pendingQueue.push(taskId);
    stats.totalSubmitted += 1;
    created.push(newTask);
    io.emit('task_created', newTask);
  }

  dispatchTasks();
  res.json({ message: `Successfully queued ${created.length} simulated tasks`, count: created.length });
});

// DELETE /api/tasks/clear - Reset all tasks and queue state
app.post('/api/tasks/clear', (req, res) => {
  // Clear timeouts
  for (const [_, item] of retryingTasks.entries()) {
    clearTimeout(item.timerId);
  }
  retryingTasks.clear();

  tasksMap.clear();
  pendingQueue.length = 0;
  dlqQueue.length = 0;
  completedTasks.length = 0;

  stats.totalSubmitted = 0;
  stats.totalCompleted = 0;
  stats.totalFailedDLQ = 0;
  stats.totalRetriesExecuted = 0;
  stats.latencyHistory.length = 0;

  workers.forEach(w => {
    w.status = 'idle';
    w.currentTaskId = null;
    w.completedCount = 0;
    w.failedCount = 0;
  });

  io.emit('queue_cleared');
  io.emit('workers_updated', { workers, targetWorkerCount });

  res.json({ message: 'All queues and task states reset successfully' });
});

// --- WEBSOCKET CONNECTION HANDLING ---
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  // Send initial snapshot to client
  socket.emit('initial_state', {
    metrics: computeMetrics(),
    workers,
    targetWorkerCount,
    dlqTasks: getDLQTasksDetails(),
    recentTasks: Array.from(tasksMap.values()).slice(-100)
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` Distributed Task Queue Engine Running on Port ${PORT} `);
  console.log(` Socket.IO Server active & Worker Pool Initialized      `);
  console.log(`=======================================================`);
});
