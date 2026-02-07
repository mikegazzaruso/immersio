import * as THREE from 'three';

const _raycaster = new THREE.Raycaster();
const _tempMatrix = new THREE.Matrix4();
const _worldPos = new THREE.Vector3();
const _worldQuat = new THREE.Quaternion();
const _worldScale = new THREE.Vector3();

export class InteractionSystem {
  constructor(engine, eventBus) {
    this.engine = engine;
    this.eventBus = eventBus;
    this.interactables = [];
    this.maxDistance = 10;

    // Per-controller state
    this._hovered = { left: null, right: null };
    this._grabbed = { left: null, right: null };
    this._grabData = { left: null, right: null };

    // Listen for input events
    eventBus.on('TRIGGER_RIGHT_DOWN', () => this._onActivate('right'));
    eventBus.on('TRIGGER_LEFT_DOWN', () => this._onActivate('left'));
    eventBus.on('GRIP_RIGHT_DOWN', () => this._onGrab('right'));
    eventBus.on('GRIP_LEFT_DOWN', () => this._onGrab('left'));
    eventBus.on('GRIP_RIGHT_UP', () => this._onRelease('right'));
    eventBus.on('GRIP_LEFT_UP', () => this._onRelease('left'));

    // Desktop interaction: click to activate, E to grab/release
    eventBus.on('desktop:activate', () => this._onDesktopActivate());
    this._desktopGrabbed = null;
    this._setupDesktopKeys();
  }

  _setupDesktopKeys() {
    document.addEventListener('keydown', (e) => {
      if (e.code === 'KeyE') {
        if (this._desktopGrabbed) {
          this._onDesktopRelease();
        } else {
          this._onDesktopGrab();
        }
      }
    });
  }

  register(interactable) {
    this.interactables.push(interactable);
  }

  unregister(interactable) {
    const idx = this.interactables.indexOf(interactable);
    if (idx !== -1) this.interactables.splice(idx, 1);
  }

  update() {
    if (this.engine.renderer.xr.isPresenting) {
      const vr = this.engine.vrSetup;
      this._updateHover('left', vr.controller0);
      this._updateHover('right', vr.controller1);
      this._updateGrabFollow('left', vr.controllerGrip0);
      this._updateGrabFollow('right', vr.controllerGrip1);
    }

    // Desktop: update grabbed object position to follow camera
    if (this._desktopGrabbed) {
      const camera = this.engine.camera;
      const dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      camera.getWorldPosition(_worldPos);
      _worldPos.addScaledVector(dir, 1.5);
      this._desktopGrabbed.mesh.position.copy(_worldPos);
    }
  }

  _getMeshes() {
    const meshes = [];
    for (const inter of this.interactables) {
      if (inter.enabled) meshes.push(inter.mesh);
    }
    return meshes;
  }

  _updateHover(hand, controller) {
    if (this._grabbed[hand]) return;

    _tempMatrix.identity().extractRotation(controller.matrixWorld);
    _raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    _raycaster.ray.direction.set(0, 0, -1).applyMatrix4(_tempMatrix);
    _raycaster.far = this.maxDistance;

    const meshes = this._getMeshes();
    const intersects = _raycaster.intersectObjects(meshes, true);

    const prev = this._hovered[hand];
    let current = null;

    if (intersects.length > 0) {
      // Walk up parent chain to find the interactable tag (handles Groups/GLB models)
      let obj = intersects[0].object;
      while (obj) {
        if (obj.userData && obj.userData.interactable) {
          const inter = obj.userData.interactable;
          if (inter.enabled) { current = inter; break; }
        }
        obj = obj.parent;
      }
    }

    if (prev !== current) {
      if (prev) this._setHoverEffect(prev, false);
      if (current) this._setHoverEffect(current, true);
      this._hovered[hand] = current;
    }
  }

  _setHoverEffect(inter, hovering) {
    const mat = inter.mesh.material;
    if (!mat || !mat.emissive) return;

    if (hovering) {
      mat.emissive.setHex(0x333333);
      if (inter.onHoverEnter) inter.onHoverEnter();
    } else {
      mat.emissive.setHex(inter._origEmissiveHex);
      if (inter.onHoverExit) inter.onHoverExit();
    }
  }

  _onActivate(hand) {
    const hovered = this._hovered[hand];
    if (!hovered) return;
    if (hovered.type === 'activate' || hovered.type === 'both') {
      if (hovered.onActivate) hovered.onActivate(hand);
    }
  }

  _onGrab(hand) {
    const hovered = this._hovered[hand];
    if (!hovered) return;
    if (hovered.type !== 'grab' && hovered.type !== 'both') return;

    const mesh = hovered.mesh;
    const vr = this.engine.vrSetup;
    const gripSpace = hand === 'left' ? vr.controllerGrip0 : vr.controllerGrip1;

    // Store original parent and world transform
    mesh.getWorldPosition(_worldPos);
    mesh.getWorldQuaternion(_worldQuat);
    mesh.getWorldScale(_worldScale);

    this._grabData[hand] = {
      interactable: hovered,
      originalParent: mesh.parent,
      originalPosition: mesh.position.clone(),
      originalQuaternion: mesh.quaternion.clone(),
    };

    // Re-parent to grip space
    mesh.removeFromParent();
    gripSpace.add(mesh);

    // Convert world transform to grip-local
    gripSpace.worldToLocal(_worldPos);
    mesh.position.copy(_worldPos);

    const gripWorldQuat = new THREE.Quaternion();
    gripSpace.getWorldQuaternion(gripWorldQuat);
    mesh.quaternion.copy(gripWorldQuat.invert().multiply(_worldQuat));

    this._grabbed[hand] = hovered;
    this._setHoverEffect(hovered, false);
    this._hovered[hand] = null;

    if (hovered.onGrab) hovered.onGrab(hand);
  }

  _onRelease(hand) {
    const grabbed = this._grabbed[hand];
    if (!grabbed) return;

    const data = this._grabData[hand];
    const mesh = grabbed.mesh;

    // Get current world position before re-parenting
    mesh.getWorldPosition(_worldPos);
    mesh.getWorldQuaternion(_worldQuat);

    // Re-parent to original parent
    mesh.removeFromParent();
    if (data.originalParent) {
      data.originalParent.add(mesh);
      data.originalParent.worldToLocal(_worldPos);
      mesh.position.copy(_worldPos);

      const parentWorldQuat = new THREE.Quaternion();
      data.originalParent.getWorldQuaternion(parentWorldQuat);
      mesh.quaternion.copy(parentWorldQuat.invert().multiply(_worldQuat));
    }

    if (grabbed.onRelease) grabbed.onRelease(hand, _worldPos);

    this._grabbed[hand] = null;
    this._grabData[hand] = null;
  }

  _updateGrabFollow() {
    // Objects follow automatically since they're parented to grip space
  }

  // ─── Desktop interaction ────────────────────────────────

  _getDesktopTarget() {
    const camera = this.engine.camera;
    _raycaster.setFromCamera({ x: 0, y: 0 }, camera);
    _raycaster.far = this.maxDistance;

    const meshes = this._getMeshes();
    const intersects = _raycaster.intersectObjects(meshes, true);

    if (intersects.length > 0) {
      // Walk up to find the mesh with the interactable tag
      let obj = intersects[0].object;
      while (obj) {
        if (obj.userData && obj.userData.interactable) {
          const inter = obj.userData.interactable;
          if (inter.enabled) return inter;
        }
        obj = obj.parent;
      }
    }
    return null;
  }

  _onDesktopActivate() {
    const target = this._getDesktopTarget();
    if (!target) return;
    if (target.type === 'activate' || target.type === 'both') {
      if (target.onActivate) target.onActivate('desktop');
    }
  }

  _onDesktopGrab() {
    const target = this._getDesktopTarget();
    if (!target) return;
    if (target.type !== 'grab' && target.type !== 'both') return;

    this._desktopGrabbed = target;
    if (target.onGrab) target.onGrab('desktop');
  }

  _onDesktopRelease() {
    if (!this._desktopGrabbed) return;
    const mesh = this._desktopGrabbed.mesh;
    mesh.getWorldPosition(_worldPos);

    if (this._desktopGrabbed.onRelease) {
      this._desktopGrabbed.onRelease('desktop', _worldPos);
    }

    this._desktopGrabbed = null;
  }
}
