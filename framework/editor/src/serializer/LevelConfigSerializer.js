/**
 * LevelConfigSerializer — save editor scene → levelN.js ES module, load levelN.js → editor scene.
 *
 * Output format matches Immersio's level config spec exactly:
 *   export default { id, name, environment, decorations, props, playerSpawn, exit }
 */
export class LevelConfigSerializer {
  /**
   * @param {string} gameSlug — game directory slug
   * @param {number} levelNumber — level index
   */
  constructor(gameSlug, levelNumber) {
    this.gameSlug = gameSlug;
    this.levelNumber = levelNumber;
  }

  // ---- Save: scene state → level config JS source ----

  /**
   * Serialize the current editor state to a levelN.js ES module string.
   *
   * @param {object} state — {
   *   name: string,
   *   environment: object,
   *   decorations: object[],
   *   props: object[],
   *   playerSpawn: { position: [x,y,z], rotationY?: number },
   *   exit: object | object[] | null
   * }
   * @returns {string} — valid ES module source code
   */
  serialize(state) {
    const config = {
      id: this.levelNumber,
      name: state.name || `Level ${this.levelNumber}`,
      environment: this._cleanEnvironment(state.environment || {}),
      decorations: this._cleanDecorations(state.decorations || []),
      props: this._cleanProps(state.props || []),
      playerSpawn: state.playerSpawn || { position: [0, 0, 8], rotationY: Math.PI },
    };

    if (state.exit) {
      config.exit = state.exit;
    }

    if (state.engineInstructions?.length > 0) {
      config._editorMeta = { engineInstructions: state.engineInstructions };
    }

    return this._toESModule(config);
  }

  /**
   * Save serialized config to the game's levels directory.
   * Uses the Fetch API to POST to the Vite dev server's save endpoint,
   * or falls back to generating a downloadable file.
   *
   * @param {object} state — same as serialize()
   * @returns {Promise<{ success: boolean, path: string, source: string }>}
   */
  async save(state) {
    const source = this.serialize(state);
    const filename = `level${this.levelNumber}.js`;
    // Always use relative path from repo root — the save plugin resolves it
    const targetPath = `games/${this.gameSlug}/src/levels/${filename}`;

    // Try dev server save endpoint (if configured)
    try {
      const res = await fetch('/__editor_save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: targetPath, content: source }),
      });
      if (res.ok) {
        return { success: true, path: targetPath, source };
      }
    } catch { /* dev server endpoint not available */ }

    // Fallback: offer download
    this._downloadFile(filename, source);
    return { success: true, path: filename, source };
  }

  // ---- Load: level config → editor state ----

  /**
   * Load a level config from disk via the editor load endpoint.
   * @returns {Promise<object|null>} — the level config object, or null
   */
  async load() {
    const filePath = `games/${this.gameSlug}/src/levels/level${this.levelNumber}.js`;
    try {
      const res = await fetch(`/__editor_load?path=${encodeURIComponent(filePath)}`);
      if (!res.ok) return null;
      const source = await res.text();
      const config = this.parseSource(source);
      if (config?._editorMeta) {
        config.engineInstructions = config._editorMeta.engineInstructions || [];
        delete config._editorMeta;
      }
      return config;
    } catch (err) {
      console.warn(`Could not load level config from ${filePath}:`, err);
      return null;
    }
  }

  /**
   * Parse a level config source string into a config object.
   * Uses Function constructor to evaluate the ES module.
   * @param {string} source — level config JS source
   * @returns {object | null}
   */
  parseSource(source) {
    try {
      // Strip `export default` and trailing semicolons, evaluate the object literal
      let cleaned = source.trim();
      cleaned = cleaned.replace(/^export\s+default\s+/, '');
      if (cleaned.endsWith(';')) cleaned = cleaned.slice(0, -1);

      // Replace Math.PI references with actual values for safe eval
      cleaned = cleaned.replace(/Math\.PI/g, String(Math.PI));

      // Use Function to evaluate in isolated scope
      const fn = new Function(`return (${cleaned})`);
      return fn();
    } catch (err) {
      console.warn('Failed to parse level config source:', err);
      return null;
    }
  }

  // ---- Internal: config cleaning ----

  _cleanEnvironment(env) {
    const cleaned = {};

    // Outdoor (sky) or Indoor (enclosure)
    if (env.sky) cleaned.sky = this._pick(env.sky, ['topColor', 'bottomColor', 'offset', 'exponent']);
    if (env.enclosure) cleaned.enclosure = this._pick(env.enclosure, [
      'width', 'depth', 'height', 'wallColor', 'ceilingColor', 'floorColor',
      'emissive', 'emissiveIntensity', 'trimColor',
    ]);
    if (env.background) cleaned.background = env.background;
    if (env.ground) cleaned.ground = this._pick(env.ground, ['radius', 'color']);
    if (env.fog) cleaned.fog = this._pick(env.fog, ['color', 'density']);
    if (env.directional) cleaned.directional = this._pick(env.directional, ['color', 'intensity', 'position']);
    if (env.hemisphere) cleaned.hemisphere = this._pick(env.hemisphere, ['skyColor', 'groundColor', 'intensity']);
    if (env.ambient) cleaned.ambient = this._pick(env.ambient, ['color', 'intensity']);
    if (env.pointLights) cleaned.pointLights = env.pointLights.map(l =>
      this._pick(l, ['color', 'intensity', 'distance', 'position', 'visible'])
    );
    if (env.spotLights) cleaned.spotLights = env.spotLights.map(l =>
      this._pick(l, ['color', 'intensity', 'distance', 'angle', 'penumbra', 'position', 'target'])
    );
    if (env.particles) cleaned.particles = this._pick(env.particles, ['count', 'color']);

    return cleaned;
  }

  _cleanDecorations(decorations) {
    return decorations.map(dec => this._cleanObject(dec));
  }

  _cleanProps(props) {
    return props.map(p => {
      const cleaned = this._cleanObject(p);
      // Round position/rotation values
      if (cleaned.position) cleaned.position = this._roundArray(cleaned.position);
      if (cleaned.rotationY) cleaned.rotationY = this._round(cleaned.rotationY);
      return cleaned;
    });
  }

  /** Keep all keys except internal editor fields (prefixed with _) */
  _cleanObject(obj) {
    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key.startsWith('_')) continue;
      if (value === undefined) continue;
      if (Array.isArray(value)) {
        cleaned[key] = value.map(v =>
          v && typeof v === 'object' && !Array.isArray(v) ? this._cleanObject(v) : v
        );
      } else if (value && typeof value === 'object') {
        cleaned[key] = this._cleanObject(value);
      } else {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }

  // ---- Internal: JS code generation ----

  _toESModule(config) {
    const lines = [];
    lines.push('export default {');
    lines.push(`  id: ${config.id},`);
    lines.push(`  name: ${this._str(config.name)},`);

    // Environment
    lines.push('  environment: {');
    this._serializeEnvironment(config.environment, lines, 4);
    lines.push('  },');

    // Decorations
    lines.push('  decorations: [');
    for (const dec of config.decorations) {
      lines.push(`    ${this._inlineObject(dec)},`);
    }
    lines.push('  ],');

    // Props
    lines.push('  props: [');
    for (const prop of config.props) {
      lines.push(`    ${this._inlineObject(prop)},`);
    }
    lines.push('  ],');

    // Player spawn
    lines.push(`  playerSpawn: ${this._serializePlayerSpawn(config.playerSpawn)},`);

    // Exit
    if (config.exit) {
      if (Array.isArray(config.exit)) {
        lines.push('  exit: [');
        for (const ex of config.exit) {
          lines.push(`    ${this._inlineObject(ex)},`);
        }
        lines.push('  ],');
      } else {
        lines.push(`  exit: ${this._inlineObject(config.exit)},`);
      }
    }

    // Editor metadata (engine instructions, etc.) — preserved across save/load
    if (config._editorMeta) {
      lines.push(`  _editorMeta: ${JSON.stringify(config._editorMeta)},`);
    }

    lines.push('};');
    return lines.join('\n') + '\n';
  }

  _serializeEnvironment(env, lines, indent) {
    const pad = ' '.repeat(indent);

    for (const [key, value] of Object.entries(env)) {
      if (Array.isArray(value)) {
        // pointLights, spotLights arrays
        lines.push(`${pad}${key}: [`);
        for (const item of value) {
          lines.push(`${pad}  ${this._inlineObject(item)},`);
        }
        lines.push(`${pad}],`);
      } else if (value && typeof value === 'object') {
        // Nested objects: sky, ground, fog, etc.
        lines.push(`${pad}${key}: ${this._inlineObject(value)},`);
      } else {
        lines.push(`${pad}${key}: ${this._jsValue(value)},`);
      }
    }
  }

  _serializePlayerSpawn(spawn) {
    const parts = [`position: [${this._roundArray(spawn.position).join(', ')}]`];
    if (spawn.rotationY !== undefined && spawn.rotationY !== 0) {
      parts.push(`rotationY: ${this._serializeAngle(spawn.rotationY)}`);
    }
    return `{ ${parts.join(', ')} }`;
  }

  // ---- Value serialization helpers ----

  _inlineObject(obj) {
    const parts = [];
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith('_')) continue; // skip internal editor fields
      parts.push(`${k}: ${this._jsValue(v)}`);
    }
    return `{ ${parts.join(', ')} }`;
  }

  _jsValue(value) {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'string') return this._str(value);
    if (typeof value === 'number') return this._round(value).toString();
    if (typeof value === 'boolean') return value.toString();
    if (Array.isArray(value)) return `[${value.map(v => this._jsValue(v)).join(', ')}]`;
    if (typeof value === 'object') return this._inlineObject(value);
    return String(value);
  }

  _str(s) {
    return `'${s.replace(/'/g, "\\'")}'`;
  }

  _round(n) {
    return Math.round(n * 1000) / 1000;
  }

  _roundArray(arr) {
    return arr ? arr.map(v => this._round(v)) : [0, 0, 0];
  }

  _serializeAngle(radians) {
    // Check for common Math.PI fractions for readability
    const pi = Math.PI;
    const tolerance = 0.001;
    if (Math.abs(radians - pi) < tolerance) return 'Math.PI';
    if (Math.abs(radians + pi) < tolerance) return '-Math.PI';
    if (Math.abs(radians - pi / 2) < tolerance) return 'Math.PI / 2';
    if (Math.abs(radians + pi / 2) < tolerance) return '-Math.PI / 2';
    if (Math.abs(radians - pi / 4) < tolerance) return 'Math.PI / 4';
    if (Math.abs(radians + pi / 4) < tolerance) return '-Math.PI / 4';
    if (Math.abs(radians - pi / 3) < tolerance) return 'Math.PI / 3';
    if (Math.abs(radians + pi / 3) < tolerance) return '-Math.PI / 3';
    if (Math.abs(radians - pi / 6) < tolerance) return 'Math.PI / 6';
    if (Math.abs(radians + pi / 6) < tolerance) return '-Math.PI / 6';
    if (Math.abs(radians - pi * 2) < tolerance) return 'Math.PI * 2';
    return this._round(radians).toString();
  }

  _pick(obj, keys) {
    const result = {};
    for (const key of keys) {
      if (obj[key] !== undefined) result[key] = obj[key];
    }
    return result;
  }

  _downloadFile(filename, content) {
    const blob = new Blob([content], { type: 'text/javascript' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
