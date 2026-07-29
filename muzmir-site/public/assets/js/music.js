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
  let btn, btnIcon, btnLabel;
  let userWantsOn = localStorage.getItem(LS_KEY) === '1' || localStorage.getItem(LS_KEY) === null; // по умолчанию ВКЛ

  function createBtn() {
    if (btn) return;
    btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'mz-music-btn';
    btn.setAttribute('aria-label', 'Фоновая музыка');
    btn.innerHTML =
      '<span class="mz-music-ic">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>' +
      '</svg></span>' +
      '<span class="mz-music-lbl">Музыка</span>' +
      '<span class="mz-music-wave"><i></i><i></i><i></i><i></i></span>';
    document.body.appendChild(btn);
    btnIcon = btn.querySelector('.mz-music-ic');
    btnLabel = btn.querySelector('.mz-music-lbl');
    btn.addEventListener('click', toggle);
    updateBtn();
  }

  function updateBtn() {
    if (!btn) return;
    btn.classList.toggle('is-on', userWantsOn && ready && !audio?.paused);
    btn.classList.toggle('is-off', !userWantsOn);
    btnLabel.textContent = userWantsOn ? (ready ? 'Играет' : 'Загрузка…') : 'Музыка';
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

  async function toggle() {
    userWantsOn = !userWantsOn;
    localStorage.setItem(LS_KEY, userWantsOn ? '1' : '0');
    if (userWantsOn) {
      await playCurrent();
    } else if (audio) {
      fade(0, 500);
      setTimeout(() => audio.pause(), 520);
    }
    updateBtn();
  }

  // Первый gesture-listener на случай если браузер не пустил autoplay
  function armGesture() {
    const once = async () => {
      if (userWantsOn && (!audio || audio.paused)) {
        await playCurrent();
        updateBtn();
      }
      document.removeEventListener('click', once, true);
      document.removeEventListener('touchstart', once, true);
      document.removeEventListener('keydown', once, true);
    };
    document.addEventListener('click', once, true);
    document.addEventListener('touchstart', once, true);
    document.addEventListener('keydown', once, true);
  }

  function init() {
    createBtn();
    if (userWantsOn) {
      playCurrent().then(() => { if (!ready || audio?.paused) armGesture(); });
    }
    // при смене видимости страницы — приглушаем/восстанавливаем
    document.addEventListener('visibilitychange', () => {
      if (!audio || !userWantsOn) return;
      if (document.hidden) fade(0.10, 400);
      else fade(0.35, 800);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.MzMusic = { toggle, next };
})();
