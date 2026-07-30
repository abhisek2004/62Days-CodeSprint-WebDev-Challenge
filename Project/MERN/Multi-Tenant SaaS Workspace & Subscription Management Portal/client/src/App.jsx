import React, { useState } from 'react';

export default function App() {
  const [orgs, setOrgs] = useState([
    { org_id: 'org_enterprise_01', name: 'Acme Corp', tier: 'ENTERPRISE', members: 42, role: 'Owner' },
    { org_id: 'org_startup_02', name: 'DevStudio Labs', tier: 'PRO_TIER', members: 5, role: 'Admin' }
  ]);
  const [activeOrg, setActiveOrg] = useState(orgs[0]);
  const [newOrgName, setNewOrgName] = useState('');
  const [tier, setTier] = useState('PRO_TIER');

  const handleCreateOrg = (e) => {
    e.preventDefault();
    if (!newOrgName) return;
    const newOrg = { org_id: `org_${Date.now()}`, name: newOrgName, tier, members: 1, role: 'Owner' };
    setOrgs([...orgs, newOrg]);
    setActiveOrg(newOrg);
    setNewOrgName('');
  };

  return (
    <div style={{ fontFamily: 'Segoe UI, sans-serif', background: '#0f172a', color: '#f8fafc', minHeight: '100vh', padding: '24px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #334155', pb: '16px', marginBottom: '24px' }}>
        <div>
          <h2 style={{ color: '#38bdf8', margin: 0 }}>🏢 Multi-Tenant SaaS Workspace & Subscription Portal</h2>
          <small style={{ color: '#94a3b8' }}>Active Workspace: <strong>{activeOrg.name}</strong> ({activeOrg.tier})</small>
        </div>
        <select onChange={e => setActiveOrg(orgs.find(o => o.org_id === e.target.value))} value={activeOrg.org_id} style={{ background: '#1e293b', color: '#fff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #334155' }}>
          {orgs.map(o => <option key={o.org_id} value={o.org_id}>Workspace: {o.name}</option>)}
        </select>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px' }}>
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
          <h3>Tenant Workspace Isolation Overview</h3>
          <p style={{ color: '#94a3b8' }}>Data schemas & RBAC permissions scoped specifically to <strong>{activeOrg.org_id}</strong>.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '20px' }}>
            <div style={{ background: '#0f172a', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Subscription Tier</span>
              <h3 style={{ color: '#38bdf8', margin: '4px 0 0' }}>{activeOrg.tier}</h3>
            </div>
            <div style={{ background: '#0f172a', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Team Members</span>
              <h3 style={{ color: '#10b981', margin: '4px 0 0' }}>{activeOrg.members}</h3>
            </div>
            <div style={{ background: '#0f172a', padding: '16px', borderRadius: '8px', border: '1px solid #334155' }}>
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Your Role</span>
              <h3 style={{ color: '#8b5cf6', margin: '4px 0 0' }}>{activeOrg.role}</h3>
            </div>
          </div>
        </div>

        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '20px' }}>
          <h3>Create Organization Workspace</h3>
          <form onSubmit={handleCreateOrg}>
            <div style={{ margin: '14px 0' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px' }}>Org / Company Name:</label>
              <input type="text" required value={newOrgName} onChange={e => setNewOrgName(e.target.value)} placeholder="e.g. Acme Tech" style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }} />
            </div>
            <div style={{ margin: '14px 0' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#94a3b8', marginBottom: '4px' }}>Plan Tier:</label>
              <select value={tier} onChange={e => setTier(e.target.value)} style={{ width: '100%', padding: '10px', background: '#0f172a', border: '1px solid #334155', color: '#fff', borderRadius: '6px' }}>
                <option value="FREE_STARTER">Free Starter ($0/mo)</option>
                <option value="PRO_TIER">Pro Business ($49/mo)</option>
                <option value="ENTERPRISE">Enterprise Scale ($299/mo)</option>
              </select>
            </div>
            <button type="submit" style={{ width: '100%', background: '#38bdf8', color: '#fff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
              Create Organization Tenant
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
