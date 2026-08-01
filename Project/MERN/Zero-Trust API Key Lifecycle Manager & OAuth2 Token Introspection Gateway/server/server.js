const express = require("express");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

let apiKeys = [
  { keyId: "key_live_9011", name: "Stripe Payment Proxy", prefixMask: "sk_live_9011****", hashedSecret: "88a...", cidrSubnet: "192.168.1.0/24", scopes: ["read:transactions", "write:charges"], status: "ACTIVE" },
  { keyId: "key_test_4021", name: "Internal Analytics Pipeline", prefixMask: "sk_test_4021****", hashedSecret: "12f...", cidrSubnet: "10.0.0.0/8", scopes: ["read:analytics"], status: "REVOKED" }
];

let securityLogs = [];

app.get("/api/keys", (req, res) => {
  res.json({ success: true, keys: apiKeys, auditLogs: securityLogs });
});

app.post("/api/keys/create", (req, res) => {
  const { name, cidrSubnet, scopes } = req.body;
  const rawKey = `sk_live_${crypto.randomBytes(8).toString("hex")}`;
  const hashedSecret = crypto.createHash("sha256").update(rawKey).digest("hex");

  const newKey = {
    keyId: `key_${rawKey.substring(8, 16)}`,
    name: name || "Developer App Key",
    prefixMask: `${rawKey.substring(0, 12)}****`,
    hashedSecret,
    cidrSubnet: cidrSubnet || "0.0.0.0/0",
    scopes: scopes || ["read:general"],
    status: "ACTIVE",
    createdAt: new Date().toISOString()
  };

  apiKeys.unshift(newKey);
  securityLogs.unshift({
    timestamp: new Date().toISOString(),
    event: "API_KEY_CREATED",
    keyId: newKey.keyId,
    details: `Issued new Zero-Trust API Key for ${newKey.name}`
  });

  res.json({ success: true, rawKey, key: newKey });
});

app.post("/api/keys/revoke", (req, res) => {
  const { keyId } = req.body;
  const target = apiKeys.find(k => k.keyId === keyId);
  if (target) {
    target.status = "REVOKED";
    securityLogs.unshift({
      timestamp: new Date().toISOString(),
      event: "API_KEY_REVOKED",
      keyId,
      details: `Revoked API Key ${keyId} instantly via Zero-Trust Proxy`
    });
    return res.json({ success: true, key: target });
  }
  res.status(404).json({ success: false, message: "Key not found" });
});

app.post("/api/oauth/introspect", (req, res) => {
  const { token } = req.body;
  const isValid = token && !token.includes("invalid");

  res.json({
    active: isValid,
    scope: isValid ? "read write admin" : "",
    client_id: "app_merchant_401",
    sub: "user_dev_802",
    exp: Math.floor(Date.now() / 1000) + 3600
  });
});

const PORT = process.env.PORT || 5016;
app.listen(PORT, () => {
  console.log(`Zero-Trust API Key Gateway running on port ${PORT}`);
});
