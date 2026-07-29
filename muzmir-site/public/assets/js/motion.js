/**
 * Универсальные микроанимации + онбординг.
 * — Reveal-on-scroll: IntersectionObserver добавляет .in на .reveal и *-card при появлении
 * — Cascade: у соседних карточек в контейнере добавляется delay через --i
 * — Onboarding: показывает 3 экрана при первом входе (localStorage=mz-onb-done)
 */
(function(){
  if (window.MzMotion) return; window.MzMotion = true;

  /* ---------- Reveal on scroll ---------- */
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  function bindReveal(root){
    if (reduced) return;
    var els = (root||document).querySelectorAll('.reveal:not(.in), .card:not(.in), .comp-card:not(.in), .menu-tile:not(.in), .cab-card:not(.in), .ach-tile:not(.in), .cab-kpi:not(.in)');
    if (!('IntersectionObserver' in window)) { els.forEach(function(e){e.classList.add('in');}); return; }
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if (en.isIntersecting){
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    }, {rootMargin:'0px 0px -8% 0px', threshold:.06});
    // Каскадный сдвиг по индексу в контейнере
    var byParent = new Map();
    els.forEach(function(e){
      var p = e.parentElement;
      if (!byParent.has(p)) byParent.set(p, 0);
      var i = byParent.get(p); byParent.set(p, i+1);
      if (!e.style.getPropertyValue('--i')) e.style.setProperty('--i', i);
      io.observe(e);
    });
  }
  bindReveal(document);
  document.addEventListener('mz-spa-navigate', function(){ bindReveal(document); });
  new MutationObserver(function(muts){
    muts.forEach(function(m){ m.addedNodes && m.addedNodes.forEach(function(n){ if (n.nodeType===1) bindReveal(n); }); });
  }).observe(document.body, {childList:true, subtree:true});

  /* ---------- Онбординг: 3 экрана при первом визите ---------- */
  var LS = 'mz-onb-done';
  var done = false; try { done = localStorage.getItem(LS) === '1'; } catch(e){}
  if (done) return;
  // Не показываем на служебных страницах / если гость на /apply, /admin, /api, /login, /register — там свои UI
  if (/^\/(apply|admin|api|login|register|cabinet|verify|reset|logout|verify-email|forgot|__)/.test(location.pathname)) return;

  var SLIDES = [
    {
      ic:'<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
      title:'Добро пожаловать в КЦ «Музыкальный Мир»',
      text:'Международные и Всероссийские онлайн-конкурсы культуры и искусства. Роскомнадзор № 094084, при информационной поддержке Министерств.'
    },
    {
      ic:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/><circle cx="12" cy="15" r="2.4"/>',
      title:'4 действующих конкурса',
      text:'Мировые Таланты, В зените славы, Искусство во благо, Величие России. Один клик — выбрали, отметили несколько, оплатили одним чеком.'
    },
    {
      ic:'<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
      title:'Дипломы, награды, кабинет',
      text:'Электронные дипломы на почту через 5 рабочих дней. Оригиналы, кубки, статуэтки — через «Заказ наград». Статистика и достижения — в профиле.'
    }
  ];
  var idx = 0;
  var wrap = document.createElement('div');
  wrap.id = 'mzOnb'; wrap.className = 'mz-onb';
  wrap.innerHTML =
    '<div class="mz-onb-card">' +
      '<button type="button" class="mz-onb-skip" aria-label="Пропустить">Пропустить</button>' +
      '<div class="mz-onb-slide">' +
        '<div class="mz-onb-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"></svg></div>' +
        '<h3></h3>' +
        '<p></p>' +
      '</div>' +
      '<div class="mz-onb-dots"></div>' +
      '<div class="mz-onb-nav">' +
        '<button type="button" class="btn btn--ghost" data-onb-prev>Назад</button>' +
        '<button type="button" class="btn btn--primary" data-onb-next>Далее</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(wrap);
  var dots = wrap.querySelector('.mz-onb-dots');
  SLIDES.forEach(function(_, i){
    var d = document.createElement('span'); d.className = 'mz-onb-dot'; if (i===0) d.classList.add('on');
    dots.appendChild(d);
  });
  function render(){
    var s = SLIDES[idx];
    wrap.querySelector('svg').innerHTML = s.ic;
    wrap.querySelector('h3').textContent = s.title;
    wrap.querySelector('p').textContent = s.text;
    dots.querySelectorAll('.mz-onb-dot').forEach(function(d, i){ d.classList.toggle('on', i===idx); });
    wrap.querySelector('[data-onb-prev]').style.visibility = idx===0 ? 'hidden' : '';
    wrap.querySelector('[data-onb-next]').textContent = idx===SLIDES.length-1 ? 'Начать' : 'Далее';
    wrap.querySelector('.mz-onb-slide').classList.remove('anim-in'); void wrap.offsetWidth;
    wrap.querySelector('.mz-onb-slide').classList.add('anim-in');
  }
  function finish(){
    try { localStorage.setItem(LS, '1'); } catch(e){}
    wrap.classList.remove('on');
    setTimeout(function(){ wrap.remove(); }, 320);
  }
  wrap.querySelector('.mz-onb-skip').addEventListener('click', finish);
  wrap.querySelector('[data-onb-prev]').addEventListener('click', function(){ if (idx>0){ idx--; render(); }});
  wrap.querySelector('[data-onb-next]').addEventListener('click', function(){
    if (idx < SLIDES.length-1) { idx++; render(); } else { finish(); }
  });
  render();
  requestAnimationFrame(function(){ wrap.classList.add('on'); });
})();
