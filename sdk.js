// =========================================================
// GamePortalSDK — client reference implementation (./sdk.js)
//
// This file matches the documented Complete Client-Side SDK API
// Code Reference exactly (method names, option shapes, callback
// signatures): ready, gameplayStart, gameplayStop, showInterstitial,
// showRewardedAd, purchaseItem, getPurchases, trackScore,
// invitePlayer, saveData, loadData, onMuteChange.
//
// A real portal host serves its own sdk.js (with live ads, a real
// leaderboard, real payments, etc.) at this same relative path when
// the game is deployed there — that build overwrites/replaces this
// file. Until then, this is a safe **standalone/offline fallback**:
// every method is a real, working implementation, just backed by
// local storage and simulated ad overlays instead of a live portal
// backend, so the game is fully playable and testable outside any
// portal iframe.
//
// If a portal has already defined window.GamePortalSDK before this
// script runs, we never touch it — their real SDK always wins.
// =========================================================

(function () {
  if (window.GamePortalSDK) return;

  const STORAGE_PREFIX = 'gameportalsdk:';
  const muteListeners = [];

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch (e) { /* storage blocked — ignore */ }
  }

  // ---------------------------------------------------------
  // Tiny simulated ad overlay, shared by showInterstitial and
  // showRewardedAd so standalone play actually exercises the
  // same UX shape (a countdown, a dismiss) a real ad would.
  // ---------------------------------------------------------
  function runSimulatedAd(label, seconds, onDone) {
    let overlay;
    try {
      overlay = document.createElement('div');
      overlay.setAttribute('style', [
        'position:fixed', 'inset:0', 'z-index:999999',
        'background:rgba(6,8,16,0.92)', 'color:#fff',
        'display:flex', 'flex-direction:column', 'align-items:center', 'justify-content:center',
        'font:600 16px/1.4 system-ui,sans-serif', 'letter-spacing:0.03em',
        'gap:10px',
      ].join(';'));
      const title = document.createElement('div');
      title.textContent = label;
      title.style.opacity = '0.7';
      title.style.fontSize = '12px';
      title.style.textTransform = 'uppercase';
      const count = document.createElement('div');
      count.style.fontSize = '38px';
      overlay.appendChild(title);
      overlay.appendChild(count);
      document.body.appendChild(overlay);

      let remaining = seconds;
      count.textContent = String(remaining);
      const tick = setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          clearInterval(tick);
          overlay.remove();
          onDone();
        } else {
          count.textContent = String(remaining);
        }
      }, 1000);
    } catch (e) {
      // No DOM available (or something went wrong building the overlay) —
      // don't block gameplay on a cosmetic simulation.
      if (overlay && overlay.remove) overlay.remove();
      onDone();
    }
  }

  const GamePortalSDK = {

    // ---- Lifecycle -----------------------------------------------------

    ready() {
      // Standalone mode has no host preloader to dismiss — just log so
      // it's visible during local testing.
      console.log('[GamePortalSDK] ready() — standalone mode, no portal host detected');
    },

    gameplayStart() {
      console.log('[GamePortalSDK] gameplayStart()');
    },

    gameplayStop() {
      console.log('[GamePortalSDK] gameplayStop()');
    },

    // ---- Ads -------------------------------------------------------------

    showInterstitial(options) {
      console.log('[GamePortalSDK] showInterstitial() called — standalone mode');
      const opts = options || {};
      try { if (opts.onStarted) opts.onStarted(); } catch (e) {}
      console.log('[GamePortalSDK] showInterstitial() → onStarted (simulated ad playing)');
      runSimulatedAd('Advertisement · standalone mode', 3, () => {
        console.log('[GamePortalSDK] showInterstitial() → onCompleted');
        try { if (opts.onCompleted) opts.onCompleted(); } catch (e) {}
      });
    },

    showRewardedAd(options) {
      console.log('[GamePortalSDK] showRewardedAd() called — standalone mode');
      const opts = options || {};
      try { if (opts.onStarted) opts.onStarted(); } catch (e) {}
      console.log('[GamePortalSDK] showRewardedAd() → onStarted (simulated ad playing)');
      runSimulatedAd('Rewarded ad · standalone mode', 3, () => {
        // Standalone mode always plays the simulated ad to completion,
        // so the reward path is what actually gets exercised.
        console.log('[GamePortalSDK] showRewardedAd() → onRewarded');
        try { if (opts.onRewarded) opts.onRewarded(); } catch (e) {}
      });
    },

    // ---- Monetization / store --------------------------------------------

    purchaseItem(itemId, callback) {
      console.warn('[GamePortalSDK] purchaseItem("' + itemId + '") — no payment provider in standalone mode');
      if (typeof callback === 'function') callback(false, null);
    },

    getPurchases(callback) {
      const raw = safeGet(STORAGE_PREFIX + 'purchases');
      let items = [];
      try { items = raw ? JSON.parse(raw) : []; } catch (e) { items = []; }
      if (typeof callback === 'function') callback(items);
    },

    // ---- Leaderboard -------------------------------------------------------

    trackScore(score) {
      console.log('[GamePortalSDK] trackScore(' + score + ')');
    },

    // ---- Multiplayer / social -----------------------------------------------

    invitePlayer(options, callback) {
      console.warn('[GamePortalSDK] invitePlayer() — no multiplayer backend in standalone mode', options);
      if (typeof callback === 'function') callback(false);
    },

    // ---- Cloud storage ---------------------------------------------------

    saveData(key, data) {
      safeSet(STORAGE_PREFIX + key, JSON.stringify(data));
    },

    loadData(key, callback) {
      const raw = safeGet(STORAGE_PREFIX + key);
      let data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch (e) { data = null; }
      if (typeof callback === 'function') callback(data);
    },

    // ---- Audio control -----------------------------------------------------

    onMuteChange(callback) {
      if (typeof callback === 'function') muteListeners.push(callback);
    },
  };

  window.GamePortalSDK = GamePortalSDK;
})();
