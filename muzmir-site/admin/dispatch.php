<?php
/**
 * ЖИВОЙ ПУЛЬТ АВТОМАТИЗАЦИИ («Отправки»).
 *
 * Единая таблица всех запланированных авто-действий в реальном времени — даже после
 * оценки/заказа. Даниэль может зайти и по каждой строке:
 *   • изменить дату/время отправки;
 *   • отправить сейчас (моментально);
 *   • отменить;
 *   • отредактировать (тема/адрес письма).
 *
 * Источники (реальные механизмы, не заглушки):
 *   1) Дипломы к отправке   — diplomas.scheduled_at (крон send_diplomas.php шлёт по времени);
 *   2) Письма в очереди     — mail_queue (крон process_newsletter_queue шлёт; scheduled_at держит/откладывает);
 *   3) Заказы в производстве — awards_orders (оплачено→изготовить→отправить), с плановыми
 *      датами «изготовить до / отправить до» (раб. дни от даты оплаты/диспетча).
 */
declare(strict_types=1);

if (is_file(BASE_PATH . '/core/mailer.php')) require_once BASE_PATH . '/core/mailer.php';

/* --------- мягкие миграции нужных колонок (идемпотентно) --------- */
try { db()->exec("ALTER TABLE mail_queue ADD COLUMN scheduled_at TEXT"); } catch (\Throwable $e) {}
try { db()->exec("ALTER TABLE diplomas ADD COLUMN scheduled_at TEXT"); } catch (\Throwable $e) {}

/** Прибавить N рабочих дней (вс — выходной) к дате-времени. */
function disp_add_workdays(string $from, int $days): string {
    try { $t = new DateTime($from ?: 'now'); } catch (\Throwable $e) { $t = new DateTime('now'); }
    $added = 0;
    while ($added < $days) {
        $t->modify('+1 day');
        if ((int) $t->format('N') !== 7) $added++; // 7 = воскресенье
    }
    return $t->format('Y-m-d H:i:s');
}

/** Русская дата-время коротко. */
function disp_dt(string $s): string {
    $s = trim($s);
    if ($s === '') return '—';
    $ts = strtotime($s);
    return $ts ? date('d.m.Y H:i', $ts) : $s;
}

/** Просрочено/скоро — цвет плашки времени. */
function disp_when_badge(string $s): array {
    $ts = strtotime($s ?: '');
    if (!$ts) return ['#8892B0', 'без времени'];
    $now = time();
    if ($ts <= $now) return ['#C0392B', 'уходит сейчас'];
    if ($ts - $now < 3600 * 24) return ['#C79322', disp_dt($s)];
    return ['#2C7BE5', disp_dt($s)];
}

/* ============================ POST-обработчики ============================ */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('dispatch'); }
    $do   = input('do');
    $kind = input('kind');           // diploma | mail | order
    $id   = (int) input('id');

    /* ---- ДИПЛОМ ---- */
    if ($kind === 'diploma' && $id) {
        if ($do === 'resched') {
            $dt = trim(input('scheduled_at'));
            if ($dt !== '') {
                $norm = date('Y-m-d H:i:s', strtotime(str_replace('T', ' ', $dt)) ?: time());
                update('diplomas', ['scheduled_at' => $norm], 'id=:id', ['id' => $id]);
                audit('dispatch_resched', 'diploma', $id, ['at' => $norm]);
                flash('Дата отправки диплома изменена на ' . disp_dt($norm) . '.', 'success');
            }
        } elseif ($do === 'sendnow') {
            // Делаем диплом «просроченным» — крон подхватит первым (order by scheduled_at ASC)
            // и отправит в течение минуты. Плюс пробуем толкнуть крон немедленно.
            update('diplomas', ['scheduled_at' => '2000-01-01 00:00:00'], 'id=:id', ['id' => $id]);
            @exec('cd ' . escapeshellarg(BASE_PATH) . ' && php cron/send_diplomas.php > /dev/null 2>&1 &');
            audit('dispatch_sendnow', 'diploma', $id, []);
            flash('Диплом поставлен на моментальную отправку (уйдёт в течение минуты).', 'success');
        } elseif ($do === 'cancel') {
            q("DELETE FROM diplomas WHERE id=? AND sent_at IS NULL", [$id]);
            audit('dispatch_cancel', 'diploma', $id, []);
            flash('Плановая отправка диплома отменена.', 'info');
        }
        admin_redirect('dispatch');
    }

    /* ---- ПИСЬМО ---- */
    if ($kind === 'mail' && $id) {
        if ($do === 'resched') {
            $dt = trim(input('scheduled_at'));
            $norm = $dt !== '' ? date('Y-m-d H:i:s', strtotime(str_replace('T', ' ', $dt)) ?: time()) : null;
            update('mail_queue', ['scheduled_at' => $norm], 'id=:id', ['id' => $id]);
            audit('dispatch_resched', 'mail', $id, ['at' => $norm]);
            flash('Время письма изменено' . ($norm ? ' на ' . disp_dt($norm) : '') . '.', 'success');
        } elseif ($do === 'sendnow') {
            // Одиночное письмо шлём НАПРЯМУЮ (моментально), без ожидания крона.
            $m = one("SELECT * FROM mail_queue WHERE id=? AND status='queued'", [$id]);
            if ($m && function_exists('mail_send')) {
                $opt = [];
                if (!empty($m['attach'])) $opt['attach'] = (string) $m['attach'];
                if (function_exists('mail_route_account')) { $acc = mail_route_account($m); if ($acc) $opt['account'] = $acc; }
                $ok = false;
                try { $ok = (bool) mail_send((string) $m['to_email'], (string) $m['subject'], (string) $m['body'], $opt); } catch (\Throwable $e) {}
                if ($ok) {
                    update('mail_queue', ['status' => 'sent', 'sent_at' => date('Y-m-d H:i:s'), 'scheduled_at' => null], 'id=:id', ['id' => $id]);
                    flash('Письмо отправлено сейчас.', 'success');
                } else {
                    update('mail_queue', ['scheduled_at' => null, 'priority' => 0], 'id=:id', ['id' => $id]);
                    flash('Мгновенная отправка не удалась — письмо поставлено в приоритетную очередь (уйдёт в течение минуты).', 'warning');
                }
                audit('dispatch_sendnow', 'mail', $id, ['ok' => $ok]);
            } else {
                flash('Письмо не найдено или уже обработано.', 'error');
            }
        } elseif ($do === 'cancel') {
            update('mail_queue', ['status' => 'cancelled'], 'id=:id', ['id' => $id]);
            audit('dispatch_cancel', 'mail', $id, []);
            flash('Письмо отменено — отправлено не будет.', 'info');
        } elseif ($do === 'edit') {
            $subj = trim(input('subject'));
            $to   = mb_strtolower(trim(input('to_email')));
            $data = [];
            if ($subj !== '') $data['subject'] = $subj;
            if ($to !== '' && filter_var($to, FILTER_VALIDATE_EMAIL)) $data['to_email'] = $to;
            if ($data) { update('mail_queue', $data, 'id=:id', ['id' => $id]); flash('Письмо отредактировано.', 'success'); }
            audit('dispatch_edit', 'mail', $id, array_keys($data));
        }
        admin_redirect('dispatch');
    }

    /* ---- ЗАКАЗ ---- */
    if ($kind === 'order' && $id) {
        require_once BASE_PATH . '/core/orders.php';
        if ($do === 'made') {
            update('awards_orders', ['status' => 'made', 'made_at' => date('Y-m-d H:i:s')], 'id=:id', ['id' => $id]);
            flash('Заказ №' . $id . ' отмечен изготовленным.', 'success');
        } elseif ($do === 'ship') {
            $track = trim(input('tracking'));
            if ($track === '') { flash('Введите трек-номер.', 'error'); admin_redirect('dispatch'); }
            $ok = function_exists('order_mark_shipped') ? order_mark_shipped($id, $track) : false;
            flash($ok ? ('Заказ №' . $id . ' отправлен, участнику ушло письмо с трек-номером.') : 'Статус обновлён, письмо не ушло.', $ok ? 'success' : 'warning');
        } elseif ($do === 'redispatch') {
            update('awards_orders', ['dispatched_at' => ''], 'id=:id', ['id' => $id]);
            $ok = function_exists('order_dispatch_production') ? order_dispatch_production($id) : false;
            flash($ok ? ('Пакет заказа №' . $id . ' переотправлен в производство (Telegram).') : 'Не удалось отправить в Telegram.', $ok ? 'success' : 'error');
        } elseif ($do === 'resched') {
            // Меняем «дату оплаты/диспетча» — плановые сроки изготовления/отправки считаются от неё.
            $dt = trim(input('scheduled_at'));
            if ($dt !== '') {
                $norm = date('Y-m-d H:i:s', strtotime(str_replace('T', ' ', $dt)) ?: time());
                update('awards_orders', ['dispatched_at' => $norm], 'id=:id', ['id' => $id]);
                flash('Точка отсчёта сроков заказа №' . $id . ' изменена на ' . disp_dt($norm) . '.', 'success');
            }
        }
        admin_redirect('dispatch');
    }

    admin_redirect('dispatch');
}

/* ================================ ДАННЫЕ ================================= */
$now = date('Y-m-d H:i:s');

// Настройки сроков (раб. дни).
$makeDays = (int) (function_exists('setting') ? setting('order_make_days', '7') : 7);
$shipDays = (int) (function_exists('setting') ? setting('order_ship_days', '14') : 14);

// 1) Дипломы к отправке (ещё не отправлены).
$diplomas = all("SELECT d.*, a.full_name, a.group_name, a.is_group, a.email, a.number app_number,
                        c.name comp_name
                 FROM diplomas d
                 JOIN applications a ON a.id=d.application_id
                 LEFT JOIN competitions c ON c.id=a.competition_id
                 WHERE d.sent_at IS NULL
                 ORDER BY (d.scheduled_at IS NULL) ASC, d.scheduled_at ASC, d.id ASC LIMIT 300");

// 2) Письма в очереди (не отправленные, не отменённые).
$mails = all("SELECT * FROM mail_queue WHERE status='queued' ORDER BY
              (scheduled_at IS NULL OR scheduled_at='') DESC, scheduled_at ASC, id ASC LIMIT 300");

// 3) Заказы в производстве (оплаченные и в пути).
$orders = all("SELECT * FROM awards_orders
               WHERE status IN ('paid','made','shipped') AND items NOT LIKE '%\"kind\":\"club\"%'
               ORDER BY (status='paid') DESC, id DESC LIMIT 200");

$dTypeLbl = ['main' => 'Основной диплом', 'named' => 'Именной диплом', 'extra' => 'Спец-награда', 'thanks' => 'Благодарность педагогу'];

ob_start(); ?>
<div class="page-head">
  <h1>Отправки · живой пульт</h1>
  <p class="muted small">Всё, что уходит автоматически — дипломы после оценки, письма из очереди, оригиналы наград после оплаты. По каждой строке: изменить дату/время, отправить сейчас, отменить, отредактировать. Обновляется в реальном времени.</p>
</div>

<div class="tabs" style="margin-bottom:18px;display:flex;gap:6px;flex-wrap:wrap;">
  <a class="tag active" href="#dip" style="padding:7px 13px;border-radius:10px;">Дипломы к отправке · <?= count($diplomas) ?></a>
  <a class="tag" href="#mail" style="padding:7px 13px;border-radius:10px;">Письма в очереди · <?= count($mails) ?></a>
  <a class="tag" href="#ord" style="padding:7px 13px;border-radius:10px;">Заказы в производстве · <?= count($orders) ?></a>
</div>

<!-- ============ ДИПЛОМЫ ============ -->
<div class="card" id="dip" style="margin-bottom:20px;">
  <div class="section-title" style="margin-bottom:8px"><h3>Дипломы к отправке</h3></div>
  <p class="small muted" style="margin:-4px 0 12px">После оценки диплом планируется автоматически (платные — +5 раб. дней, ВИП — +3; длинные бесплатные — в дату публикации). Здесь можно сдвинуть время, отправить сейчас или отменить.</p>
  <?php if (!$diplomas): ?>
    <p class="muted">Запланированных дипломов нет.</p>
  <?php else: ?>
  <div class="table-wrap"><table class="tbl">
    <thead><tr><th>Кому</th><th>Диплом</th><th>Конкурс</th><th>Плановая отправка</th><th>Действия</th></tr></thead>
    <tbody>
    <?php foreach ($diplomas as $d): $who = $d['is_group'] ? $d['group_name'] : $d['full_name'];
      [$wc, $wl] = disp_when_badge((string)($d['scheduled_at'] ?? '')); ?>
      <tr>
        <td><?= h((string)$who) ?><br><span class="small muted"><?= h((string)$d['email']) ?> · №<?= h((string)$d['app_number']) ?></span></td>
        <td class="small"><?= h($dTypeLbl[(string)$d['type']] ?? (string)$d['type']) ?><br><span class="muted"><?= h((string)$d['result']) ?></span></td>
        <td class="small"><?= h((string)$d['comp_name']) ?></td>
        <td><span style="display:inline-block;padding:4px 10px;border-radius:999px;background:<?= $wc ?>;color:#fff;font-size:12px;font-weight:700;white-space:nowrap"><?= h($wl) ?></span></td>
        <td>
          <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
            <form method="post" action="<?= url('/admin/') ?>" style="display:inline-flex;gap:4px;align-items:center;"><?= csrf_field() ?>
              <input type="hidden" name="kind" value="diploma"><input type="hidden" name="do" value="resched"><input type="hidden" name="id" value="<?= (int)$d['id'] ?>">
              <input type="datetime-local" name="scheduled_at" value="<?= h($d['scheduled_at'] ? date('Y-m-d\TH:i', strtotime((string)$d['scheduled_at'])) : '') ?>" style="padding:5px 8px;border:1px solid var(--a-line);border-radius:8px;font-size:12px;">
              <button class="btn btn--ghost btn--sm" type="submit" title="Изменить дату/время">OK</button>
            </form>
            <form method="post" action="<?= url('/admin/') ?>" style="display:inline"><?= csrf_field() ?>
              <input type="hidden" name="kind" value="diploma"><input type="hidden" name="do" value="sendnow"><input type="hidden" name="id" value="<?= (int)$d['id'] ?>">
              <button class="btn btn--primary btn--sm" type="submit"><?= admin_icon('send') ?>Сейчас</button>
            </form>
            <form method="post" action="<?= url('/admin/') ?>" style="display:inline" onsubmit="return confirm('Отменить плановую отправку диплома?')"><?= csrf_field() ?>
              <input type="hidden" name="kind" value="diploma"><input type="hidden" name="do" value="cancel"><input type="hidden" name="id" value="<?= (int)$d['id'] ?>">
              <button class="btn btn--ghost btn--sm" type="submit" style="color:#C0392B;border-color:#C0392B"><?= admin_icon('trash') ?? 'X' ?></button>
            </form>
          </div>
        </td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table></div>
  <?php endif; ?>
</div>

<!-- ============ ПИСЬМА ============ -->
<div class="card" id="mail" style="margin-bottom:20px;">
  <div class="section-title" style="margin-bottom:8px"><h3>Письма в очереди</h3></div>
  <p class="small muted" style="margin:-4px 0 12px">Транзакционные (заявки, результаты, оплаты, дипломы) уходят сразу; массовые — по плану прогрева. Плановое время держит письмо до нужного момента. «Сейчас» — моментальная отправка.</p>
  <?php if (!$mails): ?>
    <p class="muted">Очередь писем пуста.</p>
  <?php else: ?>
  <div class="table-wrap"><table class="tbl">
    <thead><tr><th>Кому</th><th>Тема</th><th>Тип</th><th>Плановое время</th><th>Действия</th></tr></thead>
    <tbody>
    <?php foreach ($mails as $m):
      $prio = (int)($m['priority'] ?? 0);
      $whenRaw = (string)($m['scheduled_at'] ?? '');
      [$wc, $wl] = $whenRaw !== '' ? disp_when_badge($whenRaw) : ['#1E9E5A', $prio === 0 ? 'сразу' : 'по плану'];
    ?>
      <tr>
        <td class="small"><?= h((string)$m['to_email']) ?><?= $m['to_name'] ? '<br><span class="muted">'.h((string)$m['to_name']).'</span>' : '' ?></td>
        <td class="small"><?= h(mb_strimwidth((string)$m['subject'], 0, 60, '…')) ?></td>
        <td><span class="badge <?= $prio===0?'badge--paid':'badge--muted' ?> small"><?= $prio===0?'транз.':'массов.' ?></span></td>
        <td><span style="display:inline-block;padding:4px 10px;border-radius:999px;background:<?= $wc ?>;color:#fff;font-size:12px;font-weight:700;white-space:nowrap"><?= h($wl) ?></span></td>
        <td>
          <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
            <form method="post" action="<?= url('/admin/') ?>" style="display:inline-flex;gap:4px;align-items:center;"><?= csrf_field() ?>
              <input type="hidden" name="kind" value="mail"><input type="hidden" name="do" value="resched"><input type="hidden" name="id" value="<?= (int)$m['id'] ?>">
              <input type="datetime-local" name="scheduled_at" value="<?= h($whenRaw ? date('Y-m-d\TH:i', strtotime($whenRaw)) : '') ?>" style="padding:5px 8px;border:1px solid var(--a-line);border-radius:8px;font-size:12px;">
              <button class="btn btn--ghost btn--sm" type="submit" title="Изменить/держать">OK</button>
            </form>
            <form method="post" action="<?= url('/admin/') ?>" style="display:inline"><?= csrf_field() ?>
              <input type="hidden" name="kind" value="mail"><input type="hidden" name="do" value="sendnow"><input type="hidden" name="id" value="<?= (int)$m['id'] ?>">
              <button class="btn btn--primary btn--sm" type="submit"><?= admin_icon('send') ?>Сейчас</button>
            </form>
            <button class="btn btn--ghost btn--sm" type="button" onclick="document.getElementById('me<?= (int)$m['id'] ?>').style.display=(document.getElementById('me<?= (int)$m['id'] ?>').style.display==='none'?'flex':'none')" title="Редактировать">✎</button>
            <form method="post" action="<?= url('/admin/') ?>" style="display:inline" onsubmit="return confirm('Отменить письмо?')"><?= csrf_field() ?>
              <input type="hidden" name="kind" value="mail"><input type="hidden" name="do" value="cancel"><input type="hidden" name="id" value="<?= (int)$m['id'] ?>">
              <button class="btn btn--ghost btn--sm" type="submit" style="color:#C0392B;border-color:#C0392B"><?= admin_icon('trash') ?? 'X' ?></button>
            </form>
          </div>
          <form method="post" action="<?= url('/admin/') ?>" id="me<?= (int)$m['id'] ?>" style="display:none;gap:6px;margin-top:8px;flex-wrap:wrap;align-items:center;"><?= csrf_field() ?>
            <input type="hidden" name="kind" value="mail"><input type="hidden" name="do" value="edit"><input type="hidden" name="id" value="<?= (int)$m['id'] ?>">
            <input type="email" name="to_email" value="<?= h((string)$m['to_email']) ?>" placeholder="email" style="padding:6px 9px;border:1px solid var(--a-line);border-radius:8px;min-width:200px;">
            <input type="text" name="subject" value="<?= h((string)$m['subject']) ?>" placeholder="тема" style="padding:6px 9px;border:1px solid var(--a-line);border-radius:8px;min-width:260px;flex:1;">
            <button class="btn btn--navy btn--sm" type="submit">Сохранить</button>
          </form>
        </td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table></div>
  <?php endif; ?>
</div>

<!-- ============ ЗАКАЗЫ ============ -->
<div class="card" id="ord" style="margin-bottom:20px;">
  <div class="section-title" style="margin-bottom:8px"><h3>Заказы оригиналов в производстве</h3></div>
  <p class="small muted" style="margin:-4px 0 12px">После оплаты заказ уходит в производство автоматически. Плановые сроки: изготовить до <?= $makeDays ?> раб. дн., отправить до <?= $shipDays ?> раб. дн. от оплаты. Отметить изготовление, отправить с трек-номером или изменить точку отсчёта сроков.</p>
  <?php if (!$orders): ?>
    <p class="muted">Заказов в производстве нет. <a href="<?= a_link('orders') ?>">Все заказы →</a></p>
  <?php else: ?>
  <?php foreach ($orders as $o):
    $oid=(int)$o['id']; $st=(string)$o['status'];
    $anchor = trim((string)($o['dispatched_at'] ?? '')) ?: trim((string)($o['created_at'] ?? $now));
    $makeBy = disp_add_workdays($anchor, $makeDays);
    $shipBy = disp_add_workdays($anchor, $shipDays);
    $STAT=['paid'=>'К изготовлению','made'=>'Изготовлено','shipped'=>'Отправлено'];
    $badge=['paid'=>'#C79322','made'=>'#2C7BE5','shipped'=>'#17307A'][$st] ?? '#8892B0';
  ?>
    <div style="border:1px solid var(--a-line);border-radius:12px;padding:12px 14px;margin-bottom:10px;">
      <div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:space-between;align-items:center;">
        <div>
          <b style="color:var(--a-navy)">Заказ №<?= $oid ?></b> · <?= h((string)$o['full_name']) ?>
          <span style="display:inline-block;margin-left:6px;padding:3px 10px;border-radius:999px;background:<?= $badge ?>;color:#fff;font-size:11px;font-weight:700;"><?= h($STAT[$st] ?? $st) ?></span>
          <div class="small muted"><?= h((string)$o['competition']) ?> · <?= h((string)$o['result']) ?> · <?= h(function_exists('money')?money((int)$o['amount']):(int)$o['amount'].' ₽') ?></div>
        </div>
        <div class="small" style="text-align:right;">
          <div>Изготовить до: <b style="color:<?= strtotime($makeBy)<time()&&$st==='paid'?'#C0392B':'#17307A' ?>"><?= disp_dt($makeBy) ?></b></div>
          <div>Отправить до: <b style="color:<?= strtotime($shipBy)<time()&&$st!=='shipped'?'#C0392B':'#17307A' ?>"><?= disp_dt($shipBy) ?></b></div>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:10px;">
        <?php if ($st==='paid'): ?>
          <form method="post" action="<?= url('/admin/') ?>" style="display:inline"><?= csrf_field() ?>
            <input type="hidden" name="kind" value="order"><input type="hidden" name="do" value="made"><input type="hidden" name="id" value="<?= $oid ?>">
            <button class="btn btn--navy btn--sm" type="submit"><?= admin_icon('check') ?>Изготовлено</button>
          </form>
        <?php endif; ?>
        <?php if (in_array($st,['paid','made'],true)): ?>
          <form method="post" action="<?= url('/admin/') ?>" style="display:inline-flex;gap:5px;align-items:center;"><?= csrf_field() ?>
            <input type="hidden" name="kind" value="order"><input type="hidden" name="do" value="ship"><input type="hidden" name="id" value="<?= $oid ?>">
            <input type="text" name="tracking" placeholder="Трек-номер" required style="padding:6px 10px;border:1px solid var(--a-line);border-radius:8px;min-width:170px;">
            <button class="btn btn--primary btn--sm" type="submit"><?= admin_icon('truck') ?? '' ?>Отправить сейчас</button>
          </form>
        <?php endif; ?>
        <form method="post" action="<?= url('/admin/') ?>" style="display:inline-flex;gap:4px;align-items:center;"><?= csrf_field() ?>
          <input type="hidden" name="kind" value="order"><input type="hidden" name="do" value="resched"><input type="hidden" name="id" value="<?= $oid ?>">
          <input type="datetime-local" name="scheduled_at" value="<?= h(date('Y-m-d\TH:i', strtotime($anchor))) ?>" style="padding:5px 8px;border:1px solid var(--a-line);border-radius:8px;font-size:12px;" title="Точка отсчёта сроков">
          <button class="btn btn--ghost btn--sm" type="submit">Сроки</button>
        </form>
        <form method="post" action="<?= url('/admin/') ?>" style="display:inline;margin-left:auto"><?= csrf_field() ?>
          <input type="hidden" name="kind" value="order"><input type="hidden" name="do" value="redispatch"><input type="hidden" name="id" value="<?= $oid ?>">
          <button class="btn btn--ghost btn--sm" type="submit"><?= admin_icon('send') ?>В производство (Telegram)</button>
        </form>
      </div>
    </div>
  <?php endforeach; ?>
  <p class="small"><a href="<?= a_link('orders') ?>">Открыть полный раздел «Заказы оригиналов» →</a></p>
  <?php endif; ?>
</div>
<?php
$content = ob_get_clean();
admin_layout('Отправки', $content, 'dispatch');
