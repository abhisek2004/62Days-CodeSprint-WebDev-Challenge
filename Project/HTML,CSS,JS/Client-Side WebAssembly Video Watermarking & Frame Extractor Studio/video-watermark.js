/**
 * WASM VideoCraft Studio - Main JavaScript Engine
 * Client-Side Video Watermarking, Keyframe Extractor & MediaRecorder WASM Pipeline Simulation
 * 
 * Features:
 * - Synthetic Tech Demo Video Generator (Offline self-contained video source)
 * - Canvas Watermark Renderer (Text & Custom Logo Image overlay with drag-positioning)
 * - Keyframe Extractor (Interval / Count step with fast video seeking & canvas capture)
 * - Self-Contained Pure JS ZIP File Creator (Zero external zip libraries needed)
 * - MediaRecorder Video Exporter (Direct webm stream encoding & download)
 * - Real-time WASM Telemetry & Log Terminal
 */

document.addEventListener('DOMContentLoaded', () => {
    // =========================================================================
    // 1. STATE & GLOBALS
    // =========================================================================
    const state = {
        videoLoaded: false,
        videoDuration: 0,
        videoWidth: 1280,
        videoHeight: 720,
        isPlaying: false,
        isMuted: false,
        viewMode: 'live', // 'live' or 'split'
        watermarkType: 'text', // 'text' or 'image'
        
        // Text Watermark Config
        text: '© 2026 WASM STUDIO • CONFIDENTIAL',
        fontFamily: 'Inter, sans-serif',
        fontSize: 36,
        textColor: '#ffffff',
        opacity: 0.85,
        outlineColor: '#000000',
        outlineWidth: 2,
        rotation: 0,

        // Image Logo Watermark Config
        logoImg: null,
        logoScale: 25,
        logoOpacity: 0.90,
        logoRotation: 0,

        // Position Config (Percentage 0..100)
        posX: 50,
        posY: 50,

        // Extracted Keyframes Store
        keyframes: [], // Array of { id, dataUrl, timestamp, format, selected: false }
        
        // Extraction & Render Pipeline
        isProcessing: false,
        cancelProcessingRequested: false,

        // Telemetry Counters
        frameCount: 0,
        lastFpsUpdate: performance.now(),
        currentFps: 60.0,
        threads: 8
    };

    // =========================================================================
    // 2. DOM ELEMENTS SELECTION
    // =========================================================================
    const sourceVideo = document.getElementById('sourceVideo');
    const outputCanvas = document.getElementById('outputCanvas');
    const ctx = outputCanvas.getContext('2d');
    const stageWrapper = document.getElementById('canvasStageWrapper');
    const dragHandle = document.getElementById('dragHandle');

    // Controls - Sidebar Tabs
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    // Controls - Watermark Type & Panels
    const typeTextBtn = document.getElementById('typeTextBtn');
    const typeImageBtn = document.getElementById('typeImageBtn');
    const textWatermarkPanel = document.getElementById('textWatermarkPanel');
    const imageWatermarkPanel = document.getElementById('imageWatermarkPanel');

    // Controls - Text Watermark Inputs
    const wmTextInput = document.getElementById('wmTextInput');
    const wmFontFamily = document.getElementById('wmFontFamily');
    const wmFontSize = document.getElementById('wmFontSize');
    const fontSizeVal = document.getElementById('fontSizeVal');
    const wmTextColor = document.getElementById('wmTextColor');
    const textColorHex = document.getElementById('textColorHex');
    const wmOpacity = document.getElementById('wmOpacity');
    const opacityVal = document.getElementById('opacityVal');
    const wmOutlineColor = document.getElementById('wmOutlineColor');
    const outlineColorHex = document.getElementById('outlineColorHex');
    const wmOutlineWidth = document.getElementById('wmOutlineWidth');
    const outlineWidthVal = document.getElementById('outlineWidthVal');
    const wmRotation = document.getElementById('wmRotation');
    const rotationVal = document.getElementById('rotationVal');

    // Controls - Logo Watermark Inputs
    const logoUploadZone = document.getElementById('logoUploadZone');
    const logoFileInput = document.getElementById('logoFileInput');
    const logoPreviewBox = document.getElementById('logoPreviewBox');
    const logoPreviewImg = document.getElementById('logoPreviewImg');
    const btnRemoveLogo = document.getElementById('btnRemoveLogo');
    const wmLogoScale = document.getElementById('wmLogoScale');
    const logoScaleVal = document.getElementById('logoScaleVal');
    const wmLogoOpacity = document.getElementById('wmLogoOpacity');
    const logoOpacityVal = document.getElementById('logoOpacityVal');
    const wmLogoRotation = document.getElementById('wmLogoRotation');
    const logoRotationVal = document.getElementById('logoRotationVal');

    // Controls - Position & Presets
    const posPresetBtns = document.querySelectorAll('.pos-preset-btn');
    const wmOffsetX = document.getElementById('wmOffsetX');
    const offsetXVal = document.getElementById('offsetXVal');
    const wmOffsetY = document.getElementById('wmOffsetY');
    const offsetYVal = document.getElementById('offsetYVal');

    // Video Player UI
    const videoDropzone = document.getElementById('videoDropzone');
    const videoFileInput = document.getElementById('videoFileInput');
    const btnGenerateDemoVideo = document.getElementById('btnGenerateDemoVideo');
    const btnModeLive = document.getElementById('btnModeLive');
    const btnModeSplit = document.getElementById('btnModeSplit');
    const resBadge = document.getElementById('resBadge');
    
    // Player Controls
    const btnPlayPause = document.getElementById('btnPlayPause');
    const btnStop = document.getElementById('btnStop');
    const seekSlider = document.getElementById('seekSlider');
    const currentTimeText = document.getElementById('currentTimeText');
    const durationText = document.getElementById('durationText');
    const btnMute = document.getElementById('btnMute');
    const volumeSlider = document.getElementById('volumeSlider');
    const btnFullscreen = document.getElementById('btnFullscreen');

    // Extractor Inputs
    const extractMode = document.getElementById('extractMode');
    const groupInterval = document.getElementById('groupInterval');
    const groupCount = document.getElementById('groupCount');
    const extractInterval = document.getElementById('extractInterval');
    const customIntervalWrapper = document.getElementById('customIntervalWrapper');
    const customIntervalInput = document.getElementById('customIntervalInput');
    const extractCount = document.getElementById('extractCount');
    const frameCountVal = document.getElementById('frameCountVal');
    const extractFormat = document.getElementById('extractFormat');
    const btnStartBatchExtract = document.getElementById('btnStartBatchExtract');
    const btnSingleSnapshot = document.getElementById('btnSingleSnapshot');
    const statFrameCount = document.getElementById('statFrameCount');
    const statSelectedCount = document.getElementById('statSelectedCount');

    // Gallery Actions & Grid
    const galleryCountBadge = document.getElementById('galleryCountBadge');
    const thumbnailsGrid = document.getElementById('thumbnailsGrid');
    const emptyGalleryState = document.getElementById('emptyGalleryState');
    const btnSelectAllFrames = document.getElementById('btnSelectAllFrames');
    const btnDeselectAllFrames = document.getElementById('btnDeselectAllFrames');
    const btnDeleteSelectedFrames = document.getElementById('btnDeleteSelectedFrames');
    const btnDownloadSelectedZip = document.getElementById('btnDownloadSelectedZip');

    // Export Controls
    const encoderCodec = document.getElementById('encoderCodec');
    const encoderBitrate = document.getElementById('encoderBitrate');
    const simdThreads = document.getElementById('simdThreads');
    const simdThreadsVal = document.getElementById('simdThreadsVal');
    const btnExportVideo = document.getElementById('btnExportVideo');

    // Telemetry & Logs
    const telemetryFps = document.getElementById('telemetryFps');
    const telemetryMemory = document.getElementById('telemetryMemory');
    const metricFrameTime = document.getElementById('metricFrameTime');
    const metricThroughput = document.getElementById('metricThroughput');
    const metricFramesProcessed = document.getElementById('metricFramesProcessed');
    const metricActiveThreads = document.getElementById('metricActiveThreads');
    const terminalLogBody = document.getElementById('terminalLogBody');
    const btnClearLogs = document.getElementById('btnClearLogs');
    const wasmStatusText = document.getElementById('wasmStatusText');

    // Processing Overlay
    const processingOverlay = document.getElementById('processingOverlay');
    const processingTitle = document.getElementById('processingTitle');
    const processingSubtitle = document.getElementById('processingSubtitle');
    const processingProgressBar = document.getElementById('processingProgressBar');
    const processingPercentText = document.getElementById('processingPercentText');
    const btnCancelProcessing = document.getElementById('btnCancelProcessing');

    // Modals
    const imageModal = document.getElementById('imageModal');
    const btnCloseModal = document.getElementById('btnCloseModal');
    const modalPreviewImage = document.getElementById('modalPreviewImage');
    const modalTimestamp = document.getElementById('modalTimestamp');
    const modalDimensions = document.getElementById('modalDimensions');
    const modalFormat = document.getElementById('modalFormat');
    const btnModalCopy = document.getElementById('btnModalCopy');
    const btnModalDownload = document.getElementById('btnModalDownload');
    let activeModalFrame = null;

    const helpModal = document.getElementById('helpModal');
    const btnHelpModal = document.getElementById('btnHelpModal');
    const btnCloseHelpModal = document.getElementById('btnCloseHelpModal');
    const btnGotIt = document.getElementById('btnGotIt');

    // =========================================================================
    // 3. LOGGING & TELEMETRY HELPER
    // =========================================================================
    function appendLog(message, level = 'info') {
        const timeStr = new Date().toTimeString().split(' ')[0];
        const logLine = document.createElement('div');
        logLine.className = `log-line ${level}`;
        logLine.innerHTML = `<span class="log-time">[${timeStr}]</span> ${escapeHtml(message)}`;
        terminalLogBody.appendChild(logLine);
        terminalLogBody.scrollTop = terminalLogBody.scrollHeight;
    }

    function escapeHtml(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // =========================================================================
    // 4. SYNTHETIC VIDEO GENERATOR (Fallback Self-Contained Stream)
    // =========================================================================
    function createSyntheticDemoVideo() {
        appendLog('[DEMO-GEN] Generating synthetic HD video canvas stream...', 'info');
        
        // Create an offscreen canvas to render video frames
        const demoCanvas = document.createElement('canvas');
        demoCanvas.width = 1280;
        demoCanvas.height = 720;
        const dctx = demoCanvas.getContext('2d');

        const stream = demoCanvas.captureStream(30);
        let mediaRecorder;
        const chunks = [];

        try {
            mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        } catch (e) {
            mediaRecorder = new MediaRecorder(stream);
        }

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const videoUrl = URL.createObjectURL(blob);
            loadVideoSource(videoUrl, 'Synthetic Tech Demo Video (10s HD)');
            appendLog('[DEMO-GEN] Demo video generated successfully! Ready for watermarking.', 'success');
        };

        // Render synthetic video frames over 10 seconds
        let startTime = performance.now();
        const durationMs = 10000; // 10 sec video
        mediaRecorder.start();

        function drawDemoFrame() {
            const elapsed = performance.now() - startTime;
            const progress = elapsed / durationMs;
            const sec = (elapsed / 1000).toFixed(2);

            // Dark Tech Background
            const grad = dctx.createLinearGradient(0, 0, 1280, 720);
            grad.addColorStop(0, '#0b132b');
            grad.addColorStop(0.5, '#1c2541');
            grad.addColorStop(1, '#0b132b');
            dctx.fillStyle = grad;
            dctx.fillRect(0, 0, 1280, 720);

            // Animated Grid Lines
            dctx.strokeStyle = 'rgba(6, 182, 212, 0.15)';
            dctx.lineWidth = 1;
            const gridSize = 60;
            const offsetX = (elapsed * 0.05) % gridSize;
            for (let x = offsetX; x < 1280; x += gridSize) {
                dctx.beginPath(); dctx.moveTo(x, 0); dctx.lineTo(x, 720); dctx.stroke();
            }
            for (let y = 0; y < 720; y += gridSize) {
                dctx.beginPath(); dctx.moveTo(0, y); dctx.lineTo(1280, y); dctx.stroke();
            }

            // Animated Glowing Orbit Circles
            const cx = 640, cy = 360;
            const angle = progress * Math.PI * 4;
            dctx.save();
            dctx.translate(cx, cy);
            dctx.rotate(angle);
            dctx.strokeStyle = 'rgba(139, 92, 246, 0.6)';
            dctx.lineWidth = 4;
            dctx.beginPath();
            dctx.arc(0, 0, 180, 0, Math.PI * 1.5);
            dctx.stroke();

            // Pulsing target core
            dctx.fillStyle = '#06b6d4';
            dctx.beginPath();
            dctx.arc(180, 0, 16, 0, Math.PI * 2);
            dctx.fill();
            dctx.restore();

            // Title Overlay
            dctx.fillStyle = '#ffffff';
            dctx.font = 'bold 52px Outfit, sans-serif';
            dctx.textAlign = 'center';
            dctx.fillText('WASM VIDEO ENGINE DEMO', 640, 220);

            dctx.fillStyle = '#94a3b8';
            dctx.font = '24px Inter, sans-serif';
            dctx.fillText(`Timestamp: ${sec}s / 10.00s • 1280x720 30FPS`, 640, 270);

            // Animated Audio Waveform simulation at bottom
            dctx.fillStyle = '#10b981';
            const numBars = 40;
            const barWidth = 14;
            const startX = 640 - (numBars * (barWidth + 4)) / 2;
            for (let i = 0; i < numBars; i++) {
                const barHeight = Math.abs(Math.sin(elapsed * 0.008 + i * 0.3)) * 80 + 10;
                dctx.fillRect(startX + i * (barWidth + 4), 540 - barHeight / 2, barWidth, barHeight);
            }

            // Timecode box
            dctx.fillStyle = 'rgba(15, 22, 38, 0.9)';
            dctx.fillRect(40, 620, 260, 50);
            dctx.strokeStyle = '#06b6d4';
            dctx.strokeRect(40, 620, 260, 50);
            dctx.fillStyle = '#06b6d4';
            dctx.font = 'bold 24px Fira Code, monospace';
            dctx.textAlign = 'left';
            dctx.fillText(`TC 00:00:${sec.padStart(5, '0')}`, 55, 654);

            if (elapsed < durationMs) {
                requestAnimationFrame(drawDemoFrame);
            } else {
                mediaRecorder.stop();
            }
        }

        drawDemoFrame();
    }

    // =========================================================================
    // 5. VIDEO LOADING & MEDIA HANDLING
    // =========================================================================
    function loadVideoSource(url, name = 'Uploaded Video') {
        sourceVideo.src = url;
        sourceVideo.load();

        sourceVideo.onloadedmetadata = () => {
            state.videoLoaded = true;
            state.videoDuration = sourceVideo.duration;
            state.videoWidth = sourceVideo.videoWidth || 1280;
            state.videoHeight = sourceVideo.videoHeight || 720;

            // Set canvas size to match video resolution
            outputCanvas.width = state.videoWidth;
            outputCanvas.height = state.videoHeight;

            // Update UI elements
            durationText.textContent = formatTime(state.videoDuration);
            seekSlider.max = state.videoDuration;
            seekSlider.value = 0;
            resBadge.textContent = `${state.videoWidth}x${state.videoHeight} • 30 FPS`;

            appendLog(`[VIDEO-LOAD] Loaded '${name}' (${state.videoWidth}x${state.videoHeight}, Duration: ${formatTime(state.videoDuration)})`, 'success');
            
            // Auto play
            playVideo();
            updateDragHandlePosition();
        };

        sourceVideo.onerror = (e) => {
            appendLog('[VIDEO-ERROR] Failed to decode video format.', 'error');
        };
    }

    function playVideo() {
        if (!state.videoLoaded) return;
        sourceVideo.play().then(() => {
            state.isPlaying = true;
            btnPlayPause.innerHTML = '<i class="fa-solid fa-pause"></i>';
            renderLoop();
        }).catch(err => {
            appendLog(`[PLAYER] Autoplay blocked or error: ${err.message}`, 'warn');
        });
    }

    function pauseVideo() {
        sourceVideo.pause();
        state.isPlaying = false;
        btnPlayPause.innerHTML = '<i class="fa-solid fa-play"></i>';
    }

    function togglePlayPause() {
        if (state.isPlaying) {
            pauseVideo();
        } else {
            playVideo();
        }
    }

    function stopVideo() {
        pauseVideo();
        sourceVideo.currentTime = 0;
        seekSlider.value = 0;
        currentTimeText.textContent = '00:00.00';
        renderFrame();
    }

    function formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return '00:00.00';
        const mins = Math.floor(seconds / 60);
        const secs = (seconds % 60).toFixed(2);
        const mStr = String(mins).padStart(2, '0');
        const sStr = String(secs).padStart(5, '0');
        return `${mStr}:${sStr}`;
    }

    // =========================================================================
    // 6. REAL-TIME CANVAS WATERMARK RENDER ENGINE
    // =========================================================================
    function renderLoop() {
        if (!state.isPlaying) return;
        
        renderFrame();
        updateTimecode();
        calculateFps();

        requestAnimationFrame(renderLoop);
    }

    function renderFrame() {
        if (!ctx) return;

        const cw = outputCanvas.width;
        const ch = outputCanvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, cw, ch);

        if (state.viewMode === 'split' && state.videoLoaded) {
            // SPLIT COMPARE MODE: Half original, half watermarked
            const halfW = cw / 2;

            // Left half: Original unwatermarked video
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, 0, halfW, ch);
            ctx.clip();
            if (state.videoLoaded && sourceVideo.readyState >= 2) {
                ctx.drawImage(sourceVideo, 0, 0, cw, ch);
            }
            ctx.restore();

            // Right half: Watermarked video
            ctx.save();
            ctx.beginPath();
            ctx.rect(halfW, 0, halfW, ch);
            ctx.clip();
            if (state.videoLoaded && sourceVideo.readyState >= 2) {
                ctx.drawImage(sourceVideo, 0, 0, cw, ch);
            }
            drawWatermarkOverlay(ctx, cw, ch);
            ctx.restore();

            // Split line divider
            ctx.strokeStyle = '#06b6d4';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(halfW, 0); ctx.lineTo(halfW, ch);
            ctx.stroke();

            // Split labels
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(10, 10, 100, 26);
            ctx.fillRect(halfW + 10, 10, 130, 26);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 12px Inter, sans-serif';
            ctx.fillText('ORIGINAL', 20, 27);
            ctx.fillText('WATERMARKED', halfW + 20, 27);

        } else {
            // LIVE FULL WATERMARKED MODE
            if (state.videoLoaded && sourceVideo.readyState >= 2) {
                ctx.drawImage(sourceVideo, 0, 0, cw, ch);
            } else {
                // Fallback placeholder pattern if no video is loaded
                drawPlaceholderBackground(ctx, cw, ch);
            }

            drawWatermarkOverlay(ctx, cw, ch);
        }
    }

    function drawPlaceholderBackground(ctx, width, height) {
        ctx.fillStyle = '#0f1626';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 36px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('NO VIDEO LOADED', width / 2, height / 2 - 20);
        ctx.font = '18px Inter, sans-serif';
        ctx.fillText('Upload a video file or click "Generate Tech Demo Video"', width / 2, height / 2 + 20);
    }

    function drawWatermarkOverlay(ctx, width, height) {
        // Calculate target absolute X and Y based on percentages
        const absX = (state.posX / 100) * width;
        const absY = (state.posY / 100) * height;

        ctx.save();
        ctx.translate(absX, absY);

        if (state.watermarkType === 'text') {
            // Render Text Watermark
            ctx.rotate((state.rotation * Math.PI) / 180);
            ctx.globalAlpha = state.opacity;

            // Scaled font size based on canvas height vs reference 720p
            const scaleFactor = height / 720;
            const effectiveFontSize = Math.max(10, Math.round(state.fontSize * scaleFactor));
            ctx.font = `bold ${effectiveFontSize}px ${state.fontFamily}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // Text Outline Stroke
            if (state.outlineWidth > 0) {
                ctx.strokeStyle = state.outlineColor;
                ctx.lineWidth = state.outlineWidth * scaleFactor;
                ctx.strokeText(state.text, 0, 0);
            }

            // Text Fill
            ctx.fillStyle = state.textColor;
            ctx.fillText(state.text, 0, 0);

        } else if (state.watermarkType === 'image' && state.logoImg) {
            // Render Image Logo Watermark
            ctx.rotate((state.logoRotation * Math.PI) / 180);
            ctx.globalAlpha = state.logoOpacity;

            // Scale logo width relative to canvas width
            const targetW = (state.logoScale / 100) * width;
            const targetH = targetW * (state.logoImg.naturalHeight / state.logoImg.naturalWidth);

            ctx.drawImage(state.logoImg, -targetW / 2, -targetH / 2, targetW, targetH);
        }

        ctx.restore();
    }

    function updateTimecode() {
        if (!state.videoLoaded) return;
        const cur = sourceVideo.currentTime;
        currentTimeText.textContent = formatTime(cur);
        seekSlider.value = cur;
    }

    function calculateFps() {
        state.frameCount++;
        const now = performance.now();
        const delta = now - state.lastFpsUpdate;
        if (delta >= 1000) {
            state.currentFps = ((state.frameCount * 1000) / delta).toFixed(1);
            telemetryFps.textContent = state.currentFps;
            metricFrameTime.textContent = (1000 / state.currentFps).toFixed(1) + ' ms';
            metricFramesProcessed.textContent = state.frameCount;
            
            // Fluctuate memory & throughput telemetry realistically
            const simulatedMem = Math.floor(110 + Math.random() * 25);
            telemetryMemory.textContent = `${simulatedMem} MB`;
            metricThroughput.textContent = `${(state.currentFps * 0.8).toFixed(1)} MB/s`;

            state.frameCount = 0;
            state.lastFpsUpdate = now;
        }
    }

    // =========================================================================
    // 7. DRAG AND DROP WATERMARK ON CANVAS
    // =========================================================================
    let isDraggingHandle = false;

    function updateDragHandlePosition() {
        dragHandle.style.left = `${state.posX}%`;
        dragHandle.style.top = `${state.posY}%`;
    }

    dragHandle.addEventListener('mousedown', (e) => {
        isDraggingHandle = true;
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDraggingHandle) return;
        const rect = stageWrapper.getBoundingClientRect();
        let xPercent = ((e.clientX - rect.left) / rect.width) * 100;
        let yPercent = ((e.clientY - rect.top) / rect.height) * 100;

        xPercent = Math.max(0, Math.min(100, xPercent));
        yPercent = Math.max(0, Math.min(100, yPercent));

        state.posX = Math.round(xPercent);
        state.posY = Math.round(yPercent);

        wmOffsetX.value = state.posX;
        offsetXVal.textContent = state.posX;
        wmOffsetY.value = state.posY;
        offsetYVal.textContent = state.posY;

        updateDragHandlePosition();
        renderFrame();
    });

    document.addEventListener('mouseup', () => {
        if (isDraggingHandle) {
            isDraggingHandle = false;
            appendLog(`[POSITION] Watermark moved to X:${state.posX}%, Y:${state.posY}%`, 'info');
        }
    });

    // Preset Buttons
    posPresetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            posPresetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const pos = btn.dataset.pos;
            switch(pos) {
                case 'top-left': state.posX = 15; state.posY = 15; break;
                case 'top-center': state.posX = 50; state.posY = 15; break;
                case 'top-right': state.posX = 85; state.posY = 15; break;
                case 'center-left': state.posX = 15; state.posY = 50; break;
                case 'center': state.posX = 50; state.posY = 50; break;
                case 'center-right': state.posX = 85; state.posY = 50; break;
                case 'bottom-left': state.posX = 15; state.posY = 85; break;
                case 'bottom-center': state.posX = 50; state.posY = 85; break;
                case 'bottom-right': state.posX = 85; state.posY = 85; break;
            }

            wmOffsetX.value = state.posX;
            offsetXVal.textContent = state.posX;
            wmOffsetY.value = state.posY;
            offsetYVal.textContent = state.posY;

            updateDragHandlePosition();
            renderFrame();
        });
    });

    // =========================================================================
    // 8. KEYFRAME EXTRACTOR ENGINE
    // =========================================================================
    function captureSnapshotAtTime(time, format = 'image/png') {
        return new Promise((resolve) => {
            const wasPlaying = state.isPlaying;
            pauseVideo();

            sourceVideo.currentTime = time;

            const onSeeked = () => {
                sourceVideo.removeEventListener('seeked', onSeeked);
                
                // Draw frame to offscreen canvas
                const snapCanvas = document.createElement('canvas');
                snapCanvas.width = outputCanvas.width;
                snapCanvas.height = outputCanvas.height;
                const sCtx = snapCanvas.getContext('2d');

                // Draw video frame
                sCtx.drawImage(sourceVideo, 0, 0, snapCanvas.width, snapCanvas.height);
                // Draw watermark overlay
                drawWatermarkOverlay(sCtx, snapCanvas.width, snapCanvas.height);

                const dataUrl = snapCanvas.toDataURL(format, 0.92);

                const keyframeObj = {
                    id: 'kf_' + Date.now() + '_' + Math.floor(Math.random()*1000),
                    dataUrl,
                    timestamp: time,
                    timeFormatted: formatTime(time),
                    format: format.split('/')[1].toUpperCase(),
                    selected: false
                };

                state.keyframes.push(keyframeObj);
                renderThumbnailCard(keyframeObj);

                if (wasPlaying) playVideo();
                resolve(keyframeObj);
            };

            sourceVideo.addEventListener('seeked', onSeeked);
        });
    }

    async function runBatchExtraction() {
        if (!state.videoLoaded) {
            alert('Please load or generate a video first!');
            return;
        }

        const mode = extractMode.value;
        const format = extractFormat.value;
        let timestamps = [];

        const dur = state.videoDuration;

        if (mode === 'interval') {
            let step = parseFloat(extractInterval.value);
            if (extractInterval.value === 'custom') {
                step = parseFloat(customIntervalInput.value) || 3.0;
            }
            for (let t = 0; t <= dur; t += step) {
                timestamps.push(t);
            }
        } else if (mode === 'count') {
            const count = parseInt(extractCount.value, 10);
            const step = dur / Math.max(1, count - 1);
            for (let i = 0; i < count; i++) {
                timestamps.push(Math.min(dur, i * step));
            }
        } else {
            // Manual mode
            timestamps.push(sourceVideo.currentTime);
        }

        if (timestamps.length === 0) return;

        // Show Processing Overlay
        state.isProcessing = true;
        state.cancelProcessingRequested = false;
        processingOverlay.classList.remove('hidden');
        processingTitle.textContent = 'Extracting Keyframe Snapshots...';
        processingSubtitle.textContent = `Processing ${timestamps.length} keyframes via WASM Seek Pipeline`;

        appendLog(`[EXTRACT-START] Extracting ${timestamps.length} keyframes...`, 'info');

        let completed = 0;
        for (let i = 0; i < timestamps.length; i++) {
            if (state.cancelProcessingRequested) {
                appendLog('[EXTRACT-CANCEL] Extraction process cancelled by user.', 'warn');
                break;
            }

            const t = timestamps[i];
            await captureSnapshotAtTime(t, format);
            completed++;

            const pct = Math.round((completed / timestamps.length) * 100);
            processingProgressBar.style.width = `${pct}%`;
            processingPercentText.textContent = `${pct}% (${completed} / ${timestamps.length} frames)`;
        }

        // Hide Processing Overlay
        processingOverlay.classList.add('hidden');
        state.isProcessing = false;

        updateGalleryStats();
        appendLog(`[EXTRACT-COMPLETE] Batch extraction finished. Captured ${completed} keyframes.`, 'success');
    }

    function renderThumbnailCard(kf) {
        if (emptyGalleryState) {
            emptyGalleryState.classList.add('hidden');
        }

        const card = document.createElement('div');
        card.className = 'thumb-card';
        card.id = kf.id;

        card.innerHTML = `
            <div class="thumb-checkbox-overlay">
                <input type="checkbox" class="kf-checkbox" data-id="${kf.id}">
            </div>
            <div class="thumb-image-wrapper" data-id="${kf.id}">
                <img src="${kf.dataUrl}" alt="Keyframe ${kf.timeFormatted}">
                <span class="thumb-time-tag">${kf.timeFormatted}</span>
            </div>
            <div class="thumb-meta-footer">
                <span class="thumb-index">#${state.keyframes.length} (${kf.format})</span>
                <div class="thumb-btn-group">
                    <button class="thumb-action-btn btn-preview" data-id="${kf.id}" title="Preview"><i class="fa-solid fa-expand"></i></button>
                    <button class="thumb-action-btn btn-download" data-id="${kf.id}" title="Download PNG"><i class="fa-solid fa-download"></i></button>
                    <button class="thumb-action-btn btn-delete" data-id="${kf.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>
        `;

        thumbnailsGrid.appendChild(card);

        // Card Checkbox
        const checkbox = card.querySelector('.kf-checkbox');
        checkbox.addEventListener('change', (e) => {
            kf.selected = e.target.checked;
            card.classList.toggle('selected', kf.selected);
            updateGalleryStats();
        });

        // Click Image to open modal
        card.querySelector('.thumb-image-wrapper').addEventListener('click', () => {
            openImageModal(kf);
        });

        // Action Buttons
        card.querySelector('.btn-preview').addEventListener('click', () => openImageModal(kf));
        card.querySelector('.btn-download').addEventListener('click', () => downloadSingleKeyframe(kf));
        card.querySelector('.btn-delete').addEventListener('click', () => deleteKeyframe(kf.id));

        updateGalleryStats();
    }

    function deleteKeyframe(id) {
        state.keyframes = state.keyframes.filter(k => k.id !== id);
        const card = document.getElementById(id);
        if (card) card.remove();

        if (state.keyframes.length === 0 && emptyGalleryState) {
            emptyGalleryState.classList.remove('hidden');
        }

        updateGalleryStats();
        appendLog(`[GALLERY] Deleted keyframe ${id}`, 'info');
    }

    function updateGalleryStats() {
        const total = state.keyframes.length;
        const selected = state.keyframes.filter(k => k.selected).length;

        statFrameCount.textContent = total;
        statSelectedCount.textContent = selected;
        galleryCountBadge.textContent = `${total} Frames`;
    }

    function downloadSingleKeyframe(kf) {
        const a = document.createElement('a');
        a.href = kf.dataUrl;
        a.download = `keyframe_${kf.timeFormatted.replace(':', 'm')}.${kf.format.toLowerCase()}`;
        a.click();
        appendLog(`[DOWNLOAD] Saved keyframe at ${kf.timeFormatted}`, 'success');
    }

    // =========================================================================
    // 9. NATIVE PURE JS ZIP CREATOR ENGINE (No External Libraries)
    // =========================================================================
    class MiniZipWriter {
        constructor() {
            this.files = [];
        }

        addFile(filename, uint8Array) {
            this.files.push({ filename, data: uint8Array });
        }

        // Build uncompressed ZIP archive (Store method - standard PKZip)
        buildBlob() {
            const parts = [];
            const centralDirectory = [];
            let offset = 0;

            for (const file of this.files) {
                const nameBytes = new TextEncoder().encode(file.filename);
                const fileData = file.data;
                const crc = this.crc32(fileData);
                const size = fileData.length;

                // Local file header (30 bytes + filename len + data len)
                const header = new Uint8Array(30 + nameBytes.length);
                const view = new DataView(header.buffer);

                view.setUint32(0, 0x04034b50, true); // Local header signature
                view.setUint16(4, 20, true);         // Version needed
                view.setUint16(6, 0, true);          // General flag
                view.setUint16(8, 0, true);          // Compression method (0 = store)
                view.setUint16(10, 0, true);         // Mod time
                view.setUint16(12, 0, true);         // Mod date
                view.setUint32(14, crc, true);       // CRC-32
                view.setUint32(18, size, true);      // Compressed size
                view.setUint32(22, size, true);      // Uncompressed size
                view.setUint16(26, nameBytes.length, true); // Filename length
                view.setUint16(28, 0, true);         // Extra field length
                header.set(nameBytes, 30);

                parts.push(header);
                parts.push(fileData);

                // Central Directory Entry (46 bytes + filename len)
                const cdEntry = new Uint8Array(46 + nameBytes.length);
                const cdView = new DataView(cdEntry.buffer);

                cdView.setUint32(0, 0x02014b50, true); // Central header signature
                cdView.setUint16(4, 20, true);         // Made by
                cdView.setUint16(6, 20, true);         // Version needed
                cdView.setUint16(8, 0, true);          // General flag
                cdView.setUint16(10, 0, true);         // Compression method
                cdView.setUint16(12, 0, true);         // Mod time
                cdView.setUint16(14, 0, true);         // Mod date
                cdView.setUint32(16, crc, true);       // CRC-32
                cdView.setUint32(20, size, true);      // Compressed size
                cdView.setUint32(24, size, true);      // Uncompressed size
                cdView.setUint16(28, nameBytes.length, true);
                cdView.setUint16(30, 0, true);         // Extra field len
                cdView.setUint16(32, 0, true);         // Comment len
                cdView.setUint16(34, 0, true);         // Disk start
                cdView.setUint16(36, 0, true);         // Internal attr
                cdView.setUint32(38, 0, true);         // External attr
                cdView.setUint32(42, offset, true);    // Local header relative offset
                cdEntry.set(nameBytes, 46);

                centralDirectory.push(cdEntry);
                offset += header.length + fileData.length;
            }

            const cdStartOffset = offset;
            let cdSize = 0;
            for (const cd of centralDirectory) {
                parts.push(cd);
                cdSize += cd.length;
            }

            // End of Central Directory Record (22 bytes)
            const eocd = new Uint8Array(22);
            const eocdView = new DataView(eocd.buffer);

            eocdView.setUint32(0, 0x06054b50, true); // EOCD signature
            eocdView.setUint16(4, 0, true);          // Disk number
            eocdView.setUint16(6, 0, true);          // Disk with CD
            eocdView.setUint16(8, this.files.length, true);  // Entries on this disk
            eocdView.setUint16(10, this.files.length, true); // Total entries
            eocdView.setUint32(12, cdSize, true);     // CD size
            eocdView.setUint32(16, cdStartOffset, true); // CD offset
            eocdView.setUint16(20, 0, true);          // Comment length

            parts.push(eocd);

            return new Blob(parts, { type: 'application/zip' });
        }

        // Standard CRC-32 implementation
        crc32(uint8Array) {
            let crc = 0xFFFFFFFF;
            for (let i = 0; i < uint8Array.length; i++) {
                crc ^= uint8Array[i];
                for (let j = 0; j < 8; j++) {
                    crc = (crc >>> 1) ^ ((crc & 1) ? 0xEDB88320 : 0);
                }
            }
            return (crc ^ 0xFFFFFFFF) >>> 0;
        }
    }

    async function downloadKeyframesZip() {
        const targetFrames = state.keyframes.filter(k => k.selected);
        const listToExport = targetFrames.length > 0 ? targetFrames : state.keyframes;

        if (listToExport.length === 0) {
            alert('No keyframes available to download into ZIP!');
            return;
        }

        appendLog(`[ZIP-EXPORT] Generating ZIP bundle containing ${listToExport.length} keyframes...`, 'info');

        const zip = new MiniZipWriter();

        for (let i = 0; i < listToExport.length; i++) {
            const kf = listToExport[i];
            const base64Data = kf.dataUrl.split(',')[1];
            const binaryStr = atob(base64Data);
            const len = binaryStr.length;
            const bytes = new Uint8Array(len);
            for (let j = 0; j < len; j++) {
                bytes[j] = binaryStr.charCodeAt(j);
            }

            const fileName = `keyframe_${String(i+1).padStart(3, '0')}_${kf.timeFormatted.replace(':', 'm')}.${kf.format.toLowerCase()}`;
            zip.addFile(fileName, bytes);
        }

        const zipBlob = zip.buildBlob();
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `video_keyframes_bundle_${Date.now()}.zip`;
        a.click();

        appendLog('[ZIP-EXPORT] Keyframes ZIP archive created and downloaded successfully.', 'success');
    }

    // =========================================================================
    // 10. MEDIARECORDER VIDEO EXPORT ENGINE
    // =========================================================================
    function exportWatermarkedVideo() {
        if (!state.videoLoaded) {
            alert('Please load or generate a video source first!');
            return;
        }

        const targetCodec = encoderCodec.value;
        const targetBitrate = parseInt(encoderBitrate.value, 10);

        appendLog(`[EXPORT-START] Encoding watermarked stream codec: ${targetCodec}, Bitrate: ${targetBitrate/1000000} Mbps`, 'info');

        // Show Processing overlay
        state.isProcessing = true;
        state.cancelProcessingRequested = false;
        processingOverlay.classList.remove('hidden');
        processingTitle.textContent = 'Rendering & Encoding Video...';
        processingSubtitle.textContent = `WebAssembly Local MediaRecorder Stream Pipeline (${simdThreads.value} Threads)`;

        const stream = outputCanvas.captureStream(30);
        let recorder;

        try {
            recorder = new MediaRecorder(stream, { mimeType: targetCodec, videoBitsPerSecond: targetBitrate });
        } catch (err) {
            recorder = new MediaRecorder(stream, { videoBitsPerSecond: targetBitrate });
        }

        const videoChunks = [];
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) videoChunks.push(e.data);
        };

        recorder.onstop = () => {
            processingOverlay.classList.add('hidden');
            state.isProcessing = false;

            if (state.cancelProcessingRequested) {
                appendLog('[EXPORT-CANCEL] Video encoding cancelled.', 'warn');
                return;
            }

            const blob = new Blob(videoChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `watermarked_video_${Date.now()}.webm`;
            a.click();

            appendLog(`[EXPORT-SUCCESS] Watermarked video saved (${(blob.size / (1024*1024)).toFixed(2)} MB)`, 'success');
        };

        // Reset video to start and record whole duration
        sourceVideo.currentTime = 0;
        playVideo();
        recorder.start(100); // 100ms slice

        const checkEndInterval = setInterval(() => {
            if (state.cancelProcessingRequested) {
                clearInterval(checkEndInterval);
                recorder.stop();
                pauseVideo();
                return;
            }

            const progress = (sourceVideo.currentTime / sourceVideo.duration) * 100;
            processingProgressBar.style.width = `${progress}%`;
            processingPercentText.textContent = `${progress.toFixed(1)}% (${formatTime(sourceVideo.currentTime)} / ${formatTime(sourceVideo.duration)})`;

            if (sourceVideo.ended || sourceVideo.currentTime >= sourceVideo.duration - 0.1) {
                clearInterval(checkEndInterval);
                recorder.stop();
                pauseVideo();
            }
        }, 150);
    }

    // =========================================================================
    // 11. EVENT LISTENERS SETUP
    // =========================================================================

    // Sidebar Tab Switching
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            const targetId = btn.dataset.tab;
            document.getElementById(targetId).classList.add('active');
        });
    });

    // Watermark Type Toggle
    typeTextBtn.addEventListener('click', () => {
        typeTextBtn.classList.add('active');
        typeImageBtn.classList.remove('active');
        textWatermarkPanel.classList.remove('hidden');
        imageWatermarkPanel.classList.add('hidden');
        state.watermarkType = 'text';
        renderFrame();
    });

    typeImageBtn.addEventListener('click', () => {
        typeImageBtn.classList.add('active');
        typeTextBtn.classList.remove('active');
        imageWatermarkPanel.classList.remove('hidden');
        textWatermarkPanel.classList.add('hidden');
        state.watermarkType = 'image';
        renderFrame();
    });

    // Text Inputs Listeners
    wmTextInput.addEventListener('input', (e) => { state.text = e.target.value; renderFrame(); });
    wmFontFamily.addEventListener('change', (e) => { state.fontFamily = e.target.value; renderFrame(); });
    wmFontSize.addEventListener('input', (e) => { state.fontSize = parseInt(e.target.value); fontSizeVal.textContent = state.fontSize; renderFrame(); });
    wmTextColor.addEventListener('input', (e) => { state.textColor = e.target.value; textColorHex.textContent = e.target.value.toUpperCase(); renderFrame(); });
    wmOpacity.addEventListener('input', (e) => { state.opacity = parseFloat(e.target.value)/100; opacityVal.textContent = e.target.value; renderFrame(); });
    wmOutlineColor.addEventListener('input', (e) => { state.outlineColor = e.target.value; outlineColorHex.textContent = e.target.value.toUpperCase(); renderFrame(); });
    wmOutlineWidth.addEventListener('input', (e) => { state.outlineWidth = parseInt(e.target.value); outlineWidthVal.textContent = state.outlineWidth; renderFrame(); });
    wmRotation.addEventListener('input', (e) => { state.rotation = parseInt(e.target.value); rotationVal.textContent = state.rotation; renderFrame(); });

    // Logo Upload & Config
    logoUploadZone.addEventListener('click', () => logoFileInput.click());
    logoFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (evt) => {
                const img = new Image();
                img.onload = () => {
                    state.logoImg = img;
                    logoPreviewImg.src = evt.target.result;
                    logoUploadZone.classList.add('hidden');
                    logoPreviewBox.classList.remove('hidden');
                    appendLog('[LOGO-UPLOAD] Custom logo image loaded successfully.', 'success');
                    renderFrame();
                };
                img.src = evt.target.result;
            };
            reader.readAsDataURL(file);
        }
    });

    btnRemoveLogo.addEventListener('click', () => {
        state.logoImg = null;
        logoFileInput.value = '';
        logoPreviewBox.classList.add('hidden');
        logoUploadZone.classList.remove('hidden');
        renderFrame();
    });

    wmLogoScale.addEventListener('input', (e) => { state.logoScale = parseInt(e.target.value); logoScaleVal.textContent = state.logoScale; renderFrame(); });
    wmLogoOpacity.addEventListener('input', (e) => { state.logoOpacity = parseFloat(e.target.value)/100; logoOpacityVal.textContent = e.target.value; renderFrame(); });
    wmLogoRotation.addEventListener('input', (e) => { state.logoRotation = parseInt(e.target.value); logoRotationVal.textContent = state.logoRotation; renderFrame(); });

    // Position Sliders
    wmOffsetX.addEventListener('input', (e) => { state.posX = parseInt(e.target.value); offsetXVal.textContent = state.posX; updateDragHandlePosition(); renderFrame(); });
    wmOffsetY.addEventListener('input', (e) => { state.posY = parseInt(e.target.value); offsetYVal.textContent = state.posY; updateDragHandlePosition(); renderFrame(); });

    // Drag-and-drop Video Upload
    videoDropzone.addEventListener('click', () => videoFileInput.click());
    videoFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const url = URL.createObjectURL(file);
            loadVideoSource(url, file.name);
        }
    });

    videoDropzone.addEventListener('dragover', (e) => { e.preventDefault(); videoDropzone.classList.add('dragover'); });
    videoDropzone.addEventListener('dragleave', () => videoDropzone.classList.remove('dragover'));
    videoDropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        videoDropzone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('video/')) {
            const url = URL.createObjectURL(file);
            loadVideoSource(url, file.name);
        }
    });

    btnGenerateDemoVideo.addEventListener('click', () => createSyntheticDemoVideo());

    // Viewport Mode Buttons
    btnModeLive.addEventListener('click', () => {
        btnModeLive.classList.add('active');
        btnModeSplit.classList.remove('active');
        state.viewMode = 'live';
        renderFrame();
    });
    btnModeSplit.addEventListener('click', () => {
        btnModeSplit.classList.add('active');
        btnModeLive.classList.remove('active');
        state.viewMode = 'split';
        renderFrame();
    });

    // Player Controls
    btnPlayPause.addEventListener('click', togglePlayPause);
    btnStop.addEventListener('click', stopVideo);

    seekSlider.addEventListener('input', (e) => {
        if (!state.videoLoaded) return;
        sourceVideo.currentTime = parseFloat(e.target.value);
        currentTimeText.textContent = formatTime(sourceVideo.currentTime);
        renderFrame();
    });

    btnMute.addEventListener('click', () => {
        state.isMuted = !state.isMuted;
        sourceVideo.muted = state.isMuted;
        btnMute.innerHTML = state.isMuted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
    });

    volumeSlider.addEventListener('input', (e) => {
        sourceVideo.volume = parseFloat(e.target.value);
    });

    btnFullscreen.addEventListener('click', () => {
        if (stageWrapper.requestFullscreen) {
            stageWrapper.requestFullscreen();
        }
    });

    // Extractor Mode UI Controls
    extractMode.addEventListener('change', (e) => {
        const val = e.target.value;
        if (val === 'interval') {
            groupInterval.classList.remove('hidden');
            groupCount.classList.add('hidden');
        } else if (val === 'count') {
            groupCount.classList.remove('hidden');
            groupInterval.classList.add('hidden');
        } else {
            groupInterval.classList.add('hidden');
            groupCount.classList.add('hidden');
        }
    });

    extractInterval.addEventListener('change', (e) => {
        if (e.target.value === 'custom') {
            customIntervalWrapper.classList.remove('hidden');
        } else {
            customIntervalWrapper.classList.add('hidden');
        }
    });

    extractCount.addEventListener('input', (e) => {
        frameCountVal.textContent = `${e.target.value} frames`;
    });

    btnStartBatchExtract.addEventListener('click', runBatchExtraction);
    btnSingleSnapshot.addEventListener('click', async () => {
        if (!state.videoLoaded) {
            alert('Please load or generate a video first!');
            return;
        }
        await captureSnapshotAtTime(sourceVideo.currentTime, extractFormat.value);
        appendLog(`[SNAPSHOT] Manual snapshot captured at ${formatTime(sourceVideo.currentTime)}`, 'success');
    });

    // Gallery Actions
    btnSelectAllFrames.addEventListener('click', () => {
        state.keyframes.forEach(k => {
            k.selected = true;
            const card = document.getElementById(k.id);
            if (card) {
                card.classList.add('selected');
                card.querySelector('.kf-checkbox').checked = true;
            }
        });
        updateGalleryStats();
    });

    btnDeselectAllFrames.addEventListener('click', () => {
        state.keyframes.forEach(k => {
            k.selected = false;
            const card = document.getElementById(k.id);
            if (card) {
                card.classList.remove('selected');
                card.querySelector('.kf-checkbox').checked = false;
            }
        });
        updateGalleryStats();
    });

    btnDeleteSelectedFrames.addEventListener('click', () => {
        const selected = state.keyframes.filter(k => k.selected);
        if (selected.length === 0) return;
        selected.forEach(k => deleteKeyframe(k.id));
    });

    btnDownloadSelectedZip.addEventListener('click', downloadKeyframesZip);

    // Export Controls
    simdThreads.addEventListener('input', (e) => {
        state.threads = parseInt(e.target.value);
        simdThreadsVal.textContent = state.threads;
        metricActiveThreads.textContent = `${state.threads} Threads`;
        wasmStatusText.textContent = `Ready (${state.threads} Threads)`;
    });

    btnExportVideo.addEventListener('click', exportWatermarkedVideo);

    btnCancelProcessing.addEventListener('click', () => {
        state.cancelProcessingRequested = true;
    });

    // Modal Helpers
    function openImageModal(kf) {
        activeModalFrame = kf;
        modalPreviewImage.src = kf.dataUrl;
        modalTimestamp.textContent = kf.timeFormatted;
        modalDimensions.textContent = `${state.videoWidth}x${state.videoHeight}`;
        modalFormat.textContent = kf.format;
        imageModal.classList.remove('hidden');
    }

    btnCloseModal.addEventListener('click', () => imageModal.classList.add('hidden'));
    btnModalDownload.addEventListener('click', () => {
        if (activeModalFrame) downloadSingleKeyframe(activeModalFrame);
    });

    btnModalCopy.addEventListener('click', async () => {
        if (!activeModalFrame) return;
        try {
            const res = await fetch(activeModalFrame.dataUrl);
            const blob = await res.blob();
            await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
            alert('Keyframe image copied to clipboard!');
            appendLog('[CLIPBOARD] Keyframe snapshot copied to system clipboard.', 'success');
        } catch (err) {
            alert('Copying to clipboard not supported on this browser context.');
        }
    });

    // Guide Modal
    btnHelpModal.addEventListener('click', () => helpModal.classList.remove('hidden'));
    btnCloseHelpModal.addEventListener('click', () => helpModal.classList.add('hidden'));
    btnGotIt.addEventListener('click', () => helpModal.classList.add('hidden'));

    btnClearLogs.addEventListener('click', () => {
        terminalLogBody.innerHTML = '';
        appendLog('[TERMINAL] Log stream cleared.', 'info');
    });

    // =========================================================================
    // 12. INITIALIZATION
    // =========================================================================
    // Auto generate synthetic demo video on start so user immediately has a live working demo!
    createSyntheticDemoVideo();
});
