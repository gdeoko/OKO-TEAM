<?php
/**
 * ДОБАВИТЬ КНОПКУ «СТАТЬ ПАРТНЁРОМ» В УЖЕ СОБРАННЫЕ ПИСЬМА.
 *
 * Письма учреждениям собираются заранее и лежат в очереди готовым HTML. На
 * момент, когда появилась кнопка одноклик-согласия, в очереди уже стояли тысячи
 * писем без неё. Отправить их как есть — значит потерять ровно ту часть волны,
 * ради которой кнопка и делалась: на них согласие снова потребует ответного
 * письма, а на такое согласие за 7 849 отправленных приглашений не откликнулся
 * никто.
 *
 * Скрипт трогает только письма в очереди (отправленные не переписываются) и
 * только те, где кнопки ещё нет. Учреждение находится по адресу получателя:
 * ссылка именная, чужую подставить нельзя.
 *
 *   php scripts/queue_add_partner_button.php --dry   — посчитать, ничего не меняя
 *   php scripts/queue_add_partner_button.php         — дописать кнопку
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/partner.php';
require_once BASE_PATH . '/core/letter_mail.php';

$dry  = in_array('--dry', $argv, true);
$line = str_repeat('=', 78);

// Куда встраивать. Письма собирались разными версиями шаблона, поэтому якорей
// несколько: берём первый найденный и встаём перед его абзацем. Последний в
// списке — подпись: она есть в любом письме, и место перед ней тоже уместно.
const ANCHORS = ['По вопросам участия и партнёрства', 'По вопросам участия',
                 'Положения конкурсов, образцы дипломов', 'С уважением'];

echo "КНОПКА ПАРТНЁРСТВА В ПИСЬМАХ ОЧЕРЕДИ\n$line\n";

$rows = all("SELECT q.id, q.to_email, q.body, i.id AS inst_id, i.name
               FROM mail_queue q
               JOIN institutions i ON LOWER(i.email) = LOWER(q.to_email)
              WHERE q.status IN ('queued','paused')
                AND q.campaign_type = 'inst'
                AND q.body NOT LIKE '%partner-join%'");

printf("  писем к правке: %d\n", count($rows));
if (!$rows) { echo "  делать нечего\n"; exit(0); }

$patched = $skipped = 0;
foreach ($rows as $r) {
    $body = (string) $r['body'];
    $pos  = false;
    foreach (ANCHORS as $a) {
        $pos = mb_strpos($body, $a);
        if ($pos !== false) break;
    }
    if ($pos === false) { $skipped++; continue; }

    // Встраиваем перед абзацем с контактами, не ломая разметку: ищем начало его
    // тега, а не просто позицию текста.
    $cut = mb_strrpos(mb_substr($body, 0, $pos), '<p');
    if ($cut === false) { $skipped++; continue; }

    $block = lm_callout('<b>Информационное партнёрство.</b> Учреждение-партнёр получает именной '
           . 'сертификат, персональную ссылку для своих участников, кабинет на сайте, а после пяти '
           . 'заявок — благодарственные письма педагогам. Участие бесплатное и ни к чему не обязывает.')
           . mm_email_btn(partner_join_url((int) $r['inst_id']), 'Стать партнёром', 'navy');

    $new = mb_substr($body, 0, $cut) . $block . mb_substr($body, $cut);
    // Текст про ответное письмо остаётся, но перестаёт быть единственным путём.
    $new = str_replace('Согласие на информационное партнёрство достаточно направить ответным письмом.',
                       'Согласие на информационное партнёрство можно также направить ответным письмом.', $new);

    if (!$dry) q("UPDATE mail_queue SET body=:b WHERE id=:i", ['b' => $new, 'i' => (int) $r['id']]);
    $patched++;
}

printf("  %s: %d, пропущено: %d\n", $dry ? 'подошло бы' : 'дописано', $patched, $skipped);

if (!$dry) {
    $left = (int) (scalar("SELECT COUNT(*) FROM mail_queue q JOIN institutions i ON LOWER(i.email)=LOWER(q.to_email)
                            WHERE q.status IN ('queued','paused') AND q.campaign_type='inst'
                              AND q.body NOT LIKE '%partner-join%'") ?? 0);
    printf("  осталось без кнопки: %d\n", $left);
}
