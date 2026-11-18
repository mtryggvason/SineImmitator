import { Synthesizer, MAX_OSCILLATORS } from './Synthesizer.js';
import { Recorder } from './Recorder.js';
import { findPeaks } from './analysis.js';

const FFT_SIZE = 4096;
// AnalyserNode applies a Blackman window (coherent gain ≈ 0.42) and scales by
// 1/N, so a full-scale sine reads ≈ 0.21 linear. Compensate to get real amplitude.
const WINDOW_CORRECTION = 1 / 0.21;
const MIN_HZ = 20;
const MAX_HZ = 20000;

export class App {
  constructor(root) {
    this.el = {
      record: root.querySelector('.js-record'),
      count: root.querySelector('.js-count'),
      countValue: root.querySelector('.js-count-value'),
      list: root.querySelector('.js-recordings'),
      empty: root.querySelector('.js-empty'),
      status: root.querySelector('.js-status'),
      canvas: root.querySelector('canvas'),
    };
    this.ctx2d = this.el.canvas.getContext('2d');

    this.context = new AudioContext();
    this.analyser = new AnalyserNode(this.context, {
      fftSize: FFT_SIZE,
      smoothingTimeConstant: 0.6,
      minDecibels: -100,
      maxDecibels: -10,
    });
    this.spectrum = new Float32Array(this.analyser.frequencyBinCount).fill(-Infinity);
    this.synth = new Synthesizer(this.context, MAX_OSCILLATORS);
    this.synth.output.connect(this.context.destination);
    this.recorder = new Recorder(this.context);

    this.recordings = [];
    this.current = null; // { source, mode, item }
    this.partials = [];
    this.rafId = 0;
    this.oscCount = Number(this.el.count.value);
  }

  init() {
    this.el.count.max = String(MAX_OSCILLATORS);
    this.el.count.addEventListener('input', () => {
      this.oscCount = Number(this.el.count.value);
      this.el.countValue.textContent = this.oscCount;
    });
    this.el.countValue.textContent = this.oscCount;
    this.el.record.addEventListener('click', () => this.toggleRecording());

    new ResizeObserver(() => this.resizeCanvas()).observe(this.el.canvas);
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.draw());
    this.resizeCanvas();
  }

  // ---------------------------------------------------------------- recording

  async toggleRecording() {
    await this.context.resume(); // browsers start AudioContext suspended until a user gesture
    if (this.recorder.isRecording) {
      this.setRecordingUi(false);
      this.setStatus('Processing…');
      const buffer = await this.recorder.stop();
      if (!buffer) return this.setStatus('Nothing was recorded.');
      this.addRecording(buffer);
    } else {
      this.stopPlayback();
      try {
        await this.recorder.start();
        this.setRecordingUi(true);
        this.setStatus('Recording… make some noise.');
      } catch (err) {
        console.error(err);
        this.setStatus('Microphone access was denied or is unavailable.');
      }
    }
  }

  setRecordingUi(recording) {
    this.el.record.classList.toggle('is-recording', recording);
    this.el.record.querySelector('span').textContent = recording ? 'Stop' : 'Record';
    this.el.record.setAttribute('aria-pressed', String(recording));
  }

  addRecording(buffer) {
    const index = this.recordings.length + 1;
    const item = document.createElement('li');
    item.className = 'recording';
    item.innerHTML = `
      <div class="recording__meta">
        <span class="recording__name">Recording ${index}</span>
        <span class="recording__duration">${buffer.duration.toFixed(1)}s</span>
      </div>
      <div class="recording__actions">
        <button type="button" class="chip" data-mode="sine">Sines</button>
        <button type="button" class="chip chip--ghost" data-mode="original">Original</button>
      </div>`;
    item.addEventListener('click', (e) => {
      const button = e.target.closest('button[data-mode]');
      if (button) this.play(buffer, button.dataset.mode, item);
    });

    this.recordings.push(buffer);
    this.el.empty.hidden = true;
    this.el.list.prepend(item);
    this.play(buffer, 'sine', item);
  }

  // ----------------------------------------------------------------- playback

  async play(buffer, mode, item) {
    await this.context.resume();
    this.stopPlayback();

    const source = new AudioBufferSourceNode(this.context, { buffer });
    source.connect(this.analyser);
    if (mode === 'original') {
      source.connect(this.context.destination);
    } else {
      this.synth.setVolume(1);
    }

    this.current = { source, mode, item };
    item.classList.add('is-playing');
    item.dataset.playing = mode;
    this.setStatus(mode === 'original' ? 'Playing the original recording.' : 'Playing the sine-wave imitation.');

    source.onended = () => {
      if (this.current?.source === source) this.stopPlayback();
    };
    source.start();
    this.loop();
  }

  stopPlayback() {
    if (!this.current) return;
    const { source, item } = this.current;
    this.current = null;
    source.onended = null;
    try { source.stop(); } catch { /* already stopped */ }
    source.disconnect();
    item.classList.remove('is-playing');
    delete item.dataset.playing;
    this.synth.silence();
    cancelAnimationFrame(this.rafId);
    this.partials = [];
    this.spectrum.fill(-Infinity);
    this.draw();
    this.setStatus('');
  }

  loop = () => {
    this.analyser.getFloatFrequencyData(this.spectrum);
    const peaks = findPeaks(this.spectrum, this.context.sampleRate, FFT_SIZE, this.oscCount);

    // Keep the sum of amplitudes ≤ 1 so stacking many sines can't clip.
    const amps = peaks.map((p) => p.amplitude * WINDOW_CORRECTION);
    const total = amps.reduce((s, a) => s + a, 0);
    const norm = total > 1 ? 1 / total : 1;
    this.partials = peaks.map((p, i) => ({ frequency: p.frequency, gain: amps[i] * norm, db: p.db }));

    if (this.current?.mode === 'sine') this.synth.setPartials(this.partials);
    this.draw();
    this.rafId = requestAnimationFrame(this.loop);
  };

  // -------------------------------------------------------------- drawing

  resizeCanvas() {
    const { canvas } = this.el;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    this.draw();
  }

  draw() {
    const { canvas } = this.el;
    const g = this.ctx2d;
    const W = canvas.width;
    const H = canvas.height;
    const dpr = window.devicePixelRatio || 1;
    const css = getComputedStyle(canvas);
    const color = (name) => css.getPropertyValue(name).trim();
    const { minDecibels: minDb, maxDecibels: maxDb } = this.analyser;
    const binHz = this.context.sampleRate / FFT_SIZE;

    const xFor = (hz) => (Math.log(hz / MIN_HZ) / Math.log(MAX_HZ / MIN_HZ)) * W;
    const yFor = (db) => H - Math.max(0, Math.min(1, (db - minDb) / (maxDb - minDb))) * H;

    g.clearRect(0, 0, W, H);

    // Grid + frequency labels
    g.font = `${11 * dpr}px ui-sans-serif, system-ui, sans-serif`;
    g.textBaseline = 'bottom';
    for (const hz of [50, 100, 200, 500, 1000, 2000, 5000, 10000]) {
      const x = xFor(hz);
      g.fillStyle = color('--grid');
      g.fillRect(Math.round(x), 0, dpr, H);
      g.fillStyle = color('--muted');
      g.fillText(hz >= 1000 ? `${hz / 1000}k` : String(hz), x + 4 * dpr, H - 4 * dpr);
    }

    // Spectrum of the source
    g.beginPath();
    g.moveTo(0, H);
    for (let i = 1; i < this.spectrum.length; i++) {
      const hz = i * binHz;
      if (hz < MIN_HZ) continue;
      g.lineTo(xFor(hz), yFor(this.spectrum[i]));
    }
    g.lineTo(W, H);
    g.closePath();
    g.fillStyle = color('--spectrum');
    g.fill();

    // Chosen sine partials
    g.fillStyle = color('--accent');
    for (const p of this.partials) {
      const x = xFor(p.frequency);
      const y = yFor(p.db);
      g.fillRect(x - dpr, y, 2 * dpr, H - y);
      g.beginPath();
      g.arc(x, y, 3.5 * dpr, 0, Math.PI * 2);
      g.fill();
    }
  }

  setStatus(text) {
    this.el.status.textContent = text;
  }
}
