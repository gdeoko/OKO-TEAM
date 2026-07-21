<?php
/**
 * core/report_annual.php — генератор ГОДОВОГО ОТЧЁТА КЦ «Музыкальный Мир» (PDF).
 *
 * annual_report(?int $year = null): string
 *   Многостраничный отчёт о деятельности центра за год - для профильных
 *   министерств и партнёров. Титул с лого и реквизитами; общие показатели за
 *   год и за всё время; топ регионов-участников (эвристика city → федеральный
 *   округ - переиспользует hm_* из templates/site/partials/heatmap.php, чтобы
 *   цифры совпадали с тепловой картой на сайте); помесячная динамика заявок
 *   (столбчатая диаграмма средствами GD); список конкурсов года; подвал с
 *   печатью и подписью Оргкомитета. A4, кириллица (DejaVu), тихие фолбэки.
 *   Сохраняет файл в public/ и возвращает абсолютный путь (или '' при ошибке).
 */
declare(strict_types=1);

require_once __DIR__ . '/pdf_lib.php';
require_once BASE_PATH . '/templates/site/partials/heatmap.php'; // hm_* — эвристика «город → федеральный округ»

/** Поточная A4-вёрстка отчёта (тот же премиум-стиль, что и в положении/дипломах). */
final class ArFlow {
    public int $W = 1240, $H = 1754;      // A4 @ ~150dpi
    public int $mL = 100, $mR = 100, $mT = 110, $mB = 120;
    public array $pages = [];
    public $img;
    public int $y;
    public array $paper = [252, 250, 244];
    public array $navy  = [18, 34, 58];
    public array $gold  = [176, 135, 58];
    public array $goldLt = [216, 188, 99];
    public array $ink   = [38, 38, 40];
    public array $muted = [96, 96, 104];

    public function __construct() { $this->newPage(); }
    public function contentW(): int { return $this->W - $this->mL - $this->mR; }

    public function newPage(): void {
        $img = imagecreatetruecolor($this->W, $this->H);
        pl_gradient($img, [255, 254, 250], $this->paper);
        pl_frame($img, 48, $this->gold, 2);
        $this->img = $img;
        $this->pages[] = $img;
        $this->y = $this->mT;
    }

    public function ensure(int $need): void {
        if ($this->y + $need > $this->H - $this->mB) $this->newPage();
    }

    public function spacer(int $px): void { $this->y += $px; }

    /** Заголовок раздела с номером (как в положении конкурса — единый стиль документов КЦ). */
    public function heading(string $num, string $title): void {
        $this->ensure(90);
        $font = pl_font('serif-bold');
        $size = 24;
        $bx = $this->mL; $by = $this->y;
        $c = imagecolorallocate($this->img, $this->navy[0], $this->navy[1], $this->navy[2]);
        imagefilledrectangle($this->img, $bx, $by, $bx + 44, $by + 44, $c);
        pl_text($this->img, $bx, $by + 33, 20, [255, 255, 255], pl_font('serif-bold'), $num, 'center', $bx + 44);
        $titleUp = mb_strtoupper($title, 'UTF-8');
        $availW = ($this->W - $this->mR) - ($bx + 62);
        while ($size > 15 && pl_text_w($size, $font, $titleUp) > $availW) { $size--; }
        pl_text($this->img, $bx + 62, $by + 33, $size, $this->navy, $font, $titleUp);
        $this->y += 56;
        pl_rule($this->img, $this->mL, $this->y, $this->W - $this->mR, [214, 200, 170], 1);
        $this->y += 26;
    }

    public function para(string $text, ?array $rgb = null, int $size = 22, int $lh = 32): void {
        $rgb = $rgb ?? $this->ink;
        $font = pl_font('regular');
        foreach (pl_wrap($text, $size, $font, $this->contentW()) as $ln) {
            $this->ensure($lh);
            pl_text($this->img, $this->mL, $this->y + $size, $size, $rgb, $font, $ln);
            $this->y += $lh;
        }
    }

    public function keyval(string $k, string $v, int $size = 21, int $lh = 32): void {
        $this->ensure($lh);
        $bf = pl_font('bold');
        pl_text($this->img, $this->mL, $this->y + $size, $size, $this->navy, $bf, $k . ':  ');
        $kw = (int) pl_text_w($size, $bf, $k . ':  ');
        $lines = pl_wrap($v, $size, pl_font('regular'), $this->contentW() - $kw);
        foreach ($lines as $i => $ln) {
            if ($i > 0) { $this->ensure($lh); $this->y += $lh; }
            pl_text($this->img, $this->mL + $kw, $this->y + $size, $size, $this->ink, pl_font('regular'), $ln);
        }
        $this->y += $lh;
    }

    /**
     * Ряд плашек «число + подпись» (равные колонки). $tiles: [['value'=>string,'label'=>string], ...].
     */
    public function statTiles(array $tiles): void {
        if (!$tiles) return;
        $gap = 18;
        $n = count($tiles);
        $w = (int) (($this->contentW() - $gap * ($n - 1)) / $n);
        $h = 132;
        $this->ensure($h + 20);
        $x = $this->mL;
        foreach ($tiles as $t) {
            $bg = imagecolorallocate($this->img, 255, 253, 247);
            imagefilledrectangle($this->img, $x, $this->y, $x + $w, $this->y + $h, $bg);
            $gc = imagecolorallocate($this->img, $this->gold[0], $this->gold[1], $this->gold[2]);
            imagesetthickness($this->img, 2);
            imagerectangle($this->img, $x, $this->y, $x + $w, $this->y + $h, $gc);
            imagesetthickness($this->img, 1);
            $val = (string) $t['value'];
            $vsize = $val !== '' && mb_strlen($val) > 5 ? 34 : 42;
            pl_text($this->img, $x, $this->y + 62, $vsize, $this->navy, pl_font('serif-bold'), $val, 'center', $x + $w);
            foreach (pl_wrap((string) $t['label'], 15, pl_font('regular'), $w - 16) as $i => $ln) {
                pl_text($this->img, $x, $this->y + 92 + $i * 20, 15, $this->muted, pl_font('regular'), $ln, 'center', $x + $w);
            }
            $x += $w + $gap;
        }
        $this->y += $h + 26;
    }

    /**
     * Горизонтальные полосы «подпись — число» с заливкой пропорционально максимуму.
     * $rows: [[label, count], ...] по убыванию. Подпись авто-уменьшается и, если
     * не помещается даже минимальным кеглем, аккуратно обрезается многоточием -
     * так длинные названия городов/округов никогда не наезжают на саму полосу.
     */
    public function hBars(array $rows, ?int $max = null): void {
        if (!$rows) return;
        $max = $max ?? max(array_column($rows, 1));
        $max = max(1, $max);
        $labelW = 270;
        $barH = 26; $gap = 14;
        $font = pl_font('regular');
        foreach ($rows as [$label, $cnt]) {
            $this->ensure($barH + $gap);
            $label = (string) $label;
            $avail = $labelW - 16;
            $size = 18;
            while ($size > 13 && pl_text_w($size, $font, $label) > $avail) $size--;
            // если и минимальным кеглем не влезает - аккуратно обрезаем с многоточием
            if (pl_text_w($size, $font, $label) > $avail) {
                while (mb_strlen($label, 'UTF-8') > 3 && pl_text_w($size, $font, $label . '…') > $avail) {
                    $label = mb_substr($label, 0, mb_strlen($label, 'UTF-8') - 1, 'UTF-8');
                }
                $label .= '…';
            }
            pl_text($this->img, $this->mL, $this->y + 19, $size, $this->ink, $font, $label);
            $barX = $this->mL + $labelW;
            $barMaxW = $this->W - $this->mR - $barX - 60;
            $bw = (int) round($barMaxW * ($cnt / $max));
            $bw = max(6, $bw);
            $track = imagecolorallocate($this->img, 240, 232, 213);
            imagefilledrectangle($this->img, $barX, $this->y, $barX + $barMaxW, $this->y + $barH, $track);
            $fill = imagecolorallocate($this->img, $this->goldLt[0], $this->goldLt[1], $this->goldLt[2]);
            imagefilledrectangle($this->img, $barX, $this->y, $barX + $bw, $this->y + $barH, $fill);
            pl_text($this->img, $barX + $barMaxW + 10, $this->y + 19, 17, $this->navy, pl_font('bold'), (string) $cnt);
            $this->y += $barH + $gap;
        }
        $this->y += 8;
    }

    /**
     * Столбчатая диаграмма помесячной динамики. $counts: 12 значений (индекс 1..12).
     */
    public function barChartMonths(array $counts, string $title = ''): void {
        $months = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];
        $chartH = 300;
        $this->ensure($chartH + 60);
        if ($title !== '') {
            pl_text($this->img, $this->mL, $this->y + 20, 19, $this->navy, pl_font('bold'), $title);
            $this->y += 36;
        }
        $max = max(1, ...array_values($counts));
        $n = 12;
        $gap = 14;
        $availW = $this->contentW();
        $barW = (int) (($availW - $gap * ($n - 1)) / $n);
        $baseY = $this->y + $chartH;
        // сетка-ось
        pl_rule($this->img, $this->mL, $baseY, $this->W - $this->mR, [214, 200, 170], 1);
        $x = $this->mL;
        for ($m = 1; $m <= 12; $m++) {
            $cnt = (int) ($counts[$m] ?? 0);
            $h = $cnt > 0 ? (int) round(($chartH - 30) * ($cnt / $max)) : 0;
            $h = max($cnt > 0 ? 4 : 0, $h);
            $barY = $baseY - $h;
            if ($h > 0) {
                $fill = imagecolorallocate($this->img, $this->gold[0], $this->gold[1], $this->gold[2]);
                imagefilledrectangle($this->img, $x, $barY, $x + $barW, $baseY, $fill);
            }
            if ($cnt > 0) {
                pl_text($this->img, $x, $barY - 8, 15, $this->navy, pl_font('bold'), (string) $cnt, 'center', $x + $barW);
            }
            pl_text($this->img, $x, $baseY + 24, 15, $this->muted, pl_font('regular'), $months[$m - 1], 'center', $x + $barW);
            $x += $barW + $gap;
        }
        $this->y = $baseY + 46;
    }

    /**
     * Строка таблицы конкурсов (с чередующейся заливкой). Каждая ячейка
     * переносится по словам в свою колонку целиком (без потери текста) -
     * высота строки растёт под самую длинную ячейку, чтобы длинные названия
     * конкурсов или диапазоны дат никогда не наезжали на соседнюю колонку.
     */
    public function tableRow(array $cols, array $widths, bool $shade = false, bool $isHead = false): void {
        $font = $isHead ? pl_font('bold') : pl_font('regular');
        $color = $isHead ? $this->navy : $this->ink;
        $size = 14;
        $lh = 20;

        $wrapped = [];
        $maxLines = 1;
        foreach ($cols as $i => $val) {
            $w = $widths[$i] ?? 150;
            $lines = pl_wrap((string) $val, $size, $font, $w - 14);
            if (!$lines) $lines = [''];
            $wrapped[] = $lines;
            $maxLines = max($maxLines, count($lines));
        }
        $rh = max(38, 18 + $maxLines * $lh);
        $this->ensure($rh);
        if ($shade) {
            $bg = imagecolorallocate($this->img, 250, 245, 234);
            imagefilledrectangle($this->img, $this->mL, $this->y, $this->W - $this->mR, $this->y + $rh, $bg);
        }
        $x = $this->mL + 12;
        foreach ($wrapped as $i => $lines) {
            $w = $widths[$i] ?? 150;
            foreach ($lines as $li => $ln) {
                pl_text($this->img, $x, $this->y + 24 + $li * $lh, $size, $color, $font, $ln);
            }
            $x += $w;
        }
        $this->y += $rh;
        pl_rule($this->img, $this->mL, $this->y, $this->W - $this->mR, [232, 222, 198], 1);
    }
}

/**
 * Агрегирует заявки года по федеральным округам и городам через эвристику
 * hm_match_district() (тот же справочник, что и на публичной тепловой карте) —
 * так цифры отчёта и сайта не расходятся.
 *
 * @param int[] $compIds ID конкурсов, чьи заявки учитываются.
 */
function ar_region_stats(array $compIds): array {
    $byDistrict = array_fill_keys(array_keys(hm_districts()), 0);
    $byCity = [];
    $unmatched = 0;
    if (!$compIds) return ['by_district' => $byDistrict, 'top_cities' => [], 'unmatched' => 0];
    $ids = implode(',', array_map('intval', $compIds));
    $rows = all("SELECT city, COUNT(*) AS c FROM applications WHERE competition_id IN ($ids) AND city <> '' GROUP BY city ORDER BY c DESC");
    foreach ($rows as $r) {
        $cnt = (int) $r['c'];
        $city = trim((string) $r['city']);
        if ($city === '' || $cnt <= 0) continue;
        $byCity[$city] = ($byCity[$city] ?? 0) + $cnt;
        $d = hm_match_district($city);
        if ($d) $byDistrict[$d] += $cnt; else $unmatched += $cnt;
    }
    arsort($byCity);
    return ['by_district' => $byDistrict, 'top_cities' => $byCity, 'unmatched' => $unmatched];
}

/** Главная функция генерации годового отчёта. Возвращает путь к PDF или ''. */
function annual_report(?int $year = null): string {
    try {
        $year = $year ?? (int) cfgv('year', (int) date('Y'));
        $imgDir = BASE_PATH . '/public/assets/img/';
        $doc = new ArFlow();

        /* ---------- Данные за отчётный год ---------- */
        $comps = all(
            "SELECT * FROM competitions WHERE status <> 'draft' AND (
                strftime('%Y', start_date) = :y OR strftime('%Y', end_date) = :y OR strftime('%Y', results_date) = :y
             ) ORDER BY start_date ASC, sort ASC",
            ['y' => (string) $year]
        );
        $compIds = array_map(static fn($c) => (int) $c['id'], $comps);
        $idsList = $compIds ? implode(',', $compIds) : '0';

        $participantsYear = (int) scalar("SELECT COUNT(*) FROM applications WHERE competition_id IN ($idsList)");
        $diplomasYear = (int) scalar(
            "SELECT COUNT(*) FROM diplomas d JOIN applications a ON a.id = d.application_id WHERE a.competition_id IN ($idsList)"
        );
        $regionStats = ar_region_stats($compIds);
        $districtsReached = count(array_filter($regionStats['by_district']));
        $citiesReached = count($regionStats['top_cities']);

        $monthly = array_fill(1, 12, 0);
        foreach (all(
            "SELECT strftime('%m', created_at) AS m, COUNT(*) AS c FROM applications
             WHERE strftime('%Y', created_at) = ? GROUP BY m", [(string) $year]
        ) as $r) {
            $mi = (int) $r['m'];
            if ($mi >= 1 && $mi <= 12) $monthly[$mi] = (int) $r['c'];
        }

        /* Общие показатели за всё время центра — те же цифры, что и на главной странице сайта. */
        $kpiAll = [
            'competitions' => (int) setting('stat_competitions', '0'),
            'participants' => (int) setting('stat_participants', '0'),
            'regions'      => (int) setting('stat_regions', '0'),
            'countries'    => (int) setting('stat_countries', '0'),
            'diplomas'     => (int) setting('stat_diplomas', '0'),
        ];

        /* ---------- СТРАНИЦА 1: ТИТУЛ ---------- */
        $logos = [$imgDir . 'emblem_minkultury_rf.png', $imgDir . 'prokultura_full_horizontal.png', $imgDir . 'logo_muzmir_main.png'];
        pl_image($doc->img, $logos[0], $doc->mL, 84, null, 90);
        pl_image($doc->img, $logos[2], $doc->W - $doc->mR - 90, 84, 90, 90);
        if (is_file($logos[1])) pl_image($doc->img, $logos[1], (int) ($doc->W / 2 - 140), 100, 280, null);
        $doc->y = 210;
        pl_rule($doc->img, $doc->mL, $doc->y, $doc->W - $doc->mR, $doc->gold, 2);
        $doc->y += 30;

        pl_text($doc->img, $doc->mL, $doc->y + 22, 22, $doc->muted, pl_font('regular'), cfgv('org_full'), 'center', $doc->W - $doc->mR);
        $doc->y += 38;
        pl_text($doc->img, $doc->mL, $doc->y + 18, 17, $doc->muted, pl_font('regular'), 'Регистрация ' . cfgv('org_reg'), 'center', $doc->W - $doc->mR);
        $doc->y += 70;

        pl_text_spaced($doc->img, $doc->mL, $doc->y + 44, 44, $doc->navy, pl_font('serif-bold'), 'ГОДОВОЙ ОТЧЁТ', 6, 'center', $doc->W - $doc->mR);
        $doc->y += 74;
        pl_text($doc->img, $doc->mL, $doc->y + 26, 26, $doc->ink, pl_font('serif'), 'о деятельности за ' . $year . ' год', 'center', $doc->W - $doc->mR);
        $doc->y += 50;
        pl_rule($doc->img, (int) ($doc->W / 2 - 90), $doc->y, (int) ($doc->W / 2 + 90), $doc->gold, 2);
        $doc->y += 46;

        $doc->para(
            'Отчёт подготовлен Оргкомитетом Культурного центра «Музыкальный Мир» по итогам ' . $year . ' года '
            . 'для профильных министерств и партнёров. В отчёте приведены показатели проведённых конкурсов и '
            . 'фестивалей культуры и искусства, география участников и динамика подачи заявок.',
            $doc->muted, 21, 32
        );
        $doc->spacer(50);
        $doc->keyval('Отчётный период', '01 января - 31 декабря ' . $year . ' года');
        $doc->keyval('Дата формирования', ru_date(date('Y-m-d')));
        $doc->keyval('Организация', cfgv('org_full'));
        $doc->keyval('Адрес', cfgv('org_address'));

        /* ---------- 1. Показатели за год ---------- */
        $doc->newPage();
        $doc->heading('1', 'Показатели за ' . $year . ' год');
        $doc->para('Данные ниже рассчитаны по конкурсам, приём заявок, окончание приёма или публикация результатов которых пришлись на ' . $year . ' год.', $doc->muted, 19, 28);
        $doc->spacer(14);
        $doc->statTiles([
            ['value' => (string) count($comps),          'label' => 'Конкурсов в отчётном году'],
            ['value' => (string) $participantsYear,       'label' => 'Заявок участников'],
            ['value' => (string) $citiesReached,           'label' => 'Городов-участников'],
            ['value' => (string) $districtsReached . ' из 8', 'label' => 'Федеральных округов охвачено'],
            ['value' => (string) $diplomasYear,            'label' => 'Наградных документов оформлено'],
        ]);

        $doc->heading('2', 'Показатели за всё время работы центра');
        $doc->para('Совокупные показатели деятельности центра с начала работы (совпадают со счётчиками на главной странице сайта).', $doc->muted, 19, 28);
        $doc->spacer(14);
        $doc->statTiles([
            ['value' => (string) $kpiAll['competitions'], 'label' => 'Конкурсов проведено'],
            ['value' => (string) $kpiAll['participants'], 'label' => 'Участников'],
            ['value' => (string) $kpiAll['regions'],      'label' => 'Регионов России'],
            ['value' => (string) $kpiAll['countries'],    'label' => 'Стран'],
            ['value' => (string) $kpiAll['diplomas'],     'label' => 'Дипломов выдано'],
        ]);

        /* ---------- 3. Топ регионов ---------- */
        $doc->newPage();
        $doc->heading('3', 'Топ регионов-участников');
        if ($participantsYear === 0) {
            $doc->para('В отчётном году заявки участников с указанием города пока не зарегистрированы.', $doc->muted, 20, 30);
        } else {
            $doc->para('Распределение заявок ' . $year . ' года по федеральным округам Российской Федерации (эвристика по городу участника).', $doc->muted, 19, 28);
            $labels = hm_districts();
            $legend = [];
            foreach ($labels as [$short, $full]) $legend[] = $short . ' - ' . mb_substr($full, 0, mb_strpos($full, ' федеральный'));
            $doc->para(implode(' · ', $legend), $doc->muted, 15, 22);
            $doc->spacer(14);
            $districtRows = [];
            foreach ($regionStats['by_district'] as $key => $cnt) {
                if ($cnt <= 0) continue;
                $districtRows[] = [$labels[$key][0], $cnt];
            }
            usort($districtRows, fn($a, $b) => $b[1] <=> $a[1]);
            if ($districtRows) $doc->hBars($districtRows);
            if ($regionStats['unmatched'] > 0) {
                $doc->para('Не определено по справочнику городов: ' . $regionStats['unmatched'] . ' ' . hm_word_form($regionStats['unmatched']) . '.', $doc->muted, 18, 26);
            }
            $doc->spacer(20);

            $doc->heading('4', 'Топ городов-участников');
            $topCities = array_slice($regionStats['top_cities'], 0, 10, true);
            $cityRows = [];
            foreach ($topCities as $city => $cnt) $cityRows[] = [$city, $cnt];
            $doc->hBars($cityRows);
        }

        /* ---------- 5. Помесячная динамика ---------- */
        $doc->newPage();
        $doc->heading('5', 'Помесячная динамика заявок');
        $doc->para('Количество заявок, поданных на сайте центра в ' . $year . ' году, по месяцам подачи.', $doc->muted, 19, 28);
        $doc->spacer(10);
        $doc->barChartMonths($monthly);

        /* ---------- 6. Список конкурсов года ---------- */
        $doc->newPage();
        $doc->heading('6', 'Конкурсы ' . $year . ' года');
        if (!$comps) {
            $doc->para('В отчётном году проведение конкурсов не запланировано либо даты ещё не утверждены Оргкомитетом.', $doc->muted, 20, 30);
        } else {
            $widths = [
                (int) ($doc->contentW() * 0.32), (int) ($doc->contentW() * 0.18),
                (int) ($doc->contentW() * 0.28), (int) ($doc->contentW() * 0.22),
            ];
            $doc->tableRow(['Конкурс', 'Тип', 'Приём заявок', 'Статус'], $widths, false, true);
            $statusLabel = static fn(string $s) => match ($s) {
                'open' => 'Приём открыт', 'judging' => 'Идёт оценка', 'finished' => 'Завершён', 'closed' => 'Завершён', default => $s,
            };
            // Компактный диапазон дат: без повтора года, если начало и окончание в одном году.
            $shortStart = static function (string $d): string {
                $months = [1=>'января',2=>'февраля',3=>'марта',4=>'апреля',5=>'мая',6=>'июня',
                           7=>'июля',8=>'августа',9=>'сентября',10=>'октября',11=>'ноября',12=>'декабря'];
                $ts = strtotime($d);
                return (int) date('j', $ts) . ' ' . $months[(int) date('n', $ts)];
            };
            foreach ($comps as $i => $c) {
                $period = '';
                if (!empty($c['start_date'])) {
                    $sameYear = !empty($c['end_date'])
                        && date('Y', strtotime($c['start_date'])) === date('Y', strtotime($c['end_date']));
                    $startTxt = $sameYear ? $shortStart($c['start_date']) : ru_date($c['start_date']);
                    $period = $startTxt . (!empty($c['end_date']) ? ' - ' . ru_date($c['end_date']) : '');
                }
                $doc->tableRow([
                    $c['name'],
                    $c['type'] === 'international' ? 'Международный' : 'Всероссийский',
                    $period !== '' ? $period : 'по графику',
                    $statusLabel($c['status']),
                ], $widths, $i % 2 === 1);
            }
        }

        /* ---------- Подвал: печать + подписи ---------- */
        $doc->ensure(230);
        $fy = $doc->y + 24;
        pl_rule($doc->img, $doc->mL, $fy, $doc->W - $doc->mR, $doc->gold, 2);
        $fy += 40;
        pl_text($doc->img, $doc->mL, $fy + 22, 22, $doc->navy, pl_font('serif-bold'), 'Оргкомитет', 'left');
        pl_text($doc->img, $doc->mL, $fy + 60, 19, $doc->muted, pl_font('regular'), cfgv('org_full'));
        pl_text($doc->img, $doc->mL, $fy + 88, 17, $doc->muted, pl_font('regular'), 'Отчёт сформирован автоматически на основании данных сайта центра.');
        if (is_file($imgDir . 'podpis_albert.png')) {
            pl_image($doc->img, $imgDir . 'podpis_albert.png', $doc->mL + 20, $fy + 96, 200, null);
        }
        if (is_file($imgDir . 'pechat_kc_muzmir.png')) {
            pl_image($doc->img, $imgDir . 'pechat_kc_muzmir.png', $doc->W - $doc->mR - 190, $fy - 6, 180, 180, 100);
        }

        /* ---------- Сохранение ---------- */
        $out = BASE_PATH . '/public/godovoy_otchet_' . $year . '.pdf';
        pl_pdf_from_images($doc->pages, $out, 150, 92);
        foreach ($doc->pages as $p) @imagedestroy($p);
        return $out;
    } catch (\Throwable $e) {
        error_log('annual_report: ' . $e->getMessage());
        return '';
    }
}
