<?php
/**
 * offer-poster.php — афиша постоянного предложения центра, 16:9.
 *
 * Два вида: партнёрство для учреждений и клуб постоянных участников. Оба
 * предложения до сих пор жили только текстом в письмах и на сайте, и в ленте
 * их пролистывали не читая.
 *
 * Афиша намеренно повторяет наш сертификат: та же кремовая бумага, та же
 * золотая рамка с гильошем и угловыми маркерами, те же шрифты. Учреждение
 * узнаёт документ центра с одного взгляда, и предложение читается как
 * официальное, а не как реклама. Подписей и печатей здесь нет: это афиша, а не
 * документ, и ставить на неё печать было бы неправдой.
 *
 * Отдаётся страницей и снимается браузером на бастионе в PNG 1920×1080
 * (scripts/make_offer_posters.php). Доступ закрыт тем же ключом, что и бланки.
 *
 *   /tests/offer-poster.php?kind=partner&key=…
 *   /tests/offer-poster.php?kind=club&key=…
 */
declare(strict_types=1);

define('BASE_PATH', '/var/www/muzmir');
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/diploma_render.php';
require_once BASE_PATH . '/core/qr.php';

if ((string) ($_GET['key'] ?? '') !== diploma_render_key()) { http_response_code(403); exit('forbidden'); }

$kind = ($_GET['kind'] ?? 'partner') === 'club' ? 'club' : 'partner';
$base = rtrim((string) cfgv('base_url'), '/');
$logo = $base . '/assets/img/logo_muzmir_512.png';
$site = (string) cfgv('domain', 'музыкальный-мир.рф');

if ($kind === 'club') {
    $price     = (int) (function_exists('setting') ? setting('club_price', '1000') : 1000);
    $priceYear = (int) (function_exists('setting') ? setting('club_price_year', '10000') : 10000);
    $disc      = (int) (function_exists('setting') ? setting('club_discount', '20') : 20);
    $eyebrow = 'Постоянным участникам конкурсов';
    $title   = 'Клуб участников';
    $lead    = 'Ежемесячная подписка для тех, кто участвует регулярно';
    $points  = [
        ['Скидка ' . $disc . '%',            'на оргвзносы, дипломы, кубки, медали и наградные материалы'],
        ['Результаты за 3 дня',              'вместо пяти рабочих: дипломы приходят раньше всех'],
        ['Бесплатный конкурс каждый месяц',  'с электронным дипломом участника'],
        ['Сертификат участника Клуба',       'именной, с проверкой подлинности'],
        ['Приоритетная проверка заявок',     'работы членов Клуба жюри смотрит первыми'],
        ['Моментальный ответ в чате',        'вне очереди: обычный ответ занимает 5-15 минут'],
    ];
    $facts = [
        [number_format($price, 0, '.', ' ') . ' ₽',     'в месяц'],
        [number_format($priceYear, 0, '.', ' ') . ' ₽', 'в год'],
        ['Отмена в 1 клик',                              'в личном кабинете'],
    ];
    $link = $base . '/club';
    $linkLabel = $site . '/club';
} else {
    $eyebrow = 'Школам искусств, домам культуры, центрам творчества';
    $title   = 'Информационный партнёр';
    $lead    = 'Статус для учреждения: бесплатно и без обязательств';
    $points  = [
        ['Именной сертификат партнёра',      'на бланке центра, с проверкой подлинности по QR-коду'],
        ['Право использовать статус',        'на сайте учреждения, в отчётности и материалах'],
        ['Кабинет и персональная ссылка',    'заявки учеников автоматически засчитываются учреждению'],
        ['Благодарственные письма',          'руководству и каждому педагогу-куратору, с 5 заявок'],
        ['Промокод на скидку 10%',           'для участников учреждения, с 10 заявок'],
        ['Приоритетная аттестация',          'результаты и дипломы за 4 рабочих дня вместо пяти'],
    ];
    $facts = [
        ['Бесплатно',   'участие в программе'],
        ['1 нажатие',   'согласие без ответного письма'],
        ['1 год',       'срок действия сертификата'],
    ];
    $link = $base . '/partner';
    $linkLabel = $site . '/partner';
}

$qrSvg = qr_svg($link);
?><!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<title>Афиша — <?= htmlspecialchars($title, ENT_QUOTES) ?></title>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Playfair+Display:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1920px;height:1080px;overflow:hidden}
  body{font-family:'Manrope',sans-serif;color:#2A1E06;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .sheet{position:relative;width:1920px;height:1080px;overflow:hidden;
    background:radial-gradient(120% 90% at 50% 0%,#FFFDF4 0%,#FDF6E2 46%,#F7E9C4 100%)}

  /* Рамка, гильош и углы — как на сертификате центра. */
  .frame-out{position:absolute;inset:34px;border:14px solid transparent;border-radius:14px;
    background:linear-gradient(135deg,#E9CE84 0%,#C79322 26%,#F6E2A8 52%,#C79322 76%,#E9CE84 100%) border-box;
    -webkit-mask:linear-gradient(#000 0 0) padding-box,linear-gradient(#000 0 0);
    -webkit-mask-composite:xor;mask-composite:exclude}
  .frame-in{position:absolute;inset:58px;border:2px solid rgba(160,116,20,.55);border-radius:8px}
  .frame-in::before{content:"";position:absolute;inset:8px;border:1px solid rgba(160,116,20,.35);border-radius:6px}
  .guilloche{position:absolute;inset:58px;opacity:.13;
    background:
      repeating-linear-gradient(58deg,rgba(160,116,20,.55) 0 1px,transparent 1px 17px),
      repeating-linear-gradient(-58deg,rgba(160,116,20,.40) 0 1px,transparent 1px 23px)}
  .corner{position:absolute;width:104px;height:104px;border:3px solid rgba(160,116,20,.5)}
  .corner.tl{top:76px;left:76px;border-right:0;border-bottom:0;border-radius:14px 0 0 0}
  .corner.tr{top:76px;right:76px;border-left:0;border-bottom:0;border-radius:0 14px 0 0}
  .corner.bl{bottom:76px;left:76px;border-right:0;border-top:0;border-radius:0 0 0 14px}
  .corner.br{bottom:76px;right:76px;border-left:0;border-top:0;border-radius:0 0 14px 0}

  .content{position:absolute;top:84px;left:130px;right:130px;bottom:250px;display:flex;flex-direction:column;align-items:center}
  .logo{width:104px;height:104px;object-fit:contain}
  .org{margin-top:10px;font-weight:800;font-size:19px;letter-spacing:.22em;text-transform:uppercase;color:#7A5A12}
  .eyebrow{margin-top:20px;font-weight:700;font-size:19px;letter-spacing:.16em;text-transform:uppercase;color:#6B4C10;text-align:center}
  .title{font-family:'Playfair Display',serif;font-weight:600;font-size:74px;letter-spacing:.03em;
    text-transform:uppercase;color:#8A6512;margin-top:10px;line-height:1;text-align:center}
  .rule{width:520px;height:3px;margin:22px 0 20px;border-radius:2px;
    background:linear-gradient(90deg,transparent,#C79322 22%,#F1DDA0 50%,#C79322 78%,transparent)}
  .lead{font-size:25px;color:#4A3308;font-weight:600;letter-spacing:.02em;text-align:center}

  .points{margin-top:30px;width:100%;flex:1;display:grid;grid-template-columns:1fr 1fr;
    grid-template-rows:repeat(3,1fr);gap:8px 46px;align-content:center}
  .pt{display:flex;gap:16px;align-items:flex-start;align-self:center}
  .pt .mark{flex:0 0 auto;width:30px;height:30px;margin-top:3px;border-radius:50%;
    border:2px solid rgba(160,116,20,.6);background:rgba(255,255,255,.55);
    display:flex;align-items:center;justify-content:center;color:#8A6512;font-weight:800;font-size:16px}
  .pt b{display:block;font-size:25px;font-weight:800;color:#2A1E06;line-height:1.2}
  .pt span{display:block;margin-top:5px;font-size:19px;line-height:1.4;color:#4A3308;font-weight:600}

  .bottom{position:absolute;left:130px;right:130px;bottom:96px;display:flex;align-items:flex-end;justify-content:space-between}
  .facts{display:flex;gap:20px}
  .fact{min-width:250px;padding:16px 26px;border:2px solid rgba(160,116,20,.45);border-radius:10px;
    background:rgba(255,255,255,.45);text-align:center}
  .fact b{display:block;font-weight:800;font-size:30px;color:#2A1E06;letter-spacing:.01em}
  .fact span{display:block;margin-top:5px;font-size:15px;letter-spacing:.1em;text-transform:uppercase;color:#7A5A12;font-weight:700}
  .verify{text-align:center}
  .verify .qr{width:150px;height:150px;padding:9px;background:#fff;border:2px solid rgba(160,116,20,.55);border-radius:8px}
  .verify .qr svg{width:100%;height:100%;display:block}
  .verify .l{margin-top:9px;font-size:17px;font-weight:800;color:#5A4310;letter-spacing:.02em}
</style></head>
<body>
<div class="sheet">
  <div class="frame-out"></div>
  <div class="guilloche"></div>
  <div class="frame-in"></div>
  <div class="corner tl"></div><div class="corner tr"></div>
  <div class="corner bl"></div><div class="corner br"></div>

  <div class="content">
    <img class="logo" src="<?= htmlspecialchars($logo, ENT_QUOTES) ?>" alt="">
    <div class="org">Культурный центр «Музыкальный Мир»</div>
    <div class="eyebrow"><?= htmlspecialchars($eyebrow, ENT_QUOTES) ?></div>
    <div class="title"><?= htmlspecialchars($title, ENT_QUOTES) ?></div>
    <div class="rule"></div>
    <div class="lead"><?= htmlspecialchars($lead, ENT_QUOTES) ?></div>

    <div class="points">
      <?php foreach ($points as $i => [$head, $desc]): ?>
        <div class="pt">
          <div class="mark"><?= $i + 1 ?></div>
          <div><b><?= htmlspecialchars($head, ENT_QUOTES) ?></b><span><?= htmlspecialchars($desc, ENT_QUOTES) ?></span></div>
        </div>
      <?php endforeach; ?>
    </div>
  </div>

  <div class="bottom">
    <div class="facts">
      <?php foreach ($facts as [$b, $s]): ?>
        <div class="fact"><b><?= htmlspecialchars($b, ENT_QUOTES) ?></b><span><?= htmlspecialchars($s, ENT_QUOTES) ?></span></div>
      <?php endforeach; ?>
    </div>
    <div class="verify">
      <div class="qr"><?= $qrSvg ?></div>
      <div class="l"><?= htmlspecialchars($linkLabel, ENT_QUOTES) ?></div>
    </div>
  </div>
</div>
</body></html>
