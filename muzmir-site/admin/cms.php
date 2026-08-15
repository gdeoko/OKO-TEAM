<?php
/** Контент: страницы, FAQ, отзывы (модерация), концерты, письма министерств. */
declare(strict_types=1);

/** Публичный URL страницы CMS: статьи блога живут на /blog/<slug>, остальные — на /<slug>. */
function cms_page_url(string $slug): string {
    return str_starts_with($slug, 'blog-') ? url('/blog/' . $slug) : url('/' . $slug);
}

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
        try { db()->exec("ALTER TABLE ministry_letters ADD COLUMN doc_path TEXT DEFAULT ''"); } catch (\Throwable $e) {}
        $id = (int) input('id');
        $data = ['region'=>trim(input('region')),'title'=>trim(input('title')),
                 'image_path'=>trim(input('image_path')),'sort'=>(int)input('sort')];
        // Загрузка файла-изображения письма (jpg/png/webp) — необязательно.
        if (!empty($_FILES['image_file']['tmp_name']) && is_uploaded_file($_FILES['image_file']['tmp_name'])) {
            $ext = strtolower(pathinfo((string)$_FILES['image_file']['name'], PATHINFO_EXTENSION));
            if (in_array($ext, ['jpg','jpeg','png','webp'], true)) {
                $dir = BASE_PATH . '/public/uploads/ministry'; @mkdir($dir, 0775, true);
                $fn = 'letter_' . ($id ?: 'new') . '_' . substr(bin2hex(random_bytes(4)),0,8) . '.' . $ext;
                if (@move_uploaded_file($_FILES['image_file']['tmp_name'], $dir . '/' . $fn)) $data['image_path'] = '/uploads/ministry/' . $fn;
            }
        }
        // Приложение ДОКУМЕНТА поддержки (pdf/doc/docx/jpg/png) — необязательно.
        if (!empty($_FILES['doc_file']['tmp_name']) && is_uploaded_file($_FILES['doc_file']['tmp_name'])) {
            $ext = strtolower(pathinfo((string)$_FILES['doc_file']['name'], PATHINFO_EXTENSION));
            if (in_array($ext, ['pdf','doc','docx','jpg','jpeg','png','webp'], true)) {
                $dir = BASE_PATH . '/public/uploads/ministry'; @mkdir($dir, 0775, true);
                $fn = 'doc_' . ($id ?: 'new') . '_' . substr(bin2hex(random_bytes(4)),0,8) . '.' . $ext;
                if (@move_uploaded_file($_FILES['doc_file']['tmp_name'], $dir . '/' . $fn)) $data['doc_path'] = '/uploads/ministry/' . $fn;
            }
        }
        if ($id) update('ministry_letters', $data, 'id=:wid', ['wid'=>$id]); else $id = insert('ministry_letters', $data);
        audit('ministry_save', 'ministry_letter', $id);
        flash('Письмо сохранено.', 'success');
        admin_redirect('cms', ['tab'=>'ministry']);
    }
    if ($do === 'del_ministry') { $id=(int)input('id'); q("DELETE FROM ministry_letters WHERE id=?", [$id]); audit('ministry_delete','ministry_letter',$id); flash('Письмо удалено.','success'); admin_redirect('cms',['tab'=>'ministry']); }
}

$tab  = input('tab') ?: 'pages';
$edit = (int) input('edit');

/* ---------- Обзорные счётчики для ленты вкладок ---------- */
$cPages    = (int) scalar("SELECT COUNT(*) FROM pages");
$cFaq      = (int) scalar("SELECT COUNT(*) FROM faq");
$cFaqOn    = (int) scalar("SELECT COUNT(*) FROM faq WHERE active=1");
$cRevPend  = (int) scalar("SELECT COUNT(*) FROM reviews WHERE status='pending'");
$cRevPub   = (int) scalar("SELECT COUNT(*) FROM reviews WHERE status='published'");
$cConcerts = (int) scalar("SELECT COUNT(*) FROM concerts");
$cMinistry = (int) scalar("SELECT COUNT(*) FROM ministry_letters");

/** Мини-карточка обзора над лентой контента. */
$cmsCard = function(string $to, string $icon, string $val, string $label, bool $active, string $accent='') {
    $cls = 'cms-mini' . ($active ? ' is-active' : '');
    $bdg = $accent !== '' ? '<span class="cms-mini__flag">'.$accent.'</span>' : '';
    return '<a class="'.$cls.'" href="'.a_link('cms',['tab'=>$to]).'">'
         . '<span class="cms-mini__ic">'.admin_icon($icon).'</span>'
         . '<span class="cms-mini__v">'.h($val).$bdg.'</span>'
         . '<span class="cms-mini__l">'.h($label).'</span></a>';
};

ob_start(); ?>
<style>
/* ===== CMS premium (scoped) ===== */
.cms-mini-row{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:22px}
.cms-mini{display:flex;flex-direction:column;gap:5px;background:#fff;border:1px solid var(--a-line);border-radius:var(--a-radius);
  padding:14px 16px;box-shadow:var(--a-shadow);position:relative;overflow:hidden;transition:.16s;text-decoration:none}
.cms-mini::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--a-line);transition:.16s}
.cms-mini:hover{transform:translateY(-2px);box-shadow:var(--a-shadow-lg,0 10px 26px rgba(20,26,51,.12))}
.cms-mini.is-active::before{background:var(--grad-gold)}
.cms-mini.is-active{border-color:var(--a-gold)}
.cms-mini__ic{position:absolute;right:12px;top:12px;opacity:.13}
.cms-mini__ic svg{width:30px;height:30px;stroke:var(--a-navy-2)}
.cms-mini__v{font-family:var(--ff-head);font-size:1.55rem;color:var(--a-navy-2);line-height:1;display:flex;align-items:center;gap:7px}
.cms-mini__l{font-size:.74rem;text-transform:uppercase;letter-spacing:.07em;color:var(--a-muted);font-weight:700}
.cms-mini__flag{font-family:var(--ff-body);font-size:.66rem;font-weight:800;background:var(--a-gold-deep,#8B6F1F);color:#fff;
  padding:2px 7px;border-radius:999px;letter-spacing:.02em}
/* Редактор страниц */
.cms-ed-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:18px;align-items:start}
.cms-ed-tools{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
.cms-ed-tools button{font:600 .8rem/1 var(--ff-body);padding:7px 11px;border:1.5px solid var(--a-line);background:#fff;
  color:var(--a-navy-2);border-radius:8px;cursor:pointer;transition:.14s}
.cms-ed-tools button:hover{border-color:var(--a-gold);background:var(--a-parchment)}
.cms-code{min-height:340px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.84rem;line-height:1.55}
.cms-counter{font-size:.78rem;color:var(--a-muted);margin-top:5px}
.cms-counter b{color:var(--a-navy-2)}
.cms-preview-card{position:sticky;top:16px}
.cms-preview-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
.cms-preview-head h3{margin:0}
.cms-live{width:100%;height:520px;border:1px solid var(--a-line);border-radius:var(--a-radius-sm);background:#fff}
/* Отзывы */
.cms-rev{position:relative}
.cms-rev__stars{color:var(--a-gold-deep,#8B6F1F);letter-spacing:2px;font-size:1rem}
.cms-rev__reply{background:var(--a-parchment);border-left:3px solid var(--a-gold);border-radius:0 8px 8px 0;
  padding:9px 12px;margin:10px 0;font-size:.88rem;color:var(--a-ink)}
.cms-rev__reply b{display:block;font-size:.74rem;text-transform:uppercase;letter-spacing:.06em;color:var(--a-muted);margin-bottom:3px}
/* Превью-миниатюры (концерты / письма) */
.cms-thumb{width:56px;height:40px;object-fit:cover;border-radius:7px;border:1px solid var(--a-line);background:var(--a-parchment);display:block}
.cms-thumb--doc{width:44px;height:58px;object-fit:cover}
.cms-thumb-ph{display:flex;align-items:center;justify-content:center;color:var(--a-muted)}
.cms-thumb-ph svg{width:20px;height:20px;stroke:var(--a-muted)}
.cms-embed-tag{display:inline-flex;align-items:center;gap:5px;font-size:.74rem;color:var(--a-muted)}
@media (max-width:960px){.cms-mini-row{grid-template-columns:repeat(3,1fr)}}
@media (max-width:820px){.cms-ed-grid{grid-template-columns:1fr}.cms-preview-card{position:static}.cms-live{height:380px}}
@media (max-width:520px){.cms-mini-row{grid-template-columns:repeat(2,1fr)}.cms-mini__v{font-size:1.3rem}}
</style>

<div class="section-title"><h2>Контент</h2></div>

<div class="cms-mini-row">
  <?= $cmsCard('pages','cms',(string)$cPages,'Страницы',$tab==='pages') ?>
  <?= $cmsCard('faq','applications',$cFaqOn.'/'.$cFaq,'FAQ активны',$tab==='faq') ?>
  <?= $cmsCard('reviews','users',(string)$cRevPub,'Отзывы',$tab==='reviews',$cRevPend?('+'.$cRevPend):'') ?>
  <?= $cmsCard('concerts','eye',(string)$cConcerts,'Концерты',$tab==='concerts') ?>
  <?= $cmsCard('ministry','diplomas',(string)$cMinistry,'Письма',$tab==='ministry') ?>
</div>

<div class="tabs">
  <?php foreach (['pages'=>'Страницы','faq'=>'FAQ','reviews'=>'Отзывы','concerts'=>'Концерты','ministry'=>'Письма министерств'] as $k=>$lb): ?>
    <a href="<?= a_link('cms', ['tab'=>$k]) ?>" class="<?= $tab===$k?'active':'' ?>"><?= h($lb) ?><?php
      if ($k==='reviews' && $cRevPend) echo ' ('.$cRevPend.')';
    ?></a>
  <?php endforeach; ?>
</div>

<?php /* ===== СТРАНИЦЫ ===== */
if ($tab === 'pages'):
  if ($edit): $pg = one("SELECT * FROM pages WHERE id=?", [$edit]); ?>
    <div class="toolbar">
      <a class="btn btn--ghost btn--sm" href="<?= a_link('cms',['tab'=>'pages']) ?>"><?= admin_icon('back') ?>К списку страниц</a>
      <a class="btn btn--navy btn--sm" href="<?= h(cms_page_url((string)$pg['slug'])) ?>" target="_blank" rel="noopener"><?= admin_icon('eye') ?>Открыть на сайте</a>
    </div>
    <form method="post" action="<?= url('/admin/') ?>" class="cms-ed-grid" id="pageForm">
      <?= csrf_field() ?><input type="hidden" name="do" value="save_page"><input type="hidden" name="tab" value="pages"><input type="hidden" name="id" value="<?= $edit ?>">
      <div class="card">
        <div class="section-title"><h3 style="margin:0">Редактор страницы</h3><span class="badge badge--muted"><?= h($pg['slug']) ?></span></div>
        <div class="field"><label>Заголовок</label><input name="title" value="<?= h($pg['title']) ?>"></div>
        <div class="field"><label>Slug</label><input value="<?= h($pg['slug']) ?>" disabled><div class="hint">Адрес страницы менять нельзя.</div></div>
        <div class="field"><label>Meta-описание</label><input name="meta_description" id="metaInp" value="<?= h($pg['meta_description']) ?>" maxlength="320">
          <div class="cms-counter">Для поиска: <b id="metaCnt">0</b> симв. <span class="muted">(оптимально 140-160)</span></div></div>
        <div class="field" style="margin-bottom:8px"><label>HTML-содержимое</label>
          <div class="cms-ed-tools">
            <button type="button" onclick="cmsWrap('h2')">H2</button>
            <button type="button" onclick="cmsWrap('h3')">H3</button>
            <button type="button" onclick="cmsWrap('p')">Абзац</button>
            <button type="button" onclick="cmsWrap('strong')">Жирный</button>
            <button type="button" onclick="cmsWrap('em')">Курсив</button>
            <button type="button" onclick="cmsIns('<ul>\n  <li></li>\n</ul>')">Список</button>
            <button type="button" onclick="cmsIns('<a href=&quot;&quot;></a>')">Ссылка</button>
          </div>
          <textarea name="body" id="bodyInp" class="cms-code"><?= h($pg['body']) ?></textarea>
          <div class="cms-counter"><b id="bodyCnt">0</b> симв.</div>
        </div>
        <div class="toolbar" style="margin:0"><button class="btn btn--primary"><?= admin_icon('check') ?>Сохранить</button>
          <a class="btn btn--ghost" href="<?= a_link('cms',['tab'=>'pages']) ?>">Отмена</a></div>
      </div>
      <div class="card cms-preview-card">
        <div class="cms-preview-head"><h3>Предпросмотр</h3><button type="button" class="btn btn--ghost btn--sm" onclick="cmsRefresh()"><?= admin_icon('eye') ?>Обновить</button></div>
        <iframe id="pagePrev" class="cms-live" title="Предпросмотр страницы"></iframe>
      </div>
    </form>
    <script>
    (function(){
      var body=document.getElementById('bodyInp'), meta=document.getElementById('metaInp'),
          frame=document.getElementById('pagePrev'),
          bc=document.getElementById('bodyCnt'), mc=document.getElementById('metaCnt');
      var shell='<style>body{font-family:Manrope,system-ui,sans-serif;color:#1B2340;line-height:1.6;padding:22px;max-width:640px;margin:0 auto;background:#FFFCF5}'
              +'h1,h2,h3{font-family:"Playfair Display",Georgia,serif;color:#1B2340;line-height:1.2}h2{font-size:1.5rem;margin:1.2em 0 .4em}h3{font-size:1.15rem}'
              +'a{color:#8B6F1F}img{max-width:100%;height:auto;border-radius:10px}ul{padding-left:1.2em}blockquote{border-left:3px solid #C9A84C;margin:1em 0;padding:.2em 1em;color:#6a6353}</style>';
      window.cmsRefresh=function(){ frame.srcdoc=shell+(body.value||'<p style="color:#6a6353">Содержимого пока нет.</p>'); };
      function counts(){ bc.textContent=(body.value||'').length; mc.textContent=(meta.value||'').length; }
      var t; body.addEventListener('input',function(){counts();clearTimeout(t);t=setTimeout(cmsRefresh,350);});
      meta.addEventListener('input',counts);
      window.cmsWrap=function(tag){ var s=body.selectionStart,e=body.selectionEnd,v=body.value,sel=v.slice(s,e)||'текст';
        var ins='<'+tag+'>'+sel+'</'+tag+'>'; body.value=v.slice(0,s)+ins+v.slice(e);
        body.focus(); body.selectionStart=s+tag.length+2; body.selectionEnd=s+tag.length+2+sel.length; counts(); cmsRefresh(); };
      window.cmsIns=function(html){ html=html.replace(/&quot;/g,'"'); var s=body.selectionStart,v=body.value;
        body.value=v.slice(0,s)+html+v.slice(s); body.focus(); counts(); cmsRefresh(); };
      counts(); cmsRefresh();
    })();
    </script>
  <?php else:
    $pages = all("SELECT * FROM pages ORDER BY slug"); ?>
    <div class="table-wrap"><table class="tbl">
      <thead><tr><th>Заголовок</th><th>Slug</th><th>Meta</th><th>Обновлено</th><th></th></tr></thead><tbody>
      <?php if (!$pages): ?><tr><td colspan="5" class="muted" style="text-align:center;padding:26px">Страниц пока нет</td></tr><?php endif; ?>
      <?php foreach ($pages as $p): $ml=mb_strlen((string)$p['meta_description']); ?>
        <tr><td><b><?= h($p['title']) ?></b></td><td class="small"><span class="tag"><?= h($p['slug']) ?></span></td>
          <td class="small"><?php if(!$ml): ?><span class="badge badge--rejected">нет</span><?php elseif($ml<70||$ml>170): ?><span class="badge badge--judging"><?= $ml ?></span><?php else: ?><span class="badge badge--paid"><?= $ml ?></span><?php endif; ?></td>
          <td class="small" style="white-space:nowrap"><?= h(date('d.m.y', strtotime($p['updated_at']))) ?> <span class="muted"><?= h(date('H:i', strtotime($p['updated_at']))) ?></span></td>
          <td style="white-space:nowrap"><a class="btn btn--navy btn--sm" href="<?= a_link('cms',['tab'=>'pages','edit'=>$p['id']]) ?>"><?= admin_icon('edit') ?>Править</a>
            <a class="btn btn--ghost btn--sm" href="<?= h(cms_page_url((string)$p['slug'])) ?>" target="_blank" rel="noopener"><?= admin_icon('eye') ?></a></td></tr>
      <?php endforeach; ?>
    </tbody></table></div>
  <?php endif; ?>

<?php /* ===== FAQ ===== */
elseif ($tab === 'faq'):
  $f = $edit ? one("SELECT * FROM faq WHERE id=?", [$edit]) : ['id'=>0,'question'=>'','answer'=>'','sort'=>0,'active'=>1]; ?>
  <div class="grid grid-2">
    <div class="card">
      <div class="section-title"><h3 style="margin:0"><?= $edit?'Редактирование вопроса':'Новый вопрос' ?></h3><?php if($edit): ?><span class="badge badge--muted">#<?= (int)$f['id'] ?></span><?php endif; ?></div>
      <form method="post" action="<?= url('/admin/') ?>">
        <?= csrf_field() ?><input type="hidden" name="do" value="save_faq"><input type="hidden" name="tab" value="faq"><input type="hidden" name="id" value="<?= (int)$f['id'] ?>">
        <div class="field"><label>Вопрос</label><input name="question" value="<?= h($f['question']) ?>" required></div>
        <div class="field"><label>Ответ</label><textarea name="answer" required><?= h($f['answer']) ?></textarea></div>
        <div class="form-row">
          <div class="field"><label>Порядок</label><input type="number" name="sort" value="<?= (int)$f['sort'] ?>"></div>
          <div class="field" style="align-self:end"><label class="check"><input type="checkbox" name="active" <?= $f['active']?'checked':'' ?>> Активен на сайте</label></div>
        </div>
        <button class="btn btn--primary"><?= admin_icon('check') ?>Сохранить</button>
        <?php if ($edit): ?><a class="btn btn--ghost" href="<?= a_link('cms',['tab'=>'faq']) ?>">Отмена</a><?php endif; ?>
      </form>
    </div>
    <div class="card card--pad0">
      <div style="padding:18px"><div class="section-title" style="margin:0"><h3 style="margin:0">Список вопросов</h3><span class="badge badge--gold"><?= $cFaqOn ?> из <?= $cFaq ?></span></div></div>
      <div class="table-wrap" style="border:none"><table class="tbl">
        <thead><tr><th>Вопрос</th><th>Пор.</th><th>Акт.</th><th></th></tr></thead><tbody>
        <?php $faqs = all("SELECT * FROM faq ORDER BY sort,id"); if (!$faqs): ?><tr><td colspan="4" class="muted" style="text-align:center;padding:22px">Вопросов пока нет</td></tr><?php endif; ?>
        <?php foreach ($faqs as $q): ?>
          <tr><td class="small"><?= h($q['question']) ?></td><td class="small"><?= (int)$q['sort'] ?></td>
            <td><?= $q['active']?'<span class="badge badge--paid">да</span>':'<span class="badge badge--muted">нет</span>' ?></td>
            <td style="white-space:nowrap"><a class="btn btn--ghost btn--sm" href="<?= a_link('cms',['tab'=>'faq','edit'=>$q['id']]) ?>"><?= admin_icon('edit') ?></a>
            <form method="post" action="<?= url('/admin/') ?>" style="display:inline"><?= csrf_field() ?><input type="hidden" name="do" value="del_faq"><input type="hidden" name="id" value="<?= $q['id'] ?>">
              <button class="btn btn--danger btn--sm" onclick="return confirm('Удалить вопрос?')"><?= admin_icon('trash') ?></button></form></td></tr>
        <?php endforeach; ?>
      </tbody></table></div>
    </div>
  </div>

<?php /* ===== ОТЗЫВЫ ===== */
elseif ($tab === 'reviews'):
  $st = input('rs') ?: 'pending';
  $counts = ['pending'=>$cRevPend,'published'=>$cRevPub,'rejected'=>(int)scalar("SELECT COUNT(*) FROM reviews WHERE status='rejected'")];
  $revs = all("SELECT r.*, c.name comp FROM reviews r LEFT JOIN competitions c ON c.id=r.competition_id WHERE r.status=? ORDER BY r.id DESC", [$st]); ?>
  <div class="tabs" style="margin-bottom:16px">
    <?php foreach (['pending'=>'На модерации','published'=>'Опубликованные','rejected'=>'Отклонённые'] as $k=>$lb): ?>
      <a href="<?= a_link('cms',['tab'=>'reviews','rs'=>$k]) ?>" class="<?= $st===$k?'active':'' ?>"><?= h($lb) ?><?= $counts[$k]?' ('.$counts[$k].')':'' ?></a>
    <?php endforeach; ?>
  </div>
  <?php if (!$revs): ?><div class="card empty muted">В этой категории отзывов нет</div><?php endif; ?>
  <div class="grid grid-2">
    <?php foreach ($revs as $r): $rr=max(0,min(5,(int)$r['rating'])); ?>
      <div class="card cms-rev">
        <div class="section-title" style="margin-bottom:6px"><h3 style="margin:0"><?= h($r['author'] ?: 'Аноним') ?></h3>
          <span class="cms-rev__stars"><?= str_repeat('★',$rr).str_repeat('☆',5-$rr) ?></span></div>
        <p class="small muted" style="margin:0 0 8px">
          <?php if ($r['comp']): ?><span class="tag"><?= h($r['comp']) ?></span> <?php endif; ?><?= h(ru_date($r['created_at'])) ?></p>
        <p style="margin:0 0 4px"><?= nl2br(h($r['text'])) ?></p>
        <?php if (trim((string)$r['admin_reply'])!==''): ?><div class="cms-rev__reply"><b>Ответ организации</b><?= nl2br(h($r['admin_reply'])) ?></div><?php endif; ?>
        <form method="post" action="<?= url('/admin/') ?>">
          <?= csrf_field() ?><input type="hidden" name="do" value="review"><input type="hidden" name="tab" value="reviews"><input type="hidden" name="id" value="<?= $r['id'] ?>">
          <div class="field"><label>Ответ организации (необязательно)</label><textarea name="admin_reply" style="min-height:70px"><?= h($r['admin_reply']) ?></textarea></div>
          <div class="toolbar" style="margin:0">
            <?php if ($st!=='published'): ?><button class="btn btn--primary btn--sm" name="status" value="published"><?= admin_icon('check') ?>Опубликовать</button><?php endif; ?>
            <?php if ($st!=='rejected'): ?><button class="btn btn--danger btn--sm" name="status" value="rejected"><?= admin_icon('x') ?>Отклонить</button><?php endif; ?>
            <?php if ($st!=='pending'): ?><button class="btn btn--ghost btn--sm" name="status" value="pending"><?= admin_icon('back') ?>На модерацию</button><?php endif; ?>
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
      <div class="section-title"><h3 style="margin:0"><?= $edit?'Редактирование концерта':'Новый концерт' ?></h3><?php if($edit): ?><span class="badge badge--muted">#<?= (int)$c['id'] ?></span><?php endif; ?></div>
      <form method="post" action="<?= url('/admin/') ?>">
        <?= csrf_field() ?><input type="hidden" name="do" value="save_concert"><input type="hidden" name="tab" value="concerts"><input type="hidden" name="id" value="<?= (int)$c['id'] ?>">
        <div class="field"><label>Название</label><input name="title" value="<?= h($c['title']) ?>" required></div>
        <div class="form-row">
          <div class="field"><label>Категория</label><input name="category" value="<?= h($c['category']) ?>"></div>
          <div class="field"><label>Дата</label><input type="date" name="date" value="<?= h($c['date']) ?>"></div>
        </div>
        <div class="field"><label>Ссылка на видео (embed)</label><input name="embed_url" value="<?= h($c['embed_url']) ?>" placeholder="https://..."></div>
        <div class="form-row">
          <div class="field"><label>Обложка (путь)</label><input name="cover" value="<?= h($c['cover']) ?>"></div>
          <div class="field"><label>Порядок</label><input type="number" name="sort" value="<?= (int)$c['sort'] ?>"></div>
        </div>
        <button class="btn btn--primary"><?= admin_icon('check') ?>Сохранить</button>
        <?php if ($edit): ?><a class="btn btn--ghost" href="<?= a_link('cms',['tab'=>'concerts']) ?>">Отмена</a><?php endif; ?>
      </form>
    </div>
    <div class="card card--pad0">
      <div style="padding:18px"><div class="section-title" style="margin:0"><h3 style="margin:0">Концерты</h3><span class="badge badge--gold"><?= $cConcerts ?></span></div></div>
      <div class="table-wrap" style="border:none"><table class="tbl"><thead><tr><th></th><th>Название</th><th>Дата</th><th></th></tr></thead><tbody>
        <?php $cons = all("SELECT * FROM concerts ORDER BY sort,id DESC"); if(!$cons): ?><tr><td colspan="4" class="muted" style="text-align:center;padding:22px">Концертов пока нет</td></tr><?php endif; ?>
        <?php foreach ($cons as $x): ?>
          <tr><td><?php if(trim((string)$x['cover'])!==''): ?><img class="cms-thumb" src="<?= h($x['cover']) ?>" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="cms-thumb cms-thumb-ph" style="display:none"><?= admin_icon('eye') ?></span><?php else: ?><span class="cms-thumb cms-thumb-ph"><?= admin_icon('eye') ?></span><?php endif; ?></td>
            <td><?= h($x['title']) ?><br><span class="small muted"><?= h($x['category'] ?: '—') ?><?php if(trim((string)$x['embed_url'])!==''): ?> · <span class="cms-embed-tag"><?= admin_icon('send') ?>видео</span><?php endif; ?></span></td>
            <td class="small"><?= h($x['date'] ?: '—') ?></td>
            <td style="white-space:nowrap"><a class="btn btn--ghost btn--sm" href="<?= a_link('cms',['tab'=>'concerts','edit'=>$x['id']]) ?>"><?= admin_icon('edit') ?></a>
            <form method="post" action="<?= url('/admin/') ?>" style="display:inline"><?= csrf_field() ?><input type="hidden" name="do" value="del_concert"><input type="hidden" name="id" value="<?= $x['id'] ?>">
              <button class="btn btn--danger btn--sm" onclick="return confirm('Удалить концерт?')"><?= admin_icon('trash') ?></button></form></td></tr>
        <?php endforeach; ?>
      </tbody></table></div>
    </div>
  </div>

<?php /* ===== ПИСЬМА МИНИСТЕРСТВ ===== */
else:
  $m = $edit ? one("SELECT * FROM ministry_letters WHERE id=?", [$edit]) : ['id'=>0,'region'=>'','title'=>'','image_path'=>'','sort'=>0]; ?>
  <div class="grid grid-2">
    <div class="card">
      <div class="section-title"><h3 style="margin:0"><?= $edit?'Редактирование письма':'Новое письмо' ?></h3><?php if($edit): ?><span class="badge badge--muted">#<?= (int)$m['id'] ?></span><?php endif; ?></div>
      <form method="post" action="<?= url('/admin/') ?>" enctype="multipart/form-data">
        <?= csrf_field() ?><input type="hidden" name="do" value="save_ministry"><input type="hidden" name="tab" value="ministry"><input type="hidden" name="id" value="<?= (int)$m['id'] ?>">
        <div class="field"><label>Регион / субъект</label><input name="region" value="<?= h($m['region']) ?>" required></div>
        <div class="field"><label>Заголовок</label><input name="title" value="<?= h($m['title']) ?>"></div>
        <div class="form-row">
          <div class="field"><label>Путь к изображению письма</label><input name="image_path" value="<?= h($m['image_path']) ?>"></div>
          <div class="field"><label>Порядок</label><input type="number" name="sort" value="<?= (int)$m['sort'] ?>"></div>
        </div>
        <div class="form-row">
          <div class="field"><label>Загрузить изображение письма <span class="muted small">(jpg/png/webp)</span></label><input type="file" name="image_file" accept=".jpg,.jpeg,.png,.webp"></div>
          <div class="field"><label>Приложить документ поддержки <span class="muted small">(pdf/doc/docx/скан)</span></label><input type="file" name="doc_file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"></div>
        </div>
        <?php if ($edit && trim((string)$m['image_path'])!==''): ?>
          <div class="field"><label>Текущее изображение</label><a href="<?= h($m['image_path']) ?>" target="_blank" rel="noopener"><img src="<?= h($m['image_path']) ?>" alt="" style="max-width:160px;border-radius:9px;border:1px solid var(--a-line)" loading="lazy"></a></div>
        <?php endif; ?>
        <?php if ($edit && trim((string)($m['doc_path'] ?? ''))!==''): ?>
          <div class="field"><label>Приложенный документ</label><a class="btn btn--ghost btn--sm" href="<?= h($m['doc_path']) ?>" target="_blank" rel="noopener"><?= admin_icon('diplomas') ?>Открыть документ поддержки</a></div>
        <?php endif; ?>
        <button class="btn btn--primary"><?= admin_icon('check') ?>Сохранить</button>
        <?php if ($edit): ?><a class="btn btn--ghost" href="<?= a_link('cms',['tab'=>'ministry']) ?>">Отмена</a><?php endif; ?>
      </form>
    </div>
    <div class="card card--pad0">
      <div style="padding:18px"><div class="section-title" style="margin:0"><h3 style="margin:0">Письма</h3><span class="badge badge--gold"><?= $cMinistry ?></span></div></div>
      <div class="table-wrap" style="border:none"><table class="tbl"><thead><tr><th></th><th>Регион</th><th>Заголовок</th><th></th></tr></thead><tbody>
        <?php $mins = all("SELECT * FROM ministry_letters ORDER BY sort, id DESC"); if(!$mins): ?><tr><td colspan="4" class="muted" style="text-align:center;padding:22px">Писем пока нет</td></tr><?php endif; ?>
        <?php foreach ($mins as $x): ?>
          <tr><td><?php if(trim((string)$x['image_path'])!==''): ?><img class="cms-thumb cms-thumb--doc" src="<?= h($x['image_path']) ?>" alt="" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="cms-thumb cms-thumb--doc cms-thumb-ph" style="display:none"><?= admin_icon('diplomas') ?></span><?php else: ?><span class="cms-thumb cms-thumb--doc cms-thumb-ph"><?= admin_icon('diplomas') ?></span><?php endif; ?></td>
            <td><b><?= h($x['region']) ?></b></td><td class="small"><?= h($x['title'] ?: '—') ?></td>
            <td style="white-space:nowrap"><a class="btn btn--ghost btn--sm" href="<?= a_link('cms',['tab'=>'ministry','edit'=>$x['id']]) ?>"><?= admin_icon('edit') ?></a>
            <form method="post" action="<?= url('/admin/') ?>" style="display:inline"><?= csrf_field() ?><input type="hidden" name="do" value="del_ministry"><input type="hidden" name="id" value="<?= $x['id'] ?>">
              <button class="btn btn--danger btn--sm" onclick="return confirm('Удалить письмо?')"><?= admin_icon('trash') ?></button></form></td></tr>
        <?php endforeach; ?>
      </tbody></table></div>
    </div>
  </div>
<?php endif; ?>
<?php
$content = ob_get_clean();
admin_layout('Контент', $content, 'cms');
