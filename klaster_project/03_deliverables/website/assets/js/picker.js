/* ===== Кластер — picker.js =====
   Подбор помещения: человек задаёт свои параметры и сразу видит,
   что подходит. Каталог перестраивается на месте, счётчик крутится
   одометром, выбранное улетает в форму заявки.

   Пустой выдачи не бывает: если под точные параметры ничего нет,
   показываем ближайшее и честно говорим, чем оно отличается.

   Состояние живёт в адресе страницы, ссылку можно переслать коллеге. */
(function(){
  'use strict';

  var $  = function(s,r){ return (r||document).querySelector(s); };
  var $$ = function(s,r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };
  var CALM = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var PURPOSE = [
    {k:'prod',   t:'Производство'},
    {k:'ware',   t:'Склад'},
    {k:'office', t:'Офис'}
  ];
  var HEIGHTS = [
    {v:0,  t:'любая'},
    {v:6,  t:'от 6 м'},
    {v:8,  t:'от 8 м'},
    {v:9,  t:'от 9 м'},
    {v:12, t:'12 м'}
  ];

  var state = { purpose:'', area:300, height:0, power:100, crane:false };
  var lots = [];

  /* ---------- адрес страницы помнит выбор ---------- */
  function readUrl(){
    var h = (location.hash || '').replace(/^#/, '');
    if (h.indexOf('podbor=') < 0) return;
    try {
      var raw = decodeURIComponent(h.split('podbor=')[1].split('&')[0]);
      var o = JSON.parse(raw);
      ['purpose','area','height','power','crane'].forEach(function(k){
        if (o[k] !== undefined) state[k] = o[k];
      });
    } catch(e){}
  }
  function writeUrl(){
    var raw = encodeURIComponent(JSON.stringify(state));
    history.replaceState(null, '', location.pathname + '#podbor=' + raw);
    try { sessionStorage.setItem('klaster-podbor', JSON.stringify(state)); } catch(e){}
  }

  /* ---------- насколько лот подходит ---------- */
  function score(l){
    var miss = [];
    if (state.purpose && (l.purpose || []).indexOf(state.purpose) < 0) miss.push('назначение');
    if (l.area < state.area * 0.8) miss.push('площадь');
    if (state.height && (l.height || 0) < state.height) miss.push('высота');
    if (l.power < state.power * 0.75) miss.push('мощность');
    if (state.crane && !l.crane) miss.push('кран-балка');
    return miss;
  }

  function build(){
    var sec = document.getElementById('catalog');
    if (!sec || $('.pick', sec)) return;
    var head = $('.wrap > div', sec);
    if (!head) return;

    var box = document.createElement('div');
    box.className = 'pick rv';
    box.innerHTML =
      '<div class="pick-head">' +
        '<div class="pick-t">Подбор под ваш техпроцесс</div>' +
        '<div class="pick-n"><b class="pick-count">0</b> <span>подходит из ' + '<i class="pick-total">0</i></span></div>' +
      '</div>' +
      '<div class="pick-row">' +
        '<span class="pick-l">Назначение</span>' +
        '<div class="pick-chips" data-f="purpose">' +
          '<button class="pick-c on" data-v="">любое</button>' +
          PURPOSE.map(function(p){ return '<button class="pick-c" data-v="'+p.k+'">'+p.t+'</button>'; }).join('') +
        '</div>' +
      '</div>' +
      '<div class="pick-row">' +
        '<span class="pick-l"><label for="pkArea">Площадь, м²</label></span>' +
        '<input id="pkArea" class="pick-range" type="range" min="100" max="3000" step="50" value="300">' +
        '<b class="pick-v pick-area">от 300</b>' +
      '</div>' +
      '<div class="pick-row">' +
        '<span class="pick-l">Высота потолков</span>' +
        '<div class="pick-chips" data-f="height">' +
          HEIGHTS.map(function(h,i){ return '<button class="pick-c'+(i===0?' on':'')+'" data-v="'+h.v+'">'+h.t+'</button>'; }).join('') +
        '</div>' +
      '</div>' +
      '<div class="pick-row">' +
        '<span class="pick-l"><label for="pkPow">Мощность, кВт</label></span>' +
        '<input id="pkPow" class="pick-range" type="range" min="20" max="500" step="20" value="100">' +
        '<b class="pick-v pick-pow">от 100</b>' +
      '</div>' +
      '<div class="pick-row pick-row-end">' +
        '<label class="pick-check"><input type="checkbox" id="pkCrane"><span>нужна кран-балка</span></label>' +
        '<button class="btn btn-p pick-go" type="button">Оставить заявку с этими параметрами</button>' +
      '</div>' +
      '<p class="pick-note" hidden></p>';

    head.parentNode.insertBefore(box, head.nextSibling);
    wire(box);
  }

  function wire(box){
    var area = $('#pkArea', box), pow = $('#pkPow', box), crane = $('#pkCrane', box);

    function paintRange(el){
      var p = ((el.value - el.min) / (el.max - el.min)) * 100;
      el.style.setProperty('--p', p.toFixed(1) + '%');
    }

    $$('.pick-chips', box).forEach(function(g){
      g.addEventListener('click', function(e){
        var b = e.target.closest('.pick-c'); if (!b) return;
        $$('.pick-c', g).forEach(function(x){ x.classList.remove('on'); });
        b.classList.add('on');
        var f = g.getAttribute('data-f');
        state[f] = f === 'height' ? +b.getAttribute('data-v') : b.getAttribute('data-v');
        apply();
      });
    });
    area.addEventListener('input', function(){ state.area = +area.value; paintRange(area); apply(); });
    pow.addEventListener('input',  function(){ state.power = +pow.value;  paintRange(pow);  apply(); });
    crane.addEventListener('change', function(){ state.crane = crane.checked; apply(); });

    $('.pick-go', box).addEventListener('click', function(){
      toForm();
      var lead = document.getElementById('lead');
      if (lead) lead.scrollIntoView({behavior: CALM ? 'auto' : 'smooth', block:'start'});
    });

    // восстановили выбор из адреса
    readUrl();
    area.value = state.area; pow.value = state.power; crane.checked = !!state.crane;
    paintRange(area); paintRange(pow);
    $$('.pick-chips[data-f=purpose] .pick-c', box).forEach(function(b){
      b.classList.toggle('on', b.getAttribute('data-v') === state.purpose);
    });
    $$('.pick-chips[data-f=height] .pick-c', box).forEach(function(b){
      b.classList.toggle('on', +b.getAttribute('data-v') === +state.height);
    });
  }

  /* ---------- пересборка выдачи ---------- */
  function apply(){
    var grid = document.getElementById('catGrid');
    if (!grid) return;
    var box = $('.pick');
    $('.pick-area', box).textContent = 'от ' + state.area;
    $('.pick-pow',  box).textContent = 'от ' + state.power;

    var cards = $$('.lot', grid);
    if (!cards.length) return;

    // FLIP: запомнили, где карточки лежали
    var before = cards.map(function(c){ return {el:c, r:c.getBoundingClientRect()}; });

    var exact = [], near = [];
    cards.forEach(function(c){
      var l = lots[+c.getAttribute('data-i')];
      if (!l) return;
      var miss = score(l);
      (miss.length ? near : exact).push({c:c, l:l, miss:miss});
    });

    // точные первыми, ближайшие следом и приглушённые
    exact.concat(near).forEach(function(o, i){
      o.c.style.order = i;
      o.c.classList.toggle('lot-near', o.miss.length > 0);
      var tag = $('.lot-miss', o.c);
      if (o.miss.length){
        if (!tag){ tag = document.createElement('span'); tag.className = 'lot-miss'; $('.lot-b', o.c).insertBefore(tag, $('.lot-b', o.c).firstChild); }
        tag.textContent = 'не совпадает: ' + o.miss.join(', ');
      } else if (tag) tag.remove();
    });

    count(exact.length, near.length);

    if (!CALM){
      requestAnimationFrame(function(){
        before.forEach(function(b){
          var a = b.el.getBoundingClientRect();
          var dx = b.r.left - a.left, dy = b.r.top - a.top;
          if (!dx && !dy) return;
          b.el.style.transition = 'none';
          b.el.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
          requestAnimationFrame(function(){
            b.el.style.transition = 'transform .5s cubic-bezier(.22,1,.36,1)';
            b.el.style.transform = '';
          });
        });
      });
    }
    writeUrl();
  }

  function count(ok, near){
    var box = $('.pick');
    var c = $('.pick-count', box), tot = $('.pick-total', box), note = $('.pick-note', box);
    c.textContent = ok;
    tot.textContent = ok + near;
    box.classList.toggle('pick-zero', ok === 0);
    if (ok === 0){
      note.hidden = false;
      note.textContent = 'Под такие параметры сейчас свободных лотов нет, ниже показаны ближайшие. ' +
        'Площади освобождаются регулярно, оставьте заявку, и отдел аренды подберёт под ваш техпроцесс.';
    } else {
      note.hidden = true;
    }
  }

  /* ---------- параметры улетают в форму ---------- */
  function toForm(){
    var map = {prod:'Производство', ware:'Склад', office:'Офис'};
    var st = document.getElementById('f-space_type');
    if (st && state.purpose){
      Array.prototype.slice.call(st.options).forEach(function(o){
        if (o.text === map[state.purpose]) st.value = o.value || o.text;
      });
    }
    var ar = document.getElementById('f-area');
    if (ar) ar.value = 'от ' + state.area + ' м²';
    var cm = document.getElementById('f-comment');
    if (cm){
      var bits = [];
      if (state.height) bits.push('высота от ' + state.height + ' м');
      if (state.power)  bits.push('мощность от ' + state.power + ' кВт');
      if (state.crane)  bits.push('нужна кран-балка');
      var line = 'Подбор с сайта: ' + bits.join(', ');
      if (bits.length && cm.value.indexOf('Подбор с сайта') < 0){
        cm.value = (cm.value ? cm.value + '\n' : '') + line;
      }
    }
    var f = $('.pick-go');
    if (f && !CALM){
      f.classList.add('pick-sent');
      setTimeout(function(){ f.classList.remove('pick-sent'); }, 700);
    }
  }

  /* ---------- запуск ---------- */
  function boot(){
    var grid = document.getElementById('catGrid');
    if (!grid) return;
    fetch('/assets/js/catalog.json').then(function(r){ return r.json(); }).then(function(d){
      lots = d;
      // ждём, пока каталог отрисуется, и проставляем карточкам их номер
      var tries = 0;
      (function ready(){
        var cards = $$('.lot', grid);
        if (!cards.length && tries++ < 40) return setTimeout(ready, 150);
        cards.forEach(function(c, i){ c.setAttribute('data-i', i); });
        grid.style.display = 'grid';
        build();
        apply();
      })();
    }).catch(function(){});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
