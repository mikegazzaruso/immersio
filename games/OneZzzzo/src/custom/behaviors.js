import * as THREE from 'three';

let canePalla = null;
let baseY = 0;
let t0 = 0;

const _tmpPos = new THREE.Vector3();
const _dogPos = new THREE.Vector3();

export function init(engine) {
  canePalla = engine.scene.getObjectByName('un cane-palla');
  if (canePalla) {
    baseY = canePalla.position.y;
    t0 = performance.now() * 0.001;
  }
}

export function update(engine, dt) {
  if (!canePalla) return;

  const t = performance.now() * 0.001 - t0;

  // Player proximity
  const rig = engine.cameraRig;
  if (rig) rig.getWorldPosition(_tmpPos);
  canePalla.getWorldPosition(_dogPos);

  const dist = rig ? _tmpPos.distanceTo(_dogPos) : 999;
  const near = dist < 2.2;

  // Base gentle bob + playful roll
  const baseBob = Math.sin(t * 2.2) * 0.08;
  canePalla.position.y = baseY + baseBob;
  canePalla.rotation.z = t * 0.9;
  canePalla.rotation.x = Math.sin(t * 1.3) * 0.25;

  // Joy hopping when player is close
  if (near) {
    const k = THREE.MathUtils.clamp((2.2 - dist) / 2.2, 0, 1);
    const hop = Math.max(0, Math.sin(t * 9.0)) * (0.18 + 0.12 * k);
    canePalla.position.y = baseY + baseBob + hop;

    // Extra excited wiggle
    canePalla.rotation.y = Math.sin(t * 7.0) * (0.25 + 0.15 * k);
    canePalla.rotation.x += Math.sin(t * 12.0) * (0.08 + 0.06 * k);
  } else {
    canePalla.rotation.y = 0;
  }

  // Tail wag (faster when near)
  const tail = canePalla.getObjectByName('tail');
  if (tail) {
    const wagSpeed = near ? 16.0 : 10.0;
    const wagAmp = near ? 1.05 : 0.7;
    tail.rotation.y = Math.sin(t * wagSpeed) * wagAmp;
  }

  // Nose glow pulse (brighter when near)
  const nose = canePalla.getObjectByName('nose');
  if (nose && nose.material) {
    const pulse = 0.15 + (Math.sin(t * 4.0) * 0.5 + 0.5) * 0.55;
    nose.material.emissiveIntensity = near ? pulse * 1.35 : pulse;
  }
}
