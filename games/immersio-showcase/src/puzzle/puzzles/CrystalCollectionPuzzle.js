import * as THREE from 'three';
import { PuzzleBase } from '../PuzzleBase.js';
import { Interactable } from '../../interaction/Interactable.js';
import { ObjectFactory } from '../../assets/ObjectFactory.js';

/**
 * Crystal Collection Puzzle (Collect-and-Place pattern)
 *
 * The player finds 3 colored crystals scattered around the beach
 * and carries them to matching pedestals near the center.
 */
export class CrystalCollectionPuzzle extends PuzzleBase {
  constructor(eventBus, scene, interactionSystem) {
    super('crystal_collection', eventBus);
    this.scene = scene;
    this.interactionSystem = interactionSystem;
    this.items = [];
    this.snapDistance = 0.8;
  }

  onActivate() {
    const colors = [
      { name: 'red', hex: 0xff4444 },
      { name: 'blue', hex: 0x4488ff },
      { name: 'green', hex: 0x44ff44 },
    ];

    // Scatter crystals around the beach at varied distances
    const crystalPositions = [
      new THREE.Vector3(8, 0.5, 5),
      new THREE.Vector3(-7, 0.5, -3),
      new THREE.Vector3(3, 0.5, -10),
    ];

    // Place pedestals in a semicircle near the center
    const pedestalPositions = [
      new THREE.Vector3(-2, 0, 2),
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(2, 0, 2),
    ];

    colors.forEach((c, i) => {
      // Create collectible crystal
      const crystal = ObjectFactory.crystal(0.15, 0.4, c.hex, crystalPositions[i]);
      this.scene.add(crystal);

      // Create target pedestal
      const pedestal = ObjectFactory.pedestal(0.5, 0.8, 0x555555, pedestalPositions[i]);
      this.scene.add(pedestal);

      // Add a colored ring on top of the pedestal to show where to place
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.2, 0.03, 6, 16),
        new THREE.MeshStandardMaterial({
          color: c.hex,
          emissive: c.hex,
          emissiveIntensity: 0.4,
          transparent: true,
          opacity: 0.7,
        })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.copy(pedestalPositions[i]);
      ring.position.y = 0.85;
      this.scene.add(ring);

      const targetPos = pedestalPositions[i].clone();
      targetPos.y = 0.85;

      // Make crystal grabbable
      const interactable = new Interactable(crystal, {
        type: 'grab',
        onRelease: (hand, worldPos) => {
          this._checkPlacement(entry, worldPos);
        },
      });
      this.interactionSystem.register(interactable);

      const entry = { mesh: crystal, target: targetPos, placed: false, interactable, ring };
      this.items.push(entry);
    });

    this.eventBus.emit('notification', { text: 'Find 3 crystals and place them on the pedestals!' });
  }

  _checkPlacement(entry, releasePos) {
    if (entry.placed) return;

    const dist = releasePos.distanceTo(entry.target);
    if (dist < this.snapDistance) {
      entry.mesh.position.copy(entry.target);
      entry.placed = true;
      this.interactionSystem.unregister(entry.interactable);

      // Hide the guide ring
      entry.ring.visible = false;

      const placedCount = this.items.filter(i => i.placed).length;
      this.eventBus.emit('notification', {
        text: `Crystal placed! ${placedCount}/${this.items.length}`
      });

      if (this.items.every(i => i.placed)) {
        this.solve();
      }
    }
  }

  onSolved() {
    this.eventBus.emit('notification', { text: 'All crystals placed! The path ahead opens...' });
  }
}
