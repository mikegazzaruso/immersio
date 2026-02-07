export class Interactable {
  constructor(mesh, options = {}) {
    this.mesh = mesh;
    this.type = options.type || 'activate'; // 'activate', 'grab', 'both'
    this.onActivate = options.onActivate || null;
    this.onGrab = options.onGrab || null;
    this.onRelease = options.onRelease || null;
    this.onHoverEnter = options.onHoverEnter || null;
    this.onHoverExit = options.onHoverExit || null;
    this.enabled = options.enabled !== undefined ? options.enabled : true;

    // Store original emissive for hover effect
    if (mesh.material && mesh.material.emissive) {
      this._origEmissiveHex = mesh.material.emissive.getHex();
    } else {
      this._origEmissiveHex = 0x000000;
    }

    // Tag the mesh so raycaster can find it
    mesh.userData.interactable = this;
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }
}
