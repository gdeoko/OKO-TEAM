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

if (!function_exists('comp_terms')) {
    /**
     * УСЛОВИЯ КОНКУРСА ОДНИМИ СЛОВАМИ ДЛЯ ВСЕХ АФИШ СРАЗУ.
     *
     * Правило владельца от 05.10.2026: везде, где стоит афиша с кнопками «Подать
     * заявку» и «Положение», человек обязан видеть три вещи — до какого числа
     * приём, когда и где будут результаты, и сколько стоит участие. Раньше стоял
     * только срок приёма: участник подавал работу и не знал, ждать ли ему письма
     * или смотреть список, а на платном конкурсе узнавал про оргвзнос уже внутри
     * формы заявки.
     *
     * Срок аттестации у конкурсов разный, и это не стиль, а механика:
     *   - есть results_date  → итоги оглашаются списком в назначенный день,
     *                          публикация во ВКонтакте и на сайте центра;
     *   - нет results_date   → работа аттестуется по мере поступления, центр
     *                          отвечает сроком в 5 рабочих дней, диплом уходит
     *                          на почту из заявки.
     * Поэтому признак берётся от results_date, а duration только подстраховывает.
     *
     * Возвращает готовые строки: короткие для карточек, полные для страницы
     * конкурса. Экранирование на стороне шаблона (строки чистые, без HTML).
     */
    function comp_terms(array $c): array {
        $end     = trim((string) ($c['end_date'] ?? ''));
        $resDate = trim((string) ($c['results_date'] ?? ''));
        $isLong  = $resDate !== '' || (string) ($c['duration'] ?? '') === 'long';
        $isPaid  = !empty($c['is_paid']);
        $price   = (int) ($c['price'] ?? 0);

        $intake      = $end !== '' ? ('Приём заявок до ' . ru_date($end)) : 'Приём заявок по графику в положении';
        $intakeShort = $end !== '' ? ('приём до ' . ru_date($end)) : 'приём по графику';

        if ($isLong && $resDate !== '') {
            /* В длинном конкурсе короткая форма всё равно называет оба места оглашения:
               на карточке заявки это единственное место, где участник их увидит. */
            $resShort = 'результаты ' . ru_date($resDate) . ' во ВКонтакте и на сайте центра';
            $resFull  = 'Результаты будут опубликованы ' . ru_date($resDate)
                      . ' на официальной странице сообщества ВКонтакте, а также на официальном сайте'
                      . ' Культурного центра «Музыкальный Мир»';
            $resCard  = 'Результаты ' . ru_date($resDate) . ' во ВКонтакте и на сайте центра';
        } else {
            $resShort = 'результаты за 5 рабочих дней';
            $resFull  = 'Результаты в течение 5 рабочих дней. Диплом с аттестационной оценкой жюри'
                      . ' приходит на электронную почту, указанную в заявке';
            $resCard  = 'Результаты в течение 5 рабочих дней';
        }

        if ($isPaid) {
            $feeShort = 'оргвзнос ' . number_format($price, 0, ',', ' ') . ' ₽';
            $feeCard  = 'Оргвзнос ' . number_format($price, 0, ',', ' ') . ' ₽';
        } else {
            $feeShort = 'бесплатное участие';
            $feeCard  = 'Бесплатное участие';
        }

        return [
            'is_long'      => $isLong,
            'is_paid'      => $isPaid,
            'intake'       => $intake,
            'intake_short' => $intakeShort,
            'results'      => $resCard,
            'results_short'=> $resShort,
            'results_full' => $resFull,
            'fee'          => $feeCard,
            'fee_short'    => $feeShort,
        ];
    }
}
