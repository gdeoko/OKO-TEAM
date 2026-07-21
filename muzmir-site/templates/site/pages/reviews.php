<?php
/** Отзывы: лента опубликованных отзывов с ответами Оргкомитета + форма (для авторизованных). */
$perPage = 6;
$pageNo = max(1, (int) input('page', '1'));
$total = (int) scalar("SELECT COUNT(*) FROM reviews WHERE status='published'");
$pagesTotal = max(1, (int) ceil($total / $perPage));
$pageNo = min($pageNo, $pagesTotal);
$reviews = all("SELECT * FROM reviews WHERE status='published' ORDER BY created_at DESC LIMIT ? OFFSET ?",
    [$perPage, ($pageNo - 1) * $perPage]);

$u = current_user();

ob_start(); ?>
<style>
.rv-stars{color:var(--gold);letter-spacing:2px}
.rv-reply{margin-top:14px;padding:14px 16px;background:var(--gold-light);border-radius:var(--radius-sm)}
.rv-reply b{display:block;margin-bottom:4px;font-size:.85rem;color:var(--gold-dark)}
.rv-pager{display:flex;justify-content:center;gap:8px;margin-top:36px;flex-wrap:wrap}
.rv-pager a{padding:9px 16px;border-radius:999px;border:1.5px solid var(--gold);font-weight:700;font-size:.92rem}
.rv-pager a.active{background:var(--grad-gold);color:#fff;border-color:transparent}
</style>

<section class="section">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Отзывы</p>
      <h2>Отзывы участников</h2>
      <div class="gold-rule"></div>
    </div>

    <?php if (!$reviews): ?>
      <div class="card reveal" style="max-width:640px;margin:0 auto 40px;text-align:center">
        <p style="color:var(--ink);margin:0">Отзывы участников пока готовятся к публикации. Будьте первым, кто поделится впечатлениями.</p>
      </div>
    <?php else: ?>
      <div class="grid grid-3">
        <?php foreach ($reviews as $r): ?>
          <div class="card reveal">
            <div class="rv-stars"><?= str_repeat('&#9733;', max(1, min(5, (int) $r['rating']))) ?><?= str_repeat('&#9734;', 5 - max(1, min(5, (int) $r['rating']))) ?></div>
            <p style="font-family:var(--ff-head);font-size:1.05rem;margin-top:10px">«<?= h($r['text']) ?>»</p>
            <p style="color:var(--gold-dark);font-weight:700;margin:0"><?= h($r['author'] ?: 'Участник конкурса') ?></p>
            <p style="color:var(--muted);font-size:.85rem;margin:2px 0 0"><?= h(ru_date($r['created_at'])) ?></p>
            <?php if (!empty($r['admin_reply'])): ?>
              <div class="rv-reply"><b>Ответ Оргкомитета</b><?= h($r['admin_reply']) ?></div>
            <?php endif; ?>
          </div>
        <?php endforeach; ?>
      </div>

      <?php if ($pagesTotal > 1): ?>
        <div class="rv-pager reveal">
          <?php for ($p = 1; $p <= $pagesTotal; $p++): ?>
            <a href="<?= url('/reviews?page=' . $p) ?>" class="<?= $p === $pageNo ? 'active' : '' ?>"><?= $p ?></a>
          <?php endfor; ?>
        </div>
      <?php endif; ?>
    <?php endif; ?>
  </div>
</section>

<section class="section section--parchment">
  <div class="container" style="max-width:640px">
    <div class="card reveal">
      <h3>Оставить отзыв</h3>
      <?php if (!$u): ?>
        <p style="color:var(--ink)">Чтобы оставить отзыв, войдите в личный кабинет.</p>
        <a class="btn btn--primary" href="<?= url('/login?next=' . urlencode('/reviews')) ?>">Войти</a>
        <a class="btn btn--ghost" href="<?= url('/register') ?>">Регистрация</a>
      <?php else: ?>
        <form method="post" action="<?= url('/api/v1/review') ?>">
          <?= csrf_field() ?>
          <div class="field">
            <label for="rv_rating">Оценка</label>
            <select id="rv_rating" name="rating" required>
              <option value="5">5 - отлично</option>
              <option value="4">4 - хорошо</option>
              <option value="3">3 - удовлетворительно</option>
              <option value="2">2</option>
              <option value="1">1</option>
            </select>
          </div>
          <div class="field">
            <label for="rv_text">Ваш отзыв</label>
            <textarea id="rv_text" name="text" rows="5" required></textarea>
            <p class="hint">Отзыв публикуется после проверки Оргкомитетом.</p>
          </div>
          <button class="btn btn--primary btn--block" type="submit">Отправить отзыв</button>
        </form>
      <?php endif; ?>
    </div>
  </div>
</section>
<?php
$content = ob_get_clean();
render_page('Отзывы', $content, ['active' => '/reviews', 'meta' => 'Отзывы участников конкурсов Культурного центра «Музыкальный Мир» и ответы Оргкомитета.']);
