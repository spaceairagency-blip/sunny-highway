// =========================================================
// AudioManager
// All sound is synthesized procedurally with the Web Audio
// API — no external audio files needed, keeping the package
// small and load times fast (important for CrazyGames).
// =========================================================

export class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.engineOsc = null;
    this.engineGain = null;
    this.windGain = null;
    this._started = false;
  }

  _ensureContext() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setEnabled(on) {
    this.enabled = on;
    // Don't snap gain straight to 1 — that's several times louder than the
    // engine's normal operating volume (~0.045–0.13) and is what caused the
    // loud blast on unmute. Let updateEngine's own gain math take over on
    // the next frame; here we only need to silence immediately on mute.
    if (!on) {
      if (this.engineGain) this.engineGain.gain.value = 0;
      if (this.windGain) this.windGain.gain.value = 0;
    }
  }

  startEngine() {
    this._ensureContext();
    if (this._started) return;
    this._started = true;

    const ctx = this.ctx;

    // Engine hum: two gently-detuned triangle oscillators (much softer
    // harmonic content than sawtooth) through a lowpass filter, plus a
    // shallow sub-oscillator to add body without adding buzz.
    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.value = 50;
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = 50.35; // gentler detune (was ~0.8% — now ~0.7%, and triangle beats less harshly than sawtooth)

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 25;
    const subGain = ctx.createGain();
    subGain.gain.value = 0.5;

    // Tighter, lower lowpass cutoff so the tone stays warm/rounded
    // instead of buzzy, even as it opens up at speed.
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 220;
    filter.Q.value = 0.3;

    const gain = ctx.createGain();
    // Lower resting volume — the old engine sat too loud in the mix.
    gain.gain.value = this.enabled ? 0.055 : 0;

    osc1.connect(filter);
    osc2.connect(filter);
    sub.connect(subGain);
    subGain.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();
    sub.start();

    this.engineOsc = osc1;
    this.engineOsc2 = osc2;
    this.engineSub = sub;
    this.engineFilter = filter;
    this.engineGain = gain;

    // Wind/road noise: filtered white noise, volume scales with speed.
    // Higher highpass cutoff + lower ceiling gain keeps this a soft hiss
    // in the background instead of a competing layer of noise.
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1400;
    const windGain = ctx.createGain();
    windGain.gain.value = 0;
    noise.connect(noiseFilter);
    noiseFilter.connect(windGain);
    windGain.connect(ctx.destination);
    noise.start();
    this.windGain = windGain;
  }

  updateEngine(speedRatio, isNitro) {
    if (!this.engineOsc) return;
    // Softer curve: sqrt response means the pitch/volume climb fast off
    // idle then flatten out, instead of climbing linearly all the way to
    // a shrill peak at max speed.
    const curved = Math.sqrt(Math.max(0, Math.min(1, speedRatio)));
    const baseFreq = 48 + curved * 110; // was 55 + ratio*220 — roughly halved top-end pitch
    this.engineOsc.frequency.value = baseFreq;
    this.engineOsc2.frequency.value = baseFreq * 1.007;
    if (this.engineSub) this.engineSub.frequency.value = baseFreq * 0.5;
    this.engineFilter.frequency.value = 180 + curved * 620; // was 300 + ratio*1800 — much less top-end buzz
    if (this.engineGain) this.engineGain.gain.value = this.enabled ? (0.045 + curved * 0.045 + (isNitro ? 0.035 : 0)) : 0;
    if (this.windGain) this.windGain.gain.value = this.enabled ? curved * 0.035 : 0;
  }

  _playTone(freq, duration, type = 'sine', volume = 0.2, freqEnd = null) {
    if (!this.enabled) return;
    this._ensureContext();
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (freqEnd !== null) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), ctx.currentTime + duration);
    }
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  playPickup() {
    this._playTone(660, 0.12, 'square', 0.15, 1200);
    setTimeout(() => this._playTone(880, 0.1, 'square', 0.12, 1400), 60);
  }

  playCrash() {
    if (!this.enabled) return;
    this._ensureContext();
    const ctx = this.ctx;
    const bufferSize = ctx.sampleRate * 0.4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
    this._playTone(90, 0.35, 'sawtooth', 0.25, 30);
  }

  playUIClick() {
    this._playTone(440, 0.06, 'square', 0.1, 660);
  }

  playLevelUp() {
    // Rising three-note arpeggio — a quick, satisfying "milestone" chime.
    this._playTone(523, 0.14, 'triangle', 0.16, 620);
    setTimeout(() => this._playTone(659, 0.14, 'triangle', 0.16, 760), 90);
    setTimeout(() => this._playTone(880, 0.22, 'triangle', 0.18, 1040), 180);
  }

  playCountdownBeep(isFinal = false) {
    this._playTone(isFinal ? 880 : 520, isFinal ? 0.25 : 0.12, 'square', 0.18);
  }

  stopEngine() {
    if (this.engineGain) this.engineGain.gain.value = 0;
    if (this.windGain) this.windGain.gain.value = 0;
  }

  /**
   * Softly duck the engine/wind mix, e.g. while an ad is showing so the
   * game's audio doesn't clash with the ad's own sound.
   */
  duckEngine(on) {
    this._ducked = on;
    if (on) {
      if (this.engineGain) this.engineGain.gain.value = 0;
    }
    // On un-duck, don't restore a raw stored value — let updateEngine's
    // normal per-frame gain calculation (0.045-0.13 range) take back over,
    // same fix as setEnabled above.
  }
}
