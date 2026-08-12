<?php
/**
 * core/club_cert.php — сертификат участника Клуба постоянных участников.
 *
 * Горизонтальный А4 (297×210 мм), золотая рамка, логотип центра, именные данные
 * участника, подписи и печати — те же файлы, что и на дипломах
 * (assets/img/diploma/{sig1,sig2,stamp,seal}.png), поэтому документ выглядит
 * одинаково с наградными документами центра.
 *
 * Печать — тем же бастионом Playwright, что и дипломы (см. core/diploma_render.php),
 * только лист альбомный: render_diploma.js принимает необязательные <w> <h>.
 */
declare(strict_types=1);

require_once __DIR__ . '/club.php';

/**
 * HTML сертификата участника Клуба.
 *
 * @param array $user   строка users (id, full_name, email)
 * @param array $status результат club_status()
 */
function club_cert_html(array $user, array $status): string {
    $base   = rtrim((string) cfgv('base_url'), '/');
    $imgDip = $base . '/assets/img/diploma';
    $logo   = $base . '/assets/img/logo_muzmir_512.png';

    $uid    = (int) ($user['id'] ?? 0);
    $name   = trim((string) ($user['full_name'] ?? '')) ?: 'Участник Клуба';
    $cardNo = club_card_no($uid);

    $sinceRaw = (string) ($status['started_at'] ?? '');
    $tillRaw  = (string) ($status['expires_local'] ?? ($status['expires_at'] ?? ''));
    $since = $sinceRaw !== '' ? ru_date(substr($sinceRaw, 0, 10)) : '';
    $till  = !empty($status['staff']) ? 'бессрочно'
            : ($tillRaw !== '' ? ru_date(substr($tillRaw, 0, 10)) : '');
    $pct   = (int) ($status['discount'] ?? 0);
    if ($pct <= 0) $pct = function_exists('mm_vip_discount') ? mm_vip_discount() : 20;
    $year  = date('Y');

    // ФИО длиной больше ~26 символов сажаем на меньший кегль, чтобы не переносилось.
    $len = mb_strlen($name);
    $namePt = $len <= 24 ? 40 : ($len <= 32 ? 34 : ($len <= 42 ? 28 : 23));

    $roleChairman = 'Лауреат международных и всероссийских конкурсов и фестивалей,'
        . ' председатель оргкомитета Культурного центра «Музыкальный Мир»';
    $roleDirector = 'Лауреат международных и всероссийских конкурсов и фестивалей, заслуженный'
        . ' деятель культуры, генеральный директор Культурного центра «Музыкальный Мир»';

    ob_start(); ?><!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<title>Сертификат участника Клуба — <?= h($name) ?></title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&family=Playfair+Display:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  @page{size:297mm 210mm;margin:0}
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:297mm;height:210mm}
  body{font-family:'Manrope',sans-serif;color:#2A1E06;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .sheet{position:relative;width:297mm;height:210mm;overflow:hidden;
    background:
      radial-gradient(120% 90% at 50% 0%,#FFFDF4 0%,#FDF6E2 46%,#F7E9C4 100%)}
  /* Золотая рамка: внешняя широкая + тонкая внутренняя линия */
  .frame-out{position:absolute;inset:8mm;border:2.6mm solid transparent;border-radius:3mm;
    background:linear-gradient(135deg,#E9CE84 0%,#C79322 26%,#F6E2A8 52%,#C79322 76%,#E9CE84 100%) border-box;
    -webkit-mask:linear-gradient(#000 0 0) padding-box,linear-gradient(#000 0 0);
    -webkit-mask-composite:xor;mask-composite:exclude}
  .frame-in{position:absolute;inset:13mm;border:0.5mm solid rgba(160,116,20,.55);border-radius:1.5mm}
  .frame-in::before{content:"";position:absolute;inset:1.6mm;border:0.25mm solid rgba(160,116,20,.35);border-radius:1mm}
  /* Уголки-виньетки */
  .corner{position:absolute;width:22mm;height:22mm;border:0.7mm solid rgba(160,116,20,.5)}
  .corner.tl{top:16mm;left:16mm;border-right:0;border-bottom:0;border-radius:3mm 0 0 0}
  .corner.tr{top:16mm;right:16mm;border-left:0;border-bottom:0;border-radius:0 3mm 0 0}
  .corner.bl{bottom:16mm;left:16mm;border-right:0;border-top:0;border-radius:0 0 0 3mm}
  .corner.br{bottom:16mm;right:16mm;border-left:0;border-top:0;border-radius:0 0 3mm 0}
  /* Гильош — тонкая сетка по всему листу */
  .guilloche{position:absolute;inset:13mm;opacity:.16;
    background:
      repeating-linear-gradient(58deg,rgba(160,116,20,.55) 0 .18mm,transparent .18mm 3.2mm),
      repeating-linear-gradient(-58deg,rgba(160,116,20,.40) 0 .18mm,transparent .18mm 4.4mm)}
  .content{position:absolute;inset:18mm 24mm 16mm;display:flex;flex-direction:column;align-items:center;text-align:center}
  .logo{width:26mm;height:26mm;object-fit:contain;margin-bottom:2mm}
  .org{font-family:'Manrope',sans-serif;font-weight:800;font-size:10pt;letter-spacing:.22em;
    text-transform:uppercase;color:#7A5A12;line-height:1.35}
  .title{font-family:'Playfair Display',serif;font-weight:600;font-size:34pt;letter-spacing:.06em;
    text-transform:uppercase;color:#8A6512;margin:5mm 0 1mm;line-height:1}
  .subtitle{font-family:'Manrope',sans-serif;font-weight:700;font-size:11.5pt;letter-spacing:.14em;
    text-transform:uppercase;color:#6B4C10}
  .rule{width:78mm;height:.6mm;margin:4mm 0 4mm;border-radius:1mm;
    background:linear-gradient(90deg,transparent,#C79322 22%,#F1DDA0 50%,#C79322 78%,transparent)}
  .lead{font-size:11pt;color:#4A3308;font-weight:600;letter-spacing:.04em}
  .name{font-family:'Playfair Display',serif;font-weight:600;color:#2A1E06;line-height:1.12;
    font-size:<?= $namePt ?>pt;margin:3mm 0 2.5mm;white-space:nowrap}
  .desc{font-size:10.5pt;line-height:1.5;color:#3A2708;max-width:190mm}
  .facts{display:flex;gap:9mm;margin-top:5mm}
  .fact{min-width:44mm;padding:3mm 6mm;border:.4mm solid rgba(160,116,20,.45);border-radius:2mm;
    background:rgba(255,255,255,.42)}
  .fact b{display:block;font-family:'Manrope',sans-serif;font-weight:800;font-size:11.5pt;color:#2A1E06;letter-spacing:.04em}
  .fact span{display:block;margin-top:.8mm;font-size:7.4pt;letter-spacing:.12em;text-transform:uppercase;color:#7A5A12;font-weight:700}
  /* Подписи и печати — как на дипломах */
  /* Две подписи в РЯД: слева — оргкомитет, справа — генеральный директор.
     У каждой свой блок «подпись + печать», поэтому штампы не наезжают друг на друга
     (в первой версии обе печати стояли у правого края и перекрывались). */
  .bottom{position:absolute;bottom:14mm;left:24mm;right:24mm;z-index:4}
  .sig-grid{display:grid;grid-template-columns:1fr 1fr;gap:0 12mm;align-items:end}
  .sig-col{position:relative;padding-right:26mm}
  .sig-vis{position:relative;height:16mm}
  .sig-vis img.sg{position:absolute;left:2mm;bottom:0;width:30mm;height:auto}
  .sig-vis img.st{position:absolute;right:-24mm;bottom:-6mm;width:30mm;height:auto;opacity:.9}
  .sig-line{height:.3mm;background:rgba(90,62,11,.5);margin:0 0 1.4mm}
  .sig-text{font-size:7.8pt;line-height:1.22}
  .sig-text .nm{font-weight:800;margin-bottom:.6mm;font-size:9.5pt;color:#1a1a2a}
  .sig-text .rl{font-weight:600;color:#2A1E06}
  .footer-city{margin-top:6mm;text-align:center;font-family:'Playfair Display',serif;font-size:11pt;color:#4A3308}
  .certno{position:absolute;bottom:16mm;left:26mm;font-size:8pt;letter-spacing:.12em;color:#7A5A12;font-weight:700}
</style></head>
<body>
<div class="sheet">
  <div class="guilloche"></div>
  <div class="frame-out"></div>
  <div class="frame-in"></div>
  <span class="corner tl"></span><span class="corner tr"></span>
  <span class="corner bl"></span><span class="corner br"></span>

  <div class="content">
    <img class="logo" src="<?= h($logo) ?>" alt="">
    <div class="org">Культурный центр «Музыкальный&nbsp;Мир»</div>
    <div class="title">Сертификат</div>
    <div class="subtitle">участника Клуба постоянных участников</div>
    <div class="rule"></div>
    <div class="lead">Настоящим удостоверяется, что</div>
    <div class="name"><?= h($name) ?></div>
    <div class="desc">является участником Клуба постоянных участников Культурного центра «Музыкальный Мир»
      и пользуется всеми привилегиями Клуба: скидкой <?= (int) $pct ?>% на все платные услуги, ускоренной
      аттестацией конкурсных работ, приоритетной поддержкой и доступом к закрытым конкурсам Клуба.</div>
    <div class="facts">
      <div class="fact"><b><?= h($cardNo) ?></b><span>номер карты</span></div>
      <?php if ($since !== ''): ?><div class="fact"><b><?= h($since) ?></b><span>в клубе с</span></div><?php endif; ?>
      <?php if ($till !== ''): ?><div class="fact"><b><?= h($till) ?></b><span>действует до</span></div><?php endif; ?>
    </div>
  </div>

  <div class="bottom">
    <div class="sig-grid">
      <div class="sig-col">
        <div class="sig-vis">
          <img class="st" src="<?= $imgDip ?>/stamp.png" alt="">
          <img class="sg" src="<?= $imgDip ?>/sig1.png" alt="">
        </div>
        <div class="sig-line"></div>
        <div class="sig-text">
          <div class="nm">Галиулин Данил Дамирович</div>
          <div class="rl"><?= h($roleChairman) ?></div>
        </div>
      </div>
      <div class="sig-col">
        <div class="sig-vis">
          <img class="st" src="<?= $imgDip ?>/seal.png" alt="">
          <img class="sg" src="<?= $imgDip ?>/sig2.png" alt="">
        </div>
        <div class="sig-line"></div>
        <div class="sig-text">
          <div class="nm">Ильясов Альберт Ильясович</div>
          <div class="rl"><?= h($roleDirector) ?></div>
        </div>
      </div>
    </div>
    <div class="footer-city">Российская Федерация, город Москва — <?= $year ?></div>
  </div>
</div>
</body></html>
<?php
    return (string) ob_get_clean();
}

/**
 * PDF сертификата участника Клуба (альбомный А4) через бастион Playwright.
 * @return string|null абсолютный путь к PDF в public/diplomas/ или null
 */
function club_cert_pdf(int $userId, bool $regen = false): ?string {
    require_once __DIR__ . '/diploma_render.php';
    $poster = rtrim((string) cfgv('poster_url'), '/');
    $token  = (string) cfgv('poster_token');
    $sshPas = (string) cfgv('vps_ssh_pass');
    if ($poster === '' || $token === '' || $sshPas === '' || $userId <= 0) return null;

    $outDir = BASE_PATH . '/public/diplomas/';
    if (!is_dir($outDir)) @mkdir($outDir, 0775, true);
    $out = $outDir . 'club_cert_' . $userId . '.pdf';
    // Кэш на сутки: сертификат меняется только вместе со сроком членства.
    if (!$regen && is_file($out) && filesize($out) > 20000 && (time() - (int) filemtime($out)) < 86400) {
        return $out;
    }
    @unlink($out);

    $url = rtrim((string) cfgv('base_url'), '/') . '/club-cert-render/' . $userId
         . '?key=' . diploma_render_key();

    $tmp = '/tmp/clubcert_' . $userId . '_' . substr(bin2hex(random_bytes(4)), 0, 8) . '.pdf';
    // Лист альбомный: render_diploma.js принимает необязательные ширину/высоту.
    $cmd = 'cd /opt/oko-poster && NODE_PATH=/opt/oko-poster/node_modules node render_diploma.js '
         . escapeshellarg($url) . ' ' . escapeshellarg($tmp) . ' 297mm 210mm'
         . ' && export SSHPASS=' . escapeshellarg($sshPas)
         . '; sshpass -e scp -o StrictHostKeyChecking=no ' . escapeshellarg($tmp)
         . ' root@176.124.200.169:' . escapeshellarg($out)
         . ' && rm -f ' . escapeshellarg($tmp) . ' && echo RENDER_OK';

    $ch = curl_init($poster);
    curl_setopt_array($ch, [
        CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 120,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token, 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode(['cmd' => $cmd], JSON_UNESCAPED_SLASHES),
    ]);
    $resp = curl_exec($ch);
    curl_close($ch);
    if (!is_string($resp) || !str_contains($resp, 'RENDER_OK')) {
        error_log('club_cert_pdf(' . $userId . '): bastion render failed: ' . substr((string) $resp, 0, 300));
        return null;
    }
    clearstatcache(true, $out);
    if (!is_file($out) || filesize($out) <= 20000) return null;
    diploma_compress_pdf($out);
    clearstatcache(true, $out);
    return $out;
}
