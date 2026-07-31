import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Bot, 
  RefreshCw, 
  Layers, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  Zap,
  BarChart2,
  DollarSign
} from 'lucide-react';

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

function App() {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [symbol, setSymbol] = useState('BTC/USDT');
  const [symbols] = useState(['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'NVDA/USD']);

  // Market & Order Book States
  const [orderBook, setOrderBook] = useState({ bids: [], asks: [], spread: 0, spreadPct: 0 });
  const [marketStats, setMarketStats] = useState({
    lastPrice: 0,
    open24h: 0,
    high24h: 0,
    low24h: 0,
    volume24h: 0,
    tradeCount: 0,
    priceChange: 0,
    priceChangePercent: 0
  });
  const [candlestickData, setCandlestickData] = useState([]);
  const [trades, setTrades] = useState([]);
  const [openOrders, setOpenOrders] = useState([]);
  const [botEnabled, setBotEnabled] = useState(true);

  // Form State
  const [orderSide, setOrderSide] = useState('BUY'); // 'BUY' or 'SELL'
  const [orderType, setOrderType] = useState('LIMIT'); // 'LIMIT', 'MARKET', 'STOP_LOSS'
  const [price, setPrice] = useState('');
  const [triggerPrice, setTriggerPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [feedback, setFeedback] = useState(null);

  // UI View States
  const [obViewMode, setObViewMode] = useState('ALL'); // 'ALL', 'BIDS', 'ASKS'
  const [activeBottomTab, setActiveBottomTab] = useState('TRADES'); // 'TRADES', 'ORDERS', 'ANALYTICS'
  const [prevLastPrice, setPrevLastPrice] = useState(0);
  const [priceFlash, setPriceFlash] = useState(''); // 'flash-up' or 'flash-down'

  // Canvas Ref for Candlestick Chart
  const canvasRef = useRef(null);
  const [hoveredCandle, setHoveredCandle] = useState(null);

  // --- Socket Initialization ---
  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    newSocket.on('orderBookUpdate', (depth) => {
      setOrderBook(depth);
    });

    newSocket.on('marketStatsUpdate', (stats) => {
      setMarketStats(prev => {
        if (prev.lastPrice !== stats.lastPrice) {
          setPrevLastPrice(prev.lastPrice);
          setPriceFlash(stats.lastPrice >= prev.lastPrice ? 'flash-up' : 'flash-down');
          setTimeout(() => setPriceFlash(''), 600);
        }
        return stats;
      });
    });

    newSocket.on('candlestickUpdate', (candles) => {
      setCandlestickData(candles);
    });

    newSocket.on('tradesUpdate', (recentTrades) => {
      setTrades(recentTrades);
    });

    newSocket.on('openOrdersUpdate', (orders) => {
      setOpenOrders(orders);
    });

    newSocket.on('botStatus', ({ botEnabled: status }) => {
      setBotEnabled(status);
    });

    newSocket.on('orderFeedback', (fb) => {
      setFeedback(fb);
      setTimeout(() => setFeedback(null), 4000);
    });

    setSocket(newSocket);

    return () => newSocket.close();
  }, []);

  // Handle Symbol Switch
  const handleSymbolChange = (newSym) => {
    setSymbol(newSym);
    setPrice('');
    setTriggerPrice('');
    setAmount('');
    if (socket) {
      socket.emit('changeSymbol', newSym);
    }
  };

  // Populate form price when clicking order book row
  const handleSelectPrice = (p) => {
    setPrice(p.toFixed(2));
  };

  // Toggle Bot
  const handleToggleBot = () => {
    if (socket) {
      socket.emit('toggleBot', !botEnabled);
    }
  };

  // Reset Liquidity
  const handleResetLiquidity = () => {
    if (socket) {
      socket.emit('resetLiquidity', symbol);
    }
  };

  // Order Submission Handler
  const handleSubmitOrder = (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) {
      setFeedback({ success: false, error: 'Please enter a valid amount.' });
      return;
    }
    if (orderType === 'LIMIT' && (!price || parseFloat(price) <= 0)) {
      setFeedback({ success: false, error: 'Please enter a valid price for Limit orders.' });
      return;
    }
    if (orderType === 'STOP_LOSS' && (!triggerPrice || parseFloat(triggerPrice) <= 0)) {
      setFeedback({ success: false, error: 'Please enter a valid trigger price for Stop-Loss orders.' });
      return;
    }

    const payload = {
      symbol,
      side: orderSide,
      type: orderType,
      price: orderType === 'MARKET' ? null : parseFloat(price),
      triggerPrice: orderType === 'STOP_LOSS' ? parseFloat(triggerPrice) : null,
      amount: parseFloat(amount),
      userId: 'USER_TRADER'
    };

    if (socket) {
      socket.emit('submitOrder', payload);
      setAmount('');
    }
  };

  // Cancel Order
  const handleCancelOrder = (orderId) => {
    if (socket) {
      socket.emit('cancelOrder', { symbol, orderId });
    }
  };

  // Quick Amount Percentage calculation
  const setAmountPct = (pct) => {
    // Arbitrary simulated budget for quick calculation
    const dummyBalance = orderSide === 'BUY' ? 10000 / (marketStats.lastPrice || 1) : 2.5;
    const calc = (dummyBalance * (pct / 100)).toFixed(4);
    setAmount(calc);
  };

  // --- HTML5 Canvas Candlestick Chart Renderer ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || candlestickData.length === 0) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width = canvas.parentElement.clientWidth;
    const height = canvas.height = canvas.parentElement.clientHeight;

    ctx.clearRect(0, 0, width, height);

    const padding = { top: 20, right: 65, bottom: 35, left: 15 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Determine min/max price and max volume
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    let maxVolume = 0;

    candlestickData.forEach(c => {
      minPrice = Math.min(minPrice, c.low);
      maxPrice = Math.max(maxPrice, c.high);
      maxVolume = Math.max(maxVolume, c.volume);
    });

    const priceRange = maxPrice - minPrice || 1;
    const pricePadding = priceRange * 0.05;
    minPrice -= pricePadding;
    maxPrice += pricePadding;
    const adjustedRange = maxPrice - minPrice;

    // Draw Grid & Y-Axis Prices
    ctx.strokeStyle = '#1e2638';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#788b9c';
    ctx.font = '11px "JetBrains Mono", monospace';

    const yTicks = 5;
    for (let i = 0; i <= yTicks; i++) {
      const y = padding.top + (chartHeight / yTicks) * i;
      const priceVal = maxPrice - (adjustedRange / yTicks) * i;

      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      ctx.fillText(priceVal.toFixed(2), width - padding.right + 8, y + 4);
    }

    // Draw Candles & Volume Bars
    const candleCount = candlestickData.length;
    const candleWidth = Math.max(2, (chartWidth / candleCount) * 0.7);
    const gap = chartWidth / candleCount;

    candlestickData.forEach((c, index) => {
      const x = padding.left + index * gap + gap / 2;
      const openY = padding.top + ((maxPrice - c.open) / adjustedRange) * chartHeight;
      const closeY = padding.top + ((maxPrice - c.close) / adjustedRange) * chartHeight;
      const highY = padding.top + ((maxPrice - c.high) / adjustedRange) * chartHeight;
      const lowY = padding.top + ((maxPrice - c.low) / adjustedRange) * chartHeight;

      const isUp = c.close >= c.open;
      const candleColor = isUp ? '#00e676' : '#ff5252';

      // Draw High/Low Wick Line
      ctx.strokeStyle = candleColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Draw Candle Body
      ctx.fillStyle = candleColor;
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(2, Math.abs(closeY - openY));
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);

      // Draw Volume Bar at Bottom
      const volHeight = (c.volume / (maxVolume || 1)) * (chartHeight * 0.2);
      ctx.fillStyle = isUp ? 'rgba(0, 230, 118, 0.25)' : 'rgba(255, 82, 82, 0.25)';
      ctx.fillRect(x - candleWidth / 2, height - padding.bottom - volHeight, candleWidth, volHeight);
    });

    // Draw Last Price Line
    if (marketStats.lastPrice) {
      const lastY = padding.top + ((maxPrice - marketStats.lastPrice) / adjustedRange) * chartHeight;
      ctx.strokeStyle = '#00b0ff';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(padding.left, lastY);
      ctx.lineTo(width - padding.right, lastY);
      ctx.stroke();
      ctx.setLineDash([]);

      // Price Tag
      ctx.fillStyle = '#00b0ff';
      ctx.fillRect(width - padding.right, lastY - 9, 60, 18);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.fillText(marketStats.lastPrice.toFixed(2), width - padding.right + 4, lastY + 4);
    }
  }, [candlestickData, marketStats.lastPrice]);

  // Order Book Depth Aggregations & Ratios
  const totalBidVol = orderBook.bids.reduce((acc, b) => acc + b.amount, 0);
  const totalAskVol = orderBook.asks.reduce((acc, a) => acc + a.amount, 0);
  const totalVol = totalBidVol + totalAskVol || 1;
  const bidRatio = ((totalBidVol / totalVol) * 100).toFixed(1);
  const askRatio = ((totalAskVol / totalVol) * 100).toFixed(1);

  return (
    <div className="app-container">
      {/* Top Header / Navigation */}
      <header className="navbar">
        <div className="brand-section">
          <div className="brand-logo">
            <Zap size={22} className="text-accent" />
            <span>ApexTrader</span>PRO
          </div>
          <select 
            className="symbol-selector" 
            value={symbol} 
            onChange={(e) => handleSymbolChange(e.target.value)}
          >
            {symbols.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="ticker-stats">
          <div className="stat-item">
            <span className="stat-label">Last Price</span>
            <span className={`stat-value large mono ${marketStats.priceChange >= 0 ? 'up' : 'down'} ${priceFlash}`}>
              ${marketStats.lastPrice.toFixed(2)}
            </span>
          </div>

          <div className="stat-item">
            <span className="stat-label">24h Change</span>
            <span className={`stat-value mono ${marketStats.priceChange >= 0 ? 'up' : 'down'}`}>
              {marketStats.priceChange >= 0 ? '+' : ''}{marketStats.priceChange.toFixed(2)} ({marketStats.priceChangePercent}%)
            </span>
          </div>

          <div className="stat-item">
            <span className="stat-label">24h High</span>
            <span className="stat-value mono">${marketStats.high24h.toFixed(2)}</span>
          </div>

          <div className="stat-item">
            <span className="stat-label">24h Low</span>
            <span className="stat-value mono">${marketStats.low24h.toFixed(2)}</span>
          </div>

          <div className="stat-item">
            <span className="stat-label">24h Volume</span>
            <span className="stat-value mono">{marketStats.volume24h.toFixed(2)}</span>
          </div>
        </div>

        <div className="header-actions">
          <button 
            className={`btn-toggle-bot ${botEnabled ? 'active' : ''}`}
            onClick={handleToggleBot}
            title="Toggle Automated Market Maker Liquidity Engine"
          >
            <Bot size={15} />
            Bot Liquidity: {botEnabled ? 'ON' : 'OFF'}
          </button>

          <button 
            className="btn-reset-book"
            onClick={handleResetLiquidity}
            title="Reset Order Book Depth"
          >
            <RefreshCw size={14} />
          </button>

          <div className="status-badge">
            <div className="status-dot"></div>
            {isConnected ? 'LIVE ENGINE' : 'CONNECTING...'}
          </div>
        </div>
      </header>

      {/* Main Workspace Layout */}
      <main className="main-workspace">
        {/* Left Column: Interactive Candlestick Chart */}
        <section className="panel-card chart-panel">
          <div className="panel-header">
            <div className="panel-title">
              <BarChart2 size={16} />
              Real-Time Price & Volume Chart ({symbol})
            </div>
            <div className="chart-controls">
              <button className="timeframe-btn active">5s Ticks</button>
              <button className="timeframe-btn">1m</button>
              <button className="timeframe-btn">5m</button>
            </div>
          </div>

          <div className="chart-canvas-container">
            <canvas ref={canvasRef} />
          </div>
        </section>

        {/* Middle Column: Order Book Depth Visualizer */}
        <section className="panel-card orderbook-panel">
          <div className="panel-header">
            <div className="panel-title">
              <Layers size={16} />
              Order Book Depth
            </div>
            <div className="orderbook-controls">
              <button 
                className={`view-mode-btn ${obViewMode === 'ALL' ? 'active' : ''}`}
                onClick={() => setObViewMode('ALL')}
              >
                All
              </button>
              <button 
                className={`view-mode-btn ${obViewMode === 'BIDS' ? 'active' : ''}`}
                onClick={() => setObViewMode('BIDS')}
              >
                Bids
              </button>
              <button 
                className={`view-mode-btn ${obViewMode === 'ASKS' ? 'active' : ''}`}
                onClick={() => setObViewMode('ASKS')}
              >
                Asks
              </button>
            </div>
          </div>

          <div className="orderbook-headers">
            <span>Price (USDT)</span>
            <span className="align-right">Size</span>
            <span className="align-right">Total Depth</span>
          </div>

          <div className="orderbook-rows-container">
            {/* ASKS (Sells) - Sorted High to Low */}
            {(obViewMode === 'ALL' || obViewMode === 'ASKS') && (
              <div className="asks-section">
                {orderBook.asks.slice().reverse().map((ask, idx) => (
                  <div 
                    key={`ask-${idx}`} 
                    className="ob-row ask"
                    onClick={() => handleSelectPrice(ask.price)}
                    title="Click price to fill order form"
                  >
                    <div 
                      className="ob-depth-bar" 
                      style={{ width: `${ask.depthPct}%` }}
                    />
                    <span className="ob-cell ob-price ask mono">${ask.price.toFixed(2)}</span>
                    <span className="ob-cell align-right mono">{ask.amount.toFixed(4)}</span>
                    <span className="ob-cell align-right mono">{ask.total.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Spread Row */}
            <div className="spread-row">
              <span className="spread-val">
                Spread: <strong className="mono">${orderBook.spread ? orderBook.spread.toFixed(2) : '0.00'}</strong> ({orderBook.spreadPct}%)
              </span>
              <span className="mono">
                Last: <strong>${marketStats.lastPrice.toFixed(2)}</strong>
              </span>
            </div>

            {/* BIDS (Buys) - Sorted High to Low */}
            {(obViewMode === 'ALL' || obViewMode === 'BIDS') && (
              <div className="bids-section">
                {orderBook.bids.map((bid, idx) => (
                  <div 
                    key={`bid-${idx}`} 
                    className="ob-row bid"
                    onClick={() => handleSelectPrice(bid.price)}
                    title="Click price to fill order form"
                  >
                    <div 
                      className="ob-depth-bar" 
                      style={{ width: `${bid.depthPct}%` }}
                    />
                    <span className="ob-cell ob-price bid mono">${bid.price.toFixed(2)}</span>
                    <span className="ob-cell align-right mono">{bid.amount.toFixed(4)}</span>
                    <span className="ob-cell align-right mono">{bid.total.toFixed(4)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Order Placement Form */}
        <section className="panel-card order-form-panel">
          <div className="order-tabs">
            <button 
              className={`tab-btn buy ${orderSide === 'BUY' ? 'active' : ''}`}
              onClick={() => setOrderSide('BUY')}
            >
              BUY
            </button>
            <button 
              className={`tab-btn sell ${orderSide === 'SELL' ? 'active' : ''}`}
              onClick={() => setOrderSide('SELL')}
            >
              SELL
            </button>
          </div>

          <form onSubmit={handleSubmitOrder} className="form-body">
            {/* Feedback Banner */}
            {feedback && (
              <div className={`status-badge ${feedback.success ? 'up' : 'down'}`} style={{ borderRadius: 6, padding: 8 }}>
                {feedback.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                <span>{feedback.message || feedback.error}</span>
              </div>
            )}

            {/* Order Type Selector */}
            <div className="type-selector">
              <button 
                type="button"
                className={`type-btn ${orderType === 'LIMIT' ? 'active' : ''}`}
                onClick={() => setOrderType('LIMIT')}
              >
                LIMIT
              </button>
              <button 
                type="button"
                className={`type-btn ${orderType === 'MARKET' ? 'active' : ''}`}
                onClick={() => setOrderType('MARKET')}
              >
                MARKET
              </button>
              <button 
                type="button"
                className={`type-btn ${orderType === 'STOP_LOSS' ? 'active' : ''}`}
                onClick={() => setOrderType('STOP_LOSS')}
              >
                STOP-LOSS
              </button>
            </div>

            {/* Price Field */}
            {orderType !== 'MARKET' && (
              <div className="input-group">
                <label>Order Price</label>
                <div className="input-wrapper">
                  <input 
                    type="number" 
                    step="0.01" 
                    placeholder={marketStats.lastPrice ? marketStats.lastPrice.toFixed(2) : '0.00'} 
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                  <span className="suffix">USDT</span>
                </div>
              </div>
            )}

            {/* Trigger Price Field for Stop Loss */}
            {orderType === 'STOP_LOSS' && (
              <div className="input-group">
                <label>Stop Trigger Price</label>
                <div className="input-wrapper">
                  <input 
                    type="number" 
                    step="0.01" 
                    placeholder="Trigger Price..." 
                    value={triggerPrice}
                    onChange={(e) => setTriggerPrice(e.target.value)}
                  />
                  <span className="suffix">USDT</span>
                </div>
              </div>
            )}

            {/* Amount Field */}
            <div className="input-group">
              <label>Amount / Quantity</label>
              <div className="input-wrapper">
                <input 
                  type="number" 
                  step="0.0001" 
                  placeholder="0.0000" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <span className="suffix">{symbol.split('/')[0]}</span>
              </div>
            </div>

            {/* Quick Percentage Slider / Buttons */}
            <div className="pct-buttons">
              <button type="button" className="pct-btn" onClick={() => setAmountPct(25)}>25%</button>
              <button type="button" className="pct-btn" onClick={() => setAmountPct(50)}>50%</button>
              <button type="button" className="pct-btn" onClick={() => setAmountPct(75)}>75%</button>
              <button type="button" className="pct-btn" onClick={() => setAmountPct(100)}>100%</button>
            </div>

            {/* Est Order Value */}
            <div className="order-summary">
              <span>Order Value:</span>
              <span className="mono">
                ${((parseFloat(price) || marketStats.lastPrice || 0) * (parseFloat(amount) || 0)).toFixed(2)} USDT
              </span>
            </div>

            <button 
              type="submit" 
              className={`submit-order-btn ${orderSide.toLowerCase()}`}
            >
              {orderSide} {symbol.split('/')[0]} ({orderType})
            </button>
          </form>
        </section>
      </main>

      {/* Bottom Panel: Trade History, Open Orders, and Matching Engine Analytics */}
      <section className="panel-card bottom-panel">
        <div className="bottom-tabs">
          <button 
            className={`bottom-tab ${activeBottomTab === 'TRADES' ? 'active' : ''}`}
            onClick={() => setActiveBottomTab('TRADES')}
          >
            Trade Execution Ledger ({trades.length})
          </button>
          <button 
            className={`bottom-tab ${activeBottomTab === 'ORDERS' ? 'active' : ''}`}
            onClick={() => setActiveBottomTab('ORDERS')}
          >
            Active Open Orders ({openOrders.length})
          </button>
          <button 
            className={`bottom-tab ${activeBottomTab === 'ANALYTICS' ? 'active' : ''}`}
            onClick={() => setActiveBottomTab('ANALYTICS')}
          >
            Engine Depth & Liquidity Imbalance
          </button>
        </div>

        <div className="tab-content-area">
          {activeBottomTab === 'TRADES' && (
            <table className="trading-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Side</th>
                  <th>Price (USDT)</th>
                  <th>Executed Size</th>
                  <th>Trade ID</th>
                </tr>
              </thead>
              <tbody>
                {trades.length === 0 ? (
                  <tr><td colSpan="5" className="empty-state">No trades executed yet.</td></tr>
                ) : (
                  trades.map((t) => (
                    <tr key={t.id}>
                      <td className="mono color-muted">
                        {new Date(t.timestamp).toLocaleTimeString()}
                      </td>
                      <td>
                        <span className={`badge-side ${t.side.toLowerCase()}`}>{t.side}</span>
                      </td>
                      <td className={`mono ${t.side === 'BUY' ? 'up' : 'down'}`}>
                        ${t.price.toFixed(2)}
                      </td>
                      <td className="mono">{t.amount.toFixed(4)}</td>
                      <td className="mono color-muted">{t.id}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeBottomTab === 'ORDERS' && (
            <table className="trading-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Type</th>
                  <th>Side</th>
                  <th>Target / Trigger</th>
                  <th>Filled / Amount</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {openOrders.length === 0 ? (
                  <tr><td colSpan="7" className="empty-state">No active open orders.</td></tr>
                ) : (
                  openOrders.map((o) => (
                    <tr key={o.id}>
                      <td className="mono">{o.id}</td>
                      <td>{o.type}</td>
                      <td>
                        <span className={`badge-side ${o.side.toLowerCase()}`}>{o.side}</span>
                      </td>
                      <td className="mono">
                        {o.type === 'STOP_LOSS' ? `Trigger $${o.triggerPrice}` : `$${o.price.toFixed(2)}`}
                      </td>
                      <td className="mono">
                        {o.filled.toFixed(4)} / {o.amount.toFixed(4)}
                      </td>
                      <td>
                        <span className="status-badge" style={{ display: 'inline-flex' }}>{o.status}</span>
                      </td>
                      <td>
                        <button className="btn-cancel-ord" onClick={() => handleCancelOrder(o.id)}>
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}

          {activeBottomTab === 'ANALYTICS' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, padding: 10 }}>
              <div style={{ background: 'var(--bg-input)', padding: 12, borderRadius: 6, border: '1px solid var(--border-color)' }}>
                <span className="stat-label">Bids / Asks Liquidity Ratio</span>
                <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', margin: '8px 0' }}>
                  <div style={{ width: `${bidRatio}%`, background: 'var(--color-green)' }}></div>
                  <div style={{ width: `${askRatio}%`, background: 'var(--color-red)' }}></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }} className="mono">
                  <span className="up">Bids: {bidRatio}%</span>
                  <span className="down">Asks: {askRatio}%</span>
                </div>
              </div>

              <div style={{ background: 'var(--bg-input)', padding: 12, borderRadius: 6, border: '1px solid var(--border-color)' }}>
                <span className="stat-label">Total Bids Cumulative Volume</span>
                <div className="stat-value large up mono" style={{ marginTop: 4 }}>
                  {totalBidVol.toFixed(4)} {symbol.split('/')[0]}
                </div>
              </div>

              <div style={{ background: 'var(--bg-input)', padding: 12, borderRadius: 6, border: '1px solid var(--border-color)' }}>
                <span className="stat-label">Total Asks Cumulative Volume</span>
                <div className="stat-value large down mono" style={{ marginTop: 4 }}>
                  {totalAskVol.toFixed(4)} {symbol.split('/')[0]}
                </div>
              </div>

              <div style={{ background: 'var(--bg-input)', padding: 12, borderRadius: 6, border: '1px solid var(--border-color)' }}>
                <span className="stat-label">Matching Algorithm</span>
                <div className="stat-value mono" style={{ marginTop: 4, color: 'var(--color-accent)' }}>
                  Price-Time Priority (FIFO)
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

export default App;
