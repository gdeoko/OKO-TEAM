<?php
/** Telegram Mini App: компактный кабинет/витрина. Автологин по initData. */

$u = current_user();
$comps = all("SELECT slug, name, type, status FROM competitions WHERE status IN('open','judging') ORDER BY sort LIMIT 6");
$apps = $diplomas = $orders = [];
if ($u) {
    $uid = (int)$u['id'];
    $apps = all("SELECT a.status, a.result, a.number, c.name AS comp_name
                 FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id
                 WHERE a.user_id=? ORDER BY a.created_at DESC LIMIT 12", [$uid]);
    $diplomas = all("SELECT d.number, d.result AS d_result, a.result AS a_result, c.name AS comp_name
                     FROM diplomas d JOIN applications a ON a.id=d.application_id
                     LEFT JOIN competitions c ON c.id=a.competition_id
                     WHERE a.user_id=? ORDER BY d.created_at DESC LIMIT 12", [$uid]);
    $orders = all("SELECT items, status, tracking FROM awards_orders WHERE user_id=? ORDER BY created_at DESC LIMIT 12", [$uid]);
}
$appStatus = ['new'=>'Новая','paid'=>'Оплачена','judging'=>'На оценке','graded'=>'Оценена','sent'=>'Диплом отправлен','rejected'=>'Отклонена'];
$orderStatus = ['new'=>'Оформлен','paid'=>'Оплачен','shipped'=>'Отправлен','delivered'=>'Доставлен'];
$BASE = rtrim(cfgv('base_url'), '/');
$appsCount = count($apps);
$dipCount  = count($diplomas);
?><!doctype html>
<html lang="ru">
<head>
<script>document.documentElement.dataset.theme=(function(){try{var tg=window.Telegram&&window.Telegram.WebApp;if(tg&&tg.colorScheme)return tg.colorScheme;}catch(e){}return (window.matchMedia&&matchMedia('(prefers-color-scheme: light)').matches)?'light':'dark';})();</script>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0b0a0d">
<title>КЦ «Музыкальный Мир»</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
:root{--bg:#0b0a0d;--bg-2:#121016;--panel:rgba(30,26,20,.6);--glass:rgba(28,24,18,.65);--glass-brd:rgba(201,168,76,.22);
  --gold:#E8C25A;--gold-2:#C9A84C;--gold-soft:rgba(232,194,90,.14);
  --text:#F3ECDA;--text-dim:#b8ad93;--muted:#8b8069;--line:rgba(201,168,76,.16);
  --mint:#8FBC94;--error:#E27B7B;--radius:16px;--radius-sm:12px;
  --grad-gold:linear-gradient(135deg,#F3D57C 0%,#E8C25A 40%,#B98F2E 100%);
  --ff-serif:"Cormorant Garamond",Georgia,serif;--ff-body:"Manrope",system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
  --nav-h:60px;color-scheme:dark}
:root[data-theme="light"]{--bg:#FFFCF5;--bg-2:#FFF8E1;--panel:rgba(255,255,255,.8);--glass:rgba(255,255,255,.75);--glass-brd:rgba(201,168,76,.28);
  --gold:#C9A84C;--gold-2:#B8973B;--gold-soft:rgba(201,168,76,.1);
  --text:#1B2340;--text-dim:#5b5647;--muted:#7a7360;--line:rgba(139,111,31,.16);color-scheme:light}
*{box-sizing:border-box}
html,body{overflow-x:hidden}
body{margin:0;font-family:var(--ff-body);background:var(--bg);color:var(--text);
  font-size:15px;line-height:1.5;-webkit-font-smoothing:antialiased;
  padding-bottom:calc(var(--nav-h) + max(10px, env(safe-area-inset-bottom)));
  transition:background .3s,color .3s}
body::before{content:"";position:fixed;inset:0;z-index:-1;pointer-events:none;
  background:radial-gradient(120% 60% at 50% -10%,var(--gold-soft),transparent 60%)}
h1,h2,h3{font-family:var(--ff-serif);font-weight:700;margin:0 0 .4em;line-height:1.15;color:var(--text)}
a{color:var(--gold-2);text-decoration:none}
.wrap{max-width:560px;margin:0 auto;padding:14px 14px 8px;padding-top:calc(12px + env(safe-area-inset-top))}
.top{position:relative;overflow:hidden;display:flex;align-items:center;gap:12px;padding:14px 15px;margin-bottom:12px;
  background:radial-gradient(320px 180px at 100% -40%,var(--gold-soft),transparent 60%),var(--panel);
  border:1px solid var(--glass-brd);border-radius:var(--radius);box-shadow:0 8px 26px rgba(0,0,0,.22);backdrop-filter:blur(12px)}
.top::before{content:"";position:absolute;left:0;right:0;top:0;height:3px;background:var(--grad-gold)}
.top img{width:48px;height:48px;border-radius:14px;box-shadow:0 6px 16px rgba(0,0,0,.3),0 0 0 1px var(--glass-brd);flex:none}
.top b{font-family:var(--ff-serif);font-size:1.15rem;line-height:1.05;color:var(--text)}
.top small{color:var(--muted);font-size:.8rem}
/* Профиль-статы */
.hero-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}
.hero-stat{position:relative;overflow:hidden;text-align:center;padding:12px 6px;border-radius:var(--radius-sm);
  background:linear-gradient(180deg,var(--glass),transparent);border:1px solid var(--glass-brd);box-shadow:0 4px 14px rgba(0,0,0,.18)}
.hero-stat::before{content:"";position:absolute;left:26%;right:26%;top:0;height:2px;border-radius:2px;background:var(--grad-gold);opacity:.7}
.hero-stat b{display:block;font-family:var(--ff-serif);font-size:1.55rem;line-height:1;font-weight:700;
  background:var(--grad-gold);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.hero-stat span{display:block;font-size:.7rem;color:var(--muted);margin-top:3px}
.card{position:relative;overflow:hidden;background:var(--panel);border:1px solid var(--glass-brd);border-radius:var(--radius);padding:15px 16px;
  box-shadow:0 6px 22px rgba(0,0,0,.22);margin-bottom:12px;backdrop-filter:blur(12px)}
.card h3{padding-bottom:11px;border-bottom:1px solid var(--line);margin-bottom:10px}
.card h3{font-size:1.08rem;display:flex;align-items:center;gap:8px}
.card h3 svg{width:18px;height:18px;color:var(--gold-2)}
.row{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--line)}
.row:first-of-type{padding-top:2px}
.row:last-child{border-bottom:0;padding-bottom:2px}
.row strong{font-weight:600}
.row small{color:var(--muted);font-size:.82rem;display:block;margin-top:2px}
.badge{display:inline-block;font-size:.72rem;font-weight:700;padding:4px 10px;border-radius:999px;
  background:var(--gold-soft);color:var(--gold-2);white-space:nowrap;border:1px solid var(--glass-brd)}
.badge.ok{background:rgba(143,188,148,.16);color:var(--mint);border-color:rgba(143,188,148,.3)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:800;
  padding:13px 18px;border-radius:13px;border:0;cursor:pointer;width:100%;font-size:.98rem;
  background:var(--grad-gold);color:#1a1206;box-shadow:0 8px 24px rgba(201,168,76,.3);-webkit-tap-highlight-color:transparent}
.btn:active{transform:translateY(1px)}
.btn svg{width:18px;height:18px}
.btn.ghost{background:var(--glass);border:1.5px solid var(--glass-brd);color:var(--gold-2);box-shadow:none}
.muted{color:var(--muted)}
.empty{text-align:center;color:var(--muted);padding:22px 8px}
/* Быстрые действия */
.qa{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-bottom:12px}
.qa button,.qa a{display:flex;flex-direction:column;align-items:flex-start;gap:9px;text-align:left;
  background:var(--panel);border:1px solid var(--glass-brd);border-radius:var(--radius);padding:14px 15px;cursor:pointer;
  color:var(--text);font-family:var(--ff-body);font-weight:700;font-size:.92rem;backdrop-filter:blur(12px);
  box-shadow:0 6px 22px rgba(0,0,0,.2);-webkit-tap-highlight-color:transparent;transition:transform .15s}
.qa button:active,.qa a:active{transform:scale(.97)}
.qa .qa-ic{width:38px;height:38px;border-radius:11px;display:grid;place-items:center;background:var(--gold-soft);color:var(--gold-2)}
.qa .qa-ic svg{width:20px;height:20px}
.qa small{display:block;font-weight:500;color:var(--muted);font-size:.76rem;margin-top:-2px}
.chips{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px;-webkit-overflow-scrolling:touch}
.chip{white-space:nowrap;background:var(--gold-soft);border:1px solid var(--glass-brd);border-radius:999px;padding:9px 15px;font-weight:600;font-size:.86rem;color:var(--text)}
/* Нижний таббар с безусловной safe-area */
.tabbar{position:fixed;left:0;right:0;bottom:0;z-index:20;
  background:color-mix(in srgb,var(--bg) 86%,transparent);border-top:1px solid var(--line);
  backdrop-filter:blur(16px);display:flex;max-width:560px;margin:0 auto;
  box-shadow:0 -8px 26px rgba(0,0,0,.18);
  padding-bottom:max(10px, env(safe-area-inset-bottom))}
.tabbar button{flex:1;background:none;border:0;padding:9px 4px;cursor:pointer;color:var(--muted);height:var(--nav-h);
  font-family:var(--ff-body);font-weight:600;font-size:.7rem;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;
  -webkit-tap-highlight-color:transparent;position:relative;transition:color .18s}
.tabbar button.active{color:var(--gold-2)}
.tabbar button.active::before{content:"";position:absolute;top:0;left:50%;transform:translateX(-50%);width:26px;height:2px;border-radius:2px;background:var(--grad-gold)}
.tabbar svg{width:22px;height:22px}
.tabbar .tb-count{position:absolute;top:5px;left:calc(50% + 9px);min-width:15px;height:15px;padding:0 3px;
  border-radius:999px;background:var(--grad-gold);color:#1a1206;font-size:.6rem;font-weight:800;display:grid;place-items:center;line-height:1}
.panel{display:none;animation:fade .25s ease}.panel.active{display:block}
@keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.panel,.btn,.qa button,.qa a{animation:none;transition:none}}
</style>
</head>
<body>
<div class="wrap">
  <div class="top">
    <img src="<?= h(logo_data_uri()) ?>" alt="Логотип">
    <div><b>Музыкальный Мир</b><br><small><?= $u ? h($u['full_name'] ?: 'Личный кабинет') : 'Личный кабинет' ?></small></div>
  </div>

  <?php if ($u): ?>
  <div class="hero-stats">
    <div class="hero-stat"><b><?= $appsCount ?></b><span>Заявок</span></div>
    <div class="hero-stat"><b><?= $dipCount ?></b><span>Дипломов</span></div>
    <div class="hero-stat"><b><?= count($orders) ?></b><span>Заказов</span></div>
  </div>
  <?php endif; ?>

  <!-- Главная -->
  <div class="panel active" id="p-home">
    <div class="qa">
      <a href="<?= h($BASE.'/apply') ?>" data-ext>
        <span class="qa-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M12 5v14M5 12h14"/></svg></span>
        Подать заявку<small>Участвовать в конкурсе</small>
      </a>
      <button type="button" data-goto="apps">
        <span class="qa-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/></svg></span>
        Мои заявки<small><?= $u ? ($appsCount.' в работе') : 'Войдите в аккаунт' ?></small>
      </button>
      <button type="button" data-goto="dip">
        <span class="qa-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8" r="6"/><path d="M8.2 13.9 7 22l5-3 5 3-1.2-8.1"/></svg></span>
        Дипломы<small><?= $u ? ($dipCount ? ($dipCount.' готово') : 'После оценки') : 'Войдите в аккаунт' ?></small>
      </button>
      <a href="<?= h($BASE.'/contacts') ?>" data-ext>
        <span class="qa-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>
        Поддержка<small>Связаться с нами</small>
      </a>
    </div>

    <div class="card">
      <h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>Действующие конкурсы</h3>
      <?php if (!$comps): ?><p class="empty">Скоро откроется приём заявок.</p>
      <?php else: foreach ($comps as $c): ?>
        <div class="row">
          <div><strong><?= h($c['name']) ?></strong><small><?= $c['type']==='national'?'Всероссийский':'Международный' ?></small></div>
          <a class="badge <?= $c['status']==='open'?'ok':'' ?>" href="<?= h($BASE.'/competition/'.$c['slug']) ?>" data-ext><?= $c['status']==='open'?'Приём':'Оценка' ?></a>
        </div>
      <?php endforeach; endif; ?>
    </div>
  </div>

  <!-- Заявки -->
  <div class="panel" id="p-apps">
    <div class="card">
      <h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>Мои заявки</h3>
      <?php if (!$u): ?><p class="empty">Войдите, чтобы видеть заявки.</p>
      <?php elseif (!$apps): ?><p class="empty">Заявок пока нет.</p>
      <?php else: foreach ($apps as $a): ?>
        <div class="row">
          <div><strong><?= h($a['comp_name'] ?: 'Конкурс') ?></strong><small><?= $a['number'] ? '№ '.h($a['number']) : '' ?><?= !empty($a['result']) ? ' · '.h($a['result']) : '' ?></small></div>
          <span class="badge <?= in_array($a['status'],['graded','sent'],true)?'ok':'' ?>"><?= h($appStatus[$a['status']] ?? $a['status']) ?></span>
        </div>
      <?php endforeach; endif; ?>
    </div>
    <a class="btn" href="<?= h($BASE.'/apply') ?>" data-ext><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>Подать заявку</a>
  </div>

  <!-- Дипломы -->
  <div class="panel" id="p-dip">
    <div class="card">
      <h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8" r="6"/><path d="M8.2 13.9 7 22l5-3 5 3-1.2-8.1"/></svg>Дипломы и награды</h3>
      <?php if (!$u): ?><p class="empty">Войдите, чтобы видеть дипломы.</p>
      <?php elseif (!$diplomas && !$orders): ?><p class="empty">Дипломы появятся после оценки жюри.</p>
      <?php else: ?>
        <?php foreach ($diplomas as $d): ?>
          <div class="row">
            <div><strong><?= h($d['d_result'] ?: $d['a_result'] ?: 'Диплом') ?></strong><small><?= h($d['comp_name'] ?: '') ?> · № <?= h($d['number']) ?></small></div>
            <a class="badge ok" href="<?= h($BASE.'/verify/'.$d['number']) ?>" data-ext>Проверка</a>
          </div>
        <?php endforeach; ?>
        <?php foreach ($orders as $o): ?>
          <div class="row">
            <div><strong><?= h($o['items'] ?: 'Заказ наград') ?></strong><small><?= $o['tracking'] ? 'Трек: '.h($o['tracking']) : 'Оформлен' ?></small></div>
            <span class="badge <?= $o['status']==='delivered'?'ok':'' ?>"><?= h($orderStatus[$o['status']] ?? $o['status']) ?></span>
          </div>
        <?php endforeach; ?>
      <?php endif; ?>
    </div>
  </div>

  <!-- Ещё -->
  <div class="panel" id="p-more">
    <div class="card">
      <h3><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>Разделы</h3>
      <div class="chips" style="flex-wrap:wrap">
        <a class="chip" href="<?= h($BASE.'/competitions') ?>" data-ext>Конкурсы</a>
        <a class="chip" href="<?= h($BASE.'/awards') ?>" data-ext>Награды</a>
        <a class="chip" href="<?= h($BASE.'/concerts') ?>" data-ext>Концерты</a>
        <a class="chip" href="<?= h($BASE.'/faq') ?>" data-ext>Вопросы</a>
        <a class="chip" href="<?= h($BASE.'/contacts') ?>" data-ext>Контакты</a>
      </div>
    </div>
    <?php if ($u): ?>
      <a class="btn ghost" href="<?= h($BASE.'/cabinet') ?>" data-ext>Открыть полный кабинет</a>
    <?php else: ?>
      <a class="btn" href="<?= h($BASE.'/login') ?>" data-ext>Войти</a>
    <?php endif; ?>
    <p class="muted" id="tmaState" style="text-align:center;font-size:.8rem;margin-top:12px"></p>
  </div>
</div>

<nav class="tabbar">
  <button data-p="home" class="active"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2h-3v-7H8v7H5a2 2 0 0 1-2-2z"/></svg>Главная</button>
  <button data-p="apps"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg><?php if ($u && $appsCount): ?><span class="tb-count"><?= $appsCount > 9 ? '9+' : $appsCount ?></span><?php endif; ?>Заявки</button>
  <button data-p="dip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8" r="6"/><path d="M8.2 13.9 7 22l5-3 5 3-1.2-8.1"/></svg>Дипломы</button>
  <button data-p="more"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>Ещё</button>
</nav>

<script>
(function(){
  var tg = window.Telegram && window.Telegram.WebApp;
  if (tg) {
    try {
      tg.ready();
      tg.expand();
      if (tg.isVersionAtLeast && tg.isVersionAtLeast('6.1')) {
        try { tg.setHeaderColor('secondary_bg_color'); } catch(e){}
        try { tg.setBackgroundColor(tg.themeParams && tg.themeParams.bg_color ? tg.themeParams.bg_color : '#0b0a0d'); } catch(e){}
      }
      if (tg.enableClosingConfirmation) { try { tg.enableClosingConfirmation(); } catch(e){} }
    } catch(e){}
    function syncTheme(){ if (tg.colorScheme) document.documentElement.dataset.theme = tg.colorScheme; }
    syncTheme();
    try { tg.onEvent('themeChanged', syncTheme); } catch(e){}
  }

  var hapt = function(){ try { tg && tg.HapticFeedback && tg.HapticFeedback.selectionChanged(); } catch(e){} };

  // Навигация по разделам.
  var btns = document.querySelectorAll('.tabbar button');
  function goto(id){
    document.querySelectorAll('.panel').forEach(function(p){ p.classList.toggle('active', p.id==='p-'+id); });
    btns.forEach(function(x){ x.classList.toggle('active', x.getAttribute('data-p')===id); });
    window.scrollTo(0,0);
  }
  btns.forEach(function(b){ b.addEventListener('click', function(){ hapt(); goto(b.getAttribute('data-p')); }); });

  // Быстрые действия, переключающие вкладки.
  document.querySelectorAll('[data-goto]').forEach(function(el){
    el.addEventListener('click', function(){ hapt(); goto(el.getAttribute('data-goto')); });
  });

  // Внешние ссылки открываем нативно через Telegram (без выхода из приложения).
  document.querySelectorAll('a[data-ext]').forEach(function(a){
    a.addEventListener('click', function(e){
      if (tg && tg.openLink) { e.preventDefault(); hapt(); tg.openLink(a.href); }
    });
  });

  // Автологин по initData (заглушка эндпоинта на этом этапе).
  var loggedIn = <?= $u ? 'true' : 'false' ?>;
  var state = document.getElementById('tmaState');
  if (tg && tg.initData && !loggedIn) {
    fetch('<?= h($BASE) ?>/api/v1/tma_auth', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ init_data: tg.initData })
    }).then(function(r){ return r.json(); })
      .then(function(d){ if (d && d.ok) { location.reload(); } else if (state) { state.textContent = 'Вход по Telegram будет доступен в ближайшее время.'; } })
      .catch(function(){ if (state) state.textContent = 'Вход по Telegram будет доступен в ближайшее время.'; });
  }
})();
</script>
</body>
</html>
<?php
exit;
