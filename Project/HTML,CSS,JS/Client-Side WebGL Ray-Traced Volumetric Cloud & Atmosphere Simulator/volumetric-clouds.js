function updateSunPosition(hour) {
  const status = document.getElementById("cloudStatus");
  status.textContent = `Sun Azimuth: 240°, Elevation: 12° (${hour}:00 PM Sunset). Atmospheric Rayleigh Scattering rendered with orange/purple volumetric cloud rim lighting.`;
}
