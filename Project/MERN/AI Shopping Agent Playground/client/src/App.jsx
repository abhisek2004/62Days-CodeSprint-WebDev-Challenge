import React, { useState } from 'react';

export default function App() {
  const [messages, setMessages] = useState([
    { sender: 'assistant', text: 'Hello! I am your AI Shopping Agent. How can I assist your order today?' }
  ]);
  const [input, setInput] = useState('');
  const [toolCallLogs, setToolCallLogs] = useState([]);
  const [cart, setCart] = useState([]);
  const [isPaused, setIsPaused] = useState(false);

  const simulateAgentStream = (userQuery) => {
    if (isPaused) return;

    // Append user message
    const userMsg = { sender: 'user', text: userQuery };
    setMessages(prev => [...prev, userMsg]);

    setTimeout(() => {
      // 1. Agent invokes search_product
      const toolCall1 = {
        mcp_version: '2024-11-05',
        timestamp: new Date().toLocaleTimeString(),
        tool_name: 'search_product',
        input: { query: userQuery, limit: 2 },
        output: {
          status: 'success',
          products: [
            { id: 'p_101', name: 'Ultra Noise-Cancelling Headphones', price: 199.99 }
          ]
        }
      };

      setToolCallLogs(prev => [toolCall1, ...prev]);

      setMessages(prev => [
        ...prev,
        { sender: 'assistant', text: 'I searched the inventory for headphones and found: "Ultra Noise-Cancelling Headphones" ($199.99). Should I add it to your cart?' }
      ]);

      // 2. Automated Add To Cart Tool Call
      setTimeout(() => {
        const toolCall2 = {
          mcp_version: '2024-11-05',
          timestamp: new Date().toLocaleTimeString(),
          tool_name: 'add_to_cart',
          input: { product_id: 'p_101', quantity: 1 },
          output: { status: 'success', cart_item_id: 'p_101', total: 199.99 }
        };

        setToolCallLogs(prev => [toolCall2, ...prev]);
        setCart([{ id: 'p_101', name: 'Ultra Noise-Cancelling Headphones', price: 199.99 }]);

        setMessages(prev => [
          ...prev,
          { sender: 'assistant', text: 'Tool `add_to_cart` executed! Added item to your shopping cart.' }
        ]);
      }, 1500);

    }, 1000);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    simulateAgentStream(input);
    setInput('');
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '24px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155', pb: '16px', marginBottom: '24px' }}>
        <h2 style={{ color: '#8b5cf6', margin: 0 }}>🤖 AI Shopping Agent Playground & MCP Tool Inspector</h2>
        <div>
          <button
            onClick={() => setIsPaused(!isPaused)}
            style={{ background: isPaused ? '#ef4444' : '#10b981', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
          >
            {isPaused ? '▶ Resume Execution' : '⏸ Pause Agent Execution'}
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <!-- Chat UI -->
        <div style={{ background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', padding: '16px', display: 'flex', flexDirection: 'column', height: '600px' }}>
          <h3>AI Chat Interface</h3>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '8px' }}>
            {messages.map((m, idx) => (
              <div key={idx} style={{ alignSelf: m.sender === 'user' ? 'flex-end' : 'flex-start', background: m.sender === 'user' ? '#8b5cf6' : '#334155', padding: '10px 14px', borderRadius: '12px', maxWidth: '80%' }}>
                {m.text}
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <input
              type="text"
              placeholder="e.g. Find me noise-cancelling headphones..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              style={{ flex: 1, background: '#0f172a', border: '1px solid #334155', color: '#fff', padding: '12px', borderRadius: '8px' }}
            />
            <button onClick={handleSend} style={{ background: '#8b5cf6', color: '#fff', border: 'none', padding: '0 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Send</button>
          </div>
        </div>

        <!-- MCP Tool Call Inspector Panel -->
        <div style={{ background: '#1e293b', borderRadius: '12px', border: '1px solid #334155', padding: '16px', display: 'flex', flexDirection: 'column', height: '600px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>🔍 MCP Tool Call Inspector (JSON Stream)</h3>
            <span style={{ fontSize: '0.8rem', background: '#334155', padding: '2px 8px', borderRadius: '4px' }}>Protocol v2024-11-05</span>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', marginTop: '12px' }}>
            {toolCallLogs.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>No MCP tool invocations captured yet. Send a message to inspect JSON payloads.</p>
            ) : (
              toolCallLogs.map((log, i) => (
                <div key={i} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: '8px', padding: '12px', marginBottom: '12px', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#38bdf8' }}>
                    <strong>Tool: {log.tool_name}</strong>
                    <span>{log.timestamp}</span>
                  </div>
                  <pre style={{ background: '#090d16', padding: '8px', borderRadius: '4px', overflowX: 'auto', color: '#10b981', margin: '8px 0 0' }}>
                    {JSON.stringify(log, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
