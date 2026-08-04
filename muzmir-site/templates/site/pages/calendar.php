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
  'share'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>',
];
$typeIcon = ['start' => $ic['bell'], 'end' => $ic['clock'], 'results' => $ic['award']];

require_once BASE_PATH . '/templates/site/partials/heatmap.php';

/* --- Архив конкурсов по данным официального сообщества (2022-2026) --- */
$archive = [
    2026 => [
        '«Сияние звёзд»', '«Атланты искусства»', '«Творческий импульс»', '«Открытая сцена»',
        '«Мировая сцена»', '«Вершина мастерства»', '«Симфония звёзд»', '«Грани талантов»',
        '«Живое исполнение»', '«Планета талантов»', '«Музыкальная весна»', '«Мир вдохновения»',
        '«Вундеркинд»', '«Лига искусства»', '«Созвездие творчества»', '«Zа Родину»',
        'Фестиваль ко Дню защитника Отечества',
    ],
    2025 => [
        '«Слава Героям России»', '«Сила Родины моей»', '«Славься, Отечество»', '«Моё призвание»',
        '«Звёздный кураж»', '«Священная Россия»', '«Магия талантов»', '«Славный путь»',
        '«Творчество без границ»', '«Эксклюзив»', '«Звезда искусства»', '«Герои России»',
        '«Всё ради искусства»', '«Россия — наша держава»', '«Великолепие талантов»',
        '«Мировая легенда»', '«Наша держава»', '«Музыкальный десант»', '«Таланты Земли»',
        '«Гармония мира»', '«Могучая Россия»', '«Зов сцены»', '«Чудеса талантов»',
        '«Хит-парад»', '«Таланты зажигают»', '«Россия — моё достояние»', '«Всемирная слава»',
        '«Мой клич — успех!»', '«По зову сердца»', '«На пике славы»', '«Уникальный дар»',
        '«Звёзды на сцене»', '«Гении искусства»', '«Патриоты России»', '«Символ успеха»',
        '«Национальная культура»', '«Звёздный форум»', '«Одарённые»', '«Край родной»',
        '«Моя стихия»', '«Величие России»', '«Россия — Родина моя»', '«Мы — россияне»',
        '«Сфера искусства»', '«Музыка без границ»', '«Золотая лира»',
        'Фестиваль ко Дню города Москвы',
    ],
    2024 => [
        '«Вместе»', '«На высоте»', '«Россия — это мы»', '«Музыкальная волна»',
        '«Хрустальный голос»', '«Путь к успеху»', '«День защитника Отечества»',
        '«Народное достояние»', '«Мы Zа Россию»', '«Моя Родина — Россия»', '«Виртуоз»',
        '«Великая Россия»', '«Зов сердца»', '«Сила России»', '«Овация»', '«Россия-матушка»',
        '«Великое искусство»', '«Гордость России»', '«Звёздный Олимп»',
        '«Творческое вдохновение»', '«Культурное наследие»', '«Искусство побеждать»',
        '«Великая страна»', '«Победа Zа нами»', '«Созвездие талантов»', '«Дар искусства»',
    ],
    2023 => [
        '«День Победы»', '«Слава России»', '«Я Zа Победу»', '«Будущее России»',
        '«Звёзды Великой Страны»', '«Одарённые талантом»', '«Лучший из лучших»',
        '«Я Zа Родину»', '«Гордость нации»', '«Звёзды России»', '«Юные таланты»',
        '«Профи»', '«Эврика»',
    ],
    2022 => [
        '«Талант года»', '«Zа Россию»', '«Музыкальный Мир»', '«Браво»', '«Звёздный путь»',
        'Конкурс ко Дню учителя', 'Конкурс ко Дню народного единства',
    ],
];
krsort($archive);
$archiveTotal = array_sum(array_map('count', $archive));
$pluralComp = static function (int $n): string {
    $n = abs($n); $t = $n % 100; $u = $n % 10;
    if ($t >= 11 && $t <= 14) return $n . ' конкурсов';
    if ($u === 1) return $n . ' конкурс';
    if ($u >= 2 && $u <= 4) return $n . ' конкурса';
    return $n . ' конкурсов';
};
/* Маленький лавр для строк архива */
$ic['laurel'] = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v16"/><path d="M12 8c-2.6 0-4.4-1.7-4.4-3.6C10.2 4.4 12 5.6 12 8z"/><path d="M12 8c2.6 0 4.4-1.7 4.4-3.6C13.8 4.4 12 5.6 12 8z"/><path d="M12 13c-2.6 0-4.4-1.7-4.4-3.6 2.6 0 4.4 1.2 4.4 3.6z"/><path d="M12 13c2.6 0 4.4-1.7 4.4-3.6-2.6 0-4.4 1.2-4.4 3.6z"/><path d="M12 18c-2.6 0-4.4-1.7-4.4-3.6 2.6 0 4.4 1.2 4.4 3.6z"/><path d="M12 18c2.6 0 4.4-1.7 4.4-3.6-2.6 0-4.4 1.2-4.4 3.6z"/></svg>';

ob_start(); ?>
<section class="section section--tint calx-top">
  <div class="container">
    <a class="aw-back" href="<?= url('/menu') ?>"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>Назад</a>
    <div class="section-head reveal">
      <p class="eyebrow">Планирование участия</p>
      <h2>Календарь конкурсов</h2>
      <div class="gold-rule"></div>
      <p>Все конкурсы и фестивали Культурного центра «Музыкальный Мир» на <?= h($year) ?> год - со статусами приёма
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

    <nav class="calx-anchors reveal" aria-label="Разделы страницы">
      <?php if ($totalEvents > 0): ?>
        <a class="calx-anchor" href="#season">Конкурсы сезона</a>
        <a class="calx-anchor" href="#timeline">Таймлайн</a>
      <?php endif; ?>
      <a class="calx-anchor" href="#geo">География</a>
      <a class="calx-anchor" href="#archive">Архив конкурсов</a>
    </nav>
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

<section class="section" id="season">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Статусы мероприятий</p>
      <h2>Конкурсы и фестивали сезона</h2>
      <div class="gold-rule"></div>
    </div>

    <div class="grid grid-3 calx-cards">
      <?php foreach ($cards as $i => $card): $c = $card['c']; $paid = (int) $c['is_paid'] === 1; ?>
        <article class="card calx-card reveal calx-card--<?= h($card['phase']) ?>" id="comp-<?= h($c['slug']) ?>" style="--i:<?= $i % 3 ?>">
          <span class="calx-accent" aria-hidden="true"></span>
          <?php $cvr = trim((string)($c['cover'] ?? '')); if ($cvr !== ''):
            $cvr = preg_match('~^https?://~', $cvr) ? $cvr : url('/' . ltrim($cvr, '/')); ?>
            <a class="calx-poster" href="<?= url('/apply?competition=' . rawurlencode($c['slug'])) ?>"
               aria-label="Подать заявку на конкурс «<?= h($c['name']) ?>»">
              <img src="<?= h($cvr) ?>" alt="Афиша конкурса «<?= h($c['name']) ?>»" loading="lazy" decoding="async">
            </a>
          <?php endif; ?>
          <div class="calx-card__head">
            <span class="badge badge--<?= $card['badgeClass'] ?>"><?= h($card['badgeLabel']) ?></span>
            <span class="calx-type"><?= h($typeLabel($c['type'])) ?></span>
          </div>
          <h3 class="calx-card__title"><a href="<?= url('/apply?competition=' . rawurlencode($c['slug'])) ?>"><?= h($c['name']) ?></a></h3>
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
              <a class="btn btn--ghost btn--sm" href="<?= url('/competition/' . $c['slug'] . '/regulation.docx') ?>">Положение</a>
            <?php elseif ($card['phase'] === 'results'): ?>
              <a class="btn btn--primary btn--sm" href="<?= url('/results/' . $c['slug']) ?>">Результаты <?= $ic['arrow'] ?></a>
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
                    <input type="email" id="rm_email_<?= h($c['slug']) ?>" name="email" placeholder="ваша@почта.рф" required>
                  </div>
                  <button class="btn btn--primary btn--block btn--sm" type="submit">Напомнить за неделю до старта</button>
                </form>
              </details>
              <a class="btn btn--ghost btn--sm" href="<?= url('/competition/' . $c['slug'] . '/regulation.docx') ?>">Положение</a>
            <?php else: ?>
              <a class="btn btn--ghost btn--sm" href="<?= url('/competition/' . $c['slug'] . '/regulation.docx') ?>">Положение</a>
            <?php endif; ?>
            <button type="button" class="btn btn--ghost btn--sm cal-share"
                    data-share="<?= h(url('/apply?competition=' . rawurlencode($c['slug']))) ?>"
                    data-title="<?= h($c['name']) ?>"
                    aria-label="Поделиться конкурсом «<?= h($c['name']) ?>»"><?= $ic['share'] ?> Поделиться</button>
          </div>
        </article>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<section class="section section--parchment" id="timeline">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Хронология</p>
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
                <h4><a href="<?= url('/apply?competition=' . rawurlencode($c['slug'])) ?>"><?= h($c['name']) ?></a></h4>
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

<section class="section" id="geo">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">География участников</p>
      <h2>Тепловая карта регионов</h2>
      <div class="gold-rule"></div>
      <p>Распределение участников конкурсов по федеральным округам России - по числу поданных заявок.</p>
    </div>
    <div class="card reveal" style="padding:32px">
      <?= render_regions_heatmap() ?>
    </div>
  </div>
</section>

<section class="section section--tint" id="archive">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Летопись Культурного центра</p>
      <h2>Архив конкурсов</h2>
      <div class="gold-rule"></div>
      <p>Все конкурсы и фестивали, проведённые Культурного центра «Музыкальный Мир» с 2022 года, - по данным
         официальной летописи сообщества. Каждый сезон - десятки проектов, тысячи участников
         со всей России и из-за рубежа.</p>
    </div>

    <div class="arcx-total reveal">
      <span class="arcx-total__num"><?= (int) $archiveTotal ?></span>
      <span class="arcx-total__lbl">Проведено конкурсов<br>за 2022-<?= (int) array_key_first($archive) ?> годы</span>
    </div>

    <div class="arcx">
      <?php foreach ($archive as $ay => $names): ?>
        <div class="arcx-year reveal">
          <div class="arcx-year__head">
            <span class="arcx-year__num"><?= (int) $ay ?></span>
            <span class="arcx-year__cnt"><?= h($pluralComp(count($names))) ?></span>
            <span class="arcx-year__line" aria-hidden="true"></span>
          </div>
          <ul class="arcx-list">
            <?php foreach ($names as $nm): ?>
              <li class="arcx-item">
                <span class="arcx-item__ic" aria-hidden="true"><?= $ic['laurel'] ?></span>
                <span class="arcx-item__name"><?= h($nm) ?></span>
              </li>
            <?php endforeach; ?>
          </ul>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<style>
.calx-top{position:relative;overflow:hidden}
.calx-top::before{content:"";position:absolute;left:50%;top:-45%;width:min(820px,130%);height:560px;transform:translateX(-50%);
  background:radial-gradient(closest-side,var(--gold-soft),transparent 72%);pointer-events:none;z-index:0}
.calx-top .container{position:relative;z-index:1}
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
.calx-card{display:flex;flex-direction:column;padding:24px 24px 24px 27px;scroll-margin-top:110px;position:relative;overflow:hidden}
/* Афиша конкурса 16:9 — вся информация на ней, клик ведёт на подачу заявки */
.calx-poster{display:block;margin:-24px -24px 16px -27px;aspect-ratio:16/9;overflow:hidden;background:var(--gold-soft)}
.calx-poster img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .5s cubic-bezier(.2,.8,.2,1)}
@media(hover:hover){.calx-card:hover .calx-poster img{transform:scale(1.04)}}
/* Левая фазовая полоса-акцент (жизненный цикл конкурса) */
.calx-accent{position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--gold);border-radius:0 3px 3px 0;opacity:.85}
.calx-card--open .calx-accent,.calx-card--ending .calx-accent,.calx-card--last .calx-accent{background:var(--mint)}
.calx-card--soon .calx-accent{background:var(--gold-2)}
.calx-card--judging .calx-accent,.calx-card--awaiting .calx-accent{background:var(--warning)}
.calx-card--results .calx-accent{background:var(--grad-gold)}
.calx-card--done .calx-accent{background:var(--line)}
/* Тонкая золотая засечка в верхнем правом углу */
.calx-card::after{content:"";position:absolute;top:13px;right:13px;width:16px;height:16px;pointer-events:none;
  border-top:1.5px solid var(--gold-2);border-right:1.5px solid var(--gold-2);border-top-right-radius:5px;opacity:.45;transition:opacity .3s}
@media(hover:hover){.calx-card:hover::after{opacity:1}}
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
.calx-meta__ic{flex:none;width:20px;height:20px;display:flex;align-items:center;justify-content:center;color:var(--gold-2)}
.calx-meta__ic svg{width:20px;height:20px}
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
/* Глубина и орнамент таймлайна */
.calx-tl-month{position:relative;overflow:hidden}
.calx-tl-month::before{content:"";position:absolute;right:-30px;top:-30px;width:120px;height:120px;pointer-events:none;
  background:radial-gradient(closest-side,var(--gold-soft),transparent 70%);opacity:.7}
.calx-tl-title{position:relative;z-index:1}
.calx-window .bar{box-shadow:inset 0 1px 3px rgba(139,111,31,.12)}
.calx-window .bar>i{box-shadow:0 0 8px rgba(201,168,76,.5)}
.calx-kpi .stat{position:relative;overflow:hidden}
.calx-kpi .stat::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:var(--grad-gold);opacity:.5}

/* --- Моушен-микро (только transform/opacity; глушится глобальным prefers-reduced-motion) --- */
.cal-yearnav{transition:background .2s ease,color .2s ease,border-color .2s ease,transform .2s ease}
.cal-year-chip{transition:background .2s ease,color .2s ease,transform .2s ease}
.calx-accent{transition:width .25s ease,opacity .25s ease}
.calx-tl-item{transition:transform .25s ease}
.calx-tl-item::before{transition:transform .25s ease,box-shadow .25s ease}
.calx-meta__ic{transition:transform .3s ease}
@media(hover:hover){
  .cal-yearnav:hover{transform:translateY(-2px)}
  .cal-year-chip:not(.is-active):hover{background:var(--gold-soft);transform:translateY(-2px)}
  .calx-card:hover .calx-accent{width:6px;opacity:1}
  .calx-tl-item:hover{transform:translateX(4px)}
  .calx-tl-item:hover::before{transform:scale(1.18)}
  .calx-tl-item:hover .calx-meta__ic{transform:scale(1.1)}
}

/* Кнопка «Поделиться» с ненавязчивым подтверждением копирования */
.cal-share{position:relative}
.cal-share.is-copied::after{content:"Ссылка скопирована";position:absolute;left:50%;bottom:calc(100% + 8px);
  transform:translateX(-50%);white-space:nowrap;background:var(--text);color:var(--bg);font-size:.72rem;font-weight:700;
  padding:5px 10px;border-radius:8px;box-shadow:var(--shadow-3d);pointer-events:none;z-index:5}

/* --- Компактное доп-меню (якоря на секции) --- */
.calx-anchors{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:24px}
.calx-anchor{padding:9px 18px;border-radius:999px;font-size:.85rem;font-weight:700;color:var(--text);
  background:var(--glass-card);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
  border:1px solid var(--glass-brd2);transition:transform .2s ease,border-color .2s ease,color .2s ease}
@media(hover:hover){.calx-anchor:hover{transform:translateY(-2px);border-color:var(--gold);color:var(--gold-2)}}
#season,#timeline,#geo,#archive{scroll-margin-top:96px}

/* --- Архив конкурсов: вертикальная лента по годам --- */
.arcx-total{display:flex;align-items:center;justify-content:center;gap:16px;margin:6px auto 34px;
  padding:18px 28px;max-width:420px;background:var(--glass-card);backdrop-filter:blur(18px);
  -webkit-backdrop-filter:blur(18px);border:1px solid var(--glass-brd2);border-radius:20px;
  position:relative;overflow:hidden}
.arcx-total::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:var(--grad-gold);opacity:.6}
.arcx-total__num{font-family:var(--ff-display);font-size:2.6rem;line-height:1;font-weight:700;
  background:var(--grad-gold-text);-webkit-background-clip:text;background-clip:text;color:transparent}
.arcx-total__lbl{font-size:.85rem;font-weight:700;color:var(--muted);line-height:1.35;text-align:left}
.arcx{position:relative;max-width:980px;margin:0 auto;padding-left:24px}
.arcx::before{content:"";position:absolute;left:7px;top:10px;bottom:10px;width:2px;
  background:linear-gradient(180deg,var(--gold),var(--glass-brd2) 92%,transparent)}
.arcx-year{position:relative;padding-bottom:34px}
.arcx-year:last-child{padding-bottom:0}
.arcx-year::before{content:"";position:absolute;left:-22px;top:10px;width:12px;height:12px;border-radius:50%;
  background:var(--grad-gold);box-shadow:0 0 0 4px var(--glass-card),0 0 10px rgba(199,147,34,.45)}
.arcx-year__head{display:flex;align-items:baseline;gap:14px;margin-bottom:16px}
.arcx-year__num{font-family:var(--ff-display);font-size:2.2rem;line-height:1;font-weight:700;
  background:var(--grad-gold-text);-webkit-background-clip:text;background-clip:text;color:transparent}
.arcx-year__cnt{font-size:.8rem;font-weight:800;color:var(--gold-2);white-space:nowrap;
  border:1px solid var(--glass-brd2);border-radius:999px;padding:4px 12px;background:var(--glass-card)}
.arcx-year__line{flex:1;height:1px;background:linear-gradient(90deg,var(--glass-brd2),transparent);align-self:center}
.arcx-list{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
.arcx-item{display:flex;align-items:center;gap:10px;padding:11px 14px;
  background:var(--glass-card);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
  border:1px solid var(--glass-brd2);border-radius:16px;
  transition:transform .2s ease,border-color .2s ease;word-break:normal;hyphens:none}
@media(hover:hover){.arcx-item:hover{transform:translateY(-2px);border-color:var(--gold)}}
.arcx-item__ic{flex:none;width:18px;height:18px;color:var(--gold-2)}
.arcx-item__ic svg{width:100%;height:100%}
.arcx-item__name{font-size:.88rem;font-weight:600;color:var(--text);line-height:1.35}

@media (max-width:960px){.calx-kpi{grid-template-columns:repeat(2,1fr)}}
@media (max-width:640px){
  .calx-card__actions .btn{flex:1 1 100%}
  .arcx{padding-left:20px}
  .arcx-year::before{left:-18px;width:10px;height:10px}
  .arcx-year__num{font-size:1.85rem}
  .arcx-list{grid-template-columns:1fr}
}
@media (max-width:400px){.calx-kpi{gap:10px}.calx-kpi .stat b{font-size:1.5rem}}
</style>

<!-- Кнопки «Поделиться» ([data-share]) обрабатываются глобально в partials/popups.php. -->
<?php
$content = ob_get_clean();
render_page('Календарь конкурсов', $content, [
    'active' => '/calendar',
    'meta' => 'Календарь международных и всероссийских онлайн-конкурсов Культурного центра «Музыкальный Мир» на ' . $year
        . ' год: статусы приёма заявок (приём открыт, осталось N дней, последний день, результаты), '
        . 'таймлайн сезона по месяцам и тепловая карта регионов-участников.',
]);
