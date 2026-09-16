import * as THREE from 'three';
import { CONFIG, COLORS, laneCenters } from '../config.js';
import { createCarInstance, spinWheel } from './CarModel.js';

// =========================================================
// TrafficManager
// Spawns traffic cars — the same car.glb model the player drives,
// just repainted — in lanes ahead of the player and recycles them
// once passed. Also spawns nitro pickups. Difficulty (speed/density)
// ramps with distance.
//
// Cars within a lane are kept from clipping through each other via
// _resolveLaneSpacing(): since lanes are fixed at spawn time, a
// faster car spawned behind a slower one in the same lane would
// otherwise drive straight through it as it caught up. Each frame we
// sort every lane's cars by how far along the road they are and clamp
// any car that's caught up too close to the one ahead of it (and cap
// its speed to match), like simple adaptive cruise control.
// =========================================================

// Reuses the same livery palette style as the player's paint options
// so traffic reads as "other drivers", not a different kind of car.
const TRAFFIC_COLORS = [
  '#ff3355', '#ffb500', '#3388ff', '#eeeeee', '#33ff99', '#ff2fd0',
  '#7ce02c', '#a855f7', '#ff7a1a', '#22d3ee', '#c9ccd1', '#14181d',
];

const MIN_FOLLOWING_GAP = 7; // meters — roughly one car length + a cushion

export class TrafficManager {
  constructor(scene, road) {
    this.scene = scene;
    this.road = road; // curved RoadPath reference, so traffic follows bends too
    this.group = new THREE.Group();
    scene.add(this.group);

    this.activeCars = [];
    this.activePickups = [];
    this.pool = [];
    this.pickupPool = [];

    this.nextSpawnZ = 60;
    this.laneXs = laneCenters();
  }

  _makeTrafficCarMesh() {
    const color = TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)];
    const instance = createCarInstance({ livery: color, withCosmeticLights: true, faceForward: false });
    instance.group.userData.wheelNodes = instance.wheelNodes;
    return instance.group;
  }

  _makePickupMesh() {
    const g = new THREE.Group();
    const geo = new THREE.OctahedronGeometry(0.55, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: COLORS.amber,
      emissive: COLORS.amber,
      emissiveIntensity: 0.5,
      roughness: 0.25,
      metalness: 0.4,
    });
    const core = new THREE.Mesh(geo, mat);
    core.position.y = 1.0;
    g.add(core);

    const light = new THREE.PointLight(COLORS.amber, 0.9, 6);
    light.position.y = 1.0;
    g.add(light);

    g.userData.spin = 0;
    return g;
  }

  _getTrafficCar() {
    if (this.pool.length > 0) return this.pool.pop();
    return this._makeTrafficCarMesh();
  }

  _getPickup() {
    if (this.pickupPool.length > 0) return this.pickupPool.pop();
    return this._makePickupMesh();
  }

  _difficultyT(distance) {
    return Math.min(1, distance / CONFIG.DIFFICULTY_RAMP_DISTANCE);
  }

  // Spawns one traffic car in `lane` at `roadDistance`, given it's clear.
  _spawnCarAt(roadDistance, lane, t) {
    const car = this._getTrafficCar();
    car.userData.roadDistance = roadDistance;
    car.userData.lane = lane;
    car.userData.speed = THREE.MathUtils.lerp(
      CONFIG.TRAFFIC_SPEED_MIN,
      CONFIG.TRAFFIC_SPEED_MAX,
      Math.random() * (0.4 + t * 0.6)
    );
    this._placeOnPath(car, roadDistance, lane, 0);
    car.visible = true;
    this.group.add(car);
    this.activeCars.push(car);
  }

  spawnAhead(carZ, distanceTravelled) {
    const t = this._difficultyT(distanceTravelled);
    const maxGap = THREE.MathUtils.lerp(CONFIG.TRAFFIC_MAX_GAP_START, CONFIG.TRAFFIC_MAX_GAP_END, t);
    // Fewer easy nitro pickups to lean on as things get harder — early on
    // they're generous (CONFIG.PICKUP_CHANCE), tapering toward a third of
    // that by max difficulty.
    const pickupChance = THREE.MathUtils.lerp(CONFIG.PICKUP_CHANCE, CONFIG.PICKUP_CHANCE * 0.35, t);
    // The real "levels keep getting harder" lever: as difficulty ramps,
    // an increasing fraction of spawns are a multi-lane "blockade" —
    // two or (later) three lanes occupied at the same road distance —
    // instead of always just one lone car in a random lane. This is what
    // makes later levels genuinely more complex to thread through rather
    // than reskinned repeats of the same single-car pattern forever.
    const blockadeChance = THREE.MathUtils.lerp(0, CONFIG.TRAFFIC_BLOCKADE_MAX_CHANCE, t);
    const maxBlockadeLanes = t > 0.6 ? 3 : 2;

    while (this.nextSpawnZ < carZ + CONFIG.DRAW_DISTANCE) {
      const gap = THREE.MathUtils.lerp(CONFIG.TRAFFIC_MIN_GAP, maxGap, Math.random());
      this.nextSpawnZ += gap;

      const lane = this.laneXs[Math.floor(Math.random() * this.laneXs.length)];

      if (Math.random() < pickupChance) {
        const p = this._getPickup();
        p.userData.roadDistance = this.nextSpawnZ;
        p.userData.lane = lane;
        this._placeOnPath(p, this.nextSpawnZ, lane, 1.0);
        p.visible = true;
        this.group.add(p);
        this.activePickups.push(p);
        continue;
      }

      this._spawnCarAt(this.nextSpawnZ, lane, t);

      // Occasionally back this car up with one (or, later, two) more in
      // *different* lanes at the same road distance, always leaving at
      // least one lane free so it's still fair — just no longer trivial.
      if (this.laneXs.length > 2 && Math.random() < blockadeChance) {
        const usedLanes = new Set([lane]);
        const extra = maxBlockadeLanes === 3 && Math.random() < 0.5 ? 2 : 1;
        const openSlots = this.laneXs.length - 1; // always leave >=1 lane clear
        for (let k = 0; k < Math.min(extra, openSlots); k++) {
          let candidate;
          let attempts = 0;
          do {
            candidate = this.laneXs[Math.floor(Math.random() * this.laneXs.length)];
            attempts++;
          } while (usedLanes.has(candidate) && attempts < 8);
          if (usedLanes.has(candidate)) break;
          usedLanes.add(candidate);
          // Tiny along-road stagger so a blockade doesn't look like a
          // perfectly synchronized wall — reads more like real traffic.
          this._spawnCarAt(this.nextSpawnZ + (Math.random() - 0.5) * 3, candidate, t);
        }
      }
    }
  }

  // Position a traffic object at (roadDistance, lane offset) along the
  // curved path, orienting it to face the road's heading there so it
  // visually turns through bends along with the track.
  _placeOnPath(obj, roadDistance, lateralX, extraY) {
    if (!this.road) {
      obj.position.set(lateralX, extraY, roadDistance);
      return;
    }
    const s = this.road.path.sample(roadDistance);
    obj.position.set(
      s.position.x + s.right.x * lateralX,
      extraY,
      s.position.z + s.right.z * lateralX
    );
    obj.rotation.y = s.heading;
  }

  // Prevents same-lane cars from clipping through each other: a faster
  // car that has caught up to a slower one ahead of it in the same lane
  // gets clamped to a minimum following gap and capped to the lead car's
  // speed, instead of driving straight through it.
  _resolveLaneSpacing() {
    const byLane = new Map();
    for (const car of this.activeCars) {
      const lane = car.userData.lane;
      if (!byLane.has(lane)) byLane.set(lane, []);
      byLane.get(lane).push(car);
    }
    for (const cars of byLane.values()) {
      if (cars.length < 2) continue;
      cars.sort((a, b) => a.userData.roadDistance - b.userData.roadDistance);
      for (let i = cars.length - 2; i >= 0; i--) {
        const behind = cars[i];
        const ahead = cars[i + 1];
        const maxAllowed = ahead.userData.roadDistance - MIN_FOLLOWING_GAP;
        if (behind.userData.roadDistance > maxAllowed) {
          behind.userData.roadDistance = maxAllowed;
          if (behind.userData.speed > ahead.userData.speed) {
            behind.userData.speed = ahead.userData.speed;
          }
        }
      }
    }
  }

  update(dt, carDistance) {
    // Move traffic forward along the curved path using each car's own
    // speed, resolve any same-lane overlaps, then place/recycle.
    for (const car of this.activeCars) {
      car.userData.roadDistance += car.userData.speed * dt;
    }
    this._resolveLaneSpacing();

    for (let i = this.activeCars.length - 1; i >= 0; i--) {
      const car = this.activeCars[i];
      this._placeOnPath(car, car.userData.roadDistance, car.userData.lane, 0);

      const wheelNodes = car.userData.wheelNodes;
      if (wheelNodes && wheelNodes.length) {
        const distanceThisFrame = car.userData.speed * dt;
        for (const w of wheelNodes) spinWheel(w, distanceThisFrame);
      }

      if (car.userData.roadDistance < carDistance - 20) {
        this.group.remove(car);
        car.userData.nearMissAwarded = false;
        this.pool.push(car);
        this.activeCars.splice(i, 1);
      }
    }

    for (let i = this.activePickups.length - 1; i >= 0; i--) {
      const p = this.activePickups[i];
      p.userData.spin += dt * 2.2;
      this._placeOnPath(p, p.userData.roadDistance, p.userData.lane, 1.0);
      p.position.y = 0.15 + Math.sin(p.userData.spin * 1.5) * 0.15;
      // Spin the pickup around its own vertical axis on top of the road-aligned
      // base rotation _placeOnPath just set.
      p.rotateY(p.userData.spin);
      if (p.userData.roadDistance < carDistance - 20) {
        this.group.remove(p);
        this.pickupPool.push(p);
        this.activePickups.splice(i, 1);
      }
    }
  }

  // Returns index of colliding traffic car, or -1. `carDistance`/`carLateral`
  // describe the player's position in road-local coordinates (same space
  // traffic objects are tracked in), which is robust through curves — using
  // raw world X/Z would be unreliable once the road bends.
  checkCarCollision(carDistance, carLateral, carHalfWidth, carHalfLength) {
    for (let i = 0; i < this.activeCars.length; i++) {
      const t = this.activeCars[i];
      const dx = Math.abs(t.userData.lane - carLateral);
      const dz = Math.abs(t.userData.roadDistance - carDistance);
      if (dx < carHalfWidth + CONFIG.CAR_HALF_WIDTH && dz < carHalfLength + CONFIG.CAR_HALF_LENGTH) {
        return i;
      }
    }
    return -1;
  }

  // Awards a one-time bonus per traffic car the player squeezes past at
  // close range without colliding — rewards tight, confident weaving
  // instead of only rewarding raw distance.
  checkNearMiss(carDistance, carLateral, carHalfWidth, carHalfLength) {
    let bonus = 0;
    for (const t of this.activeCars) {
      if (t.userData.nearMissAwarded) continue;
      const dx = Math.abs(t.userData.lane - carLateral);
      const dz = Math.abs(t.userData.roadDistance - carDistance);
      const closeButClear = dx > carHalfWidth + CONFIG.CAR_HALF_WIDTH
        && dx < carHalfWidth + CONFIG.CAR_HALF_WIDTH + 1.05
        && dz < carHalfLength + CONFIG.CAR_HALF_LENGTH - 0.2;
      if (closeButClear) {
        t.userData.nearMissAwarded = true;
        bonus++;
      }
    }
    return bonus;
  }

  // Removes/recycles any traffic car within `radius` of (distance,
  // lateral) — used when reviving the player after a crash so they
  // don't resume directly back into the same car that just hit them.
  clearNear(distance, lateral, radius) {
    for (let i = this.activeCars.length - 1; i >= 0; i--) {
      const car = this.activeCars[i];
      const dx = car.userData.lane - lateral;
      const dz = car.userData.roadDistance - distance;
      if (Math.sqrt(dx * dx + dz * dz) < radius) {
        this.group.remove(car);
        car.userData.nearMissAwarded = false;
        this.pool.push(car);
        this.activeCars.splice(i, 1);
      }
    }
  }

  checkPickupCollision(carDistance, carLateral, radius) {
    for (let i = 0; i < this.activePickups.length; i++) {
      const p = this.activePickups[i];
      const dx = p.userData.lane - carLateral;
      const dz = p.userData.roadDistance - carDistance;
      if (Math.sqrt(dx * dx + dz * dz) < radius) {
        this.group.remove(p);
        this.pickupPool.push(p);
        this.activePickups.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  reset() {
    [...this.activeCars].forEach((c) => { this.group.remove(c); c.userData.nearMissAwarded = false; this.pool.push(c); });
    [...this.activePickups].forEach((p) => { this.group.remove(p); this.pickupPool.push(p); });
    this.activeCars = [];
    this.activePickups = [];
    this.nextSpawnZ = 60;
  }
}
