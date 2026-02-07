export class PuzzleBase {
  constructor(id, eventBus) {
    this.id = id;
    this.eventBus = eventBus;
    this.state = 'locked'; // locked, active, solved
    this.dependencies = []; // puzzle IDs that must be solved before this one activates
  }

  activate() {
    if (this.state !== 'locked') return;
    this.state = 'active';
    this.eventBus.emit('puzzle:activated', { id: this.id });
    this.onActivate();
  }

  solve() {
    if (this.state !== 'active') return;
    this.state = 'solved';
    this.eventBus.emit('puzzle:solved', { id: this.id });
    this.onSolved();
  }

  // Override in subclasses
  onActivate() {}
  onSolved() {}
  update(dt) {}
  init() {}
}
