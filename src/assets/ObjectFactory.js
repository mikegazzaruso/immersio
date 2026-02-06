import * as THREE from 'three';

const lambertCache = new Map();
const standardCache = new Map();

function getLambert(color) {
  const hex = typeof color === 'number' ? color : new THREE.Color(color).getHex();
  if (!lambertCache.has(hex)) {
    lambertCache.set(hex, new THREE.MeshLambertMaterial({ color: hex }));
  }
  return lambertCache.get(hex);
}

function getStandard(color, opts = {}) {
  const key = `${color}-${opts.emissive || 0}-${opts.opacity || 1}-${opts.metalness || 0}-${opts.emissiveIntensity || 1}-${opts.roughness || 0.3}`;
  if (!standardCache.has(key)) {
    standardCache.set(key, new THREE.MeshStandardMaterial({
      color,
      emissive: opts.emissive || 0x000000,
      emissiveIntensity: opts.emissiveIntensity || 1,
      metalness: opts.metalness || 0.2,
      roughness: opts.roughness || 0.3,
      transparent: opts.opacity !== undefined && opts.opacity < 1,
      opacity: opts.opacity || 1,
    }));
  }
  return standardCache.get(key);
}

export const ObjectFactory = {
  box(w, h, d, color, position) {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, getLambert(color));
    if (position) mesh.position.copy(position);
    return mesh;
  },

  cylinder(rTop, rBot, h, segs, color, position) {
    const geo = new THREE.CylinderGeometry(rTop, rBot, h, segs);
    const mesh = new THREE.Mesh(geo, getLambert(color));
    if (position) mesh.position.copy(position);
    return mesh;
  },

  cone(r, h, segs, color, position) {
    const geo = new THREE.ConeGeometry(r, h, segs);
    const mesh = new THREE.Mesh(geo, getLambert(color));
    if (position) mesh.position.copy(position);
    return mesh;
  },

  sphere(r, wSegs, hSegs, color, position) {
    const geo = new THREE.SphereGeometry(r, wSegs, hSegs);
    const mesh = new THREE.Mesh(geo, getLambert(color));
    if (position) mesh.position.copy(position);
    return mesh;
  },

  crystal(r, h, color, position) {
    const geo = new THREE.OctahedronGeometry(r, 0);
    geo.scale(1, h / (r * 2), 1);
    const mat = getStandard(color, {
      emissive: color,
      emissiveIntensity: 0.5,
      metalness: 0.3,
      roughness: 0.2,
    });
    const mesh = new THREE.Mesh(geo, mat.clone());
    if (position) mesh.position.copy(position);
    return mesh;
  },

  pillar(r, h, color, position) {
    const group = new THREE.Group();
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r * 1.1, h, 6),
      getLambert(color)
    );
    shaft.position.y = h / 2;
    group.add(shaft);
    const cap = new THREE.Mesh(
      new THREE.BoxGeometry(r * 2.5, h * 0.08, r * 2.5),
      getLambert(color)
    );
    cap.position.y = h;
    group.add(cap);
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(r * 2.5, h * 0.06, r * 2.5),
      getLambert(color)
    );
    base.position.y = h * 0.03;
    group.add(base);

    if (position) group.position.copy(position);
    return group;
  },

  pedestal(w, h, color, position) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(w * 1.3, h * 0.3, w * 1.3),
      getLambert(color)
    );
    base.position.y = h * 0.15;
    group.add(base);
    const top = new THREE.Mesh(
      new THREE.BoxGeometry(w, h * 0.7, w),
      getLambert(color)
    );
    top.position.y = h * 0.3 + h * 0.35;
    group.add(top);
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(w * 1.1, h * 0.05, w * 1.1),
      getLambert(0x555555)
    );
    plate.position.y = h;
    group.add(plate);

    if (position) group.position.copy(position);
    return group;
  },

  fakeShadow(radius, position) {
    const geo = new THREE.CircleGeometry(radius, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.01;
    if (position) {
      mesh.position.x = position.x;
      mesh.position.z = position.z;
    }
    return mesh;
  },

  runeStone(w, h, d, color, symbol, position) {
    const group = new THREE.Group();
    const stone = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      getLambert(color)
    );
    group.add(stone);
    const indicator = new THREE.Mesh(
      new THREE.PlaneGeometry(w * 0.6, h * 0.6),
      new THREE.MeshStandardMaterial({
        color: 0x222244,
        emissive: 0x222244,
        emissiveIntensity: 0.3,
      })
    );
    indicator.position.z = d / 2 + 0.01;
    indicator.userData.runeIndicator = true;
    group.add(indicator);
    group.userData.symbol = symbol;
    if (position) group.position.copy(position);
    return group;
  },

  lever(position) {
    const group = new THREE.Group();
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(0.4, 0.3, 0.4),
      getLambert(0x444444)
    );
    base.position.y = 0.15;
    group.add(base);
    const pivot = new THREE.Group();
    pivot.position.y = 0.3;
    group.add(pivot);
    const arm = new THREE.Mesh(
      new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6),
      getLambert(0x888888)
    );
    arm.position.y = 0.4;
    pivot.add(arm);
    const handle = new THREE.Mesh(
      new THREE.SphereGeometry(0.15, 8, 6),
      new THREE.MeshStandardMaterial({
        color: 0xff3333,
        emissive: 0xff3333,
        emissiveIntensity: 0.4,
        roughness: 0.3,
      })
    );
    handle.position.y = 0.8;
    pivot.add(handle);

    pivot.rotation.x = -Math.PI / 6;
    group.userData.pivot = pivot;

    if (position) group.position.copy(position);
    return group;
  },
};
