<?php
/**
 * ЧТЕНИЕ ПОЧТОВОГО ЯЩИКА ПО IMAP — БЕЗ РАСШИРЕНИЯ imap.
 *
 * На сервере нет php-imap, и ставить его ради одной задачи не хочется: у
 * расширения долгая история дыр в разборе сообщений. Всё, что нужно, умеет
 * cURL — он поддерживает imaps:// и произвольные команды IMAP. Ответ разбираем
 * сами; разбор намеренно ограничен тем, что нам нужно: отправитель, тема, дата,
 * текст и вложения.
 *
 * Используется для приёма ответов ведомств на официальные обращения
 * (cron/ministry_replies.php).
 */
declare(strict_types=1);

/** Одна команда IMAP. Возвращает [успех, тело/ошибка]. */
function im_cmd(array $acc, string $mailbox, string $req = '', int $timeout = 60): array {
    $ch = curl_init();
    curl_setopt_array($ch, [
        // Кодируем ТОЛЬКО имя папки. Хвост «;MAILINDEX=23» — служебная часть
        // адреса, и трогать её нельзя: закодированный знак равенства
        // («MAILINDEX%3D23») сервер не понимает и молча отдаёт пустоту.
        CURLOPT_URL            => 'imaps://' . $acc['host'] . ':' . $acc['port'] . '/'
                                  . (static function (string $mb): string {
                                        $p = explode(';', $mb, 2);
                                        return rawurlencode($p[0]) . (isset($p[1]) ? ';' . $p[1] : '');
                                    })($mailbox),
        CURLOPT_USERNAME       => $acc['user'],
        CURLOPT_PASSWORD       => $acc['pass'],
        CURLOPT_USE_SSL        => CURLUSESSL_ALL,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_TIMEOUT        => $timeout,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ] + ($req !== '' ? [CURLOPT_CUSTOMREQUEST => $req] : []));
    $out = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);
    return $out === false ? [false, $err] : [true, (string) $out];
}

/** Номера писем по условию поиска IMAP («SINCE 01-Aug-2026», «FROM ...»). */
function im_search(array $acc, string $criteria, string $mailbox = 'INBOX'): array {
    [$ok, $body] = im_cmd($acc, $mailbox, 'SEARCH ' . $criteria);
    if (!$ok) return [];
    $ids = [];
    foreach (preg_split('~\R~', $body) ?: [] as $line) {
        if (stripos($line, 'SEARCH') === false) continue;
        preg_match_all('~\d+~', substr($line, stripos($line, 'SEARCH') + 6), $m);
        foreach ($m[0] as $n) $ids[] = (int) $n;
    }
    return array_values(array_unique($ids));
}

/** Полный исходник письма по его номеру. */
function im_fetch(array $acc, int $id, string $mailbox = 'INBOX'): string {
    /* ПИСЬМО БЕРЁМ АДРЕСОМ, А НЕ СЫРОЙ КОМАНДОЙ.
     *
     * Здесь стояло CUSTOMREQUEST «FETCH <n> BODY.PEEK[]». Сервер на такую
     * команду отвечает строкой вида «* 23 FETCH (BODY[] {13508}» и следом самим
     * письмом, но curl отдаёт только первую строку: письма не было вовсе,
     * возвращалось 28 байт служебного заголовка. Разбор при этом не падал — он
     * честно доставал из пустоты пустые «от кого» и «тема», и каждое письмо
     * выглядело чужим. То есть ответы ведомств не были бы прочитаны никогда, а
     * в логах стояло бы бодрое «просмотрено писем 23, от ведомств 0».
     *
     * Правильный для curl способ — попросить письмо по номеру прямо в адресе:
     * imaps://host/INBOX;MAILINDEX=23. Тогда возвращается исходник целиком.
     * Флаг «прочитано» при этом не ставится: curl запрашивает BODY.PEEK.
     */
    [$ok, $body] = im_cmd($acc, $mailbox . ';MAILINDEX=' . $id, '', 120);
    if ($ok && trim($body) !== '') return $body;

    // Запасной путь на случай почтовой службы, которая не понимает MAILINDEX.
    [$ok2, $body2] = im_cmd($acc, $mailbox, 'FETCH ' . $id . ' BODY.PEEK[]', 120);
    return $ok2 ? $body2 : '';
}

/** Декодирует заголовок вида =?UTF-8?B?...?= в обычную строку. */
function im_decode_header(string $s): string {
    if (function_exists('iconv_mime_decode')) {
        $d = @iconv_mime_decode($s, ICONV_MIME_DECODE_CONTINUE_ON_ERROR, 'UTF-8');
        if (is_string($d) && $d !== '') return trim($d);
    }
    return trim($s);
}

/** Тело части по объявленной кодировке. */
function im_decode_body(string $body, string $enc, string $charset = ''): string {
    $enc = strtolower(trim($enc));
    if ($enc === 'base64')            $body = (string) base64_decode(preg_replace('~\s+~', '', $body) ?? '', true);
    elseif ($enc === 'quoted-printable') $body = quoted_printable_decode($body);

    $charset = strtoupper(trim($charset));
    if ($charset !== '' && $charset !== 'UTF-8' && function_exists('iconv')) {
        $c = @iconv($charset, 'UTF-8//IGNORE', $body);
        if (is_string($c)) $body = $c;
    }
    return $body;
}

/**
 * Разбирает исходник письма.
 *
 * @return array{from:string,from_name:string,subject:string,date:string,text:string,attachments:array}
 *         attachments — [['name'=>..., 'mime'=>..., 'data'=>двоичные данные], ...]
 */
function im_parse(string $raw): array {
    $out = ['from' => '', 'from_name' => '', 'subject' => '', 'date' => '', 'text' => '', 'attachments' => []];
    if (trim($raw) === '') return $out;

    // Заголовки до первой пустой строки; продолжения строк (начинаются с пробела)
    // подклеиваем — длинные темы почтовики переносят.
    $split = preg_split('~\R\R~', $raw, 2);
    $head  = $split[0] ?? '';
    $body  = $split[1] ?? '';
    $head  = preg_replace('~\R[ \t]+~', ' ', $head) ?? $head;

    $h = [];
    foreach (preg_split('~\R~', $head) ?: [] as $line) {
        if (!preg_match('~^([A-Za-z\-]+):\s*(.*)$~', $line, $m)) continue;
        $h[strtolower($m[1])] = $m[2];
    }

    $from = im_decode_header((string) ($h['from'] ?? ''));
    if (preg_match('~<([^>]+)>~', $from, $m)) {
        $out['from'] = mb_strtolower(trim($m[1]));
        $out['from_name'] = trim(str_replace('"', '', substr($from, 0, strpos($from, '<') ?: 0)));
    } else {
        $out['from'] = mb_strtolower(trim($from));
    }
    $out['subject'] = im_decode_header((string) ($h['subject'] ?? ''));
    $d = trim((string) ($h['date'] ?? ''));
    $out['date'] = $d !== '' ? (date('Y-m-d H:i:s', strtotime($d) ?: time())) : date('Y-m-d H:i:s');

    $ctype = (string) ($h['content-type'] ?? 'text/plain');

    // Одночастное письмо: тело как есть.
    if (!preg_match('~boundary="?([^";\s]+)"?~i', $ctype, $bm)) {
        $cs = preg_match('~charset="?([^";\s]+)"?~i', $ctype, $cm) ? $cm[1] : '';
        $out['text'] = im_decode_body($body, (string) ($h['content-transfer-encoding'] ?? ''), $cs);
        return $out;
    }

    // Многочастное: разбираем рекурсивно — вложенные multipart встречаются
    // постоянно (текст+html внутри, вложения снаружи).
    im_walk_parts($body, $bm[1], $out);
    return $out;
}

/** Обходит части multipart-сообщения, собирая текст и вложения. */
function im_walk_parts(string $body, string $boundary, array &$out, int $depth = 0): void {
    if ($depth > 6) return;
    $parts = preg_split('~\R?--' . preg_quote($boundary, '~') . '(--)?\R?~', $body) ?: [];

    foreach ($parts as $part) {
        if (trim($part) === '') continue;
        $sp = preg_split('~\R\R~', $part, 2);
        $ph = preg_replace('~\R[ \t]+~', ' ', $sp[0] ?? '') ?? '';
        $pb = $sp[1] ?? '';

        $ct   = preg_match('~content-type:\s*([^;\R]+)~i', $ph, $m) ? mb_strtolower(trim($m[1])) : 'text/plain';
        $enc  = preg_match('~content-transfer-encoding:\s*([^\s;\R]+)~i', $ph, $m) ? $m[1] : '';
        $disp = preg_match('~content-disposition:\s*([^;\R]+)~i', $ph, $m) ? mb_strtolower(trim($m[1])) : '';
        $cs   = preg_match('~charset="?([^";\s]+)"?~i', $ph, $m) ? $m[1] : '';

        if (preg_match('~boundary="?([^";\s]+)"?~i', $ph, $bm)) {
            im_walk_parts($pb, $bm[1], $out, $depth + 1);
            continue;
        }

        $name = '';
        if (preg_match('~filename\*?="?([^";\R]+)"?~i', $ph, $m)) $name = im_decode_header($m[1]);
        elseif (preg_match('~name\*?="?([^";\R]+)"?~i', $ph, $m)) $name = im_decode_header($m[1]);

        $isAtt = $disp === 'attachment' || ($name !== '' && $ct !== 'text/plain' && $ct !== 'text/html');

        if ($isAtt) {
            $data = im_decode_body($pb, $enc);
            if ($data !== '') {
                $out['attachments'][] = ['name' => $name ?: 'file', 'mime' => $ct, 'data' => $data];
            }
            continue;
        }

        if ($ct === 'text/plain' && trim($out['text']) === '') {
            $out['text'] = im_decode_body($pb, $enc, $cs);
        } elseif ($ct === 'text/html' && trim($out['text']) === '') {
            $out['text'] = trim(html_entity_decode(strip_tags(im_decode_body($pb, $enc, $cs)), ENT_QUOTES, 'UTF-8'));
        }
    }
}
