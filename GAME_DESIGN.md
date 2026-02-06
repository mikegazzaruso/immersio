# Game Design: IAmers VR Showcase

## Concept
A VR showcase experience designed for the IAmers AI community, demonstrating the full capabilities of the Three.js + WebXR game framework. Players explore three distinct environments -- a vibrant floating island, a futuristic AI laboratory, and a mystical crystal cavern -- each featuring a unique puzzle mechanic. The game serves as both an interactive demo and a template for what AI-assisted game development can produce.

## Assumptions
- 3 levels, each showcasing a different environment type and puzzle pattern
- Exploration-focused with moderate pacing (move speed 4.0)
- Vibrant, stylized art direction to maximize visual impact
- Each level demonstrates different decoration types and lighting setups
- All three canonical mechanic patterns are represented (collect-and-place, sequence, trigger-animation)
- No external GLB models required -- fully procedural geometry
- Desktop and VR modes both fully supported

## Levels
1. **Level 1: The Floating Island** -- A lush outdoor environment with palm trees, rocks, water, birds, and floating lanterns. Warm tropical atmosphere with golden sunlight. Demonstrates outdoor sky shader, ground plane, and ambient particles. Puzzle: collect 3 AI data crystals and place them on pedestals.

2. **Level 2: The AI Laboratory** -- A futuristic indoor room with glowing trim, crystal decorations, columns, and ambient particles. Cool blue-purple neon lighting with a high-tech mood. Demonstrates enclosure system, point lights, spot lights, and trim strips. Puzzle: activate 5 neural network nodes in the correct sequence.

3. **Level 3: The Crystal Cavern** -- A mystical underground cave with stalactites, glowing mushrooms, crystal clusters, and vines. Deep emerald and purple atmosphere with warm lantern accents. Demonstrates indoor environment with natural decorations. Puzzle: pull a lever to raise a crystal bridge and reach the final platform.

## Mechanics
1. **Crystal Collection** -- Pattern: collect-and-place. Player finds 3 glowing AI data crystals scattered around the floating island and places them on matching colored pedestals at the center. Demonstrates grab interaction and proximity-based snap placement.

2. **Neural Sequence** -- Pattern: activate-in-order. Player must activate 5 rune stones (styled as neural network nodes) in the correct order. Wrong order flashes red and resets. Correct sequence lights up nodes green progressively. Demonstrates trigger interaction and sequence tracking.

3. **Bridge Activation** -- Pattern: trigger-animation. Player pulls a lever to raise a crystal bridge segment by segment with staggered animation. Bridge gets collision boxes after completion, allowing the player to walk across. Demonstrates lever interaction and environmental animation.

## Art Direction
- **Level 1**: Warm palette -- golden sand (#e8d68c), turquoise water (#1a8fbf), lush greens (#2d8a3e), sunset sky gradient (deep blue to warm peach)
- **Level 2**: Cool neon palette -- dark walls (#1a1a2e), cyan trim (#00ccff), purple crystals (#8844cc), blue ambient particles
- **Level 3**: Deep natural palette -- dark stone (#333322), emerald greens (#1a5a2e), warm amber lanterns (#ffaa44), purple crystal glow (#9933ff)
- Decoration density: medium-high for visual richness
- Particles in every level for atmospheric depth
- No shadows (fake shadow circles for performance)
