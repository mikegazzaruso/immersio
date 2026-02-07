import * as THREE from 'three';

const _euler = new THREE.Euler(0, 0, 0, 'YXZ');

export class DesktopControls {
  constructor(engine) {
    this.engine = engine;
    this._keys = {};
    this._setupListeners();
  }

  _setupListeners() {
    document.addEventListener('keydown', (e) => { this._keys[e.code] = true; });
    document.addEventListener('keyup', (e) => { this._keys[e.code] = false; });

    this.engine.renderer.domElement.addEventListener('mousedown', () => {
      this.engine.renderer.domElement.requestPointerLock();
    });

    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== this.engine.renderer.domElement) return;
      _euler.setFromQuaternion(this.engine.camera.quaternion);
      _euler.y -= e.movementX * 0.002;
      _euler.x -= e.movementY * 0.002;
      _euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, _euler.x));
      this.engine.camera.quaternion.setFromEuler(_euler);
    });

    // Click = activate (A button equivalent)
    this.engine.renderer.domElement.addEventListener('click', () => {
      if (document.pointerLockElement === this.engine.renderer.domElement) {
        this.engine.eventBus.emit('desktop:activate');
      }
    });
  }

  update(dt) {
    const speed = {{MOVE_SPEED}};
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();

    this.engine.camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();
    right.crossVectors(forward, THREE.Object3D.DEFAULT_UP).normalize();

    const move = new THREE.Vector3();
    if (this._keys['KeyW']) move.add(forward);
    if (this._keys['KeyS']) move.sub(forward);
    if (this._keys['KeyD']) move.add(right);
    if (this._keys['KeyA']) move.sub(right);

    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed * dt);
      this.engine.cameraRig.position.add(move);
    }

    // Space to jump
    if (this._keys['Space']) {
      this.engine.locomotion.jump();
      this._keys['Space'] = false;
    }

    // Apply jump physics in desktop mode too
    this.engine.locomotion._updateJump(dt);
  }

  get keys() {
    return this._keys;
  }
}
