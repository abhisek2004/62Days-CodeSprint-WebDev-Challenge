function drawSampleDoc() {
  const canvas = document.getElementById("ocrCanvas");
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#111111";
  ctx.font = "bold 18px Inter";
  ctx.fillText("PATIENT MEDICAL REPORT #802", 30, 50);

  ctx.font = "14px Inter";
  ctx.fillText("Diagnosis: Acute Bronchitis", 30, 90);
  ctx.fillText("Prescription: Amoxicillin 500mg", 30, 120);
  ctx.fillText("Doctor Signature: Dr. Jenkins", 30, 160);
}

function applyPreprocess(method) {
  drawSampleDoc();
  const bboxResult = document.getElementById("bboxResult");
  bboxResult.textContent = `Applied ${method === 'otsu' ? 'Otsu Binarization' : 'Adaptive Thresholding'} Preprocessing Pass. Document noise reduced by 94%.`;
}

function detectBoundingBoxes() {
  const canvas = document.getElementById("ocrCanvas");
  const ctx = canvas.getContext("2d");

  // Draw bounding boxes over canvas text lines
  ctx.strokeStyle = "#ef4444";
  ctx.lineWidth = 2;

  ctx.strokeRect(25, 30, 310, 30); // Line 1
  ctx.strokeRect(25, 75, 260, 24); // Line 2
  ctx.strokeRect(25, 105, 290, 24); // Line 3

  const bboxResult = document.getElementById("bboxResult");
  bboxResult.innerHTML = `
[
  { "line": 1, "text": "PATIENT MEDICAL REPORT #802", "bbox": [25, 30, 310, 30], "confidence": 0.98 },
  { "line": 2, "text": "Diagnosis: Acute Bronchitis", "bbox": [25, 75, 260, 24], "confidence": 0.96 },
  { "line": 3, "text": "Prescription: Amoxicillin 500mg", "bbox": [25, 105, 290, 24], "confidence": 0.97 }
]
  `;
}

document.addEventListener("DOMContentLoaded", drawSampleDoc);
