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
$typeShort = $c['type'] === 'international' ? 'Международный' : 'Всероссийский';
$thematics = match ($c['direction']) {
    'patriotic' => 'Патриотическая',
    'thematic'  => 'Тематическая',
    default     => 'Свободная',
};
// «Слава России» — многожанровый по составу, но патриотический по тематике (эталон данных).
if (($c['slug'] ?? '') === 'slava-rossii') $thematics = 'Патриотическая';

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

$nomMap = NOMINATIONS();
$ages   = AGE_CATEGORIES();
$forms  = FORMATIONS();

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

/* Призовые тиры (для читаемого «пьедестала» отдельно от плоской таблицы). */
$podium = ['gp' => [], 'lau' => []];
foreach ($results as $r) {
    $res = mb_strtoupper((string)$r['result']);
    if (mb_strpos($res, 'ГРАН') !== false)          $podium['gp'][]  = $r;
    elseif (mb_strpos($res, 'ЛАУРЕАТ') !== false)    $podium['lau'][] = $r;
}
$hasPodium = $podium['gp'] || $podium['lau'];

$applyUrl = url('/apply') . '?competition=' . rawurlencode($c['slug']);

/* Описание конкурса. */
$about = trim((string)$c['description']);
if ($about === '') {
    $about = 'КЦ «Музыкальный Мир» проводит ' . mb_strtolower($typeLabel)
        . ' «' . $c['name'] . '» в дистанционном формате. К участию приглашаются исполнители и коллективы любого возраста и уровня подготовки. '
        . 'Работы принимаются по видеозаписи, конкурс проходит по номинациям и возрастным категориям. Итоги оценивает компетентное жюри, наградные документы направляются на электронную почту участника.';
}

/* Цели конкурса (по официальному положению, п. «Цели и задачи»). */
$goals = [
    'Выявление и поддержка талантливой молодёжи, открытие новых имён в области искусств.',
    'Популяризация искусства в его исполнительском и педагогическом аспектах.',
    'Сохранение и развитие традиций многонациональной культуры, знакомство с наследием народов.',
    'Повышение профессионального уровня руководителей коллективов, обмен опытом и репертуаром.',
];

/* --- Иконки --- */
$ic = [
  'cal'    => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  'flag'   => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/></svg>',
  'wallet' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>',
  'list'   => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  'pdf'    => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M12 18v-6M9 15l3 3 3-3"/></svg>',
  'award'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="6"/><path d="M8.2 13.9 7 22l5-3 5 3-1.2-8.1"/></svg>',
  'globe'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.5 3.8 5.6 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.6-3.8-9S9.5 5.5 12 3z"/></svg>',
  'star'   => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2l2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.8 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8z"/></svg>',
  'users'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13A4 4 0 0 1 16 11"/></svg>',
  'video'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>',
  'check'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
  'ban'    => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></svg>',
  'scale'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3v18M5 7h14M7 7l-3 6a3 3 0 0 0 6 0zM17 7l-3 6a3 3 0 0 0 6 0z"/></svg>',
  'medal'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="15" r="6"/><path d="M8.5 10 5 2M15.5 10 19 2M12 12v3l2 1"/></svg>',
  'gavel'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M14 4l6 6M9 9l6 6M11 6l3-3 7 7-3 3zM3 21l7-7M3 21h7"/></svg>',
  'share'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
  'crown'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 7l4.5 4L12 5l4.5 6L21 7l-1.6 12H4.6z"/><path d="M4.6 19h14.8"/></svg>',
];

/* Инфо-строки для сводки. */
$dateRange = '';
if (!empty($c['start_date']) || !empty($c['end_date'])) {
    if (!empty($c['start_date']) && !empty($c['end_date'])) $dateRange = ru_date($c['start_date']) . ' - ' . ru_date($c['end_date']);
    elseif (!empty($c['end_date'])) $dateRange = 'до ' . ru_date($c['end_date']);
    else $dateRange = 'с ' . ru_date($c['start_date']);
}

/* --- Критерии, требования, звания, доп-дипломы — по официальным положениям (п.7,8,11,12). --- */
$generalCriteria = [
    'Уровень мастерства исполнения',
    'Сложность и оригинальность репертуара',
    'Драматургия произведения и режиссура',
    'Актёрское мастерство, артистизм',
    'Музыкальность',
    'Художественная трактовка образа',
    'Дикция, диапазон',
    'Соответствие репертуара возрастным и индивидуальным возможностям конкурсанта',
    'Сценическая культура, общее впечатление',
];
$nominationCriteria = [
    'Вокальное искусство — сольное исполнение' => ['чистота интонации','сценическая культура','фразировка','исполнительское мастерство','подбор репертуара','художественная выразительность','сценический образ'],
    'Вокальное искусство — дуэты, ансамбли, хоры' => ['ансамблевый строй','сложность репертуара (многоголосие, полифония)','оригинальная аранжировка и трактовка произведения','исполнительское мастерство','художественная выразительность','сценическая культура'],
    'Инструментальное исполнительство' => ['уровень владения инструментом (звукоизвлечение, строй, чистота интонации)','техника исполнения (постановка аппарата, ритмичность, штрихи, приёмы, аппликатура)','музыкальность (артикуляция, стиль, нюансировка, фразировка)','эмоциональность (агогика, трактовка, характер произведения)','артистичность и эстетика внешнего вида','для ансамблей — сыгранность','общее художественное впечатление'],
    'Театральное искусство' => ['исполнительское мастерство: органичность, дикция, дыхание, убедительность в образе','режиссёрское решение: мизансцены, целостность композиции, темпоритм','выбор репертуара по возрасту и творческим возможностям','сценическое оформление: костюмы, грим, декорации, музыкальное оформление'],
    'Художественное слово' => ['техника речи: дикция, литературное произношение, владение голосом и дыханием','исполнительское мастерство: выразительность, логические ударения и паузы, глубина проживания текста','выбор репертуара по возрасту и художественной ценности','сценическая культура: органичность, мимика, жест, эстетика внешнего вида'],
    'Хореография' => ['исполнительское мастерство и техника: чистота элементов, синхронность, ритм, пластичность','балетмейстерская работа: рисунок танца, сценическое пространство, соответствие стилю','артистизм и выразительность: эмоциональная отдача, раскрытие образа','сценический образ: костюмы, причёски, макияж, реквизит'],
    'Цирковое искусство' => ['трюковая техника: сложность, чистота, соблюдение техники безопасности','артистизм: выразительность, актёрская игра, контакт со зрителем','режиссура: целостность композиции, динамика, работа с музыкой','сценический образ: костюм, грим, реквизит и аппаратура','оригинальность: новизна идеи, авторский подход'],
    'Изобразительное искусство' => ['техника и мастерство владения художественным материалом','композиция и колорит: перспектива, пропорции, цветовое решение','оригинальность замысла, отсутствие срисовывания и плагиата','художественная выразительность и глубина образа','качество цифровой копии: чёткое фото/скан под прямым углом, без бликов и фильтров'],
    'Фото- и видеоискусство' => ['художественный замысел: раскрытие темы, оригинальность идеи','композиционное решение: построение кадра, ракурс, баланс','техническое мастерство: резкость, экспозиция, цветопередача, стабильность','постобработка и монтаж: аккуратность, ритмичность, уместность','эмоциональное воздействие и общее зрительское впечатление'],
];
$materialReq = [
    '1 заявка = 1 конкурсный номер; количество заявок от участника не ограничено.',
    'Видео принимается без монтажа, склеек, стоп-кадров и наложения видеоэффектов; остановка камеры во время записи не допускается.',
    'Качество записи не ниже 480 пикселей; аудио-трек, сопровождение и вокал должны хорошо прослушиваться.',
    'Конкурсный материал не старше 1 года с момента исполнения; ссылка должна быть актуальна вплоть до оглашения результатов.',
    'В кадре чётко видны руки, ноги и лицо исполнителя - в соответствии с номинацией.',
    'Для ИЗО и фото: чёткое фото или скан под прямым углом, при хорошем освещении, без бликов, теней и фотофильтров - в кадре только само полотно.',
];
$platformsOk = ['RuTube','ВК Видео','ОК Видео','Дзен Видео','Яндекс Диск','Google Диск'];
$platformsNo = ['YouTube','Instagram','Facebook (Meta - экстремистская в РФ)','TikTok','Иностранные мессенджеры'];
$extraDiplomas = ['За патриотизм','За лучший образ','Лучший коллектив','Лучший дуэт','За артистизм','За лучшее исполнение','За лучшую постановку','За оригинальное исполнение'];

/* Состав жюри (по официальному положению, п.6). */
$juryIntro = [
    'Председатель жюри' => 'Народный или заслуженный артист, видный деятель искусств, ректор или профессор ведущего профильного вуза.',
    'Почётные члены жюри' => 'Представители министерств и ведомств культуры, директора международных фестивалей, международные арт-менеджеры и продюсеры.',
];
$juryPanels = [
    'Вокальное искусство' => ['профессора и доценты кафедр вокала консерваторий и институтов культуры','действующие солисты оперных театров и филармоний','известные эстрадные и джазовые исполнители','хормейстеры, дирижёры, музыкальные продюсеры'],
    'Хореографическое искусство' => ['главные балетмейстеры и постановщики театров танца и балета','заслуженные артисты балета','ведущие педагоги-хореографы академий и институтов культуры','руководители известных ансамблей народного танца'],
    'Инструментальное исполнительство' => ['солисты-виртуозы филармоний и концертных объединений','дирижёры симфонических, камерных и духовых оркестров','профессора и преподаватели по классу инструментов','руководители ансамблей народных инструментов'],
    'Театр и художественное слово' => ['театральные режиссёры-постановщики','заслуженные и народные артисты театра и кино','педагоги по сценической речи и актёрскому мастерству','театральные критики и драматурги'],
    'ИЗО, ДПИ и фотоискусство' => ['члены национальных и международных Союзов художников','профессора художественных академий, искусствоведы и кураторы','профессиональные фотографы, члены международных фотосоюзов (FIAP)','фоторедакторы крупных изданий и медиа-агентств'],
    'Видеоискусство и клипмейкинг' => ['режиссёры кино и телевидения, режиссёры клипов','кинооператоры-постановщики (DOP), режиссёры монтажа','преподаватели институтов кинематографии','кинокритики, киноведы и продюсеры медиапроектов'],
    'Цирковое искусство' => ['заслуженные артисты-акробаты и воздушные гимнасты','виртуозы-эквилибристы, мастера жонглирования','известные клоуны, режиссёры пантомимы','профессиональные иллюзионисты, династийные дрессировщики'],
];

$chev = '<span class="chev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></span>';

/* Обложка для баннера: тот же нормализатор хоста, что и в каталоге (competitions.php) -
   снимаем dev-хост localhost/127.0.0.1, чтобы постер грузился с текущего домена. */
$coverBg = trim((string) ($c['cover'] ?? ''));
if ($coverBg !== '') $coverBg = preg_replace('~^https?://(?:localhost|127\.0\.0\.1)(?::\d+)?~i', '', $coverBg);

ob_start(); ?>
<section class="comp-banner">
  <div class="comp-banner__bg" style="view-transition-name:comp-cover-<?= (int)$c['id'] ?><?= $coverBg !== '' ? ';background-image:url(\'' . h($coverBg) . '\')' : '' ?>"></div>
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
      <button class="btn btn--ghost btn--lg" type="button" data-share data-share-title="<?= h($c['name']) ?>" data-share-url="<?= h(url('/competition/' . $c['slug'])) ?>"><?= $ic['share'] ?> Поделиться</button>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">

    <!-- Ключевые факты — инфографика -->
    <div class="comp-info reveal">
      <div class="comp-info__item">
        <span class="comp-info__ic"><?= $ic['globe'] ?></span>
        <div><b>Тип конкурса</b><span><?= h($typeShort) ?>, многожанровый</span></div>
      </div>
      <div class="comp-info__item">
        <span class="comp-info__ic"><?= $ic['wallet'] ?></span>
        <div><b>Участие</b><span><?= $c['is_paid'] ? h(money((int)$c['price'])) . ' за заявку' : 'Бесплатно' ?></span></div>
      </div>
      <div class="comp-info__item">
        <span class="comp-info__ic"><?= $ic['cal'] ?></span>
        <div><b>Приём заявок</b><span><?= $dateRange !== '' ? h($dateRange) : 'Уточняется в положении' ?></span></div>
      </div>
      <div class="comp-info__item">
        <span class="comp-info__ic"><?= $ic['star'] ?></span>
        <div><b>Тематика</b><span><?= h($thematics) ?></span></div>
      </div>
      <div class="comp-info__item">
        <span class="comp-info__ic"><?= $ic['flag'] ?></span>
        <div><b>Срок аттестации</b><span><?= !empty($c['results_date']) ? h(ru_date($c['results_date'])) : 'В течение 5 рабочих дней' ?></span></div>
      </div>
      <div class="comp-info__item">
        <span class="comp-info__ic"><?= $ic['list'] ?></span>
        <div><b>Программа</b><span><?= count($noms) ?> номинаций · <?= count($ages) ?> категорий</span></div>
      </div>
    </div>

    <!-- Мини-статистика (счётчики) -->
    <div class="comp-stats reveal">
      <div class="comp-stat"><b data-count="<?= count($noms) ?>">0</b><span>Номинаций</span></div>
      <div class="comp-stat"><b data-count="<?= count($ages) ?>">0</b><span>Возрастных категорий</span></div>
      <div class="comp-stat"><b data-count="<?= count($extraDiplomas) ?>">0</b><span>Доп. дипломов</span></div>
      <div class="comp-stat">
        <div class="stat-ring" data-value="100" aria-hidden="true">
          <svg viewBox="0 0 120 120"><circle class="ring-track" cx="60" cy="60" r="52"/><circle class="ring-fill" cx="60" cy="60" r="52" transform="rotate(-90 60 60)"/></svg>
          <span class="stat-ring__num">10</span>
        </div>
        <span>Балльная шкала оценки</span>
      </div>
    </div>

    <!-- Вкладки -->
    <div class="comp-tabs reveal" id="compTabs">
      <div class="comp-tabs__nav" role="tablist">
        <button class="comp-tab is-active" role="tab" aria-selected="true" data-tab="about">О конкурсе</button>
        <button class="comp-tab" role="tab" aria-selected="false" data-tab="program">Программа</button>
        <button class="comp-tab" role="tab" aria-selected="false" data-tab="material">Требования к материалу</button>
        <button class="comp-tab" role="tab" aria-selected="false" data-tab="criteria">Оценка и критерии</button>
        <button class="comp-tab" role="tab" aria-selected="false" data-tab="participation">Участие и награды</button>
        <button class="comp-tab" role="tab" aria-selected="false" data-tab="jury">Жюри</button>
        <button class="comp-tab" role="tab" aria-selected="false" data-tab="results">Результаты</button>
      </div>

      <!-- О конкурсе -->
      <div class="comp-panel is-active" data-panel="about">
        <p><?= nl2br(h(normalize_text($about))) ?></p>
        <h3 style="margin-top:26px">Цели и задачи</h3>
        <ul class="comp-goals">
          <?php foreach ($goals as $g): ?>
            <li><span class="comp-goals__ic"><?= $ic['check'] ?></span><?= h($g) ?></li>
          <?php endforeach; ?>
        </ul>
        <div class="comp-callout">
          <span class="comp-callout__ic"><?= $ic['globe'] ?></span>
          <p>Формат конкурса - дистанционный. Работы принимаются по видеозаписи, итоги подводит компетентное жюри, наградные документы направляются на электронную почту участника.</p>
        </div>
      </div>

      <!-- Программа: номинации, возрастные категории, формы -->
      <div class="comp-panel" data-panel="program">
        <h3>Номинации <span class="comp-count"><?= count($noms) ?></span></h3>
        <p>Конкурс проходит по следующим номинациям. Раскройте направление, чтобы увидеть жанры внутри него.</p>
        <?php foreach ($noms as $n): $subs = $nomMap[$n] ?? []; ?>
          <div class="acc-item">
            <button class="acc-q" type="button" aria-expanded="false"><span><?= h($n) ?></span><?= $chev ?></button>
            <div class="acc-a">
              <?php if ($subs): ?>
                <div class="comp-chips" style="margin-top:14px">
                  <?php foreach ($subs as $s): ?><span class="comp-chip"><?= h($s) ?></span><?php endforeach; ?>
                </div>
              <?php else: ?>
                <p style="margin:14px 0 0">Направление указывается участником в заявке.</p>
              <?php endif; ?>
            </div>
          </div>
        <?php endforeach; ?>

        <h3 style="margin-top:30px">Возрастные категории <span class="comp-count"><?= count($ages) ?></span></h3>
        <div class="comp-chips">
          <?php foreach ($ages as $a): ?><span class="comp-chip"><?= h($a) ?></span><?php endforeach; ?>
        </div>

        <h3 style="margin-top:30px">Формы исполнения</h3>
        <div class="comp-chips">
          <?php foreach ($forms as $f): ?><span class="comp-chip"><?= h($f) ?></span><?php endforeach; ?>
        </div>
        <p class="comp-note">Без ограничений по времени номера, языку исполнения, количеству участников и месту нахождения. 1 заявка = 1 конкурсный номер.</p>
      </div>

      <!-- Требования к материалу -->
      <div class="comp-panel" data-panel="material">
        <div class="comp-callout">
          <span class="comp-callout__ic"><?= $ic['video'] ?></span>
          <p>Видео снимается на статичную камеру или мобильный телефон, на сцене или в домашних условиях. Главное - «живое» исполнение без монтажа.</p>
        </div>
        <ul class="comp-reqs">
          <?php foreach ($materialReq as $r): ?>
            <li><span class="comp-reqs__ic"><?= $ic['check'] ?></span><?= h($r) ?></li>
          <?php endforeach; ?>
        </ul>

        <h3 style="margin-top:28px">Где размещать видео</h3>
        <div class="comp-platforms">
          <div class="comp-plat comp-plat--ok">
            <div class="comp-plat__head"><?= $ic['check'] ?> Разрешённые площадки</div>
            <div class="comp-chips">
              <?php foreach ($platformsOk as $p): ?><span class="comp-chip comp-chip--ok"><?= h($p) ?></span><?php endforeach; ?>
            </div>
          </div>
          <div class="comp-plat comp-plat--no">
            <div class="comp-plat__head"><?= $ic['ban'] ?> Запрещённые площадки</div>
            <div class="comp-chips">
              <?php foreach ($platformsNo as $p): ?><span class="comp-chip comp-chip--no"><?= h($p) ?></span><?php endforeach; ?>
            </div>
          </div>
        </div>
        <p class="comp-note">Ссылка на конкурсный материал должна оставаться доступной вплоть до оглашения результатов.</p>
      </div>

      <!-- Оценка и критерии -->
      <div class="comp-panel" data-panel="criteria">
        <p>Конкурсные работы оценивает компетентное жюри по 10-балльной шкале. Итоговый балл определяет присуждаемое звание.</p>

        <h3 style="margin-top:22px"><span class="comp-h3ic"><?= $ic['scale'] ?></span>Система оценивания и звания</h3>
        <div class="comp-grades">
          <?php foreach (GRADE_SCALE() as [$lo, $hi, $title]): $pct = (int)round($hi / 10 * 100); ?>
            <div class="grade-row">
              <span class="grade-row__title"><?= h($title) ?></span>
              <div class="bar" data-value="<?= $pct ?>"><span class="bar-fill"></span></div>
              <span class="grade-row__num"><?= (int)$lo ?>–<?= (int)$hi ?></span>
            </div>
          <?php endforeach; ?>
        </div>
        <p class="comp-note">Жюри вправе присуждать и не присуждать звания «Гран-при», «Лауреат», «Дипломант», «Участник». Решения жюри окончательны и пересмотру не подлежат.</p>

        <h3 style="margin-top:30px">Критерии оценки</h3>
        <div class="acc-item">
          <button class="acc-q" type="button" aria-expanded="false"><span>Общие критерии оценки</span><?= $chev ?></button>
          <div class="acc-a"><ul class="comp-ul">
            <?php foreach ($generalCriteria as $g): ?><li><?= h($g) ?></li><?php endforeach; ?>
          </ul></div>
        </div>
        <?php foreach ($nominationCriteria as $nomName => $items): ?>
          <div class="acc-item">
            <button class="acc-q" type="button" aria-expanded="false"><span><?= h($nomName) ?></span><?= $chev ?></button>
            <div class="acc-a"><ul class="comp-ul">
              <?php foreach ($items as $it): ?><li><?= h($it) ?></li><?php endforeach; ?>
            </ul></div>
          </div>
        <?php endforeach; ?>

        <h3 style="margin-top:30px"><span class="comp-h3ic"><?= $ic['medal'] ?></span>Дополнительные наградные дипломы <span class="comp-count"><?= count($extraDiplomas) ?></span></h3>
        <p>Сверх основного звания жюри вправе присуждать дополнительные дипломы:</p>
        <div class="comp-chips">
          <?php foreach ($extraDiplomas as $d): ?><span class="comp-chip"><?= h($d) ?></span><?php endforeach; ?>
        </div>
      </div>

      <!-- Участие и награды -->
      <div class="comp-panel" data-panel="participation">
        <?php if ($c['is_paid']): ?>
          <h3><span class="comp-h3ic"><?= $ic['wallet'] ?></span>Финансовые условия</h3>
          <p>Организационный взнос - <b style="color:var(--gold)"><?= h(money((int)$c['price'])) ?></b> за заявку. В стоимость участия входит:</p>
          <ul class="comp-ul">
            <li>приём, сортировка и регистрация заявки;</li>
            <li>отправка конкурсного номера на аттестацию компетентному жюри;</li>
            <li>аттестация конкурсного номера;</li>
            <li>рассылка и (или) публикация аттестационных результатов;</li>
            <li>изготовление и рассылка основного электронного диплома (и дополнительного при наличии) на электронную почту в течение 5 рабочих дней.</li>
          </ul>
          <div class="comp-callout">
            <span class="comp-callout__ic"><?= $ic['award'] ?></span>
            <p>Дополнительный наградной материал (кубок, статуэтка, медаль, благодарственное письмо, именные дипломы) оформляется по желанию после оглашения результатов. Доставка оплачивается отдельно при получении (наложенный платёж). Оргвзнос за аттестованный материал возврату не подлежит.</p>
          </div>
        <?php else: ?>
          <h3><span class="comp-h3ic"><?= $ic['check'] ?></span>Что входит в бесплатное участие</h3>
          <p>Участие в конкурсе бесплатное. В бесплатное участие входит:</p>
          <ul class="comp-ul">
            <li>приём, сортировка и регистрация заявки;</li>
            <li>отправка конкурсного номера на аттестацию компетентному жюри;</li>
            <li>аттестация конкурсного номера;</li>
            <li>рассылка и (или) публикация аттестационных результатов.</li>
          </ul>
          <div class="comp-callout">
            <span class="comp-callout__ic"><?= $ic['award'] ?></span>
            <p>Аттестационные результаты публикуются на официальной странице сообщества <a href="<?= h(cfgv('org_vk')) ?>" target="_blank" rel="noopener">ВКонтакте</a>. Наградной материал (диплом с печатью, кубки, медали, доставка) оформляется отдельно по желанию - доставка оплачивается при получении наложенным платежом.</p>
          </div>
        <?php endif; ?>

        <h3 style="margin-top:30px"><span class="comp-h3ic"><?= $ic['award'] ?></span>Наградной материал и образцы</h3>
        <p>По итогам конкурса участники получают наградные документы в электронном виде. Оригиналы дипломов, кубки, медали и статуэтки можно заказать дополнительно.</p>
        <?php if ($awards): ?>
          <div class="scroll-x">
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

      <!-- Жюри -->
      <div class="comp-panel" data-panel="jury">
        <p>Чтобы конкурс имел высокий, в том числе международный статус, в состав жюри входят эксперты из разных стран (минимум 3-4 страны) с педагогическим стажем не менее 10 лет и без конфликта интересов.</p>
        <div class="comp-jury-lead">
          <?php foreach ($juryIntro as $role => $desc): ?>
            <div class="card comp-jury-card">
              <div class="comp-jury-card__ic"><?= $ic['gavel'] ?></div>
              <b><?= h($role) ?></b>
              <span><?= h($desc) ?></span>
            </div>
          <?php endforeach; ?>
        </div>
        <h3 style="margin-top:26px">Эксперты по направлениям</h3>
        <?php foreach ($juryPanels as $panel => $items): ?>
          <div class="acc-item">
            <button class="acc-q" type="button" aria-expanded="false"><span><?= h($panel) ?></span><?= $chev ?></button>
            <div class="acc-a"><ul class="comp-ul">
              <?php foreach ($items as $it): ?><li><?= h($it) ?></li><?php endforeach; ?>
            </ul></div>
          </div>
        <?php endforeach; ?>
        <p class="comp-note">Персональные данные членов жюри и протоколы аттестации не публикуются и третьим лицам не передаются (ФЗ №149-ФЗ, №152-ФЗ).</p>
      </div>

      <!-- Результаты -->
      <div class="comp-panel" data-panel="results">
        <?php if ($results): ?>
          <p>Итоги конкурса. Наградные документы направлены на электронную почту участников.</p>

          <?php if ($hasPodium): ?>
            <?php
              $podiumGroups = [];
              if ($podium['gp'])  $podiumGroups[] = ['gp',  'crown', 'Гран-при', $podium['gp']];
              if ($podium['lau']) $podiumGroups[] = ['lau', 'medal', 'Лауреаты', $podium['lau']];
            ?>
            <div class="comp-podium">
              <?php foreach ($podiumGroups as [$tone, $icoKey, $groupTitle, $rows]): ?>
                <div class="comp-podium__group">
                  <h3 class="comp-podium__head"><span class="comp-h3ic"><?= $ic[$icoKey] ?></span><?= h($groupTitle) ?> <span class="comp-count"><?= count($rows) ?></span></h3>
                  <div class="comp-podium__grid">
                    <?php foreach ($rows as $r): ?>
                      <div class="pwin pwin--<?= $tone ?>">
                        <span class="pwin__badge"><?= h($r['result']) ?></span>
                        <b class="pwin__name"><?= h($r['is_group'] && $r['group_name'] !== '' ? $r['group_name'] : $r['full_name']) ?></b>
                        <?php if (!empty($r['work_title'])): ?><span class="pwin__work"><?= h($r['work_title']) ?></span><?php endif; ?>
                        <?php if (!empty($r['nomination'])): ?><span class="pwin__nom"><?= h($r['nomination']) ?></span><?php endif; ?>
                      </div>
                    <?php endforeach; ?>
                  </div>
                </div>
              <?php endforeach; ?>
            </div>
            <h3 class="comp-podium__all">Все участники</h3>
          <?php endif; ?>

          <div class="scroll-x">
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
.comp-banner{position:relative;background:var(--grad-gold);color:var(--gold-fg);overflow:hidden;padding:64px 0}
/* Постер конкурса как атмосферная фактура: лёгкий blur+scale, чтобы «зашитый» в афишу
   текст не дублировал H1, а работал фоном. Оверлей держит контраст заголовка. */
.comp-banner__bg{position:absolute;inset:0;background-size:cover;background-position:center;opacity:.42;
  filter:blur(22px) saturate(1.15);transform:scale(1.25)}
.comp-banner::after{content:"";position:absolute;inset:0;
  background:linear-gradient(180deg,rgba(20,14,3,.34) 0,rgba(20,14,3,.46) 55%,rgba(20,14,3,.66) 100%)}
.comp-banner__inner{position:relative;z-index:1;max-width:820px}
.comp-banner__badges{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
.comp-banner__inner h1{color:#fff;margin-bottom:.3em}
.comp-banner__lead{font-size:1.12rem;color:rgba(255,255,255,.92);max-width:640px;margin-bottom:24px}
.comp-banner__cta{display:flex;flex-wrap:wrap;gap:14px}
.comp-banner .badge--intl{background:rgba(255,252,245,.94);color:var(--gold-fg)}
.comp-banner .badge--open{background:color-mix(in srgb,var(--mint) 92%,white);color:#173a1e}
.comp-banner .badge--closed{background:rgba(255,252,245,.9);color:#8a2e2e}

/* Ключевые факты */
.comp-info{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-bottom:26px}
.comp-info__item{display:flex;gap:14px;align-items:flex-start;background:var(--panel);border:1px solid var(--glass-brd);
  border-radius:var(--radius);padding:18px 20px;box-shadow:var(--shadow-card);backdrop-filter:blur(12px)}
.comp-info__ic{flex:0 0 auto;width:46px;height:46px;border-radius:12px;background:var(--gold-soft);
  display:flex;align-items:center;justify-content:center;color:var(--gold)}
.comp-info__ic svg{width:24px;height:24px}
.comp-info__item b{display:block;font-family:var(--ff-serif);color:var(--text);font-size:1.05rem;line-height:1.2}
.comp-info__item span{color:var(--muted);font-size:.9rem}

/* Мини-статистика */
.comp-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:44px}
.comp-stat{text-align:center;padding:22px 12px;border-radius:var(--radius-sm);background:var(--panel);
  border:1px solid var(--glass-brd);box-shadow:var(--shadow-card);backdrop-filter:blur(10px)}
.comp-stat b{display:block;font-family:var(--ff-display);font-size:clamp(2rem,5vw,3rem);line-height:1;
  background:var(--grad-gold);-webkit-background-clip:text;background-clip:text;color:transparent}
.comp-stat span{display:block;margin-top:8px;color:var(--muted);font-size:.86rem}
.stat-ring{position:relative;width:96px;height:96px;margin:0 auto}
.stat-ring svg{width:100%;height:100%;transform:rotate(0)}
.stat-ring .ring-track{fill:none;stroke:var(--gold-soft);stroke-width:9}
.stat-ring .ring-fill{fill:none;stroke:var(--gold);stroke-width:9;stroke-linecap:round}
.stat-ring__num{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
  font-family:var(--ff-display);font-size:2rem;color:var(--text)}

/* Вкладки */
.comp-tabs__nav{display:flex;gap:6px;border-bottom:1px solid var(--line);margin-bottom:28px;overflow-x:auto;
  -webkit-overflow-scrolling:touch;scrollbar-width:none}
.comp-tabs__nav::-webkit-scrollbar{display:none}
.comp-tab{background:none;border:none;padding:14px clamp(13px,1.35vw,20px);font-family:var(--ff-body);font-weight:700;font-size:1rem;
  color:var(--muted);cursor:pointer;border-bottom:3px solid transparent;margin-bottom:-1px;white-space:nowrap;
  transition:color .18s,border-color .18s}
.comp-tab:hover{color:var(--gold)}
.comp-tab.is-active{color:var(--text);border-bottom-color:var(--gold)}
.comp-panel{display:none;animation:fadeUp .35s ease}
.comp-panel.is-active{display:block}
.comp-panel p{color:var(--text-dim)}
.comp-panel h3{margin-bottom:10px;display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.comp-h3ic{width:26px;height:26px;color:var(--gold);flex:0 0 auto}
.comp-h3ic svg{width:26px;height:26px}
.comp-count{display:inline-flex;align-items:center;justify-content:center;min-width:26px;height:26px;padding:0 8px;
  border-radius:999px;background:var(--gold-soft);border:1px solid var(--glass-brd);color:var(--gold);
  font-family:var(--ff-body);font-size:.82rem;font-weight:800}
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}

/* Чипы */
.comp-chips{display:flex;flex-wrap:wrap;gap:9px;margin-top:6px}
.comp-chip{display:inline-block;padding:7px 15px;border-radius:999px;background:var(--gold-soft);
  border:1px solid var(--glass-brd);color:var(--gold);font-size:.9rem;font-weight:600}
.comp-chip--ok{background:color-mix(in srgb,var(--mint) 16%,transparent);border-color:color-mix(in srgb,var(--mint) 40%,transparent);color:var(--mint)}
.comp-chip--no{background:rgba(200,87,87,.12);border-color:rgba(200,87,87,.35);color:#c85757}
.comp-note{margin-top:16px;padding:12px 16px;border-left:3px solid var(--gold);background:var(--gold-soft);
  border-radius:0 var(--radius-sm) var(--radius-sm) 0;color:var(--text-dim);font-size:.92rem}

/* Списки */
.comp-ul{padding-left:20px;margin:14px 0 0}
.comp-ul li{margin-bottom:8px;color:var(--text-dim)}
.comp-goals,.comp-reqs{list-style:none;padding:0;margin:14px 0 0;display:grid;gap:12px}
.comp-goals li,.comp-reqs li{display:flex;gap:12px;align-items:flex-start;color:var(--text-dim)}
.comp-goals__ic,.comp-reqs__ic{flex:0 0 auto;width:26px;height:26px;border-radius:8px;background:var(--gold-soft);
  color:var(--gold);display:flex;align-items:center;justify-content:center}
.comp-goals__ic svg,.comp-reqs__ic svg{width:16px;height:16px}

/* Callout */
.comp-callout{display:flex;gap:14px;align-items:flex-start;margin-top:20px;padding:18px 20px;border-radius:var(--radius-sm);
  background:var(--panel);border:1px solid var(--glass-brd);box-shadow:var(--shadow-card);backdrop-filter:blur(10px)}
.comp-callout__ic{flex:0 0 auto;width:40px;height:40px;border-radius:11px;background:var(--gold-soft);color:var(--gold);
  display:flex;align-items:center;justify-content:center}
.comp-callout__ic svg{width:22px;height:22px}
.comp-callout p{margin:0;color:var(--text-dim)}

/* Площадки */
.comp-platforms{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:12px}
.comp-plat{padding:16px 18px;border-radius:var(--radius-sm);background:var(--panel);border:1px solid var(--glass-brd);backdrop-filter:blur(10px)}
.comp-plat__head{display:flex;align-items:center;gap:8px;font-weight:700;color:var(--text);margin-bottom:10px}
.comp-plat__head svg{width:20px;height:20px}
.comp-plat--ok .comp-plat__head svg{color:var(--mint)}
.comp-plat--no .comp-plat__head svg{color:#c85757}

/* Оценивание — полосы */
.comp-grades{display:grid;gap:12px;margin-top:14px}
.grade-row{display:grid;grid-template-columns:180px 1fr 56px;align-items:center;gap:14px}
.grade-row__title{font-weight:700;color:var(--text);font-size:.92rem}
.grade-row__num{text-align:right;color:var(--muted);font-size:.9rem;font-variant-numeric:tabular-nums}
.bar{position:relative;height:14px;border-radius:999px;background:var(--gold-soft);border:1px solid var(--glass-brd);overflow:hidden}
.bar-fill{display:block;height:100%;width:100%;border-radius:999px;background:var(--grad-gold);
  transform:scaleX(0);transform-origin:left center;transition:transform 1.1s cubic-bezier(.2,.8,.2,1)}

/* Жюри */
.comp-jury-lead{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}
.comp-jury-card{display:flex;flex-direction:column;gap:8px}
.comp-jury-card__ic{width:44px;height:44px;border-radius:12px;background:var(--gold-soft);color:var(--gold);
  display:flex;align-items:center;justify-content:center}
.comp-jury-card__ic svg{width:24px;height:24px}
.comp-jury-card b{font-family:var(--ff-serif);color:var(--text);font-size:1.1rem}
.comp-jury-card span{color:var(--text-dim);font-size:.92rem}

/* Таблицы */
.scroll-x{overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:var(--radius-sm)}
.comp-table{width:100%;border-collapse:collapse;min-width:480px}
.comp-table th,.comp-table td{text-align:left;padding:13px 16px;border-bottom:1px solid var(--line);vertical-align:top;color:var(--text)}
.comp-table th{font-family:var(--ff-body);font-size:.82rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.comp-table tbody tr:hover{background:var(--gold-soft)}

/* Аккордеон: снять глобальный лимит высоты для длинного контента */
.comp-tabs .acc-q{width:100%;background:none;border:none;text-align:left;font-family:var(--ff-body);font-size:1rem}
.comp-tabs .acc-item.open .acc-a{max-height:1400px}

/* Финал */
.comp-final{margin-top:48px;text-align:center;background:var(--panel);border:1px solid var(--glass-brd);
  border-radius:var(--radius);padding:44px 24px;box-shadow:var(--shadow-card);backdrop-filter:blur(12px)}
.comp-final h2{background:var(--grad-gold);-webkit-background-clip:text;background-clip:text;color:transparent;display:inline-block}
.comp-final p{color:var(--text-dim);max-width:520px;margin:0 auto 22px}

/* Пьедестал победителей — читаемо, отдельно от плоской таблицы */
.comp-podium{display:grid;gap:26px;margin:20px 0 8px}
.comp-podium__head{margin-bottom:14px}
.comp-podium__grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}
.comp-podium__all{margin:30px 0 12px;color:var(--text)}
.pwin{position:relative;display:flex;flex-direction:column;gap:6px;padding:18px 20px;border-radius:var(--radius-sm);
  background:var(--panel);border:1px solid var(--glass-brd);box-shadow:var(--shadow-card);backdrop-filter:blur(10px);
  transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s}
.pwin::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:var(--radius-sm) 0 0 var(--radius-sm);
  background:var(--gold-2);opacity:.55}
.pwin--gp{background:radial-gradient(150% 100% at 100% 0,var(--gold-soft),transparent 55%),var(--panel)}
.pwin--gp::before{width:4px;background:var(--grad-gold);opacity:.95}
.pwin__badge{display:inline-flex;align-self:flex-start;align-items:center;font-family:var(--ff-body);font-weight:800;
  font-size:.74rem;letter-spacing:.04em;text-transform:uppercase;padding:5px 12px;border-radius:999px;
  color:var(--gold-ink);background:var(--gold-soft);border:1px solid var(--glass-brd)}
.pwin--gp .pwin__badge{color:var(--gold-fg);background:var(--grad-gold);border-color:transparent}
[data-theme="dark"] .pwin__badge{color:var(--gold)}
[data-theme="dark"] .pwin--gp .pwin__badge{color:var(--gold-fg)}
.pwin__name{font-family:var(--ff-serif);color:var(--text);font-size:1.06rem;line-height:1.2;overflow-wrap:anywhere}
.pwin__work{color:var(--muted);font-size:.88rem;overflow-wrap:anywhere}
.pwin__nom{margin-top:2px;color:var(--text-dim);font-size:.82rem}
@media (hover:hover){.pwin:hover{transform:translateY(-3px);box-shadow:var(--shadow-3d,var(--shadow-card))}}

/* Моушен-микро: мягкий подъём инфо-карточек и чипов на hover */
@media (hover:hover){
  .comp-info__item{transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s}
  .comp-info__item:hover{transform:translateY(-2px);box-shadow:var(--shadow-3d,var(--shadow-card))}
  .comp-chip{transition:transform .2s ease}
  .comp-chip:hover{transform:translateY(-1px)}
  .comp-banner__cta [data-share]{transition:transform .2s ease}
  .comp-banner__cta [data-share]:active{transform:scale(.97)}
}

@media (prefers-reduced-motion:reduce){
  .comp-panel{animation:none}
  .bar-fill{transition:none}
  .pwin,.comp-info__item,.comp-chip,.comp-banner__cta [data-share]{transition:none}
  .pwin:hover,.comp-info__item:hover,.comp-chip:hover{transform:none}
  .comp-banner__bg{view-transition-name:none!important}
}

@media (max-width:960px){
  .comp-info{grid-template-columns:repeat(2,1fr)}
  .comp-stats{grid-template-columns:repeat(2,1fr)}
}
@media (max-width:640px){
  .comp-banner{padding:44px 0}
  .comp-info{grid-template-columns:1fr}
  .comp-platforms{grid-template-columns:1fr}
  .comp-jury-lead{grid-template-columns:1fr}
  .grade-row{grid-template-columns:1fr;gap:6px}
  .grade-row__num{text-align:left}
  .comp-tab{padding:12px 15px;font-size:.94rem}
}
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

/* --- SEO: schema.org разметка конкурса (EducationEvent) + хлебные крошки --- */
$compUrl  = url('/competitions/' . rawurlencode($c['slug']));
$ldDesc   = $metaBase !== '' ? $metaBase : ($typeLabel . ' «' . $c['name'] . '» - КЦ «Музыкальный Мир».');
$ldPrice  = $c['is_paid'] ? (int) $c['price'] : 0;

$event_ld = [
    '@context'             => 'https://schema.org',
    '@type'                => 'EducationEvent',
    'name'                 => $c['name'],
    'description'          => $ldDesc,
    'url'                  => $compUrl,
    'eventAttendanceMode'  => 'https://schema.org/OnlineEventAttendanceMode',
    'eventStatus'          => 'https://schema.org/EventScheduled',
    'location'             => [
        '@type' => 'VirtualLocation',
        'url'   => $compUrl,
    ],
    'organizer'            => [
        '@type' => 'Organization',
        'name'  => cfgv('org_name'),
        'url'   => rtrim(cfgv('base_url'), '/') . '/',
    ],
    'offers'               => [
        '@type'         => 'Offer',
        'price'         => $ldPrice,
        'priceCurrency' => 'RUB',
        'availability'  => $isOpen ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
        'url'           => $isOpen ? $applyUrl : $compUrl,
    ],
];
if (!empty($c['start_date'])) $event_ld['startDate'] = $c['start_date'];
if (!empty($c['end_date']))   $event_ld['endDate']   = $c['end_date'];
if (!empty($c['cover']))      $event_ld['image']     = $c['cover'];
if (!empty($c['start_date'])) $event_ld['offers']['validFrom'] = $c['start_date'];

$breadcrumb_ld = [
    '@context'        => 'https://schema.org',
    '@type'           => 'BreadcrumbList',
    'itemListElement' => [
        ['@type' => 'ListItem', 'position' => 1, 'name' => 'Главная',  'item' => url('/')],
        ['@type' => 'ListItem', 'position' => 2, 'name' => 'Конкурсы', 'item' => url('/competitions')],
        ['@type' => 'ListItem', 'position' => 3, 'name' => $c['name'], 'item' => $compUrl],
    ],
];

render_page($c['name'], $content, [
    'active'   => '/competitions',
    'meta'     => $metaBase !== '' ? $metaBase : ($typeLabel . ' «' . $c['name'] . '» - КЦ «Музыкальный Мир». Подача заявки онлайн, номинации, возрастные категории, наградные документы.'),
    'og_image' => !empty($c['cover']) ? $c['cover'] : asset('img/logo_muzmir_main.png'),
    'jsonld'   => [$event_ld, $breadcrumb_ld],
]);
