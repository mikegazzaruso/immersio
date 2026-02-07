---
name: test
description: Run semantic validation on a generated game — checks level configs, puzzle wiring, level transitions, decoration types, and model references
argument-hint: "[games/<slug>]"
user-invocable: true
allowed-tools: Read, Bash, Glob, Grep
context: fork
---

# Test Skill — Semantic Game Validation

Run deep validation on a generated game project, beyond what `/build` (Vite compilation) checks.

## CRITICAL: DO NOT STOP UNTIL THE JOB IS DONE

**Complete ALL checks in a SINGLE run. NEVER use AskUserQuestion.**

## First Step: Read CLAUDE.md

Read the `CLAUDE.md` file in the repo root to understand project structure and conventions.

## Game Directory Detection

The argument may be a game path:
- **With path:** `/test games/my-game`
- **Without path:** `/test` → auto-detect by finding the most recently modified `games/*/GAME_DESIGN.md`

After resolving the game directory, all operations run inside it.

## Validation Checks

### Check 1: Level Config Schema

For each `<game-dir>/src/levels/level*.js`, read the file and verify:

| Field | Required | Type |
|---|---|---|
| `id` | Yes | number |
| `name` | Yes | string |
| `environment` | Yes | object with `sky` or `enclosure` |
| `decorations` | Yes | array with 1+ entries |
| `props` | Yes | array (can be empty) |
| `playerSpawn` | Yes | object with `position` array |
| `exit` | No | object or array (if present, must have `position` and `targetLevel`) |

For each decoration entry, check that `type` is one of the 13 built-in types: `palmTree`, `tree`, `pineTree`, `rock`, `water`, `bird`, `stalactite`, `mushroom`, `crystal`, `coral`, `vine`, `lantern`, `column`.

### Check 2: Level Transition Graph

Collect all levels and their `exit` fields. Verify:
- Every `targetLevel` in an exit references a level file that exists
- No orphan levels (every level except level 1 is reachable from at least one other level's exit)
- No self-referencing exits (`targetLevel` pointing to the same level)
- Warn (not error) if the last level has no exit and no puzzles (dead end)

### Check 3: Puzzle Registration

Read `<game-dir>/src/engine/Engine.js` and find:
- All puzzle imports (`import { ... } from '../puzzle/puzzles/...'`)
- All `puzzleManager.register(...)` calls
- Verify each imported puzzle class is registered
- Verify each registered puzzle class is imported

If `GAME_DESIGN.md` lists mechanics, cross-reference:
- Warn about mechanics listed in design but not implemented
- Warn about implemented puzzles not in the design

### Check 4: Puzzle Dependencies (if graph mode)

If any puzzle sets `dependencies`:
- Verify all referenced dependency IDs match registered puzzle IDs
- Check for circular dependencies (A depends on B, B depends on A)
- Check for unreachable puzzles (dependencies that can never be met)
- Verify at least one puzzle has no dependencies (root node)

### Check 5: Model References

For each level config's `props` array:
- Check that each referenced `.glb` file exists in `<game-dir>/public/models/N/`
- Report missing models with their expected paths

### Check 6: Import Verification

For each `.js` file in `<game-dir>/src/`:
- Parse `import` statements
- Verify the target file exists (relative path resolution)
- Report missing imports with file and line number

## Output

Print a structured report:

```
Validation Results (games/<slug>):

Levels:
  ✓ level1.js — schema valid, 4 decorations, 2 props
  ✓ level2.js — schema valid, 3 decorations, 0 props
  ✗ level3.js — missing playerSpawn.position

Transitions:
  ✓ Level 1 → Level 2 (portal)
  ✓ Level 2 → Level 3 (portal)
  ✓ Level 3 — final level (no exit)

Puzzles:
  ✓ 3 puzzles registered (collect_gems, rune_sequence, bridge_lever)
  ✓ Dependencies: valid graph (2 roots, no cycles)
  ⚠ GAME_DESIGN.md lists "key_puzzle" but no implementation found

Models:
  ✓ All 4 model references resolved
  ✗ level2: treasure.glb not found in public/models/2/

Imports:
  ✓ All imports resolved

Overall: PASS (1 warning, 1 model missing)
```

Use `✓` for pass, `✗` for fail, `⚠` for warning.

**Severity:**
- `✗` (error): schema violations, broken imports, missing puzzle registrations, circular dependencies
- `⚠` (warning): missing models (may not be added yet), design/implementation mismatches, orphan levels

**Overall:** PASS if no errors (warnings are OK). FAIL if any errors.

## Error Handling

### Game directory not found
If the specified game path doesn't exist and auto-detect finds no games:
1. Print: `ERROR: No game found. Run /dream first to create a game, or specify the path: /test games/<slug>`
2. Stop

### No level files found
1. Print: `ERROR: No level files found in <game-dir>/src/levels/. Run /scene to create levels.`
2. Stop

### Level file can't be parsed
If a level file has syntax errors that prevent reading:
1. Report: `✗ levelN.js — parse error: <message>`
2. Continue with remaining levels

### Engine.js not found or unrecognizable
1. Skip puzzle checks
2. Report: `⚠ Engine.js not found or not parseable — skipping puzzle checks`
