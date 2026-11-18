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

// AnalyserNode applies a Blackman window (coherent gain ≈ 0.42) and scales by
// 1/N, so a full-scale sine reads ≈ 0.21 linear. Compensate to get real amplitude.
const WINDOW_CORRECTION = 1 / 0.21;

/**
 * Turns spectral peaks into oscillator settings. The sum of gains is kept ≤ 1
 * so stacking many sines can't clip.
 * @param {{frequency:number, amplitude:number, db:number}[]} peaks
 * @returns {{frequency:number, gain:number, db:number}[]}
 */
export function toPartials(peaks) {
  const amps = peaks.map((p) => p.amplitude * WINDOW_CORRECTION);
  const total = amps.reduce((sum, a) => sum + a, 0);
  const norm = total > 1 ? 1 / total : 1;
  return peaks.map((p, i) => ({ frequency: p.frequency, gain: amps[i] * norm, db: p.db }));
}
