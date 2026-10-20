<?php
/**
 * core/chat_regulation.php — ПОЛОЖЕНИЕ КОНКУРСА В ПРАВИЛАХ ПОМОЩНИКА.
 *
 * ЗАЧЕМ. Участник спорит не вообще, а по пункту: «почему снизили за фонограмму»,
 * «почему не приняли ссылку на инстаграм», «верните взнос». У центра на всё это
 * есть письменный ответ в положении, и названный номер пункта заканчивает спор
 * быстрее любого пересказа. Помощник же положения НЕ ВИДЕЛ: в его правилах жил
 * один пункт про возврат, вписанный руками, и номер в нём был ЧУЖОЙ.
 *
 * ЦЕНА ЭТОГО ИЗВЕСТНА. Бот ссылался на «п. 7.2 Положения: оргвзнос возврату не
 * подлежит» и на «п. 7.3: при отклонении заявки взнос возвращается». В настоящем
 * положении 7.2 это право жюри присуждать звания, 7.3 это дополнительные
 * наградные дипломы, а про невозврат взноса говорит 7.6. Участник, открывший
 * документ по ссылке, читал там совсем другое и справедливо считал, что его
 * обманывают.
 *
 * КАК УСТРОЕНО. Положения лежат .docx-файлами (`competitions.regulation_pdf`),
 * текст достаётся из них без сторонних библиотек: .docx это zip, внутри
 * word/document.xml. Пункты вида «8.5. …» собираются в список и идут в правила
 * ДОСЛОВНО: все 39 штук укладываются в семь тысяч знаков, выбирать подходящие
 * заранее не нужно, а значит модель не может сослаться на пункт, которого не
 * видела.
 *
 * Разбор docx дорогой, поэтому результат лежит в настройках и пересобирается
 * сам, когда владелец заливает новое положение: отпечаток считается по именам и
 * времени правки файлов.
 *
 * У всех конкурсов центра положение по одному шаблону, и нумерация совпадает
 * (проверено 13.10.2026: 39 пунктов, различий между конкурсами ноль). Если
 * какой-то конкурс когда-нибудь уйдёт от шаблона, его пункты попадут в правила
 * отдельным блоком со своим названием: молча подменять ими общие нельзя.
 */
declare(strict_types=1);

require_once __DIR__ . '/db.php';

/** Текст .docx без сторонних библиотек: zip → word/document.xml → строки. */
function reg_docx_text(string $path): string {
    if ($path === '' || !is_file($path) || !class_exists('ZipArchive')) return '';
    $z = new ZipArchive();
    if ($z->open($path) !== true) return '';
    $xml = (string) $z->getFromName('word/document.xml');
    $z->close();
    if ($xml === '') return '';
    /* Абзац это </w:p>, перенос внутри абзаца это <w:br/>. Без этих двух замен
       документ слипается в одну строку, и пункты из него не отделить. */
    $xml = preg_replace('~<w:br\s*/?>~u', "\n", $xml) ?? $xml;
    $xml = preg_replace('~</w:p>~u', "\n", $xml) ?? $xml;
    $txt = html_entity_decode(strip_tags($xml), ENT_QUOTES | ENT_XML1, 'UTF-8');
    $txt = preg_replace('~[ \t\x{00A0}]+~u', ' ', $txt) ?? $txt;
    return trim(preg_replace('~\n{2,}~u', "\n", $txt) ?? $txt);
}

/** Пронумерованные пункты из текста положения: ['8.5' => 'текст пункта', …]. */
function reg_points_from_text(string $txt): array {
    $out = [];
    foreach (preg_split('~\n~u', $txt) ?: [] as $line) {
        $line = trim($line);
        if ($line === '') continue;
        if (!preg_match('~^(\d{1,2}\.\d{1,2})\.?\s+(\S.*)$~u', $line, $m)) continue;
        $body = trim($m[2]);
        if (mb_strlen($body) < 10) continue;   // заголовки таблиц и обрывки строк
        $out[$m[1]] = $body;
    }
    return $out;
}

/** Открытые конкурсы с их файлами положений. */
function reg_open_competitions(): array {
    try {
        return all("SELECT id, name, slug, regulation_pdf
                      FROM competitions
                     WHERE status = 'open' AND COALESCE(regulation_pdf,'') <> ''
                     ORDER BY id DESC LIMIT 12");
    } catch (\Throwable $e) { return []; }
}

/**
 * Пункты положений: ['общие' => [...], 'особые' => ['Название конкурса' => [...]]].
 * Разбор кэшируется в настройках, отпечаток — имена и время правки файлов.
 */
function reg_points(bool $force = false): array {
    $comps = reg_open_competitions();
    if (!$comps) return ['общие' => [], 'особые' => []];

    $stampSrc = '';
    foreach ($comps as $c) {
        $p = (string) $c['regulation_pdf'];
        $stampSrc .= $p . '|' . (is_file($p) ? (string) filemtime($p) : '0') . ';';
    }
    $stamp = md5($stampSrc);

    if (!$force && (string) setting('chat_reg_stamp', '') === $stamp) {
        $cached = json_decode((string) setting('chat_reg_points', ''), true);
        if (is_array($cached) && !empty($cached['общие'])) return $cached;
    }

    $sets = [];
    foreach ($comps as $c) {
        $pts = reg_points_from_text(reg_docx_text((string) $c['regulation_pdf']));
        if ($pts) $sets[(string) $c['name']] = $pts;
    }
    if (!$sets) return ['общие' => [], 'особые' => []];

    /* Самый частый набор пунктов считаем общим, остальные особыми. */
    $byHash = [];
    foreach ($sets as $name => $pts) $byHash[md5(json_encode($pts, JSON_UNESCAPED_UNICODE))][] = $name;
    uasort($byHash, static fn(array $a, array $b): int => count($b) <=> count($a));
    $mainNames = reset($byHash);
    $common    = $sets[$mainNames[0]];

    $special = [];
    foreach ($sets as $name => $pts) {
        if (!in_array($name, $mainNames, true)) $special[$name] = $pts;
    }

    $res = ['общие' => $common, 'особые' => $special, 'конкурсы' => $mainNames];
    set_setting('chat_reg_points', json_encode($res, JSON_UNESCAPED_UNICODE));
    set_setting('chat_reg_stamp', $stamp);
    return $res;
}

/**
 * Блок правил для «мозга»: пункты положения дословно и правило, как на них
 * ссылаться.
 *
 * ПОЧЕМУ ДОСЛОВНО, А НЕ ПЕРЕСКАЗОМ. Пересказанный пункт перестаёт быть
 * документом: участник открывает положение по ссылке и видит там другие слова.
 * Ссылаться имеет смысл только на то, что там правда написано.
 */
function chat_regulation_prompt(): string {
    $p      = reg_points();
    $common = (array) ($p['общие'] ?? []);
    if (!$common) return '';

    $lines = [];
    foreach ($common as $no => $body) {
        $body    = preg_replace('~\s+~u', ' ', (string) $body) ?? (string) $body;
        $lines[] = 'п. ' . $no . '. ' . $body;
    }

    $out = "ПОЛОЖЕНИЕ КОНКУРСА, ПУНКТЫ ДОСЛОВНО. Нумерация одинакова у всех конкурсов центра.\n"
         . implode("\n", $lines);

    foreach ((array) ($p['особые'] ?? []) as $name => $pts) {
        $l2 = [];
        foreach ((array) $pts as $no => $body) {
            $body = preg_replace('~\s+~u', ' ', (string) $body) ?? (string) $body;
            $l2[] = 'п. ' . $no . '. ' . $body;
        }
        if ($l2) $out .= "\nОТДЕЛЬНОЕ ПОЛОЖЕНИЕ КОНКУРСА «" . $name . "»:\n" . implode("\n", $l2);
    }

    $out .= "\nКАК ССЫЛАТЬСЯ НА ПОЛОЖЕНИЕ. Когда ответ опирается на правило конкурса, назови номер "
          . "пункта и приведи его словами из списка выше: «Это п. 8.5 положения: на конкурс принимается "
          . "видео без монтажа, склеек и стоп-кадров». Номер и текст бери ТОЛЬКО отсюда, наизусть не "
          . "цитируй и НЕ ВЫДУМЫВАЙ номеров: участник откроет документ и сверит. Нужного правила в "
          . "списке нет — ответь по сути без ссылки на пункт. Пункт идёт подтверждением уже данного "
          . "ответа, а не вместо него, и не больше одного-двух пунктов на реплику: ответ из сплошных "
          . "цитат читается как отписка.";
    return $out;
}
