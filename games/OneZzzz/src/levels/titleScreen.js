export default {
  id: 0,
  name: 'Title Screen',
  environment: {
    sky: { topColor: '#050814', bottomColor: '#1a0b2e', offset: 0, exponent: 0.85 },
    ground: { radius: 60, color: '#07070c' },
    fog: { color: '#0b0a14', density: 0.012 },
    directional: { color: '#8aa6ff', intensity: 1.15, position: [12, 22, 8] },
    hemisphere: { skyColor: '#2b3cff', groundColor: '#120818', intensity: 0.65 },
    ambient: { color: '#1a1230', intensity: 0.28 },
    pointLights: [
      { color: '#5a7dff', intensity: 3.2, distance: 28, position: [0, 4.2, -6.5] },
      { color: '#ff4fd8', intensity: 2.4, distance: 22, position: [-6, 2.2, -4] },
      { color: '#00e5ff', intensity: 2.2, distance: 26, position: [7, 3.2, -9] },
      { color: '#ffffff', intensity: 1.4, distance: 18, position: [0, 1.2, -3.5] },
    ],
  },
  decorations: [
    { name: 'glow motes', count: 18, radius: [2.5, 16], geometry: 'SphereGeometry', args: [0.08, 8, 6], material: { color: '#cfe3ff', emissive: '#6aa7ff', emissiveIntensity: 0.9, transparent: true, opacity: 0.85, roughness: 0.2 }, scaleRange: [0.7, 1.6] },
    { name: 'floating neon rings', count: 10, radius: [4, 14], geometry: 'TorusGeometry', args: [0.7, 0.08, 10, 24], material: { color: '#1b0f2a', emissive: '#ff4fd8', emissiveIntensity: 0.85, metalness: 0.6, roughness: 0.25 }, scaleRange: [0.9, 1.5] },
    { name: 'monolith pillars', count: 8, radius: [10, 18], parts: [{ name: 'shaft', geometry: 'BoxGeometry', args: [1.1, 7.5, 1.1], material: { color: '#0b0b12', metalness: 0.25, roughness: 0.85 }, position: [0, 3.75, 0] }, { name: 'edge glow', geometry: 'BoxGeometry', args: [1.16, 7.6, 1.16], material: { color: '#0b0b12', emissive: '#5a7dff', emissiveIntensity: 0.25, transparent: true, opacity: 0.55 }, position: [0, 3.8, 0] }, { name: 'base', geometry: 'BoxGeometry', args: [1.8, 0.35, 1.8], material: { color: '#0a0a10', metalness: 0.15, roughness: 0.9 }, position: [0, 0.175, 0] }] },
    { name: 'horizon shards', count: 12, radius: [12, 22], geometry: 'OctahedronGeometry', args: [0.55], material: { color: '#0f1020', emissive: '#00e5ff', emissiveIntensity: 0.35, metalness: 0.75, roughness: 0.3, transparent: true, opacity: 0.75 }, scaleRange: [0.7, 1.8] },
  ],
  title: { text: 'Game One', subtitle: 'START GAME', color: '#ffffff', emissiveColor: '#6aa7ff', position: [0, 3.2, -6.2], fontSize: 112, subtitleFontSize: 64, scale: [7.2, 1.8, 1], subtitleScale: [6.2, 0.95, 1], startPromptFontSize: 34, startPromptScale: [4.2, 0.55, 1] },
  startPrompt: 'Premi il grilletto o clicca per iniziare',
};
