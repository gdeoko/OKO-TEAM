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

/**
 * СВОЯ СУТОЧНАЯ НОРМА НА КАЖДУЮ ПОЧТОВУЮ СЛУЖБУ.
 *
 * Общий потолок в 4 000 писем ничего не говорит о том, сколько из них уйдёт в
 * mail.ru. А уходит туда больше половины: в очереди своей базы 14 911 адресов
 * mail.ru из 23 252. Для почтовой службы это выглядит так: незнакомый домен,
 * который вчера не слал ничего, сегодня вываливает две с половиной тысячи писем.
 * Ответ предсказуемый — «550 spam message rejected», и именно его мы и получили.
 *
 * Прогрев считается ПО КАЖДОЙ СЛУЖБЕ ОТДЕЛЬНО и растёт от факта: доставили вчера
 * чисто — норма выросла в полтора раза, посыпались отказы — норма ополовинена.
 * Домен, которого в списке нет (школьная почта, ведомственный шлюз), нормой не
 * ограничивается: там счёт идёт на единицы писем.
 *
 * Настройки: nl_domain_start_cap (первая норма), nl_domain_cap_max (потолок),
 * nl_domain_grow (во сколько раз растём за сутки).
 */
function mrep_managed_domains(): array {
    return ['mail.ru', 'bk.ru', 'list.ru', 'inbox.ru', 'internet.ru',
            'yandex.ru', 'ya.ru', 'gmail.com', 'rambler.ru'];
}

/** Норма домена на сегодня. Пересчитывается раз в сутки по вчерашнему результату. */
function mrep_domain_day_cap(string $domain): int {
    static $cache = [];
    $d = mb_strtolower(trim($domain));
    if ($d === '') return PHP_INT_MAX;
    if (!in_array($d, mrep_managed_domains(), true)) return PHP_INT_MAX;
    if (isset($cache[$d])) return $cache[$d];

    mrep_ensure_caps();
    $start = max(100, (int) setting('nl_domain_start_cap', '1200'));
    $max   = max($start, (int) setting('nl_domain_cap_max', '6000'));
    $grow  = max(1.1, (float) setting('nl_domain_grow', '1.5'));
    $today = date('Y-m-d');

    $row = one("SELECT day_cap, cap_date FROM mail_domain_caps WHERE domain=?", [$d]);
    if (!$row) {
        q("INSERT OR REPLACE INTO mail_domain_caps (domain, day_cap, cap_date) VALUES (?,?,?)",
          [$d, $start, $today]);
        return $cache[$d] = $start;
    }

    $cap  = max(100, (int) $row['day_cap']);
    $when = (string) $row['cap_date'];
    if ($when === $today) return $cache[$d] = $cap;

    // Новый день: смотрим, чем кончился прошлый заход в эту службу.
    // СУДИМ ПО ТОМУ, ЧЕМ ДЕНЬ КОНЧИЛСЯ, А НЕ ЧЕМ НАЧАЛСЯ.
    //
    // Утро — худшая часть суток для оценки: почтовая служба придерживает первую
    // порцию от отправителя, который ночью молчал, и отбивает её пачкой. 17 августа
    // mail.ru в восемь утра отбил 388 писем из 800, а в одиннадцать — шестнадцать
    // из 808, при неизменном темпе. Если считать по всему дню, выходит 60% отказов
    // и норма режется вдвое — то есть служба наказывает нас за то, что сама же
    // отпустила через три часа. Берём вторую половину окна: она показывает, как
    // домен ведёт себя, когда отправитель для него уже не новичок.
    $st = one("SELECT SUM(status='delivered') dl, SUM(status='hard_bounced') hb
                 FROM mail_events
                WHERE LOWER(SUBSTR(email, INSTR(email,'@') + 1)) = ?
                  AND date(created_at) = date(?)
                  AND time(created_at) >= '12:00:00'", [$d, $when]);
    $dl = (int) ($st['dl'] ?? 0);
    $hb = (int) ($st['hb'] ?? 0);
    $tot = $dl + $hb;
    $pct = $tot > 0 ? $hb * 100 / $tot : 0;

    // НИЖНЯЯ ГРАНИЦА ОБЯЗАТЕЛЬНА.
    //
    // Без неё норма сползает вниз лавиной: плохой день ополовинил, на следующий
    // день писем меньше, статистика хуже, ополовинил снова — и через неделю в
    // mail.ru уходит двести писем в сутки, а база стоит. Пол не даёт превратить
    // защиту темпа в остановку рассылки: даже в самый плохой день служба получает
    // nl_domain_floor_cap писем, и по ним видно, отошла она или нет.
    $floor = max(200, (int) setting('nl_domain_floor_cap', '800'));

    if ($tot < 50)      $new = $cap;                          // мало данных — стоим на месте
    elseif ($pct >= 25) $new = (int) max($floor, $cap / 2);   // отбивают — вдвое назад, но не ниже пола
    elseif ($pct >= 10) $new = $cap;                          // ни туда ни сюда — держим
    else                $new = (int) min($max, ceil($cap * $grow));

    // ПИСЬМО МОЖЕТ ДОЙТИ И ЛЕЧЬ В «СПАМ» — ЭТО ХУЖЕ ОТКАЗА.
    //
    // Отказ хотя бы честен: мы его видим и снижаем темп. А «доставлено» с нулём
    // открытий выглядит как успех, и норма при таком раскладе продолжала бы расти,
    // пока служба не перестала бы принимать вовсе. 17 августа так выглядел
    // yandex.ru: 1 181 доставленных писем и семь открытий за всё время, при том
    // что gmail.com в тот же день открывали 23% получателей, а mail.ru — 11%.
    //
    // Сравнение только между службами и только за один день: доля открытий сама
    // по себе ничего не значит (у разной аудитории она разная), а вот втрое
    // меньшая, чем у соседней службы на ТОЙ ЖЕ рассылке, значит «Спам».
    if ($dl >= 200) {
        $rate = static function (string $dom, string $day): float {
            $r = one("SELECT SUM(status='delivered') dl, SUM(status='opened') op
                        FROM mail_events
                       WHERE LOWER(SUBSTR(email, INSTR(email,'@') + 1)) = ?
                         AND date(created_at) = date(?)", [$dom, $day]);
            $d = (int) ($r['dl'] ?? 0);
            return $d > 0 ? ((int) ($r['op'] ?? 0)) / $d : 0.0;
        };
        $mine = $rate($d, $when);
        $best = 0.0;
        foreach (mrep_managed_domains() as $other) {
            if ($other === $d) continue;
            $best = max($best, $rate($other, $when));
        }
        if ($best > 0.02 && $mine < $best * 0.4) {
            $new = (int) max($floor, min($new, $cap / 2));
            q("UPDATE mail_domain_caps SET note=? WHERE domain=?",
              [sprintf('доставляет, но не открывают: %.0f%% против %.0f%% у лучшей службы — похоже на «Спам»',
                       $mine * 100, $best * 100), $d]);
        }
    }

    q("UPDATE mail_domain_caps SET day_cap=?, cap_date=?, note=? WHERE domain=?",
      [$new, $today, sprintf('вчера %d доставлено, %d отказов (%.0f%%)', $dl, $hb, $pct), $d]);
    return $cache[$d] = $new;
}

function mrep_ensure_caps(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    db()->exec("CREATE TABLE IF NOT EXISTS mail_domain_caps (
        domain   TEXT PRIMARY KEY,
        day_cap  INTEGER DEFAULT 0,
        cap_date TEXT DEFAULT '',
        note     TEXT DEFAULT '')");
}

/** Сколько писем уже ушло сегодня в каждый домен. Один запрос на прогон. */
function mrep_sent_today_by_domain(): array {
    static $map = null;
    if ($map !== null) return $map;
    $map = [];
    try {
        foreach (all("SELECT LOWER(SUBSTR(to_email, INSTR(to_email,'@') + 1)) d, COUNT(*) c
                        FROM mail_queue
                       WHERE status='sent' AND date(sent_at)=date('now','localtime')
                         AND INSTR(to_email,'@') > 0
                       GROUP BY 1") as $r) {
            $map[(string) $r['d']] = (int) $r['c'];
        }
    } catch (\Throwable $e) {}
    return $map;
}

/** Суточная норма этой службы уже выбрана? */
function mrep_domain_quota_done(string $email): bool {
    $d = mrep_domain($email);
    if ($d === '') return false;
    $cap = mrep_domain_day_cap($d);
    if ($cap === PHP_INT_MAX) return false;
    return (mrep_sent_today_by_domain()[$d] ?? 0) >= $cap;
}

/** Сколько ещё можно сегодня в эту службу (для отчёта). */
function mrep_domain_quota_left(string $domain): int {
    $cap = mrep_domain_day_cap($domain);
    if ($cap === PHP_INT_MAX) return PHP_INT_MAX;
    return max(0, $cap - (mrep_sent_today_by_domain()[mb_strtolower($domain)] ?? 0));
}

/** Короткая строка для журнала и отчёта: кто на паузе и почему. */
function mrep_paused_note(): string {
    $p = mrep_paused_domains();
    if (!$p) return '';
    $parts = [];
    foreach ($p as $d => $s) $parts[] = sprintf('%s %.0f%% (%d)', $d, $s['pct'], $s['total']);
    return implode(', ', $parts);
}
