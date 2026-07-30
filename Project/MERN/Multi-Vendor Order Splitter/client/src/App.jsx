import React, { useState } from 'react';

const mockCartItems = [
  { id: 'P1', name: 'Pro Camera Lens', price: 450, quantity: 1, seller_id: 'VEND-101', seller_name: 'TechApex Store' },
  { id: 'P2', name: 'Camera Strap', price: 25, quantity: 2, seller_id: 'VEND-101', seller_name: 'TechApex Store' },
  { id: 'P3', name: 'Leather Boots', price: 120, quantity: 1, seller_id: 'VEND-204', seller_name: 'Urban Crafts Co.' },
  { id: 'P4', name: 'Organic Coffee Beans', price: 18, quantity: 3, seller_id: 'VEND-309', seller_name: 'Artisan Roast House' }
];

export default function App() {
  const [cart, setCart] = useState(mockCartItems);
  const [globalDiscount, setGlobalDiscount] = useState(30);
  const [orders, setOrders] = useState([]);
  const [activeTab, setActiveTab] = useState('checkout'); // 'checkout' | 'orders'

  const handleCheckout = () => {
    const masterSubtotal = cart.reduce((acc, i) => acc + i.price * i.quantity, 0);

    // Group items by vendor_id locally or call endpoint
    const vendorGroups = {};
    cart.forEach(item => {
      if (!vendorGroups[item.seller_id]) {
        vendorGroups[item.seller_id] = { seller_name: item.seller_name, items: [], subtotal: 0 };
      }
      vendorGroups[item.seller_id].items.push(item);
      vendorGroups[item.seller_id].subtotal += item.price * item.quantity;
    });

    const subOrders = Object.keys(vendorGroups).map(seller_id => {
      const g = vendorGroups[seller_id];
      const prop = g.subtotal / masterSubtotal;
      const disc = globalDiscount * prop;
      const tax = (g.subtotal - disc) * 0.08;
      const ship = 10;
      return {
        sub_order_id: `SUB-${seller_id.slice(-3)}-${Math.floor(1000 + Math.random() * 9000)}`,
        seller_id,
        seller_name: g.seller_name,
        items: g.items,
        subtotal: g.subtotal,
        allocatedDiscount: disc.toFixed(2),
        allocatedTax: tax.toFixed(2),
        shippingFee: ship,
        totalPayout: (g.subtotal - disc + tax + ship).toFixed(2),
        status: 'Processing',
        tracking_id: `TRK-${Math.floor(100000 + Math.random() * 900000)}`
      };
    });

    const newMasterOrder = {
      parent_order_id: `ORD-${Date.now()}`,
      createdAt: new Date().toLocaleTimeString(),
      masterSubtotal,
      globalDiscount,
      subOrders
    };

    setOrders([newMasterOrder, ...orders]);
    setActiveTab('orders');
  };

  return (
    <div style={{ fontFamily: 'Segoe UI, sans-serif', padding: '24px', background: '#0f172a', color: '#f8fafc', minHeight: '100vh' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #334155', pb: '16px', marginBottom: '24px' }}>
        <h2 style={{ color: '#38bdf8', margin: 0 }}>📦 Multi-Vendor Order Partitioning & Split Engine</h2>
        <div>
          <button
            onClick={() => setActiveTab('checkout')}
            style={{ background: activeTab === 'checkout' ? '#38bdf8' : '#1e293b', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', marginRight: '8px' }}
          >
            Customer Cart
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            style={{ background: activeTab === 'orders' ? '#38bdf8' : '#1e293b', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
          >
            Vendor Sub-Orders ({orders.length})
          </button>
        </div>
      </header>

      {activeTab === 'checkout' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px' }}>
          <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155' }}>
            <h3>Parent Order Items (Multi-Vendor Basket)</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '12px' }}>
              <thead>
                <tr style={{ color: '#94a3b8', borderBottom: '1px solid #334155', textAlign: 'left' }}>
                  <th style={{ padding: '8px' }}>Item</th>
                  <th>Vendor / Seller</th>
                  <th>Price</th>
                  <th>Qty</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {cart.map(item => (
                  <tr key={item.id} style={{ borderBottom: '1px solid #334155' }}>
                    <td style={{ padding: '10px 8px' }}>{item.name}</td>
                    <td><span style={{ background: '#0f172a', padding: '2px 8px', borderRadius: '4px', fontSize: '0.85rem' }}>{item.seller_name}</span></td>
                    <td>${item.price}</td>
                    <td>{item.quantity}</td>
                    <td>${item.price * item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ background: '#1e293b', padding: '20px', borderRadius: '12px', border: '1px solid #334155' }}>
            <h3>Order Splitting Config</h3>
            <div style={{ margin: '16px 0' }}>
              <label style={{ display: 'block', fontSize: '0.9rem', color: '#94a3b8', marginBottom: '4px' }}>Global Coupon Discount ($):</label>
              <input
                type="number"
                value={globalDiscount}
                onChange={e => setGlobalDiscount(Number(e.target.value))}
                style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}
              />
            </div>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
              Discount & taxes will be proportionally split across 3 vendors based on line-item weight.
            </p>
            <button
              onClick={handleCheckout}
              style={{ width: '100%', background: '#10b981', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', marginTop: '16px' }}
            >
              Simulate Order Partitioning
            </button>
          </div>
        </div>
      ) : (
        <div>
          {orders.length === 0 ? (
            <p>No orders partitioned yet. Click Customer Cart to place an order.</p>
          ) : (
            orders.map(master => (
              <div key={master.parent_order_id} style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #334155', pb: '12px', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ margin: 0, color: '#38bdf8' }}>Master Order: {master.parent_order_id}</h3>
                    <small style={{ color: '#94a3b8' }}>Placed at: {master.createdAt}</small>
                  </div>
                  <div>
                    <strong>Total Basket: ${master.masterSubtotal}</strong> | Coupon Applied: -${master.globalDiscount}
                  </div>
                </div>

                <h4>Partitioned Vendor Sub-Orders ({master.subOrders.length}):</h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginTop: '12px' }}>
                  {master.subOrders.map(sub => (
                    <div key={sub.sub_order_id} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '14px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 'bold', color: '#10b981' }}>{sub.seller_name}</span>
                        <span style={{ fontSize: '0.8rem', background: '#334155', padding: '2px 6px', borderRadius: '4px' }}>{sub.status}</span>
                      </div>
                      <small style={{ color: '#94a3b8', display: 'block', margin: '4px 0' }}>ID: {sub.sub_order_id}</small>
                      <small style={{ color: '#94a3b8', display: 'block' }}>Tracking: {sub.tracking_id}</small>
                      <hr style={{ borderColor: '#334155', margin: '10px 0' }} />
                      <div style={{ fontSize: '0.85rem' }}>
                        <div>Subtotal: ${sub.subtotal}</div>
                        <div style={{ color: '#f97316' }}>Allocated Discount: -${sub.allocatedDiscount}</div>
                        <div>Allocated Tax: +${sub.allocatedTax}</div>
                        <div>Vendor Shipping: +${sub.shippingFee}</div>
                        <strong style={{ display: 'block', marginTop: '6px', fontSize: '1rem', color: '#38bdf8' }}>
                          Vendor Payout: ${sub.totalPayout}
                        </strong>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
