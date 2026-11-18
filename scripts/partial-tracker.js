// Keeps each oscillator ("voice") on the same partial from frame to frame.
//
// Without tracking, voice i simply takes the i-th strongest peak, so whenever
// two peaks swap rank both voices sweep across to each other's frequency,
// which is heard as chirps. Here each peak goes to the voice that was nearest
// in frequency last frame; peaks with no nearby voice start on an idle voice,
// which jumps straight to the new frequency while it is silent and fades in.

// A voice may follow a partial by at most this much per frame.
const MAX_GLIDE_CENTS = 100;

/**
 * @typedef {{frequency:number, gain:number, db:number}} Partial
 * @typedef {Partial & {onset:boolean}} VoicePartial  onset = voice was idle and starts fresh
 */

export class PartialTracker {
  /** @param {number} voiceCount */
  constructor(voiceCount) {
    // frequency is null while the voice is idle; idleFrames picks the quietest idle voice.
    this.voices = Array.from({ length: voiceCount }, () => ({ frequency: null, idleFrames: Infinity }));
  }

  reset() {
    for (const voice of this.voices) {
      voice.frequency = null;
      voice.idleFrames = Infinity;
    }
  }

  /**
   * @param {Partial[]} partials  this frame's partials, any order
   * @returns {(VoicePartial|null)[]}  one entry per voice; null = voice should fade out
   */
  assign(partials) {
    const result = new Array(this.voices.length).fill(null);
    const assigned = new Set();

    // 1. Continue existing partials: greedily match the closest (voice, partial) pairs.
    const candidates = [];
    this.voices.forEach((voice, v) => {
      if (voice.frequency === null) return;
      partials.forEach((partial, p) => {
        const distance = Math.abs(cents(partial.frequency, voice.frequency));
        if (distance <= MAX_GLIDE_CENTS) candidates.push({ v, p, distance });
      });
    });
    candidates.sort((a, b) => a.distance - b.distance);
    for (const { v, p } of candidates) {
      if (result[v] || assigned.has(p)) continue;
      result[v] = { ...partials[p], onset: false };
      assigned.add(p);
    }

    // 2. Start new partials on the voices that have been idle longest (fully faded out).
    const idle = this.voices
      .map((voice, v) => ({ v, idleFrames: voice.frequency === null ? voice.idleFrames : -1 }))
      .filter(({ v, idleFrames }) => idleFrames >= 0 && !result[v])
      .sort((a, b) => b.idleFrames - a.idleFrames);
    partials.forEach((partial, p) => {
      if (assigned.has(p) || !idle.length) return;
      result[idle.shift().v] = { ...partial, onset: true };
    });

    // 3. Update voice state. Voices left without a partial go idle and fade out.
    this.voices.forEach((voice, v) => {
      if (result[v]) {
        voice.frequency = result[v].frequency;
        voice.idleFrames = 0;
      } else {
        voice.frequency = null;
        voice.idleFrames += 1;
      }
    });
    return result;
  }
}

function cents(f1, f2) {
  return 1200 * Math.log2(f1 / f2);
}
