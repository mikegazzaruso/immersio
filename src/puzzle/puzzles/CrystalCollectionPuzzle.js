import * as THREE from 'three';
import { PuzzleBase } from '../PuzzleBase.js';
import { Interactable } from '../../interaction/Interactable.js';
import { ObjectFactory } from '../../assets/ObjectFactory.js';

export class CrystalCollectionPuzzle extends PuzzleBase {
  constructor(eventBus, scene, interactionSystem) {
    super('crystal_collection', eventBus);
    this.scene = scene;
    this.interactionSystem = interactionSystem;
    this.items = [];
    this.snapDistance = 0.8;
    this._bobTime = 0;
    this._audioCtx = null;
  }

  onActivate() {
    const crystals = [
      { name: 'red', hex: 0xff4444, angle: 0 },
      { name: 'cyan', hex: 0x00ccff, angle: 2.1 },
      { name: 'gold', hex: 0xffcc00, angle: 4.2 },
    ];

    crystals.forEach((c, i) => {
      // Create collectible crystal -- visible from center
      const spawnRadius = 8 + Math.random() * 5;
      const crystal = ObjectFactory.crystal(0.25, 0.7, c.hex,
        new THREE.Vector3(
          Math.cos(c.angle) * spawnRadius,
          1.2,
          Math.sin(c.angle) * spawnRadius
        )
      );
      this.scene.add(crystal);

      // Add a point light so crystals glow and are visible from afar
      const glow = new THREE.PointLight(c.hex, 1.5, 8);
      glow.position.copy(crystal.position);
      glow.position.y += 0.3;
      this.scene.add(glow);
      crystal.userData._glow = glow;

      // Create target pedestal at center
      const pedestalAngle = (i / 3) * Math.PI * 2;
      const pedestalRadius = 3;
      const pedestal = ObjectFactory.pedestal(0.5, 0.8, 0x555555,
        new THREE.Vector3(
          Math.cos(pedestalAngle) * pedestalRadius,
          0,
          Math.sin(pedestalAngle) * pedestalRadius
        )
      );
      this.scene.add(pedestal);

      // Add a colored indicator ring on top of pedestal
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.2, 0.03, 8, 16),
        new THREE.MeshStandardMaterial({
          color: c.hex,
          emissive: c.hex,
          emissiveIntensity: 0.4,
          roughness: 0.3,
        })
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(
        pedestal.position.x,
        0.88,
        pedestal.position.z
      );
      this.scene.add(ring);

      // Add fake shadow under crystal
      const shadow = ObjectFactory.fakeShadow(0.3, crystal.position);
      this.scene.add(shadow);

      const targetPos = pedestal.position.clone();
      targetPos.y = 0.95;

      // Make crystal both grabbable (VR) and clickable (desktop)
      const entry = { mesh: crystal, target: targetPos, placed: false, grabbed: false, interactable: null, shadow, ring, pedestal };

      const interactable = new Interactable(crystal, {
        type: 'both',
        onActivate: () => {
          // Desktop/VR trigger: click to collect directly
          this._collectCrystal(entry);
        },
        onGrab: () => {
          entry.grabbed = true;
        },
        onRelease: (hand, worldPos) => {
          entry.grabbed = false;
          this._checkPlacement(entry, worldPos);
        },
      });
      this.interactionSystem.register(interactable);
      entry.interactable = interactable;

      this.items.push(entry);
    });

    this.eventBus.emit('notification', { text: 'Find 3 AI Data Crystals and place them on pedestals!' });
  }

  _collectCrystal(entry) {
    if (entry.placed || entry.grabbed || entry._flying) return;

    // Mark as flying (animating to pedestal) - handled in update()
    entry._flying = true;
    entry._flyElapsed = 0;
    entry._flyDuration = 0.6;
    entry._flyStart = entry.mesh.position.clone();
    entry._flyEnd = entry.target.clone();

    this.interactionSystem.unregister(entry.interactable);
    entry.interactable.setEnabled(false);
  }

  _finishCollect(entry) {
    entry._flying = false;
    entry.placed = true;
    entry.mesh.position.copy(entry._flyEnd);
    if (entry.ring && entry.ring.material) {
      entry.ring.material.emissiveIntensity = 1.0;
    }
    this._playCollectSound();
    const placedCount = this.items.filter(i => i.placed).length;
    this.eventBus.emit('notification', {
      text: `Crystal placed! ${placedCount}/${this.items.length}`
    });
    if (this.items.every(i => i.placed)) {
      this.solve();
    }
  }

  _playCollectSound() {
    try {
      if (!this._audioCtx) this._audioCtx = new AudioContext();
      const ctx = this._audioCtx;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523, now);
      osc.frequency.exponentialRampToValueAtTime(1047, now + 0.15);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {}
  }

  _checkPlacement(entry, releasePos) {
    if (entry.placed) return;

    const dist = releasePos.distanceTo(entry.target);
    if (dist < this.snapDistance) {
      // Snap to target
      entry.mesh.position.copy(entry.target);
      entry.placed = true;
      this.interactionSystem.unregister(entry.interactable);

      // Flash the ring bright
      if (entry.ring && entry.ring.material) {
        entry.ring.material.emissiveIntensity = 1.0;
      }

      const placedCount = this.items.filter(i => i.placed).length;
      this.eventBus.emit('notification', {
        text: `Crystal placed! ${placedCount}/${this.items.length}`
      });

      if (this.items.every(i => i.placed)) {
        this.solve();
      }
    }
  }

  update(dt) {
    if (this.state !== 'active') return;
    this._bobTime += dt;

    for (const item of this.items) {
      // Fly animation (trigger collect)
      if (item._flying) {
        item._flyElapsed += dt;
        const t = Math.min(item._flyElapsed / item._flyDuration, 1);
        const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
        item.mesh.position.lerpVectors(item._flyStart, item._flyEnd, eased);
        item.mesh.position.y += Math.sin(t * Math.PI) * 1.5;
        item.mesh.rotation.y += dt * 8;
        if (t >= 1) {
          this._finishCollect(item);
        }
        continue;
      }
      // Bob unplaced crystals gently (skip if grabbed or placed)
      if (!item.placed && !item.grabbed) {
        item.mesh.position.y = 1.2 + Math.sin(this._bobTime * 2 + this.items.indexOf(item)) * 0.15;
        item.mesh.rotation.y += dt * 0.5;
      }
    }
  }

  onSolved() {
    this.eventBus.emit('notification', { text: 'All AI Data Crystals collected! Knowledge unlocked!' });

    // Victory glow effect on all rings
    for (const item of this.items) {
      if (item.ring && item.ring.material) {
        item.ring.material.emissive.setHex(0x00ff00);
        item.ring.material.emissiveIntensity = 1.5;
      }
    }
  }

  dispose() {
    const disposeObj = (obj) => {
      if (!obj) return;
      this.scene.remove(obj);
      obj.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
    };
    for (const item of this.items) {
      if (item.mesh && item.mesh.userData._glow) disposeObj(item.mesh.userData._glow);
      disposeObj(item.mesh);
      disposeObj(item.pedestal);
      disposeObj(item.ring);
      disposeObj(item.shadow);
    }
    this.items.length = 0;
  }
}
