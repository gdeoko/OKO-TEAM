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

function Sound() {
  this.on = false;
  this.ready = false;
  this.level = 0;        /* текущая громкость гула */
  this.want = 0;         /* к чему стремимся */
  this.vel = 0;          /* скорость прокрутки, сглаженная */
  this.p = 0;            /* положение на странице */
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
  var r = this.ctx.resume();
  if (r && r.then) {
    r.then(function () { self.fadeIn(); }).catch(function () { self.hint(); });
  } else {
    this.fadeIn();
  }
};

Sound.prototype.fadeIn = function () {
  if (this.ctx.state !== "running") { this.hint(); return; }
  this.on = true;
  document.documentElement.classList.add("snd-on");
  var t = this.ctx.currentTime;
  this.master.gain.cancelScheduledValues(t);
  this.master.gain.setValueAtTime(this.master.gain.value, t);
  this.master.gain.linearRampToValueAtTime(0.16, t + 1.8);
  this.loop();
  try { localStorage.setItem(KEY, "on"); } catch (e) {}
  if (g.RC_track) g.RC_track("sound", "on");
};

Sound.prototype.stop = function () {
  this.on = false;
  document.documentElement.classList.remove("snd-on");
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

    var max = document.documentElement.scrollHeight - innerHeight;
    var y = g.scrollY || 0;
    var p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
    var dv = Math.abs(y - (self._lastY || 0));
    self._lastY = y;
    self.vel += (Math.min(1, dv / 90) - self.vel) * 0.2;
    self.p += (p - self.p) * 0.1;

    var ctx = self.ctx, t = ctx.currentTime;
    /* Разгон: чем быстрее листаешь, тем выше и злее гул */
    var f = 41 + self.vel * 26 + self.p * 8;
    self.o1.frequency.setTargetAtTime(f, t, 0.12);
    self.o2.frequency.setTargetAtTime(f * 2, t, 0.12);
    self.lp.frequency.setTargetAtTime(170 + self.vel * 520, t, 0.15);

    /* Поток: в атмосфере шумно, в космосе тихо */
    var air = Math.max(0, 1 - self.p * 1.9);
    self.ng.gain.setTargetAtTime(0.006 + self.vel * 0.05 * air, t, 0.2);
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

/* ── Подключение ─────────────────────────────────────────── */
var snd = new Sound();
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
    btns.forEach(function (b) {
      b.setAttribute("aria-pressed", snd.on ? "true" : "false");
      b.closest(".pill") && b.closest(".pill").classList.toggle("at-2", snd.on);
    });
  }
  paint();

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
