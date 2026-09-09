export class Sfx {
  private ctx: AudioContext | null = null;
  muted = false;
  volume = 0.45;
  private musicTimer: number | null = null;
  private musicStep = 0;

  private ac() {
    if (!this.ctx) this.ctx = new AudioContext();
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }

  private env(duration: number, peak = 0.12) {
    const ctx = this.ac();
    const g = ctx.createGain();
    g.connect(ctx.destination);
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(peak * this.volume, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    return { ctx, g, now };
  }

  tone(
    freq: number,
    duration: number,
    type: OscillatorType = "square",
    peak = 0.1,
    slide?: number,
  ) {
    if (this.muted) return;
    const { ctx, g, now } = this.env(duration, peak);
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slide) osc.frequency.exponentialRampToValueAtTime(slide, now + duration);
    osc.connect(g);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  noise(duration: number, peak = 0.08) {
    if (this.muted) return;
    const { ctx, g, now } = this.env(duration, peak);
    const len = Math.floor(ctx.sampleRate * duration);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(1800, now);
    src.connect(f);
    f.connect(g);
    src.start(now);
  }

  jump() {
    this.tone(520, 0.09, "square", 0.07, 280);
  }
  doubleJump() {
    this.tone(640, 0.1, "square", 0.07, 900);
    this.tone(960, 0.08, "triangle", 0.04);
  }
  dash() {
    this.noise(0.12, 0.1);
    this.tone(180, 0.14, "sawtooth", 0.05, 80);
  }
  swing(step: number) {
    this.noise(0.07, 0.06);
    this.tone(320 + step * 90, 0.08, "square", 0.06, 180);
  }
  hit() {
    this.tone(140, 0.09, "square", 0.1, 70);
    this.noise(0.08, 0.09);
  }
  hurt() {
    this.tone(220, 0.16, "sawtooth", 0.1, 90);
  }
  collect() {
    this.tone(880, 0.08, "triangle", 0.07);
    this.tone(1320, 0.12, "triangle", 0.05);
  }
  breakPot() {
    this.noise(0.1, 0.08);
    this.tone(90, 0.1, "square", 0.05);
  }
  death() {
    this.tone(180, 0.35, "sawtooth", 0.1, 40);
  }
  land() {
    this.noise(0.05, 0.04);
  }
  unlock() {
    this.tone(523, 0.12, "triangle", 0.08);
    this.tone(784, 0.16, "triangle", 0.07);
    this.tone(1046, 0.22, "triangle", 0.06);
  }
  bossHit() {
    this.tone(70, 0.2, "sawtooth", 0.12, 40);
    this.noise(0.18, 0.12);
  }
  ui() {
    this.tone(660, 0.05, "square", 0.04);
  }

  startMusic() {
    this.stopMusic();
    const notes = [220, 261, 329, 392, 329, 261, 196, 246];
    const tick = () => {
      if (this.muted) {
        this.musicTimer = window.setTimeout(tick, 420);
        return;
      }
      const n = notes[this.musicStep % notes.length];
      this.tone(n / 2, 0.28, "triangle", 0.025);
      if (this.musicStep % 4 === 0) this.tone(n, 0.18, "sine", 0.02);
      this.musicStep++;
      this.musicTimer = window.setTimeout(tick, 380);
    };
    tick();
  }

  stopMusic() {
    if (this.musicTimer != null) {
      clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

export const sfx = new Sfx();
