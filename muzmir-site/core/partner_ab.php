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
function pab_stats(): array {
    pab_migrate();
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
            // Заход на страницу согласия виден по адресу вида /partner-join?i=<id>.
            $visited = 0;
            foreach ($ids as $id) {
                $visited += (int) scalar("SELECT COUNT(*) FROM site_events WHERE path LIKE ?", ['%partner-join?i=' . $id . '%']) > 0 ? 1 : 0;
            }
            $row['visited'] = $visited;
        } catch (\Throwable $e) { /* показываем то, что посчиталось */ }
        $out[$v] = $row;
    }
    return $out;
}
