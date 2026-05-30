// Звуковая система DUCK'S — всё синтезом через Web Audio API.
// База взята из утверждённого клиентом референса (волшебный пэд C-major-7 + колокольчики)
// и развёрнута в управляемую систему со слоями по секциям.

export class SoundSystem {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.padGain = null;
    this.muted = false;
    this.started = false;
    this.lastBell = 0;
    this.bellNotes = [523.25, 587.33, 659.25, 698.46, 783.99, 880.0, 987.77, 1046.5];
  }

  init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.4;
    this.master.connect(this.ctx.destination);
    this.padGain = this.ctx.createGain();
    this.padGain.gain.value = 0;
    this.padGain.connect(this.master);
  }

  startMusic() {
    if (!this.ctx || this.started) return;
    this.started = true;
    const ctx = this.ctx;

    // Аккорд C-major-7 в высокой октаве — светлый, магический
    const notes = [
      { f: 261.63, g: 0.05 }, { f: 329.63, g: 0.04 }, { f: 392.0, g: 0.035 },
      { f: 493.88, g: 0.025 }, { f: 523.25, g: 0.02 }, { f: 659.25, g: 0.015 },
    ];
    notes.forEach((n, i) => {
      const o1 = ctx.createOscillator(); o1.type = 'sine'; o1.frequency.value = n.f;
      const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = n.f * 1.003;
      const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 0.1 + i * 0.05;
      const lfoG = ctx.createGain(); lfoG.gain.value = n.g * 0.3; lfo.connect(lfoG);
      const ng = ctx.createGain(); ng.gain.value = n.g; lfoG.connect(ng.gain);
      const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = 2000; flt.Q.value = 0.5;
      o1.connect(flt); o2.connect(flt); flt.connect(ng).connect(this.padGain);
      o1.start(); o2.start(); lfo.start();
    });

    // Воздушная дымка — отфильтрованный шум
    const buf = ctx.createBuffer(1, 4 * ctx.sampleRate, ctx.sampleRate);
    const out = buf.getChannelData(0);
    for (let i = 0; i < out.length; i++) out[i] = (Math.random() * 2 - 1) * 0.5;
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 4000; nf.Q.value = 1;
    const ng = ctx.createGain(); ng.gain.value = 0.012;
    noise.connect(nf).connect(ng).connect(this.padGain); noise.start();

    this.padGain.gain.linearRampToValueAtTime(0.7, ctx.currentTime + 4);
    this._breathe();
  }

  _breathe() {
    if (!this.padGain) return;
    const now = this.ctx.currentTime;
    this.padGain.gain.cancelScheduledValues(now);
    this.padGain.gain.setValueAtTime(this.padGain.gain.value, now);
    this.padGain.gain.linearRampToValueAtTime(0.8, now + 6);
    this.padGain.gain.linearRampToValueAtTime(0.55, now + 12);
    setTimeout(() => this._breathe(), 12000);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 0.4, this.ctx.currentTime + 0.3);
    return this.muted;
  }

  // Мягкий шиммер при касании частиц — тёплый, без звонкости.
  // Низкая октава, медленная атака, фильтр сверху, чтобы не «дзинькало».
  playBell(intensity = 1) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - this.lastBell < 0.07) return;
    this.lastBell = now;
    // ноты на октаву ниже и мягче
    const soft = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
    const freq = soft[(Math.random() * soft.length) | 0];
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 1400; lp.Q.value = 0.3;
    lp.connect(this.master);
    // основной мягкий тон + лёгкая квинта, оба синус, плавная атака
    [[1, 0.09, 1.4], [1.5, 0.035, 1.1]].forEach(([mul, g, dec]) => {
      const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq * mul;
      const gn = this.ctx.createGain(); gn.gain.value = 0;
      gn.gain.linearRampToValueAtTime(g * intensity, now + 0.08);
      gn.gain.exponentialRampToValueAtTime(0.0001, now + dec);
      o.connect(gn).connect(lp); o.start(now); o.stop(now + dec + 0.1);
    });
  }

  // Звук формирования объекта из частиц
  playFormation() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      const o = this.ctx.createOscillator(); o.type = 'sine';
      const base = 261.63 * Math.pow(1.5, i);
      o.frequency.value = base * 0.5;
      o.frequency.exponentialRampToValueAtTime(base, now + 1.5 + i * 0.2);
      const g = this.ctx.createGain(); g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.06, now + 0.5 + i * 0.2);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 2.5 + i * 0.2);
      o.connect(g).connect(this.master); o.start(now); o.stop(now + 3);
    }
  }

  // Кряк утки — один чистый, с защитой от наложения (не дёргается)
  playQuack() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - (this._lastQuack || 0) < 0.5) return;
    this._lastQuack = now;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600; lp.connect(this.master);
    [[420, 560], [560, 470]].forEach(([a, b], i) => {
      const t = now + i * 0.16;
      const o = this.ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(a, t); o.frequency.linearRampToValueAtTime(b, t + 0.13);
      const g = this.ctx.createGain(); g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.14, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g).connect(lp); o.start(t); o.stop(t + 0.2);
    });
  }

  // Шелест — мягкий фильтрованный шум при касании частиц мозга
  playRustle(intensity = 1) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - (this._lastRustle || 0) < 0.05) return;
    this._lastRustle = now;
    const dur = 0.25;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const out = buf.getChannelData(0);
    for (let i = 0; i < out.length; i++) out[i] = (Math.random() * 2 - 1) * (1 - i / out.length);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.value = 3500 + Math.random() * 1500; bp.Q.value = 0.8;
    const g = this.ctx.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.06 * intensity, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(bp).connect(g).connect(this.master); src.start(now); src.stop(now + dur);
  }

  // Растворение + «вдох» — при влёте внутрь утки на скролле
  playDissolve() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - (this._lastDissolve || 0) < 1.2) return;
    this._lastDissolve = now;
    // нисходящий тон (растворение)
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(700, now); o.frequency.exponentialRampToValueAtTime(120, now + 1.4);
    const og = this.ctx.createGain(); og.gain.value = 0;
    og.gain.linearRampToValueAtTime(0.08, now + 0.2);
    og.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
    o.connect(og).connect(this.master); o.start(now); o.stop(now + 1.6);
    // «вдох» — нарастающий фильтрованный шум (погружение)
    const dur = 1.6;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const out = buf.getChannelData(0);
    for (let i = 0; i < out.length; i++) out[i] = (Math.random() * 2 - 1);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(300, now); bp.frequency.exponentialRampToValueAtTime(3000, now + 1.2);
    const g = this.ctx.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.05, now + 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(bp).connect(g).connect(this.master); src.start(now); src.stop(now + dur);
  }

  // Глич — для текста (наведение/клик): короткие цифровые щелчки
  playGlitch() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - (this._lastGlitch || 0) < 0.08) return;
    this._lastGlitch = now;
    for (let i = 0; i < 3; i++) {
      const t = now + i * 0.03;
      const o = this.ctx.createOscillator(); o.type = 'square';
      o.frequency.value = 600 + Math.random() * 1800;
      const g = this.ctx.createGain(); g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.04, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
      o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.05);
    }
  }

  // Whoosh открытия/закрытия попапа мозга — мягкий объёмный свуш + аккорд
  playWhoosh(open = true) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const dur = 0.8;
    // фильтрованный шум-свуш
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const out = buf.getChannelData(0);
    for (let i = 0; i < out.length; i++) out[i] = (Math.random() * 2 - 1);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.0;
    const f0 = open ? 400 : 2600, f1 = open ? 2600 : 400;
    bp.frequency.setValueAtTime(f0, now); bp.frequency.exponentialRampToValueAtTime(f1, now + 0.6);
    const g = this.ctx.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.07, now + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(bp).connect(g).connect(this.master); src.start(now); src.stop(now + dur);
    // мягкий аккорд (открытие — вверх, закрытие — вниз)
    const chord = open ? [392.0, 523.25, 659.25] : [659.25, 523.25, 392.0];
    chord.forEach((f, i) => {
      const t = now + i * 0.06;
      const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const og = this.ctx.createGain(); og.gain.value = 0;
      og.gain.linearRampToValueAtTime(0.05, t + 0.04);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
      o.connect(og).connect(this.master); o.start(t); o.stop(t + 0.8);
    });
  }

  // Мягкий UI-отклик при наведении
  playHover() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(800, now); o.frequency.linearRampToValueAtTime(1200, now + 0.1);
    const g = this.ctx.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.05, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    o.connect(g).connect(this.master); o.start(now); o.stop(now + 0.15);
  }

  // Клик — короткий мажорный аккорд
  playClick() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25].forEach((f) => {
      const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = this.ctx.createGain(); g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.08, now + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      o.connect(g).connect(this.master); o.start(now); o.stop(now + 0.25);
    });
  }
}
