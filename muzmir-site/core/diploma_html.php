<?php
/**
 * core/diploma_html.php — HTML-сборщик дипломов по эталону Даниэля (A4 портрет).
 *
 * diploma_html(array $c, array $a, array $opt=[]): string — полная HTML-страница диплома.
 *   $c — конкурс (name, type, diploma_bg, diploma_template JSON-конфиг редактора);
 *   $a — заявка (full_name, group_name, age_category, nomination, teacher,
 *        institution, work_title, result, extra_diploma);
 *   $opt: sample(bool) — водяной знак «ОБРАЗЕЦ», thanks(bool) — благодарность,
 *         edit(bool) — data-el атрибуты для визуального редактора админки.
 *
 * Структура и стили скопированы из эталона diplom_laureat2.html (шрифты, золотые
 * градиенты, ряд гербов, подписи и печати). Фон: загруженная картинка А4
 * (competitions.diploma_bg) + белое растворение снизу для читаемости подписей;
 * без картинки — градиентная тема bg-classic из эталона.
 *
 * Конфиг редактора (competitions.diploma_template, JSON):
 *   {"els":{"<ключ>":{"dy":мм,"fs":pt,"hide":0|1}}, "overlay":0..100}
 *   Ключи: org, legal, logos, comptype, compname, support, dtype, degree,
 *          label, name, fields, bottom.
 */
declare(strict_types=1);

/** Достаёт конфиг элемента. */
function _dh_cfg(array $tpl, string $key): array {
    $e = $tpl['els'][$key] ?? [];
    return ['dy' => (float)($e['dy'] ?? 0), 'fs' => isset($e['fs']) ? (float)$e['fs'] : null,
            'hide' => !empty($e['hide'])];
}
/** style="" для элемента: сдвиг по вертикали + размер шрифта. */
function _dh_style(array $cfg, ?float $baseFs = null): string {
    $s = '';
    if ($cfg['dy'] !== 0.0) $s .= 'transform:translateY(' . $cfg['dy'] . 'mm);';
    if ($cfg['fs'] !== null && $baseFs !== null) $s .= 'font-size:' . $cfg['fs'] . 'pt;';
    if ($cfg['hide']) $s .= 'display:none;';
    return $s !== '' ? ' style="' . $s . '"' : '';
}

function diploma_html(array $c, array $a, array $opt = []): string {
    $tpl = [];
    if (!empty($c['diploma_template'])) {
        $j = json_decode((string)$c['diploma_template'], true);
        if (is_array($j)) $tpl = $j;
    }
    $sample = !empty($opt['sample']);
    $thanks = !empty($opt['thanks']);
    $edit   = !empty($opt['edit']);

    $base   = rtrim(cfgv('base_url'), '/');
    $imgDip = $base . '/assets/img/diploma';
    $bgUrl  = '';
    if (!empty($c['diploma_bg'])) {
        $p = (string)$c['diploma_bg'];
        $bgUrl = preg_match('~^https?://~', $p) ? $p : $base . '/' . ltrim($p, '/');
    }
    $overlay = isset($tpl['overlay']) ? max(0, min(100, (int)$tpl['overlay'])) : 55;

    $isIntl   = ($c['type'] ?? '') === 'international';
    $compType = ($isIntl ? 'Международный' : 'Всероссийский') . ' многожанровый онлайн-конкурс культуры и искусства';
    $compName = mb_strtoupper((string)($c['name'] ?? 'НАЗВАНИЕ КОНКУРСА'));
    $degree   = mb_strtoupper((string)($a['result'] ?? 'ЛАУРЕАТ I СТЕПЕНИ'));
    $extra    = trim((string)($a['extra_diploma'] ?? ''));
    $dtype    = $thanks ? 'БЛАГОДАРНОСТЬ' : 'ДИПЛОМ';
    $name     = (string)($a['full_name'] ?? 'Иванов Иван Иванович');
    $year     = date('Y');

    // Поля карточки — только заполненные (педагог/учреждение/коллектив опциональны).
    $fields = [];
    if (!empty($a['group_name']))  $fields['Название коллектива'] = $a['group_name'];
    if (!empty($a['age_category']))$fields['Возрастная категория'] = $a['age_category'];
    if (!empty($a['nomination']))  $fields['Номинация'] = $a['nomination'];
    if (!empty($a['teacher']))     $fields['Преподаватель'] = $a['teacher'];
    if (!empty($a['institution'])) $fields['Название учреждения'] = $a['institution'] . (!empty($a['city']) ? ', ' . $a['city'] : '');
    if (!empty($a['work_title']))  $fields['Конкурсный номер'] = $a['work_title'];

    $E = static fn(string $k) => _dh_cfg($tpl, $k);
    $D = static fn(string $k) => $edit ? ' data-el="' . $k . '"' : '';

    ob_start(); ?>
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<title><?= h($dtype) ?> — <?= h($compName) ?></title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800;900&family=Manrope:wght@400;500;600;700;800&family=Marck+Script&family=Cormorant+Garamond:wght@600;700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box;margin:0;padding:0}
@page{size:A4 portrait;margin:0}
body{background:#444;font-family:'Manrope',sans-serif;min-height:100vh}
.diploma{width:210mm;height:297mm;margin:0 auto;position:relative;overflow:hidden;color:#fff;box-shadow:0 20px 60px rgba(0,0,0,.5)}
.bg-layer{position:absolute;inset:0;z-index:1;
  <?php if ($bgUrl): ?>background:url('<?= h($bgUrl) ?>') center/cover no-repeat;
  <?php else: ?>background:radial-gradient(ellipse at 50% 15%, rgba(40,70,130,.5) 0%, transparent 55%),linear-gradient(180deg,#0d1428 0%,#0a0f1f 40%,#0d1428 100%);<?php endif; ?>}
/* Тонирование для читаемости текста поверх фона (регулируется в редакторе) */
.bg-tone{position:absolute;inset:0;z-index:2;pointer-events:none;
  background:linear-gradient(180deg, rgba(8,12,28,<?= number_format($overlay/100*.62,2,'.','') ?>) 0%, rgba(8,12,28,<?= number_format($overlay/100*.38,2,'.','') ?>) 45%, rgba(8,12,28,0) 62%)}
/* Белое растворение снизу — блок подписей и печатей всегда читаем */
.bg-white-gradient{position:absolute;left:0;right:0;bottom:0;height:34%;z-index:2;pointer-events:none;
  background:linear-gradient(180deg, rgba(240,240,245,0) 0%, rgba(240,240,245,.1) 12%, rgba(245,245,250,.45) 35%, rgba(250,250,252,.82) 60%, rgba(255,255,255,.96) 100%)}
.content{position:relative;z-index:3;padding:10mm 14mm 0;height:100%}
.header-legal{text-align:center;font-size:7.5pt;line-height:1.35;color:#fff;margin-bottom:5mm;text-shadow:0 1px 3px rgba(0,0,0,.65)}
.header-legal .org-name{font-family:'Playfair Display',serif;font-size:17pt;font-weight:800;margin-bottom:3mm}
.header-legal .legal-text{font-weight:500}
.logos-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:3mm;padding:0 3mm}
.logos-row .logo{width:auto;filter:drop-shadow(0 2px 6px rgba(0,0,0,.45))}
.logos-row .logo-prok{height:18mm}.logos-row .logo-emblem{height:22mm}.logos-row .logo-rossia{height:22mm}
.logos-row .logo-natsproekty{height:20mm}.logos-row .logo-center{height:34mm;flex-shrink:0;margin:0 2mm}
.competition-type{text-align:center;font-family:'Playfair Display',serif;font-size:15pt;font-weight:700;color:#fff;margin-bottom:2mm;text-shadow:0 1px 4px rgba(0,0,0,.7)}
.competition-name{text-align:center;font-family:'Playfair Display',serif;font-size:30pt;font-weight:900;
  background:linear-gradient(180deg,#FFF3B0 0%,#FFD54F 20%,#C9A84C 45%,#8B6F1F 55%,#C9A84C 75%,#FFE082 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;letter-spacing:3px;margin-bottom:3mm;
  filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))}
.support-line{text-align:center;font-family:'Playfair Display',serif;font-size:12pt;font-weight:600;line-height:1.4;margin-bottom:4mm;padding:0 5mm;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.7)}
.diploma-type{text-align:center;font-family:'Playfair Display',serif;font-size:48pt;font-weight:900;
  background:linear-gradient(180deg,#FFF3B0 0%,#FFD54F 15%,#FFC107 30%,#D4A017 45%,#A67C10 55%,#D4A017 70%,#FFC107 85%,#FFF3B0 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;letter-spacing:6px;margin-bottom:1mm;
  filter:drop-shadow(0 3px 6px rgba(0,0,0,.7));line-height:1}
.diploma-degree{text-align:center;font-family:'Playfair Display',serif;font-size:28pt;font-weight:900;
  background:linear-gradient(180deg,#FFF3B0 0%,#FFD54F 25%,#D4A017 55%,#A67C10 75%,#FFC107 100%);
  -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;letter-spacing:4px;margin-bottom:2mm;
  filter:drop-shadow(0 2px 5px rgba(0,0,0,.7));line-height:1.15}
.extra-award{text-align:center;font-family:'Playfair Display',serif;font-size:14pt;font-weight:700;color:#FFE082;margin:-1mm 0 3mm;text-shadow:0 1px 4px rgba(0,0,0,.7)}
.awarded-label{text-align:center;font-family:'Playfair Display',serif;font-size:15pt;font-weight:600;color:#fff;margin-bottom:2mm;text-shadow:0 1px 4px rgba(0,0,0,.7)}
.awarded-name{text-align:center;font-family:'Playfair Display',serif;font-size:24pt;font-weight:700;color:#FFE082;margin-bottom:4mm;filter:drop-shadow(0 2px 4px rgba(0,0,0,.6))}
.field-list{max-width:150mm;margin:0 auto;font-size:11pt;line-height:1.75;color:#fff;text-shadow:0 1px 3px rgba(0,0,0,.75)}
.field-list .field strong{color:#FFE082;font-weight:700}
.bottom-block{position:absolute;bottom:10mm;left:14mm;right:14mm;z-index:4;color:#1a1a2a}
.signatures-grid{display:grid;grid-template-columns:1fr 82mm;grid-template-rows:auto auto;gap:4mm 4mm;align-items:center}
.sig-text-block{font-family:'Manrope',sans-serif;font-size:9.5pt;line-height:1.4;padding-right:3mm}
.sig-text-block .sig-name{font-weight:700;text-decoration:underline;margin-bottom:1mm;color:#1a1a2a;font-size:10.5pt}
.sig-text-block .sig-role{font-weight:500;color:#1a1a2a}
.sig-visual-block{display:grid;grid-template-columns:1fr auto;gap:2mm;align-items:center}
.chairman-stamp{width:100%;max-width:55mm;height:auto;display:block;justify-self:end}
.big-seal{width:42mm;height:auto;display:block;justify-self:end;opacity:.92}
.sig-signature-1{width:26mm;height:auto;display:block}
.sig-signature-2{width:28mm;height:auto;display:block}
.footer-city{text-align:center;margin-top:6mm;font-family:'Playfair Display',serif;font-size:12pt;font-weight:600;color:#1a1a2a}
.sample-mark{position:absolute;inset:0;z-index:9;display:flex;align-items:center;justify-content:center;pointer-events:none}
.sample-mark span{font-family:'Playfair Display',serif;font-weight:900;font-size:52pt;letter-spacing:14px;color:rgba(200,40,60,.28);transform:rotate(-28deg);border:6px solid rgba(200,40,60,.22);padding:6mm 14mm;border-radius:8mm}
<?php if ($edit): ?>[data-el]{outline:1px dashed rgba(255,215,80,.0);cursor:grab}[data-el]:hover{outline-color:rgba(255,215,80,.85)}<?php endif; ?>
@media print{body{background:#fff;padding:0}.diploma{box-shadow:none;margin:0}}
</style>
</head>
<body>
<div class="diploma">
  <div class="bg-layer"></div>
  <div class="bg-tone"></div>
  <div class="bg-white-gradient"></div>
  <?php if ($sample): ?><div class="sample-mark"><span>ОБРАЗЕЦ</span></div><?php endif; ?>

  <div class="content">
    <?php $e=$E('org'); ?><?php $e2=$E('legal'); ?>
    <div class="header-legal">
      <div class="org-name"<?= $D('org') . _dh_style($e, 17.0) ?>>Культурный центр «Музыкальный Мир»</div>
      <div class="legal-text"<?= $D('legal') . _dh_style($e2, 7.5) ?>>
        Зарегистрирован в официальном российском федеральном органе исполнительной власти Роскомнадзор от 24.06.2025 №094084<br>
        Конкурс проводится на основании закона «Гражданский кодекс Российской Федерации (часть вторая)» от 26.01.1996<br>
        N 14-ФЗ (ред. от 01.07.2021, с изм. от 08.07.2021) (с изм. и доп., вступ. в силу с 01.01.2022) ГК РФ Глава 57 — публичный конкурс.<br>
        Выполнение указа Президента РФ «Об утверждении Основ государственной культурной политики» № 808 от 24 декабря 2014 года.
      </div>
    </div>

    <?php $e=$E('logos'); ?>
    <div class="logos-row"<?= $D('logos') . _dh_style($e) ?>>
      <img class="logo logo-prok" src="<?= $imgDip ?>/logo_prok.png" alt="">
      <img class="logo logo-emblem" src="<?= $imgDip ?>/logo_emblem1.png" alt="">
      <img class="logo logo-rossia" src="<?= $imgDip ?>/logo_rossia.png" alt="">
      <img class="logo logo-center" src="<?= $imgDip ?>/logo_center.png" alt="">
      <img class="logo logo-emblem" src="<?= $imgDip ?>/logo_emblem2.png" alt="">
      <img class="logo logo-natsproekty" src="<?= $imgDip ?>/logo_natsproekty.png" alt="">
      <img class="logo logo-emblem" src="<?= $imgDip ?>/logo_emblem3.png" alt="">
    </div>

    <?php $e=$E('comptype'); ?>
    <div class="competition-type"<?= $D('comptype') . _dh_style($e, 15.0) ?>><?= h($compType) ?></div>
    <?php $e=$E('compname'); ?>
    <div class="competition-name"<?= $D('compname') . _dh_style($e, 30.0) ?>><?= h($compName) ?></div>
    <?php $e=$E('support'); ?>
    <div class="support-line"<?= $D('support') . _dh_style($e, 12.0) ?>>
      При информационной поддержке Министерства культуры и образования<br>
      субъектов Российской Федерации и государственного портала «Про.Культура»
    </div>

    <?php $e=$E('dtype'); ?>
    <div class="diploma-type"<?= $D('dtype') . _dh_style($e, 48.0) ?>><?= h($dtype) ?></div>
    <?php if (!$thanks): $e=$E('degree'); ?>
    <div class="diploma-degree"<?= $D('degree') . _dh_style($e, 28.0) ?>><?= h($degree) ?></div>
    <?php if ($extra !== ''): ?><div class="extra-award">Дополнительный диплом: <?= h(mb_strtoupper($extra)) ?></div><?php endif; ?>
    <?php endif; ?>

    <?php $e=$E('label'); ?>
    <div class="awarded-label"<?= $D('label') . _dh_style($e, 15.0) ?>><?= $thanks ? 'выражается:' : 'награждается:' ?></div>
    <?php $e=$E('name'); ?>
    <div class="awarded-name"<?= $D('name') . _dh_style($e, 24.0) ?>><?= h($name) ?></div>

    <?php $e=$E('fields'); ?>
    <div class="field-list"<?= $D('fields') . _dh_style($e, 11.0) ?>>
      <?php foreach ($fields as $k => $v): ?>
        <div class="field"><strong><?= h($k) ?>:</strong> <?= h((string)$v) ?></div>
      <?php endforeach; ?>
    </div>
  </div>

  <?php $e=$E('bottom'); ?>
  <div class="bottom-block"<?= $D('bottom') . _dh_style($e) ?>>
    <div class="signatures-grid">
      <div class="sig-text-block">
        <div class="sig-name">Галиулин Р.Р.</div>
        <div class="sig-role">Председатель жюри, заслуженный работник культуры</div>
      </div>
      <div class="sig-visual-block">
        <img class="chairman-stamp" src="<?= $imgDip ?>/stamp.png" alt="">
        <img class="sig-signature-1" src="<?= $imgDip ?>/sig1.png" alt="">
      </div>
      <div class="sig-text-block">
        <div class="sig-name">Ильясов А.И.</div>
        <div class="sig-role">Генеральный директор Культурного центра «Музыкальный Мир»</div>
      </div>
      <div class="sig-visual-block">
        <img class="big-seal" src="<?= $imgDip ?>/seal.png" alt="">
        <img class="sig-signature-2" src="<?= $imgDip ?>/sig2.png" alt="">
      </div>
    </div>
    <div class="footer-city">Российская Федерация, город Москва — <?= $year ?></div>
  </div>
</div>
</body>
</html>
<?php
    return (string)ob_get_clean();
}

/** Демо-данные для образца. */
function diploma_sample_app(): array {
    return ['full_name' => 'Иванова Анна Сергеевна', 'group_name' => '',
            'age_category' => '10-12 лет', 'nomination' => 'Вокальное искусство',
            'teacher' => 'Петрова Мария Ивановна',
            'institution' => 'ДШИ №1', 'city' => 'г. Москва',
            'work_title' => 'П.И. Чайковский «Вальс цветов»',
            'result' => 'ЛАУРЕАТ I СТЕПЕНИ', 'extra_diploma' => ''];
}
