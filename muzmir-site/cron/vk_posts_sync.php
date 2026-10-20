<?php
/**
 * СЛОТЫ РОТАЦИИ СВЕРЯЮТСЯ С ДЕЙСТВУЮЩИМИ КОНКУРСАМИ КАЖДЫЕ СУТКИ.
 *
 * Записи о конкурсах заводились в ротацию руками, разовой командой
 * vk_posts_import.php. Цена этого известна: конкурсы новые каждый месяц
 * (правило 11), а слоты так и остались августовскими — и за семь дней до
 * 14.10.2026 по чужим сообществам ушло 171 приглашение на конкурсы, приём
 * которых кончился 25 августа. Заслон в vkp_posts() такую запись больше не
 * публикует, но молчаливая ротация из двух слотов вместо шести — тоже потеря:
 * про идущие конкурсы не узнаёт никто.
 *
 * Поэтому раз в сутки слоты 1-4 набираются сами из НАШИХ ЖЕ записей на стене
 * сообщества: по каждому действующему конкурсу берётся самая свежая запись со
 * ссылкой /konkurs-<слаг>, вместе с её афишей. Ничего не публикуется — этим
 * занят cron/vk_promo.php со своим расписанием и своими заслонами.
 *
 * Крон-строка (ежедневно в 05:40 МСК, до первого слота ротации в 09:00):
 *   40 5 * * * php /var/www/muzmir/cron/vk_posts_sync.php >/dev/null 2>&1
 *
 * Вручную:
 *   php cron/vk_posts_sync.php           — сверить и поправить
 *   php cron/vk_posts_sync.php --сухой   — только показать, что изменилось бы
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/vk.php';
require_once BASE_PATH . '/core/vk_promo.php';
require_once BASE_PATH . '/core/comp_now.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'vk_posts_sync';

$сухой = in_array('--сухой', array_slice($argv, 1), true) || in_array('--dry', array_slice($argv, 1), true);

/** Слоты под конкурсы. Слоты 5 и 6 держат партнёрство и клуб, их не трогаем. */
const SYNC_SLOTS = [1, 2, 3, 4];

$конкурсы = comps_open_now();
if (!$конкурсы) {
    // Конкурсов на месяц нет (правило 11: их заводит владелец). Записи при этом
    // не стираем: заслон vkp_posts() всё равно не выпустит закрытый конкурс, а
    // пустой слот нечем заполнить.
    cron_log(JOB, 'действующих конкурсов нет — слоты не трогаем, ротация идёт партнёрством и клубом');
    exit(0);
}

$gid = (int) cfgv('vk_group_id', 211325055);
$r   = vk_api('wall.get', ['owner_id' => -$gid, 'count' => 60]);
if (isset($r['error'])) {
    cron_log(JOB, 'стена сообщества не читается: ' . (string) ($r['error']['error_msg'] ?? '?') . ' — слоты оставлены как были');
    exit(1);
}
$записи = $r['response']['items'] ?? [];

/** Самая свежая запись со ссылкой /konkurs-<слаг>. Стена отдаётся новыми вперёд. */
$найти = static function (string $слаг) use ($записи): ?array {
    foreach ($записи as $p) {
        if (!str_contains((string) ($p['text'] ?? ''), '/konkurs-' . $слаг)) continue;
        $att = [];
        foreach (($p['attachments'] ?? []) as $x) {
            if ((string) ($x['type'] ?? '') !== 'photo') continue;
            $ph = $x['photo'] ?? [];
            $att[] = 'photo' . (int) ($ph['owner_id'] ?? 0) . '_' . (int) ($ph['id'] ?? 0);
        }
        return ['id' => (int) $p['id'], 'text' => (string) $p['text'], 'att' => implode(',', $att)];
    }
    return null;
};

/** Название конкурса прописными из кавычек — им и зовётся слот у человека. */
$имя = static function (string $text, string $запас): string {
    if (preg_match_all('~«([^»]{4,60})»~u', $text, $mm)) {
        foreach ($mm[1] as $c) {
            $c = trim($c);
            if ($c !== '' && mb_strtoupper($c) === $c) return $c;
        }
    }
    return mb_strtoupper($запас);
};

vkp_posts_ensure();
$изменено = 0;
$нетЗаписи = [];
$слот = 0;

foreach ($конкурсы as $c) {
    if (!isset(SYNC_SLOTS[$слот])) break;          // конкурсов больше, чем слотов
    $слаг = trim((string) ($c['slug'] ?? ''));
    if ($слаг === '') continue;

    $зап = $найти($слаг);
    if (!$зап) {
        // Записи о конкурсе на стене нет. Выдумывать текст приглашения нельзя:
        // у центра он свой, со своей оговоркой про формат и жюри. Называем словами.
        $нетЗаписи[] = (string) $c['name'];
        continue;
    }

    $n     = SYNC_SLOTS[$слот];
    $текст = vkp_osvezhit_kontakty($зап['text']);
    $было  = one("SELECT * FROM vk_posts WHERE slot = :s", ['s' => $n]);

    if ($было
        && (string) $было['text'] === $текст
        && (string) $было['attachment'] === $зап['att']
        && (int) $было['active'] === 1) {
        $слот++;
        continue;                                   // всё на месте, молчим
    }

    $было_имя = $было ? (string) $было['title'] : '(пусто)';
    if ($сухой) {
        echo "  слот $n: «{$было_имя}» → «" . $имя($текст, (string) $c['name']) . "» (запись #{$зап['id']})\n";
    } else {
        q("INSERT INTO vk_posts (slot, kind, title, text, attachment, source_post_id, active)
           VALUES (:s,'competition',:t,:x,:a,:p,1)
           ON CONFLICT(slot) DO UPDATE SET
             kind=excluded.kind, title=excluded.title, text=excluded.text,
             attachment=excluded.attachment, source_post_id=excluded.source_post_id, active=1",
          ['s' => $n, 't' => $имя($текст, (string) $c['name']), 'x' => $текст,
           'a' => $зап['att'], 'p' => $зап['id']]);
        cron_log(JOB, "слот $n: «{$было_имя}» заменён на «" . $имя($текст, (string) $c['name'])
            . "» из записи #{$зап['id']}");
    }
    $изменено++;
    $слот++;
}

/* Конкурсов меньше, чем слотов — лишние выключаем. Иначе в ротации остался бы
   прошлый месяц: заслон его не выпустит, но в пульте он выглядел бы живым. */
for ($i = $слот; $i < count(SYNC_SLOTS); $i++) {
    $n  = SYNC_SLOTS[$i];
    $ст = one("SELECT slot, title, active FROM vk_posts WHERE slot = :s AND active = 1", ['s' => $n]);
    if (!$ст) continue;
    if ($сухой) { echo "  слот $n: «{$ст['title']}» выключить (конкурса под него нет)\n"; }
    else {
        update('vk_posts', ['active' => 0], 'slot = :s', ['s' => $n]);
        cron_log(JOB, "слот $n: «{$ст['title']}» выключен, действующего конкурса под него нет");
    }
    $изменено++;
}

if ($нетЗаписи) {
    $txt = 'на стене сообщества нет записи о конкурсе: ' . implode(', ', $нетЗаписи)
         . ' — слот под него не заполнен, приглашение по чужим сообществам не идёт';
    cron_log(JOB, $txt);
    if (!$сухой) {
        // Пустой слот это молчание центра о своём же конкурсе, и узнать о нём
        // можно только словами: в журнале крона такую строку никто не ищет.
        if (!function_exists('owner_notify') && is_file(BASE_PATH . '/core/notify_owner.php')) {
            require_once BASE_PATH . '/core/notify_owner.php';
        }
        if (function_exists('owner_notify')) {
            owner_notify('АНАЛИТИКА', 'Ротация ВК: слот под конкурс не заполнен', $txt,
                ['Конкурсы' => implode(', ', $нетЗаписи),
                 'Что сделать' => 'опубликовать запись о конкурсе на стене сообщества — ротация подхватит её сама в 05:40']);
        } elseif (function_exists('tg_notify_admin')) {
            tg_notify_admin('Ротация ВК: ' . $txt);
        }
    }
}

/* Зелёное молчит: отчёт «всё на месте» каждые сутки обесценивает сам себя. */
if ($изменено === 0 && !$нетЗаписи) {
    if ($сухой) echo "  всё на месте, менять нечего\n";
    exit(0);
}
// Сухой прогон ничего не менял, и говорить «изменено» ему нельзя: по такой
// строке человек решит, что правка уже применена.
echo $сухой
    ? "  изменилось бы слотов: $изменено\n"
    : "vk_posts_sync: изменено слотов $изменено\n";
