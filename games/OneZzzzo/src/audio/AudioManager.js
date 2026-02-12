/**
 * AudioManager — Procedural audio system using Web Audio API.
 * No external audio files needed. All sounds are synthesized.
 */
export class AudioManager {
  constructor(eventBus) {
    this.eventBus = eventBus;
    this._ctx = null;
    this._masterGain = null;
    this._ambientNodes = [];
    this._muted = false;

    this._bindEvents();
  }

  /** Lazily create AudioContext on first user interaction */
  _ensureContext() {
    if (this._ctx) return this._ctx;
    try {
      this._ctx = new AudioContext();
      this._masterGain = this._ctx.createGain();
      this._masterGain.gain.value = 0.5;
      this._masterGain.connect(this._ctx.destination);
    } catch (e) {
      // Audio not available
    }
    return this._ctx;
  }

  _bindEvents() {
    this.eventBus.on('puzzle:activated', () => this._playActivate());
    this.eventBus.on('puzzle:solved', () => this._playSolved());
    this.eventBus.on('game:complete', () => this._playGameComplete());
    this.eventBus.on('level:transition', () => this._playTransition());
    this.eventBus.on('notification', () => this._playNotification());
  }

  /**
   * Start ambient sound for a level based on environment type.
   * @param {'outdoor'|'indoor'|'cave'|'water'} type
   */
  startAmbient(type) {
    this.stopAmbient();
    const ctx = this._ensureContext();
    if (!ctx) return;

    switch (type) {
      case 'outdoor': this._ambientWind(); break;
      case 'water':
      case 'beach': this._ambientOcean(); break;
      case 'cave':
      case 'indoor': this._ambientCave(); break;
      default: this._ambientWind(); break;
    }
  }

  stopAmbient() {
    for (const node of this._ambientNodes) {
      try { node.stop(); } catch (e) { /* already stopped */ }
    }
    this._ambientNodes.length = 0;
  }

  setMuted(muted) {
    this._muted = muted;
    if (this._masterGain) {
      this._masterGain.gain.value = muted ? 0 : 0.5;
    }
  }

  // ─── Ambient generators ─────────────────────────────────

  _ambientWind() {
    const ctx = this._ctx;
    const bufferSize = ctx.sampleRate * 4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.15;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400;

    const gain = ctx.createGain();
    gain.gain.value = 0.3;

    source.connect(filter).connect(gain).connect(this._masterGain);
    source.start();
    this._ambientNodes.push(source);
  }

  _ambientOcean() {
    const ctx = this._ctx;
    const bufferSize = ctx.sampleRate * 6;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const t = i / ctx.sampleRate;
      const wave = Math.sin(t * 0.3) * 0.5 + Math.sin(t * 0.7) * 0.3;
      data[i] = (Math.random() * 2 - 1) * 0.1 * (0.5 + wave * 0.5);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;

    const gain = ctx.createGain();
    gain.gain.value = 0.4;

    source.connect(filter).connect(gain).connect(this._masterGain);
    source.start();
    this._ambientNodes.push(source);
  }

  _ambientCave() {
    const ctx = this._ctx;
    // Low hum
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 55;
    const gain = ctx.createGain();
    gain.gain.value = 0.08;
    osc.connect(gain).connect(this._masterGain);
    osc.start();
    this._ambientNodes.push(osc);

    // Drip effect — periodic filtered noise bursts
    const dripLoop = () => {
      if (!this._ctx || this._ambientNodes.length === 0) return;
      this._playDrip();
      const next = 2000 + Math.random() * 5000;
      this._dripTimeout = setTimeout(dripLoop, next);
    };
    this._dripTimeout = setTimeout(dripLoop, 1000 + Math.random() * 3000);
  }

  _playDrip() {
    const ctx = this._ctx;
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.06);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain).connect(this._masterGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  // ─── SFX ────────────────────────────────────────────────

  _playActivate() {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, now);
    osc.frequency.exponentialRampToValueAtTime(660, now + 0.15);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    osc.connect(gain).connect(this._masterGain);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  _playSolved() {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Rising major arpeggio
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      const t = now + i * 0.12;
      osc.frequency.setValueAtTime(freq, t);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);

      osc.connect(gain).connect(this._masterGain);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  }

  _playGameComplete() {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Fanfare: two ascending chords
    const chords = [
      { time: 0, freqs: [523, 659, 784] },       // C major
      { time: 0.4, freqs: [587, 740, 880] },      // D major
      { time: 0.8, freqs: [659, 831, 988, 1319] }, // E major + high
    ];

    for (const chord of chords) {
      for (const freq of chord.freqs) {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        const t = now + chord.time;
        osc.frequency.setValueAtTime(freq, t);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.15, t + 0.05);
        gain.gain.setValueAtTime(0.15, t + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.8);

        osc.connect(gain).connect(this._masterGain);
        osc.start(t);
        osc.stop(t + 0.8);
      }
    }
  }

  _playTransition() {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Whoosh — filtered noise sweep
    const bufferSize = ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(200, now);
    filter.frequency.exponentialRampToValueAtTime(2000, now + 0.4);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.8);
    filter.Q.value = 2;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);

    source.connect(filter).connect(gain).connect(this._masterGain);
    source.start(now);
    source.stop(now + 0.8);
  }

  _playNotification() {
    const ctx = this._ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(1100, now + 0.06);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    osc.connect(gain).connect(this._masterGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  dispose() {
    this.stopAmbient();
    if (this._dripTimeout) clearTimeout(this._dripTimeout);
    if (this._ctx) {
      this._ctx.close();
      this._ctx = null;
    }
  }
}
