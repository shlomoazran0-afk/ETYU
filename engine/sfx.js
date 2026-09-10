// ETYU Engine — סאונד: סינתיסייזר קטן עם WebAudio, בלי קבצי מדיה
export class SFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
  }

  init() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.32;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  tone(freq, endFreq, dur, type = 'square', vol = 0.3, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise(dur = 0.2, vol = 0.4, cutoff = 1000, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  play(name) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'shoot': this.tone(720, 140, 0.08, 'square', 0.15); this.noise(0.05, 0.09, 4200); break;
      case 'hit': this.tone(210, 70, 0.12, 'sawtooth', 0.24); break;
      case 'explode': this.noise(0.5, 0.5, 650); this.tone(110, 35, 0.35, 'sine', 0.42); break;
      case 'jump': this.tone(280, 540, 0.12, 'sine', 0.2); break;
      case 'land': this.noise(0.06, 0.12, 500); break;
      case 'coin': this.tone(920, 920, 0.05, 'square', 0.15); this.tone(1380, 1380, 0.09, 'square', 0.15, 0.05); break;
      case 'gem': this.tone(660, 660, 0.07, 'square', 0.15); this.tone(880, 880, 0.07, 'square', 0.15, 0.07); this.tone(1320, 1320, 0.12, 'square', 0.16, 0.14); break;
      case 'crash': this.noise(0.55, 0.55, 420); this.tone(80, 28, 0.45, 'sine', 0.5); break;
      case 'boost': this.tone(180, 900, 0.28, 'sawtooth', 0.2); break;
      case 'hurt': this.tone(300, 90, 0.18, 'square', 0.28); break;
      case 'ui': this.tone(520, 520, 0.05, 'square', 0.12); break;
      case 'wave': this.tone(220, 440, 0.2, 'sawtooth', 0.18); this.tone(330, 660, 0.2, 'sawtooth', 0.14, 0.1); break;
      case 'shootBall': this.tone(340, 90, 0.09, 'square', 0.13); break;
      case 'break': this.noise(0.22, 0.34, 900); this.tone(180, 60, 0.1, 'sawtooth', 0.18); break;
      case 'win': [523, 659, 784, 1047].forEach((f, i) => this.tone(f, f, 0.16, 'square', 0.16, i * 0.12)); break;
    }
  }
}
