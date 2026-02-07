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
import { LevelTransition } from '../levels/LevelTransition.js';
import { AudioManager } from '../audio/AudioManager.js';
import { HUD } from '../ui/HUD.js';
import { DecorationRegistry } from '../decorations/DecorationRegistry.js';
import { registerBuiltins } from '../decorations/builtins.js';

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
    this.decorationRegistry = new DecorationRegistry();
    registerBuiltins(this.decorationRegistry);
    this.desktopControls = new DesktopControls(this);
    this.audioManager = new AudioManager(this.eventBus);
    this.hud = new HUD(this);
    this.levelTransition = new LevelTransition(this);

    // Level system
    this._currentLevel = 1;
    this._levelLoader = null;

    // Clock
    this._clock = new THREE.Clock();

    this._setupResize();
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

      // Level transitions (portals)
      this.levelTransition.buildFromConfig(config);

      // Ambient audio
      const ambientType = config.environment.enclosure ? 'indoor' : 'outdoor';
      this.audioManager.startAmbient(ambientType);

      // HUD — show level title
      const puzzleCount = this.puzzleManager.order.length;
      this.hud.onLevelLoaded(config.name || `Level ${n}`, puzzleCount);
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
    } else {
      this.desktopControls.update(dt);
    }

    this.interactionSystem.update();
    this.collisionSystem.update(this.cameraRig);
    this.locomotion.postUpdate(this.collisionSystem);
    this.puzzleManager.update(dt);
    this.levelTransition.update(dt);
    this.hud.update(dt);
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

}
