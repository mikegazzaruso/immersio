---
name: dream
description: Create a Three.js + WebXR game from scratch starting from a concept description
argument-hint: "<game description in any language>"
user-invocable: true
allowed-tools: Read, Bash, Glob, Grep, Write, Edit
agent: architect
context: fork
---

# Dream Skill — Create a VR Game from a Concept

You are invoked via `/dream <concept>`. Your job is to turn a natural language game concept into a fully scaffolded, runnable Three.js + WebXR game.

## CRITICAL: DO NOT STOP UNTIL THE JOB IS DONE

**Complete ALL steps in a SINGLE run. NEVER use AskUserQuestion. NEVER stop early.**

## Parsing Arguments

```
/dream <game concept description in any language>
```

Examples:
- `/dream a VR escape room in a haunted mansion with 3 puzzles`
- `/dream un gioco VR in una foresta magica dove devi raccogliere cristalli`
- `/dream space station mystery — find clues, unlock doors, escape before oxygen runs out`

## End-to-End Flow

### Step 1: Analyze Concept
Parse the description. Infer:
- **Genre**: puzzle, exploration, action, horror, etc.
- **Style**: realistic, stylized, minimal, etc.
- **Scope**: number of levels, number of mechanics
- **Setting**: indoor/outdoor, theme, mood

**Declare assumptions explicitly** in the design document.

### Step 2: Generate Design Documents
Write `GAME_DESIGN.md` and `DEVELOPMENT_PLAN.md` in the project root.

### Step 3: Scaffold from Templates
1. Find the framework templates directory (`framework/templates/`)
2. Read each `.tpl` file
3. Replace `{{VARIABLES}}` with inferred values:
   - `{{GAME_NAME}}` — from concept
   - `{{GAME_SLUG}}` — kebab-case version
   - `{{GAME_DESCRIPTION}}` — one-line summary
   - `{{AUTHOR}}` — from git config or "Developer"
   - `{{YEAR}}` — current year
   - `{{THREE_VERSION}}` — `^0.170.0`
   - `{{VITE_VERSION}}` — `^6.0.0`
   - `{{PLAYER_HEIGHT}}` — `1.6`
   - `{{MOVE_SPEED}}` — `4.0` (adjust for genre: `2.0` for horror, `6.0` for action)
   - `{{SNAP_ANGLE}}` — `Math.PI / 4`
4. Write each file to the project (strip `.tpl` extension, maintain directory structure):
   - `framework/templates/project/*` → project root
   - `framework/templates/src/**/*` → `src/**/*`
5. Create `public/models/` directory with subdirectories for each level
6. Run `npm install`

### Step 4: Create Scenes
For each level in the design, invoke the `/scene` skill:
```
/scene 1 "level 1 description from design"
/scene 2 "level 2 description from design"
```

### Step 5: Implement Mechanics
For each mechanic in the design, invoke the `/mechanic` skill:
```
/mechanic "mechanic description from design"
```

### Step 6: Verify Build
Invoke `/build` to check that everything compiles.

### Step 7: Final Report
Print:
```
Game "{{GAME_NAME}}" scaffolded successfully!

Levels:
- Level 1: https://localhost:5173/?level=1
- Level 2: https://localhost:5173/?level=2
...

Run `npm run dev` to start the development server.
```

## Framework Templates Location

All templates are in `framework/templates/` with this structure:
```
project/           → package.json.tpl, vite.config.js.tpl, index.html.tpl
src/
  main.js.tpl
  engine/          → Engine.js.tpl, VRSetup.js.tpl, DesktopControls.js.tpl
  events/          → EventBus.js.tpl
  input/           → InputActions.js.tpl, InputManager.js.tpl
  locomotion/      → LocomotionSystem.js.tpl
  interaction/     → Interactable.js.tpl, InteractionSystem.js.tpl
  collision/       → CollisionSystem.js.tpl
  assets/          → AssetLoader.js.tpl, ObjectFactory.js.tpl
  levels/          → LevelLoader.js.tpl
  puzzle/          → PuzzleBase.js.tpl, PuzzleManager.js.tpl
```
