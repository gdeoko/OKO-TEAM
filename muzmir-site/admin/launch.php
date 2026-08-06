<?php
/**
 * ОБЩИЙ ПУЛЬТ ЗАПУСКА (по всем конкурсам сразу).
 *
 * Здесь — единственная точка запуска рекламной кампании месяца. Вместо кнопки
 * «Запустить» внутри каждого конкурса (отключена) — один общий план:
 *   • дата запуска по умолчанию = 1-е число месяца (если воскресенье → 2-е),
 *     можно выбрать любую дату и время;
 *   • «Запланировать всё» ставит на расписание: пост-открытие по КАЖДОМУ открытому
 *     конкурсу на выбранное время (в рабочем окне), и три общих поста —
 *     22-е 09:00 «осталось 3 дня», 25-е 09:00 «последний день», 25-е 18:00 «приём закрыт»;
 *   • тексты всех волн (открытие по каждому конкурсу, 3 общих, результаты) правятся и
 *     сохраняются (эталон vk_templates → override в settings launch_txt:{cid}:{wave});
 *   • ничего не публикуется само — только по расписанию, только в рабочее время
 *     (09:00–18:00, кроме воскресенья). Крон launch_scheduler разбирает очередь.
 *   • при выполнении волны «приём закрыт» приём заявок автоматически прекращается,
 *     конкурсы уходят с афиши/из календаря, на сайте показывается окно
 *     «новые конкурсы с 1 числа».
 */
declare(strict_types=1);

require_once BASE_PATH . '/core/launch_run.php';

/* ---------------- AJAX / POST-обработчики ---------------- */
if (in_array((string) input('do'), ['text', 'save', 'preview', 'schedule', 'cancel'], true)) {
    header('Content-Type: application/json; charset=utf-8');
    $do = (string) input('do');

    // text — GET-подобный (без CSRF): вернуть текущий текст волны для редактора.
    if ($do === 'text') {
        $cid = (int) input('id'); $wave = (string) input('wave');
        $c = $cid ? one("SELECT * FROM competitions WHERE id=?", [$cid]) : null;
        if (!$c || !isset(launch_waves()[$wave])) json_out(['ok' => false, 'msg' => 'Не найдено'], 404);
        $c = launch_norm_comp($c);
        $sib = in_array($wave, ['d3', 'last', 'closed'], true) ? launch_open_comps() : [$c];
        json_out(['ok' => true, 'text' => launch_wave_text($c, $wave, $sib),
                  'is_custom' => trim((string) setting('launch_txt:' . $cid . ':' . $wave, '')) !== '']);
    }

    if (!csrf_check()) json_out(['ok' => false, 'msg' => 'Сессия устарела. Обновите страницу.'], 403);
    if (!user_can('admin')) json_out(['ok' => false, 'msg' => 'Недостаточно прав.'], 403);

    if ($do === 'save') {
        $cid = (int) input('id'); $wave = (string) input('wave'); $txt = trim((string) input('text'));
        $c = $cid ? one("SELECT * FROM competitions WHERE id=?", [$cid]) : null;
        if (!$c || !isset(launch_waves()[$wave])) json_out(['ok' => false, 'msg' => 'Не найдено'], 404);
        $c = launch_norm_comp($c);
        $sib = in_array($wave, ['d3', 'last', 'closed'], true) ? launch_open_comps() : [$c];
        if ($txt === '' || $txt === trim(launch_wave_default($c, $wave, $sib))) {
            set_setting('launch_txt:' . $cid . ':' . $wave, '');
            json_out(['ok' => true, 'msg' => 'Возвращён эталонный текст.', 'is_custom' => false]);
        }
        set_setting('launch_txt:' . $cid . ':' . $wave, $txt);
        audit('launch_text_save', 'competition', $cid, ['wave' => $wave, 'via' => 'launch_pult']);
        json_out(['ok' => true, 'msg' => 'Текст сохранён.', 'is_custom' => true]);
    }

    if ($do === 'preview') {
        // Dry-run: показать, что и куда уйдёт по всему плану (ничего не отправляется).
        $channels = array_filter(array_map('trim', explode(',', (string) input('channels'))));
        $comps = launch_open_comps();
        if (!$comps) json_out(['ok' => false, 'msg' => 'Нет открытых конкурсов.'], 400);
        $lines = [];
        $rep = (int) $comps[0]['id'];
        foreach ($comps as $c) {
            $r = launch_fire((int) $c['id'], 'launch', $channels, '', true);
            $lines[] = 'Открытие «' . $c['name'] . '»: ' . implode('; ', array_map(fn($k, $v) => $k . ' — ' . $v, array_keys($r['report'] ?? []), array_values($r['report'] ?? [])));
        }
        foreach (['d3' => 'Осталось 3 дня', 'last' => 'Последний день', 'closed' => 'Приём закрыт'] as $w => $lbl) {
            $r = launch_fire($rep, $w, $channels, '', true);
            $lines[] = $lbl . ' (общий): ' . implode('; ', array_map(fn($k, $v) => $k . ' — ' . $v, array_keys($r['report'] ?? []), array_values($r['report'] ?? [])));
        }
        json_out(['ok' => true, 'lines' => $lines]);
    }

    if ($do === 'schedule') {
        $date = trim((string) input('date'));
        $time = trim((string) input('time')) ?: '09:00';
        $channels = array_filter(array_map('trim', explode(',', (string) input('channels'))));
        if ($date === '') $date = launch_default_date();
        $res = launch_schedule_all($date, $time, $channels);
        if (empty($res['ok'])) json_out(['ok' => false, 'msg' => $res['msg'] ?? 'Не удалось запланировать.'], 400);
        // Сохраняем выбор для отображения.
        set_setting('launch_plan_date', $date);
        set_setting('launch_plan_time', $time);
        set_setting('launch_plan_channels', implode(',', $channels));
        json_out(['ok' => true, 'msg' => 'Кампания запланирована.', 'scheduled' => $res['scheduled']]);
    }

    if ($do === 'cancel') {
        $n = launch_cancel_all();
        json_out(['ok' => true, 'msg' => $n ? ('Отменено заданий: ' . $n) : 'Активного плана не было.']);
    }
}

/* ---------------- Данные для рендера ---------------- */
launch_migrate();
$openComps = launch_open_comps();
$waves     = launch_waves();
$channels  = launch_channels();
$defDate   = (string) setting('launch_plan_date', launch_default_date());
$defTime   = (string) setting('launch_plan_time', '09:00');
$savedCh   = array_filter(explode(',', (string) setting('launch_plan_channels', 'vk_wall,email,inapp')));
if (!$savedCh) $savedCh = ['vk_wall', 'email', 'inapp'];
$jobs = all("SELECT j.*, c.name comp FROM launch_jobs j LEFT JOIN competitions c ON c.id=j.competition_id
             WHERE j.status IN ('scheduled','done') ORDER BY j.run_at ASC LIMIT 200");

$waveLabelShort = ['launch' => 'Открытие', 'd3' => '3 дня', 'last' => 'Последний', 'closed' => 'Закрыт', 'results' => 'Результаты'];

ob_start(); ?>
<div class="admin-head">
  <h1><?= admin_icon('rocket') ?>Запуск — общий пульт</h1>
</div>

<div class="lp-note">
  <b>Один запуск на все конкурсы.</b> Дата по умолчанию — 1-е число месяца (если воскресенье, то 2-е).
  «Запланировать всё» ставит на расписание пост-открытие по каждому открытому конкурсу и три общих поста
  (22-е 09:00 «осталось 3 дня», 25-е 09:00 «последний день», 25-е 18:00 «приём закрыт»).
  Публикация — только по расписанию и только в рабочее время 09:00–18:00 (кроме воскресенья).
  Если выбрать время в нерабочие часы — уйдёт в ближайшее рабочее (например, ночью → в 09:00).
</div>

<?php if (!$openComps): ?>
  <div class="card" style="padding:20px">Нет открытых конкурсов (status = <b>open</b>). Откройте конкурсы в разделе «Конкурсы».</div>
<?php else: ?>

<div class="card lp-plan">
  <h2 style="margin:0 0 14px">План запуска</h2>
  <div class="lp-row">
    <label>Дата запуска<br><input type="date" id="lpDate" value="<?= h($defDate) ?>"></label>
    <label>Время (МСК)<br><input type="time" id="lpTime" value="<?= h($defTime) ?>"></label>
  </div>
  <div class="lp-chans">
    <?php foreach ($channels as $ck => $cl): ?>
      <label class="lp-chip"><input type="checkbox" class="lpCh" value="<?= h($ck) ?>" <?= in_array($ck, $savedCh, true) ? 'checked' : '' ?>> <?= h($cl) ?></label>
    <?php endforeach; ?>
  </div>
  <div class="lp-actions">
    <button type="button" class="btn btn--ghost btn--sm" id="lpPreview"><?= admin_icon('eye') ?>Предпросмотр</button>
    <button type="button" class="btn btn--primary" id="lpSchedule"><?= admin_icon('clock') ?>Запланировать всё</button>
    <button type="button" class="btn btn--ghost btn--sm" id="lpCancel" style="color:#8b2f2f;border-color:#d99"><?= admin_icon('x') ?>Отменить план</button>
  </div>
  <div id="lpMsg" class="lp-msg" hidden></div>
  <div id="lpPrev" class="lp-prev" hidden></div>
</div>

<div class="card">
  <h2 style="margin:0 0 6px">Тексты постов</h2>
  <p class="small muted" style="margin:0 0 14px">Тексты по эталонам сообщества. Правьте и сохраняйте — при запуске уйдёт ваш вариант. Общие посты (3 дня / последний / закрыт) и результаты — один текст на все конкурсы.</p>

  <div class="lp-group">
    <div class="lp-group-t">Открытие · по каждому конкурсу</div>
    <?php foreach ($openComps as $c): ?>
      <button type="button" class="lp-edit" data-id="<?= (int)$c['id'] ?>" data-wave="launch" data-title="Открытие — <?= h($c['name']) ?>"><?= admin_icon('edit') ?><?= h($c['name']) ?></button>
    <?php endforeach; ?>
  </div>

  <div class="lp-group">
    <div class="lp-group-t">Общие посты (один на все конкурсы)</div>
    <?php $rep = (int) $openComps[0]['id']; ?>
    <button type="button" class="lp-edit" data-id="<?= $rep ?>" data-wave="d3" data-title="Общий: осталось 3 дня"><?= admin_icon('edit') ?>Осталось 3 дня</button>
    <button type="button" class="lp-edit" data-id="<?= $rep ?>" data-wave="last" data-title="Общий: последний день"><?= admin_icon('edit') ?>Последний день</button>
    <button type="button" class="lp-edit" data-id="<?= $rep ?>" data-wave="closed" data-title="Общий: приём закрыт"><?= admin_icon('edit') ?>Приём закрыт</button>
  </div>

  <?php $longComps = array_filter($openComps, fn($c) => vkt_is_long($c)); ?>
  <?php if ($longComps): ?>
  <div class="lp-group">
    <div class="lp-group-t">Результаты (только длинные конкурсы)</div>
    <?php foreach ($longComps as $c): ?>
      <button type="button" class="lp-edit" data-id="<?= (int)$c['id'] ?>" data-wave="results" data-title="Результаты — <?= h($c['name']) ?>"><?= admin_icon('edit') ?><?= h($c['name']) ?></button>
    <?php endforeach; ?>
  </div>
  <?php endif; ?>
</div>

<div class="card">
  <h2 style="margin:0 0 12px">Запланировано</h2>
  <?php
  $sched = array_filter($jobs, fn($j) => $j['status'] === 'scheduled');
  if (!$sched): ?>
    <p class="muted small" style="margin:0">План не создан. Нажмите «Запланировать всё».</p>
  <?php else: ?>
    <table class="a-table lp-jobs"><thead><tr><th>Когда (МСК)</th><th>Волна</th><th>Конкурс</th><th>Каналы</th></tr></thead><tbody>
    <?php foreach ($sched as $j): ?>
      <tr>
        <td><b><?= h(date('d.m.Y H:i', strtotime((string)$j['run_at']))) ?></b></td>
        <td><span class="lp-wchip w-<?= h($j['wave']) ?>"><?= h($waveLabelShort[$j['wave']] ?? $j['wave']) ?></span></td>
        <td><?= h((string)($j['comp'] ?? '—')) ?></td>
        <td class="small muted"><?= h((string)$j['channels']) ?></td>
      </tr>
    <?php endforeach; ?>
    </tbody></table>
  <?php endif; ?>
</div>

<!-- Модал редактора текста волны -->
<div id="lpModal" class="lp-modal" hidden>
  <div class="lp-modal-box">
    <div class="lp-modal-head"><b id="lpmTitle">Текст</b><button type="button" class="lp-x" id="lpmClose"><?= admin_icon('x') ?></button></div>
    <textarea id="lpmText" rows="16" placeholder="Загрузка…"></textarea>
    <div class="lp-modal-foot">
      <span id="lpmState" class="small muted"></span>
      <span style="flex:1"></span>
      <button type="button" class="btn btn--ghost btn--sm" id="lpmReset">Сбросить к эталону</button>
      <button type="button" class="btn btn--ghost btn--sm" id="lpmCancel">Отмена</button>
      <button type="button" class="btn btn--primary btn--sm" id="lpmSave"><?= admin_icon('check') ?>Сохранить</button>
    </div>
  </div>
</div>

<style>
.lp-note{background:#EEF4FF;border:1px solid #C9DBFF;border-radius:14px;padding:14px 18px;margin:0 0 16px;font-size:.92rem;line-height:1.6;color:#2b3a63}
.lp-plan .lp-row{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px}
.lp-plan label{font-size:.86rem;color:var(--muted,#667)}
.lp-plan input[type=date],.lp-plan input[type=time]{display:block;margin-top:4px;padding:8px 10px;border:1px solid var(--line,#d7ddea);border-radius:10px;font-size:.95rem}
.lp-chans{display:flex;gap:10px;flex-wrap:wrap;margin:6px 0 14px}
.lp-chip{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border:1px solid var(--line,#d7ddea);border-radius:999px;font-size:.85rem;cursor:pointer}
.lp-actions{display:flex;gap:10px;flex-wrap:wrap}
.lp-msg{margin-top:12px;padding:10px 14px;border-radius:10px;font-size:.9rem}
.lp-msg.ok{background:#E7F7EE;color:#1E7A44}.lp-msg.err{background:#FDECEC;color:#B23B3B}
.lp-prev{margin-top:12px;font-size:.85rem;line-height:1.6;color:#445;background:#F7F9FF;border:1px solid #E3E9F7;border-radius:10px;padding:12px 14px;white-space:pre-wrap}
.lp-group{margin:0 0 16px}
.lp-group-t{font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted,#889);margin:0 0 8px}
.lp-edit{display:inline-flex;align-items:center;gap:6px;margin:0 8px 8px 0;padding:8px 13px;border:1px solid var(--line,#d7ddea);border-radius:10px;background:#fff;cursor:pointer;font-size:.88rem;text-align:left}
.lp-edit:hover{border-color:#9AC0FF;background:#F5F9FF}
.lp-edit svg{width:15px;height:15px;flex:none}
.lp-jobs{width:100%}
.lp-wchip{display:inline-block;padding:3px 9px;border-radius:999px;font-size:.76rem;font-weight:700}
.w-launch{background:#E7F1FF;color:#2159A8}.w-d3{background:#FFF4E0;color:#9A6B12}.w-last{background:#FCE9E0;color:#A75327}.w-closed{background:#EEE9F7;color:#5B3F98}.w-results{background:#E7F7EE;color:#1E7A44}
.lp-modal{position:fixed;inset:0;z-index:2000;background:rgba(10,14,30,.55);display:flex;align-items:center;justify-content:center;padding:16px}
.lp-modal-box{background:var(--card,#fff);border-radius:16px;max-width:680px;width:100%;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.4)}
.lp-modal-head{display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid var(--line,#e6e9f2)}
.lp-x{background:none;border:none;cursor:pointer;color:var(--muted,#889);padding:4px}
.lp-modal-box textarea{margin:0;border:none;border-radius:0;padding:16px 20px;font-size:.92rem;line-height:1.6;resize:vertical;font-family:inherit;flex:1;min-height:220px}
.lp-modal-foot{display:flex;align-items:center;gap:8px;padding:12px 20px;border-top:1px solid var(--line,#e6e9f2);flex-wrap:wrap}
[data-theme="dark"] .lp-note{background:#1a2338;border-color:#2b3a5e;color:#c6d2ee}
[data-theme="dark"] .lp-edit{background:#171b2b;border-color:#2b3350;color:#e6ecff}
[data-theme="dark"] .lp-prev{background:#151a29;border-color:#2a3150;color:#c6d0ee}
</style>

<script>
(function(){
  var URL = <?= json_encode(a_link('launch')) ?>;
  var CSRF = <?= json_encode(csrf_token()) ?>;
  function post(data){ data._csrf=CSRF; return fetch(URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(data)}).then(function(r){return r.json();}); }
  function chans(){ return Array.prototype.map.call(document.querySelectorAll('.lpCh:checked'),function(c){return c.value;}).join(','); }
  var msg=document.getElementById('lpMsg'), prev=document.getElementById('lpPrev');
  function showMsg(t,ok){ msg.textContent=t; msg.className='lp-msg '+(ok?'ok':'err'); msg.hidden=false; }

  document.getElementById('lpPreview').addEventListener('click',function(){
    var ch=chans(); if(!ch){showMsg('Выберите хотя бы один канал.',false);return;}
    prev.hidden=false; prev.textContent='Считаю предпросмотр…';
    post({do:'preview',channels:ch}).then(function(d){
      if(!d.ok){prev.hidden=true;showMsg(d.msg||'Ошибка',false);return;}
      prev.textContent=d.lines.join('\n');
    });
  });
  document.getElementById('lpSchedule').addEventListener('click',function(){
    var ch=chans(); if(!ch){showMsg('Выберите хотя бы один канал.',false);return;}
    var date=document.getElementById('lpDate').value, time=document.getElementById('lpTime').value;
    if(!confirm('Запланировать запуск на '+date+' '+time+' МСК и общие посты (22/25)? Ничего не уйдёт раньше расписания.')) return;
    post({do:'schedule',date:date,time:time,channels:ch}).then(function(d){
      if(!d.ok){showMsg(d.msg||'Ошибка',false);return;}
      showMsg(d.msg+' Обновляю…',true); setTimeout(function(){location.reload();},900);
    });
  });
  document.getElementById('lpCancel').addEventListener('click',function(){
    if(!confirm('Отменить весь запланированный план?')) return;
    post({do:'cancel'}).then(function(d){ showMsg(d.msg,true); setTimeout(function(){location.reload();},900); });
  });

  // Модал редактора текста
  var modal=document.getElementById('lpModal'), mT=document.getElementById('lpmText'),
      mTitle=document.getElementById('lpmTitle'), mState=document.getElementById('lpmState');
  var curId=0, curWave='';
  function openEditor(id,wave,title){
    curId=id; curWave=wave; mTitle.textContent=title; mT.value='Загрузка…'; mState.textContent='';
    modal.hidden=false;
    fetch(URL+(URL.indexOf('?')>=0?'&':'?')+'do=text&id='+id+'&wave='+wave).then(function(r){return r.json();}).then(function(d){
      if(!d.ok){mT.value='Не удалось загрузить.';return;}
      mT.value=d.text; mState.textContent=d.is_custom?'✎ свой текст':'эталон';
    });
  }
  function closeEditor(){ modal.hidden=true; }
  Array.prototype.forEach.call(document.querySelectorAll('.lp-edit'),function(b){
    b.addEventListener('click',function(){ openEditor(b.getAttribute('data-id'),b.getAttribute('data-wave'),b.getAttribute('data-title')); });
  });
  document.getElementById('lpmClose').addEventListener('click',closeEditor);
  document.getElementById('lpmCancel').addEventListener('click',closeEditor);
  modal.addEventListener('click',function(e){ if(e.target===modal) closeEditor(); });
  document.getElementById('lpmSave').addEventListener('click',function(){
    post({do:'save',id:curId,wave:curWave,text:mT.value}).then(function(d){
      if(!d.ok){mState.textContent=d.msg||'Ошибка';return;}
      mState.textContent=d.is_custom?'✎ свой текст (сохранён)':'эталон (сброшено)';
      setTimeout(closeEditor,600);
    });
  });
  document.getElementById('lpmReset').addEventListener('click',function(){
    mT.value=''; post({do:'save',id:curId,wave:curWave,text:''}).then(function(d){
      mState.textContent='эталон'; openEditor(curId,curWave,mTitle.textContent);
    });
  });
})();
</script>
<?php endif; /* !$openComps */ ?>
<?php
$content = ob_get_clean();
admin_layout('Запуск', $content, 'launch');
