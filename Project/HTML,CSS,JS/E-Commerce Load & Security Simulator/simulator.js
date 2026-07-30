document.addEventListener('DOMContentLoaded', () => {
  let isRunning = false;
  let timerId = null;
  let totalRequests = 0;
  let rateLimited429 = 0;
  let errors5xx = 0;
  let currentAttempt = 0;

  const concurrencySlider = document.getElementById('concurrencySlider');
  const concurrencyVal = document.getElementById('concurrencyVal');
  const startLoadBtn = document.getElementById('startLoadBtn');
  const stopLoadBtn = document.getElementById('stopLoadBtn');
  const backoffStrategy = document.getElementById('backoffStrategy');
  const totalReqCount = document.getElementById('totalReqCount');
  const rateLimitCount = document.getElementById('rateLimitCount');
  const errorCount = document.getElementById('errorCount');
  const backoffOutput = document.getElementById('backoffOutput');
  const downloadReportBtn = document.getElementById('downloadReportBtn');

  // Chart setup
  const ctx = document.getElementById('loadChart').getContext('2d');
  const loadChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: ['200 OK', '429 Rate Limited', '500 Server Error'],
      datasets: [{
        label: 'HTTP Status Count',
        data: [0, 0, 0],
        backgroundColor: ['#10b981', '#f97316', '#ef4444']
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
        x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } }
      },
      plugins: { legend: { display: false } }
    }
  });

  concurrencySlider.addEventListener('input', (e) => {
    concurrencyVal.textContent = `${e.target.value} req/s`;
  });

  function calculateBackoff(attempt) {
    const strategy = backoffStrategy.value;
    if (strategy === 'exponential') {
      return Math.min(10000, Math.pow(2, attempt) * 100);
    } else if (strategy === 'linear') {
      return attempt * 300;
    }
    return 0;
  }

  function runBatch() {
    const rate = parseInt(concurrencySlider.value);
    totalRequests += rate;

    // Simulate outcome based on load volume
    let ok = 0;
    let limited = 0;
    let err = 0;

    for (let i = 0; i < rate; i++) {
      const rand = Math.random();
      if (rate > 50 && rand < 0.4) {
        limited++;
      } else if (rand < 0.1) {
        err++;
      } else {
        ok++;
      }
    }

    rateLimited429 += limited;
    errors5xx += err;

    if (limited > 0) {
      currentAttempt++;
      const delay = calculateBackoff(currentAttempt);
      backoffOutput.textContent = `429 Detected! ${backoffStrategy.value} backoff activated: Wait ${delay}ms before next burst.`;
    } else {
      currentAttempt = Math.max(0, currentAttempt - 1);
      backoffOutput.textContent = `Normal Traffic Flow. Delay: 0ms`;
    }

    totalReqCount.textContent = totalRequests;
    rateLimitCount.textContent = rateLimited429;
    errorCount.textContent = errors5xx;

    const okCount = totalRequests - rateLimited429 - errors5xx;
    loadChart.data.datasets[0].data = [okCount, rateLimited429, errors5xx];
    loadChart.update();
  }

  startLoadBtn.addEventListener('click', () => {
    isRunning = true;
    startLoadBtn.disabled = true;
    stopLoadBtn.disabled = false;
    timerId = setInterval(runBatch, 1000);
  });

  stopLoadBtn.addEventListener('click', () => {
    isRunning = false;
    startLoadBtn.disabled = false;
    stopLoadBtn.disabled = true;
    clearInterval(timerId);
  });

  downloadReportBtn.addEventListener('click', () => {
    const report = {
      timestamp: new Date().toISOString(),
      totalRequests,
      rateLimited429,
      errors5xx,
      successCount: totalRequests - rateLimited429 - errors5xx,
      backoffStrategy: backoffStrategy.value
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chaos-load-report-${Date.now()}.json`;
    a.click();
  });
});
