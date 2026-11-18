// Records from the microphone with MediaRecorder and decodes the result into
// a peak-normalized AudioBuffer.

const TARGET_PEAK = 0.9;
const SILENCE = 1e-4;

export class Recorder {
  #stream = null;
  #mediaRecorder = null;
  #chunks = [];

  constructor(context) {
    this.context = context;
  }

  /** The live mic stream while recording, otherwise null. */
  get stream() {
    return this.#stream;
  }

  get isRecording() {
    return this.#mediaRecorder?.state === 'recording';
  }

  async start() {
    this.#stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.#chunks = [];
    this.#mediaRecorder = new MediaRecorder(this.#stream);
    this.#mediaRecorder.ondataavailable = (e) => {
      if (e.data.size) this.#chunks.push(e.data);
    };
    this.#mediaRecorder.start();
  }

  /** @returns {Promise<AudioBuffer|null>} null when nothing audible was recorded */
  async stop() {
    const recorder = this.#mediaRecorder;
    if (!recorder || recorder.state === 'inactive') return null;
    const stopped = new Promise((resolve) => (recorder.onstop = resolve));
    recorder.stop();
    await stopped;

    // Release the mic: an open input ducks playback in Safari and can route
    // output to the earpiece on iOS.
    this.#stream.getTracks().forEach((track) => track.stop());
    this.#stream = null;

    const blob = new Blob(this.#chunks, { type: recorder.mimeType });
    if (!blob.size) return null;
    const buffer = await this.context.decodeAudioData(await blob.arrayBuffer());
    return normalize(buffer);
  }
}

/** Scales the buffer in place so its loudest sample hits TARGET_PEAK. */
function normalize(buffer) {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  let peak = 0;
  for (const data of channels) {
    for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i]));
  }
  if (peak < SILENCE) return null;
  const gain = TARGET_PEAK / peak;
  for (const data of channels) {
    for (let i = 0; i < data.length; i++) data[i] *= gain;
  }
  return buffer;
}
