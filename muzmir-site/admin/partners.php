<?php
/**
 * admin/partners.php — админка Информационных партнёров.
 * Список (новые сверху) + фильтры + карточка партнёра с действиями:
 * принять / отклонить / показать пароль / сбросить пароль / переиздать
 * сертификат / очередь благодарностей (просмотреть / отправить сейчас / удалить).
 */
declare(strict_types=1);
require_once BASE_PATH . '/core/partner.php';
require_once BASE_PATH . '/core/partner_docs.php';

partner_migrate();

/* ─────────────────────── POST-действия ─────────────────────── */

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('partners'); }
    $do  = (string) input('do');
    $id  = (int) input('id');
    if ($id > 0) {
        if ($do === 'accept') {
            try {
                $r = partner_accept($id);
                // Сертификат и доступ уходят учреждению сразу же: пароль в открытом
                // виде существует только здесь. Оператору он тоже показывается —
                // на случай, если письмо придётся продиктовать по телефону.
                $sent = partner_send_welcome($id, (string) ($r['password_plain'] ?? ''));
                if (!empty($r['password_plain'])) {
                    // Один раз показываем пароль в flash
                    $_SESSION['partner_password_shown'][$id] = $r['password_plain'];
                    flash('Партнёрство принято. Номер: ' . ($r['inst']['partner_no'] ?? '')
                        . '. ' . ($sent ? 'Сертификат и доступ отправлены на почту учреждения.' : 'ПИСЬМО НЕ УШЛО — пароль показан ниже, отправьте вручную.')
                        . ' Пароль ЛК показан ниже.', $sent ? 'success' : 'error');
                } else {
                    flash('Партнёр уже был принят ранее.' . ($sent ? ' Письмо с сертификатом отправлено.' : ''), 'info');
                }
            } catch (\Throwable $e) { flash('Ошибка: ' . $e->getMessage(), 'error'); }
        } elseif ($do === 'decline') {
            partner_decline($id, (string) input('reason'));
            flash('Партнёрство отклонено.', 'info');
        } elseif ($do === 'block') {
            partner_block($id, (string) input('reason'));
            flash('Партнёр заблокирован.', 'info');
        } elseif ($do === 'unblock') {
            partner_unblock($id);
            flash('Партнёр разблокирован.', 'success');
        } elseif ($do === 'reset_pass') {
            $p = partner_reset_password($id);
            $_SESSION['partner_password_shown'][$id] = $p;
            flash('Пароль сброшен, новый пароль показан ниже.', 'success');
        } elseif ($do === 'regen_cert') {
            $pdf = partner_cert_pdf($id, true);
            flash($pdf ? 'Сертификат переиздан.' : 'Не удалось переиздать сертификат.', $pdf ? 'success' : 'error');
        } elseif ($do === 'send_thanks_now') {
            // Отправить конкретную благодарность сейчас (id в поле tid)
            $tid = (int) input('tid');
            if ($tid > 0) {
                q("UPDATE partner_thanks SET scheduled_send_at=? WHERE id=? AND status IN ('queued','generated','failed')",
                  [date('Y-m-d H:i:s'), $tid]);
                flash('Благодарность помечена к немедленной отправке (уйдёт при следующем запуске крона).', 'success');
            }
        } elseif ($do === 'delete_thanks') {
            $tid = (int) input('tid');
            if ($tid > 0) {
                q("DELETE FROM partner_thanks WHERE id=? AND status<>'sent'", [$tid]);
                flash('Благодарность из очереди удалена.', 'info');
            }
        } elseif ($do === 'edit') {
            $upd = [
                'partner_priority_days' => max(1, min(7, (int) input('priority_days', '4'))),
                'partner_promo_max'     => max(0, min(100, (int) input('promo_max', '10'))),
            ];
            try { q("UPDATE institutions SET partner_priority_days=?, partner_promo_max=? WHERE id=?",
                    [$upd['partner_priority_days'], $upd['partner_promo_max'], $id]); } catch (\Throwable $e) {}
            flash('Настройки партнёра обновлены.', 'success');
        }
    }
    admin_redirect('partners', array_filter(['id' => (int) input('id'), 'q' => (string) input('q'), 'f' => (string) input('f')]));
}

/* ─────────────────────── ДАННЫЕ ─────────────────────── */

$q = trim((string) input('q'));
$f = trim((string) input('f')); // фильтр: '' (все с статусом) | 'accepted' | 'invited' | 'declined' | 'blocked'
$id = (int) input('id');

$where = ["partner_status<>''"];
$args = [];
if ($q !== '') {
    $where[] = "(LOWER(name) LIKE ? OR LOWER(email) LIKE ? OR partner_no LIKE ? OR partner_slug LIKE ?)";
    $like = '%' . mb_strtolower($q) . '%';
    array_push($args, $like, $like, '%' . $q . '%', '%' . strtolower($q) . '%');
}
if ($f !== '') { $where[] = "partner_status=?"; $args[] = $f; }
$wsql = implode(' AND ', $where);

try {
    $partners = all("SELECT * FROM institutions WHERE $wsql
                    ORDER BY COALESCE(partner_accepted_at, created_at) DESC LIMIT 300", $args);
} catch (\Throwable $e) { $partners = []; }

$counts = [
    'invited'  => (int) (scalar("SELECT COUNT(*) FROM institutions WHERE partner_status='invited'") ?? 0),
    'accepted' => (int) (scalar("SELECT COUNT(*) FROM institutions WHERE partner_status='accepted'") ?? 0),
    'declined' => (int) (scalar("SELECT COUNT(*) FROM institutions WHERE partner_status='declined'") ?? 0),
    'blocked'  => (int) (scalar("SELECT COUNT(*) FROM institutions WHERE partner_status='blocked'") ?? 0),
];

/* ── Как идёт вербовка по каналам ──
 * Приглашение уходит двумя дорогами: письмом на официальный ящик и обращением
 * в сообщения сообщества ВКонтакте. Ссылка согласия в обоих случаях одна и та
 * же, поэтому здесь видно не «сколько писем ушло», а сколько учреждений
 * реально дошли до кнопки.
 */
$chan = ['письма' => 0, 'вк' => 0, 'вк_осталось' => 0, 'согласий' => 0, 'согласий_сегодня' => 0];
try {
    $chan['письма'] = (int) (scalar("SELECT COUNT(*) FROM institutions WHERE invited_count > 0") ?? 0);
    if (tbl_exists('vk_outreach_log')) {
        $chan['вк'] = (int) (scalar("SELECT COUNT(*) FROM vk_outreach_log WHERE outcome='sent'") ?? 0);
        $chan['вк_осталось'] = (int) (scalar(
            "SELECT COUNT(*) FROM vk_targets t
               JOIN institutions i ON i.id = t.institution_id
               LEFT JOIN vk_outreach_log l ON l.institution_id = i.id
              WHERE t.score >= 12 AND l.id IS NULL
                AND COALESCE(i.partner_status,'') NOT IN ('accepted','declined','blocked')") ?? 0);
    }
    $chan['согласий'] = (int) (scalar("SELECT COUNT(*) FROM partner_events WHERE kind='accepted'") ?? 0);
    $chan['согласий_сегодня'] = (int) (scalar("SELECT COUNT(*) FROM partner_events
        WHERE kind='accepted' AND date(created_at)=date('now','localtime')") ?? 0);
} catch (\Throwable $e) { /* сводка не критична */ }

$current = null;
if ($id > 0) {
    $current = one("SELECT * FROM institutions WHERE id=?", [$id]);
    if ($current) {
        partner_refresh_counts($id);
        $current = one("SELECT * FROM institutions WHERE id=?", [$id]);
    }
}

/* ─────────────────────── ВЁРСТКА ─────────────────────── */

ob_start(); ?>
<div class="section-title"><h2>Партнёры <span class="small muted">(принято: <?= $counts['accepted'] ?>, приглашено: <?= $counts['invited'] ?>, отказ: <?= $counts['declined'] ?>, блок: <?= $counts['blocked'] ?>)</span></h2></div>
<p class="small muted" style="margin:-6px 0 14px">
  Учреждения-Информационные партнёры. Приглашение идёт двумя каналами: письмом на официальный ящик и обращением в сообщения сообщества ВКонтакте. В обоих стоит одна и та же именная ссылка согласия, поэтому учреждение принимает партнёрство само, одним нажатием, без ответного письма и без действий оператора. Кнопка «Принять» в карточке нужна для ручных случаев (согласие пришло по телефону или письмом).
</p>

<?php
/* СРАВНЕНИЕ ДВУХ ПИСЕМ.
   Официальное обращение на бланке за двадцать тысяч отправок дало ноль
   партнёров. Половина учреждений теперь получает короткое письмо, где ответить
   нужно одним словом. Здесь видно, что из этого выходит: спорить о письмах
   бессмысленно, считать — нет. */
$ab = [];
if (is_file(BASE_PATH . '/core/partner_ab.php')) {
    require_once BASE_PATH . '/core/partner_ab.php';
    if (function_exists('pab_stats')) { try { $ab = pab_stats(); } catch (\Throwable $e) { $ab = []; } }
}
$abTotal = (int) (($ab['a']['n'] ?? 0) + ($ab['b']['n'] ?? 0));
?>
<?php if ($abTotal > 0): ?>
<div class="card" style="margin:0 0 16px;padding:14px 16px">
  <div class="small muted" style="text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">
    Сравнение писем · А — официальное обращение, Б — короткое с ответом словом
  </div>
  <div class="table-wrap"><table class="tbl">
    <thead><tr><th>Письмо</th><th>Учреждений</th><th>Отправлено</th><th>Доставлено</th><th>Открыли</th><th>Зашли на согласие</th><th>Ответили</th><th>Стали партнёром</th></tr></thead>
    <tbody>
      <?php foreach (['a' => 'А — официальное', 'b' => 'Б — короткое'] as $k => $label): $r = $ab[$k] ?? []; ?>
        <tr>
          <td><b><?= h($label) ?></b></td>
          <td><?= (int) ($r['n'] ?? 0) ?></td>
          <td><?= (int) ($r['sent'] ?? 0) ?></td>
          <td><?= (int) ($r['delivered'] ?? 0) ?></td>
          <td><?= (int) ($r['opened'] ?? 0) ?></td>
          <td><?= (int) ($r['visited'] ?? 0) ?></td>
          <td><?= (int) ($r['replied'] ?? 0) ?></td>
          <td><b style="color:<?= (int) ($r['partners'] ?? 0) > 0 ? '#1E7A46' : '#8892B0' ?>"><?= (int) ($r['partners'] ?? 0) ?></b></td>
        </tr>
      <?php endforeach; ?>
    </tbody>
  </table></div>
  <p class="small muted" style="margin:10px 0 0">
    Вариант закреплён за учреждением навсегда: повторное письмо приходит тем же, иначе сравнивать было бы нечего.
    Судить стоит по последнему столбцу, а не по открытиям: открывают оба, решает — ответ.
  </p>
</div>
<?php endif; ?>

<div class="card" style="margin:0 0 16px;padding:14px 16px">
  <div style="display:flex;flex-wrap:wrap;gap:18px;align-items:baseline">
    <div><span class="small muted">приглашено письмами</span><br><b style="font-size:1.15rem"><?= number_format($chan['письма'], 0, '.', ' ') ?></b></div>
    <div><span class="small muted">обращений ВКонтакте</span><br><b style="font-size:1.15rem"><?= number_format($chan['вк'], 0, '.', ' ') ?></b></div>
    <div><span class="small muted">в очереди ВКонтакте</span><br><b style="font-size:1.15rem"><?= number_format($chan['вк_осталось'], 0, '.', ' ') ?></b></div>
    <div><span class="small muted">согласий всего</span><br><b style="font-size:1.15rem"><?= number_format($chan['согласий'], 0, '.', ' ') ?></b></div>
    <div><span class="small muted">согласий сегодня</span><br><b style="font-size:1.15rem"><?= number_format($chan['согласий_сегодня'], 0, '.', ' ') ?></b></div>
  </div>
</div>

<form method="get" class="filters">
  <input type="hidden" name="p" value="partners">
  <div class="field"><label>Поиск</label><input name="q" value="<?= h($q) ?>" placeholder="название, email, номер ИП, slug" style="min-width:280px"></div>
  <div class="field"><label>Статус</label><select name="f" onchange="this.form.submit()">
    <option value="" <?= $f===''?'selected':'' ?>>Все</option>
    <option value="accepted" <?= $f==='accepted'?'selected':'' ?>>Активные (<?= $counts['accepted'] ?>)</option>
    <option value="invited"  <?= $f==='invited'?'selected':'' ?>>Приглашены (<?= $counts['invited'] ?>)</option>
    <option value="declined" <?= $f==='declined'?'selected':'' ?>>Отказ (<?= $counts['declined'] ?>)</option>
    <option value="blocked"  <?= $f==='blocked'?'selected':'' ?>>Заблокированы (<?= $counts['blocked'] ?>)</option>
  </select></div>
  <button class="btn btn--primary btn--sm">Искать</button>
  <?php if ($q !== '' || $f !== ''): ?><a class="btn btn--ghost btn--sm" href="<?= a_link('partners') ?>">Сброс</a><?php endif; ?>
</form>

<?php if ($current): ?>
  <div class="card" style="margin-bottom:18px;border-left:4px solid #C79322">
    <div class="section-title" style="margin-bottom:6px">
      <h3><?= h((string)$current['name']) ?> <span class="small muted">· <?= h((string)$current['region']) ?></span></h3>
      <a href="<?= a_link('partners', array_filter(['q'=>$q,'f'=>$f])) ?>" class="btn btn--ghost btn--sm">К списку</a>
    </div>

    <?php
      $st = (string) ($current['partner_status'] ?? '');
      $pwShown = $_SESSION['partner_password_shown'][$id] ?? '';
      unset($_SESSION['partner_password_shown'][$id]);
    ?>

    <table class="tbl" style="margin-top:12px">
      <tr><td class="muted" style="width:200px">Статус</td><td>
        <span class="badge badge--<?= $st === 'accepted' ? 'gold' : ($st === 'blocked' ? 'rejected' : 'muted') ?>"><?= h($st ?: '—') ?></span>
      </td></tr>
      <?php if ($st === 'accepted'): ?>
        <tr><td class="muted">Номер партнёрства</td><td><b><?= h((string)$current['partner_no']) ?></b></td></tr>
        <tr><td class="muted">Персональная ссылка</td><td><code><?= h(rtrim((string)cfgv('base_url',''),'/').'/p/'.(string)$current['partner_slug']) ?></code></td></tr>
        <tr><td class="muted">Промокод</td><td><code><?= h((string)$current['partner_promo_code']) ?></code>
          <span class="small muted">использований: <?= (int)$current['partner_promo_uses'] ?>/<?= (int)$current['partner_promo_max'] ?></span></td></tr>
        <tr><td class="muted">Заявок от учреждения</td><td><b><?= (int)$current['partner_apps_count'] ?></b> · оплачено <b><?= (int)$current['partner_apps_paid'] ?></b></td></tr>
        <tr><td class="muted">Партнёр с</td><td><?= h(date('d.m.Y', strtotime((string)$current['partner_accepted_at']))) ?></td></tr>
        <tr><td class="muted">Приоритет аттестации</td><td><?= (int)$current['partner_priority_days'] ?> рабочих дня</td></tr>
        <tr><td class="muted">Последний вход в ЛК</td><td><?= h($current['partner_last_login'] ? date('d.m.Y H:i', strtotime((string)$current['partner_last_login'])) : '—') ?></td></tr>
      <?php endif; ?>
      <tr><td class="muted">Email</td><td><b><?= h((string)$current['email']) ?></b></td></tr>
      <?php if (!empty($current['director'])): ?>
        <tr><td class="muted">Директор (из реестра)</td><td><?= h((string)$current['director']) ?> <span class="small muted">(может быть устаревшим)</span></td></tr>
      <?php endif; ?>
    </table>

    <?php if ($pwShown !== ''): ?>
      <div class="alert alert--success" style="margin:14px 0">
        <b>Пароль ЛК партнёра (показан ОДИН раз):</b>
        <code style="font-size:16px;padding:4px 10px"><?= h($pwShown) ?></code>
        <br><span class="small">Скопируйте и передайте в приветственном письме — повторно этот пароль не показывается. Если потеряете — нажмите «Сбросить пароль».</span>
      </div>
    <?php endif; ?>

    <div class="toolbar" style="gap:8px;flex-wrap:wrap;margin-top:16px">
      <?php if ($st === 'accepted'): ?>
        <a class="btn btn--navy btn--sm" href="<?= rtrim((string)cfgv('base_url',''),'/') ?>/partner/cert.pdf?id=<?= $id ?>" target="_blank">Скачать сертификат</a>
        <form method="post" style="display:inline"><?= csrf_field() ?><input type="hidden" name="do" value="regen_cert"><input type="hidden" name="id" value="<?= $id ?>"><button class="btn btn--ghost btn--sm">Переиздать сертификат</button></form>
        <form method="post" style="display:inline" onsubmit="return confirm('Сбросить пароль ЛК партнёра? Старый перестанет работать.')"><?= csrf_field() ?><input type="hidden" name="do" value="reset_pass"><input type="hidden" name="id" value="<?= $id ?>"><button class="btn btn--ghost btn--sm">Сбросить пароль</button></form>
        <form method="post" style="display:inline" onsubmit="return confirm('Заблокировать партнёра?')"><?= csrf_field() ?><input type="hidden" name="do" value="block"><input type="hidden" name="id" value="<?= $id ?>"><button class="btn btn--ghost btn--sm">Заблокировать</button></form>
      <?php elseif ($st === 'blocked'): ?>
        <form method="post" style="display:inline"><?= csrf_field() ?><input type="hidden" name="do" value="unblock"><input type="hidden" name="id" value="<?= $id ?>"><button class="btn btn--primary btn--sm">Разблокировать</button></form>
      <?php else: ?>
        <form method="post" style="display:inline" onsubmit="return confirm('Принять учреждение в партнёры? Сгенерируются номер, промокод, пароль ЛК; сертификат зарегистрируется в реестре.')"><?= csrf_field() ?><input type="hidden" name="do" value="accept"><input type="hidden" name="id" value="<?= $id ?>"><button class="btn btn--primary btn--sm">Принять партнёрство</button></form>
        <form method="post" style="display:inline"><?= csrf_field() ?><input type="hidden" name="do" value="decline"><input type="hidden" name="id" value="<?= $id ?>"><button class="btn btn--ghost btn--sm">Отклонить</button></form>
      <?php endif; ?>
    </div>

    <?php if ($st === 'accepted'): ?>
      <div class="section-title" style="margin:22px 0 8px"><h4>Настройки партнёра</h4></div>
      <form method="post" class="filters">
        <?= csrf_field() ?><input type="hidden" name="do" value="edit"><input type="hidden" name="id" value="<?= $id ?>">
        <div class="field"><label>Приоритет аттестации (дней)</label><input type="number" min="1" max="7" name="priority_days" value="<?= (int)$current['partner_priority_days'] ?>" style="width:80px"></div>
        <div class="field"><label>Лимит использований промокода</label><input type="number" min="0" max="100" name="promo_max" value="<?= (int)$current['partner_promo_max'] ?>" style="width:80px"></div>
        <button class="btn btn--primary btn--sm">Сохранить</button>
      </form>

      <div class="section-title" style="margin:22px 0 8px"><h4>Очередь благодарностей</h4></div>
      <?php
        try {
          $th = all("SELECT * FROM partner_thanks WHERE institution_id=? ORDER BY id DESC", [$id]);
        } catch (\Throwable $e) { $th = []; }
      ?>
      <?php if (!$th): ?>
        <p class="small muted">Партнёр ещё не заказывал благодарности.</p>
      <?php else: ?>
        <div class="table-wrap"><table class="tbl">
          <thead><tr><th>№ документа</th><th>Кому</th><th>Роль</th><th>Статус</th><th>План. отправка</th><th>Отправлено</th><th>Действия</th></tr></thead>
          <tbody>
          <?php foreach ($th as $t): ?>
            <tr>
              <td><code><?= h((string)$t['doc_number']) ?></code></td>
              <td><?= h((string)$t['fio']) ?></td>
              <td><?= $t['role']==='manager' ? 'руководство' : 'педагог' ?></td>
              <td><span class="badge badge--<?= h((string)$t['status']) ?>"><?= h((string)$t['status']) ?></span></td>
              <td class="small muted"><?= h($t['scheduled_send_at'] ? date('d.m.y H:i', strtotime((string)$t['scheduled_send_at'])) : '—') ?></td>
              <td class="small muted"><?= h($t['sent_at'] ? date('d.m.y H:i', strtotime((string)$t['sent_at'])) : '—') ?></td>
              <td>
                <?php if (!empty($t['doc_path']) && is_file((string)$t['doc_path'])): ?>
                  <a class="btn btn--ghost btn--sm" href="<?= rtrim((string)cfgv('base_url',''),'/') ?>/diplomas/<?= h(basename((string)$t['doc_path'])) ?>" target="_blank">PDF</a>
                <?php endif; ?>
                <?php if ((string)$t['status'] !== 'sent'): ?>
                  <form method="post" style="display:inline"><?= csrf_field() ?><input type="hidden" name="do" value="send_thanks_now"><input type="hidden" name="id" value="<?= $id ?>"><input type="hidden" name="tid" value="<?= (int)$t['id'] ?>"><button class="btn btn--primary btn--sm">Отправить</button></form>
                  <form method="post" style="display:inline" onsubmit="return confirm('Удалить из очереди?')"><?= csrf_field() ?><input type="hidden" name="do" value="delete_thanks"><input type="hidden" name="id" value="<?= $id ?>"><input type="hidden" name="tid" value="<?= (int)$t['id'] ?>"><button class="btn btn--ghost btn--sm">Удалить</button></form>
                <?php endif; ?>
              </td>
            </tr>
          <?php endforeach; ?>
          </tbody>
        </table></div>
      <?php endif; ?>
    <?php endif; ?>
  </div>
<?php endif; ?>

<div class="table-wrap">
  <table class="tbl">
    <thead><tr><th>Учреждение</th><th>Регион</th><th>Статус</th><th>Номер ИП</th><th>Заявок</th><th>Промокод</th><th>Принят</th><th></th></tr></thead>
    <tbody>
      <?php if (!$partners): ?><tr><td colspan="8" class="muted" style="text-align:center;padding:28px">Ничего не найдено</td></tr><?php endif; ?>
      <?php foreach ($partners as $r): ?>
        <?php $st = (string) ($r['partner_status'] ?? ''); ?>
        <tr>
          <td>
            <b><?= h((string)$r['name']) ?></b>
            <?php if ($st === 'accepted'): ?><span class="badge badge--gold" style="margin-left:6px" title="Информационный партнёр">🔴</span><?php endif; ?>
            <div class="small muted"><?= h((string)$r['email']) ?></div>
          </td>
          <td class="small"><?= h((string)$r['region']) ?></td>
          <td><span class="badge badge--<?= $st === 'accepted' ? 'gold' : ($st === 'blocked' ? 'rejected' : 'muted') ?>"><?= h($st) ?></span></td>
          <td class="small"><?= h((string)($r['partner_no'] ?? '—')) ?></td>
          <td class="small"><b><?= (int)$r['partner_apps_count'] ?></b>/<?= (int)$r['partner_apps_paid'] ?></td>
          <td class="small"><code><?= h((string)($r['partner_promo_code'] ?? '')) ?></code></td>
          <td class="small muted"><?= h($r['partner_accepted_at'] ? date('d.m.y', strtotime((string)$r['partner_accepted_at'])) : '—') ?></td>
          <td><a class="btn btn--navy btn--sm" href="<?= a_link('partners', ['id'=>(int)$r['id'],'q'=>$q,'f'=>$f]) ?>">Открыть</a></td>
        </tr>
      <?php endforeach; ?>
    </tbody>
  </table>
</div>

<?php
$content = ob_get_clean();
admin_layout('Партнёры', $content, 'partners');
