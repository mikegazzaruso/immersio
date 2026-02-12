/**
 * Keyword dictionaries for AI prompt NLP — Italian + English.
 * Maps natural language words to Immersio decoration types, ObjectFactory methods,
 * environment presets, colors, and size modifiers.
 */

// --- Decoration type mappings (natural language → DecorationRegistry type) ---
export const DECORATION_KEYWORDS = {
  // palmTree
  palme: 'palmTree', palma: 'palmTree', 'palm tree': 'palmTree', 'palm trees': 'palmTree',
  palm: 'palmTree', palms: 'palmTree',
  // tree
  albero: 'tree', alberi: 'tree', tree: 'tree', trees: 'tree',
  // pineTree
  pino: 'pineTree', pini: 'pineTree', 'pine tree': 'pineTree', 'pine trees': 'pineTree',
  pine: 'pineTree', pines: 'pineTree', conifer: 'pineTree', conifers: 'pineTree',
  abete: 'pineTree', abeti: 'pineTree',
  // rock
  roccia: 'rock', rocce: 'rock', sasso: 'rock', sassi: 'rock', scoglio: 'rock', scogli: 'rock',
  rock: 'rock', rocks: 'rock', boulder: 'rock', boulders: 'rock', stone: 'rock', stones: 'rock',
  // water
  acqua: 'water', mare: 'water', oceano: 'water', lago: 'water',
  water: 'water', sea: 'water', ocean: 'water', lake: 'water', pool: 'water', pond: 'water',
  // bird
  uccello: 'bird', uccelli: 'bird', gabbiano: 'bird', gabbiani: 'bird',
  bird: 'bird', birds: 'bird', seagull: 'bird', seagulls: 'bird',
  // stalactite
  stalattite: 'stalactite', stalattiti: 'stalactite',
  stalactite: 'stalactite', stalactites: 'stalactite',
  // mushroom
  fungo: 'mushroom', funghi: 'mushroom',
  mushroom: 'mushroom', mushrooms: 'mushroom',
  // crystal
  cristallo: 'crystal', cristalli: 'crystal',
  crystal: 'crystal', crystals: 'crystal', gem: 'crystal', gems: 'crystal',
  // coral
  corallo: 'coral', coralli: 'coral',
  coral: 'coral', corals: 'coral',
  // vine
  liana: 'vine', liane: 'vine', vite: 'vine', viti: 'vine',
  vine: 'vine', vines: 'vine',
  // lantern
  lanterna: 'lantern', lanterne: 'lantern', luce: 'lantern', luci: 'lantern',
  lantern: 'lantern', lanterns: 'lantern', light: 'lantern', lights: 'lantern', lamp: 'lantern', lamps: 'lantern',
  // column
  colonna: 'column', colonne: 'column', pilastro: 'column', pilastri: 'column',
  column: 'column', columns: 'column', pillar: 'column', pillars: 'column',
  // shells → rock with small scale
  conchiglia: 'rock', conchiglie: 'rock', shell: 'rock', shells: 'rock',
};

// Words that map to "rock" but with small scale override
export const SMALL_SCALE_KEYWORDS = new Set([
  'conchiglia', 'conchiglie', 'shell', 'shells',
]);

// --- ObjectFactory primitive mappings ---
export const PRIMITIVE_KEYWORDS = {
  box: 'box', scatola: 'box', cube: 'box', cubo: 'box', crate: 'box', cassa: 'box',
  sphere: 'sphere', sfera: 'sphere', ball: 'sphere', palla: 'sphere', orb: 'sphere', globo: 'sphere',
  cylinder: 'cylinder', cilindro: 'cylinder', tube: 'cylinder', tubo: 'cylinder',
  cone: 'cone', cono: 'cone',
  pedestal: 'pedestal', piedistallo: 'pedestal',
  lever: 'lever', leva: 'lever',
  pillar: 'pillar', colonnina: 'pillar',
};

// --- Color name → hex mappings ---
export const COLOR_NAMES = {
  // English
  red: '#ff4444', blue: '#4444ff', green: '#44ff44', yellow: '#ffff44',
  orange: '#ff8844', purple: '#aa44ff', violet: '#8844cc', pink: '#ff66aa',
  white: '#ffffff', black: '#222222', gray: '#888888', grey: '#888888',
  brown: '#8B6914', gold: '#ffd700', silver: '#c0c0c0', bronze: '#cd7f32',
  cyan: '#00ccff', teal: '#008888', turquoise: '#00ccaa', magenta: '#ff44ff',
  lime: '#aaff00', navy: '#000066', crimson: '#dc143c', coral: '#ff7f50',
  ivory: '#fffff0', beige: '#f5f5dc', sand: '#e8d68c', copper: '#b87333',
  // Italian
  rosso: '#ff4444', blu: '#4444ff', verde: '#44ff44', giallo: '#ffff44',
  arancione: '#ff8844', viola: '#aa44ff', rosa: '#ff66aa',
  bianco: '#ffffff', nero: '#222222', grigio: '#888888',
  marrone: '#8B6914', oro: '#ffd700', argento: '#c0c0c0',
  azzurro: '#00ccff', turchese: '#00ccaa',
};

// --- Size modifiers → scale multiplier ---
export const SIZE_MODIFIERS = {
  // English
  tiny: 0.3, small: 0.5, little: 0.5, mini: 0.4,
  big: 2.0, large: 2.0, huge: 3.0, giant: 3.5, massive: 4.0, enormous: 4.0,
  medium: 1.0, normal: 1.0,
  tall: 1.8, short: 0.6,
  // Italian
  piccolo: 0.5, piccola: 0.5, piccoli: 0.5, piccole: 0.5,
  grande: 2.0, grandi: 2.0, enorme: 3.0, enormi: 3.0,
  gigante: 3.5, gigantesco: 4.0, minuscolo: 0.3, minuscola: 0.3,
  alto: 1.8, alta: 1.8, basso: 0.6, bassa: 0.6,
};

// --- Count words ---
export const COUNT_WORDS = {
  // English
  a: 1, one: 1, single: 1,
  two: 2, couple: 2, pair: 2,
  three: 3, few: 3, some: 4,
  four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  many: 8, several: 5, lots: 10, dozen: 12,
  // Italian
  un: 1, uno: 1, una: 1,
  due: 2, tre: 3, quattro: 4, cinque: 5,
  sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10,
  pochi: 3, poche: 3, alcuni: 4, alcune: 4,
  molti: 8, molte: 8, tanti: 10, tante: 10,
};

// --- Environment preset keywords ---
export const ENVIRONMENT_PRESETS = {
  // Beach / Tropical
  beach: 'beach', spiaggia: 'beach', tropical: 'beach', tropicale: 'beach',
  // Forest
  forest: 'forest', foresta: 'forest', woods: 'forest', bosco: 'forest', woodland: 'forest',
  // Cave
  cave: 'cave', caverna: 'cave', grotta: 'cave', underground: 'cave', sotterraneo: 'cave',
  dungeon: 'cave',
  // Snow / Winter
  snow: 'snow', neve: 'snow', winter: 'snow', inverno: 'snow', ice: 'snow', ghiaccio: 'snow',
  arctic: 'snow', frozen: 'snow',
  // Night
  night: 'night', notte: 'night', dark: 'night', buio: 'night', midnight: 'night',
  // Desert
  desert: 'desert', deserto: 'desert', dunes: 'desert', dune: 'desert', arid: 'desert',
  // Underwater
  underwater: 'underwater', sottomarino: 'underwater', subacqueo: 'underwater', ocean_floor: 'underwater',
  // Steampunk / Industrial
  steampunk: 'steampunk', industrial: 'steampunk', industriale: 'steampunk',
  // Space / Futuristic
  space: 'space', spazio: 'space', futuristic: 'space', futuristico: 'space',
  scifi: 'space', 'sci-fi': 'space',
  // Temple / Sacred
  temple: 'temple', tempio: 'temple', sacred: 'temple', sacro: 'temple', shrine: 'temple',
  // Garden
  garden: 'garden', giardino: 'garden',
};

// --- Environment preset configurations ---
export const ENVIRONMENT_CONFIGS = {
  beach: {
    sky: { topColor: '#0066cc', bottomColor: '#aaddff' },
    ground: { radius: 50, color: '#e8d68c' },
    fog: { color: '#aaddff', density: 0.012 },
    directional: { color: '#fff5e0', intensity: 1.2, position: [15, 25, 10] },
    hemisphere: { skyColor: '#aaddff', groundColor: '#e8d68c', intensity: 0.5 },
    particles: { count: 30, color: '#ffffff' },
    _decorations: [
      { type: 'palmTree', count: 12, radius: [10, 40], height: [4, 8] },
      { type: 'rock', count: 8, radius: [5, 30], scale: [0.3, 1.0], color: '#8a8070' },
      { type: 'water', y: -0.05, color: '#1a8fbf', opacity: 0.6 },
      { type: 'bird', count: 5, height: [12, 20], speed: 0.3 },
    ],
  },
  forest: {
    sky: { topColor: '#336699', bottomColor: '#99bb88' },
    ground: { radius: 50, color: '#557744' },
    fog: { color: '#88aa77', density: 0.02 },
    directional: { color: '#fffde0', intensity: 0.8, position: [10, 20, 10] },
    hemisphere: { skyColor: '#99bb88', groundColor: '#445533', intensity: 0.6 },
    particles: { count: 40, color: '#aaccaa' },
    _decorations: [
      { type: 'tree', count: 15, radius: [6, 35], height: [3, 7] },
      { type: 'rock', count: 10, radius: [5, 30], scale: [0.3, 0.8] },
      { type: 'mushroom', count: 8, radius: [4, 20] },
      { type: 'bird', count: 4, height: [8, 16] },
    ],
  },
  cave: {
    enclosure: {
      width: 30, depth: 30, height: 8,
      wallColor: '#333333', ceilingColor: '#222222', floorColor: '#444444',
      emissive: '#112233', emissiveIntensity: 0.1,
    },
    fog: { color: '#111111', density: 0.03 },
    hemisphere: { skyColor: '#333344', groundColor: '#222222', intensity: 0.4 },
    pointLights: [
      { color: '#ffaa44', intensity: 2.0, distance: 20, position: [0, 7, 0], visible: true },
    ],
    particles: { count: 40, color: '#aaccff' },
    _decorations: [
      { type: 'stalactite', count: 15, length: [0.5, 2.0], color: '#666655' },
      { type: 'crystal', count: 8, radius: [4, 14], color: '#8844cc', glowIntensity: 0.8 },
      { type: 'mushroom', count: 6, radius: [3, 12], glowColor: '#ff6644' },
      { type: 'rock', count: 10, radius: [3, 14], scale: [0.2, 0.8] },
    ],
  },
  snow: {
    sky: { topColor: '#667799', bottomColor: '#ccddee' },
    ground: { radius: 50, color: '#eeeeff' },
    fog: { color: '#ccddee', density: 0.015 },
    directional: { color: '#ddeeff', intensity: 0.9, position: [10, 15, 10] },
    hemisphere: { skyColor: '#ccddee', groundColor: '#aabbcc', intensity: 0.5 },
    particles: { count: 80, color: '#ffffff' },
    _decorations: [
      { type: 'pineTree', count: 12, radius: [8, 35], color: '#1a4d2e' },
      { type: 'rock', count: 8, radius: [5, 30], color: '#999999' },
    ],
  },
  night: {
    sky: { topColor: '#000022', bottomColor: '#112244' },
    ground: { radius: 50, color: '#223322' },
    fog: { color: '#112233', density: 0.02 },
    directional: { color: '#6688bb', intensity: 0.3, position: [5, 15, 10] },
    hemisphere: { skyColor: '#223344', groundColor: '#111122', intensity: 0.3 },
    ambient: { color: '#334455', intensity: 0.2 },
    particles: { count: 50, color: '#aabbff' },
    _decorations: [
      { type: 'lantern', count: 8, height: [2, 5], color: '#ffaa44', radius: [4, 18] },
      { type: 'tree', count: 8, radius: [8, 30] },
      { type: 'mushroom', count: 5, radius: [4, 15], glowColor: '#44ffaa' },
    ],
  },
  desert: {
    sky: { topColor: '#4488cc', bottomColor: '#eeddbb' },
    ground: { radius: 60, color: '#d4a960' },
    fog: { color: '#eeddbb', density: 0.008 },
    directional: { color: '#ffffcc', intensity: 1.5, position: [15, 30, 10] },
    hemisphere: { skyColor: '#eeddbb', groundColor: '#c49a40', intensity: 0.6 },
    particles: { count: 20, color: '#ddcc99' },
    _decorations: [
      { type: 'rock', count: 12, radius: [8, 40], scale: [0.5, 2.0], color: '#c49a40' },
    ],
  },
  underwater: {
    sky: { topColor: '#003355', bottomColor: '#006688' },
    ground: { radius: 40, color: '#445566' },
    fog: { color: '#004466', density: 0.025 },
    directional: { color: '#66aacc', intensity: 0.5, position: [0, 20, 0] },
    hemisphere: { skyColor: '#006688', groundColor: '#334455', intensity: 0.4 },
    particles: { count: 60, color: '#88ccff' },
    _decorations: [
      { type: 'coral', count: 12, radius: [4, 20], color: '#e85d75' },
      { type: 'crystal', count: 6, radius: [5, 18], color: '#44aacc' },
      { type: 'rock', count: 8, radius: [4, 20], color: '#556677' },
    ],
  },
  steampunk: {
    enclosure: {
      width: 30, depth: 30, height: 10,
      wallColor: '#5a3a22', ceilingColor: '#3a2818', floorColor: '#6a4a2e',
      emissive: '#331a00', emissiveIntensity: 0.3, trimColor: '#ffaa44',
    },
    fog: { color: '#1a1008', density: 0.01 },
    hemisphere: { skyColor: '#886644', groundColor: '#553322', intensity: 1.0 },
    pointLights: [
      { color: '#ffcc77', intensity: 4.0, distance: 30, position: [0, 9, 0], visible: true },
      { color: '#ffaa44', intensity: 3.0, distance: 20, position: [10, 6, 10], visible: true },
      { color: '#ffaa44', intensity: 3.0, distance: 20, position: [-10, 6, -10], visible: true },
    ],
    particles: { count: 80, color: '#ffcc66' },
    _decorations: [
      { type: 'column', count: 8, radius: [6, 14], color: '#8B6914' },
      { type: 'lantern', count: 10, height: [2, 8], color: '#ffaa44', radius: [4, 14] },
      { type: 'crystal', count: 4, radius: [5, 12], color: '#00ccaa', glowIntensity: 0.6 },
    ],
  },
  space: {
    enclosure: {
      width: 40, depth: 40, height: 12,
      wallColor: '#1a1a2e', ceilingColor: '#111122', floorColor: '#222233',
      emissive: '#0022aa', emissiveIntensity: 0.15, trimColor: '#00aaff',
    },
    fog: { color: '#0a0a1e', density: 0.015 },
    hemisphere: { skyColor: '#222244', groundColor: '#111122', intensity: 0.4 },
    pointLights: [
      { color: '#4488ff', intensity: 3.0, distance: 30, position: [0, 11, 0], visible: true },
    ],
    particles: { count: 100, color: '#4488ff' },
    _decorations: [
      { type: 'column', count: 6, radius: [6, 16], color: '#444466' },
      { type: 'crystal', count: 8, radius: [5, 18], color: '#4488ff', glowIntensity: 0.8 },
      { type: 'lantern', count: 6, height: [3, 8], color: '#4488ff', radius: [5, 16] },
    ],
  },
  temple: {
    enclosure: {
      width: 30, depth: 30, height: 10,
      wallColor: '#887766', ceilingColor: '#776655', floorColor: '#998877',
      emissive: '#221100', emissiveIntensity: 0.1,
    },
    fog: { color: '#665544', density: 0.012 },
    hemisphere: { skyColor: '#998877', groundColor: '#665544', intensity: 0.6 },
    pointLights: [
      { color: '#ffddaa', intensity: 3.0, distance: 25, position: [0, 9, 0], visible: true },
    ],
    particles: { count: 40, color: '#ffddcc' },
    _decorations: [
      { type: 'column', count: 8, radius: [5, 13], color: '#998877' },
      { type: 'crystal', count: 4, radius: [4, 10], color: '#ffaa44', glowIntensity: 0.5 },
      { type: 'lantern', count: 6, height: [2, 6], color: '#ffcc77', radius: [4, 12] },
      { type: 'vine', count: 8, length: [1.0, 2.5], color: '#2d5a1e' },
    ],
  },
  garden: {
    sky: { topColor: '#4488cc', bottomColor: '#aaddcc' },
    ground: { radius: 40, color: '#558844' },
    fog: { color: '#aaddcc', density: 0.01 },
    directional: { color: '#fffde0', intensity: 1.0, position: [10, 20, 10] },
    hemisphere: { skyColor: '#aaddcc', groundColor: '#558844', intensity: 0.6 },
    particles: { count: 30, color: '#ffffff' },
    _decorations: [
      { type: 'tree', count: 10, radius: [6, 25], height: [3, 6] },
      { type: 'rock', count: 6, radius: [5, 20], scale: [0.2, 0.6] },
      { type: 'bird', count: 4, height: [8, 14] },
      { type: 'lantern', count: 4, height: [1.5, 3], color: '#ffcc77', radius: [3, 12] },
    ],
  },
};

// --- Mood/lighting modifier keywords ---
export const MOOD_MODIFIERS = {
  // Warm
  sunny: 'warm', bright: 'warm', warm: 'warm', soleggiato: 'warm', luminoso: 'warm', caldo: 'warm',
  // Cold
  cold: 'cold', cool: 'cold', icy: 'cold', freddo: 'cold', gelido: 'cold',
  // Dark
  dark: 'dark', dim: 'dark', gloomy: 'dark', scuro: 'dark', cupo: 'dark',
  // Foggy
  foggy: 'foggy', misty: 'foggy', hazy: 'foggy', nebbioso: 'foggy', brumoso: 'foggy',
};

// Mood → environment overrides
export const MOOD_OVERRIDES = {
  warm: {
    directional: { color: '#ffffcc', intensity: 1.3 },
    hemisphere: { skyColor: '#ffeecc' },
  },
  cold: {
    directional: { color: '#ccddff', intensity: 0.7 },
    hemisphere: { skyColor: '#ccddff', groundColor: '#aabbcc' },
    fog: { color: '#ccddee' },
  },
  dark: {
    directional: { intensity: 0.3 },
    hemisphere: { intensity: 0.3 },
    ambient: { intensity: 0.15 },
    fog: { density: 0.03 },
  },
  foggy: {
    fog: { density: 0.04 },
    directional: { intensity: 0.5 },
  },
};
