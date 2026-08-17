<?php
/**
 * ОТКАЗ ПОЧТОВИКА — ЭТО НЕ ВСЕГДА «АДРЕСА НЕТ».
 *
 * 17 августа за утро пришло 1 472 «жёстких отказа» — 37% отправленного, и по
 * прежним правилам все эти люди были бы вычеркнуты из базы навсегда. Разбор по
 * часам показал совсем другое:
 *
 *     08:00 МСК   800 писем   388 отказов mail.ru   79 доставлено
 *     09:00       810         349                   —
 *     10:00       809         307                   79
 *     11:00       808          16                  316
 *     12:00       736          21                  309
 *
 * Темп отправки не менялся, база не менялась, а отказы кончились сами. Мёртвая
 * база так себя не ведёт: несуществующие адреса отбиваются ровно весь день. Так
 * ведёт себя почтовая служба, которая придерживает незнакомого отправителя, пока
 * не убедится, что он не спамер. Доля отказов у своей базы и у учреждений совпала
 * до процента (37% и 38%) — ещё одно доказательство, что дело не в адресах.
 *
 * Отсюда два правила.
 *
 * ПЕРВОЕ. Отказ без объяснения — не приговор адресу. Вычёркиваем человека, только
 * если почтовик прямым текстом сказал, что ящика не существует. Молчаливый отказ
 * значит «сейчас не приму», и адрес остаётся жить.
 *
 * ВТОРОЕ. Домен, который начал отбивать пачкой, отдыхает. Долбиться в mail.ru,
 * когда он отбивает половину, — это добровольно портить себе репутацию: каждый
 * отказ почтовые службы записывают на отправителя. Пауза на час, потом проба
 * снова. Именно так этот день и разрулился бы сам, без потери тысячи адресов.
 */
declare(strict_types=1);

/**
 * ОТКАЗ ДОКАЗЫВАЕТ, ЧТО АДРЕСА НЕТ?
 *
 * Доказывают только слова почтовика. «no such user», «does not exist»,
 * «unknown recipient», код 5.1.1 — это адрес. «Blocked», «spam», «too many
 * connections», пустая строка — это канал, и адрес тут ни при чём.
 */
function mrep_bounce_is_proof(string $reason): bool {
    $r = mb_strtolower(trim($reason));
    if ($r === '') return false;                       // молчаливый отказ ничего не доказывает

    // Сначала то, что снимает вопрос: это точно про канал, а не про адрес.
    // err_* — вердикты сервиса рассылок (delivery_status у Unisender Go).
    foreach (['spam', 'blocked', 'blacklist', 'policy', 'reputation', 'rate limit',
              'too many', 'try again', 'temporarily', 'greylist', 'throttl',
              'security reason', 'not allowed', 'rejected by', 'ip address',
              'err_spam_rejected', 'err_blacklisted', 'err_will_retry',
              'err_no_smtp_service', 'err_destination_misconfigured',
              'err_too_large', 'err_delivery_failed'] as $w) {
        if (str_contains($r, $w)) return false;
    }
    foreach (['no such user', 'no such address', 'does not exist', 'doesn\'t exist',
              'user not found', 'unknown user', 'unknown recipient', 'unknown address',
              'recipient not found', 'invalid recipient', 'mailbox not found',
              'mailbox unavailable', 'account that you tried to reach',
              'user unknown', 'address rejected', 'не существует', 'нет такого',
              '5.1.1', '5.1.10', '550 5.1',
              'err_user_not_found', 'err_mailbox_discarded', 'err_domain_not_found',
              'err_unsubscribed', 'err_complained'] as $w) {
        if (str_contains($r, $w)) return true;
    }
    return false;                                      // не поняли — не вычёркиваем
}

/** Домен адреса в нижнем регистре ('' если адрес не похож на адрес). */
function mrep_domain(string $email): string {
    $at = mb_strrpos($email, '@');
    return $at === false ? '' : mb_strtolower(trim(mb_substr($email, $at + 1)));
}

/**
 * СТАТИСТИКА ДОМЕНА ЗА ПОСЛЕДНИЙ ЧАС: доставлено, отбито, доля отказов.
 * Считается по событиям сервиса рассылок — то есть по факту, а не по нашим попыткам.
 */
function mrep_domain_stats(int $minutes = 60): array {
    $out = [];
    try {
        $rows = all("SELECT LOWER(SUBSTR(email, INSTR(email,'@') + 1)) d, status, COUNT(*) c
                       FROM mail_events
                      WHERE created_at >= datetime('now','localtime', ?)
                        AND status IN ('delivered','hard_bounced')
                        AND INSTR(email,'@') > 0
                      GROUP BY 1, 2", ['-' . max(1, $minutes) . ' minutes']);
    } catch (\Throwable $e) { return []; }

    foreach ($rows as $r) {
        $d = (string) $r['d'];
        if (!isset($out[$d])) $out[$d] = ['delivered' => 0, 'bounced' => 0, 'total' => 0, 'pct' => 0.0];
        $k = (string) $r['status'] === 'delivered' ? 'delivered' : 'bounced';
        $out[$d][$k] += (int) $r['c'];
    }
    foreach ($out as $d => $s) {
        $t = $s['delivered'] + $s['bounced'];
        $out[$d]['total'] = $t;
        $out[$d]['pct']   = $t > 0 ? round($s['bounced'] * 100 / $t, 1) : 0.0;
    }
    return $out;
}

/**
 * ДОМЕНЫ, КОТОРЫМ СЕЙЧАС НЕ ПИШЕМ.
 *
 * Порог намеренно высокий: 30 событий и больше трети отказов. Случайная пара
 * мёртвых адресов домен не останавливает, а стена отказов — останавливает сразу.
 * Пауза действует час с момента последнего замера и снимается сама.
 *
 * Результат кэшируется на прогон: запрос идёт по журналу событий, а прогон крона
 * перебирает сотни писем.
 */
function mrep_paused_domains(): array {
    static $cache = null;
    if ($cache !== null) return $cache;

    $minEvents = max(10, (int) setting('nl_domain_min_events', '30'));
    $limitPct  = (float) setting('nl_domain_stop_pct', '35');

    $cache = [];
    foreach (mrep_domain_stats(60) as $d => $s) {
        if ($s['total'] >= $minEvents && $s['pct'] >= $limitPct) $cache[$d] = $s;
    }
    return $cache;
}

/** Этому домену сейчас пишем? */
function mrep_domain_paused(string $email): bool {
    $d = mrep_domain($email);
    return $d !== '' && isset(mrep_paused_domains()[$d]);
}

/** Короткая строка для журнала и отчёта: кто на паузе и почему. */
function mrep_paused_note(): string {
    $p = mrep_paused_domains();
    if (!$p) return '';
    $parts = [];
    foreach ($p as $d => $s) $parts[] = sprintf('%s %.0f%% (%d)', $d, $s['pct'], $s['total']);
    return implode(', ', $parts);
}
