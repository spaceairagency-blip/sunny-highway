import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { CONFIG } from '../config.js';

// =========================================================
// PlayerCar
// Loads the provided cartoon_car.glb model and drives it with
// arcade-style physics: acceleration, braking, lateral steer,
// drift slide, nitro boost, and visual body-roll / wheel spin.
// =========================================================

export class PlayerCar {
  constructor(scene, road) {
    this.scene = scene;
    this.road = road; // gives access to the curved RoadPath for positioning
    this.mesh = new THREE.Group();
    this.mesh.position.set(0, 0, 0);
    scene.add(this.mesh);

    this.wheelNodes = [];
    this.loaded = false;

    // Physics state
    this.speed = 0;              // forward m/s
    this.lateralX = 0;           // current x position (world-ish, local to lane space)
    this.steerInput = 0;         // -1..1 smoothed
    this.isDrifting = false;
    this.isNitro = false;
    this.nitro = CONFIG.NITRO_MAX;
    this.distanceTravelled = 0;
    this.crashed = false;

    this._headlightGlow = null;
    this._exhaustParticles = [];
  }

  async load(onProgress) {
    const loader = new GLTFLoader();
    return new Promise((resolve, reject) => {
      loader.load(
        './assets/car/car.glb',
        (gltf) => {
          const model = gltf.scene;

          // Normalize scale/orientation. Raw model bounding box measured as
          // ~7.9 (w) x 5.0 (h) x 12.5 (l) units with floor at y ~= 1.07.
          // Scale so the car is a realistic ~4.2m long, and lift so wheels sit at y=0.
          const CAR_SCALE = 0.335;
          const FLOOR_OFFSET = 0.36;
          model.scale.setScalar(CAR_SCALE);
          model.rotation.y = Math.PI; // face away from camera, down the track
          model.position.y = -FLOOR_OFFSET;
          model.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = false;
              if (/wheel/i.test(child.name)) this.wheelNodes.push(child);
            }
          });

          this.mesh.add(model);
          this.model = model;
          this._addLights();
          this.loaded = true;
          resolve();
        },
        (xhr) => {
          if (onProgress && xhr.total) onProgress(xhr.loaded / xhr.total);
        },
        (err) => {
          console.error('Failed to load car.glb', err);
          reject(err);
        }
      );
    });
  }

  _addLights() {
    // Headlight glow — subtle, daytime scene so kept very low intensity
    const headL = new THREE.PointLight(0xffffff, 0.15, 4);
    headL.position.set(-0.5, 0.5, 1.9);
    const headR = new THREE.PointLight(0xffffff, 0.15, 4);
    headR.position.set(0.5, 0.5, 1.9);
    this.mesh.add(headL, headR);

    // Rear brake-light glow, brighter when braking
    const brakeGlow = new THREE.PointLight(0xff3333, 0.25, 3.5);
    brakeGlow.position.set(0, 0.5, -1.9);
    this.mesh.add(brakeGlow);
    this._brakeGlow = brakeGlow;
  }

  reset() {
    this.speed = 0;
    this.lateralX = 0;
    this.steerInput = 0;
    this.isDrifting = false;
    this.isNitro = false;
    this.nitro = CONFIG.NITRO_MAX;
    this.distanceTravelled = 0;
    this.crashed = false;
    this.mesh.position.set(0, 0, 0);
    this.mesh.rotation.set(0, 0, 0);
    this._yawOffset = 0;
  }

  update(dt, input) {
    if (this.crashed) return;

    // --- Steering (smoothed) ---
    // Note on sign: the chase camera sits behind the car looking forward
    // down +Z (the opposite of Three.js's default -Z look direction), which
    // flips which world axis reads as "screen right" for the viewer. So
    // steerLeft needs to be the *positive* contribution here for pressing
    // the left key to actually move the car left on screen (and steerRight
    // negative) — this was inverted before, which is why left/right felt
    // swapped.
    const targetSteer = (input.steerLeft ? 1 : 0) - (input.steerRight ? 1 : 0);
    const steerLerp = 1 - Math.exp(-CONFIG.CAR_STEER_RETURN * dt);
    this.steerInput += (targetSteer - this.steerInput) * steerLerp;

    // --- Drift state ---
    this.isDrifting = input.drift && Math.abs(this.steerInput) > 0.15 && this.speed > 8;
    const lateralMult = this.isDrifting ? CONFIG.CAR_DRIFT_LATERAL_MULT : 1;

    // --- Lateral movement ---
    const speedFactor = THREE.MathUtils.clamp(Math.abs(this.speed) / CONFIG.CAR_MAX_SPEED, 0.25, 1);
    this.lateralX += this.steerInput * CONFIG.CAR_STEER_SPEED * lateralMult * speedFactor * dt;
    this.lateralX = THREE.MathUtils.clamp(this.lateralX, CONFIG.CAR_MIN_X, CONFIG.CAR_MAX_X);

    // --- Nitro ---
    this.isNitro = input.nitro && this.nitro > 0.5 && !input.brake;
    if (this.isNitro) {
      this.nitro = Math.max(0, this.nitro - CONFIG.NITRO_DRAIN_PER_SEC * dt);
    } else {
      this.nitro = Math.min(CONFIG.NITRO_MAX, this.nitro + CONFIG.NITRO_REGEN_PER_SEC * dt);
    }

    const maxSpeed = this.isNitro ? CONFIG.CAR_MAX_SPEED_NITRO : CONFIG.CAR_MAX_SPEED;

    // --- Longitudinal physics ---
    if (input.accelerate) {
      const accel = this.isNitro ? CONFIG.CAR_ACCEL * 1.8 : CONFIG.CAR_ACCEL;
      this.speed = Math.min(maxSpeed, this.speed + accel * dt);
    } else if (input.brake) {
      this.speed -= CONFIG.CAR_BRAKE_DECEL * dt;
      if (this.speed < CONFIG.CAR_REVERSE_MAX_SPEED) this.speed = CONFIG.CAR_REVERSE_MAX_SPEED;
    } else {
      // natural coast-down toward 0
      if (this.speed > 0) this.speed = Math.max(0, this.speed - CONFIG.CAR_FRICTION_DECEL * dt);
      else if (this.speed < 0) this.speed = Math.min(0, this.speed + CONFIG.CAR_FRICTION_DECEL * dt);
    }

    if (this.speed > maxSpeed) this.speed = Math.max(maxSpeed, this.speed - CONFIG.CAR_BRAKE_DECEL * 0.5 * dt);

    // --- Advance distance along the (possibly curving) road path ---
    // distanceTravelled is now the authoritative "how far along the road"
    // value; world position is derived from it each frame via the path,
    // so the car naturally follows every bend instead of driving straight
    // through the visual curve of the track.
    this.distanceTravelled += this.speed * dt;
    if (this.distanceTravelled < 0) this.distanceTravelled = 0;

    // --- Apply transform: sample the path at our distance, offset sideways ---
    const path = this.road ? this.road.path : null;
    let roadHeading = 0;
    if (path) {
      const s = path.sample(this.distanceTravelled);
      this.mesh.position.set(
        s.position.x + s.right.x * this.lateralX,
        0,
        s.position.z + s.right.z * this.lateralX
      );
      roadHeading = s.heading;
    } else {
      // Fallback if no road reference was supplied (shouldn't happen)
      this.mesh.position.x = this.lateralX;
      this.mesh.position.z = this.distanceTravelled;
    }

    // Visual body roll + slight yaw when drifting/steering
    const targetRoll = -this.steerInput * CONFIG.CAR_TILT_MAX * (this.isDrifting ? 1.6 : 1);
    this.mesh.rotation.z += (targetRoll - this.mesh.rotation.z) * (1 - Math.exp(-8 * dt));

    // Base the car's facing on the road's heading at this point (so it
    // visibly turns through curves), plus a small extra yaw for steer/drift feel.
    this.mesh.rotation.y = roadHeading;
    const targetYaw = this.isDrifting ? -this.steerInput * 0.35 : -this.steerInput * 0.06;
    this._yawOffset = THREE.MathUtils.lerp(this._yawOffset || 0, targetYaw, 1 - Math.exp(-6 * dt));
    if (this.model) this.model.rotation.y = Math.PI + this._yawOffset;

    // Wheel spin visualization
    const wheelSpinSpeed = this.speed * dt * 2.2;
    for (const w of this.wheelNodes) {
      w.rotation.x += wheelSpinSpeed;
    }

    // Brake light intensity
    if (this._brakeGlow) {
      this._brakeGlow.intensity = input.brake ? 1.4 : 0.4;
    }
  }

  getSpeedKmh() {
    return Math.max(0, this.speed) * 3.6;
  }
}
