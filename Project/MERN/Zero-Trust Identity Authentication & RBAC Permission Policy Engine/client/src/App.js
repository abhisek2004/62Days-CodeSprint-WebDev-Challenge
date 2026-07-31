import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://localhost:5000/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('sandbox');
  const [serverStatus, setServerStatus] = useState('CHECKING');
  
  // Data States
  const [policyRules, setPolicyRules] = useState([]);
  const [roleMatrix, setRoleMatrix] = useState({});
  const [auditLogs, setAuditLogs] = useState([]);
  const [sampleUsers, setSampleUsers] = useState([]);
  
  // Personas / Active Token State
  const [selectedUser, setSelectedUser] = useState('admin_alice');
  const [currentToken, setCurrentToken] = useState('');
  const [decodedToken, setDecodedToken] = useState(null);
  const [tokenVerificationStatus, setTokenVerificationStatus] = useState(null);
  
  // Sandbox Request Evaluator Form State
  const [sandboxForm, setSandboxForm] = useState({
    role: 'Doctor',
    action: 'READ',
    resource: 'patient:records',
    deviceRisk: 'LOW',
    ipAddress: '10.0.4.12',
    mfaVerified: true,
    requestHour: 14,
    subject: 'doc_carol'
  });
  const [evalResult, setEvalResult] = useState(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Policy Builder Form State
  const [policyForm, setPolicyForm] = useState({
    name: '',
    effect: 'ALLOW',
    roles: ['Doctor'],
    resources: ['patient:records'],
    actions: ['READ'],
    minTrustScore: 70,
    maxDeviceRisk: 'MEDIUM',
    requireMFA: true,
    workingHoursOnly: true,
    allowedIpSubnets: '10.0.0.0/8, 192.168.1.0/24',
    description: ''
  });
  const [editingPolicyId, setEditingPolicyId] = useState(null);

  // Audit Logs Filter
  const [auditFilter, setAuditFilter] = useState({ decision: 'ALL', role: 'ALL', search: '' });

  // Load Initial Data from Express Server or Fallback
  const fetchServerData = useCallback(async () => {
    try {
      const healthRes = await fetch(`${API_BASE}/health`);
      if (healthRes.ok) {
        setServerStatus('ONLINE');
        
        const [rulesRes, matrixRes, logsRes, usersRes] = await Promise.all([
          fetch(`${API_BASE}/policy/rules`),
          fetch(`${API_BASE}/matrix`),
          fetch(`${API_BASE}/audit-logs`),
          fetch(`${API_BASE}/users`)
        ]);

        if (rulesRes.ok) setPolicyRules(await rulesRes.json());
        if (matrixRes.ok) setRoleMatrix(await matrixRes.json());
        if (logsRes.ok) setAuditLogs(await logsRes.json());
        if (usersRes.ok) setSampleUsers(await usersRes.json());
      } else {
        setServerStatus('OFFLINE');
      }
    } catch (err) {
      setServerStatus('OFFLINE');
      // Set Default Fallback State if offline
      setPolicyRules([
        {
          id: 'POL-001',
          name: 'Deny Untrusted Device Access to Sensitive Patient Data',
          effect: 'DENY',
          roles: ['Doctor', 'Nurse', 'Guest'],
          resources: ['patient:records'],
          actions: ['DELETE', 'ADMINISTER'],
          conditions: { minTrustScore: 75, maxDeviceRisk: 'MEDIUM', requireMFA: true, workingHoursOnly: false }
        },
        {
          id: 'POL-002',
          name: 'Require MFA & Corporate Subnet for System Configuration',
          effect: 'ALLOW',
          roles: ['Admin', 'SecurityAnalyst'],
          resources: ['system:config', 'policy:rules'],
          actions: ['READ', 'WRITE', 'EXECUTE'],
          conditions: { minTrustScore: 80, maxDeviceRisk: 'LOW', requireMFA: true, workingHoursOnly: true }
        }
      ]);
      setRoleMatrix({
        Admin: { 'patient:records': ['READ', 'WRITE', 'DELETE', 'ADMINISTER'], 'system:config': ['READ', 'WRITE', 'DELETE'] },
        Doctor: { 'patient:records': ['READ', 'WRITE'] },
        Nurse: { 'patient:records': ['READ'] },
        Guest: { 'patient:records': [] }
      });
    }
  }, []);

  useEffect(() => {
    fetchServerData();
  }, [fetchServerData]);

  // Authenticate Persona & Generate Token
  const handleLoginPersona = async (username) => {
    setSelectedUser(username);
    const targetUser = sampleUsers.find(u => u.username === username) || {
      username,
      role: 'Doctor',
      defaultDeviceRisk: 'LOW',
      defaultIp: '10.0.4.12',
      defaultMfa: true
    };

    setSandboxForm(prev => ({
      ...prev,
      subject: targetUser.username,
      role: targetUser.role,
      deviceRisk: targetUser.defaultDeviceRisk || 'LOW',
      ipAddress: targetUser.defaultIp || '10.0.4.12',
      mfaVerified: targetUser.defaultMfa !== undefined ? targetUser.defaultMfa : true
    }));

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: targetUser.username,
          deviceRisk: targetUser.defaultDeviceRisk,
          ipAddress: targetUser.defaultIp,
          mfaVerified: targetUser.defaultMfa
        })
      });
      if (res.ok) {
        const data = await res.json();
        setCurrentToken(data.token);
        setDecodedToken(data.payload);
        verifyToken(data.token);
      }
    } catch (err) {
      console.warn('Login request fallback simulation');
    }
  };

  const verifyToken = async (tokenToVerify) => {
    try {
      const res = await fetch(`${API_BASE}/auth/verify-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: tokenToVerify || currentToken })
      });
      const data = await res.json();
      setTokenVerificationStatus(data);
    } catch (err) {
      setTokenVerificationStatus({ valid: false, error: 'Cannot connect to backend server.' });
    }
  };

  const handleRevokeToken = async () => {
    if (!decodedToken || !decodedToken.jti) return;
    try {
      await fetch(`${API_BASE}/auth/revoke-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jti: decodedToken.jti })
      });
      verifyToken(currentToken);
    } catch (err) {
      alert('Revocation failed');
    }
  };

  // Run Policy Sandbox Evaluation
  const handleEvaluateSandbox = async () => {
    setIsEvaluating(true);
    try {
      const res = await fetch(`${API_BASE}/policy/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: currentToken,
          ...sandboxForm
        })
      });
      if (res.ok) {
        const data = await res.json();
        setEvalResult(data);
        // Refresh audit logs
        const logsRes = await fetch(`${API_BASE}/audit-logs`);
        if (logsRes.ok) setAuditLogs(await logsRes.json());
      }
    } catch (err) {
      // Local fallback calculation if offline
      const trustScore = 75;
      setEvalResult({
        decision: 'ALLOW',
        reason: 'Local Fallback Evaluation: Trust score 75/100.',
        trustEvaluation: { trustScore, trustStatus: 'TRUSTED', deductions: [] },
        hasRbacPermission: true,
        evaluationSteps: [
          { step: '1. Identity Context', passed: true, detail: `User: ${sandboxForm.subject}` },
          { step: '2. Zero-Trust Scoring', passed: true, detail: `Trust score ${trustScore}/100` },
          { step: '3. RBAC Matrix Check', passed: true, detail: 'Granted' }
        ]
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  // Policy Builder Handlers
  const handleSavePolicy = async (e) => {
    e.preventDefault();
    const payload = {
      name: policyForm.name,
      effect: policyForm.effect,
      roles: policyForm.roles,
      resources: policyForm.resources,
      actions: policyForm.actions,
      description: policyForm.description,
      conditions: {
        minTrustScore: Number(policyForm.minTrustScore),
        maxDeviceRisk: policyForm.maxDeviceRisk,
        requireMFA: Boolean(policyForm.requireMFA),
        workingHoursOnly: Boolean(policyForm.workingHoursOnly),
        allowedIpSubnets: policyForm.allowedIpSubnets.split(',').map(s => s.trim()).filter(Boolean)
      }
    };

    try {
      const url = editingPolicyId ? `${API_BASE}/policy/rules/${editingPolicyId}` : `${API_BASE}/policy/rules`;
      const method = editingPolicyId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const rulesRes = await fetch(`${API_BASE}/policy/rules`);
        if (rulesRes.ok) setPolicyRules(await rulesRes.json());
        setEditingPolicyId(null);
        setPolicyForm({
          name: '',
          effect: 'ALLOW',
          roles: ['Doctor'],
          resources: ['patient:records'],
          actions: ['READ'],
          minTrustScore: 70,
          maxDeviceRisk: 'MEDIUM',
          requireMFA: true,
          workingHoursOnly: true,
          allowedIpSubnets: '10.0.0.0/8, 192.168.1.0/24',
          description: ''
        });
      }
    } catch (err) {
      alert('Error saving policy rule.');
    }
  };

  const handleDeletePolicy = async (id) => {
    if (!window.confirm(`Are you sure you want to delete policy ${id}?`)) return;
    try {
      await fetch(`${API_BASE}/policy/rules/${id}`, { method: 'DELETE' });
      setPolicyRules(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      setPolicyRules(prev => prev.filter(p => p.id !== id));
    }
  };

  // Toggle Matrix Action Toggle
  const handleToggleMatrixAction = async (role, resource, action) => {
    const newMatrix = JSON.parse(JSON.stringify(roleMatrix));
    if (!newMatrix[role]) newMatrix[role] = {};
    if (!newMatrix[role][resource]) newMatrix[role][resource] = [];

    const actionsList = newMatrix[role][resource];
    const idx = actionsList.indexOf(action);
    if (idx >= 0) {
      actionsList.splice(idx, 1);
    } else {
      actionsList.push(action);
    }

    setRoleMatrix(newMatrix);
    try {
      await fetch(`${API_BASE}/matrix`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matrix: newMatrix })
      });
    } catch (err) {
      console.warn('Matrix updated locally');
    }
  };

  // Stats Counters
  const totalLogs = auditLogs.length;
  const allowLogs = auditLogs.filter(l => l.decision === 'ALLOW').length;
  const denyLogs = auditLogs.filter(l => l.decision === 'DENY').length;
  const allowPercentage = totalLogs > 0 ? Math.round((allowLogs / totalLogs) * 100) : 100;

  return (
    <div className="app-container">
      {/* Top Header Card */}
      <header className="header-card">
        <div className="header-top">
          <div className="header-title-box">
            <h1>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <path d="M12 8v4m0 4h.01"/>
              </svg>
              Zero-Trust Policy & ABAC/RBAC Engine
            </h1>
            <p>Continuous verification, risk-based identity claims validation & fine-grained permission enforcement</p>
          </div>
          <div className="header-meta">
            <div className={`status-badge ${serverStatus === 'ONLINE' ? 'healthy' : ''}`}>
              <span className="pulse-dot"></span>
              Policy Engine: {serverStatus}
            </div>
          </div>
        </div>
      </header>

      {/* Tabs Navigation */}
      <nav className="nav-tabs">
        <button className={`tab-button ${activeTab === 'sandbox' ? 'active' : ''}`} onClick={() => setActiveTab('sandbox')}>
          ⚡ Policy Sandbox & Evaluator
        </button>
        <button className={`tab-button ${activeTab === 'policies' ? 'active' : ''}`} onClick={() => setActiveTab('policies')}>
          📜 ABAC/RBAC Policy Rules ({policyRules.length})
        </button>
        <button className={`tab-button ${activeTab === 'token' ? 'active' : ''}`} onClick={() => setActiveTab('token')}>
          🔑 Identity Token Inspector
        </button>
        <button className={`tab-button ${activeTab === 'matrix' ? 'active' : ''}`} onClick={() => setActiveTab('matrix')}>
          🎛️ Role Permission Matrix
        </button>
        <button className={`tab-button ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => setActiveTab('audit')}>
          🛡️ Audit Logs ({auditLogs.length})
        </button>
      </nav>

      {/* Top Stats Overview Grid */}
      <div className="grid-stats">
        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">Total Verification Requests</div>
            <div className="stat-value">{totalLogs}</div>
          </div>
          <div className="stat-icon-wrapper icon-blue">📊</div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">Allowed Access Ratio</div>
            <div className="stat-value" style={{ color: '#34d399' }}>{allowPercentage}%</div>
          </div>
          <div className="stat-icon-wrapper icon-green">✅</div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">Blocked Security Denials</div>
            <div className="stat-value" style={{ color: '#f87171' }}>{denyLogs}</div>
          </div>
          <div className="stat-icon-wrapper icon-red">⛔</div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <div className="stat-label">Active Policy Rules</div>
            <div className="stat-value" style={{ color: '#22d3ee' }}>{policyRules.length}</div>
          </div>
          <div className="stat-icon-wrapper icon-cyan">🔒</div>
        </div>
      </div>

      {/* Zero-Trust Decision Architecture Pipeline Diagram */}
      <div className="panel">
        <div className="panel-header">
          <div className="panel-title">
            <span>🛡️</span> Zero-Trust Decision Verification Pipeline
          </div>
        </div>
        <div className="pipeline-visualizer">
          <div className="pipeline-node">
            <div className="node-title">1. Request Context</div>
            <div className="node-desc">JWT / Subject & IP / Device Risk</div>
          </div>
          <div className="pipeline-arrow">➔</div>
          <div className="pipeline-node">
            <div className="node-title">2. Trust Calculation</div>
            <div className="node-desc">Score (0-100) & Risk Penalty</div>
          </div>
          <div className="pipeline-arrow">➔</div>
          <div className="pipeline-node">
            <div className="node-title">3. RBAC Check</div>
            <div className="node-desc">Role vs Resource:Action Permission</div>
          </div>
          <div className="pipeline-arrow">➔</div>
          <div className="pipeline-node">
            <div className="node-title">4. ABAC Rule Engine</div>
            <div className="node-desc">JSON Condition Matching & Deny First</div>
          </div>
          <div className="pipeline-arrow">➔</div>
          <div className="pipeline-node">
            <div className="node-title">5. Enforcement</div>
            <div className="node-desc">ALLOW / DENY & Audit Logging</div>
          </div>
        </div>
      </div>

      {/* TAB 1: Policy Evaluator Sandbox */}
      {activeTab === 'sandbox' && (
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <span>⚡</span> Real-Time Request Policy Evaluator Sandbox
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Simulate incoming request headers, identity claims, and context parameters
            </div>
          </div>

          <div className="sandbox-layout">
            {/* Input Form */}
            <div style={{ background: '#0d1322', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '16px', color: '#60a5fa' }}>Input Request Parameters</h3>

              <div className="form-group">
                <label className="form-label">Subject Persona Preset</label>
                <select 
                  className="form-select" 
                  value={selectedUser} 
                  onChange={(e) => handleLoginPersona(e.target.value)}
                >
                  <option value="admin_alice">Admin: Alice (SecOps - Low Risk IP: 10.0.4.12, MFA Yes)</option>
                  <option value="sec_bob">Security Analyst: Bob (Compliance - Low Risk IP: 192.168.1.50, MFA Yes)</option>
                  <option value="doc_carol">Doctor: Carol (Emergency Care - Med Risk IP: 172.16.4.88, MFA Yes)</option>
                  <option value="nurse_dan">Nurse: Dan (Inpatient Care - Low Risk IP: 192.168.1.102, MFA No)</option>
                  <option value="guest_eve">Guest: Eve (External - High Risk IP: 198.51.100.44, MFA No)</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select 
                    className="form-select" 
                    value={sandboxForm.role} 
                    onChange={e => setSandboxForm({ ...sandboxForm, role: e.target.value })}
                  >
                    <option value="Admin">Admin</option>
                    <option value="SecurityAnalyst">SecurityAnalyst</option>
                    <option value="Doctor">Doctor</option>
                    <option value="Nurse">Nurse</option>
                    <option value="Guest">Guest</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Target Resource</label>
                  <select 
                    className="form-select" 
                    value={sandboxForm.resource} 
                    onChange={e => setSandboxForm({ ...sandboxForm, resource: e.target.value })}
                  >
                    <option value="patient:records">patient:records</option>
                    <option value="system:config">system:config</option>
                    <option value="audit:logs">audit:logs</option>
                    <option value="policy:rules">policy:rules</option>
                    <option value="user:credentials">user:credentials</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Requested Action</label>
                  <select 
                    className="form-select" 
                    value={sandboxForm.action} 
                    onChange={e => setSandboxForm({ ...sandboxForm, action: e.target.value })}
                  >
                    <option value="READ">READ</option>
                    <option value="WRITE">WRITE</option>
                    <option value="DELETE">DELETE</option>
                    <option value="EXECUTE">EXECUTE</option>
                    <option value="ADMINISTER">ADMINISTER</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Device Risk Level</label>
                  <select 
                    className="form-select" 
                    value={sandboxForm.deviceRisk} 
                    onChange={e => setSandboxForm({ ...sandboxForm, deviceRisk: e.target.value })}
                  >
                    <option value="LOW">LOW (Trusted Managed Device)</option>
                    <option value="MEDIUM">MEDIUM (Unrecognized Device)</option>
                    <option value="HIGH">HIGH (Outdated OS / Unknown Agent)</option>
                    <option value="CRITICAL">CRITICAL (Suspicious Malware Flag)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Origin IP Address</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={sandboxForm.ipAddress} 
                    onChange={e => setSandboxForm({ ...sandboxForm, ipAddress: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Request Hour (0-23)</label>
                  <input 
                    type="number" 
                    min="0" 
                    max="23" 
                    className="form-input" 
                    value={sandboxForm.requestHour} 
                    onChange={e => setSandboxForm({ ...sandboxForm, requestHour: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.9rem' }}>
                  <input 
                    type="checkbox" 
                    checked={sandboxForm.mfaVerified} 
                    onChange={e => setSandboxForm({ ...sandboxForm, mfaVerified: e.target.checked })} 
                    style={{ width: '18px', height: '18px' }}
                  />
                  <span>Step-up Multi-Factor Authentication (MFA) Verified</span>
                </label>
              </div>

              <button 
                className="btn btn-primary" 
                style={{ width: '100%', marginTop: '16px' }}
                onClick={handleEvaluateSandbox}
                disabled={isEvaluating}
              >
                {isEvaluating ? 'Evaluating Policy Engine...' : '⚡ Run Zero-Trust Policy Evaluation'}
              </button>
            </div>

            {/* Output Evaluation Breakdown */}
            <div style={{ background: '#0d1322', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '16px', color: '#60a5fa' }}>Evaluation Breakdown & Result</h3>

              {evalResult ? (
                <div>
                  {/* Decision Banner */}
                  <div className={`decision-banner ${evalResult.decision === 'ALLOW' ? 'allow' : 'deny'}`}>
                    <div style={{ fontSize: '2.5rem' }}>
                      {evalResult.decision === 'ALLOW' ? '🛡️' : '⛔'}
                    </div>
                    <div>
                      <div className="decision-title">POLICY DECISION: {evalResult.decision}</div>
                      <div style={{ fontSize: '0.875rem', opacity: 0.9, marginTop: '4px' }}>
                        {evalResult.reason}
                      </div>
                    </div>
                  </div>

                  {/* Risk Score Gauge */}
                  {evalResult.trustEvaluation && (
                    <div className="score-gauge-container">
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                        <span style={{ fontWeight: 600 }}>Zero-Trust Score: {evalResult.trustEvaluation.trustScore}/100</span>
                        <span className={`badge ${evalResult.trustEvaluation.trustScore >= 70 ? 'badge-allow' : 'badge-deny'}`}>
                          STATUS: {evalResult.trustEvaluation.trustStatus}
                        </span>
                      </div>
                      <div className="score-bar-bg">
                        <div 
                          className={`score-bar-fill ${
                            evalResult.trustEvaluation.trustScore >= 85 ? 'fill-excellent' :
                            evalResult.trustEvaluation.trustScore >= 70 ? 'fill-trusted' :
                            evalResult.trustEvaluation.trustScore >= 50 ? 'fill-elevated' : 'fill-untrusted'
                          }`} 
                          style={{ width: `${evalResult.trustEvaluation.trustScore}%` }}
                        ></div>
                      </div>
                      {evalResult.trustEvaluation.deductions && evalResult.trustEvaluation.deductions.length > 0 && (
                        <div style={{ marginTop: '8px', fontSize: '0.75rem', color: '#f87171' }}>
                          ⚠️ Risk Deductions: {evalResult.trustEvaluation.deductions.join(' | ')}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step Timeline */}
                  <div className="step-list">
                    {evalResult.evaluationSteps && evalResult.evaluationSteps.map((s, idx) => (
                      <div key={idx} className="step-item">
                        <div className={`step-icon ${s.passed ? 'step-pass' : 'step-fail'}`}>
                          {s.passed ? '✓' : '✕'}
                        </div>
                        <div className="step-content">
                          <div className="step-name">{s.step}</div>
                          <div className="step-detail">{s.detail}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Matching ABAC Policy Breakdown */}
                  {evalResult.abacRuleBreakdown && evalResult.abacRuleBreakdown.length > 0 && (
                    <div style={{ marginTop: '16px' }}>
                      <div style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                        MATCHING ABAC POLICY RULES:
                      </div>
                      {evalResult.abacRuleBreakdown.map((r, idx) => (
                        <div key={idx} style={{ padding: '8px 12px', background: '#111827', borderRadius: '6px', marginBottom: '6px', fontSize: '0.8rem', border: '1px solid #1f293d' }}>
                          <span className={`badge ${r.effect === 'ALLOW' ? 'badge-allow' : 'badge-deny'}`}>
                            {r.effect}
                          </span>{' '}
                          <strong>[{r.policyId}]</strong> {r.policyName} - Conditions Passed:{' '}
                          <span style={{ color: r.conditionsMet ? '#34d399' : '#f87171', fontWeight: 'bold' }}>
                            {r.conditionsMet ? 'YES' : 'NO'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🎯</div>
                  <p>Click <strong>"Run Zero-Trust Policy Evaluation"</strong> on the left panel to test authorization policy rules against simulated requests.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Dynamic ABAC/RBAC Policy Rules Builder */}
      {activeTab === 'policies' && (
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <span>📜</span> ABAC/RBAC Policy Rules Engine Manager
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
            {/* Policy Rules List */}
            <div>
              <h3 style={{ fontSize: '1rem', marginBottom: '16px', color: '#60a5fa' }}>Active Policy Rules Set</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {policyRules.map(policy => (
                  <div key={policy.id} style={{ background: '#0d1322', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span className={`badge ${policy.effect === 'ALLOW' ? 'badge-allow' : 'badge-deny'}`}>
                          {policy.effect}
                        </span>{' '}
                        <strong style={{ fontSize: '0.95rem' }}>{policy.id}</strong> - {policy.name}
                      </div>
                      <button 
                        className="btn btn-danger" 
                        style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                        onClick={() => handleDeletePolicy(policy.id)}
                      >
                        Delete
                      </button>
                    </div>

                    <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: '8px 0' }}>
                      {policy.description || 'No description provided.'}
                    </p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', fontSize: '0.75rem', marginTop: '10px' }}>
                      <span className="badge badge-role">Roles: {policy.roles.join(', ')}</span>
                      <span className="badge badge-resource">Resources: {policy.resources.join(', ')}</span>
                      <span className="badge badge-role">Actions: {policy.actions.join(', ')}</span>
                    </div>

                    {policy.conditions && (
                      <div style={{ marginTop: '10px', padding: '8px 12px', background: '#111827', borderRadius: '6px', fontSize: '0.75rem', color: '#38bdf8' }}>
                        ⚙️ Conditions: Min Score &gt;= {policy.conditions.minTrustScore || 0} | MFA Required: {policy.conditions.requireMFA ? 'Yes' : 'No'} | Work Hours Only: {policy.conditions.workingHoursOnly ? 'Yes' : 'No'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Create New Policy Form */}
            <div style={{ background: '#0d1322', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '16px', color: '#60a5fa' }}>
                {editingPolicyId ? `Edit Policy ${editingPolicyId}` : 'Create ABAC/RBAC Policy Rule'}
              </h3>
              
              <form onSubmit={handleSavePolicy}>
                <div className="form-group">
                  <label className="form-label">Policy Rule Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    required 
                    value={policyForm.name} 
                    onChange={e => setPolicyForm({ ...policyForm, name: e.target.value })}
                    placeholder="e.g. Enforce MFA for Patient Record Deletion"
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Policy Effect</label>
                    <select 
                      className="form-select" 
                      value={policyForm.effect} 
                      onChange={e => setPolicyForm({ ...policyForm, effect: e.target.value })}
                    >
                      <option value="ALLOW">ALLOW (Permit)</option>
                      <option value="DENY">DENY (Explicit Block)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Min Trust Score (0-100)</label>
                    <input 
                      type="number" 
                      className="form-input" 
                      value={policyForm.minTrustScore} 
                      onChange={e => setPolicyForm({ ...policyForm, minTrustScore: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Target Roles (comma separated)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={policyForm.roles.join(', ')} 
                    onChange={e => setPolicyForm({ ...policyForm, roles: e.target.value.split(',').map(s => s.trim()) })}
                    placeholder="Doctor, Nurse, Guest"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Target Resources</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={policyForm.resources.join(', ')} 
                    onChange={e => setPolicyForm({ ...policyForm, resources: e.target.value.split(',').map(s => s.trim()) })}
                    placeholder="patient:records, system:config"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Target Actions</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={policyForm.actions.join(', ')} 
                    onChange={e => setPolicyForm({ ...policyForm, actions: e.target.value.split(',').map(s => s.trim()) })}
                    placeholder="READ, WRITE, DELETE"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Allowed Corporate IP Subnets</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    value={policyForm.allowedIpSubnets} 
                    onChange={e => setPolicyForm({ ...policyForm, allowedIpSubnets: e.target.value })}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', margin: '12px 0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                    <input 
                      type="checkbox" 
                      checked={policyForm.requireMFA} 
                      onChange={e => setPolicyForm({ ...policyForm, requireMFA: e.target.checked })} 
                    />
                    Require Step-Up MFA
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}>
                    <input 
                      type="checkbox" 
                      checked={policyForm.workingHoursOnly} 
                      onChange={e => setPolicyForm({ ...policyForm, workingHoursOnly: e.target.checked })} 
                    />
                    Working Hours Only
                  </label>
                </div>

                <div className="form-group">
                  <label className="form-label">Policy Description</label>
                  <textarea 
                    className="form-textarea" 
                    rows="2" 
                    value={policyForm.description} 
                    onChange={e => setPolicyForm({ ...policyForm, description: e.target.value })}
                  ></textarea>
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                  ➕ Save & Publish Policy Rule
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Identity Token Inspector */}
      {activeTab === 'token' && (
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <span>🔑</span> Zero-Trust Identity Token Inspector & Revocation Engine
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
            {/* Active JWT Claims */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '1rem', color: '#60a5fa' }}>Active Subject Persona JWT</h3>
                <button className="btn btn-danger" style={{ padding: '4px 12px', fontSize: '0.8rem' }} onClick={handleRevokeToken}>
                  🚫 Revoke Token (Blacklist JTI)
                </button>
              </div>

              <div className="form-group">
                <label className="form-label">Encoded Signed JWT Token</label>
                <textarea className="form-textarea" rows="4" readOnly value={currentToken || 'No token issued yet. Select persona above or run login.'}></textarea>
              </div>

              {tokenVerificationStatus && (
                <div style={{ marginTop: '16px', padding: '16px', background: '#0d1322', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>{tokenVerificationStatus.valid ? '✅' : '❌'}</span>
                    <strong>Signature Verification Status:</strong>{' '}
                    <span style={{ color: tokenVerificationStatus.valid ? '#34d399' : '#f87171', fontWeight: 'bold' }}>
                      {tokenVerificationStatus.valid ? 'VALID & ACTIVE' : 'INVALID / REVOKED'}
                    </span>
                  </div>
                  {tokenVerificationStatus.error && (
                    <div style={{ color: '#f87171', fontSize: '0.85rem' }}>
                      {tokenVerificationStatus.error}
                    </div>
                  )}
                  {tokenVerificationStatus.expiresInSeconds && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Expires in: {tokenVerificationStatus.expiresInSeconds} seconds
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Decoded Claims Viewer */}
            <div>
              <h3 style={{ fontSize: '1rem', marginBottom: '12px', color: '#60a5fa' }}>Decoded JWT Claims & Trust Context</h3>
              <div className="json-box">
                {decodedToken ? JSON.stringify(decodedToken, null, 2) : '// Select a user persona or run evaluation to generate active JWT.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Role Permission Matrix Manager */}
      {activeTab === 'matrix' && (
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <span>🎛️</span> Role-Based Access Control (RBAC) Permission Matrix
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Click action tags to dynamically toggle permissions per role and resource
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table matrix-table">
              <thead>
                <tr>
                  <th>Role Name</th>
                  <th>patient:records</th>
                  <th>system:config</th>
                  <th>audit:logs</th>
                  <th>policy:rules</th>
                  <th>user:credentials</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(roleMatrix).map(role => (
                  <tr key={role}>
                    <td style={{ fontWeight: 'bold', color: '#60a5fa' }}>
                      <span className="badge badge-role">{role}</span>
                    </td>
                    {['patient:records', 'system:config', 'audit:logs', 'policy:rules', 'user:credentials'].map(resource => {
                      const actions = (roleMatrix[role] && roleMatrix[role][resource]) || [];
                      const allPossible = ['READ', 'WRITE', 'DELETE', 'EXECUTE', 'ADMINISTER'];
                      return (
                        <td key={resource}>
                          <div className="action-checkbox-group">
                            {allPossible.map(act => {
                              const isActive = actions.includes(act);
                              return (
                                <span 
                                  key={act} 
                                  className={`action-tag ${isActive ? 'active' : 'inactive'}`}
                                  onClick={() => handleToggleMatrixAction(role, resource, act)}
                                >
                                  {isActive ? '✓' : '+'} {act}
                                </span>
                              );
                            })}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: Authorization Attempt Audit Logs */}
      {activeTab === 'audit' && (
        <div className="panel">
          <div className="panel-header">
            <div className="panel-title">
              <span>🛡️</span> Authorization Attempt Audit Log Table
            </div>
          </div>

          {/* Filters */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <select 
              className="form-select" 
              style={{ width: '180px' }}
              value={auditFilter.decision} 
              onChange={e => setAuditFilter({ ...auditFilter, decision: e.target.value })}
            >
              <option value="ALL">All Decisions</option>
              <option value="ALLOW">ALLOW Only</option>
              <option value="DENY">DENY Only</option>
            </select>

            <select 
              className="form-select" 
              style={{ width: '180px' }}
              value={auditFilter.role} 
              onChange={e => setAuditFilter({ ...auditFilter, role: e.target.value })}
            >
              <option value="ALL">All Roles</option>
              <option value="Admin">Admin</option>
              <option value="SecurityAnalyst">SecurityAnalyst</option>
              <option value="Doctor">Doctor</option>
              <option value="Nurse">Nurse</option>
              <option value="Guest">Guest</option>
            </select>
          </div>

          {/* Table */}
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Audit ID</th>
                  <th>Timestamp</th>
                  <th>Subject</th>
                  <th>Role</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>Score</th>
                  <th>Decision</th>
                  <th>Reason / Policy Triggered</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs
                  .filter(l => (auditFilter.decision === 'ALL' || l.decision === auditFilter.decision))
                  .filter(l => (auditFilter.role === 'ALL' || l.role === auditFilter.role))
                  .map(log => (
                    <tr key={log.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#94a3b8' }}>{log.id}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </td>
                      <td><strong>{log.subject}</strong></td>
                      <td><span className="badge badge-role">{log.role}</span></td>
                      <td><span className="badge badge-resource">{log.action}</span></td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{log.resource}</td>
                      <td>
                        <span className={`badge ${log.trustScore >= 70 ? 'badge-allow' : 'badge-deny'}`}>
                          {log.trustScore}/100
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${log.decision === 'ALLOW' ? 'badge-allow' : 'badge-deny'}`}>
                          {log.decision}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.825rem', color: 'var(--text-muted)', maxWidth: '300px' }}>
                        {log.reason}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
