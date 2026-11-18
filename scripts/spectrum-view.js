// Draws a magnitude spectrum on a log-frequency axis, with the chosen sine
// partials marked on top. Colors come from CSS custom properties.

const MIN_HZ = 20;
const MAX_HZ = 20000;
const GRID_HZ = [50, 100, 200, 500, 1000, 2000, 5000, 10000];

export class SpectrumView {
  #spectrum = new Float32Array(0);
  #partials = [];

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
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => this.#render());
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
    this.canvas.width = Math.round(this.canvas.clientWidth * dpr);
    this.canvas.height = Math.round(this.canvas.clientHeight * dpr);
    this.#render();
  }

  #x(hz) {
    return (Math.log(hz / MIN_HZ) / Math.log(MAX_HZ / MIN_HZ)) * this.canvas.width;
  }

  #y(db) {
    const t = (db - this.minDb) / (this.maxDb - this.minDb);
    return this.canvas.height * (1 - Math.max(0, Math.min(1, t)));
  }

  #render() {
    const { g, canvas } = this;
    const W = canvas.width;
    const H = canvas.height;
    const dpr = window.devicePixelRatio || 1;
    const css = getComputedStyle(canvas);
    const color = (name) => css.getPropertyValue(name).trim();

    g.clearRect(0, 0, W, H);

    // Grid + frequency labels
    g.font = `${11 * dpr}px ui-sans-serif, system-ui, sans-serif`;
    g.textBaseline = 'bottom';
    for (const hz of GRID_HZ) {
      const x = this.#x(hz);
      g.fillStyle = color('--grid');
      g.fillRect(Math.round(x), 0, dpr, H);
      g.fillStyle = color('--muted');
      g.fillText(hz >= 1000 ? `${hz / 1000}k` : String(hz), x + 4 * dpr, H - 4 * dpr);
    }

    // Spectrum of the source
    g.beginPath();
    g.moveTo(0, H);
    for (let i = 1; i < this.#spectrum.length; i++) {
      const hz = i * this.binHz;
      if (hz >= MIN_HZ) g.lineTo(this.#x(hz), this.#y(this.#spectrum[i]));
    }
    g.lineTo(W, H);
    g.closePath();
    g.fillStyle = color('--spectrum');
    g.fill();

    // Chosen sine partials
    g.fillStyle = color('--accent');
    for (const p of this.#partials) {
      const x = this.#x(p.frequency);
      const y = this.#y(p.db);
      g.fillRect(x - dpr, y, 2 * dpr, H - y);
      g.beginPath();
      g.arc(x, y, 3.5 * dpr, 0, Math.PI * 2);
      g.fill();
    }
  }
}
