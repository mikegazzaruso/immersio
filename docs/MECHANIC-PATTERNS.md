# Mechanic Patterns

Three canonical patterns for implementing game mechanics in the framework. All extend `PuzzleBase` and register with `PuzzleManager`.

## 1. Collect-and-Place

Player finds objects in the world, grabs them, and places them on matching targets.

### When to Use
- Gather items and return them to a location
- Match colored objects to colored slots
- Assemble parts of a machine

### Implementation

```js
import * as THREE from 'three';
import { PuzzleBase } from '../PuzzleBase.js';
import { Interactable } from '../../interaction/Interactable.js';
import { ObjectFactory } from '../../assets/ObjectFactory.js';

export class CollectPlacePuzzle extends PuzzleBase {
  constructor(eventBus, scene, interactionSystem) {
    super('collect_place', eventBus);
    this.scene = scene;
    this.interactionSystem = interactionSystem;
    this.items = [];
    this.snapDistance = 0.8;
  }

  onActivate() {
    const colors = [
      { name: 'red', hex: 0xff4444 },
      { name: 'blue', hex: 0x4444ff },
      { name: 'green', hex: 0x44ff44 },
    ];

    colors.forEach((c, i) => {
      // Create collectible
      const crystal = ObjectFactory.crystal(0.15, 0.4, c.hex,
        new THREE.Vector3(Math.cos(i * 2.1) * 8, 0.5, Math.sin(i * 2.1) * 8)
      );
      this.scene.add(crystal);

      // Create target pedestal
      const pedestal = ObjectFactory.pedestal(0.5, 0.8, 0x555555,
        new THREE.Vector3(Math.cos(i * 2.1) * 3, 0, Math.sin(i * 2.1) * 3)
      );
      this.scene.add(pedestal);

      const targetPos = pedestal.position.clone();
      targetPos.y = 0.85;

      // Make crystal grabbable
      const interactable = new Interactable(crystal, {
        type: 'grab',
        onRelease: (hand, worldPos) => {
          this._checkPlacement(entry, worldPos);
        },
      });
      this.interactionSystem.register(interactable);

      const entry = { mesh: crystal, target: targetPos, placed: false, interactable };
      this.items.push(entry);
    });

    this.eventBus.emit('notification', { text: 'Find and place the crystals!' });
  }

  _checkPlacement(entry, releasePos) {
    if (entry.placed) return;

    const dist = releasePos.distanceTo(entry.target);
    if (dist < this.snapDistance) {
      entry.mesh.position.copy(entry.target);
      entry.placed = true;
      this.interactionSystem.unregister(entry.interactable);

      this.eventBus.emit('notification', {
        text: `${this.items.filter(i => i.placed).length}/${this.items.length} placed`
      });

      if (this.items.every(i => i.placed)) {
        this.solve();
      }
    }
  }

  onSolved() {
    this.eventBus.emit('notification', { text: 'All crystals placed!' });
  }
}
```

### Key Points
- Use `Interactable` with `type: 'grab'` for collectibles
- Check distance on `onRelease` callback
- Snap position when close enough
- Unregister interactable after placement to prevent re-grabbing

---

## 2. Activate-in-Order (Sequence)

Player activates objects in a specific order, like Simon Says.

### When to Use
- Code lock / combination puzzle
- Musical note sequence
- Rune activation order

### Implementation

```js
import * as THREE from 'three';
import { PuzzleBase } from '../PuzzleBase.js';
import { Interactable } from '../../interaction/Interactable.js';
import { ObjectFactory } from '../../assets/ObjectFactory.js';

export class SequencePuzzle extends PuzzleBase {
  constructor(eventBus, scene, interactionSystem) {
    super('sequence', eventBus);
    this.scene = scene;
    this.interactionSystem = interactionSystem;
    this.correctOrder = [1, 3, 0, 4, 2]; // indices
    this.playerInput = [];
    this.nodes = [];
  }

  onActivate() {
    const count = 5;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const stone = ObjectFactory.runeStone(0.6, 0.8, 0.15, 0x555566, i,
        new THREE.Vector3(Math.cos(angle) * 4, 0.5, Math.sin(angle) * 4)
      );
      this.scene.add(stone);

      const interactable = new Interactable(stone.children[0], {
        type: 'activate',
        onActivate: () => this._onNodeActivated(i),
      });
      this.interactionSystem.register(interactable);
      this.nodes.push({ mesh: stone, index: i, interactable });
    }

    this.eventBus.emit('notification', { text: 'Activate the runes in the correct order' });
  }

  _onNodeActivated(index) {
    this.playerInput.push(index);
    const step = this.playerInput.length - 1;

    if (this.correctOrder[step] !== index) {
      // Wrong — flash red, reset
      this._flashNode(index, 0xff0000, 0.5);
      this.playerInput = [];
      this.eventBus.emit('notification', { text: 'Wrong order! Try again.' });
      return;
    }

    // Correct — flash green
    this._flashNode(index, 0x00ff00, 0.8);

    if (this.playerInput.length === this.correctOrder.length) {
      this.solve();
    }
  }

  _flashNode(index, color, intensity) {
    const node = this.nodes[index];
    const indicator = node.mesh.children.find(c => c.userData?.runeIndicator);
    if (indicator && indicator.material) {
      indicator.material.emissive.setHex(color);
      indicator.material.emissiveIntensity = intensity;
      setTimeout(() => {
        indicator.material.emissive.setHex(0x222244);
        indicator.material.emissiveIntensity = 0.3;
      }, 500);
    }
  }

  onSolved() {
    // Glow all nodes green permanently
    for (const node of this.nodes) {
      const indicator = node.mesh.children.find(c => c.userData?.runeIndicator);
      if (indicator && indicator.material) {
        indicator.material.emissive.setHex(0x00ff00);
        indicator.material.emissiveIntensity = 1.0;
      }
    }
    this.eventBus.emit('notification', { text: 'Rune sequence complete!' });
  }
}
```

### Key Points
- Use `Interactable` with `type: 'activate'` for sequence nodes
- Track player input as array, compare with correct order at each step
- Reset on wrong input, provide visual + notification feedback
- Light up all nodes on success

---

## 3. Trigger-Animation

Player triggers an action that causes an environmental animation.

### When to Use
- Pull lever to raise bridge
- Press button to open door
- Step on pressure plate to move platform

### Implementation

```js
import * as THREE from 'three';
import { PuzzleBase } from '../PuzzleBase.js';
import { ObjectFactory } from '../../assets/ObjectFactory.js';

export class TriggerAnimPuzzle extends PuzzleBase {
  constructor(eventBus, scene, collisionSystem) {
    super('trigger_anim', eventBus);
    this.scene = scene;
    this.collisionSystem = collisionSystem;
    this._animating = false;
    this._animTimer = 0;
    this._animDuration = 3.0;
    this._segments = [];
    this._lever = null;
    this._leverPullAnim = null;
  }

  onActivate() {
    // Create lever
    this._lever = ObjectFactory.lever(new THREE.Vector3(5, 0, 0));
    this.scene.add(this._lever);

    // Create bridge segments (initially below ground)
    const segCount = 5;
    const segW = 2, segD = 2, segH = 0.3;
    for (let i = 0; i < segCount; i++) {
      const seg = new THREE.Mesh(
        new THREE.BoxGeometry(segW, segH, segD),
        new THREE.MeshLambertMaterial({ color: 0x887766 })
      );
      const targetY = 0;
      const startY = -3;
      seg.position.set(0, startY, -4 - i * segD);
      this.scene.add(seg);
      this._segments.push({ mesh: seg, startY, targetY, delay: i * 0.3 });
    }

    this.eventBus.emit('notification', { text: 'Pull the lever to raise the bridge' });
  }

  onTriggerActivated() {
    if (this._animating) return;

    // Animate lever
    const pivot = this._lever.userData.pivot;
    this._leverPullAnim = { pivot, timer: 0, duration: 0.8 };

    // Start bridge animation after brief delay
    setTimeout(() => {
      this._animating = true;
      this._animTimer = 0;
    }, 600);
  }

  update(dt) {
    // Lever animation
    if (this._leverPullAnim) {
      const a = this._leverPullAnim;
      a.timer += dt;
      const t = Math.min(a.timer / a.duration, 1);
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      a.pivot.rotation.x = -Math.PI / 6 + eased * (Math.PI / 3);
      if (t >= 1) this._leverPullAnim = null;
    }

    // Bridge segments animation
    if (!this._animating) return;
    this._animTimer += dt;

    let allDone = true;
    for (const seg of this._segments) {
      const localT = Math.max(0, this._animTimer - seg.delay) / 1.0;
      if (localT >= 1) {
        seg.mesh.position.y = seg.targetY;
      } else {
        allDone = false;
        const eased = localT < 0.5 ? 2 * localT * localT : 1 - (-2 * localT + 2) ** 2 / 2;
        seg.mesh.position.y = seg.startY + (seg.targetY - seg.startY) * eased;
      }
    }

    if (allDone) {
      this._animating = false;
      // Add collision boxes for bridge
      for (const seg of this._segments) {
        this.collisionSystem.addBoxCollider(
          seg.mesh.position.x, seg.mesh.position.y - 0.15,
          seg.mesh.position.z, 2, 0.3, 2
        );
      }
      this.solve();
    }
  }

  onSolved() {
    this.eventBus.emit('notification', { text: 'The bridge is raised!' });
  }
}
```

### Key Points
- Lever uses `ObjectFactory.lever()` with `userData.pivot` for animation
- Bridge segments animate with staggered delays for dramatic effect
- Use eased interpolation: `t < 0.5 ? 2*t*t : 1 - (-2*t+2)^2 / 2`
- Add collision boxes AFTER animation completes so player can walk on them
- Trigger via proximity check or InteractionSystem activate

---

## Wiring Puzzles Together

In `Engine.js`:

```js
import { CollectPlacePuzzle } from '../puzzle/puzzles/CollectPlacePuzzle.js';
import { SequencePuzzle } from '../puzzle/puzzles/SequencePuzzle.js';
import { TriggerAnimPuzzle } from '../puzzle/puzzles/TriggerAnimPuzzle.js';

// In init() or _setupPuzzles():
const puzzle1 = new CollectPlacePuzzle(this.eventBus, this.scene, this.interactionSystem);
const puzzle2 = new SequencePuzzle(this.eventBus, this.scene, this.interactionSystem);
const puzzle3 = new TriggerAnimPuzzle(this.eventBus, this.scene, this.collisionSystem);

this.puzzleManager.register(puzzle1);
this.puzzleManager.register(puzzle2);
this.puzzleManager.register(puzzle3);
this.puzzleManager.init(); // Activates first puzzle

// PuzzleManager automatically chains: solving puzzle1 activates puzzle2, etc.
// When all solved, emits 'game:complete'
```
