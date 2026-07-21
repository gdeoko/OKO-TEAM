<?php
/**
 * templates/site/partials/heatmap.php — тепловая карта регионов по числу участников.
 *
 * Переиспользуемый партиал (только определения функций - подключать через
 * require_once, ничего не печатает сам). Группирует applications.city по
 * федеральным округам простой эвристикой сопоставления города со справочником,
 * рисует самодостаточный inline SVG (соты-«самоцветы» по числу заявок) и
 * подсвечивает топ-города отдельным списком. При пустой базе - нейтральная карта
 * с поясняющей подписью.
 *
 * Подключение на странице:
 *   require_once BASE_PATH . '/templates/site/partials/heatmap.php';
 *   echo render_regions_heatmap();
 */
declare(strict_types=1);

if (!function_exists('hm_city_index')) {

/** Справочник федеральных округов: ключ → [метка, полное имя]. */
function hm_districts(): array {
    return [
        'cfo'  => ['ЦФО', 'Центральный федеральный округ'],
        'szfo' => ['СЗФО', 'Северо-Западный федеральный округ'],
        'yufo' => ['ЮФО', 'Южный федеральный округ'],
        'skfo' => ['СКФО', 'Северо-Кавказский федеральный округ'],
        'pfo'  => ['ПФО', 'Приволжский федеральный округ'],
        'ufo'  => ['УФО', 'Уральский федеральный округ'],
        'sfo'  => ['СФО', 'Сибирский федеральный округ'],
        'dfo'  => ['ДФО', 'Дальневосточный федеральный округ'],
    ];
}

/**
 * Эвристический справочник «город → федеральный округ» (нормализованные ключи:
 * нижний регистр, ё→е). Покрывает крупнейшие города каждого округа - для
 * распределённой по стране аудитории конкурсов этого достаточно для наглядной
 * картины; несопоставленные города попадают в общий счётчик «прочие города».
 */
function hm_city_index(): array {
    $map = [
        'cfo' => ['москва','зеленоград','троицк','белгород','старый оскол','брянск','владимир',
            'ковров','воронеж','иваново','калуга','обнинск','кострома','курск','липецк','елец',
            'орел','рязань','смоленск','тамбов','тверь','тула','новомосковск','ярославль',
            'подольск','химки','балашиха','мытищи','королев','люберцы','одинцово','domodedovo',
            'домодедово','коломна','серпухов','электросталь','ногинск','щелково','пушкино'],
        'szfo' => ['санкт-петербург','питер','спб','петербург','гатчина','выборг','архангельск',
            'северодвинск','вологда','череповец','калининград','мурманск','великий новгород',
            'новгород','псков','петрозаводск','сыктывкар','нарьян-мар'],
        'yufo' => ['ростов-на-дону','ростов','краснодар','сочи','новороссийск','армавир','волгоград',
            'волжский','астрахань','симферополь','севастополь','ялта','элиста','майкоп'],
        'skfo' => ['ставрополь','пятигорск','кисловодск','ессентуки','владикавказ','грозный',
            'махачкала','дербент','нальчик','черкесск','магас','назрань'],
        'pfo' => ['казань','набережные челны','нижнекамск','нижний новгород','дзержинск','арзамас',
            'самара','тольятти','сызрань','уфа','стерлитамак','пермь','березники','саратов',
            'энгельс','оренбург','орск','ижевск','ульяновск','пенза','киров','йошкар-ола',
            'чебоксары','саранск'],
        'ufo' => ['екатеринбург','нижний тагил','каменск-уральский','челябинск','магнитогорск',
            'златоуст','тюмень','тобольск','курган','сургут','нижневартовск','ханты-мансийск',
            'салехард','новый уренгой'],
        'sfo' => ['новосибирск','омск','красноярск','норильск','барнаул','бийск','иркутск',
            'ангарск','братск','кемерово','новокузнецк','томск','абакан','кызыл','горно-алтайск'],
        'dfo' => ['владивосток','находка','уссурийск','хабаровск','комсомольск-на-амуре','якутск',
            'нерюнгри','благовещенск','южно-сахалинск','петропавловск-камчатский','магадан',
            'анадырь','биробиджан','улан-удэ','чита'],
    ];
    $idx = [];
    foreach ($map as $district => $cities) {
        foreach ($cities as $city) $idx[$city] = $district;
    }
    return $idx;
}

/** Нормализация написания города для сопоставления со справочником. */
function hm_normalize_city(string $city): string {
    $c = mb_strtolower(trim($city), 'UTF-8');
    $c = str_replace('ё', 'е', $c);
    $c = preg_replace('/^(г\.?\s*|город\s*|гор\.?\s*)/u', '', $c);
    $c = trim(preg_split('/[,;]/u', $c)[0]);
    $c = preg_replace('/\s+/u', ' ', $c);
    return trim($c);
}

/** Сопоставляет город с ключом федерального округа (или null). */
function hm_match_district(string $city): ?string {
    static $idx = null;
    if ($idx === null) $idx = hm_city_index();
    $norm = hm_normalize_city($city);
    if ($norm === '') return null;
    if (isset($idx[$norm])) return $idx[$norm];
    // мягкое совпадение по вхождению (например «г.о. Химки» или доп. пояснения в скобках)
    foreach ($idx as $city2 => $district) {
        if (mb_strpos($norm, $city2) !== false) return $district;
    }
    return null;
}

/**
 * Собирает статистику по заявкам: суммы по округам, топ-города, доля
 * несопоставленных городов. Тихий фолбэк на пустые данные при ошибке БД.
 */
function hm_collect_stats(): array {
    $byDistrict = array_fill_keys(array_keys(hm_districts()), 0);
    $byCity = [];
    $total = 0;
    $unmatched = 0;
    try {
        $rows = all("SELECT city, COUNT(*) AS c FROM applications WHERE city <> '' GROUP BY city ORDER BY c DESC");
        foreach ($rows as $r) {
            $cnt = (int) $r['c'];
            $city = trim((string) $r['city']);
            if ($city === '' || $cnt <= 0) continue;
            $total += $cnt;
            $byCity[$city] = ($byCity[$city] ?? 0) + $cnt;
            $district = hm_match_district($city);
            if ($district) {
                $byDistrict[$district] += $cnt;
            } else {
                $unmatched += $cnt;
            }
        }
    } catch (\Throwable $e) {
        // нет таблицы/БД недоступна на этапе установки - молча вернём пустую статистику
    }
    arsort($byCity);
    return [
        'total'       => $total,
        'unmatched'   => $unmatched,
        'by_district' => $byDistrict,
        'top_cities'  => array_slice($byCity, 0, 6, true),
        'regions_count' => count(array_filter($byDistrict)),
    ];
}

/** Вершины правильного шестиугольника (плоский верх наклонён вертикально) в виде "x,y x,y ...". */
function hm_hex_points(float $cx, float $cy, float $r): string {
    $pts = [];
    for ($i = 0; $i < 6; $i++) {
        $ang = deg2rad(-90 + $i * 60);
        $pts[] = round($cx + $r * cos($ang), 1) . ',' . round($cy + $r * sin($ang), 1);
    }
    return implode(' ', $pts);
}

/** Цвет заливки по интенсивности 0..1 (тёмная панель → золото → тёмная бронза). */
function hm_heat_color(float $t): string {
    $t = max(0.0, min(1.0, $t));
    $stops = [
        [0.00, [43, 36, 20]],
        [0.55, [216, 188, 99]],
        [1.00, [139, 111, 31]],
    ];
    for ($i = 1; $i < count($stops); $i++) {
        if ($t <= $stops[$i][0] || $i === count($stops) - 1) {
            [$t0, $c0] = $stops[$i - 1]; [$t1, $c1] = $stops[$i];
            $f = ($t1 - $t0) > 0 ? ($t - $t0) / ($t1 - $t0) : 0;
            $r = (int) round($c0[0] + ($c1[0] - $c0[0]) * $f);
            $g = (int) round($c0[1] + ($c1[1] - $c0[1]) * $f);
            $b = (int) round($c0[2] + ($c1[2] - $c0[2]) * $f);
            return sprintf('#%02x%02x%02x', $r, $g, $b);
        }
    }
    return '#F6EEDB';
}

/** true, если фон достаточно тёмный - подпись рисуем белым, иначе тёмно-синим. */
function hm_is_dark(string $hex): bool {
    sscanf($hex, '#%02x%02x%02x', $r, $g, $b);
    $lum = (0.299 * $r + 0.587 * $g + 0.114 * $b) / 255;
    return $lum < 0.58;
}

/**
 * Рендерит SVG-карту федеральных округов + список топ-городов.
 * Возвращает готовый HTML-блок (карточка), самодостаточный (со своим <style>).
 */
function render_regions_heatmap(array $opts = []): string {
    $stats = hm_collect_stats();
    $districts = hm_districts();
    $max = max(1, ...array_values($stats['by_district']));
    $isEmpty = $stats['total'] === 0;

    // положение шестиугольников: верхний ряд (запад→восток) + южный ряд под западной частью
    $layout = [
        'szfo' => [90, 96],  'cfo'  => [206, 96], 'pfo' => [322, 96],
        'ufo'  => [438, 96], 'sfo'  => [560, 88], 'dfo' => [696, 82],
        'yufo' => [148, 232], 'skfo' => [264, 232],
    ];
    $r = 62;

    ob_start(); ?>
    <div class="hm-wrap">
      <div class="hm-grid">
        <div class="hm-map">
          <svg viewBox="0 0 780 320" role="img" aria-label="Тепловая карта федеральных округов по числу участников конкурсов">
            <?php foreach ($layout as $key => [$cx, $cy]):
                $cnt = $stats['by_district'][$key] ?? 0;
                $t = $isEmpty ? 0 : $cnt / $max;
                $fill = $isEmpty ? '#2b2414' : hm_heat_color($t);
                $textColor = hm_is_dark($fill) ? '#FFF8E1' : '#3a2e10';
                [$label, $full] = $districts[$key];
            ?>
            <g class="hm-hex" tabindex="0">
              <polygon points="<?= hm_hex_points($cx, $cy, $r) ?>" fill="<?= $fill ?>" stroke="#B0872F" stroke-width="1.6"></polygon>
              <title><?= h($full) ?><?= $isEmpty ? '' : ' - ' . $cnt . ' ' . hm_word_form($cnt) ?></title>
              <text x="<?= $cx ?>" y="<?= $cy - 6 ?>" text-anchor="middle" fill="<?= $textColor ?>" class="hm-lbl"><?= h($label) ?></text>
              <text x="<?= $cx ?>" y="<?= $cy + 18 ?>" text-anchor="middle" fill="<?= $textColor ?>" class="hm-cnt"><?= $isEmpty ? '-' : $cnt ?></text>
            </g>
            <?php endforeach; ?>
          </svg>
          <div class="hm-scale">
            <span>меньше</span>
            <i style="background:linear-gradient(90deg,<?= hm_heat_color(0) ?>,<?= hm_heat_color(.5) ?>,<?= hm_heat_color(1) ?>)"></i>
            <span>больше</span>
          </div>
        </div>

        <div class="hm-top">
          <h4>Топ городов по числу заявок</h4>
          <?php if ($isEmpty): ?>
            <p class="hm-empty">Данные о географии участников появятся здесь после первых заявок на конкурсы.</p>
          <?php else: ?>
            <ol class="hm-city-list">
              <?php $maxCity = max($stats['top_cities']); foreach ($stats['top_cities'] as $city => $cnt):
                    $share = $maxCity > 0 ? round($cnt / $maxCity * 100) : 0; ?>
                <li>
                  <span class="hm-city-name"><?= h($city) ?></span>
                  <span class="hm-city-bar"><i style="width:<?= max(8, $share) ?>%"></i></span>
                  <span class="hm-city-cnt"><?= $cnt ?></span>
                </li>
              <?php endforeach; ?>
            </ol>
            <p class="hm-note">
              Всего заявок: <b><?= $stats['total'] ?></b> · округов с участниками: <b><?= $stats['regions_count'] ?></b>
              <?php if ($stats['unmatched'] > 0): ?> · не определено по справочнику: <b><?= $stats['unmatched'] ?></b><?php endif; ?>
            </p>
          <?php endif; ?>
        </div>
      </div>
    </div>

    <style>
    .hm-grid{display:grid;grid-template-columns:1.5fr 1fr;gap:32px;align-items:center}
    .hm-map svg{width:100%;height:auto;display:block}
    .hm-hex text{font-family:var(--ff-body,sans-serif);pointer-events:none}
    .hm-hex .hm-lbl{font-size:15px;font-weight:700;letter-spacing:.03em}
    .hm-hex .hm-cnt{font-size:13px;font-weight:600;opacity:.92}
    .hm-hex polygon{transition:transform .18s ease,filter .18s ease;transform-origin:center;transform-box:fill-box}
    .hm-hex:hover polygon,.hm-hex:focus polygon{transform:scale(1.06);filter:drop-shadow(0 6px 14px rgba(139,111,31,.35))}
    .hm-scale{display:flex;align-items:center;gap:10px;justify-content:center;margin-top:10px;font-size:.78rem;color:var(--muted)}
    .hm-scale i{display:block;width:120px;height:8px;border-radius:6px}
    .hm-top h4{margin:0 0 14px;font-family:var(--ff-serif,serif);font-size:1.15rem;color:var(--gold-2)}
    .hm-empty{color:var(--muted);font-size:.92rem}
    .hm-city-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:11px}
    .hm-city-list li{display:grid;grid-template-columns:1fr 2fr auto;align-items:center;gap:10px}
    .hm-city-name{font-weight:600;font-size:.92rem;color:var(--text)}
    .hm-city-bar{display:block;height:8px;background:var(--gold-soft);border-radius:6px;overflow:hidden}
    .hm-city-bar i{display:block;height:100%;background:var(--grad-gold,linear-gradient(90deg,#D8BC63,#8B6F1F));border-radius:6px}
    .hm-city-cnt{font-size:.86rem;color:var(--gold-2);font-weight:700;min-width:22px;text-align:right}
    .hm-note{margin-top:16px;font-size:.82rem;color:var(--muted)}
    @media (max-width:860px){.hm-grid{grid-template-columns:1fr}}
    </style>
    <?php
    return (string) ob_get_clean();
}

/** Склонение слова «заявка» под число (для title в SVG). */
function hm_word_form(int $n): string {
    $n10 = $n % 10; $n100 = $n % 100;
    if ($n10 === 1 && $n100 !== 11) return 'заявка';
    if ($n10 >= 2 && $n10 <= 4 && ($n100 < 10 || $n100 >= 20)) return 'заявки';
    return 'заявок';
}

}
