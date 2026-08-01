const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let sagaState = {
  sagaId: "saga_ord_9011",
  status: "COMPLETED", // PENDING, FAILED_COMPENSATING, COMPLETED
  currentStep: 4,
  steps: [
    { name: "Create Pending Order", service: "Order Service", status: "SUCCESS", isCompensated: false },
    { name: "Authorize Payment", service: "Payment Service", status: "SUCCESS", isCompensated: false },
    { name: "Reserve Inventory Items", service: "Inventory Service", status: "SUCCESS", isCompensated: false },
    { name: "Dispatch Carrier Shipment", service: "Shipping Service", status: "SUCCESS", isCompensated: false }
  ],
  log: [
    "[Order Service] Order #9011 initialized in PENDING state",
    "[Payment Service] Charged $149.99 successfully",
    "[Inventory Service] Reserved 2 units of SKU-104",
    "[Shipping Service] Generated shipping label #TRACK-99a"
  ]
};

app.get("/api/saga/status", (req, res) => {
  res.json({ success: true, saga: sagaState });
});

app.post("/api/saga/execute", (req, res) => {
  const { failAtStep } = req.body;
  const sagaId = `saga_ord_${Math.floor(Math.random() * 9000 + 1000)}`;

  if (failAtStep === "payment") {
    sagaState = {
      sagaId,
      status: "FAILED_COMPENSATING",
      currentStep: 2,
      steps: [
        { name: "Create Pending Order", service: "Order Service", status: "COMPENSATED", isCompensated: true },
        { name: "Authorize Payment", service: "Payment Service", status: "FAILED", isCompensated: false },
        { name: "Reserve Inventory Items", service: "Inventory Service", status: "SKIPPED", isCompensated: false },
        { name: "Dispatch Carrier Shipment", service: "Shipping Service", status: "SKIPPED", isCompensated: false }
      ],
      log: [
        "[Order Service] Order initialized in PENDING state",
        "[Payment Service] ERROR: Card declined (Insufficient Funds)",
        "[Saga Coordinator] Triggering Compensating Transaction for Step 1...",
        "[Order Service] COMPENSATING: Cancelled Order record & released locks"
      ]
    };
  } else {
    sagaState = {
      sagaId,
      status: "COMPLETED",
      currentStep: 4,
      steps: [
        { name: "Create Pending Order", service: "Order Service", status: "SUCCESS", isCompensated: false },
        { name: "Authorize Payment", service: "Payment Service", status: "SUCCESS", isCompensated: false },
        { name: "Reserve Inventory Items", service: "Inventory Service", status: "SUCCESS", isCompensated: false },
        { name: "Dispatch Carrier Shipment", service: "Shipping Service", status: "SUCCESS", isCompensated: false }
      ],
      log: [
        "[Order Service] Order initialized in PENDING state",
        "[Payment Service] Charged $149.99 successfully",
        "[Inventory Service] Reserved units",
        "[Shipping Service] Shipment dispatched"
      ]
    };
  }

  res.json({ success: true, saga: sagaState });
});

const PORT = process.env.PORT || 5024;
app.listen(PORT, () => {
  console.log(`Saga Pattern Transaction Coordinator running on port ${PORT}`);
});
