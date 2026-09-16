import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// =========================================================
// CarModel
// Loads the player's uploaded car.glb exactly once and hands out
// cheap clones of it, so every car on the road — the player, every
// piece of traffic, and every race opponent — is visually the same
// vehicle, just repainted a different color. This is what makes
// "all cars same as mine, color different" possible without paying
// for a separate GLTF load per car.
//
// - The scale/orientation/wheel-pivot fix-up (previously duplicated
//   in PlayerCar) now happens once on a shared template.
// - createCarInstance() clones the template and gives the clone its
//   own body-material instance so setLivery() only repaints that one
//   car, while geometry (the expensive part) stays shared.
// - Non-player cars don't get the player's real THREE.Light rig (that
//   would be very expensive multiplied by traffic + opponents) — they
//   get cheap unlit emissive taillight/headlight plates instead, which
//   read fine at highway speed without costing a single extra light.
// =========================================================

const CAR_SCALE = 0.335;
const FLOOR_OFFSET = 0.36;
// Half-length used to place headlight/taillight plates on non-player
// cars — matches the offsets PlayerCar's own light rig uses.
const HALF_LENGTH_Z = 1.9;

let _template = null;
let _loadingPromise = null;

function _buildTemplate(model) {
  model.scale.setScalar(CAR_SCALE);
  model.rotation.y = Math.PI; // face away from camera, down the track
  model.position.y = -FLOOR_OFFSET;
  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = false;

      // The GLB's "carbon_fiber" material (front/rear bumpers, fenders,
      // side skirts) has no baseColorFactor of its own and its only
      // baseColorTexture is a broken/junk bake — mostly flat gray with a
      // handful of stray black doodle shapes, not an actual carbon-fiber
      // weave. With no factor to fall back on, glTF defaults an
      // untextured base color to solid white, which is exactly the flat
      // white bumper/fender/side-skirt patches this was causing. Give it
      // a clean, deliberate dark carbon-fiber tone instead of relying on
      // that texture at all — consistent with this car's other dark trim
      // materials (black_parts, Pure_black).
      if (child.material && child.material.name === 'carbon_fiber') {
        child.material.map = null;
        child.material.color.set(0x1c1e22);
        child.material.roughness = 0.55;
        child.material.metalness = 0.15;
        child.material.needsUpdate = true;
      }

      if (/wheel/i.test(child.name)) {
        // Re-pivot each wheel to spin around its own axle instead of the
        // model's local origin (see PlayerCar history for why this matters).
        child.geometry = child.geometry.clone();
        child.geometry.computeBoundingBox();
        const bbox = child.geometry.boundingBox;
        const center = new THREE.Vector3();
        bbox.getCenter(center);
        child.geometry.translate(-center.x, -center.y, -center.z);
        child.position.add(center);

        // Work out which local axis is the wheel's axle by finding the
        // THINNEST dimension of the mesh — a wheel is a thin disc, so its
        // axle runs through the short axis, and its rolling radius is
        // half the larger of the other two. This makes spin work
        // correctly no matter which axis the source model happened to
        // author the wheel on, instead of assuming X and guessing a
        // fixed multiplier for how fast it should turn.
        const size = new THREE.Vector3();
        bbox.getSize(size);
        const dims = [
          { axis: 'x', size: size.x, other: [size.y, size.z] },
          { axis: 'y', size: size.y, other: [size.x, size.z] },
          { axis: 'z', size: size.z, other: [size.x, size.y] },
        ].sort((a, b) => a.size - b.size);
        const axle = dims[0];
        const radiusLocal = Math.max(axle.other[0], axle.other[1]) / 2;
        child.userData.spinAxis = axle.axis;
        // Convert to world-space meters now (the model's own uniform
        // CAR_SCALE), so spin code elsewhere can work directly in the
        // same meters-per-second units as car speed/distance.
        child.userData.wheelRadius = radiusLocal * CAR_SCALE || 0.33;
      }
    }
  });
  return model;
}

// Spins a wheel mesh by the correct angle for having travelled
// `distanceMeters` this frame — angle = distance / radius (radians),
// applied to whichever local axis is that wheel's actual axle (computed
// once in _buildTemplate above), instead of an arbitrary fixed-speed
// approximation. This is what makes the wheels' visual rotation rate
// actually match the car's real ground speed, like a real car's wheels
// rolling without slipping.
export function spinWheel(wheel, distanceMeters) {
  const radius = wheel.userData.wheelRadius || 0.33;
  const axis = wheel.userData.spinAxis || 'x';
  wheel.rotation[axis] += distanceMeters / radius;
}

// Loads (once) and resolves with the shared template model. Safe to call
// repeatedly — later callers just await the same in-flight/resolved load.
export function preloadCarModel(onProgress) {
  if (_template) return Promise.resolve(_template);
  if (_loadingPromise) return _loadingPromise;

  const loader = new GLTFLoader();
  _loadingPromise = new Promise((resolve, reject) => {
    loader.load(
      './assets/car/car.glb',
      (gltf) => {
        _template = _buildTemplate(gltf.scene);
        resolve(_template);
      },
      (xhr) => { if (onProgress && xhr.total) onProgress(xhr.loaded / xhr.total); },
      (err) => {
        console.error('Failed to load car.glb', err);
        reject(err);
      }
    );
  });
  return _loadingPromise;
}

export function isCarModelReady() {
  return !!_template;
}

// Adds cheap unlit headlight/taillight plates to a non-player car instance.
// No THREE.Light objects here on purpose — traffic and opponents can
// number a dozen+ at once, and real lights per car would tank frame rate.
function _addCosmeticLights(group) {
  const tailGeo = new THREE.PlaneGeometry(0.9, 0.22);
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff3333 });
  const tail = new THREE.Mesh(tailGeo, tailMat);
  tail.position.set(0, 0.55, -HALF_LENGTH_Z - 0.02);
  tail.rotation.y = Math.PI;
  group.add(tail);

  const headGeo = new THREE.PlaneGeometry(0.8, 0.2);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff6d8 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.set(0, 0.55, HALF_LENGTH_Z + 0.02);
  group.add(head);

  return { tailMat, headMat };
}

// Creates one drivable car instance cloned from the shared template.
// Returns { group, wheelNodes, bodyMat } — group is ready to add to the
// scene, wheelNodes should have rotation.x incremented for spin, and
// bodyMat.color.set(...) repaints the whole car (all body panels share
// this one cloned material instance).
export function createCarInstance({ livery, withCosmeticLights = true, faceForward = true } = {}) {
  if (!_template) {
    throw new Error('createCarInstance() called before preloadCarModel() resolved');
  }
  const model = _template.clone(true);

  // The template's own rotation.y = Math.PI orients it correctly for the
  // PLAYER, whose forward-facing camera sits behind it looking the same
  // way the car faces. Traffic and race-opponent cars travel down the
  // exact same road in the exact same direction, so they need that same
  // "nose pointing down-track" orientation too — but because they're
  // built by cloning the template (which already carries that rotation),
  // leaving it as-is actually left them facing backward relative to their
  // own direction of travel. Flipping by another Math.PI here corrects it.
  if (!faceForward) model.rotation.y += Math.PI;

  const wheelNodes = [];
  let bodyMat = null;
  let bodyBaseColor = null;

  model.traverse((child) => {
    if (!child.isMesh) return;
    if (/wheel/i.test(child.name)) wheelNodes.push(child);
    if (child.material && child.material.name === 'car_body') {
      // First body-part mesh we see clones the material; every other
      // body-part mesh on THIS instance reuses that same clone, so one
      // color set touches the whole car, not just one panel.
      if (!bodyMat) {
        bodyMat = child.material.clone();
        bodyBaseColor = child.material.color.clone();
      }
      child.material = bodyMat;
    }
  });

  const group = new THREE.Group();
  group.add(model);

  let cosmetic = null;
  if (withCosmeticLights) cosmetic = _addCosmeticLights(group);

  if (bodyMat && livery) bodyMat.color.set(livery);

  return {
    group,
    model,
    wheelNodes,
    bodyMat,
    bodyBaseColor,
    cosmeticLights: cosmetic,
    setLivery(hexColor) {
      if (bodyMat) bodyMat.color.set(hexColor);
    },
  };
}
