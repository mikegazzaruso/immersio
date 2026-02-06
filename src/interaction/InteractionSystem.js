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
    this._desktopHovered = null;

    // Listen for input events
    eventBus.on('TRIGGER_RIGHT_DOWN', () => this._onActivate('right'));
    eventBus.on('TRIGGER_LEFT_DOWN', () => this._onActivate('left'));
    eventBus.on('GRIP_RIGHT_DOWN', () => this._onGrab('right'));
    eventBus.on('GRIP_LEFT_DOWN', () => this._onGrab('left'));
    eventBus.on('GRIP_RIGHT_UP', () => this._onRelease('right'));
    eventBus.on('GRIP_LEFT_UP', () => this._onRelease('left'));

    // Desktop mode: click to activate
    eventBus.on('desktop:activate', () => this._onDesktopActivate());
  }

  register(interactable) {
    this.interactables.push(interactable);
  }

  unregister(interactable) {
    const idx = this.interactables.indexOf(interactable);
    if (idx !== -1) this.interactables.splice(idx, 1);
  }

  reset() {
    // Release any grabbed objects back to their original parent
    for (const hand of ['left', 'right']) {
      if (this._grabbed[hand]) {
        const data = this._grabData[hand];
        const mesh = this._grabbed[hand].mesh;
        if (data && data.originalParent) {
          mesh.removeFromParent();
          data.originalParent.add(mesh);
          mesh.position.copy(data.originalPosition);
          mesh.quaternion.copy(data.originalQuaternion);
        }
      }
      if (this._hovered[hand]) {
        this._setHoverEffect(this._hovered[hand], false);
      }
    }
    if (this._desktopHovered) {
      this._setHoverEffect(this._desktopHovered, false);
      this._desktopHovered = null;
    }
    this._hovered = { left: null, right: null };
    this._grabbed = { left: null, right: null };
    this._grabData = { left: null, right: null };
    this.interactables.length = 0;
  }

  setDesktopHover(interactable) {
    if (this._desktopHovered === interactable) return;
    if (this._desktopHovered) this._setHoverEffect(this._desktopHovered, false);
    if (interactable) this._setHoverEffect(interactable, true);
    this._desktopHovered = interactable;
  }

  update() {
    if (!this.engine.renderer.xr.isPresenting) return;

    const vr = this.engine.vrSetup;
    this._updateHover('left', vr.controller0);
    this._updateHover('right', vr.controller1);
    this._updateGrabFollow('left', vr.controllerGrip0);
    this._updateGrabFollow('right', vr.controllerGrip1);
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
    const intersects = _raycaster.intersectObjects(meshes, false);

    const prev = this._hovered[hand];
    let current = null;

    if (intersects.length > 0) {
      const mesh = intersects[0].object;
      const inter = mesh.userData.interactable;
      if (inter && inter.enabled) current = inter;
    }

    if (prev !== current) {
      if (prev) this._setHoverEffect(prev, false);
      if (current) this._setHoverEffect(current, true);
      this._hovered[hand] = current;
      // Update ray color
      this.engine.vrSetup.setRayHover(hand, !!current);
    }
  }

  _setHoverEffect(inter, hovering) {
    let mat = inter.mesh.material;
    if (!mat || Array.isArray(mat)) return;

    if (hovering) {
      // Clone shared/cached materials to avoid mutating all users
      if (!inter._ownsMaterial) {
        mat = mat.clone();
        inter.mesh.material = mat;
        inter._ownsMaterial = true;
      }
      if (mat.emissive) {
        inter._savedEmissiveHex = mat.emissive.getHex();
        inter._savedEmissiveIntensity = mat.emissiveIntensity;
        mat.emissive.setHex(0x00ffcc);
        mat.emissiveIntensity = 1.5;
      }
      // Scale up slightly
      inter._savedScale = inter.mesh.scale.clone();
      inter.mesh.scale.multiplyScalar(1.1);
      if (inter.onHoverEnter) inter.onHoverEnter();
    } else {
      if (mat.emissive) {
        mat.emissive.setHex(inter._savedEmissiveHex ?? inter._origEmissiveHex);
        mat.emissiveIntensity = inter._savedEmissiveIntensity ?? 1.0;
      }
      if (inter._savedScale) {
        inter.mesh.scale.copy(inter._savedScale);
        inter._savedScale = null;
      }
      if (inter.onHoverExit) inter.onHoverExit();
    }
  }

  _onActivate(hand) {
    let hovered = this._hovered[hand];
    // Also check proximity for trigger activation
    if (!hovered) {
      hovered = this._findNearbyInteractable(hand);
    }
    if (!hovered) return;
    // Don't activate items grabbed by either hand
    if (this._grabbed.left === hovered || this._grabbed.right === hovered) return;
    if (hovered.type === 'activate' || hovered.type === 'both') {
      if (hovered.onActivate) hovered.onActivate(hand);
    }
  }

  _findNearbyInteractable(hand) {
    const vr = this.engine.vrSetup;
    const grip = hand === 'left' ? vr.controllerGrip0 : vr.controllerGrip1;
    if (!grip) return null;

    grip.getWorldPosition(_worldPos);
    let closest = null;
    let closestDist = 0.6; // 60cm proximity range

    // Exclude items currently grabbed by either hand
    const grabbedLeft = this._grabbed.left;
    const grabbedRight = this._grabbed.right;

    for (const inter of this.interactables) {
      if (!inter.enabled) continue;
      if (inter === grabbedLeft || inter === grabbedRight) continue;
      const meshPos = new THREE.Vector3();
      inter.mesh.getWorldPosition(meshPos);
      const dist = _worldPos.distanceTo(meshPos);
      if (dist < closestDist) {
        closestDist = dist;
        closest = inter;
      }
    }
    return closest;
  }

  _onGrab(hand) {
    let hovered = this._hovered[hand];

    // If not hovering via ray, check proximity (hand near interactable)
    if (!hovered) {
      hovered = this._findNearbyInteractable(hand);
    }

    if (!hovered) return;
    if (hovered.type !== 'grab' && hovered.type !== 'both') return;

    // Don't grab if already grabbed by the other hand
    const otherHand = hand === 'left' ? 'right' : 'left';
    if (this._grabbed[otherHand] === hovered) return;

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

    // Hide ray while grabbing
    const ray = hand === 'left' ? this.engine.vrSetup._ray0 : this.engine.vrSetup._ray1;
    if (ray) ray.visible = false;

    if (hovered.onGrab) hovered.onGrab(hand);
  }

  _onRelease(hand) {
    const grabbed = this._grabbed[hand];
    if (!grabbed) return;

    // Show ray again
    const ray = hand === 'left' ? this.engine.vrSetup._ray0 : this.engine.vrSetup._ray1;
    if (ray) ray.visible = true;

    const data = this._grabData[hand];
    const mesh = grabbed.mesh;

    // Get current world position before re-parenting
    mesh.getWorldPosition(_worldPos);
    mesh.getWorldQuaternion(_worldQuat);

    // Save world position for onRelease callback
    const releaseWorldPos = _worldPos.clone();

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

    if (grabbed.onRelease) grabbed.onRelease(hand, releaseWorldPos);

    this._grabbed[hand] = null;
    this._grabData[hand] = null;
  }

  _onDesktopActivate() {
    const camera = this.engine.camera;
    _raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    _raycaster.far = this.maxDistance;

    const meshes = this._getMeshes();
    const intersects = _raycaster.intersectObjects(meshes, false);

    if (intersects.length > 0) {
      const mesh = intersects[0].object;
      const inter = mesh.userData.interactable;
      if (inter && inter.enabled) {
        if (inter.type === 'activate' || inter.type === 'both') {
          if (inter.onActivate) inter.onActivate('desktop');
        }
      }
    }
  }

  _updateGrabFollow() {
    // Objects follow automatically since they're parented to grip space
  }
}
