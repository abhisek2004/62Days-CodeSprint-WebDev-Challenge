const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let deliveryFeed = [
  { id: "notif_8801", recipient: "user_patient_101", priority: "HIGH", channel: "In-App", status: "DELIVERED", template: "Appointment Confirmed for Dr. Jenkins" },
  { id: "notif_8802", recipient: "user_patient_102", priority: "URGENT", channel: "WebPush ➔ Fallback Email", status: "FALLBACK_TRIGGERED", template: "Critical Lab Results Available" }
];

app.get("/api/notifications/feed", (req, res) => {
  res.json({ success: true, feed: deliveryFeed });
});

app.post("/api/notifications/dispatch", (req, res) => {
  const { recipient, priority, primaryChannel, template } = req.body;
  const isUrgent = priority === "URGENT";

  const newNotif = {
    id: `notif_${Math.floor(Math.random() * 9000 + 1000)}`,
    recipient: recipient || "user_patient_202",
    priority: priority || "NORMAL",
    channel: isUrgent ? `${primaryChannel || "WebPush"} ➔ Fallback Email` : (primaryChannel || "In-App"),
    status: isUrgent ? "FALLBACK_TRIGGERED" : "DELIVERED",
    template: template || "Transactional Update Notification",
    timestamp: new Date().toISOString()
  };

  deliveryFeed.unshift(newNotif);
  res.json({ success: true, notification: newNotif });
});

const PORT = process.env.PORT || 5015;
app.listen(PORT, () => {
  console.log(`Distributed Notification Router Engine running on port ${PORT}`);
});
