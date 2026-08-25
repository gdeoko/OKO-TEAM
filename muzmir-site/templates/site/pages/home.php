<?php
/** Главная страница - флагман. Серверная логика и выборки из БД сохранены. */
require_once BASE_PATH . '/templates/site/partials/heatmap.php';

$YEARS = max(1, (int) date('Y') - 2020);

/* Инфографика - реальные цифры (эталон данных), с фолбэком на настройки БД. */
$infographic = [
  ['val' => (int) setting('stat_competitions', '5000'), 'suf' => '+', 'label' => 'Конкурсов проведено', 'note' => 'международных и всероссийских'],
  ['val' => (int) setting('stat_participants', '300000'), 'suf' => '+', 'label' => 'Участников', 'note' => 'со всего мира'],
  ['val' => (int) setting('stat_years', '7'), 'suf' => '+', 'label' => 'Лет в искусстве', 'note' => 'с 2020 года'],
  ['val' => (int) setting('stat_countries', '15'), 'suf' => '+', 'label' => 'Стран-участниц', 'note' => 'СНГ и дальнее зарубежье'],
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

/* Быстрые действия для авторизованных: последняя заявка, ближайший дедлайн */
$currentUser = current_user();
$quickApp = null; $quickDeadline = null;
if ($currentUser) {
    $quickApp = one("SELECT a.*, c.name AS comp_name, c.slug AS comp_slug, c.end_date FROM applications a
                     JOIN competitions c ON c.id=a.competition_id
                     WHERE a.user_id=? ORDER BY a.created_at DESC LIMIT 1", [(int)$currentUser['id']]);
}
// Ближайший дедлайн среди открытых конкурсов (для всех — как «горит»)
$quickDeadline = one("SELECT name, slug, end_date FROM competitions
                      WHERE status='open' AND end_date IS NOT NULL AND end_date >= date('now','localtime')
                      ORDER BY end_date ASC LIMIT 1");
$quickAppStatusLbl = ['new'=>['Не оплачена','pay'],'paid'=>['Оплачена — ждёт оценки','ok'],
                      'judging'=>['На оценке жюри','warn'],'graded'=>['Оценена','ok'],
                      'sent'=>['Диплом отправлен','ok'],'rejected'=>['Отклонена','err']];

ob_start(); ?>
<section class="hero">
  <div class="hero-notes" aria-hidden="true"></div>
  <div class="hero-glow" aria-hidden="true"></div>
  <div class="container">
    <div class="reveal hero-media">
      <span class="hero-ring" aria-hidden="true"></span>
      <span class="hero-ring hero-ring--2" aria-hidden="true"></span>
      <img class="hero-logo" src="<?= asset('img/logo_muzmir_main.webp') ?>" alt="Логотип Культурного центра «Музыкальный Мир»" width="380" height="380" style="view-transition-name:hero-logo">
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
        <li><span class="hero-trust-ic"><?= $icons['globe'] ?></span>Портал «Про.Культура.РФ»</li>
      </ul>
      <div class="hero-eq" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
    </div>
  </div>
</section>


<!-- Анимационный разделитель -->
<div class="mz-divider" aria-hidden="true"><i></i></div>

<section class="section">
  <div class="container">
    <div class="section-head reveal" style="margin-bottom:14px">
      <?php /* Подпись не должна обещать приём, когда он закрыт: после 25-го числа
               «Приём открыт» над пустым списком читается как обман. */ ?>
      <p class="eyebrow eyebrow--script"><?= $comps ? 'Приём открыт' : 'Приём закрыт' ?></p>
      <h2>Действующие конкурсы</h2>
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
          $cvRaw = trim((string) ($c['cover'] ?? ''));
          $cvCover = '';
          if ($cvRaw !== '') {
            $cvCover = preg_match('~^https?://~', $cvRaw) ? $cvRaw : url('/' . ltrim($cvRaw, '/'));
            $cvMt = @filemtime(BASE_PATH . '/public/' . ltrim(preg_replace('~^https?://[^/]+~', '', $cvRaw), '/'));
            if ($cvMt) $cvCover .= (strpos($cvCover, '?') !== false ? '&' : '?') . 'v=' . $cvMt; // анти-кэш при замене афиши
          }
          $isOpen = $c['status'] === 'open';
          $dirName = ['multi' => 'Многожанровый', 'patriotic' => 'Патриотический', 'thematic' => 'Тематический'][$c['direction'] ?? 'multi'] ?? 'Многожанровый';
        ?>
        <div class="card card--3d comp-card reveal">
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
            <h3><a class="cc-link" href="<?= url('/competition/'.$c['slug']) ?>"><?= h($cvName) ?></a></h3>
            <div class="cc-meta"><span><?= h($dirName) ?></span><?php if (!empty($c['end_date'])): ?><span>приём до <?= h(ru_date($c['end_date'])) ?></span><?php endif; ?></div>
            <?php /* Кнопки те же, что в календаре: подать заявку и посмотреть положение.
                     Раньше здесь было безадресное «Подробнее» — лишний шаг между
                     человеком и заявкой. */ ?>
            <div class="cc-actions">
              <?php if ($isOpen): ?>
                <a class="btn btn--primary btn--sm" href="<?= url('/apply') . '?competition=' . rawurlencode($c['slug']) ?>">Подать заявку</a>
              <?php endif; ?>
              <a class="btn btn--ghost btn--sm" href="<?= url('/competition/' . $c['slug'] . '/regulation.pdf') ?>">Положение</a>
            </div>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
    <?php else: ?>
      <?php
      /* ЗАКРЫТЫЙ ПРИЁМ ОБЪЯСНЯЕТСЯ И НА ГЛАВНОЙ.
         После 25-го числа список действующих конкурсов пустеет, и здесь стояло
         общее «идёт подготовка» — человек не понимал, вернуться ли ему и когда,
         и не знал, что награды по прошедшим конкурсам всё ещё заказываются.
         Дату открытия ставит закрытие приёма (launch_close_intake), она же
         показана в афише и в форме заявки — везде одна. */
      $__intakeClosed = (string) setting('intake_closed', '') === '1';
      $__reopen       = (string) setting('intake_reopen_date', '');
      $__reopenTxt    = $__reopen !== '' ? ru_date($__reopen) : '1-го числа следующего месяца';
      ?>
      <?php if ($__intakeClosed): ?>
        <div class="card reveal" style="max-width:620px;margin:0 auto;text-align:center">
          <h3 style="margin:0 0 10px">Приём заявок этого месяца завершён</h3>
          <p style="color:var(--muted);margin:0">Новые конкурсы откроются <b><?= h($__reopenTxt) ?></b>.
            Наградной материал по прошедшим конкурсам заказывается в разделе
            <a href="<?= url('/awards') ?>">«Награды»</a> ещё два месяца после закрытия приёма.</p>
          <div style="margin-top:16px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
            <a class="btn btn--primary" href="<?= url('/awards') ?>">Заказать награды</a>
            <a class="btn btn--ghost" href="<?= url('/competitions') ?>">Афиша конкурсов</a>
          </div>
        </div>
      <?php else: ?>
        <p class="reveal" style="text-align:center;color:var(--muted)">Сейчас идёт подготовка новых конкурсов. Подпишитесь ниже - и узнаете первыми.</p>
      <?php endif; ?>
    <?php endif; ?>
    <div style="text-align:center;margin-top:36px"><a class="btn btn--primary" href="<?= url('/competitions') ?>">Все конкурсы</a></div>
  </div>
</section>

<?php
$content = ob_get_clean();
render_page('Главная', $content, ['active' => '/', 'meta' => 'Культурного центра «Музыкальный Мир» - международные и всероссийские онлайн-конкурсы и фестивали культуры и искусства. Подача заявок, дипломы, награды онлайн.']);
