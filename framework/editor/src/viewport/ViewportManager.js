import * as THREE from 'three';
import { Viewport } from './Viewport.js';
import { Selection } from './Selection.js';
import { TransformGizmo } from './TransformGizmo.js';

const DIVIDER_WIDTH = 2; // pixels

/**
 * Manages 4 viewports in a 2x2 grid layout, sharing a single WebGL renderer.
 *
 * Layout:
 *   +------------+------------+
 *   |  Front(XY) | Perspective|
 *   +------------+------------+
 *   |  Side(ZY)  |  Top(XZ)   |
 *   +------------+------------+
 */
export class ViewportManager {
  constructor({ container, scene, renderer }) {
    this.container = container;
    this.scene = scene;
    this.renderer = renderer;
    this.selection = new Selection(scene);

    // Wrap the container for viewport overlays
    this._wrapper = document.createElement('div');
    this._wrapper.style.cssText = 'position:relative;width:100%;height:100%;';
    this.container.appendChild(this._wrapper);

    // Append the renderer canvas inside the wrapper
    renderer.domElement.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';
    this._wrapper.appendChild(renderer.domElement);

    // Create 4 viewports
    this.viewports = {
      front: new Viewport({ type: 'front', scene, renderer, container: this._wrapper }),
      perspective: new Viewport({ type: 'perspective', scene, renderer, container: this._wrapper }),
      side: new Viewport({ type: 'side', scene, renderer, container: this._wrapper }),
      top: new Viewport({ type: 'top', scene, renderer, container: this._wrapper }),
    };

    // Collect grids per viewport
    this._viewGrids = {};
    for (const [key, vp] of Object.entries(this.viewports)) {
      this._viewGrids[key] = vp.grid;
    }

    // Add shared grids to the main scene (they're unique per viewport, so
    // we'll toggle visibility at render time)
    for (const grid of Object.values(this._viewGrids)) {
      this.scene.add(grid);
    }

    this._activeViewport = null;

    // Full-screen focus mode: null = quad view, 'front'/'side'/'top'/'perspective' = single
    this._focusedViewport = null;

    // Transform gizmo (created before events so event handlers can reference it)
    this.transformGizmo = new TransformGizmo({ scene: this.scene });

    this._initControls();
    this._initEvents();
    this.layout();

    // Default to perspective viewport active
    this._setActiveViewport('perspective');

    // Wire selection changes to gizmo attach/detach
    this.selection.onChange((obj) => {
      if (obj) {
        this.transformGizmo.attach(obj);
      } else {
        this.transformGizmo.detach();
      }
    });

    // Keep selection highlight in sync during gizmo drag
    this.transformGizmo.onChange(() => {
      this.selection.update();
    });

    // Wire gizmo dragging state to viewport camera controls
    this.transformGizmo.onDraggingChanged((dragging) => {
      const vp = this.viewports[this._activeViewport];
      if (vp?.controls) {
        vp.controls.setEnabled(!dragging);
      }
    });
  }

  _initControls() {
    for (const vp of Object.values(this.viewports)) {
      vp.initControls();
      vp.onFocusRequest = (type) => this.focusViewport(type);
    }
  }

  _initEvents() {
    window.addEventListener('resize', () => this.layout());

    // ESC to exit focus mode (only when no input/overlay is focused)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._focusedViewport) {
        // Don't consume ESC if an input/textarea is focused (e.g. AI prompt overlay)
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        e.preventDefault();
        this.unfocusViewport();
      }
    });

    // Click to select and focus viewport
    this._wrapper.addEventListener('pointerdown', (e) => {
      const rect = this._wrapper.getBoundingClientRect();
      const clientX = e.clientX - rect.left;
      const clientY = e.clientY - rect.top;

      // Determine which viewport was clicked
      for (const [key, vp] of Object.entries(this.viewports)) {
        if (vp.containsPoint(clientX, clientY)) {
          this._setActiveViewport(key);

          // Left click = select object
          if (e.button === 0 && !e.shiftKey) {
            // Skip selection if pointer is over a gizmo handle.
            // TransformControls sets .axis on hover — only non-null when
            // over a visible handle (arrows/circles/cubes), never for the
            // invisible constraint planes that hitsGizmo() was catching.
            if (this.transformGizmo.controls?.axis) {
              break;
            }

            const ndc = vp.getNDC(clientX, clientY);
            this.selection.pick(vp.camera, ndc);
          }
          break;
        }
      }
    });
  }

  _setActiveViewport(key) {
    if (this._activeViewport === key) return;
    // Unfocus previous
    for (const [k, vp] of Object.entries(this.viewports)) {
      vp.setFocused(k === key);
      if (vp.controls) {
        vp.controls.setEnabled(k === key);
      }
    }
    this._activeViewport = key;

    // Rebind transform gizmo to the new viewport's camera and event layer
    const vp = this.viewports[key];
    if (vp) {
      this.transformGizmo.bindToViewport(vp.camera, vp._eventLayer);
    }
  }

  /** Expand a single viewport to fill the entire area */
  focusViewport(type) {
    if (!this.viewports[type]) return;
    this._focusedViewport = type;
    this._setActiveViewport(type);

    // Show ESC hint on the focused viewport overlay
    const vp = this.viewports[type];
    if (!vp._escHint) {
      vp._escHint = document.createElement('div');
      vp._escHint.className = 'viewport-esc-hint';
      vp._escHint.textContent = 'Press ESC to return';
      vp._overlay.appendChild(vp._escHint);
    }
    vp._escHint.style.display = '';
    // Hide focus button in focused mode
    if (vp._focusBtn) vp._focusBtn.style.display = 'none';

    this.layout();
  }

  /** Return to 2x2 quad view */
  unfocusViewport() {
    if (!this._focusedViewport) return;

    // Clean up ESC hint and restore focus button
    const vp = this.viewports[this._focusedViewport];
    if (vp._escHint) vp._escHint.style.display = 'none';
    if (vp._focusBtn) vp._focusBtn.style.display = '';

    this._focusedViewport = null;

    // Re-enable all viewport focus buttons
    for (const v of Object.values(this.viewports)) {
      if (v._focusBtn) v._focusBtn.style.display = '';
    }

    this.layout();

    // Re-enable controls for the active viewport and rebind gizmo
    if (this._activeViewport) {
      const active = this.viewports[this._activeViewport];
      for (const [k, v] of Object.entries(this.viewports)) {
        v.setFocused(k === this._activeViewport);
        if (v.controls) v.controls.setEnabled(k === this._activeViewport);
      }
      if (active) {
        this.transformGizmo.bindToViewport(active.camera, active._eventLayer);
      }
    }
  }

  /** Recompute the 2x2 layout based on container size */
  layout() {
    const w = this._wrapper.clientWidth;
    const h = this._wrapper.clientHeight;

    // Update renderer size to match container
    this.renderer.setSize(w, h);

    if (this._focusedViewport) {
      // Focused mode: one viewport fills entire area, others hidden
      for (const [key, vp] of Object.entries(this.viewports)) {
        if (key === this._focusedViewport) {
          vp.setRect(0, 0, w, h);
          vp.setVisible(true);
        } else {
          vp.setRect(0, 0, 0, 0);
          vp.setVisible(false);
        }
      }
      return;
    }

    // Quad view: standard 2x2 grid
    for (const vp of Object.values(this.viewports)) {
      vp.setVisible(true);
    }

    const halfW = Math.floor((w - DIVIDER_WIDTH) / 2);
    const halfH = Math.floor((h - DIVIDER_WIDTH) / 2);
    const rightX = halfW + DIVIDER_WIDTH;
    const bottomY = halfH + DIVIDER_WIDTH;
    const rightW = w - rightX;
    const bottomH = h - bottomY;

    // Top-left: Front
    this.viewports.front.setRect(0, 0, halfW, halfH);
    // Top-right: Perspective
    this.viewports.perspective.setRect(rightX, 0, rightW, halfH);
    // Bottom-left: Side
    this.viewports.side.setRect(0, bottomY, halfW, bottomH);
    // Bottom-right: Top
    this.viewports.top.setRect(rightX, bottomY, rightW, bottomH);
  }

  /** Called each frame — updates controls and renders all 4 viewports */
  update() {
    // Update controls
    for (const vp of Object.values(this.viewports)) {
      vp.update();
    }
    // Keep selection highlight in sync with object transforms
    this.selection.update();
  }

  render() {
    this.renderer.setClearColor(0x1a1a2e, 1);
    this.renderer.clear();

    // Render each viewport, toggling the appropriate grid visibility
    const viewKeys = this._focusedViewport
      ? [this._focusedViewport]
      : ['front', 'perspective', 'side', 'top'];

    const sceneBackground = this.scene.background;
    const sceneFog = this.scene.fog;

    for (const key of viewKeys) {
      // Show only the grid for this viewport's view type, respecting the toggle flag
      for (const [gk, grid] of Object.entries(this._viewGrids)) {
        const enabled = grid.userData._gridEnabled !== false; // default true
        grid.visible = (gk === key) && enabled;
      }

      // Ortho viewports get a neutral background — no sky/fog
      if (key !== 'perspective') {
        this.scene.background = null;
        this.scene.fog = null;
      } else {
        this.scene.background = sceneBackground;
        this.scene.fog = sceneFog;
      }

      this.viewports[key].render(this.renderer);
    }

    // Restore
    this.scene.background = sceneBackground;
    this.scene.fog = sceneFog;

    // Reset scissor
    this.renderer.setScissorTest(false);
  }

  /** Get the shared scene (for adding/removing objects) */
  getScene() {
    return this.scene;
  }

  /** Get the selection system */
  getSelection() {
    return this.selection;
  }

  dispose() {
    for (const grid of Object.values(this._viewGrids)) {
      this.scene.remove(grid);
    }
    for (const vp of Object.values(this.viewports)) {
      vp.dispose();
    }
    this.transformGizmo.dispose();
    this.selection.dispose();
    if (this._wrapper.parentNode) {
      this._wrapper.parentNode.removeChild(this._wrapper);
    }
  }
}
