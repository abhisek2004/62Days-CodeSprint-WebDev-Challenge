/**
 * OS Process Scheduler Simulator & Visualizer
 * Core Application Engine & Simulation Logic
 */

(function () {
    'use strict';

    // ==========================================
    // Color Palette Presets for Process Badges
    // ==========================================
    const COLOR_PALETTE = [
        '#3b82f6', // Blue
        '#8b5cf6', // Purple
        '#10b981', // Emerald
        '#f59e0b', // Amber
        '#ec4899', // Pink
        '#06b6d4', // Cyan
        '#f97316', // Orange
        '#6366f1', // Indigo
        '#14b8a6', // Teal
        '#e11d48'  // Rose
    ];

    // ==========================================
    // Application State
    // ==========================================
    const state = {
        processes: [],
        algorithm: 'RR',
        timeQuantum: 2,
        priorityOrder: 'LOW_NUM_HIGH_PRIO', // LOW_NUM_HIGH_PRIO or HIGH_NUM_HIGH_PRIO
        
        // Simulation results
        simulation: {
            ganttBlocks: [],
            processMetrics: [],
            timelineTicks: [], // Snapshot per unit time t = 0..maxT
            summary: {
                avgWT: 0,
                avgTAT: 0,
                avgRT: 0,
                cpuUtil: 0,
                throughput: 0,
                totalTime: 0
            }
        },

        // Playback state
        playback: {
            currentTime: 0,
            maxTime: 0,
            isPlaying: false,
            speedMs: 800, // delay between ticks
            timerId: null
        }
    };

    // DOM Elements Cache
    const DOM = {};

    // ==========================================
    // Initializer
    // ==========================================
    document.addEventListener('DOMContentLoaded', () => {
        cacheDOMElements();
        bindEvents();
        loadDefaultPreset();
        updateAlgorithmConfigVisibility();
        runSimulation();
    });

    function cacheDOMElements() {
        DOM.algoSelect = document.getElementById('algorithm-select');
        DOM.rrContainer = document.getElementById('rr-quantum-container');
        DOM.timeQuantumInput = document.getElementById('time-quantum');
        DOM.quantumValBadge = document.getElementById('quantum-val');
        DOM.prioContainer = document.getElementById('priority-order-container');
        DOM.prioOrderSelect = document.getElementById('priority-order');
        DOM.presetSelect = document.getElementById('preset-select');
        DOM.btnRandomProc = document.getElementById('btn-random-processes');

        DOM.addForm = document.getElementById('add-process-form');
        DOM.procIdInput = document.getElementById('proc-id');
        DOM.procColorInput = document.getElementById('proc-color');
        DOM.btnRandomColor = document.getElementById('btn-random-color');
        DOM.procArrivalInput = document.getElementById('proc-arrival');
        DOM.procBurstInput = document.getElementById('proc-burst');
        DOM.procPriorityInput = document.getElementById('proc-priority');

        DOM.processTableBody = document.getElementById('process-table-body');
        DOM.processCount = document.getElementById('process-count');
        DOM.emptyQueueMsg = document.getElementById('empty-queue-msg');
        DOM.btnClearProcesses = document.getElementById('btn-clear-processes');

        DOM.btnReset = document.getElementById('btn-reset');
        DOM.btnStepPrev = document.getElementById('btn-step-prev');
        DOM.btnPlayPause = document.getElementById('btn-play-pause');
        DOM.btnStepNext = document.getElementById('btn-step-next');
        DOM.btnJumpEnd = document.getElementById('btn-jump-end');
        DOM.currentTimeTick = document.getElementById('current-time-tick');
        DOM.speedSlider = document.getElementById('speed-slider');
        DOM.speedVal = document.getElementById('speed-val');

        DOM.readyQueueContainer = document.getElementById('ready-queue-container');
        DOM.cpuCoreBox = document.getElementById('cpu-core-box');
        DOM.cpuActivePid = document.getElementById('cpu-active-pid');
        DOM.cpuActiveDetails = document.getElementById('cpu-active-details');
        DOM.cpuProgressBar = document.getElementById('cpu-progress-bar');
        DOM.terminatedQueueContainer = document.getElementById('terminated-queue-container');

        DOM.ganttTrack = document.getElementById('gantt-track');
        DOM.ganttScale = document.getElementById('gantt-scale');
        DOM.ganttPlayhead = document.getElementById('gantt-playhead');
        DOM.playheadTimeTag = document.getElementById('playhead-time-tag');
        DOM.ganttLegend = document.getElementById('gantt-legend-container');

        DOM.resultsTableBody = document.getElementById('results-table-body');
        DOM.statAvgWT = document.getElementById('stat-avg-wt');
        DOM.statAvgTAT = document.getElementById('stat-avg-tat');
        DOM.statCpuUtil = document.getElementById('stat-cpu-util');
        DOM.statThroughput = document.getElementById('stat-throughput');
        DOM.algoInfoContent = document.getElementById('algo-info-content');

        DOM.btnCompare = document.getElementById('btn-algorithm-compare');
        DOM.compareModal = document.getElementById('compare-modal');
        DOM.btnCloseModal = document.getElementById('btn-close-modal');
        DOM.comparisonTableBody = document.getElementById('comparison-table-body');
        DOM.comparisonGanttsContainer = document.getElementById('comparison-gantts-container');
        DOM.btnThemeToggle = document.getElementById('btn-theme-toggle');
    }

    // ==========================================
    // Event Listeners
    // ==========================================
    function bindEvents() {
        DOM.algoSelect.addEventListener('change', (e) => {
            state.algorithm = e.target.value;
            updateAlgorithmConfigVisibility();
            runSimulation();
        });

        DOM.timeQuantumInput.addEventListener('input', (e) => {
            let val = parseInt(e.target.value, 10) || 1;
            val = Math.max(1, Math.min(20, val));
            state.timeQuantum = val;
            DOM.quantumValBadge.textContent = val;
            runSimulation();
        });

        DOM.prioOrderSelect.addEventListener('change', (e) => {
            state.priorityOrder = e.target.value;
            runSimulation();
        });

        DOM.presetSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                loadPresetScenario(e.target.value);
            }
        });

        DOM.btnRandomProc.addEventListener('click', () => {
            generateRandomProcesses();
        });

        DOM.btnRandomColor.addEventListener('click', () => {
            DOM.procColorInput.value = getRandomColor();
        });

        DOM.addForm.addEventListener('submit', (e) => {
            e.preventDefault();
            addProcessFromForm();
        });

        DOM.btnClearProcesses.addEventListener('click', () => {
            state.processes = [];
            runSimulation();
        });

        // Playback controls
        DOM.btnPlayPause.addEventListener('click', togglePlayPause);
        DOM.btnReset.addEventListener('click', resetPlayback);
        DOM.btnStepNext.addEventListener('click', stepForward);
        DOM.btnStepPrev.addEventListener('click', stepBackward);
        DOM.btnJumpEnd.addEventListener('click', jumpToEnd);

        DOM.speedSlider.addEventListener('input', (e) => {
            const speedVal = parseFloat(e.target.value);
            const speedMultiplier = (speedVal / 5).toFixed(1);
            DOM.speedVal.textContent = `${speedMultiplier}x`;
            state.playback.speedMs = Math.round(1000 / (speedVal / 2));
            if (state.playback.isPlaying) {
                pausePlayback();
                startPlayback();
            }
        });

        // Modal
        DOM.btnCompare.addEventListener('click', openComparisonModal);
        DOM.btnCloseModal.addEventListener('click', closeComparisonModal);
        DOM.compareModal.addEventListener('click', (e) => {
            if (e.target === DOM.compareModal) closeComparisonModal();
        });

        // Theme Toggle
        DOM.btnThemeToggle.addEventListener('click', () => {
            document.body.classList.toggle('light-theme');
            document.body.classList.toggle('dark-theme');
            const isLight = document.body.classList.contains('light-theme');
            DOM.btnThemeToggle.innerHTML = isLight ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
        });
    }

    function updateAlgorithmConfigVisibility() {
        DOM.rrContainer.style.display = (state.algorithm === 'RR') ? 'block' : 'none';
        DOM.prioContainer.style.display = (state.algorithm.startsWith('PRIO')) ? 'block' : 'none';
    }

    function getRandomColor() {
        return COLOR_PALETTE[Math.floor(Math.random() * COLOR_PALETTE.length)];
    }

    // ==========================================
    // Process Queue Management
    // ==========================================
    function addProcessFromForm() {
        const id = DOM.procIdInput.value.trim().toUpperCase() || `P${state.processes.length + 1}`;
        const arrivalTime = Math.max(0, parseInt(DOM.procArrivalInput.value, 10) || 0);
        const burstTime = Math.max(1, parseInt(DOM.procBurstInput.value, 10) || 1);
        const priority = parseInt(DOM.procPriorityInput.value, 10) || 1;
        const color = DOM.procColorInput.value || getRandomColor();

        // Check duplicate ID
        if (state.processes.some(p => p.id === id)) {
            alert(`Process ID "${id}" already exists. Please use a unique ID.`);
            return;
        }

        state.processes.push({ id, arrivalTime, burstTime, priority, color });
        
        // Auto-increment default form ID for next entry
        DOM.procIdInput.value = `P${state.processes.length + 1}`;
        DOM.procColorInput.value = COLOR_PALETTE[state.processes.length % COLOR_PALETTE.length];

        runSimulation();
    }

    function removeProcess(id) {
        state.processes = state.processes.filter(p => p.id !== id);
        runSimulation();
    }

    function renderProcessTable() {
        DOM.processCount.textContent = state.processes.length;
        
        if (state.processes.length === 0) {
            DOM.processTableBody.innerHTML = '';
            DOM.emptyQueueMsg.style.display = 'block';
            return;
        }

        DOM.emptyQueueMsg.style.display = 'none';
        DOM.processTableBody.innerHTML = state.processes.map(p => `
            <tr>
                <td>
                    <span class="pid-badge" style="background-color: ${p.color}">
                        ${p.id}
                    </span>
                </td>
                <td>${p.arrivalTime}</td>
                <td>${p.burstTime}</td>
                <td>${p.priority}</td>
                <td>
                    <button class="btn btn-xs btn-danger btn-delete-proc" data-id="${p.id}" title="Remove Process">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </td>
            </tr>
        `).join('');

        // Attach event listeners for delete buttons
        DOM.processTableBody.querySelectorAll('.btn-delete-proc').forEach(btn => {
            btn.addEventListener('click', () => {
                removeProcess(btn.getAttribute('data-id'));
            });
        });
    }

    // ==========================================
    // Preset Scenarios
    // ==========================================
    function loadDefaultPreset() {
        loadPresetScenario('benchmark');
    }

    function loadPresetScenario(presetKey) {
        let presets = [];
        switch (presetKey) {
            case 'benchmark':
                presets = [
                    { id: 'P1', arrivalTime: 0, burstTime: 7, priority: 3, color: '#3b82f6' },
                    { id: 'P2', arrivalTime: 2, burstTime: 4, priority: 1, color: '#8b5cf6' },
                    { id: 'P3', arrivalTime: 4, burstTime: 1, priority: 4, color: '#10b981' },
                    { id: 'P4', arrivalTime: 5, burstTime: 4, priority: 2, color: '#f59e0b' }
                ];
                break;
            case 'convoy':
                presets = [
                    { id: 'P1', arrivalTime: 0, burstTime: 18, priority: 1, color: '#ec4899' },
                    { id: 'P2', arrivalTime: 1, burstTime: 2, priority: 2, color: '#06b6d4' },
                    { id: 'P3', arrivalTime: 2, burstTime: 2, priority: 3, color: '#f97316' },
                    { id: 'P4', arrivalTime: 3, burstTime: 1, priority: 4, color: '#10b981' }
                ];
                break;
            case 'srtf_preempt':
                presets = [
                    { id: 'P1', arrivalTime: 0, burstTime: 8, priority: 2, color: '#3b82f6' },
                    { id: 'P2', arrivalTime: 1, burstTime: 4, priority: 1, color: '#f59e0b' },
                    { id: 'P3', arrivalTime: 2, burstTime: 2, priority: 3, color: '#10b981' },
                    { id: 'P4', arrivalTime: 3, burstTime: 1, priority: 4, color: '#8b5cf6' }
                ];
                break;
            case 'priority_demo':
                presets = [
                    { id: 'P1', arrivalTime: 0, burstTime: 10, priority: 3, color: '#6366f1' },
                    { id: 'P2', arrivalTime: 1, burstTime: 1, priority: 1, color: '#10b981' }, // High priority
                    { id: 'P3', arrivalTime: 2, burstTime: 2, priority: 4, color: '#e11d48' },
                    { id: 'P4', arrivalTime: 3, burstTime: 1, priority: 2, color: '#06b6d4' }
                ];
                break;
            case 'rr_quantum':
                presets = [
                    { id: 'P1', arrivalTime: 0, burstTime: 5, priority: 1, color: '#3b82f6' },
                    { id: 'P2', arrivalTime: 1, burstTime: 3, priority: 1, color: '#8b5cf6' },
                    { id: 'P3', arrivalTime: 2, burstTime: 8, priority: 1, color: '#f59e0b' },
                    { id: 'P4', arrivalTime: 3, burstTime: 6, priority: 1, color: '#10b981' }
                ];
                break;
        }

        state.processes = presets;
        DOM.procIdInput.value = `P${state.processes.length + 1}`;
        DOM.procColorInput.value = COLOR_PALETTE[state.processes.length % COLOR_PALETTE.length];
        runSimulation();
    }

    function generateRandomProcesses() {
        const count = Math.floor(Math.random() * 4) + 4; // 4 to 7 processes
        const newProcs = [];
        for (let i = 1; i <= count; i++) {
            newProcs.push({
                id: `P${i}`,
                arrivalTime: Math.floor(Math.random() * 6), // 0 to 5
                burstTime: Math.floor(Math.random() * 8) + 1, // 1 to 8
                priority: Math.floor(Math.random() * 5) + 1, // 1 to 5
                color: COLOR_PALETTE[(i - 1) % COLOR_PALETTE.length]
            });
        }
        state.processes = newProcs;
        DOM.procIdInput.value = `P${state.processes.length + 1}`;
        DOM.procColorInput.value = COLOR_PALETTE[state.processes.length % COLOR_PALETTE.length];
        runSimulation();
    }

    // ==========================================
    // SCHEDULER SIMULATION CORE ENGINE
    // ==========================================
    function runSimulation() {
        pausePlayback();
        renderProcessTable();

        if (state.processes.length === 0) {
            clearSimulationView();
            return;
        }

        // Execute algorithm schedule computation
        const result = computeSchedule(state.processes, state.algorithm, {
            timeQuantum: state.timeQuantum,
            priorityOrder: state.priorityOrder
        });

        state.simulation = result;
        state.playback.currentTime = 0;
        state.playback.maxTime = result.timelineTicks.length - 1;

        // Render visual components
        renderGanttChart(result.ganttBlocks, result.summary.totalTime);
        renderGanttLegend(state.processes);
        renderResultsTable(result.processMetrics);
        renderStats(result.summary);
        renderAlgoInfo(state.algorithm);

        // Update step UI for initial t = 0
        updateSimulationStepView(0);
    }

    function clearSimulationView() {
        DOM.ganttTrack.innerHTML = '';
        DOM.ganttScale.innerHTML = '';
        DOM.ganttLegend.innerHTML = '';
        DOM.resultsTableBody.innerHTML = `<tr><td colspan="8" class="text-center text-muted">No processes in queue.</td></tr>`;
        DOM.statAvgWT.innerHTML = `0.00 <small>units</small>`;
        DOM.statAvgTAT.innerHTML = `0.00 <small>units</small>`;
        DOM.statCpuUtil.textContent = `0.0%`;
        DOM.statThroughput.innerHTML = `0.00 <small>proc/unit</small>`;
        DOM.readyQueueContainer.innerHTML = `<span class="empty-badge">Ready queue empty</span>`;
        DOM.terminatedQueueContainer.innerHTML = `<span class="empty-badge">None completed yet</span>`;
        DOM.cpuCoreBox.className = 'cpu-core-box cpu-idle';
        DOM.cpuActivePid.textContent = 'IDLE';
        DOM.cpuActiveDetails.textContent = 'No active process';
        DOM.currentTimeTick.textContent = '0';
    }

    /**
     * Computes schedule timeline for given algorithm
     */
    function computeSchedule(inputProcesses, algorithm, options) {
        // Deep clone process queue
        const procs = JSON.parse(JSON.stringify(inputProcesses)).map(p => ({
            ...p,
            remainingTime: p.burstTime,
            startTime: -1,
            completionTime: -1,
            firstResponseTime: -1,
            isCompleted: false
        }));

        let currentTime = 0;
        let completedCount = 0;
        const totalProcs = procs.length;

        // Timeline visualization state log
        const ganttBlocks = [];
        const timelineTicks = []; // Snapshot at every time step

        // Helper for priority sorting
        const isHigherPriority = (p1, p2) => {
            if (options.priorityOrder === 'HIGH_NUM_HIGH_PRIO') {
                return p1.priority > p2.priority;
            }
            return p1.priority < p2.priority; // Default: Low number = High Prio
        };

        // Ready queue for Round Robin
        let rrReadyQueue = [];
        let rrCurrentProcess = null;
        let rrQuantumCounter = 0;

        let currentActiveBlock = null;

        // Loop until all processes complete
        while (completedCount < totalProcs) {
            // Check newly arrived processes at currentTime
            const newlyArrived = procs.filter(p => p.arrivalTime === currentTime && !p.isCompleted);

            // Select next process based on algorithm
            let selectedProc = null;

            if (algorithm === 'FCFS') {
                // Arrived processes sorted by arrival time
                const ready = procs.filter(p => p.arrivalTime <= currentTime && !p.isCompleted)
                                 .sort((a, b) => a.arrivalTime - b.arrivalTime);
                if (ready.length > 0) selectedProc = ready[0];

            } else if (algorithm === 'SJF_NP') {
                if (currentActiveBlock && currentActiveBlock.pid !== 'IDLE') {
                    // Non-preemptive: keep executing current process
                    const currentProc = procs.find(p => p.id === currentActiveBlock.pid && !p.isCompleted);
                    if (currentProc) selectedProc = currentProc;
                }
                if (!selectedProc) {
                    const ready = procs.filter(p => p.arrivalTime <= currentTime && !p.isCompleted)
                                     .sort((a, b) => a.burstTime - b.burstTime || a.arrivalTime - b.arrivalTime);
                    if (ready.length > 0) selectedProc = ready[0];
                }

            } else if (algorithm === 'SJF_P') { // SRTF
                const ready = procs.filter(p => p.arrivalTime <= currentTime && !p.isCompleted)
                                 .sort((a, b) => a.remainingTime - b.remainingTime || a.arrivalTime - b.arrivalTime);
                if (ready.length > 0) selectedProc = ready[0];

            } else if (algorithm === 'PRIO_NP') {
                if (currentActiveBlock && currentActiveBlock.pid !== 'IDLE') {
                    const currentProc = procs.find(p => p.id === currentActiveBlock.pid && !p.isCompleted);
                    if (currentProc) selectedProc = currentProc;
                }
                if (!selectedProc) {
                    const ready = procs.filter(p => p.arrivalTime <= currentTime && !p.isCompleted);
                    if (ready.length > 0) {
                        ready.sort((a, b) => {
                            if (a.priority === b.priority) return a.arrivalTime - b.arrivalTime;
                            return isHigherPriority(a, b) ? -1 : 1;
                        });
                        selectedProc = ready[0];
                    }
                }

            } else if (algorithm === 'PRIO_P') {
                const ready = procs.filter(p => p.arrivalTime <= currentTime && !p.isCompleted);
                if (ready.length > 0) {
                    ready.sort((a, b) => {
                        if (a.priority === b.priority) return a.arrivalTime - b.arrivalTime;
                        return isHigherPriority(a, b) ? -1 : 1;
                    });
                    selectedProc = ready[0];
                }

            } else if (algorithm === 'RR') {
                // Add newly arrived processes to RR queue
                newlyArrived.sort((a, b) => a.arrivalTime - b.arrivalTime).forEach(p => {
                    if (!rrReadyQueue.includes(p.id)) {
                        rrReadyQueue.push(p.id);
                    }
                });

                if (rrCurrentProcess) {
                    const procObj = procs.find(p => p.id === rrCurrentProcess);
                    if (procObj.remainingTime === 0 || procObj.isCompleted) {
                        // Completed, clear current
                        rrCurrentProcess = null;
                        rrQuantumCounter = 0;
                    } else if (rrQuantumCounter >= options.timeQuantum) {
                        // Time quantum expired, re-queue
                        rrReadyQueue.push(rrCurrentProcess);
                        rrCurrentProcess = null;
                        rrQuantumCounter = 0;
                    }
                }

                if (!rrCurrentProcess && rrReadyQueue.length > 0) {
                    rrCurrentProcess = rrReadyQueue.shift();
                    rrQuantumCounter = 0;
                }

                if (rrCurrentProcess) {
                    selectedProc = procs.find(p => p.id === rrCurrentProcess);
                }
            }

            // Capture Ready Queue for current time tick visualization
            let currentReadyQueue = [];
            if (algorithm === 'RR') {
                currentReadyQueue = rrReadyQueue.map(pid => procs.find(p => p.id === pid));
            } else {
                currentReadyQueue = procs.filter(p => p.arrivalTime <= currentTime && !p.isCompleted && (selectedProc ? p.id !== selectedProc.id : true));
            }

            const currentTerminatedQueue = procs.filter(p => p.isCompleted);

            // Record snapshot for time `currentTime`
            timelineTicks.push({
                time: currentTime,
                activeProcess: selectedProc ? { ...selectedProc } : null,
                readyQueue: currentReadyQueue.map(p => ({ ...p })),
                terminatedQueue: currentTerminatedQueue.map(p => ({ ...p })),
                remainingBursts: procs.reduce((acc, p) => ({ ...acc, [p.id]: p.remainingTime }), {})
            });

            // Execute 1 unit tick on CPU
            if (selectedProc) {
                if (selectedProc.firstResponseTime === -1) {
                    selectedProc.firstResponseTime = currentTime;
                }

                // Gantt Block Management
                if (!currentActiveBlock || currentActiveBlock.pid !== selectedProc.id) {
                    currentActiveBlock = {
                        pid: selectedProc.id,
                        color: selectedProc.color,
                        startTime: currentTime,
                        endTime: currentTime + 1
                    };
                    ganttBlocks.push(currentActiveBlock);
                } else {
                    currentActiveBlock.endTime++;
                }

                selectedProc.remainingTime--;
                if (algorithm === 'RR') rrQuantumCounter++;

                if (selectedProc.remainingTime === 0) {
                    selectedProc.isCompleted = true;
                    selectedProc.completionTime = currentTime + 1;
                    completedCount++;
                }
            } else {
                // CPU Idle
                if (!currentActiveBlock || currentActiveBlock.pid !== 'IDLE') {
                    currentActiveBlock = {
                        pid: 'IDLE',
                        color: 'transparent',
                        startTime: currentTime,
                        endTime: currentTime + 1
                    };
                    ganttBlocks.push(currentActiveBlock);
                } else {
                    currentActiveBlock.endTime++;
                }
            }

            currentTime++;

            // Safety limit against infinite loops
            if (currentTime > 500) break;
        }

        // Add final tick snapshot at currentTime
        timelineTicks.push({
            time: currentTime,
            activeProcess: null,
            readyQueue: [],
            terminatedQueue: procs.map(p => ({ ...p })),
            remainingBursts: procs.reduce((acc, p) => ({ ...acc, [p.id]: 0 }), {})
        });

        // Compute Metrics per Process
        const processMetrics = procs.map(p => {
            const turnaroundTime = p.completionTime - p.arrivalTime;
            const waitingTime = turnaroundTime - p.burstTime;
            const responseTime = p.firstResponseTime - p.arrivalTime;
            return {
                id: p.id,
                color: p.color,
                arrivalTime: p.arrivalTime,
                burstTime: p.burstTime,
                priority: p.priority,
                completionTime: p.completionTime,
                turnaroundTime: turnaroundTime,
                waitingTime: waitingTime,
                responseTime: responseTime
            };
        });

        // Summary statistics calculation
        const totalProcsCount = processMetrics.length;
        const totalWT = processMetrics.reduce((sum, p) => sum + p.waitingTime, 0);
        const totalTAT = processMetrics.reduce((sum, p) => sum + p.turnaroundTime, 0);
        const totalRT = processMetrics.reduce((sum, p) => sum + p.responseTime, 0);
        const totalBusyTime = ganttBlocks.filter(b => b.pid !== 'IDLE').reduce((sum, b) => sum + (b.endTime - b.startTime), 0);
        const totalSimulationTime = currentTime;

        return {
            ganttBlocks,
            processMetrics,
            timelineTicks,
            summary: {
                avgWT: (totalWT / totalProcsCount).toFixed(2),
                avgTAT: (totalTAT / totalProcsCount).toFixed(2),
                avgRT: (totalRT / totalProcsCount).toFixed(2),
                cpuUtil: ((totalBusyTime / totalSimulationTime) * 100).toFixed(1),
                throughput: (totalProcsCount / totalSimulationTime).toFixed(2),
                totalTime: totalSimulationTime,
                busyTime: totalBusyTime
            }
        };
    }

    // ==========================================
    // UI RENDERING FUNCTIONS
    // ==========================================

    function renderGanttChart(ganttBlocks, totalTime) {
        DOM.ganttTrack.innerHTML = '';
        DOM.ganttScale.innerHTML = '';

        ganttBlocks.forEach(block => {
            const duration = block.endTime - block.startTime;
            const widthPct = (duration / totalTime) * 100;

            const blockEl = document.createElement('div');
            blockEl.className = `gantt-block ${block.pid === 'IDLE' ? 'idle-block' : ''}`;
            blockEl.style.width = `${widthPct}%`;
            if (block.pid !== 'IDLE') {
                blockEl.style.backgroundColor = block.color;
            }
            blockEl.title = `${block.pid} [Time ${block.startTime} - ${block.endTime}] (Duration: ${duration})`;

            blockEl.innerHTML = `
                <span>${block.pid}</span>
            `;
            DOM.ganttTrack.appendChild(blockEl);
        });

        // Render Scale Ticks
        for (let t = 0; t <= totalTime; t++) {
            const pct = (t / totalTime) * 100;
            const tickEl = document.createElement('div');
            tickEl.className = 'gantt-tick';
            tickEl.style.left = `${pct}%`;
            tickEl.textContent = t;
            DOM.ganttScale.appendChild(tickEl);
        }
    }

    function renderGanttLegend(processes) {
        DOM.ganttLegend.innerHTML = processes.map(p => `
            <div class="legend-badge">
                <span class="legend-color" style="background-color: ${p.color}"></span>
                <span>${p.id}</span>
            </div>
        `).join('');
    }

    function renderResultsTable(metrics) {
        DOM.resultsTableBody.innerHTML = metrics.map(m => `
            <tr>
                <td>
                    <span class="pid-badge" style="background-color: ${m.color}">${m.id}</span>
                </td>
                <td>${m.arrivalTime}</td>
                <td>${m.burstTime}</td>
                <td>${m.priority}</td>
                <td><strong>${m.completionTime}</strong></td>
                <td><span class="text-purple">${m.turnaroundTime}</span></td>
                <td><span class="text-blue">${m.waitingTime}</span></td>
                <td>${m.responseTime}</td>
            </tr>
        `).join('');
    }

    function renderStats(summary) {
        DOM.statAvgWT.innerHTML = `${summary.avgWT} <small>units</small>`;
        DOM.statAvgTAT.innerHTML = `${summary.avgTAT} <small>units</small>`;
        DOM.statCpuUtil.textContent = `${summary.cpuUtil}%`;
        DOM.statThroughput.innerHTML = `${summary.throughput} <small>proc/unit</small>`;
    }

    function renderAlgoInfo(algoKey) {
        const infoMap = {
            'FCFS': {
                name: 'First Come First Served (FCFS)',
                type: 'Non-Preemptive',
                desc: 'Executes processes in order of their arrival time. Simple and fair in order of entry, but susceptible to the Convoy Effect (short jobs waiting behind long ones).',
                complexity: 'O(N log N)'
            },
            'SJF_NP': {
                name: 'Shortest Job First (SJF - Non-Preemptive)',
                type: 'Non-Preemptive',
                desc: 'Selects the waiting process with the smallest initial burst time. Minimizes average waiting time for a set of processes, but can cause starvation for long jobs.',
                complexity: 'O(N log N)'
            },
            'SJF_P': {
                name: 'Shortest Remaining Time First (SRTF / SJF Preemptive)',
                type: 'Preemptive',
                desc: 'Preempts the running process if a new process arrives with a shorter remaining CPU burst time. Optimal for minimal average waiting time.',
                complexity: 'O(N log N)'
            },
            'PRIO_NP': {
                name: 'Priority Scheduling (Non-Preemptive)',
                type: 'Non-Preemptive',
                desc: 'Executes processes based on assigned priority levels. Higher priority jobs complete first. May cause starvation (solved in real OS via aging).',
                complexity: 'O(N log N)'
            },
            'PRIO_P': {
                name: 'Priority Scheduling (Preemptive)',
                type: 'Preemptive',
                desc: 'Preempts the CPU if a higher priority process enters the ready queue. Ensures immediate response for critical priority tasks.',
                complexity: 'O(N log N)'
            },
            'RR': {
                name: 'Round Robin (RR)',
                type: 'Preemptive',
                desc: 'Assigns each process a fixed time slice (Time Quantum $\\Delta t$) in FIFO order. Provides excellent response times and fair CPU allocation for time-sharing systems.',
                complexity: 'O(N)'
            }
        };

        const info = infoMap[algoKey] || infoMap['RR'];
        DOM.algoInfoContent.innerHTML = `
            <h3>${info.name}</h3>
            <p>${info.desc}</p>
            <div class="algo-info-props">
                <span class="prop-badge"><i class="fa-solid fa-bolt"></i> Preemption: ${info.type}</span>
                <span class="prop-badge"><i class="fa-solid fa-clock"></i> Time Complexity: ${info.complexity}</span>
            </div>
        `;
    }

    // ==========================================
    // STEP-BY-STEP PLAYBACK ENGINE & LIVE QUEUE UPDATES
    // ==========================================

    function updateSimulationStepView(timeStep) {
        state.playback.currentTime = timeStep;
        DOM.currentTimeTick.textContent = timeStep;

        const maxT = state.simulation.summary.totalTime;
        const playheadPct = maxT > 0 ? (timeStep / maxT) * 100 : 0;
        DOM.ganttPlayhead.style.left = `${playheadPct}%`;
        DOM.playheadTimeTag.textContent = `t=${timeStep}`;

        const tickData = state.simulation.timelineTicks[timeStep];
        if (!tickData) return;

        // Render Ready Queue Badges
        if (tickData.readyQueue.length === 0) {
            DOM.readyQueueContainer.innerHTML = `<span class="empty-badge">Ready queue empty</span>`;
        } else {
            DOM.readyQueueContainer.innerHTML = tickData.readyQueue.map(p => `
                <div class="queue-item-chip" style="border-color: ${p.color}">
                    <span class="pid-badge" style="background-color: ${p.color}">${p.id}</span>
                    <span class="rem-time">rem: ${tickData.remainingBursts[p.id]}</span>
                </div>
            `).join('');
        }

        // Render Terminated Queue Badges
        if (tickData.terminatedQueue.length === 0) {
            DOM.terminatedQueueContainer.innerHTML = `<span class="empty-badge">None completed yet</span>`;
        } else {
            DOM.terminatedQueueContainer.innerHTML = tickData.terminatedQueue.map(p => `
                <span class="pid-badge" style="background-color: ${p.color}">${p.id}</span>
            `).join('');
        }

        // Render CPU Core State Box
        if (tickData.activeProcess) {
            const active = tickData.activeProcess;
            const remTime = tickData.remainingBursts[active.id];
            const pctDone = Math.round(((active.burstTime - remTime) / active.burstTime) * 100);

            DOM.cpuCoreBox.className = 'cpu-core-box cpu-active';
            DOM.cpuActivePid.textContent = active.id;
            DOM.cpuActivePid.style.color = active.color;
            DOM.cpuActiveDetails.textContent = `Remaining: ${remTime} / ${active.burstTime} (${pctDone}%)`;
        } else {
            DOM.cpuCoreBox.className = 'cpu-core-box cpu-idle';
            DOM.cpuActivePid.textContent = 'IDLE';
            DOM.cpuActivePid.style.color = 'inherit';
            DOM.cpuActiveDetails.textContent = 'CPU core idle';
        }
    }

    function togglePlayPause() {
        if (state.playback.isPlaying) {
            pausePlayback();
        } else {
            startPlayback();
        }
    }

    function startPlayback() {
        if (state.playback.currentTime >= state.playback.maxTime) {
            state.playback.currentTime = 0;
        }
        state.playback.isPlaying = true;
        DOM.btnPlayPause.innerHTML = '<i class="fa-solid fa-pause"></i>';

        state.playback.timerId = setInterval(() => {
            if (state.playback.currentTime < state.playback.maxTime) {
                state.playback.currentTime++;
                updateSimulationStepView(state.playback.currentTime);
            } else {
                pausePlayback();
            }
        }, state.playback.speedMs);
    }

    function pausePlayback() {
        state.playback.isPlaying = false;
        DOM.btnPlayPause.innerHTML = '<i class="fa-solid fa-play"></i>';
        if (state.playback.timerId) {
            clearInterval(state.playback.timerId);
            state.playback.timerId = null;
        }
    }

    function resetPlayback() {
        pausePlayback();
        updateSimulationStepView(0);
    }

    function stepForward() {
        pausePlayback();
        if (state.playback.currentTime < state.playback.maxTime) {
            state.playback.currentTime++;
            updateSimulationStepView(state.playback.currentTime);
        }
    }

    function stepBackward() {
        pausePlayback();
        if (state.playback.currentTime > 0) {
            state.playback.currentTime--;
            updateSimulationStepView(state.playback.currentTime);
        }
    }

    function jumpToEnd() {
        pausePlayback();
        updateSimulationStepView(state.playback.maxTime);
    }

    // ==========================================
    // MULTI-ALGORITHM COMPARISON MODAL
    // ==========================================
    function openComparisonModal() {
        if (state.processes.length === 0) {
            alert('Please add processes before comparing algorithms.');
            return;
        }

        const algos = [
            { key: 'FCFS', name: 'FCFS' },
            { key: 'SJF_NP', name: 'SJF (Non-Preemptive)' },
            { key: 'SJF_P', name: 'SRTF (Preemptive SJF)' },
            { key: 'PRIO_NP', name: 'Priority (Non-Preemptive)' },
            { key: 'PRIO_P', name: 'Priority (Preemptive)' },
            { key: 'RR', name: `Round Robin (TQ=${state.timeQuantum})` }
        ];

        const results = algos.map(a => {
            const sim = computeSchedule(state.processes, a.key, {
                timeQuantum: state.timeQuantum,
                priorityOrder: state.priorityOrder
            });
            return {
                ...a,
                sim
            };
        });

        // Find best algorithm for Avg WT
        let minWT = Math.min(...results.map(r => parseFloat(r.sim.summary.avgWT)));

        DOM.comparisonTableBody.innerHTML = results.map(r => {
            const isBest = parseFloat(r.sim.summary.avgWT) === minWT;
            return `
                <tr>
                    <td><strong>${r.name}</strong></td>
                    <td><strong class="${isBest ? 'text-emerald' : ''}">${r.sim.summary.avgWT}</strong> ${isBest ? '⭐ Best' : ''}</td>
                    <td>${r.sim.summary.avgTAT}</td>
                    <td>${r.sim.summary.avgRT}</td>
                    <td>${r.sim.summary.cpuUtil}%</td>
                    <td>${r.sim.ganttBlocks.length - 1}</td>
                    <td>
                        <span class="val-badge" style="background: ${isBest ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.05)'}">
                            ${isBest ? 'Optimal Efficiency' : 'Standard'}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');

        // Render Stacked Comparative Gantts
        DOM.comparisonGanttsContainer.innerHTML = `<h4>Comparative Gantt Timelines</h4>` + results.map(r => {
            const totalT = r.sim.summary.totalTime;
            const blocksHtml = r.sim.ganttBlocks.map(b => {
                const widthPct = ((b.endTime - b.startTime) / totalT) * 100;
                return `
                    <div class="gantt-block ${b.pid === 'IDLE' ? 'idle-block' : ''}" 
                         style="width: ${widthPct}%; background-color: ${b.pid === 'IDLE' ? 'transparent' : b.color}; height: 32px; font-size: 0.75rem;">
                        ${b.pid}
                    </div>
                `;
            }).join('');

            return `
                <div class="mini-gantt-item">
                    <div class="mini-gantt-header">
                        <span>${r.name}</span>
                        <span>Avg WT: ${r.sim.summary.avgWT} | Avg TAT: ${r.sim.summary.avgTAT}</span>
                    </div>
                    <div class="gantt-track" style="height: 32px;">
                        ${blocksHtml}
                    </div>
                </div>
            `;
        }).join('');

        DOM.compareModal.style.display = 'flex';
    }

    function closeComparisonModal() {
        DOM.compareModal.style.display = 'none';
    }

})();
