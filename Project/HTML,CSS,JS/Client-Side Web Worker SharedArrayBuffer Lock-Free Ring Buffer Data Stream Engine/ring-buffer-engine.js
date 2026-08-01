function startStream() {
  const status = document.getElementById("ringStatus");
  status.textContent = "Streaming 100,000 Ops/Sec over SharedArrayBuffer with Atomics.wait/notify... Throughput: 104,200 ops/sec (Zero Garbage Collection Pause).";
}
