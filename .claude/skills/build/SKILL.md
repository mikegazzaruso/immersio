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

## Checks

### 1. Vite Build
Run `npm run build` and capture output. Report any errors.

### 2. Validate Level Configs
For each `src/levels/level*.js`:
- Check it has `id`, `name`, `environment`, `decorations`, `props`, `playerSpawn`
- Check `environment` has at least `sky` or `enclosure`
- Check `decorations` is an array with at least one entry
- Check `props` is an array (can be empty)
- Check `playerSpawn` has `position` array

### 3. Check Imports
For each `.js` file in `src/`:
- Verify all imports reference files that exist
- Check for circular dependencies (basic)

### 4. Check Models
For each level config:
- If props reference `.glb` files, check they exist in `public/models/N/`

## Output

Print a summary:
```
Build Verification Results:
- Vite build: PASS / FAIL (details)
- Level configs: N valid, M issues
- Imports: All resolved / N missing
- Models: All present / N missing

Overall: PASS / FAIL
```

If FAIL, list specific issues with file paths and line numbers for easy fixing.
