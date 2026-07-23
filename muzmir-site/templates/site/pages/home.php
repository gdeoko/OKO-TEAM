<?php
/** Главная страница - флагман. Серверная логика и выборки из БД сохранены. */
require_once BASE_PATH . '/templates/site/partials/heatmap.php';

$YEARS = max(1, (int) date('Y') - 2020);

/* Инфографика - реальные цифры (эталон данных), с фолбэком на настройки БД. */
$infographic = [
  ['val' => (int) setting('stat_years', (string) $YEARS), 'suf' => '', 'label' => 'Лет в искусстве', 'note' => '2020-2026'],
  ['val' => (int) setting('stat_competitions', '95'), 'suf' => '+', 'label' => 'Конкурсов и фестивалей', 'note' => 'многожанровых'],
  ['val' => (int) setting('stat_participants', '30621'), 'suf' => '+', 'label' => 'Заявок участников', 'note' => 'со всего мира'],
  ['val' => (int) setting('stat_regions', '85'), 'suf' => '', 'label' => 'Регионов России', 'note' => 'все федеральные округа'],
  ['val' => (int) setting('stat_countries', '10'), 'suf' => '', 'label' => 'Стран-участниц', 'note' => 'СНГ и дальнее зарубежье'],
];

/* Данные из БД (as is). */
$comps    = all("SELECT * FROM competitions WHERE status IN('open','judging') ORDER BY sort LIMIT 6");
$reviews  = all("SELECT * FROM reviews WHERE status='published' ORDER BY created_at DESC LIMIT 3");
$concerts = all("SELECT * FROM concerts ORDER BY sort LIMIT 3");

/* Доли номинаций по базе заявок (реальные, п.14 базы знаний). */
$noms = [
  ['Вокальное искусство', 39, 'var(--gold)'],
  ['Инструментальное исполнительство', 16, 'var(--gold-2)'],
  ['Хореография', 8, 'var(--mint)'],
  ['Другие номинации', 37, 'var(--gold-deep)'],
];
/* Самые массовые конкурсы (реальные, сводная таблица заявок). */
$topComps = [
  ['День Победы', 1470], ['Звёзды великой страны', 1076], ['Сила России', 1019],
  ['Талант года', 702], ['Дар искусства', 653],
];
$topMax = max(array_column($topComps, 1));

/* Круговая диаграмма: сегменты для donut (окружность r=54). */
$C = 2 * M_PI * 54; // ~339.29
$acc = 0.0;
$donutSegs = [];
foreach ($noms as [$nName, $nPct, $nColor]) {
    $dash = round($C * $nPct / 100, 2);
    $donutSegs[] = ['color' => $nColor, 'dash' => $dash, 'gap' => round($C - $dash, 2), 'offset' => round(-$C * $acc / 100, 2)];
    $acc += $nPct;
}
$ringPct  = 39;                         // доля вокальных заявок - ведущая номинация
$ringDash = round($C * $ringPct / 100, 2);

$icons = [
  'reg' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>',
  'app' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15l2 2 4-4"/></svg>',
  'jury' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>',
  'dip' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="6"/><path d="M8.2 13.9 7 22l5-3 5 3-1.2-8.1"/></svg>',
  'shield' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5z"/><path d="m9 12 2 2 4-4"/></svg>',
  'gov' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6"/></svg>',
  'globe' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18"/></svg>',
];

ob_start(); ?>
<section class="hero">
  <div class="hero-notes" aria-hidden="true"></div>
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="container">
    <div class="reveal hero-media">
      <span class="hero-ring" aria-hidden="true"></span>
      <span class="hero-ring hero-ring--2" aria-hidden="true"></span>
      <img class="hero-logo" src="<?= asset('img/logo_muzmir_main.webp') ?>" alt="Логотип КЦ «Музыкальный Мир»" width="380" height="380" style="view-transition-name:hero-logo">
    </div>
    <div class="reveal">
      <p class="eyebrow eyebrow--script">Искусство объединяет мир</p>
      <h1><?= h(setting('hero_title', cfgv('org_name', 'Музыкальный Мир'))) ?></h1>
      <p class="lead"><?= h(setting('hero_subtitle', 'Международные и всероссийские онлайн-конкурсы и фестивали')) ?> культуры и искусства при информационной поддержке Министерств культуры и образования субъектов Российской Федерации.</p>
      <div class="hero-cta">
        <a class="btn btn--primary btn--lg" href="<?= url('/apply') ?>">Подать заявку</a>
        <a class="btn btn--ghost btn--lg" href="<?= url('/competitions') ?>">Действующие конкурсы</a>
      </div>
      <ul class="hero-trust" aria-label="Правовая основа и поддержка">
        <li><span class="hero-trust-ic"><?= $icons['shield'] ?></span>Роскомнадзор № 094084</li>
        <li><span class="hero-trust-ic"><?= $icons['gov'] ?></span>При поддержке Минкультуры</li>
        <li><span class="hero-trust-ic"><?= $icons['globe'] ?></span>Портал «PRO.Культура.РФ»</li>
      </ul>
    </div>
  </div>
</section>

<section class="section section--tint">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow eyebrow--script">Пять лет в искусстве</p>
      <h2>Центр в цифрах</h2>
      <div class="gold-rule"></div>
      <p>С 2020 года «Музыкальный Мир» объединяет талантливых людей со всей России и зарубежья. Участие - бесплатное, оценка - честная, результаты - на Вашу почту.</p>
    </div>

    <div class="stats reveal">
      <?php foreach ($infographic as $s): ?>
        <div class="stat">
          <b data-count="<?= (int) $s['val'] ?>" data-suffix="<?= h($s['suf']) ?>">0</b>
          <span><?= h($s['label']) ?></span>
          <em class="stat-note"><?= h($s['note']) ?></em>
        </div>
      <?php endforeach; ?>
    </div>

    <div class="grid grid-3 reveal" style="margin-top:32px">
      <!-- Пончик: номинации -->
      <div class="card">
        <h3>Номинации участников</h3>
        <div class="donut">
          <svg viewBox="0 0 140 140" role="img" aria-label="Распределение заявок по номинациям">
            <circle cx="70" cy="70" r="54" fill="none" stroke="var(--line)" stroke-width="17"></circle>
            <?php foreach ($donutSegs as $seg): ?>
              <circle cx="70" cy="70" r="54" fill="none" stroke="<?= $seg['color'] ?>" stroke-width="17"
                      stroke-dasharray="<?= $seg['dash'] ?> <?= $seg['gap'] ?>" stroke-dashoffset="<?= $seg['offset'] ?>"
                      transform="rotate(-90 70 70)" stroke-linecap="butt"></circle>
            <?php endforeach; ?>
            <text x="70" y="66" text-anchor="middle" class="donut-num">9</text>
            <text x="70" y="86" text-anchor="middle" class="donut-cap">номинаций</text>
          </svg>
        </div>
        <ul class="legend">
          <?php foreach ($noms as [$nName, $nPct, $nColor]): ?>
            <li><i style="background:<?= $nColor ?>"></i><span><?= h($nName) ?></span><b><?= (int) $nPct ?>%</b></li>
          <?php endforeach; ?>
        </ul>
      </div>

      <!-- Кольцо прогресса: ведущая номинация -->
      <div class="card" style="text-align:center">
        <h3>Ведущая номинация</h3>
        <div class="stat-ring">
          <svg viewBox="0 0 140 140" role="img" aria-label="Доля вокальных заявок - 39 процентов">
            <circle cx="70" cy="70" r="54" fill="none" stroke="var(--line)" stroke-width="14"></circle>
            <circle cx="70" cy="70" r="54" fill="none" stroke="var(--gold)" stroke-width="14" stroke-linecap="round"
                    stroke-dasharray="<?= $ringDash ?> <?= round($C - $ringDash, 2) ?>" transform="rotate(-90 70 70)"></circle>
            <text x="70" y="66" text-anchor="middle" class="ring-num" data-count="<?= $ringPct ?>" data-suffix="%">0%</text>
            <text x="70" y="88" text-anchor="middle" class="ring-cap">заявок</text>
          </svg>
        </div>
        <p style="color:var(--muted);margin-top:6px">Вокальное искусство - самое массовое направление конкурсов «Музыкального Мира».</p>
      </div>

      <!-- Полосы: самые массовые конкурсы -->
      <div class="card">
        <h3>Самые массовые конкурсы</h3>
        <div class="bars">
          <?php foreach ($topComps as [$cName, $cCnt]): $w = max(8, round($cCnt / $topMax * 100)); ?>
            <div class="bar">
              <span class="bar-label"><?= h($cName) ?></span>
              <span class="bar-track"><i style="width:<?= $w ?>%"></i></span>
              <b class="bar-val"><?= number_format($cCnt, 0, '.', ' ') ?></b>
            </div>
          <?php endforeach; ?>
        </div>
        <p style="color:var(--muted);font-size:.82rem;margin:14px 0 0">Число поданных заявок на флагманские конкурсы центра.</p>
      </div>
    </div>

    <div class="reveal" style="margin-top:24px">
      <h3 style="text-align:center">География участников</h3>
      <p style="color:var(--muted);margin:0 0 18px">Россия, страны СНГ и дальнее зарубежье - от Калининграда до Дальнего Востока, от Минска до Уханя.</p>
      <?= render_regions_heatmap() ?>
    </div>
  </div>
</section>

<section class="section section--parchment">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow eyebrow--script">Приём открыт</p>
      <h2>Действующие конкурсы</h2>
      <div class="gold-rule"></div>
      <p>Выберите конкурс и подайте заявку. Оценивает компетентное жюри, результаты приходят на Вашу почту в течение 5 рабочих дней.</p>
    </div>
    <?php if ($comps): ?>
    <div class="grid grid-3">
      <?php foreach ($comps as $c): ?>
        <?php
          $cvName = (string) $c['name'];
          $cvMono = '';
          foreach (preg_split('/\s+/u', trim($cvName)) as $cw) {
              if ($cw !== '' && mb_strlen($cvMono) < 2) $cvMono .= mb_strtoupper(mb_substr($cw, 0, 1));
          }
          $cvCode = mb_strtoupper(trim((string) ($c['code'] ?? '')));
          $cvSeed = (int) ($c['id'] ?? 0) % 5;
          $cvCover = trim((string) ($c['cover'] ?? ''));
          if ($cvCover !== '') $cvCover = preg_replace('~^https?://(?:localhost|127\.0\.0\.1)(?::\d+)?~i', '', $cvCover);
          $isOpen = $c['status'] === 'open';
          $dirName = ['multi' => 'Многожанровый', 'patriotic' => 'Патриотический', 'thematic' => 'Тематический'][$c['direction'] ?? 'multi'] ?? 'Многожанровый';
        ?>
        <a class="card card--3d comp-card reveal" href="<?= url('/competition/'.$c['slug']) ?>">
          <div class="cc-cover cc-cover--s<?= $cvSeed ?>">
            <span class="cc-fallback" aria-hidden="true">
              <span class="cc-fallback-glow"></span>
              <svg class="cc-fallback-pat" viewBox="0 0 200 250" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
                <g stroke="currentColor" stroke-width="1.4" fill="none" opacity=".55"><path d="M-10 42h220M-10 72h220M-10 102h220M-10 182h220M-10 212h220"/></g>
                <g fill="currentColor" opacity=".9"><ellipse cx="46" cy="150" rx="11" ry="8" transform="rotate(-20 46 150)"/><rect x="55" y="96" width="3.2" height="57"/><path d="M58 96c15 4 21 12 16 27 3-15-6-21-16-23z"/><ellipse cx="150" cy="120" rx="9" ry="6.5" transform="rotate(-20 150 120)"/><rect x="157" y="79" width="2.8" height="43"/></g>
              </svg>
              <span class="cc-mono"><?= h($cvMono) ?></span>
              <?php if ($cvCode !== ''): ?><span class="cc-code"><?= h($cvCode) ?></span><?php endif; ?>
            </span>
            <?php if ($cvCover !== ''): ?>
              <img class="cc-img" src="<?= h($cvCover) ?>" alt="Афиша конкурса «<?= h($cvName) ?>»" loading="lazy" decoding="async" onerror="this.remove()" style="view-transition-name:comp-cover-<?= (int)$c['id'] ?>">
              <span class="cc-scrim" aria-hidden="true"></span>
            <?php endif; ?>
            <span class="cc-cover-badge badge badge--<?= $isOpen ? 'open' : 'judging' ?>"><?= $isOpen ? 'Приём открыт' : 'Идёт оценка' ?></span>
          </div>
          <div class="cc-body">
            <div class="cc-badges">
              <span class="badge badge--intl"><?= $c['type'] === 'international' ? 'Международный' : 'Всероссийский' ?></span>
            </div>
            <h3><?= h($cvName) ?></h3>
            <div class="cc-meta"><span><?= h($dirName) ?></span><?php if (!empty($c['end_date'])): ?><span>приём до <?= h(ru_date($c['end_date'])) ?></span><?php endif; ?></div>
            <span class="btn btn--ghost btn--block">Подробнее</span>
          </div>
        </a>
      <?php endforeach; ?>
    </div>
    <?php else: ?>
      <p class="reveal" style="text-align:center;color:var(--muted)">Сейчас идёт подготовка новых конкурсов. Подпишитесь ниже - и узнаете первыми.</p>
    <?php endif; ?>
    <div style="text-align:center;margin-top:36px"><a class="btn btn--primary" href="<?= url('/competitions') ?>">Все конкурсы</a></div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow eyebrow--script">Просто и прозрачно</p>
      <h2>Как это работает</h2>
      <div class="gold-rule"></div>
    </div>
    <div class="steps">
      <?php foreach ([['reg','Регистрация','Создайте личный кабинет за минуту'],
                      ['app','Подача заявки','Заполните умную форму с проверками'],
                      ['jury','Оценка жюри','Компетентное жюри оценивает работу'],
                      ['dip','Диплом на почту','Получите наградные документы онлайн']] as $i => [$ic, $t, $d]): ?>
        <div class="step reveal">
          <div class="ic"><?= $icons[$ic] ?></div>
          <div class="step-num"><?= $i + 1 ?></div>
          <h3><?= h($t) ?></h3>
          <p style="color:var(--muted)"><?= h($d) ?></p>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<section class="section section--tint">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow eyebrow--script">При информационной поддержке</p>
      <h2>Партнёры и инфоподдержка</h2>
      <div class="gold-rule"></div>
    </div>
    <div class="partners reveal">
      <?php foreach ([['emblem_minkultury_rf','Минкультуры РФ','https://culture.gov.ru'],
                      ['emblem_minobrazovaniya','Минобрнауки РФ','https://minobrnauki.gov.ru'],
                      ['emblem_roskomnadzor','Роскомнадзор','https://rkn.gov.ru'],
                      ['prokultura_full_horizontal','PRO.Культура.РФ','https://pro.culture.ru'],
                      ['natsproekty_kultura','Нацпроекты «Культура»','https://национальныепроекты.рф']] as [$img, $alt, $link]): ?>
        <a href="<?= h($link) ?>" target="_blank" rel="noopener" title="<?= h($alt) ?>"><img src="<?= asset('img/'.$img.'.webp') ?>" alt="<?= h($alt) ?>" loading="lazy"></a>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<?php if ($concerts): ?>
<section class="section">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow eyebrow--script">Смотрите</p>
      <h2>Онлайн-концерты</h2>
      <div class="gold-rule"></div>
    </div>
    <div class="grid grid-3">
      <?php foreach ($concerts as $c): ?>
        <div class="card card--3d reveal"><h3><?= h($c['title']) ?></h3><p style="color:var(--muted)"><?= h($c['category']) ?></p></div>
      <?php endforeach; ?>
    </div>
    <div style="text-align:center;margin-top:32px"><a class="btn btn--ghost" href="<?= url('/concerts') ?>">Все концерты</a></div>
  </div>
</section>
<?php endif; ?>

<?php if ($reviews): ?>
<section class="section section--parchment">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow eyebrow--script">Нам доверяют</p>
      <h2>Отзывы участников</h2>
      <div class="gold-rule"></div>
    </div>
    <div class="grid grid-3">
      <?php foreach ($reviews as $r): ?>
        <div class="card reveal">
          <p style="font-family:var(--ff-serif);font-size:1.15rem;color:var(--text)">«<?= h($r['text']) ?>»</p>
          <p style="color:var(--gold);font-weight:700;margin:0"><?= h($r['author']) ?></p>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<?php endif; ?>

<section class="section">
  <div class="container" style="max-width:680px;text-align:center">
    <div class="reveal">
      <p class="eyebrow eyebrow--script">Будьте в курсе</p>
      <h2>Узнавайте первыми о новых конкурсах</h2>
      <form method="post" action="<?= url('/api/v1/subscribe') ?>" class="subscribe-form" onsubmit="return muzmirSubscribe(event)">
        <?= csrf_field() ?>
        <input type="hidden" name="source" value="home_newsletter">
        <input type="email" name="email" placeholder="Ваша электронная почта" required>
        <button class="btn btn--primary" type="submit">Подписаться</button>
      </form>
      <p style="font-size:.82rem;color:var(--muted);margin-top:12px">Нажимая «Подписаться», Вы соглашаетесь с <a href="<?= url('/privacy') ?>">Политикой конфиденциальности</a>.</p>
    </div>
  </div>
</section>

<section class="section section--tint">
  <div class="container" style="max-width:760px;text-align:center">
    <div class="reveal">
      <p class="eyebrow eyebrow--script">Ваш талант ждёт сцены</p>
      <h2>Присоединяйтесь к «Музыкальному Миру»</h2>
      <div class="gold-rule" style="margin-inline:auto"></div>
      <p class="lead" style="margin-inline:auto">Бесплатное участие, честная оценка компетентного жюри и признание Ваших достижений - из любого региона России и мира.</p>
      <div class="hero-cta" style="justify-content:center;margin-top:24px">
        <a class="btn btn--primary btn--lg" href="<?= url('/apply') ?>">Подать заявку</a>
        <a class="btn btn--ghost btn--lg" href="<?= url('/about') ?>">О центре</a>
      </div>
      <p style="color:var(--muted);font-size:.9rem;margin-top:22px">
        Основатель и генеральный директор - <b style="color:var(--text)">Ильясов Альберт Ильясович</b>,
        заслуженный деятель культуры, лауреат международных конкурсов.
      </p>
    </div>
  </div>
</section>

<style>
/* Hero: вращающиеся золотые кольца-ореолы вокруг лого (декор, поверх существующего) */
.hero-media .hero-ring{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:1;
  width:min(430px,94%);aspect-ratio:1;border-radius:50%;pointer-events:none;
  background:conic-gradient(from 0deg,transparent 0 62%,var(--gold) 78%,transparent 92%);
  -webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 2px));
  mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 calc(100% - 2px));
  opacity:.55;animation:heroSpin 16s linear infinite}
.hero-media .hero-ring--2{width:min(360px,80%);opacity:.35;
  background:conic-gradient(from 180deg,transparent 0 68%,var(--gold-2) 82%,transparent 96%);
  animation-duration:22s;animation-direction:reverse}
[data-theme="dark"] .hero-media .hero-ring{background:conic-gradient(from 0deg,transparent 0 62%,var(--gold) 78%,transparent 92%)}
@keyframes heroSpin{to{transform:translate(-50%,-50%) rotate(360deg)}}

/* Премиальные обложки конкурсов (реальная афиша $c['cover'] или богатый фолбэк) */
.comp-card{padding:0;display:flex;flex-direction:column}
.comp-card .cc-cover{aspect-ratio:4/5;background:var(--grad-gold);position:relative;overflow:hidden;border-radius:0}
.comp-card .cc-cover .cc-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;z-index:2;display:block}
.cc-scrim{position:absolute;inset:0;z-index:3;pointer-events:none;
  background:linear-gradient(180deg,rgba(18,12,2,.42) 0,rgba(18,12,2,0) 26%,rgba(18,12,2,0) 60%,rgba(18,12,2,.34) 100%)}
.cc-fallback{position:absolute;inset:0;z-index:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:16px;overflow:hidden;text-align:center;padding:18px;
  background:radial-gradient(125% 92% at 50% -12%,rgba(255,255,255,.34),transparent 55%),
   linear-gradient(150deg,var(--fb-a,#E6C766),var(--fb-b,#C9A84C) 46%,#8B6F1F)}
.cc-fallback-glow{position:absolute;left:50%;top:66%;width:150%;aspect-ratio:1;transform:translate(-50%,-50%);
  background:radial-gradient(circle,var(--fb-glow,rgba(255,255,255,.5)),transparent 60%);opacity:.55;pointer-events:none}
.cc-fallback-pat{position:absolute;inset:0;width:100%;height:100%;color:#fff8e6;opacity:.15;pointer-events:none}
.cc-mono{position:relative;font-family:var(--ff-display);font-weight:800;color:#fff;line-height:.9;letter-spacing:.02em;
  font-size:clamp(2.6rem,9vw,3.9rem);text-shadow:0 6px 26px rgba(52,34,0,.42)}
.cc-code{position:relative;display:inline-flex;align-items:center;font-family:var(--ff-body);font-weight:800;
  font-size:.72rem;letter-spacing:.26em;text-indent:.26em;color:#3a2a06;background:rgba(255,255,255,.9);
  border:1px solid rgba(255,255,255,.92);padding:6px 14px;border-radius:999px;box-shadow:0 6px 18px rgba(52,34,0,.22)}
.cc-cover-badge{position:absolute;top:12px;left:12px;z-index:4;box-shadow:0 4px 16px rgba(0,0,0,.28)}
.cc-cover--s0{--fb-a:#E6C766;--fb-b:#C9A84C}
.cc-cover--s1{--fb-a:#F0D488;--fb-b:#B8973B}
.cc-cover--s2{--fb-a:#E8CE8A;--fb-b:#A98A38;--fb-glow:rgba(245,200,156,.6)}
.cc-cover--s3{--fb-a:#DEC97E;--fb-b:#8B6F1F;--fb-glow:rgba(143,188,148,.5)}
.cc-cover--s4{--fb-a:#EAD08A;--fb-b:#BE9C40}
.comp-card .cc-body{display:flex;flex-direction:column;gap:12px;flex:1;padding:22px}
.comp-card .cc-body h3{margin:2px 0 0;overflow-wrap:anywhere}
.comp-card .cc-meta{margin:0}
.comp-card .btn{margin-top:auto}

/* Моушен-микровзаимодействия (только transform/opacity) */
.comp-card .cc-img{transition:transform .5s cubic-bezier(.2,.8,.2,1)}
@media (hover:hover){
  .comp-card:hover .cc-img{transform:scale(1.05)}
  .partners a{transition:transform .28s cubic-bezier(.2,.8,.2,1),opacity .28s ease}
  .partners a:hover{transform:translateY(-4px)}
  .hero-trust li{transition:transform .2s ease}
  .hero-trust li:hover{transform:translateY(-2px)}
}
@media (prefers-reduced-motion:reduce){
  .hero-media .hero-ring{animation:none}
  .comp-card .cc-img,.partners a,.hero-trust li{transition:none}
  .comp-card:hover .cc-img,.partners a:hover,.hero-trust li:hover{transform:none}
}
</style>
<script>
function muzmirSubscribe(e){
  e.preventDefault();
  var f = e.target;
  fetch(f.action, {method:'POST', body:new FormData(f)})
    .then(function(r){return r.json();})
    .then(function(d){window.toast(d.message || 'Спасибо за подписку!', 'success'); f.reset();})
    .catch(function(){window.toast('Спасибо за подписку!', 'success');});
  return false;
}
</script>
<?php
$content = ob_get_clean();
render_page('Главная', $content, ['active' => '/', 'meta' => 'КЦ «Музыкальный Мир» - международные и всероссийские онлайн-конкурсы и фестивали культуры и искусства. Подача заявок, дипломы, награды онлайн.']);
