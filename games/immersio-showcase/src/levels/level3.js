export default {
  id: 3,
  name: 'Twilight Garden',
  environment: {
    background: '#2a1a3a',
    sky: {
      topColor: '#1a0a2e',
      bottomColor: '#cc6633',
      offset: 10,
      exponent: 0.8,
    },
    ground: {
      radius: 50,
      color: '#446633',
    },
    fog: {
      color: '#2a1a3a',
      density: 0.018,
    },
    directional: {
      color: '#ffaa66',
      intensity: 0.6,
      position: [-10, 8, 15],
    },
    hemisphere: {
      skyColor: '#553366',
      groundColor: '#334422',
      intensity: 0.4,
    },
    ambient: {
      color: '#ffffff',
      intensity: 0.2,
    },
    particles: {
      count: 80,
      color: '#ffdd88',
    },
  },
  decorations: [
    { type: 'tree', count: 12, radius: [10, 35], height: [3, 6], canopyColor: '#2d5a3e' },
    { type: 'lantern', count: 10, height: [2, 5], color: '#ffaa44', radius: [4, 20] },
    { type: 'rock', count: 8, radius: [6, 30], scale: [0.3, 0.8], color: '#6a6a5a' },
    { type: 'bird', count: 4, height: [10, 16], speed: 0.25, color: '#222222' },
    { type: 'mushroom', count: 6, radius: [5, 18], color: '#aa66cc', glowColor: '#bb88dd' },
  ],
  props: [],
  playerSpawn: {
    position: [0, 0, 12],
    rotationY: Math.PI,
  },
};
