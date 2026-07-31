/**
 * WebGL Raymarching & Signed Distance Field Sandbox
 * Author: Antigravity AI
 * Full client-side WebGL 2.0 raymarching engine with live GLSL editor,
 * CSG boolean operations, Ambient Occlusion, Soft Shadows, and Reflections.
 */

(function () {
  'use strict';

  // --- GLSL Shader Header & Helper Library Definition ---
  const GLSL_HEADER = `#version 300 es
precision highp float;

out vec4 fragColor;

// Uniforms
uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_camPos;
uniform vec3 u_camTarget;
uniform float u_fov;

uniform vec3 u_lightPos;
uniform vec3 u_lightColor;
uniform float u_lightIntensity;

uniform vec3 u_bgColor1;
uniform vec3 u_bgColor2;

uniform bool u_enableAO;
uniform bool u_enableShadows;
uniform bool u_enableReflections;

uniform float u_aoIntensity;
uniform float u_shadowK;
uniform float u_reflectionStr;
uniform int u_maxSteps;

// Material Structure
struct Material {
  vec3 color;
  float roughness;
  float metalness;
  float reflection;
};

// --- SDF Primitives ---
float sdSphere(vec3 p, float r) {
  return length(p) - r;
}

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdTorus(vec3 p, vec2 t) {
  vec2 q = vec2(length(p.xz) - t.x, p.y);
  return length(q) - t.y;
}

float sdCylinder(vec3 p, float h, float r) {
  vec2 d = abs(vec2(length(p.xz), p.y)) - vec2(r, h);
  return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

float sdPlane(vec3 p, float h) {
  return p.y - h;
}

// --- CSG & Operators ---
float opUnion(float d1, float d2) {
  return min(d1, d2);
}

float opSubtraction(float d1, float d2) {
  return max(-d1, d2);
}

float opIntersection(float d1, float d2) {
  return max(d1, d2);
}

float opSmoothUnion(float d1, float d2, float k) {
  float h = clamp(0.5 + 0.5 * (d2 - d1) / k, 0.0, 1.0);
  return mix(d2, d1, h) - k * h * (1.0 - h);
}

float opSmoothSubtraction(float d1, float d2, float k) {
  float h = clamp(0.5 - 0.5 * (d2 + d1) / k, 0.0, 1.0);
  return mix(d2, -d1, h) + k * h * (1.0 - h);
}

float opSmoothIntersection(float d1, float d2, float k) {
  float h = clamp(0.5 - 0.5 * (d2 - d1) / k, 0.0, 1.0);
  return mix(d2, d1, h) + k * h * (1.0 - h);
}

vec3 opRepeat(vec3 p, vec3 c) {
  return mod(p + 0.5 * c, c) - 0.5 * c;
}

vec3 opTwist(vec3 p, float k) {
  float c = cos(k * p.y);
  float s = sin(k * p.y);
  mat2 m = mat2(c, -s, s, c);
  return vec3(m * p.xz, p.y).xzy;
}

// Rotation matrices
mat3 rotX(float angle) {
  float c = cos(angle), s = sin(angle);
  return mat3(1, 0, 0, 0, c, -s, 0, s, c);
}

mat3 rotY(float angle) {
  float c = cos(angle), s = sin(angle);
  return mat3(c, 0, s, 0, 1, 0, -s, 0, c);
}

mat3 rotZ(float angle) {
  float c = cos(angle), s = sin(angle);
  return mat3(c, -s, 0, s, c, 0, 0, 0, 1);
}

// Result structure for scene evaluation (distance & material ID)
struct SceneResult {
  float dist;
  int matId;
};

// Forward declaration of user map function
SceneResult sdScene(vec3 p);
Material getMaterial(int matId, vec3 p);
`;

  const GLSL_FOOTER = `
// --- Normal Calculation using Finite Difference ---
vec3 calcNormal(vec3 p) {
  const float h = 0.001;
  const vec2 k = vec2(1.0, -1.0);
  return normalize(
    k.xyy * sdScene(p + k.xyy * h).dist +
    k.yyx * sdScene(p + k.yyx * h).dist +
    k.yxy * sdScene(p + k.yxy * h).dist +
    k.xxx * sdScene(p + k.xxx * h).dist
  );
}

// --- Raymarching Engine ---
SceneResult rayMarch(vec3 ro, vec3 rd, float maxDist) {
  float dO = 0.0;
  int matId = 0;
  for (int i = 0; i < u_maxSteps; i++) {
    vec3 p = ro + rd * dO;
    SceneResult res = sdScene(p);
    dO += res.dist;
    matId = res.matId;
    if (res.dist < 0.001 || dO > maxDist) break;
  }
  return SceneResult(dO, matId);
}

// --- Raymarched Soft Shadows ---
float calcSoftshadow(vec3 ro, vec3 rd, float mint, float maxt, float k) {
  if (!u_enableShadows) return 1.0;
  float res = 1.0;
  float t = mint;
  for (int i = 0; i < 48; i++) {
    float h = sdScene(ro + rd * t).dist;
    res = min(res, k * h / t);
    t += clamp(h, 0.02, 0.20);
    if (res < 0.005 || t > maxt) break;
  }
  return clamp(res, 0.0, 1.0);
}

// --- Raymarched Ambient Occlusion ---
float calcAO(vec3 p, vec3 n) {
  if (!u_enableAO) return 1.0;
  float occ = 0.0;
  float sca = 1.0;
  for (int i = 0; i < 5; i++) {
    float h = 0.01 + 0.12 * float(i) / 4.0;
    float d = sdScene(p + h * n).dist;
    occ += (h - d) * sca;
    sca *= 0.95;
  }
  return clamp(1.0 - 1.5 * occ * u_aoIntensity, 0.0, 1.0);
}

// --- Main Lighting & Rendering Shading Pipeline ---
vec3 render(vec3 ro, vec3 rd) {
  const float MAX_DIST = 100.0;
  SceneResult res = rayMarch(ro, rd, MAX_DIST);
  
  // Background Gradient
  vec3 bg = mix(u_bgColor2, u_bgColor1, clamp(rd.y * 0.5 + 0.5, 0.0, 1.0));

  if (res.dist > MAX_DIST - 1.0) {
    return bg;
  }

  vec3 p = ro + rd * res.dist;
  vec3 n = calcNormal(p);
  Material mat = getMaterial(res.matId, p);

  vec3 lightDir = normalize(u_lightPos - p);
  vec3 viewDir = normalize(ro - p);
  vec3 halfDir = normalize(lightDir + viewDir);

  // Lighting calculations
  float diff = max(dot(n, lightDir), 0.0);
  float spec = pow(max(dot(n, halfDir), 0.0), 32.0 * (1.0 - mat.roughness));
  float shadow = calcSoftshadow(p + n * 0.005, lightDir, 0.02, 10.0, u_shadowK);
  float ao = calcAO(p, n);

  vec3 ambient = vec3(0.08) * mat.color * ao;
  vec3 diffuse = u_lightColor * u_lightIntensity * diff * mat.color * shadow;
  vec3 specular = u_lightColor * spec * mat.color * shadow;

  vec3 color = ambient + diffuse + specular;

  // Secondary Reflection Raytracing
  if (u_enableReflections && mat.reflection > 0.05) {
    vec3 refDir = reflect(rd, n);
    SceneResult refRes = rayMarch(p + n * 0.01, refDir, 30.0);
    vec3 refColor = bg;
    if (refRes.dist < 30.0 - 0.5) {
      vec3 refP = p + n * 0.01 + refDir * refRes.dist;
      vec3 refN = calcNormal(refP);
      Material refMat = getMaterial(refRes.matId, refP);
      float refDiff = max(dot(refN, lightDir), 0.0);
      refColor = refMat.color * (0.2 + 0.8 * refDiff);
    }
    color = mix(color, refColor, mat.reflection * u_reflectionStr);
  }

  // Fog effect for depth
  color = mix(color, bg, 1.0 - exp(-0.0003 * res.dist * res.dist * res.dist));

  return color;
}

void main() {
  // Normalized pixel coordinates (from -1 to 1)
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;

  // Ray Direction Calculation based on Camera FOV
  vec3 ww = normalize(u_camTarget - u_camPos);
  vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
  vec3 vv = normalize(cross(uu, ww));

  float tanFov = tan(radians(u_fov * 0.5));
  vec3 rd = normalize(uv.x * uu * tanFov + uv.y * vv * tanFov + ww);

  // Render Frame
  vec3 col = render(u_camPos, rd);

  // Gamma correction
  col = pow(col, vec3(0.4545));

  fragColor = vec4(col, 1.0);
}
`;

  // --- Preset GLSL Scene Codes ---
  const PRESETS = {
    csg_studio: `// CSG Geometry Studio
// Custom Scene Definition
SceneResult sdScene(vec3 p) {
  // Ground Plane
  float dPlane = sdPlane(p, -1.0);

  // CSG Primitive 1: Box with subtracted Inner Sphere
  vec3 pBox = p - vec3(0.0, 0.5, 0.0);
  float dBox = sdBox(pBox, vec3(1.0));
  float dSph = sdSphere(pBox, 1.25);
  float dCsg = opSubtraction(dSph, dBox);

  // Torus Ring floating around
  vec3 pTorus = p - vec3(0.0, 0.5 + sin(u_time * 1.5) * 0.2, 0.0);
  mat3 rot = rotX(u_time * 0.5) * rotY(u_time * 0.7);
  float dTorus = sdTorus(rot * pTorus, vec2(1.8, 0.15));

  // Smooth Union of CSG body and Torus
  float dBody = opSmoothUnion(dCsg, dTorus, 0.2);

  // Small inner floating metallic sphere
  float dCore = sdSphere(p - vec3(0.0, 0.5, 0.0), 0.65);

  if (dBody < dPlane && dBody < dCore) return SceneResult(dBody, 1);
  if (dCore < dPlane) return SceneResult(dCore, 2);
  return SceneResult(dPlane, 3);
}

// Materials Mapping
Material getMaterial(int matId, vec3 p) {
  if (matId == 1) {
    // Glossy Cyan Outer CSG
    return Material(vec3(0.0, 0.8, 0.9), 0.1, 0.5, 0.6);
  } else if (matId == 2) {
    // Glowing Gold Core
    vec3 gold = vec3(1.0, 0.75, 0.2);
    return Material(gold, 0.05, 0.9, 0.9);
  } else {
    // Checkered Floor
    float check = mod(floor(p.x * 2.0) + floor(p.z * 2.0), 2.0);
    vec3 floorCol = mix(vec3(0.12, 0.14, 0.2), vec3(0.05, 0.06, 0.1), check);
    return Material(floorCol, 0.4, 0.1, 0.3);
  }
}`,

    morphing_orbs: `// Morphing Plasma Orbs
SceneResult sdScene(vec3 p) {
  float dPlane = sdPlane(p, -1.2);

  float t = u_time * 1.2;
  vec3 p1 = p - vec3(sin(t) * 1.2, 0.2, cos(t) * 1.2);
  vec3 p2 = p - vec3(cos(t * 0.8) * 1.2, sin(t * 1.5) * 0.6, sin(t * 0.8) * 1.2);
  vec3 p3 = p - vec3(0.0, cos(t * 1.1) * 0.8 + 0.2, 0.0);

  float s1 = sdSphere(p1, 0.85);
  float s2 = sdSphere(p2, 0.75);
  float s3 = sdTorus(rotZ(t) * p3, vec2(1.0, 0.3));

  float dOrbs = opSmoothUnion(s1, s2, 0.5);
  dOrbs = opSmoothUnion(dOrbs, s3, 0.4);

  if (dOrbs < dPlane) return SceneResult(dOrbs, 1);
  return SceneResult(dPlane, 2);
}

Material getMaterial(int matId, vec3 p) {
  if (matId == 1) {
    // Neon Violet/Pink Dynamic Color
    vec3 col = 0.5 + 0.5 * cos(u_time + p.xyx + vec3(0, 2, 4));
    return Material(col, 0.15, 0.8, 0.8);
  } else {
    return Material(vec3(0.08, 0.09, 0.12), 0.5, 0.0, 0.2);
  }
}`,

    infinite_grid: `// Infinite Cyber City Grid
SceneResult sdScene(vec3 p) {
  float dPlane = sdPlane(p, -1.0);

  // Domain Repetition
  vec3 c = vec3(2.5, 0.0, 2.5);
  vec3 q = opRepeat(p - vec3(0.0, 0.0, u_time * 2.0), c);

  // Random heights based on grid position
  vec2 id = floor((p.xz - q.xz) / 2.5);
  float h = sin(id.x * 12.9898 + id.y * 78.233) * 0.5 + 0.7;

  float dBuildings = sdBox(q - vec3(0.0, h * 0.5 - 1.0, 0.0), vec3(0.6, h, 0.6));

  if (dBuildings < dPlane) return SceneResult(dBuildings, 1);
  return SceneResult(dPlane, 2);
}

Material getMaterial(int matId, vec3 p) {
  if (matId == 1) {
    return Material(vec3(0.05, 0.6, 1.0), 0.2, 0.7, 0.5);
  } else {
    return Material(vec3(0.02, 0.03, 0.06), 0.8, 0.0, 0.4);
  }
}`,

    reflection_temple: `// Reflective Gold & Glass Temple
SceneResult sdScene(vec3 p) {
  float dFloor = sdPlane(p, -1.0);

  // Central Gold Sculpture
  vec3 p1 = p - vec3(0.0, 0.8, 0.0);
  mat3 r = rotY(u_time * 0.4) * rotX(0.5);
  float dSphere = sdSphere(p1, 1.0);
  float dBox = sdBox(r * p1, vec3(0.85));
  float dSculpture = opIntersection(dSphere, dBox);

  // Outer Ring
  float dRing = sdTorus(rotX(1.57) * p1, vec2(1.8, 0.12));
  float dObj = opUnion(dSculpture, dRing);

  if (dObj < dFloor) return SceneResult(dObj, 1);
  return SceneResult(dFloor, 2);
}

Material getMaterial(int matId, vec3 p) {
  if (matId == 1) {
    return Material(vec3(1.0, 0.8, 0.3), 0.02, 0.95, 0.9);
  } else {
    float grid = step(0.9, sin(p.x * 2.0) * sin(p.z * 2.0));
    vec3 c = mix(vec3(0.1), vec3(0.0, 0.8, 1.0), grid);
    return Material(c, 0.05, 0.5, 0.85);
  }
}`,

    twisted_sculpture: `// Twisted Carved Torus
SceneResult sdScene(vec3 p) {
  float dFloor = sdPlane(p, -1.2);

  vec3 pTwist = opTwist(p - vec3(0.0, 0.5, 0.0), sin(u_time) * 1.5);
  float d1 = sdTorus(pTwist, vec2(1.2, 0.4));
  float d2 = sdCylinder(p, 1.5, 0.5);
  float dFinal = opSubtraction(d2, d1);

  if (dFinal < dFloor) return SceneResult(dFinal, 1);
  return SceneResult(dFloor, 2);
}

Material getMaterial(int matId, vec3 p) {
  if (matId == 1) {
    return Material(vec3(0.9, 0.2, 0.4), 0.1, 0.6, 0.7);
  } else {
    return Material(vec3(0.07, 0.08, 0.12), 0.3, 0.1, 0.3);
  }
}`
  };

  // --- Snippet Library for Quick Insertion ---
  const SNIPPETS = {
    sphere: `float dSphere = sdSphere(p - vec3(0.0, 0.0, 0.0), 1.0);\n`,
    box: `float dBox = sdBox(p - vec3(0.0, 0.0, 0.0), vec3(1.0, 1.0, 1.0));\n`,
    torus: `float dTorus = sdTorus(p - vec3(0.0, 0.0, 0.0), vec2(1.2, 0.3));\n`,
    cylinder: `float dCyl = sdCylinder(p - vec3(0.0, 0.0, 0.0), 1.0, 0.5);\n`,
    union: `float dBlend = opSmoothUnion(d1, d2, 0.3);\n`,
    subtraction: `float dCut = opSubtraction(d1, d2);\n`,
    intersection: `float dCross = opIntersection(d1, d2);\n`,
    twist: `vec3 pTwisted = opTwist(p, 1.0);\n`,
    repeat: `vec3 pRep = opRepeat(p, vec3(2.0, 0.0, 2.0));\n`
  };

  // --- State Variables ---
  let canvas, gl;
  let quadProgram = null;
  let quadVao = null;
  let animationFrameId = null;

  let isPlaying = true;
  let startTime = performance.now();
  let timeOffset = 0;
  let lastTime = performance.now();
  let frameCount = 0;
  let fpsLastCheck = performance.now();

  let autoCompile = true;
  let compileDebounceTimer = null;

  // Orbit Camera State
  const camera = {
    yaw: 0.8,
    pitch: 0.35,
    distance: 6.0,
    target: [0.0, 0.3, 0.0],
    fov: 60,
    isDragging: false,
    isPanning: false,
    lastMouseX: 0,
    lastMouseY: 0
  };

  // Uniform Location Cache
  let uniforms = {};

  // --- DOM Elements Cache ---
  let dom = {};

  // --- Initialization ---
  window.addEventListener('DOMContentLoaded', () => {
    initDOM();
    initWebGL();
    setupCameraEvents();
    setupUIEvents();
    loadPreset('csg_studio');
    requestAnimationFrame(renderLoop);
  });

  function initDOM() {
    canvas = document.getElementById('gl-canvas');
    dom = {
      presetSelect: document.getElementById('preset-select'),
      btnPlayPause: document.getElementById('btn-play-pause'),
      iconPause: document.getElementById('icon-pause'),
      iconPlay: document.getElementById('icon-play'),
      btnResetTime: document.getElementById('btn-reset-time'),
      fpsCounter: document.getElementById('fps-counter'),
      frameTime: document.getElementById('frame-time'),
      btnScreenshot: document.getElementById('btn-screenshot'),
      btnTogglePanels: document.getElementById('btn-toggle-panels'),
      editorPanel: document.getElementById('editor-panel'),
      controlsPanel: document.getElementById('controls-panel'),
      lineNumbers: document.getElementById('line-numbers'),
      codeEditor: document.getElementById('code-editor'),
      editorStatus: document.getElementById('editor-status'),
      errorConsole: document.getElementById('error-console'),
      errorLog: document.getElementById('error-log'),
      chkAutoCompile: document.getElementById('chk-auto-compile'),
      btnResetCode: document.getElementById('btn-reset-code'),
      btnCompile: document.getElementById('btn-compile'),

      // Controls
      chkAO: document.getElementById('chk-ao'),
      chkShadows: document.getElementById('chk-shadows'),
      chkReflections: document.getElementById('chk-reflections'),
      chkOrbitLight: document.getElementById('chk-orbit-light'),

      rngMaxSteps: document.getElementById('rng-max-steps'),
      valMaxSteps: document.getElementById('val-max-steps'),
      rngAOIntensity: document.getElementById('rng-ao-intensity'),
      valAOIntensity: document.getElementById('val-ao-intensity'),
      rngShadowK: document.getElementById('rng-shadow-k'),
      valShadowK: document.getElementById('val-shadow-k'),
      rngReflectionStr: document.getElementById('rng-reflection-str'),
      valReflectionStr: document.getElementById('val-reflection-str'),

      clrLight: document.getElementById('clr-light'),
      clrBg1: document.getElementById('clr-bg1'),
      clrBg2: document.getElementById('clr-bg2'),

      rngLightIntensity: document.getElementById('rng-light-intensity'),
      valLightIntensity: document.getElementById('val-light-intensity'),
      rngLightX: document.getElementById('rng-light-x'),
      valLightX: document.getElementById('val-light-x'),
      rngLightY: document.getElementById('rng-light-y'),
      valLightY: document.getElementById('val-light-y'),
      rngLightZ: document.getElementById('rng-light-z'),
      valLightZ: document.getElementById('val-light-z'),

      rngFov: document.getElementById('rng-fov'),
      valFov: document.getElementById('val-fov'),
      rngTimeSpeed: document.getElementById('rng-time-speed'),
      valTimeSpeed: document.getElementById('val-time-speed'),
      selRenderScale: document.getElementById('sel-render-scale'),
      btnResetCam: document.getElementById('btn-reset-cam')
    };
  }

  // --- WebGL Context & Mesh Quad Setup ---
  function initWebGL() {
    gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    if (!gl) {
      alert('WebGL 2.0 is not supported in your browser.');
      return;
    }

    // Full-screen Quad Vertex Buffer
    const quadPositions = new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1
    ]);

    quadVao = gl.createVertexArray();
    gl.bindVertexArray(quadVao);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, quadPositions, gl.STATIC_DRAW);

    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
  }

  function resizeCanvas() {
    const scale = parseFloat(dom.selRenderScale.value);
    const displayWidth = Math.floor(window.innerWidth * scale);
    const displayHeight = Math.floor(window.innerHeight * scale);

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
      canvas.width = displayWidth;
      canvas.height = displayHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
  }

  // --- Shader Compiler ---
  function compileShaderPipeline(userCode) {
    const vertShaderSource = `#version 300 es
      in vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fragShaderSource = GLSL_HEADER + userCode + GLSL_FOOTER;

    // Compile Vertex Shader
    const vertShader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(vertShader, vertShaderSource);
    gl.compileShader(vertShader);

    // Compile Fragment Shader
    const fragShader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(fragShader, fragShaderSource);
    gl.compileShader(fragShader);

    if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
      const errorLog = gl.getShaderInfoLog(fragShader);
      showShaderError(errorLog);
      gl.deleteShader(vertShader);
      gl.deleteShader(fragShader);
      return false;
    }

    // Link Program
    const program = gl.createProgram();
    gl.attachShader(program, vertShader);
    gl.attachShader(program, fragShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      showShaderError(gl.getProgramInfoLog(program));
      gl.deleteShader(vertShader);
      gl.deleteShader(fragShader);
      gl.deleteProgram(program);
      return false;
    }

    // Successfully Compiled
    if (quadProgram) gl.deleteProgram(quadProgram);
    quadProgram = program;

    // Cache Uniform Locations
    gl.useProgram(quadProgram);
    uniforms = {
      u_resolution: gl.getUniformLocation(quadProgram, 'u_resolution'),
      u_time: gl.getUniformLocation(quadProgram, 'u_time'),
      u_camPos: gl.getUniformLocation(quadProgram, 'u_camPos'),
      u_camTarget: gl.getUniformLocation(quadProgram, 'u_camTarget'),
      u_fov: gl.getUniformLocation(quadProgram, 'u_fov'),
      u_lightPos: gl.getUniformLocation(quadProgram, 'u_lightPos'),
      u_lightColor: gl.getUniformLocation(quadProgram, 'u_lightColor'),
      u_lightIntensity: gl.getUniformLocation(quadProgram, 'u_lightIntensity'),
      u_bgColor1: gl.getUniformLocation(quadProgram, 'u_bgColor1'),
      u_bgColor2: gl.getUniformLocation(quadProgram, 'u_bgColor2'),
      u_enableAO: gl.getUniformLocation(quadProgram, 'u_enableAO'),
      u_enableShadows: gl.getUniformLocation(quadProgram, 'u_enableShadows'),
      u_enableReflections: gl.getUniformLocation(quadProgram, 'u_enableReflections'),
      u_aoIntensity: gl.getUniformLocation(quadProgram, 'u_aoIntensity'),
      u_shadowK: gl.getUniformLocation(quadProgram, 'u_shadowK'),
      u_reflectionStr: gl.getUniformLocation(quadProgram, 'u_reflectionStr'),
      u_maxSteps: gl.getUniformLocation(quadProgram, 'u_maxSteps')
    };

    hideShaderError();
    return true;
  }

  function showShaderError(rawLog) {
    // Header line offset calculation
    const headerLines = GLSL_HEADER.split('\n').length;

    let formattedLog = rawLog.replace(/ERROR: 0:(\d+):/g, (match, p1) => {
      const actualLine = parseInt(p1, 10) - headerLines;
      return `Line ${actualLine > 0 ? actualLine : 1}:`;
    });

    dom.errorLog.textContent = formattedLog;
    dom.errorConsole.classList.remove('hidden');

    const statusInd = dom.editorStatus.querySelector('.status-indicator');
    const statusText = dom.editorStatus.querySelector('.status-text');
    statusInd.className = 'status-indicator error';
    statusText.textContent = 'Error';
  }

  function hideShaderError() {
    dom.errorConsole.classList.add('hidden');
    dom.errorLog.textContent = '';

    const statusInd = dom.editorStatus.querySelector('.status-indicator');
    const statusText = dom.editorStatus.querySelector('.status-text');
    statusInd.className = 'status-indicator success';
    statusText.textContent = 'Compiled';
  }

  // --- Orbit Camera Controls ---
  function getCameraPosition() {
    const x = camera.target[0] + camera.distance * Math.cos(camera.pitch) * Math.sin(camera.yaw);
    const y = camera.target[1] + camera.distance * Math.sin(camera.pitch);
    const z = camera.target[2] + camera.distance * Math.cos(camera.pitch) * Math.cos(camera.yaw);
    return [x, y, z];
  }

  function setupCameraEvents() {
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) camera.isDragging = true;
      else if (e.button === 2) camera.isPanning = true;
      camera.lastMouseX = e.clientX;
      camera.lastMouseY = e.clientY;
    });

    window.addEventListener('mouseup', () => {
      camera.isDragging = false;
      camera.isPanning = false;
    });

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('mousemove', (e) => {
      const dx = e.clientX - camera.lastMouseX;
      const dy = e.clientY - camera.lastMouseY;
      camera.lastMouseX = e.clientX;
      camera.lastMouseY = e.clientY;

      if (camera.isDragging) {
        camera.yaw -= dx * 0.005;
        camera.pitch += dy * 0.005;
        // Clamp pitch to avoid flipping
        const maxPitch = Math.PI / 2 - 0.01;
        camera.pitch = Math.max(-maxPitch, Math.min(maxPitch, camera.pitch));
      } else if (camera.isPanning) {
        const panSpeed = camera.distance * 0.001;
        camera.target[0] -= dx * panSpeed;
        camera.target[1] += dy * panSpeed;
      }
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      camera.distance += e.deltaY * 0.005;
      camera.distance = Math.max(1.0, Math.min(50.0, camera.distance));
    }, { passive: false });
  }

  // --- UI Event Handlers ---
  function setupUIEvents() {
    // Preset Dropdown
    dom.presetSelect.addEventListener('change', (e) => {
      loadPreset(e.target.value);
    });

    // Play / Pause
    dom.btnPlayPause.addEventListener('click', togglePlayPause);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && document.activeElement !== dom.codeEditor) {
        e.preventDefault();
        togglePlayPause();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        compileCurrentEditorCode();
      }
    });

    // Reset Time
    dom.btnResetTime.addEventListener('click', () => {
      startTime = performance.now();
      timeOffset = 0;
    });

    // Export Screenshot
    dom.btnScreenshot.addEventListener('click', exportHighResPNG);

    // Toggle Floating UI Panels
    dom.btnTogglePanels.addEventListener('click', () => {
      dom.editorPanel.classList.toggle('hidden-panel');
      dom.controlsPanel.classList.toggle('hidden-panel');
    });

    // Line Numbers & Auto-Compile in Code Editor
    dom.codeEditor.addEventListener('input', () => {
      updateLineNumbers();
      if (dom.chkAutoCompile.checked) {
        clearTimeout(compileDebounceTimer);
        compileDebounceTimer = setTimeout(compileCurrentEditorCode, 600);
      }
    });

    dom.codeEditor.addEventListener('scroll', () => {
      dom.lineNumbers.scrollTop = dom.codeEditor.scrollTop;
    });

    // Support Tab Key in Editor
    dom.codeEditor.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = dom.codeEditor.selectionStart;
        const end = dom.codeEditor.selectionEnd;
        dom.codeEditor.value = dom.codeEditor.value.substring(0, start) + '  ' + dom.codeEditor.value.substring(end);
        dom.codeEditor.selectionStart = dom.codeEditor.selectionEnd = start + 2;
        updateLineNumbers();
      }
    });

    // Snippet Toolbar Buttons
    document.querySelectorAll('.btn-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        const snippetKey = btn.dataset.snippet;
        if (SNIPPETS[snippetKey]) {
          insertTextAtCursor(SNIPPETS[snippetKey]);
        }
      });
    });

    // Manual Compile & Reset Code
    dom.btnCompile.addEventListener('click', compileCurrentEditorCode);
    dom.btnResetCode.addEventListener('click', () => {
      loadPreset(dom.presetSelect.value);
    });

    // Sliders Label Updates
    setupSliderLink(dom.rngMaxSteps, dom.valMaxSteps, (v) => v);
    setupSliderLink(dom.rngAOIntensity, dom.valAOIntensity, (v) => parseFloat(v).toFixed(2));
    setupSliderLink(dom.rngShadowK, dom.valShadowK, (v) => parseFloat(v).toFixed(1));
    setupSliderLink(dom.rngReflectionStr, dom.valReflectionStr, (v) => parseFloat(v).toFixed(2));

    setupSliderLink(dom.rngLightIntensity, dom.valLightIntensity, (v) => parseFloat(v).toFixed(1));
    setupSliderLink(dom.rngLightX, dom.valLightX, (v) => parseFloat(v).toFixed(1));
    setupSliderLink(dom.rngLightY, dom.valLightY, (v) => parseFloat(v).toFixed(1));
    setupSliderLink(dom.rngLightZ, dom.valLightZ, (v) => parseFloat(v).toFixed(1));

    setupSliderLink(dom.rngFov, dom.valFov, (v) => `${v}°`);
    setupSliderLink(dom.rngTimeSpeed, dom.valTimeSpeed, (v) => `${parseFloat(v).toFixed(1)}x`);

    dom.selRenderScale.addEventListener('change', resizeCanvas);
    dom.btnResetCam.addEventListener('click', () => {
      camera.yaw = 0.8;
      camera.pitch = 0.35;
      camera.distance = 6.0;
      camera.target = [0.0, 0.3, 0.0];
    });
  }

  function setupSliderLink(slider, valSpan, formatFn) {
    slider.addEventListener('input', (e) => {
      valSpan.textContent = formatFn(e.target.value);
    });
  }

  function togglePlayPause() {
    isPlaying = !isPlaying;
    if (isPlaying) {
      startTime = performance.now() - timeOffset;
      dom.iconPause.classList.remove('hidden');
      dom.iconPlay.classList.add('hidden');
    } else {
      timeOffset = performance.now() - startTime;
      dom.iconPause.classList.add('hidden');
      dom.iconPlay.classList.remove('hidden');
    }
  }

  function updateLineNumbers() {
    const lines = dom.codeEditor.value.split('\n').length;
    let numbersHtml = '';
    for (let i = 1; i <= lines; i++) {
      numbersHtml += i + '<br>';
    }
    dom.lineNumbers.innerHTML = numbersHtml;
  }

  function insertTextAtCursor(text) {
    const start = dom.codeEditor.selectionStart;
    const end = dom.codeEditor.selectionEnd;
    const val = dom.codeEditor.value;
    dom.codeEditor.value = val.substring(0, start) + text + val.substring(end);
    dom.codeEditor.selectionStart = dom.codeEditor.selectionEnd = start + text.length;
    updateLineNumbers();
    if (dom.chkAutoCompile.checked) {
      compileCurrentEditorCode();
    }
  }

  function loadPreset(presetKey) {
    if (PRESETS[presetKey]) {
      dom.codeEditor.value = PRESETS[presetKey];
      updateLineNumbers();
      compileCurrentEditorCode();
    }
  }

  function compileCurrentEditorCode() {
    compileShaderPipeline(dom.codeEditor.value);
  }

  // --- Utility Color Hex to RGB Normalized ---
  function hexToRgb(hex) {
    const bigint = parseInt(hex.replace('#', ''), 16);
    return [(bigint >> 16 & 255) / 255, (bigint >> 8 & 255) / 255, (bigint & 255) / 255];
  }

  // --- High Resolution PNG Screenshot Exporter ---
  function exportHighResPNG() {
    // Save current scale
    const originalWidth = canvas.width;
    const originalHeight = canvas.height;

    // Set temporary high resolution
    const exportWidth = 2560;
    const exportHeight = 1440;
    canvas.width = exportWidth;
    canvas.height = exportHeight;
    gl.viewport(0, 0, exportWidth, exportHeight);

    // Render single high-res frame
    drawFrame(getElapsedSeconds());

    // Generate PNG Data URL and download
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `SDF_Raymarcher_${Date.now()}.png`;
    link.href = dataUrl;
    link.click();

    // Restore viewport size
    canvas.width = originalWidth;
    canvas.height = originalHeight;
    gl.viewport(0, 0, originalWidth, originalHeight);
  }

  function getElapsedSeconds() {
    const speed = parseFloat(dom.rngTimeSpeed.value);
    if (isPlaying) {
      return ((performance.now() - startTime) / 1000) * speed;
    } else {
      return (timeOffset / 1000) * speed;
    }
  }

  // --- Main Render Loop ---
  function drawFrame(elapsedTime) {
    if (!quadProgram) return;

    gl.useProgram(quadProgram);
    gl.bindVertexArray(quadVao);

    // Camera Calculation
    const camPos = getCameraPosition();

    // Orbiting Light logic if checked
    let lightX = parseFloat(dom.rngLightX.value);
    let lightZ = parseFloat(dom.rngLightZ.value);
    if (dom.chkOrbitLight.checked) {
      const radius = 5.0;
      lightX = Math.cos(elapsedTime * 0.8) * radius;
      lightZ = Math.sin(elapsedTime * 0.8) * radius;
    }

    // Set Uniforms
    gl.uniform2f(uniforms.u_resolution, canvas.width, canvas.height);
    gl.uniform1f(uniforms.u_time, elapsedTime);

    gl.uniform3fv(uniforms.u_camPos, camPos);
    gl.uniform3fv(uniforms.u_camTarget, camera.target);
    gl.uniform1f(uniforms.u_fov, parseFloat(dom.rngFov.value));

    gl.uniform3f(uniforms.u_lightPos, lightX, parseFloat(dom.rngLightY.value), lightZ);
    gl.uniform3fv(uniforms.u_lightColor, hexToRgb(dom.clrLight.value));
    gl.uniform1f(uniforms.u_lightIntensity, parseFloat(dom.rngLightIntensity.value));

    gl.uniform3fv(uniforms.u_bgColor1, hexToRgb(dom.clrBg1.value));
    gl.uniform3fv(uniforms.u_bgColor2, hexToRgb(dom.clrBg2.value));

    gl.uniform1i(uniforms.u_enableAO, dom.chkAO.checked ? 1 : 0);
    gl.uniform1i(uniforms.u_enableShadows, dom.chkShadows.checked ? 1 : 0);
    gl.uniform1i(uniforms.u_enableReflections, dom.chkReflections.checked ? 1 : 0);

    gl.uniform1f(uniforms.u_aoIntensity, parseFloat(dom.rngAOIntensity.value));
    gl.uniform1f(uniforms.u_shadowK, parseFloat(dom.rngShadowK.value));
    gl.uniform1f(uniforms.u_reflectionStr, parseFloat(dom.rngReflectionStr.value));
    gl.uniform1i(uniforms.u_maxSteps, parseInt(dom.rngMaxSteps.value, 10));

    // Draw full-screen quad
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    gl.bindVertexArray(null);
  }

  function renderLoop(now) {
    const elapsedTime = getElapsedSeconds();

    drawFrame(elapsedTime);

    // Update FPS & Frame Time Counter
    frameCount++;
    if (now - fpsLastCheck >= 500) {
      const fps = Math.round((frameCount * 1000) / (now - fpsLastCheck));
      const frameMs = ((now - lastTime)).toFixed(1);
      dom.fpsCounter.textContent = `${fps} FPS`;
      dom.frameTime.textContent = `${frameMs}ms`;
      fpsLastCheck = now;
      frameCount = 0;
    }
    lastTime = now;

    animationFrameId = requestAnimationFrame(renderLoop);
  }
})();
