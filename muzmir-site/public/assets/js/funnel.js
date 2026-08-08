/**
 * Воронка: контекстные подсказки/оферы, по таймингу и действиям.
 * Показываются 1 раз в сутки (localStorage), сдвигаются snoozed-очередью.
 * Не мешают форме подачи заявки (skip если на /apply или /cabinet).
 */
(function(){
  if (window.MzFunnel) return; window.MzFunnel = true;
  var LS_SEEN = 'mz-funnel-seen', LS_LAST = 'mz-funnel-last';
  var seen = {};
  try { seen = JSON.parse(localStorage.getItem(LS_SEEN) || '{}') || {}; } catch(e){}
  var last = 0; try { last = parseInt(localStorage.getItem(LS_LAST)||'0',10)||0; } catch(e){}
  var DAY = 86400*1000;

  var path = location.pathname;
  // На форме и в кабинете — не отвлекаем
  // Страницы оформления помечены data-nopopup (layout.php): награды, заказ, оплата,
  // клуб, подача. Там воронку не показываем — модалка перекрывала каталог наград
  // и съедала клики по кнопке «В корзину».
  var skipPage = /^\/(apply|cabinet|admin|api|login|register)/.test(path)
              || document.documentElement.dataset.nopopup === '1';

  var OFFERS = [
    {
      id: 'apply_intro',
      trigger: 'time', delay: 45000,          // через 45 сек после захода
      cond: function(){ return path === '/' && !document.body.classList.contains('is-auth'); },
      title: 'Подать заявку на конкурс',
      text: '4 действующих конкурса — Международные и Всероссийские, приём открыт. Диплом на почту через 5 рабочих дней.',
      cta: 'Подать заявку', href: '/apply',
      secondary: {label:'Смотреть афишу', href:'/competitions'}
    },
    {
      id: 'menu_hint',
      trigger: 'scroll', ratio: 0.75,          // при скролле до 75% страницы
      cond: function(){ return path === '/'; },
      title: 'Все разделы — в меню',
      text: 'В нижнем меню — «Афиша», «Подать заявку», «Награды», «Профиль». Плюс полный список — в шапке через иконку.',
      cta: 'Открыть меню', href: '/menu'
    },
    {
      id: 'multi_apply',
      trigger: 'time', delay: 30000,
      cond: function(){ return path === '/competitions'; },
      title: 'Один чек за несколько конкурсов',
      text: 'Отметьте сразу несколько конкурсов в заявке — оплата пройдёт одним платежом ЮKassa.',
      cta: 'Начать', href: '/apply'
    },
    {
      id: 'exit_intent',
      trigger: 'exit',                          // мышь ушла к верху окна (desktop)
      cond: function(){ return path === '/' && window.innerWidth > 900; },
      title: 'Прежде чем закрыть',
      text: 'Оставьте почту — сообщим о новых конкурсах и наградах первыми.',
      cta: 'Подписаться', href: '/#footerSubscribe',
      secondary: {label:'В другой раз', dismiss:true}
    },
    {
      id: 'award_upsell',
      trigger: 'time', delay: 12000,
      cond: function(){ return path === '/awards'; },
      title: 'Хотите оригинал награды?',
      text: 'Кубки, статуэтки, медали с гравировкой имени и результата. Заказ — за 2 минуты.',
      cta: 'Заказать', href: '/awards'
    }
  ];

  function markSeen(id){ seen[id] = Date.now(); last = Date.now();
    try { localStorage.setItem(LS_SEEN, JSON.stringify(seen)); localStorage.setItem(LS_LAST, String(last)); } catch(e){} }
  function canShow(o){
    if (skipPage) return false;
    if (Date.now() - last < 3*60*1000) return false;     // не чаще 1 раза в 3 минуты
    if (seen[o.id] && (Date.now() - seen[o.id]) < DAY) return false;
    return !o.cond || !!o.cond();
  }

  function el(html){ var d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }
  function show(o){
    if (document.getElementById('mzFunnel')) return;
    var host = el(
      '<div id="mzFunnel" class="mz-fun" role="dialog" aria-modal="true" aria-labelledby="mzFunT">' +
        '<div class="mz-fun-card">' +
          '<button type="button" class="mz-fun-x" aria-label="Закрыть">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>' +
          '</button>' +
          '<div class="mz-fun-ic">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>' +
          '</div>' +
          '<h3 id="mzFunT"></h3>' +
          '<p></p>' +
          '<div class="mz-fun-actions"></div>' +
        '</div>' +
      '</div>'
    );
    host.querySelector('h3').textContent = o.title;
    host.querySelector('p').textContent = o.text;
    var acts = host.querySelector('.mz-fun-actions');
    var main = el('<a class="btn btn--primary btn--lg">'+o.cta+'</a>');
    if (o.href) main.setAttribute('href', o.href); else main.setAttribute('role','button');
    main.addEventListener('click', function(){ markSeen(o.id); host.remove(); });
    acts.appendChild(main);
    if (o.secondary){
      var sec = el('<a class="btn btn--ghost">'+o.secondary.label+'</a>');
      if (o.secondary.href) sec.setAttribute('href', o.secondary.href);
      sec.addEventListener('click', function(e){ if (o.secondary.dismiss){e.preventDefault();} markSeen(o.id); host.remove(); });
      acts.appendChild(sec);
    }
    host.querySelector('.mz-fun-x').addEventListener('click', function(){ markSeen(o.id); host.remove(); });
    document.body.appendChild(host);
    requestAnimationFrame(function(){ host.classList.add('on'); });
  }

  function pickAndShow(triggerKind){
    for (var i=0; i<OFFERS.length; i++){
      var o = OFFERS[i];
      if (o.trigger !== triggerKind) continue;
      if (!canShow(o)) continue;
      show(o);
      return;
    }
  }

  // Time-triggers
  OFFERS.filter(function(o){return o.trigger==='time';}).forEach(function(o){
    setTimeout(function(){ if (canShow(o)) show(o); }, o.delay || 30000);
  });
  // Scroll-triggers
  var scrollTriggers = OFFERS.filter(function(o){return o.trigger==='scroll';});
  if (scrollTriggers.length){
    window.addEventListener('scroll', function(){
      var doc = document.documentElement;
      var ratio = (window.scrollY + window.innerHeight) / doc.scrollHeight;
      scrollTriggers.forEach(function(o){
        if (ratio >= (o.ratio||0.75) && canShow(o)) show(o);
      });
    }, {passive:true});
  }
  // Exit-intent (desktop only)
  document.addEventListener('mouseout', function(e){
    if (!e.toElement && !e.relatedTarget && e.clientY < 10){ pickAndShow('exit'); }
  });
})();
