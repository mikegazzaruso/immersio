import * as THREE from 'three';
import { ViewportControls } from './ViewportControls.js';
import { createGrid, AxisIndicator } from './Grid.js';

const ORTHO_FRUSTUM = 15; // half-size of ortho view
const ORTHO_DISTANCE = 100; // camera distance from origin

const VIEW_LABELS = {
  front: 'Front (XY)',
  side: 'Side (ZY)',
  top: 'Top (XZ)',
  perspective: '3D',
};

/**
 * A single viewport panel in the editor.
 * Each has its own camera, controls, grid, and overlay elements.
 */
export class Viewport {
  constructor({ type, scene, renderer, container }) {
    this.type = type;
    this.scene = scene;
    this.renderer = renderer;
    this.container = container;

    this.camera = null;
    this.controls = null;
    this.grid = null;
    this.axisIndicator = new AxisIndicator();

    // Viewport bounds in pixels (set by ViewportManager)
    this.x = 0;
    this.y = 0;
    this.width = 0;
    this.height = 0;

    // Focus state
    this.focused = false;

    // DOM overlay for labels and coords
    this._overlay = null;
    this._labelEl = null;
    this._coordsEl = null;
    this._mouseNDC = new THREE.Vector2();

    this._initCamera();
    this._initGrid();
    this._initOverlay();
  }

  _initCamera() {
    if (this.type === 'perspective') {
      this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
      this.camera.position.set(15, 12, 15);
      this.camera.lookAt(0, 0, 0);
    } else {
      const frustum = ORTHO_FRUSTUM;
      this.camera = new THREE.OrthographicCamera(
        -frustum, frustum, frustum, -frustum, 0.1, 500
      );

      if (this.type === 'front') {
        // Looking along -Z at the XY plane
        this.camera.position.set(0, 0, ORTHO_DISTANCE);
        this.camera.lookAt(0, 0, 0);
      } else if (this.type === 'side') {
        // Looking along -X at the ZY plane
        this.camera.position.set(ORTHO_DISTANCE, 0, 0);
        this.camera.lookAt(0, 0, 0);
      } else if (this.type === 'top') {
        // Looking along -Y at the XZ plane
        this.camera.position.set(0, ORTHO_DISTANCE, 0);
        this.camera.up.set(0, 0, -1);
        this.camera.lookAt(0, 0, 0);
      }
    }
  }

  _initGrid() {
    this.grid = createGrid(this.type);
  }

  _initOverlay() {
    this._overlay = document.createElement('div');
    this._overlay.style.cssText =
      'position:absolute;pointer-events:none;overflow:hidden;border:1px solid #333355;z-index:2;';

    // View label
    this._labelEl = document.createElement('div');
    this._labelEl.style.cssText =
      'position:absolute;top:6px;left:8px;font-size:11px;color:#8888aa;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;';
    this._labelEl.textContent = VIEW_LABELS[this.type] || this.type;
    this._overlay.appendChild(this._labelEl);

    // Coordinate display
    this._coordsEl = document.createElement('div');
    this._coordsEl.style.cssText =
      'position:absolute;bottom:6px;left:8px;font-size:10px;color:#666688;font-family:monospace;';
    this._coordsEl.textContent = '';
    this._overlay.appendChild(this._coordsEl);

    // Focus/maximize button
    this._focusBtn = document.createElement('button');
    this._focusBtn.className = 'viewport-focus-btn';
    this._focusBtn.title = 'Focus (click to expand, ESC to return)';
    this._focusBtn.innerHTML = `<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor">
      <path d="M1.5 1h4v1.5h-2.44l3.47 3.47-1.06 1.06L2 3.56V6H.5V1.5A.5.5 0 011 1h.5zm13 0h-4v1.5h2.44l-3.47 3.47 1.06 1.06L14 3.56V6h1.5V1.5a.5.5 0 00-.5-.5h-.5zM5.53 10.03L2.06 13.5H4.5V15h-4v-.5a.5.5 0 01.5-.5V10H2.5v2.44l3.47-3.47 1.06 1.06zm4.94 0l3.47 3.47H11.5V15h4v-.5a.5.5 0 00-.5-.5V10h-1.5v2.44l-3.47-3.47-1.06 1.06z"/>
    </svg>`;
    this._focusBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onFocusRequest) this.onFocusRequest(this.type);
    });
    this._overlay.appendChild(this._focusBtn);

    /** @type {Function|null} callback set by ViewportManager */
    this.onFocusRequest = null;

    this.container.appendChild(this._overlay);
  }

  /** Initialize controls (must be called after the overlay element is in the DOM) */
  initControls() {
    // Create an invisible event capture element that sits on top of the canvas
    this._eventLayer = document.createElement('div');
    this._eventLayer.style.cssText = 'position:absolute;z-index:1;cursor:crosshair;';
    this._eventLayer.dataset.viewportType = this.type;
    this.container.appendChild(this._eventLayer);

    this.controls = new ViewportControls(this.camera, this._eventLayer, this.type);

    // Track mouse for coordinate display
    this._eventLayer.addEventListener('pointermove', (e) => this._onPointerMove(e));
  }

  _onPointerMove(e) {
    const rect = this._eventLayer.getBoundingClientRect();
    // NDC within this viewport
    this._mouseNDC.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this._mouseNDC.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this._updateCoordDisplay();
  }

  _updateCoordDisplay() {
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(this._mouseNDC, this.camera);

    // Intersect with the appropriate plane based on view type
    let plane;
    if (this.type === 'top') {
      plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    } else if (this.type === 'front') {
      plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
    } else if (this.type === 'side') {
      plane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    } else {
      plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    }

    const intersection = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, intersection)) {
      const x = intersection.x.toFixed(1);
      const y = intersection.y.toFixed(1);
      const z = intersection.z.toFixed(1);
      this._coordsEl.textContent = `X:${x} Y:${y} Z:${z}`;
    }
  }

  /** Update viewport bounds in pixels (called by ViewportManager on layout changes) */
  setRect(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;

    // Update overlay position
    if (this._overlay) {
      this._overlay.style.left = x + 'px';
      this._overlay.style.top = y + 'px';
      this._overlay.style.width = width + 'px';
      this._overlay.style.height = height + 'px';
    }

    // Update event layer position
    if (this._eventLayer) {
      this._eventLayer.style.left = x + 'px';
      this._eventLayer.style.top = y + 'px';
      this._eventLayer.style.width = width + 'px';
      this._eventLayer.style.height = height + 'px';
    }

    // Update camera aspect
    if (this.camera.isPerspectiveCamera) {
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
    } else {
      const aspect = width / height;
      const halfH = (this.camera.top - this.camera.bottom) / 2;
      this.camera.left = -halfH * aspect;
      this.camera.right = halfH * aspect;
      this.camera.updateProjectionMatrix();
    }
  }

  setFocused(focused) {
    this.focused = focused;
    if (this._overlay) {
      this._overlay.style.borderColor = focused ? '#6666aa' : '#333355';
    }
  }

  /** Show or hide this viewport's overlay and event layer */
  setVisible(visible) {
    const display = visible ? '' : 'none';
    if (this._overlay) this._overlay.style.display = display;
    if (this._eventLayer) this._eventLayer.style.display = display;
  }

  /** Render this viewport's view into its region of the shared canvas */
  render(renderer) {
    // Three.js setViewport/setScissor take CSS-pixel coordinates and
    // apply pixelRatio internally, so pass CSS-pixel values directly.
    // Y is flipped: Three.js viewport origin is bottom-left.
    const vx = this.x;
    const vy = this.container.clientHeight - this.y - this.height;
    const vw = this.width;
    const vh = this.height;

    renderer.setViewport(vx, vy, vw, vh);
    renderer.setScissor(vx, vy, vw, vh);
    renderer.setScissorTest(true);
    renderer.render(this.scene, this.camera);

    // Render axis indicator in bottom-left corner (60px square), if enabled
    if (this.axisIndicator._visible !== false) {
      this.axisIndicator.syncCamera(this.camera);
      this.axisIndicator.render(renderer, vx + 4, vy + 4, 60);
    }
  }

  update() {
    if (this.controls) {
      this.controls.update();
    }
  }

  /** Get NDC coords from a pointer event relative to the full canvas */
  getNDC(clientX, clientY) {
    const ndc = new THREE.Vector2();
    ndc.x = ((clientX - this.x) / this.width) * 2 - 1;
    ndc.y = -((clientY - this.y) / this.height) * 2 + 1;
    return ndc;
  }

  /** Check if a screen coordinate falls within this viewport */
  containsPoint(clientX, clientY) {
    return (
      clientX >= this.x && clientX < this.x + this.width &&
      clientY >= this.y && clientY < this.y + this.height
    );
  }

  dispose() {
    if (this.controls) this.controls.dispose();
    if (this._overlay && this._overlay.parentNode) {
      this._overlay.parentNode.removeChild(this._overlay);
    }
    if (this._eventLayer && this._eventLayer.parentNode) {
      this._eventLayer.parentNode.removeChild(this._eventLayer);
    }
  }
}
