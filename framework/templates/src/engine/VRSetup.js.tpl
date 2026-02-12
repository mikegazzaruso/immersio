import * as THREE from 'three';
import { XRHandModelFactory } from 'three/addons/webxr/XRHandModelFactory.js';

export class VRSetup {
  constructor(engine) {
    this.engine = engine;
    this.controller0 = null;
    this.controller1 = null;
    this.controllerGrip0 = null;
    this.controllerGrip1 = null;
    this.hand0 = null;
    this.hand1 = null;
    this._handModelFactory = new XRHandModelFactory();
  }

  init() {
    const renderer = this.engine.renderer;
    const rig = this.engine.cameraRig;

    // Controllers (ray origins)
    this.controller0 = renderer.xr.getController(0);
    this.controller1 = renderer.xr.getController(1);
    rig.add(this.controller0);
    rig.add(this.controller1);

    // Controller grip spaces - show hand meshes instead of controller models
    this.controllerGrip0 = renderer.xr.getControllerGrip(0);
    this.controllerGrip0.add(this._createHandMesh(true));
    rig.add(this.controllerGrip0);

    this.controllerGrip1 = renderer.xr.getControllerGrip(1);
    this.controllerGrip1.add(this._createHandMesh(false));
    rig.add(this.controllerGrip1);

    // Hand tracking (shows real hand mesh when controllers are put down)
    this.hand0 = renderer.xr.getHand(0);
    this.hand0.add(this._handModelFactory.createHandModel(this.hand0, 'mesh'));
    rig.add(this.hand0);

    this.hand1 = renderer.xr.getHand(1);
    this.hand1.add(this._handModelFactory.createHandModel(this.hand1, 'mesh'));
    rig.add(this.hand1);

    // Hide hand meshes on grips when real hand tracking is active
    this.hand0.addEventListener('connected', () => {
      this.controllerGrip0.visible = false;
    });
    this.hand0.addEventListener('disconnected', () => {
      this.controllerGrip0.visible = true;
    });
    this.hand1.addEventListener('connected', () => {
      this.controllerGrip1.visible = false;
    });
    this.hand1.addEventListener('disconnected', () => {
      this.controllerGrip1.visible = true;
    });

    this._createVRButton();
  }

  _createHandMesh(isLeft) {
    const group = new THREE.Group();
    const skin = new THREE.MeshLambertMaterial({ color: 0xddaa88 });

    // Palm
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.02, 0.09), skin);
    palm.position.set(0, 0, 0.02);
    group.add(palm);

    // 4 Fingers
    const fingerOffsets = [-0.024, -0.008, 0.008, 0.024];
    const fingerLengths = [0.05, 0.06, 0.055, 0.04];
    for (let i = 0; i < 4; i++) {
      const finger = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, 0.012, fingerLengths[i]),
        skin
      );
      finger.position.set(fingerOffsets[i], 0, -0.025 - fingerLengths[i] / 2);
      group.add(finger);
    }

    // Thumb
    const thumb = new THREE.Mesh(
      new THREE.BoxGeometry(0.014, 0.014, 0.04),
      skin
    );
    const side = isLeft ? 1 : -1;
    thumb.position.set(side * 0.04, 0, 0.01);
    thumb.rotation.y = side * 0.6;
    group.add(thumb);

    // Orient hand to match controller grip pose
    group.rotation.x = -Math.PI / 4;
    group.rotation.z = isLeft ? Math.PI / 2 : -Math.PI / 2;

    return group;
  }

  _createVRButton() {
    if (!('xr' in navigator)) {
      this._showButton('VR NOT SUPPORTED', false);
      return;
    }

    navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
      if (supported) {
        this._showButton('ENTER VR', true);
      } else {
        this._showButton('VR NOT SUPPORTED', false);
      }
    });
  }

  _showButton(text, enabled) {
    const btn = document.createElement('button');
    btn.id = 'vr-button';
    btn.textContent = text;
    btn.disabled = !enabled;
    btn.style.cssText = 'position:absolute;bottom:20px;left:50%;transform:translateX(-50%);padding:12px 24px;background:rgba(0,0,0,0.7);color:#fff;border:1px solid #fff;border-radius:4px;font:normal 16px sans-serif;cursor:pointer;z-index:999;';
    document.body.appendChild(btn);

    if (!enabled) return;

    const renderer = this.engine.renderer;
    let currentSession = null;

    const onSessionStarted = (session) => {
      session.addEventListener('end', onSessionEnded);
      renderer.xr.setSession(session);
      currentSession = session;
      btn.textContent = 'EXIT VR';
    };

    const onSessionEnded = () => {
      currentSession = null;
      btn.textContent = 'ENTER VR';
    };

    btn.addEventListener('click', () => {
      if (currentSession) {
        currentSession.end();
      } else {
        navigator.xr.requestSession('immersive-vr', {
          optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking', 'layers']
        }).then(onSessionStarted);
      }
    });
  }

  getLeftController() {
    return { ray: this.controller0, grip: this.controllerGrip0 };
  }

  getRightController() {
    return { ray: this.controller1, grip: this.controllerGrip1 };
  }
}
