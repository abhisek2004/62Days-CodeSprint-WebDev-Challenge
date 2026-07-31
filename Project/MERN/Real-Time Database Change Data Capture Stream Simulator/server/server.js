const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const PORT = process.env.PORT || 5000;

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// --- IN-MEMORY DATABASE STATE ---
const collections = {
  users: [
    { _id: 'usr_101', name: 'Sarah Connor', email: 'sarah@cyberdyne.io', role: 'Admin', status: 'ACTIVE', credits: 1450, createdAt: new Date(Date.now() - 3600000 * 24).toISOString() },
    { _id: 'usr_102', name: 'Alex Mercer', email: 'alex@blackwatch.org', role: 'Developer', status: 'ACTIVE', credits: 890, createdAt: new Date(Date.now() - 3600000 * 12).toISOString() },
    { _id: 'usr_103', name: 'Ellen Ripley', email: 'ripley@weyland.corp', role: 'Officer', status: 'PENDING', credits: 2300, createdAt: new Date(Date.now() - 3600000 * 5).toISOString() },
    { _id: 'usr_104', name: 'Devon Miles', email: 'devon@knight.ind', role: 'Manager', status: 'ACTIVE', credits: 620, createdAt: new Date(Date.now() - 3600000 * 2).toISOString() }
  ],
  orders: [
    { _id: 'ord_901', userId: 'usr_101', totalAmount: 299.99, status: 'SHIPPED', itemsCount: 3, paymentMethod: 'CreditCard', createdAt: new Date(Date.now() - 7200000).toISOString() },
    { _id: 'ord_902', userId: 'usr_102', totalAmount: 49.50, status: 'PROCESSING', itemsCount: 1, paymentMethod: 'PayPal', createdAt: new Date(Date.now() - 3600000).toISOString() },
    { _id: 'ord_903', userId: 'usr_103', totalAmount: 1120.00, status: 'PENDING', itemsCount: 5, paymentMethod: 'Crypto', createdAt: new Date(Date.now() - 1800000).toISOString() }
  ],
  inventory: [
    { _id: 'inv_301', sku: 'SKU-NEON-01', productName: 'Quantum Core Processor', stockQuantity: 42, warehouseLocation: 'Zone-A4', unitPrice: 899.00 },
    { _id: 'inv_302', sku: 'SKU-NEON-02', productName: 'Holographic Display Module', stockQuantity: 128, warehouseLocation: 'Zone-B2', unitPrice: 349.50 },
    { _id: 'inv_303', sku: 'SKU-NEON-03', productName: 'Neural Mesh Interface', stockQuantity: 15, warehouseLocation: 'Zone-C1', unitPrice: 1450.00 }
  ],
  products: [
    { _id: 'prd_501', title: 'Cybernetic Arm V2', category: 'Prosthetics', price: 2999.00, rating: 4.8, isAvailable: true },
    { _id: 'prd_502', title: 'Bio-Diagnostic Scanner', category: 'Medical Gear', price: 749.99, rating: 4.6, isAvailable: true },
    { _id: 'prd_503', title: 'Optical Camouflage Cloak', category: 'Stealth Tech', price: 4200.00, rating: 4.9, isAvailable: false }
  ]
};

// --- CDC STREAM EVENT BUFFER & METRICS ---
const cdcEventBuffer = [];
const MAX_BUFFER_SIZE = 500;
let sequenceNumber = 1000;
let totalEventCount = 0;

// Throughput tracking over time (per second)
const tpsHistory = []; // { timestamp, tps, insertCount, updateCount, deleteCount }
let currentSecondEvents = 0;
let currentSecondInserts = 0;
let currentSecondUpdates = 0;
let currentSecondDeletes = 0;

// Auto Simulator State
let simulatorActive = false;
let simulatorTps = 2; // events per second
let simulatorTimer = null;

// Helper to calculate JSON size in bytes
function getByteSize(obj) {
  return Buffer.byteLength(JSON.stringify(obj), 'utf8');
}

// Generate standard Mongo Change Stream event structure
function createChangeEvent(operationType, collectionName, docId, fullDocument, fullDocumentBefore, updateDescription) {
  sequenceNumber++;
  totalEventCount++;

  const hexClusterTime = (Math.floor(Date.now() / 1000)).toString(16);
  const hexSeq = sequenceNumber.toString(16).padStart(6, '0');
  const resumeToken = `82${hexClusterTime}000000012B0229296F5A1004${hexSeq}4`;

  const cdcEvent = {
    _id: { _data: resumeToken },
    operationType, // 'insert' | 'update' | 'delete' | 'replace'
    clusterTime: {
      $timestamp: {
        t: Math.floor(Date.now() / 1000),
        i: sequenceNumber % 100
      }
    },
    wallTime: new Date().toISOString(),
    ns: {
      db: 'production_store_db',
      coll: collectionName
    },
    documentKey: {
      _id: docId
    },
    fullDocument: fullDocument || null,
    fullDocumentBeforeChange: fullDocumentBefore || null,
    updateDescription: updateDescription || null,
    payloadSizeBytes: 0,
    latencyMs: Math.floor(Math.random() * 4) + 1 // Simulated CDC lag in ms (1-5ms)
  };

  cdcEvent.payloadSizeBytes = getByteSize(cdcEvent);

  // Store in memory buffer
  cdcEventBuffer.unshift(cdcEvent);
  if (cdcEventBuffer.length > MAX_BUFFER_SIZE) {
    cdcEventBuffer.pop();
  }

  // Update counters
  currentSecondEvents++;
  if (operationType === 'insert') currentSecondInserts++;
  else if (operationType === 'update' || operationType === 'replace') currentSecondUpdates++;
  else if (operationType === 'delete') currentSecondDeletes++;

  // Broadcast via Socket.io
  io.emit('cdc_event', cdcEvent);

  return cdcEvent;
}

// --- DATABASE MUTATION HELPERS ---
function performInsert(collectionName, data) {
  if (!collections[collectionName]) {
    collections[collectionName] = [];
  }

  const prefixMap = { users: 'usr', orders: 'ord', inventory: 'inv', products: 'prd' };
  const prefix = prefixMap[collectionName] || 'doc';
  const newId = data._id || `${prefix}_${Date.now().toString(36).slice(-4)}_${Math.floor(Math.random() * 1000)}`;

  const newDoc = { _id: newId, ...data, createdAt: new Date().toISOString() };
  collections[collectionName].push(newDoc);

  const event = createChangeEvent('insert', collectionName, newId, newDoc, null, null);
  return { doc: newDoc, event };
}

function performUpdate(collectionName, documentId, updateFields) {
  const coll = collections[collectionName] || [];
  const index = coll.findIndex(doc => doc._id === documentId);

  if (index === -1) {
    throw new Error(`Document with ID '${documentId}' not found in collection '${collectionName}'`);
  }

  const beforeDoc = JSON.parse(JSON.stringify(coll[index]));
  const updatedDoc = { ...beforeDoc, ...updateFields, _id: documentId, updatedAt: new Date().toISOString() };
  
  coll[index] = updatedDoc;

  const updatedFieldsObj = {};
  Object.keys(updateFields).forEach(key => {
    if (key !== '_id') updatedFieldsObj[key] = updateFields[key];
  });

  const updateDescription = {
    updatedFields: updatedFieldsObj,
    removedFields: [],
    truncatedArrays: []
  };

  const event = createChangeEvent('update', collectionName, documentId, updatedDoc, beforeDoc, updateDescription);
  return { doc: updatedDoc, event };
}

function performDelete(collectionName, documentId) {
  const coll = collections[collectionName] || [];
  const index = coll.findIndex(doc => doc._id === documentId);

  if (index === -1) {
    throw new Error(`Document with ID '${documentId}' not found in collection '${collectionName}'`);
  }

  const beforeDoc = JSON.parse(JSON.stringify(coll[index]));
  coll.splice(index, 1);

  const event = createChangeEvent('delete', collectionName, documentId, null, beforeDoc, null);
  return { doc: beforeDoc, event };
}

// --- AUTO SIMULATOR MUTATION GENERATOR ---
const mockNames = ['Marcus Vance', 'Elena Rostova', 'Kaelen Voss', 'Talia Thorne', 'Gideon Cross', 'Zoe Sterling'];
const mockRoles = ['Customer', 'Analyst', 'Engineer', 'Support', 'Manager'];
const orderStatuses = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
const paymentMethods = ['CreditCard', 'PayPal', 'Crypto', 'ApplePay', 'BankTransfer'];

function triggerRandomMutation() {
  const collectionKeys = Object.keys(collections);
  const selectedCollection = collectionKeys[Math.floor(Math.random() * collectionKeys.length)];
  const collDocs = collections[selectedCollection] || [];

  // Decide operation weighted: 50% update, 35% insert, 15% delete (if docs exist)
  const rand = Math.random();
  let opType = 'insert';
  if (collDocs.length > 0) {
    if (rand < 0.50) opType = 'update';
    else if (rand < 0.85) opType = 'insert';
    else opType = 'delete';
  }

  try {
    if (opType === 'insert') {
      let data = {};
      if (selectedCollection === 'users') {
        const name = mockNames[Math.floor(Math.random() * mockNames.length)];
        data = {
          name,
          email: `${name.toLowerCase().replace(' ', '.')}@futurenet.io`,
          role: mockRoles[Math.floor(Math.random() * mockRoles.length)],
          status: 'ACTIVE',
          credits: Math.floor(Math.random() * 3000) + 100
        };
      } else if (selectedCollection === 'orders') {
        const userDocs = collections.users || [];
        const randomUser = userDocs[Math.floor(Math.random() * userDocs.length)];
        data = {
          userId: randomUser ? randomUser._id : 'usr_anon',
          totalAmount: parseFloat((Math.random() * 500 + 15).toFixed(2)),
          status: 'PENDING',
          itemsCount: Math.floor(Math.random() * 5) + 1,
          paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)]
        };
      } else if (selectedCollection === 'inventory') {
        const idNum = Math.floor(Math.random() * 900) + 100;
        data = {
          sku: `SKU-NEON-${idNum}`,
          productName: `Cyber Module ${idNum}`,
          stockQuantity: Math.floor(Math.random() * 150) + 10,
          warehouseLocation: `Zone-${['A','B','C','D'][Math.floor(Math.random()*4)]}${Math.floor(Math.random()*9)+1}`,
          unitPrice: parseFloat((Math.random() * 1000 + 50).toFixed(2))
        };
      } else if (selectedCollection === 'products') {
        data = {
          title: `Smart Device X-${Math.floor(Math.random() * 100)}`,
          category: ['Gadgets', 'Hardware', 'Software', 'Sensors'][Math.floor(Math.random()*4)],
          price: parseFloat((Math.random() * 2000 + 99).toFixed(2)),
          rating: parseFloat((Math.random() * 1.5 + 3.5).toFixed(1)),
          isAvailable: Math.random() > 0.2
        };
      }
      performInsert(selectedCollection, data);
    } else if (opType === 'update') {
      const targetDoc = collDocs[Math.floor(Math.random() * collDocs.length)];
      if (!targetDoc) return;

      let updateData = {};
      if (selectedCollection === 'users') {
        updateData = {
          credits: (targetDoc.credits || 100) + Math.floor(Math.random() * 100) - 20,
          status: Math.random() > 0.15 ? 'ACTIVE' : 'SUSPENDED'
        };
      } else if (selectedCollection === 'orders') {
        const nextStatus = orderStatuses[Math.floor(Math.random() * orderStatuses.length)];
        updateData = { status: nextStatus };
      } else if (selectedCollection === 'inventory') {
        const delta = Math.floor(Math.random() * 20) - 10;
        updateData = { stockQuantity: Math.max(0, (targetDoc.stockQuantity || 50) + delta) };
      } else if (selectedCollection === 'products') {
        updateData = {
          price: parseFloat((Math.max(10, (targetDoc.price || 100) * (0.9 + Math.random() * 0.2))).toFixed(2)),
          isAvailable: Math.random() > 0.1
        };
      }
      performUpdate(selectedCollection, targetDoc._id, updateData);
    } else if (opType === 'delete') {
      // Don't deplete collection entirely
      if (collDocs.length > 2) {
        const targetDoc = collDocs[Math.floor(Math.random() * collDocs.length)];
        performDelete(selectedCollection, targetDoc._id);
      }
    }
  } catch (err) {
    console.error('Simulator error:', err.message);
  }
}

function startSimulator(tps) {
  stopSimulator();
  simulatorActive = true;
  simulatorTps = Math.max(1, Math.min(20, tps || 2));
  const intervalMs = Math.floor(1000 / simulatorTps);

  simulatorTimer = setInterval(() => {
    if (simulatorActive) {
      triggerRandomMutation();
    }
  }, intervalMs);

  io.emit('simulator_status', { active: true, tps: simulatorTps });
}

function stopSimulator() {
  simulatorActive = false;
  if (simulatorTimer) {
    clearInterval(simulatorTimer);
    simulatorTimer = null;
  }
  io.emit('simulator_status', { active: false, tps: simulatorTps });
}

// Interval to compute throughput metrics every 1 sec
setInterval(() => {
  const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  
  tpsHistory.push({
    time: nowStr,
    tps: currentSecondEvents,
    inserts: currentSecondInserts,
    updates: currentSecondUpdates,
    deletes: currentSecondDeletes
  });

  if (tpsHistory.length > 30) {
    tpsHistory.shift();
  }

  const stats = calculateStats();
  io.emit('stats_update', stats);

  // Reset second counters
  currentSecondEvents = 0;
  currentSecondInserts = 0;
  currentSecondUpdates = 0;
  currentSecondDeletes = 0;
}, 1000);

function calculateStats() {
  const collectionCounts = {};
  Object.keys(collections).forEach(coll => {
    collectionCounts[coll] = collections[coll].length;
  });

  let insertCount = 0;
  let updateCount = 0;
  let deleteCount = 0;
  let totalPayloadBytes = 0;

  cdcEventBuffer.forEach(evt => {
    if (evt.operationType === 'insert') insertCount++;
    else if (evt.operationType === 'update' || evt.operationType === 'replace') updateCount++;
    else if (evt.operationType === 'delete') deleteCount++;
    totalPayloadBytes += evt.payloadSizeBytes || 0;
  });

  const avgPayloadSizeKB = cdcEventBuffer.length > 0 
    ? (totalPayloadBytes / cdcEventBuffer.length / 1024).toFixed(2)
    : 0;

  const latestTps = tpsHistory.length > 0 ? tpsHistory[tpsHistory.length - 1].tps : 0;

  return {
    totalEvents: totalEventCount,
    bufferCount: cdcEventBuffer.length,
    tps: latestTps,
    insertCount,
    updateCount,
    deleteCount,
    avgPayloadSizeKB: parseFloat(avgPayloadSizeKB),
    collectionCounts,
    tpsHistory,
    simulatorActive,
    simulatorTps
  };
}

// --- REST ENDPOINTS ---

app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'CDC Stream Simulator API',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

app.get('/api/collections', (req, res) => {
  const summary = {};
  Object.keys(collections).forEach(coll => {
    summary[coll] = {
      count: collections[coll].length,
      sampleDoc: collections[coll][0] || null
    };
  });
  res.json({ success: true, collections: summary });
});

app.get('/api/collections/:name', (req, res) => {
  const collName = req.params.name;
  if (!collections[collName]) {
    return res.status(404).json({ success: false, error: `Collection '${collName}' does not exist.` });
  }
  res.json({ success: true, collection: collName, data: collections[collName] });
});

app.get('/api/cdc/events', (req, res) => {
  let { collection, operationType, limit, search } = req.query;
  let filtered = [...cdcEventBuffer];

  if (collection && collection !== 'all') {
    filtered = filtered.filter(evt => evt.ns.coll === collection);
  }

  if (operationType && operationType !== 'all') {
    filtered = filtered.filter(evt => evt.operationType === operationType.toLowerCase());
  }

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(evt => {
      const docStr = JSON.stringify(evt).toLowerCase();
      return docStr.includes(q);
    });
  }

  const limitNum = parseInt(limit) || 100;
  filtered = filtered.slice(0, limitNum);

  res.json({
    success: true,
    count: filtered.length,
    totalInBuffer: cdcEventBuffer.length,
    events: filtered
  });
});

app.get('/api/cdc/stats', (req, res) => {
  res.json({ success: true, stats: calculateStats() });
});

app.post('/api/cdc/mutate', (req, res) => {
  try {
    const { collection, operationType, documentId, data } = req.body;

    if (!collection || !collections[collection]) {
      return res.status(400).json({ success: false, error: `Invalid collection '${collection}'` });
    }

    if (!operationType || !['insert', 'update', 'delete'].includes(operationType.toLowerCase())) {
      return res.status(400).json({ success: false, error: "operationType must be 'insert', 'update', or 'delete'" });
    }

    const op = operationType.toLowerCase();
    let result;

    if (op === 'insert') {
      result = performInsert(collection, data || {});
    } else if (op === 'update') {
      if (!documentId) {
        return res.status(400).json({ success: false, error: "documentId is required for update operation" });
      }
      result = performUpdate(collection, documentId, data || {});
    } else if (op === 'delete') {
      if (!documentId) {
        return res.status(400).json({ success: false, error: "documentId is required for delete operation" });
      }
      result = performDelete(collection, documentId);
    }

    res.json({
      success: true,
      message: `Successfully executed ${op.toUpperCase()} on '${collection}'`,
      cdcEvent: result.event,
      affectedDocument: result.doc
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/cdc/simulator/toggle', (req, res) => {
  const { active, tps } = req.body;

  if (active) {
    startSimulator(tps);
  } else {
    stopSimulator();
  }

  res.json({
    success: true,
    simulatorActive,
    simulatorTps
  });
});

app.post('/api/cdc/clear', (req, res) => {
  cdcEventBuffer.length = 0;
  totalEventCount = 0;
  tpsHistory.length = 0;

  io.emit('cdc_cleared');
  res.json({ success: true, message: 'CDC event log and metrics reset.' });
});

// --- SOCKET.IO CONNECTIONS ---
io.on('connection', (socket) => {
  console.log(`[Socket.io] Client connected: ${socket.id}`);

  // Send initial data snapshot
  socket.emit('initial_state', {
    stats: calculateStats(),
    recentEvents: cdcEventBuffer.slice(0, 50),
    collectionsList: Object.keys(collections)
  });

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Client disconnected: ${socket.id}`);
  });
});

// Start HTTP server
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 CDC Stream Simulator Server running on port ${PORT}`);
  console.log(`📡 Socket.io ready for real-time Mongo Change Streams`);
  console.log(`====================================================`);
});
