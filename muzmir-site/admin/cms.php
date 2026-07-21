<?php
/** Контент: страницы, FAQ, отзывы (модерация), концерты, письма министерств. */
declare(strict_types=1);

/* ---------- POST ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('cms'); }
    $do = input('do'); $tab = input('tab') ?: 'pages';

    if ($do === 'save_page') {
        $id = (int) input('id');
        $data = ['title'=>trim(input('title')), 'body'=>(string)($_POST['body'] ?? ''),
                 'meta_description'=>trim(input('meta_description')), 'updated_at'=>date('Y-m-d H:i:s')];
        update('pages', $data, 'id=:wid', ['wid'=>$id]);
        audit('page_save', 'page', $id);
        flash('Страница сохранена.', 'success');
        admin_redirect('cms', ['tab'=>'pages']);
    }

    if ($do === 'save_faq') {
        $id = (int) input('id');
        $data = ['question'=>trim(input('question')),'answer'=>trim(input('answer')),
                 'sort'=>(int)input('sort'),'active'=>isset($_POST['active'])?1:0];
        if ($id) update('faq', $data, 'id=:wid', ['wid'=>$id]); else $id = insert('faq', $data);
        audit('faq_save', 'faq', $id);
        flash('Вопрос сохранён.', 'success');
        admin_redirect('cms', ['tab'=>'faq']);
    }
    if ($do === 'del_faq') { $id=(int)input('id'); q("DELETE FROM faq WHERE id=?", [$id]); audit('faq_delete','faq',$id); flash('Вопрос удалён.','success'); admin_redirect('cms',['tab'=>'faq']); }

    if ($do === 'review') {
        $id = (int) input('id'); $st = input('status');
        if (in_array($st, ['published','rejected','pending'], true)) {
            update('reviews', ['status'=>$st,'admin_reply'=>trim(input('admin_reply'))], 'id=:wid', ['wid'=>$id]);
            audit('review_moderate', 'review', $id, ['status'=>$st]);
            flash('Отзыв обновлён.', 'success');
        }
        admin_redirect('cms', ['tab'=>'reviews']);
    }

    if ($do === 'save_concert') {
        $id = (int) input('id');
        $data = ['title'=>trim(input('title')),'category'=>trim(input('category')),
                 'embed_url'=>trim(input('embed_url')),'cover'=>trim(input('cover')),
                 'date'=>input('date') ?: null,'sort'=>(int)input('sort')];
        if ($id) update('concerts', $data, 'id=:wid', ['wid'=>$id]); else $id = insert('concerts', $data);
        audit('concert_save', 'concert', $id);
        flash('Концерт сохранён.', 'success');
        admin_redirect('cms', ['tab'=>'concerts']);
    }
    if ($do === 'del_concert') { $id=(int)input('id'); q("DELETE FROM concerts WHERE id=?", [$id]); audit('concert_delete','concert',$id); flash('Концерт удалён.','success'); admin_redirect('cms',['tab'=>'concerts']); }

    if ($do === 'save_ministry') {
        $id = (int) input('id');
        $data = ['region'=>trim(input('region')),'title'=>trim(input('title')),
                 'image_path'=>trim(input('image_path')),'sort'=>(int)input('sort')];
        if ($id) update('ministry_letters', $data, 'id=:wid', ['wid'=>$id]); else $id = insert('ministry_letters', $data);
        audit('ministry_save', 'ministry_letter', $id);
        flash('Письмо сохранено.', 'success');
        admin_redirect('cms', ['tab'=>'ministry']);
    }
    if ($do === 'del_ministry') { $id=(int)input('id'); q("DELETE FROM ministry_letters WHERE id=?", [$id]); audit('ministry_delete','ministry_letter',$id); flash('Письмо удалено.','success'); admin_redirect('cms',['tab'=>'ministry']); }
}

$tab = input('tab') ?: 'pages';
$edit = (int) input('edit');

ob_start(); ?>
<div class="section-title"><h2>Контент</h2></div>
<div class="tabs">
  <?php foreach (['pages'=>'Страницы','faq'=>'FAQ','reviews'=>'Отзывы','concerts'=>'Концерты','ministry'=>'Письма министерств'] as $k=>$lb): ?>
    <a href="<?= a_link('cms', ['tab'=>$k]) ?>" class="<?= $tab===$k?'active':'' ?>"><?= h($lb) ?><?php
      if ($k==='reviews') { $pend=(int)scalar("SELECT COUNT(*) FROM reviews WHERE status='pending'"); if ($pend) echo ' ('.$pend.')'; }
    ?></a>
  <?php endforeach; ?>
</div>

<?php /* ===== СТРАНИЦЫ ===== */
if ($tab === 'pages'):
  if ($edit): $pg = one("SELECT * FROM pages WHERE id=?", [$edit]); ?>
    <form method="post" action="<?= url('/admin/') ?>" class="card">
      <?= csrf_field() ?><input type="hidden" name="do" value="save_page"><input type="hidden" name="tab" value="pages"><input type="hidden" name="id" value="<?= $edit ?>">
      <div class="field"><label>Заголовок</label><input name="title" value="<?= h($pg['title']) ?>"></div>
      <div class="field"><label>Slug</label><input value="<?= h($pg['slug']) ?>" disabled><div class="hint">Адрес страницы менять нельзя.</div></div>
      <div class="field"><label>Meta-описание</label><input name="meta_description" value="<?= h($pg['meta_description']) ?>"></div>
      <div class="field"><label>HTML-содержимое</label><textarea name="body" style="min-height:320px;font-family:monospace;font-size:.85rem"><?= h($pg['body']) ?></textarea></div>
      <div class="toolbar"><button class="btn btn--primary"><?= admin_icon('check') ?>Сохранить</button>
        <a class="btn btn--ghost" href="<?= a_link('cms',['tab'=>'pages']) ?>">Отмена</a></div>
    </form>
  <?php else:
    $pages = all("SELECT * FROM pages ORDER BY slug"); ?>
    <div class="table-wrap"><table class="tbl">
      <thead><tr><th>Заголовок</th><th>Slug</th><th>Обновлено</th><th></th></tr></thead><tbody>
      <?php foreach ($pages as $p): ?>
        <tr><td><b><?= h($p['title']) ?></b></td><td class="small"><?= h($p['slug']) ?></td>
          <td class="small"><?= h(date('d.m.y', strtotime($p['updated_at']))) ?></td>
          <td><a class="btn btn--ghost btn--sm" href="<?= a_link('cms',['tab'=>'pages','edit'=>$p['id']]) ?>"><?= admin_icon('edit') ?>Править</a></td></tr>
      <?php endforeach; ?>
    </tbody></table></div>
  <?php endif; ?>

<?php /* ===== FAQ ===== */
elseif ($tab === 'faq'):
  $f = $edit ? one("SELECT * FROM faq WHERE id=?", [$edit]) : ['id'=>0,'question'=>'','answer'=>'','sort'=>0,'active'=>1]; ?>
  <div class="grid grid-2">
    <div class="card">
      <h3><?= $edit?'Редактирование':'Новый вопрос' ?></h3>
      <form method="post" action="<?= url('/admin/') ?>">
        <?= csrf_field() ?><input type="hidden" name="do" value="save_faq"><input type="hidden" name="tab" value="faq"><input type="hidden" name="id" value="<?= (int)$f['id'] ?>">
        <div class="field"><label>Вопрос</label><input name="question" value="<?= h($f['question']) ?>" required></div>
        <div class="field"><label>Ответ</label><textarea name="answer" required><?= h($f['answer']) ?></textarea></div>
        <div class="form-row">
          <div class="field"><label>Порядок</label><input type="number" name="sort" value="<?= (int)$f['sort'] ?>"></div>
          <div class="field" style="align-self:end"><label class="check"><input type="checkbox" name="active" <?= $f['active']?'checked':'' ?>> Активен</label></div>
        </div>
        <button class="btn btn--primary"><?= admin_icon('check') ?>Сохранить</button>
        <?php if ($edit): ?><a class="btn btn--ghost" href="<?= a_link('cms',['tab'=>'faq']) ?>">Отмена</a><?php endif; ?>
      </form>
    </div>
    <div class="card card--pad0">
      <div style="padding:18px"><h3 style="margin:0">Список вопросов</h3></div>
      <div class="table-wrap" style="border:none"><table class="tbl">
        <thead><tr><th>Вопрос</th><th>Акт.</th><th></th></tr></thead><tbody>
        <?php foreach (all("SELECT * FROM faq ORDER BY sort,id") as $q): ?>
          <tr><td class="small"><?= h($q['question']) ?></td><td><?= $q['active']?'✓':'—' ?></td>
            <td style="white-space:nowrap"><a class="btn btn--ghost btn--sm" href="<?= a_link('cms',['tab'=>'faq','edit'=>$q['id']]) ?>"><?= admin_icon('edit') ?></a>
            <form method="post" action="<?= url('/admin/') ?>" style="display:inline"><?= csrf_field() ?><input type="hidden" name="do" value="del_faq"><input type="hidden" name="id" value="<?= $q['id'] ?>">
              <button class="btn btn--danger btn--sm" onclick="return confirm('Удалить?')"><?= admin_icon('trash') ?></button></form></td></tr>
        <?php endforeach; ?>
      </tbody></table></div>
    </div>
  </div>

<?php /* ===== ОТЗЫВЫ ===== */
elseif ($tab === 'reviews'):
  $st = input('rs') ?: 'pending';
  $revs = all("SELECT r.*, c.name comp FROM reviews r LEFT JOIN competitions c ON c.id=r.competition_id WHERE r.status=? ORDER BY r.id DESC", [$st]); ?>
  <div class="tabs" style="margin-bottom:16px">
    <?php foreach (['pending'=>'На модерации','published'=>'Опубликованные','rejected'=>'Отклонённые'] as $k=>$lb): ?>
      <a href="<?= a_link('cms',['tab'=>'reviews','rs'=>$k]) ?>" class="<?= $st===$k?'active':'' ?>"><?= h($lb) ?></a>
    <?php endforeach; ?>
  </div>
  <?php if (!$revs): ?><div class="card empty muted">Отзывов в этой категории нет</div><?php endif; ?>
  <div class="grid grid-2">
    <?php foreach ($revs as $r): ?>
      <div class="card">
        <div class="section-title"><h3 style="margin:0"><?= h($r['author'] ?: 'Аноним') ?></h3><span class="badge badge--gold"><?= str_repeat('★', max(1,(int)$r['rating'])) ?></span></div>
        <?php if ($r['comp']): ?><p class="small muted"><?= h($r['comp']) ?></p><?php endif; ?>
        <p><?= nl2br(h($r['text'])) ?></p>
        <form method="post" action="<?= url('/admin/') ?>">
          <?= csrf_field() ?><input type="hidden" name="do" value="review"><input type="hidden" name="tab" value="reviews"><input type="hidden" name="id" value="<?= $r['id'] ?>">
          <div class="field"><label>Ответ организации (необязательно)</label><textarea name="admin_reply" style="min-height:70px"><?= h($r['admin_reply']) ?></textarea></div>
          <div class="toolbar">
            <button class="btn btn--primary btn--sm" name="status" value="published"><?= admin_icon('check') ?>Опубликовать</button>
            <button class="btn btn--danger btn--sm" name="status" value="rejected"><?= admin_icon('x') ?>Отклонить</button>
          </div>
        </form>
      </div>
    <?php endforeach; ?>
  </div>

<?php /* ===== КОНЦЕРТЫ ===== */
elseif ($tab === 'concerts'):
  $c = $edit ? one("SELECT * FROM concerts WHERE id=?", [$edit]) : ['id'=>0,'title'=>'','category'=>'','embed_url'=>'','cover'=>'','date'=>'','sort'=>0]; ?>
  <div class="grid grid-2">
    <div class="card">
      <h3><?= $edit?'Редактирование':'Новый концерт' ?></h3>
      <form method="post" action="<?= url('/admin/') ?>">
        <?= csrf_field() ?><input type="hidden" name="do" value="save_concert"><input type="hidden" name="tab" value="concerts"><input type="hidden" name="id" value="<?= (int)$c['id'] ?>">
        <div class="field"><label>Название</label><input name="title" value="<?= h($c['title']) ?>" required></div>
        <div class="form-row">
          <div class="field"><label>Категория</label><input name="category" value="<?= h($c['category']) ?>"></div>
          <div class="field"><label>Дата</label><input type="date" name="date" value="<?= h($c['date']) ?>"></div>
        </div>
        <div class="field"><label>Ссылка на видео (embed)</label><input name="embed_url" value="<?= h($c['embed_url']) ?>"></div>
        <div class="form-row">
          <div class="field"><label>Обложка (путь)</label><input name="cover" value="<?= h($c['cover']) ?>"></div>
          <div class="field"><label>Порядок</label><input type="number" name="sort" value="<?= (int)$c['sort'] ?>"></div>
        </div>
        <button class="btn btn--primary"><?= admin_icon('check') ?>Сохранить</button>
        <?php if ($edit): ?><a class="btn btn--ghost" href="<?= a_link('cms',['tab'=>'concerts']) ?>">Отмена</a><?php endif; ?>
      </form>
    </div>
    <div class="card card--pad0">
      <div style="padding:18px"><h3 style="margin:0">Концерты</h3></div>
      <div class="table-wrap" style="border:none"><table class="tbl"><thead><tr><th>Название</th><th>Дата</th><th></th></tr></thead><tbody>
        <?php foreach (all("SELECT * FROM concerts ORDER BY sort,id DESC") as $x): ?>
          <tr><td><?= h($x['title']) ?><br><span class="small muted"><?= h($x['category']) ?></span></td><td class="small"><?= h($x['date'] ?: '—') ?></td>
            <td style="white-space:nowrap"><a class="btn btn--ghost btn--sm" href="<?= a_link('cms',['tab'=>'concerts','edit'=>$x['id']]) ?>"><?= admin_icon('edit') ?></a>
            <form method="post" action="<?= url('/admin/') ?>" style="display:inline"><?= csrf_field() ?><input type="hidden" name="do" value="del_concert"><input type="hidden" name="id" value="<?= $x['id'] ?>">
              <button class="btn btn--danger btn--sm" onclick="return confirm('Удалить?')"><?= admin_icon('trash') ?></button></form></td></tr>
        <?php endforeach; ?>
      </tbody></table></div>
    </div>
  </div>

<?php /* ===== ПИСЬМА МИНИСТЕРСТВ ===== */
else:
  $m = $edit ? one("SELECT * FROM ministry_letters WHERE id=?", [$edit]) : ['id'=>0,'region'=>'','title'=>'','image_path'=>'','sort'=>0]; ?>
  <div class="grid grid-2">
    <div class="card">
      <h3><?= $edit?'Редактирование':'Новое письмо' ?></h3>
      <form method="post" action="<?= url('/admin/') ?>">
        <?= csrf_field() ?><input type="hidden" name="do" value="save_ministry"><input type="hidden" name="tab" value="ministry"><input type="hidden" name="id" value="<?= (int)$m['id'] ?>">
        <div class="field"><label>Регион / субъект</label><input name="region" value="<?= h($m['region']) ?>" required></div>
        <div class="field"><label>Заголовок</label><input name="title" value="<?= h($m['title']) ?>"></div>
        <div class="form-row">
          <div class="field"><label>Путь к изображению письма</label><input name="image_path" value="<?= h($m['image_path']) ?>"></div>
          <div class="field"><label>Порядок</label><input type="number" name="sort" value="<?= (int)$m['sort'] ?>"></div>
        </div>
        <button class="btn btn--primary"><?= admin_icon('check') ?>Сохранить</button>
        <?php if ($edit): ?><a class="btn btn--ghost" href="<?= a_link('cms',['tab'=>'ministry']) ?>">Отмена</a><?php endif; ?>
      </form>
    </div>
    <div class="card card--pad0">
      <div style="padding:18px"><h3 style="margin:0">Письма</h3></div>
      <div class="table-wrap" style="border:none"><table class="tbl"><thead><tr><th>Регион</th><th>Заголовок</th><th></th></tr></thead><tbody>
        <?php foreach (all("SELECT * FROM ministry_letters ORDER BY sort,id") as $x): ?>
          <tr><td><?= h($x['region']) ?></td><td class="small"><?= h($x['title']) ?></td>
            <td style="white-space:nowrap"><a class="btn btn--ghost btn--sm" href="<?= a_link('cms',['tab'=>'ministry','edit'=>$x['id']]) ?>"><?= admin_icon('edit') ?></a>
            <form method="post" action="<?= url('/admin/') ?>" style="display:inline"><?= csrf_field() ?><input type="hidden" name="do" value="del_ministry"><input type="hidden" name="id" value="<?= $x['id'] ?>">
              <button class="btn btn--danger btn--sm" onclick="return confirm('Удалить?')"><?= admin_icon('trash') ?></button></form></td></tr>
        <?php endforeach; ?>
      </tbody></table></div>
    </div>
  </div>
<?php endif; ?>
<?php
$content = ob_get_clean();
admin_layout('Контент', $content, 'cms');
