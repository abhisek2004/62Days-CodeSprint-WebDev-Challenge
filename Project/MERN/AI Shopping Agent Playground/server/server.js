const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Simulated MCP (Model Context Protocol) tool execution endpoint
app.post('/api/mcp/invoke', (req, res) => {
  const { tool_name, arguments: args } = req.body;
  const timestamp = new Date().toISOString();

  let toolResult = {};

  switch (tool_name) {
    case 'search_product':
      toolResult = {
        status: 'success',
        products: [
          { id: 'p_101', name: 'Ultra Noise-Cancelling Headphones', price: 199.99, stock: 14 },
          { id: 'p_102', name: 'Ergonomic Mechanical Keyboard', price: 129.50, stock: 8 }
        ]
      };
      break;

    case 'add_to_cart':
      toolResult = {
        status: 'success',
        cart_item_id: args.product_id,
        quantity: args.quantity || 1,
        cart_total: 199.99
      };
      break;

    case 'execute_checkout':
      toolResult = {
        status: 'completed',
        transaction_id: `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
        amount_paid: args.amount,
        shipping_address: args.address || 'Default User Address'
      };
      break;

    default:
      toolResult = { status: 'error', message: 'Unknown MCP Tool' };
  }

  res.json({
    mcp_protocol_version: '2024-11-05',
    timestamp,
    tool_name,
    input_payload: args,
    output_result: toolResult
  });
});

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
  console.log(`AI Shopping Agent Playground MCP Server running on port ${PORT}`);
});
