(function() {
    'use strict';

    // ----- DOM refs -----
    const waterfallRows = document.getElementById('waterfallRows');
    const timelineRuler = document.getElementById('timelineRuler');
    const totalRequests = document.getElementById('totalRequests');
    const totalTime = document.getElementById('totalTime');
    const blockedTime = document.getElementById('blockedTime');
    const multiplexStreams = document.getElementById('multiplexStreams');
    const multiplexStatus = document.getElementById('multiplexStatus');
    const cacheItems = document.getElementById('cacheItems');
    const cacheHits = document.getElementById('cacheHits');
    const cacheMisses = document.getElementById('cacheMisses');
    const cacheRatio = document.getElementById('cacheRatio');
    const tipsContainer = document.getElementById('tipsContainer');
    const tipsScore = document.getElementById('tipsScore');
    const simulateBtn = document.getElementById('simulateBtn');
    const clearBtn = document.getElementById('clearBtn');
    const presetBtn = document.getElementById('presetBtn');
    const cacheTestBtn = document.getElementById('cacheTestBtn');
    const http2Check = document.getElementById('http2Check');
    const cacheCheck = document.getElementById('cacheCheck');
    const themeToggle = document.getElementById('themeToggle');
    const themeIcon = document.getElementById('themeIcon');
    const themeLabel = document.getElementById('themeLabel');

    // ----- State -----
    let requests = [];
    let cacheStore = {};
    let cacheStats = { hits: 0, misses: 0 };
    let requestId = 0;

    // ----- Theme -----
    function setTheme(dark) {
        document.body.classList.toggle('dark', dark);
        themeIcon.textContent = dark ? '☀️' : '🌙';
        themeLabel.textContent = dark ? 'Light' : 'Dark';
    }

    themeToggle.addEventListener('click', () => {
        const isDark = document.body.classList.contains('dark');
        setTheme(!isDark);
    });

    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setTheme(true);
    }

    // ----- Generate mock requests -----
    function generateRequests(count = 15) {
        const resources = [
            { name: 'index.html', priority: 'high', size: 12 },
            { name: 'style.css', priority: 'high', size: 8 },
            { name: 'app.js', priority: 'high', size: 24 },
            { name: 'vendor.js', priority: 'medium', size: 45 },
            { name: 'api/data.json', priority: 'medium', size: 6 },
            { name: 'image/hero.webp', priority: 'medium', size: 120 },
            { name: 'image/logo.png', priority: 'low', size: 18 },
            { name: 'image/bg.jpg', priority: 'low', size: 210 },
            { name: 'font/roboto.woff2', priority: 'medium', size: 15 },
            { name: 'api/users.json', priority: 'low', size: 4 },
            { name: 'analytics.js', priority: 'low', size: 8 },
            { name: 'image/icon.svg', priority: 'low', size: 3 },
            { name: 'api/posts.json', priority: 'medium', size: 9 },
            { name: 'image/thumb.jpg', priority: 'low', size: 45 },
            { name: 'manifest.json', priority: 'high', size: 2 },
            { name: 'service-worker.js', priority: 'high', size: 6 },
            { name: 'api/comments.json', priority: 'low', size: 5 },
            { name: 'image/avatar.png', priority: 'low', size: 12 },
        ];

        // Shuffle and take count
        const shuffled = resources.sort(() => Math.random() - 0.5);
        const selected = shuffled.slice(0, Math.min(count, shuffled.length));

        // Generate timing data
        const requests = selected.map((res, index) => {
            const blocked = Math.random() * 30;
            const dns = Math.random() * 20;
            const connect = Math.random() * 40;
            const ssl = Math.random() * 30;
            const request = 5 + Math.random() * 15;
            const response = 10 + Math.random() * 60 + (res.size / 2);
            
            // Priority determines start delay
            let startDelay = 0;
            if (res.priority === 'high') startDelay = Math.random() * 20;
            else if (res.priority === 'medium') startDelay = 20 + Math.random() * 30;
            else startDelay = 40 + Math.random() * 50;

            // HTTP/2 multiplexing reduces delays
            const isHttp2 = http2Check.checked;
            if (isHttp2) {
                startDelay *= 0.4;
            }

            // Caching - check if in cache
            const isCached = cacheCheck.checked && cacheStore[res.name];
            const cacheHit = isCached && Math.random() > 0.3;

            let totalTime;
            if (cacheHit) {
                totalTime = 2 + Math.random() * 8; // Very fast from cache
                // Update cache stats
                cacheStats.hits++;
            } else {
                totalTime = blocked + dns + connect + ssl + request + response;
                if (cacheCheck.checked) {
                    cacheStore[res.name] = { size: res.size, timestamp: Date.now() };
                    cacheStats.misses++;
                }
            }

            return {
                id: ++requestId,
                name: res.name,
                priority: res.priority,
                size: res.size,
                blocked: cacheHit ? 0 : blocked,
                dns: cacheHit ? 0 : dns,
                connect: cacheHit ? 0 : connect,
                ssl: cacheHit ? 0 : ssl,
                request: cacheHit ? 1 : request,
                response: cacheHit ? 1 + Math.random() * 6 : response,
                startDelay: cacheHit ? 0 : startDelay,
                total: cacheHit ? 2 + Math.random() * 8 : totalTime,
                cached: cacheHit,
                index: index
            };
        });

        // Sort by priority
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        requests.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority] || a.startDelay - b.startDelay);

        return requests;
    }

    // ----- Render waterfall -----
    function renderWaterfall(requests) {
        if (!requests || requests.length === 0) {
            waterfallRows.innerHTML = '<div class="empty-state">Click "Simulate Requests" to generate a network waterfall</div>';
            timelineRuler.innerHTML = '';
            totalRequests.textContent = '0';
            totalTime.textContent = '0';
            blockedTime.textContent = '0';
            return;
        }

        const maxTime = Math.max(...requests.map(r => r.total + r.startDelay));
        const totalBlocked = requests.reduce((sum, r) => sum + r.blocked, 0);

        // Update stats
        totalRequests.textContent = requests.length;
        totalTime.textContent = Math.round(maxTime);
        blockedTime.textContent = Math.round(totalBlocked);

        // Render ruler
        const steps = 10;
        let rulerHTML = '';
        for (let i = 0; i <= steps; i++) {
            const time = (i / steps) * maxTime;
            rulerHTML += `<span>${Math.round(time)}ms</span>`;
        }
        timelineRuler.innerHTML = rulerHTML;

        // Render rows
        let rowsHTML = '';
        requests.forEach((req, idx) => {
            const priorityClass = `priority-${req.priority}`;
            const statusIcon = req.cached ? '⚡' : '📡';
            const cacheLabel = req.cached ? ' (cached)' : '';

            rowsHTML += `
                <div class="waterfall-row" style="animation: fadeIn 0.3s ease ${idx * 0.03}s both;">
                    <span class="request-label">${statusIcon} ${req.name}${cacheLabel}</span>
                    <div class="request-bar-container">
                        <div class="request-bar blocked" style="left: ${(req.startDelay / maxTime) * 100}%; width: ${(req.blocked / maxTime) * 100}%;"></div>
                        <div class="request-bar dns" style="left: ${((req.startDelay + req.blocked) / maxTime) * 100}%; width: ${(req.dns / maxTime) * 100}%;"></div>
                        <div class="request-bar connect" style="left: ${((req.startDelay + req.blocked + req.dns) / maxTime) * 100}%; width: ${(req.connect / maxTime) * 100}%;"></div>
                        <div class="request-bar ssl" style="left: ${((req.startDelay + req.blocked + req.dns + req.connect) / maxTime) * 100}%; width: ${(req.ssl / maxTime) * 100}%;"></div>
                        <div class="request-bar request" style="left: ${((req.startDelay + req.blocked + req.dns + req.connect + req.ssl) / maxTime) * 100}%; width: ${(req.request / maxTime) * 100}%;"></div>
                        <div class="request-bar response" style="left: ${((req.startDelay + req.blocked + req.dns + req.connect + req.ssl + req.request) / maxTime) * 100}%; width: ${(req.response / maxTime) * 100}%;"></div>
                    </div>
                    <span class="request-priority ${priorityClass}">${req.priority}</span>
                </div>
            `;
        });

        waterfallRows.innerHTML = rowsHTML;

        // Add animation keyframes if not present
        if (!document.getElementById('waterfallStyles')) {
            const style = document.createElement('style');
            style.id = 'waterfallStyles';
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateX(-10px); }
                    to { opacity: 1; transform: translateX(0); }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // ----- Render HTTP/2 multiplexing -----
    function renderMultiplex(requests) {
        if (!requests || requests.length === 0 || !http2Check.checked) {
            multiplexStreams.innerHTML = '<div class="empty-state">Run a simulation to see HTTP/2 multiplexing in action</div>';
            multiplexStatus.textContent = '⚡ Disabled';
            multiplexStatus.style.background = '#fee2e2';
            multiplexStatus.style.color = '#991b1b';
            return;
        }

        multiplexStatus.textContent = '⚡ Enabled';
        multiplexStatus.style.background = '#d1fae5';
        multiplexStatus.style.color = '#065f46';

        // Group requests by connection (simulate streams)
        const streamCount = Math.min(6, requests.length);
        const streams = [];
        for (let i = 0; i < streamCount; i++) {
            streams.push([]);
        }

        requests.forEach((req, idx) => {
            const streamIdx = idx % streamCount;
            streams[streamIdx].push(req);
        });

        let html = '';
        streams.forEach((stream, idx) => {
            const totalSize = stream.reduce((sum, r) => sum + r.size, 0);
            const progress = Math.min(100, (totalSize / 200) * 100);
            const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#22c55e', '#ef4444'];
            const color = colors[idx % colors.length];

            html += `
                <div class="multiplex-stream">
                    <span class="stream-id">Stream ${idx + 1}</span>
                    <div class="stream-bar">
                        <div class="stream-bar-fill" style="width: ${progress}%; background: ${color};"></div>
                    </div>
                    <span class="stream-label">${stream.length} requests · ${totalSize}KB</span>
                </div>
            `;
        });

        multiplexStreams.innerHTML = html;
    }

    // ----- Render cache items -----
    function renderCache() {
        const items = Object.keys(cacheStore);
        if (items.length === 0) {
            cacheItems.innerHTML = '<div class="empty-state">No cached items yet. Run a simulation or test cache.</div>';
        } else {
            let html = '';
            items.forEach(name => {
                const data = cacheStore[name];
                html += `
                    <div class="cache-item">
                        <span>📦 ${name}</span>
                        <span>${data.size}KB · ${new Date(data.timestamp).toLocaleTimeString()}</span>
                        <span class="cache-hit">✓ Cached</span>
                    </div>
                `;
            });
            cacheItems.innerHTML = html;
        }

        const total = cacheStats.hits + cacheStats.misses;
        cacheHits.textContent = cacheStats.hits;
        cacheMisses.textContent = cacheStats.misses;
        cacheRatio.textContent = total > 0 ? Math.round((cacheStats.hits / total) * 100) + '%' : '0%';
    }

    // ----- Generate tips -----
    function generateTips(requests) {
        if (!requests || requests.length === 0) {
            tipsContainer.innerHTML = '<div class="empty-state">Run a simulation to get performance insights</div>';
            tipsScore.textContent = 'Score: —';
            return;
        }

        const tips = [];
        let score = 100;

        // Check for blocking
        const totalBlocked = requests.reduce((sum, r) => sum + r.blocked, 0);
        if (totalBlocked > 100) {
            tips.push({
                icon: '⚠️',
                title: 'High blocking time',
                desc: `${Math.round(totalBlocked)}ms spent blocked. Consider reducing the number of requests or using HTTP/2.`,
                tag: 'warning'
            });
            score -= 15;
        }

        // Check for large images
        const largeImages = requests.filter(r => r.size > 100 && r.name.match(/\.(jpg|png|webp|gif)/i));
        if (largeImages.length > 0) {
            tips.push({
                icon: '🖼️',
                title: 'Large images detected',
                desc: `${largeImages.length} image(s) > 100KB. Consider using WebP format or lazy loading.`,
                tag: 'warning'
            });
            score -= 10;
        }

        // Check for caching
        const cached = requests.filter(r => r.cached);
        if (cached.length > 0) {
            tips.push({
                icon: '✅',
                title: `Good caching strategy`,
                desc: `${cached.length} request(s) were served from cache. This improves load time significantly.`,
                tag: 'good'
            });
            score += 10;
        } else if (cacheCheck.checked) {
            tips.push({
                icon: '💡',
                title: 'Enable caching',
                desc: 'Caching can dramatically reduce load times. Enable cache headers for static assets.',
                tag: 'warning'
            });
            score -= 10;
        }

        // HTTP/2 benefits
        if (http2Check.checked) {
            tips.push({
                icon: '🚀',
                title: 'HTTP/2 multiplexing active',
                desc: 'Multiple requests are being sent over a single connection, reducing latency and improving performance.',
                tag: 'good'
            });
            score += 5;
        } else {
            tips.push({
                icon: '💡',
                title: 'Enable HTTP/2',
                desc: 'HTTP/2 multiplexing can significantly reduce load times by sending multiple requests over one connection.',
                tag: 'warning'
            });
            score -= 5;
        }

        // Priority check
        const highPriority = requests.filter(r => r.priority === 'high');
        if (highPriority.length > 5) {
            tips.push({
                icon: '📊',
                title: 'Too many high-priority requests',
                desc: `${highPriority.length} high-priority requests. Only critical resources should be high priority.`,
                tag: 'warning'
            });
            score -= 5;
        }

        // Number of requests
        if (requests.length > 20) {
            tips.push({
                icon: '📦',
                title: 'High number of requests',
                desc: `${requests.length} requests can slow down loading. Consider bundling or using sprite sheets.`,
                tag: 'warning'
            });
            score -= 5;
        } else if (requests.length < 10) {
            tips.push({
                icon: '✅',
                title: 'Low request count',
                desc: `Only ${requests.length} requests. This is good for performance.`,
                tag: 'good'
            });
            score += 5;
        }

        // Clamp score
        score = Math.max(0, Math.min(100, score));

        // Render tips
        let html = '';
        tips.forEach(tip => {
            html += `
                <div class="tip-item">
                    <span class="tip-icon">${tip.icon}</span>
                    <div class="tip-content">
                        <div class="tip-title">${tip.title}</div>
                        <div class="tip-desc">${tip.desc}</div>
                        <span class="tip-tag ${tip.tag}">${tip.tag.toUpperCase()}</span>
                    </div>
                </div>
            `;
        });

        if (tips.length === 0) {
            html = '<div class="empty-state">No performance issues detected! 🎉</div>';
        }

        tipsContainer.innerHTML = html;
        tipsScore.textContent = `Score: ${score}`;
        tipsScore.style.background = score >= 80 ? '#d1fae5' : score >= 60 ? '#fef3c7' : '#fee2e2';
        tipsScore.style.color = score >= 80 ? '#065f46' : score >= 60 ? '#78350f' : '#991b1b';
    }

    // ----- Main simulate function -----
    function simulate() {
        const count = 10 + Math.floor(Math.random() * 15);
        requests = generateRequests(count);
        renderWaterfall(requests);
        renderMultiplex(requests);
        renderCache();
        generateTips(requests);
    }

    // ----- Clear everything -----
    function clearAll() {
        requests = [];
        renderWaterfall([]);
        renderMultiplex([]);
        renderCache();
        generateTips([]);
        cacheStore = {};
        cacheStats = { hits: 0, misses: 0 };
        renderCache();
    }

    // ----- Load preset -----
    function loadPreset() {
        // Load a specific set of requests
        const presetResources = [
            { name: 'index.html', priority: 'high', size: 12 },
            { name: 'style.css', priority: 'high', size: 8 },
            { name: 'app.js', priority: 'high', size: 24 },
            { name: 'vendor.js', priority: 'medium', size: 45 },
            { name: 'image/hero.webp', priority: 'medium', size: 120 },
            { name: 'image/logo.png', priority: 'low', size: 18 },
            { name: 'image/bg.jpg', priority: 'low', size: 210 },
            { name: 'api/data.json', priority: 'medium', size: 6 },
            { name: 'font/roboto.woff2', priority: 'medium', size: 15 },
            { name: 'analytics.js', priority: 'low', size: 8 },
            { name: 'manifest.json', priority: 'high', size: 2 },
            { name: 'service-worker.js', priority: 'high', size: 6 },
        ];

        requests = presetResources.map((res, index) => {
            const blocked = 5 + Math.random() * 20;
            const dns = 2 + Math.random() * 15;
            const connect = 10 + Math.random() * 25;
            const ssl = 5 + Math.random() * 20;
            const request = 5 + Math.random() * 10;
            const response = 10 + Math.random() * 50 + (res.size / 2);
            
            let startDelay = 0;
            if (res.priority === 'high') startDelay = Math.random() * 15;
            else if (res.priority === 'medium') startDelay = 15 + Math.random() * 25;
            else startDelay = 30 + Math.random() * 40;

            const isHttp2 = http2Check.checked;
            if (isHttp2) startDelay *= 0.4;

            const isCached = cacheCheck.checked && cacheStore[res.name];
            const cacheHit = isCached && Math.random() > 0.3;

            let totalTime;
            if (cacheHit) {
                totalTime = 2 + Math.random() * 8;
                cacheStats.hits++;
            } else {
                totalTime = blocked + dns + connect + ssl + request + response;
                if (cacheCheck.checked) {
                    cacheStore[res.name] = { size: res.size, timestamp: Date.now() };
                    cacheStats.misses++;
                }
            }

            return {
                id: ++requestId,
                name: res.name,
                priority: res.priority,
                size: res.size,
                blocked: cacheHit ? 0 : blocked,
                dns: cacheHit ? 0 : dns,
                connect: cacheHit ? 0 : connect,
                ssl: cacheHit ? 0 : ssl,
                request: cacheHit ? 1 : request,
                response: cacheHit ? 1 + Math.random() * 6 : response,
                startDelay: cacheHit ? 0 : startDelay,
                total: cacheHit ? 2 + Math.random() * 8 : totalTime,
                cached: cacheHit,
                index: index
            };
        });

        renderWaterfall(requests);
        renderMultiplex(requests);
        renderCache();
        generateTips(requests);
    }

    // ----- Cache test -----
    function testCache() {
        if (!cacheCheck.checked) {
            alert('Please enable caching first!');
            return;
        }

        // Simulate cache test with specific resources
        const testResources = [
            { name: 'test.js', size: 15 },
            { name: 'test.css', size: 8 },
            { name: 'test.json', size: 4 },
        ];

        testResources.forEach(res => {
            if (!cacheStore[res.name]) {
                cacheStore[res.name] = { size: res.size, timestamp: Date.now() };
                cacheStats.misses++;
            } else {
                cacheStats.hits++;
            }
        });

        renderCache();
        
        // Show feedback
        const testMsg = document.createElement('div');
        testMsg.style.cssText = `
            padding: 0.5rem 1rem;
            background: #d1fae5;
            border-radius: 8px;
            color: #065f46;
            margin-top: 0.5rem;
            font-weight: 500;
        `;
        testMsg.textContent = '✅ Cache test complete! Check the cache items above.';
        const container = document.querySelector('.cache-container');
        const existing = container.querySelector('.test-feedback');
        if (existing) existing.remove();
        testMsg.className = 'test-feedback';
        container.appendChild(testMsg);
        setTimeout(() => {
            if (testMsg.parentNode) testMsg.remove();
        }, 3000);
    }

    // ----- Event listeners -----
    simulateBtn.addEventListener('click', simulate);
    clearBtn.addEventListener('click', clearAll);
    presetBtn.addEventListener('click', loadPreset);
    cacheTestBtn.addEventListener('click', testCache);
    http2Check.addEventListener('change', () => {
        if (requests.length > 0) {
            simulate();
        }
    });
    cacheCheck.addEventListener('change', () => {
        if (requests.length > 0) {
            simulate();
        }
    });

    // ----- Initialize with demo -----
    setTimeout(() => {
        simulate();
    }, 300);

    // ----- Expose for debugging -----
    window.__NetworkWaterfall = {
        simulate,
        clearAll,
        loadPreset,
        testCache,
        requests,
        cacheStore,
        cacheStats
    };

    console.log('🌊 Network Waterfall Simulator initialized!');
    console.log('💡 Click "Simulate Requests" to generate a waterfall chart.');
})();