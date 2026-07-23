<?php
/** Цели и задачи (slug goals): цели и задачи конкурса + правовые основания деятельности. */
$page = one("SELECT * FROM pages WHERE slug=?", ['goals']);

$defaultBody = '<p>Культурный центр «Музыкальный Мир» проводит всероссийские и международные онлайн-конкурсы культуры и искусства для детей, подростков и взрослых. Мы создаём условия для творческого развития участников, поддерживаем педагогов и учреждения культуры, помогаем раскрыть способности в музыке, хореографии, театре, изобразительном и цирковом искусстве.</p>'
    . '<p>Конкурсная деятельность строится на принципах открытости, равенства участников и объективной оценки жюри. Каждый участник получает аттестационный результат независимо от того, оформляет ли он наградной материал.</p>';

/* Цели - дословно из раздела «ЦЕЛИ И ЗАДАЧИ КОНКУРСА» официального положения (13 пунктов). */
$goals = [
    ['star',   'Выявление и поддержка талантливой молодёжи.'],
    ['mic',    'Популяризация искусства в его исполнительском и педагогическом аспектах.'],
    ['spark',  'Открытие новых имён и талантов в области искусств.'],
    ['shield', 'Сохранение и развитие традиций многонациональной культуры.'],
    ['globe',  'Знакомство участников с культурным наследием народов мира.'],
    ['cap',    'Повышение профессионального уровня руководителей коллективов.'],
    ['heart',  'Развитие у молодёжи толерантности и понимания других культур, способов самовыражения и человеческой индивидуальности.'],
    ['swap',   'Обмен опытом между коллективами, руководителями и педагогами.'],
    ['link',   'Поддержка постоянных творческих контактов между участниками, их объединение в рамках фестивального движения.'],
    ['chat',   'Создание атмосферы для профессионального общения участников конкурса, обмена опытом и репертуаром.'],
    ['case',   'Привлечение продюсеров и организаторов концертов для дальнейших контактов с коллективами и солистами.'],
    ['eye',    'Привлечение внимания государственных, международных, коммерческих и общественных организаций к вопросам творческих коллективов и исполнителей.'],
    ['cast',   'Освещение творчества детей и молодёжи в средствах массовой информации.'],
];

/* Задачи - функции и обязанности Оргкомитета (Пункт №3 официального положения). */
$tasks = [
    'Разработка положения о конкурсе и пакета документов по его проведению.',
    'Определение условий: правил, направлений и номинаций, сроков, критериев оценки и этапов.',
    'Создание равных условий для всех участников конкурса.',
    'Обеспечение гласности проведения конкурса.',
    'Формирование состава оценочного жюри и назначение его председателя.',
    'Проведение информационной кампании и координация работы с информационными партнёрами.',
    'Приём и сортировка конкурсного материала, проверка соответствия работ требованиям положения.',
    'Передача работ в оценочное жюри и координация его работы во время конкурса.',
    'Организация рассылки наградного материала и церемонии награждения победителей и призёров.',
    'Выдача наградных документов и обеспечение возможности проверки их подлинности.',
];

/* Наградные звания по 10-балльной системе (Пункт №11 положения) - уровень для инфографики. */
$titles = [
    ['ГРАН-ПРИ',          '9-10 баллов', 100],
    ['ЛАУРЕАТ I степени', '8-9 баллов',  90],
    ['ЛАУРЕАТ II степени','7-8 баллов',  80],
    ['ЛАУРЕАТ III степени','6-7 баллов', 70],
    ['ДИПЛОМАНТ I степени','5-6 баллов', 60],
    ['ДИПЛОМАНТ II степени','4-5 баллов',50],
    ['ДИПЛОМАНТ III степени','1-3 балла',30],
];

/* Компактный набор линейных иконок (24×24, наследуют stroke). */
function goal_icon(string $k): string {
    $p = [
        'star'   => '<path d="M12 3l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9L6.4 19.5l1.1-6L3.1 9.3l6-.8z"/>',
        'mic'    => '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
        'spark'  => '<path d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3"/>',
        'shield' => '<path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/>',
        'globe'  => '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.4 4 5.6 4 9s-1.4 6.6-4 9c-2.6-2.4-4-5.6-4-9s1.4-6.6 4-9z"/>',
        'cap'    => '<path d="M12 4 2 9l10 5 10-5z"/><path d="M6 11v5c0 1.4 2.7 3 6 3s6-1.6 6-3v-5"/>',
        'heart'  => '<path d="M12 20s-7-4.3-7-9.5A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7 3.5C19 15.7 12 20 12 20z"/>',
        'swap'   => '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
        'link'   => '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.5 1.5M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5"/>',
        'chat'   => '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/>',
        'case'   => '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>',
        'eye'    => '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
        'cast'   => '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>',
        'gavel'  => '<path d="M14 3l7 7-3 3-7-7zM11 8 4 15l3 3 7-7M3 21h8"/>',
        'law'    => '<path d="M12 3v18M5 7l-2 6a3 3 0 0 0 6 0L7 7zM19 7l-2 6a3 3 0 0 0 6 0l-2-6M4 7h16M8 21h8"/>',
        'flag'   => '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    ];
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="24" height="24">' . ($p[$k] ?? $p['star']) . '</svg>';
}

ob_start(); ?>
<style>
.article-cap p:first-of-type::first-letter{
  font-family:var(--ff-serif);font-size:3.4em;line-height:.78;float:left;
  padding:.04em .1em 0 0;color:var(--gold-2);font-weight:700;
}
.goals-wrap .card{position:relative;overflow:hidden}
.goals-wrap .card::after{content:"";position:absolute;left:0;top:0;width:100%;height:3px;
  background:linear-gradient(90deg,var(--gold),transparent);opacity:0;transition:opacity .3s}
@media(hover:hover){.goals-wrap .card:hover::after{opacity:.8}}
.goal-card{display:flex;gap:16px;align-items:flex-start}
.goal-ic{flex:none;width:48px;height:48px;border-radius:14px;display:grid;place-items:center;
  color:var(--gold-deep);background:linear-gradient(150deg,var(--gold-soft),transparent);border:1px solid var(--glass-brd);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.25);transition:transform .3s,box-shadow .3s}
[data-theme="dark"] .goal-ic{color:var(--gold)}
@media(hover:hover){.goals-wrap .card:hover .goal-ic{transform:scale(1.08);box-shadow:var(--shadow-glow)}}
.goal-card p{margin:0;color:var(--text-dim);line-height:1.5}
.goal-n{font-family:var(--ff-display);font-weight:800;color:var(--gold-2);font-size:.9rem;
  margin-bottom:2px;display:block;letter-spacing:.04em}
.title-row{display:flex;align-items:center;gap:14px;margin-bottom:12px}
.title-row .bar{flex:1}
.title-name{min-width:190px;font-family:var(--ff-display);font-weight:700;color:var(--text);font-size:.98rem}
.title-band{min-width:96px;text-align:right;color:var(--gold-ink);font-weight:700;font-size:.86rem}
[data-theme="dark"] .title-band{color:var(--gold)}
.chip-wrap{display:flex;flex-wrap:wrap;gap:10px}
.chip{display:inline-flex;align-items:center;gap:7px;padding:9px 15px;border-radius:999px;
  background:var(--panel);border:1px solid var(--glass-brd);color:var(--text);font-weight:600;
  font-size:.9rem;backdrop-filter:blur(10px);box-shadow:var(--shadow-card);transition:transform .2s,border-color .2s,color .2s}
.chip svg{width:16px;height:16px;color:var(--gold-deep);flex:none}
[data-theme="dark"] .chip svg{color:var(--gold)}
@media(hover:hover){.chip:hover{transform:translateY(-2px);border-color:var(--gold);color:var(--gold-2)}}
.legal-card{display:flex;gap:18px;align-items:flex-start}
.legal-ic{position:relative;flex:none;width:56px;height:56px;border-radius:16px;display:grid;place-items:center;
  color:#fff;background:var(--grad-gold);box-shadow:var(--shadow-btn)}
.legal-ic::after{content:"";position:absolute;inset:-4px;border-radius:19px;border:1px solid var(--glass-brd)}
.legal-card h3{margin:0 0 8px}
.legal-card p{margin:0;color:var(--text-dim);line-height:1.55}
@media(max-width:560px){
  .title-row{flex-wrap:wrap;gap:6px}
  .title-name{min-width:0;flex:1 0 100%;order:1}
  .title-row .bar{order:2;flex:1}
  .title-band{order:3;min-width:0}
}
</style>

<section class="section">
  <div class="container" style="max-width:820px">
    <div class="section-head reveal">
      <p class="eyebrow">О деятельности</p>
      <h2>Цели и задачи</h2>
      <div class="gold-rule"></div>
    </div>
    <div class="article-cap reveal">
      <?= $page['body'] ?? $defaultBody ?>
    </div>
  </div>
</section>

<section class="section section--tint">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Ради чего мы работаем</p>
      <h2>Цели конкурса</h2>
      <div class="gold-rule"></div>
      <p>Тринадцать целей из официального положения - каждая направлена на развитие и признание таланта.</p>
    </div>
    <div class="grid grid-3 goals-wrap">
      <?php foreach ($goals as $i => $g): ?>
        <div class="card reveal" style="--i:<?= $i ?>">
          <div class="goal-card">
            <span class="goal-ic"><?= goal_icon($g[0]) ?></span>
            <p><span class="goal-n"><?= sprintf('%02d', $i + 1) ?></span><?= h($g[1]) ?></p>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<section class="section">
  <div class="container" style="max-width:920px">
    <div class="section-head reveal">
      <p class="eyebrow">Что делает Оргкомитет</p>
      <h2>Задачи организаторов</h2>
      <div class="gold-rule"></div>
      <p>Полный цикл проведения конкурса - от разработки положения до выдачи наградных документов.</p>
    </div>
    <div class="card reveal" style="padding:30px 26px">
      <ol class="timeline" style="list-style:none">
        <?php foreach ($tasks as $i => $t): ?>
          <li class="timeline-item">
            <span class="tl-date">Этап <?= $i + 1 ?></span>
            <p style="margin-top:4px;color:var(--text-dim)"><?= h($t) ?></p>
          </li>
        <?php endforeach; ?>
      </ol>
    </div>
  </div>
</section>

<section class="section section--tint">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Конкурс в цифрах</p>
      <h2>Как устроена оценка</h2>
      <div class="gold-rule"></div>
    </div>

    <div class="grid grid-4 reveal" style="margin-bottom:40px">
      <div class="stat"><b data-count="9" data-suffix="">0</b><span>Номинаций</span></div>
      <div class="stat"><b data-count="10" data-suffix="">0</b><span>Возрастных категорий</span></div>
      <div class="stat"><b data-count="7" data-suffix="">0</b><span>Наградных званий</span></div>
      <div class="stat"><b data-count="10" data-suffix="-балльная">0</b><span>Система оценки</span></div>
    </div>

    <div class="grid grid-2" style="align-items:start">
      <div class="card reveal">
        <h3 style="margin-top:0">Наградные звания</h3>
        <p style="color:var(--muted);margin:0 0 20px;font-size:.9rem">Звание присуждается по сумме баллов оценочного жюри - от участника до Гран-при.</p>
        <?php foreach ($titles as $i => $t): ?>
          <div class="title-row reveal" style="--i:<?= $i ?>">
            <span class="title-name"><?= h($t[0]) ?></span>
            <div class="bar" data-value="<?= (int) $t[2] ?>"><i class="bar-fill"></i></div>
            <span class="title-band"><?= h($t[1]) ?></span>
          </div>
        <?php endforeach; ?>
      </div>

      <div class="card reveal">
        <h3 style="margin-top:0">Номинации</h3>
        <p style="color:var(--muted);margin:0 0 16px;font-size:.9rem">Многожанровый формат - от вокала до циркового искусства.</p>
        <div class="chip-wrap" style="margin-bottom:26px">
          <?php foreach ([
            ['mic','Вокальное искусство'], ['star','Инструментальное исполнительство'],
            ['chat','Театральное искусство'], ['cast','Художественное слово'],
            ['heart','Хореография'], ['spark','Изобразительное искусство'],
            ['eye','Фото- и видеоискусство'], ['flag','Цирковое искусство'],
            ['link','Иные направления'],
          ] as $n): ?>
            <span class="chip"><?= goal_icon($n[0]) ?><?= h($n[1]) ?></span>
          <?php endforeach; ?>
        </div>
        <h3>Возрастные категории</h3>
        <div class="chip-wrap">
          <?php foreach (['До 6 лет','7-8','9-10','11-12','13-15','16-18','19-25','25-45','46 +','Смешанная'] as $a): ?>
            <span class="chip" style="padding:8px 14px"><?= h($a) ?></span>
          <?php endforeach; ?>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container" style="max-width:920px">
    <div class="section-head reveal">
      <p class="eyebrow">Правовые основания</p>
      <h2>На основании закона</h2>
      <div class="gold-rule"></div>
      <p>Мероприятия проводятся в строгом соответствии с законодательством Российской Федерации.</p>
    </div>
    <div class="grid grid-2">
      <div class="card reveal">
        <div class="legal-card">
          <span class="legal-ic"><?= goal_icon('gavel') ?></span>
          <div>
            <h3>Глава 57 ГК РФ «Публичный конкурс»</h3>
            <p>Проведение конкурсов регулируется главой 57 Гражданского кодекса Российской Федерации (статьи 1057-1061): порядок объявления конкурса, права и обязанности организатора и участников, условия выдачи наградных материалов и порядок разрешения споров.</p>
          </div>
        </div>
      </div>
      <div class="card reveal" style="--i:1">
        <div class="legal-card">
          <span class="legal-ic"><?= goal_icon('law') ?></span>
          <div>
            <h3>Указ Президента РФ №808 от 24.12.2014</h3>
            <p>Указ утверждает Основы государственной культурной политики. Деятельность Культурного центра «Музыкальный Мир» соответствует его принципам: поддержка творческой самореализации граждан, сохранение культурного наследия и укрепление единого культурного пространства страны.</p>
          </div>
        </div>
      </div>
    </div>
    <p class="reveal" style="text-align:center;color:var(--muted);font-size:.9rem;margin-top:26px;max-width:760px;margin-left:auto;margin-right:auto">
      Дополнительно соблюдаются требования Федерального закона от 27.07.2006 №152-ФЗ «О персональных данных» и профильного законодательства о защите информации. Генеральный директор - Ильясов А.И.
    </p>
  </div>
</section>
<?php
$content = ob_get_clean();
render_page('Цели и задачи', $content, ['active' => '/goals', 'meta' => 'Цели и задачи конкурсов Культурного центра «Музыкальный Мир»: поддержка талантов, сохранение культурных традиций, номинации, система оценки и правовые основания деятельности.']);
