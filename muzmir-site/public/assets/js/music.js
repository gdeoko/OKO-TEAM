/**
 * Фоновая классическая музыка КЦ «Музыкальный Мир» — БЕЗ видимого плеера.
 * Играет всегда при входе. Браузеры блокируют автозапуск звука до первого касания —
 * поэтому гарантированно стартуем на ПЕРВОМ же взаимодействии (тап/скролл/клик),
 * вызывая play() СИНХРОННО (источник задан заранее). Выключить можно только в настройках профиля.
 *
 * Важно: НЕ ставим audio.crossOrigin — многие радио-стримы не отдают CORS-заголовки,
 * и с crossOrigin='anonymous' воспроизведение молча блокируется.
 */
(function () {
  if (window.MzMusic) return;
  const SS_STREAM = 'mz-music-stream-idx';
  const SS_TRACK  = 'mz-music-track-idx';
  let audio, playlist = null, mode = 'stream', tries = 0, started = false;

  // Чистим возможный залипший флаг «выключено» от старого плеера (был баг с паузой).
  try { localStorage.removeItem('mz-music-off'); } catch (e) {}
  // Выключить музыку можно ТОЛЬКО в настройках профиля (стамп window.MZ_MUSIC_OFF из PHP).
  let userWantsOn = window.MZ_MUSIC_OFF !== true;

  function ensureAudio() {
    if (audio) return;
    audio = new Audio();
    audio.preload = 'auto';
    audio.volume = 0;
    audio.setAttribute('playsinline', '');
    audio.addEventListener('canplay', () => fade(0.32, 1600));
    audio.addEventListener('playing', () => { started = true; });
    audio.addEventListener('ended', next);
    audio.addEventListener('error', onError);
    audio.addEventListener('stalled', onError);
  }

  function fade(target, ms) {
    if (!audio) return;
    const from = audio.volume, delta = target - from, start = performance.now();
    (function step(t) {
      const p = Math.min(1, (t - start) / ms);
      audio.volume = Math.max(0, Math.min(1, from + delta * p));
      if (p < 1) requestAnimationFrame(step);
    })(performance.now());
  }

  function pickSrc() {
    const p = playlist; if (!p) return '';
    if (mode === 'stream' && p.streams && p.streams.length) {
      const si = Number(sessionStorage.getItem(SS_STREAM) || 0) % p.streams.length;
      return p.streams[si].url;
    }
    if (p.tracks && p.tracks.length) {
      const ti = Number(sessionStorage.getItem(SS_TRACK) || 0) % p.tracks.length;
      return p.tracks[ti].url;
    }
    return '';
  }

  function setSrc() {
    ensureAudio();
    const s = pickSrc();
    if (s && audio.src !== s) audio.src = s;
    return s;
  }

  // Синхронный запуск (без await перед play() — иначе теряется «разрешение от касания»).
  function play() {
    if (!userWantsOn) return;
    if (!setSrc()) return;
    const pr = audio.play();
    if (pr && pr.catch) pr.catch(function () {});
  }

  function onError() {
    tries++; if (tries > 10) return;
    if (mode === 'stream') {
      const p = playlist || {};
      const si = Number(sessionStorage.getItem(SS_STREAM) || 0) + 1;
      if (si < ((p.streams && p.streams.length) || 0)) sessionStorage.setItem(SS_STREAM, String(si));
      else mode = 'tracks';
    } else {
      const p = playlist || { tracks: [] };
      if (p.tracks && p.tracks.length) {
        sessionStorage.setItem(SS_TRACK, String((Number(sessionStorage.getItem(SS_TRACK) || 0) + 1) % p.tracks.length));
      }
    }
    play();
  }

  function next() {
    if (!(playlist && playlist.tracks && playlist.tracks.length)) return;
    mode = 'tracks';
    sessionStorage.setItem(SS_TRACK, String((Number(sessionStorage.getItem(SS_TRACK) || 0) + 1) % playlist.tracks.length));
    fade(0, 500);
    setTimeout(play, 520);
  }

  // Гарантированный старт с первого взаимодействия — play() вызывается СИНХРОННО в обработчике.
  function armGesture() {
    const evs = ['pointerdown', 'touchstart', 'touchend', 'click', 'keydown', 'scroll', 'wheel', 'mousemove'];
    function go() {
      if (!userWantsOn) { cleanup(); return; }
      if (!audio || audio.paused) play();
      if (started) cleanup();
    }
    function cleanup() { evs.forEach(function (e) { document.removeEventListener(e, go, true); }); }
    evs.forEach(function (e) { document.addEventListener(e, go, true); });
  }

  async function init() {
    try {
      const r = await fetch('/assets/music/playlist.json', { cache: 'force-cache' });
      playlist = await r.json();
    } catch (_) { playlist = { streams: [], tracks: [] }; }
    if (!sessionStorage.getItem(SS_TRACK) && playlist.tracks && playlist.tracks.length) {
      sessionStorage.setItem(SS_TRACK, String(Math.floor(Math.random() * playlist.tracks.length)));
    }
    ensureAudio();
    setSrc();          // источник задан заранее — чтобы play() на жесте был синхронным
    play();            // попытка автозапуска (может быть заблокирована)
    armGesture();      // …тогда стартанёт на первом касании
    document.addEventListener('visibilitychange', function () {
      if (!audio || audio.paused) return;
      fade(document.hidden ? 0.10 : 0.32, 500);
    });
  }

  // Для настроек профиля: включить/выключить фоновую музыку на лету.
  function setEnabled(on) {
    userWantsOn = !!on;
    if (on) { tries = 0; play(); }
    else if (audio) { fade(0, 300); setTimeout(function () { try { audio.pause(); } catch (e) {} }, 320); }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.MzMusic = { play: play, next: next, setEnabled: setEnabled,
    isPlaying: function () { return !!(audio && !audio.paused && audio.currentTime > 0); } };
})();
