# Decoration Types

All procedural decoration types available in level configs. Decorations are placed in the `decorations` array and rendered by `LevelLoader`.

## Types Overview

| Type | Description | Outdoor | Indoor |
|---|---|---|---|
| `palmTree` | Tropical palm tree with drooping leaf cones | Yes | — |
| `tree` | Deciduous tree with sphere canopy | Yes | — |
| `pineTree` | Pine/conifer with stacked cones | Yes | — |
| `rock` | Organic rock (distorted icosahedron) | Yes | Yes |
| `water` | Flat water plane with gentle oscillation | Yes | — |
| `bird` | Circling bird with wing flap animation | Yes | — |
| `stalactite` | Ceiling-hanging cones | — | Yes |
| `mushroom` | Glowing mushroom with cap and stem | Yes | Yes |
| `crystal` | Crystal cluster (2-4 octahedron shards) | Yes | Yes |
| `coral` | Coral branches with tip blobs | Yes | Yes |
| `vine` | Hanging segmented vine with leaves | — | Yes |
| `lantern` | Floating lantern box with point light | Yes | Yes |
| `column` | Cylindrical column floor-to-ceiling | — | Yes |

---

## Detailed Parameters

### `palmTree`
Tropical palm tree with bent trunk and 5 drooping leaf cones.

| Param | Type | Default | Description |
|---|---|---|---|
| `count` | number | 8 | Number of palm trees |
| `radius` | [min, max] | [10, 35] | Scatter radius range |
| `height` | [min, max] | [4, 7] | Tree height range |
| `leafColor` | string | '#2d8a3e' | Leaf color |

### `tree`
Deciduous tree with cylindrical trunk and sphere canopy.

| Param | Type | Default | Description |
|---|---|---|---|
| `count` | number | 10 | Number of trees |
| `radius` | [min, max] | [8, 30] | Scatter radius range |
| `height` | [min, max] | [3, 6] | Tree height range |
| `canopyColor` | string | '#2d6b1e' | Canopy sphere color |

### `pineTree`
Conifer with 3 stacked cone layers.

| Param | Type | Default | Description |
|---|---|---|---|
| `count` | number | 8 | Number of pine trees |
| `radius` | [min, max] | [8, 30] | Scatter radius range |
| `height` | [min, max] | [4, 8] | Tree height range |
| `color` | string | '#1a4d2e' | Cone/needle color |

### `rock`
Organic rock shape (distorted icosahedron geometry).

| Param | Type | Default | Description |
|---|---|---|---|
| `count` | number | 12 | Number of rocks |
| `radius` | [min, max] | [5, 35] | Scatter radius range |
| `scale` | [min, max] | [0.3, 1.2] | Rock size range |
| `color` | string | '#808080' | Rock color |

### `water`
Large flat water plane with gentle vertical oscillation.

| Param | Type | Default | Description |
|---|---|---|---|
| `y` | number | -0.05 | Water surface Y position |
| `color` | string | '#1a8fbf' | Water color |
| `opacity` | number | 0.6 | Water transparency |
| `size` | number | 400 | Plane size (width and depth) |

### `bird`
Animated circling bird with wing flap.

| Param | Type | Default | Description |
|---|---|---|---|
| `count` | number | 4 | Number of birds |
| `height` | [min, max] | [10, 18] | Flight height range |
| `speed` | number | 0.4 | Orbit speed multiplier |
| `color` | string | '#333333' | Bird color |

### `stalactite`
Downward-pointing cones hanging from ceiling. Uses enclosure height or defaults to 8.

| Param | Type | Default | Description |
|---|---|---|---|
| `count` | number | 15 | Number of stalactites |
| `length` | [min, max] | [0.5, 2.0] | Stalactite length range |
| `color` | string | '#666655' | Stalactite color |

### `mushroom`
Small glowing mushroom with stem and half-sphere cap.

| Param | Type | Default | Description |
|---|---|---|---|
| `count` | number | 8 | Number of mushrooms |
| `radius` | [min, max] | [3, 20] | Scatter radius range |
| `color` | string | '#c84b31' | Cap color |
| `glowColor` | string | '#ff6644' | Emissive glow color |

### `crystal`
Crystal cluster with 2-4 elongated octahedron shards. Uses `MeshStandardMaterial` with emissive glow.

| Param | Type | Default | Description |
|---|---|---|---|
| `count` | number | 6 | Number of crystal clusters |
| `radius` | [min, max] | [4, 20] | Scatter radius range |
| `color` | string | '#8844cc' | Crystal color + emissive |
| `glowIntensity` | number | 0.6 | Emissive intensity |

### `coral`
Coral formation with 3-5 tapered cylinder branches and spherical tips.

| Param | Type | Default | Description |
|---|---|---|---|
| `count` | number | 8 | Number of coral formations |
| `radius` | [min, max] | [4, 20] | Scatter radius range |
| `color` | string | '#e85d75' | Coral color |

### `vine`
Hanging segmented vine from ceiling with occasional small leaves.

| Param | Type | Default | Description |
|---|---|---|---|
| `count` | number | 10 | Number of vines |
| `length` | [min, max] | [1.0, 3.0] | Vine length range |
| `color` | string | '#2d5a1e' | Vine stem color |

### `lantern`
Small floating lantern box with embedded point light. Gently bobs up and down.

| Param | Type | Default | Description |
|---|---|---|---|
| `count` | number | 6 | Number of lanterns |
| `height` | [min, max] | [2, 5] | Float height range |
| `color` | string | '#ffaa44' | Lantern + light color |
| `radius` | [min, max] | [3, 15] | Scatter radius range |

### `column`
Simple cylindrical column from floor to ceiling height.

| Param | Type | Default | Description |
|---|---|---|---|
| `count` | number | 6 | Number of columns |
| `radius` | [min, max] | [4, 12] | Scatter radius range |
| `color` | string | '#888888' | Column color |

---

## Environment Defaults

When no decorations are specified, use these defaults based on environment type:

| Environment | Default Decorations |
|---|---|
| Beach | palmTree, rock, water, bird |
| Forest | tree, rock, mushroom, bird |
| Cave | stalactite, crystal, mushroom, rock |
| Snow | pineTree, rock |
| Futuristic | column, crystal |
| Space | column, crystal, lantern |
| Underwater | coral, crystal, rock |
| Garden | tree, rock, bird, lantern |
| Temple | column, crystal, lantern, vine |
| Generic outdoor | tree, rock, bird |
| Generic indoor | column, crystal, lantern |

## Natural Language Mapping

For multilingual support (Italian + English):

| Input | → Type |
|---|---|
| palme, palm trees | palmTree |
| alberi, trees | tree |
| pini, pine trees, conifers | pineTree |
| rocce, scogli, rocks, boulders | rock |
| mare, oceano, acqua, sea, ocean, water | water |
| uccelli, gabbiani, birds, seagulls | bird |
| stalattiti, stalactites | stalactite |
| funghi, mushrooms | mushroom |
| cristalli, crystals, gems | crystal |
| coralli, coral | coral |
| liane, viti, vines | vine |
| lanterne, luci, lanterns, lights | lantern |
| colonne, pilastri, columns, pillars | column |
| conchiglie, shells | rock (small scale) |
