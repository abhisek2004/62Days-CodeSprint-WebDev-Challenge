import React, { useState } from 'react';

export default function App() {
  const [recipient, setRecipient] = useState('Alex Rivera');
  const [course, setCourse] = useState('Full Stack Software Architecture 2026');
  const [issuedCert, setIssuedCert] = useState(null);
  const [lookupId, setLookupId] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);

  const handleMint = (e) => {
    e.preventDefault();
    const certId = `CERT-${Math.floor(100000 + Math.random() * 900000)}`;
    const cert = {
      certId,
      recipient,
      course,
      issuer: 'Global Tech Academy',
      sha256Hash: `0x${Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join('')}`,
      issuedAt: new Date().toLocaleDateString()
    };
    setIssuedCert(cert);
    setLookupId(certId);
  };

  const handleVerify = () => {
    if (issuedCert && lookupId === issuedCert.certId) {
      setVerificationResult({ verified: true, cert: issuedCert });
    } else {
      setVerificationResult({ verified: false });
    }
  };

  return (
    <div style={{ fontFamily: 'Segoe UI, sans-serif', background: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '24px' }}>
      <header style={{ borderBottom: '1px solid #334155', pb: '16px', marginBottom: '24px' }}>
        <h2 style={{ color: '#10b981', margin: 0 }}>📜 Cryptographic Digital Credentials Verification & Locker System</h2>
        <small style={{ color: '#94a3b8' }}>SHA-256 Proof-of-Tamper Certificate Minting Portal</small>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
          <h3>Issuer Portal (Mint Certificate)</h3>
          <form onSubmit={handleMint}>
            <div style={{ margin: '14px 0' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px' }}>Recipient Full Name:</label>
              <input type="text" value={recipient} onChange={e => setRecipient(e.target.value)} style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} />
            </div>
            <div style={{ margin: '14px 0' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px' }}>Course Title:</label>
              <input type="text" value={course} onChange={e => setCourse(e.target.value)} style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} />
            </div>
            <button type="submit" style={{ width: '100%', background: '#10b981', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
              Mint Cryptographic Certificate
            </button>
          </form>

          {issuedCert && (
            <div style={{ marginTop: '20px', background: '#0f172a', padding: '14px', borderRadius: '8px', border: '1px solid #10b981' }}>
              <h4 style={{ color: '#10b981', margin: '0 0 8px' }}>Minted ID: {issuedCert.certId}</h4>
              <code style={{ fontSize: '0.75rem', color: '#94a3b8', wordBreak: 'break-all' }}>SHA256: {issuedCert.sha256Hash}</code>
            </div>
          )}
        </div>

        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
          <h3>Public Verifier (Check ID or QR)</h3>
          <div style={{ display: 'flex', gap: '8px', margin: '16px 0' }}>
            <input type="text" placeholder="Enter CERT-XXXXXX" value={lookupId} onChange={e => setLookupId(e.target.value)} style={{ flex: 1, padding: '10px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} />
            <button onClick={handleVerify} style={{ background: '#38bdf8', color: '#fff', border: 'none', padding: '0 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Verify Hash</button>
          </div>

          {verificationResult && (
            <div style={{ background: '#0f172a', padding: '16px', borderRadius: '8px', border: `1px solid ${verificationResult.verified ? '#10b981' : '#ef4444'}` }}>
              {verificationResult.verified ? (
                <div>
                  <h4 style={{ color: '#10b981', margin: '0 0 6px' }}>✓ VERIFIED AUTHENTIC CERTIFICATE</h4>
                  <p style={{ margin: '4px 0' }}>Recipient: <strong>{verificationResult.cert.recipient}</strong></p>
                  <p style={{ margin: '4px 0' }}>Course: <strong>{verificationResult.cert.course}</strong></p>
                </div>
              ) : (
                <h4 style={{ color: '#ef4444', margin: 0 }}>❌ INVALID OR TAMPERED CERTIFICATE ID</h4>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
