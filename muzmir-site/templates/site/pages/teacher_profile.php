<?php
/**
 * Публичный профиль педагога («индексация по именам» — SEO).
 * Переменная $slug задана роутером, формат: транслитерация имени педагога + "-" + id (например ivanova-svetlana-12).
 * Педагог — свободное текстовое поле в заявках (applications.teacher), отдельной таблицы нет,
 * поэтому профиль строится из публичного реестра дипломов его учеников.
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

/** Тот же реестр «дипломы + заявки», что и на странице участника — только учеников с наградами. */
$rows = all(
    "SELECT a.id AS app_id, a.user_id, a.full_name, a.city, a.institution, a.teacher,
            a.nomination, a.work_title, a.formation,
            d.number, d.result AS d_result, a.result AS a_result, d.created_at AS d_created,
            c.name AS comp_name, c.slug AS comp_slug, c.type AS comp_type
     FROM diplomas d
     JOIN applications a ON a.id = d.application_id
     LEFT JOIN competitions c ON c.id = a.competition_id
     WHERE a.teacher <> ''
     ORDER BY d.created_at DESC, d.id DESC"
);

/** Группируем по педагогу (нормализованное имя), id — минимальный id заявки со ссылкой на этого педагога. */
$groups = [];
foreach ($rows as $r) {
    $key = mb_strtolower(trim($r['teacher']));
    if ($key === '') continue;
    if (!isset($groups[$key])) $groups[$key] = ['name' => trim($r['teacher']), 'rows' => [], 'minApp' => PHP_INT_MAX];
    $groups[$key]['rows'][] = $r;
    $groups[$key]['minApp'] = min($groups[$key]['minApp'], (int) $r['app_id']);
}

$teacher = null; $items = [];
foreach ($groups as $g) {
    $gslug = $slugify($g['name']) . '-' . $g['minApp'];
    if ($gslug === $slug) {
        $teacher = ['name' => $g['name'], 'slug' => $gslug];
        $items = $g['rows'];
        break;
    }
}

/** Транслитерация ФИО ученика для ссылки на его портфолио (тот же принцип, что и в artist.php). */
$artistSlugFor = function (string $fullName) use ($rows, $slugify): string {
    $allRows = all(
        "SELECT a.id AS app_id, a.user_id, a.full_name
         FROM diplomas d JOIN applications a ON a.id = d.application_id
         WHERE a.full_name <> ''"
    );
    $key = mb_strtolower(trim($fullName));
    $uid = null; $minApp = PHP_INT_MAX;
    foreach ($allRows as $r) {
        if (mb_strtolower(trim($r['full_name'])) !== $key) continue;
        if (!empty($r['user_id'])) $uid = (int) $r['user_id'];
        $minApp = min($minApp, (int) $r['app_id']);
    }
    $cid = $uid ?: ($minApp === PHP_INT_MAX ? 0 : $minApp);
    return $slugify($fullName) . '-' . $cid;
};

/** Сводка: ученики, победы, конкурсы, отзывы (по совпадению user_id ученика с автором отзыва). */
$students = []; $competitions = []; $wins = ['Гран-при' => 0, 'Лауреат' => 0, 'Дипломант' => 0, 'Иное' => 0];
$studentUserIds = [];
if ($teacher) {
    foreach ($items as $it) {
        $sKey = mb_strtolower(trim($it['full_name']));
        if (!isset($students[$sKey])) {
            $students[$sKey] = ['name' => $it['full_name'], 'city' => $it['city'], 'count' => 0];
        }
        $students[$sKey]['count']++;
        if (!empty($it['user_id'])) $studentUserIds[(int) $it['user_id']] = true;

        if (!empty($it['comp_slug']) && !isset($competitions[$it['comp_slug']])) {
            $competitions[$it['comp_slug']] = ['name' => $it['comp_name'], 'slug' => $it['comp_slug']];
        }

        $res = (string) ($it['d_result'] ?: $it['a_result']);
        if (mb_stripos($res, 'ГРАН-ПРИ') !== false) $wins['Гран-при']++;
        elseif (mb_stripos($res, 'ЛАУРЕАТ') !== false) $wins['Лауреат']++;
        elseif (mb_stripos($res, 'ДИПЛОМАНТ') !== false) $wins['Дипломант']++;
        else $wins['Иное']++;
    }

    $reviews = [];
    if ($studentUserIds) {
        $ids = array_keys($studentUserIds);
        $ph = implode(',', array_fill(0, count($ids), '?'));
        $reviews = all("SELECT * FROM reviews WHERE status='published' AND user_id IN ($ph) ORDER BY created_at DESC", $ids);
    }
}

ob_start(); ?>
<style>
.tp-card{max-width:960px;margin:0 auto}
.tp-hero{text-align:center;max-width:640px;margin:0 auto 36px}
.tp-ava{width:104px;height:104px;border-radius:50%;background:var(--grad-gold);color:#fff;
  display:flex;align-items:center;justify-content:center;font-family:var(--ff-head);font-size:2.4rem;margin:0 auto 16px;box-shadow:var(--shadow-hover)}
.tp-stats{display:flex;justify-content:center;gap:26px;flex-wrap:wrap;margin-top:18px}
.tp-stats div{text-align:center}
.tp-stats b{display:block;font-family:var(--ff-head);font-size:1.7rem;color:var(--gold-dark)}
.tp-stats span{color:var(--muted);font-size:.84rem}
.tp-student{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;align-items:center;
  background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:16px 20px;box-shadow:var(--shadow-card);margin-bottom:12px}
.tp-student b{font-family:var(--ff-head);color:var(--navy);font-size:1.02rem}
.tp-chips{display:flex;flex-wrap:wrap;gap:9px;margin-top:6px}
.tp-chip{display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border-radius:999px;background:#fff;
  border:1px solid var(--line);color:var(--navy);font-size:.88rem;font-weight:600;box-shadow:var(--shadow-card)}
.tp-chip:hover{border-color:var(--gold);color:var(--gold-dark)}
.tp-rv{background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:22px;box-shadow:var(--shadow-card);margin-bottom:14px}
.tp-rv .stars{color:var(--gold);letter-spacing:2px}
</style>

<section class="section">
  <div class="container tp-card">
    <?php if ($teacher): ?>
      <div class="tp-hero reveal">
        <div class="tp-ava"><?= h(mb_strtoupper(mb_substr($teacher['name'], 0, 1))) ?></div>
        <p class="eyebrow">Профиль педагога</p>
        <h1 style="margin:.1em 0"><?= h($teacher['name']) ?></h1>
        <p style="color:var(--muted)">Наставник участников конкурсов КЦ «Музыкальный Мир»</p>
        <div class="tp-stats">
          <div><b><?= count($students) ?></b><span>Учеников</span></div>
          <div><b><?= count($items) ?></b><span>Наградных документов</span></div>
          <div><b><?= $wins['Гран-при'] ?></b><span>Гран-при</span></div>
          <div><b><?= count($competitions) ?></b><span>Конкурсов</span></div>
        </div>
      </div>

      <div class="section-head reveal" style="margin-bottom:18px"><p class="eyebrow">Результаты</p><h2>Ученики и победы</h2><div class="gold-rule"></div></div>
      <?php foreach ($students as $s): $asl = $artistSlugFor($s['name']); ?>
        <div class="tp-student reveal">
          <div>
            <b><?= h($s['name']) ?></b>
            <p style="color:var(--muted);margin:3px 0 0;font-size:.9rem"><?= h($s['city'] ?: '') ?></p>
          </div>
          <div style="text-align:right">
            <span class="badge badge--open"><?= (int) $s['count'] ?> <?= $s['count'] == 1 ? 'диплом' : 'диплома(-ов)' ?></span>
            <p style="margin:8px 0 0"><a class="btn btn--ghost" href="<?= url('/artist/' . $asl) ?>">Портфолио ученика</a></p>
          </div>
        </div>
      <?php endforeach; ?>

      <?php if ($competitions): ?>
        <div class="section-head reveal" style="margin-bottom:14px;margin-top:32px"><p class="eyebrow">География</p><h2>Конкурсы</h2></div>
        <div class="tp-chips reveal">
          <?php foreach ($competitions as $c): ?>
            <a class="tp-chip" href="<?= url('/competition/' . $c['slug']) ?>"><?= h($c['name']) ?></a>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>

      <?php if ($reviews): ?>
        <div class="section-head reveal" style="margin-bottom:18px;margin-top:36px"><p class="eyebrow">Отклики</p><h2>Отзывы об учениках</h2><div class="gold-rule"></div></div>
        <?php foreach ($reviews as $r): ?>
          <div class="tp-rv reveal">
            <div class="stars"><?= str_repeat('&#9733;', max(1, min(5, (int) $r['rating']))) ?><?= str_repeat('&#9734;', 5 - max(1, min(5, (int) $r['rating']))) ?></div>
            <p style="font-family:var(--ff-head);font-size:1.02rem;margin-top:8px">«<?= h($r['text']) ?>»</p>
            <p style="color:var(--gold-dark);font-weight:700;margin:0"><?= h($r['author'] ?: 'Участник конкурса') ?></p>
          </div>
        <?php endforeach; ?>
      <?php endif; ?>

    <?php else:
      http_response_code(404); ?>
      <div class="reveal" style="text-align:center;background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:52px 28px;box-shadow:var(--shadow-card)">
        <svg viewBox="0 0 24 24" width="52" height="52" fill="none" stroke="var(--gold)" stroke-width="1.4" style="margin:0 auto 14px"><circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2M16 11l2 2 4-4"/></svg>
        <h1 style="font-size:clamp(1.6rem,4vw,2.4rem)">Профиль пока не опубликован</h1>
        <p style="color:var(--muted);max-width:460px;margin:0 auto 22px">Публичный профиль педагога появляется, когда его ученики получают наградные документы по итогам конкурсов. Проверьте ссылку или посмотрите действующие конкурсы.</p>
        <a class="btn btn--primary" href="<?= url('/competitions') ?>">Действующие конкурсы</a>
      </div>
    <?php endif; ?>
  </div>
</section>
<?php
$content = ob_get_clean();
$ttl = $teacher ? $teacher['name'] : 'Профиль педагога';
$metaDesc = $teacher
    ? 'Педагог ' . $teacher['name'] . ': ' . count($students) . ' учеников, ' . count($items) . ' наградных документов на конкурсах КЦ «Музыкальный Мир».'
    : 'Публичный профиль педагога - участника конкурсов КЦ «Музыкальный Мир».';
render_page($ttl, $content, ['active' => '', 'meta' => $metaDesc]);
