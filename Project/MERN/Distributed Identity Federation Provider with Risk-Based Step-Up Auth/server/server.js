const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

// Registered OAuth2 Clients
let clientApps = [
  { clientId: "app_crm_901", clientName: "Enterprise CRM Portal", redirectUri: "https://crm.company.com/callback" },
  { clientId: "app_payroll_302", clientName: "Payroll Financial Portal", redirectUri: "https://payroll.company.com/callback" }
];

// Active sessions
let activeSessions = [
  { sessionId: "sess_881a", username: "john.doe@company.com", ipRegion: "US-East (Recognized)", device: "MacBook Pro", riskScore: 15, mfaRequired: false },
  { sessionId: "sess_992b", username: "alice.smith@company.com", ipRegion: "Foreign IP (High Risk)", device: "Unknown Android", riskScore: 85, mfaRequired: true }
];

app.get("/api/idp/sessions", (req, res) => {
  res.json({ success: true, sessions: activeSessions, clients: clientApps });
});

app.post("/api/idp/authenticate", (req, res) => {
  const { username, ipRegion, device } = req.body;
  let riskScore = 10;

  if (ipRegion && ipRegion.includes("Foreign")) riskScore += 50;
  if (device && device.includes("Unknown")) riskScore += 30;

  const mfaRequired = riskScore > 70;
  const sessionId = `sess_${Math.floor(Math.random() * 9000 + 1000)}`;

  const newSession = {
    sessionId,
    username,
    ipRegion: ipRegion || "Recognized Location",
    device: device || "Known Chrome Browser",
    riskScore,
    mfaRequired,
    tokens: mfaRequired ? null : {
      idToken: `eyJhbGciOiJSUzI1Ni...id_${username}`,
      accessToken: `eyJhbGciOiJSUzI1Ni...access_${sessionId}`,
      expiresIn: 3600
    }
  };

  activeSessions.unshift(newSession);

  res.json({ success: true, session: newSession });
});

app.post("/api/idp/step-up-mfa", (req, res) => {
  const { sessionId, totpCode } = req.body;
  const session = activeSessions.find(s => s.sessionId === sessionId);

  if (session && totpCode === "123456") {
    session.mfaRequired = false;
    session.tokens = {
      idToken: `eyJhbGciOiJSUzI1Ni...id_stepup_${session.username}`,
      accessToken: `eyJhbGciOiJSUzI1Ni...access_stepup_${sessionId}`,
      expiresIn: 3600
    };
    return res.json({ success: true, message: "Step-Up MFA Verified. Issued OIDC Tokens.", session });
  }

  res.status(400).json({ success: false, message: "Invalid TOTP Code (Use 123456)" });
});

app.post("/api/idp/logout", (req, res) => {
  const { sessionId } = req.body;
  activeSessions = activeSessions.filter(s => s.sessionId !== sessionId);
  res.json({ success: true, message: "Single Sign-Out (SLO) executed across federated apps." });
});

const PORT = process.env.PORT || 5008;
app.listen(PORT, () => {
  console.log(`Identity Federation Provider running on port ${PORT}`);
});
