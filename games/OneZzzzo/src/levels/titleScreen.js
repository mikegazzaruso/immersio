export default {
  id: 0,
  name: 'Title Screen',
  environment: {
    sky: { topColor: '#050814', bottomColor: '#1a0b2e', offset: 0, exponent: 0.85 },
    ground: { radius: 60, color: '#070a12' },
    fog: { color: '#0b0a16', density: 0.018 },
    directional: { color: '#b7c7ff', intensity: 1.15, position: [12, 22, 8] },
    hemisphere: { skyColor: '#2a3a7a', groundColor: '#120818', intensity: 0.65 },
    ambient: { color: '#0b1022', intensity: 0.28 },
    pointLights: [
      { color: '#6a7dff', intensity: 3.2, distance: 30, position: [0, 6, -10] },
      { color: '#ff3bd4', intensity: 2.4, distance: 22, position: [-8, 3, -6] },
      { color: '#2ff3ff', intensity: 2.2, distance: 24, position: [9, 4, -7] },
      { color: '#ffd36a', intensity: 1.3, distance: 18, position: [0, 1.2, -3] },
    ],
  },
  decorations: [
    { name: 'glow particles', count: 18, radius: [2.5, 16], geometry: 'SphereGeometry', args: [0.08, 8, 6], material: { color: '#cfe3ff', emissive: '#6aa8ff', emissiveIntensity: 0.95, transparent: true, opacity: 0.85 }, scaleRange: [0.6, 1.6] },
    { name: 'floating neon rings', count: 10, radius: [4, 14], geometry: 'TorusGeometry', args: [0.9, 0.08, 10, 32], material: { color: '#1a1b2a', emissive: '#ff3bd4', emissiveIntensity: 0.75, metalness: 0.6, roughness: 0.25 }, scaleRange: [0.8, 1.4] },
    { name: 'monolith pillars', count: 8, radius: [10, 18], parts: [{ name: 'column', geometry: 'CylinderGeometry', args: [0.45, 0.6, 7.5, 10], material: { color: '#0b0d16', emissive: '#2ff3ff', emissiveIntensity: 0.18, metalness: 0.35, roughness: 0.55 }, position: [0, 3.75, 0] }, { name: 'cap', geometry: 'BoxGeometry', args: [1.25, 0.35, 1.25], material: { color: '#0a0b12', emissive: '#6a7dff', emissiveIntensity: 0.22, metalness: 0.25, roughness: 0.6 }, position: [0, 7.7, 0] }, { name: 'base', geometry: 'BoxGeometry', args: [1.45, 0.35, 1.45], material: { color: '#070812', emissive: '#ff3bd4', emissiveIntensity: 0.12, metalness: 0.2, roughness: 0.7 }, position: [0, 0.18, 0] }] },
    { name: 'horizon shards', count: 12, radius: [8, 20], geometry: 'IcosahedronGeometry', args: [0.55], material: { color: '#0c0f1f', emissive: '#6a7dff', emissiveIntensity: 0.35, metalness: 0.75, roughness: 0.25, transparent: true, opacity: 0.9 }, scaleRange: [0.7, 1.8] },
  ],
  title: { text: 'Test 1', subtitle: 'START GAME', color: '#ffffff', emissiveColor: '#6a7dff', position: [0, 3.2, -6.2], fontSize: 110, subtitleFontSize: 92, scale: [7.2, 1.8, 1], subtitleScale: [7.6, 1.35, 1], startPromptFontSize: 30, startPromptScale: [3.2, 0.45, 1] },
  startPrompt: 'Premi il grilletto / clicca per iniziare',
};
