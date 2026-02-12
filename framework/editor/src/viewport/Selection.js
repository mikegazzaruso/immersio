import * as THREE from 'three';

const HIGHLIGHT_COLOR = 0xffaa00;

/**
 * Selection system: click-to-select in any viewport, highlight across all.
 * Selected objects get a wireframe overlay.
 */
export class Selection {
  constructor(scene) {
    this.scene = scene;
    this.selected = null;
    this._highlightMeshes = [];
    this._raycaster = new THREE.Raycaster();
    this._callbacks = [];
    this._selectableObjects = []; // cached list of selectable top-level objects
  }

  /** Register a callback for selection changes: fn(selectedObject | null) */
  onChange(fn) {
    this._callbacks.push(fn);
  }

  /** Update the cached list of selectable objects (call after scene changes) */
  updateSelectables() {
    this._selectableObjects = [];
    for (const child of this.scene.children) {
      if (child.userData?.selectable) {
        this._selectableObjects.push(child);
      }
    }
  }

  /**
   * Raycast into the scene from a viewport's camera at normalized coords.
   * Only tests against selectable objects for fast picking.
   * @param {THREE.Camera} camera
   * @param {THREE.Vector2} ndc — normalized device coords (-1..1)
   * @returns {THREE.Object3D|null} the hit object, or null
   */
  pick(camera, ndc) {
    this._raycaster.setFromCamera(ndc, camera);

    // Raycast only against selectable objects (not the entire scene)
    const targets = this._selectableObjects;
    if (targets.length === 0) {
      this.deselect();
      return null;
    }

    const intersects = this._raycaster.intersectObjects(targets, true);

    for (const hit of intersects) {
      const obj = this._findSelectableParent(hit.object);
      if (obj) {
        this.select(obj);
        return obj;
      }
    }

    this.deselect();
    return null;
  }

  _findSelectableParent(obj) {
    let current = obj;
    while (current) {
      if (current.userData?.selectable) return current;
      current = current.parent;
    }
    return null;
  }

  select(obj) {
    if (this.selected === obj) return;
    this.deselect();
    this.selected = obj;
    this._addHighlight(obj);
    this._notify();
  }

  deselect() {
    if (!this.selected) return;
    this._removeHighlights();
    this.selected = null;
    this._notify();
  }

  _addHighlight(obj) {
    // Use BoxHelper — instant bounding box outline, no geometry recomputation
    const box = new THREE.BoxHelper(obj, HIGHLIGHT_COLOR);
    box.name = 'highlight-box';
    box.raycast = () => {};
    this.scene.add(box);
    this._highlightMeshes.push(box);
  }

  _removeHighlights() {
    for (const mesh of this._highlightMeshes) {
      if (mesh.parent) mesh.parent.remove(mesh);
      mesh.geometry?.dispose();
      mesh.material?.dispose();
    }
    this._highlightMeshes = [];
  }

  /** Call each frame to keep the highlight box in sync with the object */
  update() {
    for (const h of this._highlightMeshes) {
      h.update();
    }
  }

  _notify() {
    for (const fn of this._callbacks) {
      fn(this.selected);
    }
  }

  dispose() {
    this._removeHighlights();
    this._callbacks = [];
  }
}
