(function() {
    'use strict';

    // ----- DOM refs -----
    const svg = document.getElementById('drawingSvg');
    const shapesGroup = document.getElementById('shapesGroup');
    const tempGroup = document.getElementById('tempGroup');
    const bgRect = document.getElementById('backgroundRect');
    const layersList = document.getElementById('layersList');
    const cursorPos = document.getElementById('cursorPos');
    const shapeCount = document.getElementById('shapeCount');
    const strokeColor = document.getElementById('strokeColor');
    const fillColor = document.getElementById('fillColor');
    const strokeWidth = document.getElementById('strokeWidth');
    const strokeWidthValue = document.getElementById('strokeWidthValue');
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    const clearBtn = document.getElementById('clearBtn');
    const gridToggle = document.getElementById('gridToggle');
    const exportSvgBtn = document.getElementById('exportSvgBtn');
    const exportPngBtn = document.getElementById('exportPngBtn');
    const addLayerBtn = document.getElementById('addLayerBtn');
    const deleteLayerBtn = document.getElementById('deleteLayerBtn');
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const themeLabel = document.getElementById('themeLabel');

    // ----- State -----
    let currentTool = 'pen';
    let isDrawing = false;
    let startX = 0;
    let startY = 0;
    let currentShape = null;
    let shapes = [];
    let layers = [{ id: 'layer_1', name: 'Layer 1', visible: true, shapes: [] }];
    let activeLayerId = 'layer_1';
    let undoStack = [];
    let redoStack = [];
    let maxUndo = 50;
    let snapToGrid = false;
    const GRID_SIZE = 20;
    let shapeIdCounter = 0;
    let layerIdCounter = 2;

    // ----- Theme -----
    function setTheme(dark) {
        document.body.classList.toggle('dark', dark);
        themeIcon.textContent = dark ? '☀️' : '🌙';
        themeLabel.textContent = dark ? 'Light' : 'Dark';
        // Update SVG background
        const rect = svg.querySelector('rect');
        if (rect) {
            rect.setAttribute('fill', dark ? '#0f172a' : '#ffffff');
        }
    }

    themeToggle.addEventListener('click', () => {
        const isDark = document.body.classList.contains('dark');
        setTheme(!isDark);
    });

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setTheme(true);
    }

    // ----- SVG helpers -----
    function createSVGElement(tag, attrs = {}) {
        const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (const [key, value] of Object.entries(attrs)) {
            el.setAttribute(key, value);
        }
        return el;
    }

    function getSVGPoint(clientX, clientY) {
        const rect = svg.getBoundingClientRect();
        const x = ((clientX - rect.left) / rect.width) * svg.clientWidth;
        const y = ((clientY - rect.top) / rect.height) * svg.clientHeight;
        return { x, y };
    }

    function snap(value) {
        return snapToGrid ? Math.round(value / GRID_SIZE) * GRID_SIZE : value;
    }

    // ----- Shape creation -----
    function createShape(type, attrs = {}) {
        const shape = {
            id: 'shape_' + (++shapeIdCounter),
            type: type,
            attrs: {
                stroke: strokeColor.value,
                fill: fillColor.value,
                'stroke-width': parseInt(strokeWidth.value),
                ...attrs
            },
            layerId: activeLayerId,
            visible: true
        };
        return shape;
    }

    function renderShape(shape) {
        const el = createSVGElement(shape.type, {
            ...shape.attrs,
            'data-shape-id': shape.id
        });
        if (shape.type === 'text') {
            el.textContent = shape.attrs.text || 'Text';
        }
        return el;
    }

    function renderAllShapes() {
        shapesGroup.innerHTML = '';
        // Render shapes by layer order
        const sortedShapes = [...shapes].sort((a, b) => {
            const idxA = layers.findIndex(l => l.id === a.layerId);
            const idxB = layers.findIndex(l => l.id === b.layerId);
            return idxA - idxB || 0;
        });
        for (const shape of sortedShapes) {
            const layer = layers.find(l => l.id === shape.layerId);
            if (layer && layer.visible && shape.visible !== false) {
                const el = renderShape(shape);
                shapesGroup.appendChild(el);
            }
        }
        updateShapeCount();
    }

    // ----- Drawing functions -----
    function startDraw(e) {
        const point = getSVGPoint(e.clientX, e.clientY);
        startX = snap(point.x);
        startY = snap(point.y);

        if (currentTool === 'text') {
            const text = prompt('Enter text:', 'Hello');
            if (text !== null) {
                const shape = createShape('text', {
                    x: startX,
                    y: startY,
                    'font-size': '24px',
                    'font-family': 'system-ui',
                    fill: strokeColor.value,
                    text: text || 'Text'
                });
                shapes.push(shape);
                pushUndo();
                renderAllShapes();
                renderLayers();
            }
            return;
        }

        isDrawing = true;
        currentShape = createShape(getShapeType(), {
            x1: startX,
            y1: startY,
            x2: startX,
            y2: startY
        });

        if (currentTool === 'rect' || currentTool === 'circle') {
            currentShape.attrs.x = startX;
            currentShape.attrs.y = startY;
            currentShape.attrs.width = 0;
            currentShape.attrs.height = 0;
            if (currentTool === 'circle') {
                currentShape.attrs.r = 0;
            }
        }

        if (currentTool === 'rect') {
            currentShape.attrs.fill = fillColor.value;
        }
    }

    function moveDraw(e) {
        if (!isDrawing || !currentShape) return;
        const point = getSVGPoint(e.clientX, e.clientY);
        const x = snap(point.x);
        const y = snap(point.y);

        tempGroup.innerHTML = '';

        if (currentTool === 'pen') {
            const line = createSVGElement('line', {
                x1: startX,
                y1: startY,
                x2: x,
                y2: y,
                stroke: currentShape.attrs.stroke,
                'stroke-width': currentShape.attrs['stroke-width'],
                'stroke-linecap': 'round'
            });
            tempGroup.appendChild(line);
            startX = x;
            startY = y;
        } else if (currentTool === 'line') {
            const line = createSVGElement('line', {
                x1: currentShape.attrs.x1,
                y1: currentShape.attrs.y1,
                x2: x,
                y2: y,
                stroke: currentShape.attrs.stroke,
                'stroke-width': currentShape.attrs['stroke-width'],
                'stroke-linecap': 'round'
            });
            tempGroup.appendChild(line);
        } else if (currentTool === 'rect') {
            const rect = createSVGElement('rect', {
                x: Math.min(currentShape.attrs.x, x),
                y: Math.min(currentShape.attrs.y, y),
                width: Math.abs(x - currentShape.attrs.x),
                height: Math.abs(y - currentShape.attrs.y),
                stroke: currentShape.attrs.stroke,
                'stroke-width': currentShape.attrs['stroke-width'],
                fill: currentShape.attrs.fill || 'none'
            });
            tempGroup.appendChild(rect);
        } else if (currentTool === 'circle') {
            const cx = currentShape.attrs.x;
            const cy = currentShape.attrs.y;
            const radius = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
            const circle = createSVGElement('circle', {
                cx: cx,
                cy: cy,
                r: radius,
                stroke: currentShape.attrs.stroke,
                'stroke-width': currentShape.attrs['stroke-width'],
                fill: currentShape.attrs.fill || 'none'
            });
            tempGroup.appendChild(circle);
        }
    }

    function endDraw(e) {
        if (!isDrawing || !currentShape) {
            isDrawing = false;
            return;
        }

        const point = getSVGPoint(e.clientX, e.clientY);
        const x = snap(point.x);
        const y = snap(point.y);

        tempGroup.innerHTML = '';

        if (currentTool === 'pen') {
            // Convert pen strokes to a path
            // For simplicity, we'll just add the last line
            const shape = createShape('line', {
                x1: currentShape.attrs.x1,
                y1: currentShape.attrs.y1,
                x2: x,
                y2: y,
                stroke: currentShape.attrs.stroke,
                'stroke-width': currentShape.attrs['stroke-width'],
                'stroke-linecap': 'round'
            });
            shapes.push(shape);
        } else if (currentTool === 'line') {
            const shape = createShape('line', {
                x1: currentShape.attrs.x1,
                y1: currentShape.attrs.y1,
                x2: x,
                y2: y,
                stroke: currentShape.attrs.stroke,
                'stroke-width': currentShape.attrs['stroke-width'],
                'stroke-linecap': 'round'
            });
            shapes.push(shape);
        } else if (currentTool === 'rect') {
            const shape = createShape('rect', {
                x: Math.min(currentShape.attrs.x, x),
                y: Math.min(currentShape.attrs.y, y),
                width: Math.abs(x - currentShape.attrs.x),
                height: Math.abs(y - currentShape.attrs.y),
                stroke: currentShape.attrs.stroke,
                'stroke-width': currentShape.attrs['stroke-width'],
                fill: currentShape.attrs.fill || 'none'
            });
            shapes.push(shape);
        } else if (currentTool === 'circle') {
            const cx = currentShape.attrs.x;
            const cy = currentShape.attrs.y;
            const radius = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
            const shape = createShape('circle', {
                cx: cx,
                cy: cy,
                r: radius,
                stroke: currentShape.attrs.stroke,
                'stroke-width': currentShape.attrs['stroke-width'],
                fill: currentShape.attrs.fill || 'none'
            });
            shapes.push(shape);
        }

        isDrawing = false;
        currentShape = null;
        pushUndo();
        renderAllShapes();
        renderLayers();
    }

    function getShapeType() {
        const map = {
            'pen': 'line',
            'line': 'line',
            'rect': 'rect',
            'circle': 'circle',
            'text': 'text'
        };
        return map[currentTool] || 'line';
    }

    // ----- Mouse/Touch events -----
    function onMouseDown(e) {
        e.preventDefault();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        if (currentTool === 'select') return;
        startDraw({ clientX, clientY });
    }

    function onMouseMove(e) {
        e.preventDefault();
        const clientX = e.clientX || (e.touches && e.touches[0].clientX);
        const clientY = e.clientY || (e.touches && e.touches[0].clientY);
        if (currentTool === 'select') {
            // Update cursor position
            const point = getSVGPoint(clientX, clientY);
            cursorPos.textContent = `${Math.round(point.x)}, ${Math.round(point.y)}`;
            return;
        }
        cursorPos.textContent = `${Math.round(clientX)}, ${Math.round(clientY)}`;
        moveDraw({ clientX, clientY });
    }

    function onMouseUp(e) {
        e.preventDefault();
        const clientX = e.clientX || (e.changedTouches && e.changedTouches[0].clientX);
        const clientY = e.clientY || (e.changedTouches && e.changedTouches[0].clientY);
        if (currentTool === 'select') return;
        if (isDrawing) {
            endDraw({ clientX, clientY });
        }
    }

    // ----- Layers -----
    function renderLayers() {
        let html = '';
        layers.forEach(layer => {
            const layerShapes = shapes.filter(s => s.layerId === layer.id);
            const isActive = layer.id === activeLayerId;
            html += `
                <div class="layer-item ${isActive ? 'active' : ''}" data-layer-id="${layer.id}">
                    <span class="layer-visibility ${layer.visible ? '' : 'hidden'}" data-layer-id="${layer.id}">
                        ${layer.visible ? '👁️' : '🚫'}
                    </span>
                    <span class="layer-name">${layer.name}</span>
                    <span class="layer-count">${layerShapes.length}</span>
                </div>
            `;
        });
        layersList.innerHTML = html;

        // Layer click events
        layersList.querySelectorAll('.layer-item').forEach(el => {
            el.addEventListener('click', () => {
                activeLayerId = el.dataset.layerId;
                renderLayers();
            });
        });

        // Visibility toggle
        layersList.querySelectorAll('.layer-visibility').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const layer = layers.find(l => l.id === el.dataset.layerId);
                if (layer) {
                    layer.visible = !layer.visible;
                    renderAllShapes();
                    renderLayers();
                }
            });
        });
    }

    function addLayer() {
        const newLayer = {
            id: 'layer_' + (layerIdCounter++),
            name: `Layer ${layers.length + 1}`,
            visible: true,
            shapes: []
        };
        layers.push(newLayer);
        activeLayerId = newLayer.id;
        renderLayers();
        pushUndo();
    }

    function deleteLayer() {
        if (layers.length <= 1) {
            alert('Cannot delete the last layer.');
            return;
        }
        const layer = layers.find(l => l.id === activeLayerId);
        if (layer) {
            // Move shapes to first layer
            const firstLayer = layers[0];
            shapes.forEach(s => {
                if (s.layerId === activeLayerId) {
                    s.layerId = firstLayer.id;
                }
            });
            layers = layers.filter(l => l.id !== activeLayerId);
            activeLayerId = layers[0].id;
            renderAllShapes();
            renderLayers();
            pushUndo();
        }
    }

    // ----- Undo/Redo -----
    function pushUndo() {
        const snapshot = JSON.stringify(shapes);
        undoStack.push(snapshot);
        if (undoStack.length > maxUndo) {
            undoStack.shift();
        }
        redoStack = [];
        updateUndoButtons();
    }

    function undo() {
        if (undoStack.length <= 1) return;
        const current = undoStack.pop();
        redoStack.push(current);
        const prev = undoStack[undoStack.length - 1];
        shapes = JSON.parse(prev);
        renderAllShapes();
        renderLayers();
        updateUndoButtons();
    }

    function redo() {
        if (redoStack.length === 0) return;
        const next = redoStack.pop();
        undoStack.push(next);
        shapes = JSON.parse(next);
        renderAllShapes();
        renderLayers();
        updateUndoButtons();
    }

    function updateUndoButtons() {
        undoBtn.style.opacity = undoStack.length > 1 ? '1' : '0.3';
        redoBtn.style.opacity = redoStack.length > 0 ? '1' : '0.3';
    }

    // ----- Clear -----
    function clearAll() {
        if (!confirm('Clear all shapes?')) return;
        shapes = [];
        pushUndo();
        renderAllShapes();
        renderLayers();
    }

    // ----- Update shape count -----
    function updateShapeCount() {
        shapeCount.textContent = `Shapes: ${shapes.length}`;
    }

    // ----- Export -----
    function exportSVG() {
        const serializer = new XMLSerializer();
        let svgContent = svg.cloneNode(true);
        // Clean up temp group
        const temp = svgContent.querySelector('#tempGroup');
        if (temp) temp.innerHTML = '';
        
        let str = serializer.serializeToString(svgContent);
        str = '<?xml version="1.0" encoding="UTF-8"?>\n' + str;
        
        const blob = new Blob([str], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'drawing.svg';
        a.click();
        URL.revokeObjectURL(url);
    }

    function exportPNG() {
        const rect = svg.getBoundingClientRect();
        const width = rect.width || 800;
        const height = rect.height || 600;
        
        // Create a canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Draw background
        const bg = document.body.classList.contains('dark') ? '#0f172a' : '#ffffff';
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);

        // Serialize SVG
        const serializer = new XMLSerializer();
        let svgCopy = svg.cloneNode(true);
        const temp = svgCopy.querySelector('#tempGroup');
        if (temp) temp.innerHTML = '';
        const svgStr = serializer.serializeToString(svgCopy);
        
        const img = new Image();
        const svgBlob = new Blob([svgStr], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(svgBlob);
        
        img.onload = function() {
            ctx.drawImage(img, 0, 0, width, height);
            const pngUrl = canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = pngUrl;
            a.download = 'drawing.png';
            a.click();
            URL.revokeObjectURL(url);
        };
        img.src = url;
    }

    // ----- Tool selection -----
    document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tool-btn[data-tool]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTool = btn.dataset.tool;
            svg.style.cursor = currentTool === 'select' ? 'default' : 'crosshair';
        });
    });

    // ----- Event listeners -----
    svg.addEventListener('mousedown', onMouseDown);
    svg.addEventListener('mousemove', onMouseMove);
    svg.addEventListener('mouseup', onMouseUp);
    svg.addEventListener('mouseleave', (e) => {
        if (isDrawing) onMouseUp(e);
    });

    // Touch events
    svg.addEventListener('touchstart', onMouseDown, { passive: false });
    svg.addEventListener('touchmove', onMouseMove, { passive: false });
    svg.addEventListener('touchend', onMouseUp, { passive: false });

    // Stroke width
    strokeWidth.addEventListener('input', () => {
        strokeWidthValue.textContent = strokeWidth.value;
    });

    // Grid toggle
    gridToggle.addEventListener('click', () => {
        snapToGrid = !snapToGrid;
        gridToggle.style.borderColor = snapToGrid ? '#3b82f6' : 'transparent';
        gridToggle.style.background = snapToGrid ? '#eff6ff' : 'transparent';
    });

    // Undo/Redo
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);
    clearBtn.addEventListener('click', clearAll);

    // Layers
    addLayerBtn.addEventListener('click', addLayer);
    deleteLayerBtn.addEventListener('click', deleteLayer);

    // Export
    exportSvgBtn.addEventListener('click', exportSVG);
    exportPngBtn.addEventListener('click', exportPNG);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl+Z
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            undo();
        }
        // Ctrl+Y
        if (e.ctrlKey && e.key === 'y') {
            e.preventDefault();
            redo();
        }
        // Tool shortcuts
        const toolMap = {
            'p': 'pen',
            'l': 'line',
            'r': 'rect',
            'c': 'circle',
            't': 'text',
            'v': 'select'
        };
        if (e.key.toLowerCase() in toolMap) {
            const tool = toolMap[e.key.toLowerCase()];
            const btn = document.querySelector(`.tool-btn[data-tool="${tool}"]`);
            if (btn) btn.click();
        }
        if (e.key === 'g' || e.key === 'G') {
            gridToggle.click();
        }
    });

    // ----- Initialize -----
    // Add some sample shapes
    const sampleShapes = [
        { type: 'rect', attrs: { x: 50, y: 50, width: 150, height: 100, fill: '#3b82f640', stroke: '#3b82f6', 'stroke-width': 2 } },
        { type: 'circle', attrs: { cx: 350, cy: 150, r: 60, fill: '#22c55e40', stroke: '#22c55e', 'stroke-width': 2 } },
        { type: 'line', attrs: { x1: 500, y1: 50, x2: 650, y2: 150, stroke: '#8b5cf6', 'stroke-width': 3 } },
        { type: 'text', attrs: { x: 100, y: 250, 'font-size': '24px', fill: '#e2e8f0', text: 'Vector Drawing' } }
    ];
    
    sampleShapes.forEach(s => {
        const shape = {
            id: 'shape_' + (++shapeIdCounter),
            type: s.type,
            attrs: s.attrs,
            layerId: 'layer_1',
            visible: true
        };
        shapes.push(shape);
    });
    
    pushUndo();
    renderAllShapes();
    renderLayers();
    updateUndoButtons();

    console.log('✏️ Vector Drawing Board initialized!');
    console.log('💡 Tools: Pen(P), Line(L), Rect(R), Circle(C), Text(T), Select(V)');
    console.log('💡 Shortcuts: Ctrl+Z (Undo), Ctrl+Y (Redo), G (Grid)');

    // Expose for debugging
    window.__DrawingBoard = {
        shapes,
        layers,
        undo: undo,
        redo: redo,
        exportSVG,
        exportPNG,
        addLayer,
        deleteLayer,
        clearAll
    };
})();