import * as THREE from 'three';
import { PuzzleBase } from '../PuzzleBase.js';
import { Interactable } from '../../interaction/Interactable.js';

/**
 * LeverPuzzle — Find the ancient steampunk lever and activate it.
 * Uses 2_multipart_leveler.glb (static multipart model, no embedded animations).
 * The entire model is treated as an interactable; on activation, a simple
 * rotation animation is applied to a detected handle part (or the model root).
 * Pulling the lever spawns the floating platforms and crystal.
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

    // Position the lever in a corner of the room, partially hidden behind columns
    this._leverModel.position.set(-15, 0, -15);
    this._leverModel.scale.setScalar(1.0);
    this._leverModel.rotation.y = Math.PI / 4;

    // Auto-ground (model has bottom-center pivot)
    const box = new THREE.Box3().setFromObject(this._leverModel);
    this._leverModel.position.y = -box.min.y;

    this.scene.add(this._leverModel);

    // Find a suitable handle part for animation.
    // Strategy: look for the highest mesh or the last mesh in traversal (often the handle).
    const allMeshes = [];
    this._leverModel.traverse((child) => {
      if (child.isMesh) {
        allMeshes.push(child);
      }
    });

    console.log(`Lever model: ${allMeshes.length} meshes`);
    allMeshes.forEach((m, i) => console.log(`  [${i}] "${m.name}" pos=(${m.position.x.toFixed(2)}, ${m.position.y.toFixed(2)}, ${m.position.z.toFixed(2)})`));

    // Pick handle: prefer highest mesh (likely the lever arm/handle)
    if (allMeshes.length > 0) {
      let highestMesh = allMeshes[0];
      let highestY = -Infinity;
      for (const m of allMeshes) {
        const worldPos = new THREE.Vector3();
        m.getWorldPosition(worldPos);
        if (worldPos.y > highestY) {
          highestY = worldPos.y;
          highestMesh = m;
        }
      }
      // Use the parent group of the highest mesh if it's not the model root,
      // so we rotate the handle sub-assembly, not just one face
      this._leverHandle = highestMesh.parent && highestMesh.parent !== this._leverModel
        ? highestMesh.parent
        : highestMesh;
      console.log(`Lever handle selected: "${this._leverHandle.name || '(unnamed)'}"`);
    }

    if (this._leverHandle) {
      this._startRotX = this._leverHandle.rotation.x;
    }

    // Make the entire model interactable
    this._interactable = new Interactable(this._leverModel, {
      type: 'activate',
      onActivate: () => this._onLeverActivated(),
    });
    this.interactionSystem.register(this._interactable);

    // Add a glow indicator near the lever to guide the player
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

    // Animate the lever handle rotation
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

    this.eventBus.emit('notification', { text: 'Platforms materialize above!' });

    // Trigger callback for platform and crystal spawn
    if (this.onLeverPulled) {
      this.onLeverPulled();
    }
  }
}
