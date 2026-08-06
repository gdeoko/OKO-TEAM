<?php
/**
 * Визуальный редактор шаблона диплома (?p=diploma_editor&comp=ID).
 * Живой предпросмотр HTML-сборщика (core/diploma_html.php) в iframe + панель
 * контролов по каждому элементу (сдвиг по вертикали в мм, кегль, скрытие),
 * общий регулятор затемнения фона, перетаскивание элементов мышью/пальцем.
 * Конфиг сохраняется в competitions.diploma_template (JSON) — по нему же
 * собираются боевые дипломы и публичный образец /diploma-sample/{slug}.
 */
declare(strict_types=1);

require_once BASE_PATH . '/core/diploma_html.php';

$compId = (int) (input('comp') ?: input('competition'));

/* ---------- Сохранение конфига ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'save_diploma_tpl') {
    if (!csrf_check()) { flash('Сессия устарела, повторите.', 'error'); admin_redirect('diploma_editor', ['comp' => $compId]); }
    $cid = (int) input('competition');
    $j = json_decode((string)($_POST['tpl'] ?? ''), true);
    if (!is_array($j)) { flash('Не удалось разобрать настройки шаблона.', 'error'); admin_redirect('diploma_editor', ['comp' => $cid]); }

    $keys = ['org','legal','logos','comptype','compname','support','dtype','degree','label','name','fields','bottom'];
    $clean = ['overlay' => max(0, min(100, (int)($j['overlay'] ?? 55))),
              'fade'    => max(30, min(160, (int)($j['fade'] ?? 95))), 'els' => []];
    foreach ($keys as $k) {
        $e = $j['els'][$k] ?? null;
        if (!is_array($e)) continue;
        $ce = [];
        $dy = round((float)($e['dy'] ?? 0), 1);
        if ($dy !== 0.0) $ce['dy'] = max(-80.0, min(80.0, $dy));
        if (isset($e['fs']) && $e['fs'] !== '' && $e['fs'] !== null) {
            $fs = round((float)$e['fs'], 1);
            if ($fs >= 4 && $fs <= 90) $ce['fs'] = $fs;
        }
        if (!empty($e['hide'])) $ce['hide'] = 1;
        if ($ce) $clean['els'][$k] = $ce;
    }
    update('competitions', ['diploma_template' => json_encode($clean, JSON_UNESCAPED_UNICODE)], 'id=:wid', ['wid' => $cid]);
    audit('diploma_editor_save', 'competition', $cid, $clean);
    flash('Шаблон диплома сохранён. Боевые дипломы и образец на сайте соберутся по этим настройкам.', 'success');
    admin_redirect('diploma_editor', ['comp' => $cid]);
}

/* ---------- Сброс к настройкам по умолчанию ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'reset_diploma_tpl') {
    if (!csrf_check()) { flash('Сессия устарела, повторите.', 'error'); admin_redirect('diploma_editor', ['comp' => $compId]); }
    $cid = (int) input('competition');
    update('competitions', ['diploma_template' => ''], 'id=:wid', ['wid' => $cid]);
    audit('diploma_editor_reset', 'competition', $cid);
    flash('Настройки шаблона сброшены к значениям по умолчанию.', 'success');
    admin_redirect('diploma_editor', ['comp' => $cid]);
}

/* ---------- Живой предпросмотр для iframe (raw HTML диплома) ---------- */
if (input('preview') === '1' && $compId) {
    $c = one("SELECT * FROM competitions WHERE id=?", [$compId]);
    if (!$c) { http_response_code(404); echo 'Конкурс не найден'; exit; }
    // Несохранённые настройки передаются base64(JSON) в ?tpl= — для живого превью.
    $tplRaw = (string)($_GET['tpl'] ?? '');
    if ($tplRaw !== '') {
        $dec = json_decode((string)base64_decode(strtr($tplRaw, '-_', '+/')), true);
        if (is_array($dec)) $c['diploma_template'] = json_encode($dec, JSON_UNESCAPED_UNICODE);
    }
    echo diploma_html($c, diploma_sample_app(), [
        'sample' => true, 'edit' => true, 'thanks' => input('thanks') === '1',
    ]);
    exit;
}

/* ---------- Выбор конкурса, если не передан ---------- */
$comp = $compId ? one("SELECT * FROM competitions WHERE id=?", [$compId]) : null;
if (!$comp) {
    $rows = all("SELECT id, name, status, slug, diploma_bg, diploma_template FROM competitions ORDER BY sort, id DESC");
    ob_start(); ?>
    <div class="section-title"><h2>Редактор наград</h2></div>
    <div class="card">
      <p class="small muted" style="margin-top:0">Единый раздел наград по действующим конкурсам: макеты дипломов (основной / дополнительный / именной / благодарность),
        фото наград (кубок · статуэтка · медаль) и операции с дипломами. Выберите конкурс — откроется визуальный редактор макета.</p>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>Конкурс</th><th>Статус</th><th>Фон</th><th>Настройки</th><th style="width:340px"></th></tr></thead>
        <tbody>
        <?php foreach ($rows as $r): ?>
          <tr>
            <td><b><?= h($r['name']) ?></b><br><span class="small muted">/<?= h($r['slug']) ?></span></td>
            <td><span class="badge badge--<?= h($r['status']) ?>"><?= h(comp_status_ru($r['status'])) ?></span></td>
            <td class="small"><?= $r['diploma_bg'] ? h(basename((string)$r['diploma_bg'])) : '<span class="muted">градиент по умолчанию</span>' ?></td>
            <td class="small"><?= ($r['diploma_template'] && ($r['diploma_template'][0] ?? '') === '{') ? 'настроен' : '<span class="muted">по умолчанию</span>' ?></td>
            <td class="icon-cell" style="text-align:right;white-space:nowrap">
              <a class="btn btn--primary btn--sm" href="<?= a_link('diploma_editor', ['comp' => $r['id']]) ?>"><?= admin_icon('edit') ?>Макет диплома</a>
              <a class="btn btn--ghost btn--sm" href="<?= h(url('/diploma-sample/' . $r['slug'])) ?>" target="_blank" rel="noopener"><?= admin_icon('eye') ?>Образец</a>
              <a class="btn btn--ghost btn--sm" href="<?= a_link('competitions', ['id' => $r['id']]) ?>"><?= admin_icon('trophy') ?>Фото наград</a>
              <a class="btn btn--ghost btn--sm" href="<?= a_link('diplomas', ['competition' => $r['id']]) ?>"><?= admin_icon('diplomas') ?>Дипломы</a>
            </td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table></div>
    </div>
    <?php
    admin_layout('Редактор наград', ob_get_clean(), 'diploma_editor');
    exit;
}

/* ---------- Редактор ---------- */
$defOverlay = !empty($comp['diploma_bg']) ? 55 : 0;
$tpl = ['els' => new stdClass(), 'overlay' => $defOverlay, 'fade' => 95];
if (!empty($comp['diploma_template'])) {
    $j = json_decode((string)$comp['diploma_template'], true);
    if (is_array($j)) $tpl = ['els' => (object)($j['els'] ?? []),
        'overlay' => (int)($j['overlay'] ?? $defOverlay), 'fade' => (int)($j['fade'] ?? 95)];
}
$elements = [
    'org'      => ['Название организации', 17],
    'legal'    => ['Юридический текст', 7.5],
    'logos'    => ['Ряд гербов и логотипов', null],
    'comptype' => ['Тип конкурса', 15],
    'compname' => ['Название конкурса', 30],
    'support'  => ['Строка «При поддержке…»', 12],
    'dtype'    => ['Слово «ДИПЛОМ»', 48],
    'degree'   => ['Степень (ЛАУРЕАТ…)', 28],
    'label'    => ['Строка «награждается:»', 15],
    'name'     => ['ФИО участника', 24],
    'fields'   => ['Поля заявки', 11],
    'bottom'   => ['Подписи и печати', null],
];
$previewUrl = a_link('diploma_editor', ['comp' => $compId, 'preview' => 1]);
$sampleUrl  = url('/diploma-sample/' . $comp['slug']);

ob_start(); ?>
<style>
.de-wrap{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:18px;align-items:start}
.de-stage{background:var(--a-navy);border-radius:var(--a-radius);padding:18px;overflow:auto;position:sticky;top:70px}
.de-frame-box{margin:0 auto;transform-origin:top left}
.de-frame{width:794px;height:1123px;border:0;background:#444;border-radius:6px;box-shadow:0 12px 40px rgba(0,0,0,.5)}
.de-el{border:1px solid var(--a-line);border-radius:var(--a-radius-sm);padding:9px 11px;margin-bottom:8px;background:#fff}
.de-el__head{display:flex;align-items:center;gap:8px;font-weight:700;font-size:.84rem}
.de-el__head .mono{margin-left:auto;font-size:.72rem;color:var(--a-muted);font-weight:500}
.de-el__row{display:flex;gap:8px;margin-top:7px;align-items:center;flex-wrap:wrap}
.de-el__row label{font-size:.74rem;color:var(--a-muted);display:flex;align-items:center;gap:5px}
.de-el__row input[type=number]{width:74px;padding:5px 7px;font-size:.82rem}
.de-el.is-hidden{opacity:.55}
.de-panel .card{position:static}
.de-overlay{display:flex;align-items:center;gap:10px}
.de-overlay input[type=range]{flex:1}
.de-hint{font-size:.76rem;color:var(--a-muted);margin:8px 0 0;line-height:1.45}
@media (max-width:1100px){.de-wrap{grid-template-columns:1fr}.de-stage{position:static}}
[data-theme=dark] .de-el{background:#1c1b23;border-color:rgba(255,255,255,.1)}
</style>

<div class="toolbar">
  <a class="btn btn--ghost btn--sm" href="<?= a_link('diploma_editor') ?>"><?= admin_icon('back') ?>Другой конкурс</a>
  <a class="btn btn--ghost btn--sm" href="<?= a_link('competitions', ['action' => 'edit', 'id' => $compId]) ?>"><?= admin_icon('competitions') ?>Карточка конкурса</a>
</div>
<div class="section-title">
  <h2>Редактор наград — <?= h($comp['name']) ?></h2>
  <a class="btn btn--ghost btn--sm" href="<?= a_link('diploma_editor') ?>"><?= admin_icon('back') ?>Все конкурсы</a>
</div>

<?php
// Галерея всех наград конкурса: 4 диплома (превью) + фото наград (кубок/статуэтка/медаль).
$sbase = url('/diploma-sample/' . $comp['slug']);
$dipTypes = [
    'Основной диплом'       => $sbase,
    'Дополнительный диплом'  => $sbase . '?extra=1',
    'Именной диплом'        => $sbase . '?named=1',
    'Благодарность педагогу' => $sbase . '?thanks=1',
];
$awardDir = BASE_PATH . '/public/assets/img/awards/' . (int)$comp['id'] . '/';
$awardPhotos = is_dir($awardDir) ? array_values(array_filter(scandir($awardDir) ?: [], fn($f) => preg_match('~\.(png|jpe?g|webp)$~i', $f))) : [];
?>
<div class="card" style="margin-bottom:16px">
  <div class="section-title" style="margin-bottom:8px"><h3>Все награды конкурса — открыть и посмотреть</h3></div>
  <p class="small muted" style="margin:-4px 0 12px">Дипломы (основной / дополнительный / именной / благодарность) собираются по макету ниже — нажмите, чтобы открыть образец каждого. Фото наград (кубок · статуэтка · медаль) — загрузка в «Конкурсы».</p>
  <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px">
    <?php foreach ($dipTypes as $lbl => $u): ?>
      <a href="<?= h($u) ?>" target="_blank" rel="noopener" style="display:block;border:1px solid var(--a-line);border-radius:12px;overflow:hidden;text-decoration:none;background:#fff">
        <div style="aspect-ratio:1.414/1;overflow:hidden;background:#f4f4f4"><iframe src="<?= h($u) ?>" style="width:283%;height:283%;transform:scale(.353);transform-origin:top left;border:0;pointer-events:none"></iframe></div>
        <div style="padding:8px 10px;font-size:.82rem;font-weight:700;color:var(--a-navy)"><?= h($lbl) ?></div>
      </a>
    <?php endforeach; ?>
    <?php foreach ($awardPhotos as $ph): ?>
      <a href="<?= h(url('/assets/img/awards/' . (int)$comp['id'] . '/' . $ph)) ?>" target="_blank" rel="noopener" style="display:block;border:1px solid var(--a-line);border-radius:12px;overflow:hidden;text-decoration:none;background:#fff">
        <div style="aspect-ratio:1.414/1;overflow:hidden;background:#f4f4f4;display:flex;align-items:center;justify-content:center"><img src="<?= h(url('/assets/img/awards/' . (int)$comp['id'] . '/' . $ph)) ?>" style="max-width:100%;max-height:100%;object-fit:contain"></div>
        <div style="padding:8px 10px;font-size:.82rem;font-weight:700;color:var(--a-navy)"><?= h(pathinfo($ph, PATHINFO_FILENAME)) ?></div>
      </a>
    <?php endforeach; ?>
    <a href="<?= a_link('competitions', ['id'=>(int)$comp['id']]) ?>" style="display:flex;align-items:center;justify-content:center;border:1px dashed var(--a-line);border-radius:12px;min-height:120px;text-decoration:none;color:var(--a-navy);font-weight:700;font-size:.85rem;text-align:center;padding:10px">+ Загрузить / изменить<br>фото наград</a>
  </div>
</div>

<div class="de-wrap">
  <div class="de-stage">
    <div class="de-frame-box" id="deFrameBox">
      <iframe class="de-frame" id="deFrame" src="<?= h($previewUrl) ?>"></iframe>
    </div>
  </div>

  <div class="de-panel">
    <div class="card" style="margin-bottom:14px">
      <div class="card__head" style="margin-bottom:10px"><?= admin_icon('settings') ?><h3>Фон</h3></div>
      <div class="field" style="margin-bottom:6px"><label>Затемнение фона сверху: <b id="deOverlayVal"><?= (int)$tpl['overlay'] ?></b>%</label>
        <div class="de-overlay"><input type="range" id="deOverlay" min="0" max="100" step="5" value="<?= (int)$tpl['overlay'] ?>"></div>
      </div>
      <div class="field" style="margin-bottom:6px"><label>Засвет снизу (зона подписей): <b id="deFadeVal"><?= (int)$tpl['fade'] ?></b> мм</label>
        <div class="de-overlay"><input type="range" id="deFade" min="30" max="160" step="5" value="<?= (int)$tpl['fade'] ?>"></div>
      </div>
      <p class="de-hint">Картинка фона задаётся в карточке конкурса (файл А4).
        Текущий: <b><?= $comp['diploma_bg'] ? h(basename((string)$comp['diploma_bg'])) : 'градиент по умолчанию' ?></b></p>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="card__head" style="margin-bottom:10px"><?= admin_icon('edit') ?><h3>Элементы</h3></div>
      <p class="de-hint" style="margin:0 0 10px">Сдвиг — в миллиметрах (минус — вверх). Элементы можно перетаскивать
        прямо на макете. Кегль пустой — размер по умолчанию.</p>
      <div id="deEls">
        <?php foreach ($elements as $key => [$label, $baseFs]): ?>
        <div class="de-el" data-key="<?= $key ?>">
          <div class="de-el__head"><?= h($label) ?><span class="mono"><?= $baseFs !== null ? $baseFs . ' pt' : '' ?></span></div>
          <div class="de-el__row">
            <label>Сдвиг, мм <input type="number" step="0.5" min="-80" max="80" class="de-dy" value=""></label>
            <?php if ($baseFs !== null): ?>
            <label>Кегль, pt <input type="number" step="0.5" min="4" max="90" class="de-fs" placeholder="<?= $baseFs ?>" value=""></label>
            <?php endif; ?>
            <label><input type="checkbox" class="de-hide"> скрыть</label>
          </div>
        </div>
        <?php endforeach; ?>
      </div>
    </div>

    <div class="card">
      <form method="post" action="<?= url('/admin/') ?>" id="deSaveForm">
        <?= csrf_field() ?>
        <input type="hidden" name="do" value="save_diploma_tpl">
        <input type="hidden" name="competition" value="<?= $compId ?>">
        <input type="hidden" name="tpl" id="deTplJson" value="">
        <div class="toolbar" style="margin:0;flex-wrap:wrap;gap:8px">
          <button class="btn btn--primary"><?= admin_icon('check') ?>Сохранить шаблон</button>
          <a class="btn btn--ghost btn--sm" href="<?= h($sampleUrl) ?>" target="_blank" rel="noopener"><?= admin_icon('eye') ?>Демо-образец</a>
          <button type="button" class="btn btn--ghost btn--sm" id="deThanks">Благодарность</button>
        </div>
      </form>
      <form method="post" action="<?= url('/admin/') ?>" style="margin-top:10px"
            onsubmit="return confirm('Сбросить все настройки макета этого конкурса?')">
        <?= csrf_field() ?>
        <input type="hidden" name="do" value="reset_diploma_tpl">
        <input type="hidden" name="competition" value="<?= $compId ?>">
        <button class="btn btn--danger btn--sm"><?= admin_icon('x') ?>Сбросить настройки</button>
      </form>
      <p class="de-hint">Сохранённые настройки применяются к боевым дипломам, демо-образцу на сайте и в наградах.</p>
    </div>
  </div>
</div>

<script>
(function(){
  var TPL = <?= json_encode($tpl, JSON_UNESCAPED_UNICODE) ?>;
  if (!TPL.els || Array.isArray(TPL.els)) TPL.els = {};
  var BASE_FS = <?= json_encode(array_map(fn($e) => $e[1], $elements)) ?>;
  var MM = 96/25.4; // px в 1 мм при 96dpi (внутри iframe масштаб 1:1)
  var frame = document.getElementById('deFrame');
  var thanksMode = false;

  /* ---- масштаб предпросмотра под ширину колонки ---- */
  function fit(){
    var box = document.getElementById('deFrameBox');
    var stage = box.parentElement;
    var w = stage.clientWidth - 36;
    var k = Math.min(1, w/794);
    box.style.transform = 'scale(' + k + ')';
    box.style.width = '794px';
    stage.style.height = (1123*k + 36) + 'px';
  }
  window.addEventListener('resize', fit); fit();

  /* ---- применение конфига к живому DOM iframe ---- */
  function el(key){ var d = frame.contentDocument; return d ? d.querySelector('[data-el="'+key+'"]') : null; }
  function applyEl(key){
    var n = el(key); if (!n) return;
    var c = TPL.els[key] || {};
    var t = (c.dy ? 'translateY(' + c.dy + 'mm)' : '');
    n.style.transform = t;
    n.style.fontSize = (c.fs ? c.fs + 'pt' : '');
    n.style.display = c.hide ? 'none' : '';
  }
  function applyOverlay(){
    var d = frame.contentDocument; if (!d) return;
    var tone = d.querySelector('.bg-tone');
    var o = (TPL.overlay===undefined?55:TPL.overlay)/100;
    if (tone) tone.style.background = 'linear-gradient(180deg, rgba(8,12,28,'+(o*.66).toFixed(2)+') 0%, rgba(8,12,28,'+(o*.46).toFixed(2)+') 40%, rgba(8,12,28,'+(o*.22).toFixed(2)+') 60%, rgba(8,12,28,0) 72%)';
    var wg = d.querySelector('.bg-white-gradient');
    if (wg) wg.style.height = (TPL.fade===undefined?95:TPL.fade) + 'mm';
  }
  function applyAll(){ Object.keys(BASE_FS).forEach(applyEl); applyOverlay(); }

  /* ---- панель -> конфиг ---- */
  function ensure(key){ if (!TPL.els[key]) TPL.els[key] = {}; return TPL.els[key]; }
  function cleanup(key){
    var c = TPL.els[key]; if (!c) return;
    if (!c.dy) delete c.dy;
    if (!c.fs) delete c.fs;
    if (!c.hide) delete c.hide;
    if (!Object.keys(c).length) delete TPL.els[key];
  }
  document.querySelectorAll('.de-el').forEach(function(row){
    var key = row.dataset.key;
    var c = TPL.els[key] || {};
    var dy = row.querySelector('.de-dy'), fs = row.querySelector('.de-fs'), hd = row.querySelector('.de-hide');
    if (c.dy) dy.value = c.dy;
    if (fs && c.fs) fs.value = c.fs;
    if (c.hide) { hd.checked = true; row.classList.add('is-hidden'); }
    dy.addEventListener('input', function(){
      ensure(key).dy = parseFloat(dy.value) || 0; cleanup(key); applyEl(key);
    });
    if (fs) fs.addEventListener('input', function(){
      var v = parseFloat(fs.value);
      if (v) ensure(key).fs = v; else if (TPL.els[key]) delete TPL.els[key].fs;
      cleanup(key); applyEl(key);
    });
    hd.addEventListener('change', function(){
      if (hd.checked) ensure(key).hide = 1; else if (TPL.els[key]) delete TPL.els[key].hide;
      row.classList.toggle('is-hidden', hd.checked);
      cleanup(key); applyEl(key);
    });
  });
  var ov = document.getElementById('deOverlay'), ovVal = document.getElementById('deOverlayVal');
  ov.addEventListener('input', function(){
    TPL.overlay = parseInt(ov.value, 10); ovVal.textContent = ov.value; applyOverlay();
  });
  var fd = document.getElementById('deFade'), fdVal = document.getElementById('deFadeVal');
  fd.addEventListener('input', function(){
    TPL.fade = parseInt(fd.value, 10); fdVal.textContent = fd.value; applyOverlay();
  });

  /* ---- перетаскивание элементов на макете ---- */
  function bindDrag(){
    var d = frame.contentDocument; if (!d) return;
    d.querySelectorAll('[data-el]').forEach(function(n){
      n.style.touchAction = 'none';
      n.addEventListener('pointerdown', function(ev){
        ev.preventDefault();
        var key = n.dataset.el;
        var startY = ev.clientY;
        var startDy = (TPL.els[key] && TPL.els[key].dy) || 0;
        function move(e){
          var dyMm = Math.round(((e.clientY - startY)/MM + startDy)*2)/2;
          dyMm = Math.max(-80, Math.min(80, dyMm));
          ensure(key).dy = dyMm; cleanup(key); applyEl(key);
          var inp = document.querySelector('.de-el[data-key="'+key+'"] .de-dy');
          if (inp) inp.value = (TPL.els[key] && TPL.els[key].dy) || 0;
        }
        function up(){ d.removeEventListener('pointermove', move); d.removeEventListener('pointerup', up); }
        d.addEventListener('pointermove', move);
        d.addEventListener('pointerup', up);
      });
    });
  }
  frame.addEventListener('load', function(){ applyAll(); bindDrag(); });

  /* ---- переключение ДИПЛОМ / БЛАГОДАРНОСТЬ ---- */
  document.getElementById('deThanks').addEventListener('click', function(){
    thanksMode = !thanksMode;
    this.textContent = thanksMode ? 'Диплом' : 'Благодарность';
    frame.src = <?= json_encode($previewUrl, JSON_UNESCAPED_SLASHES) ?> + (thanksMode ? '&thanks=1' : '');
  });

  /* ---- сохранение ---- */
  document.getElementById('deSaveForm').addEventListener('submit', function(){
    document.getElementById('deTplJson').value = JSON.stringify(TPL);
  });
})();
</script>
<?php
admin_layout('Редактор диплома', ob_get_clean(), 'diploma_editor');
