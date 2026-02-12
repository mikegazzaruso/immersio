import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { ViewportManager } from './viewport/ViewportManager.js';
import { EditorLayout } from './ui/EditorLayout.js';
import { AIPromptInterpreter } from './ai/AIPromptInterpreter.js';
import { ObjectPreviewFactory } from './ai/ObjectPreviewFactory.js';
import { UndoRedoManager } from './ai/UndoRedoManager.js';
import { LevelConfigSerializer } from './serializer/LevelConfigSerializer.js';
import { OpenAIClient } from './ai/OpenAIClient.js';

export class EditorApp {
  constructor({ container, gameSlug, levelNumber }) {
    this.container = container;
    this.gameSlug = gameSlug;
    this.levelNumber = levelNumber;

    this.scene = null;
    this.renderer = null;
    this.viewportManager = null;
    this.layout = null;

    // AI systems
    this.openaiClient = new OpenAIClient();
    this.interpreter = new AIPromptInterpreter(this.openaiClient);
    this.previewFactory = new ObjectPreviewFactory();
    this.undoManager = new UndoRedoManager();
    this.serializer = new LevelConfigSerializer(gameSlug, levelNumber);

    // Game server state
    this._gameServerRunning = false;
    this._gameWindowName = 'immersio-game';
    this._hasTitleScreen = false;

    // Editor state
    this._editorObjects = []; // All user-created objects in the scene
    this._environmentConfig = null;
    this._decorationsConfig = [];
    this._levelName = `Level ${levelNumber}`;
    this._playerSpawn = { position: [0, 0, 8], rotationY: Math.PI };
    this._exitConfig = null;
    this._objectCounter = {}; // Tracks numbering per type: { rock: 5, tree: 3, ... }

    this._raycaster = new THREE.Raycaster();
  }

  async init() {
    // Build UI layout first
    this.layout = new EditorLayout({
      container: this.container,
      gameSlug: this.gameSlug,
      levelNumber: this.levelNumber,
    });
    this.layout.build();

    // Setup Three.js
    this.setupScene();
    this.setupRenderer();
    this.addLighting();
    this.setupViewports();

    // Wire all events
    this._setupUIEvents();
    this._setupViewportInteraction();
    this._setupSelectionSync();
    this._setupGizmoSync();
    this._setupUndoRedoSync();
    this._setupKeyboard();

    // Try loading existing level
    await this._autoLoadLevel();

    // Settings integration
    this._setupSettings();

    this.layout.updateStatus({ objectCount: this._editorObjects.length, lastAction: 'Editor ready' });
    this.animate();

    console.log(`Immersio Editor — ${this.gameSlug} level ${this.levelNumber}`);
  }

  setupScene() {
    this.scene = new THREE.Scene();
  }

  setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    const { width, height } = this.layout.getViewportSize();
    this.renderer.setSize(width, height);
    this.renderer.setClearColor(0x1a1a2e);
    this.renderer.autoClear = false;

    // Required for correct GLB/PBR texture display
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
  }

  setupViewports() {
    const viewportEl = this.layout.getViewportElement();
    this.viewportManager = new ViewportManager({
      container: viewportEl,
      scene: this.scene,
      renderer: this.renderer,
    });
  }

  addLighting() {
    const ambient = new THREE.AmbientLight(0x404060, 0.6);
    ambient.name = '_editor_ambient';
    this.scene.add(ambient);

    const directional = new THREE.DirectionalLight(0xffffff, 0.8);
    directional.position.set(10, 20, 10);
    directional.name = '_editor_directional';
    this.scene.add(directional);
  }

  // ---- Apply environment config to scene ----

  _applyEnvironmentToScene(env) {
    if (!env) return;

    // Remove previously applied environment objects
    this._clearEnvironmentFromScene();

    // Background color
    if (env.sky) {
      this.scene.background = new THREE.Color(env.sky.bottomColor || '#aaddff');
      this.renderer.setClearColor(new THREE.Color(env.sky.bottomColor || '#aaddff'));
    } else if (env.enclosure) {
      const bgColor = env.enclosure.wallColor || '#222222';
      this.scene.background = new THREE.Color(bgColor);
      this.renderer.setClearColor(new THREE.Color(bgColor));

      // Build enclosure walls/floor/ceiling preview
      const { width = 20, depth = 20, height = 6 } = env.enclosure;
      const wallMat = new THREE.MeshLambertMaterial({
        color: env.enclosure.wallColor || '#333333',
        emissive: env.enclosure.emissive || '#000000',
        emissiveIntensity: env.enclosure.emissiveIntensity || 0,
        side: THREE.BackSide,
      });
      const floorMat = new THREE.MeshLambertMaterial({
        color: env.enclosure.floorColor || '#444444',
      });
      const ceilMat = new THREE.MeshLambertMaterial({
        color: env.enclosure.ceilingColor || '#222222',
        side: THREE.BackSide,
      });

      const floor = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), floorMat);
      floor.rotation.x = -Math.PI / 2;
      floor.name = '_env_floor';
      this.scene.add(floor);

      const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), ceilMat);
      ceiling.rotation.x = Math.PI / 2;
      ceiling.position.y = height;
      ceiling.name = '_env_ceiling';
      this.scene.add(ceiling);

      // Four walls
      const wallGeo = new THREE.PlaneGeometry(width, height);
      const makeWall = (pos, rotY, name) => {
        const wall = new THREE.Mesh(wallGeo, wallMat.clone());
        wall.position.set(pos[0], height / 2, pos[1]);
        wall.rotation.y = rotY;
        wall.name = name;
        this.scene.add(wall);
      };
      makeWall([0, -depth / 2], 0, '_env_wall_back');
      makeWall([0, depth / 2], Math.PI, '_env_wall_front');

      const sideGeo = new THREE.PlaneGeometry(depth, height);
      const makeSideWall = (pos, rotY, name) => {
        const wall = new THREE.Mesh(sideGeo, wallMat.clone());
        wall.position.set(pos[0], height / 2, pos[1]);
        wall.rotation.y = rotY;
        wall.name = name;
        this.scene.add(wall);
      };
      makeSideWall([-width / 2, 0], Math.PI / 2, '_env_wall_left');
      makeSideWall([width / 2, 0], -Math.PI / 2, '_env_wall_right');

      // Trim line (emissive stripe at floor level)
      if (env.enclosure.trimColor) {
        const trimMat = new THREE.MeshBasicMaterial({ color: env.enclosure.trimColor });
        const trimH = 0.05;
        const perimeter = [
          { pos: [0, trimH / 2, -depth / 2 + 0.01], w: width, name: '_env_trim_back' },
          { pos: [0, trimH / 2, depth / 2 - 0.01], w: width, name: '_env_trim_front' },
          { pos: [-width / 2 + 0.01, trimH / 2, 0], w: depth, name: '_env_trim_left', rotY: Math.PI / 2 },
          { pos: [width / 2 - 0.01, trimH / 2, 0], w: depth, name: '_env_trim_right', rotY: Math.PI / 2 },
        ];
        for (const t of perimeter) {
          const trimGeo = new THREE.PlaneGeometry(t.w, trimH);
          const trimMesh = new THREE.Mesh(trimGeo, trimMat);
          trimMesh.position.set(t.pos[0], t.pos[1], t.pos[2]);
          if (t.rotY) trimMesh.rotation.y = t.rotY;
          trimMesh.name = t.name;
          this.scene.add(trimMesh);
        }
      }
    } else if (env.background) {
      this.scene.background = new THREE.Color(env.background);
      this.renderer.setClearColor(new THREE.Color(env.background));
    }

    // Ground plane (outdoor)
    if (env.ground) {
      const groundMat = new THREE.MeshLambertMaterial({ color: env.ground.color || '#557744' });
      const radius = env.ground.radius || 50;
      const ground = new THREE.Mesh(new THREE.CircleGeometry(radius, 64), groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -0.01;
      ground.name = '_env_ground';
      this.scene.add(ground);
    }

    // Fog
    if (env.fog) {
      this.scene.fog = new THREE.FogExp2(env.fog.color || '#aaddff', env.fog.density || 0.015);
    } else {
      this.scene.fog = null;
    }

    // Replace editor lights with environment lights
    this._removeByName('_editor_ambient');
    this._removeByName('_editor_directional');

    // Ambient light
    if (env.ambient) {
      const amb = new THREE.AmbientLight(env.ambient.color || '#ffffff', env.ambient.intensity || 0.3);
      amb.name = '_env_ambient';
      this.scene.add(amb);
    }

    // Hemisphere light
    if (env.hemisphere) {
      const hemi = new THREE.HemisphereLight(
        env.hemisphere.skyColor || '#ffffff',
        env.hemisphere.groundColor || '#444444',
        env.hemisphere.intensity || 0.6
      );
      hemi.name = '_env_hemisphere';
      this.scene.add(hemi);
    }

    // Directional light
    if (env.directional) {
      const dir = new THREE.DirectionalLight(env.directional.color || '#ffffff', env.directional.intensity || 1.0);
      const p = env.directional.position || [10, 20, 10];
      dir.position.set(p[0], p[1], p[2]);
      dir.name = '_env_directional';
      this.scene.add(dir);
    }

    // Point lights
    if (env.pointLights) {
      env.pointLights.forEach((pl, i) => {
        const light = new THREE.PointLight(pl.color || '#ffffff', pl.intensity || 1, pl.distance || 20);
        const p = pl.position || [0, 4, 0];
        light.position.set(p[0], p[1], p[2]);
        light.name = `_env_pointlight_${i}`;
        this.scene.add(light);
      });
    }

    // Spot lights
    if (env.spotLights) {
      env.spotLights.forEach((sl, i) => {
        const light = new THREE.SpotLight(sl.color || '#ffffff', sl.intensity || 1, sl.distance || 20, sl.angle || 0.5, sl.penumbra || 0.3);
        const p = sl.position || [0, 4, 0];
        light.position.set(p[0], p[1], p[2]);
        if (sl.target) {
          light.target.position.set(sl.target[0], sl.target[1], sl.target[2]);
          this.scene.add(light.target);
        }
        light.name = `_env_spotlight_${i}`;
        this.scene.add(light);
      });
    }
  }

  _clearEnvironmentFromScene() {
    const toRemove = [];
    this.scene.traverse((child) => {
      if (child.name && child.name.startsWith('_env_')) {
        toRemove.push(child);
      }
    });
    for (const obj of toRemove) {
      obj.parent?.remove(obj);
    }
    this.scene.fog = null;
  }

  _removeByName(name) {
    const obj = this.scene.getObjectByName(name);
    if (obj) obj.parent?.remove(obj);
  }

  /** Get a numbered name: "rock" → "rock1", "rock2", etc. */
  _nextNumberedName(baseName) {
    // Normalize: strip spaces, camelCase-friendly
    const key = baseName.replace(/\s+/g, '');
    if (!this._objectCounter[key]) this._objectCounter[key] = 0;
    this._objectCounter[key]++;
    return `${key}${this._objectCounter[key]}`;
  }

  /**
   * Spawn individual decoration objects — expands each config's `count`
   * into N individual previews placed at random positions within the radius range.
   * Each object is numbered: rock1, rock2, etc.
   *
   * Supports two formats:
   *   - New: raw geometry (has `parts` array or `geometry` field)
   *   - Legacy: predefined type (has `type` field like "palmTree", "rock")
   */
  _spawnDecorations(decorations) {
    const nameCounters = {};

    for (const dec of decorations) {
      const count = dec.count || 1;
      const radiusRange = dec.radius || [3, 15];
      const rMin = Array.isArray(radiusRange) ? radiusRange[0] : 0;
      const rMax = Array.isArray(radiusRange) ? radiusRange[1] : radiusRange;
      const baseName = dec.name || dec.type || 'object';

      // Store the original config once (for serialization)
      this._decorationsConfig.push(dec);

      if (!nameCounters[baseName]) nameCounters[baseName] = 0;

      // Detect format: new (geometry-based) vs legacy (type-based)
      // dec.geometry must be a string (geometry class name), not an object
      const isNewFormat = dec.parts || (dec.geometry && typeof dec.geometry === 'string');

      for (let i = 0; i < count; i++) {
        nameCounters[baseName]++;
        const idx = nameCounters[baseName];

        // Random position within radius range (circular distribution)
        const angle = Math.random() * Math.PI * 2;
        const dist = rMin + Math.random() * (rMax - rMin);
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist;

        let mesh;

        if (isNewFormat) {
          if (dec.parts) {
            // Multi-part decoration → composite
            mesh = this.previewFactory.createCompositePreview({
              label: baseName,
              parts: dec.parts,
              worldPosition: [x, 0, z],
            });
          } else {
            // Single-geometry decoration → mesh
            mesh = this.previewFactory.createMeshPreview({
              name: baseName,
              geometry: dec.geometry,
              args: dec.args || [],
              material: dec.material || { color: '#888888' },
              position: dec.position || [x, 0, z],
              rotation: dec.rotation || [0, 0, 0],
              scale: dec.scale || [1, 1, 1],
            });
            // Override position for scattered instances (unless count=1 with explicit position)
            if (count > 1 || !dec.position) {
              mesh.position.set(x, dec.position?.[1] || 0, z);
            }
          }

          // Random scale variation
          if (dec.scaleRange && mesh) {
            const [sMin, sMax] = dec.scaleRange;
            const s = sMin + Math.random() * (sMax - sMin);
            mesh.scale.setScalar(s);
          }

          // Mark as decoration for the editor
          if (mesh) {
            mesh.userData.editorType = 'decoration';
            mesh.userData.editorConfig = structuredClone(dec);
          }
        } else {
          // Legacy format: predefined type
          const singleConfig = { ...dec, count: 1, _editorPosition: [x, 0, z] };
          mesh = this.previewFactory.createDecorationPreview(singleConfig);
        }

        if (mesh) {
          const numberedLabel = `${baseName}${idx}`;
          mesh.userData.editorLabel = numberedLabel;
          mesh.name = numberedLabel;
          mesh.userData.selectable = true;
          this.scene.add(mesh);
          this._editorObjects.push(mesh);
        }
      }
    }
  }

  /**
   * Remove all decoration editor objects from the scene.
   */
  _clearEditorDecorations() {
    const keep = [];
    for (const obj of this._editorObjects) {
      if (obj.userData.editorType === 'decoration') {
        this.scene.remove(obj);
      } else {
        keep.push(obj);
      }
    }
    this._editorObjects = keep;
    this._decorationsConfig = [];
  }

  // ---- Auto-load existing level ----

  async _autoLoadLevel() {
    // Check if a title screen already exists
    try {
      const tsRes = await fetch(`/__editor_load?path=games/${this.gameSlug}/src/levels/titleScreen.js`);
      if (tsRes.ok) this._hasTitleScreen = true;
    } catch { /* no title screen yet */ }

    const config = await this.serializer.load();
    if (!config) return;

    this._levelName = config.name || this._levelName;
    this._environmentConfig = config.environment || null;
    this._playerSpawn = config.playerSpawn || this._playerSpawn;
    this._exitConfig = config.exit || null;

    // Restore engine instructions
    if (config.engineInstructions) {
      this.layout.enginePanel.setInstructions(config.engineInstructions);
    }

    // Apply environment visually
    if (this._environmentConfig) {
      this._applyEnvironmentToScene(this._environmentConfig);
    }

    // Populate decorations (expand count → individual objects)
    if (config.decorations) {
      this._spawnDecorations(config.decorations);
    }

    // Populate props — load actual GLB models
    if (config.props) {
      await this._loadPropsFromConfig(config.props);
    }

    this._refreshSceneTree();
    this.layout.updateStatus({
      objectCount: this._editorObjects.length,
      lastAction: `Loaded: ${this._levelName}`,
    });
  }

  // ---- Settings ----

  _setupSettings() {
    const sp = this.layout.settingsPanel;

    // Initial sync: ensure OpenAIClient has the provider/key/model/baseURL from SettingsPanel
    const provider = sp.getProvider();
    this.openaiClient.provider = provider;
    if (provider === 'ollama') {
      this.openaiClient.baseURL = '/api/ollama';
      this.openaiClient.model = sp.getModel();
    } else {
      this.openaiClient.baseURL = '/api/openai';
      if (sp.hasApiKey()) {
        this.openaiClient.apiKey = sp.getApiKey();
        // Validate model is an OpenAI model, not a leftover Ollama name
        const model = sp.getModel();
        const validOpenAI = ['gpt-5.2', 'gpt-4o', 'gpt-4o-mini'];
        this.openaiClient.model = validOpenAI.includes(model) ? model : 'gpt-4o';
      }
    }

    // Update toolbar indicator
    this.layout.toolbar.setSettingsIndicator(!this.openaiClient.isConfigured);

    // Open settings from toolbar
    this.layout.on('openSettings', () => {
      sp.show();
    });

    // Settings saved — sync OpenAI client
    this.layout.on('settingsChanged', ({ provider, apiKey, model, baseURL }) => {
      if (provider) this.openaiClient.provider = provider;
      if (apiKey !== undefined) this.openaiClient.apiKey = apiKey;
      if (model) this.openaiClient.model = model;
      if (baseURL) this.openaiClient.baseURL = baseURL;
      this.layout.toolbar.setSettingsIndicator(!this.openaiClient.isConfigured);

      const label = provider === 'ollama'
        ? `Ollama configured (${this.openaiClient.model})`
        : this.openaiClient.isConfigured
          ? `OpenAI configured (${this.openaiClient.model})`
          : 'API key cleared';
      this.layout.updateStatus({ lastAction: label });
    });

    // First-run: auto-open settings if not configured
    if (!sp.isConfigured()) {
      this.layout.updateStatus({ lastAction: 'Open Settings to configure OpenAI or Ollama' });
      // Small delay so the editor renders first
      setTimeout(() => sp.show(), 300);
    }
  }

  // ---- UI Event Wiring ----

  _setupUIEvents() {
    // Save
    this.layout.on('save', () => this._handleSave());

    // Load
    this.layout.on('load', () => this._handleLoad());

    // Import GLB assets
    this.layout.on('importAssets', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.glb';
      input.multiple = true;
      input.addEventListener('change', () => {
        if (input.files.length > 0) {
          this._handleImportAssets(input.files);
        }
      });
      input.click();
    });

    // Undo / Redo (toolbar buttons — UndoRedoManager already handles keyboard)
    this.layout.on('undo', () => {
      const action = this.undoManager.undo();
      if (action) {
        this._refreshSceneTree();
        this.layout.updateStatus({
          objectCount: this._editorObjects.length,
          lastAction: `Undo: ${action.type}`,
        });
      }
    });

    this.layout.on('redo', () => {
      const action = this.undoManager.redo();
      if (action) {
        this._refreshSceneTree();
        this.layout.updateStatus({
          objectCount: this._editorObjects.length,
          lastAction: `Redo: ${action.type}`,
        });
      }
    });

    // Grid toggle
    this.layout.on('toggleGrid', (visible) => {
      const grids = this.viewportManager._viewGrids;
      for (const grid of Object.values(grids)) {
        grid.userData._gridEnabled = visible;
      }
      this.layout.updateStatus({ lastAction: visible ? 'Grid shown' : 'Grid hidden' });
    });

    // Axes toggle
    this.layout.on('toggleAxes', (visible) => {
      for (const vp of Object.values(this.viewportManager.viewports)) {
        vp.axisIndicator._visible = visible;
      }
      this.layout.updateStatus({ lastAction: visible ? 'Axes shown' : 'Axes hidden' });
    });

    // Run Game (from title screen or level 1)
    this.layout.on('runGame', () => this._handleRunGame());

    // Run Level (current editor level only)
    this.layout.on('runLevel', () => this._handleRunLevel());

    // Zoom to fit
    this.layout.on('zoomToFit', () => this._zoomToFit());

    // Engine customization dialog (from toolbar button)
    this.layout.on('engineDialog', () => {
      this.layout.enginePanel.show();
    });

    // Engine prompt submitted
    this.layout.on('enginePrompt', ({ prompt }) => {
      this._handleEnginePrompt(prompt);
    });

    // AI environment dialog (from toolbar button) — confirm if env already exists
    this.layout.on('aiEnvDialog', () => {
      this.layout.aiPrompt.showEnvDialog(!!this._environmentConfig);
    });

    // AI object prompt
    this.layout.on('aiPrompt', ({ prompt, coords }) => {
      this._handleAIPrompt(prompt, coords);
    });

    // AI environment prompt
    this.layout.on('aiEnvPrompt', ({ prompt }) => {
      this._handleAIEnvPrompt(prompt);
    });

    // About dialog
    this.layout.on('openAbout', () => {
      this.layout.showAbout();
    });

    // Init level (toolbar button → confirm dialog → clear + save)
    this.layout.on('initLevel', () => {
      this.layout.showInitConfirm();
    });
    this.layout.on('initLevelConfirmed', () => {
      this._handleInitLevel();
    });

    // Title Screen dialog (from toolbar button)
    this.layout.on('titleScreenDialog', () => {
      this.layout.showTitleScreenDialog(this._hasTitleScreen);
    });

    // Title Screen prompt submitted
    this.layout.on('titleScreenPrompt', ({ prompt, titleText, subtitle, onDone }) => {
      this._handleTitleScreenPrompt(prompt, titleText, subtitle, onDone);
    });

    // Modify object with AI (right-click → "Modify with AI...")
    this.layout.on('modifyWithAI', ({ item, prompt, onDone }) => {
      this._handleModifyWithAI(item, prompt, onDone);
    });

    // Scene tree selection (supports both objects and composite parts)
    this.layout.on('select', (item) => {
      if (!item) {
        this.viewportManager.selection.deselect();
        this.layout.updateProperties(null);
        this.layout.updateStatus({ lastAction: 'Deselected' });
        return;
      }

      // Check if this is a composite part (id contains __)
      if (item.parentId) {
        // Select the parent composite in the viewport
        const parentObj = this._editorObjects.find(o =>
          (o.name || o.uuid) === item.parentId
        );
        if (parentObj) {
          this.viewportManager.selection.select(parentObj);
        }
        this.layout.updateProperties(item);
        this.layout.updateStatus({ lastAction: `Selected part: ${item.name}` });
        return;
      }

      // Regular object selection
      const obj = this._editorObjects.find(o =>
        (o.name || o.uuid) === item.id
      );
      if (obj) {
        this.viewportManager.selection.select(obj);
      }
      this.layout.updateProperties(item);
      this.layout.updateStatus({ lastAction: `Selected: ${item.name || item.id}` });
    });

    // Property changes from panel (supports part color changes)
    this.layout.on('propertyChange', ({ prop, value }) => {
      // Handle composite part color change: prop = "partColor:<parentId>:<partIndex>"
      if (prop.startsWith('partColor:')) {
        const parts = prop.split(':');
        const parentId = parts[1];
        const partIndex = parseInt(parts[2], 10);
        this._changePartColor(parentId, partIndex, value);
        return;
      }
      this._handlePropertyChange(prop, value);
    });

    // Delete selected
    this.layout.on('delete', () => {
      this._handleDelete();
    });

    // Panel resize → viewport relayout
    this.layout.on('resize', () => {
      this.viewportManager.layout();
    });
  }

  // ---- Viewport Interaction ----

  _setupViewportInteraction() {
    const viewportEl = this.layout.getViewportElement();

    // Double-click in viewport → AI prompt
    // Listen on each viewport's event layer directly — the event layers (z-index:1)
    // sit on top of the canvas and can prevent dblclick from bubbling to viewportEl.
    for (const vp of Object.values(this.viewportManager.viewports)) {
      vp._eventLayer.addEventListener('dblclick', (e) => {
        if (e.target.closest('.ai-prompt-overlay') || e.target.closest('.ai-prompt-container')) return;

        const rect = viewportEl.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const ndc = vp.getNDC(x, y);
        this._raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), vp.camera);

        // Intersect ground plane (Y=0)
        const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const worldPos = new THREE.Vector3();
        if (this._raycaster.ray.intersectPlane(groundPlane, worldPos)) {
          this.layout.showAIPrompt(x, y, { x: worldPos.x, y: worldPos.y, z: worldPos.z });
        }
      });
    }

    // Mouse move → status bar cursor
    viewportEl.addEventListener('mousemove', (e) => {
      const rect = viewportEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      for (const vp of Object.values(this.viewportManager.viewports)) {
        if (vp.containsPoint(x, y)) {
          const ndc = vp.getNDC(x, y);
          this._raycaster.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), vp.camera);

          const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
          const worldPos = new THREE.Vector3();
          if (this._raycaster.ray.intersectPlane(groundPlane, worldPos)) {
            this.layout.updateStatus({ cursor: { x: worldPos.x, y: worldPos.y, z: worldPos.z } });
          }
          break;
        }
      }
    });

    // Click outside AI prompt → hide
    viewportEl.addEventListener('mousedown', (e) => {
      if (!e.target.closest('.ai-prompt-container')) {
        this.layout.aiPrompt.hide();
      }
    });
  }

  // ---- Selection ↔ PropertiesPanel sync ----

  _setupSelectionSync() {
    this.viewportManager.selection.onChange((obj) => {
      if (obj) {
        const treeItem = this._objectToTreeItem(obj);
        this.layout.updateProperties(treeItem);
        this.layout.updateStatus({ lastAction: `Selected: ${treeItem.name}` });
      } else {
        this.layout.updateProperties(null);
      }
    });
  }

  // ---- Transform Gizmo sync ----

  _setupGizmoSync() {
    const gizmo = this.viewportManager.transformGizmo;

    // Real-time property panel updates during gizmo drag
    gizmo.onChange((obj) => {
      if (obj) {
        const treeItem = this._objectToTreeItem(obj);
        this.layout.updateProperties(treeItem);
      }
    });

    // Push undo action when gizmo drag ends
    gizmo.onDragEnd(({ object, oldTransform, newTransform, mode }) => {
      if (!object || !oldTransform) return;
      this.undoManager.pushTransformObject(object, oldTransform, newTransform);
      this._refreshSceneTree();
      const modeLabel = mode === 'translate' ? 'Move' : mode === 'rotate' ? 'Rotate' : 'Scale';
      this.layout.updateStatus({ lastAction: `${modeLabel}: ${object.userData.editorLabel || object.name || 'object'}` });
    });
  }

  // ---- Undo/Redo sync ----

  _setupUndoRedoSync() {
    this.undoManager.onChange((action, isUndo) => {
      // Sync _editorObjects after undo/redo
      if (action.type === 'addObject') {
        if (isUndo) {
          const idx = this._editorObjects.indexOf(action.data.object);
          if (idx >= 0) this._editorObjects.splice(idx, 1);
        } else {
          this._editorObjects.push(action.data.object);
        }
      } else if (action.type === 'removeObject') {
        if (isUndo) {
          this._editorObjects.push(action.data.object);
        } else {
          const idx = this._editorObjects.indexOf(action.data.object);
          if (idx >= 0) this._editorObjects.splice(idx, 1);
        }
      } else if (action.type === 'transformObject') {
        // Transform was undone/redone — update properties panel if this object is selected
        const selected = this.viewportManager.selection.selected;
        if (selected === action.data.object) {
          this.layout.updateProperties(this._objectToTreeItem(selected));
        }
      }
      this._refreshSceneTree();
      this.layout.updateStatus({ objectCount: this._editorObjects.length });
    });
  }

  // ---- Keyboard shortcuts ----

  _setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const mod = e.metaKey || e.ctrlKey;

      if (mod && e.key === 's') {
        e.preventDefault();
        this._handleSave();
      }

      // Transform gizmo mode shortcuts (W=translate, E=rotate, R=scale)
      const gizmo = this.viewportManager.transformGizmo;
      if (!mod && gizmo.isAttached) {
        if (e.key === 'w' || e.key === 'W') {
          gizmo.setMode('translate');
          this.layout.updateStatus({ lastAction: 'Mode: Translate (W)' });
        } else if (e.key === 'e' || e.key === 'E') {
          gizmo.setMode('rotate');
          this.layout.updateStatus({ lastAction: 'Mode: Rotate (E)' });
        } else if (e.key === 'r' || e.key === 'R') {
          gizmo.setMode('scale');
          this.layout.updateStatus({ lastAction: 'Mode: Scale (R)' });
        }
      }
    });
  }

  // ---- AI Prompt Handlers ----

  async _handleAIPrompt(prompt, worldCoords) {
    this.layout.setAIProcessing(true);

    try {
      // Route ALL object creation through the engine path.
      // This produces BOTH geometry (objects array) AND behavior (behaviors.js)
      // in a single AI call — so "treasure chest that bobs" actually bobs.
      const pos = worldCoords
        ? `[${Math.round(worldCoords.x * 10) / 10}, ${Math.round(worldCoords.y * 10) / 10}, ${Math.round(worldCoords.z * 10) / 10}]`
        : '[0, 0, 0]';
      const enginePrompt = `Create this 3D object at world position ${pos}: "${prompt}"`;

      // Build level context
      const decorationTypes = new Set();
      const propNames = [];
      for (const obj of this._editorObjects) {
        if (obj.userData.editorType === 'decoration') {
          const cfg = obj.userData.editorConfig;
          decorationTypes.add(cfg?.name || cfg?.type || 'decoration');
        } else if (obj.userData.editorType === 'prop' || obj.userData.editorType === 'composite' || obj.userData.editorType === 'mesh') {
          propNames.push(obj.userData.editorLabel || obj.name || 'object');
        }
      }

      let existingCode = null;
      try {
        const loadRes = await fetch(`/__editor_load?path=games/${this.gameSlug}/src/custom/behaviors.js`);
        if (loadRes.ok) existingCode = await loadRes.text();
      } catch { /* no existing behaviors */ }

      const levelContext = {
        decorations: [...decorationTypes],
        props: propNames,
        existingCode,
      };

      console.log('[ai-object] Sending to engine path:', enginePrompt);
      const result = await this.interpreter.interpretEngine(enginePrompt, levelContext);
      console.log('[ai-object] Result:', result.success, result.summary);

      if (result.success) {
        // Save behaviors.js (always returned — may be unchanged or updated with new behavior)
        if (result.files) {
          for (const [filePath, content] of Object.entries(result.files)) {
            const savePath = `games/${this.gameSlug}/src/${filePath}`;
            await fetch('/__editor_save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: savePath, content }),
            });
          }
        }

        // Place objects in the editor scene
        if (result.objects && result.objects.length > 0) {
          this._addEngineObjectsToScene(result.objects);

          // Select the last added object
          const lastObj = this._editorObjects[this._editorObjects.length - 1];
          if (lastObj) this.viewportManager.selection.select(lastObj);
        }

        const usageTag = result.usage ? ` (${result.usage.total_tokens} tokens)` : '';
        const objTag = result.objects?.length ? ` (${result.objects.length} object${result.objects.length !== 1 ? 's' : ''})` : '';
        this.layout.updateStatus({
          objectCount: this._editorObjects.length,
          lastAction: `${result.summary}${objTag} [AI]${usageTag}`,
        });
      } else {
        this.layout.updateStatus({ lastAction: result.description });
        this.layout.showError(
          'AI Object Error',
          result.description,
          result.rawResponse || '',
        );
      }
    } catch (err) {
      console.error('AI prompt error:', err);
      this.layout.updateStatus({ lastAction: `Error: ${err.message}` });
      this.layout.showError(
        'AI Object Error',
        err.message,
        err.rawResponse || err.stack || '',
      );
    }

    this.layout.setAIProcessing(false);
  }

  async _handleAIEnvPrompt(prompt) {
    this.layout.setAIProcessing(true);

    try {
      const result = await this.interpreter.interpret(prompt, null, 'environment');

      if (result.success) {
        // Clear previous environment objects + decorations
        this._clearEditorDecorations();

        this._environmentConfig = result.result.environment;

        // Apply environment visually to the 3D scene
        this._applyEnvironmentToScene(this._environmentConfig);

        // Spawn exact count of each decoration type
        if (result.result.decorations) {
          this._spawnDecorations(result.result.decorations);
        }

        // Reset engine to defaults — new environment = fresh engine baseline
        this.layout.enginePanel.setInstructions([]);
        try {
          await fetch(`/__editor_reset_engine?gameSlug=${encodeURIComponent(this.gameSlug)}`, {
            method: 'POST',
          });
        } catch { /* non-critical */ }

        this._refreshSceneTree();

        const sourceTag = result.source === 'ai' ? ' [AI]' : '';
        const usageTag = result.usage
          ? ` (${result.usage.total_tokens} tokens)`
          : '';
        this.layout.updateStatus({
          objectCount: this._editorObjects.length,
          lastAction: `${result.description}${sourceTag}${usageTag}`,
        });
      } else {
        this.layout.updateStatus({ lastAction: result.description });
        this.layout.showError(
          'AI Environment Error',
          result.description,
          result.rawResponse || '',
        );
      }
    } catch (err) {
      console.error('AI env prompt error:', err);
      this.layout.updateStatus({ lastAction: `Error: ${err.message}` });
      this.layout.showError(
        'AI Environment Error',
        err.message,
        err.rawResponse || err.stack || '',
      );
    }

    // Close env dialog spinner and reset status
    this.layout.aiPrompt.setEnvProcessing(false);
    this.layout.setAIProcessing(false);
  }

  // ---- Engine Customization (behaviors module) ----

  async _handleEnginePrompt(prompt) {
    this.layout.enginePanel.setProcessing(true);
    console.log('[engine-custom] Sending prompt to AI:', prompt);

    try {
      // 1. Build level context: what decorations/props exist in the scene
      const decorationTypes = new Set();
      const propNames = [];
      for (const obj of this._editorObjects) {
        if (obj.userData.editorType === 'decoration') {
          const cfg = obj.userData.editorConfig;
          decorationTypes.add(cfg?.name || cfg?.type || 'decoration');
        } else if (obj.userData.editorType === 'prop' || obj.userData.editorType === 'composite') {
          propNames.push(obj.userData.editorLabel || obj.name || 'object');
        }
      }

      // 2. Fetch existing behaviors.js (for cumulative editing)
      let existingCode = null;
      try {
        const loadRes = await fetch(`/__editor_load?path=games/${this.gameSlug}/src/custom/behaviors.js`);
        if (loadRes.ok) {
          existingCode = await loadRes.text();
        }
      } catch { /* no existing behaviors — that's fine */ }

      const levelContext = {
        decorations: [...decorationTypes],
        props: propNames,
        existingCode,
      };

      // 3. Send to AI interpreter
      console.log('[engine-custom] Calling AI with context:', levelContext.decorations, levelContext.props);
      const result = await this.interpreter.interpretEngine(prompt, levelContext);
      console.log('[engine-custom] AI result:', result.success, result.summary);

      if (result.success) {
        // 4. Save modified file(s) to disk
        for (const [filePath, content] of Object.entries(result.files)) {
          const savePath = `games/${this.gameSlug}/src/${filePath}`;
          await fetch('/__editor_save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path: savePath, content }),
          });
          console.log('[engine-custom] Saved:', savePath);
        }

        // 5. Add new objects to the editor scene (if any)
        if (result.objects && result.objects.length > 0) {
          this._addEngineObjectsToScene(result.objects);
        }

        // 6. Record instruction in the panel history
        this.layout.enginePanel.addInstruction(prompt);

        // 7. Update status (no auto-launch — user runs game manually)
        const usageTag = result.usage ? ` (${result.usage.total_tokens} tokens)` : '';
        const objTag = result.objects?.length ? ` + ${result.objects.length} object(s) added` : '';
        this.layout.updateStatus({
          lastAction: `Engine updated: ${result.summary}${objTag} [AI]${usageTag}`,
        });
      } else {
        this.layout.updateStatus({ lastAction: result.description });
        this.layout.showError(
          'Engine Customization Error',
          result.description,
          result.rawResponse || '',
        );
      }
    } catch (err) {
      console.error('Engine prompt error:', err);
      this.layout.updateStatus({ lastAction: `Error: ${err.message}` });
      this.layout.showError(
        'Engine Customization Error',
        err.message,
        err.stack || '',
      );
    }

    this.layout.enginePanel.setProcessing(false);
  }

  /**
   * Add AI-generated objects from engine customization to the editor scene.
   * Uses the same format as the object AI (mesh/composite).
   */
  _addEngineObjectsToScene(objects) {
    for (const obj of objects) {
      let mesh = null;

      if (obj.type === 'composite' && Array.isArray(obj.parts)) {
        mesh = this.previewFactory.createCompositePreview({
          label: obj.label || 'object',
          parts: obj.parts,
          worldPosition: obj.position || [0, 0, 0],
        });
        if (mesh) {
          mesh.userData.editorType = 'composite';
          mesh.userData.editorConfig = structuredClone(obj);
        }
      } else if (obj.type === 'mesh' && obj.geometry) {
        mesh = this.previewFactory.createMeshPreview({
          name: obj.name || obj.geometry,
          geometry: obj.geometry,
          args: obj.args || [],
          material: obj.material || { color: '#888888' },
          position: obj.position || [0, 0, 0],
          rotation: obj.rotation || [0, 0, 0],
          scale: obj.scale || [1, 1, 1],
        });
        if (mesh) {
          mesh.userData.editorType = 'mesh';
          mesh.userData.editorConfig = structuredClone(obj);
        }
      }

      if (mesh) {
        // Auto-ground: ensure object bottom sits on Y=0, not below ground
        const box = new THREE.Box3().setFromObject(mesh);
        if (box.min.y < -0.01) {
          mesh.position.y -= box.min.y;
        }

        const baseName = obj.label || obj.name || 'object';
        const numberedName = this._nextNumberedName(baseName);
        mesh.userData.editorLabel = numberedName;
        mesh.name = numberedName;
        mesh.userData.selectable = true;
        this.scene.add(mesh);
        this._editorObjects.push(mesh);
        this.undoManager.pushAddObject(this.scene, mesh, mesh.userData.editorConfig);
      }
    }

    this._refreshSceneTree();
  }

  // ---- Modify Object with AI (right-click context menu) ----

  async _handleModifyWithAI(item, prompt, onDone) {
    try {
      // Find the editor object
      const obj = this._editorObjects.find(o => (o.name || o.uuid) === item.id);
      if (!obj) {
        this.layout.updateStatus({ lastAction: 'Object not found' });
        onDone?.('Object not found');
        return;
      }

      const config = obj.userData.editorConfig || {};
      const label = config.label || config.name || item.name || 'object';
      const pos = [obj.position.x, obj.position.y, obj.position.z].map(v => Math.round(v * 10) / 10);

      // Build description of current geometry so the AI knows what to modify
      let geoDesc = '';
      if (config.parts) {
        geoDesc = `Current geometry (composite, ${config.parts.length} parts):\n${JSON.stringify(config.parts, null, 1)}`;
      } else if (config.geometry) {
        geoDesc = `Current geometry: ${config.geometry}(${(config.args || []).join(', ')}), material: ${JSON.stringify(config.material || {})}`;
      }

      const enginePrompt = `Modify the existing object "${label}" at position [${pos.join(', ')}].
${geoDesc}

User instruction: ${prompt}

Return the MODIFIED version of this object in the "objects" array with the same label "${label}". If behavior changes are needed, also update behaviors.js.`;

      // Build level context
      const decorationTypes = new Set();
      const propNames = [];
      for (const o of this._editorObjects) {
        if (o.userData.editorType === 'decoration') {
          decorationTypes.add(o.userData.editorConfig?.name || 'decoration');
        } else if (['prop', 'composite', 'mesh'].includes(o.userData.editorType)) {
          propNames.push(o.userData.editorLabel || o.name || 'object');
        }
      }

      let existingCode = null;
      try {
        const loadRes = await fetch(`/__editor_load?path=games/${this.gameSlug}/src/custom/behaviors.js`);
        if (loadRes.ok) existingCode = await loadRes.text();
      } catch { /* no existing behaviors */ }

      const levelContext = { decorations: [...decorationTypes], props: propNames, existingCode };

      console.log('[modify-ai] Sending:', enginePrompt);
      const result = await this.interpreter.interpretEngine(enginePrompt, levelContext);
      console.log('[modify-ai] Result:', result.success, result.summary);

      if (result.success) {
        // Save behaviors.js
        if (result.files) {
          for (const [filePath, content] of Object.entries(result.files)) {
            await fetch('/__editor_save', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: `games/${this.gameSlug}/src/${filePath}`, content }),
            });
          }
        }

        // Replace old object with modified version
        if (result.objects && result.objects.length > 0) {
          // Remove old object from scene
          this.viewportManager.selection.deselect();
          this.scene.remove(obj);
          const idx = this._editorObjects.indexOf(obj);
          if (idx >= 0) this._editorObjects.splice(idx, 1);

          // Dispose old geometry/materials
          obj.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
              else child.material.dispose();
            }
          });

          // Add modified version
          this._addEngineObjectsToScene(result.objects);

          // Select the new version
          const lastObj = this._editorObjects[this._editorObjects.length - 1];
          if (lastObj) this.viewportManager.selection.select(lastObj);
        }

        this.layout.updateStatus({
          objectCount: this._editorObjects.length,
          lastAction: `Modified: ${label} — ${result.summary} [AI]`,
        });
        onDone?.(null);
      } else {
        this.layout.updateStatus({ lastAction: result.description });
        onDone?.(result.description);
      }
    } catch (err) {
      console.error('Modify with AI error:', err);
      this.layout.updateStatus({ lastAction: `Error: ${err.message}` });
      onDone?.(err.message);
    }
  }

  // ---- Init Level (clear everything + save) ----

  async _handleInitLevel() {
    // 1. Deselect
    this.viewportManager.selection.deselect();

    // 2. Remove all editor objects from scene
    for (const obj of this._editorObjects) {
      this.scene.remove(obj);
      obj.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
          else child.material.dispose();
        }
      });
    }
    this._editorObjects = [];
    this._decorationsConfig = [];
    this._objectCounter = {};

    // 3. Clear environment
    this._clearEnvironmentFromScene();
    this._environmentConfig = null;

    // 4. Restore default editor lighting
    this.addLighting();

    // 5. Reset renderer background
    this.renderer.setClearColor(0x1a1a2e);
    this.scene.background = null;

    // 6. Reset level metadata
    this._levelName = `Level ${this.levelNumber}`;
    this._exitConfig = null;

    // 7. Clear engine panel instructions
    this.layout.enginePanel.setInstructions([]);

    // 8. Clear undo history
    this.undoManager.clear();

    // 9. Reset behaviors.js to stub
    const stubCode = `// Custom behaviors — auto-generated by the editor\nexport function init(engine) {}\nexport function update(engine, dt) {}\n`;
    try {
      await fetch('/__editor_save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: `games/${this.gameSlug}/src/custom/behaviors.js`,
          content: stubCode,
        }),
      });
    } catch { /* non-critical */ }

    // 10. Reset engine to defaults
    try {
      await fetch(`/__editor_reset_engine?gameSlug=${encodeURIComponent(this.gameSlug)}`, {
        method: 'POST',
      });
    } catch { /* non-critical */ }

    // 11. Save the empty level
    await this._handleSave();

    // 12. Update UI
    this._refreshSceneTree();
    this.layout.updateProperties(null);
    this.layout.updateStatus({
      objectCount: 0,
      lastAction: 'Level initialized and saved',
    });
  }

  // ---- Title Screen ----

  async _handleTitleScreenPrompt(prompt, titleText, subtitle, onDone) {
    this.layout.updateStatus({ lastAction: 'Generating title screen...' });

    try {
      const result = await this.interpreter.interpretTitleScreen(prompt, titleText, subtitle);

      if (result.success) {
        // Serialize the title screen config as an ES module
        const source = this._serializeTitleScreenConfig(result.config);
        const targetPath = `games/${this.gameSlug}/src/levels/titleScreen.js`;

        await fetch('/__editor_save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: targetPath, content: source }),
        });

        this._hasTitleScreen = true;

        const usageTag = result.usage ? ` (${result.usage.total_tokens} tokens)` : '';
        this.layout.updateStatus({
          lastAction: `Title screen saved${usageTag}`,
        });
        onDone?.(null);
      } else {
        this.layout.updateStatus({ lastAction: result.description });
        onDone?.(result.description);
      }
    } catch (err) {
      console.error('Title screen generation error:', err);
      this.layout.updateStatus({ lastAction: `Error: ${err.message}` });
      onDone?.(err.message);
    }
  }

  /**
   * Serialize a title screen config object into an ES module string.
   * Format: export default { id: 0, name: 'Title Screen', environment, decorations, title, startPrompt }
   */
  _serializeTitleScreenConfig(config) {
    // Re-use the serializer's formatting logic for environment/decorations
    const tempSerializer = new LevelConfigSerializer(this.gameSlug, 0);

    const lines = [];
    lines.push('export default {');
    lines.push(`  id: 0,`);
    lines.push(`  name: 'Title Screen',`);

    // Environment
    lines.push('  environment: {');
    tempSerializer._serializeEnvironment(
      tempSerializer._cleanEnvironment(config.environment || {}),
      lines,
      4
    );
    lines.push('  },');

    // Decorations
    const cleanDecs = tempSerializer._cleanDecorations(config.decorations || []);
    lines.push('  decorations: [');
    for (const dec of cleanDecs) {
      lines.push(`    ${tempSerializer._inlineObject(dec)},`);
    }
    lines.push('  ],');

    // Title
    lines.push(`  title: ${tempSerializer._inlineObject(config.title || {})},`);

    // Start prompt
    const startPrompt = (config.startPrompt || 'Click or press trigger to start').replace(/'/g, "\\'");
    lines.push(`  startPrompt: '${startPrompt}',`);

    lines.push('};');
    return lines.join('\n') + '\n';
  }

  // ---- Run Game ----

  /**
   * Run the full game — starts from title screen (if created) or level 1.
   */
  async _handleRunGame() {
    return this._launchGame(null, 'runGame');
  }

  /**
   * Run only the current level being edited — skips title screen.
   */
  async _handleRunLevel() {
    return this._launchGame(this.levelNumber, 'runLevel');
  }

  async _launchGame(levelOverride, windowSuffix) {
    const gameTitle = this.gameSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const windowName = `${this._gameWindowName}-${windowSuffix}`;

    // Always auto-save level before launching so the game loads latest editor state
    await this._handleSave();

    // Show spinner overlay
    const hideSpinner = this._showRunGameSpinner(gameTitle);
    this.layout.updateStatus({ lastAction: `Starting ${gameTitle}...` });

    try {
      // Always go through the server endpoint — it kills stale servers,
      // ensures correct port, and starts fresh with up-to-date files
      const res = await fetch('/__editor_run_game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameSlug: this.gameSlug }),
      });

      const result = await res.json();

      if (!res.ok || result.error) {
        throw new Error(result.error || `Server returned ${res.status}`);
      }

      this._gameServerRunning = true;
      this.layout.toolbar.setRunning(true);
      hideSpinner();

      // Cache-bust URL to force fresh page load in the browser
      const ts = Date.now();
      const baseUrl = result.url;
      const gameUrl = levelOverride != null
        ? `${baseUrl}?level=${levelOverride}&t=${ts}`
        : `${baseUrl}?t=${ts}`;
      window.open(gameUrl, windowName);
      this.layout.updateStatus({ lastAction: `Game running — ${baseUrl}` });
    } catch (err) {
      hideSpinner();
      console.error('Run game error:', err);
      this.layout.updateStatus({ lastAction: `Run failed: ${err.message}` });
      this.layout.showError('Run Game Error', err.message, err.stack || '');
    }
  }

  _showRunGameSpinner(gameTitle) {
    const viewportEl = this.layout.getViewportElement();
    const overlay = document.createElement('div');
    overlay.className = 'import-spinner-overlay';
    overlay.innerHTML = `
      <div class="import-spinner-content" style="border-color: var(--accent-secondary);">
        <div class="import-spinner-icon" style="border-color: var(--accent-secondary); border-top-color: transparent;"></div>
        <div class="import-spinner-text">Loading ${gameTitle}...</div>
      </div>
    `;
    viewportEl.appendChild(overlay);

    const messages = [
      `Loading ${gameTitle}...`,
      'Installing dependencies...',
      'Starting game server...',
      'Waiting for HTTPS ready...',
      'Almost there...',
    ];
    let msgIdx = 0;
    const textEl = overlay.querySelector('.import-spinner-text');
    const interval = setInterval(() => {
      msgIdx = (msgIdx + 1) % messages.length;
      textEl.textContent = messages[msgIdx];
    }, 3000);

    return () => {
      clearInterval(interval);
      overlay.remove();
    };
  }

  // ---- Save / Load ----

  async _handleSave() {
    this.layout.updateStatus({ lastAction: 'Saving...' });

    const engineInstructions = this.layout.enginePanel.getInstructions();
    const state = {
      name: this._levelName,
      environment: this._environmentConfig || {},
      decorations: this._collectDecorations(),
      props: this._collectProps(),
      playerSpawn: this._playerSpawn,
      exit: this._exitConfig,
      engineInstructions: engineInstructions.length > 0 ? engineInstructions : undefined,
    };

    const result = await this.serializer.save(state);
    this.layout.updateStatus({
      lastAction: result.success ? `Saved: ${result.path}` : 'Save failed',
    });
  }

  async _handleLoad() {
    this.layout.updateStatus({ lastAction: 'Loading...' });

    const config = await this.serializer.load();
    if (!config) {
      this.layout.updateStatus({ lastAction: 'Load failed — no level config found' });
      return;
    }

    // Clear existing objects
    for (const obj of this._editorObjects) {
      this.scene.remove(obj);
    }
    this._editorObjects = [];
    this._decorationsConfig = [];
    this.viewportManager.selection.deselect();
    this.undoManager.clear();

    // Apply loaded config
    this._levelName = config.name || `Level ${this.levelNumber}`;
    this._environmentConfig = config.environment || null;
    this._playerSpawn = config.playerSpawn || { position: [0, 0, 8], rotationY: Math.PI };
    this._exitConfig = config.exit || null;

    // Restore engine instructions
    this.layout.enginePanel.setInstructions(config.engineInstructions || []);

    // Apply environment visually
    if (this._environmentConfig) {
      this._applyEnvironmentToScene(this._environmentConfig);
    }

    if (config.decorations) {
      this._spawnDecorations(config.decorations);
    }

    if (config.props) {
      await this._loadPropsFromConfig(config.props);
    }

    this._refreshSceneTree();
    this.layout.updateStatus({
      objectCount: this._editorObjects.length,
      lastAction: `Loaded: ${this._levelName}`,
    });
  }

  // ---- Property Change ----

  _handlePropertyChange(prop, value) {
    const selected = this.viewportManager.selection.selected;
    if (!selected) return;

    if (prop === 'position') {
      const oldPos = selected.position.clone();
      selected.position.set(value[0], value[1], value[2]);
      this.undoManager.pushMoveObject(selected, oldPos, selected.position.clone());
    } else if (prop === 'rotation') {
      selected.rotation.set(value[0], value[1], value[2]);
    } else if (prop === 'scale') {
      selected.scale.set(value[0], value[1], value[2]);
    } else if (prop === 'name') {
      selected.name = value;
    } else if (prop.startsWith('data.')) {
      // Update editorConfig metadata
      const key = prop.slice(5);
      if (selected.userData.editorConfig) {
        selected.userData.editorConfig[key] = value;
      }
    }

    this._refreshSceneTree();
    this.layout.updateStatus({ lastAction: `Changed ${prop}` });
  }

  // ---- Delete ----

  _handleDelete() {
    const selected = this.viewportManager.selection.selected;
    if (!selected) return;

    this.viewportManager.selection.deselect();
    this.scene.remove(selected);

    const idx = this._editorObjects.indexOf(selected);
    if (idx >= 0) this._editorObjects.splice(idx, 1);

    this.undoManager.pushRemoveObject(this.scene, selected, selected.userData.editorConfig || {});

    this._refreshSceneTree();
    this.layout.updateProperties(null);
    this.layout.updateStatus({
      objectCount: this._editorObjects.length,
      lastAction: `Deleted: ${selected.userData.editorLabel || selected.name || 'object'}`,
    });
  }

  // ---- Zoom to Fit ----

  _zoomToFit() {
    if (this._editorObjects.length === 0) return;

    const box = new THREE.Box3();
    for (const obj of this._editorObjects) {
      box.expandByObject(obj);
    }

    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1);

    // Move perspective camera to see the whole scene
    const perspVp = this.viewportManager.viewports.perspective;
    if (perspVp && perspVp.controls?.orbitControls) {
      perspVp.controls.orbitControls.target.copy(center);
      perspVp.camera.position.set(
        center.x + maxDim,
        center.y + maxDim * 0.8,
        center.z + maxDim
      );
      perspVp.controls.orbitControls.update();
    }

    this.layout.updateStatus({ lastAction: 'Zoom to fit' });
  }

  // ---- Scene Tree Building ----

  _refreshSceneTree() {
    // Keep the selection raycast cache in sync with scene objects
    this.viewportManager.selection.updateSelectables();

    const envItems = [];
    if (this._environmentConfig) {
      if (this._environmentConfig.sky) {
        envItems.push({ id: 'env-sky', name: 'Sky', type: 'sky', category: 'environment' });
      }
      if (this._environmentConfig.enclosure) {
        envItems.push({ id: 'env-enclosure', name: 'Enclosure', type: 'enclosure', category: 'environment' });
      }
      if (this._environmentConfig.ground) {
        envItems.push({ id: 'env-ground', name: 'Ground', type: 'ground', category: 'environment' });
      }
      envItems.push({ id: 'env-lights', name: 'Lights', type: 'lights', category: 'environment' });
    }

    const decorationItems = [];
    const propItems = [];
    const exitItems = [];

    for (const obj of this._editorObjects) {
      const id = obj.name || obj.uuid;
      const label = obj.userData.editorLabel || obj.name || 'Object';
      const editorType = obj.userData.editorType;
      const pos = [obj.position.x, obj.position.y, obj.position.z];
      const rot = [obj.rotation.x, obj.rotation.y, obj.rotation.z];
      const scl = [obj.scale.x, obj.scale.y, obj.scale.z];

      const treeItem = {
        id,
        name: label,
        type: editorType || 'object',
        position: pos,
        rotation: rot,
        scale: scl,
        data: obj.userData.editorConfig || {},
      };

      // For composite objects, add expandable children
      if (editorType === 'composite' && obj.children) {
        treeItem.children = [];
        for (const child of obj.children) {
          if (child.userData.partName) {
            const partColor = this._getPartColor(child);
            treeItem.children.push({
              id: `${id}__${child.userData.partName}`,
              name: child.userData.partName,
              type: child.userData.partConfig?.primitive || 'part',
              parentId: id,
              partIndex: child.userData.partIndex,
              color: partColor,
            });
          }
        }
      }

      if (editorType === 'decoration') {
        treeItem.category = 'decorations';
        decorationItems.push(treeItem);
      } else if (editorType === 'prop') {
        treeItem.category = 'props';
        propItems.push(treeItem);
      } else {
        treeItem.category = 'props';
        propItems.push(treeItem);
      }
    }

    // Exits
    if (this._exitConfig) {
      const exits = Array.isArray(this._exitConfig) ? this._exitConfig : [this._exitConfig];
      for (let i = 0; i < exits.length; i++) {
        exitItems.push({
          id: `exit-${i}`,
          name: exits[i].label || `Exit ${i + 1}`,
          type: 'exit',
          category: 'exits',
          position: exits[i].position || [0, 0, 0],
          data: exits[i],
        });
      }
    }

    this.layout.updateSceneTree({
      environment: envItems,
      decorations: decorationItems,
      props: propItems,
      exits: exitItems,
    });
  }

  // ---- Config Collection for Serialization ----

  _collectDecorations() {
    const decorations = [];
    for (const obj of this._editorObjects) {
      if (obj.userData.editorType === 'decoration' && obj.userData.editorConfig) {
        const config = { ...obj.userData.editorConfig };
        // Each editor object is ONE instance — save with count:1 and its actual position.
        // This prevents the game's LevelLoader from re-expanding count×N duplicates.
        config.count = 1;
        config.position = [obj.position.x, obj.position.y, obj.position.z];
        // Remove radius so the game uses the explicit position instead of random scatter
        delete config.radius;
        decorations.push(config);
      }
    }
    return decorations;
  }

  _collectProps() {
    const props = [];
    for (const obj of this._editorObjects) {
      if (obj.userData.editorType === 'prop' && obj.userData.editorConfig) {
        const config = { ...obj.userData.editorConfig };
        config.position = [obj.position.x, obj.position.y, obj.position.z];
        if (obj.rotation.y !== 0) config.rotationY = obj.rotation.y;
        props.push(config);
      } else if ((obj.userData.editorType === 'primitive' || obj.userData.editorType === 'mesh') && obj.userData.editorConfig) {
        // Primitives/meshes serialized as props-like entries
        const config = { ...obj.userData.editorConfig };
        config.position = [obj.position.x, obj.position.y, obj.position.z];
        props.push(config);
      } else if (obj.userData.editorType === 'composite' && obj.userData.editorConfig) {
        // AI-generated composite objects
        const config = { ...obj.userData.editorConfig };
        config.position = [obj.position.x, obj.position.y, obj.position.z];
        if (obj.rotation.y !== 0) config.rotationY = obj.rotation.y;
        props.push(config);
      }
    }
    return props;
  }

  // ---- Object ↔ Tree Item conversion ----

  _objectToTreeItem(obj) {
    return {
      id: obj.name || obj.uuid,
      name: obj.userData.editorLabel || obj.name || 'Object',
      type: obj.userData.editorType || obj.type || 'object',
      category: obj.userData.editorType === 'decoration' ? 'decorations' : 'props',
      position: [obj.position.x, obj.position.y, obj.position.z],
      rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
      scale: [obj.scale.x, obj.scale.y, obj.scale.z],
      data: obj.userData.editorConfig || {},
    };
  }

  /** Get the current color of a composite part mesh */
  _getPartColor(mesh) {
    if (mesh.material?.color) {
      return '#' + mesh.material.color.getHexString();
    }
    // For groups, check the first child with a material
    if (mesh.children) {
      for (const child of mesh.children) {
        if (child.material?.color) {
          return '#' + child.material.color.getHexString();
        }
      }
    }
    return '#888888';
  }

  /** Change the color of a specific part inside a composite object */
  _changePartColor(parentId, partIndex, newColor) {
    const parentObj = this._editorObjects.find(o => (o.name || o.uuid) === parentId);
    if (!parentObj || !parentObj.children) return;

    const partMesh = parentObj.children.find(c => c.userData.partIndex === partIndex);
    if (!partMesh) return;

    const color = new THREE.Color(newColor);

    // Apply to the mesh material (or all children if it's a group)
    if (partMesh.material) {
      partMesh.material.color.copy(color);
      if (partMesh.material.emissive) {
        partMesh.material.emissive.copy(color);
      }
    }
    if (partMesh.children) {
      for (const child of partMesh.children) {
        if (child.material?.color) {
          child.material.color.copy(color);
        }
      }
    }

    // Update the stored config
    if (parentObj.userData.editorConfig?.parts?.[partIndex]) {
      const args = parentObj.userData.editorConfig.parts[partIndex].args;
      if (args) {
        // Color is always the last string arg
        for (let i = args.length - 1; i >= 0; i--) {
          if (typeof args[i] === 'string' && args[i].startsWith('#')) {
            args[i] = newColor;
            break;
          }
        }
      }
    }

    this._refreshSceneTree();
  }

  // ---- Load Props from Saved Config ----

  /**
   * Load props from saved level config. For GLB models, loads the actual 3D mesh.
   * For AI-generated composites/meshes, recreates from geometry config.
   */
  async _loadPropsFromConfig(props) {
    const loader = new GLTFLoader();

    for (const prop of props) {
      let editorObj = null;

      if (prop.model) {
        // GLB prop — load the actual model file
        const assetPath = `/__editor_asset?path=games/${this.gameSlug}/public/models/${this.levelNumber}/${prop.model}`;
        try {
          const gltf = await new Promise((resolve, reject) => {
            loader.load(assetPath, resolve, undefined, reject);
          });

          const scene = gltf.scene;
          const baseName = prop.model.replace(/\.glb$/i, '');
          const numberedName = this._nextNumberedName(baseName);

          // Check if it's a multi-part model
          const directChildren = scene.children.filter(
            c => c.isMesh || c.isGroup || c.isObject3D
          );

          if (directChildren.length > 1) {
            const group = new THREE.Group();
            group.name = numberedName;
            group.userData.selectable = true;
            group.userData.editorType = 'composite';
            group.userData.editorLabel = numberedName;
            group.userData.editorConfig = structuredClone(prop);

            const children = [...scene.children];
            children.forEach((child, i) => {
              child.userData.partName = child.name || `part_${i}`;
              child.userData.partIndex = i;
              child.userData.partConfig = { primitive: 'glb-mesh' };
              group.add(child);
            });

            editorObj = group;
          } else {
            scene.name = numberedName;
            scene.userData.selectable = true;
            scene.userData.editorType = 'prop';
            scene.userData.editorLabel = numberedName;
            scene.userData.editorConfig = structuredClone(prop);

            scene.traverse((child) => {
              if (child.isMesh) child.userData.selectable = true;
            });

            editorObj = scene;
          }

          // Apply saved position/rotation
          const pos = prop.position || [0, 0, 0];
          editorObj.position.set(pos[0], pos[1], pos[2]);
          if (prop.rotationY) editorObj.rotation.y = prop.rotationY;
        } catch (err) {
          console.warn(`Failed to load GLB prop ${prop.model}:`, err);
          // Fall back to placeholder
          editorObj = this.previewFactory.createPropPlaceholder(prop);
        }
      } else if (prop.parts) {
        // AI-generated composite — recreate from parts config
        editorObj = this.previewFactory.createCompositePreview({
          label: prop.label || 'object',
          parts: prop.parts,
          worldPosition: prop.position || [0, 0, 0],
        });
        if (editorObj) {
          const numberedName = this._nextNumberedName(prop.label || 'object');
          editorObj.userData.editorLabel = numberedName;
          editorObj.name = numberedName;
          editorObj.userData.editorConfig = structuredClone(prop);
          if (prop.rotationY) editorObj.rotation.y = prop.rotationY;
        }
      } else if (prop.geometry && typeof prop.geometry === 'string') {
        // AI-generated single mesh
        editorObj = this.previewFactory.createMeshPreview({
          name: prop.name || 'object',
          geometry: prop.geometry,
          args: prop.args || [],
          material: prop.material || { color: '#888888' },
          position: prop.position || [0, 0, 0],
          rotation: prop.rotation || [0, 0, 0],
          scale: prop.scale || [1, 1, 1],
        });
        if (editorObj) {
          const numberedName = this._nextNumberedName(prop.name || 'object');
          editorObj.userData.editorLabel = numberedName;
          editorObj.name = numberedName;
          editorObj.userData.editorConfig = structuredClone(prop);
        }
      } else {
        // Unknown format — use placeholder
        editorObj = this.previewFactory.createPropPlaceholder(prop);
      }

      if (editorObj) {
        editorObj.userData.selectable = true;
        this.scene.add(editorObj);
        this._editorObjects.push(editorObj);
      }
    }
  }

  // ---- Import GLB Assets ----

  _showImportSpinner() {
    const viewportEl = this.layout.getViewportElement();
    const overlay = document.createElement('div');
    overlay.className = 'import-spinner-overlay';
    overlay.innerHTML = `
      <div class="import-spinner-content">
        <div class="import-spinner-icon"></div>
        <div class="import-spinner-text">Loading 3D models...</div>
      </div>
    `;
    viewportEl.appendChild(overlay);

    const messages = [
      'Loading 3D models...',
      'Processing geometry...',
      'Analyzing mesh layers...',
      'Preparing scene objects...',
      'Almost there...',
    ];
    let msgIdx = 0;
    const textEl = overlay.querySelector('.import-spinner-text');
    const interval = setInterval(() => {
      msgIdx = (msgIdx + 1) % messages.length;
      textEl.textContent = messages[msgIdx];
    }, 2000);

    return () => {
      clearInterval(interval);
      overlay.remove();
    };
  }

  async _handleImportAssets(files) {
    const hideSpinner = this._showImportSpinner();
    const loader = new GLTFLoader();
    let imported = 0;

    try {
      for (const file of files) {
        const filename = file.name;
        const baseName = filename.replace(/\.glb$/i, '');

        // 1. Upload binary to disk
        const savePath = `games/${this.gameSlug}/public/models/${this.levelNumber}/${filename}`;
        const arrayBuffer = await file.arrayBuffer();
        await fetch(`/__editor_upload?path=${encodeURIComponent(savePath)}`, {
          method: 'POST',
          body: arrayBuffer,
        });

        // 2. Load into Three.js from blob URL
        const blobUrl = URL.createObjectURL(file);
        const gltf = await new Promise((resolve, reject) => {
          loader.load(blobUrl, resolve, undefined, reject);
        });
        URL.revokeObjectURL(blobUrl);

        const scene = gltf.scene;

        // 3. Inspect: count named meshes/groups to decide composite vs single
        const namedChildren = [];
        scene.traverse((child) => {
          if (child !== scene && (child.isMesh || child.isGroup) && child.name) {
            namedChildren.push(child);
          }
        });

        // Filter to direct or significant children only (skip deeply nested internals)
        const directChildren = scene.children.filter(
          c => c.isMesh || c.isGroup || c.isObject3D
        );
        const isComposite = directChildren.length > 1;

        const numberedName = this._nextNumberedName(baseName);
        let editorObj;

        if (isComposite) {
          // Multi-layer → composite group
          const group = new THREE.Group();
          group.name = numberedName;
          group.userData.selectable = true;
          group.userData.editorType = 'composite';
          group.userData.editorLabel = numberedName;
          group.userData.editorConfig = {
            model: filename,
            position: [0, 0, 0],
            type: 'glb-import',
          };

          // Reparent children into our group
          const children = [...scene.children];
          children.forEach((child, i) => {
            child.userData.partName = child.name || `part_${i}`;
            child.userData.partIndex = i;
            child.userData.partConfig = { primitive: 'glb-mesh' };
            group.add(child);
          });

          editorObj = group;
        } else {
          // Single mesh / simple model
          scene.name = numberedName;
          scene.userData.selectable = true;
          scene.userData.editorType = 'prop';
          scene.userData.editorLabel = numberedName;
          scene.userData.editorConfig = {
            model: filename,
            position: [0, 0, 0],
            type: 'glb-import',
          };

          // Make all child meshes selectable via parent
          scene.traverse((child) => {
            if (child.isMesh) {
              child.userData.selectable = true;
            }
          });

          editorObj = scene;
        }

        // 4. Add to editor scene
        this.scene.add(editorObj);
        this._editorObjects.push(editorObj);
        this.undoManager.pushAddObject(this.scene, editorObj, editorObj.userData.editorConfig);
        imported++;
      }
    } catch (err) {
      console.error('GLB import error:', err);
      this.layout.updateStatus({ lastAction: `Import error: ${err.message}` });
    }

    hideSpinner();
    this._refreshSceneTree();
    this.layout.updateStatus({
      objectCount: this._editorObjects.length,
      lastAction: `Imported ${imported} model${imported !== 1 ? 's' : ''}`,
    });

    // Select the last imported object
    if (this._editorObjects.length > 0) {
      const last = this._editorObjects[this._editorObjects.length - 1];
      this.viewportManager.selection.select(last);
    }
  }

  // ---- Render Loop ----

  animate() {
    this.renderer.setAnimationLoop(() => {
      this.viewportManager.update();
      this.viewportManager.render();
    });
  }

  dispose() {
    this.renderer.setAnimationLoop(null);
    if (this.viewportManager) this.viewportManager.dispose();
    this.renderer.dispose();
    this.undoManager.dispose();
    this.layout.dispose();
  }
}
