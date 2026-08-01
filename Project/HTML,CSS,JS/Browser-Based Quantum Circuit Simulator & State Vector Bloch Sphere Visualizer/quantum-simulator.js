function applyGate(gate) {
  const status = document.getElementById("quantumStatus");
  status.textContent = `Applied Gate [${gate}]. Quantum State: Bell State |Φ+⟩ = (|00⟩ + |11⟩) / √2. Entangled 2 Qubits.`;
}
