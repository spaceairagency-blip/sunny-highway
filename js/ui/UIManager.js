import { CONFIG } from '../config.js';

// =========================================================
// UIManager
// Owns all DOM references and screen transitions. Keeps the
// game loop free of document.getElementById calls.
// =========================================================

export class UIManager {
  constructor() {
    this.el = {
      bootScreen: document.getElementById('boot-screen'),
      bootBarFill: document.getElementById('boot-bar-fill'),
      bootStatus: document.getElementById('boot-status'),

      menuScreen: document.getElementById('menu-screen'),
      bestDistance: document.getElementById('best-distance'),
      bestSpeed: document.getElementById('best-speed'),
      bestLevel: document.getElementById('best-level'),
      btnStart: document.getElementById('btn-start'),
      btnHowto: document.getElementById('btn-howto'),
      btnSound: document.getElementById('btn-sound'),

      howtoModal: document.getElementById('howto-modal'),
      btnHowtoClose: document.getElementById('btn-howto-close'),

      hud: document.getElementById('hud'),
      hudDistance: document.getElementById('hud-distance'),
      hudScore: document.getElementById('hud-score'),
      btnPause: document.getElementById('btn-pause'),
      nitroFill: document.getElementById('nitro-fill'),
      speedoNeedle: document.getElementById('speedo-needle'),
      speedoArc: document.getElementById('speedo-arc'),
      speedoValue: document.getElementById('speedo-value'),
      gearLabel: document.getElementById('gear-label'),
      controlsLegend: document.getElementById('controls-legend'),

      levelPanel: document.getElementById('level-panel'),
      levelNumber: document.getElementById('level-number'),
      levelTheme: document.getElementById('level-theme'),
      levelProgressFill: document.getElementById('level-progress-fill'),

      levelupToast: document.getElementById('levelup-toast'),
      levelupNumber: document.getElementById('levelup-number'),
      levelupTheme: document.getElementById('levelup-theme'),

      touchControls: document.getElementById('touch-controls'),

      rotateHint: document.getElementById('rotate-hint'),
      rotateDismiss: document.getElementById('rotate-dismiss'),

      pauseOverlay: document.getElementById('pause-overlay'),
      btnResume: document.getElementById('btn-resume'),
      btnRestartFromPause: document.getElementById('btn-restart-from-pause'),
      btnQuit: document.getElementById('btn-quit'),

      gameoverScreen: document.getElementById('gameover-screen'),
      gameoverFlash: document.getElementById('gameover-flash'),
      finalDistance: document.getElementById('final-distance'),
      finalScore: document.getElementById('final-score'),
      finalSpeed: document.getElementById('final-speed'),
      finalLevel: document.getElementById('final-level'),
      newBestBadge: document.getElementById('new-best-badge'),
      btnRetry: document.getElementById('btn-retry'),
      btnMenuFromOver: document.getElementById('btn-menu-from-over'),
    };

    this._legendFadeTimer = null;
    this._levelupTimer = null;
  }

  // ---------- Boot ----------
  setBootProgress(pct, statusText) {
    this.el.bootBarFill.style.width = `${Math.round(pct * 100)}%`;
    if (statusText) this.el.bootStatus.textContent = statusText;
  }

  hideBoot() {
    this.el.bootScreen.classList.add('hidden');
  }

  // ---------- Menu ----------
  showMenu(stats) {
    this.el.menuScreen.classList.remove('hidden');
    this.el.hud.classList.add('hidden');
    this.el.touchControls.classList.add('hidden');
    this.el.gameoverScreen.classList.add('hidden');
    this.el.pauseOverlay.classList.add('hidden');
    this.updateBestStats(stats);
  }

  hideMenu() {
    this.el.menuScreen.classList.add('hidden');
  }

  updateBestStats({ bestDistance, bestSpeed, bestLevel }) {
    this.el.bestDistance.textContent = `${Math.round(bestDistance)}m`;
    this.el.bestSpeed.textContent = `${Math.round(bestSpeed)} km/h`;
    if (this.el.bestLevel && bestLevel != null) this.el.bestLevel.textContent = `${bestLevel}/50`;
  }

  setSoundButton(on) {
    this.el.btnSound.textContent = on ? '🔊 SOUND' : '🔇 MUTED';
    this.el.btnSound.setAttribute('aria-pressed', String(on));
  }

  showHowTo() { this.el.howtoModal.classList.remove('hidden'); }
  hideHowTo() { this.el.howtoModal.classList.add('hidden'); }

  // ---------- Rotate hint ----------
  showRotateHint() { this.el.rotateHint.classList.remove('hidden'); }
  hideRotateHint() { this.el.rotateHint.classList.add('hidden'); }

  // ---------- In-game HUD ----------
  showHUD(isTouch) {
    this.el.hud.classList.remove('hidden');
    if (isTouch) this.el.touchControls.classList.remove('hidden');
    this._resetLegendFade();
  }

  hideHUD() {
    this.el.hud.classList.add('hidden');
    this.el.touchControls.classList.add('hidden');
    if (this.el.levelupToast) {
      clearTimeout(this._levelupTimer);
      this.el.levelupToast.classList.remove('levelup-pop');
      this.el.levelupToast.classList.add('hidden');
    }
  }

  _resetLegendFade() {
    if (!this.el.controlsLegend) return;
    this.el.controlsLegend.style.opacity = '1';
    clearTimeout(this._legendFadeTimer);
    this._legendFadeTimer = setTimeout(() => {
      this.el.controlsLegend.style.opacity = '0.35';
    }, 6000);
  }

  updateHUD({ distance, score, speedKmh, nitroPct, gear }) {
    this.el.hudDistance.textContent = `${Math.round(distance)}m`;
    this.el.hudScore.textContent = `${Math.round(score)}`;
    this.el.nitroFill.style.width = `${Math.max(0, Math.min(100, nitroPct))}%`;
    this.el.speedoValue.textContent = Math.round(speedKmh);
    this.el.gearLabel.textContent = gear;

    // Speedo needle: -90deg (0 speed) to +90deg (max speed), arc length ~267
    const maxKmh = CONFIG.CAR_MAX_SPEED_NITRO * 3.6;
    const t = Math.max(0, Math.min(1, speedKmh / maxKmh));
    const angle = -90 + t * 180;
    this.el.speedoNeedle.style.transform = `rotate(${angle}deg)`;
    const dashOffset = 267 - t * 267;
    this.el.speedoArc.style.strokeDashoffset = String(dashOffset);
  }

  // ---------- Levels ----------
  updateLevel({ displayNumber, theme, progress0to1 }) {
    if (this.el.levelNumber) this.el.levelNumber.textContent = `LV ${displayNumber}`;
    if (this.el.levelTheme) this.el.levelTheme.textContent = theme.label.toUpperCase();
    if (this.el.levelProgressFill) this.el.levelProgressFill.style.width = `${Math.max(0, Math.min(100, progress0to1 * 100))}%`;
  }

  showLevelUpToast({ displayNumber, theme }) {
    if (!this.el.levelupToast) return;
    this.el.levelupNumber.textContent = `LEVEL ${displayNumber}`;
    this.el.levelupTheme.textContent = theme.label.toUpperCase();
    this.el.levelupToast.classList.remove('hidden');
    this.el.levelupToast.classList.add('levelup-pop');
    clearTimeout(this._levelupTimer);
    this._levelupTimer = setTimeout(() => {
      this.el.levelupToast.classList.remove('levelup-pop');
      this.el.levelupToast.classList.add('hidden');
    }, 2200);
  }

  // ---------- Pause ----------
  showPause() { this.el.pauseOverlay.classList.remove('hidden'); }
  hidePause() { this.el.pauseOverlay.classList.add('hidden'); }

  // ---------- Game over ----------
  showGameOver({ distance, score, topSpeedKmh, level, isNewBest }) {
    this.el.finalDistance.textContent = `${Math.round(distance)}m`;
    this.el.finalScore.textContent = `${Math.round(score)}`;
    this.el.finalSpeed.textContent = `${Math.round(topSpeedKmh)} km/h`;
    if (this.el.finalLevel && level != null) this.el.finalLevel.textContent = `${level}/50`;
    this.el.newBestBadge.classList.toggle('hidden', !isNewBest);
    this.el.gameoverScreen.classList.remove('hidden');
    this.el.hud.classList.add('hidden');
    this.el.touchControls.classList.add('hidden');
    if (this.el.levelupToast) {
      clearTimeout(this._levelupTimer);
      this.el.levelupToast.classList.remove('levelup-pop');
      this.el.levelupToast.classList.add('hidden');
    }
    // restart flash animation
    this.el.gameoverFlash.style.animation = 'none';
    void this.el.gameoverFlash.offsetWidth;
    this.el.gameoverFlash.style.animation = '';
  }

  hideGameOver() {
    this.el.gameoverScreen.classList.add('hidden');
  }

  // ---------- Orientation ----------
  checkOrientationHint() {
    const isPortraitPhone = window.innerHeight > window.innerWidth && window.innerWidth < 560;
    // We support both orientations, so this is just a one-time friendly nudge, not a blocker.
    return isPortraitPhone;
  }
}
