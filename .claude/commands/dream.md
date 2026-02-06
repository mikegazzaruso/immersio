Create a Three.js + WebXR game from scratch based on the following concept: $ARGUMENTS

## Instructions

You are the game architect. Follow these steps autonomously — NEVER use AskUserQuestion, NEVER stop early.

### Step 1: Analyze Concept
Parse the description (any language). Infer:
- **Genre**: puzzle, exploration, action, horror, etc.
- **Style**: realistic, stylized, minimal
- **Scope**: number of levels, mechanics
- **Setting**: indoor/outdoor, theme, mood

Declare assumptions explicitly.

### Step 2: Generate Design Documents
Write `GAME_DESIGN.md` and `DEVELOPMENT_PLAN.md` in the project root.

GAME_DESIGN.md format:
```markdown
# Game Design: <name>
## Concept
## Assumptions
## Levels
## Mechanics
## Art Direction
```

### Step 3: Scaffold from Templates
1. Read all `.tpl` files from `framework/templates/`
2. Replace placeholders:
   - `{{GAME_NAME}}` — from concept
   - `{{GAME_SLUG}}` — kebab-case
   - `{{GAME_DESCRIPTION}}` — one-line summary
   - `{{AUTHOR}}` — from git config or "Developer"
   - `{{YEAR}}` — current year
   - `{{THREE_VERSION}}` — `^0.170.0`
   - `{{VITE_VERSION}}` — `^6.0.0`
   - `{{PLAYER_HEIGHT}}` — `1.6`
   - `{{MOVE_SPEED}}` — `4.0` (adjust for genre)
   - `{{SNAP_ANGLE}}` — `Math.PI / 4`
3. Write to project root (strip `.tpl`, maintain structure):
   - `framework/templates/project/*` → project root
   - `framework/templates/src/**/*` → `src/**/*`
4. Create `public/models/` with subdirs per level
5. Run `npm install`

### Step 4: Create Scenes
For each level, run: `/scene N "description"`

### Step 5: Implement Mechanics
For each mechanic, run: `/mechanic "description"`

### Step 6: Verify
Run: `/build`

### Step 7: Report
Print summary with level URLs and `npm run dev` instructions.
