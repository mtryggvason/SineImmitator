// Records from the microphone with MediaRecorder and decodes the result into
// an AudioBuffer. Replaces the old ScriptProcessorNode + worker recorder.

export class Recorder {
  #stream = null;
  #mediaRecorder = null;
  #chunks = [];

  constructor(context) {
    this.context = context;
  }

  get isRecording() {
    return this.#mediaRecorder?.state === 'recording';
  }

  async start() {
    this.#stream ??= await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    this.#chunks = [];
    this.#mediaRecorder = new MediaRecorder(this.#stream);
    this.#mediaRecorder.ondataavailable = (e) => {
      if (e.data.size) this.#chunks.push(e.data);
    };
    this.#mediaRecorder.start();
  }

  /** @returns {Promise<AudioBuffer|null>} */
  async stop() {
    const recorder = this.#mediaRecorder;
    if (!recorder || recorder.state === 'inactive') return null;
    const stopped = new Promise((resolve) => (recorder.onstop = resolve));
    recorder.stop();
    await stopped;

    const blob = new Blob(this.#chunks, { type: recorder.mimeType });
    if (!blob.size) return null;
    return this.context.decodeAudioData(await blob.arrayBuffer());
  }
}
