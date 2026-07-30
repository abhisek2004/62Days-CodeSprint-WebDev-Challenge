const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

let rooms = {};

app.post('/api/consultation/create-room', (req, res) => {
  const { doctor_name, patient_name, specialization } = req.body;
  const roomId = `ROOM-DOC-${Math.floor(1000 + Math.random() * 9000)}`;

  rooms[roomId] = {
    roomId,
    doctor_name,
    patient_name,
    specialization,
    createdAt: new Date().toISOString(),
    prescriptions: [],
    status: 'Active'
  };

  res.status(201).json({ success: true, roomId, room: rooms[roomId] });
});

app.get('/api/consultation/:roomId', (req, res) => {
  const room = rooms[req.params.roomId];
  if (!room) return res.status(404).json({ success: false, message: 'Consultation Room Not Found' });
  res.json({ success: true, room });
});

app.post('/api/consultation/:roomId/prescription', (req, res) => {
  const { note } = req.body;
  const room = rooms[req.params.roomId];
  if (room) {
    room.prescriptions.push({ note, time: new Date().toLocaleTimeString() });
    return res.json({ success: true, prescriptions: room.prescriptions });
  }
  res.status(404).json({ success: false, message: 'Room not found' });
});

const PORT = process.env.PORT || 5004;
app.listen(PORT, () => {
  console.log(`WebRTC Doctor Consultation Signaling Server running on port ${PORT}`);
});
