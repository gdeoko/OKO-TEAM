<?php
/**
 * СРАВНЕНИЕ ДВУХ ПИСЕМ УЧРЕЖДЕНИЮ.
 *
 * Двадцать тысяч писем дали шесть заходов на страницу согласия и ни одного
 * партнёра. Открывают — и не отвечают. Значит дело не в доставке, а в самом
 * письме, и спорить о том, какое лучше, бессмысленно: надо разослать оба и
 * посмотреть.
 *
 * ВАРИАНТ «А» — нынешний: официальное обращение на бланке, с реквизитами,
 * перечнем конкурсов и кнопкой подтверждения. Так центр писал всегда.
 *
 * ВАРИАНТ «Б» — короткий: одно предложение о сути, что учреждение получает, и
 * один способ ответить — словом «СОГЛАСНЫ» в ответном письме. Гипотеза простая:
 * в школе письмо читает секретарь или завуч, у которого нет ни времени на
 * страницу с реквизитами, ни привычки нажимать кнопки в письме, зато ответить
 * на письмо — привычное действие.
 *
 * Вариант закрепляется за учреждением навсегда: одно и то же учреждение не
 * должно получать то одно письмо, то другое — иначе сравнивать будет нечего.
 * Делится по остатку от деления номера: половина на половину, без перекосов по
 * региону или дате добавления.
 */
declare(strict_types=1);

function pab_migrate(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    try {
        db()->exec("CREATE TABLE IF NOT EXISTS partner_ab (
            inst_id    INTEGER PRIMARY KEY,
            variant    TEXT DEFAULT 'a',
            sent_at    TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now','localtime')))");
    } catch (\Throwable $e) { /* уже есть */ }
}

/** Включено ли сравнение. Выключено — все получают нынешнее письмо. */
function pab_enabled(): bool {
    return (string) (function_exists('setting') ? setting('partner_ab', '1') : '1') === '1';
}

/**
 * Вариант письма для учреждения: 'a' или 'b'.
 *
 * Раз выбранный вариант сохраняется: письмо-напоминание должно быть таким же,
 * как первое, иначе учреждение получит два разных обращения от одного центра.
 */
function pab_variant(int $instId): string {
    if ($instId <= 0 || !pab_enabled()) return 'a';
    pab_migrate();
    try {
        $r = one("SELECT variant FROM partner_ab WHERE inst_id=?", [$instId]);
        if ($r) return (string) $r['variant'] === 'b' ? 'b' : 'a';
        $v = ($instId % 2 === 0) ? 'b' : 'a';
        insert('partner_ab', ['inst_id' => $instId, 'variant' => $v, 'sent_at' => date('Y-m-d H:i:s')]);
        return $v;
    } catch (\Throwable $e) { return 'a'; }
}

/**
 * Итоги сравнения.
 *
 * Считаем по каждому варианту то, что действительно решает: сколько писем
 * доставлено, сколько открыли, сколько дошли до страницы согласия, сколько
 * ответили письмом и сколько стали партнёрами. Открытия и доставку берём из
 * отчётов сервиса рассылки по адресу учреждения.
 */
function pab_stats(bool $fresh = false): array {
    pab_migrate();

    /* АДМИНКА НИЧЕГО НЕ СЧИТАЕТ — ОНА ЧИТАЕТ ГОТОВОЕ.
     *
     * Прежний расчёт соединял mail_events с institutions по mb_lower(email).
     * Соединение по функции индексы не использует, а таблицы выросли: 77 тысяч
     * событий почты, 39 тысяч учреждений, 20 тысяч записей сравнения. Раздел
     * «Партнёры» перестал открываться вовсе — страница висела минутами и падала
     * по таймауту.
     *
     * Теперь без кэша функция честно возвращает пустоту, а не уходит считать на
     * пять минут: раздел откроется мгновенно и покажет «идёт подсчёт». Считает
     * крон (cron/partner_ab_stats.php) — там время есть.
     */
    $ttl = 3600;
    if (!$fresh) {
        try {
            $raw = (string) (function_exists('setting') ? setting('partner_ab_stats', '') : '');
            if ($raw !== '') {
                $c = json_decode($raw, true);
                if (is_array($c) && !empty($c['data'])) {
                    $stale = (time() - (int) ($c['at'] ?? 0)) > $ttl;
                    $out = (array) $c['data'];
                    $out['_at'] = (int) ($c['at'] ?? 0);
                    $out['_stale'] = $stale;
                    return $out;
                }
            }
        } catch (\Throwable $e) { /* нет кэша — вернём пустоту */ }
        return [];
    }

    /* ПОЛНЫЙ ПЕРЕСЧЁТ (только из крона).
     *
     * Считаем в памяти, а не соединениями в базе: три последовательных прохода
     * по таблицам вместо перебора «каждая строка против каждой». */
    $variant = [];      // id учреждения → вариант письма
    try {
        foreach (all("SELECT inst_id, variant FROM partner_ab") as $r) {
            $variant[(int) $r['inst_id']] = ((string) $r['variant'] === 'b') ? 'b' : 'a';
        }
    } catch (\Throwable $e) { return []; }
    if (!$variant) return [];

    $out = [];
    foreach (['a', 'b'] as $v) {
        $out[$v] = ['variant' => $v, 'n' => 0, 'sent' => 0, 'delivered' => 0,
                    'opened' => 0, 'visited' => 0, 'replied' => 0, 'partners' => 0];
    }

    // Учреждения сравнения: один проход, попутно запоминаем адреса.
    $mailToVar = [];
    try {
        foreach (all("SELECT id, mb_lower(COALESCE(email,'')) em, COALESCE(invited_at,'') inv,
                             COALESCE(replied_at,'') rep, COALESCE(partner_status,'') st
                        FROM institutions") as $r) {
            $id = (int) $r['id'];
            if (!isset($variant[$id])) continue;
            $v = $variant[$id];
            $out[$v]['n']++;
            if (trim((string) $r['inv']) !== '') $out[$v]['sent']++;
            if (trim((string) $r['rep']) !== '') $out[$v]['replied']++;
            if ((string) $r['st'] === 'accepted') $out[$v]['partners']++;
            $em = trim((string) $r['em']);
            if ($em !== '') $mailToVar[$em] = $v;
        }
    } catch (\Throwable $e) { return []; }

    // Доставки и открытия: один проход по событиям почты, сверка по памяти.
    $seen = ['delivered' => [], 'opened' => []];
    try {
        foreach (all("SELECT mb_lower(COALESCE(email,'')) em, status FROM mail_events
                       WHERE status IN ('delivered','opened')") as $r) {
            $em = trim((string) $r['em']);
            if ($em === '' || !isset($mailToVar[$em])) continue;
            $st = (string) $r['status'];
            if (isset($seen[$st][$em])) continue;          // один адрес считаем один раз
            $seen[$st][$em] = true;
            $out[$mailToVar[$em]][$st]++;
        }
    } catch (\Throwable $e) { /* события не критичны */ }

    // Заходы на страницу согласия: один проход по журналу.
    try {
        foreach (all("SELECT path FROM site_events WHERE path LIKE '%partner-join%'") as $ev) {
            if (!preg_match('~partner-join\?i=(\d+)~', (string) $ev['path'], $m)) continue;
            $id = (int) $m[1];
            if (!isset($variant[$id])) continue;
            $out[$variant[$id]]['visited']++;
        }
    } catch (\Throwable $e) { /* журнал не критичен */ }

    try {
        if (function_exists('set_setting')) {
            set_setting('partner_ab_stats', json_encode(['at' => time(), 'data' => $out], JSON_UNESCAPED_UNICODE));
        }
    } catch (\Throwable $e) { /* кэш не важнее ответа */ }
    return $out;
}
