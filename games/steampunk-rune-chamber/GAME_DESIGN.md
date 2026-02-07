# Game Design: Steampunk Rune Chamber

## Concept
A single-level VR action-platformer set in a magical steampunk chamber. The player must find an ancient steampunk lever hidden in the room, pull it to make a crystal appear on a high platform, then navigate floating platforms while avoiding patrolling steampunk mushroom enemies (instant death on contact). After collecting the crystal, the player carries it to an altar. Placing the crystal on the altar spawns a couch. Jumping onto the couch completes the level. The atmosphere blends magical runes and glowing crystals with steampunk gears and mechanical elements.

## Assumptions
- 1 level (indoor steampunk chamber)
- 4 chained puzzles: lever activation, platform traversal with enemies, crystal collect-and-place, couch sit
- Steampunk aesthetic with glowing runes, gears, lanterns, and crystal decorations
- Enemies patrol fixed paths on platforms; collision with enemy resets player to spawn
- Double-jump enabled for platforming sections
- Large room (40x40, height 12) to accommodate vertical platforming

## Levels
1. **Level 1: The Rune Chamber** — A vast steampunk chamber with brass walls, glowing runes, floating platforms, and patrolling mushroom enemies. The player starts on the ground floor, finds the lever, then ascends via floating platforms to reach the crystal, brings it back down to the altar, and sits on the spawned couch to complete the game.

## Mechanics
1. **Lever Activation** (trigger-animation) — Find and pull the ancient steampunk lever to make the crystal appear on a high platform. Uses 2_multipart_leveler.glb with layer 15 animation.
2. **Enemy Patrol** (custom) — Steampunk mushroom enemies (4_mushroom.glb) patrol floating platforms. They use skeleton walk animation (translation-independent). Contact with any enemy resets the player to spawn point.
3. **Crystal Collection** (collect-and-place) — Grab the crystal (3_crystal.glb) from the high platform and place it on the altar below to spawn the couch.
4. **Couch Completion** (custom trigger) — Jump onto the spawned couch (1_couch.glb) to complete the level.

## Asset Assignments

| Model File | Level | Role | Notes |
|---|---|---|---|
| `2_multipart_leveler.glb` | 1 | Interactive prop (lever) | Multipart; animate layer 15 for lever pull |
| `4_mushroom.glb` | 1 | Enemy patrol | Has skeleton + walk animation; translation-independent |
| `3_crystal.glb` | 1 | Collectible | Grabbable; spawns on high platform after lever pull |
| `1_couch.glb` | 1 | Completion trigger | Spawns on altar after crystal placement; sit to finish |

## Art Direction
- **Environment style:** Large indoor steampunk chamber with high ceilings, brass/copper tones
- **Color palette:** Dark bronze (#3a2a1a) walls, amber (#ffaa44) lighting, teal (#00ccaa) rune glow, purple (#8844cc) crystals
- **Lighting:** Warm point lights with amber tint, subtle teal emissive trim on walls
- **Decorations:** Lanterns (floating, amber), crystal clusters (teal/purple), columns (brass), mushrooms (decorative, steampunk-colored), stalactites (gear-like)
- **Atmosphere:** Foggy interior with floating particles, mysterious and mechanical
