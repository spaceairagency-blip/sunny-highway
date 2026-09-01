// =========================================================
// InputManager
// Unifies keyboard and touch input into one simple state
// object that the car physics can read each frame.
// =========================================================

export class InputManager {
  constructor() {
    this.state = {
      steerLeft: false,
      steerRight: false,
      accelerate: false,
      brake: false,
      drift: false,
      nitro: false,
      pauseRequested: false,
    };

    this.isTouchDevice = this._detectTouch();
    if (this.isTouchDevice) document.body.classList.add('is-touch');

    this._bindKeyboard();
    this._bindTouch();
  }

  _detectTouch() {
    return ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;
  }

  _bindKeyboard() {
    const keyMap = {
      ArrowLeft: 'steerLeft', KeyA: 'steerLeft',
      ArrowRight: 'steerRight', KeyD: 'steerRight',
      ArrowUp: 'accelerate', KeyW: 'accelerate',
      ArrowDown: 'brake', KeyS: 'brake',
      Space: 'drift',
      KeyN: 'nitro',
    };

    window.addEventListener('keydown', (e) => {
      if (keyMap[e.code]) {
        this.state[keyMap[e.code]] = true;
        if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      }
      if (e.code === 'KeyP' || e.code === 'Escape') {
        this.state.pauseRequested = true;
      }
    }, { passive: false });

    window.addEventListener('keyup', (e) => {
      if (keyMap[e.code]) this.state[keyMap[e.code]] = false;
    });

    // Prevent losing key state when window loses focus (alt-tab, etc.)
    window.addEventListener('blur', () => this._resetMomentary());
  }

  _resetMomentary() {
    this.state.steerLeft = false;
    this.state.steerRight = false;
    this.state.accelerate = false;
    this.state.brake = false;
    this.state.drift = false;
    this.state.nitro = false;
  }

  _bindTouch() {
    const bind = (id, key) => {
      const el = document.getElementById(id);
      if (!el) return;
      const setOn = (e) => { e.preventDefault(); this.state[key] = true; el.classList.add('pressed'); };
      const setOff = (e) => { if (e) e.preventDefault(); this.state[key] = false; el.classList.remove('pressed'); };
      el.addEventListener('touchstart', setOn, { passive: false });
      el.addEventListener('touchend', setOff, { passive: false });
      el.addEventListener('touchcancel', setOff, { passive: false });
      // Also support mouse for desktop testing of touch UI
      el.addEventListener('mousedown', setOn);
      el.addEventListener('mouseup', setOff);
      el.addEventListener('mouseleave', setOff);
    };

    bind('touch-left', 'steerLeft');
    bind('touch-right', 'steerRight');
    bind('touch-gas', 'accelerate');
    bind('touch-brake', 'brake');
    bind('touch-drift', 'drift');
    bind('touch-nos', 'nitro');
  }

  consumePauseRequest() {
    if (this.state.pauseRequested) {
      this.state.pauseRequested = false;
      return true;
    }
    return false;
  }
}
