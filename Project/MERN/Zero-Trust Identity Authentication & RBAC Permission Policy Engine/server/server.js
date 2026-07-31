const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'zero-trust-super-secret-key-2026';

// Middleware
app.use(cors());
app.use(express.json());

// In-Memory Security State Databases
const revokedTokens = new Set();

let roleMatrix = {
  Admin: {
    'patient:records': ['READ', 'WRITE', 'DELETE', 'EXECUTE', 'ADMINISTER'],
    'system:config': ['READ', 'WRITE', 'DELETE', 'EXECUTE', 'ADMINISTER'],
    'audit:logs': ['READ', 'WRITE', 'DELETE', 'EXPORT'],
    'policy:rules': ['READ', 'WRITE', 'DELETE', 'EXECUTE'],
    'user:credentials': ['READ', 'WRITE', 'DELETE']
  },
  SecurityAnalyst: {
    'patient:records': ['READ'],
    'system:config': ['READ'],
    'audit:logs': ['READ', 'WRITE', 'EXPORT'],
    'policy:rules': ['READ', 'WRITE', 'EXECUTE'],
    'user:credentials': ['READ']
  },
  Doctor: {
    'patient:records': ['READ', 'WRITE', 'EXECUTE'],
    'system:config': ['READ'],
    'audit:logs': ['READ'],
    'policy:rules': ['READ'],
    'user:credentials': []
  },
  Nurse: {
    'patient:records': ['READ', 'WRITE'],
    'system:config': [],
    'audit:logs': [],
    'policy:rules': [],
    'user:credentials': []
  },
  Guest: {
    'patient:records': [],
    'system:config': [],
    'audit:logs': [],
    'policy:rules': [],
    'user:credentials': []
  }
};

let policyRules = [
  {
    id: 'POL-001',
    name: 'Deny Untrusted Device Access to Sensitive Patient Data',
    effect: 'DENY',
    roles: ['Doctor', 'Nurse', 'Guest'],
    resources: ['patient:records'],
    actions: ['DELETE', 'ADMINISTER'],
    conditions: {
      minTrustScore: 75,
      maxDeviceRisk: 'MEDIUM',
      requireMFA: true,
      workingHoursOnly: false,
      allowedIpSubnets: ['10.0.0.0/8', '192.168.1.0/24', '127.0.0.1']
    },
    description: 'Strictly deny high-privilege operations on medical records unless trust score is at least 75.'
  },
  {
    id: 'POL-002',
    name: 'Require MFA & Corporate Subnet for System Configuration',
    effect: 'ALLOW',
    roles: ['Admin', 'SecurityAnalyst'],
    resources: ['system:config', 'policy:rules'],
    actions: ['READ', 'WRITE', 'EXECUTE', 'ADMINISTER'],
    conditions: {
      minTrustScore: 80,
      maxDeviceRisk: 'LOW',
      requireMFA: true,
      workingHoursOnly: true,
      allowedIpSubnets: ['10.0.0.0/8', '192.168.1.0/24', '127.0.0.1']
    },
    description: 'Grant admin access to system config only during working hours on verified low-risk corporate endpoints.'
  },
  {
    id: 'POL-003',
    name: 'Global Emergency Read Access for Doctors',
    effect: 'ALLOW',
    roles: ['Doctor'],
    resources: ['patient:records'],
    actions: ['READ'],
    conditions: {
      minTrustScore: 40,
      maxDeviceRisk: 'HIGH',
      requireMFA: false,
      workingHoursOnly: false,
      allowedIpSubnets: []
    },
    description: 'Allow doctors emergency read access even on elevated risk devices as long as trust score >= 40.'
  },
  {
    id: 'POL-004',
    name: 'Block Untrusted Guest Sessions',
    effect: 'DENY',
    roles: ['Guest'],
    resources: ['*'],
    actions: ['*'],
    conditions: {
      minTrustScore: 50,
      maxDeviceRisk: 'MEDIUM',
      requireMFA: false,
      workingHoursOnly: false,
      allowedIpSubnets: []
    },
    description: 'Default zero-trust policy blocking guest accounts when trust score drops below 50.'
  }
];

let auditLogs = [
  {
    id: 'AUD-9021',
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    subject: 'admin_alice (Admin)',
    role: 'Admin',
    action: 'WRITE',
    resource: 'policy:rules',
    decision: 'ALLOW',
    trustScore: 92,
    trustStatus: 'EXCELLENT',
    deviceRisk: 'LOW',
    ipAddress: '10.0.4.12',
    mfaVerified: true,
    triggeredPolicy: 'POL-002',
    reason: 'RBAC Permission granted and ABAC condition checks passed (Trust score: 92 >= 80, MFA verified).'
  },
  {
    id: 'AUD-9020',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    subject: 'guest_eve (Guest)',
    role: 'Guest',
    action: 'READ',
    resource: 'patient:records',
    decision: 'DENY',
    trustScore: 35,
    trustStatus: 'UNTRUSTED',
    deviceRisk: 'CRITICAL',
    ipAddress: '198.51.100.44',
    mfaVerified: false,
    triggeredPolicy: 'POL-004',
    reason: 'Explicit Deny: Guest role lacks RBAC permission for patient:records:READ. Trust score 35 below minimum 50.'
  },
  {
    id: 'AUD-9019',
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    subject: 'doc_carol (Doctor)',
    role: 'Doctor',
    action: 'DELETE',
    resource: 'patient:records',
    decision: 'DENY',
    trustScore: 68,
    trustStatus: 'ELEVATED_RISK',
    deviceRisk: 'MEDIUM',
    ipAddress: '172.16.4.88',
    mfaVerified: true,
    triggeredPolicy: 'POL-001',
    reason: 'Policy POL-001 explicit DENY triggered: Trust score 68 is less than required minimum 75 for DELETE.'
  }
];

// Sample Personas
const sampleUsers = [
  { id: 'usr-1', username: 'admin_alice', name: 'Alice Vance', role: 'Admin', department: 'SecOps', defaultIp: '10.0.4.12', defaultDeviceRisk: 'LOW', defaultMfa: true },
  { id: 'usr-2', username: 'sec_bob', name: 'Bob Roberts', role: 'SecurityAnalyst', department: 'Compliance', defaultIp: '192.168.1.50', defaultDeviceRisk: 'LOW', defaultMfa: true },
  { id: 'usr-3', username: 'doc_carol', name: 'Dr. Carol Danvers', role: 'Doctor', department: 'Emergency Care', defaultIp: '172.16.4.88', defaultDeviceRisk: 'MEDIUM', defaultMfa: true },
  { id: 'usr-4', username: 'nurse_dan', name: 'Dan Miller', role: 'Nurse', department: 'Inpatient Care', defaultIp: '192.168.1.102', defaultDeviceRisk: 'LOW', defaultMfa: false },
  { id: 'usr-5', username: 'guest_eve', name: 'Eve Malicious', role: 'Guest', department: 'External Audit', defaultIp: '198.51.100.44', defaultDeviceRisk: 'CRITICAL', defaultMfa: false }
];

// --- Helper Utilities & Zero-Trust Engine Functions ---

function calculateTrustScore(context) {
  let score = 100;
  const deductions = [];

  // Device Risk Assessment
  const deviceRisk = (context.deviceRisk || 'LOW').toUpperCase();
  if (deviceRisk === 'MEDIUM') {
    score -= 15;
    deductions.push('Device risk level is MEDIUM (-15)');
  } else if (deviceRisk === 'HIGH') {
    score -= 35;
    deductions.push('Device risk level is HIGH (-35)');
  } else if (deviceRisk === 'CRITICAL') {
    score -= 60;
    deductions.push('Device risk level is CRITICAL (-60)');
  }

  // IP Subnet Assessment
  const ip = context.ipAddress || '127.0.0.1';
  const isCorporateSubnet = ip.startsWith('10.') || ip.startsWith('192.168.1.') || ip.startsWith('172.16.') || ip === '127.0.0.1' || ip === 'localhost';
  if (!isCorporateSubnet) {
    score -= 25;
    deductions.push('Request originating from untrusted/external IP subnet (-25)');
  }

  // MFA Verification
  if (!context.mfaVerified) {
    score -= 25;
    deductions.push('Step-up Multi-Factor Authentication (MFA) not verified (-25)');
  }

  // Time of Day Check (Working hours: 08:00 to 18:00)
  const hour = context.requestHour !== undefined ? context.requestHour : new Date().getHours();
  const isWorkingHours = hour >= 8 && hour < 18;
  if (!isWorkingHours) {
    score -= 10;
    deductions.push(`Request time (${hour}:00) is outside standard corporate working hours 08:00-18:00 (-10)`);
  }

  const finalScore = Math.max(0, Math.min(100, score));

  let trustStatus = 'UNTRUSTED';
  if (finalScore >= 85) trustStatus = 'EXCELLENT';
  else if (finalScore >= 70) trustStatus = 'TRUSTED';
  else if (finalScore >= 50) trustStatus = 'ELEVATED_RISK';

  return {
    trustScore: finalScore,
    trustStatus,
    deductions,
    isCorporateSubnet,
    isWorkingHours
  };
}

function evaluatePolicy(context) {
  const { role, action, resource } = context;
  const trustEval = calculateTrustScore(context);
  const { trustScore, isCorporateSubnet, isWorkingHours } = trustEval;

  // Step 1: RBAC Permission Matrix Check
  const rolePermissions = roleMatrix[role] || {};
  const allowedActions = rolePermissions[resource] || [];
  const hasRbacPermission = allowedActions.includes('*') || allowedActions.includes(action);

  const evaluationSteps = [
    {
      step: '1. JWT & Identity Context Validation',
      passed: true,
      detail: `Validated subject '${context.subject || role}' with role '${role}'`
    },
    {
      step: '2. Zero-Trust Dynamic Risk Scoring',
      passed: trustScore >= 50,
      detail: `Calculated Trust Score: ${trustScore}/100 (${trustEval.trustStatus}). ${trustEval.deductions.length ? 'Deductions: ' + trustEval.deductions.join('; ') : 'No risk deductions.'}`
    },
    {
      step: '3. Role-Based Access Control (RBAC) Check',
      passed: hasRbacPermission,
      detail: hasRbacPermission 
        ? `Role '${role}' has explicit RBAC permission '${action}' on resource '${resource}'`
        : `Role '${role}' DOES NOT have RBAC permission '${action}' on resource '${resource}'`
    }
  ];

  // Step 2: ABAC Policy Engine Evaluation
  let triggeredPolicy = null;
  let explicitDenyRule = null;
  let explicitAllowRule = null;

  const abacRuleBreakdown = [];

  for (const policy of policyRules) {
    // Check if policy applies to this role, resource, and action
    const roleMatches = policy.roles.includes('*') || policy.roles.includes(role);
    const resourceMatches = policy.resources.includes('*') || policy.resources.includes(resource);
    const actionMatches = policy.actions.includes('*') || policy.actions.includes(action);

    if (roleMatches && resourceMatches && actionMatches) {
      const cond = policy.conditions || {};
      let ruleConditionsMet = true;
      const failedConditions = [];

      if (cond.minTrustScore !== undefined && trustScore < cond.minTrustScore) {
        ruleConditionsMet = false;
        failedConditions.push(`Trust score ${trustScore} < min required ${cond.minTrustScore}`);
      }

      if (cond.requireMFA && !context.mfaVerified) {
        ruleConditionsMet = false;
        failedConditions.push('MFA is required but not verified');
      }

      if (cond.workingHoursOnly && !isWorkingHours) {
        ruleConditionsMet = false;
        failedConditions.push('Access restricted to corporate working hours (08:00 - 18:00)');
      }

      if (cond.allowedIpSubnets && cond.allowedIpSubnets.length > 0 && !isCorporateSubnet) {
        ruleConditionsMet = false;
        failedConditions.push(`IP ${context.ipAddress} is not in allowed subnets`);
      }

      abacRuleBreakdown.push({
        policyId: policy.id,
        policyName: policy.name,
        effect: policy.effect,
        conditionsMet: ruleConditionsMet,
        failedConditions
      });

      if (ruleConditionsMet) {
        if (policy.effect === 'DENY' && !explicitDenyRule) {
          explicitDenyRule = policy;
        } else if (policy.effect === 'ALLOW' && !explicitAllowRule) {
          explicitAllowRule = policy;
        }
      }
    }
  }

  evaluationSteps.push({
    step: '4. Attribute-Based Policy Engine (ABAC)',
    passed: !explicitDenyRule,
    detail: explicitDenyRule 
      ? `Explicit DENY rule '${explicitDenyRule.id}' matched!`
      : (explicitAllowRule ? `Matched ALLOW rule '${explicitAllowRule.id}'` : 'No matching active ABAC rules.')
  });

  // Decision Logic:
  // Explicit DENY overrules everything
  // RBAC must pass AND (no explicit DENY) AND (trustScore >= 40)
  let decision = 'DENY';
  let reason = '';

  if (explicitDenyRule) {
    decision = 'DENY';
    triggeredPolicy = explicitDenyRule.id;
    reason = `Explicit DENY Policy triggered: [${explicitDenyRule.id}] ${explicitDenyRule.name}`;
  } else if (!hasRbacPermission) {
    decision = 'DENY';
    reason = `RBAC Rejection: Role '${role}' lacks permission for '${action}' on '${resource}'.`;
  } else if (trustScore < 40) {
    decision = 'DENY';
    reason = `Zero-Trust Violation: Trust score (${trustScore}) below minimal system security baseline of 40.`;
  } else {
    decision = 'ALLOW';
    triggeredPolicy = explicitAllowRule ? explicitAllowRule.id : 'RBAC-DEFAULT';
    reason = `Access Granted: RBAC permissions validated and Zero-Trust risk assessment passed with score ${trustScore}/100.`;
  }

  // Create Audit Entry
  const auditEntry = {
    id: 'AUD-' + Math.floor(1000 + Math.random() * 9000),
    timestamp: new Date().toISOString(),
    subject: context.subject || `${role.toLowerCase()}_user`,
    role,
    action,
    resource,
    decision,
    trustScore,
    trustStatus: trustEval.trustStatus,
    deviceRisk: context.deviceRisk || 'LOW',
    ipAddress: context.ipAddress || '127.0.0.1',
    mfaVerified: !!context.mfaVerified,
    triggeredPolicy: triggeredPolicy || 'RBAC-POLICY',
    reason
  };

  auditLogs.unshift(auditEntry);
  if (auditLogs.length > 100) auditLogs.pop(); // keep last 100 logs

  return {
    decision,
    reason,
    trustEvaluation: trustEval,
    hasRbacPermission,
    triggeredPolicy,
    evaluationSteps,
    abacRuleBreakdown,
    auditEntry
  };
}

// --- REST API Endpoints ---

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'Zero-Trust Identity Authentication & RBAC Policy Engine',
    timestamp: new Date().toISOString(),
    revokedTokensCount: revokedTokens.size,
    totalPolicies: policyRules.length
  });
});

// Get Sample Users / Personas
app.get('/api/users', (req, res) => {
  res.json(sampleUsers);
});

// Authentication / Login & Issue Zero-Trust Token
app.post('/api/auth/login', (req, res) => {
  const { username, deviceRisk, ipAddress, mfaVerified } = req.body;
  const user = sampleUsers.find(u => u.username === username) || {
    id: 'usr-custom',
    username: username || 'custom_user',
    name: username || 'Custom User',
    role: 'Doctor',
    department: 'General Medical'
  };

  const context = {
    subject: user.username,
    role: user.role,
    deviceRisk: deviceRisk || user.defaultDeviceRisk || 'LOW',
    ipAddress: ipAddress || user.defaultIp || '127.0.0.1',
    mfaVerified: mfaVerified !== undefined ? mfaVerified : (user.defaultMfa || false)
  };

  const trustEval = calculateTrustScore(context);

  const payload = {
    sub: user.username,
    name: user.name,
    role: user.role,
    department: user.department,
    trustScore: trustEval.trustScore,
    trustStatus: trustEval.trustStatus,
    deviceRisk: context.deviceRisk,
    ipAddress: context.ipAddress,
    mfaVerified: context.mfaVerified,
    jti: 'jti-' + Math.random().toString(36).substr(2, 9),
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour expiration
  };

  const token = jwt.sign(payload, JWT_SECRET);

  res.json({
    token,
    payload,
    trustEvaluation: trustEval
  });
});

// Verify JWT Token & Claims
app.post('/api/auth/verify-token', (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ valid: false, error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (revokedTokens.has(decoded.jti)) {
      return res.status(401).json({
        valid: false,
        error: 'Token Revoked: JTI is listed in Revocation Blacklist',
        decoded
      });
    }

    res.json({
      valid: true,
      decoded,
      status: 'ACTIVE',
      expiresInSeconds: decoded.exp - Math.floor(Date.now() / 1000)
    });
  } catch (err) {
    res.status(401).json({
      valid: false,
      error: `Invalid JWT Signature or Expired Token: ${err.message}`
    });
  }
});

// Revoke JWT Token (Blacklist)
app.post('/api/auth/revoke-token', (req, res) => {
  const { jti } = req.body;
  if (!jti) {
    return res.status(400).json({ error: 'JTI parameter required' });
  }

  revokedTokens.add(jti);
  res.json({ success: true, message: `Token JTI ${jti} successfully added to revocation blacklist.`, jti });
});

// Policy Engine Sandbox Evaluator Endpoint
app.post('/api/policy/evaluate', (req, res) => {
  const {
    token,
    role = 'Doctor',
    action = 'READ',
    resource = 'patient:records',
    deviceRisk = 'LOW',
    ipAddress = '10.0.4.12',
    mfaVerified = true,
    requestHour,
    subject = 'user_sandbox'
  } = req.body;

  let effectiveRole = role;
  let effectiveSubject = subject;

  // If token is supplied, extract claims
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (revokedTokens.has(decoded.jti)) {
        return res.json({
          decision: 'DENY',
          reason: `Security Rejection: Token JTI '${decoded.jti}' has been REVOKED.`,
          evaluationSteps: [
            { step: '1. Token Verification', passed: false, detail: 'Token JTI found in revocation blacklist' }
          ]
        });
      }
      effectiveRole = decoded.role || role;
      effectiveSubject = decoded.sub || subject;
    } catch (err) {
      return res.json({
        decision: 'DENY',
        reason: `JWT Validation Failed: ${err.message}`,
        evaluationSteps: [
          { step: '1. Token Verification', passed: false, detail: err.message }
        ]
      });
    }
  }

  const context = {
    subject: effectiveSubject,
    role: effectiveRole,
    action,
    resource,
    deviceRisk,
    ipAddress,
    mfaVerified: Boolean(mfaVerified),
    requestHour: requestHour !== undefined ? Number(requestHour) : new Date().getHours()
  };

  const result = evaluatePolicy(context);
  res.json(result);
});

// Get ABAC/RBAC Policy Rules
app.get('/api/policy/rules', (req, res) => {
  res.json(policyRules);
});

// Add New ABAC Policy Rule
app.post('/api/policy/rules', (req, res) => {
  const { name, effect, roles, resources, actions, conditions, description } = req.body;

  if (!name || !effect || !roles || !resources || !actions) {
    return res.status(400).json({ error: 'Missing required policy fields' });
  }

  const newPolicy = {
    id: 'POL-' + String(policyRules.length + 1).padStart(3, '0'),
    name,
    effect: (effect || 'ALLOW').toUpperCase(),
    roles: Array.isArray(roles) ? roles : [roles],
    resources: Array.isArray(resources) ? resources : [resources],
    actions: Array.isArray(actions) ? actions : [actions],
    conditions: conditions || {},
    description: description || 'Custom dynamic policy rule.'
  };

  policyRules.push(newPolicy);
  res.status(201).json({ success: true, policy: newPolicy });
});

// Update Policy Rule
app.put('/api/policy/rules/:id', (req, res) => {
  const { id } = req.params;
  const index = policyRules.findIndex(p => p.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Policy rule not found' });
  }

  policyRules[index] = { ...policyRules[index], ...req.body, id };
  res.json({ success: true, policy: policyRules[index] });
});

// Delete Policy Rule
app.delete('/api/policy/rules/:id', (req, res) => {
  const { id } = req.params;
  policyRules = policyRules.filter(p => p.id !== id);
  res.json({ success: true, message: `Policy ${id} deleted successfully.` });
});

// Get Role Permission Matrix
app.get('/api/matrix', (req, res) => {
  res.json(roleMatrix);
});

// Update Role Permission Matrix
app.put('/api/matrix', (req, res) => {
  const { matrix } = req.body;
  if (!matrix) {
    return res.status(400).json({ error: 'Matrix object required' });
  }

  roleMatrix = matrix;
  res.json({ success: true, matrix: roleMatrix });
});

// Get Audit Logs
app.get('/api/audit-logs', (req, res) => {
  const { decision, role, search } = req.query;
  let filtered = [...auditLogs];

  if (decision && decision !== 'ALL') {
    filtered = filtered.filter(l => l.decision === decision);
  }

  if (role && role !== 'ALL') {
    filtered = filtered.filter(l => l.role === role);
  }

  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(l => 
      l.subject.toLowerCase().includes(q) ||
      l.resource.toLowerCase().includes(q) ||
      l.action.toLowerCase().includes(q) ||
      l.reason.toLowerCase().includes(q)
    );
  }

  res.json(filtered);
});

// Clear Audit Logs
app.post('/api/audit-logs/clear', (req, res) => {
  auditLogs = [];
  res.json({ success: true, message: 'Audit logs cleared successfully.' });
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`[Zero-Trust Policy Engine] Backend listening on port ${PORT}`);
});
