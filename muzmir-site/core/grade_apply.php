<?php
/**
 * ПРИМЕНЕНИЕ ИТОГА АТТЕСТАЦИИ — ОДИН ПУТЬ ДЛЯ ЖЮРИ И ДЛЯ АВТОМАТА.
 *
 * Раньше «сохранить итог» существовало в двух местах и делало разное. Карточка
 * жюри считала срок отправки результата, переделывала наградные документы под
 * новое звание, закрывала задание жюри, слала письмо, если срок уже наступил, и
 * пересчитывала статус заявки. Автоматическая аттестация же писала в заявку три
 * поля — звание, комментарий и статус — и на этом заканчивала.
 *
 * Последствия у этого ровно те, которых владелец и не хотел: у работы, оценённой
 * машиной, не было даты отправки результата, поэтому письмо не уходило вовсе;
 * длинный конкурс не отличался от короткого; статус в кабинете оставался
 * прежним, а старый диплом с прежним званием никто не переделывал. «Полный
 * автомат» на глаз работал, а на деле складывал работы в тихую очередь.
 *
 * Здесь один порядок на оба случая. Разница между жюри и машиной сведена к
 * одному: кто источник решения (для журнала) и как выбран срок отправки —
 * человек может отправить сейчас или назначить дату, автомат всегда идёт по
 * правилу центра.
 *
 * ПРАВИЛА СРОКОВ (от владельца, менять только по его слову):
 *   • короткий конкурс: результат через 5 рабочих дней от подачи, участникам
 *     ВИП-клуба — через 3; наградные документы платного конкурса — тем же
 *     сроком, их изготавливает cron/send_diplomas.php;
 *   • длинный конкурс (results_mode='list'): письма нет вовсе, итоги копятся и
 *     публикуются списком 28-го числа, наградные материалы участник заказывает
 *     сам — центр их не изготавливает.
 */
declare(strict_types=1);

require_once __DIR__ . '/send_timing.php';

/**
 * Сохранить итог аттестации и запустить всё, что за ним следует.
 *
 * @param int    $appId  заявка
 * @param string $result звание из RESULT_PRESETS()
 * @param array  $opt
 *        extra_diploma  — спец-номинация ('' — снять)
 *        jury_comment   — комментарий участнику
 *        send_mode      — 'auto' (по сроку центра, значение по умолчанию),
 *                         'now' (отправить сразу), 'at' (на дату из send_at)
 *        send_at        — дата для режима 'at'
 *        source         — 'jury' | 'ai', попадает в журнал
 *        phonogram      — true: звание снижается до дипломанта (п. 8.7 положения)
 *        run_id         — разбор автооценки, если решение пришло от неё
 * @return array{ok:bool,msg:string,result:string,is_long:bool,send_at:string,sent:bool,dsync:string}
 */
function grade_apply_result(int $appId, string $result, array $opt = []): array {
    $out = ['ok' => false, 'msg' => '', 'result' => $result, 'is_long' => false,
            'send_at' => '', 'sent' => false, 'dsync' => ''];
    if ($appId <= 0) { $out['msg'] = 'заявка не указана'; return $out; }

    $cur = one("SELECT * FROM applications WHERE id=?", [$appId]);
    if (!$cur) { $out['msg'] = 'заявка не найдена'; return $out; }

    if (!function_exists('RESULT_PRESETS')) require_once BASE_PATH . '/core/presets.php';
    $ladder = RESULT_PRESETS();

    /* ФОНОГРАММА — ПОТОЛОК ДИПЛОМАНТА (п. 8.7 положения, одинаково во всех
       конкурсах). Правило записано в документе, который читает участник, поэтому
       исполняется здесь, а не остаётся на память тому, кто ставит звание. */
    if (!empty($opt['phonogram']) && $result !== '') {
        $cap = '';
        foreach ($ladder as $rp) { if (mb_strpos($rp, 'ДИПЛОМАНТ') === 0) { $cap = $rp; break; } }
        $iCur = array_search($result, $ladder, true);
        $iCap = array_search($cap, $ladder, true);
        if ($cap !== '' && $iCur !== false && $iCap !== false && $iCur < $iCap) {
            $result = $cap;
            $out['msg'] = 'Звание снижено до «' . $cap . '»: номер под фонограмму (п. 8.7 положения). ';
        }
    }
    if (!in_array($result, $ladder, true)) { $out['msg'] .= 'звание не из списка'; return $out; }
    $out['result'] = $result;

    $extra    = trim((string) ($opt['extra_diploma'] ?? ($cur['extra_diploma'] ?? '')));
    $jcomment = trim((string) ($opt['jury_comment'] ?? ($cur['jury_comment'] ?? '')));
    $source   = (string) ($opt['source'] ?? 'jury');

    $comp = one("SELECT results_mode, is_paid FROM competitions WHERE id=?", [(int) $cur['competition_id']]);
    $isLong  = (string) ($comp['results_mode'] ?? '') === 'list';
    $compPaid = (int) ($comp['is_paid'] ?? 0) === 1;
    $out['is_long'] = $isLong;

    // Срок считается от ДАТЫ ПОДАЧИ, а не от момента оценки: участник ждёт свои
    // пять рабочих дней с того дня, когда отправил работу, и ускорение оценки
    // машиной не должно превращаться в письмо через час после подачи.
    if (is_file(BASE_PATH . '/core/club.php')) require_once BASE_PATH . '/core/club.php';
    $wdays = (!empty($cur['user_id']) && function_exists('club_is_active') && club_is_active((int) $cur['user_id'])) ? 3 : 5;
    $submitted = (string) ($cur['created_at'] ?? '');

    $mode = (string) ($opt['send_mode'] ?? 'auto');
    $resultAt = null;
    if (!$isLong) {
        $resultAt = match ($mode) {
            'now' => new DateTime('now'),
            'at'  => result_plan_at($submitted, false, (string) ($opt['send_at'] ?? ''), $wdays),
            default => result_plan_at($submitted, true, '', $wdays),
        };
    }
    $resultSendAt = $resultAt ? $resultAt->format('Y-m-d H:i:s') : '';
    $out['send_at'] = $resultSendAt;

    $firstGrade    = trim((string) ($cur['result'] ?? '')) === '';
    $resultChanged = (string) $cur['result'] !== $result;
    $extraChanged  = (string) ($cur['extra_diploma'] ?? '') !== $extra;
    $changed = $resultChanged || $extraChanged;

    update('applications', [
        'result' => $result, 'score' => null,
        'extra_diploma' => $extra, 'jury_comment' => $jcomment,
        'status' => 'graded',
        'result_send_at' => $resultSendAt,
        // Итог изменился, а письмо ещё не ушло — отправим заново по новому сроку.
        'result_sent_at' => ($changed && !$firstGrade) ? '' : (string) ($cur['result_sent_at'] ?? ''),
        'send_at_override' => '',
    ], 'id=:wid', ['wid' => $appId]);
    q("UPDATE applications SET graded_at=? WHERE id=? AND (graded_at IS NULL OR graded_at='')",
      [date('Y-m-d H:i:s'), $appId]);
    q("UPDATE jury_assignments SET done=1 WHERE application_id=?", [$appId]);

    // Наградные документы приводятся в соответствие новому званию: бланк
    // переделывается, номер сохраняется — он напечатан в реестре и проверяется
    // сервисом подлинности.
    if ($changed) {
        require_once BASE_PATH . '/core/diploma_sync.php';
        $out['dsync'] = dsync_apply($appId, (array) $cur,
            ['result' => $result, 'extra_diploma' => $extra, 'status' => 'graded']);
    }

    // Срок наступил — письмо уходит сейчас; иначе его отправит cron/send_diplomas
    // по result_send_at. У длинного конкурса письма нет: итоги публикуются списком.
    $dueNow = $resultAt && $resultAt <= new DateTime('now');
    if (!$isLong && ($firstGrade || $changed) && $dueNow) {
        if (is_file(BASE_PATH . '/core/result_mail.php'))   require_once BASE_PATH . '/core/result_mail.php';
        if (is_file(BASE_PATH . '/core/notifications.php')) require_once BASE_PATH . '/core/notifications.php';
        if (function_exists('result_mail_send')) {
            try { $out['sent'] = (bool) result_mail_send($appId); } catch (\Throwable $e) { $out['sent'] = false; }
        }
        if ($out['sent']) q("UPDATE applications SET result_sent_at=? WHERE id=?", [date('Y-m-d H:i:s'), $appId]);
        if (!empty($cur['user_id']) && function_exists('notify_user')) {
            $tail = $compPaid
                ? 'Наградные документы придут на почту из заявки в течение ' . $wdays . ' рабочих дней.'
                : 'Наградные материалы можно заказать в разделе «Награды и заказы».';
            notify_user((int) $cur['user_id'], 'Ваш результат готов',
                'Жюри подвело итоги: ' . $result . '. ' . $tail, url('/cabinet'), 'award');
        }
    }

    // Статус заявки — строго по фактам: «Оценена» появляется только после
    // реальной отправки результата, иначе участник видел бы звание раньше письма.
    require_once BASE_PATH . '/core/app_status.php';
    app_status_sync($appId);

    if (function_exists('audit')) {
        audit($source === 'ai' ? 'ai_grade_applied' : 'grade_result', 'application', $appId,
              ['result' => $result, 'extra' => $extra, 'result_at' => $resultSendAt,
               'source' => $source, 'run' => (int) ($opt['run_id'] ?? 0), 'diploma_sync' => $out['dsync']]);
    }

    $out['ok'] = true;
    $out['msg'] .= $isLong
        ? 'Итог сохранён, публикуется списком 28-го числа.'
        : ($out['sent'] ? 'Итог сохранён, результат отправлен участнику.'
                        : 'Итог сохранён, результат уйдёт ' . ($resultSendAt !== '' ? date('d.m.Y H:i', strtotime($resultSendAt)) : 'по расписанию') . '.');
    return $out;
}
