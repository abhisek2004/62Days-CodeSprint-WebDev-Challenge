const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let roomParticipants = [
  { id: "p1", name: "Dr. Sarah Jenkins", role: "Host", quality: "720p", bitrateKbps: 1800, activeSpeaker: true },
  { id: "p2", name: "Alex Johnson", role: "Patient", quality: "720p", bitrateKbps: 1500, activeSpeaker: false },
  { id: "p3", name: "Dr. Michael Chen", role: "Specialist", quality: "360p", bitrateKbps: 600, activeSpeaker: false },
  { id: "p4", name: "Elena Rostova", role: "Resident", quality: "180p", bitrateKbps: 250, activeSpeaker: false }
];

app.get("/api/sfu/participants", (req, res) => {
  const count = roomParticipants.length;
  const meshUplinkBandwidth = count * (count - 1) * 1.5; // Mbps
  const sfuUplinkBandwidth = count * 1.5 + (count - 1) * 0.8; // Mbps
  const bandwidthSavedPercentage = Math.round(((meshUplinkBandwidth - sfuUplinkBandwidth) / meshUplinkBandwidth) * 100);

  res.json({
    success: true,
    participants: roomParticipants,
    topologyStats: {
      participantCount: count,
      meshBandwidthMbps: meshUplinkBandwidth.toFixed(1),
      sfuBandwidthMbps: sfuUplinkBandwidth.toFixed(1),
      bandwidthSavedPercentage
    }
  });
});

app.post("/api/sfu/quality", (req, res) => {
  const { participantId, quality } = req.body;
  const p = roomParticipants.find(item => item.id === participantId);
  if (p) {
    p.quality = quality;
    p.bitrateKbps = quality === "720p" ? 1800 : quality === "360p" ? 600 : 250;
    return res.json({ success: true, participant: p });
  }
  res.status(404).json({ success: false, message: "Participant not found" });
});

app.post("/api/sfu/active-speaker", (req, res) => {
  const { participantId } = req.body;
  roomParticipants.forEach(p => {
    p.activeSpeaker = p.id === participantId;
  });
  res.json({ success: true, activeSpeakerId: participantId });
});

const PORT = process.env.PORT || 5003;
app.listen(PORT, () => {
  console.log(`WebRTC SFU Simulator Server running on port ${PORT}`);
});
