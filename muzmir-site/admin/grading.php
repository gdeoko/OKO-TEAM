<?php
/** Жюри-режим: видео, 10-балльная шкала, автопереход, заметки, пересчёт результата. */
declare(strict_types=1);
require_once BASE_PATH . '/core/jury.php';
jury_ensure_schema();

/** Пытается собрать embed-URL для видео. Иначе null (покажем кнопку «Открыть»). */
function grading_embed(string $url): ?string {
    if (preg_match('#rutube\.ru/(?:video|play/embed)/([a-z0-9]+)#i', $url, $m)) return 'https://rutube.ru/play/embed/' . $m[1];
    if (preg_match('#drive\.google\.com/file/d/([^/]+)#', $url, $m)) return 'https://drive.google.com/file/d/' . $m[1] . '/preview';
    if (preg_match('#vkvideo\.ru/video(-?\d+_\d+)#', $url, $m) || preg_match('#vk\.com/video(-?\d+_\d+)#', $url, $m)) {
        [$oid, $vid] = explode('_', $m[1]);
        return 'https://vk.com/video_ext.php?oid=' . $oid . '&id=' . $vid;
    }
    return null;
}

/** Пересчёт итогового балла заявки как среднего оценок жюри. */
function recalc_score(int $appId): void {
    $avg = scalar("SELECT AVG(score) FROM jury_grades WHERE application_id=?", [$appId]);
    if ($avg === null) return;
    $avg = round((float)$avg, 2);
    q("UPDATE applications SET score=?, result=?, status='graded' WHERE id=?",
      [$avg, score_to_result($avg), $appId]);
}

/** Очередь на оценку (с учётом фильтра по конкурсу). */
function grading_queue(int $comp = 0): array {
    $w = "a.status IN ('paid','judging')";
    $a = [];
    if ($comp) { $w .= " AND a.competition_id=?"; $a[] = $comp; }
    return all("SELECT a.id FROM applications a WHERE $w ORDER BY a.id", $a);
}

/** Сколько заявок текущей очереди жюри уже оценило (для прогресс-бара). */
function grading_done_count(string $mode, int $jid, int $comp = 0): int {
    if ($mode === 'mine') {
        return (int) scalar(
            "SELECT COUNT(*) FROM jury_assignments ja JOIN applications a ON a.id=ja.application_id
             WHERE ja.jury_id=? AND ja.done=1" . ($comp ? " AND a.competition_id=?" : ""),
            $comp ? [$jid, $comp] : [$jid]);
    }
    return (int) scalar(
        "SELECT COUNT(*) FROM applications a JOIN jury_grades g ON g.application_id=a.id AND g.jury_id=?
         WHERE a.status IN ('paid','judging')" . ($comp ? " AND a.competition_id=?" : ""),
        $comp ? [$jid, $comp] : [$jid]);
}

$comp = (int) input('competition');
$mode = input('mode') === 'mine' ? 'mine' : '';

/* ---------- Автораспределение жюри по конкурсу (owner/admin) ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'autoassign') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('grading', array_filter(['competition'=>$comp])); }
    if (!user_can('admin')) { flash('Автораспределение жюри доступно администратору и владельцу.', 'error'); admin_redirect('grading', array_filter(['competition'=>$comp])); }
    $cid = (int) input('competition');
    if (!$cid) { flash('Выберите конкурс для автораспределения.', 'error'); admin_redirect('grading'); }
    $res = jury_autoassign($cid);
    if (!$res['ok']) {
        flash($res['error'] ?? 'Не удалось выполнить автораспределение.', 'error');
    } else {
        $msg = 'Назначено оценок жюри: ' . $res['assignments_created'] . ' (заявок в конкурсе: ' . $res['applications_total'] . ').';
        if ($res['insufficient']) {
            $msg .= ' Не хватило жюри без конфликта интересов для ' . count($res['insufficient']) . ' заявок.';
        }
        audit('grading_autoassign', 'competition', $cid, ['created' => $res['assignments_created']]);
        flash($msg, $res['insufficient'] ? 'warning' : 'success');
    }
    admin_redirect('grading', ['competition' => $cid]);
}

/* ---------- Сохранение оценки ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'grade') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('grading'); }
    $appId = (int) input('id');
    $score = (float) input('score');
    $note  = trim(input('note'));
    $jid   = (int) (current_user()['id'] ?? 0);
    if ($appId && $score >= 1 && $score <= 10) {
        // одна оценка на пару (жюри, заявка) — обновляем существующую
        $ex = one("SELECT id FROM jury_grades WHERE application_id=? AND jury_id=?", [$appId, $jid]);
        if ($ex) {
            update('jury_grades', ['score'=>$score,'note'=>$note], 'id=:wid', ['wid'=>$ex['id']]);
        } else {
            insert('jury_grades', ['application_id'=>$appId,'jury_id'=>$jid,'score'=>$score,'note'=>$note]);
        }
        recalc_score($appId);
        q("UPDATE jury_assignments SET done=1 WHERE application_id=? AND jury_id=?", [$appId, $jid]);
        audit('grade', 'application', $appId, ['score'=>$score]);
        flash('Оценка сохранена: ' . $score . ' балла.', 'success');
        // автопереход к следующему в очереди (с учётом текущего режима «мои назначенные»)
        $queue = $mode === 'mine' ? jury_assigned_queue($jid, $comp) : grading_queue($comp);
        $next = null;
        foreach ($queue as $row) { if ((int)$row['id'] > $appId) { $next = (int)$row['id']; break; } }
        if ($next) admin_redirect('grading', array_filter(['id'=>$next,'competition'=>$comp,'mode'=>$mode]));
        admin_redirect('grading', array_filter(['competition'=>$comp,'mode'=>$mode]));
    }
    admin_redirect('grading', array_filter(['id'=>$appId,'competition'=>$comp,'mode'=>$mode]));
}

/* ---------- Массовое оценивание ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'bulk_grade') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('grading'); }
    $ids = array_map('intval', $_POST['ids'] ?? []);
    $score = (float) input('score');
    $jid = (int) (current_user()['id'] ?? 0);
    if ($ids && $score >= 1 && $score <= 10) {
        foreach ($ids as $appId) {
            $ex = one("SELECT id FROM jury_grades WHERE application_id=? AND jury_id=?", [$appId, $jid]);
            if ($ex) update('jury_grades', ['score'=>$score], 'id=:wid', ['wid'=>$ex['id']]);
            else insert('jury_grades', ['application_id'=>$appId,'jury_id'=>$jid,'score'=>$score]);
            recalc_score($appId);
            q("UPDATE jury_assignments SET done=1 WHERE application_id=? AND jury_id=?", [$appId, $jid]);
        }
        audit('grade_bulk', 'application', null, ['score'=>$score,'count'=>count($ids)]);
        flash('Оценено заявок: ' . count($ids) . '.', 'success');
    }
    admin_redirect('grading', array_filter(['competition'=>$comp,'mode'=>$mode]));
}

/* ================= РЕЖИМ ОДНОЙ ЗАЯВКИ (быстрый жюри-режим) ================= */
if ($id = (int) input('id')) {
    $a = one("SELECT a.*, c.name comp FROM applications a
              LEFT JOIN competitions c ON c.id=a.competition_id WHERE a.id=?", [$id]);
    if (!$a) { flash('Заявка не найдена.', 'error'); admin_redirect('grading'); }
    $jid = (int) (current_user()['id'] ?? 0);
    $my = one("SELECT * FROM jury_grades WHERE application_id=? AND jury_id=?", [$id, $jid]);
    $embed = $a['video_url'] ? grading_embed($a['video_url']) : null;

    $queue = $mode === 'mine' ? jury_assigned_queue($jid, $comp) : grading_queue($comp);
    $pos = 0; $total = count($queue); $nextId = null; $prevId = null;
    foreach ($queue as $i => $row) {
        if ((int)$row['id'] === $id) {
            $pos = $i + 1;
            $nextId = isset($queue[$i+1]) ? (int)$queue[$i+1]['id'] : null;
            $prevId = isset($queue[$i-1]) ? (int)$queue[$i-1]['id'] : null;
        }
    }
    // Прогресс очереди
    $doneCount = grading_done_count($mode, $jid, $comp);
    $remaining = max(0, $total - $doneCount);
    $pct = $total ? (int) round($doneCount / $total * 100) : 0;

    // Легенда «балл → звание» (строим из score_to_result, группируем одинаковые звания в диапазоны)
    $legend = []; for ($n = 1; $n <= 10; $n++) $legend[$n] = score_to_result((float)$n);
    $legendGroups = []; $prevTitle = null;
    for ($n = 1; $n <= 10; $n++) {
        $t = $legend[$n];
        if ($t !== $prevTitle) { $legendGroups[] = ['from'=>$n,'to'=>$n,'title'=>$t]; $prevTitle = $t; }
        else { $legendGroups[count($legendGroups)-1]['to'] = $n; }
    }

    $nextUrl = $nextId ? a_link('grading', array_filter(['id'=>$nextId,'competition'=>$comp,'mode'=>$mode])) : '';
    $prevUrl = $prevId ? a_link('grading', array_filter(['id'=>$prevId,'competition'=>$comp,'mode'=>$mode])) : '';

    ob_start(); ?>
    <style>
    .jury-fast .jf-topbar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-bottom:14px}
    .jury-fast .jf-progress{flex:1;min-width:200px}
    .jury-fast .jf-progress .jf-labels{display:flex;justify-content:space-between;font-size:.82rem;color:var(--a-muted);margin-bottom:5px;gap:10px;flex-wrap:wrap}
    .jury-fast .jf-progress .jf-labels b{color:var(--a-ink)}
    .jury-fast .jf-track{height:9px;border-radius:6px;background:var(--a-line);overflow:hidden}
    .jury-fast .jf-fill{height:100%;background:var(--grad-gold);border-radius:6px;transition:width .35s ease}
    .jury-fast .pill-scale button{width:56px;height:56px;font-size:1.35rem;font-weight:800}
    .jury-fast .jf-verdict{margin-top:14px;min-height:30px;font-family:var(--ff-display,Georgia,serif);font-size:1.15rem;font-weight:800;
      color:var(--a-gold,#8B6F1F);opacity:0;transform:translateY(4px);transition:.18s}
    .jury-fast .jf-verdict.show{opacity:1;transform:none}
    .jury-fast .jf-legend{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}
    .jury-fast .jf-legend .lg{display:inline-flex;align-items:center;gap:6px;font-size:.76rem;padding:4px 9px;border-radius:999px;
      background:#faf6ea;border:1px solid var(--a-line);color:var(--a-ink)}
    .jury-fast .jf-legend .lg i{font-style:normal;font-weight:800;color:var(--a-gold,#8B6F1F);min-width:30px;text-align:center}
    .jury-fast .jf-hotkeys{display:flex;flex-wrap:wrap;gap:8px 14px;margin-top:14px;padding-top:12px;border-top:1px dashed var(--a-line);font-size:.8rem;color:var(--a-muted)}
    .jury-fast .jf-hotkeys span{display:inline-flex;align-items:center;gap:6px}
    .jury-fast kbd{font-family:ui-monospace,Menlo,monospace;font-size:.72rem;line-height:1;padding:4px 7px;border-radius:6px;
      background:#fff;border:1px solid var(--a-line);box-shadow:0 1px 0 var(--a-line);color:var(--a-ink);min-width:16px;text-align:center}
    .jury-fast .jf-overlay{position:fixed;inset:0;background:rgba(12,10,13,.55);display:none;align-items:center;justify-content:center;z-index:120}
    .jury-fast .jf-overlay.show{display:flex}
    .jury-fast .jf-overlay .box{background:#fff;border-radius:18px;padding:26px 34px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.35);min-width:220px}
    .jury-fast .jf-overlay .num{font-family:var(--ff-display,Georgia,serif);font-size:3.4rem;font-weight:900;line-height:1;color:var(--a-gold,#8B6F1F)}
    .jury-fast .jf-overlay .ttl{margin-top:6px;font-weight:800;color:var(--a-ink)}
    .jury-fast .jf-overlay .hint{margin-top:10px;font-size:.78rem;color:var(--a-muted)}
    @media (max-width:640px){ .jury-fast .pill-scale button{width:48px;height:48px;font-size:1.2rem} }
    @media (prefers-reduced-motion:reduce){ .jury-fast .jf-fill,.jury-fast .jf-verdict{transition:none} }
    </style>
    <div class="jury-fast">
    <div class="jf-topbar">
      <a class="btn btn--ghost btn--sm" href="<?= a_link('grading', array_filter(['competition'=>$comp,'mode'=>$mode])) ?>"><?= admin_icon('back') ?>К очереди</a>
      <div class="jf-progress">
        <div class="jf-labels">
          <span>Оценено <b><?= $doneCount ?></b> · осталось <b><?= $remaining ?></b> из <?= $total ?></span>
          <?php if ($pos): ?><span>Позиция <b><?= $pos ?></b>/<?= $total ?> · <?= $pct ?>%</span><?php endif; ?>
        </div>
        <div class="jf-track"><div class="jf-fill" style="width:<?= $pct ?>%"></div></div>
      </div>
      <?php if ($prevId): ?><a class="btn btn--ghost btn--sm" href="<?= $prevUrl ?>">← Назад</a><?php endif; ?>
      <?php if ($nextId): ?><a class="btn btn--navy btn--sm" href="<?= $nextUrl ?>">Пропустить →</a><?php endif; ?>
    </div>

    <div class="grid grid-2">
      <div class="card card--pad0" style="padding:14px">
        <?php if ($embed): ?>
          <div class="video-frame"><iframe src="<?= h($embed) ?>" allowfullscreen allow="autoplay; encrypted-media"></iframe></div>
        <?php elseif ($a['video_url']): ?>
          <div class="empty"><?= admin_icon('eye') ?><p>Это видео нельзя встроить напрямую.</p>
            <a class="btn btn--navy" href="<?= h($a['video_url']) ?>" target="_blank" rel="noopener">Открыть видео в новой вкладке</a></div>
        <?php else: ?>
          <div class="empty"><p class="muted">Ссылка на видео отсутствует.</p></div>
        <?php endif; ?>
        <div style="padding:12px 6px 4px">
          <b><?= h($a['is_group'] ? $a['group_name'] : $a['full_name']) ?></b> · <?= h($a['work_title']) ?><br>
          <span class="small muted"><?= h($a['comp']) ?> · <?= h($a['nomination']) ?> · <?= h($a['age_category']) ?> · <?= h($a['formation']) ?></span>
        </div>
      </div>

      <div class="card">
        <h3>Оценка</h3>
        <p class="small muted">Нажмите клавишу <kbd>1</kbd>–<kbd>9</kbd> (<kbd>0</kbd> = 10) — балл сохранится и откроется следующая заявка автоматически.</p>
        <form method="post" action="<?= url('/admin/?p=grading') ?>" id="gradeForm">
          <?= csrf_field() ?><input type="hidden" name="p" value="grading"><input type="hidden" name="do" value="grade"><input type="hidden" name="id" value="<?= $id ?>">
          <input type="hidden" name="competition" value="<?= $comp ?>"><input type="hidden" name="mode" value="<?= h($mode) ?>"><input type="hidden" name="score" id="scoreInput" value="<?= h((string)($my['score'] ?? '')) ?>">
          <div class="pill-scale" id="scale">
            <?php for ($n=1;$n<=10;$n++): ?>
              <button type="button" class="<?= ($my && (float)$my['score']==$n)?'on':'' ?>" data-score="<?= $n ?>" title="<?= h($legend[$n]) ?>"><?= $n ?></button>
            <?php endfor; ?>
          </div>
          <div class="jf-verdict" id="jfVerdict" aria-live="polite"></div>
          <div class="jf-legend">
            <?php foreach ($legendGroups as $g): ?>
              <span class="lg"><i><?= $g['from']===$g['to'] ? $g['from'] : $g['from'].'-'.$g['to'] ?></i><?= h($g['title']) ?></span>
            <?php endforeach; ?>
          </div>
          <div class="field" style="margin-top:16px">
            <label>Приватная заметка (видит только жюри) — клавиша <kbd>N</kbd></label>
            <textarea name="note" placeholder="Комментарий для внутренней работы"><?= h($my['note'] ?? '') ?></textarea>
          </div>
          <div class="field--inline">
            <button class="btn btn--primary"><?= admin_icon('check') ?>Сохранить и далее</button>
            <?php if ($my): ?><span class="badge badge--gold">Ваша оценка: <?= h((string)$my['score']) ?> → <?= h(score_to_result((float)$my['score'])) ?></span><?php endif; ?>
          </div>
          <div class="jf-hotkeys">
            <span><kbd>1</kbd>–<kbd>9</kbd>,<kbd>0</kbd> балл</span>
            <span><kbd>Enter</kbd> сохранить</span>
            <span><kbd>Esc</kbd> отмена</span>
            <span><kbd>→</kbd>/<kbd>Space</kbd> пропустить</span>
            <span><kbd>←</kbd> назад</span>
            <span><kbd>N</kbd> заметка</span>
          </div>
        </form>
        <hr>
        <h4>Текущий итог заявки</h4>
        <div class="kv">
          <dt>Средний балл</dt><dd><?= $a['score']!==null ? '<b>'.h((string)$a['score']).'</b>' : '—' ?></dd>
          <dt>Результат</dt><dd><?= $a['result'] ? '<span class="badge badge--gold">'.h($a['result']).'</span>' : '—' ?></dd>
        </div>
      </div>
    </div>

    <div class="jf-overlay" id="jfOverlay">
      <div class="box">
        <div class="num" id="jfOvNum">–</div>
        <div class="ttl" id="jfOvTitle">Сохранение…</div>
        <div class="hint"><kbd>Esc</kbd> — отменить</div>
      </div>
    </div>

    <?php
      $myVideo = one("SELECT * FROM jury_video WHERE application_id=? AND jury_id=?", [$id, $jid]);
      $allVideos = all("SELECT jv.*, u.full_name jname FROM jury_video jv LEFT JOIN users u ON u.id=jv.jury_id
                        WHERE jv.application_id=? ORDER BY jv.created_at DESC", [$id]);
    ?>
    <div class="card" style="margin-top:18px">
      <h3>Видеорецензия жюри</h3>
      <p class="small muted">Короткий видеокомментарий (30-60 секунд, mp4). Файл прикрепится к диплому участника автоматически.</p>
      <?php if ($myVideo): ?>
        <p class="small"><span class="badge badge--paid">Ваша рецензия загружена</span>
          <a href="<?= h(url($myVideo['path'])) ?>" target="_blank" rel="noopener">открыть видео</a>
          · <?= h(date('d.m.y H:i', strtotime($myVideo['created_at']))) ?> — загрузите новый файл, чтобы заменить.</p>
      <?php endif; ?>
      <form id="videoReviewForm" enctype="multipart/form-data">
        <?= csrf_field() ?>
        <input type="hidden" name="application_id" value="<?= $id ?>">
        <div class="field--inline">
          <input type="file" name="video" accept="video/mp4,.mp4" required>
          <button type="submit" class="btn btn--navy btn--sm"><?= admin_icon('send') ?>Загрузить рецензию</button>
        </div>
        <p class="err-msg" id="videoReviewMsg" style="display:none;margin-top:8px"></p>
      </form>
      <?php if ($allVideos): ?>
        <hr>
        <p class="small muted" style="margin-bottom:6px">Все рецензии по заявке:</p>
        <ul class="small" style="margin:0;padding-left:18px">
          <?php foreach ($allVideos as $v): ?>
            <li><?= h($v['jname'] ?: ('Жюри #' . $v['jury_id'])) ?> —
              <a href="<?= h(url($v['path'])) ?>" target="_blank" rel="noopener">видео</a>
              (<?= h(date('d.m.y H:i', strtotime($v['created_at']))) ?>)</li>
          <?php endforeach; ?>
        </ul>
      <?php endif; ?>
    </div>
    </div><!-- /.jury-fast -->
    <script>
    (function(){
      var vform=document.getElementById('videoReviewForm');
      if (vform) {
        vform.addEventListener('submit', function(e){
          e.preventDefault();
          var msg=document.getElementById('videoReviewMsg');
          msg.style.display='none'; msg.textContent='';
          var fd=new FormData(vform);
          fetch('<?= url('/api/v1/jury_video.php') ?>', {method:'POST', body:fd, credentials:'same-origin'})
            .then(function(r){ return r.json(); })
            .then(function(d){
              if (d.ok) { location.reload(); }
              else { msg.textContent = d.error || 'Не удалось загрузить видео.'; msg.style.display='block'; }
            })
            .catch(function(){ msg.textContent='Ошибка сети при загрузке видео.'; msg.style.display='block'; });
        });
      }
    })();
    </script>
    <script>
    (function(){
      var input=document.getElementById('scoreInput'), form=document.getElementById('gradeForm');
      var verdict=document.getElementById('jfVerdict');
      var overlay=document.getElementById('jfOverlay'), ovNum=document.getElementById('jfOvNum'), ovTitle=document.getElementById('jfOvTitle');
      var note=form ? form.querySelector('textarea') : null;
      var legend=<?= json_encode($legend, JSON_UNESCAPED_UNICODE) ?>;
      var nextUrl=<?= json_encode($nextUrl) ?>, prevUrl=<?= json_encode($prevUrl) ?>;
      var pending=null;

      function showVerdict(n){
        if(!verdict) return;
        verdict.textContent = n + ' - ' + (legend[n] || '');
        verdict.classList.add('show');
      }
      function select(n){
        document.querySelectorAll('#scale button').forEach(function(x){ x.classList.toggle('on', x.dataset.score===String(n)); });
        input.value=n; showVerdict(n);
      }
      function cancelPending(){
        if(pending){ clearTimeout(pending); pending=null; }
        if(overlay) overlay.classList.remove('show');
      }
      // Балл → выбор + мгновенный автопереход (короткое окно на отмену клавишей Esc).
      function grade(n){
        select(n);
        cancelPending();
        if(overlay){ ovNum.textContent=n; ovTitle.textContent=legend[n]||'Сохранение…'; overlay.classList.add('show'); }
        pending=setTimeout(function(){ form.submit(); }, 300);
      }

      document.querySelectorAll('#scale button').forEach(function(b){
        b.addEventListener('click', function(){ grade(b.dataset.score); });
        b.addEventListener('mouseenter', function(){ showVerdict(b.dataset.score); });
      });

      document.addEventListener('keydown', function(e){
        if(e.key==='Escape'){ cancelPending(); if(document.activeElement && document.activeElement.blur) document.activeElement.blur(); return; }
        var typing = e.target.tagName==='TEXTAREA' || e.target.tagName==='INPUT';
        if(typing) return;
        var n=null;
        if(e.key>='1' && e.key<='9') n=e.key; else if(e.key==='0') n='10';
        if(n){ e.preventDefault(); grade(n); return; }
        if(e.key==='Enter'){ if(input.value){ e.preventDefault(); cancelPending(); form.submit(); } return; }
        if((e.key==='n'||e.key==='N'||e.key==='т'||e.key==='Т') && note){ e.preventDefault(); note.focus(); return; }
        if((e.key===' '||e.key==='ArrowRight') && nextUrl){ e.preventDefault(); location.href=nextUrl; return; }
        if(e.key==='ArrowLeft' && prevUrl){ e.preventDefault(); location.href=prevUrl; return; }
      });

      <?php if ($my): ?>showVerdict('<?= h((string)(int)$my['score']) ?>');<?php endif; ?>
    })();
    </script>
    <?php
    $content = ob_get_clean();
    admin_layout('Оценивание', $content, 'grading');
    exit;
}

/* ================= ОЧЕРЕДЬ ================= */
$comps = all("SELECT id,name FROM competitions WHERE status IN ('open','judging') ORDER BY sort,name");
$jid = (int) (current_user()['id'] ?? 0);

if ($mode === 'mine') {
    $w = "ja.jury_id=?"; $args = [$jid];
    if ($comp) { $w .= " AND a.competition_id=?"; $args[] = $comp; }
    $rows = all("SELECT a.*, c.name comp, ja.done assigned_done,
                 (SELECT COUNT(*) FROM jury_grades g WHERE g.application_id=a.id AND g.jury_id=?) mine
                 FROM jury_assignments ja
                 JOIN applications a ON a.id=ja.application_id
                 LEFT JOIN competitions c ON c.id=a.competition_id
                 WHERE $w ORDER BY a.id LIMIT 300", array_merge([$jid], $args));
} else {
    $w = "a.status IN ('paid','judging')"; $args = [];
    if ($comp) { $w .= " AND a.competition_id=?"; $args[] = $comp; }
    $rows = all("SELECT a.*, c.name comp,
                 (SELECT COUNT(*) FROM jury_grades g WHERE g.application_id=a.id AND g.jury_id=?) mine
                 FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id
                 WHERE $w ORDER BY a.id LIMIT 300", array_merge([$jid], $args));
}

$juryStats = ($comp && user_can('moderator')) ? jury_competition_stats($comp) : [];

// Прогресс очереди: сколько уже оценено этим жюри.
$qTotal = count($rows);
$qDone = 0; foreach ($rows as $r) { if ((int)$r['mine'] > 0) $qDone++; }
$qLeft = $qTotal - $qDone;
$qPct = $qTotal ? (int) round($qDone / $qTotal * 100) : 0;
$firstUngraded = null;
foreach ($rows as $r) { if ((int)$r['mine'] === 0) { $firstUngraded = (int)$r['id']; break; } }

ob_start(); ?>
<div class="section-title">
  <h2>Оценивание <span class="small muted">(в очереди: <?= $qTotal ?>)</span></h2>
</div>

<div class="tabs">
  <a href="<?= a_link('grading', array_filter(['competition'=>$comp])) ?>" class="<?= $mode===''?'active':'' ?>">Общая очередь</a>
  <a href="<?= a_link('grading', array_filter(['competition'=>$comp,'mode'=>'mine'])) ?>" class="<?= $mode==='mine'?'active':'' ?>">Мои назначенные</a>
</div>

<div class="card" style="margin-bottom:16px">
  <div style="display:flex;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between">
    <div class="small">Оценено <b><?= $qDone ?></b> · осталось <b><?= $qLeft ?></b> из <?= $qTotal ?> <span class="muted">(<?= $qPct ?>%)</span></div>
    <?php if ($firstUngraded): ?>
      <a class="btn btn--primary btn--sm" href="<?= a_link('grading', array_filter(['id'=>$firstUngraded,'competition'=>$comp,'mode'=>$mode])) ?>"><?= admin_icon('grading') ?>Начать оценку (клавишами)</a>
    <?php elseif ($qTotal): ?>
      <span class="badge badge--paid">Все заявки очереди оценены</span>
    <?php endif; ?>
  </div>
  <div style="height:9px;border-radius:6px;background:var(--a-line);overflow:hidden;margin-top:10px">
    <div style="height:100%;width:<?= $qPct ?>%;background:var(--grad-gold);border-radius:6px"></div>
  </div>
</div>

<form method="get" class="filters">
  <input type="hidden" name="p" value="grading"><input type="hidden" name="mode" value="<?= h($mode) ?>">
  <div class="field"><label>Конкурс</label><select name="competition" onchange="this.form.submit()"><option value="">Все на оценке</option>
    <?php foreach ($comps as $c): ?><option value="<?= $c['id'] ?>" <?= $comp===(int)$c['id']?'selected':'' ?>><?= h($c['name']) ?></option><?php endforeach; ?>
  </select></div>
  <?php if ($comp && user_can('admin')): ?>
    <button type="submit" form="autoassignForm" class="btn btn--primary btn--sm" onclick="return confirm('Автоматически распределить жюри (по 3 на заявку без конфликта интересов) для этого конкурса?')"><?= admin_icon('users') ?>Автораспределить жюри</button>
  <?php endif; ?>
</form>
<?php if ($comp && user_can('admin')): ?>
  <form method="post" action="<?= url('/admin/?p=grading') ?>" id="autoassignForm" style="display:none">
    <?= csrf_field() ?><input type="hidden" name="p" value="grading"><input type="hidden" name="do" value="autoassign"><input type="hidden" name="competition" value="<?= $comp ?>">
  </form>
<?php endif; ?>

<?php if ($juryStats): ?>
  <div class="card" style="margin-bottom:18px">
    <h4>Нагрузка жюри по конкурсу</h4>
    <div class="table-wrap"><table class="tbl">
      <thead><tr><th>Жюри</th><th>Назначено</th><th>Оценено</th></tr></thead>
      <tbody>
        <?php foreach ($juryStats as $s): ?>
          <tr><td><?= h($s['full_name'] ?: ('#'.$s['id'])) ?></td><td><?= (int)$s['assigned'] ?></td><td><?= (int)$s['done'] ?></td></tr>
        <?php endforeach; ?>
      </tbody>
    </table></div>
  </div>
<?php endif; ?>

<form method="post" action="<?= url('/admin/?p=grading') ?>">
  <?= csrf_field() ?><input type="hidden" name="p" value="grading"><input type="hidden" name="do" value="bulk_grade"><input type="hidden" name="competition" value="<?= $comp ?>"><input type="hidden" name="mode" value="<?= h($mode) ?>">
  <div class="toolbar">
    <span class="small muted">Массовое оценивание выбранных:</span>
    <select name="score" style="max-width:120px"><option value="">балл…</option><?php for($n=1;$n<=10;$n++):?><option value="<?= $n ?>"><?= $n ?></option><?php endfor;?></select>
    <button class="btn btn--navy btn--sm" onclick="return confirm('Поставить одинаковый балл выбранным заявкам?')"><?= admin_icon('check') ?>Оценить</button>
  </div>
  <div class="table-wrap">
    <table class="tbl">
      <thead><tr>
        <th class="checkbox-cell"><input type="checkbox" onclick="document.querySelectorAll('.rowchk').forEach(c=>c.checked=this.checked)"></th>
        <th>Номер</th><th>Участник</th><th>Конкурс</th><th>Номинация</th><th>Ваша оценка</th><th>Итог</th><th></th>
      </tr></thead>
      <tbody>
        <?php if (!$rows): ?><tr><td colspan="8" class="empty muted" style="text-align:center;padding:28px"><?= $mode==='mine' ? 'Вам пока не назначено ни одной заявки' : 'Очередь пуста — все заявки оценены' ?></td></tr><?php endif; ?>
        <?php foreach ($rows as $a): ?>
          <tr>
            <td class="checkbox-cell"><input type="checkbox" class="rowchk" name="ids[]" value="<?= $a['id'] ?>"></td>
            <td><?= h($a['number'] ?: '#'.$a['id']) ?></td>
            <td><?= h($a['is_group'] ? $a['group_name'] : $a['full_name']) ?></td>
            <td class="small"><?= h($a['comp']) ?></td>
            <td class="small"><?= h($a['nomination']) ?></td>
            <td><?= $a['mine'] ? '<span class="badge badge--paid">оценено</span>' : '<span class="badge badge--muted">нет</span>' ?></td>
            <td><?= $a['score']!==null ? h((string)$a['score']).' · '.h($a['result']) : '—' ?></td>
            <td><a class="btn btn--primary btn--sm" href="<?= a_link('grading', array_filter(['id'=>$a['id'],'competition'=>$comp,'mode'=>$mode])) ?>"><?= admin_icon('grading') ?>Оценить</a></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</form>
<?php
$content = ob_get_clean();
admin_layout('Оценивание', $content, 'grading');
