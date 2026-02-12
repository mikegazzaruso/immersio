import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { PuzzleBase } from '../PuzzleBase.js';

const _playerPos = new THREE.Vector3();
const _enemyPos = new THREE.Vector3();

/**
 * EnemyPatrolPuzzle — Steampunk mushroom enemies patrol floating platforms.
 * Uses 4_mushroom.glb with skeleton walk animation (translation-independent).
 * If the player touches an enemy, they respawn at the nearest safe spot below
 * (ground level near the platforms), preserving all puzzle progress.
 *
 * Creates 4 floating platforms in a staircase pattern ascending from left to right.
 * 2-3 mushroom enemies patrol on the platforms.
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
    this._active = false;
    this._respawnCooldown = 0;

    // Safe respawn point: ground level near the base of the platform staircase
    this._safeSpawn = new THREE.Vector3(8, 0, 8);

    // Platform definitions: 4 platforms in ascending staircase pattern
    // Arranged from right side going up and slightly forward
    this._platformDefs = [
      // Step 1: Low platform (easy first jump from ground)
      { pos: [8, 2.0, 5], w: 3.5, d: 3.5, hasEnemy: false },
      // Step 2: Mid-low platform with first enemy
      { pos: [4, 4.5, 0], w: 3, d: 3, hasEnemy: true },
      // Step 3: Mid-high platform with second enemy
      { pos: [-2, 7.0, -4], w: 3, d: 3, hasEnemy: true },
      // Step 4: Crystal platform (highest) -- no enemy, reward for making it
      { pos: [-6, 9.5, -8], w: 4, d: 4, isCrystalPlatform: true, hasEnemy: false },
    ];
  }

  onActivate() {
    this._active = true;
    this._buildPlatforms();
    this._spawnEnemies();
    this.eventBus.emit('notification', { text: 'Floating platforms appear! Beware the steampunk mushrooms!' });
  }

  _buildPlatforms() {
    for (const def of this._platformDefs) {
      const w = def.w;
      const d = def.d;
      const h = 0.3;

      // Platform mesh (steampunk style: brass-colored with teal emissive trim)
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

      // Teal emissive trim on edges
      const trimMat = new THREE.MeshStandardMaterial({
        color: 0x00ccaa,
        emissive: 0x00ccaa,
        emissiveIntensity: 0.4,
        metalness: 0.5,
        roughness: 0.2,
      });
      const trimH = 0.06;

      const frontTrim = new THREE.Mesh(new THREE.BoxGeometry(w, trimH, 0.04), trimMat);
      frontTrim.position.set(0, -h / 2 + trimH / 2, d / 2);
      group.add(frontTrim);

      const backTrim = new THREE.Mesh(new THREE.BoxGeometry(w, trimH, 0.04), trimMat);
      backTrim.position.set(0, -h / 2 + trimH / 2, -d / 2);
      group.add(backTrim);

      const leftTrim = new THREE.Mesh(new THREE.BoxGeometry(0.04, trimH, d), trimMat);
      leftTrim.position.set(-w / 2, -h / 2 + trimH / 2, 0);
      group.add(leftTrim);

      const rightTrim = new THREE.Mesh(new THREE.BoxGeometry(0.04, trimH, d), trimMat);
      rightTrim.position.set(w / 2, -h / 2 + trimH / 2, 0);
      group.add(rightTrim);

      // Decorative gear on side of wider platforms
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
        def.gear = gear;
      }

      // Underside dark plate for depth
      const underside = new THREE.Mesh(
        new THREE.BoxGeometry(w * 0.9, 0.15, d * 0.9),
        new THREE.MeshLambertMaterial({ color: 0x3a2a1a })
      );
      underside.position.y = -h / 2 - 0.075;
      group.add(underside);

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

      // Set up AnimationMixer -- strip root position tracks so it plays in-place
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
        speed: 0.3 + Math.random() * 0.15,
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

    // Respawn cooldown
    if (this._respawnCooldown > 0) {
      this._respawnCooldown -= dt;
      return;
    }

    const time = performance.now() * 0.001;
    for (const enemy of this._enemies) {
      // Translation patrol
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
    this.eventBus.emit('notification', { text: 'A steampunk mushroom got you! Respawning nearby...' });

    // Respawn at safe spot near the base of the platforms (keep all progress)
    this.engine.cameraRig.position.copy(this._safeSpawn);
    this.engine.locomotion.velocityY = 0;
    this.engine.locomotion._isGrounded = true;

    // Brief invulnerability to prevent immediate re-death
    this._respawnCooldown = 1.5;
  }

  /**
   * Get crystal platform position (for CrystalCollectPuzzle to know where to spawn crystal).
   */
  getCrystalPlatformPosition() {
    const crystalDef = this._platformDefs.find(d => d.isCrystalPlatform);
    if (crystalDef) {
      return new THREE.Vector3(crystalDef.pos[0], crystalDef.pos[1] + 0.3, crystalDef.pos[2]);
    }
    return new THREE.Vector3(-6, 9.8, -8);
  }

  onSolved() {
    // Enemies stop being dangerous but keep patrolling for atmosphere
    this._active = false;
    this.eventBus.emit('notification', { text: 'The mushrooms seem calmer now...' });
  }

  /**
   * Return all enemy model objects for raycast targeting.
   */
  getEnemyModels() {
    return this._enemies.map(e => e.model);
  }

  /**
   * Walk parent chain from a raycast hit object to find the matching enemy.
   */
  findEnemyByObject(obj) {
    let current = obj;
    while (current) {
      for (const enemy of this._enemies) {
        if (current === enemy.model) return enemy;
      }
      current = current.parent;
    }
    return null;
  }

  /**
   * Remove an enemy from the scene and internal arrays.
   */
  destroyEnemy(enemy) {
    // Stop animations first
    const mixerIdx = this._mixers.indexOf(enemy.mixer);
    if (mixerIdx !== -1) {
      enemy.mixer.stopAllAction();
      this._mixers.splice(mixerIdx, 1);
    }

    // Dispose geometry and materials to avoid GC pressure
    enemy.model.traverse((child) => {
      if (child.isMesh) {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    });

    this.scene.remove(enemy.model);

    const enemyIdx = this._enemies.indexOf(enemy);
    if (enemyIdx !== -1) this._enemies.splice(enemyIdx, 1);
  }
}
