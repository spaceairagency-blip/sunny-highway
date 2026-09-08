import { LEVELS, LEVELS_TOTAL_DISTANCE, CONFIG } from '../config.js';

// =========================================================
// LevelManager
// Pure bookkeeping: given how far the car has travelled this
// run, works out which of the 50 milestone levels it's on,
// how close it is to the next goal, and reports the instant a
// new level is entered (so Game.js can trigger the theme
// cross-fade, toast, sound, and score bonus).
//
// Past level 50 the run keeps going "endless" — it keeps
// cycling through the same 50 level definitions every extra
// LEVELS_TOTAL_DISTANCE meters, so the world keeps changing
// instead of freezing on the final theme forever.
// =========================================================

export class LevelManager {
  constructor() {
    this.reset();
  }

  reset() {
    this.levelIndex = 0; // 0-based index into LEVELS
    this.lap = 0;        // how many full 50-level cycles completed (endless mode)
    this.currentLevel = LEVELS[0];
  }

  // Returns level/progress info, including didLevelUp for this call.
  update(distanceTravelled) {
    const lap = Math.floor(distanceTravelled / LEVELS_TOTAL_DISTANCE);
    const distanceInLap = distanceTravelled - lap * LEVELS_TOTAL_DISTANCE;

    let idx = this.levelIndex;
    while (idx < LEVELS.length - 1 && distanceInLap >= LEVELS[idx].rangeEnd) {
      idx++;
    }

    const didLevelUp = idx !== this.levelIndex || lap !== this.lap;
    this.levelIndex = idx;
    this.lap = lap;
    this.currentLevel = LEVELS[idx];

    const level = this.currentLevel;
    const distanceIntoLevel = Math.max(0, distanceInLap - level.rangeStart);
    const progress0to1 = Math.min(1, distanceIntoLevel / level.goal);

    return {
      levelNumber: level.number + lap * LEVELS.length,
      displayNumber: level.number,
      lap,
      theme: level.theme,
      livery: level.livery,
      goal: level.goal,
      distanceIntoLevel,
      progress0to1,
      didLevelUp,
    };
  }
}

export const TOTAL_LEVELS = CONFIG.LEVEL_COUNT;
