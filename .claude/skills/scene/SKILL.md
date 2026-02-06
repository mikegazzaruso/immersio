---
name: scene
description: Create or modify a game level with environment, decorations, and props
argument-hint: "<N> <description>" or "<N> modify <changes>"
user-invocable: true
allowed-tools: Read, Bash, Glob, Grep, Write, Edit
agent: scene-builder
context: fork
---

# Scene Skill — Create/Edit Game Levels

You are the scene builder for Three.js + WebXR games.

## CRITICAL: DO NOT STOP UNTIL THE JOB IS DONE

**Complete ALL steps in a SINGLE run. NEVER use AskUserQuestion. NEVER stop early.**

## Parsing Arguments

Two syntaxes:

### CREATE syntax (generates level from scratch, overwrites if exists):
```
/scene <N> <environment-description> [decoration1, decoration2, ...]
```

### EDIT syntax (modifies existing level — keyword `modify` after number):
```
/scene <N> modify <changes-to-make>
```

## How to decide mode

**If the word `modify` appears right after the level number → EDIT MODE.**
**Otherwise → CREATE MODE (even if the level already exists — it will be overwritten).**

### CREATE examples:
- `/scene 1 una spiaggia [palme, mare, scogli, uccelli]`
- `/scene 2 foresta incantata`
- `/scene 3 grotta oscura [stalattiti, funghi, cristalli]`
- `/scene 1 a serene mountain lake surrounded by pine trees`

### EDIT examples:
- `/scene 2 modify make the sky a sunset`
- `/scene 2 modify add more palm trees`
- `/scene 1 modify cambia il cielo in un tramonto`

---

## Context Awareness

If `GAME_DESIGN.md` exists, read it first to understand the game's art direction and this level's role in the overall design.

## CREATE MODE

### Step A1: Parse
Extract: level number N, environment description, optional `[decorations]`.

### Step A2: Discover models
Run `ls public/models/N/` for `.glb` files. If empty/missing, that's fine — level will have no GLB props.

### Step A3: Circle layout for GLB props
radius = `max(3, numberOfModels * 1.2)`. Indoor: `min(radius, roomWidth/2 - 1)`.

### Step A4: Design environment

Decide OUTDOOR or INDOOR:
- **INDOOR**: house, apartment, room, interior, casa, interno, stanza, cave, grotto, grotta, tunnel, mine, spaceship, station, lab, office, temple, church, dungeon
- **OUTDOOR**: beach, forest, desert, mountain, garden, field, snow, volcano, swamp, ocean, ruins, park, spiaggia, foresta, deserto, montagna

**OUTDOOR**: `background` (hex string) + `sky` + `ground` + `directional` + `hemisphere` + `fog` + `particles`
**INDOOR**: `enclosure` + `pointLights`/`spotLights` + `hemisphere` + `fog` + `particles`

**Sky shader fields:** `sky.topColor`, `sky.bottomColor` (required). Optional: `sky.offset` (float, default 0) and `sky.exponent` (float, default 1).

### Step A5: Design decorations

If user provided `[...]`: map each item to types. If not: use defaults for the environment.

| type | Renders | Params |
|---|---|---|
| `palmTree` | Palm tree | `count`, `radius: [min,max]`, `height: [min,max]` |
| `tree` | Deciduous tree | `count`, `radius: [min,max]`, `height: [min,max]`, `canopyColor` |
| `pineTree` | Pine tree | `count`, `radius: [min,max]`, `height: [min,max]` |
| `rock` | Rock | `count`, `radius: [min,max]`, `scale: [min,max]`, `color` |
| `water` | Water plane | `y`, `color`, `opacity`, `size` |
| `bird` | Circling bird | `count`, `height: [min,max]`, `speed` |
| `stalactite` | Ceiling cone | `count`, `length: [min,max]`, `color` |
| `mushroom` | Glowing mushroom | `count`, `radius: [min,max]`, `color`, `glowColor` |
| `crystal` | Crystal cluster | `count`, `radius: [min,max]`, `color`, `glowIntensity` |
| `coral` | Coral shape | `count`, `radius: [min,max]`, `color` |
| `vine` | Hanging vine | `count`, `length: [min,max]`, `color` |
| `lantern` | Floating lantern | `count`, `height: [min,max]`, `color` |
| `column` | Column | `count`, `radius: [min,max]`, `color` |

**Natural language → type:**
palme→palmTree, alberi→tree, pini→pineTree, rocce/scogli→rock, mare/oceano/acqua→water, uccelli/gabbiani→bird, stalattiti→stalactite, funghi→mushroom, cristalli→crystal, coralli→coral, liane/viti→vine, lanterne/luci→lantern, colonne/pilastri→column, conchiglie→rock (small)

**Defaults:** Beach: palmTree,rock,water,bird | Forest: tree,rock,mushroom,bird | Cave: stalactite,crystal,mushroom,rock | Snow: pineTree,rock | Futuristic: column,crystal | Space: column,crystal,lantern | Underwater: coral,crystal,rock | Garden: tree,rock,bird,lantern | Temple: column,crystal,lantern,vine | Generic outdoor: tree,rock,bird | Generic indoor: column,crystal,lantern

**ALWAYS 3-5+ decoration entries.**

### Step A6: Write level file

Write to `src/levels/levelN.js`:

```js
export default {
  id: N,
  name: 'Descriptive Name',
  environment: { /* from A4 */ },
  decorations: [ /* from A5 */ ],
  props: [ /* GLB models from A3 */ ],
  playerSpawn: { position: [0, 0, R], rotationY: Math.PI },
};
```

### Step A7: Done

Print: `Level N created! Open https://localhost:5173/?level=N and refresh.`

---

## EDIT MODE (level already exists)

### Step B1: Read existing level
Read the full content of `src/levels/levelN.js`.

### Step B2: Understand the modification
Interpret the user's natural language request.

### Step B3: Apply changes
Use Edit tool to modify ONLY the relevant parts of the level file. Do NOT rewrite the entire file.

**IMPORTANT about prop scale:** The LevelLoader auto-grounds props (computes bounding box, sets Y so bottom touches floor). Changing `scale` in the config is safe — no Y adjustment needed.

### Step B4: Done

Print: `Level N updated! Refresh https://localhost:5173/?level=N to see changes.`

---

**NEVER use AskUserQuestion. Just do the work and print the result.**
