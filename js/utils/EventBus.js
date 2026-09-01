// Minimal event bus for decoupled communication between
// game systems (physics, UI, audio) without tight coupling.

export class EventBus {
  constructor() {
    this._listeners = new Map();
  }

  on(event, callback) {
    if (!this._listeners.has(event)) this._listeners.set(event, new Set());
    this._listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    if (this._listeners.has(event)) this._listeners.get(event).delete(callback);
  }

  emit(event, payload) {
    if (!this._listeners.has(event)) return;
    for (const cb of this._listeners.get(event)) {
      try { cb(payload); } catch (e) { console.error(`[EventBus] listener error on "${event}":`, e); }
    }
  }
}

export const bus = new EventBus();
