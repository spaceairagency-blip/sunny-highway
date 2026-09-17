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
      btnRaceMode: document.getElementById('btn-race-mode'),
      btnHowto: document.getElementById('btn-howto'),
      btnSound: document.getElementById('btn-sound'),
      btnSoundIcon: document.getElementById('btn-sound-icon'),
      btnSoundLabel: document.getElementById('btn-sound-label'),

      btnStoreOpen: document.getElementById('btn-store-open'),
      btnStoreOpen2: document.getElementById('btn-store-open-2'),
      menuCoinValue: document.getElementById('menu-coin-value'),
      storePreviewGrid: document.getElementById('store-preview-grid'),
      storeCurrent: document.getElementById('store-current'),

      storeScreen: document.getElementById('store-screen'),
      storeGrid: document.getElementById('store-grid'),
      storeCoinValue: document.getElementById('store-coin-value'),
      storeToast: document.getElementById('store-toast'),
      btnStoreClose: document.getElementById('btn-store-close'),

      hudCoins: document.getElementById('hud-coins'),

      payoutCard: document.getElementById('payout-card'),
      payoutTotal: document.getElementById('payout-total'),
      payoutLines: document.getElementById('payout-lines'),
      payoutBalance: document.getElementById('payout-balance'),
      racePayoutCard: document.getElementById('race-payout-card'),
      racePayoutTotal: document.getElementById('race-payout-total'),
      racePayoutBalance: document.getElementById('race-payout-balance'),

      howtoModal: document.getElementById('howto-modal'),
      btnHowtoClose: document.getElementById('btn-howto-close'),

      raceSetupModal: document.getElementById('race-setup-modal'),
      raceOpponentGrid: document.getElementById('race-opponent-grid'),
      btnRaceSetupClose: document.getElementById('btn-race-setup-close'),

      hud: document.getElementById('hud'),
      hudDistance: document.getElementById('hud-distance'),
      hudScore: document.getElementById('hud-score'),
      btnPause: document.getElementById('btn-pause'),
      nitroFill: document.getElementById('nitro-fill'),
      btnWatchAdNos: document.getElementById('btn-watch-ad-nos'),
      speedoNeedle: document.getElementById('speedo-needle'),
      speedoArc: document.getElementById('speedo-arc'),
      speedoValue: document.getElementById('speedo-value'),
      gearLabel: document.getElementById('gear-label'),
      controlsLegend: document.getElementById('controls-legend'),
      startPrompt: document.getElementById('start-prompt'),
      startPromptText: document.getElementById('start-prompt-text'),

      levelPanel: document.getElementById('level-panel'),
      levelNumber: document.getElementById('level-number'),
      levelTheme: document.getElementById('level-theme'),
      levelProgressFill: document.getElementById('level-progress-fill'),

      racePanel: document.getElementById('race-panel'),
      racePlace: document.getElementById('race-place'),
      racePlaceTotal: document.getElementById('race-place-total'),
      raceProgressFill: document.getElementById('race-progress-fill'),
      raceDistanceRemaining: document.getElementById('race-distance-remaining'),
      raceStandings: document.getElementById('race-standings'),
      raceCountdown: document.getElementById('race-countdown'),
      raceCountdownNumber: document.getElementById('race-countdown-number'),

      raceResultsScreen: document.getElementById('race-results-screen'),
      raceResultsTitle: document.getElementById('race-results-title'),
      raceResultsSubtitle: document.getElementById('race-results-subtitle'),
      raceResultsList: document.getElementById('race-results-list'),
      btnRaceAgain: document.getElementById('btn-race-again'),
      btnRaceMenu: document.getElementById('btn-race-menu'),

      levelupToast: document.getElementById('levelup-toast'),
      levelupNumber: document.getElementById('levelup-number'),
      levelupTheme: document.getElementById('levelup-theme'),

      touchControls: document.getElementById('touch-controls'),

      orientationGate: document.getElementById('orientation-gate'),
      orientationGateBtn: document.getElementById('orientation-gate-btn'),

      pauseOverlay: document.getElementById('pause-overlay'),
      btnResume: document.getElementById('btn-resume'),
      btnWatchAdPause: document.getElementById('btn-watch-ad-pause'),
      btnRestartFromPause: document.getElementById('btn-restart-from-pause'),
      btnQuit: document.getElementById('btn-quit'),

      gameoverScreen: document.getElementById('gameover-screen'),
      gameoverFlash: document.getElementById('gameover-flash'),
      finalDistance: document.getElementById('final-distance'),
      finalScore: document.getElementById('final-score'),
      finalSpeed: document.getElementById('final-speed'),
      finalLevel: document.getElementById('final-level'),
      newBestBadge: document.getElementById('new-best-badge'),
      btnWatchAdRevive: document.getElementById('btn-watch-ad-revive'),
      btnWatchAdDouble: document.getElementById('btn-watch-ad-double'),
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
    if (this.el.raceResultsScreen) this.el.raceResultsScreen.classList.add('hidden');
    if (this.el.raceCountdown) this.el.raceCountdown.classList.add('hidden');
    if (this.el.storeScreen) this.el.storeScreen.classList.add('hidden');
    this.updateBestStats(stats);
  }

  hideMenu() {
    this.el.menuScreen.classList.add('hidden');
  }

  showRaceSetup() { if (this.el.raceSetupModal) this.el.raceSetupModal.classList.remove('hidden'); }
  hideRaceSetup() { if (this.el.raceSetupModal) this.el.raceSetupModal.classList.add('hidden'); }

  updateBestStats({ bestDistance, bestSpeed, bestLevel }) {
    this.el.bestDistance.textContent = `${Math.round(bestDistance)}m`;
    this.el.bestSpeed.textContent = `${Math.round(bestSpeed)} km/h`;
    if (this.el.bestLevel && bestLevel != null) this.el.bestLevel.textContent = `${bestLevel}/50`;
  }

  setSoundButton(on) {
    // The button is now an icon tile rather than a text button, so write
    // into its two spans instead of blowing away its children.
    if (this.el.btnSoundIcon) this.el.btnSoundIcon.textContent = on ? '🔊' : '🔇';
    if (this.el.btnSoundLabel) this.el.btnSoundLabel.textContent = on ? 'SOUND' : 'MUTED';
    if (this.el.btnSound) this.el.btnSound.setAttribute('aria-pressed', String(on));
  }

  showHowTo() { this.el.howtoModal.classList.remove('hidden'); }
  hideHowTo() { this.el.howtoModal.classList.add('hidden'); }

  // ---------- Store ----------
  // A simple side-on car silhouette drawn as inline SVG, tinted with the
  // car's own livery color. Inline SVG (rather than an image per car)
  // keeps the store asset-free and means the shop swatch is always the
  // exact same hex the 3D car gets painted with.
  _carSvg(color, { compact = false } = {}) {
    const wheel = '#1c1e22';
    const glass = 'rgba(255,255,255,0.75)';
    return `
      <svg viewBox="0 0 120 52" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M8 38 L14 26 Q18 20 27 19 L44 17 Q52 11 66 11 Q82 11 90 19 L104 22 Q113 24 113 31 L113 38 Z"
              fill="${color}" stroke="rgba(0,0,0,0.18)" stroke-width="1.5" stroke-linejoin="round"/>
        <path d="M46 18 Q53 13 65 13 Q77 13 84 19 L66 20 Z" fill="${glass}"/>
        ${compact ? '' : `<rect x="104" y="27" width="8" height="4" rx="2" fill="#fff3c4"/>
        <rect x="9" y="29" width="7" height="4" rx="2" fill="#ff5a5a"/>`}
        <circle cx="34" cy="39" r="9" fill="${wheel}"/>
        <circle cx="34" cy="39" r="4" fill="#9aa0a6"/>
        <circle cx="93" cy="39" r="9" fill="${wheel}"/>
        <circle cx="93" cy="39" r="4" fill="#9aa0a6"/>
      </svg>`;
  }

  // Turn a multiplier (roughly 0.9–1.5) into a 0–100 bar width so the
  // differences between cars are actually visible rather than all bars
  // sitting at "nearly full".
  _statPct(mult) {
    const t = (mult - 0.85) / (1.6 - 0.85);
    return Math.max(6, Math.min(100, Math.round(t * 100)));
  }

  _statRows(stats) {
    const rows = [
      ['SPEED', stats.speed],
      ['ACCEL', stats.accel],
      ['GRIP', stats.grip],
      ['NOS', stats.nitro],
    ];
    return rows.map(([label, v]) => `
      <div class="stat-row">
        <span class="stat-row-label">${label}</span>
        <span class="stat-bar"><span class="stat-bar-fill" style="width:${this._statPct(v)}%"></span></span>
      </div>`).join('');
  }

  setCoins(coins) {
    const text = String(Math.round(coins));
    if (this.el.menuCoinValue) this.el.menuCoinValue.textContent = text;
    if (this.el.storeCoinValue) this.el.storeCoinValue.textContent = text;
    if (this.el.hudCoins) this.el.hudCoins.textContent = text;
  }

  // `catalog` comes from StoreManager.getCatalogView(): each entry already
  // knows whether it's owned / selected / affordable, so the UI only has
  // to decide how that looks.
  renderStore(catalog, coins) {
    this.setCoins(coins);

    if (this.el.storeGrid) {
      this.el.storeGrid.innerHTML = catalog.map((car) => {
        const stateClass = car.selected ? 'is-selected' : (car.owned ? '' : 'is-locked');
        let foot;
        if (car.selected) {
          foot = `<span class="store-card-price">Equipped</span>
                  <span class="btn-store-action is-equipped">DRIVING</span>`;
        } else if (car.owned) {
          foot = `<span class="store-card-price">Owned</span>
                  <button class="btn-store-action" data-action="select" data-car="${car.id}">EQUIP</button>`;
        } else {
          const priceClass = car.affordable ? '' : ' is-unaffordable';
          foot = `<span class="store-card-price${priceClass}"><span class="coin-icon">◉</span>${car.price}</span>
                  <button class="btn-store-action is-buy" data-action="buy" data-car="${car.id}"${car.affordable ? '' : ' disabled'}>BUY</button>`;
        }
        return `
          <div class="store-card ${stateClass}">
            <div class="store-card-art">${this._carSvg(car.color)}</div>
            <h3 class="store-card-name">${car.name}</h3>
            <p class="store-card-blurb">${car.blurb}</p>
            ${this._statRows(car.stats)}
            <div class="store-card-foot">${foot}</div>
          </div>`;
      }).join('');
    }

    // Menu-side preview: first four cars as compact swatches, plus a
    // reminder of what you're currently driving.
    if (this.el.storePreviewGrid) {
      this.el.storePreviewGrid.innerHTML = catalog.slice(0, 8).map((car) => `
        <div class="store-preview-cell ${car.selected ? 'is-selected' : (car.owned ? '' : 'is-locked')}">
          ${this._carSvg(car.color, { compact: true })}
          <span class="store-preview-price">${car.owned ? (car.selected ? 'DRIVING' : 'OWNED') : `◉${car.price}`}</span>
        </div>`).join('');
    }
    if (this.el.storeCurrent) {
      const current = catalog.find((c) => c.selected) || catalog[0];
      this.el.storeCurrent.innerHTML = `
        <span class="store-current-label">YOUR CAR</span>
        <span class="store-current-name">${current.name}</span>`;
    }
  }

  showStore() {
    if (this.el.storeScreen) this.el.storeScreen.classList.remove('hidden');
    this.hideStoreToast();
  }

  hideStore() {
    if (this.el.storeScreen) this.el.storeScreen.classList.add('hidden');
    this.hideStoreToast();
  }

  showStoreToast(message, isError = false) {
    if (!this.el.storeToast) return;
    this.el.storeToast.textContent = message;
    this.el.storeToast.classList.toggle('is-error', !!isError);
    this.el.storeToast.classList.remove('hidden');
    clearTimeout(this._storeToastTimer);
    this._storeToastTimer = setTimeout(() => this.hideStoreToast(), 2600);
  }

  hideStoreToast() {
    if (this.el.storeToast) this.el.storeToast.classList.add('hidden');
  }

  // ---------- Coin payout summaries ----------
  showPayout({ total, lines }, balance) {
    if (this.el.payoutTotal) this.el.payoutTotal.textContent = String(total);
    if (this.el.payoutBalance) this.el.payoutBalance.textContent = String(balance);
    if (this.el.payoutLines) {
      this.el.payoutLines.innerHTML = lines
        .map((l) => `<li><span>${l.label}</span><span>+${l.amount}</span></li>`)
        .join('');
    }
    if (this.el.payoutCard) this.el.payoutCard.classList.remove('hidden');
  }

  showRacePayout({ total }, balance) {
    if (this.el.racePayoutTotal) this.el.racePayoutTotal.textContent = String(total);
    if (this.el.racePayoutBalance) this.el.racePayoutBalance.textContent = String(balance);
    if (this.el.racePayoutCard) this.el.racePayoutCard.classList.remove('hidden');
  }

  // ---------- Orientation gate (landscape required on mobile) ----------
  showOrientationGate() { this.el.orientationGate.classList.remove('hidden'); }
  hideOrientationGate() { this.el.orientationGate.classList.add('hidden'); }

  // ---------- In-game HUD ----------
  showHUD(isTouch, mode = 'endless') {
    this.el.hud.classList.remove('hidden');
    if (isTouch) {
      this.el.touchControls.classList.remove('hidden');
    }
    this._setHudMode(mode);

    // Don't fade the controls legend (or hide it on touch) until the
    // player has actually given real throttle input — a car sitting
    // still with a faded/hidden control hint is exactly what reads as
    // "the game is broken" to a new player. notifyFirstThrottleInput()
    // is what finally lets the legend fade / dismisses this prompt.
    clearTimeout(this._legendFadeTimer);
    if (this.el.controlsLegend) this.el.controlsLegend.style.opacity = '1';
    if (this.el.startPrompt) {
      if (this.el.startPromptText) {
        this.el.startPromptText.textContent = isTouch ? 'TAP GAS TO ACCELERATE' : 'HOLD ▲ TO ACCELERATE';
      }
      this.el.startPrompt.classList.remove('hidden');
    }
  }

  // Called once the player's very first real accelerate input lands —
  // dismisses the "how to start" prompt and lets the legend begin its
  // normal fade-after-a-few-seconds behavior.
  notifyFirstThrottleInput() {
    if (this.el.startPrompt) this.el.startPrompt.classList.add('hidden');
    this._resetLegendFade();
  }

  // Endless mode shows the level/score panels; race mode swaps in the
  // position/standings panels instead — same HUD container, different
  // top-bar contents, so speedo/nitro/pause/touch controls stay shared.
  _setHudMode(mode) {
    const isRace = mode === 'race';
    if (this.el.levelPanel) this.el.levelPanel.classList.toggle('hidden', isRace);
    const scorePanel = document.getElementById('score-panel');
    if (scorePanel) scorePanel.classList.toggle('hidden', isRace);
    if (this.el.racePanel) this.el.racePanel.classList.toggle('hidden', !isRace);
    if (this.el.raceStandings) this.el.raceStandings.classList.toggle('hidden', !isRace);
  }

  // ---------- Race mode HUD ----------
  updateRacePanel({ distanceRemaining, standings }) {
    if (!this.el.racePanel) return;
    const me = standings.find((s) => s.isPlayer);
    const total = standings.length;
    if (this.el.racePlace) this.el.racePlace.textContent = this._ordinal(me ? me.place : 1);
    if (this.el.racePlaceTotal) this.el.racePlaceTotal.textContent = `OF ${total}`;
    if (this.el.raceProgressFill) {
      const t = me ? Math.max(0, Math.min(1, me.distance / (me.distance + Math.max(1, distanceRemaining)))) : 0;
      this.el.raceProgressFill.style.width = `${t * 100}%`;
    }
    if (this.el.raceDistanceRemaining) {
      this.el.raceDistanceRemaining.textContent = distanceRemaining > 0
        ? `${Math.round(distanceRemaining)}m TO FINISH`
        : 'FINISHED!';
    }
    if (this.el.raceStandings) {
      this.el.raceStandings.innerHTML = standings.map((s) => `
        <li class="${s.isPlayer ? 'is-player' : ''}">
          <span class="race-standing-dot" style="background:${s.isPlayer ? '#2fae60' : (s.color || '#5b6b63')}"></span>
          ${s.place}. ${s.isPlayer ? 'YOU' : s.name}
        </li>
      `).join('');
    }
  }

  _ordinal(n) {
    const s = ['TH', 'ST', 'ND', 'RD'];
    const v = n % 100;
    return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
  }

  // ---------- Race countdown ----------
  showRaceCountdown(text) {
    if (!this.el.raceCountdown) return;
    this.el.raceCountdown.classList.remove('hidden');
    this.setRaceCountdownText(text);
  }

  setRaceCountdownText(text) {
    if (!this.el.raceCountdownNumber) return;
    this.el.raceCountdownNumber.textContent = text;
    // restart the pop animation on every tick
    this.el.raceCountdownNumber.style.animation = 'none';
    void this.el.raceCountdownNumber.offsetWidth;
    this.el.raceCountdownNumber.style.animation = '';
  }

  hideRaceCountdown() {
    if (this.el.raceCountdown) this.el.raceCountdown.classList.add('hidden');
  }

  // ---------- Race results ----------
  showRaceResults({ place, total, standings, wrecked }) {
    if (!this.el.raceResultsScreen) return;
    this.el.hud.classList.add('hidden');
    this.el.touchControls.classList.add('hidden');

    const won = place === 1 && !wrecked;
    if (this.el.raceResultsTitle) {
      this.el.raceResultsTitle.textContent = wrecked ? 'WRECKED!' : `${this._ordinal(place)} PLACE!`;
      this.el.raceResultsTitle.classList.toggle('is-loss', !won);
    }
    if (this.el.raceResultsSubtitle) {
      this.el.raceResultsSubtitle.textContent = wrecked
        ? `You crashed out of the race — finished ${this._ordinal(place)} of ${total}.`
        : won
          ? `You beat all ${total - 1} rivals to the finish line!`
          : `You crossed the line ${this._ordinal(place)} out of ${total}.`;
    }
    if (this.el.raceResultsList) {
      this.el.raceResultsList.innerHTML = standings.map((s) => `
        <li class="${s.isPlayer ? 'is-player' : ''}">
          <span class="race-result-place">${this._ordinal(s.place)}</span>
          <span class="race-standing-dot" style="background:${s.isPlayer ? '#2fae60' : (s.color || '#5b6b63')}"></span>
          ${s.isPlayer ? 'YOU' : s.name}
        </li>
      `).join('');
    }
    if (this.el.racePayoutCard) this.el.racePayoutCard.classList.add('hidden');
    this.el.raceResultsScreen.classList.remove('hidden');
  }

  hideRaceResults() {
    if (this.el.raceResultsScreen) this.el.raceResultsScreen.classList.add('hidden');
  }

  // ---------- Ad-driven actions ----------
  setNosAdChipVisible(visible) {
    if (this.el.btnWatchAdNos) this.el.btnWatchAdNos.classList.toggle('hidden', !visible);
  }

  setPauseAdButtonVisible(visible) {
    if (this.el.btnWatchAdPause) this.el.btnWatchAdPause.classList.toggle('hidden', !visible);
  }

  setReviveButtonVisible(visible) {
    if (this.el.btnWatchAdRevive) this.el.btnWatchAdRevive.classList.toggle('hidden', !visible);
  }

  setDoubleScoreButtonVisible(visible) {
    if (this.el.btnWatchAdDouble) this.el.btnWatchAdDouble.classList.toggle('hidden', !visible);
  }

  hideHUD() {
    this.el.hud.classList.add('hidden');
    this.el.touchControls.classList.add('hidden');
    if (this.el.startPrompt) this.el.startPrompt.classList.add('hidden');
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

  updateHUD({ distance, score, speedKmh, nitroPct, gear, coins }) {
    this.el.hudDistance.textContent = `${Math.round(distance)}m`;
    this.el.hudScore.textContent = `${Math.round(score)}`;
    if (this.el.hudCoins && coins != null) this.el.hudCoins.textContent = `${Math.round(coins)}`;
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
    // Hidden by default: the same screen is reused for the "watch an ad
    // to keep driving" offer, where the run isn't over and nothing has
    // been paid out yet. showPayout() reveals it on the real ending.
    if (this.el.payoutCard) this.el.payoutCard.classList.add('hidden');
    this.setReviveButtonVisible(false);
    this.setDoubleScoreButtonVisible(false);
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

  setFinalScore(score) {
    if (this.el.finalScore) this.el.finalScore.textContent = `${Math.round(score)}`;
  }

  // ---------- Orientation ----------
}
