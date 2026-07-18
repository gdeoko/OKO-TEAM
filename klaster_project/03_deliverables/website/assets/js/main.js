/* Кластер — main.js */
(function(){
  'use strict';
  document.documentElement.classList.add('js'); // gate reveal styles to JS-enabled only
  var API = '/api/lead.php';           // backend endpoint
  var PRES = '/assets/files/klaster-presentation.pdf';
  function revealAll(){document.querySelectorAll('.rv:not(.in)').forEach(function(el){el.classList.add('in')});}
  // failsafe: nothing stays hidden after load (below-fold reveals on scroll anyway)
  window.addEventListener('load',function(){setTimeout(revealAll,600)});
  setTimeout(revealAll,3000);

  // ---- mobile nav ----
  var burger=document.getElementById('burger'), nav=document.getElementById('nav');
  if(burger) burger.addEventListener('click',function(){nav.classList.toggle('open')});
  nav && nav.querySelectorAll('a').forEach(function(a){a.addEventListener('click',function(){nav.classList.remove('open')})});

  // ---- presentation button ----
  var pres=document.getElementById('presBtn');
  if(pres) pres.addEventListener('click',function(e){
    // presentation file added later; fall back to lead form
    e.preventDefault();
    fetch(PRES,{method:'HEAD'}).then(function(r){
      if(r.ok){ window.open(PRES,'_blank'); } else { location.hash='#lead'; }
    }).catch(function(){ location.hash='#lead'; });
  });

  // ---- reveal on scroll ----
  if('IntersectionObserver' in window){
    var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}})},{threshold:.12});
    document.querySelectorAll('.rv').forEach(function(el){io.observe(el)});
  } else { document.querySelectorAll('.rv').forEach(function(el){el.classList.add('in')}); }

  // ---- FAQ ----
  document.querySelectorAll('.faq-q').forEach(function(q){
    q.addEventListener('click',function(){
      var it=q.parentElement, a=it.querySelector('.faq-a');
      var open=it.classList.toggle('open');
      a.style.maxHeight=open? a.scrollHeight+'px':0;
    });
  });

  // ---- catalog ----
  var grid=document.getElementById('catGrid');
  var imgs=['/assets/img/photos/hall_empty.jpg','/assets/img/photos/interior_corridor.jpg','/assets/img/renders/facade_loading.jpg','/assets/img/photos/production_workers.jpg','/assets/img/renders/facade_entrance.jpg','/assets/img/photos/coworking.jpg'];
  fetch('/assets/js/catalog.json').then(function(r){return r.json()}).then(function(lots){
    render(lots);
  }).catch(function(){ render(fallbackLots()); });

  function render(lots){
    if(!grid) return;
    grid.innerHTML=lots.map(function(l,i){
      return '<article class="lot rv">'+
        '<div class="lot-img"><span class="lot-status">'+(l.status||'Свободно')+'</span>'+
        '<img loading="lazy" src="'+(l.img||imgs[i%imgs.length])+'" alt="'+l.title+'"></div>'+
        '<div class="lot-b"><h3>'+l.title+'</h3><div class="lot-params">'+
        (l.params||[]).map(function(p){return '<span>'+p+'</span>'}).join('')+
        '</div><div class="lot-foot"><div class="lot-price">'+l.price+'<br><small>'+(l.priceNote||'')+'</small></div>'+
        '<a href="#lead" class="btn btn-p" style="padding:10px 18px">Заявка</a></div></div></article>';
    }).join('');
    if('IntersectionObserver' in window){
      var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in')}})},{threshold:.1});
      grid.querySelectorAll('.rv').forEach(function(el){io.observe(el)});
    }
  }
  function fallbackLots(){return [
    {title:'Производственный блок',status:'Свободно',params:['420 м²','потолки 9 м','100 кВт','отдельный вход'],price:'по запросу',priceNote:'аренда'},
    {title:'Склад с рампой',status:'Свободно',params:['800 м²','потолки 8 м','кран-балка','ворота'],price:'по запросу',priceNote:'аренда'},
    {title:'Офис в производственном блоке',status:'Свободно',params:['120 м²','1 этаж','ремонт','с/у'],price:'по запросу',priceNote:'аренда'}
  ];}

  // ---- lead form ----
  var form=document.getElementById('leadForm'), ok=document.getElementById('formOk');
  if(form) form.addEventListener('submit',function(e){
    e.preventDefault();
    var btn=form.querySelector('button[type=submit]');
    var data={};
    new FormData(form).forEach(function(v,k){data[k]=(''+v).trim()});
    if(!data.name || !data.phone){ alert('Заполните имя и телефон'); return; }
    data.source='site:klaster'; data.page=location.href;
    btn.disabled=true; btn.textContent='Отправляем...';
    fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})
      .then(function(r){return r.json().catch(function(){return{ok:true}})})
      .then(function(res){ done(); })
      .catch(function(){ done(); }); // не теряем лид визуально; бэкенд дублирует на почту
    function done(){ form.style.display='none'; ok.classList.add('show'); }
  });

  // ---- chatbot ----
  var cbBtn=document.getElementById('cbBtn'), cbPanel=document.getElementById('cbPanel'),
      cbClose=document.getElementById('cbClose'), cbBody=document.getElementById('cbBody'), cbQuick=document.getElementById('cbQuick');
  var KB=[
    {q:'Где находится парк?',a:'«Кластер» находится в ЮАО Москвы, ул. 6-я Радиальная, 17с1. 5 км от МКАД (10 минут), 15 км от ТТК. Метро «Каспийская» — 7 минут пешком, МЦД «Котляково» — 2 минуты, шаттл от «Царицыно».'},
    {q:'Какие площади свободны?',a:'Производство и склад от 100 до 12 000 м², офисы от 50 до 500 м². Точную доступность подскажет отдел аренды: 8 985 331-02-71. Оставьте заявку — подберём под ваши задачи.'},
    {q:'Технические параметры',a:'Потолки 6–12 м, нагрузка 4000 кг/м², мощность до 5 МВт (100 кВт на помещение с увеличением), кран-балка, 2 лифта по 5 т, отдельные входы и ворота, офис и с/у в блоке.'},
    {q:'Когда метро?',a:'Станция «Каспийская» — 2027 год (7 минут пешком), МЦД «Котляково» — 2028 год (2 минуты). Уже сейчас — бесплатный шаттл от метро «Царицыно».'},
    {q:'Что с КРТ и технопарком?',a:'Объект вне зоны КРТ — снос не грозит. Парк получает статус технопарка: имиджевые и налоговые преференции для резидентов.'},
    {q:'Инфраструктура',a:'Парковка 550 мест, кафе-столовая и кофейня, «КластерКлаб» (душевые, раздевалки, отдых), спорт и коворкинг, охрана 24/7, газовая котельная, 3 интернет-провайдера.'},
    {q:'Оставить заявку',a:'Отлично! Прокрутите к форме внизу или позвоните в отдел аренды: 8 985 331-02-71. Мы свяжемся с вами в течение рабочего дня.',cta:true}
  ];
  var opened=false;
  function openCb(){cbPanel.classList.add('open');if(!opened){opened=true;botSay('Здравствуйте! Я помогу с вопросами об аренде в бизнес-парке «Кластер». Выберите тему или напишите свой вопрос.');renderQuick();}}
  function closeCb(){cbPanel.classList.remove('open')}
  cbBtn&&cbBtn.addEventListener('click',function(){cbPanel.classList.contains('open')?closeCb():openCb()});
  cbClose&&cbClose.addEventListener('click',closeCb);
  function msg(t,who){var d=document.createElement('div');d.className='cb-msg '+(who==='u'?'cb-user':'cb-bot');d.textContent=t;cbBody.appendChild(d);cbBody.scrollTop=cbBody.scrollHeight;}
  function botSay(t){setTimeout(function(){msg(t,'b')},220)}
  function renderQuick(){cbQuick.innerHTML='';KB.forEach(function(k){var b=document.createElement('button');b.textContent=k.q;b.addEventListener('click',function(){msg(k.q,'u');botSay(k.a);if(k.cta)setTimeout(function(){location.hash='#lead'},700);});cbQuick.appendChild(b);});}
})();
