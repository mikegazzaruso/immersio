import * as THREE from 'three';
import { PuzzleBase } from '../PuzzleBase.js';
import { Interactable } from '../../interaction/Interactable.js';
import { ObjectFactory } from '../../assets/ObjectFactory.js';

export class BridgeActivationPuzzle extends PuzzleBase {
  constructor(eventBus, scene, interactionSystem, collisionSystem) {
    super('bridge_activation', eventBus);
    this.scene = scene;
    this.interactionSystem = interactionSystem;
    this.collisionSystem = collisionSystem;
    this._animating = false;
    this._animTimer = 0;
    this._segments = [];
    this._lever = null;
    this._leverPullAnim = null;
    this._platform = null;
    this._audioCtx = null;
    this._pendingTimers = [];
  }

  onActivate() {
    // Create lever near the wall
    this._lever = ObjectFactory.lever(new THREE.Vector3(6, 0, -8));
    this.scene.add(this._lever);

    // Make lever handle activatable
    const handle = this._lever.userData.pivot.children[1]; // The sphere handle
    const interactable = new Interactable(handle, {
      type: 'activate',
      onActivate: () => this._onLeverPulled(),
    });
    this.interactionSystem.register(interactable);

    // Create bridge segments (initially below the floor)
    const segCount = 6;
    const segW = 1.8;
    const segD = 1.8;
    const segH = 0.3;
    for (let i = 0; i < segCount; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x665577,
        emissive: 0x9933ff,
        emissiveIntensity: 0.2,
        roughness: 0.4,
        metalness: 0.3,
      });
      const seg = new THREE.Mesh(
        new THREE.BoxGeometry(segW, segH, segD),
        mat
      );
      const targetY = 0;
      const startY = -4;
      seg.position.set(6, startY, -4 - i * segD);
      this.scene.add(seg);
      this._segments.push({ mesh: seg, startY, targetY, delay: i * 0.4 });
    }

    // Create destination platform with a glowing crystal on top
    this._platform = new THREE.Group();
    const platformBase = new THREE.Mesh(
      new THREE.CylinderGeometry(1.5, 1.8, 0.4, 8),
      new THREE.MeshStandardMaterial({
        color: 0x443366,
        emissive: 0x9933ff,
        emissiveIntensity: 0.3,
        roughness: 0.3,
      })
    );
    platformBase.position.y = 0.2;
    this._platform.add(platformBase);

    // Reward crystal on platform
    const rewardCrystal = ObjectFactory.crystal(0.3, 0.8, 0x00ff88,
      new THREE.Vector3(0, 0.8, 0)
    );
    this._platform.add(rewardCrystal);

    // Reward crystal light
    const rewardLight = new THREE.PointLight(0x00ff88, 1.5, 8);
    rewardLight.position.set(0, 1.5, 0);
    this._platform.add(rewardLight);

    this._platform.position.set(6, 0, -4 - segCount * segD - 2);
    this.scene.add(this._platform);

    // Info text
    this.eventBus.emit('notification', { text: 'Find the lever and pull it to raise the crystal bridge!' });
  }

  _onLeverPulled() {
    if (this._animating || this.state !== 'active') return;

    this._playLeverSound();

    // Animate lever
    const pivot = this._lever.userData.pivot;
    this._leverPullAnim = { pivot, timer: 0, duration: 0.8 };

    // Start bridge animation after lever pull
    const tid = setTimeout(() => {
      this._animating = true;
      this._animTimer = 0;
      this._playBridgeSound();
    }, 600);
    this._pendingTimers.push(tid);
  }

  update(dt) {
    // Lever pull animation
    if (this._leverPullAnim) {
      const a = this._leverPullAnim;
      a.timer += dt;
      const t = Math.min(a.timer / a.duration, 1);
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      a.pivot.rotation.x = -Math.PI / 6 + eased * (Math.PI / 3);
      if (t >= 1) this._leverPullAnim = null;
    }

    // Bridge segments rising animation
    if (!this._animating) return;
    this._animTimer += dt;

    let allDone = true;
    for (const seg of this._segments) {
      const localT = Math.max(0, this._animTimer - seg.delay) / 1.2;
      if (localT >= 1) {
        seg.mesh.position.y = seg.targetY;
        // Brighten segment when in place
        seg.mesh.material.emissiveIntensity = 0.5;
      } else {
        allDone = false;
        const eased = localT < 0.5 ? 2 * localT * localT : 1 - (-2 * localT + 2) ** 2 / 2;
        seg.mesh.position.y = seg.startY + (seg.targetY - seg.startY) * eased;
        seg.mesh.material.emissiveIntensity = 0.2 + eased * 0.3;
      }
    }

    if (allDone && this._animating) {
      this._animating = false;

      // Add collision boxes for bridge segments
      for (const seg of this._segments) {
        this.collisionSystem.addBoxCollider(
          seg.mesh.position.x, seg.mesh.position.y - 0.15,
          seg.mesh.position.z, 1.8, 0.3, 1.8
        );
      }

      this.solve();
    }
  }

  _playLeverSound() {
    try {
      if (!this._audioCtx) this._audioCtx = new AudioContext();
      const ctx = this._audioCtx;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.3);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.4);
    } catch (e) {
      // Audio not available
    }
  }

  _playBridgeSound() {
    try {
      if (!this._audioCtx) this._audioCtx = new AudioContext();
      const ctx = this._audioCtx;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(80, now);
      osc.frequency.linearRampToValueAtTime(200, now + 2);
      gain.gain.setValueAtTime(0.1, now);
      gain.gain.linearRampToValueAtTime(0.2, now + 1);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 3);
    } catch (e) {
      // Audio not available
    }
  }

  onSolved() {
    this.eventBus.emit('notification', { text: 'The crystal bridge is raised! Walk across to the final platform!' });
  }

  dispose() {
    for (const t of this._pendingTimers) clearTimeout(t);
    this._pendingTimers.length = 0;
    if (this._lever) { this.scene.remove(this._lever); this._lever.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }); }
    for (const seg of this._segments) {
      this.scene.remove(seg.mesh); if (seg.mesh.geometry) seg.mesh.geometry.dispose(); if (seg.mesh.material) seg.mesh.material.dispose();
    }
    if (this._platform) { this.scene.remove(this._platform); this._platform.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }); }
    this._segments.length = 0;
  }
}
