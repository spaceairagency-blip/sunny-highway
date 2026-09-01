import * as THREE from 'three';

// =========================================================
// RoadPath
// Generates an endless, gently winding centerline (like a real
// highway) and lets other systems sample world position/heading
// at any distance along it. Internally the path is built from
// chained "curve sections" — each with a target curvature the
// heading eases toward — so bends flow smoothly into straights
// instead of snapping.
//
// Everything else in the game (road mesh, player car, camera,
// traffic) asks this class "where is distance D along the road,
// and which way is it facing" and positions itself in that local
// frame (position + right vector), so a car whose lateralX is 0
// always sits on the centerline even through a curve.
// =========================================================

const STEP = 2; // meters between sampled path points — fine enough to look smooth, cheap enough to extend live

export class RoadPath {
  constructor() {
    // Sampled polyline: parallel arrays indexed by sample i (distance = i * STEP)
    this.points = [new THREE.Vector3(0, 0, 0)];
    this.headings = [0]; // radians, 0 = straight down +Z
    this.curvature = 0; // current turn rate (radians per meter of heading change)
    this.targetCurvature = 0;
    this.distanceToNextChange = 0;

    this._extendTo(400); // pre-build a good runway so nothing pops in
  }

  // Ensure the sampled path covers at least `distance` meters ahead.
  _extendTo(distance) {
    let covered = (this.points.length - 1) * STEP;
    while (covered < distance) {
      this._maybePickNewCurveTarget();

      // Ease current curvature toward target — this is what makes bends
      // curl in and straighten out smoothly rather than kinking.
      const curveEase = 0.06;
      this.curvature += (this.targetCurvature - this.curvature) * curveEase;

      const lastHeading = this.headings[this.headings.length - 1];
      const newHeading = lastHeading + this.curvature * STEP;

      const lastPoint = this.points[this.points.length - 1];
      const newPoint = new THREE.Vector3(
        lastPoint.x + Math.sin(newHeading) * STEP,
        0,
        lastPoint.z + Math.cos(newHeading) * STEP
      );

      this.points.push(newPoint);
      this.headings.push(newHeading);
      covered += STEP;
      this.distanceToNextChange -= STEP;
    }
  }

  _maybePickNewCurveTarget() {
    if (this.distanceToNextChange > 0) return;

    // Randomly choose the next stretch: a curve (left/right, gentle/sharp)
    // or a straight — weighted so straights and curves both show up often,
    // like a real winding highway rather than a slalom.
    const roll = Math.random();
    if (roll < 0.32) {
      this.targetCurvature = 0; // straight section
      this.distanceToNextChange = 60 + Math.random() * 90;
    } else {
      const dir = Math.random() < 0.5 ? -1 : 1;
      const sharpness = 0.006 + Math.random() * 0.012; // radians/meter — tuned to feel like a real road, not a hairpin
      this.targetCurvature = dir * sharpness;
      this.distanceToNextChange = 45 + Math.random() * 70;
    }
  }

  // Sample world position/heading/right-vector at a given distance along
  // the centerline. Extends the path on demand if asked to look further
  // ahead than has been generated yet.
  sample(distance) {
    if (distance < 0) distance = 0;
    this._extendTo(distance + 40); // small lookahead margin so callers can query slightly ahead safely

    const f = distance / STEP;
    const i0 = Math.min(Math.floor(f), this.points.length - 2);
    const i1 = i0 + 1;
    const t = THREE.MathUtils.clamp(f - i0, 0, 1);

    const p0 = this.points[i0];
    const p1 = this.points[i1];
    const position = new THREE.Vector3().lerpVectors(p0, p1, t);

    const h0 = this.headings[i0];
    const h1 = this.headings[i1];
    const heading = h0 + (h1 - h0) * t;

    const right = new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading));
    const forward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));

    return { position, heading, right, forward };
  }

  // Convert (distance along road, lateral offset) into a world-space point.
  // This is the core helper everything uses to place itself on the curve.
  toWorld(distance, lateralX, worldY = 0) {
    const s = this.sample(distance);
    return new THREE.Vector3(
      s.position.x + s.right.x * lateralX,
      worldY,
      s.position.z + s.right.z * lateralX
    );
  }

  reset() {
    this.points = [new THREE.Vector3(0, 0, 0)];
    this.headings = [0];
    this.curvature = 0;
    this.targetCurvature = 0;
    this.distanceToNextChange = 0;
    this._extendTo(400);
  }
}
