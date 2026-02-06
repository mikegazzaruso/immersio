export class PuzzleManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this.puzzles = new Map();
    this.order = [];

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

  _onPuzzleSolved(data) {
    const idx = this.order.indexOf(data.id);
    if (idx === -1) return;

    const nextIdx = idx + 1;
    if (nextIdx < this.order.length) {
      const next = this.puzzles.get(this.order[nextIdx]);
      setTimeout(() => next.activate(), 1500);
    } else {
      this.eventBus.emit('game:complete');
    }
  }
}
