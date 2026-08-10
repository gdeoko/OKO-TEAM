/* ============================================================================
   ЧИСТЫЙ СТАРТ ДЛЯ ПРОВЕРОК

   Зачем. Аудит 36 отрапортовал «0 замечаний» по 120 экранам — и соврал.
   Сверка скриншотов по хэшу показала: в режиме «десктоп» 16 кадров из 24
   были ОДНОЙ И ТОЙ ЖЕ картинкой, в узком — 9, в мобильном — 8. Поверх всех
   этих экранов стоял новый онбординг («ЗНАКОМСТВО · 1 ИЗ 3»), и проверялся
   раз за разом именно он, а не кошелёк, клипы, каналы и настройки.

   Причина простая: проверки гасили старые слои по ключам oko-onboard-done,
   oko-tour-done и oko-stories-seen, а слой oko-onb2.js хранит своё
   состояние в oko-onb2-intro и про старые ключи ничего не знает. Каждый
   новый слой со своим «первым входом» будет ломать проверки так же, поэтому
   список ключей теперь живёт в одном месте, а не копией в каждом файле.

   Правило: добавил слой, который что-то показывает при первом входе, —
   допиши сюда его ключ. Проверить, что ничего не всплыло поверх, можно
   сверкой хэшей скриншотов: одинаковые кадры на разных экранах = помеха.
   ============================================================================ */

/* Значения ровно те, что ждёт код: где-то флаг '1', где-то объект. */
export const CLEAN_START = `
try{
  var ст = {
    'oko-auth':          'tg',
    'oko-onboard-done':  '1',
    'oko-onboarded':     '1',
    'oko-stories-seen':  '1',
    'oko-tour-done':     '1',
    'oko-tour':          '1',
    'oko-demo':          '0'
  };
  for (var k in ст) localStorage.setItem(k, ст[k]);

  /* oko-onb2.js читает объект и смотрит на done/skipped */
  localStorage.setItem('oko-onb2-intro', JSON.stringify({
    done: true, skipped: false, role: null, interests: [], goal: null, at: 0
  }));

  /* Слой удержания (oko-growth) сам выбрасывает окна поверх вкладок по
     таймеру — «ТВОЯ ССЫЛКА ЛЕЖИТ БЕЗ ДЕЛА» закрыла профиль целиком, и аудит
     снимал её вместо профиля. Гасить постфактум бесполезно: окно всплывает
     уже после того, как проверка сняла оверлеи. Поэтому глушим на входе,
     через его же поле off: там перечислены виды подсказок, помеченные
     «больше не показывать». Само окно проверяется отдельно — probe-signals. */
  localStorage.setItem('okg-state-v1', JSON.stringify({
    steps: {}, ob: { collapsed: true, closed: true }, nudge: {},
    off: { partner: true, paywall: true, academy: true, factory: true,
           channels: true, market: true, system: true, video: true,
           reels: true, wallet: true, profile: true, onboard: true },
    snooze: {}, refCopied: true, paid: false, lastTier: 'FREE', partnerOn: false
  }));
}catch(e){}

/* Ручное снятие заставки и экрана входа — на случай, если что-то не успело */
window.okoSkipAuth = function(){
  try{ localStorage.setItem('oko-auth','tg'); }catch(e){}
  ['authScreen','onboard'].forEach(function(id){
    var el = document.getElementById(id);
    if(el){ el.classList.add('hidden'); el.style.display = 'none'; }
  });
  var s = document.getElementById('splash');
  if(s){ s.classList.add('gone'); s.style.display = 'none'; }
};
`;

/* Гасит всё, что всё-таки успело всплыть поверх экрана: онбординг, тур,
   сторис, попапы. Зовётся ПЕРЕД замером, иначе меряем чужой экран. */
export const CLOSE_OVERLAYS = `(() => {
  var снято = [];
  /* Знакомство: у слоя нет публичного «закрыть», поэтому снимаем класс .on
     (именно он показывает #onb2Intro) и метим ключ, чтобы не открылось снова. */
  try{
    var ob = document.getElementById('onb2Intro');
    if(ob && ob.classList.contains('on')){ ob.classList.remove('on'); снято.push('onb2'); }
    localStorage.setItem('oko-onb2-intro', JSON.stringify({done:true, skipped:false}));
  }catch(e){}
  try{ if(typeof trClose === 'function'){ trClose(); снято.push('tour'); } }catch(e){}
  try{ if(typeof tsClose === 'function'){ tsClose(); снято.push('stories'); } }catch(e){}
  try{ var p = document.getElementById('okoPopup'); if(p){ p.remove(); снято.push('popup'); } }catch(e){}
  /* Окна удержания из oko-growth (.okg-scrim) выпрыгивают поверх вкладок сами:
     «ТВОЯ ССЫЛКА ЛЕЖИТ БЕЗ ДЕЛА» закрыла профиль целиком, и аудит вместо
     профиля мерил её. Публичной функции закрытия у слоя нет — close живёт
     внутри okgModal, — поэтому снимаем подложку напрямую. */
  try{
    document.querySelectorAll('.okg-scrim').forEach(function(s){ s.remove(); снято.push('okg'); });
    document.body.classList.remove('okg-lock');
  }catch(e){}
  return снято;
})()`;

/* Полный сброс между маршрутами.

   Зачем понадобился. Подстраницы кошелька открываются классом .open и никогда
   не закрывают друг друга: в жизни это правильно (уходишь с них кнопкой
   «назад»), но обход маршрутов открывал их подряд. После «Лимитов» страница
   так и висела сверху, и следующие восемь маршрутов аудит мерил по ней —
   восемь экранов кошелька в отчёте были одним и тем же экраном.

   То же с полноэкранными панелями: каналы, настройки, поиск, ОКО Ai, клипы,
   редактор, шторки игр. Гасим их все, а не перечисляем по одной функции:
   список панелей растёт с каждым слоем, а забытая панель молча портит замер.

   Гасим только то, что само себя объявило панелью (класс .w2-page, .sheet,
   id начинается на sheet-) или лежит прямо в body поверх приложения. Экраны
   вкладок (main > .screen) не трогаем — их переключает showTab. */
export const RESET_ALL = `(() => {
  var снято = [];
  ['closeConv','closeSheet','closeMa','closePopup','closeSystemView','w2CloseAll']
    .forEach(function(f){ try{ if(typeof window[f] === 'function'){ window[f](); снято.push(f); } }catch(e){} });
  try{ if(window.okoSocial && okoSocial.isOpen && okoSocial.isOpen()) okoSocial.close(); }catch(e){}

  document.querySelectorAll('.w2-page.open').forEach(function(p){
    p.classList.remove('open'); снято.push(p.id || 'w2-page');
  });
  document.querySelectorAll('.sheet.open, [id^="sheet-"].open, .sheet.on, [id^="sheet-"].on')
    .forEach(function(p){ p.classList.remove('open'); p.classList.remove('on'); снято.push(p.id || 'sheet'); });

  /* Полноэкранные панели поверх приложения: у всех своя разметка, но общий
     признак — прямой ребёнок body с классом open/on, который закрывает экран. */
  Array.prototype.forEach.call(document.body.children, function(el){
    if (!el.classList || !(el.classList.contains('open') || el.classList.contains('on'))) return;
    if (el.tagName === 'MAIN' || el.tagName === 'HEADER' || el.tagName === 'NAV') return;
    var r = el.getBoundingClientRect();
    if (r.width * r.height < innerWidth * innerHeight * 0.3) return;
    el.classList.remove('open'); el.classList.remove('on');
    снято.push(el.id || el.className.split(/\\s+/)[0]);
  });
  return снято;
})()`;

/* Что считать «экран подменён чужим слоем». Зовётся после перехода:
   если true — переход не удался и мерить нечего. */
export const OVERLAY_VISIBLE = `(() => {
  var сел = ['#onb2Intro.on', '#trOverlay', '#tsWrap', '#okoPopup'];
  for (var i = 0; i < сел.length; i++){
    var el = document.querySelector(сел[i]);
    if(!el) continue;
    var cs = getComputedStyle(el);
    if(cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
    var r = el.getBoundingClientRect();
    if(r.width * r.height > innerWidth * innerHeight * 0.4) return сел[i];
  }
  return '';
})()`;
