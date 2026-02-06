export default {
  id: 1,
  name: 'The Floating Island',
  environment: {
    background: '#1a0a2e',
    sky: {
      topColor: '#0a0033',
      bottomColor: '#ff8844',
      offset: 20,
      exponent: 0.8,
    },
    ground: {
      radius: 50,
      color: '#e8d68c',
    },
    fog: {
      color: '#ff8844',
      density: 0.012,
    },
    directional: {
      color: '#ffddaa',
      intensity: 1.2,
      position: [15, 20, 10],
    },
    hemisphere: {
      skyColor: '#ff8844',
      groundColor: '#e8d68c',
      intensity: 0.6,
    },
    ambient: {
      color: '#ffffff',
      intensity: 0.3,
    },
    particles: {
      count: 80,
      color: '#ffddaa',
    },
  },
  decorations: [
    { type: 'palmTree', count: 14, radius: [12, 40], height: [4, 8], leafColor: '#2d8a3e' },
    { type: 'rock', count: 10, radius: [8, 35], scale: [0.3, 1.0], color: '#8a8070' },
    { type: 'water', y: -0.05, color: '#1a8fbf', opacity: 0.6, size: 400 },
    { type: 'bird', count: 6, height: [12, 22], speed: 0.3, color: '#ffffff' },
    { type: 'lantern', count: 8, height: [3, 6], color: '#ffcc66', radius: [5, 18] },
  ],
  props: [],
  playerSpawn: {
    position: [0, 0, 10],
    rotationY: Math.PI,
  },
};
