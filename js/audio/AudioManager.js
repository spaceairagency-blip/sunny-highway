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
    if (this.engineGain) this.engineGain.gain.value = on ? 1 : 0;
    if (this.windGain) this.windGain.gain.value = on ? 1 : 0;
  }

  startEngine() {
    this._ensureContext();
    if (this._started) return;
    this._started = true;

    const ctx = this.ctx;

    // Engine hum: two detuned sawtooths through a lowpass filter
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 60;
    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = 60.5;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    const gain = ctx.createGain();
    gain.gain.value = this.enabled ? 0.12 : 0;

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();

    this.engineOsc = osc1;
    this.engineOsc2 = osc2;
    this.engineFilter = filter;
    this.engineGain = gain;

    // Wind/road noise: filtered white noise, volume scales with speed
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 800;
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
    const baseFreq = 55 + speedRatio * 220;
    this.engineOsc.frequency.value = baseFreq;
    this.engineOsc2.frequency.value = baseFreq * 1.008;
    this.engineFilter.frequency.value = 300 + speedRatio * 1800;
    if (this.engineGain) this.engineGain.gain.value = this.enabled ? (0.08 + speedRatio * 0.1 + (isNitro ? 0.08 : 0)) : 0;
    if (this.windGain) this.windGain.gain.value = this.enabled ? speedRatio * 0.06 : 0;
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
}
