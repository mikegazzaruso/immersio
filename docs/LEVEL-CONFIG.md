# Level Configuration Format

Level configs are ES modules in `src/levels/levelN.js` that export a default object.

## Structure

```js
export default {
  id: 1,                    // Level number (integer)
  name: 'Level Name',       // Human-readable name
  environment: { ... },     // Sky/enclosure, fog, lights, ground, particles
  decorations: [ ... ],     // Procedural decoration entries
  props: [ ... ],           // GLB model placements
  playerSpawn: { ... },     // Player start position
};
```

## Environment

### Outdoor Environment

```js
environment: {
  background: '#87CEEB',           // Optional scene background color
  sky: {
    topColor: '#0055aa',           // Sky zenith color (required)
    bottomColor: '#aaddff',        // Sky horizon color (required)
    offset: 0,                     // Optional: vertical offset for gradient
    exponent: 1,                   // Optional: gradient curve exponent
  },
  ground: {
    radius: 50,                    // Circle radius
    color: '#557744',              // Ground color
  },
  fog: {
    color: '#aaddff',              // Fog color (match sky bottom)
    density: 0.015,                // FogExp2 density
  },
  directional: {
    color: '#ffffff',              // Sun/moon color
    intensity: 1.0,                // Light intensity
    position: [10, 20, 10],        // Light position [x, y, z]
  },
  hemisphere: {
    skyColor: '#aaddff',           // Sky hemisphere color
    groundColor: '#445533',        // Ground hemisphere color
    intensity: 0.6,                // Intensity
  },
  ambient: {
    color: '#ffffff',              // Ambient light color
    intensity: 0.3,                // Ambient intensity
  },
  particles: {
    count: 60,                     // Number of floating particles
    color: '#ffffff',              // Particle color
  },
}
```

### Indoor Environment

```js
environment: {
  enclosure: {
    width: 20,                     // Room width (X axis)
    depth: 20,                     // Room depth (Z axis)
    height: 4,                     // Room height (Y axis)
    wallColor: '#333333',          // Wall color
    ceilingColor: '#222222',       // Ceiling color
    floorColor: '#444444',         // Floor color
    emissive: '#112233',           // Optional: emissive tint on walls/ceiling
    emissiveIntensity: 0.1,        // Emissive strength
    trimColor: '#00aaff',          // Optional: neon trim strips at ceiling edges
  },
  fog: {
    color: '#111111',
    density: 0.03,
  },
  hemisphere: {
    skyColor: '#333344',
    groundColor: '#222222',
    intensity: 0.4,
  },
  pointLights: [
    {
      color: '#ffaa44',
      intensity: 2.0,
      distance: 20,                // Light range
      position: [0, 3.5, 0],
      visible: true,               // Show visible light bulb mesh (default: true)
    },
  ],
  spotLights: [
    {
      color: '#ffffff',
      intensity: 3.0,
      distance: 30,
      angle: Math.PI / 6,          // Cone angle
      penumbra: 0.5,               // Edge softness
      position: [5, 4, 0],
      target: [5, 0, 0],           // Where the light points
    },
  ],
  particles: {
    count: 40,
    color: '#aaccff',
  },
}
```

### Sky Shader

The sky uses a shader gradient sphere:

- **Simple mode** (default): Linear blend between `bottomColor` and `topColor` based on normalized Y position.
- **Advanced mode** (when `offset` or `exponent` set): Uses `pow(normalize(pos + offset).y, exponent)` for more control. Higher exponent = sharper horizon line. Positive offset = more sky color visible.

## Props

```js
props: [
  {
    model: 'temple.glb',          // GLB file in public/models/N/
    position: [3, 0, -5],         // [x, y, z] — Y is auto-grounded
    scale: 1.5,                   // Uniform scale (number)
    rotationY: Math.PI / 4,       // Y-axis rotation in radians
  },
]
```

**Auto-grounding:** The LevelLoader computes the model's bounding box after scaling and adjusts Y so the bottom sits on the floor. You only need to set `position[1]` if the object should float above ground.

## Player Spawn

```js
playerSpawn: {
  position: [0, 0, 8],            // [x, y, z]
  rotationY: Math.PI,             // Face toward center (optional)
}
```

## Decorations

See [DECORATION-TYPES.md](DECORATION-TYPES.md) for the full list of procedural decoration types and their parameters.

## Full Example

```js
export default {
  id: 1,
  name: 'Tropical Beach',
  environment: {
    sky: { topColor: '#0066cc', bottomColor: '#aaddff' },
    ground: { radius: 50, color: '#e8d68c' },
    fog: { color: '#aaddff', density: 0.012 },
    directional: { color: '#fff5e0', intensity: 1.2, position: [15, 25, 10] },
    hemisphere: { skyColor: '#aaddff', groundColor: '#e8d68c', intensity: 0.5 },
    particles: { count: 30, color: '#ffffff' },
  },
  decorations: [
    { type: 'palmTree', count: 12, radius: [10, 40], height: [4, 8] },
    { type: 'rock', count: 8, radius: [5, 30], scale: [0.3, 1.0], color: '#8a8070' },
    { type: 'water', y: -0.05, color: '#1a8fbf', opacity: 0.6 },
    { type: 'bird', count: 5, height: [12, 20], speed: 0.3 },
  ],
  props: [
    { model: 'shipwreck.glb', position: [8, 0, -12], scale: 2, rotationY: 0.5 },
  ],
  playerSpawn: { position: [0, 0, 5], rotationY: Math.PI },
};
```
