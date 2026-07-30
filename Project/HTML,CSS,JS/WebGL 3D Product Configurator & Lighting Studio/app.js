document.addEventListener('DOMContentLoaded', () => {
  const container = document.querySelector('.canvas-container');
  const canvas = document.getElementById('webglCanvas');

  // Three.js Scene Setup
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0f172a);

  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
  camera.position.set(0, 0, 5);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;

  // Create 3D Product Mesh (TorusKnot / Custom Geometry)
  const geometry = new THREE.TorusKnotGeometry(0.8, 0.28, 128, 32);
  const material = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.3,
    metalness: 0.7
  });
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  // Studio Lighting
  const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
  dirLight.position.set(5, 5, 5);
  scene.add(dirLight);

  const ambLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambLight);

  // Orbit controls variables
  let isDragging = false;
  let previousMousePosition = { x: 0, y: 0 };

  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const deltaMove = { x: e.clientX - previousMousePosition.x, y: e.clientY - previousMousePosition.y };

    mesh.rotation.y += deltaMove.x * 0.01;
    mesh.rotation.x += deltaMove.y * 0.01;

    previousMousePosition = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener('mouseup', () => { isDragging = false; });

  // Render Loop
  function animate() {
    requestAnimationFrame(animate);
    if (!isDragging) {
      mesh.rotation.y += 0.005;
    }
    renderer.render(scene, camera);
  }
  animate();

  // Control Listeners
  document.getElementById('colorPicker').addEventListener('input', (e) => {
    material.color.set(e.target.value);
  });

  document.getElementById('roughnessSlider').addEventListener('input', (e) => {
    material.roughness = parseFloat(e.target.value);
    document.getElementById('roughnessVal').textContent = e.target.value;
  });

  document.getElementById('metalnessSlider').addEventListener('input', (e) => {
    material.metalness = parseFloat(e.target.value);
    document.getElementById('metalnessVal').textContent = e.target.value;
  });

  document.getElementById('lightIntensitySlider').addEventListener('input', (e) => {
    dirLight.intensity = parseFloat(e.target.value);
  });

  document.getElementById('studioPresetSelect').addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'warm') {
      dirLight.color.setHex(0xffaa55);
      scene.background.setHex(0x1a0f0f);
    } else if (val === 'cool') {
      dirLight.color.setHex(0x00ffff);
      scene.background.setHex(0x050f1a);
    } else {
      dirLight.color.setHex(0xffffff);
      scene.background.setHex(0x0f172a);
    }
  });

  document.getElementById('snapshotBtn').addEventListener('click', () => {
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `3d-product-snapshot-${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  });
});
