import { Recorder } from './recorder.js';
import { Player, FFT_SIZE } from './player.js';
import { SpectrumView } from './spectrum-view.js';
import { RecordingList } from './recording-list.js';

const SILENCE = 1e-4;
const SILENCE_CHECK_MS = 1500;

const STATUS = {
  recording: 'Recording… make some noise.',
  silentMic: (device) =>
    `No sound is coming from “${device}”. Check the input device and volume, and that your browser is allowed to use the microphone (macOS: System Settings › Privacy & Security › Microphone).`,
  processing: 'Processing…',
  empty: 'Nothing audible was recorded. Check your microphone.',
  micDenied: 'Microphone access was denied or is unavailable.',
  sine: 'Playing the sine-wave imitation.',
  original: 'Playing the original recording.',
};

/** Wires the page's controls to the recorder, player, spectrum view and list. */
export class App {
  constructor(root) {
    this.recordButton = root.querySelector('.js-record');
    this.countInput = root.querySelector('.js-count');
    this.countOutput = root.querySelector('.js-count-value');
    this.status = root.querySelector('.js-status');

    this.context = new AudioContext();
    this.recorder = new Recorder(this.context);
    this.player = new Player(this.context, {
      onFrame: (spectrum, partials) => {
        this.spectrumView.draw(spectrum, partials);
        if (this.player.mode === 'monitor') this.inputPeak = Math.max(this.inputPeak, this.player.peakLevel());
      },
      onStop: () => {
        this.recordings.setPlaying(null);
        this.setStatus('');
      },
    });
    this.spectrumView = new SpectrumView(root.querySelector('canvas'), {
      binHz: this.context.sampleRate / FFT_SIZE,
      minDb: this.player.analyser.minDecibels,
      maxDb: this.player.analyser.maxDecibels,
    });
    this.recordings = new RecordingList(
      root.querySelector('.js-recordings'),
      root.querySelector('.js-empty'),
      (buffer, mode, item) => this.play(buffer, mode, item),
    );
  }

  init() {
    this.countInput.max = String(this.player.maxVoices);
    this.countInput.addEventListener('input', () => this.updateVoiceCount());
    this.updateVoiceCount();
    this.recordButton.addEventListener('click', () => this.toggleRecording());
  }

  updateVoiceCount() {
    this.player.voiceCount = Number(this.countInput.value);
    this.countOutput.textContent = this.countInput.value;
  }

  async toggleRecording() {
    await this.context.resume(); // browsers start AudioContext suspended until a user gesture
    if (this.recorder.isRecording) {
      clearTimeout(this.silenceTimer);
      this.player.stop();
      this.setRecordingUi(false);
      this.setStatus(STATUS.processing);
      const buffer = await this.recorder.stop();
      if (!buffer) return this.setStatus(STATUS.empty);
      const item = this.recordings.add(buffer);
      this.play(buffer, 'sine', item);
    } else {
      this.player.stop();
      try {
        await this.recorder.start();
        this.setRecordingUi(true);
        this.setStatus(STATUS.recording);
        this.watchInput(this.recorder.stream);
      } catch (err) {
        console.error(err);
        this.setStatus(STATUS.micDenied);
      }
    }
  }

  /** Shows the live mic spectrum and warns if the mic is delivering silence. */
  watchInput(stream) {
    this.player.monitor(stream);
    this.setStatus(STATUS.recording); // monitor() stops playback, which clears the status
    this.inputPeak = 0;
    this.silenceTimer = setTimeout(() => {
      if (this.recorder.isRecording && this.inputPeak < SILENCE) {
        const device = stream.getAudioTracks()[0]?.label || 'your microphone';
        this.setStatus(STATUS.silentMic(device));
      }
    }, SILENCE_CHECK_MS);
  }

  async play(buffer, mode, item) {
    await this.player.play(buffer, mode);
    this.recordings.setPlaying(item, mode);
    this.setStatus(STATUS[mode]);
  }

  setRecordingUi(recording) {
    this.recordButton.classList.toggle('is-recording', recording);
    this.recordButton.querySelector('span').textContent = recording ? 'Stop' : 'Record';
    this.recordButton.setAttribute('aria-pressed', String(recording));
  }

  setStatus(text) {
    this.status.textContent = text;
  }
}
