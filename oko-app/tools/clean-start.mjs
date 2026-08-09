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
