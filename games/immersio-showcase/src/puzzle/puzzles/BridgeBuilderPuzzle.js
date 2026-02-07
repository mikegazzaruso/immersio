import * as THREE from 'three';
import { PuzzleBase } from '../PuzzleBase.js';
import { Interactable } from '../../interaction/Interactable.js';
import { ObjectFactory } from '../../assets/ObjectFactory.js';

/**
 * Bridge Builder Puzzle (Trigger-Animation pattern)
 *
 * The player pulls a lever to raise a bridge of 5 segments,
 * then crosses to reach the game completion area.
 */
export class BridgeBuilderPuzzle extends PuzzleBase {
  constructor(eventBus, scene, interactionSystem, collisionSystem) {
    super('bridge_builder', eventBus);
    this.scene = scene;
    this.interactionSystem = interactionSystem;
    this.collisionSystem = collisionSystem;
    this._animating = false;
    this._animTimer = 0;
    this._segments = [];
    this._lever = null;
    this._leverPullAnim = null;
    this._leverActivated = false;
  }

  onActivate() {
    // Create a gap -- visual pit indicator (dark strip)
    const gapVisual = new THREE.Mesh(
      new THREE.PlaneGeometry(3, 12),
      new THREE.MeshLambertMaterial({ color: '#111111' })
    );
    gapVisual.rotation.x = -Math.PI / 2;
    gapVisual.position.set(0, 0.01, -6);
    this.scene.add(gapVisual);

    // Create lever near the player
    this._lever = ObjectFactory.lever(new THREE.Vector3(3, 0, 2));
    this.scene.add(this._lever);

    // Make the lever handle activatable
    const handleMesh = this._lever.userData.pivot.children[1]; // the sphere handle
    const leverInteractable = new Interactable(handleMesh, {
      type: 'activate',
      onActivate: () => this._onLeverPulled(),
    });
    this.interactionSystem.register(leverInteractable);

    // Create bridge segments (initially below ground)
    const segCount = 5;
    const segW = 2.5;
    const segD = 2.2;
    const segH = 0.3;
    for (let i = 0; i < segCount; i++) {
      const seg = new THREE.Mesh(
        new THREE.BoxGeometry(segW, segH, segD),
        new THREE.MeshLambertMaterial({ color: 0x887766 })
      );
      const targetY = 0;
      const startY = -3;
      seg.position.set(0, startY, -1.5 - i * segD);
      this.scene.add(seg);
      this._segments.push({ mesh: seg, startY, targetY, delay: i * 0.3 });
    }

    // Create completion marker on the other side
    const marker = ObjectFactory.crystal(0.3, 0.8, 0xffdd44,
      new THREE.Vector3(0, 1.0, -14)
    );
    this.scene.add(marker);

    this.eventBus.emit('notification', { text: 'Pull the lever to raise the bridge!' });
  }

  _onLeverPulled() {
    if (this._leverActivated) return;
    this._leverActivated = true;

    // Animate lever
    const pivot = this._lever.userData.pivot;
    this._leverPullAnim = { pivot, timer: 0, duration: 0.8 };

    // Start bridge animation after brief delay
    setTimeout(() => {
      this._animating = true;
      this._animTimer = 0;
    }, 600);

    this.eventBus.emit('notification', { text: 'The bridge is rising...' });
  }

  update(dt) {
    // Lever animation
    if (this._leverPullAnim) {
      const a = this._leverPullAnim;
      a.timer += dt;
      const t = Math.min(a.timer / a.duration, 1);
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      a.pivot.rotation.x = -Math.PI / 6 + eased * (Math.PI / 3);
      if (t >= 1) this._leverPullAnim = null;
    }

    // Bridge segments animation
    if (!this._animating) return;
    this._animTimer += dt;

    let allDone = true;
    for (const seg of this._segments) {
      const localT = Math.max(0, this._animTimer - seg.delay) / 1.0;
      if (localT >= 1) {
        seg.mesh.position.y = seg.targetY;
      } else {
        allDone = false;
        const eased = localT < 0.5 ? 2 * localT * localT : 1 - (-2 * localT + 2) ** 2 / 2;
        seg.mesh.position.y = seg.startY + (seg.targetY - seg.startY) * eased;
      }
    }

    if (allDone) {
      this._animating = false;
      // Add collision boxes for bridge so player can walk on it
      for (const seg of this._segments) {
        this.collisionSystem.addBoxCollider(
          seg.mesh.position.x, seg.mesh.position.y - 0.15,
          seg.mesh.position.z, 2.5, 0.3, 2.2
        );
      }
      this.solve();
    }
  }

  onSolved() {
    this.eventBus.emit('notification', { text: 'The bridge is complete! Cross to finish the game!' });
  }
}
