/**
 * XandboxGames / GamePortalSDK Client-Side Library (v1.5.0)
 * Standalone SDK for sandboxed HTML5 games on PaperCroft XandboxGames.
 * Compatible with CrazyGames & Xandbox runtime protocols.
 *
 * Fetched from https://www.papercroft.com/sdk.js and vendored here
 * verbatim (this is the actual portal script, not a local fallback —
 * see js/ads/AdManager.js for how the game calls into it). It talks
 * to the real XandboxGames host via postMessage when embedded in
 * their iframe, and quietly no-ops/self-resolves when it isn't (e.g.
 * played directly, or during local dev), so the game stays fully
 * testable outside the portal too.
 */
(function (global) {
  'use strict';

  // Prevent multiple initializations
  if (global.GamePortalSDK) {
    return;
  }

  var isEmbedded = (global.parent && global.parent !== global);
  var pendingCallbacks = {};
  var callbackCounter = 1;
  var audioMuted = false;
  var muteListeners = [];
  var isReadySent = false;
  var currentScore = 0;
  var isPlaying = false;

  // Local fallback storage for standalone offline execution
  var localDataStore = {};
  var localPurchases = ['starter_skin'];

  function generateReqId() {
    return 'req_' + Date.now() + '_' + (callbackCounter++);
  }

  function postToParent(type, payload, reqId) {
    var message = {
      source: 'XANDBOX_GAME_SDK',
      type: type,
      payload: payload || {},
      requestId: reqId || null,
      timestamp: Date.now()
    };

    if (isEmbedded) {
      try {
        global.parent.postMessage(message, '*');
      } catch (err) {
        console.warn('[GamePortalSDK] postMessage dispatch failed:', err);
      }
    } else {
      console.log('[GamePortalSDK (Standalone Mode)] PostMessage:', message);
    }
  }

  // Listen for platform events from host
  if (typeof global.addEventListener === 'function') {
    global.addEventListener('message', function (event) {
      if (!event.data || typeof event.data !== 'object') return;
      var data = event.data;

      // Handle platform mute
      if (data.type === 'PLATFORM_MUTE_STATE') {
        audioMuted = Boolean(data.payload && data.payload.muted);
        for (var i = 0; i < muteListeners.length; i++) {
          try {
            muteListeners[i](audioMuted);
          } catch (e) {
            console.error('[GamePortalSDK] Mute listener error:', e);
          }
        }
      }

      // Handle async responses mapped by requestId
      if (data.requestId && pendingCallbacks[data.requestId]) {
        var handler = pendingCallbacks[data.requestId];
        delete pendingCallbacks[data.requestId];
        try {
          handler(data.payload || {});
        } catch (e) {
          console.error('[GamePortalSDK] Callback error:', e);
        }
        return;
      }

      // Handle Ad lifecycle responses
      if (data.type === 'PLATFORM_AD_STARTED' && data.adId && pendingCallbacks[data.adId + '_started']) {
        pendingCallbacks[data.adId + '_started']();
      } else if (data.type === 'PLATFORM_AD_COMPLETED' && data.adId && pendingCallbacks[data.adId + '_completed']) {
        var compCb = pendingCallbacks[data.adId + '_completed'];
        delete pendingCallbacks[data.adId + '_started'];
        delete pendingCallbacks[data.adId + '_completed'];
        delete pendingCallbacks[data.adId + '_failed'];
        compCb();
      } else if (data.type === 'PLATFORM_REWARDED_GRANTED' && data.adId && pendingCallbacks[data.adId + '_rewarded']) {
        var rewCb = pendingCallbacks[data.adId + '_rewarded'];
        delete pendingCallbacks[data.adId + '_started'];
        delete pendingCallbacks[data.adId + '_rewarded'];
        delete pendingCallbacks[data.adId + '_skipped'];
        rewCb();
      } else if (data.type === 'PLATFORM_AD_FAILED' && data.adId && pendingCallbacks[data.adId + '_failed']) {
        var failCb = pendingCallbacks[data.adId + '_failed'];
        delete pendingCallbacks[data.adId + '_started'];
        delete pendingCallbacks[data.adId + '_completed'];
        delete pendingCallbacks[data.adId + '_failed'];
        failCb();
      } else if (data.type === 'PLATFORM_REWARDED_SKIPPED' && data.adId && pendingCallbacks[data.adId + '_skipped']) {
        var skipCb = pendingCallbacks[data.adId + '_skipped'];
        delete pendingCallbacks[data.adId + '_started'];
        delete pendingCallbacks[data.adId + '_rewarded'];
        delete pendingCallbacks[data.adId + '_skipped'];
        skipCb();
      }
    });
  }

  var SDK = {
    version: '1.5.0',

    /**
     * Signals platform that assets have loaded; hides preloader overlay.
     */
    ready: function () {
      if (isReadySent) return;
      isReadySent = true;
      postToParent('SDK_READY', { sdkVersion: SDK.version });
    },

    /**
     * Signals that active gameplay has started (resumes timers/telemetry).
     */
    gameplayStart: function () {
      isPlaying = true;
      postToParent('SDK_GAMEPLAY_START', {});
    },

    /**
     * Signals that gameplay has paused or ended (exits to menu/game over).
     */
    gameplayStop: function () {
      isPlaying = false;
      postToParent('SDK_GAMEPLAY_STOP', {});
    },

    /**
     * Tracks level attempt.
     */
    levelStart: function (level) {
      postToParent('SDK_LEVEL_START', { level: Number(level) || 1 });
    },

    /**
     * Tracks level completion and score.
     */
    levelComplete: function (level, score) {
      postToParent('SDK_LEVEL_COMPLETE', {
        level: Number(level) || 1,
        score: Number(score) || 0
      });
    },

    /**
     * Tracks level failure.
     */
    levelFail: function (level) {
      postToParent('SDK_LEVEL_FAIL', { level: Number(level) || 1 });
    },

    /**
     * Requests and displays an interstitial ad.
     * @param {Object} opts - { onStarted, onCompleted, onFailed }
     */
    showInterstitial: function (opts) {
      opts = opts || {};
      var adId = 'ad_' + Date.now() + '_' + (callbackCounter++);

      if (opts.onStarted) pendingCallbacks[adId + '_started'] = opts.onStarted;
      if (opts.onCompleted) pendingCallbacks[adId + '_completed'] = opts.onCompleted;
      if (opts.onFailed) pendingCallbacks[adId + '_failed'] = opts.onFailed;

      if (!isEmbedded) {
        if (opts.onStarted) setTimeout(opts.onStarted, 100);
        setTimeout(function () {
          if (opts.onCompleted) opts.onCompleted();
        }, 1500);
        return;
      }

      postToParent('SDK_SHOW_INTERSTITIAL', { adId: adId });
    },

    /**
     * Requests and displays a rewarded ad for in-game perks.
     * @param {Object} opts - { onStarted, onRewarded, onSkipped }
     */
    showRewardedAd: function (opts) {
      opts = opts || {};
      var adId = 'rew_' + Date.now() + '_' + (callbackCounter++);

      if (opts.onStarted) pendingCallbacks[adId + '_started'] = opts.onStarted;
      if (opts.onRewarded) pendingCallbacks[adId + '_rewarded'] = opts.onRewarded;
      if (opts.onSkipped) pendingCallbacks[adId + '_skipped'] = opts.onSkipped;

      if (!isEmbedded) {
        if (opts.onStarted) setTimeout(opts.onStarted, 100);
        setTimeout(function () {
          if (opts.onRewarded) opts.onRewarded();
        }, 2000);
        return;
      }

      postToParent('SDK_SHOW_REWARDED_AD', { adId: adId });
    },

    /**
     * Opens platform token purchase modal.
     * @param {string} itemId
     * @param {Function} cb - (success: boolean, receipt: object) => void
     */
    purchaseItem: function (itemId, cb) {
      var reqId = generateReqId();

      if (!isEmbedded) {
        setTimeout(function () {
          localPurchases.push(itemId);
          if (cb) cb(true, { itemId: itemId, transactionId: 'local_tx_' + Date.now() });
        }, 300);
        return;
      }

      if (cb) {
        pendingCallbacks[reqId] = function (res) {
          cb(Boolean(res.success), res.receipt || null);
        };
      }

      postToParent('SDK_PURCHASE_ITEM', { itemId: itemId }, reqId);
    },

    /**
     * Queries unlocked items owned by the active player.
     * @param {Function} cb - (purchases: Array<string>) => void
     */
    getPurchases: function (cb) {
      var reqId = generateReqId();

      if (!isEmbedded) {
        setTimeout(function () {
          if (cb) cb(localPurchases.slice());
        }, 50);
        return;
      }

      if (cb) {
        pendingCallbacks[reqId] = function (res) {
          cb(res.purchases || []);
        };
      }

      postToParent('SDK_GET_PURCHASES', {}, reqId);
    },

    /**
     * Submits score to the global leaderboard.
     * @param {number} score
     */
    trackScore: function (score) {
      currentScore = Number(score) || 0;
      postToParent('SDK_TRACK_SCORE', { score: currentScore });
    },

    /**
     * Dispatches custom analytics event.
     * @param {string} name
     * @param {object} data
     */
    trackEvent: function (name, data) {
      postToParent('SDK_TRACK_EVENT', {
        name: String(name || 'generic_event'),
        data: data || {}
      });
    },

    /**
     * Saves custom progress to user cloud storage.
     * @param {string} key
     * @param {any} data
     */
    saveData: function (key, data) {
      if (!isEmbedded) {
        try {
          localDataStore[key] = data;
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('xandbox_cloud_' + key, JSON.stringify(data));
          }
        } catch (e) {}
        return;
      }

      postToParent('SDK_SAVE_DATA', { key: String(key), data: data });
    },

    /**
     * Loads saved progress from cloud storage.
     * @param {string} key
     * @param {Function} cb - (data: any) => void
     */
    loadData: function (key, cb) {
      var reqId = generateReqId();

      if (!isEmbedded) {
        var result = localDataStore[key];
        if (result === undefined && typeof localStorage !== 'undefined') {
          try {
            var raw = localStorage.getItem('xandbox_cloud_' + key);
            if (raw) result = JSON.parse(raw);
          } catch (e) {}
        }
        setTimeout(function () {
          if (cb) cb(result);
        }, 50);
        return;
      }

      if (cb) {
        pendingCallbacks[reqId] = function (res) {
          cb(res.data);
        };
      }

      postToParent('SDK_LOAD_DATA', { key: String(key) }, reqId);
    },

    /**
     * Triggers platform invite modal to invite friends or party members.
     * @param {Object} opts - { gameId, lobbyId, message }
     * @param {Function} cb - (success: boolean) => void
     */
    invitePlayer: function (opts, cb) {
      opts = opts || {};
      var reqId = generateReqId();

      if (cb) {
        pendingCallbacks[reqId] = function (res) {
          cb(Boolean(res.success));
        };
      }

      postToParent('SDK_INVITE_PLAYER', {
        gameId: opts.gameId || null,
        lobbyId: opts.lobbyId || null,
        message: opts.message || 'Join my game on XandboxGames!'
      }, reqId);
    },

    /**
     * Helper to subscribe to platform audio mute toggles.
     * @param {Function} callback - (isMuted: boolean) => void
     */
    onMuteChange: function (callback) {
      if (typeof callback === 'function') {
        muteListeners.push(callback);
        callback(audioMuted);
      }
    },

    /**
     * Returns true if the game is running inside the XandboxGames iframe.
     */
    isEmbedded: function () {
      return isEmbedded;
    },

    /**
     * Returns the current mute status.
     */
    isMuted: function () {
      return audioMuted;
    }
  };

  // Expose globally under standard and alias names
  global.GamePortalSDK = SDK;
  global.XandboxSDK = SDK;
  global.CrazyGamesSDK = SDK;

})(typeof window !== 'undefined' ? window : this);
