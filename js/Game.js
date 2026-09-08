import * as THREE from 'three';
import { CONFIG } from './config.js';
import { createScene, createRenderer, addLighting } from './world/SceneSetup.js';
import { Road } from './world/Road.js';
import { PlayerCar } from './world/PlayerCar.js';
import { TrafficManager } from './world/TrafficManager.js';
import { CameraRig } from './world/CameraRig.js';
import { ThemeManager } from './world/ThemeManager.js';
import { LevelManager } from './world/LevelManager.js';
import { InputManager } from './input/InputManager.js';
import { UIManager } from './ui/UIManager.js';
import { AudioManager } from './audio/AudioManager.js';
import { Storage } from './utils/Storage.js';

const STATE = {
  BOOT: 'boot',
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAMEOVER: 'gameover',
};

export class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ui = new UIManager();
    this.input = new InputManager();
    this.audio = new AudioManager();
    this.audio.setEnabled(Storage.getSoundOn());
    this.ui.setSoundButton(Storage.getSoundOn());

    this.state = STATE.BOOT;
    this.clock = new THREE.Clock();

    this.score = 0;
    this.topSpeedKmh = 0;
    this.lastCollisionCheck = 0;
    this.levelManager = new LevelManager();
    this.bestLevelThisRun = 1;

    this._bindUIEvents();
    this._handleResize();
    window.addEventListener('resize', () => this._handleResize());
    window.addEventListener('orientationchange', () => setTimeout(() => this._handleResize(), 200));
  }

  async boot() {
    this.ui.setBootProgress(0.05, 'Building world…');
    this.scene = createScene();
    this.renderer = createRenderer(this.canvas);
    this.lights = addLighting(this.scene);

    this.ui.setBootProgress(0.25, 'Laying down asphalt…');
    this.road = new Road(this.scene);

    this.ui.setBootProgress(0.4, 'Spawning traffic…');
    this.traffic = new TrafficManager(this.scene, this.road);

    this.ui.setBootProgress(0.5, 'Loading your ride…');
    this.playerCar = new PlayerCar(this.scene, this.road);
    try {
      await this.playerCar.load((p) => {
        this.ui.setBootProgress(0.5 + p * 0.4, 'Loading your ride…');
      });
    } catch (e) {
      this.ui.setBootProgress(0.9, 'Model failed — using fallback…');
    }

    this.cameraRig = new CameraRig(window.innerWidth / window.innerHeight);
    this.themeManager = new ThemeManager(this.scene, this.road, this.playerCar, this.renderer, this.lights);

    this.ui.setBootProgress(1, 'Ready!');
    await new Promise((r) => setTimeout(r, 250));

    this.ui.hideBoot();
    this._goToMenu();
    this._startLoop();
  }

  _bindUIEvents() {
    const { el } = this.ui;

    el.btnStart.addEventListener('click', () => { this.audio.playUIClick(); this._startGame(); });
    el.btnHowto.addEventListener('click', () => { this.audio.playUIClick(); this.ui.showHowTo(); });
    el.btnHowtoClose.addEventListener('click', () => { this.audio.playUIClick(); this.ui.hideHowTo(); });
    el.btnSound.addEventListener('click', () => {
      const newState = !this.audio.enabled;
      this.audio.setEnabled(newState);
      Storage.setSoundOn(newState);
      this.ui.setSoundButton(newState);
      this.audio.playUIClick();
    });

    el.btnPause.addEventListener('click', () => this._pause());
    el.btnResume.addEventListener('click', () => { this.audio.playUIClick(); this._resume(); });
    el.btnRestartFromPause.addEventListener('click', () => { this.audio.playUIClick(); this._startGame(); });
    el.btnQuit.addEventListener('click', () => { this.audio.playUIClick(); this._goToMenu(); });

    el.btnRetry.addEventListener('click', () => { this.audio.playUIClick(); this._startGame(); });
    el.btnMenuFromOver.addEventListener('click', () => { this.audio.playUIClick(); this._goToMenu(); });

    el.rotateDismiss.addEventListener('click', () => { this.ui.hideRotateHint(); });
  }

  _goToMenu() {
    this.state = STATE.MENU;
    this.audio.stopEngine();
    this.ui.showMenu({
      bestDistance: Storage.getBestDistance(),
      bestSpeed: Storage.getBestSpeed(),
      bestLevel: Storage.getBestLevel(),
    });
  }

  _startGame() {
    this.ui.hideMenu();
    this.ui.hideGameOver();
    this.ui.hidePause();

    this.playerCar.reset();
    this.road.reset();
    this.traffic.reset();
    this.levelManager.reset();
    this.score = 0;
    this.topSpeedKmh = 0;
    this.bestLevelThisRun = 1;

    const first = this.levelManager.update(0);
    this.themeManager.applyInstant(first.theme, first.livery);
    this.ui.updateLevel(first);

    this.state = STATE.PLAYING;
    this.ui.showHUD(this.input.isTouchDevice);
    this.audio.startEngine();

    if (this.ui.checkOrientationHint() && !this._rotateHintShown) {
      this._rotateHintShown = true;
      this.ui.showRotateHint();
    }
  }

  _pause() {
    if (this.state !== STATE.PLAYING) return;
    this.state = STATE.PAUSED;
    this.ui.showPause();
    this.audio.stopEngine();
  }

  _resume() {
    if (this.state !== STATE.PAUSED) return;
    this.state = STATE.PLAYING;
    this.ui.hidePause();
    this.audio.startEngine();
  }

  _endGame() {
    this.state = STATE.GAMEOVER;
    this.audio.stopEngine();
    this.audio.playCrash();
    this.cameraRig.triggerCrashShake();

    const bestDistance = Storage.getBestDistance();
    const bestSpeed = Storage.getBestSpeed();
    const bestLevel = Storage.getBestLevel();
    const isNewBest = this.playerCar.distanceTravelled > bestDistance;
    const isNewBestLevel = this.bestLevelThisRun > bestLevel;

    if (isNewBest) Storage.setBestDistance(this.playerCar.distanceTravelled);
    if (this.topSpeedKmh > bestSpeed) Storage.setBestSpeed(this.topSpeedKmh);
    if (isNewBestLevel) Storage.setBestLevel(this.bestLevelThisRun);

    setTimeout(() => {
      this.ui.showGameOver({
        distance: this.playerCar.distanceTravelled,
        score: this.score,
        topSpeedKmh: this.topSpeedKmh,
        level: this.bestLevelThisRun,
        isNewBest: isNewBest || isNewBestLevel,
      });
    }, 550);
  }

  _handleResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (this.renderer) this.renderer.setSize(w, h);
    if (this.cameraRig) this.cameraRig.setAspect(w / h);
  }

  _startLoop() {
    const loop = () => {
      requestAnimationFrame(loop);
      const dt = Math.min(this.clock.getDelta(), 0.05); // clamp to avoid huge steps on tab-switch
      this._update(dt);
      this.renderer.render(this.scene, this.cameraRig.camera);
    };
    requestAnimationFrame(loop);
  }

  _update(dt) {
    if (this.input.consumePauseRequest()) {
      if (this.state === STATE.PLAYING) this._pause();
      else if (this.state === STATE.PAUSED) this._resume();
    }

    // Theme cross-fades keep running in every state so a level-up
    // transition never freezes mid-blend if the player pauses right as
    // it starts.
    if (this.themeManager) this.themeManager.update(dt);

    if (this.state !== STATE.PLAYING) {
      // Still update camera and recycle road segments in menu/gameover/pause
      // so the track never runs out from under the camera while frozen.
      if (this.cameraRig && this.playerCar) this.cameraRig.update(dt, this.playerCar);
      if (this.road && this.playerCar) this.road.update(this.playerCar.distanceTravelled);
      return;
    }

    this.playerCar.update(dt, this.input.state);
    this.road.update(this.playerCar.distanceTravelled);
    this.traffic.spawnAhead(this.playerCar.distanceTravelled, this.playerCar.distanceTravelled);
    this.traffic.update(dt, this.playerCar.distanceTravelled);
    this.cameraRig.update(dt, this.playerCar);

    const speedRatio = Math.max(0, this.playerCar.speed) / CONFIG.CAR_MAX_SPEED_NITRO;
    this.audio.updateEngine(speedRatio, this.playerCar.isNitro);

    const speedKmh = this.playerCar.getSpeedKmh();
    if (speedKmh > this.topSpeedKmh) this.topSpeedKmh = speedKmh;

    // Scoring: distance-based, continuously
    this.score = this.playerCar.distanceTravelled * CONFIG.SCORE_PER_METER;

    // --- Level progression ---
    const levelInfo = this.levelManager.update(this.playerCar.distanceTravelled);
    if (levelInfo.displayNumber > this.bestLevelThisRun) this.bestLevelThisRun = levelInfo.displayNumber;
    if (levelInfo.didLevelUp) {
      this.themeManager.transitionTo(levelInfo.theme, levelInfo.livery);
      this.score += CONFIG.SCORE_LEVEL_UP_BONUS;
      this.audio.playLevelUp();
      this.ui.showLevelUpToast(levelInfo);
    }
    this.ui.updateLevel(levelInfo);

    // Collisions — checked in road-local (distance, lane) coordinates so
    // they stay accurate through curves, where raw world X/Z no longer
    // lines up with "which lane" the way it did on a straight road.
    const hitIndex = this.traffic.checkCarCollision(this.playerCar.distanceTravelled, this.playerCar.lateralX, 0.9, 1.9);
    if (hitIndex >= 0) {
      this.playerCar.crashed = true;
      this._endGame();
      return;
    }

    const nearMisses = this.traffic.checkNearMiss(this.playerCar.distanceTravelled, this.playerCar.lateralX, 0.9, 1.9);
    if (nearMisses > 0) {
      this.score += nearMisses * CONFIG.SCORE_NEAR_MISS_BONUS;
    }

    const gotPickup = this.traffic.checkPickupCollision(this.playerCar.distanceTravelled, this.playerCar.lateralX, 1.3);
    if (gotPickup) {
      this.playerCar.nitro = Math.min(CONFIG.NITRO_MAX, this.playerCar.nitro + CONFIG.NITRO_PICKUP_AMOUNT);
      this.score += CONFIG.SCORE_NITRO_PICKUP_BONUS;
      this.audio.playPickup();
    }

    // Out of bounds safety (shouldn't happen due to clamp, but guards against edge cases)
    if (Math.abs(this.playerCar.lateralX) > CONFIG.CAR_MAX_X + 1) {
      this.playerCar.crashed = true;
      this._endGame();
      return;
    }

    let gear = 'D';
    if (this.playerCar.speed < -0.1) gear = 'R';
    else if (this.playerCar.speed < 0.1) gear = 'N';

    this.ui.updateHUD({
      distance: this.playerCar.distanceTravelled,
      score: this.score,
      speedKmh,
      nitroPct: (this.playerCar.nitro / CONFIG.NITRO_MAX) * 100,
      gear,
    });
  }
}
