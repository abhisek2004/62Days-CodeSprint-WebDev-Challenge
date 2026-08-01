const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

let servicesTopology = [
  { id: "api-gateway", name: "API Gateway", rps: 450, errorRate: 0.1, p99LatencyMs: 85 },
  { id: "auth-service", name: "Auth Service", rps: 320, errorRate: 0.0, p99LatencyMs: 25 },
  { id: "order-service", name: "Order Service", rps: 180, errorRate: 0.5, p99LatencyMs: 140 },
  { id: "payment-service", name: "Payment Gateway", rps: 150, errorRate: 1.2, p99LatencyMs: 310 }
];

let traceSpans = [
  { traceId: "trace_88a1", spanId: "span_1", service: "api-gateway", name: "POST /api/checkout", durationMs: 340, parentSpanId: null },
  { traceId: "trace_88a1", spanId: "span_2", service: "auth-service", name: "VERIFY_JWT_TOKEN", durationMs: 18, parentSpanId: "span_1" },
  { traceId: "trace_88a1", spanId: "span_3", service: "order-service", name: "CREATE_ORDER_RECORD", durationMs: 95, parentSpanId: "span_1" },
  { traceId: "trace_88a1", spanId: "span_4", service: "payment-service", name: "CHARGE_CREDIT_CARD", durationMs: 220, parentSpanId: "span_3" }
];

app.get("/api/tracing/topology", (req, res) => {
  res.json({ success: true, services: servicesTopology, spans: traceSpans });
});

app.post("/api/tracing/simulate-request", (req, res) => {
  const newTraceId = `trace_${Math.floor(Math.random() * 9000 + 1000)}`;
  const gatewayMs = Math.floor(Math.random() * 50 + 40);
  const payMs = Math.floor(Math.random() * 200 + 120);

  const newSpans = [
    { traceId: newTraceId, spanId: "s1", service: "api-gateway", name: "GET /api/products", durationMs: gatewayMs + payMs, parentSpanId: null },
    { traceId: newTraceId, spanId: "s2", service: "auth-service", name: "GET_USER_PERMISSIONS", durationMs: 12, parentSpanId: "s1" },
    { traceId: newTraceId, spanId: "s3", service: "payment-service", name: "FETCH_ACCOUNT_BALANCE", durationMs: payMs, parentSpanId: "s1" }
  ];

  traceSpans.unshift(...newSpans);
  res.json({ success: true, traceId: newTraceId, spans: newSpans });
});

const PORT = process.env.PORT || 5021;
app.listen(PORT, () => {
  console.log(`Microservice Tracing Collector running on port ${PORT}`);
});
