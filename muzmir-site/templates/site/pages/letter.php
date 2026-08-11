<?php
/**
 * ПРОВЕРКА ПОДЛИННОСТИ ОФИЦИАЛЬНОГО ОБРАЩЕНИЯ — /letter/<номер>.
 *
 * Сюда ведёт QR-код с бланка. Делопроизводитель ведомства наводит камеру и должен
 * за секунду понять одно: этот документ центром действительно выдан, вот дата и
 * вот кому. Подпись и печать нарисовать легко, запись в реестре — нет.
 *
 * Что здесь НЕ показывается: адрес электронной почты получателя и любые другие
 * контакты. Номера обращений идут подряд, страница открыта всем — значит, всё,
 * что тут напечатано, можно выгрузить перебором. Названия ведомства и даты для
 * подтверждения подлинности достаточно.
 */
declare(strict_types=1);
require_once BASE_PATH . '/core/official_letter.php';
ol_migrate();

$number = trim((string) ($number ?? ''));
$row = null;
$limited = false;

if ($number !== '') {
    // Перебор номеров бессмысленно дорогой: 40 проверок с адреса в час хватает
    // любому живому человеку с документом на руках.
    if (function_exists('rate_ok') && !rate_ok('letter_verify:' . client_ip(), 40, 3600)) {
        $limited = true;
    } else {
        try { $row = one("SELECT * FROM official_letters WHERE number=?", [$number]); }
        catch (\Throwable $e) { $row = null; }
        // Пока обращение не отправлено, подтверждать нечего: документа на руках
        // у адресата ещё нет, а значит, и проверять его никто не может.
        if ($row && trim((string) ($row['sent_at'] ?? '')) === '') $row = null;
    }
}

$org  = (string) cfgv('org_full', 'Культурный центр «Музыкальный Мир»');
$site = (string) cfgv('domain', 'музыкальный-мир.рф');

ob_start(); ?>
<style>
  .lv-wrap{max-width:560px;margin:0 auto;padding:0 16px}
  .lv-card{background:var(--panel-solid,#fff);border:1px solid var(--line);border-radius:18px;
    padding:30px 26px;text-align:center;box-shadow:0 14px 40px rgba(21,34,76,.12)}
  .lv-badge{width:74px;height:74px;margin:0 auto 16px;border-radius:50%;display:flex;
    align-items:center;justify-content:center}
  .lv-ok{background:rgba(30,158,90,.12);color:#1E9E5A}
  .lv-no{background:rgba(179,64,63,.12);color:#B3403F}
  .lv-badge svg{width:38px;height:38px}
  .lv-card h1{margin:0 0 8px;font-size:1.32rem}
  .lv-card p{color:var(--muted);margin:0 0 18px;line-height:1.6}
  .lv-kv{text-align:left;margin:18px 0 0;border-top:1px solid var(--line);padding-top:16px}
  .lv-kv div{display:flex;justify-content:space-between;gap:14px;padding:7px 0;
    border-bottom:1px solid var(--line);font-size:.95rem}
  .lv-kv div:last-child{border-bottom:0}
  .lv-kv span{color:var(--muted);flex:none}
  .lv-kv b{text-align:right}
  .lv-no-mono{font-family:'Courier New',monospace;letter-spacing:.03em}
</style>

<section class="section">
  <div class="lv-wrap">
    <div class="lv-card reveal">
      <?php if ($row): ?>
        <div class="lv-badge lv-ok">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
               stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>
        </div>
        <h1>Документ подлинный</h1>
        <p>Обращение с этим номером действительно выдано центром «<?= h($site) ?>».</p>
        <div class="lv-kv">
          <div><span>Исходящий номер</span><b class="lv-no-mono">№<?= h((string) $row['number']) ?></b></div>
          <div><span>Дата документа</span><b><?= h(ru_date(substr((string) $row['created_at'], 0, 10))) ?></b></div>
          <?php if (trim((string) $row['org']) !== ''): ?>
            <div><span>Адресат</span><b><?= h((string) $row['org']) ?></b></div>
          <?php endif; ?>
          <div><span>Вид обращения</span><b><?= (string) $row['kind'] === 'institution'
              ? 'Приглашение к участию в конкурсах'
              : 'Запрос информационной поддержки' ?></b></div>
          <div><span>Кем выдан</span><b><?= h($org) ?></b></div>
        </div>
      <?php else: ?>
        <div class="lv-badge lv-no">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
               stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
        </div>
        <h1><?= $limited ? 'Слишком много проверок' : 'Документ не найден' ?></h1>
        <p><?= $limited
            ? 'С этого адреса за последний час было слишком много обращений к реестру. Повторите проверку немного позже.'
            : 'В реестре исходящих нет документа с таким номером — либо он ещё не направлен адресату. Проверьте номер, указанный рядом с QR-кодом.' ?></p>
        <?php if ($number !== ''): ?>
          <div class="lv-no-mono" style="color:var(--muted)">№<?= h($number) ?></div>
        <?php endif; ?>
      <?php endif; ?>
    </div>
  </div>
</section>
<?php
$content = ob_get_clean();
render_page('Проверка документа', $content, [
    'active' => '/contacts',
    'meta'   => 'Проверка подлинности официального обращения Культурного центра «Музыкальный Мир» по исходящему номеру.',
]);
