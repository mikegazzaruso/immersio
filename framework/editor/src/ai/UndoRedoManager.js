/**
 * UndoRedoManager — action stack with Ctrl+Z / Ctrl+Shift+Z support.
 *
 * Actions: addObject, removeObject, moveObject, changeEnvironment
 * Each action stores enough info to undo/redo the operation.
 */
export class UndoRedoManager {
  constructor() {
    this._undoStack = [];
    this._redoStack = [];
    this._maxSize = 100;
    this._listeners = [];
    this._boundKeyHandler = this._onKeyDown.bind(this);
    window.addEventListener('keydown', this._boundKeyHandler);
  }

  /**
   * Register a listener called on undo/redo with the action.
   * @param {(action: object, isUndo: boolean) => void} fn
   */
  onChange(fn) {
    this._listeners.push(fn);
  }

  /**
   * Push an action onto the undo stack. Clears redo stack.
   * @param {object} action — { type, data, undo(), redo() }
   */
  push(action) {
    this._undoStack.push(action);
    if (this._undoStack.length > this._maxSize) {
      this._undoStack.shift();
    }
    this._redoStack.length = 0;
  }

  /**
   * Undo the last action. Returns the undone action or null.
   */
  undo() {
    if (this._undoStack.length === 0) return null;
    const action = this._undoStack.pop();
    action.undo();
    this._redoStack.push(action);
    this._notify(action, true);
    return action;
  }

  /**
   * Redo the last undone action. Returns the redone action or null.
   */
  redo() {
    if (this._redoStack.length === 0) return null;
    const action = this._redoStack.pop();
    action.redo();
    this._undoStack.push(action);
    this._notify(action, false);
    return action;
  }

  /** @returns {boolean} */
  canUndo() { return this._undoStack.length > 0; }
  /** @returns {boolean} */
  canRedo() { return this._redoStack.length > 0; }

  /** Clear both stacks. */
  clear() {
    this._undoStack.length = 0;
    this._redoStack.length = 0;
  }

  /** Remove keyboard listener. */
  dispose() {
    window.removeEventListener('keydown', this._boundKeyHandler);
  }

  // ---- Action factory helpers ----

  /**
   * Create and push an addObject action.
   * @param {THREE.Scene} scene
   * @param {THREE.Object3D} object
   * @param {object} config — editor config metadata
   */
  pushAddObject(scene, object, config) {
    this.push({
      type: 'addObject',
      data: { object, config },
      undo: () => scene.remove(object),
      redo: () => scene.add(object),
    });
  }

  /**
   * Create and push a removeObject action.
   * @param {THREE.Scene} scene
   * @param {THREE.Object3D} object
   * @param {object} config
   */
  pushRemoveObject(scene, object, config) {
    this.push({
      type: 'removeObject',
      data: { object, config },
      undo: () => scene.add(object),
      redo: () => scene.remove(object),
    });
  }

  /**
   * Create and push a moveObject action.
   * @param {THREE.Object3D} object
   * @param {{ x: number, y: number, z: number }} oldPos
   * @param {{ x: number, y: number, z: number }} newPos
   */
  pushMoveObject(object, oldPos, newPos) {
    this.push({
      type: 'moveObject',
      data: { object, oldPos, newPos },
      undo: () => object.position.set(oldPos.x, oldPos.y, oldPos.z),
      redo: () => object.position.set(newPos.x, newPos.y, newPos.z),
    });
  }

  /**
   * Create and push a transform action (position + rotation + scale).
   * @param {THREE.Object3D} object
   * @param {{ position: THREE.Vector3, rotation: THREE.Euler, scale: THREE.Vector3 }} oldTransform
   * @param {{ position: THREE.Vector3, rotation: THREE.Euler, scale: THREE.Vector3 }} newTransform
   */
  pushTransformObject(object, oldTransform, newTransform) {
    this.push({
      type: 'transformObject',
      data: { object, oldTransform, newTransform },
      undo: () => {
        object.position.copy(oldTransform.position);
        object.rotation.copy(oldTransform.rotation);
        object.scale.copy(oldTransform.scale);
      },
      redo: () => {
        object.position.copy(newTransform.position);
        object.rotation.copy(newTransform.rotation);
        object.scale.copy(newTransform.scale);
      },
    });
  }

  /**
   * Create and push a changeEnvironment action.
   * @param {(env: object) => void} applyFn — function that applies an environment config
   * @param {object} oldEnv — previous environment config
   * @param {object} newEnv — new environment config
   */
  pushChangeEnvironment(applyFn, oldEnv, newEnv) {
    this.push({
      type: 'changeEnvironment',
      data: { oldEnv, newEnv },
      undo: () => applyFn(oldEnv),
      redo: () => applyFn(newEnv),
    });
  }

  // ---- Internal ----

  _onKeyDown(e) {
    // Ignore when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const isMac = navigator.platform.includes('Mac');
    const mod = isMac ? e.metaKey : e.ctrlKey;

    if (mod && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      this.undo();
    } else if (mod && e.key === 'z' && e.shiftKey) {
      e.preventDefault();
      this.redo();
    } else if (mod && e.key === 'y') {
      // Windows-style redo
      e.preventDefault();
      this.redo();
    }
  }

  _notify(action, isUndo) {
    for (const fn of this._listeners) {
      fn(action, isUndo);
    }
  }
}
