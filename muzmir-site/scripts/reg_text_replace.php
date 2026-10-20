<?php
/**
 * scripts/reg_text_replace.php — ЗАМЕНИТЬ ТЕКСТ В ПОЛОЖЕНИЯХ КОНКУРСОВ.
 *
 *   php scripts/reg_text_replace.php --re='<шаблон>' --to='<замена>' [--only-open] [--dry]
 *
 * Брат `reg_point_add.php`: тот дописывает пункт, этот правит уже написанное.
 * Понадобился, когда у центра остался один телефон (+7 (999) 504-88-99), а в
 * одиннадцати положениях печатался прежний — в шапке и в блоке «График работы».
 * Участник звонил по номеру из документа и не дозванивался.
 *
 * ПОЧЕМУ НЕ ПРОСТО str_replace ПО ФАЙЛУ. Положение это .docx, то есть zip с
 * XML внутри, и текст в нём разложен по «прогонам» (`<w:t>`): Word рвёт строку
 * там, где у неё менялось начертание, и одна фраза легко оказывается в трёх
 * кусках. Замена идёт ПО КАЖДОМУ прогону, а после правки документ сверяется
 * целиком: если искомое всё ещё находится в сшитом тексте абзаца, значит оно
 * было разорвано, и файл честно называется НЕ ИСПРАВЛЕННЫМ, а не молча
 * пропускается.
 *
 * Перед каждой правкой рядом с файлом кладётся копия .bak-<дата>.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/regulation_gen.php';   // reg_file_vladelec()
require_once BASE_PATH . '/core/chat_regulation.php';

$opt = getopt('', ['re::', 'to::', 'only-open', 'dry', 'file::']);
$re  = (string) ($opt['re'] ?? '');
$to  = (string) ($opt['to'] ?? '');
$dry = isset($opt['dry']);
$onlyOpen = isset($opt['only-open']);
/* --file=<путь[,путь]> - ПРАВКА ЭТАЛОНА, А НЕ ЖИВОГО ПОЛОЖЕНИЯ.
   Урок правила 51, оплаченный стёртым пунктом владельца: положение собирается
   ЗАНОВО из эталона при каждом сохранении конкурса. Поправишь только живые
   файлы - первая же перегенерация вернёт старый текст, и молча. Ключ тот же,
   что у брата `reg_point_add.php`: тот же разбор, та же сверка, тот же откат. */
$files = array_values(array_filter(array_map('trim', explode(',', (string) ($opt['file'] ?? '')))));

if ($re === '' || $to === '') { fwrite(STDERR, "нужны --re=<шаблон> и --to=<замена>\n"); exit(1); }
$pattern = '~' . str_replace('~', '\~', $re) . '~u';
if (@preg_match($pattern, '') === false) { fwrite(STDERR, "шаблон не разбирается: $re\n"); exit(1); }

if ($files) {
    /* Эталоны конкурсами не числятся, поэтому собираем список сами и в том же
       виде, какой ждёт цикл ниже: путь, имя для вывода, «статус». */
    $comps = [];
    foreach ($files as $f) {
        $p = $f[0] === '/' ? $f : BASE_PATH . '/' . ltrim($f, './');
        $comps[] = ['id' => 0, 'name' => basename($p), 'status' => 'эталон', 'regulation_pdf' => $p];
    }
} else {
    $where = $onlyOpen ? "AND status = 'open' AND COALESCE(launched,0) = 1" : '';
    $comps = all("SELECT id, name, status, regulation_pdf FROM competitions
                   WHERE COALESCE(regulation_pdf,'') <> '' $where ORDER BY sort");
}
if (!$comps) { echo "Положений не найдено.\n"; exit(0); }

/* Один файл положения может быть привязан к нескольким конкурсам — правим его
   один раз, иначе вторая правка не найдёт уже заменённого и соврёт «не найдено». */
$seen  = [];
$stamp = date('Ymd-His');
$done = $skip = $none = 0;

foreach ($comps as $c) {
    $path = (string) $c['regulation_pdf'];
    $name = (string) $c['name'];
    if (isset($seen[$path])) continue;
    $seen[$path] = true;

    if (!is_file($path)) { echo "  [нет файла] $name\n"; $skip++; continue; }

    $z = new ZipArchive();
    if ($z->open($path) !== true) { echo "  [не открылся] $name\n"; $skip++; continue; }
    $xml = (string) $z->getFromName('word/document.xml');
    $z->close();
    if ($xml === '') { echo "  [пустой документ] $name\n"; $skip++; continue; }

    $plainBefore = html_entity_decode(strip_tags($xml), ENT_QUOTES | ENT_XML1, 'UTF-8');
    $hits = preg_match_all($pattern, $plainBefore);
    if (!$hits) { echo "  [нечего менять] $name\n"; $none++; continue; }

    /* Замена по прогонам: внутри <w:t> лежит экранированный XML, поэтому туда и
       обратно гоняем через html_entity_decode/htmlspecialchars. */
    $changed = 0;
    $new = preg_replace_callback('~(<w:t(?:\s[^>]*)?>)(.*?)(</w:t>)~us',
        function (array $m) use ($pattern, $to, &$changed): string {
            $txt = html_entity_decode($m[2], ENT_QUOTES | ENT_XML1, 'UTF-8');
            $out = preg_replace($pattern, $to, $txt, -1, $n);
            if (!$n) return $m[0];
            $changed += $n;
            return $m[1] . htmlspecialchars((string) $out, ENT_QUOTES | ENT_XML1, 'UTF-8') . $m[3];
        }, $xml);

    if (!is_string($new) || $changed === 0) {
        echo "  [РАЗОРВАНО ПО ПРОГОНАМ] $name: найдено $hits, заменить по месту нельзя — править руками\n";
        $skip++; continue;
    }

    if ($dry) {
        echo "  [сухой прогон] $name ({$c['status']}): заменить $changed из $hits\n";
        $done++; continue;
    }

    copy($path, $path . '.bak-' . $stamp);
    $z = new ZipArchive();
    if ($z->open($path) !== true) { echo "  [не открылся на запись] $name\n"; $skip++; continue; }
    $z->addFromString('word/document.xml', $new);
    $z->close();
    // Инструмент идёт под root, а положение пересобирает веб-сервер под
    // www-data: без этого следующая перегенерация из админки падает на copy().
    reg_file_vladelec($path);

    /* Сверка: старого в документе не осталось, новый текст на месте, и файл
       по-прежнему читается тем же разбором, которым его видит чат-бот. */
    $after = reg_docx_text($path);
    $left  = preg_match_all($pattern, $after);
    $pts   = reg_points_from_text($after);
    if ($left > 0 || count($pts) < 10) {
        echo "  [ОТКАТ] $name: осталось $left совпадений, пунктов прочиталось " . count($pts) . "\n";
        copy($path . '.bak-' . $stamp, $path);
        $skip++; continue;
    }
    echo "  [готово] $name ({$c['status']}): заменено $changed\n";
    $done++;
}

echo "Положений изменено: $done, без совпадений: $none, пропущено: $skip" . ($dry ? ' (сухой прогон)' : '') . "\n";
if (!$dry && $done > 0) {
    set_setting('chat_reg_stamp', '');
    echo "Кэш пунктов у чат-бота сброшен.\n";
}
