<?php
/** Каталог конкурсов: JS-табы статуса, серверные фильтры, премиум-сетка карточек. */

/* --- Справочники значений фильтров --- */
$STATUS_FILTERS = ['active' => 'Открытые', 'all' => 'Все'];
$TYPE_FILTERS   = ['all' => 'Все', 'international' => 'Международные', 'national' => 'Всероссийские'];
$DIR_FILTERS    = ['all' => 'Любая', 'multi' => 'Многожанровые', 'patriotic' => 'Патриотические', 'thematic' => 'Тематические'];
$SORT_FILTERS   = ['default' => 'По порядку', 'soon' => 'Скоро завершатся', 'name' => 'По названию'];

$dirLabel = ['multi' => 'Многожанровый', 'patriotic' => 'Патриотический', 'thematic' => 'Тематический'];

/* --- Выбранные значения --- */
$fStatus = input('status', 'active'); if (!isset($STATUS_FILTERS[$fStatus])) $fStatus = 'active';
$fType   = input('type', 'all');      if (!isset($TYPE_FILTERS[$fType]))     $fType   = 'all';
$fDir    = input('dir', 'all');       if (!isset($DIR_FILTERS[$fDir]))       $fDir    = 'all';
$fSort   = input('sort', 'default');  if (!isset($SORT_FILTERS[$fSort]))     $fSort   = 'default';

/* --- Серверная выборка из БД (type/dir/sort фильтруют на сервере; статус -
   таб на JS-хуках поверх полной выборки, с noscript-фолбэком через CSS/ссылку). --- */
$where = ["status <> 'draft'"];
$args  = [];
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
    // [класс бейджа, подпись, признак завершённости]
    return match ($s) {
        'open'    => ['open', 'Приём открыт', 0],
        'judging' => ['judging', 'Идёт оценка', 0],
        default   => ['closed', 'Завершён', 1],
    };
};

/* Счётчик открытых - для подписи под табами. */
$openCount = 0;
foreach ($comps as $c) { if (in_array($c['status'], ['open', 'judging'], true)) $openCount++; }

/* Начальный вид (noscript и до инициализации JS): открытые или все. */
$viewClass = $fStatus === 'all' ? 'cf-grid--all' : 'cf-grid--open';

$icoFilter = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M22 3H2l8 9.46V19l4 2v-8.54z"/></svg>';
$icoArrow  = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="16" height="16"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
$icoCal    = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="15" height="15"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M3 10h18M8 2v4M16 2v4"/></svg>';
$icoCoin   = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="15" height="15"><circle cx="12" cy="12" r="9"/><path d="M12 7v10M9.5 9.2c0-1 1-1.7 2.5-1.7s2.5.7 2.5 1.7-1 1.6-2.5 1.6-2.5.7-2.5 1.7 1 1.7 2.5 1.7 2.5-.7 2.5-1.7"/></svg>';

/* Ссылка табов - серверный фолбэк без JS (сохраняет остальные фильтры). */
$tabHref = static function (string $status) use ($fType, $fDir, $fSort): string {
    $q = http_build_query(array_filter([
        'status' => $status, 'type' => $fType !== 'all' ? $fType : '',
        'dir' => $fDir !== 'all' ? $fDir : '', 'sort' => $fSort !== 'default' ? $fSort : '',
    ]));
    return url('/competitions') . ($q ? '?' . $q : '');
};

ob_start(); ?>
<section class="section section--tint">
  <div class="container">
    <a class="aw-back" href="<?= url('/menu') ?>"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>Назад</a>
    <div class="section-head reveal">
      <p class="eyebrow">Каталог</p>
      <h2>Конкурсы и фестивали</h2>
      <div class="gold-rule"></div>
      <p>Выберите конкурс, ознакомьтесь с положением и подайте заявку. Работы оценивает компетентное жюри, результаты приходят на Вашу почту.</p>
    </div>

    <div class="comp-filters reveal">
      <div class="cf-tabs" role="tablist" aria-label="Статус конкурса">
        <?php foreach ($STATUS_FILTERS as $val => $label): ?>
          <a class="cf-tab<?= $fStatus === $val ? ' is-active' : '' ?>"
             href="<?= h($tabHref($val)) ?>"
             role="tab" aria-selected="<?= $fStatus === $val ? 'true' : 'false' ?>"
             data-status-tab="<?= h($val) ?>">
            <span><?= h($label) ?></span>
          </a>
        <?php endforeach; ?>
      </div>

      <form class="cf-selects" method="get" action="<?= url('/competitions') ?>">
        <input type="hidden" name="status" value="<?= h($fStatus) ?>" data-status-field>
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
      </form>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <?php if (!$comps): ?>
      <div class="card reveal" style="text-align:center">
        <h3>Ничего не найдено</h3>
        <p style="color:var(--muted)">По выбранным условиям конкурсов нет. Измените фильтры или посмотрите <a href="<?= h($tabHref('all')) ?>">все конкурсы</a>.</p>
      </div>
    <?php else: ?>
      <p class="cf-count reveal" data-count-all="<?= count($comps) ?>" data-count-open="<?= $openCount ?>">
        <span data-count-label></span>
      </p>
      <div class="grid grid-3 cf-grid <?= $viewClass ?>" data-comp-grid>
        <?php foreach ($comps as $c):
          [$badgeClass, $badgeLabel, $isFin] = $statusView($c['status']);
          $isPaid = !empty($c['is_paid']) && (int) $c['price'] > 0;
          $cvName = (string) $c['name'];
          $cvMono = '';
          foreach (preg_split('/\s+/u', trim($cvName)) as $cw) {
              if ($cw !== '' && mb_strlen($cvMono) < 2) $cvMono .= mb_strtoupper(mb_substr($cw, 0, 1));
          }
          $cvCode = mb_strtoupper(trim((string) ($c['code'] ?? '')));
          $cvSeed = (int) ($c['id'] ?? 0) % 5;
          $cvCover = trim((string) ($c['cover'] ?? ''));
          if ($cvCover !== '') $cvCover = preg_replace('~^https?://(?:localhost|127\.0\.0\.1)(?::\d+)?~i', '', $cvCover);
        ?>
          <a class="card comp-card card--3d reveal" data-fin="<?= $isFin ?>" href="<?= url('/competition/' . $c['slug']) ?>">
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
                <img class="cc-img" src="<?= h($cvCover) ?>" alt="Афиша конкурса «<?= h($cvName) ?>»" loading="lazy" decoding="async" style="view-transition-name:comp-cover-<?= (int)$c['id'] ?>" onerror="this.remove()">
                <span class="cc-scrim" aria-hidden="true"></span>
              <?php endif; ?>
              <span class="cc-cover-badge badge badge--<?= $badgeClass ?>"><?= h($badgeLabel) ?></span>
            </div>
            <div class="cc-body">
              <div class="cc-badges">
                <span class="badge badge--intl"><?= $c['type'] === 'international' ? 'Международный' : 'Всероссийский' ?></span>
                <span class="cc-fee<?= $isPaid ? '' : ' cc-fee--free' ?>">
                  <?= $icoCoin ?><?= $isPaid ? 'Взнос ' . (int) $c['price'] . ' ₽' : 'Участие бесплатное' ?>
                </span>
              </div>
              <h3 class="cc-title"><?= h($c['name']) ?></h3>
              <div class="cc-meta">
                <span><?= h($dirLabel[$c['direction']] ?? 'Многожанровый') ?></span>
                <?php if (!empty($c['end_date'])): ?>
                  <span class="cc-date"><?= $icoCal ?><?= $isFin ? 'приём завершён ' : 'приём до ' ?><?= h(ru_date($c['end_date'])) ?></span>
                <?php elseif (!empty($c['start_date'])): ?>
                  <span class="cc-date"><?= $icoCal ?>приём с <?= h(ru_date($c['start_date'])) ?></span>
                <?php endif; ?>
              </div>
              <span class="btn btn--ghost btn--block">Подробнее <?= $icoArrow ?></span>
            </div>
          </a>
        <?php endforeach; ?>
      </div>
      <div class="cf-empty reveal" data-comp-empty hidden>
        <p style="color:var(--muted);text-align:center">Сейчас нет открытых конкурсов по выбранным условиям. Посмотрите <a href="#" data-show-all>все конкурсы</a>.</p>
      </div>
    <?php endif; ?>
  </div>
</section>

<style>
.comp-filters{display:flex;flex-direction:column;gap:20px;margin-top:8px}
.cf-tabs{display:inline-flex;align-self:center;gap:4px;padding:5px;border-radius:999px;
  border:1.5px solid var(--glass-brd);background:var(--glass);backdrop-filter:blur(10px);max-width:100%}
.cf-tab{display:inline-flex;align-items:center;justify-content:center;padding:10px 26px;min-height:44px;
  border-radius:999px;font-weight:800;font-size:.92rem;color:var(--muted);white-space:nowrap;
  transition:color .2s,background .2s,box-shadow .2s;text-decoration:none}
.cf-tab:hover{color:var(--gold)}
.cf-tab.is-active{background:var(--grad-gold);color:var(--gold-fg);box-shadow:var(--shadow-btn)}
.cf-selects{display:flex;flex-wrap:wrap;gap:14px;justify-content:center}
.cf-select{display:flex;flex-direction:column;gap:6px;min-width:190px}
.cf-select>span{display:flex;align-items:center;gap:7px;font-size:.82rem;font-weight:700;color:var(--muted);letter-spacing:.02em}
.cf-select>span svg{width:16px;height:16px;color:var(--gold)}
.cf-count{color:var(--muted);font-size:.9rem;margin-bottom:18px}

.comp-card{padding:0;display:flex;flex-direction:column}
/* Премиальная обложка: реальная афиша $c['cover'] или богатый фолбэк с монограммой и кодом */
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
.cc-cover--s0{--fb-a:#E6C766;--fb-b:#C9A84C}
.cc-cover--s1{--fb-a:#F0D488;--fb-b:#B8973B}
.cc-cover--s2{--fb-a:#E8CE8A;--fb-b:#A98A38;--fb-glow:rgba(245,200,156,.6)}
.cc-cover--s3{--fb-a:#DEC97E;--fb-b:#8B6F1F;--fb-glow:color-mix(in srgb,var(--mint) 50%,transparent)}
.cc-cover--s4{--fb-a:#EAD08A;--fb-b:#BE9C40}
.cc-cover-badge{position:absolute;top:12px;left:12px;z-index:4;box-shadow:0 4px 16px rgba(0,0,0,.28);backdrop-filter:blur(6px)}
.cc-body{display:flex;flex-direction:column;gap:12px;flex:1;padding:22px}
.cc-badges{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.cc-fee{display:inline-flex;align-items:center;gap:6px;font-size:.72rem;font-weight:800;letter-spacing:.04em;
  text-transform:uppercase;padding:5px 12px;border-radius:999px;color:var(--gold-deep);
  background:var(--gold-soft);border:1px solid var(--glass-brd)}
.cc-fee svg{color:var(--gold)}
.cc-fee--free{color:var(--mint);background:color-mix(in srgb,var(--mint) 14%,transparent);border-color:color-mix(in srgb,var(--mint) 30%,transparent)}
.cc-fee--free svg{color:var(--mint)}
.cc-title{margin:2px 0 0;overflow-wrap:anywhere;word-break:break-word;hyphens:auto}
.cc-date{display:inline-flex;align-items:center;gap:6px}
.cc-date svg{color:var(--gold);flex:none}
.comp-card .btn{margin-top:auto}

/* Табы статуса: без JS фильтрует серверный класс, с JS - мгновенно. */
.cf-grid--open .comp-card[data-fin="1"]{display:none}

/* Моушен-микро: обложка мягко «дышит» при наведении на карточку, стрелка едет вправо */
@media (hover:hover){
  .comp-card .cc-img{transition:transform .5s cubic-bezier(.2,.8,.2,1)}
  .comp-card:hover .cc-img{transform:scale(1.04)}
  .comp-card .btn svg{transition:transform .25s ease}
  .comp-card:hover .btn svg{transform:translateX(3px)}
}

@media (prefers-reduced-motion:reduce){
  .comp-card .cc-img{transition:none;view-transition-name:none!important}
  .comp-card:hover .cc-img{transform:none}
  .comp-card .btn svg,.comp-card:hover .btn svg{transition:none;transform:none}
}

@media (max-width:640px){
  .cf-tab{padding:10px 20px;flex:1}
  .cf-select{min-width:0;width:100%}
}
</style>

<script>
(function () {
  var grid = document.querySelector('[data-comp-grid]');
  if (!grid) return;
  var tabs = Array.prototype.slice.call(document.querySelectorAll('[data-status-tab]'));
  var field = document.querySelector('[data-status-field]');
  var count = document.querySelector('[data-count-label]');
  var countBox = count ? count.closest('.cf-count') : null;
  var empty = document.querySelector('[data-comp-empty]');
  var reduce = window.matchMedia('(prefers-reduced-motion:reduce)').matches;

  function plural(n, forms) {
    var n10 = n % 10, n100 = n % 100;
    if (n10 === 1 && n100 !== 11) return forms[0];
    if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return forms[1];
    return forms[2];
  }

  function apply(status) {
    var open = status !== 'all';
    grid.classList.toggle('cf-grid--open', open);
    grid.classList.toggle('cf-grid--all', !open);
    tabs.forEach(function (t) {
      var on = t.getAttribute('data-status-tab') === status;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    if (field) field.value = status;

    // Каскад заново по видимым карточкам.
    var visible = Array.prototype.filter.call(grid.children, function (el) {
      return el.offsetParent !== null || getComputedStyle(el).display !== 'none';
    });
    visible.forEach(function (el, i) {
      if (!reduce) el.style.transitionDelay = (i * 60) + 'ms';
      el.classList.remove('in');
    });
    // reflow, затем показать
    void grid.offsetWidth;
    visible.forEach(function (el) { el.classList.add('in'); });

    // Счётчик и пустое состояние.
    var all = parseInt(countBox && countBox.getAttribute('data-count-all') || '0', 10);
    var op = parseInt(countBox && countBox.getAttribute('data-count-open') || '0', 10);
    var n = open ? op : all;
    if (count) count.textContent = n + ' ' + plural(n, ['конкурс', 'конкурса', 'конкурсов']);
    if (empty) empty.hidden = !(open && op === 0);
  }

  tabs.forEach(function (t) {
    t.addEventListener('click', function (e) {
      e.preventDefault();
      apply(t.getAttribute('data-status-tab'));
      history.replaceState(null, '', t.getAttribute('href'));
    });
  });

  var showAll = document.querySelector('[data-show-all]');
  if (showAll) showAll.addEventListener('click', function (e) { e.preventDefault(); apply('all'); });

  // Начальная синхронизация подписи по серверному классу.
  apply(grid.classList.contains('cf-grid--all') ? 'all' : 'active');
})();
</script>
<?php
$content = ob_get_clean();

/* --- SEO: schema.org ItemList по открытым конкурсам (name, url). --- */
$listItems = [];
$pos = 0;
foreach ($comps as $c) {
    if (!in_array($c['status'], ['open', 'judging'], true)) continue;
    $listItems[] = [
        '@type'    => 'ListItem',
        'position' => ++$pos,
        'name'     => $c['name'],
        'url'      => url('/competition/' . rawurlencode($c['slug'])),
    ];
}
$jsonld = [];
if ($listItems) {
    $jsonld[] = [
        '@context'        => 'https://schema.org',
        '@type'           => 'ItemList',
        'name'            => 'Открытые конкурсы КЦ «Музыкальный Мир»',
        'url'             => url('/competitions'),
        'numberOfItems'   => count($listItems),
        'itemListElement' => $listItems,
    ];
}

render_page('Конкурсы', $content, [
    'active' => '/competitions',
    'meta' => 'Каталог международных и всероссийских онлайн-конкурсов и фестивалей культуры и искусства КЦ «Музыкальный Мир». Открытые и завершённые конкурсы, подача заявок онлайн.',
    'jsonld' => $jsonld ?: null,
]);
