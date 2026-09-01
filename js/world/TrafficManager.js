import * as THREE from 'three';
import { CONFIG, COLORS } from '../config.js';

// =========================================================
// TrafficManager
// Spawns simple low-poly traffic cars in lanes ahead of the
// player and recycles them once passed. Also spawns nitro
// pickups. Difficulty (speed/density) ramps with distance.
// =========================================================

const TRAFFIC_COLORS = [0xff3355, 0xffb500, 0x3388ff, 0xeeeeee, 0x33ff99, 0xff2fd0];

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
    this.laneXs = this._laneCenters();
  }

  _laneCenters() {
    const n = CONFIG.LANE_COUNT;
    const w = CONFIG.LANE_WIDTH;
    const centers = [];
    const start = -((n - 1) / 2) * w;
    for (let i = 0; i < n; i++) centers.push(start + i * w);
    return centers;
  }

  _makeTrafficCarMesh() {
    const g = new THREE.Group();
    const color = TRAFFIC_COLORS[Math.floor(Math.random() * TRAFFIC_COLORS.length)];

    const bodyGeo = new THREE.BoxGeometry(1.7, 0.9, 3.6);
    const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.6;
    body.castShadow = true;
    g.add(body);

    const cabinGeo = new THREE.BoxGeometry(1.3, 0.55, 1.6);
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x0c0e18, roughness: 0.2, metalness: 0.6 });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 1.15, -0.2);
    g.add(cabin);

    // Taillights (glow toward player since traffic drives away/ahead)
    const tailGeo = new THREE.BoxGeometry(0.25, 0.15, 0.05);
    const tailMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
    [-0.65, 0.65].forEach((x) => {
      const t = new THREE.Mesh(tailGeo, tailMat);
      t.position.set(x, 0.65, 1.82);
      g.add(t);
    });

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.3, 10);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const wheelPositions = [
      [-0.85, 0.32, 1.2], [0.85, 0.32, 1.2],
      [-0.85, 0.32, -1.2], [0.85, 0.32, -1.2],
    ];
    wheelPositions.forEach(([x, y, z]) => {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, y, z);
      g.add(w);
    });

    return g;
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

  spawnAhead(carZ, distanceTravelled) {
    const t = this._difficultyT(distanceTravelled);
    const maxGap = THREE.MathUtils.lerp(CONFIG.TRAFFIC_MAX_GAP_START, CONFIG.TRAFFIC_MAX_GAP_END, t);

    while (this.nextSpawnZ < carZ + CONFIG.DRAW_DISTANCE) {
      const gap = THREE.MathUtils.lerp(CONFIG.TRAFFIC_MIN_GAP, maxGap, Math.random());
      this.nextSpawnZ += gap;

      const lane = this.laneXs[Math.floor(Math.random() * this.laneXs.length)];

      if (Math.random() < CONFIG.PICKUP_CHANCE) {
        const p = this._getPickup();
        p.userData.roadDistance = this.nextSpawnZ;
        p.userData.lane = lane;
        this._placeOnPath(p, this.nextSpawnZ, lane, 1.0);
        p.visible = true;
        this.group.add(p);
        this.activePickups.push(p);
      } else {
        const car = this._getTrafficCar();
        car.userData.roadDistance = this.nextSpawnZ;
        car.userData.lane = lane;
        car.userData.speed = THREE.MathUtils.lerp(
          CONFIG.TRAFFIC_SPEED_MIN,
          CONFIG.TRAFFIC_SPEED_MAX,
          Math.random() * (0.4 + t * 0.6)
        );
        this._placeOnPath(car, this.nextSpawnZ, lane, 0);
        car.visible = true;
        this.group.add(car);
        this.activeCars.push(car);
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

  update(dt, carDistance) {
    // Move traffic forward along the curved path using each car's own speed,
    // then recycle anything that's fallen far enough behind the player.
    for (let i = this.activeCars.length - 1; i >= 0; i--) {
      const car = this.activeCars[i];
      car.userData.roadDistance += car.userData.speed * dt;
      this._placeOnPath(car, car.userData.roadDistance, car.userData.lane, 0);
      if (car.userData.roadDistance < carDistance - 20) {
        this.group.remove(car);
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
      if (dx < carHalfWidth + 0.85 && dz < carHalfLength + 1.8) {
        return i;
      }
    }
    return -1;
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
    [...this.activeCars].forEach((c) => { this.group.remove(c); this.pool.push(c); });
    [...this.activePickups].forEach((p) => { this.group.remove(p); this.pickupPool.push(p); });
    this.activeCars = [];
    this.activePickups = [];
    this.nextSpawnZ = 60;
  }
}
