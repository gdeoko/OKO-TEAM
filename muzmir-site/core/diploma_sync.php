<?php
/**
 * СИНХРОНИЗАЦИЯ НАГРАДНЫХ МАТЕРИАЛОВ С ЗАЯВКОЙ.
 *
 * Диплом изготавливается сразу после оценки и ждёт своего часа отправки. Всё
 * это время он живёт отдельной жизнью: в нём напечатаны фамилия, название
 * номера, номинация, возрастная категория, педагог, учреждение и звание —
 * ровно так, как они выглядели в минуту изготовления.
 *
 * Дальше человек открывает заявку и видит, что в фамилии опечатка, номинация
 * указана не та или звание надо поправить. Он исправляет заявку — и до сих пор
 * ничего не происходило: бланк оставался старым, а участник получал диплом с
 * ошибкой, которую в системе давно исправили.
 *
 * Здесь это закрыто тремя правилами:
 *
 *   1. Изменилось что-то, что напечатано в дипломе — бланк переделывается.
 *      Если письмо ещё не ушло, участник просто получит правильный документ и
 *      никогда не узнает, что была ошибка.
 *   2. Диплом уже отправлен — переделываем и отправляем заново, с коротким
 *      пояснением. Молча подменить нельзя: у человека на руках старый файл.
 *   3. Заявка отклонена или у неё убрали результат — наградные материалы
 *      удаляются вместе с файлами, а неотправленное письмо снимается с очереди.
 *      Диплом по отклонённой работе не должен существовать даже в архиве.
 *
 * Номер диплома при переделке НЕ меняется: он напечатан в реестре, назван в
 * письме и может быть уже проверен через сервис проверки подлинности.
 */
declare(strict_types=1);

require_once BASE_PATH . '/core/pdf_diploma.php';
if (is_file(BASE_PATH . '/core/diploma_render.php')) require_once BASE_PATH . '/core/diploma_render.php';

/** Поля заявки, которые печатаются в бланке. Правка любого из них — повод переделать. */
function dsync_printed_fields(): array {
    return ['full_name', 'group_name', 'is_group', 'teacher', 'institution', 'city',
            'nomination', 'subgroup', 'work_title', 'age_category', 'formation',
            'result', 'extra_diploma'];
}

/** Что из напечатанного изменилось между двумя состояниями заявки. */
function dsync_changed(array $before, array $after): array {
    $out = [];
    foreach (dsync_printed_fields() as $f) {
        if (!array_key_exists($f, $after)) continue;
        if (trim((string) ($before[$f] ?? '')) !== trim((string) ($after[$f] ?? ''))) $out[] = $f;
    }
    return $out;
}

/** Удаление файла бланка с диска: осиротевшие PDF копятся и путают при разборе. */
function dsync_unlink(string $path): void {
    if ($path === '') return;
    $full = str_starts_with($path, '/') ? $path : BASE_PATH . '/' . ltrim($path, '/');
    // Удаляем только внутри своих папок: бланки лежат в public/diplomas,
    // рабочие файлы — в data. Проверка не формальность: в pdf_path когда-нибудь
    // окажется чужой путь, и без неё скрипт снесёт не то.
    $own = str_contains($full, '/public/diplomas/') || str_contains($full, '/data/');
    if ($own && is_file($full)) @unlink($full);
}

/**
 * УДАЛИТЬ НАГРАДНЫЕ МАТЕРИАЛЫ ЗАЯВКИ.
 *
 * Вызывается при отклонении заявки и при снятии результата. Неотправленное
 * письмо снимается с очереди — иначе диплом по отклонённой работе всё равно
 * уйдёт, потому что письмо уже стоит и о судьбе заявки ничего не знает.
 *
 * @return array{removed:int,mails:int,sent:int} сколько удалено, снято с очереди и уже ушло
 */
function dsync_drop(int $appId, string $why = ''): array {
    $res = ['removed' => 0, 'mails' => 0, 'sent' => 0];
    $rows = all("SELECT * FROM diplomas WHERE application_id=?", [$appId]);
    foreach ($rows as $d) {
        if (trim((string) ($d['sent_at'] ?? '')) !== '') $res['sent']++;
        // Письмо, которое ещё не ушло, снимаем: оно уже не имеет основания.
        $qid = (int) ($d['queue_id'] ?? 0);
        if ($qid > 0) {
            try {
                $n = q("UPDATE mail_queue SET status='cancelled', error=? WHERE id=? AND status IN ('queued','paused')",
                       [mb_substr('наградные материалы отозваны: ' . ($why ?: 'заявка отклонена'), 0, 190), $qid])->rowCount();
                $res['mails'] += (int) $n;
            } catch (\Throwable $e) {}
        }
        dsync_unlink((string) ($d['pdf_path'] ?? ''));
        dsync_unlink((string) ($d['video_review_path'] ?? ''));
        try { q("DELETE FROM diplomas WHERE id=?", [(int) $d['id']]); $res['removed']++; } catch (\Throwable $e) {}
    }
    // Отметка об отправленном результате снимается, иначе заявка выглядит как
    // уже отработанная и при возврате в работу письмо второй раз не уйдёт.
    try { q("UPDATE applications SET result_sent_at='', result_send_at='' WHERE id=?", [$appId]); } catch (\Throwable $e) {}
    if ($res['removed'] > 0 && function_exists('audit')) {
        audit('diploma_dropped', 'application', $appId, $res + ['why' => $why]);
    }
    return $res;
}

/**
 * ПЕРЕДЕЛАТЬ БЛАНКИ ПОД ТЕКУЩИЕ ДАННЫЕ ЗАЯВКИ.
 *
 * Номер сохраняем, файл перерисовываем. Звание в записи диплома обновляем: оно
 * печатается на бланке и попадает в реестр, а значит должно совпадать с тем,
 * что стоит в заявке сейчас.
 *
 * @return array{rebuilt:int,failed:int,resend:int}
 */
function dsync_rebuild(int $appId, array $changed = []): array {
    $res = ['rebuilt' => 0, 'failed' => 0, 'resend' => 0];
    $app = one("SELECT * FROM applications WHERE id=?", [$appId]);
    if (!$app) return $res;

    foreach (all("SELECT * FROM diplomas WHERE application_id=?", [$appId]) as $d) {
        $type = (string) ($d['type'] ?? 'main');
        // Дополнительный диплом без основания больше не нужен: звание за
        // отдельное качество сняли, значит и документа быть не должно.
        if ($type === 'extra' && trim((string) ($app['extra_diploma'] ?? '')) === '') {
            dsync_unlink((string) ($d['pdf_path'] ?? ''));
            try { q("DELETE FROM diplomas WHERE id=?", [(int) $d['id']]); } catch (\Throwable $e) {}
            continue;
        }
        if ($type === 'thanks') continue;     // благодарность педагогу от правок заявки не зависит

        $old = (string) ($d['pdf_path'] ?? '');
        $new = null;
        try {
            $new = function_exists('diploma_pdf_html')
                 ? diploma_pdf_html((array) $app, $type === 'extra' ? ['extra' => true] : [])
                 : null;
        } catch (\Throwable $e) { $new = null; }
        if (!$new && function_exists('pdf_diploma')) {
            try { $new = pdf_diploma((array) $app, $type); } catch (\Throwable $e) { $new = null; }
        }
        if (!$new) { $res['failed']++; continue; }

        $upd = ['pdf_path' => $new,
                'result'   => $type === 'extra' ? (string) $app['extra_diploma'] : (string) $app['result']];

        // Уже отправленный диплом переделываем и отправляем заново: на руках у
        // человека лежит старый файл, и подменить его в письме невозможно.
        if (trim((string) ($d['sent_at'] ?? '')) !== '') {
            $upd['sent_at']      = '';
            $upd['queue_id']     = null;
            $upd['send_tries']   = 0;
            $upd['scheduled_at'] = date('Y-m-d H:i:s');
            $res['resend']++;
        }
        try { update('diplomas', $upd, 'id=:id', ['id' => (int) $d['id']]); $res['rebuilt']++; }
        catch (\Throwable $e) { $res['failed']++; }
        if ($old !== '' && $old !== $new) dsync_unlink($old);
    }

    if (($res['rebuilt'] + $res['resend']) > 0 && function_exists('audit')) {
        audit('diploma_rebuilt', 'application', $appId, $res + ['changed' => $changed]);
    }
    return $res;
}

/**
 * ГЛАВНАЯ ТОЧКА ВХОДА: заявку изменили, решить судьбу наградных материалов.
 *
 * Вызывать после любого сохранения заявки — из админки, из оценки, из
 * автоматической аттестации. Сама разберётся, надо ли что-то делать: если
 * напечатанное не менялось, не делает ничего.
 *
 * @return string короткая фраза для сообщения человеку ('' — ничего не делали)
 */
function dsync_apply(int $appId, array $before, array $after): string {
    if ($appId <= 0) return '';
    $has = (int) (scalar("SELECT COUNT(*) FROM diplomas WHERE application_id=?", [$appId]) ?? 0);
    if ($has === 0) return '';

    $statusAfter = trim((string) ($after['status'] ?? $before['status'] ?? ''));
    $resultAfter = trim((string) ($after['result'] ?? $before['result'] ?? ''));

    // Отклонили или сняли результат — документов быть не должно.
    if ($statusAfter === 'rejected' || $resultAfter === '') {
        $r = dsync_drop($appId, $statusAfter === 'rejected' ? 'заявка отклонена' : 'результат снят');
        if ($r['removed'] === 0) return '';
        $msg = 'Наградные материалы удалены (' . $r['removed'] . ').';
        if ($r['mails'] > 0) $msg .= ' Письмо снято с очереди.';
        if ($r['sent'] > 0)  $msg .= ' ВНИМАНИЕ: ' . $r['sent'] . ' уже было отправлено участнику.';
        return $msg;
    }

    $changed = dsync_changed($before, $after);
    if (!$changed) return '';

    $r = dsync_rebuild($appId, $changed);
    if ($r['rebuilt'] === 0 && $r['failed'] === 0) return '';
    $msg = 'Наградные материалы переделаны под новые данные (' . $r['rebuilt'] . ').';
    if ($r['resend'] > 0) $msg .= ' ' . $r['resend'] . ' будет отправлено участнику заново.';
    if ($r['failed'] > 0) $msg .= ' Не удалось переделать: ' . $r['failed'] . ' — проверьте вручную.';
    return $msg;
}
