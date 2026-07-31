import React, { useState, useEffect } from 'react';

const API_BASE_URL = 'http://localhost:5000/api';

// Fallback Mock Data for instant zero-config rendering
const DEFAULT_BLUEPRINT_TEXT = JSON.stringify({
  version: "1.0",
  projectName: "Global FinTech Platform",
  environment: "production",
  resources: [
    {
      id: "aws-ec2-api-1",
      name: "API Worker Instance 1",
      provider: "aws",
      type: "ec2",
      instanceType: "m5.2xlarge",
      region: "us-east-1",
      avgCpuUtilizationPct: 4.2,
      avgRamUtilizationPct: 18.5,
      status: "active",
      layer: "Compute",
      connections: ["aws-rds-master", "aws-s3-vault"]
    },
    {
      id: "aws-ec2-api-2",
      name: "API Worker Instance 2",
      provider: "aws",
      type: "ec2",
      instanceType: "m5.2xlarge",
      region: "us-east-1",
      avgCpuUtilizationPct: 3.8,
      avgRamUtilizationPct: 19.1,
      status: "active",
      layer: "Compute",
      connections: ["aws-rds-master"]
    },
    {
      id: "aws-ebs-orphan-1",
      name: "Orphaned Legacy Backup Vol",
      provider: "aws",
      type: "ebs",
      volumeType: "gp2",
      sizeGB: 600,
      region: "us-east-1",
      status: "unattached",
      layer: "Storage",
      connections: []
    },
    {
      id: "aws-rds-master",
      name: "PostgreSQL Database Cluster",
      provider: "aws",
      type: "rds",
      instanceType: "db.r5.xlarge",
      region: "us-east-1",
      avgCpuUtilizationPct: 65.0,
      avgRamUtilizationPct: 82.0,
      status: "active",
      layer: "Database",
      connections: []
    },
    {
      id: "aws-s3-vault",
      name: "User Documents S3 Vault",
      provider: "aws",
      type: "s3",
      storageTier: "standard_gb",
      sizeGB: 15000,
      region: "us-east-1",
      accessFrequency: "rare",
      status: "active",
      layer: "Storage",
      connections: []
    },
    {
      id: "gcp-vm-analytics",
      name: "GCP Analytics Node",
      provider: "gcp",
      type: "compute",
      instanceType: "c2-standard-8",
      region: "us-central1",
      avgCpuUtilizationPct: 11.5,
      avgRamUtilizationPct: 22.0,
      status: "active",
      layer: "Compute",
      connections: ["gcp-sql-main"]
    },
    {
      id: "gcp-vm-idle-test",
      name: "Staging Test Server",
      provider: "gcp",
      type: "compute",
      instanceType: "n2-standard-4",
      region: "us-central1",
      avgCpuUtilizationPct: 0.1,
      avgRamUtilizationPct: 1.5,
      status: "idle",
      layer: "Compute",
      connections: []
    },
    {
      id: "gcp-sql-main",
      name: "Cloud SQL Analytics DB",
      provider: "gcp",
      type: "sql",
      instanceType: "db-n1-standard-2",
      region: "us-central1",
      avgCpuUtilizationPct: 48.0,
      avgRamUtilizationPct: 59.0,
      status: "active",
      layer: "Database",
      connections: []
    },
    {
      id: "azure-vm-auth",
      name: "Azure AD Sync Gateway",
      provider: "azure",
      type: "vm",
      instanceType: "D4s_v5",
      region: "eastus2",
      avgCpuUtilizationPct: 7.8,
      avgRamUtilizationPct: 20.4,
      status: "active",
      layer: "Compute",
      connections: ["azure-sql-ent"]
    },
    {
      id: "azure-disk-unattached",
      name: "Unbound Temp SSD Disk",
      provider: "azure",
      type: "disks",
      diskType: "premium_ssd_gb",
      sizeGB: 1024,
      region: "eastus2",
      status: "unattached",
      layer: "Storage",
      connections: []
    },
    {
      id: "azure-sql-ent",
      name: "Enterprise Auth DB",
      provider: "azure",
      type: "sql",
      instanceType: "P1",
      region: "eastus2",
      avgCpuUtilizationPct: 54.0,
      avgRamUtilizationPct: 71.0,
      status: "active",
      layer: "Database",
      connections: []
    }
  ]
}, null, 2);

function App() {
  const [activeTab, setActiveTab] = useState('topology');
  const [blueprintText, setBlueprintText] = useState(DEFAULT_BLUEPRINT_TEXT);
  const [analysisData, setAnalysisData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [sampleOptions, setSampleOptions] = useState({});
  const [statusMessage, setStatusMessage] = useState('');

  // Initial analysis call
  useEffect(() => {
    fetchSamples();
    handleAnalyzeBlueprint(DEFAULT_BLUEPRINT_TEXT);
  }, []);

  const fetchSamples = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/sample-blueprints`);
      if (res.ok) {
        const data = await res.json();
        if (data.samples) {
          setSampleOptions(data.samples);
        }
      }
    } catch (e) {
      console.log('Sample blueprints endpoint fallback to local defaults.');
    }
  };

  const handleAnalyzeBlueprint = async (textToParse) => {
    setLoading(true);
    setStatusMessage('');

    try {
      const res = await fetch(`${API_BASE_URL}/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: textToParse
      });

      if (res.ok) {
        const result = await res.json();
        if (result.success) {
          setAnalysisData(result.data);
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.warn('Backend API unavailable. Utilizing client-side simulation engine...');
    }

    // Client-side fallback analyzer logic if backend server is offline
    setTimeout(() => {
      try {
        const parsed = JSON.parse(textToParse);
        const simData = clientSideAnalyze(parsed);
        setAnalysisData(simData);
      } catch (err) {
        setStatusMessage('Error parsing blueprint JSON. Check syntax.');
      }
      setLoading(false);
    }, 300);
  };

  // Client-side simulation fallback
  const clientSideAnalyze = (parsed) => {
    const resources = parsed.resources || [];
    let totalMonthlyCost = 0;
    let totalWastedCost = 0;
    let totalPotentialSavings = 0;

    const providerMap = { aws: 0, gcp: 0, azure: 0 };
    const layerMap = { Compute: 0, Database: 0, Storage: 0, Serverless: 0, Other: 0 };
    const nodes = [];
    const links = [];
    const idleAlerts = [];
    const rightSizingRecs = [];

    const layerCounts = { Compute: 0, Database: 0, Storage: 0, Serverless: 0, Gateway: 0, Other: 0 };
    const layerY = { Gateway: 70, Compute: 180, Database: 320, Storage: 450, Other: 250 };

    resources.forEach((r, idx) => {
      const p = (r.provider || 'aws').toLowerCase();
      const layer = r.layer || 'Compute';
      let cost = 45.0;

      if (r.instanceType === 'm5.2xlarge') cost = 280.32;
      else if (r.instanceType === 'db.r5.xlarge') cost = 365.00;
      else if (r.instanceType === 'c2-standard-8') cost = 255.00;
      else if (r.instanceType === 'n2-standard-4') cost = 118.50;
      else if (r.instanceType === 'D4s_v5') cost = 140.16;
      else if (r.instanceType === 'P1') cost = 465.00;
      else if (r.type === 'ebs' || r.type === 'disks') cost = (r.sizeGB || 500) * 0.10;
      else if (r.type === 's3' || r.type === 'storage') cost = (r.sizeGB || 1000) * 0.023;

      cost = Math.round(cost * 100) / 100;
      providerMap[p] = (providerMap[p] || 0) + cost;
      layerMap[layer] = (layerMap[layer] || 0) + cost;
      totalMonthlyCost += cost;

      let isIdle = r.status === 'unattached' || r.status === 'idle' || (r.avgCpuUtilizationPct !== undefined && r.avgCpuUtilizationPct < 2.0);
      let isRightsize = false;

      if (isIdle) {
        totalWastedCost += cost;
        idleAlerts.push({
          id: `idle-${r.id || idx}`,
          resourceId: r.id,
          name: r.name || r.id,
          provider: p,
          type: r.type,
          monthlyCost: cost,
          reason: r.status === 'unattached' ? 'Unattached storage volume incurring idle fees' : 'CPU utilization < 2% over 30 days',
          action: 'Decommission Resource'
        });
      } else if (r.avgCpuUtilizationPct !== undefined && r.avgCpuUtilizationPct < 20) {
        isRightsize = true;
        const newCost = Math.round(cost * 0.3 * 100) / 100;
        const savings = Math.round((cost - newCost) * 100) / 100;
        totalPotentialSavings += savings;
        rightSizingRecs.push({
          id: `rs-${r.id || idx}`,
          resourceId: r.id,
          name: r.name || r.id,
          provider: p,
          type: r.type,
          currentSpec: r.instanceType || 'Standard',
          recommendedSpec: 'Downsized / Lower Tier',
          currentMonthlyCost: cost,
          newMonthlyCost: newCost,
          monthlySavings: savings,
          riskLevel: 'Low',
          reason: `Avg CPU utilization is only ${r.avgCpuUtilizationPct}%. Recommend downsizing.`
        });
      } else if (r.type === 's3' && r.accessFrequency === 'rare') {
        isRightsize = true;
        const newCost = Math.round(cost * 0.3 * 100) / 100;
        const savings = Math.round((cost - newCost) * 100) / 100;
        totalPotentialSavings += savings;
        rightSizingRecs.push({
          id: `rs-${r.id || idx}`,
          resourceId: r.id,
          name: r.name || r.id,
          provider: p,
          type: r.type,
          currentSpec: 'S3 Standard Tier',
          recommendedSpec: 'S3 Infrequent / Glacier Tier',
          currentMonthlyCost: cost,
          newMonthlyCost: newCost,
          monthlySavings: savings,
          riskLevel: 'Very Low',
          reason: 'Rare object retrieval pattern. Lifecycle rule suggested.'
        });
      }

      const countInLayer = layerCounts[layer] || 0;
      layerCounts[layer] = countInLayer + 1;
      const xPos = 120 + (countInLayer * 220);
      const yPos = layerY[layer] || 250;

      nodes.push({
        id: r.id || `node-${idx}`,
        name: r.name || r.id,
        provider: p,
        type: r.type,
        spec: r.instanceType || r.storageTier || `${r.sizeGB || 0} GB`,
        layer,
        monthlyCost: cost,
        status: isIdle ? 'idle' : isRightsize ? 'rightsize' : 'optimal',
        x: xPos,
        y: yPos,
        raw: r
      });

      if (Array.isArray(r.connections)) {
        r.connections.forEach(tId => {
          links.push({ source: r.id, target: tId });
        });
      }
    });

    const totalSave = totalWastedCost + totalPotentialSavings;

    return {
      summary: {
        totalResources: resources.length,
        totalMonthlyCost: Math.round(totalMonthlyCost * 100) / 100,
        annualCost: Math.round(totalMonthlyCost * 12 * 100) / 100,
        totalWastedCost: Math.round(totalWastedCost * 100) / 100,
        totalPotentialSavings: Math.round(totalSave * 100) / 100,
        potentialAnnualSavings: Math.round(totalSave * 12 * 100) / 100,
        optimizedMonthlyCost: Math.round(Math.max(0, totalMonthlyCost - totalSave) * 100) / 100,
        optimizationPercentage: totalMonthlyCost > 0 ? Math.round((totalSave / totalMonthlyCost) * 100) : 0
      },
      providerBreakdown: {
        aws: Math.round((providerMap.aws || 0) * 100) / 100,
        gcp: Math.round((providerMap.gcp || 0) * 100) / 100,
        azure: Math.round((providerMap.azure || 0) * 100) / 100
      },
      layerBreakdown: layerMap,
      unifiedComparison: {
        aws: Math.round(totalMonthlyCost * 0.96),
        gcp: Math.round(totalMonthlyCost * 0.88),
        azure: Math.round(totalMonthlyCost * 0.94)
      },
      topology: { nodes, links },
      idleAlerts,
      rightSizingRecs
    };
  };

  const handleSampleChange = (e) => {
    const key = e.target.value;
    if (sampleOptions[key] && sampleOptions[key].blueprint) {
      const formatted = JSON.stringify(sampleOptions[key].blueprint, null, 2);
      setBlueprintText(formatted);
      handleAnalyzeBlueprint(formatted);
    }
  };

  const handleExportReport = async (format = 'markdown') => {
    if (!analysisData) return;

    try {
      const res = await fetch(`${API_BASE_URL}/export-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysisData, format })
      });

      if (res.ok) {
        const textContent = await res.text();
        downloadBlob(textContent, `Cloud_Audit_Report_${Date.now()}.txt`);
        return;
      }
    } catch (e) {
      console.log('Using browser export fallback...');
    }

    // Browser fallback download
    const s = analysisData.summary || {};
    const reportStr = `CLOUD ARCHITECTURE COST & TOPOLOGY AUDIT REPORT
===================================================
Total Resources: ${s.totalResources}
Current Monthly Spend: $${s.totalMonthlyCost}
Projected Annual Spend: $${s.annualCost}
Wasted Monthly Spend: $${s.totalWastedCost}
Total Potential Savings: $${s.totalPotentialSavings}/mo (${s.optimizationPercentage}% cost reduction)

IDLE RESOURCE ALERTS:
${(analysisData.idleAlerts || []).map(a => `- [${a.provider.toUpperCase()}] ${a.name} ($${a.monthlyCost}/mo): ${a.reason}`).join('\n')}

RIGHT-SIZING RECOMMENDATIONS:
${(analysisData.rightSizingRecs || []).map(r => `- [${r.provider.toUpperCase()}] ${r.name}: Downsize ${r.currentSpec} -> ${r.recommendedSpec} (Save $${r.monthlySavings}/mo)`).join('\n')}
`;
    downloadBlob(reportStr, `Cloud_Audit_Report_${Date.now()}.txt`);
  };

  const downloadBlob = (content, filename) => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const summary = analysisData ? analysisData.summary : {};
  const providerCost = analysisData ? analysisData.providerBreakdown : { aws: 0, gcp: 0, azure: 0 };
  const nodes = (analysisData && analysisData.topology) ? analysisData.topology.nodes : [];
  const links = (analysisData && analysisData.topology) ? analysisData.topology.links : [];

  return (
    <div className="app-container">
      {/* HEADER NAVBAR */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17.5 19.5a4.5 4.5 0 0 0 2.5-8.5a6 6 0 0 0-11.5-1.5a5 5 0 0 0-4 4.5a4.5 4.5 0 0 0 4.5 4.5h8.5z"/>
            </svg>
          </div>
          <div className="brand-title">
            <h1>Multi-Cloud Cost & Topology Analyzer</h1>
            <p>AWS • GCP • Azure Blueprint Parsing, Idle Detection & Right-Sizing</p>
          </div>
        </div>

        <div className="header-actions">
          <div className="cloud-badge-group">
            <span className="cloud-badge aws">AWS Active</span>
            <span className="cloud-badge gcp">GCP Active</span>
            <span className="cloud-badge azure">Azure Active</span>
          </div>

          <select className="sample-select" onChange={handleSampleChange} defaultValue="">
            <option value="" disabled>Load Sample Blueprint...</option>
            <option value="enterprise_multicloud">Global Enterprise Multi-Cloud</option>
            <option value="aws_startup_stack">AWS Startup Microservices</option>
          </select>

          <button className="btn btn-secondary" onClick={() => handleExportReport('text')}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>
            </svg>
            Export Report
          </button>
        </div>
      </header>

      {/* KPI METRIC CARDS */}
      <section className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-info">
            <h3>Monthly Cost Projection</h3>
            <div className="kpi-value">${summary.totalMonthlyCost ? summary.totalMonthlyCost.toLocaleString() : '0'}</div>
            <div className="kpi-subtext">Annual: ${(summary.annualCost || 0).toLocaleString()}</div>
          </div>
          <div className="kpi-icon-box">
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
        </div>

        <div className="kpi-card wasted">
          <div className="kpi-info">
            <h3>Idle / Wasted Monthly Spend</h3>
            <div className="kpi-value" style={{ color: '#ef4444' }}>
              ${summary.totalWastedCost ? summary.totalWastedCost.toLocaleString() : '0'}
            </div>
            <div className="kpi-subtext highlight-red">
              {(analysisData?.idleAlerts || []).length} Idle Resources Detected
            </div>
          </div>
          <div className="kpi-icon-box" style={{ color: '#ef4444' }}>
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
          </div>
        </div>

        <div className="kpi-card savings">
          <div className="kpi-info">
            <h3>Potential Monthly Savings</h3>
            <div className="kpi-value" style={{ color: '#10b981' }}>
              ${summary.totalPotentialSavings ? summary.totalPotentialSavings.toLocaleString() : '0'}
            </div>
            <div className="kpi-subtext highlight-green">
              {summary.optimizationPercentage || 0}% Total Cost Reduction
            </div>
          </div>
          <div className="kpi-icon-box" style={{ color: '#10b981' }}>
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
            </svg>
          </div>
        </div>

        <div className="kpi-card resources">
          <div className="kpi-info">
            <h3>Active Resources</h3>
            <div className="kpi-value">{summary.totalResources || 0}</div>
            <div className="kpi-subtext">Across AWS, GCP & Azure</div>
          </div>
          <div className="kpi-icon-box" style={{ color: '#a855f7' }}>
            <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
              <line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
            </svg>
          </div>
        </div>
      </section>

      {/* NAVIGATION TABS */}
      <nav className="tabs-navigation">
        <button
          className={`tab-btn ${activeTab === 'topology' ? 'active' : ''}`}
          onClick={() => setActiveTab('topology')}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          Architecture Topology Canvas
        </button>

        <button
          className={`tab-btn ${activeTab === 'cost' ? 'active' : ''}`}
          onClick={() => setActiveTab('cost')}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M18 20V10M12 20V4M6 20v-6"/>
          </svg>
          Cost Breakdown & Multi-Cloud Matrix
        </button>

        <button
          className={`tab-btn ${activeTab === 'idle' ? 'active' : ''}`}
          onClick={() => setActiveTab('idle')}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          Idle & Wasted Resources
          {(analysisData?.idleAlerts || []).length > 0 && (
            <span className="tab-badge">{analysisData.idleAlerts.length}</span>
          )}
        </button>

        <button
          className={`tab-btn ${activeTab === 'rightsize' ? 'active' : ''}`}
          onClick={() => setActiveTab('rightsize')}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/>
            <polyline points="8 21 3 21 3 16"/>
          </svg>
          Right-Sizing Engine
          {(analysisData?.rightSizingRecs || []).length > 0 && (
            <span className="tab-badge green">{analysisData.rightSizingRecs.length}</span>
          )}
        </button>

        <button
          className={`tab-btn ${activeTab === 'editor' ? 'active' : ''}`}
          onClick={() => setActiveTab('editor')}
        >
          <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
          </svg>
          Blueprint Editor & Parser
        </button>
      </nav>

      {/* MAIN VIEW CONTENT */}
      <main className="main-card">
        {/* TAB 1: TOPOLOGY GRAPH */}
        {activeTab === 'topology' && (
          <div>
            <div className="card-title">
              <span>Infrastructure Topology Map</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Click any node for spec & cost diagnostics</span>
            </div>
            <p className="card-subtitle">Visual multi-cloud hierarchy (Gateway, Compute, Database, Storage) with active connection paths.</p>

            <div className="topology-container">
              <div className="topology-legend">
                <div className="legend-item"><span className="legend-dot aws"></span> AWS</div>
                <div className="legend-item"><span className="legend-dot gcp"></span> GCP</div>
                <div className="legend-item"><span className="legend-dot azure"></span> Azure</div>
                <div className="legend-item"><span className="legend-dot idle"></span> Idle / Unattached</div>
                <div className="legend-item"><span className="legend-dot rightsize"></span> Over-provisioned</div>
              </div>

              <svg className="topology-svg" viewBox="0 0 1200 520">
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(148, 163, 184, 0.4)" />
                  </marker>
                </defs>

                {/* Layer Backdrop Labels */}
                <text x="30" y="70" fill="rgba(255,255,255,0.15)" fontSize="12" fontWeight="700">COMPUTE / APP</text>
                <text x="30" y="320" fill="rgba(255,255,255,0.15)" fontSize="12" fontWeight="700">DATABASE TIER</text>
                <text x="30" y="450" fill="rgba(255,255,255,0.15)" fontSize="12" fontWeight="700">STORAGE TIER</text>

                {/* Connection Lines */}
                {links.map((link, idx) => {
                  const sourceNode = nodes.find(n => n.id === link.source);
                  const targetNode = nodes.find(n => n.id === link.target);
                  if (!sourceNode || !targetNode) return null;

                  return (
                    <line
                      key={`link-${idx}`}
                      x1={sourceNode.x + 80}
                      y1={sourceNode.y + 25}
                      x2={targetNode.x + 80}
                      y2={targetNode.y + 25}
                      className="link-line"
                      markerEnd="url(#arrow)"
                    />
                  );
                })}

                {/* Render Nodes */}
                {nodes.map((node) => (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    className="topology-node"
                    onClick={() => setSelectedNode(node)}
                  >
                    <rect
                      width="160"
                      height="50"
                      className={`node-box ${node.provider} ${node.status}`}
                    />
                    <text x="14" y="20" className="node-title">
                      {node.name.length > 20 ? node.name.substring(0, 18) + '...' : node.name}
                    </text>
                    <text x="14" y="36" className="node-sub">
                      {node.spec} • ${node.monthlyCost}/mo
                    </text>

                    {/* Status Badge Indicator */}
                    {node.status === 'idle' && (
                      <circle cx="145" cy="15" r="5" fill="#ef4444" />
                    )}
                    {node.status === 'rightsize' && (
                      <circle cx="145" cy="15" r="5" fill="#f59e0b" />
                    )}
                  </g>
                ))}
              </svg>
            </div>
          </div>
        )}

        {/* TAB 2: COST BREAKDOWN & MULTI-CLOUD MATRIX */}
        {activeTab === 'cost' && (
          <div>
            <div className="card-title">Cost Breakdown & Multi-Cloud Provider Comparison</div>
            <p className="card-subtitle">Detailed distribution of monthly expenditure by cloud provider and service category.</p>

            <div className="cost-section-grid">
              {/* Provider Distribution */}
              <div className="cost-box">
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>Provider Expenditure Share</h3>
                <div className="provider-bar-group">
                  <div className="provider-bar-item">
                    <div className="provider-label">
                      <span style={{ color: 'var(--aws-color)' }}>AWS (Amazon Web Services)</span>
                      <span>${providerCost.aws.toLocaleString()} / mo</span>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill aws"
                        style={{ width: `${summary.totalMonthlyCost ? (providerCost.aws / summary.totalMonthlyCost) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="provider-bar-item">
                    <div className="provider-label">
                      <span style={{ color: 'var(--gcp-color)' }}>GCP (Google Cloud Platform)</span>
                      <span>${providerCost.gcp.toLocaleString()} / mo</span>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill gcp"
                        style={{ width: `${summary.totalMonthlyCost ? (providerCost.gcp / summary.totalMonthlyCost) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="provider-bar-item">
                    <div className="provider-label">
                      <span style={{ color: 'var(--azure-color)' }}>Azure (Microsoft Azure)</span>
                      <span>${providerCost.azure.toLocaleString()} / mo</span>
                    </div>
                    <div className="progress-track">
                      <div
                        className="progress-fill azure"
                        style={{ width: `${summary.totalMonthlyCost ? (providerCost.azure / summary.totalMonthlyCost) * 100 : 0}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cross-Cloud Migration Cost Matrix */}
              <div className="cost-box">
                <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>Cross-Cloud Workload Migration Projection</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Estimated monthly cost if all workloads were consolidated into a single provider.
                </p>

                <div className="custom-table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Target Cloud</th>
                        <th>Est. Monthly Total</th>
                        <th>Variance vs Current</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ color: 'var(--aws-color)', fontWeight: 600 }}>AWS Unified</td>
                        <td>${(analysisData?.unifiedComparison?.aws || summary.totalMonthlyCost).toLocaleString()}</td>
                        <td style={{ color: '#10b981' }}>- 4.2% (Volume Tier)</td>
                      </tr>
                      <tr>
                        <td style={{ color: 'var(--gcp-color)', fontWeight: 600 }}>GCP Unified</td>
                        <td>${(analysisData?.unifiedComparison?.gcp || Math.round(summary.totalMonthlyCost * 0.88)).toLocaleString()}</td>
                        <td style={{ color: '#10b981' }}>- 12.0% (SUD Discounts)</td>
                      </tr>
                      <tr>
                        <td style={{ color: 'var(--azure-color)', fontWeight: 600 }}>Azure Unified</td>
                        <td>${(analysisData?.unifiedComparison?.azure || Math.round(summary.totalMonthlyCost * 0.94)).toLocaleString()}</td>
                        <td style={{ color: '#10b981' }}>- 6.0% (AHB Benefit)</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: IDLE & WASTED RESOURCES */}
        {activeTab === 'idle' && (
          <div>
            <div className="card-title">Idle & Orphaned Resource Alerts</div>
            <p className="card-subtitle">Resources detected with zero utilization or unattached persistent storage fees.</p>

            {(analysisData?.idleAlerts || []).length === 0 ? (
              <div className="empty-state">
                <p>No idle or wasted resources detected in this blueprint.</p>
              </div>
            ) : (
              <div className="custom-table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Provider</th>
                      <th>Resource Name</th>
                      <th>Type</th>
                      <th>Monthly Wasted Fee</th>
                      <th>Detection Reason</th>
                      <th>Recommended Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysisData.idleAlerts.map((alert) => (
                      <tr key={alert.id}>
                        <td>
                          <span className={`cloud-badge ${alert.provider}`}>{alert.provider.toUpperCase()}</span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{alert.name}</td>
                        <td>{alert.type}</td>
                        <td style={{ color: '#ef4444', fontWeight: 700 }}>${alert.monthlyCost} / mo</td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{alert.reason}</td>
                        <td>
                          <span className="badge badge-danger">{alert.action}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: RIGHT-SIZING RECOMMENDATIONS */}
        {activeTab === 'rightsize' && (
          <div>
            <div className="card-title">Right-Sizing & Lifecycle Optimization Engine</div>
            <p className="card-subtitle">Over-provisioned specs and storage tiering opportunities to reduce spend without compromising uptime.</p>

            {(analysisData?.rightSizingRecs || []).length === 0 ? (
              <div className="empty-state">
                <p>All active resources are optimal for current traffic patterns.</p>
              </div>
            ) : (
              <div className="custom-table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Provider</th>
                      <th>Resource</th>
                      <th>Current Spec</th>
                      <th>Recommended Spec</th>
                      <th>Monthly Savings</th>
                      <th>Risk Level</th>
                      <th>Rationale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysisData.rightSizingRecs.map((rec) => (
                      <tr key={rec.id}>
                        <td>
                          <span className={`cloud-badge ${rec.provider}`}>{rec.provider.toUpperCase()}</span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{rec.name}</td>
                        <td style={{ color: '#f87171' }}>{rec.currentSpec} (${rec.currentMonthlyCost}/mo)</td>
                        <td style={{ color: '#34d399', fontWeight: 600 }}>{rec.recommendedSpec} (${rec.newMonthlyCost}/mo)</td>
                        <td style={{ color: '#10b981', fontWeight: 700 }}>+${rec.monthlySavings} / mo</td>
                        <td>
                          <span className="badge badge-success">{rec.riskLevel} Risk</span>
                        </td>
                        <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{rec.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: BLUEPRINT EDITOR & PARSER */}
        {activeTab === 'editor' && (
          <div className="editor-container">
            <div className="card-title">
              <span>Cloud Infrastructure Blueprint JSON / YAML</span>
              <button
                className="btn btn-primary"
                onClick={() => handleAnalyzeBlueprint(blueprintText)}
                disabled={loading}
              >
                {loading ? 'Analyzing Blueprint...' : 'Re-Analyze Blueprint'}
              </button>
            </div>
            <p className="card-subtitle">Edit infrastructure resource definitions directly to calculate live cost impacts and graph updates.</p>

            {statusMessage && (
              <div style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '8px' }}>{statusMessage}</div>
            )}

            <textarea
              className="code-textarea"
              value={blueprintText}
              onChange={(e) => setBlueprintText(e.target.value)}
              spellCheck="false"
            />
          </div>
        )}
      </main>

      {/* NODE INSPECTOR MODAL */}
      {selectedNode && (
        <div className="modal-overlay" onClick={() => setSelectedNode(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedNode.name}</h3>
              <button className="close-btn" onClick={() => setSelectedNode(null)}>&times;</button>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <span className={`cloud-badge ${selectedNode.provider}`}>{selectedNode.provider.toUpperCase()}</span>
              <span className="badge badge-warning">{selectedNode.layer} Tier</span>
            </div>

            <div>
              <div className="modal-detail-row">
                <span>Resource ID</span>
                <span>{selectedNode.id}</span>
              </div>
              <div className="modal-detail-row">
                <span>Instance Spec / Type</span>
                <span>{selectedNode.spec}</span>
              </div>
              <div className="modal-detail-row">
                <span>Estimated Monthly Cost</span>
                <span style={{ fontWeight: 700, color: 'var(--accent-cyan)' }}>${selectedNode.monthlyCost} / month</span>
              </div>
              {selectedNode.raw?.avgCpuUtilizationPct !== undefined && (
                <div className="modal-detail-row">
                  <span>Avg CPU Utilization</span>
                  <span>{selectedNode.raw.avgCpuUtilizationPct}%</span>
                </div>
              )}
              {selectedNode.raw?.avgRamUtilizationPct !== undefined && (
                <div className="modal-detail-row">
                  <span>Avg RAM Utilization</span>
                  <span>{selectedNode.raw.avgRamUtilizationPct}%</span>
                </div>
              )}
              <div className="modal-detail-row">
                <span>Health / Optimization Status</span>
                <span style={{
                  color: selectedNode.status === 'idle' ? '#ef4444' : selectedNode.status === 'rightsize' ? '#f59e0b' : '#10b981',
                  fontWeight: 700
                }}>
                  {selectedNode.status.toUpperCase()}
                </span>
              </div>
            </div>

            <button className="btn btn-secondary" style={{ marginTop: '12px' }} onClick={() => setSelectedNode(null)}>
              Close Diagnostics
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
