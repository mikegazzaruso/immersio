Create or modify a game level: $ARGUMENTS

## Instructions

You are the scene builder. NEVER use AskUserQuestion. NEVER stop early.

### Mode Detection
- If `modify` appears after the level number → **EDIT MODE**
- Otherwise → **CREATE MODE** (overwrites if exists)

Examples:
- `/scene 2 una spiaggia tropicale` → CREATE
- `/scene 2 modify aggiungi piu palme` → EDIT

---

## CREATE MODE

### Step 1: Parse
Extract level number N and environment description.

### Step 2: Context
If `GAME_DESIGN.md` exists, read it for art direction context.

### Step 3: Discover Models
Run `ls public/models/N/` for `.glb` files.

### Step 4: Circle Layout
radius = `max(3, numberOfModels * 1.2)`. Indoor: `min(radius, roomWidth/2 - 1)`.

### Step 5: Design Environment

**OUTDOOR** keywords: beach, forest, desert, mountain, garden, field, snow, volcano, swamp, ocean, ruins, park, spiaggia, foresta, deserto, montagna
**INDOOR** keywords: house, apartment, room, cave, grotto, spaceship, station, lab, temple, dungeon, casa, grotta, stanza

OUTDOOR: `sky` + `ground` + `directional` + `hemisphere` + `fog` + `particles`
INDOOR: `enclosure` + `pointLights`/`spotLights` + `hemisphere` + `fog` + `particles`

### Step 6: Design Decorations (3-5+ entries)

Types: `palmTree`, `tree`, `pineTree`, `rock`, `water`, `bird`, `stalactite`, `mushroom`, `crystal`, `coral`, `vine`, `lantern`, `column`

NL mapping: palme→palmTree, alberi→tree, rocce/scogli→rock, mare→water, uccelli→bird, stalattiti→stalactite, funghi→mushroom, cristalli→crystal, coralli→coral, liane→vine, lanterne→lantern, colonne→column

Defaults: Beach→palmTree,rock,water,bird | Forest→tree,rock,mushroom,bird | Cave→stalactite,crystal,mushroom,rock | Snow→pineTree,rock

### Step 7: Write Level File
Write `src/levels/levelN.js` with: id, name, environment, decorations, props, playerSpawn.

### Step 8: Done
Print: `Level N created! Open https://localhost:5173/?level=N`

---

## EDIT MODE

1. Read `src/levels/levelN.js`
2. Use Edit tool to change ONLY what was requested
3. Print: `Level N updated! Refresh https://localhost:5173/?level=N`
