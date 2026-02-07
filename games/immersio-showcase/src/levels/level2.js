export default {
  id: 2,
  name: 'Crystal Cavern',
  environment: {
    enclosure: {
      width: 24,
      depth: 24,
      height: 6,
      wallColor: '#333344',
      ceilingColor: '#222233',
      floorColor: '#3a3a4a',
      emissive: '#112244',
      emissiveIntensity: 0.08,
      trimColor: '#4488cc',
    },
    fog: {
      color: '#111122',
      density: 0.035,
    },
    hemisphere: {
      skyColor: '#333355',
      groundColor: '#222233',
      intensity: 0.3,
    },
    pointLights: [
      { color: '#8866cc', intensity: 2.0, distance: 20, position: [0, 5.5, 0], visible: true },
      { color: '#4488cc', intensity: 1.5, distance: 15, position: [-6, 4, -6], visible: true },
      { color: '#4488cc', intensity: 1.5, distance: 15, position: [6, 4, 6], visible: true },
    ],
    particles: {
      count: 50,
      color: '#aaccff',
    },
  },
  decorations: [
    { type: 'stalactite', count: 20, length: [0.5, 2.5], color: '#555566' },
    { type: 'crystal', count: 10, radius: [4, 10], color: '#8844cc', glowIntensity: 0.8 },
    { type: 'mushroom', count: 12, radius: [3, 10], color: '#c84b31', glowColor: '#ff6644' },
    { type: 'vine', count: 8, length: [1.0, 3.5], color: '#2d5a3e' },
    { type: 'rock', count: 6, radius: [3, 9], scale: [0.2, 0.6], color: '#555566' },
  ],
  props: [],
  playerSpawn: {
    position: [0, 0, 9],
    rotationY: Math.PI,
  },
  exit: {
    position: [0, 0, -9],
    targetLevel: 3,
    label: 'Enter the Twilight Garden',
    color: '#44ff88',
  },
};
