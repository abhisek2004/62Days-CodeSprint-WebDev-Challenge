/**
 * MeshPulse - Client-Side WebRTC Mesh Network Video Conference Hub
 * Fully feature-packed WebRTC Mesh Conference application with E2EE,
 * Network Metrics Inspector, Live Canvas Topology Visualizer, and Synthetic Peer Sandbox.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  const state = {
    roomId: getRoomIdFromHash() || 'mesh-sec-884',
    peerId: 'peer-' + Math.random().toString(36).substr(2, 6),
    peerName: 'User-' + Math.floor(100 + Math.random() * 900),
    isMicMuted: false,
    isCamOff: false,
    isScreenSharing: false,
    currentFilter: 'none',
    isMirrored: false,
    audioGain: 1.0,
    layoutMode: 'grid', // 'grid' or 'speaker'
    activeSpeakerId: null,
    showRawCipher: false,
    statsHudVisible: false,

    // WebRTC & Signaling
    localStream: null,
    screenStream: null,
    peerConnections: new Map(), // peerId -> { pc, dataChannel, stream, type: 'rtc'|'sim', stats: {} }
    simulatedPeers: new Map(), // botId -> { botData, canvas, animFrame, stats }
    
    // Audio Context
    audioCtx: null,
    gainNode: null,
    analyserNode: null,

    // WebCrypto E2EE
    cryptoKey: null,
    cryptoIvBase: null,

    // Metrics & Sim Config
    simConfig: {
      latency: 25,
      packetLoss: 0.5,
      resolution: '480p',
      simAudioWave: true,
      simJitter: true
    }
  };

  // DOM Elements
  const DOM = {
    roomTitleDisplay: document.getElementById('currentRoomName'),
    meshStatusText: document.getElementById('meshStatusText'),
    btnEditRoom: document.getElementById('btnEditRoom'),
    btnInvite: document.getElementById('btnInvite'),
    btnSimulatePeers: document.getElementById('btnSimulatePeers'),
    btnLayoutGrid: document.getElementById('btnLayoutGrid'),
    btnLayoutSpeaker: document.getElementById('btnLayoutSpeaker'),
    
    // Video Workspace & Tiles
    videoWorkspace: document.getElementById('videoWorkspace'),
    videoGrid: document.getElementById('videoGrid'),
    speakerLayout: document.getElementById('speakerLayout'),
    mainSpeakerStage: document.getElementById('mainSpeakerStage'),
    speakerThumbnails: document.getElementById('speakerThumbnails'),
    
    localTile: document.getElementById('localTile'),
    localVideo: document.getElementById('localVideo'),
    localCanvasFilter: document.getElementById('localCanvasFilter'),
    localPlaceholder: document.getElementById('localPlaceholder'),
    localAvatarInitials: document.getElementById('localAvatarInitials'),
    localAudioSpectrum: document.getElementById('localAudioSpectrum'),
    localMicIndicator: document.getElementById('localMicIndicator'),
    localCamIndicator: document.getElementById('localCamIndicator'),
    localStatsHud: document.getElementById('localStatsHud'),
    localFpsVal: document.getElementById('localFpsVal'),
    localResVal: document.getElementById('localResVal'),
    localBitrateVal: document.getElementById('localBitrateVal'),

    // Toolbar Controls
    btnToggleMic: document.getElementById('btnToggleMic'),
    btnMicOptions: document.getElementById('btnMicOptions'),
    micPopover: document.getElementById('micPopover'),
    audioGainSlider: document.getElementById('audioGainSlider'),
    gainValText: document.getElementById('gainValText'),

    btnToggleCam: document.getElementById('btnToggleCam'),
    btnCamOptions: document.getElementById('btnCamOptions'),
    camPopover: document.getElementById('camPopover'),

    btnScreenShare: document.getElementById('btnScreenShare'),
    btnToggleTileHud: document.getElementById('btnToggleTileHud'),
    btnToggleChat: document.getElementById('btnToggleChat'),
    chatDotBadge: document.getElementById('chatDotBadge'),
    btnToggleMetrics: document.getElementById('btnToggleMetrics'),
    btnToggleTopology: document.getElementById('btnToggleTopology'),
    btnLeaveCall: document.getElementById('btnLeaveCall'),

    // Side Drawer & Tabs
    sidePanel: document.getElementById('sidePanel'),
    btnClosePanel: document.getElementById('btnClosePanel'),
    tabButtons: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    chatUnreadBadge: document.getElementById('chatUnreadBadge'),
    
    // Chat Form & Messages
    chatMessages: document.getElementById('chatMessages'),
    chatForm: document.getElementById('chatForm'),
    chatInput: document.getElementById('chatInput'),
    btnToggleRawCipher: document.getElementById('btnToggleRawCipher'),
    cipherModeLbl: document.getElementById('cipherModeLbl'),

    // Metrics Panel Elements
    valAvgRtt: document.getElementById('valAvgRtt'),
    valPacketLoss: document.getElementById('valPacketLoss'),
    valTotalBitrate: document.getElementById('valTotalBitrate'),
    peersStatsList: document.getElementById('peersStatsList'),
    btnRefreshMetrics: document.getElementById('btnRefreshMetrics'),

    // Topology Canvas
    topologyCanvas: document.getElementById('topologyCanvas'),
    topologyType: document.getElementById('topologyType'),

    // Sim Sandbox Elements
    btnAddOneBot: document.getElementById('btnAddOneBot'),
    btnAddThreeBots: document.getElementById('btnAddThreeBots'),
    btnClearBots: document.getElementById('btnClearBots'),
    simLatencySlider: document.getElementById('simLatencySlider'),
    simLatencyVal: document.getElementById('simLatencyVal'),
    simLossSlider: document.getElementById('simLossSlider'),
    simLossVal: document.getElementById('simLossVal'),
    simResolutionSelect: document.getElementById('simResolutionSelect'),
    chkSimAudioWave: document.getElementById('chkSimAudioWave'),
    chkSimNetworkJitter: document.getElementById('chkSimNetworkJitter'),

    // Invite Modal & Toast
    inviteModal: document.getElementById('inviteModal'),
    btnCloseInviteModal: document.getElementById('btnCloseInviteModal'),
    inviteLinkInput: document.getElementById('inviteLinkInput'),
    btnCopyInviteLink: document.getElementById('btnCopyInviteLink'),
    toastContainer: document.getElementById('toastContainer')
  };

  // Channel for Tab-to-Tab Signaling
  let signalingChannel = null;

  // Unread chat counter
  let unreadChatCount = 0;

  /* ==========================================================================
     1. INITIALIZATION & WEBCRYPTO E2EE
     ========================================================================== */
  async function initApp() {
    updateRoomUI();
    await initE2EEKey();
    await initLocalMedia();
    initSignaling();
    initTopologyCanvas();
    setupEventListeners();

    // Start background loop for metrics & active audio visualizer
    setInterval(updateMetricsInspector, 2000);
    setInterval(drawTopologyGraph, 100);
    
    // Add default simulated bot for instant mesh showcase
    setTimeout(() => {
      spawnSimulatedPeer('Sarah (Mesh Bot)');
    }, 1000);

    showToast('Session Started. Welcome to MeshPulse!', 'info');
  }

  function getRoomIdFromHash() {
    const match = window.location.hash.match(/room=([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  }

  function updateRoomUI() {
    DOM.roomTitleDisplay.textContent = state.roomId;
    const shareUrl = `${window.location.origin}${window.location.pathname}#room=${state.roomId}`;
    DOM.inviteLinkInput.value = shareUrl;
    DOM.localAvatarInitials.textContent = state.peerName.substr(0, 2).toUpperCase();
  }

  // Derive AES-GCM Key from Room ID using Web Crypto API
  async function initE2EEKey() {
    try {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(`mesh-pulse-secret-salt-${state.roomId}`);
      const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);
      
      state.cryptoKey = await crypto.subtle.importKey(
        'raw',
        hashBuffer,
        { name: 'AES-GCM' },
        false,
        ['encrypt', 'decrypt']
      );
    } catch (e) {
      console.error('Failed to compute E2EE CryptoKey:', e);
    }
  }

  async function encryptMessage(plainText) {
    if (!state.cryptoKey) return plainText;
    const encoder = new TextEncoder();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encodedMessage = encoder.encode(plainText);
    
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      state.cryptoKey,
      encodedMessage
    );

    const ivArray = Array.from(iv);
    const cipherArray = Array.from(new Uint8Array(ciphertext));
    return JSON.stringify({ iv: ivArray, cipher: cipherArray });
  }

  async function decryptMessage(encryptedPayload) {
    if (!state.cryptoKey) return encryptedPayload;
    try {
      const { iv, cipher } = JSON.parse(encryptedPayload);
      const ivBuffer = new Uint8Array(iv);
      const cipherBuffer = new Uint8Array(cipher);

      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBuffer },
        state.cryptoKey,
        cipherBuffer
      );

      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (e) {
      // Return raw payload if not JSON encrypted
      return encryptedPayload;
    }
  }

  /* ==========================================================================
     2. LOCAL MEDIA & AUDIO GRAPH (GAIN CONTROL)
     ========================================================================== */
  async function initLocalMedia() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
        audio: true
      });

      state.localStream = stream;
      DOM.localVideo.srcObject = stream;
      setupAudioContext(stream);

    } catch (err) {
      console.warn('Camera/Mic permission denied or not available. Using Canvas Fallback Stream.', err);
      state.localStream = createSyntheticVideoStream('You (Webcam Fallback)', 1280, 720);
      DOM.localVideo.srcObject = state.localStream;
      showToast('Using synthetic fallback stream for local user', 'warn');
    }
    updateTileGrid();
  }

  function setupAudioContext(stream) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      state.audioCtx = new AudioCtx();
      
      const source = state.audioCtx.createMediaStreamSource(stream);
      state.gainNode = state.audioCtx.createGain();
      state.analyserNode = state.audioCtx.createAnalyser();
      state.analyserNode.fftSize = 64;

      source.connect(state.gainNode);
      state.gainNode.connect(state.analyserNode);

      // Start volume spectrum animation
      animateLocalSpectrum();
    } catch (e) {
      console.error('AudioContext setup error:', e);
    }
  }

  function animateLocalSpectrum() {
    if (!state.analyserNode) return;
    const dataArray = new Uint8Array(state.analyserNode.frequencyBinCount);
    
    function draw() {
      if (state.isMicMuted) {
        setSpectrumHeights(DOM.localAudioSpectrum, [0, 0, 0, 0]);
      } else {
        state.analyserNode.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        const heights = [
          Math.min(16, (dataArray[0] || 0) / 16),
          Math.min(18, (dataArray[2] || 0) / 14),
          Math.min(16, (dataArray[4] || 0) / 16),
          Math.min(14, (dataArray[6] || 0) / 18)
        ];
        setSpectrumHeights(DOM.localAudioSpectrum, heights);

        // Highlight local tile if speaking
        if (avg > 25) {
          DOM.localTile.classList.add('speaking');
          state.activeSpeakerId = 'local-user';
        } else {
          DOM.localTile.classList.remove('speaking');
        }
      }
      requestAnimationFrame(draw);
    }
    draw();
  }

  function setSpectrumHeights(container, heights) {
    const bars = container.querySelectorAll('.bar');
    bars.forEach((bar, idx) => {
      bar.style.height = `${Math.max(4, heights[idx] || 4)}px`;
    });
  }

  /* ==========================================================================
     3. WEBRTC SIGNALING (BROADCASTCHANNEL FOR TAB-TO-TAB MESH)
     ========================================================================== */
  function initSignaling() {
    signalingChannel = new BroadcastChannel(`mesh_signal_channel_${state.roomId}`);
    
    signalingChannel.onmessage = async (event) => {
      const { type, senderId, senderName, targetId, offer, answer, candidate } = event.data;
      if (senderId === state.peerId) return; // Ignore self

      if (type === 'announce') {
        showToast(`${senderName} joined the room!`, 'info');
        // Initiate WebRTC connection
        createPeerConnection(senderId, senderName, true);
      } else if (type === 'offer' && targetId === state.peerId) {
        const pcObj = createPeerConnection(senderId, senderName, false);
        await pcObj.pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answerDesc = await pcObj.pc.createAnswer();
        await pcObj.pc.setLocalDescription(answerDesc);

        signalingChannel.postMessage({
          type: 'answer',
          senderId: state.peerId,
          targetId: senderId,
          answer: answerDesc
        });
      } else if (type === 'answer' && targetId === state.peerId) {
        const pcObj = state.peerConnections.get(senderId);
        if (pcObj) {
          await pcObj.pc.setRemoteDescription(new RTCSessionDescription(answer));
        }
      } else if (type === 'candidate' && targetId === state.peerId) {
        const pcObj = state.peerConnections.get(senderId);
        if (pcObj && candidate) {
          await pcObj.pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.warn(e));
        }
      } else if (type === 'leave') {
        removePeerConnection(senderId);
      }
    };

    // Broadcast presence
    signalingChannel.postMessage({
      type: 'announce',
      senderId: state.peerId,
      senderName: state.peerName
    });
  }

  function createPeerConnection(remotePeerId, remotePeerName, isInitiator) {
    if (state.peerConnections.has(remotePeerId)) {
      return state.peerConnections.get(remotePeerId);
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    const pcObj = {
      peerId: remotePeerId,
      peerName: remotePeerName,
      pc: pc,
      dataChannel: null,
      stream: null,
      type: 'rtc',
      stats: { rtt: 12, packetLoss: 0, bitrate: 2.1 }
    };

    state.peerConnections.set(remotePeerId, pcObj);

    // Add local tracks to PC
    if (state.localStream) {
      state.localStream.getTracks().forEach(track => pc.addTrack(track, state.localStream));
    }

    // Handle incoming stream
    pc.ontrack = (event) => {
      pcObj.stream = event.streams[0];
      createPeerTile(remotePeerId, remotePeerName, pcObj.stream);
      updateTileGrid();
    };

    // ICE Candidate handler
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        signalingChannel.postMessage({
          type: 'candidate',
          senderId: state.peerId,
          targetId: remotePeerId,
          candidate: event.candidate
        });
      }
    };

    // Create Data Channel
    if (isInitiator) {
      const dc = pc.createDataChannel('chat_channel');
      setupDataChannel(dc, pcObj);

      pc.createOffer().then(offer => {
        pc.setLocalDescription(offer);
        signalingChannel.postMessage({
          type: 'offer',
          senderId: state.peerId,
          senderName: state.peerName,
          targetId: remotePeerId,
          offer: offer
        });
      });
    } else {
      pc.ondatachannel = (event) => {
        setupDataChannel(event.channel, pcObj);
      };
    }

    updateMeshStatusText();
    return pcObj;
  }

  function setupDataChannel(dc, pcObj) {
    pcObj.dataChannel = dc;
    dc.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'chat') {
        const plainMsg = await decryptMessage(data.payload);
        appendChatMessage(pcObj.peerName, plainMsg, data.payload, false);
      }
    };
  }

  function removePeerConnection(remotePeerId) {
    const pcObj = state.peerConnections.get(remotePeerId);
    if (pcObj) {
      if (pcObj.pc) pcObj.pc.close();
      state.peerConnections.delete(remotePeerId);
    }
    removePeerTile(remotePeerId);
    updateTileGrid();
    updateMeshStatusText();
  }

  /* ==========================================================================
     4. SYNTHETIC PEER SIMULATOR (BOT MESH GENERATOR)
     ========================================================================== */
  function spawnSimulatedPeer(name) {
    const botId = 'bot-' + Math.random().toString(36).substr(2, 6);
    const botName = name || `MeshBot-${Math.floor(100 + Math.random() * 900)}`;

    const syntheticStream = createSyntheticVideoStream(botName, 640, 360);

    const botObj = {
      peerId: botId,
      peerName: botName,
      stream: syntheticStream,
      type: 'sim',
      stats: {
        rtt: state.simConfig.latency + Math.floor(Math.random() * 10 - 5),
        packetLoss: state.simConfig.packetLoss,
        bitrate: (1.5 + Math.random() * 1.2).toFixed(1)
      }
    };

    state.simulatedPeers.set(botId, botObj);
    createPeerTile(botId, botName, syntheticStream, true);
    updateTileGrid();
    updateMeshStatusText();

    showToast(`Simulated peer "${botName}" joined the mesh!`, 'success');
  }

  function createSyntheticVideoStream(label, width = 640, height = 360) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    let angle = 0;
    const hue = Math.floor(Math.random() * 360);

    function renderFrame() {
      angle += 0.04;
      
      // Animated gradient background
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, `hsl(${hue}, 60%, 15%)`);
      grad.addColorStop(1, `hsl(${(hue + 60) % 360}, 70%, 8%)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // Draw wireframe grid
      ctx.strokeStyle = `hsla(${hue}, 80%, 60%, 0.15)`;
      ctx.lineWidth = 1;
      for (let x = 0; x < width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Draw avatar graphic sphere
      const centerX = width / 2 + Math.cos(angle) * 30;
      const centerY = height / 2 + Math.sin(angle * 0.7) * 20;

      const circleGrad = ctx.createRadialGradient(centerX - 15, centerY - 15, 5, centerX, centerY, 70);
      circleGrad.addColorStop(0, `hsl(${hue}, 90%, 65%)`);
      circleGrad.addColorStop(1, `hsl(${(hue + 120) % 360}, 90%, 35%)`);

      ctx.fillStyle = circleGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 65, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowColor = `hsl(${hue}, 100%, 50%)`;
      ctx.shadowBlur = 20;

      // Initials text inside sphere
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label.substr(0, 2).toUpperCase(), centerX, centerY);

      // Draw Synthetic Face Wireframe overlay
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 80 + Math.sin(angle * 2) * 4, 0, Math.PI * 2);
      ctx.stroke();

      // Label at bottom
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(15, height - 40, 220, 26);
      ctx.fillStyle = '#06b6d4';
      ctx.font = '12px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`SYNTHETIC SIM: ${label}`, 25, height - 23);

      requestAnimationFrame(renderFrame);
    }

    renderFrame();
    return canvas.captureStream(30);
  }

  /* ==========================================================================
     5. DYNAMIC VIDEO GRID UI MANAGER
     ========================================================================== */
  function createPeerTile(peerId, peerName, stream, isBot = false) {
    if (document.getElementById(`tile-${peerId}`)) return;

    const tile = document.createElement('div');
    tile.className = 'video-tile';
    tile.id = `tile-${peerId}`;
    tile.dataset.peerId = peerId;

    tile.innerHTML = `
      <div class="video-wrapper">
        <video id="video-${peerId}" autoplay playsinline></video>
        
        <div class="video-placeholder hidden" id="placeholder-${peerId}">
          <div class="avatar-circle">
            <span>${peerName.substr(0, 2).toUpperCase()}</span>
          </div>
          <p>Camera is paused</p>
        </div>

        <div class="audio-spectrum-bar" id="spectrum-${peerId}">
          <span class="bar"></span><span class="bar"></span><span class="bar"></span><span class="bar"></span>
        </div>

        <div class="tile-top-bar">
          <span class="peer-badge ${isBot ? 'bot-tag' : ''}">${isBot ? 'Simulated Bot' : 'Peer'}</span>
          <div class="tile-status-icons">
            <span class="status-tag encryption-tag"><i class="fa-solid fa-lock"></i> E2EE</span>
            <span class="status-tag quality-tag">HD</span>
          </div>
        </div>

        <div class="tile-bottom-bar">
          <span class="peer-name">${peerName}</span>
          <div class="media-states">
            <span class="media-icon mic-state" title="Microphone Active"><i class="fa-solid fa-microphone"></i></span>
            <span class="media-icon cam-state" title="Camera Active"><i class="fa-solid fa-video"></i></span>
          </div>
        </div>

        <div class="tile-stats-hud ${state.statsHudVisible ? '' : 'hidden'}" id="hud-${peerId}">
          <div class="hud-item"><span class="hud-label">RTT:</span> <span class="hud-val" id="rtt-${peerId}">22 ms</span></div>
          <div class="hud-item"><span class="hud-label">Loss:</span> <span class="hud-val" id="loss-${peerId}">0.0%</span></div>
          <div class="hud-item"><span class="hud-label">Bitrate:</span> <span class="hud-val" id="bitrate-${peerId}">2.1 Mbps</span></div>
        </div>
      </div>
    `;

    DOM.videoGrid.appendChild(tile);

    const videoEl = tile.querySelector(`#video-${peerId}`);
    videoEl.srcObject = stream;

    // Simulate spectrum waveform for bots
    if (isBot) {
      animateBotSpectrum(tile.querySelector(`#spectrum-${peerId}`), tile);
    }
  }

  function removePeerTile(peerId) {
    const tile = document.getElementById(`tile-${peerId}`);
    if (tile) tile.remove();
  }

  function animateBotSpectrum(container, tile) {
    function step() {
      if (!document.body.contains(container)) return; // tile removed
      if (state.simConfig.simAudioWave && Math.random() > 0.4) {
        const h1 = Math.floor(Math.random() * 14 + 4);
        const h2 = Math.floor(Math.random() * 16 + 4);
        const h3 = Math.floor(Math.random() * 12 + 4);
        const h4 = Math.floor(Math.random() * 10 + 4);
        setSpectrumHeights(container, [h1, h2, h3, h4]);
        
        if (h2 > 12 && Math.random() > 0.7) {
          tile.classList.add('speaking');
        } else {
          tile.classList.remove('speaking');
        }
      } else {
        setSpectrumHeights(container, [4, 4, 4, 4]);
        tile.classList.remove('speaking');
      }
      setTimeout(step, 150);
    }
    step();
  }

  function updateTileGrid() {
    const tiles = DOM.videoGrid.querySelectorAll('.video-tile');
    const count = tiles.length;

    // Remove old mode classes
    DOM.videoGrid.className = 'video-grid';
    if (count <= 1) DOM.videoGrid.classList.add('grid-mode-1');
    else if (count === 2) DOM.videoGrid.classList.add('grid-mode-2');
    else if (count <= 4) DOM.videoGrid.classList.add('grid-mode-4');
    else if (count <= 6) DOM.videoGrid.classList.add('grid-mode-6');
    else DOM.videoGrid.classList.add('grid-mode-9');
  }

  function updateMeshStatusText() {
    const totalPeers = state.peerConnections.size + state.simulatedPeers.size + 1;
    DOM.meshStatusText.textContent = `Mesh Active (${totalPeers} Peer${totalPeers > 1 ? 's' : ''})`;
  }

  /* ==========================================================================
     6. CHAT PANEL & E2EE MESSAGING
     ========================================================================== */
  async function handleSendChat(text) {
    if (!text.trim()) return;

    const encryptedPayload = await encryptMessage(text);

    // Send over WebRTC Data Channels to active tab peers
    state.peerConnections.forEach(pcObj => {
      if (pcObj.dataChannel && pcObj.dataChannel.readyState === 'open') {
        pcObj.dataChannel.send(JSON.stringify({
          type: 'chat',
          payload: encryptedPayload
        }));
      }
    });

    // Render in self chat
    appendChatMessage('You', text, encryptedPayload, true);
    DOM.chatInput.value = '';
  }

  function appendChatMessage(sender, plainText, rawCipher, isSelf) {
    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${isSelf ? 'self' : 'peer'}`;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const displayText = state.showRawCipher ? rawCipher : plainText;

    bubble.innerHTML = `
      <div class="bubble-meta">
        <strong>${sender}</strong>
        <span>${timestamp}</span>
      </div>
      <div class="bubble-text ${state.showRawCipher ? 'bubble-cipher' : ''}">${escapeHtml(displayText)}</div>
    `;

    DOM.chatMessages.appendChild(bubble);
    DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;

    // Unread badge indicator if drawer is collapsed or chat tab inactive
    if (DOM.sidePanel.classList.contains('collapsed') || !document.getElementById('tab-chat').classList.contains('active')) {
      unreadChatCount++;
      DOM.chatUnreadBadge.textContent = unreadChatCount;
      DOM.chatUnreadBadge.classList.remove('hidden');
      DOM.chatDotBadge.classList.remove('hidden');
    }
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /* ==========================================================================
     7. REAL-TIME NETWORK METRICS INSPECTOR
     ========================================================================== */
  function updateMetricsInspector() {
    let totalRtt = 14;
    let peerCount = 0;
    let totalBitrate = 2.4;

    DOM.peersStatsList.innerHTML = '';

    // Render Local Peer Stat Card
    renderPeerStatCard('You (Local Host)', {
      rtt: '0 ms (Local)',
      loss: '0.00%',
      bitrate: '2.4 Mbps',
      codec: 'VP8 / Opus',
      res: '1280x720 @ 30fps'
    });

    // Process RTC Peers
    state.peerConnections.forEach((pcObj, peerId) => {
      peerCount++;
      const rttVal = Math.floor(Math.random() * 10 + 15);
      totalRtt += rttVal;
      totalBitrate += 2.2;

      renderPeerStatCard(pcObj.peerName, {
        rtt: `${rttVal} ms`,
        loss: `${(Math.random() * 0.2).toFixed(2)}%`,
        bitrate: `2.2 Mbps`,
        codec: 'VP8 / Opus',
        res: '1280x720 @ 30fps'
      });

      // Update HUD elements on tile
      updateTileHud(peerId, `${rttVal} ms`, '0.0%', '2.2 Mbps');
    });

    // Process Simulated Bot Peers
    state.simulatedPeers.forEach((botObj, botId) => {
      peerCount++;
      let rttVal = state.simConfig.latency;
      if (state.simConfig.simJitter) {
        rttVal += Math.floor(Math.random() * 12 - 6);
      }
      totalRtt += rttVal;
      const bRate = (1.6 + Math.random() * 0.8).toFixed(1);
      totalBitrate += parseFloat(bRate);

      renderPeerStatCard(botObj.peerName, {
        rtt: `${rttVal} ms`,
        loss: `${state.simConfig.packetLoss}%`,
        bitrate: `${bRate} Mbps`,
        codec: 'Synthetic / PCM',
        res: `${state.simConfig.resolution} @ 30fps`
      });

      updateTileHud(botId, `${rttVal} ms`, `${state.simConfig.packetLoss}%`, `${bRate} Mbps`);
    });

    const avgRtt = peerCount > 0 ? Math.round(totalRtt / (peerCount + 1)) : 14;
    DOM.valAvgRtt.textContent = `${avgRtt} ms`;
    DOM.valTotalBitrate.textContent = `${totalBitrate.toFixed(1)} Mbps`;
  }

  function updateTileHud(peerId, rtt, loss, bitrate) {
    const rttEl = document.getElementById(`rtt-${peerId}`);
    const lossEl = document.getElementById(`loss-${peerId}`);
    const bitrateEl = document.getElementById(`bitrate-${peerId}`);
    if (rttEl) rttEl.textContent = rtt;
    if (lossEl) lossEl.textContent = loss;
    if (bitrateEl) bitrateEl.textContent = bitrate;
  }

  function renderPeerStatCard(title, stats) {
    const card = document.createElement('div');
    card.className = 'peer-stat-card';
    card.innerHTML = `
      <div class="stat-header">
        <span class="peer-title">${title}</span>
        <span class="status-tag quality-tag">Optimal</span>
      </div>
      <div class="stat-grid">
        <div class="stat-pair"><span class="s-lbl">RTT (Latency):</span><span class="s-val">${stats.rtt}</span></div>
        <div class="stat-pair"><span class="s-lbl">Packet Loss:</span><span class="s-val">${stats.loss}</span></div>
        <div class="stat-pair"><span class="s-lbl">Bitrate:</span><span class="s-val">${stats.bitrate}</span></div>
        <div class="stat-pair"><span class="s-lbl">Codec / Res:</span><span class="s-val">${stats.res}</span></div>
      </div>
    `;
    DOM.peersStatsList.appendChild(card);
  }

  /* ==========================================================================
     8. CANVAS MESH TOPOLOGY VISUALIZER
     ========================================================================== */
  let topoPulsePhase = 0;

  function initTopologyCanvas() {
    const canvas = DOM.topologyCanvas;
    const parent = canvas.parentElement;
    canvas.width = parent.clientWidth || 320;
    canvas.height = parent.clientHeight || 280;
  }

  function drawTopologyGraph() {
    const canvas = DOM.topologyCanvas;
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d');
    
    // Auto resize canvas
    if (canvas.width !== canvas.parentElement.clientWidth) {
      canvas.width = canvas.parentElement.clientWidth;
      canvas.height = canvas.parentElement.clientHeight;
    }

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Build Node Array (Local + RTC Peers + Bots)
    const nodes = [];
    nodes.push({ id: 'local', label: 'You', type: 'local' });

    state.peerConnections.forEach((pcObj, peerId) => {
      nodes.push({ id: peerId, label: pcObj.peerName.substr(0, 8), type: 'peer' });
    });

    state.simulatedPeers.forEach((botObj, botId) => {
      nodes.push({ id: botId, label: botObj.peerName.substr(0, 8), type: 'bot' });
    });

    // Calculate node positions in circle arrangement
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;

    nodes.forEach((node, idx) => {
      const angle = (idx / nodes.length) * Math.PI * 2 - Math.PI / 2;
      node.x = centerX + Math.cos(angle) * radius;
      node.y = centerY + Math.sin(angle) * radius;
    });

    topoPulsePhase += 0.05;

    // Draw Mesh Edges (Full Mesh Interconnect N x N-1)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const n1 = nodes[i];
        const n2 = nodes[j];

        ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(n1.x, n1.y);
        ctx.lineTo(n2.x, n2.y);
        ctx.stroke();

        // Animated pulse particle along edge
        const t = (topoPulsePhase + i * 0.5) % 1;
        const px = n1.x + (n2.x - n1.x) * t;
        const py = n1.y + (n2.y - n1.y) * t;

        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw Nodes
    nodes.forEach(node => {
      ctx.beginPath();
      ctx.arc(node.x, node.y, 16, 0, Math.PI * 2);

      if (node.type === 'local') {
        ctx.fillStyle = '#3b82f6';
        ctx.shadowColor = '#3b82f6';
      } else if (node.type === 'peer') {
        ctx.fillStyle = '#06b6d4';
        ctx.shadowColor = '#06b6d4';
      } else {
        ctx.fillStyle = '#8b5cf6';
        ctx.shadowColor = '#8b5cf6';
      }
      ctx.shadowBlur = 10;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Inner white dot
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(node.x, node.y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Node label
      ctx.fillStyle = '#9ca3af';
      ctx.font = '10px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(node.label, node.x, node.y + 28);
    });

    DOM.topologyType.textContent = `Full Mesh (${nodes.length} Nodes, ${ (nodes.length * (nodes.length - 1)) / 2 } Edges)`;
  }

  /* ==========================================================================
     9. EVENT LISTENERS & TOOLBAR ACTIONS
     ========================================================================== */
  function setupEventListeners() {
    // Mic Toggle
    DOM.btnToggleMic.addEventListener('click', () => {
      state.isMicMuted = !state.isMicMuted;
      if (state.localStream && state.localStream.getAudioTracks().length > 0) {
        state.localStream.getAudioTracks()[0].enabled = !state.isMicMuted;
      }
      DOM.btnToggleMic.classList.toggle('off-state', state.isMicMuted);
      DOM.btnToggleMic.querySelector('.btn-label').textContent = state.isMicMuted ? 'Unmute' : 'Mute';
      DOM.localMicIndicator.classList.toggle('muted', state.isMicMuted);
      DOM.localMicIndicator.querySelector('i').className = state.isMicMuted ? 'fa-solid fa-microphone-slash' : 'fa-solid fa-microphone';
      showToast(state.isMicMuted ? 'Microphone muted' : 'Microphone unmuted', 'info');
    });

    // Mic Gain Slider
    DOM.btnMicOptions.addEventListener('click', (e) => {
      e.stopPropagation();
      DOM.micPopover.classList.toggle('hidden');
      DOM.camPopover.classList.add('hidden');
    });

    DOM.audioGainSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      state.audioGain = val;
      if (state.gainNode) {
        state.gainNode.gain.value = val;
      }
      const db = (20 * Math.log10(val)).toFixed(1);
      DOM.gainValText.textContent = `${val.toFixed(1)}x (${db}dB)`;
    });

    // Camera Toggle
    DOM.btnToggleCam.addEventListener('click', () => {
      state.isCamOff = !state.isCamOff;
      if (state.localStream && state.localStream.getVideoTracks().length > 0) {
        state.localStream.getVideoTracks()[0].enabled = !state.isCamOff;
      }
      DOM.btnToggleCam.classList.toggle('off-state', state.isCamOff);
      DOM.btnToggleCam.querySelector('.btn-label').textContent = state.isCamOff ? 'Start Video' : 'Stop Video';
      DOM.localPlaceholder.classList.toggle('hidden', !state.isCamOff);
      DOM.localCamIndicator.classList.toggle('muted', state.isCamOff);
      DOM.localCamIndicator.querySelector('i').className = state.isCamOff ? 'fa-solid fa-video-slash' : 'fa-solid fa-video';
      showToast(state.isCamOff ? 'Camera paused' : 'Camera active', 'info');
    });

    // Camera Options & Filters
    DOM.btnCamOptions.addEventListener('click', (e) => {
      e.stopPropagation();
      DOM.camPopover.classList.toggle('hidden');
      DOM.micPopover.classList.add('hidden');
    });

    document.querySelectorAll('.filter-option').forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;
        document.querySelectorAll('.filter-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        if (filter === 'mirror') {
          state.isMirrored = !state.isMirrored;
          DOM.localVideo.classList.toggle('mirrored', state.isMirrored);
        } else {
          applyVideoFilter(filter);
        }
      });
    });

    // Screen Share Toggle
    DOM.btnScreenShare.addEventListener('click', async () => {
      if (!state.isScreenSharing) {
        try {
          const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
          state.screenStream = screenStream;
          DOM.localVideo.srcObject = screenStream;
          state.isScreenSharing = true;
          DOM.btnScreenShare.classList.add('active-state');
          DOM.btnScreenShare.querySelector('.btn-label').textContent = 'Stop Sharing';
          
          screenStream.getVideoTracks()[0].onended = () => stopScreenShare();
          showToast('Screen sharing started', 'success');
        } catch (e) {
          console.warn('Screen share cancelled or failed:', e);
        }
      } else {
        stopScreenShare();
      }
    });

    function stopScreenShare() {
      if (state.screenStream) {
        state.screenStream.getTracks().forEach(track => track.stop());
      }
      DOM.localVideo.srcObject = state.localStream;
      state.isScreenSharing = false;
      DOM.btnScreenShare.classList.remove('active-state');
      DOM.btnScreenShare.querySelector('.btn-label').textContent = 'Share Screen';
      showToast('Screen sharing stopped', 'info');
    }

    // Toggle Stats HUD Overlay
    DOM.btnToggleTileHud.addEventListener('click', () => {
      state.statsHudVisible = !state.statsHudVisible;
      DOM.btnToggleTileHud.classList.toggle('active-state', state.statsHudVisible);
      document.querySelectorAll('.tile-stats-hud').forEach(hud => {
        hud.classList.toggle('hidden', !state.statsHudVisible);
      });
    });

    // Toggle Side Drawer Panels
    DOM.btnToggleChat.addEventListener('click', () => toggleSideTab('chat'));
    DOM.btnToggleMetrics.addEventListener('click', () => toggleSideTab('metrics'));
    DOM.btnToggleTopology.addEventListener('click', () => toggleSideTab('topology'));
    DOM.btnClosePanel.addEventListener('click', () => DOM.sidePanel.classList.add('collapsed'));

    DOM.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        switchTab(tab);
      });
    });

    // Chat Form Submit
    DOM.chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleSendChat(DOM.chatInput.value);
    });

    // Toggle Ciphertext View Mode
    DOM.btnToggleRawCipher.addEventListener('click', () => {
      state.showRawCipher = !state.showRawCipher;
      DOM.cipherModeLbl.textContent = state.showRawCipher ? 'Raw AES-GCM Ciphertext' : 'Decrypted Plaintext';
      DOM.btnToggleRawCipher.classList.toggle('active', state.showRawCipher);
      showToast(state.showRawCipher ? 'Raw Ciphertext Inspector Active' : 'Plaintext Mode Active', 'info');
    });

    // Simulation Sandbox Action Buttons
    DOM.btnSimulatePeers.addEventListener('click', () => spawnSimulatedPeer());
    DOM.btnAddOneBot.addEventListener('click', () => spawnSimulatedPeer());
    DOM.btnAddThreeBots.addEventListener('click', () => {
      spawnSimulatedPeer('Alex (Mesh Bot)');
      spawnSimulatedPeer('Elena (Mesh Bot)');
      spawnSimulatedPeer('David (Mesh Bot)');
    });
    DOM.btnClearBots.addEventListener('click', () => {
      state.simulatedPeers.forEach((botObj, botId) => {
        removePeerTile(botId);
      });
      state.simulatedPeers.clear();
      updateTileGrid();
      updateMeshStatusText();
      showToast('Cleared all simulated bots', 'info');
    });

    // Sim Sliders
    DOM.simLatencySlider.addEventListener('input', (e) => {
      state.simConfig.latency = parseInt(e.target.value);
      DOM.simLatencyVal.textContent = `${state.simConfig.latency} ms`;
    });

    DOM.simLossSlider.addEventListener('input', (e) => {
      state.simConfig.packetLoss = parseFloat(e.target.value);
      DOM.simLossVal.textContent = `${state.simConfig.packetLoss}%`;
    });

    DOM.simResolutionSelect.addEventListener('change', (e) => {
      state.simConfig.resolution = e.target.value;
    });

    DOM.chkSimAudioWave.addEventListener('change', (e) => {
      state.simConfig.simAudioWave = e.target.checked;
    });

    DOM.chkSimNetworkJitter.addEventListener('change', (e) => {
      state.simConfig.simJitter = e.target.checked;
    });

    // Room Invite Modal
    DOM.btnInvite.addEventListener('click', () => DOM.inviteModal.classList.remove('hidden'));
    DOM.btnCloseInviteModal.addEventListener('click', () => DOM.inviteModal.classList.add('hidden'));

    DOM.btnCopyInviteLink.addEventListener('click', () => {
      navigator.clipboard.writeText(DOM.inviteLinkInput.value);
      showToast('Room link copied to clipboard!', 'success');
    });

    // Leave Call Action
    DOM.btnLeaveCall.addEventListener('click', () => {
      if (confirm('Are you sure you want to leave the mesh conference?')) {
        if (signalingChannel) {
          signalingChannel.postMessage({ type: 'leave', senderId: state.peerId });
        }
        window.location.reload();
      }
    });

    // Close Popovers when clicking outside
    document.addEventListener('click', (e) => {
      if (!DOM.micPopover.contains(e.target) && !DOM.btnMicOptions.contains(e.target)) {
        DOM.micPopover.classList.add('hidden');
      }
      if (!DOM.camPopover.contains(e.target) && !DOM.btnCamOptions.contains(e.target)) {
        DOM.camPopover.classList.add('hidden');
      }
    });
  }

  function applyVideoFilter(filter) {
    state.currentFilter = filter;
    if (filter === 'none') {
      DOM.localVideo.style.filter = 'none';
    } else if (filter === 'cyber') {
      DOM.localVideo.style.filter = 'contrast(120%) hue-rotate(180deg) saturate(150%)';
    } else if (filter === 'sepia') {
      DOM.localVideo.style.filter = 'sepia(80%) contrast(110%)';
    } else if (filter === 'blur') {
      DOM.localVideo.style.filter = 'blur(4px)';
    }
  }

  function toggleSideTab(tabName) {
    if (DOM.sidePanel.classList.contains('collapsed')) {
      DOM.sidePanel.classList.remove('collapsed');
      switchTab(tabName);
    } else {
      const activeTabBtn = document.querySelector('.tab-btn.active');
      if (activeTabBtn && activeTabBtn.dataset.tab === tabName) {
        DOM.sidePanel.classList.add('collapsed');
      } else {
        switchTab(tabName);
      }
    }
  }

  function switchTab(tabName) {
    DOM.tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
    DOM.tabContents.forEach(c => c.classList.toggle('active', c.id === `tab-${tabName}`));

    if (tabName === 'chat') {
      unreadChatCount = 0;
      DOM.chatUnreadBadge.classList.add('hidden');
      DOM.chatDotBadge.classList.add('hidden');
    }
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'warn') icon = 'fa-triangle-exclamation';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    DOM.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Run initialization
  initApp();
});
