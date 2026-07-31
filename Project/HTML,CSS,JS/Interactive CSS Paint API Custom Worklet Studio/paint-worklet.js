/**
 * CSS Houdini Paint Worklet - Custom Pattern Studio
 * Production Export File
 */

class CustomPatternPainter {
  static get inputProperties() {
    return [
      '--pattern-color',
      '--pattern-accent',
      '--pattern-bg',
      '--pattern-density',
      '--pattern-scale',
      '--pattern-angle'
    ];
  }

  paint(ctx, geom, properties) {
    // Extract CSS Custom Properties with safe fallback defaults
    const color = properties.get('--pattern-color')?.toString().trim() || '#6366f1';
    const accent = properties.get('--pattern-accent')?.toString().trim() || '#a855f7';
    const bg = properties.get('--pattern-bg')?.toString().trim() || '#0f172a';
    const density = parseFloat(properties.get('--pattern-density')) || 30;
    const scale = parseFloat(properties.get('--pattern-scale')) || 12;
    const angleDeg = parseFloat(properties.get('--pattern-angle')) || 45;

    // Fill background
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, geom.width, geom.height);

    // Save context for rotation & transformation
    ctx.save();
    ctx.translate(geom.width / 2, geom.height / 2);
    ctx.rotate((angleDeg * Math.PI) / 180);
    ctx.translate(-geom.width, -geom.height);

    const step = Math.max(8, density);
    const radius = Math.max(1, scale / 2);
    const w = geom.width * 2;
    const h = geom.height * 2;

    let colIndex = 0;
    for (let x = 0; x < w; x += step) {
      let rowIndex = 0;
      for (let y = 0; y < h; y += step) {
        ctx.fillStyle = (colIndex + rowIndex) % 2 === 0 ? color : accent;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        rowIndex++;
      }
      colIndex++;
    }

    ctx.restore();
  }
}

// Register paint worklet for CSS Houdini
if (typeof registerPaint !== 'undefined') {
  registerPaint('custom-pattern', CustomPatternPainter);
}
