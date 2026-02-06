Run build verification for the project.

## Instructions

NEVER use AskUserQuestion. Complete all checks in a single run.

### Check 1: Vite Build
Run `npm run build` and capture output. Report any errors.

### Check 2: Validate Level Configs
For each `src/levels/level*.js`:
- Has `id`, `name`, `environment`, `decorations`, `props`, `playerSpawn`
- `environment` has at least `sky` or `enclosure`
- `decorations` is an array with entries
- `props` is an array
- `playerSpawn` has `position`

### Check 3: Check Imports
For each `.js` file in `src/`:
- Verify import targets exist
- Flag missing files

### Check 4: Check Models
For each level config referencing `.glb` files:
- Check they exist in `public/models/N/`

### Output

Print summary:
```
Build Verification:
- Vite build: PASS/FAIL
- Level configs: N valid, M issues
- Imports: All resolved / N missing
- Models: All present / N missing

Overall: PASS/FAIL
```

If FAIL, list specific issues with file paths for easy fixing.
