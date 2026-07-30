document.addEventListener('DOMContentLoaded', () => {
  const imgFile = document.getElementById('imgFile');
  const targetFormat = document.getElementById('targetFormat');
  const qualitySlider = document.getElementById('qualitySlider');
  const qualityVal = document.getElementById('qualityVal');
  const canvas = document.getElementById('compressCanvas');
  const ctx = canvas.getContext('2d');
  const fileSizeInfo = document.getElementById('fileSizeInfo');
  const downloadImgBtn = document.getElementById('downloadImgBtn');

  let loadedImg = null;

  imgFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      loadedImg = new Image();
      loadedImg.onload = () => {
        canvas.width = loadedImg.width;
        canvas.height = loadedImg.height;
        compressImage();
      };
      loadedImg.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  function compressImage() {
    if (!loadedImg) return;
    ctx.drawImage(loadedImg, 0, 0);

    const quality = parseFloat(qualitySlider.value) / 100;
    const format = targetFormat.value;

    canvas.toBlob((blob) => {
      if (blob) {
        fileSizeInfo.textContent = `Size: ${(blob.size / 1024).toFixed(1)} KB`;
        downloadImgBtn.disabled = false;
        downloadImgBtn.onclick = () => {
          const a = document.createElement('a');
          a.download = `compressed-image.${format.split('/')[1]}`;
          a.href = URL.createObjectURL(blob);
          a.click();
        };
      }
    }, format, quality);
  }

  qualitySlider.addEventListener('input', (e) => {
    qualityVal.textContent = `${e.target.value}%`;
    compressImage();
  });

  targetFormat.addEventListener('change', compressImage);
});
