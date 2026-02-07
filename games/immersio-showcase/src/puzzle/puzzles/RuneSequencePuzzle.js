import * as THREE from 'three';
import { PuzzleBase } from '../PuzzleBase.js';
import { Interactable } from '../../interaction/Interactable.js';
import { ObjectFactory } from '../../assets/ObjectFactory.js';

/**
 * Rune Sequence Puzzle (Activate-in-Order pattern)
 *
 * The player must activate 5 rune stones in the correct order
 * inside the Crystal Cavern. Wrong order resets progress.
 */
export class RuneSequencePuzzle extends PuzzleBase {
  constructor(eventBus, scene, interactionSystem) {
    super('rune_sequence', eventBus);
    this.scene = scene;
    this.interactionSystem = interactionSystem;
    this.correctOrder = [2, 0, 4, 1, 3]; // indices of the correct activation order
    this.playerInput = [];
    this.nodes = [];
  }

  onActivate() {
    const count = 5;
    const radius = 4;

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const stone = ObjectFactory.runeStone(
        0.6, 0.8, 0.15, 0x555566, i,
        new THREE.Vector3(x, 0.5, z)
      );
      this.scene.add(stone);

      // Make the stone face outward from center
      stone.lookAt(0, 0.5, 0);
      stone.rotation.y += Math.PI;

      const interactable = new Interactable(stone.children[0], {
        type: 'activate',
        onActivate: () => this._onNodeActivated(i),
      });
      this.interactionSystem.register(interactable);
      this.nodes.push({ mesh: stone, index: i, interactable });
    }

    this.eventBus.emit('notification', { text: 'Activate the rune stones in the correct order!' });
  }

  _onNodeActivated(index) {
    this.playerInput.push(index);
    const step = this.playerInput.length - 1;

    if (this.correctOrder[step] !== index) {
      // Wrong order -- flash red, reset
      this._flashNode(index, 0xff0000, 0.8);
      this.playerInput = [];

      // Reset all previously lit nodes
      for (const node of this.nodes) {
        this._resetNode(node.index);
      }

      this.eventBus.emit('notification', { text: 'Wrong order! Try again.' });
      return;
    }

    // Correct -- flash green and keep it lit
    this._flashNode(index, 0x00ff00, 0.6);

    this.eventBus.emit('notification', {
      text: `Correct! ${this.playerInput.length}/${this.correctOrder.length}`
    });

    if (this.playerInput.length === this.correctOrder.length) {
      this.solve();
    }
  }

  _flashNode(index, color, intensity) {
    const node = this.nodes[index];
    const indicator = node.mesh.children.find(c => c.userData?.runeIndicator);
    if (indicator && indicator.material) {
      indicator.material.emissive.setHex(color);
      indicator.material.emissiveIntensity = intensity;

      // If wrong (red), reset after a short delay
      if (color === 0xff0000) {
        setTimeout(() => {
          indicator.material.emissive.setHex(0x222244);
          indicator.material.emissiveIntensity = 0.3;
        }, 500);
      }
    }
  }

  _resetNode(index) {
    const node = this.nodes[index];
    const indicator = node.mesh.children.find(c => c.userData?.runeIndicator);
    if (indicator && indicator.material) {
      indicator.material.emissive.setHex(0x222244);
      indicator.material.emissiveIntensity = 0.3;
    }
  }

  onSolved() {
    // Glow all nodes green permanently
    for (const node of this.nodes) {
      const indicator = node.mesh.children.find(c => c.userData?.runeIndicator);
      if (indicator && indicator.material) {
        indicator.material.emissive.setHex(0x00ff00);
        indicator.material.emissiveIntensity = 1.0;
      }
    }
    this.eventBus.emit('notification', { text: 'Rune sequence complete! The way forward is revealed.' });
  }
}
