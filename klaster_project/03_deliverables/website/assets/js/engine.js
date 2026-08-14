/* ===== Кластер — engine.js =====
   Сквозной слой по режиссёрскому сценарию:
   один источник света, штамп листа, одометр, размерная линия,
   экспозиция кадров, мерная рейка, разрез пола, схема мощности.

   Ничего не требует от разметки кроме уже существующих разделов:
   всё, чего нет, скрипт собирает сам. */
(function(){
  'use strict';

  var CALM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var WEAK = (navigator.deviceMemory && navigator.deviceMemory < 4) || (navigator.hardwareConcurrency || 8) <= 4;
  var $  = function(s,r){ return (r||document).querySelector(s); };
  var $$ = function(s,r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };
  var SVG = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, kids){
    var n = document.createElementNS(SVG, tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    (kids||[]).forEach(function(c){ n.appendChild(c); });
    return n;
  }

  /* один наблюдатель на весь слой */
  var io = ('IntersectionObserver' in window) ? new IntersectionObserver(function(es){
    es.forEach(function(e){
      if (!e.isIntersecting) return;
      var f = e.target.__enter;
      e.target.classList.add('on');
      if (f) f(e.target);
      io.unobserve(e.target);
    });
  }, {threshold:.22, rootMargin:'0px 0px -6% 0px'}) : null;

  function watch(node, fn){
    node.__enter = fn;
    if (io) io.observe(node); else { node.classList.add('on'); if (fn) fn(node); }
  }

  /* ================= 1. один источник света на страницу ================= */
  function light(){
    var ticking = false;
    function upd(){
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var p = h > 0 ? Math.min(1, Math.max(0, window.scrollY / h)) : 0;
      document.documentElement.style.setProperty('--light-angle', (128 - p * 66).toFixed(1) + 'deg');
      ticking = false;
    }
    if (CALM){ document.documentElement.style.setProperty('--light-angle','90deg'); return; }
    window.addEventListener('scroll', function(){
      if (!ticking){ ticking = true; requestAnimationFrame(upd); }
    }, {passive:true});
    upd();
  }

  /* ================= 2. штамп листа ================= */
  function sheet(){
    if ($('.sheet')) return;
    var secs = ['about','gallery','transport','specs','infra','industries','residents','catalog','faq','lead'];
    var names = {
      about:'О парке', gallery:'Парк вживую', transport:'Транспорт', specs:'Параметры',
      infra:'Инфраструктура', industries:'Отрасли', residents:'Резиденты',
      catalog:'Помещения', faq:'Вопросы', lead:'Заявка'
    };
    var box = document.createElement('div');
    box.className = 'sheet';
    box.setAttribute('aria-hidden','true');
    box.innerHTML = '<span class="sheet-no">01</span>' +
                    '<span class="sheet-win"><b>О парке</b></span>' +
                    '<span class="sheet-bar"><i></i></span>';
    document.body.appendChild(box);
    // появляется, когда человек ушёл с первого экрана
    window.addEventListener('scroll', function(){
      box.classList.toggle('show', window.scrollY > window.innerHeight * 0.6);
    }, {passive:true});

    var no = $('.sheet-no', box), win = $('.sheet-win', box), bar = $('.sheet-bar i', box);
    var cur = '';

    function show(id, idx){
      if (cur === id) return;
      cur = id;
      no.textContent = (idx + 1 < 10 ? '0' : '') + (idx + 1);
      // в окне всегда ровно один старый и один новый, остальное убираем сразу
      Array.prototype.slice.call(win.children).forEach(function(n, i, all){
        if (i < all.length - 1 && n.parentNode) n.parentNode.removeChild(n);
      });
      var old = win.lastElementChild;
      var neo = document.createElement('b');
      neo.textContent = names[id] || '';
      neo.classList.add('in');
      win.appendChild(neo);
      requestAnimationFrame(function(){
        if (old) old.classList.add('out');
        neo.classList.remove('in');
      });
      setTimeout(function(){
        if (old && old.parentNode === win) win.removeChild(old);
      }, 340);
    }

    if ('IntersectionObserver' in window){
      var so = new IntersectionObserver(function(es){
        es.forEach(function(e){
          if (!e.isIntersecting) return;
          var i = secs.indexOf(e.target.id);
          if (i >= 0) show(e.target.id, i);
        });
      }, {rootMargin:'-45% 0px -45% 0px'});
      secs.forEach(function(id){ var s = document.getElementById(id); if (s) so.observe(s); });
    }

    var ticking = false;
    function upd(){
      var h = document.documentElement.scrollHeight - window.innerHeight;
      var p = h > 0 ? Math.min(1, window.scrollY / h) : 0;
      bar.style.width = (p * 100).toFixed(1) + '%';
      ticking = false;
    }
    window.addEventListener('scroll', function(){ if(!ticking){ ticking = true; requestAnimationFrame(upd); } }, {passive:true});
    upd();
  }

  /* ================= 3. одометр ================= */
  function odometers(){
    // моушен-слой уже пометил числа, забираем их себе
    $$('[data-count]').forEach(build);

    function build(node){
      var target = node.getAttribute('data-count');
      var pre  = node.getAttribute('data-pre')  || '';
      var post = node.getAttribute('data-post') || '';
      if (!target) return;
      node.removeAttribute('data-count');       // старый счётчик больше не трогает узел
      var digits = String(parseInt(target,10)).split('');
      // класс вешаем на сам узел числа: обёртка-span ловила бы чужие правила
      // вида .stat span и .hero-badge span и получала бы их кегль
      var html = '';
      if (pre) html += '<span class="odo-t">' + pre + '</span>';
      digits.forEach(function(d, i){
        var left = digits.length - i;
        html += '<span class="odo-d" data-t="'+d+'"><i>';
        for (var v = 0; v <= 9; v++) html += '<span>'+v+'</span>';
        html += '</i></span>';
        if (left > 1 && (left - 1) % 3 === 0) html += '<span class="odo-sep"></span>';
      });
      if (post) html += '<span class="odo-t">' + post + '</span>';
      node.classList.add('odo');
      node.innerHTML = html;
      var drums = $$('.odo-d', node);
      if (CALM){ drums.forEach(function(d){ set(d, +d.getAttribute('data-t'), true); }); return; }
      drums.forEach(function(d){ set(d, 0, true); });
      watch(node, function(){
        drums.slice().reverse().forEach(function(d, k){
          setTimeout(function(){ set(d, +d.getAttribute('data-t')); }, k * 60);
        });
      });
    }
    function set(drum, v, instant){
      var strip = drum.firstChild;
      if (instant) strip.style.transition = 'none';
      strip.style.transform = 'translateY(' + (-v) + 'em)';
      if (instant) requestAnimationFrame(function(){ strip.style.transition = ''; });
    }
  }

  /* ================= 4. экспозиция кадров ================= */
  function exposure(){
    if (CALM) return;
    var sel = '.why-shot, .tr-shot, .infra-shots figure, .lot-img';   // кадр героя это LCP, его не трогаем
    $$(sel).forEach(function(f){
      if (!f.querySelector('img')) return;
      f.classList.add('expo');
      watch(f, function(n){ n.classList.add('expo-on'); });
    });
  }

  /* ================= 5. обмерная рамка в герое ================= */
  function heroDim(){
    var media = $('.hero-media'); if (!media || $('.dim', media)) return;
    var wrap = document.createElement('div');
    wrap.className = 'dim';
    wrap.style.cssText = 'inset:0;position:absolute';
    var s = el('svg', {viewBox:'0 0 100 100', preserveAspectRatio:'none',
                       style:'width:100%;height:100%'});
    // вертикальный размер слева: высота корпуса
    s.appendChild(el('line', {x1:'8', y1:'16', x2:'8', y2:'84', class:'v', style:'--len:68'}));
    s.appendChild(el('line', {x1:'5', y1:'16', x2:'11', y2:'16', class:'tick'}));
    s.appendChild(el('line', {x1:'5', y1:'84', x2:'11', y2:'84', class:'tick'}));
    // горизонтальный размер снизу: длина участка
    s.appendChild(el('line', {x1:'8', y1:'92', x2:'92', y2:'92', class:'h', style:'--len:84'}));
    s.appendChild(el('line', {x1:'8', y1:'89', x2:'8', y2:'95', class:'tick'}));
    s.appendChild(el('line', {x1:'92',y1:'89', x2:'92',y2:'95', class:'tick'}));
    wrap.appendChild(s);
    // подписи обычным текстом, чтобы не растягивались вместе с viewBox
    var c1 = document.createElement('span');
    c1.textContent = 'до 12 м';
    c1.style.cssText = 'position:absolute;left:16px;top:44%;transform:rotate(-90deg) translateX(-50%);transform-origin:left center;' +
      'font-family:var(--ff-d);font-size:11px;letter-spacing:.14em;color:#fff;text-shadow:0 1px 8px rgba(0,0,0,.75);opacity:0;transition:opacity .3s .55s';
    var c2 = document.createElement('span');
    c2.textContent = '50 000 м² комплекса';
    c2.style.cssText = 'position:absolute;left:50%;bottom:10px;transform:translateX(-50%);' +
      'font-family:var(--ff-d);font-size:11px;letter-spacing:.14em;color:#fff;text-shadow:0 1px 8px rgba(0,0,0,.75);opacity:0;transition:opacity .3s .7s';
    wrap.appendChild(c1); wrap.appendChild(c2);
    media.appendChild(wrap);
    watch(wrap, function(n){ c1.style.opacity = '1'; c2.style.opacity = '1'; });
  }

  /* ================= 6. мерная рейка высоты ================= */
  function heightRail(){
    var specs = document.getElementById('specs'); if (!specs) return;
    var grid = $('.specs-grid', specs); if (!grid || $('.rail', specs)) return;

    var box = document.createElement('figure');
    box.className = 'rail rv';
    box.style.cssText = 'margin-top:26px;aspect-ratio:16/9';
    box.innerHTML =
      '<picture><source type="image/webp" srcset="/assets/img/real/facade_detail-900.webp 900w, /assets/img/real/facade_detail.webp 1200w" sizes="100vw">' +
      '<img src="/assets/img/real/facade_detail-900.jpg" width="1200" height="1500" alt="Высота корпуса бизнес-парка Кластер" loading="lazy" decoding="async"></picture>' +
      '<span class="rail-scale"></span>' +
      '<span class="rail-cap">Мерная рейка: высота помещений от шести до двенадцати метров</span>';

    var marks = [[12,'12 м'],[9,'9 м'],[6,'6 м'],[3,'3 м']];
    marks.forEach(function(m, i){
      var s = document.createElement('span');
      s.className = 'rail-mark';
      s.style.bottom = (8 + (m[0]/12) * 74) + '%';
      s.style.transitionDelay = (0.25 * i + 0.3) + 's';
      s.innerHTML = '<b>' + m[1] + '</b>';
      box.appendChild(s);
    });

    // силуэты человека и станка
    var fig = document.createElement('span');
    fig.className = 'rail-fig';
    fig.style.cssText = 'left:38%;transition-delay:1.1s';
    fig.innerHTML =
      '<svg width="34" height="92" viewBox="0 0 34 92" fill="none" stroke="#E8A400" stroke-width="1.6">' +
      '<circle cx="17" cy="9" r="6"/><path d="M17 15v34M17 26l-11 8M17 26l11 8M17 49l-8 34M17 49l8 34"/></svg>';
    box.appendChild(fig);

    var mach = document.createElement('span');
    mach.className = 'rail-fig';
    mach.style.cssText = 'left:52%;transition-delay:1.35s';
    mach.innerHTML =
      '<svg width="120" height="170" viewBox="0 0 120 170" fill="none" stroke="#E8A400" stroke-width="1.6">' +
      '<rect x="8" y="52" width="104" height="106" rx="4"/><rect x="26" y="72" width="68" height="44" rx="3"/>' +
      '<path d="M60 52V22h34v18M60 22h-8M20 158v10M100 158v10"/><circle cx="60" cy="136" r="9"/></svg>';
    box.appendChild(mach);

    grid.parentNode.insertBefore(box, grid.nextSibling);
    watch(box);
  }

  /* ================= 7. разрез пирога пола ================= */
  function floorCut(){
    var specs = document.getElementById('specs'); if (!specs) return;
    var rail = $('.rail', specs); if (!rail || $('.floor', specs)) return;

    var LAYERS = [
      ['Упрочнённый верх', '3 мм',  '#C9A233', 14],
      ['Стяжка',           '80 мм', '#8b8f97', 26],
      ['Армирование',      'сетка', '#5c626c', 18],
      ['Подготовка',       '100 мм','#3b414b', 30],
      ['Щебень',           '200 мм','#2a2f37', 34],
      ['Основание',        'грунт', '#1c2027', 26],
    ];
    var box = document.createElement('div');
    box.className = 'floor rv';
    box.style.marginTop = '18px';
    var html = '<div class="pwr-title">Разрез пола, нагрузка на перекрытия</div>' +
      '<span class="floor-mach"><svg width="92" height="58" viewBox="0 0 96 62" fill="none" stroke="#E8A400" stroke-width="1.6">' +
      '<rect x="6" y="16" width="84" height="40" rx="3"/><rect x="22" y="27" width="52" height="19" rx="2"/>' +
      '<path d="M48 16V2h30v8M14 56v5M82 56v5"/></svg></span>' +
      '<div class="floor-stack">';
    LAYERS.forEach(function(l, i){
      html += '<div class="floor-l' + (i>2?' floor-hatch':'') + '" style="--h:' + l[3] + 'px;--c:' + l[2] + ';--i:' + i + '">' +
              '<b>' + l[0] + '</b><span>' + l[1] + '</span></div>';
    });
    html += '</div>' +
      '<div class="floor-num"><span class="floor-load">4000</span> <small>кг на квадратный метр, выдерживает станок и стеллаж под полной загрузкой</small></div>';
    box.innerHTML = html;

    // разрез встаёт рядом с рейкой в две колонки
    var row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:1.35fr 1fr;gap:18px;margin-top:26px;align-items:stretch';
    rail.parentNode.insertBefore(row, rail);
    rail.style.marginTop = '0';
    row.appendChild(rail);
    row.appendChild(box);
    var mq = window.matchMedia('(max-width:900px)');
    function lay(){ row.style.gridTemplateColumns = mq.matches ? '1fr' : '1.35fr 1fr'; }
    mq.addEventListener ? mq.addEventListener('change', lay) : mq.addListener(lay);
    lay();

    watch(box, function(){
      // в момент касания станка подложка проседает
      setTimeout(function(){
        if (CALM) return;
        box.style.transition = 'transform .18s var(--e-tap)';
        box.style.transform = 'translateY(3px)';
        setTimeout(function(){
          box.style.transition = 'transform .42s var(--e-rest)';
          box.style.transform = '';
        }, 190);
      }, 1050);
    });
  }

  /* ================= 8. однолинейная схема мощности ================= */
  function power(){
    var infra = document.getElementById('infra'); if (!infra) return;
    var wrap = $('.wrap', infra); if (!wrap || $('.pwr', infra)) return;

    var box = document.createElement('div');
    box.className = 'pwr rv';
    box.style.marginTop = '28px';
    box.innerHTML =
      '<div class="pwr-head">' +
        '<div><div class="pwr-title">Электрическая мощность</div>' +
        '<div class="pwr-left"><span class="pwr-rest">5000</span> кВт<small>свободного резерва на комплекс</small></div></div>' +
      '</div>' +
      '<svg viewBox="0 0 900 190" role="img" aria-label="Однолинейная схема распределения мощности">' +
        '<path class="bus" style="--len:180;--i:0" d="M40 95 H210"/>' +
        '<path class="bus" style="--len:120;--i:1" d="M210 95 V30 H330"/>' +
        '<path class="bus" style="--len:120;--i:2" d="M210 95 H330"/>' +
        '<path class="bus" style="--len:120;--i:3" d="M210 95 V160 H330"/>' +
        '<path class="bus" style="--len:260;--i:4" d="M330 30 H600"/>' +
        '<path class="bus" style="--len:260;--i:5" d="M330 95 H600"/>' +
        '<path class="bus" style="--len:260;--i:6" d="M330 160 H600"/>' +
        '<path class="pulse" d="M40 95 H210 V30 H600"/>' +
        '<circle class="node" style="--i:0" cx="40"  cy="95"  r="7"/>' +
        '<circle class="node" style="--i:1" cx="210" cy="95"  r="6"/>' +
        '<circle class="node" style="--i:4" cx="600" cy="30"  r="6"/>' +
        '<circle class="node" style="--i:5" cx="600" cy="95"  r="6"/>' +
        '<circle class="node" style="--i:6" cx="600" cy="160" r="6"/>' +
        '<text class="lbl" x="24"  y="122">ввод 5 МВт</text>' +
        '<text class="lbl" x="620" y="34">корпус А</text>' +
        '<text class="lbl" x="620" y="99">корпус Б</text>' +
        '<text class="lbl" x="620" y="164">корпус В</text>' +
        '<text class="lbl" x="330" y="86">РУ</text>' +
      '</svg>' +
      '<div class="pwr-ctl">' +
        '<label for="pwrRange">Сколько нужно вашему производству</label>' +
        '<input id="pwrRange" type="range" min="100" max="2000" step="100" value="400">' +
        '<span class="pwr-val"><b>400</b> кВт</span>' +
      '</div>';

    wrap.appendChild(box);

    var range = $('#pwrRange', box), val = $('.pwr-val b', box), rest = $('.pwr-rest', box);
    function paint(){
      var v = +range.value;
      var p = ((v - range.min) / (range.max - range.min)) * 100;
      range.style.setProperty('--p', p.toFixed(1) + '%');
      val.textContent = v;
      var left = 5000 - v;
      rest.textContent = String(left).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
    }
    range.addEventListener('input', paint);
    paint();

    watch(box, function(n){
      if (!CALM && !WEAK) n.classList.add('run');
    });
    // импульс не крутится, когда раздел вне вида
    if ('IntersectionObserver' in window && !CALM && !WEAK){
      new IntersectionObserver(function(es){
        es.forEach(function(e){ box.classList.toggle('run', e.isIntersecting && box.classList.contains('on')); });
      }, {threshold:.05}).observe(box);
      document.addEventListener('visibilitychange', function(){
        if (document.hidden) box.classList.remove('run');
      });
    }
  }

  /* ================= 9. золотая волосяная линия между разделами ================= */
  function hairlines(){
    ['transport','specs','infra','industries','catalog'].forEach(function(id){
      var s = document.getElementById(id); if (!s) return;
      var w = $('.wrap', s); if (!w || $('.hair', w)) return;
      var hr = document.createElement('hr');
      hr.className = 'hair';
      hr.setAttribute('aria-hidden','true');
      hr.style.marginBottom = '30px';
      w.insertBefore(hr, w.firstChild);
    });
  }


  /* ================= 10. транспорт: схема с ползунком по годам ================= */
  function transport(){
    var box = $('.mapbox'); if (!box || box.dataset.built) return;
    box.dataset.built = '1';
    box.classList.add('geo');
    box.innerHTML =
      '<svg viewBox="0 0 640 470" role="img" aria-label="Схема транспортной доступности бизнес-парка Кластер">' +
        '<defs><filter id="gsh" x="-30%" y="-30%" width="160%" height="160%">' +
          '<feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#0A0B0D" flood-opacity=".35"/></filter></defs>' +
        // подложка кварталов
        '<g class="geo-blocks">' +
          '<rect x="34"  y="40"  width="120" height="86"  rx="6"/><rect x="176" y="30"  width="150" height="70" rx="6"/>' +
          '<rect x="352" y="46"  width="106" height="96"  rx="6"/><rect x="480" y="34"  width="126" height="80" rx="6"/>' +
          '<rect x="40"  y="300" width="140" height="104" rx="6"/><rect x="206" y="322" width="118" height="92" rx="6"/>' +
          '<rect x="350" y="298" width="132" height="110" rx="6"/><rect x="506" y="316" width="100" height="86" rx="6"/>' +
        '</g>' +
        // дороги
        '<g class="geo-roads">' +
          '<path d="M0 158 H640"/><path d="M0 268 H640"/><path d="M164 0 V470"/><path d="M470 0 V470"/>' +
        '</g>' +
        '<text class="geo-rd" x="16" y="150">Липецкая улица</text>' +
        '<text class="geo-rd" x="470" y="286">Каширское шоссе</text>' +
        // маршруты
        '<path class="geo-route" data-id="shuttle" d="M118 372 C 200 340, 250 260, 306 218"/>' +
        '<path class="geo-route pend" data-id="metro"  d="M306 214 C 300 180, 300 150, 300 118"/>' +
        '<path class="geo-route pend" data-id="mcd"    d="M312 226 C 330 268, 330 300, 330 336"/>' +
        // объект
        '<g class="geo-obj" filter="url(#gsh)" transform="translate(306,216)">' +
          '<circle class="geo-halo" r="54"/>' +
          '<rect x="-32" y="-32" width="64" height="64" rx="15"/>' +
          '<text class="geo-t1" y="6" text-anchor="middle">А</text>' +
          '<text class="geo-t2" y="52" text-anchor="middle">КЛАСТЕР</text>' +
          '<text class="geo-t3" y="68" text-anchor="middle">6-я Радиальная, 17с1</text>' +
        '</g>' +
        // станции
        '<g class="geo-st" data-year="2027" transform="translate(300,112)"><g class="geo-in">' +
          '<circle class="geo-ring" r="16"/><circle class="geo-dot" r="9"/>' +
          '<text class="geo-t2" y="-24" text-anchor="middle">Каспийская</text>' +
          '<text class="geo-t3" y="32" text-anchor="middle">7 минут пешком</text></g></g>' +
        '<g class="geo-st" data-year="2028" transform="translate(330,342)"><g class="geo-in">' +
          '<circle class="geo-ring" r="16"/><rect class="geo-dot sq" x="-8" y="-8" width="16" height="16" rx="4"/>' +
          '<text class="geo-t2" y="42" text-anchor="middle">МЦД Котляково</text>' +
          '<text class="geo-t3" y="58" text-anchor="middle">2 минуты пешком</text></g></g>' +
        '<g class="geo-st on" data-year="2026" transform="translate(112,378)"><g class="geo-in">' +
          '<circle class="geo-dot grey" r="9"/>' +
          '<text class="geo-t2" y="-20" text-anchor="middle">Царицыно</text>' +
          '<text class="geo-t3" y="30" text-anchor="middle">шаттл 15 минут</text></g></g>' +
      '</svg>' +
      '<div class="geo-ctl">' +
        '<span class="geo-y" data-y="2026">2026</span>' +
        '<span class="geo-y" data-y="2027">2027</span>' +
        '<span class="geo-y" data-y="2028">2028</span>' +
        '<input class="geo-range" type="range" min="2026" max="2028" step="1" value="2026" aria-label="Год транспортной доступности">' +
        '<span class="geo-note">до метро пешком: <b>15</b> мин</span>' +
      '</div>';

    var svg   = $('svg', box);
    var range = $('.geo-range', box);
    var note  = $('.geo-note b', box);
    var years = $$('.geo-y', box);

    // длины путей считаем один раз
    $$('.geo-route', svg).forEach(function(pth){
      var L = 0;
      try { L = pth.getTotalLength(); } catch(e){ L = 400; }
      pth.style.setProperty('--len', L.toFixed(0));
    });

    function apply(y){
      y = +y;
      $$('.geo-st', box).forEach(function(st){
        st.classList.toggle('on', +st.getAttribute('data-year') <= y);
      });
      $('[data-id=metro]', svg).classList.toggle('live', y >= 2027);
      $('[data-id=mcd]',   svg).classList.toggle('live', y >= 2028);
      years.forEach(function(s){ s.classList.toggle('cur', +s.getAttribute('data-y') === y); });
      note.textContent = y >= 2028 ? '2' : (y >= 2027 ? '7' : '15');
      range.style.setProperty('--p', ((y - 2026) / 2 * 100) + '%');
    }
    range.addEventListener('input', function(){ apply(range.value); });
    years.forEach(function(s){
      s.addEventListener('click', function(){ range.value = s.getAttribute('data-y'); apply(range.value); });
    });
    apply(2026);

    // список маршрутов слева подсвечивает свой путь
    var map = {0:'metro',1:'mcd',2:'shuttle'};
    $$('.route', box.parentElement.parentElement).forEach(function(r, i){
      var id = map[i]; if (!id) return;
      var pth = $('[data-id='+id+']', svg); if (!pth) return;
      r.addEventListener('pointerenter', function(){ pth.classList.add('hi'); });
      r.addEventListener('pointerleave', function(){ pth.classList.remove('hi'); });
    });

    watch(box);
  }

  /* ================= 11. ворота: габарит и фура ================= */
  function gates(){
    var sec = document.getElementById('specs'); if (!sec) return;
    var wrap = $('.wrap', sec); if (!wrap || $('.gate', sec)) return;

    var box = document.createElement('figure');
    box.className = 'gate rv';
    box.innerHTML =
      '<picture><source type="image/webp" srcset="/assets/img/real/gates-900.webp 900w, /assets/img/real/gates.webp 1600w" sizes="(max-width:1100px) 100vw, 1100px">' +
      '<img src="/assets/img/real/gates-900.jpg" width="1600" height="900" alt="Ворота производственных блоков бизнес-парка Кластер" loading="lazy" decoding="async"></picture>' +
      '<svg class="gate-svg" viewBox="0 0 160 90" preserveAspectRatio="none" aria-hidden="true">' +
        '<rect class="gate-frame" x="52" y="26" width="56" height="58"/>' +
        '<line class="gate-w" x1="52" y1="20" x2="108" y2="20"/>' +
        '<line class="gate-h" x1="46" y1="26" x2="46" y2="84"/>' +
      '</svg>' +
      '<span class="gate-cap gate-cw">ширина проёма 4 200 мм</span>' +
      '<span class="gate-cap gate-ch">высота 4 500 мм</span>' +
      '<span class="gate-truck"><svg viewBox="0 0 210 78" fill="none" stroke="#E8A400" stroke-width="2">' +
        '<rect x="4" y="12" width="122" height="46" rx="3"/><path d="M126 26h30l20 20v12h-50z"/>' +
        '<circle cx="42" cy="64" r="9"/><circle cx="104" cy="64" r="9"/><circle cx="164" cy="64" r="9"/></svg></span>' +
      '<figcaption>Фура заходит под погрузку прямо к воротам блока, зазор по высоте остаётся</figcaption>';
    wrap.appendChild(box);
    watch(box);
  }

  function boot(){
    try{ light();      }catch(e){}
    try{ sheet();      }catch(e){}
    try{ hairlines();  }catch(e){}
    try{ heroDim();    }catch(e){}
    try{ heightRail(); }catch(e){}
    try{ floorCut();   }catch(e){}
    try{ power();      }catch(e){}
    try{ transport();  }catch(e){}
    try{ gates();      }catch(e){}
    try{ exposure();   }catch(e){}
    // одометр последним: он забирает числа, которые пометил моушен-слой
    setTimeout(function(){ try{ odometers(); }catch(e){} }, 60);
    // страховка: ничего не остаётся спрятанным
    setTimeout(function(){
      $$('.expo:not(.expo-on)').forEach(function(n){ n.classList.add('expo-on'); });
      $$('.dim,.rail,.floor,.pwr,.geo,.gate').forEach(function(n){ n.classList.add('on'); });
    }, 5000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
