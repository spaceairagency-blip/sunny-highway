import { Game } from './Game.js';

// =========================================================
// Entry point — boots the game once the DOM is ready.
// =========================================================

window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  // Exposed for debugging/automated smoke tests only — nothing in the
  // game reads it back.
  window.__game = game;
  game.boot();
});
