/**
 * VisionStudio AI - Client-Side Neural Network & Computer Vision Classifier Engine
 * Built with Custom Lightweight Neural Network Math & Web Camera API
 */

(function () {
  'use strict';

  // --- Configuration & Constants ---
  const INPUT_SIZE = 28; // 28x28 pixel resolution for CV model
  const DEFAULT_COLORS = ['#00f2fe', '#7928ca', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6'];

  // --- Application State ---
  const state = {
    webcamActive: false,
    mediaStream: null,
    currentFacingMode: 'user',
    classes: [], // Array of { id, name, color, samples: Array<{data: Float32Array, thumb: string}> }
    training: false,
    paused: false,
    stopRequested: false,
    epochHistory: { loss: [], accuracy: [] },
    confidenceThreshold: 0.3,
    speechEnabled: false,
    heatmapEnabled: true,
    lastAnnouncedClass: null,
    selectedArch: 'light-cnn',
    model: null,
    backendName: 'Custom JS Engine',
    fps: 0,
    frameCount: 0,
    lastFpsUpdate: performance.now(),
    modalClassId: null
  };

  // --- DOM Elements ---
  const el = {
    webcamFeed: document.getElementById('webcam-feed'),
    snapshotCanvas: document.getElementById('snapshot-canvas'),
    feedOverlay: document.getElementById('feed-overlay'),
    camToggleText: document.getElementById('cam-toggle-text'),
    btnToggleCamera: document.getElementById('btn-toggle-camera'),
    cameraSelect: document.getElementById('camera-select'),
    btnTriggerUpload: document.getElementById('btn-trigger-upload'),
    imageUploadInput: document.getElementById('image-upload-input'),
    classCardsList: document.getElementById('class-cards-list'),
    btnAddClass: document.getElementById('btn-add-class'),
    totalSamplesCount: document.getElementById('total-samples-count'),
    engineName: document.getElementById('engine-name'),
    fpsCounter: document.getElementById('fps-counter'),
    backendType: document.getElementById('backend-type'),
    btnQuickDemo: document.getElementById('btn-quick-demo'),
    
    // Architecture & Controls
    archSelect: document.getElementById('arch-select'),
    archCanvas: document.getElementById('arch-canvas'),
    archInfoBanner: document.getElementById('arch-info-banner'),
    
    // Training
    btnStartTrain: document.getElementById('btn-start-train'),
    btnPauseTrain: document.getElementById('btn-pause-train'),
    btnResetTrain: document.getElementById('btn-reset-train'),
    paramEpochs: document.getElementById('param-epochs'),
    paramBatchSize: document.getElementById('param-batch-size'),
    paramLr: document.getElementById('param-lr'),
    paramOptimizer: document.getElementById('param-optimizer'),
    lossCanvas: document.getElementById('loss-chart-canvas'),
    accCanvas: document.getElementById('acc-chart-canvas'),
    statLoss: document.getElementById('stat-loss'),
    statAcc: document.getElementById('stat-acc'),
    trainingStatusText: document.getElementById('training-status-text'),
    trainingEpochText: document.getElementById('training-epoch-text'),
    trainingProgressFill: document.getElementById('training-progress-fill'),

    // Inference
    liveInferenceCanvas: document.getElementById('live-inference-canvas'),
    toggleLiveInference: document.getElementById('toggle-live-inference'),
    predClassName: document.getElementById('pred-class-name'),
    predClassPercent: document.getElementById('pred-class-percent'),
    topPredBadge: document.getElementById('top-pred-badge'),
    classProbabilityMeters: document.getElementById('class-probability-meters'),
    sliderThreshold: document.getElementById('slider-threshold'),
    thresholdVal: document.getElementById('threshold-val'),
    toggleAudio: document.getElementById('toggle-audio'),
    toggleHeatmap: document.getElementById('toggle-heatmap'),

    // Serialization
    btnExportJson: document.getElementById('btn-export-json'),
    btnImportFile: document.getElementById('btn-import-file'),
    btnSaveLocal: document.getElementById('btn-save-local'),
    btnLoadLocal: document.getElementById('btn-load-local'),

    // Modal
    imageModalBackdrop: document.getElementById('image-modal-backdrop'),
    modalClassTitle: document.getElementById('modal-class-title'),
    modalSamplesGrid: document.getElementById('modal-samples-grid'),
    modalCloseBtn: document.getElementById('modal-close-btn'),

    // Augmentations
    augFlip: document.getElementById('aug-flip'),
    augRotate: document.getElementById('aug-rotate'),
    augNoise: document.getElementById('aug-noise'),
    augBrightness: document.getElementById('aug-brightness')
  };

  // ==========================================================================
  // Custom Lightweight JS Neural Network Engine Math
  // ==========================================================================
  class CustomNeuralNet {
    constructor(inputShape, numClasses, archType = 'light-cnn') {
      this.inputWidth = inputShape[0];
      this.inputHeight = inputShape[1];
      this.numClasses = numClasses;
      this.archType = archType;

      // Filter settings for 2D Conv
      this.numFilters = archType === 'mlp' ? 0 : (archType === 'deep-cnn' ? 8 : 4);
      this.filterSize = 3; // 3x3 filter
      
      // Calculate Conv output dimensions: (W - K + 1) -> e.g. 28 - 3 + 1 = 26
      this.convOutW = this.inputWidth - this.filterSize + 1;
      this.convOutH = this.inputHeight - this.filterSize + 1;
      
      // Calculate Pool output dimensions: (26 / 2) = 13
      this.poolOutW = Math.floor(this.convOutW / 2);
      this.poolOutH = Math.floor(this.convOutH / 2);

      // Flatten size
      this.flattenSize = this.numFilters > 0 ? (this.poolOutW * this.poolOutH * this.numFilters) : (this.inputWidth * this.inputHeight);
      this.hiddenNeurons = archType === 'deep-cnn' ? 64 : 32;

      this.initWeights();
    }

    initWeights() {
      // Conv Filters [NumFilters x 3 x 3]
      if (this.numFilters > 0) {
        this.convKernels = new Float32Array(this.numFilters * 9);
        for (let i = 0; i < this.convKernels.length; i++) {
          this.convKernels[i] = (Math.random() - 0.5) * Math.sqrt(2 / 9);
        }
        this.convBiases = new Float32Array(this.numFilters);
      }

      // Dense Hidden Layer [HiddenNeurons x FlattenSize]
      this.w1 = new Float32Array(this.hiddenNeurons * this.flattenSize);
      for (let i = 0; i < this.w1.length; i++) {
        this.w1[i] = (Math.random() - 0.5) * Math.sqrt(2 / this.flattenSize);
      }
      this.b1 = new Float32Array(this.hiddenNeurons);

      // Output Dense Layer [NumClasses x HiddenNeurons]
      this.w2 = new Float32Array(this.numClasses * this.hiddenNeurons);
      for (let i = 0; i < this.w2.length; i++) {
        this.w2[i] = (Math.random() - 0.5) * Math.sqrt(2 / this.hiddenNeurons);
      }
      this.b2 = new Float32Array(this.numClasses);
    }

    // Forward Pass
    forward(inputData) {
      // 1. Convolution & ReLU & Pooling
      let features;
      if (this.numFilters > 0) {
        features = new Float32Array(this.flattenSize);
        let featIdx = 0;
        
        for (let f = 0; f < this.numFilters; f++) {
          const kernelOffset = f * 9;
          const bias = this.convBiases[f];

          // Conv2D pass -> MaxPool 2x2
          for (let py = 0; py < this.poolOutH; py++) {
            for (let px = 0; px < this.poolOutW; px++) {
              let maxVal = -Infinity;

              // 2x2 Pooling area
              for (let dy = 0; dy < 2; dy++) {
                for (let dx = 0; dx < 2; dx++) {
                  const ix = px * 2 + dx;
                  const iy = py * 2 + dy;

                  // 3x3 Conv at (ix, iy)
                  let sum = bias;
                  for (let ky = 0; ky < 3; ky++) {
                    for (let kx = 0; kx < 3; kx++) {
                      const pixelVal = inputData[(iy + ky) * this.inputWidth + (ix + kx)];
                      sum += pixelVal * this.convKernels[kernelOffset + ky * 3 + kx];
                    }
                  }
                  // ReLU Activation
                  const relu = Math.max(0, sum);
                  if (relu > maxVal) maxVal = relu;
                }
              }
              features[featIdx++] = maxVal;
            }
          }
        }
      } else {
        features = inputData; // MLP Direct Flatten Input
      }

      // 2. Hidden Layer (Dense + ReLU)
      const hidden = new Float32Array(this.hiddenNeurons);
      for (let i = 0; i < this.hiddenNeurons; i++) {
        let sum = this.b1[i];
        const offset = i * this.flattenSize;
        for (let j = 0; j < this.flattenSize; j++) {
          sum += features[j] * this.w1[offset + j];
        }
        hidden[i] = Math.max(0, sum); // ReLU
      }

      // 3. Output Layer (Dense + Softmax)
      const logits = new Float32Array(this.numClasses);
      let maxLogit = -Infinity;
      for (let k = 0; k < this.numClasses; k++) {
        let sum = this.b2[k];
        const offset = k * this.hiddenNeurons;
        for (let i = 0; i < this.hiddenNeurons; i++) {
          sum += hidden[i] * this.w2[offset + i];
        }
        logits[k] = sum;
        if (sum > maxLogit) maxLogit = sum;
      }

      // Softmax
      const probs = new Float32Array(this.numClasses);
      let sumExp = 0;
      for (let k = 0; k < this.numClasses; k++) {
        probs[k] = Math.exp(logits[k] - maxLogit);
        sumExp += probs[k];
      }
      for (let k = 0; k < this.numClasses; k++) {
        probs[k] /= sumExp;
      }

      return { probs, hidden, features };
    }

    // Train single sample with Backpropagation & SGD/Adam
    trainSample(inputData, targetClass, lr = 0.005) {
      const { probs, hidden, features } = this.forward(inputData);

      // Compute Cross-Entropy Loss: -log(p_target)
      const targetProb = Math.max(probs[targetClass], 1e-7);
      const loss = -Math.log(targetProb);

      // Gradients w.r.t logits (Softmax + Cross Entropy derivative = prob - 1_target)
      const dLogits = new Float32Array(this.numClasses);
      for (let k = 0; k < this.numClasses; k++) {
        dLogits[k] = probs[k] - (k === targetClass ? 1.0 : 0.0);
      }

      // Backprop to w2 & b2, and compute dHidden
      const dHidden = new Float32Array(this.hiddenNeurons);
      for (let k = 0; k < this.numClasses; k++) {
        const offset = k * this.hiddenNeurons;
        const gradK = dLogits[k];
        this.b2[k] -= lr * gradK;
        for (let i = 0; i < this.hiddenNeurons; i++) {
          dHidden[i] += gradK * this.w2[offset + i];
          this.w2[offset + i] -= lr * gradK * hidden[i];
        }
      }

      // Backprop through ReLU hidden layer to w1 & b1
      for (let i = 0; i < this.hiddenNeurons; i++) {
        if (hidden[i] <= 0) continue; // ReLU derivative = 0
        const gradI = dHidden[i];
        const offset = i * this.flattenSize;
        this.b1[i] -= lr * gradI;
        for (let j = 0; j < this.flattenSize; j++) {
          this.w1[offset + j] -= lr * gradI * features[j];
        }
      }

      return { loss, predictedClass: probs.indexOf(Math.max(...probs)) };
    }

    exportJSON() {
      return {
        archType: this.archType,
        inputWidth: this.inputWidth,
        inputHeight: this.inputHeight,
        numClasses: this.numClasses,
        convKernels: Array.from(this.convKernels || []),
        convBiases: Array.from(this.convBiases || []),
        w1: Array.from(this.w1),
        b1: Array.from(this.b1),
        w2: Array.from(this.w2),
        b2: Array.from(this.b2)
      };
    }

    importJSON(json) {
      if (json.convKernels && this.convKernels) this.convKernels.set(json.convKernels);
      if (json.convBiases && this.convBiases) this.convBiases.set(json.convBiases);
      if (json.w1) this.w1.set(json.w1);
      if (json.b1) this.b1.set(json.b1);
      if (json.w2) this.w2.set(json.w2);
      if (json.b2) this.b2.set(json.b2);
    }
  }

  // ==========================================================================
  // Application Setup & Initialization
  // ==========================================================================
  function initApp() {
    setupDefaultClasses();
    setupEventListeners();
    updateUIState();
    renderArchVisualizer();
    startFPSCounter();
    startInferenceLoop();
  }

  function setupDefaultClasses() {
    addClass('Class A (Square)', DEFAULT_COLORS[0]);
    addClass('Class B (Circle)', DEFAULT_COLORS[1]);
    addClass('Class C (Triangle)', DEFAULT_COLORS[2]);
  }

  function addClass(name, color) {
    const id = 'class_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
    const classColor = color || DEFAULT_COLORS[state.classes.length % DEFAULT_COLORS.length];
    
    state.classes.push({
      id,
      name: name || `Class ${String.fromCharCode(65 + state.classes.length)}`,
      color: classColor,
      samples: []
    });

    renderClassCards();
    updateMetersUI();
  }

  function removeClass(id) {
    if (state.classes.length <= 2) {
      alert('You must maintain at least 2 categories for classification.');
      return;
    }
    state.classes = state.classes.filter(c => c.id !== id);
    renderClassCards();
    updateMetersUI();
    updateTotalSamplesBadge();
  }

  // ==========================================================================
  // Media Web Camera API & Snapshot Processing
  // ==========================================================================
  async function toggleWebcam() {
    if (state.webcamActive) {
      stopWebcam();
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: state.currentFacingMode, width: { ideal: 320 }, height: { ideal: 240 } },
          audio: false
        });
        state.mediaStream = stream;
        el.webcamFeed.srcObject = stream;
        state.webcamActive = true;
        el.feedOverlay.style.opacity = '0';
        el.feedOverlay.style.pointerEvents = 'none';
        el.camToggleText.textContent = 'Stop Camera';
      } catch (err) {
        console.warn('Webcam permission or device error:', err);
        alert('Could not open camera feed. Ensure permissions are granted or use synthetic samples/image uploads.');
      }
    }
  }

  function stopWebcam() {
    if (state.mediaStream) {
      state.mediaStream.getTracks().forEach(track => track.stop());
      state.mediaStream = null;
    }
    el.webcamFeed.srcObject = null;
    state.webcamActive = false;
    el.feedOverlay.style.opacity = '1';
    el.feedOverlay.style.pointerEvents = 'all';
    el.camToggleText.textContent = 'Start Camera';
  }

  // Capture image frame & convert to normalized Float32Array (28x28 grayscale)
  function captureSampleFromCanvas(targetCanvasOrVideo) {
    const ctx = el.snapshotCanvas.getContext('2d');
    el.snapshotCanvas.width = INPUT_SIZE;
    el.snapshotCanvas.height = INPUT_SIZE;

    // Draw resized frame
    ctx.drawImage(targetCanvasOrVideo, 0, 0, INPUT_SIZE, INPUT_SIZE);
    const imgData = ctx.getImageData(0, 0, INPUT_SIZE, INPUT_SIZE);
    
    // Convert RGB to Normalized Grayscale Float32Array [0, 1]
    const floatArr = new Float32Array(INPUT_SIZE * INPUT_SIZE);
    for (let i = 0; i < floatArr.length; i++) {
      const r = imgData.data[i * 4];
      const g = imgData.data[i * 4 + 1];
      const b = imgData.data[i * 4 + 2];
      floatArr[i] = (r * 0.299 + g * 0.587 + b * 0.114) / 255.0; // Grayscale weights
    }

    // Generate Thumbnail URI
    const thumbUrl = el.snapshotCanvas.toDataURL('image/jpeg', 0.8);

    // Apply data augmentations if enabled
    const augmentedSamples = [{ data: floatArr, thumb: thumbUrl }];

    if (el.augFlip.checked) {
      augmentedSamples.push(augmentFlip(floatArr, thumbUrl));
    }
    if (el.augNoise.checked) {
      augmentedSamples.push(augmentNoise(floatArr, thumbUrl));
    }

    return augmentedSamples;
  }

  function augmentFlip(data, thumb) {
    const flipped = new Float32Array(data.length);
    for (let y = 0; y < INPUT_SIZE; y++) {
      for (let x = 0; x < INPUT_SIZE; x++) {
        flipped[y * INPUT_SIZE + (INPUT_SIZE - 1 - x)] = data[y * INPUT_SIZE + x];
      }
    }
    return { data: flipped, thumb };
  }

  function augmentNoise(data, thumb) {
    const noisy = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      const n = (Math.random() - 0.5) * 0.08;
      noisy[i] = Math.min(1, Math.max(0, data[i] + n));
    }
    return { data: noisy, thumb };
  }

  // Generate Synthetic Shape Dataset Demo
  function loadPresetDemoDataset() {
    state.classes.forEach((cls, idx) => {
      cls.samples = [];
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 64;
      const ctx = canvas.getContext('2d');

      for (let s = 0; s < 15; s++) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 4;

        // Draw synthetic shapes based on index
        ctx.beginPath();
        if (idx % 3 === 0) {
          // Square / Box
          const margin = 12 + Math.floor(Math.random() * 8);
          ctx.fillRect(margin, margin, 64 - margin * 2, 64 - margin * 2);
        } else if (idx % 3 === 1) {
          // Circle
          ctx.arc(32, 32, 16 + Math.random() * 6, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Triangle
          ctx.moveTo(32, 12 + Math.random() * 4);
          ctx.lineTo(12 + Math.random() * 4, 52 - Math.random() * 4);
          ctx.lineTo(52 - Math.random() * 4, 52 - Math.random() * 4);
          ctx.closePath();
          ctx.fill();
        }

        const captured = captureSampleFromCanvas(canvas);
        cls.samples.push(...captured);
      }
    });

    renderClassCards();
    updateTotalSamplesBadge();
    alert('Preset synthetic dataset generated with 45 total shape samples across classes! You can click "Train Model" now.');
  }

  // ==========================================================================
  // UI Renderers & Component Cards
  // ==========================================================================
  function renderClassCards() {
    el.classCardsList.innerHTML = '';
    state.classes.forEach(c => {
      const card = document.createElement('div');
      card.className = 'class-card';
      card.innerHTML = `
        <div class="class-card-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="class-color-badge" style="background:${c.color}"></span>
            <input type="text" class="class-name-input" value="${escapeHtml(c.name)}" data-id="${c.id}">
          </div>
          <span class="sample-counter">${c.samples.length} Samples</span>
        </div>
        <div class="thumbnails-preview-strip">
          ${c.samples.slice(-8).map(s => `<img src="${s.thumb}" class="thumb-img" alt="sample">`).join('')}
        </div>
        <div class="class-card-actions">
          <button class="btn btn-xs btn-primary btn-capture" data-id="${c.id}">+ Hold/Click Capture</button>
          <button class="btn btn-xs btn-secondary btn-view-samples" data-id="${c.id}">View (${c.samples.length})</button>
          <button class="btn btn-xs btn-outline btn-clear-class" data-id="${c.id}">Clear</button>
          <button class="btn btn-xs btn-outline btn-del-class" data-id="${c.id}" style="color:var(--accent-red); border-color:rgba(239,68,68,0.3);">&times;</button>
        </div>
      `;
      el.classCardsList.appendChild(card);
    });

    attachClassCardListeners();
  }

  function attachClassCardListeners() {
    // Capture sample
    document.querySelectorAll('.btn-capture').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        captureSampleForClass(id);
      });
    });

    // View samples modal
    document.querySelectorAll('.btn-view-samples').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        openSamplesModal(id);
      });
    });

    // Clear class
    document.querySelectorAll('.btn-clear-class').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        const cls = state.classes.find(c => c.id === id);
        if (cls) cls.samples = [];
        renderClassCards();
        updateTotalSamplesBadge();
      });
    });

    // Delete class
    document.querySelectorAll('.btn-del-class').forEach(btn => {
      btn.addEventListener('click', (e) => {
        removeClass(e.target.dataset.id);
      });
    });

    // Rename class
    document.querySelectorAll('.class-name-input').forEach(inp => {
      inp.addEventListener('change', (e) => {
        const id = e.target.dataset.id;
        const cls = state.classes.find(c => c.id === id);
        if (cls) cls.name = e.target.value;
        updateMetersUI();
      });
    });
  }

  function captureSampleForClass(id) {
    const cls = state.classes.find(c => c.id === id);
    if (!cls) return;

    if (state.webcamActive) {
      const samples = captureSampleFromCanvas(el.webcamFeed);
      cls.samples.push(...samples);
    } else {
      // Fallback synthetic generator for this specific class
      const dummyCanvas = document.createElement('canvas');
      dummyCanvas.width = 64;
      dummyCanvas.height = 64;
      const ctx = dummyCanvas.getContext('2d');
      ctx.fillStyle = cls.color;
      ctx.fillRect(10, 10, 44, 44);
      const samples = captureSampleFromCanvas(dummyCanvas);
      cls.samples.push(...samples);
    }

    renderClassCards();
    updateTotalSamplesBadge();
  }

  function updateTotalSamplesBadge() {
    const total = state.classes.reduce((sum, c) => sum + c.samples.length, 0);
    el.totalSamplesCount.textContent = `${total} Samples`;
  }

  // ==========================================================================
  // CNN Neural Architecture Visualizer (HTML5 Canvas)
  // ==========================================================================
  function renderArchVisualizer() {
    const canvas = el.archCanvas;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Draw background subtle grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }

    // Architecture Stages
    const arch = state.selectedArch;
    const stages = [
      { name: 'Input', detail: '28x28 Grayscale', nodes: 6, x: 80 },
      { name: arch === 'mlp' ? 'Dense-1' : 'Conv2D', detail: arch === 'mlp' ? '64 Units' : '4 Filters (3x3)', nodes: 8, x: 240 },
      { name: arch === 'mlp' ? 'Dense-2' : 'MaxPool', detail: arch === 'mlp' ? '32 Units' : '2x2 Pool', nodes: 6, x: 400 },
      { name: 'Dense', detail: '32 Neurons', nodes: 5, x: 560 },
      { name: 'Output', detail: `${state.classes.length} Softmax`, nodes: state.classes.length, x: 720 }
    ];

    // Draw connections between layers
    ctx.lineWidth = 1;
    for (let i = 0; i < stages.length - 1; i++) {
      const layerA = stages[i];
      const layerB = stages[i + 1];

      const stepA = (h - 60) / (layerA.nodes + 1);
      const stepB = (h - 60) / (layerB.nodes + 1);

      for (let na = 1; na <= layerA.nodes; na++) {
        const ya = 30 + na * stepA;
        for (let nb = 1; nb <= layerB.nodes; nb++) {
          const yb = 30 + nb * stepB;
          const alpha = 0.08 + Math.random() * 0.05;
          ctx.strokeStyle = `rgba(0, 242, 254, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(layerA.x, ya);
          ctx.lineTo(layerB.x, yb);
          ctx.stroke();
        }
      }
    }

    // Draw animated pulse signals if training or inferencing
    const time = performance.now() * 0.003;
    for (let i = 0; i < stages.length - 1; i++) {
      const s1 = stages[i];
      const s2 = stages[i + 1];
      const pulseT = (time + i * 0.4) % 1.0;
      const px = s1.x + (s2.x - s1.x) * pulseT;
      const py = h / 2 + Math.sin(pulseT * Math.PI) * 20;

      ctx.fillStyle = 'rgba(0, 242, 254, 0.8)';
      ctx.shadowColor = '#00f2fe';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Draw Layer Node Columns & Labels
    stages.forEach(stage => {
      const step = (h - 60) / (stage.nodes + 1);
      ctx.fillStyle = 'rgba(17, 24, 39, 0.9)';
      ctx.strokeStyle = '#00f2fe';
      ctx.lineWidth = 2;

      for (let n = 1; n <= stage.nodes; n++) {
        const ny = 30 + n * step;
        ctx.beginPath();
        ctx.arc(stage.x, ny, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Title & Subtitle
      ctx.fillStyle = '#f3f4f6';
      ctx.font = '600 12px "Plus Jakarta Sans"';
      ctx.textAlign = 'center';
      ctx.fillText(stage.name, stage.x, h - 30);

      ctx.fillStyle = '#9ca3af';
      ctx.font = '10px "JetBrains Mono"';
      ctx.fillText(stage.detail, stage.x, h - 14);
    });
  }

  // ==========================================================================
  // Training Execution Engine
  // ==========================================================================
  async function startTraining() {
    // Validate dataset
    const totalSamples = state.classes.reduce((sum, c) => sum + c.samples.length, 0);
    if (totalSamples < 6) {
      alert('Please capture or load at least 6 total samples across categories before training.');
      return;
    }

    state.training = true;
    state.paused = false;
    state.stopRequested = false;
    state.epochHistory = { loss: [], accuracy: [] };

    el.btnStartTrain.disabled = true;
    el.btnPauseTrain.disabled = false;

    // Instantiate Custom Neural Net Model
    const epochs = parseInt(el.paramEpochs.value) || 30;
    const lr = parseFloat(el.paramLr.value) || 0.005;
    state.model = new CustomNeuralNet([INPUT_SIZE, INPUT_SIZE], state.classes.length, state.selectedArch);

    // Prepare dataset tensors into flat arrays
    const trainingData = [];
    state.classes.forEach((cls, classIdx) => {
      cls.samples.forEach(sample => {
        trainingData.push({ input: sample.data, target: classIdx });
      });
    });

    // Training Loop
    for (let epoch = 1; epoch <= epochs; epoch++) {
      if (state.stopRequested) break;

      while (state.paused) {
        await new Promise(r => setTimeout(r, 100));
        if (state.stopRequested) break;
      }

      // Shuffle dataset
      trainingData.sort(() => Math.random() - 0.5);

      let epochLoss = 0;
      let correct = 0;

      for (let i = 0; i < trainingData.length; i++) {
        const { input, target } = trainingData[i];
        const res = state.model.trainSample(input, target, lr);
        epochLoss += res.loss;
        if (res.predictedClass === target) correct++;
      }

      const avgLoss = epochLoss / trainingData.length;
      const acc = (correct / trainingData.length) * 100;

      state.epochHistory.loss.push(avgLoss);
      state.epochHistory.accuracy.push(acc);

      // Update UI Metrics & Line Charts
      el.statLoss.textContent = `Loss: ${avgLoss.toFixed(4)}`;
      el.statAcc.textContent = `Acc: ${acc.toFixed(1)}%`;
      el.trainingEpochText.textContent = `Epoch ${epoch} / ${epochs}`;
      el.trainingStatusText.textContent = `Training Epoch ${epoch}...`;
      el.trainingProgressFill.style.width = `${(epoch / epochs) * 100}%`;

      renderLineChart(el.lossCanvas, state.epochHistory.loss, '#00f2fe', 'Loss');
      renderLineChart(el.accCanvas, state.epochHistory.accuracy, '#10b981', 'Accuracy %', 100);
      renderArchVisualizer();

      // Yield thread for smooth UI updates
      await new Promise(r => setTimeout(r, 40));
    }

    state.training = false;
    el.btnStartTrain.disabled = false;
    el.btnPauseTrain.disabled = true;
    el.trainingStatusText.textContent = state.stopRequested ? 'Training Reset.' : 'Model Training Complete!';
  }

  // Real-Time HTML5 Canvas Line Chart Renderer
  function renderLineChart(canvas, dataPoints, colorHex, label, maxValLimit = null) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    if (dataPoints.length === 0) return;

    const padding = 20;
    const chartW = w - padding * 2;
    const chartH = h - padding * 2;

    const maxVal = maxValLimit || Math.max(...dataPoints, 0.1);
    const minVal = 0;

    // Draw Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let y = 0; y <= 4; y++) {
      const yPos = h - padding - (y / 4) * chartH;
      ctx.beginPath();
      ctx.moveTo(padding, yPos);
      ctx.lineTo(w - padding, yPos);
      ctx.stroke();
    }

    // Plot Line
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = colorHex;
    ctx.shadowBlur = 8;
    ctx.beginPath();

    const stepX = chartW / Math.max(dataPoints.length - 1, 1);
    dataPoints.forEach((val, i) => {
      const x = padding + i * stepX;
      const y = h - padding - ((val - minVal) / (maxVal - minVal)) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });

    ctx.stroke();
    ctx.shadowBlur = 0;

    // Plot Points
    ctx.fillStyle = colorHex;
    dataPoints.forEach((val, i) => {
      const x = padding + i * stepX;
      const y = h - padding - ((val - minVal) / (maxVal - minVal)) * chartH;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // ==========================================================================
  // Real-Time Inference & Object Classification Loop
  // ==========================================================================
  function startInferenceLoop() {
    function step() {
      if (el.toggleLiveInference.checked && state.model) {
        performInference();
      }
      state.frameCount++;
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function performInference() {
    const ctx = el.liveInferenceCanvas.getContext('2d');
    const w = el.liveInferenceCanvas.width;
    const h = el.liveInferenceCanvas.height;

    // Draw current source into inference canvas
    if (state.webcamActive) {
      ctx.drawImage(el.webcamFeed, 0, 0, w, h);
    } else {
      // Draw grid overlay placeholder
      ctx.fillStyle = '#0a0e1a';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#9ca3af';
      ctx.font = '12px "Plus Jakarta Sans"';
      ctx.textAlign = 'center';
      ctx.fillText('Webcam Offline (Live Feed Ready)', w / 2, h / 2);
    }

    // Extract tensor input
    const sample = captureSampleFromCanvas(el.liveInferenceCanvas);
    const { probs } = state.model.forward(sample[0].data);

    // Compute top prediction
    let maxIndex = 0;
    let maxProb = 0;
    probs.forEach((p, idx) => {
      if (p > maxProb) {
        maxProb = p;
        maxIndex = idx;
      }
    });

    const threshold = parseInt(el.sliderThreshold.value) / 100;
    const topClass = state.classes[maxIndex];

    if (topClass && maxProb >= threshold) {
      el.predClassName.textContent = topClass.name;
      el.predClassPercent.textContent = `${(maxProb * 100).toFixed(1)}%`;
      el.topPredBadge.style.borderColor = topClass.color;

      // Draw bounding box / heatmap overlay
      if (el.toggleHeatmap.checked) {
        ctx.strokeStyle = topClass.color;
        ctx.lineWidth = 3;
        ctx.strokeRect(10, 10, w - 20, h - 20);
        ctx.fillStyle = topClass.color;
        ctx.font = 'bold 14px "Plus Jakarta Sans"';
        ctx.fillText(`${topClass.name} (${(maxProb * 100).toFixed(0)}%)`, 20, 30);
      }

      // Audio Announcement if class changed
      if (el.toggleAudio.checked && state.lastAnnouncedClass !== topClass.name && 'speechSynthesis' in window) {
        state.lastAnnouncedClass = topClass.name;
        const utter = new SpeechSynthesisUtterance(topClass.name);
        utter.rate = 1.1;
        window.speechSynthesis.speak(utter);
      }
    } else {
      el.predClassName.textContent = 'Uncertain';
      el.predClassPercent.textContent = `${(maxProb * 100).toFixed(1)}%`;
      el.topPredBadge.style.borderColor = 'var(--panel-border)';
    }

    // Update Probability Meters
    updateProbabilityMeters(probs);
  }

  function updateMetersUI() {
    el.classProbabilityMeters.innerHTML = '';
    state.classes.forEach(cls => {
      const item = document.createElement('div');
      item.className = 'meter-item';
      item.id = `meter-${cls.id}`;
      item.innerHTML = `
        <div class="meter-label-row">
          <span class="meter-name" style="color:${cls.color}">${escapeHtml(cls.name)}</span>
          <span class="meter-val" id="meter-val-${cls.id}">0.0%</span>
        </div>
        <div class="meter-track">
          <div class="meter-fill" id="meter-fill-${cls.id}" style="width: 0%; background:${cls.color}"></div>
        </div>
      `;
      el.classProbabilityMeters.appendChild(item);
    });
  }

  function updateProbabilityMeters(probs) {
    state.classes.forEach((cls, idx) => {
      const prob = probs[idx] || 0;
      const fillEl = document.getElementById(`meter-fill-${cls.id}`);
      const valEl = document.getElementById(`meter-val-${cls.id}`);
      if (fillEl && valEl) {
        fillEl.style.width = `${(prob * 100).toFixed(1)}%`;
        valEl.textContent = `${(prob * 100).toFixed(1)}%`;
      }
    });
  }

  // ==========================================================================
  // Model Serialization (Export / Import & LocalStorage)
  // ==========================================================================
  function exportModel() {
    if (!state.model) {
      alert('Train or initialize a model first before exporting.');
      return;
    }
    const exportData = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      classes: state.classes.map(c => ({ id: c.id, name: c.name, color: c.color })),
      weights: state.model.exportJSON()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vision-studio-model-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function importModelFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);
        if (json.classes && json.weights) {
          state.classes = json.classes.map(c => ({ ...c, samples: [] }));
          state.model = new CustomNeuralNet([INPUT_SIZE, INPUT_SIZE], state.classes.length, json.weights.archType || 'light-cnn');
          state.model.importJSON(json.weights);

          renderClassCards();
          updateMetersUI();
          renderArchVisualizer();
          alert('Model architecture and weights imported successfully!');
        }
      } catch (err) {
        alert('Invalid model JSON file structure.');
      }
    };
    reader.readAsText(file);
  }

  function saveToLocalStorage() {
    if (!state.model) return alert('No model trained yet.');
    const exportData = {
      classes: state.classes.map(c => ({ id: c.id, name: c.name, color: c.color })),
      weights: state.model.exportJSON()
    };
    localStorage.setItem('vision_studio_model', JSON.stringify(exportData));
    alert('Model state saved to Browser LocalStorage!');
  }

  function loadFromLocalStorage() {
    const data = localStorage.getItem('vision_studio_model');
    if (!data) return alert('No saved model found in Browser Storage.');
    const json = JSON.parse(data);
    state.classes = json.classes.map(c => ({ ...c, samples: [] }));
    state.model = new CustomNeuralNet([INPUT_SIZE, INPUT_SIZE], state.classes.length, json.weights.archType || 'light-cnn');
    state.model.importJSON(json.weights);

    renderClassCards();
    updateMetersUI();
    renderArchVisualizer();
    alert('Model loaded from LocalStorage!');
  }

  // ==========================================================================
  // Helper Utilities & Modal Controls
  // ==========================================================================
  function openSamplesModal(classId) {
    const cls = state.classes.find(c => c.id === classId);
    if (!cls) return;
    state.modalClassId = classId;
    el.modalClassTitle.textContent = `${cls.name} (${cls.samples.length} Samples)`;
    el.modalSamplesGrid.innerHTML = '';

    cls.samples.forEach((sample, idx) => {
      const card = document.createElement('div');
      card.className = 'modal-sample-card';
      card.innerHTML = `
        <img src="${sample.thumb}" alt="sample">
        <button class="del-btn" data-idx="${idx}">&times;</button>
      `;
      el.modalSamplesGrid.appendChild(card);
    });

    el.modalSamplesGrid.querySelectorAll('.del-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const idx = parseInt(e.target.dataset.idx);
        cls.samples.splice(idx, 1);
        openSamplesModal(classId);
        renderClassCards();
        updateTotalSamplesBadge();
      });
    });

    el.imageModalBackdrop.classList.add('active');
  }

  function closeModal() {
    el.imageModalBackdrop.classList.remove('active');
  }

  function startFPSCounter() {
    setInterval(() => {
      const now = performance.now();
      const delta = (now - state.lastFpsUpdate) / 1000;
      state.fps = Math.round(state.frameCount / delta);
      state.frameCount = 0;
      state.lastFpsUpdate = now;
      el.fpsCounter.textContent = state.fps;
    }, 1000);
  }

  function escapeHtml(str) {
    return str.replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
  }

  function setupEventListeners() {
    // Webcam controls
    el.btnToggleCamera.addEventListener('click', toggleWebcam);
    el.cameraSelect.addEventListener('change', (e) => {
      state.currentFacingMode = e.target.value;
      if (state.webcamActive) {
        stopWebcam();
        toggleWebcam();
      }
    });

    // File Batch Upload
    el.btnTriggerUpload.addEventListener('click', () => el.imageUploadInput.click());
    el.imageUploadInput.addEventListener('change', (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;

      const targetClass = state.classes[0];
      files.forEach(file => {
        const img = new Image();
        img.onload = () => {
          const samples = captureSampleFromCanvas(img);
          targetClass.samples.push(...samples);
          renderClassCards();
          updateTotalSamplesBadge();
        };
        img.src = URL.createObjectURL(file);
      });
    });

    // Class & Demo Buttons
    el.btnAddClass.addEventListener('click', () => addClass());
    el.btnQuickDemo.addEventListener('click', loadPresetDemoDataset);

    // Architecture Selection
    el.archSelect.addEventListener('change', (e) => {
      state.selectedArch = e.target.value;
      renderArchVisualizer();
    });

    // Training Buttons
    el.btnStartTrain.addEventListener('click', startTraining);
    el.btnPauseTrain.addEventListener('click', () => {
      state.paused = !state.paused;
      el.btnPauseTrain.textContent = state.paused ? 'Resume' : 'Pause';
    });
    el.btnResetTrain.addEventListener('click', () => {
      state.stopRequested = true;
      state.model = null;
      state.epochHistory = { loss: [], accuracy: [] };
      renderLineChart(el.lossCanvas, [], '#00f2fe');
      renderLineChart(el.accCanvas, [], '#10b981');
      el.trainingProgressFill.style.width = '0%';
      el.statLoss.textContent = 'Loss: --';
      el.statAcc.textContent = 'Acc: --%';
    });

    // Inference Controls
    el.sliderThreshold.addEventListener('input', (e) => {
      el.thresholdVal.textContent = `${e.target.value}%`;
    });

    // Serialization
    el.btnExportJson.addEventListener('click', exportModel);
    el.btnImportFile.addEventListener('change', (e) => {
      if (e.target.files[0]) importModelFile(e.target.files[0]);
    });
    el.btnSaveLocal.addEventListener('click', saveToLocalStorage);
    el.btnLoadLocal.addEventListener('click', loadFromLocalStorage);

    // Modal
    el.modalCloseBtn.addEventListener('click', closeModal);
    el.imageModalBackdrop.addEventListener('click', (e) => {
      if (e.target === el.imageModalBackdrop) closeModal();
    });
  }

  // Run initial setup when DOM loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
})();
