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

// --- State Management ---
const SUPPORTED_SYMBOLS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'NVDA/USD'];

// Data storage by symbol
const orderBooks = {};
const tradeHistories = {};
const candlestickHistories = {};
const openOrdersMap = {}; // orderId -> order
const stopOrdersMap = {}; // symbol -> Array of stop orders
const marketStatsMap = {};

let botEnabled = true;
let botInterval = null;

// Initialize Symbol Data
function initSymbolData(symbol, basePrice) {
  orderBooks[symbol] = { bids: [], asks: [] };
  tradeHistories[symbol] = [];
  stopOrdersMap[symbol] = [];
  openOrdersMap[symbol] = new Map();

  marketStatsMap[symbol] = {
    symbol,
    lastPrice: basePrice,
    open24h: basePrice * 0.985,
    high24h: basePrice * 1.025,
    low24h: basePrice * 0.975,
    volume24h: 0,
    tradeCount: 0,
    priceChange: 0,
    priceChangePercent: 0
  };

  // Generate 60 historical candles (1-minute intervals simulated)
  const candles = [];
  let currentPrice = basePrice * 0.98;
  const now = Date.now();
  const timeframeMs = 5000; // 5-second candles for live feel

  for (let i = 60; i >= 0; i--) {
    const candleTime = now - i * timeframeMs;
    const volatility = basePrice * 0.003;
    const open = currentPrice;
    const close = open + (Math.random() - 0.49) * volatility;
    const high = Math.max(open, close) + Math.random() * (volatility * 0.5);
    const low = Math.min(open, close) - Math.random() * (volatility * 0.5);
    const volume = Math.random() * 2.5 + 0.1;

    candles.push({
      timestamp: candleTime,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume: parseFloat(volume.toFixed(4))
    });
    currentPrice = close;
  }
  candlestickHistories[symbol] = candles;
  marketStatsMap[symbol].lastPrice = parseFloat(currentPrice.toFixed(2));
  updateMarketStats(symbol);

  // Seed initial order book liquidity around base price
  seedLiquidity(symbol, marketStatsMap[symbol].lastPrice);
}

// Seed initial realistic order book depth
function seedLiquidity(symbol, centerPrice) {
  const bids = [];
  const asks = [];

  for (let i = 1; i <= 15; i++) {
    // Bids lower than centerPrice
    const bidPrice = parseFloat((centerPrice - i * (centerPrice * 0.0008)).toFixed(2));
    const bidAmount = parseFloat((Math.random() * 1.8 + 0.1).toFixed(4));
    bids.push({
      id: `seed-bid-${i}-${Date.now()}`,
      symbol,
      side: 'BUY',
      type: 'LIMIT',
      price: bidPrice,
      amount: bidAmount,
      filled: 0,
      remaining: bidAmount,
      status: 'OPEN',
      timestamp: Date.now() - i * 100,
      userId: 'SYSTEM_BOT'
    });

    // Asks higher than centerPrice
    const askPrice = parseFloat((centerPrice + i * (centerPrice * 0.0008)).toFixed(2));
    const askAmount = parseFloat((Math.random() * 1.8 + 0.1).toFixed(4));
    asks.push({
      id: `seed-ask-${i}-${Date.now()}`,
      symbol,
      side: 'SELL',
      type: 'LIMIT',
      price: askPrice,
      amount: askAmount,
      filled: 0,
      remaining: askAmount,
      status: 'OPEN',
      timestamp: Date.now() - i * 100,
      userId: 'SYSTEM_BOT'
    });
  }

  // Bids sorted DESCENDING by price
  orderBooks[symbol].bids = bids.sort((a, b) => b.price - a.price || a.timestamp - b.timestamp);
  // Asks sorted ASCENDING by price
  orderBooks[symbol].asks = asks.sort((a, b) => a.price - b.price || a.timestamp - b.timestamp);
}

// Initializing Symbols
const BASE_PRICES = {
  'BTC/USDT': 64250.00,
  'ETH/USDT': 3450.00,
  'SOL/USDT': 185.50,
  'NVDA/USD': 122.40
};

SUPPORTED_SYMBOLS.forEach(sym => {
  initSymbolData(sym, BASE_PRICES[sym]);
});

// Update 24h stats based on last price and trades
function updateMarketStats(symbol) {
  const stats = marketStatsMap[symbol];
  const change = stats.lastPrice - stats.open24h;
  const changePct = (change / stats.open24h) * 100;

  stats.priceChange = parseFloat(change.toFixed(2));
  stats.priceChangePercent = parseFloat(changePct.toFixed(2));
  stats.high24h = Math.max(stats.high24h, stats.lastPrice);
  stats.low24h = Math.min(stats.low24h, stats.lastPrice);
}

// Candlestick live bar update
function recordTradeInCandles(symbol, price, amount, timestamp) {
  const candles = candlestickHistories[symbol];
  if (!candles || candles.length === 0) return;

  const timeframeMs = 5000;
  const lastCandle = candles[candles.length - 1];

  if (timestamp - lastCandle.timestamp < timeframeMs) {
    // Update existing active candle
    lastCandle.high = Math.max(lastCandle.high, price);
    lastCandle.low = Math.min(lastCandle.low, price);
    lastCandle.close = price;
    lastCandle.volume = parseFloat((lastCandle.volume + amount).toFixed(4));
  } else {
    // Push new candle bar
    const newCandle = {
      timestamp: Math.floor(timestamp / timeframeMs) * timeframeMs,
      open: lastCandle.close,
      high: Math.max(lastCandle.close, price),
      low: Math.min(lastCandle.close, price),
      close: price,
      volume: parseFloat(amount.toFixed(4))
    };
    candles.push(newCandle);
    if (candles.length > 100) candles.shift();
  }
}

// --- Order Matching Engine (Price-Time Priority FIFO) ---
function processOrder(newOrder) {
  const { symbol, side, type, price, amount, userId } = newOrder;
  const book = orderBooks[symbol];
  const trades = tradeHistories[symbol];

  const order = {
    id: newOrder.id || `ord-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    symbol,
    side,
    type,
    price: price ? parseFloat(price) : null,
    triggerPrice: newOrder.triggerPrice ? parseFloat(newOrder.triggerPrice) : null,
    amount: parseFloat(amount),
    filled: 0,
    remaining: parseFloat(amount),
    status: 'OPEN',
    timestamp: Date.now(),
    userId: userId || 'USER'
  };

  const executedTrades = [];

  // Handle Stop-Loss Orders (Pending trigger)
  if (type === 'STOP_LOSS') {
    const currentPrice = marketStatsMap[symbol].lastPrice;
    const isTriggered = (side === 'SELL' && currentPrice <= order.triggerPrice) ||
                        (side === 'BUY' && currentPrice >= order.triggerPrice);

    if (!isTriggered) {
      stopOrdersMap[symbol].push(order);
      openOrdersMap[symbol].set(order.id, order);
      broadcastUpdates(symbol);
      return { order, trades: [] };
    }
    // If triggered right away, convert to Market Order
    order.type = 'MARKET';
  }

  // --- Matching Engine Logic ---
  if (side === 'BUY') {
    // Match against ASKS (lowest sell prices first)
    while (book.asks.length > 0 && order.remaining > 0) {
      const bestAsk = book.asks[0];

      // Limit condition check
      if (order.type === 'LIMIT' && bestAsk.price > order.price) {
        break;
      }

      // Match execution
      const fillAmount = Math.min(order.remaining, bestAsk.remaining);
      const matchPrice = bestAsk.price;

      order.filled = parseFloat((order.filled + fillAmount).toFixed(4));
      order.remaining = parseFloat((order.remaining - fillAmount).toFixed(4));

      bestAsk.filled = parseFloat((bestAsk.filled + fillAmount).toFixed(4));
      bestAsk.remaining = parseFloat((bestAsk.remaining - fillAmount).toFixed(4));

      const trade = {
        id: `trd-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        symbol,
        price: matchPrice,
        amount: fillAmount,
        side: 'BUY',
        buyOrderId: order.id,
        sellOrderId: bestAsk.id,
        timestamp: Date.now()
      };

      executedTrades.push(trade);
      trades.unshift(trade);
      if (trades.length > 150) trades.pop();

      // Update Market Stats & Candles
      marketStatsMap[symbol].lastPrice = matchPrice;
      marketStatsMap[symbol].volume24h = parseFloat((marketStatsMap[symbol].volume24h + fillAmount).toFixed(4));
      marketStatsMap[symbol].tradeCount++;
      updateMarketStats(symbol);
      recordTradeInCandles(symbol, matchPrice, fillAmount, trade.timestamp);

      // Clean up ask if completely filled
      if (bestAsk.remaining <= 0) {
        bestAsk.status = 'FILLED';
        openOrdersMap[symbol].delete(bestAsk.id);
        book.asks.shift();
      } else {
        bestAsk.status = 'PARTIAL';
      }
    }

    if (order.remaining > 0) {
      if (order.type === 'LIMIT') {
        order.status = order.filled > 0 ? 'PARTIAL' : 'OPEN';
        book.bids.push(order);
        book.bids.sort((a, b) => b.price - a.price || a.timestamp - b.timestamp);
        openOrdersMap[symbol].set(order.id, order);
      } else {
        // Market order with remaining unfulfilled liquidity cancelled
        order.status = order.filled > 0 ? 'FILLED' : 'CANCELLED';
      }
    } else {
      order.status = 'FILLED';
    }

  } else if (side === 'SELL') {
    // Match against BIDS (highest buy prices first)
    while (book.bids.length > 0 && order.remaining > 0) {
      const bestBid = book.bids[0];

      // Limit condition check
      if (order.type === 'LIMIT' && bestBid.price < order.price) {
        break;
      }

      // Match execution
      const fillAmount = Math.min(order.remaining, bestBid.remaining);
      const matchPrice = bestBid.price;

      order.filled = parseFloat((order.filled + fillAmount).toFixed(4));
      order.remaining = parseFloat((order.remaining - fillAmount).toFixed(4));

      bestBid.filled = parseFloat((bestBid.filled + fillAmount).toFixed(4));
      bestBid.remaining = parseFloat((bestBid.remaining - fillAmount).toFixed(4));

      const trade = {
        id: `trd-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        symbol,
        price: matchPrice,
        amount: fillAmount,
        side: 'SELL',
        buyOrderId: bestBid.id,
        sellOrderId: order.id,
        timestamp: Date.now()
      };

      executedTrades.push(trade);
      trades.unshift(trade);
      if (trades.length > 150) trades.pop();

      // Update Market Stats & Candles
      marketStatsMap[symbol].lastPrice = matchPrice;
      marketStatsMap[symbol].volume24h = parseFloat((marketStatsMap[symbol].volume24h + fillAmount).toFixed(4));
      marketStatsMap[symbol].tradeCount++;
      updateMarketStats(symbol);
      recordTradeInCandles(symbol, matchPrice, fillAmount, trade.timestamp);

      // Clean up bid if completely filled
      if (bestBid.remaining <= 0) {
        bestBid.status = 'FILLED';
        openOrdersMap[symbol].delete(bestBid.id);
        book.bids.shift();
      } else {
        bestBid.status = 'PARTIAL';
      }
    }

    if (order.remaining > 0) {
      if (order.type === 'LIMIT') {
        order.status = order.filled > 0 ? 'PARTIAL' : 'OPEN';
        book.asks.push(order);
        book.asks.sort((a, b) => a.price - b.price || a.timestamp - b.timestamp);
        openOrdersMap[symbol].set(order.id, order);
      } else {
        // Market order with remaining unfulfilled liquidity cancelled
        order.status = order.filled > 0 ? 'FILLED' : 'CANCELLED';
      }
    } else {
      order.status = 'FILLED';
    }
  }

  // Check Stop-Loss Orders after execution
  if (executedTrades.length > 0) {
    checkStopLossOrders(symbol);
  }

  broadcastUpdates(symbol);
  return { order, trades: executedTrades };
}

// Trigger pending stop loss orders if market price crossed trigger
function checkStopLossOrders(symbol) {
  const currentPrice = marketStatsMap[symbol].lastPrice;
  const stopOrders = stopOrdersMap[symbol];
  const remainingStopOrders = [];

  for (const stopOrder of stopOrders) {
    const isTriggered = (stopOrder.side === 'SELL' && currentPrice <= stopOrder.triggerPrice) ||
                        (stopOrder.side === 'BUY' && currentPrice >= stopOrder.triggerPrice);

    if (isTriggered) {
      openOrdersMap[symbol].delete(stopOrder.id);
      // Convert to Market Order and execute
      processOrder({
        ...stopOrder,
        type: 'MARKET',
        price: null
      });
    } else {
      remainingStopOrders.push(stopOrder);
    }
  }

  stopOrdersMap[symbol] = remainingStopOrders;
}

// Cancel an order
function cancelOrder(symbol, orderId) {
  const book = orderBooks[symbol];
  let found = false;

  // Search bids
  const bidIdx = book.bids.findIndex(o => o.id === orderId);
  if (bidIdx !== -1) {
    book.bids.splice(bidIdx, 1);
    found = true;
  }

  // Search asks
  if (!found) {
    const askIdx = book.asks.findIndex(o => o.id === orderId);
    if (askIdx !== -1) {
      book.asks.splice(askIdx, 1);
      found = true;
    }
  }

  // Search stop orders
  if (!found) {
    const stopIdx = stopOrdersMap[symbol].findIndex(o => o.id === orderId);
    if (stopIdx !== -1) {
      stopOrdersMap[symbol].splice(stopIdx, 1);
      found = true;
    }
  }

  if (found) {
    openOrdersMap[symbol].delete(orderId);
    broadcastUpdates(symbol);
  }

  return found;
}

// Depth aggregation helper
function getAggregatedDepth(symbol) {
  const book = orderBooks[symbol];

  // Aggregate Bids
  const bidMap = new Map();
  book.bids.forEach(b => {
    const p = parseFloat(b.price.toFixed(2));
    bidMap.set(p, (bidMap.get(p) || 0) + b.remaining);
  });

  const sortedBidPrices = Array.from(bidMap.keys()).sort((a, b) => b - a).slice(0, 15);
  let cumBidVol = 0;
  const bids = sortedBidPrices.map(price => {
    const amount = parseFloat(bidMap.get(price).toFixed(4));
    cumBidVol += amount;
    return { price, amount, total: parseFloat(cumBidVol.toFixed(4)) };
  });

  // Aggregate Asks
  const askMap = new Map();
  book.asks.forEach(a => {
    const p = parseFloat(a.price.toFixed(2));
    askMap.set(p, (askMap.get(p) || 0) + a.remaining);
  });

  const sortedAskPrices = Array.from(askMap.keys()).sort((a, b) => a - b).slice(0, 15);
  let cumAskVol = 0;
  const asks = sortedAskPrices.map(price => {
    const amount = parseFloat(askMap.get(price).toFixed(4));
    cumAskVol += amount;
    return { price, amount, total: parseFloat(cumAskVol.toFixed(4)) };
  });

  // Calculate total volume for depth bar width percentage
  const maxBidTotal = bids.length > 0 ? bids[bids.length - 1].total : 1;
  const maxAskTotal = asks.length > 0 ? asks[asks.length - 1].total : 1;
  const maxTotal = Math.max(maxBidTotal, maxAskTotal, 0.001);

  bids.forEach(b => b.depthPct = Math.min(100, Math.round((b.total / maxTotal) * 100)));
  asks.forEach(a => a.depthPct = Math.min(100, Math.round((a.total / maxTotal) * 100)));

  const bestBid = bids.length > 0 ? bids[0].price : 0;
  const bestAsk = asks.length > 0 ? asks[0].price : 0;
  const spread = bestAsk && bestBid ? parseFloat((bestAsk - bestBid).toFixed(2)) : 0;
  const spreadPct = bestAsk ? parseFloat(((spread / bestAsk) * 100).toFixed(4)) : 0;

  return { bids, asks, bestBid, bestAsk, spread, spreadPct };
}

// Broadcast real-time updates over WebSocket
function broadcastUpdates(symbol) {
  const depth = getAggregatedDepth(symbol);
  const stats = marketStatsMap[symbol];
  const candles = candlestickHistories[symbol];
  const trades = tradeHistories[symbol].slice(0, 50);
  const openOrders = Array.from(openOrdersMap[symbol].values()).filter(o => o.status === 'OPEN' || o.status === 'PARTIAL');

  io.to(symbol).emit('orderBookUpdate', depth);
  io.to(symbol).emit('marketStatsUpdate', stats);
  io.to(symbol).emit('candlestickUpdate', candles);
  io.to(symbol).emit('tradesUpdate', trades);
  io.to(symbol).emit('openOrdersUpdate', openOrders);
}

// --- Automated Market Maker Bot ---
function runBotTick() {
  if (!botEnabled) return;

  SUPPORTED_SYMBOLS.forEach(symbol => {
    const stats = marketStatsMap[symbol];
    const curPrice = stats.lastPrice;
    const actionProb = Math.random();

    // 1. Maintain liquidity depth
    const depth = getAggregatedDepth(symbol);
    if (depth.bids.length < 8 || depth.asks.length < 8) {
      seedLiquidity(symbol, curPrice);
    }

    // 2. Random Market / Limit Order injection
    if (actionProb > 0.35) {
      const isBuy = Math.random() > 0.5;
      const side = isBuy ? 'BUY' : 'SELL';

      if (actionProb > 0.82) {
        // Trigger small Market Order
        const amount = parseFloat((Math.random() * 0.4 + 0.05).toFixed(4));
        processOrder({
          symbol,
          side,
          type: 'MARKET',
          amount,
          userId: 'INSTITUTIONAL_BOT'
        });
      } else {
        // Create Limit order close to spread
        const offset = (Math.random() * 0.0015 + 0.0001) * curPrice;
        const targetPrice = isBuy
          ? parseFloat((curPrice - offset).toFixed(2))
          : parseFloat((curPrice + offset).toFixed(2));
        const amount = parseFloat((Math.random() * 0.9 + 0.1).toFixed(4));

        processOrder({
          symbol,
          side,
          type: 'LIMIT',
          price: targetPrice,
          amount,
          userId: 'MARKET_MAKER_BOT'
        });
      }
    }
  });
}

// Start Market Maker Bot loop (ticks every 1.8 seconds)
botInterval = setInterval(runBotTick, 1800);

// --- REST Endpoints ---
app.get('/api/symbols', (req, res) => {
  res.json({ symbols: SUPPORTED_SYMBOLS });
});

app.get('/api/orderbook', (req, res) => {
  const symbol = req.query.symbol || 'BTC/USDT';
  res.json(getAggregatedDepth(symbol));
});

app.get('/api/trades', (req, res) => {
  const symbol = req.query.symbol || 'BTC/USDT';
  res.json(tradeHistories[symbol] || []);
});

app.get('/api/stats', (req, res) => {
  const symbol = req.query.symbol || 'BTC/USDT';
  res.json(marketStatsMap[symbol] || {});
});

app.get('/api/candles', (req, res) => {
  const symbol = req.query.symbol || 'BTC/USDT';
  res.json(candlestickHistories[symbol] || []);
});

app.post('/api/order', (req, res) => {
  const { symbol, side, type, price, triggerPrice, amount, userId } = req.body;
  if (!symbol || !side || !type || !amount) {
    return res.status(400).json({ error: 'Missing required order parameters.' });
  }

  const result = processOrder({ symbol, side, type, price, triggerPrice, amount, userId });
  res.json(result);
});

app.delete('/api/order/:symbol/:id', (req, res) => {
  const { symbol, id } = req.params;
  const success = cancelOrder(symbol, id);
  res.json({ success, id });
});

app.post('/api/reset', (req, res) => {
  const symbol = req.body.symbol || 'BTC/USDT';
  const basePrice = BASE_PRICES[symbol] || 50000;
  initSymbolData(symbol, basePrice);
  broadcastUpdates(symbol);
  res.json({ message: `Order book for ${symbol} reset successfully.` });
});

// --- Socket.io Real-time Handlers ---
io.on('connection', (socket) => {
  let activeSymbol = 'BTC/USDT';
  socket.join(activeSymbol);

  // Send initial state on connection
  socket.emit('orderBookUpdate', getAggregatedDepth(activeSymbol));
  socket.emit('marketStatsUpdate', marketStatsMap[activeSymbol]);
  socket.emit('candlestickUpdate', candlestickHistories[activeSymbol]);
  socket.emit('tradesUpdate', tradeHistories[activeSymbol].slice(0, 50));
  socket.emit('openOrdersUpdate', Array.from(openOrdersMap[activeSymbol].values()).filter(o => o.status === 'OPEN' || o.status === 'PARTIAL'));
  socket.emit('botStatus', { botEnabled });

  // Handle symbol change
  socket.on('changeSymbol', (newSymbol) => {
    if (SUPPORTED_SYMBOLS.includes(newSymbol)) {
      socket.leave(activeSymbol);
      activeSymbol = newSymbol;
      socket.join(activeSymbol);

      socket.emit('orderBookUpdate', getAggregatedDepth(activeSymbol));
      socket.emit('marketStatsUpdate', marketStatsMap[activeSymbol]);
      socket.emit('candlestickUpdate', candlestickHistories[activeSymbol]);
      socket.emit('tradesUpdate', tradeHistories[activeSymbol].slice(0, 50));
      socket.emit('openOrdersUpdate', Array.from(openOrdersMap[activeSymbol].values()).filter(o => o.status === 'OPEN' || o.status === 'PARTIAL'));
    }
  });

  // Handle client order submission
  socket.on('submitOrder', (orderData) => {
    try {
      const result = processOrder(orderData);
      socket.emit('orderFeedback', {
        success: true,
        order: result.order,
        tradesCount: result.trades.length,
        message: result.trades.length > 0
          ? `Order executed! ${result.trades.length} trade(s) filled.`
          : `Order placed on order book successfully.`
      });
    } catch (err) {
      socket.emit('orderFeedback', { success: false, error: err.message });
    }
  });

  // Handle order cancellation
  socket.on('cancelOrder', ({ symbol, orderId }) => {
    const success = cancelOrder(symbol, orderId);
    socket.emit('cancelFeedback', { success, orderId });
  });

  // Handle Liquidity Bot Toggle
  socket.on('toggleBot', (state) => {
    botEnabled = typeof state === 'boolean' ? state : !botEnabled;
    io.emit('botStatus', { botEnabled });
  });

  // Reset liquidity
  socket.on('resetLiquidity', (symbol) => {
    const targetSymbol = symbol || activeSymbol;
    const basePrice = BASE_PRICES[targetSymbol] || 50000;
    initSymbolData(targetSymbol, basePrice);
    broadcastUpdates(targetSymbol);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Financial Order Book Matching Engine Server running on http://localhost:${PORT}`);
});
