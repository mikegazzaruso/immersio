import * as THREE from 'three';
import { Interactable } from '../interaction/Interactable.js';

const _dir = new THREE.Vector3();
const _origin = new THREE.Vector3();

export class SteampunkGun {
  constructor(engine) {
    this.engine = engine;
    this.scene = engine.scene;
    this.eventBus = engine.eventBus;
    this.camera = engine.camera;

    this.armed = false;
    this._aiming = false;
    this._cooldown = 0;
    this._cooldownTime = 0.25;
    this._particles = [];
    this._projectiles = [];
    this._muzzleFlashes = [];
    this._enemyPuzzle = null;

    // Audio context (lazy init on first interaction)
    this._audioCtx = null;
    this._explosionBuffer = null;
  }

  setEnemyPuzzle(puzzle) {
    this._enemyPuzzle = puzzle;
  }

  init() {
    this._buildGunMesh();
    this._placeGun();
    this._buildAimLine();
    this._bindEvents();
  }

  _buildGunMesh() {
    this.gunGroup = new THREE.Group();

    // Barrel — brass cylinder
    const barrelGeo = new THREE.CylinderGeometry(0.02, 0.025, 0.3, 8);
    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xb8860b,
      metalness: 0.8,
      roughness: 0.2,
    });
    const barrel = new THREE.Mesh(barrelGeo, brassMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = -0.15;
    this.gunGroup.add(barrel);

    // Body — dark box
    const bodyGeo = new THREE.BoxGeometry(0.05, 0.06, 0.15);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x2a1a0a,
      metalness: 0.4,
      roughness: 0.6,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    this.gunGroup.add(body);

    // Grip — angled handle
    const gripGeo = new THREE.BoxGeometry(0.035, 0.1, 0.04);
    const gripMat = new THREE.MeshStandardMaterial({
      color: 0x1a0a00,
      metalness: 0.3,
      roughness: 0.8,
    });
    const grip = new THREE.Mesh(gripGeo, gripMat);
    grip.position.set(0, -0.06, 0.03);
    grip.rotation.x = -0.3;
    this.gunGroup.add(grip);

    // Energy core — teal emissive sphere
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x00ccaa,
      emissive: 0x00ccaa,
      emissiveIntensity: 0.8,
      metalness: 0.5,
      roughness: 0.1,
    });
    this._coreMat = coreMat;
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 8), coreMat);
    core.position.set(0, 0.01, -0.02);
    this.gunGroup.add(core);

    // Muzzle point (used for shot origin)
    this._muzzleOffset = new THREE.Vector3(0, 0, -0.3);

    // Pre-build shared projectile geometry and material
    this._projGeo = new THREE.SphereGeometry(0.06, 6, 6);
    this._projMat = new THREE.MeshStandardMaterial({
      color: 0x00ffaa,
      emissive: 0x00ffaa,
      emissiveIntensity: 1.5,
      transparent: true,
      opacity: 0.9,
    });
  }

  _placeGun() {
    // Hidden corner position with hint light
    this.gunGroup.position.set(-17, 0.5, -17);
    this.gunGroup.rotation.x = -Math.PI / 6;
    this.scene.add(this.gunGroup);

    // Subtle teal point light hint
    this._hintLight = new THREE.PointLight(0x00ccaa, 1.5, 6);
    this._hintLight.position.set(-17, 1.2, -17);
    this.scene.add(this._hintLight);

    // Register as interactable (activate = pick up)
    this._interactable = new Interactable(this.gunGroup, {
      type: 'activate',
      onActivate: (hand) => this._onPickup(hand),
    });
    this.engine.interactionSystem.register(this._interactable);
  }

  _buildAimLine() {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, -20),
    ]);
    const mat = new THREE.LineBasicMaterial({
      color: 0x00ffaa,
      transparent: true,
      opacity: 0.5,
    });
    this._aimLine = new THREE.Line(geo, mat);
    this._aimLine.visible = false;
    this.scene.add(this._aimLine);
  }

  _bindEvents() {
    // VR: grip right toggles aim
    this.eventBus.on('GRIP_RIGHT_DOWN', () => {
      if (!this.armed) return;
      this._aiming = true;
      this._aimLine.visible = true;
      this.engine.interactionSystem.gunAiming = true;
    });
    this.eventBus.on('GRIP_RIGHT_UP', () => {
      if (!this.armed) return;
      this._aiming = false;
      this._aimLine.visible = false;
      this.engine.interactionSystem.gunAiming = false;
    });

    // Unified fire event — emitted by InteractionSystem when input should go to gun
    this.eventBus.on('gun:fire', () => {
      if (!this.armed) return;
      this._fire();
    });
  }

  _onPickup(hand) {
    if (this.armed) return;
    this.armed = true;

    // Unregister interactable so it can't be picked up again
    this.engine.interactionSystem.unregister(this._interactable);
    delete this.gunGroup.userData.interactable;

    // Remove hint light
    if (this._hintLight) {
      this.scene.remove(this._hintLight);
      this._hintLight.dispose?.();
      this._hintLight = null;
    }

    this.eventBus.emit('gun:armed');
    this.eventBus.emit('notification', { text: 'You found a steampunk pistol! Shoot the mushrooms!' });

    this._playPickupSFX();
    this._pregenExplosionBuffer();

    // Delay equip slightly for feedback
    setTimeout(() => this._equipGun(), 100);
  }

  _equipGun() {
    this.gunGroup.removeFromParent();

    if (this.engine.renderer.xr.isPresenting) {
      // VR: parent to right grip
      const grip = this.engine.vrSetup.controllerGrip1;
      grip.add(this.gunGroup);
      this.gunGroup.position.set(0, 0, -0.05);
      this.gunGroup.rotation.set(0, 0, 0);
    } else {
      // Desktop: parent to camera with FPS offset (lower right)
      this.camera.add(this.gunGroup);
      this.gunGroup.position.set(0.2, -0.15, -0.4);
      this.gunGroup.rotation.set(0, 0, 0);
    }
  }

  _getFireOriginAndDir() {
    if (this.engine.renderer.xr.isPresenting) {
      const grip = this.engine.vrSetup.controllerGrip1;
      grip.getWorldPosition(_origin);
      const worldQuat = new THREE.Quaternion();
      grip.getWorldQuaternion(worldQuat);
      _dir.set(0, 0, -1).applyQuaternion(worldQuat);
    } else {
      this.camera.getWorldPosition(_origin);
      _dir.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
    }
    return { origin: _origin.clone(), direction: _dir.clone() };
  }

  _fire() {
    if (this._cooldown > 0) return;
    this._cooldown = this._cooldownTime;

    this._playShootSFX();
    this._spawnMuzzleFlash();

    const { origin, direction } = this._getFireOriginAndDir();
    this._spawnProjectile(origin, direction);
  }

  _spawnProjectile(origin, direction) {
    const mesh = new THREE.Mesh(this._projGeo, this._projMat);
    mesh.position.copy(origin);
    this.scene.add(mesh);

    // Trailing light on projectile
    const light = new THREE.PointLight(0x00ffaa, 2, 4);
    mesh.add(light);

    this._projectiles.push({
      mesh,
      light,
      direction,
      speed: 60,
      life: 50 / 60,
    });
  }

  _updateProjectiles(dt) {
    for (let i = this._projectiles.length - 1; i >= 0; i--) {
      const p = this._projectiles[i];
      p.life -= dt;

      if (p.life <= 0) {
        this._removeProjectile(i);
        continue;
      }

      // Move projectile
      p.mesh.position.addScaledVector(p.direction, p.speed * dt);

      // Check enemy hits (proximity-based)
      if (this._enemyPuzzle) {
        const enemies = this._enemyPuzzle.getEnemyModels();
        for (const model of enemies) {
          const dist = p.mesh.position.distanceTo(model.position);
          if (dist < 1.2) {
            const enemy = this._enemyPuzzle.findEnemyByObject(model);
            if (enemy) {
              const hitPos = model.position.clone();
              this._enemyPuzzle.destroyEnemy(enemy);
              this._spawnExplosion(hitPos);
              this._playExplosionSFX();
              this._removeProjectile(i);
              break;
            }
          }
        }
      }
    }
  }

  _removeProjectile(index) {
    const p = this._projectiles[index];
    p.mesh.remove(p.light);
    p.light.dispose();
    this.scene.remove(p.mesh);
    this._projectiles.splice(index, 1);
  }

  _spawnMuzzleFlash() {
    const flash = new THREE.PointLight(0x00ffaa, 3, 4);
    this.gunGroup.add(flash);
    flash.position.copy(this._muzzleOffset);
    this._muzzleFlashes.push({ light: flash, life: 0.1 });
  }

  _spawnExplosion(pos) {
    const count = 40;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const velocities = [];

    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y + 0.5;
      positions[i * 3 + 2] = pos.z;

      const t = Math.random();
      colors[i * 3] = t;
      colors[i * 3 + 1] = 0.8 - t * 0.5;
      colors[i * 3 + 2] = 0.4 * (1 - t);

      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 4,
        Math.random() * 3 + 1,
        (Math.random() - 0.5) * 4,
      ));
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });

    const points = new THREE.Points(geo, mat);
    this.scene.add(points);
    this._particles.push({ points, velocities, life: 0.8, maxLife: 0.8 });
  }

  _updateParticles(dt) {
    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.life -= dt;

      if (p.life <= 0) {
        this.scene.remove(p.points);
        p.points.geometry.dispose();
        p.points.material.dispose();
        this._particles.splice(i, 1);
        continue;
      }

      const posAttr = p.points.geometry.getAttribute('position');
      for (let j = 0; j < p.velocities.length; j++) {
        p.velocities[j].y -= 9.8 * dt;
        posAttr.array[j * 3] += p.velocities[j].x * dt;
        posAttr.array[j * 3 + 1] += p.velocities[j].y * dt;
        posAttr.array[j * 3 + 2] += p.velocities[j].z * dt;
      }
      posAttr.needsUpdate = true;
      p.points.material.opacity = p.life / p.maxLife;
    }
  }

  _updateMuzzleFlashes(dt) {
    for (let i = this._muzzleFlashes.length - 1; i >= 0; i--) {
      const f = this._muzzleFlashes[i];
      f.life -= dt;
      if (f.life <= 0) {
        f.light.removeFromParent();
        f.light.dispose();
        this._muzzleFlashes.splice(i, 1);
      }
    }
  }

  _updateAimLine() {
    if (!this.armed) return;

    if (this.engine.renderer.xr.isPresenting) {
      if (!this._aiming) return;
      const grip = this.engine.vrSetup.controllerGrip1;
      grip.getWorldPosition(_origin);
      const worldQuat = new THREE.Quaternion();
      grip.getWorldQuaternion(worldQuat);
      _dir.set(0, 0, -1).applyQuaternion(worldQuat);
    } else {
      this.camera.getWorldPosition(_origin);
      _dir.set(0, 0, -1).applyQuaternion(this.camera.quaternion);
      this._aimLine.visible = true;
    }

    const posArr = this._aimLine.geometry.attributes.position.array;
    posArr[0] = _origin.x;
    posArr[1] = _origin.y;
    posArr[2] = _origin.z;
    posArr[3] = _origin.x + _dir.x * 20;
    posArr[4] = _origin.y + _dir.y * 20;
    posArr[5] = _origin.z + _dir.z * 20;
    this._aimLine.geometry.attributes.position.needsUpdate = true;
  }

  update(dt) {
    if (this._cooldown > 0) this._cooldown -= dt;
    this._updateParticles(dt);
    this._updateMuzzleFlashes(dt);
    this._updateProjectiles(dt);

    if (!this.armed) {
      if (this._hintLight) {
        this._hintLight.intensity = 1.0 + Math.sin(performance.now() * 0.003) * 0.5;
      }
      if (this._coreMat) {
        this._coreMat.emissiveIntensity = 0.5 + Math.sin(performance.now() * 0.004) * 0.3;
      }
      return;
    }

    this._updateAimLine();
  }

  // ─── Procedural Audio ─────────────────────────────────

  _getAudioCtx() {
    if (!this._audioCtx) {
      this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this._audioCtx;
  }

  _pregenExplosionBuffer() {
    const ctx = this._getAudioCtx();
    const bufferSize = ctx.sampleRate * 0.3;
    this._explosionBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = this._explosionBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
    }
  }

  _playShootSFX() {
    const ctx = this._getAudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.1);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  _playExplosionSFX() {
    const ctx = this._getAudioCtx();
    const now = ctx.currentTime;

    // Reuse pre-generated noise buffer
    if (this._explosionBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this._explosionBuffer;
      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.2, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      noise.connect(noiseGain).connect(ctx.destination);
      noise.start(now);
    }

    // Low thump
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.2);

    const thumpGain = ctx.createGain();
    thumpGain.gain.setValueAtTime(0.25, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(thumpGain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  _playPickupSFX() {
    const ctx = this._getAudioCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(900, now + 0.3);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);
  }
}
