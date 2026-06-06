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
    // padDuck — приглушение ОСНОВНОЙ музыки (магический пэд) по зонам: в баре/космосе уводим пэд,
    // чтобы зазвучала своя музыка станции (а не один и тот же фон на всём сайте).
    this.padDuck = this.ctx.createGain();
    this.padDuck.gain.value = 1;
    this.padDuck.connect(this.master);
    this.padGain = this.ctx.createGain();
    this.padGain.gain.value = 0;
    this.padGain.connect(this.padDuck);
  }

  // Приглушить основной пэд (level 0..1, 1 = полный). Плавно.
  setPadDuck(level) {
    if (!this.ctx || !this.padDuck) return;
    const v = Math.max(0, Math.min(1, level));
    this.padDuck.gain.cancelScheduledValues(this.ctx.currentTime);
    this.padDuck.gain.linearRampToValueAtTime(v, this.ctx.currentTime + 1.0);
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
    this._buildLayers();
  }

  // Постоянные звуковые слои-атмосферы, громкость каждого меняется по сцене.
  // metel — «метель/воздух» (Hero/клуб), rustle — шелест (частицы), hum — гул (туннель/мозг).
  _buildLayers() {
    const ctx = this.ctx;
    const makeNoise = () => {
      const buf = ctx.createBuffer(1, 4 * ctx.sampleRate, ctx.sampleRate);
      const o = buf.getChannelData(0);
      for (let i = 0; i < o.length; i++) o[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; return src;
    };
    this.layers = {};
    // metel — мягкий воздушный слой (не шипение): узкий bandpass, тихо
    {
      const src = makeNoise();
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 700; f.Q.value = 0.5;
      const f2 = ctx.createBiquadFilter(); f2.type = 'lowpass'; f2.frequency.value = 1400;
      const g = ctx.createGain(); g.gain.value = 0; src.connect(f).connect(f2).connect(g).connect(this.master); src.start();
      this.layers.metel = g;
    }
    // rustle — средний шелест (мягкое шуршание частиц)
    {
      const src = makeNoise(); const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 0.6;
      const g = ctx.createGain(); g.gain.value = 0; src.connect(f).connect(g).connect(this.master); src.start();
      this.layers.rustle = g;
    }
    // hum — низкий гул (полёт в туннеле / нутро мозга)
    {
      const src = makeNoise(); const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 320; f.Q.value = 0.7;
      const g = ctx.createGain(); g.gain.value = 0; src.connect(f).connect(g).connect(this.master); src.start();
      this.layers.hum = g;
    }
    // space — космо-мерцание (воздушный высокий шум) для станции Бильярд (космос)
    {
      const src = makeNoise();
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.6;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1100;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(bp).connect(hp).connect(g).connect(this.master); src.start();
      this.layers.space = g;
    }
    // bar — ТЁПЛЫЙ гомон зала: очень низкий мягкий шум (приглушённые голоса), без «шипа»
    {
      const src = makeNoise();
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 360; lp.Q.value = 0.4;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(lp).connect(g).connect(this.master); src.start();
      this.layers.bar = g;
    }

    // ===== МУЗЫКАЛЬНЫЕ БЭДЫ СТАНЦИЙ (осцилляторы, не шум) =====
    // lounge — тёплый джаз-лаунж аккорд для БАРА (мягкие сины + лёгкое «вибрато» как электропиано)
    {
      const g = ctx.createGain(); g.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1100; lp.Q.value = 0.4;
      lp.connect(g).connect(this.master);
      // Am9-ish тёплый аккорд: A2 C4 E4 G4 B4
      [110.0, 261.63, 329.63, 392.0, 493.88].forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = i === 0 ? 'triangle' : 'sine'; o.frequency.value = f;
        const og = ctx.createGain(); og.gain.value = i === 0 ? 0.5 : 0.26 / (1 + i * 0.2);
        const lfo = ctx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 3 + i * 0.4;
        const lg = ctx.createGain(); lg.gain.value = og.gain.value * 0.12; lfo.connect(lg).connect(og.gain); lfo.start();
        o.connect(og).connect(lp); o.start();
      });
      this.layers.lounge = g;
    }
    // cosmic — инопланетный дрон для БИЛЬЯРДА/космоса (детюн-сэвы + медленная фильтр-волна)
    {
      const g = ctx.createGain(); g.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 600; lp.Q.value = 3;
      lp.connect(g).connect(this.master);
      const fl = ctx.createOscillator(); fl.type = 'sine'; fl.frequency.value = 0.07;
      const flg = ctx.createGain(); flg.gain.value = 380; fl.connect(flg).connect(lp.frequency); fl.start();
      [55.0, 55.0 * 1.005, 82.41, 110.0 * 1.5].forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = i < 2 ? 'sawtooth' : 'sine'; o.frequency.value = f;
        const og = ctx.createGain(); og.gain.value = i < 2 ? 0.22 : 0.12;
        o.connect(og).connect(lp); o.start();
      });
      this.layers.cosmic = g;
    }
  }

  // Плавно выставить громкость слоя (0..1 относительно его потолка)
  setLayer(name, level) {
    if (!this.ctx || !this.layers || !this.layers[name]) return;
    const caps = { metel: 0.022, rustle: 0.05, hum: 0.08, space: 0.05, bar: 0.035, lounge: 0.16, cosmic: 0.13 };
    const g = this.layers[name];
    g.gain.cancelScheduledValues(this.ctx.currentTime);
    g.gain.linearRampToValueAtTime((caps[name] || 0.05) * level, this.ctx.currentTime + 0.8);
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

  // Плавное затухание/возврат громкости (уход со вкладки / возврат) — как у igloo.
  fade(target, time = 0.6) {
    if (!this.ctx || !this.master) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(target, now + time);
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

  // Шелест частиц — ГЛУБОКИЙ, плавный (igloo-стиль). Громкость от объёма движения,
  // тон мягко от направления. Длинная атака/спад, низкий фильтр, без «дзинька».
  playRustle(intensity = 1, pitch = 1) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    if (now - (this._lastRustle || 0) < 0.12) return;   // реже, не трещит
    this._lastRustle = now;
    const dur = 0.9;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const out = buf.getChannelData(0);
    for (let i = 0; i < out.length; i++) out[i] = (Math.random() * 2 - 1);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.value = 700 + 500 * pitch; lp.Q.value = 0.4;   // глубокий, мягкий
    const g = this.ctx.createGain(); g.gain.value = 0;
    const vol = Math.min(0.09, 0.02 + intensity * 0.06);
    g.gain.linearRampToValueAtTime(vol, now + 0.15);             // плавная атака
    g.gain.linearRampToValueAtTime(0.0001, now + dur);
    src.connect(lp).connect(g).connect(this.master); src.start(now); src.stop(now + dur);
    // лёгкий воздушный шиммер сверху для «магии»
    const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 320 + 180 * pitch;
    const og = this.ctx.createGain(); og.gain.value = 0;
    og.gain.linearRampToValueAtTime(vol * 0.25, now + 0.2);
    og.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(og).connect(this.master); o.start(now); o.stop(now + dur);
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

  // Глухой удар (кубик о стол / финальный стук)
  playThump() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(120, now); o.frequency.exponentialRampToValueAtTime(50, now + 0.18);
    const g = this.ctx.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.18, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    o.connect(g).connect(this.master); o.start(now); o.stop(now + 0.22);
  }

  // Бросок кубиков — серия деревянно-костяных стуков по столу
  playDiceRoll() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const hits = 5 + (Math.random() * 3 | 0);
    for (let i = 0; i < hits; i++) {
      const t = now + 0.06 + i * (0.09 + Math.random() * 0.07);
      // короткий шумовой «клак» через bandpass + тон
      const dur = 0.06;
      const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
      const out = buf.getChannelData(0);
      for (let j = 0; j < out.length; j++) out[j] = (Math.random() * 2 - 1) * (1 - j / out.length);
      const src = this.ctx.createBufferSource(); src.buffer = buf;
      const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 800 + Math.random() * 900; bp.Q.value = 1.5;
      const g = this.ctx.createGain(); g.gain.value = 0;
      const vol = 0.12 * (1 - i / hits) + 0.03;
      g.gain.linearRampToValueAtTime(vol, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(bp).connect(g).connect(this.master); src.start(t); src.stop(t + dur + 0.02);
      // низкий «тук» дерева
      const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 140 + Math.random() * 60;
      const og = this.ctx.createGain(); og.gain.value = 0;
      og.gain.linearRampToValueAtTime(vol * 0.7, t + 0.004);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      o.connect(og).connect(this.master); o.start(t); o.stop(t + 0.12);
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

  // Карта: скольжение по сукну (короткий фильтрованный шум-«шшш»)
  playCardSlide() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const dur = 0.22;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const out = buf.getChannelData(0);
    for (let i = 0; i < out.length; i++) out[i] = (Math.random() * 2 - 1) * (1 - i / out.length);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.7;
    const g = this.ctx.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.06, now + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(bp).connect(g).connect(this.master); src.start(now); src.stop(now + dur);
  }

  // Карта: переворот «фрр» (быстрый щелчок воздуха)
  playCardFlip() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const dur = 0.12;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const out = buf.getChannelData(0);
    for (let i = 0; i < out.length; i++) out[i] = (Math.random() * 2 - 1);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
    bp.frequency.setValueAtTime(1200, now); bp.frequency.exponentialRampToValueAtTime(3200, now + dur);
    const g = this.ctx.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.07, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(bp).connect(g).connect(this.master); src.start(now); src.stop(now + dur);
  }

  // Карта: приземление на стол «тук» (короткий мягкий низ)
  playCardPlace() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(200, now); o.frequency.exponentialRampToValueAtTime(90, now + 0.1);
    const g = this.ctx.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.1, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.13);
    o.connect(g).connect(this.master); o.start(now); o.stop(now + 0.15);
  }

  // Успех отправки анкеты — короткий восходящий мажорный арпеджио
  playSuccess() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const t = now + i * 0.09;
      const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = this.ctx.createGain(); g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.08, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.55);
    });
  }

  // Дартс: свист броска (короткий нисходящий фильтр-шум)
  playDartThrow() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime, dur = 0.35;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const out = buf.getChannelData(0);
    for (let i = 0; i < out.length; i++) out[i] = (Math.random() * 2 - 1) * (1 - i / out.length);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(3200, now); bp.frequency.exponentialRampToValueAtTime(900, now + dur);
    const g = this.ctx.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.05, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(bp).connect(g).connect(this.master); src.start(now); src.stop(now + dur);
  }

  // Дартс: втык. zone: 'wood' (тук), 'wire' (дзынь в проволоку), 'bull' (фанфара в яблочко)
  playDartHit(zone = 'wood') {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    // «тук» — короткий низ (есть всегда)
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(zone === 'wire' ? 320 : 170, now);
    o.frequency.exponentialRampToValueAtTime(zone === 'wire' ? 180 : 70, now + 0.12);
    const g = this.ctx.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.11, now + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    o.connect(g).connect(this.master); o.start(now); o.stop(now + 0.18);
    if (zone === 'wire') {
      // металлический дзынь проволоки
      const m = this.ctx.createOscillator(); m.type = 'triangle'; m.frequency.value = 2300;
      const mg = this.ctx.createGain(); mg.gain.value = 0;
      mg.gain.linearRampToValueAtTime(0.05, now + 0.005);
      mg.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
      m.connect(mg).connect(this.master); m.start(now); m.stop(now + 0.42);
    }
    if (zone === 'bull') {
      // фанфарный аккорд в яблочко
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        const tt = now + i * 0.07;
        const oo = this.ctx.createOscillator(); oo.type = 'sine'; oo.frequency.value = f;
        const og = this.ctx.createGain(); og.gain.value = 0;
        og.gain.linearRampToValueAtTime(0.07, tt + 0.02);
        og.gain.exponentialRampToValueAtTime(0.0001, tt + 0.55);
        oo.connect(og).connect(this.master); oo.start(tt); oo.stop(tt + 0.6);
      });
    }
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

  // ===== ФИШКИ (реалистичный «клэй»-чип: короткий клик/клак с телом и ноготковым тиком) =====
  _chipClack(now, { body = 260, bright = 2400, vol = 0.12, tick = 0.05 } = {}) {
    // глухое «тело» чипа
    const o = this.ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(body, now); o.frequency.exponentialRampToValueAtTime(body * 0.55, now + 0.06);
    const g = this.ctx.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(vol, now + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);
    o.connect(g).connect(this.master); o.start(now); o.stop(now + 0.11);
    // короткий «тик» удара (шум через highpass)
    const dur = 0.03, buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const out = buf.getChannelData(0); for (let i = 0; i < out.length; i++) out[i] = (Math.random() * 2 - 1) * (1 - i / out.length);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = bright;
    const tg = this.ctx.createGain(); tg.gain.value = tick;
    src.connect(hp).connect(tg).connect(this.master); src.start(now); src.stop(now + dur);
  }
  // Поднятие фишки со стола — тихий клик + лёгкий «дзинь» пластика
  playChipLift() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    this._chipClack(now, { body: 300, bright: 2600, vol: 0.08, tick: 0.04 });
    const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = 1750;
    const g = this.ctx.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.03, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    o.connect(g).connect(this.master); o.start(now); o.stop(now + 0.2);
  }
  // Переворот фишки в воздухе — короткий воздушный «фрр» + клик
  playChipFlip() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime, dur = 0.14;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const out = buf.getChannelData(0); for (let i = 0; i < out.length; i++) out[i] = (Math.random() * 2 - 1);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 0.9;
    bp.frequency.setValueAtTime(1100, now); bp.frequency.exponentialRampToValueAtTime(2800, now + dur);
    const g = this.ctx.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.05, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(bp).connect(g).connect(this.master); src.start(now); src.stop(now + dur);
    this._chipClack(now + dur * 0.7, { body: 320, bright: 3000, vol: 0.06, tick: 0.035 });
  }
  // Опускание фишки обратно на сукно — мягкий «клак» по фетру (с парой призвуков стопки)
  playChipPlace() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    this._chipClack(now, { body: 220, bright: 2200, vol: 0.13, tick: 0.05 });
    this._chipClack(now + 0.035, { body: 300, bright: 2600, vol: 0.05, tick: 0.03 });   // призвук стопки
  }

  // ===== БАР =====
  // Стеклянный «дзынь» по бокалу — яркие высокие партиалы + крошечный тик
  playGlassClink() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    [2540, 3760, 5200].forEach((f, i) => {
      const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * (1 + (Math.random() - 0.5) * 0.01);
      const g = this.ctx.createGain(); g.gain.value = 0;
      const peak = [0.06, 0.035, 0.02][i];
      g.gain.linearRampToValueAtTime(peak, now + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5 - i * 0.1);
      o.connect(g).connect(this.master); o.start(now); o.stop(now + 0.55);
    });
    // короткий тик-«касание стекла»
    const dur = 0.04, buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const out = buf.getChannelData(0); for (let i = 0; i < out.length; i++) out[i] = (Math.random() * 2 - 1) * (1 - i / out.length);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4000;
    const g = this.ctx.createGain(); g.gain.value = 0.05;
    src.connect(hp).connect(g).connect(this.master); src.start(now); src.stop(now + dur);
  }

  // Глоток-«глюк»: пара низких булькающих импульсов (проглатывание)
  playGulp() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    [0, 0.13].forEach((dt, i) => {
      const t = now + dt;
      const o = this.ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(160 - i * 24, t); o.frequency.exponentialRampToValueAtTime(85 - i * 12, t + 0.12);
      const g = this.ctx.createGain(); g.gain.value = 0;
      g.gain.linearRampToValueAtTime(0.09, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.2);
    });
  }

  // Довольный «ах»/выдох после глотка — шум через формантные полосы с нисходящим тоном
  playSip() {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime, dur = 0.5;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const out = buf.getChannelData(0); for (let i = 0; i < out.length; i++) out[i] = (Math.random() * 2 - 1);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    // две форманты «а» (~720 и ~1100 Гц), мягко падают → выдох
    const mk = (f0, f1, q, gain) => {
      const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = q;
      bp.frequency.setValueAtTime(f0, now); bp.frequency.exponentialRampToValueAtTime(f1, now + dur);
      const g = this.ctx.createGain(); g.gain.value = 0;
      g.gain.linearRampToValueAtTime(gain, now + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
      src.connect(bp).connect(g).connect(this.master);
    };
    mk(760, 540, 4, 0.05); mk(1150, 820, 6, 0.03);
    src.start(now); src.stop(now + dur);
  }

  // Налив в бокал — отфильтрованный шум с поднимающимся фильтром (бокал наполняется) + бульканье
  playPour(dur = 1.1) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const out = buf.getChannelData(0); for (let i = 0; i < out.length; i++) out[i] = (Math.random() * 2 - 1);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.1;
    bp.frequency.setValueAtTime(900, now); bp.frequency.exponentialRampToValueAtTime(2400, now + dur);   // тон растёт по мере наполнения
    const g = this.ctx.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.06, now + 0.12);
    g.gain.setValueAtTime(0.06, now + dur - 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(bp).connect(g).connect(this.master); src.start(now); src.stop(now + dur);
    // бульки-«глюки» наливающейся жидкости
    const n = Math.floor(dur / 0.13);
    for (let i = 0; i < n; i++) {
      const t = now + 0.1 + i * 0.12;
      const o = this.ctx.createOscillator(); o.type = 'sine';
      const f = 220 + Math.random() * 180 + i * 18;
      o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.08);
      const og = this.ctx.createGain(); og.gain.value = 0;
      og.gain.linearRampToValueAtTime(0.035, t + 0.01);
      og.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      o.connect(og).connect(this.master); o.start(t); o.stop(t + 0.12);
    }
  }

  // Кинематографический звук СМЕНЫ станции. idx — индекс целевой станции (0..5),
  // forward — вперёд (приближение, восходящий) или назад (отдаление, нисходящий).
  // Базовый свуш + акцент под тему станции (космос — воздушный аккорд, бар — тёплый аккорд + стекло).
  playStationCue(idx, forward) {
    if (!this.ctx || this.muted) return;
    this.playWhoosh(!!forward);
    const now = this.ctx.currentTime;
    const chord = (freqs, vol, dur, t0 = 0) => freqs.forEach((f, i) => {
      const t = now + t0 + i * 0.06;
      const o = this.ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = this.ctx.createGain(); g.gain.value = 0;
      g.gain.linearRampToValueAtTime(vol, t + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.05);
    });
    if (idx === 5) {            // ВОШЛИ В БАР — тёплый мажорный аккорд + звон стекла
      chord([392.0, 523.25, 659.25], 0.05, 1.0);
      this.playGlassClink();
    } else if (idx === 4) {     // КОСМОС / Бильярд — высокий воздушный аккорд
      chord([784.0, 1046.5, 1318.5], 0.03, 1.3);
    } else if (idx === 3) {     // ДАРТС — короткий сфокусированный «дзынь»
      chord([659.25, 988.0], 0.035, 0.7);
    } else if (idx === 2) {     // ПОКЕР — мягкий аккорд
      chord([440.0, 587.33], 0.035, 0.8);
    }
  }

  // Игристая «шипучка» — мягкий высокочастотный шум (пузырьки шампанского)
  playFizz(dur = 1.4) {
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const out = buf.getChannelData(0);
    for (let i = 0; i < out.length; i++) out[i] = (Math.random() * 2 - 1) * (Math.random() < 0.5 ? 1 : 0);   // прерывистые щелчки-пузырьки
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 5200;
    const g = this.ctx.createGain(); g.gain.value = 0;
    g.gain.linearRampToValueAtTime(0.03, now + 0.15);
    g.gain.linearRampToValueAtTime(0.018, now + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(hp).connect(g).connect(this.master); src.start(now); src.stop(now + dur);
  }
}
