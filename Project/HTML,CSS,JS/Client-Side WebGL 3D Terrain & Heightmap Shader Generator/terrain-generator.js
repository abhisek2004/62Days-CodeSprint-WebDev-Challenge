/**
 * GeoForge 3D - WebGL Terrain & Heightmap Shader Generator
 * Author: Antigravity AI
 * Technology: WebGL / Three.js / Custom GLSL Shaders
 */

(function () {
  'use strict';

  /* ==========================================================================
     1. Procedural Noise Algorithms (Simplex & Perlin fBm Core)
     ========================================================================== */
  class FastNoise {
    constructor(seed = 1337) {
      this.seed = seed;
      this.p = new Uint8Array(256);
      this.perm = new Uint8Array(512);
      this.permMod12 = new Uint8Array(512);
      this.reseed(seed);
    }

    reseed(seed) {
      this.seed = seed;
      // Simple LCG PRNG for seed initialization
      let s = seed % 2147483647;
      if (s <= 0) s += 2147483646;

      for (let i = 0; i < 256; i++) {
        this.p[i] = i;
      }

      for (let i = 255; i > 0; i--) {
        s = (s * 16807) % 2147483647;
        const j = Math.floor((s / 2147483647) * (i + 1));
        const temp = this.p[i];
        this.p[i] = this.p[j];
        this.p[j] = temp;
      }

      for (let i = 0; i < 512; i++) {
        this.perm[i] = this.p[i & 255];
        this.permMod12[i] = this.perm[i] % 12;
      }
    }

    // 2D Simplex Noise
    simplex2D(xin, yin) {
      const F2 = 0.5 * (Math.sqrt(3.0) - 1.0);
      const G2 = (3.0 - Math.sqrt(3.0)) / 6.0;

      let n0, n1, n2;
      const s = (xin + yin) * F2;
      const i = Math.floor(xin + s);
      const j = Math.floor(yin + s);
      const t = (i + j) * G2;
      const X0 = i - t;
      const Y0 = j - t;
      const x0 = xin - X0;
      const y0 = yin - Y0;

      let i1, j1;
      if (x0 > y0) { i1 = 1; j1 = 0; }
      else { i1 = 0; j1 = 1; }

      const x1 = x0 - i1 + G2;
      const y1 = y0 - j1 + G2;
      const x2 = x0 - 1.0 + 2.0 * G2;
      const y2 = y0 - 1.0 + 2.0 * G2;

      const ii = i & 255;
      const jj = j & 255;
      const gi0 = this.permMod12[ii + this.perm[jj]];
      const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]];
      const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]];

      let t0 = 0.5 - x0 * x0 - y0 * y0;
      if (t0 < 0) n0 = 0.0;
      else {
        t0 *= t0;
        n0 = t0 * t0 * this.grad2D(gi0, x0, y0);
      }

      let t1 = 0.5 - x1 * x1 - y1 * y1;
      if (t1 < 0) n1 = 0.0;
      else {
        t1 *= t1;
        n1 = t1 * t1 * this.grad2D(gi1, x1, y1);
      }

      let t2 = 0.5 - x2 * x2 - y2 * y2;
      if (t2 < 0) n2 = 0.0;
      else {
        t2 *= t2;
        n2 = t2 * t2 * this.grad2D(gi2, x2, y2);
      }

      return 70.0 * (n0 + n1 + n2);
    }

    grad2D(hash, x, y) {
      const h = hash & 7;
      const u = h < 4 ? x : y;
      const v = h < 4 ? y : x;
      return ((h & 1) ? -u : u) + ((h & 2) ? -2.0 * v : 2.0 * v);
    }

    // Fractal Brownian Motion
    fBm(x, y, octaves, persistence, lacunarity, type = 'fbm') {
      let total = 0;
      let frequency = 1;
      let amplitude = 1;
      let maxValue = 0;

      for (let i = 0; i < octaves; i++) {
        let v = this.simplex2D(x * frequency, y * frequency);

        if (type === 'ridge') {
          v = 1.0 - Math.abs(v);
          v = v * v;
        } else if (type === 'billow') {
          v = Math.abs(v) * 2.0 - 1.0;
        }

        total += v * amplitude;
        maxValue += amplitude;
        amplitude *= persistence;
        frequency *= lacunarity;
      }

      return total / maxValue;
    }
  }

  /* ==========================================================================
     2. App State & Biome Profiles
     ========================================================================== */
  const state = {
    noiseType: 'fbm',
    seed: 1337,
    scale: 0.015,
    octaves: 6,
    persistence: 0.5,
    lacunarity: 2.0,
    heightAmplitude: 45,
    resolution: 256,
    
    // Biome Colors
    colorDeep: '#1a3b1e',
    colorMid: '#2d6a36',
    colorSlope: '#6b655b',
    colorPeak: '#ffffff',
    slopeFactor: 0.65,

    // Lighting & Environment
    sunAzimuth: 135,
    sunElevation: 45,
    colorSun: '#fff4db',
    fogDensity: 0.0015,

    // Water Engine
    waterEnabled: true,
    waterHeight: 12.0,
    colorWater: '#0077be',
    waveSpeed: 1.0,
    waterOpacity: 0.75,

    // View Options
    shadingMode: 0, // 0: Shaded Biome, 1: Normals, 2: Height Color
    wireframe: false,
    autoRotate: false
  };

  const biomes = {
    forest: {
      noiseType: 'fbm', scale: 0.015, octaves: 6, persistence: 0.5, lacunarity: 2.0, heightAmplitude: 45,
      colorDeep: '#1a3b1e', colorMid: '#2d6a36', colorSlope: '#6b655b', colorPeak: '#ffffff',
      slopeFactor: 0.65, sunAzimuth: 135, sunElevation: 45, colorSun: '#fff4db', fogDensity: 0.0015,
      waterEnabled: true, waterHeight: 12.0, colorWater: '#0077be'
    },
    desert: {
      noiseType: 'billow', scale: 0.012, octaves: 5, persistence: 0.45, lacunarity: 2.1, heightAmplitude: 35,
      colorDeep: '#c27d38', colorMid: '#e0a96d', colorSlope: '#8c4a27', colorPeak: '#f4e1c1',
      slopeFactor: 0.40, sunAzimuth: 60, sunElevation: 25, colorSun: '#ffda9e', fogDensity: 0.0022,
      waterEnabled: false, waterHeight: -10.0, colorWater: '#005577'
    },
    snow: {
      noiseType: 'ridge', scale: 0.018, octaves: 7, persistence: 0.55, lacunarity: 2.2, heightAmplitude: 65,
      colorDeep: '#2b3a4a', colorMid: '#4a6572', colorSlope: '#90a4ae', colorPeak: '#ffffff',
      slopeFactor: 0.75, sunAzimuth: 210, sunElevation: 35, colorSun: '#e2f1ff', fogDensity: 0.0028,
      waterEnabled: true, waterHeight: 8.0, colorWater: '#1c4966'
    },
    volcanic: {
      noiseType: 'ridge', scale: 0.020, octaves: 6, persistence: 0.6, lacunarity: 2.0, heightAmplitude: 55,
      colorDeep: '#121212', colorMid: '#2d1810', colorSlope: '#801d00', colorPeak: '#ff4500',
      slopeFactor: 0.80, sunAzimuth: 300, sunElevation: 20, colorSun: '#ff6633', fogDensity: 0.0035,
      waterEnabled: true, waterHeight: 6.0, colorWater: '#990000'
    },
    alien: {
      noiseType: 'simplex', scale: 0.025, octaves: 6, persistence: 0.5, lacunarity: 2.3, heightAmplitude: 50,
      colorDeep: '#1d0936', colorMid: '#4b0082', colorSlope: '#00d2ff', colorPeak: '#ff007f',
      slopeFactor: 0.55, sunAzimuth: 180, sunElevation: 50, colorSun: '#00ffff', fogDensity: 0.0018,
      waterEnabled: true, waterHeight: 14.0, colorWater: '#4b0082'
    }
  };

  /* ==========================================================================
     3. WebGL Engine & Shaders Setup
     ========================================================================== */
  let container, canvas, renderer, scene, camera;
  let terrainMesh, terrainGeometry, terrainMaterial;
  let waterMesh, waterMaterial;
  let dirLight, ambientLight;
  let heightmap2DCanvas, heightmap2DCtx;

  const noiseGen = new FastNoise(state.seed);

  // Performance Monitoring
  let lastTime = performance.now();
  let frameCount = 0;
  let currentFps = 60;

  // Custom Orbit Controls variables
  const cameraState = {
    radius: 220,
    theta: Math.PI / 4,
    phi: Math.PI / 3,
    target: new THREE.Vector3(0, 10, 0),
    isDragging: false,
    dragButton: 0,
    previousMousePosition: { x: 0, y: 0 }
  };

  // Custom Terrain Shader Definitions
  const TerrainVertexShader = `
    varying vec2 vUv;
    varying float vHeight;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    void main() {
      vUv = uv;
      vHeight = position.z; // Native geometry z before rotation or local pos y
      vNormal = normalize(normalMatrix * normal);
      
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;

      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `;

  const TerrainFragmentShader = `
    uniform vec3 uColorDeep;
    uniform vec3 uColorMid;
    uniform vec3 uColorSlope;
    uniform vec3 uColorPeak;
    uniform float uSlopeFactor;
    uniform float uMaxHeight;
    uniform vec3 uSunDirection;
    uniform vec3 uSunColor;
    uniform vec3 uFogColor;
    uniform float uFogDensity;
    uniform int uShadingMode; // 0: Biome, 1: Normals, 2: Height

    varying vec2 vUv;
    varying float vHeight;
    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    void main() {
      // Calculate normalized height factor (0.0 to 1.0)
      float h = clamp(vHeight / max(uMaxHeight, 1.0), 0.0, 1.0);

      // Normal visualization
      if (uShadingMode == 1) {
        gl_FragColor = vec4(vNormal * 0.5 + 0.5, 1.0);
        return;
      }

      // Heightmap color visualization
      if (uShadingMode == 2) {
        gl_FragColor = vec4(vec3(h), 1.0);
        return;
      }

      // 1. Elevation Color Interpolation
      vec3 baseColor;
      if (h < 0.35) {
        baseColor = mix(uColorDeep, uColorMid, h / 0.35);
      } else if (h < 0.75) {
        baseColor = mix(uColorMid, uColorSlope, (h - 0.35) / 0.40);
      } else {
        baseColor = mix(uColorSlope, uColorPeak, (h - 0.75) / 0.25);
      }

      // 2. Slope Rock Blend based on Normal dot Y
      float slopeDot = dot(normalize(vNormal), vec3(0.0, 1.0, 0.0));
      float rockWeight = smoothstep(1.0 - uSlopeFactor, 0.95 - uSlopeFactor, slopeDot);
      vec3 finalBiomeColor = mix(uColorSlope, baseColor, rockWeight);

      // 3. Directional Lighting & Ambient
      float diff = max(dot(normalize(vNormal), normalize(uSunDirection)), 0.15);
      vec3 lightEnergy = uSunColor * diff + vec3(0.2, 0.22, 0.28);
      vec3 finalColor = finalBiomeColor * lightEnergy;

      // 4. Fog Distance Calculation
      float fogDistance = length(vWorldPosition - cameraPosition);
      float fogFactor = 1.0 - exp(-fogDistance * uFogDensity);
      finalColor = mix(finalColor, uFogColor, clamp(fogFactor, 0.0, 1.0));

      gl_FragColor = vec4(finalColor, 1.0);
    }
  `;

  // Custom Water Wave Shader
  const WaterVertexShader = `
    uniform float uTime;
    uniform float uWaveSpeed;
    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;

    void main() {
      vUv = uv;
      vec3 pos = position;
      
      // Simple animated Sine / Wave offset
      float wave1 = sin(pos.x * 0.1 + uTime * uWaveSpeed * 2.0) * 0.8;
      float wave2 = cos(pos.y * 0.12 + uTime * uWaveSpeed * 1.5) * 0.6;
      pos.z += wave1 + wave2;

      vNormal = normalize(vec3(-wave1 * 0.1, -wave2 * 0.1, 1.0));

      vec4 worldPos = modelMatrix * vec4(pos, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `;

  const WaterFragmentShader = `
    uniform vec3 uColorWater;
    uniform float uWaterOpacity;
    uniform vec3 uSunDirection;
    uniform vec3 uSunColor;
    uniform vec3 uFogColor;
    uniform float uFogDensity;

    varying vec2 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vNormal;

    void main() {
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);
      vec3 normal = normalize(vNormal);

      // Fresnel Specular Reflection
      float fresnel = pow(1.0 - max(dot(viewDir, normal), 0.0), 3.0);
      vec3 reflDir = reflect(-uSunDirection, normal);
      float spec = pow(max(dot(viewDir, reflDir), 0.0), 32.0);

      vec3 waterColor = mix(uColorWater, vec3(1.0), fresnel * 0.4);
      waterColor += uSunColor * spec * 0.8;

      // Fog calculation
      float fogDistance = length(vWorldPosition - cameraPosition);
      float fogFactor = 1.0 - exp(-fogDistance * uFogDensity);
      waterColor = mix(waterColor, uFogColor, clamp(fogFactor, 0.0, 1.0));

      gl_FragColor = vec4(waterColor, clamp(uWaterOpacity + fresnel * 0.2, 0.0, 0.95));
    }
  `;

  /* ==========================================================================
     4. Initialization & Setup
     ========================================================================== */
  function init() {
    container = document.getElementById('canvas-container');
    canvas = document.getElementById('webgl-canvas');
    heightmap2DCanvas = document.getElementById('heightmap-2d-canvas');
    heightmap2DCtx = heightmap2DCanvas.getContext('2d');

    // 1. Three.js Renderer Setup
    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance'
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    // 2. Scene & Fog Setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x090c15);
    scene.fog = new THREE.FogExp2(0x090c15, state.fogDensity);

    // 3. Camera Setup
    camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      1,
      2000
    );
    updateCameraPosition();

    // 4. Create Terrain & Water Meshes
    createTerrainMesh();
    createWaterMesh();

    // 5. Register Event Listeners & UI Controls
    setupEventListeners();
    setupOrbitControls();

    // 6. Initial Render & Heightmap Update
    updateTerrainData();
    updateGLSLCodeModal();

    // 7. Start Animation Loop
    requestAnimationFrame(animate);
  }

  /* ==========================================================================
     5. Camera Orbit Controls Implementation
     ========================================================================== */
  function updateCameraPosition() {
    const x = cameraState.target.x + cameraState.radius * Math.sin(cameraState.phi) * Math.sin(cameraState.theta);
    const y = cameraState.target.y + cameraState.radius * Math.cos(cameraState.phi);
    const z = cameraState.target.z + cameraState.radius * Math.sin(cameraState.phi) * Math.cos(cameraState.theta);

    camera.position.set(x, y, z);
    camera.lookAt(cameraState.target);
  }

  function setupOrbitControls() {
    canvas.addEventListener('mousedown', (e) => {
      cameraState.isDragging = true;
      cameraState.dragButton = e.button;
      cameraState.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      cameraState.isDragging = false;
    });

    window.addEventListener('mousemove', (e) => {
      if (!cameraState.isDragging) return;

      const deltaX = e.clientX - cameraState.previousMousePosition.x;
      const deltaY = e.clientY - cameraState.previousMousePosition.y;

      if (cameraState.dragButton === 0) {
        // Rotate (Left Mouse Button)
        cameraState.theta -= deltaX * 0.005;
        cameraState.phi -= deltaY * 0.005;

        // Clamp phi to prevent flips
        cameraState.phi = Math.max(0.05, Math.min(Math.PI / 2 - 0.02, cameraState.phi));
      } else if (cameraState.dragButton === 2 || cameraState.dragButton === 1) {
        // Pan (Right Mouse Button)
        const panSpeed = cameraState.radius * 0.001;
        const forward = new THREE.Vector3().subVectors(cameraState.target, camera.position).normalize();
        const side = new THREE.Vector3().crossVectors(forward, camera.up).normalize();

        cameraState.target.addScaledVector(side, -deltaX * panSpeed);
        cameraState.target.y += deltaY * panSpeed;
      }

      cameraState.previousMousePosition = { x: e.clientX, y: e.clientY };
      updateCameraPosition();
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      cameraState.radius += e.deltaY * 0.15;
      cameraState.radius = Math.max(30, Math.min(600, cameraState.radius));
      updateCameraPosition();
    }, { passive: false });

    // Prevent context menu on right click
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  /* ==========================================================================
     6. Terrain Generation & Mesh Update
     ========================================================================== */
  function createTerrainMesh() {
    if (terrainMesh) {
      scene.remove(terrainMesh);
      terrainGeometry.dispose();
    }

    const res = parseInt(state.resolution, 10);
    const size = 180; // World unit plane dimensions

    terrainGeometry = new THREE.PlaneGeometry(size, size, res - 1, res - 1);
    terrainGeometry.rotateX(-Math.PI / 2); // Lay flat on XZ plane

    const sunDir = calculateSunDirection();

    terrainMaterial = new THREE.ShaderMaterial({
      vertexShader: TerrainVertexShader,
      fragmentShader: TerrainFragmentShader,
      uniforms: {
        uColorDeep: { value: new THREE.Color(state.colorDeep) },
        uColorMid: { value: new THREE.Color(state.colorMid) },
        uColorSlope: { value: new THREE.Color(state.colorSlope) },
        uColorPeak: { value: new THREE.Color(state.colorPeak) },
        uSlopeFactor: { value: state.slopeFactor },
        uMaxHeight: { value: state.heightAmplitude },
        uSunDirection: { value: sunDir },
        uSunColor: { value: new THREE.Color(state.colorSun) },
        uFogColor: { value: new THREE.Color(0x090c15) },
        uFogDensity: { value: state.fogDensity },
        uShadingMode: { value: state.shadingMode }
      },
      wireframe: state.wireframe,
      side: THREE.DoubleSide
    });

    terrainMesh = new THREE.Mesh(terrainGeometry, terrainMaterial);
    scene.add(terrainMesh);
  }

  function createWaterMesh() {
    if (waterMesh) scene.remove(waterMesh);

    const waterGeometry = new THREE.PlaneGeometry(300, 300, 64, 64);
    waterGeometry.rotateX(-Math.PI / 2);

    const sunDir = calculateSunDirection();

    waterMaterial = new THREE.ShaderMaterial({
      vertexShader: WaterVertexShader,
      fragmentShader: WaterFragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uWaveSpeed: { value: state.waveSpeed },
        uColorWater: { value: new THREE.Color(state.colorWater) },
        uWaterOpacity: { value: state.waterOpacity },
        uSunDirection: { value: sunDir },
        uSunColor: { value: new THREE.Color(state.colorSun) },
        uFogColor: { value: new THREE.Color(0x090c15) },
        uFogDensity: { value: state.fogDensity }
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
    waterMesh.position.y = state.waterHeight;
    waterMesh.visible = state.waterEnabled;
    scene.add(waterMesh);
  }

  function calculateSunDirection() {
    const aziRad = THREE.MathUtils.degToRad(state.sunAzimuth);
    const eleRad = THREE.MathUtils.degToRad(state.sunElevation);

    const x = Math.cos(eleRad) * Math.cos(aziRad);
    const y = Math.sin(eleRad);
    const z = Math.cos(eleRad) * Math.sin(aziRad);

    return new THREE.Vector3(x, y, z).normalize();
  }

  function updateTerrainData() {
    noiseGen.reseed(state.seed);
    const res = parseInt(state.resolution, 10);
    const positions = terrainGeometry.attributes.position;
    const array = positions.array;

    let idx = 0;
    const heightData2D = new Float32Array(res * res);

    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        // Calculate noise height
        const nX = i * state.scale;
        const nY = j * state.scale;

        let rawNoise = noiseGen.fBm(
          nX, nY,
          state.octaves,
          state.persistence,
          state.lacunarity,
          state.noiseType
        );

        // Normalize 0..1 then scale by height amplitude
        let normalizedHeight = (rawNoise + 1.0) * 0.5;
        normalizedHeight = Math.max(0.0, Math.min(1.0, normalizedHeight));

        const worldHeight = normalizedHeight * state.heightAmplitude;

        // Position order in PlaneGeometry: x, y (which is height after rotateX), z
        array[idx + 1] = worldHeight; // Y axis height in Three.js world space
        heightData2D[j * res + i] = normalizedHeight;

        idx += 3;
      }
    }

    positions.needsUpdate = true;
    terrainGeometry.computeVertexNormals();

    // Update 2D Heightmap Canvas Preview
    draw2DHeightmap(heightData2D, res);

    // Update Vertices Stats Count
    document.getElementById('stat-verts').textContent = (res * res / 1000).toFixed(1) + 'K';
    document.getElementById('stat-res').textContent = `${res}²`;
  }

  function draw2DHeightmap(data, res) {
    heightmap2DCanvas.width = res;
    heightmap2DCanvas.height = res;

    const imgData = heightmap2DCtx.createImageData(res, res);
    const buf = imgData.data;

    for (let i = 0; i < data.length; i++) {
      const val = Math.floor(data[i] * 255);
      const pixelIdx = i * 4;

      buf[pixelIdx] = val;     // R
      buf[pixelIdx + 1] = val; // G
      buf[pixelIdx + 2] = val; // B
      buf[pixelIdx + 3] = 255; // A
    }

    heightmap2DCtx.putImageData(imgData, 0, 0);
  }

  /* ==========================================================================
     7. Exporters (Heightmap PNG & 3D OBJ)
     ========================================================================== */
  function exportHeightmapPNG(resolution = 1024) {
    const offCanvas = document.createElement('canvas');
    offCanvas.width = resolution;
    offCanvas.height = resolution;
    const offCtx = offCanvas.getContext('2d');

    const imgData = offCtx.createImageData(resolution, resolution);
    const buf = imgData.data;

    for (let j = 0; j < resolution; j++) {
      for (let i = 0; i < resolution; i++) {
        const nX = (i / resolution) * resolution * state.scale;
        const nY = (j / resolution) * resolution * state.scale;

        let rawNoise = noiseGen.fBm(
          nX, nY,
          state.octaves,
          state.persistence,
          state.lacunarity,
          state.noiseType
        );

        let h = Math.max(0.0, Math.min(1.0, (rawNoise + 1.0) * 0.5));
        let val = Math.floor(h * 255);

        let idx = (j * resolution + i) * 4;
        buf[idx] = val;
        buf[idx + 1] = val;
        buf[idx + 2] = val;
        buf[idx + 3] = 255;
      }
    }

    offCtx.putImageData(imgData, 0, 0);

    // Download PNG File
    const link = document.createElement('a');
    link.download = `GeoForge_Heightmap_${state.noiseType}_${state.seed}.png`;
    link.href = offCanvas.toDataURL('image/png');
    link.click();
  }

  function export3DOBJ() {
    const res = parseInt(document.getElementById('export-obj-res').value === 'current' ? state.resolution : document.getElementById('export-obj-res').value, 10);
    const scale = parseFloat(document.getElementById('export-obj-scale').value) || 1.0;
    const includeNormals = document.getElementById('export-obj-normals').checked;
    const includeUVs = document.getElementById('export-obj-uvs').checked;

    let objText = `# GeoForge 3D WebGL Terrain Export\n# Resolution: ${res}x${res}, Seed: ${state.seed}\n\n`;

    const size = 180;
    const step = size / (res - 1);
    const half = size / 2;

    // 1. Vertices (v x y z)
    for (let j = 0; j < res; j++) {
      for (let i = 0; i < res; i++) {
        const x = i * step - half;
        const z = j * step - half;

        const nX = i * state.scale;
        const nY = j * state.scale;
        let rawNoise = noiseGen.fBm(nX, nY, state.octaves, state.persistence, state.lacunarity, state.noiseType);
        let h = Math.max(0.0, Math.min(1.0, (rawNoise + 1.0) * 0.5));
        const y = h * state.heightAmplitude * scale;

        objText += `v ${x.toFixed(4)} ${y.toFixed(4)} ${z.toFixed(4)}\n`;
      }
    }

    // 2. Texture UVs (vt u v)
    if (includeUVs) {
      for (let j = 0; j < res; j++) {
        for (let i = 0; i < res; i++) {
          const u = i / (res - 1);
          const v = j / (res - 1);
          objText += `vt ${u.toFixed(4)} ${v.toFixed(4)}\n`;
        }
      }
    }

    // 3. Faces (f v1/vt1/vn1 v2/vt2/vn2 v3/vt3/vn3)
    objText += '\ng TerrainMesh\n';
    for (let j = 0; j < res - 1; j++) {
      for (let i = 0; i < res - 1; i++) {
        const row1 = j * res + i + 1;
        const row2 = (j + 1) * res + i + 1;

        const p1 = row1;
        const p2 = row1 + 1;
        const p3 = row2;
        const p4 = row2 + 1;

        if (includeUVs) {
          objText += `f ${p1}/${p1} ${p3}/${p3} ${p2}/${p2}\n`;
          objText += `f ${p2}/${p2} ${p3}/${p3} ${p4}/${p4}\n`;
        } else {
          objText += `f ${p1} ${p3} ${p2}\n`;
          objText += `f ${p2} ${p3} ${p4}\n`;
        }
      }
    }

    // Initiate File Download
    const blob = new Blob([objText], { type: 'text/plain' });
    const link = document.createElement('a');
    link.download = `GeoForge_Terrain_${state.seed}.obj`;
    link.href = URL.createObjectURL(blob);
    link.click();
    URL.revokeObjectURL(link.href);
  }

  /* ==========================================================================
     8. UI Event Listeners & Accordion Handling
     ========================================================================== */
  function setupEventListeners() {
    // Window Resize Handler
    window.addEventListener('resize', () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });

    // Biome Selector Cards
    document.querySelectorAll('.biome-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.biome-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');

        const biomeKey = card.dataset.biome;
        if (biomes[biomeKey]) {
          applyBiomePreset(biomes[biomeKey]);
        }
      });
    });

    // Inputs & Sliders
    bindInput('noise-type', 'noiseType', updateTerrainAndShader);
    bindInput('noise-seed', 'seed', updateTerrainAndShader, true);
    bindSlider('slider-scale', 'scale', 'val-scale', updateTerrainAndShader, (v) => parseFloat(v).toFixed(3));
    bindSlider('slider-octaves', 'octaves', 'val-octaves', updateTerrainAndShader, (v) => parseInt(v));
    bindSlider('slider-persistence', 'persistence', 'val-persistence', updateTerrainAndShader, (v) => parseFloat(v).toFixed(2));
    bindSlider('slider-lacunarity', 'lacunarity', 'val-lacunarity', updateTerrainAndShader, (v) => parseFloat(v).toFixed(1));
    bindSlider('slider-height', 'heightAmplitude', 'val-height', updateTerrainAndShader, (v) => parseInt(v));

    bindInput('select-resolution', 'resolution', () => {
      createTerrainMesh();
      updateTerrainData();
    });

    // Randomize Seed Button
    document.getElementById('btn-randomize-seed').addEventListener('click', () => {
      const newSeed = Math.floor(Math.random() * 999999);
      document.getElementById('noise-seed').value = newSeed;
      state.seed = newSeed;
      updateTerrainData();
    });

    // Biome Colors
    bindColorPicker('color-deep', 'colorDeep');
    bindColorPicker('color-mid', 'colorMid');
    bindColorPicker('color-slope', 'colorSlope');
    bindColorPicker('color-peak', 'colorPeak');
    bindSlider('slider-slope-factor', 'slopeFactor', 'val-slope-factor', updateUniforms, (v) => parseFloat(v).toFixed(2));

    // Sun & Fog
    bindSlider('slider-sun-azimuth', 'sunAzimuth', 'val-sun-azimuth', updateUniforms, (v) => `${v}°`);
    bindSlider('slider-sun-elevation', 'sunElevation', 'val-sun-elevation', updateUniforms, (v) => `${v}°`);
    bindColorPicker('color-sun', 'colorSun');
    bindSlider('slider-fog-density', 'fogDensity', 'val-fog-density', (val) => {
      state.fogDensity = parseFloat(val);
      scene.fog.density = state.fogDensity;
      if (terrainMaterial) terrainMaterial.uniforms.uFogDensity.value = state.fogDensity;
      if (waterMaterial) waterMaterial.uniforms.uFogDensity.value = state.fogDensity;
    }, (v) => parseFloat(v).toFixed(4));

    // Water Engine
    document.getElementById('toggle-water').addEventListener('change', (e) => {
      state.waterEnabled = e.target.checked;
      if (waterMesh) waterMesh.visible = state.waterEnabled;
    });

    bindSlider('slider-water-height', 'waterHeight', 'val-water-height', (val) => {
      state.waterHeight = parseFloat(val);
      if (waterMesh) waterMesh.position.y = state.waterHeight;
    }, (v) => parseFloat(v).toFixed(1));

    bindColorPicker('color-water', 'colorWater', () => {
      if (waterMaterial) waterMaterial.uniforms.uColorWater.value.set(state.colorWater);
    });

    bindSlider('slider-wave-speed', 'waveSpeed', 'val-wave-speed', (val) => {
      state.waveSpeed = parseFloat(val);
      if (waterMaterial) waterMaterial.uniforms.uWaveSpeed.value = state.waveSpeed;
    }, (v) => `${parseFloat(v).toFixed(1)}x`);

    bindSlider('slider-water-opacity', 'waterOpacity', 'val-water-opacity', (val) => {
      state.waterOpacity = parseFloat(val);
      if (waterMaterial) waterMaterial.uniforms.uWaterOpacity.value = state.waterOpacity;
    }, (v) => parseFloat(v).toFixed(2));

    // Viewport Mode Buttons
    document.getElementById('mode-textured').addEventListener('click', (e) => setShadingMode(0, e.target));
    document.getElementById('mode-normals').addEventListener('click', (e) => setShadingMode(1, e.target));
    document.getElementById('mode-elevation').addEventListener('click', (e) => setShadingMode(2, e.target));

    // Camera Preset Buttons
    document.getElementById('cam-preset-orbit').addEventListener('click', () => setCameraPreset(220, Math.PI / 4, Math.PI / 3));
    document.getElementById('cam-preset-top').addEventListener('click', () => setCameraPreset(220, 0, 0.05));
    document.getElementById('cam-preset-iso').addEventListener('click', () => setCameraPreset(250, Math.PI / 4, Math.PI / 3.5));
    document.getElementById('cam-preset-fly').addEventListener('click', () => setCameraPreset(140, Math.PI / 4, Math.PI / 2.2));

    // Header Tool Actions
    document.getElementById('btn-toggle-wireframe').addEventListener('click', (e) => {
      state.wireframe = !state.wireframe;
      terrainMaterial.wireframe = state.wireframe;
      e.currentTarget.classList.toggle('active', state.wireframe);
    });

    document.getElementById('btn-toggle-cinema').addEventListener('click', (e) => {
      state.autoRotate = !state.autoRotate;
      e.currentTarget.classList.toggle('active', state.autoRotate);
    });

    document.getElementById('btn-toggle-sidebar').addEventListener('click', () => {
      document.getElementById('sidebar-controls').classList.toggle('open');
    });

    // Modals
    document.getElementById('btn-export-shader').addEventListener('click', () => {
      updateGLSLCodeModal();
      openModal('modal-shader');
    });

    document.getElementById('btn-export-obj').addEventListener('click', () => {
      openModal('modal-obj');
    });

    document.getElementById('btn-export-png').addEventListener('click', () => {
      exportHeightmapPNG(1024);
    });

    document.getElementById('btn-pip-expand').addEventListener('click', () => {
      exportHeightmapPNG(1024);
    });

    document.getElementById('btn-download-obj').addEventListener('click', () => {
      export3DOBJ();
      closeModal('modal-obj');
    });

    // Close Modals
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        closeModal(btn.dataset.close);
      });
    });

    // Modal Tabs
    document.querySelectorAll('.shader-tabs .tab-btn').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.shader-tabs .tab-btn').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const targetTab = tab.dataset.tab;
        if (targetTab === 'vertex-shader') {
          document.getElementById('code-vertex').classList.remove('hidden');
          document.getElementById('code-fragment').classList.add('hidden');
        } else {
          document.getElementById('code-vertex').classList.add('hidden');
          document.getElementById('code-fragment').classList.remove('hidden');
        }
      });
    });

    // Copy GLSL Code
    document.getElementById('btn-copy-code').addEventListener('click', () => {
      const isVertex = !document.getElementById('code-vertex').classList.contains('hidden');
      const code = isVertex ? document.getElementById('code-vertex').textContent : document.getElementById('code-fragment').textContent;

      navigator.clipboard.writeText(code).then(() => {
        const btn = document.getElementById('btn-copy-code');
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
        setTimeout(() => {
          btn.innerHTML = '<i class="fa-solid fa-copy"></i> Copy GLSL Code';
        }, 2000);
      });
    });
  }

  /* Helper Binding Functions */
  function bindInput(id, key, callback, isNum = false) {
    const el = document.getElementById(id);
    el.addEventListener('change', (e) => {
      state[key] = isNum ? parseFloat(e.target.value) : e.target.value;
      if (callback) callback();
    });
  }

  function bindSlider(id, key, badgeId, callback, formatFn) {
    const el = document.getElementById(id);
    const badge = document.getElementById(badgeId);

    el.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      state[key] = val;
      if (badge && formatFn) badge.textContent = formatFn(val);
      if (callback) callback(val);
    });
  }

  function bindColorPicker(id, key, customCb) {
    const el = document.getElementById(id);
    el.addEventListener('input', (e) => {
      state[key] = e.target.value;
      if (customCb) customCb();
      else updateUniforms();
    });
  }

  function setShadingMode(mode, targetBtn) {
    state.shadingMode = mode;
    document.querySelectorAll('.top-right .btn-chip').forEach(b => b.classList.remove('active'));
    targetBtn.classList.add('active');
    if (terrainMaterial) terrainMaterial.uniforms.uShadingMode.value = mode;
  }

  function setCameraPreset(radius, theta, phi) {
    cameraState.radius = radius;
    cameraState.theta = theta;
    cameraState.phi = phi;
    cameraState.target.set(0, 10, 0);
    updateCameraPosition();
  }

  function applyBiomePreset(preset) {
    Object.assign(state, preset);

    // Sync UI Input Values
    document.getElementById('noise-type').value = state.noiseType;
    document.getElementById('slider-scale').value = state.scale;
    document.getElementById('val-scale').textContent = state.scale.toFixed(3);

    document.getElementById('slider-octaves').value = state.octaves;
    document.getElementById('val-octaves').textContent = state.octaves;

    document.getElementById('slider-persistence').value = state.persistence;
    document.getElementById('val-persistence').textContent = state.persistence.toFixed(2);

    document.getElementById('slider-lacunarity').value = state.lacunarity;
    document.getElementById('val-lacunarity').textContent = state.lacunarity.toFixed(1);

    document.getElementById('slider-height').value = state.heightAmplitude;
    document.getElementById('val-height').textContent = state.heightAmplitude;

    document.getElementById('color-deep').value = state.colorDeep;
    document.getElementById('color-mid').value = state.colorMid;
    document.getElementById('color-slope').value = state.colorSlope;
    document.getElementById('color-peak').value = state.colorPeak;

    document.getElementById('slider-sun-azimuth').value = state.sunAzimuth;
    document.getElementById('val-sun-azimuth').textContent = `${state.sunAzimuth}°`;

    document.getElementById('slider-sun-elevation').value = state.sunElevation;
    document.getElementById('val-sun-elevation').textContent = `${state.sunElevation}°`;

    document.getElementById('color-sun').value = state.colorSun;
    document.getElementById('slider-fog-density').value = state.fogDensity;
    document.getElementById('val-fog-density').textContent = state.fogDensity.toFixed(4);

    document.getElementById('toggle-water').checked = state.waterEnabled;
    document.getElementById('slider-water-height').value = state.waterHeight;
    document.getElementById('val-water-height').textContent = state.waterHeight.toFixed(1);
    document.getElementById('color-water').value = state.colorWater;

    // Apply 3D Updates
    scene.fog.density = state.fogDensity;
    if (waterMesh) {
      waterMesh.visible = state.waterEnabled;
      waterMesh.position.y = state.waterHeight;
    }

    updateUniforms();
    updateTerrainData();
    updateGLSLCodeModal();
  }

  function updateUniforms() {
    if (!terrainMaterial) return;

    terrainMaterial.uniforms.uColorDeep.value.set(state.colorDeep);
    terrainMaterial.uniforms.uColorMid.value.set(state.colorMid);
    terrainMaterial.uniforms.uColorSlope.value.set(state.colorSlope);
    terrainMaterial.uniforms.uColorPeak.value.set(state.colorPeak);
    terrainMaterial.uniforms.uSlopeFactor.value = state.slopeFactor;
    terrainMaterial.uniforms.uMaxHeight.value = state.heightAmplitude;

    const sunDir = calculateSunDirection();
    terrainMaterial.uniforms.uSunDirection.value.copy(sunDir);
    terrainMaterial.uniforms.uSunColor.value.set(state.colorSun);

    if (waterMaterial) {
      waterMaterial.uniforms.uSunDirection.value.copy(sunDir);
      waterMaterial.uniforms.uSunColor.value.set(state.colorSun);
      waterMaterial.uniforms.uColorWater.value.set(state.colorWater);
    }
  }

  function updateTerrainAndShader() {
    updateUniforms();
    updateTerrainData();
    updateGLSLCodeModal();
  }

  function openModal(id) {
    document.getElementById(id).classList.add('active');
  }

  function closeModal(id) {
    document.getElementById(id).classList.remove('active');
  }

  function updateGLSLCodeModal() {
    document.getElementById('code-vertex').textContent = TerrainVertexShader.trim();
    document.getElementById('code-fragment').textContent = TerrainFragmentShader.trim();
  }

  /* ==========================================================================
     9. Main Render Loop & FPS Counter
     ========================================================================== */
  function animate(time) {
    requestAnimationFrame(animate);

    const now = performance.now();
    frameCount++;
    if (now >= lastTime + 1000) {
      currentFps = Math.round((frameCount * 1000) / (now - lastTime));
      document.getElementById('stat-fps').textContent = currentFps;
      frameCount = 0;
      lastTime = now;
    }

    // Auto rotate camera in Cinema mode
    if (state.autoRotate) {
      cameraState.theta += 0.003;
      updateCameraPosition();
    }

    // Animate water shader waves
    if (waterMaterial && state.waterEnabled) {
      waterMaterial.uniforms.uTime.value = time * 0.001;
    }

    renderer.render(scene, camera);
  }

  // Initialize App on DOM Ready
  window.addEventListener('DOMContentLoaded', init);
})();
