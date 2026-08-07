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
    echo launch_email_html($c, $wave, $sib);
    exit;
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
