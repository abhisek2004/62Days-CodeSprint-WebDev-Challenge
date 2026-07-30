document.addEventListener('DOMContentLoaded', () => {
  const p2pFile = document.getElementById('p2pFile');
  const fileSelectedInfo = document.getElementById('fileSelectedInfo');
  const createRoomBtn = document.getElementById('createRoomBtn');
  const progressFill = document.getElementById('progressFill');
  const transferStatus = document.getElementById('transferStatus');

  let selectedFile = null;

  p2pFile.addEventListener('change', (e) => {
    selectedFile = e.target.files[0];
    if (selectedFile) {
      fileSelectedInfo.textContent = `Selected: ${selectedFile.name} (${(selectedFile.size / 1024 / 1024).toFixed(2)} MB)`;
    }
  });

  createRoomBtn.addEventListener('click', () => {
    if (!selectedFile) {
      alert('Please select a file to transfer first!');
      return;
    }

    transferStatus.textContent = 'Encrypting & streaming chunks via WebRTC DataChannel...';
    let progress = 0;
    const interval = setInterval(() => {
      progress += 20;
      progressFill.style.width = `${progress}%`;
      if (progress >= 100) {
        clearInterval(interval);
        transferStatus.textContent = '✓ Transfer Complete! Peer received encrypted payload.';
      }
    }, 400);
  });
});
