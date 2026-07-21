<?php
/** Каталог конкурсов: фильтры, сортировка, сетка карточек. */

/* --- Справочники значений фильтров --- */
$STATUS_FILTERS = ['active' => 'Активные', 'finished' => 'Завершённые', 'all' => 'Все'];
$TYPE_FILTERS   = ['all' => 'Все', 'international' => 'Международные', 'national' => 'Всероссийские'];
$DIR_FILTERS    = ['all' => 'Любая', 'multi' => 'Многожанровые', 'patriotic' => 'Патриотические', 'thematic' => 'Тематические'];
$SORT_FILTERS   = ['default' => 'По порядку', 'soon' => 'Скоро завершатся', 'name' => 'По названию'];

$dirLabel = ['multi' => 'Многожанровый', 'patriotic' => 'Патриотический', 'thematic' => 'Тематический'];

/* --- Выбранные значения --- */
$fStatus = input('status', 'active'); if (!isset($STATUS_FILTERS[$fStatus])) $fStatus = 'active';
$fType   = input('type', 'all');      if (!isset($TYPE_FILTERS[$fType]))     $fType   = 'all';
$fDir    = input('dir', 'all');       if (!isset($DIR_FILTERS[$fDir]))       $fDir    = 'all';
$fSort   = input('sort', 'default');  if (!isset($SORT_FILTERS[$fSort]))     $fSort   = 'default';

/* --- Сборка запроса --- */
$where = ["status <> 'draft'"];
$args  = [];
if ($fStatus === 'active')   $where[] = "status IN ('open','judging')";
if ($fStatus === 'finished') $where[] = "status IN ('closed','finished')";
if ($fType !== 'all') { $where[] = "type = ?";      $args[] = $fType; }
if ($fDir !== 'all')  { $where[] = "direction = ?"; $args[] = $fDir; }

$order = match ($fSort) {
    'soon' => "CASE WHEN end_date IS NULL OR end_date = '' THEN 1 ELSE 0 END, end_date ASC, sort ASC",
    'name' => "name COLLATE NOCASE ASC",
    default => "sort ASC, id ASC",
};

$comps = all("SELECT * FROM competitions WHERE " . implode(' AND ', $where) . " ORDER BY $order", $args);

/* --- Хелпер статуса карточки --- */
$statusView = static function (string $s): array {
    return match ($s) {
        'open'    => ['open', 'Приём открыт'],
        'judging' => ['intl', 'Идёт оценка'],
        default   => ['closed', 'Завершён'],
    };
};

$icoFilter = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M22 3H2l8 9.46V19l4 2v-8.54z"/></svg>';
$icoArrow  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

ob_start(); ?>
<section class="section section--tint">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Каталог</p>
      <h2>Конкурсы и фестивали</h2>
      <div class="gold-rule"></div>
      <p>Выберите конкурс, ознакомьтесь с положением и подайте заявку. Работы оценивает компетентное жюри, результаты приходят на Вашу почту.</p>
    </div>

    <form class="comp-filters reveal" method="get" action="<?= url('/competitions') ?>">
      <div class="cf-chips" role="group" aria-label="Статус конкурса">
        <?php foreach ($STATUS_FILTERS as $val => $label): ?>
          <label class="cf-chip<?= $fStatus === $val ? ' is-active' : '' ?>">
            <input type="radio" name="status" value="<?= h($val) ?>" <?= $fStatus === $val ? 'checked' : '' ?> onchange="this.form.submit()">
            <span><?= h($label) ?></span>
          </label>
        <?php endforeach; ?>
      </div>
      <div class="cf-selects">
        <label class="cf-select">
          <span><?= $icoFilter ?>Тип</span>
          <select name="type" onchange="this.form.submit()">
            <?php foreach ($TYPE_FILTERS as $val => $label): ?>
              <option value="<?= h($val) ?>" <?= $fType === $val ? 'selected' : '' ?>><?= h($label) ?></option>
            <?php endforeach; ?>
          </select>
        </label>
        <label class="cf-select">
          <span>Направленность</span>
          <select name="dir" onchange="this.form.submit()">
            <?php foreach ($DIR_FILTERS as $val => $label): ?>
              <option value="<?= h($val) ?>" <?= $fDir === $val ? 'selected' : '' ?>><?= h($label) ?></option>
            <?php endforeach; ?>
          </select>
        </label>
        <label class="cf-select">
          <span>Сортировка</span>
          <select name="sort" onchange="this.form.submit()">
            <?php foreach ($SORT_FILTERS as $val => $label): ?>
              <option value="<?= h($val) ?>" <?= $fSort === $val ? 'selected' : '' ?>><?= h($label) ?></option>
            <?php endforeach; ?>
          </select>
        </label>
        <noscript><button class="btn btn--ghost" type="submit">Показать</button></noscript>
      </div>
    </form>
  </div>
</section>

<section class="section">
  <div class="container">
    <?php if (!$comps): ?>
      <div class="card reveal" style="text-align:center">
        <h3>Ничего не найдено</h3>
        <p style="color:var(--muted)">По выбранным условиям конкурсов нет. Измените фильтры или посмотрите <a href="<?= url('/competitions') ?>">все конкурсы</a>.</p>
      </div>
    <?php else: ?>
      <p class="cf-count reveal"><?= count($comps) ?> <?= (count($comps) % 10 === 1 && count($comps) % 100 !== 11) ? 'конкурс' : ((count($comps) % 10 >= 2 && count($comps) % 10 <= 4 && (count($comps) % 100 < 10 || count($comps) % 100 >= 20)) ? 'конкурса' : 'конкурсов') ?></p>
      <div class="grid grid-3">
        <?php foreach ($comps as $c): [$badgeClass, $badgeLabel] = $statusView($c['status']); ?>
          <a class="card comp-card reveal" href="<?= url('/competition/' . $c['slug']) ?>">
            <div class="cc-cover">
              <?php if (!empty($c['cover'])): ?>
                <img src="<?= h($c['cover']) ?>" alt="<?= h($c['name']) ?>" loading="lazy" style="width:100%;height:100%;object-fit:cover">
              <?php else: ?>
                <?= h($c['name']) ?>
              <?php endif; ?>
            </div>
            <div class="cc-body">
              <div class="cc-badges">
                <span class="badge badge--<?= $badgeClass ?>"><?= h($badgeLabel) ?></span>
                <span class="badge badge--intl"><?= $c['type'] === 'international' ? 'Международный' : 'Всероссийский' ?></span>
              </div>
              <h3 style="margin-top:12px"><?= h($c['name']) ?></h3>
              <div class="cc-meta">
                <span><?= h($dirLabel[$c['direction']] ?? 'Многожанровый') ?></span>
                <?php if (!empty($c['start_date'])): ?><span>· приём с <?= h(ru_date($c['start_date'])) ?></span><?php endif; ?>
                <?php if (!empty($c['end_date'])): ?><span>· до <?= h(ru_date($c['end_date'])) ?></span><?php endif; ?>
              </div>
              <span class="btn btn--ghost btn--block">Подробнее <?= $icoArrow ?></span>
            </div>
          </a>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>
</section>

<style>
.comp-filters{display:flex;flex-direction:column;gap:18px;margin-top:8px}
.cf-chips{display:flex;flex-wrap:wrap;gap:10px;justify-content:center}
.cf-chip{position:relative;cursor:pointer}
.cf-chip input{position:absolute;opacity:0;width:0;height:0}
.cf-chip span{display:inline-block;padding:9px 20px;border-radius:999px;border:1.5px solid var(--gold);
  background:rgba(255,255,255,.7);color:var(--gold-dark);font-weight:700;font-size:.92rem;transition:background .18s,color .18s,transform .18s}
.cf-chip:hover span{transform:translateY(-2px)}
.cf-chip.is-active span{background:var(--grad-gold);color:#fff;border-color:transparent;box-shadow:var(--shadow-btn)}
.cf-selects{display:flex;flex-wrap:wrap;gap:14px;justify-content:center}
.cf-select{display:flex;flex-direction:column;gap:6px;min-width:190px}
.cf-select>span{display:flex;align-items:center;gap:7px;font-size:.82rem;font-weight:700;color:var(--muted);letter-spacing:.02em}
.cf-select>span svg{width:16px;height:16px;color:var(--gold-dark)}
.cc-badges{display:flex;flex-wrap:wrap;gap:8px}
.cf-count{color:var(--muted);font-size:.9rem;margin-bottom:18px}
</style>
<?php
$content = ob_get_clean();
render_page('Конкурсы', $content, [
    'active' => '/competitions',
    'meta' => 'Каталог международных и всероссийских онлайн-конкурсов и фестивалей культуры и искусства КЦ «Музыкальный Мир». Активные и завершённые конкурсы, подача заявок онлайн.',
]);
