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
import { init as behaviorsInit, update as behaviorsUpdate } from '../custom/behaviors.js';

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

    // Clock
    this._clock = new THREE.Clock();

    this._setupResize();
  }

  async init() {
    this.vrSetup.init();

    // Check for ?level=N URL param — load specific level directly
    const params = new URLSearchParams(window.location.search);
    const levelParam = parseInt(params.get('level'));
    if (!isNaN(levelParam) && levelParam >= 0) {
      this._loadLevel(levelParam);
      this.renderer.setAnimationLoop((time, frame) => this._loop(time, frame));
      return;
    }

    // Try loading title screen — if it exists, show it first
    let titleConfig = null;
    try {
      titleConfig = (await import('../levels/titleScreen.js')).default;
    } catch {
      // No title screen file — skip
    }

    if (titleConfig) {
      try {
        await this._loadTitleScreen(titleConfig);
      } catch (err) {
        console.error('Title screen load failed:', err);
        this._loadLevel(1);
      }
    } else {
      this._loadLevel(1);
    }

    this.renderer.setAnimationLoop((time, frame) => this._loop(time, frame));
  }

  async _loadLevel(n) {
    // Clean up title screen if active
    if (this._titleGroup) {
      this.scene.remove(this._titleGroup);
      this._titleGroup.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (child.material.map) child.material.map.dispose();
          child.material.dispose();
        }
      });
      this._titleGroup = null;
      this._titleScreenActive = false;
    }

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

      // HUD — show level title
      const puzzleCount = this.puzzleManager.order.length;
      this.hud.onLevelLoaded(config.name || `Level ${n}`, puzzleCount);

      // Run custom behaviors init (written by editor Engine customizer)
      if (behaviorsInit) behaviorsInit(this);
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

  async _loadTitleScreen(config) {
    this._currentLevel = 0;
    this._titleScreenActive = true;

    // Load environment and decorations using regular LevelLoader
    if (!this._levelLoader) {
      this._levelLoader = new LevelLoader(this);
    }
    await this._levelLoader.load(config);
    this.collisionSystem.setGroundPlane(0);

    // Disable locomotion during title screen
    this.locomotion.enabled = false;

    // Create 3D title text using canvas texture
    const titleGroup = new THREE.Group();
    titleGroup.name = '_titleScreen';

    if (config.title) {
      const t = config.title;
      const pos = t.position || [0, 3, -5];
      const titleFontSize = t.fontSize || 72;
      const titleScale = t.scale || [4, 1, 1];
      const subFontSize = t.subtitleFontSize || 36;
      const subScale = t.subtitleScale || [3, 0.5, 1];
      const promptFontSize = t.startPromptFontSize || 28;
      const promptScale = t.startPromptScale || [3, 0.4, 1];

      // Main title
      const titleMesh = this._createTextPlane(
        t.text || 'Untitled',
        { fontSize: titleFontSize, color: t.color || '#ffffff', width: 1024, height: 256 }
      );
      titleMesh.scale.set(titleScale[0], titleScale[1], titleScale[2]);
      titleMesh.position.set(pos[0], pos[1], pos[2]);

      // Emissive glow backing (sized to match title scale)
      const glowMat = new THREE.MeshBasicMaterial({
        color: t.emissiveColor || '#4488ff',
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const glowW = titleScale[0] * 1.25;
      const glowH = titleScale[1] * 1.5;
      const glowMesh = new THREE.Mesh(new THREE.PlaneGeometry(glowW, glowH), glowMat);
      glowMesh.position.copy(titleMesh.position);
      glowMesh.position.z += 0.05;
      titleGroup.add(glowMesh);
      titleGroup.add(titleMesh);

      // Subtitle
      if (t.subtitle) {
        const subMesh = this._createTextPlane(
          t.subtitle,
          { fontSize: subFontSize, color: t.color || '#aaaacc', width: 1024, height: 128 }
        );
        subMesh.scale.set(subScale[0], subScale[1], subScale[2]);
        subMesh.position.set(pos[0], pos[1] - titleScale[1] - 0.2, pos[2]);
        titleGroup.add(subMesh);
      }

      // "Press to start" prompt (pulsing)
      const promptText = config.startPrompt || 'Click or press trigger to start';
      const promptMesh = this._createTextPlane(
        promptText,
        { fontSize: promptFontSize, color: '#aaaaaa', width: 1024, height: 96 }
      );
      promptMesh.scale.set(promptScale[0], promptScale[1], promptScale[2]);
      promptMesh.position.set(pos[0], pos[1] - titleScale[1] - subScale[1] - 0.8, pos[2]);
      promptMesh.name = '_titlePrompt';
      titleGroup.add(promptMesh);
    }

    this.scene.add(titleGroup);
    this._titleGroup = titleGroup;

    // Block pointer lock during title screen
    this._titleBlockPointerLock = true;

    // Delay input registration so initial click-to-focus doesn't dismiss instantly
    await new Promise(r => setTimeout(r, 800));

    // Guard: might have been dismissed during the delay
    if (!this._titleScreenActive) return;

    // Listen for start input
    this._titleStartHandler = () => this._dismissTitleScreen();

    // Desktop: click
    this.renderer.domElement.addEventListener('click', this._titleStartHandler);
    // VR: trigger
    this.eventBus.on('TRIGGER_RIGHT_DOWN', this._titleStartHandler);
    this.eventBus.on('TRIGGER_LEFT_DOWN', this._titleStartHandler);
    // Keyboard: any key
    this._titleKeyHandler = (e) => {
      if (e.key === 'Escape') return;
      this._dismissTitleScreen();
    };
    document.addEventListener('keydown', this._titleKeyHandler);
  }

  _dismissTitleScreen() {
    if (!this._titleScreenActive) return;
    this._titleScreenActive = false;

    // Remove listeners (guard in case they weren't registered yet)
    if (this._titleStartHandler) {
      this.renderer.domElement.removeEventListener('click', this._titleStartHandler);
      this.eventBus.off('TRIGGER_RIGHT_DOWN', this._titleStartHandler);
      this.eventBus.off('TRIGGER_LEFT_DOWN', this._titleStartHandler);
    }
    if (this._titleKeyHandler) {
      document.removeEventListener('keydown', this._titleKeyHandler);
    }

    // Allow pointer lock again
    this._titleBlockPointerLock = false;

    // Re-enable locomotion
    this.locomotion.enabled = true;

    // Fade to level 1
    this.levelTransition.triggerTransition(1);
  }

  /**
   * Create a transparent plane with canvas-rendered text.
   */
  _createTextPlane(text, { fontSize = 48, color = '#ffffff', width = 1024, height = 256 } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = color;
    ctx.font = `bold ${fontSize}px Arial, Helvetica, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, width / 2, height / 2);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
    return mesh;
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
    if (behaviorsUpdate) behaviorsUpdate(this, dt);

    // Animate title screen prompt (pulse opacity)
    if (this._titleScreenActive && this._titleGroup) {
      const prompt = this._titleGroup.getObjectByName('_titlePrompt');
      if (prompt) {
        prompt.material.opacity = 0.5 + Math.sin(performance.now() * 0.003) * 0.5;
      }
    }

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
