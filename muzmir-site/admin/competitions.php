<?php
/** Конкурсы: CRUD, черновики, прайс наград, номинации, обложка, положение. */
declare(strict_types=1);

/* ---------- POST-экшены ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_check()) { flash('Сессия устарела, повторите.', 'error'); admin_redirect('competitions'); }
    $do = input('do');

    if ($do === 'save') {
        $id = (int) input('id');
        $slug = strtolower(trim(input('slug')));
        $slug = preg_replace('/[^a-z0-9\-]+/', '-', $slug);
        $slug = trim($slug, '-');
        if ($slug === '') $slug = 'competition-' . time();

        $data = [
            'slug'         => $slug,
            'code'         => mb_strtoupper(trim(input('code'))),
            'name'         => trim(input('name')),
            'type'         => in_array(input('type'), ['international','national'], true) ? input('type') : 'international',
            'direction'    => in_array(input('direction'), ['multi','patriotic','thematic'], true) ? input('direction') : 'multi',
            'is_paid'      => isset($_POST['is_paid']) ? 1 : 0,
            'price'        => (int) input('price'),
            'cover'        => trim(input('cover')),
            'description'  => trim(input('description')),
            'start_date'   => input('start_date') ?: null,
            'end_date'     => input('end_date') ?: null,
            'results_date' => input('results_date') ?: null,
            'results_mode' => input('results_mode') ?: 'email',
            'status'       => in_array(input('status'), ['draft','open','closed','judging','finished'], true) ? input('status') : 'draft',
            'nominations'  => json_encode(array_values($_POST['noms'] ?? []), JSON_UNESCAPED_UNICODE),
            'sort'         => (int) input('sort'),
        ];

        $oldStatus = $id ? (string) scalar("SELECT status FROM competitions WHERE id=?", [$id]) : '';

        if ($id) {
            update('competitions', $data, 'id=:wid', ['wid' => $id]);
            audit('competition_update', 'competition', $id, ['name' => $data['name']]);
        } else {
            $id = insert('competitions', $data);
            audit('competition_create', 'competition', $id, ['name' => $data['name']]);
        }

        // Событие сайта -> мозг-агент при смене статуса конкурса.
        require_once BASE_PATH . '/core/events.php';
        $newStatus = $data['status'];
        if ($newStatus !== $oldStatus) {
            $competition = [
                'name'      => $data['name'],
                'type'      => $data['type'] === 'national' ? 'всероссийский' : 'международный',
                'end_date'  => $data['end_date'] ? ru_date($data['end_date']) : '',
                'url'       => url('/competition/' . $data['slug']),
                'slug'      => $data['slug'],
                'code'      => $data['code'],
            ];
            if ($newStatus === 'open') {
                emit_event('competition_open', ['competition' => $competition]);
            } elseif ($newStatus === 'closed') {
                emit_event('competition_closed', ['competition' => $competition]);
            } elseif ($newStatus === 'finished') {
                emit_event('results_published', ['competition' => $competition]);
            }
        }

        // Прайс наград — перезаписываем набор по конкурсу
        q("DELETE FROM awards_prices WHERE competition_id=?", [$id]);
        $items = $_POST['pi_item'] ?? [];
        $kinds = $_POST['pi_kind'] ?? [];
        $prices = $_POST['pi_price'] ?? [];
        foreach ($items as $i => $it) {
            $it = trim((string)$it);
            if ($it === '') continue;
            insert('awards_prices', [
                'competition_id' => $id,
                'item' => $it,
                'kind' => ($kinds[$i] ?? 'original') === 'digital' ? 'digital' : 'original',
                'price' => (int)($prices[$i] ?? 0),
            ]);
        }
        flash('Конкурс сохранён.', 'success');
        admin_redirect('competitions', ['action' => 'edit', 'id' => $id]);
    }

    if ($do === 'delete') {
        $id = (int) input('id');
        $name = (string) scalar("SELECT name FROM competitions WHERE id=?", [$id]);
        q("DELETE FROM awards_prices WHERE competition_id=?", [$id]);
        q("DELETE FROM competitions WHERE id=?", [$id]);
        audit('competition_delete', 'competition', $id, ['name' => $name]);
        flash('Конкурс удалён.', 'success');
        admin_redirect('competitions');
    }

    if ($do === 'copy') {
        $id = (int) input('id');
        $src = one("SELECT * FROM competitions WHERE id=?", [$id]);
        if ($src) {
            unset($src['id'], $src['created_at']);
            $src['slug']   = $src['slug'] . '-copy-' . substr((string)time(), -4);
            $src['name']   = $src['name'] . ' (копия)';
            $src['status'] = 'draft';
            $newId = insert('competitions', $src);
            foreach (all("SELECT item,kind,price FROM awards_prices WHERE competition_id=?", [$id]) as $pr) {
                insert('awards_prices', ['competition_id' => $newId] + $pr);
            }
            audit('competition_copy', 'competition', $newId, ['from' => $id]);
            flash('Создана копия-черновик.', 'success');
            admin_redirect('competitions', ['action' => 'edit', 'id' => $newId]);
        }
        admin_redirect('competitions');
    }

    if ($do === 'regenerate') {
        $id = (int) input('id');
        $comp = one("SELECT * FROM competitions WHERE id=?", [$id]);
        if ($comp && function_exists('pdf_regulation')) {
            try {
                $path = pdf_regulation($comp);
                update('competitions', ['regulation_pdf' => $path], 'id=:wid', ['wid' => $id]);
                audit('regulation_generate', 'competition', $id);
                flash('Положение сгенерировано.', 'success');
            } catch (Throwable $e) {
                flash('Не удалось сгенерировать положение: ' . $e->getMessage(), 'error');
            }
        } else {
            flash('Генератор положения (pdf_regulation) пока не подключён.', 'warning');
        }
        admin_redirect('competitions', ['action' => 'edit', 'id' => $id]);
    }
}

$action = input('action');

/* ================= ФОРМА РЕДАКТИРОВАНИЯ ================= */
if ($action === 'edit') {
    $id = (int) input('id');
    $c = $id ? one("SELECT * FROM competitions WHERE id=?", [$id]) : null;
    if ($id && !$c) { flash('Конкурс не найден.', 'error'); admin_redirect('competitions'); }
    $c = $c ?: ['id'=>0,'slug'=>'','code'=>'','name'=>'','type'=>'international','direction'=>'multi',
        'is_paid'=>1,'price'=>900,'cover'=>'','description'=>'','start_date'=>'','end_date'=>'',
        'results_date'=>'','results_mode'=>'email','status'=>'draft','nominations'=>'','sort'=>0,'regulation_pdf'=>''];
    $activeNoms = $c['nominations'] ? (json_decode($c['nominations'], true) ?: []) : [];
    $prices = $id ? all("SELECT item,kind,price FROM awards_prices WHERE competition_id=? ORDER BY id", [$id]) : [];
    if (!$prices) $prices = [['item'=>'','kind'=>'original','price'=>0]];

    ob_start(); ?>
    <div class="toolbar">
      <a class="btn btn--ghost btn--sm" href="<?= a_link('competitions') ?>"><?= admin_icon('back') ?>К списку</a>
    </div>
    <form method="post" action="<?= url('/admin/') ?>">
      <?= csrf_field() ?>
      <input type="hidden" name="do" value="save">
      <input type="hidden" name="id" value="<?= (int)$c['id'] ?>">
      <div class="grid grid-2">
        <div class="card">
          <h3>Основное</h3>
          <div class="field"><label>Название</label><input name="name" value="<?= h($c['name']) ?>" required></div>
          <div class="form-row">
            <div class="field"><label>Slug (адрес)</label><input name="slug" value="<?= h($c['slug']) ?>" placeholder="mirovaya-scena"></div>
            <div class="field"><label>Код (для номеров)</label><input name="code" value="<?= h($c['code']) ?>" placeholder="MC" maxlength="4"></div>
          </div>
          <div class="form-row">
            <div class="field"><label>Тип</label><select name="type">
              <option value="international" <?= $c['type']==='international'?'selected':'' ?>>Международный</option>
              <option value="national" <?= $c['type']==='national'?'selected':'' ?>>Всероссийский</option>
            </select></div>
            <div class="field"><label>Направление</label><select name="direction">
              <option value="multi" <?= $c['direction']==='multi'?'selected':'' ?>>Многожанровый</option>
              <option value="patriotic" <?= $c['direction']==='patriotic'?'selected':'' ?>>Патриотический</option>
              <option value="thematic" <?= $c['direction']==='thematic'?'selected':'' ?>>Тематический</option>
            </select></div>
          </div>
          <div class="field"><label>Описание</label><textarea name="description"><?= h($c['description']) ?></textarea></div>
          <div class="field"><label>Обложка (URL или путь)</label><input name="cover" value="<?= h($c['cover']) ?>" placeholder="assets/img/..."></div>
        </div>

        <div class="card">
          <h3>Статус и даты</h3>
          <div class="form-row">
            <div class="field"><label>Статус</label><select name="status">
              <?php foreach (['draft','open','closed','judging','finished'] as $s): ?>
                <option value="<?= $s ?>" <?= $c['status']===$s?'selected':'' ?>><?= h(comp_status_ru($s)) ?></option>
              <?php endforeach; ?>
            </select></div>
            <div class="field"><label>Порядок</label><input type="number" name="sort" value="<?= (int)$c['sort'] ?>"></div>
          </div>
          <div class="form-row">
            <div class="field"><label>Начало приёма</label><input type="date" name="start_date" value="<?= h($c['start_date']) ?>"></div>
            <div class="field"><label>Окончание приёма</label><input type="date" name="end_date" value="<?= h($c['end_date']) ?>"></div>
          </div>
          <div class="form-row">
            <div class="field"><label>Дата результатов</label><input type="date" name="results_date" value="<?= h($c['results_date']) ?>"></div>
            <div class="field"><label>Выдача результатов</label><select name="results_mode">
              <option value="email" <?= $c['results_mode']==='email'?'selected':'' ?>>На почту</option>
              <option value="site" <?= $c['results_mode']==='site'?'selected':'' ?>>На сайте</option>
            </select></div>
          </div>
          <hr>
          <label class="check"><input type="checkbox" name="is_paid" <?= $c['is_paid']?'checked':'' ?>> Платное участие</label>
          <div class="field" style="margin-top:12px"><label>Стоимость участия, ₽</label><input type="number" name="price" value="<?= (int)$c['price'] ?>"></div>
          <?php if ($id): ?>
            <hr>
            <div class="field--inline" style="justify-content:space-between">
              <div><b>Положение</b><br><span class="small muted"><?= $c['regulation_pdf'] ? 'PDF: '.h(basename($c['regulation_pdf'])) : 'ещё не сгенерировано' ?></span></div>
              <button class="btn btn--navy btn--sm" formaction="<?= url('/admin/') ?>" name="do" value="regenerate"><?= admin_icon('download') ?>Сгенерировать положение</button>
            </div>
          <?php endif; ?>
        </div>
      </div>

      <div class="card" style="margin-top:18px">
        <h3>Номинации конкурса</h3>
        <p class="small muted">Отметьте активные группы номинаций для этого конкурса.</p>
        <div class="grid grid-3">
          <?php foreach (array_keys(NOMINATIONS()) as $nom): ?>
            <label class="check"><input type="checkbox" name="noms[]" value="<?= h($nom) ?>" <?= in_array($nom, $activeNoms, true)?'checked':'' ?>> <?= h($nom) ?></label>
          <?php endforeach; ?>
        </div>
      </div>

      <div class="card" style="margin-top:18px">
        <div class="section-title"><h3>Прайс наград</h3>
          <button type="button" class="btn btn--ghost btn--sm" onclick="addPrice()"><?= admin_icon('plus') ?>Строка</button></div>
        <div class="table-wrap">
          <table class="tbl" id="priceTbl">
            <thead><tr><th>Наименование</th><th style="width:150px">Вид</th><th style="width:130px">Цена, ₽</th><th style="width:40px"></th></tr></thead>
            <tbody>
              <?php foreach ($prices as $pr): ?>
                <tr>
                  <td><input name="pi_item[]" value="<?= h($pr['item']) ?>" placeholder="Основной диплом"></td>
                  <td><select name="pi_kind[]">
                    <option value="original" <?= $pr['kind']==='original'?'selected':'' ?>>Оригинал</option>
                    <option value="digital" <?= $pr['kind']==='digital'?'selected':'' ?>>Электронный</option>
                  </select></td>
                  <td><input type="number" name="pi_price[]" value="<?= (int)$pr['price'] ?>"></td>
                  <td><button type="button" class="btn btn--danger btn--sm" onclick="this.closest('tr').remove()"><?= admin_icon('x') ?></button></td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>
      </div>

      <div class="toolbar" style="margin-top:20px">
        <button class="btn btn--primary"><?= admin_icon('check') ?>Сохранить</button>
        <?php if ($id): ?>
          <button class="btn btn--ghost" name="do" value="copy"><?= admin_icon('copy') ?>Дублировать</button>
          <button class="btn btn--danger" name="do" value="delete" onclick="return confirm('Удалить конкурс безвозвратно?')"><?= admin_icon('trash') ?>Удалить</button>
        <?php endif; ?>
      </div>
    </form>
    <script>
    function addPrice(){
      var tb=document.querySelector('#priceTbl tbody');
      var tr=document.createElement('tr');
      tr.innerHTML=`<td><input name="pi_item[]" placeholder="Наименование"></td>`+
        `<td><select name="pi_kind[]"><option value="original">Оригинал</option><option value="digital">Электронный</option></select></td>`+
        `<td><input type="number" name="pi_price[]" value="0"></td>`+
        `<td><button type="button" class="btn btn--danger btn--sm" onclick="this.closest('tr').remove()">✕</button></td>`;
      tb.appendChild(tr);
    }
    </script>
    <?php
    $content = ob_get_clean();
    admin_layout($id ? 'Редактирование конкурса' : 'Новый конкурс', $content, 'competitions');
    exit;
}

/* ================= СПИСОК ================= */
$tab = input('tab') ?: 'active';
$where = $tab === 'archive' ? "status IN ('closed','finished')"
       : ($tab === 'draft' ? "status='draft'" : "status IN ('open','judging')");
$rows = all("SELECT c.*,
             (SELECT COUNT(*) FROM applications a WHERE a.competition_id=c.id) apps
             FROM competitions c WHERE $where ORDER BY c.sort, c.id DESC");
$counts = [
    'active'  => (int) scalar("SELECT COUNT(*) FROM competitions WHERE status IN ('open','judging')"),
    'draft'   => (int) scalar("SELECT COUNT(*) FROM competitions WHERE status='draft'"),
    'archive' => (int) scalar("SELECT COUNT(*) FROM competitions WHERE status IN ('closed','finished')"),
];

ob_start(); ?>
<div class="section-title">
  <h2>Конкурсы</h2>
  <a class="btn btn--primary" href="<?= a_link('competitions', ['action' => 'edit']) ?>"><?= admin_icon('plus') ?>Создать конкурс</a>
</div>
<div class="tabs">
  <a href="<?= a_link('competitions', ['tab'=>'active']) ?>" class="<?= $tab==='active'?'active':'' ?>">Активные (<?= $counts['active'] ?>)</a>
  <a href="<?= a_link('competitions', ['tab'=>'draft']) ?>" class="<?= $tab==='draft'?'active':'' ?>">Черновики (<?= $counts['draft'] ?>)</a>
  <a href="<?= a_link('competitions', ['tab'=>'archive']) ?>" class="<?= $tab==='archive'?'active':'' ?>">Архив (<?= $counts['archive'] ?>)</a>
</div>

<div class="table-wrap">
  <table class="tbl">
    <thead><tr><th>Название</th><th>Код</th><th>Тип</th><th>Статус</th><th class="num">Заявок</th><th class="num">Цена</th><th></th></tr></thead>
    <tbody>
      <?php if (!$rows): ?><tr><td colspan="7" class="muted" style="text-align:center;padding:28px">Нет конкурсов в этой вкладке</td></tr><?php endif; ?>
      <?php foreach ($rows as $c): ?>
        <tr>
          <td><a href="<?= a_link('competitions', ['action'=>'edit','id'=>$c['id']]) ?>"><b><?= h($c['name']) ?></b></a><br><span class="small muted"><?= h($c['slug']) ?></span></td>
          <td><?= h($c['code']) ?></td>
          <td class="small"><?= $c['type']==='national'?'Всероссийский':'Международный' ?></td>
          <td><span class="badge badge--<?= h($c['status']) ?>"><?= h(comp_status_ru($c['status'])) ?></span></td>
          <td class="num"><a href="<?= a_link('applications', ['competition'=>$c['id']]) ?>"><?= (int)$c['apps'] ?></a></td>
          <td class="num"><?= $c['is_paid'] ? money((int)$c['price']) : 'Бесплатно' ?></td>
          <td style="white-space:nowrap">
            <a class="btn btn--ghost btn--sm" href="<?= a_link('competitions', ['action'=>'edit','id'=>$c['id']]) ?>" title="Редактировать"><?= admin_icon('edit') ?></a>
            <form method="post" action="<?= url('/admin/') ?>" style="display:inline">
              <?= csrf_field() ?><input type="hidden" name="do" value="copy"><input type="hidden" name="id" value="<?= $c['id'] ?>">
              <button class="btn btn--ghost btn--sm" title="Дублировать"><?= admin_icon('copy') ?></button>
            </form>
          </td>
        </tr>
      <?php endforeach; ?>
    </tbody>
  </table>
</div>
<?php
$content = ob_get_clean();
admin_layout('Конкурсы', $content, 'competitions');
