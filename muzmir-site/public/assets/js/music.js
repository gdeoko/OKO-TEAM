/**
 * Фоновая классическая музыка для КЦ «Музыкальный Мир».
 * Стратегия: 1) Classic FM live-стрим (24/7, автосмена популярной классики Beethoven/Mozart/Chopin/Vivaldi/…);
 * 2) при недоступности стрима — 40 треков из archive.org (public domain) в случайном порядке;
 * 3) плавные fade in/out, ненавязчивая мини-кнопка в углу, состояние в localStorage,
 * 4) autoplay при загрузке — с уважением browser policy (если заблокировано, ждём первый клик).
 */
(function () {
  if (window.MzMusic) return; // защита от повторной инициализации
  const LS_KEY = 'mz-music-on';
  const SS_STREAM = 'mz-music-stream-idx';
  const SS_TRACK  = 'mz-music-track-idx';
  const $ = (s, r) => (r || document).querySelector(s);

  let audio, gain, ctx, source, playlist = null, mode = 'stream', idx = 0, tries = 0, ready = false;
  let nowTitle = '';
  // Фоновая музыка ВКЛ по умолчанию (даже без регистрации). Выключить можно из настроек профиля.
  // Приоритет: window.MZ_MUSIC_OFF (стамп из PHP при user.music_off=1) > localStorage флаг
  let userWantsOn = true;
  try {
    if (window.MZ_MUSIC_OFF === true) userWantsOn = false;
    if (localStorage.getItem('mz-music-off') === '1') userWantsOn = false;
  } catch (e) {}

  // Видимый мини-плеер «Радио Классика» в углу.
  function playing() { return !!(audio && !audio.paused && audio.currentTime >= 0 && !audio.error); }
  function updateBtn() {
    const box = document.getElementById('mzRadio');
    if (!box) return;
    const on = playing();
    box.setAttribute('data-on', on ? '1' : '0');
    const now = document.getElementById('mzRadioNow');
    if (now) now.textContent = on ? (nowTitle || 'Классическая музыка') : 'Нажмите, чтобы включить';
  }
  function curTitle() {
    const p = playlist;
    if (!p) return '';
    if (mode === 'stream' && p.streams?.length) {
      const si = Number(sessionStorage.getItem(SS_STREAM) || 0) % p.streams.length;
      return p.streams[si].title || 'Классическое радио';
    }
    if (p.tracks?.length) {
      const ti = Number(sessionStorage.getItem(SS_TRACK) || 0) % p.tracks.length;
      const t = p.tracks[ti];
      return t ? ((t.composer ? t.composer + ' — ' : '') + (t.title || '')) : 'Классика';
    }
    return '';
  }

  async function loadPlaylist() {
    if (playlist) return playlist;
    try {
      const r = await fetch('/assets/music/playlist.json', { cache: 'force-cache' });
      playlist = await r.json();
    } catch (_) { playlist = { streams: [], tracks: [] }; }
    // при первом старте — случайный трек, чтобы у разных пользователей был разный
    if (!sessionStorage.getItem(SS_TRACK) && playlist.tracks?.length) {
      sessionStorage.setItem(SS_TRACK, String(Math.floor(Math.random() * playlist.tracks.length)));
    }
    return playlist;
  }

  function ensureAudio() {
    if (audio) return;
    audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
    audio.volume = 0; // старт с 0, потом fade in
    audio.addEventListener('canplay', () => { ready = true; nowTitle = curTitle(); fade(0.35, 1600); updateBtn(); });
    audio.addEventListener('playing', () => { nowTitle = curTitle(); updateBtn(); });
    audio.addEventListener('pause', updateBtn);
    audio.addEventListener('ended', next);
    audio.addEventListener('error', onError);
    audio.addEventListener('stalled', onError);
  }

  function fade(target, ms) {
    if (!audio) return;
    const from = audio.volume, delta = target - from, start = performance.now();
    function step(t) {
      const p = Math.min(1, (t - start) / ms);
      audio.volume = Math.max(0, Math.min(1, from + delta * p));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  async function playCurrent() {
    ensureAudio();
    await loadPlaylist();
    const p = playlist;
    let src = '';
    if (mode === 'stream' && p.streams?.length) {
      const si = Number(sessionStorage.getItem(SS_STREAM) || 0) % p.streams.length;
      src = p.streams[si].url;
    } else if (p.tracks?.length) {
      const ti = Number(sessionStorage.getItem(SS_TRACK) || 0) % p.tracks.length;
      src = p.tracks[ti].url;
    }
    if (!src) return;
    audio.src = src;
    try {
      await audio.play();
    } catch (_) {
      // browser blocked autoplay — ждём клика (btn всё равно виден, кнопка сработает как gesture)
      ready = false; updateBtn();
    }
  }

  function onError() {
    tries++;
    if (tries > 6) return;
    // stream → fallback на треки; трек → следующий
    if (mode === 'stream') {
      const p = playlist || { streams: [] };
      const si = (Number(sessionStorage.getItem(SS_STREAM) || 0) + 1);
      if (si < (p.streams?.length || 0)) {
        sessionStorage.setItem(SS_STREAM, String(si));
      } else {
        mode = 'tracks';
      }
    } else {
      next();
      return;
    }
    playCurrent();
  }

  function next() {
    const p = playlist || { tracks: [] };
    if (!p.tracks?.length) return;
    const ti = (Number(sessionStorage.getItem(SS_TRACK) || 0) + 1) % p.tracks.length;
    sessionStorage.setItem(SS_TRACK, String(ti));
    fade(0, 700);
    setTimeout(() => { mode = 'tracks'; playCurrent(); }, 720);
  }

  // Пауза/пуск по кнопке радио-плеера.
  async function toggle() {
    try {
      if (playing()) {
        fade(0, 350);
        setTimeout(() => { if (audio) audio.pause(); updateBtn(); }, 360);
        try { localStorage.setItem('mz-music-off', '1'); } catch (_) {}
      } else {
        try { localStorage.removeItem('mz-music-off'); } catch (_) {}
        if (disarm) disarm(); // радио-плеер — единственный источник управления
        tries = 0;
        await playCurrent();
        updateBtn();
      }
    } catch (_) { updateBtn(); }
  }

  // Первый gesture — обязательно (браузеры блокируют autoplay без user interaction).
  // Ловим любое взаимодействие: клик, тап, скролл, клавиша, движение мыши.
  let disarm = null;
  function armGesture() {
    const events = ['pointerdown','touchstart','click','keydown','scroll','wheel','mousemove'];
    const once = async (e) => {
      // Тап по самому радио-плееру обрабатывает его собственный обработчик (toggle),
      // иначе гонка: авто-старт по жесту + toggle → музыка гаснет тем же кликом.
      if (e && e.target && e.target.closest && e.target.closest('#mzRadio')) return;
      if (!audio || audio.paused) { try { await playCurrent(); updateBtn(); } catch (_) {} }
      teardown();
    };
    function teardown(){
      events.forEach(ev => document.removeEventListener(ev, once, true));
      window.removeEventListener('scroll', once, true);
      disarm = null;
    }
    events.forEach(ev => document.addEventListener(ev, once, true));
    window.addEventListener('scroll', once, true);
    disarm = teardown;
  }

  // Клик по видимому радио-плееру = явный gesture + пауза/пуск.
  function wireWidget() {
    const box = document.getElementById('mzRadio');
    if (!box || box.dataset.wired) return;
    box.dataset.wired = '1';
    const onTap = (e) => { e.preventDefault(); e.stopPropagation(); toggle(); };
    box.addEventListener('click', onTap);
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') onTap(e); });
    updateBtn();
  }

  function init() {
    wireWidget();
    // Пробуем autoplay сразу; если браузер не пустит — стартанёт при первом взаимодействии.
    if (userWantsOn) {
      playCurrent().then(() => { if (!ready || (audio && audio.paused)) armGesture(); updateBtn(); });
    } else {
      updateBtn();
    }
    // при смене видимости страницы — приглушаем/восстанавливаем (только если играем)
    document.addEventListener('visibilitychange', () => {
      if (!audio || audio.paused) return;
      if (document.hidden) fade(0.10, 400);
      else fade(0.35, 800);
    });
    // SPA перерисовывает <main>, но плеер вне <main>; на всякий случай перецепляем при навигации
    document.addEventListener('mz:navigated', () => { wireWidget(); updateBtn(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.MzMusic = { toggle, next };
})();
