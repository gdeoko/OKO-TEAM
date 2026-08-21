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

    /* СЧИТАЕМ РАЗ В ДЕСЯТЬ МИНУТ, А НЕ НА КАЖДЫЙ ОТКРЫТЫЙ РАЗДЕЛ.
     *
     * Подсчёт идёт по трём таблицам разом: полторы тысячи учреждений, тридцать
     * тысяч событий доставки, двадцать три тысячи посещений. Это восемнадцать
     * секунд — столько раздел «Партнёры» и не открывался. Цифры сравнения писем
     * меняются за часы, а не за секунды, поэтому держим последний расчёт и
     * обновляем его не чаще чем раз в десять минут. */
    $ttl = 600;
    if (!$fresh) {
        try {
            $raw = (string) (function_exists('setting') ? setting('partner_ab_stats', '') : '');
            if ($raw !== '') {
                $c = json_decode($raw, true);
                if (is_array($c) && (time() - (int) ($c['at'] ?? 0)) < $ttl && !empty($c['data'])) {
                    return (array) $c['data'];
                }
            }
        } catch (\Throwable $e) { /* считаем заново */ }
    }

    $out = [];
    foreach (['a', 'b'] as $v) {
        $ids = [];
        try {
            foreach (all("SELECT inst_id FROM partner_ab WHERE variant=?", [$v]) as $r) $ids[] = (int) $r['inst_id'];
        } catch (\Throwable $e) { $ids = []; }
        $row = ['variant' => $v, 'n' => count($ids), 'sent' => 0, 'delivered' => 0,
                'opened' => 0, 'visited' => 0, 'replied' => 0, 'partners' => 0];
        if (!$ids) { $out[$v] = $row; continue; }
        $in = implode(',', array_map('intval', $ids));
        try {
            $row['sent']      = (int) scalar("SELECT COUNT(*) FROM institutions WHERE id IN ($in) AND COALESCE(invited_at,'')<>''");
            $row['replied']   = (int) scalar("SELECT COUNT(*) FROM institutions WHERE id IN ($in) AND COALESCE(replied_at,'')<>''");
            $row['partners']  = (int) scalar("SELECT COUNT(*) FROM institutions WHERE id IN ($in) AND partner_status='accepted'");
            $row['delivered'] = (int) scalar("SELECT COUNT(DISTINCT e.email) FROM mail_events e
                                               JOIN institutions i ON mb_lower(i.email)=mb_lower(e.email)
                                              WHERE i.id IN ($in) AND e.status='delivered'");
            $row['opened']    = (int) scalar("SELECT COUNT(DISTINCT e.email) FROM mail_events e
                                               JOIN institutions i ON mb_lower(i.email)=mb_lower(e.email)
                                              WHERE i.id IN ($in) AND e.status='opened'");
            /* ЗАХОДЫ СЧИТАЕМ ОДНИМ ЗАПРОСОМ, А НЕ ПО ОДНОМУ НА УЧРЕЖДЕНИЕ.
             *
             * Здесь стоял цикл: на каждое учреждение свой запрос с LIKE по
             * журналу посещений. При 1359 учреждениях в сравнении это 1359
             * запросов LIKE по таблице в двадцать три тысячи строк — раздел
             * «Партнёры» переставал открываться вовсе. Берём все заходы на
             * страницу согласия разом и разбираем номера в памяти. */
            static $visits = null;
            if ($visits === null) {
                $visits = [];
                try {
                    // Своя переменная: снаружи $v — это вариант письма, и затирать
                    // её строкой журнала нельзя, иначе второй вариант не посчитается.
                    foreach (all("SELECT path FROM site_events WHERE path LIKE '%partner-join%'") as $ev) {
                        if (preg_match('~partner-join\?i=(\d+)~', (string) $ev['path'], $mv)) {
                            $visits[(int) $mv[1]] = true;
                        }
                    }
                } catch (\Throwable $e) { $visits = []; }
            }
            $visited = 0;
            foreach ($ids as $id) if (isset($visits[$id])) $visited++;
            $row['visited'] = $visited;
        } catch (\Throwable $e) { /* показываем то, что посчиталось */ }
        $out[$v] = $row;
    }
    try {
        if (function_exists('set_setting')) {
            set_setting('partner_ab_stats', json_encode(['at' => time(), 'data' => $out], JSON_UNESCAPED_UNICODE));
        }
    } catch (\Throwable $e) { /* кэш не важнее ответа */ }
    return $out;
}
