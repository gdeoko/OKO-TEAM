<?php
/**
 * Расчёт сроков отправки РЕЗУЛЬТАТА и НАГРАДНОГО МАТЕРИАЛА (короткие платные конкурсы).
 * Правило владельца (время — МСК, приложение работает в Europe/Moscow):
 *   • Рабочее окно отправки — 09:00–18:00, воскресенье НЕрабочее. Ничего не уходит ночью.
 *   • РЕЗУЛЬТАТ (аттестационный):
 *       галочка «авто» → дата ПОДАЧИ + N рабочих дней, НО не раньше ближайшего рабочего
 *                        окна: оцениваешь в рабочее и срок вышел → сейчас; в нерабочее
 *                        (до 09:00 / после 18:00 / вс) → ближайшее рабочее утро 09:00;
 *       задана дата    → строго в эту дату/время;
 *       без галочки и без даты → моментально.
 *   • НАГРАДНОЙ МАТЕРИАЛ (осн./доп. дипломы) — через N рабочих дней ПОСЛЕ результата,
 *     тоже только в рабочее окно. N=5, для участников ВИП-клуба N=3.
 */
declare(strict_types=1);

if (!function_exists('st_is_workday')) {
    /** Рабочий день (пн–сб; воскресенье — выходной). */
    function st_is_workday(\DateTime $d): bool { return (int) $d->format('w') !== 0; }
}

if (!function_exists('st_set_morning')) {
    /** Ставит время на 09:00–09:55 (лёгкий разброс, чтобы не бить пачкой в 09:00:00). */
    function st_set_morning(\DateTime $t): \DateTime {
        try { $t->setTime(9, random_int(0, 55)); } catch (\Throwable $e) { $t->setTime(9, 15); }
        return $t;
    }
}

if (!function_exists('working_days_add')) {
    /** Прибавляет N рабочих дней (воскресенье — нерабочее), ставит окно 09:00–09:55. */
    function working_days_add(string $base, int $n): \DateTime {
        try { $t = new \DateTime($base !== '' ? $base : 'now'); } catch (\Throwable $e) { $t = new \DateTime('now'); }
        $d = 0;
        while ($d < $n) { $t->modify('+1 day'); if (st_is_workday($t)) $d++; }
        return st_set_morning($t);
    }
}

if (!function_exists('next_working_slot')) {
    /**
     * Ближайшее рабочее окно 09:00–18:00 (вс — выходной):
     *   • рабочий день и сейчас 09:00–17:59 → сейчас (моментально);
     *   • раньше 09:00 → сегодня 09:0x;
     *   • 18:00 и позже → следующее рабочее утро 09:0x;
     *   • воскресенье → понедельник 09:0x.
     */
    function next_working_slot(?\DateTime $from = null): \DateTime {
        try { $t = $from ? clone $from : new \DateTime('now'); } catch (\Throwable $e) { $t = new \DateTime('now'); }
        for ($i = 0; $i < 10; $i++) {
            $h = (int) $t->format('G');
            if (!st_is_workday($t)) { $t->modify('+1 day'); st_set_morning($t); continue; } // вс → утро след. дня
            if ($h < 9)  { return st_set_morning($t); }                                       // до начала → сегодня 09:0x
            if ($h >= 18) { $t->modify('+1 day'); st_set_morning($t); continue; }             // после конца → завтра 09:0x
            return $t;                                                                        // рабочий день, 09–18 → сейчас
        }
        return $t;
    }
}

if (!function_exists('working_days_after')) {
    /** N рабочих дней ПОСЛЕ момента $base, но не раньше ближайшего рабочего окна. */
    function working_days_after(string $base, int $n): \DateTime {
        $planned = working_days_add($base !== '' ? $base : date('Y-m-d H:i:s'), $n);
        $soonest = next_working_slot(new \DateTime('now'));
        return $planned > $soonest ? $planned : $soonest;
    }
}

if (!function_exists('result_plan_at')) {
    /**
     * Плановое время РЕЗУЛЬТАТА (в рабочем окне, никогда ночью).
     * @param string $submittedAt дата подачи (created_at)
     * @param bool   $auto        галочка «авто по сроку»
     * @param string $dateStr     ручная дата (если галочка снята)
     * @param int    $wdays       рабочих дней для авто (5 или 3 ВИП)
     */
    function result_plan_at(string $submittedAt, bool $auto, string $dateStr, int $wdays): \DateTime {
        if ($auto) {
            $planned = working_days_add($submittedAt, $wdays);       // подача + N раб.дней, 09:0x
            $soonest = next_working_slot(new \DateTime('now'));      // ближайшее рабочее окно
            return $planned > $soonest ? $planned : $soonest;        // не раньше рабочего окна, но и не раньше срока
        }
        $dateStr = trim($dateStr);
        if ($dateStr !== '') { try { return new \DateTime($dateStr); } catch (\Throwable $e) {} }
        return new \DateTime('now');   // без галочки и без даты — моментально
    }
}
