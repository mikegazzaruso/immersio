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
import { CrystalCollectionPuzzle } from '../puzzle/puzzles/CrystalCollectionPuzzle.js';
import { NeuralSequencePuzzle } from '../puzzle/puzzles/NeuralSequencePuzzle.js';
import { BridgeActivationPuzzle } from '../puzzle/puzzles/BridgeActivationPuzzle.js';
import { IAmersSign } from '../objects/IAmersSign.js';

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
    this.desktopControls = new DesktopControls(this);

    // Level system
    this._currentLevel = 1;
    this._levelLoader = null;

    // Clock
    this._clock = new THREE.Clock();

    // Notification system
    this._notification = null;
    this._notifTimer = 0;

    // HUD elements
    this._hudObjective = null;
    this._hudInteract = null;
    this._crosshair = null;
    this._controlsHint = null;
    this._controlsTimer = 8;
    this._unsubGameComplete = null;
    this._iamersSign = null;
    this._pendingTimers = [];
    this._loadingLevel = false;

    this._setupResize();
    this._setupNotifications();
    this._setupHUD();
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
    if (this._loadingLevel) return;
    this._loadingLevel = true;
    this._currentLevel = n;
    try {
      const config = (await import(`../levels/level${n}.js`)).default;
      if (!this._levelLoader) {
        this._levelLoader = new LevelLoader(this);
      }
      await this._levelLoader.load(config);
      this.collisionSystem.setGroundPlane(0);
      this._setupPuzzlesForLevel(n);
    } catch (e) {
      console.warn(`Level ${n} not found:`, e);
      this._showLevelFallback(n);
    } finally {
      this._loadingLevel = false;
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
    if (this._iamersSign) this._iamersSign.update(dt);
    this._updateNotification(dt);
    this._updateHUD(dt);
    if (this._levelLoader) this._levelLoader.update(dt);

    this.renderer.render(this.scene, this.camera);
  }

  _setupPuzzlesForLevel(n) {
    // Clean up previous level
    if (this._unsubGameComplete) this._unsubGameComplete();
    // Clear pending level-transition timers
    for (const t of this._pendingTimers) clearTimeout(t);
    this._pendingTimers.length = 0;
    if (this._iamersSign) { this._iamersSign.dispose(); this._iamersSign = null; }
    // Dispose puzzle scene objects before clearing
    for (const puzzle of this.puzzleManager.puzzles.values()) puzzle.dispose();
    this.puzzleManager.dispose();
    this.interactionSystem.reset();

    switch (n) {
      case 1: {
        const puzzle = new CrystalCollectionPuzzle(
          this.eventBus, this.scene, this.interactionSystem
        );
        this.puzzleManager.register(puzzle);
        this.setObjective('The Floating Island', 'Find 3 AI Data Crystals and click them to collect!');
        break;
      }
      case 2: {
        const puzzle = new NeuralSequencePuzzle(
          this.eventBus, this.scene, this.interactionSystem
        );
        this.puzzleManager.register(puzzle);
        this.setObjective('The AI Laboratory', 'Activate neural nodes in the correct sequence!');
        break;
      }
      case 3: {
        const puzzle = new BridgeActivationPuzzle(
          this.eventBus, this.scene, this.interactionSystem, this.collisionSystem
        );
        this.puzzleManager.register(puzzle);
        this.setObjective('The Crystal Cavern', 'Find the lever and pull it to raise the crystal bridge!');
        break;
      }
    }

    this.puzzleManager.init();

    // Create IAMERS sign for this level
    const signConfigs = {
      1: { position: new THREE.Vector3(0, 4, -5), color: '#ffcc44' },
      2: { position: new THREE.Vector3(0, 3.5, -10), color: '#00ccff' },
      3: { position: new THREE.Vector3(0, 4, -8), color: '#44ff88' },
    };
    const signCfg = signConfigs[n];
    if (signCfg) {
      this._iamersSign = new IAmersSign(this.scene, this.interactionSystem, signCfg);
    }

    // Listen for game completion
    this._unsubGameComplete = this.eventBus.on('game:complete', () => {
      const t1 = setTimeout(() => {
        const nextLevel = n < 3 ? n + 1 : null;
        const msg = nextLevel
          ? `Level complete! Loading next level...`
          : `All levels complete! IAmers VR Showcase finished!`;
        this.eventBus.emit('notification', { text: msg });

        // Update objective HUD
        if (this._hudObjective) {
          const obj = this._hudObjective.querySelector('.objective');
          if (obj) obj.textContent = nextLevel ? 'Level complete!' : 'All levels complete!';
          const prog = this._hudObjective.querySelector('.progress');
          if (prog) prog.textContent = '';
        }

        // Auto-load next level
        if (nextLevel) {
          const t2 = setTimeout(() => this._loadLevel(nextLevel), 3000);
          this._pendingTimers.push(t2);
        }
      }, 1500);
      this._pendingTimers.push(t1);
    });
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

  _setupHUD() {
    this._hudObjective = document.getElementById('hud-objective');
    this._hudInteract = document.getElementById('hud-interact');
    this._crosshair = document.getElementById('crosshair');
    this._controlsHint = document.getElementById('controls-hint');

    // Desktop hover raycaster
    this._hoverRaycaster = new THREE.Raycaster();
    this._hoverRaycaster.far = 10;

    this.eventBus.on('notification', (data) => {
      // Also update objective HUD with notifications
      if (this._hudObjective) {
        const prog = this._hudObjective.querySelector('.progress');
        if (prog && data.text.includes('/')) {
          prog.textContent = data.text;
        }
      }
    });
  }

  setObjective(levelName, objectiveText) {
    if (!this._hudObjective) return;
    this._hudObjective.innerHTML = `
      <div class="level-name">${levelName}</div>
      <div class="objective">${objectiveText}</div>
      <div class="progress"></div>
    `;
    this._hudObjective.classList.add('visible');
  }

  _updateHUD(dt) {
    // Fade controls hint
    if (this._controlsTimer > 0) {
      this._controlsTimer -= dt;
      if (this._controlsTimer <= 0 && this._controlsHint) {
        this._controlsHint.style.opacity = '0';
      }
    }

    // Desktop hover detection for interaction hint
    if (this.renderer.xr.isPresenting) return;
    if (!document.pointerLockElement) return;

    this._hoverRaycaster.setFromCamera({ x: 0, y: 0 }, this.camera);
    const meshes = [];
    for (const inter of this.interactionSystem.interactables) {
      if (inter.enabled) meshes.push(inter.mesh);
    }
    const hits = this._hoverRaycaster.intersectObjects(meshes, false);

    if (hits.length > 0) {
      const inter = hits[0].object.userData.interactable;
      if (inter && inter.enabled) {
        if (this._crosshair) this._crosshair.classList.add('active');
        if (this._hudInteract) {
          const hint = inter.type === 'grab' ? 'Click to grab' :
                       inter.type === 'activate' ? 'Click to activate' : 'Click to interact';
          this._hudInteract.textContent = hint;
          this._hudInteract.classList.add('visible');
        }
        // Apply desktop hover effect on 3D object
        this.interactionSystem.setDesktopHover(inter);
        return;
      }
    }
    if (this._crosshair) this._crosshair.classList.remove('active');
    if (this._hudInteract) this._hudInteract.classList.remove('visible');
    this.interactionSystem.setDesktopHover(null);
  }
}
