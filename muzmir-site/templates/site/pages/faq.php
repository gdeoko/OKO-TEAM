<?php
/** Вопросы и ответы: премиум-аккордеон из таблицы faq с поиском и группировкой по темам. */
$faqs = all("SELECT * FROM faq WHERE active=1 ORDER BY sort, id");

/* Темы выводятся из текста вопроса (в таблице faq нет колонки категории) - без изменения выборки. */
$faqTopics = [
    'uchastie'  => 'Участие',
    'oplata'    => 'Оплата',
    'rezultaty' => 'Результаты',
    'nagrady'   => 'Награды',
    'zhuri'     => 'Жюри',
];
$faqTopicOf = static function (array $f): string {
    $s = mb_strtolower(($f['question'] ?? '') . ' ' . ($f['answer'] ?? ''), 'UTF-8');
    $has = static function (array $keys) use ($s): bool {
        foreach ($keys as $k) {
            if (mb_strpos($s, $k, 0, 'UTF-8') !== false) return true;
        }
        return false;
    };
    if ($has(['оплат', 'стоимост', 'цена', 'взнос', 'реквизит', 'счёт', 'счет', 'возврат', 'деньг', 'платеж', 'платёж', 'оргвзнос'])) return 'oplata';
    if ($has(['диплом', 'кубок', 'медал', 'наград', 'доставк', 'почт', 'сувенир', 'грамот', 'посылк'])) return 'nagrady';
    if ($has(['жюри', 'эксперт', 'судь', 'оценива', 'комисси'])) return 'zhuri';
    if ($has(['результат', 'итог', 'протокол', 'объявл', 'сроки', 'балл', 'оценк', 'когда будут'])) return 'rezultaty';
    return 'uchastie';
};

/* Раскладываем по темам с сохранением порядка выборки. */
$faqGroups = array_fill_keys(array_keys($faqTopics), []);
foreach ($faqs as $f) {
    $faqGroups[$faqTopicOf($f)][] = $f;
}
$faqGroups = array_filter($faqGroups); // убираем пустые темы

/* Микроразметка FAQPage. */
$faqLd = null;
if ($faqs) {
    $faqLd = ['@context' => 'https://schema.org', '@type' => 'FAQPage', 'mainEntity' => []];
    foreach ($faqs as $f) {
        $faqLd['mainEntity'][] = [
            '@type' => 'Question',
            'name' => (string) $f['question'],
            'acceptedAnswer' => ['@type' => 'Answer', 'text' => (string) $f['answer']],
        ];
    }
}

ob_start(); ?>
<style>
/* Премиум-аккордеон: плавное раскрытие через grid-template-rows 0fr->1fr, без обрезаний длинного текста. */
#faqRoot .faq-tools{max-width:100%;margin:0 auto 22px}
#faqRoot .faq-search{position:relative;margin-bottom:16px}
#faqRoot .faq-search svg{position:absolute;left:16px;top:50%;transform:translateY(-50%);width:20px;height:20px;color:var(--gold);pointer-events:none}
#faqRoot .faq-search input{width:100%;margin:0;padding:14px 44px 14px 46px;font-size:1rem}
#faqRoot .faq-search .faq-clear{position:absolute;right:8px;top:50%;transform:translateY(-50%);width:34px;height:34px;display:none;align-items:center;justify-content:center;border:0;background:none;color:var(--muted);cursor:pointer;border-radius:50%}
#faqRoot .faq-search .faq-clear svg{position:static;transform:none;width:18px;height:18px;color:inherit}
#faqRoot .faq-search.has-value .faq-clear{display:flex}
#faqRoot .faq-chips{display:flex;flex-wrap:wrap;gap:8px}
#faqRoot .faq-chip{padding:9px 15px;min-height:40px;border-radius:999px;border:1.5px solid var(--glass-brd);background:var(--panel);color:var(--text-dim);font-weight:700;font-size:.9rem;cursor:pointer;display:inline-flex;align-items:center;transition:transform .18s,border-color .18s,color .18s}
#faqRoot .faq-chip:active{transform:scale(.96)}
#faqRoot .faq-chip.is-active{background:var(--grad-gold);color:#1a1206;border-color:transparent}
#faqRoot .faq-group{margin-bottom:26px}
#faqRoot .faq-group-title{font-family:var(--ff-serif);font-size:1.15rem;color:var(--gold-2);margin:0 0 12px;display:flex;align-items:center;gap:10px}
#faqRoot .faq-group-title::before{content:"";width:22px;height:2px;border-radius:2px;background:var(--grad-gold);flex:none}
#faqRoot .acc-q{width:100%;background:none;border:0;font:inherit;text-align:left;min-height:44px}
#faqRoot .acc-q>span:first-child{flex:1;overflow-wrap:anywhere}
#faqRoot .acc-a{max-height:none;display:grid;grid-template-rows:0fr;padding:0 22px;transition:grid-template-rows .4s cubic-bezier(.2,.8,.2,1)}
#faqRoot .acc-item.open .acc-a{grid-template-rows:1fr}
#faqRoot .acc-a-in{overflow:hidden;min-height:0}
#faqRoot .acc-a-in p{margin:0;padding:2px 0 20px;color:var(--text-dim);line-height:1.6;overflow-wrap:anywhere}
#faqRoot .faq-empty{text-align:center;color:var(--muted);padding:30px 10px;display:none}
#faqRoot.no-results .faq-empty{display:block}
@media (max-width:520px){
  #faqRoot .acc-q{padding:16px 16px}
  #faqRoot .acc-a{padding:0 16px}
}
</style>

<section class="section">
  <div class="container" style="max-width:820px">
    <div class="section-head reveal">
      <p class="eyebrow">Обратная связь</p>
      <h2>Вопросы и ответы</h2>
      <div class="gold-rule"></div>
    </div>

    <?php if (!$faqs): ?>
      <div class="card reveal" style="text-align:center">
        <p style="color:var(--text-dim);margin:0">Раздел с вопросами пока наполняется. Если у Вас есть вопрос, напишите на <a href="mailto:<?= h(cfgv('org_email')) ?>"><?= h(cfgv('org_email')) ?></a> или воспользуйтесь формой обратной связи на странице «<a href="<?= url('/contacts') ?>">Контакты</a>».</p>
      </div>
    <?php else: ?>
      <div id="faqRoot" class="reveal">
        <div class="faq-tools">
          <div class="faq-search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
            <input type="search" id="faqSearch" placeholder="Поиск по вопросам" aria-label="Поиск по вопросам" autocomplete="off">
            <button type="button" class="faq-clear" id="faqClear" aria-label="Очистить поиск">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          </div>
          <div class="faq-chips" role="tablist" aria-label="Темы вопросов">
            <button type="button" class="faq-chip is-active" data-topic="all">Все</button>
            <?php foreach ($faqGroups as $tid => $items): ?>
              <button type="button" class="faq-chip" data-topic="<?= h($tid) ?>"><?= h($faqTopics[$tid]) ?></button>
            <?php endforeach; ?>
          </div>
        </div>

        <?php foreach ($faqGroups as $tid => $items): ?>
          <div class="faq-group" data-group="<?= h($tid) ?>">
            <h3 class="faq-group-title"><?= h($faqTopics[$tid]) ?></h3>
            <?php foreach ($items as $f): $aid = 'faq-a-' . (int) $f['id']; ?>
              <div class="acc-item" data-q="<?= h(mb_strtolower($f['question'] . ' ' . $f['answer'], 'UTF-8')) ?>">
                <button type="button" class="acc-q" aria-expanded="false" aria-controls="<?= $aid ?>">
                  <span><?= h($f['question']) ?></span>
                  <span class="chev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg></span>
                </button>
                <div class="acc-a" id="<?= $aid ?>"><div class="acc-a-in"><p><?= h($f['answer']) ?></p></div></div>
              </div>
            <?php endforeach; ?>
          </div>
        <?php endforeach; ?>

        <p class="faq-empty">По Вашему запросу ничего не найдено. Попробуйте изменить формулировку.</p>
      </div>
    <?php endif; ?>
  </div>
</section>

<?php if ($faqs): ?>
<script>
(function () {
  var root = document.getElementById('faqRoot');
  if (!root) return;
  var search = document.getElementById('faqSearch');
  var clear = document.getElementById('faqClear');
  var searchWrap = search.closest('.faq-search');
  var chips = Array.prototype.slice.call(root.querySelectorAll('.faq-chip'));
  var groups = Array.prototype.slice.call(root.querySelectorAll('.faq-group'));
  var items = Array.prototype.slice.call(root.querySelectorAll('.acc-item'));
  var topic = 'all';

  function norm(s) { return (s || '').toLowerCase().replace(/ё/g, 'е').trim(); }

  function apply() {
    var q = norm(search.value);
    searchWrap.classList.toggle('has-value', search.value.length > 0);
    var shown = 0;
    items.forEach(function (it) {
      var inTopic = topic === 'all' || it.closest('.faq-group').getAttribute('data-group') === topic;
      var match = !q || norm(it.getAttribute('data-q')).indexOf(q) !== -1;
      var vis = inTopic && match;
      it.style.display = vis ? '' : 'none';
      if (vis) shown++;
    });
    groups.forEach(function (g) {
      var any = g.querySelector('.acc-item:not([style*="none"])');
      g.style.display = any ? '' : 'none';
    });
    root.classList.toggle('no-results', shown === 0);
  }

  search.addEventListener('input', apply);
  clear.addEventListener('click', function () { search.value = ''; search.focus(); apply(); });
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      chips.forEach(function (x) { x.classList.remove('is-active'); });
      c.classList.add('is-active');
      topic = c.getAttribute('data-topic');
      apply();
    });
  });
})();
</script>
<?php endif; ?>
<?php
$content = ob_get_clean();
render_page('Вопросы и ответы', $content, [
    'active' => '/faq',
    'meta' => 'Ответы на частые вопросы об участии в конкурсах Культурного центра «Музыкальный Мир»: заявки, оплата, результаты, дипломы.',
    'jsonld' => $faqLd,
]);
