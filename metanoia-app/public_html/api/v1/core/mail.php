<?php
/**
 * Письма родителям. Пока школа не подключила сервис рассылки, письма
 * складываются в файл рядом с конфигом: ничего не теряется, а Екатерина
 * видит, что именно ушло бы. Как только в .env появится MAIL_FROM,
 * тот же код начнёт отправлять по-настоящему.
 */

declare(strict_types=1);

final class Mail
{
    /** Отправлено ли письмо на самом деле. */
    public static function send(string $кому, string $тема, string $текст): bool
    {
        $от = (string) Config::get('MAIL_FROM', '');
        $имя = (string) Config::get('MAIL_FROM_NAME', 'Метанойя');

        if ($от === '' || !filter_var($кому, FILTER_VALIDATE_EMAIL)) {
            self::вЖурнал($кому, $тема, $текст, 'сервис писем не подключён');
            return false;
        }

        $заголовки = [
            'From: ' . self::кодировать($имя) . ' <' . $от . '>',
            'MIME-Version: 1.0',
            'Content-Type: text/plain; charset=UTF-8',
            'Content-Transfer-Encoding: 8bit',
        ];

        $ок = @mail($кому, self::кодировать($тема), $текст, implode("\r\n", $заголовки));
        if (!$ок) self::вЖурнал($кому, $тема, $текст, 'mail() вернул отказ');
        return (bool) $ок;
    }

    /** Тема и имя в письме кириллицей: без кодирования почтовики ломают их. */
    private static function кодировать(string $s): string
    {
        return '=?UTF-8?B?' . base64_encode($s) . '?=';
    }

    private static function вЖурнал(string $кому, string $тема, string $текст, string $почему): void
    {
        $файл = dirname(__DIR__, 4) . '/config/письма.log';
        $запись = sprintf(
            "[%s] %s | кому: %s | тема: %s\n%s\n%s\n",
            date('Y-m-d H:i:s'), $почему, $кому, $тема, $текст, str_repeat('-', 60)
        );
        @file_put_contents($файл, $запись, FILE_APPEND | LOCK_EX);
    }
}
