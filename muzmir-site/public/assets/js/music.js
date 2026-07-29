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
  // Без кнопки — фоновая музыка всегда ВКЛ. Пользователь не отключает вручную.
  let userWantsOn = true;
  function updateBtn() { /* no-op — плеер без UI */ }

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
    audio.addEventListener('canplay', () => { ready = true; fade(0.35, 1600); updateBtn(); });
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

  function toggle() { /* no-op */ }

  // Первый gesture — обязательно (браузеры блокируют autoplay без user interaction).
  // Ловим любое взаимодействие: клик, тап, скролл, клавиша, движение мыши.
  function armGesture() {
    const events = ['pointerdown','touchstart','click','keydown','scroll','wheel','mousemove'];
    const once = async () => {
      if (!audio || audio.paused) {
        try { await playCurrent(); } catch (_) {}
      }
      events.forEach(ev => document.removeEventListener(ev, once, true));
      window.removeEventListener('scroll', once, true);
    };
    events.forEach(ev => document.addEventListener(ev, once, true));
    window.addEventListener('scroll', once, true);
  }

  function init() {
    // Пробуем autoplay сразу; если браузер не пустит — стартанёт при первом взаимодействии.
    playCurrent().then(() => { if (!ready || (audio && audio.paused)) armGesture(); });
    // при смене видимости страницы — приглушаем/восстанавливаем
    document.addEventListener('visibilitychange', () => {
      if (!audio) return;
      if (document.hidden) fade(0.10, 400);
      else fade(0.35, 800);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.MzMusic = { toggle, next };
})();
