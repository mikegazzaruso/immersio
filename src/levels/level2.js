export default {
  id: 2,
  name: 'The AI Laboratory',
  environment: {
    enclosure: {
      width: 24,
      depth: 24,
      height: 5,
      wallColor: '#1a1a2e',
      ceilingColor: '#0d0d1a',
      floorColor: '#222233',
      emissive: '#112244',
      emissiveIntensity: 0.15,
      trimColor: '#00ccff',
    },
    fog: {
      color: '#0a0a1a',
      density: 0.025,
    },
    hemisphere: {
      skyColor: '#334466',
      groundColor: '#111122',
      intensity: 0.4,
    },
    pointLights: [
      { color: '#00ccff', intensity: 2.5, distance: 20, position: [0, 4.5, 0], visible: true },
      { color: '#8844cc', intensity: 1.5, distance: 15, position: [-8, 3, -8], visible: true },
      { color: '#8844cc', intensity: 1.5, distance: 15, position: [8, 3, 8], visible: true },
      { color: '#00ccff', intensity: 1.0, distance: 12, position: [8, 3, -8], visible: true },
      { color: '#00ccff', intensity: 1.0, distance: 12, position: [-8, 3, 8], visible: true },
    ],
    spotLights: [
      { color: '#ffffff', intensity: 3.0, distance: 15, angle: Math.PI / 8, penumbra: 0.6, position: [0, 4.8, 0], target: [0, 0, 0] },
    ],
    particles: {
      count: 60,
      color: '#4488ff',
    },
  },
  decorations: [
    { type: 'column', count: 8, radius: [6, 10], color: '#333344' },
    { type: 'crystal', count: 8, radius: [3, 9], color: '#4488ff', glowIntensity: 0.8 },
    { type: 'lantern', count: 4, height: [2, 4], color: '#00ccff', radius: [4, 8] },
  ],
  props: [],
  playerSpawn: {
    position: [0, 0, 10],
    rotationY: Math.PI,
  },
};
