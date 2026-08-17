<?php
/**
 * КТО В ЧАТЕ ОТВЕЧАЕТСЯ ПЕРВЫМ.
 *
 * Клуб обещает приоритетную поддержку, и до сих пор это обещание было пустым:
 * бот отвечал всем одинаково и мгновенно, а на странице клуба стояло «ответ в
 * течение 24 часов» — то есть хуже, чем есть на самом деле, и без всякой разницы
 * с обычным участником.
 *
 * Теперь разница настоящая и одинаковая во всех каналах:
 *   • участник Клуба   — ответ моментальный, без очереди;
 *   • обычный участник — ответ в течение пяти минут (обещаем до пятнадцати).
 *
 * Пять минут это не наказание, а честная очередь: вопрос принимается сразу, тут
 * же подтверждается, и ответ приходит в обещанный срок. Клуб покупает не «ответ
 * вообще», а место в начале очереди, и это единственный способ сделать
 * привилегию заметной, не ухудшая обслуживание остальных.
 *
 * Сроки меняются настройками, без правки кода:
 *   chat_delay_regular_sec — задержка обычному участнику (по умолчанию 300)
 *   chat_promise_minutes   — что обещаем словами обычному (по умолчанию 15)
 */
declare(strict_types=1);

/** Участник Клуба: членство активно прямо сейчас. */
function chat_is_vip(?int $userId): bool {
    $uid = (int) ($userId ?? 0);
    if ($uid <= 0) return false;
    if (!function_exists('club_is_active') && is_file(BASE_PATH . '/core/club.php')) {
        require_once BASE_PATH . '/core/club.php';
    }
    if (!function_exists('club_is_active')) return false;
    try { return club_is_active($uid); } catch (\Throwable $e) { return false; }
}

/**
 * Через сколько секунд участник получит ответ.
 * Ноль — моментально (Клуб, а также операторские и служебные случаи).
 */
function chat_reply_delay_sec(?int $userId): int {
    if (chat_is_vip($userId)) return 0;
    $sec = (int) (function_exists('setting') ? setting('chat_delay_regular_sec', '300') : 300);
    return max(0, min(900, $sec));   // потолок 15 минут: больше обещанного ждать нельзя
}

/** Сколько минут обещаем словами обычному участнику. */
function chat_promise_minutes(): int {
    $m = (int) (function_exists('setting') ? setting('chat_promise_minutes', '15') : 15);
    return max(1, min(60, $m));
}

/**
 * Подтверждение приёма вопроса для обычного участника.
 * Показывается сразу, пока готовится ответ: молчание в чате читается как поломка.
 */
function chat_wait_notice(int $delaySec, string $name = ''): string {
    $mins = max(1, (int) ceil($delaySec / 60));
    $hi   = trim($name) !== '' ? trim($name) . ', в' : 'В';
    return $hi . 'аш вопрос принят, я готовлю ответ — он придёт в течение '
         . $mins . ' ' . plural_ru($mins, 'минуты', 'минут', 'минут') . '. '
         . 'Участникам Клуба ответ приходит моментально: ' . rtrim((string) cfgv('domain', 'музыкальный-мир.рф'), '/') . '/club';
}

/** Русское склонение числительных для коротких фраз бота. */
if (!function_exists('plural_ru')) {
    function plural_ru(int $n, string $one, string $few, string $many): string {
        $n = abs($n) % 100;
        $n1 = $n % 10;
        if ($n > 10 && $n < 20) return $many;
        if ($n1 > 1 && $n1 < 5)  return $few;
        if ($n1 === 1)           return $one;
        return $many;
    }
}
