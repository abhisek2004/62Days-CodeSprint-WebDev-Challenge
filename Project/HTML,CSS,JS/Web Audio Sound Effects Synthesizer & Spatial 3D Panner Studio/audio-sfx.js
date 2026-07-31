/**
 * SonicCraft Studio - Web Audio Sound Effects Synthesizer & Spatial 3D Panner Engine
 * Author: Antigravity Code Assistant
 * Date: 2026
 */

(function () {
    'use strict';

    // --- State & Audio Engine Global Variables ---
    let audioCtx = null;
    let masterGainNode = null;
    let masterMuteNode = null;
    let masterLimiter = null;
    let analyserNode = null;
    let pannerNode = null;
    let reverbConvolver = null;
    let delayNode = null;
    let delayFeedbackNode = null;

    let isAudioEngineActive = false;
    let isMuted = false;
    let isOrbiting = false;
    let orbitAngle = 0;
    let orbitRadius = 3.5;
    let orbitSpeed = 0.02;

    // Source Position in 3D Space (meters)
    let sourcePos = { x: 2.5, y: 1.2, z: 0.0 };
    let isDraggingSource = false;

    // Visualizer animation frame ID
    let animFrameId = null;

    // Active sound ripple effects on panner canvas
    let rippleEffects = [];

    // Synthesizer Parameters Data Structure
    const synthParams = {
        waveform: 'sine',      // sine, square, sawtooth, triangle, noise
        noiseType: 'white',    // white, pink, brown
        startFreq: 440,
        endFreq: 110,
        sweepTime: 0.30,
        sweepCurve: 'exponential', // exponential, linear, instant
        fmFreq: 0,
        fmDepth: 0,
        adsr: {
            attack: 0.02,
            decay: 0.25,
            sustain: 0.20,
            release: 0.30
        },
        filter: {
            type: 'lowpass',   // none, lowpass, highpass, bandpass, notch
            cutoff: 3500,
            q: 1.0
        },
        fx: {
            distortion: 0,
            reverb: 0.15,
            delay: 0
        },
        panner: {
            hrtf: true,
            distanceModel: 'inverse',
            rolloff: 1.0
        }
    };

    // Preset Configurations
    const SOUND_PRESETS = {
        laser: {
            waveform: 'sawtooth',
            startFreq: 1200,
            endFreq: 80,
            sweepTime: 0.15,
            sweepCurve: 'exponential',
            fmFreq: 0,
            fmDepth: 0,
            adsr: { attack: 0.005, decay: 0.12, sustain: 0.01, release: 0.05 },
            filter: { type: 'lowpass', cutoff: 5000, q: 2.0 },
            fx: { distortion: 10, reverb: 0.05, delay: 0 }
        },
        explosion: {
            waveform: 'noise',
            noiseType: 'brown',
            startFreq: 250,
            endFreq: 30,
            sweepTime: 0.8,
            sweepCurve: 'exponential',
            fmFreq: 0,
            fmDepth: 0,
            adsr: { attack: 0.01, decay: 0.5, sustain: 0.1, release: 0.6 },
            filter: { type: 'lowpass', cutoff: 800, q: 1.0 },
            fx: { distortion: 30, reverb: 0.4, delay: 0.15 }
        },
        coin: {
            waveform: 'square',
            startFreq: 987, // B5
            endFreq: 1318, // E6
            sweepTime: 0.12,
            sweepCurve: 'instant',
            fmFreq: 0,
            fmDepth: 0,
            adsr: { attack: 0.005, decay: 0.08, sustain: 0.4, release: 0.15 },
            filter: { type: 'none', cutoff: 10000, q: 1.0 },
            fx: { distortion: 0, reverb: 0.1, delay: 0 }
        },
        jump: {
            waveform: 'square',
            startFreq: 150,
            endFreq: 750,
            sweepTime: 0.35,
            sweepCurve: 'linear',
            fmFreq: 0,
            fmDepth: 0,
            adsr: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.1 },
            filter: { type: 'lowpass', cutoff: 4000, q: 1.5 },
            fx: { distortion: 0, reverb: 0.1, delay: 0 }
        },
        alarm: {
            waveform: 'sine',
            startFreq: 600,
            endFreq: 600,
            sweepTime: 0.6,
            sweepCurve: 'linear',
            fmFreq: 8,
            fmDepth: 350,
            adsr: { attack: 0.05, decay: 0.2, sustain: 0.8, release: 0.2 },
            filter: { type: 'bandpass', cutoff: 1200, q: 2.0 },
            fx: { distortion: 5, reverb: 0.2, delay: 0.2 }
        },
        teleport: {
            waveform: 'sawtooth',
            startFreq: 180,
            endFreq: 3200,
            sweepTime: 0.45,
            sweepCurve: 'exponential',
            fmFreq: 25,
            fmDepth: 200,
            adsr: { attack: 0.02, decay: 0.3, sustain: 0.2, release: 0.2 },
            filter: { type: 'highpass', cutoff: 600, q: 4.0 },
            fx: { distortion: 15, reverb: 0.35, delay: 0.25 }
        },
        spell: {
            waveform: 'noise',
            noiseType: 'white',
            startFreq: 2000,
            endFreq: 500,
            sweepTime: 0.7,
            sweepCurve: 'linear',
            fmFreq: 12,
            fmDepth: 150,
            adsr: { attack: 0.05, decay: 0.3, sustain: 0.3, release: 0.4 },
            filter: { type: 'bandpass', cutoff: 2400, q: 5.0 },
            fx: { distortion: 0, reverb: 0.5, delay: 0.3 }
        },
        hit: {
            waveform: 'triangle',
            startFreq: 180,
            endFreq: 30,
            sweepTime: 0.15,
            sweepCurve: 'exponential',
            fmFreq: 0,
            fmDepth: 0,
            adsr: { attack: 0.005, decay: 0.1, sustain: 0.05, release: 0.08 },
            filter: { type: 'lowpass', cutoff: 1500, q: 1.0 },
            fx: { distortion: 20, reverb: 0.1, delay: 0 }
        }
    };

    // DOM Elements Cache
    let el = {};

    // --- Initializer ---
    document.addEventListener('DOMContentLoaded', () => {
        cacheDOM();
        initPannerCanvas();
        initVisualizerCanvas();
        bindEvents();
        updateUIFromParams();
        renderExportPreview();
    });

    function cacheDOM() {
        el.btnPower = document.getElementById('btn-power');
        el.audioStatus = document.getElementById('audio-status');
        el.masterVol = document.getElementById('master-volume');
        el.masterVolVal = document.getElementById('master-vol-val');
        el.btnMute = document.getElementById('btn-mute');
        el.btnShortcuts = document.getElementById('btn-shortcuts');
        el.btnHelp = document.getElementById('btn-help');

        // Waveform
        el.waveButtons = document.querySelectorAll('.btn-wave');
        el.noiseOptions = document.getElementById('noise-options');
        el.noiseType = document.getElementById('noise-type');

        // Pitch & Sweep
        el.startFreq = document.getElementById('start-freq');
        el.startFreqVal = document.getElementById('start-freq-val');
        el.endFreq = document.getElementById('end-freq');
        el.endFreqVal = document.getElementById('end-freq-val');
        el.sweepTime = document.getElementById('sweep-time');
        el.sweepTimeVal = document.getElementById('sweep-time-val');
        el.sweepCurve = document.getElementById('sweep-curve');
        el.fmFreq = document.getElementById('fm-freq');
        el.fmFreqVal = document.getElementById('fm-freq-val');
        el.fmDepth = document.getElementById('fm-depth');
        el.fmDepthVal = document.getElementById('fm-depth-val');

        // ADSR
        el.adsrA = document.getElementById('adsr-a');
        el.adsrAVal = document.getElementById('adsr-a-val');
        el.adsrD = document.getElementById('adsr-d');
        el.adsrDVal = document.getElementById('adsr-d-val');
        el.adsrS = document.getElementById('adsr-s');
        el.adsrSVal = document.getElementById('adsr-s-val');
        el.adsrR = document.getElementById('adsr-r');
        el.adsrRVal = document.getElementById('adsr-r-val');

        // Filter & FX
        el.filterType = document.getElementById('filter-type');
        el.filterCutoff = document.getElementById('filter-cutoff');
        el.filterCutoffVal = document.getElementById('filter-cutoff-val');
        el.filterRes = document.getElementById('filter-res');
        el.filterResVal = document.getElementById('filter-res-val');
        el.fxDistortion = document.getElementById('fx-distortion');
        el.fxDistortionVal = document.getElementById('fx-distortion-val');
        el.fxReverb = document.getElementById('fx-reverb');
        el.fxReverbVal = document.getElementById('fx-reverb-val');
        el.fxDelay = document.getElementById('fx-delay');
        el.fxDelayVal = document.getElementById('fx-delay-val');

        // Action Trigger
        el.btnTrigger = document.getElementById('btn-trigger-sound');

        // Spatial 3D Panner
        el.pannerCanvas = document.getElementById('panner-canvas');
        el.pannerHrtf = document.getElementById('panner-hrtf-toggle');
        el.pannerZ = document.getElementById('panner-z');
        el.pannerZVal = document.getElementById('panner-z-val');
        el.pannerDistModel = document.getElementById('panner-distance-model');
        el.pannerRolloff = document.getElementById('panner-rolloff');
        el.pannerRolloffVal = document.getElementById('panner-rolloff-val');
        el.posXVal = document.getElementById('pos-x-val');
        el.posYVal = document.getElementById('pos-y-val');
        el.posZVal = document.getElementById('pos-z-val');
        el.btnOrbit = document.getElementById('btn-orbit');
        el.btnCenterSource = document.getElementById('btn-center-source');

        // Visualizer
        el.spectrumCanvas = document.getElementById('spectrum-canvas');
        el.meterLeft = document.getElementById('meter-left');
        el.meterRight = document.getElementById('meter-right');
        el.btnVizBoth = document.getElementById('btn-viz-both');
        el.btnVizSpec = document.getElementById('btn-viz-spec');
        el.btnVizWave = document.getElementById('btn-viz-wave');

        // Presets & Exporter
        el.presetGrid = document.getElementById('preset-buttons-grid');
        el.btnSavePreset = document.getElementById('btn-save-preset');
        el.btnExportJson = document.getElementById('btn-export-json');
        el.btnExportWav = document.getElementById('btn-export-wav');
        el.exportEstDuration = document.getElementById('export-est-duration');
        el.exportPreviewCanvas = document.getElementById('export-preview-canvas');

        // Modals
        el.modalHotkeys = document.getElementById('modal-hotkeys');
        el.modalHelp = document.getElementById('modal-help');
        el.btnCloseHotkeys = document.getElementById('btn-close-hotkeys');
        el.btnCloseHelp = document.getElementById('btn-close-help');
    }

    // --- Web Audio Context Initialization ---
    function initAudioContext() {
        if (audioCtx) {
            if (audioCtx.state === 'suspended') {
                audioCtx.resume();
            }
            return;
        }

        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();

        // Master Gain & Mute Node
        masterGainNode = audioCtx.createGain();
        masterGainNode.gain.value = parseFloat(el.masterVol.value);

        masterMuteNode = audioCtx.createGain();
        masterMuteNode.gain.value = isMuted ? 0 : 1;

        // Dynamics Compressor (Limiter)
        masterLimiter = audioCtx.createDynamicsCompressor();
        masterLimiter.threshold.setValueAtTime(-2, audioCtx.currentTime);
        masterLimiter.knee.setValueAtTime(0, audioCtx.currentTime);
        masterLimiter.ratio.setValueAtTime(20, audioCtx.currentTime);
        masterLimiter.attack.setValueAtTime(0.003, audioCtx.currentTime);
        masterLimiter.release.setValueAtTime(0.05, audioCtx.currentTime);

        // Analyser Node
        analyserNode = audioCtx.createAnalyser();
        analyserNode.fftSize = 1024;
        analyserNode.smoothingTimeConstant = 0.8;

        // 3D Spatial Panner Node
        updateSpatialPannerNode();

        // Create Reverb Impulse Response Convolver
        reverbConvolver = audioCtx.createConvolver();
        reverbConvolver.buffer = createReverbImpulse(1.8, 2.0);

        // Delay Node
        delayNode = audioCtx.createDelay();
        delayNode.delayTime.value = 0.25; // 250ms delay
        delayFeedbackNode = audioCtx.createGain();
        delayFeedbackNode.gain.value = synthParams.fx.delay;
        delayNode.connect(delayFeedbackNode);
        delayFeedbackNode.connect(delayNode);

        // Signal Chain: Output -> MasterGain -> MasterMute -> MasterLimiter -> Analyser -> Speaker Destination
        masterGainNode.connect(masterMuteNode);
        masterMuteNode.connect(masterLimiter);
        masterLimiter.connect(analyserNode);
        analyserNode.connect(audioCtx.destination);

        // Set Listener Orientation (Facing -Z, Up +Y)
        if (audioCtx.listener.positionX) {
            audioCtx.listener.positionX.setValueAtTime(0, audioCtx.currentTime);
            audioCtx.listener.positionY.setValueAtTime(0, audioCtx.currentTime);
            audioCtx.listener.positionZ.setValueAtTime(0, audioCtx.currentTime);
            audioCtx.listener.forwardX.setValueAtTime(0, audioCtx.currentTime);
            audioCtx.listener.forwardY.setValueAtTime(0, audioCtx.currentTime);
            audioCtx.listener.forwardZ.setValueAtTime(-1, audioCtx.currentTime);
            audioCtx.listener.upX.setValueAtTime(0, audioCtx.currentTime);
            audioCtx.listener.upY.setValueAtTime(1, audioCtx.currentTime);
            audioCtx.listener.upZ.setValueAtTime(0, audioCtx.currentTime);
        } else if (audioCtx.listener.setOrientation) {
            audioCtx.listener.setOrientation(0, 0, -1, 0, 1, 0);
        }

        updateEngineStatusUI(true);
        startVisualizerLoop();
    }

    function updateSpatialPannerNode() {
        if (!audioCtx) return;

        if (pannerNode) {
            pannerNode.disconnect();
        }

        pannerNode = audioCtx.createPanner();
        pannerNode.panningModel = synthParams.panner.hrtf ? 'HRTF' : 'equalpower';
        pannerNode.distanceModel = synthParams.panner.distanceModel;
        pannerNode.rolloffFactor = synthParams.panner.rolloff;
        pannerNode.refDistance = 1;
        pannerNode.maxDistance = 10000;

        // Position Panner
        setPannerPosition(sourcePos.x, sourcePos.y, sourcePos.z);

        // Connect Panner -> Master Gain
        pannerNode.connect(masterGainNode);
    }

    function setPannerPosition(x, y, z) {
        sourcePos.x = x;
        sourcePos.y = y;
        sourcePos.z = z;

        if (el.posXVal) el.posXVal.textContent = x.toFixed(1);
        if (el.posYVal) el.posYVal.textContent = y.toFixed(1);
        if (el.posZVal) el.posZVal.textContent = z.toFixed(1);

        if (pannerNode && audioCtx) {
            if (pannerNode.positionX) {
                pannerNode.positionX.setValueAtTime(x, audioCtx.currentTime);
                pannerNode.positionY.setValueAtTime(y, audioCtx.currentTime);
                pannerNode.positionZ.setValueAtTime(z, audioCtx.currentTime);
            } else if (pannerNode.setPosition) {
                pannerNode.setPosition(x, y, z);
            }
        }
    }

    function updateEngineStatusUI(active) {
        isAudioEngineActive = active;
        if (active) {
            el.audioStatus.querySelector('.status-dot').className = 'status-dot active';
            el.audioStatus.querySelector('.status-text').textContent = 'Engine Active';
            el.btnPower.innerHTML = '<i class="fa-solid fa-check"></i> Engine Ready';
            el.btnPower.classList.replace('btn-primary', 'btn-secondary');
        } else {
            el.audioStatus.querySelector('.status-dot').className = 'status-dot suspended';
            el.audioStatus.querySelector('.status-text').textContent = 'Engine Off';
        }
    }

    // --- Reverb Impulse Generator ---
    function createReverbImpulse(duration, decay) {
        const sampleRate = audioCtx ? audioCtx.sampleRate : 44100;
        const length = sampleRate * duration;
        const impulse = audioCtx.createBuffer(2, length, sampleRate);
        const left = impulse.getChannelData(0);
        const right = impulse.getChannelData(1);

        for (let i = 0; i < length; i++) {
            const n = i / length;
            left[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, decay);
            right[i] = (Math.random() * 2 - 1) * Math.pow(1 - n, decay);
        }
        return impulse;
    }

    // --- Procedural Noise Generator Buffer ---
    function createNoiseBuffer(ctx, type, duration) {
        const sampleRate = ctx.sampleRate;
        const bufferSize = sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
        const data = buffer.getChannelData(0);

        if (type === 'white') {
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
        } else if (type === 'pink') {
            let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
                data[i] *= 0.11;
                b6 = white * 0.115926;
            }
        } else if (type === 'brown') {
            let lastOut = 0.0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                data[i] = (lastOut + (0.02 * white)) / 1.02;
                lastOut = data[i];
                data[i] *= 3.5; // Gain compensation
            }
        }
        return buffer;
    }

    // --- Distortion Curve Generator ---
    function makeDistortionCurve(amount) {
        const k = typeof amount === 'number' ? amount : 50;
        const n_samples = 44100;
        const curve = new Float32Array(n_samples);
        const deg = Math.PI / 180;
        for (let i = 0; i < n_samples; ++i) {
            const x = (i * 2) / n_samples - 1;
            curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
        }
        return curve;
    }

    // --- Main Live Sound Trigger Function ---
    function triggerSynthesizedSound() {
        initAudioContext();
        if (!audioCtx) return;

        const now = audioCtx.currentTime;
        const adsr = synthParams.adsr;
        const totalDuration = synthParams.sweepTime + adsr.attack + adsr.decay + adsr.release;

        // 1. Create Source Node (Oscillator or Procedural Noise Buffer)
        let sourceNode = null;
        let fmOsc = null;

        if (synthParams.waveform === 'noise') {
            sourceNode = audioCtx.createBufferSource();
            sourceNode.buffer = createNoiseBuffer(audioCtx, synthParams.noiseType, totalDuration);
        } else {
            sourceNode = audioCtx.createOscillator();
            sourceNode.type = synthParams.waveform;

            // Pitch Sweep Control
            sourceNode.frequency.setValueAtTime(synthParams.startFreq, now);
            if (synthParams.sweepCurve === 'exponential') {
                const safeEndFreq = Math.max(1, synthParams.endFreq);
                sourceNode.frequency.exponentialRampToValueAtTime(safeEndFreq, now + synthParams.sweepTime);
            } else if (synthParams.sweepCurve === 'linear') {
                sourceNode.frequency.linearRampToValueAtTime(synthParams.endFreq, now + synthParams.sweepTime);
            } else if (synthParams.sweepCurve === 'instant') {
                sourceNode.frequency.setValueAtTime(synthParams.endFreq, now + synthParams.sweepTime / 2);
            }

            // FM Frequency Modulator (LFO)
            if (synthParams.fmFreq > 0 && synthParams.fmDepth > 0) {
                fmOsc = audioCtx.createOscillator();
                const fmGain = audioCtx.createGain();
                fmOsc.frequency.value = synthParams.fmFreq;
                fmGain.gain.value = synthParams.fmDepth;
                fmOsc.connect(fmGain);
                fmGain.connect(sourceNode.frequency);
                fmOsc.start(now);
                fmOsc.stop(now + totalDuration);
            }
        }

        // 2. Filter Node
        let filterNode = null;
        if (synthParams.filter.type !== 'none') {
            filterNode = audioCtx.createBiquadFilter();
            filterNode.type = synthParams.filter.type;
            filterNode.frequency.setValueAtTime(synthParams.filter.cutoff, now);
            filterNode.Q.setValueAtTime(synthParams.filter.q, now);
        }

        // 3. ADSR Gain Envelope Node
        const envelopeNode = audioCtx.createGain();
        envelopeNode.gain.setValueAtTime(0, now);
        // Attack
        const attackEnd = now + adsr.attack;
        envelopeNode.gain.linearRampToValueAtTime(1.0, attackEnd);
        // Decay
        const decayEnd = attackEnd + adsr.decay;
        const sustainLevel = Math.max(0.0001, adsr.sustain);
        envelopeNode.gain.exponentialRampToValueAtTime(sustainLevel, decayEnd);
        // Sustain & Release
        const releaseStart = Math.max(decayEnd, now + synthParams.sweepTime);
        const releaseEnd = releaseStart + adsr.release;
        envelopeNode.gain.setValueAtTime(sustainLevel, releaseStart);
        envelopeNode.gain.exponentialRampToValueAtTime(0.0001, releaseEnd);

        // 4. FX Rack (Distortion, Reverb, Delay)
        let lastNode = sourceNode;

        if (filterNode) {
            lastNode.connect(filterNode);
            lastNode = filterNode;
        }

        lastNode.connect(envelopeNode);
        lastNode = envelopeNode;

        // Distortion
        if (synthParams.fx.distortion > 0) {
            const waveshaper = audioCtx.createWaveShaper();
            waveshaper.curve = makeDistortionCurve(synthParams.fx.distortion);
            lastNode.connect(waveshaper);
            lastNode = waveshaper;
        }

        // Reverb Send
        if (synthParams.fx.reverb > 0 && reverbConvolver) {
            const reverbGain = audioCtx.createGain();
            reverbGain.gain.value = synthParams.fx.reverb;
            lastNode.connect(reverbConvolver);
            reverbConvolver.connect(reverbGain);
            reverbGain.connect(pannerNode);
        }

        // Delay Send
        if (synthParams.fx.delay > 0 && delayNode) {
            delayFeedbackNode.gain.value = synthParams.fx.delay;
            lastNode.connect(delayNode);
            delayNode.connect(pannerNode);
        }

        // Connect final node to Spatial 3D Panner
        lastNode.connect(pannerNode);

        // Play Sound
        sourceNode.start(now);
        sourceNode.stop(releaseEnd + 0.1);

        // Add visual sound ripple to 3D panner pad
        triggerPannerRipple();
    }

    function triggerPannerRipple() {
        rippleEffects.push({
            x: sourcePos.x,
            y: sourcePos.y,
            radius: 5,
            maxRadius: 80,
            alpha: 1.0
        });
    }

    // --- Interactive 2D/3D Panner Pad Canvas ---
    function initPannerCanvas() {
        const canvas = el.pannerCanvas;
        const ctx = canvas.getContext('2d');

        function drawPannerPad() {
            const w = canvas.width;
            const h = canvas.height;
            const centerX = w / 2;
            const centerY = h / 2;
            const scale = 22; // 1 meter = 22 pixels

            ctx.clearRect(0, 0, w, h);

            // Draw Grid & Meters Axes
            ctx.strokeStyle = '#1d2738';
            ctx.lineWidth = 1;

            // Distance Grid Circles (2m, 4m, 6m, 8m, 10m)
            for (let r = 2; r <= 10; r += 2) {
                ctx.beginPath();
                ctx.arc(centerX, centerY, r * scale, 0, Math.PI * 2);
                ctx.stroke();

                ctx.fillStyle = '#4a5568';
                ctx.font = '10px JetBrains Mono';
                ctx.fillText(`${r}m`, centerX + r * scale + 4, centerY - 4);
            }

            // X / Y Center Axes
            ctx.beginPath();
            ctx.moveTo(centerX, 0);
            ctx.lineTo(centerX, h);
            ctx.moveTo(0, centerY);
            ctx.lineTo(w, centerY);
            ctx.stroke();

            // Auto-Orbit Logic
            if (isOrbiting) {
                orbitAngle += orbitSpeed;
                const newX = Math.cos(orbitAngle) * orbitRadius;
                const newY = Math.sin(orbitAngle) * orbitRadius;
                setPannerPosition(newX, newY, sourcePos.z);
            }

            // Convert meter position to canvas pixels
            const sourcePxX = centerX + sourcePos.x * scale;
            const sourcePxY = centerY - sourcePos.y * scale;

            // Draw Ripples
            for (let i = rippleEffects.length - 1; i >= 0; i--) {
                const rip = rippleEffects[i];
                ctx.beginPath();
                ctx.arc(sourcePxX, sourcePxY, rip.radius, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(0, 243, 255, ${rip.alpha})`;
                ctx.lineWidth = 2;
                ctx.stroke();

                rip.radius += 2.5;
                rip.alpha -= 0.025;

                if (rip.alpha <= 0 || rip.radius >= rip.maxRadius) {
                    rippleEffects.splice(i, 1);
                }
            }

            // Distance line connecting Listener and Source
            ctx.beginPath();
            ctx.setLineDash([4, 4]);
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(sourcePxX, sourcePxY);
            ctx.strokeStyle = 'rgba(0, 243, 255, 0.4)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw Listener Node (Center Headphones)
            ctx.beginPath();
            ctx.arc(centerX, centerY, 14, 0, Math.PI * 2);
            ctx.fillStyle = '#00ff9d';
            ctx.shadowColor = '#00ff9d';
            ctx.shadowBlur = 12;
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.fillStyle = '#0b0d12';
            ctx.font = '10px FontAwesome';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('\uf025', centerX, centerY); // Headphones icon

            // Draw Sound Source Node
            ctx.beginPath();
            ctx.arc(sourcePxX, sourcePxY, 16, 0, Math.PI * 2);
            ctx.fillStyle = '#00f3ff';
            ctx.shadowColor = '#00f3ff';
            ctx.shadowBlur = 18;
            ctx.fill();
            ctx.shadowBlur = 0;

            ctx.fillStyle = '#0b0d12';
            ctx.fillText('\uf140', sourcePxX, sourcePxY); // Target Bullseye icon

            requestAnimationFrame(drawPannerPad);
        }

        drawPannerPad();

        // Mouse Drag Controls for Panner Source
        function updatePosFromMouse(e) {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const scale = 22;
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;

            const mX = (mouseX - centerX) / scale;
            const mY = (centerY - mouseY) / scale;

            setPannerPosition(mX, mY, sourcePos.z);
        }

        canvas.addEventListener('mousedown', (e) => {
            isDraggingSource = true;
            if (isOrbiting) {
                isOrbiting = false;
                el.btnOrbit.classList.remove('active');
                el.btnOrbit.innerHTML = '<i class="fa-solid fa-rotate"></i> Auto Orbit: OFF';
            }
            updatePosFromMouse(e);
        });

        window.addEventListener('mousemove', (e) => {
            if (isDraggingSource) {
                updatePosFromMouse(e);
            }
        });

        window.addEventListener('mouseup', () => {
            isDraggingSource = false;
        });
    }

    // --- Real-time Spectrum Analyzer & Oscilloscope ---
    let vizMode = 'both';

    function initVisualizerCanvas() {
        el.btnVizBoth.addEventListener('click', () => setVizMode('both'));
        el.btnVizSpec.addEventListener('click', () => setVizMode('spectrum'));
        el.btnVizWave.addEventListener('click', () => setVizMode('waveform'));
    }

    function setVizMode(mode) {
        vizMode = mode;
        [el.btnVizBoth, el.btnVizSpec, el.btnVizWave].forEach(btn => btn.classList.remove('active'));
        if (mode === 'both') el.btnVizBoth.classList.add('active');
        if (mode === 'spectrum') el.btnVizSpec.classList.add('active');
        if (mode === 'waveform') el.btnVizWave.classList.add('active');
    }

    function startVisualizerLoop() {
        const canvas = el.spectrumCanvas;
        const ctx = canvas.getContext('2d');

        const freqData = new Uint8Array(analyserNode.frequencyBinCount);
        const waveData = new Uint8Array(analyserNode.fftSize);

        function drawVisualizer() {
            animFrameId = requestAnimationFrame(drawVisualizer);

            const w = canvas.width;
            const h = canvas.height;
            ctx.clearRect(0, 0, w, h);

            analyserNode.getByteFrequencyData(freqData);
            analyserNode.getByteTimeDomainData(waveData);

            // Calculate VU meters level
            let sum = 0;
            for (let i = 0; i < freqData.length; i++) {
                sum += freqData[i];
            }
            const avg = sum / freqData.length;
            const levelPct = Math.min(100, (avg / 128) * 100);
            if (el.meterLeft) el.meterLeft.style.height = `${levelPct}%`;
            if (el.meterRight) el.meterRight.style.height = `${Math.max(0, levelPct * 0.95)}%`;

            // Draw Frequency Spectrum FFT
            if (vizMode === 'both' || vizMode === 'spectrum') {
                const barWidth = (w / 64);
                let x = 0;

                for (let i = 0; i < 64; i++) {
                    const barHeight = (freqData[i * 4] / 255) * h;

                    const gradient = ctx.createLinearGradient(0, h, 0, 0);
                    gradient.addColorStop(0, 'rgba(0, 243, 255, 0.2)');
                    gradient.addColorStop(0.6, '#00f3ff');
                    gradient.addColorStop(1, '#9d4edf');

                    ctx.fillStyle = gradient;
                    ctx.fillRect(x, h - barHeight, barWidth - 2, barHeight);

                    x += barWidth;
                }
            }

            // Draw Oscilloscope Waveform Line
            if (vizMode === 'both' || vizMode === 'waveform') {
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#00ff9d';
                ctx.shadowColor = '#00ff9d';
                ctx.shadowBlur = 8;
                ctx.beginPath();

                const sliceWidth = w / waveData.length;
                let x = 0;

                for (let i = 0; i < waveData.length; i++) {
                    const v = waveData[i] / 128.0;
                    const y = (v * h) / 2;

                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                    x += sliceWidth;
                }

                ctx.lineTo(w, h / 2);
                ctx.stroke();
                ctx.shadowBlur = 0;
            }
        }

        drawVisualizer();
    }

    // --- Audio WAV File Exporter Engine (OfflineAudioContext) ---
    function renderAndDownloadWAV() {
        const sampleRate = 44100;
        const adsr = synthParams.adsr;
        const totalDuration = synthParams.sweepTime + adsr.attack + adsr.decay + adsr.release + 0.2;

        const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
            2,
            Math.ceil(sampleRate * totalDuration),
            sampleRate
        );

        const now = 0;

        // 1. Source Node
        let sourceNode = null;
        if (synthParams.waveform === 'noise') {
            sourceNode = offlineCtx.createBufferSource();
            sourceNode.buffer = createNoiseBuffer(offlineCtx, synthParams.noiseType, totalDuration);
        } else {
            sourceNode = offlineCtx.createOscillator();
            sourceNode.type = synthParams.waveform;
            sourceNode.frequency.setValueAtTime(synthParams.startFreq, now);

            if (synthParams.sweepCurve === 'exponential') {
                sourceNode.frequency.exponentialRampToValueAtTime(Math.max(1, synthParams.endFreq), now + synthParams.sweepTime);
            } else if (synthParams.sweepCurve === 'linear') {
                sourceNode.frequency.linearRampToValueAtTime(synthParams.endFreq, now + synthParams.sweepTime);
            } else if (synthParams.sweepCurve === 'instant') {
                sourceNode.frequency.setValueAtTime(synthParams.endFreq, now + synthParams.sweepTime / 2);
            }
        }

        // 2. Filter Node
        let filterNode = null;
        if (synthParams.filter.type !== 'none') {
            filterNode = offlineCtx.createBiquadFilter();
            filterNode.type = synthParams.filter.type;
            filterNode.frequency.setValueAtTime(synthParams.filter.cutoff, now);
            filterNode.Q.setValueAtTime(synthParams.filter.q, now);
        }

        // 3. ADSR Envelope
        const envelopeNode = offlineCtx.createGain();
        envelopeNode.gain.setValueAtTime(0, now);
        envelopeNode.gain.linearRampToValueAtTime(1.0, now + adsr.attack);
        envelopeNode.gain.exponentialRampToValueAtTime(Math.max(0.0001, adsr.sustain), now + adsr.attack + adsr.decay);
        envelopeNode.gain.setValueAtTime(Math.max(0.0001, adsr.sustain), now + synthParams.sweepTime);
        envelopeNode.gain.exponentialRampToValueAtTime(0.0001, now + synthParams.sweepTime + adsr.release);

        // 4. 3D Spatial Panner Node
        const panner = offlineCtx.createPanner();
        panner.panningModel = synthParams.panner.hrtf ? 'HRTF' : 'equalpower';
        panner.distanceModel = synthParams.panner.distanceModel;
        panner.rolloffFactor = synthParams.panner.rolloff;
        if (panner.positionX) {
            panner.positionX.setValueAtTime(sourcePos.x, now);
            panner.positionY.setValueAtTime(sourcePos.y, now);
            panner.positionZ.setValueAtTime(sourcePos.z, now);
        } else if (panner.setPosition) {
            panner.setPosition(sourcePos.x, sourcePos.y, sourcePos.z);
        }

        // Signal Chain
        let lastNode = sourceNode;
        if (filterNode) {
            lastNode.connect(filterNode);
            lastNode = filterNode;
        }
        lastNode.connect(envelopeNode);
        envelopeNode.connect(panner);
        panner.connect(offlineCtx.destination);

        sourceNode.start(now);
        sourceNode.stop(now + totalDuration);

        // Render Offline Buffer
        offlineCtx.startRendering().then(renderedBuffer => {
            const wavBlob = bufferToWavBlob(renderedBuffer);
            const filename = `sfx_${synthParams.waveform}_${Date.now()}.wav`;

            // Trigger Download
            const url = URL.createObjectURL(wavBlob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);
        });
    }

    // --- AudioBuffer to PCM 16-Bit WAV Blob Converter ---
    function bufferToWavBlob(buffer) {
        const numOfChan = buffer.numberOfChannels;
        const length = buffer.length * numOfChan * 2 + 44;
        const out = new DataView(new ArrayBuffer(length));
        let channels = [];
        let sampleRate = buffer.sampleRate;
        let offset = 0;
        let pos = 0;

        function writeString(str) {
            for (let i = 0; i < str.length; i++) {
                out.setUint8(pos++, str.charCodeAt(i));
            }
        }

        function setUint16(data) {
            out.setUint16(pos, data, true);
            pos += 2;
        }

        function setUint32(data) {
            out.setUint32(pos, data, true);
            pos += 4;
        }

        // RIFF Header
        writeString('RIFF');
        setUint32(length - 8);
        writeString('WAVE');
        writeString('fmt ');
        setUint32(16); // Subchunk1Size (16 for PCM)
        setUint16(1);  // AudioFormat (1 for PCM)
        setUint16(numOfChan);
        setUint32(sampleRate);
        setUint32(sampleRate * 2 * numOfChan); // ByteRate
        setUint16(numOfChan * 2); // BlockAlign
        setUint16(16); // BitsPerSample

        // Data Chunk
        writeString('data');
        setUint32(length - pos - 4);

        for (let i = 0; i < buffer.numberOfChannels; i++) {
            channels.push(buffer.getChannelData(i));
        }

        while (offset < buffer.length) {
            for (let i = 0; i < numOfChan; i++) {
                let sample = Math.max(-1, Math.min(1, channels[i][offset])); // Clamp
                sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
                out.setInt16(pos, sample, true);
                pos += 2;
            }
            offset++;
        }

        return new Blob([out], { type: 'audio/wav' });
    }

    // --- Render Export Preview Canvas ---
    function renderExportPreview() {
        const canvas = el.exportPreviewCanvas;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;

        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#0c0e14';
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = '#00f3ff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();

        const points = 100;
        const adsr = synthParams.adsr;
        const total = synthParams.sweepTime + adsr.attack + adsr.decay + adsr.release;

        if (el.exportEstDuration) {
            el.exportEstDuration.textContent = `${total.toFixed(2)} sec`;
        }

        for (let i = 0; i < points; i++) {
            const x = (i / points) * w;
            const t = (i / points) * total;

            let amp = 0;
            if (t < adsr.attack) {
                amp = t / adsr.attack;
            } else if (t < adsr.attack + adsr.decay) {
                amp = 1.0 - (1.0 - adsr.sustain) * ((t - adsr.attack) / adsr.decay);
            } else if (t < synthParams.sweepTime) {
                amp = adsr.sustain;
            } else if (t < total) {
                amp = adsr.sustain * (1.0 - (t - synthParams.sweepTime) / adsr.release);
            }

            const y = h / 2 + (Math.sin(i * 0.5) * (amp * (h / 2 - 4)));
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }

        ctx.stroke();
    }

    // --- Bind UI Events & Listeners ---
    function bindEvents() {
        // Power Engine
        el.btnPower.addEventListener('click', () => {
            initAudioContext();
        });

        // Master Volume & Mute
        el.masterVol.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            el.masterVolVal.textContent = `${Math.round(val * 100)}%`;
            if (masterGainNode) masterGainNode.gain.value = val;
        });

        el.btnMute.addEventListener('click', () => {
            isMuted = !isMuted;
            if (masterMuteNode) masterMuteNode.gain.value = isMuted ? 0 : 1;
            el.btnMute.innerHTML = isMuted ? '<i class="fa-solid fa-volume-xmark" style="color:var(--accent-rose)"></i>' : '<i class="fa-solid fa-volume-high"></i>';
        });

        // Waveform Selector Buttons
        el.waveButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                el.waveButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                synthParams.waveform = btn.dataset.wave;
                if (synthParams.waveform === 'noise') {
                    el.noiseOptions.classList.remove('hidden');
                } else {
                    el.noiseOptions.classList.add('hidden');
                }
                renderExportPreview();
            });
        });

        el.noiseType.addEventListener('change', (e) => {
            synthParams.noiseType = e.target.value;
        });

        // Pitch & Sweep Sliders
        bindSlider(el.startFreq, el.startFreqVal, (v) => synthParams.startFreq = parseFloat(v));
        bindSlider(el.endFreq, el.endFreqVal, (v) => synthParams.endFreq = parseFloat(v));
        bindSlider(el.sweepTime, el.sweepTimeVal, (v) => synthParams.sweepTime = parseFloat(v), 2);
        el.sweepCurve.addEventListener('change', (e) => synthParams.sweepCurve = e.target.value);

        bindSlider(el.fmFreq, el.fmFreqVal, (v) => synthParams.fmFreq = parseFloat(v), 1);
        bindSlider(el.fmDepth, el.fmDepthVal, (v) => synthParams.fmDepth = parseFloat(v));

        // ADSR Sliders
        bindSlider(el.adsrA, el.adsrAVal, (v) => synthParams.adsr.attack = parseFloat(v), 2, 's');
        bindSlider(el.adsrD, el.adsrDVal, (v) => synthParams.adsr.decay = parseFloat(v), 2, 's');
        bindSlider(el.adsrS, el.adsrSVal, (v) => synthParams.adsr.sustain = parseFloat(v), 0, '%', (val) => Math.round(val * 100));
        bindSlider(el.adsrR, el.adsrRVal, (v) => synthParams.adsr.release = parseFloat(v), 2, 's');

        // Filter & FX Sliders
        el.filterType.addEventListener('change', (e) => synthParams.filter.type = e.target.value);
        bindSlider(el.filterCutoff, el.filterCutoffVal, (v) => synthParams.filter.cutoff = parseFloat(v));
        bindSlider(el.filterRes, el.filterResVal, (v) => synthParams.filter.q = parseFloat(v), 1);
        bindSlider(el.fxDistortion, el.fxDistortionVal, (v) => synthParams.fx.distortion = parseFloat(v));
        bindSlider(el.fxReverb, el.fxReverbVal, (v) => synthParams.fx.reverb = parseFloat(v), 0, '%', (val) => Math.round(val * 100));
        bindSlider(el.fxDelay, el.fxDelayVal, (v) => synthParams.fx.delay = parseFloat(v), 0, '%', (val) => Math.round(val * 100));

        // Action Trigger Button
        el.btnTrigger.addEventListener('click', () => {
            triggerSynthesizedSound();
        });

        // Spatial 3D Controls
        el.pannerHrtf.addEventListener('change', (e) => {
            synthParams.panner.hrtf = e.target.checked;
            updateSpatialPannerNode();
        });

        bindSlider(el.pannerZ, el.pannerZVal, (v) => {
            sourcePos.z = parseFloat(v);
            setPannerPosition(sourcePos.x, sourcePos.y, sourcePos.z);
        }, 1, ' m');

        el.pannerDistModel.addEventListener('change', (e) => {
            synthParams.panner.distanceModel = e.target.value;
            updateSpatialPannerNode();
        });

        bindSlider(el.pannerRolloff, el.pannerRolloffVal, (v) => {
            synthParams.panner.rolloff = parseFloat(v);
            updateSpatialPannerNode();
        }, 1);

        el.btnOrbit.addEventListener('click', () => {
            isOrbiting = !isOrbiting;
            if (isOrbiting) {
                el.btnOrbit.classList.add('active');
                el.btnOrbit.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i> Auto Orbit: ON';
            } else {
                el.btnOrbit.classList.remove('active');
                el.btnOrbit.innerHTML = '<i class="fa-solid fa-rotate"></i> Auto Orbit: OFF';
            }
        });

        el.btnCenterSource.addEventListener('click', () => {
            setPannerPosition(2.5, 1.2, 0);
            if (isOrbiting) {
                isOrbiting = false;
                el.btnOrbit.classList.remove('active');
                el.btnOrbit.innerHTML = '<i class="fa-solid fa-rotate"></i> Auto Orbit: OFF';
            }
        });

        // Preset Grid Buttons
        el.presetGrid.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-preset');
            if (!btn) return;
            const presetKey = btn.dataset.preset;
            if (SOUND_PRESETS[presetKey]) {
                document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                loadPresetParams(SOUND_PRESETS[presetKey]);
                triggerSynthesizedSound();
            }
        });

        // User Preset Save / Export JSON
        el.btnSavePreset.addEventListener('click', () => {
            const name = prompt('Enter a name for your custom SFX preset:', 'My Custom Sound');
            if (name) {
                localStorage.setItem(`soniccraft_preset_${Date.now()}`, JSON.stringify({ name, params: synthParams }));
                alert(`Preset "${name}" saved to local studio storage!`);
            }
        });

        el.btnExportJson.addEventListener('click', () => {
            const jsonStr = JSON.stringify(synthParams, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `sfx_preset_${Date.now()}.json`;
            a.click();
        });

        // Render WAV Export Button
        el.btnExportWav.addEventListener('click', () => {
            renderAndDownloadWAV();
        });

        // Hotkeys & Help Modals
        el.btnShortcuts.addEventListener('click', () => el.modalHotkeys.classList.remove('hidden'));
        el.btnHelp.addEventListener('click', () => el.modalHelp.classList.remove('hidden'));
        el.btnCloseHotkeys.addEventListener('click', () => el.modalHotkeys.classList.add('hidden'));
        el.btnCloseHelp.addEventListener('click', () => el.modalHelp.classList.add('hidden'));

        // Global Keyboard Shortcuts
        window.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

            if (e.code === 'Space' || e.code === 'Enter') {
                e.preventDefault();
                triggerSynthesizedSound();
            } else if (e.code === 'KeyM') {
                el.btnMute.click();
            } else if (e.code === 'KeyO') {
                el.btnOrbit.click();
            } else if (e.code === 'KeyH') {
                el.pannerHrtf.click();
            } else if (e.key >= '1' && e.key <= '8') {
                const index = parseInt(e.key) - 1;
                const presetButtons = document.querySelectorAll('.btn-preset');
                if (presetButtons[index]) {
                    presetButtons[index].click();
                }
            }
        });
    }

    function bindSlider(sliderEl, displayEl, updateFn, decimals = 0, unit = '', formatFn = null) {
        if (!sliderEl || !displayEl) return;
        sliderEl.addEventListener('input', (e) => {
            const rawVal = parseFloat(e.target.value);
            updateFn(rawVal);
            const displayVal = formatFn ? formatFn(rawVal) : (decimals > 0 ? rawVal.toFixed(decimals) : Math.round(rawVal));
            displayEl.textContent = `${displayVal}${unit}`;
            renderExportPreview();
        });
    }

    // --- Load Preset Parameters ---
    function loadPresetParams(preset) {
        // Deep copy params
        if (preset.waveform) synthParams.waveform = preset.waveform;
        if (preset.noiseType) synthParams.noiseType = preset.noiseType;
        if (preset.startFreq) synthParams.startFreq = preset.startFreq;
        if (preset.endFreq) synthParams.endFreq = preset.endFreq;
        if (preset.sweepTime) synthParams.sweepTime = preset.sweepTime;
        if (preset.sweepCurve) synthParams.sweepCurve = preset.sweepCurve;
        if (preset.fmFreq !== undefined) synthParams.fmFreq = preset.fmFreq;
        if (preset.fmDepth !== undefined) synthParams.fmDepth = preset.fmDepth;

        if (preset.adsr) Object.assign(synthParams.adsr, preset.adsr);
        if (preset.filter) Object.assign(synthParams.filter, preset.filter);
        if (preset.fx) Object.assign(synthParams.fx, preset.fx);

        updateUIFromParams();
    }

    function updateUIFromParams() {
        // Waveform Buttons
        el.waveButtons.forEach(b => {
            if (b.dataset.wave === synthParams.waveform) {
                b.classList.add('active');
            } else {
                b.classList.remove('active');
            }
        });
        if (synthParams.waveform === 'noise') {
            el.noiseOptions.classList.remove('hidden');
            el.noiseType.value = synthParams.noiseType;
        } else {
            el.noiseOptions.classList.add('hidden');
        }

        // Sliders
        setSliderVal(el.startFreq, el.startFreqVal, synthParams.startFreq);
        setSliderVal(el.endFreq, el.endFreqVal, synthParams.endFreq);
        setSliderVal(el.sweepTime, el.sweepTimeVal, synthParams.sweepTime, 2);
        el.sweepCurve.value = synthParams.sweepCurve;

        setSliderVal(el.fmFreq, el.fmFreqVal, synthParams.fmFreq, 1);
        setSliderVal(el.fmDepth, el.fmDepthVal, synthParams.fmDepth);

        setSliderVal(el.adsrA, el.adsrAVal, synthParams.adsr.attack, 2, 's');
        setSliderVal(el.adsrD, el.adsrDVal, synthParams.adsr.decay, 2, 's');
        setSliderVal(el.adsrS, el.adsrSVal, synthParams.adsr.sustain, 0, '%', (v) => Math.round(v * 100));
        setSliderVal(el.adsrR, el.adsrRVal, synthParams.adsr.release, 2, 's');

        el.filterType.value = synthParams.filter.type;
        setSliderVal(el.filterCutoff, el.filterCutoffVal, synthParams.filter.cutoff);
        setSliderVal(el.filterRes, el.filterResVal, synthParams.filter.q, 1);
        setSliderVal(el.fxDistortion, el.fxDistortionVal, synthParams.fx.distortion);
        setSliderVal(el.fxReverb, el.fxReverbVal, synthParams.fx.reverb, 0, '%', (v) => Math.round(v * 100));
        setSliderVal(el.fxDelay, el.fxDelayVal, synthParams.fx.delay, 0, '%', (v) => Math.round(v * 100));

        renderExportPreview();
    }

    function setSliderVal(sliderEl, displayEl, val, decimals = 0, unit = '', formatFn = null) {
        if (!sliderEl || !displayEl) return;
        sliderEl.value = val;
        const displayVal = formatFn ? formatFn(val) : (decimals > 0 ? val.toFixed(decimals) : Math.round(val));
        displayEl.textContent = `${displayVal}${unit}`;
    }

})();
