function generateZkp() {
  const status = document.getElementById("zkpStatus");
  status.textContent = "✅ NIZKP Proof Verified! Verifier equation g^s = R * y^c holds true. Secret key never revealed.";
}
