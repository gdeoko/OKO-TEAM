<?php
/**
 * core/pdf_letter.php — ОФИЦИАЛЬНОЕ ОБРАЩЕНИЕ ОДНИМ ФАЙЛОМ (PDF).
 *
 * Зачем отдельный генератор, если бланк уже есть в HTML. Половина ведомств прямо
 * пишет на своих страницах: «адрес электронной почты используется только для
 * направления документов организаций, одно сообщение — одно письмо». Документ в
 * теле письма для делопроизводителя документом не является: его нельзя
 * зарегистрировать во входящих и приложить к решению. Нужен файл.
 *
 * Почему рисуем, а не печатаем HTML. Печать HTML в PDF требует headless-браузера;
 * на сервере с двумя гигабайтами памяти держать Chromium ради одного письма в
 * месяц — плохой размен. Дипломы, положения и афиши в этом проекте уже рисуются
 * через GD (core/pdf_lib.php), и бланк рисуется тем же стеком: те же шрифты, та
 * же печать, та же подпись, тот же QR. Вёрстка повторяет HTML-бланк построчно.
 *
 * pdf_official_letter(array $o): string — путь к готовому файлу.
 *   number, title, addressee[], salutation, body (HTML), attachments[], date.
 */
declare(strict_types=1);

require_once __DIR__ . '/pdf_lib.php';
require_once __DIR__ . '/official_letter.php';

/**
 * HTML тела письма → плоский список блоков для рисования.
 *
 * Тексты обращений пишутся в HTML (их же показывает страница просмотра), а GD
 * рисует строки. Разбор намеренно простой: абзац, пункт списка, врезка. Ничего
 * другого в текстах обращений нет, и заводить полноценный разборщик HTML ради
 * трёх тегов — лишнее.
 *
 * @return array<int, array{type:string, text:string}>
 */
function pl_letter_blocks(string $html): array {
    $out = [];
    // Врезки (.ol-box) рисуем с золотой полосой слева — это выделенный блок с
    // главным условием, и в HTML он выглядит так же.
    $html = preg_replace('~<div class="ol-box"[^>]*>(.*?)</div>~is', '[[BOX]]$1[[/BOX]]', $html) ?? $html;
    $html = preg_replace('~<li[^>]*>(.*?)</li>~is', '[[LI]]$1[[/LI]]', $html) ?? $html;
    $html = preg_replace('~</?(ul|ol)[^>]*>~i', '', $html) ?? $html;
    $html = preg_replace('~<p[^>]*>~i', '[[P]]', $html) ?? $html;
    $html = str_ireplace('</p>', '[[/P]]', $html);
    $html = preg_replace('~<br\s*/?>~i', ' ', $html) ?? $html;

    $clean = static function (string $s): string {
        $s = strip_tags($s);
        $s = html_entity_decode($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $s = str_replace("\xC2\xA0", ' ', $s);            // неразрывный пробел
        return trim(preg_replace('~\s+~u', ' ', $s) ?? '');
    };

    if (preg_match_all('~\[\[(P|LI|BOX)\]\](.*?)\[\[/\1\]\]~s', $html, $m, PREG_SET_ORDER)) {
        foreach ($m as $x) {
            $t = $clean($x[2]);
            if ($t === '') continue;
            $out[] = ['type' => strtolower($x[1]), 'text' => $t];
        }
    }
    if (!$out) {
        $t = $clean($html);
        if ($t !== '') $out[] = ['type' => 'p', 'text' => $t];
    }
    return $out;
}

/** QR-код как GD-картинка: рисуем модули сами, без библиотек рендера. */
function pl_letter_qr($dst, string $data, int $x, int $y, int $size): bool {
    if (!function_exists('qr_matrix') && is_file(BASE_PATH . '/core/qr.php')) require_once BASE_PATH . '/core/qr.php';
    if (!function_exists('qr_matrix')) return false;

    try { $m = qr_matrix($data); } catch (\Throwable $e) { return false; }
    if (!is_array($m) || !$m) return false;

    $n = count($m);
    $cell = max(1, (int) floor($size / ($n + 2)));       // + рамка тишины по модулю
    $off  = (int) (($size - $cell * $n) / 2);

    $white = imagecolorallocate($dst, 255, 255, 255);
    $black = imagecolorallocate($dst, 20, 20, 24);
    imagefilledrectangle($dst, $x, $y, $x + $size, $y + $size, $white);
    for ($r = 0; $r < $n; $r++) {
        for ($c = 0; $c < $n; $c++) {
            if (empty($m[$r][$c])) continue;
            $px = $x + $off + $c * $cell;
            $py = $y + $off + $r * $cell;
            imagefilledrectangle($dst, $px, $py, $px + $cell - 1, $py + $cell - 1, $black);
        }
    }
    return true;
}

/**
 * Рисует официальное обращение и возвращает путь к PDF.
 *
 * Файл кладётся в data/letters/ — не в public. Обращение адресное: в нём имя и
 * должность конкретного человека, и раздавать его по прямой ссылке незачем.
 * Публично доступна только страница проверки подлинности по номеру.
 */
function pdf_official_letter(array $o): string {
    $number = (string) ($o['number'] ?? ol_next_number());
    $date   = (string) ($o['date'] ?? date('Y-m-d'));

    $dir = BASE_PATH . '/data/letters';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    // Имя файла адресат видит во вложении, поэтому номер сохраняем как есть,
    // убирая только то, что нельзя класть в имя файла. Прежняя замена «всё,
    // кроме цифр, на дефис» превращала «МM-2026/0001» в частокол дефисов.
    $slug = preg_replace('~[^A-Za-z0-9]+~', '-', $number);
    $slug = trim((string) $slug, '-');
    // Во вложении к благодарности лежало «obrashchenie-…», хотя это не
    // обращение: получатель не должен гадать, что ему прислали.
    $kind = (string) ($o['kind'] ?? '');
    $head = $kind === 'thanks' ? 'blagodarnost' : 'obrashchenie';
    $path = $dir . '/' . $head . '-' . ($slug !== '' ? $slug : date('Ymd-His')) . '.pdf';

    $W = 1240; $H = 1754;                                 // A4 @150dpi
    $mL = 104; $mR = 104;

    // СТРОГИЙ БЛАНК ДЛЯ ВЕДОМСТВ.
    // Обращение в министерство читает делопроизводитель, и читает он его как
    // документ, а не как рекламный лист. Тонированная бумага с золотой рамкой
    // хороша для благодарности учреждению, но в ведомстве такой лист выглядит
    // приглашением на праздник и снижает доверие к содержанию. Поэтому у
    // официальных обращений бумага белая, рамки нет, выделенных плашек нет.
    $plain = !empty($o['plain']);

    $img = imagecreatetruecolor($W, $H);
    if ($plain) {
        imagefilledrectangle($img, 0, 0, $W, $H, imagecolorallocate($img, 255, 255, 255));
    } else {
        pl_gradient($img, [253, 249, 238], [247, 240, 222]);  // бежевая бумага, как в HTML
        pl_frame($img, 44, [184, 134, 11], 2);
    }

    $navy  = [21, 34, 76];
    $ink   = [38, 38, 44];
    $muted = [92, 92, 104];
    $gold  = [184, 134, 11];

    $reg   = (string) cfgv('org_full', 'Культурный центр «Музыкальный Мир»');
    $orgReg= (string) cfgv('org_reg', '');
    $addr  = (string) cfgv('org_address', '');
    $phone = (string) cfgv('org_phone', '');
    $email = (string) cfgv('org_email', '');
    $vk    = (string) cfgv('org_vk', '');
    $site  = (string) cfgv('domain', 'музыкальный-мир.рф');

    $imgDir = BASE_PATH . '/public/assets/img/';
    $fReg = pl_font('regular'); $fBold = pl_font('bold');
    $fSer = pl_font('serif');   $fSerB = pl_font('serif-bold');

    /* ── Шапка: реквизиты | логотип | УТВЕРЖДАЮ ─────────────────────────── */
    $top = 92;

    // Левая колонка — реквизиты мелким кеглем.
    $ry = $top;
    // Название центра переносим по словам: в одну строку оно не влезает и раньше
    // наезжало на логотип в середине шапки.
    foreach (pl_wrap($reg, 15, $fBold, 320) as $ln) {
        pl_text($img, $mL, $ry + 15, 15, $navy, $fBold, $ln);
        $ry += 21;
    }
    $ry += 5;
    $lines = [];
    if ($orgReg !== '') $lines[] = 'Зарегистрирован: ' . $orgReg . '.';
    if ($addr !== '')   $lines[] = 'Адрес: ' . $addr . '.';
    if ($phone !== '')  $lines[] = 'Телефон: ' . $phone . '.';
    $lines[] = 'Официальный сайт: ' . $site . '.';
    if ($email !== '')  $lines[] = 'Электронная почта: ' . $email . '.';
    if ($vk !== '')     $lines[] = 'Сообщество: ' . $vk;
    foreach ($lines as $ln) {
        foreach (pl_wrap($ln, 12, $fReg, 330) as $w) {
            pl_text($img, $mL, $ry + 12, 12, $muted, $fReg, $w);
            $ry += 17;
        }
    }

    // Центр — логотип и название.
    $logo = $imgDir . (is_file($imgDir . 'letter/logo.png') ? 'letter/logo.png' : 'logo_muzmir_256.png');
    if (is_file($logo)) pl_image($img, $logo, (int) ($W / 2 - 62), $top - 4, 124, 124);
    pl_text($img, 0, $top + 146, 17, $navy, $fSerB, 'Культурный центр', 'center', $W);
    pl_text($img, 0, $top + 170, 17, $navy, $fSerB, '«Музыкальный Мир»', 'center', $W);

    // Правая колонка.
    $ax = $W - $mR - 300;
    $ay = $top;
    $dateHuman = function_exists('ru_date') ? ru_date($date) : date('d.m.Y', strtotime($date));
    // Файл подписи нужен и внизу листа, под текстом, поэтому путь берём здесь —
    // в строгом бланке верхнего блока с подписью нет, а нижний есть всегда.
    $sig = $imgDir . (is_file($imgDir . 'letter/sig.png') ? 'letter/sig.png' : 'diploma/sig2.png');

    if ($plain) {
        // В ДЕЛОВОМ ПИСЬМЕ ГРИФА «УТВЕРЖДАЮ» НЕТ.
        // Гриф утверждения ставится на документе, который вводят в действие:
        // положение, акт, инструкция. Письмо ничего не утверждает, оно просит,
        // и гриф над просьбой в ведомстве читается как ошибка составителя.
        // Подпись здесь тоже лишняя — она стоит под текстом, где ей и место.
        // Наверху остаются только дата и исходящий номер.
        pl_text($img, $ax, $ay + 16, 16, $ink, $fReg, 'от ' . $dateHuman);
        $ay += 26;
        pl_text($img, $ax, $ay + 16, 16, $ink, $fBold, 'Исх. №' . $number);
        $ay += 26;
    } else {
        pl_text($img, $ax, $ay + 22, 22, $navy, $fBold, 'УТВЕРЖДАЮ');
        $ay += 40;
        foreach (['Генеральный директор', 'Культурного центра', '«Музыкальный Мир»'] as $ln) {
            pl_text($img, $ax, $ay + 14, 14, $muted, $fReg, $ln);
            $ay += 21;
        }
        $ay += 6;
        // Высоту НЕ задаём: подпись и печать квадратные, а жёсткая пара «ширина ×
        // высота» их плющит — именно от этого подпись выглядела кривой.
        $sigH = 0;
        if (is_file($sig)) { [, $sigH] = pl_image($img, $sig, $ax, $ay, 126, null); }
        pl_text($img, $ax + 140, $ay + max(30, (int) ($sigH * 0.7)), 16, $navy, $fBold, 'Ильясов А. И.');
        $ay += max(56, $sigH + 10);
        pl_text($img, $ax, $ay + 14, 14, $muted, $fReg, $dateHuman);
        pl_text($img, $ax, $ay + 36, 15, $navy, $fBold, 'Исх. №' . $number);
    }

    $y = max($ry, $top + 190, $ay + 52) + 16;
    // Линия под шапкой: в строгом бланке тонкая и серая, без золота.
    $plain ? pl_rule($img, $mL, $y, $W - $mR, [140, 140, 150], 1)
           : pl_rule($img, $mL, $y, $W - $mR, $gold, 3);
    $y += 22;

    /* ── Правовое основание ────────────────────────────────────────────── */
    $legal = 'Мероприятия Культурного центра «Музыкальный Мир» проводятся на основании '
           . 'Гражданского кодекса Российской Федерации (часть вторая) от 26.01.1996 № 14-ФЗ, '
           . 'глава 57 «Публичный конкурс», а также во исполнение Указа Президента Российской '
           . 'Федерации «Об утверждении Основ государственной культурной политики» № 808 '
           . 'от 24 декабря 2014 года.';
    foreach (pl_wrap($legal, 13, $fReg, $W - $mL - $mR) as $ln) {
        pl_text($img, $mL, $y + 13, 13, $muted, $fReg, $ln);
        $y += 19;
    }
    $y += 10;

    /* ── Эмблемы ведомств ──────────────────────────────────────────────── */
    $emb = [];
    foreach ([['letter/e_prok.png', 'diploma/logo_prokultura.png'],
              ['letter/e_minkult.png', 'diploma/logo_minkult.png'],
              ['letter/e_minprosvet.png', 'diploma/logo_minprosvet.png'],
              ['letter/e_rossia.png', 'diploma/logo_rossia.png'],
              ['letter/e_nats.png', 'diploma/logo_natsproekty.png']] as [$a, $b]) {
        if (is_file($imgDir . $a))      $emb[] = $imgDir . $a;
        elseif (is_file($imgDir . $b))  $emb[] = $imgDir . $b;
    }
    if ($emb) {
        $eh = 66; $gap = 44;
        $ws = [];
        foreach ($emb as $f) {
            $sz = @getimagesize($f);
            $ws[] = $sz ? max(20, (int) round($eh * $sz[0] / max(1, $sz[1]))) : $eh;
        }
        $tw = array_sum($ws) + $gap * (count($emb) - 1);
        $ex = (int) (($W - $tw) / 2);
        foreach ($emb as $i => $f) {
            pl_image($img, $f, $ex, $y, $ws[$i], $eh);
            $ex += $ws[$i] + $gap;
        }
        $y += $eh + 16;
    }
    pl_rule($img, $mL, $y, $W - $mR, $plain ? [200, 200, 208] : [216, 199, 155], 1);
    $y += 30;

    /* ── Заголовок и адресат ───────────────────────────────────────────── */
    $addressee = array_values(array_filter(array_map('trim', (array) ($o['addressee'] ?? []))));

    if ($plain) {
        // РЕКВИЗИТ «АДРЕСАТ» — В ПРАВОЙ ВЕРХНЕЙ ЧАСТИ ЛИСТА (ГОСТ Р 7.0.97-2016).
        // Должность и организация в дательном падеже, ниже фамилия с инициалами.
        // По центру, как на приглашении, адресата в деловом письме не ставят —
        // именно по этому месту документ и опознают как официальный.
        $ax2 = (int) ($W * 0.52);
        $aw  = $W - $mR - $ax2;
        $ay2 = $y;
        foreach ($addressee as $i => $ln) {
            $f = $i === count($addressee) - 1 ? $fBold : $fReg;   // фамилия — полужирным
            foreach (pl_wrap($ln, 17, $f, $aw) as $w) {
                pl_text($img, $ax2, $ay2 + 17, 17, $ink, $f, $w);
                $ay2 += 25;
            }
        }
        $y = $ay2 + 34;

        // Заголовок к тексту — от левого поля, без разрядки и без центрирования.
        // Обязательно с переносом: заголовок делового письма отвечает на вопрос
        // «о чём», он длинный и в одну строку не помещается.
        $title = (string) ($o['title'] ?? 'Обращение');
        foreach (pl_wrap($title, 23, $fSerB, $W - $mL - $mR) as $ln) {
            pl_text($img, $mL, $y + 23, 23, $navy, $fSerB, $ln);
            $y += 32;
        }
        $y += 14;
    } else {
        $title = mb_strtoupper((string) ($o['title'] ?? 'Обращение'), 'UTF-8');
        pl_text_spaced($img, (int) ($W / 2), $y + 36, 36, $navy, $fSerB, $title, 3.0, 'center');
        $y += 62;

        foreach ($addressee as $ln) {
            foreach (pl_wrap($ln, 19, $fSerB, $W - $mL - $mR - 120) as $w) {
                pl_text($img, 0, $y + 19, 19, $navy, $fSerB, $w, 'center', $W);
                $y += 27;
            }
        }
        $y += 16;
    }

    $salut = trim((string) ($o['salutation'] ?? ''));
    if ($salut !== '') {
        pl_text($img, $mL, $y + 20, 20, $navy, $fSerB, $salut);
        $y += 38;
    }

    /* ── Тело ──────────────────────────────────────────────────────────── */
    // Кегль подбирается под объём: обращение обязано уместиться на один лист.
    // Двухстраничное письмо в ведомстве читают хуже, а третьей страницы у нас
    // и нет — подпись с печатью должны стоять под текстом, а не отдельно.
    $blocks = pl_letter_blocks((string) ($o['body'] ?? ''));
    // Плашки убираем ДО подбора кегля, иначе высота считалась бы по одной
    // разметке, а печаталась бы другая — и текст не влез бы на лист.
    if ($plain) {
        foreach ($blocks as $i => $b) if ($b['type'] === 'box') $blocks[$i]['type'] = 'p';
    }
    $att    = array_values(array_filter((array) ($o['attachments'] ?? [])));

    $footNeed = 306;                                   // подпись, печать, QR, контакты
    $size = 20; $lh = 29;
    for (; $size >= 13; $size--, $lh = (int) round($size * 1.45)) {
        $need = 0;
        foreach ($blocks as $b) {
            $w = $W - $mL - $mR - ($b['type'] === 'li' ? 46 : ($b['type'] === 'box' ? 56 : 0));
            $need += count(pl_wrap($b['text'], $size, $fSer, $w)) * $lh + ($b['type'] === 'box' ? 26 : 10);
        }
        if ($att) $need += 30 + count($att) * ($lh + 2);
        if ($y + $need + $footNeed <= $H - 70) break;
    }

    foreach ($blocks as $b) {
        if ($b['type'] === 'box') {
            $bh = count(pl_wrap($b['text'], $size, $fSer, $W - $mL - $mR - 56)) * $lh + 20;
            $bg = imagecolorallocate($img, 244, 235, 213);
            imagefilledrectangle($img, $mL, $y, $W - $mR, $y + $bh, $bg);
            $gc = imagecolorallocate($img, $gold[0], $gold[1], $gold[2]);
            imagefilledrectangle($img, $mL, $y, $mL + 4, $y + $bh, $gc);
            $ty = $y + 12;
            foreach (pl_wrap($b['text'], $size, $fSer, $W - $mL - $mR - 56) as $ln) {
                pl_text($img, $mL + 28, $ty + $size, $size, $navy, $fSer, $ln);
                $ty += $lh;
            }
            $y += $bh + 16;
            continue;
        }
        if ($b['type'] === 'li') {
            $first = true;
            foreach (pl_wrap($b['text'], $size, $fSer, $W - $mL - $mR - 46) as $ln) {
                if ($first) {
                    $gc = imagecolorallocate($img, $gold[0], $gold[1], $gold[2]);
                    imagefilledellipse($img, $mL + 16, $y + (int) ($size * 0.6), 8, 8, $gc);
                    $first = false;
                }
                pl_text($img, $mL + 40, $y + $size, $size, $ink, $fSer, $ln);
                $y += $lh;
            }
            $y += 6;
            continue;
        }
        $ind = 34;                                     // абзацный отступ, как в HTML
        foreach (pl_wrap($b['text'], $size, $fSer, $W - $mL - $mR - $ind) as $i => $ln) {
            pl_text($img, $mL + ($i === 0 ? $ind : 0), $y + $size, $size, $ink, $fSer, $ln);
            $y += $lh;
        }
        $y += 10;
    }

    if ($att) {
        $y += 8;
        pl_text($img, $mL, $y + $size, $size, $navy, $fBold, 'Приложения:');
        $y += $lh + 2;
        foreach ($att as $i => $a) {
            foreach (pl_wrap(($i + 1) . '. ' . $a, $size - 1, $fSer, $W - $mL - $mR - 30) as $ln) {
                pl_text($img, $mL + 22, $y + $size, $size - 1, $ink, $fSer, $ln);
                $y += $lh;
            }
        }
    }

    /* ── Подпись, печать, QR проверки ──────────────────────────────────── */
    // Подвал компонуется тремя колонками слева направо: должность — подпись с
    // печатью — фамилия. Раньше печать садилась поверх строки «Культурного
    // центра „Музыкальный Мир“» и замазывала её; теперь у каждого элемента своя
    // полоса, и они только слегка касаются друг друга, как на бумажном письме.
    // Подпись всегда на одной высоте: снизу её подпирает контактная полоса, а
    // ниже — линия рамки. Без верхнего ограничения длинный текст сдвигал блок
    // вниз, и контакты выезжали за рамку листа.
    $fy = min(max($y + 40, $H - 326), $H - 300);
    pl_text($img, $mL, $fy + 16, 15, $muted, $fReg, 'Генеральный директор');
    pl_text($img, $mL, $fy + 38, 15, $muted, $fReg, 'Культурного центра');
    pl_text($img, $mL, $fy + 60, 15, $muted, $fReg, '«Музыкальный Мир»');

    $sx = $mL + 300;                                    // полоса подписи и печати
    if (is_file($sig)) pl_image($img, $sig, $sx + 46, $fy + 6, 180, null);

    $seal = $imgDir . (is_file($imgDir . 'letter/seal.png') ? 'letter/seal.png' : 'diploma/seal.png');
    if (is_file($seal)) pl_image($img, $seal, $sx, $fy - 26, 150, null);

    pl_text($img, $sx + 252, $fy + 52, 18, $navy, $fBold, 'А. И. Ильясов');

    // QR ведёт на страницу проверки подлинности: делопроизводитель наводит камеру
    // и видит, что документ с этим номером центром действительно выдан. Подписи
    // выравниваем ПО ПРАВОМУ полю — иначе длинный адрес сайта уезжал за рамку.
    $qs = 116;
    $qr = $W - $mR;                                     // правая граница блока
    $qx = $qr - $qs;
    if (pl_letter_qr($img, ol_verify_url($number), $qx, $fy - 6, $qs)) {
        // Под кодом печатаем ПОЛНЫЙ адрес страницы вместе с номером, а не корень
        // раздела: тот, у кого нет под рукой камеры, должен набрать его руками и
        // попасть на тот же документ, что открывает QR. В самом коде зашит
        // punycode-вид домена — кириллические адреса открывают не все сканеры,
        // а ведут обе записи в одно и то же место.
        pl_text($img, 0, $fy + $qs + 16, 14, $navy, $fBold, '№' . $number, 'right', $qr);
        pl_text($img, 0, $fy + $qs + 34, 11, $muted, $fReg, 'проверка подлинности документа', 'right', $qr);
        pl_text($img, 0, $fy + $qs + 50, 11, $muted, $fReg, $site . '/letter/' . $number, 'right', $qr);
    }

    /* ── Контактная полоса ─────────────────────────────────────────────── */
    // Нижняя линия рамки идёт на 44 пикселя от края листа. Всё, что печатается
    // ниже неё, выглядит браком, поэтому последняя строка обязана уложиться
    // выше — считаем от неё, а не от края листа.
    $frameB = $H - 44;
    $c2 = trim(implode(' · ', array_filter([$addr, $phone, $email])));
    $c3 = 'Сайт ' . $site . ($vk !== '' ? ' · ВКонтакте ' . $vk : '');

    // Длинные строки контактов ужимаем по кеглю, а не обрезаем: адрес и почта
    // в официальном документе должны читаться целиком.
    $cw = $W - $mL - $mR;
    $s2 = 12; while ($s2 > 9 && pl_text_w($s2, $fReg, $c2) > $cw) $s2--;
    $s3 = 12; while ($s3 > 9 && pl_text_w($s3, $fReg, $c3) > $cw) $s3--;

    $cy = $frameB - 76;                                // линия-разделитель
    pl_rule($img, $mL, $cy, $W - $mR, $plain ? [200, 200, 208] : [216, 199, 155], 1);
    pl_text($img, 0, $cy + 26, 13, $navy, $fBold, $reg, 'center', $W);
    if ($c2 !== '') pl_text($img, 0, $cy + 46, $s2, $muted, $fReg, $c2, 'center', $W);
    pl_text($img, 0, $cy + 64, $s3, $muted, $fReg, $c3, 'center', $W);

    // Картинка-превью — для админки и для проверки вёрстки: PDF на телефоне
    // открывается не везде, а посмотреть на лист перед отправкой нужно всегда.
    if (!empty($o['preview'])) {
        // Размер подобран под письмо: 800 точек — это ширина колонки письма с
        // двойной плотностью, дальше почтовый клиент ужимает сам. Качество 62 —
        // граница, за которой на сканоподобном изображении появляется «грязь»
        // вокруг букв. Итог около девяноста килобайт вместо ста семидесяти:
        // на тридцати пяти тысячах писем это разница между тремя гигабайтами
        // на диске и шестью.
        $pw = 800; $ph = (int) round($H * $pw / $W);
        $pv = imagecreatetruecolor($pw, $ph);
        imagecopyresampled($pv, $img, 0, 0, 0, 0, $pw, $ph, $W, $H);
        imagejpeg($pv, (string) $o['preview'], 62);
        imagedestroy($pv);
    }

    pl_pdf_from_images([$img], $path, 150, 92);
    imagedestroy($img);
    return $path;
}
