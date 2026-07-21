<?php
/** Главная страница. */
$stats = [];
foreach (['stat_competitions'=>'Проведено конкурсов','stat_participants'=>'Участников за 5 лет',
          'stat_regions'=>'Регионов России','stat_countries'=>'Стран','stat_diplomas'=>'Дипломов выдано'] as $k=>$label) {
    $stats[] = [(int)setting($k, '0'), $label, $k==='stat_participants'||$k==='stat_diplomas' ? '+' : ($k==='stat_countries'?'+':'')];
}
$comps = all("SELECT * FROM competitions WHERE status IN('open','judging') ORDER BY sort LIMIT 6");
$reviews = all("SELECT * FROM reviews WHERE status='published' ORDER BY created_at DESC LIMIT 3");
$concerts = all("SELECT * FROM concerts ORDER BY sort LIMIT 3");

$icons = [
  'reg' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>',
  'app' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15l2 2 4-4"/></svg>',
  'jury' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>',
  'dip' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="6"/><path d="M8.2 13.9 7 22l5-3 5 3-1.2-8.1"/></svg>',
];

ob_start(); ?>
<section class="hero">
  <div class="hero-notes"></div>
  <div class="container">
    <div class="reveal">
      <img class="hero-logo" src="<?= asset('img/logo_muzmir_main.webp') ?>" alt="Логотип КЦ «Музыкальный Мир»">
    </div>
    <div class="reveal">
      <p class="eyebrow">Культурный центр</p>
      <h1><?= h(setting('hero_title', cfgv('org_name'))) ?></h1>
      <p class="lead"><?= h(setting('hero_subtitle', 'Международные и всероссийские онлайн-конкурсы и фестивали')) ?> культуры и искусства при информационной поддержке Министерств культуры и образования субъектов Российской Федерации.</p>
      <div class="hero-cta">
        <a class="btn btn--primary btn--lg" href="<?= url('/apply') ?>">Подать заявку</a>
        <a class="btn btn--ghost btn--lg" href="<?= url('/competitions') ?>">Действующие конкурсы</a>
      </div>
    </div>
  </div>
</section>

<section class="section section--tint">
  <div class="container">
    <div class="stats reveal">
      <?php foreach ($stats as [$val,$label,$suf]): ?>
        <div class="stat"><b data-count="<?= $val ?>" data-suffix="<?= h($suf) ?>">0</b><span><?= h($label) ?></span></div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">При информационной поддержке</p>
      <div class="gold-rule"></div>
    </div>
    <div class="partners reveal">
      <?php foreach ([['emblem_minkultury_rf','Минкультуры РФ','https://culture.gov.ru'],
                      ['emblem_minobrazovaniya','Минобрнауки РФ','https://minobrnauki.gov.ru'],
                      ['emblem_roskomnadzor','Роскомнадзор','https://rkn.gov.ru'],
                      ['prokultura_full_horizontal','PROКультура.РФ','https://pro.culture.ru'],
                      ['natsproekty_kultura','Нацпроекты «Культура»','https://национальныепроекты.рф']] as [$img,$alt,$link]): ?>
        <a href="<?= h($link) ?>" target="_blank" rel="noopener" title="<?= h($alt) ?>"><img src="<?= asset('img/'.$img.'.webp') ?>" alt="<?= h($alt) ?>" loading="lazy"></a>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<section class="section section--parchment">
  <div class="container">
    <div class="section-head reveal"><p class="eyebrow">Приём открыт</p><h2>Действующие конкурсы</h2>
      <p>Выберите конкурс и подайте заявку. Оценивает компетентное жюри, результаты приходят на Вашу почту.</p></div>
    <div class="grid grid-3">
      <?php foreach ($comps as $c): ?>
        <a class="card comp-card reveal" href="<?= url('/competition/'.$c['slug']) ?>">
          <div class="cc-cover"><?= h($c['name']) ?></div>
          <div class="cc-body">
            <span class="badge badge--<?= $c['status']==='open'?'open':'closed' ?>"><?= $c['status']==='open'?'Приём открыт':'Идёт оценка' ?></span>
            <span class="badge badge--intl"><?= $c['type']==='international'?'Международный':'Всероссийский' ?></span>
            <h3 style="margin-top:12px"><?= h($c['name']) ?></h3>
            <div class="cc-meta"><span>Многожанровый</span><?php if($c['end_date']):?><span>· до <?= h(ru_date($c['end_date'])) ?></span><?php endif;?></div>
            <span class="btn btn--ghost btn--block">Подробнее</span>
          </div>
        </a>
      <?php endforeach; ?>
    </div>
    <div style="text-align:center;margin-top:36px"><a class="btn btn--primary" href="<?= url('/competitions') ?>">Все конкурсы</a></div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="section-head reveal"><p class="eyebrow">Просто и прозрачно</p><h2>Как это работает</h2></div>
    <div class="steps">
      <?php foreach ([['reg','Регистрация','Создайте личный кабинет за минуту'],
                      ['app','Подача заявки','Заполните умную форму с проверками'],
                      ['jury','Оценка жюри','Компетентное жюри оценивает работу'],
                      ['dip','Диплом на почту','Получите наградные документы онлайн']] as $i=>[$ic,$t,$d]): ?>
        <div class="step reveal"><div class="ic"><?= $icons[$ic] ?></div><h3><?= h($t) ?></h3><p style="color:var(--muted)"><?= h($d) ?></p></div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<?php if ($concerts): ?>
<section class="section section--tint">
  <div class="container">
    <div class="section-head reveal"><p class="eyebrow">Смотрите</p><h2>Онлайн-концерты</h2></div>
    <div class="grid grid-3">
      <?php foreach ($concerts as $c): ?>
        <div class="card reveal"><h3><?= h($c['title']) ?></h3><p style="color:var(--muted)"><?= h($c['category']) ?></p></div>
      <?php endforeach; ?>
    </div>
    <div style="text-align:center;margin-top:32px"><a class="btn btn--ghost" href="<?= url('/concerts') ?>">Все концерты</a></div>
  </div>
</section>
<?php endif; ?>

<?php if ($reviews): ?>
<section class="section">
  <div class="container">
    <div class="section-head reveal"><p class="eyebrow">Нам доверяют</p><h2>Отзывы участников</h2></div>
    <div class="grid grid-3">
      <?php foreach ($reviews as $r): ?>
        <div class="card reveal"><p style="font-family:var(--ff-head);font-size:1.05rem">«<?= h($r['text']) ?>»</p><p style="color:var(--gold-dark);font-weight:700;margin:0"><?= h($r['author']) ?></p></div>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<?php endif; ?>

<section class="section section--parchment">
  <div class="container" style="max-width:680px;text-align:center">
    <div class="reveal">
      <p class="eyebrow">Будьте в курсе</p><h2>Узнавайте первыми о новых конкурсах</h2>
      <form method="post" action="<?= url('/api/v1/subscribe') ?>" style="display:flex;gap:12px;margin-top:20px;flex-wrap:wrap;justify-content:center" onsubmit="return muzmirSubscribe(event)">
        <input type="email" name="email" placeholder="Ваша электронная почта" required style="max-width:340px">
        <button class="btn btn--primary" type="submit">Подписаться</button>
      </form>
      <p style="font-size:.82rem;color:var(--muted);margin-top:12px">Нажимая «Подписаться», Вы соглашаетесь с <a href="<?= url('/privacy') ?>">Политикой конфиденциальности</a>.</p>
    </div>
  </div>
</section>
<script>
function muzmirSubscribe(e){e.preventDefault();var f=e.target;fetch(f.action,{method:'POST',body:new FormData(f)}).then(r=>r.json()).then(function(d){alert(d.message||'Спасибо за подписку!');f.reset();}).catch(function(){alert('Спасибо!');});return false;}
</script>
<?php
$content = ob_get_clean();
render_page('Главная', $content, ['active' => '/', 'meta' => 'КЦ «Музыкальный Мир» — международные и всероссийские онлайн-конкурсы и фестивали культуры и искусства. Подача заявок, дипломы, награды онлайн.']);
