<?php
/**
 * admin/letters.php — ЛЕНТА ЛИЧНЫХ ПИСЕМ УЧАСТНИКАМ.
 *
 * Массовая рассылка видна в «Рассылках»: там очередь, там тело письма. А
 * личное письмо — диплом, результат, код входа, «награды отправлены Почтой
 * России» с трек-номером — уходит прямой отправкой и в очереди не появляется
 * никогда. Владелец вводил трек-номер, нажимал «Отправить», получал зелёную
 * плашку «участнику ушло письмо» — и на этом всё: посмотреть, что именно
 * получил человек, было негде.
 *
 * Здесь эти письма лежат лентой: кому, когда, с какого ящика, дошло или нет.
 * Любое можно открыть и увидеть ровно то, что видит участник у себя в почте.
 */
declare(strict_types=1);
require_once BASE_PATH . '/core/mail_archive.php';
mail_archive_migrate();

/* ─────────── Просмотр одного письма: отдаём тело как есть ───────────
 *
 * Письмо показывается в рамке (iframe) отдельным ответом, а не вставкой в
 * страницу: у письма своя вёрстка со своими стилями, и вставленная в админку
 * она ломает и себя, и админку. Рамка изолирует.
 */
if (input('raw') !== '' && (int) input('raw') > 0) {
    $m = one("SELECT * FROM mail_sent WHERE id=?", [(int) input('raw')]);
    header('Content-Type: text/html; charset=utf-8');
    // Письмо не должно ничего запрашивать и никуда уводить из админки.
    header("Content-Security-Policy: default-src 'none'; img-src * data:; style-src 'unsafe-inline'");
    header('X-Frame-Options: SAMEORIGIN');
    echo $m ? (string) $m['body'] : '<p style="font:16px sans-serif;padding:20px">Письмо не найдено.</p>';
    exit;
}

/* ─────────── Выборка ─────────── */
$q    = trim((string) input('q'));
$only = trim((string) input('only'));      // '' | fail
$view = (int) input('view');

$w = ['1=1']; $args = [];
if ($q !== '') {
    $w[] = '(to_email LIKE ? OR to_name LIKE ? OR subject LIKE ?)';
    array_push($args, "%$q%", "%$q%", "%$q%");
}
if ($only === 'fail') $w[] = 'ok = 0';
$where = implode(' AND ', $w);

$total  = (int) scalar("SELECT COUNT(*) FROM mail_sent WHERE $where", $args);
$failed = (int) scalar("SELECT COUNT(*) FROM mail_sent WHERE ok=0");
$rows   = all("SELECT id,to_email,to_name,subject,from_box,attach,ok,error,created_at
                 FROM mail_sent WHERE $where ORDER BY id DESC LIMIT 200", $args);

$open = $view > 0 ? one("SELECT * FROM mail_sent WHERE id=?", [$view]) : null;

ob_start(); ?>
<div class="page-head">
  <h1>Письма участникам</h1>
  <p class="muted small">Личные письма, ушедшие мимо очереди рассылок: дипломы, результаты,
    коды входа, отправка наград с трек-номером. Видно и то, что не дошло.
    Всего в журнале: <b><?= $total ?></b><?= $failed > 0 ? ', не доставлено: <b style="color:#C0392B">' . $failed . '</b>' : '' ?>.
    Журнал хранится <?= MAIL_ARCHIVE_KEEP_DAYS ?> дней.</p>
</div>

<?php if ($open): ?>
  <div class="card" style="margin-bottom:16px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
      <div>
        <div style="font-weight:800;font-size:1.05rem"><?= h((string) $open['subject']) ?></div>
        <div class="small muted" style="margin-top:4px">
          Кому: <b><?= h((string) $open['to_email']) ?></b><?= trim((string) $open['to_name']) !== '' ? ' — ' . h((string) $open['to_name']) : '' ?><br>
          От: <?= h((string) $open['from_box']) ?><?= trim((string) $open['from_name']) !== '' ? ' («' . h((string) $open['from_name']) . '»)' : '' ?><br>
          Когда: <?= h((string) $open['created_at']) ?>
          <?= (int) $open['ok'] === 1 ? ' · <b style="color:#1E7B4D">доставлено почтовой службе</b>'
                                      : ' · <b style="color:#C0392B">не ушло: ' . h((string) $open['error']) . '</b>' ?>
          <?= trim((string) $open['attach']) !== '' ? '<br>Вложения: ' . h((string) $open['attach']) : '' ?>
        </div>
      </div>
      <a class="btn btn--sm" href="<?= a_link('letters', array_filter(['q' => $q, 'only' => $only])) ?>">Закрыть</a>
    </div>
    <iframe src="<?= a_link('letters', ['raw' => (int) $open['id']]) ?>" title="Письмо участнику"
            style="width:100%;height:70vh;margin-top:14px;border:1px solid var(--line,#e2e2e2);border-radius:12px;background:#fff"></iframe>
  </div>
<?php endif; ?>

<form method="get" class="filters">
  <input type="hidden" name="p" value="letters">
  <div class="field"><label>Поиск</label><input name="q" value="<?= h($q) ?>" placeholder="почта, имя, тема"></div>
  <div class="field"><label>Показать</label>
    <select name="only" onchange="this.form.submit()">
      <option value="">все письма</option>
      <option value="fail" <?= $only === 'fail' ? 'selected' : '' ?>>только недоставленные</option>
    </select></div>
  <button class="btn btn--primary btn--sm">Показать</button>
</form>

<div class="table-wrap">
<table class="table">
  <thead><tr><th>Когда</th><th>Кому</th><th>Тема</th><th>Ящик</th><th>Итог</th><th></th></tr></thead>
  <tbody>
  <?php if (!$rows): ?>
    <tr><td colspan="6" class="muted small" style="padding:18px">
      Пока пусто. Журнал начал собираться с момента включения — письма, ушедшие раньше,
      в нём не появятся.</td></tr>
  <?php endif; ?>
  <?php foreach ($rows as $r): ?>
    <tr>
      <td class="small nowrap"><?= h(date('d.m.Y H:i', (int) strtotime((string) $r['created_at']))) ?></td>
      <td class="small"><?= h((string) $r['to_email']) ?><?= trim((string) $r['to_name']) !== '' ? '<br><span class="muted">' . h((string) $r['to_name']) . '</span>' : '' ?></td>
      <td class="small"><?= h((string) $r['subject']) ?><?= trim((string) $r['attach']) !== '' ? '<br><span class="muted">вложения: ' . h((string) $r['attach']) . '</span>' : '' ?></td>
      <td class="small muted"><?= h((string) $r['from_box']) ?></td>
      <td class="small"><?= (int) $r['ok'] === 1
            ? '<span style="color:#1E7B4D">ушло</span>'
            : '<span style="color:#C0392B">не ушло</span><br><span class="muted">' . h(mb_substr((string) $r['error'], 0, 60)) . '</span>' ?></td>
      <td><a class="btn btn--sm" href="<?= a_link('letters', array_filter(['view' => (int) $r['id'], 'q' => $q, 'only' => $only])) ?>">Смотреть</a></td>
    </tr>
  <?php endforeach; ?>
  </tbody>
</table>
</div>
<?php
$content = ob_get_clean();
admin_layout('Письма участникам', $content, 'letters');
