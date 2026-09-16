import { CONFIG } from '../config.js';

// =========================================================
// Storage
// Small wrapper around localStorage with safe fallbacks in
// case storage is unavailable (private browsing, embedded
// iframes on some game portals, etc.) — the game must never
// crash if localStorage throws.
// =========================================================

function safeGet(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

function safeSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    // ignore — storage may be blocked (e.g. inside some game portal iframes)
  }
}

export const Storage = {
  getBestDistance() {
    return parseFloat(safeGet(CONFIG.STORAGE_BEST_DISTANCE, '0')) || 0;
  },
  getBestSpeed() {
    return parseFloat(safeGet(CONFIG.STORAGE_BEST_SPEED, '0')) || 0;
  },
  setBestDistance(v) {
    safeSet(CONFIG.STORAGE_BEST_DISTANCE, String(v));
  },
  setBestSpeed(v) {
    safeSet(CONFIG.STORAGE_BEST_SPEED, String(v));
  },
  getBestLevel() {
    return parseInt(safeGet(CONFIG.STORAGE_BEST_LEVEL, '1'), 10) || 1;
  },
  setBestLevel(v) {
    safeSet(CONFIG.STORAGE_BEST_LEVEL, String(v));
  },
  getSoundOn() {
    return safeGet(CONFIG.STORAGE_SOUND, 'true') === 'true';
  },
  setSoundOn(v) {
    safeSet(CONFIG.STORAGE_SOUND, String(!!v));
  },

  // ---------- Store / garage ----------
  getCoins() {
    const n = parseInt(safeGet(CONFIG.STORAGE_COINS, '0'), 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  },
  setCoins(v) {
    safeSet(CONFIG.STORAGE_COINS, String(Math.max(0, Math.floor(v))));
  },

  // Owned cars are stored as a JSON array of ids. Any parse failure falls
  // back to an empty list rather than throwing — a corrupt save should
  // cost you your garage, not the ability to play.
  getOwnedCarIds() {
    try {
      const raw = safeGet(CONFIG.STORAGE_OWNED_CARS, '[]');
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : [];
    } catch (e) {
      return [];
    }
  },
  setOwnedCarIds(ids) {
    safeSet(CONFIG.STORAGE_OWNED_CARS, JSON.stringify(Array.from(new Set(ids))));
  },

  getSelectedCarId() {
    return safeGet(CONFIG.STORAGE_SELECTED_CAR, '') || '';
  },
  setSelectedCarId(id) {
    safeSet(CONFIG.STORAGE_SELECTED_CAR, String(id));
  },
};
