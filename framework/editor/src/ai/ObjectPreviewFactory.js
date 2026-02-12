import * as THREE from 'three';

/**
 * ObjectPreviewFactory — creates 3D preview meshes for editor display.
 *
 * Supports two formats:
 *   - New: geometry class name + args + material object (direct Three.js)
 *   - Legacy: primitive shorthand + args array (color baked into args)
 *
 * All geometry is created dynamically from Three.js classes — no prebuilt assets.
 */

/** Map of geometry class names → Three.js constructors (case-insensitive lookup via _resolveGeometry) */
const GEOMETRY_MAP = {
  BoxGeometry: THREE.BoxGeometry,
  SphereGeometry: THREE.SphereGeometry,
  CylinderGeometry: THREE.CylinderGeometry,
  ConeGeometry: THREE.ConeGeometry,
  TorusGeometry: THREE.TorusGeometry,
  OctahedronGeometry: THREE.OctahedronGeometry,
  TetrahedronGeometry: THREE.TetrahedronGeometry,
  DodecahedronGeometry: THREE.DodecahedronGeometry,
  IcosahedronGeometry: THREE.IcosahedronGeometry,
  PlaneGeometry: THREE.PlaneGeometry,
  RingGeometry: THREE.RingGeometry,
  CapsuleGeometry: THREE.CapsuleGeometry,
  TorusKnotGeometry: THREE.TorusKnotGeometry,
};

/** Build a case-insensitive lookup: "sphere" → SphereGeometry, "Box" → BoxGeometry, etc. */
const GEOMETRY_LOOKUP = {};
for (const key of Object.keys(GEOMETRY_MAP)) {
  GEOMETRY_LOOKUP[key.toLowerCase()] = key;
  // Also without "geometry" suffix: "sphere" → "SphereGeometry"
  const short = key.replace(/Geometry$/i, '').toLowerCase();
  if (short) GEOMETRY_LOOKUP[short] = key;
}

/** Resolve a geometry name to its GEOMETRY_MAP key, case-insensitively */
function resolveGeometry(name) {
  if (!name || typeof name !== 'string') return null;
  // Exact match first
  if (GEOMETRY_MAP[name]) return name;
  // Case-insensitive lookup (with or without "Geometry" suffix)
  return GEOMETRY_LOOKUP[name.toLowerCase()] || null;
}

export class ObjectPreviewFactory {
  /**
   * Create a preview mesh from an AIPromptInterpreter result.
   */
  createFromResult(interpretResult) {
    if (!interpretResult) return null;
    const { configType } = interpretResult;

    switch (configType) {
      case 'decoration':
        return this.createDecorationPreview(interpretResult.config);
      case 'mesh':
        return this.createMeshPreview(interpretResult);
      case 'primitive':
        return this.createPrimitivePreview(interpretResult.primitiveType, interpretResult.config);
      case 'prop':
        return this.createPropPlaceholder(interpretResult.config);
      case 'composite':
        return this.createCompositePreview(interpretResult);
      default:
        return null;
    }
  }

  // ---- Dynamic geometry + material builder (core) ----

  /**
   * Build a THREE.Mesh from a geometry class name, args array, and material descriptor.
   * This is the core builder used by both single meshes and composite parts.
   */
  _buildFromGeometry(geometryName, args, materialDesc) {
    const resolved = resolveGeometry(geometryName);
    const GeometryClass = resolved ? GEOMETRY_MAP[resolved] : null;
    if (!GeometryClass) {
      console.warn(`Unknown geometry: ${geometryName}, falling back to BoxGeometry`);
      return new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshLambertMaterial({ color: '#ff00ff' })
      );
    }

    const geometry = new GeometryClass(...(args || []));
    const material = this._buildMaterial(materialDesc || {});
    return new THREE.Mesh(geometry, material);
  }

  /**
   * Build a Three.js material from a descriptor object.
   */
  _buildMaterial(desc) {
    const color = desc.color || '#888888';
    const useStandard = desc.metalness !== undefined || desc.roughness !== undefined ||
                        desc.emissive !== undefined;

    const props = { color };

    if (desc.emissive) props.emissive = desc.emissive;
    if (desc.emissiveIntensity !== undefined) props.emissiveIntensity = desc.emissiveIntensity;
    if (desc.metalness !== undefined) props.metalness = desc.metalness;
    if (desc.roughness !== undefined) props.roughness = desc.roughness;
    if (desc.opacity !== undefined) {
      props.opacity = desc.opacity;
      props.transparent = true;
    }
    if (desc.transparent) props.transparent = true;
    if (desc.side === 'double') props.side = THREE.DoubleSide;

    return useStandard
      ? new THREE.MeshStandardMaterial(props)
      : new THREE.MeshLambertMaterial(props);
  }

  // ---- Single mesh (new format) ----

  /**
   * Create a single mesh from AI result with geometry + material.
   */
  createMeshPreview(result) {
    const { name, geometry, args, material, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] } = result;

    const mesh = this._buildFromGeometry(geometry, args, material);
    mesh.position.set(position[0], position[1], position[2]);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    if (Array.isArray(scale)) {
      mesh.scale.set(scale[0], scale[1], scale[2]);
    } else if (typeof scale === 'number') {
      mesh.scale.setScalar(scale);
    }

    mesh.userData.editorType = 'mesh';
    mesh.userData.editorConfig = structuredClone(result);
    mesh.userData.editorLabel = name || geometry;

    return mesh;
  }

  // ---- Composite (multi-part) ----

  /**
   * Create a preview for a composite (multi-part) AI-generated object.
   */
  createCompositePreview(compositeResult) {
    const { label, parts, worldPosition } = compositeResult;
    const pos = worldPosition || [0, 0, 0];
    const group = new THREE.Group();

    // Track names to disambiguate duplicates
    const nameCounters = {};

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const mesh = this._buildCompositePart(part);
      if (mesh) {
        // Use AI-provided name if available, fall back to geometry or primitive type
        let partName = part.name || part.geometry || part.primitive || 'part';
        // Deduplicate: if the same name appears twice, append a number
        if (!nameCounters[partName]) nameCounters[partName] = 0;
        nameCounters[partName]++;
        if (nameCounters[partName] > 1) {
          partName = `${partName} ${nameCounters[partName]}`;
        }

        mesh.name = partName;
        mesh.userData.partIndex = i;
        mesh.userData.partName = partName;
        mesh.userData.partConfig = structuredClone(part);
        group.add(mesh);
      }
    }

    group.position.set(pos[0], pos[1], pos[2]);
    group.userData.editorType = 'composite';
    group.userData.editorConfig = { label, parts: structuredClone(parts) };
    group.userData.editorLabel = label;

    return group;
  }

  /**
   * Build a single part of a composite object.
   * Supports both new format (geometry + material) and legacy (primitive + args).
   */
  _buildCompositePart(part) {
    const { position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1] } = part;
    let mesh;

    // New format: geometry class + material object
    if (part.geometry) {
      mesh = this._buildFromGeometry(part.geometry, part.args, part.material);
    }
    // Legacy format: primitive shorthand with color baked into args
    else if (part.primitive) {
      mesh = this._buildLegacyPrimitive(part.primitive, part.args || []);
    }
    // Fallback
    else {
      mesh = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshLambertMaterial({ color: '#ff00ff' })
      );
    }

    mesh.position.set(position[0], position[1], position[2]);
    mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    if (Array.isArray(scale)) {
      mesh.scale.set(scale[0], scale[1], scale[2]);
    } else if (typeof scale === 'number') {
      mesh.scale.setScalar(scale);
    }

    return mesh;
  }

  /**
   * Build a mesh from the legacy primitive shorthand (color is last string in args).
   * Kept for backward compatibility with saved levels.
   */
  _buildLegacyPrimitive(primitive, args) {
    switch (primitive) {
      case 'box': {
        const [w = 1, h = 1, d = 1, col = '#888888'] = args;
        return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: col }));
      }
      case 'sphere': {
        const [r = 0.5, ws = 16, hs = 12, col = '#888888'] = args;
        return new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), new THREE.MeshLambertMaterial({ color: col }));
      }
      case 'cylinder': {
        const [rT = 0.3, rB = 0.3, h = 1, segs = 12, col = '#888888'] = args;
        return new THREE.Mesh(new THREE.CylinderGeometry(rT, rB, h, segs), new THREE.MeshLambertMaterial({ color: col }));
      }
      case 'cone': {
        const [r = 0.4, h = 1, segs = 12, col = '#888888'] = args;
        return new THREE.Mesh(new THREE.ConeGeometry(r, h, segs), new THREE.MeshLambertMaterial({ color: col }));
      }
      case 'crystal': {
        const [r = 0.15, h = 0.4, col = '#8844cc'] = args;
        const geo = new THREE.OctahedronGeometry(r, 0);
        geo.scale(1, h / (r * 2), 1);
        return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.5, metalness: 0.3, roughness: 0.2 }));
      }
      default: {
        const [w = 1, h = 1, d = 1, col = '#888888'] = args;
        return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: col }));
      }
    }
  }

  // ---- Legacy: single primitive (old format) ----

  createPrimitivePreview(primitiveType, config) {
    const pos = config.position || [0, 0, 0];
    const mesh = this._buildLegacyPrimitive(config.method || primitiveType, config.args || []);
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.userData.editorType = 'primitive';
    mesh.userData.editorConfig = structuredClone(config);
    mesh.userData.editorLabel = primitiveType;
    return mesh;
  }

  // ---- GLB prop placeholder ----

  createPropPlaceholder(config) {
    const pos = config.position || [0, 0, 0];
    const scale = config.scale || 1;
    const group = new THREE.Group();

    const wireframe = new THREE.Mesh(
      new THREE.BoxGeometry(scale, scale, scale),
      new THREE.MeshBasicMaterial({ color: 0x44aaff, wireframe: true })
    );
    group.add(wireframe);

    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0x44aaff })
    );
    group.add(marker);

    group.position.set(pos[0], pos[1], pos[2]);
    if (config.rotationY) group.rotation.y = config.rotationY;

    group.userData.editorType = 'prop';
    group.userData.editorConfig = structuredClone(config);
    group.userData.editorLabel = config.model;

    return group;
  }

  // ---- Decoration preview builders ----

  createDecorationPreview(config) {
    const pos = config._editorPosition || [0, 0, 0];
    const color = config.color ? new THREE.Color(config.color) : null;
    const group = new THREE.Group();

    switch (config.type) {
      case 'palmTree':
        this._buildPalmTree(group, color);
        break;
      case 'tree':
        this._buildTree(group, color);
        break;
      case 'pineTree':
        this._buildPineTree(group, color);
        break;
      case 'rock':
        this._buildRock(group, config, color);
        break;
      case 'water':
        this._buildWater(group, config, color);
        break;
      case 'bird':
        this._buildBird(group, color);
        break;
      case 'stalactite':
        this._buildStalactite(group, color);
        break;
      case 'mushroom':
        this._buildMushroom(group, config, color);
        break;
      case 'crystal':
        this._buildCrystal(group, config, color);
        break;
      case 'coral':
        this._buildCoral(group, color);
        break;
      case 'vine':
        this._buildVine(group, color);
        break;
      case 'lantern':
        this._buildLantern(group, config, color);
        break;
      case 'column':
        this._buildColumn(group, color);
        break;
      default: {
        const fallback = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.5, 0.5),
          new THREE.MeshLambertMaterial({ color: color || 0x888888 })
        );
        group.add(fallback);
      }
    }

    group.position.set(pos[0], pos[1], pos[2]);
    group.userData.editorType = 'decoration';
    group.userData.editorConfig = structuredClone(config);
    group.userData.editorLabel = config.type;

    return group;
  }

  _buildPalmTree(group, color) {
    const trunkH = 3;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.15, trunkH, 6),
      new THREE.MeshLambertMaterial({ color: '#8B6914' })
    );
    trunk.position.y = trunkH / 2;
    group.add(trunk);
    for (let j = 0; j < 5; j++) {
      const leaf = new THREE.Mesh(
        new THREE.ConeGeometry(0.4, 1.5, 4),
        new THREE.MeshLambertMaterial({ color: color || '#2d8a3e' })
      );
      const angle = (j / 5) * Math.PI * 2;
      leaf.position.set(Math.cos(angle) * 0.6, trunkH - 0.2, Math.sin(angle) * 0.6);
      leaf.rotation.x = Math.cos(angle) * 0.8;
      leaf.rotation.z = Math.sin(angle) * 0.8;
      group.add(leaf);
    }
  }

  _buildTree(group, color) {
    const trunkH = 1.8;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.12, trunkH, 6),
      new THREE.MeshLambertMaterial({ color: '#5C4033' })
    );
    trunk.position.y = trunkH / 2;
    group.add(trunk);
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(1.0, 8, 6),
      new THREE.MeshLambertMaterial({ color: color || '#2d6b1e' })
    );
    canopy.position.y = trunkH + 0.6;
    group.add(canopy);
  }

  _buildPineTree(group, color) {
    const trunkH = 1.2;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.1, trunkH, 6),
      new THREE.MeshLambertMaterial({ color: '#5C4033' })
    );
    trunk.position.y = trunkH / 2;
    group.add(trunk);
    for (let j = 0; j < 3; j++) {
      const coneH = 1.0;
      const coneR = (0.8 - j * 0.2) * 0.6;
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(coneR, coneH, 6),
        new THREE.MeshLambertMaterial({ color: color || '#1a4d2e' })
      );
      cone.position.y = trunkH + j * coneH * 0.6 + coneH * 0.4;
      group.add(cone);
    }
  }

  _buildRock(group, config, color) {
    const s = config.scale ? (Array.isArray(config.scale) ? (config.scale[0] + config.scale[1]) / 2 : config.scale) : 0.6;
    const geo = new THREE.IcosahedronGeometry(s, 0);
    const pos = geo.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      pos.setX(v, pos.getX(v) * (0.8 + Math.random() * 0.4));
      pos.setY(v, pos.getY(v) * (0.6 + Math.random() * 0.4));
      pos.setZ(v, pos.getZ(v) * (0.8 + Math.random() * 0.4));
    }
    geo.computeVertexNormals();
    const rock = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: color || '#808080' }));
    rock.position.y = s * 0.3;
    group.add(rock);
  }

  _buildWater(group, config, color) {
    const size = config.size || 20;
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshLambertMaterial({
        color: color || '#1a8fbf', transparent: true, opacity: config.opacity || 0.6, side: THREE.DoubleSide,
      })
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = config.y != null ? config.y : -0.05;
    group.add(water);
  }

  _buildBird(group, color) {
    const wingMat = new THREE.MeshLambertMaterial({ color: color || '#333333' });
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
    group.position.y = 5;
  }

  _buildStalactite(group, color) {
    const len = 1.2;
    const stalactite = new THREE.Mesh(
      new THREE.ConeGeometry(0.08, len, 5),
      new THREE.MeshLambertMaterial({ color: color || '#666655' })
    );
    stalactite.rotation.x = Math.PI;
    stalactite.position.y = 4 - len / 2;
    group.add(stalactite);
  }

  _buildMushroom(group, config, color) {
    const stemH = 0.25;
    const capR = 0.15;
    const stem = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.04, stemH, 5),
      new THREE.MeshLambertMaterial({ color: '#d4c5a0' })
    );
    stem.position.y = stemH / 2;
    group.add(stem);
    const glowColor = config.glowColor || '#ff6644';
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(capR, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2),
      new THREE.MeshLambertMaterial({ color: color || '#c84b31', emissive: glowColor, emissiveIntensity: 0.4 })
    );
    cap.position.y = stemH;
    group.add(cap);
  }

  _buildCrystal(group, config, color) {
    const col = color || new THREE.Color(config.color || '#8844cc');
    const glow = config.glowIntensity || 0.6;
    for (let j = 0; j < 3; j++) {
      const h = 0.4 + Math.random() * 0.6;
      const r = 0.06 + Math.random() * 0.08;
      const shard = new THREE.Mesh(
        new THREE.OctahedronGeometry(r, 0),
        new THREE.MeshStandardMaterial({
          color: col, emissive: col, emissiveIntensity: glow,
          roughness: 0.2, metalness: 0.3,
        })
      );
      shard.scale.y = h / r;
      shard.position.set((Math.random() - 0.5) * 0.2, h * 0.4, (Math.random() - 0.5) * 0.2);
      shard.rotation.z = (Math.random() - 0.5) * 0.4;
      group.add(shard);
    }
  }

  _buildCoral(group, color) {
    const col = color || new THREE.Color('#e85d75');
    for (let j = 0; j < 4; j++) {
      const h = 0.3 + Math.random() * 0.4;
      const branch = new THREE.Mesh(
        new THREE.CylinderGeometry(0.02, 0.05, h, 5),
        new THREE.MeshLambertMaterial({ color: col })
      );
      branch.position.set((Math.random() - 0.5) * 0.15, h / 2, (Math.random() - 0.5) * 0.15);
      branch.rotation.x = (Math.random() - 0.5) * 0.4;
      group.add(branch);
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.04, 5, 4),
        new THREE.MeshLambertMaterial({ color: col })
      );
      tip.position.set(branch.position.x, h, branch.position.z);
      group.add(tip);
    }
  }

  _buildVine(group, color) {
    const col = color || new THREE.Color('#2d5a1e');
    const len = 2.0;
    const segments = 5;
    const segLen = len / segments;
    let y = 4;
    let xOff = 0;
    for (let s = 0; s < segments; s++) {
      const seg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.015, 0.02, segLen, 4),
        new THREE.MeshLambertMaterial({ color: col })
      );
      xOff += (Math.random() - 0.5) * 0.08;
      seg.position.set(xOff, y - segLen / 2, 0);
      group.add(seg);
      y -= segLen;
    }
  }

  _buildLantern(group, config, color) {
    const col = color || new THREE.Color(config.color || '#ffaa44');
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.2, 0.15),
      new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.5 })
    );
    group.add(body);
    const light = new THREE.PointLight(col, 0.8, 8);
    light.position.y = 0.1;
    group.add(light);
    group.position.y = 3;
  }

  _buildColumn(group, color) {
    const h = 4;
    const r = 0.2;
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r * 1.1, h, 8),
      new THREE.MeshLambertMaterial({ color: color || '#888888' })
    );
    column.position.y = h / 2;
    group.add(column);
  }
}
