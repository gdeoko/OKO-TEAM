<?php
/**
 * Аналитика сайта: посещения (site_events), заявки, оплаты, конверсия,
 * топ страниц, последние события, экспорт CSV. Графики — чистый SVG, без библиотек.
 * Период — 7 или 30 дней (GET d). Доступ — гейт роутера (роль из admin_modules).
 */
declare(strict_types=1);

require_once BASE_PATH . '/core/notify_owner.php';
site_events_ensure();

$daysN = (int) ($_GET['d'] ?? 7);
if (!in_array($daysN, [7, 30], true)) $daysN = 7;
$since = date('Y-m-d', strtotime('-' . ($daysN - 1) . ' day'));
$paidStatuses = "('paid','succeeded')";

/* ---------- Экспорт CSV ---------- */
if (($_GET['export'] ?? '') === 'csv') {
    $rows = all(
        "SELECT ts, type, path, user_id, session, meta FROM site_events
          WHERE ts >= ? ORDER BY id DESC LIMIT 5000", [$since]
    );
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="site_events_' . $daysN . 'd_' . date('Ymd') . '.csv"');
    $out = fopen('php://output', 'w');
    fwrite($out, "\xEF\xBB\xBF"); // BOM для Excel
    fputcsv($out, ['ts', 'type', 'path', 'user_id', 'session', 'meta'], ';');
    foreach ($rows as $r) {
        fputcsv($out, [$r['ts'], $r['type'], $r['path'], $r['user_id'], $r['session'], $r['meta']], ';');
    }
    fclose($out);
    exit;
}

/* ---------- Выборки по дням ---------- */
$dayKeys = [];
for ($i = $daysN - 1; $i >= 0; $i--) $dayKeys[date('Y-m-d', strtotime("-$i day"))] = 0;

$views = $dayKeys;   // pageview
foreach (all("SELECT date(ts) d, COUNT(*) c FROM site_events
              WHERE type='pageview' AND ts >= ? GROUP BY d", [$since]) as $r) {
    if (isset($views[$r['d']])) $views[$r['d']] = (int) $r['c'];
}
$visitors = $dayKeys; // уникальные сессии
foreach (all("SELECT date(ts) d, COUNT(DISTINCT session) c FROM site_events
              WHERE type='pageview' AND ts >= ? GROUP BY d", [$since]) as $r) {
    if (isset($visitors[$r['d']])) $visitors[$r['d']] = (int) $r['c'];
}
$appsD = $dayKeys;   // заявки (истина — таблица applications)
foreach (all("SELECT date(created_at) d, COUNT(*) c FROM applications
              WHERE created_at >= ? GROUP BY d", [$since]) as $r) {
    if (isset($appsD[$r['d']])) $appsD[$r['d']] = (int) $r['c'];
}
$paysD = $dayKeys;   // успешные оплаты, ₽
foreach (all("SELECT date(created_at) d, COALESCE(SUM(amount),0) s FROM payments
              WHERE status IN $paidStatuses AND created_at >= ? GROUP BY d", [$since]) as $r) {
    if (isset($paysD[$r['d']])) $paysD[$r['d']] = (int) $r['s'];
}

/* ---------- Итоги периода ---------- */
$totViews    = array_sum($views);
$totVisitors = (int) scalar("SELECT COUNT(DISTINCT session) FROM site_events
                             WHERE type='pageview' AND ts >= ?", [$since]);
$totApps     = array_sum($appsD);
$totAppsPaid = (int) scalar("SELECT COUNT(*) FROM applications
                             WHERE created_at >= ? AND is_paid=1", [$since]);
$totPaysRub  = array_sum($paysD);
$totPaysCnt  = (int) scalar("SELECT COUNT(*) FROM payments
                             WHERE status IN $paidStatuses AND created_at >= ?", [$since]);
$conv = $totApps > 0 ? round($totAppsPaid / $totApps * 100, 1) : 0.0;

/* ---------- Топ страниц ---------- */
$topPages = all("SELECT path, COUNT(*) c FROM site_events
                 WHERE type='pageview' AND ts >= ? AND path<>''
                 GROUP BY path ORDER BY c DESC LIMIT 10", [$since]);
$maxPage = max(1, (int) ($topPages[0]['c'] ?? 1));

/* ---------- Откуда пришли заявки ----------
 * Метку канала ставит core/traffic.php при первом заходе по ссылке с utm_source
 * и хранит 90 дней, поэтому заслуга остаётся за первым касанием. Заявки без
 * метки — это прямые заходы, поиск и старые письма без разметки.
 */
$srcRows = all("SELECT CASE WHEN COALESCE(src,'')='' THEN 'без метки' ELSE src END AS s,
                       COUNT(*) c, SUM(is_paid) p
                  FROM applications WHERE created_at >= ?
                 GROUP BY s ORDER BY c DESC LIMIT 12", [$since]);
$maxSrc = max(1, (int) ($srcRows[0]['c'] ?? 1));
$srcNames = ['vk' => 'ВКонтакте, анонсы в сообществах', 'email' => 'письма',
             'partner' => 'партнёры (персональные ссылки)', 'без метки' => 'прямые заходы и поиск'];

/* ---------- Последние события ---------- */
$lastEvents = all("SELECT ts, type, path, user_id, session, meta FROM site_events
                   ORDER BY id DESC LIMIT 30");

/* ---------- SVG-графики (без библиотек) ---------- */

/** Столбчатый график по дням. $series: [метка => значение]. */
function an_bar_svg(array $series, string $color, string $unit = ''): string {
    $n = count($series);
    if ($n === 0) return '';
    $W = 700; $H = 190; $padB = 22; $padT = 14;
    $max = max(1, max($series));
    $gap = 4;
    $bw = ($W - $gap * ($n - 1)) / $n;
    $svg = '<svg viewBox="0 0 ' . $W . ' ' . $H . '" width="100%" height="auto" role="img" preserveAspectRatio="none" style="display:block">';
    // сетка: 3 горизонтальные линии
    for ($g = 1; $g <= 3; $g++) {
        $y = $padT + ($H - $padB - $padT) * $g / 4;
        $svg .= '<line x1="0" y1="' . round($y, 1) . '" x2="' . $W . '" y2="' . round($y, 1) . '" stroke="currentColor" stroke-opacity=".08"/>';
    }
    $i = 0;
    foreach ($series as $label => $v) {
        $h = ($H - $padB - $padT) * $v / $max;
        $x = $i * ($bw + $gap);
        $y = $H - $padB - $h;
        $svg .= '<rect x="' . round($x, 1) . '" y="' . round($y, 1) . '" width="' . round($bw, 1) . '" height="' . round(max($v > 0 ? 2 : 0.5, $h), 1) . '" rx="3" fill="' . $color . '">'
              . '<title>' . h(date('d.m', strtotime((string) $label)) . ': ' . number_format((float) $v, 0, ',', ' ') . ($unit ? ' ' . $unit : '')) . '</title></rect>';
        // подписи дат: для 7 дней — все, для 30 — каждая 5-я
        if (count($series) <= 7 || $i % 5 === 0) {
            $svg .= '<text x="' . round($x + $bw / 2, 1) . '" y="' . ($H - 6) . '" font-size="10" text-anchor="middle" fill="currentColor" fill-opacity=".55">'
                  . h(date('d.m', strtotime((string) $label))) . '</text>';
        }
        $i++;
    }
    $svg .= '</svg>';
    return $svg;
}

/** Линейный график по дням. */
function an_line_svg(array $series, string $color): string {
    $n = count($series);
    if ($n < 2) return an_bar_svg($series, $color);
    $W = 700; $H = 190; $padB = 22; $padT = 14;
    $max = max(1, max($series));
    $pts = [];
    $i = 0;
    foreach ($series as $v) {
        $x = $n > 1 ? $i * ($W / ($n - 1)) : 0;
        $y = $H - $padB - ($H - $padB - $padT) * $v / $max;
        $pts[] = round($x, 1) . ',' . round($y, 1);
        $i++;
    }
    $svg = '<svg viewBox="0 0 ' . $W . ' ' . $H . '" width="100%" height="auto" role="img" preserveAspectRatio="none" style="display:block">';
    for ($g = 1; $g <= 3; $g++) {
        $y = $padT + ($H - $padB - $padT) * $g / 4;
        $svg .= '<line x1="0" y1="' . round($y, 1) . '" x2="' . $W . '" y2="' . round($y, 1) . '" stroke="currentColor" stroke-opacity=".08"/>';
    }
    $svg .= '<polyline points="' . implode(' ', $pts) . ' ' . $W . ',' . ($H - $padB) . ' 0,' . ($H - $padB) . '" fill="' . $color . '" fill-opacity=".12" stroke="none"/>';
    $svg .= '<polyline points="' . implode(' ', $pts) . '" fill="none" stroke="' . $color . '" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>';
    $labels = array_keys($series);
    foreach ([0, (int) floor(($n - 1) / 2), $n - 1] as $li) {
        $x = $n > 1 ? $li * ($W / ($n - 1)) : 0;
        $anchor = $li === 0 ? 'start' : ($li === $n - 1 ? 'end' : 'middle');
        $svg .= '<text x="' . round($x, 1) . '" y="' . ($H - 6) . '" font-size="10" text-anchor="' . $anchor . '" fill="currentColor" fill-opacity=".55">'
              . h(date('d.m', strtotime((string) $labels[$li]))) . '</text>';
    }
    $svg .= '</svg>';
    return $svg;
}

$evRu = [
    'pageview' => 'Просмотр', 'click' => 'Клик', 'application' => 'Заявка',
    'payment' => 'Оплата', 'order' => 'Заказ наград', 'order_paid' => 'Заказ оплачен',
    'club' => 'ВИП-клуб', 'club_join' => 'Вступление в клуб', 'club_order' => 'Заказ клуба',
    'subscribe' => 'Подписка', 'chat_start' => 'Диалог чат-бота', 'register' => 'Регистрация',
    'followup' => 'Дожим', 'analytics' => 'Аналитика',
];

/* ---------- Рендер ---------- */
ob_start();
?>
<div class="filters" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:16px">
  <a class="btn <?= $daysN === 7 ? 'btn--primary' : 'btn--ghost' ?> btn--sm" href="<?= a_link('analytics', ['d' => 7]) ?>">7 дней</a>
  <a class="btn <?= $daysN === 30 ? 'btn--primary' : 'btn--ghost' ?> btn--sm" href="<?= a_link('analytics', ['d' => 30]) ?>">30 дней</a>
  <span style="flex:1"></span>
  <a class="btn btn--ghost btn--sm" href="<?= a_link('analytics', ['d' => $daysN, 'export' => 'csv']) ?>"><?= admin_icon('download') ?><span>Экспорт CSV</span></a>
</div>

<div class="stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:16px">
  <div class="stat card" style="padding:14px 16px"><div class="stat__label muted small">Просмотры</div><div class="stat__value" style="font-size:1.5rem;font-weight:800"><?= number_format($totViews, 0, ',', ' ') ?></div></div>
  <div class="stat card" style="padding:14px 16px"><div class="stat__label muted small">Посетители (сессии)</div><div class="stat__value" style="font-size:1.5rem;font-weight:800"><?= number_format($totVisitors, 0, ',', ' ') ?></div></div>
  <div class="stat card" style="padding:14px 16px"><div class="stat__label muted small">Заявки</div><div class="stat__value" style="font-size:1.5rem;font-weight:800"><?= number_format($totApps, 0, ',', ' ') ?></div></div>
  <div class="stat card" style="padding:14px 16px"><div class="stat__label muted small">Оплаты</div><div class="stat__value" style="font-size:1.5rem;font-weight:800"><?= number_format($totPaysCnt, 0, ',', ' ') ?><span class="muted small" style="font-weight:500"> · <?= number_format($totPaysRub, 0, ',', ' ') ?> ₽</span></div></div>
  <div class="stat card" style="padding:14px 16px"><div class="stat__label muted small">Конверсия заявка → оплата</div><div class="stat__value" style="font-size:1.5rem;font-weight:800"><?= h(number_format($conv, 1, ',', ' ')) ?>%</div>
    <div class="muted small"><?= (int) $totAppsPaid ?> оплаченных из <?= (int) $totApps ?></div></div>
</div>

<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;margin-bottom:16px">
  <div class="card" style="padding:16px">
    <h3 style="margin:0 0 8px">Посещения по дням</h3>
    <?= an_bar_svg($views, '#b8860b') ?>
  </div>
  <div class="card" style="padding:16px">
    <h3 style="margin:0 0 8px">Заявки по дням</h3>
    <?= an_bar_svg($appsD, '#a0522d') ?>
  </div>
  <div class="card" style="padding:16px">
    <h3 style="margin:0 0 8px">Оплаты по дням, ₽</h3>
    <?= an_line_svg($paysD, '#2e7d4f') ?>
  </div>
  <div class="card" style="padding:16px">
    <h3 style="margin:0 0 8px">Топ страниц</h3>
    <?php if (!$topPages): ?>
      <p class="muted small" style="margin:6px 0 0">Пока нет данных — трекер только что включён.</p>
    <?php else: ?>
      <?php foreach ($topPages as $tp): ?>
        <div style="display:flex;align-items:center;gap:10px;margin:7px 0">
          <div style="flex:0 0 44%;font-size:.83rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="<?= h($tp['path']) ?>"><?= h($tp['path']) ?></div>
          <div style="flex:1;height:9px;border-radius:5px;background:rgba(128,128,128,.14);overflow:hidden">
            <div style="height:100%;width:<?= round((int) $tp['c'] / $maxPage * 100) ?>%;background:#b8860b;border-radius:5px"></div>
          </div>
          <div style="flex:0 0 auto;font-size:.8rem;font-weight:700"><?= (int) $tp['c'] ?></div>
        </div>
      <?php endforeach; ?>
    <?php endif; ?>
  </div>
</div>

<div class="card" style="padding:16px">
  <h3 style="margin:0 0 8px">Откуда пришли заявки</h3>
  <?php if (!$srcRows): ?>
    <p class="muted small" style="margin:6px 0 0">За период заявок нет.</p>
  <?php else: ?>
    <?php foreach ($srcRows as $sr):
        $key   = (string) $sr['s'];
        $short = explode('/', $key)[0];
        $title = $srcNames[$short] ?? $key; ?>
      <div style="display:flex;align-items:center;gap:10px;margin:7px 0">
        <div style="flex:0 0 44%;font-size:.83rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="<?= h($key) ?>"><?= h($title) ?></div>
        <div style="flex:1;height:9px;border-radius:5px;background:rgba(128,128,128,.14);overflow:hidden">
          <div style="height:100%;width:<?= round((int) $sr['c'] / $maxSrc * 100) ?>%;background:#3a6ea5;border-radius:5px"></div>
        </div>
        <div style="flex:0 0 auto;font-size:.8rem;font-weight:700"><?= (int) $sr['c'] ?><span class="muted" style="font-weight:400">, оплачено <?= (int) $sr['p'] ?></span></div>
      </div>
    <?php endforeach; ?>
  <?php endif; ?>
</div>

<div class="card table-wrap" style="padding:16px;overflow-x:auto">
  <h3 style="margin:0 0 10px">Последние события</h3>
  <table class="tbl" style="width:100%">
    <thead><tr><th>Время</th><th>Тип</th><th>Страница</th><th>Юзер</th><th>Сессия</th><th>Мета</th></tr></thead>
    <tbody>
    <?php if (!$lastEvents): ?>
      <tr><td colspan="6" class="muted">Событий пока нет.</td></tr>
    <?php endif; ?>
    <?php foreach ($lastEvents as $ev): ?>
      <tr>
        <td class="small" style="white-space:nowrap"><?= h(date('d.m H:i', strtotime((string) $ev['ts']))) ?></td>
        <td><span class="tag"><?= h($evRu[$ev['type']] ?? $ev['type']) ?></span></td>
        <td class="small" style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="<?= h($ev['path']) ?>"><?= h($ev['path']) ?></td>
        <td class="small"><?= $ev['user_id'] ? '#' . (int) $ev['user_id'] : '—' ?></td>
        <td class="small muted"><?= h(mb_substr((string) $ev['session'], 0, 8)) ?></td>
        <td class="small muted" style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="<?= h($ev['meta']) ?>"><?= h(mb_substr((string) $ev['meta'], 0, 80)) ?></td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
</div>
<?php
$content = (string) ob_get_clean();
admin_layout('Аналитика', $content, 'analytics');
