<?php
/**
 * ИНФОРМАЦИОННОЕ ПИСЬМО-ПРИГЛАШЕНИЕ ДЛЯ УЧРЕЖДЕНИЯ — страница /invite.
 *
 * Зачем отдельная страница, если есть письмо. Секретарь школы искусств письмо
 * прочитает и закроет, а вот распечатанный лист на доске объявлений в учительской
 * висит месяц, и его видит каждый педагог. Поэтому здесь — официальный бланк
 * формата А4: логотип, свидетельство о регистрации СМИ, перечень конкурсов с
 * ценами, сроки приёма, QR-код на сайт и подпись оргкомитета. Печатается одной
 * кнопкой, без шапки и меню сайта.
 *
 * Этой же ссылкой удобно делиться в переписке и в сообществах: она открывается
 * и на телефоне, и на компьютере, и выглядит как документ, а не как реклама.
 */
declare(strict_types=1);

$comps = [];
try {
    $comps = all("SELECT name, is_paid, price, slug, end_date, direction
                    FROM competitions WHERE status='open' ORDER BY is_paid ASC, sort ASC, id ASC");
} catch (\Throwable $e) { $comps = []; }

// Срок приёма — по самому раннему закрытию: обещать больше, чем есть, нельзя.
$deadline = '';
foreach ($comps as $c) {
    $d = trim((string) ($c['end_date'] ?? ''));
    if ($d === '') continue;
    if ($deadline === '' || $d < $deadline) $deadline = $d;
}
$deadlineHuman = $deadline !== '' ? ru_date($deadline) : '';

$site   = rtrim((string) cfgv('base_url'), '/');
$human  = (string) cfgv('domain', 'музыкальный-мир.рф');
$org    = (string) cfgv('org_full', 'Культурный центр «Музыкальный Мир»');
$reg    = (string) cfgv('org_reg', '');
$phone  = (string) cfgv('org_phone', '');
$email  = (string) cfgv('org_email', '');
$logo   = logo_data_uri();

// QR ведёт прямо на страницу подачи заявки: с распечатанного листа человек
// наводит камеру и сразу попадает в форму, а не на главную.
$qr = '';
if (is_file(BASE_PATH . '/core/qr.php')) {
    require_once BASE_PATH . '/core/qr.php';
    if (function_exists('qr_svg')) {
        try { $qr = qr_svg($site . '/apply'); } catch (\Throwable $e) { $qr = ''; }
    }
}

ob_start(); ?>
<style>
  .inv-wrap{max-width:820px;margin:0 auto;padding:0 16px}
  .inv-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin:0 0 18px}
  .inv-sheet{
    background:#fffdf7;color:#1a2340;border:1px solid rgba(180,130,28,.30);border-radius:14px;
    padding:38px 40px 32px;box-shadow:0 14px 44px rgba(21,34,76,.13);
    font-family:'PT Serif',Georgia,'Times New Roman',serif;line-height:1.62}
  [data-theme="dark"] .inv-sheet{background:#fffdf7;color:#1a2340}
  .inv-head{display:flex;gap:18px;align-items:center;border-bottom:2px solid #C79322;padding-bottom:16px;margin-bottom:22px}
  .inv-head img{width:74px;height:74px;flex:none;object-fit:contain}
  .inv-head h1{margin:0;font-size:1.32rem;line-height:1.24;color:#15224C;font-weight:700}
  .inv-head .sub{margin-top:5px;font-size:.82rem;color:#6a6047;letter-spacing:.04em;text-transform:uppercase}
  .inv-title{text-align:center;font-size:1.12rem;font-weight:700;margin:0 0 6px;color:#15224C}
  .inv-sub{text-align:center;font-size:.9rem;color:#6a6047;margin:0 0 22px}
  .inv-sheet p{margin:0 0 13px;font-size:1rem}
  .inv-table{width:100%;border-collapse:collapse;margin:18px 0 20px}
  .inv-table th{text-align:left;font-size:.76rem;letter-spacing:.06em;text-transform:uppercase;
    color:#15224C;border-bottom:1.5px solid #C79322;padding:0 0 7px}
  .inv-table td{padding:10px 0;border-bottom:1px solid #ece7db;font-size:.98rem;vertical-align:top}
  .inv-table td.price{text-align:right;white-space:nowrap;color:#6a6047}
  .inv-free{color:#1E7A46;font-weight:700}
  .inv-box{margin:20px 0;padding:15px 18px;background:#faf6ec;border-left:3px solid #C79322;border-radius:0 8px 8px 0}
  .inv-box b{color:#15224C}
  .inv-foot{display:flex;gap:22px;align-items:flex-end;justify-content:space-between;
    margin-top:26px;padding-top:18px;border-top:1px solid #ece7db;flex-wrap:wrap}
  .inv-sign{font-size:.95rem}
  .inv-qr{text-align:center;flex:none}
  .inv-qr svg{width:104px;height:104px;display:block}
  .inv-qr small{display:block;margin-top:5px;font-size:.72rem;color:#6a6047}
  .inv-req{margin-top:16px;font-size:.78rem;color:#7a7160;line-height:1.5}
  @media(max-width:640px){
    .inv-sheet{padding:26px 20px 22px}
    .inv-head{gap:12px}.inv-head img{width:56px;height:56px}.inv-head h1{font-size:1.06rem}
  }
  /* На печати — чистый лист: ни шапки сайта, ни меню, ни кнопок. */
  @media print{
    body{background:#fff !important}
    .app-bg,.app-header,.appnav,.inv-actions,.mz-radio,footer,.site-footer{display:none !important}
    .inv-sheet{border:0;box-shadow:none;border-radius:0;padding:0}
    .inv-wrap{max-width:none;padding:0}
    @page{size:A4;margin:14mm}
  }
</style>

<section class="section">
  <div class="inv-wrap">

    <div class="inv-actions">
      <button type="button" class="btn btn--primary" onclick="window.print()">Распечатать</button>
      <a class="btn btn--ghost" href="<?= url('/apply') ?>">Подать заявку</a>
      <button type="button" class="btn btn--ghost" data-share
              data-share-url="<?= h($site . '/invite') ?>"
              data-share-title="Приглашение к участию в конкурсах «Музыкальный Мир»">Поделиться</button>
    </div>

    <article class="inv-sheet">
      <header class="inv-head">
        <img src="<?= h($logo) ?>" alt="<?= h($org) ?>">
        <div>
          <h1><?= h($org) ?></h1>
          <div class="sub">Конкурсы · Фестивали · Концерты</div>
        </div>
      </header>

      <h2 class="inv-title">Информационное письмо</h2>
      <p class="inv-sub">о проведении международных и всероссийских дистанционных конкурсов<br>культуры и искусства</p>

      <p><b>Уважаемые коллеги!</b></p>

      <p>
        Культурный центр «Музыкальный Мир» приглашает обучающихся и педагогов Вашего
        учреждения принять участие в дистанционных конкурсах культуры и искусства.
        Конкурсы проводятся по направлениям: вокал, хореография, инструментальное
        исполнительство, изобразительное и декоративно-прикладное творчество,
        художественное слово, театральное искусство.
      </p>

      <p>
        Участие дистанционное: конкурсная работа принимается видеозаписью или
        изображением по ссылке, приезжать никуда не нужно.
        <?php if ($deadlineHuman !== ''): ?>
          Приём заявок текущего сезона — до <b><?= h($deadlineHuman) ?></b>.
        <?php endif; ?>
      </p>

      <?php if ($comps): ?>
      <table class="inv-table">
        <thead><tr><th>Конкурс</th><th style="text-align:right">Условия участия</th></tr></thead>
        <tbody>
          <?php foreach ($comps as $c): ?>
            <tr>
              <td><?= h((string) $c['name']) ?><?php
                  $dir = trim((string) ($c['direction'] ?? ''));
                  if ($dir !== '') echo '<br><span style="font-size:.84rem;color:#6a6047">' . h($dir) . '</span>'; ?></td>
              <td class="price"><?= (int) $c['is_paid'] === 1
                  ? 'организационный взнос ' . (int) $c['price'] . ' ₽ за заявку'
                  : '<span class="inv-free">участие бесплатное</span>' ?></td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
      <?php endif; ?>

      <div class="inv-box">
        <b>Педагогам-кураторам.</b> Преподаватель, подготовивший участников, получает
        благодарственное письмо центра и диплом куратора. Документы принимаются
        в аттестационное портфолио, оформляются на каждого педагога и высылаются
        вместе с дипломами учеников.
      </div>

      <p>
        Каждый участник получает электронный диплом с результатом аттестации жюри
        на указанную в заявке почту. Наградные материалы в оригинале — по желанию
        и отдельно; обязательным условием участия они не являются.
      </p>

      <p>
        Положения конкурсов, образцы дипломов и форма заявки размещены на сайте
        <b><?= h($human) ?></b>. Будем признательны, если Вы доведёте эту информацию
        до сведения преподавателей Вашего учреждения.
      </p>

      <div class="inv-foot">
        <div class="inv-sign">
          С уважением,<br>
          <b>оргкомитет Культурного центра<br>«Музыкальный Мир»</b>
          <?php if ($phone !== '' || $email !== ''): ?>
            <div style="margin-top:9px;font-size:.88rem;color:#6a6047">
              <?= h($phone) ?><?= ($phone !== '' && $email !== '') ? ' · ' : '' ?><?= h($email) ?>
            </div>
          <?php endif; ?>
        </div>
        <?php if ($qr !== ''): ?>
          <div class="inv-qr"><?= $qr ?><small>подать заявку</small></div>
        <?php endif; ?>
      </div>

      <?php if ($reg !== ''): ?>
        <div class="inv-req">Свидетельство о регистрации средства массовой информации — <?= h($reg) ?>.</div>
      <?php endif; ?>
    </article>

  </div>
</section>
<?php
$content = ob_get_clean();
render_page('Приглашение к участию в конкурсах', $content, [
    'active' => '/competitions',
    'meta'   => 'Информационное письмо-приглашение Культурного центра «Музыкальный Мир» для школ искусств, '
              . 'домов культуры и центров детского творчества: конкурсы сезона, условия участия, сроки приёма заявок.',
]);
