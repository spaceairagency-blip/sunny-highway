// =========================================================
// OrientationLock
// Makes landscape mode a hard requirement on touch devices.
//
// Two layers, tried in order when the player taps the gate's
// "GO HORIZONTAL" button:
//   1. Native lock — Fullscreen API + Screen Orientation API
//      (screen.orientation.lock('landscape')). Best UX where
//      it's supported (mostly Android Chrome/Firefox), since
//      the OS itself keeps the game landscape even if the
//      player physically rotates the phone back.
//   2. CSS fallback — a well-known rotate-the-DOM trick. This
//      works on every mobile browser (including iOS Safari,
//      which never exposes orientation.lock outside of an
//      installed PWA) by visually rotating #app-shell 90° and
//      swapping its width/height, so the game *looks* and
//      *plays* landscape even while the physical device stays
//      in portrait.
//
// Callers should treat `isPortrait()` as "is the device
// physically portrait" — it stays true even while the CSS
// fallback is active, since a CSS transform never changes
// window.innerWidth/innerHeight. That's why every consumer
// also checks `.forced` before deciding whether to show the
// gate again — see Game.js's _checkOrientationGate().
// =========================================================

const FORCE_CLASS = 'force-landscape';

export class OrientationLock {
  constructor() {
    this.forced = false;
  }

  isPortrait() {
    return window.innerHeight > window.innerWidth;
  }

  // Call this after any resize/orientationchange, before deciding
  // whether the gate needs to (re)appear. If the player genuinely
  // rotated the physical device to landscape, the CSS fallback is
  // no longer needed — drop it so a *later* real rotation back to
  // portrait is detected correctly instead of being masked by a
  // stale forced flag.
  syncWithRealOrientation() {
    if (this.forced && !this.isPortrait()) {
      this._clearCssFallback();
    }
  }

  // Attempt the native lock, then fall back to the CSS trick if
  // we're still visually portrait a moment later (covers browsers
  // with no orientation.lock support, or where the fullscreen/lock
  // request was denied).
  async request() {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => {});
      } else if (document.documentElement.webkitRequestFullscreen) {
        // Older WebKit (some Android WebViews)
        document.documentElement.webkitRequestFullscreen();
      }
    } catch (e) { /* fullscreen denied/unsupported — CSS fallback still works without it */ }

    try {
      if (screen.orientation && screen.orientation.lock) {
        await screen.orientation.lock('landscape').catch(() => {});
      }
    } catch (e) { /* orientation lock unsupported — fall through */ }

    // Give the native attempt a tick to actually change
    // window.innerWidth/innerHeight before we check.
    await new Promise((resolve) => setTimeout(resolve, 60));

    if (this.isPortrait()) {
      this._applyCssFallback();
    }
  }

  _applyCssFallback() {
    document.documentElement.classList.add(FORCE_CLASS);
    this.forced = true;
  }

  _clearCssFallback() {
    document.documentElement.classList.remove(FORCE_CLASS);
    this.forced = false;
  }
}
