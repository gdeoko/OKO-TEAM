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

/* ---------------- Рендер: встроенный пульт (без модалок) ---------------- */
$content = launch_panel_html();
admin_layout('Запуск', $content, 'launch');
