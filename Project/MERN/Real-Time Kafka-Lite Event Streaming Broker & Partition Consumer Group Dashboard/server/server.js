const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let topicPartitions = {
  "Partition-0": [
    { offset: 0, key: "user_101", value: "Order Created #101" },
    { offset: 1, key: "user_104", value: "Payment Success #101" }
  ],
  "Partition-1": [
    { offset: 0, key: "user_102", value: "Order Created #102" }
  ],
  "Partition-2": [
    { offset: 0, key: "user_103", value: "Order Created #103" }
  ]
};

let consumerGroup = [
  { consumerId: "consumer-c1", assignedPartitions: ["Partition-0"], currentOffset: 2, lag: 0 },
  { consumerId: "consumer-c2", assignedPartitions: ["Partition-1", "Partition-2"], currentOffset: 1, lag: 0 }
];

app.get("/api/kafka/status", (req, res) => {
  res.json({ success: true, topic: "orders.events", partitions: topicPartitions, consumers: consumerGroup });
});

app.post("/api/kafka/publish", (req, res) => {
  const { key, value } = req.body;
  // Key-based partition hashing
  let hash = 0;
  for (let char of (key || "default")) hash = (hash << 5) - hash + char.charCodeAt(0);
  const partitionIdx = Math.abs(hash) % 3;
  const pKey = `Partition-${partitionIdx}`;

  const currentList = topicPartitions[pKey];
  const offset = currentList.length;
  const newMsg = { offset, key: key || "key-anon", value: value || `Event payload offset #${offset}` };
  currentList.push(newMsg);

  res.json({ success: true, partitionAssigned: pKey, offset, message: newMsg });
});

app.post("/api/kafka/consumer/replay", (req, res) => {
  const { consumerId, targetOffset } = req.body;
  const c = consumerGroup.find(item => item.consumerId === consumerId);
  if (c) {
    c.currentOffset = Number(targetOffset);
    return res.json({ success: true, consumer: c, message: `Replayed consumer ${consumerId} to offset ${targetOffset}` });
  }
  res.status(404).json({ success: false, message: "Consumer not found" });
});

const PORT = process.env.PORT || 5018;
app.listen(PORT, () => {
  console.log(`Kafka-Lite Streaming Broker running on port ${PORT}`);
});
