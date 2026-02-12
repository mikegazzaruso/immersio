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
import { LeverPuzzle } from '../puzzle/puzzles/LeverPuzzle.js';
import { EnemyPatrolPuzzle } from '../puzzle/puzzles/EnemyPatrolPuzzle.js';
import { CrystalCollectPuzzle } from '../puzzle/puzzles/CrystalCollectPuzzle.js';
import { CouchCompletePuzzle } from '../puzzle/puzzles/CouchCompletePuzzle.js';
import { SteampunkGun } from '../weapons/SteampunkGun.js';

export class Engine {
  constructor() {
    // Scene
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 300);
    this.camera.position.set(0, 1.6, 0);

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

    // Cinematic camera state
    this._cinematic = null;

    // Clock
    this._clock = new THREE.Clock();

    this._setupResize();
  }

  init() {
    this.vrSetup.init();

    // Check for ?level=N URL param -- load specific level directly
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

      // Setup puzzles for level 1
      if (n === 1) {
        this._setupLevel1Puzzles();
      }

      // HUD -- show level title
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

    // Cinematic mode: skip player controls/collision, keep game systems running
    if (this._cinematic) {
      this._updateCinematic(dt);
      this.puzzleManager.update(dt);
      this.hud.update(dt);
      if (this._levelLoader) this._levelLoader.update(dt);
      if (this._steampunkGun) this._steampunkGun.update(dt);
      this.renderer.render(this.scene, this.camera);
      return;
    }

    const session = this.renderer.xr.getSession();

    if (session) {
      this.inputManager.update(session);
      this.locomotion.update(dt);
    } else {
      this.desktopControls.update(dt);
    }
    this.interactionSystem.update();

    this.collisionSystem.update(this.cameraRig, this.locomotion.velocityY);
    this.locomotion.postUpdate(this.collisionSystem);
    this.puzzleManager.update(dt);

    this.levelTransition.update(dt);
    this.hud.update(dt);
    if (this._levelLoader) this._levelLoader.update(dt);
    if (this._steampunkGun) this._steampunkGun.update(dt);

    this.renderer.render(this.scene, this.camera);
  }

  _setupLevel1Puzzles() {
    // Puzzle 1: Find and pull the lever (root -- activates on init)
    const leverPuzzle = new LeverPuzzle(this.eventBus, this);

    // Puzzle 2: Platform traversal with enemy patrol (activates after lever)
    const enemyPatrolPuzzle = new EnemyPatrolPuzzle(this.eventBus, this);
    enemyPatrolPuzzle.dependencies = ['lever_activation'];

    // Puzzle 3: Collect crystal and place on altar (activates after lever, parallel with enemy patrol)
    const crystalCollectPuzzle = new CrystalCollectPuzzle(this.eventBus, this);
    crystalCollectPuzzle.dependencies = ['lever_activation'];

    // Puzzle 4: Jump onto the couch to complete (activates after crystal placed)
    const couchCompletePuzzle = new CouchCompletePuzzle(this.eventBus, this);
    couchCompletePuzzle.dependencies = ['crystal_collect'];

    // Wire up callbacks:
    // When lever is pulled, tell crystal puzzle where the crystal platform is,
    // then show cinematic camera pan to the newly spawned platforms
    leverPuzzle.onLeverPulled = () => {
      const crystalPos = enemyPatrolPuzzle.getCrystalPlatformPosition();
      crystalCollectPuzzle.setCrystalSpawnPosition(crystalPos);

      // Cinematic camera pan (desktop only — VR can't override head tracking)
      setTimeout(() => {
        if (!this.renderer.xr.isPresenting) {
          this._startCinematic(
            new THREE.Vector3(12, 8, 10),
            new THREE.Vector3(0, 6, -2),
          );
        }
      }, 1000);
    };

    // When crystal is placed on altar, enemies become harmless
    crystalCollectPuzzle.onCrystalPlaced = () => {
      if (enemyPatrolPuzzle.state === 'active') {
        enemyPatrolPuzzle.solve();
      }
    };

    // Register all puzzles (dependency graph mode -- not linear chain)
    this.puzzleManager.register(leverPuzzle);
    this.puzzleManager.register(enemyPatrolPuzzle);
    this.puzzleManager.register(crystalCollectPuzzle);
    this.puzzleManager.register(couchCompletePuzzle);

    this.puzzleManager.init();

    // Hidden steampunk gun (optional — not a puzzle)
    this._steampunkGun = new SteampunkGun(this);
    this._steampunkGun.setEnemyPuzzle(enemyPatrolPuzzle);
    this._steampunkGun.init();

    this.eventBus.on('gun:armed', () => {
      this.interactionSystem.armedMode = true;
    });
  }

  _startCinematic(vantagePos, lookAtPos) {
    this._cinematic = {
      elapsed: 0,
      phase: 'pan-out',       // pan-out → hold → pan-back
      panDuration: 1.5,
      holdDuration: 1.5,
      savedRigPos: this.cameraRig.position.clone(),
      savedCamQuat: this.camera.quaternion.clone(),
      vantagePos,
      lookAtPos,
    };
  }

  _updateCinematic(dt) {
    const c = this._cinematic;
    c.elapsed += dt;

    if (c.phase === 'pan-out') {
      const t = Math.min(c.elapsed / c.panDuration, 1);
      const e = this._easeInOut(t);
      this.cameraRig.position.lerpVectors(c.savedRigPos, c.vantagePos, e);
      this.camera.lookAt(c.lookAtPos);
      if (t >= 1) { c.phase = 'hold'; c.elapsed = 0; }
    } else if (c.phase === 'hold') {
      this.camera.lookAt(c.lookAtPos);
      if (c.elapsed >= c.holdDuration) { c.phase = 'pan-back'; c.elapsed = 0; }
    } else if (c.phase === 'pan-back') {
      const t = Math.min(c.elapsed / c.panDuration, 1);
      const e = this._easeInOut(t);
      this.cameraRig.position.lerpVectors(c.vantagePos, c.savedRigPos, e);
      // Blend camera rotation back to saved orientation
      const lookQuat = new THREE.Quaternion();
      this.camera.lookAt(c.lookAtPos);
      lookQuat.copy(this.camera.quaternion);
      this.camera.quaternion.slerpQuaternions(lookQuat, c.savedCamQuat, e);
      if (t >= 1) {
        this.cameraRig.position.copy(c.savedRigPos);
        this.camera.quaternion.copy(c.savedCamQuat);
        this._cinematic = null;
      }
    }
  }

  _easeInOut(t) {
    return t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
  }

  _setupResize() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

}
