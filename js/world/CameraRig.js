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

  update(dt, playerCar) {
    // Follow the car in the road's local curve frame: sample the path a
    // little behind/ahead of the car's actual distance and offset along
    // its right/forward vectors, so the chase camera swings around bends
    // with the road instead of just trailing straight down world Z.
    const path = playerCar.road ? playerCar.road.path : null;

    let targetPos, lookTarget;
    if (path) {
      const behindDist = playerCar.distanceTravelled + CONFIG.CAM_BASE_OFFSET.z; // z offset is negative -> behind
      const behind = path.sample(Math.max(0, behindDist));
      const carLateral = playerCar.lateralX;

      targetPos = new THREE.Vector3(
        behind.position.x + behind.right.x * (carLateral * 0.5 + CONFIG.CAM_BASE_OFFSET.x),
        CONFIG.CAM_BASE_OFFSET.y,
        behind.position.z + behind.right.z * (carLateral * 0.5 + CONFIG.CAM_BASE_OFFSET.x)
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
