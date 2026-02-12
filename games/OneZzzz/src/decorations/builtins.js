import * as THREE from 'three';

/**
 * Registers all 13 built-in decoration types with the DecorationRegistry.
 * Each spawner receives (scene, config, env, helpers) and returns
 * { objects, birds, waterPlanes, lanterns } for animated types.
 */
export function registerBuiltins(registry) {
  registry.register('palmTree', spawnPalmTrees);
  registry.register('tree', spawnTrees);
  registry.register('pineTree', spawnPineTrees);
  registry.register('rock', spawnRocks);
  registry.register('water', spawnWater);
  registry.register('bird', spawnBirds);
  registry.register('stalactite', spawnStalactites);
  registry.register('mushroom', spawnMushrooms);
  registry.register('crystal', spawnCrystals);
  registry.register('coral', spawnCorals);
  registry.register('vine', spawnVines);
  registry.register('lantern', spawnLanterns);
  registry.register('column', spawnColumns);
}

// --- Helpers ---

function randomInRange(arr) {
  return arr[0] + Math.random() * (arr[1] - arr[0]);
}

function scatterPosition(radius) {
  const r = radius[0] + Math.random() * (radius[1] - radius[0]);
  const a = Math.random() * Math.PI * 2;
  return [Math.cos(a) * r, 0, Math.sin(a) * r];
}

// --- Spawners ---

function spawnPalmTrees(scene, dec, env, ctx) {
  const count = dec.count || 8;
  const radius = dec.radius || [10, 35];
  const height = dec.height || [4, 7];
  for (let i = 0; i < count; i++) {
    const group = new THREE.Group();
    const h = randomInRange(height);
    const trunkH = h * 0.75;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.15, trunkH, 6),
      new THREE.MeshLambertMaterial({ color: '#8B6914' })
    );
    trunk.position.y = trunkH / 2;
    trunk.rotation.x = (Math.random() - 0.5) * 0.15;
    trunk.rotation.z = (Math.random() - 0.5) * 0.15;
    group.add(trunk);
    for (let j = 0; j < 5; j++) {
      const leafLen = 1.5 + Math.random() * 1.0;
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(0.4, leafLen, 4),
        new THREE.MeshLambertMaterial({ color: dec.leafColor || '#2d8a3e' })
      );
      const angle = (j / 5) * Math.PI * 2 + Math.random() * 0.3;
      leaf.position.set(Math.cos(angle) * 0.6, trunkH - 0.2, Math.sin(angle) * 0.6);
      leaf.rotation.x = Math.cos(angle) * 0.8;
      leaf.rotation.z = Math.sin(angle) * 0.8;
      group.add(leaf);
    }
    const [x, , z] = scatterPosition(radius);
    group.position.set(x, 0, z);
    group.rotation.y = Math.random() * Math.PI * 2;
    scene.add(group);
    ctx.objects.push(group);
  }
}

function spawnTrees(scene, dec, env, ctx) {
  const count = dec.count || 10;
  const radius = dec.radius || [8, 30];
  const height = dec.height || [3, 6];
  const canopyColor = dec.canopyColor || '#2d6b1e';
  for (let i = 0; i < count; i++) {
    const group = new THREE.Group();
    const h = randomInRange(height);
    const trunkH = h * 0.55;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, trunkH, 6),
      new THREE.MeshLambertMaterial({ color: '#5C4033' })
    );
    trunk.position.y = trunkH / 2;
    group.add(trunk);
    const canopyR = h * 0.35;
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(canopyR, 8, 6),
      new THREE.MeshLambertMaterial({ color: canopyColor })
    );
    canopy.position.y = trunkH + canopyR * 0.6;
    canopy.scale.y = 0.8 + Math.random() * 0.4;
    group.add(canopy);
    const [x, , z] = scatterPosition(radius);
    group.position.set(x, 0, z);
    scene.add(group);
    ctx.objects.push(group);
  }
}

function spawnPineTrees(scene, dec, env, ctx) {
  const count = dec.count || 8;
  const radius = dec.radius || [8, 30];
  const height = dec.height || [4, 8];
  for (let i = 0; i < count; i++) {
    const group = new THREE.Group();
    const h = randomInRange(height);
    const trunkH = h * 0.35;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.1, trunkH, 6),
      new THREE.MeshLambertMaterial({ color: '#5C4033' })
    );
    trunk.position.y = trunkH / 2;
    group.add(trunk);
    for (let j = 0; j < 3; j++) {
      const coneH = (h - trunkH) * 0.45;
      const coneR = (0.8 - j * 0.2) * h * 0.2;
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(coneR, coneH, 6),
        new THREE.MeshLambertMaterial({ color: dec.color || '#1a4d2e' })
      );
      cone.position.y = trunkH + j * coneH * 0.6 + coneH * 0.4;
      group.add(cone);
    }
    const [x, , z] = scatterPosition(radius);
    group.position.set(x, 0, z);
    scene.add(group);
    ctx.objects.push(group);
  }
}

function spawnRocks(scene, dec, env, ctx) {
  const count = dec.count || 12;
  const radius = dec.radius || [5, 35];
  const scale = dec.scale || [0.3, 1.2];
  const color = dec.color || '#808080';
  for (let i = 0; i < count; i++) {
    const s = randomInRange(scale);
    const geo = new THREE.IcosahedronGeometry(s, 0);
    const pos = geo.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      pos.setX(v, pos.getX(v) * (0.7 + Math.random() * 0.6));
      pos.setY(v, pos.getY(v) * (0.5 + Math.random() * 0.6));
      pos.setZ(v, pos.getZ(v) * (0.7 + Math.random() * 0.6));
    }
    geo.computeVertexNormals();
    const rock = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color }));
    const [x, , z] = scatterPosition(radius);
    rock.position.set(x, s * 0.3, z);
    rock.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.5);
    scene.add(rock);
    ctx.objects.push(rock);
  }
}

function spawnWater(scene, dec, env, ctx) {
  const waterY = dec.y != null ? dec.y : -0.05;
  const color = dec.color || '#1a8fbf';
  const opacity = dec.opacity || 0.6;
  const size = dec.size || 400;
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshLambertMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = waterY;
  scene.add(water);
  ctx.objects.push(water);
  ctx.waterPlanes.push({ mesh: water, baseY: waterY });
}

function spawnBirds(scene, dec, env, ctx) {
  const count = dec.count || 4;
  const height = dec.height || [10, 18];
  const speed = dec.speed || 0.4;
  for (let i = 0; i < count; i++) {
    const group = new THREE.Group();
    const wingMat = new THREE.MeshLambertMaterial({ color: dec.color || '#333333' });
    const lw = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.15), wingMat);
    lw.position.x = -0.2;
    lw.rotation.z = 0.3;
    group.add(lw);
    const rw = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.15), wingMat);
    rw.position.x = 0.2;
    rw.rotation.z = -0.3;
    group.add(rw);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.08, 4, 4), wingMat);
    group.add(body);
    const orbitR = 8 + Math.random() * 20;
    const h = randomInRange(height);
    const phase = (i / count) * Math.PI * 2;
    group.position.set(Math.cos(phase) * orbitR, h, Math.sin(phase) * orbitR);
    scene.add(group);
    ctx.objects.push(group);
    ctx.birds.push({
      mesh: group, leftWing: lw, rightWing: rw,
      orbitR, height: h,
      speed: speed * (0.7 + Math.random() * 0.6),
      phase,
    });
  }
}

function spawnStalactites(scene, dec, env, ctx) {
  const count = dec.count || 15;
  const length = dec.length || [0.5, 2.0];
  const color = dec.color || '#666655';
  const ceilingH = env.enclosure ? (env.enclosure.height || 4) : 8;
  const spread = env.enclosure ? Math.min(env.enclosure.width, env.enclosure.depth) / 2 * 0.8 : 15;
  for (let i = 0; i < count; i++) {
    const len = randomInRange(length);
    const r = 0.05 + Math.random() * 0.12;
    const stalactite = new THREE.Mesh(
      new THREE.ConeGeometry(r, len, 5),
      new THREE.MeshLambertMaterial({ color })
    );
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * spread;
    stalactite.position.set(Math.cos(angle) * dist, ceilingH - len / 2, Math.sin(angle) * dist);
    stalactite.rotation.x = Math.PI;
    scene.add(stalactite);
    ctx.objects.push(stalactite);
  }
}

function spawnMushrooms(scene, dec, env, ctx) {
  const count = dec.count || 8;
  const radius = dec.radius || [3, 20];
  const color = dec.color || '#c84b31';
  const glowColor = dec.glowColor || '#ff6644';
  for (let i = 0; i < count; i++) {
    const group = new THREE.Group();
    const stemH = 0.15 + Math.random() * 0.3;
    const capR = 0.1 + Math.random() * 0.2;
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.04, stemH, 5),
      new THREE.MeshLambertMaterial({ color: '#d4c5a0' })
    );
    stem.position.y = stemH / 2;
    group.add(stem);
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(capR, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color, emissive: glowColor, emissiveIntensity: 0.4 })
    );
    cap.position.y = stemH;
    group.add(cap);
    const [x, , z] = scatterPosition(radius);
    group.position.set(x, 0, z);
    scene.add(group);
    ctx.objects.push(group);
  }
}

function spawnCrystals(scene, dec, env, ctx) {
  const count = dec.count || 6;
  const radius = dec.radius || [4, 20];
  const color = dec.color || '#8844cc';
  const glow = dec.glowIntensity || 0.6;
  for (let i = 0; i < count; i++) {
    const group = new THREE.Group();
    const shardCount = 2 + Math.floor(Math.random() * 3);
    for (let j = 0; j < shardCount; j++) {
      const h = 0.4 + Math.random() * 0.8;
      const r = 0.06 + Math.random() * 0.1;
      const shard = new THREE.Mesh(
        new THREE.OctahedronGeometry(r, 0),
        new THREE.MeshStandardMaterial({
          color, emissive: color, emissiveIntensity: glow,
          roughness: 0.2, metalness: 0.3,
        })
      );
      shard.scale.y = h / r;
      shard.position.set((Math.random() - 0.5) * 0.3, h * 0.4, (Math.random() - 0.5) * 0.3);
      shard.rotation.z = (Math.random() - 0.5) * 0.4;
      group.add(shard);
    }
    const [x, , z] = scatterPosition(radius);
    group.position.set(x, 0, z);
    scene.add(group);
    ctx.objects.push(group);
  }
}

function spawnCorals(scene, dec, env, ctx) {
  const count = dec.count || 8;
  const radius = dec.radius || [4, 20];
  const color = dec.color || '#e85d75';
  for (let i = 0; i < count; i++) {
    const group = new THREE.Group();
    const branches = 3 + Math.floor(Math.random() * 3);
    for (let j = 0; j < branches; j++) {
      const h = 0.3 + Math.random() * 0.6;
      const branch = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.06, h, 5),
        new THREE.MeshLambertMaterial({ color })
      );
      branch.position.set((Math.random() - 0.5) * 0.2, h / 2, (Math.random() - 0.5) * 0.2);
      branch.rotation.x = (Math.random() - 0.5) * 0.5;
      branch.rotation.z = (Math.random() - 0.5) * 0.5;
      group.add(branch);
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.04 + Math.random() * 0.04, 5, 4),
        new THREE.MeshLambertMaterial({ color })
      );
      tip.position.set(branch.position.x, h, branch.position.z);
      group.add(tip);
    }
    const [x, , z] = scatterPosition(radius);
    group.position.set(x, 0, z);
    scene.add(group);
    ctx.objects.push(group);
  }
}

function spawnVines(scene, dec, env, ctx) {
  const count = dec.count || 10;
  const length = dec.length || [1.0, 3.0];
  const color = dec.color || '#2d5a1e';
  const ceilingH = env.enclosure ? (env.enclosure.height || 4) : 6;
  const spread = env.enclosure ? Math.min(env.enclosure.width, env.enclosure.depth) / 2 * 0.7 : 12;
  for (let i = 0; i < count; i++) {
    const group = new THREE.Group();
    const len = randomInRange(length);
    const segments = 4 + Math.floor(Math.random() * 4);
    const segLen = len / segments;
    let y = ceilingH;
    let xOff = 0;
    for (let s = 0; s < segments; s++) {
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.02, segLen, 4),
        new THREE.MeshLambertMaterial({ color })
      );
      xOff += (Math.random() - 0.5) * 0.1;
      seg.position.set(xOff, y - segLen / 2, 0);
      seg.rotation.z = (Math.random() - 0.5) * 0.2;
      group.add(seg);
      y -= segLen;
      if (Math.random() > 0.5) {
        const leaf = new THREE.Mesh(
          new THREE.PlaneGeometry(0.08, 0.12),
          new THREE.MeshLambertMaterial({ color: '#3a7a2a', side: THREE.DoubleSide })
        );
        leaf.position.set(xOff + 0.05, y + segLen * 0.3, 0);
        leaf.rotation.z = Math.random() * 0.5;
        group.add(leaf);
      }
    }
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.random() * spread;
    group.position.set(Math.cos(angle) * dist, 0, Math.sin(angle) * dist);
    group.rotation.y = Math.random() * Math.PI * 2;
    scene.add(group);
    ctx.objects.push(group);
  }
}

function spawnLanterns(scene, dec, env, ctx) {
  const count = dec.count || 6;
  const height = dec.height || [2, 5];
  const color = dec.color || '#ffaa44';
  const radius = dec.radius || [3, 15];
  for (let i = 0; i < count; i++) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.2, 0.15),
      new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.5 })
    );
    group.add(body);
    const light = new THREE.PointLight(color, 0.8, 8);
    light.position.y = 0.1;
    group.add(light);
    const h = randomInRange(height);
    const [x, , z] = scatterPosition(radius);
    group.position.set(x, h, z);
    scene.add(group);
    ctx.objects.push(group);
    ctx.lanterns.push({ mesh: group, baseY: h, phase: Math.random() * Math.PI * 2 });
  }
}

function spawnColumns(scene, dec, env, ctx) {
  const count = dec.count || 6;
  const radius = dec.radius || [4, 12];
  const color = dec.color || '#888888';
  const h = env.enclosure ? (env.enclosure.height || 4) : 4;
  for (let i = 0; i < count; i++) {
    const colR = 0.15 + Math.random() * 0.1;
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(colR, colR * 1.1, h, 8),
      new THREE.MeshLambertMaterial({ color })
    );
    const [x, , z] = scatterPosition(radius);
    column.position.set(x, h / 2, z);
    scene.add(column);
    ctx.objects.push(column);
  }
}
