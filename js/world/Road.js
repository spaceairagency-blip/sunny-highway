import * as THREE from 'three';
import { CONFIG, COLORS, laneDividerXs } from '../config.js';
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
    // How many segments are always kept BEHIND the car. The chase camera
    // sits behind the car (CAM_BASE_OFFSET.z) and looks slightly down, so
    // the bottom of the screen shows ground that's behind the car — with
    // zero segments back there you saw sky instead of tarmac.
    this.behindSegments = CONFIG.ROAD_SEGMENTS_BEHIND;
    this.segments = [];
    this.group = new THREE.Group();
    scene.add(this.group);

    this.path = new RoadPath();

    // Material references collected while building, so ThemeManager can
    // re-tint the whole track live (level up / theme change) without ever
    // rebuilding geometry. Index 0 = "even" segment shade, 1 = "odd" shade.
    this.asphaltMats = [];
    this.grassMats = [];
    this.laneMats = [];
    this.shoulderMats = [];
    this.canopyMats = [];
    this.buildingMats = [];
    this.bannerMats = [];

    this._buildSegments();
    this._buildDistantScenery();
  }

  // Builds a curved strip of geometry (asphalt, shoulder line, or grass)
  // that hugs the path exactly across [distanceStart, distanceStart +
  // segmentLength], between lateral offsets innerX/outerX from the
  // centerline — expressed in the LOCAL frame of `centerSample` (the
  // segment group's own position/heading), so it can be added as a
  // child mesh with identity transform.
  //
  // This is what makes consecutive segments fit together with zero gap
  // even through sharp bends: a flat rigid tile only matches the path's
  // heading at one single point (its center), so on a curve its far
  // edges visibly drift away from the actual centerline, leaving a
  // wedge-shaped gap (or overlap) at the seam with the next tile. Every
  // sub-sample here comes from the same path.sample() the rest of the
  // game uses, so two adjacent segments always share an *exact* boundary
  // point — no gap is possible regardless of how sharp the curve is.
  _buildCurvedStripGeometry(centerSample, distanceStart, innerX, outerX, steps) {
    const centerPos = centerSample.position;
    const centerHeading = centerSample.heading;
    const cosH = Math.cos(centerHeading);
    const sinH = Math.sin(centerHeading);
    const toLocal = (wx, wz) => {
      const dx = wx - centerPos.x;
      const dz = wz - centerPos.z;
      return { x: dx * cosH - dz * sinH, z: dx * sinH + dz * cosH };
    };

    const positions = [];
    const uvs = [];
    const indices = [];
    for (let i = 0; i <= steps; i++) {
      const d = distanceStart + (i / steps) * this.segmentLength;
      const s = this.path.sample(d);
      const lx = s.position.x + s.right.x * innerX;
      const lz = s.position.z + s.right.z * innerX;
      const rx = s.position.x + s.right.x * outerX;
      const rz = s.position.z + s.right.z * outerX;
      const L = toLocal(lx, lz);
      const R = toLocal(rx, rz);
      positions.push(L.x, 0, L.z, R.x, 0, R.z);
      const v = i / steps;
      uvs.push(0, v, 1, v);
    }
    for (let i = 0; i < steps; i++) {
      const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, d = (i + 1) * 2 + 1;
      indices.push(a, c, b, b, c, d);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }

  // Sub-divide each 20m segment into ~2m slivers when building its
  // curved ribbons — fine enough to track the path smoothly, matching
  // the resolution RoadPath itself already samples at internally.
  _ribbonSteps() {
    return Math.max(2, Math.round(this.segmentLength / 2));
  }

  // Replaces a curved-ribbon mesh's geometry in place (disposing the old
  // one so recycled segments don't leak GPU memory over a long run).
  _setRibbonGeometry(mesh, geo) {
    if (mesh.geometry) mesh.geometry.dispose();
    mesh.geometry = geo;
  }

  _makeSegmentMesh(index) {
    const g = new THREE.Group();
    const roadWidth = CONFIG.ROAD_TOTAL_WIDTH;
    const shade = index % 2;

    // Asphalt base — a curved ribbon (see _buildCurvedStripGeometry),
    // rebuilt on every placement/recycle to hug the path exactly.
    const asphaltMat = new THREE.MeshStandardMaterial({
      color: shade === 0 ? COLORS.asphalt : COLORS.asphaltDark,
      roughness: 0.95,
      metalness: 0.02,
      side: THREE.DoubleSide, // curved ribbon geometry — safe against either winding direction
    });
    const asphalt = new THREE.Mesh(new THREE.BufferGeometry(), asphaltMat);
    asphalt.receiveShadow = true;
    g.add(asphalt);
    g.userData.asphaltMesh = asphalt;
    this.asphaltMats[shade] = asphaltMat;

    // White dashed lane divider lines — one between every pair of
    // adjacent lanes, so this scales automatically with LANE_COUNT.
    // Short relative to the segment, so a flat dash reads fine without
    // needing to be curved itself — only its anchor point (the segment
    // center) needs to sit exactly on the path, which it already does.
    laneDividerXs().forEach((x) => {
      const dashGeo = new THREE.PlaneGeometry(0.14, this.segmentLength * 0.42);
      const dashMat = new THREE.MeshBasicMaterial({ color: COLORS.laneLine });
      const dash = new THREE.Mesh(dashGeo, dashMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(x, 0.01, 0);
      g.add(dash);
      this.laneMats.push(dashMat);
    });

    // Solid yellow shoulder edge lines at the outer road boundary —
    // also curved ribbons so they hug the asphalt edge with no gap.
    const shoulderMeshes = [];
    [-1, 1].forEach((side) => {
      const edgeMat = new THREE.MeshBasicMaterial({ color: COLORS.shoulderLine, side: THREE.DoubleSide });
      const edge = new THREE.Mesh(new THREE.BufferGeometry(), edgeMat);
      edge.position.y = 0.011;
      g.add(edge);
      shoulderMeshes.push(edge);
      this.shoulderMats.push(edgeMat);
    });
    g.userData.shoulderMeshes = shoulderMeshes;

    // Grass shoulders on both sides, extending well past the visible
    // frustum — also curved ribbons so their inner edge lines up exactly
    // with the asphalt's outer edge through bends instead of leaving a
    // sliver of gap (or overlap) between road and grass.
    const grassWidth = 90;
    const grassMeshes = [];
    [-1, 1].forEach((side) => {
      const grassMat = new THREE.MeshStandardMaterial({
        color: shade === 0 ? COLORS.grass : COLORS.grassDark,
        roughness: 1,
        side: THREE.DoubleSide,
      });
      const grass = new THREE.Mesh(new THREE.BufferGeometry(), grassMat);
      grass.position.y = -0.01;
      grass.receiveShadow = true;
      g.add(grass);
      grassMeshes.push({ mesh: grass, side });
      this.grassMats[shade] = grassMat;

      // A few simple roadside trees for scale/motion cues
      if (Math.random() > 0.35) {
        const tree = this._makeTree();
        tree.position.set(side * (roadWidth / 2 + 4 + Math.random() * 8), 0, (Math.random() - 0.5) * this.segmentLength);
        g.add(tree);
      }

      // Occasional roadside building, set further back than trees
      if (Math.random() > 0.72) {
        const building = this._makeBuilding();
        building.position.set(side * (roadWidth / 2 + 16 + Math.random() * 18), 0, (Math.random() - 0.5) * this.segmentLength);
        building.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
        g.add(building);
      }

      // Occasional sponsor/level banner strung beside the road, closer in
      // than buildings so it reads clearly while driving past
      if (Math.random() > 0.82) {
        const banner = this._makeBanner();
        banner.position.set(side * (roadWidth / 2 + 3.2), 2.6, (Math.random() - 0.5) * this.segmentLength);
        banner.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        g.add(banner);
        this.bannerMats.push(banner.userData.panelMat);
      }
    });
    g.userData.grassMeshes = grassMeshes;

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
    this.canopyMats.push(canopyMat);

    return g;
  }

  _makeBuilding() {
    const g = new THREE.Group();
    const w = 6 + Math.random() * 6;
    const d = 6 + Math.random() * 6;
    const h = 8 + Math.random() * 22;

    const bodyGeo = new THREE.BoxGeometry(w, h, d);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color().setHSL(0.58 + Math.random() * 0.08, 0.12, 0.55 + Math.random() * 0.2),
      roughness: 0.85,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = h / 2;
    body.castShadow = true;
    g.add(body);
    this.buildingMats.push(bodyMat);

    // Simple window bands so it reads as windows from a distance without
    // needing texture loads (keeps package size/load time small).
    const rows = Math.max(2, Math.floor(h / 3));
    const stripMat = new THREE.MeshStandardMaterial({
      color: 0xdff2ff,
      emissive: 0x223344,
      emissiveIntensity: 0.4,
      roughness: 0.4,
    });
    for (let r = 0; r < rows; r++) {
      const stripGeo = new THREE.BoxGeometry(w * 0.92, 0.35, 0.05);
      const strip = new THREE.Mesh(stripGeo, stripMat);
      strip.position.set(0, 1.6 + r * 3, d / 2 + 0.03);
      g.add(strip);
    }

    // Flat roof cap for a cleaner silhouette
    const roofGeo = new THREE.BoxGeometry(w * 1.04, 0.4, d * 1.04);
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x555b63, roughness: 0.9 });
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = h + 0.2;
    g.add(roof);

    return g;
  }

  _makeBanner() {
    const g = new THREE.Group();

    // Two support poles
    const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 3.2, 6);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.7, metalness: 0.3 });
    [-1.4, 1.4].forEach((x) => {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(x, -1, 0);
      g.add(pole);
    });

    // Banner panel — a bright color panel (no external sponsor art/logos
    // needed) so it reads as a track-side banner while staying
    // copyright-safe and asset-free.
    const panelGeo = new THREE.PlaneGeometry(3, 0.9);
    const bannerColors = [0xffd23f, 0x4fa8ff, 0xff6b6b, 0x5fd68a];
    const panelMat = new THREE.MeshStandardMaterial({
      color: bannerColors[Math.floor(Math.random() * bannerColors.length)],
      roughness: 0.6,
      side: THREE.DoubleSide,
    });
    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.position.set(0, 0.1, 0);
    g.add(panel);

    // A couple of thin accent stripes so the panel doesn't read as a flat
    // block of color from a distance
    const stripeGeo = new THREE.PlaneGeometry(3, 0.08);
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
    [0.32, -0.28].forEach((y) => {
      const stripe = new THREE.Mesh(stripeGeo, stripeMat);
      stripe.position.set(0, y, 0.01);
      g.add(stripe);
    });

    g.userData.panelMat = panelMat;
    return g;
  }

  // ---------------------------------------------------------
  // Re-tint every stored material to match a theme's colors.
  // Called directly for an instant apply, or every frame with
  // already-interpolated hex strings while ThemeManager cross-fades.
  // ---------------------------------------------------------
  applyColors({ asphalt, grass, lane, shoulder, hill, canopy }) {
    if (asphalt) {
      if (this.asphaltMats[0]) this.asphaltMats[0].color.set(asphalt[0]);
      if (this.asphaltMats[1]) this.asphaltMats[1].color.set(asphalt[1]);
    }
    if (grass) {
      if (this.grassMats[0]) this.grassMats[0].color.set(grass[0]);
      if (this.grassMats[1]) this.grassMats[1].color.set(grass[1]);
    }
    if (lane) this.laneMats.forEach((m) => m.color.set(lane));
    if (shoulder) this.shoulderMats.forEach((m) => m.color.set(shoulder));
    if (canopy) this.canopyMats.forEach((m) => m.color.set(canopy));
    if (hill && this.hillMats) this.hillMats.forEach((m) => m.color.set(hill));
  }

  // Distance at which pool slot `i` starts out. Slots 0..behindSegments-1
  // sit at negative distances (behind the start line) so the ground under
  // and behind the camera is always covered from the very first frame.
  _startDistanceForSlot(i) {
    return (i - this.behindSegments) * this.segmentLength;
  }

  _buildSegments() {
    for (let i = 0; i < this.segmentCount; i++) {
      const mesh = this._makeSegmentMesh(i);
      this._placeSegment(mesh, this._startDistanceForSlot(i));
      this.group.add(mesh);
      this.segments.push(mesh);
    }
  }

  // Position + orient a segment so it sits on the path at `distance`,
  // facing the path's heading there, and rebuild its curved asphalt/
  // shoulder-line/grass ribbons to hug the path across its whole span
  // (see _buildCurvedStripGeometry) — done every placement, including
  // recycles, since the curve shape at a new distance is different.
  _placeSegment(mesh, distance) {
    const s = this.path.sample(distance);
    mesh.position.copy(s.position);
    mesh.rotation.y = s.heading;
    mesh.userData.roadDistance = distance;

    const roadWidth = CONFIG.ROAD_TOTAL_WIDTH;
    const grassWidth = 90;
    const steps = this._ribbonSteps();

    if (mesh.userData.asphaltMesh) {
      const geo = this._buildCurvedStripGeometry(s, distance, -roadWidth / 2, roadWidth / 2, steps);
      this._setRibbonGeometry(mesh.userData.asphaltMesh, geo);
    }
    if (mesh.userData.shoulderMeshes) {
      const [left, right] = mesh.userData.shoulderMeshes;
      this._setRibbonGeometry(left, this._buildCurvedStripGeometry(s, distance, -roadWidth / 2 + 0.1, -roadWidth / 2 + 0.3, steps));
      this._setRibbonGeometry(right, this._buildCurvedStripGeometry(s, distance, roadWidth / 2 - 0.3, roadWidth / 2 - 0.1, steps));
    }
    if (mesh.userData.grassMeshes) {
      mesh.userData.grassMeshes.forEach(({ mesh: grass, side }) => {
        const inner = side * roadWidth / 2;
        const outer = side * (roadWidth / 2 + grassWidth);
        const geo = this._buildCurvedStripGeometry(s, distance, Math.min(inner, outer), Math.max(inner, outer), steps);
        this._setRibbonGeometry(grass, geo);
      });
    }
  }

  _buildDistantScenery() {
    // Soft rolling hills for depth, cheap flat shapes
    this.scenery = new THREE.Group();
    this.hillDistances = [];
    this.hillMats = [];
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
      this.hillMats.push(mat);
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
      this._placeSegment(seg, this._startDistanceForSlot(i));
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
      // Recycle only once a segment is fully behind the CAMERA, not just
      // behind the car — otherwise the tile the camera is sitting on gets
      // teleported to the front of the pool and the bottom of the screen
      // flashes empty sky.
      if (seg.userData.roadDistance < carDistance - this.segmentLength * this.behindSegments) {
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
