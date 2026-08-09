/* ============================================================================
   OKO · СОЦИАЛЬНЫЙ СЛОЙ  —  oko-social.js
   Правка Даниэля 09.08:
     «чтобы лента рекомендаций росла — ролики 9:16 и 16:9 постили в каналы,
      они попадают в рекомендации; каждому профилю подписчиков и полную
      страницу с роликами как в Инстаграм/Ютуб: посты отдельно, ролики
      отдельно; клубы и курсы создавать; у чата, канала, ЛС, клуба, курса —
      отдельная страница с инфой, подписчиками, копировать ссылку, поделиться».

   Что здесь:
     1. ЕДИНАЯ СТРАНИЦА СУЩНОСТИ #okoSoc — один шаблон на профиль человека,
        канал, групповой чат, ЛС-собеседника, клуб и курс.
     2. ПУБЛИКАЦИЯ: ролик 9:16, ролик 16:9, пост (текст + фото). Ролики обоих
        форматов уходят в раздел «Ролики», в ленту рекомендаций и в плеер клипов.
     3. СОЗДАНИЕ: канал, чат, клуб (супергруппа), курс — поверх модели CH,
        чтобы не расходиться со старым разделом «Каналы».
     4. КЛУБ-СУПЕРГРУППА: роли, права, темы, закреп, приглашения по ссылке.
     5. ПРАВА ВЛАДЕЛЬЦА: Даниэль — полный редактор всех официальных сущностей.
     6. ВЕРИФИКАЦИЯ: через okoIsVerified/okoVerifyBadge из ядра.

   Жёсткие правила, соблюдённые здесь:
     • ноль демо-данных — все счётчики считаются из реального состояния;
     • никаких ложных подтверждений — кнопка либо делает дело, либо честно
       говорит, что будет дальше;
     • ни одного эмодзи, только SVG из спрайта index.html;
     • аватары строго круглые;
     • безопасные зоны только через var(--oko-safe-*);
     • из любого экрана есть выход: «назад», Escape, системная «назад».
   ============================================================================ */
(function okoSocial(){
'use strict';

/* ==========================================================================
   0. БАЗОВЫЕ ХЕЛПЕРЫ
   ========================================================================== */
function E(t){
  var d = document.createElement('div');
  d.textContent = (t == null ? '' : String(t));
  return d.innerHTML;
}
function SI(n, cls){ return '<svg class="i ' + (cls || '') + '" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }
function T(m){ try{ if(typeof toast === 'function'){ toast(m); return; } }catch(e){} try{ console.log('[oko-social] ' + m); }catch(e){} }
function H(k){ try{ if(typeof okoHaptic === 'function') okoHaptic(k || 'impact'); }catch(e){} }
function NUM(v){
  if(v == null) return 0;
  var s = String(v).replace(/\s/g, '');
  var k = /к|k/i.test(s) ? 1000 : 1;
  var n = parseFloat(s.replace(/[^\d.,]/g, '').replace(',', '.'));
  return isFinite(n) ? Math.round(n * k) : 0;
}
function FMT(n){
  try{ if(typeof fmtN === 'function') return fmtN(n); }catch(e){}
  n = +n || 0;
  return n >= 1000 ? (n / 1000).toFixed(1).replace('.0', '') + 'к' : String(n);
}
function slug(s){
  return String(s || '').toLowerCase().trim()
    .replace(/[^a-zа-яё0-9]+/gi, '_').replace(/^_+|_+$/g, '').slice(0, 32) || 'oko';
}
function P(){
  try{ if(typeof PROFILE === 'object' && PROFILE) return PROFILE; }catch(e){}
  return { name: 'Я', nick: 'me' };
}
function founderNick(){ try{ if(typeof OKO_FOUNDER_NICK === 'string') return OKO_FOUNDER_NICK; }catch(e){} return 'ktodaniel'; }
function isFounder(){ var p = P(); return p.role === 'owner' || p.nick === founderNick(); }
function CHm(){ try{ return (typeof CH === 'object' && CH) ? CH : null; }catch(e){ return null; } }
function chRec(id){
  var m = CHm(); if(!m || !id) return null;
  try{ if(typeof chChannel === 'function') return chChannel(id); }catch(e){}
  var a = (m.mine || []).concat(m.disc || []);
  for(var i = 0; i < a.length; i++) if(a[i].id === id) return a[i];
  return null;
}
function chatRec(id){
  try{
    if(typeof CHATS === 'undefined' || !CHATS) return null;
    for(var i = 0; i < CHATS.length; i++) if(String(CHATS[i].id) === String(id)) return CHATS[i];
  }catch(e){}
  return null;
}
function chSaveSafe(){ try{ if(typeof chSave === 'function') chSave(); }catch(e){} }
function dateRu(ts){
  if(!ts) return '';
  try{ return new Date(ts).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch(e){ return ''; }
}
function whenRu(ts){
  if(!ts) return '';
  var d = Math.max(0, Date.now() - ts);
  if(d < 60000) return 'только что';
  if(d < 3600000) return Math.floor(d / 60000) + ' мин назад';
  if(d < 86400000) return Math.floor(d / 3600000) + ' ч назад';
  return dateRu(ts);
}
function fmtDur(sec){
  sec = Math.max(0, Math.round(+sec || 0));
  var m = Math.floor(sec / 60), s = sec % 60;
  return m + ':' + (s < 10 ? '0' : '') + s;
}

/* ==========================================================================
   1. СТИЛИ (один инлайновый <style>, префикс .soc-)
   ========================================================================== */
function injectCss(){
  if(document.getElementById('oko-social-css')) return;
  var st = document.createElement('style');
  st.id = 'oko-social-css';
  st.textContent = [
    /* ---- корневая вьюха ---- */
    '#okoSoc{position:fixed;inset:0;z-index:69;background:var(--bg);display:flex;flex-direction:column;',
    '  transform:translateX(100%);transition:transform .32s cubic-bezier(.3,1,.4,1);',
    '  max-width:1280px;margin:0 auto;padding-left:var(--oko-safe-left,0px);padding-right:var(--oko-safe-right,0px)}',
    '#okoSoc.open{transform:none}',
    '@media(prefers-reduced-motion:reduce){#okoSoc{transition:none}}',

    '.soc-head{display:flex;align-items:center;gap:10px;padding:14px 16px;',
    '  padding-top:max(14px,var(--oko-safe-top,0px));border-bottom:1px solid var(--border);',
    '  flex-shrink:0;background:var(--bg)}',
    '.soc-head b{font:800 16px/1.2 var(--font-display,inherit);letter-spacing:.01em;flex:1;min-width:0;',
    '  overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}',
    '.soc-back{color:var(--dim);display:inline-flex;padding:2px;flex-shrink:0;background:none;border:0;cursor:pointer}',
    '.soc-back svg.i{width:22px;height:22px}',
    '.soc-htools{display:flex;gap:6px;flex-shrink:0}',
    '.soc-htools button{background:none;border:0;color:var(--dim);cursor:pointer;padding:4px;display:inline-flex}',
    '.soc-htools svg.i{width:20px;height:20px}',

    '.soc-body{flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch;overflow-x:hidden;',
    '  padding:0 16px calc(36px + var(--oko-safe-bottom,0px))}',

    /* ---- шапка сущности ---- */
    '.soc-id{display:flex;flex-direction:column;align-items:center;text-align:center;padding:20px 0 6px;gap:8px}',
    '.soc-ava{border-radius:50%;overflow:hidden;flex-shrink:0;display:inline-flex;align-items:center;justify-content:center;',
    '  font:800 32px/1 var(--font-display,inherit);letter-spacing:.02em;position:relative;',
    '  background:var(--av-g,linear-gradient(135deg,#c8ff5e,#9AFF00 52%,#6fd400));color:var(--av-c,#0a0a0a)}',
    ':root[data-theme="light"] .soc-ava{background:var(--av-gl,linear-gradient(135deg,#c8ff5e,#9AFF00 52%,#7ad400));color:var(--av-cl,#0a1400)}',
    '.soc-ava img{width:100%;height:100%;object-fit:cover;display:block;border-radius:50%}',
    '.soc-ava svg.i{width:46%;height:46%;color:inherit}',
    '.soc-ava.sm{font-size:15px}.soc-ava.sm svg.i{width:52%;height:52%}',

    '.soc-name{font:800 22px/1.2 var(--font-display,inherit);letter-spacing:.01em;display:flex;align-items:center;',
    '  justify-content:center;gap:6px;flex-wrap:wrap;max-width:100%;overflow-wrap:anywhere}',
    '.soc-name .oko-vbadge,.soc-name .soc-vb{width:18px;height:18px;color:#2b9cff;flex-shrink:0}',
    '.soc-nick{color:var(--dim);font-size:13.5px;overflow-wrap:anywhere}',
    '.soc-kindrow{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}',
    '.soc-chip{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;letter-spacing:.02em;',
    '  padding:4px 9px;border-radius:99px;border:1px solid var(--border);color:var(--dim);background:var(--card)}',
    '.soc-chip svg.i{width:12px;height:12px}',
    '.soc-chip.lime{color:#0a0a0a;background:var(--lime);border-color:transparent}',

    /* ---- счётчики ---- */
    '.soc-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0 4px}',
    '.soc-stat{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:11px 6px;text-align:center;min-width:0}',
    '.soc-stat b{display:block;font:800 19px/1.1 var(--font-display,inherit);color:var(--text)}',
    '.soc-stat small{display:block;color:var(--dim);font-size:11px;margin-top:3px;overflow-wrap:anywhere}',

    '.soc-bio{margin:12px 0 0;font-size:13.5px;line-height:1.5;color:var(--text);overflow-wrap:anywhere;white-space:pre-wrap}',
    '.soc-meta{margin-top:8px;color:var(--dim);font-size:11.5px;display:flex;align-items:center;gap:6px;flex-wrap:wrap}',
    '.soc-meta svg.i{width:13px;height:13px}',

    /* ---- действия ---- */
    '.soc-acts{display:flex;gap:8px;margin:14px 0 0;flex-wrap:wrap}',
    '.soc-acts .soc-btn{flex:1 1 130px}',
    '.soc-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:44px;padding:10px 14px;',
    '  border-radius:14px;border:1px solid transparent;background:var(--lime);color:#0a0a0a;',
    '  font:700 13.5px/1.2 inherit;cursor:pointer;text-align:center;overflow-wrap:anywhere}',
    '.soc-btn svg.i{width:17px;height:17px;flex-shrink:0}',
    '.soc-btn.ghost{background:var(--raised,var(--card));color:var(--text);border-color:var(--border)}',
    '.soc-btn.danger{background:transparent;color:#ff6a6a;border-color:rgba(255,106,106,.4)}',
    '.soc-btn[disabled]{opacity:.45;cursor:default}',
    '.soc-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px}',
    '.soc-mini{display:flex;align-items:center;gap:9px;min-height:46px;padding:10px 12px;border-radius:13px;',
    '  border:1px solid var(--border);background:var(--card);color:var(--text);font:600 12.5px/1.25 inherit;',
    '  cursor:pointer;text-align:left;min-width:0;overflow-wrap:anywhere}',
    '.soc-mini svg.i{width:17px;height:17px;color:var(--dim);flex-shrink:0}',
    '.soc-mini.on svg.i{color:var(--lime)}',
    '.soc-mini span{min-width:0}',

    /* ---- вкладки ---- */
    '.soc-tabs{display:flex;gap:6px;margin:18px 0 12px;border-bottom:1px solid var(--border)}',
    '.soc-tab{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:11px 6px;',
    '  background:none;border:0;border-bottom:2px solid transparent;color:var(--dim);',
    '  font:700 13px/1.2 inherit;cursor:pointer;min-width:0}',
    '.soc-tab svg.i{width:16px;height:16px}',
    '.soc-tab.on{color:var(--text);border-bottom-color:var(--lime)}',
    '.soc-tab i{font-style:normal;color:var(--dim);font-weight:700}',

    /* ---- посты ---- */
    '.soc-post{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:13px;margin-bottom:10px}',
    '.soc-post-h{display:flex;align-items:center;gap:9px;margin-bottom:9px;min-width:0}',
    '.soc-post-h b{font:700 13px/1.2 inherit;min-width:0;overflow-wrap:anywhere}',
    '.soc-post-h small{color:var(--dim);font-size:11px;margin-left:auto;flex-shrink:0}',
    '.soc-post-t{font-size:13.5px;line-height:1.55;overflow-wrap:anywhere;white-space:pre-wrap}',
    '.soc-post-img{margin-top:10px;border-radius:12px;overflow:hidden;background:var(--raised,var(--card));display:block;width:100%}',
    '.soc-post-img img{display:block;width:100%;height:auto}',
    '.soc-post-a{display:flex;align-items:center;gap:14px;margin-top:11px;padding-top:10px;border-top:1px solid var(--border)}',
    '.soc-post-a button{display:inline-flex;align-items:center;gap:5px;background:none;border:0;color:var(--dim);',
    '  font:600 12px/1 inherit;cursor:pointer;padding:2px 0}',
    '.soc-post-a button svg.i{width:16px;height:16px}',
    '.soc-post-a button.on{color:var(--lime)}',
    '.soc-pin{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;color:var(--lime);margin-bottom:6px}',
    '.soc-pin svg.i{width:12px;height:12px}',

    /* ---- сетка роликов 3 в ряд ---- */
    '.soc-reels{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px}',
    '.soc-reel{position:relative;aspect-ratio:9/16;border-radius:10px;overflow:hidden;border:0;padding:0;cursor:pointer;',
    '  background:linear-gradient(150deg,#14330a,#0a0a0a 70%);display:block;min-width:0}',
    ':root[data-theme="light"] .soc-reel{background:linear-gradient(150deg,#dcefb0,#9fd44e 70%)}',
    '.soc-reel-c{position:absolute;inset:0;background-size:cover;background-position:center}',
    '.soc-reel-sh{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.05) 30%,rgba(0,0,0,.72))}',
    '.soc-reel-r{position:absolute;top:5px;left:5px;font:800 9px/1 var(--font-display,inherit);letter-spacing:.04em;',
    '  padding:3px 5px;border-radius:6px;background:rgba(0,0,0,.62);color:#9AFF00}',
    '.soc-reel-p{position:absolute;top:5px;right:5px;color:#fff;opacity:.9}',
    '.soc-reel-p svg.i{width:14px;height:14px}',
    '.soc-reel-cap{position:absolute;left:5px;right:5px;bottom:5px;color:#fff;font:600 9.5px/1.25 inherit;text-align:left;',
    '  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}',

    /* ---- пусто ---- */
    '.soc-empty{text-align:center;padding:30px 16px;color:var(--dim)}',
    '.soc-empty svg.i{width:34px;height:34px;opacity:.5;margin-bottom:10px}',
    '.soc-empty p{font:700 14px/1.3 inherit;color:var(--text);margin:0 0 5px}',
    '.soc-empty small{font-size:12px;line-height:1.5;display:block;overflow-wrap:anywhere}',

    /* ---- формы ---- */
    '.soc-lab{display:block;margin:16px 0 6px;font:700 11.5px/1.2 inherit;letter-spacing:.05em;',
    '  text-transform:uppercase;color:var(--dim)}',
    '.soc-input,.soc-ta{width:100%;box-sizing:border-box;background:var(--card);border:1px solid var(--border);',
    '  border-radius:13px;padding:12px 13px;color:var(--text);font:400 14px/1.45 inherit;outline:none}',
    '.soc-input:focus,.soc-ta:focus{border-color:var(--lime)}',
    '.soc-ta{resize:vertical;min-height:88px}',
    '.soc-sec{margin:22px 0 8px;font:800 12px/1.2 var(--font-display,inherit);letter-spacing:.06em;',
    '  text-transform:uppercase;color:var(--dim);display:flex;align-items:center;gap:7px}',
    '.soc-sec svg.i{width:15px;height:15px;color:var(--lime)}',
    '.soc-note{margin-top:9px;color:var(--dim);font-size:11.5px;line-height:1.5;overflow-wrap:anywhere}',

    '.soc-fmt{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}',
    '.soc-fmt button{display:flex;flex-direction:column;align-items:center;gap:6px;padding:13px 6px;border-radius:14px;',
    '  border:1px solid var(--border);background:var(--card);color:var(--dim);cursor:pointer;',
    '  font:700 11.5px/1.2 inherit;min-width:0;overflow-wrap:anywhere;text-align:center}',
    '.soc-fmt button svg.i{width:22px;height:22px}',
    '.soc-fmt button.on{border-color:var(--lime);color:var(--text);box-shadow:inset 0 0 0 1px var(--lime)}',
    '.soc-fmt button.on svg.i{color:var(--lime)}',

    '.soc-kinds{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}',
    '.soc-kind{display:flex;flex-direction:column;align-items:flex-start;gap:5px;padding:13px;border-radius:15px;',
    '  border:1px solid var(--border);background:var(--card);color:var(--text);cursor:pointer;text-align:left;min-width:0}',
    '.soc-kind svg.i{width:20px;height:20px;color:var(--dim)}',
    '.soc-kind b{font:700 13.5px/1.2 inherit}',
    '.soc-kind small{color:var(--dim);font-size:11px;line-height:1.4;overflow-wrap:anywhere}',
    '.soc-kind.on{border-color:var(--lime);box-shadow:inset 0 0 0 1px var(--lime)}',
    '.soc-kind.on svg.i{color:var(--lime)}',

    '.soc-file{display:flex;align-items:center;gap:9px;min-height:46px;padding:11px 13px;border-radius:13px;',
    '  border:1px dashed var(--border);background:var(--card);color:var(--text);cursor:pointer;',
    '  font:600 12.5px/1.3 inherit;position:relative;overflow-wrap:anywhere}',
    '.soc-file svg.i{width:18px;height:18px;color:var(--lime);flex-shrink:0}',
    '.soc-file input[type=file]{position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%}',
    '.soc-prev{margin-top:10px;border-radius:14px;overflow:hidden;border:1px solid var(--border);background:var(--card);',
    '  display:flex;align-items:center;justify-content:center;background-size:cover;background-position:center}',
    '.soc-prev.r916{aspect-ratio:9/16;max-width:190px}',
    '.soc-prev.r169{aspect-ratio:16/9}',
    '.soc-prev.rpost{aspect-ratio:4/3}',
    '.soc-prev span{color:var(--dim);font-size:11.5px;padding:10px;text-align:center;overflow-wrap:anywhere}',

    '.soc-seg{display:flex;gap:6px;background:var(--card);border:1px solid var(--border);border-radius:13px;padding:4px}',
    '.soc-seg button{flex:1;padding:9px 6px;border-radius:10px;border:0;background:none;color:var(--dim);',
    '  font:700 12px/1.2 inherit;cursor:pointer;min-width:0;overflow-wrap:anywhere}',
    '.soc-seg button.on{background:var(--lime);color:#0a0a0a}',

    '.soc-row{display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid var(--border);min-width:0}',
    '.soc-row:last-child{border-bottom:0}',
    '.soc-row-b{flex:1;min-width:0}',
    '.soc-row-b b{display:block;font:700 13px/1.3 inherit;overflow-wrap:anywhere}',
    '.soc-row-b small{display:block;color:var(--dim);font-size:11.5px;line-height:1.4;margin-top:2px;overflow-wrap:anywhere}',
    '.soc-row-x{background:none;border:0;color:var(--dim);cursor:pointer;padding:6px;display:inline-flex;flex-shrink:0}',
    '.soc-row-x svg.i{width:17px;height:17px}',
    '.soc-card{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:4px 14px}',
    '.soc-role{font-size:10.5px;font-weight:800;letter-spacing:.03em;padding:3px 8px;border-radius:99px;',
    '  border:1px solid var(--border);color:var(--dim);background:none;cursor:pointer;flex-shrink:0}',
    '.soc-role.owner{color:#0a0a0a;background:var(--lime);border-color:transparent}',

    /* ---- блок «ник и ссылка» из v2 (страховка, если модуль не поднялся) ---- */
    '#okoSoc .oko-ident{margin-top:12px}',

    /* ---- кнопки входа в профиле ---- */
    '.soc-profile-cta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:12px 0 4px}',

    /* ---- обложки соц-роликов в общей ленте ---- */
    '#feedList .media.soc-cover{background-size:cover !important;background-position:center !important}',
    '#feedList .media.soc-cover .media-teaser{text-shadow:0 1px 6px rgba(0,0,0,.7)}'
  ].join('\n');
  document.head.appendChild(st);
}

/* ==========================================================================
   2. СОСТОЯНИЕ
   ========================================================================== */
var SOC_KEY = 'oko-social-v1';
var SOC = (function(){
  try{ var j = JSON.parse(localStorage.getItem(SOC_KEY)); if(j && typeof j === 'object') return j; }catch(e){}
  return null;
})() || { v: 1, seq: 0, feedSeq: 5000000, items: {}, subs: {}, notify: {}, meta: {}, reports: [] };
SOC.items = SOC.items || {}; SOC.subs = SOC.subs || {}; SOC.notify = SOC.notify || {};
SOC.meta = SOC.meta || {}; SOC.reports = SOC.reports || []; SOC.seq = SOC.seq || 0;
SOC.feedSeq = SOC.feedSeq || 5000000;

function socSave(){
  try{ localStorage.setItem(SOC_KEY, JSON.stringify(SOC)); }
  catch(e){
    /* переполнили квоту (обычно из-за dataURL-обложек) — честно сообщаем,
       содержимое сессии при этом не теряется */
    T('Память браузера заполнена: публикация осталась в сессии, но не сохранится после перезагрузки');
  }
}

/* ==========================================================================
   3. РЕЗОЛВЕР СУЩНОСТЕЙ
   ключи: 'u:<ник>' — человек, 'c:<id>' — запись CH, 'x:<id>' — запись CHATS
   ========================================================================== */
var TYPE_LABEL = {
  user: 'Профиль', channel: 'Канал', group: 'Групповой чат', chat: 'Чат',
  sgroup: 'Супергруппа', club: 'Клуб', course: 'Курс', direct: 'Личный чат'
};
var TYPE_SHORT = {
  user: 'профиль', channel: 'канал', group: 'чат', chat: 'чат',
  sgroup: 'супергруппа', club: 'клуб', course: 'курс', direct: 'личный чат'
};
var TYPE_ICON = {
  user: 'user', channel: 'megaphone', group: 'users', chat: 'users',
  sgroup: 'users', club: 'crown', course: 'circle-play', direct: 'user'
};

function nickOf(o){
  if(!o) return '';
  try{ if(typeof okoEntityNick === 'function') return okoEntityNick(o); }catch(e){}
  if(o.nick) return String(o.nick).replace(/^@/, '');
  return slug(o.name);
}

function keyOfChat(c){
  if(!c) return null;
  if(c.chId) return 'c:' + c.chId;
  if(c.openChannel) return 'c:' + c.openChannel;
  if(c.kind === 'direct') return 'u:' + (nickOf(c) || slug(c.name));
  return 'x:' + c.id;
}
function keyOfName(name){
  if(!name) return null;
  var p = P();
  if(name === p.name) return 'u:' + nickOf(p);
  try{
    if(typeof CHATS !== 'undefined' && CHATS){
      for(var i = 0; i < CHATS.length; i++) if(CHATS[i].name === name) return keyOfChat(CHATS[i]);
    }
  }catch(e){}
  var m = CHm();
  if(m){
    var a = (m.mine || []).concat(m.disc || []);
    for(var j = 0; j < a.length; j++) if(a[j].name === name) return 'c:' + a[j].id;
  }
  return 'u:' + slug(name);
}

function entity(key){
  if(!key) return null;
  var t = key.slice(0, 1), id = key.slice(2);
  var meta = SOC.meta[key] || {};
  var p = P();
  var ent = null;

  if(t === 'c'){
    var c = chRec(id);
    if(!c) return null;
    ent = {
      key: key, type: c.kind || 'channel', name: c.name, nick: nickOf(c),
      bio: meta.bio != null ? meta.bio : (c.desc || ''),
      avatarImg: meta.avatar || c.avatar || null, avaIcon: c.icon || null,
      verifiedRaw: !!c.verified, official: !!c.official,
      created: c.created || null, ch: c, chat: null, isMe: false
    };
  }else if(t === 'x'){
    var ch = chatRec(id);
    if(!ch) return null;
    var ty = ch.kind === 'channel' ? 'channel' : ch.kind === 'group' ? 'group' : 'user';
    ent = {
      key: key, type: ty, name: meta.name || ch.name, nick: nickOf(ch),
      bio: meta.bio != null ? meta.bio : (ch.about || ch.preview || ''),
      avatarImg: meta.avatar || ch.avaImg || null, avaIcon: ch.avaIcon || null,
      verifiedRaw: !!ch.verified, official: !!ch.official,
      created: ch.created || null, ch: null, chat: ch, isMe: false
    };
  }else{
    var isMe = (id === nickOf(p));
    var chd = null;
    try{
      if(typeof CHATS !== 'undefined' && CHATS){
        for(var k = 0; k < CHATS.length; k++){
          if(CHATS[k].kind === 'direct' && nickOf(CHATS[k]) === id){ chd = CHATS[k]; break; }
        }
      }
    }catch(e){}
    ent = {
      key: key, type: 'user',
      name: isMe ? p.name : (meta.name || (chd && chd.name) || ('@' + id)),
      nick: id,
      bio: isMe ? (p.bio || '') : (meta.bio != null ? meta.bio : ''),
      avatarImg: isMe ? (meta.avatar || p.avatar || null) : (meta.avatar || (chd && chd.avaImg) || null),
      avaIcon: (chd && chd.avaIcon) || null,
      verifiedRaw: isMe ? !!p.verified : !!(chd && chd.verified),
      official: !!(chd && chd.official),
      created: isMe ? (p.since ? +new Date(p.since) : null) : null,
      ch: null, chat: chd, isMe: isMe
    };
  }

  ent.avaLetter = (String(ent.name || 'O').trim().charAt(0) || 'O').toUpperCase();
  ent.owned = ownedBy(ent);
  ent.typeLabel = TYPE_LABEL[ent.type] || 'Страница';
  ent.typeShort = TYPE_SHORT[ent.type] || 'страница';
  ent.typeIcon = TYPE_ICON[ent.type] || 'user';
  return ent;
}

/* владелец/редактор: свой профиль, свои каналы, а Даниэль — все официальные */
function ownedBy(ent){
  if(!ent) return false;
  if(ent.isMe) return true;
  try{ if(ent.ch && typeof chIsMine === 'function' && chIsMine(ent.ch)) return true; }catch(e){}
  var m = CHm();
  if(ent.ch && m && (m.mine || []).some(function(x){ return x.id === ent.ch.id; })) return true;
  if(isFounder() && (ent.official || (ent.ch && ent.ch.official) || (ent.chat && ent.chat.official))) return true;
  return false;
}

/* ---- верификация: только штатные хелперы ядра ---- */
function verified(ent){
  var probe = { verified: ent.verifiedRaw, official: ent.official, subs: subsCount(ent) };
  try{ if(typeof okoIsVerified === 'function') return okoIsVerified(probe); }catch(e){}
  return !!(probe.verified || probe.official);
}
function badge(ent){
  if(!verified(ent)) return '';
  try{ if(typeof okoVerifyBadge === 'function') return okoVerifyBadge({ verified: true }); }catch(e){}
  return '<svg class="i soc-vb" aria-label="Подтверждённый аккаунт"><use href="#i-verified"/></svg>';
}

/* ==========================================================================
   4. СЧЁТЧИКИ И КОНТЕНТ — считаются только из реального состояния
   ========================================================================== */
function itemsOf(ent){
  if(ent.ch){ ent.ch.posts = ent.ch.posts || []; return ent.ch.posts; }
  SOC.items[ent.key] = SOC.items[ent.key] || [];
  return SOC.items[ent.key];
}
function saveItems(ent){ if(ent.ch) chSaveSafe(); socSave(); }
function postsOf(ent){ return itemsOf(ent).filter(function(p){ return !p.reel; }); }
function reelsOf(ent){ return itemsOf(ent).filter(function(p){ return !!p.reel; }); }

function isSubbed(ent){
  if(ent.isMe) return false;
  if(ent.ch){
    var m = CHm();
    try{ if(typeof chIsMine === 'function' && chIsMine(ent.ch)) return true; }catch(e){}
    return !!(m && m.sub && m.sub[ent.ch.id]);
  }
  return !!SOC.subs[ent.key];
}
function subsCount(ent){
  if(ent.ch) return +ent.ch.subs || 0;               /* модель CH сама ведёт счётчик */
  var base = 0;
  if(ent.chat) base = NUM(ent.chat.subs) || NUM(ent.chat.members) || 0;
  return base + (SOC.subs[ent.key] ? 1 : 0);
}
function toggleSub(ent){
  if(ent.isMe){ T('Это твоя страница'); return; }
  if(ent.ch){
    var c = ent.ch, m = CHm(); if(!m) return;
    m.sub = m.sub || {};
    var mine = false;
    try{ mine = (typeof chIsMine === 'function') && chIsMine(c); }catch(e){}
    if(mine){ T('Ты владелец — отписаться нельзя'); return; }
    if(m.sub[c.id]){
      delete m.sub[c.id]; if(c.subs) c.subs--;
      chSaveSafe(); T('Ты отписался от «' + c.name + '»');
    }else{
      var paid = false;
      try{ paid = (typeof chPaid === 'function') && chPaid(c); }catch(e){}
      if(paid && typeof chSubscribe === 'function'){ chSubscribe(c.id); render(); return; }
      m.sub[c.id] = 1; c.subs = (c.subs || 0) + 1;
      chSaveSafe(); T('Ты подписан на «' + c.name + '»');
    }
  }else{
    if(SOC.subs[ent.key]){ delete SOC.subs[ent.key]; T('Ты отписался от «' + ent.name + '»'); }
    else { SOC.subs[ent.key] = Date.now(); T('Ты подписан на «' + ent.name + '»'); }
    socSave();
    /* лента «Подписки» ядра знает автора по имени — держим её в курсе */
    try{ if(ent.type === 'user' && typeof psSetFollow === 'function') psSetFollow(ent.name, !!SOC.subs[ent.key]); }catch(e){}
  }
  render();
}

/* ==========================================================================
   5. ССЫЛКА И НИК (через модуль v2, со страховкой)
   ========================================================================== */
function linkOf(ent){
  try{ if(typeof okoEntityLink === 'function') return okoEntityLink({ nick: ent.nick, kind: (ent.type === 'user' ? 'direct' : ent.type) }); }catch(e){}
  var n = ent.nick || slug(ent.name);
  return (ent.type === 'user') ? 'https://okoteam.top/@' + n : 'https://okoteam.top/c/' + n;
}
function copyText(txt, ok){
  try{ if(typeof okoCopy === 'function'){ okoCopy(txt, ok); return; } }catch(e){}
  var done = function(){ T(ok || 'Скопировано'); H('success'); };
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(done, fb); return; }
  }catch(e){}
  fb();
  function fb(){
    try{
      var ta = document.createElement('textarea');
      ta.value = txt; ta.style.cssText = 'position:fixed;left:-9999px;top:0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); done();
    }catch(e){ T('Не удалось скопировать'); }
  }
}
function identBlock(ent){
  try{
    if(typeof okoIdentityBlock === 'function'){
      var h = okoIdentityBlock({ name: ent.name, nick: ent.nick, kind: (ent.type === 'user' ? 'direct' : ent.type) });
      if(h) return h;
    }
  }catch(e){}
  return '';
}

/* ==========================================================================
   6. DOM ВЬЮХИ И НАВИГАЦИЯ
   ========================================================================== */
var ROOT = null, NAV = [];

function ensureDom(){
  if(ROOT && document.body.contains(ROOT)) return ROOT;
  injectCss();
  ROOT = document.getElementById('okoSoc');
  if(!ROOT){
    ROOT = document.createElement('div');
    ROOT.id = 'okoSoc';
    ROOT.setAttribute('role', 'dialog');
    ROOT.setAttribute('aria-label', 'Страница сущности OKO');
    ROOT.innerHTML =
      '<div class="soc-head">' +
        '<button class="soc-back" id="okoSocBack" type="button" aria-label="Назад">' + SI('back') + '</button>' +
        '<b id="okoSocTitle">Страница</b>' +
        '<span class="soc-htools" id="okoSocTools"></span>' +
      '</div>' +
      '<div class="soc-body" id="okoSocBody"></div>';
    document.body.appendChild(ROOT);
    bindRoot();
  }
  return ROOT;
}

function isOpen(){ return !!(ROOT && ROOT.classList.contains('open')); }

function open(key, page, arg){
  if(!key) return false;
  if(!entity(key)) return false;
  ensureDom();
  var fresh = !isOpen();
  if(fresh) NAV = [];
  NAV.push({ page: page || 'entity', key: key, tab: 'posts', arg: arg || null });
  render();
  if(fresh){
    ROOT.classList.add('open');
    try{ if(typeof nvPush === 'function') nvPush('view:social', close, step); }catch(e){}
  }
  H('impact');
  return true;
}
function go(page, key, arg){
  if(!isOpen()) return open(key, page, arg);
  NAV.push({ page: page, key: key || top_().key, tab: 'posts', arg: arg || null });
  render();
  return true;
}
function replace(page, key, arg){
  if(!isOpen()) return open(key, page, arg);
  NAV[NAV.length - 1] = { page: page, key: key || top_().key, tab: 'posts', arg: arg || null };
  render();
  return true;
}
function step(){ if(NAV.length > 1){ NAV.pop(); render(); return true; } return false; }
function back(){ if(NAV.length > 1){ NAV.pop(); render(); } else close(); }
function close(){
  if(ROOT) ROOT.classList.remove('open');
  NAV = [];
  try{ if(typeof nvPop === 'function') nvPop('view:social'); }catch(e){}
}
function top_(){ return NAV[NAV.length - 1] || { page: 'entity', key: null, tab: 'posts' }; }

/* Escape — везде выход */
document.addEventListener('keydown', function(e){
  if(e.key === 'Escape' && isOpen()){ e.stopPropagation(); back(); }
}, true);

/* ==========================================================================
   7. РЕНДЕР
   ========================================================================== */
function render(){
  ensureDom();
  var t = top_();
  var ent = entity(t.key);
  var body = document.getElementById('okoSocBody');
  var title = document.getElementById('okoSocTitle');
  var tools = document.getElementById('okoSocTools');
  if(!body) return;
  tools.innerHTML = '';

  if(!ent){
    title.textContent = 'Страница';
    body.innerHTML = '<div class="soc-empty">' + SI('info') + '<p>Страница не найдена</p>' +
      '<small>Сущность удалена или ещё не создана.</small></div>';
    return;
  }

  var out;
  switch(t.page){
    case 'publish': out = pagePublish(ent); break;
    case 'create':  out = pageCreate(ent, t.arg); break;
    case 'manage':  out = pageManage(ent); break;
    case 'edit':    out = pageEdit(ent); break;
    case 'members': out = pageMembers(ent); break;
    default:        out = pageEntity(ent, t);
  }
  title.textContent = out.title;
  if(out.tools) tools.innerHTML = out.tools;
  body.innerHTML = out.html;
  body.scrollTop = t._scroll || 0;
  if(out.after) try{ out.after(); }catch(e){}
}

/* ---------- аватар ---------- */
function avaStyle(ent){
  try{
    if(typeof chAvSeedStyle === 'function') return chAvSeedStyle(ent.nick || ent.name || ent.key);
  }catch(e){}
  return '';
}
function avaHtml(ent, size, cls){
  var inner;
  if(ent.avatarImg) inner = '<img src="' + E(ent.avatarImg) + '" alt="">';
  else if(ent.avaIcon) inner = SI(ent.avaIcon);
  else inner = E(ent.avaLetter);
  return '<span class="soc-ava ' + (cls || '') + '" style="width:' + size + 'px;height:' + size + 'px;' +
    avaStyle(ent) + '">' + inner + '</span>';
}

/* ---------- СТРАНИЦА СУЩНОСТИ ---------- */
function pageEntity(ent, nav){
  var subs = subsCount(ent), posts = postsOf(ent), reels = reelsOf(ent);
  var subbed = isSubbed(ent);
  var tab = nav.tab || 'posts';

  var chips = ['<span class="soc-chip">' + SI(ent.typeIcon) + ent.typeLabel + '</span>'];
  if(ent.official) chips.push('<span class="soc-chip lime">' + SI('logo') + 'Официально OKO</span>');
  if(ent.ch){
    try{
      if(typeof chAccessLine === 'function') chips.push('<span class="soc-chip">' + SI('lock') + E(chAccessLine(ent.ch)) + '</span>');
    }catch(e){}
  }
  if(ent.owned) chips.push('<span class="soc-chip">' + SI('crown') + 'Ты владелец</span>');

  var head =
    '<div class="soc-id">' +
      avaHtml(ent, 96) +
      '<div class="soc-name">' + E(ent.name) + badge(ent) + '</div>' +
      (ent.nick ? '<div class="soc-nick">@' + E(ent.nick) + '</div>' : '') +
      '<div class="soc-kindrow">' + chips.join('') + '</div>' +
    '</div>';

  var stats =
    '<div class="soc-stats">' +
      '<div class="soc-stat" id="socStatSubs"><b>' + FMT(subs) + '</b><small>подписчиков</small></div>' +
      '<div class="soc-stat" id="socStatPosts"><b>' + FMT(posts.length) + '</b><small>публикаций</small></div>' +
      '<div class="soc-stat" id="socStatReels"><b>' + FMT(reels.length) + '</b><small>роликов</small></div>' +
    '</div>';

  var bio = ent.bio ? '<div class="soc-bio">' + E(ent.bio) + '</div>' : '';
  var meta = ent.created ? '<div class="soc-meta">' + SI('clock') + 'Создан ' + E(dateRu(ent.created)) + '</div>' : '';

  /* --- действия --- */
  var acts = [];
  if(!ent.isMe){
    acts.push('<button class="soc-btn' + (subbed ? ' ghost' : '') + '" id="socActFollow" data-a="follow" type="button">' +
      SI(subbed ? 'check' : 'plus') + (subbed ? 'Отписаться' : 'Подписаться') + '</button>');
    acts.push('<button class="soc-btn ghost" id="socActMsg" data-a="msg" type="button">' + SI('chat') + 'Написать</button>');
  }
  if(ent.owned){
    acts.push('<button class="soc-btn" id="socActPublish" data-a="publish" type="button">' + SI('plus') + 'Опубликовать</button>');
    acts.push('<button class="soc-btn ghost" id="socActEdit" data-a="edit" type="button">' + SI('edit') + 'Редактировать</button>');
  }

  var minis = [
    '<button class="soc-mini" id="socActShare" data-a="share" type="button">' + SI('share') + '<span>Поделиться</span></button>',
    '<button class="soc-mini" id="socCopyLink" data-a="copylink" type="button">' + SI('link') + '<span>Скопировать ссылку</span></button>',
    '<button class="soc-mini" id="socCopyNick" data-a="copynick" type="button">' + SI('user') + '<span>Скопировать ник</span></button>',
    '<button class="soc-mini' + (SOC.notify[ent.key] ? ' on' : '') + '" id="socNotify" data-a="notify" type="button">' +
      SI('bell') + '<span>Уведомления: ' + (SOC.notify[ent.key] ? 'вкл' : 'выкл') + '</span></button>'
  ];
  if(ent.owned && ent.ch){
    minis.push('<button class="soc-mini" id="socManage" data-a="manage" type="button">' + SI('gear') + '<span>Управление</span></button>');
    minis.push('<button class="soc-mini" id="socMembers" data-a="members" type="button">' + SI('users') + '<span>Участники и роли</span></button>');
  }
  if(!ent.isMe){
    minis.push('<button class="soc-mini" id="socReport" data-a="report" type="button">' + SI('flag') + '<span>Пожаловаться</span></button>');
  }

  /* --- вкладки --- */
  var tabs =
    '<div class="soc-tabs" id="okoSocTabs">' +
      '<button class="soc-tab ' + (tab === 'posts' ? 'on' : '') + '" data-a="tab" data-v="posts" type="button">' +
        SI('feed') + 'Посты <i>' + posts.length + '</i></button>' +
      '<button class="soc-tab ' + (tab === 'reels' ? 'on' : '') + '" data-a="tab" data-v="reels" type="button">' +
        SI('clips') + 'Ролики <i>' + reels.length + '</i></button>' +
    '</div>';

  var list = '<div id="okoSocList">' + (tab === 'reels' ? reelsHtml(ent, reels) : postsHtml(ent, posts)) + '</div>';

  return {
    title: ent.name,
    html: head + stats + bio + meta +
      '<div class="soc-acts">' + acts.join('') + '</div>' +
      '<div class="soc-grid2">' + minis.join('') + '</div>' +
      identBlock(ent) + tabs + list
  };
}

/* ---------- лента постов сущности ---------- */
function postsHtml(ent, posts){
  if(!posts.length){
    return '<div class="soc-empty">' + SI('feed') +
      '<p>Публикаций пока нет</p><small>' +
      (ent.owned ? 'Нажми «Опубликовать» — пост появится здесь и в ленте рекомендаций OKO.'
                 : 'Когда автор что-то опубликует, записи появятся здесь.') +
      '</small></div>';
  }
  var pinned = ent.ch && ent.ch.pinned;
  var sorted = posts.slice().sort(function(a, b){
    var ap = (pinned && a.id === pinned) ? 1 : 0, bp = (pinned && b.id === pinned) ? 1 : 0;
    if(ap !== bp) return bp - ap;
    return (b.ts || 0) - (a.ts || 0);
  });
  return sorted.map(function(p){
    var liked = !!p._liked;
    return '<article class="soc-post" data-pid="' + E(p.id || '') + '">' +
      ((pinned && p.id === pinned) ? '<div class="soc-pin">' + SI('pin') + 'Закреплено</div>' : '') +
      '<div class="soc-post-h">' + avaHtml(ent, 34, 'sm') + '<b>' + E(ent.name) + '</b>' + badge(ent) +
        '<small>' + E(p.ts ? whenRu(p.ts) : (p.when || '')) + '</small></div>' +
      (p.txt ? '<div class="soc-post-t">' + E(p.txt) + '</div>' : '') +
      (p.img ? '<div class="soc-post-img"><img src="' + E(p.img) + '" alt=""></div>' : '') +
      '<div class="soc-post-a">' +
        '<button data-a="like" data-v="' + E(p.id || '') + '" class="' + (liked ? 'on' : '') + '" type="button">' +
          SI('heart') + (p.likes || 0) + '</button>' +
        (commentTarget(ent) ? '<button data-a="comments" type="button">' + SI('comment') + 'Комментарии</button>' : '') +
        '<button data-a="sharepost" data-v="' + E(p.id || '') + '" type="button">' + SI('share') + 'Поделиться</button>' +
        (ent.owned ? '<button data-a="pin" data-v="' + E(p.id || '') + '" type="button">' + SI('pin') +
          ((pinned && p.id === pinned) ? 'Открепить' : 'Закрепить') + '</button>' : '') +
        (ent.owned ? '<button data-a="del" data-v="' + E(p.id || '') + '" type="button">' + SI('trash') + '</button>' : '') +
      '</div>' +
    '</article>';
  }).join('');
}

/* ---------- сетка роликов 3 в ряд ---------- */
function reelsHtml(ent, reels){
  if(!reels.length){
    return '<div class="soc-empty">' + SI('clips') +
      '<p>Роликов пока нет</p><small>' +
      (ent.owned ? 'Нажми «Опубликовать» и выбери формат 9:16 или 16:9 — ролик встанет в эту сетку, в ленту рекомендаций и в плеер клипов.'
                 : 'Когда автор выложит ролик, он появится в этой сетке.') +
      '</small></div>';
  }
  var sorted = reels.slice().sort(function(a, b){ return (b.ts || 0) - (a.ts || 0); });
  return '<div class="soc-reels">' + sorted.map(function(p){
    var cover = p.cover ? ' style="background-image:url(' + E(p.cover) + ')"' : '';
    return '<button class="soc-reel" data-a="reel" data-v="' + E(p.id || '') + '" type="button" ' +
      'aria-label="Ролик ' + E(p.reel.ratio) + '">' +
      '<span class="soc-reel-c"' + cover + '></span>' +
      '<span class="soc-reel-sh"></span>' +
      '<span class="soc-reel-r">' + E(p.reel.ratio) + '</span>' +
      '<span class="soc-reel-p">' + SI('play') + '</span>' +
      (p.txt ? '<span class="soc-reel-cap">' + E(p.txt) + '</span>' : '') +
    '</button>';
  }).join('') + '</div>';
}

function commentTarget(ent){
  try{
    if(ent.chat && typeof okoLinkedChat === 'function'){ var lc = okoLinkedChat(ent.chat); if(lc) return lc; }
  }catch(e){}
  return null;
}

/* ==========================================================================
   8. ПУБЛИКАЦИЯ: ролик 9:16 / ролик 16:9 / пост
   ========================================================================== */
var PUB = { key: null, fmt: 'post', text: '', cover: null, video: null, videoName: '', dur: '' };

function resetPub(key){ PUB = { key: key, fmt: 'post', text: '', cover: null, video: null, videoName: '', dur: '' }; }

function pagePublish(ent){
  if(!ent.owned){
    return { title: 'Публикация', html: '<div class="soc-empty">' + SI('lock') + '<p>Нет прав на публикацию</p>' +
      '<small>Публиковать может только владелец или администратор сущности.</small></div>' };
  }
  if(PUB.key !== ent.key) resetPub(ent.key);
  var isReel = (PUB.fmt === '9:16' || PUB.fmt === '16:9');
  var canGo = isReel ? (!!PUB.cover || !!PUB.video) : (!!PUB.text.trim() || !!PUB.cover);

  var prevCls = PUB.fmt === '9:16' ? 'r916' : PUB.fmt === '16:9' ? 'r169' : 'rpost';
  var prevStyle = PUB.cover ? ' style="background-image:url(' + E(PUB.cover) + ')"' : '';
  var prevInner = PUB.cover ? '' :
    '<span>' + (isReel
      ? (PUB.video ? 'Видео приложено: ' + E(PUB.videoName) + (PUB.dur ? ' · ' + E(PUB.dur) : '') : 'Обложка не выбрана')
      : 'Фото не выбрано') + '</span>';

  var media = isReel
    ? '<label class="soc-file">' + SI('circle-play') +
        '<span>' + (PUB.video ? 'Видео: ' + E(PUB.videoName) + (PUB.dur ? ' · ' + E(PUB.dur) : '') : 'Видео с устройства') + '</span>' +
        '<input type="file" id="socPubVideo" accept="video/*"></label>' +
      '<div style="height:8px"></div>' +
      '<label class="soc-file">' + SI('photo') +
        '<span>' + (PUB.cover ? 'Обложка выбрана — заменить' : 'Обложка ролика') + '</span>' +
        '<input type="file" id="socPubCover" accept="image/*"></label>'
    : '<label class="soc-file">' + SI('photo') +
        '<span>' + (PUB.cover ? 'Фото выбрано — заменить' : 'Фото к посту') + '</span>' +
        '<input type="file" id="socPubCover" accept="image/*"></label>';

  var html =
    '<div class="soc-sec">' + SI('bolt') + 'Формат публикации</div>' +
    '<div class="soc-fmt" id="socPubFmt">' +
      '<button data-a="fmt" data-v="9:16" class="' + (PUB.fmt === '9:16' ? 'on' : '') + '" type="button">' +
        SI('ratio-916') + 'Ролик 9:16</button>' +
      '<button data-a="fmt" data-v="16:9" class="' + (PUB.fmt === '16:9' ? 'on' : '') + '" type="button">' +
        SI('ratio-169') + 'Ролик 16:9</button>' +
      '<button data-a="fmt" data-v="post" class="' + (PUB.fmt === 'post' ? 'on' : '') + '" type="button">' +
        SI('feed') + 'Пост</button>' +
    '</div>' +

    '<label class="soc-lab" for="socPubText">' + (isReel ? 'Подпись к ролику' : 'Текст поста') + '</label>' +
    '<textarea class="soc-ta" id="socPubText" maxlength="900" placeholder="' +
      (isReel ? 'О чём ролик — коротко и по делу' : 'Что нового? Поделись пользой с подписчиками') +
      '">' + E(PUB.text) + '</textarea>' +

    '<div class="soc-sec">' + SI('photo') + (isReel ? 'Видео и обложка' : 'Фото') + '</div>' +
    media +
    '<div class="soc-prev ' + prevCls + '"' + prevStyle + '>' + prevInner + '</div>' +

    '<div style="height:18px"></div>' +
    '<button class="soc-btn" id="socPubGo" data-a="pubgo" type="button"' + (canGo ? '' : ' disabled') + '>' +
      SI('send') + 'Опубликовать</button>' +
    '<div class="soc-note">' +
      (isReel
        ? 'Ролик встанет в раздел «Ролики» этой страницы, в ленту рекомендаций OKO и в плеер клипов. Нужно приложить видео или обложку — пустой ролик не публикуем.'
        : 'Пост встанет в раздел «Посты» этой страницы и в ленту рекомендаций OKO.') +
    '</div>';

  return {
    title: 'Публикация · ' + ent.name,
    html: html,
    after: function(){
      var ta = document.getElementById('socPubText');
      if(ta) ta.addEventListener('input', function(){
        PUB.text = ta.value;
        syncPubBtn();
      });
      var cov = document.getElementById('socPubCover');
      if(cov) cov.addEventListener('change', function(){
        var f = cov.files && cov.files[0]; if(!f) return;
        readImage(f, 1080, 0.78, function(url){ PUB.cover = url; render(); });
      });
      var vid = document.getElementById('socPubVideo');
      if(vid) vid.addEventListener('change', function(){
        var f = vid.files && vid.files[0]; if(!f) return;
        readVideo(f, function(res){ PUB.video = res.url; PUB.videoName = f.name; PUB.dur = res.dur; render(); });
      });
    }
  };
}
function syncPubBtn(){
  var b = document.getElementById('socPubGo'); if(!b) return;
  var isReel = (PUB.fmt === '9:16' || PUB.fmt === '16:9');
  var ok = isReel ? (!!PUB.cover || !!PUB.video) : (!!PUB.text.trim() || !!PUB.cover);
  b.disabled = !ok;
}

function readImage(file, maxW, q, cb){
  if(!file || !/^image\//.test(file.type || '')){ T('Нужен файл-изображение'); return; }
  var rd = new FileReader();
  rd.onload = function(e){
    var raw = e.target.result;
    var img = new Image();
    img.onload = function(){
      try{
        var sc = Math.min(1, maxW / img.width);
        var cv = document.createElement('canvas');
        cv.width = Math.max(1, Math.round(img.width * sc));
        cv.height = Math.max(1, Math.round(img.height * sc));
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        cb(cv.toDataURL('image/jpeg', q));
      }catch(err){ cb(raw); }
    };
    img.onerror = function(){ cb(raw); };
    img.src = raw;
  };
  rd.onerror = function(){ T('Не удалось прочитать файл'); };
  rd.readAsDataURL(file);
}
function readVideo(file, cb){
  var url;
  try{ url = URL.createObjectURL(file); }catch(e){ cb({ url: '', dur: '' }); return; }
  var v = document.createElement('video');
  var done = false;
  var fin = function(d){ if(done) return; done = true; cb({ url: url, dur: d }); };
  v.preload = 'metadata';
  v.onloadedmetadata = function(){ fin(isFinite(v.duration) && v.duration > 0 ? fmtDur(v.duration) : ''); };
  v.onerror = function(){ fin(''); };
  setTimeout(function(){ fin(''); }, 2500);
  try{ v.src = url; }catch(e){ fin(''); }
}

function publish(){
  var ent = entity(PUB.key);
  if(!ent || !ent.owned){ T('Нет прав на публикацию'); return false; }
  var isReel = (PUB.fmt === '9:16' || PUB.fmt === '16:9');
  var txt = String(PUB.text || '').trim();
  if(isReel && !PUB.cover && !PUB.video){ T('Приложи видео или обложку ролика'); return false; }
  if(!isReel && !txt && !PUB.cover){ T('Добавь текст или фото'); return false; }

  var item = {
    id: 'sp' + (++SOC.seq) + '-' + Date.now().toString(36),
    txt: txt, ts: Date.now(), when: 'сейчас', likes: 0, views: 0
  };
  if(isReel){
    item.reel = { ratio: PUB.fmt, dur: PUB.dur || '' };
    if(PUB.cover) item.cover = PUB.cover;
    if(PUB.video) item.src = PUB.video;
    item.media = PUB.fmt;                       /* маркер для старой ленты канала */
  }else if(PUB.cover){
    item.img = PUB.cover;
  }

  itemsOf(ent).unshift(item);
  saveItems(ent);
  pushToFeed(ent, item);

  var wasReel = isReel;
  resetPub(ent.key);
  /* возвращаемся на страницу сущности и открываем нужную вкладку */
  if(NAV.length > 1) NAV.pop();
  var t = top_(); t.tab = wasReel ? 'reels' : 'posts';
  render();
  T(wasReel
    ? 'Ролик опубликован: раздел «Ролики», лента рекомендаций и клипы'
    : 'Пост опубликован: раздел «Посты» и лента рекомендаций');
  H('success');
  return true;
}

/* публикация уходит в ленту рекомендаций; ролики оттуда подхватывает плеер клипов */
function pushToFeed(ent, item){
  try{
    if(typeof POSTS === 'undefined' || !POSTS || !Array.isArray(POSTS.rec)) return;
    var id = (SOC.feedSeq = (SOC.feedSeq || 5000000) + 1);
    item.feedId = id;
    var mediaMark = null;
    if(item.reel) mediaMark = (item.reel.dur ? item.reel.dur + ' · ' : '') + item.reel.ratio;
    var cover = item.cover || item.img || null;
    POSTS.rec.unshift({
      id: id,
      ava: ent.avaLetter, avaIcon: ent.avaIcon || null, avaImg: ent.avatarImg || null,
      name: ent.name,
      sub: ent.typeShort + ' · ' + FMT(subsCount(ent)),
      body: item.txt || '',
      media: mediaMark,
      img: cover, poster: cover, src: item.src || '',
      likes: 0, views: 0, liked: false, saved: false, reposts: 0, comments: [],
      topic: null,
      socKey: ent.key, socItem: item.id, socCover: cover,
      socRatio: item.reel ? item.reel.ratio : null,
      chOrigin: ent.ch ? ent.ch.id : null
    });
    socSave();
    if(typeof renderFeed === 'function' && typeof curFeedKind !== 'undefined' && curFeedKind === 'rec'){
      try{ renderFeed('rec'); }catch(e){}
    }
    try{
      if(window.okoReels && typeof window.okoReels.refresh === 'function' &&
         window.okoReels.isOpen && window.okoReels.isOpen()) window.okoReels.refresh();
    }catch(e){}
  }catch(e){}
}

/* обложки соц-роликов в общей ленте — иначе на месте кадра пустой градиент */
function decorateFeed(){
  try{
    var list = document.getElementById('feedList'); if(!list) return;
    var arts = list.querySelectorAll('article.post[data-pid]');
    for(var i = 0; i < arts.length; i++){
      var pid = arts[i].getAttribute('data-pid');
      var p = null;
      try{ if(typeof postById === 'function') p = postById(+pid); }catch(e){}
      if(!p || !p.socCover) continue;
      var m = arts[i].querySelector('.media');
      if(m && !m.classList.contains('soc-cover')){
        m.classList.add('soc-cover');
        m.style.backgroundImage = 'url(' + p.socCover + ')';
      }
    }
  }catch(e){}
}

/* ==========================================================================
   9. СОЗДАНИЕ: канал / чат / клуб (супергруппа) / курс
   ========================================================================== */
var CRE = { kind: 'channel', name: '', desc: '', access: 'open', price: 0, avatar: null };

var CREATE_KINDS = [
  ['channel', 'megaphone', 'Канал', 'Лента постов и роликов. Публикует владелец, читают все.'],
  ['chat',    'users',     'Чат',   'Общая беседа: пишут все участники, роли и модерация.'],
  ['club',    'crown',     'Клуб',  'Супергруппа: роли, права, темы, закреп, вход по ссылке.'],
  ['course',  'circle-play', 'Курс', 'Уроки с прогрессом. Всегда закрытый, доступ после оплаты.']
];

function pageCreate(ent, arg){
  if(arg && arg.kind && CRE.kind !== arg.kind) CRE.kind = arg.kind;
  var paid = (CRE.price || 0) > 0;
  var lock = (CRE.kind === 'course');
  if(lock){ CRE.access = 'closed'; if(!CRE.price) CRE.price = 990; }

  var html =
    '<div class="soc-sec">' + SI('bolt') + 'Что создаём</div>' +
    '<div class="soc-kinds" id="socCrKinds">' + CREATE_KINDS.map(function(k){
      return '<button class="soc-kind ' + (CRE.kind === k[0] ? 'on' : '') + '" data-a="crkind" data-v="' + k[0] + '" type="button">' +
        SI(k[1]) + '<b>' + k[2] + '</b><small>' + k[3] + '</small></button>';
    }).join('') + '</div>' +

    '<label class="soc-lab" for="socCrName">Название</label>' +
    '<input class="soc-input" id="socCrName" maxlength="48" placeholder="Например: Клуб роста" value="' + E(CRE.name) + '">' +

    '<label class="soc-lab" for="socCrDesc">Описание</label>' +
    '<textarea class="soc-ta" id="socCrDesc" maxlength="400" placeholder="О чём это место и что получит участник">' + E(CRE.desc) + '</textarea>' +

    '<label class="soc-lab">Аватар</label>' +
    '<label class="soc-file">' + SI('camera') + '<span>' + (CRE.avatar ? 'Фото выбрано — заменить' : 'Загрузить фото (круглый аватар)') + '</span>' +
      '<input type="file" id="socCrAva" accept="image/*"></label>' +
    (CRE.avatar ? '<div style="display:flex;justify-content:center;margin-top:10px">' +
      '<span class="soc-ava" style="width:76px;height:76px"><img src="' + E(CRE.avatar) + '" alt=""></span></div>' : '') +

    '<div class="soc-sec">' + SI('lock') + 'Доступ</div>' +
    '<div class="soc-seg" id="socCrAccess">' +
      '<button data-a="craccess" data-v="open" class="' + (CRE.access === 'open' ? 'on' : '') + '"' + (lock ? ' disabled' : '') + ' type="button">Открытый</button>' +
      '<button data-a="craccess" data-v="closed" class="' + (CRE.access === 'closed' ? 'on' : '') + '" type="button">Закрытый</button>' +
    '</div>' +
    (lock ? '<div class="soc-note">Курс всегда закрытый — уроки открываются после покупки.</div>' : '') +

    '<div class="soc-sec">' + SI('money') + 'Оплата</div>' +
    '<div class="soc-seg" id="socCrPaid">' +
      '<button data-a="crpaid" data-v="0" class="' + (!paid ? 'on' : '') + '"' + (lock ? ' disabled' : '') + ' type="button">Бесплатно</button>' +
      '<button data-a="crpaid" data-v="1" class="' + (paid ? 'on' : '') + '" type="button">Платно</button>' +
    '</div>' +
    (paid ? '<label class="soc-lab" for="socCrPrice">Цена, ₽' + (CRE.kind === 'course' ? ' (разовая)' : ' в месяц') + '</label>' +
      '<input class="soc-input" id="socCrPrice" inputmode="numeric" value="' + (CRE.price || 0) + '">' : '') +

    '<div style="height:18px"></div>' +
    '<button class="soc-btn" id="socCrGo" data-a="crgo" type="button"' + (CRE.name.trim() ? '' : ' disabled') + '>' +
      SI('plus') + 'Создать</button>' +
    '<div class="soc-note">После создания откроется страница сущности: подписчики, посты, ролики, ссылка и приглашения.' +
      (CRE.kind === 'club' ? ' У клуба сразу будут роли, права, темы и закреп — как в супергруппе Telegram.' : '') + '</div>';

  return {
    title: 'Создать',
    html: html,
    after: function(){
      var n = document.getElementById('socCrName');
      if(n) n.addEventListener('input', function(){
        CRE.name = n.value;
        var b = document.getElementById('socCrGo'); if(b) b.disabled = !CRE.name.trim();
      });
      var d = document.getElementById('socCrDesc');
      if(d) d.addEventListener('input', function(){ CRE.desc = d.value; });
      var pr = document.getElementById('socCrPrice');
      if(pr) pr.addEventListener('input', function(){ CRE.price = +String(pr.value).replace(/\D/g, '') || 0; });
      var av = document.getElementById('socCrAva');
      if(av) av.addEventListener('change', function(){
        var f = av.files && av.files[0]; if(!f) return;
        readImage(f, 512, 0.82, function(url){ CRE.avatar = url; render(); });
      });
    }
  };
}

function createEntity(){
  var m = CHm();
  if(!m){ T('Модель каналов недоступна'); return null; }
  var name = String(CRE.name || '').trim();
  if(!name){ T('Введи название'); return null; }
  m.seq = (m.seq || 0) + 1;
  var kind = CRE.kind;
  var chatLike = (kind === 'chat' || kind === 'club');
  var p = P();

  var rec = {
    id: 'ch-my-' + m.seq,
    name: name,
    nick: slug(name),
    desc: String(CRE.desc || '').trim(),
    icon: null, bg: 0,
    avatar: CRE.avatar || null, cover: null,
    kind: kind,
    access: (kind === 'course') ? 'closed' : CRE.access,
    price: (kind === 'course' && !CRE.price) ? 990 : (CRE.price || 0),
    verified: false, official: false,
    created: Date.now(),
    subs: 1, reactions: true, discussions: kind !== 'course',
    whoPost: chatLike ? 'subs' : 'admins',
    commentsOn: (kind === 'channel') ? true : undefined,
    admins: [], gross: 0, black: [], invites: [],
    members: [{ name: p.name, nick: nickOf(p), joined: 'сейчас' }],
    roles: (function(){ var r = {}; r[nickOf(p)] = 'owner'; return r; })(),
    perms: { write: chatLike ? 'all' : 'admins', call: chatLike ? 'all' : 'admins', publish: 'admins' },
    topics: [],
    pinned: null,
    posts: []
  };
  try{ if(typeof chNormalize === 'function') chNormalize(rec); }catch(e){}
  /* chNormalize может выставить свои дефолты — возвращаем наши осознанные значения */
  rec.created = rec.created || Date.now();
  rec.posts = rec.posts || [];

  m.mine = m.mine || [];
  m.mine.unshift(rec);
  chSaveSafe();
  try{ if(typeof chMirrorToChats === 'function') chMirrorToChats(rec); }catch(e){}

  CRE = { kind: 'channel', name: '', desc: '', access: 'open', price: 0, avatar: null };
  return rec;
}

/* ==========================================================================
   10. УПРАВЛЕНИЕ (клуб-супергруппа: права, темы, закреп, приглашения)
   ========================================================================== */
var ROLE_ORDER = ['member', 'mod', 'admin', 'owner'];
var ROLE_LABEL = { owner: 'владелец', admin: 'админ', mod: 'модератор', member: 'участник' };

function pageManage(ent){
  if(!ent.owned || !ent.ch){
    return { title: 'Управление', html: '<div class="soc-empty">' + SI('lock') + '<p>Нет доступа</p>' +
      '<small>Управлять может владелец сущности.</small></div>' };
  }
  var c = ent.ch;
  c.perms = c.perms || { write: 'admins', call: 'admins', publish: 'admins' };
  c.topics = c.topics || [];
  c.invites = Array.isArray(c.invites) ? c.invites : [];

  var seg = function(a, v, opts){
    return '<div class="soc-seg">' + opts.map(function(o){
      return '<button data-a="' + a + '" data-v="' + o[0] + '" class="' + (v === o[0] ? 'on' : '') + '" type="button">' + o[1] + '</button>';
    }).join('') + '</div>';
  };

  var pinnedPost = null;
  if(c.pinned) pinnedPost = (c.posts || []).filter(function(p){ return p.id === c.pinned; })[0] || null;

  var html =
    '<div class="soc-sec">' + SI('shield') + 'Права участников</div>' +
    '<div class="soc-card">' +
      '<div class="soc-row"><div class="soc-row-b"><b>Кто пишет</b><small>Сообщения в общей ленте сущности</small></div></div>' +
      seg('permwrite', c.perms.write, [['all', 'Все'], ['admins', 'Админы']]) +
      '<div class="soc-row"><div class="soc-row-b"><b>Кто звонит</b><small>Голосовые и видеозвонки внутри</small></div></div>' +
      seg('permcall', c.perms.call, [['all', 'Все'], ['admins', 'Админы'], ['off', 'Выключено']]) +
      '<div class="soc-row" style="border-bottom:0"><div class="soc-row-b"><b>Кто публикует</b><small>Посты и ролики 9:16 / 16:9</small></div></div>' +
      seg('permpub', c.perms.publish, [['all', 'Все'], ['admins', 'Админы']]) +
    '</div>' +

    '<div class="soc-sec">' + SI('feed') + 'Темы (топики)</div>' +
    '<div style="display:flex;gap:8px;align-items:stretch">' +
      '<input class="soc-input" id="socTopicName" maxlength="40" placeholder="Название темы" style="flex:1;min-width:0">' +
      '<button class="soc-btn" data-a="topicadd" type="button" style="flex:0 0 auto">' + SI('plus') + 'Добавить</button>' +
    '</div>' +
    (c.topics.length
      ? '<div class="soc-card" style="margin-top:10px">' + c.topics.map(function(t){
          return '<div class="soc-row"><div class="soc-row-b"><b>' + E(t.title) + '</b></div>' +
            '<button class="soc-row-x" data-a="topicdel" data-v="' + E(t.id) + '" type="button" aria-label="Удалить тему">' + SI('trash') + '</button></div>';
        }).join('') + '</div>'
      : '<div class="soc-note">Тем пока нет. Тема — отдельная ветка обсуждения внутри сущности.</div>') +

    '<div class="soc-sec">' + SI('pin') + 'Закреп</div>' +
    (pinnedPost
      ? '<div class="soc-card"><div class="soc-row" style="border-bottom:0">' +
          '<div class="soc-row-b"><b>' + E((pinnedPost.txt || 'Публикация').slice(0, 70)) + '</b>' +
          '<small>' + E(pinnedPost.ts ? whenRu(pinnedPost.ts) : (pinnedPost.when || '')) + '</small></div>' +
          '<button class="soc-row-x" data-a="unpin" type="button" aria-label="Открепить">' + SI('x') + '</button></div></div>'
      : '<div class="soc-note">Ничего не закреплено. Закрепить можно кнопкой под любой публикацией на вкладке «Посты».</div>') +

    '<div class="soc-sec">' + SI('link') + 'Приглашения по ссылке</div>' +
    '<button class="soc-btn ghost" data-a="inviteadd" type="button">' + SI('plus') + 'Создать ссылку-приглашение</button>' +
    (c.invites.length
      ? '<div class="soc-card" style="margin-top:10px">' + c.invites.map(function(iv){
          return '<div class="soc-row"><div class="soc-row-b"><b class="oko-breakable">' + E(iv.link) + '</b>' +
            '<small>создана ' + E(dateRu(iv.created)) + ' · переходов: ' + (iv.uses || 0) + '</small></div>' +
            '<button class="soc-row-x" data-a="invitecopy" data-v="' + E(iv.code) + '" type="button" aria-label="Скопировать">' + SI('copy') + '</button>' +
            '<button class="soc-row-x" data-a="invitedel" data-v="' + E(iv.code) + '" type="button" aria-label="Удалить">' + SI('trash') + '</button></div>';
        }).join('') + '</div>'
      : '<div class="soc-note">Ссылок нет. Ссылка-приглашение открывает вход даже в закрытую сущность.</div>') +

    '<div class="soc-sec">' + SI('gear') + 'Ещё</div>' +
    '<button class="soc-mini" data-a="chadvanced" type="button" style="width:100%">' + SI('chart') +
      '<span>Расширенные настройки в разделе «Каналы»: статистика, чёрный список, оформление</span></button>' +
    '<div style="height:14px"></div>';

  return {
    title: 'Управление · ' + ent.name,
    html: html,
    after: function(){
      var i = document.getElementById('socTopicName');
      if(i) i.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); act('topicadd', null); } });
    }
  };
}

function pageMembers(ent){
  if(!ent.owned || !ent.ch){
    return { title: 'Участники', html: '<div class="soc-empty">' + SI('lock') + '<p>Нет доступа</p><small>Список участников виден владельцу.</small></div>' };
  }
  var c = ent.ch;
  var members = Array.isArray(c.members) ? c.members : [];
  c.roles = c.roles || {};
  if(!members.length){
    return { title: 'Участники', html: '<div class="soc-empty">' + SI('users') + '<p>Участников пока нет</p>' +
      '<small>Пригласи людей ссылкой из раздела «Управление» — список заполнится настоящими людьми.</small></div>' };
  }
  var html = '<div class="soc-card">' + members.map(function(mm){
    var nk = nickOf(mm);
    var role = c.roles[nk] || 'member';
    var e2 = { name: mm.name, nick: nk, avaLetter: (String(mm.name || 'O').charAt(0) || 'O').toUpperCase(), avatarImg: null, avaIcon: null };
    return '<div class="soc-row">' + avaHtml(e2, 36, 'sm') +
      '<div class="soc-row-b"><b>' + E(mm.name) + '</b><small>@' + E(nk) + (mm.joined ? ' · с нами ' + E(mm.joined) : '') + '</small></div>' +
      '<button class="soc-role ' + (role === 'owner' ? 'owner' : '') + '" data-a="role" data-v="' + E(nk) + '" type="button">' +
        E(ROLE_LABEL[role]) + '</button></div>';
  }).join('') + '</div>' +
  '<div class="soc-note">Тап по роли переключает её: участник → модератор → админ → владелец. Роли реальные и сохраняются локально до подключения бэкенда.</div>';
  return { title: 'Участники · ' + ent.name, html: html };
}

/* ---------- редактирование сущности ---------- */
var EDT = { key: null, name: '', bio: '', avatar: null };
function pageEdit(ent){
  if(!ent.owned) return { title: 'Редактирование', html: '<div class="soc-empty">' + SI('lock') + '<p>Нет прав</p><small>Редактировать может владелец.</small></div>' };
  if(EDT.key !== ent.key) EDT = { key: ent.key, name: ent.name, bio: ent.bio || '', avatar: ent.avatarImg || null };
  var prev = { avatarImg: EDT.avatar, avaIcon: ent.avaIcon, avaLetter: (String(EDT.name || 'O').charAt(0) || 'O').toUpperCase(), nick: ent.nick, name: EDT.name };
  var html =
    '<div style="display:flex;justify-content:center;padding:16px 0 4px">' + avaHtml(prev, 92) + '</div>' +
    '<label class="soc-file">' + SI('camera') + '<span>' + (EDT.avatar ? 'Фото выбрано — заменить' : 'Загрузить фото') + '</span>' +
      '<input type="file" id="socEdAva" accept="image/*"></label>' +
    '<label class="soc-lab" for="socEdName">Имя / название</label>' +
    '<input class="soc-input" id="socEdName" maxlength="60" value="' + E(EDT.name) + '">' +
    '<label class="soc-lab" for="socEdBio">Описание</label>' +
    '<textarea class="soc-ta" id="socEdBio" maxlength="600">' + E(EDT.bio) + '</textarea>' +
    '<div style="height:18px"></div>' +
    '<button class="soc-btn" id="socEdGo" data-a="edgo" type="button">' + SI('check') + 'Сохранить</button>' +
    '<div class="soc-note">Изменения применяются сразу: имя и аватар обновятся в списке чатов и в ленте.</div>';
  return {
    title: 'Редактирование',
    html: html,
    after: function(){
      var n = document.getElementById('socEdName');
      if(n) n.addEventListener('input', function(){ EDT.name = n.value; });
      var b = document.getElementById('socEdBio');
      if(b) b.addEventListener('input', function(){ EDT.bio = b.value; });
      var a = document.getElementById('socEdAva');
      if(a) a.addEventListener('change', function(){
        var f = a.files && a.files[0]; if(!f) return;
        readImage(f, 512, 0.82, function(url){ EDT.avatar = url; render(); });
      });
    }
  };
}
function saveEdit(ent){
  var name = String(EDT.name || '').trim();
  if(!name){ T('Название не может быть пустым'); return; }
  if(ent.ch){
    ent.ch.name = name; ent.ch.desc = EDT.bio;
    if(EDT.avatar) ent.ch.avatar = EDT.avatar;
    chSaveSafe();
    try{
      if(typeof CHATS !== 'undefined' && CHATS){
        for(var i = 0; i < CHATS.length; i++) if(CHATS[i].chId === ent.ch.id){
          CHATS[i].name = name; if(EDT.avatar) CHATS[i].avaImg = EDT.avatar;
        }
      }
    }catch(e){}
  }else{
    SOC.meta[ent.key] = SOC.meta[ent.key] || {};
    SOC.meta[ent.key].name = name;
    SOC.meta[ent.key].bio = EDT.bio;
    if(EDT.avatar) SOC.meta[ent.key].avatar = EDT.avatar;
    socSave();
    if(ent.chat){ ent.chat.name = name; if(EDT.avatar) ent.chat.avaImg = EDT.avatar; }
    if(ent.isMe){
      try{ P().name = name; P().bio = EDT.bio; if(EDT.avatar) P().avatar = EDT.avatar; }catch(e){}
      try{ if(typeof renderMyProfile === 'function') renderMyProfile(); }catch(e){}
    }
  }
  try{ if(typeof renderChatList === 'function') renderChatList(); }catch(e){}
  EDT = { key: null, name: '', bio: '', avatar: null };
  if(NAV.length > 1) NAV.pop();
  render();
  T('Изменения сохранены');
}

/* ==========================================================================
   11. ДЕЙСТВИЯ
   ========================================================================== */
function act(a, v, el){
  var t = top_();
  var ent = entity(t.key);
  if(!ent && a !== 'crkind' && a !== 'crgo') return;

  switch(a){
    case 'tab':
      t.tab = v;
      render();
      break;

    case 'follow': toggleSub(ent); break;

    case 'msg': openMessage(ent); break;

    case 'share': shareEntity(ent); break;

    case 'copylink': copyText(linkOf(ent), 'Ссылка скопирована'); break;

    case 'copynick':
      if(!ent.nick){ T('У сущности нет ника'); return; }
      copyText('@' + ent.nick, 'Ник скопирован');
      break;

    case 'notify':
      if(SOC.notify[ent.key]){ delete SOC.notify[ent.key]; T('Уведомления выключены'); }
      else { SOC.notify[ent.key] = 1; T('Уведомления включены'); }
      socSave(); render();
      break;

    case 'report':
      SOC.reports.push({ key: ent.key, name: ent.name, ts: Date.now() });
      socSave();
      T('Жалоба записана локально — уйдёт модерации, когда подключим бэкенд');
      break;

    case 'publish': resetPub(ent.key); go('publish', ent.key); break;

    case 'edit': EDT.key = null; go('edit', ent.key); break;

    case 'edgo': saveEdit(ent); break;

    case 'manage': go('manage', ent.key); break;

    case 'members': go('members', ent.key); break;

    case 'fmt': PUB.fmt = v; render(); break;

    case 'pubgo': publish(); break;

    case 'crkind': CRE.kind = v; if(v === 'course'){ CRE.access = 'closed'; if(!CRE.price) CRE.price = 990; } render(); break;

    case 'craccess': CRE.access = v; render(); break;

    case 'crpaid':
      if(v === '1'){ if(!CRE.price) CRE.price = (CRE.kind === 'course') ? 990 : 299; CRE.access = 'closed'; }
      else CRE.price = 0;
      render();
      break;

    case 'crgo': {
      var rec = createEntity();
      if(!rec) return;
      NAV = [{ page: 'entity', key: 'c:' + rec.id, tab: 'posts' }];
      render();
      T('Создано: ' + rec.name);
      H('success');
      break;
    }

    case 'like': {
      var it = itemsOf(ent).filter(function(p){ return p.id === v; })[0];
      if(!it) return;
      it._liked = !it._liked;
      it.likes = Math.max(0, (it.likes || 0) + (it._liked ? 1 : -1));
      saveItems(ent);
      var host = document.getElementById('okoSocList');
      if(host) host.innerHTML = postsHtml(ent, postsOf(ent));
      break;
    }

    case 'del': {
      var arr = itemsOf(ent);
      for(var i = 0; i < arr.length; i++) if(arr[i].id === v){
        var fid = arr[i].feedId;
        arr.splice(i, 1);
        if(fid && typeof POSTS !== 'undefined' && POSTS){
          POSTS.rec = (POSTS.rec || []).filter(function(p){ return p.id !== fid; });
          POSTS.sub = (POSTS.sub || []).filter(function(p){ return p.id !== fid; });
          try{ if(typeof renderFeed === 'function' && typeof curFeedKind !== 'undefined') renderFeed(curFeedKind); }catch(e){}
        }
        break;
      }
      if(ent.ch && ent.ch.pinned === v) ent.ch.pinned = null;
      saveItems(ent);
      render();
      T('Публикация удалена');
      break;
    }

    case 'pin':
      if(!ent.ch){ T('Закреп доступен у каналов, клубов и курсов'); return; }
      ent.ch.pinned = (ent.ch.pinned === v) ? null : v;
      chSaveSafe(); render();
      T(ent.ch.pinned ? 'Публикация закреплена' : 'Закреп снят');
      break;

    case 'unpin':
      if(ent.ch){ ent.ch.pinned = null; chSaveSafe(); render(); T('Закреп снят'); }
      break;

    case 'sharepost': {
      var link = linkOf(ent) + '/p/' + encodeURIComponent(v);
      copyText(link, 'Ссылка на публикацию скопирована');
      break;
    }

    case 'comments': {
      var target = commentTarget(ent);
      if(target && typeof openConv === 'function'){
        close();
        try{ if(typeof showTab === 'function') showTab('chats'); }catch(e){}
        try{ openConv(target.id); }catch(e){}
      }
      break;
    }

    case 'reel': {
      var r = itemsOf(ent).filter(function(p){ return p.id === v; })[0];
      if(!r) return;
      if(r.feedId && window.okoReels && typeof window.okoReels.open === 'function'){
        close();
        try{ if(typeof showTab === 'function') showTab('feed'); }catch(e){}
        try{ window.okoReels.open(r.feedId); }catch(e){}
      }else{
        T('Ролик ещё не попал в плеер — обнови ленту');
      }
      break;
    }

    case 'permwrite': if(ent.ch){ ent.ch.perms = ent.ch.perms || {}; ent.ch.perms.write = v; ent.ch.whoPost = (v === 'all' ? 'subs' : 'admins'); chSaveSafe(); render(); } break;
    case 'permcall':  if(ent.ch){ ent.ch.perms = ent.ch.perms || {}; ent.ch.perms.call = v; chSaveSafe(); render(); } break;
    case 'permpub':   if(ent.ch){ ent.ch.perms = ent.ch.perms || {}; ent.ch.perms.publish = v; chSaveSafe(); render(); } break;

    case 'topicadd': {
      if(!ent.ch) return;
      var inp = document.getElementById('socTopicName');
      var title = inp ? String(inp.value || '').trim() : '';
      if(!title){ T('Введи название темы'); return; }
      ent.ch.topics = ent.ch.topics || [];
      ent.ch.topics.push({ id: 't' + Date.now().toString(36), title: title });
      chSaveSafe(); render(); T('Тема добавлена');
      break;
    }
    case 'topicdel':
      if(!ent.ch) return;
      ent.ch.topics = (ent.ch.topics || []).filter(function(x){ return x.id !== v; });
      chSaveSafe(); render();
      break;

    case 'inviteadd': {
      if(!ent.ch) return;
      var code = Math.random().toString(36).slice(2, 10);
      ent.ch.invites = Array.isArray(ent.ch.invites) ? ent.ch.invites : [];
      ent.ch.invites.unshift({ code: code, link: 'https://okoteam.top/join/' + code, created: Date.now(), uses: 0 });
      chSaveSafe(); render();
      T('Ссылка-приглашение создана');
      break;
    }
    case 'invitecopy': {
      if(!ent.ch) return;
      var iv = (ent.ch.invites || []).filter(function(x){ return x.code === v; })[0];
      if(iv) copyText(iv.link, 'Приглашение скопировано');
      break;
    }
    case 'invitedel':
      if(!ent.ch) return;
      ent.ch.invites = (ent.ch.invites || []).filter(function(x){ return x.code !== v; });
      chSaveSafe(); render();
      break;

    case 'role': {
      if(!ent.ch) return;
      ent.ch.roles = ent.ch.roles || {};
      var cur = ent.ch.roles[v] || 'member';
      var ix = ROLE_ORDER.indexOf(cur);
      ent.ch.roles[v] = ROLE_ORDER[(ix + 1) % ROLE_ORDER.length];
      chSaveSafe(); render();
      break;
    }

    case 'chadvanced':
      if(ent.ch && typeof chOpen === 'function'){
        close();
        try{ chOpen('channel', ent.ch.id); }catch(e){}
        setTimeout(function(){ try{ if(typeof chGo === 'function') chGo('manage', ent.ch.id); }catch(e){} }, 40);
      }
      break;
  }
}

function openMessage(ent){
  /* канал/клуб с привязанным обсуждением — идём в него */
  var target = null;
  if(ent.chat) target = ent.chat;
  if(ent.ch){
    try{
      if(typeof CHATS !== 'undefined' && CHATS){
        for(var i = 0; i < CHATS.length; i++) if(CHATS[i].chId === ent.ch.id){ target = CHATS[i]; break; }
      }
    }catch(e){}
  }
  if(!target && ent.type === 'user' && typeof CHATS !== 'undefined' && CHATS){
    for(var j = 0; j < CHATS.length; j++){
      if(CHATS[j].kind === 'direct' && nickOf(CHATS[j]) === ent.nick){ target = CHATS[j]; break; }
    }
    if(!target){
      target = {
        id: 'dm_' + ent.nick + '_' + Date.now(), dmNick: ent.nick, name: ent.name, kind: 'direct',
        ava: ent.avaLetter, avaImg: ent.avatarImg || null, nick: ent.nick, kindIcon: null, writeAll: true,
        preview: 'Личный чат', time: (typeof nowT === 'function' ? nowT() : ''), unread: 0, online: false,
        msgs: [{ kind: 'sys', body: 'Личный чат с ' + ent.name + ' создан' }]
      };
      CHATS.unshift(target);
    }
  }
  if(!target){ T('Некуда писать: у сущности нет привязанного чата'); return; }
  close();
  try{ if(typeof showTab === 'function') showTab('chats'); }catch(e){}
  try{ if(typeof renderChatList === 'function') renderChatList(); }catch(e){}
  try{ if(typeof openConv === 'function') openConv(target.id); }catch(e){}
}

function shareEntity(ent){
  var url = linkOf(ent);
  var data = { title: ent.name, text: ent.name + ' в OKO', url: url };
  try{
    if(navigator.share){
      navigator.share(data).then(function(){}, function(){ copyText(url, 'Ссылка скопирована'); });
      return;
    }
  }catch(e){}
  copyText(url, 'Ссылка скопирована — можно вставить куда угодно');
}

/* делегирование внутри вьюхи */
function bindRoot(){
  ROOT.addEventListener('click', function(e){
    var b = e.target.closest ? e.target.closest('[data-a]') : null;
    if(b && ROOT.contains(b)){
      e.preventDefault(); e.stopPropagation();
      H('select');
      act(b.getAttribute('data-a'), b.getAttribute('data-v'), b);
      return;
    }
    var bk = e.target.closest ? e.target.closest('#okoSocBack') : null;
    if(bk){ e.preventDefault(); e.stopPropagation(); H('select'); back(); }
  });
}

/* ==========================================================================
   12. ТОЧКИ ВХОДА
   ========================================================================== */

/* --- шапка диалога: тап по аватару/имени --- */
(function hookOpenProfile(){
  var prev = window.openProfile;
  window.openProfile = function(){
    try{
      var c = (typeof currentChat !== 'undefined') ? currentChat : null;
      if(c){
        var k = keyOfChat(c);
        if(k && open(k)) return;
      }
    }catch(e){}
    if(typeof prev === 'function') return prev.apply(this, arguments);
  };
})();

/* --- публичный профиль автора (лента, посты, упоминания) --- */
(function hookPsProfile(){
  var prev = window.psOpenProfile;
  window.psOpenProfile = function(name){
    try{
      var k = keyOfName(name);
      if(k && open(k)) return;
    }catch(e){}
    if(typeof prev === 'function') return prev.apply(this, arguments);
  };
})();

/* --- лента: перерисовка подхватывает обложки соц-роликов --- */
(function hookFeed(){
  var prev = window.renderFeed;
  if(typeof prev !== 'function') return;
  window.renderFeed = function(){
    var r = prev.apply(this, arguments);
    try{ decorateFeed(); }catch(e){}
    return r;
  };
})();

/* --- список чатов: тап по круглому аватару открывает страницу сущности --- */
document.addEventListener('click', function(e){
  var t = e.target;
  if(!t || !t.closest) return;

  var av = t.closest('#chatList .ci-ava');
  if(av){
    var item = av.closest('.chat-item');
    if(item){
      var oc = item.getAttribute('onclick') || '';
      var m = oc.match(/openConv\(\s*(?:'([^']*)'|"([^"]*)"|([^)]*))\s*\)/);
      var raw = m ? (m[1] != null ? m[1] : m[2] != null ? m[2] : m[3]) : null;
      if(raw != null){
        var id = /^-?\d+$/.test(String(raw).trim()) ? +raw : String(raw).trim();
        var chat = chatRec(id);
        var k = chat ? keyOfChat(chat) : null;
        if(k && entity(k)){
          e.preventDefault(); e.stopPropagation();
          if(e.stopImmediatePropagation) e.stopImmediatePropagation();
          open(k);
          return;
        }
      }
    }
  }

  /* --- лента: аватар/имя автора --- */
  var head = t.closest('#feedList .post .head .ava, #feedList .post .head .name');
  if(head){
    var art = head.closest('article.post');
    var pid = art && art.getAttribute('data-pid');
    var p = null;
    try{ if(pid != null && typeof postById === 'function') p = postById(+pid); }catch(err){}
    var key = null;
    if(p && p.socKey) key = p.socKey;
    else if(p && p.chOrigin) key = 'c:' + p.chOrigin;
    else if(p && p.name) key = keyOfName(p.name);
    if(key && entity(key)){
      e.preventDefault(); e.stopPropagation();
      if(e.stopImmediatePropagation) e.stopImmediatePropagation();
      open(key);
    }
  }
}, true);

/* --- профиль: кнопки «Моя страница» и «Создать» --- */
function injectProfileCta(){
  try{
    var sc = document.getElementById('screen-profile');
    if(!sc || sc.querySelector('.soc-profile-cta')) return;
    var anchor = sc.querySelector('#profAch') || sc.querySelector('#profStats');
    if(!anchor) return;
    var wrap = document.createElement('div');
    wrap.className = 'soc-profile-cta';
    wrap.innerHTML =
      '<button class="soc-btn" id="socMyPage" type="button">' + SI('user') + 'Моя страница</button>' +
      '<button class="soc-btn ghost" id="socNewEntity" type="button">' + SI('plus') + 'Создать</button>';
    anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
    wrap.querySelector('#socMyPage').addEventListener('click', function(){ open('u:' + nickOf(P())); });
    wrap.querySelector('#socNewEntity').addEventListener('click', function(){
      CRE = { kind: 'channel', name: '', desc: '', access: 'open', price: 0, avatar: null };
      open('u:' + nickOf(P()), 'create');
    });
  }catch(e){}
}

/* ==========================================================================
   13. СТАРТ
   ========================================================================== */
function boot(){
  injectCss();
  ensureDom();
  injectProfileCta();
  decorateFeed();
  /* профиль отрисовывается лениво — дожидаемся его появления */
  try{
    var sc = document.getElementById('screen-profile');
    if(sc) new MutationObserver(function(){ injectProfileCta(); }).observe(sc, { childList: true, subtree: true });
  }catch(e){}
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

/* ==========================================================================
   14. ПУБЛИЧНОЕ API
   ========================================================================== */
window.okoSocial = {
  open: open,
  close: close,
  back: back,
  isOpen: isOpen,
  entity: entity,
  keyOfChat: keyOfChat,
  keyOfName: keyOfName,
  create: function(kind){
    CRE = { kind: kind || 'channel', name: '', desc: '', access: 'open', price: 0, avatar: null };
    return open('u:' + nickOf(P()), 'create');
  },
  counts: function(key){
    var e2 = entity(key); if(!e2) return null;
    return { subs: subsCount(e2), posts: postsOf(e2).length, reels: reelsOf(e2).length, owned: e2.owned, verified: verified(e2) };
  },
  state: SOC
};

try{ console.log('[oko-social] готов'); }catch(e){}
})();
