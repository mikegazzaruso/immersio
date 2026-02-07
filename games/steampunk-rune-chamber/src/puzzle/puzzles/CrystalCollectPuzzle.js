import * as THREE from 'three';
import { PuzzleBase } from '../PuzzleBase.js';
import { Interactable } from '../../interaction/Interactable.js';
import { ObjectFactory } from '../../assets/ObjectFactory.js';

const _worldPos = new THREE.Vector3();

/**
 * CrystalCollectPuzzle — Grab the crystal from the high platform and place it on the altar.
 * Uses 3_crystal.glb as the collectible.
 * Placing it on the altar spawns the couch (1_couch.glb).
 */
export class CrystalCollectPuzzle extends PuzzleBase {
  constructor(eventBus, engine) {
    super('crystal_collect', eventBus);
    this.engine = engine;
    this.scene = engine.scene;
    this.interactionSystem = engine.interactionSystem;

    this._crystalModel = null;
    this._crystalInteractable = null;
    this._altarGroup = null;
    this._altarTargetPos = new THREE.Vector3(0, 1.2, -15);
    this._snapDistance = 1.5;
    this._crystalSpawnPos = new THREE.Vector3(0, 13.8, -3);
    this._crystalSpawned = false;

    // Callback for when crystal is placed
    this.onCrystalPlaced = null;
  }

  /**
   * Set where the crystal should spawn (called after EnemyPatrolPuzzle builds platforms).
   */
  setCrystalSpawnPosition(pos) {
    this._crystalSpawnPos.copy(pos);
  }

  onActivate() {
    // Build the altar on the ground floor
    this._buildAltar();

    // Spawn the crystal
    this._spawnCrystal();
  }

  _buildAltar() {
    const group = new THREE.Group();

    // Base pedestal (dark stone)
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 1.2, 0.4, 8),
      new THREE.MeshStandardMaterial({
        color: 0x3a2a1a,
        metalness: 0.3,
        roughness: 0.7,
      })
    );
    base.position.y = 0.2;
    group.add(base);

    // Upper column
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.6, 0.6, 8),
      new THREE.MeshStandardMaterial({
        color: 0x8B6914,
        metalness: 0.5,
        roughness: 0.3,
      })
    );
    column.position.y = 0.7;
    group.add(column);

    // Top plate (where crystal goes)
    const plate = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7, 0.5, 0.1, 8),
      new THREE.MeshStandardMaterial({
        color: 0x00ccaa,
        emissive: 0x00ccaa,
        emissiveIntensity: 0.3,
        metalness: 0.4,
        roughness: 0.2,
      })
    );
    plate.position.y = 1.05;
    group.add(plate);

    // Rune decorations around the base
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2;
      const rune = new THREE.Mesh(
        new THREE.PlaneGeometry(0.3, 0.4),
        new THREE.MeshStandardMaterial({
          color: 0x00ccaa,
          emissive: 0x00ccaa,
          emissiveIntensity: 0.5,
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide,
        })
      );
      rune.position.set(
        Math.cos(angle) * 1.1,
        0.4,
        Math.sin(angle) * 1.1
      );
      rune.rotation.y = -angle;
      group.add(rune);
    }

    // Glow light on altar
    const altarLight = new THREE.PointLight('#00ccaa', 1.5, 8);
    altarLight.position.y = 1.5;
    group.add(altarLight);

    group.position.set(0, 0, -15);
    this.scene.add(group);
    this._altarGroup = group;
  }

  async _spawnCrystal() {
    try {
      const gltf = await this.engine.assetLoader.loadGLTF('/models/1/3_crystal.glb');
      this._crystalModel = gltf.scene;
      this._crystalModel.scale.setScalar(0.5);

      // Auto-ground on the crystal platform
      const box = new THREE.Box3().setFromObject(this._crystalModel);
      this._crystalModel.position.copy(this._crystalSpawnPos);
      this._crystalModel.position.y = this._crystalSpawnPos.y - box.min.y * 0.5;

      this.scene.add(this._crystalModel);
      this._crystalSpawned = true;

      // Add glow around crystal
      const crystalGlow = new THREE.PointLight('#00ffcc', 3.0, 6);
      crystalGlow.position.copy(this._crystalSpawnPos);
      crystalGlow.position.y += 0.5;
      this.scene.add(crystalGlow);
      this._crystalGlow = crystalGlow;

      // Make the crystal grabbable - find a mesh child for interaction
      let interactionMesh = null;
      this._crystalModel.traverse((child) => {
        if (child.isMesh && !interactionMesh) {
          interactionMesh = child;
        }
      });

      if (interactionMesh) {
        this._crystalInteractable = new Interactable(interactionMesh, {
          type: 'grab',
          onRelease: () => {
            this._checkPlacement();
          },
        });
        this.interactionSystem.register(this._crystalInteractable);
      }

      this.eventBus.emit('notification', { text: 'A glowing crystal appears on the highest platform!' });
    } catch (e) {
      console.warn('Failed to load crystal model:', e);
      this._createFallbackCrystal();
    }
  }

  _createFallbackCrystal() {
    this._crystalModel = ObjectFactory.crystal(0.2, 0.5, 0x00ffcc, this._crystalSpawnPos.clone());
    this.scene.add(this._crystalModel);
    this._crystalSpawned = true;

    this._crystalInteractable = new Interactable(this._crystalModel, {
      type: 'grab',
      onRelease: () => {
        this._checkPlacement();
      },
    });
    this.interactionSystem.register(this._crystalInteractable);
  }

  _checkPlacement() {
    // Check player proximity to altar (more reliable than release world pos,
    // which can be wrong in desktop mode due to local/world coordinate mismatch)
    const playerPos = new THREE.Vector3();
    this.engine.camera.getWorldPosition(playerPos);
    const dist = playerPos.distanceTo(this._altarTargetPos);

    if (dist < this._snapDistance + 2.0) {
      // Snap crystal to altar
      this._crystalModel.position.copy(this._altarTargetPos);

      // Unregister interactable
      if (this._crystalInteractable) {
        this.interactionSystem.unregister(this._crystalInteractable);
      }

      // Remove glow
      if (this._crystalGlow) {
        this.scene.remove(this._crystalGlow);
      }

      this.solve();
    }
  }

  // Desktop fallback: allow click-to-grab simulation
  update(dt) {
    // Rotate crystal glow for visual effect
    if (this._crystalGlow && this._crystalSpawned && this.state === 'active') {
      const time = performance.now() * 0.001;
      this._crystalGlow.intensity = 2.0 + Math.sin(time * 3) * 1.0;
    }
  }

  onSolved() {
    this.eventBus.emit('notification', { text: 'The crystal resonates with the altar! Something materializes...' });

    // Trigger couch spawn
    if (this.onCrystalPlaced) {
      this.onCrystalPlaced();
    }
  }
}
