<?php
/**
 * РЕКВИЗИТЫ ДЛЯ ЗАЧИСЛЕНИЯ ПЛАТЕЖЕЙ — СТРАНИЦА ПО ПРЯМОЙ ССЫЛКЕ.
 *
 * Нужна платёжному сервису: ЮKassa просит показать банковские реквизиты, на
 * которые уходят переводы. Участникам сайта она не нужна и видеть её они не
 * должны — поэтому страницы нет ни в меню, ни в подвале, ни в карте сайта, а
 * поисковикам она закрыта заголовком X-Robots-Tag (см. public/index.php) и
 * строкой в robots.txt. Открывается только тот, кому дали адрес.
 *
 * Номер счёта — личный счёт получателя, и он не должен утечь в поиск: любая
 * правка здесь обязана сохранить закрытость страницы.
 */
declare(strict_types=1);

/* ДВА БЛОКА, А НЕ ОДИН СПИСОК.
 * ИНН здесь два: у получателя свой (самозанятый), у банка свой, и рядом стоят
 * ещё КПП, ОКПО и ОГРН — тоже банковские. Одним списком их путают и вписывают
 * в платёж не тот номер, поэтому получатель и банк разведены заголовками. */
$GROUPS = [
    'Получатель платежа' => [
        ['Валюта получаемого перевода', 'Российский рубль (RUB)'],
        ['Получатель',                  'ИЛЬЯСОВ АЛЬБЕРТ ИЛЬЯСОВИЧ'],
        ['ИНН получателя (самозанятый)', '165816285015'],
        ['Номер счёта',                 '40817810706670079145'],
    ],
    'Банк получателя' => [
        ['Банк',                        'БАШКИРСКОЕ ОТДЕЛЕНИЕ N8598 ПАО СБЕРБАНК'],
        ['БИК',                         '048073601'],
        ['Корреспондентский счёт',      '30101810300000000601'],
        ['ИНН банка',                   '7707083893'],
        ['КПП',                         '027802001'],
        ['ОКПО',                        '09105901'],
        ['ОГРН',                        '1027700132195'],
        ['SWIFT-код',                   'SABRRUMMEA1'],
        ['Почтовый адрес банка',        '450059, УФА, УЛ. Р. ЗОРГЕ, 5'],
        ['Почтовый адрес доп. офиса',   '450077, Г. УФА, УЛ. ЛЕНИНА, 20'],
    ],
];

ob_start(); ?>
<style>
.rec-wrap{max-width:760px;margin:0 auto;padding:28px 0 64px}
.rec-head{margin:0 0 6px}
.rec-note{color:var(--muted);font-size:.92rem;margin:0 0 26px}
.rec-group{font-size:1.05rem;margin:26px 0 10px}
.rec-group:first-of-type{margin-top:0}
.rec-card{background:var(--panel);border:1px solid var(--glass-brd);border-radius:var(--radius-sm);
  padding:6px 18px;backdrop-filter:blur(10px)}
.rec-row{display:flex;gap:18px;align-items:baseline;padding:14px 0;border-bottom:1px solid var(--line)}
.rec-row:last-child{border-bottom:0}
.rec-k{flex:0 0 42%;color:var(--muted);font-size:.9rem}
/* Счёт и коды читают и переписывают вручную — цифры не должны слипаться. */
.rec-v{flex:1 1 auto;font-weight:700;letter-spacing:.02em;word-break:break-word}
.rec-v.num{font-variant-numeric:tabular-nums;letter-spacing:.06em}
.rec-copy{margin-top:22px;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.rec-copy .ok{color:var(--gold-ink);font-size:.9rem;display:none}
.rec-copy .ok.on{display:inline}
@media(max-width:560px){
  .rec-row{flex-direction:column;gap:4px;padding:12px 0}
  .rec-k{flex:none}
}
</style>

<section class="section">
  <div class="container rec-wrap">
    <h1 class="rec-head">Реквизиты для зачисления платежей</h1>
    <p class="rec-note">Культурный центр «Музыкальный Мир». Страница служебная, для платёжного сервиса.</p>

    <?php foreach ($GROUPS as $title => $rows): ?>
      <h2 class="rec-group"><?= h($title) ?></h2>
      <div class="rec-card">
        <?php foreach ($rows as [$k, $v]):
          $isNum = (bool) preg_match('~^[0-9]+$~', $v); ?>
          <div class="rec-row">
            <div class="rec-k"><?= h($k) ?></div>
            <div class="rec-v<?= $isNum ? ' num' : '' ?>"><?= h($v) ?></div>
          </div>
        <?php endforeach; ?>
      </div>
    <?php endforeach; ?>

    <div class="rec-copy">
      <button type="button" class="btn btn--ghost btn--sm" id="recCopy">Скопировать реквизиты</button>
      <span class="ok" id="recOk">Скопировано</span>
    </div>
  </div>
</section>

<script>
(function () {
  var btn = document.getElementById('recCopy');
  if (!btn) return;
  btn.addEventListener('click', function () {
    var lines = [];
    document.querySelectorAll('.rec-group, .rec-row').forEach(function (r) {
      if (r.classList.contains('rec-group')) { lines.push((lines.length ? '\n' : '') + r.textContent.trim().toUpperCase()); return; }
      lines.push(r.querySelector('.rec-k').textContent.trim() + ': ' + r.querySelector('.rec-v').textContent.trim());
    });
    var text = lines.join('\n');
    var done = function () {
      var ok = document.getElementById('recOk');
      ok.classList.add('on');
      setTimeout(function () { ok.classList.remove('on'); }, 2000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () {});
      return;
    }
    // Запасной путь для старых браузеров: буфер через скрытое поле.
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) {}
    document.body.removeChild(ta);
  });
})();
</script>
<?php
$content = ob_get_clean();
/* active оставляем пустым: в меню этой страницы нет и быть не должно. */
render_page('Реквизиты', $content, [
    'active' => '',
    'meta'   => 'Служебная страница реквизитов Культурного центра «Музыкальный Мир».',
]);
