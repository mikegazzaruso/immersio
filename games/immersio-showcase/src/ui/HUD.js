import * as THREE from 'three';

/**
 * HUD — Handles all user interface: notifications, level title,
 * puzzle progress, and game completion screen.
 * Works in both desktop (HTML overlay) and VR (world-space canvas panel).
 */
export class HUD {
  constructor(engine) {
    this._engine = engine;
    this._eventBus = engine.eventBus;
    this._notifTimer = 0;
    this._titleTimer = 0;
    this._puzzleTotal = 0;
    this._puzzleSolved = 0;
    this._gameComplete = false;

    this._createDOM();
    this._createVRPanel();
    this._bindEvents();
  }

  // --- DOM (desktop) ---

  _createDOM() {
    // Notification bar
    const notif = document.createElement('div');
    notif.id = 'hud-notification';
    notif.style.cssText = `
      position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%);
      padding: 12px 24px; background: rgba(0,0,0,0.8); color: #cceeff;
      border: 1px solid #446688; border-radius: 8px; font: 16px sans-serif;
      opacity: 0; transition: opacity 0.3s; pointer-events: none; z-index: 998;
      text-align: center; max-width: 400px;
    `;
    document.body.appendChild(notif);
    this._domNotif = notif;

    // Level title (large, centered, fades after 3s)
    const title = document.createElement('div');
    title.id = 'hud-title';
    title.style.cssText = `
      position: absolute; top: 30%; left: 50%; transform: translate(-50%, -50%);
      color: #ffffff; font: bold 36px sans-serif; text-shadow: 0 2px 8px rgba(0,0,0,0.8);
      opacity: 0; transition: opacity 0.5s; pointer-events: none; z-index: 998;
      text-align: center;
    `;
    document.body.appendChild(title);
    this._domTitle = title;

    // Puzzle progress (top-right)
    const progress = document.createElement('div');
    progress.id = 'hud-progress';
    progress.style.cssText = `
      position: absolute; top: 10px; right: 10px;
      padding: 8px 14px; background: rgba(0,0,0,0.6); color: #aaccff;
      border: 1px solid #334466; border-radius: 6px; font: 14px sans-serif;
      opacity: 0; transition: opacity 0.3s; pointer-events: none; z-index: 998;
    `;
    document.body.appendChild(progress);
    this._domProgress = progress;

    // Game complete overlay
    const complete = document.createElement('div');
    complete.id = 'hud-complete';
    complete.style.cssText = `
      position: absolute; top: 0; left: 0; width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center; flex-direction: column;
      background: rgba(0,0,0,0.7); opacity: 0; transition: opacity 1s;
      pointer-events: none; z-index: 997;
    `;
    complete.innerHTML = `
      <div style="color: #ffdd44; font: bold 48px sans-serif; text-shadow: 0 0 20px #ffdd44;">
        COMPLETE
      </div>
      <div style="color: #aaccff; font: 20px sans-serif; margin-top: 16px;">
        All puzzles solved!
      </div>
    `;
    document.body.appendChild(complete);
    this._domComplete = complete;
  }

  // --- VR Panel ---

  _createVRPanel() {
    this._vrCanvas = document.createElement('canvas');
    this._vrCanvas.width = 512;
    this._vrCanvas.height = 128;

    const tex = new THREE.CanvasTexture(this._vrCanvas);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      depthTest: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.22),
      mat
    );
    mesh.renderOrder = 998;
    mesh.position.set(0, 0.04, -0.8);
    mesh.visible = false;
    this._engine.camera.add(mesh);

    this._vrPanel = mesh;
    this._vrTex = tex;
    this._vrTimer = 0;
  }

  _renderVRPanel(text, subtext) {
    const canvas = this._vrCanvas;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#446688';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

    ctx.fillStyle = '#cceeff';
    ctx.font = '22px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, subtext ? canvas.height / 2 - 14 : canvas.height / 2);

    if (subtext) {
      ctx.fillStyle = '#88aacc';
      ctx.font = '16px sans-serif';
      ctx.fillText(subtext, canvas.width / 2, canvas.height / 2 + 18);
    }

    this._vrTex.needsUpdate = true;
    this._vrPanel.visible = true;
    this._vrTimer = 4;
  }

  // --- Events ---

  _bindEvents() {
    this._eventBus.on('notification', (data) => {
      this._showNotification(data.text);
    });

    this._eventBus.on('puzzle:activated', () => {
      this._updateProgress();
    });

    this._eventBus.on('puzzle:solved', () => {
      this._puzzleSolved++;
      this._updateProgress();
    });

    this._eventBus.on('game:complete', () => {
      this._gameComplete = true;
      this._domComplete.style.opacity = '1';
      this._renderVRPanel('COMPLETE', 'All puzzles solved!');
      this._vrTimer = 10;
    });
  }

  /**
   * Call when a level is loaded to show the title and reset progress.
   * @param {string} name - Level name
   * @param {number} puzzleCount - Total puzzles in this level (0 if unknown)
   */
  onLevelLoaded(name, puzzleCount) {
    // Title
    this._domTitle.textContent = name;
    this._domTitle.style.opacity = '1';
    this._titleTimer = 3;

    // Progress
    this._puzzleTotal = puzzleCount;
    this._puzzleSolved = 0;
    this._gameComplete = false;
    this._domComplete.style.opacity = '0';

    if (puzzleCount > 0) {
      this._updateProgress();
      this._domProgress.style.opacity = '1';
    } else {
      this._domProgress.style.opacity = '0';
    }

    // VR
    this._renderVRPanel(name);
  }

  _showNotification(text) {
    this._domNotif.textContent = text;
    this._domNotif.style.opacity = '1';
    this._notifTimer = 4;

    this._renderVRPanel(text);
  }

  _updateProgress() {
    if (this._puzzleTotal <= 0) return;
    const text = `Puzzles: ${this._puzzleSolved} / ${this._puzzleTotal}`;
    this._domProgress.textContent = text;
  }

  // --- Update loop ---

  update(dt) {
    // Notification fade
    if (this._notifTimer > 0) {
      this._notifTimer -= dt;
      if (this._notifTimer <= 0) {
        this._domNotif.style.opacity = '0';
      }
    }

    // Title fade
    if (this._titleTimer > 0) {
      this._titleTimer -= dt;
      if (this._titleTimer <= 0) {
        this._domTitle.style.opacity = '0';
      }
    }

    // VR panel fade
    if (this._vrTimer > 0) {
      this._vrTimer -= dt;
      if (this._vrTimer <= 0 && !this._gameComplete) {
        this._vrPanel.visible = false;
      }
    }
  }
}
