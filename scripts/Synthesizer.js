// A bank of always-running sine oscillators whose frequency and gain are
// steered in real time. Parameter changes are smoothed to avoid clicks.

export const MAX_OSCILLATORS = 64;
const SMOOTHING = 0.015; // seconds (time constant for setTargetAtTime)

export class Synthesizer {
  constructor(context, count = MAX_OSCILLATORS) {
    this.context = context;
    this.output = context.createGain();
    this.output.gain.value = 0;

    this.voices = Array.from({ length: count }, () => {
      const osc = new OscillatorNode(context, { type: 'sine', frequency: 440 });
      const gain = new GainNode(context, { gain: 0 });
      osc.connect(gain).connect(this.output);
      osc.start();
      return { osc, gain };
    });
  }

  get size() {
    return this.voices.length;
  }

  /** @param {{frequency:number, gain:number}[]} partials */
  setPartials(partials) {
    const now = this.context.currentTime;
    this.voices.forEach((voice, i) => {
      const partial = partials[i];
      if (partial) {
        voice.osc.frequency.setTargetAtTime(partial.frequency, now, SMOOTHING);
        voice.gain.gain.setTargetAtTime(partial.gain, now, SMOOTHING);
      } else {
        // Silence voices that aren't used this frame instead of leaving them ringing.
        voice.gain.gain.setTargetAtTime(0, now, SMOOTHING);
      }
    });
  }

  setVolume(value) {
    this.output.gain.setTargetAtTime(value, this.context.currentTime, SMOOTHING);
  }

  silence() {
    this.setPartials([]);
    this.setVolume(0);
  }
}
