const Audio = {
  ctx: null,
  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
  },
  tone(freq, dur, type, vol) {
    this.init();
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.value = freq;
    g.gain.value = vol || 0.08;
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.ctx.destination);
    o.start(); o.stop(this.ctx.currentTime + dur);
  },
  bomb() { this.tone(180, 0.08, 'square', 0.06); },
  explode() {
    this.tone(80, 0.25, 'sawtooth', 0.12);
    setTimeout(() => this.tone(40, 0.3, 'square', 0.08), 40);
  },
  hit() { this.tone(120, 0.15, 'sawtooth', 0.1); },
  power() { this.tone(520, 0.08, 'sine', 0.07); this.tone(780, 0.1, 'sine', 0.05); },
  click() { this.tone(400, 0.04, 'square', 0.04); },
  win() { this.tone(440, 0.1, 'sine', 0.08); setTimeout(() => this.tone(660, 0.2, 'sine', 0.08), 100); }
};
