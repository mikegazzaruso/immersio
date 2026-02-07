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
    const hasGraph = [...this.puzzles.values()].some(p => p.dependencies.length > 0);

    if (hasGraph) {
      for (const puzzle of this.puzzles.values()) {
        if (puzzle.dependencies.length === 0) {
          puzzle.activate();
        }
      }
    } else {
      if (this.order.length > 0) {
        const first = this.puzzles.get(this.order[0]);
        first.activate();
      }
    }

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
    const hasGraph = [...this.puzzles.values()].some(p => p.dependencies.length > 0);

    if (hasGraph) {
      this._advanceGraph(data.id);
    } else {
      this._advanceLinear(data.id);
    }
  }

  _advanceLinear(solvedId) {
    const idx = this.order.indexOf(solvedId);
    if (idx === -1) return;

    const nextIdx = idx + 1;
    if (nextIdx < this.order.length) {
      const next = this.puzzles.get(this.order[nextIdx]);
      setTimeout(() => next.activate(), 1500);
    } else {
      this.eventBus.emit('game:complete');
    }
  }

  _advanceGraph(solvedId) {
    let activated = false;

    for (const puzzle of this.puzzles.values()) {
      if (puzzle.state !== 'locked') continue;
      if (puzzle.dependencies.length === 0) continue;

      const allMet = puzzle.dependencies.every(depId => {
        const dep = this.puzzles.get(depId);
        return dep && dep.state === 'solved';
      });

      if (allMet) {
        activated = true;
        setTimeout(() => puzzle.activate(), 1500);
      }
    }

    if (!activated) {
      const allSolved = [...this.puzzles.values()].every(p => p.state === 'solved');
      if (allSolved) {
        this.eventBus.emit('game:complete');
      }
    }
  }
}
