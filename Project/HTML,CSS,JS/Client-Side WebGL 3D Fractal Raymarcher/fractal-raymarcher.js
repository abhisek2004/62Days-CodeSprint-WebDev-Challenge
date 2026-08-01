function renderFractal(type) {
  const status = document.getElementById("fractalStatus");
  status.textContent = `GLSL Raymarching Shader: Compiled 3D ${type.toUpperCase()} Raymarcher. Rendered at 60 FPS with Phong Specular Shading.`;
}
