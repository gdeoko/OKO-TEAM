<?php
/**
 * Календарь конкурсов на год: помесячная лента приёма заявок и результатов,
 * статусы конкурсов, напоминание за неделю до старта, тепловая карта регионов.
 */

/* --- Обработка формы «Напомнить о конкурсе» (без JS, обычный POST) --- */
$remindSlug = '';
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' && input('form') === 'remind') {
    $remindSlug = input('slug');
    $email = mb_strtolower(input('email'));
    $backYear = (int) input('year', (string) date('Y'));

    if (!csrf_check()) {
        flash('Сессия устарела. Обновите страницу и попробуйте снова.', 'error');
    } elseif (!rate_ok('calendar_remind:' . client_ip(), 20, 3600)) {
        flash('Слишком много запросов. Попробуйте позже.', 'error');
    } else {
        $ev = function_exists('v_email') ? v_email($email) : ['ok' => (bool) filter_var($email, FILTER_VALIDATE_EMAIL)];
        $comp = one("SELECT * FROM competitions WHERE slug = ? AND status <> 'draft'", [$remindSlug]);
        if (!($ev['ok'] ?? false)) {
            flash('Проверьте адрес электронной почты.', 'error');
        } elseif (!$comp) {
            flash('Конкурс не найден.', 'error');
        } else {
            $remindAt = '';
            if (!empty($comp['start_date'])) {
                $ts = strtotime((string) $comp['start_date']);
                if ($ts) $remindAt = date('Y-m-d', $ts - 7 * 86400);
            }
            // Тег хранит связку конкурс+дата напоминания в subscribers.tags (см. CONVENTIONS.md).
            $tagToken = 'calendar:' . $comp['slug'] . ':' . ($remindAt ?: 'now');
            $existing = one("SELECT id, tags FROM subscribers WHERE email = ?", [$email]);
            if ($existing) {
                $tags = array_values(array_filter(array_map('trim', explode(',', (string) $existing['tags']))));
                if (!in_array($tagToken, $tags, true)) $tags[] = $tagToken;
                update('subscribers', ['tags' => implode(',', $tags), 'active' => 1], 'id=:id', ['id' => (int) $existing['id']]);
            } else {
                insert('subscribers', [
                    'email'       => $email,
                    'name'        => input('name'),
                    'source'      => 'calendar',
                    'tags'        => $tagToken,
                    'unsub_token' => bin2hex(random_bytes(16)),
                    'active'      => 1,
                ]);
            }
            audit('calendar_remind', 'competitions', (int) $comp['id'], ['email' => $email, 'remind_at' => $remindAt]);
            flash('Напоминание оформлено. Мы напомним Вам о конкурсе «' . $comp['name'] . '» за неделю до начала приёма заявок.', 'success');
        }
    }
    redirect('/calendar?year=' . $backYear . '#comp-' . rawurlencode($remindSlug));
}

/* --- Выбор года и справочники --- */
$year = (int) input('year', (string) date('Y'));
if ($year < 2000 || $year > 2100) $year = (int) date('Y');
$today = date('Y-m-d');

$monthsRu = [1 => 'Январь', 2 => 'Февраль', 3 => 'Март', 4 => 'Апрель', 5 => 'Май', 6 => 'Июнь',
             7 => 'Июль', 8 => 'Август', 9 => 'Сентябрь', 10 => 'Октябрь', 11 => 'Ноябрь', 12 => 'Декабрь'];

$statusView = static function (string $s): array {
    return match ($s) {
        'open'    => ['open', 'Приём открыт'],
        'judging' => ['intl', 'Идёт оценка'],
        default   => ['closed', 'Завершён'],
    };
};

/* --- Годы, для которых есть хоть какие-то даты (для переключателя) --- */
$allDated = all("SELECT start_date, end_date, results_date FROM competitions WHERE status <> 'draft'");
$yearsSet = [$year => true, (int) date('Y') => true];
foreach ($allDated as $r) {
    foreach (['start_date', 'end_date', 'results_date'] as $f) {
        if (!empty($r[$f])) {
            $ts = strtotime((string) $r[$f]);
            if ($ts) $yearsSet[(int) date('Y', $ts)] = true;
        }
    }
}
$years = array_keys($yearsSet);
sort($years);

/* --- Конкурсы, у которых хоть одна дата попадает в выбранный год --- */
$comps = all(
    "SELECT * FROM competitions WHERE status <> 'draft' AND (
        strftime('%Y', start_date) = :y OR strftime('%Y', end_date) = :y OR strftime('%Y', results_date) = :y
     ) ORDER BY start_date ASC, sort ASC",
    ['y' => (string) $year]
);

/* --- Раскладываем даты конкурсов по месяцам года --- */
$monthEvents = array_fill(1, 12, []);
foreach ($comps as $c) {
    [$badgeClass, $badgeLabel] = $statusView($c['status']);
    $isFuture = !empty($c['start_date']) && $c['start_date'] > $today;
    $entries = [
        ['field' => 'start_date',   'type' => 'start',   'label' => 'Начало приёма заявок'],
        ['field' => 'end_date',     'type' => 'end',     'label' => 'Окончание приёма заявок'],
        ['field' => 'results_date', 'type' => 'results', 'label' => 'Публикация результатов'],
    ];
    foreach ($entries as $e) {
        $d = $c[$e['field']] ?? '';
        if (empty($d)) continue;
        $ts = strtotime((string) $d);
        if (!$ts || (int) date('Y', $ts) !== $year) continue;
        $m = (int) date('n', $ts);
        $monthEvents[$m][] = [
            'day' => (int) date('j', $ts), 'ts' => $ts, 'type' => $e['type'], 'label' => $e['label'],
            'comp' => $c, 'badgeClass' => $badgeClass, 'badgeLabel' => $badgeLabel, 'isFuture' => $isFuture,
        ];
    }
}
foreach ($monthEvents as &$list) usort($list, fn($a, $b) => $a['ts'] <=> $b['ts']);
unset($list);

$totalEvents = array_sum(array_map('count', $monthEvents));

/* --- Иконки (feather-стиль, как в остальной сборке) --- */
$ic = [
  'cal'   => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  'bell'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  'left'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>',
  'right' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>',
  'flag'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/></svg>',
  'map'   => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1 6v16l7-4 8 4 7-4V0l-7 4-8-4-7 4z"/><path d="M8 2v16M16 6v16"/></svg>',
];

require_once BASE_PATH . '/templates/site/partials/heatmap.php';

ob_start(); ?>
<section class="section section--tint">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Планирование участия</p>
      <h2>Календарь конкурсов на год</h2>
      <div class="gold-rule"></div>
      <p>Все даты приёма заявок и публикации результатов конкурсов и фестивалей КЦ «Музыкальный Мир»
         на <?= h($year) ?> год - по месяцам, в одной ленте. Выберите конкурс и подпишитесь на напоминание,
         чтобы не пропустить открытие приёма заявок.</p>
    </div>

    <div class="cal-yearbar reveal">
      <a class="cal-yearnav" href="<?= url('/calendar?year=' . ($year - 1)) ?>" aria-label="Предыдущий год"><?= $ic['left'] ?></a>
      <div class="cal-years">
        <?php foreach ($years as $y): ?>
          <a href="<?= url('/calendar?year=' . $y) ?>" class="cal-year-chip<?= $y === $year ? ' is-active' : '' ?>"><?= $y ?></a>
        <?php endforeach; ?>
      </div>
      <a class="cal-yearnav" href="<?= url('/calendar?year=' . ($year + 1)) ?>" aria-label="Следующий год"><?= $ic['right'] ?></a>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <?php if ($totalEvents === 0): ?>
      <div class="card reveal" style="text-align:center;max-width:640px;margin:0 auto">
        <h3>На <?= h($year) ?> год пока нет запланированных дат</h3>
        <p style="color:var(--muted)">Загляните в <a href="<?= url('/competitions') ?>">каталог конкурсов</a> - актуальные
           сроки появляются здесь по мере утверждения дат Оргкомитетом.</p>
      </div>
    <?php else: ?>
      <div class="grid grid-4 cal-months">
        <?php foreach ($monthsRu as $mNum => $mName): $items = $monthEvents[$mNum]; ?>
          <div class="card cal-month reveal<?= !$items ? ' is-empty' : '' ?>">
            <h3 class="cal-month-title"><?= $ic['cal'] ?><?= h($mName) ?></h3>
            <?php if (!$items): ?>
              <p class="cal-empty">Нет мероприятий</p>
            <?php else: ?>
              <ul class="cal-events">
                <?php foreach ($items as $it): $c = $it['comp']; ?>
                  <li class="cal-event cal-event--<?= $it['type'] ?>" id="<?= $it['type'] === 'start' ? 'comp-' . h($c['slug']) : '' ?>">
                    <span class="cal-day"><?= $it['day'] ?></span>
                    <div class="cal-event-body">
                      <span class="cal-event-label"><?= h($it['label']) ?></span>
                      <a class="cal-event-name" href="<?= url('/competition/' . $c['slug']) ?>"><?= h($c['name']) ?></a>
                      <span class="badge badge--<?= $it['badgeClass'] ?>"><?= h($it['badgeLabel']) ?></span>

                      <?php if ($it['type'] === 'start' && $it['isFuture']): ?>
                        <details class="cal-remind">
                          <summary class="btn btn--ghost"><?= $ic['bell'] ?> Напомнить о конкурсе</summary>
                          <form method="post" action="<?= url('/calendar') ?>" class="cal-remind-form">
                            <?= csrf_field() ?>
                            <input type="hidden" name="form" value="remind">
                            <input type="hidden" name="year" value="<?= h($year) ?>">
                            <input type="hidden" name="slug" value="<?= h($c['slug']) ?>">
                            <div class="field">
                              <label for="rm_email_<?= h($c['slug']) ?>">Электронная почта</label>
                              <input type="email" id="rm_email_<?= h($c['slug']) ?>" name="email" placeholder="you@example.ru" required>
                            </div>
                            <button class="btn btn--primary btn--block" type="submit">Напомнить за неделю до старта</button>
                          </form>
                        </details>
                      <?php endif; ?>
                    </div>
                  </li>
                <?php endforeach; ?>
              </ul>
            <?php endif; ?>
          </div>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>
</section>

<section class="section section--parchment">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow"><?= $ic['map'] ?> География участников</p>
      <h2>Тепловая карта регионов</h2>
      <div class="gold-rule"></div>
      <p>Распределение участников конкурсов по федеральным округам России - по числу поданных заявок.</p>
    </div>
    <div class="card reveal" style="padding:32px">
      <?= render_regions_heatmap() ?>
    </div>
  </div>
</section>

<style>
.cal-yearbar{display:flex;align-items:center;justify-content:center;gap:16px;margin-top:8px;flex-wrap:wrap}
.cal-yearnav{display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;
  border:1.5px solid var(--gold);color:var(--gold-2);flex:none}
.cal-yearnav:hover{background:var(--grad-gold);color:#1a1206;border-color:transparent}
.cal-yearnav svg{width:18px;height:18px}
.cal-years{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.cal-year-chip{padding:9px 18px;border-radius:999px;border:1.5px solid var(--gold);font-weight:700;color:var(--gold-2)}
.cal-year-chip.is-active{background:var(--grad-gold);color:#1a1206;border-color:transparent;box-shadow:var(--shadow-btn)}
.cal-months{align-items:start}
.cal-month{padding:22px}
.cal-month.is-empty{opacity:.6}
.cal-month-title{display:flex;align-items:center;gap:9px;font-size:1.05rem;margin:0 0 16px}
.cal-month-title svg{width:20px;height:20px;color:var(--gold-2);flex:none}
.cal-empty{color:var(--muted);font-size:.9rem;margin:0}
.cal-events{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:16px}
.cal-event{display:flex;gap:12px;scroll-margin-top:100px}
.cal-day{flex:none;width:40px;height:40px;border-radius:10px;background:var(--gold-soft);color:var(--gold);
  font-weight:700;font-family:var(--ff-display);display:flex;align-items:center;justify-content:center;font-size:1.05rem}
.cal-event--results .cal-day{background:rgba(143,188,148,.15);color:var(--mint)}
.cal-event--end .cal-day{background:rgba(226,123,123,.14);color:var(--error)}
.cal-event-body{display:flex;flex-direction:column;gap:4px;min-width:0}
.cal-event-label{font-size:.78rem;color:var(--muted);text-transform:uppercase;letter-spacing:.03em}
.cal-event-name{font-weight:700;color:var(--text);font-family:var(--ff-serif);line-height:1.25}
.cal-event-name:hover{color:var(--gold-2)}
.cal-remind{margin-top:6px}
.cal-remind summary{cursor:pointer;list-style:none;display:inline-flex;align-items:center;gap:7px;
  font-size:.82rem;padding:7px 14px}
.cal-remind summary::-webkit-details-marker{display:none}
.cal-remind summary svg{width:15px;height:15px}
.cal-remind-form{margin-top:12px;padding:14px;background:var(--glass);border:1px solid var(--glass-brd);border-radius:var(--radius-sm)}
.cal-remind-form .field{margin-bottom:10px}
@media (max-width:1080px){.cal-months{grid-template-columns:repeat(2,1fr)}}
@media (max-width:640px){.cal-months{grid-template-columns:1fr}}
</style>
<?php
$content = ob_get_clean();
render_page('Календарь конкурсов', $content, [
    'active' => '/calendar',
    'meta' => 'Календарь международных и всероссийских онлайн-конкурсов КЦ «Музыкальный Мир» на ' . $year
        . ' год: даты приёма заявок и публикации результатов по месяцам, статусы конкурсов, напоминания и '
        . 'тепловая карта регионов-участников.',
]);
