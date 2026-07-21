<?php
/** Обзор: виджеты + графики (инлайновый SVG) + быстрые действия. */
declare(strict_types=1);

$paidStatuses = "('paid','succeeded')";

$new_apps    = (int) scalar("SELECT COUNT(*) FROM applications WHERE status='new'");
$apps_month  = (int) scalar("SELECT COUNT(*) FROM applications WHERE created_at >= date('now','start of month')");
$pay_day     = (int) scalar("SELECT COALESCE(SUM(amount),0) FROM payments WHERE status IN $paidStatuses AND date(created_at)=date('now')");
$pay_month   = (int) scalar("SELECT COALESCE(SUM(amount),0) FROM payments WHERE status IN $paidStatuses AND created_at >= date('now','start of month')");
$subs        = (int) scalar("SELECT COUNT(*) FROM subscribers WHERE active=1");
$subs_month  = (int) scalar("SELECT COUNT(*) FROM subscribers WHERE created_at >= date('now','start of month')");
$visits_day  = (int) scalar("SELECT COUNT(DISTINCT ip) FROM audit_log WHERE date(created_at)=date('now')");
$comps_open  = (int) scalar("SELECT COUNT(*) FROM competitions WHERE status='open'");
$pending_rev = (int) scalar("SELECT COUNT(*) FROM reviews WHERE status='pending'");
$queue_wait  = (int) scalar("SELECT COUNT(*) FROM mail_queue WHERE status='queued'");
$to_grade    = (int) scalar("SELECT COUNT(*) FROM applications WHERE status IN ('paid','judging')");

/* Заявки по дням за 14 дней */
$days = [];
for ($i = 13; $i >= 0; $i--) $days[date('Y-m-d', strtotime("-$i day"))] = 0;
foreach (all("SELECT date(created_at) d, COUNT(*) c FROM applications
              WHERE created_at >= date('now','-13 day') GROUP BY d") as $r) {
    if (isset($days[$r['d']])) $days[$r['d']] = (int)$r['c'];
}
$maxDay = max(1, max($days));

/* Оплаты по дням за 14 дней */
$pdays = array_fill_keys(array_keys($days), 0);
foreach (all("SELECT date(created_at) d, COALESCE(SUM(amount),0) s FROM payments
              WHERE status IN $paidStatuses AND created_at >= date('now','-13 day') GROUP BY d") as $r) {
    if (isset($pdays[$r['d']])) $pdays[$r['d']] = (int)$r['s'];
}
$maxPay = max(1, max($pdays));

$recent = all("SELECT a.id,a.number,a.full_name,a.status,a.created_at,c.name comp
               FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id
               ORDER BY a.id DESC LIMIT 8");

ob_start(); ?>

<div class="grid grid-4" style="margin-bottom:20px">
  <div class="stat">
    <div class="stat__icon"><?= admin_icon('applications') ?></div>
    <div class="stat__label">Новые заявки</div>
    <div class="stat__value"><?= $new_apps ?></div>
    <div class="stat__sub"><?= $apps_month ?> за месяц</div>
  </div>
  <div class="stat">
    <div class="stat__icon"><?= admin_icon('money') ?></div>
    <div class="stat__label">Оплаты за день</div>
    <div class="stat__value"><?= number_format($pay_day, 0, ',', ' ') ?></div>
    <div class="stat__sub"><?= money($pay_month) ?> за месяц</div>
  </div>
  <div class="stat">
    <div class="stat__icon"><?= admin_icon('newsletter') ?></div>
    <div class="stat__label">Подписчики</div>
    <div class="stat__value"><?= number_format($subs, 0, ',', ' ') ?></div>
    <div class="stat__sub">+<?= $subs_month ?> за месяц</div>
  </div>
  <div class="stat">
    <div class="stat__icon"><?= admin_icon('eye') ?></div>
    <div class="stat__label">Посещения (день)</div>
    <div class="stat__value"><?= $visits_day ?></div>
    <div class="stat__sub">уникальных IP в журнале</div>
  </div>
</div>

<div class="grid grid-2" style="margin-bottom:20px">
  <div class="card">
    <div class="section-title"><h3>Заявки за 14 дней</h3><span class="badge badge--gold"><?= array_sum($days) ?> всего</span></div>
    <div class="chart-bars">
      <?php foreach ($days as $d => $c): ?>
        <div class="bar" style="height:<?= max(3, round($c / $maxDay * 100)) ?>%" title="<?= h(ru_date($d)) ?>: <?= $c ?>"></div>
      <?php endforeach; ?>
    </div>
    <div class="chart-x">
      <?php $i=0; foreach ($days as $d => $c): ?>
        <div><?= ($i++ % 2 === 0) ? h(date('d.m', strtotime($d))) : '' ?></div>
      <?php endforeach; ?>
    </div>
  </div>
  <div class="card">
    <div class="section-title"><h3>Оплаты за 14 дней</h3><span class="badge badge--gold"><?= money(array_sum($pdays)) ?></span></div>
    <div class="chart-bars">
      <?php foreach ($pdays as $d => $s): ?>
        <div class="bar" style="height:<?= max(3, round($s / $maxPay * 100)) ?>%" title="<?= h(ru_date($d)) ?>: <?= money($s) ?>"></div>
      <?php endforeach; ?>
    </div>
    <div class="chart-x">
      <?php $i=0; foreach ($pdays as $d => $s): ?>
        <div><?= ($i++ % 2 === 0) ? h(date('d.m', strtotime($d))) : '' ?></div>
      <?php endforeach; ?>
    </div>
  </div>
</div>

<div class="grid grid-2">
  <div class="card card--pad0">
    <div style="padding:18px 22px"><h3 style="margin:0">Последние заявки</h3></div>
    <div class="table-wrap" style="border:none;border-radius:0">
      <table class="tbl">
        <thead><tr><th>Номер</th><th>Участник</th><th>Конкурс</th><th>Статус</th></tr></thead>
        <tbody>
          <?php if (!$recent): ?>
            <tr><td colspan="4" class="muted" style="text-align:center;padding:24px">Заявок пока нет</td></tr>
          <?php endif; ?>
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

  <div class="card">
    <h3>Быстрые действия</h3>
    <div style="display:grid;gap:10px;margin-bottom:22px">
      <?php if (admin_can('competitions')): ?>
        <a class="btn btn--primary btn--block" href="<?= a_link('competitions', ['action' => 'edit']) ?>"><?= admin_icon('plus') ?>Создать конкурс</a>
      <?php endif; ?>
      <?php if (admin_can('grading')): ?>
        <a class="btn btn--navy btn--block" href="<?= a_link('grading') ?>"><?= admin_icon('grading') ?>Перейти к оцениванию (<?= $to_grade ?>)</a>
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
</div>

<?php
$content = ob_get_clean();
admin_layout('Обзор', $content, 'dashboard');
