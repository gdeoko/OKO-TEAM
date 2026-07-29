/* ===== PWA module: service worker, установка, offline, sync, share =====
   Всё под префиксом pwa*, без эмодзи, обе темы, без внешних зависимостей.
   Экспорт наружу:
     window.okoPwaShare({title,text,url})   — Web Share API + fallback на clipboard
     window.okoPwaEnqueue(kind, payload)    — положить действие в офлайн-очередь IDB
     window.okoPwaSetSyncHandler(kind, fn)  — зарегистрировать хендлер отправки
     window.okoPwaFlushQueue()              — попытка синхронизации сейчас
*/
(function pwaModule(){
  'use strict';

  const IS_HTTPS       = location.protocol === 'https:';
  const IS_LOCAL       = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  const IS_STANDALONE  = window.matchMedia('(display-mode: standalone)').matches
                      || window.matchMedia('(display-mode: window-controls-overlay)').matches
                      || window.navigator.standalone === true;
  const UA             = navigator.userAgent || '';
  const IS_IOS         = /iPad|iPhone|iPod/.test(UA) && !window.MSStream;
  const IS_IOS_SAFARI  = IS_IOS && /Safari/i.test(UA) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(UA);
  const LS_DECLINED    = 'oko-pwa-declined-at';
  const LS_FIRST_SEEN  = 'oko-pwa-first-seen-at';
  const LS_INSTALLED   = 'oko-pwa-installed';
  const LS_IOS_HINT    = 'oko-pwa-ios-hint-at';
  const DECLINE_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000; /* 30 дней */
  const PROMPT_DELAY_MS     = 30 * 1000;                /* 30 сек после первого захода */

  /* --------- state --------- */
  let deferredPrompt = null;
  let installTimer   = null;
  let iosTimer       = null;
  let reloadedOnce   = false;
  let waitingWorker  = null;

  /* --------- helpers --------- */
  function safeToast(msg){
    try { if (typeof window.toast === 'function') window.toast(msg); }
    catch(e){}
  }
  function nowTs(){ return Date.now(); }
  function readTs(key){ try { return +localStorage.getItem(key) || 0; } catch(e){ return 0; } }
  function writeTs(key, val){ try { localStorage.setItem(key, String(val)); } catch(e){} }
  function delTs(key){ try { localStorage.removeItem(key); } catch(e){} }

  function markProfileInstalled(){
    try {
      if (window.PROFILE) window.PROFILE.pwaInstalled = true;
      writeTs(LS_INSTALLED, 1);
    } catch(e){}
  }

  function pwaInstalledOrDeclinedRecently(){
    if (readTs(LS_INSTALLED)) return true;
    if (IS_STANDALONE) return true;
    const declined = readTs(LS_DECLINED);
    if (declined && (nowTs() - declined) < DECLINE_COOLDOWN_MS) return true;
    return false;
  }

  /* --------- INSTALL PROMPT (Android/desktop) --------- */
  function showInstallBanner(){
    const el = document.getElementById('pwa-install');
    if (!el) return;
    el.classList.add('pwa-show');
    el.setAttribute('aria-hidden', 'false');
  }
  function hideInstallBanner(){
    const el = document.getElementById('pwa-install');
    if (!el) return;
    el.classList.remove('pwa-show');
    el.setAttribute('aria-hidden', 'true');
  }

  window.pwaTriggerInstall = async function(){
    if (!deferredPrompt) { hideInstallBanner(); return; }
    try {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice && choice.outcome === 'accepted'){
        markProfileInstalled();
        safeToast('OKO установлено');
      } else {
        writeTs(LS_DECLINED, nowTs());
      }
    } catch(e){}
    deferredPrompt = null;
    hideInstallBanner();
  };

  window.pwaDismissInstall = function(persist){
    if (persist) writeTs(LS_DECLINED, nowTs());
    hideInstallBanner();
  };

  window.addEventListener('beforeinstallprompt', ev => {
    ev.preventDefault();
    deferredPrompt = ev;
    if (pwaInstalledOrDeclinedRecently()) return;
    clearTimeout(installTimer);
    installTimer = setTimeout(() => {
      if (!deferredPrompt || pwaInstalledOrDeclinedRecently()) return;
      showInstallBanner();
    }, PROMPT_DELAY_MS);
  });

  window.addEventListener('appinstalled', () => {
    hideInstallBanner();
    hideIosHint();
    markProfileInstalled();
    delTs(LS_DECLINED);
    safeToast('OKO установлено на главный экран');
  });

  /* --------- iOS: свой tooltip (у iOS Safari нет beforeinstallprompt) --------- */
  function showIosHint(){
    const el = document.getElementById('pwa-ios');
    if (!el) return;
    el.classList.add('pwa-show');
    el.setAttribute('aria-hidden', 'false');
  }
  function hideIosHint(){
    const el = document.getElementById('pwa-ios');
    if (!el) return;
    el.classList.remove('pwa-show');
    el.setAttribute('aria-hidden', 'true');
  }
  window.pwaDismissIos = function(persist){
    if (persist) writeTs(LS_IOS_HINT, nowTs());
    hideIosHint();
  };

  function maybeScheduleIosHint(){
    if (!IS_IOS_SAFARI) return;
    if (IS_STANDALONE) return;
    const shown = readTs(LS_IOS_HINT);
    if (shown && (nowTs() - shown) < DECLINE_COOLDOWN_MS) return;
    clearTimeout(iosTimer);
    iosTimer = setTimeout(showIosHint, PROMPT_DELAY_MS);
  }

  /* --------- OFFLINE indicator + sync trigger --------- */
  function paintOffline(){
    const el = document.getElementById('pwa-offline');
    const off = !navigator.onLine;
    if (el) el.classList.toggle('pwa-show', off);
    document.body.classList.toggle('pwa-offline-shift', off);
    if (!off) { setTimeout(flushSyncQueue, 300); }
  }
  window.addEventListener('online',  paintOffline);
  window.addEventListener('offline', paintOffline);

  /* --------- UPDATE toast (появление нового SW) --------- */
  function showUpdateToast(w){
    waitingWorker = w || waitingWorker;
    const el = document.getElementById('pwa-update');
    if (!el) return;
    el.classList.add('pwa-show');
  }
  function hideUpdateToast(){
    const el = document.getElementById('pwa-update');
    if (!el) return;
    el.classList.remove('pwa-show');
  }
  window.pwaApplyUpdate = function(){
    hideUpdateToast();
    try {
      if (waitingWorker) waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } catch(e){}
    setTimeout(() => { try { location.reload(); } catch(e){} }, 250);
  };

  /* --------- SERVICE WORKER --------- */
  async function registerSW(){
    if (!('serviceWorker' in navigator)) return;
    if (!IS_HTTPS && !IS_LOCAL) return;

    /* убираем устаревшие регистрации (был /sw.js в старой сборке) */
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const r of regs){
        const url = (r.active && r.active.scriptURL) || (r.installing && r.installing.scriptURL) || '';
        if (/\/sw\.js(\?|$)/.test(url) && !/\/service-worker\.js/.test(url)) {
          try { await r.unregister(); } catch(e){}
        }
      }
    } catch(e){}

    try {
      const reg = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });

      /* если уже стоит waiting-воркер — сразу показать плашку обновления */
      if (reg.waiting && navigator.serviceWorker.controller){
        showUpdateToast(reg.waiting);
      }

      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller){
            showUpdateToast(nw);
          }
        });
      });

      /* пассивная проверка апдейта раз в 30 мин */
      setInterval(() => { try { reg.update(); } catch(e){} }, 30 * 60 * 1000);

    } catch(e){ /* тихо */ }

    /* смена контроллера → перезагрузка ОДИН раз (свежая сборка сразу) */
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloadedOnce) return;
      reloadedOnce = true;
      try { location.reload(); } catch(e){}
    });

    /* сообщения от воркера (например, sync тэг) */
    navigator.serviceWorker.addEventListener('message', ev => {
      const d = ev.data || {};
      if (d.type === 'oko-sync-request') flushSyncQueue();
    });
  }

  /* --------- WEB SHARE API helper --------- */
  window.okoPwaShare = async function(o){
    o = o || {};
    const data = {};
    if (o.title) data.title = o.title;
    if (o.text)  data.text  = o.text;
    if (o.url)   data.url   = o.url;

    if (navigator.share) {
      try {
        if (!navigator.canShare || navigator.canShare(data)) {
          await navigator.share(data);
          return true;
        }
      } catch(e){
        if (e && e.name === 'AbortError') return false;
      }
    }
    /* fallback: clipboard */
    const composite = [o.title, o.text, o.url].filter(Boolean).join(' — ');
    try {
      await navigator.clipboard.writeText(composite);
      safeToast('Ссылка скопирована');
      return true;
    } catch(e){
      /* legacy fallback */
      try {
        const ta = document.createElement('textarea');
        ta.value = composite; ta.setAttribute('readonly','');
        ta.style.position='fixed'; ta.style.top='-9999px';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy'); ta.remove();
        safeToast('Ссылка скопирована');
        return true;
      } catch(err){
        safeToast('Не удалось поделиться');
        return false;
      }
    }
  };

  /* --------- OFFLINE SYNC QUEUE (IndexedDB) --------- */
  const DB_NAME = 'oko-pwa';
  const DB_VER  = 1;
  const STORE   = 'queue';
  const HANDLERS = {};
  let flushing = false;

  function openDb(){
    return new Promise((resolve, reject) => {
      try {
        const req = indexedDB.open(DB_NAME, DB_VER);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)){
            const s = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
            s.createIndex('kind', 'kind', { unique: false });
            s.createIndex('createdAt', 'createdAt', { unique: false });
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror   = () => reject(req.error);
      } catch(e){ reject(e); }
    });
  }

  async function idbAdd(item){
    const db = await openDb();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      const s = tx.objectStore(STORE);
      const r = s.add(item);
      r.onsuccess = () => res(r.result);
      r.onerror   = () => rej(r.error);
    });
  }
  async function idbList(){
    const db = await openDb();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const s = tx.objectStore(STORE);
      const r = s.getAll();
      r.onsuccess = () => res(r.result || []);
      r.onerror   = () => rej(r.error);
    });
  }
  async function idbDelete(id){
    const db = await openDb();
    return new Promise((res) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => res(true);
      tx.onerror    = () => res(false);
    });
  }

  window.okoPwaSetSyncHandler = function(kind, fn){
    if (!kind || typeof fn !== 'function') return;
    HANDLERS[kind] = fn;
  };

  window.okoPwaEnqueue = async function(kind, payload){
    if (!kind) return null;
    const item = { kind, payload: payload || null, createdAt: nowTs(), tries: 0 };
    try {
      const id = await idbAdd(item);
      /* если онлайн — тут же пробуем отправить */
      if (navigator.onLine) queueMicrotask(flushSyncQueue);
      else showSyncToast('Сохранено. Отправим, когда появится сеть.', 1900);
      /* пробуем зарегистрировать background sync */
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.sync) await reg.sync.register('oko-sync-queue');
      } catch(e){}
      return id;
    } catch(e){
      return null;
    }
  };

  window.okoPwaFlushQueue = function(){ return flushSyncQueue(); };

  async function flushSyncQueue(){
    if (flushing || !navigator.onLine) return;
    flushing = true;
    let list = [];
    try { list = await idbList(); } catch(e){ flushing = false; return; }
    if (!list.length){ flushing = false; return; }

    showSyncToast('Синхронизирую офлайн-действия…', 0);
    let ok = 0, fail = 0;
    for (const item of list){
      const fn = HANDLERS[item.kind];
      if (!fn){ /* нет обработчика — пропускаем, но не удаляем */ fail++; continue; }
      try {
        const done = await fn(item.payload, item);
        if (done !== false){ await idbDelete(item.id); ok++; }
        else fail++;
      } catch(e){ fail++; }
    }
    hideSyncToast();
    if (ok) safeToast(`Отправлено ${ok} офлайн-${plural(ok, 'действие','действия','действий')}`);
    flushing = false;
  }

  function plural(n, one, few, many){
    const n10 = n % 10, n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return one;
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
    return many;
  }

  let syncToastTimer = null;
  function showSyncToast(txt, autohide){
    const el = document.getElementById('pwa-sync-toast');
    const t  = document.getElementById('pwa-sync-text');
    if (!el || !t) return;
    t.textContent = txt;
    el.classList.add('pwa-show');
    clearTimeout(syncToastTimer);
    if (autohide) syncToastTimer = setTimeout(hideSyncToast, autohide);
  }
  function hideSyncToast(){
    const el = document.getElementById('pwa-sync-toast');
    if (el) el.classList.remove('pwa-show');
  }

  /* --------- SHORTCUTS: ?tab=feed|chats|wallet|academy из manifest --------- */
  function handleShortcut(){
    try {
      const url = new URL(location.href);
      const tab = url.searchParams.get('tab');
      if (!tab) return;
      const allowed = ['feed','chats','wallet','academy','mini','partner','profile'];
      if (allowed.indexOf(tab) === -1) return;
      const fire = () => { try { if (typeof window.showTab === 'function') window.showTab(tab); } catch(e){} };
      /* даём приложению отрисоваться */
      setTimeout(fire, 350);
      /* чистим URL, чтобы не залипал tab= при рестартах */
      try {
        url.searchParams.delete('tab');
        const clean = url.pathname + (url.search ? url.search : '') + url.hash;
        history.replaceState({}, '', clean);
      } catch(e){}
    } catch(e){}
  }

  /* --------- BOOT --------- */
  function boot(){
    /* first-visit stamp */
    if (!readTs(LS_FIRST_SEEN)) writeTs(LS_FIRST_SEEN, nowTs());
    /* если приложение уже установлено — фиксируем в профиле */
    if (IS_STANDALONE) markProfileInstalled();

    paintOffline();
    registerSW();
    maybeScheduleIosHint();
    handleShortcut();

    /* если onLine=true при загрузке — сразу пробуем добить очередь */
    if (navigator.onLine) setTimeout(flushSyncQueue, 1200);
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
