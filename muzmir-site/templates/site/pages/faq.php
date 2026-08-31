<?php
/** Вопросы и ответы: премиум-аккордеон из таблицы faq с поиском и группировкой по темам. */
// Тема вопроса — своя колонка (см. $faqTopicOf ниже); добавляется мягко.
try { db()->exec("ALTER TABLE faq ADD COLUMN topic TEXT DEFAULT ''"); } catch (\Throwable $e) {}
$faqs = all("SELECT * FROM faq WHERE active=1 ORDER BY sort, id");

/* Темы выводятся из текста вопроса (в таблице faq нет колонки категории) - без изменения выборки. */
/* Порядок тем = порядок вопросов на странице. Первым идёт участие, сразу за ним
 * то, о чём спрашивают чаще всего: когда придут результаты и сколько делается
 * наградной материал. Оплата и жюри — ниже: эти вопросы задают реже. */
$faqTopics = [
    'uchastie'  => 'Участие',
    'rezultaty' => 'Результаты',
    'nagrady'   => 'Награды',
    'oplata'    => 'Оплата',
    'zhuri'     => 'Жюри',
];
$faqTopicOf = static function (array $f) use ($faqTopics): string {
    /* ТЕМА БЕРЁТСЯ ИЗ САМОЙ ЗАПИСИ, А НЕ УГАДЫВАЕТСЯ ПО СЛОВАМ.
     *
     * Раньше тема определялась только по ключевым словам ответа, и вопрос о
     * сроках изготовления награды попадал в «Оплату» (в ответе есть слово
     * «оплаты»), а вопрос о сроках результатов — в «Награды» (там есть
     * «наградные материалы»). Порядок вопросов на странице от этого путался.
     * Теперь у записи есть своя тема; подбор по словам остаётся запасным
     * вариантом для старых записей, где тема ещё не проставлена. */
    $own = trim((string) ($f['topic'] ?? ''));
    if ($own !== '' && isset($faqTopics[$own])) return $own;

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

/* SVG-иконки тем (в стиле бренда, без эмодзи). */
$faqIcons = [
    'uchastie'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V6l11-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="20" cy="16" r="3"/></svg>',
    'oplata'    => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/><path d="M6 15h4"/></svg>',
    'rezultaty' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19V5"/><path d="M4 19h16"/><rect x="7" y="11" width="3" height="5"/><rect x="12" y="7" width="3" height="9"/><rect x="17" y="13" width="3" height="3"/></svg>',
    'nagrady'   => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="9" r="5"/><path d="M8.5 13.5 7 22l5-3 5 3-1.5-8.5"/></svg>',
    'zhuri'     => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="17.5" cy="9.5" r="2.2"/><path d="M15 20c.2-2.4 1.4-4.3 3.3-5"/></svg>',
];

/* Склонение существительного «вопрос» под число. */
$faqPlural = static function (int $n): string {
    $m10 = $n % 10; $m100 = $n % 100;
    if ($m10 === 1 && $m100 !== 11) return 'вопрос';
    if ($m10 >= 2 && $m10 <= 4 && ($m100 < 10 || $m100 >= 20)) return 'вопроса';
    return 'вопросов';
};

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
/* Премиум-аккордеон: раскрытие grid-template-rows 0fr->1fr, глубина и золотые орнаменты, без обрезаний длинного текста. */
#faqRoot .faq-tools{max-width:100%;margin:0 auto 28px}
#faqRoot .faq-search{position:relative;margin-bottom:18px}
#faqRoot .faq-search svg{position:absolute;left:18px;top:50%;transform:translateY(-50%);width:20px;height:20px;color:var(--gold);pointer-events:none}
#faqRoot .faq-search input{width:100%;margin:0;padding:16px 46px 16px 50px;font-size:1rem;border-radius:999px;box-shadow:var(--shadow-soft)}
#faqRoot .faq-search .faq-clear{position:absolute;right:10px;top:50%;transform:translateY(-50%);width:34px;height:34px;display:none;align-items:center;justify-content:center;border:0;background:none;color:var(--muted);cursor:pointer;border-radius:50%}
#faqRoot .faq-search .faq-clear:hover{color:var(--gold-ink)}
#faqRoot .faq-search .faq-clear svg{position:static;transform:none;width:18px;height:18px;color:inherit}
#faqRoot .faq-search.has-value .faq-clear{display:flex}
#faqRoot .faq-chips{display:flex;flex-wrap:wrap;gap:10px}
#faqRoot .faq-chip{padding:10px 16px;min-height:42px;border-radius:999px;border:1.5px solid var(--glass-brd);background:var(--panel);color:var(--text-dim);font-weight:700;font-size:.9rem;cursor:pointer;display:inline-flex;align-items:center;gap:9px;backdrop-filter:blur(8px);transition:transform .18s,border-color .18s,color .18s,box-shadow .18s}
#faqRoot .faq-chip:hover{border-color:var(--gold);color:var(--text)}
#faqRoot .faq-chip:active{transform:scale(.96)}
#faqRoot .faq-chip.is-active{background:var(--grad-gold);color:var(--gold-fg);border-color:transparent;box-shadow:var(--shadow-btn)}
#faqRoot .faq-chip .cn{font-size:.75rem;font-weight:800;min-width:22px;height:20px;padding:0 6px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;background:var(--gold-soft);color:var(--gold-ink)}
[data-theme="dark"] #faqRoot .faq-chip .cn{color:var(--gold)}
#faqRoot .faq-chip.is-active .cn{background:color-mix(in srgb,var(--gold-fg) 18%,transparent);color:var(--gold-fg)}
#faqRoot .faq-count{margin:0 0 22px;font-size:.86rem;color:var(--muted)}
#faqRoot .faq-count b{color:var(--gold-ink);font-weight:800}
[data-theme="dark"] #faqRoot .faq-count b{color:var(--gold)}

#faqRoot .faq-group{margin-bottom:30px}
#faqRoot .faq-group-title{font-family:var(--ff-serif);font-size:1.22rem;color:var(--gold-ink);margin:0 0 14px;display:flex;align-items:center;gap:12px}
[data-theme="dark"] #faqRoot .faq-group-title{color:var(--gold)}
#faqRoot .faq-group-title .g-ic{flex:none;width:40px;height:40px;border-radius:13px;display:flex;align-items:center;justify-content:center;background:var(--gold-soft);border:1px solid var(--glass-brd);color:var(--gold-ink);box-shadow:inset 0 0 16px rgba(201,168,76,.10)}
[data-theme="dark"] #faqRoot .faq-group-title .g-ic{color:var(--gold)}
#faqRoot .faq-group-title .g-ic svg{width:21px;height:21px}
#faqRoot .faq-group-title .g-n{margin-left:auto;font-family:var(--ff-body);font-size:.78rem;font-weight:800;color:var(--muted);letter-spacing:.02em;white-space:nowrap}

#faqRoot .acc-item{position:relative;background:linear-gradient(180deg,var(--panel),color-mix(in srgb,var(--panel-solid) 34%,transparent));transition:transform .25s,box-shadow .25s,border-color .25s}
#faqRoot .acc-item::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:3px 0 0 3px;background:var(--grad-gold);transform:scaleY(0);transform-origin:top;transition:transform .32s cubic-bezier(.2,.8,.2,1)}
#faqRoot .acc-item.open{border-color:var(--gold-2);box-shadow:var(--shadow-card)}
#faqRoot .acc-item.open::before{transform:scaleY(1)}
@media(hover:hover){#faqRoot .acc-item:hover{border-color:var(--gold);box-shadow:var(--shadow-soft)}}
#faqRoot .acc-q{width:100%;background:none;border:0;font:inherit;text-align:left;min-height:44px;gap:14px}
#faqRoot .acc-q>span:first-child{flex:1;overflow-wrap:anywhere;font-weight:700}
#faqRoot .acc-q .chev{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:var(--gold-soft);color:var(--gold-ink);transition:transform .3s,background .25s,color .25s}
[data-theme="dark"] #faqRoot .acc-q .chev{color:var(--gold)}
#faqRoot .acc-q .chev svg{width:18px;height:18px}
#faqRoot .acc-item.open .acc-q .chev{background:var(--grad-gold);color:var(--gold-fg);transform:rotate(180deg)}
#faqRoot .acc-a{max-height:none;display:grid;grid-template-rows:0fr;padding:0 22px 0 25px;transition:grid-template-rows .4s cubic-bezier(.2,.8,.2,1)}
#faqRoot .acc-item.open .acc-a{grid-template-rows:1fr}
#faqRoot .acc-a-in{overflow:hidden;min-height:0}
#faqRoot .acc-a-in p{margin:0;padding:16px 0 20px;color:var(--text-dim);line-height:1.65;overflow-wrap:anywhere;border-top:1px solid var(--line)}
#faqRoot .faq-empty{text-align:center;color:var(--muted);padding:40px 10px;display:none}
#faqRoot .faq-empty svg{width:46px;height:46px;color:var(--gold);opacity:.5;margin-bottom:12px}
#faqRoot.no-results .faq-empty{display:block}
/* Мелкие подписи в чипах не должны рваться посреди слова. */
#faqRoot .faq-chip{word-break:normal;overflow-wrap:normal}
@media (max-width:520px){
  #faqRoot .acc-q{padding:16px}
  #faqRoot .acc-a{padding:0 16px 0 19px}
  #faqRoot .faq-group-title .g-n{display:none}
}
@media (prefers-reduced-motion:reduce){
  #faqRoot .acc-item,#faqRoot .faq-chip:active{transform:none}
}
</style>

<section class="section">
  <div class="container" style="max-width:820px">
    <a class="aw-back" href="<?= url('/menu') ?>"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>Назад</a>
    <div class="section-head reveal">
      <p class="eyebrow">Обратная связь</p>
      <h2>Часто задаваемые вопросы</h2>
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
            <button type="button" class="faq-chip is-active" data-topic="all">Все<span class="cn"><?= count($faqs) ?></span></button>
            <?php foreach ($faqGroups as $tid => $items): ?>
              <button type="button" class="faq-chip" data-topic="<?= h($tid) ?>"><?= h($faqTopics[$tid]) ?><span class="cn"><?= count($items) ?></span></button>
            <?php endforeach; ?>
          </div>
        </div>
        <p class="faq-count">Показано <b id="faqShown"><?= count($faqs) ?></b> из <?= count($faqs) ?> <?= $faqPlural(count($faqs)) ?></p>

        <?php foreach ($faqGroups as $tid => $items): ?>
          <div class="faq-group" data-group="<?= h($tid) ?>">
            <h3 class="faq-group-title">
              <span class="g-ic"><?= $faqIcons[$tid] ?? $faqIcons['uchastie'] ?></span>
              <span><?= h($faqTopics[$tid]) ?></span>
              <span class="g-n"><?= count($items) ?> <?= $faqPlural(count($items)) ?></span>
            </h3>
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

        <div class="faq-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          <p style="margin:0">По Вашему запросу ничего не найдено. Попробуйте изменить формулировку.</p>
        </div>
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
  var shownEl = document.getElementById('faqShown');
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
    if (shownEl) shownEl.textContent = shown;
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
