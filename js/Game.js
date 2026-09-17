import * as THREE from 'three';
import { CONFIG, THEMES, LEVELS } from './config.js';
import { StoreManager } from './store/StoreManager.js';
import { createScene, createRenderer, addLighting } from './world/SceneSetup.js';
import { Road } from './world/Road.js';
import { PlayerCar } from './world/PlayerCar.js';
import { TrafficManager } from './world/TrafficManager.js';
import { CameraRig } from './world/CameraRig.js';
import { ThemeManager } from './world/ThemeManager.js';
import { LevelManager } from './world/LevelManager.js';
import { RaceManager } from './race/RaceManager.js';
import { InputManager } from './input/InputManager.js';
import { UIManager } from './ui/UIManager.js';
import { AudioManager } from './audio/AudioManager.js';
import { AdManager } from './ads/AdManager.js';
import { Storage } from './utils/Storage.js';
import { OrientationLock } from './utils/OrientationLock.js';

const STATE = {
  BOOT: 'boot',
  MENU: 'menu',
  PLAYING: 'playing',
  PAUSED: 'paused',
  GAMEOVER: 'gameover',
  REVIVE_OFFER: 'revive_offer', // crash happened, revive-ad offer is up; distinct from PAUSED so the pause key can't sneak past it
  RACE_COUNTDOWN: 'race_countdown',
  RACE_PLAYING: 'race_playing',
  RACE_RESULTS: 'race_results',
};

export class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ui = new UIManager();
    this.input = new InputManager();
    this.audio = new AudioManager();
    this.audio.setEnabled(Storage.getSoundOn());
    this.ui.setSoundButton(Storage.getSoundOn());

    this.ads = new AdManager(this.audio);
    this.ads.init();

    // Coin economy + garage. Constructed before boot so the menu can show
    // the balance and the player's chosen car immediately.
    this.store = new StoreManager();

    this.state = STATE.BOOT;
    this.clock = new THREE.Clock();

    this.score = 0;
    this.topSpeedKmh = 0;
    this.lastCollisionCheck = 0;
    this.levelManager = new LevelManager();
    this.bestLevelThisRun = 1;
    this.nearMissesThisRun = 0;
    this.runCoins = 0;

    // Ad-driven run state — reset every _startGame()
    this.usedReviveThisRun = false;
    this.usedDoubleScoreThisRun = false;
    this.usedPauseNosAdThisRun = false;
    this.nosAdChipCooldownUntil = 0;

    // Landscape is required on touch devices — see _checkOrientationGate().
    this.orientationLock = new OrientationLock();
    this._orientationBlocked = false;

    this._bindUIEvents();
    this._handleResize();
    this._checkOrientationGate();
    window.addEventListener('resize', () => { this._handleResize(); this._checkOrientationGate(); });
    window.addEventListener('orientationchange', () => setTimeout(() => { this._handleResize(); this._checkOrientationGate(); }, 200));
  }

  // Shows/hides the full-screen "GO HORIZONTAL" gate. Runs regardless of
  // game state (boot/menu/playing/paused) since landscape is required
  // everywhere on touch devices, not just mid-race.
  _checkOrientationGate() {
    this.orientationLock.syncWithRealOrientation();
    const needsGate = this.input.isTouchDevice
      && this.orientationLock.isPortrait()
      && !this.orientationLock.forced;

    if (needsGate && !this._orientationBlocked) {
      this._orientationBlocked = true;
      this.ui.showOrientationGate();
    } else if (!needsGate && this._orientationBlocked) {
      this._orientationBlocked = false;
      this.ui.hideOrientationGate();
    }
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
    this.raceManager = new RaceManager(this.scene, this.road);

    this.ui.setBootProgress(0.5, 'Loading your ride…');
    this.playerCar = new PlayerCar(this.scene, this.road);
    try {
      await this.playerCar.load((p) => {
        this.ui.setBootProgress(0.5 + p * 0.4, 'Loading your ride…');
      });
    } catch (e) {
      this.ui.setBootProgress(0.9, 'Model failed — using fallback…');
    }

    // Paint + tune the car the player owns before the first frame renders,
    // so the menu/first run never briefly shows the wrong vehicle.
    this.playerCar.setCarProfile(this.store.getSelectedCar());

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

    // --- Race mode (local vs CPU, no online play) ---
    if (el.btnRaceMode) {
      el.btnRaceMode.addEventListener('click', () => { this.audio.playUIClick(); this.ui.showRaceSetup(); });
    }
    if (el.btnRaceSetupClose) {
      el.btnRaceSetupClose.addEventListener('click', () => { this.audio.playUIClick(); this.ui.hideRaceSetup(); });
    }
    if (el.raceOpponentGrid) {
      el.raceOpponentGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.race-opponent-btn');
        if (!btn) return;
        this.audio.playUIClick();
        this.ui.hideRaceSetup();
        this._startRace(parseInt(btn.dataset.count, 10));
      });
    }
    if (el.btnRaceAgain) {
      el.btnRaceAgain.addEventListener('click', () => { this.audio.playUIClick(); this._startRace(this._lastRaceOpponentCount || 3); });
    }
    if (el.btnRaceMenu) {
      el.btnRaceMenu.addEventListener('click', () => { this.audio.playUIClick(); this.ui.hideRaceResults(); this._goToMenu(); });
    }

    // --- Store ---
    const openStore = () => {
      this.audio.playUIClick();
      this.ui.renderStore(this.store.getCatalogView(), this.store.coins);
      this.ui.showStore();
    };
    if (el.btnStoreOpen) el.btnStoreOpen.addEventListener('click', openStore);
    if (el.btnStoreOpen2) el.btnStoreOpen2.addEventListener('click', openStore);
    if (el.btnStoreClose) {
      el.btnStoreClose.addEventListener('click', () => { this.audio.playUIClick(); this.ui.hideStore(); });
    }
    if (el.storeGrid) {
      el.storeGrid.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-store-action[data-car]');
        if (!btn || btn.disabled) return;
        this._handleStoreAction(btn.dataset.action, btn.dataset.car);
      });
    }

    el.btnPause.addEventListener('click', () => this._pause());
    el.btnResume.addEventListener('click', () => { this.audio.playUIClick(); this._resume(); });
    el.btnRestartFromPause.addEventListener('click', () => {
      this.audio.playUIClick();
      if (this._pausedFromRace) this._startRace(this._lastRaceOpponentCount || 3);
      else this._startGame();
    });
    el.btnQuit.addEventListener('click', () => { this.audio.playUIClick(); this._goToMenu(); });

    el.btnRetry.addEventListener('click', () => { this.audio.playUIClick(); this._startGame(); });
    el.btnMenuFromOver.addEventListener('click', () => { this.audio.playUIClick(); this._goToMenu(); });

    el.orientationGateBtn.addEventListener('click', () => {
      this.orientationLock.request().then(() => this._checkOrientationGate());
    });

    // --- Rewarded-ad actions (all optional, player-initiated) ---
    if (el.btnWatchAdNos) {
      el.btnWatchAdNos.addEventListener('click', () => this._watchAdForNos());
    }
    if (el.btnWatchAdPause) {
      el.btnWatchAdPause.addEventListener('click', () => this._watchAdForPauseNos());
    }
    if (el.btnWatchAdRevive) {
      el.btnWatchAdRevive.addEventListener('click', () => this._watchAdForRevive());
    }
    if (el.btnWatchAdDouble) {
      el.btnWatchAdDouble.addEventListener('click', () => this._watchAdForDoubleScore());
    }
  }

  _goToMenu() {
    this.state = STATE.MENU;
    this.audio.stopEngine();
    if (this.raceManager) this.raceManager.reset();
    this.ui.hideRaceResults();
    this.ui.showMenu({
      bestDistance: Storage.getBestDistance(),
      bestSpeed: Storage.getBestSpeed(),
      bestLevel: Storage.getBestLevel(),
    });
    this.ui.renderStore(this.store.getCatalogView(), this.store.coins);
  }

  // Buy or equip a car from the store grid. Both paths end in the same
  // place: re-apply the (possibly new) car to the 3D player car, re-render
  // the store so ownership/affordability is up to date, and tell the
  // player what just happened.
  _handleStoreAction(action, carId) {
    const result = action === 'buy' ? this.store.buy(carId) : this.store.select(carId);

    if (!result.ok) {
      this.audio.playUIClick();
      const messages = {
        funds: 'Not enough coins yet — drive a few more runs.',
        locked: 'You need to buy that car first.',
        owned: 'You already own that one.',
      };
      this.ui.showStoreToast(messages[result.reason] || 'That did not work.', true);
      this.ui.renderStore(this.store.getCatalogView(), this.store.coins);
      return;
    }

    this.audio.playLevelUp();
    this._applySelectedCar();
    this.ui.renderStore(this.store.getCatalogView(), this.store.coins);
    this.ui.showStoreToast(action === 'buy'
      ? `${result.car.name} bought and equipped!`
      : `Now driving the ${result.car.name}.`);
  }

  // Push the currently-selected store car onto the 3D car (paint +
  // handling) and make the theme system stop fighting it over paint.
  _applySelectedCar() {
    const car = this.store.getSelectedCar();
    if (this.playerCar) this.playerCar.setCarProfile(car);
    return car;
  }

  _startRace(opponentCount) {
    this._lastRaceOpponentCount = opponentCount;
    this.ui.hideMenu();
    this.ui.hideRaceSetup();
    this.ui.hideGameOver();
    this.ui.hidePause();
    this.ui.hideRaceResults();

    this.playerCar.reset();
    this.road.reset();
    this.traffic.reset();
    this.cameraRig.resetFraming();
    this.topSpeedKmh = 0;
    this._firstThrottleGiven = false;

    // Race mode doesn't use the 50-level progression — fixed daytime
    // theme and a signature livery for the whole race instead.
    const raceCar = this._applySelectedCar();
    this.themeManager.applyInstant(THEMES[0], raceCar.color);
    this.raceManager.start(opponentCount, raceCar.color);

    this._raceCountdownRemaining = CONFIG.RACE_COUNTDOWN_SECONDS;
    this.state = STATE.RACE_COUNTDOWN;
    this.ui.showHUD(this.input.isTouchDevice, 'race');
    this.ui.showRaceCountdown(Math.ceil(this._raceCountdownRemaining));
    this.ads.notifyGameplayStart();
  }

  _updateRaceCountdown(dt) {
    this._raceCountdownRemaining -= dt;
    if (this._raceCountdownRemaining > 0) {
      const shown = Math.ceil(this._raceCountdownRemaining);
      if (shown !== this._raceCountdownShown) {
        this._raceCountdownShown = shown;
        this.ui.setRaceCountdownText(shown > 0 ? String(shown) : 'GO!');
      }
    } else {
      this.ui.hideRaceCountdown();
      this._raceCountdownShown = null;
      this.state = STATE.RACE_PLAYING;
      this.audio.startEngine();
    }
  }

  _endRace(wrecked) {
    this.state = STATE.RACE_RESULTS;
    this.audio.stopEngine();
    this.ads.notifyGameplayStop();

    const standings = this.raceManager.getStandings(this.playerCar);
    const me = standings.find((s) => s.isPlayer);
    this.ads.trackScore(Math.round(this.playerCar.distanceTravelled));

    if (wrecked) {
      this.cameraRig.triggerCrashShake();
      this.audio.playCrash();
    } else if (me && me.place === 1) {
      this.audio.playLevelUp();
    }

    const reward = this.store.computeRaceReward({
      place: me ? me.place : standings.length,
      finished: !wrecked,
    });
    this.store.addCoins(reward.total);
    this.ui.setCoins(this.store.coins);

    setTimeout(() => {
      this.ui.showRaceResults({
        place: me ? me.place : standings.length,
        total: standings.length,
        standings,
        wrecked,
      });
      this.ui.showRacePayout(reward, this.store.coins);
    }, wrecked ? 550 : 200);
  }

  _startGame() {
    this.ui.hideMenu();
    this.ui.hideGameOver();
    this.ui.hidePause();
    this.ui.hideRaceResults();

    this.playerCar.reset();
    this.road.reset();
    this.traffic.reset();
    if (this.raceManager) this.raceManager.reset();
    this.cameraRig.resetFraming();
    this.levelManager.reset();
    this.score = 0;
    this.topSpeedKmh = 0;
    this._firstThrottleGiven = false;
    this.bestLevelThisRun = 1;
    this.nearMissesThisRun = 0;
    this.runCoins = 0;

    // Reset per-run ad state — a fresh run means these are available again.
    this.usedReviveThisRun = false;
    this.usedDoubleScoreThisRun = false;
    this.usedPauseNosAdThisRun = false;
    this.nosAdChipCooldownUntil = 0;
    this.ui.setNosAdChipVisible(false);
    this.ui.setPauseAdButtonVisible(true);

    const first = this.levelManager.update(0);
    // The player's paint job is now their store car, not a per-level
    // livery — buying a Pro Series and then having level 3 repaint it
    // green would make the whole garage pointless.
    this.themeManager.applyInstant(first.theme, this._applySelectedCar().color);
    this.ui.updateLevel(first);

    this.state = STATE.PLAYING;
    this.ui.showHUD(this.input.isTouchDevice, 'endless');
    this.audio.startEngine();
    this.ads.notifyGameplayStart();

    this._checkOrientationGate();
  }

  _pause() {
    if (this.state !== STATE.PLAYING && this.state !== STATE.RACE_PLAYING) return;
    this._pausedFromRace = this.state === STATE.RACE_PLAYING;
    this.state = STATE.PAUSED;
    this.ui.setPauseAdButtonVisible(!this._pausedFromRace && this.ads.isReady && !this.usedPauseNosAdThisRun);
    this.ui.showPause();
    this.audio.stopEngine();
  }

  _resume() {
    if (this.state !== STATE.PAUSED) return;
    this.state = this._pausedFromRace ? STATE.RACE_PLAYING : STATE.PLAYING;
    this.ui.hidePause();
    this.audio.startEngine();
  }

  _endGame() {
    // Guard against being invoked twice for the same crash (e.g. a
    // same-frame double collision check) — without this, a second call
    // could re-arm the revive-offer flow or duck audio/state twice.
    if (this.state === STATE.REVIVE_OFFER || this.state === STATE.GAMEOVER) return;

    // Offer a one-time revive before actually ending the run — but only
    // once per run, and only if the SDK is actually available (otherwise
    // there's no ad to show, so don't dangle a button that does nothing).
    if (!this.usedReviveThisRun && this.ads.isReady) {
      this.usedReviveThisRun = true;
      this._pendingCrashEnd = true;
      this.audio.stopEngine();
      this.audio.playCrash();
      this.cameraRig.triggerCrashShake();
      this.state = STATE.REVIVE_OFFER; // freeze gameplay while the offer is up, without going through the normal pause menu
      // showGameOver() resets both ad-offer buttons to hidden as part of
      // its own "clean slate" setup (correct for the normal final
      // game-over screen) — so setReviveButtonVisible(true) MUST come
      // after it, not before, or showGameOver() immediately hides the
      // button again in the same tick and it never actually appears.
      this.ui.showGameOver({
        distance: this.playerCar.distanceTravelled,
        score: this.score,
        topSpeedKmh: this.topSpeedKmh,
        level: this.bestLevelThisRun,
        isNewBest: false,
      });
      this.ui.setReviveButtonVisible(true);
      // Revive offer replaces the normal retry flow for this one screen;
      // retry/menu buttons on this screen still work as an implicit decline.
      return;
    }

    this._finishGameOver();
  }

  _finishGameOver() {
    this.state = STATE.GAMEOVER;
    this.audio.stopEngine();
    if (!this._pendingCrashEnd) this.audio.playCrash();
    this._pendingCrashEnd = false;
    this.cameraRig.triggerCrashShake();
    this.ads.notifyGameplayStop();
    this.ads.trackScore(this.score);

    const bestDistance = Storage.getBestDistance();
    const bestSpeed = Storage.getBestSpeed();
    const bestLevel = Storage.getBestLevel();
    const isNewBest = this.playerCar.distanceTravelled > bestDistance;
    const isNewBestLevel = this.bestLevelThisRun > bestLevel;

    if (isNewBest) Storage.setBestDistance(this.playerCar.distanceTravelled);
    if (this.topSpeedKmh > bestSpeed) Storage.setBestSpeed(this.topSpeedKmh);
    if (isNewBestLevel) Storage.setBestLevel(this.bestLevelThisRun);

    // Bank the run's coins exactly once, here in the final game-over
    // path — NOT in _endGame(), which can also be reached by the
    // revive-offer branch where the run is still live and would
    // otherwise pay out twice.
    const reward = this.store.computeEndlessReward({
      distance: this.playerCar.distanceTravelled,
      levelReached: this.bestLevelThisRun,
      nearMisses: this.nearMissesThisRun,
      isNewBest: isNewBest || isNewBestLevel,
    });
    this.store.addCoins(reward.total);
    this.ui.setCoins(this.store.coins);

    const showFinalScreen = () => {
      this.ui.showGameOver({
        distance: this.playerCar.distanceTravelled,
        score: this.score,
        topSpeedKmh: this.topSpeedKmh,
        level: this.bestLevelThisRun,
        isNewBest: isNewBest || isNewBestLevel,
      });
      this.ui.showPayout(reward, this.store.coins);
      if (this.ads.isReady && !this.usedDoubleScoreThisRun && this.score > 0) {
        this.ui.setDoubleScoreButtonVisible(true);
      }
    };

    setTimeout(() => {
      // Light background monetization: a rate-limited interstitial before
      // the final game-over screen. Skipped automatically on the first
      // game-over and never shown more than once a minute (see AdManager).
      this.ads.showGameOverInterstitial(showFinalScreen);
    }, 550);
  }

  // --- Rewarded ad actions ---

  _watchAdForNos() {
    this.ads.showRewarded({
      onRewarded: () => {
        this.playerCar.nitro = Math.min(this.playerCar.maxNitro(), this.playerCar.nitro + CONFIG.NITRO_PICKUP_AMOUNT);
        this.audio.playPickup();
        this.nosAdChipCooldownUntil = performance.now() + 20000;
        this.ui.setNosAdChipVisible(false);
      },
    });
  }

  _watchAdForPauseNos() {
    this.ads.showRewarded({
      onRewarded: () => {
        this.playerCar.nitro = Math.min(this.playerCar.maxNitro(), this.playerCar.nitro + 50);
        this.usedPauseNosAdThisRun = true;
        this.ui.setPauseAdButtonVisible(false);
      },
    });
  }

  _watchAdForRevive() {
    this.ads.showRewarded({
      onRewarded: () => {
        this.ui.setReviveButtonVisible(false);
        this.playerCar.crashed = false;
        // Resume at a safe, controllable speed rather than whatever
        // full/nitro speed was active at the moment of the crash, and
        // clear the car that just hit us out of the way — otherwise the
        // player revives directly back into the same collision, which
        // instantly re-crashes them (crashed -> false -> true within a
        // frame or two) while state/audio/traffic can end up disagreeing
        // about whether the run is still live: the exact "car is stuck,
        // engine sound keeps playing, traffic keeps moving" bug.
        this.playerCar.speed = CONFIG.CAR_MAX_SPEED * 0.35;
        this.playerCar.nitro = Math.min(this.playerCar.maxNitro(), this.playerCar.nitro + CONFIG.NITRO_PICKUP_AMOUNT);
        this.traffic.clearNear(this.playerCar.distanceTravelled, this.playerCar.lateralX, 12);
        this.ui.hideGameOver();
        this.ui.showHUD(this.input.isTouchDevice);
        this.state = STATE.PLAYING;
        this.audio.startEngine();
      },
      onSkipped: () => {
        this.ui.setReviveButtonVisible(false);
        this._finishGameOver();
      },
    });
  }

  _watchAdForDoubleScore() {
    this.ads.showRewarded({
      onRewarded: () => {
        this.usedDoubleScoreThisRun = true;
        this.score *= 2;
        this.ui.setFinalScore(this.score);
        this.ui.setDoubleScoreButtonVisible(false);
        this.ads.trackScore(this.score);
      },
    });
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
    // Landscape is required on touch devices — freeze gameplay input/physics
    // while the orientation gate is up, but keep camera/road/theme ticking
    // (same treatment as pause) so nothing looks frozen or jumps on resume.
    if (this._orientationBlocked) {
      if (this.themeManager) this.themeManager.update(dt);
      if (this.cameraRig && this.playerCar) this.cameraRig.update(dt, this.playerCar);
      if (this.road && this.playerCar) this.road.update(this.playerCar.distanceTravelled);
      return;
    }

    if (this.input.consumePauseRequest()) {
      if (this.state === STATE.PLAYING || this.state === STATE.RACE_PLAYING) this._pause();
      else if (this.state === STATE.PAUSED) this._resume();
    }

    // Theme cross-fades keep running in every state so a level-up
    // transition never freezes mid-blend if the player pauses right as
    // it starts.
    if (this.themeManager) this.themeManager.update(dt);

    if (this.state === STATE.RACE_COUNTDOWN) {
      // Cars sit frozen on the grid while the countdown ticks — still
      // update camera/road/theme so nothing looks stuck.
      if (this.cameraRig && this.playerCar) this.cameraRig.update(dt, this.playerCar);
      if (this.road && this.playerCar) this.road.update(this.playerCar.distanceTravelled);
      this._updateRaceCountdown(dt);
      return;
    }

    if (this.state === STATE.RACE_PLAYING) {
      this._updateRace(dt);
      return;
    }

    if (this.state !== STATE.PLAYING) {
      // Still update camera and recycle road segments in menu/gameover/pause
      // so the track never runs out from under the camera while frozen.
      if (this.cameraRig && this.playerCar) this.cameraRig.update(dt, this.playerCar);
      if (this.road && this.playerCar) this.road.update(this.playerCar.distanceTravelled);
      return;
    }

    if (!this._firstThrottleGiven && this.input.state.accelerate) {
      this._firstThrottleGiven = true;
      this.ui.notifyFirstThrottleInput();
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
      this.themeManager.transitionTo(levelInfo.theme, this.store.getSelectedCar().color);
      this.score += CONFIG.SCORE_LEVEL_UP_BONUS;
      this.audio.playLevelUp();
      this.ui.showLevelUpToast(levelInfo);
    }
    this.ui.updateLevel(levelInfo);

    // Collisions — checked in road-local (distance, lane) coordinates so
    // they stay accurate through curves, where raw world X/Z no longer
    // lines up with "which lane" the way it did on a straight road.
    const hitIndex = this.traffic.checkCarCollision(this.playerCar.distanceTravelled, this.playerCar.lateralX, CONFIG.CAR_HALF_WIDTH, CONFIG.CAR_HALF_LENGTH);
    if (hitIndex >= 0) {
      this.playerCar.crashed = true;
      this._endGame();
      return;
    }

    const nearMisses = this.traffic.checkNearMiss(this.playerCar.distanceTravelled, this.playerCar.lateralX, CONFIG.CAR_HALF_WIDTH, CONFIG.CAR_HALF_LENGTH);
    if (nearMisses > 0) {
      this.score += nearMisses * CONFIG.SCORE_NEAR_MISS_BONUS;
      this.nearMissesThisRun += nearMisses;
    }

    const gotPickup = this.traffic.checkPickupCollision(this.playerCar.distanceTravelled, this.playerCar.lateralX, 1.3);
    if (gotPickup) {
      this.playerCar.nitro = Math.min(this.playerCar.maxNitro(), this.playerCar.nitro + CONFIG.NITRO_PICKUP_AMOUNT);
      this.score += CONFIG.SCORE_NITRO_PICKUP_BONUS;
      this.audio.playPickup();
    }

    // Out of bounds safety (shouldn't happen due to clamp, but guards against edge cases)
    if (Math.abs(this.playerCar.lateralX) > CONFIG.CAR_MAX_X + 1) {
      this.playerCar.crashed = true;
      this._endGame();
      return;
    }

    // Offer the "watch ad for free NOS" chip only when it's actually
    // useful (nitro running low) and not still on its own cooldown from
    // last use — keeps it a helpful option, not a constant nag.
    if (this.ads.isReady) {
      const nitroLow = this.playerCar.nitro < this.playerCar.maxNitro() * 0.25;
      const cooledDown = performance.now() >= this.nosAdChipCooldownUntil;
      this.ui.setNosAdChipVisible(nitroLow && cooledDown);
    }

    let gear = 'D';
    if (this.playerCar.speed < -0.1) gear = 'R';
    else if (this.playerCar.speed < 0.1) gear = 'N';

    // Live coin counter: the balance plus what this run has banked so
    // far, so the HUD number is the number you'd walk away with.
    this.runCoins = this.store.computeEndlessReward({
      distance: this.playerCar.distanceTravelled,
      levelReached: this.bestLevelThisRun,
      nearMisses: this.nearMissesThisRun,
      isNewBest: false,
    }).total;

    this.ui.updateHUD({
      distance: this.playerCar.distanceTravelled,
      score: this.score,
      speedKmh,
      nitroPct: (this.playerCar.nitro / this.playerCar.maxNitro()) * 100,
      gear,
      coins: this.store.coins + this.runCoins,
    });
  }

  // --- Race mode's own per-frame update: same car physics, road, and
  // traffic dodge-or-crash risk as endless mode, but with AI opponents,
  // a fixed finish-line goal instead of level progression, and rival
  // contact treated as a soft bump instead of a crash. ---
  _updateRace(dt) {
    if (!this._firstThrottleGiven && this.input.state.accelerate) {
      this._firstThrottleGiven = true;
      this.ui.notifyFirstThrottleInput();
    }

    this.playerCar.update(dt, this.input.state);
    this.road.update(this.playerCar.distanceTravelled);
    this.traffic.spawnAhead(this.playerCar.distanceTravelled, this.playerCar.distanceTravelled);
    this.traffic.update(dt, this.playerCar.distanceTravelled);
    this.raceManager.update(dt, this.playerCar, this.traffic);
    this.cameraRig.update(dt, this.playerCar);

    const speedRatio = Math.max(0, this.playerCar.speed) / CONFIG.CAR_MAX_SPEED_NITRO;
    this.audio.updateEngine(speedRatio, this.playerCar.isNitro);
    const speedKmh = this.playerCar.getSpeedKmh();
    if (speedKmh > this.topSpeedKmh) this.topSpeedKmh = speedKmh;

    // Background traffic is still a hard crash in race mode — bumping a
    // rival racer (handled inside RaceManager) is not.
    const hitIndex = this.traffic.checkCarCollision(this.playerCar.distanceTravelled, this.playerCar.lateralX, CONFIG.CAR_HALF_WIDTH, CONFIG.CAR_HALF_LENGTH);
    if (hitIndex >= 0) {
      this.playerCar.crashed = true;
      this._endRace(true);
      return;
    }

    const gotPickup = this.traffic.checkPickupCollision(this.playerCar.distanceTravelled, this.playerCar.lateralX, 1.3);
    if (gotPickup) {
      this.playerCar.nitro = Math.min(this.playerCar.maxNitro(), this.playerCar.nitro + CONFIG.NITRO_PICKUP_AMOUNT);
      this.audio.playPickup();
    }

    if (Math.abs(this.playerCar.lateralX) > CONFIG.CAR_MAX_X + 1) {
      this.playerCar.crashed = true;
      this._endRace(true);
      return;
    }

    if (this.playerCar.distanceTravelled >= CONFIG.RACE_FINISH_DISTANCE) {
      this._endRace(false);
      return;
    }

    let gear = 'D';
    if (this.playerCar.speed < -0.1) gear = 'R';
    else if (this.playerCar.speed < 0.1) gear = 'N';

    this.ui.updateHUD({
      distance: this.playerCar.distanceTravelled,
      score: this.playerCar.distanceTravelled,
      speedKmh,
      nitroPct: (this.playerCar.nitro / this.playerCar.maxNitro()) * 100,
      gear,
      coins: this.store.coins,
    });
    this.ui.updateRacePanel({
      distanceRemaining: CONFIG.RACE_FINISH_DISTANCE - this.playerCar.distanceTravelled,
      standings: this.raceManager.getStandings(this.playerCar),
    });
  }
}
