<?php
/**
 * admin/ls_access.php — ВХОД В ЛС: КАБИНЕТ УЧАСТНИКА С ЕГО СОГЛАСИЯ.
 *
 * Порядок (слово владельца от 22.10.2026):
 *   1. Вводится почта участника — показываем, кто это, чтобы не ошибиться.
 *   2. «Отправить запрос» — у участника в открытом кабинете появляется окно
 *      «Согласен / Отказать». Писем и сообщений нет: человек сидит в кабинете.
 *   3. Согласие — кнопка «Войти в кабинет», доступ на LS_GRANT_MIN минут.
 * Всё устройство и ограничения — в core/ls_access.php.
 */
declare(strict_types=1);
require_once BASE_PATH . '/core/ls_access.php';
ls_boot();
ls_expire();

$me = current_user();
$meId = (int) $me['id'];

/* ─────────── Состояние запроса для страницы ожидания ─────────── */
if (input('ajax') === 'state') {
    $r = ls_row((int) input('id'));
    if (!$r || (int) $r['admin_id'] !== $meId) json_out(['ok' => false], 404);
    json_out([
        'ok'     => true,
        'status' => (string) $r['status'],
        'left'   => (string) $r['status'] === 'pending' ? max(0, (int) strtotime((string) $r['pending_until']) - time())
                  : ((string) $r['status'] === 'granted' ? max(0, (int) strtotime((string) $r['granted_until']) - time()) : 0),
        'until'  => substr((string) $r['granted_until'], 11, 5),
    ]);
}

/* ─────────── Действия ─────────── */
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    if (!csrf_check()) { flash('Сессия устарела, обновите страницу.', 'error'); admin_redirect('ls_access'); }
    $do = input('do');
    if ($do === 'request') {
        $uidT = (int) input('user_id');
        $t = one("SELECT id, role, COALESCE(blocked,0) b FROM users WHERE id=?", [$uidT]);
        if (!$t || (int) $t['b'] === 1) { flash('Участник не найден или заблокирован.', 'error'); admin_redirect('ls_access'); }
        if ($uidT === $meId) { flash('Это Ваш собственный аккаунт.', 'warning'); admin_redirect('ls_access'); }
        if ((ROLE_RANK[(string) $t['role']] ?? 0) >= ROLE_RANK['jury']) {
            flash('В кабинеты сотрудников центра этот раздел не входит.', 'warning'); admin_redirect('ls_access');
        }
        $id = ls_request($meId, $uidT);
        audit('ls_request', 'user', $uidT, ['ls_id' => $id]);
        admin_redirect('ls_access', ['id' => $id]);
    }
    if ($do === 'enter') {
        $id = (int) input('id');
        if (!ls_enter($id, $meId)) { flash('Доступ уже закрыт или истёк. Отправьте запрос заново.', 'error'); admin_redirect('ls_access', ['id' => $id]); }
        $r = ls_row($id);
        audit('ls_enter', 'user', (int) $r['user_id'], ['ls_id' => $id]);
        redirect('/cabinet');
    }
    if ($do === 'cancel') {
        $id = (int) input('id');
        $r = ls_row($id);
        if ($r && (int) $r['admin_id'] === $meId) { ls_close($id, 'admin'); audit('ls_cancel', 'user', (int) $r['user_id'], ['ls_id' => $id]); }
        admin_redirect('ls_access');
    }
}

/* ─────────── Данные страницы ─────────── */
$q = mb_strtolower(trim((string) input('q')));
$found = null; $foundStat = [];
if ($q !== '') {
    $found = one("SELECT * FROM users WHERE lower(trim(email))=?", [$q]);
    if ($found) {
        $fid = (int) $found['id'];
        $foundStat = [
            'apps'   => (int) scalar("SELECT COUNT(*) FROM applications WHERE user_id=?", [$fid]),
            'orders' => (int) scalar("SELECT COUNT(*) FROM awards_orders WHERE user_id=? AND status<>'canceled'", [$fid]),
        ];
    }
}
$cur = (int) input('id') > 0 ? ls_row((int) input('id')) : null;
if ($cur && (int) $cur['admin_id'] !== $meId) $cur = null;
$curUser = $cur ? one("SELECT id, email, full_name FROM users WHERE id=?", [(int) $cur['user_id']]) : null;
$done = (int) input('done') > 0 ? ls_row((int) input('done')) : null;

$hist = all("SELECT l.*, u.email, u.full_name, a.full_name AS admin_name
               FROM ls_access l
               LEFT JOIN users u ON u.id=l.user_id
               LEFT JOIN users a ON a.id=l.admin_id
           ORDER BY l.id DESC LIMIT 40");

$stRu = ['pending' => ['Ждёт ответа', 'badge--muted'], 'granted' => ['Доступ открыт', 'badge--paid'],
         'denied' => ['Отказ участника', 'badge--muted'], 'expired' => ['Не ответил', 'badge--muted'],
         'closed' => ['Закрыт', 'badge--muted']];
$byRu = ['user' => 'участником', 'admin' => 'администратором', 'timeout' => 'по времени'];

ob_start(); ?>
<div class="page-head">
  <h1>ВХОД В ЛС</h1>
  <p class="muted small">Вход в личный кабинет участника, чтобы оформить за него заявку или заказ, когда он
    не справляется сам. Только с согласия: участник должен быть в своём кабинете прямо сейчас — у него
    появится окно «Согласен / Отказать». Писем ему не уходит. Доступ — на <?= (int) LS_GRANT_MIN ?> минут.
    Оплату, почту, пароль, профиль и клуб участник меняет только сам: созданный заказ ждёт его оплаты в кабинете.</p>
</div>

<?php if ($done): ?>
  <div class="card" style="margin-bottom:16px">
    <b>Вы вышли из кабинета участника.</b> Доступ закрыт.
    <?php $dl = json_decode((string) $done['log'], true) ?: []; if ($dl): ?>
      <ul class="small" style="margin:8px 0 0 18px"><?php foreach ($dl as $e): ?><li><?= h((string) $e['t']) ?> · <?= h((string) $e['a']) ?></li><?php endforeach; ?></ul>
    <?php endif; ?>
  </div>
<?php endif; ?>

<?php if ($cur && $curUser): ?>
  <div class="card" id="lsState" data-id="<?= (int) $cur['id'] ?>" data-status="<?= h((string) $cur['status']) ?>" style="margin-bottom:16px">
    <p style="margin:0 0 8px">Участник: <b><?= h((string) ($curUser['full_name'] ?: '—')) ?></b> · <?= h((string) $curUser['email']) ?></p>
    <div data-st="pending" hidden>
      <p style="margin:0 0 10px"><b>Запрос отправлен.</b> Ждём ответа участника — у него в кабинете окно «Согласен / Отказать».
        Запрос погаснет через <b data-left></b>. Если участник не видит окна — пусть откроет или обновит свой личный кабинет.</p>
      <form method="post" style="display:inline"><?= csrf_field() ?><input type="hidden" name="do" value="cancel"><input type="hidden" name="id" value="<?= (int) $cur['id'] ?>">
        <button class="btn btn--ghost btn--sm">Отменить запрос</button></form>
    </div>
    <div data-st="granted" hidden>
      <p style="margin:0 0 10px"><b style="color:#2E7D32">Участник согласился.</b> Доступ открыт до <b data-until></b>.</p>
      <form method="post" style="display:inline"><?= csrf_field() ?><input type="hidden" name="do" value="enter"><input type="hidden" name="id" value="<?= (int) $cur['id'] ?>">
        <button class="btn btn--primary">Войти в кабинет участника</button></form>
      <form method="post" style="display:inline;margin-left:6px"><?= csrf_field() ?><input type="hidden" name="do" value="cancel"><input type="hidden" name="id" value="<?= (int) $cur['id'] ?>">
        <button class="btn btn--ghost btn--sm">Закрыть доступ</button></form>
    </div>
    <div data-st="denied" hidden><p style="margin:0"><b>Участник отказал.</b> Войти в кабинет нельзя.</p></div>
    <div data-st="expired" hidden><p style="margin:0"><b>Участник не ответил</b> за <?= (int) LS_PENDING_MIN ?> минут. Можно отправить запрос ещё раз, когда он будет в кабинете.</p></div>
    <div data-st="closed" hidden><p style="margin:0"><b>Доступ закрыт.</b></p></div>
  </div>
  <script>
  (function(){
    var box=document.getElementById('lsState'), id=box.getAttribute('data-id');
    function show(st,left,until){
      box.querySelectorAll('[data-st]').forEach(function(x){x.hidden=x.getAttribute('data-st')!==st;});
      var l=box.querySelector('[data-left]'); if(l){var m=Math.floor(left/60),s=left%60;l.textContent=m+' мин '+(s<10?'0':'')+s+' с';}
      var u=box.querySelector('[data-until]'); if(u&&until) u.textContent=until;
    }
    show(box.getAttribute('data-status'),0,'');
    function poll(){
      fetch('?p=ls_access&ajax=state&id='+id,{credentials:'same-origin'}).then(function(r){return r.json();}).then(function(d){
        if(!d||!d.ok) return; show(d.status,d.left,d.until);
        if(d.status==='pending'||d.status==='granted') setTimeout(poll, d.status==='pending'?2000:10000);
      }).catch(function(){setTimeout(poll,4000);});
    }
    poll();
  })();
  </script>
<?php endif; ?>

<div class="card" style="margin-bottom:16px">
  <form method="get" class="filters" style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
    <input type="hidden" name="p" value="ls_access">
    <div class="field" style="flex:1 1 260px"><label>Почта участника</label>
      <input name="q" type="email" value="<?= h($q) ?>" placeholder="name@mail.ru" required></div>
    <button class="btn btn--primary btn--sm">Найти</button>
  </form>
  <?php if ($q !== '' && !$found): ?>
    <p class="small" style="margin:12px 0 0;color:#C0392B">Аккаунта с такой почтой на сайте нет.</p>
  <?php elseif ($found): ?>
    <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line)">
      <p style="margin:0 0 4px"><b><?= h((string) ($found['full_name'] ?: 'Без имени')) ?></b> · <?= h((string) $found['email']) ?> · <?= h(role_ru((string) $found['role'])) ?></p>
      <p class="small muted" style="margin:0 0 10px">Заявок: <?= (int) $foundStat['apps'] ?> · заказов: <?= (int) $foundStat['orders'] ?>
        · последний вход: <?= h(($found['last_login'] ?? '') !== '' ? ru_datetime((string) $found['last_login']) : 'не входил') ?>
        <?= (int) ($found['blocked'] ?? 0) === 1 ? ' · <b style="color:#C0392B">заблокирован</b>' : '' ?></p>
      <?php if ((int) ($found['blocked'] ?? 0) !== 1): ?>
      <form method="post"><?= csrf_field() ?><input type="hidden" name="do" value="request"><input type="hidden" name="user_id" value="<?= (int) $found['id'] ?>">
        <button class="btn btn--primary btn--sm">Отправить запрос на разрешение входа в личный кабинет</button></form>
      <?php endif; ?>
    </div>
  <?php endif; ?>
</div>

<h2 style="font-size:16px;margin:18px 0 8px">Журнал</h2>
<div class="table-wrap">
<table class="table">
  <thead><tr><th>Когда</th><th>Участник</th><th>Администратор</th><th>Итог</th><th>Что сделано</th></tr></thead>
  <tbody>
  <?php if (!$hist): ?><tr><td colspan="5" class="muted">Запросов ещё не было.</td></tr><?php endif; ?>
  <?php foreach ($hist as $r): [$sl, $sc] = $stRu[(string) $r['status']] ?? [(string) $r['status'], 'badge--muted'];
        $lg = json_decode((string) $r['log'], true) ?: []; ?>
    <tr>
      <td class="small"><?= h(ru_datetime((string) $r['created_at'])) ?></td>
      <td class="small"><?= h((string) ($r['full_name'] ?: '—')) ?><br><span class="muted"><?= h((string) $r['email']) ?></span></td>
      <td class="small"><?= h((string) ($r['admin_name'] ?: '—')) ?></td>
      <td class="small"><span class="badge <?= h($sc) ?>"><?= h($sl) ?></span>
        <?php if ((string) $r['answered_at'] !== '' && (string) $r['status'] !== 'denied'): ?><br><span class="muted">согласие <?= h(substr((string) $r['answered_at'], 11, 5)) ?>, IP <?= h((string) $r['consent_ip']) ?></span><?php endif; ?>
        <?php if ((string) $r['closed_by'] !== '' && (string) $r['status'] === 'closed'): ?><br><span class="muted">закрыт <?= h($byRu[(string) $r['closed_by']] ?? '') ?></span><?php endif; ?></td>
      <td class="small"><?php if ($lg): ?><?php foreach ($lg as $e): ?><?= h((string) $e['t']) ?> · <?= h((string) $e['a']) ?><br><?php endforeach; ?><?php else: ?><span class="muted">—</span><?php endif; ?></td>
    </tr>
  <?php endforeach; ?>
  </tbody>
</table>
</div>
<?php
admin_layout('ВХОД В ЛС', ob_get_clean(), 'ls_access');
