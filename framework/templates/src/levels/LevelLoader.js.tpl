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
            float h = normalize(vWorldPosition + offset).y;
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
    const registry = this._engine.decorationRegistry;

    // Context object passed to spawners — collects objects and animated refs
    const ctx = {
      objects: this._levelObjects,
      birds: this._birds,
      waterPlanes: this._waterPlanes,
      lanterns: this._lanterns,
    };

    for (const dec of decorations) {
      if (registry && registry.has(dec.type)) {
        const spawner = registry.get(dec.type);
        spawner(scene, dec, env, ctx);
      } else {
        console.warn(`Unknown decoration type: ${dec.type}`);
      }
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
      p.mesh.position.x += Math.sin(this._particleTime * p.drift + p.phase) * 0.002;
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
