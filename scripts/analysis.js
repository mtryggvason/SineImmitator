// Spectral peak picking: turns an FFT magnitude spectrum (in dB) into a list
// of sine partials (frequency + linear amplitude).

const NOISE_FLOOR_DB = -85;

/**
 * @param {Float32Array} spectrumDb  output of AnalyserNode.getFloatFrequencyData
 * @param {number} sampleRate
 * @param {number} fftSize
 * @param {number} maxPeaks
 * @returns {{frequency:number, amplitude:number, db:number}[]}
 */
export function findPeaks(spectrumDb, sampleRate, fftSize, maxPeaks) {
  const binHz = sampleRate / fftSize;
  const peaks = [];

  // Only local maxima count as partials, so neighbouring bins of the same
  // peak don't each grab an oscillator.
  for (let i = 1; i < spectrumDb.length - 1; i++) {
    const b = spectrumDb[i];
    if (b < NOISE_FLOOR_DB) continue;
    const a = spectrumDb[i - 1];
    const c = spectrumDb[i + 1];
    if (b > a && b >= c) {
      // Parabolic interpolation for sub-bin frequency accuracy.
      const denom = a - 2 * b + c;
      const offset = denom === 0 ? 0 : (0.5 * (a - c)) / denom;
      const db = b - 0.25 * (a - c) * offset;
      peaks.push({
        frequency: (i + offset) * binHz,
        db,
        amplitude: 10 ** (db / 20), // dB -> linear
      });
    }
  }

  peaks.sort((p, q) => q.db - p.db);
  return peaks.slice(0, maxPeaks);
}
