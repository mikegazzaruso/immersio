import {
  OBJECT_SYSTEM_PROMPT,
  ENVIRONMENT_SYSTEM_PROMPT,
  ENGINE_SYSTEM_PROMPT,
  TITLE_SCREEN_SYSTEM_PROMPT,
  buildObjectUserMessage,
  buildEnvironmentUserMessage,
  buildEngineUserMessage,
  buildTitleScreenUserMessage,
} from './prompts.js';

/**
 * AIPromptInterpreter — ALL creation goes through OpenAI.
 *
 * Every object and environment request is sent to the AI.
 * No local keyword matching, no fuzzy guessing.
 * The only local shortcut is explicit GLB model references.
 */
export class AIPromptInterpreter {
  /**
   * @param {import('./OpenAIClient.js').OpenAIClient | null} openaiClient
   */
  constructor(openaiClient = null) {
    this._openai = openaiClient;
  }

  set openaiClient(client) { this._openai = client; }
  get openaiClient() { return this._openai; }

  /**
   * Interpret a prompt — ALWAYS calls OpenAI.
   * @param {string} prompt
   * @param {{ x: number, y: number, z: number } | null} worldPosition
   * @param {'object' | 'environment'} type
   * @returns {Promise<{ success: boolean, result: object | null, description: string, source: string, usage?: object }>}
   */
  async interpret(prompt, worldPosition = null, type = 'object') {
    const normalized = prompt.trim();

    // Require API key — no fallback
    if (!this._openai?.isConfigured) {
      return {
        success: false,
        result: null,
        description: 'OpenAI API key not configured. Open Settings to add your key.',
        source: 'local',
      };
    }

    // Only local shortcut: explicit GLB model reference
    if (type === 'object') {
      const glbMatch = normalized.match(/(?:place|add|put|load|import)\s+(?:the\s+)?(\S+\.glb)/i);
      if (glbMatch) {
        const pos = worldPosition
          ? [Math.round(worldPosition.x * 10) / 10, Math.round(worldPosition.y * 10) / 10, Math.round(worldPosition.z * 10) / 10]
          : [0, 0, 0];
        return {
          success: true,
          source: 'local',
          result: {
            configType: 'prop',
            config: { model: glbMatch[1], position: pos, scale: 1, rotationY: 0 },
          },
          description: `GLB model "${glbMatch[1]}" at (${pos[0]}, ${pos[1]}, ${pos[2]})`,
        };
      }
    }

    // Everything goes to OpenAI
    try {
      const isEnv = type === 'environment';
      const systemPrompt = isEnv ? ENVIRONMENT_SYSTEM_PROMPT : OBJECT_SYSTEM_PROMPT;
      const userMessage = isEnv
        ? buildEnvironmentUserMessage(normalized)
        : buildObjectUserMessage(normalized, worldPosition);

      // Environment JSON is large (lighting + decorations), needs more tokens
      const maxTokens = isEnv ? 8000 : 3000;

      const { json, usage } = await this._openai.completeJSON([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ], { temperature: 0.4, maxTokens });

      if (isEnv) {
        return this._parseAIEnvironment(json, usage);
      }
      return this._parseAIObject(json, worldPosition, usage);
    } catch (err) {
      console.error('AI interpretation failed:', err);
      return {
        success: false,
        result: null,
        description: `AI error: ${err.message}`,
        source: 'ai',
        rawResponse: err.rawResponse || '',
      };
    }
  }

  // ---- Engine customization (behaviors module) ----

  /**
   * Interpret an engine customization prompt.
   * Passes the current behaviors.js to the AI, receives the modified version back.
   * @param {string} prompt - User's instruction
   * @param {{ decorations: string[], props: string[], existingCode: string | null }} levelContext
   * @returns {Promise<{ success: boolean, files?: Record<string, string>, summary?: string, usage?: object, description?: string, rawResponse?: string }>}
   */
  async interpretEngine(prompt, levelContext) {
    if (!this._openai?.isConfigured) {
      return {
        success: false,
        description: 'OpenAI API key not configured. Open Settings to add your key.',
      };
    }

    try {
      const userMessage = buildEngineUserMessage(prompt, levelContext);
      const { json, usage } = await this._openai.completeJSON([
        { role: 'system', content: ENGINE_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ], { maxTokens: 8000 });

      // Validate response shape: { files: { "custom/behaviors.js": "..." }, summary: "..." }
      if (!json.files || typeof json.files !== 'object') {
        return {
          success: false,
          description: 'AI response missing "files" object — try rephrasing your instruction',
          rawResponse: JSON.stringify(json, null, 2),
        };
      }

      // Extract valid file contents
      const files = {};
      for (const [path, content] of Object.entries(json.files)) {
        if (typeof content === 'string' && content.trim().length > 0) {
          files[path] = content;
        }
      }

      if (Object.keys(files).length === 0) {
        return {
          success: false,
          description: 'AI returned empty files — try rephrasing your instruction',
          rawResponse: JSON.stringify(json, null, 2),
        };
      }

      // Extract new objects to place in editor (optional)
      const objects = Array.isArray(json.objects) ? json.objects : [];

      return {
        success: true,
        files,
        objects,
        summary: json.summary || 'Custom behaviors updated',
        usage,
      };
    } catch (err) {
      console.error('AI engine interpretation failed:', err);
      return {
        success: false,
        description: `AI error: ${err.message}`,
        rawResponse: err.rawResponse || '',
      };
    }
  }

  // ---- Title screen generation ----

  /**
   * Interpret a title screen prompt.
   * @param {string} prompt - User's description
   * @param {string} titleText - Game title text
   * @param {string} subtitle - Optional subtitle
   * @returns {Promise<{ success: boolean, config?: object, summary?: string, usage?: object, description?: string, rawResponse?: string }>}
   */
  async interpretTitleScreen(prompt, titleText, subtitle) {
    if (!this._openai?.isConfigured) {
      return {
        success: false,
        description: 'OpenAI API key not configured. Open Settings to add your key.',
      };
    }

    try {
      const userMessage = buildTitleScreenUserMessage(prompt, titleText, subtitle);
      const { json, usage } = await this._openai.completeJSON([
        { role: 'system', content: TITLE_SCREEN_SYSTEM_PROMPT },
        { role: 'user', content: userMessage },
      ], { temperature: 0.5, maxTokens: 8000 });

      if (!json.environment) {
        return {
          success: false,
          description: 'AI response missing environment config for title screen',
          rawResponse: JSON.stringify(json, null, 2),
        };
      }

      const t = json.title || {};
      return {
        success: true,
        config: {
          id: 0,
          name: 'Title Screen',
          environment: json.environment,
          decorations: json.decorations || [],
          title: {
            text: titleText || t.text || 'Untitled',
            subtitle: subtitle || t.subtitle || '',
            color: t.color || '#ffffff',
            emissiveColor: t.emissiveColor || '#4488ff',
            position: t.position || [0, 3, -5],
            fontSize: t.fontSize || 72,
            subtitleFontSize: t.subtitleFontSize || 36,
            scale: t.scale || [4, 1, 1],
            subtitleScale: t.subtitleScale || [3, 0.5, 1],
            startPromptFontSize: t.startPromptFontSize || 28,
            startPromptScale: t.startPromptScale || [3, 0.4, 1],
          },
          startPrompt: json.startPrompt || 'Click or press trigger to start',
        },
        summary: json.summary || 'Title screen generated',
        usage,
      };
    } catch (err) {
      console.error('AI title screen interpretation failed:', err);
      return {
        success: false,
        description: `AI error: ${err.message}`,
        rawResponse: err.rawResponse || '',
      };
    }
  }

  // ---- Parse AI object response ----

  _parseAIObject(json, worldPosition, usage, rawJSON) {
    const pos = worldPosition
      ? [Math.round(worldPosition.x * 10) / 10, Math.round(worldPosition.y * 10) / 10, Math.round(worldPosition.z * 10) / 10]
      : [0, 0, 0];

    // Composite object (multi-part)
    if (json.type === 'composite' && Array.isArray(json.parts)) {
      const label = json.label || 'AI object';
      return {
        success: true,
        source: 'ai',
        usage,
        result: {
          configType: 'composite',
          label,
          parts: json.parts.map(p => ({
            name: p.name || null,
            // New format: geometry + material
            geometry: p.geometry || null,
            args: p.args || [],
            material: p.material || null,
            // Legacy format: primitive + args (with color baked into args)
            primitive: p.primitive || null,
            position: p.position || [0, 0, 0],
            rotation: p.rotation || [0, 0, 0],
            scale: p.scale || [1, 1, 1],
          })),
          worldPosition: pos,
        },
        description: `${label} at (${pos[0]}, ${pos[1]}, ${pos[2]})`,
      };
    }

    // Single mesh (new format: geometry + material)
    if (json.type === 'mesh' && json.geometry) {
      return {
        success: true,
        source: 'ai',
        usage,
        result: {
          configType: 'mesh',
          name: json.name || json.geometry,
          geometry: json.geometry,
          args: json.args || [],
          material: json.material || { color: '#888888' },
          position: json.position || pos,
          rotation: json.rotation || [0, 0, 0],
          scale: json.scale || [1, 1, 1],
        },
        description: `${json.name || json.geometry} at (${pos[0]}, ${pos[1]}, ${pos[2]})`,
      };
    }

    // Legacy: single primitive
    if (json.type === 'primitive' && json.config) {
      const config = json.config;
      if (!config.position) config.position = pos;
      return {
        success: true,
        source: 'ai',
        usage,
        result: {
          configType: 'primitive',
          primitiveType: json.primitiveType || config.method || 'box',
          config,
        },
        description: `${json.primitiveType || config.method || 'object'} at (${pos[0]}, ${pos[1]}, ${pos[2]})`,
      };
    }

    // Decoration type
    if (json.type === 'decoration' && json.config) {
      const config = json.config;
      if (worldPosition && !config._editorPosition) {
        config._editorPosition = pos;
        config.radius = config.radius || [0, 0.5];
        config.count = config.count || 1;
      }
      return {
        success: true,
        source: 'ai',
        usage,
        result: { configType: 'decoration', config },
        description: `${config.type || 'decoration'} at (${pos[0]}, ${pos[1]}, ${pos[2]})`,
      };
    }

    return {
      success: false,
      result: null,
      description: 'AI returned unrecognized format — try rephrasing your prompt',
      source: 'ai',
      rawResponse: JSON.stringify(json, null, 2),
    };
  }

  // ---- Parse AI environment response ----

  _parseAIEnvironment(json, usage) {
    // Standard format: { environment: {...}, decorations: [...] }
    if (json.environment) {
      return {
        success: true,
        source: 'ai',
        usage,
        result: {
          configType: 'environment',
          environment: json.environment,
          decorations: json.decorations || [],
          presetName: 'ai-generated',
        },
        description: 'AI-generated environment applied',
      };
    }

    // Resilience: some models return only decorations as an array
    if (Array.isArray(json)) {
      return {
        success: true,
        source: 'ai',
        usage,
        result: {
          configType: 'environment',
          environment: this._buildFallbackEnvironment(),
          decorations: this._normalizeDecorations(json),
          presetName: 'ai-generated',
        },
        description: 'AI-generated environment applied (with default lighting)',
      };
    }

    // Resilience: model wrapped in some other key (e.g. { scene: {...} })
    const keys = Object.keys(json);
    for (const key of keys) {
      if (json[key]?.sky || json[key]?.enclosure || json[key]?.ground) {
        return {
          success: true,
          source: 'ai',
          usage,
          result: {
            configType: 'environment',
            environment: json[key],
            decorations: json.decorations || json.objects || json.items || [],
            presetName: 'ai-generated',
          },
          description: 'AI-generated environment applied',
        };
      }
    }

    return {
      success: false,
      result: null,
      description: 'AI response missing environment config — try rephrasing',
      source: 'ai',
      rawResponse: JSON.stringify(json, null, 2),
    };
  }

  /** Build a sensible default outdoor environment when the model only returns decorations */
  _buildFallbackEnvironment() {
    return {
      sky: { topColor: '#0055aa', bottomColor: '#aaddff', offset: 0, exponent: 0.8 },
      ground: { radius: 60, color: '#557744' },
      fog: { color: '#aaddff', density: 0.012 },
      directional: { color: '#ffffff', intensity: 1.2, position: [10, 20, 10] },
      hemisphere: { skyColor: '#aaddff', groundColor: '#445533', intensity: 0.7 },
      ambient: { color: '#ffffff', intensity: 0.3 },
    };
  }

  /** Normalize decoration arrays from models that use non-standard formats */
  _normalizeDecorations(arr) {
    return arr.map(d => {
      // Already in our format: has name + string geometry or parts array
      if (d.name && (typeof d.geometry === 'string' || d.parts)) return d;
      // Has type but no name — promote type to name
      if (d.type && !d.name) d.name = d.type;
      // String geometry without name — use geometry as name
      if (typeof d.geometry === 'string' && !d.name) {
        d.name = d.geometry.replace(/Geometry$/i, '').toLowerCase();
        return d;
      }
      // Model used {type, geometry:{trunk:{...}, canopy:{...}}} — object geometry = multi-part
      if (d.geometry && typeof d.geometry === 'object' && !Array.isArray(d.geometry)) {
        const parts = this._convertObjectGeometryToParts(d.geometry);
        if (parts.length > 0) {
          return { name: d.name || d.type || 'object', count: d.count || 5, radius: d.radius || [3, 15], parts };
        }
      }
      // Ensure count/radius defaults
      if (!d.count) d.count = 5;
      if (!d.radius) d.radius = [3, 15];
      return d;
    }).filter(d => d.name || d.type);
  }

  /** Convert {trunk:{type:"cylinder",...}, canopy:{type:"sphere",...}} → parts array */
  _convertObjectGeometryToParts(geoObj) {
    const GEO_SUFFIX = {
      box: 'BoxGeometry', sphere: 'SphereGeometry', cylinder: 'CylinderGeometry',
      cone: 'ConeGeometry', torus: 'TorusGeometry', octahedron: 'OctahedronGeometry',
      icosahedron: 'IcosahedronGeometry', plane: 'PlaneGeometry',
    };
    const parts = [];
    for (const [partName, part] of Object.entries(geoObj)) {
      if (!part || typeof part !== 'object') continue;
      const rawType = part.type || part.geometry || '';
      const geoName = GEO_SUFFIX[rawType.toLowerCase()] || `${rawType.charAt(0).toUpperCase() + rawType.slice(1)}Geometry`;
      // Build args from whatever numeric fields are present
      const args = [];
      if (part.radiusTop !== undefined) args.push(part.radiusTop);
      else if (part.radius !== undefined) args.push(part.radius);
      if (part.radiusBottom !== undefined) args.push(part.radiusBottom);
      if (part.height !== undefined) args.push(part.height);
      if (part.segments !== undefined) {
        if (Array.isArray(part.segments)) args.push(...part.segments);
        else args.push(part.segments);
      }
      if (part.width !== undefined && part.depth !== undefined) {
        // BoxGeometry: w, h, d
        args.length = 0;
        args.push(part.width, part.height || 1, part.depth);
      }
      parts.push({
        name: partName,
        geometry: geoName,
        args,
        material: part.material || { color: part.color || '#888888' },
        position: part.position || [0, 0, 0],
        rotation: part.rotation || [0, 0, 0],
      });
    }
    return parts;
  }
}
