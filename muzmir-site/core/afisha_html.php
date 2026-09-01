<?php
/**
 * ЭТАЛОН АФИШИ КОНКУРСА — HTML, из которого снимается картинка.
 *
 * Афиши центра рисовались руками в редакторе на телефоне, и каждый месяц заново:
 * новый конкурс — новая афиша, а в ней десяток обязательных строк, которые
 * нельзя переврать (регистрация Роскомнадзора, статья ГК про публичный конкурс,
 * указ Президента, шесть-семь гербов информационных партнёров). Один пропущенный
 * герб или сбитая дата — и афишу нельзя ставить в рассылку по учреждениям.
 *
 * Здесь та же афиша собирается из данных конкурса. Разбор восьми утверждённых
 * образцов дал одну и ту же сетку сверху вниз:
 *   1. юридическая шапка мелким шрифтом,
 *   2. эмблема центра и его название,
 *   3. строка информационной поддержки,
 *   4. тип конкурса (международный / всероссийский),
 *   5. НАЗВАНИЕ крупно,
 *   6. лента с условием: оргвзнос, бесплатно, Клуб или призовой фонд,
 *   7. сроки приёма и результатов,
 *   8. строка преимуществ,
 *   9. ряд гербов,
 *  10. подвал «Российская Федерация, город Москва — год».
 *
 * ЧТО ГЕНЕРИРУЕТСЯ, А ЧТО НЕТ. Нейросети отдаётся ТОЛЬКО ФОН. Тексты, гербы и
 * эмблема кладутся слоем поверх — потому что на генерации русский юридический
 * текст превращается в кашу из похожих букв, а гербы министерств в выдуманные
 * золотые кругляши. Такую афишу нельзя показывать ни учреждению, ни ведомству.
 *
 * afisha_html(array $c, array $opt): string — готовая страница 1600×615.
 */
declare(strict_types=1);

/* Размер афиши — 16:9 (решение владельца, 25.08.2026).
 *
 * Утверждённые образцы были узкой лентой 2.6:1, и это её беда: в ленте афиша
 * живёт только шапкой письма. Шестнадцать к девяти — формат, который без
 * кадрирования уходит и в пост ВКонтакте, и в письмо, и на страницу конкурса,
 * и в превью видео. Полторы тысячи на восемьсот сорок три — рабочий размер под
 * съёмку с двойным масштабом: на выходе 3840×2160, честные 4K. */
const AFISHA_W = 1920;
const AFISHA_H = 1080;

/* Фон диплома — A4 книжный, ровно как сам бланк (core/diploma_html.php:
 * @page size A4 portrait, 210×297 мм). При 300 точках на дюйм это 2480×3508;
 * снимаем 1240×1754 с двойным масштабом и получаем те же 2480×3508. */
const DIPLOMA_BG_W = 1240;
const DIPLOMA_BG_H = 1754;

/**
 * Темы оформления. Взяты с утверждённых образцов, чтобы соседние месяцы не
 * выглядели одинаково: тема выбирается по номеру месяца и идёт по кругу.
 * Каждая задаёт цвета подложки и подсказку для генерации фона.
 */
function afisha_themes(): array {
    return [
        'gold' => [
            'name' => 'Золото на чёрном',
            'bg'   => 'radial-gradient(120% 90% at 50% 0%, #2a1c07 0%, #120b03 55%, #070502 100%)',
            'ink'  => '#f6e7c1', 'accent' => '#e8c369', 'sub' => '#d8c49a', 'line' => 'rgba(232,195,105,.42)',
            'scene'=> 'luxurious dark stage with golden light rays, floating golden particles and bokeh, deep black background with warm amber glow',
        ],
        'antique' => [
            'name' => 'Античность',
            'bg'   => 'linear-gradient(160deg, #f3e6c8 0%, #e6d3a8 45%, #d8c08a 100%)',
            'ink'  => '#3a2a12', 'accent' => '#8a6a24', 'sub' => '#5a4520', 'line' => 'rgba(138,106,36,.42)',
            'scene'=> 'antique greek marble columns and laurel wreaths, aged parchment texture, meander ornament border, warm ivory and old gold palette',
        ],
        'stage' => [
            'name' => 'Синяя сцена',
            'bg'   => 'radial-gradient(120% 90% at 50% 0%, #1c3570 0%, #0f1f47 55%, #070f26 100%)',
            'ink'  => '#eaf1ff', 'accent' => '#f0c96a', 'sub' => '#c3d2f0', 'line' => 'rgba(240,201,106,.40)',
            'scene'=> 'grand theatre stage with deep blue velvet curtains drawn to the sides, golden tassels, polished wooden stage floor, warm spotlights',
        ],
        'cosmos' => [
            'name' => 'Космос и ноты',
            'bg'   => 'radial-gradient(120% 90% at 50% 0%, #2b1a52 0%, #150d2e 55%, #080513 100%)',
            'ink'  => '#efe8ff', 'accent' => '#e9c46a', 'sub' => '#cbbdf0', 'line' => 'rgba(233,196,106,.40)',
            'scene'=> 'deep space nebula in violet and indigo, scattered stars and light flares, faint golden musical notes and treble clefs floating',
        ],
        'russia' => [
            'name' => 'Флаг и Кремль',
            'bg'   => 'linear-gradient(160deg, #f7f4ec 0%, #eae4d4 55%, #ded5bd 100%)',
            'ink'  => '#2a2418', 'accent' => '#9a7a2a', 'sub' => '#4a4030', 'line' => 'rgba(154,122,42,.40)',
            'scene'=> 'golden silhouette of Moscow Kremlin and Saint Basil cathedral, russian tricolour ribbons, laurel branches, light ivory background',
        ],
        'parchment' => [
            'name' => 'Пергамент',
            'bg'   => 'linear-gradient(160deg, #fbf3df 0%, #f2e6c9 55%, #e6d5ac 100%)',
            'ink'  => '#3b2c14' , 'accent' => '#8d6a1e', 'sub' => '#5c4a25', 'line' => 'rgba(141,106,30,.40)',
            'scene'=> 'aged cream parchment with fine golden filigree ornament, sunburst rays, delicate musical notes, warm ivory and gold palette',
        ],
    ];
}

/**
 * Тема оформления конкурса.
 *
 * ТЕМА ИДЁТ ЗА НАЗВАНИЕМ, А НЕ ЗА КАЛЕНДАРЁМ. Сначала она выбиралась просто по
 * номеру месяца, и «Величие России» с Кремлём и триколором получало палитру
 * античного пергамента — Кремль на цвете музейной грамоты. Если название
 * узнаётся, палитру задаёт оно; для незнакомых названий остаётся ротация по
 * месяцам, чтобы соседние месяцы не выглядели близнецами.
 */
function afisha_theme_for(array $c): array {
    $themes = afisha_themes();
    $keys   = array_keys($themes);

    $forced = trim((string) ($c['afisha_theme'] ?? ''));
    if ($forced !== '' && isset($themes[$forced])) return $themes[$forced] + ['key' => $forced];

    $n = mb_strtolower(trim((string) ($c['name'] ?? '')));
    $byName = [
        'росси' => 'russia', 'будущ' => 'russia', 'отечеств' => 'russia', 'держав' => 'russia',
        'звезд'  => 'cosmos', 'симфон' => 'cosmos', 'космос' => 'cosmos',
        'атлант' => 'antique', 'мастерств' => 'antique', 'эврика' => 'parchment', 'профи' => 'gold',
        'сцен'   => 'stage', 'театр' => 'stage', 'призван' => 'stage',
        'мир'    => 'stage', 'талант' => 'gold', 'слава' => 'gold', 'благо' => 'parchment',
        'вершин' => 'stage',
    ];
    foreach ($byName as $needle => $key) {
        if (mb_strpos($n, $needle) !== false && isset($themes[$key])) {
            return $themes[$key] + ['key' => $key];
        }
    }

    $seed = (int) date('n', strtotime((string) ($c['start_date'] ?? '')) ?: time());
    $k    = $keys[($seed - 1) % count($keys)];
    return $themes[$k] + ['key' => $k];
}

/** Дата ДД.ММ.ГГГГ или пусто. */
function afisha_date(string $d): string {
    $ts = strtotime(trim($d));
    return $ts ? date('d.m.Y', $ts) : '';
}

/** Картинка сайта как data-URI: рендер идёт с чужой машины, ссылки на файлы там не откроются. */
function afisha_img(string $rel): string {
    $p = BASE_PATH . '/public/' . ltrim($rel, '/');
    if (!is_file($p)) return '';
    $ext = strtolower(pathinfo($p, PATHINFO_EXTENSION));
    $mime = $ext === 'png' ? 'image/png' : ($ext === 'webp' ? 'image/webp' : 'image/jpeg');
    $data = @file_get_contents($p);
    return $data === false ? '' : 'data:' . $mime . ';base64,' . base64_encode($data);
}

/**
 * ФОН ПОД РАЗМЕР АФИШИ, А НЕ КАК ПРИСЛАЛИ.
 *
 * Нейросеть отдаёт PNG на два с половиной мегабайта. Он уходит в страницу
 * строкой base64, браузер бастиона его разбирает, и снимок не успевает
 * сделаться за тридцать секунд — афиша не собирается вовсе. Приводим фон к
 * размеру полотна и кладём рядом лёгкой копией: страница получает вместо
 * двух мегабайт около двухсот килобайт, и снимок укладывается в секунды.
 *
 * Готовая копия переиспользуется, пока исходник не изменился.
 */
function afisha_bg_fit(string $rel): string {
    $src = BASE_PATH . '/public/' . ltrim($rel, '/');
    if (!is_file($src) || !function_exists('imagecreatetruecolor')) return $rel;

    $dst = preg_replace('~\.(png|jpe?g|webp)$~i', '', $src) . '_fit.jpg';
    $relFit = preg_replace('~\.(png|jpe?g|webp)$~i', '', $rel) . '_fit.jpg';
    if (is_file($dst) && filemtime($dst) >= filemtime($src)) return $relFit;

    $info = @getimagesize($src);
    if (!$info) return $rel;
    $im = match ($info[2]) {
        IMAGETYPE_PNG  => @imagecreatefrompng($src),
        IMAGETYPE_JPEG => @imagecreatefromjpeg($src),
        IMAGETYPE_WEBP => @imagecreatefromwebp($src),
        default        => null,
    };
    if (!$im) return $rel;

    $sw = imagesx($im); $sh = imagesy($im);
    $out = imagecreatetruecolor(AFISHA_W, AFISHA_H);
    // Кадрируем по короткой стороне (cover): растянуть фон под другую пропорцию
    // значит перекосить колонны и орнамент, а это сразу видно.
    $scale = max(AFISHA_W / $sw, AFISHA_H / $sh);
    $nw = (int) round($sw * $scale); $nh = (int) round($sh * $scale);
    imagecopyresampled($out, $im, (int) round((AFISHA_W - $nw) / 2), (int) round((AFISHA_H - $nh) / 2),
                       0, 0, $nw, $nh, $sw, $sh);
    imagejpeg($out, $dst, 88);
    imagedestroy($im); imagedestroy($out);
    @chmod($dst, 0664);
    return is_file($dst) ? $relFit : $rel;
}

/**
 * Гербы информационных партнёров — тот же набор и в том же порядке, что на
 * утверждённых образцах. Отсутствующий файл просто пропускается: лучше шесть
 * гербов вместо семи, чем пустой квадрат с крестиком на официальной афише.
 */
function afisha_emblems(): array {
    /* Росмолодёжи в этом ряду нет: её знак — не герб, а горизонтальная надпись,
     * и в ряду круглых медальонов она читается как случайно попавшая картинка.
     * На утверждённых образцах её тоже нет. */
    $files = [
        'assets/img/emblem_minkultury_rf.png',
        'assets/img/emblem_minobrazovaniya.png',
        'assets/img/emblem_roskomnadzor.png',
        'assets/img/logo_rossia_nota.png',
        'assets/img/prokultura_dark.png',
        'assets/img/natsproekty_kultura.png',
    ];
    $out = [];
    foreach ($files as $f) {
        $d = afisha_img($f);
        if ($d !== '') $out[] = $d;
    }
    return $out;
}

/**
 * Лента с условием участия — главная строка афиши после названия.
 * Порядок важен: конкурс Клуба перебивает и цену, и слово «бесплатный».
 */
function afisha_terms(array $c): string {
    /* Решение владельца: на ленте только сумма фонда, без пояснений про год и
     * гала-концерт — условия читаются в положении, и мелкая приписка о нём
     * стоит отдельной строкой ниже (см. afisha_note). */
    /* На ленте - то, ради чего смотрят афишу: бесплатное участие и призовой фонд.
     * Условие про Клуб уходит отдельной строкой ниже (afisha_note): в одну ленту
     * три мысли не помещаются, и главное в ней теряется. */
    if ((int) ($c['club_only'] ?? 0) === 1) return 'ТОЛЬКО ДЛЯ УЧАСТНИКОВ КЛУБА · ПРИЗОВОЙ ФОНД 100 000 ₽';
    if ((int) ($c['is_paid'] ?? 0) === 1)   return '«ОРГ. ВЗНОС ' . (int) ($c['price'] ?? 0) . ' ₽»';
    return 'УЧАСТИЕ БЕСПЛАТНОЕ';
}

/**
 * Мелкая приписка под лентой условий.
 *
 * У конкурса Клуба призовой фонд — годовой, вручается один раз и лично на
 * гала-концерте. Целиком это на афишу не вынести, а без оговорки сумма читается
 * как ежемесячный приз каждому. Поэтому под лентой стоит одна короткая строка,
 * отсылающая к положению.
 */
function afisha_note(array $c): string {
    return (int) ($c['club_only'] ?? 0) === 1
        ? 'Только для участников ВИП-клуба · В стоимость участия входят основной и дополнительный дипломы · Подробности в положении конкурса'
        : '';
}

/** Готовая страница афиши. $opt: bg — путь к сгенерированному фону (public-relative). */
function afisha_html(array $c, array $opt = []): string {
    $t    = afisha_theme_for($c);
    $name = mb_strtoupper(trim((string) ($c['name'] ?? '')), 'UTF-8');
    $kind = ((string) ($c['type'] ?? '') === 'national' ? 'Всероссийский' : 'Международный')
          . ' многожанровый онлайн-конкурс культуры и искусства';
    $end  = afisha_date((string) ($c['end_date'] ?? ''));
    $res  = afisha_date((string) ($c['results_date'] ?? ''));
    $year = date('Y', strtotime((string) ($c['start_date'] ?? '')) ?: time());

    $logo    = afisha_img('assets/img/logo_muzmir_512.png') ?: afisha_img('assets/img/logo_muzmir_main.png');
    $emblems = afisha_emblems();

    // Фон: сгенерированная картинка, если её положили, иначе градиент темы.
    $bgRel = trim((string) ($opt['bg'] ?? ($c['afisha_bg'] ?? '')));
    $bgImg = $bgRel !== '' ? afisha_img(afisha_bg_fit($bgRel)) : '';
    $bgCss = $bgImg !== ''
        ? "background-image:linear-gradient(180deg,rgba(0,0,0,.30),rgba(0,0,0,.55)),url('" . $bgImg . "');background-size:cover;background-position:center"
        : 'background-image:' . $t['bg'];

    /* Подложка под текст зависит от того, светлая тема или тёмная: на светлой
     * читается белая полупрозрачная, на тёмной — чёрная. Определяем по яркости
     * цвета текста темы: светлый текст значит тёмный фон. */
    $ink  = ltrim((string) $t['ink'], '#');
    $lum  = (hexdec(substr($ink, 0, 2)) * 299 + hexdec(substr($ink, 2, 2)) * 587 + hexdec(substr($ink, 4, 2)) * 114) / 1000;
    $dark = $lum > 140;   // светлые буквы → тёмная тема
    $plateBg   = $dark ? 'rgba(6,8,16,.72)'  : 'rgba(255,252,244,.80)';
    $plateSoft = $dark ? 'rgba(6,8,16,.50)'  : 'rgba(255,252,244,.58)';

    // Длинное название ужимаем, чтобы не переносилось в две строки и не ломало сетку.
    $len  = mb_strlen($name);
    $nameSize = $len <= 14 ? 96 : ($len <= 20 ? 78 : ($len <= 28 ? 62 : 50));

    $srok = $end !== '' ? ('Приём заявок до ' . $end) : '';
    if ($res !== '')      $srok .= ($srok !== '' ? ' • ' : '') . 'Результаты конкурса ' . $res;
    elseif ($srok !== '') $srok .= ' • Результаты в течение 5 рабочих дней';

    $h = static fn($s) => htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');

    $emblemHtml = '';
    foreach ($emblems as $e) $emblemHtml .= '<img class="em" src="' . $e . '" alt="">';

    return '<!doctype html><html lang="ru"><head><meta charset="utf-8">
<style>
  @page { size: ' . AFISHA_W . 'px ' . AFISHA_H . 'px; margin: 0 }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:' . AFISHA_W . 'px;height:' . AFISHA_H . 'px;overflow:hidden}
  body{font-family:"PT Serif","Times New Roman",Georgia,serif;color:' . $t['ink'] . ';' . $bgCss . '}
  /* Полотно распределяется по высоте, а не прижимается к верху: на первом
     подходе всё стояло сверху, гербы уезжали вниз, и середина афиши оставалась
     пустым полем. Двойная рамка — как на утверждённых образцах. */
  .frame{position:absolute;inset:10px;border:2px solid ' . $t['line'] . ';border-radius:6px;
         box-shadow:inset 0 0 0 5px rgba(255,255,255,.06), inset 0 0 0 7px ' . $t['line'] . ';
         padding:16px 40px 12px;
         display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center}
  /* Юридическая шапка и подвал ложатся на самые узорные полосы фона: у античной
     темы это золотой меандр, у остальных — рамка орнамента. Без подложки мелкий
     текст про Роскомнадзор растворяется в узоре и не читается вовсе, а это
     ровно та строка, ради которой афишу принимают в учреждении. Подложка
     подстроена под тему: на светлых фонах белая, на тёмных — чёрная. */
  .law{font-size:11px;line-height:1.34;max-width:1440px;letter-spacing:.1px;
       background:' . $plateBg . ';color:' . $t['ink'] . ';padding:7px 20px;border-radius:5px;
       border:1px solid ' . $t['line'] . '}
  .brand{display:flex;align-items:center;gap:16px}
  .brand img{width:74px;height:74px;object-fit:contain}
  .brand b{font-size:26px;letter-spacing:.4px}
  .support{font-size:14.5px;line-height:1.34;opacity:.94;max-width:1220px}
  .kind{font-size:19px;font-style:italic;letter-spacing:.3px}
  .name{font-size:' . $nameSize . 'px;line-height:1.02;font-weight:700;letter-spacing:1.4px;
        color:' . $t['accent'] . ';text-shadow:0 2px 0 rgba(0,0,0,.28),0 0 26px rgba(0,0,0,.22);white-space:nowrap}
  .terms{display:inline-block;padding:9px 32px;border-radius:4px;font-size:21px;font-weight:700;
         letter-spacing:.5px;color:#fff;background:linear-gradient(180deg,#8f1d22,#6b1216);
         border:1px solid rgba(255,255,255,.26);box-shadow:0 4px 12px rgba(0,0,0,.32)}
  .srok{font-size:18px;font-weight:700}
  .adv{margin-top:4px;font-size:16px;opacity:.94}
  .ems{display:flex;gap:22px;align-items:center;justify-content:center}
  /* Медальоны одного размера в круглой оправе: знаки у ведомств разной формы и
     пропорций, и без оправы ряд выглядит как случайная россыпь картинок. */
  .em{width:78px;height:78px;border-radius:50%;object-fit:contain;padding:8px;background:rgba(255,255,255,.86);
      border:2px solid ' . $t['line'] . ';box-shadow:0 3px 9px rgba(0,0,0,.32)}
  .foot{font-size:15.5px;letter-spacing:.4px;padding:7px 24px;border-radius:5px;
        background:' . $plateBg . ';border:1px solid ' . $t['line'] . ';color:' . $t['ink'] . '}
  /* Средний блок тоже на подложке: название и сроки читаются поверх любого фона,
     включая тёмные генерации с яркими бликами по центру. */
  .mid{background:' . $plateSoft . ';border-radius:10px;padding:10px 40px 14px}
</style></head><body><div class="frame">
  <div class="law">
    Зарегистрирован в официальном российском федеральном органе исполнительной власти Роскомнадзор от 24.06.2025 №094084.
    Конкурс проводится на основании закона «Гражданский кодекс Российской Федерации (часть вторая)» от 26.01.1996 N 14-ФЗ
    (ред. от 01.07.2021, с изм. от 08.07.2021) ГК РФ Глава 57 — публичный конкурс.
    Выполнение указа Президента РФ «Об утверждении Основ государственной культурной политики» № 808 от 24 декабря 2014 года.
  </div>
  <div class="brand">' . ($logo !== '' ? '<img src="' . $logo . '" alt="">' : '') . '
    <b>Культурный центр «Музыкальный Мир»</b>
  </div>
  <div class="support">При информационной поддержке Министерства культуры и образования субъектов
    Российской Федерации и государственного портала «Pro Культура»</div>
  <div class="mid">
    <div class="kind">' . $h($kind) . '</div>
    <div class="name">' . $h($name) . '</div>
    <div style="margin-top:12px"><div class="terms">' . $h(afisha_terms($c)) . '</div></div>
    ' . ($srok !== '' ? '<div class="srok" style="margin-top:11px">' . $h($srok) . '</div>' : '') . '
    <div class="adv">Компетентное жюри • Квалифицированная оценка • Денежные премии</div>
  </div>
  <div class="ems">' . $emblemHtml . '</div>
  <div class="foot">Российская Федерация, город Москва — ' . $h($year) . ' год</div>
</div></body></html>';
}
