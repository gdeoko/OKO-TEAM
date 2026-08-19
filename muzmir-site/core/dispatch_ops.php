<?php
/**
 * Операции над отправками: результат аттестации и наградные документы.
 *
 * Одна и та же логика нужна в трёх местах админки — «Заявки» (карточка),
 * «Отправки» (живой пульт) и «Заказы электронных». Раньше она была написана
 * только внутри admin/dispatch.php, поэтому из карточки заявки ничего нельзя
 * было ни отправить, ни перенести, ни продублировать.
 *
 * Все функции возвращают ['ok'=>bool, 'msg'=>string] и ничего не печатают.
 */
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/app_status.php';

/** Нормализует строку из datetime-local в 'Y-m-d H:i:s'. Пусто → ''. */
function dops_norm_dt(string $dt): string {
    $dt = trim($dt);
    if ($dt === '') return '';
    $ts = strtotime(str_replace('T', ' ', $dt));
    return $ts ? date('Y-m-d H:i:s', $ts) : '';
}

/** Короткая русская дата-время. */
function dops_dt(string $s): string {
    $s = trim($s);
    if ($s === '') return '—';
    $ts = strtotime($s);
    return $ts ? date('d.m.Y H:i', $ts) : $s;
}

/* ============================ РЕЗУЛЬТАТ АТТЕСТАЦИИ ============================ */

/**
 * Отправить результат участнику немедленно.
 * $duplicate=true — повторная отправка уже отправленного (кнопка «Продублировать»).
 */
function dops_result_send_now(int $appId, bool $duplicate = false): array {
    $a = one("SELECT * FROM applications WHERE id=?", [$appId]);
    if (!$a) return ['ok' => false, 'msg' => 'Заявка не найдена.'];
    if (trim((string) ($a['result'] ?? '')) === '') {
        return ['ok' => false, 'msg' => 'По заявке ещё нет результата — отправлять нечего.'];
    }
    $already = trim((string) ($a['result_sent_at'] ?? '')) !== '';
    if ($already && !$duplicate) {
        return ['ok' => false, 'msg' => 'Результат уже отправлен. Используйте «Продублировать».'];
    }

    // РЕЗУЛЬТАТ КОНКУРСА С ОГЛАШЕНИЕМ СПИСКОМ НЕ УХОДИТ РАНЬШЕ ОГЛАШЕНИЯ.
    //
    // У длинного конкурса итоги объявляются в назначенный день сразу всем: пост
    // в сообществе, список на сайте, письма участникам. Одна нажатая кнопка
    // «Отправить сейчас» ломает это правило — один участник узнаёт звание раньше
    // остальных, и оглашение перестаёт быть оглашением. Кнопка снова заработает,
    // как только конкурс опубликует результаты.
    $comp = one("SELECT name, results_mode, results_date, results_published_at
                   FROM competitions WHERE id=?", [(int) ($a['competition_id'] ?? 0)]);
    if ($comp && (string) ($comp['results_mode'] ?? '') === 'list'
        && trim((string) ($comp['results_published_at'] ?? '')) === '') {
        $day = trim((string) ($comp['results_date'] ?? ''));
        return ['ok' => false, 'msg' => 'Итоги конкурса «' . (string) $comp['name'] . '» объявляются списком'
            . ($day !== '' ? ' ' . (function_exists('ru_date') ? ru_date($day) : $day) : '')
            . '. До оглашения результат участнику не отправляется — опубликуйте итоги конкурса.'];
    }

    require_once BASE_PATH . '/core/result_mail.php';
    if (is_file(BASE_PATH . '/core/notifications.php')) require_once BASE_PATH . '/core/notifications.php';

    $ok = false;
    try { $ok = function_exists('result_mail_send') ? (bool) result_mail_send($appId) : false; }
    catch (\Throwable $e) { $ok = false; }

    $now = date('Y-m-d H:i:s');
    if (!$already) {
        update('applications', ['result_sent_at' => $now, 'result_send_at' => $now], 'id=:id', ['id' => $appId]);
        if (!empty($a['user_id']) && function_exists('notify_user')) {
            notify_user((int) $a['user_id'], 'Ваш результат готов',
                'Жюри подвело итоги: ' . (string) $a['result'] . '.', url('/cabinet'), 'award');
        }
    }
    app_status_sync($appId);
    audit($duplicate ? 'result_duplicate' : 'result_sendnow', 'application', $appId, ['ok' => $ok]);

    return ['ok' => true, 'msg' => $ok
        ? ($duplicate ? 'Письмо с результатом отправлено повторно.' : 'Результат отправлен участнику.')
        : 'Результат помечен отправленным, письмо ушло в очередь (проверьте «Отправки»).'];
}

/** Перенести плановую отправку результата. */
function dops_result_resched(int $appId, string $dt): array {
    $norm = dops_norm_dt($dt);
    if ($norm === '') return ['ok' => false, 'msg' => 'Укажите дату и время.'];
    $a = one("SELECT result, result_sent_at FROM applications WHERE id=?", [$appId]);
    if (!$a) return ['ok' => false, 'msg' => 'Заявка не найдена.'];
    if (trim((string) ($a['result_sent_at'] ?? '')) !== '') {
        return ['ok' => false, 'msg' => 'Результат уже отправлен — перенос невозможен.'];
    }
    update('applications', ['result_send_at' => $norm], 'id=:id', ['id' => $appId]);
    app_status_sync($appId);
    audit('result_resched', 'application', $appId, ['at' => $norm]);
    return ['ok' => true, 'msg' => 'Отправка результата перенесена на ' . dops_dt($norm) . '.'];
}

/** Отменить плановую отправку результата (сама оценка сохраняется). */
function dops_result_cancel(int $appId): array {
    $a = one("SELECT result_sent_at FROM applications WHERE id=?", [$appId]);
    if (!$a) return ['ok' => false, 'msg' => 'Заявка не найдена.'];
    if (trim((string) ($a['result_sent_at'] ?? '')) !== '') {
        return ['ok' => false, 'msg' => 'Результат уже отправлен — отменять нечего.'];
    }
    update('applications', ['result_send_at' => ''], 'id=:id', ['id' => $appId]);
    app_status_sync($appId);
    audit('result_cancel', 'application', $appId, []);
    return ['ok' => true, 'msg' => 'Плановая отправка результата отменена.'];
}

/* ========================== НАГРАДНЫЕ ДОКУМЕНТЫ ========================== */

/**
 * Ленивая колонка diplomas.queue_id — номер письма в mail_queue, которым ушёл
 * наградный материал. Нужна, чтобы отказ почты не терял диплом: письмо стоит в
 * очереди, крон второе не шлёт, а по факту доставки очередь проставит sent_at
 * (сверку делает cron/send_diplomas.php).
 */
function dops_ensure_queue_col(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    try { db()->exec("ALTER TABLE diplomas ADD COLUMN queue_id INTEGER"); } catch (\Throwable $e) {}
}

/** Все дипломы заявки (осн./доп./именной/благодарность) в порядке показа. */
function dops_diplomas(int $appId): array {
    return all("SELECT * FROM diplomas WHERE application_id=?
                 ORDER BY CASE type WHEN 'main' THEN 1 WHEN 'extra' THEN 2 WHEN 'named' THEN 3
                                    WHEN 'thanks' THEN 4 ELSE 5 END, id", [$appId]);
}

/**
 * Отправить наградные документы заявки ОДНИМ письмом прямо сейчас.
 * $duplicate=true — повторная отправка уже отправленных.
 * Используется общий рендер письма из cron/send_diplomas.php (тот же вид, что у участника).
 */
function dops_diplomas_send_now(int $appId, bool $duplicate = false): array {
    $items = dops_diplomas($appId);
    if (!$items) return ['ok' => false, 'msg' => 'По заявке нет наградных документов.'];

    $pending = array_values(array_filter($items, fn($d) => trim((string) ($d['sent_at'] ?? '')) === ''));
    $send    = $duplicate ? $items : $pending;
    if (!$send) return ['ok' => false, 'msg' => 'Все документы уже отправлены. Используйте «Продублировать».'];

    $a = one("SELECT a.*, c.name AS comp_name FROM applications a
              LEFT JOIN competitions c ON c.id=a.competition_id WHERE a.id=?", [$appId]);
    if (!$a) return ['ok' => false, 'msg' => 'Заявка не найдена.'];
    $to = trim((string) ($a['email'] ?? ''));
    if ($to === '' || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return ['ok' => false, 'msg' => 'В заявке нет корректного адреса почты.'];
    }

    // Библиотечный режим крона: берём его же сборку письма и вложений.
    if (!function_exists('_diploma_group_html')) {
        if (!defined('MM_EMAIL_TEST_LIB')) define('MM_EMAIL_TEST_LIB', 1);
        if (is_file(BASE_PATH . '/cron/send_diplomas.php')) require_once BASE_PATH . '/cron/send_diplomas.php';
    }

    $attachments = []; $blocks = [];
    foreach ($send as $d) {
        $pdfAbs = ''; $imgUrl = '';
        if (function_exists('_diploma_files')) [$pdfAbs, $imgUrl] = _diploma_files((array) $d);
        if ($pdfAbs !== '') $attachments[] = $pdfAbs;
        $blocks[] = ['type' => (string) ($d['type'] ?? 'main'), 'result' => (string) ($d['result'] ?? ''),
                     'number' => (string) ($d['number'] ?? ''), 'img' => $imgUrl];
    }

    $cnt  = count($send);
    $subj = ($cnt > 1 ? 'Ваши наградные материалы конкурса «' : 'Ваш наградной материал конкурса «')
          . (string) ($a['comp_name'] ?? '') . '» - заявка № ' . (string) ($a['number'] ?? '');
    $html = function_exists('_diploma_group_html')
        ? _diploma_group_html($blocks, (string) ($a['full_name'] ?? ''), (string) ($a['comp_name'] ?? ''))
        : '<p>Ваш наградной материал во вложении.</p>';

    $opt = [];
    if (function_exists('mail_senders')) {
        $nagradi = mail_senders()['nagradi'] ?? [];
        if ($nagradi) { $opt['account'] = $nagradi; $opt['from_name'] = 'Наградный отдел «Музыкальный Мир»'; }
    }
    if ($attachments) $opt['attachments'] = $attachments;

    $ok = false;
    // Автозамена почтового ящика: письмо уйдёт с любой рабочей почты центра.
    if (function_exists('mail_send_failover')) {
        try { $ok = (bool) mail_send_failover($to, $subj, $html, $opt); } catch (\Throwable $e) { $ok = false; }
    } elseif (function_exists('mail_send')) {
        try { $ok = (bool) mail_send($to, $subj, $html, $opt); } catch (\Throwable $e) { $ok = false; }
    }
    $switched = function_exists('mail_switched') ? mail_switched() : '';
    $why      = function_exists('mail_last_error') ? mail_last_error() : '';

    // НЕ УШЛО — ЗНАЧИТ НЕ УШЛО.
    //
    // Раньше время отправки проставлялось независимо от результата: оргкомитет
    // жал «Отправить сейчас», видел «Наградные документы отправлены», диплом
    // помечался отправленным — а письма не было. Понять это можно было только со
    // слов участника. Теперь при сбое письмо кладётся в очередь целиком (все
    // вложения, а не первое), диплом остаётся неотправленным, и в ответе прямо
    // сказано, что произошло.
    $queued = false; $qid = 0;
    if (!$ok && function_exists('mail_queue')) {
        // Очередь понимает список вложений как JSON (core/newsletter.php), поэтому
        // один файл кладём строкой, несколько — списком: иначе доедет только первый.
        $qid = mail_queue($to, (string) ($a['full_name'] ?? ''), $subj, $html,
                          count($attachments) > 1 ? json_encode(array_values($attachments)) : ($attachments[0] ?? ''));
        $queued = $qid > 0;
    }

    $now = date('Y-m-d H:i:s');
    if (!$duplicate && ($ok || $queued)) {
        dops_ensure_queue_col();
        foreach ($send as $d) {
            if ($ok) {
                // Письмо с прошлой неудачной попытки могло остаться в очереди —
                // гасим его, иначе участник получит награду двумя письмами.
                $prevQ = (int) ($d['queue_id'] ?? 0);
                if ($prevQ > 0) {
                    try {
                        q("UPDATE mail_queue SET status='cancelled', error='наградный материал отправлен вручную'
                            WHERE id=? AND status='queued'", [$prevQ]);
                    } catch (\Throwable $e) {}
                }
                update('diplomas', ['sent_at' => $now, 'send_tries' => 0, 'queue_id' => null], 'id=:id', ['id' => (int) $d['id']]);
                continue;
            }
            // ПУСТАЯ СТРОКА В sent_at ТЕРЯЛА НАГРАДНЫЙ МАТЕРИАЛ НАВСЕГДА.
            //
            // При отказе почты сюда писалось sent_at='', а неотправленные всюду
            // отбираются по sent_at IS NULL (крон, «Отправки»). Пустая строка не
            // проходит ни туда, ни сюда: диплом исчезал и из автоотправки, и из
            // живого пульта, оставаясь недоставленным. Теперь sent_at не трогаем
            // вовсе, а факт постановки в очередь держим в queue_id: крон не пошлёт
            // второе письмо, пока оно там стоит, и сам проставит время, когда
            // очередь письмо отдаст (или вернёт материал в работу, если не отдаст).
            update('diplomas', ['send_tries' => 0, 'queue_id' => $qid], 'id=:id', ['id' => (int) $d['id']]);
        }
    }
    app_status_sync($appId);
    audit($duplicate ? 'diplomas_duplicate' : 'diplomas_sendnow', 'application', $appId,
          ['ok' => $ok, 'count' => $cnt, 'queued' => $queued, 'error' => mb_substr($why, 0, 200)]);

    if ($ok) {
        return ['ok' => true, 'msg' => ($duplicate ? 'Письмо с наградами отправлено повторно' : 'Наградные документы отправлены')
            . ' (' . $cnt . ' шт., одним письмом на ' . $to . ').'
            . ($switched !== '' ? ' Основная почта не ответила, отправлено с резервной: ' . $switched . '.' : '')];
    }
    if ($queued) {
        return ['ok' => true, 'msg' => 'Почта сейчас не приняла письмо, оно поставлено в очередь и уйдёт ближайшим заходом ('
            . $cnt . ' шт. на ' . $to . '). Причина: ' . mb_substr($why, 0, 160)];
    }
    return ['ok' => false, 'msg' => 'Письмо не отправлено и в очередь не встало: ' . mb_substr($why, 0, 200)];
}

/** Перенести отправку всех неотправленных наградных документов заявки. */
function dops_diplomas_resched(int $appId, string $dt): array {
    $norm = dops_norm_dt($dt);
    if ($norm === '') return ['ok' => false, 'msg' => 'Укажите дату и время.'];
    $n = q("UPDATE diplomas SET scheduled_at=?, send_tries=0
             WHERE application_id=? AND (sent_at IS NULL OR sent_at='')", [$norm, $appId])->rowCount();
    if ($n === 0) return ['ok' => false, 'msg' => 'Нет неотправленных документов для переноса.'];
    app_status_sync($appId);
    audit('diplomas_resched', 'application', $appId, ['at' => $norm, 'count' => $n]);
    return ['ok' => true, 'msg' => 'Отправка наград перенесена на ' . dops_dt($norm) . ' (' . $n . ' шт.).'];
}

/** Отменить плановую отправку наградных документов (удаляет неотправленные). */
function dops_diplomas_cancel(int $appId): array {
    // ЧТО СНОСИМ — ЗНАТЬ НАДО ДО УДАЛЕНИЯ.
    //
    // Обещание «документы пересоберутся автоматически» было неправдой: центр сам
    // изготавливает только основной и дополнительный дипломы и только короткого
    // платного конкурса (cron/send_diplomas.php). Именной и благодарность — в том
    // числе оплаченные заказом — не восстановит никто, поэтому говорим прямо, что
    // именно исчезло и что придётся выпустить руками.
    $doomed = all("SELECT type FROM diplomas WHERE application_id=? AND (sent_at IS NULL OR sent_at='')", [$appId]);
    if (!$doomed) return ['ok' => false, 'msg' => 'Нет запланированных документов.'];
    $manual = 0;
    foreach ($doomed as $d) if (!in_array((string) ($d['type'] ?? ''), ['main', 'extra'], true)) $manual++;
    $c = one("SELECT c.results_mode, c.is_paid FROM applications a
                LEFT JOIN competitions c ON c.id=a.competition_id WHERE a.id=?", [$appId]);
    $auto = $c && (string) ($c['results_mode'] ?? 'email') !== 'list' && (int) ($c['is_paid'] ?? 0) === 1;

    $n = q("DELETE FROM diplomas WHERE application_id=? AND (sent_at IS NULL OR sent_at='')", [$appId])->rowCount();
    app_status_sync($appId);
    audit('diplomas_cancel', 'application', $appId, ['count' => $n, 'manual' => $manual]);
    $msg = 'Плановая отправка наград отменена (' . $n . ' шт.).'
         . ($auto ? ' Основной и дополнительный дипломы центр соберёт заново сам.'
                  : ' Заново они НЕ соберутся: конкурс бесплатный либо с оглашением списком.');
    if ($manual > 0) {
        $msg .= ' Именной диплом и благодарность (' . $manual . ' шт.) автоматически не создаются — выпустите их в разделе «Дипломы».';
    }
    return ['ok' => true, 'msg' => $msg];
}
