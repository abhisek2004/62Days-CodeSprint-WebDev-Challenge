let pc = 4;
function stepInstruction() {
  pc += 4;
  const status = document.getElementById("cpuRegisters");
  status.textContent = `Executed ADDI x10, x10, 1 | PC: 0x${pc.toString(16).padStart(8, '0').toUpperCase()} | x10 (a0): ${55 + pc/4}`;
}
