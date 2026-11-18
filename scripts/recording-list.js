// The list of recordings, each with "Sines" and "Original" play buttons.

export class RecordingList {
  #count = 0;
  #playing = null;

  /**
   * @param {HTMLUListElement} list
   * @param {HTMLElement} emptyMessage
   * @param {(buffer: AudioBuffer, mode: 'sine'|'original', item: HTMLLIElement) => void} onPlay
   */
  constructor(list, emptyMessage, onPlay) {
    this.list = list;
    this.emptyMessage = emptyMessage;
    this.onPlay = onPlay;
  }

  /** @param {AudioBuffer} buffer  @returns {HTMLLIElement} */
  add(buffer) {
    this.#count += 1;
    const item = document.createElement('li');
    item.className = 'recording';
    item.innerHTML = `
      <div class="recording__meta">
        <span class="recording__name">Recording ${this.#count}</span>
        <span class="recording__duration">${buffer.duration.toFixed(1)}s</span>
      </div>
      <div class="recording__actions">
        <button type="button" class="chip" data-mode="sine">Sines</button>
        <button type="button" class="chip chip--ghost" data-mode="original">Original</button>
      </div>`;
    item.addEventListener('click', (e) => {
      const button = e.target.closest('button[data-mode]');
      if (button) this.onPlay(buffer, button.dataset.mode, item);
    });

    this.emptyMessage.hidden = true;
    this.list.prepend(item);
    return item;
  }

  /** Highlights `item` as playing in `mode`, or clears the highlight when item is null. */
  setPlaying(item, mode) {
    if (this.#playing) {
      this.#playing.classList.remove('is-playing');
      delete this.#playing.dataset.playing;
    }
    this.#playing = item;
    if (item) {
      item.classList.add('is-playing');
      item.dataset.playing = mode;
    }
  }
}
