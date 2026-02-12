import * as THREE from 'three';

const GRID_SIZE = 50;
const GRID_DIVISIONS = 50;
const MAJOR_COLOR = 0x444466;
const MINOR_COLOR = 0x333355;

/**
 * Creates axis-appropriate grid helpers for each viewport type.
 * Front/Side/Top views get grids aligned to their respective planes.
 */
export function createGrid(viewType) {
  const group = new THREE.Group();
  group.name = `grid-${viewType}`;

  if (viewType === 'top') {
    // XZ plane (standard GridHelper orientation)
    const grid = new THREE.GridHelper(GRID_SIZE, GRID_DIVISIONS, MAJOR_COLOR, MINOR_COLOR);
    group.add(grid);
  } else if (viewType === 'front') {
    // XY plane — rotate GridHelper to face camera looking along -Z
    const grid = new THREE.GridHelper(GRID_SIZE, GRID_DIVISIONS, MAJOR_COLOR, MINOR_COLOR);
    grid.rotation.x = Math.PI / 2;
    group.add(grid);
  } else if (viewType === 'side') {
    // ZY plane — rotate GridHelper to face camera looking along -X
    const grid = new THREE.GridHelper(GRID_SIZE, GRID_DIVISIONS, MAJOR_COLOR, MINOR_COLOR);
    grid.rotation.x = Math.PI / 2;
    grid.rotation.z = Math.PI / 2;
    group.add(grid);
  } else {
    // 3D perspective — standard XZ ground grid
    const grid = new THREE.GridHelper(GRID_SIZE, GRID_DIVISIONS, MAJOR_COLOR, MINOR_COLOR);
    group.add(grid);
  }

  return group;
}

/**
 * Creates a small axis indicator gizmo for the corner of each viewport.
 * Returns a scene with its own camera that renders on top.
 */
export class AxisIndicator {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 0.1, 10);
    this.camera.position.set(0, 0, 5);
    this.camera.lookAt(0, 0, 0);

    // Axis lines
    const length = 1;
    const headLength = 0.2;
    const headWidth = 0.1;

    const xArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0),
      length, 0xff4444, headLength, headWidth
    );
    const yArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0),
      length, 0x44ff44, headLength, headWidth
    );
    const zArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0),
      length, 0x4444ff, headLength, headWidth
    );

    this.scene.add(xArrow, yArrow, zArrow);

    // Labels
    this._labels = { x: xArrow, y: yArrow, z: zArrow };
  }

  /** Sync the indicator camera's orientation with the viewport camera */
  syncCamera(viewportCamera) {
    this.camera.quaternion.copy(viewportCamera.quaternion);
    this.camera.position.set(0, 0, 5).applyQuaternion(this.camera.quaternion);
    this.camera.lookAt(0, 0, 0);
  }

  /** Render the indicator in a small corner of the given viewport region */
  render(renderer, x, y, size) {
    const savedAutoClear = renderer.autoClear;
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.setViewport(x, y, size, size);
    renderer.setScissor(x, y, size, size);
    renderer.setScissorTest(true);
    renderer.render(this.scene, this.camera);
    renderer.autoClear = savedAutoClear;
  }
}
