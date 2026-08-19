<?php
/**
 * КАК ЦЕНТР РАЗГОВАРИВАЕТ С ЛЮДЬМИ — ИЗ ЖИВОЙ ПЕРЕПИСКИ, А НЕ ИЗ ГОЛОВЫ.
 *
 * scripts/vk_dialogs_export.php выгружает переписку сообщества целиком. Здесь она
 * разбирается на пары «вопрос участника — ответ центра», раскладывается по темам
 * и превращается в образцы, которые видит бот перед каждым ответом.
 *
 * Зачем именно образцы, а не правила. Правилами можно описать, ЧТО отвечать, но
 * не КАК: в переписке центра есть узнаваемые вещи, которые ни в одном положении не
 * записаны. Просят уточнить конкурс тремя строчками, а не абзацем. Не обещают
 * сроки, которых не знают. Заканчивают разговор благодарностью и просьбой об
 * отзыве, но только когда вопрос закрыт, а не в каждом сообщении.
 *
 * Что отбраковывается:
 *   • дежурные отписки «ожидайте пожалуйста» без ответа по существу — именно от
 *     них бот и выглядел сломанным;
 *   • ответы со старыми адресами сайта (они переехали);
 *   • слишком длинные полотна и слишком короткие «да»/«хорошо»;
 *   • ответы, где ничего не понять без вложения или скриншота.
 *
 *   php scripts/vk_style_learn.php            — разобрать и показать
 *   php scripts/vk_style_learn.php --apply    — записать образцы в базу
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$apply = in_array('--apply', $argv, true);
$src   = BASE_PATH . '/data/vk_dialogs.json';
foreach ($argv as $a) if (preg_match('~^--src=(.+)$~', $a, $m)) $src = $m[1];
$line = str_repeat('=', 78);

if (!is_file($src)) { fwrite(STDERR, "нет выгрузки: $src (сначала vk_dialogs_export.php)\n"); exit(1); }
$dialogs = json_decode((string) file_get_contents($src), true);
if (!is_array($dialogs)) { fwrite(STDERR, "выгрузка нечитаема\n"); exit(1); }

/** Темы разговора. Порядок важен: первое совпадение и есть тема. */
function sl_topic(string $q, string $a): string {
    $t = mb_strtolower($q . ' ' . $a);
    $has = static fn(array $w): bool => (bool) array_filter($w, static fn($x) => mb_strpos($t, $x) !== false);
    if ($has(['возврат', 'вернуть деньги', 'верните'])) return 'возврат';
    if ($has(['трек', 'посылк', 'почт россии', 'наложен', 'доставк', 'отправлен'])) return 'доставка';
    if ($has(['благодарност', 'куратор', 'педагог', 'преподавател'])) return 'педагогу';
    if ($has(['партнёр', 'партнер', 'сотрудничеств'])) return 'партнёрство';
    if ($has(['кубок', 'медал', 'статуэтк', 'оригинал', 'изготовлен', 'заказ наград'])) return 'заказ наград';
    if ($has(['диплом', 'наградн', 'результат', 'итог', 'звание', 'лауреат'])) return 'результаты';
    if ($has(['оплат', 'взнос', 'счёт', 'счет', 'квитанц', 'чек'])) return 'оплата';
    if ($has(['заявк', 'подать', 'участв', 'участие', 'форма', 'номинац'])) return 'заявка';
    if ($has(['положени', 'правил', 'требован', 'видео', 'ссылк на видео'])) return 'положение';
    if ($has(['здравств', 'добрый день', 'спасибо', 'благодар'])) return 'вежливость';
    return 'прочее';
}

/**
 * ОТПИСКА, А НЕ ОТВЕТ.
 *
 * Разбор показал главное: больше половины ответов колл-центра это три штампа —
 * «более подробную информацию узнайте на сайте по ссылке», «уточните контактный
 * номер, с Вами свяжется специалист» и «ожидайте пожалуйста». Учить на них бота
 * нельзя: именно от такого владелец и просил уйти. Оставляем только те ответы,
 * где человеку действительно что-то объяснили или спросили по делу.
 */
function sl_is_filler(string $a): bool {
    $t = mb_strtolower((string) preg_replace('~\s+~u', ' ', $a));

    // Старый сайт: такие ответы устарели целиком, адреса переехали.
    foreach (['/instrukciya', '/voprosi', '/page/', '/oplata-sayt', '/documents', '/comment', '/konkursi'] as $u) {
        if (mb_strpos($t, $u) !== false) return true;
    }
    // УСТАРЕВШИЕ РЕКВИЗИТЫ И КОНТАКТЫ. Раньше оплату принимали переводом на карту и
    // кошельки, а телефон колл-центра был другой. Повтори бот такое сегодня — и
    // человек уйдёт платить мимо кассы, на номер, которого больше нет.
    foreach (['qiwi', 'yoomoney', 'юмани', 'номер карты', 'sberbank - мир', '89509459900',
              'vk.com/wall', 'сбербанк онлайн'] as $u) {
        if (mb_strpos($t, $u) !== false) return true;
    }
    // «Идите на сайт» без единой мысли по существу.
    if (mb_strpos($t, 'более подробную информацию') !== false) return true;
    if (mb_strpos($t, 'ознакомившись внимательно с положением') !== false && mb_strlen($t) < 500) return true;
    // «Дайте телефон, вам перезвонят» с цитатой закона о связи.
    if (mb_strpos($t, 'закона «о связи»') !== false || mb_strpos($t, 'закона "о связи"') !== false) return true;
    if (mb_strpos($t, 'контактный номер телефона') !== false && mb_strpos($t, 'свяжется') !== false) return true;
    // Ожидание без ответа.
    foreach (['ожидайте', 'находится в обработке', 'зарегистрировано и находится'] as $f) {
        if (mb_strpos($t, $f) !== false) {
            $clean = (string) preg_replace('~[^а-яёa-z ]~u', ' ', $t);
            if (mb_strlen(trim($clean)) < 320) return true;
        }
    }
    // Одна подпись и ничего больше.
    $body = trim((string) preg_replace('~с уважением.*$~ui', '', $t));
    if (mb_strlen($body) < 80) return true;

    // ЧТО СЧИТАЕМ СОДЕРЖАТЕЛЬНЫМ. Ответ должен либо объяснять (сроки, причина,
    // условие), либо спрашивать по делу (ФИО, конкурс, название работы).
    $useful = ['в течение', 'после того', 'если ', 'потому что', 'так как', 'нужно', 'необходимо',
               'уточните', 'подскажите', 'фио', 'название конкурс', 'номер заявк', 'срок',
               'рабочих дн', 'жюри', 'результат', 'оплат', 'вернём', 'вернем', 'возврат',
               'отправлен', 'трек', 'изготовлен'];
    foreach ($useful as $w) if (mb_strpos($t, $w) !== false) return false;
    return true;
}

/**
 * СУТЬ ОТВЕТА БЕЗ ХВОСТОВ.
 *
 * В каждом ответе колл-центра подпись, график работы и телефон занимают половину
 * длины. Для образца это шум: бот должен учиться тому, ЧТО и КАК объясняют, а
 * дежурный хвост он и так добавит, когда нужно, и по нынешним контактам.
 */
function sl_strip_tail(string $a): string {
    $t = (string) preg_replace('~\s*[‼❗]*\s*РАБОЧЕЕ ВРЕМЯ.*$~us', '', $a);
    $t = (string) preg_replace('~\s*🕑?\s*График работы.*$~us', '', $t);
    $t = (string) preg_replace('~\s*[🌍🌏✅️]*\s*С уважением.*$~us', '', $t);
    $t = (string) preg_replace('~\n{3,}~u', "\n\n", $t);
    return trim($t);
}

$pairs = [];
foreach ($dialogs as $d) {
    $msgs = $d['messages'] ?? [];
    for ($i = 0; $i < count($msgs) - 1; $i++) {
        if (($msgs[$i]['who'] ?? '') !== 'участник') continue;
        // Ответ центра — ближайшее следующее сообщение центра.
        $q = trim((string) $msgs[$i]['text']);
        $a = '';
        for ($j = $i + 1; $j < min(count($msgs), $i + 4); $j++) {
            if (($msgs[$j]['who'] ?? '') === 'центр') { $a = trim((string) $msgs[$j]['text']); break; }
        }
        if ($q === '' || $a === '') continue;
        $ql = mb_strlen($q); $al = mb_strlen($a);
        if ($ql < 10 || $ql > 600 || $al < 60 || $al > 1200) continue;
        if (sl_is_filler($a)) continue;
        $pairs[] = ['q' => $q, 'a' => $a, 'topic' => sl_topic($q, $a), 'len' => $al];
    }
}

echo "РАЗБОР ПЕРЕПИСКИ СООБЩЕСТВА\n$line\n";
printf("  диалогов в выгрузке: %s\n", number_format(count($dialogs), 0, '.', ' '));
printf("  пар «вопрос — ответ»: %s\n\n", number_format(count($pairs), 0, '.', ' '));

$byTopic = [];
foreach ($pairs as $p) $byTopic[$p['topic']][] = $p;
foreach ($byTopic as $t => $rows) printf("  %-14s %5d\n", $t, count($rows));

/* Отбор образцов: по каждой теме берём ответы средней длины — они содержательные,
   но не полотна, и лучше всего показывают манеру. Дубли по первым словам убираем:
   колл-центр часто вставлял один и тот же кусок, и десять его копий стилю не учат. */
$samples = [];
foreach ($byTopic as $topic => $rows) {
    usort($rows, static fn($x, $y) => abs($x['len'] - 420) <=> abs($y['len'] - 420));
    $seen = [];
    foreach ($rows as $r) {
        $key = mb_substr((string) preg_replace('~\s+~u', ' ', mb_strtolower($r['a'])), 0, 60);
        if (isset($seen[$key])) continue;
        $seen[$key] = 1;
        $samples[] = ['topic' => $topic, 'q' => $r['q'], 'a' => sl_strip_tail($r['a'])];
        if (count($seen) >= 6) break;
    }
}
printf("\n  отобрано образцов: %d\n", count($samples));

echo "\nПРИМЕРЫ (по одному на тему)\n$line\n";
$shown = [];
foreach ($samples as $s) {
    if (isset($shown[$s['topic']])) continue;
    $shown[$s['topic']] = 1;
    printf("\n[%s]\n  участник: %s\n  центр:    %s\n", $s['topic'],
        mb_substr(preg_replace('~\s+~u', ' ', $s['q']), 0, 160),
        mb_substr(preg_replace('~\s+~u', ' ', $s['a']), 0, 400));
}

if (!$apply) { echo "\n  сухой прогон: в базу ничего не записано (запустить с --apply)\n"; exit(0); }

try {
    db()->exec("CREATE TABLE IF NOT EXISTS chat_style_samples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        topic TEXT NOT NULL,
        question TEXT NOT NULL,
        answer TEXT NOT NULL,
        source TEXT DEFAULT 'vk',
        created_at TEXT DEFAULT (datetime('now','localtime')))");
    db()->exec("CREATE INDEX IF NOT EXISTS idx_css_topic ON chat_style_samples(topic)");
} catch (\Throwable $e) {}

q("DELETE FROM chat_style_samples WHERE source='vk'");
$n = 0;
foreach ($samples as $s) {
    try {
        insert('chat_style_samples', ['topic' => $s['topic'], 'question' => mb_substr($s['q'], 0, 800),
                                      'answer' => mb_substr($s['a'], 0, 1600), 'source' => 'vk']);
        $n++;
    } catch (\Throwable $e) {}
}
printf("\n  записано образцов: %d\n", $n);
