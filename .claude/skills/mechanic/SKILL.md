---
name: mechanic
description: Add a game mechanic by implementing a puzzle class with world objects and interaction wiring
argument-hint: '[games/<slug>] "description of the mechanic"'
user-invocable: true
allowed-tools: Read, Bash, Glob, Grep, Write, Edit
agent: gameplay-dev
context: fork
---

# Mechanic Skill — Add Game Mechanics

You implement game mechanics for Three.js + WebXR games.

## CRITICAL: DO NOT STOP UNTIL THE JOB IS DONE

**Complete ALL steps in a SINGLE run. NEVER use AskUserQuestion. NEVER stop early.**

## First Step: Read CLAUDE.md

Read the `CLAUDE.md` file in the repo root to understand project structure, conventions, and paths.

## Parsing Arguments

```
/mechanic [games/<slug>] "<description of the mechanic>"
```

### Game Directory Detection

The first argument may be a game path (starts with `games/`):
- **With path:** `/mechanic games/my-game "collect 4 gems and place them on pedestals"`
- **Without path:** `/mechanic "collect 4 gems"` → auto-detect by finding the most recently modified `games/*/GAME_DESIGN.md`

After resolving the game directory, all file paths are relative to it.

### Examples:
- `/mechanic games/crystal-forest "collect 4 colored gems and place them on matching pedestals"`
- `/mechanic "activate 5 rune stones in the correct order"`
- `/mechanic games/haunted-mansion "pull a lever to raise a bridge"`
- `/mechanic "find 3 keys hidden in the scene to unlock the exit door"`

## Context

Always read `GAME_DESIGN.md` inside the game directory for:
- Overall game concept and mechanics list
- Art direction (colors, materials)
- Level layout (which level this mechanic belongs to)

Always read existing puzzle files to avoid conflicts with registered puzzle IDs.

## Workflow

### Step 1: Analyze
Parse the description. Determine:
- **Pattern**: collect-and-place, activate-in-order, trigger-animation, or custom
- **Objects needed**: collectibles, targets, triggers, animated elements
- **Interactions**: grab, activate, proximity
- **Dependencies**: which level, which systems (collision, interaction)

### Step 2: Create Puzzle Class
Write to `<game-dir>/src/puzzle/puzzles/YourPuzzleName.js`:
- Extend `PuzzleBase`
- Implement `onActivate()`, `onSolved()`, `update(dt)`, `init()`
- Use `ObjectFactory` for procedural objects
- Register interactables with `InteractionSystem`

### Step 3: Wire in Engine
Edit `<game-dir>/src/engine/Engine.js` to:
- Import the new puzzle class
- Instantiate it with required dependencies
- If non-linear flow needed: set `puzzle.dependencies = ['dep_id1', 'dep_id2']`
- Register with `puzzleManager.register(puzzle)`
- Ensure `puzzleManager.init()` is called after registration

**Puzzle dependencies:** PuzzleManager supports two modes:
- **Linear (default):** no `dependencies` set → sequential chain
- **Graph:** any puzzle has `dependencies` → activates only when ALL deps are solved. Root puzzles (empty deps) activate on init.

### Step 4: Create World Objects (if needed)
If the mechanic needs dedicated world geometry (a puzzle room, a special area):
- Create in `<game-dir>/src/world/YourArea.js` or inline in the puzzle class
- Add collision boxes if objects should block the player

### Step 5: Test Considerations
- Verify imports are correct
- Check puzzle ID doesn't conflict with existing puzzles
- Ensure event names don't collide

### Step 6: Done
Print:
```
Mechanic "name" implemented!
- Puzzle class: <game-dir>/src/puzzle/puzzles/YourPuzzle.js
- Pattern: collect-and-place (or sequence, trigger, custom)
- Registered in Engine.js with PuzzleManager
```

## Three Canonical Patterns

### 1. Collect-and-Place
Player finds objects scattered in the world, grabs them (grip), carries them to target locations, and releases them. If released close enough to the target, the object snaps into place.

**Key systems:** InteractionSystem (grab/release), proximity check on release, EventBus for feedback.

### 2. Activate-in-Order (Sequence)
Player must activate a series of objects in a specific order. Activation can be by trigger (VR controller ray), proximity (walking close), or A-button press.

**Key systems:** InteractionSystem (activate), sequence tracking, visual feedback (glow/color change).

### 3. Trigger-Animation
Player activates a single trigger (lever, button, pressure plate) which causes an environmental animation (bridge rises, door opens, wall moves). Often gated behind completing other puzzles.

**Key systems:** InteractionSystem or proximity, tween animation in `update(dt)`, CollisionSystem updates after animation.

## Code Templates

See `framework/docs/MECHANIC-PATTERNS.md` for complete code examples of each pattern.
