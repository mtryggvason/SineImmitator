import { Synthesizer, MAX_OSCILLATORS } from './synthesizer.js';
import { findPeaks, toPartials } from './analysis.js';
import { PartialTracker } from './partial-tracker.js';

export const FFT_SIZE = 4096;

/**
 * Plays a recording either as-is ("original") or re-synthesized with sine
 * waves ("sine"), or shows a live input ("monitor") without playing it.
 * The signal is analysed every animation frame and `onFrame(spectrum, partials)`
 * is called so the UI can draw it.
 */
export class Player {
  #current = null; // AudioBufferSourceNode or MediaStreamAudioSourceNode
  #rafId = 0;

  constructor(context, { onFrame = () => {}, onStop = () => {} } = {}) {
    this.context = context;
    this.onFrame = onFrame;
    this.onStop = onStop;
    this.mode = null;
    this.voiceCount = 8;

    this.analyser = new AnalyserNode(context, {
      fftSize: FFT_SIZE,
      smoothingTimeConstant: 0.6,
      minDecibels: -100,
      maxDecibels: -10,
    });
    this.spectrum = new Float32Array(this.analyser.frequencyBinCount).fill(-Infinity);

    this.synth = new Synthesizer(context, MAX_OSCILLATORS);
    this.synth.output.connect(context.destination);
    this.tracker = new PartialTracker(this.synth.size);
  }

  get maxVoices() {
    return this.synth.size;
  }

  /** @param {AudioBuffer} buffer  @param {'sine'|'original'} mode */
  async play(buffer, mode) {
    await this.context.resume();
    this.stop();

    const source = new AudioBufferSourceNode(this.context, { buffer });
    source.connect(this.analyser);
    if (mode === 'original') source.connect(this.context.destination);
    else this.synth.setVolume(1);

    source.onended = () => this.stop();
    source.start();
    this.#current = source;
    this.mode = mode;
    this.#tick();
  }

  /** Analyses a live stream (e.g. the mic while recording) without playing it. */
  monitor(stream) {
    this.stop();
    const source = new MediaStreamAudioSourceNode(this.context, { mediaStream: stream });
    source.connect(this.analyser);
    this.#current = source;
    this.mode = 'monitor';
    this.#tick();
  }

  /** Loudest absolute sample in the analyser's current window (0–1). */
  peakLevel() {
    const samples = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(samples);
    return samples.reduce((peak, x) => Math.max(peak, Math.abs(x)), 0);
  }

  stop() {
    const source = this.#current;
    if (!source) return;
    this.#current = null;
    this.mode = null;
    source.onended = null;
    try { source.stop?.(); } catch { /* already stopped */ }
    source.disconnect();

    cancelAnimationFrame(this.#rafId);
    this.synth.silence();
    this.tracker.reset();
    this.spectrum.fill(-Infinity);
    this.onFrame(this.spectrum, []);
    this.onStop();
  }

  #tick = () => {
    this.analyser.getFloatFrequencyData(this.spectrum);
    const peaks = findPeaks(this.spectrum, this.context.sampleRate, FFT_SIZE, this.voiceCount);
    const partials = toPartials(peaks);
    if (this.mode === 'sine') this.synth.setPartials(this.tracker.assign(partials));
    this.onFrame(this.spectrum, partials);
    this.#rafId = requestAnimationFrame(this.#tick);
  };
}
