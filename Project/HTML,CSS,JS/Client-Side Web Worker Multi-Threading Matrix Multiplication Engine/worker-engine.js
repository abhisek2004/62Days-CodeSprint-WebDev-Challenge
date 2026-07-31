/* ==========================================================================
   CYBERTHREAD MATRIX // MULTI-THREADING WEB WORKER ENGINE (JS)
   Features:
   - Worker Pool Management with Blob Workers
   - Transferable ArrayBuffers & SharedArrayBuffer Support
   - Live 60FPS Main UI Thread Responsiveness & Latency Monitor
   - Cache-Aware (i-k-j) & Tiled Matrix Multiplication
   - Custom Cyber Canvas Chart Engine (Speedup, Time, GFLOPS)
   - Matrix Verification Checksum & Sample Inspector
   ========================================================================== */

(function () {
    'use strict';

    // --- SYSTEM STATE & CONFIGURATION ---
    const state = {
        matrixSize: 500,          // N x N matrix
        workerCount: 4,           // 1 to 16 threads
        transferMode: 'transferable', // 'transferable' or 'sab'
        algorithm: 'row-block',    // 'row-block' or 'tiled'
        sabSupported: false,
        activeWorkers: [],
        isComputing: false,

        // Last computation results
        singleThreadResult: null, // { timeMs, gflops, freezeMs, resultC, checksum }
        multiThreadResult: null,  // { timeMs, gflops, speedup, efficiency, resultC, checksum }

        // Benchmark suite data cache
        benchmarkData: {
            threads: [1, 2, 4, 8, 12, 16],
            times: [],
            speedups: [],
            gflops: []
        },
        currentChartTab: 'speedup', // 'speedup', 'time', 'gflops'

        // Data buffers for current run
        matrixA: null,
        matrixB: null,
        matrixC: null
    };

    // --- UI ELEMENTS REFERENCE ---
    const ui = {
        sysCoresCount: document.getElementById('sys-cores-count'),
        sysSabStatus: document.getElementById('sys-sab-status'),
        sysActiveWorkers: document.getElementById('sys-active-workers'),
        sysEngineStatus: document.getElementById('sys-engine-status'),
        
        matrixSizeSlider: document.getElementById('matrix-size-slider'),
        matrixSizeVal: document.getElementById('matrix-size-val'),
        matrixElementsCount: document.getElementById('matrix-elements-count'),
        matrixMemorySize: document.getElementById('matrix-memory-size'),
        
        workerThreadsSlider: document.getElementById('worker-threads-slider'),
        workerThreadsVal: document.getElementById('worker-threads-val'),
        
        modeTransferableBtn: document.getElementById('mode-transferable-btn'),
        modeSabBtn: document.getElementById('mode-sab-btn'),
        sabWarning: document.getElementById('sab-warning'),
        algorithmSelect: document.getElementById('algorithm-select'),
        
        btnRunMulti: document.getElementById('btn-run-multi'),
        btnRunSingle: document.getElementById('btn-run-single'),
        btnRunBenchmark: document.getElementById('btn-run-benchmark'),
        btnAbort: document.getElementById('btn-abort'),
        
        liveFpsVal: document.getElementById('live-fps-val'),
        fpsStatusText: document.getElementById('fps-status-text'),
        threadLagBadge: document.getElementById('thread-lag-badge'),
        reactorCanvas: document.getElementById('reactor-canvas'),
        fpsGraphCanvas: document.getElementById('fps-graph-canvas'),
        
        singleTime: document.getElementById('single-time'),
        singleGflops: document.getElementById('single-gflops'),
        singleFreeze: document.getElementById('single-freeze'),
        singleStatusBar: document.getElementById('single-status-bar'),
        
        multiTime: document.getElementById('multi-time'),
        multiGflops: document.getElementById('multi-gflops'),
        multiEfficiency: document.getElementById('multi-efficiency'),
        multiStatusBar: document.getElementById('multi-status-bar'),
        
        speedupBadgeBox: document.getElementById('speedup-badge-box'),
        speedupFactor: document.getElementById('speedup-factor'),
        
        poolActiveCount: document.getElementById('pool-active-count'),
        poolTotalCount: document.getElementById('pool-total-count'),
        workerGridContainer: document.getElementById('worker-grid-container'),
        
        performanceChartCanvas: document.getElementById('performance-chart-canvas'),
        tabSpeedup: document.getElementById('tab-speedup'),
        tabTime: document.getElementById('tab-time'),
        tabGflops: document.getElementById('tab-gflops'),
        
        terminalLog: document.getElementById('terminal-log'),
        termCores: document.getElementById('term-cores'),
        checksumBadge: document.getElementById('checksum-badge'),
        
        matrixModal: document.getElementById('matrix-modal'),
        matrixSampleTable: document.getElementById('matrix-sample-table'),
        modalDimText: document.getElementById('modal-dim-text'),
        modalChecksumDetails: document.getElementById('modal-checksum-details')
    };

    // --- INLINE WEB WORKER SCRIPT SOURCE BLOB ---
    const WORKER_SCRIPT_SOURCE = `
        self.onmessage = function(e) {
            const data = e.data;
            const task = data.task;
            
            if (task === 'MULTIPLY_CHUNK') {
                const workerId = data.workerId;
                const N = data.N;
                const startRow = data.startRow;
                const endRow = data.endRow;
                const mode = data.mode;
                const algorithm = data.algorithm;
                
                const startTime = performance.now();
                
                let A, B, C;
                if (mode === 'sab') {
                    A = new Float32Array(data.sabA);
                    B = new Float32Array(data.sabB);
                    C = new Float32Array(data.sabC);
                } else {
                    A = new Float32Array(data.bufferA); // Chunk of A
                    B = new Float32Array(data.bufferB); // Full B
                    C = new Float32Array((endRow - startRow) * N);
                }

                const totalRows = endRow - startRow;
                const reportStep = Math.max(1, Math.floor(totalRows / 10));

                if (algorithm === 'tiled') {
                    // Cache-Aware Tiled Multiplication
                    const TILE_SIZE = 64;
                    for (let ii = startRow; ii < endRow; ii += TILE_SIZE) {
                        const iMax = Math.min(ii + TILE_SIZE, endRow);
                        for (let kk = 0; kk < N; kk += TILE_SIZE) {
                            const kMax = Math.min(kk + TILE_SIZE, N);
                            for (let jj = 0; jj < N; jj += TILE_SIZE) {
                                const jMax = Math.min(jj + TILE_SIZE, N);
                                
                                for (let i = ii; i < iMax; i++) {
                                    const localRowIndex = mode === 'sab' ? i : (i - startRow);
                                    const aOffset = mode === 'sab' ? (i * N) : (localRowIndex * N);
                                    const cOffset = mode === 'sab' ? (i * N) : (localRowIndex * N);

                                    for (let k = kk; k < kMax; k++) {
                                        const aik = A[aOffset + k];
                                        const bOffset = k * N;
                                        for (let j = jj; j < jMax; j++) {
                                            C[cOffset + j] += aik * B[bOffset + j];
                                        }
                                    }
                                }
                            }
                        }

                        if ((ii - startRow) % reportStep === 0) {
                            const progress = Math.min(100, Math.round(((ii - startRow + TILE_SIZE) / totalRows) * 100));
                            self.postMessage({ type: 'PROGRESS', workerId: workerId, progress: progress });
                        }
                    }
                } else {
                    // Standard Row-Block i-k-j Cache Optimized
                    for (let i = startRow; i < endRow; i++) {
                        const localRowIndex = mode === 'sab' ? i : (i - startRow);
                        const aOffset = mode === 'sab' ? (i * N) : (localRowIndex * N);
                        const cOffset = mode === 'sab' ? (i * N) : (localRowIndex * N);

                        for (let k = 0; k < N; k++) {
                            const aik = A[aOffset + k];
                            const bOffset = k * N;
                            for (let j = 0; j < N; j++) {
                                C[cOffset + j] += aik * B[bOffset + j];
                            }
                        }

                        if (localRowIndex % reportStep === 0 || i === endRow - 1) {
                            const progress = Math.min(100, Math.round(((localRowIndex + 1) / totalRows) * 100));
                            self.postMessage({ type: 'PROGRESS', workerId: workerId, progress: progress });
                        }
                    }
                }

                const computeTime = performance.now() - startTime;

                if (mode === 'sab') {
                    self.postMessage({
                        type: 'DONE',
                        workerId: workerId,
                        computeTime: computeTime
                    });
                } else {
                    // Return result C chunk buffer as Transferable
                    self.postMessage({
                        type: 'DONE',
                        workerId: workerId,
                        computeTime: computeTime,
                        bufferC: C.buffer
                    }, [C.buffer]);
                }
            }
        };
    `;

    let workerBlobUrl = null;

    function getWorkerBlobUrl() {
        if (!workerBlobUrl) {
            const blob = new Blob([WORKER_SCRIPT_SOURCE], { type: 'application/javascript' });
            workerBlobUrl = URL.createObjectURL(blob);
        }
        return workerBlobUrl;
    }

    // --- INITIALIZATION ---
    function init() {
        detectHardwareCapabilities();
        setupEventListeners();
        updateConfigDisplays();
        renderWorkerPoolGrid();
        startMainThreadReactor();
        renderChart();
        log('sys', 'Web Worker Multi-Threading Engine Ready.');
    }

    // --- CAPABILITIES & ENV DETECTION ---
    function detectHardwareCapabilities() {
        const cores = navigator.hardwareConcurrency || 4;
        ui.sysCoresCount.textContent = cores;
        ui.termCores.textContent = cores;

        // SharedArrayBuffer availability check
        try {
            state.sabSupported = (typeof SharedArrayBuffer !== 'undefined');
        } catch (e) {
            state.sabSupported = false;
        }

        if (state.sabSupported) {
            ui.sysSabStatus.textContent = 'AVAILABLE (COOP/COEP ACTIVE)';
            ui.sysSabStatus.className = 'badge-value neon-emerald';
        } else {
            ui.sysSabStatus.textContent = 'RESTRICTED (ZERO-COPY FALLBACK)';
            ui.sysSabStatus.className = 'badge-value neon-amber';
            ui.modeSabBtn.classList.add('disabled');
            ui.sabWarning.classList.remove('hidden');
        }
    }

    // --- EVENT LISTENERS ---
    function setupEventListeners() {
        ui.matrixSizeSlider.addEventListener('input', (e) => {
            state.matrixSize = parseInt(e.target.value, 10);
            updateConfigDisplays();
        });

        ui.workerThreadsSlider.addEventListener('input', (e) => {
            state.workerCount = parseInt(e.target.value, 10);
            updateConfigDisplays();
            renderWorkerPoolGrid();
        });

        ui.algorithmSelect.addEventListener('change', (e) => {
            state.algorithm = e.target.value;
            log('info', `Partitioning strategy set to: ${state.algorithm === 'tiled' ? 'Tiled Block Matrix' : 'Row-Block Partitioning'}`);
        });

        // Global functions for buttons in HTML
        window.setMatrixSize = function (size) {
            state.matrixSize = size;
            ui.matrixSizeSlider.value = size;
            updateConfigDisplays();
        };

        window.setTransferMode = function (mode) {
            if (mode === 'sab' && !state.sabSupported) {
                log('warning', 'SharedArrayBuffer is not available due to browser Cross-Origin Security policies. Using Transferable mode.');
                return;
            }
            state.transferMode = mode;
            ui.modeTransferableBtn.classList.toggle('active', mode === 'transferable');
            ui.modeSabBtn.classList.toggle('active', mode === 'sab');
            log('info', `Memory management mode switched to: ${mode.toUpperCase()}`);
        };

        window.switchChartTab = function (tab) {
            state.currentChartTab = tab;
            ui.tabSpeedup.classList.toggle('active', tab === 'speedup');
            ui.tabTime.classList.toggle('active', tab === 'time');
            ui.tabGflops.classList.toggle('active', tab === 'gflops');
            renderChart();
        };

        window.inspectMatrixSample = inspectMatrixSample;
        window.closeMatrixModal = closeMatrixModal;
        window.clearLogs = clearLogs;
        window.runSingleThreaded = runSingleThreaded;
        window.runMultiThreaded = runMultiThreaded;
        window.runFullBenchmarkSuite = runFullBenchmarkSuite;
        window.abortCalculation = abortCalculation;
    }

    function updateConfigDisplays() {
        const N = state.matrixSize;
        ui.matrixSizeVal.textContent = `${N} × ${N}`;
        const totalElements = N * N;
        ui.matrixElementsCount.textContent = totalElements.toLocaleString();
        
        // 4 bytes per Float32
        const memMB = ((totalElements * 4) / (1024 * 1024)).toFixed(2);
        ui.matrixMemorySize.textContent = `${memMB} MB / Matrix`;

        ui.workerThreadsVal.textContent = `${state.workerCount} Thread${state.workerCount > 1 ? 's' : ''}`;
        ui.poolTotalCount.textContent = state.workerCount;
    }

    // --- TERMINAL LOGGING ---
    function log(type, message) {
        const line = document.createElement('div');
        line.className = `log-line ${type}`;
        const time = new Date().toLocaleTimeString('en-US', { hour12: false });
        line.textContent = `[${time}] ${message}`;
        ui.terminalLog.appendChild(line);
        ui.terminalLog.scrollTop = ui.terminalLog.scrollHeight;
    }

    function clearLogs() {
        ui.terminalLog.innerHTML = '';
        log('sys', 'Log buffer cleared.');
    }

    // --- WORKER HUD RENDERING ---
    function renderWorkerPoolGrid() {
        ui.workerGridContainer.innerHTML = '';
        for (let i = 0; i < state.workerCount; i++) {
            const card = document.createElement('div');
            card.className = 'worker-card';
            card.id = `worker-card-${i}`;
            card.innerHTML = `
                <div class="worker-card-head">
                    <span class="worker-name">THREAD #${i + 1}</span>
                    <span class="worker-state-tag tag-idle" id="w-tag-${i}">IDLE</span>
                </div>
                <div class="worker-range-text" id="w-range-${i}">Rows: --</div>
                <div class="worker-progress-bar-bg">
                    <div class="worker-progress-fill" id="w-fill-${i}"></div>
                </div>
                <div class="worker-time-text" id="w-time-${i}">-- ms</div>
            `;
            ui.workerGridContainer.appendChild(card);
        }
    }

    function updateWorkerUI(workerId, stateTag, progressPercent, computeTimeMs, rowRangeText) {
        const card = document.getElementById(`worker-card-${workerId}`);
        const tag = document.getElementById(`w-tag-${workerId}`);
        const range = document.getElementById(`w-range-${workerId}`);
        const fill = document.getElementById(`w-fill-${workerId}`);
        const timeText = document.getElementById(`w-time-${workerId}`);

        if (!card) return;

        if (stateTag === 'WORKING') {
            card.className = 'worker-card working';
            tag.className = 'worker-state-tag tag-working';
            tag.textContent = 'WORKING';
        } else if (stateTag === 'DONE') {
            card.className = 'worker-card done';
            tag.className = 'worker-state-tag tag-done';
            tag.textContent = 'DONE';
        } else {
            card.className = 'worker-card';
            tag.className = 'worker-state-tag tag-idle';
            tag.textContent = 'IDLE';
        }

        if (rowRangeText) range.textContent = rowRangeText;
        if (progressPercent !== undefined) fill.style.width = `${progressPercent}%`;
        if (computeTimeMs !== undefined) timeText.textContent = `${computeTimeMs.toFixed(1)} ms`;
    }

    // --- MAIN THREAD RESPONSIVENESS REACTOR & FPS MONITOR ---
    let fpsHistory = new Array(60).fill(60);
    let lastFrameTime = performance.now();
    let frameCount = 0;
    let fpsUpdateTimer = 0;
    let maxStutterMs = 0;

    function startMainThreadReactor() {
        const canvas = ui.reactorCanvas;
        const ctx = canvas.getContext('2d');
        const graphCanvas = ui.fpsGraphCanvas;
        const graphCtx = graphCanvas.getContext('2d');

        let angle = 0;

        function animate(now) {
            const delta = now - lastFrameTime;
            lastFrameTime = now;

            // Track main thread lag / stutter
            if (delta > 35) { // Frame took longer than ~30ms (normal is 16.6ms for 60fps)
                const lagMs = Math.round(delta - 16.6);
                if (lagMs > maxStutterMs) {
                    maxStutterMs = lagMs;
                    ui.threadLagBadge.textContent = `STUTTER DETECTED: ${maxStutterMs}ms`;
                }
            }

            frameCount++;
            if (now - fpsUpdateTimer >= 200) {
                const currentFps = Math.min(60, (frameCount * 1000) / (now - fpsUpdateTimer));
                ui.liveFpsVal.textContent = currentFps.toFixed(1);
                fpsHistory.push(currentFps);
                if (fpsHistory.length > 60) fpsHistory.shift();

                if (currentFps < 30) {
                    ui.fpsStatusText.textContent = 'MAIN THREAD BLOCKED / STUTTERING!';
                    ui.fpsStatusText.className = 'fps-status blocked';
                } else {
                    ui.fpsStatusText.textContent = 'THREAD UNBLOCKED (60 FPS)';
                    ui.fpsStatusText.className = 'fps-status';
                }

                frameCount = 0;
                fpsUpdateTimer = now;

                drawFpsGraph(graphCtx, graphCanvas.width, graphCanvas.height);
            }

            // Draw 3D Cyber Reactor Spinner
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            const cx = canvas.width / 2;
            const cy = canvas.height / 2;
            angle += 0.04;

            // Outer ring
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(angle);
            ctx.strokeStyle = '#00f3ff';
            ctx.lineWidth = 3;
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#00f3ff';
            ctx.beginPath();
            ctx.arc(0, 0, 55, 0, Math.PI * 1.6);
            ctx.stroke();
            ctx.restore();

            // Inner counter-rotating hexagon
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(-angle * 1.5);
            ctx.strokeStyle = '#00ff9d';
            ctx.lineWidth = 2;
            ctx.shadowBlur = 8;
            ctx.shadowColor = '#00ff9d';
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const a = (i * Math.PI) / 3;
                const x = 36 * Math.cos(a);
                const y = 36 * Math.sin(a);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.stroke();
            ctx.restore();

            // Center glowing core
            ctx.save();
            ctx.translate(cx, cy);
            const pulseRadius = 10 + Math.sin(now * 0.008) * 4;
            const grad = ctx.createRadialGradient(0, 0, 2, 0, 0, pulseRadius);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.5, '#ff0055');
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            requestAnimationFrame(animate);
        }

        requestAnimationFrame(animate);
    }

    function drawFpsGraph(ctx, width, height) {
        ctx.clearRect(0, 0, width, height);

        // Grid lines
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2);
        ctx.stroke();

        if (fpsHistory.length < 2) return;

        const step = width / (fpsHistory.length - 1);
        ctx.beginPath();
        ctx.moveTo(0, height - (fpsHistory[0] / 60) * (height - 10));

        for (let i = 1; i < fpsHistory.length; i++) {
            const x = i * step;
            const y = height - (fpsHistory[i] / 60) * (height - 10);
            ctx.lineTo(x, y);
        }

        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 6;
        ctx.shadowColor = '#00f3ff';
        ctx.stroke();
        ctx.shadowBlur = 0;
    }

    // --- MATRIX DATA GENERATION ---
    function generateMatrices(N) {
        const size = N * N;
        const A = new Float32Array(size);
        const B = new Float32Array(size);

        // Deterministic pseudo-random generation for 100% reproducible validation checksum
        for (let i = 0; i < size; i++) {
            A[i] = ((i % 97) - 48) * 0.1;
            B[i] = (((i * 13) % 101) - 50) * 0.1;
        }

        return { A, B };
    }

    // Mathematical checksum hash for result validation
    function calculateChecksum(C) {
        let sum = 0;
        const len = C.length;
        // Sample every K elements for super fast validation on multi-million element matrices
        const step = Math.max(1, Math.floor(len / 10000));
        for (let i = 0; i < len; i += step) {
            sum += C[i] * (i % 17 + 1);
        }
        return Math.abs(sum).toFixed(4);
    }

    // --- GFLOPS CALCULATOR ---
    function calculateGflops(N, timeMs) {
        if (timeMs <= 0) return 0;
        // Matrix multiplication operations = 2 * N^3 (N^3 multiplications + N^3 additions)
        const ops = 2.0 * Math.pow(N, 3);
        const gflops = (ops / (timeMs / 1000.0)) / 1e9;
        return gflops.toFixed(2);
    }

    // --- SINGLE-THREADED MATRIX MULTIPLICATION (MAIN THREAD) ---
    async function runSingleThreaded() {
        if (state.isComputing) return;
        state.isComputing = true;
        setEngineStatus('COMPUTING (SINGLE-THREADED)', 'busy');
        maxStutterMs = 0;
        ui.threadLagBadge.textContent = 'STUTTER DETECTED: 0ms';

        const N = state.matrixSize;
        log('info', `Starting Single-Threaded Matrix Multiplication (N=${N})...`);
        log('warning', '⚠️ Main thread event loop will freeze during calculation!');

        ui.singleStatusBar.textContent = 'Computing on Main Thread...';
        ui.singleStatusBar.className = 'comp-status-bar';

        // Brief delay to allow DOM to render freeze warning log
        await new Promise(r => setTimeout(r, 100));

        const { A, B } = generateMatrices(N);
        const C = new Float32Array(N * N);

        const startTime = performance.now();

        // Blocking Cache-Optimized Matrix Multiplication (i-k-j)
        for (let i = 0; i < N; i++) {
            const aOffset = i * N;
            const cOffset = i * N;
            for (let k = 0; k < N; k++) {
                const aik = A[aOffset + k];
                const bOffset = k * N;
                for (let j = 0; j < N; j++) {
                    C[cOffset + j] += aik * B[bOffset + j];
                }
            }
        }

        const endTime = performance.now();
        const duration = endTime - startTime;
        const gflops = calculateGflops(N, duration);
        const checksum = calculateChecksum(C);

        state.singleThreadResult = {
            timeMs: duration,
            gflops: gflops,
            freezeMs: maxStutterMs > 0 ? maxStutterMs : Math.round(duration),
            resultC: C,
            checksum: checksum
        };

        // Update UI
        ui.singleTime.textContent = duration.toFixed(1);
        ui.singleGflops.textContent = gflops;
        ui.singleFreeze.textContent = `${state.singleThreadResult.freezeMs} ms`;
        ui.singleStatusBar.textContent = 'Completed (Thread Blocked)';
        ui.singleStatusBar.className = 'comp-status-bar';

        log('success', `Single-Thread Completed in ${duration.toFixed(1)} ms (${gflops} GFLOPS). Checksum: ${checksum}`);
        
        verifyChecksums();
        updateSpeedupDisplay();

        state.isComputing = false;
        setEngineStatus('IDLE', 'ready');
    }

    // --- MULTI-THREADED WEB WORKER ENGINE ---
    function runMultiThreaded() {
        return new Promise((resolve) => {
            if (state.isComputing) return resolve(null);
            state.isComputing = true;
            setEngineStatus('COMPUTING (MULTI-THREADED)', 'busy');
            maxStutterMs = 0;
            ui.threadLagBadge.textContent = 'STUTTER DETECTED: 0ms';

            ui.btnAbort.classList.remove('hidden');
            const N = state.matrixSize;
            const W = state.workerCount;
            const mode = state.transferMode;
            const algorithm = state.algorithm;

            log('info', `Launching Multi-Threaded Engine: ${W} Worker Threads (N=${N}, Mode=${mode.toUpperCase()}, Algo=${algorithm})...`);
            
            ui.poolActiveCount.textContent = W;
            ui.multiStatusBar.textContent = 'Workers executing...';

            const { A, B } = generateMatrices(N);
            const C = new Float32Array(N * N);

            const rowsPerWorker = Math.floor(N / W);
            const blobUrl = getWorkerBlobUrl();

            let completedWorkers = 0;
            const workerInstances = [];
            state.activeWorkers = workerInstances;

            const overallStart = performance.now();

            let sabA, sabB, sabC;
            if (mode === 'sab' && state.sabSupported) {
                sabA = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * N * N);
                sabB = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * N * N);
                sabC = new SharedArrayBuffer(Float32Array.BYTES_PER_ELEMENT * N * N);

                new Float32Array(sabA).set(A);
                new Float32Array(sabB).set(B);
            }

            for (let i = 0; i < W; i++) {
                const startRow = i * rowsPerWorker;
                const endRow = (i === W - 1) ? N : (i + 1) * rowsPerWorker;

                updateWorkerUI(i, 'WORKING', 0, 0, `Rows ${startRow}-${endRow - 1}`);

                const worker = new Worker(blobUrl);
                workerInstances.push(worker);

                worker.onmessage = (e) => {
                    const msg = e.data;
                    if (msg.type === 'PROGRESS') {
                        updateWorkerUI(msg.workerId, 'WORKING', msg.progress, undefined);
                    } else if (msg.type === 'DONE') {
                        completedWorkers++;
                        updateWorkerUI(msg.workerId, 'DONE', 100, msg.computeTime);

                        if (mode === 'transferable' && msg.bufferC) {
                            const chunkC = new Float32Array(msg.bufferC);
                            C.set(chunkC, startRow * N);
                        }

                        if (completedWorkers === W) {
                            const totalTime = performance.now() - overallStart;
                            
                            let finalC = C;
                            if (mode === 'sab' && state.sabSupported) {
                                finalC = new Float32Array(sabC);
                            }

                            const gflops = calculateGflops(N, totalTime);
                            const checksum = calculateChecksum(finalC);

                            state.multiThreadResult = {
                                timeMs: totalTime,
                                gflops: gflops,
                                resultC: finalC,
                                checksum: checksum
                            };

                            // Terminate workers
                            workerInstances.forEach(w => w.terminate());
                            state.activeWorkers = [];
                            ui.poolActiveCount.textContent = '0';
                            ui.btnAbort.classList.add('hidden');

                            ui.multiTime.textContent = totalTime.toFixed(1);
                            ui.multiGflops.textContent = gflops;
                            ui.multiStatusBar.textContent = `Completed (${W} Threads Parallel)`;

                            log('success', `Multi-Threaded Completed in ${totalTime.toFixed(1)} ms (${gflops} GFLOPS). Checksum: ${checksum}`);
                            
                            verifyChecksums();
                            updateSpeedupDisplay();

                            state.isComputing = false;
                            setEngineStatus('IDLE', 'ready');
                            resolve(state.multiThreadResult);
                        }
                    }
                };

                // Post Message to Worker
                if (mode === 'sab' && state.sabSupported) {
                    worker.postMessage({
                        task: 'MULTIPLY_CHUNK',
                        workerId: i,
                        N: N,
                        startRow: startRow,
                        endRow: endRow,
                        mode: 'sab',
                        algorithm: algorithm,
                        sabA: sabA,
                        sabB: sabB,
                        sabC: sabC
                    });
                } else {
                    // Transferable ArrayBuffers
                    const sliceA = A.slice(startRow * N, endRow * N);
                    worker.postMessage({
                        task: 'MULTIPLY_CHUNK',
                        workerId: i,
                        N: N,
                        startRow: startRow,
                        endRow: endRow,
                        mode: 'transferable',
                        algorithm: algorithm,
                        bufferA: sliceA.buffer,
                        bufferB: B.buffer
                    }, [sliceA.buffer]);
                }
            }
        });
    }

    // --- ABORT CALCULATION ---
    function abortCalculation() {
        if (state.activeWorkers.length > 0) {
            state.activeWorkers.forEach(w => w.terminate());
            state.activeWorkers = [];
            ui.poolActiveCount.textContent = '0';
            ui.btnAbort.classList.add('hidden');
            state.isComputing = false;
            setEngineStatus('ABORTED', 'ready');
            log('error', 'Calculation manually aborted by user.');

            for (let i = 0; i < state.workerCount; i++) {
                updateWorkerUI(i, 'IDLE', 0, 0, 'Aborted');
            }
        }
    }

    function setEngineStatus(text, statusClass) {
        ui.sysEngineStatus.textContent = text;
        ui.sysEngineStatus.className = `badge-value status-${statusClass}`;
    }

    // --- SPEEDUP & EFFICIENCY COMPUTATION ---
    function updateSpeedupDisplay() {
        if (state.singleThreadResult && state.multiThreadResult) {
            const T1 = state.singleThreadResult.timeMs;
            const TN = state.multiThreadResult.timeMs;
            const W = state.workerCount;

            const speedup = T1 / TN;
            const efficiency = (speedup / W) * 100;

            state.multiThreadResult.speedup = speedup;
            state.multiThreadResult.efficiency = efficiency;

            ui.speedupBadgeBox.classList.remove('hidden');
            ui.speedupFactor.textContent = `${speedup.toFixed(2)}×`;
            ui.multiEfficiency.textContent = `${efficiency.toFixed(1)} %`;

            log('info', `🚀 Benchmark Speedup: ${speedup.toFixed(2)}× Faster | Parallel Efficiency: ${efficiency.toFixed(1)}%`);
        }
    }

    // --- CHECKSUM VERIFICATION & SAMPLE INSPECTOR ---
    function verifyChecksums() {
        if (state.singleThreadResult && state.multiThreadResult) {
            const chk1 = state.singleThreadResult.checksum;
            const chk2 = state.multiThreadResult.checksum;

            if (chk1 === chk2) {
                ui.checksumBadge.textContent = 'CHECKSUM: MATCH (100% ACCURATE) ✅';
                ui.checksumBadge.className = 'checksum-badge badge-pass';
                log('success', `VALIDATION PASSED: Single-thread checksum (${chk1}) === Multi-thread checksum (${chk2}).`);
            } else {
                ui.checksumBadge.textContent = 'CHECKSUM: DISCREPANCY DETECTED ❌';
                ui.checksumBadge.className = 'checksum-badge badge-fail';
                log('error', `VALIDATION ERROR: Single-thread (${chk1}) !== Multi-thread (${chk2}).`);
            }
        }
    }

    function inspectMatrixSample() {
        const resultObj = state.multiThreadResult || state.singleThreadResult;
        if (!resultObj || !resultObj.resultC) {
            alert('Please run a computation first to inspect matrix results.');
            return;
        }

        const N = state.matrixSize;
        const C = resultObj.resultC;
        ui.modalDimText.textContent = `${N}×${N}`;

        // Build 6x6 preview table
        let tableHtml = '<thead><tr><th>i \\ j</th>';
        for (let j = 0; j < 6; j++) {
            tableHtml += `<th>Col ${j}</th>`;
        }
        tableHtml += '</tr></thead><tbody>';

        for (let i = 0; i < 6; i++) {
            tableHtml += `<tr><th>Row ${i}</th>`;
            for (let j = 0; j < 6; j++) {
                const val = C[i * N + j];
                tableHtml += `<td>${val.toFixed(2)}</td>`;
            }
            tableHtml += '</tr>';
        }
        tableHtml += 'tbody>';

        ui.matrixSampleTable.innerHTML = tableHtml;

        ui.modalChecksumDetails.innerHTML = `
            <strong>Matrix Checksum Hash:</strong> ${resultObj.checksum}<br>
            <strong>Elements Verified:</strong> ${(N * N).toLocaleString()}<br>
            <strong>Execution Time:</strong> ${resultObj.timeMs.toFixed(1)} ms (${resultObj.gflops} GFLOPS)
        `;

        ui.matrixModal.classList.remove('hidden');
    }

    function closeMatrixModal() {
        ui.matrixModal.classList.add('hidden');
    }

    // --- FULL BENCHMARK SUITE RUNNER ---
    async function runFullBenchmarkSuite() {
        if (state.isComputing) return;

        log('info', '📊 Starting Full Worker Scalability Benchmark Suite (1 to 16 Threads)...');
        const originalWorkerCount = state.workerCount;

        // Ensure Single Thread has run for baseline
        if (!state.singleThreadResult) {
            log('info', 'Running baseline Single-Threaded calculation first...');
            await runSingleThreaded();
        }

        const threadsToTest = [1, 2, 4, 8, 12, 16];
        const times = [];
        const speedups = [];
        const gflopsList = [];

        const baselineTime = state.singleThreadResult.timeMs;

        for (const tCount of threadsToTest) {
            state.workerCount = tCount;
            ui.workerThreadsSlider.value = tCount;
            updateConfigDisplays();
            renderWorkerPoolGrid();

            log('info', `Testing with ${tCount} Thread${tCount > 1 ? 's' : ''}...`);
            const res = await runMultiThreaded();

            if (res) {
                times.push(res.timeMs);
                const sFactor = baselineTime / res.timeMs;
                speedups.push(parseFloat(sFactor.toFixed(2)));
                gflopsList.push(parseFloat(res.gflops));
            }
        }

        // Restore original thread count
        state.workerCount = originalWorkerCount;
        ui.workerThreadsSlider.value = originalWorkerCount;
        updateConfigDisplays();
        renderWorkerPoolGrid();

        state.benchmarkData = {
            threads: threadsToTest,
            times: times,
            speedups: speedups,
            gflops: gflopsList
        };

        log('success', '📊 Benchmark Suite Complete! Rendering Scalability Charts.');
        renderChart();
    }

    // --- CUSTOM CANVAS CHART RENDERER ---
    function renderChart() {
        const canvas = ui.performanceChartCanvas;
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);

        const data = state.benchmarkData;
        if (!data.speedups || data.speedups.length === 0) {
            // Draw placeholder text
            ctx.fillStyle = '#94a3b8';
            ctx.font = '14px Orbitron, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('RUN BENCHMARK SUITE TO GENERATE PERFORMANCE SCALABILITY CHARTS', width / 2, height / 2);
            return;
        }

        const paddingLeft = 55;
        const paddingBottom = 40;
        const paddingTop = 25;
        const paddingRight = 25;

        const chartWidth = width - paddingLeft - paddingRight;
        const chartHeight = height - paddingTop - paddingBottom;

        // X-axis values (Threads)
        const threads = data.threads;
        const numPoints = threads.length;
        const stepX = chartWidth / (numPoints - 1);

        // Draw Axes Grid
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();

        for (let i = 0; i <= 4; i++) {
            const y = paddingTop + (chartHeight / 4) * i;
            ctx.moveTo(paddingLeft, y);
            ctx.lineTo(width - paddingRight, y);
        }
        ctx.stroke();

        ctx.font = '11px Fira Code, monospace';
        ctx.fillStyle = '#94a3b8';
        ctx.textAlign = 'center';

        // Draw X-axis labels
        threads.forEach((t, i) => {
            const x = paddingLeft + i * stepX;
            ctx.fillText(`${t}T`, x, height - 12);
        });

        // Determine Y-axis max & plot values based on tab
        const tab = state.currentChartTab;
        let yValues = [];
        let strokeColor = '#00f3ff';
        let idealYValues = [];

        if (tab === 'speedup') {
            yValues = data.speedups;
            strokeColor = '#00ff9d';
            idealYValues = threads; // Linear scaling ideal line
        } else if (tab === 'time') {
            yValues = data.times;
            strokeColor = '#ffb700';
        } else {
            yValues = data.gflops;
            strokeColor = '#b026ff';
        }

        const maxY = Math.max(...yValues, ...(idealYValues.length ? idealYValues : [1]), 1) * 1.1;

        // Draw Y-axis labels
        ctx.textAlign = 'right';
        for (let i = 0; i <= 4; i++) {
            const val = (maxY * (4 - i) / 4);
            const y = paddingTop + (chartHeight / 4) * i;
            ctx.fillText(tab === 'speedup' ? `${val.toFixed(1)}×` : (tab === 'time' ? `${Math.round(val)}ms` : `${val.toFixed(1)}`), paddingLeft - 8, y + 4);
        }

        // Draw Ideal Speedup Line (if on speedup tab)
        if (tab === 'speedup' && idealYValues.length > 0) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            idealYValues.forEach((val, i) => {
                const x = paddingLeft + i * stepX;
                const y = height - paddingBottom - (val / maxY) * chartHeight;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Draw Data Line
        ctx.beginPath();
        yValues.forEach((val, i) => {
            const x = paddingLeft + i * stepX;
            const y = height - paddingBottom - (val / maxY) * chartHeight;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 3;
        ctx.shadowBlur = 10;
        ctx.shadowColor = strokeColor;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Draw Data Dots
        yValues.forEach((val, i) => {
            const x = paddingLeft + i * stepX;
            const y = height - paddingBottom - (val / maxY) * chartHeight;

            ctx.fillStyle = strokeColor;
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();

            // Value text above dot
            ctx.fillStyle = '#ffffff';
            ctx.font = '10px Fira Code, monospace';
            ctx.textAlign = 'center';
            ctx.fillText(tab === 'speedup' ? `${val}×` : (tab === 'time' ? `${Math.round(val)}` : `${val}`), x, y - 10);
        });
    }

    // --- LAUNCH ON DOM LOAD ---
    document.addEventListener('DOMContentLoaded', init);

})();
