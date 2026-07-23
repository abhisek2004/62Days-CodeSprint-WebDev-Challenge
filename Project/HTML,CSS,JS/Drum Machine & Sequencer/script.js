let audioCtx, masterGain, noiseBuffer;

let isPlaying = false;
let currentStep = 0;
let nextNoteTime = 0.0;
let tempo = 120;
let swingAmount = 0; 
const lookahead = 25.0; 
const scheduleAheadTime = 0.1; 
let timerID;
let drawQueue = [];

// Preset Patterns
const presets = {
    house: [
        [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], // Kick
        [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], // Snare
        [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], // Clap
        [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0], // CH
        [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0], // OH
        [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], // Tom
        [0,0,0,0, 0,1,0,0, 0,0,0,0, 0,1,1,0]  // Cowbell
    ],
    techno: [
        [1,0,0,0, 1,0,0,0, 1,0,0,0, 1,0,0,0], 
        [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], 
        [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], 
        [0,0,1,0, 0,0,1,0, 0,0,1,0, 0,0,1,0], 
        [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], 
        [0,0,0,1, 0,0,0,0, 0,1,0,0, 0,0,0,0], 
        [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]  
    ],
    hiphop: [
        [1,0,0,0, 0,0,1,0, 0,0,0,0, 1,0,0,0], 
        [0,0,0,0, 1,0,0,0, 0,0,0,0, 1,0,0,0], 
        [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], 
        [1,1,1,1, 1,1,1,1, 1,1,1,1, 1,1,1,1], 
        [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], 
        [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], 
        [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0]  
    ]
};

let grid = presets.house.map(arr => [...arr]); // Deep copy active state

/* --- Web Audio Setup & Synthesis --- */
function initAudio() {
    if (audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.connect(audioCtx.destination);
    masterGain.gain.value = parseInt(document.getElementById('vol').value) / 100;
    
    // Generate white noise buffer
    const bufferSize = audioCtx.sampleRate * 2;
    noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
    }
}

function playKick(time) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(masterGain);
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(0.001, time + 0.5);
    gain.gain.setValueAtTime(1, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.5);
    osc.start(time); osc.stop(time + 0.5);
}

function playSnare(time) {
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'highpass'; noiseFilter.frequency.value = 1000;
    const noiseGain = audioCtx.createGain();
    noise.connect(noiseFilter); noiseFilter.connect(noiseGain); noiseGain.connect(masterGain);
    noiseGain.gain.setValueAtTime(1, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, time + 0.2);
    noise.start(time);
    
    const osc = audioCtx.createOscillator();
    osc.type = 'triangle';
    const oscGain = audioCtx.createGain();
    osc.connect(oscGain); oscGain.connect(masterGain);
    osc.frequency.setValueAtTime(150, time);
    oscGain.gain.setValueAtTime(0.7, time);
    oscGain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);
    osc.start(time); osc.stop(time + 0.2);
}

function playClap(time) {
    const burst = (t, dur, vol) => {
        const noise = audioCtx.createBufferSource();
        noise.buffer = noiseBuffer;
        const bp = audioCtx.createBiquadFilter();
        bp.type = 'bandpass'; bp.frequency.value = 1500;
        const hp = audioCtx.createBiquadFilter();
        hp.type = 'highpass'; hp.frequency.value = 1000;
        const gain = audioCtx.createGain();
        noise.connect(bp); bp.connect(hp); hp.connect(gain); gain.connect(masterGain);
        gain.gain.setValueAtTime(vol, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
        noise.start(t); noise.stop(t + dur);
    };
    burst(time, 0.03, 0.5);
    burst(time + 0.015, 0.03, 0.6);
    burst(time + 0.03, 0.2, 0.8);
}

function playHiHat(time) { createHat(time, 0.05); }
function playOpenHat(time) { createHat(time, 0.3); }
function createHat(time, decay) {
    const noise = audioCtx.createBufferSource();
    noise.buffer = noiseBuffer;
    const bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 10000;
    const hp = audioCtx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 7000;
    const gain = audioCtx.createGain();
    noise.connect(bp); bp.connect(hp); hp.connect(gain); gain.connect(masterGain);
    gain.gain.setValueAtTime(0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + decay);
    noise.start(time); noise.stop(time + decay);
}

function playTom(time) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(masterGain);
    osc.frequency.setValueAtTime(200, time);
    osc.frequency.exponentialRampToValueAtTime(50, time + 0.2);
    gain.gain.setValueAtTime(0.8, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.3);
    osc.start(time); osc.stop(time + 0.3);
}

function playCowbell(time) {
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    osc1.type = 'square'; osc2.type = 'square';
    osc1.frequency.setValueAtTime(540, time);
    osc2.frequency.setValueAtTime(800, time);
    const bp = audioCtx.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = 800;
    const gain = audioCtx.createGain();
    osc1.connect(bp); osc2.connect(bp); bp.connect(gain); gain.connect(masterGain);
    gain.gain.setValueAtTime(0.6, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.2);
    osc1.start(time); osc2.start(time);
    osc1.stop(time + 0.2); osc2.stop(time + 0.2);
}

const trackConfig = [
    { name: 'KICK', color: 'var(--c-kick)', play: playKick },
    { name: 'SNARE', color: 'var(--c-snare)', play: playSnare },
    { name: 'CLAP', color: 'var(--c-clap)', play: playClap },
    { name: 'HI-HAT', color: 'var(--c-ch)', play: playHiHat },
    { name: 'OPEN HAT', color: 'var(--c-oh)', play: playOpenHat },
    { name: 'TOM', color: 'var(--c-tom)', play: playTom },
    { name: 'COWBELL', color: 'var(--c-bell)', play: playCowbell }
];

/* --- Timing Engine & Swing --- */
function nextNote() {
    const secondsPerBeat = 60.0 / tempo;
    const noteDuration = 0.25 * secondsPerBeat;
    
    // Swing Logic: delays the offbeats (odd steps)
    if (currentStep % 2 === 0) {
        nextNoteTime += noteDuration * (1 + swingAmount); // Push next odd step late
    } else {
        nextNoteTime += noteDuration * (1 - swingAmount); // Re-align the even step
    }
    
    currentStep++;
    if (currentStep === 16) currentStep = 0;
}

function scheduleNote(stepNumber, time) {
    drawQueue.push({ note: stepNumber, time: time });
    
    for (let i = 0; i < trackConfig.length; i++) {
        if (grid[i][stepNumber]) {
            trackConfig[i].play(time);
        }
    }
}

function scheduler() {
    while (nextNoteTime < audioCtx.currentTime + scheduleAheadTime) {
        scheduleNote(currentStep, nextNoteTime);
        nextNote();
    }
    timerID = setTimeout(scheduler, lookahead);
}

/* --- UI Sync & Controls --- */
function draw() {
    let currentTime = audioCtx.currentTime;
    while (drawQueue.length && drawQueue[0].time <= currentTime) {
        let activeStep = drawQueue[0].note;
        document.querySelectorAll('.seq-led').forEach((led, i) => {
            led.classList.toggle('active', i === activeStep);
        });
        drawQueue.splice(0, 1);
    }
    if (isPlaying) requestAnimationFrame(draw);
}

function renderGridUI() {
    document.querySelectorAll('.track').forEach((trackRow, trackIdx) => {
        const btns = trackRow.querySelectorAll('.step-btn');
        btns.forEach((btn, stepIdx) => {
            btn.classList.toggle('selected', !!grid[trackIdx][stepIdx]);
        });
    });
}

function buildUI() {
    const sequencerEl = document.getElementById('sequencer');
    
    const indRow = document.createElement('div');
    indRow.className = 'indicator-row';
    const emptyLabel = document.createElement('div');
    emptyLabel.className = 'track-label';
    indRow.appendChild(emptyLabel);
    
    const indSteps = document.createElement('div');
    indSteps.className = 'steps';
    for(let i = 0; i < 16; i++) {
        const wrap = document.createElement('div');
        wrap.className = 'indicator-wrap';
        const led = document.createElement('div');
        led.className = 'seq-led';
        wrap.appendChild(led);
        indSteps.appendChild(wrap);
    }
    indRow.appendChild(indSteps);
    sequencerEl.appendChild(indRow);
    
    trackConfig.forEach((cfg, trackIdx) => {
        const trackRow = document.createElement('div');
        trackRow.className = 'track';
        
        const label = document.createElement('div');
        label.className = 'track-label';
        label.innerHTML = `<span class="label-dot" style="color: ${cfg.color}; background: currentColor; box-shadow: 0 0 10px currentColor;"></span> ${cfg.name}`;
        trackRow.appendChild(label);
        
        const stepsDiv = document.createElement('div');
        stepsDiv.className = 'steps';
        
        grid[trackIdx].forEach((isActive, stepIdx) => {
            const btn = document.createElement('div');
            btn.className = 'step-btn';
            if(isActive) btn.classList.add('selected');
            
            const led = document.createElement('div');
            led.className = 'step-led';
            led.style.setProperty('--c', cfg.color);
            btn.appendChild(led);
            
            btn.addEventListener('click', () => {
                grid[trackIdx][stepIdx] = grid[trackIdx][stepIdx] ? 0 : 1;
                btn.classList.toggle('selected');
            });
            stepsDiv.appendChild(btn);
        });
        trackRow.appendChild(stepsDiv);
        sequencerEl.appendChild(trackRow);
    });
}

// Event Listeners
document.getElementById('tempo').addEventListener('input', (e) => {
    tempo = parseInt(e.target.value);
    document.getElementById('tempo-val').textContent = tempo;
});

document.getElementById('swing').addEventListener('input', (e) => {
    swingAmount = parseInt(e.target.value) / 100;
    document.getElementById('swing-val').textContent = e.target.value + '%';
});

document.getElementById('vol').addEventListener('input', (e) => {
    const vol = parseInt(e.target.value) / 100;
    document.getElementById('vol-val').textContent = e.target.value;
    if(masterGain) masterGain.gain.value = vol;
});

document.getElementById('preset-sel').addEventListener('change', (e) => {
    const p = presets[e.target.value];
    for (let i = 0; i < grid.length; i++) {
        for (let j = 0; j < 16; j++) grid[i][j] = p[i][j];
    }
    renderGridUI();
});

document.getElementById('clear-btn').addEventListener('click', () => {
    for (let i = 0; i < grid.length; i++) {
        for (let j = 0; j < 16; j++) grid[i][j] = 0;
    }
    renderGridUI();
});

document.getElementById('play-btn').addEventListener('click', function() {
    initAudio();
    if(audioCtx.state === 'suspended') audioCtx.resume();
    
    isPlaying = !isPlaying;
    this.classList.toggle('active', isPlaying);
    this.textContent = isPlaying ? 'STOP' : 'PLAY';
    
    if (isPlaying) {
        currentStep = 0;
        nextNoteTime = audioCtx.currentTime + 0.05;
        scheduler();
        requestAnimationFrame(draw);
    } else {
        clearTimeout(timerID);
        document.querySelectorAll('.seq-led').forEach(led => led.classList.remove('active'));
    }
});

buildUI();