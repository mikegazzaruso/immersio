import * as THREE from 'three';

const _playerBox = new THREE.Box3();

export class CollisionSystem {
  constructor() {
    this.colliders = [];
    this.playerHalfWidth = 0.25;
    this.playerHeight = 1.8;
    this.groundY = 0;
    this._onSurface = false;
    this._lastY = null; // previous frame resolved Y for anti-tunneling
  }

  get isOnSurface() {
    return this._onSurface;
  }

  addCollider(box3) {
    this.colliders.push(box3);
    return box3;
  }

  addBoxCollider(x, y, z, w, h, d) {
    const box = new THREE.Box3(
      new THREE.Vector3(x - w / 2, y, z - d / 2),
      new THREE.Vector3(x + w / 2, y + h, z + d / 2)
    );
    this.colliders.push(box);
    return box;
  }

  clear() {
    this.colliders.length = 0;
    this._lastY = null;
  }

  setGroundPlane(y) {
    this.groundY = y;
  }

  addMeshCollider(mesh) {
    mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox.clone();
    box.applyMatrix4(mesh.matrixWorld);
    this.colliders.push(box);
    return box;
  }

  update(cameraRig) {
    const pos = cameraRig.position;
    const prevY = this._lastY ?? pos.y;
    this._onSurface = false;

    const skin = 0.06;
    const hw = this.playerHalfWidth;

    _playerBox.min.set(pos.x - hw, pos.y - skin, pos.z - hw);
    _playerBox.max.set(pos.x + hw, pos.y + this.playerHeight, pos.z + hw);

    // --- Pass 1: standard AABB collision resolution ---
    for (const collider of this.colliders) {
      if (!_playerBox.intersectsBox(collider)) continue;

      const overlapX1 = _playerBox.max.x - collider.min.x;
      const overlapX2 = collider.max.x - _playerBox.min.x;
      const overlapY1 = _playerBox.max.y - collider.min.y;
      const overlapY2 = collider.max.y - _playerBox.min.y;
      const overlapZ1 = _playerBox.max.z - collider.min.z;
      const overlapZ2 = collider.max.z - _playerBox.min.z;

      const minOverlapX = Math.min(overlapX1, overlapX2);
      const minOverlapY = Math.min(overlapY1, overlapY2);
      const minOverlapZ = Math.min(overlapZ1, overlapZ2);

      if (minOverlapY <= minOverlapX && minOverlapY <= minOverlapZ) {
        if (overlapY2 < overlapY1) {
          pos.y = collider.max.y;
          this._onSurface = true;
        } else {
          pos.y = collider.min.y - this.playerHeight;
        }
      } else if (minOverlapX < minOverlapZ) {
        if (overlapX1 < overlapX2) {
          pos.x -= overlapX1;
        } else {
          pos.x += overlapX2;
        }
      } else {
        if (overlapZ1 < overlapZ2) {
          pos.z -= overlapZ1;
        } else {
          pos.z += overlapZ2;
        }
      }

      _playerBox.min.set(pos.x - hw, pos.y - skin, pos.z - hw);
      _playerBox.max.set(pos.x + hw, pos.y + this.playerHeight, pos.z + hw);
    }

    // --- Pass 2: anti-tunneling sweep ---
    // If player was above a collider last frame but is now below it,
    // they tunneled through. Snap them back on top.
    if (!this._onSurface && pos.y < prevY) {
      for (const collider of this.colliders) {
        // Check XZ overlap (player footprint intersects platform)
        if (pos.x + hw > collider.min.x && pos.x - hw < collider.max.x &&
            pos.z + hw > collider.min.z && pos.z - hw < collider.max.z) {
          // Player was at or above collider top, now below it
          if (prevY >= collider.max.y - 0.01 && pos.y < collider.max.y) {
            pos.y = collider.max.y;
            this._onSurface = true;
            break;
          }
        }
      }
    }

    // Ground clamp
    if (pos.y <= this.groundY) {
      pos.y = this.groundY;
      this._onSurface = true;
    }

    this._lastY = pos.y;
  }
}
