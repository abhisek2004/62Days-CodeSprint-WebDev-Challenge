// E-Commerce Fraud Anomaly Inspector Script
document.addEventListener('DOMContentLoaded', () => {
  let riskScore = 28;
  let quarantinedIPs = new Set();
  let logs = [
    { time: '12:04:12', ip: '192.168.1.45', agent: 'Mozilla/5.0 (Windows)', pattern: 'Normal Checkout', score: 12, category: 'NORMAL' },
    { time: '12:04:18', ip: '45.142.120.9', agent: 'Python-requests/2.28', pattern: 'Bot Velocity Spike', score: 84, category: 'BOT' },
    { time: '12:04:22', ip: '185.220.101.4', agent: 'HeadlessChrome/109', pattern: 'Credit Carding Attempt', score: 92, category: 'CARDING' },
    { time: '12:04:30', ip: '103.21.244.2', agent: 'Mozilla/5.0 (iPhone)', pattern: 'Rapid Cart Additions', score: 65, category: 'SUSPICIOUS' }
  ];

  // Chart setup
  const ctx = document.getElementById('velocityChart').getContext('2d');
  const velocityChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['12:00', '12:01', '12:02', '12:03', '12:04', '12:05'],
      datasets: [{
        label: 'Request Velocity (req/min)',
        data: [120, 135, 140, 128, 480, 510],
        borderColor: '#38bdf8',
        backgroundColor: 'rgba(56, 189, 248, 0.15)',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } },
        x: { grid: { color: '#334155' }, ticks: { color: '#94a3b8' } }
      },
      plugins: { legend: { labels: { color: '#f8fafc' } } }
    }
  });

  // UI elements
  const gaugeFill = document.getElementById('gaugeFill');
  const riskScoreValue = document.getElementById('riskScoreValue');
  const riskBadge = document.getElementById('riskBadge');
  const logTableBody = document.getElementById('logTableBody');
  const logFilterSelect = document.getElementById('logFilterSelect');
  const simulateSpikeBtn = document.getElementById('simulateSpikeBtn');
  const quarantineCount = document.getElementById('quarantineCount');
  const selectedClusterInfo = document.getElementById('selectedClusterInfo');

  function updateGauge(score) {
    riskScoreValue.textContent = score;
    // Map score 0-100 to rotation 0 to 0.5turn
    const turn = (score / 100) * 0.5;
    gaugeFill.style.transform = `rotate(${turn}turn)`;

    if (score < 40) {
      riskBadge.textContent = 'LOW THREAT';
      riskBadge.className = 'risk-badge low';
    } else if (score < 75) {
      riskBadge.textContent = 'MEDIUM THREAT';
      riskBadge.className = 'risk-badge medium';
    } else {
      riskBadge.textContent = 'CRITICAL FRAUD ALERT';
      riskBadge.className = 'risk-badge high';
    }
  }

  function renderLogs() {
    const filter = logFilterSelect.value;
    logTableBody.innerHTML = '';

    logs.filter(item => filter === 'ALL' || item.category === filter).forEach(item => {
      const isQuarantined = quarantinedIPs.has(item.ip);
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${item.time}</td>
        <td><code>${item.ip}</code></td>
        <td>${item.agent}</td>
        <td><span class="status-tag ${item.score > 70 ? 'high' : 'low'}">${item.pattern}</span></td>
        <td><strong>${item.score}</strong></td>
        <td>
          <button class="btn ${isQuarantined ? 'btn-warning' : 'btn-danger'} btn-sm" onclick="toggleQuarantine('${item.ip}')">
            ${isQuarantined ? 'Release' : 'Quarantine'}
          </button>
        </td>
      `;
      logTableBody.appendChild(tr);
    });
  }

  window.toggleQuarantine = function(ip) {
    if (quarantinedIPs.has(ip)) {
      quarantinedIPs.delete(ip);
    } else {
      quarantinedIPs.add(ip);
    }
    quarantineCount.textContent = quarantinedIPs.size;
    renderLogs();
  };

  simulateSpikeBtn.addEventListener('click', () => {
    riskScore = Math.min(100, riskScore + 35);
    updateGauge(riskScore);
    const now = new Date().toLocaleTimeString();
    velocityChart.data.labels.push(now);
    velocityChart.data.datasets[0].data.push(950);
    velocityChart.update();

    logs.unshift({
      time: now,
      ip: '198.51.100.' + Math.floor(Math.random() * 250),
      agent: 'Headless / Automated Bot Cluster',
      pattern: 'Credential Stuffing & Rate Spike',
      score: 96,
      category: 'BOT'
    });
    renderLogs();
  });

  logFilterSelect.addEventListener('change', renderLogs);

  document.querySelectorAll('.hotspot').forEach(spot => {
    spot.addEventListener('click', (e) => {
      const loc = e.target.dataset.location;
      const threat = e.target.dataset.threat;
      selectedClusterInfo.innerHTML = `<strong>Cluster Selected:</strong> ${loc} | <strong>Threat Level:</strong> ${threat}. Flagged 14 requests in last 60s.`;
    });
  });

  updateGauge(riskScore);
  renderLogs();
});
