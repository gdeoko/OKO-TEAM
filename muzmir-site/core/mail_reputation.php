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
        $d = mrep_bucket((string) $r['d']);
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
    return $d !== '' && isset(mrep_paused_domains()[mrep_bucket($d)]);
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
    $out = [];
    foreach (mrep_services() as $domains) foreach ($domains as $d) $out[] = $d;
    return $out;
}

/**
 * ОДНА СЛУЖБА — ОДНА НОРМА, СКОЛЬКО БЫ ДОМЕНОВ У НЕЁ НИ БЫЛО.
 *
 * mail.ru, bk.ru, inbox.ru и list.ru — это один почтовик с одними серверами и
 * одной репутацией отправителя. Пока норма считалась по домену, каждый из них
 * получал свою сотню писем: служба видела четыреста, мы в отчёте — сто, и
 * «пробный» режим после блокировки на деле означал 120 писем в сутки вместо
 * тридцати. 19 августа так и вышло: норма mail.ru 100, ушло 168.
 *
 * Поэтому норма, пауза и статистика считаются по СЛУЖБЕ. Домен, которого в
 * списке нет (школьная почта, ведомственный шлюз), остаётся сам по себе: там
 * счёт идёт на единицы писем, и объединять нечего.
 */
function mrep_services(): array {
    return [
        'mail.ru'   => ['mail.ru', 'bk.ru', 'list.ru', 'inbox.ru', 'internet.ru',
                        'mail.ua', 'xmail.ru'],
        'yandex.ru' => ['yandex.ru', 'ya.ru', 'yandex.com', 'narod.ru', 'yandex.by',
                        'yandex.kz', 'yandex.ua'],
        'gmail.com' => ['gmail.com', 'googlemail.com'],
        'rambler.ru' => ['rambler.ru', 'lenta.ru', 'autorambler.ru', 'myrambler.ru', 'ro.ru'],
    ];
}

/**
 * КОРЗИНА, В КОТОРУЮ ПОПАДАЕТ АДРЕС.
 *
 * Для домена известной службы — имя службы, для всех прочих — сам домен. Все
 * счётчики репутации ведутся по этому ключу, поэтому bk.ru и mail.ru делят
 * общий суточный лимит и общую паузу, а dshi-12.gov74.ru живёт отдельно.
 */
function mrep_bucket(string $domain): string {
    static $map = null;
    if ($map === null) {
        $map = [];
        foreach (mrep_services() as $service => $domains) {
            foreach ($domains as $d) $map[$d] = $service;
        }
    }
    $d = mb_strtolower(trim($domain));
    return $map[$d] ?? $d;
}

/** Норма домена на сегодня. Пересчитывается раз в сутки по вчерашнему результату. */
function mrep_domain_day_cap(string $domain): int {
    static $cache = [];
    $raw = mb_strtolower(trim($domain));
    if ($raw === '') return PHP_INT_MAX;
    if (!in_array($raw, mrep_managed_domains(), true)) return PHP_INT_MAX;
    $d = mrep_bucket($raw);                       // норма общая на всю службу
    if (isset($cache[$d])) return $cache[$d];
    $family = mrep_services()[$d] ?? [$d];
    $in     = implode(',', array_fill(0, count($family), '?'));

    mrep_ensure_caps();
    $start = max(100, (int) setting('nl_domain_start_cap', '1200'));
    $max   = max($start, (int) setting('nl_domain_cap_max', '6000'));
    $grow  = max(1.1, (float) setting('nl_domain_grow', '1.5'));
    // Пробная норма нужна уже здесь: ниже неё сохранённая норма не опускается,
    // а выше её поднимать нельзя — иначе проба перестаёт быть пробой (см. ниже).
    $probe = max(5, (int) setting('nl_domain_probe_cap', '30'));
    $today = date('Y-m-d');

    $row = one("SELECT day_cap, cap_date FROM mail_domain_caps WHERE domain=?", [$d]);
    if (!$row) {
        q("INSERT OR REPLACE INTO mail_domain_caps (domain, day_cap, cap_date) VALUES (?,?,?)",
          [$d, $start, $today]);
        return $cache[$d] = $start;
    }

    // ПОЛ ЧИТАЕМОЙ НОРМЫ — ПРОБНАЯ НОРМА, А НЕ СОТНЯ.
    //
    // Здесь стоял max(100, ...), и он отменял всё, что решала ветка полной
    // блокировки: в mail_domain_caps лежало «mail.ru = 30, домен заблокирован,
    // только проба», а отправщик получал 100. Опустить норму ниже сотни было
    // нельзя в принципе, то есть каждый день мы дарили закрывшей дверь службе
    // семьдесят лишних гарантированных отказов.
    $cap  = max($probe, (int) $row['day_cap']);
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
                WHERE LOWER(SUBSTR(email, INSTR(email,'@') + 1)) IN ($in)
                  AND date(created_at) = date(?)
                  AND time(created_at) >= '12:00:00'", array_merge($family, [$when]));
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

    /* ПОЛ ЗАЩИЩАЕТ ТЕМП, НО НЕ ПРОТИВ СТЕНЫ.
     *
     * Пол в 800 писем рассчитан на службу, которая придерживает часть потока и
     * назавтра отпускает. Mail.ru Group ведёт себя иначе: 56% отказов по mail.ru
     * и до 90% по bk.ru, list.ru, inbox.ru — принимает меньше, чем отбивает,
     * причём отбивает как спам. Полной блокировкой это не считается (доставки
     * есть), поэтому норма упиралась в пол и держалась на 800: каждый день мы
     * дарили службе полтысячи новых отказов и закапывали репутацию глубже.
     *
     * Когда служба отбивает больше половины, пол перестаёт действовать: норма
     * идёт вниз обычным делением пополам, пока не сойдётся с тем, что служба
     * реально принимает. Как только доля отказов упадёт ниже половины, пол
     * снова в силе и норма возвращается ростом. */
    if ($pct >= 50 && $tot >= 50) $floor = $probe;

    // СЛУЖБА ЗАКРЫЛА ДВЕРЬ — СТУЧИМСЯ РАЗ В ДЕНЬ, А НЕ ТЫСЯЧУ.
    //
    // 19 августа Mail.ru Group (mail.ru, bk.ru, list.ru, inbox.ru) отбила ВСЁ:
    // ноль доставленных при 187 отказах по mail.ru, и сервис рассылок отсеял ещё
    // 1 131 письмо со своей стороны как заведомо спамное. Это уже не придержка
    // темпа, а блокировка домена. Пол в 800 писем тут работает против нас: мы
    // каждый день дарим службе восемьсот новых отказов и закапываем репутацию
    // глубже, вместо того чтобы разбираться с блокировкой.
    //
    // Поэтому у полного отказа своя ветка: суточная норма падает до пробной
    // (nl_domain_probe_cap, по умолчанию 30). Этого хватает, чтобы каждый день
    // проверять, открылась ли дверь, и мало, чтобы навредить. Как только придёт
    // хоть одна доставка, домен выходит из пробы обычным ростом.
    $fullyBlocked = $dl === 0 && $hb >= 50;

    if ($tot < 50)        $new = $cap;                          // мало данных — стоим на месте
    elseif ($fullyBlocked) $new = $probe;                       // дверь закрыта — только проба
    // Снижение не должно оборачиваться повышением: у службы в пробе норма ниже
    // пола, и один max() поднял бы её с тридцати сразу до восьмисот — ровно в тот
    // день, когда служба отбивает каждое четвёртое письмо.
    elseif ($pct >= 25)   $new = (int) min($cap, max($floor, $cap / 2));
    elseif ($pct >= 10)   $new = $cap;                          // ни туда ни сюда — держим
    else                  $new = (int) min($max, ceil($cap * $grow));

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
        $rate = static function (string $service, string $day): float {
            $fam = mrep_services()[$service] ?? [$service];
            $ph  = implode(',', array_fill(0, count($fam), '?'));
            $r = one("SELECT SUM(status='delivered') dl, SUM(status='opened') op
                        FROM mail_events
                       WHERE LOWER(SUBSTR(email, INSTR(email,'@') + 1)) IN ($ph)
                         AND date(created_at) = date(?)", array_merge($fam, [$day]));
            $d = (int) ($r['dl'] ?? 0);
            return $d > 0 ? ((int) ($r['op'] ?? 0)) / $d : 0.0;
        };
        $mine = $rate($d, $when);
        $best = 0.0;
        foreach (array_keys(mrep_services()) as $other) {
            if ($other === $d) continue;
            $best = max($best, $rate($other, $when));
        }
        if ($best > 0.02 && $mine < $best * 0.4) {
            $new = (int) min($cap, max($floor, min($new, $cap / 2)));   // наказание не повышает норму
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

/**
 * Сколько писем уже ушло сегодня в каждую службу. Один запрос на прогон.
 *
 * $bump — служба, которой письмо ушло ПРЯМО СЕЙЧАС. Без этого счётчик за весь
 * прогон оставался таким, каким его прочитали на входе, и норма перелетала на
 * размер пачки: при пробной норме в 30 писем и пачке в 12 это уже не мелочь.
 */
function mrep_sent_today_by_domain(?string $bump = null): array {
    static $map = null;
    if ($map === null) {
        $map = [];
        try {
            foreach (all("SELECT LOWER(SUBSTR(to_email, INSTR(to_email,'@') + 1)) d, COUNT(*) c
                            FROM mail_queue
                           WHERE status='sent' AND date(sent_at)=date('now','localtime')
                             AND INSTR(to_email,'@') > 0
                           GROUP BY 1") as $r) {
                // Ключ — служба: письмо на bk.ru тратит ту же норму, что и на mail.ru.
                $b = mrep_bucket((string) $r['d']);
                $map[$b] = ($map[$b] ?? 0) + (int) $r['c'];
            }
        } catch (\Throwable $e) {}
    }
    if ($bump !== null && $bump !== '') $map[$bump] = ($map[$bump] ?? 0) + 1;
    return $map;
}

/** Письмо ушло: счётчик службы растёт сразу, не дожидаясь следующего прогона. */
function mrep_note_sent(string $email): void {
    $d = mrep_domain($email);
    if ($d === '') return;
    mrep_sent_today_by_domain(mrep_bucket($d));
}

/** Суточная норма этой службы уже выбрана? */
function mrep_domain_quota_done(string $email): bool {
    $d = mrep_domain($email);
    if ($d === '') return false;
    $cap = mrep_domain_day_cap($d);
    if ($cap === PHP_INT_MAX) return false;
    return (mrep_sent_today_by_domain()[mrep_bucket($d)] ?? 0) >= $cap;
}

/** Сколько ещё можно сегодня в эту службу (для отчёта). */
function mrep_domain_quota_left(string $domain): int {
    $cap = mrep_domain_day_cap($domain);
    if ($cap === PHP_INT_MAX) return PHP_INT_MAX;
    return max(0, $cap - (mrep_sent_today_by_domain()[mrep_bucket($domain)] ?? 0));
}

/**
 * АДРЕС ЗАКРЫТ САМИМ СЕРВИСОМ РАССЫЛОК?
 *
 * err_spam_skipped и skip_dup_unreachable значат, что письмо даже не пытались
 * доставить: адрес лежит в списке подавления сервиса. Повторять такое письмо
 * бессмысленно — оно снова будет отброшено, а мы получим ещё одно «событие
 * отказа» и ещё раз испортим себе статистику. 19 августа так и вышло: 292
 * письма за утро прошли круг «повторить → сервис отбросил → повторить».
 * Такие адреса ждут снятия подавления (scripts/unisender_suppression.php),
 * и письмо им ставится заново уже оттуда.
 */
function mrep_service_skipped(string $reason): bool {
    $r = mb_strtolower($reason);
    foreach (['err_spam_skipped', 'skip_dup_unreachable', 'skip_dup_temp_unreachable',
              'skip_unsubscribed', 'skip_complained'] as $w) {
        if (str_contains($r, $w)) return true;
    }
    return false;
}

/**
 * ПОВТОРИТЬ ПОСЛЕДНЕЕ МАССОВОЕ ПИСЬМО АДРЕСУ.
 *
 * Копия прежней строки очереди с тем же рецептом сборки: тело собирается в
 * момент отправки, поэтому человек получит актуальный текст. Повтор делается
 * один раз — строка, которая сама была повтором, второй раз не копируется.
 */
function mrep_requeue_last(string $email, string $why): bool {
    $e = mb_strtolower(trim($email));
    if ($e === '') return false;

    $row = one("SELECT * FROM mail_queue
                 WHERE LOWER(to_email)=? AND COALESCE(priority,0)>0 AND status='sent'
                 ORDER BY id DESC LIMIT 1", [$e]);
    if (!$row) return false;
    if (str_starts_with((string) ($row['error'] ?? ''), 'повтор')) return false;

    $has = (int) (scalar("SELECT COUNT(*) FROM mail_queue
                           WHERE LOWER(to_email)=? AND status IN ('queued','paused')
                             AND COALESCE(priority,0)>0", [$e]) ?? 0);
    if ($has > 0) return false;

    try {
        insert('mail_queue', [
            'to_email'      => (string) $row['to_email'],
            'to_name'       => (string) ($row['to_name'] ?? ''),
            'subject'       => (string) $row['subject'],
            'body'          => (string) $row['body'],
            'build'         => (string) ($row['build'] ?? ''),
            'attach'        => (string) ($row['attach'] ?? ''),
            'newsletter_id' => (int) ($row['newsletter_id'] ?? 0),
            'campaign_type' => (string) ($row['campaign_type'] ?? ''),
            'priority'      => (int) $row['priority'],
            'status'        => 'queued',
            'tries'         => 0,
            'error'         => 'повтор: ' . $why,
        ]);
        return true;
    } catch (\Throwable $e2) { return false; }
}

/** Короткая строка для журнала и отчёта: кто на паузе и почему. */
function mrep_paused_note(): string {
    $p = mrep_paused_domains();
    if (!$p) return '';
    $parts = [];
    foreach ($p as $d => $s) $parts[] = sprintf('%s %.0f%% (%d)', $d, $s['pct'], $s['total']);
    return implode(', ', $parts);
}
