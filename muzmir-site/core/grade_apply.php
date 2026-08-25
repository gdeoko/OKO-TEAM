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
    $phonoNote = '';
    if (!empty($opt['phonogram']) && $result !== '') {
        $cap = '';
        foreach ($ladder as $rp) { if (mb_strpos($rp, 'ДИПЛОМАНТ') === 0) { $cap = $rp; break; } }
        $iCur = array_search($result, $ladder, true);
        $iCap = array_search($cap, $ladder, true);
        if ($cap !== '' && $iCur !== false && $iCap !== false && $iCur < $iCap) {
            $result = $cap;
            /* ПРИЧИНА СНИЖЕНИЯ ДОЛЖНА БЫТЬ ВИДНА УЧАСТНИКУ.
             *
             * Звание опускалось молча: в заявке стояло «дипломант», и человек,
             * рассчитывавший на лауреата, не понимал, что произошло, — а спросить
             * было не у кого, потому что нигде не написано. Формулировка идёт
             * первой строкой в комментарии жюри: он уходит в письме с результатом
             * и виден в личном кабинете. Текст — общий PHONOGRAM_NOTE, слово в
             * слово тот же, что жюри видит у галочки при оценке. */
            if (!defined('PHONOGRAM_NOTE')) require_once BASE_PATH . '/core/presets.php';
            $phonoNote  = PHONOGRAM_NOTE;
            $out['msg'] = PHONOGRAM_NOTE . '. ';
        }
    }
    if (!in_array($result, $ladder, true)) { $out['msg'] .= 'звание не из списка'; return $out; }
    $out['result'] = $result;

    $extra    = trim((string) ($opt['extra_diploma'] ?? ($cur['extra_diploma'] ?? '')));
    $jcomment = trim((string) ($opt['jury_comment'] ?? ($cur['jury_comment'] ?? '')));
    // Пометка о фонограмме ставится первой строкой и только один раз — повторное
    // сохранение итога не должно её дублировать.
    if ($phonoNote !== '' && mb_strpos($jcomment, 'голосовой фонограммы') === false) {
        $jcomment = $phonoNote . ($jcomment !== '' ? "\n\n" . $jcomment : '');
    }
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

    /* РЕШЕНИЕ ЖЮРИ — УРОК ДЛЯ МАШИНЫ.
     *
     * Если по заявке была подсказка, а человек поставил другое звание, это
     * расхождение записывается и попадает в поправку для следующих оценок.
     * Записываем и совпадения: без них статистика состояла бы из одних ошибок и
     * поправка росла бы бесконечно. Решения самой машины сюда не идут — учиться
     * на собственном ответе бессмысленно. */
    if ($source !== 'ai') {
        require_once BASE_PATH . '/core/grade_feedback.php';
        gfb_record($appId, $result, (string) ($cur['nomination'] ?? ''));
        /* Совпало — значит человек согласен с подсказкой, и делать нечего.
           Разошлось — запись пересматривается заново, уже зная решение жюри:
           модель разбирает, что упустила, и этот разбор идёт в задание следующих
           оценок. Пересмотр долгий, поэтому уходит в фон — сохранение итога его
           не ждёт. */
        $fb = one("SELECT steps, lesson FROM grade_feedback WHERE application_id=?", [$appId]);
        if ($fb && (int) $fb['steps'] !== 0 && trim((string) ($fb['lesson'] ?? '')) === '') {
            gfb_learn_async($appId);
            $out['msg'] .= 'Расхождение с подсказкой — работа отправлена на пересмотр для обучения. ';
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

/**
 * ОТКЛОНЕНИЕ ЗАЯВКИ — ОДИН ПУТЬ ДЛЯ ЖЮРИ И ДЛЯ АВТОМАТА.
 *
 * Отклонение — это не «поставить статус». За ним тянется всё остальное: снять
 * наградные документы, вернуть учреждению партнёрскую скидку, вернуть оргвзнос
 * платной заявки и написать участнику, что именно нарушено и как подать заново.
 * Пропусти любой шаг — и человек останется без денег, с висящим дипломом или без
 * объяснения, за что его сняли с конкурса.
 *
 * Поэтому порядок один и тот же, кем бы решение ни принималось.
 *
 * @param string $reason  причина 1:1 из положения (см. REJECT_REASONS)
 * @param string $source  'jury' | 'ai'
 * @return array{ok:bool,msg:string,mailed:bool,refunded:int,refund_error:string}
 */
function grade_reject_application(int $appId, string $reason, string $source = 'jury'): array {
    $out = ['ok' => false, 'msg' => '', 'mailed' => false, 'refunded' => 0, 'refund_error' => ''];
    $reason = trim($reason);
    if ($appId <= 0 || $reason === '') { $out['msg'] = 'нужны заявка и причина'; return $out; }

    $a = one("SELECT a.*, c.name comp FROM applications a
               LEFT JOIN competitions c ON c.id = a.competition_id WHERE a.id=?", [$appId]);
    if (!$a) { $out['msg'] = 'заявка не найдена'; return $out; }
    if ((string) ($a['status'] ?? '') === 'rejected') { $out['ok'] = true; $out['msg'] = 'заявка уже отклонена'; return $out; }

    update('applications', ['status' => 'rejected', 'reject_reason' => $reason], 'id=:wid', ['wid' => $appId]);

    // Наградные документы отклонённой работы снимаются целиком: файлы, записи
    // реестра и письмо из очереди, если оно ещё не ушло.
    require_once BASE_PATH . '/core/diploma_sync.php';
    dsync_drop($appId, 'заявка отклонена: ' . mb_substr($reason, 0, 80));

    // Партнёрская скидка возвращается учреждению: участия не будет.
    if (is_file(BASE_PATH . '/core/partner.php')) require_once BASE_PATH . '/core/partner.php';
    if (function_exists('partner_release_promo')) partner_release_promo($appId);

    // Оргвзнос платной заявки возвращается автоматически (п. 7.6.1 положения).
    $refunded = false;
    if ((int) ($a['is_paid'] ?? 0) === 1) {
        require_once BASE_PATH . '/core/payments.php';
        try {
            $r = refund_application($appId, $reason);
            if (!empty($r['ok']) && (int) ($r['amount'] ?? 0) > 0) {
                $refunded = true;
                $out['refunded'] = (int) $r['amount'];
            } elseif (!empty($r['error'])) {
                $out['refund_error'] = (string) $r['error'];
            }
        } catch (\Throwable $e) { $out['refund_error'] = $e->getMessage(); }
    }

    // Письмо участнику: причина, возврат и — пока идёт приём — приглашение подать заново.
    if (trim((string) $a['email']) !== '' && is_file(BASE_PATH . '/core/result_mail.php')) {
        require_once BASE_PATH . '/core/result_mail.php';
        try {
            $name  = trim((string) $a['full_name']);
            $hello = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
            $comp  = one("SELECT * FROM competitions WHERE id=?", [(int) $a['competition_id']]) ?: ['name' => (string) $a['comp']];

            /* «ПОДАЙТЕ ЗАЯВКУ ЗАНОВО» — ТОЛЬКО ПОКА ЗАЯВКУ ДЕЙСТВИТЕЛЬНО ПРИНИМАЮТ.
             *
             * Остаток работ жюри разбирает и после 25-го числа, когда приём уже
             * закрыт. Письмо звало устранить причину и подать заново, кнопка вела
             * в форму — а форма отвечала, что приём этого месяца завершён. Человек
             * получал отказ и следом обещание, выполнить которое нельзя.
             *
             * Условие то же, по которому форма решает, принимать ли заявку
             * (api/v1/apply.php): конкурс в 'open' или 'judging' и общий приём
             * месяца не закрыт. Закрыт — письмо просто сообщает об отклонении с
             * причиной и возвратом, без предложения подать снова. */
            $canReapply = in_array((string) ($comp['status'] ?? ''), ['open', 'judging'], true)
                       && (string) (function_exists('setting') ? setting('intake_closed', '') : '') !== '1';
            $card  = rm_mail_app_card((array) $a, (array) $comp);
            $extraRows = rm_card_row('Форма исполнения', (string) ($a['formation'] ?? ''))
                       . rm_card_row('Подраздел',        (string) ($a['subgroup'] ?? ''))
                       . rm_card_row('Город',            (string) ($a['city'] ?? ''))
                       . rm_card_row('E-mail',           (string) ($a['email'] ?? ''))
                       . rm_card_row('Телефон',          (string) ($a['phone'] ?? ''))
                       . rm_card_row('Ссылка на видео',  (string) ($a['video_url'] ?? ''));
            if ($extraRows !== '') {
                $card = preg_replace('~</table>\s*</td></tr></table>~', $extraRows . '</table></td></tr></table>', $card, 1);
            }
            $inner = '<h1 style="margin:0 0 16px;font-family:Georgia,\'Times New Roman\',serif;font-size:24px;line-height:1.3;font-weight:700;color:' . RM_NAVY . ';">Заявка №' . h((string) $a['number']) . ' не принята к участию</h1>'
                . '<p style="margin:0 0 14px;">' . $hello . '</p>'
                . '<p style="margin:0 0 18px;">К сожалению, Оргкомитет не может допустить Вашу заявку на конкурс «' . h((string) $a['comp']) . '» по указанной ниже причине. Ниже — полный состав Вашей заявки для сверки.</p>'
                . $card
                . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#FDF1F1;border:1px solid #EBC7C7;border-radius:14px;">'
                . '<tr><td style="padding:16px 22px;"><div style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#A0403E;margin-bottom:6px;">Причина отклонения (пункт положения 1:1)</div>'
                . '<div style="font-size:14px;line-height:1.7;color:' . RM_INK . ';">' . nl2br(h($reason)) . '</div></td></tr></table>'
                . ($canReapply
                    ? '<p style="margin:0 0 14px;">Это не отказ навсегда, пожалуйста, устраните причину отклонения и <b style="color:' . RM_NAVY . ';">подайте заявку заново</b> — мы с радостью примем её к аттестации!</p>'
                    : '')
                . ($refunded
                    ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background:#EAF7EF;border:1px solid #BFE6CC;border-radius:14px;">'
                      . '<tr><td style="padding:16px 22px;"><div style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#1E7A44;margin-bottom:6px;">Возврат средств</div>'
                      . '<div style="font-size:14px;line-height:1.7;color:' . RM_INK . ';">Оргвзнос <b>' . $out['refunded'] . ' ₽</b> возвращён в полном объёме на ту же карту или способ оплаты. Зачисление обычно занимает до 3 рабочих дней (срок зависит от банка).</div></td></tr></table>'
                    : '<p style="margin:0 0 4px;color:' . RM_MUTED . ';font-size:13px;">Если был внесён оргвзнос, он возвращается в полном объёме (п. 7.6.1 положения).</p>')
                . ($canReapply
                    ? rm_mail_btn(url('/apply?competition=' . rawurlencode((string) ($comp['slug'] ?? ''))), 'Подать заявку заново')
                    : rm_mail_btn(url('/cabinet'), 'Личный кабинет'));
            $html = rm_mail_layout($inner, $canReapply
                ? 'Заявка №' . (string) $a['number'] . ': устраните причину и подайте заявку заново — мы с радостью примем её к аттестации.'
                : 'Заявка №' . (string) $a['number'] . ' не принята к участию. Причина — внутри письма.');
            $out['mailed'] = mail_queue((string) $a['email'], $name,
                $canReapply
                    ? 'Заявка №' . (string) $a['number'] . ' — устраните причину и подайте заново'
                    : 'Заявка №' . (string) $a['number'] . ' не принята к участию',
                $html) > 0;
        } catch (\Throwable $e) { /* письмо не должно ломать отклонение */ }
    }

    require_once BASE_PATH . '/core/app_status.php';
    app_status_sync($appId);
    if (function_exists('audit')) {
        audit('application_reject', 'application', $appId, ['reason' => $reason, 'source' => $source]);
    }

    $out['ok']  = true;
    $out['msg'] = 'Заявка отклонена.'
        . ($out['mailed'] ? ' Участнику отправлено письмо с причиной и предложением подать заново.' : '')
        . ($out['refunded'] > 0 ? ' Возврат ' . $out['refunded'] . ' ₽ отправлен в ЮKassa.' : '')
        . ($out['refund_error'] !== '' ? ' ВНИМАНИЕ: автовозврат не прошёл (' . $out['refund_error'] . ') — верните вручную в ЛК ЮKassa.' : '');
    return $out;
}
