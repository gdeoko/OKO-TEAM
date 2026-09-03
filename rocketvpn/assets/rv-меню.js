/* Rocket VPN. Бургер, постоянные органы и форма обратной связи.

   ЗАЧЕМ. До этого на всём сайте была одна кнопка - вход в кабинет.
   Человек, попавший в середину ленты, не мог ни вернуться к началу, ни
   уйти к продукту, ни написать нам, ни узнать, сколько ещё листать. У
   ленты на восемь актов и пятнадцать тысяч точек высоты обязан быть
   способ прыгнуть, иначе она читается как бесконечная.

   ПОЧЕМУ СОБИРАЕТСЯ СКРИПТОМ, А НЕ ЛЕЖИТ В РАЗМЕТКЕ. Разделы меню это
   сами акты, и они объявлены в разметке признаком data-акт. Второй
   список тех же восьми имён однажды разойдётся с первым: акт
   переименуют, а меню будет водить в пустоту. Читаем акты с экрана.

   ПОЧЕМУ ПАНЕЛЬ, А НЕ ЯКОРНЫЕ ССЫЛКИ. Лента идёт под управлением
   плёнки: у актов свой ход, и обычный переход по якорю бросает
   человека в середину сцены с несобранным кадром. Ведём прокруткой и
   отдаём плёнке пересчитаться.

   ПОРЯДОК ДЕЙСТВИЙ В МЕНЮ - ЭТО ВОРОНКА, А НЕ АЛФАВИТ. Сначала то,
   ради чего сайт написан (проба в боте), потом то, что нужно уже
   платящему (кабинет), потом связь с нами, и только потом соседний
   продукт и игра. Наверху меню стоит то, что чаще всего нажимают.
   ═══════════════════════════════════════════════════════════ */
(function (g, d) {
  "use strict";

  var СВЯЗЬ = {
    бот:     "https://t.me/RocketCompanyVPN_bot",
    кабинет: "https://rocketweb.top",
    помощь:  "https://t.me/HelpRocketVPN_bot",
    канал:   "https://t.me/rocketvpnnews"
  };
  /* Соседний сайт и игра в нём. Признак from=vpn нужен там для связки,
     flight=1 открывает полёт сразу - иначе человек, нажавший «играть»,
     попадает на первый экран чужого сайта и ищет кнопку сам.
     Договорённости между сайтами латиницей: кириллица в адресной
     строке показывается процентами и не диктуется голосом. */
  var CDN  = "https://rocketcdn.ru/?from=vpn";
  var ИГРА = "https://rocketcdn.ru/?from=vpn&flight=1";
  var API  = "https://rocketcdn.ru/api.php";

  var ТЕМА_КЛЮЧ = "rv-тема";

  function эк(с) {
    return String(с == null ? "" : с).replace(/[&<>"']/g, function (з) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[з];
    });
  }

  /* ── Тема ───────────────────────────────────────────────────
     Выбор человека держим в памяти вкладки и в хранилище: тот, кто
     один раз включил светлую, не должен включать её на каждой
     странице. Пока выбора не было, идём за системной настройкой:
     навязывать тёмное тому, у кого телефон в дневном режиме, значит
     решать за него. */
  /* Пока человек не выбрал сам - тёмная, и системную настройку здесь
     НЕ слушаем. Сайт это ночной космос: светлая тема тут второе время
     суток, а не равноправная половина. Телефон в дневном режиме
     встречал бы человека дневной версией фильма про ночь, которую он
     не просил. Выбрал светлую руками - помним и уважаем. */
  function системная() { return "тёмная"; }

  function тема() {
    var т = "";
    try { т = g.localStorage.getItem(ТЕМА_КЛЮЧ) || ""; } catch (e) {}
    return т === "светлая" || т === "тёмная" ? т : системная();
  }

  function поставитьТему(т) {
    d.documentElement.setAttribute("data-тема", т);
    try { g.localStorage.setItem(ТЕМА_КЛЮЧ, т); } catch (e) {}
    /* Объёмный мир красится не разметкой, а своим кодом: сообщаем ему
       о смене отдельно, иначе сцена останется ночной под дневным
       текстом и всё станет нечитаемым. */
    try { g.dispatchEvent(new CustomEvent("rv-тема", { detail: т })); } catch (e2) {
      try {
        var ev = d.createEvent("Event"); ev.initEvent("rv-тема", false, false);
        g.dispatchEvent(ev);
      } catch (e3) {}
    }
    var к = d.getElementById("rvТема");
    if (к) {
      к.setAttribute("aria-pressed", т === "светлая" ? "true" : "false");
      var п = к.querySelector(".rv-мп-знач");
      if (п) п.textContent = т === "светлая" ? "светлая" : "тёмная";
    }
    /* Тот же признак на кнопке в планке: по нему CSS показывает солнце
       днём и луну ночью, и человек видит, куда переключит, а не где
       стоит. */
    var о = d.getElementById("rvОрганТема");
    if (о) {
      о.setAttribute("aria-pressed", т === "светлая" ? "true" : "false");
      о.setAttribute("aria-label", т === "светлая" ? "Включить тёмную тему" : "Включить светлую тему");
    }
  }
  поставитьТему(тема());

  /* ── Краски по теме ─────────────────────────────────────────
     Двухмерные холсты актов рисуют светом по чёрному: линии решётки,
     пакеты, подписи. Днём тот же светлый штрих по светлому фону не
     виден вовсе - владелец увидел это первым же взглядом и сказал
     «на светлой сливается всё».

     Держим ОДИН набор красок на обе темы здесь, рядом с самой темой.
     Разносить их по холстам значит однажды перекрасить один и забыть
     второй. Строки заканчиваются открытой скобкой намеренно: холсты
     дописывают прозрачность сами и меняют её каждый кадр. */
  var КРАСКИ = {
    "тёмная": {
      линия:   "rgba(96,120,216,",
      пакет:   "rgba(200,214,255,",
      свой:    "rgba(120,150,255,",
      тревога: "rgba(255,106,60,",
      текст:   "rgba(232,234,246,"
    },
    "светлая": {
      /* Днём то же самое, но чернилами. Тона взяты темнее марки:
         линия в четверть прозрачности обязана читаться на светлом
         так же уверенно, как светлая читалась на чёрном. */
      линия:   "rgba(42,63,156,",
      пакет:   "rgba(20,28,68,",
      свой:    "rgba(47,73,184,",
      тревога: "rgba(198,66,24,",
      текст:   "rgba(14,19,48,"
    }
  };

  /* ── Разделы читаем с экрана ───────────────────────────────── */
  function разделы() {
    var из = [];
    /* Только САМИ акты, а не всё, на чём стоит их имя. Признак
       data-акт носят ещё и метки боковой рейки: без уточнения тега
       меню показывало шестнадцать разделов вместо восьми, каждый
       дважды. */
    var узлы = d.querySelectorAll("section.rv-акт[data-акт]");
    for (var i = 0; i < узлы.length; i++) {
      var э = узлы[i];
      var имя = э.getAttribute("data-акт");
      var над = э.querySelector(".rv-над");
      var номер = над && над.querySelector("i") ? над.querySelector("i").textContent.trim() : "";
      var подпись = над && над.querySelector("span") ? над.querySelector("span").textContent.trim() : имя;
      из.push({ имя: имя, номер: номер || String(i + 1), подпись: подпись, узел: э });
    }
    return из;
  }

  /* ── Прокрутка к акту ───────────────────────────────────────
     Плавно и своим ходом, а не через кПунктy: тот ставит мгновенно и
     нужен приходу из космоса, где переход уже отыгран на той стороне.
     Здесь человек выбрал раздел сам и должен увидеть, куда его везут,
     иначе прыжок читается как перезагрузка страницы. */
  function кАкту(имя) {
    var э = d.querySelector('[data-акт="' + имя + '"]');
    if (!э) return;
    var к = э.getBoundingClientRect();
    var y = (g.pageYOffset || 0) + к.top;
    var мягко = true;
    try {
      мягко = !g.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {}
    try {
      g.scrollTo({ top: Math.round(y), behavior: мягко ? "smooth" : "auto" });
    } catch (e2) { g.scrollTo(0, Math.round(y)); }
    закрыть();
  }

  /* ── Разметка меню ──────────────────────────────────────────── */
  var панель = null, бургер = null, откуда = null;

  function строкаДействия(о) {
    return '<a class="rv-мп-дело' + (о.главное ? " гл" : "") + '" href="' + эк(о.адрес) + '"' +
      (о.вне ? ' target="_blank" rel="noopener noreferrer"' : "") +
      (о.ид ? ' id="' + эк(о.ид) + '"' : "") + ">" +
      '<span class="rv-мп-знак" aria-hidden="true">' + о.знак + "</span>" +
      "<span><b>" + эк(о.имя) + "</b>" +
      (о.под ? '<i>' + эк(о.под) + "</i>" : "") + "</span></a>";
  }

  /* Знаки рисуем контуром в стиле сайта. Эмодзи здесь нет намеренно:
     они у каждой системы свои и рядом с набранным текстом выглядят
     наклейкой. */
  var З = {
    проба:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v13"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/></svg>',
    вход:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3.5h4.5A1.5 1.5 0 0 1 20 5v14a1.5 1.5 0 0 1-1.5 1.5H14"/><path d="M10 16.5 14.5 12 10 7.5"/><path d="M14.5 12H3.5"/></svg>',
    письмо: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 6.5h17v11h-17z"/><path d="m3.5 7 8.5 6 8.5-6"/></svg>',
    космос: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17"/><path d="M12 3.5c2.4 2.6 2.4 14.4 0 17"/><path d="M12 3.5c-2.4 2.6-2.4 14.4 0 17"/></svg>',
    игра:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="7.5" width="19" height="10" rx="4"/><path d="M7 11v3M5.5 12.5h3"/><circle cx="16" cy="12" r=".9" fill="currentColor"/><circle cx="18.5" cy="14" r=".9" fill="currentColor"/></svg>',
    помощь: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 12.5A8.5 8.5 0 1 1 12 4a8.5 8.5 0 0 1 8.5 8.5Z"/><path d="M9.6 9.4a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.7-.9 1.3v.4"/><circle cx="12" cy="16.8" r=".9" fill="currentColor"/></svg>',
    тема:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M4.2 4.2l1.6 1.6M18.2 18.2l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.2 19.8l1.6-1.6M18.2 5.8l1.6-1.6"/></svg>'
  };

  /* ── Шапка ──────────────────────────────────────────────────
     Раньше органы стояли по углам поодиночке: бургер слева, вход
     справа, звук внизу. Три отдельных квадрата на пустом экране не
     читаются как управление сайтом - владелец сказал прямо: «шапка
     непонятная, где все кнопки».

     Шапка ВСЕГДА ТЁМНАЯ, в обеих темах. Это не небрежность к светлой:
     марка Rocket VPN набрана светлыми буквами и на светлом фоне
     пропадает. Подкладывать под неё отдельную подушку я пробовал -
     владелец назвал это некрасивым, и он прав: заплатка под логотипом
     видна как заплатка. Тёмная полоса сверху решает то же самое
     честно: логотип стоит на том фоне, под который нарисован, а полоса
     читается как приборная планка, а не как патч. */
  function шапку() {
    var ш = d.createElement("header");
    ш.className = "rv-шапка";
    ш.innerHTML =
      '<a class="rv-шапка-марка" href="#" aria-label="Rocket VPN, наверх">' +
        /* Марка КВАДРАТНАЯ, 256 на 256, и растягивать её нельзя ни на
           точку: в ней и знак, и набранное имя. Ширина с высотой
           равны по построению, а не на глаз. */
        '<img src="assets/rv-mark.webp" width="38" height="38" alt="Rocket VPN">' +
      "</a>" +
      '<div class="rv-шапка-право">' +
        /* Быстрые действия стоят в самой планке, а не только в
           бургере: владелец просил, чтобы форма, бот, игра и тема
           открывались одним касанием. Ряд один и тот же на телефоне и
           на ПК, на узком экране у него мельче шаг и меньше кнопки. */
        '<nav class="rv-шапка-органы" aria-label="Быстрые действия">' +
          '<a class="rv-орган" id="rvОрганФорма" href="#форма" aria-label="Написать нам">' + З.письмо + '</a>' +
          '<a class="rv-орган" id="rvОрганБот" href="' + СВЯЗЬ.бот + '" target="_blank" rel="noopener" aria-label="Забрать 3 дня в боте">' + З.проба + '</a>' +
          '<a class="rv-орган" id="rvОрганИгра" href="' + ИГРА + '" target="_blank" rel="noopener" aria-label="Играть, полёт в космосе Rocket CDN">' + З.игра + '</a>' +
          '<button class="rv-орган" id="rvОрганТема" type="button" aria-label="Сменить тему" aria-pressed="false">' + З.тема + '</button>' +
        '</nav>' +
      '</div>';
    d.body.appendChild(ш);
    ш.addEventListener("click", function (е) {
      var ф = е.target.closest ? е.target.closest("#rvОрганФорма") : null;
      if (ф) { е.preventDefault(); формаОткрыть(); return; }
      var т = е.target.closest ? е.target.closest("#rvОрганТема") : null;
      if (т) { поставитьТему(тема() === "светлая" ? "тёмная" : "светлая"); }
    });
    ш.querySelector(".rv-шапка-марка").addEventListener("click", function (е) {
      е.preventDefault();
      try { g.scrollTo({ top: 0, behavior: "smooth" }); } catch (e2) { g.scrollTo(0, 0); }
    });
    return ш.querySelector(".rv-шапка-право");
  }

  function собрать() {
    var право = шапку();
    /* Кнопку входа НЕ создаём заново, а переносим: она объявлена в
       разметке намеренно, чтобы работать и без скриптов. Создай мы
       вторую - на странице без скриптов осталась бы первая, а с ними
       обе. */
    var вход = d.getElementById("rvВход");
    if (вход) право.appendChild(вход);

    бургер = d.createElement("button");
    бургер.className = "rv-бургер";
    бургер.id = "rvБургер";
    бургер.type = "button";
    бургер.setAttribute("aria-label", "Меню сайта");
    бургер.setAttribute("aria-expanded", "false");
    бургер.setAttribute("aria-controls", "rvМеню");
    бургер.innerHTML = "<i></i><i></i><i></i>";
    право.appendChild(бургер);

    панель = d.createElement("nav");
    панель.className = "rv-меню";
    панель.id = "rvМеню";
    панель.setAttribute("aria-label", "Меню сайта");
    панель.hidden = true;

    var р = разделы();
    var список = р.map(function (а) {
      return '<button class="rv-мп-акт" type="button" data-к="' + эк(а.имя) + '">' +
        "<i>" + эк(а.номер) + "</i><span>" + эк(а.подпись) + "</span></button>";
    }).join("");

    var дела = [
      { знак: З.проба,  имя: "Забрать 3 дня",   под: "пробный период включается в боте", адрес: СВЯЗЬ.бот, вне: true, главное: true },
      { знак: З.вход,   имя: "Личный кабинет",  под: "для тех, кто уже подключён",       адрес: СВЯЗЬ.кабинет, вне: true },
      { знак: З.письмо, имя: "Написать нам",    под: "ответим на почту или в Телеграм",  адрес: "#форма", ид: "rvКФорме" },
      { знак: З.помощь, имя: "Поддержка",       под: "живой человек в Телеграме",        адрес: СВЯЗЬ.помощь, вне: true },
      { знак: З.космос, имя: "Открыть Rocket CDN", под: "сеть доставки, второй корабль флота", адрес: CDN, вне: true },
      { знак: З.игра,   имя: "Играть",          под: "полёт в космосе Rocket CDN",       адрес: ИГРА, вне: true }
    ].map(строкаДействия).join("");

    панель.innerHTML =
      '<div class="rv-мп-верх">' +
        '<img class="rv-мп-марка" src="assets/rv-mark.webp" width="40" height="40" alt="Rocket VPN">' +
        '<button class="rv-мп-закрыть" type="button" id="rvМенюЗакрыть" aria-label="Закрыть меню">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>' +
        "</button>" +
      "</div>" +
      '<div class="rv-мп-тело">' +
        '<p class="rv-мп-заг">Разделы</p>' +
        '<div class="rv-мп-акты">' + список + "</div>" +
        '<p class="rv-мп-заг">Действия</p>' +
        '<div class="rv-мп-дела">' + дела + "</div>" +
        '<button class="rv-мп-тема" type="button" id="rvТема" aria-pressed="false">' +
          '<span class="rv-мп-знак" aria-hidden="true">' + З.тема + "</span>" +
          "<span><b>Тема</b><i>сейчас <span class=\"rv-мп-знач\">тёмная</span></i></span>" +
        "</button>" +
      "</div>";
    d.body.appendChild(панель);

    var пелена = d.createElement("div");
    пелена.className = "rv-мп-пелена";
    пелена.id = "rvМенюПелена";
    пелена.hidden = true;
    d.body.appendChild(пелена);

    бургер.addEventListener("click", function () {
      d.documentElement.classList.contains("rv-меню-открыто") ? закрыть() : открыть();
    });
    d.getElementById("rvМенюЗакрыть").addEventListener("click", закрыть);
    пелена.addEventListener("click", закрыть);

    панель.addEventListener("click", function (е) {
      var а = е.target.closest ? е.target.closest(".rv-мп-акт") : null;
      if (а) { кАкту(а.getAttribute("data-к")); return; }
      var ф = е.target.closest ? е.target.closest("#rvКФорме") : null;
      if (ф) { е.preventDefault(); закрыть(); формаОткрыть(); return; }
      var т = е.target.closest ? е.target.closest("#rvТема") : null;
      if (т) { поставитьТему(тема() === "светлая" ? "тёмная" : "светлая"); return; }
      /* Обычная ссылка наружу закрывает меню за собой: вернувшись
         кнопкой «назад», человек не должен упереться в раскрытую
         панель поверх сайта. */
      if (е.target.closest && е.target.closest(".rv-мп-дело")) закрыть();
    });

    d.addEventListener("keydown", function (е) {
      if (е.key !== "Escape") return;
      if (d.documentElement.classList.contains("rv-форма-открыта")) { формаЗакрыть(); return; }
      if (d.documentElement.classList.contains("rv-меню-открыто")) закрыть();
    });
    поставитьТему(тема());
  }

  function открыть() {
    откуда = d.activeElement;
    панель.hidden = false;
    d.getElementById("rvМенюПелена").hidden = false;
    /* Кадр перед подъёмом признака: узел, только что переставший быть
       hidden, не анимируется - браузер считает это первой отрисовкой,
       и панель появлялась рывком вместо выезда. */
    g.requestAnimationFrame(function () {
      d.documentElement.classList.add("rv-меню-открыто");
      бургер.setAttribute("aria-expanded", "true");
      var п = панель.querySelector(".rv-мп-акт");
      if (п) п.focus();
    });
  }

  function закрыть() {
    if (!панель || панель.hidden) return;
    d.documentElement.classList.remove("rv-меню-открыто");
    бургер.setAttribute("aria-expanded", "false");
    setTimeout(function () {
      панель.hidden = true;
      d.getElementById("rvМенюПелена").hidden = true;
    }, 320);
    if (откуда && откуда.focus) { try { откуда.focus(); } catch (e) {} }
  }

  /* ── Форма обратной связи ───────────────────────────────────
     Уходит туда же, куда заявки Rocket CDN, с пометкой площадки: свод
     по двум сайтам считается в одной панели, и второе хранилище
     означало бы две правды.

     Поля ровно три и согласие. Каждое лишнее поле в форме это минус
     часть ответов, а имя, способ связи и суть вопроса это тот минимум,
     без которого ответить нельзя. */
  var форма = null;

  function формаСобрать() {
    форма = d.createElement("div");
    форма.className = "rv-форма";
    форма.id = "rvФорма";
    форма.hidden = true;
    форма.setAttribute("role", "dialog");
    форма.setAttribute("aria-modal", "true");
    форма.setAttribute("aria-labelledby", "rvФормаЗаг");
    форма.innerHTML =
      '<form class="rv-форма-плита" id="rvФормаВид" novalidate>' +
        '<button class="rv-мп-закрыть" type="button" id="rvФормаЗакрыть" aria-label="Закрыть форму">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m6 6 12 12M18 6 6 18"/></svg>' +
        "</button>" +
        '<h2 class="rv-форма-заг" id="rvФормаЗаг">Написать нам</h2>' +
        '<p class="rv-форма-под">Отвечаем на почту или в Телеграм. Обычно в тот же день.</p>' +
        '<label class="rv-поле"><span>Как к вам обращаться</span>' +
          '<input name="name" type="text" autocomplete="name" maxlength="80" required></label>' +
        '<label class="rv-поле"><span>Почта, телефон или ник в Телеграме</span>' +
          '<input name="contact" type="text" autocomplete="email" maxlength="120" required></label>' +
        '<label class="rv-поле"><span>Что нужно</span>' +
          '<textarea name="task" rows="3" maxlength="2000"></textarea></label>' +
        /* Ловушка для роботов. Скрыта от глаза и от чтения с экрана, из
           обхода по табу выведена: живой человек её не заполнит никогда,
           а робот заполняет всё подряд. */
        '<div class="rv-ловушка" aria-hidden="true">' +
          '<label>Сайт<input name="website" type="text" tabindex="-1" autocomplete="off"></label></div>' +
        '<label class="rv-согласие"><input name="consent" type="checkbox" required>' +
          '<span>Согласен на обработку данных для ответа на обращение</span></label>' +
        '<p class="rv-форма-беда" id="rvФормаБеда" role="alert" hidden></p>' +
        '<button class="rv-кн rv-кн-гл" type="submit" id="rvФормаСлать">Отправить</button>' +
      "</form>";
    d.body.appendChild(форма);

    d.getElementById("rvФормаЗакрыть").addEventListener("click", формаЗакрыть);
    форма.addEventListener("click", function (е) { if (е.target === форма) формаЗакрыть(); });
    d.getElementById("rvФормаВид").addEventListener("submit", формаСлать);
  }

  function формаОткрыть() {
    if (!форма) формаСобрать();
    форма.hidden = false;
    g.requestAnimationFrame(function () {
      d.documentElement.classList.add("rv-форма-открыта");
      var п = форма.querySelector('input[name="name"]');
      if (п) п.focus();
    });
  }

  function формаЗакрыть() {
    if (!форма || форма.hidden) return;
    d.documentElement.classList.remove("rv-форма-открыта");
    setTimeout(function () { форма.hidden = true; }, 260);
  }

  function беда(текст) {
    var э = d.getElementById("rvФормаБеда");
    if (!э) return;
    э.textContent = текст;
    э.hidden = !текст;
  }

  function формаСлать(е) {
    е.preventDefault();
    var ф = е.target;
    var имя = ф.name.value.trim();
    var связь = ф.contact.value.trim();
    if (!имя) { беда("Скажите, как к вам обращаться."); ф.name.focus(); return; }
    if (!связь) { беда("Нужен способ связи: почта, телефон или ник."); ф.contact.focus(); return; }
    if (!ф.consent.checked) { беда("Без согласия на обработку мы не сможем ответить."); ф.consent.focus(); return; }
    беда("");
    var кн = d.getElementById("rvФормаСлать");
    кн.disabled = true;
    кн.textContent = "Отправляем…";
    fetch(API + "?action=lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "omit",
      body: JSON.stringify({
        site: "vpn", name: имя, contact: связь,
        task: ф.task.value.trim(), website: ф.website.value,
        consent: 1, page: location.pathname
      })
    }).then(function (о) { return о.json(); }).then(function (о) {
      if (о && о.ok) {
        ф.innerHTML = '<h2 class="rv-форма-заг">Приняли</h2>' +
          '<p class="rv-форма-под">Ответим на указанный контакт. Спасибо, что написали.</p>' +
          '<button class="rv-кн rv-кн-гл" type="button" id="rvФормаГотово">Закрыть</button>';
        d.getElementById("rvФормаГотово").addEventListener("click", формаЗакрыть);
        try { if (g.RV_СЧЁТ) g.RV_СЧЁТ["событие"]("заявка", "меню"); } catch (e) {}
        return;
      }
      кн.disabled = false; кн.textContent = "Отправить";
      беда(о && о.error === "contact" ? "Проверьте способ связи: похоже, там опечатка."
         : о && о.error === "too_many" ? "Слишком много обращений подряд. Попробуйте позже."
         : "Не отправилось. Попробуйте ещё раз или напишите в поддержку.");
    }).catch(function () {
      кн.disabled = false; кн.textContent = "Отправить";
      беда("Сеть не ответила. Попробуйте ещё раз или напишите в поддержку.");
    });
  }

  /* Меню собираем после разметки: разделы читаются с экрана, и до
     готовности документа их там нет. */
  function старт() { собрать(); }
  if (d.readyState === "loading") d.addEventListener("DOMContentLoaded", старт);
  else старт();

  g.RV_МЕНЮ = {
    "открыть": открыть, "закрыть": закрыть,
    "форма": формаОткрыть,
    "тема": тема, "поставитьТему": поставитьТему
  };

  /* Наружу отдаём краски и саму тему: холсты спрашивают их при сборке
     и переспрашивают по событию смены. */
  g.RV_ТЕМА = {
    "имя": тема,
    "краски": function () { return КРАСКИ[тема()] || КРАСКИ["тёмная"]; }
  };
})(window, document);
