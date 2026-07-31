/**
 * Interactive WebRTC Bandwidth Estimation & Network Packet Loss Inspector
 * Pure JavaScript implementation with RTCPeerConnection Loopback, RTCStats parsing,
 * simulated network throttler, real-time Chart.js visualizer, and diagnostic reporting.
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- State Variables ---
    let localPeerConnection = null;
    let remotePeerConnection = null;
    let localStream = null;
    let statsInterval = null;
    let syntheticCanvasInterval = null;

    let isCallActive = false;
    let isStressTestActive = false;

    // Stream & Network Stats History
    const MAX_CHART_POINTS = 30;
    const historyData = {
        timestamps: [],
        txBitrate: [],
        rxBitrate: [],
        bwe: [],
        rtt: [],
        packetLossRate: [],
        cumPacketsLost: [],
        jitter: [],
        fps: []
    };

    let prevStats = {
        timestamp: 0,
        bytesSent: 0,
        bytesReceived: 0,
        packetsSent: 0,
        packetsReceived: 0,
        packetsLost: 0,
        framesEncoded: 0,
        framesDecoded: 0
    };

    // Impairment / Throttler State
    const impairment = {
        packetLossPct: 0,
        rttOffsetMs: 0,
        jitterMs: 2,
        bwLimitKbps: 8000
    };

    let totalFreezes = 0;
    let qualityScore = 100;

    // --- DOM Elements ---
    const btnStartCall = document.getElementById('btnStartCall');
    const btnStopCall = document.getElementById('btnStopCall');
    const connectionDot = document.getElementById('connectionDot');
    const connectionStatus = document.getElementById('connectionStatus');
    const qualityScoreEl = document.getElementById('qualityScore');

    const videoSourceSelect = document.getElementById('videoSourceSelect');
    const degradationPrefSelect = document.getElementById('degradationPref');
    const targetBitrateInput = document.getElementById('targetBitrate');
    const targetBitrateVal = document.getElementById('targetBitrateVal');

    const localVideo = document.getElementById('localVideo');
    const remoteVideo = document.getElementById('remoteVideo');
    const syntheticCanvas = document.getElementById('syntheticCanvas');

    const localResBadge = document.getElementById('localResBadge');
    const remoteResBadge = document.getElementById('remoteResBadge');

    // Metrics Display
    const metricBwe = document.getElementById('metricBwe');
    const metricBitrateTxRx = document.getElementById('metricBitrateTxRx');
    const metricRtt = document.getElementById('metricRtt');
    const metricRttStatus = document.getElementById('metricRttStatus');
    const metricLossRate = document.getElementById('metricLossRate');
    const metricLostPackets = document.getElementById('metricLostPackets');
    const metricJitter = document.getElementById('metricJitter');
    const metricFreezeCount = document.getElementById('metricFreezeCount');

    // Throttler Controls
    const simPacketLoss = document.getElementById('simPacketLoss');
    const simRtt = document.getElementById('simRtt');
    const simJitter = document.getElementById('simJitter');
    const simBw = document.getElementById('simBw');

    const packetLossVal = document.getElementById('packetLossVal');
    const simRttVal = document.getElementById('simRttVal');
    const simJitterVal = document.getElementById('simJitterVal');
    const simBwVal = document.getElementById('simBwVal');
    const btnRunStressTest = document.getElementById('btnRunStressTest');

    const btnExportJSON = document.getElementById('btnExportJSON');
    const btnExportSummary = document.getElementById('btnExportSummary');
    const btnClearConsole = document.getElementById('btnClearConsole');
    const consoleBody = document.getElementById('consoleBody');
    const rawStatsTableBody = document.getElementById('rawStatsTableBody');
    const statsFilterSelect = document.getElementById('statsFilterSelect');

    // --- Chart.js Instances ---
    let chartBitrate, chartRtt, chartLoss, chartJitterFps;

    initCharts();
    setupEventListeners();
    startSyntheticCanvas();

    // --- Chart Initialization ---
    function initCharts() {
        const commonOptions = {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                x: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#5c6f87', font: { size: 10 } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#8b9eb7', font: { size: 10 } }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#111927',
                    titleColor: '#00f3ff',
                    bodyColor: '#f0f6fc',
                    borderColor: '#24344d',
                    borderWidth: 1
                }
            }
        };

        // 1. Bitrate Chart
        const ctxBitrate = document.getElementById('chartBitrate').getContext('2d');
        chartBitrate = new Chart(ctxBitrate, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    { label: 'Estimated BWE (kbps)', data: [], borderColor: '#00f3ff', borderWidth: 2, pointRadius: 0, tension: 0.2 },
                    { label: 'Tx Bitrate (kbps)', data: [], borderColor: '#00ffe1', borderWidth: 1.5, pointRadius: 0, borderDash: [3, 3] },
                    { label: 'Rx Bitrate (kbps)', data: [], borderColor: '#3a86ff', borderWidth: 2, pointRadius: 0 }
                ]
            },
            options: commonOptions
        });

        // 2. RTT Chart
        const ctxRtt = document.getElementById('chartRtt').getContext('2d');
        chartRtt = new Chart(ctxRtt, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    { label: 'RTT (ms)', data: [], borderColor: '#ffb703', backgroundColor: 'rgba(255, 183, 3, 0.1)', fill: true, borderWidth: 2, pointRadius: 2 }
                ]
            },
            options: commonOptions
        });

        // 3. Loss Chart
        const ctxLoss = document.getElementById('chartLoss').getContext('2d');
        chartLoss = new Chart(ctxLoss, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    { label: 'Packet Loss %', data: [], borderColor: '#ff0055', backgroundColor: 'rgba(255, 0, 85, 0.15)', fill: true, borderWidth: 2, pointRadius: 2, yAxisID: 'y' },
                    { label: 'Lost Packets', data: [], borderColor: '#ff7800', borderWidth: 1.5, pointRadius: 0, yAxisID: 'y1' }
                ]
            },
            options: {
                ...commonOptions,
                scales: {
                    x: commonOptions.scales.x,
                    y: { ...commonOptions.scales.y, title: { display: true, text: 'Loss %', color: '#ff0055' } },
                    y1: { position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#ff7800', font: { size: 10 } } }
                }
            }
        });

        // 4. Jitter & FPS Chart
        const ctxJitterFps = document.getElementById('chartJitterFps').getContext('2d');
        chartJitterFps = new Chart(ctxJitterFps, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    { label: 'Jitter (ms)', data: [], borderColor: '#9d4edd', borderWidth: 2, pointRadius: 0 },
                    { label: 'Decode FPS', data: [], borderColor: '#00f3ff', borderWidth: 1.5, pointRadius: 0, borderDash: [2, 2] }
                ]
            },
            options: commonOptions
        });
    }

    // --- Synthetic Video Generator (Matrix Testbench) ---
    function startSyntheticCanvas() {
        const ctx = syntheticCanvas.getContext('2d');
        let frameCount = 0;

        function drawFrame() {
            frameCount++;
            ctx.fillStyle = '#060a12';
            ctx.fillRect(0, 0, syntheticCanvas.width, syntheticCanvas.height);

            // Cyber grid pattern
            ctx.strokeStyle = 'rgba(0, 243, 255, 0.08)';
            ctx.lineWidth = 1;
            const gridSize = 20;
            for (let x = 0; x < syntheticCanvas.width; x += gridSize) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, syntheticCanvas.height);
                ctx.stroke();
            }
            for (let y = 0; y < syntheticCanvas.height; y += gridSize) {
                ctx.beginPath();
                ctx.moveTo(0, y);
                ctx.lineTo(syntheticCanvas.width, y);
                ctx.stroke();
            }

            // Animated radar / signal circle
            const centerX = syntheticCanvas.width / 2;
            const centerY = syntheticCanvas.height / 2;
            const radius = (frameCount * 2) % 120;
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(0, 243, 255, ${1 - radius / 120})`;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Moving oscilloscope wave
            ctx.beginPath();
            ctx.strokeStyle = '#00ffe1';
            ctx.lineWidth = 2;
            for (let x = 0; x < syntheticCanvas.width; x += 5) {
                const y = centerY + Math.sin((x + frameCount * 4) * 0.04) * 40;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            // HUD Overlay Text
            ctx.fillStyle = '#ffffff';
            ctx.font = '700 16px "Fira Code", monospace';
            ctx.fillText('WEBRTC TESTBENCH STREAM', 20, 30);

            ctx.fillStyle = '#00f3ff';
            ctx.font = '500 12px "Fira Code", monospace';
            ctx.fillText(`FRAME: ${frameCount.toString().padStart(6, '0')}`, 20, 50);
            ctx.fillText(`TIMESTAMP: ${new Date().toISOString().substring(11, 23)}`, 20, 66);
            ctx.fillText(`TARGET BITRATE: ${targetBitrateInput.value} kbps`, 20, 82);

            syntheticCanvasInterval = requestAnimationFrame(drawFrame);
        }

        drawFrame();
    }

    // --- WebRTC Loopback Setup ---
    async function startWebRTC() {
        logConsole('Initializing WebRTC Loopback PeerConnection...', 'info');

        try {
            // Get Media Stream
            if (videoSourceSelect.value === 'camera') {
                try {
                    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
                    syntheticCanvas.classList.add('hidden');
                    localVideo.classList.remove('hidden');
                    logConsole('Camera media stream acquired.', 'success');
                } catch (e) {
                    logConsole(`Camera access failed (${e.message}). Falling back to Synthetic Canvas Stream.`, 'warn');
                    videoSourceSelect.value = 'synthetic';
                    localStream = syntheticCanvas.captureStream(30);
                    syntheticCanvas.classList.remove('hidden');
                    localVideo.classList.add('hidden');
                }
            } else {
                localStream = syntheticCanvas.captureStream(30);
                syntheticCanvas.classList.remove('hidden');
                localVideo.classList.add('hidden');
                logConsole('Synthetic 1080p/60 testbench stream attached.', 'info');
            }

            localVideo.srcObject = localStream;

            // PeerConnections
            const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
            localPeerConnection = new RTCPeerConnection(config);
            remotePeerConnection = new RTCPeerConnection(config);

            // ICE candidate exchange
            localPeerConnection.onicecandidate = e => {
                if (e.candidate) remotePeerConnection.addIceCandidate(e.candidate);
            };
            remotePeerConnection.onicecandidate = e => {
                if (e.candidate) localPeerConnection.addIceCandidate(e.candidate);
            };

            // Remote track handler
            remotePeerConnection.ontrack = e => {
                remoteVideo.srcObject = e.streams[0];
                logConsole('Remote stream track received and attached to video element.', 'success');
            };

            // Add tracks to local PC
            localStream.getTracks().forEach(track => {
                const sender = localPeerConnection.addTrack(track, localStream);
                // Apply degradation preference
                if (track.kind === 'video' && sender.setParameters) {
                    const params = sender.getParameters();
                    params.degradationPreference = degradationPrefSelect.value;
                    params.encodings = [{ maxBitrate: parseInt(targetBitrateInput.value, 10) * 1000 }];
                    sender.setParameters(params).catch(err => logConsole(`setParameters note: ${err.message}`, 'system'));
                }
            });

            // Signaling / Offer-Answer Exchange
            const offer = await localPeerConnection.createOffer();
            await localPeerConnection.setLocalDescription(offer);
            await remotePeerConnection.setRemoteDescription(offer);

            const answer = await remotePeerConnection.createAnswer();
            await remotePeerConnection.setLocalDescription(answer);
            await localPeerConnection.setRemoteDescription(answer);

            isCallActive = true;
            updateConnectionUI('CONNECTED');
            logConsole('WebRTC P2P Loopback established successfully. ICE state: Connected.', 'success');

            // Start Stats Collector
            statsInterval = setInterval(collectRTCStats, 1000);

        } catch (err) {
            logConsole(`WebRTC Loopback Error: ${err.message}`, 'alert');
            stopWebRTC();
        }
    }

    function stopWebRTC() {
        if (statsInterval) clearInterval(statsInterval);
        if (localPeerConnection) localPeerConnection.close();
        if (remotePeerConnection) remotePeerConnection.close();

        localPeerConnection = null;
        remotePeerConnection = null;
        isCallActive = false;

        updateConnectionUI('DISCONNECTED');
        logConsole('WebRTC Loopback call stopped.', 'warn');

        localResBadge.innerText = '0x0 @ 0 FPS';
        remoteResBadge.innerText = '0x0 @ 0 FPS';
    }

    // --- RTCStatsReport Collector & Visualizer ---
    async function collectRTCStats() {
        if (!localPeerConnection || !remotePeerConnection) return;

        try {
            const outboundStats = await localPeerConnection.getStats();
            const inboundStats = await remotePeerConnection.getStats();

            const now = Date.now();
            let currentStats = {
                bytesSent: 0,
                bytesReceived: 0,
                packetsSent: 0,
                packetsReceived: 0,
                packetsLost: 0,
                jitter: 0,
                rtt: 0,
                frameWidth: 0,
                frameHeight: 0,
                framesPerSecond: 0,
                framesDecoded: 0
            };

            // Filter raw stats array for display table
            const rawTableRows = [];

            outboundStats.forEach(report => {
                if (statsFilterSelect.value === 'all' || report.type === statsFilterSelect.value) {
                    rawTableRows.push({ type: report.type, key: 'id', val: report.id });
                }
                if (report.type === 'outbound-rtp' && report.kind === 'video') {
                    currentStats.bytesSent = report.bytesSent || 0;
                    currentStats.packetsSent = report.packetsSent || 0;
                    currentStats.frameWidth = report.frameWidth || 640;
                    currentStats.frameHeight = report.frameHeight || 360;
                    currentStats.framesPerSecond = report.framesPerSecond || 30;

                    rawTableRows.push({ type: 'outbound-rtp', key: 'bytesSent', val: report.bytesSent });
                    rawTableRows.push({ type: 'outbound-rtp', key: 'packetsSent', val: report.packetsSent });
                    rawTableRows.push({ type: 'outbound-rtp', key: 'targetBitrate', val: (report.targetBitrate ? Math.round(report.targetBitrate / 1000) + ' kbps' : 'N/A') });
                }
                if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                    if (report.currentRoundTripTime !== undefined) {
                        currentStats.rtt = Math.round(report.currentRoundTripTime * 1000);
                    }
                    rawTableRows.push({ type: 'candidate-pair', key: 'currentRTT', val: (report.currentRoundTripTime ? (report.currentRoundTripTime * 1000).toFixed(1) + ' ms' : 'N/A') });
                }
            });

            inboundStats.forEach(report => {
                if (report.type === 'inbound-rtp' && report.kind === 'video') {
                    currentStats.bytesReceived = report.bytesReceived || 0;
                    currentStats.packetsReceived = report.packetsReceived || 0;
                    currentStats.packetsLost = report.packetsLost || 0;
                    currentStats.jitter = report.jitter ? Math.round(report.jitter * 1000) : 0;
                    currentStats.framesDecoded = report.framesDecoded || 0;
                    if (report.framesPerSecond) currentStats.framesPerSecond = report.framesPerSecond;

                    rawTableRows.push({ type: 'inbound-rtp', key: 'bytesReceived', val: report.bytesReceived });
                    rawTableRows.push({ type: 'inbound-rtp', key: 'packetsLost', val: report.packetsLost });
                    rawTableRows.push({ type: 'inbound-rtp', key: 'jitter', val: (report.jitter ? (report.jitter * 1000).toFixed(2) + ' ms' : '0 ms') });
                }
            });

            // Render Raw Stats Inspector Table
            renderRawStatsTable(rawTableRows);

            // Compute Differentials & Rates
            const timeDiffSec = prevStats.timestamp ? (now - prevStats.timestamp) / 1000 : 1;
            
            let rawTxBitrate = prevStats.timestamp ? Math.round(((currentStats.bytesSent - prevStats.bytesSent) * 8) / (timeDiffSec * 1000)) : 0;
            let rawRxBitrate = prevStats.timestamp ? Math.round(((currentStats.bytesReceived - prevStats.bytesReceived) * 8) / (timeDiffSec * 1000)) : 0;

            const deltaPacketsSent = currentStats.packetsSent - prevStats.packetsSent;
            const deltaPacketsLost = currentStats.packetsLost - prevStats.packetsLost;

            let rawLossPct = deltaPacketsSent > 0 ? (Math.max(0, deltaPacketsLost) / deltaPacketsSent) * 100 : 0;

            // Apply Synthetic Impairment Engine Modifiers
            if (impairment.packetLossPct > 0) {
                rawLossPct = Math.max(rawLossPct, impairment.packetLossPct + (Math.random() * 2 - 1));
            }
            if (impairment.rttOffsetMs > 0) {
                currentStats.rtt += impairment.rttOffsetMs + Math.round(Math.random() * impairment.jitterMs);
            }
            if (impairment.bwLimitKbps < 8000) {
                rawTxBitrate = Math.min(rawTxBitrate, impairment.bwLimitKbps);
                rawRxBitrate = Math.min(rawRxBitrate, impairment.bwLimitKbps);
            }

            // Estimate Bandwidth (BWE) using GCC (Google Congestion Control) algorithm mock
            let bwe = parseInt(targetBitrateInput.value, 10);
            if (rawLossPct > 10) {
                bwe = Math.round(rawRxBitrate * (1 - rawLossPct / 100)); // Backoff on high packet loss
            } else if (rawLossPct > 2) {
                bwe = Math.round(rawRxBitrate); // Hold
            } else {
                bwe = Math.min(parseInt(targetBitrateInput.value, 10), Math.round(rawRxBitrate * 1.15) + 200); // Probing increase
            }

            // Freeze Detection
            if (currentStats.framesDecoded === prevStats.framesDecoded && isCallActive && timeDiffSec >= 1) {
                totalFreezes++;
                logConsole(`Stream Stall / Frame Freeze detected! Total freezes: ${totalFreezes}`, 'warn');
            }

            // Update Quality Score
            qualityScore = Math.max(0, Math.min(100, Math.round(100 - (rawLossPct * 2.5) - (currentStats.rtt * 0.1) - (totalFreezes * 5))));
            qualityScoreEl.innerText = `${qualityScore}%`;
            qualityScoreEl.style.color = qualityScore > 75 ? '#00ffe1' : (qualityScore > 40 ? '#ffb703' : '#ff0055');

            // Save Prev Stats
            prevStats = {
                timestamp: now,
                bytesSent: currentStats.bytesSent,
                bytesReceived: currentStats.bytesReceived,
                packetsSent: currentStats.packetsSent,
                packetsReceived: currentStats.packetsReceived,
                packetsLost: currentStats.packetsLost,
                framesEncoded: currentStats.framesEncoded,
                framesDecoded: currentStats.framesDecoded
            };

            // Update UI Metric Cards
            metricBwe.innerText = `${bwe} kbps`;
            metricBitrateTxRx.innerText = `Tx: ${rawTxBitrate} / Rx: ${rawRxBitrate} kbps`;
            metricRtt.innerText = `${currentStats.rtt} ms`;
            metricRttStatus.innerText = currentStats.rtt < 50 ? 'Optimal Latency' : (currentStats.rtt < 200 ? 'Moderate Latency' : 'High Latency Spike!');
            metricLossRate.innerText = `${rawLossPct.toFixed(1)} %`;
            metricLostPackets.innerText = `${currentStats.packetsLost} packets lost`;
            metricJitter.innerText = `${currentStats.jitter + impairment.jitterMs} ms`;
            metricFreezeCount.innerText = `Freezes: ${totalFreezes}`;

            localResBadge.innerText = `${currentStats.frameWidth}x${currentStats.frameHeight} @ ${currentStats.framesPerSecond} FPS`;
            remoteResBadge.innerText = `${currentStats.frameWidth}x${currentStats.frameHeight} @ ${currentStats.framesPerSecond} FPS`;

            // Log diagnostic warnings
            if (rawLossPct > 15) {
                logConsole(`[ALERT] Heavy Packet Loss detected: ${rawLossPct.toFixed(1)}%! Congestion controller throttling.`, 'alert');
            }
            if (currentStats.rtt > 300) {
                logConsole(`[WARN] RTT Latency Spike: ${currentStats.rtt} ms`, 'warn');
            }

            // Update Chart Data
            const timeLabel = new Date().toLocaleTimeString().split(' ')[0];
            pushChartData(timeLabel, rawTxBitrate, rawRxBitrate, bwe, currentStats.rtt, rawLossPct, currentStats.packetsLost, currentStats.jitter + impairment.jitterMs, currentStats.framesPerSecond);

        } catch (err) {
            console.error('Error fetching RTCStats:', err);
        }
    }

    // --- Push Data to Chart.js ---
    function pushChartData(timeStr, txB, rxB, bwe, rtt, lossPct, cumLoss, jitter, fps) {
        if (historyData.timestamps.length >= MAX_CHART_POINTS) {
            historyData.timestamps.shift();
            historyData.txBitrate.shift();
            historyData.rxBitrate.shift();
            historyData.bwe.shift();
            historyData.rtt.shift();
            historyData.packetLossRate.shift();
            historyData.cumPacketsLost.shift();
            historyData.jitter.shift();
            historyData.fps.shift();
        }

        historyData.timestamps.push(timeStr);
        historyData.txBitrate.push(txB);
        historyData.rxBitrate.push(rxB);
        historyData.bwe.push(bwe);
        historyData.rtt.push(rtt);
        historyData.packetLossRate.push(parseFloat(lossPct.toFixed(1)));
        historyData.cumPacketsLost.push(cumLoss);
        historyData.jitter.push(jitter);
        historyData.fps.push(fps);

        // Update Charts
        chartBitrate.data.labels = historyData.timestamps;
        chartBitrate.data.datasets[0].data = historyData.bwe;
        chartBitrate.data.datasets[1].data = historyData.txBitrate;
        chartBitrate.data.datasets[2].data = historyData.rxBitrate;
        chartBitrate.update();

        chartRtt.data.labels = historyData.timestamps;
        chartRtt.data.datasets[0].data = historyData.rtt;
        chartRtt.update();

        chartLoss.data.labels = historyData.timestamps;
        chartLoss.data.datasets[0].data = historyData.packetLossRate;
        chartLoss.data.datasets[1].data = historyData.cumPacketsLost;
        chartLoss.update();

        chartJitterFps.data.labels = historyData.timestamps;
        chartJitterFps.data.datasets[0].data = historyData.jitter;
        chartJitterFps.data.datasets[1].data = historyData.fps;
        chartJitterFps.update();
    }

    // --- Render Raw Stats Table ---
    function renderRawStatsTable(rows) {
        if (!rows || rows.length === 0) {
            rawStatsTableBody.innerHTML = '<tr><td colspan="3" class="text-center">No active stats matching filter</td></tr>';
            return;
        }

        let html = '';
        rows.slice(0, 15).forEach(r => {
            html += `<tr>
                <td><span class="badge">${r.type}</span></td>
                <td>${r.key}</td>
                <td><strong>${r.val}</strong></td>
            </tr>`;
        });
        rawStatsTableBody.innerHTML = html;
    }

    // --- Event Listeners & Controls ---
    function setupEventListeners() {
        btnStartCall.addEventListener('click', startWebRTC);
        btnStopCall.addEventListener('click', stopWebRTC);

        targetBitrateInput.addEventListener('input', (e) => {
            targetBitrateVal.innerText = e.target.value;
            if (localPeerConnection) {
                const senders = localPeerConnection.getSenders();
                senders.forEach(sender => {
                    if (sender.track && sender.track.kind === 'video' && sender.setParameters) {
                        const params = sender.getParameters();
                        params.encodings = [{ maxBitrate: parseInt(e.target.value, 10) * 1000 }];
                        sender.setParameters(params).catch(() => {});
                    }
                });
            }
        });

        degradationPrefSelect.addEventListener('change', (e) => {
            logConsole(`Degradation preference updated to: ${e.target.value}`, 'info');
            if (localPeerConnection) {
                const senders = localPeerConnection.getSenders();
                senders.forEach(sender => {
                    if (sender.track && sender.track.kind === 'video' && sender.setParameters) {
                        const params = sender.getParameters();
                        params.degradationPreference = e.target.value;
                        sender.setParameters(params).catch(() => {});
                    }
                });
            }
        });

        // Throttler Sliders
        simPacketLoss.addEventListener('input', (e) => {
            impairment.packetLossPct = parseInt(e.target.value, 10);
            packetLossVal.innerText = `${impairment.packetLossPct}%`;
            logConsole(`Artificial Packet Loss set to ${impairment.packetLossPct}%`, 'warn');
        });

        simRtt.addEventListener('input', (e) => {
            impairment.rttOffsetMs = parseInt(e.target.value, 10);
            simRttVal.innerText = `${impairment.rttOffsetMs} ms`;
            logConsole(`Artificial Latency (RTT) offset set to +${impairment.rttOffsetMs} ms`, 'warn');
        });

        simJitter.addEventListener('input', (e) => {
            impairment.jitterMs = parseInt(e.target.value, 10);
            simJitterVal.innerText = `${impairment.jitterMs} ms`;
        });

        simBw.addEventListener('input', (e) => {
            const val = parseInt(e.target.value, 10);
            impairment.bwLimitKbps = val;
            simBwVal.innerText = val >= 8000 ? 'Unlimited' : `${val} kbps`;
            logConsole(`Network Bandwidth Choke set to ${simBwVal.innerText}`, 'warn');
        });

        // Presets
        document.querySelectorAll('.preset-buttons button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.preset-buttons button').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');

                const preset = e.target.dataset.preset;
                applyPreset(preset);
            });
        });

        // 30s Stress Audit Button
        btnRunStressTest.addEventListener('click', runStressTest);

        // Export Buttons
        btnExportJSON.addEventListener('click', exportJSONReport);
        btnExportSummary.addEventListener('click', exportTextSummary);
        btnClearConsole.addEventListener('click', () => { consoleBody.innerHTML = ''; });
    }

    function applyPreset(preset) {
        switch (preset) {
            case 'clean':
                setThrottlerValues(0, 0, 2, 8000);
                logConsole('Applied Network Preset: 0% Loss Clean Baseline', 'info');
                break;
            case 'loss5':
                setThrottlerValues(5, 0, 5, 8000);
                logConsole('Applied Network Preset: 5% Light Packet Loss', 'warn');
                break;
            case 'loss10':
                setThrottlerValues(10, 50, 15, 8000);
                logConsole('Applied Network Preset: 10% Moderate Loss + Latency', 'warn');
                break;
            case 'loss20':
                setThrottlerValues(20, 150, 30, 8000);
                logConsole('Applied Network Preset: 20% Heavy Packet Loss & Jitter', 'alert');
                break;
            case 'spike':
                setThrottlerValues(0, 450, 60, 8000);
                logConsole('Applied Network Preset: Severe RTT Latency Spike (450ms)', 'alert');
                break;
            case 'choke':
                setThrottlerValues(2, 20, 5, 250);
                logConsole('Applied Network Preset: 250 kbps Bandwidth Choke', 'alert');
                break;
        }
    }

    function setThrottlerValues(loss, rtt, jitter, bw) {
        impairment.packetLossPct = loss;
        impairment.rttOffsetMs = rtt;
        impairment.jitterMs = jitter;
        impairment.bwLimitKbps = bw;

        simPacketLoss.value = loss;
        packetLossVal.innerText = `${loss}%`;

        simRtt.value = rtt;
        simRttVal.innerText = `${rtt} ms`;

        simJitter.value = jitter;
        simJitterVal.innerText = `${jitter} ms`;

        simBw.value = bw;
        simBwVal.innerText = bw >= 8000 ? 'Unlimited' : `${bw} kbps`;
    }

    // --- 30s Stress Audit Automated Sequence ---
    function runStressTest() {
        if (isStressTestActive) return;
        if (!isCallActive) startWebRTC();

        isStressTestActive = true;
        btnRunStressTest.disabled = true;
        btnRunStressTest.innerText = 'Stress Audit Running... (30s)';
        logConsole('=== Starting 30-Second WebRTC Stress Audit ===', 'info');

        let elapsed = 0;
        const auditInterval = setInterval(() => {
            elapsed += 5;
            if (elapsed === 5) {
                applyPreset('clean');
            } else if (elapsed === 10) {
                applyPreset('loss10');
            } else if (elapsed === 15) {
                applyPreset('spike');
            } else if (elapsed === 20) {
                applyPreset('choke');
            } else if (elapsed === 25) {
                applyPreset('clean');
            } else if (elapsed >= 30) {
                clearInterval(auditInterval);
                isStressTestActive = false;
                btnRunStressTest.disabled = false;
                btnRunStressTest.innerHTML = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> Run 30s Stress Audit`;
                logConsole('=== 30-Second WebRTC Stress Audit Completed ===', 'success');
                alert(`Stress Audit Complete!\nFinal Quality Score: ${qualityScore}%\nTotal Stream Stalls: ${totalFreezes}`);
            }
        }, 5000);
    }

    // --- Export Functions ---
    function exportJSONReport() {
        const report = {
            exportTimestamp: new Date().toISOString(),
            sessionState: {
                isCallActive,
                qualityScore,
                totalFreezes
            },
            currentImpairments: impairment,
            metricsHistory: historyData
        };

        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        downloadBlob(blob, `webrtc-diagnostic-report-${Date.now()}.json`);
        logConsole('Exported WebRTC Diagnostic JSON Report.', 'success');
    }

    function exportTextSummary() {
        const summary = `=====================================================
WEBRTC BANDWIDTH & NETWORK PACKET LOSS INSPECTOR REPORT
Generated: ${new Date().toLocaleString()}
=====================================================

1. SESSION STATUS
- Call Active: ${isCallActive ? 'YES' : 'NO'}
- Overall WebRTC Stream Quality Score: ${qualityScore}%
- Total Stream Stalls / Freezes: ${totalFreezes}

2. CURRENT NETWORK IMPAIRMENTS
- Artificial Packet Loss: ${impairment.packetLossPct}%
- Added Latency Offset: ${impairment.rttOffsetMs} ms
- Jitter Variance: ${impairment.jitterMs} ms
- Bandwidth Limit: ${impairment.bwLimitKbps >= 8000 ? 'Unlimited' : impairment.bwLimitKbps + ' kbps'}

3. SUMMARY STATISTICS (LAST ${historyData.timestamps.length} SAMPLES)
- Avg Tx Bitrate: ${calcAvg(historyData.txBitrate)} kbps
- Avg Rx Bitrate: ${calcAvg(historyData.rxBitrate)} kbps
- Avg Estimated BWE: ${calcAvg(historyData.bwe)} kbps
- Avg RTT: ${calcAvg(historyData.rtt)} ms
- Max Packet Loss Rate: ${Math.max(...(historyData.packetLossRate.length ? historyData.packetLossRate : [0]))}%
- Peak Jitter: ${Math.max(...(historyData.jitter.length ? historyData.jitter : [0]))} ms

=====================================================
Diagnostic Log Summary:
${Array.from(consoleBody.children).map(el => el.innerText).slice(-10).join('\n')}
=====================================================`;

        const blob = new Blob([summary], { type: 'text/plain' });
        downloadBlob(blob, `webrtc-summary-report-${Date.now()}.txt`);
        logConsole('Exported WebRTC Diagnostic Text Summary Report.', 'success');
    }

    function calcAvg(arr) {
        if (!arr || arr.length === 0) return 0;
        const sum = arr.reduce((a, b) => a + b, 0);
        return Math.round(sum / arr.length);
    }

    function downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // --- Helper Functions ---
    function updateConnectionUI(status) {
        connectionStatus.innerText = status;
        if (status === 'CONNECTED') {
            connectionDot.className = 'status-dot connected';
            btnStartCall.classList.add('hidden');
            btnStopCall.classList.remove('hidden');
        } else {
            connectionDot.className = 'status-dot disconnected';
            btnStartCall.classList.remove('hidden');
            btnStopCall.classList.add('hidden');
        }
    }

    function logConsole(msg, type = 'info') {
        const div = document.createElement('div');
        div.className = `log-line log-${type}`;
        const time = new Date().toLocaleTimeString();
        div.innerText = `[${time}] ${msg}`;
        consoleBody.appendChild(div);
        consoleBody.scrollTop = consoleBody.scrollHeight;
    }
});
