import * as THREE from 'three';
import { CONFIG } from '../config.js';
import { makeSkyGradientTexture } from './SceneSetup.js';

// =========================================================
// ThemeManager
// Owns the "world skin": sky gradient, fog, lighting mood,
// road/grass/scenery colors, and the player car's livery +
// headlight brightness. Cross-fades smoothly between themes
// whenever LevelManager reports a level-up, so day can ease
// into night (or any theme into any other) without a jarring
// pop-cut.
// =========================================================

const LERP_COLOR_KEYS = ['fog', 'lane', 'shoulder', 'hill', 'canopy'];

function lerpHex(a, b, t) {
  return new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
}

export class ThemeManager {
  constructor(scene, road, playerCar, renderer, lights) {
    this.scene = scene;
    this.road = road;
    this.playerCar = playerCar;
    this.renderer = renderer;
    this.lights = lights; // { hemi, sun, fill } from addLighting()

    this.current = null;
    this.from = null;
    this.to = null;
    this.t = 1;
    this.duration = CONFIG.THEME_TRANSITION_SECONDS;
  }

  // Instantly snap to a theme (used at the very start of a run).
  applyInstant(theme, livery) {
    this.current = theme;
    this.from = theme;
    this.to = theme;
    this.t = 1;
    this._render(theme);
    if (this.playerCar) {
      this.playerCar.setLivery(livery);
      this.playerCar.setHeadlightIntensity(theme.isNight ? 1 : 0);
    }
  }

  // Begin a smooth cross-fade toward a new theme/livery (level-up).
  transitionTo(theme, livery) {
    this.from = this.current || theme;
    this.to = theme;
    this.t = 0;
    this._pendingLivery = livery;
    // Livery swap reads better as an instant "new paint job" reveal rather
    // than a muddy color blend, so it changes right away alongside the toast.
    if (this.playerCar) this.playerCar.setLivery(livery);
  }

  // Call every frame regardless of game state so the world never freezes
  // mid-transition (e.g. if the player pauses right as a level completes).
  update(dt) {
    if (this.t >= 1) return;
    this.t = Math.min(1, this.t + dt / this.duration);
    const eased = 1 - Math.pow(1 - this.t, 3); // ease-out cubic
    const blended = this._blend(this.from, this.to, eased);
    this._render(blended);
    if (this.playerCar) {
      const fromT = this.from.isNight ? 1 : 0;
      const toT = this.to.isNight ? 1 : 0;
      this.playerCar.setHeadlightIntensity(fromT + (toT - fromT) * eased);
    }
    if (this.t >= 1) {
      this.current = this.to;
    }
  }

  _blend(a, b, t) {
    return {
      isNight: t > 0.5 ? b.isNight : a.isNight,
      sky: a.sky.map((c, i) => '#' + lerpHex(c, b.sky[i], t)),
      fog: '#' + lerpHex(a.fog, b.fog, t),
      fogNear: THREE.MathUtils.lerp(a.fogNear, b.fogNear, t),
      fogFar: THREE.MathUtils.lerp(a.fogFar, b.fogFar, t),
      hemi: {
        sky: '#' + lerpHex(a.hemi.sky, b.hemi.sky, t),
        ground: '#' + lerpHex(a.hemi.ground, b.hemi.ground, t),
        intensity: THREE.MathUtils.lerp(a.hemi.intensity, b.hemi.intensity, t),
      },
      sun: {
        color: '#' + lerpHex(a.sun.color, b.sun.color, t),
        intensity: THREE.MathUtils.lerp(a.sun.intensity, b.sun.intensity, t),
      },
      fill: {
        color: '#' + lerpHex(a.fill.color, b.fill.color, t),
        intensity: THREE.MathUtils.lerp(a.fill.intensity, b.fill.intensity, t),
      },
      exposure: THREE.MathUtils.lerp(a.exposure, b.exposure, t),
      asphalt: a.asphalt.map((c, i) => '#' + lerpHex(c, b.asphalt[i], t)),
      grass: a.grass.map((c, i) => '#' + lerpHex(c, b.grass[i], t)),
      lane: '#' + lerpHex(a.lane, b.lane, t),
      shoulder: '#' + lerpHex(a.shoulder, b.shoulder, t),
      hill: '#' + lerpHex(a.hill, b.hill, t),
      canopy: '#' + lerpHex(a.canopy, b.canopy, t),
    };
  }

  _render(theme) {
    if (this.scene) {
      this.scene.background = makeSkyGradientTexture(theme.sky);
      if (this.scene.fog) {
        this.scene.fog.color.set(theme.fog);
        this.scene.fog.near = theme.fogNear;
        this.scene.fog.far = theme.fogFar;
      }
    }
    if (this.lights) {
      const { hemi, sun, fill } = this.lights;
      if (hemi) {
        hemi.color.set(theme.hemi.sky);
        hemi.groundColor.set(theme.hemi.ground);
        hemi.intensity = theme.hemi.intensity;
      }
      if (sun) {
        sun.color.set(theme.sun.color);
        sun.intensity = theme.sun.intensity;
      }
      if (fill) {
        fill.color.set(theme.fill.color);
        fill.intensity = theme.fill.intensity;
      }
    }
    if (this.renderer) this.renderer.toneMappingExposure = theme.exposure;
    if (this.road) {
      this.road.applyColors({
        asphalt: theme.asphalt,
        grass: theme.grass,
        lane: theme.lane,
        shoulder: theme.shoulder,
        hill: theme.hill,
        canopy: theme.canopy,
      });
    }
  }
}
