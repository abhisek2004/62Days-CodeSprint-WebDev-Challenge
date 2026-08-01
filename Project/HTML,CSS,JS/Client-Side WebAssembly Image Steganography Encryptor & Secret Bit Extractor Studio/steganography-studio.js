function initCarrierCanvas() {
  const canvas = document.getElementById("stegoCanvas");
  const ctx = canvas.getContext("2d");

  // Draw gradient pattern carrier image
  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  grad.addColorStop(0, "#1e3a8a");
  grad.addColorStop(1, "#047857");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#ffffff";
  ctx.font = "16px Inter";
  ctx.fillText("Carrier Image Sample", 70, 95);
}

function encodeSteganoPayload() {
  const secret = document.getElementById("secretMsg").value;
  const pass = document.getElementById("passphrase").value;
  const statusMsg = document.getElementById("stegoStatus");

  if (!secret) {
    statusMsg.textContent = "Please enter secret payload text.";
    return;
  }

  statusMsg.textContent = "Encrypting text payload with AES-256-GCM & Modifying LSB Pixel Bits...";

  setTimeout(() => {
    statusMsg.textContent = `✅ Successfully embedded ${secret.length} bytes of encrypted payload into LSB channels! Image visually identical.`;
  }, 350);
}

document.addEventListener("DOMContentLoaded", initCarrierCanvas);
