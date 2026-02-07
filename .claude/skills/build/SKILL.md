---
name: build
description: Run build verification — checks compilation, validates level configs, finds missing imports
user-invocable: true
allowed-tools: Read, Bash, Glob, Grep
context: fork
---

# Build Skill — Verify Project

Run build verification for a Three.js + WebXR game project.

## CRITICAL: DO NOT STOP UNTIL THE JOB IS DONE

**Complete ALL checks in a SINGLE run. NEVER use AskUserQuestion.**

## First Step: Read CLAUDE.md

Read the `CLAUDE.md` file in the repo root to understand project structure and conventions.

## Game Directory Detection

The argument may be a game path:
- **With path:** `/build games/my-game`
- **Without path:** `/build` → auto-detect by finding the most recently modified `games/*/GAME_DESIGN.md`

After resolving the game directory, all operations run inside it.

## Checks

### 1. Vite Build
Run `npm run build` inside the game directory and capture output. Report any errors.

### 2. Validate Level Configs
For each `<game-dir>/src/levels/level*.js`:
- Has `id`, `name`, `environment`, `decorations`, `props`, `playerSpawn`
- `environment` has at least `sky` or `enclosure`
- `decorations` is an array with at least one entry
- `props` is an array (can be empty)
- `playerSpawn` has `position` array

### 3. Check Imports
For each `.js` file in `<game-dir>/src/`:
- Verify all imports reference files that exist
- Check for circular dependencies (basic)

### 4. Check Models
For each level config:
- If props reference `.glb` files, check they exist in `<game-dir>/public/models/N/`

## Output

Print a summary:
```
Build Verification Results (games/<slug>):
- Vite build: PASS / FAIL (details)
- Level configs: N valid, M issues
- Imports: All resolved / N missing
- Models: All present / N missing

Overall: PASS / FAIL
```

If FAIL, list specific issues with file paths and line numbers for easy fixing.
