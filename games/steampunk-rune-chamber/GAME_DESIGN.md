# Game Design: Steampunk Rune Chamber

## Concept
A single-level VR action-platformer set in a mysterious, dimly lit steampunk chamber. The player discovers an ancient steampunk lever hidden in the room and activates it, causing floating platforms to materialize in a staircase pattern ascending toward the ceiling. Steampunk mushroom enemies patrol the platforms -- touching one means instant death with respawn at a nearby safe spot (all puzzle progress preserved). The player climbs the 3-4 platform staircase to collect a glowing gem from the highest platform, then descends and places the gem on an altar below. This summons a magical couch into existence. Jumping onto the couch completes the game. The atmosphere is mysterious and atmospheric, with dim amber lighting, glowing runes, brass gears, and wisps of fog.

## Assumptions
- 1 level (indoor steampunk chamber)
- 4 chained puzzles (linear): lever activation -> platform traversal -> gem collect-and-place -> couch completion
- Steampunk aesthetic with glowing runes, gears, lanterns, and crystal decorations
- Enemies patrol fixed paths on platforms; collision with enemy respawns player at nearby safe spot, keeping all progress
- 3-4 floating platforms in a staircase pattern (ascending from left to right or spiraling up)
- Large room (40x40, height 16) to accommodate vertical platforming
- Mysterious and atmospheric tone -- dimly lit, fog, ambient hum
- Move speed 3.0 (slower for atmospheric feel)

## Levels
1. **Level 1: The Rune Chamber** -- A vast steampunk chamber with brass walls, glowing runes, floating platforms in a staircase arrangement, and patrolling mushroom enemies. The player starts on the ground floor near the entrance, discovers the lever behind decorative columns, activates it to reveal the platform staircase, navigates upward while avoiding enemies, collects the gem from the top platform, returns to the altar on the ground floor, places the gem, and sits on the summoned couch to win.

## Mechanics
1. **Lever Activation** (trigger-animation) -- Find and pull the ancient steampunk lever (2_multipart_leveler.glb) to make 3-4 floating platforms appear in a staircase pattern ascending toward the ceiling. The lever is partially hidden behind columns/decorations.
2. **Enemy Patrol** (custom) -- 2-3 steampunk mushroom enemies (4_mushroom.glb) patrol back and forth on the floating platforms. They use skeleton walk animation (translation-independent, stripped root motion). Contact with any enemy respawns the player at the nearest safe spot below (ground level near the platforms), preserving all puzzle progress.
3. **Gem Collection** (collect-and-place) -- Grab the gem (3_crystal.glb) from the highest platform and carry it down to place on the altar pedestal on the ground floor. Snaps into place on proximity release.
4. **Couch Completion** (custom trigger) -- After placing the gem, the couch (1_couch.glb) materializes on the altar area with a fade-in effect. Walking onto/jumping onto the couch triggers game:complete.

## Asset Assignments

| Model File | Level | Role | Notes |
|---|---|---|---|
| `2_multipart_leveler.glb` | 1 | Interactive prop (lever) | Multipart; static (no embedded animations) |
| `4_mushroom.glb` | 1 | Enemy patrol | Has skeleton + walk animation; translation-independent |
| `3_crystal.glb` | 1 | Collectible gem | Static; grabbable; spawns on highest platform after lever pull |
| `1_couch.glb` | 1 | Completion trigger | Static; spawns on altar area after gem placement; step on to finish |

## Art Direction
- **Environment style:** Large indoor steampunk chamber with high ceilings (16m), brass/copper walls, mechanical gear decorations
- **Color palette:** Dark bronze (#3a2a1a) walls, amber (#ffaa44) lighting, teal (#00ccaa) rune glow, purple (#8844cc) crystals
- **Lighting:** Dim ambient with warm amber point lights, subtle teal emissive trim on walls. Fog for depth and mystery.
- **Decorations:** Lanterns (floating, amber glow), crystal clusters (teal/purple emissive), columns (brass), stalactites (gear-like ceiling formations)
- **Atmosphere:** Dense fog, floating particles, dim and mysterious. The room feels ancient and mechanical.
- **Platforms:** Brass-colored floating boxes with teal emissive trim, arranged in ascending staircase (3-4 steps)
- **Altar:** Central pedestal with rune markings, teal glow indicator for gem placement
