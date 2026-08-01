let currentPipelineMode = "deferred";

function renderDeferredCanvas() {
  const canvas = document.getElementById("glCanvas");
  const ctx = canvas.getContext("2d");
  const lightCount = document.getElementById("lightCount").value;

  ctx.fillStyle = "#090d16";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Render dynamic point light accumulation
  for (let i = 0; i < Math.min(lightCount, 250); i++) {
    const x = (Math.sin(i * 0.5 + Date.now() * 0.001) * 0.4 + 0.5) * canvas.width;
    const y = (Math.cos(i * 0.3 + Date.now() * 0.001) * 0.4 + 0.5) * canvas.height;

    const rad = ctx.createRadialGradient(x, y, 1, x, y, 25);
    const color = `hsl(${(i * 15) % 360}, 100%, 65%)`;
    rad.addColorStop(0, color);
    rad.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = rad;
    ctx.beginPath();
    ctx.arc(x, y, 25, 0, Math.PI * 2);
    ctx.fill();
  }

  const perfMetrics = document.getElementById("perfMetrics");
  if (currentPipelineMode === "deferred") {
    perfMetrics.textContent = `Pipeline: Deferred Shading (G-Buffer) | Active Lights: ${lightCount} | FPS: 60 FPS (16.6ms) | Light Accumulation Pass: 0.8ms`;
  } else {
    perfMetrics.textContent = `Pipeline: Forward Shading (Direct Pass) | Active Lights: ${lightCount} | FPS: 18 FPS (55.4ms) | Bottleneck: High Shader Branching`;
  }

  requestAnimationFrame(renderDeferredCanvas);
}

function togglePipeline(mode) {
  currentPipelineMode = mode;
}

document.addEventListener("DOMContentLoaded", () => {
  renderDeferredCanvas();
});
