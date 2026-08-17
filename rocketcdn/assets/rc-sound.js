/* ═══════════════════════════════════════════════════════════
   Rocket CDN · звук фильма

   Ни одного звукового файла: всё собирается прямо в браузере из
   осцилляторов и шума. Гул двигателя, свист набегающего потока,
   эфир радиосвязи и щелчки приборов. Громкость и тембр идут за
   скоростью прокрутки и за актом, в котором сейчас человек.

   Правила приличия соблюдаем: без жеста ничего не звучит, тихо,
   вводится плавно, выключается одним нажатием и запоминается.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

var KEY = "rcdn.sound";
var HINT = "rcdn.soundHintSeen";
var REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Сколько двигателя слышно в каждом акте фильма. Единица - ракета
   идёт прямо перед человеком, ноль - её здесь просто нет. Ключи
   совпадают с актами из rc-scene.js: одна сцена, один словарь. */
var FLIGHT = {
  pad: 0.14, ignite: 1.00, climb: 0.92, clouds: 0.78, corridor: 0.34,
  advance: 0.46, orbit: 0.55, reentry: 0.88, route: 0.20, landing: 0.62,
  walk: 0.10, cabin: 0.06, manual: 0.05, console: 0.05
};

function Sound() {
  this.on = false;
  this.ready = false;
  this.level = 0;        /* текущая громкость гула */
  this.want = 0;         /* к чему стремимся */
  this.vel = 0;          /* скорость прокрутки, сглаженная */
  this.p = 0;            /* положение на странице */
  this.fly = 0;          /* насколько ракета сейчас в кадре */
  this.ctx = null;
}

Sound.prototype.build = function () {
  var C = g.AudioContext || g.webkitAudioContext;
  if (!C) return false;
  var ctx = new C();
  this.ctx = ctx;

  var master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  this.master = master;

  /* Анализатор нужен полоскам на кнопке */
  var an = ctx.createAnalyser();
  an.fftSize = 64;
  an.smoothingTimeConstant = 0.75;
  master.connect(an);
  this.an = an;
  this.bins = new Uint8Array(an.frequencyBinCount);

  /* ── Двигатель: две низкие волны через фильтр ── */
  var eg = ctx.createGain();
  eg.gain.value = 0.5;
  var lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 190;
  lp.Q.value = 0.9;
  eg.connect(lp);
  lp.connect(master);

  var o1 = ctx.createOscillator();
  o1.type = "sawtooth";
  o1.frequency.value = 41;
  var o2 = ctx.createOscillator();
  o2.type = "sine";
  o2.frequency.value = 82;
  var g1 = ctx.createGain(); g1.gain.value = 0.42;
  var g2 = ctx.createGain(); g2.gain.value = 0.30;
  o1.connect(g1); g1.connect(eg);
  o2.connect(g2); g2.connect(eg);
  o1.start(); o2.start();
  this.o1 = o1; this.o2 = o2; this.lp = lp; this.eg = eg;

  /* ── Поток: шум через полосовой фильтр ── */
  var len = ctx.sampleRate * 2;
  var buf = ctx.createBuffer(1, len, ctx.sampleRate);
  var d = buf.getChannelData(0);
  for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  var src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  var bp = ctx.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 700;
  bp.Q.value = 0.7;
  var ng = ctx.createGain();
  ng.gain.value = 0.0;
  src.connect(bp); bp.connect(ng); ng.connect(master);
  src.start();
  this.bp = bp; this.ng = ng;

  this.ready = true;
  return true;
};

/* Короткий звук события: щелчок, сигнал, подтверждение */
Sound.prototype.blip = function (freq, dur, type, vol) {
  if (!this.on || !this.ready) return;
  var ctx = this.ctx, t = ctx.currentTime;
  var o = ctx.createOscillator();
  var gn = ctx.createGain();
  o.type = type || "triangle";
  o.frequency.setValueAtTime(freq, t);
  gn.gain.setValueAtTime(0, t);
  gn.gain.linearRampToValueAtTime(vol == null ? 0.05 : vol, t + 0.008);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.12));
  o.connect(gn); gn.connect(this.master);
  o.start(t);
  o.stop(t + (dur || 0.12) + 0.02);
};

/* Двухнотный сигнал: отправка заявки, важное событие */
Sound.prototype.chime = function () {
  this.blip(660, 0.16, "sine", 0.06);
  var self = this;
  setTimeout(function () { self.blip(990, 0.22, "sine", 0.05); }, 120);
};

Sound.prototype.start = function () {
  var self = this;
  if (!this.ready && !this.build()) return;
  function up() {
    self.fadeIn();
    self.space();
    /* Маяки сети идут сами по себе, раз в шесть-двадцать секунд */
    if (!self._bTimer) {
      self._bTimer = setInterval(function () {
        if (self.on && !document.hidden && Math.random() < 0.5) self.beacon();
      }, 7000);
    }
  }
  var r = this.ctx.resume();
  if (r && r.then) {
    r.then(up).catch(function () { self.hint(); });
  } else {
    up();
  }
};

Sound.prototype.fadeIn = function () {
  if (this.ctx.state !== "running") { this.hint(); return; }
  this.on = true;
  document.documentElement.classList.add("snd-on");
  var t = this.ctx.currentTime;
  this.master.gain.cancelScheduledValues(t);
  this.master.gain.setValueAtTime(this.master.gain.value, t);
  /* Под музыкой синтезированный слой уходит на второй план: две
     полноценные фонограммы разом - это каша, а заказчик просил
     фон, который не давит. */
  this.master.gain.linearRampToValueAtTime(this.music() ? 0.085 : 0.16, t + 1.8);
  this.loop();
  try { localStorage.setItem(KEY, "on"); } catch (e) {}
  if (g.RC_MUSIC) { try { g.RC_MUSIC.on(); } catch (e) {} }
  if (g.RC_track) g.RC_track("sound", "on");
};

/* Играет ли музыкальная тема: от этого зависит весь баланс ниже */
Sound.prototype.music = function () {
  return !!(g.RC_MUSIC && g.RC_MUSIC.playing && g.RC_MUSIC.playing());
};

Sound.prototype.stop = function () {
  this.on = false;
  document.documentElement.classList.remove("snd-on");
  if (g.RC_MUSIC) { try { g.RC_MUSIC.off(); } catch (e) {} }
  if (!this.ready) return;
  var t = this.ctx.currentTime;
  this.master.gain.cancelScheduledValues(t);
  this.master.gain.setValueAtTime(this.master.gain.value, t);
  this.master.gain.linearRampToValueAtTime(0, t + 0.5);
  try { localStorage.setItem(KEY, "off"); } catch (e) {}
  if (g.RC_track) g.RC_track("sound", "off");
};

Sound.prototype.toggle = function () {
  if (this.on) this.stop(); else this.start();
};

/* Подсказка показывается один раз в жизни */
Sound.prototype.hint = function () {
  try { if (localStorage.getItem(HINT)) return; } catch (e) {}
  var el = document.querySelector(".snd-hint");
  if (!el) return;
  el.classList.add("on");
  setTimeout(function () { el.classList.remove("on"); }, 4200);
  try { localStorage.setItem(HINT, "1"); } catch (e) {}
};

/* Партитура: тембр идёт за прокруткой и за скоростью */
Sound.prototype.loop = function () {
  var self = this;
  if (this._raf) cancelAnimationFrame(this._raf);
  function step() {
    if (!self.on) return;
    self._raf = requestAnimationFrame(step);
    self._n = (self._n || 0) + 1;
    if (self._n % 4) return;              /* пятнадцать раз в секунду хватает */
    /* В полёте партитуру ведёт сам корабль через flightLevel */
    if (self._flight) return;

    var max = document.documentElement.scrollHeight - innerHeight;
    var y = g.scrollY || 0;
    var p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
    var dv = Math.abs(y - (self._lastY || 0));
    self._lastY = y;
    self.vel += (Math.min(1, dv / 90) - self.vel) * 0.2;
    self.p += (p - self.p) * 0.1;

    var ctx = self.ctx, t = ctx.currentTime;

    /* ── Где вообще слышен двигатель ──────────────────────────
       Заказчик сформулировал точно: «музыка фоном, а звук ракеты
       только там, где она пролетает». Значит гул принадлежит не
       прокрутке, а сцене: он есть на старте, в разгоне, на орбите
       и при возвращении, и его нет на площадке, в салоне и у
       пульта - там человек стоит, а не летит. Акт берём у общего
       диспетчера сцены, чтобы звук не разошёлся с картинкой. */
    var act = (g.RC_SCENE && g.RC_SCENE.act) || null;
    var flying = act ? FLIGHT[act] || 0 : 0.7;
    if (!act) flying = 0.7;              /* диспетчера нет - ведём по прокрутке */
    self.fly += (flying - self.fly) * 0.06;
    if (self.eg) {
      var base = self.music() ? 0.30 : 0.55;
      self.eg.gain.setTargetAtTime(0.004 + base * self.fly, t, 0.35);
    }

    /* Разгон: чем быстрее листаешь, тем выше и злее гул */
    var f = 41 + self.vel * 26 + self.p * 8;
    self.o1.frequency.setTargetAtTime(f, t, 0.12);
    self.o2.frequency.setTargetAtTime(f * 2, t, 0.12);
    self.lp.frequency.setTargetAtTime(170 + self.vel * 520, t, 0.15);

    /* Поток: в атмосфере шумно, в космосе тихо, а на земле его нет
       вовсе - набегающему воздуху взяться неоткуда. */
    var air = Math.max(0, 1 - self.p * 1.9);
    self.ng.gain.setTargetAtTime((0.006 + self.vel * 0.05 * air) * (0.15 + self.fly * 0.85), t, 0.2);
    self.bp.frequency.setTargetAtTime(500 + self.vel * 1400 + self.p * 300, t, 0.2);

    /* Редкие щелчки эфира в средней части полёта */
    if (self.p > 0.2 && self.p < 0.8 && Math.random() < 0.006) {
      self.blip(1200 + Math.random() * 900, 0.05, "square", 0.012);
    }
  }
  step();
};

/* Уровень для полосок на кнопке */
Sound.prototype.energy = function () {
  if (!this.on || !this.an) return 0;
  this.an.getByteFrequencyData(this.bins);
  var s = 0;
  for (var i = 0; i < 8; i++) s += this.bins[i];
  return Math.min(1, s / (8 * 190));
};

/* ── Космический слой ────────────────────────────────────────
   Гул двигателя даёт движение, но один он звучит как пылесос.
   Космос делают три вещи: медленный аккорд на низких синусах,
   лёгкое биение между расстроенными голосами и длинный хвост
   отражений. Импульс для реверберации синтезируем сами - это
   двести миллисекунд затухающего шума, ни одного файла. */
Sound.prototype.space = function () {
  if (!this.ctx || this._space) return;
  /* Под музыкальной темой свой аккорд не нужен: у неё уже есть и
     гармония, и хвост зала. Два таких слоя дерутся друг с другом. */
  if (this.music()) return;
  var ctx = this.ctx;
  try {
    var out = ctx.createGain();
    out.gain.value = 0.0001;
    out.connect(this.master);

    /* Хвост отражений: без него аккорд звучит сухо и близко */
    var len = Math.floor(ctx.sampleRate * 2.4);
    var imp = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var data = imp.getChannelData(ch);
      for (var i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
    }
    var rev = ctx.createConvolver();
    rev.buffer = imp;
    var wet = ctx.createGain(); wet.gain.value = 0.55;
    rev.connect(wet); wet.connect(out);

    /* Аккорд: тоника, квинта и октава сверху. Голоса чуть
       расстроены, поэтому между ними идёт медленное биение. */
    var freqs = [55, 82.5, 110, 164.66];
    var voices = [];
    for (var k = 0; k < freqs.length; k++) {
      var o = ctx.createOscillator();
      o.type = k > 2 ? "triangle" : "sine";
      o.frequency.value = freqs[k];
      o.detune.value = (k - 1.5) * 6;
      var vg = ctx.createGain();
      vg.gain.value = k > 2 ? 0.05 : 0.12;
      o.connect(vg); vg.connect(out); vg.connect(rev);
      o.start();
      voices.push({ o: o, g: vg });
    }

    /* Дыхание: громкость аккорда медленно ходит вверх-вниз */
    var lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.frequency.value = 0.055;
    lg.gain.value = 0.045;
    lfo.connect(lg); lg.connect(out.gain);
    lfo.start();

    this._space = { out: out, voices: voices, rev: rev };
    out.gain.setTargetAtTime(0.16, ctx.currentTime, 2.2);
  } catch (e) {}
};

/* Далёкие сигналы сети: редкие, тихие, на грани слышимости.
   Они и создают ощущение, что вокруг работает инфраструктура. */
Sound.prototype.beacon = function () {
  if (!this.on || !this.ctx) return;
  var ctx = this.ctx, now = ctx.currentTime;
  if (this._bAt && now - this._bAt < 6) return;
  this._bAt = now;
  try {
    var o = ctx.createOscillator(), g2 = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880 + Math.random() * 660;
    g2.gain.setValueAtTime(0, now);
    g2.gain.linearRampToValueAtTime(0.035, now + 0.08);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 1.6);
    o.connect(g2);
    g2.connect(this._space ? this._space.rev : this.master);
    o.start(); o.stop(now + 1.7);
  } catch (e) {}
};

/* ── Подключение ─────────────────────────────────────────── */
var snd = new Sound();

/* ── Короткие события: отсечки маршрута и посадка ─────────────
   Звучат только если человек включил звук. Не чаще шести раз в
   секунду: иначе на быстрой прокрутке получается треск, а не кино. */
Sound.prototype.blip = function (freq) {
  if (!this.on || !this.ctx) return;
  var now = this.ctx.currentTime;
  if (this._blipAt && now - this._blipAt < 0.16) return;
  this._blipAt = now;
  try {
    var o = this.ctx.createOscillator(), g2 = this.ctx.createGain();
    o.type = "triangle";
    o.frequency.value = freq || 660;
    g2.gain.setValueAtTime(0, now);
    g2.gain.linearRampToValueAtTime(0.07, now + 0.01);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
    o.connect(g2); g2.connect(this.master);
    o.start(); o.stop(now + 0.3);
  } catch (e) {}
};

/* Касание опор: глухой удар и шипение, после которого по сценарию
   идут шестьсот миллисекунд полной тишины. */
Sound.prototype.boom = function () {
  if (!this.on || !this.ctx) return;
  var now = this.ctx.currentTime;
  if (this._boomAt && now - this._boomAt < 2) return;
  this._boomAt = now;
  /* Удар опор перекрывает музыку: тема отступает на пару секунд */
  if (g.RC_MUSIC && g.RC_MUSIC.duck) { try { g.RC_MUSIC.duck(2400); } catch (e) {} }
  try {
    var n = Math.floor(this.ctx.sampleRate * 0.6);
    var b = this.ctx.createBuffer(1, n, this.ctx.sampleRate), c = b.getChannelData(0);
    for (var i = 0; i < n; i++) c[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    var src = this.ctx.createBufferSource(); src.buffer = b;
    var f = this.ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 900;
    var g2 = this.ctx.createGain();
    g2.gain.setValueAtTime(0.32, now);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    src.connect(f); f.connect(g2); g2.connect(this.master);
    src.start();
    /* Гул двигателя уходит в ноль: ракета села */
    if (this.eg) this.eg.gain.setTargetAtTime(0.0001, now, 0.2);
  } catch (e) {}
};

/* ── Полёт ───────────────────────────────────────────────────
   В демо-полёте звук ведёт себя иначе, чем на странице: гул
   двигателя постоянный и слышный, свист потока идёт за тягой,
   которую корабль сообщает через flightLevel. Прокрутка страницы
   в полёте не участвует - там свой мир. */
Sound.prototype.flight = function (on) {
  this._flight = !!on;
  if (on && !this.on) this.start();
  if (!this.ready) return;
  var t = this.ctx.currentTime;
  if (on) {
    if (this.eg) this.eg.gain.setTargetAtTime(this.music() ? 0.4 : 0.6, t, 0.6);
    this.master.gain.setTargetAtTime(0.2, t, 0.8);
  } else {
    this.master.gain.setTargetAtTime(this.on ? 0.16 : 0, t, 0.6);
  }
};

Sound.prototype.flightLevel = function (k) {
  if (!this._flight || !this.ready) return;
  var t = this.ctx.currentTime;
  var f = 44 + k * 46;
  this.o1.frequency.setTargetAtTime(f, t, 0.2);
  this.o2.frequency.setTargetAtTime(f * 2, t, 0.2);
  this.lp.frequency.setTargetAtTime(200 + k * 900, t, 0.25);
  if (this.ng) this.ng.gain.setTargetAtTime(0.004 + k * 0.05, t, 0.3);
  if (this.eg) this.eg.gain.setTargetAtTime((this.music() ? 0.3 : 0.5) * (0.5 + k * 0.8), t, 0.35);
};

g.RC_SOUND = snd;

function bind() {
  var btns = [].slice.call(document.querySelectorAll(".js-sound"));
  if (!btns.length) return;

  btns.forEach(function (b) {
    b.addEventListener("click", function () {
      snd.toggle();
      paint();
    });
  });

  function paint() {
    /* Кнопка одна на весь звук сайта, поэтому «включено» - это либо
       синтезированный слой, либо музыкальная тема: на устройстве без
       Web Audio играет только вторая, и кнопка обязана это показать. */
    var on = snd.on || (g.RC_MUSIC && g.RC_MUSIC.playing && g.RC_MUSIC.playing());
    btns.forEach(function (b) {
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.closest(".pill") && b.closest(".pill").classList.toggle("at-2", !!on);
    });
  }
  paint();
  addEventListener("rc:music", paint);
  setTimeout(paint, 1200);
  setTimeout(paint, 3000);

  /* Полоски дышат в такт гулу */
  setInterval(function () {
    if (!snd.on) return;
    var e = snd.energy();
    document.documentElement.style.setProperty("--snd-e", e.toFixed(2));
  }, 110);

  /* Первый жест человека. Прокрутка на айфоне разрешением не считается,
     поэтому там сработает подсказка и включение по нажатию. */
  var off;
  try { off = localStorage.getItem(KEY) === "off"; } catch (e) {}
  if (off || REDUCE) return;

  function first() {
    ["pointerup", "touchend", "keydown", "wheel", "scroll"].forEach(function (n) {
      removeEventListener(n, first);
    });
    snd.start();
    setTimeout(paint, 400);
  }
  ["pointerup", "touchend", "keydown", "wheel", "scroll"].forEach(function (n) {
    addEventListener(n, first, { once: true, passive: true });
  });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
else bind();
})(window);
