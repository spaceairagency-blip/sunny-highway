import * as THREE from 'three';
import { CONFIG } from '../config.js';

// =========================================================
// CameraRig
// Smooth chase camera that follows the player car, widens FOV
// under nitro for a speed-rush feel, and shakes on crash.
// =========================================================

export class CameraRig {
  constructor(aspect) {
    this.camera = new THREE.PerspectiveCamera(CONFIG.CAM_FOV_BASE, aspect, 0.1, 400);
    this.shakeTime = 0;
    this.shakeStrength = 0;
  }

  setAspect(aspect) {
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
  }

  triggerCrashShake() {
    this.shakeTime = 0.5;
    this.shakeStrength = CONFIG.CAM_SHAKE_ON_CRASH;
  }

  // Called whenever a run (endless or race) restarts, so the camera
  // snaps straight to the correct framing again instead of lerping in
  // from wherever it happened to be sitting (e.g. mid-pause, or after a
  // crash flung it around with shake).
  resetFraming() {
    this._initialized = false;
  }

  update(dt, playerCar) {
    // Follow the car in the road's local curve frame: offset behind/above
    // the car along the road's own forward/right vectors AT THE CAR'S
    // POSITION, so the chase camera swings around bends with the road
    // instead of just trailing straight down world Z.
    //
    // Important: this offsets from the car's own sample, not from a
    // separately-sampled "distance behind" point — sampling a distance of
    // (distanceTravelled + CAM_BASE_OFFSET.z) directly used to collapse to
    // the road's start (distance 0) for the first ~8.5m of every run,
    // since that value is negative right at the start line and had to be
    // clamped — which put the camera almost on top of the car instead of
    // behind it, making the car nearly invisible for the first moment of
    // every run.
    const path = playerCar.road ? playerCar.road.path : null;

    let targetPos, lookTarget;
    if (path) {
      const carLateral = playerCar.lateralX;
      const carSample = path.sample(playerCar.distanceTravelled);

      targetPos = new THREE.Vector3(
        carSample.position.x
          + carSample.forward.x * CONFIG.CAM_BASE_OFFSET.z
          + carSample.right.x * (carLateral * 0.5 + CONFIG.CAM_BASE_OFFSET.x),
        CONFIG.CAM_BASE_OFFSET.y,
        carSample.position.z
          + carSample.forward.z * CONFIG.CAM_BASE_OFFSET.z
          + carSample.right.z * (carLateral * 0.5 + CONFIG.CAM_BASE_OFFSET.x)
      );

      const aheadDist = playerCar.distanceTravelled + CONFIG.CAM_LOOKAHEAD;
      const ahead = path.sample(aheadDist);
      lookTarget = new THREE.Vector3(
        ahead.position.x + ahead.right.x * (carLateral * 0.7),
        0.8,
        ahead.position.z + ahead.right.z * (carLateral * 0.7)
      );
    } else {
      targetPos = new THREE.Vector3(
        playerCar.mesh.position.x * 0.5 + CONFIG.CAM_BASE_OFFSET.x,
        CONFIG.CAM_BASE_OFFSET.y,
        playerCar.mesh.position.z + CONFIG.CAM_BASE_OFFSET.z
      );
      lookTarget = new THREE.Vector3(
        playerCar.mesh.position.x * 0.7,
        0.8,
        playerCar.mesh.position.z + CONFIG.CAM_LOOKAHEAD
      );
    }

    // Snap straight to the target on the very first update instead of
    // lerping in from three.js's default (0,0,0) camera position — so
    // the very first rendered frame already frames the car correctly
    // instead of taking a fraction of a second to catch up.
    if (!this._initialized) {
      this.camera.position.copy(targetPos);
      this._initialized = true;
    }

    const followLerp = 1 - Math.exp(-6 * dt);
    this.camera.position.lerp(targetPos, followLerp);

    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const s = this.shakeStrength * (this.shakeTime / 0.5);
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }

    this.camera.lookAt(lookTarget);

    // FOV punch when boosting for speed sensation
    const targetFov = playerCar.isNitro ? CONFIG.CAM_FOV_BOOST : CONFIG.CAM_FOV_BASE;
    this.camera.fov += (targetFov - this.camera.fov) * (1 - Math.exp(-5 * dt));
    this.camera.updateProjectionMatrix();
  }
}
