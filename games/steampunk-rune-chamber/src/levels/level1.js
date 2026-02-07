export default {
  id: 1,
  name: 'The Rune Chamber',
  environment: {
    enclosure: {
      width: 40,
      depth: 40,
      height: 16,
      wallColor: '#5a3a22',
      ceilingColor: '#3a2818',
      floorColor: '#6a4a2e',
      emissive: '#331a00',
      emissiveIntensity: 0.4,
      trimColor: '#00ffcc',
    },
    fog: {
      color: '#1a1008',
      density: 0.006,
    },
    hemisphere: {
      skyColor: '#886644',
      groundColor: '#553322',
      intensity: 1.2,
    },
    ambient: {
      color: '#ffeedd',
      intensity: 0.6,
    },
    pointLights: [
      // Main overhead warm light
      { color: '#ffcc77', intensity: 5.0, distance: 35, position: [0, 15, 0], visible: true },
      // Four corner warm lights
      { color: '#ffaa44', intensity: 4.0, distance: 22, position: [14, 10, 14], visible: true },
      { color: '#ffaa44', intensity: 4.0, distance: 22, position: [-14, 10, -14], visible: true },
      { color: '#ffaa44', intensity: 4.0, distance: 22, position: [14, 10, -14], visible: true },
      { color: '#ffaa44', intensity: 4.0, distance: 22, position: [-14, 10, 14], visible: true },
      // Cyan rune accent lights along walls
      { color: '#00ffcc', intensity: 3.5, distance: 14, position: [0, 2, -18], visible: true },
      { color: '#00ffcc', intensity: 3.5, distance: 14, position: [-18, 2, 0], visible: true },
      { color: '#00ffcc', intensity: 3.5, distance: 14, position: [18, 2, 0], visible: true },
      { color: '#00ffcc', intensity: 3.5, distance: 14, position: [0, 2, 18], visible: true },
      // Mid-height amber fill lights
      { color: '#ffdd88', intensity: 2.5, distance: 16, position: [8, 6, 8], visible: true },
      { color: '#ffdd88', intensity: 2.5, distance: 16, position: [-8, 6, -8], visible: true },
    ],
    particles: {
      count: 150,
      color: '#ffcc66',
    },
  },
  decorations: [
    { type: 'crystal', count: 8, radius: [8, 18], color: '#00ccaa', glowIntensity: 0.8 },
    { type: 'lantern', count: 10, height: [3, 10], color: '#ffaa44', radius: [5, 18] },
    { type: 'column', count: 8, radius: [10, 17], color: '#8B6914' },
    { type: 'mushroom', count: 6, radius: [6, 16], color: '#8B6914', glowColor: '#ffaa44' },
    { type: 'stalactite', count: 12, length: [0.5, 2.5], color: '#5a4020' },
  ],
  props: [],
  playerSpawn: {
    position: [0, 0, 15],
    rotationY: 0,
  },
};
