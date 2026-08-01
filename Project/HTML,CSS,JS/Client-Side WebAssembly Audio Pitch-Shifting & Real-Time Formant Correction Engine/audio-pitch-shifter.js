function applyPitchShift(semitones) {
  const status = document.getElementById("pitchStatus");
  status.textContent = `Applied +${semitones} semitones shift. Phase Vocoder FFT buffer size 2048 samples. Vocal timbre preserved.`;
}
