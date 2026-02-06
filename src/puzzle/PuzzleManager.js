export class PuzzleManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.puzzles = new Map();
    this.order = [];
    this._pendingTimer = null;

    eventBus.on('puzzle:solved', (data) => this._onPuzzleSolved(data));
  }

  register(puzzle) {
    this.puzzles.set(puzzle.id, puzzle);
    this.order.push(puzzle.id);
  }

  init() {
    // Activate the first puzzle
    if (this.order.length > 0) {
      const first = this.puzzles.get(this.order[0]);
      first.activate();
    }
    // Initialize all puzzles
    for (const puzzle of this.puzzles.values()) {
      puzzle.init();
    }
  }

  update(dt) {
    for (const puzzle of this.puzzles.values()) {
      puzzle.update(dt);
    }
  }

  dispose() {
    if (this._pendingTimer) clearTimeout(this._pendingTimer);
    this._pendingTimer = null;
    this.puzzles.clear();
    this.order.length = 0;
  }

  _onPuzzleSolved(data) {
    const idx = this.order.indexOf(data.id);
    if (idx === -1) return;

    const nextIdx = idx + 1;
    if (nextIdx < this.order.length) {
      const next = this.puzzles.get(this.order[nextIdx]);
      this._pendingTimer = setTimeout(() => {
        this._pendingTimer = null;
        next.activate();
      }, 1500);
    } else {
      this.eventBus.emit('game:complete');
    }
  }
}
