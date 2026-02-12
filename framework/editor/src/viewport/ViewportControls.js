import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

/**
 * Camera controls for a single viewport.
 * - Perspective viewports get full OrbitControls (rotate, pan, zoom).
 * - Orthographic viewports get pan + zoom only (no rotation).
 */
export class ViewportControls {
  constructor(camera, domElement, viewType) {
    this.camera = camera;
    this.viewType = viewType;
    this.orbitControls = null;
    this.enabled = true;

    // Track pan/zoom state for ortho views
    this._panStart = new THREE.Vector2();
    this._isPanning = false;
    this._domElement = domElement;

    if (viewType === 'perspective') {
      this._initOrbitControls(domElement);
    } else {
      this._initOrthoControls(domElement);
    }
  }

  _initOrbitControls(domElement) {
    this.orbitControls = new OrbitControls(this.camera, domElement);
    this.orbitControls.enableDamping = true;
    this.orbitControls.dampingFactor = 0.1;
    this.orbitControls.screenSpacePanning = true;
    this.orbitControls.minDistance = 1;
    this.orbitControls.maxDistance = 200;
    this.orbitControls.target.set(0, 0, 0);
    this.orbitControls.update();
  }

  _initOrthoControls(domElement) {
    this._onWheel = (e) => this._handleZoom(e);
    this._onPointerDown = (e) => this._handlePanStart(e);
    this._onPointerMove = (e) => this._handlePanMove(e);
    this._onPointerUp = () => this._handlePanEnd();

    domElement.addEventListener('wheel', this._onWheel, { passive: false });
    domElement.addEventListener('pointerdown', this._onPointerDown);
    domElement.addEventListener('pointermove', this._onPointerMove);
    domElement.addEventListener('pointerup', this._onPointerUp);
  }

  _handleZoom(e) {
    if (!this.enabled) return;
    e.preventDefault();
    const cam = this.camera;
    const zoomSpeed = 0.1;
    const factor = 1 + Math.sign(e.deltaY) * zoomSpeed;

    cam.zoom = Math.max(0.1, Math.min(100, cam.zoom / factor));
    cam.updateProjectionMatrix();
  }

  _handlePanStart(e) {
    if (!this.enabled) return;
    // Middle mouse or left mouse + shift
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      this._isPanning = true;
      this._panStart.set(e.clientX, e.clientY);
      this._domElement.setPointerCapture(e.pointerId);
    }
  }

  _handlePanMove(e) {
    if (!this._isPanning) return;

    const dx = e.clientX - this._panStart.x;
    const dy = e.clientY - this._panStart.y;
    this._panStart.set(e.clientX, e.clientY);

    const cam = this.camera;
    // Scale pan speed to camera zoom
    const panScale = (cam.right - cam.left) / (cam.zoom * this._domElement.clientWidth);

    if (this.viewType === 'front') {
      cam.position.x -= dx * panScale;
      cam.position.y += dy * panScale;
    } else if (this.viewType === 'side') {
      cam.position.z -= dx * panScale;
      cam.position.y += dy * panScale;
    } else if (this.viewType === 'top') {
      cam.position.x -= dx * panScale;
      cam.position.z += dy * panScale;
    }
  }

  _handlePanEnd() {
    this._isPanning = false;
  }

  update() {
    if (this.orbitControls) {
      this.orbitControls.update();
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (this.orbitControls) {
      this.orbitControls.enabled = enabled;
    }
  }

  dispose() {
    if (this.orbitControls) {
      this.orbitControls.dispose();
    }
    if (this._domElement) {
      this._domElement.removeEventListener('wheel', this._onWheel);
      this._domElement.removeEventListener('pointerdown', this._onPointerDown);
      this._domElement.removeEventListener('pointermove', this._onPointerMove);
      this._domElement.removeEventListener('pointerup', this._onPointerUp);
    }
  }
}
