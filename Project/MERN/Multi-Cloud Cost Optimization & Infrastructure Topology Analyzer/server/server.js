const express = require('express');
const cors = require('cors');
const yaml = require('js-yaml');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.text({ limit: '10mb' }));

// Benchmark Pricing Database (Monthly estimate in USD)
const PRICING_DB = {
  aws: {
    ec2: {
      't3.micro': 7.60,
      't3.small': 15.20,
      't3.medium': 30.40,
      't3.large': 60.80,
      't3.xlarge': 121.60,
      't3.2xlarge': 243.20,
      'c5.large': 62.00,
      'c5.xlarge': 124.00,
      'm5.large': 70.08,
      'm5.xlarge': 140.16,
      'm5.2xlarge': 280.32,
      'r5.large': 91.98,
      'r5.xlarge': 183.96
    },
    s3: {
      'standard_gb': 0.023,
      'infrequent_access_gb': 0.0125,
      'glacier_gb': 0.004
    },
    rds: {
      'db.t3.micro': 12.40,
      'db.t3.medium': 49.60,
      'db.m5.large': 138.70,
      'db.r5.xlarge': 365.00
    },
    lambda: {
      'request_million': 0.20,
      'gb_second': 0.0000166667
    },
    ebs: {
      'gp2_gb': 0.10,
      'gp3_gb': 0.08,
      'io2_gb': 0.125
    }
  },
  gcp: {
    compute: {
      'e2-micro': 6.11,
      'e2-small': 12.23,
      'e2-medium': 24.45,
      'e2-standard-2': 48.91,
      'e2-standard-4': 97.82,
      'n2-standard-4': 118.50,
      'c2-standard-8': 255.00
    },
    storage: {
      'standard_gb': 0.020,
      'nearline_gb': 0.010,
      'coldline_gb': 0.004
    },
    sql: {
      'db-f1-micro': 9.50,
      'db-n1-standard-1': 55.00,
      'db-n1-standard-2': 110.00
    },
    functions: {
      'request_million': 0.40
    }
  },
  azure: {
    vm: {
      'B1s': 7.59,
      'B2s': 30.37,
      'B2ms': 60.74,
      'D2s_v5': 70.08,
      'D4s_v5': 140.16,
      'E4s_v5': 183.96
    },
    storage: {
      'hot_gb': 0.018,
      'cool_gb': 0.010,
      'archive_gb': 0.002
    },
    sql: {
      'S0': 15.00,
      'S1': 30.00,
      'P1': 465.00
    },
    disks: {
      'standard_ssd_gb': 0.075,
      'premium_ssd_gb': 0.135
    }
  }
};

// Default Blueprint Samples
const SAMPLE_BLUEPRINTS = {
  enterprise_multicloud: {
    id: 'sample-enterprise-multicloud',
    name: 'Global Enterprise Multi-Cloud Architecture',
    description: 'Production infrastructure across AWS, GCP, and Azure with web tiers, databases, serverless, and storage.',
    blueprint: {
      version: '1.0',
      projectName: 'Global FinTech Core',
      environment: 'production',
      resources: [
        {
          id: 'aws-ec2-api-1',
          name: 'API Gateway Worker 1',
          provider: 'aws',
          type: 'ec2',
          instanceType: 'm5.2xlarge',
          region: 'us-east-1',
          avgCpuUtilizationPct: 4.2,
          avgRamUtilizationPct: 18.5,
          status: 'active',
          layer: 'Compute',
          connections: ['aws-rds-master', 'aws-s3-media']
        },
        {
          id: 'aws-ec2-api-2',
          name: 'API Gateway Worker 2',
          provider: 'aws',
          type: 'ec2',
          instanceType: 'm5.2xlarge',
          region: 'us-east-1',
          avgCpuUtilizationPct: 3.8,
          avgRamUtilizationPct: 19.1,
          status: 'active',
          layer: 'Compute',
          connections: ['aws-rds-master']
        },
        {
          id: 'aws-ebs-backup-old',
          name: 'Orphaned Legacy Volume',
          provider: 'aws',
          type: 'ebs',
          volumeType: 'gp2',
          sizeGB: 500,
          region: 'us-east-1',
          status: 'unattached',
          layer: 'Storage',
          connections: []
        },
        {
          id: 'aws-rds-master',
          name: 'Core RDS Postgres Master',
          provider: 'aws',
          type: 'rds',
          instanceType: 'db.r5.xlarge',
          region: 'us-east-1',
          avgCpuUtilizationPct: 62.0,
          avgRamUtilizationPct: 78.0,
          status: 'active',
          layer: 'Database',
          connections: []
        },
        {
          id: 'aws-s3-media',
          name: 'User Document Vault',
          provider: 'aws',
          type: 's3',
          storageTier: 'standard_gb',
          sizeGB: 12500,
          region: 'us-east-1',
          accessFrequency: 'low',
          status: 'active',
          layer: 'Storage',
          connections: []
        },
        {
          id: 'gcp-vm-analytics-1',
          name: 'GCP Analytics Node A',
          provider: 'gcp',
          type: 'compute',
          instanceType: 'c2-standard-8',
          region: 'us-central1',
          avgCpuUtilizationPct: 12.0,
          avgRamUtilizationPct: 24.0,
          status: 'active',
          layer: 'Compute',
          connections: ['gcp-sql-warehouse']
        },
        {
          id: 'gcp-vm-stale-test',
          name: 'Dev Staging Test VM',
          provider: 'gcp',
          type: 'compute',
          instanceType: 'n2-standard-4',
          region: 'us-central1',
          avgCpuUtilizationPct: 0.2,
          avgRamUtilizationPct: 2.1,
          status: 'idle',
          layer: 'Compute',
          connections: []
        },
        {
          id: 'gcp-sql-warehouse',
          name: 'BigQuery SQL Connector',
          provider: 'gcp',
          type: 'sql',
          instanceType: 'db-n1-standard-2',
          region: 'us-central1',
          avgCpuUtilizationPct: 45.0,
          avgRamUtilizationPct: 60.0,
          status: 'active',
          layer: 'Database',
          connections: ['gcp-storage-logs']
        },
        {
          id: 'gcp-storage-logs',
          name: 'Audit Logs Storage',
          provider: 'gcp',
          type: 'storage',
          storageTier: 'standard_gb',
          sizeGB: 8500,
          region: 'us-central1',
          accessFrequency: 'rare',
          status: 'active',
          layer: 'Storage',
          connections: []
        },
        {
          id: 'azure-vm-auth-1',
          name: 'Azure Active Directory Sync',
          provider: 'azure',
          type: 'vm',
          instanceType: 'D4s_v5',
          region: 'eastus2',
          avgCpuUtilizationPct: 8.5,
          avgRamUtilizationPct: 22.0,
          status: 'active',
          layer: 'Compute',
          connections: ['azure-sql-users']
        },
        {
          id: 'azure-disk-unbound',
          name: 'Unattached Temp SSD Disk',
          provider: 'azure',
          type: 'disks',
          diskType: 'premium_ssd_gb',
          sizeGB: 1024,
          region: 'eastus2',
          status: 'unattached',
          layer: 'Storage',
          connections: []
        },
        {
          id: 'azure-sql-users',
          name: 'Azure Enterprise User DB',
          provider: 'azure',
          type: 'sql',
          instanceType: 'P1',
          region: 'eastus2',
          avgCpuUtilizationPct: 52.0,
          avgRamUtilizationPct: 64.0,
          status: 'active',
          layer: 'Database',
          connections: []
        },
        {
          id: 'aws-lambda-auth',
          name: 'Token Authorizer Lambda',
          provider: 'aws',
          type: 'lambda',
          monthlyRequestsMillions: 4.5,
          avgDurationMs: 120,
          allocatedRamMB: 512,
          region: 'us-east-1',
          status: 'active',
          layer: 'Serverless',
          connections: ['aws-rds-master']
        }
      ]
    }
  },
  aws_startup_stack: {
    id: 'sample-aws-startup',
    name: 'AWS Cloud Native Startup Stack',
    description: 'Modern microservices deployment on AWS with serverless, containerized workloads, and RDS.',
    blueprint: {
      version: '1.0',
      projectName: 'SaaS AI Platform',
      environment: 'production',
      resources: [
        {
          id: 'aws-ec2-app-1',
          name: 'Application Web Server 1',
          provider: 'aws',
          type: 'ec2',
          instanceType: 't3.2xlarge',
          region: 'us-west-2',
          avgCpuUtilizationPct: 7.5,
          avgRamUtilizationPct: 22.0,
          status: 'active',
          layer: 'Compute',
          connections: ['aws-rds-prod']
        },
        {
          id: 'aws-ec2-app-2',
          name: 'Application Web Server 2',
          provider: 'aws',
          type: 'ec2',
          instanceType: 't3.2xlarge',
          region: 'us-west-2',
          avgCpuUtilizationPct: 6.8,
          avgRamUtilizationPct: 21.5,
          status: 'active',
          layer: 'Compute',
          connections: ['aws-rds-prod']
        },
        {
          id: 'aws-ebs-orphan-1',
          name: 'Old Log Backup Volume',
          provider: 'aws',
          type: 'ebs',
          volumeType: 'gp2',
          sizeGB: 1000,
          region: 'us-west-2',
          status: 'unattached',
          layer: 'Storage',
          connections: []
        },
        {
          id: 'aws-rds-prod',
          name: 'Production PostgreSQL Cluster',
          provider: 'aws',
          type: 'rds',
          instanceType: 'db.m5.large',
          region: 'us-west-2',
          avgCpuUtilizationPct: 58.0,
          avgRamUtilizationPct: 72.0,
          status: 'active',
          layer: 'Database',
          connections: []
        },
        {
          id: 'aws-s3-rawdata',
          name: 'Raw Ingestion Bucket',
          provider: 'aws',
          type: 's3',
          storageTier: 'standard_gb',
          sizeGB: 25000,
          region: 'us-west-2',
          accessFrequency: 'infrequent',
          status: 'active',
          layer: 'Storage',
          connections: []
        }
      ]
    }
  }
};

// Helper: Calculate resource cost
function calculateResourceCost(res) {
  const provider = (res.provider || 'aws').toLowerCase();
  const type = (res.type || '').toLowerCase();
  let monthlyCost = 0;

  try {
    if (provider === 'aws') {
      if (type === 'ec2') {
        const rate = PRICING_DB.aws.ec2[res.instanceType] || 50.0;
        monthlyCost = rate;
      } else if (type === 'rds') {
        const rate = PRICING_DB.aws.rds[res.instanceType] || 100.0;
        monthlyCost = rate;
      } else if (type === 's3') {
        const rate = PRICING_DB.aws.s3[res.storageTier] || PRICING_DB.aws.s3.standard_gb;
        monthlyCost = (res.sizeGB || 100) * rate;
      } else if (type === 'ebs') {
        const rate = PRICING_DB.aws.ebs[res.volumeType] || PRICING_DB.aws.ebs.gp2_gb;
        monthlyCost = (res.sizeGB || 100) * rate;
      } else if (type === 'lambda') {
        const reqMillions = res.monthlyRequestsMillions || 1.0;
        const duration = res.avgDurationMs || 100;
        const ramGB = (res.allocatedRamMB || 512) / 1024;
        const computeSec = reqMillions * 1000000 * (duration / 1000) * ramGB;
        monthlyCost = (reqMillions * PRICING_DB.aws.lambda.request_million) + (computeSec * PRICING_DB.aws.lambda.gb_second);
      } else {
        monthlyCost = 35.0; // fallback standard unit
      }
    } else if (provider === 'gcp') {
      if (type === 'compute') {
        monthlyCost = PRICING_DB.gcp.compute[res.instanceType] || 45.0;
      } else if (type === 'sql') {
        monthlyCost = PRICING_DB.gcp.sql[res.instanceType] || 60.0;
      } else if (type === 'storage') {
        const rate = PRICING_DB.gcp.storage[res.storageTier] || PRICING_DB.gcp.storage.standard_gb;
        monthlyCost = (res.sizeGB || 100) * rate;
      } else {
        monthlyCost = 30.0;
      }
    } else if (provider === 'azure') {
      if (type === 'vm') {
        monthlyCost = PRICING_DB.azure.vm[res.instanceType] || 55.0;
      } else if (type === 'sql') {
        monthlyCost = PRICING_DB.azure.sql[res.instanceType] || 90.0;
      } else if (type === 'storage') {
        const rate = PRICING_DB.azure.storage[res.storageTier] || PRICING_DB.azure.storage.hot_gb;
        monthlyCost = (res.sizeGB || 100) * rate;
      } else if (type === 'disks') {
        const rate = PRICING_DB.azure.disks[res.diskType] || PRICING_DB.azure.disks.standard_ssd_gb;
        monthlyCost = (res.sizeGB || 100) * rate;
      } else {
        monthlyCost = 40.0;
      }
    }
  } catch (err) {
    monthlyCost = 25.0;
  }

  return Math.round(monthlyCost * 100) / 100;
}

// Helper: Right-sizing evaluation map
const RIGHTSIZING_RULES = {
  aws: {
    ec2: {
      'm5.2xlarge': { target: 't3.medium', ratio: 0.15 },
      't3.2xlarge': { target: 't3.medium', ratio: 0.15 },
      'c5.xlarge': { target: 'c5.large', ratio: 0.50 },
      't3.large': { target: 't3.small', ratio: 0.25 }
    },
    s3: {
      'standard_gb': { targetTier: 'infrequent_access_gb', ratio: 0.55 }
    }
  },
  gcp: {
    compute: {
      'c2-standard-8': { target: 'e2-standard-2', ratio: 0.20 },
      'n2-standard-4': { target: 'e2-medium', ratio: 0.25 }
    },
    storage: {
      'standard_gb': { targetTier: 'nearline_gb', ratio: 0.50 }
    }
  },
  azure: {
    vm: {
      'D4s_v5': { target: 'B2ms', ratio: 0.43 }
    }
  }
};

// Analysis Core Engine
function analyzeInfrastructureBlueprint(parsedData) {
  let resources = [];

  if (Array.isArray(parsedData)) {
    resources = parsedData;
  } else if (parsedData && Array.isArray(parsedData.resources)) {
    resources = parsedData.resources;
  } else if (parsedData && parsedData.infrastructure) {
    resources = Array.isArray(parsedData.infrastructure) ? parsedData.infrastructure : [];
  }

  let totalMonthlyCost = 0;
  let totalWastedCost = 0;
  let totalPotentialSavings = 0;
  
  const providerCostMap = { aws: 0, gcp: 0, azure: 0 };
  const layerCostMap = { Compute: 0, Storage: 0, Database: 0, Serverless: 0, Other: 0 };

  const processedResources = [];
  const idleAlerts = [];
  const rightSizingRecs = [];
  const topologyNodes = [];
  const topologyLinks = [];

  // Determine topology layout clusters
  const layerYPositions = {
    'Gateway': 60,
    'Frontend': 120,
    'Compute': 220,
    'Serverless': 220,
    'Database': 340,
    'Storage': 450,
    'Other': 300
  };

  const layerCounts = { Compute: 0, Storage: 0, Database: 0, Serverless: 0, Gateway: 0, Frontend: 0, Other: 0 };

  resources.forEach((res, index) => {
    const provider = (res.provider || 'aws').toLowerCase();
    const layer = res.layer || 'Compute';
    const monthlyCost = calculateResourceCost(res);
    
    providerCostMap[provider] = (providerCostMap[provider] || 0) + monthlyCost;
    layerCostMap[layer] = (layerCostMap[layer] || 0) + monthlyCost;
    totalMonthlyCost += monthlyCost;

    let isIdle = false;
    let idleReason = '';
    let isRightsizeCandidate = false;
    let rightSizeInfo = null;

    // Check Idle Condition
    if (res.status === 'unattached' || res.status === 'idle') {
      isIdle = true;
      idleReason = res.status === 'unattached' ? 'Unattached volume/disk consuming persistent storage fees' : 'Instance idle with < 2% CPU utilization over 30 days';
    } else if (res.avgCpuUtilizationPct !== undefined && res.avgCpuUtilizationPct < 3.0) {
      isIdle = true;
      idleReason = `Critically underutilized CPU (${res.avgCpuUtilizationPct}%) over extended period`;
    }

    if (isIdle) {
      totalWastedCost += monthlyCost;
      idleAlerts.push({
        id: `idle-${res.id || index}`,
        resourceId: res.id,
        name: res.name || res.id,
        provider,
        type: res.type,
        monthlyCost,
        reason: idleReason,
        action: 'Terminate / Delete Resource',
        potentialSavings: monthlyCost
      });
    }

    // Check Right-sizing Condition (if active and not idle)
    if (!isIdle) {
      const pRules = RIGHTSIZING_RULES[provider] && RIGHTSIZING_RULES[provider][res.type];
      
      // Case 1: Compute VM over-provisioned
      if (pRules && pRules[res.instanceType] && res.avgCpuUtilizationPct !== undefined && res.avgCpuUtilizationPct < 20) {
        const rule = pRules[res.instanceType];
        const newCost = Math.round(monthlyCost * rule.ratio * 100) / 100;
        const monthlySavings = Math.round((monthlyCost - newCost) * 100) / 100;
        
        isRightsizeCandidate = true;
        rightSizeInfo = {
          currentType: res.instanceType,
          recommendedType: rule.target,
          currentCost: monthlyCost,
          recommendedCost: newCost,
          monthlySavings,
          reason: `CPU utilization averages ${res.avgCpuUtilizationPct}%. Downsize to ${rule.target}`
        };

        totalPotentialSavings += monthlySavings;
        rightSizingRecs.push({
          id: `rs-${res.id || index}`,
          resourceId: res.id,
          name: res.name || res.id,
          provider,
          type: res.type,
          currentSpec: res.instanceType,
          recommendedSpec: rule.target,
          currentMonthlyCost: monthlyCost,
          newMonthlyCost: newCost,
          monthlySavings,
          riskLevel: 'Low',
          reason: rightSizeInfo.reason
        });
      } 
      // Case 2: Storage lifecycle tiering
      else if ((res.type === 's3' || res.type === 'storage') && res.accessFrequency === 'rare' && res.storageTier === 'standard_gb') {
        const newCost = Math.round(monthlyCost * 0.25 * 100) / 100;
        const monthlySavings = Math.round((monthlyCost - newCost) * 100) / 100;

        isRightsizeCandidate = true;
        totalPotentialSavings += monthlySavings;
        rightSizingRecs.push({
          id: `rs-${res.id || index}`,
          resourceId: res.id,
          name: res.name || res.id,
          provider,
          type: res.type,
          currentSpec: 'Standard Hot Tier',
          recommendedSpec: 'Infrequent / Glacier Tier',
          currentMonthlyCost: monthlyCost,
          newMonthlyCost: newCost,
          monthlySavings,
          riskLevel: 'Very Low',
          reason: 'Rare access pattern detected. Transition storage bucket to Cold/Glacier tier.'
        });
      }
    }

    // Node positioning for Topology Graph
    const countInLayer = layerCounts[layer] || 0;
    layerCounts[layer] = countInLayer + 1;
    const xPos = 120 + (countInLayer * 220);
    const yPos = layerYPositions[layer] || 250;

    const nodeData = {
      id: res.id || `node-${index}`,
      name: res.name || res.id || `Resource ${index + 1}`,
      provider,
      type: res.type,
      spec: res.instanceType || res.storageTier || res.volumeType || `${res.sizeGB || 0} GB`,
      layer,
      monthlyCost,
      status: isIdle ? 'idle' : isRightsizeCandidate ? 'rightsize' : 'optimal',
      x: xPos,
      y: yPos,
      raw: res
    };

    topologyNodes.push(nodeData);

    // Links/Dependencies
    if (Array.isArray(res.connections)) {
      res.connections.forEach(targetId => {
        topologyLinks.push({
          source: res.id,
          target: targetId
        });
      });
    }
  });

  // Calculate annual projections
  const annualCost = totalMonthlyCost * 12;
  const potentialAnnualSavings = (totalWastedCost + totalPotentialSavings) * 12;
  const optimizedMonthlyCost = Math.max(0, totalMonthlyCost - (totalWastedCost + totalPotentialSavings));

  // Multi-Cloud Provider Cost Comparison Simulation
  // (What would the whole workload cost if unified strictly under AWS vs GCP vs Azure?)
  const unifiedComparison = {
    aws: Math.round(totalMonthlyCost * (providerCostMap.aws > 0 ? 0.95 : 1.05)),
    gcp: Math.round(totalMonthlyCost * 0.88), // GCP avg discount
    azure: Math.round(totalMonthlyCost * 0.94)
  };

  return {
    summary: {
      totalResources: resources.length,
      totalMonthlyCost: Math.round(totalMonthlyCost * 100) / 100,
      annualCost: Math.round(annualCost * 100) / 100,
      totalWastedCost: Math.round(totalWastedCost * 100) / 100,
      totalPotentialSavings: Math.round((totalWastedCost + totalPotentialSavings) * 100) / 100,
      potentialAnnualSavings: Math.round(potentialAnnualSavings * 100) / 100,
      optimizedMonthlyCost: Math.round(optimizedMonthlyCost * 100) / 100,
      optimizationPercentage: totalMonthlyCost > 0 
        ? Math.round(((totalWastedCost + totalPotentialSavings) / totalMonthlyCost) * 100)
        : 0
    },
    providerBreakdown: {
      aws: Math.round(providerCostMap.aws * 100) / 100,
      gcp: Math.round(providerCostMap.gcp * 100) / 100,
      azure: Math.round(providerCostMap.azure * 100) / 100
    },
    layerBreakdown: layerCostMap,
    unifiedComparison,
    topology: {
      nodes: topologyNodes,
      links: topologyLinks
    },
    idleAlerts,
    rightSizingRecs
  };
}

// ROUTES

// 1. Health check & basic metadata
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Multi-Cloud Cost Optimization & Infrastructure Topology Analyzer API',
    timestamp: new Date().toISOString()
  });
});

// 2. Get sample blueprints
app.get('/api/sample-blueprints', (req, res) => {
  res.json({
    success: true,
    samples: SAMPLE_BLUEPRINTS
  });
});

// 3. Analyze Infrastructure Blueprint API (JSON or YAML)
app.post('/api/analyze', (req, res) => {
  try {
    let parsedData = null;

    if (typeof req.body === 'object' && req.body !== null) {
      parsedData = req.body;
    } else if (typeof req.body === 'string') {
      try {
        parsedData = JSON.parse(req.body);
      } catch (jsonErr) {
        try {
          parsedData = yaml.load(req.body);
        } catch (yamlErr) {
          return res.status(400).json({
            success: false,
            error: 'Failed to parse payload. Ensure valid JSON or YAML infrastructure blueprint format.'
          });
        }
      }
    }

    if (!parsedData) {
      return res.status(400).json({ success: false, error: 'Blueprint body is empty or invalid.' });
    }

    const analysisResult = analyzeInfrastructureBlueprint(parsedData);
    return res.json({
      success: true,
      analyzedAt: new Date().toISOString(),
      data: analysisResult
    });

  } catch (error) {
    console.error('Error analyzing blueprint:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error during cloud analysis.'
    });
  }
});

// 4. Export Architecture Audit Report
app.post('/api/export-report', (req, res) => {
  try {
    const { analysisData, format } = req.body;
    if (!analysisData) {
      return res.status(400).json({ success: false, error: 'Analysis data missing.' });
    }

    const summary = analysisData.summary || {};
    const reportTitle = `Cloud Architecture Cost & Topology Audit Report`;
    const generatedDate = new Date().toLocaleString();

    if (format === 'markdown' || format === 'text') {
      const reportContent = `===============================================================
${reportTitle}
Generated: ${generatedDate}
===============================================================

EXECUTIVE SUMMARY:
- Total Cloud Resources Analyzed: ${summary.totalResources || 0}
- Current Monthly Spend: $${summary.totalMonthlyCost || 0}
- Current Projected Annual Spend: $${summary.annualCost || 0}
- Detected Wasted Monthly Spend (Idle Resources): $${summary.totalWastedCost || 0}
- Total Potential Monthly Savings: $${summary.totalPotentialSavings || 0}
- Estimated Optimized Monthly Spend: $${summary.optimizedMonthlyCost || 0}
- Overall Optimization Potential: ${summary.optimizationPercentage || 0}%

PROVIDER BREAKDOWN:
- AWS: $${analysisData.providerBreakdown?.aws || 0} / mo
- GCP: $${analysisData.providerBreakdown?.gcp || 0} / mo
- Azure: $${analysisData.providerBreakdown?.azure || 0} / mo

IDLE RESOURCE ALERTS (${(analysisData.idleAlerts || []).length}):
${(analysisData.idleAlerts || []).map((a, i) => `${i+1}. [${a.provider.toUpperCase()}] ${a.name} (${a.type}) - Cost: $${a.monthlyCost}/mo | Reason: ${a.reason}`).join('\n')}

RIGHT-SIZING RECOMMENDATIONS (${(analysisData.rightSizingRecs || []).length}):
${(analysisData.rightSizingRecs || []).map((r, i) => `${i+1}. [${r.provider.toUpperCase()}] ${r.name}: ${r.currentSpec} -> ${r.recommendedSpec} (Save $${r.monthlySavings}/mo) | Reason: ${r.reason}`).join('\n')}

===============================================================
End of Executive Audit Report
`;
      res.setHeader('Content-Type', 'text/plain');
      return res.send(reportContent);
    }

    // Default JSON export
    res.json({
      success: true,
      reportTitle,
      generatedDate,
      analysis: analysisData
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Cloud Cost & Topology Analyzer Server running on port ${PORT}`);
});
