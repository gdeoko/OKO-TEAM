<?php
/**
 * ОФИЦИАЛЬНЫЕ ОБРАЩЕНИЯ ЦЕНТРА — БЛАНК, НОМЕР, ПОДЛИННОСТЬ.
 *
 * Обычное письмо в министерство или в школу искусств не читают: оно выглядит как
 * реклама. Документ на бланке — с реквизитами, исходящим номером, грифом
 * «УТВЕРЖДАЮ», подписью, печатью и гербами тех ведомств, при поддержке которых
 * центр работает, — читают и на него отвечают. Разница не в вежливости, а в том,
 * что первое можно удалить не глядя, а второе положено зарегистрировать.
 *
 * ДВА ВИДА ОБРАЩЕНИЯ:
 *   support     — в орган власти или творческий союз, с просьбой об информационной
 *                 поддержке. Говорит ТОЛЬКО о бесплатных конкурсах: поддержку дают
 *                 просветительским проектам, а не платным услугам, и упоминание
 *                 оргвзноса закрывает дверь сразу.
 *   institution — в учреждение (ДШИ, дом культуры, центр творчества), с
 *                 приглашением педагогов и обучающихся. Здесь условия называются
 *                 честно и полностью, включая оргвзнос: скрывать его от того, кого
 *                 зовёшь участвовать, — обман, который вскроется на второй минуте.
 *
 * ПОДЛИННОСТЬ. У каждого обращения свой исходящий номер и QR-код, ведущий на
 * страницу проверки. Получатель наводит камеру и видит: такой документ центром
 * действительно выдан, такого-то числа, такому-то адресату. Это то же решение,
 * что и на дипломах: подпись и печать легко нарисовать, а запись в реестре — нет.
 */
declare(strict_types=1);

/** Мягко заводит реестр исходящих. */
function ol_migrate(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    try {
        db()->exec("CREATE TABLE IF NOT EXISTS official_letters (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            number TEXT UNIQUE,
            kind TEXT DEFAULT 'support',       -- support|institution
            org TEXT DEFAULT '',               -- кому: название организации
            person TEXT DEFAULT '',            -- ФИО адресата (если известно)
            person_role TEXT DEFAULT '',       -- должность адресата
            region TEXT DEFAULT '',
            email TEXT DEFAULT '',
            competition_id INTEGER DEFAULT 0,
            season TEXT DEFAULT '',            -- ГГГГ-ММ кампании
            status TEXT DEFAULT 'new',         -- new|queued|sent|replied|declined
            replied_at TEXT DEFAULT '',
            reply_file TEXT DEFAULT '',        -- скан ответа, если пришёл
            created_at TEXT DEFAULT (datetime('now','localtime')),
            sent_at TEXT DEFAULT ''
        )");
        // Файл документа и строка очереди — добавлены позже, поэтому мягко.
        // file     — готовый PDF обращения (data/letters), он же уходит вложением;
        // queue_id — письмо в mail_queue, по нему проставляется реальная дата
        //            отправки: до неё страница проверки подлинности пуста.
        foreach (["ALTER TABLE official_letters ADD COLUMN file TEXT DEFAULT ''",
                  "ALTER TABLE official_letters ADD COLUMN queue_id INTEGER DEFAULT 0"] as $sql) {
            try { db()->exec($sql); } catch (\Throwable $e) {}
        }
        db()->exec("CREATE INDEX IF NOT EXISTS idx_ol_kind   ON official_letters(kind)");
        db()->exec("CREATE INDEX IF NOT EXISTS idx_ol_season ON official_letters(season)");
        db()->exec("CREATE INDEX IF NOT EXISTS idx_ol_status ON official_letters(status)");
    } catch (\Throwable $e) {}
}

/* =====================================================================
 *  Номер и подлинность
 * ===================================================================== */

/**
 * Исходящий номер: №ДДММГГГГ/NNN.
 * Дата в номере — не украшение: по ней делопроизводитель адресата сразу видит,
 * когда документ выпущен, не открывая его.
 */
function ol_next_number(?int $ts = null): string {
    ol_migrate();
    $ts = $ts ?: time();
    $prefix = date('dmY', $ts);
    $n = 1;
    try {
        $n = 1 + (int) (scalar("SELECT COUNT(*) FROM official_letters WHERE number LIKE ?", [$prefix . '/%']) ?? 0);
    } catch (\Throwable $e) {}
    // Коллизия возможна при одновременной вставке — добираем следующий свободный.
    for ($i = 0; $i < 50; $i++) {
        $num = $prefix . '/' . str_pad((string) ($n + $i), 3, '0', STR_PAD_LEFT);
        try {
            if (!one("SELECT id FROM official_letters WHERE number=?", [$num])) return $num;
        } catch (\Throwable $e) { return $num; }
    }
    return $prefix . '/' . bin2hex(random_bytes(2));
}

/** Подпись номера — чтобы страницу проверки нельзя было подделать перебором. */
function ol_sign(string $number): string {
    if (!function_exists('pay_secret')) require_once __DIR__ . '/paylink.php';
    return substr(hash_hmac('sha256', 'letter:' . $number, pay_secret()), 0, 16);
}

/**
 * Ссылка проверки подлинности (её кодирует QR на бланке).
 *
 * Номер содержит косую черту (11082026/001), и кодировать её нельзя: %2F в пути
 * до PHP не доходит — nginx его не разворачивает, и страница отдаёт 404. Номер
 * состоит только из цифр и одной косой черты, экранировать в нём нечего.
 */
function ol_verify_url(string $number): string {
    $safe = preg_replace('~[^0-9/]~', '', $number) ?? '';
    return rtrim((string) cfgv('base_url', ''), '/') . '/letter/' . $safe;
}

/* =====================================================================
 *  Бланк
 * ===================================================================== */

/**
 * Картинка бланка.
 *
 * По умолчанию — обычной ссылкой: страница проверки и просмотр в браузере должны
 * открываться быстро, а картинки браузер закэширует. Встраивание в base64
 * включается только там, где документ обязан быть самодостаточным: письмо, которое
 * читают в почтовом клиенте без загрузки внешних картинок, и файл, отправленный
 * вложением. Первая версия встраивала всегда, и бланк весил 2,3 МБ — почтовые
 * службы такое письмо обрезают, а Gmail и вовсе прячет хвост под «показать
 * полностью», то есть подпись и печать адресат не увидит.
 *
 * Берём облегчённые копии из assets/img/letter (см. scripts/make_letter_assets.php):
 * исходные гербы и печать весят по четверти мегабайта каждый, для документа это
 * избыточно.
 */
function ol_img(string $rel, bool $embed = false): string {
    static $cache = [];
    $key = ($embed ? 'e:' : 'u:') . $rel;
    if (isset($cache[$key])) return $cache[$key];

    $rel = ltrim($rel, '/');
    $abs = BASE_PATH . '/public/assets/img/' . $rel;
    $url = rtrim((string) cfgv('base_url', ''), '/') . '/assets/img/' . $rel;

    if (!$embed || !is_file($abs) || filesize($abs) > 900000) return $cache[$key] = $url;

    $ext = strtolower(pathinfo($abs, PATHINFO_EXTENSION));
    $mime = $ext === 'png' ? 'image/png' : ($ext === 'webp' ? 'image/webp' : 'image/jpeg');
    return $cache[$key] = 'data:' . $mime . ';base64,' . base64_encode((string) file_get_contents($abs));
}

/** Облегчённая копия картинки для бланка, если она есть; иначе исходник. */
function ol_asset(string $light, string $fallback): string {
    return is_file(BASE_PATH . '/public/assets/img/letter/' . $light) ? 'letter/' . $light : $fallback;
}

/**
 * QR-код для бланка — картинкой, не встроенным SVG.
 *
 * Две причины. Почтовые службы вырезают из письма встроенный SVG (Gmail — всегда),
 * то есть код проверки подлинности адресат просто не увидел бы. И вес: один QR в
 * SVG — это двадцать пять килобайт разметки, два кода на бланке съедали три
 * четверти письма, а тридцать тысяч таких писем — это два гигабайта в очереди.
 * PNG весит около килобайта, пишется один раз на каждый номер и дальше отдаётся
 * из кэша браузера.
 */
function ol_qr(string $data): string {
    if (!function_exists('qr_png') && is_file(BASE_PATH . '/core/qr.php')) require_once BASE_PATH . '/core/qr.php';
    if (!function_exists('qr_png')) return '';

    $key = substr(sha1($data), 0, 20);
    $dir = BASE_PATH . '/public/assets/qr';
    $abs = $dir . '/' . $key . '.png';

    if (!is_file($abs)) {
        if (!is_dir($dir) && !@mkdir($dir, 0775, true)) return '';
        try { qr_png($data, $abs, 6, 2); } catch (\Throwable $e) { return ''; }
        if (!is_file($abs)) return '';
        @chmod($abs, 0664);
    }

    $url = rtrim((string) cfgv('base_url', ''), '/') . '/assets/qr/' . $key . '.png';
    return '<img src="' . h($url) . '" alt="QR-код проверки подлинности" '
         . 'style="width:100%;height:auto;display:block;image-rendering:pixelated">';
}

/** Ряд эмблем ведомств — тот же набор, что на дипломах центра. */
function ol_emblems(bool $embed = false): string {
    $set = [
        [ol_asset('e_prok.png',       'diploma/logo_prokultura.png'),  'Про.Культура.РФ'],
        [ol_asset('e_minkult.png',    'diploma/logo_minkult.png'),     'Министерство культуры Российской Федерации'],
        [ol_asset('e_minprosvet.png', 'diploma/logo_minprosvet.png'),  'Министерство просвещения Российской Федерации'],
        [ol_asset('e_rossia.png',     'diploma/logo_rossia.png'),      'Российская Федерация'],
        [ol_asset('e_nats.png',       'diploma/logo_natsproekty.png'), 'Национальные проекты «Культура»'],
    ];
    $out = '';
    foreach ($set as [$f, $alt]) {
        if (!is_file(BASE_PATH . '/public/assets/img/' . $f)) continue;
        $out .= '<img src="' . h(ol_img($f, $embed)) . '" alt="' . h($alt) . '">';
    }
    return $out;
}

/**
 * Полный HTML официального обращения на бланке А4.
 *
 * @param array $o
 *   number       — исходящий номер (обязателен);
 *   title        — заголовок документа («ОБРАЩЕНИЕ», «ИНФОРМАЦИОННОЕ ПИСЬМО»);
 *   addressee    — кому (несколько строк, каждая отдельным элементом массива);
 *   salutation   — «Уважаемая Карина Сергеевна!» (если ФИО известно);
 *   body         — готовый HTML тела (абзацы);
 *   date         — дата документа (Y-m-d), по умолчанию сегодня;
 *   paper        — 'beige' (по умолчанию) или 'white';
 *   embed        — встроить картинки в base64 (для письма и вложения);
 *   attachments  — список приложений строками.
 */
function ol_render(array $o): string {
    $number = (string) ($o['number'] ?? ol_next_number());
    $date   = (string) ($o['date'] ?? date('Y-m-d'));
    $paper  = ((string) ($o['paper'] ?? 'beige')) === 'white' ? 'white' : 'beige';

    $org    = (string) cfgv('org_full', 'Культурный центр «Музыкальный Мир»');
    $reg    = (string) cfgv('org_reg', '');
    $addr   = (string) cfgv('org_address', '');
    $phone  = (string) cfgv('org_phone', '');
    $email  = (string) cfgv('org_email', '');
    $vk     = (string) cfgv('org_vk', '');
    $site   = (string) cfgv('domain', 'музыкальный-мир.рф');
    $base   = rtrim((string) cfgv('base_url', ''), '/');

    // embed=true — документ самодостаточен (для письма и вложения); по умолчанию
    // картинки идут ссылками, и страница открывается мгновенно.
    $embed  = !empty($o['embed']);
    $logo   = ol_img(ol_asset('logo.png', 'logo_muzmir_256.png'), $embed);
    $sealF  = ol_asset('seal.png', 'diploma/seal.png');
    $sigF   = ol_asset('sig.png',  'diploma/sig2.png');
    $seal   = is_file(BASE_PATH . '/public/assets/img/' . $sealF) ? ol_img($sealF, $embed) : '';
    $sig    = is_file(BASE_PATH . '/public/assets/img/' . $sigF)  ? ol_img($sigF,  $embed) : '';

    $qrSite   = ol_qr($base . '/');
    $qrVerify = ol_qr(ol_verify_url($number));

    $dateHuman = function_exists('ru_date') ? ru_date($date) : date('d.m.Y', strtotime($date));

    $bg   = $paper === 'beige' ? '#FBF6EA' : '#ffffff';
    $bg2  = $paper === 'beige' ? '#F5ECD8' : '#f7f7f7';
    $line = $paper === 'beige' ? '#D8C79B' : '#dcdcdc';

    ob_start(); ?>
<style>
  .ol-sheet{
    --ol-bg:<?= $bg ?>; --ol-bg2:<?= $bg2 ?>; --ol-line:<?= $line ?>;
    --ol-ink:#1B2340; --ol-gold:#B8860B; --ol-navy:#15224C;
    max-width:210mm;margin:0 auto;background:var(--ol-bg);color:var(--ol-ink);
    padding:16mm 16mm 14mm;border:1px solid var(--ol-line);border-radius:10px;
    box-shadow:0 16px 46px rgba(21,34,76,.14);
    font-family:'PT Serif',Georgia,'Times New Roman',serif;font-size:11.4pt;line-height:1.5;
    position:relative;overflow:hidden}
  .ol-sheet::before{
    content:'';position:absolute;inset:0;pointer-events:none;
    background:radial-gradient(120% 60% at 50% -10%, rgba(184,134,11,.07), transparent 60%);}
  .ol-sheet *{position:relative}

  /* ── Шапка: реквизиты | логотип | УТВЕРЖДАЮ ── */
  .ol-head{display:grid;grid-template-columns:1fr auto 1fr;gap:10mm;align-items:start;
    padding-bottom:5mm;border-bottom:2.5px solid var(--ol-gold)}
  .ol-req{font-size:8.2pt;line-height:1.42;color:#4a4a55}
  .ol-req b{color:var(--ol-navy);display:block;margin-bottom:2mm;font-size:9pt}
  .ol-req div{margin-bottom:.9mm}
  .ol-brand{text-align:center;min-width:44mm}
  .ol-brand img.mark{width:26mm;height:26mm;object-fit:contain;display:block;margin:0 auto 2mm}
  .ol-brand .nm{font-size:11pt;font-weight:700;color:var(--ol-navy);line-height:1.24}
  .ol-appr{text-align:left;font-size:9.4pt;line-height:1.45}
  .ol-appr .word{font-size:15pt;font-weight:700;letter-spacing:.04em;color:var(--ol-navy);margin-bottom:1.5mm}
  .ol-appr .who{color:#4a4a55}
  .ol-appr .sigrow{display:flex;align-items:flex-end;gap:2mm;margin-top:2mm;min-height:14mm}
  .ol-appr .sigrow img{height:13mm;object-fit:contain}
  .ol-appr .fio{font-weight:700;color:var(--ol-navy);white-space:nowrap}
  .ol-appr .num{margin-top:2mm;font-size:9pt;color:#4a4a55}
  .ol-appr .num b{color:var(--ol-navy)}

  .ol-qr-top{position:absolute;top:0;right:0;text-align:center}
  .ol-qr-top svg,.ol-qr-top img{width:17mm;height:17mm;display:block}
  .ol-qr-top small{display:block;font-size:6.4pt;color:#6a6a75;margin-top:.6mm}

  /* ── Правовое основание + эмблемы ── */
  .ol-legal{margin:4mm 0 3mm;font-size:7.9pt;line-height:1.42;color:#4a4a55;text-align:justify}
  .ol-emblems{display:flex;align-items:center;justify-content:center;gap:7mm;
    flex-wrap:wrap;padding:2mm 0 4mm;border-bottom:1px solid var(--ol-line)}
  .ol-emblems img{height:15mm;width:auto;object-fit:contain}

  /* ── Тело ── */
  .ol-title{text-align:center;font-size:22pt;font-weight:700;letter-spacing:.05em;
    color:var(--ol-navy);margin:7mm 0 2mm;text-transform:uppercase}
  .ol-to{text-align:center;font-size:12pt;font-weight:700;color:var(--ol-navy);
    line-height:1.36;margin:0 0 5mm}
  .ol-salut{font-size:12pt;font-weight:700;color:var(--ol-navy);margin:0 0 4mm}
  .ol-body p{margin:0 0 3.4mm;text-align:justify;text-indent:8mm}
  .ol-body p.noind{text-indent:0}
  .ol-body ul{margin:0 0 3.4mm 8mm;padding:0 0 0 5mm}
  .ol-body li{margin-bottom:1.4mm}
  .ol-body b{color:var(--ol-navy)}

  .ol-box{margin:4mm 0;padding:3.5mm 5mm;background:var(--ol-bg2);
    border-left:3px solid var(--ol-gold);border-radius:0 6px 6px 0;text-indent:0}
  .ol-box b{color:var(--ol-navy)}

  .ol-att{margin:5mm 0 0;font-size:10pt}
  .ol-att b{color:var(--ol-navy)}
  .ol-att ol{margin:1.5mm 0 0 6mm;padding:0 0 0 4mm}

  /* ── Подвал: подпись/печать | QR подлинности ── */
  .ol-foot{display:flex;justify-content:space-between;align-items:flex-end;gap:8mm;
    margin-top:8mm;padding-top:4mm;border-top:1px solid var(--ol-line);flex-wrap:wrap}
  .ol-sign{font-size:10.4pt;line-height:1.45;position:relative;min-width:78mm}
  .ol-sign .role{color:#4a4a55}
  .ol-sign .who{font-weight:700;color:var(--ol-navy);margin-top:8mm}
  .ol-sign img.sg{position:absolute;left:6mm;bottom:4mm;height:15mm;object-fit:contain;opacity:.95}
  .ol-sign img.sl{position:absolute;left:34mm;bottom:-3mm;height:31mm;object-fit:contain;opacity:.88}
  .ol-verify{text-align:center;flex:none}
  .ol-verify svg,.ol-verify img{width:22mm;height:22mm;display:block;margin:0 auto}
  .ol-verify small{display:block;font-size:6.8pt;color:#6a6a75;margin-top:1mm;line-height:1.3}
  .ol-verify .no{font-family:'Courier New',monospace;font-size:8pt;color:var(--ol-navy);letter-spacing:.02em}

  .ol-contacts{margin-top:5mm;padding-top:3mm;border-top:1px dashed var(--ol-line);
    font-size:8.4pt;color:#4a4a55;text-align:center;line-height:1.5}
  .ol-contacts b{color:var(--ol-navy)}

  @media(max-width:760px){
    .ol-sheet{padding:9mm 7mm;font-size:10.6pt;border-radius:8px}
    .ol-head{grid-template-columns:1fr;gap:5mm}
    .ol-qr-top{display:none}
    .ol-title{font-size:17pt}
    .ol-emblems img{height:11mm}
    .ol-sign img.sl{left:auto;right:2mm}
  }
  @media print{
    body{background:#fff !important}
    .app-bg,.app-header,.appnav,.mz-radio,footer,.site-footer,.ol-actions{display:none !important}
    .ol-sheet{border:0;box-shadow:none;border-radius:0;margin:0;padding:0;max-width:none}
    @page{size:A4;margin:12mm}
  }
</style>

<article class="ol-sheet">

  <div class="ol-head">
    <div class="ol-req">
      <b><?= h($org) ?></b>
      <?php if ($reg !== ''): ?><div>Зарегистрирован в официальном российском федеральном органе исполнительной власти: <?= h($reg) ?>.</div><?php endif; ?>
      <?php if ($addr !== ''): ?><div>Адрес: <?= h($addr) ?>.</div><?php endif; ?>
      <?php if ($phone !== ''): ?><div>Телефон: <?= h($phone) ?>.</div><?php endif; ?>
      <div>Официальный сайт: <?= h($site) ?>.</div>
      <?php if ($email !== ''): ?><div>Электронная почта: <?= h($email) ?>.</div><?php endif; ?>
      <?php if ($vk !== ''): ?><div>Сообщество: <?= h($vk) ?></div><?php endif; ?>
    </div>

    <div class="ol-brand">
      <img class="mark" src="<?= h($logo) ?>" alt="<?= h($org) ?>">
      <div class="nm">Культурный центр<br>«Музыкальный&nbsp;Мир»</div>
    </div>

    <div class="ol-appr">
      <?php if ($qrSite !== ''): ?>
        <div class="ol-qr-top"><?= $qrSite ?><small>сайт центра</small></div>
      <?php endif; ?>
      <?php if (empty($o['no_approve'])): ?><div class="word">УТВЕРЖДАЮ</div><?php endif; ?>
      <div class="who">Генеральный директор<br>Культурного центра<br>«Музыкальный Мир»</div>
      <div class="sigrow">
        <?php if ($sig !== ''): ?><img src="<?= h($sig) ?>" alt=""><?php endif; ?>
        <span class="fio">Ильясов&nbsp;А.&nbsp;И.</span>
      </div>
      <div class="num"><?= h($dateHuman) ?><br>Исх. <b>№<?= h($number) ?></b></div>
    </div>
  </div>

  <div class="ol-legal">
    Мероприятия Культурного центра «Музыкальный Мир» проводятся на основании
    Гражданского кодекса Российской Федерации (часть вторая) от 26.01.1996 № 14-ФЗ,
    глава 57 «Публичный конкурс», а также во исполнение Указа Президента Российской
    Федерации «Об утверждении Основ государственной культурной политики» № 808
    от 24 декабря 2014 года.
  </div>

  <div class="ol-emblems"><?= ol_emblems($embed) ?></div>

  <h1 class="ol-title"><?= h((string) ($o['title'] ?? 'Обращение')) ?></h1>

  <?php $to = (array) ($o['addressee'] ?? []); if ($to): ?>
    <div class="ol-to"><?= implode('<br>', array_map('h', $to)) ?></div>
  <?php endif; ?>

  <?php if (trim((string) ($o['salutation'] ?? '')) !== ''): ?>
    <p class="ol-salut"><?= h((string) $o['salutation']) ?></p>
  <?php endif; ?>

  <div class="ol-body"><?= (string) ($o['body'] ?? '') ?></div>

  <?php $att = array_values(array_filter((array) ($o['attachments'] ?? []))); if ($att): ?>
    <div class="ol-att">
      <b>Приложения:</b>
      <ol><?php foreach ($att as $a) echo '<li>' . h((string) $a) . '</li>'; ?></ol>
    </div>
  <?php endif; ?>

  <div class="ol-foot">
    <div class="ol-sign">
      <div class="role">Генеральный директор<br>Культурного центра «Музыкальный Мир»</div>
      <div class="who">А.&nbsp;И.&nbsp;Ильясов</div>
      <?php if ($sig !== ''):  ?><img class="sg" src="<?= h($sig) ?>" alt=""><?php endif; ?>
      <?php if ($seal !== ''): ?><img class="sl" src="<?= h($seal) ?>" alt=""><?php endif; ?>
    </div>

    <?php if ($qrVerify !== ''): ?>
      <div class="ol-verify">
        <?= $qrVerify ?>
        <div class="no">№<?= h($number) ?></div>
        <small>проверка подлинности<br><?= h($site) ?>/letter</small>
      </div>
    <?php endif; ?>
  </div>

  <div class="ol-contacts">
    <b><?= h($org) ?></b><br>
    <?= h($addr) ?><?= $addr !== '' ? ' · ' : '' ?><?= h($phone) ?><?= $phone !== '' ? ' · ' : '' ?><?= h($email) ?><br>
    Сайт <?= h($site) ?><?= $vk !== '' ? ' · ВКонтакте ' . h($vk) : '' ?>
  </div>

</article>
    <?php
    return (string) ob_get_clean();
}
