import { Game } from './Game.js';

// =========================================================
// Entry point — boots the game once the DOM is ready.
// =========================================================

window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  game.boot();
});
