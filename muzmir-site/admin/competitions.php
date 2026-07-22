<?php
/** Конкурсы: премиум-CRUD, черновики, копирование, прайс наград, номинации,
 *  обложка, тема/фон диплома, генерация положения-PDF, статусы, предпросмотр. */
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

        $diplomaTheme = input('diploma_theme');
        if (!function_exists('diploma_themes') || !array_key_exists($diplomaTheme, diploma_themes())) $diplomaTheme = '';

        $data = [
            'slug'          => $slug,
            'code'          => mb_strtoupper(trim(input('code'))),
            'name'          => trim(input('name')),
            'type'          => in_array(input('type'), ['international','national'], true) ? input('type') : 'international',
            'direction'     => in_array(input('direction'), ['multi','patriotic','thematic'], true) ? input('direction') : 'multi',
            'is_paid'       => isset($_POST['is_paid']) ? 1 : 0,
            'price'         => (int) input('price'),
            'cover'         => trim(input('cover')),
            'description'   => trim(input('description')),
            'start_date'    => input('start_date') ?: null,
            'end_date'      => input('end_date') ?: null,
            'results_date'  => input('results_date') ?: null,
            'results_mode'  => input('results_mode') ?: 'email',
            'status'        => in_array(input('status'), ['draft','open','closed','judging','finished'], true) ? input('status') : 'draft',
            'nominations'   => json_encode(array_values($_POST['noms'] ?? []), JSON_UNESCAPED_UNICODE),
            'diploma_theme' => $diplomaTheme,
            'diploma_bg'    => trim(input('diploma_bg')),
            'sort'          => (int) input('sort'),
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

/* ---------- Общий premium-стиль модуля (scoped, поверх admin.css) ---------- */
$comp_css = <<<'CSS'
<style>
.comp-hero{display:flex;align-items:center;gap:18px;flex-wrap:wrap;background:linear-gradient(135deg,var(--a-navy-2),var(--a-navy));
  color:#fff;border-radius:var(--a-radius);padding:20px 24px;margin-bottom:18px;box-shadow:var(--a-shadow-lg);position:relative;overflow:hidden}
.comp-hero::after{content:"";position:absolute;right:-40px;top:-40px;width:180px;height:180px;border-radius:50%;
  background:radial-gradient(circle,rgba(201,168,76,.35),transparent 70%);pointer-events:none}
.comp-hero__mark{width:52px;height:52px;flex:0 0 52px;border-radius:14px;background:var(--grad-gold);color:#1a1400;
  display:flex;align-items:center;justify-content:center;font-family:var(--ff-head);font-weight:800;font-size:1.35rem;box-shadow:0 6px 16px rgba(201,168,76,.35)}
.comp-hero__body{min-width:0;flex:1}
.comp-hero__body h2{color:#fff;margin:0 0 4px;font-size:1.4rem;line-height:1.15;overflow-wrap:anywhere}
.comp-hero__meta{display:flex;gap:8px 14px;flex-wrap:wrap;font-size:.82rem;color:#cbd0e6;align-items:center}
.comp-hero__meta code{background:rgba(255,255,255,.1);padding:2px 8px;border-radius:6px;font-family:var(--ff-body);letter-spacing:.06em}
.comp-hero__act{display:flex;gap:9px;flex-wrap:wrap;margin-left:auto}
.comp-hero .btn--ghost{background:rgba(255,255,255,.08);border-color:rgba(255,255,255,.3);color:#fff}
.comp-hero .btn--ghost:hover{background:rgba(255,255,255,.16)}
.card__head{display:flex;align-items:center;gap:10px;margin:0 0 16px}
.card__head svg{width:20px;height:20px;stroke:var(--a-gold-dark);flex:0 0 20px}
.card__head h3{margin:0}
.card__head .count{margin-left:auto;font-size:.78rem;font-weight:700;color:var(--a-muted);background:var(--a-parchment);
  border:1px solid var(--a-line);border-radius:999px;padding:2px 11px}
.noms-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.noms-grid .check{padding:10px 12px;border:1.5px solid var(--a-line);border-radius:var(--a-radius-sm);transition:.14s;background:#fff;font-size:.86rem}
.noms-grid .check:hover{border-color:var(--a-gold)}
.noms-grid .check:has(input:checked){border-color:var(--a-gold);background:linear-gradient(135deg,rgba(216,188,99,.16),rgba(201,168,76,.08))}
.price-foot{display:flex;justify-content:flex-end;gap:10px;align-items:baseline;padding:12px 4px 0;font-size:.9rem}
.price-foot b{font-family:var(--ff-head);font-size:1.15rem;color:var(--a-navy-2)}
.icon-cell .btn{padding:7px}
.icon-cell .btn svg{margin:0}
.comp-list-stats{margin-bottom:20px}
.paycheck{display:flex;align-items:center;gap:9px;padding:11px 14px;border:1.5px solid var(--a-line);border-radius:var(--a-radius-sm);
  cursor:pointer;transition:.14s;font-weight:600}
.paycheck:has(input:checked){border-color:var(--a-gold);background:linear-gradient(135deg,rgba(216,188,99,.16),rgba(201,168,76,.08))}
.swatch{display:inline-flex;align-items:center;gap:8px}
.swatch i{width:16px;height:16px;border-radius:5px;border:1px solid var(--a-line);flex:0 0 16px}
@media (max-width:960px){.noms-grid{grid-template-columns:1fr}}
@media (max-width:640px){
  .comp-hero{padding:16px}
  .comp-hero__act{margin-left:0;width:100%}
  .comp-hero__act .btn{flex:1;justify-content:center}
}
</style>
CSS;

$action = input('action');

/* ================= ФОРМА РЕДАКТИРОВАНИЯ ================= */
if ($action === 'edit') {
    $id = (int) input('id');
    $c = $id ? one("SELECT * FROM competitions WHERE id=?", [$id]) : null;
    if ($id && !$c) { flash('Конкурс не найден.', 'error'); admin_redirect('competitions'); }
    $c = $c ?: ['id'=>0,'slug'=>'','code'=>'','name'=>'','type'=>'international','direction'=>'multi',
        'is_paid'=>1,'price'=>500,'cover'=>'','description'=>'','start_date'=>'','end_date'=>'',
        'results_date'=>'','results_mode'=>'email','status'=>'draft','nominations'=>'','sort'=>0,
        'regulation_pdf'=>'','diploma_theme'=>'','diploma_bg'=>''];
    $activeNoms = $c['nominations'] ? (json_decode($c['nominations'], true) ?: []) : [];
    $prices = $id ? all("SELECT item,kind,price FROM awards_prices WHERE competition_id=? ORDER BY id", [$id]) : [];
    if (!$prices) $prices = [['item'=>'','kind'=>'original','price'=>0]];
    $appsCount = $id ? (int) scalar("SELECT COUNT(*) FROM applications WHERE competition_id=?", [$id]) : 0;
    $themes = function_exists('diploma_themes') ? diploma_themes() : [];
    $publicUrl = url('/competition/' . ($c['slug'] ?: ''));

    ob_start(); ?>
    <?= $comp_css ?>
    <div class="toolbar">
      <a class="btn btn--ghost btn--sm" href="<?= a_link('competitions') ?>"><?= admin_icon('back') ?>К списку</a>
    </div>

    <?php if ($id): ?>
    <div class="comp-hero">
      <div class="comp-hero__mark"><?= h(mb_substr($c['code'] ?: mb_substr($c['name'],0,2), 0, 2)) ?></div>
      <div class="comp-hero__body">
        <h2><?= h($c['name']) ?></h2>
        <div class="comp-hero__meta">
          <span class="badge badge--<?= h($c['status']) ?>"><?= h(comp_status_ru($c['status'])) ?></span>
          <span><?= $c['type']==='national'?'Всероссийский':'Международный' ?></span>
          <code>/<?= h($c['slug']) ?></code>
          <span><?= (int)$appsCount ?> заявок</span>
          <span><?= $c['is_paid'] ? money((int)$c['price']) : 'Бесплатно' ?></span>
        </div>
      </div>
      <div class="comp-hero__act">
        <a class="btn btn--ghost btn--sm" href="<?= h($publicUrl) ?>" target="_blank" rel="noopener"><?= admin_icon('eye') ?>Предпросмотр</a>
        <a class="btn btn--ghost btn--sm" href="<?= a_link('applications', ['competition'=>$id]) ?>"><?= admin_icon('applications') ?>Заявки</a>
      </div>
    </div>
    <?php endif; ?>

    <form method="post" action="<?= url('/admin/') ?>">
      <?= csrf_field() ?>
      <input type="hidden" name="do" value="save">
      <input type="hidden" name="id" value="<?= (int)$c['id'] ?>">
      <div class="grid grid-2">
        <div class="card">
          <div class="card__head"><?= admin_icon('competitions') ?><h3>Основное</h3></div>
          <div class="field"><label>Название</label><input id="fName" name="name" value="<?= h($c['name']) ?>" required></div>
          <div class="form-row">
            <div class="field"><label>Slug (адрес)</label><input id="fSlug" name="slug" value="<?= h($c['slug']) ?>" placeholder="mirovaya-scena">
              <div class="hint">Публичная ссылка: <span id="slugPreview" class="mask"><?= h($publicUrl) ?></span></div></div>
            <div class="field"><label>Код (для номеров)</label><input name="code" value="<?= h($c['code']) ?>" placeholder="MC" maxlength="4" style="text-transform:uppercase"></div>
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
          <div class="field"><label>Описание</label><textarea name="description" placeholder="Краткое описание конкурса для карточки на сайте"><?= h($c['description']) ?></textarea></div>
          <div class="field"><label>Обложка (URL или путь)</label><input name="cover" value="<?= h($c['cover']) ?>" placeholder="assets/img/..."></div>
        </div>

        <div class="card">
          <div class="card__head"><?= admin_icon('clock') ?><h3>Статус и сроки</h3></div>
          <div class="form-row">
            <div class="field"><label>Статус</label><select name="status">
              <?php foreach (['draft','open','closed','judging','finished'] as $s): ?>
                <option value="<?= $s ?>" <?= $c['status']===$s?'selected':'' ?>><?= h(comp_status_ru($s)) ?></option>
              <?php endforeach; ?>
            </select>
            <div class="hint">Открыт → Оценивание → Завершён. При смене — уведомление подписчикам.</div></div>
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
          <label class="paycheck"><input type="checkbox" name="is_paid" id="fPaid" <?= $c['is_paid']?'checked':'' ?>> <?= admin_icon('money') ?><span>Платное участие (оргвзнос)</span></label>
          <div class="field" id="priceRow" style="margin-top:14px"><label>Стоимость участия, ₽</label><input type="number" name="price" value="<?= (int)$c['price'] ?>" min="0"></div>
        </div>
      </div>

      <div class="card" style="margin-top:18px">
        <div class="card__head"><?= admin_icon('grading') ?><h3>Номинации конкурса</h3><span class="count"><span id="nomCount"><?= count($activeNoms) ?></span> из <?= count(NOMINATIONS()) ?></span></div>
        <p class="small muted" style="margin-top:-8px">Отметьте активные группы номинаций для этого конкурса.</p>
        <div class="noms-grid" id="nomsGrid">
          <?php foreach (array_keys(NOMINATIONS()) as $nom): ?>
            <label class="check"><input type="checkbox" name="noms[]" value="<?= h($nom) ?>" <?= in_array($nom, $activeNoms, true)?'checked':'' ?>> <?= h($nom) ?></label>
          <?php endforeach; ?>
        </div>
      </div>

      <div class="card" style="margin-top:18px">
        <div class="card__head"><?= admin_icon('money') ?><h3>Прайс наград</h3>
          <button type="button" class="btn btn--ghost btn--sm" style="margin-left:auto" onclick="addPrice()"><?= admin_icon('plus') ?>Строка</button></div>
        <div class="table-wrap">
          <table class="tbl" id="priceTbl">
            <thead><tr><th>Наименование</th><th style="width:170px">Вид</th><th style="width:140px">Цена, ₽</th><th style="width:44px"></th></tr></thead>
            <tbody>
              <?php foreach ($prices as $pr): ?>
                <tr>
                  <td><input name="pi_item[]" value="<?= h($pr['item']) ?>" placeholder="Основной диплом"></td>
                  <td><select name="pi_kind[]">
                    <option value="original" <?= $pr['kind']==='original'?'selected':'' ?>>Оригинал</option>
                    <option value="digital" <?= $pr['kind']==='digital'?'selected':'' ?>>Электронный</option>
                  </select></td>
                  <td><input type="number" name="pi_price[]" class="pi-price" value="<?= (int)$pr['price'] ?>" min="0" oninput="sumPrices()"></td>
                  <td class="icon-cell"><button type="button" class="btn btn--danger btn--sm" title="Удалить" onclick="this.closest('tr').remove();sumPrices()"><?= admin_icon('x') ?></button></td>
                </tr>
              <?php endforeach; ?>
            </tbody>
          </table>
        </div>
        <div class="price-foot">Позиций: <b id="priceCount">0</b> · Сумма прайса: <b id="priceSum">0 ₽</b></div>
      </div>

      <div class="card" style="margin-top:18px">
        <div class="card__head"><?= admin_icon('diplomas') ?><h3>Диплом и положение</h3></div>
        <div class="grid grid-2" style="gap:22px">
          <div>
            <div class="field"><label>Тема диплома (фон)</label>
              <select name="diploma_theme">
                <option value="">— не задана —</option>
                <?php foreach ($themes as $key => $label): ?>
                  <option value="<?= h($key) ?>" <?= ($c['diploma_theme']??'')===$key?'selected':'' ?>><?= h($label) ?></option>
                <?php endforeach; ?>
              </select>
              <div class="hint">Загрузка своей подложки и предпросмотр диплома - в разделе «Дипломы».</div>
            </div>
            <div class="field"><label>Фон-подложка (URL или путь к PNG)</label>
              <input name="diploma_bg" value="<?= h((string)($c['diploma_bg'] ?? '')) ?>" placeholder="assets/img/diploma_bg.png">
              <?php if (!empty($c['diploma_bg'])): ?><div class="hint">Текущий: <?= h(basename((string)$c['diploma_bg'])) ?></div><?php endif; ?>
            </div>
          </div>
          <div>
            <?php if ($id): ?>
              <div class="field"><label>Положение о конкурсе (PDF)</label>
                <p class="small muted" style="margin:0 0 12px">
                  <?php if ($c['regulation_pdf']): ?>
                    Готово: <b><?= h(basename($c['regulation_pdf'])) ?></b>
                  <?php else: ?>
                    Ещё не сгенерировано.
                  <?php endif; ?>
                </p>
                <div class="toolbar" style="margin:0">
                  <button class="btn btn--navy btn--sm" formaction="<?= url('/admin/') ?>" name="do" value="regenerate"><?= admin_icon('download') ?>Сгенерировать положение</button>
                  <?php if ($c['regulation_pdf']): ?>
                    <a class="btn btn--ghost btn--sm" href="<?= h(url(str_replace(BASE_PATH.'/public','',$c['regulation_pdf']))) ?>" target="_blank" rel="noopener"><?= admin_icon('eye') ?>Открыть PDF</a>
                  <?php endif; ?>
                </div>
                <div class="hint" style="margin-top:10px">Кнопка сохраняет форму и пересобирает положение по актуальным данным конкурса.</div>
              </div>
            <?php else: ?>
              <p class="small muted">Генерация положения станет доступна после первого сохранения конкурса.</p>
            <?php endif; ?>
          </div>
        </div>
      </div>

      <div class="toolbar" style="margin-top:22px">
        <button class="btn btn--primary"><?= admin_icon('check') ?>Сохранить</button>
        <?php if ($id): ?>
          <button class="btn btn--ghost" name="do" value="copy"><?= admin_icon('copy') ?>Дублировать</button>
          <button class="btn btn--danger" name="do" value="delete" onclick="return confirm('Удалить конкурс безвозвратно? Прайс наград тоже будет удалён.')"><?= admin_icon('trash') ?>Удалить</button>
        <?php endif; ?>
      </div>
    </form>

    <script>
    var X_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    function addPrice(){
      var tb=document.querySelector('#priceTbl tbody');
      var tr=document.createElement('tr');
      tr.innerHTML='<td><input name="pi_item[]" placeholder="Наименование"></td>'+
        '<td><select name="pi_kind[]"><option value="original">Оригинал</option><option value="digital">Электронный</option></select></td>'+
        '<td><input type="number" name="pi_price[]" class="pi-price" value="0" min="0" oninput="sumPrices()"></td>'+
        '<td class="icon-cell"><button type="button" class="btn btn--danger btn--sm" title="Удалить">'+X_SVG+'</button></td>';
      tr.querySelector('button').addEventListener('click',function(){tr.remove();sumPrices();});
      tb.appendChild(tr);
      sumPrices();
    }
    function sumPrices(){
      var rows=document.querySelectorAll('#priceTbl tbody tr'), sum=0, n=0;
      rows.forEach(function(r){
        var it=r.querySelector('input[name="pi_item[]"]');
        var pr=r.querySelector('.pi-price');
        if(it && it.value.trim()!==''){ n++; sum+=parseInt(pr && pr.value||0,10)||0; }
      });
      document.getElementById('priceCount').textContent=n;
      document.getElementById('priceSum').textContent=sum.toLocaleString('ru-RU')+' ₽';
    }
    function nomCount(){
      var n=document.querySelectorAll('#nomsGrid input:checked').length;
      document.getElementById('nomCount').textContent=n;
    }
    function slugify(s){
      var map={'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',' ':'-'};
      return s.toLowerCase().split('').map(function(ch){return map[ch]!==undefined?map[ch]:ch;}).join('').replace(/[^a-z0-9\-]+/g,'-').replace(/\-+/g,'-').replace(/^\-|\-$/g,'');
    }
    (function(){
      var base=<?= json_encode(rtrim(url('/competition/'), '/') . '/', JSON_UNESCAPED_SLASHES) ?>;
      var slug=document.getElementById('fSlug'), name=document.getElementById('fName'), prev=document.getElementById('slugPreview');
      var touched=slug.value.trim()!=='';
      function upd(){ prev.textContent=base+(slug.value||'…'); }
      slug.addEventListener('input',function(){touched=true;upd();});
      name.addEventListener('input',function(){ if(!touched){ slug.value=slugify(name.value); upd(); } });
      document.getElementById('nomsGrid').addEventListener('change',nomCount);
      var paid=document.getElementById('fPaid'), pr=document.getElementById('priceRow');
      function togglePay(){ pr.style.opacity=paid.checked?'1':'.5'; }
      paid.addEventListener('change',togglePay); togglePay();
      sumPrices(); upd();
    })();
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
$totalApps = (int) scalar("SELECT COUNT(*) FROM applications");

ob_start(); ?>
<?= $comp_css ?>
<div class="section-title">
  <h2>Конкурсы</h2>
  <a class="btn btn--primary" href="<?= a_link('competitions', ['action' => 'edit']) ?>"><?= admin_icon('plus') ?>Создать конкурс</a>
</div>

<div class="grid grid-4 comp-list-stats">
  <div class="stat"><span class="stat__label">Активные</span><span class="stat__value"><?= $counts['active'] ?></span><span class="stat__sub">Открыт / Оценивание</span><span class="stat__icon"><?= admin_icon('competitions') ?></span></div>
  <div class="stat"><span class="stat__label">Черновики</span><span class="stat__value"><?= $counts['draft'] ?></span><span class="stat__sub">В подготовке</span><span class="stat__icon"><?= admin_icon('edit') ?></span></div>
  <div class="stat"><span class="stat__label">Архив</span><span class="stat__value"><?= $counts['archive'] ?></span><span class="stat__sub">Закрыт / Завершён</span><span class="stat__icon"><?= admin_icon('diplomas') ?></span></div>
  <div class="stat"><span class="stat__label">Заявок всего</span><span class="stat__value"><?= $totalApps ?></span><span class="stat__sub">По всем конкурсам</span><span class="stat__icon"><?= admin_icon('applications') ?></span></div>
</div>

<div class="tabs">
  <a href="<?= a_link('competitions', ['tab'=>'active']) ?>" class="<?= $tab==='active'?'active':'' ?>">Активные (<?= $counts['active'] ?>)</a>
  <a href="<?= a_link('competitions', ['tab'=>'draft']) ?>" class="<?= $tab==='draft'?'active':'' ?>">Черновики (<?= $counts['draft'] ?>)</a>
  <a href="<?= a_link('competitions', ['tab'=>'archive']) ?>" class="<?= $tab==='archive'?'active':'' ?>">Архив (<?= $counts['archive'] ?>)</a>
</div>

<div class="table-wrap">
  <table class="tbl">
    <thead><tr><th>Название</th><th>Код</th><th>Тип</th><th>Статус</th><th class="num">Заявок</th><th class="num">Цена</th><th style="width:150px"></th></tr></thead>
    <tbody>
      <?php if (!$rows): ?><tr><td colspan="7" class="muted" style="text-align:center;padding:28px">Нет конкурсов в этой вкладке. <a href="<?= a_link('competitions', ['action'=>'edit']) ?>">Создать первый</a>.</td></tr><?php endif; ?>
      <?php foreach ($rows as $c): ?>
        <tr>
          <td><a href="<?= a_link('competitions', ['action'=>'edit','id'=>$c['id']]) ?>"><b><?= h($c['name']) ?></b></a><br><span class="small muted">/<?= h($c['slug']) ?></span></td>
          <td><?= $c['code'] ? '<span class="tag">'.h($c['code']).'</span>' : '<span class="muted">—</span>' ?></td>
          <td class="small"><?= $c['type']==='national'?'Всероссийский':'Международный' ?></td>
          <td><span class="badge badge--<?= h($c['status']) ?>"><?= h(comp_status_ru($c['status'])) ?></span></td>
          <td class="num"><a href="<?= a_link('applications', ['competition'=>$c['id']]) ?>"><?= (int)$c['apps'] ?></a></td>
          <td class="num"><?= $c['is_paid'] ? money((int)$c['price']) : '<span class="badge badge--paid">Бесплатно</span>' ?></td>
          <td class="icon-cell" style="white-space:nowrap;text-align:right">
            <a class="btn btn--ghost btn--sm" href="<?= h(url('/competition/'.$c['slug'])) ?>" target="_blank" rel="noopener" title="Предпросмотр на сайте"><?= admin_icon('eye') ?></a>
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
