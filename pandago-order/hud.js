/* ═══════════════════════════════════════════════════════════════
   PandaGo Cargo · Игровой HUD поверх скролл-путешествия

   Слева сверху: этап миссии и название точки маршрута.
   Справа сверху: живые координаты (Гуанчжоу -> Улан-Батор -> Москва).
   Снизу: полоса прохождения маршрута и процент.
   Кнопка звука: эмбиент через WebAudio, включается только вручную.

   Чистый HTML/CSS/JS, pointer-events: none (кроме кнопки звука).
   На мобильных остаётся компактная нижняя полоса и чип этапа.
   При prefers-reduced-motion HUD статичен, но виден.
   ═══════════════════════════════════════════════════════════════ */

/* Этапы привязаны к реальным секциям: точки пересчитываются от их
   положения на странице, поэтому не съезжают при изменении контента */
const STAGE_DEFS = [
  { sel: '#hero',       code: 'ЭТАП 01 / 06', name: 'ГУАНЧЖОУ · СКЛАД' },
  { sel: '#calculator', code: 'ЭТАП 02 / 06', name: 'РАСЧЁТ МАРШРУТА' },
  { sel: '#teardown',   code: 'ЭТАП 03 / 06', name: 'ПРИЁМКА · РАЗБОР' },
  { sel: '#cinema',     code: 'ЭТАП 04 / 06', name: 'ТРАССА · НОЧЬ' },
  { sel: '#compare',    code: 'ЭТАП 05 / 06', name: 'КОРИДОР МОНГОЛИЯ' },
  { sel: '#faq',        code: 'ЭТАП 06 / 06', name: 'МОСКВА · ВЫДАЧА' },
];
let STAGES = [{ at: 0, code: STAGE_DEFS[0].code, name: STAGE_DEFS[0].name }];

function calcStages() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  if (max <= 0) return;
  STAGES = STAGE_DEFS
    .map((d) => {
      const el = document.querySelector(d.sel);
      if (!el) return null;
      const top = el.getBoundingClientRect().top + window.scrollY;
      return { at: Math.max(0, (top - window.innerHeight * 0.4) / max), code: d.code, name: d.name };
    })
    .filter(Boolean)
    .sort((a, b) => a.at - b.at);
  if (STAGES.length) STAGES[0].at = 0;
}

/* опорные точки маршрута: широта, долгота */
const GEO = [
  { at: 0.00, lat: 23.13, lon: 113.26 },   /* Гуанчжоу */
  { at: 0.50, lat: 47.89, lon: 106.91 },   /* Улан-Батор */
  { at: 1.00, lat: 55.75, lon: 37.61 },    /* Москва */
];

function geoAt(p) {
  let a = GEO[0], b = GEO[GEO.length - 1];
  for (let i = 0; i < GEO.length - 1; i++) {
    if (p >= GEO[i].at && p <= GEO[i + 1].at) { a = GEO[i]; b = GEO[i + 1]; break; }
  }
  const k = (p - a.at) / Math.max(b.at - a.at, 1e-6);
  return { lat: a.lat + (b.lat - a.lat) * k, lon: a.lon + (b.lon - a.lon) * k };
}

export function initHud() {
  const hud = document.createElement('div');
  hud.className = 'hud';
  hud.setAttribute('aria-hidden', 'true');
  hud.innerHTML = `
    <div class="hud-corner hud-tl"></div>
    <div class="hud-corner hud-tr"></div>
    <div class="hud-stage">
      <span class="hud-code" id="hudCode">ЭТАП 01 / 06</span>
      <span class="hud-name" id="hudName">ГУАНЧЖОУ · СКЛАД</span>
    </div>
    <div class="hud-geo" id="hudGeo">23.13 N · 113.26 E</div>
    <div class="hud-route">
      <span class="hud-route-label">МАРШРУТ</span>
      <span class="hud-route-bar"><span class="hud-route-fill" id="hudFill"></span></span>
      <span class="hud-route-pct" id="hudPct">0%</span>
    </div>`;
  document.body.appendChild(hud);

  /* кнопка звука: интерактивна, живёт отдельно от pointer-events:none */
  const sndBtn = document.createElement('button');
  sndBtn.className = 'hud-snd';
  sndBtn.type = 'button';
  sndBtn.setAttribute('aria-label', 'Включить фоновый звук');
  sndBtn.setAttribute('aria-pressed', 'false');
  sndBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path class="snd-on" d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13"/></svg>`;
  document.body.appendChild(sndBtn);

  const codeEl = hud.querySelector('#hudCode');
  const nameEl = hud.querySelector('#hudName');
  const geoEl = hud.querySelector('#hudGeo');
  const fillEl = hud.querySelector('#hudFill');
  const pctEl = hud.querySelector('#hudPct');

  let stageIdx = 0;
  let smooth = 0;
  let raw = 0;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const readScroll = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    raw = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
  };
  window.addEventListener('scroll', readScroll, { passive: true });
  readScroll();
  calcStages();
  window.addEventListener('resize', calcStages, { passive: true });
  setTimeout(calcStages, 1500);   /* после загрузки шрифтов и раскладки */

  /* ── Звук: эмбиент-гул из WebAudio, без файлов ── */
  let audio = null;
  function makeAudio() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
    const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 320; filt.connect(master);
    const mk = (freq, det) => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = det;
      const g = ctx.createGain(); g.gain.value = 0.05; o.connect(g); g.connect(filt); o.start(); return o;
    };
    mk(55, 0); mk(55, 7); mk(110, -5);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoG = ctx.createGain(); lfoG.gain.value = 90;
    lfo.connect(lfoG); lfoG.connect(filt.frequency); lfo.start();
    return {
      ctx, master, filt,
      tick() { /* короткий щелчок на смену этапа */
        const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 880;
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
        o.connect(g); g.connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.2);
      },
    };
  }
  let sndOn = false;
  sndBtn.addEventListener('click', () => {
    sndOn = !sndOn;
    sndBtn.setAttribute('aria-pressed', String(sndOn));
    sndBtn.classList.toggle('on', sndOn);
    sndBtn.setAttribute('aria-label', sndOn ? 'Выключить фоновый звук' : 'Включить фоновый звук');
    if (sndOn) {
      if (!audio) audio = makeAudio();
      audio.ctx.resume();
      audio.master.gain.linearRampToValueAtTime(0.5, audio.ctx.currentTime + 1.2);
    } else if (audio) {
      audio.master.gain.linearRampToValueAtTime(0, audio.ctx.currentTime + 0.6);
    }
  });

  function setStage(i) {
    if (i === stageIdx) return;
    stageIdx = i;
    codeEl.textContent = STAGES[i].code;
    nameEl.textContent = STAGES[i].name;
    nameEl.classList.remove('hud-flash');
    requestAnimationFrame(() => nameEl.classList.add('hud-flash'));
    if (sndOn && audio) audio.tick();
  }

  function loop() {
    requestAnimationFrame(loop);
    smooth += (raw - smooth) * (reduced ? 1 : 0.12);
    const p = smooth;

    /* HUD оживает, когда путешествие началось; в hero не дублирует заголовок */
    hud.classList.toggle('hud-live', p > 0.045);

    let i = 0;
    for (let s = STAGES.length - 1; s >= 0; s--) { if (p >= STAGES[s].at) { i = s; break; } }
    setStage(i);

    const g = geoAt(p);
    geoEl.textContent = `${g.lat.toFixed(2)} N · ${g.lon.toFixed(2)} E`;
    fillEl.style.transform = `scaleX(${p})`;
    pctEl.textContent = Math.round(p * 100) + '%';

    /* фоновый гул чуть ярче в движении */
    if (sndOn && audio) {
      const v = Math.abs(raw - p);
      audio.filt.frequency.value = 320 + Math.min(v * 14000, 900);
    }
  }
  requestAnimationFrame(loop);
}
