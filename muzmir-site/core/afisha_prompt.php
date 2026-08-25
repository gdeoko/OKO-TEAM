<?php
/**
 * ПРОМПТ АФИШИ: ВСЯ АФИША ЦЕЛИКОМ, ВМЕСТЕ С РУССКИМ ТЕКСТОМ.
 *
 * Первая схема отдавала нейросети только фон, а текст клался слоем поверх —
 * из осторожности: кириллица у генераторов традиционно выходит кашей. Живая
 * проверка 25.08.2026 эту осторожность опровергла: ChatGPT нарисовал все девять
 * строк афиши по-русски без единой ошибки, включая «Зарегистрирован в
 * Роскомнадзоре от 24.06.2025 №094084» и «Приём заявок до 25.08.2026».
 *
 * Поэтому решение владельца: генерируем афишу целиком. Единственное, что
 * нейросети НЕ доверяется, — гербы ведомств: двуглавый орёл выходит похожим, но
 * не тем, и афишу с таким орлом нельзя отправить ни в школу, ни в отдел
 * культуры. Вместо них в промпте просится ряд ПУСТЫХ круглых заглушек, а
 * настоящие эмблемы вписываются потом (core/afisha_emblems.php).
 *
 * Промпт строится от НАЗВАНИЯ конкурса: «Мировые Таланты» получает золотой
 * глобус и мировую сцену, «Величие России» — Кремль и триколор. Без этого все
 * афиши года выходят одинаковыми, меняется только надпись.
 */
declare(strict_types=1);

require_once __DIR__ . '/afisha_html.php';   // afisha_terms(), темы

/**
 * Визуальный мир по названию конкурса. Ключи — куски названия в нижнем регистре,
 * порядок важен: первое совпадение выигрывает.
 */
function afisha_scene_for(string $name): string {
    $n = mb_strtolower($name);
    $map = [
        'мир'        => 'a magnificent golden globe wrapped in flowing musical staves and ribbons, surrounded by golden stars and treble clefs, set on a grand theatre stage',
        'росси'      => 'golden silhouettes of the Moscow Kremlin towers and Saint Basil cathedral, flowing russian tricolour ribbons, laurel branches and golden stars',
        'звезд'      => 'a deep cosmic sky filled with golden stars, comets and constellations, luminous golden treble clefs and musical notes drifting through the nebula',
        'вершин'     => 'majestic snow-capped mountain peaks under a luminous sky, golden sunburst behind the summit, flowing silver and gold ribbons',
        'сцен'       => 'a grand opera stage with deep velvet curtains drawn open, golden tassels, polished stage floor and warm spotlights',
        'атлант'     => 'colossal golden atlantes and caryatid statues holding an ornate entablature, classical greek columns and laurel wreaths',
        'профи'      => 'an ornate royal hall with damask wall patterns, golden laurel wreaths and heraldic rosettes, deep burgundy and gold',
        'призван'    => 'a radiant golden spotlight beam falling onto an empty stage, floating golden particles, distant applauding silhouettes',
        'талант'     => 'a golden laurel wreath crowning a luminous stage, cascading golden sparks and musical notes',
        'мастерств'  => 'classical marble columns with acanthus capitals, golden filigree ornament, a laurel wreath and antique lyres',
        'благо'      => 'warm golden light radiating from cupped hands, doves and laurel branches, soft ivory and gold palette',
        'будущ'      => 'a sunrise over a stylised city skyline in gold, rising musical notes and stars, russian tricolour accents',
        'эврика'     => 'a radiant golden sunburst over an aged parchment field, filigree ornament, antique lyres and musical notes',
        'слава'      => 'golden laurel wreaths, heraldic ribbons and star bursts over a deep ceremonial background',
    ];
    foreach ($map as $k => $scene) if (mb_strpos($n, $k) !== false) return $scene;
    return 'a grand ceremonial hall with golden ornament, laurel wreaths, musical notes and warm stage light';
}

/** Палитра под тему оформления — чтобы месяцы отличались не только сценой. */
function afisha_palette_for(array $t): array {
    return match ($t['key'] ?? 'gold') {
        'antique'   => ['Aged ivory parchment #FBF3DF and #E6D5AC', 'antique gold #C9A84C with highlights #E3C87E', 'deep shadow #8D6A1E', 'burgundy ribbon #7C1B21'],
        'stage'     => ['Midnight blue velvet #0F1F47 and #1C3570', 'gold #C9A84C with highlights #F0D98A', 'deep shadow #8A6A24', 'burgundy ribbon #7C1B21'],
        'cosmos'    => ['Deep violet-indigo #150D2E and #2B1A52', 'gold #E9C46A with highlights #F6E1A8', 'deep shadow #7A5A18', 'burgundy ribbon #7C1B21'],
        'russia'    => ['Warm ivory #F7F4EC and #DED5BD', 'gold #9A7A2A with highlights #D8BE72', 'deep shadow #6E5220', 'russian tricolour accents #FFFFFF #0039A6 #D52B1E'],
        'parchment' => ['Cream parchment #FBF3DF and #E6D5AC', 'gold #8D6A1E with highlights #D9BC6A', 'deep shadow #5C4A25', 'burgundy ribbon #7C1B21'],
        default     => ['Deep black-brown #070502 and #2A1C07', 'rich gold #E8C369 with highlights #F7E3A8', 'deep shadow #6B4A10', 'burgundy ribbon #7C1B21'],
    };
}

/**
 * Готовый промпт афиши. Длинный намеренно: короткий даёт «красивую картинку
 * вообще», а нам нужен документ с точными строками и пустыми заглушками.
 */
function afisha_prompt(array $c): string {
    $t     = afisha_theme_for($c);
    $name  = mb_strtoupper(trim((string) ($c['name'] ?? '')), 'UTF-8');
    $kind  = ((string) ($c['type'] ?? '') === 'national' ? 'Всероссийский' : 'Международный')
           . ' многожанровый онлайн-конкурс культуры и искусства';
    $end   = afisha_date((string) ($c['end_date'] ?? ''));
    $res   = afisha_date((string) ($c['results_date'] ?? ''));
    $year  = date('Y', strtotime((string) ($c['start_date'] ?? '')) ?: time());
    $terms = afisha_terms($c);
    $scene = afisha_scene_for((string) ($c['name'] ?? ''));
    $pal   = afisha_palette_for($t);

    $srok = $end !== '' ? ('Приём заявок до ' . $end) : '';
    if ($res !== '')      $srok .= ($srok !== '' ? ' · ' : '') . 'Результаты ' . $res;
    elseif ($srok !== '') $srok .= ' · Результаты в течение 5 рабочих дней';

    return <<<PROMPT
Create a complete, finished, print-ready HORIZONTAL POSTER in 16:9 aspect ratio (1920x1080 or larger), for an official Russian cultural competition. This is a FINAL DESIGN, not a background plate: it must contain real, correctly spelled RUSSIAN (Cyrillic) typography exactly as specified below, rendered crisply and legibly at full size.

THEME AND SUBJECT. The competition is called «{$name}». Build the visual world around that idea: {$scene}. The overall impression must be prestigious, solemn and festive — a state-level arts award, not a commercial advertisement. Rich, deep, layered, luxurious.

EXACT TEXT TO RENDER, in Russian Cyrillic, spelled precisely as given, no invented words, no misspellings, no Latin letters substituted for Cyrillic characters, no extra lines:

Line 1, small, across the very top, light weight, subdued: «Зарегистрирован в Роскомнадзоре от 24.06.2025 №094084 · ГК РФ Глава 57 — публичный конкурс»

Line 2, medium, elegant serif: «Культурный центр «Музыкальный Мир»»

Line 3, small italic serif: «При информационной поддержке Министерства культуры и образования субъектов Российской Федерации»

Line 4, italic serif, slightly larger: «{$kind}»

Line 5, THE MAIN HEADLINE, very large, dominant, centred, in polished three-dimensional gold with a subtle bevel and a soft outer glow, classical serif capitals with generous letter spacing: «{$name}»

Line 6, inside a deep burgundy ribbon banner with a thin gold border, bold white capitals: «{$terms}»

Line 7, bold, clearly readable: «{$srok}»

Line 8, regular weight: «Компетентное жюри · Квалифицированная оценка · Денежные премии»

Line 9, at the very bottom, small: «Российская Федерация, город Москва — {$year} год»

PLACEHOLDERS FOR EMBLEMS — CRITICAL REQUIREMENT. Between line 8 and line 9, place a horizontal row of SIX identical EMPTY CIRCLES, evenly spaced and centred on one line. Each circle is a plain flat disc of soft warm ivory colour with a thin gold ring around it and a gentle drop shadow. The circles must be COMPLETELY EMPTY — no coats of arms, no eagles, no crests, no letters, no numerals, no symbols, no icons, no patterns, no textures of any kind inside them. They are blank placeholders that will be filled later with real state emblems. Each circle roughly 7 percent of the image width in diameter, all six exactly the same size, sitting on the same horizontal line, with clean space around them.

COMPOSITION AND HIERARCHY. Vertical order strictly as listed above, centred on a single axis. The headline «{$name}» occupies the optical centre and is by far the largest element. Generous breathing space around every line — the poster must feel airy and expensive, never crowded. An ornamental double frame runs around the whole poster: an outer thin gold rule and an inner decorative border of classical scrollwork, inset about 2 percent from the edges. Corner ornaments in the four corners.

LIGHT AND MATERIALS. A soft warm key light from above and slightly in front, making the gold elements glow while the outer edges fall into rich shadow. Materials: brushed and polished gold with satin sheen and gentle patina in the recesses, deep velvet with visible soft pile, warm ivory for the placeholder discs. No harsh specular hotspots across the text, no lens flares crossing the headline.

LENS AND RENDERING. As if photographed with an 85mm lens at f/8 — everything in sharp focus, straight-on frontal view, perfectly symmetrical left to right, no perspective distortion, no tilt, no motion blur, no depth-of-field blur on the text.

COLOUR PALETTE, exact values: {$pal[0]}; {$pal[1]}; {$pal[2]}; {$pal[3]}. Warm off-white #F5EEDC for the smaller text lines. Ivory #F6F1E4 for the placeholder discs. Keep everything within this family; no green, no magenta, no neon, no modern gradients.

QUALITY REQUIREMENTS. 8K, ultra sharp, commercial print quality, flawless symmetry, no banding in gradients, no noise, no compression artefacts. Typography must be crisp and perfectly legible at full size — every Cyrillic character correctly formed and correctly spelled, with correct Russian quotation marks « » where shown. No watermarks, no signatures, no photographer credits, no extra text beyond the nine lines specified above.
PROMPT;
}
