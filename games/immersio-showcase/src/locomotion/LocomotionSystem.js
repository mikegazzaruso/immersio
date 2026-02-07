import * as THREE from 'three';
import { InputActions } from '../input/InputActions.js';

const _moveDir = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _camWorldPos = new THREE.Vector3();
const _euler = new THREE.Euler();
const _quat = new THREE.Quaternion();

export class LocomotionSystem {
  constructor(engine, inputManager, eventBus) {
    this.engine = engine;
    this.input = inputManager;
    this.eventBus = eventBus;
    this.speed = 4.0;
    this.snapAngle = Math.PI / 4;
    this.snapCooldown = 0.3;
    this._snapTimer = 0;

    // Jump
    this.jumpSpeed = 4.5;
    this.boostSpeed = 7.5;
    this.gravity = -12.0;
    this.floatGravity = -5.0;
    this.velocityY = 0;
    this._isGrounded = true;
    this._canDoubleJump = false;
    this._usedDoubleJump = false;
    this._audioCtx = null;

    eventBus.on(InputActions.B_RIGHT_DOWN, () => this.jump());
  }

  jump() {
    if (this._isGrounded) {
      this._isGrounded = false;
      this._canDoubleJump = true;
      this._usedDoubleJump = false;
      this.velocityY = this.jumpSpeed;
    } else if (this._canDoubleJump) {
      this._canDoubleJump = false;
      this._usedDoubleJump = true;
      this.velocityY = this.boostSpeed;
      this._playSpringSound();
    }
  }

  update(dt) {
    this._updateMove(dt);
    this._updateSnapTurn(dt);
    this._updateJump(dt);
  }

  postUpdate(collisionSystem) {
    if (collisionSystem.isOnSurface && this.velocityY <= 0) {
      this._isGrounded = true;
      this.velocityY = 0;
      this._usedDoubleJump = false;
    } else if (!collisionSystem.isOnSurface && this._isGrounded) {
      this._isGrounded = false;
      this.velocityY = 0;
    }
  }

  _updateMove(dt) {
    const mx = this.input.get(InputActions.MOVE_X);
    const my = this.input.get(InputActions.MOVE_Y);
    if (mx === 0 && my === 0) return;

    const camera = this.engine.camera;
    const rig = this.engine.cameraRig;

    camera.getWorldQuaternion(_quat);
    _euler.setFromQuaternion(_quat, 'YXZ');
    _euler.x = 0;
    _euler.z = 0;

    _forward.set(0, 0, -1).applyEuler(_euler);
    _right.set(1, 0, 0).applyEuler(_euler);

    _moveDir.set(0, 0, 0);
    _moveDir.addScaledVector(_right, mx);
    _moveDir.addScaledVector(_forward, -my);
    _moveDir.y = 0;

    if (_moveDir.lengthSq() > 0) {
      _moveDir.normalize();
      rig.position.addScaledVector(_moveDir, this.speed * dt);
    }
  }

  _updateSnapTurn(dt) {
    if (this._snapTimer > 0) {
      this._snapTimer -= dt;
      return;
    }

    const tx = this.input.get(InputActions.TURN_X);
    if (tx === 0) return;

    const angle = tx > 0 ? -this.snapAngle : this.snapAngle;
    const rig = this.engine.cameraRig;
    const camera = this.engine.camera;

    camera.getWorldPosition(_camWorldPos);

    rig.position.sub(_camWorldPos);
    rig.position.applyAxisAngle(THREE.Object3D.DEFAULT_UP, angle);
    rig.position.add(_camWorldPos);
    rig.rotateY(angle);

    this._snapTimer = this.snapCooldown;
  }

  _updateJump(dt) {
    if (this._isGrounded) return;

    const g = (this._usedDoubleJump && this.velocityY < 0) ? this.floatGravity : this.gravity;
    this.velocityY += g * dt;
    this.engine.cameraRig.position.y += this.velocityY * dt;
  }

  _playSpringSound() {
    try {
      if (!this._audioCtx) this._audioCtx = new AudioContext();
      const ctx = this._audioCtx;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(200, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.2);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.25);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(400, now);
      osc2.frequency.exponentialRampToValueAtTime(1200, now + 0.06);
      osc2.frequency.exponentialRampToValueAtTime(600, now + 0.15);
      gain2.gain.setValueAtTime(0.15, now);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
      osc2.connect(gain2).connect(ctx.destination);
      osc2.start(now);
      osc2.stop(now + 0.2);
    } catch (e) {
      // Audio not available
    }
  }
}
