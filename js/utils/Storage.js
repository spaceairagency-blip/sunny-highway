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
  getSoundOn() {
    return safeGet(CONFIG.STORAGE_SOUND, 'true') === 'true';
  },
  setSoundOn(v) {
    safeSet(CONFIG.STORAGE_SOUND, String(!!v));
  },
};
