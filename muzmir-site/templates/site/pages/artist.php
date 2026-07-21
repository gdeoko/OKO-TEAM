<?php
/** Публичное портфолио участника. Переменная $slug задана роутером. */
$slug = trim((string)($slug ?? ''));

/** Транслитерация ФИО в slug (локально, чтобы сопоставить участника без отдельной колонки). */
$artist_slug = function (string $s): string {
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

// Собираем публичные результаты (только участники с дипломами), ищем совпадение по slug.
$artist = null; $items = [];
$rows = all("SELECT a.full_name, a.city, a.institution,
                    d.number, d.result AS d_result, a.result AS a_result, a.nomination, a.work_title,
                    c.name AS comp_name, d.created_at
             FROM diplomas d
             JOIN applications a ON a.id=d.application_id
             LEFT JOIN competitions c ON c.id=a.competition_id
             WHERE a.full_name <> ''
             ORDER BY d.created_at DESC");
foreach ($rows as $r) {
    if ($artist_slug($r['full_name']) !== $slug) continue;
    if ($artist === null) $artist = ['name' => $r['full_name'], 'city' => $r['city'], 'institution' => $r['institution']];
    $items[] = $r;
}

ob_start(); ?>
<style>
.artist-hero{text-align:center;max-width:640px;margin:0 auto 36px}
.artist-ava{width:110px;height:110px;border-radius:50%;background:var(--grad-gold);color:#fff;
  display:flex;align-items:center;justify-content:center;font-family:var(--ff-head);font-size:2.6rem;margin:0 auto 16px;box-shadow:var(--shadow-hover)}
.dip-item{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:center;
  background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:18px 22px;box-shadow:var(--shadow-card);margin-bottom:14px}
</style>
<section class="section">
  <div class="container" style="max-width:820px">
    <?php if ($artist): ?>
      <div class="artist-hero reveal">
        <div class="artist-ava"><?= h(mb_strtoupper(mb_substr($artist['name'],0,1))) ?></div>
        <p class="eyebrow">Портфолио участника</p>
        <h1 style="margin:.1em 0"><?= h($artist['name']) ?></h1>
        <p style="color:var(--muted)">
          <?= h($artist['city'] ?: '') ?><?php if ($artist['city'] && $artist['institution']): ?> · <?php endif; ?><?= h($artist['institution'] ?: '') ?>
        </p>
      </div>

      <div class="section-head reveal" style="margin-bottom:28px"><p class="eyebrow">Достижения</p><h2>Дипломы и результаты</h2><div class="gold-rule"></div></div>
      <?php foreach ($items as $it): ?>
        <div class="dip-item reveal">
          <div>
            <strong style="font-family:var(--ff-head);font-size:1.15rem;color:var(--gold-dark)"><?= h($it['d_result'] ?: $it['a_result'] ?: 'Диплом') ?></strong>
            <p style="color:var(--muted);margin:4px 0 0;font-size:.92rem">
              <?= h($it['comp_name'] ?: 'Конкурс') ?>
              <?php if ($it['nomination']): ?> · <?= h($it['nomination']) ?><?php endif; ?>
              <?php if ($it['work_title']): ?> · «<?= h($it['work_title']) ?>»<?php endif; ?>
            </p>
            <p style="color:var(--muted);margin:2px 0 0;font-size:.85rem"><?= h(ru_date(substr((string)$it['created_at'],0,10))) ?></p>
          </div>
          <a class="btn btn--ghost" href="<?= url('/verify/'.$it['number']) ?>">Проверить</a>
        </div>
      <?php endforeach; ?>
    <?php else: ?>
      <div class="reveal" style="text-align:center;background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:52px 28px;box-shadow:var(--shadow-card)">
        <svg viewBox="0 0 24 24" width="52" height="52" fill="none" stroke="var(--gold)" stroke-width="1.4" style="margin:0 auto 14px"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg>
        <h1 style="font-size:clamp(1.6rem,4vw,2.4rem)">Портфолио пока пусто</h1>
        <p style="color:var(--muted);max-width:460px;margin:0 auto 22px">Публичная страница участника появится, когда его работы получат оценку жюри и наградные документы.</p>
        <a class="btn btn--primary" href="<?= url('/competitions') ?>">Действующие конкурсы</a>
      </div>
    <?php endif; ?>
  </div>
</section>
<?php
$content = ob_get_clean();
$ttl = $artist ? $artist['name'] : 'Портфолио участника';
render_page($ttl, $content, ['active' => '', 'meta' => 'Портфолио участника конкурсов КЦ «Музыкальный Мир».']);
