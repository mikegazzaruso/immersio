import * as THREE from 'three';

const _playerPos = new THREE.Vector3();

export class LevelTransition {
  constructor(engine) {
    this._engine = engine;
    this._portals = [];
    this._fadeOverlay = null;
    this._fading = false;
    this._fadeDir = 0; // 1 = fade out, -1 = fade in
    this._fadeAlpha = 0;
    this._fadeDuration = 0.6;
    this._pendingLevel = null;
    this._triggerDistance = 1.8;
    this._cooldown = 0;

    this._createFadeOverlay();
  }

  /**
   * Build portals from level config exit definitions.
   * Call after LevelLoader.load() completes.
   *
   * @param {object} levelConfig - The level config object
   */
  buildFromConfig(levelConfig) {
    this.clear();

    if (!levelConfig.exit) return;

    const exits = Array.isArray(levelConfig.exit) ? levelConfig.exit : [levelConfig.exit];
    for (const exit of exits) {
      this._createPortal(exit);
    }
  }

  /**
   * Programmatically trigger a level transition (used by behaviors.js).
   * @param {number} targetLevel — the level to load
   */
  triggerTransition(targetLevel) {
    if (this._fading) return; // already transitioning
    this._startTransition(targetLevel);
  }

  clear() {
    const scene = this._engine.scene;
    for (const portal of this._portals) {
      scene.remove(portal.group);
      portal.group.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
    }
    this._portals.length = 0;
  }

  _createPortal(exit) {
    const scene = this._engine.scene;
    const group = new THREE.Group();

    // Ring
    const ringGeo = new THREE.TorusGeometry(1.0, 0.08, 8, 32);
    const ringMat = new THREE.MeshStandardMaterial({
      color: exit.color || 0x44aaff,
      emissive: exit.color || 0x44aaff,
      emissiveIntensity: 0.8,
      metalness: 0.5,
      roughness: 0.3,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 1.2;
    group.add(ring);

    // Inner glow disc
    const discGeo = new THREE.CircleGeometry(0.9, 32);
    const discMat = new THREE.MeshBasicMaterial({
      color: exit.color || 0x44aaff,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.y = 1.2;
    group.add(disc);

    // Point light
    const light = new THREE.PointLight(exit.color || 0x44aaff, 1.5, 6);
    light.position.y = 1.2;
    group.add(light);

    group.position.set(...exit.position);
    if (exit.rotationY != null) {
      group.rotation.y = exit.rotationY;
    }

    scene.add(group);

    this._portals.push({
      group,
      ring,
      disc,
      light,
      targetLevel: exit.targetLevel,
      label: exit.label || `Level ${exit.targetLevel}`,
      position: new THREE.Vector3(...exit.position),
    });
  }

  _createFadeOverlay() {
    // Desktop fade: full-screen div
    const div = document.createElement('div');
    div.id = 'fade-overlay';
    div.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: #000; opacity: 0; pointer-events: none; z-index: 1000;
      transition: none;
    `;
    document.body.appendChild(div);
    this._fadeOverlay = div;

    // VR fade: camera-attached quad
    const geo = new THREE.PlaneGeometry(4, 3);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.z = -0.5;
    mesh.renderOrder = 999;
    this._engine.camera.add(mesh);
    this._vrFadeMesh = mesh;
  }

  update(dt) {
    this._cooldown = Math.max(0, this._cooldown - dt);

    // Animate portals
    const time = performance.now() * 0.001;
    for (const portal of this._portals) {
      portal.ring.rotation.z = time * 0.5;
      portal.disc.material.opacity = 0.1 + Math.sin(time * 2) * 0.08;
      portal.light.intensity = 1.2 + Math.sin(time * 3) * 0.4;
    }

    // Proximity check
    if (!this._fading && this._cooldown <= 0) {
      this._engine.camera.getWorldPosition(_playerPos);
      for (const portal of this._portals) {
        const dist = _playerPos.distanceTo(portal.position);
        if (dist < this._triggerDistance) {
          this._startTransition(portal.targetLevel);
          break;
        }
      }
    }

    // Fade animation
    if (this._fading) {
      this._fadeAlpha += (this._fadeDir / this._fadeDuration) * dt;
      this._fadeAlpha = Math.max(0, Math.min(1, this._fadeAlpha));

      this._fadeOverlay.style.opacity = this._fadeAlpha;
      this._vrFadeMesh.material.opacity = this._fadeAlpha;

      // Fully faded out → load level
      if (this._fadeDir === 1 && this._fadeAlpha >= 1 && this._pendingLevel !== null) {
        const level = this._pendingLevel;
        this._pendingLevel = null;
        this.clear();
        this._engine._loadLevel(level).then(() => {
          this._fadeDir = -1; // fade back in
        });
      }

      // Fully faded in → done
      if (this._fadeDir === -1 && this._fadeAlpha <= 0) {
        this._fading = false;
        this._cooldown = 2.0;
      }
    }
  }

  _startTransition(targetLevel) {
    this._fading = true;
    this._fadeDir = 1;
    this._fadeAlpha = 0;
    this._pendingLevel = targetLevel;
    this._engine.eventBus.emit('level:transition', { targetLevel });
  }
}
