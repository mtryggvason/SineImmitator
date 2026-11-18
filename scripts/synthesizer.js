// A bank of always-running sine oscillators whose frequency and gain are
// steered in real time. Parameter changes are smoothed to avoid clicks.

export const MAX_OSCILLATORS = 128;
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

  /**
   * @param {({frequency:number, gain:number, onset?:boolean}|null)[]} partials
   *   one entry per voice (by index); null/missing fades that voice out.
   *   onset = the voice was silent, so jump straight to the new frequency
   *   instead of gliding there from wherever it was.
   */
  setPartials(partials) {
    const now = this.context.currentTime;
    this.voices.forEach((voice, i) => {
      const partial = partials[i];
      if (partial) {
        const { frequency } = voice.osc;
        if (partial.onset) {
          frequency.cancelScheduledValues(now);
          frequency.setValueAtTime(partial.frequency, now);
        } else {
          frequency.setTargetAtTime(partial.frequency, now, SMOOTHING);
        }
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
