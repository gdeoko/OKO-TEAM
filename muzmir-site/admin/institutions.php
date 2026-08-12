<?php
/**
 * БАЗА УЧРЕЖДЕНИЙ — раздел админки.
 *
 * Здесь видно, кого собрал сборщик, кому уже писали и кто ответил. Отсюда же
 * приглашения ставятся в очередь — но НЕ отправляются: отправкой заведует общий
 * воркер очереди и стоп-кран в пульте запуска. Это сделано намеренно, чтобы
 * случайный клик в этом разделе не мог разослать тысячи писем.
 */
declare(strict_types=1);
require_once BASE_PATH . '/core/institutions.php';

$KINDS  = ['dshi', 'center', 'college', 'dk', 'school', 'kindergarten', 'other'];
$STATUS = ['new', 'invited', 'replied', 'bounced', 'unsubscribed', 'banned'];

/* ---------- Фильтр списка ---------- */
function inst_filter(): array {
    $w = []; $a = [];
    if ($k = input('kind'))   { $w[] = 'kind=?';   $a[] = $k; }
    if ($s = input('st'))     { $w[] = 'status=?'; $a[] = $s; }
    if ($r = input('region')) { $w[] = 'region=?'; $a[] = $r; }
    if (input('only_email') === '1') $w[] = "email<>''";
    if (($q = trim((string) input('q'))) !== '') {
        $w[] = '(mb_lower(name) LIKE mb_lower(?) OR mb_lower(city) LIKE mb_lower(?) OR email LIKE ?)';
        $a[] = "%$q%"; $a[] = "%$q%"; $a[] = "%$q%";
    }
    return [$w ? 'WHERE ' . implode(' AND ', $w) : '', $a];
}

/* ---------- Экспорт CSV (до любого вывода) ---------- */
if (input('action') === 'export') {
    [$where, $args] = inst_filter();
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="institutions-' . date('Y-m-d') . '.csv"');
    $fh = fopen('php://output', 'w');
    $n = inst_export_csv($fh, str_replace('WHERE ', '', $where), $args);
    fclose($fh);
    audit('institutions_export', 'institutions', null, ['count' => $n]);
    exit;
}

/* ---------- Действия ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('institutions'); }
    $do = input('do');

    // ПОСТАНОВКА ПРИГЛАШЕНИЙ В ОЧЕРЕДЬ. Письма ложатся в mail_queue как массовые
    // (priority=5): воркер отдаст их bulk-пулу по дневной норме и только в окно
    // отправки. Пока стоп-кран в пульте опущен, наружу не уйдёт ни одно.
    if ($do === 'queue_invites') {
        require_once BASE_PATH . '/core/invite_queue.php';
        $limit = max(1, min(5000, (int) input('limit', '500')));
        $r = invite_queue_institutions($limit);
        audit('institutions_queue_invites', 'institutions', null, $r);
        flash('Поставлено приглашений в очередь: ' . (int) $r['queued']
            . ($r['skipped'] ? ('. Пропущено: ' . (int) $r['skipped'] . ' (нет адреса или уже писали)') : '')
            . '. Наружу они уйдут только после включения массовых рассылок в пульте запуска.',
            'success');
        admin_redirect('institutions');
    }

    if ($do === 'set_status') {
        $id = (int) input('id'); $st = input('status');
        if ($id > 0 && in_array($st, $STATUS, true)) {
            q("UPDATE institutions SET status=?, updated_at=? WHERE id=?", [$st, date('Y-m-d H:i:s'), $id]);
            audit('institution_status', 'institutions', $id, ['status' => $st]);
            flash('Статус обновлён.', 'success');
        }
        admin_redirect('institutions', array_filter(['q' => input('q'), 'kind' => input('kind'), 'st' => input('st')]));
    }

    if ($do === 'delete') {
        $id = (int) input('id');
        if ($id > 0) { q("DELETE FROM institutions WHERE id=?", [$id]); audit('institution_delete', 'institutions', $id); flash('Запись удалена.', 'success'); }
        admin_redirect('institutions', array_filter(['q' => input('q'), 'kind' => input('kind'), 'st' => input('st')]));
    }
}

$st = inst_stats();
[$where, $args] = inst_filter();
$page  = max(1, (int) input('page', '1'));
$per   = 50;
$total = (int) (scalar("SELECT COUNT(*) FROM institutions $where", $args) ?? 0);
$rows  = all("SELECT * FROM institutions $where ORDER BY id DESC LIMIT $per OFFSET " . (($page - 1) * $per), $args);
$pages = max(1, (int) ceil($total / $per));

$regions = [];
foreach (all("SELECT region, COUNT(*) n FROM institutions WHERE region<>'' GROUP BY region ORDER BY region") as $r) {
    $regions[(string) $r['region']] = (int) $r['n'];
}

/* Сколько писем ждёт отправки и включены ли массовые — чтобы было видно, что
   постановка в очередь не равна отправке. */
require_once BASE_PATH . '/core/newsletter.php';
$massOn    = function_exists('mass_sending_enabled') ? mass_sending_enabled() : false;
$queueWait = (int) (scalar("SELECT COUNT(*) FROM mail_queue WHERE status='queued' AND COALESCE(priority,0)>0") ?? 0);

ob_start(); ?>
<div class="section-title"><h2>База учреждений</h2></div>

<p class="small muted" style="margin:-6px 0 14px;max-width:760px">
  Школы искусств, дома культуры и центры творчества. Заявку на конкурс приносит
  педагог — одна преподавательница приводит класс, поэтому письмо в учреждение
  стоит десятков писем родителям. Собирается фоном из открытых источников:
  сообщества ВКонтакте, официальные сайты учреждений, OpenStreetMap.
</p>

<div class="grid grid-4" style="margin-bottom:16px">
  <div class="card"><div class="small muted">Всего учреждений</div><div style="font-size:26px;font-weight:800"><?= (int) $st['total'] ?></div></div>
  <div class="card"><div class="small muted">С электронной почтой</div><div style="font-size:26px;font-weight:800;color:var(--a-gold,#C79322)"><?= (int) $st['with_email'] ?></div></div>
  <div class="card"><div class="small muted">Готовы к приглашению</div><div style="font-size:26px;font-weight:800;color:#1E9E5A"><?= (int) $st['ready'] ?></div></div>
  <div class="card"><div class="small muted">Сообществ ВКонтакте</div><div style="font-size:26px;font-weight:800"><?= (int) $st['with_vk'] ?></div></div>
</div>

<div class="card" style="margin-bottom:16px">
  <h3 style="margin-top:0">Приглашения</h3>
  <?php if (!$massOn): ?>
    <div class="flash flash--warning" style="margin-bottom:12px">
      Массовые рассылки сейчас <b>выключены</b> стоп-краном. Письма можно спокойно
      готовить: они лягут в очередь и будут ждать. Наружу ничего не уйдёт, пока
      массовые не включат в разделе «Запуск».
    </div>
  <?php else: ?>
    <div class="flash flash--success" style="margin-bottom:12px">
      Массовые рассылки <b>включены</b>. Поставленные письма пойдут по дневной норме
      в окно отправки.
    </div>
  <?php endif; ?>
  <p class="small muted" style="margin:0 0 12px">
    В очереди сейчас массовых писем: <b><?= $queueWait ?></b>.
    Приглашение уходит на официальный адрес учреждения один раз, со ссылкой отписки
    в один клик. Отказавшимся и тем, чей адрес дважды отверг почтовик, больше не пишем.
  </p>
  <form method="post" action="<?= url('/admin/') ?>" style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
    <?= csrf_field() ?><input type="hidden" name="do" value="queue_invites">
    <div class="field" style="margin:0">
      <label>Сколько поставить в очередь</label>
      <input type="number" name="limit" value="500" min="1" max="5000" style="max-width:140px">
    </div>
    <button class="btn btn--navy btn--sm" type="submit"><?= admin_icon('send') ?>Подготовить приглашения</button>
    <a class="btn btn--ghost btn--sm" href="<?= a_link('institutions', array_filter(['action' => 'export', 'kind' => input('kind'), 'st' => input('st'), 'only_email' => input('only_email')])) ?>"><?= admin_icon('download') ?>Выгрузить CSV</a>
  </form>
</div>

<div class="grid grid-2" style="margin-bottom:16px">
  <div class="card">
    <h3 style="margin-top:0">По типам</h3>
    <div class="kv">
      <?php foreach ($st['by_kind'] as $k => $n): ?>
        <dt><a href="<?= a_link('institutions', ['kind' => $k]) ?>"><?= h(inst_kind_ru((string) $k)) ?></a></dt><dd><?= (int) $n ?></dd>
      <?php endforeach; ?>
    </div>
  </div>
  <div class="card">
    <h3 style="margin-top:0">По статусам</h3>
    <div class="kv">
      <?php foreach ($st['by_status'] as $k => $n): ?>
        <dt><a href="<?= a_link('institutions', ['st' => $k]) ?>"><?= h(inst_status_ru((string) $k)) ?></a></dt><dd><?= (int) $n ?></dd>
      <?php endforeach; ?>
    </div>
  </div>
</div>

<form method="get" action="<?= url('/admin/') ?>" class="grid grid-4" style="align-items:end;margin-bottom:14px">
  <input type="hidden" name="p" value="institutions">
  <div class="field"><label>Поиск</label><input name="q" value="<?= h(input('q')) ?>" placeholder="название, город, почта"></div>
  <div class="field"><label>Тип</label><select name="kind"><option value="">Любой</option>
    <?php foreach ($KINDS as $k): ?><option value="<?= $k ?>" <?= input('kind') === $k ? 'selected' : '' ?>><?= h(inst_kind_ru($k)) ?></option><?php endforeach; ?>
  </select></div>
  <div class="field"><label>Статус</label><select name="st"><option value="">Любой</option>
    <?php foreach ($STATUS as $s): ?><option value="<?= $s ?>" <?= input('st') === $s ? 'selected' : '' ?>><?= h(inst_status_ru($s)) ?></option><?php endforeach; ?>
  </select></div>
  <div class="field">
    <label style="display:flex;align-items:center;gap:8px;cursor:pointer;white-space:nowrap">
      <input type="checkbox" name="only_email" value="1" <?= input('only_email') === '1' ? 'checked' : '' ?> style="width:auto"> Только с почтой</label>
    <button class="btn btn--primary btn--sm" style="margin-top:6px"><?= admin_icon('search') ?>Найти</button>
    <a class="btn btn--ghost btn--sm" href="<?= a_link('institutions') ?>">Сброс</a>
  </div>
</form>

<div class="card">
  <div class="small muted" style="margin-bottom:8px">Найдено: <b><?= $total ?></b><?= $pages > 1 ? ", страница $page из $pages" : '' ?></div>
  <div style="overflow-x:auto">
  <table class="table">
    <thead><tr>
      <th>Учреждение</th><th>Тип</th><th>Город</th><th>Контакты</th><th>Источник</th><th>Статус</th><th></th>
    </tr></thead>
    <tbody>
    <?php if (!$rows): ?>
      <tr><td colspan="7" class="muted">Пока пусто. Сборщик работает фоном — записи появятся сами.</td></tr>
    <?php else: foreach ($rows as $r): ?>
      <tr>
        <td style="max-width:280px"><?= h((string) $r['name']) ?></td>
        <td class="small"><?= h(inst_kind_ru((string) $r['kind'])) ?></td>
        <td class="small"><?= h((string) $r['city']) ?></td>
        <td class="small">
          <?php if (trim((string) $r['email']) !== ''): ?>
            <div><?= h((string) $r['email']) ?></div>
          <?php endif; ?>
          <?php if (trim((string) $r['site']) !== ''): ?>
            <div><a href="<?= h((string) $r['site']) ?>" target="_blank" rel="noopener noreferrer nofollow">сайт</a></div>
          <?php endif; ?>
          <?php if (trim((string) $r['vk']) !== ''): ?>
            <div><a href="https://vk.com/<?= h((string) $r['vk']) ?>" target="_blank" rel="noopener noreferrer nofollow">ВКонтакте</a></div>
          <?php endif; ?>
        </td>
        <td class="small muted"><?= h((string) $r['source']) ?></td>
        <td class="small"><?= h(inst_status_ru((string) $r['status'])) ?><?php
            if ((int) $r['invited_count'] > 0) echo ' · ' . (int) $r['invited_count'] . '×'; ?></td>
        <td style="white-space:nowrap">
          <form method="post" action="<?= url('/admin/') ?>" style="display:inline">
            <?= csrf_field() ?><input type="hidden" name="do" value="set_status">
            <input type="hidden" name="id" value="<?= (int) $r['id'] ?>">
            <input type="hidden" name="q" value="<?= h(input('q')) ?>">
            <select name="status" onchange="this.form.submit()" class="small">
              <?php foreach ($STATUS as $s): ?>
                <option value="<?= $s ?>" <?= (string) $r['status'] === $s ? 'selected' : '' ?>><?= h(inst_status_ru($s)) ?></option>
              <?php endforeach; ?>
            </select>
          </form>
        </td>
      </tr>
    <?php endforeach; endif; ?>
    </tbody>
  </table>
  </div>
  <?php if ($pages > 1): ?>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:12px">
      <?php for ($i = max(1, $page - 4); $i <= min($pages, $page + 4); $i++): ?>
        <a class="btn btn--<?= $i === $page ? 'navy' : 'ghost' ?> btn--sm"
           href="<?= a_link('institutions', array_filter(['page' => $i, 'q' => input('q'), 'kind' => input('kind'), 'st' => input('st'), 'only_email' => input('only_email')])) ?>"><?= $i ?></a>
      <?php endfor; ?>
    </div>
  <?php endif; ?>
</div>
<?php
$content = ob_get_clean();
admin_layout('База учреждений', $content, 'institutions');
