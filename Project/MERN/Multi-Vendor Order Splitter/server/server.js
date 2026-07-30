const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// In-Memory Order & Vendor Storage
let orders = [];

// Helper: Partition master order into vendor-specific sub-orders
function partitionOrder(masterOrder) {
  const { customer, items, globalDiscount = 0, taxRate = 0.08 } = masterOrder;

  // Group items by vendor_id
  const vendorGroups = {};
  items.forEach(item => {
    if (!vendorGroups[item.seller_id]) {
      vendorGroups[item.seller_id] = {
        seller_name: item.seller_name,
        items: [],
        subtotal: 0
      };
    }
    vendorGroups[item.seller_id].items.push(item);
    vendorGroups[item.seller_id].subtotal += item.price * item.quantity;
  });

  const masterSubtotal = Object.values(vendorGroups).reduce((acc, v) => acc + v.subtotal, 0);

  const subOrders = Object.keys(vendorGroups).map(seller_id => {
    const group = vendorGroups[seller_id];
    // Proportional discount allocation
    const proportion = masterSubtotal > 0 ? (group.subtotal / masterSubtotal) : 0;
    const allocatedDiscount = globalDiscount * proportion;
    const taxableSubtotal = Math.max(0, group.subtotal - allocatedDiscount);
    const allocatedTax = taxableSubtotal * taxRate;
    const shippingFee = 10.00; // Standard shipping per vendor
    const totalPayout = taxableSubtotal + allocatedTax + shippingFee;

    return {
      sub_order_id: `SUB-${seller_id.slice(0,4)}-${Math.floor(1000 + Math.random() * 9000)}`,
      seller_id,
      seller_name: group.seller_name,
      items: group.items,
      subtotal: group.subtotal,
      allocatedDiscount: parseFloat(allocatedDiscount.toFixed(2)),
      allocatedTax: parseFloat(allocatedTax.toFixed(2)),
      shippingFee,
      totalPayout: parseFloat(totalPayout.toFixed(2)),
      status: 'Processing',
      tracking_id: `TRK-${Math.floor(100000 + Math.random() * 900000)}`
    };
  });

  const newOrder = {
    parent_order_id: `ORD-${Date.now()}`,
    customer,
    createdAt: new Date().toISOString(),
    masterSubtotal,
    globalDiscount,
    subOrders
  };

  orders.push(newOrder);
  return newOrder;
}

// API Endpoints
app.post('/api/orders/split', (req, res) => {
  try {
    const partitioned = partitionOrder(req.body);
    res.status(201).json({ success: true, order: partitioned });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

app.get('/api/orders', (req, res) => {
  res.json({ success: true, orders });
});

app.patch('/api/orders/sub-order/status', (req, res) => {
  const { parent_order_id, sub_order_id, status } = req.body;
  const master = orders.find(o => o.parent_order_id === parent_order_id);
  if (!master) return res.status(404).json({ success: false, message: 'Order not found' });

  const sub = master.subOrders.find(s => s.sub_order_id === sub_order_id);
  if (sub) {
    sub.status = status;
    return res.json({ success: true, subOrder: sub });
  }
  res.status(404).json({ success: false, message: 'Sub order not found' });
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Multi-Vendor Order Splitter Server running on port ${PORT}`);
});
