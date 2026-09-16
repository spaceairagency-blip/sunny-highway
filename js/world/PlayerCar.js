import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { preloadCarModel, createCarInstance, spinWheel } from './CarModel.js';

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

    // Per-car handling profile from the store (see CARS in config.js).
    // Multipliers on top of the base CONFIG physics, so retuning the base
    // car retunes every car in the garage with it. Defaults to the
    // neutral 1.0 profile until setCarProfile() says otherwise.
    this.stats = { speed: 1, accel: 1, grip: 1, nitro: 1 };
  }

  // Apply a store car's paint + handling profile in one call.
  setCarProfile(car) {
    if (!car) return;
    this.stats = { speed: 1, accel: 1, grip: 1, nitro: 1, ...(car.stats || {}) };
    this.setLivery(car.color);
    // A bigger tank means the bar should start full at the new capacity.
    this.nitro = this.maxNitro();
  }

  maxNitro() {
    return CONFIG.NITRO_MAX * this.stats.nitro;
  }

  async load(onProgress) {
    // Load (or reuse, if traffic/race code already triggered it) the one
    // shared car.glb template, then take our own instance from it. The
    // player keeps its own real light rig (see _addLights below) rather
    // than the cheap cosmetic plates non-player cars get, since there's
    // only ever one player car to light.
    await preloadCarModel(onProgress);
    const instance = createCarInstance({ withCosmeticLights: false });
    this.mesh.add(instance.group);
    this.model = instance.model;
    this.wheelNodes = instance.wheelNodes;
    this._bodyMat = instance.bodyMat;
    this._bodyMatBaseColor = instance.bodyBaseColor;
    this._addLights();
    this.loaded = true;
  }

  _addLights() {
    // Headlight glow — dim by default (daytime), ThemeManager brightens
    // these for night themes via setHeadlightIntensity(). Two parts each:
    // a SpotLight that actually throws a real beam down the road (this is
    // what makes night driving look properly lit instead of just having a
    // faint glow near the bumper), plus a small emissive bulb mesh so the
    // headlight is visibly "on" even when looking at the car itself.
    this._headlightSpots = [];
    this._headlightBulbMats = [];
    [-0.5, 0.5].forEach((x) => {
      const spot = new THREE.SpotLight(0xfff6d8, 0, 40, Math.PI / 7, 0.45, 1.2);
      spot.position.set(x, 0.55, 1.9);
      const target = new THREE.Object3D();
      target.position.set(x * 0.6, 0.1, 14); // aim well down the road ahead
      this.mesh.add(target);
      spot.target = target;
      this.mesh.add(spot);
      this._headlightSpots.push(spot);

      const bulbGeo = new THREE.CircleGeometry(0.11, 12);
      const bulbMat = new THREE.MeshBasicMaterial({ color: 0xfff6d8, transparent: true, opacity: 0 });
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.set(x, 0.55, 1.92);
      this.mesh.add(bulb);
      this._headlightBulbMats.push(bulbMat);
    });

    // Close-range point light too, so the tarmac right in front of the
    // bumper isn't left dark by the spotlight's narrower cone.
    const headL = new THREE.PointLight(0xfff6d8, 0.15, 9);
    headL.position.set(-0.5, 0.5, 1.9);
    const headR = new THREE.PointLight(0xfff6d8, 0.15, 9);
    headR.position.set(0.5, 0.5, 1.9);
    this.mesh.add(headL, headR);
    this._headlightGlow = [headL, headR];

    // Rear brake-light glow, brighter when braking
    const brakeGlow = new THREE.PointLight(0xff3333, 0.25, 3.5);
    brakeGlow.position.set(0, 0.5, -1.9);
    this.mesh.add(brakeGlow);
    this._brakeGlow = brakeGlow;

    // this._bodyMat / this._bodyMatBaseColor are already set from the
    // CarModel instance in load() — CarModel.createCarInstance() clones
    // the shared "car_body" material once per car so livery changes here
    // only ever touch this one car.
  }

  // Tint the car's paint. `hexColor` is a '#rrggbb' string or 0xrrggbb int.
  setLivery(hexColor) {
    if (this._bodyMat) this._bodyMat.color.set(hexColor);
  }

  // 0 = daytime-dim headlights, 1 = full night-driving brightness.
  setHeadlightIntensity(t) {
    if (!this._headlightGlow) return;
    const pointIntensity = 0.15 + t * 1.35;
    this._headlightGlow.forEach((l) => { l.intensity = pointIntensity; });
    // Spotlight is what actually lights the road at night — daytime keeps
    // it fully off (0) since a lit beam looks wrong in bright sunlight,
    // and night ramps it up to a genuinely bright, visible-beam value.
    if (this._headlightSpots) this._headlightSpots.forEach((s) => { s.intensity = t * 55; });
    if (this._headlightBulbMats) this._headlightBulbMats.forEach((m) => { m.opacity = t; });
  }

  reset() {
    this.speed = 0;
    this.lateralX = 0;
    this.steerInput = 0;
    this.isDrifting = false;
    this.isNitro = false;
    this.nitro = this.maxNitro();
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
    this.lateralX += this.steerInput * CONFIG.CAR_STEER_SPEED * this.stats.grip * lateralMult * speedFactor * dt;
    this.lateralX = THREE.MathUtils.clamp(this.lateralX, CONFIG.CAR_MIN_X, CONFIG.CAR_MAX_X);

    // --- Nitro ---
    this.isNitro = input.nitro && this.nitro > 0.5 && !input.brake;
    if (this.isNitro) {
      this.nitro = Math.max(0, this.nitro - CONFIG.NITRO_DRAIN_PER_SEC * dt);
    } else {
      this.nitro = Math.min(this.maxNitro(), this.nitro + CONFIG.NITRO_REGEN_PER_SEC * this.stats.nitro * dt);
    }

    const maxSpeed = (this.isNitro ? CONFIG.CAR_MAX_SPEED_NITRO : CONFIG.CAR_MAX_SPEED) * this.stats.speed;

    // --- Longitudinal physics ---
    if (input.accelerate) {
      const accel = (this.isNitro ? CONFIG.CAR_ACCEL * 1.8 : CONFIG.CAR_ACCEL) * this.stats.accel;
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

    // Wheel spin visualization — physically correct: angle = distance / radius,
    // so the wheels' visible spin rate matches actual ground speed.
    const distanceThisFrame = this.speed * dt;
    for (const w of this.wheelNodes) {
      spinWheel(w, distanceThisFrame);
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
