const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'DELETE']
  }
});

const PORT = process.env.PORT || 5000;
const RING_SIZE = 1000;

// Deterministic Hash Function (0 to RING_SIZE - 1)
function hashKey(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash) % RING_SIZE;
}

// Preset color palette for physical nodes
const NODE_COLORS = [
  '#6366f1', // Indigo
  '#ec4899', // Pink
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#06b6d4', // Cyan
  '#8b5cf6', // Purple
  '#ef4444', // Red
  '#14b8a6'  // Teal
];

class ClusterNode {
  constructor(id, name, color, capacity = 8, policy = 'LRU') {
    this.id = id;
    this.name = name;
    this.color = color;
    this.capacity = capacity;
    this.policy = policy; // 'LRU', 'LFU', 'TTL'
    this.items = new Map(); // key -> { key, value, hash, createdAt, ttl, expiresAt, lastAccessed, accessCount }
  }

  isFull() {
    return this.items.size >= this.capacity;
  }

  evictKey() {
    if (this.items.size === 0) return null;

    let targetKey = null;
    const now = Date.now();

    if (this.policy === 'LRU') {
      // Evict item with oldest lastAccessed
      let oldestTime = Infinity;
      for (const [key, item] of this.items.entries()) {
        if (item.lastAccessed < oldestTime) {
          oldestTime = item.lastAccessed;
          targetKey = key;
        }
      }
    } else if (this.policy === 'LFU') {
      // Evict item with lowest accessCount (tie-breaker: oldest lastAccessed)
      let minAccess = Infinity;
      let oldestTime = Infinity;
      for (const [key, item] of this.items.entries()) {
        if (item.accessCount < minAccess || (item.accessCount === minAccess && item.lastAccessed < oldestTime)) {
          minAccess = item.accessCount;
          oldestTime = item.lastAccessed;
          targetKey = key;
        }
      }
    } else if (this.policy === 'TTL') {
      // Evict item closest to expiration or already expired, fallback to LRU
      let minTimeToLive = Infinity;
      let oldestTime = Infinity;
      for (const [key, item] of this.items.entries()) {
        if (item.expiresAt) {
          const remaining = item.expiresAt - now;
          if (remaining < minTimeToLive) {
            minTimeToLive = remaining;
            targetKey = key;
          }
        } else if (!targetKey && item.lastAccessed < oldestTime) {
          oldestTime = item.lastAccessed;
          targetKey = key;
        }
      }
    }

    if (!targetKey) {
      // Fallback: first key
      targetKey = this.items.keys().next().value;
    }

    const evictedItem = this.items.get(targetKey);
    this.items.delete(targetKey);
    return evictedItem;
  }
}

class DistributedCacheCluster {
  constructor(vnodesPerNode = 4, defaultCapacity = 8, defaultPolicy = 'LRU') {
    this.vnodesPerNode = vnodesPerNode;
    this.defaultCapacity = defaultCapacity;
    this.defaultPolicy = defaultPolicy;
    this.physicalNodes = new Map(); // nodeId -> ClusterNode
    this.ring = []; // Array of { vnodeId, nodeId, hash, nodeName, color }
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalOps: 0
    };
    this.logs = [];
    this.autoTraffic = false;
    this.trafficTimer = null;

    // Initialize default cluster with 3 nodes
    this.addNode('node-1', 'Cache Node A', NODE_COLORS[0]);
    this.addNode('node-2', 'Cache Node B', NODE_COLORS[1]);
    this.addNode('node-3', 'Cache Node C', NODE_COLORS[2]);
    this.seedInitialData();
  }

  addLog(type, message, details = {}) {
    const logItem = {
      id: 'log-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
      timestamp: new Date().toLocaleTimeString(),
      type, // 'SET', 'GET_HIT', 'GET_MISS', 'EVICT', 'EXPIRE', 'NODE_JOIN', 'NODE_LEAVE', 'REBALANCE'
      message,
      details
    };
    this.logs.unshift(logItem);
    if (this.logs.length > 50) this.logs.pop();
    return logItem;
  }

  rebuildRing() {
    this.ring = [];
    for (const [nodeId, node] of this.physicalNodes.entries()) {
      for (let i = 0; i < this.vnodesPerNode; i++) {
        const vnodeId = `${nodeId}-v${i}`;
        const hash = hashKey(vnodeId);
        this.ring.push({
          vnodeId,
          nodeId,
          hash,
          nodeName: node.name,
          color: node.color
        });
      }
    }
    // Sort ring positions in ascending order of hash
    this.ring.sort((a, b) => a.hash - b.hash);
  }

  addNode(nodeId, name, color) {
    if (this.physicalNodes.has(nodeId)) return false;
    const nodeColor = color || NODE_COLORS[this.physicalNodes.size % NODE_COLORS.length];
    const nodeName = name || `Cache Node ${String.fromCharCode(65 + this.physicalNodes.size)}`;

    const newNode = new ClusterNode(nodeId, nodeName, nodeColor, this.defaultCapacity, this.defaultPolicy);
    this.physicalNodes.set(nodeId, newNode);
    this.rebuildRing();
    this.rebalanceKeys('NODE_JOIN', nodeId);
    this.addLog('NODE_JOIN', `Node ${nodeName} joined the cluster. Virtual nodes added.`, { nodeId, vnodes: this.vnodesPerNode });
    return true;
  }

  removeNode(nodeId) {
    if (this.physicalNodes.size <= 1) {
      this.addLog('NODE_LEAVE', `Cannot remove last remaining node in cluster.`, { nodeId });
      return false;
    }
    const node = this.physicalNodes.get(nodeId);
    if (!node) return false;

    // Collect all items from the leaving node to re-hash them
    const orphanedItems = Array.from(node.items.values());

    this.physicalNodes.delete(nodeId);
    this.rebuildRing();

    // Reassign orphaned keys
    let migratedCount = 0;
    for (const item of orphanedItems) {
      const targetNode = this.getNodeForKey(item.key);
      if (targetNode) {
        if (targetNode.isFull()) {
          const evicted = targetNode.evictKey();
          if (evicted) {
            this.stats.evictions++;
            this.addLog('EVICT', `Key '${evicted.key}' evicted from ${targetNode.name} (${targetNode.policy}) during failover.`, { key: evicted.key, node: targetNode.name });
          }
        }
        item.physicalNodeId = targetNode.id;
        targetNode.items.set(item.key, item);
        migratedCount++;
      }
    }

    this.addLog('NODE_LEAVE', `Node ${node.name} left cluster. ${migratedCount} keys failover-migrated.`, { nodeId, migratedCount });
    return true;
  }

  getNodeForKey(key) {
    if (this.ring.length === 0) return null;
    const keyHash = hashKey(key);

    // Find first virtual node on ring with hash >= keyHash
    let targetVNode = this.ring.find(vnode => vnode.hash >= keyHash);
    if (!targetVNode) {
      // Wrap around to the first node on the ring
      targetVNode = this.ring[0];
    }
    return this.physicalNodes.get(targetVNode.nodeId);
  }

  rebalanceKeys(reason, triggerNodeId) {
    if (this.physicalNodes.size === 0) return;

    // Collect all items across all nodes
    const allItems = [];
    for (const node of this.physicalNodes.values()) {
      for (const item of node.items.values()) {
        allItems.push({ ...item });
      }
      node.items.clear();
    }

    let remappedCount = 0;

    for (const item of allItems) {
      const targetNode = this.getNodeForKey(item.key);
      if (targetNode) {
        if (item.physicalNodeId !== targetNode.id) {
          remappedCount++;
        }
        item.physicalNodeId = targetNode.id;

        if (targetNode.isFull()) {
          const evicted = targetNode.evictKey();
          if (evicted) {
            this.stats.evictions++;
            this.addLog('EVICT', `Key '${evicted.key}' evicted from ${targetNode.name} (${targetNode.policy}) during cluster rebalance.`, { key: evicted.key, node: targetNode.name });
          }
        }
        targetNode.items.set(item.key, item);
      }
    }

    if (remappedCount > 0) {
      this.addLog('REBALANCE', `Ring rebalanced (${reason}). ${remappedCount} keys relocated on hash ring.`, { remappedCount });
    }
  }

  set(key, value, ttlSeconds = 0) {
    if (!key) return null;
    const targetNode = this.getNodeForKey(key);
    if (!targetNode) return null;

    const khash = hashKey(key);
    const now = Date.now();
    const ttlMs = ttlSeconds > 0 ? ttlSeconds * 1000 : null;
    const expiresAt = ttlMs ? now + ttlMs : null;

    let item = targetNode.items.get(key);
    if (item) {
      // Update existing key
      item.value = value;
      item.hash = khash;
      item.ttl = ttlSeconds;
      item.expiresAt = expiresAt;
      item.lastAccessed = now;
      item.accessCount += 1;
      this.addLog('SET', `Updated key '${key}' on ${targetNode.name}`, { key, value, node: targetNode.name, hash: khash });
    } else {
      // Check node capacity for eviction
      if (targetNode.isFull()) {
        const evicted = targetNode.evictKey();
        if (evicted) {
          this.stats.evictions++;
          this.addLog('EVICT', `Capacity limit (${targetNode.capacity}). Evicted '${evicted.key}' from ${targetNode.name} using ${targetNode.policy} policy.`, { evictedKey: evicted.key, node: targetNode.name, policy: targetNode.policy });
        }
      }

      item = {
        key,
        value,
        hash: khash,
        createdAt: now,
        ttl: ttlSeconds,
        expiresAt,
        lastAccessed: now,
        accessCount: 1,
        physicalNodeId: targetNode.id
      };
      targetNode.items.set(key, item);
      this.addLog('SET', `Stored key '${key}' on ${targetNode.name} (Hash slot: ${khash})`, { key, value, node: targetNode.name, hash: khash });
    }
    this.stats.totalOps++;
    return { item, node: targetNode };
  }

  get(key) {
    if (!key) return { hit: false, reason: 'INVALID_KEY' };
    this.stats.totalOps++;
    const targetNode = this.getNodeForKey(key);
    if (!targetNode) return { hit: false, reason: 'NO_NODE' };

    const item = targetNode.items.get(key);
    const now = Date.now();

    if (!item) {
      this.stats.misses++;
      this.addLog('GET_MISS', `Cache MISS for key '${key}'. Routed to ${targetNode.name} (Hash: ${hashKey(key)})`, { key, node: targetNode.name });
      return { hit: false, reason: 'NOT_FOUND', node: targetNode, hash: hashKey(key) };
    }

    // Check TTL Expiration
    if (item.expiresAt && now > item.expiresAt) {
      targetNode.items.delete(key);
      this.stats.misses++;
      this.stats.evictions++;
      this.addLog('EXPIRE', `Key '${key}' expired on ${targetNode.name} (TTL exceeded).`, { key, node: targetNode.name });
      return { hit: false, reason: 'EXPIRED', node: targetNode, hash: item.hash };
    }

    // Update access metrics for LRU & LFU
    item.lastAccessed = now;
    item.accessCount += 1;
    this.stats.hits++;
    this.addLog('GET_HIT', `Cache HIT for key '${key}' on ${targetNode.name}! Value: "${item.value}"`, { key, value: item.value, node: targetNode.name, accesses: item.accessCount });
    return { hit: true, item, node: targetNode };
  }

  delete(key) {
    const targetNode = this.getNodeForKey(key);
    if (!targetNode) return false;
    const removed = targetNode.items.delete(key);
    if (removed) {
      this.addLog('SET', `Deleted key '${key}' from ${targetNode.name}.`, { key, node: targetNode.name });
    }
    return removed;
  }

  clear() {
    for (const node of this.physicalNodes.values()) {
      node.items.clear();
    }
    this.stats = { hits: 0, misses: 0, evictions: 0, totalOps: 0 };
    this.addLog('REBALANCE', 'Flushed all keys and reset cluster statistics.');
  }

  updateConfig(capacity, policy, vnodes) {
    if (capacity && capacity >= 1 && capacity <= 50) {
      this.defaultCapacity = capacity;
      for (const node of this.physicalNodes.values()) {
        node.capacity = capacity;
      }
    }
    if (policy && ['LRU', 'LFU', 'TTL'].includes(policy)) {
      this.defaultPolicy = policy;
      for (const node of this.physicalNodes.values()) {
        node.policy = policy;
      }
    }
    if (vnodes && vnodes >= 1 && vnodes <= 10) {
      this.vnodesPerNode = vnodes;
      this.rebuildRing();
      this.rebalanceKeys('CONFIG_CHANGE', null);
    }
    this.addLog('REBALANCE', `Cluster config updated: Capacity=${this.defaultCapacity}, Eviction Policy=${this.defaultPolicy}, Virtual Nodes=${this.vnodesPerNode}`);
  }

  checkTTLExpirations() {
    const now = Date.now();
    let expiredCount = 0;
    for (const node of this.physicalNodes.values()) {
      for (const [key, item] of node.items.entries()) {
        if (item.expiresAt && now > item.expiresAt) {
          node.items.delete(key);
          expiredCount++;
          this.stats.evictions++;
          this.addLog('EXPIRE', `Background TTL Sweeper expired key '${key}' on ${node.name}.`, { key, node: node.name });
        }
      }
    }
    return expiredCount;
  }

  seedInitialData() {
    const sampleKeys = [
      { k: 'user:101:profile', v: 'Alice Vance', ttl: 0 },
      { k: 'user:102:session', v: 'tok_abc987', ttl: 30 },
      { k: 'product:88:stock', v: '45 items', ttl: 0 },
      { k: 'order:909:status', v: 'SHIPPED', ttl: 45 },
      { k: 'api:rate:ip_127.0.0.1', v: '12 req/min', ttl: 15 },
      { k: 'analytics:daily_active', v: '12,490 users', ttl: 0 },
      { k: 'cart:user_304', v: '[Laptop, Headphones]', ttl: 60 },
      { k: 'config:feature_flags', v: '{"beta_ui": true}', ttl: 0 },
      { k: 'db:query:users_top10', v: 'Cached Query Payload', ttl: 20 },
      { k: 'weather:nyc:temp', v: '22°C Clear', ttl: 0 }
    ];

    sampleKeys.forEach(s => this.set(s.k, s.v, s.ttl));
  }

  getState() {
    const nodesArray = Array.from(this.physicalNodes.values()).map(node => {
      const keysList = Array.from(node.items.values()).map(item => ({
        key: item.key,
        value: item.value,
        hash: item.hash,
        createdAt: item.createdAt,
        ttl: item.ttl,
        expiresAt: item.expiresAt,
        lastAccessed: item.lastAccessed,
        accessCount: item.accessCount,
        physicalNodeId: item.physicalNodeId,
        ttlRemaining: item.expiresAt ? Math.max(0, Math.ceil((item.expiresAt - Date.now()) / 1000)) : null
      }));

      return {
        id: node.id,
        name: node.name,
        color: node.color,
        capacity: node.capacity,
        policy: node.policy,
        keyCount: node.items.size,
        keys: keysList
      };
    });

    const totalStoredKeys = nodesArray.reduce((acc, n) => acc + n.keyCount, 0);
    const hitRate = this.stats.totalOps > 0 ? ((this.stats.hits / this.stats.totalOps) * 100).toFixed(1) : '0.0';

    return {
      ringSize: RING_SIZE,
      vnodesPerNode: this.vnodesPerNode,
      defaultCapacity: this.defaultCapacity,
      defaultPolicy: this.defaultPolicy,
      nodes: nodesArray,
      ring: this.ring,
      stats: {
        ...this.stats,
        totalStoredKeys,
        hitRate: parseFloat(hitRate)
      },
      logs: this.logs,
      autoTraffic: this.autoTraffic
    };
  }
}

const cluster = new DistributedCacheCluster();

// Background TTL Sweeper interval (runs every 1 sec)
setInterval(() => {
  const expired = cluster.checkTTLExpirations();
  if (expired > 0) {
    io.emit('cluster_state', cluster.getState());
  }
}, 1000);

// Auto-Traffic Simulation Loop
function startAutoTraffic() {
  if (cluster.trafficTimer) clearInterval(cluster.trafficTimer);
  cluster.autoTraffic = true;

  const demoKeys = [
    'user:101:profile', 'user:102:session', 'product:88:stock', 'order:909:status',
    'api:rate:ip_127.0.0.1', 'analytics:daily_active', 'cart:user_304', 'config:feature_flags',
    'db:query:users_top10', 'weather:nyc:temp', 'auth:jwt:token_99', 'search:trend:ai',
    'recommendations:user_5', 'payment:txn_88291', 'metrics:cpu_usage'
  ];

  cluster.trafficTimer = setInterval(() => {
    const isSet = Math.random() < 0.35; // 35% writes, 65% reads
    const randKey = demoKeys[Math.floor(Math.random() * demoKeys.length)];

    if (isSet) {
      const randValue = 'Val-' + Math.floor(Math.random() * 9000 + 1000);
      const randTtl = Math.random() < 0.4 ? Math.floor(Math.random() * 30 + 10) : 0;
      cluster.set(randKey, randValue, randTtl);
    } else {
      cluster.get(randKey);
    }

    io.emit('cluster_state', cluster.getState());
  }, 1800);
}

function stopAutoTraffic() {
  if (cluster.trafficTimer) {
    clearInterval(cluster.trafficTimer);
    cluster.trafficTimer = null;
  }
  cluster.autoTraffic = false;
}

// REST Endpoints
app.get('/api/cluster/state', (req, res) => {
  res.json(cluster.getState());
});

app.post('/api/cluster/set', (req, res) => {
  const { key, value, ttl } = req.body;
  const result = cluster.set(key, value, Number(ttl) || 0);
  io.emit('cluster_state', cluster.getState());
  res.json({ success: true, result });
});

app.post('/api/cluster/get', (req, res) => {
  const { key } = req.body;
  const result = cluster.get(key);
  io.emit('cluster_state', cluster.getState());
  res.json({ success: true, result });
});

app.post('/api/cluster/delete', (req, res) => {
  const { key } = req.body;
  const success = cluster.delete(key);
  io.emit('cluster_state', cluster.getState());
  res.json({ success });
});

app.post('/api/cluster/node', (req, res) => {
  const { name, color } = req.body;
  const id = 'node-' + Date.now();
  const success = cluster.addNode(id, name, color);
  io.emit('cluster_state', cluster.getState());
  res.json({ success, id });
});

app.delete('/api/cluster/node/:id', (req, res) => {
  const success = cluster.removeNode(req.params.id);
  io.emit('cluster_state', cluster.getState());
  res.json({ success });
});

app.post('/api/cluster/config', (req, res) => {
  const { capacity, policy, vnodes } = req.body;
  cluster.updateConfig(Number(capacity), policy, Number(vnodes));
  io.emit('cluster_state', cluster.getState());
  res.json({ success: true });
});

app.post('/api/cluster/flush', (req, res) => {
  cluster.clear();
  io.emit('cluster_state', cluster.getState());
  res.json({ success: true });
});

// Socket.io Handlers
io.on('connection', (socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);
  socket.emit('cluster_state', cluster.getState());

  socket.on('set_key', ({ key, value, ttl }) => {
    cluster.set(key, value, Number(ttl) || 0);
    io.emit('cluster_state', cluster.getState());
  });

  socket.on('get_key', ({ key }) => {
    cluster.get(key);
    io.emit('cluster_state', cluster.getState());
  });

  socket.on('delete_key', ({ key }) => {
    cluster.delete(key);
    io.emit('cluster_state', cluster.getState());
  });

  socket.on('add_node', ({ name, color }) => {
    const id = 'node-' + Date.now();
    cluster.addNode(id, name, color);
    io.emit('cluster_state', cluster.getState());
  });

  socket.on('remove_node', ({ nodeId }) => {
    cluster.removeNode(nodeId);
    io.emit('cluster_state', cluster.getState());
  });

  socket.on('update_config', ({ capacity, policy, vnodes }) => {
    cluster.updateConfig(Number(capacity), policy, Number(vnodes));
    io.emit('cluster_state', cluster.getState());
  });

  socket.on('seed_keys', () => {
    cluster.seedInitialData();
    io.emit('cluster_state', cluster.getState());
  });

  socket.on('flush_cluster', () => {
    cluster.clear();
    io.emit('cluster_state', cluster.getState());
  });

  socket.on('toggle_traffic', ({ enabled }) => {
    if (enabled) {
      startAutoTraffic();
    } else {
      stopAutoTraffic();
    }
    io.emit('cluster_state', cluster.getState());
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Client disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`Distributed Cache Cluster Simulator running on port ${PORT}`);
  console.log(`====================================================`);
});
