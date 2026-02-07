export default {
  id: 1,
  name: 'Coral Shores',
  environment: {
    background: '#ffddaa',
    sky: {
      topColor: '#0066cc',
      bottomColor: '#ffddaa',
      offset: 20,
      exponent: 0.6,
    },
    ground: {
      radius: 50,
      color: '#e8d68c',
    },
    fog: {
      color: '#ffddaa',
      density: 0.012,
    },
    directional: {
      color: '#fff5e0',
      intensity: 1.2,
      position: [15, 25, 10],
    },
    hemisphere: {
      skyColor: '#ffddaa',
      groundColor: '#e8d68c',
      intensity: 0.5,
    },
    ambient: {
      color: '#ffffff',
      intensity: 0.3,
    },
    particles: {
      count: 30,
      color: '#ffffff',
    },
  },
  decorations: [
    { type: 'palmTree', count: 14, radius: [10, 40], height: [4, 8] },
    { type: 'rock', count: 10, radius: [5, 35], scale: [0.3, 1.0], color: '#8a8070' },
    { type: 'water', y: -0.05, color: '#1a8fbf', opacity: 0.6 },
    { type: 'bird', count: 6, height: [12, 20], speed: 0.3 },
    { type: 'coral', count: 10, radius: [6, 25], color: '#e85d75' },
  ],
  props: [],
  playerSpawn: {
    position: [0, 0, 12],
    rotationY: Math.PI,
  },
  exit: {
    position: [0, 0, -18],
    targetLevel: 2,
    label: 'Enter the Crystal Cavern',
    color: '#8844cc',
  },
};
