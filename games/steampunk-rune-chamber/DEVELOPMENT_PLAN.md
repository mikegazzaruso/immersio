# Development Plan

## Phase 1: Scaffold
- [x] Project setup from templates

## Phase 2: Scenes
- [x] Level 1: The Rune Chamber -- Large steampunk indoor chamber (40x40, height 16) with brass walls, teal trim, dim amber lighting, floating particles, lanterns, crystals, columns, stalactites. Platform staircase area (4 platforms ascending) and altar area defined in layout.

## Phase 3: Mechanics
- [x] Lever Activation: Pull the steampunk lever (2_multipart_leveler.glb, multipart static) to spawn 4 floating platforms in staircase pattern
- [x] Enemy Patrol: 2 steampunk mushroom enemies (4_mushroom.glb) patrol floating platforms with walk animation; contact respawns player at nearby safe spot, keep all progress
- [x] Gem Collect-and-Place: Grab gem (3_crystal.glb) from highest platform, place on altar to spawn couch (1_couch.glb)
- [x] Couch Completion: Step onto the couch to trigger game:complete

## Phase 4: Verify
- [x] Build passes
