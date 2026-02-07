---
name: dream
description: Create a Three.js + WebXR game from scratch starting from a concept description
argument-hint: "<game description> [<assets-folder-path>]"
user-invocable: true
allowed-tools: Read, Bash, Glob, Grep, Write, Edit, AskUserQuestion
agent: architect
context: fork
---

# Dream Skill — Create a VR Game from a Concept

You are invoked via `/dream <concept> [<assets-folder-path>]`. Your job is to turn a natural language game concept into a fully scaffolded, runnable Three.js + WebXR game.

## CRITICAL RULES

- **Two-phase workflow.** Phase 1 (Design) is interactive — use `AskUserQuestion` to gather preferences and get design approval. Phase 2 (Execution) is autonomous — NEVER ask questions, complete ALL remaining steps in a single run.
- **NEVER stop early.** Complete ALL steps.
- **Always complete the final report** even if some steps failed.

## First Step: Read CLAUDE.md

Read the `CLAUDE.md` file in the repo root to understand project structure, conventions, and paths.

## Parsing Arguments

```
/dream <game concept description> [<assets-folder-path>]
```

The arguments string contains the game concept and an **optional** path to a folder of `.glb` 3D model files.

**Parsing rules:**
1. Split the arguments string by whitespace
2. Check if the **last token** looks like a file path (starts with `/`, `~/`, `./`, or `../`)
3. If so, expand `~` to the user's home directory and check if it resolves to an **existing directory** using `ls`
4. If it exists and is a directory: treat it as the assets folder path, and the rest of the string is the game concept
5. If it doesn't exist: ask the user if they meant it as an assets path (typo?) or part of the concept
6. If the last token doesn't look like a path: the entire string is the game concept, no assets folder

**Examples:**
- `/dream a VR escape room in a haunted mansion with 3 puzzles`
  → concept: `a VR escape room in a haunted mansion with 3 puzzles`, assets: none
- `/dream a forest adventure ~/my-models`
  → concept: `a forest adventure`, assets: `~/my-models` (expanded to full path)
- `/dream space station mystery ./assets/space-glbs`
  → concept: `space station mystery`, assets: `./assets/space-glbs`
- `/dream un gioco VR in una foresta magica`
  → concept: `un gioco VR in una foresta magica`, assets: none

## Phase 1: Interactive Design

### Step 1: Analyze Concept
Parse the description. Infer preliminary:
- **Genre**: puzzle, exploration, action, horror, etc.
- **Style**: realistic, stylized, minimal, etc.
- **Scope**: number of levels, number of mechanics
- **Setting**: indoor/outdoor, theme, mood

### Step 2: Scan Assets (if provided)
If an assets folder was provided:
1. List all `.glb` files in the folder (non-recursive): `ls <path>/*.glb`
2. Note the filenames — you'll present them to the user in the next step
3. If the folder is empty or has no `.glb` files, inform the user and proceed without assets

**Important:** All `.glb` models must have their pivot (origin) at the bottom-center of the mesh for correct auto-grounding. If the user asks about asset preparation, remind them of this requirement.

### Step 3: Ask Design Questions
Use `AskUserQuestion` with up to 4 questions to clarify the design. Tailor questions to what's ambiguous — skip questions where the concept is already clear. Example questions:

- **Genre/tone** (if ambiguous): "What tone should the game have?" — Options: Relaxed & exploratory, Mysterious & atmospheric, Tense & challenging, Playful & whimsical
- **Levels**: "How many levels would you like?" — Options: 2 (short), 3 (standard), 4-5 (extended)
- **Puzzle style**: "What type of puzzles do you prefer?" — Options: Collect & place objects, Activate in sequence (Simon Says), Trigger mechanisms (levers/buttons), Mix of different types
- **Asset usage** (only if assets found): "How should we use your 3D models? Found: model1.glb, model2.glb, ..." — Options: Assign automatically based on names, Let me specify per level, Use all as shared props

### Step 4: Refine Design
Process the user's answers. If something critical is still unclear, ask ONE follow-up `AskUserQuestion` at most. Otherwise, proceed.

### Step 5: Derive Slug & Create Directory
- Derive kebab-case slug from the game name
- Create `games/<slug>/` directory

### Step 6: Generate Design Documents
Write `games/<slug>/GAME_DESIGN.md` and `games/<slug>/DEVELOPMENT_PLAN.md` incorporating the user's preferences.

If assets were provided, include an **Asset Assignments** table in `GAME_DESIGN.md`:
```markdown
## Asset Assignments

| Model File | Level | Role | Notes |
|---|---|---|---|
| `door.glb` | 1 | Interactive prop | Multipart; animate child "handle" for open |
| `enemy.glb` | 2 | Enemy patrol | Has skeleton + walk animation; translation-independent |
| `gem.glb` | 2 | Collectible | — |
| `fountain.glb` | shared | Decoration | — |
```

The **Notes** column captures technical metadata the user provides about their models. Downstream agents (`/scene`, `/mechanic`) use these hints for correct implementation. Common notes include:
- **Multipart models:** which child object or layer index to animate (e.g., "animate layer 15")
- **Animated models:** whether the GLB has skeleton/morph animations, and if the animation modifies translation (affects how the agent moves the object at runtime)
- **Spawn behavior:** conditional visibility, triggered appearance, etc.

During the design questions (Step 3), when assets are provided, ask the user about any technical details for their models.

### Step 7: Present Design for Approval
Use `AskUserQuestion` to present a summary of the design and ask for approval:

- Show: game name, slug, levels (names + descriptions), mechanics, art direction, asset assignments (if any)
- Question: "Here's the game design plan. Ready to build?"
- Options: "Looks good, let's build it!" / "I'd like to make some changes"

If the user wants changes: update the design docs accordingly and re-present (max 2 revision rounds, then proceed with best effort).

## Phase 2: Autonomous Execution

**From this point on, do NOT use AskUserQuestion. Complete everything autonomously.**

### Step 8: Scaffold from Templates
1. Find the framework templates directory (`framework/templates/`)
2. Read each `.tpl` file
3. Replace `{{VARIABLES}}` with values derived from the design:
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

### Step 9: Install Dependencies
Run `npm install` inside `games/<slug>/`.

If assets were provided, also install the compression tooling:
```bash
cd games/<slug> && npm install --save-dev @gltf-transform/cli
```

### Step 10: Compress & Place Assets
Only if assets were provided. For each model in the Asset Assignments table:

```bash
# Create target directory
mkdir -p games/<slug>/public/models/<levelId>

# Draco-compress and place
npx gltf-transform draco <source-path>/<filename.glb> games/<slug>/public/models/<levelId>/<filename.glb>
```

If Draco compression fails for a specific file, fall back to a plain copy:
```bash
cp <source-path>/<filename.glb> games/<slug>/public/models/<levelId>/<filename.glb>
```

Models assigned to `shared` go to `public/models/shared/`. Unassigned models also go to `public/models/shared/`.

### Step 11: Create Scenes
For each level in the design, invoke the `/scene` skill:
```
/scene games/<slug> 1 "level 1 description from design"
/scene games/<slug> 2 "level 2 description from design"
```

### Step 12: Implement Mechanics
For each mechanic in the design, invoke the `/mechanic` skill:
```
/mechanic games/<slug> "mechanic description from design"
```

### Step 13: Verify Build
Invoke `/build games/<slug>` to check that everything compiles.

### Step 14: Validate
Invoke `/test games/<slug>` for semantic validation (level configs, puzzle wiring, transitions, imports).

### Step 15: Final Report
Print:
```
Game "<name>" scaffolded successfully in games/<slug>/!

Levels:
- Level 1: https://localhost:5173/?level=1
- Level 2: https://localhost:5173/?level=2
...

Custom Assets:
- tree_oak.glb → Level 1 (Draco compressed)
- chest.glb → Level 2 (Draco compressed)
...

Run `cd games/<slug> && npm run dev` to start the development server.
```

Omit the "Custom Assets" section if no assets were provided.

## Error Recovery

- **Template missing:** Skip and log, continue scaffolding
- **`npm install` fails:** Retry once, then continue — `/build` will catch it
- **`@gltf-transform/cli` install fails:** Log warning, fall back to plain `cp` for all asset files
- **Draco compression fails for a file:** Fall back to `cp` for that file, log which files were copied vs. compressed
- **Assets folder doesn't exist:** Ask the user to correct the path during Phase 1 (interactive)
- **Assets folder empty / no .glb files:** Inform user during Phase 1, proceed without assets
- **`/scene` or `/mechanic` fails:** Log the error, continue with remaining skills
- **`/build` fails:** Attempt auto-fix for missing imports, re-run once. If still failing, report errors in summary
- **`/test` fails:** Report validation warnings/errors in summary — they indicate semantic issues (missing models, orphan levels, etc.)
- **Game dir exists:** Overwrite (preserve `public/models/`)
- **Design approval rejected:** Update design docs per user feedback, re-present (max 2 rounds)
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
