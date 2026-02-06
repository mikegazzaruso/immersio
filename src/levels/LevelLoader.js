import * as THREE from 'three';

const _v = new THREE.Vector3();
const _box = new THREE.Box3();

export class LevelLoader {
  constructor(engine) {
    this._engine = engine;
    this._levelObjects = [];
    this._particles = [];
    this._particleGroup = null;
    this._particleTime = 0;
    this._birds = [];
    this._waterPlanes = [];
    this._lanterns = [];
    this._animTime = 0;
  }

  async load(levelConfig) {
    this._clearScene();
    this._buildEnvironment(levelConfig.environment);
    if (levelConfig.decorations) {
      this._buildDecorations(levelConfig.decorations, levelConfig.environment);
    }
    await this._loadProps(levelConfig);
    this._setPlayerSpawn(levelConfig.playerSpawn);
  }

  _clearScene() {
    const scene = this._engine.scene;
    scene.background = null;
    for (const obj of this._levelObjects) {
      scene.remove(obj);
      obj.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => {
              if (m.map) m.map.dispose();
              m.dispose();
            });
          } else {
            if (child.material.map) child.material.map.dispose();
            child.material.dispose();
          }
        }
      });
    }
    this._levelObjects.length = 0;
    this._particles.length = 0;
    this._birds.length = 0;
    this._waterPlanes.length = 0;
    this._lanterns.length = 0;
    if (this._particleGroup) {
      scene.remove(this._particleGroup);
      this._particleGroup = null;
    }
    this._particleTime = 0;
    this._animTime = 0;
    // Clear fog and collision system
    this._engine.scene.fog = null;
    this._engine.collisionSystem.clear();
  }

  _buildEnvironment(env) {
    const scene = this._engine.scene;

    // Background color
    scene.background = env.background ? new THREE.Color(env.background) : null;

    // Sky (outdoor — skip if enclosure is set)
    if (env.sky && !env.enclosure) {
      const useAdvanced = env.sky.offset != null || env.sky.exponent != null;
      const skyGeo = new THREE.SphereGeometry(200, 32, 16);
      const uniforms = {
        topColor: { value: new THREE.Color(env.sky.topColor) },
        bottomColor: { value: new THREE.Color(env.sky.bottomColor) },
      };
      if (useAdvanced) {
        uniforms.offset = { value: env.sky.offset ?? 0 };
        uniforms.exponent = { value: env.sky.exponent ?? 1 };
      }
      const vertexShader = `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `;
      const fragmentShader = useAdvanced
        ? `
          uniform vec3 topColor;
          uniform vec3 bottomColor;
          uniform float offset;
          uniform float exponent;
          varying vec3 vWorldPosition;
          void main() {
            float h = normalize(vWorldPosition).y + offset;
            gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
          }
        `
        : `
          uniform vec3 topColor;
          uniform vec3 bottomColor;
          varying vec3 vWorldPosition;
          void main() {
            float h = normalize(vWorldPosition).y;
            float t = clamp(h * 0.5 + 0.5, 0.0, 1.0);
            gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
          }
        `;
      const skyMat = new THREE.ShaderMaterial({
        uniforms,
        vertexShader,
        fragmentShader,
        side: THREE.BackSide,
        depthWrite: false,
      });
      const sky = new THREE.Mesh(skyGeo, skyMat);
      sky.renderOrder = -1;
      scene.add(sky);
      this._levelObjects.push(sky);
    }

    // Enclosure (indoor rooms: walls + ceiling + floor)
    if (env.enclosure) {
      this._buildEnclosure(env.enclosure);
    }

    // Fog
    if (env.fog) {
      scene.fog = new THREE.FogExp2(env.fog.color, env.fog.density);
    }

    // Ambient light
    if (env.ambient) {
      const ambient = new THREE.AmbientLight(env.ambient.color, env.ambient.intensity);
      scene.add(ambient);
      this._levelObjects.push(ambient);
    }

    // Directional light (sun/moon)
    if (env.directional) {
      const dir = new THREE.DirectionalLight(env.directional.color, env.directional.intensity);
      dir.position.set(...env.directional.position);
      scene.add(dir);
      this._levelObjects.push(dir);
    }

    // Hemisphere light
    if (env.hemisphere) {
      const hemi = new THREE.HemisphereLight(
        env.hemisphere.skyColor, env.hemisphere.groundColor, env.hemisphere.intensity
      );
      scene.add(hemi);
      this._levelObjects.push(hemi);
    }

    // Point lights (indoor lamps, torches)
    if (env.pointLights) {
      for (const pl of env.pointLights) {
        const light = new THREE.PointLight(pl.color, pl.intensity, pl.distance || 20);
        light.position.set(...pl.position);
        scene.add(light);
        this._levelObjects.push(light);

        if (pl.visible !== false) {
          const bulb = new THREE.Mesh(
            new THREE.SphereGeometry(0.05, 8, 8),
            new THREE.MeshBasicMaterial({
              color: pl.color,
              transparent: true,
              opacity: 0.8,
              blending: THREE.AdditiveBlending,
            })
          );
          bulb.position.copy(light.position);
          scene.add(bulb);
          this._levelObjects.push(bulb);
        }
      }
    }

    // Spot lights
    if (env.spotLights) {
      for (const sl of env.spotLights) {
        const light = new THREE.SpotLight(
          sl.color, sl.intensity, sl.distance || 30,
          sl.angle || Math.PI / 6, sl.penumbra || 0.5
        );
        light.position.set(...sl.position);
        if (sl.target) {
          light.target.position.set(...sl.target);
          scene.add(light.target);
          this._levelObjects.push(light.target);
        }
        scene.add(light);
        this._levelObjects.push(light);
      }
    }

    // Ground (outdoor circle)
    if (env.ground && !env.enclosure) {
      const groundGeo = new THREE.CircleGeometry(env.ground.radius, 64);
      const groundMat = new THREE.MeshLambertMaterial({ color: env.ground.color });
      const ground = new THREE.Mesh(groundGeo, groundMat);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = 0;
      scene.add(ground);
      this._levelObjects.push(ground);
      // Invisible boundary walls at edge of ground
      const r = env.ground.radius;
      const cs = this._engine.collisionSystem;
      cs.addBoxCollider(0, 0, -r, r * 2, 10, 1);
      cs.addBoxCollider(0, 0, r, r * 2, 10, 1);
      cs.addBoxCollider(-r, 0, 0, 1, 10, r * 2);
      cs.addBoxCollider(r, 0, 0, 1, 10, r * 2);
    }

    // Ambient particles
    if (env.particles) {
      this._spawnParticles(env.particles, env.enclosure);
    }
  }

  _buildEnclosure(enc) {
    const scene = this._engine.scene;
    const w = enc.width || 20;
    const d = enc.depth || 20;
    const h = enc.height || 4;

    const wallColor = enc.wallColor || '#333333';
    const ceilingColor = enc.ceilingColor || '#222222';
    const floorColor = enc.floorColor || '#444444';
    const emissiveColor = enc.emissive || null;
    const emissiveIntensity = enc.emissiveIntensity || 0;

    const makeMat = (color, emissive) => {
      const mat = new THREE.MeshLambertMaterial({ color });
      if (emissive) {
        mat.emissive = new THREE.Color(emissive);
        mat.emissiveIntensity = emissiveIntensity;
      }
      return mat;
    };

    // Floor
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      makeMat(floorColor, null)
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    scene.add(floor);
    this._levelObjects.push(floor);

    // Ceiling
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      makeMat(ceilingColor, emissiveColor)
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = h;
    scene.add(ceiling);
    this._levelObjects.push(ceiling);

    // 4 walls
    const wallMat = makeMat(wallColor, emissiveColor);
    const walls = [
      { pos: [0, h / 2, -d / 2], rot: [0, 0, 0], size: [w, h] },
      { pos: [0, h / 2, d / 2], rot: [0, Math.PI, 0], size: [w, h] },
      { pos: [-w / 2, h / 2, 0], rot: [0, Math.PI / 2, 0], size: [d, h] },
      { pos: [w / 2, h / 2, 0], rot: [0, -Math.PI / 2, 0], size: [d, h] },
    ];
    for (const wc of walls) {
      const wall = new THREE.Mesh(
        new THREE.PlaneGeometry(wc.size[0], wc.size[1]),
        wallMat
      );
      wall.position.set(...wc.pos);
      wall.rotation.set(...wc.rot);
      scene.add(wall);
      this._levelObjects.push(wall);
    }

    // Emissive trim strips along ceiling edges
    if (enc.trimColor) {
      const trimMat = new THREE.MeshBasicMaterial({
        color: enc.trimColor,
        transparent: true,
        opacity: 0.9,
      });
      const trimH = 0.05;
      const trimD = 0.02;
      const strips = [
        { pos: [0, h - trimH / 2, -d / 2 + trimD / 2], size: [w, trimH] },
        { pos: [0, h - trimH / 2, d / 2 - trimD / 2], size: [w, trimH] },
        { pos: [-w / 2 + trimD / 2, h - trimH / 2, 0], size: [d, trimH], rotY: Math.PI / 2 },
        { pos: [w / 2 - trimD / 2, h - trimH / 2, 0], size: [d, trimH], rotY: Math.PI / 2 },
      ];
      for (const s of strips) {
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(s.size[0], s.size[1]), trimMat);
        strip.position.set(...s.pos);
        if (s.rotY) strip.rotation.y = s.rotY;
        scene.add(strip);
        this._levelObjects.push(strip);
      }
    }

    // Dark surround sphere outside the room
    const surround = new THREE.Mesh(
      new THREE.SphereGeometry(200, 16, 8),
      new THREE.MeshBasicMaterial({ color: '#000000', side: THREE.BackSide, depthWrite: false })
    );
    surround.renderOrder = -1;
    scene.add(surround);
    this._levelObjects.push(surround);

    // Add wall colliders (thick invisible walls)
    const cs = this._engine.collisionSystem;
    const wallThick = 0.5;
    // North wall
    cs.addBoxCollider(0, 0, -d / 2, w, h, wallThick);
    // South wall
    cs.addBoxCollider(0, 0, d / 2, w, h, wallThick);
    // West wall
    cs.addBoxCollider(-w / 2, 0, 0, wallThick, h, d);
    // East wall
    cs.addBoxCollider(w / 2, 0, 0, wallThick, h, d);
  }

  _spawnParticles(config, enclosure) {
    const scene = this._engine.scene;
    const group = new THREE.Group();
    const count = config.count || 60;

    const maxR = enclosure ? Math.min(enclosure.width, enclosure.depth) / 2 * 0.8 : 20;
    const maxH = enclosure ? enclosure.height * 0.9 : 8;

    for (let i = 0; i < count; i++) {
      const size = 0.02 + Math.random() * 0.04;
      const geo = new THREE.SphereGeometry(size, 4, 4);
      const mat = new THREE.MeshBasicMaterial({
        color: config.color || '#ffffff',
        transparent: true,
        opacity: 0.3 + Math.random() * 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      const radius = 1 + Math.random() * maxR;
      const angle = Math.random() * Math.PI * 2;
      mesh.position.set(
        Math.cos(angle) * radius,
        0.3 + Math.random() * maxH,
        Math.sin(angle) * radius
      );
      group.add(mesh);
      this._particles.push({
        mesh,
        baseX: mesh.position.x,
        baseY: mesh.position.y,
        speed: 0.2 + Math.random() * 0.5,
        drift: 0.1 + Math.random() * 0.3,
        phase: Math.random() * Math.PI * 2,
      });
    }

    scene.add(group);
    this._particleGroup = group;
    this._levelObjects.push(group);
  }

  _buildDecorations(decorations, env) {
    const scene = this._engine.scene;
    for (const dec of decorations) {
      switch (dec.type) {
        case 'palmTree': this._spawnPalmTrees(scene, dec); break;
        case 'tree': this._spawnTrees(scene, dec); break;
        case 'pineTree': this._spawnPineTrees(scene, dec); break;
        case 'rock': this._spawnRocks(scene, dec); break;
        case 'water': this._spawnWater(scene, dec); break;
        case 'bird': this._spawnBirds(scene, dec); break;
        case 'stalactite': this._spawnStalactites(scene, dec, env); break;
        case 'mushroom': this._spawnMushrooms(scene, dec); break;
        case 'crystal': this._spawnCrystals(scene, dec); break;
        case 'coral': this._spawnCorals(scene, dec); break;
        case 'vine': this._spawnVines(scene, dec, env); break;
        case 'lantern': this._spawnLanterns(scene, dec); break;
        case 'column': this._spawnColumns(scene, dec, env); break;
        default: console.warn(`Unknown decoration type: ${dec.type}`);
      }
    }
  }

  _randomInRange(arr) {
    return arr[0] + Math.random() * (arr[1] - arr[0]);
  }

  _scatterPosition(radius) {
    const r = radius[0] + Math.random() * (radius[1] - radius[0]);
    const a = Math.random() * Math.PI * 2;
    return [Math.cos(a) * r, 0, Math.sin(a) * r];
  }

  _spawnPalmTrees(scene, dec) {
    const count = dec.count || 8;
    const radius = dec.radius || [10, 35];
    const height = dec.height || [4, 7];
    for (let i = 0; i < count; i++) {
      const group = new THREE.Group();
      const h = this._randomInRange(height);
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
        leaf.position.set(
          Math.cos(angle) * 0.6,
          trunkH - 0.2,
          Math.sin(angle) * 0.6
        );
        leaf.rotation.x = Math.cos(angle) * 0.8;
        leaf.rotation.z = Math.sin(angle) * 0.8;
        group.add(leaf);
      }
      const [x, , z] = this._scatterPosition(radius);
      group.position.set(x, 0, z);
      group.rotation.y = Math.random() * Math.PI * 2;
      scene.add(group);
      this._levelObjects.push(group);
      // Add collision for trunk
      this._engine.collisionSystem.addBoxCollider(x, 0, z, 0.4, trunkH, 0.4);
    }
  }

  _spawnTrees(scene, dec) {
    const count = dec.count || 10;
    const radius = dec.radius || [8, 30];
    const height = dec.height || [3, 6];
    const canopyColor = dec.canopyColor || '#2d6b1e';
    for (let i = 0; i < count; i++) {
      const group = new THREE.Group();
      const h = this._randomInRange(height);
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
      const [x, , z] = this._scatterPosition(radius);
      group.position.set(x, 0, z);
      scene.add(group);
      this._levelObjects.push(group);
    }
  }

  _spawnPineTrees(scene, dec) {
    const count = dec.count || 8;
    const radius = dec.radius || [8, 30];
    const height = dec.height || [4, 8];
    for (let i = 0; i < count; i++) {
      const group = new THREE.Group();
      const h = this._randomInRange(height);
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
      const [x, , z] = this._scatterPosition(radius);
      group.position.set(x, 0, z);
      scene.add(group);
      this._levelObjects.push(group);
    }
  }

  _spawnRocks(scene, dec) {
    const count = dec.count || 12;
    const radius = dec.radius || [5, 35];
    const scale = dec.scale || [0.3, 1.2];
    const color = dec.color || '#808080';
    for (let i = 0; i < count; i++) {
      const s = this._randomInRange(scale);
      const geo = new THREE.IcosahedronGeometry(s, 0);
      const pos = geo.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        pos.setX(v, pos.getX(v) * (0.7 + Math.random() * 0.6));
        pos.setY(v, pos.getY(v) * (0.5 + Math.random() * 0.6));
        pos.setZ(v, pos.getZ(v) * (0.7 + Math.random() * 0.6));
      }
      geo.computeVertexNormals();
      const rock = new THREE.Mesh(
        geo,
        new THREE.MeshLambertMaterial({ color })
      );
      const [x, , z] = this._scatterPosition(radius);
      rock.position.set(x, s * 0.3, z);
      rock.rotation.set(Math.random() * 0.5, Math.random() * Math.PI, Math.random() * 0.5);
      scene.add(rock);
      this._levelObjects.push(rock);
      // Add collision
      if (s > 0.4) {
        this._engine.collisionSystem.addBoxCollider(x, 0, z, s * 1.2, s * 1.0, s * 1.2);
      }
    }
  }

  _spawnWater(scene, dec) {
    const waterY = dec.y != null ? dec.y : -0.05;
    const color = dec.color || '#1a8fbf';
    const opacity = dec.opacity || 0.6;
    const size = dec.size || 400;
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshLambertMaterial({
        color,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
      })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = waterY;
    scene.add(water);
    this._levelObjects.push(water);
    this._waterPlanes.push({ mesh: water, baseY: waterY });
  }

  _spawnBirds(scene, dec) {
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
      const body = new THREE.Mesh(
        new THREE.SphereGeometry(0.08, 4, 4),
        wingMat
      );
      group.add(body);

      const orbitR = 8 + Math.random() * 20;
      const h = this._randomInRange(height);
      const phase = (i / count) * Math.PI * 2;
      group.position.set(
        Math.cos(phase) * orbitR,
        h,
        Math.sin(phase) * orbitR
      );
      scene.add(group);
      this._levelObjects.push(group);
      this._birds.push({
        mesh: group,
        leftWing: lw,
        rightWing: rw,
        orbitR,
        height: h,
        speed: speed * (0.7 + Math.random() * 0.6),
        phase,
      });
    }
  }

  _spawnStalactites(scene, dec, env) {
    const count = dec.count || 15;
    const length = dec.length || [0.5, 2.0];
    const color = dec.color || '#666655';
    const ceilingH = env.enclosure ? (env.enclosure.height || 4) : 8;
    const spread = env.enclosure ? Math.min(env.enclosure.width, env.enclosure.depth) / 2 * 0.8 : 15;
    for (let i = 0; i < count; i++) {
      const len = this._randomInRange(length);
      const r = 0.05 + Math.random() * 0.12;
      const stalactite = new THREE.Mesh(
        new THREE.ConeGeometry(r, len, 5),
        new THREE.MeshLambertMaterial({ color })
      );
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * spread;
      stalactite.position.set(
        Math.cos(angle) * dist,
        ceilingH - len / 2,
        Math.sin(angle) * dist
      );
      stalactite.rotation.x = Math.PI;
      scene.add(stalactite);
      this._levelObjects.push(stalactite);
    }
  }

  _spawnMushrooms(scene, dec) {
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
        new THREE.MeshLambertMaterial({
          color,
          emissive: glowColor,
          emissiveIntensity: 0.4,
        })
      );
      cap.position.y = stemH;
      group.add(cap);
      const [x, , z] = this._scatterPosition(radius);
      group.position.set(x, 0, z);
      scene.add(group);
      this._levelObjects.push(group);
    }
  }

  _spawnCrystals(scene, dec) {
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
            color,
            emissive: color,
            emissiveIntensity: glow,
            roughness: 0.2,
            metalness: 0.3,
          })
        );
        shard.scale.y = h / r;
        shard.position.set(
          (Math.random() - 0.5) * 0.3,
          h * 0.4,
          (Math.random() - 0.5) * 0.3
        );
        shard.rotation.z = (Math.random() - 0.5) * 0.4;
        group.add(shard);
      }
      const [x, , z] = this._scatterPosition(radius);
      group.position.set(x, 0, z);
      scene.add(group);
      this._levelObjects.push(group);
    }
  }

  _spawnCorals(scene, dec) {
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
        branch.position.set(
          (Math.random() - 0.5) * 0.2,
          h / 2,
          (Math.random() - 0.5) * 0.2
        );
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
      const [x, , z] = this._scatterPosition(radius);
      group.position.set(x, 0, z);
      scene.add(group);
      this._levelObjects.push(group);
    }
  }

  _spawnVines(scene, dec, env) {
    const count = dec.count || 10;
    const length = dec.length || [1.0, 3.0];
    const color = dec.color || '#2d5a1e';
    const ceilingH = env.enclosure ? (env.enclosure.height || 4) : 6;
    const spread = env.enclosure ? Math.min(env.enclosure.width, env.enclosure.depth) / 2 * 0.7 : 12;
    for (let i = 0; i < count; i++) {
      const group = new THREE.Group();
      const len = this._randomInRange(length);
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
      this._levelObjects.push(group);
    }
  }

  _spawnLanterns(scene, dec) {
    const count = dec.count || 6;
    const height = dec.height || [2, 5];
    const color = dec.color || '#ffaa44';
    const radius = dec.radius || [3, 15];
    for (let i = 0; i < count; i++) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.2, 0.15),
        new THREE.MeshLambertMaterial({
          color,
          emissive: color,
          emissiveIntensity: 0.5,
        })
      );
      group.add(body);
      const light = new THREE.PointLight(color, 0.8, 8);
      light.position.y = 0.1;
      group.add(light);

      const h = this._randomInRange(height);
      const [x, , z] = this._scatterPosition(radius);
      group.position.set(x, h, z);
      scene.add(group);
      this._levelObjects.push(group);
      this._lanterns.push({ mesh: group, baseY: h, phase: Math.random() * Math.PI * 2 });
    }
  }

  _spawnColumns(scene, dec, env) {
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
      const [x, , z] = this._scatterPosition(radius);
      column.position.set(x, h / 2, z);
      scene.add(column);
      this._levelObjects.push(column);
      // Add collision
      this._engine.collisionSystem.addBoxCollider(x, 0, z, colR * 2.5, h, colR * 2.5);
    }
  }

  async _loadProps(levelConfig) {
    const scene = this._engine.scene;
    const loader = this._engine.assetLoader;
    const levelId = levelConfig.id;

    const promises = levelConfig.props.map(async (prop) => {
      try {
        const path = `/models/${levelId}/${prop.model}`;
        const model = await loader.load(path, {
          scale: prop.scale,
          rotationY: prop.rotationY,
        });

        // Auto-ground: compute bounding box and offset Y so bottom sits on floor
        _box.setFromObject(model);
        const groundY = prop.position[1] || 0;
        model.position.set(
          prop.position[0],
          groundY - _box.min.y,
          prop.position[2]
        );

        scene.add(model);
        this._levelObjects.push(model);

        // Add collision box for each prop
        _box.setFromObject(model);
        _v.set(0, 0, 0);
        _box.getSize(_v);
        if (_v.x > 0.2 && _v.z > 0.2) {
          this._engine.collisionSystem.addCollider(_box.clone());
        }
      } catch (e) {
        console.warn(`Failed to load prop ${prop.model} for level ${levelId}:`, e);
      }
    });

    await Promise.all(promises);
  }

  _setPlayerSpawn(spawn) {
    if (!spawn) return;
    const rig = this._engine.cameraRig;
    rig.position.set(...spawn.position);
    if (spawn.rotationY != null) {
      rig.rotation.set(0, spawn.rotationY, 0);
    }
  }

  update(dt) {
    this._particleTime += dt;
    this._animTime += dt;

    // Particles
    for (const p of this._particles) {
      p.mesh.position.y = p.baseY + Math.sin(this._particleTime * p.speed + p.phase) * 0.5;
      p.mesh.position.x = p.baseX + Math.sin(this._particleTime * p.drift + p.phase) * 0.3;
    }

    // Birds
    for (const b of this._birds) {
      const t = this._animTime * b.speed + b.phase;
      b.mesh.position.x = Math.cos(t) * b.orbitR;
      b.mesh.position.z = Math.sin(t) * b.orbitR;
      b.mesh.position.y = b.height + Math.sin(t * 2) * 0.5;
      b.mesh.rotation.y = -t + Math.PI / 2;
      const flap = Math.sin(this._animTime * 6 + b.phase) * 0.4;
      b.leftWing.rotation.z = 0.3 + flap;
      b.rightWing.rotation.z = -0.3 - flap;
    }

    // Water
    for (const w of this._waterPlanes) {
      w.mesh.position.y = w.baseY + Math.sin(this._animTime * 0.5) * 0.03;
    }

    // Lanterns
    for (const l of this._lanterns) {
      l.mesh.position.y = l.baseY + Math.sin(this._animTime * 0.8 + l.phase) * 0.15;
    }
  }

  unload() {
    this._clearScene();
    this._engine.scene.fog = null;
  }
}
