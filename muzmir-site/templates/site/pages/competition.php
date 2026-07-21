<?php
/** Страница одного конкурса. Переменная $slug задана роутером. */

$slug = $slug ?? '';
$c = one("SELECT * FROM competitions WHERE slug = ? AND status <> 'draft'", [$slug]);

/* --- 404 если не найден --- */
if (!$c) {
    http_response_code(404);
    ob_start(); ?>
    <section class="section">
      <div class="container" style="text-align:center;max-width:640px">
        <p class="eyebrow">Ошибка 404</p>
        <h1>Конкурс не найден</h1>
        <p style="color:var(--muted)">Возможно, конкурс завершён или ссылка устарела. Посмотрите <a href="<?= url('/competitions') ?>">все конкурсы</a>.</p>
        <div style="margin-top:24px"><a class="btn btn--primary" href="<?= url('/competitions') ?>">К каталогу конкурсов</a></div>
      </div>
    </section>
    <?php
    $content = ob_get_clean();
    render_page('Конкурс не найден', $content, ['active' => '/competitions', 'meta' => 'Конкурс не найден.']);
    return;
}

/* --- Метаданные и справочники --- */
$dirLabel = ['multi' => 'Многожанровый', 'patriotic' => 'Патриотический', 'thematic' => 'Тематический'];
$typeLabel = $c['type'] === 'international' ? 'Международный конкурс' : 'Всероссийский конкурс';

$statusMap = match ($c['status']) {
    'open'    => ['open', 'Приём заявок открыт'],
    'judging' => ['intl', 'Идёт оценка жюри'],
    default   => ['closed', 'Конкурс завершён'],
};
$isOpen = $c['status'] === 'open';

/* Номинации: из JSON конкурса, иначе полный справочник. */
$noms = [];
if (!empty($c['nominations'])) {
    $decoded = json_decode($c['nominations'], true);
    if (is_array($decoded)) $noms = $decoded;
}
if (!$noms) $noms = array_keys(NOMINATIONS());

$ages = AGE_CATEGORIES();
$forms = FORMATIONS();

/* Награды: индивидуальный прайс конкурса или общий шаблон (competition_id IS NULL). */
$awards = all("SELECT * FROM awards_prices WHERE competition_id = ?", [$c['id']]);
if (!$awards) $awards = all("SELECT * FROM awards_prices WHERE competition_id IS NULL ORDER BY id");

/* Результаты: заявки с выставленной оценкой. */
$results = all(
    "SELECT full_name, group_name, is_group, nomination, work_title, result, score
     FROM applications
     WHERE competition_id = ? AND status IN ('graded','sent') AND result <> ''
     ORDER BY score DESC, full_name ASC",
    [$c['id']]
);

$applyUrl = url('/apply') . '?competition=' . rawurlencode($c['slug']);

/* Описание конкурса. */
$about = trim((string)$c['description']);
if ($about === '') {
    $about = 'КЦ «Музыкальный Мир» проводит ' . mb_strtolower($typeLabel)
        . ' «' . $c['name'] . '» в дистанционном формате. К участию приглашаются исполнители и коллективы любого возраста и уровня подготовки. '
        . 'Работы принимаются по видеозаписи, конкурс проходит по номинациям и возрастным категориям. Итоги оценивает компетентное жюри, наградные документы направляются на электронную почту участника.';
}

/* --- Иконки --- */
$ic = [
  'cal'    => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  'flag'   => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/></svg>',
  'wallet' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>',
  'list'   => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  'pdf'    => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3"/></svg>',
  'award'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="6"/><path d="M8.2 13.9 7 22l5-3 5 3-1.2-8.1"/></svg>',
];

/* Инфо-строки для сводки. */
$dateRange = '';
if (!empty($c['start_date']) || !empty($c['end_date'])) {
    if (!empty($c['start_date']) && !empty($c['end_date'])) $dateRange = ru_date($c['start_date']) . ' - ' . ru_date($c['end_date']);
    elseif (!empty($c['end_date'])) $dateRange = 'до ' . ru_date($c['end_date']);
    else $dateRange = 'с ' . ru_date($c['start_date']);
}

ob_start(); ?>
<section class="comp-banner">
  <div class="comp-banner__bg"<?= !empty($c['cover']) ? ' style="background-image:url(\'' . h($c['cover']) . '\')"' : '' ?>></div>
  <div class="container comp-banner__inner reveal">
    <div class="comp-banner__badges">
      <span class="badge badge--<?= $statusMap[0] ?>"><?= h($statusMap[1]) ?></span>
      <span class="badge badge--intl"><?= h($typeLabel) ?></span>
      <span class="badge badge--intl"><?= h($dirLabel[$c['direction']] ?? 'Многожанровый') ?></span>
    </div>
    <h1><?= h($c['name']) ?></h1>
    <p class="comp-banner__lead">Дистанционный конкурс культуры и искусства при информационной поддержке Министерств культуры и образования субъектов Российской Федерации.</p>
    <div class="comp-banner__cta">
      <?php if ($isOpen): ?>
        <a class="btn btn--primary btn--lg" href="<?= h($applyUrl) ?>">Подать заявку</a>
      <?php else: ?>
        <a class="btn btn--ghost btn--lg" href="<?= url('/competitions') ?>">Другие конкурсы</a>
      <?php endif; ?>
      <?php if (!empty($c['regulation_pdf'])): ?>
        <a class="btn btn--ghost btn--lg" href="<?= h($c['regulation_pdf']) ?>" target="_blank" rel="noopener"><?= $ic['pdf'] ?> Скачать положение (PDF)</a>
      <?php endif; ?>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="comp-info reveal">
      <div class="comp-info__item">
        <span class="comp-info__ic"><?= $ic['cal'] ?></span>
        <div><b>Приём заявок</b><span><?= $dateRange !== '' ? h($dateRange) : 'Уточняется в положении' ?></span></div>
      </div>
      <div class="comp-info__item">
        <span class="comp-info__ic"><?= $ic['flag'] ?></span>
        <div><b>Срок аттестации</b><span><?= !empty($c['results_date']) ? h(ru_date($c['results_date'])) : 'По окончании приёма заявок' ?></span></div>
      </div>
      <div class="comp-info__item">
        <span class="comp-info__ic"><?= $ic['wallet'] ?></span>
        <div><b>Участие</b><span><?= $c['is_paid'] ? h(money((int)$c['price'])) . ' за заявку' : 'Бесплатно' ?></span></div>
      </div>
      <div class="comp-info__item">
        <span class="comp-info__ic"><?= $ic['list'] ?></span>
        <div><b>Номинаций</b><span><?= count($noms) ?> · <?= count($ages) ?> возрастных категорий</span></div>
      </div>
    </div>

    <div class="comp-tabs reveal" id="compTabs">
      <div class="comp-tabs__nav" role="tablist">
        <button class="comp-tab is-active" role="tab" aria-selected="true" data-tab="about">О конкурсе</button>
        <button class="comp-tab" role="tab" aria-selected="false" data-tab="reg">Положение</button>
        <button class="comp-tab" role="tab" aria-selected="false" data-tab="awards">Образцы наград</button>
        <button class="comp-tab" role="tab" aria-selected="false" data-tab="results">Результаты</button>
      </div>

      <div class="comp-panel is-active" data-panel="about">
        <p><?= nl2br(h(normalize_text($about))) ?></p>
        <h3 style="margin-top:28px">Возрастные категории</h3>
        <div class="comp-chips">
          <?php foreach ($ages as $a): ?><span class="comp-chip"><?= h($a) ?></span><?php endforeach; ?>
        </div>
        <h3 style="margin-top:28px">Формы исполнения</h3>
        <div class="comp-chips">
          <?php foreach ($forms as $f): ?><span class="comp-chip"><?= h($f) ?></span><?php endforeach; ?>
        </div>
      </div>

      <div class="comp-panel" data-panel="reg">
        <p>Положение конкурса определяет порядок подачи заявок, требования к конкурсным работам, номинации, возрастные категории и критерии оценки. Просим ознакомиться с положением до подачи заявки.</p>
        <?php if (!empty($c['regulation_pdf'])): ?>
          <p><a class="btn btn--primary" href="<?= h($c['regulation_pdf']) ?>" target="_blank" rel="noopener"><?= $ic['pdf'] ?> Скачать положение (PDF)</a></p>
        <?php else: ?>
          <p style="color:var(--muted)">Документ положения готовится к публикации. По вопросам участия обратитесь в Оргкомитет по контактам, указанным в разделе «Контакты».</p>
        <?php endif; ?>
        <h3 style="margin-top:28px">Номинации</h3>
        <div class="comp-chips">
          <?php foreach ($noms as $n): ?><span class="comp-chip"><?= h($n) ?></span><?php endforeach; ?>
        </div>
      </div>

      <div class="comp-panel" data-panel="awards">
        <p>По итогам конкурса участники получают наградные документы в электронном виде. Оригиналы дипломов, кубки, медали и статуэтки можно заказать дополнительно.</p>
        <?php if ($awards): ?>
          <div class="comp-awards">
            <table class="comp-table">
              <thead><tr><th>Наградной материал</th><th>Вид</th><th>Стоимость</th></tr></thead>
              <tbody>
                <?php foreach ($awards as $a): ?>
                  <tr>
                    <td><?= h($a['item']) ?></td>
                    <td><?= $a['kind'] === 'original' ? 'Оригинал' : 'Электронный' ?></td>
                    <td><?= (int)$a['price'] > 0 ? h(money((int)$a['price'])) : 'Входит в участие' ?></td>
                  </tr>
                <?php endforeach; ?>
              </tbody>
            </table>
          </div>
          <p style="margin-top:18px"><a class="btn btn--ghost" href="<?= url('/awards') ?>"><?= $ic['award'] ?> Все образцы наград</a></p>
        <?php else: ?>
          <p style="color:var(--muted)">Образцы наград готовятся к публикации.</p>
        <?php endif; ?>
      </div>

      <div class="comp-panel" data-panel="results">
        <?php if ($results): ?>
          <p>Итоги конкурса. Наградные документы направлены на электронную почту участников.</p>
          <div class="comp-awards">
            <table class="comp-table">
              <thead><tr><th>Участник</th><th>Номинация</th><th>Результат</th></tr></thead>
              <tbody>
                <?php foreach ($results as $r): ?>
                  <tr>
                    <td><?= h($r['is_group'] && $r['group_name'] !== '' ? $r['group_name'] : $r['full_name']) ?><?php if (!empty($r['work_title'])): ?><br><span style="color:var(--muted);font-size:.86rem"><?= h($r['work_title']) ?></span><?php endif; ?></td>
                    <td><?= h($r['nomination']) ?></td>
                    <td><b style="color:var(--gold)"><?= h($r['result']) ?></b></td>
                  </tr>
                <?php endforeach; ?>
              </tbody>
            </table>
          </div>
        <?php else: ?>
          <p style="color:var(--muted)">Результаты будут опубликованы после завершения оценки жюри и направлены участникам на электронную почту. Проверить подлинность полученного диплома можно на странице <a href="<?= url('/verify') ?>">проверки документов</a>.</p>
        <?php endif; ?>
      </div>
    </div>

    <?php if ($isOpen): ?>
      <div class="comp-final reveal">
        <h2>Готовы участвовать?</h2>
        <p>Заполните заявку - это займёт несколько минут. Умная форма подскажет и проверит данные.</p>
        <a class="btn btn--primary btn--lg" href="<?= h($applyUrl) ?>">Подать заявку на конкурс</a>
      </div>
    <?php endif; ?>
  </div>
</section>

<style>
.comp-banner{position:relative;background:var(--grad-gold);color:#1a1206;overflow:hidden;padding:64px 0}
.comp-banner__bg{position:absolute;inset:0;background-size:cover;background-position:center;opacity:.32}
.comp-banner::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(20,14,3,.32),rgba(20,14,3,.6))}
.comp-banner__inner{position:relative;z-index:1;max-width:820px}
.comp-banner__badges{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
.comp-banner__inner h1{color:#fff;margin-bottom:.3em}
.comp-banner__lead{font-size:1.12rem;color:rgba(255,255,255,.92);max-width:640px;margin-bottom:24px}
.comp-banner__cta{display:flex;flex-wrap:wrap;gap:14px}
.comp-banner .badge--intl{background:rgba(255,252,245,.94);color:#1a1206}
.comp-banner .badge--open{background:rgba(143,188,148,.95);color:#173a1e}
.comp-banner .badge--closed{background:rgba(255,252,245,.9);color:#8a2e2e}

.comp-info{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-bottom:44px}
.comp-info__item{display:flex;gap:14px;align-items:flex-start;background:var(--panel);border:1px solid var(--glass-brd);
  border-radius:var(--radius);padding:20px;box-shadow:var(--shadow-card);backdrop-filter:blur(12px)}
.comp-info__ic{flex:0 0 auto;width:46px;height:46px;border-radius:12px;background:var(--gold-soft);
  display:flex;align-items:center;justify-content:center;color:var(--gold)}
.comp-info__ic svg{width:24px;height:24px}
.comp-info__item b{display:block;font-family:var(--ff-serif);color:var(--text);font-size:1.08rem}
.comp-info__item span{color:var(--muted);font-size:.92rem}

.comp-tabs__nav{display:flex;flex-wrap:wrap;gap:6px;border-bottom:1px solid var(--line);margin-bottom:28px}
.comp-tab{background:none;border:none;padding:14px 22px;font-family:var(--ff-body);font-weight:700;font-size:1rem;
  color:var(--muted);cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-1px;transition:color .18s,border-color .18s}
.comp-tab:hover{color:var(--gold)}
.comp-tab.is-active{color:var(--text);border-bottom-color:var(--gold)}
.comp-panel{display:none;animation:fadeUp .35s ease}
.comp-panel.is-active{display:block}
.comp-panel p{color:var(--text-dim)}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}

.comp-chips{display:flex;flex-wrap:wrap;gap:9px;margin-top:6px}
.comp-chip{display:inline-block;padding:7px 15px;border-radius:999px;background:var(--gold-soft);
  border:1px solid var(--glass-brd);color:var(--gold);font-size:.9rem;font-weight:600}

.comp-awards{overflow-x:auto}
.comp-table{width:100%;border-collapse:collapse;min-width:480px}
.comp-table th,.comp-table td{text-align:left;padding:13px 16px;border-bottom:1px solid var(--line);vertical-align:top;color:var(--text)}
.comp-table th{font-family:var(--ff-body);font-size:.82rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.comp-table tbody tr:hover{background:var(--gold-soft)}

.comp-final{margin-top:48px;text-align:center;background:var(--panel);border:1px solid var(--glass-brd);
  border-radius:var(--radius);padding:44px 24px;box-shadow:var(--shadow-card);backdrop-filter:blur(12px)}
.comp-final h2{background:var(--grad-gold);-webkit-background-clip:text;background-clip:text;color:transparent;display:inline-block}
.comp-final p{color:var(--text-dim);max-width:520px;margin:0 auto 22px}

@media (max-width:960px){.comp-info{grid-template-columns:repeat(2,1fr)}}
@media (max-width:640px){.comp-info{grid-template-columns:1fr}.comp-banner{padding:44px 0}}
</style>
<script>
(function(){
  var root=document.getElementById('compTabs');
  if(!root)return;
  var tabs=root.querySelectorAll('.comp-tab'),panels=root.querySelectorAll('.comp-panel');
  tabs.forEach(function(t){
    t.addEventListener('click',function(){
      var key=t.getAttribute('data-tab');
      tabs.forEach(function(x){var on=x===t;x.classList.toggle('is-active',on);x.setAttribute('aria-selected',on?'true':'false');});
      panels.forEach(function(p){p.classList.toggle('is-active',p.getAttribute('data-panel')===key);});
    });
  });
})();
</script>
<?php
$content = ob_get_clean();
$metaBase = $about !== '' ? mb_substr(trim(preg_replace('/\s+/u', ' ', strip_tags($about))), 0, 155) : '';
render_page($c['name'], $content, [
    'active'   => '/competitions',
    'meta'     => $metaBase !== '' ? $metaBase : ($typeLabel . ' «' . $c['name'] . '» - КЦ «Музыкальный Мир». Подача заявки онлайн, номинации, возрастные категории, наградные документы.'),
    'og_image' => !empty($c['cover']) ? $c['cover'] : asset('img/logo_muzmir_main.png'),
]);
