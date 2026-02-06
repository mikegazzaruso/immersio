# IAmers VR Showcase

A Three.js + WebXR VR game built entirely with AI-assisted development via Claude Code. Explore three stunning environments, solve puzzles, and interact with the iconic 3D IAMERS sign -- all running in your browser or VR headset.

## Demo Game

The repository includes a fully playable 3-level VR showcase demo designed for the IAmers AI community.

### How to Run

```bash
# Install dependencies
npm install

# Start dev server (HTTPS required for WebXR)
npm run dev
```

Open **https://localhost:5173** in your browser.

- **Desktop mode**: WASD to move, mouse to look (click to lock pointer), left-click to interact
- **VR mode**: Click "ENTER VR" with a compatible headset. Left stick to move, right stick to snap-turn, trigger to activate, grip to grab
- **Skip to a specific level**: Add `?level=2` or `?level=3` to the URL

### The 3 Levels

**Level 1 -- The Floating Island**
A lush tropical island with palm trees, rocks, water, birds, and floating lanterns under a warm sunset sky.
- **Puzzle**: Find 3 glowing AI Data Crystals scattered around the island and click them (or grab & place them in VR) onto the colored pedestals at the center.

**Level 2 -- The AI Laboratory**
A futuristic neon-lit room with glowing cyan trim, crystal formations, columns, and floating particles.
- **Puzzle**: Activate 5 neural network nodes in the correct sequence. Wrong order flashes red and resets. Correct nodes light up green.

**Level 3 -- The Crystal Cavern**
A mystical underground cave with stalactites, glowing mushrooms, crystal clusters, vines, and amber lanterns.
- **Puzzle**: Find the lever near the wall and pull it to raise a crystal bridge segment by segment. Walk across to the final platform.

### The IAMERS Sign

Every level features a floating 3D "IAMERS" text with a subtle rainbow shimmer. Click it (or point and trigger in VR) to trigger a spectacular effect:
- Letters explode outward with spin
- Rainbow color wave sweeps across the letters
- 40 colorful particles burst from the center
- A musical ascending chord plays (C4 - E4 - G4 - A4 - B4 - D5)
- Letters gracefully drift back and reassemble
- Can be activated as many times as you want

Levels auto-advance after completing each puzzle.

## Framework Architecture

This project is also a reusable framework for creating VR games with Claude Code. Use the `/dream` command to generate a complete game from a natural language description.

### Commands

| Command | Description |
|---|---|
| `/dream <concept>` | Create a complete game from a description |
| `/scene N <description>` | Create level N with the given environment |
| `/scene N modify <changes>` | Edit an existing level |
| `/mechanic "<description>"` | Add a game mechanic |
| `/build` | Verify the project builds correctly |

### Project Structure

```
src/
  main.js                    # Entry point
  engine/
    Engine.js                # Core orchestrator (renderer, scene, camera, game loop)
    VRSetup.js               # WebXR session, controllers, hand tracking
    DesktopControls.js       # WASD + mouse look + pointer lock
  events/
    EventBus.js              # Pub/sub for inter-system communication
  input/
    InputActions.js          # Action constants
    InputManager.js          # XR gamepad polling, edge events
  locomotion/
    LocomotionSystem.js      # VR smooth move, snap turn, jump
  interaction/
    Interactable.js          # Interactable component
    InteractionSystem.js     # Raycast hover, grip grab, trigger activate
  collision/
    CollisionSystem.js       # AABB collision with push-out
  assets/
    AssetLoader.js           # GLB/GLTF loader with Draco + caching
    ObjectFactory.js         # Procedural mesh factories
  objects/
    IAmersSign.js            # 3D extruded text with explosion effect
  levels/
    LevelLoader.js           # Config-driven scene builder
    level1.js, level2.js...  # Level configs
  puzzle/
    PuzzleBase.js            # Base class with dispose lifecycle
    PuzzleManager.js         # Sequential puzzle progression
    puzzles/                 # Game-specific puzzle implementations
```

### Key Patterns

- **Camera Rig**: `THREE.Group` contains camera. Locomotion moves rig, VR tracking moves camera inside rig
- **No Physics Engine**: Manual AABB collision with push-out + ground clamp
- **Performance**: `MeshLambertMaterial` for world, `MeshStandardMaterial` for special objects. No shadows. `FogExp2` for edge hiding
- **Clean Level Transitions**: All puzzles, interactables, and timers are properly disposed between levels
- **Procedural Audio**: All sound effects generated via Web Audio API oscillators -- no audio files needed
- **Input**: VR: left stick smooth move, right stick snap turn. Desktop: WASD + pointer lock mouse

### Documentation

- [Level Config Format](docs/LEVEL-CONFIG.md)
- [Mechanic Patterns](docs/MECHANIC-PATTERNS.md)
- [Decoration Types](docs/DECORATION-TYPES.md)

## Build

```bash
npm run build      # Production build to dist/
npm run preview    # Preview production build
```

## Requirements

- Node.js 18+
- Modern browser with WebXR support (Quest 3, Quest Pro, etc.) for VR
- Any modern browser for desktop mode
