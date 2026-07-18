/* ============ PAYWALL (pw-) — API-гейт, локи, триггеры, редизайн тарифов ============ */
(function(){
  'use strict';

  /* ---- иерархия тарифов ---- */
  var PW_RANK = {FREE:0, START:1, PRO:2, BUSINESS:3};
  var PW_ORDER = ['START','PRO','BUSINESS'];
  function pwCurRank(){
    if(typeof isOwner==='function' && isOwner()) return 99;
    var t = (PROFILE && PROFILE.tier ? String(PROFILE.tier).toUpperCase() : 'FREE');
    return PW_RANK[t] != null ? PW_RANK[t] : 0;
  }

  /* ---- цена тарифа/мес (fallback если PLANS нет) ---- */
  var PW_MO = {START:1490, PRO:4890, BUSINESS:19900};
  function pwMonthly(tier){
    if(typeof PLANS!=='undefined' && PLANS[tier] && PLANS[tier].mo) return PLANS[tier].mo;
    return PW_MO[tier] || 0;
  }
  function pwRub(n){
    if(typeof fmtRub==='function') return fmtRub(n);
    return n.toLocaleString('ru-RU').replace(/,/g,' ') + ' ₽';
  }

  /* ---- выгоды/фичи по тарифам ---- */
  var PW_BENEFITS = {
    START: [
      {t:'Проверка видео 15/мес', s:'ИИ-разбор хука, рисков и трендов'},
      {t:'Автопостинг в 2 сети', s:'VK и Telegram в один клик'},
      {t:'Биржа услуг и партнёрка 20%', s:'зарабатывай внутри OKO'},
      {t:'Загрузка файлов до 300 МБ', s:'ролики без лишних сжатий'}
    ],
    PRO: [
      {t:'Проверка видео — безлимит', s:'сколько угодно роликов и доп.проверок'},
      {t:'Система роста (ИИ)', s:'персональная стратегия и план на 30 дней'},
      {t:'Автопостинг во все сети', s:'файлы до 2 ГБ, вплоть до 4K'},
      {t:'Партнёрка 35% и приоритет-поддержка', s:'больше дохода, быстрее ответы'}
    ],
    BUSINESS: [
      {t:'Контент-завод под ключ', s:'конвейер роликов 5+/нед автоматически'},
      {t:'Рекламный кабинет PRO', s:'ЦА, ставки, модерация, статистика'},
      {t:'Персональный менеджер и API', s:'команда и интеграции под тебя'},
      {t:'Партнёрка 50% — максимум', s:'самая высокая комиссия в OKO'}
    ]
  };

  /* ---- карта фич для карточек тарифов ---- */
  var PW_CARD_FEATS = {
    START:    ['Проверка видео 15/мес','Автопостинг: VK + Telegram','Биржа услуг и партнёрка 20%','Файлы до 300 МБ'],
    PRO:      ['Проверка видео — безлимит','Система роста (ИИ)','Все соцсети, файлы до 2 ГБ','Партнёрка 35% + приоритет'],
    BUSINESS: ['Всё из PRO','Контент-завод под ключ','Рекламный кабинет PRO','Менеджер, API, партнёрка 50%']
  };
  var PW_TAG = {START:'Старт медийности', PRO:'Выбор большинства', BUSINESS:'Полный конвейер'};

  /* ---- ассеты (data-URI, вшиты) ---- */
  function pwBg(tier){
    return {START:PW_ASSET.start, PRO:PW_ASSET.pro, BUSINESS:PW_ASSET.business}[tier] || PW_ASSET.start;
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

  /* =================== ПАВОЛЛ-ПОПАП =================== */
  function pwClose(){
    var p = document.getElementById('pwPop');
    if(p){ p.style.animation='pwFade .18s ease reverse forwards'; setTimeout(function(){ if(p.parentNode) p.remove(); },170); }
  }
  window.pwClosePaywall = pwClose;

  function pwPaywall(o){
    o = o || {};
    var tier = String(o.minTier||'PRO').toUpperCase();
    var mo = pwMonthly(tier);
    var perDay = Math.round(mo/30);
    var reason = o.reason || ('С подпиской <b>'+tier+'</b> у тебя откроется эта и десятки других возможностей.');
    var bens = PW_BENEFITS[tier] || PW_BENEFITS.PRO;
    pwClose();
    var el = document.createElement('div');
    el.id = 'pwPop';
    var useVid = tier==='PRO';
    var media = useVid
      ? '<video class="pw-hero-media" autoplay muted loop playsinline poster="'+PW_ASSET.pro+'"><source src="'+PW_ASSET.paywallVid+'" type="video/webm"></video>'
      : '<img class="pw-hero-img" src="'+pwBg(tier)+'" alt="">';
    el.innerHTML =
      '<div class="pw-card">'+
        '<div class="pw-hero">'+ media +
          '<div class="pw-hero-top">'+
            '<div class="pw-lock-badge">'+I('lock')+'</div>'+
            '<button class="pw-close" aria-label="Закрыть">'+I('plus')+'</button>'+
          '</div>'+
          '<div class="pw-hero-cap"><div class="k">OKO '+(PW_TAG[tier]||'')+'</div><h2>Открой '+tier+'</h2></div>'+
        '</div>'+
        '<div class="pw-body">'+
          '<p class="pw-reason">'+reason+'</p>'+
          '<div class="pw-benefits">'+ bens.map(function(b){
            return '<div class="pw-benefit"><span class="pw-b-ic">'+I('check2')+'</span><div><b>'+b.t+'</b><small>'+b.s+'</small></div></div>';
          }).join('') +'</div>'+
          '<div class="pw-price"><div><div class="pw-p-l">Тариф '+tier+'</div>'+
            '<div class="pw-p-v">'+pwRub(mo)+'<small> /мес</small></div></div>'+
            '<div class="pw-p-note">всего '+pwRub(perDay)+'/день<br>−до 20% на год</div></div>'+
          '<button class="btn pw-cta">'+I('crown')+' Оформить '+tier+'</button>'+
          '<button class="btn ghost pw-later">Может позже</button>'+
          '<div class="pw-guarant">'+I('check')+' Отмена в любой момент · безопасная оплата</div>'+
        '</div>'+
      '</div>';
    el.addEventListener('click', function(e){ if(e.target===el) pwClose(); });
    document.body.appendChild(el);
    el.querySelector('.pw-close').onclick = pwClose;
    el.querySelector('.pw-later').onclick = pwClose;
    el.querySelector('.pw-cta').onclick = function(){
      pwClose();
      if(typeof openPay==='function') openPay(tier);
      pwSeen(); // явный интерес — не долбить ambient-триггером
    };
    pwSeen();
  }
  window.pwPaywall = pwPaywall;

  /* =================== СЕССИОННЫЙ ФЛАГ (ambient-триггеры) =================== */
  function pwSeen(){ try{ sessionStorage.setItem('oko-paywall-seen','1'); }catch(e){} }
  function pwWasSeen(){ try{ return sessionStorage.getItem('oko-paywall-seen')==='1'; }catch(e){ return false; } }

  /* ambient-триггер: не чаще раза в сессию, только для тех, у кого нет PRO+ */
  function pwTrigger(o){
    if(pwWasSeen()) return false;
    if(window.okoHasSub(o.minTier||'PRO')) return false;
    pwPaywall(o);
    return true;
  }
  window.okoPaywallTrigger = pwTrigger;

  /* мягкий баннер-намёк (не блокирующий), тоже раз в сессию */
  function pwNudge(o){
    if(pwWasSeen() || document.getElementById('pwNudge')) return false;
    if(window.okoHasSub(o.minTier||'PRO')) return false;
    var n = document.createElement('div');
    n.id = 'pwNudge';
    n.innerHTML =
      '<span class="pw-n-ic">'+I('crown')+'</span>'+
      '<div class="pw-n-tx"><b>'+(o.title||'Открой больше с '+(o.minTier||'PRO')+'')+'</b><small>'+(o.text||'')+'</small></div>'+
      '<button class="pw-n-go">'+(o.cta||'Смотреть')+'</button>'+
      '<button class="pw-n-x" aria-label="Скрыть">'+I('plus')+'</button>';
    document.body.appendChild(n);
    function drop(){ n.classList.add('pw-out'); setTimeout(function(){ if(n.parentNode) n.remove(); },300); }
    n.querySelector('.pw-n-x').onclick = function(){ drop(); pwSeen(); };
    n.querySelector('.pw-n-go').onclick = function(){ drop(); pwPaywall({minTier:o.minTier||'PRO', reason:o.reason}); };
    setTimeout(function(){ if(n.parentNode){ drop(); } }, 8000);
    pwSeen();
    return true;
  }
  window.okoPaywallNudge = pwNudge;

  /* =================== ЛОКИ НА МИНИ-АППАХ =================== */
  /* какие сервисы гейтятся и на каком тарифе */
  var PW_MA_GATE = {
    factory: {tier:'BUSINESS', label:'BUSINESS', reason:'<b>Контент-завод</b> собирает ролики под ключ на конвейере. Доступен на тарифе BUSINESS.'},
    system:  {tier:'PRO',      label:'PRO',      reason:'<b>Система роста</b> строит персональную стратегию и план на 30 дней. Доступно с тарифа PRO.'}
  };

  /* чип-тайтл тарифа для тайла */
  function pwTileTier(id){ var g = PW_MA_GATE[id]; return g ? g.label : null; }

  /* навесить замочки на тайлы #maGrid по их onclick=openMa('id') */
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

  /* гейт входа в мини-апп через chain-патч openMa */
  if(typeof openMa==='function'){
    var _pwPrevOpenMa = openMa;
    openMa = function(id){
      var g = PW_MA_GATE[id];
      if(g && !window.okoHasSub(g.tier)){
        window.okoRequireSub(g.tier, g.reason, function(){ _pwPrevOpenMa(id); });
        return;
      }
      _pwPrevOpenMa(id);
    };
  }

  /* =================== ТРИГГЕР: лимит проверок видео =================== */
  var PW_FREE_CHECKS = 3;               // бесплатных проверок/сутки без PRO
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

  /* =================== ТРИГГЕР: большой файл (>300 МБ) =================== */
  /* глобальный гейт под любую загрузку крупного файла */
  window.okoRequireSubForFile = function(sizeMB, minTier, onOk){
    minTier = String(minTier||'PRO').toUpperCase();
    var limit = window.okoHasSub('PRO') ? 4096 : (window.okoHasSub('START') ? 300 : 100);
    if(sizeMB > limit && !window.okoHasSub(minTier)){
      pwPaywall({minTier:minTier,
        reason:'Файл <b>'+sizeMB+' МБ</b> превышает лимит '+limit+' МБ твоего тарифа. С <b>'+minTier+'</b> загружай ролики до '+(minTier==='PRO'?'2 ГБ':'4 ГБ')+' и 4K.'});
      return false;
    }
    if(typeof onOk==='function') onOk();
    return true;
  };

  /* демо-кнопка «большой 4K-ролик» в карточке проверки видео */
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

  /* сравнительная таблица */
  var PW_CMP_ROWS = [
    {k:'Проверка видео', vals:['3/день','15/мес','безлимит','безлимит']},
    {k:'Автопостинг', vals:['no','2 сети','все','все']},
    {k:'Лимит файла', vals:['100 МБ','300 МБ','2 ГБ','4 ГБ']},
    {k:'Система роста (ИИ)', vals:['no','no','yes','yes']},
    {k:'Контент-завод', vals:['no','no','no','yes']},
    {k:'Рекламный кабинет', vals:['no','no','база','PRO']},
    {k:'Партнёрка', vals:['10%','20%','35%','50%']},
    {k:'Поддержка', vals:['общая','общая','приоритет','менеджер']}
  ];
  function pwCmpCell(v, isPro){
    var cls = isPro ? ' pw-c-pro-cell' : '';
    if(v==='yes') return '<td class="pw-yes'+cls+'">'+I('check2')+'</td>';
    if(v==='no')  return '<td class="pw-no'+cls+'">—</td>';
    return '<td class="pw-val'+cls+'">'+v+'</td>';
  }

  function pwLiveNumbers(){
    // «живые» цифры воронки — чуть колышутся, детерминированно от времени
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
    var sel = payState.plan;
    var per = PAY_PERIODS.find(function(x){return x[0]===payState.period;}) || PAY_PERIODS[PAY_PERIODS.length-1];
    var disc = per[2];

    var tiersHtml = PW_ORDER.map(function(tier){
      var mo = pwMonthly(tier);
      var isPro = tier==='PRO';
      var on = sel===tier;
      var perDay = Math.round(mo/30);
      var bgTier = tier;
      var media = isPro
        ? '<video class="pw-tier-vid" autoplay muted loop playsinline poster="'+PW_ASSET.pro+'"><source src="'+PW_ASSET.paywallVid+'" type="video/webm"></video>'
        : '<img class="pw-tier-im" src="'+pwBg(bgTier)+'" alt="">';
      return ''+
      '<div class="pw-tier'+(on?' on':'')+'" onclick="pwSelectTier(\''+tier+'\')">'+
        '<div class="pw-tier-bg">'+ media +
          (isPro?'<span class="pw-flag">Флагман</span>':'')+
          '<span class="pw-tier-sel">'+I('check2')+'</span>'+
          '<div class="pw-tier-cap"><div class="n">'+tier+'</div><div class="s">'+(PW_TAG[tier]||'')+'</div></div>'+
        '</div>'+
        '<div class="pw-tier-price"><b>'+pwRub(mo)+'</b><span>/мес</span><span class="pw-perday">'+pwRub(perDay)+'/день</span></div>'+
        '<ul class="pw-tier-feats">'+ (PW_CARD_FEATS[tier]||[]).map(function(f){
          return '<li>'+I('check2')+'<span>'+f+'</span></li>';
        }).join('') +'</ul>'+
      '</div>';
    }).join('');

    var periodsHtml = PAY_PERIODS.map(function(p){
      var m=p[0], l=p[1], d=p[2];
      return '<button class="pay-per'+(payState.period===m?' on':'')+'" onclick="payState.period='+m+';renderPay()">'+
        '<span>'+l+'</span>'+(d?'<i class="pay-disc">−'+d+'%</i>':'')+'</button>';
    }).join('');

    // цена выбранного
    var full = pwMonthly(sel) * per[0];
    var total = Math.round(full * (1 - disc/100));

    var live = pwLiveNumbers();
    var liveHtml = '<div class="pw-live">'+live.map(function(c){
      return '<div class="pw-live-cell"><div class="v">'+c.v+'</div><div class="l">'+c.l+'</div></div>';
    }).join('')+'</div>';

    var cmpHtml = '';
    if(pwCmpOpen){
      cmpHtml =
      '<div class="pw-cmp-wrap"><table class="pw-cmp">'+
        '<thead><tr><th></th><th>FREE</th><th>START</th><th class="pw-c-pro">PRO</th><th>BUSINESS</th></tr></thead>'+
        '<tbody>'+ PW_CMP_ROWS.map(function(r){
          return '<tr><th>'+r.k+'</th>'+
            pwCmpCell(r.vals[0],false)+pwCmpCell(r.vals[1],false)+pwCmpCell(r.vals[2],true)+pwCmpCell(r.vals[3],false)+
          '</tr>';
        }).join('') +'</tbody>'+
      '</table></div>';
    }

    view.innerHTML =
      '<div class="pw-pay-head"><h3>Тарифы OKO</h3><p>Выбери уровень — активация мгновенно</p></div>'+
      liveHtml +
      '<div class="pw-tiers">'+ tiersHtml +'</div>'+
      '<button class="pw-cmp-toggle'+(pwCmpOpen?' on':'')+'" onclick="pwToggleCmp(this)">'+I('poll')+' Сравнить тарифы '+I('chev')+'</button>'+
      cmpHtml +
      '<p style="font-weight:700;font-size:13px;margin:2px 0 8px">Период оплаты</p>'+
      '<div class="pay-periods">'+ periodsHtml +'</div>'+
      '<div class="pay-total"><div><div class="dim" style="font-size:12px">К оплате · '+sel+'</div>'+
        '<div class="pay-sum">'+pwRub(total)+'</div></div>'+
        (disc?'<div class="pay-old">'+pwRub(full)+'</div>':'')+'</div>'+
      '<p style="font-weight:600;font-size:13px;margin:14px 0 8px">Способ оплаты</p>'+
      '<div class="pay-methods">'+ (typeof PAY_METHODS!=='undefined'?PAY_METHODS:[['card','Карта РФ','card']]).map(function(pm){
        return '<button class="pay-m'+(payState.method===pm[0]?' on':'')+'" onclick="payState.method=\''+pm[0]+'\';renderPay()">'+I(pm[2])+'<span>'+pm[1]+'</span></button>';
      }).join('') +'</div>'+
      '<div style="height:16px"></div>'+
      '<button class="btn" onclick="doPay()">'+I('lock')+' Оплатить '+pwRub(total)+'</button>'+
      '<p class="dim" style="font-size:11px;text-align:center;margin-top:9px">Безопасная оплата. Автопродление можно отключить в любой момент.</p>';
  }

  /* активируем патч только если базовый renderPay существовал */
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

  /* при смене профиля/тарифа — обновить локи */
  var _pwPrevRMP = (typeof renderMyProfile==='function') ? renderMyProfile : null;
  if(_pwPrevRMP){
    renderMyProfile = function(){ var r=_pwPrevRMP.apply(this,arguments); try{ pwDecorateTiles(); }catch(e){} return r; };
  }

  /* ambient-намёк: когда free/START заходит в хаб мини-аппов — мягкий баннер (раз в сессию) */
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
