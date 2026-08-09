/* ============================================================================
   OKO WALLET v2 — кошелёк и оплата «готово к запуску»
   ----------------------------------------------------------------------------
   Слой поверх ядра (index.html + app.js). Ядро не переписывается: здесь только
   перехваты глобальных функций кошелька, новые подстраницы и один <style>.

   Что делает файл:
     1. ЧЕСТНОСТЬ ДЕНЕГ. Убраны все выдуманные суммы, реквизиты и подтверждения:
        • фальшивые номер карты / TON- и USDT-адреса больше не показываются —
          на них человек мог реально отправить деньги в никуда;
        • пополнение больше НЕ дорисовывает баланс локально: счёт создаётся
          на Lava.top через api.php, без ссылки — честное «оплата подключается»;
        • обмен валют по выдуманному курсу (95 ₽ за USDT, 380 ₽ за TON) больше
          не проводится: курса нет — значит калькулятор с честной пометкой;
        • вывод не рисует фальшивый статус «Зачислено» по таймеру;
        • «TON-кошелёк подключён» без TON Connect — убрано;
        • плановые списания (3 000 ₽ 5 октября и т.п.) — выдумка, удалены.
     2. ОПЛАТА LAVA.TOP. Отдельная страница тарифов: что входит, чем отличаются,
        как отменить. Кнопка ведёт на реальную ссылку из конфига VPS
        (api.php?action=pay_url / wallet_topup). Нет ссылки — честный текст,
        никаких «Оплачено».
     3. БАНКОВСКИЕ ФУНКЦИИ. Поиск и фильтры истории (тип, период, категория),
        экспорт выписки за период (CSV и текст), повтор операции, шаблоны
        переводов, детальная карточка операции со статусом и чеком.
     4. ВЁРСТКА. Заголовки подстраниц в две строки без многоточий, единая
        кнопка «назад» на всех подстраницах и шторках, безопасные зоны только
        через var(--oko-safe-*), обе темы.
     5. НАСТОЯЩИЙ QR. Вместо декоративного «QR-подобного» узора — рабочий
        QR-код (byte mode, уровень M, версии 1–10), который реально
        открывает перевод на счёт в приложении.

   Всё, что нельзя подтвердить кодом, подписано словами «подключается», а не
   изображается работающим.
   ============================================================================ */
(function okoWallet2(){
'use strict';

if (window.__okoWallet2) return;
window.__okoWallet2 = true;

var D = document;
function $(id){ return D.getElementById(id); }
function has(name){ return typeof window[name] === 'function'; }
function ic(n, cls){ return (typeof I === 'function') ? I(n, cls || '') : ''; }
function esc2(s){
  if (typeof esc === 'function') return esc(s == null ? '' : String(s));
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}
function money(n){
  if (typeof fmtMoney === 'function') return fmtMoney(n);
  return Math.round(Number(n) || 0).toLocaleString('ru-RU').replace(/,/g, ' ') + ' ₽';
}
function say(t){ if (has('toast')) toast(t); }
function pop(o){ if (has('showPopup')) showPopup(o); else say(o && o.title || ''); }

/* ---------------------------------------------------------------------------
   0. ВОЗМОЖНОСТИ. Что реально подключено, а что — только на словах.
   Файл никогда не изображает работающим то, чего нет на бэкенде.
   --------------------------------------------------------------------------- */
var CAP = {
  /* api.php умеет: wallet_balance, wallet_transfer, wallet_history,
     wallet_topup (счёт Lava.top), pay_url (готовые продукты Lava). */
  payIn:     true,     /* пополнение и оплата тарифа — через Lava.top */
  transfers: true,     /* P2P внутри OKO — реальный wallet_transfer */
  payouts:   false,    /* вывода на карту на бэкенде нет */
  exchange:  false,    /* курсов и обменника нет */
  ton:       false     /* TON Connect не подключён */
};
window.okoWalletCaps = CAP;

function apiBase(){
  try { if (typeof OKO_API !== 'undefined' && OKO_API) return OKO_API; } catch(e){}
  return 'https://okoteam.top/api.php';
}
function myEmail(){
  try {
    if (has('w2WalletOwnerEmail')) return window.w2WalletOwnerEmail() || '';
    if (typeof PROFILE !== 'undefined') return String(PROFILE.email || '').trim().toLowerCase();
  } catch(e){}
  return '';
}
function myNick(){
  try { return (typeof PROFILE !== 'undefined' && PROFILE.nick) ? String(PROFILE.nick) : ''; } catch(e){ return ''; }
}
function acc(){
  try { return (typeof WALLET !== 'undefined' && WALLET.acc) ? String(WALLET.acc) : ''; } catch(e){ return ''; }
}
function ledger(){
  try { return (typeof WALLET !== 'undefined' && Array.isArray(WALLET.ledger)) ? WALLET.ledger : []; } catch(e){ return []; }
}
function balance(){
  try { return (typeof WALLET !== 'undefined') ? (Number(WALLET.balance) || 0) : 0; } catch(e){ return 0; }
}

/* ===========================================================================
   1. СТИЛИ. Один <style>, обе темы, без env() напрямую.
   =========================================================================== */
var CSS = [
/* --- заголовок подстраницы: две строки, кегль подстраивается, без «…» --- */
'.w2-page .w2-bar-t{',
'  white-space:normal !important; text-overflow:clip !important;',
'  font-size:clamp(15px,4.4vw,20px); line-height:1.14; text-align:center;',
'  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;',
'  overflow:hidden; word-break:normal; overflow-wrap:break-word; hyphens:none;',
'  min-width:0; padding:0 2px;',
'}',
'.w2-page .w2-bar{ gap:8px; align-items:flex-start; }',
'.w2-page .w2-bar .w2-bar-nav,.w2-page .w2-bar .w2-bar-sp{ margin-top:1px; }',
'.w2-page .w2-body{ padding-left:max(var(--oko-safe-left),14px); padding-right:max(var(--oko-safe-right),14px); }',
'.w2-page .w2-body{ padding-bottom:calc(28px + var(--oko-safe-bottom)); }',

/* --- шапка внутри шторки: та же кнопка «назад», что и на подстраницах --- */
'.w2-sh{ display:flex; align-items:center; gap:9px; margin:-2px -4px 10px; min-height:38px; }',
'.w2-sh-t{ flex:1 1 auto; min-width:0; font-family:var(--font-display); letter-spacing:.05em;',
'  font-size:clamp(15px,4.3vw,19px); line-height:1.15; color:var(--text);',
'  white-space:normal; overflow-wrap:break-word; hyphens:none; }',
'.w2-sh-x{ width:38px;height:38px;border-radius:50%;background:var(--surface);border:1px solid var(--border);',
'  display:flex;align-items:center;justify-content:center;color:var(--text);flex:0 0 auto;cursor:pointer }',
'.w2-sh-x svg.i{ width:16px;height:16px }',
'.w2-sh-x:active{ transform:scale(.92) }',

/* --- честные плашки --- */
'.w2-note{ display:flex; gap:10px; align-items:flex-start; border-radius:14px; padding:12px 13px;',
'  background:var(--raised); border:1px solid var(--border); font-size:12.8px; line-height:1.55;',
'  color:var(--text); margin:10px 0; overflow-wrap:break-word; hyphens:none }',
'.w2-note b{ color:var(--text) }',
'.w2-note span{ min-width:0 }',
'.w2-note .w2-note-ic{ flex:0 0 auto; width:30px; height:30px; border-radius:9px; display:flex;',
'  align-items:center; justify-content:center; background:var(--lime-dim); color:var(--accent) }',
'.w2-note .w2-note-ic svg.i{ width:15px; height:15px }',
'.w2-note.warn .w2-note-ic{ background:rgba(255,184,74,.16); color:#FFB84A }',
'.w2-note.warn{ border-color:rgba(255,184,74,.32) }',
':root[data-theme="light"] .w2-note{ background:#f4f7ee }',

/* --- пустые состояния --- */
'.w2-blank{ text-align:center; padding:26px 16px 22px; border-radius:18px; background:var(--surface);',
'  border:1px solid var(--border) }',
'.w2-blank-ic{ width:54px;height:54px;border-radius:50%;background:var(--lime-dim);color:var(--accent);',
'  display:flex;align-items:center;justify-content:center;margin:0 auto 12px }',
'.w2-blank-ic svg.i{ width:24px;height:24px }',
'.w2-blank b{ display:block; font-size:16px; margin-bottom:6px; color:var(--text) }',
'.w2-blank p{ font-size:13px; line-height:1.6; color:var(--dim); margin:0 auto; max-width:34em;',
'  overflow-wrap:break-word; hyphens:none }',
'.w2-blank .btn{ margin-top:14px }',

/* --- строки меню, списков, чипы --- */
'.w2-rows{ display:flex; flex-direction:column; gap:8px; margin:8px 0 4px }',
'.w2-row{ display:flex; align-items:center; gap:11px; width:100%; text-align:left; padding:12px 13px;',
'  border-radius:14px; background:var(--surface); border:1px solid var(--border); color:var(--text); cursor:pointer }',
'.w2-row:active{ transform:scale(.995) }',
'.w2-row-ic{ flex:0 0 auto; width:36px;height:36px;border-radius:11px; background:var(--raised);',
'  color:var(--accent); display:flex;align-items:center;justify-content:center }',
'.w2-row-ic svg.i{ width:17px;height:17px }',
'.w2-row-b{ flex:1 1 auto; min-width:0 }',
'.w2-row-b b{ display:block; font-size:14px; line-height:1.3; overflow-wrap:break-word; hyphens:none }',
'.w2-row-b em{ display:block; font-style:normal; font-size:12px; line-height:1.45; color:var(--dim);',
'  margin-top:2px; overflow-wrap:break-word; hyphens:none }',
'.w2-row-ch{ flex:0 0 auto; width:14px;height:14px; color:var(--dim) }',

/* --- тарифы --- */
'.w2-tar{ display:flex; flex-direction:column; gap:10px; margin-top:8px }',
'.w2-tar-c{ border-radius:18px; background:var(--surface); border:1px solid var(--border); padding:14px 14px 13px;',
'  position:relative; overflow:hidden }',
'.w2-tar-c.on{ border-color:var(--accent); box-shadow:0 0 0 1px var(--accent) inset }',
'.w2-tar-h{ display:flex; align-items:baseline; gap:10px; flex-wrap:wrap }',
'.w2-tar-n{ font-family:var(--font-display); font-size:24px; letter-spacing:.05em; color:var(--text); line-height:1 }',
'.w2-tar-p{ margin-left:auto; font-size:15px; font-weight:800; color:var(--accent); white-space:nowrap }',
'.w2-tar-p small{ font-weight:600; font-size:11px; color:var(--dim) }',
'.w2-tar-for{ font-size:12.5px; color:var(--dim); margin:6px 0 9px; line-height:1.5;',
'  overflow-wrap:break-word; hyphens:none }',
'.w2-tar-f{ list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:6px }',
'.w2-tar-f li{ display:flex; gap:8px; font-size:12.8px; line-height:1.5; color:var(--text);',
'  overflow-wrap:break-word; hyphens:none }',
'.w2-tar-f li svg.i{ flex:0 0 auto; width:13px; height:13px; margin-top:3px; color:var(--accent) }',
'.w2-tar-cta{ margin-top:12px }',
'.w2-tar-cur{ display:inline-flex; align-items:center; gap:6px; font-size:11px; font-weight:700;',
'  letter-spacing:.06em; text-transform:uppercase; color:var(--accent); background:var(--lime-dim);',
'  border-radius:999px; padding:4px 10px }',

/* --- периоды оплаты --- */
'.w2-per{ display:flex; gap:7px; flex-wrap:wrap; margin:10px 0 4px }',
'.w2-per button{ flex:1 1 68px; min-width:68px; padding:9px 6px; border-radius:12px; background:var(--surface);',
'  border:1px solid var(--border); color:var(--text); font-size:12.5px; font-weight:700; cursor:pointer;',
'  display:flex; flex-direction:column; align-items:center; gap:2px }',
'.w2-per button.on{ border-color:var(--accent); color:var(--accent); background:var(--lime-dim) }',
'.w2-per button i{ font-style:normal; font-size:10.5px; color:var(--dim) }',
'.w2-per button.on i{ color:var(--accent) }',

/* --- история: фильтры и итоги --- */
'.w2-hist-sum{ display:flex; gap:8px; margin:2px 0 10px }',
'.w2-hist-sum div{ flex:1 1 0; min-width:0; background:var(--surface); border:1px solid var(--border);',
'  border-radius:13px; padding:9px 10px }',
'.w2-hist-sum span{ display:block; font-size:11px; color:var(--dim); line-height:1.3 }',
'.w2-hist-sum b{ display:block; font-size:14px; margin-top:3px; white-space:nowrap;',
'  overflow:hidden; text-overflow:ellipsis }',
'.w2-hist-sum b.in{ color:var(--accent) }',
'.w2-hist-sum b.out{ color:var(--danger) }',
'.w2-chips{ display:flex; gap:6px; overflow-x:auto; -webkit-overflow-scrolling:touch; padding:2px 0 8px;',
'  scrollbar-width:none }',
'.w2-chips::-webkit-scrollbar{ display:none }',
'.w2-chips button{ flex:0 0 auto; padding:7px 12px; border-radius:999px; background:var(--surface);',
'  border:1px solid var(--border); color:var(--dim); font-size:12px; font-weight:600; cursor:pointer; white-space:nowrap }',
'.w2-chips button.on{ background:var(--lime-dim); border-color:var(--accent); color:var(--accent) }',

/* --- карточка операции и чек --- */
'.w2-tx-head{ text-align:center; padding:6px 0 14px }',
'.w2-tx-ic{ width:60px;height:60px;border-radius:50%; margin:0 auto 12px; display:flex; align-items:center;',
'  justify-content:center; background:var(--raised); color:var(--text) }',
'.w2-tx-ic.in{ background:var(--lime-dim); color:var(--accent) }',
'.w2-tx-ic.out{ background:rgba(255,77,77,.14); color:var(--danger) }',
'.w2-tx-ic svg.i{ width:26px;height:26px }',
'.w2-tx-amt{ font-family:var(--font-display); font-size:34px; letter-spacing:.02em; line-height:1 }',
'.w2-tx-amt.in{ color:var(--accent) }',
'.w2-tx-why{ font-size:13.5px; margin-top:8px; color:var(--text); line-height:1.5;',
'  overflow-wrap:break-word; hyphens:none }',
'.w2-tx-st{ display:inline-flex; align-items:center; gap:6px; margin-top:10px; font-size:12px; font-weight:700;',
'  border-radius:999px; padding:5px 11px; background:var(--lime-dim); color:var(--accent) }',
'.w2-tx-st.proc{ background:rgba(255,184,74,.16); color:#FFB84A }',
'.w2-tx-st svg.i{ width:12px;height:12px }',
'.w2-kv{ background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:4px 13px }',
'.w2-kv-r{ display:flex; gap:12px; align-items:flex-start; padding:11px 0; border-bottom:1px solid var(--border) }',
'.w2-kv-r:last-child{ border-bottom:0 }',
'.w2-kv-r span{ flex:0 0 auto; max-width:48%; font-size:12.5px; color:var(--dim); line-height:1.45 }',
'.w2-kv-r b{ flex:1 1 auto; min-width:0; text-align:right; font-size:12.8px; line-height:1.45; font-weight:700;',
'  overflow-wrap:break-word; hyphens:none }',
'.w2-kv-r b.mono{ font-variant-numeric:tabular-nums }',
'.w2-acts{ display:flex; gap:8px; flex-wrap:wrap; margin-top:14px }',
'.w2-acts button{ flex:1 1 46%; min-width:132px; padding:12px 10px; border-radius:14px; font-size:13px;',
'  font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:7px;',
'  border:1px solid var(--border); background:var(--surface); color:var(--text) }',
'.w2-acts button.prim{ background:var(--accent); color:#000; border-color:var(--accent) }',
'.w2-acts button svg.i{ width:15px;height:15px }',

/* --- чек --- */
'.w2-receipt{ background:#fff; color:#111; border-radius:16px; padding:20px 18px; font-size:12.5px;',
'  line-height:1.6; box-shadow:0 8px 26px rgba(0,0,0,.28) }',
'.w2-receipt h4{ font-family:var(--font-display); font-size:22px; letter-spacing:.05em; margin:0 0 4px; color:#111 }',
'.w2-receipt .w2-rc-sub{ color:#666; font-size:11.5px; margin-bottom:14px }',
'.w2-receipt .w2-rc-amt{ font-family:var(--font-display); font-size:32px; margin:10px 0 4px; color:#111 }',
'.w2-receipt .w2-rc-r{ display:flex; gap:10px; justify-content:space-between; padding:7px 0;',
'  border-bottom:1px dashed #ddd }',
'.w2-receipt .w2-rc-r:last-of-type{ border-bottom:0 }',
'.w2-receipt .w2-rc-r span{ color:#666; flex:0 0 auto; max-width:46% }',
'.w2-receipt .w2-rc-r b{ text-align:right; min-width:0; overflow-wrap:break-word; hyphens:none }',
'.w2-receipt .w2-rc-foot{ margin-top:14px; display:flex; align-items:flex-end; justify-content:space-between; gap:12px }',
'.w2-receipt .w2-rc-note{ font-size:10.5px; color:#888; margin-top:10px; line-height:1.5 }',

/* --- шаблоны переводов --- */
'.w2-tpl{ display:flex; flex-direction:column; gap:8px }',
'.w2-tpl-r{ display:flex; align-items:center; gap:11px; padding:11px 12px; border-radius:14px;',
'  background:var(--surface); border:1px solid var(--border) }',
'.w2-tpl-av{ flex:0 0 auto; width:38px;height:38px;border-radius:50%; background:var(--lime-dim);',
'  color:var(--accent); display:flex;align-items:center;justify-content:center; font-weight:800; font-size:15px }',
'.w2-tpl-b{ flex:1 1 auto; min-width:0 }',
'.w2-tpl-b b{ display:block; font-size:13.5px; overflow-wrap:break-word; hyphens:none }',
'.w2-tpl-b span{ display:block; font-size:11.5px; color:var(--dim); margin-top:2px;',
'  overflow-wrap:break-word; hyphens:none }',
'.w2-tpl-x{ flex:0 0 auto; width:34px;height:34px;border-radius:10px; background:var(--raised);',
'  border:1px solid var(--border); color:var(--dim); display:flex;align-items:center;justify-content:center; cursor:pointer }',
'.w2-tpl-x svg.i{ width:14px;height:14px }',
'.w2-tpl-x.go{ color:var(--accent) }',

/* --- QR-приём --- */
'.w2-qr-card{ background:var(--surface); border:1px solid var(--border); border-radius:20px; padding:18px 16px;',
'  text-align:center }',
'.w2-qr-box{ width:min(260px,72vw); margin:0 auto; background:#fff; border-radius:16px; padding:12px;',
'  box-shadow:0 6px 22px rgba(0,0,0,.22) }',
'.w2-qr-box svg{ display:block; width:100%; height:auto }',
'.w2-qr-sum{ font-family:var(--font-display); font-size:26px; letter-spacing:.03em; margin:14px 0 2px; color:var(--text) }',
'.w2-qr-sub{ font-size:12px; color:var(--dim); line-height:1.5; overflow-wrap:break-word; hyphens:none }',
'.w2-qr-inp{ display:flex; gap:8px; margin:14px 0 10px; flex-wrap:wrap }',
'.w2-qr-inp input{ flex:1 1 120px; min-width:0; padding:11px 12px; border-radius:12px; background:var(--raised);',
'  border:1px solid var(--border); color:var(--text); font-size:13.5px; font-family:inherit }',
'.w2-qr-link{ display:flex; align-items:center; gap:8px; width:100%; padding:10px 12px; border-radius:12px;',
'  background:var(--raised); border:1px solid var(--border); color:var(--dim); font-size:11.5px; cursor:pointer;',
'  text-align:left }',
'.w2-qr-link span{ flex:1 1 auto; min-width:0; overflow-wrap:anywhere }',
'.w2-qr-link svg.i{ flex:0 0 auto; width:14px;height:14px }',

/* --- суммовые чипы и поля форм --- */
'.w2-amt{ width:100%; padding:14px 14px; border-radius:14px; background:var(--raised); border:1px solid var(--border);',
'  color:var(--text); font-size:19px; font-weight:800; font-family:inherit; margin:8px 0 4px }',
'.w2-amt:focus{ outline:none; border-color:var(--accent) }',
'.w2-qs{ display:flex; gap:7px; flex-wrap:wrap; margin:8px 0 2px }',
'.w2-qs button{ flex:1 1 62px; min-width:62px; padding:9px 4px; border-radius:11px; background:var(--surface);',
'  border:1px solid var(--border); color:var(--text); font-size:13px; font-weight:700; cursor:pointer }',
'.w2-qs button.on{ border-color:var(--accent); color:var(--accent); background:var(--lime-dim) }',
'.w2-lbl{ display:block; font-size:12px; font-weight:700; color:var(--dim); letter-spacing:.05em;',
'  text-transform:uppercase; margin:14px 0 2px }',
'.w2-fld{ width:100%; padding:12px 13px; border-radius:13px; background:var(--raised); border:1px solid var(--border);',
'  color:var(--text); font-size:14px; font-family:inherit }',
'.w2-fld:focus{ outline:none; border-color:var(--accent) }',
'.w2-calc{ background:var(--surface); border:1px solid var(--border); border-radius:15px; padding:4px 13px; margin:12px 0 }',
'.w2-calc-r{ display:flex; justify-content:space-between; gap:12px; padding:9px 0; font-size:13px;',
'  border-bottom:1px solid var(--border) }',
'.w2-calc-r:last-child{ border-bottom:0 }',
'.w2-calc-r span{ color:var(--dim) }',
'.w2-calc-r.total b{ color:var(--accent); font-size:15px }',

/* --- лимиты --- */
'.w2-lim{ background:var(--surface); border:1px solid var(--border); border-radius:16px; overflow:hidden }',
'.w2-lim-r{ display:flex; gap:12px; align-items:baseline; padding:11px 13px; border-bottom:1px solid var(--border) }',
'.w2-lim-r:last-child{ border-bottom:0 }',
'.w2-lim-r.on{ background:var(--lime-dim) }',
'.w2-lim-r i{ font-style:normal; flex:0 0 auto; font-weight:800; font-size:13px; letter-spacing:.04em }',
'.w2-lim-r.on i{ color:var(--accent) }',
'.w2-lim-r b{ margin-left:auto; font-size:13px; white-space:nowrap }',
'.w2-lim-r span{ font-size:11.5px; color:var(--dim) }',

/* --- прочее --- */
'.w2-h{ font-size:12px; font-weight:800; letter-spacing:.08em; text-transform:uppercase; color:var(--dim);',
'  margin:18px 0 8px }',
'.w2-h:first-child{ margin-top:4px }',
'.w2-fine{ font-size:11.5px; color:var(--dim); line-height:1.6; margin:12px 0 4px;',
'  overflow-wrap:break-word; hyphens:none }',
'.w2-page .btn{ width:100% }',
/* нижняя страховка: контент главного экрана кошелька не уходит под меню */
'#screen-wallet > .pad{ padding-bottom:calc(96px + var(--oko-safe-bottom)) }'
].join('\n');

(function injectCss(){
  try {
    var st = D.createElement('style');
    st.id = 'oko-wallet2-css';
    st.textContent = CSS;
    (D.head || D.documentElement).appendChild(st);
  } catch(e){}
})();

/* ===========================================================================
   2. НАСТОЯЩИЙ QR-КОД (byte mode, уровень коррекции M, версии 1–10).
   Декоративный «QR-подобный» узор из ядра не сканировался ничем — человек
   показывал картинку, а платёж не проходил. Это тоже ложное подтверждение.
   =========================================================================== */
var QR = (function(){
  var EXP = new Array(512), LOG = new Array(256);
  (function(){
    var x = 1;
    for (var i = 0; i < 255; i++){ EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();
  function gmul(a, b){ return (!a || !b) ? 0 : EXP[LOG[a] + LOG[b]]; }
  function gen(deg){
    var poly = [1];
    for (var i = 0; i < deg; i++){
      var np = new Array(poly.length + 1);
      for (var z = 0; z < np.length; z++) np[z] = 0;
      for (var j = 0; j < poly.length; j++){
        np[j] ^= poly[j];
        np[j + 1] ^= gmul(poly[j], EXP[i]);
      }
      poly = np;
    }
    return poly;
  }
  function ecc(data, len){
    var g = gen(len), res = [];
    for (var z = 0; z < len; z++) res.push(0);
    for (var i = 0; i < data.length; i++){
      var f = data[i] ^ res[0];
      res.shift(); res.push(0);
      if (f) for (var j = 0; j < len; j++) res[j] ^= gmul(g[j + 1], f);
    }
    return res;
  }
  /* уровень M: [данные-кодовые слова, EC/блок, блоков-1, данных-1, блоков-2, данных-2] */
  var VER = [
    [16, 10, 1, 16, 0, 0], [28, 16, 1, 28, 0, 0], [44, 26, 1, 44, 0, 0],
    [64, 18, 2, 32, 0, 0], [86, 24, 2, 43, 0, 0], [108, 16, 4, 27, 0, 0],
    [124, 18, 4, 31, 0, 0], [154, 22, 2, 38, 2, 39], [182, 22, 3, 36, 2, 37],
    [216, 26, 4, 43, 1, 44]
  ];
  var ALIGN = [[], [6,18], [6,22], [6,26], [6,30], [6,34], [6,22,38], [6,24,42], [6,26,46], [6,28,50]];
  var VBITS = {7:0x07C94, 8:0x085BC, 9:0x09A99, 10:0x0A4D3};

  function utf8(s){
    var out = [], str = unescape(encodeURIComponent(String(s)));
    for (var i = 0; i < str.length; i++) out.push(str.charCodeAt(i) & 0xff);
    return out;
  }
  function fmtBits(mask){
    var d = (0 << 3) | mask;              /* уровень M = 00 */
    var v = d << 10;
    for (var i = 4; i >= 0; i--) if (v & (1 << (i + 10))) v ^= 0x537 << i;
    return ((d << 10) | v) ^ 0x5412;
  }
  function maskAt(m, r, c){
    switch (m){
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return ((r * c) % 2 + (r * c) % 3) === 0;
      case 6: return (((r * c) % 2 + (r * c) % 3) % 2) === 0;
      default: return (((r + c) % 2 + (r * c) % 3) % 2) === 0;
    }
  }
  function penalty(m, size){
    var p = 0, i, j, run, dark = 0;
    for (i = 0; i < size; i++){
      run = 1;
      for (j = 1; j < size; j++){
        if (m[i][j] === m[i][j - 1]) run++;
        else { if (run >= 5) p += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) p += 3 + (run - 5);
      run = 1;
      for (j = 1; j < size; j++){
        if (m[j][i] === m[j - 1][i]) run++;
        else { if (run >= 5) p += 3 + (run - 5); run = 1; }
      }
      if (run >= 5) p += 3 + (run - 5);
    }
    for (i = 0; i < size - 1; i++)
      for (j = 0; j < size - 1; j++)
        if (m[i][j] === m[i][j+1] && m[i][j] === m[i+1][j] && m[i][j] === m[i+1][j+1]) p += 3;
    var pat1 = [1,0,1,1,1,0,1,0,0,0,0], pat2 = [0,0,0,0,1,0,1,1,1,0,1];
    function look(get){
      var k, q, ok1, ok2;
      for (k = 0; k <= size - 11; k++){
        ok1 = ok2 = true;
        for (q = 0; q < 11; q++){
          if (get(k + q) !== pat1[q]) ok1 = false;
          if (get(k + q) !== pat2[q]) ok2 = false;
        }
        if (ok1) p += 40;
        if (ok2) p += 40;
      }
    }
    for (i = 0; i < size; i++){
      (function(row){ look(function(x){ return m[row][x]; }); })(i);
      (function(col){ look(function(x){ return m[x][col]; }); })(i);
    }
    for (i = 0; i < size; i++) for (j = 0; j < size; j++) if (m[i][j]) dark++;
    p += Math.floor(Math.abs(dark * 100 / (size * size) - 50) / 5) * 10;
    return p;
  }

  return function build(text){
    var bytes = utf8(text), ver = 0, cci = 8, i, j, k;
    for (var v = 1; v <= 10; v++){
      var c = v < 10 ? 8 : 16;
      if (4 + c + bytes.length * 8 <= VER[v - 1][0] * 8){ ver = v; cci = c; break; }
    }
    if (!ver) return null;
    var spec = VER[ver - 1], capCw = spec[0], ecLen = spec[1];
    var bits = [];
    function put(val, len){ for (var b = len - 1; b >= 0; b--) bits.push((val >> b) & 1); }
    put(4, 4); put(bytes.length, cci);
    for (i = 0; i < bytes.length; i++) put(bytes[i], 8);
    var term = Math.min(4, capCw * 8 - bits.length);
    for (i = 0; i < term; i++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    var dcw = [];
    for (i = 0; i < bits.length; i += 8){
      var byte = 0;
      for (j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
      dcw.push(byte);
    }
    var pad = [0xEC, 0x11], pi = 0;
    while (dcw.length < capCw) dcw.push(pad[pi++ % 2]);

    var blocks = [], eccs = [], pos = 0;
    for (var g = 0; g < 2; g++){
      var nb = g === 0 ? spec[2] : spec[4], dl = g === 0 ? spec[3] : spec[5];
      for (i = 0; i < nb; i++){
        var d = dcw.slice(pos, pos + dl); pos += dl;
        blocks.push(d); eccs.push(ecc(d, ecLen));
      }
    }
    var maxD = 0;
    for (i = 0; i < blocks.length; i++) maxD = Math.max(maxD, blocks[i].length);
    var flow = [];
    for (i = 0; i < maxD; i++) for (j = 0; j < blocks.length; j++) if (i < blocks[j].length) flow.push(blocks[j][i]);
    for (i = 0; i < ecLen; i++) for (j = 0; j < eccs.length; j++) flow.push(eccs[j][i]);

    var size = ver * 4 + 17, mat = [], rsv = [];
    for (i = 0; i < size; i++){
      mat.push(new Array(size).fill(0));
      rsv.push(new Array(size).fill(0));
    }
    function setF(r, c, v2){ if (r >= 0 && c >= 0 && r < size && c < size){ mat[r][c] = v2; rsv[r][c] = 1; } }
    function finder(r, c){
      for (var a = -1; a <= 7; a++) for (var b = -1; b <= 7; b++){
        var on = (a >= 0 && a <= 6 && (b === 0 || b === 6)) ||
                 (b >= 0 && b <= 6 && (a === 0 || a === 6)) ||
                 (a >= 2 && a <= 4 && b >= 2 && b <= 4);
        setF(r + a, c + b, on ? 1 : 0);
      }
    }
    finder(0, 0); finder(0, size - 7); finder(size - 7, 0);
    for (i = 8; i < size - 8; i++){ setF(6, i, i % 2 === 0 ? 1 : 0); setF(i, 6, i % 2 === 0 ? 1 : 0); }
    var al = ALIGN[ver - 1];
    for (i = 0; i < al.length; i++) for (j = 0; j < al.length; j++){
      var ar = al[i], ac2 = al[j];
      if ((ar <= 8 && ac2 <= 8) || (ar <= 8 && ac2 >= size - 9) || (ar >= size - 9 && ac2 <= 8)) continue;
      for (var da = -2; da <= 2; da++) for (var db = -2; db <= 2; db++)
        setF(ar + da, ac2 + db, Math.max(Math.abs(da), Math.abs(db)) !== 1 ? 1 : 0);
    }
    setF(size - 8, 8, 1);
    for (i = 0; i <= 8; i++){ rsv[8][i] = 1; rsv[i][8] = 1; }
    for (i = 0; i < 8; i++){ rsv[8][size - 1 - i] = 1; rsv[size - 1 - i][8] = 1; }
    if (ver >= 7) for (i = 0; i < 18; i++){
      var r0 = Math.floor(i / 3), c0 = i % 3;
      rsv[size - 11 + c0][r0] = 1; rsv[r0][size - 11 + c0] = 1;
    }

    var dir = -1, row = size - 1, bi = 0;
    for (var col = size - 1; col > 0; col -= 2){
      if (col === 6) col--;
      for (;;){
        for (k = 0; k < 2; k++){
          var cc = col - k;
          if (!rsv[row][cc]){
            var bit = 0;
            if (bi < flow.length * 8){ bit = (flow[bi >> 3] >> (7 - (bi & 7))) & 1; bi++; }
            mat[row][cc] = bit;
          }
        }
        row += dir;
        if (row < 0 || row >= size){ row -= dir; dir = -dir; break; }
      }
    }

    var best = null, bestScore = Infinity;
    for (var m = 0; m < 8; m++){
      var cand = [];
      for (i = 0; i < size; i++) cand.push(mat[i].slice());
      for (i = 0; i < size; i++) for (j = 0; j < size; j++)
        if (!rsv[i][j] && maskAt(m, i, j)) cand[i][j] ^= 1;
      var f = fmtBits(m);
      for (i = 0; i < 15; i++){
        var b2 = (f >> i) & 1;
        if (i < 6) cand[8][i] = b2;
        else if (i < 8) cand[8][i + 1] = b2;
        else if (i === 8) cand[7][8] = b2;
        else cand[14 - i][8] = b2;
        if (i < 8) cand[size - 1 - i][8] = b2;
        else cand[8][size - 15 + i] = b2;
      }
      cand[size - 8][8] = 1;
      if (ver >= 7){
        var vb = VBITS[ver];
        for (i = 0; i < 18; i++){
          var bt = (vb >> i) & 1, rr = Math.floor(i / 3), ccc = i % 3;
          cand[size - 11 + ccc][rr] = bt;
          cand[rr][size - 11 + ccc] = bt;
        }
      }
      var sc = penalty(cand, size);
      if (sc < bestScore){ bestScore = sc; best = cand; }
    }
    return { size: size, m: best };
  };
})();

/* SVG настоящего QR. quiet zone 4 модуля — иначе камеры не читают. */
function qrSvg(text){
  var q = null;
  try { q = QR(text); } catch(e){ q = null; }
  if (!q) return '<div class="w2-qr-sub">Ссылка слишком длинная для QR — воспользуйся кнопкой «Копировать ссылку».</div>';
  var n = q.size, pad = 4, total = n + pad * 2, p = '';
  for (var r = 0; r < n; r++){
    var run = -1;
    for (var c = 0; c <= n; c++){
      var on = c < n && q.m[r][c];
      if (on && run < 0) run = c;
      if (!on && run >= 0){ p += 'M' + (run + pad) + ' ' + (r + pad) + 'h' + (c - run) + 'v1h-' + (c - run) + 'z'; run = -1; }
    }
  }
  return '<svg viewBox="0 0 ' + total + ' ' + total + '" shape-rendering="crispEdges" role="img" aria-label="QR-код для оплаты">' +
    '<rect width="' + total + '" height="' + total + '" fill="#fff"/><path d="' + p + '" fill="#0a0a0a"/></svg>';
}
window.okoQrSvg = qrSvg;

/* ===========================================================================
   3. ЕДИНАЯ КНОПКА «НАЗАД» В ШТОРКАХ КОШЕЛЬКА
   =========================================================================== */
function sheetHead(viewId, title){
  var v = $(viewId);
  if (!v || v.querySelector('.w2-sh')) return;
  var h = D.createElement('div');
  h.className = 'w2-sh';
  h.innerHTML = '<button class="w2-sh-x" type="button" aria-label="Назад">' + ic('back') + '</button>' +
                '<span class="w2-sh-t">' + esc2(title) + '</span>';
  h.querySelector('button').onclick = function(){ if (has('closeSheet')) closeSheet(); };
  v.insertBefore(h, v.firstChild);
  /* родной <h3> дублирует заголовок — убираем, чтобы не было двух одинаковых строк */
  var h3 = v.querySelector(':scope > h3');
  if (h3 && h3.textContent.trim() === String(title).trim()) h3.remove();
}
function wrapRender(name, viewId, title){
  var prev = window[name];
  if (typeof prev !== 'function') return;
  window[name] = function(){
    var r = prev.apply(this, arguments);
    try { sheetHead(viewId, title); } catch(e){}
    return r;
  };
}

/* ===========================================================================
   4. НОВЫЕ ПОДСТРАНИЦЫ
   =========================================================================== */
var PAGES = [
  ['topup',     'Пополнение счёта'],
  ['withdraw',  'Вывод средств'],
  ['send',      'Перевод по нику'],
  ['templates', 'Шаблоны переводов'],
  ['tx',        'Операция'],
  ['receipt',   'Чек по операции'],
  ['statement', 'Выписка по счёту'],
  ['tariffs',   'Тарифы и подписка'],
  ['paypick',   'Что оплатить'],
  ['limits',    'Лимиты и комиссии']
];

function mkPage(id, title, inner){
  if ($('w2p-' + id)) return $('w2p-' + id);
  var p = D.createElement('div');
  p.className = 'w2-page';
  p.id = 'w2p-' + id;
  p.innerHTML =
    '<div class="w2-bar">' +
      '<button class="w2-bar-nav" type="button" data-w2back="' + id + '" aria-label="Назад">' + ic('back') + '</button>' +
      '<span class="w2-bar-t">' + esc2(title) + '</span>' +
      '<span class="w2-bar-sp"></span>' +
    '</div>' +
    '<div class="w2-body" id="w2b-' + id + '">' + (inner || '') + '</div>';
  D.body.appendChild(p);
  p.querySelector('[data-w2back]').onclick = function(){ if (has('w2Close')) w2Close(id); };
  return p;
}
PAGES.forEach(function(p){ mkPage(p[0], p[1], '<div class="w2-blank"><b>Загружаем…</b></div>'); });

/* Родные подстраницы кошелька получают такую же кнопку «назад», если её нет. */
(function ensureNativeBack(){
  D.querySelectorAll('.w2-page').forEach(function(p){
    var bar = p.querySelector('.w2-bar');
    if (bar && !bar.querySelector('.w2-bar-nav')){
      var id = String(p.id || '').replace('w2p-', '');
      var b = D.createElement('button');
      b.type = 'button'; b.className = 'w2-bar-nav'; b.setAttribute('aria-label', 'Назад');
      b.innerHTML = ic('back');
      b.onclick = function(){ if (has('w2Close')) w2Close(id); };
      bar.insertBefore(b, bar.firstChild);
    }
  });
})();

function body(id){ return $('w2b-' + id); }
function open(id){ if (has('w2Open')) w2Open(id); }
function close(id){ if (has('w2Close')) w2Close(id); }

/* ===========================================================================
   5. ЧЕСТНОСТЬ ДЕНЕГ
   =========================================================================== */

/* --- 5.1 Плановые списания: только реальные, выдуманные удалены ------------ */
if (typeof walPlannedItems === 'function'){
  walPlannedItems = function(){
    var out = [];
    try {
      if (WAL_X && WAL_X.autopay && WAL_X.nextAt){
        out.push({
          ic: 'crown',
          title: 'Автопродление PRO',
          date: (has('walDMY') ? walDMY(WAL_X.nextAt) : ''),
          sum: (has('walProPrice') ? walProPrice() : 0),
          sub: 'Списание с лицевого счёта'
        });
      }
      (WAL_X && WAL_X.autoRules || []).filter(function(r){ return r.on; }).forEach(function(r){
        out.push({
          ic: 'plus',
          title: 'Автопополнение по правилу',
          date: 'при балансе ниже ' + money(r.below),
          sum: r.sum,
          sub: 'Сработает автоматически'
        });
      });
    } catch(e){}
    return out;
  };
}
if (typeof walRenderPlanned === 'function'){
  walRenderPlanned = function(){
    var box = $('walPlanned');
    if (!box) return;
    var items = walPlannedItems();
    if (!items.length){
      box.innerHTML = '<div class="w2-blank" style="background:transparent;border:0;padding:18px 6px">' +
        '<div class="w2-blank-ic">' + ic('clock') + '</div>' +
        '<b>Списаний не запланировано</b>' +
        '<p>Здесь появятся подписки и автопополнения, которые ты включишь сам. ' +
        'Ничего не спишется без твоего согласия.</p></div>';
      return;
    }
    var total = items.reduce(function(s, it){ return s + (Number(it.sum) || 0); }, 0);
    box.innerHTML = items.map(function(it, i){
      return '<div class="wal-plan-row" style="animation-delay:' + (i * 50) + 'ms">' +
        '<div class="wal-plan-ic">' + ic(it.ic) + '</div>' +
        '<div class="wal-plan-b"><b>' + esc2(it.title) + '</b><span>' + esc2(it.sub) + ', ' + esc2(it.date) + '</span></div>' +
        '<div class="wal-plan-sum">− ' + money(it.sum) + '</div></div>';
    }).join('') +
      '<div class="wal-plan-total"><span>Итого запланировано</span><b>− ' + money(total) + '</b></div>';
  };
}

/* --- 5.2 Меры защиты: только те, что действительно работают ---------------- */
if (typeof walSafetyChecks === 'function'){
  walSafetyChecks = function(){
    var x = (typeof WAL_X !== 'undefined') ? WAL_X : {};
    return [
      {ok: !!x.pin,  name: 'ПИН-код на вывод и крупные переводы'},
      {ok: !!x.bio,  name: 'Быстрая разблокировка кошелька'},
      {ok: !!myEmail(), name: 'Email привязан — счёт на сервере'},
      {ok: true,     name: 'Подтверждение переводов от ' + money(10000)}
    ];
  };
}

/* --- 5.3 Статус вывода: без фальшивого «Зачислено» по таймеру -------------- */
if (typeof walWdStage === 'function'){
  walWdStage = function(){ return 1; };                 /* всегда «в обработке» */
}
if (typeof walWdDone === 'function'){
  walWdDone = function(){ return false; };
}
if (typeof walWdTimelineHtml === 'function'){
  walWdTimelineHtml = function(){
    var steps = [
      ['file',  'Заявка создана',        'Записана в кошельке', 'done'],
      ['clock', 'Ожидает обработки',     'Выплаты подключаются, статус придёт в уведомления', 'active'],
      ['card',  'Отправлено получателю', 'Появится, когда выплату проведут', '']
    ];
    return '<div class="wal-tl">' + steps.map(function(s, i){
      return '<div class="wal-tl-step ' + s[3] + '" style="animation-delay:' + (i * 60) + 'ms">' +
        '<span class="wal-tl-dot">' + ic(s[3] === 'done' ? 'check' : s[0]) + '</span>' +
        '<span class="wal-tl-b"><b>' + s[1] + '</b><span>' + s[2] + '</span></span></div>';
    }).join('') + '</div>';
  };
}

/* --- 5.4 TON Connect: не изображаем подключение, которого нет -------------- */
if (typeof walTonConnect === 'function'){
  walTonConnect = function(){
    pop({
      ico: 'ton', title: 'TON-кошелёк ещё не подключён',
      body: 'TON Connect в приложении пока не включён, поэтому ни подключить кошелёк, ' +
            'ни отправить Toncoin отсюда нельзя — и мы не будем делать вид, что можно.<br><br>' +
            'Пока крипту переводи напрямую в <b>Tonkeeper</b>, <b>TON Wallet</b> или ' +
            '<b>MyTonWallet</b>. Как только TON Connect подключим, кнопка заработает и ' +
            'счета TON и USDT в разделе «Мои счета» станут активными.',
      actions: [{label: 'Понятно'}]
    });
  };
}
if (typeof walTonSurface === 'function'){
  walTonSurface = function(){
    return '<div class="w2-note warn"><span class="w2-note-ic">' + ic('ton') + '</span>' +
      '<span><b>Крипта подключается.</b> TON Connect пока не включён: адрес для приёма ' +
      'мы не показываем, чтобы никто не отправил монеты в никуда. Переводи через свой ' +
      'внешний кошелёк напрямую.</span></div>';
  };
}
if (typeof w2TransferCrypto === 'function'){
  w2TransferCrypto = function(){ walTonConnect(); };
}

/* --- 5.5 Реквизиты пополнения: убраны выдуманные карта и адреса ------------ */
if (typeof walTopReqHtml === 'function'){
  walTopReqHtml = function(){
    return '<div class="w2-note"><span class="w2-note-ic">' + ic('bolt') + '</span>' +
      '<span><b>Способ оплаты выбирается на Lava.top.</b> Мы создаём счёт, ' +
      'а карта, СБП или крипта выбираются уже в защищённом шлюзе. ' +
      'Реквизиты внутри приложения не показываем — их нельзя проверить, и по ним легко ' +
      'потерять деньги.</span></div>';
  };
}

/* --- 5.6 Курсы: пока источника нет, чисел не выдумываем -------------------- */
function ratesLive(){ return CAP.exchange; }

if (typeof walRenderAccounts === 'function'){
  walRenderAccounts = function(){
    var list = $('walAccList'), totEl = $('walTotalEq');
    if (totEl) totEl.innerHTML = Math.round(balance()).toLocaleString('ru-RU').replace(/,/g, ' ') + ' <b>₽</b>';
    if (!list) return;
    var codes = ['RUB', 'USDT_TON', 'USDT_TRC', 'TON'];
    list.innerHTML = codes.map(function(code){
      var m = (typeof WAL_CUR_META !== 'undefined') ? WAL_CUR_META[code] : null;
      if (!m) return '';
      var bal = (typeof walCurBal === 'function') ? walCurBal(code) : 0;
      if (code === 'RUB'){
        return '<button class="w2-acc-row" type="button" onclick="okoW2.open(\'history\')" aria-label="Открыть рублёвый счёт">' +
          (has('walCurLogoHtml') ? walCurLogoHtml(code) : '') +
          '<div class="w2-acc-body"><b>Рубли</b><em>Основной лицевой счёт ' + esc2(acc()) + '</em></div>' +
          '<div class="w2-acc-sum"><b>' + money(bal) + '</b></div></button>';
      }
      return '<button class="w2-acc-row disabled" type="button" onclick="okoW2.cryptoInfo()" aria-label="Про счёт ' + esc2(m.name) + '">' +
        (has('walCurLogoHtml') ? walCurLogoHtml(code) : '') +
        '<div class="w2-acc-body"><b>' + esc2(m.name) + '</b><em>Подключается: нужен внешний кошелёк</em></div>' +
        '<span class="w2-acc-cta">Подробнее</span></button>';
    }).join('');
  };
}
if (typeof walOpenCurDetail === 'function'){
  walOpenCurDetail = function(){ cryptoInfo(); };
}
function cryptoInfo(){
  pop({
    ico: 'ton', title: 'Крипто-счета подключаются',
    body: 'Счета TON, USDT-TON и USDT-TRC20 в OKO пока не работают: нет ни подключения ' +
          'внешнего кошелька (TON Connect), ни источника курса.<br><br>' +
          'Поэтому мы не показываем ни адресов, ни курса — выдуманные цифры в кошельке ' +
          'опаснее, чем их отсутствие. Когда подключим, счета станут активными, а курс ' +
          'будет виден с источником и временем обновления.',
    actions: [{label: 'Понятно'}]
  });
}

/* --- 5.7 Обмен валют: честный экран вместо выдуманного курса --------------- */
if (typeof w2RenderExchange === 'function'){
  w2RenderExchange = function(){
    var box = $('w2ExView');
    if (!box) return;
    if (ratesLive()) return;
    box.innerHTML =
      '<div class="w2-blank">' +
        '<div class="w2-blank-ic">' + ic('swap') + '</div>' +
        '<b>Обмен валют подключается</b>' +
        '<p>Обмен рублей на TON и USDT будет работать через биржевого партнёра. ' +
        'Пока партнёр не подключён, у OKO нет ни курса, ни возможности провести обмен — ' +
        'поэтому мы не показываем цифры, которые ничего не значат.</p>' +
      '</div>' +
      '<div class="w2-note"><span class="w2-note-ic">' + ic('info') + '</span>' +
        '<span><b>Что будет, когда подключим.</b> В строке «Отдаёте» вводишь сумму, ' +
        'ниже сразу видно, сколько придёт, с каким курсом и какой комиссией. ' +
        'Курс фиксируется в момент подтверждения, до этого — только расчёт.</span></div>' +
      '<div class="w2-rows">' +
        '<button class="w2-row" type="button" onclick="okoW2.open(\'topup\')">' +
          '<span class="w2-row-ic">' + ic('plus') + '</span>' +
          '<span class="w2-row-b"><b>Пополнить рублёвый счёт</b><em>Через Lava.top — работает сейчас</em></span>' +
          '<svg class="i w2-row-ch"><use href="#i-chev"/></svg></button>' +
        '<button class="w2-row" type="button" onclick="okoW2.support()">' +
          '<span class="w2-row-ic">' + ic('comment') + '</span>' +
          '<span class="w2-row-b"><b>Спросить в поддержке</b><em>@okohelp — расскажем сроки</em></span>' +
          '<svg class="i w2-row-ch"><use href="#i-chev"/></svg></button>' +
      '</div>';
  };
}
if (typeof walRenderExchange === 'function'){
  walRenderExchange = function(){
    var box = $('walExView');
    if (box) box.innerHTML = '<div class="w2-blank"><div class="w2-blank-ic">' + ic('swap') + '</div>' +
      '<b>Обмен валют подключается</b><p>Курса и обменника пока нет. Как только подключим биржевого ' +
      'партнёра, обмен появится здесь.</p></div>';
    try { sheetHead('walExView', 'Обмен валют'); } catch(e){}
  };
}
if (typeof w2DoExchange === 'function'){
  w2DoExchange = function(){ say('Обмен подключается — курса пока нет'); };
}
if (typeof walDoExchange === 'function'){
  walDoExchange = function(){ say('Обмен подключается — курса пока нет'); };
}

/* --- 5.8 Пополнение: реальная Lava.top, без дорисовки баланса -------------- */
var TOP_SUMS = [500, 1000, 3000, 5000, 10000];
var topState = {sum: 1000, busy: false};

function renderTopup(){
  var box = body('topup');
  if (!box) return;
  var s = topState;
  box.innerHTML =
    '<div class="w2-note"><span class="w2-note-ic">' + ic('shield') + '</span>' +
      '<span><b>Как это работает.</b> OKO создаёт счёт в платёжном шлюзе <b>Lava.top</b> и ' +
      'открывает его страницу. Карту, СБП или крипту выбираешь там. Баланс в приложении ' +
      'вырастет только после того, как шлюз подтвердит оплату — не раньше.</span></div>' +

    '<span class="w2-lbl">Сумма пополнения</span>' +
    '<div class="w2-qs">' + TOP_SUMS.map(function(v){
      return '<button type="button" class="' + (s.sum === v ? 'on' : '') + '" onclick="okoW2.topSum(' + v + ')">' +
        (v >= 1000 ? (v / 1000) + 'к' : v) + '</button>';
    }).join('') + '</div>' +
    '<input class="w2-amt" id="w2TopSum" type="number" inputmode="numeric" min="1" step="1" ' +
      'placeholder="Своя сумма, ₽" value="' + (s.sum || '') + '" oninput="okoW2.topInput(this.value)">' +
    '<p class="w2-fine">Счёт ' + esc2(acc()) + '. Комиссии OKO за пополнение нет; ' +
      'комиссию платёжной системы, если она есть, покажет сам шлюз до оплаты.</p>' +

    '<div style="height:6px"></div>' +
    '<button class="btn" type="button" id="w2TopBtn" onclick="okoW2.topGo()">' + ic('bolt') +
      ' <span>Создать счёт на ' + money(s.sum) + '</span></button>' +

    (myEmail() ? '' :
      '<div class="w2-note warn"><span class="w2-note-ic">' + ic('warning') + '</span>' +
      '<span><b>Нужен email в профиле.</b> Счёт выставляется на почту и по ней же шлюз ' +
      'сообщает об оплате. Без email пополнение не создать.</span></div>') +

    '<p class="w2-fine">Не пришло зачисление в течение 15 минут после оплаты — напиши ' +
      '<b>@okohelp</b> и приложи чек Lava.top, разберёмся вручную.</p>';
}
function topSum(v){ topState.sum = v; renderTopup(); }
function topInput(v){
  topState.sum = Math.max(0, Math.floor(Number(v) || 0));
  var b = $('w2TopBtn');
  if (b) b.querySelector('span').textContent = 'Создать счёт на ' + money(topState.sum);
}
function topGo(){
  var s = topState;
  if (!s.sum || s.sum <= 0){ say('Укажи сумму пополнения'); return; }
  if (s.sum < 100){ say('Минимальная сумма пополнения — 100 ₽'); return; }
  var email = myEmail();
  if (!email){
    pop({ico: 'warning', title: 'Сначала email',
      body: 'Пополнение выставляется на email: по нему платёжный шлюз присылает чек и ' +
            'сообщает нам об оплате. Добавь почту в профиле — и вернись сюда.',
      actions: [{label: 'Понятно'}]});
    return;
  }
  if (s.busy) return;
  s.busy = true;
  var box = body('topup');
  box.innerHTML = '<div style="text-align:center;padding:40px 0"><div class="spin"></div>' +
    '<p style="font-weight:700;margin-top:14px">Создаём счёт на Lava.top…</p>' +
    '<p class="w2-fine" style="text-align:center">Это займёт пару секунд</p></div>';
  var ctrl = new AbortController();
  var to = setTimeout(function(){ ctrl.abort(); }, 15000);
  fetch(apiBase() + '?action=wallet_topup', {
    method: 'POST', headers: {'Content-Type': 'application/json'}, signal: ctrl.signal,
    body: JSON.stringify({email: email, amount: s.sum, method: 'lava'})
  })
    .then(function(r){ return r.json(); })
    .then(function(j){
      clearTimeout(to); s.busy = false;
      if (j && j.ok && j.url) return topLink(j.url, j.amount || s.sum);
      topUnavailable(j && j.error);
    })
    .catch(function(){ clearTimeout(to); s.busy = false; topUnavailable('нет связи с сервером оплаты'); });
}
function topLink(url, sum){
  var box = body('topup');
  box.innerHTML =
    '<div class="w2-blank">' +
      '<div class="w2-blank-ic">' + ic('bolt') + '</div>' +
      '<b>Счёт на ' + money(sum) + ' создан</b>' +
      '<p>Оплата откроется на Lava.top. Баланс в OKO обновится после подтверждения от шлюза — ' +
      'обычно это меньше минуты. Пока подтверждения нет, деньги на счёт не зачисляются.</p>' +
    '</div>' +
    '<div style="height:12px"></div>' +
    '<a class="btn" href="' + esc2(url) + '" target="_blank" rel="noopener" style="text-decoration:none">' +
      ic('bolt') + ' Перейти к оплате</a>' +
    '<div style="height:9px"></div>' +
    '<button class="btn ghost" type="button" onclick="okoW2.topBack()">Вернуться к пополнению</button>' +
    '<p class="w2-fine">Ссылка одноразовая и действует ограниченное время. Если страница не ' +
    'открылась — скопируй адрес и открой в браузере.</p>';
  try { window.open(url, '_blank', 'noopener'); } catch(e){}
}
function topUnavailable(reason){
  var box = body('topup');
  box.innerHTML =
    '<div class="w2-blank">' +
      '<div class="w2-blank-ic">' + ic('clock') + '</div>' +
      '<b>Оплата сейчас недоступна</b>' +
      '<p>Платёжный шлюз не ответил' + (reason ? ' (' + esc2(String(reason)) + ')' : '') + '. ' +
      'Счёт не создан, деньги не списаны, баланс не изменился. ' +
      'Попробуй ещё раз через минуту или напиши в поддержку — оформим пополнение вручную.</p>' +
    '</div>' +
    '<div style="height:12px"></div>' +
    '<button class="btn" type="button" onclick="okoW2.topBack()">' + ic('refresh') + ' Попробовать ещё раз</button>' +
    '<div style="height:9px"></div>' +
    '<button class="btn ghost" type="button" onclick="okoW2.support()">' + ic('comment') + ' Написать в поддержку</button>';
}
function topBack(){ topState.busy = false; renderTopup(); }

if (typeof walOpenTopup === 'function'){
  walOpenTopup = function(prefill){
    topState.sum = Math.max(0, Math.floor(Number(prefill) || 0)) || 1000;
    renderTopup();
    open('topup');
  };
}
window.walDoTopup = function(){ topGo(); };

/* --- 5.9 Вывод: заявка честная, статуса «зачислено» не рисуем -------------- */
var wdState = {sum: 0, dest: ''};

function renderWithdraw(){
  var box = body('withdraw');
  if (!box) return;
  var bal = balance();
  var s = wdState;
  box.innerHTML =
    '<div class="w2-note warn"><span class="w2-note-ic">' + ic('warning') + '</span>' +
      '<span><b>Выплаты подключаются.</b> Автоматического вывода на карту у OKO пока нет. ' +
      'Заявка отсюда уходит в поддержку и обрабатывается вручную в течение рабочего дня. ' +
      'До подтверждения деньги остаются на счёте — мы их не списываем.</span></div>' +

    '<div class="w2-calc">' +
      '<div class="w2-calc-r"><span>Доступно на счёте</span><b>' + money(bal) + '</b></div>' +
      '<div class="w2-calc-r"><span>Суточный лимит, тариф ' +
        esc2(has('walTier') ? walTier() : 'FREE') + '</span><b>' +
        money(has('walWdLimit') ? walWdLimit() : 0) + '</b></div>' +
      '<div class="w2-calc-r"><span>Комиссия за вывод</span><b>2%</b></div>' +
    '</div>' +

    (bal <= 0
      ? '<div class="w2-blank"><div class="w2-blank-ic">' + ic('wallet') + '</div>' +
        '<b>Выводить пока нечего</b><p>На лицевом счёте ноль. Сначала заработай или пополни счёт — ' +
        'после этого вывод станет доступен.</p>' +
        '<button class="btn" type="button" onclick="okoW2.open(\'topup\')">' + ic('plus') + ' Пополнить счёт</button></div>'
      : '<span class="w2-lbl">Сумма вывода</span>' +
        '<input class="w2-amt" type="number" inputmode="numeric" min="1" max="' + bal + '" ' +
          'placeholder="Сумма, ₽" value="' + (s.sum || '') + '" oninput="okoW2.wdInput(this.value)">' +
        '<span class="w2-lbl">Куда вывести</span>' +
        '<input class="w2-fld" type="text" placeholder="Номер карты, телефон для СБП или адрес кошелька" ' +
          'value="' + esc2(s.dest) + '" oninput="okoW2.wdDest(this.value)">' +
        '<div class="w2-calc" id="w2WdCalc"></div>' +
        '<button class="btn" type="button" onclick="okoW2.wdGo()">' + ic('file') + ' Отправить заявку в поддержку</button>' +
        '<p class="w2-fine">Кнопка не переводит деньги. Она формирует заявку с суммой и реквизитами, ' +
        'которую разбирает человек из OKO. Пока заявку не подтвердят, баланс не меняется.</p>');
  wdCalc();
}
function wdCalc(){
  var c = $('w2WdCalc');
  if (!c) return;
  var s = wdState, fee = Math.round(s.sum * 0.02 * 100) / 100;
  c.innerHTML =
    '<div class="w2-calc-r"><span>Сумма заявки</span><b>' + money(s.sum) + '</b></div>' +
    '<div class="w2-calc-r"><span>Комиссия 2%</span><b>− ' + money(fee) + '</b></div>' +
    '<div class="w2-calc-r total"><span>К получению</span><b>' + money(Math.max(0, s.sum - fee)) + '</b></div>';
}
function wdInput(v){ wdState.sum = Math.max(0, Math.floor(Number(v) || 0)); wdCalc(); }
function wdDest(v){ wdState.dest = String(v || '').slice(0, 120); }
function wdGo(){
  var s = wdState, bal = balance();
  if (!s.sum || s.sum <= 0){ say('Укажи сумму вывода'); return; }
  if (s.sum > bal){ say('Сумма больше баланса — максимум ' + money(bal)); return; }
  if (!s.dest.trim()){ say('Укажи, куда выводить'); return; }
  var lim = has('walWdLimit') ? walWdLimit() : 0;
  if (lim && s.sum > lim){
    say('Суточный лимит вывода на тарифе ' + (has('walTier') ? walTier() : 'FREE') + ' — ' + money(lim));
    return;
  }
  var send = function(){
    var txt = 'Заявка на вывод из OKO\nСчёт: ' + acc() + '\nНик: @' + myNick() +
      '\nСумма: ' + money(s.sum) + '\nРеквизиты: ' + s.dest;
    try { navigator.clipboard.writeText(txt); } catch(e){}
    var box = body('withdraw');
    box.innerHTML =
      '<div class="w2-blank">' +
        '<div class="w2-blank-ic">' + ic('file') + '</div>' +
        '<b>Заявка готова к отправке</b>' +
        '<p>Текст заявки скопирован в буфер. Отправь его в поддержку <b>@okohelp</b> — ' +
        'выплату проведут вручную и напишут в ответ. Баланс сейчас не изменился и не изменится, ' +
        'пока деньги не уйдут получателю.</p>' +
      '</div>' +
      '<div style="height:12px"></div>' +
      '<div class="w2-kv">' +
        '<div class="w2-kv-r"><span>Сумма</span><b>' + money(s.sum) + '</b></div>' +
        '<div class="w2-kv-r"><span>Реквизиты</span><b class="oko-breakable">' + esc2(s.dest) + '</b></div>' +
        '<div class="w2-kv-r"><span>Счёт</span><b>' + esc2(acc()) + '</b></div>' +
      '</div>' +
      '<div style="height:12px"></div>' +
      '<button class="btn" type="button" onclick="okoW2.support()">' + ic('comment') + ' Открыть поддержку</button>' +
      '<div style="height:9px"></div>' +
      '<button class="btn ghost" type="button" onclick="okoW2.wdBack()">Назад к выводу</button>' +
      '<div style="height:12px"></div>' + walWdTimelineHtml();
    say('Текст заявки скопирован');
  };
  if (typeof WAL_X !== 'undefined' && WAL_X.pin && has('walPinOpen')){
    walPinOpen('confirm', 'w2b-withdraw', function(){ send(); });
    return;
  }
  send();
}
function wdBack(){ renderWithdraw(); }

if (typeof walOpenWithdraw === 'function'){
  walOpenWithdraw = function(){ wdState = {sum: 0, dest: ''}; renderWithdraw(); open('withdraw'); };
}
window.walDoWithdraw = function(){ wdGo(); };
window.walExecWithdraw = function(){ wdGo(); };

/* ===========================================================================
   6. ПЕРЕВОДЫ: страница, шаблоны, повтор
   =========================================================================== */
var TPL_KEY = 'oko-wallet-templates-v1';
function tplAll(){
  try { return JSON.parse(localStorage.getItem(TPL_KEY)) || []; } catch(e){ return []; }
}
function tplSave(list){
  try { localStorage.setItem(TPL_KEY, JSON.stringify(list)); } catch(e){}
}
function tplAdd(nick, sum, note){
  nick = String(nick || '').replace(/^@/, '').trim();
  if (!nick) return false;
  var list = tplAll();
  if (list.some(function(t){ return t.nick === nick && Number(t.sum) === Number(sum); })) return false;
  list.unshift({id: 't' + Date.now().toString(36), nick: nick, sum: Number(sum) || 0, note: String(note || '').slice(0, 60)});
  tplSave(list.slice(0, 20));
  return true;
}
function tplDel(id){
  tplSave(tplAll().filter(function(t){ return t.id !== id; }));
  renderTemplates();
  renderTransfersExtra();
  say('Шаблон удалён');
}
function tplUse(id){
  var t = tplAll().find(function(x){ return x.id === id; });
  if (!t) return;
  close('templates');
  if (has('walOpenSend')) walOpenSend(t.nick);
  setTimeout(function(){
    try {
      walSendState.sum = t.sum;
      walSendState.note = t.note || '';
      if (has('walRenderSend')) walRenderSend();
    } catch(e){}
  }, 90);
}
function renderTemplates(){
  var box = body('templates');
  if (!box) return;
  var list = tplAll();
  box.innerHTML =
    '<div class="w2-note"><span class="w2-note-ic">' + ic('bookmark') + '</span>' +
      '<span><b>Шаблон — это заготовка перевода.</b> Ник, сумма и комментарий сохраняются ' +
      'на этом устройстве и подставляются в форму одним нажатием. Деньги шаблон не двигает.</span></div>' +
    (list.length
      ? '<div class="w2-tpl">' + list.map(function(t){
          return '<div class="w2-tpl-r">' +
            '<span class="w2-tpl-av">' + esc2(t.nick.charAt(0).toUpperCase()) + '</span>' +
            '<span class="w2-tpl-b"><b>@' + esc2(t.nick) + '</b><span>' +
              (t.sum ? money(t.sum) : 'сумма не задана') +
              (t.note ? ' · ' + esc2(t.note) : '') + '</span></span>' +
            '<button class="w2-tpl-x go" type="button" onclick="okoW2.tplUse(\'' + t.id + '\')" aria-label="Использовать шаблон">' + ic('send') + '</button>' +
            '<button class="w2-tpl-x" type="button" onclick="okoW2.tplDel(\'' + t.id + '\')" aria-label="Удалить шаблон">' + ic('trash') + '</button>' +
          '</div>';
        }).join('') + '</div>'
      : '<div class="w2-blank"><div class="w2-blank-ic">' + ic('bookmark') + '</div>' +
        '<b>Шаблонов пока нет</b><p>Сделай перевод и сохрани его как шаблон — в следующий раз ' +
        'не придётся вводить ник и сумму заново.</p></div>') +
    '<div style="height:12px"></div>' +
    '<button class="btn ghost" type="button" onclick="okoW2.newTemplate()">' + ic('plus') + ' Создать шаблон вручную</button>';
}
function newTemplate(){
  var nick = prompt('Ник получателя в OKO (без @)');
  if (!nick) return;
  var sum = prompt('Сумма перевода в рублях (можно оставить пустым)');
  var note = prompt('Комментарий к переводу (необязательно)');
  if (tplAdd(nick, Number(sum) || 0, note || '')){
    renderTemplates(); renderTransfersExtra(); say('Шаблон сохранён');
  } else say('Такой шаблон уже есть');
}

/* Блок шаблонов и честных подписей на родной странице «Переводы» */
function renderTransfersExtra(){
  var page = $('w2p-transfers');
  if (!page) return;
  var bodyEl = page.querySelector('.w2-body');
  if (!bodyEl) return;
  var host = $('w2TplBlock');
  if (!host){
    host = D.createElement('div');
    host.id = 'w2TplBlock';
    var recentH = bodyEl.querySelector('#w2Recent');
    if (recentH && recentH.parentElement) recentH.parentElement.insertBefore(host, recentH);
    else bodyEl.appendChild(host);
  }
  var list = tplAll().slice(0, 4);
  host.innerHTML =
    '<p class="w2-section-h">Шаблоны</p>' +
    (list.length
      ? '<div class="w2-tpl">' + list.map(function(t){
          return '<div class="w2-tpl-r">' +
            '<span class="w2-tpl-av">' + esc2(t.nick.charAt(0).toUpperCase()) + '</span>' +
            '<span class="w2-tpl-b"><b>@' + esc2(t.nick) + '</b><span>' +
              (t.sum ? money(t.sum) : 'сумма не задана') + '</span></span>' +
            '<button class="w2-tpl-x go" type="button" onclick="okoW2.tplUse(\'' + t.id + '\')" aria-label="Использовать шаблон">' + ic('send') + '</button>' +
          '</div>';
        }).join('') + '</div>'
      : '<p class="w2-recent-empty">Шаблонов пока нет — сохрани первый после перевода, ' +
        'и он появится здесь.</p>') +
    '<div style="height:8px"></div>' +
    '<button class="w2-row" type="button" onclick="okoW2.open(\'templates\')">' +
      '<span class="w2-row-ic">' + ic('bookmark') + '</span>' +
      '<span class="w2-row-b"><b>Все шаблоны переводов</b><em>Создать, изменить, удалить</em></span>' +
      '<svg class="i w2-row-ch"><use href="#i-chev"/></svg></button>';

  /* честная подпись у пункта «На карту РФ, СБП» — автовывода нет */
  bodyEl.querySelectorAll('.w2-menu-r.solo').forEach(function(b){
    var t = b.querySelector('.w2-menu-t b');
    if (!t) return;
    var em = b.querySelector('.w2-menu-t em');
    if (/карту/i.test(t.textContent) && em) em.textContent = 'Заявка в поддержку, вручную · комиссия 2%';
    if (/крипто/i.test(t.textContent) && em) em.textContent = 'Подключается — нужен TON Connect';
  });
}

/* ===========================================================================
   7. ИСТОРИЯ, ФИЛЬТРЫ, ВЫПИСКА, ЧЕК
   =========================================================================== */
var histCat = 'all';

function opsFiltered(){
  var q = (typeof walSearch === 'string') ? walSearch : '';
  var per = (typeof walPeriod !== 'undefined') ? walPeriod : 'all';
  var f = (typeof walFilter !== 'undefined') ? walFilter : 'all';
  var since = per === 'all' ? 0 : Date.now() - Number(per) * 864e5;
  return ledger().filter(function(op){
    if (f === 'in' && op.t !== '+') return false;
    if (f === 'out' && op.t !== '-') return false;
    if (f === 'part' && catOf(op.why) !== 'Партнёрка') return false;
    if (f === 'games' && catOf(op.why) !== 'Игры') return false;
    if (since && op.at < since) return false;
    if (histCat !== 'all' && catOf(op.why) !== histCat) return false;
    if (q && (op.why + ' ' + catOf(op.why)).toLowerCase().indexOf(q) < 0) return false;
    return true;
  }).slice().sort(function(a, b){ return b.at - a.at; });
}
function catOf(why){ return has('walCat') ? walCat(why) : 'Прочее'; }

/* Итоги и фильтр по категории поверх родной истории */
function renderHistExtra(){
  var page = $('w2p-history');
  if (!page) return;
  var bodyEl = page.querySelector('.w2-body');
  if (!bodyEl) return;

  var host = $('w2HistTop');
  if (!host){
    host = D.createElement('div');
    host.id = 'w2HistTop';
    var filters = $('walFilters');
    if (filters && filters.parentElement) filters.parentElement.insertBefore(host, filters.nextSibling);
    else bodyEl.appendChild(host);
  }
  var cats = {};
  ledger().forEach(function(op){ cats[catOf(op.why)] = 1; });
  var catList = Object.keys(cats).sort();
  var list = opsFiltered();
  var inc = 0, exp = 0;
  list.forEach(function(o){ if (o.t === '+') inc += o.sum; else exp += o.sum; });

  host.innerHTML =
    (catList.length > 1
      ? '<div class="w2-chips">' +
          '<button type="button" class="' + (histCat === 'all' ? 'on' : '') + '" onclick="okoW2.histCat(\'all\')">Все категории</button>' +
          catList.map(function(c){
            return '<button type="button" class="' + (histCat === c ? 'on' : '') + '" onclick="okoW2.histCat(\'' +
              esc2(c).replace(/'/g, '') + '\')">' + esc2(c) + '</button>';
          }).join('') + '</div>'
      : '') +
    (list.length
      ? '<div class="w2-hist-sum">' +
          '<div><span>Показано операций</span><b>' + list.length + '</b></div>' +
          '<div><span>Поступило</span><b class="in">+ ' + money(inc) + '</b></div>' +
          '<div><span>Списано</span><b class="out">− ' + money(exp) + '</b></div>' +
        '</div>'
      : '');

  var foot = $('w2HistFoot');
  if (!foot){
    foot = D.createElement('div');
    foot.id = 'w2HistFoot';
    bodyEl.appendChild(foot);
  }
  foot.innerHTML =
    '<div style="height:6px"></div>' +
    '<button class="w2-row" type="button" onclick="okoW2.open(\'statement\')">' +
      '<span class="w2-row-ic">' + ic('file') + '</span>' +
      '<span class="w2-row-b"><b>Выписка за период</b><em>Показать итоги, скачать CSV или текст</em></span>' +
      '<svg class="i w2-row-ch"><use href="#i-chev"/></svg></button>';
}
function setHistCat(c){
  histCat = c;
  if (has('walRenderLedger')) walRenderLedger();
  renderHistExtra();
}

/* Родной рендер истории учитывает и фильтр по категории */
if (typeof walRenderLedger === 'function'){
  var prevLedgerRender = walRenderLedger;
  walRenderLedger = function(){
    var box = $('walLedger');
    if (!box) return prevLedgerRender.apply(this, arguments);
    if (histCat === 'all'){
      var r = prevLedgerRender.apply(this, arguments);
      renderHistExtra();
      return r;
    }
    var list = opsFiltered();
    if (!list.length){
      box.innerHTML = '<div class="wal-empty">' + ic('search') + 'В категории «' + esc2(histCat) + '» операций нет</div>';
      renderHistExtra();
      return;
    }
    box.innerHTML = list.map(function(op){
      var dir = op.t === '+';
      return '<div class="wal-op" role="button" tabindex="0" onclick="okoW2.tx(' + op.at + ')">' +
        '<div class="wal-op-ic ' + (dir ? 'in' : 'out') + '">' + ic(has('walCatIc') ? walCatIc(op.why) : 'money') + '</div>' +
        '<div class="wal-op-b"><div class="wal-op-why">' + esc2(op.why) + '</div>' +
        '<div class="wal-op-t"><span class="wal-op-cat">' + esc2(catOf(op.why)) + '</span> · ' +
        (has('walOpTime') ? walOpTime(op.at) : '') + '</div></div>' +
        '<div class="wal-op-sum ' + (dir ? 'in' : 'out') + '">' + (dir ? '+' : '−') + ' ' + money(op.sum) + '</div>' +
        '<svg class="i wal-op-chev"><use href="#i-chev"/></svg></div>';
    }).join('');
    renderHistExtra();
  };
}

/* --- 7.1 Выписка за период ------------------------------------------------- */
var stPeriod = 'all';
var ST_PERIODS = [['7', '7 дней'], ['30', '30 дней'], ['90', '90 дней'], ['365', 'Год'], ['all', 'Всё время']];

function stOps(){
  var since = stPeriod === 'all' ? 0 : Date.now() - Number(stPeriod) * 864e5;
  return ledger().filter(function(o){ return !since || o.at >= since; })
    .slice().sort(function(a, b){ return b.at - a.at; });
}
function renderStatement(){
  var box = body('statement');
  if (!box) return;
  var ops = stOps();
  var inc = 0, exp = 0;
  ops.forEach(function(o){ if (o.t === '+') inc += o.sum; else exp += o.sum; });
  box.innerHTML =
    '<span class="w2-lbl">Период выписки</span>' +
    '<div class="w2-chips">' + ST_PERIODS.map(function(p){
      return '<button type="button" class="' + (stPeriod === p[0] ? 'on' : '') + '" onclick="okoW2.stPeriod(\'' + p[0] + '\')">' + p[1] + '</button>';
    }).join('') + '</div>' +

    '<div class="w2-kv">' +
      '<div class="w2-kv-r"><span>Лицевой счёт</span><b>' + esc2(acc()) + '</b></div>' +
      '<div class="w2-kv-r"><span>Операций в периоде</span><b>' + ops.length + '</b></div>' +
      '<div class="w2-kv-r"><span>Поступило</span><b style="color:var(--accent)">+ ' + money(inc) + '</b></div>' +
      '<div class="w2-kv-r"><span>Списано</span><b>− ' + money(exp) + '</b></div>' +
      '<div class="w2-kv-r"><span>Итог периода</span><b>' + (inc - exp >= 0 ? '+ ' : '− ') + money(Math.abs(inc - exp)) + '</b></div>' +
      '<div class="w2-kv-r"><span>Баланс сейчас</span><b>' + money(balance()) + '</b></div>' +
    '</div>' +

    (ops.length
      ? '<div class="w2-acts">' +
          '<button class="prim" type="button" onclick="okoW2.stCsv()">' + ic('dl') + 'Скачать CSV</button>' +
          '<button type="button" onclick="okoW2.stTxt()">' + ic('file') + 'Скачать текстом</button>' +
        '</div>' +
        '<p class="w2-fine">CSV открывается в Excel, Numbers и Google Таблицах: дата, тип, категория, ' +
        'сумма, описание, номер операции. Текстовая выписка — для пересылки в поддержку и бухгалтерию.</p>'
      : '<div class="w2-blank" style="margin-top:12px"><div class="w2-blank-ic">' + ic('file') + '</div>' +
        '<b>За этот период операций нет</b><p>Выбери другой период или пополни счёт — ' +
        'после первой операции выписку можно будет скачать.</p></div>');
}
function setStPeriod(p){ stPeriod = p; renderStatement(); }
function dl(name, text, mime){
  try {
    var blob = new Blob(['﻿' + text], {type: (mime || 'text/plain') + ';charset=utf-8'});
    var a = D.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    D.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ try { URL.revokeObjectURL(a.href); } catch(e){} }, 4000);
    say('Файл сохранён: ' + name);
  } catch(e){ say('Не удалось сохранить файл'); }
}
function fileStamp(){
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function csvCell(v){
  var s = String(v == null ? '' : v);
  return /[";\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function stCsv(){
  var ops = stOps();
  if (!ops.length){ say('За период операций нет'); return; }
  var rows = [['Дата и время', 'Тип', 'Категория', 'Сумма, ₽', 'Описание', 'Номер операции']];
  ops.forEach(function(o){
    rows.push([
      has('walDMYT') ? walDMYT(o.at) : new Date(o.at).toLocaleString('ru-RU'),
      o.t === '+' ? 'Поступление' : 'Списание',
      catOf(o.why),
      (o.t === '+' ? '+' : '-') + o.sum,
      o.why,
      has('walOpId') ? walOpId(o.at) : ''
    ]);
  });
  dl('oko-vypiska-' + fileStamp() + '.csv', rows.map(function(r){ return r.map(csvCell).join(';'); }).join('\r\n'), 'text/csv');
}
function stTxt(){
  var ops = stOps();
  if (!ops.length){ say('За период операций нет'); return; }
  var inc = 0, exp = 0;
  ops.forEach(function(o){ if (o.t === '+') inc += o.sum; else exp += o.sum; });
  var hr = '='.repeat(56), sep = '-'.repeat(56), L = [];
  L.push(hr);
  L.push('   OKO — ВЫПИСКА ПО ЛИЦЕВОМУ СЧЁТУ');
  L.push(hr);
  L.push('Счёт:      ' + acc());
  L.push('Владелец:  @' + myNick());
  L.push('Период:    ' + (ST_PERIODS.find(function(p){ return p[0] === stPeriod; }) || ['', ''])[1]);
  L.push('Создана:   ' + (has('walDMYT') ? walDMYT(Date.now()) : new Date().toLocaleString('ru-RU')));
  L.push(sep);
  ops.forEach(function(o){
    L.push((has('walDMYT') ? walDMYT(o.at) : '') + '  ' + (o.t === '+' ? '+' : '-') +
      String(o.sum).padStart(10) + '  ' + o.why);
  });
  L.push(sep);
  L.push('Поступило: ' + money(inc));
  L.push('Списано:   ' + money(exp));
  L.push('Итог:      ' + (inc - exp >= 0 ? '+' : '-') + money(Math.abs(inc - exp)));
  L.push('Баланс:    ' + money(balance()));
  L.push(hr);
  dl('oko-vypiska-' + fileStamp() + '.txt', L.join('\n'));
}

/* --- 7.2 Карточка операции и чек ------------------------------------------ */
var txCur = null;

function openTx(at){
  var op = ledger().find(function(o){ return o.at === at; });
  if (!op){ say('Операция не найдена'); return; }
  txCur = op;
  renderTx();
  open('tx');
}
function txStatus(op){
  var cat = catOf(op.why);
  if (cat === 'Вывод средств') return ['proc', 'clock', 'В обработке'];
  if (op.pending) return ['proc', 'clock', 'В обработке'];
  return ['', 'check', 'Выполнено'];
}
function renderTx(){
  var box = body('tx'), op = txCur;
  if (!box) return;
  if (!op){
    box.innerHTML = '<div class="w2-blank"><div class="w2-blank-ic">' + ic('file') + '</div>' +
      '<b>Операция не выбрана</b><p>Открой любую строку в истории операций — здесь будут её детали, ' +
      'статус и чек.</p>' +
      '<button class="btn" type="button" onclick="okoW2.open(\'history\')">' + ic('file') + ' К истории операций</button></div>';
    return;
  }
  var dir = op.t === '+', cat = catOf(op.why), st = txStatus(op);
  var after = has('walBalanceAfter') ? walBalanceAfter(op) : balance();
  var nick = (op.why.match(/@([A-Za-z0-9_.\-]+)/) || [])[1] || '';
  box.innerHTML =
    '<div class="w2-tx-head">' +
      '<div class="w2-tx-ic ' + (dir ? 'in' : 'out') + '">' + ic(has('walCatIc') ? walCatIc(op.why) : 'money') + '</div>' +
      '<div class="w2-tx-amt ' + (dir ? 'in' : '') + '">' + (dir ? '+ ' : '− ') + money(op.sum) + '</div>' +
      '<div class="w2-tx-why">' + esc2(op.why) + '</div>' +
      '<span class="w2-tx-st ' + st[0] + '">' + ic(st[1]) + st[2] + '</span>' +
    '</div>' +
    (cat === 'Вывод средств' ? walWdTimelineHtml() + '<div style="height:12px"></div>' : '') +
    '<div class="w2-kv">' +
      '<div class="w2-kv-r"><span>Категория</span><b>' + esc2(cat) + '</b></div>' +
      '<div class="w2-kv-r"><span>Тип</span><b>' + (dir ? 'Поступление' : 'Списание') + '</b></div>' +
      '<div class="w2-kv-r"><span>Дата и время</span><b>' + (has('walDMYT') ? walDMYT(op.at) : '') + '</b></div>' +
      '<div class="w2-kv-r"><span>Баланс после операции</span><b>' + money(after) + '</b></div>' +
      '<div class="w2-kv-r"><span>Лицевой счёт</span><b>' + esc2(acc()) + '</b></div>' +
      '<div class="w2-kv-r"><span>Номер операции</span><b class="mono oko-breakable">' +
        esc2(has('walOpId') ? walOpId(op.at) : '') + '</b></div>' +
      (op.tx_id ? '<div class="w2-kv-r"><span>Идентификатор перевода</span><b class="mono oko-breakable">' + esc2(op.tx_id) + '</b></div>' : '') +
    '</div>' +
    '<div class="w2-acts">' +
      '<button class="prim" type="button" onclick="okoW2.receipt()">' + ic('file') + 'Чек по операции</button>' +
      (nick && !dir ? '<button type="button" onclick="okoW2.repeat()">' + ic('send') + 'Повторить</button>' : '') +
      (cat === 'Пополнение' ? '<button type="button" onclick="okoW2.repeatTopup()">' + ic('plus') + 'Пополнить снова</button>' : '') +
      (nick ? '<button type="button" onclick="okoW2.saveTpl()">' + ic('bookmark') + 'В шаблоны</button>' : '') +
      '<button type="button" onclick="okoW2.copyTx()">' + ic('copy') + 'Скопировать</button>' +
    '</div>' +
    '<p class="w2-fine">Чек формируется приложением по записи в кошельке. Для официального документа ' +
    'по счёту скачай выписку в разделе «История и выписка».</p>';
}
function repeat(){
  var op = txCur;
  if (!op) return;
  var nick = (op.why.match(/@([A-Za-z0-9_.\-]+)/) || [])[1];
  if (!nick){ say('В этой операции нет получателя'); return; }
  close('tx');
  if (has('walOpenSend')) walOpenSend(nick);
  setTimeout(function(){
    try { walSendState.sum = op.sum; if (has('walRenderSend')) walRenderSend(); } catch(e){}
  }, 90);
}
function repeatTopup(){
  var op = txCur;
  close('tx');
  if (has('walOpenTopup')) walOpenTopup(op ? op.sum : 1000);
}
function saveTpl(){
  var op = txCur;
  if (!op) return;
  var nick = (op.why.match(/@([A-Za-z0-9_.\-]+)/) || [])[1];
  if (!nick){ say('В этой операции нет получателя'); return; }
  say(tplAdd(nick, op.sum, '') ? 'Шаблон сохранён: @' + nick : 'Такой шаблон уже есть');
  renderTransfersExtra();
}
function copyTx(){
  var op = txCur;
  if (!op) return;
  var txt = 'OKO · операция ' + (has('walOpId') ? walOpId(op.at) : '') + '\n' +
    (op.t === '+' ? '+ ' : '− ') + money(op.sum) + '\n' + op.why + '\n' +
    catOf(op.why) + ' · ' + (has('walDMYT') ? walDMYT(op.at) : '') + '\nСчёт ' + acc();
  try { navigator.clipboard.writeText(txt); } catch(e){}
  say('Детали операции скопированы');
}
function renderReceipt(){
  var box = body('receipt'), op = txCur;
  if (!box) return;
  if (!op){
    box.innerHTML = '<div class="w2-blank"><div class="w2-blank-ic">' + ic('file') + '</div>' +
      '<b>Чек формируется по операции</b><p>Открой операцию в истории и нажми «Чек по операции».</p></div>';
    return;
  }
  var dir = op.t === '+', st = txStatus(op);
  var seal = '';
  try { if (has('sealSvg')) seal = sealSvg(64); } catch(e){}
  var sign = '';
  try { if (has('signatureImg')) sign = signatureImg(96); } catch(e){}
  var req = (typeof SEAL_REQ !== 'undefined') ? SEAL_REQ : {fio: '', inn: '', brand: 'OKO', geo: ''};
  box.innerHTML =
    '<div class="w2-receipt" id="w2RcPaper">' +
      '<h4>Чек по операции</h4>' +
      '<div class="w2-rc-sub">' + esc2(req.brand || 'OKO') + ' · лицевой счёт ' + esc2(acc()) + '</div>' +
      '<div class="w2-rc-amt">' + (dir ? '+ ' : '− ') + money(op.sum) + '</div>' +
      '<div class="w2-rc-r"><span>Назначение</span><b>' + esc2(op.why) + '</b></div>' +
      '<div class="w2-rc-r"><span>Категория</span><b>' + esc2(catOf(op.why)) + '</b></div>' +
      '<div class="w2-rc-r"><span>Дата и время</span><b>' + (has('walDMYT') ? walDMYT(op.at) : '') + '</b></div>' +
      '<div class="w2-rc-r"><span>Статус</span><b>' + st[2] + '</b></div>' +
      '<div class="w2-rc-r"><span>Номер операции</span><b>' + esc2(has('walOpId') ? walOpId(op.at) : '') + '</b></div>' +
      '<div class="w2-rc-r"><span>Плательщик</span><b>@' + esc2(myNick()) + '</b></div>' +
      '<div class="w2-rc-foot">' +
        '<div>' + sign + '<div style="font-size:10.5px;color:#666">' + esc2(req.fio || '') + '</div></div>' +
        '<div>' + seal + '</div>' +
      '</div>' +
      '<div class="w2-rc-note">Чек сформирован приложением OKO по записи лицевого счёта и не является ' +
      'фискальным документом. Фискальный чек за оплату выдаёт платёжный шлюз на email.</div>' +
    '</div>' +
    '<div class="w2-acts">' +
      '<button class="prim" type="button" onclick="okoW2.rcDownload()">' + ic('dl') + 'Скачать чек</button>' +
      '<button type="button" onclick="okoW2.rcShare()">' + ic('share') + 'Поделиться</button>' +
    '</div>';
}
function rcText(){
  var op = txCur;
  if (!op) return '';
  var st = txStatus(op);
  return ['ЧЕК ПО ОПЕРАЦИИ · OKO',
    '-'.repeat(40),
    'Счёт:      ' + acc(),
    'Плательщик:@' + myNick(),
    'Сумма:     ' + (op.t === '+' ? '+ ' : '− ') + money(op.sum),
    'Назначение:' + op.why,
    'Категория: ' + catOf(op.why),
    'Дата:      ' + (has('walDMYT') ? walDMYT(op.at) : ''),
    'Статус:    ' + st[2],
    'Номер:     ' + (has('walOpId') ? walOpId(op.at) : ''),
    '-'.repeat(40),
    'Не является фискальным документом.'].join('\n');
}
function rcDownload(){
  if (!txCur) return;
  dl('oko-chek-' + (has('walOpId') ? walOpId(txCur.at) : fileStamp()) + '.txt', rcText());
}
function rcShare(){
  var t = rcText();
  if (navigator.share) navigator.share({title: 'Чек OKO', text: t}).catch(function(){});
  else { try { navigator.clipboard.writeText(t); } catch(e){} say('Чек скопирован'); }
}

/* родная карточка операции ведёт на новую подстраницу */
window.walOpenTx = function(at){ openTx(at); };

/* ===========================================================================
   8. ТАРИФЫ И ОПЛАТА LAVA.TOP
   =========================================================================== */
var TARIFFS = [
  {k: 'FREE', name: 'FREE', mo: 0,
   who: 'Посмотреть OKO изнутри и вести свои каналы без вложений.',
   feats: ['Мессенджер, лента и каналы без лимитов', 'Кошелёк, переводы внутри OKO', 'Биржа заказов: отклики и сделки', 'Академия: бесплатные уроки']},
  {k: 'START', name: 'START', mo: 990,
   who: 'Одному автору, который начал продавать своё время и контент.',
   feats: ['Всё из FREE', 'Аналитика одного канала', 'Магазин шаблонов и каталог трендов', 'Повышенный суточный лимит вывода — 100 000 ₽']},
  {k: 'PRO', name: 'PRO', mo: 4900,
   who: 'Тем, кто растит канал системно и хочет ИИ-помощника под рукой.',
   feats: ['Всё из START', 'Система Роста: разбор конкурентов', 'ОКО Ai — 300 обращений в месяц', 'Студия контента — 100 генераций', 'Лимит вывода 300 000 ₽ в сутки']},
  {k: 'BUSINESS', name: 'BUSINESS', mo: 19900,
   who: 'Команде и бизнесу, которым нужен поток контента, а не разовые ролики.',
   feats: ['Всё из PRO', 'Контент-завод: 30–50 роликов в месяц', 'Автопостинг во все сети', 'ОКО Ai — 1000 обращений', 'Лимит вывода 1 000 000 ₽ в сутки']},
  {k: 'MAX', name: 'MAX', mo: 149900,
   who: 'Максимальный объём: отдельная команда и запуск под ключ.',
   feats: ['Всё из BUSINESS', 'Контент-завод: до 300 роликов в месяц', 'Команда специалистов и менеджер', 'White-label и мультиаккаунт', 'Лимит вывода 5 000 000 ₽ в сутки']}
];
var PERIODS = [[1, '1 мес', 0], [3, '3 мес', 10], [6, '6 мес', 15], [12, 'Год', 20]];
var tarState = {plan: 'PRO', period: 12, busy: false};

function curTier(){
  try {
    if (has('walTier')) return walTier();
    if (typeof PROFILE !== 'undefined' && PROFILE.tier) return String(PROFILE.tier).toUpperCase();
  } catch(e){}
  return 'FREE';
}
function tarPrice(){
  var p = TARIFFS.find(function(x){ return x.k === tarState.plan; }) || TARIFFS[0];
  var per = PERIODS.find(function(x){ return x[0] === tarState.period; }) || PERIODS[0];
  var full = p.mo * per[0];
  return {plan: p, months: per[0], disc: per[2], full: full, total: Math.round(full * (1 - per[2] / 100))};
}
function renderTariffs(){
  var box = body('tariffs');
  if (!box) return;
  var cur = curTier();
  var pr = tarPrice();
  box.innerHTML =
    '<div class="w2-note"><span class="w2-note-ic">' + ic('info') + '</span>' +
      '<span><b>Тариф оплачивается на Lava.top.</b> Мы открываем страницу шлюза, там ты платишь ' +
      'картой, СБП или криптой. Тариф в приложении включается после подтверждения оплаты от шлюза — ' +
      'приложение само себе тариф не выдаёт.</span></div>' +

    '<p class="w2-h">Твой тариф сейчас</p>' +
    '<div class="w2-kv">' +
      '<div class="w2-kv-r"><span>Тариф</span><b>' + esc2(cur) + '</b></div>' +
      '<div class="w2-kv-r"><span>Суточный лимит вывода</span><b>' +
        money(has('walWdLimit') ? walWdLimit() : 0) + '</b></div>' +
      '<div class="w2-kv-r"><span>Автопродление</span><b>' +
        ((typeof WAL_X !== 'undefined' && WAL_X.autopay) ? 'включено' : 'выключено') + '</b></div>' +
    '</div>' +

    '<p class="w2-h">Срок оплаты</p>' +
    '<div class="w2-per">' + PERIODS.map(function(p){
      return '<button type="button" class="' + (tarState.period === p[0] ? 'on' : '') + '" onclick="okoW2.tarPeriod(' + p[0] + ')">' +
        '<span>' + p[1] + '</span>' + (p[2] ? '<i>−' + p[2] + '%</i>' : '<i>без скидки</i>') + '</button>';
    }).join('') + '</div>' +

    '<p class="w2-h">Что входит</p>' +
    '<div class="w2-tar">' + TARIFFS.map(function(t){
      var on = tarState.plan === t.k;
      var isCur = cur === t.k;
      var per = PERIODS.find(function(x){ return x[0] === tarState.period; }) || PERIODS[0];
      var total = Math.round(t.mo * per[0] * (1 - per[2] / 100));
      return '<div class="w2-tar-c ' + (on ? 'on' : '') + '">' +
        '<div class="w2-tar-h"><span class="w2-tar-n">' + esc2(t.name) + '</span>' +
          '<span class="w2-tar-p">' + (t.mo ? money(t.mo) + '<small> / мес</small>' : 'бесплатно') + '</span></div>' +
        (isCur ? '<div style="margin:6px 0 2px"><span class="w2-tar-cur">' + ic('check') + 'активен</span></div>' : '') +
        '<div class="w2-tar-for">' + esc2(t.who) + '</div>' +
        '<ul class="w2-tar-f">' + t.feats.map(function(f){
          return '<li>' + ic('check') + '<span>' + esc2(f) + '</span></li>';
        }).join('') + '</ul>' +
        '<div class="w2-tar-cta">' +
          (t.mo === 0
            ? '<button class="btn ghost" type="button" onclick="okoW2.freeInfo()">Как работает бесплатный тариф</button>'
            : (isCur
                ? '<button class="btn ghost" type="button" onclick="okoW2.open(\'autopay\')">Управлять подпиской</button>'
                : '<button class="btn' + (on ? '' : ' ghost') + '" type="button" onclick="okoW2.tarPick(\'' + t.k + '\')">' +
                  (on ? ic('bolt') + ' Оплатить ' + money(total) + ' за ' + per[1].toLowerCase() : 'Выбрать ' + esc2(t.name)) + '</button>')) +
        '</div></div>';
    }).join('') + '</div>' +

    '<p class="w2-h">Как отменить</p>' +
    '<div class="w2-note"><span class="w2-note-ic">' + ic('shield') + '</span>' +
      '<span>Подписка не продлевается сама, пока ты не включишь автопродление в разделе ' +
      '«Автоплатежи и подписки». Если включил — выключается там же одним переключателем, ' +
      'без звонков и писем. Оплаченный срок при отключении сохраняется до конца периода. ' +
      'Возврат за неиспользованный срок — по запросу в <b>@okohelp</b>.</span></div>' +

    '<p class="w2-fine">Цены указаны за месяц при выбранном сроке оплаты. ' +
    'Итого к оплате: <b>' + money(pr.total) + '</b> за ' + pr.months + ' мес' +
    (pr.disc ? ' (скидка ' + pr.disc + '%)' : '') + '.</p>';
}
function tarPeriod(p){ tarState.period = p; renderTariffs(); }
function tarPick(k){
  if (tarState.plan !== k){ tarState.plan = k; renderTariffs(); return; }
  tarGo();
}
function freeInfo(){
  pop({ico: 'info', title: 'Бесплатный тариф',
    body: 'FREE включается сам и не требует оплаты. Мессенджер, лента, каналы, кошелёк, ' +
          'переводы внутри OKO и Биржа работают без подписки. Платные тарифы добавляют ' +
          'инструменты роста и поднимают лимиты — но ничего из бесплатного не отключают.',
    actions: [{label: 'Понятно'}]});
}
function tarGo(){
  if (tarState.busy) return;
  var pr = tarPrice();
  tarState.busy = true;
  var box = body('tariffs');
  box.innerHTML = '<div style="text-align:center;padding:40px 0"><div class="spin"></div>' +
    '<p style="font-weight:700;margin-top:14px">Готовим оплату тарифа ' + esc2(pr.plan.name) + '…</p></div>';
  var product = /BUSINESS|MAX/i.test(pr.plan.name) ? 'zavod' : 'sistema';
  var ref = '';
  try { ref = localStorage.getItem('oko-ref') || ''; } catch(e){}
  var ctrl = new AbortController();
  var to = setTimeout(function(){ ctrl.abort(); }, 15000);
  fetch(apiBase() + '?action=pay_url', {
    method: 'POST', headers: {'Content-Type': 'application/json'}, signal: ctrl.signal,
    body: JSON.stringify({product: product, ref: ref, email: myEmail()})
  })
    .then(function(r){ return r.json(); })
    .then(function(j){
      clearTimeout(to); tarState.busy = false;
      if (j && j.ok && j.url) return tarLink(j.url, pr);
      tarUnavailable(pr, j && j.error);
    })
    .catch(function(){ clearTimeout(to); tarState.busy = false; tarUnavailable(pr, 'нет связи с сервером оплаты'); });
}
function tarLink(url, pr){
  var box = body('tariffs');
  box.innerHTML =
    '<div class="w2-blank">' +
      '<div class="w2-blank-ic">' + ic('bolt') + '</div>' +
      '<b>Оплата ' + esc2(pr.plan.name) + ' открывается</b>' +
      '<p>Страница Lava.top открылась в новой вкладке. К оплате ' + money(pr.total) + ' за ' +
      pr.months + ' мес. Тариф включится в приложении, когда шлюз подтвердит платёж — ' +
      'обычно в течение минуты.</p>' +
    '</div>' +
    '<div style="height:12px"></div>' +
    '<a class="btn" href="' + esc2(url) + '" target="_blank" rel="noopener" style="text-decoration:none">' +
      ic('bolt') + ' Открыть оплату ещё раз</a>' +
    '<div style="height:9px"></div>' +
    '<button class="btn ghost" type="button" onclick="okoW2.tarBack()">Вернуться к тарифам</button>' +
    '<p class="w2-fine">Оплатил, но тариф не включился? Напиши <b>@okohelp</b> и приложи чек — ' +
    'включим вручную.</p>';
  try { window.open(url, '_blank', 'noopener'); } catch(e){}
}
function tarUnavailable(pr, reason){
  var box = body('tariffs');
  box.innerHTML =
    '<div class="w2-blank">' +
      '<div class="w2-blank-ic">' + ic('clock') + '</div>' +
      '<b>Оплата тарифа подключается</b>' +
      '<p>Ссылка на оплату сейчас не пришла' + (reason ? ' (' + esc2(String(reason)) + ')' : '') + '. ' +
      'Ничего не списано и тариф не изменён. Попробуй ещё раз или напиши в поддержку — ' +
      'выставим счёт вручную и включим ' + esc2(pr.plan.name) + '.</p>' +
    '</div>' +
    '<div style="height:12px"></div>' +
    '<button class="btn" type="button" onclick="okoW2.tarBack()">' + ic('refresh') + ' Попробовать ещё раз</button>' +
    '<div style="height:9px"></div>' +
    '<button class="btn ghost" type="button" onclick="okoW2.support()">' + ic('comment') + ' Написать в поддержку</button>';
}
function tarBack(){ tarState.busy = false; renderTariffs(); }

/* ядро больше не «активирует» тариф без оплаты */
if (typeof doPay === 'function'){
  doPay = function(){
    if (has('closeSheet')) closeSheet();
    try {
      if (typeof payState !== 'undefined' && payState.plan){
        var k = String(payState.plan).toUpperCase().replace(' ', '_');
        if (TARIFFS.some(function(t){ return t.k === k; })) tarState.plan = k;
        if (payState.period) tarState.period = payState.period;
      }
    } catch(e){}
    if (has('showTab')) showTab('wallet');
    renderTariffs();
    open('tariffs');
    say('Оплата тарифа — на странице «Тарифы и подписка»');
  };
}
if (typeof openPay === 'function'){
  openPay = function(plan){
    var k = String(plan || 'PRO').toUpperCase().replace(' ', '_');
    if (TARIFFS.some(function(t){ return t.k === k; })) tarState.plan = k;
    if (has('showTab')) showTab('wallet');
    renderTariffs();
    open('tariffs');
  };
}

/* --- «Оплатить»: понятный список, а не popup ------------------------------ */
function renderPaypick(){
  var box = body('paypick');
  if (!box) return;
  box.innerHTML =
    '<div class="w2-note"><span class="w2-note-ic">' + ic('card') + '</span>' +
      '<span><b>Что можно оплатить из кошелька.</b> Списание идёт с лицевого счёта OKO. ' +
      'Если на счёте не хватает — приложение предложит пополнить, но само ничего не спишет.</span></div>' +
    '<div class="w2-rows">' +
      row('crown', 'Тариф и подписка', 'START, PRO, BUSINESS, MAX · оплата на Lava.top', "okoW2.open('tariffs')") +
      row('send', 'Перевод по нику OKO', 'Мгновенно внутри приложения, комиссия 1%', "okoW2.send()") +
      row('plus', 'Пополнить лицевой счёт', 'Счёт на Lava.top: карта, СБП, крипта', "okoW2.open('topup')") +
      row('bookmark', 'Шаблоны переводов', 'Заготовки: ник, сумма, комментарий', "okoW2.open('templates')") +
      row('crown', 'Автоплатежи и подписки', 'Что и когда спишется, как отключить', "okoW2.open('autopay')") +
    '</div>' +
    '<p class="w2-fine">Оплата рекламы, продвижения и заказов на Бирже проходит из своих разделов — ' +
    'там видно, за что именно списываются деньги.</p>';
}
function row(icon, title, sub, onclick){
  return '<button class="w2-row" type="button" onclick="' + onclick + '">' +
    '<span class="w2-row-ic">' + ic(icon) + '</span>' +
    '<span class="w2-row-b"><b>' + esc2(title) + '</b><em>' + esc2(sub) + '</em></span>' +
    '<svg class="i w2-row-ch"><use href="#i-chev"/></svg></button>';
}
if (typeof w2OpenPay === 'function'){
  w2OpenPay = function(){ renderPaypick(); open('paypick'); };
}

/* ===========================================================================
   9. ЛИМИТЫ И КОМИССИИ
   =========================================================================== */
function renderLimits(){
  var box = body('limits');
  if (!box) return;
  var cur = curTier();
  var lims = (typeof WAL_WD_LIMITS !== 'undefined') ? WAL_WD_LIMITS
    : {FREE: 50000, START: 100000, PRO: 300000, BUSINESS: 1000000, MAX: 5000000};
  var used = has('walWdUsedToday') ? walWdUsedToday() : 0;
  box.innerHTML =
    '<p class="w2-h">Сегодня</p>' +
    '<div class="w2-kv">' +
      '<div class="w2-kv-r"><span>Выведено за сутки</span><b>' + money(used) + '</b></div>' +
      '<div class="w2-kv-r"><span>Осталось по лимиту</span><b>' +
        money(Math.max(0, (lims[cur] || 0) - used)) + '</b></div>' +
      '<div class="w2-kv-r"><span>Твой тариф</span><b>' + esc2(cur) + '</b></div>' +
    '</div>' +

    '<p class="w2-h">Суточный лимит вывода по тарифам</p>' +
    '<div class="w2-lim">' +
      ['FREE', 'START', 'PRO', 'BUSINESS', 'MAX'].map(function(t){
        return '<div class="w2-lim-r ' + (t === cur ? 'on' : '') + '"><i>' + t + '</i>' +
          '<b>' + money(lims[t] || 0) + ' / сутки</b></div>';
      }).join('') +
    '</div>' +

    '<p class="w2-h">Комиссии</p>' +
    '<div class="w2-kv">' +
      '<div class="w2-kv-r"><span>Перевод по нику внутри OKO</span><b>1%</b></div>' +
      '<div class="w2-kv-r"><span>Пополнение через Lava.top</span><b>без комиссии OKO</b></div>' +
      '<div class="w2-kv-r"><span>Вывод на карту или СБП</span><b>2%</b></div>' +
      '<div class="w2-kv-r"><span>Обмен валют</span><b>подключается</b></div>' +
    '</div>' +

    '<p class="w2-h">Подтверждения</p>' +
    '<div class="w2-kv">' +
      '<div class="w2-kv-r"><span>Перевод до ' + money(10000) + '</span><b>без ПИН-кода</b></div>' +
      '<div class="w2-kv-r"><span>Перевод от ' + money(10000) + '</span><b>нужен ПИН-код</b></div>' +
      '<div class="w2-kv-r"><span>Вывод средств</span><b>ПИН, если включён</b></div>' +
    '</div>' +

    '<div class="w2-note"><span class="w2-note-ic">' + ic('shield') + '</span>' +
      '<span>Лимит считается по сумме заявок за календарные сутки и обнуляется в полночь. ' +
      'Хочешь выше — поднимай тариф; отдельно лимит не продаётся.</span></div>' +
    '<div style="height:8px"></div>' +
    '<button class="btn ghost" type="button" onclick="okoW2.open(\'tariffs\')">' + ic('crown') + ' Посмотреть тарифы</button>';
}

/* ===========================================================================
   10. АНАЛИТИКА: честная пустая страница вместо нулевых графиков
   =========================================================================== */
function analyticsEmptyGuard(){
  var page = $('w2p-analytics');
  if (!page) return;
  var bodyEl = page.querySelector('.w2-body');
  if (!bodyEl) return;
  var empty = ledger().length === 0;
  var host = $('w2AnEmpty');
  if (empty){
    Array.prototype.forEach.call(bodyEl.children, function(ch){
      if (ch.id !== 'w2AnEmpty') ch.style.display = 'none';
    });
    if (!host){
      host = D.createElement('div');
      host.id = 'w2AnEmpty';
      bodyEl.insertBefore(host, bodyEl.firstChild);
    }
    host.style.display = '';
    host.innerHTML =
      '<div class="w2-blank">' +
        '<div class="w2-blank-ic">' + ic('chart') + '</div>' +
        '<b>Пока нечего анализировать</b>' +
        '<p>График баланса, расходы по категориям и источники дохода появятся после первой ' +
        'операции. Рисовать пустые графики и проценты из воздуха мы не будем.</p>' +
        '<button class="btn" type="button" onclick="okoW2.open(\'topup\')">' + ic('plus') + ' Пополнить счёт</button>' +
      '</div>' +
      '<div style="height:10px"></div>' +
      '<button class="btn ghost" type="button" onclick="okoW2.open(\'history\')">' + ic('file') + ' Открыть историю операций</button>';
  } else {
    Array.prototype.forEach.call(bodyEl.children, function(ch){
      if (ch.id === 'w2AnEmpty') ch.style.display = 'none';
      else ch.style.display = '';
    });
  }
}

/* ===========================================================================
   11. ПРИЁМ ПЛАТЕЖА: настоящий QR + честное описание
   =========================================================================== */
var recv = {sum: 0, note: ''};

function recvLink(){
  var p = [];
  p.push('to=' + encodeURIComponent(acc()));
  if (myNick()) p.push('nick=' + encodeURIComponent(myNick()));
  if (recv.sum > 0) p.push('sum=' + recv.sum);
  if (recv.note) p.push('note=' + encodeURIComponent(recv.note));
  var origin = 'https://okoteam.top/';
  try { if (location.protocol.indexOf('http') === 0) origin = location.origin + '/'; } catch(e){}
  return origin + '?' + p.join('&');
}
function renderReceive(){
  var host = $('w2RecvHost');
  if (!host) return;
  var link = recvLink();
  host.innerHTML =
    '<div class="w2-qr-card">' +
      '<div class="w2-qr-box">' + qrSvg(link) + '</div>' +
      '<div class="w2-qr-sum">' + (recv.sum > 0 ? money(recv.sum) : 'Любая сумма') + '</div>' +
      '<div class="w2-qr-sub">Счёт <b>' + esc2(acc()) + '</b>' +
        (myNick() ? ' · @' + esc2(myNick()) : '') +
        (recv.note ? '<br>«' + esc2(recv.note) + '»' : '') + '</div>' +
      '<div class="w2-qr-inp">' +
        '<input type="number" inputmode="numeric" min="0" step="1" placeholder="Сумма, ₽" ' +
          'value="' + (recv.sum || '') + '" oninput="okoW2.recvSum(this.value)">' +
        '<input type="text" maxlength="40" placeholder="Комментарий" ' +
          'value="' + esc2(recv.note) + '" oninput="okoW2.recvNote(this.value)">' +
      '</div>' +
      '<button class="w2-qr-link" type="button" onclick="okoW2.recvCopy()">' + ic('copy') +
        '<span class="oko-breakable">' + esc2(link) + '</span></button>' +
    '</div>' +
    '<div class="w2-note"><span class="w2-note-ic">' + ic('info') + '</span>' +
      '<span><b>Что произойдёт у плательщика.</b> Он сканирует код, открывается OKO с уже ' +
      'заполненным переводом на твой счёт — остаётся подтвердить. Работает у тех, у кого ' +
      'установлено приложение OKO. Оплата картой снаружи приложения по этому коду ' +
      'подключается вместе со шлюзом.</span></div>' +
    '<div class="w2-acts">' +
      '<button class="prim" type="button" onclick="okoW2.recvShare()">' + ic('share') + 'Поделиться</button>' +
      '<button type="button" onclick="okoW2.recvCopy()">' + ic('copy') + 'Копировать ссылку</button>' +
    '</div>';
}
function recvSum(v){
  recv.sum = Math.max(0, Math.floor(Number(v) || 0));
  refreshQr();
}
function recvNote(v){
  recv.note = String(v || '').slice(0, 40);
  refreshQr();
}
var qrTimer = 0;
function refreshQr(){
  clearTimeout(qrTimer);
  qrTimer = setTimeout(function(){
    var link = recvLink();
    var boxEl = D.querySelector('#w2RecvHost .w2-qr-box');
    if (boxEl) boxEl.innerHTML = qrSvg(link);
    var sumEl = D.querySelector('#w2RecvHost .w2-qr-sum');
    if (sumEl) sumEl.textContent = recv.sum > 0 ? money(recv.sum) : 'Любая сумма';
    var lk = D.querySelector('#w2RecvHost .w2-qr-link span');
    if (lk) lk.textContent = link;
  }, 220);
}
function recvCopy(){
  try { navigator.clipboard.writeText(recvLink()); } catch(e){}
  say('Ссылка на приём скопирована');
}
function recvShare(){
  var link = recvLink();
  var text = 'Перевод на счёт OKO ' + acc() + (recv.sum ? ' · ' + money(recv.sum) : '');
  if (navigator.share) navigator.share({title: 'Платёж OKO', text: text, url: link}).catch(function(){});
  else recvCopy();
}
if (typeof w2RenderReceive === 'function'){
  w2RenderReceive = function(){ renderReceive(); };
}
if (typeof walOpenReceive === 'function'){
  walOpenReceive = function(){ renderReceive(); open('receive'); };
}

/* Ссылка вида ?to=OKO-…&sum=… открывает готовый перевод — QR не «в никуда» */
(function handlePayLink(){
  try {
    var u = new URL(location.href);
    var to = u.searchParams.get('to') || '';
    var nick = u.searchParams.get('nick') || '';
    if (!/^OKO-/i.test(to) && !nick) return;
    if (to && acc() && to.toUpperCase() === acc().toUpperCase()) return;   /* свой же QR */
    var sum = Math.max(0, Math.floor(Number(u.searchParams.get('sum')) || 0));
    var note = u.searchParams.get('note') || '';
    setTimeout(function(){
      pop({
        ico: 'send', title: 'Перевод по ссылке',
        body: 'Открыт запрос на перевод' + (sum ? ' <b>' + money(sum) + '</b>' : '') +
              (nick ? ' пользователю <b>@' + esc2(nick) + '</b>' : ' на счёт <b>' + esc2(to) + '</b>') +
              (note ? '<br>Комментарий: «' + esc2(note) + '»' : '') +
              '<br><br>Ничего не спишется, пока ты сам не подтвердишь перевод.',
        actions: [
          {label: 'Открыть перевод', onclick: function(){
            if (has('showTab')) showTab('wallet');
            if (has('walOpenSend')) walOpenSend(nick || '');
            setTimeout(function(){
              try {
                if (sum) walSendState.sum = sum;
                if (note) walSendState.note = note;
                if (has('walRenderSend')) walRenderSend();
              } catch(e){}
            }, 120);
          }},
          {label: 'Отмена', ghost: true}
        ]
      });
    }, 1500);
  } catch(e){}
})();

/* ===========================================================================
   12. ГЛАВНЫЙ ЭКРАН: честные подписи пунктов меню
   =========================================================================== */
function refreshMainMeta(){
  var m = {
    walMenuAccSub: 'Рубли — рабочий счёт, крипта подключается',
    walMenuGoalsSub: null,
    walMenuAutoSub: null,
    walMenuSecSub: null
  };
  var e = $('walMenuAccSub');
  if (e) e.textContent = m.walMenuAccSub;

  /* «Обмен валют» и «Помощь» — честные подписи */
  D.querySelectorAll('#screen-wallet .w2-menu .w2-menu-r').forEach(function(b){
    var t = b.querySelector('.w2-menu-t b'), em = b.querySelector('.w2-menu-t em');
    if (!t || !em) return;
    var name = t.textContent.trim();
    if (name === 'Обмен валют') em.textContent = 'Подключается — курса пока нет';
    if (name === 'История и выписка') em.textContent = 'Поиск, фильтры, CSV и текстовая выписка';
    if (name === 'QR-код для приёма') em.textContent = 'Рабочий QR на перевод в OKO';
  });

  /* сноска внизу экрана — без обещаний про курс */
  var note = D.querySelector('#screen-wallet .w2-foot-note');
  if (note){
    note.innerHTML = 'Лицевой счёт в рублях работает: пополнение через <b>Lava.top</b>, ' +
      'переводы по нику внутри OKO. Обмен валют, крипто-счета и автоматический вывод на карту ' +
      '<b>подключаются</b> — до этого приложение не показывает ни курса, ни адресов. ' +
      'Вопросы — <b>@okohelp</b>.';
  }

  /* два новых входа: тарифы и лимиты */
  var menu = D.querySelector('#screen-wallet .w2-menu');
  if (menu && !$('w2MenuTariffs')){
    var b1 = D.createElement('button');
    b1.className = 'w2-menu-r'; b1.id = 'w2MenuTariffs'; b1.type = 'button';
    b1.innerHTML = '<span class="w2-menu-ic">' + ic('crown') + '</span>' +
      '<span class="w2-menu-t"><b>Тарифы и подписка</b><em>Что входит, сколько стоит, как отменить</em></span>' +
      '<svg class="i w2-menu-ch"><use href="#i-chev"/></svg>';
    b1.onclick = function(){ renderTariffs(); open('tariffs'); };
    var help = menu.querySelector('.w2-menu-r:last-child');
    menu.insertBefore(b1, help);

    var b2 = D.createElement('button');
    b2.className = 'w2-menu-r'; b2.id = 'w2MenuLimits'; b2.type = 'button';
    b2.innerHTML = '<span class="w2-menu-ic">' + ic('gm-scales') + '</span>' +
      '<span class="w2-menu-t"><b>Лимиты и комиссии</b><em>Сколько можно вывести и сколько это стоит</em></span>' +
      '<svg class="i w2-menu-ch"><use href="#i-chev"/></svg>';
    b2.onclick = function(){ renderLimits(); open('limits'); };
    menu.insertBefore(b2, help);
  }
}

/* ===========================================================================
   13. ПОДКЛЮЧЕНИЕ К НАВИГАЦИИ
   =========================================================================== */
if (typeof w2Open === 'function'){
  var prevW2Open = w2Open;
  w2Open = function(id){
    /* новые страницы рендерим до показа, чтобы не мелькала заглушка */
    if (id === 'topup')     renderTopup();
    if (id === 'withdraw')  renderWithdraw();
    if (id === 'templates') renderTemplates();
    if (id === 'statement') renderStatement();
    if (id === 'tariffs')   renderTariffs();
    if (id === 'paypick')   renderPaypick();
    if (id === 'limits')    renderLimits();
    if (id === 'tx')        renderTx();
    if (id === 'receipt')   renderReceipt();
    if (id === 'send'){
      if (has('walOpenSend')) { walOpenSend(''); return; }
    }
    var r = prevW2Open.apply(this, arguments);
    if (id === 'transfers') renderTransfersExtra();
    if (id === 'history')   renderHistExtra();
    if (id === 'analytics') analyticsEmptyGuard();
    if (id === 'receive')   renderReceive();
    return r;
  };
}

/* Шторки кошелька получают шапку с «назад» */
wrapRender('walRenderSend',     'walSendView',      'Перевод по нику');
wrapRender('walRenderGoal',     'walGoalView',      'Финансовая цель');
wrapRender('walRenderAutoRule', 'walAutoRuleView',  'Правило автопополнения');
wrapRender('walRenderTopup',    'walTopupView',     'Пополнение счёта');
wrapRender('walRenderWithdraw', 'walWdView',        'Вывод средств');

/* Кнопка «сохранить в шаблоны» в форме перевода */
(function sendTemplateBtn(){
  var prev = window.walRenderSend;
  if (typeof prev !== 'function') return;
  window.walRenderSend = function(){
    var r = prev.apply(this, arguments);
    try {
      var v = $('walSendView');
      if (v && !$('w2SendTpl')){
        var b = D.createElement('button');
        b.id = 'w2SendTpl';
        b.type = 'button';
        b.className = 'btn ghost';
        b.style.marginTop = '9px';
        b.innerHTML = ic('bookmark') + ' Сохранить как шаблон';
        b.onclick = function(){
          var s = (typeof walSendState !== 'undefined') ? walSendState : null;
          if (!s || !s.to){ say('Сначала укажи ник получателя'); return; }
          say(tplAdd(s.to, s.sum, s.note) ? 'Шаблон сохранён: @' + s.to : 'Такой шаблон уже есть');
          renderTransfersExtra();
        };
        v.appendChild(b);
      }
    } catch(e){}
    return r;
  };
})();

/* Обновление подписей после каждого рендера кошелька */
(function hookRender(){
  var prev = window.renderWallet;
  if (typeof prev !== 'function') return;
  window.renderWallet = function(){
    var r = prev.apply(this, arguments);
    try { refreshMainMeta(); } catch(e){}
    try { if ($('w2p-analytics') && $('w2p-analytics').classList.contains('open')) analyticsEmptyGuard(); } catch(e){}
    return r;
  };
  try { renderWallet = window.renderWallet; } catch(e){}
})();

/* ===========================================================================
   14. ПУБЛИЧНОЕ API (для onclick в разметке)
   =========================================================================== */
window.okoW2 = {
  open: function(id){ open(id); },
  close: function(id){ close(id); },
  support: function(){
    var url = 'https://t.me/okohelp';
    try {
      if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.openTelegramLink)
        return window.Telegram.WebApp.openTelegramLink(url);
    } catch(e){}
    try { window.open(url, '_blank', 'noopener'); } catch(e){ say('Поддержка OKO — @okohelp'); }
  },
  cryptoInfo: cryptoInfo,
  freeInfo: freeInfo,
  /* пополнение */
  topSum: topSum, topInput: topInput, topGo: topGo, topBack: topBack,
  /* вывод */
  wdInput: wdInput, wdDest: wdDest, wdGo: wdGo, wdBack: wdBack,
  /* переводы */
  send: function(){ if (has('walOpenSend')) walOpenSend(''); },
  tplUse: tplUse, tplDel: tplDel, newTemplate: newTemplate,
  /* история */
  histCat: setHistCat, tx: openTx,
  stPeriod: setStPeriod, stCsv: stCsv, stTxt: stTxt,
  repeat: repeat, repeatTopup: repeatTopup, saveTpl: saveTpl, copyTx: copyTx,
  receipt: function(){ renderReceipt(); open('receipt'); },
  rcDownload: rcDownload, rcShare: rcShare,
  /* тарифы */
  tarPeriod: tarPeriod, tarPick: tarPick, tarBack: tarBack,
  /* приём */
  recvSum: recvSum, recvNote: recvNote, recvCopy: recvCopy, recvShare: recvShare
};

/* ===========================================================================
   15. СТАРТ
   =========================================================================== */
function boot(){
  try { refreshMainMeta(); } catch(e){}
  try { renderTransfersExtra(); } catch(e){}
  try { if (has('walRenderPlanned')) walRenderPlanned(); } catch(e){}
  try { if (has('walRenderSafety')) walRenderSafety(); } catch(e){}
  try { if (has('walRenderAccounts')) walRenderAccounts(); } catch(e){}
}
if (D.readyState === 'loading') D.addEventListener('DOMContentLoaded', boot);
else boot();
setTimeout(boot, 600);

})();
