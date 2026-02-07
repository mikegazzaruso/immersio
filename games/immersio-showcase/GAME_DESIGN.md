# Game Design: Immersio Showcase

## Concept
A demonstration game that showcases every major capability of the Immersio framework across three distinct levels. Each level features a unique environment type (outdoor, indoor, outdoor), a different visual theme, and one of the three canonical puzzle patterns. The player progresses linearly through the levels, solving each puzzle to unlock the next, traversing portal transitions between environments. The game demonstrates procedural decorations, ambient audio, HUD notifications, VR hand interaction, desktop fallback controls, collision, and level transitions.

## Assumptions
- 3 levels with linear progression via portal transitions
- 3 mechanics (one per level), each demonstrating a different canonical puzzle pattern
- Exploration-focused pace (move speed 4.0)
- No external GLB models required (all geometry is procedural via ObjectFactory and decorations)
- Linear puzzle chain (solve puzzle in level 1 to find the portal to level 2, etc.)

## Levels
1. **Level 1: Coral Shores** -- A tropical beach at golden hour. Palm trees line the sandy shore, ocean water stretches to the horizon, seagulls circle overhead, and colorful rocks dot the landscape. The collect-and-place puzzle challenges the player to find three scattered crystals and place them on pedestals near the center.
2. **Level 2: Crystal Cavern** -- A mysterious underground cave with glowing stalactites, bioluminescent mushrooms, crystal clusters casting colored light, and hanging vines. The activate-in-order puzzle requires the player to activate five rune stones in the correct sequence, guided by subtle visual cues.
3. **Level 3: Twilight Garden** -- A serene garden at dusk with deciduous trees, floating lanterns, gentle rock formations, and birds circling against a purple-orange sky. The trigger-animation puzzle has the player pull a lever to raise a bridge, opening the path to the game completion area.

## Mechanics
1. **Crystal Collection** -- Pattern: collect-and-place. Find 3 colored crystals scattered around the beach and carry them to matching pedestals near the center of the level.
2. **Rune Sequence** -- Pattern: activate-in-order. Activate 5 rune stones in the correct order inside the cavern. Wrong order resets progress with visual and audio feedback.
3. **Bridge Builder** -- Pattern: trigger-animation. Pull a lever to raise a bridge of 5 segments over a gap, then cross to reach the final area and complete the game.

## Art Direction
- **Level 1 (Coral Shores):** Warm golden tones, sandy ground (#e8d68c), turquoise water, bright sky fading from deep blue (#0066cc) to warm horizon (#ffddaa). Coral decorations add underwater flair. Tropical, inviting mood.
- **Level 2 (Crystal Cavern):** Dark and atmospheric. Stone walls (#333344), purple-blue crystal glow (#8844cc), orange mushroom accents (#c84b31). Fog-heavy for mystery. Emissive trim strips in cool blue (#4488cc).
- **Level 3 (Twilight Garden):** Twilight purple-orange sky, soft green ground (#446633), warm lantern light (#ffaa44). Peaceful, contemplative mood. Particles float like fireflies.
