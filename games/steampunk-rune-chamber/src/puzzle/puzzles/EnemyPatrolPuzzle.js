import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { PuzzleBase } from '../PuzzleBase.js';

const _playerPos = new THREE.Vector3();
const _enemyPos = new THREE.Vector3();

/**
 * EnemyPatrolPuzzle — Steampunk mushroom enemies patrol floating platforms.
 * Uses 4_mushroom.glb with skeleton walk animation (translation-independent).
 * If the player touches an enemy, they are reset to spawn.
 *
 * This puzzle also creates the floating platforms the player must traverse.
 * It activates after the lever is pulled and is "solved" when the player
 * reaches the crystal platform (checked externally by CrystalCollectPuzzle).
 */
export class EnemyPatrolPuzzle extends PuzzleBase {
  constructor(eventBus, engine) {
    super('enemy_patrol', eventBus);
    this.engine = engine;
    this.scene = engine.scene;
    this.collisionSystem = engine.collisionSystem;

    this._enemies = [];
    this._mixers = [];
    this._platforms = [];
    this._killRadius = 1.2;
    this._playerSpawn = new THREE.Vector3(0, 0, 15);
    this._active = false;

    // Platform definitions: [x, y, z, width, depth]
    // Creates a path from ground level up to high platform where crystal sits
    this._platformDefs = [
      // Starting platforms near ground
      { pos: [5, 1.5, 5], w: 3, d: 3 },
      { pos: [8, 3.0, 0], w: 2.5, d: 2.5 },
      { pos: [5, 4.5, -5], w: 2.5, d: 2.5 },
      // Mid-height platforms
      { pos: [0, 6.0, -8], w: 3, d: 3, hasEnemy: true },
      { pos: [-5, 7.5, -5], w: 2.5, d: 2.5 },
      { pos: [-8, 9.0, 0], w: 3, d: 3, hasEnemy: true },
      // High platforms
      { pos: [-5, 10.5, 5], w: 2.5, d: 2.5 },
      { pos: [0, 12.0, 3], w: 3, d: 3, hasEnemy: true },
      // Crystal platform (highest)
      { pos: [0, 13.5, -3], w: 4, d: 4, isCrystalPlatform: true },
    ];
  }

  onActivate() {
    this._active = true;
    this._buildPlatforms();
    this._spawnEnemies();
    this.eventBus.emit('notification', { text: 'Jump across the platforms! Beware the steampunk mushrooms!' });
  }

  _buildPlatforms() {
    for (const def of this._platformDefs) {
      const w = def.w;
      const d = def.d;
      const h = 0.3;

      // Platform mesh (steampunk style: brass-colored with dark trim)
      const group = new THREE.Group();

      const top = new THREE.Mesh(
        new THREE.BoxGeometry(w, h, d),
        new THREE.MeshStandardMaterial({
          color: 0x8B6914,
          metalness: 0.6,
          roughness: 0.3,
        })
      );
      top.position.y = 0;
      group.add(top);

      // Edge trim (dark border)
      const trimMat = new THREE.MeshLambertMaterial({ color: 0x3a2a1a });
      const trimH = 0.08;

      const frontTrim = new THREE.Mesh(new THREE.BoxGeometry(w, trimH, 0.05), trimMat);
      frontTrim.position.set(0, -h / 2 + trimH / 2, d / 2);
      group.add(frontTrim);

      const backTrim = new THREE.Mesh(new THREE.BoxGeometry(w, trimH, 0.05), trimMat);
      backTrim.position.set(0, -h / 2 + trimH / 2, -d / 2);
      group.add(backTrim);

      const leftTrim = new THREE.Mesh(new THREE.BoxGeometry(0.05, trimH, d), trimMat);
      leftTrim.position.set(-w / 2, -h / 2 + trimH / 2, 0);
      group.add(leftTrim);

      const rightTrim = new THREE.Mesh(new THREE.BoxGeometry(0.05, trimH, d), trimMat);
      rightTrim.position.set(w / 2, -h / 2 + trimH / 2, 0);
      group.add(rightTrim);

      // Decorative gears on sides
      if (w >= 3) {
        const gearMat = new THREE.MeshStandardMaterial({
          color: 0xaa8833,
          metalness: 0.7,
          roughness: 0.2,
        });
        const gear = new THREE.Mesh(
          new THREE.TorusGeometry(0.3, 0.05, 6, 8),
          gearMat
        );
        gear.position.set(w / 2 + 0.01, 0, 0);
        gear.rotation.y = Math.PI / 2;
        group.add(gear);

        // Store for animation
        def.gear = gear;
      }

      group.position.set(def.pos[0], def.pos[1], def.pos[2]);
      this.scene.add(group);
      this._platforms.push({ group, def });

      // Add collision box for the platform
      this.collisionSystem.addBoxCollider(
        def.pos[0], def.pos[1] - h / 2,
        def.pos[2], w, h, d
      );

      // Crystal platform marker glow
      if (def.isCrystalPlatform) {
        const glow = new THREE.PointLight('#00ffaa', 2.0, 8);
        glow.position.set(def.pos[0], def.pos[1] + 1, def.pos[2]);
        this.scene.add(glow);
        this._crystalPlatformGlow = glow;
      }
    }
  }

  async _spawnEnemies() {
    const enemyDefs = this._platformDefs.filter(d => d.hasEnemy);

    // Load the mushroom GLB once, then clone for each enemy
    let sourceGltf = null;
    try {
      sourceGltf = await this.engine.assetLoader.loadGLTF('/models/1/4_mushroom.glb');
      console.log(`Mushroom model loaded: ${sourceGltf.animations.length} animation(s)`);
      sourceGltf.animations.forEach((clip, i) =>
        console.log(`  Animation [${i}]: "${clip.name}" duration=${clip.duration}s tracks=${clip.tracks.length}`)
      );
    } catch (e) {
      console.warn('Failed to load mushroom enemy model:', e);
      return;
    }

    for (const def of enemyDefs) {
      // Clone the model properly (SkeletonUtils handles SkinnedMesh + skeleton)
      const model = SkeletonUtils.clone(sourceGltf.scene);
      model.scale.setScalar(0.6);

      // Auto-ground on platform (model has bottom-center pivot)
      const box = new THREE.Box3().setFromObject(model);
      const platformTop = def.pos[1] + 0.15;
      model.position.set(def.pos[0], platformTop - box.min.y * 0.6, def.pos[2]);

      this.scene.add(model);

      // Set up AnimationMixer — strip root position tracks so it plays in-place
      const mixer = new THREE.AnimationMixer(model);
      if (sourceGltf.animations.length > 0) {
        const clip = this._stripRootMotion(sourceGltf.animations[0]);
        const action = mixer.clipAction(clip);
        action.play();
        action.time = Math.random() * clip.duration;
      }
      this._mixers.push(mixer);

      // Patrol path: back and forth along the platform
      const patrolHalfDist = def.w / 2 - 0.5;
      this._enemies.push({
        model,
        mixer,
        baseY: model.position.y,
        center: new THREE.Vector3(def.pos[0], model.position.y, def.pos[2]),
        patrolHalfDist,
        speed: 0.2 + Math.random() * 0.1,
        phase: Math.random() * Math.PI * 2,
        axis: Math.random() > 0.5 ? 'x' : 'z',
      });
    }
  }

  _stripRootMotion(clip) {
    // Remove .position tracks from root-level bones so the animation plays in-place
    const rootNames = ['Root', 'root', 'Armature', 'Hip', 'Hips'];
    const filtered = clip.tracks.filter(track => {
      if (!track.name.endsWith('.position')) return true;
      const boneName = track.name.split('.')[0];
      return !rootNames.includes(boneName);
    });
    return new THREE.AnimationClip(clip.name, clip.duration, filtered);
  }

  update(dt) {
    if (!this._active) return;

    const time = performance.now() * 0.001;
    for (const enemy of this._enemies) {
      // --- Translation patrol ---
      const offset = Math.sin(time * enemy.speed + enemy.phase) * enemy.patrolHalfDist;
      if (enemy.axis === 'x') {
        enemy.model.position.x = enemy.center.x + offset;
        enemy.model.rotation.y = Math.cos(time * enemy.speed + enemy.phase) > 0 ? Math.PI : 0;
      } else {
        enemy.model.position.z = enemy.center.z + offset;
        enemy.model.rotation.y = Math.cos(time * enemy.speed + enemy.phase) > 0 ? -Math.PI / 2 : Math.PI / 2;
      }

      // Update skeleton animation from GLB
      enemy.mixer.update(dt);
    }

    // Animate gears on platforms
    for (const plat of this._platforms) {
      if (plat.def.gear) {
        plat.def.gear.rotation.z += dt * 0.5;
      }
    }

    // Check player-enemy collision (only when puzzle is active)
    if (this.state === 'active') {
      this.engine.camera.getWorldPosition(_playerPos);

      for (const enemy of this._enemies) {
        _enemyPos.copy(enemy.model.position);
        // Check XZ distance and vertical overlap
        const dx = _playerPos.x - _enemyPos.x;
        const dz = _playerPos.z - _enemyPos.z;
        const horizontalDist = Math.sqrt(dx * dx + dz * dz);
        const verticalDist = Math.abs(_playerPos.y - _enemyPos.y);

        if (horizontalDist < this._killRadius && verticalDist < 2.0) {
          this._onPlayerHit();
          break;
        }
      }
    }
  }

  _onPlayerHit() {
    this.eventBus.emit('notification', { text: 'A steampunk mushroom got you! Resetting...' });

    // Reset player to spawn
    this.engine.cameraRig.position.copy(this._playerSpawn);
    this.engine.locomotion.velocityY = 0;
    this.engine.locomotion._isGrounded = true;
  }

  /**
   * Get crystal platform position (for CrystalCollectPuzzle to know where to spawn crystal).
   */
  getCrystalPlatformPosition() {
    const crystalDef = this._platformDefs.find(d => d.isCrystalPlatform);
    if (crystalDef) {
      return new THREE.Vector3(crystalDef.pos[0], crystalDef.pos[1] + 0.3, crystalDef.pos[2]);
    }
    return new THREE.Vector3(0, 13.8, -3);
  }

  onSolved() {
    // Enemies stop being dangerous but keep patrolling for atmosphere
    this._active = false;
    this.eventBus.emit('notification', { text: 'The mushrooms seem calmer now...' });
  }
}
