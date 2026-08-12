<?php
/**
 * core/countdown.php — плашка обратного отсчёта приёма заявок для афиши.
 * Показывается только для открытых конкурсов и только когда до конца приёма ≤ 7 дней.
 * «ОСТАЛОСЬ N ДНЕЙ» / «ОСТАЛСЯ 1 ДЕНЬ» / «ПОСЛЕДНИЙ ДЕНЬ».
 */
declare(strict_types=1);

if (!function_exists('comp_days_left')) {
    /** Дней до конца приёма: >0 осталось, 0 сегодня последний, <0 прошёл, null — нет даты. */
    function comp_days_left(?string $endDate): ?int {
        $e = trim((string) $endDate);
        if ($e === '') return null;
        $ts = strtotime($e);
        if (!$ts) return null;
        try {
            $today = new DateTime(date('Y-m-d'));
            $end   = new DateTime(date('Y-m-d', $ts));
        } catch (\Throwable $ex) { return null; }
        $diff = (int) $today->diff($end)->days;
        return $end < $today ? -$diff : $diff;
    }
}

if (!function_exists('ru_days_word')) {
    /** «день / дня / дней» по числу. */
    function ru_days_word(int $n): string {
        $n = abs($n) % 100;
        $n1 = $n % 10;
        if ($n > 10 && $n < 20) return 'дней';
        if ($n1 === 1) return 'день';
        if ($n1 >= 2 && $n1 <= 4) return 'дня';
        return 'дней';
    }
}

if (!function_exists('comp_countdown_badge')) {
    /**
     * Плашка обратного отсчёта: ['text','cls','days'] либо null.
     * $status — статус конкурса; плашка только для 'open'/'judging'.
     */
    function comp_countdown_badge(?string $endDate, string $status = 'open'): ?array {
        if (!in_array($status, ['open', 'judging'], true)) return null;
        $days = comp_days_left($endDate);
        if ($days === null || $days < 0) return null;
        if ($days === 0) return ['text' => 'ПОСЛЕДНИЙ ДЕНЬ', 'cls' => 'cd--last', 'days' => 0];
        if ($days > 7)   return null;
        $word = ru_days_word($days);
        $verb = $days === 1 ? 'ОСТАЛСЯ' : 'ОСТАЛОСЬ';
        $cls  = $days <= 3 ? 'cd--soon' : 'cd--week';
        return ['text' => $verb . ' ' . $days . ' ' . mb_strtoupper($word), 'cls' => $cls, 'days' => $days];
    }
}
