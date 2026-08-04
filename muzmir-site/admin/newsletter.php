<?php
/**
 * Рассылки Культурного центра «Музыкальный Мир» — премиум-конструктор сегментированных писем.
 *
 * Возможности интерфейса:
 *  - аудитории: все контакты / подписчики / участники / педагоги / участники конкурса /
 *    оплатившие / сегмент по тегу (с живым счётчиком получателей);
 *  - A/B-тест темы (варианты A и B делятся 50/50);
 *  - планировщик (datetime-local) с автоматической материализацией по наступлении срока;
 *  - предпросмотр письма в брендовой обёртке (новая вкладка);
 *  - тестовое письмо себе;
 *  - статистика доставки: отправлено / открытия / клики + средняя открываемость;
 *  - персонализация {{name}} (и {{имя}}).
 *
 * Серверная логика/очередь сохранена: письма материализуются в mail_queue и
 * отправляются воркером cron/process_newsletter_queue.php (через core/newsletter.php
 * ::newsletter_process_queue). Обёртку письма, трекинг открытий/кликов и отписку берём
 * из core/newsletter.php — эти модули не модифицируются, только используются.
 */
declare(strict_types=1);

/* Движок обёртки/трекинга и почтовый модуль (не трогаем, только вызываем). */
if (is_file(BASE_PATH . '/core/mailer.php'))     require_once BASE_PATH . '/core/mailer.php';
if (is_file(BASE_PATH . '/core/newsletter.php')) require_once BASE_PATH . '/core/newsletter.php';

/* =====================================================================
 *  Аудитории
 * ===================================================================== */

/** Список аудиторий: ключ => подпись (порядок = порядок в UI). */
function nl_audience_options(): array {
    return [
        'all'          => 'Все контакты',
        'subscribers'  => 'Подписчики',
        'participants' => 'Участники',
        'teachers'     => 'Педагоги',
        'competition'  => 'Участники конкурса',
        'paid'         => 'Оплатившие',
        'segment'      => 'Сегмент по тегу',
    ];
}

/**
 * Получатели по строке аудитории → [email, name][].
 * Форматы: all | subscribers | participants | teachers | paid |
 *          competition:<id> | segment:<тег>.
 */
function nl_admin_recipients(string $audience): array {
    [$kind, $value] = array_pad(explode(':', $audience, 2), 2, '');
    $kind = $kind ?: 'all';

    switch ($kind) {
        case 'subscribers':
            return all("SELECT email, name FROM subscribers WHERE active=1 AND email<>''");

        case 'participants':
            return all("SELECT DISTINCT email, full_name AS name FROM applications WHERE email<>''");

        case 'teachers':
            return all(
                "SELECT email, name FROM (
                    SELECT lower(email) AS email, full_name AS name FROM users
                     WHERE role='teacher' AND email<>''
                    UNION ALL
                    SELECT lower(email), name FROM subscribers
                     WHERE active=1 AND email<>'' AND (tags LIKE '%педагог%' OR tags LIKE '%teacher%')
                 ) GROUP BY email"
            );

        case 'paid':
            return all(
                "SELECT DISTINCT email, full_name AS name FROM applications
                  WHERE email<>'' AND (is_paid=1 OR status IN ('paid','judging','graded','sent'))"
            );

        case 'competition':
            if ((int) $value <= 0) return [];
            return all(
                "SELECT DISTINCT email, full_name AS name FROM applications
                  WHERE competition_id=? AND email<>''",
                [(int) $value]
            );

        case 'segment':
            if ($value === '') return [];
            return all(
                "SELECT email, name FROM subscribers WHERE active=1 AND email<>'' AND tags LIKE ?",
                ['%' . $value . '%']
            );

        case 'all':
        default:
            return all(
                "SELECT email, name FROM (
                    SELECT lower(email) AS email, name       FROM subscribers   WHERE active=1 AND email<>''
                    UNION ALL SELECT lower(email), full_name FROM applications  WHERE email<>''
                    UNION ALL SELECT lower(email), full_name FROM users         WHERE email<>''
                 ) GROUP BY email"
            );
    }
}

/** Число уникальных получателей аудитории (для счётчика в UI). */
function nl_admin_count(string $audience): int {
    $seen = [];
    foreach (nl_admin_recipients($audience) as $r) {
        $e = mb_strtolower(trim((string) ($r['email'] ?? '')));
        if ($e !== '' && filter_var($e, FILTER_VALIDATE_EMAIL)) $seen[$e] = 1;
    }
    return count($seen);
}

/** Человеческая подпись аудитории для списка. */
function nl_audience_label(string $audience): string {
    [$kind, $value] = array_pad(explode(':', $audience, 2), 2, '');
    $opts = nl_audience_options();
    if ($kind === 'competition') {
        $name = (string) scalar("SELECT name FROM competitions WHERE id=?", [(int) $value]);
        return 'Конкурс: ' . ($name !== '' ? $name : ('#' . (int) $value));
    }
    if ($kind === 'segment') return 'Сегмент «' . $value . '»';
    return $opts[$kind] ?? ($opts['all']);
}

/* =====================================================================
 *  Персонализация и обёртка письма
 * ===================================================================== */

/** Подставляет имя получателя в {{name}} / {{имя}} (с мягким фолбэком). */
function nl_admin_personalize(string $s, string $name): string {
    $nm = trim($name) !== '' ? trim($name) : 'уважаемый подписчик';
    return str_replace(['{{name}}', '{{ name }}', '{{имя}}', '{{ имя }}', '{{Имя}}'], $nm, $s);
}

/** Оборачивает тело в брендовую обёртку письма (из core/newsletter.php либо фолбэк). */
function nl_admin_wrap(string $bodyHtml, string $unsubUrl, string $pixel, string $preheader): string {
    if (function_exists('nl_wrap_email')) {
        return nl_wrap_email($bodyHtml, $unsubUrl, $pixel, $preheader);
    }
    if (function_exists('mm_email_layout')) {
        return mm_email_layout($bodyHtml, [
            'preheader'       => $preheader,
            'unsubscribe_url' => $unsubUrl,
            'pixel'           => $pixel,
        ]);
    }
    $org = h((string) cfgv('org_full', 'Культурный центр «Музыкальный Мир»'));
    return '<!doctype html><html lang="ru"><head><meta charset="UTF-8">'
        . '<meta name="viewport" content="width=device-width,initial-scale=1"></head>'
        . '<body style="margin:0;background:#FAF4E6;font-family:Segoe UI,Arial,sans-serif;color:#1D2B55;">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:28px 12px"><tr><td align="center">'
        . '<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:100%;background:#FFFFFF;border-radius:18px;overflow:hidden">'
        . '<tr><td style="background:linear-gradient(135deg,#17307A,#24499F);padding:30px;text-align:center">'
        . '<div style="font-family:Georgia,serif;color:#C79322;font-weight:700;font-size:19px">Культурный центр «Музыкальный Мир»</div></td></tr>'
        . '<tr><td style="padding:38px 42px;font-size:16px;line-height:1.7">' . $bodyHtml . '</td></tr>'
        . '<tr><td style="padding:22px 42px 30px;font-size:12px;color:#96A0BE">'
        . 'Вы получили это письмо, так как оставили заявку или подписку на сайте центра. '
        . '<a href="' . h($unsubUrl) . '" style="color:#C79322">Отписаться</a>.</td></tr>'
        . '</table></td></tr></table>' . $pixel . '</body></html>';
}

/* =====================================================================
 *  Постановка рассылки в очередь (все аудитории + {{name}} + A/B)
 * ===================================================================== */

/**
 * Разворачивает рассылку по аудитории в mail_queue с персонализацией, A/B-темой,
 * трекингом и отпиской. Идемпотентно: удаляет прежние ещё не отправленные письма
 * этой рассылки. Возвращает число поставленных писем.
 */
function nl_admin_enqueue(int $id): int {
    $n = one("SELECT * FROM newsletters WHERE id=?", [$id]);
    if (!$n) return 0;

    $audience = (string) ($n['audience'] ?? 'all');
    $subjectA = (string) ($n['subject'] ?? '');
    $subjectB = trim((string) setting("nl_subject_b_$id", ''));
    $hasAB    = $subjectB !== '';
    $bodyRaw  = (string) ($n['body'] ?? '');
    $source   = str_starts_with($audience, 'competition:') ? 'competition'
              : (in_array($audience, ['participants', 'paid'], true) ? 'participant' : 'newsletter');
    $token    = function_exists('nl_track_token') ? nl_track_token($id) : '';
    $base     = rtrim((string) cfgv('base_url'), '/');
    $preheader = mb_substr(trim(strip_tags($bodyRaw)), 0, 120);

    q("DELETE FROM mail_queue WHERE newsletter_id=? AND status='queued'", [$id]);

    $recips = nl_admin_recipients($audience);
    $seen = [];
    $queued = 0;
    $i = 0;

    $pdo = db();
    $pdo->beginTransaction();
    try {
        foreach ($recips as $r) {
            $email = mb_strtolower(trim((string) ($r['email'] ?? '')));
            if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) continue;
            if (isset($seen[$email])) continue;
            $seen[$email] = 1;

            $name = (string) ($r['name'] ?? '');

            if (function_exists('nl_ensure_subscriber')) {
                [$unsubToken, $active] = nl_ensure_subscriber($email, $name, $source);
                if (!$active) continue; // отписавшихся не трогаем
            } else {
                $unsubToken = '';
            }

            $subject = nl_admin_personalize(($hasAB && $i % 2 === 1) ? $subjectB : $subjectA, $name);
            $i++;

            $body = nl_admin_personalize($bodyRaw, $name);
            if ($token !== '' && function_exists('nl_rewrite_links')) $body = nl_rewrite_links($body, $token);
            $pixel   = ($token !== '' && function_exists('nl_open_pixel')) ? nl_open_pixel($token) : '';
            $unsubUrl = $unsubToken !== '' ? $base . '/api/v1/unsubscribe.php?token=' . urlencode($unsubToken) : $base . '/';
            $html = nl_admin_wrap($body, $unsubUrl, $pixel, $preheader);

            insert('mail_queue', [
                'to_email'      => $email,
                'to_name'       => $name,
                'subject'       => $subject,
                'body'          => $html,
                'newsletter_id' => $id,
                'status'        => 'queued',
            ]);
            $queued++;
        }
        $pdo->commit();
    } catch (\Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if (function_exists('mail_log')) mail_log('[nl-admin] enqueue #' . $id . ' ошибка: ' . $e->getMessage());
        return 0;
    }

    $upd = ['status' => $queued > 0 ? 'sending' : 'sent', 'stats_sent' => 0];
    if ($queued === 0) $upd['sent_at'] = date('Y-m-d H:i:s');
    update('newsletters', $upd, 'id=:wid', ['wid' => $id]);
    audit('newsletter_enqueue', 'newsletter', $id, ['queued' => $queued, 'audience' => $audience]);
    return $queued;
}

/** Материализация запланированных рассылок, срок которых наступил. */
function nl_admin_run_due(): void {
    $due = all(
        "SELECT id FROM newsletters
          WHERE status='scheduled' AND COALESCE(scheduled_at,'')<>'' AND scheduled_at<=?",
        [date('Y-m-d H:i:s')]
    );
    foreach ($due as $d) nl_admin_enqueue((int) $d['id']);
}
nl_admin_run_due();

/* =====================================================================
 *  POST
 * ===================================================================== */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('newsletter'); }
    $do = input('do');

    /* --- Предпросмотр: рендер письма в брендовой обёртке (новая вкладка). --- */
    if ($do === 'preview') {
        $body = nl_admin_personalize((string) ($_POST['body'] ?? ''), 'Анна Иванова');
        $pre  = mb_substr(trim(strip_tags($body)), 0, 120);
        header('Content-Type: text/html; charset=UTF-8');
        echo nl_admin_wrap($body, url('/'), '', $pre);
        exit;
    }

    if ($do === 'save' || $do === 'send' || $do === 'schedule' || $do === 'test') {
        $id       = (int) input('id');
        $audience = input('audience') ?: 'all';
        $audValue = input('audience_value');
        // Сложные аудитории несут значение (id конкурса / тег), простые — нет.
        $audStore = in_array($audience, ['competition', 'segment'], true) && $audValue !== ''
                  ? $audience . ':' . $audValue
                  : $audience;

        $data = [
            'subject'      => trim(input('subject')),
            'body'         => (string) ($_POST['body'] ?? ''),
            'audience'     => $audStore,
            'scheduled_at' => input('scheduled_at') ? str_replace('T', ' ', input('scheduled_at')) . ':00' : null,
            'status'       => 'draft',
        ];

        /* Тестовое письмо себе — без сохранения статуса рассылки. */
        if ($do === 'test') {
            $me = current_user();
            $to = trim((string) ($me['email'] ?? ''));
            if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
                flash('У вашего аккаунта нет корректной почты для теста.', 'error');
            } else {
                $body = nl_admin_personalize($data['body'], (string) ($me['full_name'] ?? ''));
                $html = nl_admin_wrap($body, url('/'), '', mb_substr(trim(strip_tags($body)), 0, 120));
                $subj = '[Тест] ' . nl_admin_personalize($data['subject'] !== '' ? $data['subject'] : 'Письмо Культурного центра «Музыкальный Мир»', (string) ($me['full_name'] ?? ''));
                $ok = false;
                if (function_exists('mail_send')) {
                    try { $ok = mail_send($to, $subj, $html); } catch (\Throwable $e) { $ok = false; }
                }
                if (!$ok) { // фолбэк — в очередь
                    $ok = insert('mail_queue', ['to_email' => $to, 'to_name' => (string) ($me['full_name'] ?? ''), 'subject' => $subj, 'body' => $html, 'status' => 'queued']) > 0;
                    flash($ok ? "Тестовое письмо поставлено в очередь на $to." : 'Не удалось отправить тест.', $ok ? 'success' : 'error');
                } else {
                    flash("Тестовое письмо отправлено на $to.", 'success');
                }
            }
            admin_redirect('newsletter', $id ? ['action' => 'edit', 'id' => $id] : ['action' => 'new']);
        }

        if ($id) { update('newsletters', $data, 'id=:wid', ['wid' => $id]); }
        else { $id = insert('newsletters', $data); }
        set_setting("nl_subject_b_$id", trim(input('subject_b')));
        audit('newsletter_save', 'newsletter', $id);

        if ($do === 'send') {
            $queued = nl_admin_enqueue($id);
            // Multi-channel fan-out (ВК, Telegram-канал, Telegram-пользователи бота)
            $channels = 0;
            if (!empty($_POST['ch_vk']))         $channels |= 1;
            if (!empty($_POST['ch_tg_channel'])) $channels |= 2;
            if (!empty($_POST['ch_tg_users']))   $channels |= 4;
            $extra = '';
            if ($channels > 0 && is_file(BASE_PATH . '/core/broadcast.php')) {
                require_once BASE_PATH . '/core/broadcast.php';
                require_once BASE_PATH . '/core/vk.php';
                require_once BASE_PATH . '/core/telegram.php';
                $newsletter = one("SELECT * FROM newsletters WHERE id=?", [$id]);
                if ($newsletter) {
                    $r = broadcast_newsletter_fanout($newsletter, $channels);
                    $bits = [];
                    if ($r['vk'])          $bits[] = 'ВКонтакте: ✓';
                    if ($r['tg_channel'])  $bits[] = 'TG-канал: ✓';
                    if ($r['tg_users'] > 0) $bits[] = 'TG-пользователей: ' . (int)$r['tg_users'];
                    $extra = $bits ? ' Доп.каналы: ' . implode(', ', $bits) . '.' : '';
                }
            }
            flash("Рассылка поставлена в очередь отправки. Получателей: $queued.$extra", $queued > 0 ? 'success' : 'error');
            admin_redirect('newsletter');
        }
        if ($do === 'schedule') {
            if (empty($data['scheduled_at'])) {
                flash('Укажите дату и время для планирования.', 'error');
                admin_redirect('newsletter', ['action' => 'edit', 'id' => $id]);
            }
            update('newsletters', ['status' => 'scheduled'], 'id=:wid', ['wid' => $id]);
            flash('Рассылка запланирована на ' . h(date('d.m.Y H:i', strtotime((string) $data['scheduled_at']))) . '.', 'success');
            admin_redirect('newsletter');
        }
        flash('Черновик сохранён.', 'success');
        admin_redirect('newsletter', ['action' => 'edit', 'id' => $id]);
    }

    if ($do === 'delete') {
        $id = (int) input('id');
        q("DELETE FROM mail_queue WHERE newsletter_id=? AND status='queued'", [$id]);
        q("DELETE FROM newsletters WHERE id=?", [$id]);
        audit('newsletter_delete', 'newsletter', $id);
        flash('Рассылка удалена.', 'success');
        admin_redirect('newsletter');
    }
}

$action = input('action');

/* =====================================================================
 *  РЕДАКТОР
 * ===================================================================== */
if ($action === 'edit' || $action === 'new') {
    $id = (int) input('id');
    $n  = $id ? one("SELECT * FROM newsletters WHERE id=?", [$id]) : null;
    $n  = $n ?: ['id' => 0, 'subject' => '', 'body' => '', 'audience' => 'all', 'scheduled_at' => '', 'status' => 'draft'];
    [$aud, $audVal] = array_pad(explode(':', (string) $n['audience'], 2), 2, '');
    $aud = $aud ?: 'all';
    $subB = $id ? (string) setting("nl_subject_b_$id", '') : '';

    $comps = all("SELECT id, name FROM competitions ORDER BY sort, name");
    $tags = [];
    foreach (all("SELECT tags FROM subscribers WHERE tags<>''") as $t)
        foreach (array_filter(array_map('trim', explode(',', (string) $t['tags']))) as $x) $tags[$x] = true;
    $tags = array_keys($tags);

    // Счётчики получателей для простых аудиторий (для живого индикатора).
    $counts = [
        'all'          => nl_admin_count('all'),
        'subscribers'  => nl_admin_count('subscribers'),
        'participants' => nl_admin_count('participants'),
        'teachers'     => nl_admin_count('teachers'),
        'paid'         => nl_admin_count('paid'),
    ];

    ob_start(); ?>
    <div class="toolbar"><a class="btn btn--ghost btn--sm" href="<?= a_link('newsletter') ?>"><?= admin_icon('back') ?>К списку</a></div>
    <form method="post" action="<?= url('/admin/') ?>" id="nlForm">
      <?= csrf_field() ?><input type="hidden" name="id" value="<?= (int) $n['id'] ?>">
      <div class="grid grid-2" style="align-items:start">

        <div class="card">
          <div class="section-title"><h3>Письмо</h3><span class="badge badge--<?= h($n['status']) ?>"><?= h($n['status']) ?></span></div>
          <div class="field"><label>Тема — вариант A</label>
            <input name="subject" value="<?= h($n['subject']) ?>" placeholder="Например: Открыт приём заявок на весенний конкурс" required></div>
          <div class="field"><label>Тема — вариант B <span class="muted small">(A/B-тест, необязательно)</span></label>
            <input name="subject_b" value="<?= h($subB) ?>" placeholder="Оставьте пустым, если A/B не нужен"></div>
          <div class="field"><label>HTML-тело письма</label>
            <textarea name="body" id="nlBody" style="min-height:300px;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:.85rem;line-height:1.6"><?= h($n['body']) ?></textarea>
            <div class="hint">Разрешён HTML. Логотип, шапку, подвал и отписку добавит брендовый шаблон.
              Персонализация: <code>{{name}}</code> подставит имя получателя.</div></div>
          <div class="toolbar" style="gap:8px;flex-wrap:wrap">
            <button class="btn btn--ghost btn--sm" type="submit" name="do" value="preview" formtarget="_blank" formnovalidate><?= admin_icon('eye') ?>Предпросмотр</button>
            <button class="btn btn--ghost btn--sm" type="submit" name="do" value="test" formnovalidate><?= admin_icon('send') ?>Тест себе</button>
          </div>
        </div>

        <div class="card">
          <h3>Аудитория и планировщик</h3>
          <div class="field"><label>Кому отправить</label>
            <select name="audience" id="aud" onchange="nlAud()">
              <?php foreach (nl_audience_options() as $k => $label): ?>
                <option value="<?= h($k) ?>" <?= $aud === $k ? 'selected' : '' ?>><?= h($label) ?></option>
              <?php endforeach; ?>
            </select>
          </div>

          <div class="field" id="compBox" style="display:<?= $aud === 'competition' ? 'block' : 'none' ?>">
            <label>Конкурс</label>
            <select name="audience_value_comp" onchange="nlSync()">
              <?php foreach ($comps as $c): $cc = (int) scalar("SELECT COUNT(DISTINCT email) FROM applications WHERE competition_id=? AND email<>''", [(int) $c['id']]); ?>
                <option value="<?= (int) $c['id'] ?>" data-count="<?= $cc ?>" <?= (string) $audVal === (string) $c['id'] ? 'selected' : '' ?>><?= h($c['name']) ?> (<?= $cc ?>)</option>
              <?php endforeach; ?>
              <?php if (!$comps): ?><option value="">Конкурсов пока нет</option><?php endif; ?>
            </select>
          </div>

          <div class="field" id="segBox" style="display:<?= $aud === 'segment' ? 'block' : 'none' ?>">
            <label>Тег сегмента</label>
            <select name="audience_value_seg" onchange="nlSync()">
              <?php foreach ($tags as $t): $tc = (int) scalar("SELECT COUNT(*) FROM subscribers WHERE active=1 AND tags LIKE ?", ['%' . $t . '%']); ?>
                <option value="<?= h($t) ?>" data-count="<?= $tc ?>" <?= $audVal === $t ? 'selected' : '' ?>><?= h($t) ?> (<?= $tc ?>)</option>
              <?php endforeach; ?>
              <?php if (!$tags): ?><option value="">Тегов пока нет</option><?php endif; ?>
            </select>
          </div>
          <input type="hidden" name="audience_value" id="audVal" value="<?= h($audVal) ?>">

          <div class="kpi" style="margin:6px 0 18px">
            <span class="label">Получателей</span>
            <b id="audCount">—</b>
            <span class="delta delta--flat" id="audName"><?= h(nl_audience_label((string) $n['audience'])) ?></span>
          </div>

          <div class="field"><label>Запланировать на <span class="muted small">(необязательно)</span></label>
            <input type="datetime-local" name="scheduled_at" value="<?= h($n['scheduled_at'] ? str_replace(' ', 'T', substr((string) $n['scheduled_at'], 0, 16)) : '') ?>">
            <div class="hint">При планировании рассылка уйдёт в очередь автоматически по наступлении срока.</div></div>

          <div class="field" style="margin-top:14px">
            <label>Дополнительные каналы (одновременно с почтой)</label>
            <div style="display:flex;flex-direction:column;gap:8px;padding:10px 12px;border:1px solid var(--glass-brd);border-radius:10px;background:var(--gold-soft)">
              <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
                <input type="checkbox" name="ch_vk" value="1" style="width:18px;height:18px;margin:0">
                <span><b>ВКонтакте</b> — пост в сообществе <span class="muted small">(1 публикация на всех подписчиков VK)</span></span>
              </label>
              <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
                <input type="checkbox" name="ch_tg_channel" value="1" style="width:18px;height:18px;margin:0">
                <span><b>Telegram-канал</b> — пост в <?= h(cfgv('org_tg_channel') ?: '(не указан)') ?></span>
              </label>
              <label style="display:flex;align-items:center;gap:10px;cursor:pointer">
                <input type="checkbox" name="ch_tg_users" value="1" style="width:18px;height:18px;margin:0">
                <span><b>Telegram — каждому пользователю бота</b> <span class="muted small">(кто привязал @okoappbot и включил notify_tg)</span></span>
              </label>
            </div>
            <div class="hint">Каналы отправятся после того, как email-очередь будет составлена. Не работает при «Отправить только тест».</div>
          </div>

          <div class="toolbar" style="margin-top:16px;gap:8px;flex-wrap:wrap">
            <button class="btn btn--ghost btn--sm" type="submit" name="do" value="save"><?= admin_icon('check') ?>Сохранить черновик</button>
            <button class="btn btn--navy btn--sm" type="submit" name="do" value="schedule"><?= admin_icon('clock') ?>Запланировать</button>
            <button class="btn btn--primary btn--sm" type="submit" name="do" value="send" onclick="return confirm('Поставить рассылку в очередь отправки сейчас?')"><?= admin_icon('send') ?>Отправить сейчас</button>
          </div>
        </div>
      </div>
    </form>

    <script>
    var NL_COUNTS = <?= json_encode($counts, JSON_UNESCAPED_UNICODE) ?>;
    var NL_LABELS = <?= json_encode(nl_audience_options(), JSON_UNESCAPED_UNICODE) ?>;
    function nlAud(){
      var a=document.getElementById('aud').value;
      document.getElementById('compBox').style.display=a==='competition'?'block':'none';
      document.getElementById('segBox').style.display=a==='segment'?'block':'none';
      nlSync();
    }
    function nlSync(){
      var a=document.getElementById('aud').value, v='', cnt=NL_COUNTS[a], label=NL_LABELS[a]||a;
      if(a==='competition'){var s=document.querySelector('[name=audience_value_comp]');if(s&&s.selectedIndex>=0){v=s.value;var o=s.options[s.selectedIndex];cnt=o?+o.getAttribute('data-count'):0;label='Конкурс: '+(o?o.text.replace(/\s*\(\d+\)\s*$/,''):'');}}
      if(a==='segment'){var g=document.querySelector('[name=audience_value_seg]');if(g&&g.selectedIndex>=0){v=g.value;var og=g.options[g.selectedIndex];cnt=og?+og.getAttribute('data-count'):0;label='Сегмент «'+v+'»';}}
      document.getElementById('audVal').value=v;
      document.getElementById('audCount').textContent=(cnt==null||isNaN(cnt))?'—':cnt+' чел.';
      document.getElementById('audName').textContent=label;
    }
    nlAud();
    </script>
    <?php
    $content = ob_get_clean();
    admin_layout($id ? 'Редактор рассылки' : 'Новая рассылка', $content, 'newsletter');
    exit;
}

/* =====================================================================
 *  СПИСОК + статистика доставки
 * ===================================================================== */
$rows = all("SELECT * FROM newsletters ORDER BY id DESC LIMIT 100");

$total     = count($rows);
$sumSent   = (int) scalar("SELECT COALESCE(SUM(stats_sent),0) FROM newsletters");
$sumOpen   = (int) scalar("SELECT COALESCE(SUM(stats_open),0) FROM newsletters");
$sumClick  = (int) scalar("SELECT COALESCE(SUM(stats_click),0) FROM newsletters");
$queueWait = (int) scalar("SELECT COUNT(*) FROM mail_queue WHERE status='queued'");
$avgOpen   = $sumSent > 0 ? round($sumOpen / $sumSent * 100) : 0;
$avgClick  = $sumSent > 0 ? round($sumClick / $sumSent * 100) : 0;

// Кольцо открываемости.
$circ = 314.159;
$dash = $circ * (1 - min(100, max(0, $avgOpen)) / 100);

ob_start(); ?>
<div class="section-title"><h2>Рассылки</h2>
  <a class="btn btn--primary" href="<?= a_link('newsletter', ['action' => 'new']) ?>"><?= admin_icon('plus') ?>Новая рассылка</a></div>

<div class="grid grid-4" style="margin-bottom:20px">
  <div class="stat">
    <div class="stat__icon"><?= admin_icon('newsletter') ?></div>
    <div class="stat__label">Всего рассылок</div>
    <div class="stat__value"><?= $total ?></div>
    <div class="stat__sub"><?= $queueWait ?> писем в очереди</div>
  </div>
  <div class="stat">
    <div class="stat__icon"><?= admin_icon('send') ?></div>
    <div class="stat__label">Отправлено писем</div>
    <div class="stat__value"><?= number_format($sumSent, 0, ',', ' ') ?></div>
    <div class="stat__sub">за всё время</div>
  </div>
  <div class="stat">
    <div class="stat__icon"><?= admin_icon('eye') ?></div>
    <div class="stat__label">Открытия</div>
    <div class="stat__value"><?= number_format($sumOpen, 0, ',', ' ') ?></div>
    <div class="stat__sub">средняя открываемость <?= $avgOpen ?>%</div>
  </div>
  <div class="stat">
    <div class="stat__icon"><?= admin_icon('chart') ?></div>
    <div class="stat__label">Клики</div>
    <div class="stat__value"><?= number_format($sumClick, 0, ',', ' ') ?></div>
    <div class="stat__sub">CTR <?= $avgClick ?>%</div>
  </div>
</div>

<div class="grid grid-3" style="margin-bottom:20px;align-items:center">
  <div class="card" style="text-align:center">
    <h3 style="margin-top:0">Открываемость</h3>
    <div class="stat-ring" style="--circ:<?= $circ ?>;--dash:<?= round($dash, 1) ?>">
      <svg viewBox="0 0 132 132"><circle class="ring-track" cx="66" cy="66" r="50"></circle>
        <circle class="ring-val" cx="66" cy="66" r="50" style="stroke-dasharray:<?= $circ ?>;stroke-dashoffset:<?= round($dash, 1) ?>"></circle></svg>
      <div class="ring-num"><?= $avgOpen ?>%<small>открытий</small></div>
    </div>
  </div>
  <div class="card" style="grid-column:span 2">
    <h3 style="margin-top:0">Как это работает</h3>
    <div class="kv">
      <dt>Аудитории</dt><dd>Все контакты · Подписчики · Участники · Педагоги · По конкурсу · Оплатившие · Сегмент по тегу</dd>
      <dt>Персонализация</dt><dd><code>{{name}}</code> в теме и теле подставит имя получателя</dd>
      <dt>A/B-тема</dt><dd>Варианты A и B делятся между получателями 50/50</dd>
      <dt>Планировщик</dt><dd>Рассылка уходит в очередь автоматически по наступлении срока</dd>
      <dt>Отправка</dt><dd>Письма идут батчами через очередь с учётом суточного лимита</dd>
    </div>
  </div>
</div>

<div class="table-wrap"><table class="tbl tbl--zebra">
  <thead><tr><th>Тема</th><th>Аудитория</th><th>Статус</th><th class="num">Отпр.</th><th class="num">Откр.</th><th class="num">Клики</th><th>Дата</th><th></th></tr></thead>
  <tbody>
    <?php if (!$rows): ?><tr><td colspan="8" class="muted" style="text-align:center;padding:26px">Рассылок пока нет</td></tr><?php endif; ?>
    <?php foreach ($rows as $n):
        $openRate  = $n['stats_sent'] ? round($n['stats_open'] / $n['stats_sent'] * 100) : 0;
        $clickRate = $n['stats_sent'] ? round($n['stats_click'] / $n['stats_sent'] * 100) : 0;
        $stBadge = ['sent' => 'sent', 'sending' => 'sending', 'scheduled' => 'scheduled', 'draft' => 'draft'][$n['status']] ?? 'draft';
        $hasAB = setting("nl_subject_b_{$n['id']}", '') !== ''; ?>
      <tr>
        <td><a href="<?= a_link('newsletter', ['action' => 'edit', 'id' => $n['id']]) ?>"><b><?= h($n['subject'] ?: 'Без темы') ?></b></a>
          <?php if ($hasAB): ?> <span class="badge badge--gold" title="A/B-тест темы">A/B</span><?php endif; ?></td>
        <td class="small"><span class="badge badge--muted"><?= h(nl_audience_label((string) $n['audience'])) ?></span></td>
        <td><span class="badge badge--<?= $stBadge ?>"><?= h($n['status']) ?></span></td>
        <td class="num"><?= (int) $n['stats_sent'] ?></td>
        <td class="num"><?= (int) $n['stats_open'] ?> <span class="small muted">(<?= $openRate ?>%)</span></td>
        <td class="num"><?= (int) $n['stats_click'] ?> <span class="small muted">(<?= $clickRate ?>%)</span></td>
        <td class="small"><?= h($n['sent_at'] ? date('d.m.y H:i', strtotime((string) $n['sent_at'])) : ($n['scheduled_at'] ? date('d.m.y H:i', strtotime((string) $n['scheduled_at'])) : '-')) ?></td>
        <td><form method="post" action="<?= url('/admin/') ?>" style="display:inline"><?= csrf_field() ?><input type="hidden" name="do" value="delete"><input type="hidden" name="id" value="<?= (int) $n['id'] ?>">
          <button class="btn btn--danger btn--sm" onclick="return confirm('Удалить рассылку?')"><?= admin_icon('trash') ?></button></form></td>
      </tr>
    <?php endforeach; ?>
  </tbody>
</table></div>
<?php
$content = ob_get_clean();
admin_layout('Рассылки', $content, 'newsletter');
