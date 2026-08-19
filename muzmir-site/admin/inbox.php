<?php
/**
 * admin/inbox.php — ВХОДЯЩИЕ ПИСЬМА ЦЕНТРА В ОДНОМ МЕСТЕ.
 *
 * До этого раздела ответ человека можно было увидеть, только зайдя в почтовый
 * ящик, а ящиков четыре и в них никто не заходил. Здесь всё, что пришло на
 * news@, novosti@, kc@ и nagradi@, лежит одной лентой: видно, кто написал,
 * узнали ли мы его, о чём письмо и что с ним сделали.
 *
 * Служебный мусор (роботы почтовых служб, отчёты о недоставке) и автоответчики
 * по умолчанию скрыты: их десятки, и они забивают то немногое, ради чего сюда
 * заходят. Показать их можно фильтром.
 */
declare(strict_types=1);
require_once BASE_PATH . '/core/inbox_reader.php';
inbox_migrate();

/* ─────────────────────── Действия оператора ─────────────────────── */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('inbox'); }
    $do = (string) input('do');
    $id = (int) input('id');
    if ($id > 0 && in_array($do, ['human', 'skip', 'reopen'], true)) {
        $val = $do === 'reopen' ? '' : $do;
        try {
            q("UPDATE inbox_messages SET handled_by=? WHERE id=?", [$val, $id]);
            flash($do === 'reopen' ? 'Письмо возвращено в работу.' : 'Отмечено.', 'success');
        } catch (\Throwable $e) { flash('Не получилось: ' . $e->getMessage(), 'error'); }
    }
    admin_redirect('inbox', array_filter(['box' => input('box'), 'kind' => input('kind'), 'all' => input('all')]));
}

/* ─────────────────────── Выборка ─────────────────────── */
$box   = trim((string) input('box'));
$kind  = trim((string) input('kind'));
$showAll = input('all') === '1';
$q     = trim((string) input('q'));

$w = ['1=1']; $args = [];
if (!$showAll) { $w[] = "kind NOT IN ('service','bounce','auto') AND is_auto=0"; }
if ($box !== '')  { $w[] = 'mailbox = ?'; $args[] = $box; }
if ($kind !== '') { $w[] = 'kind = ?';    $args[] = $kind; }
if ($q !== '') {
    $w[] = '(from_email LIKE ? OR subject LIKE ? OR body_text LIKE ?)';
    array_push($args, "%$q%", "%$q%", "%$q%");
}
$rows = all("SELECT * FROM inbox_messages WHERE " . implode(' AND ', $w)
          . " ORDER BY received_at DESC, id DESC LIMIT 300", $args);

$stat = [];
foreach (all("SELECT mailbox, COUNT(*) n,
                     SUM(CASE WHEN handled_by='' AND is_auto=0 AND kind NOT IN ('service','bounce','auto') THEN 1 ELSE 0 END) wait
                FROM inbox_messages GROUP BY mailbox") as $r) {
    $stat[(string) $r['mailbox']] = ['n' => (int) $r['n'], 'wait' => (int) $r['wait']];
}
$waitTotal = array_sum(array_column($stat, 'wait'));

$kindRu = [
    'partner_accept'    => 'согласие на партнёрство',
    'partner_decline'   => 'отказ учреждения',
    'ministry_approve'  => 'поддержка ведомства',
    'ministry_decline'  => 'отказ ведомства',
    'ministry_question' => 'вопрос ведомства',
    'question'          => 'вопрос',
    'auto'              => 'автоответчик',
    'service'           => 'служебное',
    'bounce'            => 'не доставлено',
];
$handledRu = [
    '' => 'ждёт разбора', 'bot' => 'ответил помощник', 'auto_accept' => 'принят партнёром',
    'auto_decline' => 'удалён из базы', 'dedup' => 'повтор', 'human' => 'взял оператор', 'skip' => 'без ответа',
];
$boxRu = ['news' => 'news@ своя база', 'novosti' => 'novosti@ учреждения',
          'kc' => 'kc@ ведомства', 'nagradi' => 'nagradi@ награды'];

ob_start(); ?>
<div class="page-head">
  <h1>Входящие письма</h1>
  <p class="muted small">Всё, что пришло на четыре ящика центра, включая папку «Спам».
    Ждут разбора: <b><?= $waitTotal ?></b>. Служебные письма и автоответчики скрыты,
    показать их можно фильтром.</p>
</div>

<div class="cards" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
  <?php foreach ($boxRu as $k => $label): $s = $stat[$k] ?? ['n' => 0, 'wait' => 0]; ?>
    <a class="card" style="padding:12px 16px;min-width:170px;text-decoration:none"
       href="<?= a_link('inbox', array_filter(['box' => $k, 'all' => $showAll ? '1' : ''])) ?>">
      <div class="small muted"><?= h($label) ?></div>
      <div style="font-size:1.4rem;font-weight:800"><?= (int) $s['n'] ?></div>
      <?php if ($s['wait'] > 0): ?><div class="small" style="color:#B98A2E">ждут разбора: <?= (int) $s['wait'] ?></div><?php endif; ?>
    </a>
  <?php endforeach; ?>
</div>

<form method="get" class="filters">
  <input type="hidden" name="p" value="inbox">
  <div class="field"><label>Ящик</label>
    <select name="box" onchange="this.form.submit()">
      <option value="">Все</option>
      <?php foreach ($boxRu as $k => $label): ?>
        <option value="<?= h($k) ?>" <?= $box === $k ? 'selected' : '' ?>><?= h($label) ?></option>
      <?php endforeach; ?>
    </select></div>
  <div class="field"><label>О чём</label>
    <select name="kind" onchange="this.form.submit()">
      <option value="">Любое</option>
      <?php foreach ($kindRu as $k => $label): ?>
        <option value="<?= h($k) ?>" <?= $kind === $k ? 'selected' : '' ?>><?= h($label) ?></option>
      <?php endforeach; ?>
    </select></div>
  <div class="field"><label>Поиск</label><input name="q" value="<?= h($q) ?>" placeholder="адрес, тема, текст"></div>
  <div class="field"><label>Служебные</label>
    <select name="all" onchange="this.form.submit()">
      <option value="">скрыть</option>
      <option value="1" <?= $showAll ? 'selected' : '' ?>>показать</option>
    </select></div>
  <button class="btn btn--primary btn--sm">Показать</button>
</form>

<div class="table-wrap">
  <table class="tbl">
    <thead><tr>
      <th>Когда</th><th>Ящик</th><th>От кого</th><th>Письмо</th><th>О чём</th><th>Состояние</th><th></th>
    </tr></thead>
    <tbody>
    <?php if (!$rows): ?>
      <tr><td colspan="7" class="muted" style="text-align:center;padding:28px">Писем нет</td></tr>
    <?php endif; ?>
    <?php foreach ($rows as $r):
      $who = '';
      if ((int) $r['ministry_id'] > 0) $who = 'ведомство';
      elseif ((int) $r['inst_id'] > 0) $who = 'учреждение';
      elseif ((int) $r['user_id'] > 0) $who = 'участник';
      ?>
      <tr>
        <td class="small" style="white-space:nowrap"><?= h(date('d.m H:i', strtotime((string) $r['received_at']))) ?>
          <?php /* Кроме входящих читаем только спам, а зовётся он у каждой службы
                   по-своему (у Gmail это [Gmail]/&BCEEPwQwBDw-), поэтому метку
                   ставим по «не INBOX», а не по одному имени. */ ?>
          <?php if ((string) $r['folder'] !== '' && (string) $r['folder'] !== 'INBOX'): ?><div class="small" style="color:#b34">из спама</div><?php endif; ?></td>
        <td class="small"><?= h((string) $r['mailbox']) ?></td>
        <td class="small"><b><?= h(mb_substr((string) $r['from_email'], 0, 38)) ?></b>
          <?php if ($who !== ''): ?><div class="small muted"><?= h($who) ?></div><?php endif; ?></td>
        <td class="small" style="max-width:420px">
          <b><?= h(mb_substr((string) $r['subject'], 0, 70) ?: '(без темы)') ?></b>
          <div class="muted"><?= h(mb_substr((string) $r['body_text'], 0, 150)) ?></div>
          <?php if (trim((string) $r['reply_text']) !== ''): ?>
            <div class="small" style="color:#1E7A46;margin-top:4px">Ответ: <?= h(mb_substr((string) $r['reply_text'], 0, 150)) ?></div>
          <?php endif; ?>
        </td>
        <td class="small"><?= h($kindRu[(string) $r['kind']] ?? (string) $r['kind']) ?>
          <?php if ((int) $r['is_auto'] === 1): ?><div class="small muted">робот</div><?php endif; ?></td>
        <td class="small"><?= h($handledRu[(string) $r['handled_by']] ?? (string) $r['handled_by']) ?></td>
        <td>
          <form method="post" action="<?= url('/admin/') ?>" style="display:inline"><?= csrf_field() ?>
            <input type="hidden" name="p" value="inbox">
            <input type="hidden" name="id" value="<?= (int) $r['id'] ?>">
            <input type="hidden" name="box" value="<?= h($box) ?>">
            <input type="hidden" name="all" value="<?= $showAll ? '1' : '' ?>">
            <?php if ((string) $r['handled_by'] === ''): ?>
              <button class="btn btn--ghost btn--sm" name="do" value="human">Беру на себя</button>
              <button class="btn btn--ghost btn--sm" name="do" value="skip">Без ответа</button>
            <?php else: ?>
              <button class="btn btn--ghost btn--sm" name="do" value="reopen">Вернуть в работу</button>
            <?php endif; ?>
          </form>
        </td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table>
</div>
<?php
$content = ob_get_clean();
admin_layout('Входящие письма', $content, 'inbox');
