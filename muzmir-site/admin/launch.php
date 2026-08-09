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

/* --- Предпросмотр письма волны (GET, HTML) — открывается в новой вкладке из пульта --- */
if ((string) input('do') === 'email_preview') {
    $cid = (int) input('id'); $wave = (string) input('wave');
    $c = $cid ? one("SELECT * FROM competitions WHERE id=?", [$cid]) : null;
    if (!$c || !isset(launch_waves()[$wave])) { http_response_code(404); echo 'Не найдено'; exit; }
    $c = launch_norm_comp($c);
    $sib = in_array($wave, ['d3', 'last', 'closed'], true) ? launch_open_comps() : [$c];
    header('Content-Type: text/html; charset=utf-8');
    if ($wave === 'results') {
        // Результаты длинного — ПЕРСОНАЛЬНОЕ письмо участнику (образец), без «Подать заявку».
        if (is_file(BASE_PATH . '/core/result_mail.php')) require_once BASE_PATH . '/core/result_mail.php';
        $sample = one("SELECT * FROM applications WHERE competition_id=? AND COALESCE(result,'')<>'' ORDER BY id DESC LIMIT 1", [$cid])
            ?: one("SELECT * FROM applications WHERE competition_id=? ORDER BY id DESC LIMIT 1", [$cid])
            ?: ['full_name' => 'Иванова Анна Сергеевна', 'number' => 'VR-2026-00001', 'result' => 'ЛАУРЕАТ I СТЕПЕНИ', 'competition_id' => $cid, 'nomination' => 'Вокальное искусство', 'age_category' => '13-15 лет'];
        $poster = launch_cover_path($c, 'results', [$c]);
        $posterUrl = ($poster !== '' && str_starts_with($poster, BASE_PATH . '/public')) ? url(substr($poster, strlen(BASE_PATH . '/public'))) : '';
        $docxUrl = is_file(BASE_PATH . '/public/uploads/launch/results_' . $cid . '.docx') ? url('/uploads/launch/results_' . $cid . '.docx') : '';
        if (function_exists('results_long_mail_html')) {
            [$subj, $html] = results_long_mail_html($sample, $c, (string) cfgv('org_vk'), $docxUrl, $posterUrl);
            echo $html; exit;
        }
    }
    echo launch_email_html($c, $wave, $sib);
    exit;
}

/* --- Предпросмотр массового письма-блока (GET, HTML): konkurs | vip | kabinet --- */
if ((string) input('do') === 'email_preview_campaign') {
    $ctype = (string) input('ctype');
    header('Content-Type: text/html; charset=utf-8');
    // Объединённое письмо запуска — ровно то, что уходит участнику: конкурсы месяца,
    // затем доступ в кабинет, затем клуб. Показываем полный вариант (все три блока).
    if ($ctype === 'combo') {
        if (!function_exists('launch_combo_inner')) require_once BASE_PATH . '/core/launch_combo.php';
        $inner = launch_combo_inner(true, true, 'ivanova@example.ru', 'Анна', 'a7k3m9x2p');
        $subj  = launch_combo_subject();
        if (function_exists('nl_wrap_email'))      echo nl_wrap_email($inner, '#', '', $subj, ['vip' => false]);
        elseif (function_exists('mm_email_layout')) echo mm_email_layout($inner, ['title' => $subj]);
        else echo $inner;
        exit;
    }
    if ($ctype === 'kabinet') {
        if (!function_exists('kabinet_onboarding_html') && is_file(BASE_PATH . '/core/kabinet_onboarding.php')) require_once BASE_PATH . '/core/kabinet_onboarding.php';
        echo function_exists('kabinet_onboarding_html')
            ? kabinet_onboarding_html('example@mail.ru', 'Анна', 'k7m3np2qz')
            : 'Шаблон недоступен';
        exit;
    }
    if (!in_array($ctype, ['konkurs', 'vip'], true)) { http_response_code(404); echo 'Не найдено'; exit; }
    [$subj, $body] = launch_email_build($ctype);
    // Оборачиваем в фирменный лейаут (как при отправке) + подставляем имя-образец.
    $body = str_replace('{{name}}', 'Анна', $body);
    // В письме про клуб карточка клуба в подвале не нужна — она и так весь смысл письма.
    if (function_exists('nl_wrap_email')) echo nl_wrap_email($body, '#', '', $subj, ['vip' => $ctype !== 'vip']);
    elseif (function_exists('mm_email_layout')) echo mm_email_layout($body, ['title' => $subj]);
    else echo $body;
    exit;
}

/* --- Сохранение email-блока (тема/ВИЗУАЛЬНОЕ тело/квота): konkurs | vip | kabinet --- */
if ((string) input('do') === 'mail_block_save') {
    header('Content-Type: application/json; charset=utf-8');
    if (!csrf_check() || !user_can('admin')) json_out(['ok' => false, 'msg' => 'Нет доступа'], 403);
    $ctype = (string) input('ctype');
    // 'combo' — объединённое письмо запуска (основной блок пульта с августа 2026).
    // 'konkurs'/'vip'/'kabinet' оставлены для разовых кампаний, запускаемых руками.
    if (!in_array($ctype, ['combo', 'konkurs', 'vip', 'kabinet'], true)) json_out(['ok' => false, 'msg' => 'Неизвестный блок'], 422);
    set_setting('launch_mail_subject:' . $ctype, trim((string) input('subject')));
    // Визуально отредактированное тело письма (contenteditable). Пусто — не трогаем.
    $html = (string) input('html');
    if (trim(strip_tags($html)) !== '') set_setting('launch_mail_html:' . $ctype, $html);
    $qk = (string) input('quotakey');
    if (in_array($qk, ['nl_split_konkurs', 'nl_split_vip', 'nl_split_kabinet'], true)) {
        $q = max(0, min(1000, (int) input('quota')));
        if ($q > 0) set_setting($qk, (string) $q);
    }
    audit('launch_mail_block_save', 'competition', 0, ['ctype' => $ctype]);
    json_out(['ok' => true, 'msg' => 'Сохранено']);
}

/* --- Сброс email-блока к эталонному шаблону: konkurs | vip | kabinet --- */
if ((string) input('do') === 'mail_block_reset') {
    header('Content-Type: application/json; charset=utf-8');
    if (!csrf_check() || !user_can('admin')) json_out(['ok' => false, 'msg' => 'Нет доступа'], 403);
    $ctype = (string) input('ctype');
    // 'combo' — объединённое письмо запуска (основной блок пульта с августа 2026).
    // 'konkurs'/'vip'/'kabinet' оставлены для разовых кампаний, запускаемых руками.
    if (!in_array($ctype, ['combo', 'konkurs', 'vip', 'kabinet'], true)) json_out(['ok' => false, 'msg' => 'Неизвестный блок'], 422);
    set_setting('launch_mail_html:' . $ctype, '');
    set_setting('launch_mail_subject:' . $ctype, '');
    set_setting('launch_mail_lead:' . $ctype, '');
    audit('launch_mail_block_reset', 'competition', 0, ['ctype' => $ctype]);
    json_out(['ok' => true, 'msg' => 'Сброшено']);
}

/* --- Загрузка/замена афиши поста (multipart) --- */
if ((string) input('do') === 'cover_upload') {
    header('Content-Type: application/json; charset=utf-8');
    if (!csrf_check() || !user_can('admin')) json_out(['ok' => false, 'msg' => 'Нет доступа'], 403);
    $cid = (int) input('id'); $wave = (string) input('wave');
    if (!$cid || !isset(launch_waves()[$wave])) json_out(['ok' => false, 'msg' => 'Не найдено'], 404);
    if (empty($_FILES['cover']) || ($_FILES['cover']['error'] ?? 1) !== UPLOAD_ERR_OK) json_out(['ok' => false, 'msg' => 'Файл не загружен'], 422);
    $f = $_FILES['cover'];
    if (!is_uploaded_file($f['tmp_name'])) json_out(['ok' => false, 'msg' => 'Ошибка загрузки'], 422);
    if ((int) $f['size'] > 15 * 1024 * 1024) json_out(['ok' => false, 'msg' => 'Файл слишком большой (до 15 МБ)'], 413);
    $ext = strtolower(pathinfo((string) $f['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, ['jpg', 'jpeg', 'png', 'webp'], true)) json_out(['ok' => false, 'msg' => 'Только фото (jpg/png/webp)'], 422);
    $mime = function_exists('mime_content_type') ? (string) @mime_content_type($f['tmp_name']) : '';
    if ($mime !== '' && !preg_match('~^image/~', $mime)) json_out(['ok' => false, 'msg' => 'Файл не похож на изображение'], 422);
    $dir = BASE_PATH . '/public/uploads/launch/';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    $name = 'cover_' . $cid . '_' . $wave . '_' . bin2hex(random_bytes(4)) . '.' . $ext;
    if (!@move_uploaded_file($f['tmp_name'], $dir . $name)) json_out(['ok' => false, 'msg' => 'Не удалось сохранить'], 500);
    set_setting('launch_cover:' . $cid . ':' . $wave, 'uploads/launch/' . $name);
    audit('launch_cover_set', 'competition', $cid, ['wave' => $wave]);
    json_out(['ok' => true, 'msg' => 'Афиша обновлена.']);
}
if ((string) input('do') === 'cover_remove') {
    header('Content-Type: application/json; charset=utf-8');
    if (!csrf_check() || !user_can('admin')) json_out(['ok' => false, 'msg' => 'Нет доступа'], 403);
    $cid = (int) input('id'); $wave = (string) input('wave');
    if (!$cid || !isset(launch_waves()[$wave])) json_out(['ok' => false, 'msg' => 'Не найдено'], 404);
    set_setting('launch_cover:' . $cid . ':' . $wave, '__none__');
    audit('launch_cover_del', 'competition', $cid, ['wave' => $wave]);
    json_out(['ok' => true, 'msg' => 'Афиша удалена.']);
}

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

/* ================= ПАНЕЛЬ УПРАВЛЕНИЯ ЗАПУСКОМ (кампания идёт) ================= */
require_once BASE_PATH . '/core/launch_control.php';
require_once BASE_PATH . '/core/newsletter.php';

if (in_array((string) input('do'), ['ctl_mass','ctl_now','ctl_move','ctl_cancel','ctl_restore','ctl_finish'], true)) {
    if (!csrf_check()) { flash('Сессия устарела. Обновите страницу.', 'error'); admin_redirect('launch'); }
    if (!user_can('admin')) { flash('Недостаточно прав.', 'error'); admin_redirect('launch'); }
    $do   = (string) input('do');
    $wave = (string) input('wave');
    $runAt = trim((string) input('run_at'));
    $norm  = $runAt !== '' ? date('Y-m-d H:i:s', strtotime(str_replace('T', ' ', $runAt)) ?: time()) : '';

    if ($do === 'ctl_mass') {
        // Главный выключатель массовых коммуникаций (стоп-кран).
        $on = (string) input('on') === '1';
        mass_sending_set($on);
        if ($on) {
            // Возвращаем в очередь письма, снятые предыдущей остановкой.
            q("UPDATE mail_queue SET status='queued' WHERE status='paused'");
        } else {
            // Снимаем массовые из очереди, личные (priority=0) не трогаем.
            q("UPDATE mail_queue SET status='paused' WHERE status='queued' AND COALESCE(priority,0) > 0");
        }
        audit('launch_mass_toggle', 'competition', 0, ['on' => $on]);
        flash($on ? 'Массовые рассылки и публикации включены — идут по расписанию и квотам.'
                  : 'Всё массовое остановлено. Личные письма участникам продолжают отправляться.',
              $on ? 'success' : 'warning');
        admin_redirect('launch');
    }

    if ($wave === '') { flash('Волна не указана.', 'error'); admin_redirect('launch'); }

    if ($do === 'ctl_move' && $norm !== '') {
        $n = q("UPDATE launch_jobs SET run_at=? WHERE wave=? AND status='scheduled'", [$norm, $wave])->rowCount();
        audit('launch_wave_move', 'competition', 0, ['wave' => $wave, 'at' => $norm, 'count' => $n]);
        flash($n ? ('Волна «' . launch_wave_title($wave) . '» перенесена на ' . lc_dt($norm) . '.') : 'Нечего переносить.', $n ? 'success' : 'info');
        admin_redirect('launch');
    }

    if ($do === 'ctl_cancel') {
        $n = q("UPDATE launch_jobs SET status='cancelled' WHERE wave=? AND status='scheduled'", [$wave])->rowCount();
        audit('launch_wave_cancel', 'competition', 0, ['wave' => $wave, 'count' => $n]);
        flash($n ? ('Волна «' . launch_wave_title($wave) . '» убрана из плана.') : 'Волны в плане не было.', 'success');
        admin_redirect('launch');
    }

    if ($do === 'ctl_restore') {
        $at = $norm !== '' ? $norm : date('Y-m-d H:i:s', strtotime('+1 hour'));
        $n = q("UPDATE launch_jobs SET status='scheduled', run_at=? WHERE wave=? AND status='cancelled'", [$at, $wave])->rowCount();
        audit('launch_wave_restore', 'competition', 0, ['wave' => $wave, 'at' => $at, 'count' => $n]);
        flash($n ? ('Волна возвращена в план на ' . lc_dt($at) . '.') : 'Нечего возвращать.', $n ? 'success' : 'info');
        admin_redirect('launch');
    }

    if ($do === 'ctl_now') {
        // Выполняем волну немедленно: ставим время «сейчас» и прогоняем планировщик.
        // Массовые коммуникации при этом должны быть включены — иначе крон не отправит.
        if (!mass_sending_enabled()) {
            flash('Сначала включите массовые рассылки — сейчас всё остановлено стоп-краном.', 'error');
            admin_redirect('launch');
        }
        q("UPDATE launch_jobs SET run_at=? WHERE wave=? AND status='scheduled'", [date('Y-m-d H:i:s'), $wave]);
        $n = launch_run_due();
        audit('launch_wave_now', 'competition', 0, ['wave' => $wave, 'fired' => $n]);
        flash($n ? ('Волна «' . launch_wave_title($wave) . '» выполнена (заданий: ' . $n . ').')
                 : 'Волна поставлена на ближайшее выполнение.', 'success');
        admin_redirect('launch');
    }

    if ($do === 'ctl_finish') {
        $n = launch_cancel_all();
        mass_sending_set(false);
        q("UPDATE mail_queue SET status='paused' WHERE status='queued' AND COALESCE(priority,0) > 0");
        audit('launch_campaign_finish', 'competition', 0, ['cancelled' => $n]);
        flash('Кампания завершена. Пульт вернулся в режим подготовки запуска.', 'success');
        admin_redirect('launch');
    }
}

/* ---------------- Рендер: пульт запуска ИЛИ панель управления ----------------
   Пока кампания не запущена — пульт подготовки (план, тексты, афиши, каналы).
   Как только появились выполненные/запланированные волны — на этом же месте
   открывается панель управления кампанией. Переключение — по кнопке. */
$view = (string) input('view');
$isRunning = launch_campaign_active();
if ($view === 'plan' || (!$isRunning && $view !== 'control')) {
    $content = launch_panel_html();
    if ($isRunning) {
        $content = '<div class="card" style="margin-bottom:16px;display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between">'
            . '<div><b>Кампания уже идёт</b><div class="small muted">Вы смотрите пульт подготовки. Управление текущей кампанией — на отдельном экране.</div></div>'
            . '<a class="btn btn--primary" href="' . a_link('launch', ['view' => 'control']) . '">Перейти к управлению</a></div>'
            . $content;
    }
    admin_layout('Запуск', $content, 'launch');
} else {
    $content = launch_control_html()
        . '<div style="margin-top:16px"><a class="btn btn--ghost" href="' . a_link('launch', ['view' => 'plan']) . '">Открыть пульт подготовки (тексты, афиши, план)</a></div>';
    admin_layout('Управление запуском', $content, 'launch');
}
