import * as THREE from 'three';
import { CONFIG, RACE_OPPONENT_COLORS, laneCenters } from '../config.js';
import { createCarInstance, spinWheel } from '../world/CarModel.js';

// =========================================================
// RaceManager
// Drives 2-6 local AI opponents for RACE MODE — entirely offline,
// no networking of any kind. Each opponent is the same car.glb the
// player drives, repainted a distinct color, running simple arcade AI:
//
//  - Rubber-band throttle: opponents speed up when they fall behind the
//    player and ease off when they get too far ahead, so the race stays
//    close regardless of the player's skill.
//  - Lane-change avoidance: opponents scan ahead in their lane and swap
//    lanes to dodge traffic, the player, or each other.
//  - Anti-clip spacing: a fallback pass (same idea as TrafficManager's)
//    stops any two racers — or a racer and a traffic car — from ever
//    visually driving through one another, even if the AI's avoidance
//    doesn't react in time.
//
// Bumping a rival racer just costs the player a little speed (a soft
// "bump"); hitting background traffic is still a hard crash, handled by
// Game.js's existing collision check — that distinction is what keeps
// close racing fun without making rival contact as punishing as it is
// in the endless dodge mode.
// =========================================================

const OPPONENT_LABELS = ['RIVAL 1', 'RIVAL 2', 'RIVAL 3', 'RIVAL 4', 'RIVAL 5', 'RIVAL 6'];

function shuffled(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export class RaceManager {
  constructor(scene, road) {
    this.scene = scene;
    this.road = road;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.opponents = [];
    this.laneXs = laneCenters();
    this.active = false;
    this.finishedCount = 0;
  }

  _pickColors(count, excludeColor) {
    const exclude = excludeColor ? String(excludeColor).toLowerCase() : null;
    const pool = RACE_OPPONENT_COLORS.filter((c) => c.toLowerCase() !== exclude);
    const pick = shuffled(pool.length ? pool : RACE_OPPONENT_COLORS);
    const result = [];
    for (let i = 0; i < count; i++) result.push(pick[i % pick.length]);
    return result;
  }

  // Starts a fresh race with `count` AI opponents (2-6), avoiding the
  // player's current paint color so nobody on the grid matches them.
  start(count, playerLivery) {
    this.reset();
    this.laneXs = laneCenters();
    const colors = this._pickColors(count, playerLivery);

    for (let i = 0; i < count; i++) {
      const instance = createCarInstance({ livery: colors[i], withCosmeticLights: true, faceForward: false });
      this.group.add(instance.group);

      const lane = this.laneXs[i % this.laneXs.length];
      const row = Math.floor(i / this.laneXs.length);
      // RoadPath.sample() clamps negative distances to 0, so a "behind
      // the line" grid has to use small positive offsets instead of
      // negative ones — otherwise every opponent would render bunched
      // up exactly on top of the player for the first second or two.
      const startDistance = 4 + row * 6 + Math.random() * 2;

      this.opponents.push({
        group: instance.group,
        wheelNodes: instance.wheelNodes,
        bodyMat: instance.bodyMat,
        name: OPPONENT_LABELS[i] || `RIVAL ${i + 1}`,
        color: colors[i],
        distanceTravelled: startDistance,
        lateralX: lane,
        targetLane: lane,
        speed: 0,
        baseSpeed: THREE.MathUtils.lerp(CONFIG.RACE_AI_BASE_SPEED_MIN, CONFIG.RACE_AI_BASE_SPEED_MAX, Math.random()),
        laneChangeTimer: Math.random() * CONFIG.RACE_AI_LANE_CHANGE_COOLDOWN,
        finished: false,
        finishOrder: null,
      });
      // Place immediately so the starting grid is visible right away —
      // update() won't run its first tick until the countdown ends.
      this._placeOnPath(instance.group, startDistance, lane);
    }
    this.finishedCount = 0;
    this.active = true;
  }

  reset() {
    this.opponents.forEach((o) => this.group.remove(o.group));
    this.opponents = [];
    this.finishedCount = 0;
    this.active = false;
  }

  _placeOnPath(obj, roadDistance, lateralX) {
    if (!this.road) {
      obj.position.set(lateralX, 0, roadDistance);
      return;
    }
    const s = this.road.path.sample(Math.max(0, roadDistance));
    obj.position.set(
      s.position.x + s.right.x * lateralX,
      0,
      s.position.z + s.right.z * lateralX
    );
    obj.rotation.y = s.heading;
  }

  // Is there a blocker (another opponent, the player, or a traffic car)
  // in `lane` within lookahead range of `fromDistance`?
  _laneIsBlocked(lane, fromDistance, self, playerCar, trafficManager) {
    const lookahead = CONFIG.RACE_AI_LOOKAHEAD;
    const laneTol = CONFIG.CAR_HALF_WIDTH * 1.4;
    const within = (lateral, distance) => {
      if (Math.abs(lateral - lane) > laneTol) return false;
      const d = distance - fromDistance;
      return d > -CONFIG.CAR_HALF_LENGTH && d < lookahead;
    };

    for (const o of this.opponents) {
      if (o === self || o.finished) continue;
      if (within(o.lateralX, o.distanceTravelled)) return true;
    }
    if (playerCar && within(playerCar.lateralX, playerCar.distanceTravelled)) return true;
    if (trafficManager) {
      for (const t of trafficManager.activeCars) {
        if (within(t.userData.lane, t.userData.roadDistance)) return true;
      }
    }
    return false;
  }

  _updateAI(dt, opp, playerCar, trafficManager) {
    const gap = playerCar.distanceTravelled - opp.distanceTravelled;
    const rubberband = THREE.MathUtils.clamp(
      (gap / 100) * CONFIG.RACE_AI_RUBBERBAND_PER_100M,
      -CONFIG.RACE_AI_RUBBERBAND_MAX,
      CONFIG.RACE_AI_RUBBERBAND_MAX
    );
    const targetSpeed = THREE.MathUtils.clamp(opp.baseSpeed + rubberband, 4, CONFIG.RACE_AI_MAX_SPEED);
    if (opp.speed < targetSpeed) {
      opp.speed = Math.min(targetSpeed, opp.speed + CONFIG.RACE_AI_ACCEL * dt);
    } else {
      opp.speed = Math.max(targetSpeed, opp.speed - CONFIG.RACE_AI_ACCEL * dt);
    }

    opp.laneChangeTimer -= dt;
    if (opp.laneChangeTimer <= 0) {
      opp.laneChangeTimer = CONFIG.RACE_AI_LANE_CHANGE_COOLDOWN * (0.7 + Math.random() * 0.6);
      if (this._laneIsBlocked(opp.targetLane, opp.distanceTravelled, opp, playerCar, trafficManager)) {
        const idx = this.laneXs.indexOf(opp.targetLane);
        const candidates = shuffled([idx - 1, idx + 1].filter((i) => i >= 0 && i < this.laneXs.length));
        for (const ci of candidates) {
          const lane = this.laneXs[ci];
          if (!this._laneIsBlocked(lane, opp.distanceTravelled, opp, playerCar, trafficManager)) {
            opp.targetLane = lane;
            break;
          }
        }
      }
    }

    const maxStep = CONFIG.RACE_AI_LATERAL_SPEED * dt;
    const dx = opp.targetLane - opp.lateralX;
    opp.lateralX += THREE.MathUtils.clamp(dx, -maxStep, maxStep);

    opp.distanceTravelled += opp.speed * dt;
  }

  // One-directional fallback: if an opponent's avoidance didn't react in
  // time and it's about to drive through a traffic car, clamp it back to
  // a following gap instead (traffic never needs to react to opponents).
  _resolveVsTraffic(trafficManager) {
    if (!trafficManager) return;
    const halfW = CONFIG.CAR_HALF_WIDTH;
    const minGap = CONFIG.RACE_MIN_FOLLOWING_GAP;
    for (const opp of this.opponents) {
      if (opp.finished) continue;
      for (const t of trafficManager.activeCars) {
        if (Math.abs(opp.lateralX - t.userData.lane) > halfW * 2 + 0.3) continue;
        const gap = t.userData.roadDistance - opp.distanceTravelled;
        if (gap >= -CONFIG.CAR_HALF_LENGTH && gap < minGap) {
          opp.distanceTravelled = t.userData.roadDistance - minGap;
          if (opp.speed > t.userData.speed) opp.speed = t.userData.speed;
        }
      }
    }
  }

  // Keeps any two racers (opponents + player) from clipping through each
  // other. Grazing a rival costs the player a bit of speed; two AI
  // opponents just get held apart, ACC-style.
  _resolveRacerSpacing(dt, playerCar) {
    const halfW = CONFIG.CAR_HALF_WIDTH;
    const minGap = CONFIG.RACE_MIN_FOLLOWING_GAP;

    const racers = this.opponents
      .filter((o) => !o.finished)
      .map((o) => ({ ref: o, isPlayer: false }));
    racers.push({ ref: playerCar, isPlayer: true });

    for (let i = 0; i < racers.length; i++) {
      for (let j = 0; j < racers.length; j++) {
        if (i === j) continue;
        const a = racers[i]; // candidate trailing car
        const b = racers[j]; // candidate lead car
        const aDist = a.ref.distanceTravelled;
        const bDist = b.ref.distanceTravelled;
        if (aDist >= bDist) continue; // only resolve from the trailing side
        if (Math.abs(a.ref.lateralX - b.ref.lateralX) > halfW * 2 + 0.3) continue;

        const maxAllowed = bDist - minGap;
        if (aDist > maxAllowed) {
          if (a.isPlayer) {
            playerCar.distanceTravelled = maxAllowed;
            playerCar.speed = Math.max(0, playerCar.speed - CONFIG.RACE_BUMP_SPEED_PENALTY * dt * 4);
          } else {
            a.ref.distanceTravelled = maxAllowed;
            if (!b.isPlayer && a.ref.speed > b.ref.speed) a.ref.speed = b.ref.speed;
          }
        }
      }
    }
  }

  update(dt, playerCar, trafficManager) {
    if (!this.active) return;

    for (const opp of this.opponents) {
      if (!opp.finished) this._updateAI(dt, opp, playerCar, trafficManager);
    }

    this._resolveVsTraffic(trafficManager);
    this._resolveRacerSpacing(dt, playerCar);

    for (const opp of this.opponents) {
      this._placeOnPath(opp.group, opp.distanceTravelled, opp.lateralX);
      if (!opp.finished) {
        const spin = opp.speed * dt;
        for (const w of opp.wheelNodes) spinWheel(w, spin);
        if (opp.distanceTravelled >= CONFIG.RACE_FINISH_DISTANCE) {
          opp.finished = true;
          this.finishedCount++;
          opp.finishOrder = this.finishedCount;
        }
      }
    }
  }

  // Sorted standings (finished racers first, by finish order; everyone
  // else by current distance) — used for both the live HUD position
  // readout and the final results screen.
  getStandings(playerCar) {
    const playerFinished = playerCar.distanceTravelled >= CONFIG.RACE_FINISH_DISTANCE;
    const entries = this.opponents.map((o) => ({
      name: o.name,
      isPlayer: false,
      distance: o.distanceTravelled,
      finished: o.finished,
      finishOrder: o.finishOrder,
      color: o.color,
    }));
    entries.push({
      name: 'YOU',
      isPlayer: true,
      distance: playerCar.distanceTravelled,
      finished: playerFinished,
      finishOrder: playerFinished ? this.finishedCount + 1 : null,
      color: null,
    });

    entries.sort((a, b) => {
      if (a.finished && b.finished) return (a.finishOrder || 0) - (b.finishOrder || 0);
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.distance - a.distance;
    });
    entries.forEach((e, i) => { e.place = i + 1; });
    return entries;
  }

  dispose() {
    this.reset();
  }
}
