(function() {
    'use strict';

    // ----- DOM refs -----
    const canvas = document.getElementById('particleCanvas');
    const ctx = canvas.getContext('2d');
    const fpsDisplay = document.getElementById('fpsDisplay');
    const particleCount = document.getElementById('particleCount');
    const wellCount = document.getElementById('wellCount');
    const energyDisplay = document.getElementById('energyDisplay');
    const particleCountSlider = document.getElementById('particleCountSlider');
    const particleCountValue = document.getElementById('particleCountValue');
    const wellStrengthSlider = document.getElementById('wellStrengthSlider');
    const wellStrengthValue = document.getElementById('wellStrengthValue');
    const speedSlider = document.getElementById('speedSlider');
    const speedValue = document.getElementById('speedValue');
    const gravitySlider = document.getElementById('gravitySlider');
    const gravityValue = document.getElementById('gravityValue');
    const addParticlesBtn = document.getElementById('addParticlesBtn');
    const clearParticlesBtn = document.getElementById('clearParticlesBtn');
    const addWellBtn = document.getElementById('addWellBtn');
    const clearWellsBtn = document.getElementById('clearWellsBtn');
    const toggleSimBtn = document.getElementById('toggleSimBtn');
    const resetBtn = document.getElementById('resetBtn');
    const shareBtn = document.getElementById('shareBtn');
    const loadUrlBtn = document.getElementById('loadUrlBtn');
    const togglePanelBtn = document.getElementById('togglePanelBtn');
    const controlsPanel = document.getElementById('controlsPanel');
    const panelBody = document.getElementById('panelBody');

    // ----- Canvas setup -----
    let W, H;

    function resizeCanvas() {
        W = window.innerWidth;
        H = window.innerHeight;
        canvas.width = W;
        canvas.height = H;
    }
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // ----- State -----
    let particles = [];
    let wells = [];
    let isPaused = false;
    let simSpeed = 1;
    let gravityStrength = 1;
    let wellStrength = 80;
    let maxParticles = 500;
    let frameCount = 0;
    let lastFpsUpdate = 0;
    let currentFps = 60;
    let totalEnergy = 0;
    let draggingWell = null;
    let mouseX = 0;
    let mouseY = 0;
    let isMouseDown = false;

    // ----- Particle class -----
    class Particle {
        constructor(x, y, opts = {}) {
            this.x = x || Math.random() * W;
            this.y = y || Math.random() * H;
            this.vx = (opts.vx || (Math.random() - 0.5) * 2);
            this.vy = (opts.vy || (Math.random() - 0.5) * 2);
            this.radius = opts.radius || (1 + Math.random() * 2.5);
            this.color = opts.color || this.randomColor();
            this.mass = opts.mass || this.radius * 0.5 + 0.5;
            this.trail = [];
            this.maxTrail = 8;
            this.life = 1;
            this.decay = opts.decay || 0;
        }

        randomColor() {
            const hue = Math.random() * 360;
            const sat = 60 + Math.random() * 40;
            const lig = 50 + Math.random() * 30;
            return `hsl(${hue}, ${sat}%, ${lig}%)`;
        }

        update(gravityWells, gStrength) {
            // Apply gravity from wells
            for (const well of gravityWells) {
                const dx = well.x - this.x;
                const dy = well.y - this.y;
                const distSq = dx * dx + dy * dy + 100;
                const force = well.strength * gStrength * 0.5 / distSq;
                const dist = Math.sqrt(distSq);
                this.vx += (dx / dist) * force * simSpeed;
                this.vy += (dy / dist) * force * simSpeed;
            }

            // Damping
            this.vx *= 0.999;
            this.vy *= 0.999;

            // Limit speed
            const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
            if (speed > 8) {
                this.vx = (this.vx / speed) * 8;
                this.vy = (this.vy / speed) * 8;
            }

            // Update position
            this.x += this.vx * simSpeed;
            this.y += this.vy * simSpeed;

            // Boundary collision
            if (this.x < 0 || this.x > W) {
                this.vx *= -0.5;
                this.x = Math.max(0, Math.min(W, this.x));
            }
            if (this.y < 0 || this.y > H) {
                this.vy *= -0.5;
                this.y = Math.max(0, Math.min(H, this.y));
            }

            // Trail
            if (this.trail.length === 0 || 
                Math.abs(this.trail[this.trail.length - 1].x - this.x) > 2 ||
                Math.abs(this.trail[this.trail.length - 1].y - this.y) > 2) {
                this.trail.push({ x: this.x, y: this.y });
                if (this.trail.length > this.maxTrail) {
                    this.trail.shift();
                }
            }

            // Life decay
            if (this.decay > 0) {
                this.life -= this.decay * simSpeed * 0.01;
            }

            return this.life > 0.01;
        }

        draw(ctx) {
            // Trail
            if (this.trail.length > 1) {
                ctx.beginPath();
                for (let i = 0; i < this.trail.length; i++) {
                    const alpha = (i / this.trail.length) * 0.3 * this.life;
                    const r = this.radius * (0.3 + 0.7 * (i / this.trail.length));
                    ctx.arc(this.trail[i].x, this.trail[i].y, r, 0, Math.PI * 2);
                }
                ctx.fillStyle = this.color;
                ctx.globalAlpha = 0.2 * this.life;
                ctx.fill();
                ctx.globalAlpha = 1;
            }

            // Glow
            const gradient = ctx.createRadialGradient(
                this.x, this.y, 0,
                this.x, this.y, this.radius * 3
            );
            gradient.addColorStop(0, this.color);
            gradient.addColorStop(0.3, this.color + '80');
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gradient;
            ctx.globalAlpha = 0.3 * this.life;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius * 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;

            // Particle
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius * this.life, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.globalAlpha = this.life;
            ctx.fill();
            ctx.globalAlpha = 1;
        }
    }

    // ----- Gravity Well class -----
    class GravityWell {
        constructor(x, y, strength) {
            this.x = x || W / 2;
            this.y = y || H / 2;
            this.strength = strength || wellStrength;
            this.radius = 15 + this.strength / 5;
            this.color = `hsl(${200 + Math.random() * 40}, 80%, 60%)`;
            this.pulse = 0;
        }

        draw(ctx) {
            this.pulse += 0.02;

            // Outer glow
            const gradient = ctx.createRadialGradient(
                this.x, this.y, 0,
                this.x, this.y, this.radius * 2.5
            );
            gradient.addColorStop(0, this.color + '40');
            gradient.addColorStop(0.5, this.color + '20');
            gradient.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.radius * 2.5, 0, Math.PI * 2);
            ctx.fill();

            // Main circle
            const pulseRadius = this.radius + Math.sin(this.pulse) * 2;
            ctx.beginPath();
            ctx.arc(this.x, this.y, pulseRadius, 0, Math.PI * 2);
            ctx.strokeStyle = this.color;
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.6;
            ctx.stroke();
            ctx.globalAlpha = 1;

            // Inner glow
            ctx.beginPath();
            ctx.arc(this.x, this.y, pulseRadius * 0.3, 0, Math.PI * 2);
            ctx.fillStyle = this.color + '60';
            ctx.fill();

            // Center dot
            ctx.beginPath();
            ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
        }

        contains(x, y) {
            const dx = x - this.x;
            const dy = y - this.y;
            return dx * dx + dy * dy < (this.radius + 10) * (this.radius + 10);
        }
    }

    // ----- Presets -----
    const presets = {
        galaxy: function() {
            const count = 300;
            const centerX = W / 2;
            const centerY = H / 2;
            const particles = [];
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const radius = 50 + Math.random() * 250;
                const spread = 20 + Math.random() * 30;
                const x = centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * spread;
                const y = centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * spread;
                const speed = 0.5 + 1.5 / (radius / 50 + 0.5);
                const p = new Particle(x, y, {
                    vx: -Math.sin(angle) * speed,
                    vy: Math.cos(angle) * speed,
                    radius: 0.8 + Math.random() * 1.5
                });
                p.color = `hsl(${40 + Math.random() * 30}, 80%, ${50 + Math.random() * 30}%)`;
                particles.push(p);
            }
            return { particles, wells: [] };
        },

        solar: function() {
            const particles = [];
            const colors = ['#fcd34d', '#f59e0b', '#ef4444', '#3b82f6', '#22c55e', '#8b5cf6'];
            for (let i = 0; i < 8; i++) {
                const angle = Math.random() * Math.PI * 2;
                const radius = 60 + i * 30 + Math.random() * 20;
                const count = 15 + Math.random() * 20;
                for (let j = 0; j < count; j++) {
                    const a = angle + (j / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
                    const r = radius + (Math.random() - 0.5) * 15;
                    const x = W / 2 + Math.cos(a) * r;
                    const y = H / 2 + Math.sin(a) * r;
                    const speed = 1.2 / (r / 50 + 0.5);
                    const p = new Particle(x, y, {
                        vx: -Math.sin(a) * speed,
                        vy: Math.cos(a) * speed,
                        radius: 1 + Math.random() * 2
                    });
                    p.color = colors[i % colors.length];
                    particles.push(p);
                }
            }
            // Add a few more random particles
            for (let i = 0; i < 50; i++) {
                const p = new Particle(
                    W / 2 + (Math.random() - 0.5) * 400,
                    H / 2 + (Math.random() - 0.5) * 400,
                    { radius: 0.5 + Math.random() * 1 }
                );
                p.color = `hsl(${Math.random() * 60 + 200}, 60%, 70%)`;
                particles.push(p);
            }
            const wells = [
                new GravityWell(W / 2, H / 2, 120)
            ];
            return { particles, wells };
        },

        explosion: function() {
            const particles = [];
            const count = 300;
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 1 + Math.random() * 6;
                const p = new Particle(W / 2, H / 2, {
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    radius: 1 + Math.random() * 2,
                    decay: 0.05 + Math.random() * 0.1
                });
                p.color = `hsl(${Math.random() * 60}, 100%, ${50 + Math.random() * 30}%)`;
                particles.push(p);
            }
            return { particles, wells: [] };
        },

        swirl: function() {
            const particles = [];
            const count = 250;
            for (let i = 0; i < count; i++) {
                const angle = i * 0.3 + Math.random() * 0.2;
                const radius = 20 + i * 0.8 + Math.random() * 10;
                const x = W / 2 + Math.cos(angle) * radius;
                const y = H / 2 + Math.sin(angle) * radius;
                const speed = 0.5 + radius / 80;
                const p = new Particle(x, y, {
                    vx: -Math.sin(angle) * speed,
                    vy: Math.cos(angle) * speed,
                    radius: 0.8 + Math.random() * 1.5
                });
                p.color = `hsl(${(i * 2) % 360}, 80%, 60%)`;
                particles.push(p);
            }
            return { particles, wells: [] };
        },

        bubble: function() {
            const particles = [];
            const count = 200;
            const centerX = W / 2;
            const centerY = H / 2;
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const radius = 30 + Math.random() * 180;
                const x = centerX + Math.cos(angle) * radius;
                const y = centerY + Math.sin(angle) * radius;
                const p = new Particle(x, y, {
                    vx: 0,
                    vy: 0,
                    radius: 0.5 + Math.random() * 2
                });
                const hue = 180 + Math.random() * 60;
                p.color = `hsl(${hue}, 70%, ${50 + Math.random() * 30}%)`;
                p.mass = 0.5;
                particles.push(p);
            }
            // Add wells at perimeter
            const wells = [];
            for (let i = 0; i < 6; i++) {
                const angle = (i / 6) * Math.PI * 2;
                const radius = 160;
                const well = new GravityWell(
                    centerX + Math.cos(angle) * radius,
                    centerY + Math.sin(angle) * radius,
                    40 + Math.random() * 30
                );
                well.color = `hsl(${200 + i * 30}, 80%, 60%)`;
                wells.push(well);
            }
            return { particles, wells };
        }
    };

    // ----- Particle management -----
    function createParticles(count, x, y, spread = 100) {
        for (let i = 0; i < count; i++) {
            if (particles.length >= maxParticles) break;
            const px = x + (Math.random() - 0.5) * spread;
            const py = y + (Math.random() - 0.5) * spread;
            const p = new Particle(px, py, {
                vx: (Math.random() - 0.5) * 2,
                vy: (Math.random() - 0.5) * 2,
                radius: 0.5 + Math.random() * 2.5
            });
            particles.push(p);
        }
        updateStats();
    }

    function clearParticles() {
        particles = [];
        updateStats();
    }

    function addWell(x, y) {
        const well = new GravityWell(x || Math.random() * W, y || Math.random() * H, wellStrength);
        wells.push(well);
        updateStats();
        return well;
    }

    function clearWells() {
        wells = [];
        updateStats();
    }

    function loadPreset(name) {
        if (presets[name]) {
            const data = presets[name]();
            particles = data.particles;
            wells = data.wells || [];
            updateStats();
            return true;
        }
        return false;
    }

    // ----- Physics update -----
    function update() {
        if (isPaused) return;

        const alive = [];
        for (const p of particles) {
            if (p.update(wells, gravityStrength)) {
                alive.push(p);
            }
        }
        particles = alive;

        // Calculate energy
        totalEnergy = 0;
        for (const p of particles) {
            totalEnergy += Math.sqrt(p.vx * p.vx + p.vy * p.vy) * p.mass;
        }

        // Well pulsation
        for (const well of wells) {
            well.pulse += 0.02 * simSpeed;
        }

        updateStats();
    }

    // ----- Render -----
    function draw() {
        ctx.clearRect(0, 0, W, H);

        // Draw wells (behind particles)
        for (const well of wells) {
            well.draw(ctx);
        }

        // Draw particles
        for (const p of particles) {
            p.draw(ctx);
        }

        // Draw FPS
        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(0, 0, 100, 20);
    }

    // ----- Stats -----
    function updateStats() {
        particleCount.textContent = particles.length;
        wellCount.textContent = wells.length;
        energyDisplay.textContent = Math.round(totalEnergy);
        particleCountValue.textContent = particles.length;
    }

    // ----- Animation loop -----
    let lastTime = 0;

    function loop(time) {
        frameCount++;

        // FPS
        if (time - lastFpsUpdate > 1000) {
            currentFps = frameCount;
            frameCount = 0;
            lastFpsUpdate = time;
            fpsDisplay.textContent = currentFps;
            fpsDisplay.className = 'hud-value';
            if (currentFps > 55) fpsDisplay.classList.add('high');
            else if (currentFps > 30) fpsDisplay.classList.add('medium');
            else fpsDisplay.classList.add('low');
        }

        // Update
        const delta = (time - lastTime) / 16;
        lastTime = time;
        const steps = Math.ceil(delta);
        for (let i = 0; i < Math.min(steps, 3); i++) {
            update();
        }

        // Draw
        draw();

        requestAnimationFrame(loop);
    }

    // ----- Event handlers -----
    // Mouse
    canvas.addEventListener('mousedown', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        isMouseDown = true;
        mouseX = x;
        mouseY = y;

        // Check if clicking on a well
        for (const well of wells) {
            if (well.contains(x, y)) {
                draggingWell = well;
                return;
            }
        }

        // Spawn particles on click
        createParticles(15, x, y, 30);
    });

    canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;

        if (draggingWell) {
            draggingWell.x = mouseX;
            draggingWell.y = mouseY;
        }
    });

    canvas.addEventListener('mouseup', () => {
        isMouseDown = false;
        draggingWell = null;
    });

    canvas.addEventListener('mouseleave', () => {
        isMouseDown = false;
        draggingWell = null;
    });

    // Touch
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        mouseX = x;
        mouseY = y;

        for (const well of wells) {
            if (well.contains(x, y)) {
                draggingWell = well;
                return;
            }
        }
        createParticles(20, x, y, 40);
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        mouseX = touch.clientX - rect.left;
        mouseY = touch.clientY - rect.top;
        if (draggingWell) {
            draggingWell.x = mouseX;
            draggingWell.y = mouseY;
        }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        draggingWell = null;
    }, { passive: false });

    // Keyboard
    document.addEventListener('keydown', (e) => {
        if (e.key === ' ') {
            e.preventDefault();
            toggleSimulation();
        }
        if (e.key === 'r' || e.key === 'R') {
            resetScene();
        }
    });

    // ----- Controls -----
    function toggleSimulation() {
        isPaused = !isPaused;
        toggleSimBtn.textContent = isPaused ? '▶️ Play' : '⏸️ Pause';
    }

    function resetScene() {
        particles = [];
        wells = [];
        updateStats();
    }

    function shareConfig() {
        const config = {
            particles: particles.map(p => ({
                x: p.x, y: p.y, vx: p.vx, vy: p.vy, radius: p.radius, color: p.color
            })),
            wells: wells.map(w => ({ x: w.x, y: w.y, strength: w.strength }))
        };
        const json = JSON.stringify(config);
        const encoded = btoa(encodeURIComponent(json));
        const url = window.location.origin + window.location.pathname + '?config=' + encoded;
        navigator.clipboard.writeText(url).then(() => {
            showNotification('✅ Config URL copied to clipboard!', 'success');
        }).catch(() => {
            showNotification('📋 URL: ' + url, 'info');
        });
    }

    function loadFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const encoded = params.get('config');
        if (encoded) {
            try {
                const json = decodeURIComponent(atob(encoded));
                const config = JSON.parse(json);
                particles = config.particles.map(p => new Particle(p.x, p.y, p));
                wells = config.wells.map(w => new GravityWell(w.x, w.y, w.strength));
                updateStats();
                showNotification('✅ Config loaded from URL!', 'success');
                return true;
            } catch (e) {
                showNotification('❌ Failed to load config', 'error');
                return false;
            }
        }
        showNotification('ℹ️ No config found in URL', 'info');
        return false;
    }

    // ----- Notifications -----
    function showNotification(message, type = 'info') {
        const existing = document.querySelector('.notification');
        if (existing) {
            existing.style.animation = 'notifOut 0.3s ease forwards';
            setTimeout(() => existing.remove(), 300);
        }
        const div = document.createElement('div');
        div.className = `notification ${type}`;
        div.textContent = message;
        document.body.appendChild(div);
        setTimeout(() => {
            div.style.animation = 'notifOut 0.3s ease forwards';
            setTimeout(() => div.remove(), 300);
        }, 3000);
    }

    // ----- Sliders -----
    particleCountSlider.addEventListener('input', () => {
        maxParticles = parseInt(particleCountSlider.value);
        particleCountValue.textContent = maxParticles;
        // Trim particles if needed
        if (particles.length > maxParticles) {
            particles = particles.slice(0, maxParticles);
            updateStats();
        }
    });

    wellStrengthSlider.addEventListener('input', () => {
        wellStrength = parseInt(wellStrengthSlider.value);
        wellStrengthValue.textContent = wellStrength;
        for (const well of wells) {
            well.strength = wellStrength;
            well.radius = 15 + wellStrength / 5;
        }
    });

    speedSlider.addEventListener('input', () => {
        simSpeed = parseInt(speedSlider.value) / 100;
        speedValue.textContent = simSpeed.toFixed(1) + 'x';
    });

    gravitySlider.addEventListener('input', () => {
        gravityStrength = parseInt(gravitySlider.value) / 100;
        gravityValue.textContent = gravityStrength.toFixed(1) + 'x';
    });

    // ----- Buttons -----
    addParticlesBtn.addEventListener('click', () => {
        createParticles(50, W / 2 + (Math.random() - 0.5) * 100, H / 2 + (Math.random() - 0.5) * 100, 150);
    });

    clearParticlesBtn.addEventListener('click', clearParticles);

    addWellBtn.addEventListener('click', () => {
        addWell(Math.random() * W, Math.random() * H);
    });

    clearWellsBtn.addEventListener('click', clearWells);

    toggleSimBtn.addEventListener('click', toggleSimulation);

    resetBtn.addEventListener('click', resetScene);

    shareBtn.addEventListener('click', shareConfig);

    loadUrlBtn.addEventListener('click', loadFromUrl);

    togglePanelBtn.addEventListener('click', () => {
        controlsPanel.classList.toggle('collapsed');
        togglePanelBtn.textContent = controlsPanel.classList.contains('collapsed') ? '+' : '−';
    });

    // Preset buttons
    document.querySelectorAll('.btn-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            const preset = btn.dataset.preset;
            if (loadPreset(preset)) {
                document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                showNotification(`✅ Loaded ${preset} preset!`, 'success');
                updateStats();
            }
        });
    });

    // ----- Auto-load from URL -----
    function init() {
        const loaded = loadFromUrl();
        if (!loaded) {
            // Load default preset
            loadPreset('galaxy');
            document.querySelector('.btn-preset[data-preset="galaxy"]')?.classList.add('active');
        }
        updateStats();
        requestAnimationFrame(loop);
    }

    // ----- Expose for debugging -----
    window.__ParticleSandbox = {
        particles,
        wells,
        presets,
        addParticles: createParticles,
        clearParticles,
        addWell,
        clearWells,
        loadPreset,
        toggleSimulation,
        resetScene,
        shareConfig,
        loadFromUrl
    };

    // Start
    init();

    console.log('⚛️ WebGL Particle Physics Sandbox initialized!');
    console.log('💡 Click to spawn particles, drag wells, use presets!');
})();