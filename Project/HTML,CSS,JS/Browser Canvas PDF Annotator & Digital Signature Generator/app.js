document.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('annotationCanvas');
  const ctx = canvas.getContext('2d');
  const strokeColor = document.getElementById('strokeColor');
  const strokeWidth = document.getElementById('strokeWidth');
  const sigModal = document.getElementById('sigModal');
  const sigPad = document.getElementById('sigPadCanvas');
  const sigCtx = sigPad.getContext('2d');

  let isDrawing = false;
  let currentTool = 'brush'; // 'brush' | 'text' | 'signature'

  // Initialize placeholder PDF document grid
  function drawBaseDocument() {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#334155';
    ctx.font = '24px Segoe UI, sans-serif';
    ctx.fillText('DOCUMENT CONTRACT FORM #2026-PDF', 50, 60);

    ctx.fillStyle = '#64748b';
    ctx.font = '14px Segoe UI, sans-serif';
    ctx.fillText('1. Terms and Agreement Conditions', 50, 100);
    ctx.fillText('This document is ready for client digital signature and freehand canvas annotation overlay.', 50, 125);

    ctx.strokeStyle = '#e2e8f0';
    ctx.strokeRect(50, 700, 300, 100);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Sign Here (Digital Stamp Placement Area)', 60, 725);
  }

  // Drawing Events
  canvas.addEventListener('mousedown', (e) => {
    if (currentTool === 'brush') {
      isDrawing = true;
      ctx.beginPath();
      ctx.moveTo(e.offsetX, e.offsetY);
    } else if (currentTool === 'text') {
      const text = prompt('Enter annotation text:');
      if (text) {
        ctx.fillStyle = strokeColor.value;
        ctx.font = '18px Segoe UI, sans-serif';
        ctx.fillText(text, e.offsetX, e.offsetY);
      }
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isDrawing || currentTool !== 'brush') return;
    ctx.strokeStyle = strokeColor.value;
    ctx.lineWidth = strokeWidth.value;
    ctx.lineCap = 'round';
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
  });

  window.addEventListener('mouseup', () => { isDrawing = false; });

  // Tool Switching
  document.getElementById('toolBrush').addEventListener('click', (e) => {
    setTool('brush', e.target);
  });
  document.getElementById('toolText').addEventListener('click', (e) => {
    setTool('text', e.target);
  });
  document.getElementById('toolSignature').addEventListener('click', () => {
    sigModal.classList.remove('hidden');
  });

  function setTool(tool, element) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
    element.classList.add('active');
  }

  // Signature Pad Logic
  let sigDrawing = false;
  sigPad.addEventListener('mousedown', (e) => {
    sigDrawing = true;
    sigCtx.beginPath();
    sigCtx.moveTo(e.offsetX, e.offsetY);
  });
  sigPad.addEventListener('mousemove', (e) => {
    if (!sigDrawing) return;
    sigCtx.strokeStyle = '#000000';
    sigCtx.lineWidth = 2;
    sigCtx.lineTo(e.offsetX, e.offsetY);
    sigCtx.stroke();
  });
  window.addEventListener('mouseup', () => { sigDrawing = false; });

  document.getElementById('clearSigPad').addEventListener('click', () => {
    sigCtx.clearRect(0, 0, sigPad.width, sigPad.height);
  });

  document.getElementById('applySig').addEventListener('click', () => {
    ctx.drawImage(sigPad, 60, 710, 280, 85);
    sigModal.classList.add('hidden');
    sigCtx.clearRect(0, 0, sigPad.width, sigPad.height);
  });

  document.getElementById('clearCanvasBtn').addEventListener('click', drawBaseDocument);

  document.getElementById('exportPdfBtn').addEventListener('click', () => {
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `annotated-pdf-document-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  });

  drawBaseDocument();
});
