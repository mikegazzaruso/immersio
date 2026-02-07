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

## First Step: Read CLAUDE.md

Read the `CLAUDE.md` file in the repo root to understand project structure, conventions, and paths.

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

### Step 2: Derive Game Slug
Create a kebab-case slug from the game name (e.g., `crystal-forest`, `haunted-mansion`).

### Step 3: Create Game Directory
Create `games/<slug>/` and all necessary subdirectories.

### Step 4: Generate Design Documents
Write `games/<slug>/GAME_DESIGN.md` and `games/<slug>/DEVELOPMENT_PLAN.md`.

### Step 5: Scaffold from Templates
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
4. Write each file to `games/<slug>/` (strip `.tpl` extension, maintain directory structure):
   - `framework/templates/project/*` → `games/<slug>/`
   - `framework/templates/src/**/*` → `games/<slug>/src/**/*`
5. Create `games/<slug>/public/models/` directory with subdirectories for each level
6. Run `npm install` inside `games/<slug>/`

### Step 6: Create Scenes
For each level in the design, invoke the `/scene` skill:
```
/scene games/<slug> 1 "level 1 description from design"
/scene games/<slug> 2 "level 2 description from design"
```

### Step 7: Implement Mechanics
For each mechanic in the design, invoke the `/mechanic` skill:
```
/mechanic games/<slug> "mechanic description from design"
```

### Step 8: Verify Build
Invoke `/build games/<slug>` to check that everything compiles.

### Step 9: Validate
Invoke `/test games/<slug>` for semantic validation (level configs, puzzle wiring, transitions, imports).

### Step 10: Final Report
Print:
```
Game "<name>" scaffolded successfully in games/<slug>/!

Levels:
- Level 1: https://localhost:5173/?level=1
- Level 2: https://localhost:5173/?level=2
...

Run `cd games/<slug> && npm run dev` to start the development server.
```

## Error Recovery

- **Template missing:** Skip and log, continue scaffolding
- **`npm install` fails:** Retry once, then continue — `/build` will catch it
- **`/scene` or `/mechanic` fails:** Log the error, continue with remaining skills
- **`/build` fails:** Attempt auto-fix for missing imports, re-run once. If still failing, report errors in summary
- **`/test` fails:** Report validation warnings/errors in summary — they indicate semantic issues (missing models, orphan levels, etc.)
- **Game dir exists:** Overwrite (preserve `public/models/`)
- **Always complete the final report** even if some steps failed — list what succeeded and what needs attention

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
  decorations/     → DecorationRegistry.js.tpl, builtins.js.tpl
  assets/          → AssetLoader.js.tpl, ObjectFactory.js.tpl
  levels/          → LevelLoader.js.tpl, LevelTransition.js.tpl
  audio/           → AudioManager.js.tpl
  ui/              → HUD.js.tpl
  puzzle/          → PuzzleBase.js.tpl, PuzzleManager.js.tpl
```
