/* ═══════════════════════════════════════════════════════════
   Rocket VPN · звук фильма

   Сценарий требует звука в одном месте прямо и по имени: на проколе
   провал в тишину на треть секунды, потом низкий удар. Тишина там
   работает сильнее любого рёва, и без неё главный кадр сайта остаётся
   немым.

   ЧЕТЫРЕ РЕШЕНИЯ, НА КОТОРЫХ СТОИТ ФАЙЛ.

   1. ЗВУК СИНТЕЗИРУЕТСЯ, А НЕ КАЧАЕТСЯ. Ни одного файла: гул, свип
      досмотра, щелчок оболочки, удар прокола и ответ станции собраны
      из генераторов и фильтров. Это ноль веса, ноль запросов и полная
      власть над высотой и длительностью, а значит звук может идти ЗА
      прокруткой, а не проигрываться кусками.

   2. ЗВУК ИДЁТ ОТ ТОЙ ЖЕ ВЕЛИЧИНЫ, ЧТО И КАРТИНКА. Никаких событий
      «долистал до места»: громкости и высоты считаются из доли хода
      акта, той самой --д. Поэтому прокрутка вверх звучит как обратный
      ход, а не как повтор.

   3. МОЛЧИТ, ПОКА НЕ ПОПРОСИЛИ. Браузер и так не даст звука без
      действия человека, но дело не в этом: сайт, заоравший в тишине
      офиса, теряет человека навсегда. Кнопка одна, состояние помнится.

   4. НИЧЕГО НЕ ЛОМАЕТ. Нет Web Audio, отказал контекст, запрещена
      автоигра - файл молча выключается. Звук это отделка, и он не
      имеет права уронить сцену.
   ═══════════════════════════════════════════════════════════ */
(function (g, d) {
  "use strict";

  var ПАМЯТЬ = "rv.звук";
  var К = null;              /* AudioContext */
  var шина = null;           /* общий выход с ограничителем */
  var вкл = false;
  var собран = false;
  var голоса = {};
  var кнопка = null;
  var последняя = { прокол: 0, оболочка: 0, станция: 0, ворота: 0 };

  function можно() {
    return !!(g.AudioContext || g.webkitAudioContext);
  }

  function зажать(v, a, b) { return v < a ? a : (v > b ? b : v); }

  /* ── Сборка ─────────────────────────────────────────────────
     Собираем один раз и по первому включению: держать контекст
     открытым, пока человек не попросил звука, значит зря греть
     телефон. */
  function собрать() {
    if (собран) return true;
    var A = g.AudioContext || g.webkitAudioContext;
    if (!A) return false;
    try { К = new A(); } catch (e) { return false; }

    /* Ограничитель на выходе. Голосов немного, но удар прокола сходится
       с гулом и свипом, и без него сумма щёлкает. */
    var огр = К.createDynamicsCompressor();
    огр.threshold.value = -14;
    огр.knee.value = 22;
    огр.ratio.value = 8;
    огр.attack.value = 0.004;
    огр.release.value = 0.22;

    шина = К.createGain();
    шина.gain.value = 0;
    шина.connect(огр);
    огр.connect(К.destination);

    голоса.гул = гул();
    голоса.свип = свип();
    собран = true;
    return true;
  }

  /* Шум как источник: один буфер на весь сайт, дальше он только
     фильтруется. Розовый, а не белый: белый режет уши на телефоне. */
  var шумБуфер = null;
  function шум() {
    if (!шумБуфер) {
      var n = К.sampleRate * 2;
      шумБуфер = К.createBuffer(1, n, К.sampleRate);
      var d0 = шумБуфер.getChannelData(0);
      var b0 = 0, b1 = 0, b2 = 0;
      for (var i = 0; i < n; i++) {
        var бел = Math.random() * 2 - 1;
        b0 = 0.997 * b0 + бел * 0.0299;
        b1 = 0.985 * b1 + бел * 0.0755;
        b2 = 0.950 * b2 + бел * 0.1538;
        d0[i] = (b0 + b1 + b2 + бел * 0.1848) * 0.32;
      }
    }
    var и = К.createBufferSource();
    и.buffer = шумБуфер;
    и.loop = true;
    return и;
  }

  /* Гул открытой сети: две расстроенные низкие волны плюс глухой шум.
     Это фон первых двух актов и он же уходит в ноль на проколе. */
  function гул() {
    var g1 = К.createOscillator(); g1.type = "sine"; g1.frequency.value = 47;
    var g2 = К.createOscillator(); g2.type = "sine"; g2.frequency.value = 70.5;
    var ш = шум();
    var фш = К.createBiquadFilter(); фш.type = "lowpass"; фш.frequency.value = 220;
    var см = К.createGain(); см.gain.value = 0;
    var г1 = К.createGain(); г1.gain.value = 0.55;
    var г2 = К.createGain(); г2.gain.value = 0.22;
    var г3 = К.createGain(); г3.gain.value = 0.30;
    g1.connect(г1); г1.connect(см);
    g2.connect(г2); г2.connect(см);
    ш.connect(фш); фш.connect(г3); г3.connect(см);
    см.connect(шина);
    g1.start(); g2.start(); ш.start();
    return { уровень: см.gain, тон: g1.frequency, тон2: g2.frequency };
  }

  /* Свип досмотра: узкая полоса шума, ходящая по частоте. Это тот же
     луч, что идёт по стене, только слышимый. */
  function свип() {
    var ш = шум();
    var ф = К.createBiquadFilter();
    ф.type = "bandpass"; ф.frequency.value = 900; ф.Q.value = 7;
    var см = К.createGain(); см.gain.value = 0;
    ш.connect(ф); ф.connect(см); см.connect(шина);
    ш.start();
    return { уровень: см.gain, частота: ф.frequency };
  }

  /* Короткий голос: собирается под событие и сам себя убирает. */
  function щелчок(частота, длина, тип, громко) {
    if (!вкл || !К) return;
    var о = К.createOscillator();
    о.type = тип || "triangle";
    var г = К.createGain();
    var t = К.currentTime;
    о.frequency.setValueAtTime(частота, t);
    г.gain.setValueAtTime(0, t);
    г.gain.linearRampToValueAtTime(громко == null ? 0.20 : громко, t + 0.006);
    г.gain.exponentialRampToValueAtTime(0.0001, t + длина);
    о.connect(г); г.connect(шина);
    о.start(t); о.stop(t + длина + 0.05);
  }

  /* Удар прокола. Низкая волна, падающая по высоте, плюс короткий
     выдох шума. Именно он идёт ПОСЛЕ тишины и ради него тишина. */
  function удар() {
    if (!вкл || !К) return;
    var t = К.currentTime;
    var о = К.createOscillator();
    о.type = "sine";
    о.frequency.setValueAtTime(112, t);
    о.frequency.exponentialRampToValueAtTime(28, t + 0.85);
    var г = К.createGain();
    г.gain.setValueAtTime(0.0001, t);
    г.gain.exponentialRampToValueAtTime(0.85, t + 0.012);
    г.gain.exponentialRampToValueAtTime(0.0001, t + 1.15);
    о.connect(г); г.connect(шина);
    о.start(t); о.stop(t + 1.2);

    var ш = шум();
    var ф = К.createBiquadFilter(); ф.type = "lowpass";
    ф.frequency.setValueAtTime(2400, t);
    ф.frequency.exponentialRampToValueAtTime(180, t + 0.6);
    var гш = К.createGain();
    гш.gain.setValueAtTime(0.0001, t);
    гш.gain.exponentialRampToValueAtTime(0.34, t + 0.02);
    гш.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    ш.connect(ф); ф.connect(гш); гш.connect(шина);
    ш.start(t); ш.stop(t + 0.75);
  }

  /* ── Что звучит в каждом акте ───────────────────────────────
     Величины берутся из доли хода: звук не проигрывается, он ЕДЕТ. */
  function поАкту(имя, д) {
    if (!вкл || !К || !собран) return;

    /* Голоса общие на весь сайт, а подписчиков семь: плёнка зовёт
       каждого на каждом кадре, со своей долей. Первая сборка ставила
       громкости из любого вызова, и последний акт в списке затирал
       текущий - замер показывал одну и ту же громкость во всех местах
       сайта, включая тишину перед ударом.

       Ведёт звук ТОЛЬКО тот акт, который сейчас идёт: его доля строго
       внутри отрезка. Акты, которые ещё не начались (ноль) или уже
       кончились (единица), молчат и чужого не трогают. */
    if (д <= 0.002 || д >= 0.998) return;

    var t = К.currentTime;

    if (имя === "видно" || имя === "периметр") {
      /* Гул сети. В периметре он гуще и ниже: стена ближе. */
      var у = имя === "видно" ? 0.16 : 0.16 + д * 0.10;
      голоса.гул.уровень.setTargetAtTime(у, t, 0.35);
      голоса.гул.тон.setTargetAtTime(имя === "видно" ? 47 : 42, t, 0.6);
      /* Свип идёт по стене вместе с лучом досмотра: четыре прохода на
         акт, как и в картинке. */
      if (имя === "периметр") {
        var фаза = (д * 4) % 1;
        голоса.свип.уровень.setTargetAtTime(0.05 + (1 - фаза) * 0.05, t, 0.12);
        голоса.свип.частота.setTargetAtTime(420 + фаза * 2600, t, 0.10);
      } else {
        голоса.свип.уровень.setTargetAtTime(0.012, t, 0.4);
      }
      return;
    }

    if (имя === "оболочка") {
      голоса.гул.уровень.setTargetAtTime(0.13, t, 0.4);
      голоса.свип.уровень.setTargetAtTime(0.035, t, 0.3);
      /* Щелчок смыкания: ровно там, где сходятся две половины. */
      if (д > 0.42 && д < 0.60 && t - последняя.оболочка > 2.2) {
        последняя.оболочка = t;
        щелчок(620, 0.09, "square", 0.13);
        щелчок(180, 0.22, "sine", 0.16);
      }
      return;
    }

    if (имя === "прокол") {
      /* ГЛАВНОЕ МЕСТО. До броска всё гаснет за треть секунды, дальше
         тишина, и на выходе из неё - удар. */
      if (д < 0.34) {
        голоса.гул.уровень.setTargetAtTime(0.15 - д * 0.30, t, 0.20);
        голоса.свип.уровень.setTargetAtTime(0.02, t, 0.2);
      } else if (д < 0.44) {
        голоса.гул.уровень.setTargetAtTime(0.0, t, 0.08);
        голоса.свип.уровень.setTargetAtTime(0.0, t, 0.08);
      } else {
        if (t - последняя.прокол > 3.0) { последняя.прокол = t; удар(); }
        /* Тоннель: гул возвращается выше и ярче, скорость слышна. */
        голоса.гул.уровень.setTargetAtTime(0.10 + (д - 0.44) * 0.22, t, 0.25);
        голоса.гул.тон.setTargetAtTime(58 + (д - 0.44) * 46, t, 0.4);
        голоса.свип.уровень.setTargetAtTime(0.02 + (д - 0.44) * 0.05, t, 0.3);
        голоса.свип.частота.setTargetAtTime(1200 + (д - 0.44) * 3400, t, 0.3);
      }
      return;
    }

    if (имя === "выход") {
      голоса.гул.уровень.setTargetAtTime(0.10, t, 0.6);
      голоса.гул.тон.setTargetAtTime(64, t, 0.8);
      голоса.свип.уровень.setTargetAtTime(0.014, t, 0.6);
      return;
    }

    if (имя === "рубка") {
      голоса.гул.уровень.setTargetAtTime(0.085, t, 0.6);
      голоса.свип.уровень.setTargetAtTime(0.010, t, 0.6);
      return;
    }

    if (имя === "стыковка") {
      голоса.гул.уровень.setTargetAtTime(0.08 + д * 0.06, t, 0.5);
      /* Ворота на сторону соседей открываются один раз. */
      if (д > 0.55 && t - последняя.ворота > 4.0) {
        последняя.ворота = t;
        щелчок(320, 0.5, "sine", 0.14);
        щелчок(480, 0.7, "sine", 0.09);
      }
      return;
    }
  }

  /* Ответ станции: зовётся актом выхода, когда человек выбрал точку. */
  function станция() {
    if (!вкл || !К) return;
    var t = К.currentTime;
    if (t - последняя.станция < 0.12) return;
    последняя.станция = t;
    щелчок(880, 0.10, "sine", 0.12);
    щелчок(1320, 0.16, "sine", 0.07);
  }

  /* ── Включение ──────────────────────────────────────────────── */
  function включить(да) {
    if (да && !собрать()) return false;
    вкл = !!да;
    if (К && К.state === "suspended") { try { К.resume(); } catch (e) {} }
    if (шина) {
      шина.gain.setTargetAtTime(вкл ? 0.9 : 0, К.currentTime, вкл ? 0.25 : 0.12);
    }
    try { localStorage.setItem(ПАМЯТЬ, вкл ? "1" : "0"); } catch (e2) {}
    if (кнопка) {
      кнопка.setAttribute("aria-pressed", вкл ? "true" : "false");
      кнопка.setAttribute("aria-label", вкл ? "Выключить звук" : "Включить звук");
      кнопка.classList.toggle("rv-звук-вкл", вкл);
    }
    return вкл;
  }

  function поставитьКнопку() {
    if (!можно() || кнопка) return;
    кнопка = d.createElement("button");
    кнопка.type = "button";
    кнопка.className = "rv-звук";
    кнопка.setAttribute("aria-pressed", "false");
    кнопка.setAttribute("aria-label", "Включить звук");
    кнопка.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M4 9.5h3.2L12 5.8v12.4L7.2 14.5H4z"/>' +
      '<path class="rv-звук-волна" d="M15.4 9.2a4 4 0 0 1 0 5.6"/>' +
      '<path class="rv-звук-волна" d="M17.9 6.8a7.5 7.5 0 0 1 0 10.4"/>' +
      '<path class="rv-звук-крест" d="M16.2 9.6l5 5m0-5l-5 5"/>' +
      '</svg>';
    кнопка.addEventListener("click", function () { включить(!вкл); });
    d.body.appendChild(кнопка);
  }

  function завести() {
    поставитьКнопку();
    if (!g.RV_MOTION || !g.RV_MOTION["слушать"]) return;
    var акты = d.querySelectorAll(".rv-акт");
    for (var i = 0; i < акты.length; i++) {
      (function (имя) {
        g.RV_MOTION["слушать"](имя, function (д) { поАкту(имя, д); });
      })(акты[i].getAttribute("data-акт") || ("акт" + i));
    }
    /* Прошлый выбор человека. Сам звук всё равно ждёт первого касания:
       браузер не отдаёт контекст раньше, и это правильно. */
    var было = null;
    try { было = localStorage.getItem(ПАМЯТЬ); } catch (e) {}
    if (было === "1") {
      var раз = function () {
        d.removeEventListener("pointerdown", раз);
        d.removeEventListener("keydown", раз);
        включить(true);
      };
      d.addEventListener("pointerdown", раз, { once: true });
      d.addEventListener("keydown", раз, { once: true });
    }
  }

  g.RV_SOUND = {
    "включить": включить,
    "идёт": function () { return вкл; },
    "станция": станция,
    /* Замер для живой проверки. Звук нельзя оценить снимком, а
       «вроде играет» не сдача: проверка читает отсюда состояние
       контекста и текущие громкости и говорит ЧИСТО или ГРЯЗНО. */
    "замер": function () {
      return {
        "состояние": К ? К.state : "нет",
        "шина": шина ? +шина.gain.value.toFixed(4) : 0,
        "гул": голоса.гул ? +голоса.гул.уровень.value.toFixed(4) : 0,
        "свип": голоса.свип ? +голоса.свип.уровень.value.toFixed(4) : 0
      };
    }
  };

  /* Ждём именно DOMContentLoaded, а не «не loading».

     Отложенные скрипты выполняются, когда разбор уже кончился и
     состояние документа стало interactive, но ДО события. Проверка на
     «не loading» проходила, звук заводился сразу - и не находил
     rv-motion.js, который подключён ниже по списку и ещё не выполнился.
     Подписок не появлялось вовсе: замер показывал живой контекст и
     нулевые громкости во всех актах.

     На interactive ждём событие: к нему выполнены все отложенные
     файлы, включая плёнку. */
  if (d.readyState === "loading" || d.readyState === "interactive") {
    d.addEventListener("DOMContentLoaded", завести);
  } else {
    завести();
  }

})(window, document);
