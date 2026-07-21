/* ============ PAYWALL (pw-) — API-гейт, локи, триггеры, редизайн тарифов ============ */
(function(){
  'use strict';

  /* ---- иерархия тарифов (FREE < START < PRO < BUSINESS < MAX) ---- */
  var PW_RANK = {FREE:0, START:1, PRO:2, BUSINESS:3, MAX:4};
  var PW_ORDER = ['START','PRO','BUSINESS','MAX'];
  function pwCurRank(){
    if(typeof isOwner==='function' && isOwner()) return 99;
    var t = (typeof PROFILE!=='undefined' && PROFILE.tier ? String(PROFILE.tier).toUpperCase() : 'FREE');
    return PW_RANK[t] != null ? PW_RANK[t] : 0;
  }

  /* ---- цены/мес (fallback если PLANS нет), спец-годовая цена ---- */
  var PW_MO = {START:1490, PRO:4890, BUSINESS:19900, MAX:27000};   // MAX ~ $300/мес
  var PW_YR = {MAX:90000};                                          // MAX ~ $999/год (годовая выгода)
  function pwMonthly(tier){
    if(typeof PLANS!=='undefined' && PLANS[tier] && PLANS[tier].mo) return PLANS[tier].mo;
    return PW_MO[tier] || 0;
  }
  function pwRub(n){
    if(typeof fmtRub==='function') return fmtRub(n);
    return Number(n||0).toLocaleString('ru-RU').replace(/,/g,' ') + ' ₽';
  }

  /* прописать MAX в ядро, чтобы openPay('MAX')/doPay работали корректно */
  try{
    if(typeof PLANS!=='undefined' && !PLANS.MAX){ PLANS.MAX = {name:'MAX', mo:PW_MO.MAX}; }
  }catch(e){}

  /* ---- выгоды по тарифам для продающего попапа (БЕЗ партнёрки — она отдельно) ---- */
  var PW_BENEFITS = {
    START: [
      {t:'Проверка видео 15/мес', s:'ИИ-разбор хука, рисков и трендов'},
      {t:'Автопостинг в 2 сети', s:'VK и Telegram в один клик'},
      {t:'Файлы до 300 МБ', s:'ролики без лишних сжатий'},
      {t:'Скидка 5% на рекламу', s:'дешевле продвигать посты'}
    ],
    PRO: [
      {t:'Проверка видео — безлимит', s:'сколько угодно роликов и доп.проверок'},
      {t:'Система роста (ИИ)', s:'персональная стратегия и план на 30 дней'},
      {t:'Все соцсети, файлы до 2 ГБ', s:'автопостинг вплоть до 4K'},
      {t:'Скидка 10% + приоритет-поддержка', s:'дешевле реклама, быстрее ответы'}
    ],
    BUSINESS: [
      {t:'Контент-завод под ключ', s:'конвейер роликов автоматически'},
      {t:'Рекламный кабинет PRO', s:'ЦА, ставки, модерация, статистика'},
      {t:'Менеджер и API', s:'персональный менеджер и интеграции'},
      {t:'Скидка 20% на рекламу', s:'масштабируй трафик дешевле'}
    ],
    MAX: [
      {t:'Контент-завод: 30 видео/мес', s:'дальше — оплата за видео, поток без пауз'},
      {t:'Система роста + команда', s:'до 5 мест сотрудников, общий штаб'},
      {t:'Рекламный кабинет PRO + − 30%', s:'самая низкая цена продвижения'},
      {t:'Поддержка 24/7 и API', s:'выделенная линия и интеграции'}
    ]
  };

  /* ---- краткие фичи для карточек тарифов ---- */
  var PW_CARD_FEATS = {
    START:    ['Проверка видео 15/мес','Автопостинг: VK + Telegram','Файлы до 300 МБ','Реклама − 5%'],
    PRO:      ['Проверка видео — безлимит','Система роста (ИИ)','Все соцсети, файлы до 2 ГБ','Реклама − 10% + приоритет'],
    BUSINESS: ['Всё из PRO','Контент-завод под ключ','Рекламный кабинет PRO','Менеджер, API, реклама − 20%'],
    MAX:      ['Всё из BUSINESS','Контент-завод: 30 видео/мес','Команда до 5 мест','Поддержка 24/7, реклама − 30%']
  };
  var PW_TAG = {
    START:'Старт медийности',
    PRO:'Выбор большинства',
    BUSINESS:'Бизнес и команда',
    MAX:'Контент-завод + команда'
  };
  /* короткий ценностный подзаголовок для продающего попапа */
  var PW_SELL_SUB = {
    START:'Первые шаги в медийности — без лишних лимитов.',
    PRO:'Система роста и безлимит — выбор большинства авторов.',
    BUSINESS:'Конвейер контента и рекламный кабинет PRO.',
    MAX:'Контент-завод 30 видео/мес, команда и максимум системы.'
  };
  /* мини-инфографика в попапе: 3 «кольца» [значение-в-центре, подпись, заливка%] */
  var PW_INFO = {
    START:[['+46%','к охватам',46],['15','проверок',80],['2','соцсети',55]],
    PRO:[['88%','продлевают',88],['∞','безлимит',100],['+30','дней плана',75]],
    BUSINESS:[['×5','быстрее',90],['−20%','реклама',80],['PRO','кабинет',100]],
    MAX:[['30','видео/мес',85],['5','мест',70],['−30%','реклама',92]]
  };

  /* ---- фоновые ассеты (data-URI, вшиты) ---- */
  function pwBg(tier){
    return {START:PW_ASSET.start, PRO:PW_ASSET.pro, BUSINESS:PW_ASSET.business, MAX:PW_ASSET.paywallImg}[tier] || PW_ASSET.start;
  }

  /* =================== API-ГЕЙТ =================== */
  window.okoHasSub = function(tier){
    var need = PW_RANK[String(tier||'').toUpperCase()];
    if(need == null) need = 1;
    return pwCurRank() >= need;
  };

  window.okoRequireSub = function(minTier, reason, onOk){
    minTier = String(minTier||'PRO').toUpperCase();
    if(window.okoHasSub(minTier)){ if(typeof onOk==='function') onOk(); return true; }
    pwPaywall({minTier:minTier, reason:reason, onOk:onOk});
    return false;
  };

  /* =================== ПРОДАЮЩИЙ ПОПАП =================== */
  function pwClose(){
    var p = document.getElementById('pwPop');
    if(p){ p.style.animation='pwFade .18s ease reverse forwards'; setTimeout(function(){ if(p.parentNode) p.remove(); },170); }
  }
  window.pwClosePaywall = pwClose;

  function pwRing(display, l, fill){
    var pct = Math.max(0, Math.min(100, Number(fill)||0));
    return '<div class="pw-info-cell"><div class="pw-ring" style="--pwp:'+pct+'"><b>'+display+'</b></div><small>'+l+'</small></div>';
  }

  function pwPaywall(o){
    o = o || {};
    var tier = String(o.minTier||'PRO').toUpperCase();
    if(!PW_BENEFITS[tier]) tier = 'PRO';
    var mo = pwMonthly(tier);
    var perDay = Math.max(1, Math.round(mo/30));
    var sell = !!o.sell;
    var reason = o.reason || ('С подпиской <b>'+tier+'</b> у тебя откроется эта и десятки других возможностей.');
    if(sell && !o.reason) reason = PW_SELL_SUB[tier] || reason;
    var bens = PW_BENEFITS[tier] || PW_BENEFITS.PRO;
    var info = PW_INFO[tier] || PW_INFO.PRO;
    pwClose();
    var el = document.createElement('div');
    el.id = 'pwPop';
    var useVid = tier==='PRO';
    var media = useVid
      ? '<video class="pw-hero-media" autoplay muted loop playsinline poster="'+PW_ASSET.pro+'"><source src="'+PW_ASSET.paywallVid+'" type="video/webm"></video>'
      : '<img class="pw-hero-img" src="'+pwBg(tier)+'" alt="">';
    var infoHtml = '<div class="pw-info">'+ info.map(function(c){ return pwRing(c[0], c[1], c[2]); }).join('') +'</div>';
    var priceLine = (tier==='MAX')
      ? ('<div class="pw-p-v">'+pwRub(mo)+'<small> /мес</small></div>')
      : ('<div class="pw-p-v">'+pwRub(mo)+'<small> /мес</small></div>');
    var priceNote = (tier==='MAX')
      ? ('год '+pwRub(PW_YR.MAX)+'<br>выгода до −72%')
      : ('всего '+pwRub(perDay)+'/день<br>−до 20% на год');
    el.innerHTML =
      '<div class="pw-card">'+
        '<div class="pw-hero">'+ media +
          '<div class="pw-hero-top">'+
            '<div class="pw-lock-badge">'+ (sell ? I('crown') : I('lock')) +'</div>'+
            '<button class="pw-close" aria-label="Закрыть">'+I('plus')+'</button>'+
          '</div>'+
          '<div class="pw-hero-cap"><div class="k">OKO '+(PW_TAG[tier]||'')+'</div><h2>'+(sell?'Тариф ':'Открой ')+tier+'</h2></div>'+
        '</div>'+
        '<div class="pw-body">'+
          '<p class="pw-reason">'+reason+'</p>'+
          infoHtml +
          '<div class="pw-benefits">'+ bens.map(function(b){
            return '<div class="pw-benefit"><span class="pw-b-ic">'+I('check2')+'</span><div><b>'+b.t+'</b><small>'+b.s+'</small></div></div>';
          }).join('') +'</div>'+
          '<div class="pw-price"><div><div class="pw-p-l">Тариф '+tier+'</div>'+
            priceLine+'</div>'+
            '<div class="pw-p-note">'+priceNote+'</div></div>'+
          '<button class="btn pw-cta">'+I('crown')+' Оформить '+tier+'</button>'+
          '<button class="btn ghost pw-later">Может позже</button>'+
          '<div class="pw-guarant">'+I('check')+' Отмена в любой момент · безопасная оплата</div>'+
        '</div>'+
      '</div>';
    el.addEventListener('click', function(e){ if(e.target===el) pwClose(); });
    document.body.appendChild(el);
    var cx = el.querySelector('.pw-close'); if(cx) cx.onclick = pwClose;
    var lt = el.querySelector('.pw-later'); if(lt) lt.onclick = pwClose;
    var ct = el.querySelector('.pw-cta');
    if(ct) ct.onclick = function(){
      pwClose();
      if(typeof openPay==='function') openPay(tier);
      pwSeen();
    };
    /* запуск анимации колец на след. кадре */
    requestAnimationFrame(function(){ if(el.parentNode) el.classList.add('pw-anim'); });
    pwSeen();
  }
  window.pwPaywall = pwPaywall;
  /* открыть продающий попап тарифа из UI (кнопка на карточке) */
  window.pwOpenSell = function(tier){ pwPaywall({minTier:tier, sell:true}); };

  /* =================== ПАРТНЁРКА (ВСЕГДА ОТДЕЛЬНО ОТ ТАРИФА) =================== */
  window.pwPartnerInfo = function(){
    if(typeof showPopup==='function'){
      showPopup({
        ico:'users',
        title:'Партнёрская программа',
        body:'<div class="pw-partner-pop">'+
          '<p>Работает <b>на любом тарифе</b>, даже на FREE — она не входит в подписку, а идёт отдельно.</p>'+
          '<div class="pw-pr"><b>15%</b><span>с каждой продажи по твоей ссылке</span></div>'+
          '<div class="pw-pr"><b>+5%</b><span>с дохода приглашённого партнёра</span></div>'+
          '<div class="pw-pr pw-pr-max"><b>до 20%</b><span>максимальная суммарная комиссия</span></div>'+
          '<p class="dim" style="font-size:12px;margin-top:10px">Выплаты — на лицевой счёт OKO. Статистика переходов и начислений — в реальном времени.</p>'+
        '</div>',
        actions:[{label:'Скопировать ссылку', onclick:function(){
          var link = 'https://oko.app/i/'+((typeof PROFILE!=='undefined'&&PROFILE.nick)?PROFILE.nick:'ref');
          try{ if(navigator.clipboard) navigator.clipboard.writeText(link); }catch(e){}
          if(typeof toast==='function') toast('Ссылка скопирована: '+link);
        }},{label:'Понятно', ghost:true}]
      });
    } else if(typeof toast==='function'){
      toast('Партнёрка: 15% с продаж + 5% с партнёра (до 20%)');
    }
  };

  /* =================== СЕССИОННЫЙ ФЛАГ (ambient-триггеры) =================== */
  function pwSeen(){ try{ sessionStorage.setItem('oko-paywall-seen','1'); }catch(e){} }
  function pwWasSeen(){ try{ return sessionStorage.getItem('oko-paywall-seen')==='1'; }catch(e){ return false; } }

  function pwTrigger(o){
    o = o || {};
    if(pwWasSeen()) return false;
    if(window.okoHasSub(o.minTier||'PRO')) return false;
    pwPaywall(o);
    return true;
  }
  window.okoPaywallTrigger = pwTrigger;

  function pwNudge(o){
    o = o || {};
    if(pwWasSeen() || document.getElementById('pwNudge')) return false;
    if(window.okoHasSub(o.minTier||'PRO')) return false;
    var n = document.createElement('div');
    n.id = 'pwNudge';
    n.innerHTML =
      '<span class="pw-n-ic">'+I('crown')+'</span>'+
      '<div class="pw-n-tx"><b>'+(o.title||'Открой больше с '+(o.minTier||'PRO'))+'</b><small>'+(o.text||'')+'</small></div>'+
      '<button class="pw-n-go">'+(o.cta||'Смотреть')+'</button>'+
      '<button class="pw-n-x" aria-label="Скрыть">'+I('plus')+'</button>';
    document.body.appendChild(n);
    function drop(){ n.classList.add('pw-out'); setTimeout(function(){ if(n.parentNode) n.remove(); },300); }
    var nx = n.querySelector('.pw-n-x'); if(nx) nx.onclick = function(){ drop(); pwSeen(); };
    var ng = n.querySelector('.pw-n-go'); if(ng) ng.onclick = function(){ drop(); pwPaywall({minTier:o.minTier||'PRO', reason:o.reason, sell:true}); };
    setTimeout(function(){ if(n.parentNode){ drop(); } }, 8000);
    pwSeen();
    return true;
  }
  window.okoPaywallNudge = pwNudge;

  /* =================== ЛОКИ НА МИНИ-АППАХ =================== */
  var PW_MA_GATE = {
    factory: {tier:'BUSINESS', label:'BUSINESS', reason:'<b>Контент-завод</b> собирает ролики на конвейере. Доступен с тарифа BUSINESS, а 30 видео/мес — на MAX.'},
    system:  {tier:'PRO',      label:'PRO',      reason:'<b>Система роста</b> строит персональную стратегию и план на 30 дней. Доступно с тарифа PRO.'}
  };

  function pwDecorateTiles(){
    var grid = document.getElementById('maGrid');
    if(!grid) return;
    grid.querySelectorAll('.svc').forEach(function(btn){
      var oc = btn.getAttribute('onclick')||'';
      var m = oc.match(/openMa\(['"](\w+)['"]\)/);
      if(!m) return;
      var id = m[1], g = PW_MA_GATE[id];
      if(!g) return;
      var locked = !window.okoHasSub(g.tier);
      btn.classList.toggle('pw-locked', locked);
      var lock = btn.querySelector('.pw-lock');
      if(locked){
        if(!lock){ lock=document.createElement('span'); lock.className='pw-lock'; btn.appendChild(lock); }
        lock.innerHTML = I('lock') + '<i>' + g.label + '</i>';
      } else {
        if(lock) lock.remove();
      }
    });
  }
  window.pwRefreshLocks = pwDecorateTiles;

  if(typeof openMa==='function'){
    var _pwPrevOpenMa = openMa;
    openMa = function(id){
      var g = PW_MA_GATE[id];
      if(g && !window.okoHasSub(g.tier)){
        window.okoRequireSub(g.tier, g.reason, function(){ _pwPrevOpenMa(id); });
        return;
      }
      return _pwPrevOpenMa(id);
    };
  }

  /* =================== ТРИГГЕР: лимит проверок видео =================== */
  var PW_FREE_CHECKS = 3;
  function pwChecksKey(){ var d=new Date(); return 'oko-pw-checks-'+d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
  function pwChecksUsed(){ try{ return parseInt(localStorage.getItem(pwChecksKey())||'0',10)||0; }catch(e){ return 0; } }
  function pwChecksInc(){ try{ localStorage.setItem(pwChecksKey(), String(pwChecksUsed()+1)); }catch(e){} }

  if(typeof vcStart==='function'){
    var _pwPrevVcStart = vcStart;
    vcStart = function(){
      if(!window.okoHasSub('PRO')){
        if(pwChecksUsed() >= PW_FREE_CHECKS){
          pwPaywall({minTier:'PRO',
            reason:'Ты исчерпал <b>'+PW_FREE_CHECKS+' бесплатные проверки</b> на сегодня. С тарифом PRO проверки роликов — без лимита.'});
          return;
        }
        pwChecksInc();
      }
      return _pwPrevVcStart.apply(this, arguments);
    };
  }

  /* =================== ТРИГГЕР: большой файл =================== */
  window.okoRequireSubForFile = function(sizeMB, minTier, onOk){
    minTier = String(minTier||'PRO').toUpperCase();
    var limit = window.okoHasSub('MAX') ? 8192
              : window.okoHasSub('BUSINESS') ? 4096
              : window.okoHasSub('PRO') ? 2048
              : window.okoHasSub('START') ? 300 : 100;
    if(sizeMB > limit && !window.okoHasSub(minTier)){
      var cap = (minTier==='MAX'?'8 ГБ':minTier==='BUSINESS'?'4 ГБ':'2 ГБ');
      pwPaywall({minTier:minTier,
        reason:'Файл <b>'+sizeMB+' МБ</b> превышает лимит '+limit+' МБ твоего тарифа. С <b>'+minTier+'</b> загружай ролики до '+cap+' и 4K.'});
      return false;
    }
    if(typeof onOk==='function') onOk();
    return true;
  };

  function pwInjectBigFile(){
    var up = document.getElementById('vcUpload');
    if(!up || document.getElementById('pwBigFileBtn')) return;
    var b = document.createElement('button');
    b.id = 'pwBigFileBtn';
    b.className = 'btn ghost';
    b.style.marginTop = '9px';
    b.innerHTML = I('file')+' Загрузить 4K-ролик (420 МБ)';
    b.onclick = function(){
      window.okoRequireSubForFile(420, 'PRO', function(){
        if(typeof vcStart==='function') vcStart();
      });
    };
    up.appendChild(b);
  }

  /* =================== РЕДИЗАЙН ТАРИФОВ: chain-патч renderPay =================== */
  var _pwPrevRenderPay = (typeof renderPay==='function') ? renderPay : null;
  window._pwPrevRenderPay = _pwPrevRenderPay;

  var pwCmpOpen = false;
  window.pwToggleCmp = function(btn){
    pwCmpOpen = !pwCmpOpen;
    renderPay();
  };
  window.pwSelectTier = function(tier){
    if(typeof payState==='undefined') return;
    payState.plan = tier;
    renderPay();
  };

  /* сравнительная таблица: FREE / START / PRO / BUSINESS / MAX (партнёрки тут НЕТ) */
  var PW_CMP_ROWS = [
    {k:'Проверка видео (ИИ)', vals:['3/день','15/мес','безлимит','безлимит','безлимит']},
    {k:'Загрузка файла', vals:['100 МБ','300 МБ','2 ГБ','4 ГБ','8 ГБ']},
    {k:'Автопостинг', vals:['no','2 сети','все сети','все + план','все + очередь']},
    {k:'Система роста (ИИ)', vals:['no','no','yes','yes','yes']},
    {k:'Контент-завод', vals:['no','no','no','конвейер','30 видео/мес']},
    {k:'Рекламный кабинет', vals:['база','база','расшир.','PRO','PRO + команда']},
    {k:'Скидка на рекламу', vals:['0%','5%','10%','20%','30%']},
    {k:'Команда / места', vals:['no','no','no','no','до 5']},
    {k:'Менеджер и API', vals:['no','no','no','yes','yes']},
    {k:'Поддержка', vals:['общая','общая','приоритет','приоритет','24/7']}
  ];
  function pwCmpCell(v, isPro){
    var cls = isPro ? ' pw-c-pro-cell' : '';
    if(v==='yes') return '<td class="pw-yes'+cls+'">'+I('check2')+'</td>';
    if(v==='no')  return '<td class="pw-no'+cls+'">—</td>';
    return '<td class="pw-val'+cls+'">'+v+'</td>';
  }

  function pwLiveNumbers(){
    var base = Math.floor(Date.now()/9000);
    var joined = 2400 + (base % 60);
    var pct = 92 + (base % 6);
    var avg = 34 + (base % 5);
    return [
      {v: (joined).toLocaleString('ru-RU').replace(/,/g,' '), l:'на платных тарифах'},
      {v: pct+'%', l:'продлевают PRO'},
      {v: '+'+avg+'%', l:'к охватам за мес'}
    ];
  }

  function pwRenderPay(){
    var view = document.getElementById('payView');
    if(!view) return;
    if(typeof payState==='undefined' || typeof PAY_PERIODS==='undefined'){
      if(_pwPrevRenderPay) return _pwPrevRenderPay(); return;
    }
    if(!payState.plan || PW_RANK[payState.plan]==null) payState.plan = 'PRO';
    var sel = payState.plan;
    var per = PAY_PERIODS.find(function(x){return x[0]===payState.period;}) || PAY_PERIODS[PAY_PERIODS.length-1];
    var disc = per[2];

    var tiersHtml = PW_ORDER.map(function(tier){
      var mo = pwMonthly(tier);
      var isPro = tier==='PRO';
      var isMax = tier==='MAX';
      var on = sel===tier;
      var perDay = Math.max(1, Math.round(mo/30));
      var media = isPro
        ? '<video class="pw-tier-vid" autoplay muted loop playsinline poster="'+PW_ASSET.pro+'"><source src="'+PW_ASSET.paywallVid+'" type="video/webm"></video>'
        : '<img class="pw-tier-im" src="'+pwBg(tier)+'" alt="">';
      var flag = isPro ? '<span class="pw-flag">Флагман</span>'
               : isMax ? '<span class="pw-flag pw-flag-max">MAX</span>' : '';
      return ''+
      '<div class="pw-tier'+(on?' on':'')+(isMax?' pw-tier-max':'')+'" onclick="pwSelectTier(\''+tier+'\')">'+
        '<div class="pw-tier-bg">'+ media + flag +
          '<span class="pw-tier-sel">'+I('check2')+'</span>'+
          '<div class="pw-tier-cap"><div class="n">'+tier+'</div><div class="s">'+(PW_TAG[tier]||'')+'</div></div>'+
        '</div>'+
        '<div class="pw-tier-price"><b>'+pwRub(mo)+'</b><span>/мес</span><span class="pw-perday">'+pwRub(perDay)+'/день</span></div>'+
        '<ul class="pw-tier-feats">'+ (PW_CARD_FEATS[tier]||[]).map(function(f){
          return '<li>'+I('check2')+'<span>'+f+'</span></li>';
        }).join('') +'</ul>'+
        '<button class="pw-tier-more" onclick="event.stopPropagation();pwOpenSell(\''+tier+'\')">'+I('eye')+' Что входит</button>'+
      '</div>';
    }).join('');

    var periodsHtml = PAY_PERIODS.map(function(p){
      var m=p[0], l=p[1], d=p[2];
      return '<button class="pay-per'+(payState.period===m?' on':'')+'" onclick="payState.period='+m+';renderPay()">'+
        '<span>'+l+'</span>'+(d?'<i class="pay-disc">−'+d+'%</i>':'')+'</button>';
    }).join('');

    /* цена выбранного (MAX/год — спец-цена) */
    var full, total;
    if(sel==='MAX' && payState.period===12){
      full = pwMonthly('MAX')*12; total = PW_YR.MAX;
    } else {
      full = pwMonthly(sel) * per[0];
      total = Math.round(full * (1 - disc/100));
    }
    var effDisc = full>0 ? Math.round((1 - total/full)*100) : 0;

    var live = pwLiveNumbers();
    var liveHtml = '<div class="pw-live">'+live.map(function(c){
      return '<div class="pw-live-cell"><div class="v">'+c.v+'</div><div class="l">'+c.l+'</div></div>';
    }).join('')+'</div>';

    var cmpHtml = '';
    if(pwCmpOpen){
      cmpHtml =
      '<div class="pw-cmp-wrap"><table class="pw-cmp">'+
        '<thead><tr><th></th><th>FREE</th><th>START</th><th class="pw-c-pro">PRO</th><th>BUSINESS</th><th class="pw-c-max">MAX</th></tr></thead>'+
        '<tbody>'+ PW_CMP_ROWS.map(function(r){
          return '<tr><th>'+r.k+'</th>'+
            pwCmpCell(r.vals[0],false)+pwCmpCell(r.vals[1],false)+pwCmpCell(r.vals[2],true)+pwCmpCell(r.vals[3],false)+pwCmpCell(r.vals[4],false)+
          '</tr>';
        }).join('') +'</tbody>'+
      '</table></div>';
    }

    /* партнёрка и реклама — отдельными блоками (не входят в тариф) */
    var partnerHtml =
      '<div class="pw-partner">'+
        '<div class="pw-partner-h"><span class="pw-partner-ic">'+I('users')+'</span>'+
          '<div><b>Партнёрская программа</b><small>Отдельно от тарифа — доступна всем, даже на FREE</small></div></div>'+
        '<div class="pw-partner-rows">'+
          '<div class="pw-pr"><b>15%</b><span>с каждой продажи по твоей ссылке</span></div>'+
          '<div class="pw-pr"><b>+5%</b><span>с дохода приглашённого партнёра</span></div>'+
          '<div class="pw-pr pw-pr-max"><b>до 20%</b><span>максимальная суммарная комиссия</span></div>'+
        '</div>'+
        '<button class="pw-partner-cta" onclick="pwPartnerInfo()">'+I('rocket')+' Стать партнёром</button>'+
      '</div>';

    var adsHtml =
      '<div class="pw-ads-note">'+
        '<span class="pw-ads-ic">'+I('megaphone')+'</span>'+
        '<div><b>Реклама — на любом тарифе</b>'+
          '<small>Доступна даже на FREE. Чем выше тариф — тем дешевле продвижение: до −30% на MAX.</small></div>'+
      '</div>';

    view.innerHTML =
      '<div class="pw-pay-head"><h3>Тарифы OKO</h3><p>Выбери уровень — активация мгновенно</p></div>'+
      liveHtml +
      '<div class="pw-tiers">'+ tiersHtml +'</div>'+
      '<button class="pw-cmp-toggle'+(pwCmpOpen?' on':'')+'" onclick="pwToggleCmp(this)">'+I('poll')+' Сравнить тарифы '+I('chev')+'</button>'+
      cmpHtml +
      adsHtml +
      partnerHtml +
      '<p style="font-weight:700;font-size:13px;margin:2px 0 8px">Период оплаты</p>'+
      '<div class="pay-periods">'+ periodsHtml +'</div>'+
      '<div class="pay-total"><div><div class="dim" style="font-size:12px">К оплате · '+sel+'</div>'+
        '<div class="pay-sum">'+pwRub(total)+'</div></div>'+
        (effDisc>0?'<div class="pay-old">'+pwRub(full)+'</div>':'')+'</div>'+
      '<p style="font-weight:600;font-size:13px;margin:14px 0 8px">Способ оплаты</p>'+
      '<div class="pay-methods">'+ (typeof PAY_METHODS!=='undefined'?PAY_METHODS:[['card','Карта РФ','card']]).map(function(pm){
        return '<button class="pay-m'+(payState.method===pm[0]?' on':'')+'" onclick="payState.method=\''+pm[0]+'\';renderPay()">'+I(pm[2])+'<span>'+pm[1]+'</span></button>';
      }).join('') +'</div>'+
      '<div style="height:16px"></div>'+
      '<button class="btn" onclick="doPay()">'+I('lock')+' Оплатить '+pwRub(total)+'</button>'+
      '<p class="dim" style="font-size:11px;text-align:center;margin-top:9px">Безопасная оплата. Автопродление можно отключить в любой момент.</p>';
  }

  if(_pwPrevRenderPay){
    renderPay = pwRenderPay;
  }

  /* =================== САМОИНИЦИАЛИЗАЦИЯ =================== */
  function pwInit(){
    pwDecorateTiles();
    pwInjectBigFile();
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', pwInit);
  else pwInit();

  var _pwPrevRMP = (typeof renderMyProfile==='function') ? renderMyProfile : null;
  if(_pwPrevRMP){
    renderMyProfile = function(){ var r=_pwPrevRMP.apply(this,arguments); try{ pwDecorateTiles(); }catch(e){} return r; };
  }

  var _pwPrevShowTab = (typeof showTab==='function') ? showTab : null;
  if(_pwPrevShowTab){
    showTab = function(tab){
      var r = _pwPrevShowTab.apply(this, arguments);
      if(tab==='mini'){
        try{ pwDecorateTiles(); }catch(e){}
        setTimeout(function(){
          pwNudge({minTier:'PRO',
            title:'С PRO у тебя был бы доступ',
            text:'К Системе роста, безлимитным проверкам и автопостингу',
            cta:'Открыть'});
        }, 1400);
      }
      return r;
    };
  }

})();
