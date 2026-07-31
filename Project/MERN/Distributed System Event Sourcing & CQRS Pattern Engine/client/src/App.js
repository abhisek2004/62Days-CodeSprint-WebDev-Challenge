import React, { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Layers,
  Zap,
  Play,
  Pause,
  RotateCcw,
  Clock,
  Database,
  ArrowRight,
  ShieldCheck,
  Package,
  ShoppingCart,
  CreditCard,
  Truck,
  XCircle,
  PlusCircle,
  RefreshCw,
  Search,
  CheckCircle2,
  FileCode,
  Terminal,
  Cpu,
  BarChart3,
  ListFilter,
  Eye
} from 'lucide-react';

const API_BASE = 'http://localhost:5000/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('architecture'); // architecture, cqs, events, replay, projections
  const [systemStatus, setSystemStatus] = useState(null);
  const [events, setEvents] = useState([]);
  const [orders, setOrders] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [projections, setProjections] = useState({});
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Command Form States
  const [createOrderForm, setCreateOrderForm] = useState({
    customerName: 'Dr. Evelyn Reed',
    customerEmail: 'evelyn.reed@medcenter.org',
    sku: 'SKU-MED-101',
    quantity: 1
  });
  const [paymentForm, setPaymentForm] = useState({ orderId: '', paymentMethod: 'Corporate Credit Card' });
  const [shipForm, setShipForm] = useState({ orderId: '', carrier: 'FedEx Express Care' });
  const [cancelForm, setCancelForm] = useState({ orderId: '', reason: 'Customer requested change of items' });
  const [restockForm, setRestockForm] = useState({ sku: 'SKU-MED-101', name: 'Cardiac Monitor Pro', quantity: 10, unitPrice: 1250 });

  // Event Replay & Time Travel States
  const [replaySeq, setReplaySeq] = useState(0);
  const [isPlayingReplay, setIsPlayingReplay] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1000);
  const [timeTravelState, setTimeTravelState] = useState(null);
  const replayIntervalRef = useRef(null);

  // Filter States
  const [eventSearch, setEventSearch] = useState('');
  const [eventFilterType, setEventFilterType] = useState('ALL');
  const [expandedEventSeq, setExpandedEventSeq] = useState(null);

  // Architecture Animation active node signal
  const [activeArchNode, setActiveArchNode] = useState(null);

  // Fetch initial data
  const fetchData = async () => {
    try {
      const [statusRes, eventsRes, ordersRes, invRes, analyticsRes, projRes] = await Promise.all([
        fetch(`${API_BASE}/status`).then(r => r.json()).catch(() => null),
        fetch(`${API_BASE}/events`).then(r => r.json()).catch(() => []),
        fetch(`${API_BASE}/queries/orders`).then(r => r.json()).catch(() => []),
        fetch(`${API_BASE}/queries/inventory`).then(r => r.json()).catch(() => []),
        fetch(`${API_BASE}/queries/analytics`).then(r => r.json()).catch(() => null),
        fetch(`${API_BASE}/queries/projections`).then(r => r.json()).catch(() => ({}))
      ]);

      setSystemStatus(statusRes);
      setEvents(eventsRes);
      setOrders(ordersRes);
      setInventory(invRes);
      setAnalytics(analyticsRes);
      setProjections(projRes);
      if (eventsRes.length > 0 && replaySeq === 0) {
        setReplaySeq(eventsRes.length);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  // Listen to live SSE Event Stream
  useEffect(() => {
    let eventSource;
    try {
      eventSource = new EventSource(`${API_BASE}/events/stream`);
      eventSource.onmessage = (e) => {
        const newEvent = JSON.parse(e.data);
        showNotification(`New Event Appended: #${newEvent.sequence} ${newEvent.eventType}`, 'info');
        triggerArchNodePulse('eventStore');
        fetchData();
      };
    } catch (err) {
      console.log('SSE connection error:', err);
    }
    return () => {
      if (eventSource) eventSource.close();
    };
  }, []);

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const triggerArchNodePulse = (nodeId) => {
    setActiveArchNode(nodeId);
    setTimeout(() => setActiveArchNode(null), 1200);
  };

  // Seed Demo Data
  const handleSeedDemo = async () => {
    setLoading(true);
    triggerArchNodePulse('commandHandler');
    try {
      const res = await fetch(`${API_BASE}/commands/seed`, { method: 'POST' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      showNotification('Demo CQRS Event Stream Seeded Successfully!');
      fetchData();
    } catch (err) {
      showNotification(`Seed Error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Command Handlers
  const dispatchCommand = async (url, body, commandName) => {
    setLoading(true);
    triggerArchNodePulse('commandHandler');
    try {
      const res = await fetch(`${API_BASE}/commands/${url}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      showNotification(`Command Succeeded: ${commandName} -> Event #${data.event.sequence}`);
      triggerArchNodePulse('projectionWorker');
      fetchData();
    } catch (err) {
      showNotification(`Command Error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Event Replay API trigger
  const handleReplayToSeq = async (seq) => {
    setReplaySeq(seq);
    try {
      const res = await fetch(`${API_BASE}/replay/state-at/${seq}`);
      const data = await res.json();
      setTimeTravelState(data);
    } catch (err) {
      console.error('Time travel fetch error:', err);
    }
  };

  // Replay animation controls
  const togglePlayReplay = () => {
    if (isPlayingReplay) {
      setIsPlayingReplay(false);
      clearInterval(replayIntervalRef.current);
    } else {
      setIsPlayingReplay(true);
      if (replaySeq >= events.length) {
        handleReplayToSeq(1);
      }
      replayIntervalRef.current = setInterval(() => {
        setReplaySeq(prev => {
          if (prev >= events.length) {
            setIsPlayingReplay(false);
            clearInterval(replayIntervalRef.current);
            return prev;
          }
          const next = prev + 1;
          handleReplayToSeq(next);
          return next;
        });
      }, replaySpeed);
    }
  };

  useEffect(() => {
    return () => clearInterval(replayIntervalRef.current);
  }, []);

  const handleResetProjections = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/replay/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetSequence: events.length })
      });
      const data = await res.json();
      showNotification(`Rebuilt all read model projections from event store (${data.replayedSequence} events)`);
      fetchData();
    } catch (err) {
      showNotification(`Rebuild failed: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Event Filtered List
  const filteredEvents = events.filter(e => {
    const matchesSearch = e.aggregateId.toLowerCase().includes(eventSearch.toLowerCase()) ||
                          e.eventType.toLowerCase().includes(eventSearch.toLowerCase()) ||
                          JSON.stringify(e.data).toLowerCase().includes(eventSearch.toLowerCase());
    const matchesType = eventFilterType === 'ALL' || e.eventType === eventFilterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="app-container">
      {/* Toast Notification */}
      {notification && (
        <div className={`toast-notification ${notification.type}`}>
          <Zap className="icon-pulse" size={18} />
          <span>{notification.msg}</span>
        </div>
      )}

      {/* Header */}
      <header className="header-bar">
        <div className="brand-group">
          <div className="brand-icon">
            <Cpu size={26} />
          </div>
          <div>
            <h1 className="brand-title">CQRS & Event Sourcing Engine</h1>
            <p className="brand-subtitle">Distributed Systems Command-Query Separation Visualizer</p>
          </div>
        </div>

        <div className="header-actions">
          <div className="system-pill">
            <div className={`status-dot ${systemStatus ? 'online' : 'offline'}`} />
            <span>{systemStatus ? `Store: ${events.length} Events` : 'Backend Disconnected'}</span>
          </div>

          <button className="btn btn-secondary" onClick={handleSeedDemo} disabled={loading}>
            <RotateCcw size={16} />
            <span>Seed Sample Transactions</span>
          </button>

          <button className="btn btn-primary" onClick={fetchData}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            <span>Sync State</span>
          </button>
        </div>
      </header>

      {/* Main Navigation Tabs */}
      <nav className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'architecture' ? 'active' : ''}`}
          onClick={() => setActiveTab('architecture')}
        >
          <Layers size={18} />
          <span>CQRS Architecture Visualizer</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'cqs' ? 'active' : ''}`}
          onClick={() => setActiveTab('cqs')}
        >
          <Zap size={18} />
          <span>Command vs Query Separation</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
        >
          <Database size={18} />
          <span>Immutable Event Log ({events.length})</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'replay' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('replay');
            if (events.length > 0) handleReplayToSeq(replaySeq || events.length);
          }}
        >
          <Clock size={18} />
          <span>Time-Travel Event Replayer</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'projections' ? 'active' : ''}`}
          onClick={() => setActiveTab('projections')}
        >
          <BarChart3 size={18} />
          <span>Projection Inspector</span>
        </button>
      </nav>

      {/* TAB CONTENT 1: ARCHITECTURE VISUALIZER */}
      {activeTab === 'architecture' && (
        <div className="tab-pane">
          <div className="section-header">
            <div>
              <h2>Architectural Flow: Command & Query Responsibility Segregation</h2>
              <p>Visual representation of write-model command dispatch, append-only event log, asynchronous bus dispatch, and read-model materialized projections.</p>
            </div>
            <div className="arch-legend">
              <span className="legend-item write"><span className="dot"></span> Write Path (Commands)</span>
              <span className="legend-item event"><span className="dot"></span> Immutable Event Log</span>
              <span className="legend-item read"><span className="dot"></span> Read Path (Materialized Queries)</span>
            </div>
          </div>

          <div className="arch-diagram-container">
            {/* SVG Dynamic Connectors */}
            <svg className="arch-svg-canvas">
              <path d="M 180 140 L 320 140" className={`svg-line ${activeArchNode === 'commandHandler' ? 'active-write' : ''}`} />
              <path d="M 480 140 L 620 140" className={`svg-line ${activeArchNode === 'eventStore' ? 'active-event' : ''}`} />
              <path d="M 720 180 L 720 280 L 520 280" className={`svg-line ${activeArchNode === 'projectionWorker' ? 'active-event' : ''}`} />
              <path d="M 380 280 L 180 280" className="svg-line active-read" />
            </svg>

            <div className="arch-grid">
              {/* Write Side Card */}
              <div className={`arch-card write-card ${activeArchNode === 'commandHandler' ? 'pulse-glow' : ''}`}>
                <div className="card-badge write">COMMAND API (WRITE MODEL)</div>
                <div className="card-icon"><Zap size={28} /></div>
                <h3>Command Pipeline</h3>
                <p>Accepts domain intent (CreateOrder, PayOrder, Restock). Enforces state consistency rules before generating events.</p>
                <div className="card-foot">
                  <span>State: Input Validation</span>
                  <ArrowRight size={16} />
                </div>
              </div>

              {/* Event Store Card */}
              <div className={`arch-card event-card ${activeArchNode === 'eventStore' ? 'pulse-glow' : ''}`}>
                <div className="card-badge event">IMMUTABLE EVENT LOG</div>
                <div className="card-icon"><Database size={28} /></div>
                <h3>Append-Only Store</h3>
                <p>Single source of truth. Events are sequence-indexed, timestamped, and stored permanently without updates or deletes.</p>
                <div className="card-foot">
                  <span>Count: {events.length} Events</span>
                  <ArrowRight size={16} />
                </div>
              </div>

              {/* Async Projection Worker Card */}
              <div className={`arch-card projection-card ${activeArchNode === 'projectionWorker' ? 'pulse-glow' : ''}`}>
                <div className="card-badge projection">ASYNC EVENT BUS</div>
                <div className="card-icon"><Activity size={28} /></div>
                <h3>Projection Updaters</h3>
                <p>Asynchronously consumes event stream & materializes specialized read models (Orders, Stock, Analytics views).</p>
                <div className="card-foot">
                  <span>Projections: 3 Active</span>
                  <ArrowRight size={16} />
                </div>
              </div>

              {/* Read Side Card */}
              <div className="arch-card read-card">
                <div className="card-badge read">QUERY API (READ MODEL)</div>
                <div className="card-icon"><BarChart3 size={28} /></div>
                <h3>Materialized Views</h3>
                <p>High-speed, denormalized read models tuned specifically for UI presentation without complex joins.</p>
                <div className="card-foot">
                  <span>Eventual Consistency</span>
                  <CheckCircle2 size={16} />
                </div>
              </div>
            </div>

            {/* Architecture Metrics Grid */}
            <div className="metrics-strip">
              <div className="metric-box">
                <span className="metric-label">Total Domain Events</span>
                <span className="metric-value">{events.length}</span>
              </div>
              <div className="metric-box">
                <span className="metric-label">Active Orders</span>
                <span className="metric-value">{orders.length}</span>
              </div>
              <div className="metric-box">
                <span className="metric-label">Total Revenue</span>
                <span className="metric-value">${analytics ? analytics.totalRevenue.toLocaleString() : 0}</span>
              </div>
              <div className="metric-box">
                <span className="metric-label">Projection Processing Status</span>
                <span className="metric-value text-success">SYNCHRONIZED</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 2: COMMAND VS QUERY SEPARATION (CQS) */}
      {activeTab === 'cqs' && (
        <div className="tab-pane">
          <div className="cqs-split-layout">
            {/* LEFT PANEL: COMMAND WORKSTATION (WRITE MODEL) */}
            <div className="cqs-column write-column">
              <div className="column-header write-border">
                <div className="header-icon write"><Zap size={22} /></div>
                <div>
                  <h3>Command Dispatcher (Write Side)</h3>
                  <p>Issue immutable domain commands to modify system state</p>
                </div>
              </div>

              <div className="command-forms-container">
                {/* 1. Create Order Command */}
                <div className="form-card">
                  <h4><ShoppingCart size={18} /> Create Order Command</h4>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Customer Name</label>
                      <input
                        type="text"
                        value={createOrderForm.customerName}
                        onChange={e => setCreateOrderForm({ ...createOrderForm, customerName: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Select Item SKU</label>
                      <select
                        value={createOrderForm.sku}
                        onChange={e => setCreateOrderForm({ ...createOrderForm, sku: e.target.value })}
                      >
                        {inventory.map(item => (
                          <option key={item.sku} value={item.sku}>
                            {item.name} (${item.unitPrice}) - Avail: {item.stock - item.reserved}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Quantity</label>
                      <input
                        type="number"
                        min="1"
                        value={createOrderForm.quantity}
                        onChange={e => setCreateOrderForm({ ...createOrderForm, quantity: parseInt(e.target.value, 10) })}
                      />
                    </div>
                  </div>
                  <button
                    className="btn btn-write"
                    onClick={() => dispatchCommand('create-order', {
                      customerName: createOrderForm.customerName,
                      customerEmail: createOrderForm.customerEmail,
                      items: [{ sku: createOrderForm.sku, quantity: createOrderForm.quantity }]
                    }, 'CreateOrder')}
                    disabled={loading}
                  >
                    <PlusCircle size={16} />
                    <span>Dispatch CreateOrder Command</span>
                  </button>
                </div>

                {/* 2. Process Payment Command */}
                <div className="form-card">
                  <h4><CreditCard size={18} /> Process Payment Command</h4>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Target Order ID</label>
                      <select
                        value={paymentForm.orderId}
                        onChange={e => setPaymentForm({ ...paymentForm, orderId: e.target.value })}
                      >
                        <option value="">-- Select Unpaid Order --</option>
                        {orders.filter(o => o.status === 'CREATED').map(o => (
                          <option key={o.orderId} value={o.orderId}>
                            {o.orderId} - {o.customerName} (${o.totalAmount})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Payment Method</label>
                      <select
                        value={paymentForm.paymentMethod}
                        onChange={e => setPaymentForm({ ...paymentForm, paymentMethod: e.target.value })}
                      >
                        <option value="Corporate Credit Card">Corporate Credit Card</option>
                        <option value="Wire Transfer ACH">Wire Transfer ACH</option>
                        <option value="Healthcare Voucher">Healthcare Voucher</option>
                      </select>
                    </div>
                  </div>
                  <button
                    className="btn btn-write"
                    onClick={() => dispatchCommand('process-payment', paymentForm, 'ProcessPayment')}
                    disabled={loading || !paymentForm.orderId}
                  >
                    <CreditCard size={16} />
                    <span>Dispatch ProcessPayment Command</span>
                  </button>
                </div>

                {/* 3. Ship Order Command */}
                <div className="form-card">
                  <h4><Truck size={18} /> Ship Order Command</h4>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Target Paid Order ID</label>
                      <select
                        value={shipForm.orderId}
                        onChange={e => setShipForm({ ...shipForm, orderId: e.target.value })}
                      >
                        <option value="">-- Select Paid Order --</option>
                        {orders.filter(o => o.status === 'PAID').map(o => (
                          <option key={o.orderId} value={o.orderId}>
                            {o.orderId} - {o.customerName}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label>Carrier</label>
                      <input
                        type="text"
                        value={shipForm.carrier}
                        onChange={e => setShipForm({ ...shipForm, carrier: e.target.value })}
                      />
                    </div>
                  </div>
                  <button
                    className="btn btn-write"
                    onClick={() => dispatchCommand('ship-order', shipForm, 'ShipOrder')}
                    disabled={loading || !shipForm.orderId}
                  >
                    <Truck size={16} />
                    <span>Dispatch ShipOrder Command</span>
                  </button>
                </div>

                {/* 4. Restock Inventory Command */}
                <div className="form-card">
                  <h4><Package size={18} /> Restock Inventory Command</h4>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>SKU</label>
                      <input
                        type="text"
                        value={restockForm.sku}
                        onChange={e => setRestockForm({ ...restockForm, sku: e.target.value })}
                      />
                    </div>
                    <div className="form-group">
                      <label>Add Stock Qty</label>
                      <input
                        type="number"
                        min="1"
                        value={restockForm.quantity}
                        onChange={e => setRestockForm({ ...restockForm, quantity: parseInt(e.target.value, 10) })}
                      />
                    </div>
                  </div>
                  <button
                    className="btn btn-write"
                    onClick={() => dispatchCommand('restock-item', restockForm, 'RestockItem')}
                    disabled={loading}
                  >
                    <PlusCircle size={16} />
                    <span>Dispatch RestockItem Command</span>
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT PANEL: QUERY WORKSTATION (READ MODEL) */}
            <div className="cqs-column read-column">
              <div className="column-header read-border">
                <div className="header-icon read"><BarChart3 size={22} /></div>
                <div>
                  <h3>Materialized Read Models (Query Side)</h3>
                  <p>Denormalized views generated by asynchronous projection updaters</p>
                </div>
              </div>

              {/* Order Read Model */}
              <div className="query-section">
                <div className="query-section-title">
                  <h4>Orders Read Model ({orders.length})</h4>
                  <span className="read-badge">UPDATED VIA EVENT STREAM</span>
                </div>

                <div className="read-table-wrapper">
                  <table className="read-table">
                    <thead>
                      <tr>
                        <th>Order ID</th>
                        <th>Customer</th>
                        <th>Status</th>
                        <th>Amount</th>
                        <th>Items</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.length === 0 ? (
                        <tr>
                          <td colSpan="5" className="empty-cell">No orders projected yet. Dispatch a command!</td>
                        </tr>
                      ) : (
                        orders.map(order => (
                          <tr key={order.orderId}>
                            <td className="mono-text">{order.orderId}</td>
                            <td>{order.customerName}</td>
                            <td>
                              <span className={`status-pill status-${order.status.toLowerCase()}`}>
                                {order.status}
                              </span>
                            </td>
                            <td className="mono-text">${order.totalAmount}</td>
                            <td>
                              {order.items.map(i => `${i.name} (x${i.quantity})`).join(', ')}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Inventory Stock Read Model */}
              <div className="query-section mt-4">
                <div className="query-section-title">
                  <h4>Inventory Stock Projection ({inventory.length} SKUs)</h4>
                  <span className="read-badge">MATERIALIZED VIEW</span>
                </div>

                <div className="inventory-grid">
                  {inventory.map(item => (
                    <div className="inventory-card" key={item.sku}>
                      <div className="inv-header">
                        <span className="inv-sku">{item.sku}</span>
                        <span className="inv-price">${item.unitPrice}</span>
                      </div>
                      <h5>{item.name}</h5>
                      <div className="inv-metrics">
                        <div className="inv-m">
                          <span className="m-lbl">Physical Stock</span>
                          <span className="m-val">{item.stock}</span>
                        </div>
                        <div className="inv-m">
                          <span className="m-lbl">Reserved</span>
                          <span className="m-val text-warning">{item.reserved}</span>
                        </div>
                        <div className="inv-m">
                          <span className="m-lbl">Available</span>
                          <span className="m-val text-success">{item.stock - item.reserved}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 3: IMMUTABLE EVENT LOG STREAM */}
      {activeTab === 'events' && (
        <div className="tab-pane">
          <div className="events-toolbar">
            <div className="search-box">
              <Search size={18} />
              <input
                type="text"
                placeholder="Search event sequence, aggregate ID, or payload..."
                value={eventSearch}
                onChange={e => setEventSearch(e.target.value)}
              />
            </div>

            <div className="filter-group">
              <ListFilter size={18} />
              <select
                value={eventFilterType}
                onChange={e => setEventFilterType(e.target.value)}
              >
                <option value="ALL">All Event Types</option>
                <option value="OrderCreated">OrderCreated</option>
                <option value="PaymentProcessed">PaymentProcessed</option>
                <option value="OrderShipped">OrderShipped</option>
                <option value="OrderCancelled">OrderCancelled</option>
                <option value="ItemRestocked">ItemRestocked</option>
              </select>
            </div>

            <div className="event-count-badge">
              <span>Showing {filteredEvents.length} of {events.length} Events</span>
            </div>
          </div>

          <div className="event-stream-container">
            {filteredEvents.length === 0 ? (
              <div className="empty-state">
                <Database size={48} />
                <h3>No events match your criteria</h3>
                <p>Click "Seed Sample Transactions" to generate a rich set of domain events.</p>
              </div>
            ) : (
              filteredEvents.slice().reverse().map(evt => (
                <div className="event-row-card" key={evt.eventId}>
                  <div className="event-seq-box">
                    <span className="seq-label">SEQ</span>
                    <span className="seq-num">#{evt.sequence}</span>
                  </div>

                  <div className="event-main-info">
                    <div className="event-header">
                      <span className={`event-type-tag tag-${evt.eventType.toLowerCase()}`}>
                        {evt.eventType}
                      </span>
                      <span className="aggregate-tag">
                        {evt.aggregateType} :: <strong className="mono-text">{evt.aggregateId}</strong>
                      </span>
                      <span className="timestamp-tag">
                        <Clock size={12} />
                        {new Date(evt.timestamp).toLocaleTimeString()} ({new Date(evt.timestamp).toLocaleDateString()})
                      </span>
                    </div>

                    <div className="event-summary">
                      {evt.eventType === 'OrderCreated' && `Created order for ${evt.data.customerName} ($${evt.data.totalAmount})`}
                      {evt.eventType === 'PaymentProcessed' && `Paid $${evt.data.amount} via ${evt.data.paymentMethod}`}
                      {evt.eventType === 'OrderShipped' && `Shipped via ${evt.data.carrier} (${evt.data.trackingNumber})`}
                      {evt.eventType === 'OrderCancelled' && `Cancelled: ${evt.data.reason}`}
                      {evt.eventType === 'ItemRestocked' && `Restocked ${evt.data.quantity} units of ${evt.data.name || evt.data.sku}`}
                    </div>
                  </div>

                  <button
                    className="btn btn-icon"
                    onClick={() => setExpandedEventSeq(expandedEventSeq === evt.sequence ? null : evt.sequence)}
                  >
                    <Eye size={16} />
                  </button>

                  {expandedEventSeq === evt.sequence && (
                    <div className="event-json-drawer">
                      <div className="json-header">
                        <span>IMMUTABLE EVENT PAYLOAD & METADATA</span>
                        <FileCode size={14} />
                      </div>
                      <pre className="json-code">
                        {JSON.stringify(evt, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB CONTENT 4: TIME-TRAVEL EVENT REPLAYER */}
      {activeTab === 'replay' && (
        <div className="tab-pane">
          <div className="time-travel-panel">
            <div className="panel-header">
              <div>
                <h2>Event Replay & State Time-Travel Engine</h2>
                <p>Scrub back through historical sequence points. Replay events sequentially to observe state evolution across time.</p>
              </div>

              <div className="replay-controls">
                <button className="btn btn-secondary" onClick={togglePlayReplay}>
                  {isPlayingReplay ? <Pause size={16} /> : <Play size={16} />}
                  <span>{isPlayingReplay ? 'Pause Replay' : 'Play Replay'}</span>
                </button>

                <div className="speed-selector">
                  <span>Speed:</span>
                  <button className={`speed-btn ${replaySpeed === 1500 ? 'active' : ''}`} onClick={() => setReplaySpeed(1500)}>0.5x</button>
                  <button className={`speed-btn ${replaySpeed === 1000 ? 'active' : ''}`} onClick={() => setReplaySpeed(1000)}>1x</button>
                  <button className={`speed-btn ${replaySpeed === 400 ? 'active' : ''}`} onClick={() => setReplaySpeed(400)}>2.5x</button>
                </div>
              </div>
            </div>

            {/* Timeline Slider */}
            <div className="scrubber-card">
              <div className="scrubber-labels">
                <span>Sequence #0 (Initial)</span>
                <span className="current-seq">Target Sequence: #{replaySeq} / {events.length}</span>
                <span>Sequence #{events.length} (Latest)</span>
              </div>
              <input
                type="range"
                min="0"
                max={events.length}
                value={replaySeq}
                onChange={e => handleReplayToSeq(parseInt(e.target.value, 10))}
                className="timeline-slider"
              />
            </div>

            {/* Side-by-side Time-Travel Snapshot */}
            <div className="snapshot-grid">
              {/* Snapshot Left: Projected State at Sequence N */}
              <div className="snapshot-card">
                <div className="snapshot-header">
                  <Clock size={18} />
                  <h4>Projected State at Sequence #{replaySeq}</h4>
                </div>

                {timeTravelState ? (
                  <div className="snapshot-body">
                    <div className="stat-summary-strip">
                      <div className="s-box">
                        <span className="s-lbl">Orders Count</span>
                        <span className="s-val">{timeTravelState.orders.length}</span>
                      </div>
                      <div className="s-box">
                        <span className="s-lbl">Revenue</span>
                        <span className="s-val">${timeTravelState.analytics.totalRevenue}</span>
                      </div>
                      <div className="s-box">
                        <span className="s-lbl">Events Replayed</span>
                        <span className="s-val">{timeTravelState.totalEventsApplied}</span>
                      </div>
                    </div>

                    <h5>Orders at Sequence #{replaySeq}</h5>
                    <div className="snapshot-table-wrapper">
                      <table className="read-table mini">
                        <thead>
                          <tr>
                            <th>Order ID</th>
                            <th>Customer</th>
                            <th>Status</th>
                            <th>Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {timeTravelState.orders.length === 0 ? (
                            <tr><td colSpan="4" className="empty-cell">No orders existed at this sequence.</td></tr>
                          ) : (
                            timeTravelState.orders.map(o => (
                              <tr key={o.orderId}>
                                <td className="mono-text">{o.orderId}</td>
                                <td>{o.customerName}</td>
                                <td><span className={`status-pill status-${o.status.toLowerCase()}`}>{o.status}</span></td>
                                <td>${o.totalAmount}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <div className="loading-box">Select a sequence point to view reconstructed read model state.</div>
                )}
              </div>

              {/* Snapshot Right: Live Current State */}
              <div className="snapshot-card current-live">
                <div className="snapshot-header">
                  <Zap size={18} />
                  <h4>Current Live System State (Sequence #{events.length})</h4>
                </div>

                <div className="snapshot-body">
                  <div className="stat-summary-strip">
                    <div className="s-box">
                      <span className="s-lbl">Live Orders</span>
                      <span className="s-val">{orders.length}</span>
                    </div>
                    <div className="s-box">
                      <span className="s-lbl">Live Revenue</span>
                      <span className="s-val">${analytics ? analytics.totalRevenue : 0}</span>
                    </div>
                    <div className="s-box">
                      <span className="s-lbl">Total Events</span>
                      <span className="s-val">{events.length}</span>
                    </div>
                  </div>

                  <h5>Latest Projected Orders</h5>
                  <div className="snapshot-table-wrapper">
                    <table className="read-table mini">
                      <thead>
                        <tr>
                          <th>Order ID</th>
                          <th>Customer</th>
                          <th>Status</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orders.map(o => (
                          <tr key={o.orderId}>
                            <td className="mono-text">{o.orderId}</td>
                            <td>{o.customerName}</td>
                            <td><span className={`status-pill status-${o.status.toLowerCase()}`}>{o.status}</span></td>
                            <td>${o.totalAmount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB CONTENT 5: PROJECTION INSPECTOR & HEALTH */}
      {activeTab === 'projections' && (
        <div className="tab-pane">
          <div className="projections-header">
            <div>
              <h2>Read Model Projection Worker Inspector</h2>
              <p>Monitor asynchronously updated materialized views, event lag metrics, and trigger projection rebuilds from scratch.</p>
            </div>
            <button className="btn btn-secondary" onClick={handleResetProjections} disabled={loading}>
              <RotateCcw size={16} />
              <span>Force Rebuild All Projections</span>
            </button>
          </div>

          <div className="projections-grid">
            {Object.keys(projections).map(name => {
              const p = projections[name];
              return (
                <div className="projection-inspect-card" key={name}>
                  <div className="proj-title">
                    <Database size={20} />
                    <h3>{name}</h3>
                  </div>

                  <div className="proj-status-badge success">
                    <CheckCircle2 size={14} />
                    <span>{p.status}</span>
                  </div>

                  <div className="proj-metrics">
                    <div className="p-m">
                      <span>Processed Events:</span>
                      <strong>{p.processedEvents} / {events.length}</strong>
                    </div>
                    <div className="p-m">
                      <span>Lag:</span>
                      <strong className="text-success">0 ms (Up to Date)</strong>
                    </div>
                    <div className="p-m">
                      <span>Last Updated:</span>
                      <small>{p.lastUpdated ? new Date(p.lastUpdated).toLocaleTimeString() : 'N/A'}</small>
                    </div>
                  </div>

                  <div className="proj-schema-preview">
                    <span>Target Materialized Table</span>
                    <code>
                      {name === 'OrderSummaryProjection' && 'Map<OrderId, OrderReadModel>'}
                      {name === 'InventoryStockProjection' && 'Map<SKU, StockReadModel>'}
                      {name === 'RevenueAnalyticsProjection' && 'Object<RevenueStats>'}
                    </code>
                  </div>
                </div>
              );
            })}
          </div>

          {/* System Audit Projection Stats */}
          {analytics && (
            <div className="analytics-card mt-6">
              <h3>System Analytics & CQRS Operational Health</h3>
              <div className="analytics-grid">
                <div className="a-box">
                  <span className="a-lbl">Total Orders Handled</span>
                  <span className="a-val">{analytics.totalOrders}</span>
                </div>
                <div className="a-box">
                  <span className="a-lbl">Completed Orders</span>
                  <span className="a-val text-success">{analytics.completedOrders}</span>
                </div>
                <div className="a-box">
                  <span className="a-lbl">Cancelled Orders</span>
                  <span className="a-val text-danger">{analytics.cancelledOrders}</span>
                </div>
                <div className="a-box">
                  <span className="a-lbl">Total Events Processed</span>
                  <span className="a-val">{analytics.eventsProcessed}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
