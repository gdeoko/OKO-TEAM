5);
      dodge.y += (w3.tmpA.y >= 0 ? lift : -lift);
      if (!hit) { hit = bs[i]; worst = Math.max(worst, 0.4); }
    }
  }

  /* Смещение стекает само: за пределами зоны корабль возвращается
     на маршрут, и следующий заход по той же дуге снова честный */
  dodge.multiplyScalar(1 - Math.min(1, dt * 1.1));
  if (dodge.lengthSq() > 1e-4) cam.position.add(dodge);

  /* Предупреждение на табло: манёвр видно, а не только чувствуется.
     Один сигнал на заход - повторное пиканье каждый кадр раздражает. */
  if (hit && worst > 0.12) {
    if (!dodgeWarn) {
      dodgeWarn = 1;
      say(RU ? "МАНЁВР ОБХОДА · " + hit.name : "AVOIDANCE · " + hit.name, 1600);
      if (g.RC_SOUND) { try { (g.RC_SOUND.uiConfirm || g.RC_SOUND.blip).call(g.RC_SOUND, 220); } catch (e) {} }
    }
    F.shake = Math.max(F.shake, worst * 0.5);
  } else if (dodgeWarn && worst < 0.05) dodgeWarn = 0;
}

/* ── Развёртывание сети ──────────────────────────────────────
   Игра должна быть про продукт, а не просто про красивый космос.
   Rocket CDN - это сеть узлов рядом с людьми, поэтому здесь у игры
   появляется цель: долететь до мира и развернуть на нём узел.

   Механика простая и честная: встал на орбиту тела - кнопка на
   пульте оживает; нажал - с корабля уходит луч, на планете
   загорается узел, между узлами протягиваются линии связи. Счётчик
   на табло показывает, сколько миров уже в сети. Список хранится
   между заходами, как и журнал исследователя. */
var NET_KEY = "rcdn.net";
var net = {};
try { net = JSON.parse(localStorage.getItem(NET_KEY) || "{}") || {}; } catch (e) { net = {}; }

var netNodes = [], netLine = null, netBeam = null, netBeamT = 0;

function netCount() { return Object.keys(net).length; }

function netPaint() {
  if (!ui.net) return;
  var n = netCount(), total = NET_TOTAL();
  ui.net.textContent = Math.min(n, total) + "/" + total;
  ui.net.classList.toggle("full", n >= total);
}

/* Кнопка развёртывания живёт на пульте и включается только там, где
   есть что разворачивать: на орбите тела, которое ещё не в сети */
function netButton() {
  if (!ui.deploy) return;
  var here = F.orbit && F.orbit.name;
  var can = !!here && !net[here];
  ui.deploy.classList.toggle("on", can);
  /* Правим ТОЛЬКО подпись: textContent затирал иконку и превращал
     клавишу в пустой прямоугольник */
  var dc = ui.deploy.querySelector("b");
  if (dc) dc.textContent = RU ? "УЗЕЛ" : "NODE";
  ui.deploy.setAttribute("title", can
    ? (RU ? "Развернуть узел сети: " : "Deploy node: ") + here
    : (RU ? "Узел ставится на орбите тела" : "Deploy in orbit"));
}

function netMark(pos, name) {
  var T = g.THREE;
  if (!W3) return;
  var s = new T.Sprite(new T.SpriteMaterial({
    map: glowSprite(64, "rgba(159,224,246,1)", "rgba(66,178,220,0)"),
    transparent: true, depthWrite: false, blending: T.AdditiveBlending,
    opacity: 0.8
  }));
  s.position.copy(pos);
  /* Метка узла мельче прежней втрое. Раньше она была размером с
     половину планеты и закрывала собой то самое тело, на котором
     стоит: в кадре оставалось белое пятно вместо Земли. */
  s.scale.setScalar(6);
  s.userData.info = (RU ? "УЗЕЛ СЕТИ · " : "NETWORK NODE · ") + name;
  W3.scene.add(s);
  netNodes.push({ s: s, p: pos.clone(), name: name });

  /* Линии связи между узлами: сеть должна выглядеть сетью */
  if (netNodes.length > 1) {
    if (netLine) W3.scene.remove(netLine);
    var pts = [];
    for (var i = 0; i < netNodes.length; i++) {
      for (var j = i + 1; j < netNodes.length; j++) {
        /* Соединяем только соседей: полный граф на десятке узлов
           превращается в паутину поперёк всего неба */
        if (netNodes[i].p.distanceTo(netNodes[j].p) > 1400) continue;
        pts.push(netNodes[i].p, netNodes[j].p);
      }
    }
    if (pts.length) {
      var geo = new g.THREE.BufferGeometry().setFromPoints(pts);
      netLine = new g.THREE.LineSegments(geo, new g.THREE.LineBasicMaterial({
        color: 0x42b2dc, transparent: true, opacity: 0.34, depthWrite: false, blending: g.THREE.AdditiveBlending
      }));
      W3.scene.add(netLine);
    }
  }
}

function deployNode() {
  if (!W3 || !F.orbit || !F.orbit.name) return;
  var name = F.orbit.name;
  if (net[name]) return;
  /* Узел стоит заряда: это и делает выбор выбором - на дальний
     рубеж или на прыжок, но не на всё сразу */
  if (!spend(14, RU ? "развёртывание узла" : "node deploy")) return;
  net[name] = 1;
  try { localStorage.setItem(NET_KEY, JSON.stringify(net)); } catch (e) {}

  /* Луч развёртывания: от корабля к телу, живёт полсекунды */
  var T = g.THREE;
  if (netBeam) W3.scene.remove(netBeam);
  var geo = new T.BufferGeometry().setFromPoints([W3.cam.position.clone(), F.orbit.c.clone()]);
  netBeam = new T.Line(geo, new T.LineBasicMaterial({
    color: 0x9fe0f6, transparent: true, opacity: 0.95, depthWrite: false, blending: T.AdditiveBlending
  }));
  W3.scene.add(netBeam);
  netBeamT = 0.65;

  netMark(F.orbit.c, name);
  trafBuild();
  netPaint();
  netButton();

  /* Узел закрыл висящий запрос - это и есть победа в игре: трафик
     пришёл туда, где его ждали */
  var closed = req && req.name === name;
  if (closed) { req = null; F.served = (F.served || 0) + 1; }
  say((closed ? (RU ? "ЗАПРОС ЗАКРЫТ · " : "REQUEST SERVED · ")
              : (RU ? "УЗЕЛ РАЗВЁРНУТ · " : "NODE DEPLOYED · ")) + name + " · " +
      (RU ? "в сети " : "in network ") + netCount(), 2600);
  if (g.RC_SOUND) {
    try {
      (g.RC_SOUND.uiConfirm || g.RC_SOUND.blip).call(g.RC_SOUND);
      setTimeout(function () { if (g.RC_SOUND.blip) g.RC_SOUND.blip(880); }, 180);
    } catch (e2) {}
  }
  if (netCount() >= NET_TOTAL()) {
    setTimeout(function () {
      say(RU ? "СЕТЬ РАЗВЁРНУТА ПОЛНОСТЬЮ · ВСЕ МИРЫ НА СВЯЗИ" : "NETWORK COMPLETE", 4200);
    }, 2800);
  }

  /* Порог открытия новых рукавов: сообщаем ровно в тот момент,
     когда очередная вселенная стала доступна, и обновляем меню */
  for (var ui3 = 0; ui3 < UNIVERSES.length; ui3++) {
    var uu2 = UNIVERSES[ui3];
    if (uu2.need && netCount() === uu2.need) {
      setTimeout(function (nm) {
        return function () {
          say((RU ? "ОТКРЫТ НОВЫЙ РУКАВ · " : "NEW ARM UNLOCKED · ") + nm, 4000);
          if (g.RC_SOUND && g.RC_SOUND.hyper) { try { g.RC_SOUND.hyper(); } catch (e4) {} }
        };
      }(uu2.name), 2900);
    }
  }
  if (ui.uni) {
    var btns = ui.uni.querySelectorAll("button[data-uni]");
    for (var bi2 = 0; bi2 < btns.length; bi2++) {
      var uv = UNIVERSES[parseInt(btns[bi2].getAttribute("data-uni"), 10)];
      btns[bi2].classList.toggle("locked", !!(uv && uv.need && netCount() < uv.need));
    }
  }
}

/* ── Запросы на трафик ───────────────────────────────────────
   Сеть без нагрузки - просто точки на карте. Чтобы игра говорила о
   продукте, миру нужен спрос: время от времени на каком-нибудь теле
   без узла случается всплеск трафика. Табло сообщает, откуда
   запрос, метка этого мира начинает пульсировать, и у человека
   появляется понятная задача - долететь и развернуть узел.

   Наказания нет намеренно: это витрина, а не соревнование. Не
   успел - запрос уходит, но ничего не отнимается. */
var req = null;               /* {name, until, sys, pl} */
var reqNext = 0;

function reqPick() {
  /* Ищем мир без узла: в родной системе это тела маршрута, в чужой -
     планеты текущего рукава */
  var list = [];
  if (uniIdx === 0) {
    var names = [GOAL_NAMES.earth, GOAL_NAMES.moon, GOAL_NAMES.mars, GOAL_NAMES.saturn,
                 GOAL_NAMES.mercury, GOAL_NAMES.venus, GOAL_NAMES.jupiter,
                 GOAL_NAMES.uranus, GOAL_NAMES.neptune, GOAL_NAMES.hole];
    for (var i = 0; i < names.length; i++) if (!net[names[i]]) list.push({ name: names[i] });
  } else {
    var u = UNIVERSES[uniIdx];
    for (var s = 0; s < u.sys.length; s++) {
      for (var p = 0; p < u.sys[s].planets.length; p++) {
        var nm = u.sys[s].planets[p].name;
        if (!net[nm]) list.push({ name: nm, sys: s, pl: p });
      }
    }
  }
  if (!list.length) return null;
  /* Псевдослучайный выбор по времени: своего генератора здесь не
     нужно, важно лишь чтобы цель менялась */
  return list[Math.floor((performance.now() / 997) % list.length)];
}

function reqTick(ts) {
  if (F.brief) return;
  if (req && ts > req.until) {
    say((RU ? "ЗАПРОС УШЁЛ · " : "REQUEST LOST · ") + req.name, 2200);
    req = null;
    reqNext = ts + 18000;
    return;
  }
  if (req || ts < reqNext) return;
  var pick = reqPick();
  if (!pick) { reqNext = ts + 30000; return; }
  req = { name: pick.name, sys: pick.sys, pl: pick.pl, until: ts + 62000 };
  say((RU ? "ЗАПРОС ТРАФИКА · " : "TRAFFIC SURGE · ") + pick.name +
      (RU ? " · нужен узел" : " · node needed"), 3400);
  if (g.RC_SOUND) { try { (g.RC_SOUND.uiConfirm || g.RC_SOUND.blip).call(g.RC_SOUND, 660); } catch (e) {} }
}

/* ── Голограммы: связка сцены и слоя меток ───────────────────
   Метка заводится один раз на объект и дальше только переставляется.
   Что показываем: тела текущей вселенной, узлы сети и галактики.
   Далёкое прячем - двадцать подписей на экране это уже не кино, а
   таблица. */
var holoReady = false, holoIds = {};
function holoSetup() {
  if (holoReady || !g.RC_HOLO || !ui.wrap) return;
  holoReady = true;
  try {
    /* Метки объектов живут на стекле, а не поверх всей кабины: слой
       вкладывается в приборы окна и обрезается его границами. Иначе
       подпись планеты вылезала на корпус, чего в корабле быть не
       может. */
    g.RC_HOLO.init(ui.hud || ui.wrap);
    g.RC_HOLO.onPick(function (id) {
      /* Клик по голограмме - это курс на объект. Ровно то, чего
         ждёшь от метки в кабине: ткнул и полетел. */
      var rec = holoIds[id];
      if (!rec) return;
      if (rec.sys !== undefined) goSystem(rec.sys, rec.pl);
      else if (rec.goal) goTo(rec.goal);
      if (g.RC_SOUND) { try { (g.RC_SOUND.uiConfirm || g.RC_SOUND.blip).call(g.RC_SOUND); } catch (e) {} }
    });
  } catch (e) { holoReady = false; }
}

function holoList(w3) {
  /* Список меток пересобираем при смене вселенной: в чужом рукаве
     свои планеты, и Земля там не при чём */
  var out = [];
  if (uniIdx === 0) {
    out.push({ id: "h-earth", o: w3.earth, title: RU ? "ЗЕМЛЯ" : "EARTH",
               sub: RU ? "ДОМ · 218 УЗЛОВ" : "HOME · 218 NODES", kind: "planet", goal: "earth",
               info: RU ? "Единственная планета с Rocket CDN. Отсюда расходится вся сеть." : "The only planet with Rocket CDN." });
    out.push({ id: "h-moon", o: w3.moon, title: RU ? "ЛУНА" : "MOON",
               sub: RU ? "РЕЗЕРВ · 384 400 КМ" : "BACKUP", kind: "station", goal: "moon",
               info: RU ? "Точка ретрансляции: сигнал доходит за 1,3 секунды." : "Relay point: 1.3 s of light travel." });
    out.push({ id: "h-mars", o: w3.mars, title: RU ? "МАРС" : "MARS",
               sub: RU ? "ХОЛОДНЫЙ КЭШ" : "COLD CACHE", kind: "planet", goal: "mars",
               info: RU ? "Дальний рубеж сети. Задержка до Земли - 3 до 22 минут." : "Far edge of the network." });
    out.push({ id: "h-saturn", o: w3.saturn, title: RU ? "САТУРН" : "SATURN",
               sub: RU ? "КОЛЬЦА · 282 000 КМ" : "RINGS", kind: "planet", goal: "saturn",
               info: RU ? "Кольца шириной в семь Земель, толщиной в десять метров." : "Rings seven Earths wide, ten metres thick." });
    out.push({ id: "h-hole", o: w3.hole, title: RU ? "ЧЁРНАЯ ДЫРА" : "BLACK HOLE",
               sub: RU ? "ГОРИЗОНТ СОБЫТИЙ" : "EVENT HORIZON", kind: "warn", goal: "hole",
               info: RU ? "Дальше не возвращаются даже пакеты. Держим дистанцию." : "Not even packets come back." });
  } else {
    var pack = built[uniIdx];
    if (!pack) return out;
    var u = UNIVERSES[uniIdx];
    for (var s = 0; s < u.sys.length; s++) {
      var sg = pack.root.children[s];
      if (!sg) continue;
      out.push({ id: "h-s" + s, o: sg, title: u.sys[s].name,
                 sub: RU ? "ЗВЁЗДНАЯ СИСТЕМА" : "STAR SYSTEM", kind: "gate", sys: s,
                 info: (RU ? "Планет в системе: " : "Planets: ") + u.sys[s].planets.length });
      var groups = [];
      for (var c = 0; c < sg.children.length; c++) {
        if (sg.children[c].userData && sg.children[c].userData.planet !== undefined) {
          groups[sg.children[c].userData.planet] = sg.children[c];
        }
      }
      for (var p = 0; p < u.sys[s].planets.length; p++) {
        if (!groups[p]) continue;
        var pl = u.sys[s].planets[p];
        out.push({ id: "h-p" + s + "-" + p, o: groups[p], title: pl.name,
                   sub: u.sys[s].name, kind: "planet", sys: s, pl: p, info: pl.info });
      }
    }
  }
  return out;
}

var holoUni = -1, holoFull = false;

/* Сколько миров чужой вселенной уже родилось. Планеты досыпаются
   порциями (buildLater), поэтому в момент прыжка их в группе ещё
   нет: список меток, собранный тогда же, оказывался пустым и больше
   не пересобирался - в чужом рукаве не было ни одной подписи.
   Считаем, пока вселенная не соберётся целиком, потом перестаём. */
function holoGrown() {
  var pack = built[uniIdx], u = UNIVERSES[uniIdx];
  if (!pack || !pack.root || !u) return -1;
  var n = 0;
  for (var s = 0; s < pack.root.children.length; s++) {
    var sg = pack.root.children[s];
    for (var c = 0; c < sg.children.length; c++) {
      if (sg.children[c].userData && sg.children[c].userData.planet !== undefined) n++;
    }
  }
  return n;
}

function holoTotal() {
  var u = UNIVERSES[uniIdx], n = 0;
  if (!u || !u.sys) return 0;
  for (var s = 0; s < u.sys.length; s++) n += u.sys[s].planets.length;
  return n;
}

var holoSeen = -1;
function holoFrame(w3, ts) {
  /* В салоне подписей объектов быть не должно: мы ещё не в полёте,
     а сидим в корабле, и метки «ЛУНА», «МАРС» поверх стен читаются
     чужим слоем поверх помещения. Они зажигаются вместе с
     остальными приборами - в момент старта. */
  if (F.stage) {
    if (holoReady && g.RC_HOLO && g.RC_HOLO.clear) { try { g.RC_HOLO.clear(); } catch (e) {} }
    return;
  }
  holoSetup();
  if (!holoReady) return;

  /* Пересобрать нужно и при смене вселенной, и когда в ней прибыло
     миров: метка привязана к конкретной группе, а группы приходят
     не разом */
  var grew = false;
  if (uniIdx !== 0 && !holoFull) {
    var have = holoGrown();
    if (have !== holoSeen) { holoSeen = have; grew = true; }
    if (have >= holoTotal() && have > 0) holoFull = true;
  }
  if (holoUni !== uniIdx || grew) {
    if (holoUni !== uniIdx) { holoFull = false; holoSeen = -1; }
    holoUni = uniIdx;
    try { g.RC_HOLO.clear(); } catch (e) {}
    holoIds = {};
    var list = holoList(w3);
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      holoIds[it.id] = it;
      try {
        g.RC_HOLO.add(it.id, { title: it.title, subtitle: it.sub, info: it.info, kind: it.kind });
      } catch (e2) {}
    }
  }

  var cam = w3.cam;
  /* На телефоне экран узкий: держим в кадре только ближайшие метки,
     иначе подписи перекрывают и друг друга, и вид из окна */
  var limit = innerWidth < 760 ? 3 : 8, shown = 0;
  /* Куда уже поставлены метки. rc-holo умеет разводить карточки по
     вертикали, но когда два мира проецируются в одну и ту же точку
     (соседние планеты чужой системы с большой дистанции), разводить
     нечего: подписи ложатся друг на друга. Такие метки честнее не
     показывать вовсе - долететь всё равно можно по кнопке в пульте. */
  if (!holoFrame._px) { holoFrame._px = []; holoFrame._py = []; }
  var pxs = holoFrame._px, pys = holoFrame._py, pn = 0;
  /* Порог не круглый, а по форме карточки: она вытянута вправо на
     две сотни пикселей и высотой в три десятка. Круг радиусом в
     полсотни пропускал пары, стоящие в строку, - их подписи и
     наезжали друг на друга. */
  var gapX = 190, gapY = 46;
  var order = [];
  for (var oid in holoIds) {
    if (!holoIds.hasOwnProperty(oid) || !holoIds[oid].o) continue;
    w3.tmpA.setFromMatrixPosition(holoIds[oid].o.matrixWorld);
    order.push([oid, cam.position.distanceTo(w3.tmpA)]);
  }
  order.sort(function (a, b) { return a[1] - b[1]; });

  for (var oi = 0; oi < order.length; oi++) {
    var id = order[oi][0];
    var rec = holoIds[id];
    if (!rec.o) continue;
    w3.tmpA.setFromMatrixPosition(rec.o.matrixWorld);
    var dist = cam.position.distanceTo(w3.tmpA);
    w3.tmpA.project(cam);
    /* Прячем то, что за спиной, за краем кадра или слишком далеко:
       метка имеет смысл, пока объект в кадре и до него можно долететь */
    /* Предел видимости подобран по читаемости, а не по дальности.
       Карточка ужимается пропорционально глубине, и на двух с
       половиной тысячах единиц от неё оставалась полоска с
       нечитаемым текстом - в кадре висел пустой прямоугольник.
       Дальше этого рубежа метку честнее не показывать вовсе. */
    var vis = w3.tmpA.z < 1 && dist < 1900 &&
              w3.tmpA.x > -1.05 && w3.tmpA.x < 1.05 && w3.tmpA.y > -1.05 && w3.tmpA.y < 1.05;
    var sx = (w3.tmpA.x * 0.5 + 0.5) * innerWidth;
    var sy = (-w3.tmpA.y * 0.5 + 0.5) * innerHeight;
    /* Крупное тело вплотную: его центр уходит за край кадра, а сама
       планета занимает пол-экрана. Метку в этом случае не прячем, а
       прижимаем к краю - иначе подпись у Земли пропадала именно
       тогда, когда Земля перед носом. Поля берём с запасом под
       рамку кокпита. */
    /* Поля берём под переплёт кабины: на телефоне рамка съедает по
       седьмой части ширины с каждой стороны, и метка, прижатая к
       краю кадра, уходила под стойку - подпись обрывалась.

       Справа поле особое. Карточка голограммы висит НА выноске
       вправо от точки крепления и занимает свои 214 пикселей плюс
       рычаг; на четырёхсотпиксельном экране метка, поставленная
       по центру планеты, уезжала половиной текста за кадр -
       «ЗЕМЛЯ» обрывалась ровно посередине. Считаем правое поле по
       фактической ширине карточки, а не симметрично левому. */
    var narrow = innerWidth < 760;
    var padX = Math.max(56, innerWidth * (narrow ? 0.16 : 0.12));
    var padY = Math.max(90, innerHeight * (narrow ? 0.16 : 0.14));
    var padR = Math.min(innerWidth * 0.62, narrow ? 258 : 300);
    if (padR < padX + 40) padR = padX + 40;
    sx = Math.max(padX, Math.min(innerWidth - padR, sx));
    sy = Math.max(padY, Math.min(innerHeight - padY * 1.6, sy));
    /* Глубина метки: ноль вплотную, дальше метка мельчает. Потолок
       держим на 0.55 - при большей глубине rc-holo ужимает карточку
       больше чем на треть, и подпись перестаёт читаться. Пусть
       дальняя метка будет просто чуть меньше ближней. */
    var depth = Math.max(0, Math.min(0.55, (dist - 120) / 2600));
    var on = vis && !F.brief && shown < limit;
    if (on) {
      /* Ближние метки идут первыми (список отсортирован), поэтому
         прячется всегда дальняя из пары - так и правильно */
      for (var pj = 0; pj < pn; pj++) {
        var gdx = pxs[pj] - sx, gdy = pys[pj] - sy;
        if (gdx < 0) gdx = -gdx;
        if (gdy < 0) gdy = -gdy;
        if (gdx < gapX && gdy < gapY) { on = false; break; }
      }
    }
    if (on) { pxs[pn] = sx; pys[pn] = sy; pn++; shown++; }
    try { g.RC_HOLO.place(id, sx, sy, depth, on); } catch (e3) {}

    /* Мир, откуда пришёл запрос трафика, подсвечиваем той же
       подсветкой, что и захват сканера: цель должна быть видна
       глазом, а не только в титрах */
    var wanted = !!(req && rec.title === req.name);
    if (wanted !== rec.lit) {
      rec.lit = wanted;
      try { g.RC_HOLO.hover(id, wanted); } catch (e4) {}
    }
  }
}

function frame(ts) {
  if (!F.open) return;
  F.raf = requestAnimationFrame(frame);
  /* В режиме сцены кадр стоит: камера едет только за прокруткой, и
     тридцати кадров хватает с запасом. Полные шестьдесят жгли
     телефон ровно там, где человек читает вопросы. */
  if (F.stage) {
    /* Shared cadence keeps the premium finale at 60 fps when the
       device can sustain it, instead of forcing a 30 fps ceiling. */
    var stageMin = g.RC_MOTION ? g.RC_MOTION.minFrame() : 16;
    if (F._stageT && ts - F._stageT < stageMin - 1) return;
    F._stageT = ts;
  }
  var dt = F.last ? Math.min(0.05, (ts - F.last) / 1000) : 0.016;
  F.last = ts;
  var T = g.THREE, w3 = W3;

  /* Тяга и инерция. В гиперпрыжке корабль сам держит ход: прыжок
     не должен обрываться на полпути из-за уставшего пальца. */
  /* Зона гиперпрыжка живёт только на маршруте родной системы. В
     чужом рукаве маршрутной кривой нет, а F.p остаётся там, где его
     бросили: без этой проверки в чужой вселенной внезапно включался
     звёздный туннель и корабль сам набирал крейсерскую тягу. */
  /* В режиме сцены корабль стоит у Земли: ни разгона, ни автопилота,
     ни целей. Двигается только доля подъезда, и её ведёт прокрутка
     страницы, а не тяга. */
  if (F.stage) { F.v = 0; F.p = 0; F.goal = null; F.auto = false; F.orbit = null; F.brief = false; }
  var jumpZone = !F.away &&
    (W3.at ? (F.p > W3.at.jump0 && F.p < W3.at.jump1) : (F.p > 0.74 && F.p < 0.86));
  if (jumpZone && F.v < 0.11) F.v += (0.11 - F.v) * Math.min(1, dt * 2);

  if (F.goal !== null && F.goal !== undefined) {
    /* Навигация к цели: тяга по расстоянию, у места сама тормозит.
       Работает в обе стороны - к Марсу можно и вернуться. */
    var dp = F.goal - F.p;
    if (Math.abs(dp) < 0.006) {
      F.goal = null; F.v *= 0.3;
      /* Прибыли к телу - выходим на орбиту вокруг него */
      var ob = ORBITS[F.goalId];
      var tgt = F.goalId && w3[F.goalId === "hole" ? "hole" : F.goalId];
      if (ob && tgt) {
        /* Имя берём читаемое: оно уходит и в титры, и на кнопку
           развёртывания узла, где «moon» вместо «ЛУНА» смотрелось
           отладочным мусором */
        F.orbit = { c: tgt.position, r: ob.r, y: ob.y, a: null,
                    name: GOAL_NAMES[F.goalId] || F.goalId };
        if (g.RC_SOUND) { try { (g.RC_SOUND.uiConfirm || g.RC_SOUND.blip).call(g.RC_SOUND); } catch (e2) {} }
      }
    }
    else {
      var wantV = Math.max(-0.14, Math.min(0.14, dp * 1.1 + (dp > 0 ? 0.02 : -0.02)));
      F.v += (wantV - F.v) * Math.min(1, dt * 3);
    }
  } else if (F.auto && !F.brief && F.p < 0.999) {
    /* Автопилот: спокойная крейсерская, чтобы просто смотреть кино */
    var cruise = jumpZone ? 0.11 : 0.03;
    F.v += (cruise - F.v) * Math.min(1, dt * 0.55);
  } else {
    /* Ручной режим. Ползунок тяги держит ход: отпустил на половине -
       идём на половине, как у настоящего РУД. Колесо и свайп дают
       импульс поверх, который сам стекает к уровню ползунка. */
    var thr = F.thr || 0;
    var hold = thr * thr * 0.26;
    F.v = hold + (F.v - hold) * Math.pow(0.14, dt);
  }
  F.v = Math.max(-0.2, Math.min(0.3, F.v));
  F.p += F.v * dt;
  if (F.p < 0) { F.p = 0; F.v = 0; }
  if (F.p > 1) { F.p = 1; F.v = 0; }

  /* Подсветка текущей цели в навигации */
  if (ui.nav && w3.at && (frame._navT || 0) < ts - 300) {
    frame._navT = ts;
    var seg = "earth";
    if (F.p > 0.06 && F.p <= (w3.at.mars + w3.at.moon) / 2) seg = "moon";
    else if (F.p > (w3.at.mars + w3.at.moon) / 2 && F.p <= (w3.at.saturn + w3.at.mars) / 2) seg = "mars";
    else if (F.p > (w3.at.saturn + w3.at.mars) / 2 && F.p <= (w3.at.hole + w3.at.saturn) / 2) seg = "saturn";
    else if (F.p > (w3.at.hole + w3.at.saturn) / 2 && F.p <= w3.at.jump0) seg = "hole";
    else if (F.p > w3.at.jump0 && F.p <= w3.at.jump1) seg = "galaxy";
    else if (F.p > w3.at.jump1) seg = "home";
    if (frame._seg !== seg) {
      frame._seg = seg;
      var bs = ui.nav.querySelectorAll("button");
      for (var bi = 0; bi < bs.length; bi++) {
        bs[bi].classList.toggle("cur", bs[bi].getAttribute("data-goal") === seg);
      }
    }
  }

  /* Камера по кривой - или по орбите вокруг выбранного тела */
  if (F.orbit) {
    var o = F.orbit;
    if (o.a === null) {
      /* Первый кадр орбиты: угол берём из фактического положения,
         чтобы вход был без телепорта */
      o.a = Math.atan2(w3.cam.position.z - o.c.z, w3.cam.position.x - o.c.x);
      o.blend = 0;
    }
    o.a += dt * 0.16;
    o.blend = Math.min(1, (o.blend || 0) + dt * 0.7);
    w3.tmpB.set(o.c.x + Math.cos(o.a) * o.r, o.c.y + o.y, o.c.z + Math.sin(o.a) * o.r);

    /* Подлёт и сам виток - разные движения. Раньше на оба работал
       один лерп: от соседней системы он тянул камеру часами, и
       корабль будто застревал на полпути. Теперь пока до точки
       витка далеко, идём настоящим ходом с разгоном, и только у
       цели переходим на плавное круговое движение. */
    var far = w3.cam.position.distanceTo(w3.tmpB);
    o._far = far > 60;
    if (far > 60) {
      w3.tmpA.copy(w3.tmpB).sub(w3.cam.position).normalize();
      /* Скорость растёт с дистанцией: перелёт между системами не
         должен занимать минуту, а подход к планете - быть рывком */
      var step = Math.min(far - 20, (70 + far * 1.35) * dt);
      /* Доводка у цели. Раньше ход обрывался ступенькой ровно на
         шестидесяти единицах: корабль нёсся и вдруг вставал на
         круговое движение. Последние двести единиц гасим плавной
         кривой - подлёт заканчивается, а не прерывается. */
      if (far < 260) {
        var ease = far / 260;
        step *= 0.22 + 0.78 * ease * ease * (3 - 2 * ease);
      }
      w3.cam.position.addScaledVector(w3.tmpA, step);
      F.warpV = step / Math.max(dt, 0.001);       /* для табло скорости */
    } else {
      w3.cam.position.lerp(w3.tmpB, o.blend * Math.min(1, dt * 3));
      F.warpV = 0;
    }
  } else if (!F.away) {
    var pos = w3.path.getPointAt(F.p);
    if (F.rejoin > 0) {
      /* Сошли с орбиты: догоняем маршрут плавно, не телепортом */
      F.rejoin -= dt * 0.45;
      w3.cam.position.lerp(pos, Math.min(1, dt * 2.2));
    } else {
      w3.cam.position.copy(pos);
    }
    avoid(w3, dt);
  }

  /* Планеты чужих вселенных живут своей жизнью: вращение, облака,
     пульсация лавы. Обновляем только видимую вселенную - остальные
     стоят на паузе и ничего не стоят. */
  var pack = built[uniIdx];
  if (pack && pack.root.visible) {
    for (var pu = 0; pu < pack.live.length; pu++) {
      var body = pack.live[pu];
      if (body.update) body.update(dt, w3.cam.position);
      /* Свежесобранный мир разворачивается из точки: планета не
         должна возникать в кадре вспышкой, она проявляется */
      var ud = body.group && body.group.userData;
      if (ud && ud.grow !== undefined && ud.grow < 1) {
        ud.grow = Math.min(1, ud.grow + dt * 1.6);
        var e = 1 - Math.pow(1 - ud.grow, 3);
        body.group.scale.setScalar(0.01 + e * 0.99);
      }
    }
  }

  /* Цель взгляда: между точками интереса */
  var L = w3.looks, a = L[0], b = L[L.length - 1];
  for (var i = 0; i < L.length - 1; i++) {
    if (F.p >= L[i].p && F.p <= L[i + 1].p) { a = L[i]; b = L[i + 1]; break; }
  }
  var k = (F.p - a.p) / Math.max(0.0001, b.p - a.p);
  k = k * k * (3 - 2 * k);
  w3.tmpA.copy(a.at).lerp(b.at, k);
  if (F.orbit) w3.tmpA.copy(F.orbit.c);
  w3.tmpM.lookAt(w3.cam.position, w3.tmpA, w3.cam.up);
  w3.tmpQ.setFromRotationMatrix(w3.tmpM);
  /* Ориентация автопилота живёт отдельно от взгляда человека.
     Раньше повороты мыши применялись к тому же кватерниону, что и
     сглаживание курса: на тяжёлых кадрах ручной наклон накапливался
     быстрее, чем курс успевал его возвращать, и камера утыкалась в
     пол. Теперь курс сходится сам по себе, а взгляд - только
     насадка на кадр. */
  if (!w3.baseQ) w3.baseQ = w3.cam.quaternion.clone();
  w3.baseQ.slerp(w3.tmpQ, Math.min(1, dt * 3.2));
  w3.cam.quaternion.copy(w3.baseQ);

  /* Взгляд человека поверх автопилота.

     Если человек развернулся свободным обзором и после этого дал
     тягу, взгляд сам сходится к направлению полёта - тем быстрее,
     чем сильнее газ. Так и ведёт себя пилот: осмотрелся, взялся за
     ручку - смотрит по курсу. Без этого возврата единственным
     способом выпрямиться было бы столь же аккуратно докрутить
     мышь обратно, а это работа, а не игра. */
  if (F.free) {
    var pull = Math.abs(F.v) * 2.4;
    if (F.goal || F.auto || F.orbit) pull = Math.max(pull, 0.9);
    if (pull > 0.01) {
      var kk = Math.min(1, dt * pull);
      F.look.tx += (0 - F.look.tx) * kk;
      F.look.ty += (0 - F.look.ty) * kk;
      if (Math.abs(F.look.tx) < 0.02 && Math.abs(F.look.ty) < 0.02) {
        F.look.tx = F.look.ty = 0;
        F.free = false;
      }
    }
  }
  F.look.x += (F.look.tx - F.look.x) * Math.min(1, dt * 5);
  F.look.y += (F.look.ty - F.look.y) * Math.min(1, dt * 5);
  w3.cam.rotateY(-F.look.x);
  w3.cam.rotateX(-F.look.y);
  /* Отвернулись сильно - рамка кабины уходит: смотреть на переплёт
     остекления, когда голова повёрнута назад, неоткуда. Доля идёт в
     CSS, гасит рамку сама вёрстка. */
  /* Панель не имеет права исчезать совсем. Владелец поймал это:
     «в какой-то момент панель управления вообще исчезает». Корпус
     корабля никуда не девается оттого, что пилот повернул голову -
     он лишь уходит из поля зрения по краям. Поэтому доля отворота
     ограничена: рамка бледнеет, но остаётся. */
  var away = Math.min(0.42, Math.max(0, (Math.abs(F.look.x) - 0.85) / 1.1));
  if (Math.abs(away - (F.awayPub || 0)) > 0.02) {
    F.awayPub = away;
    ui.wrap.style.setProperty("--rcf-away", away.toFixed(2));
  }
  /* Портрет: окно кокпита выше середины экрана, и цель, посаженная
     в геометрический центр, пряталась под нижнюю раму. Лёгкий
     наклон камеры вниз поднимает цель в стекло. */
  if (innerHeight > innerWidth) w3.cam.rotateX(-0.042);

  /* В режиме сцены постановку кадра целиком ведёт салон: камера
     стоит внутри корабля, обходит его взглядом и подступает к
     остеклению. Всё, что насчитано выше - маршрут, взгляд, крен,
     тряска - к салону отношения не имеет, поэтому положение и
     поворот переписываются здесь начисто. */
  if (F.stage && cabin) stageCam(dt);

  var speed = Math.abs(F.v);

  /* Крен в вираж. Настоящий пилот не поворачивает плашмя: он кладёт
     корабль на борт и тянет. Раньше камера ходила строго по
     горизонту, и любой доворот выглядел движением мыши, а не
     манёвром. Крен берём от бокового взгляда и от кругового хода на
     орбите, доводим лениво - резкий крен читается сбоем. */
  var bankT = -F.look.x * 0.20 + (F.orbit && !F.orbit._far ? 0.055 : 0);
  F.bank = (F.bank || 0) + (bankT - F.bank) * Math.min(1, dt * 1.6);
  if (F.bank > 0.0004 || F.bank < -0.0004) w3.cam.rotateZ(F.bank);

  /* Тряска: прыжок, близость дыры и собственная тяга. Тягу считаем
     отдельно и мягче - на разгоне корабль должен дрожать, но не
     мешать целиться. */
  var nearHole = Math.max(0, 1 - w3.cam.position.distanceTo(w3.hole.position) / 500);
  var thrust = Math.min(0.34, speed * 1.9);
  /* Дрожь корпуса к пробою нарастает вдвое: машина работает на
     пределе, и кадр обязан это показывать */
  var jShake = jumpZone ? (0.7 + (F.jFlash || 0) * 1.5) : 0;
  F.shake += (jShake + nearHole * 0.7 + thrust - F.shake) * Math.min(1, dt * 3);
  if (F.shake > 0.02) {
    w3.cam.rotateZ(Math.sin(ts * 0.021) * 0.004 * F.shake);
    w3.cam.position.x += Math.sin(ts * 0.037) * 0.5 * F.shake;
    w3.cam.position.y += Math.cos(ts * 0.029) * 0.5 * F.shake;
  }

  /* Поле зрения дышит от скорости */
  /* Объектив на прыжке. Раньше он просто раскрывался - и разгон
     читался «поехали быстрее». Настоящий пробой сначала СЖИМАЕТ
     кадр (длинный фокус, стенки туннеля сходятся), а на выходе
     разжимает его с перелётом - именно этот рывок и ощущается как
     «выскочили». */
  var jf = 0;
  if (jumpZone && w3.at) {
    var jp = Math.max(0, Math.min(1, (F.p - w3.at.jump0) / Math.max(0.001, w3.at.jump1 - w3.at.jump0)));
    jf = jp < 0.74 ? -22 * (jp / 0.74) : 30 * Math.pow(1 - (jp - 0.74) / 0.26, 2);
  }
  /* Зум держится, пока им пользуются, и медленно стекает обратно:
     кадр не должен остаться увеличенным навсегда, но и сбрасываться
     рывком, едва отпустили пальцы, тоже не должен. */
  if (F.zoom > 0.001) F.zoom = Math.max(0, F.zoom - dt * 0.06);
  var fovGoal = (W3.fov0 || 72) * (1 - (F.zoom || 0) * 0.55) + speed * 46 + jf;
  w3.cam.fov += (fovGoal - w3.cam.fov) * Math.min(1, dt * 4);
  w3.cam.updateProjectionMatrix();

  /* Живой мир */
  w3.earth.rotation.y += dt * 0.02;
  if (w3.clouds) w3.clouds.rotation.y += dt * 0.009;
  w3.moon.rotation.y += dt * 0.012;
  w3.mars.rotation.y += dt * 0.022;
  w3.saturn.rotation.y += dt * 0.03;
  w3.hole.rotation.y += dt * 0.14;
  w3.diskMat.uniforms.uT.value = ts * 0.001;
  w3.sky.rotation.y += dt * 0.0025;
  if (w3.milky) { w3.milky.rotation.y += dt * 0.01; w3.gal2.rotation.y -= dt * 0.008; w3.gal3.rotation.y += dt * 0.012; }
  if (w3.belt1) { w3.belt1.rotation.y += dt * 0.0012; w3.belt2.rotation.y -= dt * 0.0009; }

  /* Пыль заворачивается вокруг камеры: частица, отставшая больше
     чем на полкуба, перекладывается на другую сторону */
  if (w3.dust && ts - (frame._dustT || 0) > 120) {
    frame._dustT = ts;
    var dp = w3.dust.geometry.attributes.position, half = w3.dust.userData.side / 2;
    var cxp = w3.cam.position.x, cyp = w3.cam.position.y, czp = w3.cam.position.z;
    for (var di = 0; di < dp.count; di++) {
      var vx = dp.getX(di), vy = dp.getY(di), vz = dp.getZ(di);
      var moved = false;
      if (vx - cxp > half) { vx -= half * 2; moved = true; } else if (cxp - vx > half) { vx += half * 2; moved = true; }
      if (vy - cyp > half) { vy -= half * 2; moved = true; } else if (cyp - vy > half) { vy += half * 2; moved = true; }
      if (vz - czp > half) { vz -= half * 2; moved = true; } else if (czp - vz > half) { vz += half * 2; moved = true; }
      if (moved) dp.setXYZ(di, vx, vy, vz);
    }
    dp.needsUpdate = true;
  }

  /* Страж плавности: если кадры стабильно тяжёлые, снижаем
     разрешение рендера ступенями и в крайнем случае снимаем
     облака. Вверх не откатываемся - мигание качеством хуже. */
  frame._ema = (frame._ema || 0.016) * 0.95 + dt * 0.05;
  if (frame._ema > 0.055 && ts - (frame._degT || 0) > 4000) {
    frame._degT = ts;
    frame._deg = (frame._deg || 0) + 1;
    if (frame._deg === 1) w3.r.setPixelRatio(Math.max(1, (g.devicePixelRatio || 1) * 0.75));
    else if (frame._deg === 2) w3.r.setPixelRatio(1);
    /* Дальше снимаем украшения, а не механику: сначала шлейф и
       оптика остекления, и только потом облака Земли */
    else if (frame._deg === 3) {
      w3.fx = false;
      if (w3.wash) w3.wash.visible = false;
      if (ui.wrap) { ui.wrap.style.setProperty("--rcf-warp", "0"); ui.wrap.style.setProperty("--rcf-glow", "0"); }
    }
    else if (frame._deg === 4 && w3.clouds) w3.clouds.visible = false;
  }

  /* Комета: эллипс между Марсом и Сатурном, хвост от солнца */
  if (w3.comet) {
    var ca = ts * 0.000021;
    w3.comet.position.set(950 + Math.cos(ca) * 520, -40 + Math.sin(ca * 1.7) * 90, -860 + Math.sin(ca) * 300);
    w3.tmpB.copy(w3.comet.position).sub(w3.sunGlow.position).normalize();
    w3.comet.lookAt(w3.tmpA.copy(w3.comet.position).add(w3.tmpB));
    w3.comet.rotateY(Math.PI / 2);
  }
  /* Спутник: низкая орбита Земли с наклоном */
  if (w3.sat) {
    var sa = ts * 0.00011;
    w3.sat.position.set(Math.cos(sa) * 76, 18 + Math.sin(sa * 2) * 12, Math.sin(sa) * 76);
    w3.sat.rotation.y = sa + 1.2;
  }

  /* Кнопка развёртывания и луч: состояние кнопки меняется редко,
     поэтому проверяем её десять раз в секунду, а не в каждом кадре */
  if (ts - (frame._netT || 0) > 100) {
    frame._netT = ts;
    netButton();
    reqTick(ts);
  }
  if (netBeamT > 0) {
    netBeamT -= dt;
    if (netBeam) {
      netBeam.material.opacity = Math.max(0, netBeamT / 0.65) * 0.95;
      if (netBeamT <= 0) { w3.scene.remove(netBeam); netBeam = null; }
    }
  }
  /* Узлы дышат: сеть живая, по ней идёт трафик */
  for (var nn = 0; nn < netNodes.length; nn++) {
    netNodes[nn].s.scale.setScalar(6 + Math.sin(ts * 0.003 + nn) * 1.5);
  }

  /* ── Голограммы над объектами ──────────────────────────────
     Клиент просил: «текст = голограммы, реагирующие на клики,
     касания, наведение, красиво растворяются и появляются». Метки
     рисует rc-holo, а игра каждый кадр говорит ему, где объект на
     экране и насколько он далёк. Считаем не чаще двадцати раз в
     секунду: чаще глазу не нужно, а проекций тут два десятка. */
  if (g.RC_HOLO && ts - (frame._holoT || 0) > 48) {
    frame._holoT = ts;
    holoFrame(w3, ts);
  }

  /* Сканер: находит цель ближе всех к центру кадра, ведёт её
     рамкой захвата и пишет дистанцию. Заодно пополняет журнал
     исследователя. Работает в своём темпе - двенадцать раз в
     секунду, дешевле рейкаста. */
  if (F.scan && ui.lock && ts - (frame._scanT || 0) > 84) {
    frame._scanT = ts;
    var bestT = null, bestD = 0.55, sx = 0, sy = 0, bd = 0;
    for (var si = 0; si < (w3.scanTargets || []).length; si++) {
      var tg = w3.scanTargets[si];
      /* Цели чужих вселенных считаются только там, где они видны:
         иначе прибор ведёт объект из другого рукава сквозь всё небо */
      if (tg.uni !== undefined && tg.uni !== uniIdx) continue;
      if (tg.uni === undefined && uniIdx !== 0) continue;
      w3.tmpA.setFromMatrixPosition(tg.o.matrixWorld).project(w3.cam);
      if (w3.tmpA.z > 1) continue;                  /* за спиной */
      var dxn = w3.tmpA.x, dyn = w3.tmpA.y;
      var dc = Math.sqrt(dxn * dxn + dyn * dyn);
      if (dc < bestD) {
        bestD = dc; bestT = tg;
        sx = (dxn * 0.5 + 0.5) * innerWidth;
        sy = (-dyn * 0.5 + 0.5) * innerHeight;
        bd = w3.cam.position.distanceTo(w3.tmpB.setFromMatrixPosition(tg.o.matrixWorld));
      }
    }
    if (bestT) {
      ui.lock.classList.add("on");
      ui.lock.style.left = sx + "px";
      ui.lock.style.top = sy + "px";
      /* Масштаб мира: радиус Земли 60 единиц = 6371 км, то есть
         единица - около ста километров. Дистанции получаются
         орбитальные, как и вся сцена. */
      var tkm = bd * 106 / 1000;
      ui.lockCap.textContent = bestT.name + " · " + (tkm >= 1000
        ? ((tkm / 1000).toFixed(1) + (RU ? " млн км" : "M km"))
        : (Math.round(tkm) + (RU ? " тыс. км" : "K km")));
      noteExplored(bestT.key);
    } else {
      ui.lock.classList.remove("on");
    }
  }

  /* Бортовой справочник: навёл на планету или галактику - корабль
     говорит, что это и когда открыто. Дорогую проверку пересечений
     гоняем восемь раз в секунду, не каждый кадр. */
  if (ui.info && (F.mx !== undefined) && ts - (frame._pickT || 0) > 120) {
    frame._pickT = ts;
    if (!frame._ray) frame._ray = new T.Raycaster();
    frame._ray.setFromCamera({ x: F.mx, y: F.my }, w3.cam);
    var hits = frame._ray.intersectObjects(w3.pickables || [], false);
    var info = null, hitObj = null;
    for (var hi = 0; hi < hits.length; hi++) {
      if (hits[hi].object.userData && hits[hi].object.userData.info) {
        info = hits[hi].object.userData.info; hitObj = hits[hi].object; break;
      }
    }
    /* Нажали по телу - снимаем с него карту. Наведение по-прежнему
       только подписывает; досье открывает именно нажатие, иначе оно
       выскакивало бы от каждого движения мыши. */
    if (F.pick && info && hitObj) dosOpen(hitObj, info);
    else if (F.pick && !info) dosClose();
    if (info !== frame._info) {
      frame._info = info;
      if (info) {
        ui.info.textContent = info;
        ui.info.classList.add("on");
        if (ui.cap && ui.cap.parentNode) ui.cap.parentNode.classList.add("has-info");
        noteExplored(info.split(" ")[0]);
        if (g.RC_SOUND) { try { (g.RC_SOUND.uiHover || g.RC_SOUND.blip).call(g.RC_SOUND); } catch (e) {} }
      }
      else {
        ui.info.classList.remove("on");
        if (ui.cap && ui.cap.parentNode) ui.cap.parentNode.classList.remove("has-info");
      }
    }
    F.pick = false;
  }

  /* Стримы прыжка едут за камерой и светятся только в прыжке.
     Полосы ещё и НЕСУТСЯ: раньше пучок был приклеен к камере
     намертво, и в гиперпрыжке звёздный туннель стоял на месте -
     светилось, но не летело. Теперь он ползёт вдоль своей оси и
     заворачивается по кругу, а к середине прыжка растягивается
     вдвое: полоса тем длиннее, чем быстрее идёт свет мимо. */
  var jm = w3.jump.material;
  jm.opacity += ((jumpZone ? 0.85 : 0) - jm.opacity) * Math.min(1, dt * 3);
  if (jm.opacity > 0.01) {
    var jk = 0;
    if (w3.at) {
      jk = (F.p - w3.at.jump0) / Math.max(0.001, w3.at.jump1 - w3.at.jump0);
      jk = jk < 0 ? 0 : jk > 1 ? 1 : jk;
      /* Фаза туннеля: к концу прыжка полосы уходят из циана в
         фиолет - видно, что летим уже по другому рукаву */
      jm.color.setRGB(0.62 - jk * 0.2, 0.85 - jk * 0.35, 0.94);
    }
    F.jz = ((F.jz || 0) + dt * (420 + jk * 1500)) % 300;
    /* Растяжение полос идёт не ровной синусоидой, а с изломом на
       трёх четвертях: свет мимо стекла разгоняется до самого выхода
       и только там обрывается. Прежняя гладкая дуга читалась
       «полетели и вернулись», а не «пробили пространство». */
    var stretch = 1 + Math.pow(Math.sin(Math.min(1, jk * 1.18) * Math.PI), 0.7) * 3.4;
    w3.jump.position.copy(w3.cam.position);
    w3.jump.quaternion.copy(w3.cam.quaternion);
    w3.jump.scale.set(1 - jk * 0.35, 1 - jk * 0.35, stretch);
    w3.jump.translateZ(F.jz);
  }

  /* ── Прыжок как событие ──────────────────────────────────
     «Скачок эффект доработать реалистичнее между Млечным Путём и
     вселенными» - и правда, раньше это были только полосы. Настоящий
     переход собран из четырёх вещей, и все они идут по одной доле:

       разгон   - кадр сжимается, объектив уходит в длинный фокус,
                  корпус начинает бить дрожью;
       пробой   - на трёх четвертях идёт вспышка, короткая и злая;
       выход    - кадр разжимается обратно с перелётом, звёзды
                  успокаиваются, вспышка гаснет;
       звук     - нарастающий гул, обрыв на вспышке, тишина после.

     Ни один из этих слоёв сам по себе не работает: сжатие без
     вспышки читается лагом, вспышка без сжатия - морганием. */
  var jNow = jumpZone ? Math.max(0, Math.min(1,
    (F.p - (w3.at ? w3.at.jump0 : 0.585)) /
    Math.max(0.001, (w3.at ? w3.at.jump1 - w3.at.jump0 : 0.27)))) : -1;
  if (jNow >= 0) {
    /* Вспышка пробоя: узкое окно у трёх четвертей пути */
    var flash = Math.max(0, 1 - Math.abs(jNow - 0.74) / 0.07);
    F.jFlash = flash * flash;
    if (ui.fade) {
      ui.fade.style.transition = "none";
      ui.fade.style.background =
        "radial-gradient(circle at 50% 50%, rgba(226,244,255," + (F.jFlash * 0.95).toFixed(3) +
        "), rgba(150,200,255," + (F.jFlash * 0.5).toFixed(3) + ") 45%, rgba(10,20,40,0) 78%)";
      ui.fade.style.opacity = F.jFlash > 0.01 ? "1" : "0";
    }
    /* Звук пробоя ровно один раз за прыжок */
    if (F.jFlash > 0.5 && !F.jBang) {
      F.jBang = true;
      if (g.RC_SOUND) {
        try {
          if (g.RC_SOUND.hyper) g.RC_SOUND.hyper();
          else if (g.RC_SOUND.blip) g.RC_SOUND.blip(90, 0.9, "sawtooth", 0.05);
        } catch (e) {}
      }
      /* Пробой не декорация: на вспышке корабль реально уходит в
         первый открытый чужой рукав. Раньше туннель, вспышка и
         надпись были, а прыжка НЕ БЫЛО - владелец назвал это
         «других вселенных по факту нету», и был прав. */
      var nxt = 0;
      for (var qi = 1; qi < UNIVERSES.length; qi++) {
        var uu3 = UNIVERSES[qi];
        if (!uu3.need || netCount() >= uu3.need) { nxt = qi; break; }
      }
      if (nxt > 0 && uniIdx === 0) {
        say((RU ? "ПРОБОЙ · РУКАВ " : "BREACH · ") + UNIVERSES[nxt].name, 2800);
        setTimeout(function () { jumpUniverse(nxt); }, 480);
      } else {
        say(RU ? "ПРОБОЙ · МЛЕЧНЫЙ ПУТЬ ПОЗАДИ" : "BREACH · MILKY WAY BEHIND", 2600);
      }
    }
  } else if (F.jBang || F.jFlash) {
    F.jBang = false;
    F.jFlash = 0;
    if (ui.fade) { ui.fade.style.background = ""; ui.fade.style.opacity = "0"; }
  }

  /* ── Шлейф двигателя ──
     Искры ползут к зрителю по локальной оси Z и заворачиваются в
     начало трубы. Тяжёлого здесь нет: один проход по массиву
     координат, и то только когда шлейф вообще виден. */
  if (w3.wash && W3.fx) {
    var wm = w3.wash.material;
    /* Порог по тяге: на дрейфе шлейфа быть не должно, двигатель
       выключен. Иначе корабль как будто вечно жжёт топливо. */
    var wantW = Math.min(0.80, Math.max(0, speed - 0.008) * 6.5 + (jumpZone ? 0.5 : 0));
    wm.opacity += (wantW - wm.opacity) * Math.min(1, dt * 4);
    if (wm.opacity > 0.012) {
      w3.wash.visible = true;
      w3.wash.position.copy(w3.cam.position);
      w3.wash.quaternion.copy(w3.cam.quaternion);
      var wp = w3.wash.geometry.attributes.position;
      var adv = (26 + speed * 900 + (F.warpV || 0) * 0.05) * dt;
      var arr = wp.array;
      for (var wi = 2; wi < arr.length; wi += 3) {
        arr[wi] += adv;
        if (arr[wi] > 14) arr[wi] -= 134;        /* заворот трубы */
      }
      wp.needsUpdate = true;
      /* На разгоне искра крупнеет: точка одного размера при любой
         скорости выдаёт, что это спрайт, а не след */
      wm.size = 2 + Math.min(3.4, speed * 11);
    } else if (w3.wash.visible) {
      w3.wash.visible = false;
    }
  }

  /* Пыль у стекла густеет и вытягивается с ходом: ощущение скорости
     даёт не цифра, а то, что мимо начинает нестись вещество */
  if (w3.dust) {
    var dm = w3.dust.material;
    dm.opacity = 0.30 + Math.min(0.52, speed * 3.4 + (F.warpV || 0) * 0.0004);
    dm.size = 1.6 + Math.min(2.4, speed * 8);
  }

  /* ── Блик от светила ──
     Пролёт мимо звезды. Когда она попадает в поле зрения, в
     остеклении вспыхивает засветка - тем сильнее, чем ближе к
     оптической оси. Считаем один скалярный продукт и отдаём CSS
     три числа: ни одного лишнего прохода по кадру. */
  if (ui.fx && W3.fx && ts - (frame._glareT || 0) > 60) {
    frame._glareT = ts;
    var src = w3.sunGlow.position;
    if (uniIdx !== 0 && built[uniIdx]) {
      /* В чужом рукаве светило своё: берём ближайшую систему */
      var pk2 = built[uniIdx].root, bestSD = 1e18;
      for (var gi = 0; gi < pk2.children.length; gi++) {
        var sd = w3.cam.position.distanceToSquared(pk2.children[gi].position);
        if (sd < bestSD) { bestSD = sd; src = pk2.children[gi].position; }
      }
    }
    w3.tmpA.copy(src).sub(w3.cam.position).normalize();
    w3.cam.getWorldDirection(w3.tmpB);
    var axis = w3.tmpA.dot(w3.tmpB);
    var glow = 0, gx = 50, gy = 50;
    if (axis > 0.35) {
      w3.tmpA.copy(src).project(w3.cam);
      if (w3.tmpA.z < 1) {
        gx = (w3.tmpA.x * 0.5 + 0.5) * 100;
        gy = (-w3.tmpA.y * 0.5 + 0.5) * 100;
        /* Восьмая степень: засветка вспыхивает только когда светило
           почти в кадре, а не тлеет всё время */
        glow = Math.pow((axis - 0.35) / 0.65, 2.2);
        var dstar = w3.cam.position.distanceTo(src);
        glow *= Math.min(1, 2600 / Math.max(200, dstar));
      }
    }
    F.glow = (F.glow || 0) + (glow - (F.glow || 0)) * 0.35;
    var st2 = ui.wrap.style;
    st2.setProperty("--rcf-glow", F.glow.toFixed(3));
    st2.setProperty("--rcf-gx", gx.toFixed(1) + "%");
    st2.setProperty("--rcf-gy", gy.toFixed(1) + "%");
  }

  /* Панель кабины чуть оседает на разгоне: перегрузка.
     Тем же числом живёт оптика остекления: виньетка поджимается, по
     краям кадра расходится цвет. Это не постпроцессинг, а две
     заливки в CSS - разгон читается, кадр не дорожает. */
  if (ui.wrap) {
    ui.wrap.style.setProperty("--rcf-g", (speed * 5).toFixed(3));
    var warp = Math.min(1, speed * 4.2 + (jumpZone ? 0.55 : 0) + nearHole * 0.4 +
                           Math.min(0.35, (F.warpV || 0) * 0.0006));
    F.warp = (F.warp || 0) + (warp - (F.warp || 0)) * Math.min(1, dt * 4);
    ui.wrap.style.setProperty("--rcf-warp", F.warp.toFixed(3));
  }

  /* HUD */
  var cap = CAPTIONS[0];
  for (i = CAPTIONS.length - 1; i >= 0; i--) { if (F.p >= CAPTIONS[i].p) { cap = CAPTIONS[i]; break; } }
  /* Пока идёт перелёт к цели, титул честно говорит, куда летим */
  if (F.goal !== null && F.goal !== undefined && F.goalName) {
    cap = { t: (RU ? "КУРС → " : "COURSE → ") + F.goalName };
  }
  if (F.orbit && F.goalName) {
    cap = { t: (RU ? "ОРБИТА · " : "ORBIT · ") + F.goalName + (RU ? " · листайте, чтобы продолжить путь" : "") };
  }
  /* В чужой вселенной титры родной системы не к месту: там свои
     объекты, и подпись обязана говорить, где мы сейчас. Правило
     идёт последним - иначе цель, оставшаяся от родной системы,
     перебивала название рукава, в который мы только что прыгнули. */
  if (F.away) {
    cap = { t: UNIVERSES[uniIdx].name + (F.orbit && F.orbit.name ? " · " + F.orbit.name : "") };
  }
  if (ui.cap._t !== cap.t && !(ui.cap._hold && ts < ui.cap._hold)) {
    ui.cap._t = cap.t;
    ui.cap.classList.remove("in");
    void ui.cap.offsetWidth;
    ui.cap.textContent = cap.t;
    ui.cap.classList.add("in");
  }
  ui.bar.style.width = (F.p * 100).toFixed(1) + "%";
  /* На перелёте между системами табло показывает настоящий ход:
     иначе при варпе счётчик стоял на месте, хотя мимо летит космос */
  var spdV = Math.round(7.9 + speed * 6200 + (F.warpV || 0) * 0.9);
  if (spdV !== F._spdPub) {
    F._spdPub = spdV;
    var sv = String(spdV);
    for (var qi2 = 0; qi2 < ui.speedAll.length; qi2++) ui.speedAll[qi2].textContent = sv;
  }

  /* Звук идёт за тягой */
  if (g.RC_SOUND && g.RC_SOUND.flightLevel && !F.stage && ts - (F._sndT || 0) > 120) {
    F._sndT = ts;
    try { g.RC_SOUND.flightLevel(Math.min(1, 0.25 + speed * 4 + (jumpZone ? 0.35 : 0))); } catch (e) {}
  }

  /* Небо и звёзды бесконечны: сфера фона и оболочки точек едут за
     камерой - на дальнем конце маршрута небо больше не редеет */
  if (w3.sky) w3.sky.position.copy(w3.cam.position);
  if (w3.starShell) w3.starShell.position.copy(w3.cam.position);

  /* Фотосфера кипит: время идёт в шейдер звезды */
  if (w3.sunMat && w3.sunMat.uniforms) w3.sunMat.uniforms.uT.value = ts * 0.001;

  if (!F.stage) {
    powerFrame(w3, dt);
    projFrame(w3, dt);
    barsFrame(ts);
    courseFrame(w3, ts);
    missionFrame(ts);
    trafFrame(dt);
    failTick(ts);
    failPaint();
    netList();
    pilotCard();
    radarFrame(w3, ts);
  }

  w3.r.render(w3.scene, w3.cam);
}

/* ── Вход и выход ────────────────────────────────────────────ы */
function open() {
  /* Из режима сцены игра не открывается заново - она просыпается.
     Мир, камера и кабина уже в кадре, добавляются только приборы,
     управление и ход корабля. Именно поэтому между сайтом и игрой
     нет ни вспышки, ни перезагрузки, ни смены картинки. */
  var fromStage = F.stage;
  if (F.open && !fromStage) return;
  if (!g.THREE) {
    /* Объёмный слой ещё не доехал: дожидаемся и пробуем снова */
    var once = function () { removeEventListener("rc:3d", once); open(); };
    addEventListener("rc:3d", once);
    if (g.RC_GL && !g.RC_GL.want3d) return;   /* этому устройству не положено */
    return;
  }
  buildUI();
  if (!F.built) {
    try { W3 = buildWorld(); } catch (e) {
      /* Молчаливое проглатывание однажды стоило нам всей игры:
         сборка мира падала, кнопка «Начать полёт» выглядела мёртвой,
         а в консоли было пусто. Пишем в консоль тоже - проверка
         обязана видеть такие падения. */
      try { console.error("rc-flight: мир не собрался -", e); } catch (e2) {}
      if (g.RC_track) g.RC_track("jserr", "flight: " + (e.message || e), true);
      return;
    }
    F.built = true;
    netRestore();
  }

  F.open = true;
  if (fromStage) {
    F.stage = false;
    F.stageK = 0;
    ui.wrap.classList.remove("rcf-stage");
    root.classList.remove("rc-stage");
    /* Салон уходит из сцены ровно в тот кадр, когда его корпус в
       проёме совпал с плоской рамкой полёта: подмены не видно, а
       геометрия комнаты больше не тратит ни кадра. */
    cabinFlightMode();
    ui.wrap.classList.add("rcf-native-cab");
  } else {
    F.p = 0; F.v = 0; F.last = 0;
  }

  /* Возвращаемся домой. Раньше выход из чужой вселенной оставлял
     uniIdx и F.away как есть: человек заходил снова, читал брифинг
     про Землю, Луну и Марс, а вокруг были пески RV-2, и в панели не
     было ни «Земли», ни «Домой». Маршрут начинается от Земли -
     значит и мир должен быть родной. */
  if (uniIdx !== 0 && !uniBusy) {
    uniIdx = 0;
    F.away = false;
    F.orbit = null;
    if (W3) { try { applyUniverse(0); } catch (e) {} }
    try { systemNav(); } catch (e2) {}
  }
  /* Карта миссии нужна тому, кто нажал «Полёт» посреди страницы:
     он ещё не в корабле, и ему надо объяснить, куда он попал.

     А вот из финала стык обязан быть бесшовным. Клиент описал его
     дословно: «отдалились, появилась надпись старта - и всё,
     дальше врубается игра». Мы в этот момент уже сидим в той же
     кабине, перед тем же остеклением: показывать поверх кадра
     карточку с двумя кнопками значит рвать сцену ровно там, где
     она должна склеиться. Поэтому в акте отлёта брифинга нет -
     корабль просто трогается на автопилоте. */
  var seamless = fromStage || root.getAttribute("data-act") === "egress";
  /* Бесшовный старт из финала: сайтовая кабина стоит на своём
     масштабе, и игра обязана принять кадр в том же виде. Готовность
     рамки проверяем ещё раз - между сборкой интерфейса и открытием
     могла смениться ориентация, а с ней и картинка. */
  if (ui.cab && ui.cab.complete && ui.cab.naturalWidth) ui.wrap.classList.add("has-cab");
  ui.wrap.classList.toggle("rcf-seam", seamless);
  F.brief = !seamless;
  F.orbit = null;
  F.goal = null;
  F.goalId = null;
  F.goalName = null;
  courseText(null);
  if (ui.brief) ui.brief.classList.toggle("off", seamless);
  F.scan = false;
  if (ui.scanKey) { ui.scanKey.classList.remove("cur"); ui.scanKey.setAttribute("aria-pressed", "false"); }
  if (ui.lock) ui.lock.classList.remove("on");
  paintProgress();
  netPaint();
  netButton();
  /* Автопилот не включается сам: «убери автоматический запуск полёта,
     это же игра, а не экскурсия». Кино включается кнопкой. */
  setAuto(false);
  if (!fromStage) { F.look.x = F.look.y = F.look.tx = F.look.ty = 0; F.free = false; }
  hintHidden = false;
  if (ui.hint) ui.hint.classList.remove("off");
  /* Подсказка про управление своё говорит один раз. Раньше она
     висела посреди окна, пока человек её не «отработает» - а если он
     просто смотрел в космос, надпись оставалась поперёк кадра всю
     дорогу и перекрывала планеты. Семи секунд хватает прочитать; тот,
     кто взялся за управление раньше, гасит её сам. */
  if (hintT) clearTimeout(hintT);
  hintT = setTimeout(function () { hintT = 0; hideHint(); }, 7000);

  root.classList.add("rc-flying");
  ui.wrap.classList.add("on");
  deckSkinSoon();
  /* Страница под полётом перестаёт существовать для клавиатуры и
     чтения с экрана: иначе Tab уводит из кабины в список городов */
  inertPage(true);
  size();

  /* Сцены сайта спят, музыка встаёт в полный рост */
  try { dispatchEvent(new CustomEvent("rc:flight", { detail: { on: true } })); } catch (e) {}
  if (g.RC_MUSIC && g.RC_MUSIC.boost) { try { g.RC_MUSIC.boost(true); } catch (e) {} }
  if (g.RC_SOUND && g.RC_SOUND.flight) { try { g.RC_SOUND.flight(true); } catch (e) {} }
  stageLite(false);
  if (g.RC_track) g.RC_track("flight", "open");

  /* Из режима сцены цикл уже работает: второй rAF-контур давал
     двойной рендер каждого кадра - «всё лагает после старта» */
  if (!F.raf) F.raf = requestAnimationFrame(frame);
}

function close() {
  if (!F.open) return;
  F.open = false;
  F.stage = false;
  F.stageK = 0;
  if (F.raf) { cancelAnimationFrame(F.raf); F.raf = null; }
  root.classList.remove("rc-flying", "rc-stage");
  ui.wrap.classList.remove("on", "rcf-stage", "rcf-native-cab");
  cabinDrop();
  inertPage(false);
  try { dispatchEvent(new CustomEvent("rc:flight", { detail: { on: false } })); } catch (e) {}
  if (g.RC_MUSIC && g.RC_MUSIC.boost) { try { g.RC_MUSIC.boost(false); } catch (e) {} }
  if (g.RC_SOUND && g.RC_SOUND.flight) { try { g.RC_SOUND.flight(false); } catch (e) {} }
  if (g.RC_track) g.RC_track("flight", "close p=" + F.p.toFixed(2));
  /* Язык переключили в полёте - пересобираем кабину теперь */
  if (langDirty) setTimeout(relang, 420);
}

/* Приглашение в полёт после успешной заявки. Не окно и не
   перехват кадра: строка с кнопкой прямо под формой, там, где
   человек сейчас смотрит. Появляется один раз. */
function offerFlight() {
  var box = doc.querySelector("#contact .form-card");
  if (!box || doc.querySelector(".rcf-after")) return;
  var el = doc.createElement("div");
  el.className = "rcf-after";
  el.innerHTML =
    "<b>" + (RU ? "Заявка принята" : "Request received") + "</b>" +
    "<span>" + (RU
      ? "Инженер свяжется с вами в ближайшее время. А пока - можно облететь сеть."
      : "An engineer will contact you. Meanwhile, you can fly the network.") + "</span>" +
    '<button type="button" class="rcf-after-btn">' +
      (RU ? "Облететь сеть" : "Fly the network") + "</button>";
  box.appendChild(el);
  var b = el.querySelector(".rcf-after-btn");
  if (b) b.addEventListener("click", function () { open(); });
  requestAnimationFrame(function () { el.classList.add("on"); });
}

/* ── Кнопки запуска ──────────────────────────────────────────
   Плавающая кнопка появляется после первого экрана и живёт до
   конца страницы: клиент просил вход в полёт из любого места. */
function launchers() {
  var btns = [].slice.call(doc.querySelectorAll(".js-flight"));
  btns.forEach(function (b) { b.addEventListener("click", open); });

  var fab = doc.createElement("button");
  fab.type = "button";
  fab.className = "rcf-fab js-flight";
  fab.innerHTML =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>' +
    '<path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>' +
    '<path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg>' +
    '<span>' + (RU ? "Полёт" : "Flight") + '</span>';
  fab.addEventListener("click", open);
  doc.body.appendChild(fab);

  var seen = false;
  addEventListener("scroll", function () {
    var show = (g.scrollY || 0) > innerHeight * 0.6;
    if (show !== seen) { seen = show; fab.classList.toggle("on", show); }
  }, { passive: true });

  /* Заявка отправлена. Раньше отсюда через полторы секунды сам
     собой открывался полёт во весь экран - и человек, только что
     оставивший рабочую заявку в рабочее время, получал игру, которой
     не просил. Приёмка справедливо назвала это ошибкой: кульминация
     тратилась на развлечение вместо подтверждения.

     Теперь предлагаем, а не запускаем: на экране пульта появляется
     приглашение с кнопкой. Захочет - полетит. */
  var form = doc.querySelector("#contact form");
  if (form) form.addEventListener("submit", function () {
    var msg = form.querySelector(".form-msg");
    var tries = 0;
    var wait = setInterval(function () {
      if (++tries > 40) { clearInterval(wait); return; }
      if (msg && msg.className.indexOf("ok") >= 0) {
        clearInterval(wait);
        setTimeout(offerFlight, 1200);
      }
    }, 250);
  });
}

/* ── Цепочка заданий ─────────────────────────────────────────
   «Функционал после подлёта какой-то добавь, ну логика игры, зачем
   мы подлетаем, что делаем» - вопрос по существу. Раньше игра
   умела всё сразу и не просила ничего: лети куда хочешь,
   разворачивай что хочешь, конца нет.

   Теперь есть цепочка. Каждый шаг объясняет, зачем мы летим к
   очередному телу, и открывает следующий. Задания не выдуманы
   поверх игры - они собраны из того, что в ней и так происходит:
   осмотреть тело, развернуть узел, закрыть запрос трафика, уйти в
   другой рукав. Просто теперь это порядок, а не набор кнопок.

   Прогресс живёт вместе с остальным журналом исследователя: закрыл
   вкладку, вернулся - продолжаешь с того же места. */
function netCountAll() { return Object.keys(net).length; }

var MISSIONS = [
  {
    id: "look",
    t: RU ? "Осмотреться" : "Look around",
    h: RU ? "Наведитесь на любое тело и нажмите по нему - корабль снимет карту"
          : "Tap any body to scan it",
    done: function () { return Object.keys(explored).length >= 2; },
    now: function () { return Object.keys(explored).length; },
    goalN: 2
  },
  {
    id: "first",
    t: RU ? "Первый узел сети" : "First network node",
    h: RU ? "Выйдите на орбиту любого тела и разверните узел"
          : "Enter orbit and deploy a node",
    done: function () { return netCountAll() >= 1; },
    now: netCountAll, goalN: 1
  },
  {
    id: "three",
    t: RU ? "Опорная тройка" : "Three nodes",
    h: RU ? "Три узла держат сеть при отказе любого одного"
          : "Three nodes keep the network alive",
    done: function () { return netCountAll() >= 3; },
    now: netCountAll, goalN: 3
  },
  {
    id: "req",
    t: RU ? "Закрыть запрос трафика" : "Serve a traffic surge",
    h: RU ? "Когда придёт запрос, разверните узел на названном теле"
          : "Deploy a node where the surge asks",
    done: function () { return F.served >= 1; },
    now: function () { return F.served || 0; }, goalN: 1
  },
  {
    id: "system",
    t: RU ? "Своя система" : "Own the system",
    h: RU ? "Шесть узлов - и Солнечная система ваша целиком"
          : "Six nodes across the system",
    done: function () { return netCountAll() >= 6; },
    now: netCountAll, goalN: 6
  },
  {
    id: "jump",
    t: RU ? "Открыть экзопланетный сектор" : "Reach an exoplanet sector",
    h: RU ? "Гиперпрыжок через Млечный Путь: выберите сектор в меню «Курс»"
          : "Use Course to hyperjump through the Milky Way",
    done: function () { return uniIdx !== 0 || (F.jumps || 0) >= 1; },
    now: function () { return (F.jumps || 0); }, goalN: 1
  },
  {
    id: "all",
    t: RU ? "Сеть без границ" : "Network everywhere",
    h: RU ? "Развернуть узлы во всех открытых мирах" : "Deploy nodes everywhere",
    done: function () { return netCountAll() >= NET_TOTAL(); },
    now: netCountAll, goalN: 0
  }
];

function missionNow() {
  for (var i = 0; i < MISSIONS.length; i++) {
    if (!MISSIONS[i].done()) return MISSIONS[i];
  }
  return null;
}

var misT = 0, misId = "";
function missionFrame(ts) {
  if (!ui.mis || ts - misT < 500) return;
  misT = ts;
  var m = missionNow();
  if (!m) {
    if (misId !== "done") {
      misId = "done";
      ui.mis.innerHTML = '<b>' + (RU ? "СЕТЬ ЗАМКНУТА" : "NETWORK COMPLETE") + '</b>' +
        '<span>' + (RU ? "Все миры на связи. Дальше - свободный полёт." : "All worlds online.") + '</span>';
      ui.mis.classList.add("full");
    }
    return;
  }
  var need = m.goalN || NET_TOTAL();
  var have = Math.min(need, m.now());
  var key = m.id + ":" + have;
  if (key === misId) return;
  var first = misId === "";
  misId = key;
  ui.mis.classList.remove("full");
  /* Смена задания - тоже включение проекции: контент не подменяется
     тихо, изображение рвётся и собирается заново */
  ui.mis.classList.remove("rcf-flick");
  void ui.mis.offsetWidth;
  ui.mis.classList.add("rcf-flick");
  ui.mis.innerHTML =
    '<b>' + esc(m.t) + '</b>' +
    '<span>' + esc(m.h) + '</span>' +
    '<i><u style="width:' + Math.round(have / need * 100) + '%"></u></i>' +
    '<em>' + have + " / " + need + '</em>';
  if (!first && g.RC_SOUND && g.RC_SOUND.uiHover) { try { g.RC_SOUND.uiHover(); } catch (e) {} }
}

function esc(v) {
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* ── Курсовая строка ─────────────────────────────────────────
   Куда идём, сколько осталось и в каком режиме. Расстояние честное:
   считается от камеры до цели и переводится в километры по тому же
   масштабу, в котором построен мир (Земля - шестьдесят единиц на
   двенадцать с половиной тысяч километров). */
var courseT = 0;
var KM_PER_UNIT = 12742 / 120;          /* диаметр Земли на её размер в мире */
function courseFrame(w3, ts) {
  if (!ui.cGoal || ts - courseT < 220) return;
  courseT = ts;
  var name = "—", dist = "—";
  var tgt = null;
  if (F.orbit && F.orbit.name) { name = F.orbit.name; tgt = F.orbit.c; }
  else if (F.goalId || F.goalName) {
    name = F.goalName || GOAL_NAMES[F.goalId] || F.goalId;
    var o = w3[F.goalId === "hole" ? "hole" : F.goalId];
    if (o) tgt = o.position;
  }
  if (tgt) {
    var d = w3.cam.position.distanceTo(tgt) * KM_PER_UNIT;
    dist = d > 1e6 ? (d / 1e6).toFixed(1) + (RU ? " млн км" : "M km")
         : d > 1e3 ? Math.round(d / 1e3) + (RU ? " тыс. км" : "k km")
         : Math.round(d) + (RU ? " км" : " km");
  }
  ui.cGoal.textContent = name;
  if (ui.navKeyTx) ui.navKeyTx.textContent = name === "—" ? (RU ? "не задан" : "none") : name;
  ui.cDist.textContent = dist;
  ui.cMode.textContent = F.auto ? (RU ? "АВТОПИЛОТ" : "AUTOPILOT")
                       : F.orbit ? (RU ? "ОРБИТА" : "ORBIT")
                       : (RU ? "РУЧНОЙ" : "MANUAL");
}

/* ── Карточка пилота ─────────────────────────────────────────
   Игра должна чем-то заканчиваться, иначе она не игра, а катание.
   Когда сеть замкнута, корабль выдаёт лист с итогом: сколько миров
   открыто, сколько узлов развёрнуто, сколько запросов закрыто и
   аварий отбито. Это и есть повод сохранить кадр и показать его
   кому-то - тот самый след, ради которого стоило летать.

   Лист собирается один раз и лежит, пока его не закроют: пересчёт
   на каждом кадре здесь не нужен, итог уже подведён. */
var pilotShown = false;

function pilotCard() {
  if (pilotShown || !ui.wrap) return;
  if (netCount() < NET_TOTAL()) return;
  pilotShown = true;

  var el = doc.createElement("div");
  el.className = "rcf-pilot";
  var rank = RU ? "КОМАНДИР СЕТИ" : "NETWORK COMMANDER";
  el.innerHTML =
    '<div class="rcf-pilot-in">' +
      '<i>' + (RU ? "ПОЛЁТ ЗАВЕРШЁН" : "MISSION COMPLETE") + '</i>' +
      '<b>' + rank + '</b>' +
      '<div class="rcf-pilot-g">' +
        '<span><u>' + netCount() + '</u>' + (RU ? "узлов сети" : "nodes") + '</span>' +
        '<span><u>' + Object.keys(explored).length + '</u>' + (RU ? "объектов открыто" : "explored") + '</span>' +
        '<span><u>' + (F.served || 0) + '</u>' + (RU ? "запросов закрыто" : "surges served") + '</span>' +
        '<span><u>' + (F.saved || 0) + '</u>' + (RU ? "аварий отбито" : "outages fixed") + '</span>' +
      '</div>' +
      '<p>' + (RU
        ? "Сеть Rocket CDN замкнута во всех рукавах. Так же она работает и у нас: контент доходит до человека с ближайшего узла, где бы он ни был."
        : "The Rocket CDN network is complete.") + '</p>' +
      '<div class="rcf-pilot-b">' +
        '<button type="button" data-act="shot">' + (RU ? "Сохранить кадр" : "Save frame") + '</button>' +
        '<button type="button" data-act="close">' + (RU ? "Продолжить полёт" : "Keep flying") + '</button>' +
      '</div>' +
    '</div>';
  ui.wrap.appendChild(el);
  el.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest("[data-act]") : null;
    if (!b) return;
    if (b.getAttribute("data-act") === "shot") { shoot(); return; }
    el.classList.remove("on");
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 400);
  });
  requestAnimationFrame(function () { el.classList.add("on"); });
  if (g.RC_SOUND && g.RC_SOUND.uiConfirm) { try { g.RC_SOUND.uiConfirm(); } catch (e) {} }
  if (g.RC_track) g.RC_track("flight", "complete " + netCount());
}

/* ── Консоль сети ────────────────────────────────────────────
   Счётчик «сеть 4/34» говорил, сколько узлов развёрнуто, но не
   говорил каких - а это и есть главный результат игры. Список на
   правой консоли показывает построенную сеть целиком: где узел
   стоит, где идёт авария, куда просят трафик.

   Список короткий и сам себя обновляет только при изменениях:
   каждый кадр перебирать разметку незачем. */
var netListKey = "";
function netList() {
  if (!ui.netList) return;
  var names = Object.keys(net);
  var key = names.join(",") + "|" + (fail ? fail.name : "") + "|" + (req ? req.name : "");
  if (key === netListKey) return;
  netListKey = key;
  if (!names.length) {
    ui.netList.innerHTML = '<i>' + (RU ? "СЕТЬ ПУСТА" : "NO NODES") + '</i>';
    return;
  }
  var h = '<i>' + (RU ? "УЗЛЫ СЕТИ" : "NODES") + '</i>';
  /* Больше шести строк на консоли не помещается, а сеть может
     вырасти до трёх десятков: показываем последние - те, что
     человек только что построил, и отдельной строкой остаток. */
  var show = names.slice(-6);
  for (var i = 0; i < show.length; i++) {
    var nm = show[i];
    var cls = fail && fail.name === nm ? "down" : (req && req.name === nm ? "want" : "ok");
    h += '<span class="' + cls + '">' + nm + '</span>';
  }
  if (names.length > show.length) {
    h += '<span class="more">+' + (names.length - show.length) + '</span>';
  }
  ui.netList.classList.remove("rcf-flick");
  void ui.netList.offsetWidth;
  ui.netList.classList.add("rcf-flick");
  ui.netList.innerHTML = h;
}

/* ── Восстановление сети после возвращения ───────────────────
   Журнал узлов живёт в браузере, а метки в сцене - нет: закрыл
   вкладку, вернулся, и счётчик показывал прежнюю сеть, а в кадре её
   не было. Развёрнутые узлы обязаны стоять там же, где их
   оставили, иначе прогресс существует только на бумаге.

   Ставим их сразу после сборки мира, по именам из журнала. */
function netRestore() {
  if (!W3 || !netNodes) return;
  if (netNodes.length) return;
  var map = {
    earth: W3.earth, moon: W3.moon, mars: W3.mars, saturn: W3.saturn,
    sun: W3.sun, mercury: W3.mercury, venus: W3.venus,
    jupiter: W3.jupiter, uranus: W3.uranus, neptune: W3.neptune,
    hole: W3.hole
  };
  var any = false;
  for (var key in map) {
    if (!map[key]) continue;
    var nm = GOAL_NAMES[key];
    if (!nm || !net[nm]) continue;
    netMark(map[key].position, nm);
    any = true;
  }
  if (any) trafBuild();
}

/* ── Трафик между узлами ─────────────────────────────────────
   Линии связи показывали, что узлы соединены, но сеть от этого не
   выглядела работающей: связь есть, а движения по ней нет. Между
   тем вся игра про доставку контента, и трафик - её главное
   содержание.

   Теперь по линиям идут пакеты: светящиеся точки бегут от узла к
   узлу и вспыхивают на прибытии. Дороже это не стоит почти ничего -
   одна точечная система на всю сеть, координаты которой
   пересчитываются раз в кадр из уже посчитанных отрезков.

   Чем больше узлов, тем плотнее движение: сеть, которую человек
   построил, видно по её нагрузке. */
var traf = null, trafN = 0, trafSeg = [];

function trafBuild() {
  var T = g.THREE;
  if (!W3) return;
  if (traf) { W3.scene.remove(traf); traf = null; }
  trafSeg = [];
  for (var i = 0; i < netNodes.length; i++) {
    for (var j = i + 1; j < netNodes.length; j++) {
      if (netNodes[i].p.distanceTo(netNodes[j].p) > 1400) continue;
      trafSeg.push([netNodes[i].p, netNodes[j].p]);
    }
  }
  if (!trafSeg.length) return;
  /* По три пакета на связь: меньше не читается движением, больше
     превращается в сплошную нитку */
  trafN = Math.min(96, trafSeg.length * 3);
  var pos = new Float32Array(trafN * 3);
  var geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.BufferAttribute(pos, 3));
  traf = new T.Points(geo, new T.PointsMaterial({
    color: 0xbfe9ff, size: 7, sizeAttenuation: true,
    map: glowSprite(32, "rgba(220,245,255,1)", "rgba(120,200,240,0)"),
    transparent: true, opacity: 0.95, depthWrite: false,
    blending: T.AdditiveBlending
  }));
  traf.userData.t = new Float32Array(trafN);
  traf.userData.seg = new Uint16Array(trafN);
  for (var k = 0; k < trafN; k++) {
    traf.userData.seg[k] = k % trafSeg.length;
    traf.userData.t[k] = Math.random();
  }
  traf.frustumCulled = false;
  W3.scene.add(traf);
}

function trafFrame(dt) {
  if (!traf || !trafSeg.length) return;
  var pos = traf.geometry.attributes.position.array;
  var tt = traf.userData.t, sg = traf.userData.seg;
  for (var k = 0; k < trafN; k++) {
    tt[k] += dt * (0.14 + (k % 5) * 0.035);
    if (tt[k] > 1) {
      tt[k] -= 1;
      /* На прибытии пакет уходит на другую связь: движение по сети
         должно выглядеть маршрутизацией, а не каруселью */
      sg[k] = (sg[k] + 1 + (k % 3)) % trafSeg.length;
    }
    var a = trafSeg[sg[k]][0], b = trafSeg[sg[k]][1];
    var u = tt[k];
    pos[k * 3] = a.x + (b.x - a.x) * u;
    pos[k * 3 + 1] = a.y + (b.y - a.y) * u;
    pos[k * 3 + 2] = a.z + (b.z - a.z) * u;
  }
  traf.geometry.attributes.position.needsUpdate = true;
}

/* ── Происшествия в сети ─────────────────────────────────────
   Запросы трафика показывали, куда нужен узел, но ничем не грозили:
   не успел - и ладно. Напряжения в игре от этого не было совсем.

   Авария другое дело. Развёрнутый узел падает, сеть теряет
   участок, и до него надо долететь и поднять его заново - за
   отведённое время. Не успел - узел выбывает, счётчик сети падает,
   и его придётся разворачивать с нуля.

   Аварии начинаются, только когда в сети есть что ронять: на
   пустой сети это была бы не игра, а наказание за то, что ещё не
   успел начать. */
var fail = null, failNext = 0;

function failPick() {
  var keys = Object.keys(net);
  if (keys.length < 2) return null;
  return keys[Math.floor((performance.now() / 1301) % keys.length)];
}

function failTick(ts) {
  if (F.stage || F.brief) return;

  /* Идёт авария: следим за временем и за тем, дошли ли мы */
  if (fail) {
    if (F.orbit && F.orbit.name === fail.name) {
      /* Пришли вовремя - узел поднят, заряд не тратится: это
         восстановление, а не новое строительство */
      say((RU ? "УЗЕЛ ПОДНЯТ · " : "NODE RESTORED · ") + fail.name, 2600);
      if (g.RC_SOUND && g.RC_SOUND.uiConfirm) { try { g.RC_SOUND.uiConfirm(); } catch (e) {} }
      F.saved = (F.saved || 0) + 1;
      fail = null;
      failNext = ts + 52000;
      netPaint();
      return;
    }
    if (ts > fail.until) {
      /* Не успели: узел выбывает из сети */
      delete net[fail.name];
      try { localStorage.setItem(NET_KEY, JSON.stringify(net)); } catch (e) {}
      /* Метка узла уходит из мира вместе с записью: раньше спрайт
         оставался висеть, и сеть на глаз не менялась */
      for (var fi = netNodes.length - 1; fi >= 0; fi--) {
        if (netNodes[fi].name === fail.name) {
          if (W3) W3.scene.remove(netNodes[fi].s);
          netNodes.splice(fi, 1);
        }
      }
      trafBuild();
      say((RU ? "УЗЕЛ ПОТЕРЯН · " : "NODE LOST · ") + fail.name, 3200);
      if (g.RC_SOUND && g.RC_SOUND.blip) { try { g.RC_SOUND.blip(140, 0.7, "sawtooth", 0.04); } catch (e) {} }
      fail = null;
      failNext = ts + 64000;
      netPaint();
      netButton();
      return;
    }
    /* Обратный отсчёт на табло аварии */
    if (ui.fail) {
      var left = Math.max(0, Math.round((fail.until - ts) / 1000));
      ui.fail.textContent = (RU ? "АВАРИЯ · " : "OUTAGE · ") + fail.name + " · " + left + (RU ? " с" : "s");
    }
    return;
  }

  if (ts < failNext) return;
  var pick = failPick();
  if (!pick) { failNext = ts + 30000; return; }
  fail = { name: pick, until: ts + 46000 };
  say((RU ? "АВАРИЯ НА УЗЛЕ · " : "NODE DOWN · ") + pick +
      (RU ? " · выйдите на его орбиту" : " · reach its orbit"), 4200);
  if (g.RC_SOUND && g.RC_SOUND.blip) { try { g.RC_SOUND.blip(320, 0.5, "square", 0.03); } catch (e) {} }
}

function failPaint() {
  if (!ui.fail) return;
  var on = !!fail;
  if (on !== ui.fail.classList.contains("on")) ui.fail.classList.toggle("on", on);
  if (ui.wrap) ui.wrap.classList.toggle("rcf-outage", on);
}

/* ── Снимок из кабины ────────────────────────────────────────
   Кнопка на правой консоли: кадр из окна вместе с корпусом корабля
   и показателями, готовый к сохранению. Стоит она дёшево, а даёт
   человеку то, ради чего он и полетел - свою картинку из космоса.

   Кадр собираем заново, а не тянем из буфера: без сохранения буфера
   рисования браузер отдаёт пустой холст, а включать сохранение ради
   одной кнопки значит платить памятью в каждом кадре. Поэтому
   рисуем сцену тут же и сразу снимаем. */
function shoot() {
  if (!W3 || !F.open) return;
  var T = g.THREE;
  try {
    W3.r.render(W3.scene, W3.cam);
    var src = W3.r.domElement;
    var W = src.width, H = src.height;
    var c = doc.createElement("canvas");
    c.width = W; c.height = H;
    var x = c.getContext("2d");
    x.drawImage(src, 0, 0);
    /* Корпус кабины поверх: снимок должен выглядеть так же, как
       кадр, который человек видел */
    if (ui.cab && ui.cab.complete && ui.cab.naturalWidth) {
      var iw = ui.cab.naturalWidth, ih = ui.cab.naturalHeight;
      var sc = Math.max(W / iw, H / ih);
      x.drawImage(ui.cab, (W - iw * sc) / 2, (H - ih * sc) / 2, iw * sc, ih * sc);
    }
    /* Подпись: где сняли и сколько узлов в сети на тот момент */
    var pad = Math.round(W * 0.03);
    x.font = "700 " + Math.round(W * 0.017) + "px 'Golos Text', system-ui, sans-serif";
    x.fillStyle = "rgba(226,238,252,.95)";
    x.textBaseline = "bottom";
    var where = (ui.cGoal && ui.cGoal.textContent !== "—") ? ui.cGoal.textContent
              : (RU ? "ОТКРЫТЫЙ КОСМОС" : "DEEP SPACE");
    x.fillText("ROCKET CDN · " + where + " · " +
      (RU ? "УЗЛОВ " : "NODES ") + netCount() + "/" + NET_TOTAL(), pad, H - pad);

    var url = c.toDataURL("image/png");
    var a = doc.createElement("a");
    a.href = url;
    a.download = "rocketcdn-" + where.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-") + ".png";
    doc.body.appendChild(a);
    a.click();
    setTimeout(function () { if (a.parentNode) a.parentNode.removeChild(a); }, 400);
    say(RU ? "СНИМОК СОХРАНЁН" : "SNAPSHOT SAVED", 1800);
    if (g.RC_SOUND && g.RC_SOUND.uiConfirm) { try { g.RC_SOUND.uiConfirm(); } catch (e) {} }
    if (g.RC_track) g.RC_track("flight", "shot");
  } catch (e) {
    say(RU ? "СНИМОК НЕ УДАЛСЯ" : "SNAPSHOT FAILED", 1800);
  }
}

/* ── Проекция цели над пультом ───────────────────────────────
   Маленький шар текущей цели крутится над приборной нишей, в двух
   обручах, как в рубке из кино. Это не украшение: пока цель далеко,
   она в кадре точкой, и понять, куда идёшь, нельзя. Проекция
   показывает её крупно и всё время.

   Собрана из самого мира: берём карту того же тела, к которому идём,
   поэтому проекция не может показать не то. Висит она на камере,
   значит держится в кадре при любом манёвре - как настоящий прибор,
   а не как объект, мимо которого пролетают. */
var proj = null, projFor = "";

function projBuild(w3) {
  if (proj || !w3) return;
  var T = g.THREE;
  proj = new T.Group();
  var ball = new T.Mesh(
    new T.SphereGeometry(0.055, 22, 16),
    new T.MeshBasicMaterial({ color: 0x8fd8f2, transparent: true, opacity: 0.9 })
  );
  proj.add(ball);
  proj.userData.ball = ball;
  /* Два обруча под углом: по ним читается объём и вращение */
  var ringMat = new T.MeshBasicMaterial({
    color: 0x5fc8ef, transparent: true, opacity: 0.5,
    blending: T.AdditiveBlending, depthWrite: false
  });
  var r1 = new T.Mesh(new T.TorusGeometry(0.082, 0.0022, 4, 44), ringMat);
  r1.rotation.x = Math.PI / 2.2;
  proj.add(r1);
  var r2 = new T.Mesh(new T.TorusGeometry(0.098, 0.0018, 4, 44), ringMat);
  r2.rotation.x = Math.PI / 2.6;
  r2.rotation.z = 0.6;
  proj.add(r2);
  proj.userData.rings = [r1, r2];
  /* Конус проектора снизу: проекция стоит над панелью, а не висит
     в воздухе сама по себе */
  var cone = new T.Mesh(
    new T.ConeGeometry(0.075, 0.16, 18, 1, true),
    new T.MeshBasicMaterial({
      color: 0x5fc8ef, transparent: true, opacity: 0.13,
      side: T.DoubleSide, blending: T.AdditiveBlending, depthWrite: false
    })
  );
  cone.position.y = -0.115;
  cone.rotation.x = Math.PI;
  proj.add(cone);
  /* Ниже и мельче: проекция стоит над плитой приборов, а не висит
     посреди остекления поверх настоящей цели */
  proj.position.set(0, -0.34, -0.86);
  proj.scale.setScalar(0.72);
  proj.renderOrder = 20;
  w3.cam.add(proj);
  if (!w3.cam.parent) w3.scene.add(w3.cam);
}

function projFrame(w3, dt) {
  if (F.stage) { if (proj) proj.visible = false; return; }
  projBuild(w3);
  if (!proj) return;
  /* Цель: та, к которой идём, или та, вокруг которой кружим */
  var id = F.goalId || (F.orbit && F.orbit.name ? "orbit" : "");
  var body = null;
  if (F.orbit && F.orbit.name) {
    for (var k in GOAL_NAMES) {
      if (GOAL_NAMES[k] === F.orbit.name) { id = k; break; }
    }
  }
  if (id && id !== "galaxy" && id !== "home") body = w3[id === "hole" ? "hole" : id];
  proj.visible = !!body;
  if (!body) { projFor = ""; return; }

  if (projFor !== id) {
    projFor = id;
    /* Карту берём у самого тела: если у него сложная группа, ищем
       первый меш с картой - так проекция всегда показывает то же,
       что видно за стеклом */
    var src = body.material && body.material.map ? body.material.map : null;
    if (!src && body.children) {
      for (var c = 0; c < body.children.length; c++) {
        if (body.children[c].material && body.children[c].material.map) {
          src = body.children[c].material.map; break;
        }
      }
    }
    var bm = proj.userData.ball.material;
    bm.map = src || null;
    bm.color.set(src ? 0xffffff : 0x8fd8f2);
    bm.opacity = src ? 0.92 : 0.85;
    bm.needsUpdate = true;
  }
  proj.userData.ball.rotation.y += dt * 0.55;
  proj.userData.rings[0].rotation.z += dt * 0.4;
  proj.userData.rings[1].rotation.z -= dt * 0.28;
}

/* ── Бортовые системы: расход и восполнение ──────────────────
   Энергия копится от светил: чем ближе звезда, тем быстрее заряд.
   Это не условность, а понятная логика - панели корабля работают
   от света. У чёрной дыры наоборот: корпус нагружается приливом, и
   целостность падает. Оба процесса медленные, чтобы решение
   «подойти ближе» имело цену, но не убивало за секунду.

   Числа держим в узде: заряд не уходит в минус и не переливается
   через край, целостность не опускается ниже четверти - игра не
   должна заканчиваться тупиком, из которого нет выхода. */
function powerFrame(w3, dt) {
  if (F.stage) return;
  var cam = w3.cam.position;
  var gain = 0.55;                       /* фон: реактор корабля */

  /* Свет звезды. Солнце стоит далеко и ярко, у чужих систем свои
     светила - берём ближайшее из тех, что в кадре мира. */
  var srcPos = w3.sunPos;
  if (uniIdx !== 0) {
    /* В чужом рукаве панели заряжает его звезда: берём ближайшую
       систему текущей вселенной */
    var pk2 = built[uniIdx];
    if (pk2 && pk2.root && pk2.root.children.length) {
      var bd2 = 1e9, bo2 = null;
      for (var ps = 0; ps < pk2.root.children.length; ps++) {
        var dd2 = cam.distanceTo(pk2.root.children[ps].position);
        if (dd2 < bd2) { bd2 = dd2; bo2 = pk2.root.children[ps]; }
      }
      if (bo2) srcPos = bo2.position;
    }
  }
  if (srcPos) {
    var d = cam.distanceTo(srcPos);
    if (d < 2600) gain += (1 - d / 2600) * 3.4;
  }
  /* Дыра: приливная нагрузка на корпус */
  var risk = 0;
  if (w3.hole) {
    var dh = cam.distanceTo(w3.hole.position);
    if (dh < 420) {
      risk = 1 - dh / 420;
      F.hull = Math.max(25, F.hull - risk * risk * 9 * dt);
      gain -= risk * 2.2;
    }
  }
  F.warn = risk;
  F.en = Math.max(0, Math.min(F.enMax, F.en + gain * dt));
  /* Целостность восстанавливается сама, но втрое медленнее, чем
     теряется: ремонт всегда дороже поломки */
  if (risk < 0.02 && F.hull < 100) F.hull = Math.min(100, F.hull + 1.1 * dt);
}

/* Списать заряд. Возвращает false, если не хватило - тогда
   действие не выполняется, а на табло идёт короткое сообщение.
   Молчаливого отказа быть не должно: человек обязан понимать,
   почему кнопка не сработала. */
function spend(cost, what) {
  if (F.en >= cost) { F.en -= cost; return true; }
  say((RU ? "НЕ ХВАТАЕТ ЗАРЯДА · " : "NOT ENOUGH POWER · ") +
      Math.round(F.en) + "/" + cost + (what ? " · " + what : ""), 2200);
  if (g.RC_SOUND && g.RC_SOUND.blip) { try { g.RC_SOUND.blip(180, 0.35, "sawtooth", 0.02); } catch (e) {} }
  return false;
}

/* Отрисовка бортовых стоек. Столбики стоят на скошенных боковинах
   корпуса - там, где на рисунке кабины и нарисованы приборы. */
var barsT = 0;
function barsFrame(ts) {
  if (!ui.bars || ts - barsT < 160) return;
  barsT = ts;
  var en = F.en / F.enMax, hu = F.hull / 100;
  ui.bars.style.setProperty("--en", (en * 100).toFixed(1) + "%");
  ui.bars.style.setProperty("--hull", (hu * 100).toFixed(1) + "%");
  ui.bars.classList.toggle("low", en < 0.22);
  ui.bars.classList.toggle("hurt", hu < 0.6);
  if (ui.enTx) ui.enTx.textContent = Math.round(F.en);
  if (ui.huTx) ui.huTx.textContent = Math.round(F.hull);
  /* Сигнальная лампа сближения: горит, когда корпус под нагрузкой */
  if (ui.wrap) ui.wrap.classList.toggle("rcf-alarm", F.warn > 0.25);
}

/* ── Скин панели: железо рисуется одним холстом ──────────────
   Требование владельца буквально: «кнопки должны быть не наклейкой,
   а частью панели управления». Значит корпуса клавиш, паз тяги,
   обод радара и стекло табло обязаны быть нарисованы В САМОЙ
   панели - одной текстурой, с общим металлом, общими бликами и
   общей фаской.

   Как это устроено. DOM-кнопки остаются прозрачными зонами нажатия
   (плюс чёткие SVG-иконки), а их «железо» рисует этот холст: он
   спрашивает у каждой кнопки её фактическое место и рисует корпус
   ровно там. Рисунок и зона нажатия не могут разъехаться - у них
   один источник координат. Пересборка только на resize, в кадре
   этот код не живёт. */
function deckSkin() {
  var deck = ui.wrap && ui.wrap.querySelector(".rcf-deck");
  var face = deck && deck.querySelector(".rcf-d-face");
  if (!face) return;
  /* Меряем в СОБСТВЕННЫХ координатах плоскости, а не экранных:
     панель наклонена перспективой, и getBoundingClientRect вернул бы
     уже спроецированный прямоугольник - рисунок железа разъехался бы
     с зонами нажатия. offsetLeft/offsetTop дают геометрию до
     трансформации, поэтому текстура ложится точно под клавиши. */
  var w = face.offsetWidth, h = face.offsetHeight;
  if (w < 20 || h < 20) return;
  var dpr = Math.min(2, g.devicePixelRatio || 1);
  var c = doc.createElement("canvas");
  c.width = Math.round(w * dpr);
  c.height = Math.round(h * dpr);
  var x = c.getContext("2d");
  x.scale(dpr, dpr);

  function ownX(el) {
    var v = 0;
    while (el && el !== face) { v += el.offsetLeft; el = el.offsetParent; }
    return v;
  }
  function ownY(el) {
    var v = 0;
    while (el && el !== face) { v += el.offsetTop; el = el.offsetParent; }
    return v;
  }
  function rr(px, py, pw, ph, r) {
    r = Math.min(r, pw / 2, ph / 2);
    x.beginPath();
    x.moveTo(px + r, py);
    x.arcTo(px + pw, py, px + pw, py + ph, r);
    x.arcTo(px + pw, py + ph, px, py + ph, r);
    x.arcTo(px, py + ph, px, py, r);
    x.arcTo(px, py, px + pw, py, r);
    x.closePath();
  }

  /* ── Корпус консоли ─────────────────────────────────────
     Металл темнеет к дальнему краю: плоскость уходит от зрителя,
     и верх обязан быть в тени, иначе панель читается плоской
     наклейкой, а не физической поверхностью. */
  /* Корпус целиком НЕ заливаем: панель встраивается в уже
     нарисованную консоль кабины, и сплошная плита закрыла бы её
     экраны. Железо рисуем только там, где стоят приборы. */
  var i;
  /* Ниши отсеков и их обвязка */
  var bays = face.querySelectorAll(".rcf-d-bay");
  for (i = 0; i < bays.length; i++) {
    var bx = ownX(bays[i]), bw = bays[i].offsetWidth;
    var by = ownY(bays[i]), bh = bays[i].offsetHeight;
    /* Отсек - металлическая вставка в консоль: плита с фаской,
       шлифовкой и тенью под ней. Именно она делает клавиши частью
       корабля, а не наклейкой поверх картинки. */
    var pad = 11;
    var pg2 = x.createLinearGradient(0, by - pad, 0, by + bh + pad);
    pg2.addColorStop(0, "rgba(28,48,68,.97)");
    pg2.addColorStop(0.42, "rgba(19,35,52,.97)");
    pg2.addColorStop(1, "rgba(9,19,32,.97)");
    rr(bx - pad, by - pad, bw + pad * 2, bh + pad * 2, 13);
    x.fillStyle = pg2;
    x.fill();
    x.strokeStyle = "rgba(4,10,18,.95)";
    x.lineWidth = 1.4;
    x.stroke();
    /* Шлифовка внутри вставки */
    x.save();
    rr(bx - pad, by - pad, bw + pad * 2, bh + pad * 2, 13);
    x.clip();
    for (var li = by - pad; li < by + bh + pad; li += 2) {
      x.fillStyle = "rgba(255,255,255," + (0.005 + 0.013 * Math.abs(Math.sin(li * 1.7))).toFixed(3) + ")";
      x.fillRect(bx - pad, li, bw + pad * 2, 1);
    }
    x.restore();
    /* Верхняя фаска и нижнее ребро */
    x.fillStyle = "rgba(200,228,248,.20)";
    x.fillRect(bx - pad + 4, by - pad + 1, bw + pad * 2 - 8, 1);
    x.fillStyle = "rgba(190,220,245,.10)";
    x.fillRect(bx - pad + 4, by + bh + pad - 2, bw + pad * 2 - 8, 1);
    /* Винты по углам отсека */
    var sc2 = [[bx - pad + 5, by - pad + 5], [bx + bw + pad - 5, by - pad + 5],
               [bx - pad + 5, by + bh + pad - 5], [bx + bw + pad - 5, by + bh + pad - 5]];
    for (var si = 0; si < sc2.length; si++) {
      x.fillStyle = "rgba(6,13,22,.95)";
      x.beginPath(); x.arc(sc2[si][0], sc2[si][1], 2.1, 0, 6.283); x.fill();
      x.fillStyle = "rgba(180,210,235,.18)";
      x.beginPath(); x.arc(sc2[si][0] - 0.6, sc2[si][1] - 0.7, 0.9, 0, 6.283); x.fill();
    }
  }

  /* ── Стекло табло ──────────────────────────────────────── */
  var top = face.querySelector(".rcf-d-top");
  if (top) {
    var ty = ownY(top), th = top.offsetHeight;
    var mg = x.createLinearGradient(0, ty, 0, ty + th);
    mg.addColorStop(0, "rgba(2,7,14,.9)");
    mg.addColorStop(1, "rgba(6,16,28,.78)");
    x.fillStyle = mg;
    rr(10, ty, w - 20, th, 7);
    x.fill();
    x.strokeStyle = "rgba(66,178,220,.24)";
    x.lineWidth = 1;
    x.stroke();
    x.fillStyle = "rgba(200,230,250,.06)";
    x.fillRect(12, ty + 1, w - 24, 2);
  }

  /* ── Гнёзда клавиш ─────────────────────────────────────── */
  function keyCap(px, py, pw, ph, on, warm) {
    /* Гнездо: тёмный паз под кэпом */
    rr(px - 2.5, py - 2.5, pw + 5, ph + 5, 11);
    x.fillStyle = "rgba(3,9,16,.9)";
    x.fill();
    /* Кэп: металл, верх ярче, низ в тени - клавиша выступает */
    var kg = x.createLinearGradient(0, py, 0, py + ph);
    if (on) {
      kg.addColorStop(0, warm ? "#4a3524" : "#27506c");
      kg.addColorStop(0.52, warm ? "#33241a" : "#173b57");
      kg.addColorStop(1, warm ? "#1d140e" : "#0d2438");
    } else {
      kg.addColorStop(0, "#26405a");
      kg.addColorStop(0.52, "#182d44");
      kg.addColorStop(1, "#0e1e30");
    }
    rr(px, py, pw, ph, 9);
    x.fillStyle = kg;
    x.fill();
    x.strokeStyle = on
      ? "rgba(" + (warm ? "255,170,110" : "120,210,245") + ",.85)"
      : "rgba(5,11,19,.95)";
    x.lineWidth = on ? 1.3 : 1;
    x.stroke();
    /* Блик по верхней фаске и тень у основания */
    x.fillStyle = "rgba(207,233,245,.22)";
    x.fillRect(px + 3, py + 1, pw - 6, 1);
    x.fillStyle = "rgba(0,0,0,.45)";
    x.fillRect(px + 3, py + ph - 2, pw - 6, 2);
    if (on) {
      /* Подсвеченная клавиша светит в паз вокруг себя */
      x.save();
      x.shadowColor = warm ? "rgba(255,170,110,.9)" : "rgba(66,178,220,.9)";
      x.shadowBlur = 14;
      rr(px, py, pw, ph, 9);
      x.strokeStyle = "rgba(0,0,0,0)";
      x.stroke();
      x.restore();
    }
  }

  var keys = face.querySelectorAll(".rcf-key");
  for (i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (!k.offsetWidth) continue;
    keyCap(ownX(k), ownY(k), k.offsetWidth, k.offsetHeight,
      k.classList.contains("cur") ||
      k.getAttribute("aria-pressed") === "true" ||
      k.getAttribute("aria-expanded") === "true",
      k.classList.contains("rcf-fire-key"));
  }

  /* ── Паз рычага тяги ───────────────────────────────────── */
  var thr = face.querySelector(".rcf-thr");
  if (thr && thr.offsetWidth) {
    var tx = ownX(thr), ty2 = ownY(thr), tw = thr.offsetWidth, th2 = thr.offsetHeight;
    rr(tx - 2.5, ty2 - 2.5, tw + 5, th2 + 5, 11);
    x.fillStyle = "rgba(3,9,16,.9)";
    x.fill();
    rr(tx, ty2, tw, th2, 9);
    x.fillStyle = "#060f1b";
    x.fill();
    x.strokeStyle = "rgba(5,11,19,.95)";
    x.lineWidth = 1;
    x.stroke();
    /* Насечки хода по верхней кромке паза */
    for (i = 1; i < 8; i++) {
      x.fillStyle = "rgba(130,175,205,.26)";
      x.fillRect(tx + tw * i / 8, ty2 + 3, 1, 4);
    }
    x.fillStyle = "rgba(0,0,0,.5)";
    x.fillRect(tx + 3, ty2 + 1, tw - 6, 2);
  }

  /* ── Обод радара ───────────────────────────────────────── */
  var rad = face.querySelector(".rcf-radar");
  if (rad && rad.offsetWidth) {
    var cx = ownX(rad) + rad.offsetWidth / 2;
    var cy = ownY(rad) + rad.offsetHeight / 2;
    var rr2 = rad.offsetWidth / 2;
    x.fillStyle = "rgba(3,9,16,.92)";
    x.beginPath(); x.arc(cx, cy, rr2 + 7, 0, 6.283); x.fill();
    var ring = x.createLinearGradient(0, cy - rr2, 0, cy + rr2);
    ring.addColorStop(0, "#33526f");
    ring.addColorStop(0.5, "#1c3247");
    ring.addColorStop(1, "#0a1725");
    x.strokeStyle = ring;
    x.lineWidth = 5.5;
    x.beginPath(); x.arc(cx, cy, rr2 + 4, 0, 6.283); x.stroke();
    x.strokeStyle = "rgba(66,178,220,.45)";
    x.lineWidth = 1;
    x.beginPath(); x.arc(cx, cy, rr2 + 1.4, 0, 6.283); x.stroke();
    /* Насечки по ободу - как на настоящем компасе */
    for (i = 0; i < 12; i++) {
      var a2 = i * Math.PI / 6;
      x.strokeStyle = "rgba(160,200,225,.3)";
      x.lineWidth = 1;
      x.beginPath();
      x.moveTo(cx + Math.cos(a2) * (rr2 + 2), cy + Math.sin(a2) * (rr2 + 2));
      x.lineTo(cx + Math.cos(a2) * (rr2 + 6), cy + Math.sin(a2) * (rr2 + 6));
      x.stroke();
    }
  }

  face.style.backgroundImage = "url(" + c.toDataURL("image/png") + ")";
  face.style.backgroundSize = "100% 100%";
}
var skinT = 0;
function deckSkinSoon() {
  clearTimeout(skinT);
  skinT = setTimeout(deckSkin, 120);
}

/* ── Рычаг тяги ──────────────────────────────────────────────
   Настоящая ручка, а не кнопка. Тянут её пальцем или мышью, и
   корабль набирает ход ровно настолько, насколько её сдвинули.
   Разница с колесом принципиальная: колесо это интерфейс, ручка -
   орган управления. Человек за ней чувствует машину.

   Ручка не пружинит обратно: отпустил на половине - идём на
   половине. Ноль внизу, полный ход вверху; можно уйти и в минус,
   это торможение. */
function bindThrottle() {
  var el = ui.thr;
  if (!el) return;
  var drag = false;

  function setFromY(clientX) {
    /* Рычаг лежит горизонтально: в плите высотой в десятую долю
       кадра вертикальному ходу просто нет места, а горизонтальный
       читается как ползунок тяги на настоящих пультах */
    var r = el.getBoundingClientRect();
    var t = (clientX - r.left) / Math.max(1, r.width);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    F.thr = t;
    /* Ход корабля берём не линейно: у самой ручки должен быть
       чувствительный участок на малых значениях, иначе первый же
       сантиметр отправляет корабль в разгон */
    F.v = t * t * 0.26;
    manual();
    paintThrottle();
  }
  function paintThrottle() {
    var t = F.thr || 0;
    if (ui.thrFill) ui.thrFill.style.width = (t * 100).toFixed(1) + "%";
    el.setAttribute("aria-valuenow", Math.round(t * 100));
    el.classList.toggle("live", t > 0.02);
  }
  F.paintThrottle = paintThrottle;

  el.addEventListener("pointerdown", function (e) {
    drag = true;
    try { el.setPointerCapture(e.pointerId); } catch (er) {}
    setFromY(e.clientX);
    e.preventDefault();
  });
  el.addEventListener("pointermove", function (e) { if (drag) setFromY(e.clientX); });
  el.addEventListener("pointerup", function () { drag = false; });
  el.addEventListener("pointercancel", function () { drag = false; });
  el.addEventListener("keydown", function (e) {
    var d = 0;
    if (e.key === "ArrowUp" || e.key === "ArrowRight") d = 0.08;
    else if (e.key === "ArrowDown" || e.key === "ArrowLeft") d = -0.08;
    else return;
    e.preventDefault();
    F.thr = Math.max(0, Math.min(1, (F.thr || 0) + d));
    F.v = F.thr * F.thr * 0.26;
    manual();
    paintThrottle();
  });
}

/* ── Радар системы ───────────────────────────────────────────
   Обзор сверху: корабль в середине, тела на своих орбитах, цель
   подсвечена. Считаем от настоящих позиций мира, поэтому радар не
   может соврать. Рисуем восемь раз в секунду - чаще незачем, а
   каждый кадр это лишний проход по холсту. */
var radarT = 0;
function radarFrame(w3, ts) {
  var cv = ui.radar;
  if (!cv || ts - radarT < 120) return;
  radarT = ts;
  var x = cv.getContext("2d");
  var W = cv.width, H = cv.height, R = W / 2 - 6;
  var cx = W / 2, cy = H / 2, i;
  x.clearRect(0, 0, W, H);

  /* Сетка: концентрические круги и перекрестье */
  x.strokeStyle = "rgba(95,200,239,.22)"; x.lineWidth = 1;
  for (i = 1; i <= 3; i++) {
    x.beginPath(); x.arc(cx, cy, R * i / 3, 0, Math.PI * 2); x.stroke();
  }
  x.beginPath();
  x.moveTo(cx - R, cy); x.lineTo(cx + R, cy);
  x.moveTo(cx, cy - R); x.lineTo(cx, cy + R);
  x.stroke();

  /* Развёртка: луч обегает круг */
  var a = (ts * 0.0009) % (Math.PI * 2);
  var sg = x.createConicGradient ? null : null;
  x.save();
  x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.clip();
  x.strokeStyle = "rgba(120,225,255,.55)"; x.lineWidth = 2;
  x.beginPath(); x.moveTo(cx, cy);
  x.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
  x.stroke();
  x.restore();

  /* Тела системы. Масштаб логарифмический: иначе Земля и дыра не
     помещаются на один экран - между ними тысячи единиц. */
  var bodies;
  if (uniIdx === 0) {
    bodies = [
      { o: w3.sun, c: "#ffd166", n: "С" },
      { o: w3.earth, c: "#5fd0ef", n: "З" },
      { o: w3.moon, c: "#c8d8e6", n: "Л" },
      { o: w3.mars, c: "#e08a5a", n: "М" },
      { o: w3.jupiter, c: "#e0b98a", n: "Ю" },
      { o: w3.saturn, c: "#e6c98a", n: "Ст" },
      { o: w3.hole, c: "#a974f5", n: "Д" }
    ];
  } else {
    /* В чужом рукаве радар показывает ЕГО системы, а не родную:
       прежний список рисовал Землю, которой в кадре нет */
    bodies = [];
    var pk = built[uniIdx];
    if (pk && pk.root) {
      for (var bs = 0; bs < pk.root.children.length && bodies.length < 7; bs++) {
        bodies.push({ o: pk.root.children[bs], c: "#9fd8ef", n: String(bs + 1) });
      }
    }
  }
  var cam = w3.cam.position;
  for (i = 0; i < bodies.length; i++) {
    var b = bodies[i];
    if (!b.o) continue;
    var dx = b.o.position.x - cam.x, dz = b.o.position.z - cam.z;
    var d = Math.sqrt(dx * dx + dz * dz);
    if (d < 0.001) continue;
    var rr = Math.log10(1 + d) / Math.log10(1 + 4200) * R;
    if (rr > R) rr = R;
    var ang = Math.atan2(dx, -dz);
    var px = cx + Math.sin(ang) * rr, py = cy - Math.cos(ang) * rr;
    x.fillStyle = b.c;
    x.beginPath(); x.arc(px, py, 4.2, 0, Math.PI * 2); x.fill();
    x.fillStyle = "rgba(226,238,252,.75)";
    x.font = "600 10px 'Golos Text', system-ui, sans-serif";
    x.fillText(b.n, px + 6, py + 3.5);
  }

  /* Корабль в середине, нос по курсу */
  var dir = w3.tmpB.set(0, 0, -1).applyQuaternion(w3.cam.quaternion);
  var ha = Math.atan2(dir.x, -dir.z);
  x.save();
  x.translate(cx, cy);
  x.rotate(ha);
  x.fillStyle = "#eaf6ff";
  x.beginPath();
  x.moveTo(0, -8); x.lineTo(5, 6); x.lineTo(0, 3); x.lineTo(-5, 6);
  x.closePath(); x.fill();
  x.restore();
}

/* ── Салон корабля внутри мира игры ──────────────────────────
   Строится один раз и стоит вокруг точки, с которой начинается
   полёт. Собственной сцены у салона нет и быть не может: именно
   две сцены и порождали подмену, которую владелец назвал сменой
   «нарисованного на такое».

   Место салона выведено из финала, а не подобрано: в конце
   подъезда камера обязана оказаться ровно в точке старта полёта,
   на расстоянии CAM_WIN от остекления. Отсюда центр помещения
   лежит позади этой точки на (радиус минус CAM_WIN), а его ноль
   азимута смотрит туда же, куда камера в первом кадре полёта.
   Тогда последний кадр салона и первый кадр игры - один и тот же
   кадр, и склеивать нечего. */
var cabin = null;
var CAM_WIN = 1.42;              /* от глаз до остекления в финале */

function cabinBuild() {
  if (cabin || !W3 || !g.RC_CABIN) return cabin;
  var T = g.THREE;
  var portrait = innerHeight > innerWidth;
  /* Плоскость корпуса в проёме подбираем так, чтобы на финальном
     ракурсе она проецировалась ровно во весь кадр - тогда подмена
     её плоской рамкой в момент старта не видна ничем. */
  var fovR = W3.fov0 * Math.PI / 180;
  /* Корпус стоит НЕ в самом проёме, а на шаг внутрь помещения, и
     это не произвол. Плоскость шириной во весь кадр, поставленная у
     стены, углами вылезает за цилиндр обшивки - и стена закрывает
     ей края. Отсюда щели по бокам, которые и были видны. На метре с
     небольшим от глаз углы укладываются внутрь радиуса, а сам
     корпус по-прежнему закрывает кадр целиком. */
  var dist = 0.92;
  /* Плоская рамка полёта выводится по object-fit: cover, то есть
     показывает не всю картинку, а её середину, обрезая лишнее по
     длинной стороне. Трёхмерный корпус обязан повторять ровно это,
     иначе в момент старта картинка дёргается - именно эту подмену
     владелец и ловил третьим пунктом.

     Считаем как cover: берём то измерение кадра, которого не
     хватает, и растягиваем плоскость по пропорциям самой картинки.
     Тогда 3D-корпус и плоская рамка совпадают пиксель в пиксель. */
  var iw = portrait ? 768 : 1344, ih = portrait ? 1344 : 768;
  var frameH = 2 * Math.tan(fovR / 2) * dist;          /* высота кадра в мире */
  var frameW = frameH * (innerWidth / Math.max(1, innerHeight));
  var fh, fw;
  if (iw / ih >= innerWidth / Math.max(1, innerHeight)) {
    /* Картинка шире кадра: cover упирается в высоту */
    fh = frameH;
    fw = fh * (iw / ih);
  } else {
    /* Кадр шире картинки: cover упирается в ширину */
    fw = frameW;
    fh = fw * (ih / iw);
  }
  cabin = g.RC_CABIN.build(T, {
    tiny: innerWidth < 760,
    cabSrc: portrait ? "assets/gen/cockpit-tall-v2.webp" : "assets/gen/cockpit-wide-v2.webp",
    cabW: fw, cabH: fh, cabZ: dist, camWin: CAM_WIN
  });

  /* Куда смотрит камера в первом кадре полёта */
  var p0 = W3.path.getPointAt(0);
  var look0 = (W3.looks && W3.looks[0] && W3.looks[0].at) ? W3.looks[0].at : new T.Vector3(0, 0, 0);
  var dir = new T.Vector3().subVectors(look0, p0);
  var yaw0 = Math.atan2(dir.x, -dir.z);        /* азимут этого направления */
  var flat = new T.Vector3(dir.x, 0, dir.z).normalize();

  cabin.group.rotation.y = yaw0;
  /* Центр помещения позади финальной точки: вперёд по взгляду до
     стены остаётся ровно CAM_WIN */
  var back = cabin.R - CAM_WIN;
  cabin.center = new T.Vector3(
    p0.x - flat.x * back,
    p0.y - cabin.eye,                          /* пол под глазами */
    p0.z - flat.z * back
  );
  cabin.group.position.copy(cabin.center);
  /* Корпус кабины переезжает НА КАМЕРУ. Стоя в помещении, он висел
     по горизонту салона, а камера в финале смотрит с наклоном - и
     плоская рамка полёта, которая всегда центрирована по кадру,
     оказывалась смещённой относительно него на десяток пикселей.
     Именно это двоение владелец и называл подменой рисованной
     панели на настоящую.

     На камере корпус занимает ровно то же место, что плоская рамка,
     при любом наклоне и на любом экране. Виден он только у окна:
     прозрачность ведёт доля подъезда. */
  if (cabin.frame) {
    cabin.group.remove(cabin.frame);
    cabin.frame.position.set(0, 0, -dist);
    cabin.frame.rotation.set(0, 0, 0);
    cabin.frame.renderOrder = 18;
    W3.cam.add(cabin.frame);
    if (!W3.cam.parent) W3.scene.add(W3.cam);
  }
  cabin.yaw0 = yaw0;
  cabin.p0 = p0.clone();
  /* Ориентация камеры в финале - та же, что в первом кадре полёта */
  var m = new T.Matrix4().lookAt(p0, look0, new T.Vector3(0, 1, 0));
  cabin.q1 = new T.Quaternion().setFromRotationMatrix(m);
  cabin.qTmp = new T.Quaternion();
  cabin.eTmp = new T.Euler(0, 0, 0, "YXZ");
  cabin.vTmp = new T.Vector3();
  W3.scene.add(cabin.group);
  return cabin;
}

function cabinFlightMode() {
  if (!cabin || !W3 || cabin.flightMode) return;
  cabin.flightMode = true;
  /* Preserve the physical cabin and bind it to the flight camera.
     The old hand-off deleted it and revealed cockpit.webp. */
  W3.cam.attach(cabin.group);
  cabin.group.updateMatrixWorld(true);
}

function cabinDrop() {
  if (!cabin || !W3) return;
  if (cabin.frame && cabin.frame.parent) cabin.frame.parent.remove(cabin.frame);
  if (cabin.group && cabin.group.parent) cabin.group.parent.remove(cabin.group);
  if (ui && ui.wrap) ui.wrap.classList.remove("rcf-native-cab");
  cabin = null;
}

/* Постановка кадра в салоне.

   Оборот ведёт прокрутка страницы: доля приходит из сцены сайта,
   которая знает, где какой раздел. Камера не летает по комнате -
   она стоит в середине и поворачивается, а к концу подступает к
   остеклению. Экраны при этом не двигаются вовсе: они часть стен,
   и «наверх ничто не уходит», как и требовалось. */
function stageCam(dt) {
  var C = cabin, T = g.THREE, w3 = W3;
  var I = g.RC_INTERIOR;
  var yawT = (I && I.yaw) ? I.yaw() : 0;
  var k = F.stageK || 0;
  /* Косинус перенормирован так, чтобы приходить ровно в единицу на
     0.96 доли с нулевой скоростью: прежняя жёсткая ступенька в конце
     давала видимый толчок кадра при переходе в игру */
  var kk = Math.min(1, k / 0.96);
  var ek = 0.5 - 0.5 * Math.cos(Math.PI * kk);

  /* Оборот сходится к нулю по мере подъезда: в конце камера
     смотрит строго в окно, иначе проём уедет вбок */
  /* ГЛАВНЫЙ источник дёрганого финала. Оборот в rc-interior сходится
     к ПОЛНОМУ кругу (TAU), а прежняя формула гасила yaw к нулю - на
     подъезде камера раскручивалась обратно на все триста шестьдесят
     градусов. Теперь довод идёт по короткой дуге к полному кругу:
     та же точка обзора, но без обратного вращения. */
  /* Финал и игра используют один и тот же пилотский ракурс. Старый
     круговой обход заставлял зрителя смотреть на пустые синие стены,
     а к старту внезапно подменял их настоящей приборной рамой. Теперь
     мы остаёмся лицом к остеклению с самого шага через люк; движение
     сохраняется как очень небольшой параллакс головы, а не как тур
     по декорации. Это тот же 3D-мир и та же камера, с которой через
     секунду начинается управление кораблём. */
  var survey = Math.sin(yawT) * (1 - ek) * 0.055;
  var yaw = Math.PI * 2 + survey;
  F.stageYaw = yaw;

  /* Дыхание: человек не штатив. На подъезде затухает - там кадр
     обязан встать намертво. */
  F.stageT = (F.stageT || 0) + dt;
  var calm = 1 - ek;
  var drift = Math.sin(F.stageT / 5.5) * 0.02 * calm;
  var bob = Math.sin(F.stageT / 3.2) * 0.012 * calm;

  /* Положение: от середины помещения к финальной точке */
  var eyeY = C.center.y + C.eye + bob;
  C.vTmp.set(C.center.x, eyeY, C.center.z);
  C.vTmp.lerp(C.p0, ek);
  w3.cam.position.copy(C.vTmp);

  /* Поворот: пока идёт оборот - свой азимут, к финалу сходимся к
     ориентации первого кадра полёта, вместе с её наклоном */
  var pit = (I && I.pitch) ? I.pitch() : 0;
  C.eTmp.set(pit * (1 - ek) * 0.18, C.yaw0 - yaw + drift, 0);
  C.qTmp.setFromEuler(C.eTmp);
  w3.cam.quaternion.copy(C.qTmp).slerp(C.q1, ek * ek);

  if (w3.cam.fov !== w3.fov0) { w3.cam.fov = w3.fov0; w3.cam.updateProjectionMatrix(); }

  /* Корпус кабины в проёме проявляется к концу подъезда: до этого
     мы видим сам проём и настоящую раму, а рисунок корпуса
     подхватывает кадр ровно там, где совпадает с плоской рамкой
     полёта. Опережать нельзя - иначе он повиснет в воздухе. */
  if (C.frame) {
    /* Корпус, в который встроена игровая консоль, виден сразу после
       входа. Раньше opacity=0 до 62% подъезда и человек несколько
       экранов видел другой, схематичный салон — это и воспринималось
       как подмена панели. */
    var fo = 0.94 + ek * 0.06;
    C.frame.material.opacity = fo;
    C.frame.visible = true;
  }
  /* Свет пульта разгорается вместе с подходом, а общий свет
     помещения к концу подъезда гаснет. Это не приём ради приёма:
     когда человек садится за панель, кадр обязан принадлежать
     остеклению и космосу за ним, а не подсвеченным стенам за
     спиной. Заодно уходит светлая полоска стены, которая иначе
     видна по краю корпуса. */
  /* ── Салон красит то, что за окном ────────────────────────
     Свет из остекления не выдуман: за ним Земля, и она отражает на
     стены голубое. Берём направление на планету и её расстояние -
     чем ближе, тем сильнее подсвет, и тем заметнее холодная нота на
     дальней половине помещения.

     Это ровно то, чего не хватало прежней рубке: там свет из окна
     был постоянным, и комната не реагировала на мир вокруг. */
  if (C.lamp && w3.earth) {
    var d = w3.cam.position.distanceTo(w3.earth.position);
    var near = Math.max(0, Math.min(1, 1 - (d - 60) / 420));
    C.lamp.intensity = (1.5 + near * 1.9) * (1 - Math.max(0, Math.min(1, (ek - 0.55) / 0.4)) * 0.55);
    /* Тон от планеты: у Земли он холодный синий, к её ночной
       стороне уходит в фиолет */
    C.lamp.color.setRGB(0.55 + near * 0.18, 0.72 + near * 0.16, 0.95);
  }
  if (C.refl) {
    /* Отражение ярче, когда за стеклом светло: на ночной стороне
       стекло почти чистое */
    var lit = w3.earth ? Math.max(0, Math.min(1, 1 - w3.cam.position.distanceTo(w3.earth.position) / 400)) : 0.4;
    C.refl.material.opacity = 0.08 + lit * 0.10;
    if (C.reflLip) C.reflLip.material.opacity = 0.16 + lit * 0.16;
  }

  /* Гул к пульту чуть плотнее: приборы просыпаются */
  if (g.RC_SOUND && g.RC_SOUND.flightLevel) {
    var lvl = 0.12 + ek * 0.1;
    if (Math.abs(lvl - (F.humLvl || 0)) > 0.02) {
      F.humLvl = lvl;
      try { g.RC_SOUND.flightLevel(lvl); } catch (e) {}
    }
  }

  var dim = Math.max(0, Math.min(1, (ek - 0.55) / 0.4));
  if (C.deskLight) C.deskLight.intensity = 0.9 + ek * 1.9;
  if (C.hemi) C.hemi.intensity = 1.45 * (1 - dim * 0.92);
  if (C.ceilL) C.ceilL.intensity = 1.35 * (1 - dim * 0.95);
  if (C.warmL) C.warmL.intensity = 1.7 * (1 - dim * 0.95);
  /* Диоды дышат */
  if (C.diodes && !ui.wrap.classList.contains("rcf-fast")) {
    for (var i = 0; i < C.diodes.length; i++) {
      var d = C.diodes[i];
      var b = 0.55 + 0.45 * Math.sin(F.stageT * 1.7 + d.userData.ph);
      d.material.transparent = true;
      d.material.opacity = b;
    }
  }
}

/* ── Кабина как финал сайта ──────────────────────────────────
   Раньше финал рисовала своя трёхмерная рубка: свой корпус, своё
   остекление, своя нарисованная планета. Получались два разных
   корабля подряд - один на сайте, другой в игре, и владелец увидел
   это сразу: «панель не та, которая в игре, я говорил - та панель
   (рамка), которая в игре, 1:1 она же в ракете, и фон тот же, космос
   с Землёй как в игре 1:1».

   Теперь финал и игра - буквально один слой. Тот же корпус кабины,
   тот же мир, та же Земля, та же камера. Разница ровно в двух вещах:
   в режиме сцены корабль стоит и приборов на стекле нет, а по нажатию
   старта они зажигаются и корабль трогается. Никакой склейки между
   сайтом и игрой не существует - её нечему разделять.

   Доля k ведёт подъезд: 0 - камера отведена назад (кадр «панель чуть
   дальше»), 1 - ровно ракурс старта полёта. */
function stage(k) {
  /* Отрицательная доля - команда убрать салон совсем. Ноль это не
     «выключено», а «вошли, но ещё не подступили к панели»: салон в
     этот момент как раз и нужен целиком. */
  if (k == null || k < 0) { stageOff(); return; }
  k = k > 1 ? 1 : k;
  if (F.open && !F.stage) return;            /* игра уже идёт - не мешаем */
  if (!g.THREE) {
    /* Объёмный слой ещё грузится: попробуем, когда доедет */
    if (!stage._wait) {
      stage._wait = 1;
      addEventListener("rc:3d", function once () {
        removeEventListener("rc:3d", once);
        stage._wait = 0;
        if (F.stageK > 0.002) stage(F.stageK);
      });
    }
    F.stageK = k;
    return;
  }
  buildUI();
  if (!F.built) {
    try { W3 = buildWorld(); } catch (e) {
      try { console.error("rc-flight: мир сцены не собрался -", e); } catch (e2) {}
      return;
    }
    F.built = true;
    netRestore();
  }
  F.stageK = k;
  if (ui.wrap) ui.wrap.style.setProperty("--rcf-stage", k.toFixed(3));
  if (F.stage) return;

  F.stage = true;
  F.open = true;                              /* кадр рисуется тем же циклом */
  if (ui.wrap) ui.wrap.classList.remove("rcf-native-cab");
  cabinBuild();
  /* Гул корабля в салоне. Тише, чем в полёте: двигатель на холостом,
     работает вентиляция и приборы. Без него помещение читается
     картинкой - в кино корабль всегда слышно. */
  if (g.RC_SOUND) {
    try {
      if (g.RC_SOUND.flight) g.RC_SOUND.flight(true);
      if (g.RC_SOUND.flightLevel) g.RC_SOUND.flightLevel(0.13);
    } catch (e) {}
  }
  F.p = 0; F.v = 0; F.last = 0;
  F.away = false;
  F.look.x = F.look.y = F.look.tx = F.look.ty = 0;
  F.free = false;
  cabSrc();
  if (ui.cab) {
    if (ui.cab.complete && ui.cab.naturalWidth) ui.wrap.classList.add("has-cab");
    else ui.cab.onload = function () { if (ui.wrap) ui.wrap.classList.add("has-cab"); };
  }
  /* ── Разгрузка салона ────────────────────────────────────
     Из окна корабля виден только ближний космос: Земля, Луна и
     звёзды. Дальние галактики, туманности, пояс астероидов и
     планеты-гиганты в кадр не попадают, но честно рендерятся -
     и именно на них уходил кадр в финале сайта. Гасим их на время
     салона и возвращаем при старте полёта. */
  stageLite(true);
  ui.wrap.classList.add("on", "rcf-stage");
  /* Класс на корне гасит трёхмерную рубку сайта: два корабля в одном
     кадре - это и есть тот самый шов, ради которого всё затевалось */
  root.classList.add("rc-stage");
  size();
  if (!F.raf) F.raf = requestAnimationFrame(frame);
}

/* Тяжёлые дальние слои мира: в салоне они не видны из окна, а
   стоят дороже всего остального вместе взятого */
function stageLite(on) {
  if (!W3) return;
  var far = [W3.milky, W3.gal2, W3.gal3, W3.nebSprites, W3.belt1, W3.belt2,
             W3.jupiter, W3.uranus, W3.neptune, W3.mercury, W3.venus,
             W3.hole, W3.comet, W3.saturn, W3.mars,
             /* Солнце дороже всех: его поверхность считает шейдер
                конвекции на каждый пиксель. Из окна салона звезда
                не видна - она за кормой. */
             W3.sun, W3.sunGlow, W3.corIn, W3.corOut];
  for (var i = 0; i < far.length; i++) {
    var o = far[i];
    if (!o) continue;
    if (o.length) { for (var j = 0; j < o.length; j++) if (o[j]) o[j].visible = !on; }
    else o.visible = !on;
  }
  /* Плотность пикселей в салоне ниже: кадр статичный, камера едет
     по прокрутке, и разница на глаз не видна */
  if (W3.r) {
    var dpr = g.devicePixelRatio || 1;
    var step = parseInt(root.getAttribute("data-degrade") || "0", 10) || 0;
    var hint = parseInt(root.getAttribute("data-quality-hint") || "0", 10) || 0;
    var cap = on ? 1.15 : (tiny ? 1.0 : (innerWidth < 760 ? 1.35 : 1.8));
    cap -= Math.max(step, hint > 1 ? hint - 1 : 0) * 0.16;
    W3.r.setPixelRatio(Math.max(0.72, Math.min(dpr, cap)));
  }
}

/* Adaptive quality changes resolution and distant effects only. */
addEventListener("rc:degrade", function () {
  if (W3) stageLite(!!F.stage);
});

function stageOff() {
  stageLite(false);
  F.stageK = 0;
  /* The last scroll segment can already have promoted the parked
     stage into an active flight. Reverse scrolling is still an exit
     command: route it through the complete flight teardown instead
     of returning early and leaving the fixed canvas above the page. */
  if (!F.stage && F.open) { close(); return; }
  if (!F.stage) {
    if (ui.wrap) ui.wrap.classList.remove("on", "rcf-stage", "rcf-native-cab", "rcf-seam");
    root.classList.remove("rc-stage", "rc-flying");
    inertPage(false);
    return;
  }
  cabinDrop();
  /* Вышли из корабля назад по странице - гул смолкает */
  if (g.RC_SOUND && g.RC_SOUND.flight && !F.open) { try { g.RC_SOUND.flight(false); } catch (e) {} }
  F.stage = false;
  F.open = false;
  if (F.raf) { cancelAnimationFrame(F.raf); F.raf = null; }
  if (ui.wrap) ui.wrap.classList.remove("on", "rcf-stage");
  /* Reverse scrolling is an unconditional return to the website.
     Clear a stray flying flag and release inert content as a safety
     net even if another frame promoted the stage to flight while the
     exit gesture was already in progress. */
  root.classList.remove("rc-stage", "rc-flying");
  inertPage(false);
}

g.RC_FLIGHT = {
  open: open, close: close, stage: stage,
  state: function () {
    return {
      сцена: !!F.stage, подъезд: +(F.stageK || 0).toFixed(2),
      салон: !!cabin, оборот: F.stage ? +((F.stageYaw || 0) * 57.3).toFixed(0) : null,
      полёт: !!F.open && !F.stage
    };
  },
  /* Служебные ходы приёмки: поставить корабль в любую точку маршрута
     и вызвать финал, не проходя игру целиком. Стоят за признаком в
     адресе (?rcdbg=1) - в обычной сборке молчат. */
  _pilot: function () {
    if (!DBG) return;
    pilotShown = false;
    var t = NET_TOTAL; NET_TOTAL = function () { return netCount(); };
    pilotCard(); NET_TOTAL = t;
  },
  _set: function (v) {
    if (!DBG) return;
    F.p = Math.max(0, Math.min(1, v)); F.goal = null; F.orbit = null;
  },
  _dbg: function () {
    if (!W3) return null;
    var d = new g.THREE.Vector3(); W3.cam.getWorldDirection(d);
    var e = new g.THREE.Vector3(0, 0, 0).sub(W3.cam.position).normalize();
    return { pos: W3.cam.position.toArray().map(Math.round),
             dir: d.toArray().map(function(v){return +v.toFixed(2)}),
             toEarth: e.toArray().map(function(v){return +v.toFixed(2)}),
             угол: +(Math.acos(Math.max(-1,Math.min(1,d.dot(e)))) * 57.3).toFixed(1) };
  },
  state: function () {
    return { открыт: F.open, собран: F.built, p: +F.p.toFixed(3), v: +F.v.toFixed(5),
             вселенная: uniIdx, цель: F.goalId || F.goalName || null,
             отметки: W3 && W3.at ? W3.at : null };
  },
  /* Отладочные рычаги для автопроверок: поставить корабль в нужную
     точку маршрута и прыгнуть в заданную вселенную. Через обычный
     интерфейс на это уходят десятки секунд полёта, а снимать кадры
     надо в конкретных местах. */
  seek: function (p) {
    if (!F.open) return null;
    F.goal = null; F.orbit = null; F.away = false; F.auto = false;
    F.p = Math.max(0, Math.min(1, p));
    F.v = 0;
    return F.p;
  },
  jump: function (i) { jumpUniverse(i); return uniIdx; },
  /* Сколько всего рисуется: вершины, точки, вызовы отрисовки.
     Нужно, чтобы новые эффекты не пролезли мимо бюджета. */
  stats: function () {
    if (!W3) return null;
    var info = W3.r.info;
    var pts = 0, obj = 0;
    W3.scene.traverse(function (o) {
      obj++;
      if (o.isPoints && o.geometry && o.geometry.attributes.position) {
        pts += o.geometry.attributes.position.count;
      }
    });
    return { треугольники: info.render.triangles, вызовы: info.render.calls,
             точки: pts, объектов: obj, текстур: info.memory.textures,
             геометрий: info.memory.geometries };
  },
  /* Проверки столкновений: прогоняем весь маршрут и смотрим, не
     задевает ли он тела. Пригодилось при настройке манёвра обхода
     и остаётся как быстрый способ проверить правку дуги. */
  probe: function (steps) {
    if (!W3) return null;
    var n = steps || 400, out = [], bs = W3.bodies || [];
    var v = new g.THREE.Vector3();
    for (var i = 0; i <= n; i++) {
      W3.path.getPointAt(i / n, v);
      for (var j = 0; j < bs.length; j++) {
        var d = v.distanceTo(bs[j].o.position);
        var lim = bs[j].r * 1.5 + 26;
        if (d < lim) out.push({ тело: bs[j].name, p: +(i / n).toFixed(3),
                                дистанция: Math.round(d), предел: Math.round(lim) });
      }
    }
    return { заходов_в_зону: out.length, точки: out.slice(0, 12) };
  },
  cam: function () {
    if (!W3) return null;
    var bs = W3.bodies || [], near = [];
    for (var j = 0; j < bs.length; j++) {
      near.push({ тело: bs[j].name, d: Math.round(W3.cam.position.distanceTo(bs[j].o.position)),
                  корпус: bs[j].r });
    }
    return { позиция: W3.cam.position.toArray().map(Math.round), тела: near,
             увод: dodge ? +dodge.length().toFixed(1) : 0 };
  }
};

if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", launchers);
else launchers();

})(window);

