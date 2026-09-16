import * as THREE from 'three';
import { CONFIG, COLORS } from '../config.js';

// =========================================================
// SceneSetup
// Builds the base Three.js scene: renderer, lighting, fog,
// and a bright daytime sky gradient — clean, natural look
// (no neon/synthwave) to match a realistic highway.
// =========================================================

export function createScene() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(COLORS.fogColor, CONFIG.FOG_NEAR, CONFIG.FOG_FAR);
  scene.background = makeSkyGradientTexture(['#3f96f0', '#8fc9f5', '#dff3ff', '#eef9ff']);
  return scene;
}

// Exposed so ThemeManager can regenerate the sky each time a level's theme
// changes (or, mid-transition, with already-interpolated hex stops).
export function makeSkyGradientTexture(stops) {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  const positions = [0, 0.55, 0.8, 1];
  stops.forEach((c, i) => grad.addColorStop(positions[i], c));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
    alpha: false,
    // Slightly softens/AA's edges but avoids the "everything looks smeared"
    // look you get from a capped, low pixel ratio.
    stencil: false,
  });
  // Pixel ratio alone isn't a reliable sharpness signal: many laptops
  // report devicePixelRatio of exactly 1 (no OS display scaling) even on
  // a large, high-resolution panel, while phones commonly report 2-3.
  // Capping purely by devicePixelRatio meant a 1x laptop rendered at a
  // *lower* effective resolution than a 3x phone despite having a much
  // bigger screen to fill — which is exactly the "sharp on phone, blurry
  // on laptop" symptom. Instead, target a minimum real pixel count so a
  // 1x display still gets a properly detailed buffer, while still capping
  // high-DPI phones so we don't over-render and tank frame rate.
  const dpr = window.devicePixelRatio || 1;
  const targetPixelRatio = dpr < 1.5 ? Math.max(dpr, 1.5) : Math.min(dpr, 3);
  renderer.setPixelRatio(targetPixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  return renderer;
}

export function addLighting(scene) {
  const hemi = new THREE.HemisphereLight(0xbfe0ff, 0x5a8f3e, 0.75);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xfff6e0, 1.15);
  sun.position.set(-25, 45, -15);
  sun.castShadow = true;
  // 512px shadow maps produced very blocky/blurry shadow edges up close.
  // 2048 is a big sharpness upgrade for negligible cost on modern GPUs.
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
  sun.shadow.camera.far = 100;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xcfe8ff, 0.3);
  fill.position.set(20, 15, 30);
  scene.add(fill);

  return { hemi, sun, fill };
}
