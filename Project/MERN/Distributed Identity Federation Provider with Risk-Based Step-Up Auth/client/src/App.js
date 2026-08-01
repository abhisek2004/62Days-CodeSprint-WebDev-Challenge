import React, { useState, useEffect } from "react";

function App() {
  const [data, setData] = useState({ sessions: [], clients: [] });
  const [username, setUsername] = useState("david.miller@company.com");
  const [ipRegion, setIpRegion] = useState("Recognized IP");
  const [mfaCode, setMfaCode] = useState("");
  const [activeMfaSessionId, setActiveMfaSessionId] = useState(null);

  const fetchSessions = async () => {
    try {
      const res = await fetch("http://localhost:5008/api/idp/sessions");
      const result = await res.json();
      if (result.success) setData(result);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleAuthSubmit = async () => {
    try {
      const res = await fetch("http://localhost:5008/api/idp/authenticate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, ipRegion }),
      });
      const result = await res.json();
      if (result.success) fetchSessions();
    } catch (err) {
      console.error(err);
    }
  };

  const handleStepUpVerify = async (sessionId) => {
    try {
      const res = await fetch("http://localhost:5008/api/idp/step-up-mfa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, totpCode: mfaCode || "123456" }),
      });
      const result = await res.json();
      if (result.success) {
        setActiveMfaSessionId(null);
        fetchSessions();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSingleSignOut = async (sessionId) => {
    try {
      await fetch("http://localhost:5008/api/idp/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      fetchSessions();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="idp-container">
      <header>
        <div>
          <h1>🔐 Identity Federation Provider (OIDC / SAML2)</h1>
          <p style={{ color: "#8b949e", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            Risk-Based Step-Up MFA & Single Sign-Out (SLO) Engine
          </p>
        </div>
      </header>

      <div className="grid-2">
        {/* Login Risk Engine Simulator */}
        <div className="card">
          <h3 style={{ color: "#58a6ff", marginBottom: "1rem" }}>Simulate Federated OIDC Login</h3>
          <label style={{ fontSize: "0.8rem", color: "#8b949e" }}>User Email</label>
          <input
            type="text"
            className="input-field"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />

          <label style={{ fontSize: "0.8rem", color: "#8b949e" }}>IP Location Risk Context</label>
          <select className="input-field" value={ipRegion} onChange={(e) => setIpRegion(e.target.value)}>
            <option value="US-East (Recognized IP)">US-East (Recognized IP) [Low Risk]</option>
            <option value="Foreign IP (High Risk)">Foreign Suspicious IP [High Risk &gt;70]</option>
          </select>

          <button className="btn" style={{ width: "100%" }} onClick={handleAuthSubmit}>
            Authenticate OIDC Flow
          </button>
        </div>

        {/* Registered OAuth2 Apps */}
        <div className="card">
          <h3 style={{ color: "#58a6ff", marginBottom: "1rem" }}>Registered OAuth2 Client Apps</h3>
          {data.clients.map((c) => (
            <div key={c.clientId} style={{ padding: "0.6rem", background: "#0d1117", borderRadius: "6px", marginBottom: "0.5rem", fontSize: "0.85rem" }}>
              <strong style={{ color: "#58a6ff" }}>{c.clientName}</strong>
              <div style={{ color: "#8b949e" }}>Client ID: {c.clientId}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Active User Sessions */}
      <div className="card">
        <h3 style={{ color: "#58a6ff", marginBottom: "1rem" }}>Active SSO User Sessions & Risk Analysis</h3>
        {data.sessions.map((s) => (
          <div key={s.sessionId} style={{ padding: "1rem", background: "#0d1117", borderRadius: "8px", marginBottom: "0.75rem", border: "1px solid #30363d", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontWeight: "bold" }}>{s.username}</div>
              <div style={{ fontSize: "0.8rem", color: "#8b949e" }}>
                Session: {s.sessionId} • Location: {s.ipRegion} • Risk Score: <strong style={{ color: s.riskScore > 70 ? "#da3633" : "#238636" }}>{s.riskScore}/100</strong>
              </div>
              {s.mfaRequired ? (
                <div style={{ color: "#da3633", fontSize: "0.8rem", fontWeight: "bold", marginTop: "0.2rem" }}>
                  ⚠️ STEP-UP MFA REQUIRED (Risk Score &gt; 70)
                </div>
              ) : (
                <div style={{ color: "#238636", fontSize: "0.8rem", marginTop: "0.2rem" }}>
                  ✅ OIDC ID Token Issued: {s.tokens ? s.tokens.idToken.substring(0, 30) + "..." : "Active"}
                </div>
              )}
            </div>

            <div style={{ display: "flex", gap: "0.5rem" }}>
              {s.mfaRequired && (
                <button className="btn" onClick={() => handleStepUpVerify(s.sessionId)}>
                  Verify TOTP (123456)
                </button>
              )}
              <button className="btn btn-danger" onClick={() => handleSingleSignOut(s.sessionId)}>
                Single Sign-Out (SLO)
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
