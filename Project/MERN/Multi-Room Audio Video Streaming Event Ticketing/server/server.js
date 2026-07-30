const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let events = [
  {
    id: 'evt_101',
    title: 'Global Tech & AI Summit 2026',
    date: 'August 15, 2026',
    ticketPrice: 49.00,
    rooms: [
      { id: 'room-1', name: 'Stage Alpha: Keynote & AI Architectures', speaker: 'Dr. Sarah Vance', streamUrl: 'https://www.youtube.com/embed/live_stream?channel=tech' },
      { id: 'room-2', name: 'Stage Beta: Web3 & Distributed Systems', speaker: 'Alex Rivers', streamUrl: 'https://www.youtube.com/embed/live_stream?channel=dev' },
      { id: 'room-3', name: 'Stage Gamma: Cyber Security Workshops', speaker: 'Elena Rostova', streamUrl: 'https://www.youtube.com/embed/live_stream?channel=sec' }
    ]
  }
];

let tickets = [];

app.get('/api/events', (req, res) => {
  res.json({ success: true, events });
});

app.post('/api/tickets/purchase', (req, res) => {
  const { event_id, attendee_name, email } = req.body;
  const ticket = {
    ticket_id: `TCK-${Math.floor(100000 + Math.random() * 900000)}`,
    event_id,
    attendee_name,
    email,
    qr_code_data: `VERIFIED-PASS-${Date.now()}`,
    purchasedAt: new Date().toISOString()
  };
  tickets.push(ticket);
  res.status(201).json({ success: true, ticket });
});

const PORT = process.env.PORT || 5003;
app.listen(PORT, () => {
  console.log(`Event Ticketing & Multi-Room Streaming Server running on port ${PORT}`);
});
