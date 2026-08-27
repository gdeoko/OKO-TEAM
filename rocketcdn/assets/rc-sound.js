/* ═══════════════════════════════════════════════════════════
   Rocket CDN · звук фильма

   Два слоя. Непрерывный - гул двигателя, свист набегающего потока
   и эфир радиосвязи - собирается прямо в браузере из осцилляторов и
   шума: он тянется минутами и должен идти за скоростью прокрутки и
   за актом, в котором сейчас человек. Разовые события - щелчок
   клавиши, пробой, тревога, стыковка - берут записи из assets/snd.
   Синтез такое вытягивает до «похоже», запись звучит как рубка.
   Если запись не доехала, событие отдаёт синтезу: звук пропасть не
   может, он может только стать проще.

   Правила приличия соблюдаем: без жеста ничего не звучит, тихо,
   вводится плавно, выключается одним нажатием и запоминается.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

var eqEls = null;

/* Высоту документа берём из общего кэша: прямой вопрос заставляет
   браузер досчитать вёрстку, а спрашиваем мы её в каждом кадре. */
var DOCH = (window.RC_BOX && window.RC_BOX.docH) || function () {
  return document.documentElement.scrollHeight || 1;
};

/* Переменные оформления публикуем через общий кэш: запись на корне
   документа инвалидирует стиль всему дереву. Пишем изменившееся. */
var V = (g.RC_VAR && g.RC_VAR.set) || function (el, n, v) {
  if (el && el.style) el.style.setProperty(n, v);
};

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

/* ── Банк записанных эффектов ─────────────────────────────────
   Ключ - имя файла в assets/snd без расширения, значение - во сколько
   раз его слышно относительно общей громкости. Файлы уже сведены к
   одному уровню, здесь только характер: щелчок тише удара.

   Ничего не грузится заранее. Первый вызов события заказывает файл и
   на этот раз отдаёт синтез, со второго звучит запись. Так первый
   экран не тянет семьсот килобайт ради звука, который человек может
   и не включить. */
var ГРОМКО = {
  "hover": 0.34, "click": 0.52, "confirm": 0.46, "deny": 0.50,
  "panel-in": 0.42, "panel-out": 0.40, "switch": 0.50, "type": 0.34,
  "ignite": 0.62, "engine": 0.40, "climb": 0.40, "boom": 0.70,
  "hyper": 0.62, "arrive": 0.46, "dock": 0.52, "brake": 0.50,
  "radar": 0.44, "scan": 0.42, "lock": 0.48, "alarm": 0.52,
  "beacon": 0.36, "node": 0.42, "amb-cabin": 0.26, "amb-space": 0.30,
  "reveal": 0.44, "success": 0.52
};

/* Петли режем внутрь буфера: mp3 добивает края тишиной кодировщика,
   и стык на loop даёт щелчок. Играем не весь буфер, а его середину. */
var ПЕТЛЯ = { "engine": 1, "climb": 1, "amb-cabin": 1, "amb-space": 1 };

/* Откуда брать файлы. Считаем от собственного адреса, чтобы сайт жил
   и в подкаталоге, и с версией в запросе. */
var ПАПКА = (function () {
  var me = document.currentScript;
  if (!me || !me.src) {
    var все = document.getElementsByTagName("script");
    for (var i = все.length - 1; i >= 0; i--) {
      if (/rc-sound\.js/.test(все[i].src || "")) { me = все[i]; break; }
    }
  }
  if (me && me.src) return me.src.replace(/[?#].*$/, "").replace(/[^/]+$/, "") + "snd/";
  return "assets/snd/";
})();

function Sound() {
  this.on = false;
  this.ready = false;
  this.level = 0;        /* текущая громкость гула */
  this.want = 0;         /* к чему стремимся */
  this.vel = 0;          /* скорость прокрутки, сглаженная */
  this.p = 0;            /* положение на странице */
  this.fly = 0;          /* насколько ракета сейчас в кадре */
  this.ctx = null;
  this.буфер = {};       /* разобранные записи банка */
  this.везут = {};       /* что уже заказано и едет */
  this.фоны = {};        /* играющие петли: имя -> {src, gain} */
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

/* ── Работа с банком ──────────────────────────────────────────
   Заказ файла. Отдаёт буфер, если он разобран, иначе null и ставит
   загрузку. Ошибка сети не роняет ничего: имя уходит в буфер как
   false и больше не запрашивается, событие до конца сеанса остаётся
   за синтезом. */
Sound.prototype.дай = function (имя) {
  var б = this.буфер[имя];
  if (б) return б;
  if (б === false || this.везут[имя] || !this.ctx) return null;
  var сам = this;
  this.везут[имя] = 1;
  fetch(ПАПКА + имя + ".mp3", { cache: "force-cache" })
    .then(function (о) { if (!о.ok) throw new Error(о.status); return о.arrayBuffer(); })
    .then(function (сырое) {
      return new Promise(function (готово, беда) {
        /* Старый Safari знает только вариант с обратными вызовами. */
        var р = сам.ctx.decodeAudioData(сырое, готово, беда);
        if (р && р.then) р.then(готово, беда);
      });
    })
    .then(function (буф) { сам.буфер[имя] = буф; delete сам.везут[имя]; })
    .catch(function () { сам.буфер[имя] = false; delete сам.везут[имя]; });
  return null;
};

/* Проиграть разовый эффект. Второй довод - множитель громкости для
   момента. Отдаёт true, если запись действительно прозвучала: на
   этом ответе стоят все события, синтез идёт только при false. */
Sound.prototype.эф = function (имя, доля) {
  if (!this.on || !this.ready) return false;
  var буф = this.дай(имя);
  if (!буф) return false;
  try {
    var ctx = this.ctx;
    var src = ctx.createBufferSource();
    src.buffer = буф;
    var gn = ctx.createGain();
    gn.gain.value = (ГРОМКО[имя] || 0.4) * (доля == null ? 1 : доля);
    src.connect(gn); gn.connect(this.master);
    src.start(ctx.currentTime);
    return true;
  } catch (e) { return false; }
};

/* Фоновая петля. Второй вызов с тем же именем не заводит второй
   источник, он только ведёт громкость. Ноль гасит и убирает. */
Sound.prototype.фон = function (имя, громкость) {
  if (!this.ready || !this.ctx) return;
  var ц = Math.max(0, +громкость || 0) * (ГРОМКО[имя] || 0.3);
  var уже = this.фоны[имя];
  if (уже) {
    try { уже.gain.gain.setTargetAtTime(ц, this.ctx.currentTime, 0.6); } catch (e) {}
    if (ц <= 0.0005) {
      var сам = this;
      setTimeout(function () {
        var э = сам.фоны[имя];
        if (!э || э.gain.gain.value > 0.002) return;
        try { э.src.stop(); } catch (e2) {}
        delete сам.фоны[имя];
      }, 2600);
    }
    return;
  }
  if (ц <= 0.0005) return;
  var буф = this.дай(имя);
  if (!буф) return;
  try {
    var ctx = this.ctx, t = ctx.currentTime;
    var src = ctx.createBufferSource();
    src.buffer = буф;
    src.loop = true;
    if (ПЕТЛЯ[имя] && буф.duration > 0.6) {
      src.loopStart = 0.08;
      src.loopEnd = Math.max(0.2, буф.duration - 0.08);
    }
    var gn = ctx.createGain();
    gn.gain.value = 0;
    gn.gain.setTargetAtTime(ц, t, 0.9);
    src.connect(gn); gn.connect(this.master);
    src.start(t);
    this.фоны[имя] = { src: src, gain: gn };
  } catch (e) {}
};

/* Заранее заказать пачку: зовём, когда ясно, что человек сейчас
   войдёт в игру, и файлы успевают доехать до первого нажатия. */
Sound.prototype.прогрев = function (список) {
  if (!this.ready) return;
  for (var i = 0; i < список.length; i++) this.дай(список[i]);
};

Sound.prototype.прогревРубки = function () {
  this.прогрев(["switch", "click", "hover", "panel-in", "panel-out",
                "radar", "lock", "node", "amb-cabin"]);
};

/* Короткий звук события: щелчок, сигнал, подтверждение */
Sound.prototype.blip = function (freq, dur, type, vol) {
  if (!this.on || !this.ready) return;
  var ctx = this.ctx, t = ctx.currentTime;
  var o = ctx.createOscillator();
  var gn = ctx.createGain();
  o.type = type || "triangle";
  /* Зовут и без частоты - запасным путём вместо uiClick. Без
     значения по умолчанию сюда приходило undefined и осциллятор
     падал прямо в обработчике нажатия. */
  o.frequency.setValueAtTime(freq || 660, t);
  gn.gain.setValueAtTime(0, t);
  gn.gain.linearRampToValueAtTime(vol == null ? 0.05 : vol, t + 0.008);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + (dur || 0.12));
  o.connect(gn); gn.connect(this.master);
  o.start(t);
  o.stop(t + (dur || 0.12) + 0.02);
};

/* Двухнотный сигнал: отправка заявки, важное событие */
Sound.prototype.chime = function () {
  if (this.эф("success")) return;
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
  /* Маятник маяков заводится при включении звука и раньше тикал до
     закрытия вкладки: сигнала он не давал, потому что внутри стоит
     проверка on, но будильник каждые семь секунд держал вкладку
     занятой и мешал браузеру усыпить страницу. */
  if (this._bTimer) { clearInterval(this._bTimer); this._bTimer = null; }
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

    var max = DOCH() - innerHeight;
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

    /* Два фона, и одновременно они не звучат. Человек внутри рубки -
       слышно рубку: вентиляция, электрика, редкий тик прибора. Ракета
       в кадре снаружи - слышно пустоту. Пересчёт раз в полсекунды:
       петли ведутся плавно, чаще незачем. */
    if (!self._фонВ || t - self._фонВ > 0.5) {
      self._фонВ = t;
      var внутри = act === "cabin" || act === "manual" || act === "console" || act === "walk";
      self.фон("amb-cabin", внутри ? 1 : 0);
      self.фон("amb-space", внутри ? 0 : Math.max(0, self.p * 1.2 - 0.15) * (0.35 + self.fly * 0.65));
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
  if (this.эф("beacon")) return;
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
/* Частый щелчок прокрутки: не чаще шести раз в секунду, иначе на
   быстром пальце получается треск, а не кино.

   Раньше это объявление называлось blip и перекрывало настоящий
   blip выше - вместе с его громкостью, длительностью и формой
   волны. Двухнотные сигналы от этого звучали одной нотой: вторая
   нота приходила через 120 мс и глушилась этой самой защёлкой. */
Sound.prototype.tick = function (freq) {
  if (!this.on || !this.ctx) return;
  var now = this.ctx.currentTime;
  if (this._blipAt && now - this._blipAt < 0.16) return;
  this._blipAt = now;
  if (this.эф("type")) return;
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
  var записью = this.эф("boom");
  /* Удар опор перекрывает музыку: тема отступает на пару секунд */
  if (g.RC_MUSIC && g.RC_MUSIC.duck) { try { g.RC_MUSIC.duck(2400); } catch (e) {} }
  try {
    /* Шумовой удар нужен, только когда записи нет: иначе два удара
       наложатся и выйдет каша. Уход двигателя в ноль остаётся в обоих
       случаях - это не эффект, это состояние ракеты. */
    if (!записью) {
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
    }
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

/* ── Звуки интерфейса игры ───────────────────────────────────
   Клавиша панели - это не «бип», а механика: короткий высокий тик
   контакта и глухой удар клавишного хода под ним. Наведение -
   мягкий проход сканера. Подтверждение - двойной тон. Гипер -
   шумовой разгон с подъёмом высоты. Всё синтез, всё очень тихо:
   эффекты обязаны читаться, а не пугать. */
Sound.prototype.uiClick = function () {
  if (!this.ready && !this.build()) return;
  if (this.эф("click")) return;
  var ctx = this.ctx, t = ctx.currentTime;
  try {
    var o1 = ctx.createOscillator(), g1 = ctx.createGain();
    o1.type = "square"; o1.frequency.value = 2300;
    g1.gain.setValueAtTime(0.028, t);
    g1.gain.exponentialRampToValueAtTime(0.0001, t + 0.014);
    o1.connect(g1); g1.connect(this.master); o1.start(t); o1.stop(t + 0.02);
    var o2 = ctx.createOscillator(), g2 = ctx.createGain();
    o2.type = "sine"; o2.frequency.setValueAtTime(190, t);
    o2.frequency.exponentialRampToValueAtTime(95, t + 0.045);
    g2.gain.setValueAtTime(0.05, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o2.connect(g2); g2.connect(this.master); o2.start(t); o2.stop(t + 0.06);
  } catch (e) {}
};

Sound.prototype.uiHover = function () {
  if (!this.ready) return;
  if (this.эф("hover")) return;
  var ctx = this.ctx, t = ctx.currentTime;
  try {
    var o = ctx.createOscillator(), gn = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(620, t);
    o.frequency.linearRampToValueAtTime(940, t + 0.09);
    gn.gain.setValueAtTime(0, t);
    gn.gain.linearRampToValueAtTime(0.016, t + 0.02);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    o.connect(gn); gn.connect(this.master); o.start(t); o.stop(t + 0.12);
  } catch (e) {}
};

Sound.prototype.uiConfirm = function () {
  if (this.эф("confirm")) return;
  this.blip(660, 0.1, "sine", 0.035);
  var self = this;
  setTimeout(function () { self.blip(990, 0.16, "sine", 0.03); }, 90);
};

Sound.prototype.hyper = function () {
  if (!this.ready && !this.build()) return;
  if (this.эф("hyper")) return;
  var ctx = this.ctx, t = ctx.currentTime;
  try {
    var n = Math.floor(ctx.sampleRate * 1.4);
    var b = ctx.createBuffer(1, n, ctx.sampleRate), c = b.getChannelData(0);
    for (var i = 0; i < n; i++) c[i] = (Math.random() * 2 - 1) * Math.pow(i / n, 1.6);
    var src = ctx.createBufferSource(); src.buffer = b;
    var f = ctx.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 1.4;
    f.frequency.setValueAtTime(240, t);
    f.frequency.exponentialRampToValueAtTime(3600, t + 1.15);
    var gn = ctx.createGain();
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(0.16, t + 0.9);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    src.connect(f); f.connect(gn); gn.connect(this.master);
    src.start(t);
  } catch (e) {}
};

/* ══════════════════════════════════════════════════════════
   Голоса приборов

   До сих пор весь корабль говорил четырьмя звуками: щелчок,
   наведение, подтверждение и гул прыжка. Всё остальное - развёртка
   узла, захват цели, открытие досье, удар о корпус, выход на виток -
   звучало одинаковым blip, то есть не звучало никак. Заказчик просил
   звуков «везде и много», и это как раз тот случай, когда прибор без
   голоса читается неживым.

   Всё синтезируется на месте: ни одного файла, ни одного запроса.
   Каждый голос - это узнаваемая форма, а не просто другая частота.
   ══════════════════════════════════════════════════════════ */

/* Общая заготовка: тон с огибающей и необязательным глиссандо */
Sound.prototype._тон = function (f0, f1, t0, dur, type, vol, q) {
  if (!this.on || !this.ready) return;
  var ctx = this.ctx, t = ctx.currentTime + (t0 || 0);
  try {
    var o = ctx.createOscillator(), gn = ctx.createGain();
    o.type = type || "sine";
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    gn.gain.setValueAtTime(0.0001, t);
    gn.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur * 0.25));
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var хвост = gn;
    if (q) {
      var f = ctx.createBiquadFilter();
      f.type = "bandpass"; f.frequency.value = (f0 + (f1 || f0)) / 2; f.Q.value = q;
      gn.connect(f); хвост = f;
    }
    o.connect(gn); хвост.connect(this.master);
    o.start(t); o.stop(t + dur + 0.03);
  } catch (e) {}
};

/* Шумовой всплеск с полосовым фильтром: удары, шорохи, затвор */
Sound.prototype._шум = function (t0, dur, f0, f1, vol, q) {
  if (!this.on || !this.ready) return;
  var ctx = this.ctx, t = ctx.currentTime + (t0 || 0);
  try {
    var n = Math.max(64, Math.floor(ctx.sampleRate * dur));
    var b = ctx.createBuffer(1, n, ctx.sampleRate), c = b.getChannelData(0);
    for (var i = 0; i < n; i++) c[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var src = ctx.createBufferSource(); src.buffer = b;
    var f = ctx.createBiquadFilter();
    f.type = "bandpass"; f.Q.value = q || 1.1;
    f.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    var gn = ctx.createGain();
    gn.gain.setValueAtTime(vol, t);
    gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(gn); gn.connect(this.master);
    src.start(t);
  } catch (e) {}
};

/* Узел развёрнут: три ноты вверх и мягкий щелчок фиксатора. Это
   главное достижение в игре, и звучать оно обязано как награда. */
Sound.prototype.node = function () {
  if (!this.ready && !this.build()) return;
  if (this.эф("node")) return;
  this._тон(523, 523, 0, 0.10, "sine", 0.045);
  this._тон(659, 659, 0.09, 0.10, "sine", 0.042);
  this._тон(880, 880, 0.18, 0.26, "sine", 0.05);
  this._шум(0.18, 0.06, 2600, 900, 0.02, 2.2);
};

/* Захват цели: короткий двойной писк радара */
Sound.prototype.lock = function () {
  if (!this.ready) return;
  if (this.эф("lock")) return;
  this._тон(1480, 1480, 0, 0.035, "square", 0.014);
  this._тон(1480, 1480, 0.075, 0.035, "square", 0.012);
};

/* Досье открылось: стеклянный подъём. Закрылось - он же вниз. */
Sound.prototype.panelIn = function () {
  if (!this.ready && !this.build()) return;
  if (this.эф("panel-in")) return;
  this._тон(420, 1180, 0, 0.20, "triangle", 0.022, 2.4);
  this._шум(0, 0.16, 900, 3200, 0.012, 1.6);
};
Sound.prototype.panelOut = function () {
  if (!this.ready) return;
  if (this.эф("panel-out")) return;
  this._тон(980, 380, 0, 0.16, "triangle", 0.016, 2.4);
};

/* Удар о корпус: низкий толчок с металлическим призвуком */
Sound.prototype.alarm = function () {
  if (!this.ready && !this.build()) return;
  if (this.эф("alarm")) return;
  this._тон(96, 42, 0, 0.34, "sawtooth", 0.07);
  this._шум(0, 0.22, 1800, 260, 0.05, 0.9);
  this._тон(740, 740, 0.10, 0.12, "square", 0.018);
};

/* Выход на виток: тёплый разлив. Прибытие обязано ощущаться. */
Sound.prototype.arrive = function () {
  if (!this.ready && !this.build()) return;
  if (this.эф("arrive")) return;
  this._тон(196, 294, 0, 0.55, "sine", 0.04);
  this._тон(294, 392, 0.12, 0.55, "sine", 0.03);
  this._тон(588, 588, 0.30, 0.40, "sine", 0.018);
};

/* Затвор: снимок из окна */
Sound.prototype.shutter = function () {
  if (!this.ready && !this.build()) return;
  if (this.эф("switch")) return;
  this._шум(0, 0.035, 3400, 1400, 0.05, 1.4);
  this._шум(0.055, 0.05, 1600, 700, 0.04, 1.2);
};

/* Отказ: рукав закрыт, узлов не хватает, команда сейчас недоступна */
Sound.prototype.deny = function () {
  if (!this.ready && !this.build()) return;
  if (this.эф("deny")) return;
  this._тон(220, 220, 0, 0.09, "square", 0.03);
  this._тон(165, 165, 0.10, 0.16, "square", 0.03);
};

/* ── Что умеет только запись ──────────────────────────────────
   Розжиг, пневматика шлюза, тормозные двигатели, проход сканера,
   пинг локатора и щелчок тумблера на доске. Синтезом это выходит
   похожим на игрушку, поэтому запаса тут нет: файла нет - события
   нет. Молчание честнее подделки. */
function записью(имя, поле) {
  Sound.prototype[поле] = function (доля) {
    if (!this.ready && !this.build()) return false;
    return this.эф(имя, доля);
  };
}
записью("switch", "key");
записью("ignite", "ignite");
записью("dock", "dock");
записью("brake", "brake");
записью("radar", "radar");
записью("scan", "scan");
записью("reveal", "reveal");

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
    /* На скрытой вкладке эквалайзеру рисовать некому. Это был
       единственный таймер страницы, который не спрашивал про
       видимость, и он же на каждом тике помечал стиль узлов .eq
       устаревшим: расход батареи на вкладке, куда никто не смотрит. */
    if (document.hidden) return;
    if (!snd.on) return;
    var e = snd.energy();
    /* Уровень читает только столбик эквалайзера: пишем ему, а не
       корню документа - иначе каждый кадр помечается устаревшим
       стиль всего дерева ради трёх полосок в шапке. */
    if (!eqEls || !eqEls.length) eqEls = [].slice.call(document.querySelectorAll(".eq"));
    for (var ei = 0; ei < eqEls.length; ei++) V(eqEls[ei], "--snd-e", e.toFixed(2));
  }, 110);

  /* Первый жест человека. Прокрутка на айфоне разрешением не считается,
     поэтому там сработает подсказка и включение по нажатию. */
  var off;
  try { off = localStorage.getItem(KEY) === "off"; } catch (e) {}
  if (off || REDUCE) return;

  /* Звук ждёт нажатия на свою кнопку и ничего больше. Раньше он
     заводился на первой же прокрутке, хотя тумблер в шапке стоял в
     положении «выключено»: человек листал страницу и получал гул,
     которого не просил. Подсказка о том, что звук здесь есть,
     осталась - она сообщает, а не включает. */
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bind);
else bind();
})(window);
