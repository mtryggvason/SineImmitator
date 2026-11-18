// Dot-matrix spectrum display. The spectrum is drawn on a log-frequency axis
// as columns of lit dots with a falling peak-hold dot; the chosen sine
// partials light up their columns in the accent colour. Colours come from
// CSS custom properties on the canvas.

const MIN_HZ = 20;
const MAX_HZ = 20000;
const LABELS_HZ = [50, 100, 200, 500, 1000, 2000, 5000, 10000];

const CELL = 7; // CSS px between dot centres
const DOT_RADIUS = 2.3; // CSS px
const LABEL_HEIGHT = 18; // CSS px reserved under the matrix
const PEAK_FALL = 0.35; // rows per frame

export class SpectrumView {
  #spectrum = new Float32Array(0);
  #partials = [];
  #layout = null;
  #colors = null;
  #peakHold = new Float32Array(0);

  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{binHz:number, minDb:number, maxDb:number}} scale
   */
  constructor(canvas, { binHz, minDb, maxDb }) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.binHz = binHz;
    this.minDb = minDb;
    this.maxDb = maxDb;

    new ResizeObserver(() => this.#resize()).observe(canvas);
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      this.#colors = null;
      this.#render();
    });
    this.#resize();
  }

  /** @param {Float32Array} spectrum  @param {{frequency:number, db:number}[]} partials */
  draw(spectrum, partials) {
    this.#spectrum = spectrum;
    this.#partials = partials;
    this.#render();
  }

  #resize() {
    const dpr = window.devicePixelRatio || 1;
    const { clientWidth: w, clientHeight: h } = this.canvas;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);

    const cols = Math.max(1, Math.floor(w / CELL));
    const rows = Math.max(1, Math.floor((h - LABEL_HEIGHT) / CELL));
    const left = (w - cols * CELL) / 2;

    // Spectrum bins covered by each column (log-spaced; at least one bin).
    const binRanges = Array.from({ length: cols }, (_, c) => {
      const lo = Math.floor(this.#hzAt(c / cols) / this.binHz);
      const hi = Math.floor(this.#hzAt((c + 1) / cols) / this.binHz);
      return [Math.max(1, lo), Math.max(1, lo, hi)];
    });

    this.#layout = { dpr, cols, rows, left, binRanges };
    this.#peakHold = new Float32Array(cols);
    this.#render();
  }

  #hzAt(t) {
    return MIN_HZ * (MAX_HZ / MIN_HZ) ** t;
  }

  #columnFor(hz) {
    const t = Math.log(hz / MIN_HZ) / Math.log(MAX_HZ / MIN_HZ);
    return Math.floor(t * this.#layout.cols);
  }

  /** dB -> number of lit rows */
  #rowsFor(db) {
    const t = (db - this.minDb) / (this.maxDb - this.minDb);
    return Math.round(Math.max(0, Math.min(1, t)) * this.#layout.rows);
  }

  #getColors() {
    const css = getComputedStyle(this.canvas);
    const v = (name) => css.getPropertyValue(name).trim();
    return {
      off: v('--dot-off'),
      on: v('--dot-on'),
      peak: v('--dot-peak'),
      sine: v('--dot-sine'),
      label: v('--screen-text'),
      mono: v('--mono'),
    };
  }

  #render() {
    if (!this.#layout) return;
    const { g } = this;
    const { dpr, cols, rows, left, binRanges } = this.#layout;
    const colors = (this.#colors ??= this.#getColors());
    const spectrum = this.#spectrum;

    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, this.canvas.width / dpr, this.canvas.height / dpr);

    // Level per column (loudest bin in its range) and peak hold.
    const level = new Int16Array(cols);
    for (let c = 0; c < cols; c++) {
      const [lo, hi] = binRanges[c];
      let db = -Infinity;
      for (let i = lo; i <= hi && i < spectrum.length; i++) db = Math.max(db, spectrum[i]);
      level[c] = this.#rowsFor(db);
      this.#peakHold[c] = Math.max(level[c], this.#peakHold[c] - PEAK_FALL);
    }

    // Partial columns: height of the loudest partial landing in each column.
    const sine = new Int16Array(cols).fill(-1);
    for (const p of this.#partials) {
      const c = this.#columnFor(p.frequency);
      if (c >= 0 && c < cols) sine[c] = Math.max(sine[c], this.#rowsFor(p.db));
    }

    const dot = (c, r, color) => {
      g.fillStyle = color;
      g.beginPath();
      g.arc(left + c * CELL + CELL / 2, (rows - r - 0.5) * CELL, DOT_RADIUS, 0, Math.PI * 2);
      g.fill();
    };

    for (let c = 0; c < cols; c++) {
      const peak = Math.round(this.#peakHold[c]) - 1;
      for (let r = 0; r < rows; r++) {
        let color = colors.off;
        if (r < sine[c]) color = colors.sine;
        else if (r < level[c]) color = colors.on;
        else if (r === peak && peak >= 0) color = colors.peak;
        dot(c, r, color);
      }
    }

    // Frequency labels, snapped to the column they belong to.
    g.font = `10px ${colors.mono}`;
    g.textBaseline = 'bottom';
    g.textAlign = 'center';
    g.fillStyle = colors.label;
    const labelY = rows * CELL + LABEL_HEIGHT;
    let lastRight = -Infinity;
    for (const hz of LABELS_HZ) {
      const text = hz >= 1000 ? `${hz / 1000}K` : String(hz);
      const x = left + this.#columnFor(hz) * CELL + CELL / 2;
      const half = g.measureText(text).width / 2;
      if (x - half < lastRight + 8) continue; // skip labels that would collide on narrow screens
      g.fillText(text, x, labelY);
      lastRight = x + half;
    }
  }
}
