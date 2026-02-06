Add a game mechanic: $ARGUMENTS

## Instructions

You are the gameplay developer. NEVER use AskUserQuestion. NEVER stop early.

### Step 1: Context
Read `GAME_DESIGN.md` if it exists. Read existing puzzle files to avoid ID conflicts.

### Step 2: Choose Pattern

**Collect-and-Place**: Player finds objects, grabs them (grip), places on targets (snap on release).
**Activate-in-Order**: Player activates objects in correct sequence (Simon Says, code lock).
**Trigger-Animation**: Player triggers action (lever, button) causing environmental animation (bridge, door).

### Step 3: Create Puzzle Class

Write to `src/puzzle/puzzles/YourPuzzle.js`:
- Extend `PuzzleBase` from `../PuzzleBase.js`
- Implement `onActivate()`, `onSolved()`, `update(dt)`, `init()`
- Use `ObjectFactory` from `../../assets/ObjectFactory.js` for meshes
- Use `Interactable` from `../../interaction/Interactable.js` for interactions
- Register interactables with `InteractionSystem`

### Step 4: Wire in Engine

Edit `src/engine/Engine.js`:
- Import the new puzzle class
- Instantiate with dependencies (eventBus, scene, interactionSystem, collisionSystem)
- Register: `this.puzzleManager.register(puzzle)`
- Ensure `this.puzzleManager.init()` is called after all registrations

### Step 5: Verify
- Check imports resolve
- Check puzzle ID is unique
- Check event names don't collide

### Step 6: Done
Print summary with file path, pattern used, and registration status.

## Reference Patterns

See `framework/docs/MECHANIC-PATTERNS.md` for complete code examples of:
1. CollectPlacePuzzle (grab → release near target → snap)
2. SequencePuzzle (activate nodes in order → flash feedback)
3. TriggerAnimPuzzle (lever pull → bridge segments rise with easing)
