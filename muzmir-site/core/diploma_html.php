<?php
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
declare(strict_types=1);

/** Конфиг элемента из шаблона. */
function _dh_cfg(array $tpl, string $key): array {
    $e = $tpl['els'][$key] ?? [];
    return ['dy' => (float)($e['dy'] ?? 0), 'fs' => isset($e['fs']) ? (float)$e['fs'] : null,
            'hide' => !empty($e['hide'])];
}
/** style="" для элемента: вертикальный сдвиг + кегль + скрытие. */
function _dh_style(array $cfg, ?float $baseFs = null): string {
    $s = '';
    if ($cfg['dy'] !== 0.0) $s .= 'transform:translateY(' . $cfg['dy'] . 'mm);';
    if ($cfg['fs'] !== null && $baseFs !== null) $s .= 'font-size:' . $cfg['fs'] . 'pt;';
    if ($cfg['hide']) $s .= 'display:none;';
    return $s !== '' ? ' style="' . $s . '"' : '';
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
            'fonts'   => 'Prata',
            'ff_comp' => "'Prata',serif", 'ls_comp' => '4px',
            'grad_comp'   => 'linear-gradient(180deg,#EAF7FF 0%,#BFE9FF 30%,#7FC9F0 55%,#CDEFFF 80%,#FFFFFF 100%)',
            'grad_dtype'  => 'linear-gradient(180deg,#FFF6C4 0%,#FFD54F 18%,#FFC107 38%,#D4A017 52%,#B8860B 62%,#FFC107 80%,#FFF3B0 100%)',
            'grad_degree' => 'linear-gradient(180deg,#FFFFFF 0%,#CFEFFF 35%,#8FD4F5 65%,#E8F9FF 100%)',
            'name_color' => '#BFE9FF', 'ff_name' => "'Prata',serif",
            'script_font' => 'Pacifico', 'ff_script' => "'Pacifico',cursive", 'script_fs' => 36, 'script_color' => '#D6F1FF',
        ],
        // Зенит, триумф: античная классика, тёплое торжественное золото.
        'zenith' => [
            'fonts'   => 'Forum',
            'ff_comp' => "'Forum',serif", 'ls_comp' => '5px',
            'grad_comp'   => 'linear-gradient(180deg,#FFF7D6 0%,#FFE082 25%,#E9C567 45%,#B8860B 58%,#E9C567 75%,#FFF3B0 100%)',
            'grad_dtype'  => 'linear-gradient(180deg,#FFFBE8 0%,#FFE082 20%,#F5C542 40%,#C9971C 55%,#A67C10 65%,#E9C567 82%,#FFF7D6 100%)',
            'grad_degree' => 'linear-gradient(180deg,#FFFFFF 0%,#FFF3C4 30%,#F0CE72 60%,#D4A017 85%,#FFE082 100%)',
            'name_color' => '#FFE99C', 'ff_name' => "'Forum',serif",
            'script_font' => 'Marck+Script', 'ff_script' => "'Marck Script',cursive", 'script_fs' => 40, 'script_color' => '#FFE99C',
        ],
        // Театр, сцена: бархат и шампань, тёплый кремовый свет рампы.
        'theatre' => [
            'fonts'   => 'Cormorant+Garamond:wght@600;700',
            'ff_comp' => "'Cormorant Garamond',serif", 'ls_comp' => '3px',
            'grad_comp'   => 'linear-gradient(180deg,#FFF6E8 0%,#FFE3B0 30%,#F2BE6A 55%,#D89A3D 70%,#FFDFA6 100%)',
            'grad_dtype'  => 'linear-gradient(180deg,#FFF9EC 0%,#FFE7B8 22%,#F4C878 42%,#D89A3D 56%,#B87526 66%,#F2BE6A 82%,#FFF2D8 100%)',
            'grad_degree' => 'linear-gradient(180deg,#FFFFFF 0%,#FFF0D6 32%,#F2CE8E 62%,#D89A3D 88%,#FFE3B0 100%)',
            'name_color' => '#FFE9C4', 'ff_name' => "'Cormorant Garamond',serif",
            'script_font' => 'Poiret+One', 'ff_script' => "'Poiret One',cursive", 'script_fs' => 42, 'script_color' => '#FFE3B0',
        ],
        // Держава: имперское золото с рубиновым отблеском, строгая антиква.
        'derzhava' => [
            'fonts'   => 'Old+Standard+TT:wght@700',
            'ff_comp' => "'Old Standard TT',serif", 'ls_comp' => '4px',
            'grad_comp'   => 'linear-gradient(180deg,#FFF3C4 0%,#FFD766 22%,#E8A93C 45%,#B8641B 60%,#E8A93C 78%,#FFE9A6 100%)',
            'grad_dtype'  => 'linear-gradient(180deg,#FFF6D0 0%,#FFD766 20%,#F0AE3C 40%,#C4571E 55%,#A63E14 63%,#E8A93C 80%,#FFE9A6 100%)',
            'grad_degree' => 'linear-gradient(180deg,#FFFFFF 0%,#FFEFC0 30%,#F0C868 60%,#D08A20 85%,#FFD766 100%)',
            'name_color' => '#FFE9A6', 'ff_name' => "'Old Standard TT',serif",
            'script_font' => 'Lobster', 'ff_script' => "'Lobster',cursive", 'script_fs' => 37, 'script_color' => '#FFD98F',
        ],
        // Классика эталона (фолбэк).
        'classic' => [
            'fonts'   => '',
            'ff_comp' => "'Playfair Display',serif", 'ls_comp' => '3px',
            'grad_comp'   => 'linear-gradient(180deg,#FFF3B0 0%,#FFD54F 20%,#C9A84C 45%,#8B6F1F 55%,#C9A84C 75%,#FFE082 100%)',
            'grad_dtype'  => 'linear-gradient(180deg,#FFF3B0 0%,#FFD54F 15%,#FFC107 30%,#D4A017 45%,#A67C10 55%,#D4A017 70%,#FFC107 85%,#FFF3B0 100%)',
            'grad_degree' => 'linear-gradient(180deg,#FFF3B0 0%,#FFD54F 25%,#D4A017 55%,#A67C10 75%,#FFC107 100%)',
            'name_color' => '#FFE082', 'ff_name' => "'Playfair Display',serif",
            'script_font' => 'Marck+Script', 'ff_script' => "'Marck Script',cursive", 'script_fs' => 40, 'script_color' => '#FFE082',
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
    $overlay = isset($tpl['overlay']) ? max(0, min(100, (int)$tpl['overlay'])) : ($bgUrl ? 55 : 0);
    $fade    = isset($tpl['fade']) ? max(30, min(160, (int)$tpl['fade'])) : 105;
    $T       = diploma_theme_pick($c, $tpl);

    $isIntl   = ($c['type'] ?? '') === 'international';
    $typeGenM = $isIntl ? 'международного' : 'всероссийского';   // род. падеж
    $compType = ($isIntl ? 'Международный' : 'Всероссийский') . ' многожанровый конкурс';
    $compName = mb_strtoupper(trim((string)($c['name'] ?? '')) ?: 'НАЗВАНИЕ КОНКУРСА');
    $extra    = trim((string)($a['extra_diploma'] ?? ''));
    // Основной диплом: степень = аттестационный результат (ГРАН-ПРИ/ЛАУРЕАТ/…).
    // Дополнительный диплом ($isExtra): степень = спецноминация (ЗА АРТИСТИЗМ и т.п.).
    $degree   = $isExtra
        ? (mb_strtoupper($extra) ?: 'ЗА ТВОРЧЕСКИЕ ДОСТИЖЕНИЯ')
        : (mb_strtoupper(trim((string)($a['result'] ?? ''))) ?: 'ЛАУРЕАТ 1 СТЕПЕНИ');
    $dtype    = $thanks ? 'БЛАГОДАРНОСТЬ' : 'ДИПЛОМ';
    $name     = trim((string)($a['full_name'] ?? '')) ?: 'Иванов Иван Иванович';
    $year     = date('Y');

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
            'Преподаватель'         => 'Иванов Иван Иванович',
            'Название учреждения'   => 'указать ваше учреждение и город',
            'Конкурсный номер'      => 'Указать название вашего конкурсного номера',
        ];
    } else {
        $fields = [];
        if (!empty($a['group_name']))   $fields['Название коллектива'] = $a['group_name'];
        if (!empty($a['age_category'])) $fields['Возрастная категория'] = $a['age_category'];
        if (!empty($a['nomination']))   $fields['Номинация'] = $a['nomination'];
        if (!empty($a['teacher']))      $fields['Преподаватель'] = $a['teacher'];
        if (!empty($a['institution']))  $fields['Название учреждения'] = $a['institution'] . (!empty($a['city']) ? ', ' . $a['city'] : '');
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
        . ' и искусству, посредством участия в международных культурных мероприятиях.';

    $roleChairman = 'Лауреат международных и всероссийских конкурсов и фестивалей, председатель'
        . ' оргкомитета ' . $typeGenM . ' конкурса культуры и искусства «'
        . trim((string)($c['name'] ?? 'Название конкурса')) . '»';
    $roleDirector = 'Лауреат международных и всероссийских конкурсов и фестивалей, заслуженный'
        . ' деятель культуры, генеральный директор Культурного центра «Музыкальный Мир»';

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
.content{position:relative;z-index:3;padding:8mm 12mm 0;height:100%}
.header-legal{text-align:center;font-size:7.5pt;line-height:1.3;color:#fff;margin-bottom:3mm}
.header-legal .org-name{font-family:'Playfair Display',serif;font-size:19pt;font-weight:900;margin-bottom:2mm;color:#fff}
.header-legal .legal-text{font-weight:600;color:#fff}
/* Ряд логотипов: светлые версии для тёмных фонов, выровнены по центру */
.logos-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:2mm;padding:0 2mm}
.logos-row .logo{width:auto;filter:drop-shadow(0 2px 6px rgba(0,0,0,.45))}
.logos-row .logo-prok{height:16mm}
.logos-row .logo-medal{height:21mm}
.logos-row .logo-natsproekty{height:19mm}
.logos-row .logo-center{height:36mm;flex-shrink:0;margin:0 2mm}
.competition-type{text-align:center;font-family:'Playfair Display',serif;font-size:15.5pt;font-weight:800;color:#fff;margin-bottom:1.5mm}
.competition-name{text-align:center;font-family:<?= $T['ff_comp'] ?>;font-size:37pt;font-weight:900;
  background:<?= $T['grad_comp'] ?>;
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
  letter-spacing:<?= $T['ls_comp'] ?>;margin-bottom:2mm;line-height:1.05;filter:drop-shadow(0 2px 4px rgba(0,0,0,.65))}
.support-line{text-align:center;font-family:'Playfair Display',serif;font-size:11.5pt;font-weight:700;line-height:1.3;margin-bottom:3mm;padding:0 5mm;color:#fff}
.diploma-type{text-align:center;font-family:<?= $T['ff_comp'] ?>;font-size:<?= $thanks ? 48 : 58 ?>pt;font-weight:900;
  background:<?= $T['grad_dtype'] ?>;
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
  letter-spacing:5px;margin-bottom:1mm;filter:drop-shadow(0 3px 6px rgba(0,0,0,.7));line-height:1}
.diploma-degree{text-align:center;font-family:<?= $T['ff_comp'] ?>;font-size:33pt;font-weight:900;
  background:<?= $T['grad_degree'] ?>;
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;
  letter-spacing:4px;margin-bottom:2.5mm;filter:drop-shadow(0 2px 5px rgba(0,0,0,.7));line-height:1}
.extra-award{text-align:center;font-family:'Playfair Display',serif;font-size:14.5pt;font-weight:800;color:<?= $T['name_color'] ?>;margin:-1.5mm 0 2.5mm;filter:drop-shadow(0 1px 3px rgba(0,0,0,.6))}
.awarded-label{text-align:center;font-family:'Playfair Display',serif;font-size:15pt;font-weight:700;color:#fff;margin-bottom:1mm}
.awarded-name{text-align:center;font-family:<?= $T['ff_name'] ?>;font-size:29pt;font-weight:900;color:<?= $T['name_color'] ?>;margin-bottom:3mm;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))}
.awarded-name-script{text-align:center;font-family:<?= $T['ff_script'] ?>;font-size:<?= $T['script_fs'] ?>pt;color:<?= $T['script_color'] ?>;margin-bottom:3mm;filter:drop-shadow(0 2px 6px rgba(0,0,0,.7));line-height:1}
.field-list{padding:0 6mm;font-family:'Playfair Display',serif;font-size:<?= $fldFs ?>pt;font-weight:700;line-height:<?= $fldLh ?>;text-align:center}
.field-list .field{color:#fff;filter:drop-shadow(0 1px 3px rgba(0,0,0,.5))}
/* Текст благодарности сжат так, чтобы гарантированно не доставать до подписей */
.gratitude-text{padding:0 7mm;font-family:'Playfair Display',serif;font-size:11.5pt;font-weight:700;line-height:1.42;text-align:center;color:#fff;filter:drop-shadow(0 1px 3px rgba(0,0,0,.5))}
.bottom-block{position:absolute;bottom:10mm;left:14mm;right:14mm;z-index:4;color:#1a1a2a}
/* Фиксированные высоты строк: блок подписей никогда не наезжает на поля выше.
 * Круглая печать сознательно «выступает» вверх поверх листа, как настоящая. */
.signatures-grid{display:grid;grid-template-columns:1fr 82mm;grid-template-rows:20mm 24mm;gap:4mm 4mm;align-items:center}
.sig-text-block{font-family:'Manrope',sans-serif;font-size:9.5pt;line-height:1.32;padding-right:3mm}
.sig-text-block .sig-name{font-weight:800;text-decoration:underline;margin-bottom:1mm;color:#1a1a2a;font-size:11pt}
.sig-text-block .sig-role{font-weight:600;color:#1a1a2a}
.sig-visual-block{display:grid;grid-template-columns:1fr auto;gap:2mm;align-items:center;position:relative;height:100%}
/* Штамп председателя поднят: круглая печать касается его лишь слегка снизу */
.chairman-stamp{width:auto;max-width:55mm;max-height:20mm;display:block;justify-self:end;transform:translateY(-8mm)}
.big-seal{width:40mm;height:auto;display:block;justify-self:end;opacity:.92;margin-top:-14mm}
/* Росписи увеличены в 1.8 раза через scale — позиция не сдвигается */
.sig-signature-1{width:26mm;height:auto;display:block;transform:scale(1.8);transform-origin:center right}
.sig-signature-2{width:28mm;height:auto;display:block;transform:scale(1.8);transform-origin:center right}
.footer-city{text-align:center;margin-top:4mm;font-family:'Playfair Display',serif;font-size:12.5pt;font-weight:700;color:#1a1a2a}
/* Номер диплома + QR проверки подлинности — правый нижний угол. */
.dip-verify{position:absolute;right:7mm;bottom:6mm;z-index:6;display:flex;flex-direction:column;align-items:center;gap:.7mm}
.dip-verify .qr{width:15mm;height:15mm;background:#fff;padding:1mm;border-radius:1.5mm;box-shadow:0 1px 4px rgba(0,0,0,.25)}
.dip-verify .qr svg{width:100%;height:100%;display:block}
.dip-verify .num{font-family:'Manrope',sans-serif;font-size:7pt;font-weight:800;color:#1a1a2a;letter-spacing:.3px}
.dip-verify .lbl{font-family:'Manrope',sans-serif;font-size:5.6pt;font-weight:600;color:#3a3a4a;text-transform:uppercase;letter-spacing:.4px}
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
  <div class="bg-white-gradient"></div>
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
      <div class="diploma-degree"<?= $D('degree') . _dh_style($e, 28.0) ?>><?= h($degree) ?></div>
      <?php /* Доп. награда печатается ОТДЕЛЬНЫМ дипломом (diploma_html(...,['extra'=>true])), не строкой здесь. */ ?>

      <?php $e = $E('label'); ?>
      <div class="awarded-label"<?= $D('label') . _dh_style($e, 15.0) ?>>награждается:</div>
      <?php $e = $E('name'); ?>
      <div class="awarded-name"<?= $D('name') . _dh_style($e, 24.0) ?>><?= h($name) ?></div>

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
      <div class="awarded-name-script"<?= $D('name') . _dh_style($e, 36.0) ?>><?= h($name) ?></div>

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
      </div>
    </div>
    <div class="footer-city">Российская Федерация, город Москва - <?= $year ?></div>
  </div>
  <?php /* Номер + QR + «проверка подлинности» — ВСЕГДА (номер даже без QR). */ ?>
  <div class="dip-verify">
    <?php if ($qrSvg !== ''): ?><div class="qr"><?= $qrSvg ?></div><?php endif; ?>
    <div class="num">№ <?= h($dipNumber) ?></div>
    <div class="lbl">проверка подлинности</div>
  </div>
</div>
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
