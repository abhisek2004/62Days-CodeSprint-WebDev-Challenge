import React, { useState, useEffect } from "react";

function App() {
  const [data, setData] = useState({ keys: [], auditLogs: [] });
  const [keyName, setKeyName] = useState("External Developer Portal");
  const [cidrSubnet, setCidrSubnet] = useState("192.168.1.0/24");
  const [newRawKey, setNewRawKey] = useState(null);

  const fetchKeys = async () => {
    try {
      const res = await fetch("http://localhost:5016/api/keys");
      const result = await res.json();
      if (result.success) setData(result);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const handleCreateKey = async () => {
    try {
      const res = await fetch("http://localhost:5016/api/keys/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: keyName, cidrSubnet }),
      });
      const result = await res.json();
      if (result.success) {
        setNewRawKey(result.rawKey);
        fetchKeys();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRevokeKey = async (keyId) => {
    try {
      await fetch("http://localhost:5016/api/keys/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId }),
      });
      fetchKeys();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="key-container">
      <header>
        <div>
          <h1>🛡️ Zero-Trust API Key Manager & Introspection Gateway</h1>
          <p style={{ color: "#94a3b8", fontSize: "0.85rem", marginTop: "0.25rem" }}>
            SHA-256 Hashing, CIDR Subnet Whitelisting & Secret Revocation
          </p>
        </div>
      </header>

      {/* New Key Alert */}
      {newRawKey && (
        <div style={{ background: "#064e3b", border: "1px solid #059669", color: "#6ee7b7", padding: "1rem", borderRadius: "8px", marginBottom: "1.5rem" }}>
          🔑 <strong>Copy Secret Key (Only Shown Once):</strong> <code style={{ fontFamily: "monospace" }}>{newRawKey}</code>
        </div>
      )}

      <div className="grid-2">
        {/* Create API Key */}
        <div className="card">
          <h3 style={{ color: "#38bdf8", marginBottom: "1rem" }}>Generate New API Key</h3>
          <label style={{ fontSize: "0.8rem", color: "#94a3b8" }}>Key Description Name</label>
          <input
            type="text"
            className="input-field"
            value={keyName}
            onChange={(e) => setKeyName(e.target.value)}
          />

          <label style={{ fontSize: "0.8rem", color: "#94a3b8" }}>CIDR Subnet Whitelist</label>
          <input
            type="text"
            className="input-field"
            value={cidrSubnet}
            onChange={(e) => setCidrSubnet(e.target.value)}
          />

          <button className="btn" style={{ width: "100%" }} onClick={handleCreateKey}>
            Generate API Key & Hash Secret
          </button>
        </div>

        {/* API Keys Table */}
        <div className="card">
          <h3 style={{ color: "#38bdf8", marginBottom: "1rem" }}>Active & Revoked API Keys</h3>
          {data.keys.map((k) => (
            <div key={k.keyId} style={{ padding: "0.8rem", background: "#0f172a", borderRadius: "6px", marginBottom: "0.75rem", border: "1px solid #334155", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <strong>{k.name}</strong> ({k.prefixMask})
                <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>CIDR: {k.cidrSubnet} • ID: {k.keyId}</div>
              </div>
              <div>
                {k.status === "ACTIVE" ? (
                  <button className="btn btn-danger" style={{ fontSize: "0.75rem" }} onClick={() => handleRevokeKey(k.keyId)}>
                    Revoke Key
                  </button>
                ) : (
                  <span style={{ color: "#ef4444", fontSize: "0.8rem", fontWeight: "bold" }}>REVOKED</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
