import * as THREE from 'three';
import { PuzzleBase } from '../PuzzleBase.js';

const _playerPos = new THREE.Vector3();

/**
 * CouchCompletePuzzle — A couch spawns after the crystal is placed on the altar.
 * The player must jump onto the couch (proximity + height check) to complete the level.
 * Uses 1_couch.glb.
 */
export class CouchCompletePuzzle extends PuzzleBase {
  constructor(eventBus, engine) {
    super('couch_complete', eventBus);
    this.engine = engine;
    this.scene = engine.scene;
    this.collisionSystem = engine.collisionSystem;

    this._couchModel = null;
    this._couchPos = new THREE.Vector3(0, 0, -10);
    this._sitDistance = 1.5;
    this._couchSpawned = false;
    this._spawnAnimTimer = 0;
    this._spawnAnimDuration = 2.0;
    this._spawning = false;
    this._couchGlow = null;
  }

  onActivate() {
    // Couch spawns when this puzzle activates (triggered by crystal placement)
    this._spawnCouch();
  }

  async _spawnCouch() {
    this._spawning = true;
    this._spawnAnimTimer = 0;

    try {
      const gltf = await this.engine.assetLoader.loadGLTF('/models/1/1_couch.glb');
      this._couchModel = gltf.scene;
      this._couchModel.scale.setScalar(0.8);

      // Auto-ground
      const box = new THREE.Box3().setFromObject(this._couchModel);
      this._couchModel.position.copy(this._couchPos);
      this._couchModel.position.y = -box.min.y * 0.8;
      // Face the player spawn direction
      this._couchModel.rotation.y = 0;

      // Start invisible, fade in
      this._couchModel.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material = child.material.clone();
          child.material.transparent = true;
          child.material.opacity = 0;
        }
      });

      this.scene.add(this._couchModel);
      this._couchSpawned = true;

      // Spawn glow effect
      this._couchGlow = new THREE.PointLight('#ffdd44', 3.0, 10);
      this._couchGlow.position.copy(this._couchPos);
      this._couchGlow.position.y += 1.5;
      this.scene.add(this._couchGlow);

      // Add collision box for the couch
      const couchBox = new THREE.Box3().setFromObject(this._couchModel);
      const size = new THREE.Vector3();
      couchBox.getSize(size);
      this.collisionSystem.addBoxCollider(
        this._couchPos.x, this._couchPos.y,
        this._couchPos.z, size.x * 0.8, size.y * 0.8, size.z * 0.8
      );

      this.eventBus.emit('notification', { text: 'A mystical couch appears! Jump onto it to complete the ritual!' });
    } catch (e) {
      console.warn('Failed to load couch model:', e);
      this._createFallbackCouch();
    }
  }

  _createFallbackCouch() {
    const group = new THREE.Group();

    // Seat
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.3, 0.8),
      new THREE.MeshStandardMaterial({
        color: 0x8B2252,
        metalness: 0.1,
        roughness: 0.8,
      })
    );
    seat.position.y = 0.4;
    group.add(seat);

    // Backrest
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.6, 0.2),
      new THREE.MeshStandardMaterial({
        color: 0x8B2252,
        metalness: 0.1,
        roughness: 0.8,
      })
    );
    back.position.set(0, 0.85, -0.3);
    group.add(back);

    // Arms
    for (const side of [-1, 1]) {
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.4, 0.8),
        new THREE.MeshStandardMaterial({
          color: 0x6B1242,
          metalness: 0.2,
          roughness: 0.6,
        })
      );
      arm.position.set(side * 1.0, 0.65, 0);
      group.add(arm);
    }

    group.position.copy(this._couchPos);
    group.traverse((child) => {
      if (child.isMesh && child.material) {
        child.material.transparent = true;
        child.material.opacity = 0;
      }
    });

    this.scene.add(group);
    this._couchModel = group;
    this._couchSpawned = true;
    this._spawning = true;
    this._spawnAnimTimer = 0;

    // Collision
    this.collisionSystem.addBoxCollider(
      this._couchPos.x, this._couchPos.y,
      this._couchPos.z, 2.0, 0.7, 0.8
    );

    // Glow
    this._couchGlow = new THREE.PointLight('#ffdd44', 3.0, 10);
    this._couchGlow.position.copy(this._couchPos);
    this._couchGlow.position.y += 1.5;
    this.scene.add(this._couchGlow);

    this.eventBus.emit('notification', { text: 'A mystical couch appears! Jump onto it to complete the ritual!' });
  }

  update(dt) {
    // Spawn fade-in animation
    if (this._spawning && this._couchSpawned) {
      this._spawnAnimTimer += dt;
      const t = Math.min(this._spawnAnimTimer / this._spawnAnimDuration, 1);
      const opacity = t;

      this._couchModel.traverse((child) => {
        if (child.isMesh && child.material) {
          child.material.opacity = opacity;
          if (t >= 1) {
            child.material.transparent = false;
          }
        }
      });

      if (this._couchGlow) {
        this._couchGlow.intensity = 3.0 * (1 - t * 0.5);
      }

      if (t >= 1) {
        this._spawning = false;
      }
    }

    // Check if player is on the couch (proximity + they must be above couch seat level)
    if (this.state === 'active' && this._couchSpawned && !this._spawning) {
      this.engine.camera.getWorldPosition(_playerPos);

      const dx = _playerPos.x - this._couchPos.x;
      const dz = _playerPos.z - this._couchPos.z;
      const horizontalDist = Math.sqrt(dx * dx + dz * dz);

      // Player must be close horizontally and roughly at couch seat height
      const playerY = this.engine.cameraRig.position.y;
      const seatHeight = this._couchPos.y + 0.4; // approximate seat Y

      if (horizontalDist < this._sitDistance && playerY >= seatHeight - 0.2 && playerY <= seatHeight + 0.8) {
        this.solve();
      }
    }

    // Pulse glow
    if (this._couchGlow && this.state === 'active' && !this._spawning) {
      const time = performance.now() * 0.001;
      this._couchGlow.intensity = 1.5 + Math.sin(time * 2) * 0.5;
    }
  }

  onSolved() {
    this.eventBus.emit('notification', { text: 'You sit upon the throne... The ritual is complete!' });

    // Make glow golden and bright
    if (this._couchGlow) {
      this._couchGlow.color.setHex(0xffdd44);
      this._couchGlow.intensity = 5.0;
    }
  }
}
