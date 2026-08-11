<?php
/**
 * ВЕДОМСТВА И ОБРАЩЕНИЯ — раздел админки.
 *
 * Три вещи в одном месте: кому мы пишем (база министерств, союзов и порталов),
 * что мы им отправили (реестр исходящих обращений с номерами) и что они
 * ответили (письма поддержки и готовые посты во ВКонтакте).
 *
 * Отправкой отсюда ничего не запускается. Кнопка «Подготовить» кладёт письма в
 * очередь приостановленными; уйдут они, только когда поднят отдельный стоп-кран
 * обращений. Сделано так намеренно: обращение в министерство отправляется один
 * раз, и случайный клик не должен стоить репутации.
 */
declare(strict_types=1);
require_once BASE_PATH . '/core/ministries.php';
require_once BASE_PATH . '/core/ministry_mailing.php';

$KINDS  = ['federal', 'culture', 'education', 'union', 'media', 'other'];
$STATUS = ['new', 'sent', 'replied', 'supported', 'declined', 'bounced', 'unsub'];

min_migrate();
min_posts_migrate();

/* ---------- Фильтр ---------- */
function min_filter(): array {
    $w = []; $a = [];
    if ($k = input('kind')) { $w[] = 'kind=?';   $a[] = $k; }
    if ($s = input('st'))   { $w[] = 'status=?'; $a[] = $s; }
    if (($q = trim((string) input('q'))) !== '') {
        $w[] = '(mb_lower(org) LIKE mb_lower(?) OR mb_lower(region) LIKE mb_lower(?) OR email LIKE ?)';
        $a[] = "%$q%"; $a[] = "%$q%"; $a[] = "%$q%";
    }
    return [$w ? 'WHERE ' . implode(' AND ', $w) : '', $a];
}

/* ---------- Действия ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('ministries'); }
    $do = input('do');

    if ($do === 'prepare') {
        $limit = max(0, min(1000, (int) input('limit', '0')));
        $r = mm_queue_all(false, $limit);
        audit('ministry_prepare', 'ministries', null, $r);
        flash(isset($r['error'])
            ? (string) $r['error']
            : 'Подготовлено обращений: ' . (int) $r['queued']
              . ($r['skipped'] ? ('. Пропущено: ' . (int) $r['skipped'] . ' (в этом сезоне уже писали)') : '')
              . '. Письма лежат приостановленными — наружу не уйдут.',
            isset($r['error']) ? 'error' : 'success');
        admin_redirect('ministries');
    }

    // Выпуск подготовленных писем: приостановленные строки очереди становятся
    // готовыми к отправке. Это единственное место, откуда обращения уходят.
    if ($do === 'release') {
        $n = 0;
        try {
            $st = q("UPDATE mail_queue SET status='queued'
                      WHERE campaign_type='official' AND status='paused'");
            $n = is_object($st) && method_exists($st, 'rowCount') ? (int) $st->rowCount() : 0;
        } catch (\Throwable $e) {}
        audit('ministry_release', 'ministries', null, ['count' => $n]);
        flash("Выпущено обращений: $n. Уходят с официальной почты центра.", 'success');
        admin_redirect('ministries');
    }

    if ($do === 'hold') {
        $n = 0;
        try {
            $st = q("UPDATE mail_queue SET status='paused'
                      WHERE campaign_type='official' AND status='queued'");
            $n = is_object($st) && method_exists($st, 'rowCount') ? (int) $st->rowCount() : 0;
        } catch (\Throwable $e) {}
        flash("Придержано обращений: $n.", 'success');
        admin_redirect('ministries');
    }

    if ($do === 'auto') {
        mm_set_enabled(input('on') === '1');
        flash('Автоматическая отправка первого числа: ' . (mm_enabled() ? 'включена' : 'выключена'), 'success');
        admin_redirect('ministries');
    }

    if ($do === 'set_status') {
        $id = (int) input('id'); $s = input('status');
        if ($id > 0 && in_array($s, $STATUS, true)) {
            q("UPDATE ministries SET status=? WHERE id=?", [$s, $id]);
            audit('ministry_status', 'ministries', $id, ['status' => $s]);
            flash('Статус обновлён.', 'success');
        }
        admin_redirect('ministries', array_filter(['q' => input('q'), 'kind' => input('kind'), 'st' => input('st')]));
    }

    if ($do === 'add') {
        $n = min_add([
            'org'         => (string) input('org'),
            'region'      => (string) input('region'),
            'kind'        => (string) input('kind_new', 'culture'),
            'branch'      => (string) input('branch', 'main'),
            'email'       => (string) input('email'),
            'person'      => (string) input('person'),
            'person_role' => (string) input('person_role'),
            'note'        => 'добавлено вручную',
        ]);
        flash($n > 0 ? 'Адресат добавлен.' : 'Такой адрес уже есть или он некорректен.', $n > 0 ? 'success' : 'error');
        admin_redirect('ministries');
    }

    if ($do === 'delete') {
        $id = (int) input('id');
        if ($id > 0) { q("DELETE FROM ministries WHERE id=?", [$id]); flash('Удалено.', 'success'); }
        admin_redirect('ministries', array_filter(['q' => input('q'), 'kind' => input('kind'), 'st' => input('st')]));
    }

    // Пост о поддержке во ВКонтакте — публикуется вручную, одной кнопкой.
    if ($do === 'post_publish') {
        $id = (int) input('id');
        $p  = $id > 0 ? one("SELECT * FROM ministry_posts WHERE id=?", [$id]) : null;
        if ($p) {
            require_once BASE_PATH . '/core/vk.php';
            $img = trim((string) $p['image_path']);
            $abs = $img !== '' ? BASE_PATH . '/public/' . ltrim($img, '/') : '';
            try {
                $res = ($abs !== '' && is_file($abs))
                    ? vk_wall_post_with_photo((string) $p['text'], $abs)
                    : vk_wall_post((string) $p['text']);
                $pid = (string) ($res['response']['post_id'] ?? '');
                update('ministry_posts',
                    ['status' => $pid !== '' ? 'published' : 'draft', 'vk_post_id' => $pid,
                     'published_at' => $pid !== '' ? date('Y-m-d H:i:s') : ''],
                    'id=:id', ['id' => $id]);
                flash($pid !== '' ? 'Опубликовано во ВКонтакте.' : 'ВКонтакте не принял пост — проверьте токен.',
                      $pid !== '' ? 'success' : 'error');
            } catch (\Throwable $e) { flash('Ошибка публикации: ' . $e->getMessage(), 'error'); }
        }
        admin_redirect('ministries');
    }

    if ($do === 'post_skip') {
        $id = (int) input('id');
        if ($id > 0) update('ministry_posts', ['status' => 'skipped'], 'id=:id', ['id' => $id]);
        admin_redirect('ministries');
    }
}

/* ---------- Данные ---------- */
$st = min_stats();
[$where, $args] = min_filter();
$page  = max(1, (int) input('page', '1'));
$per   = 50;
$total = (int) (scalar("SELECT COUNT(*) FROM ministries $where", $args) ?? 0);
$rows  = all("SELECT * FROM ministries $where ORDER BY
                CASE kind WHEN 'federal' THEN 0 WHEN 'union' THEN 1 WHEN 'media' THEN 2 ELSE 3 END,
                region, org LIMIT $per OFFSET " . (($page - 1) * $per), $args);
$pages = max(1, (int) ceil($total / $per));

$qPaused = (int) (scalar("SELECT COUNT(*) FROM mail_queue WHERE campaign_type='official' AND status='paused'") ?? 0);
$qReady  = (int) (scalar("SELECT COUNT(*) FROM mail_queue WHERE campaign_type='official' AND status='queued'") ?? 0);
$qSent   = (int) (scalar("SELECT COUNT(*) FROM mail_queue WHERE campaign_type='official' AND status='sent'") ?? 0);

$letters = all("SELECT * FROM official_letters WHERE kind='support' ORDER BY id DESC LIMIT 20");
$posts   = all("SELECT * FROM ministry_posts WHERE status='draft' ORDER BY id DESC LIMIT 10");

ob_start(); ?>
<div class="section-title"><h2>Ведомства и обращения</h2></div>

<p class="small muted" style="margin:-6px 0 14px;max-width:780px">
  Министерства культуры и образования, творческие союзы, порталы анонсов. Первого
  числа, в день запуска новых конкурсов, каждому уходит именное обращение на
  бланке — с исходящим номером, подписью, печатью и QR-кодом проверки. В обращении
  указывается только <b>бесплатный</b> конкурс: ведомство поддерживает то, что
  названо в письме, и это должно быть мероприятие, открытое для любого ребёнка.
</p>

<div class="grid grid-4" style="margin-bottom:16px">
  <div class="card"><div class="small muted">Адресатов</div><div style="font-size:26px;font-weight:800"><?= (int) $st['total'] ?></div></div>
  <div class="card"><div class="small muted">Регионов</div><div style="font-size:26px;font-weight:800"><?= (int) $st['regions'] ?></div></div>
  <div class="card"><div class="small muted">Поддержали</div><div style="font-size:26px;font-weight:800;color:#1E9E5A"><?= (int) ($st['by_status']['supported'] ?? 0) ?></div></div>
  <div class="card"><div class="small muted">Обращений отправлено</div><div style="font-size:26px;font-weight:800;color:var(--a-gold,#C79322)"><?= $qSent ?></div></div>
</div>

<div class="card" style="margin-bottom:16px">
  <h3 style="margin-top:0">Рассылка обращений</h3>

  <?php if (!mm_enabled()): ?>
    <div class="flash flash--warning" style="margin-bottom:12px">
      Автоматическая отправка первого числа <b>выключена</b>. Автомат всё равно
      готовит письма и складывает их приостановленными — ничего не уходит.
    </div>
  <?php else: ?>
    <div class="flash flash--success" style="margin-bottom:12px">
      Автоматическая отправка первого числа <b>включена</b>.
    </div>
  <?php endif; ?>

  <p class="small muted" style="margin:0 0 12px">
    В очереди: приостановлено <b><?= $qPaused ?></b>, готово к отправке <b><?= $qReady ?></b>,
    отправлено <b><?= $qSent ?></b>. К каждому письму прикладываются обращение PDF,
    положение бесплатного конкурса, афиша и логотип центра.
  </p>

  <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end">
    <form method="post" action="<?= url('/admin/') ?>" style="display:flex;gap:8px;align-items:flex-end">
      <?= csrf_field() ?><input type="hidden" name="do" value="prepare">
      <div class="field" style="margin:0">
        <label>Сколько подготовить (0 — всех)</label>
        <input type="number" name="limit" value="0" min="0" max="1000" style="max-width:150px">
      </div>
      <button class="btn btn--navy btn--sm" type="submit"><?= admin_icon('newsletter') ?>Подготовить обращения</button>
    </form>

    <form method="post" action="<?= url('/admin/') ?>">
      <?= csrf_field() ?><input type="hidden" name="do" value="release">
      <button class="btn btn--sm" type="submit"
              onclick="return confirm('Выпустить <?= $qPaused ?> обращений? Они уйдут в ведомства с официальной почты центра.')">
        <?= admin_icon('send') ?>Выпустить подготовленные (<?= $qPaused ?>)
      </button>
    </form>

    <?php if ($qReady > 0): ?>
      <form method="post" action="<?= url('/admin/') ?>">
        <?= csrf_field() ?><input type="hidden" name="do" value="hold">
        <button class="btn btn--sm btn--ghost" type="submit">Придержать (<?= $qReady ?>)</button>
      </form>
    <?php endif; ?>

    <form method="post" action="<?= url('/admin/') ?>">
      <?= csrf_field() ?><input type="hidden" name="do" value="auto">
      <input type="hidden" name="on" value="<?= mm_enabled() ? '0' : '1' ?>">
      <button class="btn btn--sm btn--ghost" type="submit">
        <?= mm_enabled() ? 'Выключить автоотправку 1-го числа' : 'Включить автоотправку 1-го числа' ?>
      </button>
    </form>
  </div>
</div>

<?php if ($posts): ?>
<div class="card" style="margin-bottom:16px">
  <h3 style="margin-top:0">Посты о поддержке — черновики</h3>
  <p class="small muted" style="margin:0 0 12px">
    Ведомство ответило — готов пост во ВКонтакте. Публикуется только вручную.
  </p>
  <?php foreach ($posts as $p): ?>
    <div style="display:flex;gap:12px;align-items:flex-start;padding:10px 0;border-top:1px solid var(--a-line,#e6e6ee)">
      <?php if (trim((string) $p['image_path']) !== ''): ?>
        <img src="<?= url('/' . ltrim((string) $p['image_path'], '/')) ?>" alt=""
             style="width:64px;height:84px;object-fit:cover;border-radius:6px;flex:none">
      <?php endif; ?>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700"><?= h((string) $p['org']) ?></div>
        <div class="small muted" style="white-space:pre-line"><?= h(mb_substr((string) $p['text'], 0, 220)) ?></div>
      </div>
      <div style="display:flex;gap:6px;flex:none">
        <form method="post" action="<?= url('/admin/') ?>">
          <?= csrf_field() ?><input type="hidden" name="do" value="post_publish">
          <input type="hidden" name="id" value="<?= (int) $p['id'] ?>">
          <button class="btn btn--sm btn--navy" type="submit">Опубликовать</button>
        </form>
        <form method="post" action="<?= url('/admin/') ?>">
          <?= csrf_field() ?><input type="hidden" name="do" value="post_skip">
          <input type="hidden" name="id" value="<?= (int) $p['id'] ?>">
          <button class="btn btn--sm btn--ghost" type="submit">Не нужно</button>
        </form>
      </div>
    </div>
  <?php endforeach; ?>
</div>
<?php endif; ?>

<?php if ($letters): ?>
<div class="card" style="margin-bottom:16px">
  <h3 style="margin-top:0">Реестр исходящих — последние 20</h3>
  <div class="table-wrap">
    <table class="table">
      <thead><tr><th>Номер</th><th>Кому</th><th>Отправлено</th><th>Ответ</th><th></th></tr></thead>
      <tbody>
      <?php foreach ($letters as $l): ?>
        <tr>
          <td style="font-family:monospace;white-space:nowrap">№<?= h((string) $l['number']) ?></td>
          <td><?= h((string) $l['org']) ?><?php if (trim((string) $l['person']) !== ''): ?>
              <div class="small muted"><?= h((string) $l['person']) ?></div><?php endif; ?></td>
          <td class="small"><?= trim((string) $l['sent_at']) !== '' ? h(substr((string) $l['sent_at'], 0, 16)) : '<span class="muted">в очереди</span>' ?></td>
          <td class="small"><?= trim((string) $l['replied_at']) !== '' ? h(substr((string) $l['replied_at'], 0, 10)) : '<span class="muted">—</span>' ?></td>
          <td><a class="btn btn--sm btn--ghost" href="<?= url('/letter/' . $l['number']) ?>" target="_blank">Проверка</a></td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>
<?php endif; ?>

<div class="card" style="margin-bottom:16px">
  <h3 style="margin-top:0">Добавить адресата вручную</h3>
  <form method="post" action="<?= url('/admin/') ?>" class="grid grid-3" style="gap:10px">
    <?= csrf_field() ?><input type="hidden" name="do" value="add">
    <div class="field"><label>Организация</label><input name="org" required placeholder="Министерство культуры ... области"></div>
    <div class="field"><label>Регион</label><input name="region" placeholder="Тульская область"></div>
    <div class="field"><label>Электронная почта</label><input name="email" type="email" required></div>
    <div class="field"><label>ФИО руководителя</label><input name="person" placeholder="Иванова Мария Петровна"></div>
    <div class="field"><label>Должность (кому)</label><input name="person_role" placeholder="Министру культуры ... области"></div>
    <div class="field"><label>Тип</label>
      <select name="kind_new">
        <?php foreach ($KINDS as $k): ?><option value="<?= $k ?>"><?= h(min_kind_ru($k)) ?></option><?php endforeach; ?>
      </select>
    </div>
    <div class="field"><label>Ветка</label>
      <select name="branch"><option value="main">канцелярия</option><option value="press">пресс-служба</option></select>
    </div>
    <div class="field" style="align-self:end"><button class="btn btn--navy btn--sm" type="submit">Добавить</button></div>
  </form>
</div>

<form method="get" action="<?= url('/admin/') ?>" class="card" style="margin-bottom:16px;display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end">
  <input type="hidden" name="p" value="ministries">
  <div class="field" style="margin:0"><label>Поиск</label><input name="q" value="<?= h((string) input('q')) ?>" placeholder="ведомство, регион, адрес"></div>
  <div class="field" style="margin:0"><label>Тип</label>
    <select name="kind"><option value="">все</option>
      <?php foreach ($KINDS as $k): ?>
        <option value="<?= $k ?>" <?= input('kind') === $k ? 'selected' : '' ?>><?= h(min_kind_ru($k)) ?></option>
      <?php endforeach; ?>
    </select>
  </div>
  <div class="field" style="margin:0"><label>Статус</label>
    <select name="st"><option value="">все</option>
      <?php foreach ($STATUS as $s): ?>
        <option value="<?= $s ?>" <?= input('st') === $s ? 'selected' : '' ?>><?= h(min_status_ru($s)) ?></option>
      <?php endforeach; ?>
    </select>
  </div>
  <button class="btn btn--sm" type="submit">Показать</button>
</form>

<div class="card">
  <h3 style="margin-top:0">Адресаты — <?= $total ?></h3>
  <div class="table-wrap">
    <table class="table">
      <thead><tr><th>Организация</th><th>Адрес</th><th>Руководитель</th><th>Статус</th><th></th></tr></thead>
      <tbody>
      <?php foreach ($rows as $r): ?>
        <tr>
          <td>
            <div style="font-weight:600"><?= h((string) $r['org']) ?></div>
            <div class="small muted">
              <?= h(min_kind_ru((string) $r['kind'])) ?>
              <?= (string) $r['branch'] === 'press' ? ' · пресс-служба' : '' ?>
              <?= trim((string) $r['region']) !== '' ? ' · ' . h((string) $r['region']) : '' ?>
            </div>
            <?php if (trim((string) $r['note']) !== ''): ?>
              <div class="small muted" style="opacity:.75"><?= h(mb_substr((string) $r['note'], 0, 160)) ?></div>
            <?php endif; ?>
          </td>
          <td class="small" style="word-break:break-all"><?= h((string) $r['email']) ?>
            <?php if (trim((string) $r['last_number']) !== ''): ?>
              <div class="muted">исх. №<?= h((string) $r['last_number']) ?></div>
            <?php endif; ?>
          </td>
          <td class="small"><?= h((string) $r['person']) ?></td>
          <td>
            <form method="post" action="<?= url('/admin/') ?>">
              <?= csrf_field() ?><input type="hidden" name="do" value="set_status">
              <input type="hidden" name="id" value="<?= (int) $r['id'] ?>">
              <input type="hidden" name="q" value="<?= h((string) input('q')) ?>">
              <select name="status" onchange="this.form.submit()" class="small">
                <?php foreach ($STATUS as $s): ?>
                  <option value="<?= $s ?>" <?= (string) $r['status'] === $s ? 'selected' : '' ?>><?= h(min_status_ru($s)) ?></option>
                <?php endforeach; ?>
              </select>
            </form>
          </td>
          <td>
            <form method="post" action="<?= url('/admin/') ?>" onsubmit="return confirm('Удалить адресата?')">
              <?= csrf_field() ?><input type="hidden" name="do" value="delete">
              <input type="hidden" name="id" value="<?= (int) $r['id'] ?>">
              <button class="btn btn--sm btn--ghost" type="submit">Удалить</button>
            </form>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table>
  </div>

  <?php if ($pages > 1): ?>
    <div class="pager" style="margin-top:12px">
      <?php for ($i = 1; $i <= min($pages, 20); $i++): ?>
        <a class="btn btn--sm <?= $i === $page ? 'btn--navy' : 'btn--ghost' ?>"
           href="<?= url('/admin/?p=ministries&page=' . $i
                 . '&q=' . rawurlencode((string) input('q'))
                 . '&kind=' . rawurlencode((string) input('kind'))
                 . '&st=' . rawurlencode((string) input('st'))) ?>"><?= $i ?></a>
      <?php endfor; ?>
    </div>
  <?php endif; ?>
</div>
<?php
$content = ob_get_clean();
admin_layout('Ведомства и обращения', $content);
