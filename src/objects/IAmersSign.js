import * as THREE from 'three';
import { FontLoader } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import { Interactable } from '../interaction/Interactable.js';

export class IAmersSign {
  constructor(scene, interactionSystem, options = {}) {
    this.scene = scene;
    this.interactionSystem = interactionSystem;

    this.position = options.position || new THREE.Vector3(0, 4, -5);
    this.color = new THREE.Color(options.color || '#ffcc44');
    this.rotation = options.rotation || 0;

    this.group = new THREE.Group();
    this.group.position.copy(this.position);
    this.group.rotation.y = this.rotation;
    this.scene.add(this.group);

    this._letterMeshes = [];
    this._letterOffsets = [];   // original local X positions
    this._interactables = [];
    this._particles = [];
    this._particleGeo = null;
    this._backLight = null;
    this._audioCtx = null;
    this._animating = false;
    this._disposed = false;
    this._time = 0;
    this._ready = false;
    this._pendingTimers = [];

    this._loadFont();
  }

  _loadFont() {
    const loader = new FontLoader();
    loader.load(
      'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/fonts/helvetiker_bold.typeface.json',
      (font) => this._buildText(font),
      undefined,
      (err) => {
        // Fallback: try loading from node_modules path (Vite resolves this)
        console.warn('CDN font load failed, trying local import', err);
        import('three/examples/fonts/helvetiker_bold.typeface.json').then((mod) => {
          const fontData = mod.default || mod;
          const f = loader.parse(fontData);
          this._buildText(f);
        }).catch(e => console.error('Font load failed completely', e));
      }
    );
  }

  _buildText(font) {
    if (this._disposed) return;
    const letters = 'IAMERS';
    const letterGeos = [];
    let totalWidth = 0;
    const spacing = 0.15;

    // Create geometry for each letter to measure widths
    for (const ch of letters) {
      const geo = new TextGeometry(ch, {
        font,
        size: 0.9,
        depth: 0.25,
        curveSegments: 6,
        bevelEnabled: true,
        bevelThickness: 0.04,
        bevelSize: 0.03,
        bevelSegments: 3,
      });
      geo.computeBoundingBox();
      const w = geo.boundingBox.max.x - geo.boundingBox.min.x;
      letterGeos.push({ geo, width: w });
      totalWidth += w + spacing;
    }
    totalWidth -= spacing; // no trailing space

    // Position each letter centered
    let cursor = -totalWidth / 2;
    for (let i = 0; i < letterGeos.length; i++) {
      const { geo, width } = letterGeos[i];

      // Offset geometry so each letter pivots from its own center
      geo.translate(-width / 2, -0.45, -0.125);

      const hue = i / letterGeos.length;
      const baseColor = this.color.clone();

      const mat = new THREE.MeshStandardMaterial({
        color: baseColor,
        emissive: baseColor,
        emissiveIntensity: 0.4,
        metalness: 0.6,
        roughness: 0.25,
      });

      const mesh = new THREE.Mesh(geo, mat);
      const xPos = cursor + width / 2;
      mesh.position.set(xPos, 0, 0);
      this.group.add(mesh);

      this._letterMeshes.push(mesh);
      this._letterOffsets.push(xPos);

      // Register as interactable
      const interactable = new Interactable(mesh, {
        type: 'activate',
        onActivate: () => this.activate(),
      });
      this.interactionSystem.register(interactable);
      this._interactables.push(interactable);

      cursor += width + spacing;
    }

    // Back light for dramatic glow
    this._backLight = new THREE.PointLight(this.color, 2, 8);
    this._backLight.position.set(0, 0, -0.5);
    this.group.add(this._backLight);

    // Subtle front fill
    const fillLight = new THREE.PointLight(this.color, 0.5, 5);
    fillLight.position.set(0, 0, 1.5);
    this.group.add(fillLight);

    this._ready = true;
  }

  activate() {
    if (this._animating || !this._ready) return;
    this._animating = true;

    this._playChord();
    this._spawnParticles();
    this._explodeLetters();
  }

  _playChord() {
    try {
      if (!this._audioCtx) this._audioCtx = new AudioContext();
      const ctx = this._audioCtx;
      const now = ctx.currentTime;

      // Ascending musical chord -- one note per letter (C4 E4 G4 A4 B4 D5)
      const freqs = [262, 330, 392, 440, 494, 587];

      for (let i = 0; i < freqs.length; i++) {
        const delay = i * 0.08;

        // Main tone
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freqs[i], now + delay);
        gain.gain.setValueAtTime(0, now + delay);
        gain.gain.linearRampToValueAtTime(0.15, now + delay + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, now + delay + 1.2);
        osc.connect(gain).connect(ctx.destination);
        osc.start(now + delay);
        osc.stop(now + delay + 1.3);

        // Shimmer overtone
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(freqs[i] * 2, now + delay);
        gain2.gain.setValueAtTime(0, now + delay);
        gain2.gain.linearRampToValueAtTime(0.04, now + delay + 0.05);
        gain2.gain.exponentialRampToValueAtTime(0.01, now + delay + 0.8);
        osc2.connect(gain2).connect(ctx.destination);
        osc2.start(now + delay);
        osc2.stop(now + delay + 0.9);
      }

      // Finale sparkle
      const tid = setTimeout(() => {
        if (this._disposed || !this._audioCtx) return;
        const ctx2 = this._audioCtx;
        const t = ctx2.currentTime;
        const osc = ctx2.createOscillator();
        const gain = ctx2.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1174, t);
        osc.frequency.exponentialRampToValueAtTime(1568, t + 0.3);
        gain.gain.setValueAtTime(0.08, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);
        osc.connect(gain).connect(ctx2.destination);
        osc.start(t);
        osc.stop(t + 0.5);
      }, 800);
      this._pendingTimers.push(tid);
    } catch (e) {
      // Audio not available
    }
  }

  _spawnParticles() {
    const count = 40;
    if (!this._particleGeo) this._particleGeo = new THREE.SphereGeometry(0.04, 4, 3);
    const geo = this._particleGeo;

    for (let i = 0; i < count; i++) {
      const hue = (i / count + Math.random() * 0.1) % 1.0;
      const pColor = new THREE.Color().setHSL(hue, 1, 0.6);

      const mat = new THREE.MeshBasicMaterial({
        color: pColor,
        transparent: true,
        opacity: 1,
      });
      const p = new THREE.Mesh(geo, mat);
      p.position.set(0, 0, 0);
      this.group.add(p);

      // Random velocity direction
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI - Math.PI / 2;
      const speed = 2 + Math.random() * 3;

      this._particles.push({
        mesh: p,
        vx: Math.cos(theta) * Math.cos(phi) * speed,
        vy: Math.sin(phi) * speed + 1.5,
        vz: Math.sin(theta) * Math.cos(phi) * speed,
        life: 1.0,
        decay: 0.5 + Math.random() * 0.4,
      });
    }
  }

  _explodeLetters() {
    // Each letter gets a random outward velocity + spin
    for (let i = 0; i < this._letterMeshes.length; i++) {
      const mesh = this._letterMeshes[i];
      const angle = ((i / this._letterMeshes.length) - 0.5) * Math.PI * 1.2;

      mesh.userData._explode = {
        vx: Math.sin(angle) * (2 + Math.random()),
        vy: 1.5 + Math.random() * 1.5,
        vz: -(0.5 + Math.random()),
        spinX: (Math.random() - 0.5) * 8,
        spinY: (Math.random() - 0.5) * 8,
        phase: 0,            // 0=exploding, 1=returning
        timer: 0,
        explodeDuration: 0.8 + Math.random() * 0.3,
        returnDelay: 1.2 + i * 0.1,
        returnDuration: 0.8,
        startPos: mesh.position.clone(),
        startRot: mesh.rotation.clone(),
        origX: this._letterOffsets[i],
      };
    }
  }

  update(dt) {
    if (!this._ready) return;
    this._time += dt;

    // Idle float and glow
    const idleY = Math.sin(this._time * 1.2) * 0.15;
    const idleRot = Math.sin(this._time * 0.5) * 0.05;
    this.group.position.y = this.position.y + idleY;
    this.group.rotation.y = this.rotation + idleRot;

    // Pulse back light
    if (this._backLight) {
      this._backLight.intensity = 2 + Math.sin(this._time * 2) * 0.5;
    }

    // Rainbow color wave on idle
    if (!this._animating) {
      for (let i = 0; i < this._letterMeshes.length; i++) {
        const mesh = this._letterMeshes[i];
        const hue = ((this._time * 0.15) + (i * 0.12)) % 1.0;
        const idleColor = new THREE.Color().setHSL(hue, 0.6, 0.55);
        // Blend between base color and rainbow
        const blend = 0.3 + Math.sin(this._time * 0.8 + i) * 0.15;
        mesh.material.color.copy(this.color).lerp(idleColor, blend);
        mesh.material.emissive.copy(this.color).lerp(idleColor, blend);
        mesh.material.emissiveIntensity = 0.4 + Math.sin(this._time * 2 + i * 0.5) * 0.15;
      }
    }

    // Update particles
    this._updateParticles(dt);

    // Update exploding letters
    if (this._animating) {
      this._updateExplosion(dt);
    }
  }

  _updateParticles(dt) {
    for (let i = this._particles.length - 1; i >= 0; i--) {
      const p = this._particles[i];
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy -= 3 * dt; // gravity
      p.life -= p.decay * dt;
      p.mesh.material.opacity = Math.max(0, p.life);
      p.mesh.scale.setScalar(Math.max(0.01, p.life));

      if (p.life <= 0) {
        this.group.remove(p.mesh);
        p.mesh.material.dispose();
        this._particles.splice(i, 1);
      }
    }
  }

  _updateExplosion(dt) {
    let allDone = true;

    for (let i = 0; i < this._letterMeshes.length; i++) {
      const mesh = this._letterMeshes[i];
      const e = mesh.userData._explode;
      if (!e) continue;

      e.timer += dt;

      if (e.phase === 0) {
        // Exploding outward
        const t = Math.min(e.timer / e.explodeDuration, 1);
        const ease = 1 - Math.pow(1 - t, 3); // ease out cubic

        mesh.position.x = e.startPos.x + e.vx * ease;
        mesh.position.y = e.startPos.y + e.vy * ease - 2 * ease * ease; // arc
        mesh.position.z = e.startPos.z + e.vz * ease;

        mesh.rotation.x = e.startRot.x + e.spinX * ease;
        mesh.rotation.y = e.startRot.y + e.spinY * ease;

        // Rainbow color wave during explosion
        const hue = (this._time * 0.5 + i * 0.15) % 1.0;
        const rainbowColor = new THREE.Color().setHSL(hue, 1, 0.6);
        mesh.material.color.copy(rainbowColor);
        mesh.material.emissive.copy(rainbowColor);
        mesh.material.emissiveIntensity = 0.8 + Math.sin(this._time * 6) * 0.3;

        if (e.timer >= e.returnDelay) {
          e.phase = 1;
          e.timer = 0;
          e.returnStart = mesh.position.clone();
          e.returnRotStart = mesh.rotation.clone();
        }
        allDone = false;
      } else if (e.phase === 1) {
        // Returning
        const t = Math.min(e.timer / e.returnDuration, 1);
        const ease = t * t * (3 - 2 * t); // smooth step

        mesh.position.x = THREE.MathUtils.lerp(e.returnStart.x, e.origX, ease);
        mesh.position.y = THREE.MathUtils.lerp(e.returnStart.y, 0, ease);
        mesh.position.z = THREE.MathUtils.lerp(e.returnStart.z, 0, ease);

        mesh.rotation.x = THREE.MathUtils.lerp(e.returnRotStart.x, 0, ease);
        mesh.rotation.y = THREE.MathUtils.lerp(e.returnRotStart.y, 0, ease);

        // Fade back to base color
        const hue = (this._time * 0.5 + i * 0.15) % 1.0;
        const rainbowColor = new THREE.Color().setHSL(hue, 1, 0.6);
        mesh.material.color.copy(rainbowColor).lerp(this.color, ease);
        mesh.material.emissive.copy(rainbowColor).lerp(this.color, ease);
        mesh.material.emissiveIntensity = 0.8 - ease * 0.4;

        if (t >= 1) {
          e.phase = 2; // done
          mesh.position.set(e.origX, 0, 0);
          mesh.rotation.set(0, 0, 0);
          mesh.material.color.copy(this.color);
          mesh.material.emissive.copy(this.color);
          mesh.material.emissiveIntensity = 0.4;
        } else {
          allDone = false;
        }
      }
    }

    if (allDone) {
      // Clean up explosion data
      for (const mesh of this._letterMeshes) {
        delete mesh.userData._explode;
      }
      this._animating = false;
    }
  }

  dispose() {
    this._disposed = true;

    // Clear pending timers
    for (const t of this._pendingTimers) clearTimeout(t);
    this._pendingTimers.length = 0;

    // Unregister interactables
    for (const inter of this._interactables) {
      this.interactionSystem.unregister(inter);
    }
    this._interactables.length = 0;

    // Remove particles
    for (const p of this._particles) {
      this.group.remove(p.mesh);
      p.mesh.material.dispose();
    }
    this._particles.length = 0;
    if (this._particleGeo) { this._particleGeo.dispose(); this._particleGeo = null; }

    // Remove letter meshes
    for (const mesh of this._letterMeshes) {
      mesh.geometry.dispose();
      mesh.material.dispose();
    }
    this._letterMeshes.length = 0;

    // Remove group from scene
    this.scene.remove(this.group);

    // Dispose remaining children (lights etc.)
    this.group.traverse((child) => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });

    this._audioCtx = null;
  }
}
