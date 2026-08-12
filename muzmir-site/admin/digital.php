<?php
/**
 * ЗАКАЗЫ ЭЛЕКТРОННЫХ НАГРАД.
 *
 * Сюда попадают ВСЕ электронные наградные документы, независимо от того, как они
 * возникли:
 *   • автоматическое изготовление по ПЛАТНОМУ конкурсу (основной + дополнительный
 *     диплом входят в оргвзнос) — записи в diplomas;
 *   • дополнительные заказы электронных наград по платному конкурсу — awards_orders
 *     с позициями kind='digital';
 *   • все электронные заказы по длинному (бесплатному) конкурсу.
 *
 * Группировка — ПО ЗАЯВКЕ: одна заявка = одна строка = ОДНО письмо участнику
 * (основной + дополнительный + именной + благодарность уходят вместе), при этом
 * предпросмотр доступен по каждому документу отдельно.
 *
 * Действия: перенести дату/время, отправить сейчас, продублировать, отменить,
 * редактировать данные заявки (из них собирается диплом) — как в «Отправках».
 */
declare(strict_types=1);

require_once BASE_PATH . '/core/app_status.php';
require_once BASE_PATH . '/core/dispatch_ops.php';

$DIG_LBL = ['main' => 'Основной диплом', 'extra' => 'Дополнительный диплом',
            'named' => 'Именной диплом', 'thanks' => 'Благодарность педагогу'];

/* ============================ ДЕЙСТВИЯ ============================ */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_check()) { flash('Сессия устарела. Обновите страницу.', 'error'); admin_redirect('digital'); }
    $appId = (int) input('app');
    $do    = (string) input('do');
    $dt    = (string) input('scheduled_at');

    $r = match ($do) {
        'sendnow' => dops_diplomas_send_now($appId, false),
        'dup'     => dops_diplomas_send_now($appId, true),
        'resched' => dops_diplomas_resched($appId, $dt),
        'cancel'  => dops_diplomas_cancel($appId),
        default   => ['ok' => false, 'msg' => 'Неизвестное действие.'],
    };
    if (input('ajax') === '1') json_out(['ok' => $r['ok'], 'msg' => $r['msg']]);
    flash($r['msg'], $r['ok'] ? 'success' : 'error');
    admin_redirect('digital', array_filter(['q' => input('q'), 'f' => input('f')]));
}

/* ============================ ДАННЫЕ ============================ */
$f = (string) input('f') ?: 'pending';          // pending | sent | all
if (!in_array($f, ['pending', 'sent', 'all'], true)) $f = 'pending';
$q = trim((string) input('q'));

// Все электронные документы с данными заявки и конкурса.
$w = "1=1"; $args = [];
if ($f === 'pending') $w .= " AND (d.sent_at IS NULL OR d.sent_at='')";
if ($f === 'sent')    $w .= " AND d.sent_at IS NOT NULL AND d.sent_at<>''";
if ($q !== '') {
    [$sq, $sa] = search_like(['a.full_name','a.group_name','a.number','a.email','a.phone',
                              'a.work_title','a.teacher','a.city','d.number','d.result','c.name'], $q);
    if ($sq !== '') { $w .= " AND ($sq)"; $args = array_merge($args, $sa); }
}

$rowsRaw = all("SELECT d.*, a.id AS app_id, a.number AS app_number, a.full_name, a.group_name,
                       a.is_group, a.email, a.phone, a.user_id,
                       c.name AS comp_name, c.is_paid AS comp_paid, c.results_mode
                  FROM diplomas d
                  JOIN applications a ON a.id = d.application_id
                  LEFT JOIN competitions c ON c.id = a.competition_id
                 WHERE $w
                 ORDER BY (d.sent_at IS NULL) DESC, d.scheduled_at ASC, d.id DESC
                 LIMIT 800", $args);

// Группировка по заявке — одна карточка = одно письмо.
$groups = [];
foreach ($rowsRaw as $d) {
    $aid = (int) $d['app_id'];
    if (!isset($groups[$aid])) {
        $groups[$aid] = [
            'app' => $d, 'items' => [], 'sent' => 0, 'total' => 0,
            'plan' => '', 'sent_at' => '', 'orders' => [], 'orders_sum' => 0,
        ];
    }
    $groups[$aid]['items'][] = $d;
    $groups[$aid]['total']++;
    $s = trim((string) ($d['sent_at'] ?? ''));
    $p = trim((string) ($d['scheduled_at'] ?? ''));
    if ($s !== '') {
        $groups[$aid]['sent']++;
        if ($groups[$aid]['sent_at'] === '' || $s > $groups[$aid]['sent_at']) $groups[$aid]['sent_at'] = $s;
    } elseif ($p !== '' && ($groups[$aid]['plan'] === '' || $p < $groups[$aid]['plan'])) {
        $groups[$aid]['plan'] = $p;
    }
}

// Доплата за электронные позиции (дополнительные заказы) — показываем в строке заявки.
if ($groups) {
    $ids = implode(',', array_map('intval', array_keys($groups)));
    foreach (all("SELECT * FROM awards_orders
                   WHERE application_id IN ($ids) AND items LIKE '%\"kind\":\"digital\"%'") as $o) {
        $aid = (int) $o['application_id'];
        if (!isset($groups[$aid])) continue;
        $its = json_decode((string) ($o['items'] ?? '[]'), true);
        $names = [];
        if (is_array($its)) {
            foreach ($its as $it) {
                if ((string) ($it['kind'] ?? '') === 'digital') $names[] = (string) ($it['item'] ?? '');
            }
        }
        $groups[$aid]['orders'][] = ['id' => (int) $o['id'], 'status' => (string) $o['status'],
                                     'amount' => (int) $o['amount'], 'names' => $names];
        if (in_array((string) $o['status'], ['paid','made','shipped','delivered'], true)) {
            $groups[$aid]['orders_sum'] += (int) $o['amount'];
        }
    }
}

// Счётчики вкладок.
// Счётчики вкладок считаем ТЕМ ЖЕ запросом, что и список — с JOIN на заявки.
// Иначе дипломы, чья заявка удалена, попадали в счётчик, но не в список, и вкладка
// показывала «В изготовлении · 12» при пустом списке.
$cntPending = (int) (scalar("SELECT COUNT(DISTINCT d.application_id) FROM diplomas d
                             JOIN applications a ON a.id = d.application_id
                            WHERE d.sent_at IS NULL OR d.sent_at=''") ?? 0);
$cntSent    = (int) (scalar("SELECT COUNT(DISTINCT d.application_id) FROM diplomas d
                             JOIN applications a ON a.id = d.application_id
                            WHERE d.sent_at IS NOT NULL AND d.sent_at<>''") ?? 0);
// Дипломы-сироты (заявка удалена) — чинить нечего, но админ должен о них знать.
$cntOrphan  = (int) (scalar("SELECT COUNT(*) FROM diplomas d
                              WHERE NOT EXISTS (SELECT 1 FROM applications a WHERE a.id = d.application_id)") ?? 0);

ob_start(); ?>
<div class="page-head">
  <h1>Заказы электронных наград</h1>
  <p class="muted small">
    Все электронные документы: автоматическое изготовление по платным конкурсам (основной и дополнительный
    входят в оргвзнос), дополнительные заказы электронных наград и электронные заказы длинных конкурсов.
    Одна заявка — одно письмо участнику; предпросмотр есть по каждому документу.
  </p>
</div>

<form method="get" class="filters" style="margin-bottom:14px">
  <input type="hidden" name="p" value="digital">
  <input type="hidden" name="f" value="<?= h($f) ?>">
  <div class="field"><label>Поиск</label>
    <input name="q" value="<?= h($q) ?>" placeholder="ФИО, коллектив, № заявки, № диплома, почта, телефон, конкурс, звание" style="min-width:300px"></div>
  <button class="btn btn--primary btn--sm"><?= admin_icon('search') ?>Найти</button>
  <?php if ($q !== ''): ?><a class="btn btn--ghost btn--sm" href="<?= a_link('digital', ['f'=>$f]) ?>">Сброс</a><?php endif; ?>
</form>

<div class="tabs" style="margin-bottom:18px;display:flex;gap:6px;flex-wrap:wrap;">
  <?php foreach (['pending' => 'В изготовлении · ' . $cntPending, 'sent' => 'Отправлены · ' . $cntSent, 'all' => 'Все'] as $k => $lbl): ?>
    <a class="tag <?= $f === $k ? 'active' : '' ?>" href="<?= a_link('digital', array_filter(['f'=>$k,'q'=>$q])) ?>"
       style="padding:7px 13px;border-radius:10px;<?= $f===$k?'background:var(--a-navy);color:#fff;':'' ?>"><?= h($lbl) ?></a>
  <?php endforeach; ?>
</div>
<?php if ($cntOrphan > 0): ?>
  <p class="small muted" style="margin:-10px 0 16px">
    Ещё <?= (int) $cntOrphan ?> шт. дипломов остались от удалённых заявок — в списке их нет и отправить их нельзя.
  </p>
<?php endif; ?>

<?php if (!$groups): ?>
  <div class="card"><p class="muted">По этому фильтру ничего нет.</p></div>
<?php else: ?>
  <?php foreach ($groups as $aid => $g): $a = $g['app'];
    $who = (int) ($a['is_group'] ?? 0) ? (string) $a['group_name'] : (string) $a['full_name'];
    $allSent = $g['sent'] === $g['total'] && $g['total'] > 0; ?>
    <div class="card" style="margin-bottom:14px" id="dig-<?= (int)$aid ?>">
      <div style="display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;align-items:flex-start">
        <div style="min-width:0">
          <b><?= h($who ?: '—') ?></b>
          <?= vip_mark((int)($a['user_id'] ?? 0), '', (string)($a['email'] ?? '')) ?>
          <div class="small muted">
            <?= h((string)$a['comp_name']) ?> · заявка <?= h((string)$a['app_number']) ?> ·
            <?= h((string)$a['email']) ?>
            <?= (int)($a['comp_paid'] ?? 0) === 1 ? ' · <span class="badge badge--paid small">платный</span>' : ' · <span class="badge badge--muted small">бесплатный</span>' ?>
          </div>
        </div>
        <div style="text-align:right">
          <?php if ($allSent): ?>
            <span class="badge badge--made">Отправлено <?= h(dops_dt($g['sent_at'])) ?></span>
          <?php elseif ($g['plan'] !== ''): ?>
            <span class="badge badge--making">Придёт <?= h(dops_dt($g['plan'])) ?></span>
          <?php else: ?>
            <span class="badge badge--judging">Без срока</span>
          <?php endif; ?>
          <?php if ($g['orders_sum'] > 0): ?>
            <div class="small muted" style="margin-top:5px">Доп. заказ: <?= number_format($g['orders_sum'], 0, '.', ' ') ?> ₽</div>
          <?php endif; ?>
        </div>
      </div>

      <div class="table-wrap" style="margin-top:12px"><table class="tbl">
        <thead><tr><th>Документ</th><th>Звание / номинация</th><th>Номер</th><th>Состояние</th><th>Предпросмотр</th></tr></thead>
        <tbody>
        <?php foreach ($g['items'] as $d):
          $s = trim((string)($d['sent_at'] ?? '')); $p = trim((string)($d['scheduled_at'] ?? '')); ?>
          <tr>
            <td class="small"><b><?= h($DIG_LBL[(string)$d['type']] ?? (string)$d['type']) ?></b></td>
            <td class="small"><?= h((string)($d['result'] ?? '—')) ?></td>
            <td class="small"><?= h((string)$d['number']) ?></td>
            <td class="small">
              <?php if ($s !== ''): ?><span class="badge badge--made">Отправлен <?= h(dops_dt($s)) ?></span>
              <?php elseif ($p !== ''): ?><span class="badge badge--making">Придёт <?= h(dops_dt($p)) ?></span>
              <?php else: ?><span class="badge badge--judging">Без срока</span><?php endif; ?>
            </td>
            <td class="small">
              <a class="btn btn--ghost btn--sm" target="_blank" rel="noopener"
                 href="<?= url('/diploma-view/' . rawurlencode((string)$d['number'])) ?>"><?= admin_icon('eye') ?>Смотреть</a>
              <a class="btn btn--ghost btn--sm" target="_blank" rel="noopener"
                 href="<?= url('/diploma/' . rawurlencode((string)$d['number']) . '.pdf') ?>">PDF</a>
            </td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table></div>

      <?php if ($g['orders']): ?>
        <p class="small muted" style="margin:10px 0 0">
          Дополнительные электронные заказы:
          <?php foreach ($g['orders'] as $o): ?>
            <span class="badge badge--<?= h($o['status']) ?>">#<?= (int)$o['id'] ?> · <?= h(implode(', ', $o['names'])) ?> · <?= (int)$o['amount'] ?> ₽</span>
          <?php endforeach; ?>
        </p>
      <?php endif; ?>

      <form method="post" action="<?= url('/admin/?p=digital') ?>" style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
        <?= csrf_field() ?>
        <input type="hidden" name="app" value="<?= (int)$aid ?>">
        <input type="hidden" name="q" value="<?= h($q) ?>"><input type="hidden" name="f" value="<?= h($f) ?>">
        <?php if (!$allSent): ?>
          <input type="datetime-local" name="scheduled_at"
                 value="<?= h($g['plan'] !== '' ? date('Y-m-d\TH:i', strtotime($g['plan'])) : '') ?>">
          <button class="btn btn--ghost btn--sm" name="do" value="resched">Перенести</button>
          <button class="btn btn--primary btn--sm" name="do" value="sendnow"><?= admin_icon('send') ?>Отправить сейчас</button>
          <button class="btn btn--ghost btn--sm" name="do" value="cancel" style="color:#C0392B;border-color:#C0392B"
                  onclick="return confirm('Отменить отправку электронных наград по этой заявке?')">Отменить</button>
        <?php endif; ?>
        <?php if ($g['sent'] > 0): ?>
          <button class="btn btn--navy btn--sm" name="do" value="dup"
                  onclick="return confirm('Отправить письмо со всеми электронными наградами ещё раз?')"><?= admin_icon('copy') ?>Продублировать</button>
        <?php endif; ?>
        <a class="btn btn--ghost btn--sm" href="<?= a_link('applications', ['id'=>(int)$aid]) ?>"><?= admin_icon('edit') ?>Заявка</a>
        <a class="btn btn--ghost btn--sm" href="<?= a_link('diploma_editor', ['app'=>(int)$aid]) ?>">Шаблон награды</a>
      </form>
    </div>
  <?php endforeach; ?>
<?php endif; ?>
<?php
$content = ob_get_clean();
admin_layout('Заказы электронных наград', $content, 'digital');
