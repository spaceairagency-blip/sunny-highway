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
  scene.background = makeSkyGradientTexture();
  return scene;
}

function makeSkyGradientTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#3f96f0');
  grad.addColorStop(0.55, '#8fc9f5');
  grad.addColorStop(0.8, '#dff3ff');
  grad.addColorStop(1, '#eef9ff');
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
  // The previous cap of 1.5 made the whole frame noticeably soft on any
  // normal-to-high DPI screen (most phones/laptops are 2-3x). Render at
  // full device resolution (up to 2x, which is already very sharp and
  // still cheap enough for this scene) instead.
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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
