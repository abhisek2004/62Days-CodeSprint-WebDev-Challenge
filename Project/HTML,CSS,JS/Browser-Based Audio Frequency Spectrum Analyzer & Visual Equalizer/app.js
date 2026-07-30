document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('spectrumCanvas');
  const ctx = canvas.getContext('2d');
  const toggleMicBtn = document.getElementById('toggleMicBtn');

  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;

  let audioCtx, analyser, dataArray;
  let isMicActive = false;

  toggleMicBtn.addEventListener('click', async () => {
    if (!isMicActive) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;

        const source = audioCtx.createMediaStreamSource(stream);
        source.connect(analyser);

        dataArray = new Uint8Array(analyser.frequencyBinCount);
        isMicActive = true;
        toggleMicBtn.innerHTML = '<i class="fa-solid fa-microphone-slash"></i> Stop Analyzer';
        drawSpectrum();
      } catch (err) {
        alert('Microphone access required for live spectrum analysis.');
      }
    } else {
      isMicActive = false;
      toggleMicBtn.innerHTML = '<i class="fa-solid fa-microphone"></i> Activate Microphone Analyzer';
    }
  });

  function drawSpectrum() {
    if (!isMicActive) {
      drawSimulatedSpectrum();
      return;
    }
    requestAnimationFrame(drawSpectrum);
    analyser.getByteFrequencyData(dataArray);

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const barWidth = (canvas.width / dataArray.length) - 4;
    let x = 2;

    for (let i = 0; i < dataArray.length; i++) {
      const barHeight = (dataArray[i] / 255) * canvas.height;
      ctx.fillStyle = '#8b5cf6';
      ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
      x += barWidth + 4;
    }
  }

  function drawSimulatedSpectrum() {
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const barCount = 32;
    const barWidth = (canvas.width / barCount) - 4;
    let x = 2;

    for (let i = 0; i < barCount; i++) {
      const barHeight = Math.sin(Date.now() * 0.005 + i) * 60 + 80;
      ctx.fillStyle = '#8b5cf6';
      ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
      x += barWidth + 4;
    }
    if (!isMicActive) requestAnimationFrame(drawSimulatedSpectrum);
  }

  drawSimulatedSpectrum();
});
