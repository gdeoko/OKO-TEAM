<?php
/**
 * ЗАБРАТЬ НАШИ ЖЕ ЗАПИСИ СО СТЕНЫ В РОТАЦИЮ.
 *
 * По чужим сообществам должны расходиться не пересказы, а ровно те записи,
 * которые мы публикуем у себя: тот же текст, та же афиша. Здесь запись со
 * стены сообщества переносится в таблицу vk_posts как есть — вместе со
 * строкой вложения, поэтому афиша остаётся той же самой картинкой, а не
 * перезалитой копией.
 *
 * Слот — место записи в очереди ротации. Их шесть, и адресат получает по
 * одному в день: за шесть дней до него доходит весь набор, и ни одна запись
 * не повторяется дважды подряд.
 *
 *   php scripts/vk_posts_import.php 11358:1 11359:2 11360:3 11361:4
 *   php scripts/vk_posts_import.php --list        — показать, что уже в ротации
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/vk_promo.php';

$line = str_repeat('=', 78);
$gid  = (int) cfgv('vk_group_id', 211325055);

vkp_posts_ensure();

$args = array_slice($argv, 1);
if (!$args || in_array('--list', $args, true)) {
    echo "ЗАПИСИ В РОТАЦИИ\n$line\n";
    foreach (all("SELECT * FROM vk_posts ORDER BY slot") as $p) {
        printf("  слот %d  %-30s  вложение %-28s  %s\n  %s\n\n",
            (int) $p['slot'], (string) $p['title'], (string) $p['attachment'],
            (int) $p['active'] === 1 ? 'в работе' : 'выключен',
            mb_substr(str_replace("\n", ' ', (string) $p['text']), 0, 150) . '…');
    }
    exit(0);
}

foreach ($args as $a) {
    [$postId, $slot] = array_pad(explode(':', $a, 2), 2, '');
    $postId = (int) $postId;
    $slot   = (int) $slot;
    if ($postId <= 0 || $slot <= 0) { echo "  пропуск «$a»: нужен вид 11358:1\n"; continue; }

    $r = vk_api('wall.getById', ['posts' => (-$gid) . '_' . $postId]);
    $it = ($r['response']['items'] ?? $r['response'] ?? [])[0] ?? null;
    if (!$it) { echo "  запись #$postId не найдена\n"; continue; }

    $text = (string) ($it['text'] ?? '');
    $att  = [];
    foreach (($it['attachments'] ?? []) as $x) {
        if ((string) ($x['type'] ?? '') !== 'photo') continue;
        $ph = $x['photo'] ?? [];
        $att[] = 'photo' . (int) ($ph['owner_id'] ?? 0) . '_' . (int) ($ph['id'] ?? 0);
    }

    /* Заголовок для человека. У записей о конкурсах название стоит в кавычках
     * («ВЕЛИЧИЕ РОССИИ»), и это самое понятное имя слота; если кавычек нет,
     * берём первую осмысленную строку, пропуская ссылки. */
    $title = '';
    // Название конкурса набрано прописными («ВЕЛИЧИЕ РОССИИ»), а в кавычках
    // стоит ещё и имя центра — берём то, что кричит заглавными.
    if (preg_match_all('~«([^»]{4,60})»~u', $text, $mm)) {
        foreach ($mm[1] as $cand) {
            $cand = trim($cand);
            if ($cand !== '' && mb_strtoupper($cand) === $cand) { $title = $cand; break; }
        }
    }
    if ($title === '') {
        foreach (preg_split('~\n~', $text) ?: [] as $ln) {
            $ln = trim($ln);
            if ($ln !== '' && !str_contains($ln, '://') && mb_strlen($ln) > 12) {
                $title = mb_substr(preg_replace('~^[^\p{L}]+~u', '', $ln) ?? $ln, 0, 60);
                break;
            }
        }
    }
    if ($title === '') $title = 'Запись #' . $postId;

    q("INSERT INTO vk_posts (slot, kind, title, text, attachment, source_post_id, active)
       VALUES (:s,'competition',:t,:x,:a,:p,1)
       ON CONFLICT(slot) DO UPDATE SET
         kind=excluded.kind, title=excluded.title, text=excluded.text,
         attachment=excluded.attachment, source_post_id=excluded.source_post_id, active=1",
      ['s' => $slot, 't' => $title, 'x' => $text, 'a' => implode(',', $att), 'p' => $postId]);

    printf("  слот %d ← запись #%d, %d символов, вложений %d — %s\n",
        $slot, $postId, mb_strlen($text), count($att), $title);
}

echo "\n  всего в ротации: " . (int) (scalar("SELECT COUNT(*) FROM vk_posts WHERE active=1") ?? 0) . "\n";
