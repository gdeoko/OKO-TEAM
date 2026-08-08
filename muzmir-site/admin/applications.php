<?php
/** Заявки: таблица с фильтрами, карточка, массовые действия, экспорт CSV. */
declare(strict_types=1);

/** Собираем WHERE из фильтров. */
function apps_filter(): array {
    $w = []; $a = [];
    if ($c = (int) input('competition')) { $w[] = 'a.competition_id=?'; $a[] = $c; }
    if ($n = input('nomination')) { $w[] = 'a.nomination=?'; $a[] = $n; }
    if ($cat = input('category')) { $w[] = 'a.age_category=?'; $a[] = $cat; }
    if ($s = input('status')) { $w[] = 'a.status=?'; $a[] = $s; }
    if ($d1 = input('date_from')) { $w[] = 'date(a.created_at)>=?'; $a[] = $d1; }
    if ($d2 = input('date_to')) { $w[] = 'date(a.created_at)<=?'; $a[] = $d2; }
    // Поиск: регистронезависимый для кириллицы (search_like → mb_lower), по всем
    // значимым полям заявки и названию конкурса, с поддержкой нескольких слов.
    // Раньше искали LIKE по трём полям — «иванов» не находил «Иванов».
    if (($qs = trim((string) input('q'))) !== '') {
        [$sq, $sa] = search_like([
            'a.full_name', 'a.group_name', 'a.number', 'a.email', 'a.phone',
            'a.work_title', 'a.teacher', 'a.institution', 'a.city',
            'a.nomination', 'a.result', 'c.name',
        ], $qs);
        if ($sq !== '') { $w[] = '(' . $sq . ')'; $a = array_merge($a, $sa); }
    }
    // ГЕЙТ ПО ОПЛАТЕ (Даниэль): неоплаченные заявки на ПЛАТНЫЕ конкурсы по умолчанию
    // скрыты — «до оплаты заявки не существует для админов». is_paid=1 у всех
    // бесплатных (ставится сразу) и у оплаченных платных. Чекбокс «Ожидают оплаты»
    // (show_unpaid=1) раскрывает их для поддержки/диагностики без потери данных.
    if (input('show_unpaid') !== '1') { $w[] = 'a.is_paid=1'; }
    return [$w ? 'WHERE ' . implode(' AND ', $w) : '', $a];
}

/* ---------- Экспорт CSV (до любого вывода) ---------- */
if (input('action') === 'export') {
    [$where, $args] = apps_filter();
    $rows = all("SELECT a.*, c.name comp, c.is_paid comp_paid FROM applications a
                 LEFT JOIN competitions c ON c.id=a.competition_id $where ORDER BY a.id DESC", $args);
    audit('applications_export', 'application', null, ['count' => count($rows)]);
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="applications-' . date('Y-m-d') . '.csv"');
    $out = fopen('php://output', 'w');
    fprintf($out, "\xEF\xBB\xBF"); // BOM для Excel
    fputcsv($out, ['Номер','Конкурс','ФИО/Коллектив','Номинация','Форма','Категория','Произведение','Педагог','Учреждение','Город','Email','Телефон','Видео','Статус','Оплата','Балл','Результат','Создана'], ';');
    foreach ($rows as $r) {
        fputcsv($out, [
            $r['number'], $r['comp'], $r['is_group'] ? $r['group_name'] : $r['full_name'],
            $r['nomination'], $r['formation'], $r['age_category'], $r['work_title'],
            $r['teacher'], $r['institution'], $r['city'], $r['email'], $r['phone'],
            $r['video_url'], app_status_ru($r['status']), $r['is_paid'] ? 'да' : 'нет',
            $r['score'], $r['result'], $r['created_at'],
        ], ';');
    }
    fclose($out);
    exit;
}

/* ---------- Массовые действия ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'bulk') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('applications'); }
    $ids = array_map('intval', $_POST['ids'] ?? []);
    $act = input('bulk_action');
    if ($ids && $act) {
        $in = implode(',', array_fill(0, count($ids), '?'));
        // Переносы статусов «на оценку»/«в новые» убраны: очередь оценивания собирает
        // все неоценённые заявки автоматически (admin/grading.php).
        $map = ['mark_paid'=>['is_paid'=>1,'status'=>'paid'], 'reject'=>['status'=>'rejected']];
        if (isset($map[$act])) {
            $set = implode(',', array_map(fn($k)=>"$k=?", array_keys($map[$act])));
            q("UPDATE applications SET $set WHERE id IN ($in)", array_merge(array_values($map[$act]), $ids));
            audit('applications_bulk', 'application', null, ['action'=>$act,'ids'=>$ids]);
            flash('Обновлено заявок: ' . count($ids) . '.', 'success');
        } elseif ($act === 'mark_new') {
            // Вернуть в «новые» и снять оценку (исправление ошибочно оценённых).
            q("UPDATE applications SET status='new',score=NULL,result='',graded_at=NULL,jury_comment='' WHERE id IN ($in)", $ids);
            audit('applications_bulk', 'application', null, ['action'=>'mark_new','ids'=>$ids]);
            flash('Возвращено в новые: ' . count($ids) . '.', 'success');
        } elseif ($act === 'delete') {
            q("DELETE FROM applications WHERE id IN ($in)", $ids);
            audit('applications_bulk', 'application', null, ['action'=>'delete','ids'=>$ids]);
            flash('Удалено заявок: ' . count($ids) . '.', 'success');
        } elseif ($act === 'flag_suspicious') {
            q("UPDATE applications SET flag='suspicious' WHERE id IN ($in)", $ids);
            audit('applications_flag', 'application', null, ['ids'=>$ids]);
            flash('Отмечено как подозрительные: ' . count($ids) . '.', 'success');
        }
    }
    admin_redirect('applications', array_filter(['competition'=>input('competition'),'status'=>input('status')]));
}

/* ---------- Смена статуса одной заявки (аварийная; переносы «на оценку» убраны —
              статус-цепочка подана→оценена→исполнена работает автоматически) ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'set_status') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('applications'); }
    $id = (int) input('id');
    $st = input('status');
    if (in_array($st, ['new','submitted','pending','paid','judging','graded','sent','done','rejected'], true)) {
        $extra = $st === 'paid' ? ',is_paid=1' : '';
        // Возврат в «до-аттестации» — снимаем оценку/результат (это исправляет ошибочно оценённые заявки).
        if (in_array($st, ['new','submitted','pending','judging'], true)) $extra .= ",score=NULL,result='',graded_at=NULL,jury_comment=''";
        q("UPDATE applications SET status=? $extra WHERE id=?", [$st, $id]);
        audit('application_status', 'application', $id, ['status'=>$st]);
        flash('Статус заявки обновлён.', 'success');
    }
    admin_redirect('applications', ['id' => $id]);
}

/* ---------- Удаление одной заявки ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'delete_app') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('applications'); }
    $id = (int) input('id');
    if ($id > 0) {
        q("DELETE FROM applications WHERE id=?", [$id]);
        audit('application_delete', 'application', $id, []);
        flash('Заявка удалена.', 'success');
    }
    admin_redirect('applications');
}

/* ---------- Редактирование полей заявки (перед печатью диплома) ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'edit_app') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('applications'); }
    $id = (int) input('id');
    $cur = one("SELECT * FROM applications WHERE id=?", [$id]);
    if (!$cur) { flash('Заявка не найдена.', 'error'); admin_redirect('applications'); }

    $data = [
        'full_name'    => trim((string) input('full_name')),
        'group_name'   => trim((string) input('group_name')),
        'teacher'      => trim((string) input('teacher')),
        'nomination'   => trim((string) input('nomination')),
        'work_title'   => trim((string) input('work_title')),
        'institution'  => trim((string) input('institution')),
        'city'         => trim((string) input('city')),
        'age_category' => trim((string) input('age_category')),
    ];

    // Валидация по справочникам (если доступны). Пустое значение допустимо.
    if ($data['nomination'] !== '' && function_exists('NOMINATIONS')
        && !array_key_exists($data['nomination'], NOMINATIONS())) {
        flash('Недопустимая номинация — выберите из списка.', 'error');
        admin_redirect('applications', ['id' => $id]);
    }
    if ($data['age_category'] !== '' && function_exists('AGE_CATEGORIES')
        && !in_array($data['age_category'], AGE_CATEGORIES(), true)) {
        flash('Недопустимая возрастная категория — выберите из списка.', 'error');
        admin_redirect('applications', ['id' => $id]);
    }

    update('applications', $data, 'id=:id', ['id' => $id]);
    // Аудит только реально изменившихся полей.
    $changed = [];
    foreach ($data as $k => $v) if ((string)($cur[$k] ?? '') !== (string)$v) $changed[$k] = $v;
    audit('application_edit', 'application', $id, ['changed' => array_keys($changed)]);
    flash($changed ? 'Данные заявки обновлены (' . count($changed) . ').' : 'Изменений нет.', $changed ? 'success' : 'info');
    admin_redirect('applications', ['id' => $id]);
}

/* ---------- Действия по отправкам прямо из карточки заявки ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && in_array((string) input('do'), [
        'result_sendnow','result_dup','result_resched','result_cancel',
        'dip_sendnow','dip_dup','dip_resched','dip_cancel'], true)) {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('applications'); }
    require_once BASE_PATH . '/core/dispatch_ops.php';
    $aid = (int) input('id');
    $dt  = (string) input('scheduled_at');
    $r = match ((string) input('do')) {
        'result_sendnow' => dops_result_send_now($aid, false),
        'result_dup'     => dops_result_send_now($aid, true),
        'result_resched' => dops_result_resched($aid, $dt),
        'result_cancel'  => dops_result_cancel($aid),
        'dip_sendnow'    => dops_diplomas_send_now($aid, false),
        'dip_dup'        => dops_diplomas_send_now($aid, true),
        'dip_resched'    => dops_diplomas_resched($aid, $dt),
        'dip_cancel'     => dops_diplomas_cancel($aid),
    };
    flash($r['msg'], $r['ok'] ? 'success' : 'error');
    admin_redirect('applications', ['id' => $aid]);
}

/* ================= КАРТОЧКА ЗАЯВКИ ================= */
if ($id = (int) input('id')) {
    require_once BASE_PATH . '/core/app_status.php';
    require_once BASE_PATH . '/core/dispatch_ops.php';
    $a = one("SELECT a.*, c.name comp, c.slug comp_slug, c.is_paid comp_paid, c.price comp_price,
                     c.results_mode comp_results_mode, c.results_published_at comp_results_pub
              FROM applications a
              LEFT JOIN competitions c ON c.id=a.competition_id WHERE a.id=?", [$id]);
    if (!$a) { flash('Заявка не найдена.', 'error'); admin_redirect('applications'); }
    // Живой профиль подателя: ФИО и фото берём ИЗ users, а не из заявки, — так админка
    // всегда видит то же, что участник поменял у себя в кабинете. Данные самой заявки
    // при этом не переписываем: в дипломе печатается ФИО, поданное на конкурс.
    $acc = ((int) ($a['user_id'] ?? 0) > 0)
        ? one("SELECT id, full_name, email, avatar, role FROM users WHERE id=?", [(int) $a['user_id']])
        : null;

    // Полная картина исполнения: результат, награды, доп. заказы, деньги.
    $st       = app_state($a, true);
    $paidSum  = (int) (scalar("SELECT COALESCE(SUM(amount),0) FROM payments
                                WHERE application_id=? AND status IN ('succeeded','paid')", [$id]) ?? 0);
    $isFree   = (int) ($a['comp_paid'] ?? 1) === 0;
    // Единая расшифровка денег по заявке (core/loyalty.php): касса + сумма на заявке +
    // из чего сложилась скидка. Раньше здесь смотрели ТОЛЬКО в payments, и заявка,
    // оплаченная без чека ЮKassa, показывалась как «не оплачено».
    $pv = app_payment_view($a);
    $dipLbl   = ['main'=>'Основной диплом','extra'=>'Дополнительный диплом','named'=>'Именной диплом','thanks'=>'Благодарность педагогу'];
    $ordLbl   = ['new'=>'Не оплачен','paid'=>'Оплачен','made'=>'Изготовлен','shipped'=>'Отправлен','delivered'=>'Доставлен'];

    ob_start(); ?>
    <div class="toolbar">
      <a class="btn btn--ghost btn--sm" href="<?= a_link('applications') ?>"><?= admin_icon('back') ?>К списку</a>
      <?php /* Кнопка «Оценить» убрана намеренно (Даниэль): оценка ТОЛЬКО в разделах
              «Оценка коротких» / «Оценка длинных», короткие и длинные не пересекаются. */ ?>
    </div>
    <!-- ====== ИСПОЛНЕНИЕ ЗАЯВКИ: статус, результат, награды, заказы ====== -->
    <div class="card" style="margin-bottom:18px">
      <div class="section-title" style="margin-bottom:6px">
        <h3>Исполнение заявки</h3>
        <span class="badge badge--<?= h($st['code']) ?>"><?= h($st['label']) ?></span>
      </div>
      <p class="small muted" style="margin:0 0 14px"><?= h($st['detail']) ?></p>

      <dl class="kv" style="margin-bottom:16px">
        <dt>Сумма участия</dt>
        <dd>
          <?php if ($pv['free']): ?>
            <span class="badge badge--muted">Бесплатный конкурс</span>
          <?php elseif ($pv['paid']): ?>
            <b><?= $pv['amount'] > 0 ? number_format($pv['amount'], 0, '.', ' ') . ' ₽' : 'оплачено' ?></b>
            <?= $pv['pct'] > 0 ? ' <span class="badge badge--paid">−' . (int) $pv['pct'] . '%</span>' : '' ?>
          <?php else: ?>
            <span class="muted"><?= number_format($pv['base'], 0, '.', ' ') ?> ₽ — не оплачено</span>
          <?php endif; ?>
          <?php if ($pv['lines']): ?>
            <ul class="small muted" style="margin:6px 0 0;padding-left:18px;line-height:1.5">
              <?php foreach ($pv['lines'] as $ln): ?><li><?= h($ln) ?></li><?php endforeach; ?>
            </ul>
          <?php endif; ?>
        </dd>
        <dt>Подана</dt><dd><?= h(date('d.m.Y H:i', strtotime((string)$a['created_at']))) ?></dd>
        <?php if (!empty($a['graded_at'])): ?>
          <dt>Оценена жюри</dt><dd><?= h(date('d.m.Y H:i', strtotime((string)$a['graded_at']))) ?></dd>
        <?php endif; ?>
      </dl>

      <!-- ---- РЕЗУЛЬТАТ ---- -->
      <div style="border:1px solid var(--a-line);border-radius:12px;padding:14px 16px;margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center">
          <div>
            <b>Аттестационный результат</b><br>
            <?php if (trim((string)$a['result']) !== ''): ?>
              <span class="badge badge--gold"><?= h($a['result']) ?></span>
              <?php if (!empty($a['extra_diploma'])): ?> <span class="badge badge--extra"><?= h($a['extra_diploma']) ?></span><?php endif; ?>
            <?php else: ?><span class="muted small">не проставлен</span><?php endif; ?>
          </div>
          <div class="small">
            <?php if ($st['result_sent_at'] !== ''): ?>
              <span class="badge badge--made">Отправлен <?= h(dops_dt($st['result_sent_at'])) ?></span>
            <?php elseif ($st['result_plan_at'] !== ''): ?>
              <span class="badge badge--making">Придёт <?= h(dops_dt($st['result_plan_at'])) ?></span>
            <?php elseif (trim((string)$a['result']) !== ''): ?>
              <span class="badge badge--judging">Ожидает отправки</span>
            <?php endif; ?>
          </div>
        </div>
        <?php if (trim((string)$a['result']) !== ''): ?>
          <form method="post" action="<?= url('/admin/?p=applications') ?>" class="disp-acts" style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
            <?= csrf_field() ?><input type="hidden" name="id" value="<?= $id ?>">
            <?php if ($st['result_sent_at'] === ''): ?>
              <input type="datetime-local" name="scheduled_at" value="<?= h($st['result_plan_at'] ? date('Y-m-d\TH:i', strtotime($st['result_plan_at'])) : '') ?>">
              <button class="btn btn--ghost btn--sm" name="do" value="result_resched">Перенести</button>
              <button class="btn btn--primary btn--sm" name="do" value="result_sendnow"><?= admin_icon('send') ?>Отправить сейчас</button>
              <button class="btn btn--ghost btn--sm" name="do" value="result_cancel" style="color:#C0392B;border-color:#C0392B"
                      onclick="return confirm('Отменить плановую отправку результата?')">Отменить</button>
            <?php else: ?>
              <button class="btn btn--navy btn--sm" name="do" value="result_dup"
                      onclick="return confirm('Отправить письмо с результатом ещё раз?')"><?= admin_icon('copy') ?>Продублировать результат</button>
            <?php endif; ?>
          </form>
        <?php endif; ?>
      </div>

      <!-- ---- НАГРАДНЫЕ ДОКУМЕНТЫ ---- -->
      <div style="border:1px solid var(--a-line);border-radius:12px;padding:14px 16px;margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center">
          <b>Наградные документы <span class="small muted">(<?= (int)$st['diplomas_sent'] ?> из <?= (int)$st['diplomas_total'] ?> отправлено)</span></b>
          <?php if ($st['diplomas_total'] > 0): ?>
            <span class="small">
              <?php if ($st['diplomas_sent'] === $st['diplomas_total']): ?>
                <span class="badge badge--made">Отправлены <?= h(dops_dt($st['diploma_sent_at'])) ?></span>
              <?php elseif ($st['diploma_plan_at'] !== ''): ?>
                <span class="badge badge--making">Придут <?= h(dops_dt($st['diploma_plan_at'])) ?></span>
              <?php endif; ?>
            </span>
          <?php endif; ?>
        </div>

        <?php if (!$st['diplomas']): ?>
          <p class="small muted" style="margin:10px 0 0">Документы ещё не сформированы — появятся после аттестации (создаёт cron/send_diplomas).</p>
        <?php else: ?>
          <div class="table-wrap" style="margin-top:10px"><table class="tbl">
            <thead><tr><th>Документ</th><th>Номер</th><th>Состояние</th><th>Просмотр</th></tr></thead>
            <tbody>
            <?php foreach ($st['diplomas'] as $d):
              $sent = trim((string)($d['sent_at'] ?? '')); $plan = trim((string)($d['scheduled_at'] ?? '')); ?>
              <tr>
                <td class="small"><b><?= h($dipLbl[(string)$d['type']] ?? (string)$d['type']) ?></b>
                  <?php if (!empty($d['result'])): ?><br><span class="muted"><?= h($d['result']) ?></span><?php endif; ?></td>
                <td class="small"><?= h((string)$d['number']) ?></td>
                <td class="small">
                  <?php if ($sent !== ''): ?><span class="badge badge--made">Отправлен <?= h(dops_dt($sent)) ?></span>
                  <?php elseif ($plan !== ''): ?><span class="badge badge--making">Придёт <?= h(dops_dt($plan)) ?></span>
                  <?php else: ?><span class="badge badge--judging">Без срока</span><?php endif; ?>
                </td>
                <td class="small">
                  <a class="btn btn--ghost btn--sm" target="_blank" rel="noopener"
                     href="<?= url('/diploma-view/' . rawurlencode((string)$d['number'])) ?>"><?= admin_icon('eye') ?>Предпросмотр</a>
                </td>
              </tr>
            <?php endforeach; ?>
            </tbody>
          </table></div>

          <form method="post" action="<?= url('/admin/?p=applications') ?>" style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap;align-items:center">
            <?= csrf_field() ?><input type="hidden" name="id" value="<?= $id ?>">
            <?php if ($st['diplomas_sent'] < $st['diplomas_total']): ?>
              <input type="datetime-local" name="scheduled_at" value="<?= h($st['diploma_plan_at'] ? date('Y-m-d\TH:i', strtotime($st['diploma_plan_at'])) : '') ?>">
              <button class="btn btn--ghost btn--sm" name="do" value="dip_resched">Перенести</button>
              <button class="btn btn--primary btn--sm" name="do" value="dip_sendnow"><?= admin_icon('send') ?>Отправить сейчас</button>
              <button class="btn btn--ghost btn--sm" name="do" value="dip_cancel" style="color:#C0392B;border-color:#C0392B"
                      onclick="return confirm('Отменить плановую отправку наград? Документы будут пересозданы автоматически.')">Отменить</button>
            <?php endif; ?>
            <?php if ($st['diplomas_sent'] > 0): ?>
              <button class="btn btn--navy btn--sm" name="do" value="dip_dup"
                      onclick="return confirm('Отправить письмо со всеми наградами ещё раз?')"><?= admin_icon('copy') ?>Продублировать награды</button>
            <?php endif; ?>
          </form>
        <?php endif; ?>
      </div>

      <!-- ---- ДОПОЛНИТЕЛЬНЫЕ ЗАКАЗЫ ---- -->
      <div style="border:1px solid var(--a-line);border-radius:12px;padding:14px 16px">
        <b>Дополнительные заказы наградного материала</b>
        <?php if (!$st['orders']): ?>
          <p class="small muted" style="margin:8px 0 0">Заказов нет.</p>
        <?php else: ?>
          <div class="table-wrap" style="margin-top:10px"><table class="tbl">
            <thead><tr><th>№</th><th>Состав</th><th>Сумма</th><th>Статус</th><th>Оформлен</th><th></th></tr></thead>
            <tbody>
            <?php foreach ($st['orders'] as $o):
              $its = json_decode((string)($o['items'] ?? '[]'), true);
              $itsTxt = is_array($its)
                ? implode(', ', array_map(fn($x) => (string)($x['item'] ?? '') . (($x['kind'] ?? '') === 'digital' ? ' (эл.)' : ''), $its))
                : ''; ?>
              <tr>
                <td class="small">#<?= (int)$o['id'] ?></td>
                <td class="small"><?= h($itsTxt ?: '—') ?><?= !empty($o['tracking']) ? '<br><span class="muted">трек: '.h((string)$o['tracking']).'</span>' : '' ?></td>
                <td class="small"><b><?= number_format((int)$o['amount'], 0, '.', ' ') ?> ₽</b></td>
                <td class="small"><span class="badge badge--<?= h((string)$o['status']) ?>"><?= h($ordLbl[(string)$o['status']] ?? (string)$o['status']) ?></span></td>
                <td class="small"><?= h(date('d.m.Y', strtotime((string)$o['created_at']))) ?></td>
                <td class="small"><a class="btn btn--ghost btn--sm" href="<?= a_link('orders', ['id'=>(int)$o['id']]) ?>">Открыть</a></td>
              </tr>
            <?php endforeach; ?>
            </tbody>
          </table></div>
        <?php endif; ?>
      </div>
    </div>

    <div class="grid grid-2">
      <div class="card">
        <div class="section-title"><h3><?= h($a['number'] ?: '#'.$a['id']) ?></h3>
          <span class="badge badge--<?= h($st['code']) ?>"><?= h($st['label']) ?></span></div>
        <dl class="kv">
          <dt>Конкурс</dt><dd><?= h($a['comp']) ?></dd>
          <?php if ($acc): ?>
          <dt>Аккаунт</dt><dd style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <?php $__av = trim((string)($acc['avatar'] ?? '')); ?>
            <span style="width:28px;height:28px;border-radius:50%;overflow:hidden;flex:none;display:inline-flex;
                         align-items:center;justify-content:center;background:var(--a-line);font-size:.72rem;font-weight:700">
              <?php if ($__av !== ''): ?><img src="<?= h($__av) ?>" alt="" style="width:100%;height:100%;object-fit:cover">
              <?php else: ?><?= h(mb_strtoupper(mb_substr(trim((string)($acc['full_name'] ?? '?')), 0, 1))) ?><?php endif; ?>
            </span>
            <a href="<?= a_link('users', ['action'=>'profile','id'=>(int)$acc['id']]) ?>"><?= h($acc['full_name'] ?: $acc['email']) ?></a>
            <?= vip_mark((int)$acc['id'], (string)($acc['role'] ?? ''), (string)($acc['email'] ?? '')) ?>
            <?php if (trim((string)$acc['full_name']) !== '' && trim((string)$a['full_name']) !== ''
                      && mb_strtolower(trim((string)$acc['full_name'])) !== mb_strtolower(trim((string)$a['full_name']))): ?>
              <span class="small muted">(в заявке подано «<?= h((string)$a['full_name']) ?>» — в дипломе печатается оно)</span>
            <?php endif; ?>
          </dd>
          <?php endif; ?>
          <dt><?= $a['is_group'] ? 'Коллектив' : 'Участник' ?></dt><dd><?= h($a['is_group'] ? $a['group_name'] : $a['full_name']) ?></dd>
          <?php if ($a['is_group']): ?><dt>Контактное лицо</dt><dd><?= h($a['full_name']) ?></dd><?php endif; ?>
          <dt>Номинация</dt><dd><?= h($a['nomination']) ?><?= $a['subgroup'] ? ' · '.h($a['subgroup']) : '' ?></dd>
          <dt>Форма</dt><dd><?= h($a['formation']) ?></dd>
          <dt>Категория</dt><dd><?= h($a['age_category']) ?></dd>
          <dt>Произведение</dt><dd><?= h($a['work_title']) ?></dd>
          <dt>Педагог</dt><dd><?= h($a['teacher'] ?: '—') ?></dd>
          <dt>Учреждение</dt><dd><?= h($a['institution'] ?: '—') ?></dd>
          <dt>Город</dt><dd><?= h($a['city'] ?: '—') ?></dd>
          <dt>Email</dt><dd><a href="mailto:<?= h($a['email']) ?>"><?= h($a['email']) ?></a></dd>
          <dt>Телефон</dt><dd><?= h($a['phone'] ?: '—') ?></dd>
          <dt>Оплата</dt><dd><?= $pv['free'] ? '<span class="badge badge--muted">Бесплатный конкурс</span>'
                : ($pv['paid'] ? '<span class="badge badge--paid">Оплачено</span>' : '<span class="badge badge--muted">Не оплачено</span>') ?><?php
                if (!$pv['free'] && $pv['paid'] && $pv['amount'] > 0): ?> · <?= number_format($pv['amount'], 0, '.', ' ') ?> ₽<?php
                if ($pv['pct'] > 0): ?> <span class="small muted">(−<?= (int)$pv['pct'] ?>%)</span><?php endif; endif; ?></dd>
          <?php if ($a['score'] !== null): ?><dt>Балл / результат</dt><dd><b><?= h((string)$a['score']) ?></b> · <?= h($a['result']) ?></dd><?php endif; ?>
          <?php if ($a['flag']): ?><dt>Метка</dt><dd><span class="badge badge--rejected"><?= h($a['flag']) ?></span></dd><?php endif; ?>
          <dt>Создана</dt><dd><?= h($a['created_at']) ?></dd>
        </dl>
      </div>
      <div>
        <div class="card" style="margin-bottom:18px">
          <h3>Конкурсная работа</h3>
          <?php if ($a['video_url']): ?>
            <p><span class="tag"><?= h($a['video_platform'] ?: 'видео') ?></span></p>
            <a class="btn btn--navy btn--block" href="<?= h($a['video_url']) ?>" target="_blank" rel="noopener"><?= admin_icon('eye') ?>Открыть видео</a>
          <?php else: ?><p class="muted">Ссылка на видео не указана.</p><?php endif; ?>
        </div>
        <div class="card" style="margin-bottom:18px">
          <h3>Статус</h3>
          <p class="small muted" style="margin:-4px 0 10px">Статусы движутся автоматически: подана → оценена (после итога в «Оценивании») → исполнена (после отправки диплома). Ручная смена — только для аварийных случаев.</p>
          <form method="post" action="<?= url('/admin/?p=applications') ?>" class="field--inline">
            <?= csrf_field() ?><input type="hidden" name="do" value="set_status"><input type="hidden" name="id" value="<?= $id ?>">
            <select name="status" style="max-width:220px">
              <?php foreach (['new','submitted','pending','paid','judging','graded','sent','done','rejected'] as $s): ?>
                <option value="<?= $s ?>" <?= $a['status']===$s?'selected':'' ?>><?= h(app_status_ru($s)) ?></option>
              <?php endforeach; ?>
            </select>
            <button class="btn btn--primary btn--sm">Применить</button>
          </form>
          <p class="small muted" style="margin:8px 0 0">Возврат в «Новая/Подана» автоматически снимает оценку и результат.</p>
          <form method="post" action="<?= url('/admin/?p=applications') ?>" style="margin-top:10px" onsubmit="return confirm('Удалить заявку без возможности восстановления?')">
            <?= csrf_field() ?><input type="hidden" name="do" value="delete_app"><input type="hidden" name="id" value="<?= $id ?>">
            <button class="btn btn--ghost btn--sm" style="color:var(--error,#c0392b);border-color:var(--error,#c0392b)"><?= admin_icon('trash') ?? '' ?>Удалить заявку</button>
          </form>
        </div>
        <div class="card" style="margin-bottom:18px">
          <h3>Редактировать данные заявки</h3>
          <p class="small muted" style="margin:-4px 0 12px">Скорректируйте поля перед печатью диплома — они попадут в PDF и верификацию.</p>
          <form method="post" action="<?= url('/admin/?p=applications') ?>">
            <?= csrf_field() ?><input type="hidden" name="do" value="edit_app"><input type="hidden" name="id" value="<?= $id ?>">
            <div class="field"><label><?= $a['is_group'] ? 'Контактное лицо (ФИО)' : 'ФИО участника' ?></label>
              <input name="full_name" value="<?= h((string)$a['full_name']) ?>"></div>
            <?php if ($a['is_group']): ?>
              <div class="field"><label>Название коллектива</label>
                <input name="group_name" value="<?= h((string)$a['group_name']) ?>"></div>
            <?php else: ?>
              <input type="hidden" name="group_name" value="<?= h((string)$a['group_name']) ?>">
            <?php endif; ?>
            <div class="field"><label>Педагог</label>
              <input name="teacher" value="<?= h((string)$a['teacher']) ?>"></div>
            <div class="field"><label>Номинация</label>
              <select name="nomination">
                <option value="">— не указана —</option>
                <?php foreach (array_keys(NOMINATIONS()) as $n): ?>
                  <option value="<?= h($n) ?>" <?= (string)$a['nomination']===$n?'selected':'' ?>><?= h($n) ?></option>
                <?php endforeach; ?>
              </select></div>
            <div class="field"><label>Возрастная категория</label>
              <select name="age_category">
                <option value="">— не указана —</option>
                <?php foreach (AGE_CATEGORIES() as $cat): ?>
                  <option value="<?= h($cat) ?>" <?= (string)$a['age_category']===$cat?'selected':'' ?>><?= h($cat) ?></option>
                <?php endforeach; ?>
              </select></div>
            <div class="field"><label>Произведение</label>
              <input name="work_title" value="<?= h((string)$a['work_title']) ?>"></div>
            <div class="field"><label>Учреждение</label>
              <input name="institution" value="<?= h((string)$a['institution']) ?>"></div>
            <div class="field"><label>Город</label>
              <input name="city" value="<?= h((string)$a['city']) ?>"></div>
            <button class="btn btn--primary btn--sm"><?= admin_icon('check') ?>Сохранить данные</button>
          </form>
        </div>
        <?php /* Нижний блок «Оценки жюри» убран (Даниэль): у большинства заявок он писал
                 «Оценок пока нет», а итоговый результат и так показан выше, в «Исполнении
                 заявки». Сами оценки живут в разделах «Оценка коротких/длинных». */ ?>
      </div>
    </div>
    <?php
    $content = ob_get_clean();
    admin_layout('Заявка ' . ($a['number'] ?: '#'.$a['id']), $content, 'applications');
    exit;
}

/* ================= СПИСОК С ФИЛЬТРАМИ ================= */
[$where, $args] = apps_filter();
// JOIN нужен и в COUNT — поиск умеет искать по названию конкурса (c.name).
$total = (int) scalar("SELECT COUNT(*) FROM applications a
                       LEFT JOIN competitions c ON c.id=a.competition_id $where", $args);
$page  = max(1, (int) input('pg', '1'));
$per   = 50; $off = ($page - 1) * $per;
// Сумма оплаты берётся из подтверждённых платежей по заявке; для бесплатных конкурсов
// в колонке «Сумма» показывается «Бесплатно» (галочка/крестик там были неинформативны).
$rows = all("SELECT a.*, c.name comp, c.is_paid comp_paid, c.price comp_price, u.role AS user_role,
                    (SELECT COALESCE(SUM(p.amount),0) FROM payments p
                      WHERE p.application_id=a.id AND p.status IN ('succeeded','paid')) AS paid_sum
             FROM applications a
             LEFT JOIN competitions c ON c.id=a.competition_id
             LEFT JOIN users u ON u.id=a.user_id
             $where ORDER BY a.id DESC LIMIT $per OFFSET $off", $args);
require_once BASE_PATH . '/core/app_status.php';
$comps = all("SELECT id,name FROM competitions ORDER BY sort,name");
$pages = (int) ceil($total / $per);
$qs = fn(array $ex=[]) => a_link('applications', array_filter(array_merge($_GET, $ex, ['p'=>null]), fn($v)=>$v!==null && $v!==''));

ob_start(); ?>
<div class="section-title">
  <h2>Заявки <span class="small muted">(<?= $total ?>)</span></h2>
  <a class="btn btn--ghost" href="<?= a_link('applications', array_filter(['action'=>'export']+$_GET, fn($v)=>$v!=='')) ?>"><?= admin_icon('download') ?>Экспорт CSV</a>
</div>

<form method="get" class="filters">
  <input type="hidden" name="p" value="applications">
  <div class="field"><label>Поиск</label><input name="q" value="<?= h(input('q')) ?>" placeholder="ФИО, коллектив, номер, почта, телефон, номер программы, педагог, город, конкурс" style="min-width:260px"></div>
  <div class="field"><label>Конкурс</label><select name="competition"><option value="">Все</option>
    <?php foreach ($comps as $c): ?><option value="<?= $c['id'] ?>" <?= (int)input('competition')===(int)$c['id']?'selected':'' ?>><?= h($c['name']) ?></option><?php endforeach; ?>
  </select></div>
  <div class="field"><label>Номинация</label><select name="nomination"><option value="">Все</option>
    <?php foreach (array_keys(NOMINATIONS()) as $n): ?><option value="<?= h($n) ?>" <?= input('nomination')===$n?'selected':'' ?>><?= h($n) ?></option><?php endforeach; ?>
  </select></div>
  <div class="field"><label>Категория</label><select name="category"><option value="">Все</option>
    <?php foreach (AGE_CATEGORIES() as $cat): ?><option value="<?= h($cat) ?>" <?= input('category')===$cat?'selected':'' ?>><?= h($cat) ?></option><?php endforeach; ?>
  </select></div>
  <div class="field"><label>Статус</label><select name="status"><option value="">Любой</option>
    <?php foreach (['new','judging','graded','making','made','extra','done','rejected'] as $s): ?><option value="<?= $s ?>" <?= input('status')===$s?'selected':'' ?>><?= h(app_status_ru($s)) ?></option><?php endforeach; ?>
  </select></div>
  <div class="field"><label>С даты</label><input type="date" name="date_from" value="<?= h(input('date_from')) ?>"></div>
  <div class="field"><label>По дату</label><input type="date" name="date_to" value="<?= h(input('date_to')) ?>"></div>
  <div class="field"><label style="display:flex;align-items:center;gap:8px;cursor:pointer;white-space:nowrap">
    <input type="checkbox" name="show_unpaid" value="1" <?= input('show_unpaid')==='1'?'checked':'' ?> style="width:auto"> Ожидают оплаты</label>
    <span class="small muted">неоплаченные платные заявки</span></div>
  <button class="btn btn--primary btn--sm"><?= admin_icon('search') ?? '' ?>Поиск</button>
  <a class="btn btn--ghost btn--sm" href="<?= a_link('applications') ?>">Сброс</a>
</form>

<form method="post" action="<?= url('/admin/?p=applications') ?>">
  <?= csrf_field() ?><input type="hidden" name="do" value="bulk">
  <input type="hidden" name="competition" value="<?= h(input('competition')) ?>"><input type="hidden" name="status" value="<?= h(input('status')) ?>">
  <div class="toolbar">
    <select name="bulk_action" style="max-width:240px">
      <option value="">Массовое действие…</option>
      <option value="mark_paid">Отметить оплаченными</option>
      <option value="mark_new">Вернуть в «Новые» (снять оценку)</option>
      <option value="flag_suspicious">Отметить подозрительными</option>
      <option value="reject">Отклонить</option>
      <option value="delete">Удалить заявки</option>
    </select>
    <button class="btn btn--navy btn--sm" onclick="return confirm('Применить к выбранным заявкам?')"><?= admin_icon('check') ?>Применить</button>
  </div>

  <div class="table-wrap">
    <table class="tbl">
      <thead><tr>
        <th class="checkbox-cell"><input type="checkbox" onclick="document.querySelectorAll('.rowchk').forEach(c=>c.checked=this.checked)"></th>
        <th>От кого</th><th>Конкурсный номер</th><th>Конкурс</th><th>Статус</th><th>Сумма</th><th>Подана</th>
      </tr></thead>
      <tbody>
        <?php if (!$rows): ?><tr><td colspan="7" class="muted" style="text-align:center;padding:28px">Заявок по фильтру нет</td></tr><?php endif; ?>
        <?php foreach ($rows as $a):
          $st = app_state($a, true);
          // Сумма: бесплатный конкурс — «Бесплатно»; платный — фактически оплаченная
          // сумма (со скидками), при её отсутствии — цена конкурса как ожидаемая.
          // Единый разбор денег (core/loyalty.php) — тот же, что в карточке заявки:
          // касса, сумма на заявке и скидка. Раньше смотрели только в payments, и
          // оплаченная без чека заявка показывалась как «ожидается».
          $pvRow = app_payment_view($a);
          if ($pvRow['free'])       $sumHtml = '<span class="badge badge--muted small">Бесплатно</span>';
          elseif ($pvRow['paid'])   $sumHtml = '<b>' . ($pvRow['amount'] > 0 ? number_format($pvRow['amount'], 0, '.', ' ') . ' ₽' : 'оплачено') . '</b>'
                                             . ($pvRow['pct'] > 0 ? ' <span class="small muted">−' . (int)$pvRow['pct'] . '%</span>' : '');
          else                      $sumHtml = '<span class="small muted">' . number_format($pvRow['base'], 0, '.', ' ') . ' ₽ ожидается</span>';
        ?>
          <tr>
            <td class="checkbox-cell"><input type="checkbox" class="rowchk" name="ids[]" value="<?= $a['id'] ?>"></td>
            <td>
              <a href="<?= a_link('applications', ['id'=>$a['id']]) ?>"><b><?= h($a['is_group'] ? $a['group_name'] : $a['full_name']) ?></b></a>
              <?= vip_mark((int)($a['user_id']??0), (string)($a['user_role']??''), (string)($a['email']??'')) ?>
              <?= $a['flag'] ? ' <span class="badge badge--rejected small">'.h($a['flag']).'</span>' : '' ?>
              <br><span class="small muted"><?= h($a['number'] ?: '#'.$a['id']) ?><?= $a['is_group'] ? ' · коллектив' : '' ?></span>
            </td>
            <td class="small"><?= h($a['work_title'] ?: '—') ?>
              <?php if (!empty($a['nomination'])): ?><br><span class="muted"><?= h($a['nomination']) ?></span><?php endif; ?></td>
            <td class="small"><?= h($a['comp']) ?></td>
            <td><span class="badge badge--<?= h($st['code']) ?>"><?= h($st['label']) ?></span></td>
            <td class="small"><?= $sumHtml ?></td>
            <td class="small"><?= h(date('d.m.Y', strtotime($a['created_at']))) ?><br><span class="muted"><?= h(date('H:i', strtotime($a['created_at']))) ?></span></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</form>

<?php if ($pages > 1): ?>
<div class="toolbar" style="margin-top:16px;justify-content:center">
  <?php for ($i=1;$i<=$pages;$i++): ?>
    <a class="btn btn--sm <?= $i===$page?'btn--primary':'btn--ghost' ?>" href="<?= $qs(['pg'=>$i]) ?>"><?= $i ?></a>
  <?php endfor; ?>
</div>
<?php endif; ?>
<?php
$content = ob_get_clean();
admin_layout('Заявки', $content, 'applications');
