<?php
/**
 * ЖУРНАЛ ЛИЧНЫХ ПИСЕМ — ЧТОБЫ БЫЛО ВИДНО, ЧТО ИМЕННО УШЛО ЧЕЛОВЕКУ.
 *
 * Массовая рассылка проходит через очередь mail_queue, и её видно в админке:
 * там лежит и адресат, и тема, и всё тело письма. А личные письма — диплом,
 * результат, код входа, «награды отправлены Почтой России» с трек-номером —
 * уходят прямой отправкой, минуя очередь: они срочные, их нельзя копить.
 *
 * Из-за этого от них не оставалось ничего, кроме строки в mail.log: «SENT to
 * … | Ваши награды отправлены». Владелец вводил трек-номер, нажимал
 * «Отправить», а посмотреть, что за письмо получил участник, было негде — ни
 * в очереди, ни в отправках. Приходилось верить на слово.
 *
 * Здесь письмо сохраняется целиком: кому, от какого ящика, тема, тело,
 * получилось или нет и почему. Смотреть — «Письма участникам» в админке.
 *
 * ЧЕГО ТУТ НЕТ:
 *   • писем из очереди: их тело и так лежит в mail_queue, дубль не нужен;
 *   • вложений: диплом весит мегабайты, а в журнале нужен текст письма.
 *     Имена вложений записываются, сами файлы — нет.
 */
declare(strict_types=1);

/** Насколько длинное тело письма храним. Дипломы с фоном бывают тяжёлыми. */
const MAIL_ARCHIVE_MAX_BODY = 600000;
/** Сколько дней держим журнал. Дальше письмо есть у участника, а нам не нужно. */
const MAIL_ARCHIVE_KEEP_DAYS = 180;

function mail_archive_migrate(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    q("CREATE TABLE IF NOT EXISTS mail_sent (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        to_email TEXT NOT NULL DEFAULT '',
        to_name TEXT NOT NULL DEFAULT '',
        subject TEXT NOT NULL DEFAULT '',
        body TEXT NOT NULL DEFAULT '',
        from_box TEXT NOT NULL DEFAULT '',
        from_name TEXT NOT NULL DEFAULT '',
        attach TEXT NOT NULL DEFAULT '',
        ok INTEGER NOT NULL DEFAULT 0,
        error TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL DEFAULT ''
    )");
    q("CREATE INDEX IF NOT EXISTS idx_mail_sent_created ON mail_sent(created_at)");
    q("CREATE INDEX IF NOT EXISTS idx_mail_sent_to ON mail_sent(to_email)");
}

/**
 * Записать отправленное личное письмо.
 *
 * Вызывается из mail_send сразу после попытки отправки — и при успехе, и при
 * отказе: неудачное письмо в журнале нужнее удачного, по нему видно, почему
 * участник ничего не получил.
 */
function mail_archive_store(string $to, string $subject, string $html, array $opt, bool $ok, string $error = ''): void {
    try {
        mail_archive_migrate();
        $acc = is_array($opt['account'] ?? null) ? $opt['account'] : [];
        $box = (string) ($acc['from_addr'] ?? $acc['user'] ?? (function_exists('cfgv') ? cfgv('smtp_user', '') : ''));

        // Вложения — только именами: сами файлы лежат на диске, а в журнале
        // важно знать, что диплом к письму приложили, а не хранить его копию.
        $a = $opt['attachments'] ?? ($opt['attach'] ?? '');
        $names = [];
        foreach (is_array($a) ? $a : ($a === '' ? [] : [$a]) as $one) {
            if (is_string($one) && $one !== '') $names[] = basename($one);
        }

        $body = (string) $html;
        if (strlen($body) > MAIL_ARCHIVE_MAX_BODY) {
            $body = substr($body, 0, MAIL_ARCHIVE_MAX_BODY)
                  . '<p style="color:#a00">[письмо в журнале обрезано — оно длиннее '
                  . number_format(MAIL_ARCHIVE_MAX_BODY / 1000, 0, ',', ' ') . ' КБ]</p>';
        }

        insert('mail_sent', [
            'to_email'   => $to,
            'to_name'    => mb_substr((string) ($opt['to_name'] ?? ''), 0, 200),
            'subject'    => mb_substr($subject, 0, 500),
            'body'       => $body,
            'from_box'   => $box,
            'from_name'  => mb_substr((string) ($opt['from_name'] ?? ''), 0, 200),
            'attach'     => implode(', ', $names),
            'ok'         => $ok ? 1 : 0,
            'error'      => mb_substr($error, 0, 500),
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        // Чистка старого — изредка, чтобы не трогать базу на каждом письме.
        if (random_int(1, 200) === 1) {
            q("DELETE FROM mail_sent WHERE created_at < ?",
              [date('Y-m-d H:i:s', strtotime('-' . MAIL_ARCHIVE_KEEP_DAYS . ' days'))]);
        }
    } catch (\Throwable $e) {
        // Журнал не должен мешать почте: письмо важнее записи о письме.
    }
}
