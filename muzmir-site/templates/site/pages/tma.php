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
?><!doctype html>
<html lang="ru">
<head>
<script>document.documentElement.dataset.theme=(function(){try{var tg=window.Telegram&&window.Telegram.WebApp;if(tg&&tg.colorScheme)return tg.colorScheme;}catch(e){}return (window.matchMedia&&matchMedia('(prefers-color-scheme: light)').matches)?'light':'dark';})();</script>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>КЦ «Музыкальный Мир»</title>
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<style>
:root{--bg:#0b0a0d;--panel:rgba(30,26,20,.6);--glass:rgba(28,24,18,.65);--glass-brd:rgba(201,168,76,.22);
  --gold:#E8C25A;--gold-2:#C9A84C;--gold-soft:rgba(232,194,90,.14);
  --text:#F3ECDA;--text-dim:#b8ad93;--muted:#8b8069;--line:rgba(201,168,76,.16);
  --mint:#8FBC94;--error:#E27B7B;--radius:14px;
  --grad-gold:linear-gradient(135deg,#F3D57C 0%,#E8C25A 40%,#B98F2E 100%);
  --ff-serif:"Cormorant Garamond",Georgia,serif;--ff-body:"Manrope",system-ui,-apple-system,Segoe UI,Roboto,sans-serif;
  color-scheme:dark}
:root[data-theme="light"]{--bg:#FFFCF5;--panel:rgba(255,255,255,.8);--glass:rgba(255,255,255,.75);--glass-brd:rgba(201,168,76,.28);
  --gold:#C9A84C;--gold-2:#B8973B;--gold-soft:rgba(201,168,76,.1);
  --text:#1B2340;--text-dim:#5b5647;--muted:#7a7360;--line:rgba(139,111,31,.16);color-scheme:light}
*{box-sizing:border-box}
body{margin:0;font-family:var(--ff-body);background:var(--bg);color:var(--text);
  font-size:15px;line-height:1.5;-webkit-font-smoothing:antialiased;padding-bottom:76px;transition:background .3s,color .3s}
h1,h2,h3{font-family:var(--ff-serif);font-weight:700;margin:0 0 .4em;line-height:1.15;color:var(--text)}
a{color:var(--gold-2);text-decoration:none}
.wrap{max-width:560px;margin:0 auto;padding:14px}
.top{display:flex;align-items:center;gap:10px;padding:6px 0 14px}
.top img{width:40px;height:40px;border-radius:50%;box-shadow:0 2px 10px rgba(232,194,90,.3);border:1px solid var(--glass-brd)}
.top b{font-family:var(--ff-serif);font-size:1.05rem;line-height:1.05;color:var(--text)}
.card{background:var(--panel);border:1px solid var(--glass-brd);border-radius:var(--radius);padding:14px 16px;
  box-shadow:0 4px 20px rgba(0,0,0,.25);margin-bottom:12px;backdrop-filter:blur(12px)}
.card h3{font-size:1.05rem}
.row{display:flex;justify-content:space-between;gap:12px;align-items:flex-start;padding:9px 0;border-bottom:1px solid var(--line)}
.row:last-child{border-bottom:0}
.row small{color:var(--muted);font-size:.82rem}
.badge{display:inline-block;font-size:.72rem;font-weight:700;padding:3px 9px;border-radius:999px;
  background:var(--gold-soft);color:var(--gold-2);white-space:nowrap;border:1px solid var(--glass-brd)}
.badge.ok{background:rgba(143,188,148,.16);color:var(--mint);border-color:rgba(143,188,148,.3)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;font-weight:800;
  padding:12px 18px;border-radius:12px;border:0;cursor:pointer;width:100%;font-size:.98rem;
  background:var(--grad-gold);color:#1a1206;box-shadow:0 8px 24px rgba(201,168,76,.3)}
.btn.ghost{background:var(--glass);border:1.5px solid var(--glass-brd);color:var(--gold-2);box-shadow:none}
.muted{color:var(--muted)}
.empty{text-align:center;color:var(--muted);padding:20px 8px}
.chips{display:flex;gap:8px;overflow-x:auto;padding-bottom:4px}
.chip{white-space:nowrap;background:var(--gold-soft);border:1px solid var(--glass-brd);border-radius:999px;padding:8px 14px;font-weight:600;font-size:.86rem;color:var(--text)}
.tabbar{position:fixed;left:0;right:0;bottom:0;background:color-mix(in srgb,var(--bg) 82%,transparent);border-top:1px solid var(--line);
  backdrop-filter:blur(14px);display:flex;max-width:560px;margin:0 auto}
.tabbar button{flex:1;background:none;border:0;padding:10px 4px 12px;cursor:pointer;color:var(--muted);
  font-family:var(--ff-body);font-weight:600;font-size:.72rem;display:flex;flex-direction:column;align-items:center;gap:4px}
.tabbar button.active{color:var(--gold-2)}
.tabbar svg{width:22px;height:22px}
.panel{display:none}.panel.active{display:block}
</style>
</head>
<body>
<div class="wrap">
  <div class="top">
    <img src="<?= h(logo_data_uri()) ?>" alt="Логотип">
    <div><b>Музыкальный Мир</b><br><small class="muted">Личный кабинет</small></div>
  </div>

  <!-- Главная -->
  <div class="panel active" id="p-home">
    <div class="card">
      <h3>Действующие конкурсы</h3>
      <?php if (!$comps): ?><p class="empty">Скоро откроется приём заявок.</p>
      <?php else: foreach ($comps as $c): ?>
        <div class="row">
          <div><strong><?= h($c['name']) ?></strong><br><small><?= $c['type']==='national'?'Всероссийский':'Международный' ?></small></div>
          <a class="badge <?= $c['status']==='open'?'ok':'' ?>" href="<?= h($BASE.'/competition/'.$c['slug']) ?>" target="_blank"><?= $c['status']==='open'?'Приём':'Оценка' ?></a>
        </div>
      <?php endforeach; endif; ?>
    </div>
    <a class="btn" href="<?= h($BASE.'/apply') ?>" target="_blank">Подать заявку</a>
  </div>

  <!-- Заявки -->
  <div class="panel" id="p-apps">
    <div class="card">
      <h3>Мои заявки</h3>
      <?php if (!$u): ?><p class="empty">Войдите, чтобы видеть заявки.</p>
      <?php elseif (!$apps): ?><p class="empty">Заявок пока нет.</p>
      <?php else: foreach ($apps as $a): ?>
        <div class="row">
          <div><strong><?= h($a['comp_name'] ?: 'Конкурс') ?></strong><br><small><?= $a['number'] ? '№ '.h($a['number']) : '' ?><?= !empty($a['result']) ? ' · '.h($a['result']) : '' ?></small></div>
          <span class="badge <?= in_array($a['status'],['graded','sent'],true)?'ok':'' ?>"><?= h($appStatus[$a['status']] ?? $a['status']) ?></span>
        </div>
      <?php endforeach; endif; ?>
    </div>
  </div>

  <!-- Дипломы -->
  <div class="panel" id="p-dip">
    <div class="card">
      <h3>Дипломы и награды</h3>
      <?php if (!$u): ?><p class="empty">Войдите, чтобы видеть дипломы.</p>
      <?php elseif (!$diplomas && !$orders): ?><p class="empty">Дипломы появятся после оценки жюри.</p>
      <?php else: ?>
        <?php foreach ($diplomas as $d): ?>
          <div class="row">
            <div><strong><?= h($d['d_result'] ?: $d['a_result'] ?: 'Диплом') ?></strong><br><small><?= h($d['comp_name'] ?: '') ?> · № <?= h($d['number']) ?></small></div>
            <a class="badge ok" href="<?= h($BASE.'/verify/'.$d['number']) ?>" target="_blank">Проверка</a>
          </div>
        <?php endforeach; ?>
        <?php foreach ($orders as $o): ?>
          <div class="row">
            <div><strong><?= h($o['items'] ?: 'Заказ наград') ?></strong><br><small><?= $o['tracking'] ? 'Трек: '.h($o['tracking']) : '' ?></small></div>
            <span class="badge <?= $o['status']==='delivered'?'ok':'' ?>"><?= h($orderStatus[$o['status']] ?? $o['status']) ?></span>
          </div>
        <?php endforeach; ?>
      <?php endif; ?>
    </div>
  </div>

  <!-- Ещё -->
  <div class="panel" id="p-more">
    <div class="card">
      <h3>Разделы</h3>
      <div class="chips" style="flex-wrap:wrap">
        <a class="chip" href="<?= h($BASE.'/competitions') ?>" target="_blank">Конкурсы</a>
        <a class="chip" href="<?= h($BASE.'/awards') ?>" target="_blank">Награды</a>
        <a class="chip" href="<?= h($BASE.'/concerts') ?>" target="_blank">Концерты</a>
        <a class="chip" href="<?= h($BASE.'/faq') ?>" target="_blank">Вопросы</a>
        <a class="chip" href="<?= h($BASE.'/contacts') ?>" target="_blank">Контакты</a>
      </div>
    </div>
    <?php if ($u): ?>
      <a class="btn ghost" href="<?= h($BASE.'/cabinet') ?>" target="_blank">Открыть полный кабинет</a>
    <?php else: ?>
      <a class="btn" href="<?= h($BASE.'/login') ?>" target="_blank">Войти</a>
    <?php endif; ?>
    <p class="muted" id="tmaState" style="text-align:center;font-size:.8rem;margin-top:12px"></p>
  </div>
</div>

<nav class="tabbar">
  <button data-p="home" class="active"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2h-3v-7H8v7H5a2 2 0 0 1-2-2z"/></svg>Главная</button>
  <button data-p="apps"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>Заявки</button>
  <button data-p="dip"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8" r="6"/><path d="M8.2 13.9 7 22l5-3 5 3-1.2-8.1"/></svg>Дипломы</button>
  <button data-p="more"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/></svg>Ещё</button>
</nav>

<script>
(function(){
  var tg = window.Telegram && window.Telegram.WebApp;
  if (tg) {
    try { tg.ready(); tg.expand(); } catch(e){}
    try {
      if (tg.colorScheme) document.documentElement.dataset.theme = tg.colorScheme;
      tg.onEvent('themeChanged', function(){ if (tg.colorScheme) document.documentElement.dataset.theme = tg.colorScheme; });
    } catch(e){}
  }

  // Навигация по разделам.
  var btns = document.querySelectorAll('.tabbar button');
  btns.forEach(function(b){ b.addEventListener('click', function(){
    var id = b.getAttribute('data-p');
    document.querySelectorAll('.panel').forEach(function(p){ p.classList.toggle('active', p.id==='p-'+id); });
    btns.forEach(function(x){ x.classList.toggle('active', x===b); });
    window.scrollTo(0,0);
  }); });

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
