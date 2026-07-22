<?php
/**
 * Обзор (премиум-дашборд): KPI-карточки с инфографикой, SVG-графики динамики,
 * пончики-распределения, быстрые действия, последние заявки/оплаты, статус системы.
 * Серверная логика и выборки — только чтение; авторизация — гейт роутера (jury+).
 */
declare(strict_types=1);

$paidStatuses = "('paid','succeeded')";

/* ── Счётчики верхнего уровня ─────────────────────────────────── */
$new_apps    = (int) scalar("SELECT COUNT(*) FROM applications WHERE status='new'");
$apps_total  = (int) scalar("SELECT COUNT(*) FROM applications");
$apps_month  = (int) scalar("SELECT COUNT(*) FROM applications WHERE created_at >= date('now','start of month')");
$apps_prev   = (int) scalar("SELECT COUNT(*) FROM applications WHERE created_at >= date('now','start of month','-1 month') AND created_at < date('now','start of month')");

$pay_day     = (int) scalar("SELECT COALESCE(SUM(amount),0) FROM payments WHERE status IN $paidStatuses AND date(created_at)=date('now')");
$pay_month   = (int) scalar("SELECT COALESCE(SUM(amount),0) FROM payments WHERE status IN $paidStatuses AND created_at >= date('now','start of month')");
$pay_prev    = (int) scalar("SELECT COALESCE(SUM(amount),0) FROM payments WHERE status IN $paidStatuses AND created_at >= date('now','start of month','-1 month') AND created_at < date('now','start of month')");

$subs        = (int) scalar("SELECT COUNT(*) FROM subscribers WHERE active=1");
$subs_month  = (int) scalar("SELECT COUNT(*) FROM subscribers WHERE created_at >= date('now','start of month')");
$subs_prev   = (int) scalar("SELECT COUNT(*) FROM subscribers WHERE created_at >= date('now','start of month','-1 month') AND created_at < date('now','start of month')");

$comps_total = (int) scalar("SELECT COUNT(*) FROM competitions");
$comps_open  = (int) scalar("SELECT COUNT(*) FROM competitions WHERE status='open'");

$dip_total   = (int) scalar("SELECT COUNT(*) FROM diplomas");
$dip_month   = (int) scalar("SELECT COUNT(*) FROM diplomas WHERE created_at >= date('now','start of month')");
$dip_sent    = (int) scalar("SELECT COUNT(*) FROM diplomas WHERE sent_at IS NOT NULL AND sent_at<>''");

$visits_day  = (int) scalar("SELECT COUNT(DISTINCT ip) FROM audit_log WHERE date(created_at)=date('now')");
$pending_rev = (int) scalar("SELECT COUNT(*) FROM reviews WHERE status='pending'");
$queue_wait  = (int) scalar("SELECT COUNT(*) FROM mail_queue WHERE status='queued'");
$to_grade    = (int) scalar("SELECT COUNT(*) FROM applications WHERE status IN ('paid','judging')");

/* ── Динамика за 14 дней (заявки и оплаты) ────────────────────── */
$days = [];
for ($i = 13; $i >= 0; $i--) $days[date('Y-m-d', strtotime("-$i day"))] = 0;
foreach (all("SELECT date(created_at) d, COUNT(*) c FROM applications
              WHERE created_at >= date('now','-13 day') GROUP BY d") as $r) {
    if (isset($days[$r['d']])) $days[$r['d']] = (int)$r['c'];
}
$pdays = array_fill_keys(array_keys($days), 0);
foreach (all("SELECT date(created_at) d, COALESCE(SUM(amount),0) s FROM payments
              WHERE status IN $paidStatuses AND created_at >= date('now','-13 day') GROUP BY d") as $r) {
    if (isset($pdays[$r['d']])) $pdays[$r['d']] = (int)$r['s'];
}

/* ── Распределения (пончики) ──────────────────────────────────── */
$appByStatus = [];
foreach (all("SELECT status, COUNT(*) c FROM applications GROUP BY status") as $r) $appByStatus[$r['status']] = (int)$r['c'];
$compByStatus = [];
foreach (all("SELECT status, COUNT(*) c FROM competitions GROUP BY status") as $r) $compByStatus[$r['status']] = (int)$r['c'];

/* ── Последние заявки и оплаты ────────────────────────────────── */
$recent = all("SELECT a.id,a.number,a.full_name,a.status,a.created_at,c.name comp
               FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id
               ORDER BY a.id DESC LIMIT 7");
$recentPays = all("SELECT p.id,p.amount,p.status,p.purpose,p.created_at,a.number app_no
                   FROM payments p LEFT JOIN applications a ON a.id=p.application_id
                   ORDER BY p.id DESC LIMIT 7");

/* ── Статус системы (крон / почта / платежи) ──────────────────── */
$cronLog   = BASE_PATH . '/data/logs/cron.log';
$cronMtime = is_file($cronLog) ? (int) @filemtime($cronLog) : 0;
$cronAgeM  = $cronMtime ? (int) floor((time() - $cronMtime) / 60) : null;
$cronOk    = $cronAgeM !== null && $cronAgeM < 90;

$mailFailed   = (int) scalar("SELECT COUNT(*) FROM mail_queue WHERE status='failed'");
$mailLastSent = scalar("SELECT MAX(sent_at) FROM mail_queue WHERE status='sent' AND sent_at IS NOT NULL");

$payReady   = trim((string) cfgv('yukassa_shop', '')) !== '' && trim((string) cfgv('yukassa_secret', '')) !== '';
$payPending = (int) scalar("SELECT COUNT(*) FROM payments WHERE status='pending'");
$payLast    = scalar("SELECT MAX(created_at) FROM payments WHERE status IN $paidStatuses");
$health     = (string) setting('health_last_state', '');

/* ── Локальные помощники дашборда ─────────────────────────────── */
if (!function_exists('dash_delta_chip')) {
    /** Чип дельты «текущий vs прошлый период». */
    function dash_delta_chip(int $cur, int $prev): string {
        if ($prev <= 0) {
            $cls = $cur > 0 ? 'up' : 'flat';
            $txt = $cur > 0 ? '+' . $cur : 'ровно';
        } else {
            $p = (int) round(($cur - $prev) / $prev * 100);
            $cls = $p > 0 ? 'up' : ($p < 0 ? 'down' : 'flat');
            $txt = ($p > 0 ? '+' : '') . $p . '%';
        }
        $ic = ['up' => '<path d="M12 19V5M5 12l7-7 7 7"/>', 'down' => '<path d="M12 5v14M19 12l-7 7-7-7"/>', 'flat' => '<path d="M5 12h14"/>'][$cls];
        return '<span class="kpi-delta kpi-delta--' . $cls . '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">' . $ic . '</svg>' . h($txt) . '</span>';
    }
    /** Мини-прогресс (доля). */
    function dash_bar(int $part, int $whole): string {
        $pct = $whole > 0 ? max(0, min(100, round($part / $whole * 100))) : 0;
        return '<div class="mini-bar"><i style="width:' . $pct . '%"></i></div>';
    }
    /** SVG-график динамики (площадь + линия) из ряда значений. */
    function dash_area_svg(array $series, string $id, string $color): string {
        $vals = array_values($series);
        $n = count($vals);
        if ($n < 2) return '<div class="muted small" style="padding:40px 0;text-align:center">Недостаточно данных</div>';
        $W = 580; $H = 180; $pad = 10; $top = 16; $max = max(1, max($vals));
        $step = ($W - $pad * 2) / ($n - 1);
        $pts = [];
        foreach ($vals as $i => $v) {
            $x = $pad + $i * $step;
            $y = $H - $pad - ($v / $max) * ($H - $pad - $top);
            $pts[] = [round($x, 1), round($y, 1)];
        }
        $line = implode(' ', array_map(fn($p) => $p[0] . ',' . $p[1], $pts));
        $area = 'M' . $pts[0][0] . ',' . ($H - $pad) . ' L' . $line . ' L' . $pts[$n - 1][0] . ',' . ($H - $pad) . ' Z';
        $svg  = '<svg class="svgchart" viewBox="0 0 ' . $W . ' ' . $H . '" preserveAspectRatio="none" role="img" aria-hidden="true">';
        $svg .= '<defs><linearGradient id="' . h($id) . '" x1="0" y1="0" x2="0" y2="1">'
              . '<stop offset="0" stop-color="' . $color . '" stop-opacity=".28"/>'
              . '<stop offset="1" stop-color="' . $color . '" stop-opacity="0"/></linearGradient></defs>';
        for ($g = 1; $g <= 3; $g++) {
            $gy = round($top + ($H - $pad - $top) * $g / 4, 1);
            $svg .= '<line x1="' . $pad . '" y1="' . $gy . '" x2="' . ($W - $pad) . '" y2="' . $gy . '" stroke="var(--chart-grid)" stroke-width="1"/>';
        }
        $svg .= '<path d="' . $area . '" fill="url(#' . h($id) . ')"/>';
        $svg .= '<polyline points="' . $line . '" fill="none" stroke="' . $color . '" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>';
        $end = $pts[$n - 1];
        $svg .= '<circle cx="' . $end[0] . '" cy="' . $end[1] . '" r="4" fill="' . $color . '"/>';
        $svg .= '</svg>';
        return $svg;
    }
    /** SVG-пончик со стек-сегментами; в центре — сумма. */
    function dash_donut(array $slices, int $size = 156): string {
        $total = 0; foreach ($slices as $s) $total += $s['value'];
        $r = $size / 2 - 17; $cx = $cy = $size / 2; $c = 2 * M_PI * $r; $sw = 18;
        $svg = '<svg class="donut" width="' . $size . '" height="' . $size . '" viewBox="0 0 ' . $size . ' ' . $size . '" role="img" aria-hidden="true">';
        $svg .= '<circle cx="' . $cx . '" cy="' . $cy . '" r="' . $r . '" fill="none" stroke="var(--ring-bg)" stroke-width="' . $sw . '"/>';
        if ($total > 0) {
            $off = 0;
            foreach ($slices as $s) {
                if ($s['value'] <= 0) continue;
                $len = $s['value'] / $total * $c;
                $svg .= '<circle cx="' . $cx . '" cy="' . $cy . '" r="' . $r . '" fill="none" stroke="' . $s['color']
                      . '" stroke-width="' . $sw . '" stroke-dasharray="' . round($len, 2) . ' ' . round($c - $len, 2)
                      . '" stroke-dashoffset="' . round(-$off, 2) . '" transform="rotate(-90 ' . $cx . ' ' . $cy . ')"/>';
                $off += $len;
            }
        }
        $svg .= '<text x="' . $cx . '" y="' . ($cy - 1) . '" text-anchor="middle" font-family="Playfair Display,serif" font-size="30" font-weight="700" fill="var(--donut-ink)">' . $total . '</text>';
        $svg .= '<text x="' . $cx . '" y="' . ($cy + 17) . '" text-anchor="middle" font-size="10" letter-spacing="1.5" fill="#9a978c">ВСЕГО</text>';
        $svg .= '</svg>';
        return $svg;
    }
    /** Строка статуса системы. */
    function dash_sys_row(string $icon, string $title, string $sub, string $state): string {
        $badge = ['ok' => 'badge--paid', 'warn' => 'badge--judging', 'err' => 'badge--rejected', 'off' => 'badge--muted'][$state] ?? 'badge--muted';
        $word  = ['ok' => 'Работает', 'warn' => 'Внимание', 'err' => 'Сбой', 'off' => 'Не настроено'][$state] ?? '—';
        return '<div class="sys-row"><div class="sys-ico">' . admin_icon($icon) . '</div>'
             . '<div class="sys-meta"><b>' . h($title) . '</b><span>' . h($sub) . '</span></div>'
             . '<span class="badge ' . $badge . '">' . h($word) . '</span></div>';
    }
}

/* Палитры распределений (согласованы с .badge--*) */
$appPal  = ['new' => '#3a5f8f', 'paid' => '#2e7d4f', 'judging' => '#9a6b12', 'graded' => '#6a4bb0', 'sent' => '#1c8a72', 'rejected' => '#b3403f'];
$compPal = ['draft' => '#8a8a8a', 'open' => '#2e7d4f', 'closed' => '#b3403f', 'judging' => '#9a6b12', 'finished' => '#3a5f8f'];
$paySt   = ['paid' => ['Оплачено', 'badge--paid'], 'succeeded' => ['Оплачено', 'badge--paid'],
            'pending' => ['Ожидает', 'badge--judging'], 'canceled' => ['Отменён', 'badge--rejected'],
            'failed' => ['Ошибка', 'badge--rejected'], 'refunded' => ['Возврат', 'badge--muted']];

$appSlices = [];
foreach ($appPal as $k => $col) if (($appByStatus[$k] ?? 0) > 0) $appSlices[] = ['label' => app_status_ru($k), 'value' => $appByStatus[$k], 'color' => $col];
$compSlices = [];
foreach ($compPal as $k => $col) if (($compByStatus[$k] ?? 0) > 0) $compSlices[] = ['label' => comp_status_ru($k), 'value' => $compByStatus[$k], 'color' => $col];

ob_start(); ?>

<style>
.dashwrap{--ring-bg:rgba(139,111,31,.14);--donut-ink:#1B2340;--chart-grid:rgba(139,111,31,.12);--soft:rgba(139,111,31,.06)}
[data-theme=dark] .dashwrap{--ring-bg:rgba(255,255,255,.10);--donut-ink:#F1ECDD;--chart-grid:rgba(255,255,255,.08);--soft:rgba(255,255,255,.04)}

.dash-kpis{display:grid;gap:16px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));margin-bottom:20px}
.dash-2{display:grid;gap:18px;grid-template-columns:1fr 1fr;margin-bottom:20px}
.dash-2--sys{grid-template-columns:1.15fr .85fr}
@media(max-width:900px){.dash-2,.dash-2--sys{grid-template-columns:1fr}}

.kpi{position:relative;overflow:hidden}
.kpi .stat__value{margin:2px 0 0}
.kpi-top{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px;position:relative;z-index:1}
.kpi .stat__value,.kpi-foot,.mini-bar{position:relative;z-index:1}
.kpi-delta{display:inline-flex;align-items:center;gap:3px;font-size:.74rem;font-weight:800;padding:2px 8px;border-radius:999px;white-space:nowrap}
.kpi-delta svg{width:12px;height:12px;stroke-width:2.6}
.kpi-delta--up{background:#e9f6ee;color:#2e7d4f}
.kpi-delta--down{background:#fdeceb;color:#b3403f}
.kpi-delta--flat{background:#eef1f6;color:#6b6a63}
.kpi-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:6px;font-size:.8rem;color:var(--a-muted)}
.mini-bar{height:6px;border-radius:999px;background:var(--ring-bg);overflow:hidden;margin-top:11px}
.mini-bar>i{display:block;height:100%;border-radius:999px;background:var(--grad-gold)}

.chart-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}
.chart-head h3{margin:0}
.svgchart{width:100%;height:180px;display:block}
@media(max-width:520px){.svgchart{height:150px}}

.donut-card{display:flex;gap:20px;align-items:center;flex-wrap:wrap}
.donut{flex:0 0 auto}
.donut-legend{display:grid;gap:9px;font-size:.86rem;flex:1;min-width:150px}
.donut-legend .lg{display:flex;align-items:center;gap:9px}
.donut-legend .lg i{width:11px;height:11px;border-radius:3px;flex:0 0 11px}
.donut-legend .lg b{margin-left:auto;font-variant-numeric:tabular-nums;color:var(--donut-ink);font-weight:700}

.sys-list{display:flex;flex-direction:column}
.sys-row{display:flex;align-items:center;gap:13px;padding:12px 0;border-bottom:1px solid var(--a-line)}
.sys-row:last-child{border-bottom:none}
[data-theme=dark] .sys-row{border-bottom-color:rgba(255,255,255,.07)}
.sys-ico{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:var(--soft);flex:0 0 36px}
.sys-ico svg{width:18px;height:18px;stroke:var(--a-gold-dark);fill:none}
[data-theme=dark] .sys-ico svg{stroke:var(--a-gold-2)}
.sys-meta{flex:1;min-width:0}
.sys-meta b{display:block;font-family:var(--ff-body);font-weight:700;font-size:.9rem;color:var(--donut-ink)}
.sys-meta span{font-size:.8rem;color:var(--a-muted);overflow-wrap:anywhere}
.qa-grid{display:grid;gap:10px;margin-bottom:20px}
</style>

<div class="dashwrap">

  <!-- KPI-карточки с инфографикой -->
  <div class="dash-kpis">
    <div class="stat kpi">
      <div class="kpi-top"><div class="stat__label">Заявки</div><?= dash_delta_chip($apps_month, $apps_prev) ?></div>
      <div class="stat__value"><?= number_format($apps_total, 0, ',', ' ') ?></div>
      <div class="stat__icon"><?= admin_icon('applications') ?></div>
      <div class="kpi-foot"><span><?= $new_apps ?> новых</span><span><?= $apps_month ?> за месяц</span></div>
    </div>
    <div class="stat kpi">
      <div class="kpi-top"><div class="stat__label">Оплаты за месяц</div><?= dash_delta_chip($pay_month, $pay_prev) ?></div>
      <div class="stat__value"><?= number_format($pay_month, 0, ',', ' ') ?> ₽</div>
      <div class="stat__icon"><?= admin_icon('money') ?></div>
      <div class="kpi-foot"><span>Сегодня</span><span><?= money($pay_day) ?></span></div>
    </div>
    <div class="stat kpi">
      <div class="kpi-top"><div class="stat__label">Конкурсы</div><span class="badge badge--open" style="animation:none"><?= $comps_open ?> откр.</span></div>
      <div class="stat__value"><?= $comps_total ?></div>
      <div class="stat__icon"><?= admin_icon('competitions') ?></div>
      <?= dash_bar($comps_open, max(1, $comps_total)) ?>
    </div>
    <div class="stat kpi">
      <div class="kpi-top"><div class="stat__label">Дипломы</div><span class="badge badge--gold"><?= $dip_month ?> / мес</span></div>
      <div class="stat__value"><?= number_format($dip_total, 0, ',', ' ') ?></div>
      <div class="stat__icon"><?= admin_icon('diplomas') ?></div>
      <div class="kpi-foot"><span>Отправлено</span><span><?= $dip_sent ?> из <?= $dip_total ?></span></div>
      <?= dash_bar($dip_sent, max(1, $dip_total)) ?>
    </div>
    <div class="stat kpi">
      <div class="kpi-top"><div class="stat__label">Подписчики</div><?= dash_delta_chip($subs_month, $subs_prev) ?></div>
      <div class="stat__value"><?= number_format($subs, 0, ',', ' ') ?></div>
      <div class="stat__icon"><?= admin_icon('newsletter') ?></div>
      <div class="kpi-foot"><span>+<?= $subs_month ?> за месяц</span><span><?= $visits_day ?> визитов сегодня</span></div>
    </div>
  </div>

  <!-- Графики динамики (SVG из БД) -->
  <div class="dash-2">
    <div class="card">
      <div class="chart-head"><h3>Заявки · 14 дней</h3><span class="badge badge--gold"><?= array_sum($days) ?> всего</span></div>
      <?= dash_area_svg($days, 'grad-apps', '#C9A84C') ?>
      <div class="chart-x">
        <?php $i = 0; foreach ($days as $d => $c): ?>
          <div><?= ($i++ % 2 === 0) ? h(date('d.m', strtotime($d))) : '' ?></div>
        <?php endforeach; ?>
      </div>
    </div>
    <div class="card">
      <div class="chart-head"><h3>Оплаты · 14 дней</h3><span class="badge badge--gold"><?= money(array_sum($pdays)) ?></span></div>
      <?= dash_area_svg($pdays, 'grad-pays', '#2e7d4f') ?>
      <div class="chart-x">
        <?php $i = 0; foreach ($pdays as $d => $s): ?>
          <div><?= ($i++ % 2 === 0) ? h(date('d.m', strtotime($d))) : '' ?></div>
        <?php endforeach; ?>
      </div>
    </div>
  </div>

  <!-- Распределения (пончики) -->
  <div class="dash-2">
    <div class="card">
      <div class="chart-head"><h3>Заявки по статусам</h3></div>
      <div class="donut-card">
        <?= dash_donut($appSlices) ?>
        <div class="donut-legend">
          <?php if (!$appSlices): ?><span class="muted small">Заявок пока нет</span><?php endif; ?>
          <?php foreach ($appSlices as $s): ?>
            <span class="lg"><i style="background:<?= $s['color'] ?>"></i><?= h($s['label']) ?><b><?= $s['value'] ?></b></span>
          <?php endforeach; ?>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="chart-head"><h3>Конкурсы по статусам</h3></div>
      <div class="donut-card">
        <?= dash_donut($compSlices) ?>
        <div class="donut-legend">
          <?php if (!$compSlices): ?><span class="muted small">Конкурсов пока нет</span><?php endif; ?>
          <?php foreach ($compSlices as $s): ?>
            <span class="lg"><i style="background:<?= $s['color'] ?>"></i><?= h($s['label']) ?><b><?= $s['value'] ?></b></span>
          <?php endforeach; ?>
        </div>
      </div>
    </div>
  </div>

  <!-- Последние заявки и оплаты -->
  <div class="dash-2">
    <div class="card card--pad0">
      <div style="padding:18px 22px 12px"><h3 style="margin:0">Последние заявки</h3></div>
      <div class="table-wrap" style="border:none;border-radius:0">
        <table class="tbl">
          <thead><tr><th>Номер</th><th>Участник</th><th>Конкурс</th><th>Статус</th></tr></thead>
          <tbody>
            <?php if (!$recent): ?><tr><td colspan="4" class="muted" style="text-align:center;padding:22px">Заявок пока нет</td></tr><?php endif; ?>
            <?php foreach ($recent as $a): ?>
              <tr class="row-link" onclick="location.href='<?= a_link('applications', ['id' => $a['id']]) ?>'">
                <td><?= h($a['number'] ?: ('#' . $a['id'])) ?></td>
                <td><?= h($a['full_name']) ?></td>
                <td class="small"><?= h($a['comp']) ?></td>
                <td><span class="badge badge--<?= h($a['status']) ?>"><?= h(app_status_ru($a['status'])) ?></span></td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      </div>
    </div>

    <div class="card card--pad0">
      <div style="padding:18px 22px 12px"><h3 style="margin:0">Последние оплаты</h3></div>
      <div class="table-wrap" style="border:none;border-radius:0">
        <table class="tbl">
          <thead><tr><th>Заявка</th><th class="num">Сумма</th><th>Статус</th><th>Дата</th></tr></thead>
          <tbody>
            <?php if (!$recentPays): ?><tr><td colspan="4" class="muted" style="text-align:center;padding:22px">Оплат пока нет</td></tr><?php endif; ?>
            <?php foreach ($recentPays as $p): [$plabel, $pbadge] = $paySt[$p['status']] ?? [$p['status'], 'badge--muted']; ?>
              <tr>
                <td><?= h($p['app_no'] ?: ('#' . $p['id'])) ?></td>
                <td class="num"><?= money((int)$p['amount']) ?></td>
                <td><span class="badge <?= $pbadge ?>"><?= h($plabel) ?></span></td>
                <td class="small"><?= h(date('d.m H:i', strtotime((string)$p['created_at']))) ?></td>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Быстрые действия + статус системы -->
  <div class="dash-2 dash-2--sys">
    <div class="card">
      <h3>Быстрые действия</h3>
      <div class="qa-grid">
        <?php if (admin_can('competitions')): ?>
          <a class="btn btn--primary btn--block" href="<?= a_link('competitions', ['action' => 'edit']) ?>"><?= admin_icon('plus') ?>Создать конкурс</a>
        <?php endif; ?>
        <?php if (admin_can('grading')): ?>
          <a class="btn btn--navy btn--block" href="<?= a_link('grading') ?>"><?= admin_icon('grading') ?>Оценивание (<?= $to_grade ?>)</a>
        <?php endif; ?>
        <?php if (admin_can('newsletter')): ?>
          <a class="btn btn--ghost btn--block" href="<?= a_link('newsletter', ['action' => 'new']) ?>"><?= admin_icon('send') ?>Новая рассылка</a>
        <?php endif; ?>
        <a class="btn btn--ghost btn--block" href="<?= a_link('applications') ?>"><?= admin_icon('applications') ?>Все заявки</a>
      </div>
      <h4>Требует внимания</h4>
      <div class="kv">
        <dt>Открытых конкурсов</dt><dd><?= $comps_open ?></dd>
        <dt>Заявок к оценке</dt><dd><?= $to_grade ?></dd>
        <dt>Отзывов на модерации</dt><dd><?= $pending_rev ?><?php if ($pending_rev && admin_can('cms')): ?> · <a href="<?= a_link('cms', ['tab' => 'reviews']) ?>">открыть</a><?php endif; ?></dd>
        <dt>Писем в очереди</dt><dd><?= $queue_wait ?></dd>
      </div>
    </div>

    <div class="card">
      <h3>Статус системы</h3>
      <div class="sys-list">
        <?php
        echo dash_sys_row('clock', 'Плановые задачи (cron)',
            $cronAgeM === null ? 'Журнал запусков пуст' : ('Последний запуск ' . ($cronAgeM < 1 ? 'только что' : $cronAgeM . ' мин назад')),
            $cronOk ? 'ok' : ($cronAgeM === null ? 'off' : 'warn'));

        $mailSub = 'В очереди: ' . $queue_wait . ($mailFailed ? ' · ошибок: ' . $mailFailed : '')
                 . ($mailLastSent ? ' · последнее ' . h(date('d.m H:i', strtotime((string)$mailLastSent))) : '');
        echo dash_sys_row('newsletter', 'Почтовая рассылка', $mailSub,
            $mailFailed > 0 ? 'err' : ($queue_wait > 50 ? 'warn' : 'ok'));

        $paySub = $payReady
            ? ('ЮKassa подключена' . ($payPending ? ' · ожидают: ' . $payPending : '') . ($payLast ? ' · оплата ' . h(date('d.m', strtotime((string)$payLast))) : ''))
            : 'Ключи ЮKassa не заданы';
        echo dash_sys_row('money', 'Приём платежей', $paySub,
            !$payReady ? 'off' : ($payPending > 0 ? 'warn' : 'ok'));

        echo dash_sys_row('eye', 'Здоровье сайта',
            $health !== '' ? ('Статус: ' . $health) : 'Проверок ещё не было',
            $health === '' ? 'off' : (stripos($health, 'ok') !== false || stripos($health, 'up') !== false ? 'ok' : 'warn'));
        ?>
      </div>
    </div>
  </div>

</div>

<?php
$content = ob_get_clean();
admin_layout('Обзор', $content, 'dashboard');
