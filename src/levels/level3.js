export default {
  id: 3,
  name: 'The Crystal Cavern',
  environment: {
    enclosure: {
      width: 36,
      depth: 36,
      height: 8,
      wallColor: '#2a1a0a',
      ceilingColor: '#1a0f05',
      floorColor: '#3a2a1a',
      emissive: '#1a0a00',
      emissiveIntensity: 0.05,
    },
    fog: {
      color: '#0a0805',
      density: 0.018,
    },
    hemisphere: {
      skyColor: '#1a3322',
      groundColor: '#110d05',
      intensity: 0.25,
    },
    pointLights: [
      { color: '#22cc55', intensity: 1.0, distance: 20, position: [0, 6, 0], visible: true },
      { color: '#9933ff', intensity: 2.5, distance: 12, position: [-8, 1.5, -8], visible: true },
      { color: '#9933ff', intensity: 2.5, distance: 12, position: [8, 1.5, 8], visible: true },
      { color: '#ff6622', intensity: 1.8, distance: 10, position: [10, 2, -6], visible: true },
      { color: '#ff6622', intensity: 1.8, distance: 10, position: [-10, 2, 6], visible: true },
      { color: '#44ff88', intensity: 1.5, distance: 8, position: [0, 0.3, -10], visible: true },
      { color: '#44ff88', intensity: 1.5, distance: 8, position: [5, 0.3, 8], visible: true },
    ],
    ambient: {
      color: '#221a0a',
      intensity: 0.15,
    },
    particles: {
      count: 80,
      color: '#88ff88',
    },
  },
  decorations: [
    { type: 'stalactite', count: 30, length: [0.8, 3.5], color: '#665544' },
    { type: 'mushroom', count: 20, radius: [2, 14], color: '#22aa55', glowColor: '#44ff88' },
    { type: 'crystal', count: 14, radius: [3, 14], color: '#9933ff', glowIntensity: 1.2 },
    { type: 'vine', count: 18, length: [2.0, 6.0], color: '#1a5a2e' },
    { type: 'lantern', count: 8, height: [1.5, 3.5], color: '#ff6622', radius: [4, 14] },
    { type: 'rock', count: 14, radius: [4, 14], scale: [0.4, 1.2], color: '#554433' },
    { type: 'water', y: -0.02, color: '#115533', opacity: 0.4, size: 36 },
  ],
  props: [],
  playerSpawn: {
    position: [0, 0, 14],
    rotationY: Math.PI,
  },
};
