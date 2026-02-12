import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';

/**
 * Wraps Three.js TransformControls for multi-viewport editor use.
 *
 * Uses connect()/disconnect() to efficiently switch between viewports
 * without disposing. The visual helper (added to the shared scene) is
 * visible in all 4 viewports simultaneously.
 */
export class TransformGizmo {
  constructor({ scene }) {
    this.scene = scene;
    this.controls = null;
    this._helper = null;
    this._mode = 'translate';
    this._attached = null;
    this._dragStartTransform = null;

    this._onDraggingChanged = [];
    this._onDragEnd = [];
    this._onChange = [];
  }

  /**
   * Bind (or rebind) to a viewport's camera and event layer.
   * First call creates the TransformControls; subsequent calls just
   * disconnect from the old domElement and reconnect to the new one.
   */
  bindToViewport(camera, domElement) {
    if (!this.controls) {
      // First bind — create TransformControls
      this.controls = new TransformControls(camera, domElement);
      this.controls.setMode(this._mode);
      this.controls.setSize(0.75);

      this._helper = this.controls.getHelper();
      this.scene.add(this._helper);

      this._wireEvents();

      if (this._attached) {
        this.controls.attach(this._attached);
      }
    } else {
      // Subsequent binds — just switch domElement and camera
      this.controls.disconnect();
      this.controls.domElement = domElement;
      this.controls.camera = camera;
      this.controls.connect();
    }
  }

  _wireEvents() {
    this.controls.addEventListener('dragging-changed', (e) => {
      if (e.value) {
        const obj = this.controls.object;
        if (obj) {
          this._dragStartTransform = {
            position: obj.position.clone(),
            rotation: obj.rotation.clone(),
            scale: obj.scale.clone(),
          };
        }
      } else {
        const obj = this.controls.object;
        if (obj && this._dragStartTransform) {
          for (const fn of this._onDragEnd) {
            fn({
              object: obj,
              oldTransform: this._dragStartTransform,
              newTransform: {
                position: obj.position.clone(),
                rotation: obj.rotation.clone(),
                scale: obj.scale.clone(),
              },
              mode: this._mode,
            });
          }
        }
      }
      for (const fn of this._onDraggingChanged) fn(e.value);
    });

    this.controls.addEventListener('objectChange', () => {
      for (const fn of this._onChange) fn(this.controls.object);
    });
  }

  attach(obj) {
    this._attached = obj;
    if (this.controls) this.controls.attach(obj);
  }

  detach() {
    this._attached = null;
    if (this.controls) this.controls.detach();
  }

  setMode(mode) {
    this._mode = mode;
    if (this.controls) this.controls.setMode(mode);
  }

  getMode() {
    return this._mode;
  }

  get isDragging() {
    return this.controls?.dragging || false;
  }

  get isAttached() {
    return this._attached !== null;
  }

  /**
   * Check if a raycaster intersects any gizmo handle meshes.
   */
  hitsGizmo(raycaster) {
    if (!this._helper || !this._attached) return false;
    const hits = raycaster.intersectObjects(this._helper.children, true);
    return hits.length > 0;
  }

  onDraggingChanged(fn) { this._onDraggingChanged.push(fn); }
  onDragEnd(fn) { this._onDragEnd.push(fn); }
  onChange(fn) { this._onChange.push(fn); }

  dispose() {
    if (this.controls) {
      this.controls.detach();
      this.controls.dispose();
    }
    if (this._helper) {
      this.scene.remove(this._helper);
    }
    this._onDraggingChanged = [];
    this._onDragEnd = [];
    this._onChange = [];
  }
}
