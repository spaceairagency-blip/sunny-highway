// =========================================================
// AdManager
// Thin wrapper around the real GamePortalSDK (loaded from
// sdk.js — see the /sdk.js API reference). Centralizes:
//   - SDK lifecycle hooks (ready / gameplayStart / gameplayStop)
//   - Interstitial ads, rate-limited so they never show back-
//     to-back or on the player's very first game-over — that
//     pattern gets games flagged/rejected on most portals.
//   - Rewarded ads (opt-in, player-initiated) for score
//     doubling, mid-run revive, and NOS refills.
//   - Score tracking + platform mute-button syncing.
//
// The SDK script degrades gracefully to a local no-op/simulated
// mode when not running inside a portal iframe, so this manager
// works fine when the game is played standalone too.
//
// Method/callback names below are matched exactly to the
// documented API (GamePortalSDK.ready/gameplayStart/gameplayStop/
// showInterstitial/showRewardedAd/trackScore/onMuteChange) —
// no invented methods.
// =========================================================

const MIN_MS_BETWEEN_INTERSTITIALS = 60000; // never more than 1 per 60s
const SKIP_FIRST_N_GAMEOVERS = 1;           // don't interrupt the very first run

// If a portal's real ad call never fires any callback at all — which is
// exactly what an ad blocker silently dropping the ad network's request
// looks like from here, as opposed to the SDK erroring out immediately —
// we force the game to continue anyway after this long, rather than
// leaving the player stuck on a frozen crash/pause screen forever
// wondering if the game is broken.
const AD_CALLBACK_TIMEOUT_MS = 8000;

export class AdManager {
  constructor(audio) {
    this.audio = audio;
    this.sdk = null;
    this.lastInterstitialAt = 0;
    this.gameOverCount = 0;
    this.adInProgress = false;
  }

  init() {
    this.sdk = window.GamePortalSDK || null;
    if (this.sdk) {
      this._wireSdk();
    } else {
      // The SDK script is loaded with `defer` (see index.html) so it
      // can't stall the page if its request hangs — but that also means
      // it might genuinely not have finished loading yet at this exact
      // moment, ad blocker or not. Keep checking for a few seconds
      // before giving up for the session, so a slightly-late (or
      // slow-network) SDK still gets picked up instead of the game
      // permanently treating ads as unavailable just because it looked
      // one tick too early.
      this._pollForLateSdk();
    }
    return !!this.sdk;
  }

  _wireSdk() {
    try { this.sdk.ready(); } catch (e) { /* portal not ready to receive yet */ }
    // Sync the platform's own mute toggle (if the player mutes from the
    // portal chrome rather than our in-game button) straight into our
    // AudioManager, so the two mute controls never disagree.
    if (typeof this.sdk.onMuteChange === 'function') {
      try {
        this.sdk.onMuteChange((isMuted) => {
          if (this.audio) this.audio.setEnabled(!isMuted);
        });
      } catch (e) {}
    }
  }

  _pollForLateSdk(attempt = 0) {
    const MAX_ATTEMPTS = 10;
    const INTERVAL_MS = 400;
    if (attempt >= MAX_ATTEMPTS) return; // give up quietly — game already runs fine without ads
    setTimeout(() => {
      if (this.sdk) return; // already picked up some other way
      const found = window.GamePortalSDK || null;
      if (found) {
        this.sdk = found;
        this._wireSdk();
      } else {
        this._pollForLateSdk(attempt + 1);
      }
    }, INTERVAL_MS);
  }

  notifyGameplayStart() {
    if (this.sdk) { try { this.sdk.gameplayStart(); } catch (e) {} }
  }

  notifyGameplayStop() {
    if (this.sdk) { try { this.sdk.gameplayStop(); } catch (e) {} }
  }

  trackScore(score) {
    if (this.sdk) { try { this.sdk.trackScore(score); } catch (e) {} }
  }

  /**
   * Whether an interstitial is allowed right now (rate limit + not
   * mid-ad already). Callers should check this before deciding whether
   * to even attempt showGameOverInterstitial, so the game-over flow
   * doesn't stall waiting on a skipped ad.
   */
  canShowInterstitial() {
    if (!this.sdk || this.adInProgress) return false;
    if (this.gameOverCount < SKIP_FIRST_N_GAMEOVERS) return false;
    return Date.now() - this.lastInterstitialAt >= MIN_MS_BETWEEN_INTERSTITIALS;
  }

  // Wraps a "the ad finished" callback so it's guaranteed to fire exactly
  // once, even if the underlying SDK call never invokes any callback at
  // all (network request silently dropped by an ad blocker, portal SDK
  // bug, etc). Whichever fires first — the real callback or the timeout —
  // wins; the other is ignored. The returned function also has a
  // .cancel() method so callers can disarm the timeout entirely when a
  // *different* real callback already handled completion (see
  // showRewarded's onRewarded path below).
  _withTimeout(fn, timeoutMs = AD_CALLBACK_TIMEOUT_MS) {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      fn();
    }, timeoutMs);
    const wrapped = (...args) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      fn(...args);
    };
    wrapped.cancel = () => {
      done = true;
      clearTimeout(timer);
    };
    return wrapped;
  }

  /**
   * Call once per game-over — internally tracks the count used by the
   * "skip the first run" rule and attempts an interstitial if allowed.
   * onDone always fires exactly once, whether or not an ad actually played.
   */
  showGameOverInterstitial(onDone) {
    this.gameOverCount++;
    if (!this.canShowInterstitial()) {
      onDone();
      return;
    }
    this.adInProgress = true;
    this.lastInterstitialAt = Date.now();
    const finish = this._withTimeout(() => {
      this.adInProgress = false;
      if (this.audio) this.audio.duckEngine(false);
      onDone();
    });
    try {
      this.sdk.showInterstitial({
        onStarted: () => { if (this.audio) this.audio.duckEngine(true); },
        onCompleted: finish,
        onFailed: finish,
      });
    } catch (e) {
      // The call itself threw synchronously (rare, but a blocked/broken
      // SDK method could) — finish immediately rather than waiting out
      // the full timeout for nothing.
      finish();
    }
  }

  /**
   * Player-initiated rewarded ad (double score, revive, NOS refill, etc).
   * Matches the documented showRewardedAd(options) shape exactly:
   * onRewarded() fires only if the player watched to completion, and
   * onSkipped() fires if they backed out early — neither takes a
   * parameter, so we don't invent one. We normalize both into the
   * onRewarded/onSkipped callbacks callers pass in here.
   */
  showRewarded({ onRewarded, onSkipped }) {
    if (!this.sdk || this.adInProgress) {
      if (onSkipped) onSkipped();
      return;
    }
    this.adInProgress = true;
    if (this.audio) this.audio.duckEngine(true);
    // A stalled rewarded ad must resolve as "skipped", never as
    // "rewarded" — a hung/blocked ad call should not silently hand the
    // player a reward they didn't actually earn.
    const finishSkipped = this._withTimeout(() => {
      this.adInProgress = false;
      if (this.audio) this.audio.duckEngine(false);
      if (onSkipped) onSkipped();
    });
    const finishRewarded = () => {
      // Reuse the same "already done" guard: calling finishSkipped's
      // inner logic path isn't right here, so just replicate the
      // one-shot bookkeeping directly for the success path.
      this.adInProgress = false;
      if (this.audio) this.audio.duckEngine(false);
      if (onRewarded) onRewarded();
    };
    try {
      this.sdk.showRewardedAd({
        onRewarded: () => {
          // Disarm the pending timeout so it can't also fire later.
          finishSkipped.cancel();
          finishRewarded();
        },
        onSkipped: finishSkipped,
      });
    } catch (e) {
      finishSkipped();
    }
  }

  get isReady() {
    return !!this.sdk;
  }
}
