<?php
/** Рассылки: конструктор, аудитории, планировщик, A/B заголовков, очередь, статистика. */
declare(strict_types=1);

/** Получатели по описанию аудитории: [email,name][]. */
function nl_recipients(string $audience, string $value): array {
    if ($audience === 'competition' && (int)$value) {
        return all("SELECT DISTINCT email, full_name name FROM applications WHERE competition_id=? AND email<>''", [(int)$value]);
    }
    if ($audience === 'segment' && $value !== '') {
        return all("SELECT email, name FROM subscribers WHERE active=1 AND tags LIKE ?", ["%$value%"]);
    }
    return all("SELECT email, name FROM subscribers WHERE active=1");
}

/* ---------- POST ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('newsletter'); }
    $do = input('do');

    if ($do === 'save' || $do === 'send' || $do === 'schedule') {
        $id = (int) input('id');
        $audience = input('audience') ?: 'all';
        $audValue = input('audience_value');
        $data = [
            'subject'      => trim(input('subject')),
            'body'         => (string)($_POST['body'] ?? ''),
            'audience'     => $audience . ($audValue !== '' ? ':' . $audValue : ''),
            'scheduled_at' => input('scheduled_at') ?: null,
            'status'       => 'draft',
        ];
        if ($id) { update('newsletters', $data, 'id=:wid', ['wid'=>$id]); }
        else { $id = insert('newsletters', $data); }
        set_setting("nl_subject_b_$id", trim(input('subject_b')));
        audit('newsletter_save', 'newsletter', $id);

        if ($do === 'send') {
            $subA = $data['subject'];
            $subB = trim(input('subject_b'));
            $recips = nl_recipients($audience, $audValue);
            $i = 0;
            foreach ($recips as $r) {
                if (!$r['email']) continue;
                $subj = ($subB !== '' && $i % 2 === 1) ? $subB : $subA;
                insert('mail_queue', ['to_email'=>$r['email'],'to_name'=>$r['name'] ?? '','subject'=>$subj,'body'=>$data['body'],'newsletter_id'=>$id]);
                $i++;
            }
            update('newsletters', ['status'=>'sent','sent_at'=>date('Y-m-d H:i:s'),'stats_sent'=>$i], 'id=:wid', ['wid'=>$id]);
            audit('newsletter_send', 'newsletter', $id, ['queued'=>$i]);
            flash("Рассылка поставлена в очередь: получателей $i.", 'success');
            admin_redirect('newsletter');
        }
        if ($do === 'schedule') {
            update('newsletters', ['status'=>'scheduled'], 'id=:wid', ['wid'=>$id]);
            flash('Рассылка запланирована на ' . h($data['scheduled_at']) . '.', 'success');
            admin_redirect('newsletter');
        }
        flash('Черновик сохранён.', 'success');
        admin_redirect('newsletter', ['action'=>'edit','id'=>$id]);
    }

    if ($do === 'delete') {
        $id = (int) input('id');
        q("DELETE FROM newsletters WHERE id=?", [$id]);
        audit('newsletter_delete', 'newsletter', $id);
        flash('Рассылка удалена.', 'success');
        admin_redirect('newsletter');
    }
}

$action = input('action');

/* ================= РЕДАКТОР ================= */
if ($action === 'edit' || $action === 'new') {
    $id = (int) input('id');
    $n = $id ? one("SELECT * FROM newsletters WHERE id=?", [$id]) : null;
    $n = $n ?: ['id'=>0,'subject'=>'','body'=>'','audience'=>'all','scheduled_at'=>''];
    [$aud, $audVal] = array_pad(explode(':', (string)$n['audience'], 2), 2, '');
    $subB = $id ? (string) setting("nl_subject_b_$id", '') : '';
    $comps = all("SELECT id,name FROM competitions ORDER BY sort,name");
    $tags = [];
    foreach (all("SELECT tags FROM subscribers WHERE tags<>''") as $t)
      foreach (array_filter(array_map('trim', explode(',', $t['tags']))) as $x) $tags[$x]=true;

    ob_start(); ?>
    <div class="toolbar"><a class="btn btn--ghost btn--sm" href="<?= a_link('newsletter') ?>"><?= admin_icon('back') ?>К списку</a></div>
    <form method="post" action="<?= url('/admin/') ?>">
      <?= csrf_field() ?><input type="hidden" name="id" value="<?= (int)$n['id'] ?>">
      <div class="grid grid-2">
        <div class="card">
          <h3>Письмо</h3>
          <div class="field"><label>Тема (вариант A)</label><input name="subject" value="<?= h($n['subject']) ?>" required></div>
          <div class="field"><label>Тема (вариант B, для A/B-теста — необязательно)</label><input name="subject_b" value="<?= h($subB) ?>" placeholder="Оставьте пустым, если A/B не нужен"></div>
          <div class="field"><label>HTML-тело письма</label><textarea name="body" style="min-height:280px;font-family:monospace;font-size:.85rem"><?= h($n['body']) ?></textarea>
            <div class="hint">Можно использовать HTML. Логотип и подвал добавит шаблон письма.</div></div>
        </div>
        <div class="card">
          <h3>Аудитория и время</h3>
          <div class="field"><label>Кому</label><select name="audience" id="aud" onchange="audChange()">
            <option value="all" <?= $aud==='all'?'selected':'' ?>>Вся база подписчиков</option>
            <option value="segment" <?= $aud==='segment'?'selected':'' ?>>Сегмент по тегу</option>
            <option value="competition" <?= $aud==='competition'?'selected':'' ?>>Участники конкурса</option>
          </select></div>
          <div class="field" id="segBox" style="display:<?= $aud==='segment'?'block':'none' ?>">
            <label>Тег сегмента</label><select name="audience_value_seg">
              <?php foreach (array_keys($tags) as $t): ?><option value="<?= h($t) ?>" <?= $audVal===$t?'selected':'' ?>><?= h($t) ?></option><?php endforeach; ?>
            </select>
          </div>
          <div class="field" id="compBox" style="display:<?= $aud==='competition'?'block':'none' ?>">
            <label>Конкурс</label><select name="audience_value_comp">
              <?php foreach ($comps as $c): ?><option value="<?= $c['id'] ?>" <?= (string)$audVal===(string)$c['id']?'selected':'' ?>><?= h($c['name']) ?></option><?php endforeach; ?>
            </select>
          </div>
          <input type="hidden" name="audience_value" id="audVal" value="<?= h($audVal) ?>">
          <hr>
          <div class="field"><label>Запланировать на (необязательно)</label><input type="datetime-local" name="scheduled_at" value="<?= h($n['scheduled_at'] ? str_replace(' ','T',substr($n['scheduled_at'],0,16)) : '') ?>"></div>
          <div class="toolbar" style="margin-top:16px">
            <button class="btn btn--ghost btn--sm" name="do" value="save"><?= admin_icon('check') ?>Сохранить черновик</button>
            <button class="btn btn--navy btn--sm" name="do" value="schedule"><?= admin_icon('clock') ?>Запланировать</button>
            <button class="btn btn--primary btn--sm" name="do" value="send" onclick="return confirm('Поставить рассылку в очередь отправки сейчас?')"><?= admin_icon('send') ?>Отправить сейчас</button>
          </div>
        </div>
      </div>
    </form>
    <script>
    function audChange(){
      var a=document.getElementById('aud').value;
      document.getElementById('segBox').style.display=a==='segment'?'block':'none';
      document.getElementById('compBox').style.display=a==='competition'?'block':'none';
      syncVal();
    }
    function syncVal(){
      var a=document.getElementById('aud').value, v='';
      if(a==='segment'){var s=document.querySelector('[name=audience_value_seg]');v=s?s.value:'';}
      if(a==='competition'){var c=document.querySelector('[name=audience_value_comp]');v=c?c.value:'';}
      document.getElementById('audVal').value=v;
    }
    document.addEventListener('change',function(e){if(e.target.name==='audience_value_seg'||e.target.name==='audience_value_comp')syncVal();});
    syncVal();
    </script>
    <?php
    $content = ob_get_clean();
    admin_layout($id ? 'Редактор рассылки' : 'Новая рассылка', $content, 'newsletter');
    exit;
}

/* ================= СПИСОК ================= */
$rows = all("SELECT * FROM newsletters ORDER BY id DESC LIMIT 100");
ob_start(); ?>
<div class="section-title"><h2>Рассылки</h2>
  <a class="btn btn--primary" href="<?= a_link('newsletter', ['action'=>'new']) ?>"><?= admin_icon('plus') ?>Новая рассылка</a></div>
<div class="table-wrap"><table class="tbl">
  <thead><tr><th>Тема</th><th>Аудитория</th><th>Статус</th><th class="num">Отпр.</th><th class="num">Откр.</th><th class="num">Клики</th><th>Дата</th><th></th></tr></thead>
  <tbody>
    <?php if (!$rows): ?><tr><td colspan="8" class="muted" style="text-align:center;padding:26px">Рассылок пока нет</td></tr><?php endif; ?>
    <?php foreach ($rows as $n):
      $openRate = $n['stats_sent'] ? round($n['stats_open']/$n['stats_sent']*100) : 0;
      $clickRate = $n['stats_sent'] ? round($n['stats_click']/$n['stats_sent']*100) : 0; ?>
      <tr>
        <td><a href="<?= a_link('newsletter', ['action'=>'edit','id'=>$n['id']]) ?>"><b><?= h($n['subject']) ?></b></a></td>
        <td class="small"><?= h($n['audience']) ?></td>
        <td><span class="badge badge--<?= $n['status']==='sent'?'sent':($n['status']==='scheduled'?'judging':'draft') ?>"><?= h($n['status']) ?></span></td>
        <td class="num"><?= (int)$n['stats_sent'] ?></td>
        <td class="num"><?= (int)$n['stats_open'] ?> <span class="small muted">(<?= $openRate ?>%)</span></td>
        <td class="num"><?= (int)$n['stats_click'] ?> <span class="small muted">(<?= $clickRate ?>%)</span></td>
        <td class="small"><?= h($n['sent_at'] ? date('d.m.y', strtotime($n['sent_at'])) : ($n['scheduled_at'] ? date('d.m.y H:i', strtotime($n['scheduled_at'])) : '—')) ?></td>
        <td><form method="post" action="<?= url('/admin/') ?>" style="display:inline"><?= csrf_field() ?><input type="hidden" name="do" value="delete"><input type="hidden" name="id" value="<?= $n['id'] ?>">
          <button class="btn btn--danger btn--sm" onclick="return confirm('Удалить рассылку?')"><?= admin_icon('trash') ?></button></form></td>
      </tr>
    <?php endforeach; ?>
  </tbody>
</table></div>
<?php
$content = ob_get_clean();
admin_layout('Рассылки', $content, 'newsletter');
