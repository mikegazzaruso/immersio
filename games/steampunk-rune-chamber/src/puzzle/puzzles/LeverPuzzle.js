import * as THREE from 'three';
import { PuzzleBase } from '../PuzzleBase.js';
import { Interactable } from '../../interaction/Interactable.js';

/**
 * LeverPuzzle — Find the ancient steampunk lever and pull it.
 * Uses 2_multipart_leveler.glb ONLY (no procedural lever).
 * The lever handle is the 15th part (child) of the segmented model.
 * Pulling the lever spawns the crystal on a high platform.
 */
export class LeverPuzzle extends PuzzleBase {
  constructor(eventBus, engine) {
    super('lever_activation', eventBus);
    this.engine = engine;
    this.scene = engine.scene;
    this.interactionSystem = engine.interactionSystem;

    this._leverModel = null;
    this._leverHandle = null;
    this._interactable = null;
    this._animating = false;
    this._animTimer = 0;
    this._animDuration = 1.2;
    this._startRotX = 0;
    this._endRotX = Math.PI / 3;

    // Callback for when lever is pulled (set by game setup)
    this.onLeverPulled = null;
  }

  async onActivate() {
    const gltf = await this.engine.assetLoader.loadGLTF('/models/1/2_multipart_leveler.glb');
    this._leverModel = gltf.scene;

    // Position the lever in a corner of the room, slightly hidden
    this._leverModel.position.set(-15, 0, -15);
    this._leverModel.scale.setScalar(1.0);
    this._leverModel.rotation.y = Math.PI / 4;

    // Auto-ground (model has bottom-center pivot)
    const box = new THREE.Box3().setFromObject(this._leverModel);
    this._leverModel.position.y = -box.min.y;

    this.scene.add(this._leverModel);

    // Find part 15 — the physical lever handle in the segmented model.
    // Blender "layer 15" maps to the 15th node in GLTF traversal order.
    const allNodes = [];
    this._leverModel.traverse((child) => {
      allNodes.push(child);
    });

    // Log structure for debugging
    console.log(`Lever model: ${allNodes.length} nodes`);
    allNodes.forEach((n, i) => console.log(`  [${i}] ${n.type} "${n.name}"`));

    // Try by name first (e.g. "Part_15", "part15", "lever", etc.)
    this._leverHandle = allNodes.find(n =>
      n.name && /15/.test(n.name)
    );

    // Fallback: use traversal index 15
    if (!this._leverHandle && allNodes.length > 15) {
      this._leverHandle = allNodes[15];
    }

    // Last resort: pick the last mesh
    if (!this._leverHandle) {
      const meshes = allNodes.filter(n => n.isMesh);
      if (meshes.length > 0) {
        this._leverHandle = meshes[meshes.length - 1];
      }
    }

    if (this._leverHandle) {
      console.log(`Lever handle found: [${allNodes.indexOf(this._leverHandle)}] "${this._leverHandle.name}"`);
      this._startRotX = this._leverHandle.rotation.x;

      // Make the entire model interactable (easier to click), but animate only part 15
      this._interactable = new Interactable(this._leverModel, {
        type: 'activate',
        onActivate: () => this._onLeverActivated(),
      });
      this.interactionSystem.register(this._interactable);
    }

    // Add a glow indicator near the lever
    const indicator = new THREE.PointLight('#00ffaa', 2.0, 6);
    indicator.position.set(-15, 2, -15);
    this.scene.add(indicator);
    this._indicator = indicator;

    this.eventBus.emit('notification', { text: 'Find the ancient lever in the chamber...' });
  }

  _onLeverActivated() {
    if (this._animating || this.state === 'solved') return;
    this._animating = true;
    this._animTimer = 0;

    // Disable further interaction
    if (this._interactable) {
      this._interactable.setEnabled(false);
    }

    this.eventBus.emit('notification', { text: 'The lever groans as ancient gears turn...' });
  }

  update(dt) {
    if (!this._animating) return;

    this._animTimer += dt;
    const t = Math.min(this._animTimer / this._animDuration, 1);
    const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;

    // Animate only the lever handle (part 15) rotation
    if (this._leverHandle) {
      this._leverHandle.rotation.x = this._startRotX + eased * this._endRotX;
    }

    if (t >= 1) {
      this._animating = false;
      this.solve();
    }
  }

  onSolved() {
    // Remove indicator glow
    if (this._indicator) {
      this.scene.remove(this._indicator);
    }

    this.eventBus.emit('notification', { text: 'A crystal materializes above!' });

    // Trigger callback for crystal spawn
    if (this.onLeverPulled) {
      this.onLeverPulled();
    }
  }
}
