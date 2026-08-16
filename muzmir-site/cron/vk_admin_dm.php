<?php
/**
 * ПИСЬМО АДМИНИСТРАТОРУ СООБЩЕСТВА, У КОТОРОГО СТЕНА ЗАКРЫТА.
 *
 * Из 16 463 сообществ учреждений у 10 017 стена закрыта наглухо: ни записать,
 * ни предложить. Единственная оставшаяся дверь — сообщения сообщества: их читает
 * тот же человек, который ведёт страницу школы или дома культуры.
 *
 * Пишем не «разместите нашу рекламу», а даём готовый анонс, который ему самому
 * пригодится: бесплатный конкурс для его же учеников. Просьба одна и мягкая —
 * опубликовать, если сочтёт полезным. Второй раз одному адресату не пишем.
 *
 * ТЕМП. Личные сообщения ВКонтакте считает строже записей: 30 в сутки с паузой в
 * несколько минут — это темп живого человека, который пишет по делу. Ошибки
 * приватности (901, 902, 936) означают закрытые сообщения — помечаем адресата и
 * идём дальше; частотные (6, 9, 29) — выходим до следующего часа.
 *
 * Крон:
 *   42 10-20 * * *  php /var/www/muzmir/cron/vk_admin_dm.php >/dev/null 2>&1
 *
 * Выключатель: settings.vk_admin_dm_enabled = '0'; общий стоп-кран тоже действует.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/vk_promo.php';
require_once BASE_PATH . '/core/newsletter.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'vk_admin_dm';

if (function_exists('mass_sending_enabled') && !mass_sending_enabled()) exit(0);
if ((string) scalar("SELECT value FROM settings WHERE key='vk_admin_dm_enabled'") === '0') exit(0);
if (trim((string) cfgv('vk_token', '')) === '') exit(0);
if (!cron_lock(JOB, 1800)) exit(0);

try {
    vkp_ensure();
    db()->exec("CREATE TABLE IF NOT EXISTS vk_admin_dm_log (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id   INTEGER NOT NULL,
        outcome    TEXT DEFAULT 'sent',
        error      TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now','localtime')))");
    db()->exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_vkadm_group ON vk_admin_dm_log(group_id)");

    $cap  = max(0, (int) (scalar("SELECT value FROM settings WHERE key='vk_admin_dm_daily'") ?: 30));
    $sent = (int) (scalar("SELECT COUNT(*) FROM vk_admin_dm_log
                            WHERE date(created_at)=date('now','localtime') AND outcome='sent'") ?? 0);
    $left = $cap - $sent;
    if ($left <= 0) { cron_unlock(JOB); exit(0); }
    $take = min($left, max(1, (int) (scalar("SELECT value FROM settings WHERE key='vk_admin_dm_per_run'") ?: 3)));

    // Закрытые стены, профильные, от крупных к мелким, кому ещё не писали.
    $targets = all("SELECT t.* FROM vk_targets t
                     LEFT JOIN vk_admin_dm_log l ON l.group_id = t.group_id
                    WHERE t.can_post=0 AND t.can_suggest=0 AND t.score>=12 AND l.id IS NULL
                    ORDER BY t.score DESC, t.members DESC LIMIT :l", ['l' => $take]);
    if (!$targets) { cron_log(JOB, 'адресатов нет'); cron_unlock(JOB); exit(0); }

    $comp = one("SELECT slug, name, end_date FROM competitions WHERE status='open' AND is_paid=0 ORDER BY end_date LIMIT 1")
         ?: one("SELECT slug, name, end_date FROM competitions WHERE status='open' ORDER BY end_date LIMIT 1");
    if (!$comp) { cron_log(JOB, 'нет открытых конкурсов'); cron_unlock(JOB); exit(0); }

    $link = vkp_link_human(rtrim((string) cfgv('base_url'), '/')
          . '/competitions?utm_source=vk&utm_medium=dm&utm_campaign=vk-dm-' . date('Y-m'));
    $dl   = preg_replace('~\s+\d{4}$~u', '', ru_date((string) $comp['end_date']));

    $ok = $err = 0;
    foreach ($targets as $t) {
        $forms = vkp_kind_forms((string) $t['kind'], (string) $t['name']);
        $gid   = (int) $t['group_id'];

        // Три варианта обращения: одинаковый текст в сотне диалогов ВКонтакте видит.
        $hello = [
            'Здравствуйте! Пишем из Культурного центра «Музыкальный Мир».',
            'Добрый день! Культурный центр «Музыкальный Мир», оргкомитет конкурсов.',
            'Здравствуйте! Обращаемся из Культурного центра «Музыкальный Мир».',
        ][$gid % 3];

        $msg = $hello . "\n\n"
             . "До {$dl} идёт приём работ на всероссийский конкурс детского творчества «{$comp['name']}». "
             . "Участие бесплатное, всё дистанционно: вокал, хореография, инструментальное исполнительство, "
             . "рисунок, декоративно-прикладное творчество, театр, художественное слово.\n\n"
             . "Каждый участник получает именной диплом, преподаватель — благодарственное письмо; "
             . "документы подходят для портфолио и аттестации.\n\n"
             . "Если сочтёте полезным для воспитанников " . $forms['gen'] . ", будем признательны за анонс "
             . "у вас в сообществе. Готовый текст и афишу пришлём по первой просьбе, "
             . "либо можно просто дать ссылку: " . $link . "\n\n"
             . "Спасибо за вашу работу.";

        $r = vk_api('messages.send', [
            'peer_id'   => -$gid,
            'message'   => $msg,
            'random_id' => random_int(1, PHP_INT_MAX),
        ]);

        if (isset($r['error'])) {
            $code = (int) ($r['error']['error_code'] ?? 0);
            $emsg = (string) ($r['error']['error_msg'] ?? '?');
            q("INSERT OR IGNORE INTO vk_admin_dm_log (group_id,outcome,error) VALUES (:g,'error',:e)",
              ['g' => $gid, 'e' => mb_substr($emsg, 0, 200)]);
            $err++;
            if (in_array($code, [6, 9, 29], true)) {
                cron_log(JOB, 'частотный предел ВКонтакте: ' . $emsg . ' — до следующего часа');
                break;
            }
        } else {
            q("INSERT OR IGNORE INTO vk_admin_dm_log (group_id,outcome) VALUES (:g,'sent')", ['g' => $gid]);
            $ok++;
        }
        sleep(random_int(150, 260));      // 2,5-4,5 минуты между сообщениями
    }

    if ($ok || $err) cron_log(JOB, sprintf('написано %d, отказов %d (за сутки %d из %d)', $ok, $err, $sent + $ok, $cap));
} catch (\Throwable $e) {
    cron_log(JOB, 'ОШИБКА: ' . $e->getMessage());
}

cron_unlock(JOB);
