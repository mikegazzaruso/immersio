import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

export class AssetLoader {
  constructor() {
    this._dracoLoader = new DRACOLoader();
    this._dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
    this._dracoLoader.setDecoderConfig({ type: 'js' });

    this._gltfLoader = new GLTFLoader();
    this._gltfLoader.setDRACOLoader(this._dracoLoader);

    this._cache = new Map();
  }

  async load(path, opts = {}) {
    let original = this._cache.get(path);

    if (!original) {
      const gltf = await new Promise((resolve, reject) => {
        this._gltfLoader.load(path, resolve, undefined, reject);
      });
      original = gltf.scene;
      this._cache.set(path, original);
    }

    const model = original.clone();

    if (opts.position) model.position.copy(opts.position);
    if (opts.scale != null) {
      if (typeof opts.scale === 'number') {
        model.scale.setScalar(opts.scale);
      } else {
        model.scale.copy(opts.scale);
      }
    }
    if (opts.rotationY != null) model.rotation.y = opts.rotationY;

    return model;
  }

  async preload(paths) {
    await Promise.all(paths.map(p => this.load(p)));
  }

  dispose() {
    for (const [, obj] of this._cache) {
      obj.traverse((child) => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => {
              if (m.map) m.map.dispose();
              m.dispose();
            });
          } else {
            if (child.material.map) child.material.map.dispose();
            child.material.dispose();
          }
        }
      });
    }
    this._cache.clear();
    this._dracoLoader.dispose();
  }
}
