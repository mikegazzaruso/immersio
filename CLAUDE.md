# Immersio — Three.js + WebXR Game Framework

## Project Structure

```
immersio/
├── .claude/                 # Agent definitions, skills, commands
├── CLAUDE.md                # This file — global context for all agents
├── README.md
├── framework/               # Generative infrastructure (DO NOT put game code here)
│   ├── templates/           # .tpl files scaffolded by /dream
│   │   ├── project/         # package.json.tpl, vite.config.js.tpl, index.html.tpl
│   │   └── src/             # Engine, systems, puzzle framework templates
│   └── docs/                # Reference docs for agents
│       ├── LEVEL-CONFIG.md
│       ├── DECORATION-TYPES.md
│       └── MECHANIC-PATTERNS.md
└── games/                   # All generated games live here
    └── <game-slug>/         # One directory per game (kebab-case)
        ├── package.json
        ├── vite.config.js
        ├── index.html
        ├── GAME_DESIGN.md
        ├── DEVELOPMENT_PLAN.md
        ├── public/models/   # GLB assets per level
        └── src/             # Game source code
```

## Conventions

- **Games directory:** Every game is generated into `games/<slug>/`. Never scaffold into the repo root.
- **Game slug:** Derived from the game name, kebab-case (e.g., `haunted-mansion`, `crystal-forest`).
- **Game path argument:** When the architect invokes sub-skills, it passes the game directory as the first argument:
  - `/scene games/<slug> N "description"`
  - `/mechanic games/<slug> "description"`
  - `/build games/<slug>`
- **Auto-detect:** If a user invokes `/scene`, `/mechanic`, or `/build` without a game path, the skill should find the most recently modified game by looking for `games/*/GAME_DESIGN.md`.
- **Templates path:** `framework/templates/` — all `.tpl` files live here.
- **Docs path:** `framework/docs/` — reference documentation for agents.

## Tech Stack

- **Three.js** `^0.170.0`
- **Vite** `^6.0.0`
- **ES Modules** (import/export, no CommonJS)
- **No TypeScript** — plain JavaScript only
- **WebXR** for VR, with desktop mouse+keyboard fallback

## Template Variables

| Variable | Default | Description |
|---|---|---|
| `{{GAME_NAME}}` | — | Human-readable game name |
| `{{GAME_SLUG}}` | — | kebab-case slug |
| `{{GAME_DESCRIPTION}}` | — | One-line description |
| `{{AUTHOR}}` | git config or "Developer" | Author name |
| `{{YEAR}}` | Current year | For LICENSE/package.json |
| `{{THREE_VERSION}}` | `^0.170.0` | Three.js version |
| `{{VITE_VERSION}}` | `^6.0.0` | Vite version |
| `{{PLAYER_HEIGHT}}` | `1.6` | Camera Y offset |
| `{{MOVE_SPEED}}` | `4.0` | Locomotion speed (2.0 horror, 6.0 action) |
| `{{SNAP_ANGLE}}` | `Math.PI / 4` | Snap-turn angle |

## Engine Architecture

```
Engine
├── VRSetup              # WebXR session, controllers, grip spaces
├── DesktopControls      # Mouse look + WASD movement
├── InputManager         # Abstracts VR/desktop → InputActions events
├── LocomotionSystem     # Teleport (left stick) + snap-turn (right stick)
├── InteractionSystem    # Ray-based hover, grab, activate (VR + desktop)
├── CollisionSystem      # AABB box colliders + ground plane + anti-tunneling
├── AssetLoader          # GLTFLoader wrapper for .glb files
├── ObjectFactory        # Procedural mesh primitives
├── DecorationRegistry   # Extensible registry for decoration spawners
│   └── builtins.js      # 13 built-in types registered at init
├── LevelLoader          # Reads levelN.js configs → builds scene
│   ├── Environment      # Sky shader / enclosure + lights + fog
│   ├── Decorations      # Dispatched via DecorationRegistry
│   └── Props            # GLB models (auto-grounded)
├── LevelTransition      # Portal meshes + fade overlay for level switching
├── AudioManager         # Procedural audio: ambient loops + SFX via Web Audio API
├── HUD                  # Notifications, level title, puzzle progress, game complete (desktop + VR)
├── PuzzleManager        # Registers and chains puzzle instances
└── EventBus             # Pub/sub for all game events
```

## EventBus Events

### Input (emitted by InputManager)
`MOVE_X`, `MOVE_Y`, `TURN_X`, `TRIGGER_LEFT`, `TRIGGER_RIGHT`, `GRIP_LEFT`, `GRIP_RIGHT`, `TRIGGER_LEFT_DOWN`, `TRIGGER_RIGHT_DOWN`, `GRIP_LEFT_DOWN`, `GRIP_RIGHT_DOWN`, `TRIGGER_LEFT_UP`, `TRIGGER_RIGHT_UP`, `GRIP_LEFT_UP`, `GRIP_RIGHT_UP`, `B_RIGHT_DOWN`, `B_RIGHT_UP`, `A_RIGHT_DOWN`, `A_RIGHT_UP`

### Puzzle (emitted by PuzzleBase / PuzzleManager)
- `puzzle:activated` — `{ id }` — puzzle becomes active
- `puzzle:solved` — `{ id }` — puzzle completed
- `game:complete` — all puzzles solved

### Level Transition (emitted by LevelTransition)
- `level:transition` — `{ targetLevel }` — player entering a portal

### UI
- `notification` — `{ text }` — shows text on HUD (desktop + VR)

## ObjectFactory Methods

All return `THREE.Mesh` or `THREE.Group`. Accept optional `position` (Vector3) as last arg.

| Method | Signature | Description |
|---|---|---|
| `box` | `(w, h, d, color, pos)` | Box mesh |
| `cylinder` | `(rTop, rBot, h, segs, color, pos)` | Cylinder mesh |
| `cone` | `(r, h, segs, color, pos)` | Cone mesh |
| `sphere` | `(r, wSegs, hSegs, color, pos)` | Sphere mesh |
| `crystal` | `(r, h, color, pos)` | Emissive octahedron crystal |
| `pillar` | `(r, h, color, pos)` | Column with cap and base |
| `pedestal` | `(w, h, color, pos)` | Pedestal for placing objects |
| `fakeShadow` | `(radius, pos)` | Flat black circle on ground |
| `runeStone` | `(w, h, d, color, symbol, pos)` | Stone slab with emissive indicator |
| `lever` | `(pos)` | Lever with animated pivot (userData.pivot) |

## Interactable Types

```js
new Interactable(mesh, {
  type: 'activate' | 'grab' | 'both',
  onActivate: (hand) => {},      // trigger press on hover
  onGrab: (hand) => {},          // grip press on hover
  onRelease: (hand, worldPos) => {}, // grip release
  onHoverEnter: () => {},
  onHoverExit: () => {},
  enabled: true,
});
```

## Desktop Interaction

The `InteractionSystem` supports full desktop interaction alongside VR:

- **Click** = activate (trigger equivalent) — fires on hovered interactable
- **E key** = grab/release toggle — grabs hovered interactable, releases on second press
- Hover detection uses camera-center raycast with recursive object traversal (works with GLB child meshes)
- Grabbed objects follow 1.5m in front of camera in world space
- The `hand` parameter is `'desktop'` for all desktop interaction callbacks

## AssetLoader API

### `load(path, opts)` — Standard GLB loading
Returns cloned `scene` only (no animations). Use for static props.

### `loadGLTF(path)` — Full GLB loading with animations
Returns `{ scene, animations }`. Use when you need `AnimationMixer`.

### `AssetLoader.stripRootMotion(clip)` — Static helper
Filters `.position` tracks from root bones (Root, root, Armature, Hip, Hips) to prevent animated models from drifting. Returns a new `AnimationClip`.

```js
const { scene, animations } = await engine.assetLoader.loadGLTF('/models/1/creature.glb');
const mixer = new THREE.AnimationMixer(scene);
for (const clip of animations) {
  mixer.clipAction(AssetLoader.stripRootMotion(clip)).play();
}
```

## Puzzle Lifecycle

```
PuzzleBase: locked → activate() → active → solve() → solved
Fields: id, eventBus, state, dependencies (puzzle ID array)
Hooks: onActivate(), onSolved(), update(dt), init()
```

### PuzzleManager Modes

**Linear (default):** If no puzzle has `dependencies` set, chains in registration order. Solving N activates N+1. All solved → `game:complete`.

**Graph:** If any puzzle has `dependencies = [id1, id2, ...]`, PuzzleManager uses dependency graph mode:
- Puzzles with empty `dependencies` are root nodes (activate on init)
- A puzzle activates when ALL its dependencies are solved
- `game:complete` fires when every puzzle is solved

```js
// Graph example: A and B independent, C requires both
puzzleC.dependencies = ['collect_place', 'sequence'];
```

### Three Canonical Patterns

1. **Collect-and-Place** — grab objects, carry to targets, snap on proximity release
2. **Activate-in-Order** — tap objects in correct sequence (Simon Says)
3. **Trigger-Animation** — lever/button triggers environmental animation (bridge, door)

See `framework/docs/MECHANIC-PATTERNS.md` for full code examples.

## Level Transitions

Add an `exit` field to level configs to create portals between levels:

```js
exit: { position: [0, 0, -15], targetLevel: 2, label: 'Enter the Cave', color: '#44aaff' }
```

Multiple exits supported via array. See `framework/docs/LEVEL-CONFIG.md` for full docs.

**Flow:** proximity (1.8m) → fade to black → load level → fade in.

## Audio System

Procedural audio via Web Audio API — no audio files needed.

- **Ambient:** auto-started per level based on environment type (outdoor=wind, beach=ocean, cave=drips+hum)
- **SFX:** triggered automatically via EventBus events:
  - `puzzle:activated` → rising tone
  - `puzzle:solved` → major arpeggio
  - `game:complete` → fanfare
  - `level:transition` → whoosh
  - `notification` → soft ping
- **API:** `audioManager.startAmbient('outdoor'|'indoor'|'cave'|'beach')`, `audioManager.stopAmbient()`, `audioManager.setMuted(bool)`

## HUD / UI System

Handles all user interface in both desktop (HTML overlay) and VR (world-space canvas panel):

- **Level title** — shown on load, fades after 3s
- **Notifications** — `eventBus.emit('notification', { text })` — shown for 4s
- **Puzzle progress** — `Puzzles: N / M` counter (top-right on desktop, in VR panel)
- **Game complete** — full-screen overlay when `game:complete` fires
- **API:** `hud.onLevelLoaded(name, puzzleCount)` — called automatically by Engine on level load

## Decoration Types

13 built-in procedural types, managed via `DecorationRegistry`. See `framework/docs/DECORATION-TYPES.md` for full params.

**Outdoor:** palmTree, tree, pineTree, rock, water, bird
**Indoor:** stalactite, column, vine
**Both:** mushroom, crystal, coral, lantern

### Custom Decorations

Games can register custom types after engine init:
```js
engine.decorationRegistry.register('torch', (scene, config, env, ctx) => {
  // create and add meshes to scene
  // push objects to ctx.objects for cleanup on level change
});
```
