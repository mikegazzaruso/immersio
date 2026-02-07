/**
 * DecorationRegistry — extensible registry for procedural decoration types.
 *
 * Each registered type provides a spawner function:
 *   (scene, config, env, helpers) => { objects: THREE.Object3D[], animated: [] }
 *
 * helpers = { randomInRange, scatterPosition, levelObjects }
 *
 * Built-in types are registered in builtins.js.
 * Games can register custom types via:
 *   decorationRegistry.register('myType', spawnerFn);
 */
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
