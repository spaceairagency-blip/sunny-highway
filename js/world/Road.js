import * as THREE from 'three';
import { CONFIG, COLORS } from '../config.js';
import { RoadPath } from './RoadPath.js';

// =========================================================
// Road
// Builds a pool of repeating road segments that get recycled
// (moved to the front) as the car advances, creating an
// effectively infinite daytime highway with grass shoulders
// on either side. Segments are reused so draw cost stays flat
// no matter how far the player travels.
//
// The road now follows a winding RoadPath rather than a
// straight line: each segment is positioned and rotated to
// match the path's heading at its distance, so consecutive
// tiles curl smoothly around bends.
// =========================================================

export class Road {
  constructor(scene) {
    this.scene = scene;
    this.segmentLength = CONFIG.ROAD_SEGMENT_LENGTH;
    this.segmentCount = CONFIG.ROAD_SEGMENTS_VISIBLE;
    this.segments = [];
    this.group = new THREE.Group();
    scene.add(this.group);

    this.path = new RoadPath();

    this._buildSegments();
    this._buildDistantScenery();
  }

  _makeSegmentMesh(index) {
    const g = new THREE.Group();
    const roadWidth = CONFIG.ROAD_TOTAL_WIDTH;

    // Asphalt base — subtle alternating shade so forward motion reads clearly
    const asphaltGeo = new THREE.PlaneGeometry(roadWidth, this.segmentLength);
    const asphaltMat = new THREE.MeshStandardMaterial({
      color: index % 2 === 0 ? COLORS.asphalt : COLORS.asphaltDark,
      roughness: 0.95,
      metalness: 0.02,
    });
    const asphalt = new THREE.Mesh(asphaltGeo, asphaltMat);
    asphalt.rotation.x = -Math.PI / 2;
    asphalt.receiveShadow = true;
    g.add(asphalt);

    // White dashed lane divider lines
    const laneXs = [-CONFIG.LANE_WIDTH / 2, CONFIG.LANE_WIDTH / 2];
    laneXs.forEach((x) => {
      const dashGeo = new THREE.PlaneGeometry(0.14, this.segmentLength * 0.42);
      const dashMat = new THREE.MeshBasicMaterial({ color: COLORS.laneLine });
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.01, 0);
      g.add(dash);
    });

    // Solid yellow shoulder edge lines at the outer road boundary
    [-roadWidth / 2 + 0.2, roadWidth / 2 - 0.2].forEach((x) => {
      const edgeGeo = new THREE.PlaneGeometry(0.2, this.segmentLength);
      const edgeMat = new THREE.MeshBasicMaterial({ color: COLORS.shoulderLine });
      const edge = new THREE.Mesh(edgeGeo, edgeMat);
      edge.rotation.x = -Math.PI / 2;
      edge.position.set(x, 0.011, 0);
      g.add(edge);
    });

    // Grass shoulders on both sides, extending well past the visible frustum
    const grassWidth = 90;
    [-1, 1].forEach((side) => {
      const grassGeo = new THREE.PlaneGeometry(grassWidth, this.segmentLength);
      const grassMat = new THREE.MeshStandardMaterial({
        color: index % 2 === 0 ? COLORS.grass : COLORS.grassDark,
        roughness: 1,
      });
      const grass = new THREE.Mesh(grassGeo, grassMat);
      grass.rotation.x = -Math.PI / 2;
      grass.position.set(side * (roadWidth / 2 + grassWidth / 2), -0.01, 0);
      grass.receiveShadow = true;
      g.add(grass);

      // A few simple roadside trees for scale/motion cues
      if (Math.random() > 0.35) {
        const tree = this._makeTree();
        tree.position.set(side * (roadWidth / 2 + 4 + Math.random() * 8), 0, (Math.random() - 0.5) * this.segmentLength);
        g.add(tree);
      }
    });

    return g;
  }

  _makeTree() {
    const g = new THREE.Group();
    const trunkGeo = new THREE.CylinderGeometry(0.15, 0.2, 1.6, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.9 });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.8;
    g.add(trunk);

    const canopyGeo = new THREE.SphereGeometry(1.1 + Math.random() * 0.5, 8, 7);
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x3f8f3a, roughness: 0.9 });
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.y = 2.1;
    canopy.castShadow = true;
    g.add(canopy);

    return g;
  }

  _buildSegments() {
    for (let i = 0; i < this.segmentCount; i++) {
      const mesh = this._makeSegmentMesh(i);
      this._placeSegment(mesh, i * this.segmentLength);
      this.group.add(mesh);
      this.segments.push(mesh);
    }
  }

  // Position + orient a segment so it sits on the path at `distance`,
  // facing the path's heading there (so consecutive tiles form a curve).
  _placeSegment(mesh, distance) {
    const s = this.path.sample(distance);
    mesh.position.copy(s.position);
    mesh.rotation.y = s.heading;
    mesh.userData.roadDistance = distance;
  }

  _buildDistantScenery() {
    // Soft rolling hills for depth, cheap flat shapes
    this.scenery = new THREE.Group();
    this.hillDistances = [];
    const count = 10;
    for (let i = 0; i < count; i++) {
      const side = i % 2 === 0 ? 1 : -1;
      const w = 20 + Math.random() * 30;
      const h = 4 + Math.random() * 10;
      const geo = new THREE.SphereGeometry(w / 2, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2);
      const mat = new THREE.MeshStandardMaterial({ color: 0x3f8f3a, roughness: 1 });
      const hill = new THREE.Mesh(geo, mat);
      hill.scale.y = h / (w / 2);
      const dist = Math.random() * 400;
      const world = this.path.toWorld(dist, side * (55 + Math.random() * 50), -1);
      hill.position.copy(world);
      this.scenery.add(hill);
      this.hillDistances.push(dist);
    }
    this.scene.add(this.scenery);
  }

  // Re-lay segments and scenery back to their starting positions relative to
  // the start of a fresh path, so restarting the run doesn't leave the
  // track wherever it last scrolled to (which would otherwise put all
  // geometry outside camera view).
  reset() {
    this.path.reset();
    this.segments.forEach((seg, i) => {
      this._placeSegment(seg, i * this.segmentLength);
    });
    if (this.scenery) {
      this.scenery.children.forEach((h, idx) => {
        const dist = Math.random() * 400;
        const side = idx % 2 === 0 ? 1 : -1;
        h.position.copy(this.path.toWorld(dist, side * (55 + Math.random() * 50), -1));
        this.hillDistances[idx] = dist;
      });
    }
  }

  // Recycle segments that have fallen behind the car back to the front of the pool.
  // `carDistance` is distance travelled along the path (not raw world Z,
  // since the path curves).
  update(carDistance) {
    for (const seg of this.segments) {
      if (seg.userData.roadDistance < carDistance - this.segmentLength * 2) {
        const newDistance = seg.userData.roadDistance + this.segmentLength * this.segmentCount;
        this._placeSegment(seg, newDistance);
      }
    }
    if (this.scenery) {
      this.scenery.children.forEach((h, idx) => {
        if (this.hillDistances[idx] < carDistance - 60) {
          const newDist = this.hillDistances[idx] + 400;
          const side = idx % 2 === 0 ? 1 : -1;
          h.position.copy(this.path.toWorld(newDist, side * (55 + Math.random() * 50), -1));
          this.hillDistances[idx] = newDist;
        }
      });
    }
  }
}
