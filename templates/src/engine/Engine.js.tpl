import * as THREE from 'three';
import { VRSetup } from './VRSetup.js';
import { DesktopControls } from './DesktopControls.js';
import { EventBus } from '../events/EventBus.js';
import { InputManager } from '../input/InputManager.js';
import { LocomotionSystem } from '../locomotion/LocomotionSystem.js';
import { InteractionSystem } from '../interaction/InteractionSystem.js';
import { CollisionSystem } from '../collision/CollisionSystem.js';
import { PuzzleManager } from '../puzzle/PuzzleManager.js';
import { AssetLoader } from '../assets/AssetLoader.js';
import { LevelLoader } from '../levels/LevelLoader.js';

export class Engine {
  constructor() {
    // Scene
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 300);
    this.camera.position.set(0, {{PLAYER_HEIGHT}}, 0);

    // Camera rig: locomotion moves rig, VR tracking moves camera inside rig
    this.cameraRig = new THREE.Group();
    this.cameraRig.add(this.camera);
    this.scene.add(this.cameraRig);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.xr.enabled = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    document.body.appendChild(this.renderer.domElement);

    // Core systems
    this.eventBus = new EventBus();
    this.inputManager = new InputManager(this.eventBus);
    this.collisionSystem = new CollisionSystem();
    this.vrSetup = new VRSetup(this);
    this.locomotion = new LocomotionSystem(this, this.inputManager, this.eventBus);
    this.interactionSystem = new InteractionSystem(this, this.eventBus);
    this.puzzleManager = new PuzzleManager(this.eventBus);
    this.assetLoader = new AssetLoader();
    this.desktopControls = new DesktopControls(this);

    // Level system
    this._currentLevel = 1;
    this._levelLoader = null;

    // Clock
    this._clock = new THREE.Clock();

    // Notification system
    this._notification = null;
    this._notifTimer = 0;

    this._setupResize();
    this._setupNotifications();
  }

  init() {
    this.vrSetup.init();

    // Check for ?level=N URL param — load specific level directly
    const params = new URLSearchParams(window.location.search);
    const levelParam = parseInt(params.get('level'));
    if (!isNaN(levelParam) && levelParam >= 0) {
      this._loadLevel(levelParam);
      this.renderer.setAnimationLoop((time, frame) => this._loop(time, frame));
      return;
    }

    // Default: load level 1
    this._loadLevel(1);
    this.renderer.setAnimationLoop((time, frame) => this._loop(time, frame));
  }

  async _loadLevel(n) {
    this._currentLevel = n;
    try {
      const config = (await import(`../levels/level${n}.js`)).default;
      if (!this._levelLoader) {
        this._levelLoader = new LevelLoader(this);
      }
      await this._levelLoader.load(config);
      this.collisionSystem.setGroundPlane(0);
    } catch (e) {
      console.warn(`Level ${n} not found:`, e);
      this._showLevelFallback(n);
    }
  }

  _showLevelFallback(n) {
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(30, 32),
      new THREE.MeshLambertMaterial({ color: '#334455' })
    );
    ground.rotation.x = -Math.PI / 2;
    this.scene.add(ground);
    this.scene.add(new THREE.AmbientLight('#ffffff', 0.6));
    this.scene.fog = new THREE.FogExp2('#112233', 0.02);
    this.cameraRig.position.set(0, 0, 0);

    this.eventBus.emit('notification', {
      text: `Level ${n} not found. Run /scene ${n} to create it.`
    });
  }

  _loop(time, frame) {
    const dt = Math.min(this._clock.getDelta(), 0.05);
    const session = this.renderer.xr.getSession();

    if (session) {
      this.inputManager.update(session);
      this.locomotion.update(dt);
      this.interactionSystem.update();
    } else {
      this.desktopControls.update(dt);
    }

    this.collisionSystem.update(this.cameraRig);
    this.locomotion.postUpdate(this.collisionSystem);
    this.puzzleManager.update(dt);
    this._updateNotification(dt);
    if (this._levelLoader) this._levelLoader.update(dt);

    this.renderer.render(this.scene, this.camera);
  }

  _setupResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  _setupNotifications() {
    // DOM notification (desktop)
    const div = document.createElement('div');
    div.id = 'notification';
    div.style.cssText = `
      position: absolute; bottom: 80px; left: 50%; transform: translateX(-50%);
      padding: 12px 24px; background: rgba(0,0,0,0.8); color: #cceeff;
      border: 1px solid #446688; border-radius: 8px; font: 16px sans-serif;
      opacity: 0; transition: opacity 0.3s; pointer-events: none; z-index: 998;
      text-align: center; max-width: 400px;
    `;
    document.body.appendChild(div);
    this._notification = div;

    // VR world-space notification panel
    this._vrNotifCanvas = document.createElement('canvas');
    this._vrNotifCanvas.width = 512;
    this._vrNotifCanvas.height = 64;
    const vrTex = new THREE.CanvasTexture(this._vrNotifCanvas);
    const vrPlane = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.1),
      new THREE.MeshBasicMaterial({
        map: vrTex,
        transparent: true,
        depthTest: false,
        side: THREE.DoubleSide,
      })
    );
    vrPlane.renderOrder = 998;
    vrPlane.position.set(0, 0.04, -0.8);
    vrPlane.visible = false;
    this.camera.add(vrPlane);
    this._vrNotifPlane = vrPlane;
    this._vrNotifTex = vrTex;

    this.eventBus.on('notification', (data) => {
      // DOM
      this._notification.textContent = data.text;
      this._notification.style.opacity = '1';
      this._notifTimer = 4;

      // VR world-space
      const canvas = this._vrNotifCanvas;
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
      ctx.fillText(data.text, canvas.width / 2, canvas.height / 2);
      this._vrNotifTex.needsUpdate = true;
      this._vrNotifPlane.visible = true;
    });
  }

  _updateNotification(dt) {
    if (this._notifTimer > 0) {
      this._notifTimer -= dt;
      if (this._notifTimer <= 0) {
        this._notification.style.opacity = '0';
        this._vrNotifPlane.visible = false;
      }
    }
  }
}
