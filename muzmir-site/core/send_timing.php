<?php
/**
 * Расчёт сроков отправки РЕЗУЛЬТАТА и НАГРАДНОГО МАТЕРИАЛА (короткие платные конкурсы).
 * Правило владельца:
 *   • РЕЗУЛЬТАТ (аттестационный) — по управлению из карточки оценки:
 *       галочка «авто» → дата ПОДАЧИ заявки + N рабочих дней (вс — нерабочий),
 *                        если срок уже прошёл — отправляется сейчас;
 *       задана дата    → в эту дату/время;
 *       без галочки и без даты → моментально.
 *   • НАГРАДНОЙ МАТЕРИАЛ (осн./доп. дипломы) — ВСЕГДА дата ПОДАЧИ + N рабочих дней,
 *     независимо от того, когда админ оценил. N=5, для участников ВИП-клуба N=3.
 * Точка отсчёта — всегда ПОДАЧА (created_at), а не момент оценки.
 */
declare(strict_types=1);

if (!function_exists('working_days_add')) {
    /** Прибавляет N рабочих дней (воскресенье — нерабочее), ставит окно 09:00–09:55. */
    function working_days_add(string $base, int $n): \DateTime {
        try { $t = new \DateTime($base !== '' ? $base : 'now'); } catch (\Throwable $e) { $t = new \DateTime('now'); }
        $d = 0;
        while ($d < $n) { $t->modify('+1 day'); if ((int) $t->format('w') !== 0) $d++; }
        try { $t->setTime(9, random_int(0, 55)); } catch (\Throwable $e) { $t->setTime(9, 15); }
        return $t;
    }
}

if (!function_exists('result_plan_at')) {
    /**
     * Плановое время РЕЗУЛЬТАТА.
     * @param string $submittedAt дата подачи (created_at)
     * @param bool   $auto        галочка «авто по сроку»
     * @param string $dateStr     ручная дата (если галочка снята)
     * @param int    $wdays       рабочих дней для авто (5 или 3 ВИП)
     */
    function result_plan_at(string $submittedAt, bool $auto, string $dateStr, int $wdays): \DateTime {
        $now = new \DateTime('now');
        if ($auto) { $t = working_days_add($submittedAt, $wdays); return $t < $now ? $now : $t; }
        $dateStr = trim($dateStr);
        if ($dateStr !== '') { try { return new \DateTime($dateStr); } catch (\Throwable $e) {} }
        return $now;
    }
}
