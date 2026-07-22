<?php
/**
 * Календарь конкурсов на год: премиум-лента с карточками-статусами (жизненный
 * цикл приёма заявок), инфографикой сезона, вертикальным таймлайном с
 * кликабельными датами и тепловой картой регионов. Данные - из таблицы
 * competitions.
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
$monthsRuGen = [1 => 'января', 2 => 'февраля', 3 => 'марта', 4 => 'апреля', 5 => 'мая', 6 => 'июня',
                7 => 'июля', 8 => 'августа', 9 => 'сентября', 10 => 'октября', 11 => 'ноября', 12 => 'декабря'];

$typeLabel = static fn(string $t): string => $t === 'international' ? 'Международный' : 'Всероссийский';
$dirLabel  = ['multi' => 'Многожанровый', 'patriotic' => 'Патриотический', 'thematic' => 'Тематический'];

/* Число дней между датами (b - a) и склонение слова «день». */
$daysBetween = static fn(string $a, string $b): int => (int) floor((strtotime($b) - strtotime($a)) / 86400);
$plural = static function (int $n): string {
    $n = abs($n); $t = $n % 100; $u = $n % 10;
    if ($t >= 11 && $t <= 14) return $n . ' дней';
    if ($u === 1) return $n . ' день';
    if ($u >= 2 && $u <= 4) return $n . ' дня';
    return $n . ' дней';
};
$shortDate = static function (?string $d) use ($monthsRuGen): string {
    if (empty($d)) return '';
    $ts = strtotime((string) $d);
    return $ts ? (int) date('j', $ts) . ' ' . ($monthsRuGen[(int) date('n', $ts)] ?? '') : '';
};

/**
 * Жизненный цикл конкурса относительно сегодняшней даты.
 * Возвращает [класс бейджа, подпись бейджа, поясняющая заметка, фаза].
 */
$lifecycle = static function (array $c) use ($today, $daysBetween, $plural, $shortDate): array {
    $start = !empty($c['start_date']) ? (string) $c['start_date'] : '';
    $end   = !empty($c['end_date'])   ? (string) $c['end_date']   : '';
    $res   = !empty($c['results_date']) ? (string) $c['results_date'] : '';
    $st    = (string) $c['status'];

    if ($st === 'judging') {
        return ['judging', 'Идёт оценка жюри', $res ? 'Результаты - ' . $shortDate($res) : 'Результаты готовятся', 'judging'];
    }
    if ($st === 'open') {
        if ($start !== '' && $start > $today) {
            $d = $daysBetween($today, $start);
            return ['intl', 'Скоро старт', 'Приём откроется ' . $shortDate($start) . ' - через ' . $plural($d), 'soon'];
        }
        if ($end !== '') {
            if ($end === $today) return ['judging', 'Последний день', 'Приём заявок закрывается сегодня', 'last'];
            if ($end > $today) {
                $d = $daysBetween($today, $end);
                if ($d <= 7) return ['judging', 'Осталось ' . $plural($d), 'До окончания приёма заявок', 'ending'];
                return ['open', 'Приём открыт', 'Заявки принимаются до ' . $shortDate($end), 'open'];
            }
        }
        return ['open', 'Приём открыт', 'Заявки принимаются', 'open'];
    }
    // closed | finished
    if ($res !== '' && $res > $today) return ['judging', 'Ожидаются результаты', 'Публикация ' . $shortDate($res), 'awaiting'];
    if ($res !== '' && $res <= $today) return ['intl', 'Результаты опубликованы', 'Итоги сезона подведены', 'results'];
    return ['closed', 'Завершён', 'Приём заявок закрыт', 'done'];
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

/* --- Карточки-статусы: по конкурсу, с фазой жизненного цикла --- */
$phaseWeight = ['last' => 0, 'ending' => 1, 'open' => 2, 'soon' => 3, 'judging' => 4, 'awaiting' => 5, 'results' => 6, 'done' => 7];
$cards = [];
$kpi = ['total' => 0, 'open' => 0, 'soon' => 0, 'results' => 0];
foreach ($comps as $c) {
    [$badgeClass, $badgeLabel, $note, $phase] = $lifecycle($c);
    // Прогресс окна приёма заявок (0..100).
    $pct = 0;
    if (!empty($c['start_date']) && !empty($c['end_date'])) {
        $s = strtotime((string) $c['start_date']);
        $e = strtotime((string) $c['end_date']);
        $n = strtotime($today);
        if ($s && $e && $e > $s) $pct = max(0, min(100, (int) round(($n - $s) / ($e - $s) * 100)));
        elseif ($e && $n > $e) $pct = 100;
    } elseif (in_array($phase, ['results', 'done', 'awaiting', 'judging'], true)) {
        $pct = 100;
    }
    $cards[] = [
        'c' => $c, 'badgeClass' => $badgeClass, 'badgeLabel' => $badgeLabel,
        'note' => $note, 'phase' => $phase, 'pct' => $pct,
    ];
    $kpi['total']++;
    if (in_array($phase, ['open', 'ending', 'last'], true)) $kpi['open']++;
    if ($phase === 'soon') $kpi['soon']++;
    if ($phase === 'results') $kpi['results']++;
}
// Активные конкурсы - выше, завершённые - ниже.
usort($cards, function ($a, $b) use ($phaseWeight) {
    $wa = $phaseWeight[$a['phase']] ?? 9;
    $wb = $phaseWeight[$b['phase']] ?? 9;
    if ($wa !== $wb) return $wa <=> $wb;
    return strcmp((string) ($a['c']['start_date'] ?? ''), (string) ($b['c']['start_date'] ?? ''));
});

/* --- Раскладываем отдельные даты конкурсов по месяцам года (для таймлайна) --- */
$monthEvents = array_fill(1, 12, []);
foreach ($comps as $c) {
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
            'day' => (int) date('j', $ts), 'ts' => $ts, 'type' => $e['type'],
            'label' => $e['label'], 'comp' => $c,
        ];
    }
}
foreach ($monthEvents as &$list) usort($list, fn($a, $b) => $a['ts'] <=> $b['ts']);
unset($list);
$totalEvents = array_sum(array_map('count', $monthEvents));

/* --- Иконки (feather-стиль, как в остальной сборке) --- */
$ic = [
  'cal'    => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  'bell'   => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  'left'   => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>',
  'right'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6l6 6-6 6"/></svg>',
  'map'    => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1 6v16l7-4 8 4 7-4V0l-7 4-8-4-7 4z"/><path d="M8 2v16M16 6v16"/></svg>',
  'flag'   => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/></svg>',
  'wallet' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>',
  'award'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="6"/><path d="M8.2 13.9 7 22l5-3 5 3-1.2-8.1"/></svg>',
  'arrow'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  'clock'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  'check'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>',
];
$typeIcon = ['start' => $ic['bell'], 'end' => $ic['clock'], 'results' => $ic['award']];

require_once BASE_PATH . '/templates/site/partials/heatmap.php';

ob_start(); ?>
<section class="section section--tint calx-top">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Планирование участия</p>
      <h2>Календарь конкурсов</h2>
      <div class="gold-rule"></div>
      <p>Все конкурсы и фестивали КЦ «Музыкальный Мир» на <?= h($year) ?> год - со статусами приёма
         заявок, сроками публикации результатов и таймлайном сезона. Выберите мероприятие, следите за
         статусом и подпишитесь на напоминание, чтобы не пропустить открытие приёма заявок.</p>
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

    <?php if ($totalEvents > 0): ?>
      <div class="calx-kpi reveal">
        <div class="stat"><b><?= (int) $kpi['total'] ?></b><span>мероприятий в году</span></div>
        <div class="stat"><b><?= (int) $kpi['open'] ?></b><span>приём открыт</span></div>
        <div class="stat"><b><?= (int) $kpi['soon'] ?></b><span>впереди по плану</span></div>
        <div class="stat"><b><?= (int) $kpi['results'] ?></b><span>с результатами</span></div>
      </div>
    <?php endif; ?>
  </div>
</section>

<?php if ($totalEvents === 0): ?>
  <section class="section">
    <div class="container">
      <div class="card reveal" style="text-align:center;max-width:640px;margin:0 auto">
        <h3>На <?= h($year) ?> год пока нет запланированных дат</h3>
        <p style="color:var(--muted)">Загляните в <a href="<?= url('/competitions') ?>">каталог конкурсов</a> - актуальные
           сроки появляются здесь по мере утверждения дат Оргкомитетом.</p>
      </div>
    </div>
  </section>
<?php else: ?>

<section class="section">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow"><?= $ic['flag'] ?> Статусы мероприятий</p>
      <h2>Конкурсы и фестивали сезона</h2>
      <div class="gold-rule"></div>
    </div>

    <div class="grid grid-3 calx-cards">
      <?php foreach ($cards as $i => $card): $c = $card['c']; $paid = (int) $c['is_paid'] === 1; ?>
        <article class="card calx-card reveal" id="comp-<?= h($c['slug']) ?>" style="--i:<?= $i % 3 ?>">
          <div class="calx-card__head">
            <span class="badge badge--<?= $card['badgeClass'] ?>"><?= h($card['badgeLabel']) ?></span>
            <span class="calx-type"><?= h($typeLabel($c['type'])) ?></span>
          </div>
          <h3 class="calx-card__title"><a href="<?= url('/competition/' . $c['slug']) ?>"><?= h($c['name']) ?></a></h3>
          <p class="calx-card__note"><?= h($card['note']) ?></p>

          <?php if (!empty($c['start_date']) && !empty($c['end_date'])): ?>
            <div class="calx-window" role="img"
                 aria-label="Окно приёма заявок с <?= h($shortDate($c['start_date'])) ?> по <?= h($shortDate($c['end_date'])) ?>">
              <div class="calx-window__ends">
                <span><?= h($shortDate($c['start_date'])) ?></span>
                <span><?= h($shortDate($c['end_date'])) ?></span>
              </div>
              <div class="bar"><i style="--val:<?= (int) $card['pct'] ?>%"></i></div>
            </div>
          <?php endif; ?>

          <ul class="calx-meta">
            <li><span class="calx-meta__ic"><?= $ic['cal'] ?></span>
              <span>Приём: <b><?= (!empty($c['start_date']) || !empty($c['end_date']))
                ? h(trim($shortDate($c['start_date']) . ' - ' . $shortDate($c['end_date']), ' -'))
                : 'уточняется' ?></b></span></li>
            <li><span class="calx-meta__ic"><?= $ic['award'] ?></span>
              <span>Результаты: <b><?= !empty($c['results_date']) ? h($shortDate($c['results_date'])) : 'по итогам оценки' ?></b></span></li>
            <li><span class="calx-meta__ic"><?= $ic['wallet'] ?></span>
              <span>Участие: <b><?= $paid ? h(money((int) $c['price'])) : 'бесплатно' ?></b></span></li>
          </ul>

          <div class="calx-card__actions">
            <?php if (in_array($card['phase'], ['open', 'ending', 'last'], true)): ?>
              <a class="btn btn--primary btn--sm" href="<?= url('/apply') . '?competition=' . rawurlencode($c['slug']) ?>">Подать заявку</a>
              <a class="btn btn--ghost btn--sm" href="<?= url('/competition/' . $c['slug']) ?>">Подробнее <?= $ic['arrow'] ?></a>
            <?php elseif ($card['phase'] === 'results'): ?>
              <a class="btn btn--primary btn--sm" href="<?= url('/competition/' . $c['slug']) ?>#results">Результаты <?= $ic['arrow'] ?></a>
            <?php elseif ($card['phase'] === 'soon'): ?>
              <details class="cal-remind">
                <summary class="btn btn--ghost btn--sm"><?= $ic['bell'] ?> Напомнить</summary>
                <form method="post" action="<?= url('/calendar') ?>" class="cal-remind-form">
                  <?= csrf_field() ?>
                  <input type="hidden" name="form" value="remind">
                  <input type="hidden" name="year" value="<?= h($year) ?>">
                  <input type="hidden" name="slug" value="<?= h($c['slug']) ?>">
                  <div class="field">
                    <label for="rm_email_<?= h($c['slug']) ?>">Электронная почта</label>
                    <input type="email" id="rm_email_<?= h($c['slug']) ?>" name="email" placeholder="you@example.ru" required>
                  </div>
                  <button class="btn btn--primary btn--block btn--sm" type="submit">Напомнить за неделю до старта</button>
                </form>
              </details>
              <a class="btn btn--ghost btn--sm" href="<?= url('/competition/' . $c['slug']) ?>">Подробнее <?= $ic['arrow'] ?></a>
            <?php else: ?>
              <a class="btn btn--ghost btn--sm" href="<?= url('/competition/' . $c['slug']) ?>">Подробнее <?= $ic['arrow'] ?></a>
            <?php endif; ?>
          </div>
        </article>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<section class="section section--parchment">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow"><?= $ic['clock'] ?> Хронология</p>
      <h2>Таймлайн сезона</h2>
      <div class="gold-rule"></div>
      <p>Ключевые даты по месяцам: открытие приёма заявок, окончание приёма и публикация результатов.
         Нажмите на дату, чтобы перейти к конкурсу.</p>
    </div>

    <div class="grid grid-2 calx-tl">
      <?php $col = 0; foreach ($monthsRu as $mNum => $mName): $items = $monthEvents[$mNum]; if (!$items) continue; ?>
        <div class="card calx-tl-month reveal" style="--i:<?= $col++ % 2 ?>">
          <h3 class="calx-tl-title"><?= $ic['cal'] ?><?= h($mName) ?><span><?= count($items) ?></span></h3>
          <div class="timeline">
            <?php foreach ($items as $it): $c = $it['comp']; ?>
              <div class="timeline-item calx-tl-item calx-tl-item--<?= $it['type'] ?>">
                <span class="tl-date"><?= $it['day'] ?> <?= h($monthsRuGen[$mNum]) ?></span>
                <h4><a href="<?= url('/competition/' . $c['slug']) ?>"><?= h($c['name']) ?></a></h4>
                <p class="calx-tl-lbl"><span class="calx-tl-ico"><?= $typeIcon[$it['type']] ?? $ic['cal'] ?></span><?= h($it['label']) ?></p>
              </div>
            <?php endforeach; ?>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<?php endif; ?>

<section class="section">
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
.calx-top .cal-yearbar{margin-top:14px}
.cal-yearbar{display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap}
.cal-yearnav{display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;
  border:1.5px solid var(--gold);color:var(--gold-2);flex:none}
.cal-yearnav:hover{background:var(--grad-gold);color:var(--gold-fg);border-color:transparent}
.cal-yearnav svg{width:18px;height:18px}
.cal-years{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
.cal-year-chip{padding:9px 18px;border-radius:999px;border:1.5px solid var(--gold);font-weight:700;color:var(--gold-2)}
.cal-year-chip.is-active{background:var(--grad-gold);color:var(--gold-fg);border-color:transparent;box-shadow:var(--shadow-btn)}

.calx-kpi{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:26px}
.calx-kpi .stat{text-align:center}

.btn--sm{padding:9px 16px;font-size:.86rem}
.btn--sm svg{width:15px;height:15px}

.calx-cards{align-items:stretch}
.calx-card{display:flex;flex-direction:column;padding:24px;scroll-margin-top:110px}
.calx-card__head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:14px}
.calx-type{font-size:.74rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);font-weight:700}
.calx-card__title{font-size:1.16rem;line-height:1.25;margin:0 0 6px}
.calx-card__title a{color:var(--text)}
.calx-card__title a:hover{color:var(--gold-2)}
.calx-card__note{color:var(--text-dim);font-size:.9rem;margin:0 0 16px}
.calx-window{margin:0 0 16px}
.calx-window__ends{display:flex;justify-content:space-between;font-size:.78rem;color:var(--muted);font-weight:700;margin-bottom:7px}
.calx-meta{list-style:none;margin:0 0 18px;padding:0;display:flex;flex-direction:column;gap:10px}
.calx-meta li{display:flex;align-items:center;gap:10px;font-size:.88rem;color:var(--text-dim)}
.calx-meta li b{color:var(--text);font-weight:700}
.calx-meta__ic{flex:none;width:30px;height:30px;border-radius:9px;background:var(--gold-soft);
  display:flex;align-items:center;justify-content:center;color:var(--gold)}
.calx-meta__ic svg{width:16px;height:16px}
.calx-card__actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:auto;align-items:flex-start}
.cal-remind summary{cursor:pointer;list-style:none;display:inline-flex;align-items:center;gap:7px}
.cal-remind summary::-webkit-details-marker{display:none}
.cal-remind-form{margin-top:12px;padding:14px;background:var(--glass);border:1px solid var(--glass-brd);
  border-radius:var(--radius-sm);min-width:min(280px,72vw)}
.cal-remind-form .field{margin-bottom:10px}

.calx-tl{align-items:start}
.calx-tl-month{padding:24px}
.calx-tl-title{display:flex;align-items:center;gap:9px;font-size:1.08rem;margin:0 0 18px}
.calx-tl-title svg{width:20px;height:20px;color:var(--gold-2);flex:none}
.calx-tl-title span{margin-left:auto;font-family:var(--ff-body);font-size:.78rem;font-weight:800;color:var(--gold-2);
  background:var(--gold-soft);border-radius:999px;padding:2px 10px}
.calx-tl-item{padding-bottom:22px}
.calx-tl-item h4{font-size:1rem;line-height:1.3}
.calx-tl-item h4 a{color:var(--text)}
.calx-tl-item h4 a:hover{color:var(--gold-2)}
.calx-tl-lbl{display:flex;align-items:center;gap:7px;font-size:.82rem;color:var(--muted)!important;margin-top:4px}
.calx-tl-ico{flex:none;width:17px;height:17px;color:var(--gold-2)}
.calx-tl-ico svg{width:100%;height:100%}
.calx-tl-item--results::before{background:var(--mint)!important;border-color:var(--mint)!important}
.calx-tl-item--end::before{background:var(--error)!important;border-color:var(--error)!important}

@media (max-width:960px){.calx-kpi{grid-template-columns:repeat(2,1fr)}}
@media (max-width:640px){.calx-card__actions .btn{flex:1 1 100%}}
</style>
<?php
$content = ob_get_clean();
render_page('Календарь конкурсов', $content, [
    'active' => '/calendar',
    'meta' => 'Календарь международных и всероссийских онлайн-конкурсов КЦ «Музыкальный Мир» на ' . $year
        . ' год: статусы приёма заявок (приём открыт, осталось N дней, последний день, результаты), '
        . 'таймлайн сезона по месяцам и тепловая карта регионов-участников.',
]);
