/* Инструментовка главного потока. Ставится ДО скриптов страницы. */
export const ИНСТР = () => {
  const W = window;
  W.__ЛАГ = {
    setProperty: 0, cssText: 0, styleAttr: 0,
    rafSchedule: 0, rafCallbacks: 0,
    timers: { setInterval: 0, setTimeout: 0 },
    активныеИнтервалы: new Set(),
    forcedLayout: 0,          /* чтение геометрии после записи в стиль в одном кадре */
    forcedSpots: {},          /* где именно */
    longtasks: [], shifts: 0,
    reads: { rect: 0, offset: 0, computed: 0, scroll: 0 },
    кадры: 0,
    грязно: false,            /* был ли записан стиль с прошлого чтения */
    послед: ""                /* стек последней записи */
  };
  const L = W.__ЛАГ;

  const стек = () => {
    const s = (new Error()).stack || "";
    const l = s.split("\n").slice(2, 7)
      .map(x => x.trim().replace(/^at\s+/, ""))
      .find(x => /\.js|\.html/.test(x) && !/__ЛАГ|лаг-инстр/.test(x));
    return (l || "?").replace(/^.*?\/assets\//, "assets/").replace(/\?v=\d+/, "").slice(0, 90);
  };

  const пометитьЗапись = () => { L.грязно = true; L.послед = стек(); };
  const пометитьЧтение = (вид) => {
    L.reads[вид]++;
    if (L.грязно) {
      L.forcedLayout++;
      const к = L.послед + "  →ЧИТАЕТ " + вид + " @ " + стек();
      L.forcedSpots[к] = (L.forcedSpots[к] || 0) + 1;
      L.грязно = false;
    }
  };

  /* ── записи в стиль ── */
  const sp = CSSStyleDeclaration.prototype.setProperty;
  CSSStyleDeclaration.prototype.setProperty = function (...a) { L.setProperty++; пометитьЗапись(); return sp.apply(this, a); };
  const ct = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, "cssText");
  if (ct && ct.set) Object.defineProperty(CSSStyleDeclaration.prototype, "cssText", {
    get: ct.get, configurable: true,
    set: function (v) { L.cssText++; пометитьЗапись(); return ct.set.call(this, v); }
  });
  const sa = Element.prototype.setAttribute;
  Element.prototype.setAttribute = function (n, v) {
    if (n === "style") { L.styleAttr++; пометитьЗапись(); }
    return sa.call(this, n, v);
  };
  /* прямые присвоения el.style.transform = ... : ловим через прокси на популярных свойствах */
  ["transform","opacity","left","top","width","height","display","visibility","filter","backgroundColor"].forEach(p => {
    const d = Object.getOwnPropertyDescriptor(CSSStyleDeclaration.prototype, p);
    if (d && d.set) Object.defineProperty(CSSStyleDeclaration.prototype, p, {
      get: d.get, configurable: true,
      set: function (v) { L.setProperty++; пометитьЗапись(); return d.set.call(this, v); }
    });
  });

  /* ── чтения геометрии ── */
  const gbcr = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function () { пометитьЧтение("rect"); return gbcr.call(this); };
  ["offsetWidth","offsetHeight","offsetTop","offsetLeft","clientWidth","clientHeight"].forEach(p => {
    const d = Object.getOwnPropertyDescriptor(HTMLElement.prototype, p) ||
              Object.getOwnPropertyDescriptor(Element.prototype, p);
    if (d && d.get) Object.defineProperty(d.get === (Object.getOwnPropertyDescriptor(HTMLElement.prototype, p)||{}).get ? HTMLElement.prototype : Element.prototype, p, {
      configurable: true, get: function () { пометитьЧтение("offset"); return d.get.call(this); }
    });
  });
  ["scrollTop","scrollHeight","scrollWidth"].forEach(p => {
    const d = Object.getOwnPropertyDescriptor(Element.prototype, p);
    if (d && d.get) Object.defineProperty(Element.prototype, p, {
      configurable: true, get: function () { пометитьЧтение("scroll"); return d.get.call(this); },
      set: d.set
    });
  });
  const gcs = W.getComputedStyle;
  W.getComputedStyle = function (...a) { пометитьЧтение("computed"); return gcs.apply(W, a); };

  /* ── rAF ── */
  const raf = W.requestAnimationFrame;
  W.__rafOwners = {};
  W.requestAnimationFrame = function (cb) {
    L.rafSchedule++;
    const о = стек();
    W.__rafOwners[о] = (W.__rafOwners[о] || 0) + 1;
    return raf.call(W, function (t) { L.rafCallbacks++; L.грязно = false; return cb(t); });
  };

  /* ── таймеры ── */
  const si = W.setInterval;
  W.setInterval = function (f, d, ...r) { L.timers.setInterval++; const id = si.call(W, f, d, ...r); L.активныеИнтервалы.add(id); return id; };
  const ci = W.clearInterval;
  W.clearInterval = function (id) { L.активныеИнтервалы.delete(id); return ci.call(W, id); };
  const st = W.setTimeout;
  W.setTimeout = function (...a) { L.timers.setTimeout++; return st.apply(W, a); };

  /* ── длинные задачи и сдвиги ── */
  try {
    new PerformanceObserver(l => l.getEntries().forEach(e => L.longtasks.push(Math.round(e.duration)))).observe({ type: "longtask", buffered: true });
  } catch (e) {}
  try {
    new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) L.shifts += e.value; })).observe({ type: "layout-shift", buffered: true });
  } catch (e) {}

  /* счётчик кадров */
  (function тик() { L.кадры++; raf.call(W, тик); })();

  W.__ЛАГсброс = () => {
    L.setProperty = L.cssText = L.styleAttr = 0;
    L.rafSchedule = L.rafCallbacks = 0;
    L.forcedLayout = 0; L.forcedSpots = {};
    L.reads = { rect: 0, offset: 0, computed: 0, scroll: 0 };
    L.longtasks = []; L.кадры = 0; L.shifts = 0;
    W.__rafOwners = {};
    L.timers = { setInterval: 0, setTimeout: 0 };
  };
  W.__ЛАГснять = () => ({
    записи: { setProperty: L.setProperty, cssText: L.cssText, styleAttr: L.styleAttr },
    чтения: { ...L.reads },
    принудительныйПересчёт: L.forcedLayout,
    точки: Object.entries(L.forcedSpots).sort((a, b) => b[1] - a[1]).slice(0, 12),
    rafЗаказов: L.rafSchedule, rafВызовов: L.rafCallbacks,
    rafВладельцы: Object.entries(W.__rafOwners).sort((a, b) => b[1] - a[1]).slice(0, 15),
    кадры: L.кадры,
    длинныеЗадачи: L.longtasks.slice().sort((a, b) => b - a),
    суммаДлинных: L.longtasks.reduce((a, b) => a + b, 0),
    сдвиг: +L.shifts.toFixed(4),
    таймеры: { ...L.timers, активныхИнтервалов: L.активныеИнтервалы.size }
  });
};

/* backdrop-filter слои */
export const СЛОИ = () => {
  const из = { backdrop: [], filter: [], willChange: [], fixed: 0, всего: 0 };
  document.querySelectorAll("*").forEach(э => {
    из.всего++;
    const s = getComputedStyle(э);
    const bf = s.backdropFilter || s.webkitBackdropFilter;
    const вид = s.display !== "none" && s.visibility !== "hidden" && +s.opacity > 0.01;
    const кто = (э.tagName + "." + (э.className || "").toString().split(" ").filter(Boolean).slice(0, 2).join(".")).slice(0, 60);
    if (bf && bf !== "none") из.backdrop.push({ кто, bf: bf.slice(0, 40), вид });
    if (s.filter && s.filter !== "none") из.filter.push({ кто, f: s.filter.slice(0, 40), вид });
    if (s.willChange && s.willChange !== "auto") из.willChange.push({ кто, w: s.willChange.slice(0, 30), вид });
    if (s.position === "fixed") из.fixed++;
  });
  return {
    всегоУзлов: из.всего,
    backdropВсего: из.backdrop.length, backdropВидимых: из.backdrop.filter(x => x.вид).length,
    backdropПримеры: из.backdrop.filter(x => x.вид).slice(0, 14),
    filterВсего: из.filter.length, filterВидимых: из.filter.filter(x => x.вид).length,
    filterПримеры: из.filter.filter(x => x.вид).slice(0, 10),
    willChangeВсего: из.willChange.length, willChangeПримеры: из.willChange.slice(0, 10),
    fixed: из.fixed
  };
};
