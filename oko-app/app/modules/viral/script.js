/* =================== VIRAL ===================
   Виральные механики шеринга уровня Duolingo (streak-share) + Notion (share doc)
   + LinkedIn (share achievement). Всё под префиксом vr-/viral*.
   Ничего в base.html не трогается — только патчи и подписки на существующие
   функции/классы Академии, Партнёрки, Игр и ленты.

   Публичный API (глобальный):
     viralOpenShare(type, data)     — универсальный share-sheet
     viralGenReelsQuote(lesson)     — «Reels из урока за 30 сек»
     viralOpenWeekly()              — Weekly Story-summary
     viralOpenPublicProfile(slug)   — публичный профиль /u/@slug
     viralCanvas.*                  — helper-функции рендера в canvas
*/

(function viralModule(){
  'use strict';

  /* ============================================================
     ИКОНКИ (svg symbol'ы, только SVG, никаких эмодзи)
     ============================================================ */
  (function icons(){
    const defs = document.querySelector('svg defs');
    if(!defs) return;
    function sym(id, vb, inner){
      if(document.getElementById(id)) return;
      const s = document.createElementNS('http://www.w3.org/2000/svg', 'symbol');
      s.setAttribute('id', id); s.setAttribute('viewBox', vb);
      s.innerHTML = inner; defs.appendChild(s);
    }
    sym('i-vr-ig', '0 0 100 100',
      '<rect x="14" y="14" width="72" height="72" rx="20" fill="none" stroke="currentColor" stroke-width="7"/>' +
      '<circle cx="50" cy="50" r="16" fill="none" stroke="currentColor" stroke-width="7"/>' +
      '<circle cx="72" cy="28" r="5" fill="currentColor"/>');
    sym('i-vr-tg', '0 0 100 100',
      '<path d="M88 14 14 44c-3 1-3 5 0 6l20 7c2 1 3 2 4 4l7 20c1 3 5 3 6 0L81 22c1-4-2-7-6-6z" fill="currentColor"/>');
    sym('i-vr-vk', '0 0 100 100',
      '<path d="M22 36c2 22 12 32 30 32h4v-14c2 0 4 2 8 6l8 8h10c-6-8-9-11-14-16-2-2-2-4 0-6 4-6 12-14 12-18h-10c-4 4-8 10-12 14-3 3-4 2-4-2V28h-4c-8 0-12 4-14 6 0 0 6 0 6 6v10c0 4-2 4-4 2-4-4-8-12-10-16z" fill="currentColor"/>');
    sym('i-vr-tt', '0 0 100 100',
      '<path d="M58 12v46c0 8-6 14-14 14s-14-6-14-14 6-14 14-14v10c-2 0-4 2-4 4s2 4 4 4 4-2 4-4V12h10c0 8 6 14 14 14v10c-6 0-11-2-14-4z" fill="currentColor"/>');
    sym('i-vr-wa', '0 0 100 100',
      '<path d="M50 8C26 8 8 26 8 50c0 8 2 14 6 20L8 92l24-6c6 3 12 4 18 4 24 0 42-18 42-42S74 8 50 8z" fill="none" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/>' +
      '<path d="M38 34c0 10 8 22 22 26 3 1 6 1 7-3l-6-8c-3 1-6 3-8-1-2-3-2-6 0-8l-4-10c-4-2-11 0-11 4z" fill="currentColor"/>');
    sym('i-vr-story', '0 0 100 100',
      '<rect x="18" y="10" width="64" height="80" rx="10" fill="none" stroke="currentColor" stroke-width="6"/>' +
      '<circle cx="50" cy="50" r="14" fill="none" stroke="currentColor" stroke-width="6"/>' +
      '<path d="M38 50a12 12 0 1 0 24 0" fill="currentColor"/>');
    sym('i-vr-crown', '0 0 100 100',
      '<path d="M10 34l16 28 24-36 24 36 16-28-8 46H18z" fill="currentColor"/>');
    sym('i-vr-fire', '0 0 100 100',
      '<path d="M50 10c8 20 30 24 30 46 0 18-14 34-30 34S20 74 20 56C20 42 32 34 38 20c4 8 8 12 12 22 4-8 4-20 0-32z" fill="currentColor"/>');
    sym('i-vr-qr', '0 0 100 100',
      '<rect x="10" y="10" width="26" height="26" fill="none" stroke="currentColor" stroke-width="6"/>' +
      '<rect x="18" y="18" width="10" height="10" fill="currentColor"/>' +
      '<rect x="64" y="10" width="26" height="26" fill="none" stroke="currentColor" stroke-width="6"/>' +
      '<rect x="72" y="18" width="10" height="10" fill="currentColor"/>' +
      '<rect x="10" y="64" width="26" height="26" fill="none" stroke="currentColor" stroke-width="6"/>' +
      '<rect x="18" y="72" width="10" height="10" fill="currentColor"/>' +
      '<rect x="46" y="46" width="14" height="6" fill="currentColor"/>' +
      '<rect x="60" y="60" width="14" height="14" fill="none" stroke="currentColor" stroke-width="6"/>');
    sym('i-vr-badge', '0 0 100 100',
      '<path d="M50 10 62 22 78 22 78 38 92 50 78 62 78 78 62 78 50 90 38 78 22 78 22 62 8 50 22 38 22 22 38 22Z" fill="currentColor"/>' +
      '<path d="M34 52 44 62 66 40" fill="none" stroke="var(--surface, #000)" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>');
  })();

  /* ============================================================
     0. КОНСТАНТЫ и УТИЛИТЫ
     ============================================================ */
  const BRAND = { bg:'#0b0d0e', ink:'#ffffff', dim:'#9aa0a5', lime:'#9AFF00' };
  const HOST  = 'okoteam.top';       // публичный домен OKO
  const DEEP  = 'https://true-journey-418.higgsfield.app'; // зеркало прогресса

  function nick(){
    return (typeof PROFILE !== 'undefined' && PROFILE.nick) ? PROFILE.nick : 'me';
  }
  function myName(){
    return (typeof PROFILE !== 'undefined' && PROFILE.name) ? PROFILE.name : 'OKO';
  }
  function myBio(){
    return (typeof PROFILE !== 'undefined' && PROFILE.bio) ? PROFILE.bio : '';
  }
  function myTier(){
    return (typeof PROFILE !== 'undefined' && PROFILE.tier) ? PROFILE.tier : 'FREE';
  }
  function myAvatar(){
    return (typeof PROFILE !== 'undefined' && PROFILE.avatar) ? PROFILE.avatar : '';
  }
  function refUrl(product){
    const base = 'https://' + HOST + '/u/@' + nick();
    return product ? base + '?p=' + encodeURIComponent(product) : base;
  }
  function refText(){
    return refUrl() + '?ref=' + encodeURIComponent(nick());
  }
  function toastSafe(msg){
    if(typeof toast === 'function') toast(msg);
    else console.log('[toast]', msg);
  }
  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function initials(name){
    const parts = String(name || '').trim().split(/\s+/).slice(0, 2);
    return parts.map(p => (p[0] || '').toUpperCase()).join('') || 'O';
  }
  function shareStore(){
    try{ return JSON.parse(localStorage.getItem('vr.state') || '{}'); }catch(e){ return {}; }
  }
  function saveShareStore(s){
    try{ localStorage.setItem('vr.state', JSON.stringify(s)); }catch(e){}
  }
  /* ============================================================
     1. viralCanvas: helper-набор рендера картинок в canvas
        Все методы возвращают HTMLCanvasElement (или Promise<canvas>).
     ============================================================ */
  function makeCanvas(w, h){
    const c = document.createElement('canvas');
    // ретина: рисуем в 1x, шкалируем в CSS
    c.width = w; c.height = h;
    c.style.width = '100%'; c.style.height = 'auto';
    return c;
  }
  function loadImage(src){
    return new Promise((res, rej) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => res(img);
      img.onerror = () => rej(new Error('img load'));
      img.src = src;
    });
  }
  function bgPattern(ctx, w, h){
    // фирменный фон: чёрный + плавный лаймовый радиалг сверху
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#141719');
    g.addColorStop(1, '#050506');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const r = ctx.createRadialGradient(w * 0.15, -60, 0, w * 0.15, -60, w * 0.85);
    r.addColorStop(0, 'rgba(154,255,0,0.28)');
    r.addColorStop(1, 'rgba(154,255,0,0)');
    ctx.fillStyle = r; ctx.fillRect(0, 0, w, h);
    // угловой акцент
    ctx.strokeStyle = 'rgba(154,255,0,0.35)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, h - 90); ctx.lineTo(160, h - 90);
    ctx.moveTo(90, h - 160); ctx.lineTo(90, h);
    ctx.stroke();
  }
  function drawLogo(ctx, x, y, size){
    // упрощённый OKO-глаз: чёрный круг + лаймовый зрачок с «выкусом»
    const r = size / 2;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(r, r, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = BRAND.lime;
    ctx.beginPath(); ctx.arc(r, r, r * 0.58, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(r * 1.32, r * 0.62, r * 0.24, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function drawBrand(ctx, x, y, scale){
    scale = scale || 1;
    drawLogo(ctx, x, y, 42 * scale);
    ctx.fillStyle = '#fff';
    ctx.font = '700 ' + (28 * scale) + 'px "Bebas Neue", "Montserrat", system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('OKO', x + 52 * scale, y + 21 * scale);
    ctx.fillStyle = BRAND.dim;
    ctx.font = '600 ' + (13 * scale) + 'px "Montserrat", system-ui, sans-serif';
    ctx.fillText('одно приложение вместо восьми', x + 52 * scale, y + 42 * scale);
  }
  function drawFooter(ctx, w, h, text){
    ctx.fillStyle = '#fff';
    ctx.font = '800 22px "Bebas Neue", "Montserrat", system-ui, sans-serif';
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.fillText(text, 60, h - 60);
    ctx.textAlign = 'right';
    ctx.fillStyle = BRAND.lime;
    ctx.fillText(HOST + '/u/@' + nick(), w - 60, h - 60);
    ctx.textAlign = 'left';
  }
  function wrapText(ctx, text, x, y, maxW, lineH){
    const words = String(text || '').split(/\s+/);
    let line = '', lines = 0;
    for(let n = 0; n < words.length; n++){
      const test = line ? (line + ' ' + words[n]) : words[n];
      if(ctx.measureText(test).width > maxW && line){
        ctx.fillText(line, x, y); line = words[n]; y += lineH; lines++;
      } else {
        line = test;
      }
    }
    if(line){ ctx.fillText(line, x, y); lines++; }
    return lines;
  }
  function drawQR(ctx, x, y, size, text){
    // компактный «эстетический» QR — детерминированный шум по seed(text)
    const N = 25, cell = size / N;
    let seed = 2166136261;
    for(let i = 0; i < text.length; i++){ seed ^= text.charCodeAt(i); seed = (seed * 16777619) >>> 0; }
    function rnd(){ seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) % 1000) / 1000; }
    ctx.fillStyle = '#fff';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#000';
    for(let iy = 0; iy < N; iy++) for(let ix = 0; ix < N; ix++){
      if(rnd() < 0.48) ctx.fillRect(x + ix * cell, y + iy * cell, cell, cell);
    }
    // маркеры-«глазки»
    function eye(cx, cy){
      ctx.fillStyle = '#fff';
      ctx.fillRect(x + cx * cell - 1, y + cy * cell - 1, 7 * cell + 2, 7 * cell + 2);
      ctx.fillStyle = '#000';
      ctx.fillRect(x + cx * cell, y + cy * cell, 7 * cell, 7 * cell);
      ctx.fillStyle = '#fff';
      ctx.fillRect(x + (cx + 1) * cell, y + (cy + 1) * cell, 5 * cell, 5 * cell);
      ctx.fillStyle = '#000';
      ctx.fillRect(x + (cx + 2) * cell, y + (cy + 2) * cell, 3 * cell, 3 * cell);
    }
    eye(0, 0); eye(N - 7, 0); eye(0, N - 7);
    // центральный «глаз» бренда
    const cx = x + size / 2, cy = y + size / 2;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx, cy, size * 0.13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(cx, cy, size * 0.10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = BRAND.lime;
    ctx.beginPath(); ctx.arc(cx, cy, size * 0.05, 0, Math.PI * 2); ctx.fill();
  }

  const viralCanvas = window.viralCanvas = {

    /* Аватар: круг с инициалами (или картинкой, если она уже была загружена) */
    _drawAvatar(ctx, cx, cy, r, name, src){
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath();
      ctx.fillStyle = '#111'; ctx.fill();
      ctx.strokeStyle = BRAND.lime; ctx.lineWidth = Math.max(3, r * 0.06); ctx.stroke();
      ctx.fillStyle = BRAND.lime;
      ctx.font = '700 ' + Math.round(r * 0.85) + 'px "Bebas Neue", "Montserrat", system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(initials(name), cx, cy + r * 0.05);
      ctx.restore();
    },

    /* Сертификат — 1080×1350 (TikTok-friendly 4:5) */
    certificate(data){
      const w = 1080, h = 1350;
      const c = makeCanvas(w, h); const ctx = c.getContext('2d');
      bgPattern(ctx, w, h);
      drawBrand(ctx, 60, 60, 1.1);
      // рамка
      ctx.strokeStyle = 'rgba(154,255,0,0.4)'; ctx.lineWidth = 3;
      ctx.strokeRect(60, 200, w - 120, h - 340);
      // название
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
      ctx.font = '800 44px "Bebas Neue", "Montserrat", system-ui, sans-serif';
      ctx.fillText('СЕРТИФИКАТ АКАДЕМИИ', w / 2, 300);
      ctx.font = '600 22px "Montserrat", system-ui, sans-serif';
      ctx.fillStyle = BRAND.dim;
      ctx.fillText(String(data.no || ''), w / 2, 340);
      // имя (крупно)
      ctx.fillStyle = BRAND.lime;
      ctx.font = '800 92px "Bebas Neue", "Montserrat", system-ui, sans-serif';
      ctx.fillText(String(data.name || myName()).toUpperCase(), w / 2, 500);
      // «Прошёл курс»
      ctx.fillStyle = '#fff';
      ctx.font = '600 26px "Montserrat", system-ui, sans-serif';
      ctx.fillText('прошёл(а) курс', w / 2, 570);
      // название курса (в несколько строк)
      ctx.font = '800 42px "Bebas Neue", "Montserrat", system-ui, sans-serif';
      ctx.textAlign = 'center';
      wrapText(ctx, String(data.course || 'Академия OKO'), w / 2, 640, w - 200, 54);
      // дата + балл теста
      ctx.font = '600 24px "Montserrat", system-ui, sans-serif';
      ctx.fillStyle = BRAND.dim;
      ctx.fillText((data.date || '') + '  ·  тест ' + (data.score || 0) + '%', w / 2, 850);
      // серебряная печать
      const sx = 240, sy = 1010, sr = 100;
      const g = ctx.createRadialGradient(sx, sy, 10, sx, sy, sr);
      g.addColorStop(0, '#f4f4f4'); g.addColorStop(0.6, '#c9c9c9'); g.addColorStop(1, '#7f7f7f');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = BRAND.lime; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(sx, sy, sr - 6, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#111';
      ctx.font = '800 26px "Bebas Neue", "Montserrat", system-ui, sans-serif';
      ctx.textBaseline = 'middle';
      ctx.fillText('OKO', sx, sy - 12);
      ctx.font = '700 13px "Montserrat", system-ui, sans-serif';
      ctx.fillText('ACADEMY', sx, sy + 14);
      // QR для верификации
      drawQR(ctx, w - 240 - 60, 940, 240,
        'https://' + HOST + '/verify/' + (data.no || 'OKO'));
      ctx.textAlign = 'center'; ctx.fillStyle = BRAND.dim;
      ctx.font = '600 16px "Montserrat", system-ui, sans-serif';
      ctx.fillText('верификация по QR', w - 240 - 60 + 120, 1210);
      // подпись
      ctx.textBaseline = 'alphabetic';
      drawFooter(ctx, w, h, 'ОФИЦИАЛЬНЫЙ ДИПЛОМ');
      return c;
    },

    /* Reels-цитата — 5 кадров 1080×1920 (превью в один канвас-коллаж) */
    lessonQuotes(lesson){
      const scenes = lesson.scenes || viral_buildScenes(lesson);
      const w = 1080, sh = 1920;
      // мини-превью — 5 кадров в столбик уменьшенные до 216×384
      const scale = 0.28;
      const cw = Math.round(w * scale) + 24, ch = Math.round(sh * scale) + 24;
      const total = scenes.length;
      const cols = Math.min(3, total);
      const rows = Math.ceil(total / cols);
      const gap = 12, padOuter = 12;
      const cw2 = cw + gap, ch2 = ch + gap;
      const bigW = padOuter * 2 + cols * cw2 - gap;
      const bigH = padOuter * 2 + rows * ch2 - gap;
      const c = makeCanvas(bigW, bigH); const ctx = c.getContext('2d');
      ctx.fillStyle = '#0b0d0e'; ctx.fillRect(0, 0, bigW, bigH);
      scenes.forEach((s, i) => {
        const gx = i % cols, gy = Math.floor(i / cols);
        const x = padOuter + gx * cw2, y = padOuter + gy * ch2;
        // тень
        ctx.fillStyle = 'rgba(0,0,0,.5)';
        ctx.fillRect(x + 4, y + 6, cw - 8, ch - 8);
        // кадр
        const mini = viralCanvas._reelFrame(s, w, sh);
        ctx.drawImage(mini, 0, 0, w, sh, x, y, cw, ch);
      });
      return c;
    },
    _reelFrame(scene, w, h){
      const c = makeCanvas(w, h); const ctx = c.getContext('2d');
      bgPattern(ctx, w, h);
      drawBrand(ctx, 60, 80, 1.6);
      if(scene.kind === 'cover'){
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.font = '800 88px "Bebas Neue", "Montserrat", system-ui, sans-serif';
        wrapText(ctx, String(scene.title || 'Урок Академии OKO'), w / 2, h * 0.5 - 100, w - 160, 100);
        ctx.font = '600 34px "Montserrat", system-ui, sans-serif';
        ctx.fillStyle = BRAND.lime;
        ctx.fillText('Академия OKO', w / 2, h * 0.5 + 220);
      } else if(scene.kind === 'quote'){
        ctx.textAlign = 'left';
        ctx.fillStyle = BRAND.lime;
        ctx.font = '800 300px "Bebas Neue", "Montserrat", system-ui, sans-serif';
        ctx.fillText('“', 60, 420);
        ctx.fillStyle = '#fff';
        ctx.font = '700 54px "Bebas Neue", "Montserrat", system-ui, sans-serif';
        wrapText(ctx, scene.text || '', 60, 560, w - 120, 66);
        ctx.textAlign = 'right';
        ctx.font = '600 26px "Montserrat", system-ui, sans-serif';
        ctx.fillStyle = BRAND.dim;
        ctx.fillText('— ' + (scene.author || myName()), w - 60, h - 260);
      } else if(scene.kind === 'cta'){
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.font = '800 92px "Bebas Neue", "Montserrat", system-ui, sans-serif';
        wrapText(ctx, 'Ищи меня в OKO', w / 2, h * 0.42, w - 200, 110);
        ctx.font = '700 44px "Montserrat", system-ui, sans-serif';
        ctx.fillStyle = BRAND.lime;
        ctx.fillText('@' + nick(), w / 2, h * 0.42 + 180);
        drawQR(ctx, (w - 320) / 2, h * 0.55, 320, refText());
      }
      drawFooter(ctx, w, h, 'АКАДЕМИЯ');
      return c;
    },

    /* Weekly Story — 1080×1920 */
    weekly(metrics){
      const w = 1080, h = 1920;
      const c = makeCanvas(w, h); const ctx = c.getContext('2d');
      bgPattern(ctx, w, h);
      drawBrand(ctx, 60, 80, 1.5);
      ctx.textAlign = 'left'; ctx.fillStyle = '#fff';
      ctx.font = '800 72px "Bebas Neue", "Montserrat", system-ui, sans-serif';
      ctx.fillText('МОЯ НЕДЕЛЯ', 60, 350);
      ctx.fillStyle = BRAND.lime;
      ctx.font = '800 96px "Bebas Neue", "Montserrat", system-ui, sans-serif';
      ctx.fillText('В OKO', 60, 460);
      // 4 метрики
      const mets = [
        {l:'XP заработано', v: (metrics.xp || 0) + ''},
        {l:'дней подряд',  v: (metrics.streak || 0) + ''},
        {l:'партнёрка',    v: (metrics.earned || 0) + ' ₽'},
        {l:'уроков', v: (metrics.lessons || 0) + ''}
      ];
      const bx = 60, by = 620, bw = w - 120, cellH = 220, gap = 20;
      mets.forEach((m, i) => {
        const gx = i % 2, gy = Math.floor(i / 2);
        const cellW = (bw - gap) / 2;
        const x = bx + gx * (cellW + gap), y = by + gy * (cellH + gap);
        ctx.fillStyle = 'rgba(255,255,255,.06)';
        ctx.strokeStyle = 'rgba(154,255,0,.35)'; ctx.lineWidth = 2;
        roundRect(ctx, x, y, cellW, cellH, 22, true, true);
        ctx.textAlign = 'left';
        ctx.fillStyle = BRAND.dim;
        ctx.font = '700 22px "Montserrat", system-ui, sans-serif';
        ctx.fillText(m.l.toUpperCase(), x + 26, y + 44);
        ctx.fillStyle = '#fff';
        ctx.font = '800 88px "Bebas Neue", "Montserrat", system-ui, sans-serif';
        ctx.fillText(m.v, x + 26, y + 150);
      });
      // любимый курс
      if(metrics.favCourse){
        ctx.fillStyle = 'rgba(154,255,0,0.1)';
        ctx.strokeStyle = BRAND.lime; ctx.lineWidth = 3;
        roundRect(ctx, 60, 1160, w - 120, 200, 22, true, true);
        ctx.fillStyle = BRAND.dim;
        ctx.font = '700 22px "Montserrat", system-ui, sans-serif';
        ctx.fillText('ЛЮБИМЫЙ КУРС НЕДЕЛИ', 86, 1205);
        ctx.fillStyle = '#fff';
        ctx.font = '800 52px "Bebas Neue", "Montserrat", system-ui, sans-serif';
        wrapText(ctx, metrics.favCourse, 86, 1275, w - 172, 60);
      }
      // CTA + QR
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fff';
      ctx.font = '700 40px "Bebas Neue", "Montserrat", system-ui, sans-serif';
      ctx.fillText('Забирай PRO по моей ссылке', 60, h - 480);
      drawQR(ctx, w - 300 - 60, h - 460, 300, refText());
      ctx.fillStyle = BRAND.lime;
      ctx.font = '700 32px "Bebas Neue", "Montserrat", system-ui, sans-serif';
      ctx.fillText('okoteam.top/u/@' + nick(), 60, h - 380);
      drawFooter(ctx, w, h, 'НЕДЕЛЯ');
      return c;
    },

    /* Leaderboard share — 1080×1350 */
    leaderboard(row){
      const w = 1080, h = 1350;
      const c = makeCanvas(w, h); const ctx = c.getContext('2d');
      bgPattern(ctx, w, h);
      drawBrand(ctx, 60, 60, 1.1);
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.font = '800 60px "Bebas Neue", "Montserrat", system-ui, sans-serif';
      ctx.fillText('Я В ТОП-' + (row.rank || 1), w / 2, 300);
      ctx.fillStyle = BRAND.lime;
      ctx.font = '800 260px "Bebas Neue", "Montserrat", system-ui, sans-serif';
      ctx.fillText('#' + (row.rank || 1), w / 2, 560);
      ctx.fillStyle = '#fff';
      ctx.font = '700 44px "Bebas Neue", "Montserrat", system-ui, sans-serif';
      ctx.fillText('OKO ' + (row.league || 'GAMES').toUpperCase(), w / 2, 660);
      // моё имя
      ctx.fillStyle = BRAND.lime;
      ctx.font = '800 72px "Bebas Neue", "Montserrat", system-ui, sans-serif';
      ctx.fillText('@' + nick(), w / 2, 800);
      ctx.fillStyle = BRAND.dim;
      ctx.font = '600 32px "Montserrat", system-ui, sans-serif';
      ctx.fillText((row.score ? row.score + ' очков · ' : '') + 'неделя', w / 2, 860);
      // «присоединяйся»
      ctx.fillStyle = '#fff';
      ctx.font = '700 40px "Bebas Neue", "Montserrat", system-ui, sans-serif';
      ctx.fillText('присоединяйся', w / 2, 1000);
      drawQR(ctx, (w - 260) / 2, 1040, 260, refText());
      drawFooter(ctx, w, h, 'GAMES');
      return c;
    },

    /* Пост из ленты — 1080×1350 */
    post(post){
      const w = 1080, h = 1350;
      const c = makeCanvas(w, h); const ctx = c.getContext('2d');
      bgPattern(ctx, w, h);
      drawBrand(ctx, 60, 60, 1.1);
      // аватар + имя автора
      viralCanvas._drawAvatar(ctx, 130, 220, 60, post.name || myName(), post.ava);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#fff';
      ctx.font = '800 34px "Bebas Neue", "Montserrat", system-ui, sans-serif';
      ctx.fillText(post.name || myName(), 210, 210);
      ctx.fillStyle = BRAND.dim;
      ctx.font = '600 22px "Montserrat", system-ui, sans-serif';
      ctx.fillText('@' + (post.nick || nick()), 210, 250);
      // текст поста в рамке
      ctx.strokeStyle = 'rgba(154,255,0,0.3)'; ctx.lineWidth = 2;
      roundRect(ctx, 60, 350, w - 120, 700, 24, false, true);
      ctx.fillStyle = '#fff';
      ctx.font = '700 40px "Bebas Neue", "Montserrat", system-ui, sans-serif';
      wrapText(ctx, String(post.text || '').slice(0, 260), 100, 430, w - 200, 54);
      // CTA
      ctx.textAlign = 'center';
      ctx.fillStyle = BRAND.lime;
      ctx.font = '800 48px "Bebas Neue", "Montserrat", system-ui, sans-serif';
      ctx.fillText('okoteam.top/u/@' + (post.nick || nick()), w / 2, h - 160);
      drawQR(ctx, (w - 180) / 2, h - 400, 180, refText());
      drawFooter(ctx, w, h, 'ПОСТ');
      return c;
    },

    /* Реф-ссылка (общая) — 1080×1080 */
    ref(){
      const w = 1080, h = 1080;
      const c = makeCanvas(w, h); const ctx = c.getContext('2d');
      bgPattern(ctx, w, h);
      drawBrand(ctx, 60, 60, 1.2);
      // аватар
      viralCanvas._drawAvatar(ctx, w / 2, 380, 130, myName());
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.font = '800 62px "Bebas Neue", "Montserrat", system-ui, sans-serif';
      ctx.fillText(myName(), w / 2, 570);
      ctx.fillStyle = BRAND.lime;
      ctx.font = '700 32px "Montserrat", system-ui, sans-serif';
      ctx.fillText('@' + nick(), w / 2, 620);
      // CTA
      ctx.fillStyle = '#fff';
      ctx.font = '700 44px "Bebas Neue", "Montserrat", system-ui, sans-serif';
      ctx.fillText('заходи в OKO по моей ссылке', w / 2, 730);
      drawQR(ctx, (w - 220) / 2, 780, 220, refText());
      drawFooter(ctx, w, h, 'ЗАЙТИ В OKO');
      return c;
    }
  };
  // локальный roundRect (Canvas roundRect в старых движках нет)
  function roundRect(ctx, x, y, w, h, r, fill, stroke){
    r = Math.min(r, Math.min(w, h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
    if(fill) ctx.fill();
    if(stroke) ctx.stroke();
  }

  /* ============================================================
     2. viralOpenShare(type, data) — универсальный share-sheet
     ============================================================ */
  const SHARE_TEXTS = {
    ref:         (d) => 'Заходи в OKO по моей ссылке: ' + refText(),
    certificate: (d) => 'Прошёл(а) курс "' + (d.course || '') + '" в @okoteam · ' + refText(),
    lesson:      (d) => (d.title || 'Урок Академии OKO') + ' · @okoteam · ' + refText(),
    post:        (d) => (d.text ? d.text.slice(0, 140) + ' · ' : '') + '@okoteam · ' + refText(),
    leaderboard: (d) => 'Я #' + (d.rank || 1) + ' в OKO ' + (d.league || 'Games') + ' · ' + refText(),
    weekly:      (d) => 'Моя неделя в OKO · ' + (d.xp || 0) + ' XP, ' + (d.streak || 0) + ' дней подряд · ' + refText()
  };

  window.viralOpenShare = function(type, data){
    data = data || {};
    const host = document.getElementById('vrShareView');
    if(!host) return;
    // рисуем canvas (Promise-free тк без внешних картинок)
    let canvas;
    try{
      if(type === 'certificate') canvas = viralCanvas.certificate(data);
      else if(type === 'lesson') canvas = viralCanvas.lessonQuotes(data);
      else if(type === 'leaderboard') canvas = viralCanvas.leaderboard(data);
      else if(type === 'post') canvas = viralCanvas.post(data);
      else if(type === 'weekly') canvas = viralCanvas.weekly(data);
      else canvas = viralCanvas.ref();
    }catch(e){ console.warn('[viral] canvas err', e); canvas = viralCanvas.ref(); }
    VR_LAST = {type, data, canvas};

    const titles = {
      ref:'Поделись OKO',
      certificate:'Поделись сертификатом',
      lesson:'Reels из урока',
      post:'Поделись постом',
      leaderboard:'Поделись позицией',
      weekly:'Твоя неделя в OKO'
    };
    const subs = {
      ref:'Реф-ссылка автоматом · +' + '15% с каждой оплаты твоего клиента',
      certificate:'Publikация в один клик · 1080×1350 (TikTok/IG-friendly)',
      lesson:'Готовый storyboard · 3 цитаты · 15 секунд',
      post:'Картинка + твоя реф-ссылка автоматически',
      leaderboard:'Скрин с QR — сразу для сторис/ленты',
      weekly:'XP, streak, партнёрка · для Instagram Stories'
    };

    host.innerHTML =
      '<h3>' + escapeHtml(titles[type] || 'Поделиться') + '</h3>' +
      '<p class="sub">' + escapeHtml(subs[type] || '') + '</p>' +
      '<div class="vr-preview-wrap" id="vrPreviewWrap"></div>' +
      '<p class="vr-preview-hint">Реф-код <b>' + escapeHtml(nick()) + '</b> подставлен · попадёт в статистику партнёрки</p>' +
      (navigator.share
        ? '<button class="vr-native-btn" onclick="viralNative()"><svg class="i"><use href="#i-share"/></svg>Поделиться на устройстве</button>'
        : '') +
      '<div class="vr-share-grid">' +
      '  <button class="vr-share-btn story" onclick="viralPickPlatform(\'story\')">' +
      '    <span class="ico"><svg class="i"><use href="#i-vr-story"/></svg></span>Stories</button>' +
      '  <button class="vr-share-btn tg" onclick="viralPickPlatform(\'tg\')">' +
      '    <span class="ico"><svg class="i"><use href="#i-vr-tg"/></svg></span>Telegram</button>' +
      '  <button class="vr-share-btn vk" onclick="viralPickPlatform(\'vk\')">' +
      '    <span class="ico"><svg class="i"><use href="#i-vr-vk"/></svg></span>VK</button>' +
      '  <button class="vr-share-btn tt" onclick="viralPickPlatform(\'tt\')">' +
      '    <span class="ico"><svg class="i"><use href="#i-vr-tt"/></svg></span>TikTok</button>' +
      '</div>' +
      '<div class="vr-share-grid" style="grid-template-columns:repeat(2,1fr)">' +
      '  <button class="vr-share-btn wa" onclick="viralPickPlatform(\'wa\')">' +
      '    <span class="ico"><svg class="i"><use href="#i-vr-wa"/></svg></span>WhatsApp</button>' +
      '  <button class="vr-share-btn copy" onclick="viralPickPlatform(\'copy\')">' +
      '    <span class="ico"><svg class="i"><use href="#i-copy"/></svg></span>Скопировать</button>' +
      '</div>';

    const wrap = document.getElementById('vrPreviewWrap');
    if(wrap && canvas){ wrap.appendChild(canvas); }
    if(typeof openSheet === 'function') openSheet('vr-share');
  };

  let VR_LAST = null;

  function viralCanvasBlob(){
    return new Promise((res) => {
      if(!VR_LAST || !VR_LAST.canvas) return res(null);
      try{
        VR_LAST.canvas.toBlob(b => res(b), 'image/png');
      }catch(e){ res(null); }
    });
  }
  window.viralDownloadImage = async function(){
    const b = await viralCanvasBlob();
    if(!b) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = 'oko-' + (VR_LAST.type || 'share') + '-' + Date.now() + '.png';
    document.body.appendChild(a); a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(a.href); }, 500);
  };
  window.viralNative = async function(){
    if(!VR_LAST) return;
    const text = SHARE_TEXTS[VR_LAST.type] ? SHARE_TEXTS[VR_LAST.type](VR_LAST.data) : refText();
    const b = await viralCanvasBlob();
    // share с файлом, если доступно
    if(navigator.canShare && b){
      const file = new File([b], 'oko-share.png', {type:'image/png'});
      if(navigator.canShare({files:[file]})){
        try{
          await navigator.share({files:[file], text, title:'OKO', url: refText()});
          viralOnShared();
          return;
        }catch(e){ /* fallthrough */ }
      }
    }
    if(navigator.share){
      try{ await navigator.share({text, title:'OKO', url: refText()}); viralOnShared(); return; }
      catch(e){}
    }
    // fallback: скачать картинку
    await window.viralDownloadImage();
    toastSafe('Картинка сохранена · публикуй в сторис');
    viralOnShared();
  };
  window.viralPickPlatform = async function(kind){
    if(!VR_LAST) return;
    const text = SHARE_TEXTS[VR_LAST.type] ? SHARE_TEXTS[VR_LAST.type](VR_LAST.data) : refText();
    const url  = refText();
    const enc  = encodeURIComponent;
    let go = null;
    if(kind === 'tg') go = 'https://t.me/share/url?url=' + enc(url) + '&text=' + enc(text);
    else if(kind === 'vk') go = 'https://vk.com/share.php?url=' + enc(url) + '&title=' + enc(text);
    else if(kind === 'wa') go = 'https://wa.me/?text=' + enc(text);
    else if(kind === 'tt' || kind === 'story'){
      // TikTok/Stories не имеют веб-share deeplink на пост → сохраняем картинку
      await window.viralDownloadImage();
      try{ await navigator.clipboard.writeText(text); }catch(e){}
      toastSafe('Картинка сохранена · текст в буфере');
      viralOnShared();
      return;
    } else if(kind === 'copy'){
      try{ await navigator.clipboard.writeText(text); }catch(e){}
      toastSafe('Ссылка скопирована');
      viralOnShared();
      return;
    }
    if(go){
      window.open(go, '_blank', 'noopener');
      viralOnShared();
    }
  };
  function viralOnShared(){
    // share-streak: +1 за сегодня (уникально по дню)
    const s = shareStore();
    const today = new Date().toISOString().slice(0, 10);
    if(s.lastShareDay !== today){
      const prev = s.lastShareDay ? new Date(s.lastShareDay) : null;
      const diff = prev ? Math.round((Date.now() - prev.getTime()) / 86400e3) : 999;
      s.streak = (diff === 1) ? (s.streak || 0) + 1 : 1;
      s.lastShareDay = today;
    }
    s.total = (s.total || 0) + 1;
    saveShareStore(s);
    if(s.streak === 30) toastSafe('Serial × 30 · ты получил бейдж «Мессия OKO»');
    else if(s.streak === 7) toastSafe('7 дней подряд · серия шеринга растёт');
  }

  /* ============================================================
     3. Reels-цитаты автоматом
     ============================================================ */
  function viral_buildScenes(lesson){
    const title = (lesson && lesson.title) || 'Урок Академии OKO';
    let quotes = (lesson && (lesson.quotes || lesson.keyQuotes)) || null;
    if(!quotes || !quotes.length){
      const body = (lesson && (lesson.body || lesson.text || lesson.summary)) || '';
      quotes = String(body)
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(s => s.length >= 40 && s.length <= 220)
        .slice(0, 3);
      if(quotes.length < 3){
        const fill = [
          'Один инструмент вместо десяти',
          'Скорость важнее совершенства',
          'Практика сегодня сильнее теории завтра'
        ];
        while(quotes.length < 3) quotes.push(fill[quotes.length] || fill[0]);
      }
    }
    return [
      {kind:'cover', title, dur:2},
      {kind:'quote', text: quotes[0], author: myName(), dur:4},
      {kind:'quote', text: quotes[1], author: myName(), dur:4},
      {kind:'quote', text: quotes[2], author: myName(), dur:4},
      {kind:'cta', dur:2}
    ];
  }

  window.viralGenReelsQuote = function(lesson){
    const scenes = viral_buildScenes(lesson || {});
    const view = document.getElementById('vrReelsView');
    if(!view) return;
    view.innerHTML =
      '<h3>Reels из урока за 30 секунд</h3>' +
      '<p class="sub">' + escapeHtml((lesson && lesson.title) || 'Урок Академии OKO') + ' · 5 кадров · 15 секунд</p>' +
      '<div class="vr-preview-wrap" id="vrReelsWrap"></div>' +
      '<div class="vr-reels-scenes">' +
        scenes.map((s, i) => {
          if(s.kind === 'cover') return '<div class="vr-reels-scene"><span class="n">Кадр ' + (i+1) + ' · обложка · ' + s.dur + ' сек</span><div class="q">' + escapeHtml(s.title) + '</div></div>';
          if(s.kind === 'quote') return '<div class="vr-reels-scene"><span class="n">Кадр ' + (i+1) + ' · цитата · ' + s.dur + ' сек</span><div class="q">' + escapeHtml(s.text) + '</div></div>';
          return '<div class="vr-reels-scene"><span class="n">Кадр ' + (i+1) + ' · CTA · ' + s.dur + ' сек</span><div class="q">Ищи меня в OKO · @' + escapeHtml(nick()) + '</div></div>';
        }).join('') +
      '</div>' +
      '<button class="vr-native-btn" onclick="viralOpenShare(\'lesson\', ' + escapeAttr(JSON.stringify({title:(lesson && lesson.title) || '', scenes})) + ')"><svg class="i"><use href="#i-share"/></svg>Поделиться storyboard</button>' +
      '<button class="vr-native-btn" style="background:var(--raised);color:var(--fg);border:1px solid var(--border);margin-top:8px" onclick="viralDownloadReels()"><svg class="i"><use href="#i-copy"/></svg>Скачать 5 кадров (PNG)</button>';
    const wrap = document.getElementById('vrReelsWrap');
    if(wrap){
      const c = viralCanvas.lessonQuotes({scenes});
      wrap.appendChild(c);
      VR_LAST = {type:'lesson', data:{scenes}, canvas: c};
    }
    if(typeof openSheet === 'function') openSheet('vr-reels');
  };
  function escapeAttr(s){ return String(s).replace(/"/g, '&quot;'); }
  window.viralDownloadReels = function(){
    if(!VR_LAST || !VR_LAST.canvas) return;
    const scenes = (VR_LAST.data && VR_LAST.data.scenes) || [];
    scenes.forEach((s, i) => {
      const c = viralCanvas._reelFrame(s, 1080, 1920);
      c.toBlob(b => {
        if(!b) return;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(b);
        a.download = 'oko-reels-' + (i+1) + '.png';
        document.body.appendChild(a); a.click();
        setTimeout(() => { a.remove(); URL.revokeObjectURL(a.href); }, 400);
      }, 'image/png');
    });
    toastSafe('5 кадров скачаны · собери из них Reels/Stories');
  };

  /* ============================================================
     4. Weekly Story-summary — client-side scheduler
     ============================================================ */
  function weeklyMetrics(){
    let xp = 0, streak = 0, lessons = 0, earned = 0, favCourse = 'Академия OKO';
    try{
      if(typeof acS !== 'undefined' && acS){
        xp = acS.xp || 0;
        streak = acS.streak || 0;
        if(Array.isArray(acS.lessons)) lessons = acS.lessons.filter(l => l && l.done).length;
      }
    }catch(e){}
    try{ if(typeof PP !== 'undefined' && PP && PP.monthEarned) earned = Math.round(PP.monthEarned / 4); }catch(e){}
    try{
      if(typeof AC_COURSES !== 'undefined' && Array.isArray(AC_COURSES) && AC_COURSES.length){
        favCourse = AC_COURSES[0].title || favCourse;
      }
    }catch(e){}
    return {xp, streak, lessons, earned, favCourse};
  }
  window.viralOpenWeekly = function(){
    const view = document.getElementById('vrWeeklyView');
    if(!view) return;
    const m = weeklyMetrics();
    view.innerHTML =
      '<h3>Твоя неделя в OKO</h3>' +
      '<p class="sub">Story-summary 1080×1920 · для Instagram Stories, TG-канала и VK Clips</p>' +
      '<div class="vr-preview-wrap" id="vrWeeklyWrap"></div>' +
      '<div class="vr-weekly-metrics">' +
      '  <div class="vr-weekly-metric"><div class="l">XP · неделя</div><div class="v lime">' + m.xp + '</div></div>' +
      '  <div class="vr-weekly-metric"><div class="l">дней подряд</div><div class="v">' + m.streak + '</div></div>' +
      '  <div class="vr-weekly-metric"><div class="l">партнёрка</div><div class="v lime">' + m.earned + ' ₽</div></div>' +
      '  <div class="vr-weekly-metric"><div class="l">уроков</div><div class="v">' + m.lessons + '</div></div>' +
      '</div>' +
      '<button class="vr-native-btn" onclick="viralOpenShare(\'weekly\', ' + escapeAttr(JSON.stringify(m)) + ')"><svg class="i"><use href="#i-share"/></svg>Поделиться в Instagram Stories</button>';
    const wrap = document.getElementById('vrWeeklyWrap');
    if(wrap){
      const c = viralCanvas.weekly(m);
      wrap.appendChild(c);
      VR_LAST = {type:'weekly', data:m, canvas:c};
    }
    if(typeof openSheet === 'function') openSheet('vr-weekly');
  };

  // scheduler: проверять каждую минуту, воскресенье 20:00 → плашка (раз в неделю)
  function weeklySchedulerTick(){
    const now = new Date();
    if(now.getDay() !== 0) return; // 0 = вс
    if(now.getHours() < 20) return;
    const s = shareStore();
    const wk = weekKey();
    if(s.weeklyShownWk === wk) return;
    s.weeklyShownWk = wk; saveShareStore(s);
    const el = document.getElementById('vrWeeklyNudge');
    if(el){ el.classList.add('on'); }
  }
  function weekKey(){
    const d = new Date();
    // ISO-week: год-неделя (грубо)
    const oneJan = new Date(d.getFullYear(), 0, 1);
    const wk = Math.ceil((((d - oneJan) / 86400000) + oneJan.getDay() + 1) / 7);
    return d.getFullYear() + '-w' + wk;
  }
  window.viralWeeklyNudgeHide = function(){
    const el = document.getElementById('vrWeeklyNudge');
    if(el) el.classList.remove('on');
  };
  setInterval(weeklySchedulerTick, 60000);
  setTimeout(weeklySchedulerTick, 3000);

  /* ============================================================
     5. Публичный профиль /u/@username
     ============================================================ */
  function parsePublicSlug(){
    // из pathname: /u/@nick[?ref=x]
    const m = location.pathname.match(/\/u\/@?([\w.\-]+)/i);
    if(m) return m[1];
    // из hash: #/u/@nick
    const mh = (location.hash || '').match(/#\/?u\/@?([\w.\-]+)/i);
    if(mh) return mh[1];
    // из query: ?u=nick
    const q = new URLSearchParams(location.search).get('u');
    if(q) return q.replace(/^@/, '');
    return null;
  }
  function saveRefFrom(){
    try{
      const q = new URLSearchParams(location.search);
      const r = q.get('ref') || (parsePublicSlug());
      if(r && typeof PROFILE !== 'undefined'){
        PROFILE.refFrom = String(r).replace(/^@/, '');
        try{ localStorage.setItem('vr.refFrom', PROFILE.refFrom); }catch(e){}
      }
    }catch(e){}
  }
  function setOgTags(slug){
    function upsert(prop, value){
      let el = document.querySelector('meta[property="' + prop + '"]');
      if(!el){ el = document.createElement('meta'); el.setAttribute('property', prop); document.head.appendChild(el); }
      el.setAttribute('content', value);
    }
    const url = 'https://' + HOST + '/u/@' + slug;
    // рендерим OG-картинку и вставляем как data-URL
    let img = '';
    try{
      const c = viralCanvas.ref();
      img = c.toDataURL('image/png');
    }catch(e){}
    upsert('og:title', myName() + ' · @' + slug + ' в OKO');
    upsert('og:description', (myBio() || 'Профиль в OKO — одном приложении для медийщика, эксперта, автора.'));
    upsert('og:url', url);
    upsert('og:type', 'profile');
    if(img) upsert('og:image', img);
    upsert('twitter:card', 'summary_large_image');
  }
  function makePublicSample(slug){
    // если это не мой профиль — рисуем сгенерированного «партнёра OKO»
    const seed = Array.from(slug).reduce((s, c) => s + c.charCodeAt(0), 0);
    const names = ['Анна Ковалёва','Кирилл Морозов','Лера Спицына','Илья Гришин','Маша Быкова','Тимур Сафин','Вова Кац','Настя Волошина'];
    const bios  = [
      'Автор в OKO. Помогаю экспертам расти в соцсетях без выгорания.',
      'Веду продюсерский клуб OKO. Разбираю блогеров и коучей до чисел.',
      'Копирайтер, автор писем и Reels-сценариев. Работаю через OKO.',
      'Дизайнер-практик. Показываю, как собирать медиа-кит в OKO за час.',
      'Эксперт по SMM для локального бизнеса. Продаю через партнёрку OKO.'
    ];
    return {
      name: names[seed % names.length],
      nick: slug,
      bio: bios[seed % bios.length],
      followers: 400 + (seed * 47) % 12000,
      posts: 20 + (seed * 3) % 400,
      streak: 3 + (seed % 60),
      tier: (seed % 5 === 0) ? 'MAX' : (seed % 3 === 0 ? 'PRO' : 'FREE'),
      certs: [
        {t:'Маркетинг для нейроэксперта', d:'12.06.2026', no:'OKO-CERT-124903'},
        {t:'Reels-конвейер: 30 роликов в месяц', d:'02.07.2026', no:'OKO-CERT-231544'}
      ],
      channels: [
        {t:'Дневник эксперта OKO', s:'канал в OKO · заметки, кейсы', k:'2.4к'},
        {t:'Reels-цитаты', s:'канал в OKO · 3 ролика в неделю', k:'1.1к'}
      ],
      socials: [
        {id:'tg', ic:'i-vr-tg', label:'Telegram · @' + slug, href:'https://t.me/' + slug},
        {id:'ig', ic:'i-vr-ig', label:'Instagram · @' + slug, href:'https://instagram.com/' + slug},
        {id:'yt', ic:'i-vr-story', label:'YouTube · @' + slug, href:'https://youtube.com/@' + slug}
      ]
    };
  }
  function publicProfileData(slug){
    if(typeof PROFILE !== 'undefined' && slug === PROFILE.nick){
      // мой профиль
      const certs = (typeof acS !== 'undefined' && acS && Array.isArray(acS.certs)) ? acS.certs.map(c => ({
        t: c.courseTitle || 'Курс Академии OKO',
        d: c.date,
        no: c.no
      })) : [];
      return {
        name: PROFILE.name,
        nick: PROFILE.nick,
        bio: PROFILE.bio || '',
        followers: 2400,
        posts: 47,
        streak: (typeof acS !== 'undefined' && acS && acS.streak) || 14,
        tier: PROFILE.tier,
        certs: certs.length ? certs.slice(0, 4) : [{t:'Академия OKO', d:new Date().toLocaleDateString('ru-RU'), no:'OKO-CERT-000001'}],
        channels: [{t:'Канал ' + PROFILE.name, s:'заметки · разборы', k:'2.4к'}],
        socials: [
          {id:'tg', ic:'i-vr-tg', label:'Telegram · @' + PROFILE.nick, href:'https://t.me/' + PROFILE.nick},
          {id:'ig', ic:'i-vr-ig', label:'Instagram · @' + PROFILE.nick, href:'https://instagram.com/' + PROFILE.nick}
        ]
      };
    }
    return makePublicSample(slug);
  }

  window.viralOpenPublicProfile = function(slug){
    if(!slug) return;
    saveRefFrom();
    setOgTags(slug);
    const host = document.getElementById('vrPublic');
    const inner = document.getElementById('vrPublicInner');
    if(!host || !inner) return;
    const d = publicProfileData(slug);
    const publicUrl = 'okoteam.top/u/@' + slug;

    const socHtml = (d.socials || []).map(s =>
      '<a href="' + escapeHtml(s.href) + '" target="_blank" rel="noopener"><span class="ico"><svg class="i"><use href="#' + escapeHtml(s.ic) + '"/></svg></span><span class="lbl">' + escapeHtml(s.label) + '</span></a>'
    ).join('');
    const certsHtml = (d.certs || []).map(c =>
      '<div class="vr-pu-cert"><span class="seal">OKO</span><div class="info"><div class="t">' + escapeHtml(c.t) + '</div><div class="s">' + escapeHtml(c.no || '') + ' · ' + escapeHtml(c.d || '') + '</div></div></div>'
    ).join('');
    const chansHtml = (d.channels || []).map(ch =>
      '<div class="vr-pu-chan"><span class="a">' + escapeHtml(initials(ch.t)) + '</span><div class="info"><div class="t">' + escapeHtml(ch.t) + '</div><div class="s">' + escapeHtml(ch.s || '') + '</div></div><div class="k">' + escapeHtml(ch.k || '') + '</div></div>'
    ).join('');

    inner.innerHTML =
      '<div class="vr-pu-top">' +
        '<a class="vr-pu-logo" href="/"><svg class="i"><use href="#i-logo"/></svg><span>OKO</span></a>' +
        '<div class="vr-pu-actions">' +
          '<button onclick="viralPublicShare()"><svg class="i"><use href="#i-share"/></svg>Поделиться</button>' +
          '<a class="primary" href="/?ref=' + escapeHtml(slug) + '"><svg class="i"><use href="#i-plus"/></svg>Открыть OKO</a>' +
        '</div>' +
      '</div>' +
      '<div class="vr-pu-hero">' +
        '<div class="vr-pu-ava"' + (myAvatar() && d.nick === nick() ? ' style="background-image:url(' + JSON.stringify(myAvatar()).slice(1,-1) + ')"' : '') + '>' + escapeHtml(initials(d.name)) + '</div>' +
        '<div class="vr-pu-name">' + escapeHtml(d.name) + '</div>' +
        '<div class="vr-pu-nick">@' + escapeHtml(d.nick) + '</div>' +
        (d.bio ? '<div class="vr-pu-bio">' + escapeHtml(d.bio) + '</div>' : '') +
        '<div class="vr-pu-chips">' +
          '<span class="vr-pu-chip gold"><svg class="i"><use href="#i-vr-crown"/></svg>' + escapeHtml(d.tier || 'FREE') + '</span>' +
          '<span class="vr-pu-chip"><svg class="i"><use href="#i-vr-fire"/></svg>' + escapeHtml(d.streak + ' дней подряд') + '</span>' +
          '<span class="vr-pu-chip"><svg class="i"><use href="#i-vr-badge"/></svg>партнёр OKO</span>' +
        '</div>' +
        '<div class="vr-pu-stats">' +
          '<div class="vr-pu-stat"><div class="v">' + fmtK(d.followers) + '</div><div class="l">подписчиков</div></div>' +
          '<div class="vr-pu-stat"><div class="v">' + d.posts + '</div><div class="l">постов</div></div>' +
          '<div class="vr-pu-stat"><div class="v lime">' + (d.certs.length || 0) + '</div><div class="l">сертификатов</div></div>' +
          '<div class="vr-pu-stat"><div class="v">' + d.streak + '</div><div class="l">дн. streak</div></div>' +
        '</div>' +
        '<div class="vr-pu-cta">' +
          '<button class="btn-primary" onclick="viralPublicMessage(\'' + escapeHtml(slug) + '\')"><svg class="i"><use href="#i-chat"/></svg>Написать в OKO</button>' +
          '<button class="btn-ghost" onclick="viralPublicShare()" title="Поделиться"><svg class="i"><use href="#i-share"/></svg></button>' +
          '<button class="btn-ghost" onclick="viralPublicQr()" title="QR"><svg class="i"><use href="#i-vr-qr"/></svg></button>' +
        '</div>' +
      '</div>' +

      (socHtml ? '<div class="vr-pu-section"><h3>Соцсети <span class="badge">' + (d.socials.length) + '</span></h3><div class="vr-pu-soc">' + socHtml + '</div></div>' : '') +

      (certsHtml ? '<div class="vr-pu-section"><h3>Сертификаты Академии <span class="badge">' + (d.certs.length) + '</span></h3>' + certsHtml + '</div>' : '') +

      (chansHtml ? '<div class="vr-pu-section"><h3>Каналы <span class="badge">' + (d.channels.length) + '</span></h3>' + chansHtml + '</div>' : '') +

      '<div class="vr-pu-section"><h3>Партнёрская ссылка</h3>' +
        '<div class="vr-pu-ref">' +
          '<div class="ico"><svg class="i"><use href="#i-vr-badge"/></svg></div>' +
          '<div class="info"><div class="t">' + escapeHtml(publicUrl) + '</div><div class="s">Первый месяц PRO со скидкой · трекается за ' + escapeHtml(d.nick) + '</div></div>' +
          '<button onclick="viralPublicRefCopy()">Копировать</button>' +
        '</div>' +
      '</div>' +

      '<div class="vr-pu-foot">Профиль OKO · ' + escapeHtml(publicUrl) + '<br/><a href="/">открыть приложение OKO</a></div>';

    host.classList.add('open');
    document.body.style.overflow = 'hidden';
  };
  window.viralClosePublic = function(){
    const host = document.getElementById('vrPublic');
    if(host) host.classList.remove('open');
    document.body.style.overflow = '';
  };
  window.viralPublicShare = function(){ viralOpenShare('ref', {}); };
  window.viralPublicQr = function(){ viralOpenShare('ref', {}); };
  window.viralPublicRefCopy = function(){
    const slug = parsePublicSlug() || nick();
    try{ navigator.clipboard.writeText('https://okoteam.top/u/@' + slug + '?ref=' + slug); }catch(e){}
    toastSafe('Ссылка скопирована');
  };
  window.viralPublicMessage = function(slug){
    // если приложение открыто — идём во вкладку чатов; иначе deep-link
    if(typeof showTab === 'function'){
      viralClosePublic();
      showTab('chats');
      toastSafe('Открой чат с @' + slug + ' и напиши сообщение');
    } else {
      location.href = '/?tab=chats&to=' + encodeURIComponent(slug);
    }
  };
  function fmtK(n){
    if(n >= 1e6) return (n / 1e6).toFixed(1).replace('.0','') + 'M';
    if(n >= 1e3) return (n / 1e3).toFixed(1).replace('.0','') + 'к';
    return String(n);
  }

  /* ============================================================
     6. Патчи: Академия · сертификат → viral share
     ============================================================ */
  (function patchCertShare(){
    let tries = 0;
    function tryPatch(){
      if(typeof acCertShare !== 'function'){
        if(++tries < 40) return setTimeout(tryPatch, 300);
        return;
      }
      const orig = window.acCertShare;
      window.acCertShare = function(i){
        try{
          const c = (typeof i === 'number' && typeof acS !== 'undefined' && acS.certs) ? acS.certs[i] : (typeof acCertRec === 'function' ? acCertRec() : null);
          if(!c){ return orig.apply(this, arguments); }
          viralOpenShare('certificate', {
            no: c.no, date: c.date, score: c.score,
            name: c.name || myName(),
            course: c.courseTitle || (typeof acCertLabel === 'function' ? acCertLabel(c) : 'Академия OKO')
          });
        }catch(e){ return orig.apply(this, arguments); }
      };
    }
    tryPatch();
  })();

  /* ============================================================
     7. Академия · nudge «сделай Reels из урока за 30 сек»
        Показывается когда открыт длинный урок (durSec > 60) и он завершён.
     ============================================================ */
  (function lessonNudge(){
    let last = null, checks = 0;
    function currentLesson(){
      try{
        if(typeof AC_COURSE === 'undefined' || typeof acL === 'undefined') return null;
        const l = AC_COURSE[acL];
        if(!l) return null;
        const durSec = (typeof l.dur === 'number') ? l.dur : (l.durationSec || l.duration || 0);
        const done = (typeof acLessonDone === 'function') ? acLessonDone(acL) : false;
        return {l, durSec, done};
      }catch(e){ return null; }
    }
    function tick(){
      // работает только на экране академии, когда открыт урок
      const scrAc = document.getElementById('screen-academy');
      if(!scrAc || !scrAc.classList.contains('active')) return;
      const cur = currentLesson();
      if(!cur || !cur.l) return;
      // условие: урок больше 60 сек и завершён, ещё не предлагали
      if((cur.durSec || 120) < 60) return;
      if(!cur.done) return;
      const key = 'ac:' + (cur.l.id || cur.l.title || acL);
      if(key === last) return;
      const s = shareStore();
      s.reelsNudged = s.reelsNudged || {};
      if(s.reelsNudged[key]) return;
      last = key;
      s.reelsNudged[key] = 1; saveShareStore(s);
      showReelsNudge(cur.l);
    }
    function showReelsNudge(lesson){
      const el = document.getElementById('vrLessonNudge');
      if(!el) return;
      window.__vrLessonCache = lesson;
      el.classList.add('on');
      clearTimeout(showReelsNudge._t);
      showReelsNudge._t = setTimeout(() => el.classList.remove('on'), 12000);
    }
    setInterval(tick, 2000);
    setTimeout(tick, 3000);
  })();
  window.viralNudgeReels = function(){
    const el = document.getElementById('vrLessonNudge');
    if(el) el.classList.remove('on');
    viralGenReelsQuote(window.__vrLessonCache || {});
  };
  window.viralNudgeHide = function(){
    const el = document.getElementById('vrLessonNudge');
    if(el) el.classList.remove('on');
  };

  /* ============================================================
     8. Игры · «Поделиться моей позицией» в лидерборде
     ============================================================ */
  (function patchLbShare(){
    let tries = 0;
    function tryPatch(){
      if(typeof gmLbRender !== 'function'){
        if(++tries < 40) return setTimeout(tryPatch, 300);
        return;
      }
      const orig = window.gmLbRender;
      window.gmLbRender = function(){
        const r = orig.apply(this, arguments);
        // после отрисовки — добавляем share-кнопку под лидерборд
        try{
          const el = document.getElementById('gmLb');
          if(!el) return r;
          if(el.querySelector('.vr-lb-share')) return r;
          const rows = (typeof gmLbRank === 'function') ? gmLbRank() : [];
          const myIdx = rows.findIndex(x => x.me);
          const btn = document.createElement('button');
          btn.className = 'vr-lb-share';
          const league = (typeof GM_LB_LEAGUES !== 'undefined' && GM_LB_LEAGUES.find)
            ? (GM_LB_LEAGUES.find(l => l.id === (window.GM_LB_LEAGUE || 'friends')) || {n:'GAMES'}).n
            : 'GAMES';
          const rank = myIdx >= 0 ? myIdx + 1 : (rows.length || 1);
          const score = (myIdx >= 0 && rows[myIdx].s) ? Math.round(rows[myIdx].s) : 0;
          btn.innerHTML = '<svg class="i"><use href="#i-share"/></svg>Поделиться позицией · #' + rank + ' ' + league;
          btn.onclick = () => viralOpenShare('leaderboard', {rank, league, score});
          el.appendChild(btn);
        }catch(e){}
        return r;
      };
      // сразу подтянуть, если элемент уже отрисован
      try{ if(document.getElementById('gmLb')) window.gmLbRender(); }catch(e){}
    }
    tryPatch();
  })();

  /* ============================================================
     9. Лента · share-хук для любого поста
     ============================================================ */
  (function patchFeedShare(){
    // если в приложении уже есть sharePost — оборачиваем
    let tries = 0;
    function tryPatch(){
      if(typeof window.sharePost === 'function'){
        const orig = window.sharePost;
        window.sharePost = function(i){
          try{
            const post = (typeof POSTS !== 'undefined' && POSTS[i]) ? POSTS[i]
              : (typeof POSTS !== 'undefined' && POSTS.sub && POSTS.sub[i]) ? POSTS.sub[i]
              : {text:'Пост из OKO', name: myName(), nick: nick()};
            viralOpenShare('post', {
              text: post.body || post.text || '',
              name: post.name || myName(),
              nick: post.nick || post.author_nick || nick(),
              ava: post.ava || ''
            });
          }catch(e){ return orig.apply(this, arguments); }
        };
        return;
      }
      // делегированный click по .i-share/.share-btn внутри поста
      document.addEventListener('click', function(e){
        const btn = e.target.closest('[data-vr-post-share]');
        if(!btn) return;
        e.preventDefault();
        try{
          const post = JSON.parse(btn.dataset.vrPostShare);
          viralOpenShare('post', post);
        }catch(err){}
      });
      if(++tries < 20) setTimeout(tryPatch, 500);
    }
    tryPatch();
  })();

  /* ============================================================
     10. Партнёрка · Referral squared (+3 / +10 клиентов → бонусы)
     ============================================================ */
  function refCounts(){
    // считаем уникальных клиентов из HIST (партнёрка) + локально
    let uniq = 0;
    try{
      if(typeof HIST !== 'undefined' && Array.isArray(HIST)){
        const set = new Set();
        HIST.forEach(h => { if(h && h.name) set.add(h.name); });
        // если имени нет — считаем как «оплата = клиент»
        uniq = set.size || HIST.filter(h => h.st === 'paid').length;
      }
    }catch(e){}
    if(!uniq) uniq = 2;
    return uniq;
  }
  function refSquaredHtml(){
    const c = refCounts();
    const g1 = 3, g2 = 10;
    const p1 = Math.min(100, Math.round(c / g1 * 100));
    const p2 = Math.min(100, Math.round(c / g2 * 100));
    return '' +
      '<div class="h"><span class="lb">Referral squared</span><span class="chip">' + c + ' / ' + g2 + '</span></div>' +
      '<div class="vr-refsq-progress">' +
        '<div class="vr-refsq-row"><span class="lbl">Приведи 3 клиентов</span><span class="n">' + Math.min(c, g1) + '/' + g1 + '</span></div>' +
        '<div class="vr-refsq-bar"><i style="width:' + p1 + '%"></i></div>' +
        '<div class="vr-refsq-row" style="margin-top:14px"><span class="lbl">Приведи 10 клиентов</span><span class="n">' + Math.min(c, g2) + '/' + g2 + '</span></div>' +
        '<div class="vr-refsq-bar"><i style="width:' + p2 + '%"></i></div>' +
      '</div>' +
      '<div class="vr-refsq-goal ' + (c >= g1 ? 'done' : '') + '">' +
        '<div class="badge">+3</div>' +
        '<div><div class="t">PRO бесплатно 3 месяца</div><div class="s">' + (c >= g1 ? 'Открыто · зачислили тариф PRO' : 'Приведи ещё ' + (g1 - c) + ' клиентов через партнёрскую ссылку') + '</div></div>' +
      '</div>' +
      '<div class="vr-refsq-goal ' + (c >= g2 ? 'done' : '') + '">' +
        '<div class="badge">+10</div>' +
        '<div><div class="t">PRO навсегда · бейдж Legend</div><div class="s">' + (c >= g2 ? 'Легендарный статус · большой бейдж в профиле' : 'Осталось ' + (g2 - c) + ' · пожизненный PRO ждёт') + '</div></div>' +
      '</div>' +
      '<button onclick="viralOpenShare(\'ref\',{})"><svg class="i" style="width:14px;height:14px;vertical-align:-2px"><use href="#i-share"/></svg> Пригласить ещё</button>';
  }
  (function injectRefSquared(){
    let tries = 0;
    function tick(){
      const root = document.getElementById('ppRoot');
      if(!root){
        if(++tries < 60) return setTimeout(tick, 500);
        return;
      }
      if(document.getElementById('vrRefSquaredCard')) return;
      const card = document.createElement('div');
      card.id = 'vrRefSquaredCard';
      card.innerHTML = refSquaredHtml();
      // вставляем после ppLadder, если есть
      const anchor = document.getElementById('ppLadder') || root.firstElementChild;
      if(anchor && anchor.parentNode){
        anchor.parentNode.insertBefore(card, anchor.nextSibling);
      } else {
        root.appendChild(card);
      }
    }
    setTimeout(tick, 500);
    // при переходе на вкладку partner — переустановить
    if(typeof window.showTab === 'function'){
      const orig = window.showTab;
      window.showTab = function(t){
        const r = orig.apply(this, arguments);
        if(t === 'partner') setTimeout(tick, 300);
        return r;
      };
    }
  })();

  /* ============================================================
     11. Serial-бейдж «Мессия OKO» — 30 дней подряд share
        Показывается в профиле (append к #profStats области).
     ============================================================ */
  (function serialBadge(){
    let tries = 0;
    function tick(){
      const s = shareStore();
      const streak = s.streak || 0;
      if(streak < 30){
        if(++tries < 12) return setTimeout(tick, 5000);
        return;
      }
      const host = document.getElementById('profStats') || document.querySelector('#screen-profile .pad');
      if(!host) { if(++tries < 12) return setTimeout(tick, 5000); return; }
      if(document.getElementById('vrSerialBadge')) return;
      const b = document.createElement('div');
      b.id = 'vrSerialBadge'; b.style.marginTop = '10px'; b.style.textAlign = 'center';
      b.innerHTML = '<span class="vr-serial"><svg class="i"><use href="#i-vr-fire"/></svg>Мессия OKO · ' + streak + ' дней подряд</span>';
      host.appendChild(b);
    }
    setTimeout(tick, 4000);
  })();

  /* ============================================================
     12. Автоматический запуск публичного профиля по URL
     ============================================================ */
  (function bootPublic(){
    saveRefFrom();
    const slug = parsePublicSlug();
    if(slug){
      // ждём DOM
      const boot = () => viralOpenPublicProfile(slug);
      if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
      else setTimeout(boot, 200);
    }
    // навешиваем hash-навигацию — обновления URL внутри app
    window.addEventListener('hashchange', () => {
      const s = parsePublicSlug();
      if(s) viralOpenPublicProfile(s);
      else if(document.getElementById('vrPublic')) window.viralClosePublic();
    });
  })();

  /* ============================================================
     13. Хук для reg/чужого профиля: кнопка «Поделиться моим OKO»
     ============================================================ */
  window.viralShareMyProfile = function(){ viralOpenShare('ref', {}); };

  /* ============================================================
     14. Экспорт viralCanvas для внешних модулей + метка готовности
     ============================================================ */
  window.viral = {
    openShare: viralOpenShare,
    reels: viralGenReelsQuote,
    openWeekly: viralOpenWeekly,
    openPublic: viralOpenPublicProfile,
    canvas: viralCanvas,
    state: () => shareStore()
  };
  document.documentElement.dataset.viral = '1';
})();
