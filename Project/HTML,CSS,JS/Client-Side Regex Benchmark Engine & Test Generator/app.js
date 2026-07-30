document.addEventListener('DOMContentLoaded', () => {
  const patternInput = document.getElementById('regexPattern');
  const flagsInput = document.getElementById('regexFlags');
  const sampleText = document.getElementById('sampleText');
  const latencyMetric = document.getElementById('latencyMetric');
  const matchCountMetric = document.getElementById('matchCountMetric');
  const matchOutput = document.getElementById('matchOutput');
  const runBenchmarkBtn = document.getElementById('runBenchmarkBtn');

  function evaluateRegex() {
    try {
      const reg = new RegExp(patternInput.value, flagsInput.value);
      const text = sampleText.value;

      // Benchmark 10,000 iterations
      const t0 = performance.now();
      let matches = [];
      for (let i = 0; i < 10000; i++) {
        matches = text.match(reg) || [];
      }
      const t1 = performance.now();

      latencyMetric.textContent = `${(t1 - t0).toFixed(2)} ms`;
      matchCountMetric.textContent = matches.length;

      if (matches.length > 0) {
        matchOutput.innerHTML = matches.map(m => `<div>✓ Match: <code>${m}</code></div>`).join('');
      } else {
        matchOutput.innerHTML = '<span style="color:#94a3b8">No pattern matches found in input.</span>';
      }
    } catch (err) {
      matchOutput.innerHTML = `<span style="color:#ef4444">Regex Error: ${err.message}</span>`;
    }
  }

  runBenchmarkBtn.addEventListener('click', evaluateRegex);
  evaluateRegex();
});
