<?php
/** Дипломы: шаблоны по конкурсам, массовая генерация PDF, рассылка на email, история. */
declare(strict_types=1);

$comp = (int) input('competition');

/* ---------- Шаблон конкурса: тема, фон, сохранение (сбрасывает подтверждение) ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'save_template') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('diplomas'); }
    $cid = (int) input('competition');

    $theme = input('diploma_theme');
    if (!array_key_exists($theme, diploma_themes())) $theme = '';
    $bg = trim(input('diploma_bg'));

    // Загрузка своего фона (png/jpg). Кладём в public/uploads/diplomas/.
    if (isset($_FILES['diploma_bg_file']) && is_uploaded_file($_FILES['diploma_bg_file']['tmp_name'] ?? '')) {
        $f = $_FILES['diploma_bg_file'];
        $ext = strtolower(pathinfo((string)$f['name'], PATHINFO_EXTENSION));
        $mime = function_exists('mime_content_type') ? (string) mime_content_type($f['tmp_name']) : '';
        $okExt  = in_array($ext, ['png','jpg','jpeg','webp'], true);
        $okMime = $mime === '' || str_starts_with($mime, 'image/');
        if ($okExt && $okMime && (int)$f['size'] <= 8 * 1024 * 1024) {
            $dir = BASE_PATH . '/public/uploads/diplomas/';
            if (!is_dir($dir)) @mkdir($dir, 0775, true);
            $name = 'bg_' . $cid . '_' . substr(bin2hex(random_bytes(4)), 0, 8) . '.' . $ext;
            if (@move_uploaded_file($f['tmp_name'], $dir . $name)) {
                $bg = 'uploads/diplomas/' . $name;
            } else {
                flash('Не удалось сохранить файл фона.', 'error');
            }
        } else {
            flash('Фон должен быть изображением (png, jpg, webp) до 8 МБ.', 'error');
        }
    }

    update('competitions', [
        'diploma_theme'    => $theme,
        'diploma_bg'       => $bg,
        'diploma_template' => trim(input('diploma_template')),
        'diploma_approved' => 0, // любое изменение шаблона снимает подтверждение
    ], 'id=:wid', ['wid' => $cid]);
    unset($_SESSION['diploma_preview'][$cid]);
    audit('diploma_template', 'competition', $cid, ['theme' => $theme, 'bg' => $bg]);
    flash('Шаблон сохранён. Подтверждение снято - проверьте предпросмотр и подтвердите заново.', 'success');
    admin_redirect('diplomas', ['competition' => $cid]);
}

/* ---------- Предпросмотр шаблона (тестовый диплом на фейковых данных) ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'preview_template') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('diplomas'); }
    $cid = (int) input('competition');
    $c = one("SELECT * FROM competitions WHERE id=?", [$cid]);
    if ($c) {
        $pv = diploma_preview_generate($c);
        if ($pv['ok']) {
            $_SESSION['diploma_preview'][$cid] = $pv;
            audit('diploma_preview', 'competition', $cid);
            flash('Предпросмотр готов. Проверьте макет ниже.', 'success');
        } else {
            flash($pv['error'] ?: 'Не удалось собрать предпросмотр.', 'error');
        }
    }
    admin_redirect('diplomas', ['competition' => $cid]);
}

/* ---------- Подтверждение шаблона в админке ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'approve_template') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('diplomas'); }
    $cid = (int) input('competition');
    update('competitions', ['diploma_approved' => 1], 'id=:wid', ['wid' => $cid]);
    audit('diploma_approve', 'competition', $cid, ['via' => 'admin']);
    flash('Шаблон диплома подтверждён. Массовая генерация разблокирована.', 'success');
    admin_redirect('diplomas', ['competition' => $cid]);
}

/* ---------- Снять подтверждение вручную ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'unapprove_template') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('diplomas'); }
    $cid = (int) input('competition');
    update('competitions', ['diploma_approved' => 0], 'id=:wid', ['wid' => $cid]);
    audit('diploma_unapprove', 'competition', $cid);
    flash('Подтверждение снято.', 'info');
    admin_redirect('diplomas', ['competition' => $cid]);
}

/* ---------- Отправить шаблон на подтверждение в Telegram-бот ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'notify_template') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('diplomas'); }
    $cid = (int) input('competition');
    $c = one("SELECT * FROM competitions WHERE id=?", [$cid]);
    if ($c) {
        // Гарантируем свежий предпросмотр со ссылкой для бота.
        $pv = $_SESSION['diploma_preview'][$cid] ?? null;
        if (!$pv || empty($pv['pdf_url'])) {
            $pv = diploma_preview_generate($c);
            if ($pv['ok']) $_SESSION['diploma_preview'][$cid] = $pv;
        }
        $link = $pv['pdf_url'] ?? '';
        $admin = (string) cfgv('tg_admin_chat', '');
        if (!function_exists('tg_send') || $admin === '') {
            flash('Telegram-бот не настроен (нет chat администратора).', 'warning');
        } else {
            $text = "Подтверждение шаблона диплома\n"
                  . "Конкурс: " . strip_tags((string)$c['name']) . "\n"
                  . "Тема: " . diploma_theme_label((string)$c['diploma_theme']) . "\n"
                  . ($link ? "Предпросмотр: " . $link . "\n" : '')
                  . "\nПодтвердите шаблон, чтобы разрешить массовую генерацию дипломов.";
            $res = tg_send($admin, $text, [
                'no_preview' => true,
                'keyboard'   => [[
                    ['text' => 'Подтвердить', 'callback_data' => 'approve_diploma_' . $cid],
                    ['text' => 'Отклонить',  'callback_data' => 'reject_diploma_'  . $cid],
                ]],
            ]);
            audit('diploma_notify_tg', 'competition', $cid, ['ok' => !empty($res['ok'])]);
            if (!empty($res['ok'])) flash('Отправлено в бот на подтверждение.', 'success');
            else flash('Не удалось отправить в бот. Проверьте токен и chat администратора.', 'error');
        }
    }
    admin_redirect('diplomas', ['competition' => $cid]);
}

/* ---------- Справочник спец-наград (8): функция data.php, фолбэк — локальный массив ---------- */
function diplomas_extra_awards(): array {
    if (function_exists('EXTRA_AWARDS')) {
        $a = EXTRA_AWARDS();
        if (is_array($a) && $a) return array_values($a);
    }
    return ['ЗА ПАТРИОТИЗМ','ЗА ЛУЧШИЙ ОБРАЗ','ЛУЧШИЙ КОЛЛЕКТИВ','ЛУЧШИЙ ДУЭТ',
            'ЗА АРТИСТИЗМ','ЗА ЛУЧШЕЕ ИСПОЛНЕНИЕ','ЗА ЛУЧШУЮ ПОСТАНОВКУ','ЗА ОРИГИНАЛЬНОЕ ИСПОЛНЕНИЕ'];
}

/* ---------- Массовая генерация дипломов ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'generate') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('diplomas'); }
    $cid = (int) input('competition');
    if (!diploma_is_approved($cid)) {
        flash('Сначала подтвердите шаблон диплома.', 'error');
        admin_redirect('diplomas', array_filter(['competition' => $cid]));
    }
    // Тип диплома (гейтинг подтверждённого шаблона сохранён для ВСЕХ типов).
    $dtype = input('dtype') ?: 'main';
    if (!in_array($dtype, ['main','named','extra','thanks'], true)) $dtype = 'main';
    // Спец-награда (только для extra): индекс из справочника 8 наград.
    $awards   = diplomas_extra_awards();
    $awardIdx = (int) input('special_award_idx');
    if ($dtype === 'extra' && !isset($awards[$awardIdx])) {
        flash('Выберите спец-награду из списка.', 'error');
        admin_redirect('diplomas', array_filter(['competition' => $cid, 'dtype' => $dtype]));
    }
    $special = $dtype === 'extra' ? (string)$awards[$awardIdx] : '';

    $ids = array_map('intval', $_POST['ids'] ?? []);
    $made = 0; $pdfok = 0; $skip = 0;
    foreach ($ids as $appId) {
        $app = one("SELECT a.*, c.code FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id WHERE a.id=?", [$appId]);
        if (!$app) { continue; }
        // Для благодарности педагогу звание не требуется; для остальных — нужен результат.
        if ($dtype !== 'thanks' && !$app['result']) { continue; }

        // Базовый номер — канонический номер заявки (CODE-ГГГГ-NNNNN). Фолбэк, если пусто.
        $base = trim((string)($app['number'] ?? ''));
        if ($base === '') $base = strtoupper($app['code'] ?: 'D') . '-' . date('Y') . '-' . str_pad((string)$appId, 5, '0', STR_PAD_LEFT);

        // Единый номер диплома: его же кодирует QR, его же пишем в diplomas.number.
        $number = function_exists('diploma_make_number')
            ? diploma_make_number($base, $dtype, $awardIdx + 1)
            : $base . ['main'=>'','named'=>'-N','thanks'=>'-T','extra'=>'-E'.($awardIdx+1)][$dtype];

        // Дедуп по итоговому номеру (позволяет одной заявке иметь main + именной + спец-награды).
        if (one("SELECT id FROM diplomas WHERE number=?", [$number])) { $skip++; continue; }

        // Результат/звание записи: для спец-награды — название награды.
        $recResult = $dtype === 'extra' ? $special : (string)$app['result'];

        // Данные для генератора: канонический номер + тип + спец-награда.
        $app['diploma_number'] = $number;
        if ($special !== '') $app['special_award'] = $special;

        $pdfPath = '';
        if (function_exists('pdf_diploma')) {
            try { $pdfPath = pdf_diploma($app, $dtype); if ($pdfPath) $pdfok++; } catch (Throwable $e) { $pdfPath = ''; }
        }
        insert('diplomas', ['number'=>$number,'application_id'=>$appId,'type'=>$dtype,'result'=>$recResult,'pdf_path'=>$pdfPath]);
        $made++;
    }
    audit('diplomas_generate', 'diploma', null, ['made'=>$made,'pdf'=>$pdfok,'type'=>$dtype,'award'=>$special,'skip'=>$skip]);
    if (!function_exists('pdf_diploma')) flash("Создано записей: $made. Генератор pdf_diploma пока не подключён — PDF добавятся позже.", 'warning');
    else flash("Сгенерировано дипломов: $made (PDF: $pdfok" . ($skip ? ", пропущено дублей: $skip" : '') . ").", 'success');
    admin_redirect('diplomas', array_filter(['competition'=>$comp,'dtype'=>$dtype]));
}

/* ---------- Массовая отправка на email ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'send') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('diplomas'); }
    $cid = (int) input('competition');
    if (!diploma_is_approved($cid)) {
        flash('Сначала подтвердите шаблон диплома.', 'error');
        admin_redirect('diplomas', array_filter(['competition' => $cid, 'tab' => 'sent']));
    }
    $ids = array_map('intval', $_POST['dids'] ?? []);
    $queued = 0;
    foreach ($ids as $did) {
        $d = one("SELECT d.*, a.email, a.full_name, a.group_name, a.is_group, c.name comp
                  FROM diplomas d JOIN applications a ON a.id=d.application_id
                  LEFT JOIN competitions c ON c.id=a.competition_id WHERE d.id=?", [$did]);
        if (!$d || !$d['email']) continue;
        $name = $d['is_group'] ? $d['group_name'] : $d['full_name'];
        $subject = 'Ваш диплом · ' . $d['comp'];
        $body = function_exists('mail_template')
            ? mail_template('diploma', ['name'=>$name,'result'=>$d['result'],'comp'=>$d['comp'],'number'=>$d['number']])
            : '<p>Здравствуйте, ' . h($name) . '.</p><p>Поздравляем с результатом «' . h($d['result']) . '» в конкурсе «' . h($d['comp']) . '». Ваш диплом № ' . h($d['number']) . ' во вложении.</p>';
        insert('mail_queue', ['to_email'=>$d['email'],'to_name'=>$name,'subject'=>$subject,'body'=>$body,'attach'=>$d['pdf_path'] ?: '']);
        q("UPDATE diplomas SET sent_at=datetime('now') WHERE id=?", [$did]);
        q("UPDATE applications SET status='sent' WHERE id=?", [$d['application_id']]);
        $queued++;
    }
    audit('diplomas_send', 'diploma', null, ['queued'=>$queued]);
    flash("Поставлено в очередь писем: $queued.", 'success');
    admin_redirect('diplomas', array_filter(['competition'=>$comp,'tab'=>'sent']));
}

/* ---------- Повторная отправка ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'resend') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('diplomas'); }
    $did = (int) input('did');
    $d = one("SELECT d.*, a.email, a.full_name, a.group_name, a.is_group, c.name comp
              FROM diplomas d JOIN applications a ON a.id=d.application_id
              LEFT JOIN competitions c ON c.id=a.competition_id WHERE d.id=?", [$did]);
    if ($d && $d['email']) {
        $name = $d['is_group'] ? $d['group_name'] : $d['full_name'];
        $body = '<p>Здравствуйте, ' . h($name) . '.</p><p>Повторно направляем Ваш диплом № ' . h($d['number']) . ' по конкурсу «' . h($d['comp']) . '».</p>';
        insert('mail_queue', ['to_email'=>$d['email'],'to_name'=>$name,'subject'=>'Ваш диплом (повторно) · '.$d['comp'],'body'=>$body,'attach'=>$d['pdf_path'] ?: '']);
        q("UPDATE diplomas SET sent_at=datetime('now') WHERE id=?", [$did]);
        audit('diploma_resend', 'diploma', $did);
        flash('Диплом повторно поставлен в очередь.', 'success');
    }
    admin_redirect('diplomas', array_filter(['competition'=>$comp,'tab'=>'sent']));
}

$comps = all("SELECT id,name,status FROM competitions ORDER BY sort,name");
$current = $comp ? one("SELECT * FROM competitions WHERE id=?", [$comp]) : null;
$tab = input('tab') ?: 'ready';

ob_start(); ?>
<div class="section-title"><h2>Дипломы</h2></div>

<form method="get" class="filters">
  <input type="hidden" name="p" value="diplomas">
  <div class="field"><label>Конкурс</label><select name="competition" onchange="this.form.submit()"><option value="">Выберите конкурс…</option>
    <?php foreach ($comps as $c): ?><option value="<?= $c['id'] ?>" <?= $comp===(int)$c['id']?'selected':'' ?>><?= h($c['name']) ?> · <?= h(comp_status_ru($c['status'])) ?></option><?php endforeach; ?>
  </select></div>
</form>

<?php if (!$current): ?>
  <div class="card empty"><?= admin_icon('diplomas') ?><p class="muted">Выберите конкурс, чтобы работать с дипломами.</p></div>
<?php else: ?>

  <?php
    $approved = (int)($current['diploma_approved'] ?? 0) === 1;
    $preview  = $_SESSION['diploma_preview'][$comp] ?? null;
    $hasTpl   = trim((string)($current['diploma_theme'] ?: $current['diploma_bg'] ?: $current['diploma_template'])) !== '';
  ?>
  <div class="card" style="margin-bottom:18px">
    <div class="section-title" style="margin-bottom:8px"><h3>Шаблон диплома</h3>
      <span class="badge <?= $approved ? 'badge--open' : 'badge--muted' ?>"><?= $approved ? 'Шаблон подтверждён' : 'Не подтверждён' ?></span>
    </div>

    <?php if (!$approved): ?>
      <div class="flash flash--warning" style="margin:0 0 14px">Пока шаблон не подтверждён, массовая генерация и рассылка дипломов заблокированы. Настройте тему и фон, проверьте предпросмотр и подтвердите шаблон - здесь или через Telegram-бот.</div>
    <?php endif; ?>

    <form method="post" action="<?= url('/admin/') ?>" enctype="multipart/form-data">
      <?= csrf_field() ?><input type="hidden" name="do" value="save_template"><input type="hidden" name="competition" value="<?= $comp ?>">
      <div class="form-row">
        <div class="field"><label>Тема оформления</label>
          <select name="diploma_theme">
            <option value="">По умолчанию</option>
            <?php foreach (diploma_themes() as $key => $label): ?>
              <option value="<?= h($key) ?>" <?= ($current['diploma_theme']??'')===$key?'selected':'' ?>><?= h($label) ?></option>
            <?php endforeach; ?>
          </select></div>
        <div class="field"><label>Свой фон (png, jpg, webp — до 8 МБ)</label>
          <input type="file" name="diploma_bg_file" accept="image/*">
          <?php if (!empty($current['diploma_bg'])): ?><span class="small muted">Текущий: <?= h(basename((string)$current['diploma_bg'])) ?></span><?php endif; ?>
        </div>
      </div>
      <div class="field"><label>Путь/URL макета вручную (необязательно)</label>
        <input name="diploma_template" value="<?= h((string)$current['diploma_template']) ?>" placeholder="assets/img/diploma_bg.png"></div>
      <div class="toolbar" style="margin-top:6px">
        <button class="btn btn--primary btn--sm"><?= admin_icon('check') ?>Сохранить шаблон</button>
        <button class="btn btn--ghost btn--sm" form="tplPreview"><?= admin_icon('eye') ?>Предпросмотр шаблона</button>
      </div>
    </form>

    <!-- Отдельные формы для действий (вне формы сохранения) -->
    <form method="post" action="<?= url('/admin/') ?>" id="tplPreview" style="display:none">
      <?= csrf_field() ?><input type="hidden" name="do" value="preview_template"><input type="hidden" name="competition" value="<?= $comp ?>">
    </form>

    <?php if ($preview && !empty($preview['pdf_url'])): ?>
      <div style="margin-top:16px;border-top:1px solid rgba(0,0,0,.08);padding-top:14px">
        <p class="small muted" style="margin:0 0 8px">Предпросмотр на тестовом участнике</p>
        <?php if (!empty($preview['png_url'])): ?>
          <img src="<?= h($preview['png_url']) ?>" alt="Предпросмотр диплома" style="max-width:100%;border:1px solid rgba(0,0,0,.1);border-radius:8px">
        <?php else: ?>
          <object data="<?= h($preview['pdf_url']) ?>" type="application/pdf" style="width:100%;height:520px;border:1px solid rgba(0,0,0,.1);border-radius:8px">
            <p class="small muted">Встроенный просмотр недоступен.</p>
          </object>
        <?php endif; ?>
        <p class="small" style="margin-top:8px"><a href="<?= h($preview['pdf_url']) ?>" target="_blank" rel="noopener">Открыть PDF в новой вкладке</a></p>
      </div>
    <?php endif; ?>

    <div class="toolbar" style="margin-top:16px;border-top:1px solid rgba(0,0,0,.08);padding-top:14px">
      <?php if (!$approved): ?>
        <form method="post" action="<?= url('/admin/') ?>" style="display:inline">
          <?= csrf_field() ?><input type="hidden" name="do" value="approve_template"><input type="hidden" name="competition" value="<?= $comp ?>">
          <button class="btn btn--primary btn--sm" onclick="return confirm('Подтвердить шаблон диплома? После этого станет доступна массовая генерация.')" <?= $hasTpl?'':'disabled title="Сначала настройте тему или фон"' ?>><?= admin_icon('check') ?>Подтвердить шаблон</button>
        </form>
        <form method="post" action="<?= url('/admin/') ?>" style="display:inline">
          <?= csrf_field() ?><input type="hidden" name="do" value="notify_template"><input type="hidden" name="competition" value="<?= $comp ?>">
          <button class="btn btn--navy btn--sm"><?= admin_icon('send') ?>Отправить на подтверждение в бот</button>
        </form>
      <?php else: ?>
        <form method="post" action="<?= url('/admin/') ?>" style="display:inline">
          <?= csrf_field() ?><input type="hidden" name="do" value="unapprove_template"><input type="hidden" name="competition" value="<?= $comp ?>">
          <button class="btn btn--ghost btn--sm" onclick="return confirm('Снять подтверждение шаблона?')"><?= admin_icon('x') ?>Снять подтверждение</button>
        </form>
      <?php endif; ?>
    </div>
  </div>

  <div class="tabs">
    <a href="<?= a_link('diplomas', ['competition'=>$comp,'tab'=>'ready']) ?>" class="<?= $tab==='ready'?'active':'' ?>">К генерации</a>
    <a href="<?= a_link('diplomas', ['competition'=>$comp,'tab'=>'sent']) ?>" class="<?= $tab==='sent'?'active':'' ?>">Готовые и отправка</a>
  </div>

  <?php if ($tab === 'ready'):
    // Тип диплома для генерации (GET-параметр). От него зависит и список кандидатов.
    $dtype = input('dtype') ?: 'main';
    if (!in_array($dtype, ['main','named','extra','thanks'], true)) $dtype = 'main';
    $dtypeLabels = ['main'=>'Основной','named'=>'Именной','extra'=>'Спец-награда','thanks'=>'Благодарность педагогу'];
    $awards = diplomas_extra_awards();

    if ($dtype === 'main') {
      // Основной: оценённые заявки, у которых ещё нет основного диплома.
      $ready = all("SELECT a.* FROM applications a WHERE a.competition_id=? AND a.result<>''
                    AND a.id NOT IN (SELECT application_id FROM diplomas WHERE type='main') ORDER BY a.id", [$comp]);
    } elseif ($dtype === 'thanks') {
      // Благодарность педагогу: любые заявки с указанным педагогом.
      $ready = all("SELECT a.* FROM applications a WHERE a.competition_id=? AND a.teacher<>'' ORDER BY a.id", [$comp]);
    } else {
      // Именной / спец-награда: любые оценённые заявки (можно выдать поверх основного).
      $ready = all("SELECT a.* FROM applications a WHERE a.competition_id=? AND a.result<>'' ORDER BY a.id", [$comp]);
    }
  ?>
    <div class="card" style="margin-bottom:14px">
      <div class="section-title" style="margin-bottom:8px"><h3>Тип диплома</h3></div>
      <div class="tabs" style="margin-bottom:0">
        <?php foreach ($dtypeLabels as $k => $lbl): ?>
          <a href="<?= a_link('diplomas', ['competition'=>$comp,'tab'=>'ready','dtype'=>$k]) ?>" class="<?= $dtype===$k?'active':'' ?>"><?= h($lbl) ?></a>
        <?php endforeach; ?>
      </div>
      <?php if ($dtype === 'extra'): ?>
        <p class="small muted" style="margin:10px 0 0">Спец-награда присуждается сверх основного звания. Выберите награду ниже — она будет выдана всем отмеченным участникам.</p>
      <?php elseif ($dtype === 'named'): ?>
        <p class="small muted" style="margin:10px 0 0">Именной диплом — дополнительный к основному, с сохранённым званием участника.</p>
      <?php elseif ($dtype === 'thanks'): ?>
        <p class="small muted" style="margin:10px 0 0">Благодарность оформляется на педагога заявки (бело-барочная тема).</p>
      <?php endif; ?>
    </div>
    <form method="post" action="<?= url('/admin/') ?>">
      <?= csrf_field() ?><input type="hidden" name="do" value="generate"><input type="hidden" name="competition" value="<?= $comp ?>">
      <input type="hidden" name="dtype" value="<?= h($dtype) ?>">
      <?php if ($dtype === 'extra'): ?>
        <div class="field" style="max-width:420px"><label>Спец-награда</label>
          <select name="special_award_idx" required>
            <?php foreach ($awards as $i => $aw): ?><option value="<?= $i ?>"><?= h($aw) ?></option><?php endforeach; ?>
          </select>
        </div>
      <?php endif; ?>
      <div class="toolbar">
        <span class="small muted">Кандидатов (<?= h($dtypeLabels[$dtype]) ?>): <?= count($ready) ?></span>
        <?php if ($approved): ?>
          <button class="btn btn--primary btn--sm" onclick="return confirm('Сгенерировать дипломы для выбранных?')"><?= admin_icon('diplomas') ?>Сгенерировать выбранные</button>
        <?php else: ?>
          <button class="btn btn--primary btn--sm" disabled title="Сначала подтвердите шаблон диплома"><?= admin_icon('diplomas') ?>Сгенерировать выбранные</button>
        <?php endif; ?>
      </div>
      <?php if (!$approved): ?><p class="small muted" style="margin:0 0 12px">Сначала подтвердите шаблон диплома в блоке выше.</p><?php endif; ?>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th class="checkbox-cell"><input type="checkbox" onclick="document.querySelectorAll('.rowchk').forEach(c=>c.checked=this.checked)"></th>
          <th>Участник</th><th>Номинация</th><th>Балл</th><th>Результат</th></tr></thead>
        <tbody>
          <?php if (!$ready): ?><tr><td colspan="5" class="muted" style="text-align:center;padding:26px">Нет оценённых заявок без диплома. Дипломы генерируются после закрытия оценивания.</td></tr><?php endif; ?>
          <?php foreach ($ready as $a): ?>
            <tr><td class="checkbox-cell"><input type="checkbox" class="rowchk" name="ids[]" value="<?= $a['id'] ?>"></td>
              <td><?= h($a['is_group']?$a['group_name']:$a['full_name']) ?></td>
              <td class="small"><?= h($a['nomination']) ?></td>
              <td><?= h((string)$a['score']) ?></td>
              <td><span class="badge badge--gold"><?= h($a['result']) ?></span></td></tr>
          <?php endforeach; ?>
        </tbody>
      </table></div>
    </form>

  <?php else:
    $dips = all("SELECT d.*, a.full_name, a.group_name, a.is_group, a.email
                 FROM diplomas d JOIN applications a ON a.id=d.application_id
                 WHERE a.competition_id=? ORDER BY d.id DESC", [$comp]); ?>
    <form method="post" action="<?= url('/admin/') ?>">
      <?= csrf_field() ?><input type="hidden" name="do" value="send"><input type="hidden" name="competition" value="<?= $comp ?>">
      <div class="toolbar">
        <span class="small muted">Всего дипломов: <?= count($dips) ?></span>
        <?php if ($approved): ?>
          <button class="btn btn--navy btn--sm" onclick="return confirm('Поставить письма с дипломами в очередь?')"><?= admin_icon('send') ?>Отправить выбранные на email</button>
        <?php else: ?>
          <button class="btn btn--navy btn--sm" disabled title="Сначала подтвердите шаблон диплома"><?= admin_icon('send') ?>Отправить выбранные на email</button>
        <?php endif; ?>
      </div>
      <?php if (!$approved): ?><p class="small muted" style="margin:0 0 12px">Сначала подтвердите шаблон диплома в блоке выше.</p><?php endif; ?>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th class="checkbox-cell"><input type="checkbox" onclick="document.querySelectorAll('.rowchk').forEach(c=>c.checked=this.checked)"></th>
          <th>Номер</th><th>Участник</th><th>Результат</th><th>PDF</th><th>Отправлен</th><th></th></tr></thead>
        <tbody>
          <?php if (!$dips): ?><tr><td colspan="7" class="muted" style="text-align:center;padding:26px">Дипломы ещё не сгенерированы</td></tr><?php endif; ?>
          <?php foreach ($dips as $d): ?>
            <tr>
              <td class="checkbox-cell"><input type="checkbox" class="rowchk" name="dids[]" value="<?= $d['id'] ?>"></td>
              <td class="small"><?= h($d['number']) ?></td>
              <td><?= h($d['is_group']?$d['group_name']:$d['full_name']) ?><br><span class="small muted"><?= h($d['email']) ?></span></td>
              <td><span class="badge badge--gold"><?= h($d['result']) ?></span></td>
              <td><?= $d['pdf_path'] ? '<a href="'.h(url($d['pdf_path'])).'" target="_blank">файл</a>' : '<span class="small muted">нет</span>' ?></td>
              <td class="small"><?= $d['sent_at'] ? h(date('d.m.y H:i', strtotime($d['sent_at']))) : '<span class="badge badge--muted">нет</span>' ?></td>
              <td><?php if ($d['sent_at']): ?>
                <button form="resend<?= $d['id'] ?>" class="btn btn--ghost btn--sm" title="Повторить"><?= admin_icon('send') ?></button>
              <?php endif; ?></td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table></div>
    </form>
    <?php foreach ($dips as $d): if (!$d['sent_at']) continue; ?>
      <form method="post" action="<?= url('/admin/') ?>" id="resend<?= $d['id'] ?>" style="display:none">
        <?= csrf_field() ?><input type="hidden" name="do" value="resend"><input type="hidden" name="did" value="<?= $d['id'] ?>"><input type="hidden" name="competition" value="<?= $comp ?>">
      </form>
    <?php endforeach; ?>
  <?php endif; ?>

<?php endif; ?>
<?php
$content = ob_get_clean();
admin_layout('Дипломы', $content, 'diplomas');
