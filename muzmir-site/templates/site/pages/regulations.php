<?php
/**
 * Положения конкурсов — архив документов, по которым оценивались работы.
 *
 * ЗАЧЕМ ОТДЕЛЬНАЯ СТРАНИЦА. Отказ по заявке всегда ссылается на пункт положения
 * («п. 8.8», «п. 4.2»), и человек должен иметь возможность этот пункт прочитать.
 * Пока приём идёт, положение открывается с афиши; после закрытия конкурс уходит
 * с витрины, и ссылка на документ пропадала вместе с ним — участник получал
 * отказ с номером пункта и не мог его проверить.
 *
 * Срок хранения тот же, что у заказа наград: два месяца со дня закрытия приёма
 * (core/orders.php, awards_window_open). Так у обоих окон одна дата, и человеку
 * не надо помнить, что где живёт дольше: пока можно заказать награду по
 * конкурсу, можно и перечитать его положение.
 */
require_once BASE_PATH . '/core/orders.php';

/* Берём всё, что было запущено и не черновик, и оставляем те конкурсы, чьё окно
   ещё открыто. Порядок: идущие приёмы сверху, дальше по дате закрытия — свежие
   выше, прошлые опускаются и исчезают сами, когда два месяца истекают. */
$regs = array_values(array_filter(
    all("SELECT id, slug, name, type, direction, is_paid, price, status,
                start_date, end_date, results_date, results_mode
           FROM competitions
          WHERE COALESCE(launched,0) = 1 AND status <> 'draft'
       ORDER BY CASE WHEN status='open' THEN 0 ELSE 1 END, end_date DESC, sort, id"),
    'awards_window_open'
));

$dt = static function (?string $d): string {
    $d = trim((string) $d);
    if ($d === '') return '';
    return function_exists('ru_date') ? ru_date($d) : date('d.m.Y', (int) strtotime($d));
};

ob_start(); ?>
<section class="section">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow eyebrow--script">Документы</p>
      <h2>Положения конкурсов</h2>
      <p class="section-lead">
        Официальные положения — те самые документы, по которым жюри принимает работы и
        выставляет звания. Если по Вашей заявке названа причина с номером пункта,
        откройте положение своего конкурса и прочитайте пункт целиком.
      </p>
    </div>

    <?php if (!$regs): ?>
      <div class="card reveal" style="max-width:620px;margin:0 auto;text-align:center">
        <h3 style="margin:0 0 10px">Пока здесь пусто</h3>
        <p style="color:var(--muted);margin:0">
          Положения появятся вместе с новыми конкурсами. Афиша и календарь —
          в разделе <a href="<?= url('/competitions') ?>">«Конкурсы»</a>.
        </p>
      </div>
    <?php else: ?>
      <div class="reg-list reveal">
        <?php foreach ($regs as $c):
          $open   = (string) $c['status'] === 'open';
          $until  = awards_window_end((array) $c);
          $free   = (int) ($c['is_paid'] ?? 0) === 0; ?>
          <article class="reg-item">
            <div class="reg-item__main">
              <h3 class="reg-item__name"><?= h((string) $c['name']) ?></h3>
              <p class="reg-item__meta">
                <?php if ($dt($c['start_date']) !== '' || $dt($c['end_date']) !== ''): ?>
                  Приём заявок: <?= h(trim($dt($c['start_date']) . ' — ' . $dt($c['end_date']), ' —')) ?>.
                <?php endif; ?>
                <?= $free ? 'Участие бесплатное.' : 'Участие ' . h(number_format((int) $c['price'], 0, '.', ' ')) . ' ₽.' ?>
              </p>
              <p class="reg-item__note">
                <?php if ($open): ?>
                  <span class="reg-badge reg-badge--open">Приём идёт</span>
                <?php else: ?>
                  <span class="reg-badge">Приём завершён</span>
                <?php endif; ?>
                <?php if ($until !== ''): ?>
                  <span class="reg-until">документ доступен до <?= h($dt($until)) ?></span>
                <?php endif; ?>
              </p>
            </div>
            <div class="reg-item__acts">
              <a class="btn btn--primary btn--sm"
                 href="<?= url('/competition/' . rawurlencode((string) $c['slug']) . '/regulation.pdf') ?>"
                 target="_blank" rel="noopener">Открыть положение</a>
              <a class="btn btn--ghost btn--sm"
                 href="<?= url('/competition/' . rawurlencode((string) $c['slug']) . '/regulation.docx') ?>">Скачать DOCX</a>
            </div>
          </article>
        <?php endforeach; ?>
      </div>

      <p class="reg-foot reveal">
        Положение хранится здесь два месяца после закрытия приёма — столько же, сколько
        принимается заказ наградного материала. Нужен документ по более раннему конкурсу —
        напишите в оргкомитет, вышлем: <a href="<?= url('/contacts') ?>">контакты</a>.
      </p>
    <?php endif; ?>
  </div>
</section>

<style>
.reg-list{display:flex;flex-direction:column;gap:12px;max-width:900px;margin:0 auto}
.reg-item{display:flex;gap:16px;justify-content:space-between;align-items:center;flex-wrap:wrap;
  padding:16px 18px;border:1px solid var(--line,#e8e2d4);border-radius:14px;background:#fff}
.reg-item__main{flex:1 1 340px;min-width:0}
.reg-item__name{margin:0 0 6px;font-size:1.06rem;line-height:1.3}
.reg-item__meta{margin:0 0 8px;color:var(--muted);font-size:.92rem;line-height:1.5}
.reg-item__note{margin:0;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.reg-badge{display:inline-block;padding:3px 10px;border-radius:8px;font-size:.78rem;
  background:#f1efe8;color:#6b6552}
.reg-badge--open{background:#e6f7f3;color:#1c8a72}
.reg-until{color:var(--muted);font-size:.82rem}
.reg-item__acts{display:flex;gap:8px;flex-wrap:wrap}
.reg-foot{max-width:900px;margin:22px auto 0;color:var(--muted);font-size:.9rem;line-height:1.6;text-align:center}
@media (max-width:640px){
  .reg-item{flex-direction:column;align-items:stretch}
  .reg-item__acts{width:100%}
  .reg-item__acts .btn{flex:1 1 auto;text-align:center}
}
</style>
<?php
$content = ob_get_clean();
render_page('Положения конкурсов', $content, [
    'active' => '/regulations',
    'meta'   => 'Официальные положения конкурсов Культурного центра «Музыкальный Мир»: требования '
              . 'к конкурсным работам, порядок оценки и награждения. Документы доступны два месяца '
              . 'после закрытия приёма заявок.',
]);
