<?php
declare(strict_types=1);
namespace Dip\V2;
// АВТОСБОРКА диспетчером diploma_html.php: замороженный движок бланка (868989a).
// Правки вносить в исходную версию и пересобирать, не редактировать вручную.
/**
 * core/diploma_html.php — HTML-сборщик дипломов и благодарностей.
 * Вёрстка и стили — 1:1 из эталонов Даниэля (docs/assets_daniel/diplom_laureat2.html
 * и blagodarnost1.html): A4 портрет, Playfair Display, золотые градиенты, ряд
 * гербов с большим центральным логотипом, белое растворение снизу, подписи
 * Галиулина и Ильясова с полными регалиями, печати.
 *
 * diploma_html(array $c, array $a, array $opt=[]): string
 *   $c — конкурс (name, type, diploma_bg, diploma_template);
 *   $a — заявка (full_name, group_name, age_category, nomination, teacher,
 *        institution, city, work_title, result, extra_diploma);
 *   $opt: sample — шаблон-эталон с плейсхолдерами и знаком ОБРАЗЕЦ,
 *         thanks — благодарность (текст признательности + рукописное ФИО),
 *         edit   — data-el атрибуты для визуального редактора админки.
 *
 * Конфиг редактора (competitions.diploma_template, JSON):
 *   {"els":{"<ключ>":{"dy":мм,"fs":pt,"hide":0|1}}, "overlay":0..100, "fade":мм}
 *   overlay — затемнение фоновой картинки сверху (для читаемости золота/белого),
 *   fade    — высота белого растворения снизу (зона подписей), по эталону 95 мм.
 *   Ключи элементов: org, legal, logos, comptype, compname, support, dtype,
 *                    degree, label, name, fields, bottom.
 */

/** Конфиг элемента из шаблона. */
function _dh_cfg(array $tpl, string $key): array {
    $e = $tpl['els'][$key] ?? [];
    return ['dy' => (float)($e['dy'] ?? 0), 'fs' => isset($e['fs']) ? (float)$e['fs'] : null,
            'hide' => !empty($e['hide'])];
}

/**
 * Разбор поля «педагог» из заявки: если там несколько ФИО (через запятую/точку с запятой/
 * «и»/с новой строки, либо просто несколько подряд идущих троек Фамилия-Имя-Отчество) —
 * возвращает подпись «Педагоги» и список через запятую; для одного — «Педагог».
 * @return array{0:string,1:string}  [подпись, значение]
 */
function _dh_teachers(string $raw): array {
    $raw = trim(preg_replace('~\s+~u', ' ', $raw));
    if ($raw === '') return ['Педагог', ''];
    // 1) Явные разделители.
    $parts = preg_split('~\s*(?:,|;|/|\bи\b|\n)\s*~u', $raw, -1, PREG_SPLIT_NO_EMPTY) ?: [];
    $parts = array_values(array_filter(array_map('trim', $parts), static fn($p) => $p !== ''));
    // 2) Разделителей нет, но несколько ФИО подряд (кратно 3 словам) — режем по тройкам.
    if (count($parts) <= 1) {
        $words = preg_split('~\s+~u', $raw, -1, PREG_SPLIT_NO_EMPTY) ?: [];
        if (count($words) >= 6 && count($words) % 3 === 0) {
            $parts = [];
            for ($i = 0, $n = count($words); $i < $n; $i += 3) $parts[] = implode(' ', array_slice($words, $i, 3));
        } else {
            $parts = [$raw];
        }
    }
    $label = count($parts) > 1 ? 'Педагоги' : 'Педагог';
    return [$label, implode(', ', $parts)];
}
/** style="" для элемента: вертикальный сдвиг + кегль + скрытие. */
/** Подобрать кегль (pt), чтобы текст влез в $availMm в ОДНУ строку (эмпирика по ширине em). */
function _dh_fit_pt(string $s, float $maxPt, float $emW, float $availMm, float $minPt = 12.0): float {
    $len = max(1, mb_strlen(trim($s)));
    $fit = $availMm / ($len * $emW * 0.3528);   // 0.3528 мм/pt
    return round(max($minPt, min($maxPt, $fit)), 1);
}

/**
 * Ширина строки в мм при заданном кегле С УЧЁТОМ разрядки (letter-spacing).
 * Разрядку раньше не считали — и «ЗА ВИРТУОЗНОЕ ИСПОЛНЕНИЕ» с letter-spacing 4px
 * вылезало за лист и обрезалось на «…ИСПОЛНЕН».
 */
function _dh_text_mm(string $s, float $pt, float $emW, float $lsPx = 0.0): float {
    $len = max(1, mb_strlen(trim($s)));
    return $len * $emW * $pt * 0.3528 + max(0, $len - 1) * $lsPx * 0.264583;
}

/**
 * Разбить строку на $lines сбалансированных строк ПО СЛОВАМ (слова не режутся).
 * @return string[] ровно столько строк, сколько получилось (может быть меньше $lines)
 */
function _dh_split_lines(string $s, int $lines): array {
    $words = preg_split('~\s+~u', trim($s), -1, PREG_SPLIT_NO_EMPTY) ?: [];
    if ($lines <= 1 || count($words) <= 1) return [trim($s)];
    if ($lines === 2) { $p = _dh_split_two($s); return $p[1] === '' ? [$p[0]] : $p; }

    // Три и более: жадно набираем примерно равные по длине куски.
    $total = mb_strlen(implode(' ', $words));
    $target = $total / $lines;
    $out = []; $cur = '';
    foreach ($words as $w) {
        $try = $cur === '' ? $w : $cur . ' ' . $w;
        if ($cur !== '' && mb_strlen($try) > $target && count($out) < $lines - 1) { $out[] = $cur; $cur = $w; }
        else $cur = $try;
    }
    if ($cur !== '') $out[] = $cur;
    return $out;
}

/**
 * ОДНО ФИО из поля «педагог».
 *
 * Правило владельца: одна благодарность = один педагог = одно ФИО. Двух имён на
 * одном бланке быть не может. В заявке педагоги нередко перечислены через запятую
 * или просто подряд — берём одного (по умолчанию первого), а при заказе используем
 * ровно то ФИО, которое указал заказчик.
 *
 * @param int $idx какой по счёту педагог нужен (0 — первый)
 */
function _dh_one_person(string $raw, int $idx = 0): string {
    /* Запись с должностями разбирается точно. Через _dh_teachers() она прошла бы
     * как «Педагог: Иванов И.И.» — и на благодарности вместо имени человека
     * стояло бы имя вместе с его должностью. */
    if (str_contains($raw, ':')) {
        if (!function_exists('mentors_parse')) require_once BASE_PATH . '/core/mentors.php';
        $fios = array_values(array_filter(array_map(
            static fn($m) => trim($m['fio']), mentors_parse($raw)
        )));
        if ($fios) return $fios[$idx] ?? $fios[0];
    }
    [, $joined] = _dh_teachers($raw);
    $list = array_values(array_filter(array_map('trim', explode(',', $joined)), static fn($x) => $x !== ''));
    if (!$list) return trim($raw);
    return $list[$idx] ?? $list[0];
}

/**
 * АВТО-ВЁРСТКА строки диплома: слова НИКОГДА не режутся и текст НИКОГДА не вылезает.
 *
 * Порядок ровно такой, как просил владелец:
 *   1) пробуем уместить в одну строку максимальным кеглем;
 *   2) не влезло — переносим ПО СЛОВАМ на вторую строку;
 *   3) не влезло и в две — уменьшаем кегль, пока не влезет.
 *
 * @param float $lsPx разрядка элемента в px (letter-spacing из CSS)
 * @return array{html:string, css:string}
 */
function _dh_fit_block(string $text, float $maxPt, float $minPt, float $emW,
                       float $availMm, float $lsPx = 0.0, int $maxLines = 2,
                       int $wrapMinWords = 2): array {
    $text = trim($text);
    if ($text === '') return ['html' => '', 'css' => 'font-size:' . $maxPt . 'pt;'];

    // Короткие строки (ФИО человека — обычно три слова) НЕ переносим: «Мельникова /
    // Анастасия Вадимовна» читается как две разные строки. Такие ужимаем кеглем и
    // держим в одну строку. Перенос включается от $wrapMinWords слов — это названия
    // коллективов и спецноминации, где он как раз и нужен.
    $words = count(preg_split('~\s+~u', $text, -1, PREG_SPLIT_NO_EMPTY) ?: []);
    if ($words < $wrapMinWords) $maxLines = 1;

    for ($pt = $maxPt; $pt >= $minPt - 0.01; $pt -= 0.5) {
        for ($n = 1; $n <= $maxLines; $n++) {
            $parts = _dh_split_lines($text, $n);
            if (count($parts) < $n) continue;              // на меньшее число строк уже проверили
            $fits = true;
            foreach ($parts as $p) { if (_dh_text_mm($p, $pt, $emW, $lsPx) > $availMm) { $fits = false; break; } }
            if (!$fits) continue;
            $lh = $n > 1 ? 1.06 : 1.05;
            return [
                'html' => implode('<br>', array_map('h', $parts)),
                'css'  => 'font-size:' . round($pt, 1) . 'pt;line-height:' . $lh . ';'
                        . ($n > 1 ? 'white-space:normal;' : 'white-space:nowrap;'),
            ];
        }
    }
    // Даже минимальным кеглем не влезло — отдаём минимальный кегль с обычным переносом
    // по словам: лучше три строки мелко, чем обрезанное слово.
    $parts = _dh_split_lines($text, $maxLines);
    return [
        'html' => implode('<br>', array_map('h', $parts)),
        'css'  => 'font-size:' . round($minPt, 1) . 'pt;line-height:1.06;white-space:normal;word-break:normal;',
    ];
}

/**
 * Степень в человеческом виде: арабская цифра → римская заглавная.
 * В шрифтах тем (Cormorant Garamond, Forum и др.) цифры по умолчанию старостильные —
 * «ЛАУРЕАТ 1 СТЕПЕНИ» печаталось с крошечной единицей вровень со строчными буквами.
 * Римские I/II/III — обычные заглавные, поэтому смотрятся ровно с остальным текстом.
 */
function _dh_degree_roman(string $s): string {
    $map = ['1' => 'I', '2' => 'II', '3' => 'III', '4' => 'IV', '5' => 'V'];
    return preg_replace_callback('~(?<![0-9])([1-5])(?=\s*(СТЕПЕН|степен|МЕСТ|мест))~u',
        static fn($m) => $map[$m[1]] ?? $m[1], $s) ?? $s;
}
/**
 * Разбить длинное название на 2 сбалансированные строки: минимизируем длиннейшую строку,
 * при равенстве — больше слов в первой строке (логичный перенос по смыслу).
 * @return array{0:string,1:string}
 */
function _dh_split_two(string $s): array {
    $words = preg_split('~\s+~u', trim($s), -1, PREG_SPLIT_NO_EMPTY) ?: [];
    if (count($words) < 2) return [$s, ''];
    $best = [$s, '']; $bestMax = PHP_INT_MAX; $bestW1 = 0;
    for ($i = 1, $n = count($words); $i < $n; $i++) {
        $l1 = implode(' ', array_slice($words, 0, $i));
        $l2 = implode(' ', array_slice($words, $i));
        $mx = max(mb_strlen($l1), mb_strlen($l2));
        if ($mx < $bestMax || ($mx === $bestMax && $i > $bestW1)) { $bestMax = $mx; $best = [$l1, $l2]; $bestW1 = $i; }
    }
    return $best;
}

function _dh_style(array $cfg, ?float $baseFs = null): string {
    $s = '';
    if ($cfg['dy'] !== 0.0) $s .= 'transform:translateY(' . $cfg['dy'] . 'mm);';
    if ($cfg['fs'] !== null && $baseFs !== null) $s .= 'font-size:' . $cfg['fs'] . 'pt;';
    if ($cfg['hide']) $s .= 'display:none;';
    return $s !== '' ? ' style="' . $s . '"' : '';
}
/** Как _dh_style, но добавляет авто-CSS ($autoCss) когда в шаблоне НЕТ ручного кегля. */
function _dh_style2(array $cfg, string $autoCss = ''): string {
    $s = '';
    if (($cfg['dy'] ?? 0.0) !== 0.0) $s .= 'transform:translateY(' . $cfg['dy'] . 'mm);';
    if (($cfg['fs'] ?? null) !== null) $s .= 'font-size:' . $cfg['fs'] . 'pt;'; else $s .= $autoCss;
    if (!empty($cfg['hide'])) $s .= 'display:none;';
    return $s !== '' ? ' style="' . $s . '"' : '';
}

/**
 * ШИРИНА СТРОКИ В МИЛЛИМЕТРАХ ПРИ ЗАДАННОМ КЕГЛЕ (Manrope, полужирный).
 *
 * Точно её знает только браузер, но нам нужна оценка на стороне PHP - до того,
 * как страница отрисована. Прописные буквы шире строчных, пробел и запятая
 * заметно уже; коэффициенты сняты с гарнитуры и дают ошибку в пределах пары
 * процентов, чего для подбора кегля достаточно.
 */
function _dh_text_w(string $s, float $fsPt): float {
    $mmPerEm = $fsPt * 0.3528;
    $w = 0.0;
    $len = mb_strlen($s);
    for ($i = 0; $i < $len; $i++) {
        $ch = mb_substr($s, $i, 1);
        /* Коэффициенты откалиброваны по готовому бланку: первый набор был снят
         * «на глаз» и занижал ширину примерно на восемь процентов - расчёт
         * обещал четыре строки, а браузер выкладывал пять. */
        if ($ch === ' ')                                  $w += 0.29;
        elseif (mb_strpos(',.:;!?«»"\'()-–—', $ch) !== false) $w += 0.33;
        elseif (mb_strpos('мшщюжфыМШЩЮЖФЫ', $ch) !== false)  $w += 0.78;
        elseif ($ch === mb_strtoupper($ch) && $ch !== mb_strtolower($ch)) $w += 0.68;
        else                                              $w += 0.575;
    }
    return $w * $mmPerEm;
}

/**
 * НАИБОЛЬШИЙ КЕГЛЬ, ПРИ КОТОРОМ ТЕКСТ УКЛАДЫВАЕТСЯ В ЗАДАННОЕ ЧИСЛО СТРОК.
 *
 * Слова переносятся так же, как это сделает браузер: жадно, по пробелам, без
 * разрыва слова. Если не помещается даже на нижней границе кегля - возвращаем
 * её: лучше строкой больше, чем нечитаемые буквы.
 */
function _dh_fit_lines(string $text, float $widthMm, float $maxFs, float $minFs, int $maxLines): float {
    $words = preg_split('~\s+~u', trim($text)) ?: [];
    if (!$words) return $maxFs;
    for ($fs = $maxFs; $fs >= $minFs - 0.001; $fs -= 0.1) {
        $lines = 1; $cur = '';
        foreach ($words as $wd) {
            $try = $cur === '' ? $wd : $cur . ' ' . $wd;
            // Три процента запаса: округления браузера не должны стоить лишней строки.
            if (_dh_text_w($try, $fs) <= $widthMm * 0.97) { $cur = $try; continue; }
            $lines++; $cur = $wd;
            if ($lines > $maxLines) break;
        }
        if ($lines <= $maxLines) return round($fs, 1);
    }
    return $minFs;
}

/**
 * Дизайн-тема диплома по названию конкурса: свои шрифты и цвета для названия,
 * слова ДИПЛОМ/БЛАГОДАРНОСТЬ, степени и ФИО. Все шрифты — с кириллицей.
 * Переопределяется ключом diploma_template.theme (cosmos|zenith|theatre|derzhava|classic).
 */
function diploma_theme_pick(array $c, array $tpl): array {
    $themes = [
        // Космос, звёзды: холодное сияние, серебристо-ледяные акценты к золоту.
        'cosmos' => [
            /* Почерк темы: звание своим шрифтом, своя разрядка и тень - чтобы дипломы
             * разных конкурсов не выглядели одним бланком с другой картинкой. */
            'ff_degree' => "'Prata',serif", 'ls_degree' => '3px',
            'ls_name' => '.5px', 'sh_comp' => '0 0 18px rgba(120,200,255,.35)',
            'fonts'   => 'Prata',
            /* Название набирается СВОЕЙ гарнитурой, отличной от остального листа:
             * это главная строка, и по ней диплом узнают на фотографии. */
            'ff_comp' => "'Prata',serif", 'fam_comp' => 'Prata', 'ls_comp' => '4px', 'w_comp' => 0.72,
            'grad_comp'   => 'linear-gradient(180deg,#EAF7FF 0%,#BFE9FF 30%,#7FC9F0 55%,#CDEFFF 80%,#FFFFFF 100%)',
            'grad_dtype'  => 'linear-gradient(180deg,#FFF6C4 0%,#FFD54F 18%,#FFC107 38%,#D4A017 52%,#B8860B 62%,#FFC107 80%,#FFF3B0 100%)',
            /* Звание уведено в аметист: рядом с ледяным названием и золотым
             * словом ДИПЛОМ оно раньше было таким же бело-голубым и читалось как
             * продолжение заголовка. */
            'grad_degree' => 'linear-gradient(180deg,#F6F0FF 0%,#DCC8FF 34%,#A98CFF 66%,#EFE6FF 100%)',
            'name_color' => '#BFE9FF', 'ff_name' => "'Prata',serif",
            'script_font' => 'Marck+Script', 'ff_script' => "'Marck Script',cursive", 'script_fs' => 32, 'script_color' => '#D6F1FF',
        ],
        // Зенит, триумф: античная классика, тёплое торжественное золото.
        'zenith' => [
            'ff_degree' => "'Forum',serif", 'ls_degree' => '5px',
            'ls_name' => '1px', 'sh_comp' => '0 1px 0 rgba(255,240,200,.5)',
            'fonts'   => 'Forum&family=Playfair+Display:wght@900',
            'ff_comp' => "'Playfair Display','Forum',serif", 'fam_comp' => 'Playfair Display', 'ls_comp' => '4px', 'w_comp' => 0.74,
            'grad_comp'   => 'linear-gradient(180deg,#FFF7D6 0%,#FFE082 25%,#E9C567 45%,#B8860B 58%,#E9C567 75%,#FFF3B0 100%)',
            'grad_dtype'  => 'linear-gradient(180deg,#FFFBE8 0%,#FFE082 20%,#F5C542 40%,#C9971C 55%,#A67C10 65%,#E9C567 82%,#FFF7D6 100%)',
            // Звание — холодная платина: рядом с золотым названием видно сразу.
            'grad_degree' => 'linear-gradient(180deg,#FFFFFF 0%,#E2E9F5 34%,#9AA6BE 68%,#F0F4FB 100%)',
            'name_color' => '#FFE99C', 'ff_name' => "'Forum',serif",
            'script_font' => 'Marck+Script', 'ff_script' => "'Marck Script',cursive", 'script_fs' => 33, 'script_color' => '#FFE99C',
        ],
        // Театр, сцена: бархат и шампань, тёплый кремовый свет рампы.
        'theatre' => [
            'ff_degree' => "'Cormorant Garamond',serif", 'ls_degree' => '4px',
            'ls_name' => '.5px', 'sh_comp' => '0 1px 0 rgba(255,235,190,.45)',
            'fonts'   => 'Cormorant+Garamond:wght@600;700&family=Alegreya+SC:wght@900',
            'ff_comp' => "'Alegreya SC','Cormorant Garamond',serif", 'fam_comp' => 'Alegreya SC', 'ls_comp' => '3px', 'w_comp' => 0.76,
            'grad_comp'   => 'linear-gradient(180deg,#FFF6E8 0%,#FFE3B0 30%,#F2BE6A 55%,#D89A3D 70%,#FFDFA6 100%)',
            'grad_dtype'  => 'linear-gradient(180deg,#FFF9EC 0%,#FFE7B8 22%,#F4C878 42%,#D89A3D 56%,#B87526 66%,#F2BE6A 82%,#FFF2D8 100%)',
            // Звание — светлый изумруд сцены, чтобы не повторять золото названия.
            'grad_degree' => 'linear-gradient(180deg,#EAFFF6 0%,#B6EDD6 34%,#5FBF9B 68%,#DFFBF0 100%)',
            'name_color' => '#FFE9C4', 'ff_name' => "'Cormorant Garamond',serif",
            'script_font' => 'Poiret+One', 'ff_script' => "'Poiret One',cursive", 'script_fs' => 34, 'script_color' => '#FFE3B0',
        ],
        // Держава: имперское золото с рубиновым отблеском, строгая антиква.
        'derzhava' => [
            'ff_degree' => "'Old Standard TT',serif", 'ls_degree' => '6px',
            'ls_name' => '1px', 'sh_comp' => '0 1px 0 rgba(255,225,170,.5)',
            'fonts'   => 'Old+Standard+TT:wght@700&family=Yeseva+One',
            'ff_comp' => "'Yeseva One','Old Standard TT',serif", 'fam_comp' => 'Yeseva One', 'ls_comp' => '3px', 'w_comp' => 0.76,
            'grad_comp'   => 'linear-gradient(180deg,#FFF3C4 0%,#FFD766 22%,#E8A93C 45%,#B8641B 60%,#E8A93C 78%,#FFE9A6 100%)',
            'grad_dtype'  => 'linear-gradient(180deg,#FFF6D0 0%,#FFD766 20%,#F0AE3C 40%,#C4571E 55%,#A63E14 63%,#E8A93C 80%,#FFE9A6 100%)',
            // Звание — светлый багрянец: золото остаётся за названием конкурса.
            'grad_degree' => 'linear-gradient(180deg,#FFF0EC 0%,#FFC9C2 32%,#E0555F 66%,#FFE3DC 100%)',
            'name_color' => '#FFE9A6', 'ff_name' => "'Old Standard TT',serif",
            'script_font' => 'Marck+Script', 'ff_script' => "'Marck Script',cursive", 'script_fs' => 32, 'script_color' => '#FFD98F',
        ],
        // Классика эталона (фолбэк).
        'classic' => [
            'ff_degree' => "'Playfair Display',serif", 'ls_degree' => '3px',
            'ls_name' => '.5px', 'sh_comp' => '0 1px 0 rgba(255,240,210,.45)',
            'fonts'   => 'Yeseva+One',
            'ff_comp' => "'Yeseva One','Playfair Display',serif", 'fam_comp' => 'Yeseva One', 'ls_comp' => '3px', 'w_comp' => 0.76,
            'grad_comp'   => 'linear-gradient(180deg,#FFF3B0 0%,#FFD54F 20%,#C9A84C 45%,#8B6F1F 55%,#C9A84C 75%,#FFE082 100%)',
            'grad_dtype'  => 'linear-gradient(180deg,#FFF3B0 0%,#FFD54F 15%,#FFC107 30%,#D4A017 45%,#A67C10 55%,#D4A017 70%,#FFC107 85%,#FFF3B0 100%)',
            'grad_degree' => 'linear-gradient(180deg,#FFFFFF 0%,#E2E9F5 34%,#9AA6BE 68%,#F0F4FB 100%)',
            'name_color' => '#FFE082', 'ff_name' => "'Playfair Display',serif",
            'script_font' => 'Marck+Script', 'ff_script' => "'Marck Script',cursive", 'script_fs' => 33, 'script_color' => '#FFE082',
        ],
    ];
    $key = (string)($tpl['theme'] ?? '');
    if (!isset($themes[$key])) {
        $n = mb_strtolower((string)($c['name'] ?? ''));
        $key = 'classic';
        if (preg_match('/росси|велич|держав|патриот|родин|отчизн|отечеств/u', $n)) $key = 'derzhava';
        elseif (preg_match('/зенит|слав|вершин|олимп|триумф|пик /u', $n))          $key = 'zenith';
        elseif (preg_match('/искусств|благо|сцен|театр|творч|арт/u', $n))          $key = 'theatre';
        elseif (preg_match('/талант|звёзд|звезд|мир|космос|галакт|вселенн/u', $n)) $key = 'cosmos';
    }
    return $themes[$key] + ['key' => $key];
}

/**
 * ПАЛИТРА ПОД СВЕТЛЫЙ ФОН.
 *
 * Все темы выше рассчитаны на тёмную подложку: там светлое золото и ледяные
 * блики. На светлой бумаге такие буквы пропадают, а раньше это лечили тёмной
 * плёнкой поверх всего фона - гасили рисунок ради текста. Теперь для светлых
 * фонов у каждой темы есть свой глубокий вариант: цвета остаются «родными»
 * конкурсу, но становятся насыщенными и читаются на бумаге.
 */
function diploma_theme_on_light(array $T): array {
    $deep = [
        // Космос: глубокая полночная синь с холодным серебром.
        'cosmos' => [
            'grad_comp'   => 'linear-gradient(180deg,#3A6EAC 0%,#255089 45%,#1B3E6D 70%,#356AA6 100%)',
            'grad_dtype'  => 'linear-gradient(180deg,#8A6A12 0%,#6B4F0A 35%,#4A3607 60%,#8A6A12 100%)',
            // Звание — аметист: рядом с синим названием видно сразу, но не темнит лист.
            'grad_degree' => 'linear-gradient(180deg,#8A68D8 0%,#6748B4 55%,#503595 100%)',
            'name_color'  => '#12294A', 'script_color' => '#1B3A63',
        ],
        // Зенит: тёмное червонное золото с медью.
        'zenith' => [
            'grad_comp'   => 'linear-gradient(180deg,#E8C669 0%,#C4901F 28%,#8F5D11 56%,#B8821C 78%,#E2BD5D 100%)',
            'grad_dtype'  => 'linear-gradient(180deg,#9C6B1A 0%,#7A4F10 38%,#57370A 62%,#9C6B1A 100%)',
            'grad_degree' => 'linear-gradient(180deg,#7A5FCC 0%,#5A43A6 45%,#432F80 78%,#6B51BC 100%)',
            'name_color'  => '#2A2145', 'script_color' => '#3A2E5C',
            'sh_comp'     => '0 0 14px rgba(212,169,60,.28)',
        ],
        // Театр, искусство: тёмный изумруд с бронзой.
        'theatre' => [
            'grad_comp'   => 'linear-gradient(180deg,#E3BE5E 0%,#B8871C 28%,#84540E 56%,#AC7A18 78%,#DCB553 100%)',
            'grad_dtype'  => 'linear-gradient(180deg,#8A6A12 0%,#6B4F0A 40%,#4A3607 65%,#8A6A12 100%)',
            'grad_degree' => 'linear-gradient(180deg,#33B394 0%,#1D9276 45%,#12735C 78%,#2AA687 100%)',
            'name_color'  => '#0E332C', 'script_color' => '#14483F',
            'sh_comp'     => '0 0 14px rgba(191,154,52,.25)',
        ],
        // Держава: тёмный багрянец с золотом.
        'derzhava' => [
            /* Название - густое золото с тёмной прочеканкой, звание - багрянец:
             * две главные строки должны различаться, иначе диплом читается как
             * один сплошной заголовок. */
            /* Чистое светлое золото - без затемнения и без обводок: тёмные тона
             * на бумаге выглядели грязно. Отличие от звания даётся цветом. */
            'grad_comp'   => 'linear-gradient(180deg,#E7C468 0%,#C08C1E 28%,#8E5B10 56%,#B57F1B 78%,#E0BB5C 100%)',
            'grad_dtype'  => 'linear-gradient(180deg,#C79A2E 0%,#9C6B1A 26%,#6B4F0A 52%,#9C6B1A 76%,#D9B45A 100%)',
            'grad_degree' => 'linear-gradient(180deg,#E8515E 0%,#C82936 42%,#A81A26 74%,#DC414E 100%)',
            'name_color'  => '#5C1219', 'script_color' => '#7A1B22',
            'sh_comp'     => '0 0 14px rgba(184,134,43,.25)',
        ],
        // Классика: тёмный кофейный с золотом.
        'classic' => [
            'grad_comp'   => 'linear-gradient(180deg,#E4BF5F 0%,#B9881D 28%,#85550F 56%,#AD7B19 78%,#DDB654 100%)',
            'grad_dtype'  => 'linear-gradient(180deg,#8A6A12 0%,#6B4F0A 38%,#4A3607 62%,#8A6A12 100%)',
            'grad_degree' => 'linear-gradient(180deg,#E0663C 0%,#BC4622 55%,#9C3316 100%)',
            'name_color'  => '#37230F', 'script_color' => '#4A3115',
        ],
    ];
    $k = (string) ($T['key'] ?? 'classic');
    return isset($deep[$k]) ? array_merge($T, $deep[$k]) : $T;
}

function diploma_html(array $c, array $a, array $opt = []): string {
    $tpl = [];
    if (!empty($c['diploma_template'])) {
        $j = json_decode((string)$c['diploma_template'], true);
        if (is_array($j)) $tpl = $j;
    }
    $sample = !empty($opt['sample']);
    $thanks = !empty($opt['thanks']);
    $isExtra = !empty($opt['extra']);   // ОТДЕЛЬНЫЙ дополнительный диплом (спецноминация)
    $named  = !empty($opt['named']);    // именной диплом (в составе коллектива)
    $edit   = !empty($opt['edit']);
    // ЧИСТЫЙ оригинал: без подписей и печатей (их ставят живьём), НО с номером+QR.
    $clean  = !empty($opt['clean']);

    $base   = rtrim(cfgv('base_url'), '/');
    $imgDip = $base . '/assets/img/diploma';
    $bgUrl  = '';
    if (!empty($c['diploma_bg'])) {
        $p = (string)$c['diploma_bg'];
        $bgUrl = preg_match('~^https?://~', $p) ? $p : $base . '/' . ltrim($p, '/');
    }
    // Затемнение нужно только поверх фотографии; на градиенте эталона — ноль.
    /* ЗАТЕМНЕНИЕ ПО УМОЛЧАНИЮ ВЫКЛЮЧЕНО. Решение владельца: фон рисуется под
     * конкретный конкурс и сам по себе красив, а тёмная плёнка поверх гасила
     * весь орнамент ради читаемости белого текста. Читаемость теперь решается
     * цветом текста под яркость фона (core/diploma_fit.php), а не порчей
     * картинки. Ручная настройка конкурса по-прежнему сильнее. */
    $overlay = isset($tpl['overlay']) ? max(0, min(100, (int)$tpl['overlay'])) : 0;

    /* ПОЛЯ И ЦВЕТ ТЕКСТА ПОДБИРАЮТСЯ ПОД КОНКРЕТНЫЙ ФОН.
     *
     * Поля были заданы одним числом на все конкурсы, и на новых фонах строки
     * заезжали на боковой орнамент - на балалайку, на резную раму. Здесь фон
     * разбирается по пикселям (core/diploma_fit.php): находится граница
     * рисунка, и от неё считаются поля. Там же меряется яркость середины: на
     * светлой бумаге текст тёмный, на тёмной подложке - светлый. */
    if (!function_exists('diploma_fit') && is_file(BASE_PATH . '/core/diploma_fit.php')) {
        require_once BASE_PATH . '/core/diploma_fit.php';
    }
    $bgFile = '';
    if (!empty($c['diploma_bg'])) {
        $bp = (string) $c['diploma_bg'];
        if (!preg_match('~^https?://~', $bp)) $bgFile = BASE_PATH . '/public/' . ltrim($bp, '/');
    }
    $FIT = function_exists('diploma_fit') ? diploma_fit($bgFile) : [
        'pad_top' => 8.0, 'pad_right' => 12.0, 'pad_bottom' => 7.0, 'pad_left' => 12.0,
        'dark' => true, 'ink' => '#ffffff', 'muted' => 'rgba(255,255,255,.88)',
        'shadow' => 'none',
    ];
    /* РУЧНАЯ НАСТРОЙКА КОНКУРСА СИЛЬНЕЕ АВТОПОДБОРА.
     *
     * Разбор фона по пикселям хорош как основа, но живой рисунок бывает
     * обманчив: у «Высшей лиги» тёмный верх усыпан золотыми листьями, средняя
     * яркость выходит высокой, и шапка красилась тёмным по тёмному. Поэтому
     * любое значение можно закрепить в карточке конкурса (diploma_template):
     * поля, тёмный верх, подсветку снизу. */
    /* sig_reserve — дополнительный зазор между данными участника и блоком
     * подписей, свой у каждого фона. У «Высшей лиги» подписи стоят высоко (под
     * ними тёмный мраморный пьедестал, опускать некуда), и штамп председателя
     * касался строки «Конкурсный номер». Опускать подписи нельзя — поднимаем
     * данные. */
    foreach (['pad_top', 'pad_right', 'pad_bottom', 'pad_left', 'pad_left_bot', 'pad_right_bot', 'sig_reserve'] as $pk) {
        if (isset($tpl[$pk]) && is_numeric($tpl[$pk])) $FIT[$pk] = (float) $tpl[$pk];
    }
    /* Каким низ листа вышел ПО РИСУНКУ, а не по настройке. Белую подсветку внизу
     * владелец у части конкурсов снял вручную, но сам фон под номером бланка от
     * этого светлее не стал: у «Высшей лиги» там тёмный мраморный пьедестал, и
     * номер с надписью «проверка подлинности» на нём пропадали. Признак нужен
     * отдельно от настройки, чтобы покрасить служебный угол по факту. */
    $bottomIsDark = !empty($FIT['fade_bottom']);
    foreach (['dark', 'dark_top', 'fade_bottom'] as $bk) {
        if (isset($tpl[$bk])) $FIT[$bk] = (bool) $tpl[$bk];
    }
    // Подсветку включили руками — под номером снова светло.
    if (!empty($FIT['fade_bottom'])) $bottomIsDark = false;
    // Цвета пересобираем после ручных правок, иначе они разойдутся с флагами.
    $FIT['ink']       = $FIT['dark'] ? '#ffffff' : '#2A1A0B';
    $FIT['muted']     = $FIT['dark'] ? 'rgba(255,255,255,.88)' : 'rgba(42,26,11,.86)';
    /* ТЁМНЫХ ТЕНЕЙ ПОД ТЕКСТОМ НЕТ (правило владельца: выглядит дёшево).
     * На тёмной подложке белые буквы читаются и без ореола, на светлой бумаге
     * оставлена только едва заметная светлая подложка-рельеф. */
    $FIT['shadow']    = $FIT['dark']
        ? 'none'
        : 'drop-shadow(0 1px 1px rgba(255,255,255,.6))';
    $FIT['ink_top']   = !empty($FIT['dark_top']) ? '#ffffff' : '#2A1A0B';
    $FIT['muted_top'] = !empty($FIT['dark_top']) ? 'rgba(255,255,255,.92)' : 'rgba(42,26,11,.86)';
    /* Во сколько раз сузилась колонка против базовой вёрстки (поля 12+12 мм).
     * На этот коэффициент сжимается всё содержимое листа. Ниже 0.78 не опускаем:
     * дальше текст становится мелким для печати. */
    /* Одно боковое поле на обе стороны: строки центрируются по середине листа,
       а не по середине неровной колонки. */
    $PAD_X  = round(max((float)$FIT['pad_left'], (float)$FIT['pad_right']), 1);
    $PAD_X_BOT = round(max((float)($FIT['pad_left_bot'] ?? $FIT['pad_left']),
                           (float)($FIT['pad_right_bot'] ?? $FIT['pad_right'])), 1);
    $FIT['pad_left'] = $FIT['pad_right'] = $PAD_X;
    $CSCALE = round(max(0.78, min(1.0, (210 - $PAD_X * 2) / 186)), 3);

    /* НАЗВАНИЕ КОНКУРСА ДОЛЖНО ВСТАВАТЬ В ОДНУ СТРОКУ.
     *
     * Кегль был жёстко 37 пунктов - под короткие названия. «Наследие России» и
     * «На волне искусства» в узкой колонке переносились на два ряда и ломали
     * весь верх листа. Считаем запас по числу знаков с учётом разрядки и того,
     * насколько сузилась колонка. */
    $compLen  = max(1, mb_strlen(trim((string) ($c['name'] ?? ''))));
    $COMP_FS  = 37.0;
    /* Кегль считаем по фактической ширине строки, а не «на глаз»: у названия
     * есть разрядка между буквами, и она съедает место не хуже самих букв.
     * Ширина прописной зависит от гарнитуры темы: «Yeseva One» шире «Oranienbaum»
     * почти в полтора раза, и один общий коэффициент либо ронял кегль у узких
     * шрифтов, либо ломал строку надвое у широких. */
    $availMm = (210 - $FIT['pad_left'] - $FIT['pad_right']) / max(0.01, $CSCALE) - 10;
    /* Разрядка у длинного названия меньше: «НА ВОЛНЕ ИСКУССТВА» с широкой
     * разрядкой съедало всю строку и вынуждало ставить мелкий кегль. Короткое
     * название, наоборот, разрежаем сильнее - так оно выглядит торжественнее. */
    $lsPx    = $compLen > 15 ? 2.0 : ($compLen > 10 ? 3.0 : 5.0);
    $lsMm    = $lsPx * 0.2646;                   // разрядка названия, мм на знак

    /* Белая подсветка поднята: подписи, печать и номер должны целиком лежать на
     * светлом, иначе на тёмном фоне нижние строки читаются с трудом. */
    $fade    = isset($tpl['fade']) ? max(30, min(160, (int)$tpl['fade'])) : 125;
    $T       = diploma_theme_pick($c, $tpl);
    /* Кегль названия — уже с учётом гарнитуры темы: строка должна встать в один
     * ряд и при этом занять ширину листа целиком. */
    $perPt   = 0.3528 * (float)($T['w_comp'] ?? 0.72);
    $COMP_FS = ($availMm - $compLen * $lsMm) / max(1, $compLen) / $perPt;
    $COMP_FS = round(max(30.0, min(66.0, $COMP_FS * $CSCALE)), 1);
    /* На светлом фоне берём глубокий вариант той же темы: цвета остаются
     * «родными» конкурсу, но читаются на бумаге без затемняющей плёнки. */
    if (empty($FIT['dark']) && function_exists(__NAMESPACE__ . '\\diploma_theme_on_light')) {
        $T = diploma_theme_on_light($T);
    }

    $isIntl   = ($c['type'] ?? '') === 'international';
    $typeGenM = $isIntl ? 'международного' : 'всероссийского';   // род. падеж
    $compType = ($isIntl ? 'Международный' : 'Всероссийский') . ' многожанровый конкурс';
    $compName = mb_strtoupper(trim((string)($c['name'] ?? '')) ?: 'НАЗВАНИЕ КОНКУРСА');
    $extra    = trim((string)($a['extra_diploma'] ?? ''));
    // Основной диплом: степень = аттестационный результат (ГРАН-ПРИ/ЛАУРЕАТ/…).
    // Дополнительный диплом ($isExtra): степень = спецноминация (ЗА АРТИСТИЗМ и т.п.).
    $degree   = $isExtra
        /* НОМИНАЦИЮ ДЛЯ ДОПОЛНИТЕЛЬНОГО ДИПЛОМА НЕ ВЫДУМЫВАЕМ.
         *
         * Здесь стояла заглушка «ЗА ТВОРЧЕСКИЕ ДОСТИЖЕНИЯ» на случай пустого поля.
         * Она и сработала у Самойлова: дополнительный диплом ему присудили по
         * ОДНОЙ заявке («за искренность исполнения»), а заказ он оформил по
         * ДРУГОЙ, где ничего не присуждали, — и бланк вышел с наградой, которой
         * жюри не давало. Такой документ участник понесёт в портфолио, а центр
         * не сможет подтвердить его ни протоколом, ни проверкой подлинности.
         *
         * Пусто — печатаем аттестационный результат заявки: он есть всегда и он
         * правдив. Заказ такой позиции сервер больше не принимает (api/v1/order.php),
         * так что пустое поле остаётся только у прежних заказов. */
        ? (mb_strtoupper($extra) ?: _dh_degree_roman(mb_strtoupper(trim((string)($a['result'] ?? '')))))
        : _dh_degree_roman(mb_strtoupper(trim((string)($a['result'] ?? ''))) ?: 'ЛАУРЕАТ I СТЕПЕНИ');
    $dtype    = $thanks ? 'БЛАГОДАРНОСТЬ' : 'ДИПЛОМ';
    // НАГРАЖДАЕМЫЙ на дипломе:
    //  • коллектив/ансамбль (is_group=1 или формация ансамбль/хор) → НАЗВАНИЕ КОЛЛЕКТИВА
    //    (не ФИО того, кто подал заявку от коллектива!);
    //  • благодарность педагогу ($thanks) → ФИО преподавателя;
    //  • соло → ФИО участника (full_name).
    $fullName  = trim((string)($a['full_name'] ?? ''));
    $groupName = trim((string)($a['group_name'] ?? ''));
    $isGroup   = ((int)($a['is_group'] ?? 0) === 1)
        || in_array(mb_strtolower(trim((string)($a['formation'] ?? ''))), ['ансамбль','хор','коллектив','ensemble','choir'], true);
    if ($thanks) {
        // Благодарность — строго ОДНОМУ педагогу. Явно переданное ФИО (из заказа)
        // имеет приоритет; иначе берём одного педагога из заявки, а не весь список.
        $person = trim((string) ($opt['person'] ?? ''));
        if ($person === '') {
            $raw = trim((string) ($a['teacher'] ?? ''));
            $person = $raw !== '' ? _dh_one_person($raw, (int) ($opt['person_idx'] ?? 0)) : '';
        }
        $name = ($person ?: $fullName) ?: 'Иванов Иван Иванович';
    } elseif ($named) {
        /* Именной диплом участника в составе коллектива — ФИО РЕБЁНКА.
         *
         * Оно приходит из заказа: руководитель вписывает каждого поимённо, и
         * ровно за это платит. Здесь этого чтения не было вовсе — на бланке
         * печаталось название ансамбля, то есть именной ничем не отличался от
         * основного диплома. Заявка остаётся запасным вариантом. */
        $person = trim((string) ($opt['person'] ?? ''));
        $name = ($person !== '' ? $person : ($fullName !== '' ? $fullName : $groupName)) ?: 'Иванов Иван Иванович';
    } elseif ($isGroup && $groupName !== '') {
        $name = $groupName;
    } else {
        $name = $fullName ?: 'Иванов Иван Иванович';
    }
    $year     = date('Y');

    // --- СТРОГАЯ авто-подгонка вёрстки диплома ---
    // Правило владельца: слова НИКОГДА не режутся и текст НИКОГДА не вылезает за лист.
    // Сначала пробуем одну строку максимальным кеглем, не влезло — переносим ПО СЛОВАМ
    // на вторую, не влезло и в две — уменьшаем кегль. Разрядка (letter-spacing) учтена:
    // без неё «ЗА ВИРТУОЗНОЕ ИСПОЛНЕНИЕ» обрезалось на «…ИСПОЛНЕН».
    $AVAIL     = 180.0;   // мм полезной ширины (лист 210 мм минус поля/рамки)
    $degreeBlk = _dh_fit_block($degree, 33.0, 15.0, 0.56, $AVAIL, 4.0, 2);   // ls: .diploma-degree = 4px
    $degreeHtml = $degreeBlk['html'];
    $degreeCss  = $degreeBlk['css'];

    // Награждаемый: коллектив — максимум 2 строки, соло/благодарность — тоже
    // (длинное ФИО лучше перенести, чем ужать до нечитаемого).
    // 4 слова — порог переноса: ФИО (Фамилия Имя Отчество) остаётся в одну строку,
    // длинное название коллектива переносится на вторую.
    $nameBlk  = _dh_fit_block($name, 29.0, 14.0, 0.56, $AVAIL, 0.0, 2, 4);
    $nameHtml = $nameBlk['html'];
    $nameCss  = $nameBlk['css'];

    // Номер диплома + QR-код проверки подлинности (правый нижний угол).
    // ЖЁСТКОЕ ПРАВИЛО: номер есть ВСЕГДА на всех типах (осн/доп/именной/благодарность),
    // и на электронном, и на оригинале. Номер печатается независимо от QR.
    $dipNumber = trim((string)($opt['number'] ?? ($a['number'] ?? '')));
    if ($dipNumber === '') {
        // страховка: номер не должен быть пустым НИКОГДА
        $seed = (string)($a['id'] ?? '') . '|' . $name . '|' . $dtype . '|' . ($isExtra ? 'E' : ($thanks ? 'T' : ($named ? 'N' : 'M')));
        $dipNumber = 'MM-' . date('Y') . '-' . strtoupper(substr(md5($seed), 0, 6));
    }
    $qrSvg = '';
    if (!function_exists('qr_svg') && is_file(BASE_PATH . '/core/qr.php')) require_once BASE_PATH . '/core/qr.php';
    if (function_exists('qr_svg')) {
        $verifyUrl = $base . '/verify/' . rawurlencode($dipNumber);
        try { $qrSvg = qr_svg($verifyUrl); } catch (\Throwable $e) { $qrSvg = ''; }
    }

    /* Поля: в образце — все строки эталона с плейсхолдерами (шаблон 1:1),
     * в боевом дипломе — только заполненные из заявки. */
    if ($sample && !$thanks) {
        $fields = [
            'Название коллектива'   => 'указать название коллектива (если есть)',
            'Возрастная категория'  => '00-00 лет',
            'Номинация'             => 'указать вашу номинацию',
            'Педагог'               => 'Иванов Иван Иванович',
            'Название учреждения'   => 'указать ваше учреждение',
            'Страна, город'         => 'Россия, г. Москва',
            'Конкурсный номер'      => 'Указать название вашего конкурсного номера',
        ];
    } else {
        $fields = [];
        // Всё строго по заявке. Контактное лицо (full_name) на диплом НЕ выносится —
        // это тот, кто заполнял заявку, а не участник/руководитель/педагог.
        // «Название коллектива» показываем отдельной строкой только если оно НЕ вынесено
        // в главную строку награждаемого (для соло/благодарности/именного).
        if (!empty($a['group_name']) && $name !== $a['group_name']) $fields['Название коллектива'] = $a['group_name'];
        if (!empty($a['age_category'])) $fields['Возрастная категория'] = $a['age_category'];
        if (!empty($a['nomination']))   $fields['Номинация'] = $a['nomination'];
        /* Наставники с должностями: «Педагог: …», «Концертмейстер: …» отдельными
         * строками. Раньше здесь стояла одна строка «Педагог(и)» на всех, и
         * концертмейстер с руководителем коллектива печатались педагогами —
         * документ, по которому человек потом отчитывается на работе. Заявки без
         * должностей (все, поданные до этой правки) выводятся как прежде. */
        /* САМ СЕБЕ ПЕДАГОГ — СТРОКИ «ПЕДАГОГ» НЕ БУДЕТ.
         *
         * Взрослые солисты подают заявку за себя и в поле педагога пишут своё же
         * имя: по базе таких пятнадцать. На бланке выходило «награждается: Голенева
         * Олеся Сергеевна», а ниже «Педагог: Голенева Олеся Сергеевна» — то же имя
         * дважды, читается как ошибка центра. Для благодарности это не касается:
         * там награждаемый и есть педагог, и строки «Педагог» в ней нет вовсе. */
        $teacherRaw = trim((string) ($a['teacher'] ?? ''));
        $sameAsName = $teacherRaw !== ''
            && mb_strtolower(preg_replace('~\s+~u', ' ', $teacherRaw) ?? $teacherRaw)
               === mb_strtolower(preg_replace('~\s+~u', ' ', $name) ?? $name);
        if ($teacherRaw !== '' && !$sameAsName) {
            if (!function_exists('mentors_doc_lines')) require_once BASE_PATH . '/core/mentors.php';
            $lines = mentors_doc_lines($teacherRaw);
            if ($lines) {
                foreach ($lines as $label => $val) if (trim($val) !== '') $fields[$label] = $val;
            } else {
                [$tLabel, $tVal] = _dh_teachers($teacherRaw);
                if ($tVal !== '') $fields[$tLabel] = $tVal;
            }
        }
        /* УЧРЕЖДЕНИЕ И ГОРОД — РАЗНЫЕ СТРОКИ.
         *
         * Город приклеивался к названию учреждения, и в графе «Название
         * учреждения» оказывалось «МБУК «Ялтинская централизованная клубная
         * система»… , Россия, пгт Гурзуф»: полторы строки названия плюс адрес,
         * которому там не место. Правило владельца: страна и город идут своей
         * строкой сразу после учреждения. */
        if (!function_exists('country_city_line') && is_file(BASE_PATH . '/core/text_format.php'))
            require_once BASE_PATH . '/core/text_format.php';
        /* Город из названия убираем, чтобы он не стоял дважды — здесь и строкой
         * ниже. Режется только служебный хвост («…"ДМШ 14" г. Самара»); имя в
         * кавычках и прилагательное («Волгоградская консерватория») остаются как
         * есть — это официальное наименование. */
        if (!empty($a['institution'])) {
            $fields['Название учреждения'] = function_exists('institution_clean_city')
                ? institution_clean_city((string) $a['institution'], (string) ($a['city'] ?? ''))
                : trim((string) $a['institution']);
        }
        if (!empty($a['city'])) {
            $cc = function_exists('country_city_line')
                ? country_city_line((string) $a['city'])
                : trim((string) $a['city']);
            if ($cc !== '') $fields['Страна, город'] = $cc;
        }
        if (!empty($a['work_title']))   $fields['Конкурсный номер'] = $a['work_title'];
    }

    /* Авто-сжатие блока полей: реальные данные бывают длиннее плейсхолдеров
     * (двойные преподаватели, длинные коллективы). Оцениваем число строк при
     * 12.5pt (~58 символов в строке) и пропорционально уменьшаем кегль,
     * чтобы поля гарантированно не доставали до блока подписей. */
    $fldLines = 0;
    foreach ($fields as $fk => $fv) {
        $fldLines += max(1, (int)ceil(mb_strlen($fk . ': ' . $fv) / 58));
    }
    /* Плотный режим вёрстки: длинная заявка или бланк, у которого подписи стоят
     * высоко (sig_reserve) - там свободного места между данными и подписями
     * почти нет, и обычный ритм строк упирался в фамилию председателя. */
    $TIGHT = ($fldLines > 6) || !empty($FIT['sig_reserve']);
    /* ЕДИНЫЙ ШАГ ОТСТУПОВ. Раньше у каждой строки листа был свой отступ,
     * набранный на глаз (1.5, 2, 2.4, 3, 3.8 мм), и промежутки между блоками
     * шли вразнобой - лист читался как собранный из кусков. Теперь все
     * вертикальные интервалы кратны одному шагу, а на тесном бланке шаг просто
     * меньше: ритм сохраняется, содержимое умещается. */
    $U = $TIGHT ? 1.7 : 2.4;
    $u = static fn(float $k): string => (string) round($U * $k, 2);
    $fldFs = 13.5; $fldLh = 1.62;
    if ($fldLines > 6) {
        $fldFs = max(10.0, round(13.5 * 6 / $fldLines, 1));
        $fldLh = 1.45;
    }

    // Текст благодарности — эталон, с подстановкой конкурса.
    $gratitude = 'Культурный центр «Музыкальный Мир» и оргкомитет ' . $typeGenM
        . ' многожанрового конкурса культуры и искусства «' . trim((string)($c['name'] ?? 'Название конкурса'))
        . '» при информационной поддержке Министерства культуры и образования субъектов Российской'
        . ' Федерации и государственного портала «Pro Культура» выражает Вам благодарность за высокий'
        . ' профессионализм и индивидуальный подход к раскрытию творческого потенциала Ваших учеников,'
        . ' а так же за целеустремлённость и деятельность по приобщению творческих поколений к культуре'
        /* «В международных культурных мероприятиях» — правка владельца: конкурсы
         * центра всероссийские, и обещать педагогу международный статус в
         * наградном документе нельзя. Формулировка заменена на «в мероприятиях
         * культуры и искусства». */
        . ' и искусству, посредством участия в мероприятиях культуры и искусства.';

    $roleChairman = 'Лауреат международных и всероссийских конкурсов и фестивалей, председатель'
        . ' оргкомитета ' . $typeGenM . ' конкурса культуры и искусства «'
        . trim((string)($c['name'] ?? 'Название конкурса')) . '»';
    $roleDirector = 'Лауреат международных и всероссийских конкурсов и фестивалей, заслуженный'
        . ' деятель культуры, генеральный директор Культурного центра «Музыкальный Мир»';

    /* РЕГАЛИИ ПОДПИСАНТОВ — РОВНО ЧЕТЫРЕ СТРОКИ.
     *
     * Кегль был задан одним числом на все бланки, а ширина колонки под текст у
     * каждого фона своя: чем шире рамка, тем уже колонка. На «Наследии России»
     * регалии разъезжались на пять строк, блок подписей вырастал и садился на
     * нижний орнамент. Считаем фактическую ширину колонки и подбираем кегль так,
     * чтобы обе подписи уложились в четыре строки - тогда низ листа сходится на
     * любом фоне. */
    $sigTextW = (210.0 - ($FIT['pad_left_bot'] ?? $FIT['pad_left']) - ($FIT['pad_right_bot'] ?? $FIT['pad_right']))
              - 82.0 * $CSCALE - 4.0 /* промежуток сетки */ - 2.0 /* поле справа у текста */;
    $sigTextW = max(30.0, $sigTextW);
    $SIG_FS = min(
        _dh_fit_lines($roleChairman, $sigTextW, 8.1, 5.9, 4),
        _dh_fit_lines($roleDirector, $sigTextW, 8.1, 5.9, 4)
    );
    /* Фамилии подписантов - строго в одну строку: «Галиулин Данил / Дамирович»
     * на наградном документе выглядит опечаткой. */
    $SIGN_FS = min(
        _dh_fit_lines('Галиулин Данил Дамирович', $sigTextW, 10.0, 7.6, 1),
        _dh_fit_lines('Ильясов Альберт Ильясович', $sigTextW, 10.0, 7.6, 1)
    );
    /* Место и год - тоже одной строкой; справа от них стоит номер бланка с QR,
     * поэтому мерим по ширине за вычетом его поля. */
    $bottomW = 210.0 - ($FIT['pad_left_bot'] ?? $FIT['pad_left']) - ($FIT['pad_right_bot'] ?? $FIT['pad_right']);
    $CITY_FS = _dh_fit_lines('Российская Федерация, город Москва - ' . date('Y'),
                             max(40.0, $bottomW - 24.0), 12.0, 9.0, 1);

    /* НИКАКИХ ОБВОДОК И ТЁМНЫХ ОРЕОЛОВ вокруг названия и звания: пробовали -
     * буквы обрастали грязным контуром и выглядели хуже, чем без него. Две
     * главные строки различаются ЦВЕТОМ, а не тенью. На тёмном фоне остаётся
     * только лёгкая тень для читаемости, на светлой бумаге - ничего. */
    $HALO_C = 'none';
    $HALO_D = 'none';

    $E = static fn(string $k) => _dh_cfg($tpl, $k);
    $D = static fn(string $k) => $edit ? ' data-el="' . $k . '"' : '';

    ob_start(); ?>
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<!-- Фиксированный «печатный» вьюпорт: телефон сам масштабирует лист A4 целиком -->
<meta name="viewport" content="width=834">
<title><?= h($dtype) ?> — <?= h($compName) ?></title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800;900&family=Manrope:wght@400;500;600;700;800&family=Marck+Script<?= $T['fonts'] !== '' ? '&family=' . $T['fonts'] : '' ?><?= ($T['script_font'] ?? '') !== '' && $T['script_font'] !== 'Marck+Script' ? '&family=' . $T['script_font'] : '' ?>&display=swap" rel="stylesheet">
<style>
/* ===== 1:1 из эталона diplom_laureat2.html / blagodarnost1.html ===== */
*{box-sizing:border-box;margin:0;padding:0}
@page{size:A4 portrait;margin:0}
body{background:#444;font-family:'Manrope',sans-serif;padding:20px;min-height:100vh}
.diploma{width:210mm;height:297mm;margin:0 auto;position:relative;overflow:hidden;color:#fff;box-shadow:0 20px 60px rgba(0,0,0,.5)}
.bg-layer{position:absolute;inset:0;z-index:1;
  <?php if ($bgUrl): ?>background:url('<?= h($bgUrl) ?>') center/cover no-repeat;
  <?php else: ?>background:radial-gradient(ellipse at 50% 15%, rgba(40,70,130,.5) 0%, transparent 55%),linear-gradient(180deg,#0d1428 0%,#0a0f1f 40%,#0d1428 100%);<?php endif; ?>}
/* Тонирование фото-фона (в эталоне на градиенте его нет; регулируется в редакторе) */
<?php if ($overlay > 0 || $edit): ?>
.bg-tone{position:absolute;inset:0;z-index:1;pointer-events:none;
  background:linear-gradient(180deg, rgba(8,12,28,<?= number_format($overlay/100*.68,2,'.','') ?>) 0%, rgba(8,12,28,<?= number_format($overlay/100*.52,2,'.','') ?>) 45%, rgba(8,12,28,<?= number_format($overlay/100*.34,2,'.','') ?>) 65%, rgba(8,12,28,<?= number_format($overlay/100*.14,2,'.','') ?>) 78%, rgba(8,12,28,0) 88%)}
<?php endif; ?>
/* Засвет снизу: длинное мягкое растворение кверху, без белого «блока» */
.bg-white-gradient{position:absolute;bottom:0;left:0;right:0;height:<?= $fade ?>mm;z-index:2;pointer-events:none;
  background:linear-gradient(180deg, transparent 0%, rgba(248,248,252,.05) 16%, rgba(250,250,253,.16) 34%, rgba(252,252,254,.36) 52%, rgba(253,253,255,.62) 70%, rgba(255,255,255,.85) 86%, rgba(255,255,255,.95) 100%)}
/* СОДЕРЖИМОЕ СЖИМАЕТСЯ ПОД БЕЗОПАСНУЮ ЗОНУ.
   Лист свёрстан под поля в двенадцать миллиметров. Когда рамка фона требует
   поля шире, та же вёрстка в узкой колонке начинает переносить строки и
   наезжать на подписи. Поэтому всё содержимое пропорционально уменьшается во
   столько же раз, во сколько сузилась колонка: пропорции и воздух остаются
   прежними, а текст целиком помещается внутрь рисованной рамки. */
.content{position:relative;z-index:3;height:100%;--u:<?= $U ?>mm;
  /* Боковые поля ОДИНАКОВЫЕ с двух сторон - берём большее из замеренных.
     Автоподбор часто даёт слева и справа разные значения (рисунок рамки не
     идеально симметричен), и тогда каждая центрированная строка стояла со
     сдвигом: лист выглядел криво собранным. */
  padding:<?= $FIT['pad_top'] ?>mm <?= $PAD_X ?>mm <?= round(($FIT['pad_bottom'] + 56 + ($FIT['sig_reserve'] ?? 0)) / max(0.01, $CSCALE), 1) ?>mm <?= $PAD_X ?>mm;
  transform:scale(<?= $CSCALE ?>);transform-origin:top center}
/* Реквизиты и строка поддержки выходят за поля основного текста: вверху листа
   рамка тоньше, места больше, а в узкой колонке эти длинные строки рвались на
   куски посреди слова. Небольшой отрицательный отступ даёт им нужную ширину. */
.header-legal{text-align:center;font-size:6.9pt;line-height:1.34;color:<?= $FIT['muted_top'] ?? $FIT['muted'] ?>;
  margin:0 -<?= max(0, round($PAD_X - 9, 1)) ?>mm calc(var(--u) * 1) -<?= max(0, round($PAD_X - 9, 1)) ?>mm}
.header-legal .org-name{font-family:'Playfair Display',serif;font-size:19pt;font-weight:900;margin-bottom:2mm;color:<?= $FIT['ink_top'] ?? $FIT['ink'] ?>}
.header-legal .legal-text{font-weight:600;color:<?= $FIT['muted_top'] ?? $FIT['muted'] ?>}
/* Ряд логотипов: светлые версии для тёмных фонов, выровнены по центру */
/* Гербы выравниваем по центру равными промежутками: при распределении по краям
   крайние эмблемы прижимались к рамке и ряд выглядел кривым. */
.logos-row{display:flex;justify-content:center;align-items:center;gap:<?= round(4.5 * $CSCALE, 1) ?>mm;
  margin-bottom:calc(var(--u) * 1);padding:0}
.logos-row .logo{width:auto}
.logos-row .logo-prok{height:16mm}
.logos-row .logo-medal{height:21mm}
.logos-row .logo-natsproekty{height:19mm}
.logos-row .logo-center{height:36mm;flex-shrink:0;margin:0 2mm}
.competition-type{text-align:center;font-family:'Playfair Display',serif;font-size:15.5pt;font-weight:800;color:<?= $FIT['ink'] ?>;margin-bottom:calc(var(--u) * 1)}
/* НАЗВАНИЕ КОНКУРСА И ЗВАНИЕ — ДВЕ ГЛАВНЫЕ СТРОКИ ДОКУМЕНТА.
   Они набраны заливкой-градиентом, и на пёстром фоне их края растворялись: лист
   читался как ровный текст без выделенных строк. Тонкий цветной контур (двойная
   тень нулевого смещения — при заливке текста градиентом обычная обводка
   -webkit-text-stroke закрывает саму заливку) отделяет буквы от рисунка. Цвет
   контура у названия и у звания РАЗНЫЙ и взят из палитры конкурса: две строки
   перекликаются, но их не спутать. */
/* НАЗВАНИЕ КОНКУРСА — ГЛАВНАЯ СТРОКА ЛИСТА.
   Оно набиралось тем же весом, что и служебные строки вокруг, и на пёстром
   фоне терялось: человек искал глазами, на каком конкурсе он победил. Кегль
   поднят, разрядка чуть шире, а вместо размытой тени — тонкая светлая
   подложка-рельеф под буквами: она отделяет их от орнамента, не пачкая
   контуром (тёмные ореолы владелец забраковал отдельно). */
.competition-name{text-align:center;font-family:<?= $T['ff_comp'] ?>;font-size:<?= $COMP_FS ?>pt;font-weight:900;
  text-shadow:<?= $T['sh_comp'] ?? 'none' ?>;
  background:<?= $T['grad_comp'] ?>;
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
  letter-spacing:<?= $lsPx ?>px;margin-bottom:calc(var(--u) * 1);line-height:1.04;
  filter:<?= $HALO_C ?>}
.support-line{text-align:center;font-family:'Playfair Display',serif;font-size:10.2pt;font-weight:700;
  line-height:1.28;margin:0 -<?= max(0, round($PAD_X - 11, 1)) ?>mm var(--u) -<?= max(0, round($PAD_X - 11, 1)) ?>mm;
  padding:0;color:<?= $FIT['muted'] ?>}
.diploma-type{text-align:center;font-family:<?= $T['ff_comp'] ?>;font-size:<?= $thanks ? 48 : 58 ?>pt;font-weight:900;
  background:<?= $T['grad_dtype'] ?>;
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
  letter-spacing:5px;margin-bottom:var(--u);line-height:1}
/* Цифры — только «прописные» (lining): в антиквах тем цифры по умолчанию
   старостильные, и «1 СТЕПЕНИ» печаталось крошечной единицей. */
.diploma-degree,.awarded-name,.awarded-name-script,.field-list,.diploma-type{
  font-variant-numeric:lining-nums;font-feature-settings:"lnum" 1,"onum" 0}
/* ЗВАНИЕ — ВТОРАЯ ПО ВАЖНОСТИ СТРОКА. Её читают сразу после названия конкурса,
   и она же попадает в кадр, когда диплом фотографируют для соцсетей. */
.diploma-degree{text-align:center;font-family:<?= $T['ff_degree'] ?? $T['ff_comp'] ?>;
  font-size:<?= round(40 * $CSCALE, 1) ?>pt;font-weight:900;
  letter-spacing:<?= $T['ls_degree'] ?? '2px' ?>;text-shadow:<?= $T['sh_comp'] ?? 'none' ?>;
  background:<?= $T['grad_degree'] ?>;
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
  /* Звание отодвинуто от слова ДИПЛОМ и придвинуто к «награждается»: раньше оно
     висело ровно посередине между ними, и связка «звание - кому» разрывалась. */
  letter-spacing:4px;margin-top:calc(var(--u) * 1);
  margin-bottom:calc(var(--u) * 1);filter:<?= $HALO_D ?>;line-height:1}
.extra-award{text-align:center;font-family:'Playfair Display',serif;font-size:14.5pt;font-weight:800;color:<?= $T['name_color'] ?>;margin:-1.5mm 0 2.5mm}
.awarded-label{text-align:center;font-family:'Playfair Display',serif;font-size:15pt;font-weight:700;color:<?= $FIT['ink'] ?>;margin-bottom:var(--u)}
.awarded-name{text-align:center;font-family:<?= $T['ff_name'] ?>;font-size:<?= round(31 * $CSCALE, 1) ?>pt;
    font-weight:900;color:<?= $T['name_color'] ?>;margin-bottom:var(--u);
  letter-spacing:<?= $T['ls_name'] ?? '0' ?>;
  filter:<?= $FIT['dark'] ? 'none' : 'drop-shadow(0 1px 1px rgba(255,255,255,.6))' ?>}
.awarded-name-script{text-align:center;font-family:<?= $T['ff_script'] ?>;font-size:<?= $T['script_fs'] ?>pt;color:<?= $T['script_color'] ?>;margin-bottom:3mm;line-height:1}
.field-list{padding:0 2mm;font-family:'Playfair Display',serif;font-size:<?= $fldFs ?>pt;font-weight:700;
  /* Поля заявки идут ровным ритмом, а не слипшимся столбиком: свободного места
     между данными и подписями хватает, и лист выглядит собранным. Длинная
     заявка (много полей, длинные названия) автоматически идёт плотнее. */
  /* Плотнее там, где места мало: длинная заявка или бланк, у которого подписи
     стоят высоко (sig_reserve). Иначе поля упирались в строку с фамилией
     председателя. */
  line-height:<?= $TIGHT ? 1.34 : $fldLh ?>;text-align:center}
.field-list .field{color:<?= $FIT['ink'] ?>;filter:<?= $FIT['shadow'] ?>}
/* Текст благодарности сжат так, чтобы гарантированно не доставать до подписей */
.gratitude-text{padding:0 7mm;font-family:'Playfair Display',serif;font-size:11.5pt;font-weight:700;line-height:1.42;text-align:center;color:<?= $FIT['ink'] ?>;filter:<?= $FIT['shadow'] ?>}
/* Подписи прижаты ниже и собраны компактнее: регалии набираются в ТРИ строки
 * вместо четырёх, межстрочный интервал и промежуток между двумя подписями меньше.
 * Это освобождает ~14 мм по вертикали — длинная заявка (много полей, длинные
 * названия) больше не упирается в подписи и печати. */
/* Подписи и печать вписываются в ту же рамку, что и текст. Масштабировать этот
   блок нельзя: внутри него печать и подпись стоят на своих местах, а сжатие
   сдвигает их относительно сетки - поэтому вместо scale уменьшается кегль. */
/* Подписи и печать лежат на белой подсветке внизу листа, поэтому цвет у них
   всегда тёмный - на тёмном фоне светлые буквы на белом просто пропадали. */
.bottom-block{position:absolute;z-index:4;color:#1a1a2a;
  bottom:<?= $FIT['pad_bottom'] ?>mm;
  left:<?= $PAD_X_BOT ?>mm;
  right:<?= $PAD_X_BOT ?>mm;
  font-size:<?= round(100 * $CSCALE) ?>%}
.signatures-grid{display:grid;grid-template-columns:1fr <?= round(82 * $CSCALE) ?>mm;
  grid-template-rows:auto auto;gap:2.5mm 4mm;align-items:center}
.sig-text-block{font-family:'Manrope',sans-serif;font-size:<?= $SIG_FS ?>pt;line-height:1.18;padding-right:2mm}
.sig-text-block .sig-name{font-weight:800;text-decoration:underline;margin-bottom:.6mm;color:#1a1a2a;font-size:<?= $SIGN_FS ?>pt;white-space:nowrap}
.sig-text-block .sig-role{font-weight:600;color:#1a1a2a}
.sig-visual-block{display:grid;grid-template-columns:1fr auto;gap:2mm;align-items:center;position:relative;height:100%}
/* ПОЛОСКА ПОД РОСПИСЬЮ — как в бумажных документах.
   Роспись висела в воздухе: ни линии, ни опоры, и на печати это читалось как
   случайный росчерк на листе. Тонкая черта — привычный знак того, что документ
   подписан, и она же выравнивает обе подписи по одной высоте. Цвет чернильный
   и полупрозрачный: линия не должна спорить с самой росписью. */
.sig-line{position:absolute;right:0;bottom:3.5mm;width:48mm;height:0;z-index:1;
  border-bottom:.25mm solid rgba(26,26,42,.42)}
/* ШТАМП ОСТАЁТСЯ ВНУТРИ СВОЕЙ СТРОКИ.
   Он поднимался над строкой подписей и садился на данные участника: у «Высшей
   лиги» перекрывал «Конкурсный номер» — название номера читалось сквозь печать.
   Резерв в отступах эту беду не лечит: текст течёт сверху вниз и просто доходит
   до подписей. Лечится источник — штамп больше не выходит за свою клетку, а его
   размер уменьшен ровно настолько, чтобы поместиться вместе с круглой печатью. */
.chairman-stamp{width:auto;max-width:52mm;max-height:15mm;display:block;justify-self:end;transform:translateY(0)}
/* КРУГЛАЯ ПЕЧАТЬ - СЛЕВА, РОСПИСЬ - СПРАВА (как в бумажном документе и как
   стоит штамп председателя строкой выше). В потоке печать вылезала за свою
   колонку и накрывала регалии, а роспись оказывалась левее оттиска - порядок
   читался наоборот. Печать выведена из потока и прижата к левому краю блока
   подписи, роспись остаётся справа от неё. */
.big-seal{position:absolute;left:1mm;top:50%;transform:translateY(-42%);
  width:31mm;height:auto;opacity:.92;z-index:2;pointer-events:none}
/* Росписи увеличены в 1.8 раза через scale — позиция не сдвигается */
.sig-signature-1{width:26mm;height:auto;display:block;transform:scale(1.8);transform-origin:center right}
/* Роспись генерального директора держится правого края своей клетки:
   при большем увеличении она наползала на круглую печать слева. */
.sig-signature-2{width:26mm;height:auto;display:block;justify-self:end;
  transform:scale(1.15);transform-origin:center right}
/* Справа внизу стоит номер бланка с QR, поэтому строке места и года оставляем
   под него поле: без этого она заезжала под номер и обе надписи сливались. */
.footer-city{text-align:center;margin-top:2.5mm;font-family:'Playfair Display',serif;font-size:<?= $CITY_FS ?>pt;
  font-weight:700;color:#1a1a2a;padding:0 24mm;white-space:nowrap}
/* Номер диплома + QR проверки подлинности — правый нижний угол. */
/* Номер с QR стоит в самом углу листа, а не по полям текста: он служебный,
   его место - край документа. По полям он уезжал к середине и вверх, и угол
   выглядел пустым. */
/* Номер держится правого нижнего угла, но не опускается ниже блока подписей:
   у «Высшей лиги» внизу тёмный мраморный пьедестал, и в самом углу номер на нём
   пропадал. */
/* НОМЕР И QR — ВСЕГДА В ОДНОМ И ТОМ ЖЕ МЕСТЕ.
   Высота отсчитывалась от полей конкретного бланка, и служебный угол гулял:
   у «Высшей лиги» номер уезжал на треть листа вверх, у «Мира звёзд» лежал у
   самого края. На документах одного центра это должно быть одно место — правый
   нижний угол, — иначе бланки выглядят собранными разными людьми. Читаемость
   держит собственная подложка (.plate), а не поиск светлого пятна на фоне. */
.dip-verify{position:absolute;right:10mm;bottom:10mm;z-index:6;display:flex;flex-direction:column;align-items:center;gap:.7mm}
.dip-verify .qr{width:15mm;height:15mm;background:#fff;padding:1mm;border-radius:1.5mm;box-shadow:0 1px 4px rgba(0,0,0,.25)}
.dip-verify .qr svg{width:100%;height:100%;display:block}
/* НОМЕР ЧИТАЕТСЯ НА ЛЮБОМ ФОНЕ.
   Он стоит в углу листа, а угол у каждого бланка свой: у «Наследия России» там
   плотный золотой орнамент, у «На волне искусства» — завиток рамки. Тёмные буквы
   тонули в узоре, и номер — единственное, по чему документ проверяют в реестре, —
   переставал читаться. Кладём его на собственную светлую подложку: она заметно
   меньше QR и не спорит с бланком, но узор из-под букв убирает. */
.dip-verify .plate{background:rgba(255,255,255,.93);border-radius:1.2mm;padding:.7mm 1.6mm;
  box-shadow:0 1px 3px rgba(0,0,0,.18);display:flex;flex-direction:column;align-items:center;gap:.2mm}
.dip-verify .num{font-family:'Manrope',sans-serif;font-size:7pt;font-weight:800;letter-spacing:.3px;color:#1a1a2a}
.dip-verify .lbl{font-family:'Manrope',sans-serif;font-size:5.6pt;font-weight:600;text-transform:uppercase;letter-spacing:.4px;
  color:#3a3a4a}
/* Водяной знак «ОБРАЗЕЦ» повторяется ПО ВСЕМУ ПОЛЮ диплома (перекрёстно, по диагонали). */
.sample-mark{position:absolute;inset:-20%;z-index:9;pointer-events:none;overflow:hidden;
  display:flex;flex-wrap:wrap;align-content:center;justify-content:center;gap:9mm 18mm;
  transform:rotate(-30deg)}
.sample-mark span{font-family:'Playfair Display',serif;font-weight:900;font-size:26pt;letter-spacing:8px;
  color:rgba(200,40,60,.13);white-space:nowrap;text-transform:uppercase}
/* Рамка «ОБРАЗЕЦ» по всему периметру диплома. */
.sample-frame{position:absolute;inset:5mm;z-index:9;pointer-events:none;border:3px dashed rgba(200,40,60,.28);border-radius:4mm}
<?php if ($edit): ?>[data-el]{cursor:grab}[data-el]:hover{outline:1px dashed rgba(255,215,80,.85)}<?php endif; ?>
@media print{body{background:#fff;padding:0}.diploma{box-shadow:none;margin:0}}
</style>
</head>
<body>
<div class="diploma">
  <div class="bg-layer"></div>
  <?php if ($overlay > 0 || $edit): ?><div class="bg-tone"></div><?php endif; ?>
  <?php /* Белая подсветка снизу нужна только тёмному фону: на светлом она
           выбеливает орнамент и выглядит грязным пятном. */ ?>
  <?php if (!empty($FIT['fade_bottom'])): ?><div class="bg-white-gradient"></div><?php endif; ?>
  <?php if ($sample): ?><div class="sample-frame"></div><div class="sample-mark"><?php for ($si = 0; $si < 60; $si++) echo '<span>ОБРАЗЕЦ</span>'; ?></div><?php endif; ?>

  <div class="content">
    <?php $e = $E('org'); $e2 = $E('legal'); ?>
    <div class="header-legal">
      <div class="org-name"<?= $D('org') . _dh_style($e, 17.0) ?>>Культурный центр «Музыкальный Мир»</div>
      <div class="legal-text"<?= $D('legal') . _dh_style($e2, 7.5) ?>>
        Зарегистрирован в официальном российском федеральном органе исполнительной власти Роскомнадзор от 24.06.2025 №094084<br>
        Конкурс проводится на основании закона "Гражданский кодекс Российской Федерации (часть вторая)" от 26.01.1996<br>
        N 14-ФЗ (ред. от 01.07.2021, с изм. от 08.07.2021) (с изм. и доп., вступ. в силу с 01.01.2022) ГК РФ Глава 57 - публичный конкурс.<br>
        Выполнение указа Президента РФ «Об утверждении Основ государственной культурной политики» № 808 от 24 декабря 2014 года.
      </div>
    </div>

    <?php $e = $E('logos'); ?>
    <?php /* Порядок Даниэля: Про Культура — Минпросвещения — Минкультуры —
             Культурного центра «Музыкальный Мир» (центр) — Союз композиторов — Минобразования —
             Нацпроекты «Культура». Всего 7. */ ?>
    <div class="logos-row"<?= $D('logos') . _dh_style($e) ?>>
      <img class="logo logo-prok" src="<?= $imgDip ?>/logo_prokultura.png" alt="">
      <img class="logo logo-medal" src="<?= $imgDip ?>/logo_minprosvet.png" alt="">
      <img class="logo logo-medal" src="<?= $imgDip ?>/logo_minkult.png" alt="">
      <img class="logo logo-center" src="<?= $imgDip ?>/logo_mm_badge.png" alt="">
      <img class="logo logo-medal" src="<?= $imgDip ?>/logo_soyuzkomp.png" alt="">
      <img class="logo logo-medal" src="<?= $imgDip ?>/logo_minobr.png" alt="">
      <img class="logo logo-natsproekty" src="<?= $imgDip ?>/logo_natsproekty2.png" alt="">
    </div>

    <?php $e = $E('comptype'); ?>
    <div class="competition-type"<?= $D('comptype') . _dh_style($e, 15.0) ?>><?= h($compType) ?></div>
    <?php $e = $E('compname'); ?>
    <div class="competition-name"<?= $D('compname') . _dh_style($e, 30.0) ?>><?= h($compName) ?></div>
    <?php $e = $E('support'); ?>
    <div class="support-line"<?= $D('support') . _dh_style($e, 12.0) ?>>
      При информационной поддержке Министерства культуры и образования<br>
      субъектов Российской Федерации и государственного портала «Pro Культура»
    </div>

    <?php $e = $E('dtype'); ?>
    <div class="diploma-type"<?= $D('dtype') . _dh_style($e, 48.0) ?>><?= h($dtype) ?></div>

    <?php if (!$thanks): ?>
      <?php $e = $E('degree'); ?>
      <div class="diploma-degree"<?= $D('degree') . _dh_style2($e, $degreeCss) ?>><?= $degreeHtml ?></div>
      <?php /* Доп. награда печатается ОТДЕЛЬНЫМ дипломом (diploma_html(...,['extra'=>true])), не строкой здесь. */ ?>

      <?php $e = $E('label'); ?>
      <div class="awarded-label"<?= $D('label') . _dh_style($e, 15.0) ?>>награждается:</div>
      <?php $e = $E('name'); ?>
      <div class="awarded-name"<?= $D('name') . _dh_style2($e, $nameCss) ?>><?= $nameHtml ?></div>

      <?php $e = $E('fields'); ?>
      <div class="field-list"<?= $D('fields') . _dh_style($e, 12.5) ?>>
        <?php foreach ($fields as $k => $v): ?>
          <div class="field"><strong><?= h($k) ?>:</strong> <?= h((string)$v) ?></div>
        <?php endforeach; ?>
      </div>
    <?php else: ?>
      <?php $e = $E('label'); ?>
      <div class="awarded-label"<?= $D('label') . _dh_style($e, 15.0) ?>>награждается:</div>
      <?php $e = $E('name'); ?>
      <?php /* Благодарность — всегда ОДНО ФИО, поэтому и здесь порог переноса 4 слова. */
            $scriptBlk = _dh_fit_block($name, (float) $T['script_fs'], 16.0, 0.5, $AVAIL, 0.0, 2, 4); ?>
      <div class="awarded-name-script"<?= $D('name') . _dh_style2($e, $scriptBlk['css']) ?>><?= $scriptBlk['html'] ?></div>

      <?php $e = $E('fields'); ?>
      <div class="gratitude-text"<?= $D('fields') . _dh_style($e, 11.5) ?>>
        <?= h($gratitude) ?><br><br>
        Желаем Вам творческих успехов, процветания и новых побед!
      </div>
    <?php endif; ?>
  </div>

  <?php $e = $E('bottom'); ?>
  <div class="bottom-block"<?= $D('bottom') . _dh_style($e) ?>>
    <div class="signatures-grid">
      <div class="sig-text-block">
        <div class="sig-name">Галиулин Данил Дамирович</div>
        <div class="sig-role"><?= h($roleChairman) ?></div>
      </div>
      <div class="sig-visual-block">
        <?php if (!$clean): ?>
          <img class="chairman-stamp" src="<?= $imgDip ?>/stamp.png" alt="">
          <img class="sig-signature-1" src="<?= $imgDip ?>/sig1.png" alt="">
        <?php endif; ?>
        <span class="sig-line"></span>
      </div>
      <div class="sig-text-block">
        <div class="sig-name">Ильясов Альберт Ильясович</div>
        <div class="sig-role"><?= h($roleDirector) ?></div>
      </div>
      <div class="sig-visual-block">
        <?php if (!$clean): ?>
          <img class="big-seal" src="<?= $imgDip ?>/seal.png" alt="">
          <img class="sig-signature-2" src="<?= $imgDip ?>/sig2.png" alt="">
        <?php endif; ?>
        <span class="sig-line"></span>
      </div>
    </div>
    <div class="footer-city">Российская Федерация, город Москва - <?= $year ?></div>
  </div>
  <?php /* Номер + QR + «проверка подлинности» — ВСЕГДА (номер даже без QR). */ ?>
  <div class="dip-verify">
    <?php if ($qrSvg !== ''): ?><div class="qr"><?= $qrSvg ?></div><?php endif; ?>
    <div class="plate">
      <div class="num">№ <?= h($dipNumber) ?></div>
      <div class="lbl">проверка подлинности</div>
    </div>
  </div>
</div>
<?php /* НАЗВАНИЕ КОНКУРСА ДОВОДИТСЯ ДО ПОЛНОЙ ШИРИНЫ СТРОКИ.
   PHP считает кегль по средней ширине знака - это оценка, и она намеренно
   осторожная: у одних гарнитур буквы шире, у других уже, и «в притык» строка
   ломалась надвое, а сломанное название сдвигало весь лист на подписи. Здесь
   уже настоящий браузер: когда шрифты загружены, замеряем строку и растим
   кегль, пока она помещается в одну строку. Скрипт не выполнился - остаётся
   безопасный кегль из PHP, лист цел. */ ?>
<script>
(function(){
  var FAM=<?= json_encode((string)($T['fam_comp'] ?? ''), JSON_UNESCAPED_UNICODE) ?>;
  /* Ширину строки меряем диапазоном (Range), а НЕ scrollWidth: у блока с
     text-align:center переполнение уходит в обе стороны, и scrollWidth всегда
     равен clientWidth - проверка «влезло?» была всегда ложной, и название
     оставалось мелким. Range даёт истинную ширину набранного текста. */
  /* Ширину набранной строки меряем НА ОТДЕЛЬНОМ невидимом двойнике.
     Прямые замеры обманывают: scrollWidth у центрированного блока равен
     clientWidth, а Range отдаёт ширину, уже обрезанную рамками контейнера - и
     то и другое показывало «влезает», когда строка выходила за края листа. */
  function fitOne(sel, loPt, hiPt){
    var el=document.querySelector(sel);
    if(!el) return;
    var max=el.clientWidth-2;
    if(max<=0) return;
    el.style.whiteSpace='nowrap';
    var cs=getComputedStyle(el);
    var probe=document.createElement('span');
    probe.textContent=el.textContent;
    probe.style.cssText='position:absolute;left:-99999px;top:0;visibility:hidden;white-space:nowrap;padding:0;margin:0';
    probe.style.fontFamily=cs.fontFamily; probe.style.fontWeight=cs.fontWeight;
    probe.style.fontStyle=cs.fontStyle;   probe.style.letterSpacing=cs.letterSpacing;
    probe.style.textTransform=cs.textTransform;
    document.body.appendChild(probe);
    function textW(fs){ probe.style.fontSize=fs+'pt'; return probe.getBoundingClientRect().width; }
    var lo=loPt, hi=hiPt, best=lo;
    for(var i=0;i<26 && hi-lo>0.1;i++){
      var mid=(lo+hi)/2;
      if(textW(mid)<=max){ best=mid; lo=mid; } else { hi=mid; }
    }
    var fits=textW(best)<=max;
    probe.parentNode.removeChild(probe);
    el.style.fontSize=best.toFixed(1)+'pt';
    if(!fits) el.style.whiteSpace='normal';
  }
  function fitTitle(){
    fitOne('.competition-name', <?= max(18, (int)round($COMP_FS * 0.6)) ?>, <?= (int)round(min(46, max(34, $COMP_FS * 2.6))) ?>);
    /* Звание тоже подгоняется: у дополнительного диплома это не «Лауреат I
       степени», а длинная формулировка вроде «За верность традициям» - при
       жёстком кегле её обрезало краем листа. */
    fitOne('.diploma-degree', 13, <?= round(40 * $CSCALE, 1) ?>);
    /* Слово ДИПЛОМ короткое и всегда влезало, а вот БЛАГОДАРНОСТЬ на бланке с
       узкими полями обрезалась краем листа - подгоняем и её. */
    fitOne('.diploma-type', 22, <?= $thanks ? 48 : 58 ?>);
    /* ФИО в благодарности - рукописной строкой: она бывает длинной («Константинопольская
       Александра Владимировна»), и жёсткий кегль её либо обрезал, либо ронял на две
       строки. Подгоняем по ширине, как название конкурса. */
    fitOne('.awarded-name-script', 13, <?= (float)$T['script_fs'] ?>);
    fitOne('.extra-award', 9, 15);
    /* Раньше ждали шрифт названия ИМЕННО в весе 900. У части тем шрифт
       одновесный (Prata у «Мира звёзд», Yeseva One), 900-начертания нет, и
       проверка не проходила НИКОГДА — уравниватель просветов не запускался, а
       лист уходил с кривым ритмом. Ждём шрифт в его реальном присутствии (без
       привязки к 900); загрузку принудительно доводит document.fonts.load ниже. */
    if(!FAM || !(document.fonts && document.fonts.check) || document.fonts.check('40pt "'+FAM+'"')){
      fitOptical();
      document.documentElement.setAttribute('data-title-fit','1');
    }
  }
  /* Страховка: если детект шрифта так и не сработал (мост/оффлайн-шрифт),
     всё равно выравниваем ритм и снимаем стоп-метку, чтобы бланк не ушёл кривым. */
  function fitForce(){ try{ fitOptical(); }catch(e){} document.documentElement.setAttribute('data-title-fit','1'); }
  /* РОВНЫЙ ЛИСТ - ПО БУКВАМ, А НЕ ПО РАМКАМ БЛОКОВ.
     Раньше выравнивались margin'ы, и по замерам всё сходилось, а глаз видел
     разнобой: у слова ДИПЛОМ в 58 пунктов рамка строки почти совпадает с
     буквами, а у строчки «награждается» в 15 пунктов внутри рамки остаётся
     воздух межстрочного интервала. Поэтому меряем НАСТОЯЩИЕ границы букв
     (canvas: actualBoundingBoxAscent/Descent) и уравниваем просветы между ними.
     Заодно свободное место листа делится на те же просветы поровну, поэтому низ
     не проваливается и лист выглядит собранным. */
  function inkBox(el){
    var r=el.getBoundingClientRect();
    if(el.tagName==='IMG'||el.classList.contains('logos-row')) return {top:r.top, bottom:r.bottom};
    var cs=getComputedStyle(el);
    var cv=inkBox._c||(inkBox._c=document.createElement('canvas')), g=cv.getContext('2d');
    g.font=cs.fontStyle+' '+cs.fontWeight+' '+cs.fontSize+' '+cs.fontFamily;
    var m=g.measureText(el.textContent.trim()||'Ag');
    var fa=m.fontBoundingBoxAscent, fd=m.fontBoundingBoxDescent;
    var aa=m.actualBoundingBoxAscent, ad=m.actualBoundingBoxDescent;
    if(!(fa>0)||!(aa>0)) return {top:r.top, bottom:r.bottom};
    var lh=parseFloat(cs.lineHeight); if(!(lh>0)) lh=r.height;
    /* Базовая линия ПЕРВОЙ строки блока и последней: между ними может быть
       несколько строк, поэтому низ считаем от нижней границы блока. */
    var half=(lh-(fa+fd))/2;
    return {top:r.top+half+(fa-aa), bottom:r.bottom-half-(fd-ad)};
  }
  function fitOptical(){
    var cont=document.querySelector('.content'), bb=document.querySelector('.bottom-block');
    if(!cont||!bb) return;
    var sc=1, mm=getComputedStyle(cont).transform.match(/matrix\(([\d.]+)/); if(mm) sc=parseFloat(mm[1]);
    var PX_MM=document.querySelector('.diploma').getBoundingClientRect().width/210;
    var names=['.header-legal','.logos-row','.competition-type','.competition-name','.support-line',
               '.diploma-type','.diploma-degree','.extra-award','.awarded-label','.awarded-name',
               '.awarded-name-script','.field-list','.gratitude-text'];
    var els=[]; names.forEach(function(n){ var e=cont.querySelector(n); if(e) els.push(e); });
    if(els.length<3) return;
    var last=els[els.length-1], RESERVE=7;   // мм: воздух между данными и подписями

    /* Ставит между всеми блоками ОДИН И ТОТ ЖЕ просвет между буквами (G, мм) и
       возвращает, сколько миллиметров осталось до блока подписей. */
    function applyG(G){
      for(var pass=0; pass<2; pass++){
        var boxes=els.map(inkBox);
        for(var i=0;i<els.length-1;i++){
          var cur=(boxes[i+1].top-boxes[i].bottom)/PX_MM;          // просвет сейчас, мм листа
          var m=parseFloat(getComputedStyle(els[i]).marginBottom)/PX_MM;  // отступ, мм колонки
          /* Отрицательный отступ допустим: у мелкой строки собственный воздух
             межстрочного интервала бывает БОЛЬШЕ нужного просвета, и без минуса
             её нельзя подтянуть к соседям - именно так «награждается» стояло
             ниже остальных строк. Меряем по буквам, поэтому это безопасно. */
          els[i].style.marginBottom=Math.max(-6, m+(G-cur)/Math.max(sc,0.01)).toFixed(2)+'mm';
        }
      }
      return (bb.getBoundingClientRect().top-inkBox(last).bottom)/PX_MM;
    }
    /* Ищем самый крупный просвет, при котором данные ещё не подходят к подписям
       ближе, чем на RESERVE: лист заполняется целиком, но ничего не налезает. */
    var lo=1.0, hi=9.0, best=1.0;
    for(var k=0;k<8;k++){
      var G=(lo+hi)/2;
      if(applyG(G)>=RESERVE){ best=G; lo=G; } else { hi=G; }
    }
    applyG(best);
  }
  if(document.fonts && document.fonts.load && FAM){
    /* Догружаем шрифт названия в РЕАЛЬНОМ присутствии, а не только в 900:
       у одновесных шрифтов (Prata) запрос 900 отдавал пустой набор и ритм не
       доводился. */
    try{ Promise.all([document.fonts.load('40pt "'+FAM+'"'), document.fonts.load('900 40pt "'+FAM+'"').catch(function(){})]).then(fitTitle, fitTitle); }catch(e){}
  }
  if(document.fonts && document.fonts.ready){ document.fonts.ready.then(fitTitle); }
  window.addEventListener('load',fitTitle);
  var tries=0, tick=setInterval(function(){ fitTitle(); if(++tries>24){ clearInterval(tick); if(document.documentElement.getAttribute('data-title-fit')!=='1') fitForce(); } },120);
})();
</script>
</body>
</html>
<?php
    return (string)ob_get_clean();
}

/** Данные для шаблона-образца (плейсхолдеры эталона). */
function diploma_sample_app(): array {
    return ['full_name' => 'Иванов Иван Иванович', 'result' => 'ЛАУРЕАТ 1 СТЕПЕНИ',
            'extra_diploma' => 'ЗА АРТИСТИЗМ'];
}
