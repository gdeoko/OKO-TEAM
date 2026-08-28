<?php
/**
 * Публичная страница результатов конкурса (живёт годами - не удаляется после завершения).
 * Переменная $slug задана роутером и равна slug конкурса (competitions.slug).
 * Публикуется только для завершённых конкурсов (status = closed|finished).
 */
$slug = trim((string) ($slug ?? ''));

$slugify = function (string $s): string {
    $s = mb_strtolower(trim($s));
    $map = ['а'=>'a','б'=>'b','в'=>'v','г'=>'g','д'=>'d','е'=>'e','ё'=>'e','ж'=>'zh','з'=>'z','и'=>'i',
            'й'=>'y','к'=>'k','л'=>'l','м'=>'m','н'=>'n','о'=>'o','п'=>'p','р'=>'r','с'=>'s','т'=>'t',
            'у'=>'u','ф'=>'f','х'=>'h','ц'=>'ts','ч'=>'ch','ш'=>'sh','щ'=>'sch','ъ'=>'','ы'=>'y','ь'=>'',
            'э'=>'e','ю'=>'yu','я'=>'ya',' '=>'-'];
    $s = strtr($s, $map);
    $s = preg_replace('/[^a-z0-9\-]/', '', $s);
    $s = preg_replace('/-{2,}/', '-', $s);
    return trim($s, '-');
};

$c = one("SELECT * FROM competitions WHERE slug = ?", [$slug]);

if (!$c) {
    http_response_code(404);
    ob_start(); ?>
    <section class="section">
      <div class="container" style="text-align:center;max-width:640px">
        <p class="eyebrow">Ошибка 404</p>
        <h1>Конкурс не найден</h1>
        <p style="color:var(--muted)">Проверьте ссылку или посмотрите <a href="<?= url('/competitions') ?>">все конкурсы</a>.</p>
        <div style="margin-top:24px"><a class="btn btn--primary" href="<?= url('/competitions') ?>">К каталогу конкурсов</a></div>
      </div>
    </section>
    <?php
    $content = ob_get_clean();
    render_page('Конкурс не найден', $content, ['active' => '/competitions', 'meta' => 'Конкурс не найден.']);
    return;
}

$typeLabel = $c['type'] === 'international' ? 'Международный конкурс' : 'Всероссийский конкурс';
$isFinished = in_array($c['status'], ['closed', 'finished'], true);

/* --- Конкурс ещё не завершён: результатов пока нет, но страница уже доступна и не 404. --- */
if (!$isFinished) {
    ob_start(); ?>
    <section class="section">
      <div class="container" style="text-align:center;max-width:640px">
        <p class="eyebrow"><?= h($typeLabel) ?></p>
        <h1><?= h($c['name']) ?></h1>
        <?php $rd = trim((string)($c['results_date'] ?? '')); ?>
        <?php if ($rd !== ''): ?>
          <p style="color:var(--muted);margin-top:14px">Результаты конкурса будут опубликованы <b><?= h(ru_date($rd)) ?></b>.
             Список аттестационных результатов появится на этой странице в день публикации.</p>
        <?php else: ?>
          <?php /* Без назначенной даты итоги не «когда-нибудь», а в названный срок:
                    работа аттестуется в течение 5 рабочих дней, и участник должен
                    видеть именно срок, а не расплывчатое «после завершения». */ ?>
          <p style="color:var(--muted);margin-top:14px">Результаты этого конкурса ещё не опубликованы: приём заявок или оценка жюри продолжается.
             Итоги подводятся в течение 5 рабочих дней и приходят на почту, указанную в заявке.</p>
        <?php endif; ?>
        <div style="margin-top:26px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
          <a class="btn btn--primary" href="<?= url('/competition/' . $c['slug']) ?>">О конкурсе</a>
          <a class="btn btn--ghost" href="<?= url('/competitions') ?>">Все конкурсы</a>
        </div>
      </div>
    </section>
    <?php
    $content = ob_get_clean();
    render_page('Результаты - ' . $c['name'], $content, [
        'active' => '/competitions',
        'meta'   => 'Результаты конкурса «' . $c['name'] . '» будут опубликованы после его завершения.',
    ]);
    return;
}

/* --- Аттестационные результаты: только те, что уже раскрыты участникам. ---
   Отбор шёл по status IN ('graded','sent'), то есть по факту работы жюри. Из-за
   этого страница могла показать звание раньше, чем участник получил письмо, а по
   длинному конкурсу — раньше общего оглашения. Условие app_result_public_sql()
   одинаково для сайта, кабинета и чат-бота. */
require_once BASE_PATH . '/core/app_status.php';
$results = all(
    "SELECT a.id AS app_id, a.user_id, a.full_name, a.group_name, a.is_group, a.city, a.institution, a.teacher,
            a.nomination, a.age_category, a.work_title, a.result, a.extra_diploma, a.score, a.video_url, a.video_platform,
            d.number AS diploma_number
     FROM applications a
     LEFT JOIN diplomas d ON d.application_id = a.id
     LEFT JOIN competitions c ON c.id = a.competition_id
     WHERE a.competition_id = ? AND " . app_result_public_sql('a', 'c') . "
     ORDER BY a.nomination ASC, a.score DESC, a.full_name ASC",
    [(int) $c['id']]
);

/* Карта «ФИО -> slug портфолио» строится один раз по всему публичному реестру дипломов (без N+1 запросов). */
$allDiplomaRows = all(
    "SELECT a.id AS app_id, a.user_id, a.full_name
     FROM diplomas d JOIN applications a ON a.id = d.application_id
     WHERE a.full_name <> ''"
);
/* Конфиденциальность: пользователи с privacy.name_public='initials' (настройка кабинета,
   users.privacy JSON) показываются в публичных результатах как «Фамилия И. О.». */
$privInitials = [];
try {
    foreach (all("SELECT id, privacy FROM users WHERE privacy LIKE '%initials%'") as $pu) {
        $pj = json_decode((string) ($pu['privacy'] ?? ''), true);
        if (is_array($pj) && ($pj['name_public'] ?? '') === 'initials') $privInitials[(int) $pu['id']] = true;
    }
} catch (\Throwable $e) { /* колонки privacy может ещё не быть — тогда скрывать некого */ }
if ($privInitials) {
    $mmInitials = function (string $name): string {
        $parts = array_values(array_filter(preg_split('~\s+~u', trim($name)) ?: [], fn($w) => $w !== ''));
        if (count($parts) < 2) return $name;
        $out = (string) $parts[0];
        for ($i = 1, $n = count($parts); $i < $n; $i++) $out .= ' ' . mb_strtoupper(mb_substr($parts[$i], 0, 1)) . '.';
        return $out;
    };
    foreach ($results as &$rr) if (!empty($rr['user_id']) && isset($privInitials[(int) $rr['user_id']])) $rr['full_name'] = $mmInitials((string) $rr['full_name']);
    unset($rr);
    foreach ($allDiplomaRows as &$rr) if (!empty($rr['user_id']) && isset($privInitials[(int) $rr['user_id']])) $rr['full_name'] = $mmInitials((string) $rr['full_name']);
    unset($rr);
}

$artistSlugMap = [];
$artistGroups = [];
foreach ($allDiplomaRows as $r) {
    $key = mb_strtolower(trim($r['full_name']));
    if ($key === '') continue;
    if (!isset($artistGroups[$key])) $artistGroups[$key] = ['name' => $r['full_name'], 'uid' => null, 'minApp' => PHP_INT_MAX];
    if (!empty($r['user_id'])) $artistGroups[$key]['uid'] = (int) $r['user_id'];
    $artistGroups[$key]['minApp'] = min($artistGroups[$key]['minApp'], (int) $r['app_id']);
}
foreach ($artistGroups as $key => $g) {
    $cid = $g['uid'] ?: ($g['minApp'] === PHP_INT_MAX ? 0 : $g['minApp']);
    $artistSlugMap[$key] = $slugify($g['name']) . '-' . $cid;
}

/* ОДИН СПИСОК, БЕЗ ДЕЛЕНИЯ НА НОМИНАЦИИ.
 *
 * Раньше результаты стояли главами: «Вокальное искусство», за ним «Хореография»
 * и так далее. Порядок глав задавала не заслуга, а алфавит, и вокалисты каждый
 * раз оказывались первыми, а кто-то — всегда последним. Конкурс многожанровый,
 * все аттестованы по одним правилам, и делить их на очередь незачем.
 *
 * Теперь список один и отсортирован по алфавиту: участник ищет себя поиском или
 * глазами по букве, а не разбирается, в какую главу его записали. */
$sortKey = static function (array $r): string {
    $n = $r['is_group'] && $r['group_name'] ? $r['group_name'] : $r['full_name'];
    // Кавычки и служебные символы в начале сбивают алфавит: «Овация» уехала бы
    // в конец списка, к знакам препинания.
    return mb_strtolower(trim((string) $n, " \t\n\r\0\x0B\"'«»„“"));
};
usort($results, static fn(array $a, array $b): int => strcmp($sortKey($a), $sortKey($b)));

/* Файл со списком результатов — тот же, что уходит в письме и в сообществе
 * ВКонтакте (собирается пультом запуска, core/launch_run.php). Если он собран —
 * даём скачать прямо со страницы. */
$docxUrl = '';
if (is_file(BASE_PATH . '/public/uploads/launch/results_' . (int) $c['id'] . '.docx')) {
    $docxUrl = url('/uploads/launch/results_' . (int) $c['id'] . '.docx');
}

$vkUrl = cfgv('org_vk');

/* Класс звания для цветовой маркировки карточки. */
$titleTone = function (string $res): string {
    $r = mb_strtoupper($res);
    if (mb_strpos($r, 'ГРАН') !== false)   return 'gp';
    if (mb_strpos($r, 'ЛАУРЕАТ') !== false) return 'lau';
    if (mb_strpos($r, 'ДИПЛОМАНТ') !== false) return 'dip';
    return 'part';
};

ob_start(); ?>
<style>
.res-wrap{max-width:1080px;margin:0 auto;position:relative}
.res-hero{text-align:center;max-width:720px;margin:0 auto 30px;position:relative}
.res-hero::before{content:"";position:absolute;left:50%;top:-60px;width:min(680px,100%);height:360px;transform:translateX(-50%);
  background:radial-gradient(closest-side,var(--gold-soft),transparent 72%);pointer-events:none;z-index:-1}

/* Шапка списка: сколько всего и две кнопки — заказать награды и скачать список. */
.res-top{display:flex;flex-wrap:wrap;gap:10px;justify-content:center;margin:0 0 24px}
.res-total{text-align:center;color:var(--muted);font-size:.9rem;margin:0 0 16px}

.res-search{position:sticky;top:74px;z-index:5;margin:0 auto 34px;max-width:560px}
.res-search .field--float{margin:0}
.res-search .rs-ic{position:absolute;right:16px;top:50%;transform:translateY(-50%);color:var(--gold-deep);pointer-events:none}
[data-theme="dark"] .res-search .rs-ic{color:var(--gold)}
.res-count{text-align:center;color:var(--muted);font-size:.86rem;margin:-20px 0 30px}

.res-search .field--float>input{box-shadow:var(--shadow-card)}
/* СТРОКА РЕЗУЛЬТАТА.
 *
 * В одном ряду должно уместиться всё, за чем человек пришёл: кто выступал, с
 * каким номером, откуда, от какого учреждения, что получил — основное звание и
 * дополнительный диплом, — и кнопки заказа. Поэтому список идёт в одну колонку
 * на всю ширину: две колонки заставляли резать текст, а названия коллективов и
 * учреждений длинные. Слева — участник, справа — звания и действия; на телефоне
 * всё выстраивается в столбик. */
.rrow{display:flex;flex-wrap:wrap;gap:16px 22px;align-items:flex-start;justify-content:space-between;
  padding:20px 22px;position:relative;overflow:hidden;margin-bottom:12px}
.rrow--gp{background:radial-gradient(150% 100% at 100% 0,var(--gold-soft),transparent 55%),var(--panel)}
.rrow--gp::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--grad-gold);opacity:.9}
.rrow--lau::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--gold-2);opacity:.5}
.rrow-main{flex:1 1 340px;min-width:0}
.rrow-main b{font-family:var(--ff-display);letter-spacing:.01em;color:var(--text);font-size:1.12rem;
  line-height:1.2;display:block;overflow-wrap:anywhere}
.rrow-main b a{color:inherit}
.rrow-work{color:var(--muted);font-size:.92rem;margin:5px 0 0;overflow-wrap:anywhere}
.rrow-meta{display:flex;flex-wrap:wrap;gap:6px 14px;color:var(--text-dim);font-size:.85rem;margin-top:10px}
.rrow-meta span{display:inline-flex;align-items:center;gap:6px;min-width:0}
.rrow-meta svg{width:14px;height:14px;color:var(--gold-deep);flex:none}
[data-theme="dark"] .rrow-meta svg{color:var(--gold)}
.rrow-side{flex:0 1 300px;display:flex;flex-direction:column;align-items:flex-start;gap:9px}
.rrow-acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:2px}
.rrow .btn{padding:9px 16px;font-size:.86rem}
/* Афиша итогов над списком: та же, что в письме и в сообществе — человек сразу
   понимает, что попал куда шёл. Ширину держим по контейнеру, пропорции 16:9. */
.res-poster-hero{max-width:1080px;margin:0 auto 26px;border-radius:var(--radius);overflow:hidden;
  border:1px solid var(--glass-brd);box-shadow:var(--shadow-card);line-height:0}
.res-poster-hero img{display:block;width:100%;height:auto}
.res-order{white-space:nowrap}
.res-title{display:inline-flex;align-items:center;gap:7px;font-family:var(--ff-display);font-weight:700;
  letter-spacing:.02em;font-size:.98rem;padding:6px 14px;border-radius:999px;white-space:nowrap}
.res-title svg{width:16px;height:16px;flex:none}
.res-title.gp{color:#fff;background:var(--grad-gold);box-shadow:var(--shadow-glow)}
.res-title.lau{color:var(--gold-ink);background:var(--gold-soft);border:1px solid var(--glass-brd)}
[data-theme="dark"] .res-title.lau{color:var(--gold)}
.res-title.dip{color:var(--text-dim);background:var(--panel);border:1px solid var(--glass-brd)}
.res-title.part{color:var(--muted);background:var(--panel);border:1px solid var(--line)}
/* Дополнительный диплом — вторая награда, а не пояснение к первой: показываем
   его отдельной строкой, чтобы человек видел обе свои. */
.res-extra{display:inline-flex;align-items:flex-start;gap:7px;font-size:.86rem;line-height:1.35;
  color:var(--gold-ink);background:var(--gold-soft);border:1px solid var(--glass-brd);
  border-radius:12px;padding:7px 13px;overflow-wrap:anywhere}
[data-theme="dark"] .res-extra{color:var(--gold)}
.res-extra svg{width:15px;height:15px;flex:none;margin-top:1px}
.res-extra i{font-style:normal;font-weight:700}

.res-empty{text-align:center;color:var(--muted);padding:40px 20px;display:none}

@media(max-width:760px){
  .rrow{padding:18px}
  .rrow-side{flex:1 1 100%}
}
@media(max-width:560px){
  .res-search{top:66px}
}
/* Узкие экраны 360/390: без горизонтального оверфлоу, звание переносится по словам */
@media(max-width:400px){
  .res-title{white-space:normal;font-size:.92rem;overflow-wrap:anywhere}
  .rrow-acts{gap:8px}
  .rrow .btn{width:100%;justify-content:center}
}
@media(prefers-reduced-motion:reduce){
  .rrow,.res-title{transition:none}
}
</style>

<section class="section">
  <div class="container res-wrap">
    <a class="aw-back" href="<?= url('/menu') ?>"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>Назад</a>
    <?php
    /* АФИША ИТОГОВ В ШАПКЕ.
     *
     * Ту же картинку участник видит в письме и в сообществе ВКонтакте. Когда она
     * встречает его и на странице, он с первого взгляда понимает, что попал туда,
     * куда шёл, — а не на очередной похожий список. Берём ту, что назначена волне
     * оглашения; нет её — обычную афишу конкурса. */
    $resPoster = '';
    if (function_exists('setting')) {
        $ov = trim((string) setting('launch_cover:' . (int) $c['id'] . ':results', ''));
        if ($ov !== '' && $ov !== '__none__') $resPoster = $ov;
    }
    if ($resPoster === '' && is_file(BASE_PATH . '/public/uploads/comp/' . (int) $c['id'] . '/afisha.jpg')) {
        $resPoster = '/uploads/comp/' . (int) $c['id'] . '/afisha.jpg';
    }
    ?>
    <?php if ($resPoster !== ''): ?>
      <div class="res-poster-hero reveal">
        <img src="<?= h(url($resPoster)) ?>" alt="Результаты конкурса «<?= h($c['name']) ?>» — Культурный центр «Музыкальный Мир»">
      </div>
    <?php endif; ?>
    <div class="res-hero reveal">
      <p class="eyebrow"><?= h($typeLabel) ?> · Итоги</p>
      <h1><?= h($c['name']) ?></h1>
      <p style="color:var(--muted);margin-top:10px">
        Официальные результаты конкурса Культурного центра «Музыкальный Мир».
        <?php if (!empty($c['results_date'])): ?>Подведены <?= h(ru_date($c['results_date'])) ?>.<?php endif; ?>
        Каждый диплом можно проверить в <a href="<?= url('/verify') ?>">реестре подлинности</a>.
      </p>
    </div>

    <?php if (!$results): ?>
      <div class="reveal" style="text-align:center;background:var(--panel);backdrop-filter:blur(12px);border:1px solid var(--glass-brd);border-radius:var(--radius);padding:52px 28px;box-shadow:var(--shadow-card)">
        <svg viewBox="0 0 24 24" width="52" height="52" fill="none" stroke="var(--gold)" stroke-width="1.4" style="margin:0 auto 14px"><circle cx="12" cy="8" r="6"/><path d="M8.2 13.9 7 22l5-3 5 3-1.2-8.1"/></svg>
        <h2>Результаты готовятся к публикации</h2>
        <p style="color:var(--muted);max-width:460px;margin:0 auto 22px">Конкурс завершён, наградные документы формируются. Итоги появятся на этой странице в ближайшее время.</p>
        <a class="btn btn--primary" href="<?= url('/competition/' . $c['slug']) ?>">О конкурсе</a>
      </div>
    <?php else: ?>

      <p class="res-total reveal">Аттестационных результатов в списке: <b><?= count($results) ?></b>. Список общий, без деления на номинации, по алфавиту.</p>

      <?php /* ДВЕ КНОПКИ НАД СПИСКОМ. Заказ наград — то, зачем участник сюда
               чаще всего и приходит; файл со списком — тот же, что ушёл в письме
               и в сообществе, его скачивают учреждения и педагоги целиком. */ ?>
      <div class="res-top reveal">
        <a class="btn btn--primary" href="<?= url('/awards') ?>?comp=<?= (int) $c['id'] ?>">Заказать награды</a>
        <?php if ($docxUrl !== ''): ?>
          <a class="btn btn--ghost" href="<?= h($docxUrl) ?>" download>
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-3px;margin-right:6px"><path d="M12 3v12M7 11l5 5 5-5M5 21h14"/></svg>Скачать список результатов
          </a>
        <?php endif; ?>
      </div>

      <div class="res-search reveal">
        <div class="field--float">
          <input type="search" id="resSearch" placeholder=" " autocomplete="off" aria-label="Поиск по фамилии, коллективу, названию номера или номеру диплома">
          <label for="resSearch">Найдите себя: фамилия, коллектив, название номера</label>
          <svg class="rs-ic" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        </div>
      </div>
      <p class="res-count" id="resCount" aria-live="polite"></p>

      <div id="resList">
      <?php foreach ($results as $i => $r):
        $displayName = $r['is_group'] && $r['group_name'] ? $r['group_name'] : $r['full_name'];
        $aslug = $artistSlugMap[mb_strtolower(trim($r['full_name']))] ?? null;
        $tone  = $titleTone((string) $r['result']);
        $extra = trim((string) ($r['extra_diploma'] ?? ''));
        $needle = mb_strtolower(trim($displayName . ' ' . $r['full_name'] . ' ' . $r['diploma_number'] . ' '
                . $r['work_title'] . ' ' . $r['city'] . ' ' . $r['institution'] . ' ' . $r['result'] . ' ' . $extra));
      ?>
        <article class="card rrow rrow--<?= $tone ?> reveal" style="--i:<?= min($i, 12) ?>" data-item data-search="<?= h($needle) ?>">
          <div class="rrow-main">
            <b><?php if ($aslug): ?><a href="<?= url('/artist/' . $aslug) ?>"><?= h($displayName) ?></a><?php else: ?><?= h($displayName) ?><?php endif; ?></b>
            <?php if ($r['work_title']): ?><p class="rrow-work">Конкурсный номер: <?= h(wt_show((string) $r['work_title'])) ?></p><?php endif; ?>
            <div class="rrow-meta">
              <?php if ($r['age_category']): ?>
                <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><?= h($r['age_category']) ?></span>
              <?php endif; ?>
              <?php if ($r['city']): /* Город хранится канонично: «Страна, г. Город» — показываем целиком. */ ?>
                <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg><?= h($r['city']) ?></span>
              <?php endif; ?>
              <?php if ($r['institution']): ?>
                <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-5h6v5"/></svg><?= h($r['institution']) ?></span>
              <?php endif; ?>
            </div>
          </div>

          <div class="rrow-side">
            <span class="res-title <?= $tone ?>">
              <?php if ($tone === 'gp'): ?><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 21h8M12 17v4M5 4h14v3a7 7 0 0 1-14 0zM5 4H3v2a3 3 0 0 0 3 3M19 4h2v2a3 3 0 0 1-3 3"/></svg><?php endif; ?>
              <?= h($r['result']) ?>
            </span>
            <?php if ($extra !== ''): ?>
              <span class="res-extra">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10z"/><path d="M8.5 14 7 22l5-3 5 3-1.5-8"/></svg>
                <span>Дополнительный диплом<br><i><?= h($extra) ?></i></span>
              </span>
            <?php endif; ?>
            <div class="rrow-acts">
              <?php /* Заказ — прямо у своей строки: ссылка уже знает и конкурс, и номер заявки. */ ?>
              <a class="btn btn--primary btn--sm res-order"
                 href="<?= url('/awards') ?>?comp=<?= (int) $c['id'] ?>&app=<?= (int) $r['app_id'] ?>">Заказать награды</a>
              <?php /* ССЫЛКИ НА ВЫСТУПЛЕНИЕ ЗДЕСЬ НЕТ И НЕ ДОЛЖНО БЫТЬ.
                        Участник присылал видео для жюри, а не для публикации:
                        это чужой файл на чужом облаке, часто с детьми в кадре и
                        без согласия на показ. Список результатов такие ссылки не
                        раздаёт (правило владельца, 28.08.2026). */ ?>
              <?php if (!empty($r['diploma_number'])): ?>
                <a class="btn btn--ghost btn--sm" href="<?= url('/verify/' . $r['diploma_number']) ?>">Проверить диплом</a>
              <?php endif; ?>
            </div>
          </div>
        </article>
      <?php endforeach; ?>
      <div class="res-empty" id="resEmpty">По вашему запросу ничего не найдено. Уточните фамилию или номер диплома.</div>
      </div>

      <script>
      (function () {
        var inp = document.getElementById('resSearch');
        if (!inp) return;
        var items = [].slice.call(document.querySelectorAll('[data-item]'));
        var empty = document.getElementById('resEmpty');
        var count = document.getElementById('resCount');
        var total = items.length;
        function apply() {
          var q = inp.value.trim().toLowerCase();
          var shown = 0;
          items.forEach(function (el) {
            var ok = !q || (el.getAttribute('data-search') || '').indexOf(q) !== -1;
            el.style.display = ok ? '' : 'none';
            if (ok) shown++;
          });
          empty.style.display = shown ? 'none' : 'block';
          count.textContent = q ? ('Найдено: ' + shown + ' из ' + total) : '';
        }
        inp.addEventListener('input', apply);
      })();
      </script>

    <?php endif; ?>
  </div>
</section>
<?php
$content = ob_get_clean();
$metaDesc = $results
    ? 'Результаты конкурса «' . $c['name'] . '»: ' . count($results) . ' аттестационных результатов. Культурный центр «Музыкальный Мир».'
    : 'Результаты конкурса «' . $c['name'] . '» - Культурного центра «Музыкальный Мир».';
render_page('Результаты - ' . $c['name'], $content, [
    'active'   => '/competitions',
    'meta'     => $metaDesc,
    'og_image' => !empty($c['cover']) ? $c['cover'] : asset('img/logo_muzmir_main.png'),
]);
