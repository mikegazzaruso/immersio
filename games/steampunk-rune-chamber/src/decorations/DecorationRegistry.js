export class DecorationRegistry {
  constructor() {
    this._types = new Map();
  }

  register(type, spawner) {
    this._types.set(type, spawner);
  }

  has(type) {
    return this._types.has(type);
  }

  get(type) {
    return this._types.get(type);
  }

  types() {
    return [...this._types.keys()];
  }
}
