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

/** Размер афиши: пропорция утверждённых образцов — широкий баннер. */
const AFISHA_W = 1600;
const AFISHA_H = 615;

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

/** Тема конкурса: своя на каждый месяц, по кругу — соседние месяцы не близнецы. */
function afisha_theme_for(array $c): array {
    $themes = afisha_themes();
    $keys   = array_keys($themes);
    $forced = trim((string) ($c['afisha_theme'] ?? ''));
    if ($forced !== '' && isset($themes[$forced])) return $themes[$forced] + ['key' => $forced];
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
    if ((int) ($c['club_only'] ?? 0) === 1) return 'ТОЛЬКО ДЛЯ УЧАСТНИКОВ КЛУБА · ПРИЗОВОЙ ФОНД 100.000 ₽';
    if ((int) ($c['is_paid'] ?? 0) === 1)   return '«ОРГ. ВЗНОС ' . (int) ($c['price'] ?? 0) . ' ₽»';
    return 'УЧАСТИЕ БЕСПЛАТНОЕ';
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
    $bgImg = $bgRel !== '' ? afisha_img($bgRel) : '';
    $bgCss = $bgImg !== ''
        ? "background-image:linear-gradient(180deg,rgba(0,0,0,.30),rgba(0,0,0,.55)),url('" . $bgImg . "');background-size:cover;background-position:center"
        : 'background-image:' . $t['bg'];

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
  .law{font-size:11px;line-height:1.34;opacity:.85;max-width:1400px;letter-spacing:.1px}
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
  .foot{font-size:15.5px;letter-spacing:.4px;border-top:1px solid ' . $t['line'] . ';
        padding-top:8px;width:100%;color:' . $t['sub'] . '}
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
  <div>
    <div class="kind">' . $h($kind) . '</div>
    <div class="name">' . $h($name) . '</div>
  </div>
  <div>
    <div class="terms">' . $h(afisha_terms($c)) . '</div>
    ' . ($srok !== '' ? '<div class="srok" style="margin-top:10px">' . $h($srok) . '</div>' : '') . '
    <div class="adv">Компетентное жюри • Квалифицированная оценка • Денежные премии</div>
  </div>
  <div class="ems">' . $emblemHtml . '</div>
  <div class="foot">Российская Федерация, город Москва — ' . $h($year) . ' год</div>
</div></body></html>';
}
