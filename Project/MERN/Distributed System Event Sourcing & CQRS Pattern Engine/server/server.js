const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// ==========================================
// 1. IMMUTABLE EVENT STORE
// ==========================================
class EventStore {
  constructor() {
    this.events = [];
    this.subscribers = [];
    this.sequence = 0;
  }

  append(aggregateType, aggregateId, eventType, data, metadata = {}) {
    this.sequence += 1;
    const event = {
      sequence: this.sequence,
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      timestamp: new Date().toISOString(),
      aggregateType,
      aggregateId,
      eventType,
      data,
      metadata: {
        correlationId: metadata.correlationId || `corr_${Math.random().toString(36).substr(2, 8)}`,
        userId: metadata.userId || 'system_admin',
        version: metadata.version || 1
      }
    };

    // Immutable append
    this.events.push(Object.freeze(event));

    // Notify asynchronous projection subscribers
    this.notifySubscribers(event);

    return event;
  }

  getEvents(filter = {}) {
    let result = [...this.events];
    if (filter.aggregateId) {
      result = result.filter(e => e.aggregateId === filter.aggregateId);
    }
    if (filter.aggregateType) {
      result = result.filter(e => e.aggregateType === filter.aggregateType);
    }
    if (filter.eventType) {
      result = result.filter(e => e.eventType === filter.eventType);
    }
    if (filter.upToSeq !== undefined && filter.upToSeq !== null) {
      result = result.filter(e => e.sequence <= parseInt(filter.upToSeq, 10));
    }
    return result;
  }

  subscribe(listener) {
    this.subscribers.push(listener);
  }

  notifySubscribers(event) {
    this.subscribers.forEach(listener => {
      // Simulate async projection updater pipeline with minimal latency
      setTimeout(() => {
        try {
          listener(event);
        } catch (err) {
          console.error('Error in projection updater:', err);
        }
      }, 30);
    });
  }

  clear() {
    this.events = [];
    this.sequence = 0;
  }
}

const eventStore = new EventStore();

// ==========================================
// 2. READ MODEL PROJECTIONS (CQRS QUERY SIDE)
// ==========================================
class ProjectionManager {
  constructor() {
    this.ordersProjection = new Map(); // orderId -> Order Read Model
    this.inventoryProjection = new Map(); // sku -> Inventory Read Model
    this.analyticsProjection = {
      totalRevenue: 0,
      totalOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      eventsProcessed: 0,
      lastEventSequence: 0,
      statusBreakdown: {
        CREATED: 0,
        PAID: 0,
        SHIPPED: 0,
        CANCELLED: 0
      }
    };
    this.projectionStatus = {
      OrderSummaryProjection: { status: 'UP_TO_DATE', processedEvents: 0, lastUpdated: null },
      InventoryStockProjection: { status: 'UP_TO_DATE', processedEvents: 0, lastUpdated: null },
      RevenueAnalyticsProjection: { status: 'UP_TO_DATE', processedEvents: 0, lastUpdated: null }
    };

    // Pre-populate inventory defaults
    this.initializeDefaultInventory();
  }

  initializeDefaultInventory() {
    const defaultItems = [
      { sku: 'SKU-MED-101', name: 'Cardiac Monitor Pro', stock: 45, reserved: 0, unitPrice: 1250 },
      { sku: 'SKU-MED-202', name: 'Ultrasound Scanner Portable', stock: 20, reserved: 0, unitPrice: 3400 },
      { sku: 'SKU-MED-303', name: 'Digital Stethoscope X1', stock: 100, reserved: 0, unitPrice: 299 },
      { sku: 'SKU-MED-404', name: 'Smart Infusion Pump', stock: 35, reserved: 0, unitPrice: 850 }
    ];
    defaultItems.forEach(item => {
      this.inventoryProjection.set(item.sku, { ...item });
    });
  }

  reset() {
    this.ordersProjection.clear();
    this.inventoryProjection.clear();
    this.initializeDefaultInventory();
    this.analyticsProjection = {
      totalRevenue: 0,
      totalOrders: 0,
      completedOrders: 0,
      cancelledOrders: 0,
      eventsProcessed: 0,
      lastEventSequence: 0,
      statusBreakdown: {
        CREATED: 0,
        PAID: 0,
        SHIPPED: 0,
        CANCELLED: 0
      }
    };
    Object.keys(this.projectionStatus).forEach(key => {
      this.projectionStatus[key].processedEvents = 0;
      this.projectionStatus[key].status = 'UP_TO_DATE';
      this.projectionStatus[key].lastUpdated = new Date().toISOString();
    });
  }

  applyEvent(event) {
    const now = new Date().toISOString();
    this.analyticsProjection.eventsProcessed += 1;
    this.analyticsProjection.lastEventSequence = event.sequence;

    switch (event.eventType) {
      case 'OrderCreated': {
        const { orderId, customerName, customerEmail, items, totalAmount } = event.data;
        this.ordersProjection.set(orderId, {
          orderId,
          customerName,
          customerEmail,
          items,
          totalAmount,
          status: 'CREATED',
          createdAt: event.timestamp,
          updatedAt: event.timestamp,
          history: [{ status: 'CREATED', timestamp: event.timestamp, note: 'Order initiated' }]
        });
        
        // Update stock reservations
        items.forEach(item => {
          if (this.inventoryProjection.has(item.sku)) {
            const stockItem = this.inventoryProjection.get(item.sku);
            stockItem.reserved += item.quantity;
            this.inventoryProjection.set(item.sku, stockItem);
          }
        });

        this.analyticsProjection.totalOrders += 1;
        this.analyticsProjection.statusBreakdown.CREATED += 1;
        break;
      }

      case 'PaymentProcessed': {
        const { orderId, paymentId, amount, paymentMethod } = event.data;
        if (this.ordersProjection.has(orderId)) {
          const order = this.ordersProjection.get(orderId);
          order.status = 'PAID';
          order.paymentDetails = { paymentId, amount, paymentMethod, paidAt: event.timestamp };
          order.updatedAt = event.timestamp;
          order.history.push({ status: 'PAID', timestamp: event.timestamp, note: `Paid $${amount} via ${paymentMethod}` });
          this.ordersProjection.set(orderId, order);
        }
        this.analyticsProjection.totalRevenue += amount;
        this.analyticsProjection.statusBreakdown.CREATED = Math.max(0, this.analyticsProjection.statusBreakdown.CREATED - 1);
        this.analyticsProjection.statusBreakdown.PAID += 1;
        break;
      }

      case 'OrderShipped': {
        const { orderId, trackingNumber, carrier } = event.data;
        if (this.ordersProjection.has(orderId)) {
          const order = this.ordersProjection.get(orderId);
          order.status = 'SHIPPED';
          order.shippingDetails = { trackingNumber, carrier, shippedAt: event.timestamp };
          order.updatedAt = event.timestamp;
          order.history.push({ status: 'SHIPPED', timestamp: event.timestamp, note: `Shipped via ${carrier} (${trackingNumber})` });
          this.ordersProjection.set(orderId, order);

          // Deduct reserved & stock
          order.items.forEach(item => {
            if (this.inventoryProjection.has(item.sku)) {
              const stockItem = this.inventoryProjection.get(item.sku);
              stockItem.stock = Math.max(0, stockItem.stock - item.quantity);
              stockItem.reserved = Math.max(0, stockItem.reserved - item.quantity);
              this.inventoryProjection.set(item.sku, stockItem);
            }
          });
        }
        this.analyticsProjection.completedOrders += 1;
        this.analyticsProjection.statusBreakdown.PAID = Math.max(0, this.analyticsProjection.statusBreakdown.PAID - 1);
        this.analyticsProjection.statusBreakdown.SHIPPED += 1;
        break;
      }

      case 'OrderCancelled': {
        const { orderId, reason } = event.data;
        if (this.ordersProjection.has(orderId)) {
          const order = this.ordersProjection.get(orderId);
          const prevStatus = order.status;
          order.status = 'CANCELLED';
          order.cancelReason = reason;
          order.updatedAt = event.timestamp;
          order.history.push({ status: 'CANCELLED', timestamp: event.timestamp, note: `Cancelled: ${reason}` });
          this.ordersProjection.set(orderId, order);

          // Release stock reservation
          order.items.forEach(item => {
            if (this.inventoryProjection.has(item.sku)) {
              const stockItem = this.inventoryProjection.get(item.sku);
              stockItem.reserved = Math.max(0, stockItem.reserved - item.quantity);
              this.inventoryProjection.set(item.sku, stockItem);
            }
          });

          if (prevStatus === 'CREATED') {
            this.analyticsProjection.statusBreakdown.CREATED = Math.max(0, this.analyticsProjection.statusBreakdown.CREATED - 1);
          } else if (prevStatus === 'PAID') {
            this.analyticsProjection.statusBreakdown.PAID = Math.max(0, this.analyticsProjection.statusBreakdown.PAID - 1);
          }
        }
        this.analyticsProjection.cancelledOrders += 1;
        this.analyticsProjection.statusBreakdown.CANCELLED += 1;
        break;
      }

      case 'ItemRestocked': {
        const { sku, name, quantity, unitPrice } = event.data;
        if (this.inventoryProjection.has(sku)) {
          const item = this.inventoryProjection.get(sku);
          item.stock += quantity;
          if (unitPrice) item.unitPrice = unitPrice;
          this.inventoryProjection.set(sku, item);
        } else {
          this.inventoryProjection.set(sku, {
            sku,
            name: name || sku,
            stock: quantity,
            reserved: 0,
            unitPrice: unitPrice || 100
          });
        }
        break;
      }
      default:
        break;
    }

    // Update Projection statuses
    Object.keys(this.projectionStatus).forEach(key => {
      this.projectionStatus[key].processedEvents = event.sequence;
      this.projectionStatus[key].lastUpdated = now;
      this.projectionStatus[key].status = 'UP_TO_DATE';
    });
  }
}

const projectionManager = new ProjectionManager();
eventStore.subscribe(event => projectionManager.applyEvent(event));

// Dynamic SSE Clients list for live event streaming
let sseClients = [];

eventStore.subscribe(event => {
  sseClients.forEach(client => {
    client.res.write(`data: ${JSON.stringify(event)}\n\n`);
  });
});

// ==========================================
// 3. COMMAND HANDLERS & DOMAIN LOGIC
// ==========================================
class CommandHandlers {
  static createOrder({ customerName, customerEmail, items }) {
    if (!customerName || !items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Customer name and at least one item are required');
    }

    const orderId = `ORD-${Date.now().toString().slice(-6)}`;
    let totalAmount = 0;

    // Validate inventory stock
    items.forEach(item => {
      const stockItem = projectionManager.inventoryProjection.get(item.sku);
      if (!stockItem) {
        throw new Error(`Item ${item.sku} does not exist in inventory`);
      }
      const availableStock = stockItem.stock - stockItem.reserved;
      if (availableStock < item.quantity) {
        throw new Error(`Insufficient stock for item ${stockItem.name}. Requested: ${item.quantity}, Available: ${availableStock}`);
      }
      item.name = stockItem.name;
      item.unitPrice = stockItem.unitPrice;
      totalAmount += stockItem.unitPrice * item.quantity;
    });

    // Append OrderCreated event to immutable event store
    const event = eventStore.append('OrderAggregate', orderId, 'OrderCreated', {
      orderId,
      customerName,
      customerEmail: customerEmail || `${customerName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
      items,
      totalAmount
    });

    return { success: true, orderId, event };
  }

  static processPayment({ orderId, paymentMethod }) {
    const order = projectionManager.ordersProjection.get(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }
    if (order.status !== 'CREATED') {
      throw new Error(`Cannot pay for order ${orderId} in state '${order.status}'`);
    }

    const paymentId = `PAY-${Date.now().toString().slice(-6)}`;
    const event = eventStore.append('OrderAggregate', orderId, 'PaymentProcessed', {
      orderId,
      paymentId,
      amount: order.totalAmount,
      paymentMethod: paymentMethod || 'Credit Card'
    });

    return { success: true, orderId, paymentId, event };
  }

  static shipOrder({ orderId, carrier }) {
    const order = projectionManager.ordersProjection.get(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }
    if (order.status !== 'PAID') {
      throw new Error(`Cannot ship order ${orderId} in state '${order.status}'. Order must be PAID first.`);
    }

    const trackingNumber = `TRK-${Math.floor(100000 + Math.random() * 900000)}`;
    const event = eventStore.append('OrderAggregate', orderId, 'OrderShipped', {
      orderId,
      trackingNumber,
      carrier: carrier || 'FedEx Express'
    });

    return { success: true, orderId, trackingNumber, event };
  }

  static cancelOrder({ orderId, reason }) {
    const order = projectionManager.ordersProjection.get(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }
    if (order.status === 'SHIPPED') {
      throw new Error(`Cannot cancel order ${orderId} because it has already been SHIPPED.`);
    }
    if (order.status === 'CANCELLED') {
      throw new Error(`Order ${orderId} is already CANCELLED.`);
    }

    const event = eventStore.append('OrderAggregate', orderId, 'OrderCancelled', {
      orderId,
      reason: reason || 'Customer requested cancellation'
    });

    return { success: true, orderId, event };
  }

  static restockItem({ sku, name, quantity, unitPrice }) {
    if (!sku || !quantity || quantity <= 0) {
      throw new Error('Valid SKU and positive quantity are required');
    }

    const event = eventStore.append('InventoryAggregate', sku, 'ItemRestocked', {
      sku,
      name: name || sku,
      quantity: parseInt(quantity, 10),
      unitPrice: unitPrice ? parseFloat(unitPrice) : undefined
    });

    return { success: true, sku, event };
  }
}

// ==========================================
// 4. REST API ENDPOINTS
// ==========================================

// Health & System Info
app.get('/api/status', (req, res) => {
  res.json({
    status: 'ONLINE',
    engine: 'CQRS & Event Sourcing Engine v1.0',
    totalEvents: eventStore.events.length,
    totalOrders: projectionManager.ordersProjection.size,
    totalInventorySKUs: projectionManager.inventoryProjection.size,
    timestamp: new Date().toISOString()
  });
});

// COMMAND SIDE API (WRITE MODEL)
app.post('/api/commands/create-order', (req, res) => {
  try {
    const result = CommandHandlers.createOrder(req.body);
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/commands/process-payment', (req, res) => {
  try {
    const result = CommandHandlers.processPayment(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/commands/ship-order', (req, res) => {
  try {
    const result = CommandHandlers.shipOrder(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/commands/cancel-order', (req, res) => {
  try {
    const result = CommandHandlers.cancelOrder(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/commands/restock-item', (req, res) => {
  try {
    const result = CommandHandlers.restockItem(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// SEED DEMO TRANSACTIONS
app.post('/api/commands/seed', (req, res) => {
  try {
    // 1. Create order 1
    const o1 = CommandHandlers.createOrder({
      customerName: 'Dr. Sarah Connor',
      customerEmail: 's.connor@medcenter.org',
      items: [{ sku: 'SKU-MED-101', quantity: 2 }]
    });
    CommandHandlers.processPayment({ orderId: o1.orderId, paymentMethod: 'Corporate Card' });
    CommandHandlers.shipOrder({ orderId: o1.orderId, carrier: 'DHL Express Medical' });

    // 2. Create order 2
    const o2 = CommandHandlers.createOrder({
      customerName: 'Metro General Hospital',
      customerEmail: 'procurement@metrohospital.io',
      items: [{ sku: 'SKU-MED-202', quantity: 1 }, { sku: 'SKU-MED-303', quantity: 5 }]
    });
    CommandHandlers.processPayment({ orderId: o2.orderId, paymentMethod: 'ACH Wire Transfer' });

    // 3. Create order 3
    const o3 = CommandHandlers.createOrder({
      customerName: 'St. Jude Children Clinic',
      customerEmail: 'inventory@stjude.org',
      items: [{ sku: 'SKU-MED-404', quantity: 3 }]
    });

    // 4. Create order 4 & cancel
    const o4 = CommandHandlers.createOrder({
      customerName: 'Apex Care Systems',
      customerEmail: 'orders@apexcare.com',
      items: [{ sku: 'SKU-MED-101', quantity: 1 }]
    });
    CommandHandlers.cancelOrder({ orderId: o4.orderId, reason: 'Duplicate order entered by staff' });

    res.json({
      success: true,
      message: 'Demo CQRS event stream seeded successfully',
      eventCount: eventStore.events.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// QUERY SIDE API (READ MODEL / MATERIALIZED VIEWS)
app.get('/api/queries/orders', (req, res) => {
  const { status, search } = req.query;
  let orders = Array.from(projectionManager.ordersProjection.values());

  if (status) {
    orders = orders.filter(o => o.status === status);
  }
  if (search) {
    const q = search.toLowerCase();
    orders = orders.filter(o =>
      o.orderId.toLowerCase().includes(q) ||
      o.customerName.toLowerCase().includes(q) ||
      o.customerEmail.toLowerCase().includes(q)
    );
  }

  res.json(orders);
});

app.get('/api/queries/orders/:id', (req, res) => {
  const order = projectionManager.ordersProjection.get(req.params.id);
  if (!order) {
    return res.status(404).json({ error: 'Order projection not found' });
  }
  res.json(order);
});

app.get('/api/queries/inventory', (req, res) => {
  const items = Array.from(projectionManager.inventoryProjection.values());
  res.json(items);
});

app.get('/api/queries/analytics', (req, res) => {
  res.json(projectionManager.analyticsProjection);
});

app.get('/api/queries/projections', (req, res) => {
  res.json(projectionManager.projectionStatus);
});

// EVENT STORE API
app.get('/api/events', (req, res) => {
  const filter = {
    aggregateId: req.query.aggregateId,
    aggregateType: req.query.aggregateType,
    eventType: req.query.eventType,
    upToSeq: req.query.upToSeq
  };
  res.json(eventStore.getEvents(filter));
});

// EVENT STREAM (SSE)
app.get('/api/events/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const clientId = Date.now();
  const newClient = { id: clientId, res };
  sseClients.push(newClient);

  req.on('close', () => {
    sseClients = sseClients.filter(c => c.id !== clientId);
  });
});

// EVENT REPLAY & TIME-TRAVEL ENGINE
app.post('/api/replay/reset', (req, res) => {
  const { targetSequence } = req.body;
  const maxSeq = targetSequence !== undefined ? parseInt(targetSequence, 10) : eventStore.events.length;

  // Reset read models
  projectionManager.reset();

  // Replay events up to targetSequence
  const eventsToReplay = eventStore.events.filter(e => e.sequence <= maxSeq);
  eventsToReplay.forEach(event => {
    projectionManager.applyEvent(event);
  });

  res.json({
    success: true,
    replayedSequence: maxSeq,
    totalEvents: eventStore.events.length,
    projectedOrdersCount: projectionManager.ordersProjection.size
  });
});

// State Snapshot at sequence N without mutating live state
app.get('/api/replay/state-at/:seq', (req, res) => {
  const targetSeq = parseInt(req.params.seq, 10);
  const tempProjection = new ProjectionManager();
  tempProjection.reset();

  const eventsToApply = eventStore.events.filter(e => e.sequence <= targetSeq);
  eventsToApply.forEach(e => tempProjection.applyEvent(e));

  res.json({
    targetSequence: targetSeq,
    totalEventsApplied: eventsToApply.length,
    orders: Array.from(tempProjection.ordersProjection.values()),
    inventory: Array.from(tempProjection.inventoryProjection.values()),
    analytics: tempProjection.analyticsProjection
  });
});

// START SERVER
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` CQRS & Event Sourcing Engine Server Running!`);
  console.log(` Port: http://localhost:${PORT}`);
  console.log(` Stream: http://localhost:${PORT}/api/events/stream`);
  console.log(`====================================================`);
});
