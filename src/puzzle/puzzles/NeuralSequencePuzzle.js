import * as THREE from 'three';
import { PuzzleBase } from '../PuzzleBase.js';
import { Interactable } from '../../interaction/Interactable.js';
import { ObjectFactory } from '../../assets/ObjectFactory.js';

export class NeuralSequencePuzzle extends PuzzleBase {
  constructor(eventBus, scene, interactionSystem) {
    super('neural_sequence', eventBus);
    this.scene = scene;
    this.interactionSystem = interactionSystem;
    this.correctOrder = [2, 0, 4, 1, 3];
    this.playerInput = [];
    this.nodes = [];
    this._lines = [];
    this._pendingTimers = [];
    this._audioCtx = null;
  }

  onActivate() {
    const count = 5;
    const nodeColors = [0x00ccff, 0x8844cc, 0x00ff88, 0xff4488, 0xffcc00];

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 5;

      // Create neural node -- styled as glowing rune stones
      const stone = ObjectFactory.runeStone(0.6, 0.8, 0.15, 0x334455, i,
        new THREE.Vector3(Math.cos(angle) * radius, 0.5, Math.sin(angle) * radius)
      );
      this.scene.add(stone);

      // Add a glowing sphere above each node to make them more visible
      const glow = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 8, 6),
        new THREE.MeshStandardMaterial({
          color: nodeColors[i],
          emissive: nodeColors[i],
          emissiveIntensity: 0.4,
          roughness: 0.2,
        })
      );
      glow.position.set(
        Math.cos(angle) * radius,
        1.5,
        Math.sin(angle) * radius
      );
      this.scene.add(glow);

      // Add point light at the glow
      const light = new THREE.PointLight(nodeColors[i], 0.3, 4);
      light.position.copy(glow.position);
      this.scene.add(light);

      // Make the stone activatable
      const interactable = new Interactable(stone.children[0], {
        type: 'activate',
        onActivate: () => this._onNodeActivated(i),
      });
      this.interactionSystem.register(interactable);
      this.nodes.push({ mesh: stone, glow, light, index: i, interactable, color: nodeColors[i] });
    }

    // Add connection lines between nodes to suggest a neural network
    for (let i = 0; i < count; i++) {
      for (let j = i + 1; j < count; j++) {
        if (Math.random() > 0.5) {
          const points = [
            this.nodes[i].glow.position.clone(),
            this.nodes[j].glow.position.clone(),
          ];
          const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
          const lineMat = new THREE.LineBasicMaterial({
            color: 0x223344,
            transparent: true,
            opacity: 0.3,
          });
          const line = new THREE.Line(lineGeo, lineMat);
          this.scene.add(line);
          this._lines.push(line);
        }
      }
    }

    this.eventBus.emit('notification', { text: 'Activate the neural nodes in the correct sequence!' });
  }

  _onNodeActivated(index) {
    if (this.state !== 'active') return;

    this.playerInput.push(index);
    const step = this.playerInput.length - 1;

    this._playActivateSound(index);

    if (this.correctOrder[step] !== index) {
      // Wrong -- flash red, reset
      this._flashNode(index, 0xff0000, 1.0);
      this.playerInput = [];

      // Reset all previously activated nodes
      for (const node of this.nodes) {
        const indicator = node.mesh.children.find(c => c.userData && c.userData.runeIndicator);
        if (indicator && indicator.material) {
          indicator.material.emissive.setHex(0x222244);
          indicator.material.emissiveIntensity = 0.3;
        }
        node.glow.material.emissiveIntensity = 0.4;
        node.light.intensity = 0.3;
      }

      this.eventBus.emit('notification', { text: 'Wrong sequence! Try again.' });
      return;
    }

    // Correct -- flash green and keep it lit
    this._flashNode(index, 0x00ff00, 0.8);
    this.nodes[index].glow.material.emissiveIntensity = 1.0;
    this.nodes[index].light.intensity = 1.0;

    this.eventBus.emit('notification', {
      text: `Node ${this.playerInput.length}/${this.correctOrder.length} correct!`
    });

    if (this.playerInput.length === this.correctOrder.length) {
      this.solve();
    }
  }

  _flashNode(index, color, intensity) {
    const node = this.nodes[index];
    const indicator = node.mesh.children.find(c => c.userData && c.userData.runeIndicator);
    if (indicator && indicator.material) {
      indicator.material.emissive.setHex(color);
      indicator.material.emissiveIntensity = intensity;
      if (color === 0xff0000) {
        // Reset red flash after delay
        const tid = setTimeout(() => {
          indicator.material.emissive.setHex(0x222244);
          indicator.material.emissiveIntensity = 0.3;
        }, 600);
        this._pendingTimers.push(tid);
      }
    }
  }

  _playActivateSound(index) {
    try {
      if (!this._audioCtx) this._audioCtx = new AudioContext();
      const ctx = this._audioCtx;
      const now = ctx.currentTime;

      const frequencies = [262, 330, 392, 494, 587]; // C4, E4, G4, B4, D5
      const freq = frequencies[index % frequencies.length];

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch (e) {
      // Audio not available
    }
  }

  onSolved() {
    // Light up all nodes bright green
    for (const node of this.nodes) {
      const indicator = node.mesh.children.find(c => c.userData && c.userData.runeIndicator);
      if (indicator && indicator.material) {
        indicator.material.emissive.setHex(0x00ff00);
        indicator.material.emissiveIntensity = 1.0;
      }
      node.glow.material.emissive.setHex(0x00ff00);
      node.glow.material.emissiveIntensity = 1.5;
      node.light.color.setHex(0x00ff00);
      node.light.intensity = 2.0;
    }
    this.eventBus.emit('notification', { text: 'Neural network activated! AI consciousness unlocked!' });
  }

  dispose() {
    for (const t of this._pendingTimers) clearTimeout(t);
    this._pendingTimers.length = 0;
    for (const node of this.nodes) {
      this.scene.remove(node.mesh); node.mesh.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); });
      this.scene.remove(node.glow); if (node.glow.geometry) node.glow.geometry.dispose(); if (node.glow.material) node.glow.material.dispose();
      this.scene.remove(node.light);
    }
    for (const line of this._lines) {
      this.scene.remove(line); if (line.geometry) line.geometry.dispose(); if (line.material) line.material.dispose();
    }
    this.nodes.length = 0;
    this._lines.length = 0;
  }
}
