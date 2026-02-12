# Immersio

A framework for generating Three.js + WebXR VR games from natural language descriptions, powered by Claude Code.

Describe a game concept in any language, and Immersio scaffolds a complete, runnable VR project with environments, puzzles, audio, UI, and level transitions — all procedurally generated, no 3D assets required.

## Quick Start

### Generate a game with AI agents

```bash
# In Claude Code, run:
/dream a VR escape room in a haunted mansion with 3 puzzles
```

This generates a full game in `games/haunted-mansion/` with scaffolded project, level configs, puzzle mechanics, procedural audio, and level transitions.

### Edit levels visually

```bash
# Launch the AI-powered level editor
node framework/editor/cli.js haunted-mansion 1
```

The editor opens in your browser with a 4-viewport 3D scene editor. Use natural language to:
- Generate environments ("dark cave with glowing crystals and fog")
- Create objects ("treasure chest with gold coins")
- Add game logic ("when player reaches the door, transition to level 2")
- Design title screens ("epic cinematic intro with floating particles")

Supports **OpenAI** (GPT-4o, GPT-5.2) and **Ollama** (local models).

### Run the game

```bash
cd games/haunted-mansion
npm run dev
```

Open **https://localhost:5173** in your browser.

- **Desktop**: WASD to move, mouse to look, left-click to interact
- **VR**: Left stick move, right stick snap-turn, trigger to activate, grip to grab
- **Specific level**: `?level=2` URL parameter

## Commands

| Command | Description |
|---|---|
| `/dream <concept>` | Generate a complete game from a description |
| `/scene [games/<slug>] N <description>` | Create or overwrite level N |
| `/scene [games/<slug>] N modify <changes>` | Edit an existing level |
| `/mechanic [games/<slug>] "<description>"` | Add a game mechanic / puzzle |
| `/build [games/<slug>]` | Verify the project compiles |
| `/test [games/<slug>]` | Semantic validation (configs, wiring, transitions) |

All commands accept a game path or auto-detect the most recent game.

## Project Structure

```
immersio/
├── .claude/                 # Agent definitions, skills, commands
│   ├── agents/              # architect (opus), gameplay-dev, scene-builder (sonnet)
│   ├── skills/              # dream, scene, mechanic, build, test
│   └── commands/            # Thin wrappers for slash commands
├── CLAUDE.md                # Global context for all agents
├── framework/
│   ├── editor/              # AI-powered visual level editor
│   │   ├── cli.js           # Entry point: node cli.js <game-slug> [level]
│   │   └── src/             # Editor source (UI, AI, viewports, serialization)
│   ├── templates/           # .tpl files scaffolded by /dream
│   │   ├── project/         # package.json, vite.config.js, index.html
│   │   └── src/             # Engine, systems, puzzle framework
│   └── docs/                # Reference docs for agents
│       ├── LEVEL-CONFIG.md
│       ├── DECORATION-TYPES.md
│       └── MECHANIC-PATTERNS.md
└── games/                   # Generated games (one directory per game)
    └── <game-slug>/
        ├── src/             # Game source code
        ├── public/models/   # GLB assets per level (optional)
        ├── GAME_DESIGN.md   # Auto-generated design document
        └── DEVELOPMENT_PLAN.md
```

## Engine Architecture

```
Engine
├── VRSetup              # WebXR session, controllers
├── DesktopControls      # Mouse look + WASD
├── InputManager         # Abstracts VR/desktop input
├── LocomotionSystem     # Smooth move + snap-turn
├── InteractionSystem    # Ray-based hover, grab, activate
├── CollisionSystem      # AABB colliders + ground plane
├── DecorationRegistry   # Extensible registry for procedural decorations
├── LevelLoader          # Config-driven scene builder (sky, enclosure, lights, fog)
├── LevelTransition      # Portal meshes + fade overlay for level switching
├── AudioManager         # Procedural Web Audio API (ambient + SFX)
├── HUD                  # Notifications, puzzle progress, level title (desktop + VR)
├── PuzzleManager        # Linear chain or dependency graph
├── AssetLoader          # GLB loader with caching
├── ObjectFactory        # Procedural mesh primitives
└── EventBus             # Pub/sub for all game events
```

## Key Features

### Visual Level Editor
- **4-viewport 3D editor** with perspective + orthographic views
- **AI-powered creation**: describe environments, objects, and game logic in natural language
- **Title screen generator**: cinematic intro screens with configurable text, glow, and atmosphere
- **Engine customization**: AI writes `behaviors.js` for custom game logic (level transitions, animations, interactions)
- **GLB import**: drag & drop 3D models into the scene
- **Transform gizmo**: translate, rotate, scale with keyboard shortcuts (W/E/R)
- **Undo/Redo**: full action history with Ctrl+Z/Ctrl+Shift+Z
- **Run Game / Run Level**: launch full game or test current level directly from the editor
- **Supports OpenAI and Ollama** for AI generation

### Environments
- **Outdoor**: sky shader gradient, ground plane, directional + hemisphere lighting, fog, particles
- **Indoor**: enclosure (walls/ceiling/floor), point/spot lights, neon trim strips
- **13 procedural decorations**: palmTree, tree, pineTree, rock, water, bird, stalactite, mushroom, crystal, coral, vine, lantern, column
- Custom decoration types via `DecorationRegistry`

### Puzzles
Three canonical patterns, extensible via `PuzzleBase`:
1. **Collect-and-Place** — grab objects, carry to targets, snap on proximity
2. **Activate-in-Order** — tap objects in correct sequence (Simon Says)
3. **Trigger-Animation** — lever/button triggers environmental change

PuzzleManager supports **linear chains** (default) and **dependency graphs** for non-linear puzzle flow.

### Audio
Fully procedural via Web Audio API — no audio files needed:
- Ambient: wind, ocean, cave (with drips)
- SFX: puzzle activation, solve arpeggio, game complete fanfare, portal whoosh

### Title Screen
Optional cinematic title screen (`titleScreen.js`) with 3D text, atmospheric environment, and "press to start" prompt. Supports configurable font sizes, glow effects, and mesh scales. Automatically shown before level 1 when present.

### Level Transitions
Portal system with glowing ring mesh, proximity trigger, and fade-to-black transition between levels. Programmatic transitions via `engine.levelTransition.triggerTransition(targetLevel)` for custom completion conditions.

## How It Works

Immersio uses a multi-agent architecture in Claude Code:

1. **Architect** (opus) — analyzes the concept, generates design docs, scaffolds from templates, orchestrates sub-skills
2. **Scene Builder** (sonnet) — creates level configs with environments, decorations, and prop placement
3. **Gameplay Dev** (sonnet) — implements puzzle mechanics, wires interactions into the engine

The `/dream` command runs the full pipeline: analyze → scaffold → create scenes → implement mechanics → build → validate.

## Documentation

- [Level Config Format](framework/docs/LEVEL-CONFIG.md)
- [Mechanic Patterns](framework/docs/MECHANIC-PATTERNS.md)
- [Decoration Types](framework/docs/DECORATION-TYPES.md)

## Requirements

- [Claude Code](https://claude.ai/claude-code) CLI
- Node.js 18+
- Modern browser with WebXR support (Quest 3, Quest Pro, etc.) for VR
- Any modern browser for desktop mode

## License

GPL-3.0
