<?php
/** Публичный список конкурсов с результатами (все, у которых опубликованы итоги). */
$comps = all("SELECT c.*,
                     (SELECT COUNT(*) FROM applications a WHERE a.competition_id=c.id AND a.result<>'') AS winners_count,
                     (SELECT COUNT(*) FROM applications a WHERE a.competition_id=c.id) AS total_apps
              FROM competitions c
              WHERE c.status IN ('judging','closed') OR c.results_date IS NOT NULL
              ORDER BY c.results_date DESC, c.end_date DESC, c.id DESC");

ob_start(); ?>
<section class="section">
  <div class="container" style="max-width:900px">
    <div class="section-head reveal" style="text-align:left">
      <p class="eyebrow eyebrow--script">Итоги</p>
      <h1 style="font-family:var(--ff-display);font-size:clamp(1.8rem,5.5vw,2.5rem);margin:0 0 6px;
        background:var(--grad-gold);-webkit-background-clip:text;background-clip:text;color:transparent">Результаты конкурсов</h1>
      <p style="color:var(--muted);margin:0">Публикуем полные списки лауреатов и дипломантов сразу после подведения итогов жюри.</p>
    </div>

    <?php if (!$comps): ?>
      <div class="card" style="text-align:center;padding:44px 20px;margin-top:22px">
        <p style="color:var(--muted);margin:0">Пока результаты не опубликованы. Загляните после окончания приёма заявок.</p>
      </div>
    <?php else: ?>
      <div class="results-grid" style="margin-top:22px">
        <?php foreach ($comps as $c):
          $isJudging = ($c['status'] ?? '') === 'judging';
          $winners = (int)($c['winners_count'] ?? 0);
        ?>
          <a class="rst-tile reveal" href="<?= url('/results/' . $c['slug']) ?>">
            <div class="rst-ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"/><path d="M8.2 13.9 7 22l5-3 5 3-1.2-8.1"/></svg>
            </div>
            <div class="rst-body">
              <b><?= h($c['name']) ?></b>
              <span class="rst-meta">
                <?= (int)$c['total_apps'] ?> заявок
                <?php if ($winners > 0): ?> · <?= (int)$winners ?> результатов<?php endif; ?>
                <?php if (!empty($c['results_date'])): ?> · итоги <?= h(ru_date($c['results_date'])) ?><?php endif; ?>
              </span>
              <?php if ($isJudging): ?>
                <span class="badge badge--judging" style="margin-top:6px;display:inline-block">Идёт оценка</span>
              <?php elseif ($winners > 0): ?>
                <span class="badge badge--open" style="margin-top:6px;display:inline-block">Итоги опубликованы</span>
              <?php endif; ?>
            </div>
            <svg class="rst-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 6l6 6-6 6"/></svg>
          </a>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>

    <div style="margin-top:32px;text-align:center">
      <p style="color:var(--muted);font-size:.9rem;margin-bottom:12px">Проверить подлинность диплома по номеру:</p>
      <a class="btn btn--ghost" href="<?= url('/verify') ?>">Проверка диплома</a>
    </div>
  </div>
</section>

<style>
.results-grid{display:flex;flex-direction:column;gap:10px}
.rst-tile{position:relative;display:flex;align-items:center;gap:14px;padding:16px;padding-right:36px;border-radius:16px;
  background:var(--panel);border:1px solid var(--glass-brd);text-decoration:none;color:inherit;
  box-shadow:0 4px 14px rgba(139,111,31,.08);transition:transform .22s cubic-bezier(.2,.8,.2,1),box-shadow .22s,border-color .22s;backdrop-filter:blur(10px)}
.rst-tile:hover{transform:translateY(-3px);border-color:var(--gold);box-shadow:0 12px 28px rgba(201,168,76,.22)}
.rst-ic{flex:none;width:44px;height:44px;border-radius:13px;display:flex;align-items:center;justify-content:center;
  background:var(--grad-gold);color:var(--gold-fg);box-shadow:0 6px 14px rgba(201,168,76,.28)}
.rst-ic svg{width:22px;height:22px}
.rst-body{flex:1;min-width:0}
.rst-body b{display:block;font-family:var(--ff-serif);font-size:1.02rem;line-height:1.2;margin-bottom:4px}
.rst-meta{display:block;color:var(--muted);font-size:.82rem;line-height:1.4}
.rst-arrow{position:absolute;right:14px;top:50%;transform:translateY(-50%);width:16px;height:16px;color:var(--gold);opacity:.55}
</style>
<?php
$content = ob_get_clean();
render_page('Результаты конкурсов', $content, ['active' => '/results', 'meta' => 'Итоги конкурсов КЦ «Музыкальный Мир»: лауреаты и дипломанты. Проверка подлинности дипломов по номеру.']);
