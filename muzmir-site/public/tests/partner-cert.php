<?php
/**
 * partner-cert.php — сертификат «Информационный партнёр» КЦ «Музыкальный Мир».
 * Альбомный A4, всё содержимое строго внутри золотой рамки, QR-код проверки.
 *
 * Геометрия:
 *   Лист: 297×210 мм
 *   Золотая рамка: inset 8 мм (толщина 2.6 мм)
 *   Внутренняя линия: inset 13 мм
 *   Безопасная зона контента: inset 18–20 мм
 *
 * Внизу — 3 зоны в одну линию (Y ≈ 168–192 мм):
 *   • Колонка 1 (X 22–110): подпись Галиулина + маленькая печать председателя
 *   • Колонка 2 (X 118–210): подпись Ильясова + гербовая печать
 *   • Колонка 3 (X 218–275): QR-код проверки подлинности + номер
 */
declare(strict_types=1);

define('BASE_PATH','/var/www/muzmir');
$GLOBALS['CFG']=require BASE_PATH.'/config.php';
require_once BASE_PATH.'/core/db.php';
require_once BASE_PATH.'/core/helpers.php';
require_once BASE_PATH.'/core/diploma_render.php';
require_once BASE_PATH.'/core/qr.php';
require_once BASE_PATH.'/core/paylink.php';

$givenKey = (string) ($_GET['key'] ?? '');
if ($givenKey !== diploma_render_key()) { http_response_code(403); exit('forbidden'); }

$org        = trim((string) ($_GET['org']   ?? 'МБУДО «Детская школа искусств»'));
$region     = trim((string) ($_GET['reg']   ?? 'Владимирская область'));
$partnerNo  = trim((string) ($_GET['no']    ?? 'ИП-2026-00001'));
$since      = trim((string) ($_GET['since'] ?? date('d.m.Y')));
$till       = trim((string) ($_GET['till']  ?? date('d.m.Y', strtotime('+1 year'))));

$base   = rtrim((string) cfgv('base_url'), '/');
$imgDip = $base . '/assets/img/diploma';
$logo   = $base . '/assets/img/logo_muzmir_512.png';
$year   = date('Y');

$sig = substr(hash_hmac('sha256', 'partner-doc:' . $partnerNo, pay_secret()), 0, 16);
$verifyUrl = $base . '/verify-doc.php?n=' . rawurlencode($partnerNo) . '&s=' . $sig;
$qrSvg = qr_svg($verifyUrl);

$len = mb_strlen($org);
$namePt = $len <= 34 ? 26 : ($len <= 50 ? 22 : ($len <= 70 ? 18 : 15));

$roleChairman = 'Лауреат международных и всероссийских конкурсов и фестивалей,'
    . ' председатель оргкомитета КЦ «Музыкальный Мир»';
$roleDirector = 'Лауреат международных и всероссийских конкурсов и фестивалей, заслуженный'
    . ' деятель культуры, генеральный директор КЦ «Музыкальный Мир»';

?><!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<title>Сертификат Информационного партнёра — <?= htmlspecialchars($org, ENT_QUOTES) ?></title>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Playfair+Display:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  @page{size:297mm 210mm;margin:0}
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:297mm;height:210mm}
  body{font-family:'Manrope',sans-serif;color:#2A1E06;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .sheet{position:relative;width:297mm;height:210mm;overflow:hidden;
    background:radial-gradient(120% 90% at 50% 0%,#FFFDF4 0%,#FDF6E2 46%,#F7E9C4 100%)}

  /* ЗОЛОТАЯ РАМКА — inset 8mm, толщина 2.6mm */
  .frame-out{position:absolute;inset:8mm;border:2.6mm solid transparent;border-radius:3mm;
    background:linear-gradient(135deg,#E9CE84 0%,#C79322 26%,#F6E2A8 52%,#C79322 76%,#E9CE84 100%) border-box;
    -webkit-mask:linear-gradient(#000 0 0) padding-box,linear-gradient(#000 0 0);
    -webkit-mask-composite:xor;mask-composite:exclude}
  .frame-in{position:absolute;inset:13mm;border:0.5mm solid rgba(160,116,20,.55);border-radius:1.5mm}
  .frame-in::before{content:"";position:absolute;inset:1.6mm;border:0.25mm solid rgba(160,116,20,.35);border-radius:1mm}
  .corner{position:absolute;width:22mm;height:22mm;border:0.7mm solid rgba(160,116,20,.5)}
  .corner.tl{top:16mm;left:16mm;border-right:0;border-bottom:0;border-radius:3mm 0 0 0}
  .corner.tr{top:16mm;right:16mm;border-left:0;border-bottom:0;border-radius:0 3mm 0 0}
  .corner.bl{bottom:16mm;left:16mm;border-right:0;border-top:0;border-radius:0 0 0 3mm}
  .corner.br{bottom:16mm;right:16mm;border-left:0;border-top:0;border-radius:0 0 3mm 0}
  .guilloche{position:absolute;inset:13mm;opacity:.14;
    background:
      repeating-linear-gradient(58deg,rgba(160,116,20,.55) 0 .18mm,transparent .18mm 3.2mm),
      repeating-linear-gradient(-58deg,rgba(160,116,20,.40) 0 .18mm,transparent .18mm 4.4mm)}

  /* КОНТЕНТ ВЕРХНЯЯ ЧАСТЬ: Y 20mm – 140mm (безопасная зона) */
  .content{position:absolute;top:20mm;left:26mm;right:26mm;height:120mm;
    display:flex;flex-direction:column;align-items:center;text-align:center}
  .logo{width:22mm;height:22mm;object-fit:contain;margin-bottom:2mm}
  .org-hdr{font-family:'Manrope',sans-serif;font-weight:800;font-size:9.5pt;letter-spacing:.22em;
    text-transform:uppercase;color:#7A5A12;line-height:1.35}
  .title{font-family:'Playfair Display',serif;font-weight:600;font-size:30pt;letter-spacing:.06em;
    text-transform:uppercase;color:#8A6512;margin:3mm 0 1mm;line-height:1}
  .subtitle{font-family:'Manrope',sans-serif;font-weight:700;font-size:11pt;letter-spacing:.14em;
    text-transform:uppercase;color:#6B4C10}
  .rule{width:78mm;height:.6mm;margin:3mm 0 3mm;border-radius:1mm;
    background:linear-gradient(90deg,transparent,#C79322 22%,#F1DDA0 50%,#C79322 78%,transparent)}
  .lead{font-size:10.5pt;color:#4A3308;font-weight:600;letter-spacing:.04em}
  .name{font-family:'Playfair Display',serif;font-weight:600;color:#2A1E06;line-height:1.18;
    font-size:<?= $namePt ?>pt;margin:2mm 0 1mm;max-width:220mm}
  .region{font-size:10pt;color:#4A3308;font-weight:600;margin-bottom:1.5mm;font-style:italic}
  .desc{font-size:9.6pt;line-height:1.5;color:#3A2708;max-width:210mm;margin-top:1mm}
  .facts{display:flex;gap:5mm;margin-top:3mm}
  .fact{min-width:48mm;padding:2mm 5mm;border:.4mm solid rgba(160,116,20,.45);border-radius:2mm;
    background:rgba(255,255,255,.42)}
  .fact b{display:block;font-family:'Manrope',sans-serif;font-weight:800;font-size:10.5pt;color:#2A1E06;letter-spacing:.04em}
  .fact span{display:block;margin-top:.6mm;font-size:7pt;letter-spacing:.12em;text-transform:uppercase;color:#7A5A12;font-weight:700}

  /* ═══════════ НИЖНЯЯ ЗОНА (внутри рамки, всё ровно) ═══════════
     Три колонки на Y 148mm – 192mm:
       col1: X 22–110mm  (подпись + маленькая печать председателя)
       col2: X 118–210mm (подпись + гербовая печать)
       col3: X 218–274mm (QR + номер)
     Footer «Российская Федерация…» на Y 195mm (внутри 197mm рамки) */
  .signblock{position:absolute;top:148mm;left:22mm;width:188mm;height:44mm}
  .sig-col{position:absolute;top:0;width:88mm;height:44mm}
  .sig-col-1{left:0}
  .sig-col-2{left:100mm}
  /* Подпись + печать в одной зоне 44mm высотой */
  .sig-vis{position:absolute;top:0;left:0;right:0;height:22mm}
  .sig-vis .sg{position:absolute;left:6mm;bottom:-5mm;width:28mm;height:auto}
  .sig-vis .st{position:absolute;right:2mm;bottom:-2mm;width:26mm;height:auto;opacity:.92}
  .sig-line{position:absolute;top:24mm;left:0;right:0;height:.3mm;background:rgba(90,62,11,.55)}
  .sig-text{position:absolute;top:25mm;left:0;right:0;font-size:7.4pt;line-height:1.25;text-align:left}
  .sig-text .nm{font-weight:800;margin-bottom:.4mm;font-size:9pt;color:#1a1a2a}
  .sig-text .rl{font-weight:600;color:#2A1E06;font-size:6.8pt}

  /* QR-блок */
  .verify{position:absolute;top:150mm;left:218mm;width:56mm;text-align:center}
  .verify .qr{width:32mm;height:32mm;margin:0 auto 1.5mm;padding:1mm;background:#fff;
    border:.4mm solid rgba(160,116,20,.55);border-radius:1.5mm}
  .verify .qr svg{width:100%;height:100%;display:block}
  .verify .n{font-family:'Manrope',sans-serif;font-size:7.2pt;font-weight:800;color:#5A4310;letter-spacing:.02em}
  .verify .l{font-family:'Manrope',sans-serif;font-size:5.4pt;font-weight:700;color:#7A5A12;
    text-transform:uppercase;letter-spacing:.14em;margin-top:.6mm}

  /* Footer — «Российская Федерация, город Москва — год» */
  .footer-city{position:absolute;top:196mm;left:0;right:0;text-align:center;
    font-family:'Playfair Display',serif;font-size:10pt;color:#4A3308}
</style></head>
<body>
<div class="sheet">
  <div class="guilloche"></div>
  <div class="frame-out"></div>
  <div class="frame-in"></div>
  <span class="corner tl"></span><span class="corner tr"></span>
  <span class="corner bl"></span><span class="corner br"></span>

  <div class="content">
    <img class="logo" src="<?= htmlspecialchars($logo, ENT_QUOTES) ?>" alt="">
    <div class="org-hdr">Культурный центр «Музыкальный&nbsp;Мир»</div>
    <div class="title">Сертификат</div>
    <div class="subtitle">Информационного партнёра</div>
    <div class="rule"></div>
    <div class="lead">Настоящим удостоверяется, что</div>
    <div class="name"><?= htmlspecialchars($org, ENT_QUOTES) ?></div>
    <?php if ($region !== ''): ?>
    <div class="region"><?= htmlspecialchars($region, ENT_QUOTES) ?></div>
    <?php endif; ?>
    <div class="desc">является Информационным партнёром Культурного центра «Музыкальный Мир» и наделяется
      правом использования соответствующего статуса, а также пользуется всеми привилегиями
      партнёрской программы: бесплатными благодарственными письмами, промокодом на скидку 10%,
      приоритетной аттестацией конкурсных работ.</div>
    <div class="facts">
      <div class="fact"><b><?= htmlspecialchars($partnerNo, ENT_QUOTES) ?></b><span>номер партнёрства</span></div>
      <?php if ($since !== ''): ?><div class="fact"><b><?= htmlspecialchars($since, ENT_QUOTES) ?></b><span>партнёр с</span></div><?php endif; ?>
      <?php if ($till  !== ''): ?><div class="fact"><b><?= htmlspecialchars($till,  ENT_QUOTES) ?></b><span>действует до</span></div><?php endif; ?>
    </div>
  </div>

  <div class="signblock">
    <div class="sig-col sig-col-1">
      <div class="sig-vis">
        <img class="st" src="<?= htmlspecialchars($imgDip, ENT_QUOTES) ?>/stamp.png" alt="">
        <img class="sg" src="<?= htmlspecialchars($imgDip, ENT_QUOTES) ?>/sig1.png" alt="">
      </div>
      <div class="sig-line"></div>
      <div class="sig-text">
        <div class="nm">Галиулин Данил Дамирович</div>
        <div class="rl"><?= htmlspecialchars($roleChairman, ENT_QUOTES) ?></div>
      </div>
    </div>
    <div class="sig-col sig-col-2">
      <div class="sig-vis">
        <img class="st" src="<?= htmlspecialchars($imgDip, ENT_QUOTES) ?>/seal.png" alt="">
        <img class="sg" src="<?= htmlspecialchars($imgDip, ENT_QUOTES) ?>/sig2.png" alt="">
      </div>
      <div class="sig-line"></div>
      <div class="sig-text">
        <div class="nm">Ильясов Альберт Ильясович</div>
        <div class="rl"><?= htmlspecialchars($roleDirector, ENT_QUOTES) ?></div>
      </div>
    </div>
  </div>

  <div class="verify">
    <div class="qr"><?= $qrSvg ?></div>
    <div class="n">№ <?= htmlspecialchars($partnerNo, ENT_QUOTES) ?></div>
    <div class="l">проверка подлинности</div>
  </div>

  <div class="footer-city">Российская Федерация, город Москва — <?= $year ?></div>
</div>
</body></html>
