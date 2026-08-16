<?php
/**
 * /verify-doc.php — универсальная проверка подлинности документов КЦ.
 * Партнёрские сертификаты (ИП-YYYY-NNNNN), благодарности партнёрам
 * (БЛГ-ИП-YYYY-NNNNN-РX/ПX), а также официальные обращения (DDMMYYYY/NNN).
 * Дипломы идут отдельным маршрутом /verify/<номер>.
 *
 * Проверяем и подпись, и реестр — совпадать должны обе стороны.
 * URL с QR: /verify-doc.php?n=<номер>&s=<подпись>
 */
declare(strict_types=1);

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/paylink.php';

$number = trim((string) ($_GET['n'] ?? ''));
$sig    = trim((string) ($_GET['s'] ?? ''));

$expected = $number !== '' ? substr(hash_hmac('sha256', 'partner-doc:' . $number, pay_secret()), 0, 16) : '';
$sigOk    = ($number !== '' && $sig !== '' && hash_equals($expected, $sig));

$docType = 'документ';
$org     = '';
$fio     = '';
$issued  = '';
$inRegistry = false;

if (str_starts_with($number, 'ИП-')) {
    $docType = 'Сертификат Информационного партнёра';
    $row = one("SELECT * FROM partner_docs WHERE number=? AND kind='cert'", [$number]);
    if ($row) { $inRegistry = true; $org = (string)$row['org']; $fio = (string)$row['fio']; $issued = (string)$row['issued_at']; }
} elseif (str_starts_with($number, 'БЛГ-ИП-')) {
    $docType = 'Благодарственное письмо (Информационный партнёр)';
    $row = one("SELECT * FROM partner_docs WHERE number=? AND kind LIKE 'thanks_%'", [$number]);
    if ($row) { $inRegistry = true; $org = (string)$row['org']; $fio = (string)$row['fio']; $issued = (string)$row['issued_at']; }
} elseif (preg_match('~^\d{6,8}/\d{1,6}$~', $number)) {
    $docType = 'Официальное обращение центра';
    $row = one("SELECT * FROM official_letters WHERE number=?", [$number]);
    if ($row && trim((string)($row['sent_at'] ?? '')) !== '') {
        $inRegistry = true;
        $org  = (string)$row['org'];
        $fio  = (string)$row['person'];
        $issued = (string)$row['sent_at'];
    }
}

$valid = $sigOk && $inRegistry;
$reason = '';
if (!$sigOk) $reason = 'подпись документа не совпала';
elseif (!$inRegistry) $reason = 'номера нет в реестре центра';

?><!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Проверка подлинности — <?= htmlspecialchars($number, ENT_QUOTES) ?></title>
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
  .head .ic{font-size:52px;line-height:1;margin-bottom:8px;color:<?= $valid ? '#1E7A46' : '#8C2F2F' ?>}
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
</style></head>
<body>
<div class="card">
  <div class="head">
    <div class="ic"><?= $valid ? '&#10003;' : '&#10007;' ?></div>
    <h1><?= $valid ? 'Документ подлинный' : 'Документ не подтверждён' ?></h1>
    <p><?= $valid
        ? 'Документ выдан Оргкомитетом Культурного центра «Музыкальный Мир» и зарегистрирован в реестре'
        : 'Не удалось подтвердить документ: ' . htmlspecialchars($reason, ENT_QUOTES) ?></p>
  </div>
  <div class="body">
    <div class="row"><div class="k">Тип документа</div><div class="v"><?= htmlspecialchars($docType, ENT_QUOTES) ?></div></div>
    <div class="row"><div class="k">Номер</div><div class="v" style="font-family:monospace"><?= htmlspecialchars($number, ENT_QUOTES) ?></div></div>
    <?php if ($org): ?><div class="row"><div class="k">Организация</div><div class="v"><?= htmlspecialchars($org, ENT_QUOTES) ?></div></div><?php endif; ?>
    <?php if ($fio): ?><div class="row"><div class="k">Адресат</div><div class="v"><?= htmlspecialchars($fio, ENT_QUOTES) ?></div></div><?php endif; ?>
    <?php if ($issued): ?><div class="row"><div class="k">Выдан</div><div class="v"><?= htmlspecialchars($issued, ENT_QUOTES) ?></div></div><?php endif; ?>
    <div class="row"><div class="k">Организация</div><div class="v">Культурный центр «Музыкальный Мир»</div></div>
    <div class="row"><div class="k">Регистрация</div><div class="v">Роскомнадзор № 094084 от 24.06.2025</div></div>
    <?php if ($valid): ?>
    <div class="note">
      Уточнить по официальным контактам центра: <b>+7 (999) 504-88-99</b>,
      <a href="mailto:kc@музыкальный-мир.рф" style="color:#8A6512">kc@музыкальный-мир.рф</a>.
    </div>
    <?php else: ?>
    <div class="note" style="background:#FDF1F1;border-color:#E6C0C0;color:#8C2F2F">
      Если Вы уверены, что документ подлинный — свяжитесь: <b>+7 (999) 504-88-99</b>,
      <a href="mailto:kc@музыкальный-мир.рф" style="color:#8C2F2F">kc@музыкальный-мир.рф</a>.
    </div>
    <?php endif; ?>
  </div>
  <div class="footer">
    <a href="https://музыкальный-мир.рф">музыкальный-мир.рф</a> · Официальный сайт Культурного центра
  </div>
</div>
</body></html>
