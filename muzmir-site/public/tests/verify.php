<?php
/**
 * verify.php — универсальный эндпоинт проверки подлинности документов
 * Культурного центра «Музыкальный Мир». Партнёрские сертификаты, благодарственные
 * письма, обращения — все проверяются здесь по номеру + подписи.
 *
 * URL: /tests/verify.php?n=<номер>&s=<подпись>
 */
declare(strict_types=1);

define('BASE_PATH','/var/www/muzmir');
$GLOBALS['CFG']=require BASE_PATH.'/config.php';
require_once BASE_PATH.'/core/db.php';
require_once BASE_PATH.'/core/helpers.php';
require_once BASE_PATH.'/core/paylink.php';

$number = trim((string) ($_GET['n'] ?? ''));
$sig    = trim((string) ($_GET['s'] ?? ''));

// Восстанавливаемая подпись — та же логика, что у ol_sign() в official_letter.php
$expected = substr(hash_hmac('sha256', 'partner-doc:' . $number, pay_secret()), 0, 16);
$valid    = ($number !== '' && hash_equals($expected, $sig));

// Тип документа по префиксу номера
$docType = 'документ';
$icon    = '📄';
if (str_starts_with($number, 'ИП-'))         { $docType = 'Сертификат Информационного партнёра'; $icon = '🏅'; }
elseif (str_starts_with($number, 'БЛГ-ИП-')) { $docType = 'Благодарственное письмо (партнёрская программа)'; $icon = '📨'; }
elseif (preg_match('~^\d{8}/\d{3}$~', $number)) { $docType = 'Официальное обращение центра'; $icon = '✉'; }

?><!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Проверка подлинности документа — <?= htmlspecialchars($number, ENT_QUOTES) ?></title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font:16px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#2A1E06;
    background:radial-gradient(120% 90% at 50% 0%,#FFFDF4 0%,#FDF6E2 46%,#F7E9C4 100%);
    min-height:100vh;padding:40px 20px}
  .card{max-width:540px;margin:20px auto;background:#fff;border-radius:14px;
    box-shadow:0 8px 40px rgba(160,116,20,.18);overflow:hidden;
    border:2px solid <?= $valid ? '#BFE6CC' : '#E6C0C0' ?>}
  .head{padding:26px 30px;text-align:center;
    background:linear-gradient(135deg,<?= $valid ? '#EAF7EF,#D3EBDD' : '#FDF1F1,#F3D9D9' ?>)}
  .head .ic{font-size:52px;line-height:1;margin-bottom:8px}
  .head h1{font-size:22px;color:<?= $valid ? '#1E7A46' : '#8C2F2F' ?>;margin:6px 0 4px;font-weight:800}
  .head p{color:#4A4A55;font-size:14px}
  .body{padding:22px 30px 26px}
  .row{display:flex;padding:10px 0;border-bottom:1px solid #EEE8D8;font-size:14px}
  .row:last-child{border:0}
  .row .k{width:130px;color:#7A5A12;font-weight:600}
  .row .v{flex:1;color:#2A1E06;font-weight:600;word-break:break-word}
  .note{background:#FDF6E2;border:1px solid #E9CE84;border-radius:8px;padding:12px 16px;
    margin-top:16px;font-size:13px;color:#4A3308;line-height:1.55}
  .footer{padding:16px 30px 22px;background:#FBF6EA;border-top:1px solid #E9CE84;
    font-size:12px;color:#7A5A12;text-align:center;line-height:1.6}
  .footer a{color:#8A6512;text-decoration:none;font-weight:700}
  .logo{width:52px;height:52px;margin:0 auto 10px;display:block}
</style></head>
<body>
<div class="card">
  <div class="head">
    <img class="logo" src="/assets/img/logo_muzmir_256.png" alt="">
    <div class="ic"><?= $valid ? '✓' : '✕' ?></div>
    <h1><?= $valid ? 'Документ подлинный' : 'Документ не подтверждён' ?></h1>
    <p><?= $valid
        ? 'Данный документ выдан Оргкомитетом Культурного центра «Музыкальный Мир» и зарегистрирован в реестре'
        : 'Подпись документа не совпала. Возможно, номер введён с ошибкой или документ подделан.' ?></p>
  </div>
  <div class="body">
    <div class="row"><div class="k">Тип документа</div><div class="v"><?= $icon ?> <?= htmlspecialchars($docType, ENT_QUOTES) ?></div></div>
    <div class="row"><div class="k">Номер</div><div class="v" style="font-family:monospace"><?= htmlspecialchars($number, ENT_QUOTES) ?></div></div>
    <div class="row"><div class="k">Организация</div><div class="v">Культурный центр «Музыкальный Мир»</div></div>
    <div class="row"><div class="k">Регистрация</div><div class="v">Роскомнадзор № 094084 от 24.06.2025</div></div>
    <?php if ($valid): ?>
    <div class="note">
      Информация в документе может быть уточнена по официальным контактам центра:
      <b>+7 (999) 504-88-99</b>, <a href="mailto:kc@музыкальный-мир.рф" style="color:#8A6512">kc@музыкальный-мир.рф</a>.
      В случае обнаружения расхождений просим сообщить по этим же контактам.
    </div>
    <?php else: ?>
    <div class="note" style="background:#FDF1F1;border-color:#E6C0C0;color:#8C2F2F">
      Если Вы уверены, что документ подлинный — свяжитесь с оргкомитетом:
      <b>+7 (999) 504-88-99</b>, <a href="mailto:kc@музыкальный-мир.рф" style="color:#8C2F2F">kc@музыкальный-мир.рф</a>.
    </div>
    <?php endif; ?>
  </div>
  <div class="footer">
    <a href="https://музыкальный-мир.рф">музыкальный-мир.рф</a> ·
    Официальный сайт Культурного центра «Музыкальный Мир»
  </div>
</div>
</body></html>
