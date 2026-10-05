<?php
/**
 * СОЦСЕТИ — ПУЛЬТ ЕЖЕДНЕВНОГО КОНВЕЙЕРА.
 *
 * Один экран, на котором видно: работает ли конвейер, что уйдёт сегодня и завтра,
 * что уже вышло и где именно, сколько потрачено на картинки.
 *
 * Рубильник намеренно отдельный от правки текстов: конвейер пишет сам, но каждый
 * пост до публикации можно открыть, перечитать и поправить руками. Публикация
 * наружу необратима, поэтому «Опубликовать сейчас» стоит с подтверждением, а
 * очередь показывает тему и источник факта — по ним владелец за секунду видит,
 * не повторяется ли конвейер.
 */
declare(strict_types=1);
require_once BASE_PATH . '/core/smm_make.php';
smm_migrate();

/* Картинка поста лежит в data/, наружу она не отдаётся веб-сервером. Показываем
   её через админку, проверив, что файл действительно принадлежит этому посту —
   иначе параметр превращается в чтение любого файла на диске. */
if (($imgId = (int) input('img')) > 0) {
    $row = one("SELECT image_path FROM smm_posts WHERE id = ?", [$imgId]);
    $path = (string) ($row['image_path'] ?? '');
    if ($path !== '' && is_file($path) && str_starts_with($path, BASE_PATH . '/data/smm/')) {
        header('Content-Type: ' . (mime_content_type($path) ?: 'image/jpeg'));
        header('Cache-Control: private, max-age=600');
        readfile($path);
    } else {
        http_response_code(404);
    }
    exit;
}

/* ---------- Рубильник и настройки ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'settings') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('smm'); }

    set_setting('smm_enabled', input('enabled') ? '1' : '0');
    set_setting('smm_image_budget_day', (string) (float) input('budget'));
    $pages = trim((string) input('pages'));
    if ($pages !== '') set_setting('smm_pages', $pages);

    audit('smm_settings', 'setting', 0, ['enabled' => input('enabled') ? 1 : 0]);

    /* ВКЛЮЧИЛ — ОЧЕРЕДЬ НАБИВАЕТСЯ СРАЗУ.
     * Иначе после щелчка рубильником экран остаётся пустым до следующего часа,
     * и это выглядит как поломка. */
    if (input('enabled')) {
        $cmd = 'setsid nohup php ' . escapeshellarg(BASE_PATH . '/cron/smm_prepare.php')
             . ' >> ' . escapeshellarg(BASE_PATH . '/data/logs/cron.log') . ' 2>&1 & disown';
        @exec($cmd);
        flash('Конвейер включён. Первые посты уже собираются — на один уходит две-три минуты.');
    } else {
        flash('Конвейер выключен. Готовые посты остаются в очереди и никуда не уйдут.');
    }
    admin_redirect('smm');
}

/* ---------- Правка текста поста ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'save') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('smm'); }
    $id   = (int) input('id');
    $body = trim((string) input('body'));
    $post = one("SELECT * FROM smm_posts WHERE id = ?", [$id]);

    if (!$post) { flash('Пост не найден.', 'error'); admin_redirect('smm'); }
    if ((string) $post['status'] === 'published') { flash('Опубликованный пост уже не правится.', 'error'); admin_redirect('smm'); }

    $full = smm_compose($body);
    $err  = smm_validate($body, $full);
    if ($err) {
        flash('Текст не прошёл проверку: ' . implode('; ', $err), 'error');
        admin_redirect('smm');
    }
    update('smm_posts', ['body' => $body, 'text_full' => $full, 'error' => ''], 'id = ?', [$id]);
    audit('smm_edit', 'smm_post', $id, []);
    flash('Текст сохранён.');
    admin_redirect('smm');
}

/* ---------- Ручные действия над постом ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && in_array((string) input('do'), ['publish', 'skip', 'ready'], true)) {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('smm'); }
    $id   = (int) input('id');
    $post = one("SELECT * FROM smm_posts WHERE id = ?", [$id]);
    if (!$post) { flash('Пост не найден.', 'error'); admin_redirect('smm'); }

    if (input('do') === 'skip') {
        update('smm_posts', ['status' => 'skipped'], 'id = ?', [$id]);
        audit('smm_skip', 'smm_post', $id, []);
        flash('Пост снят с очереди.');
    } elseif (input('do') === 'ready') {
        update('smm_posts', ['status' => 'ready', 'error' => ''], 'id = ?', [$id]);
        flash('Пост поставлен в очередь.');
    } else {
        [$ok, $info] = smm_publish($post);
        if ($ok) {
            sleep(15);
            $vk = smm_vk_last_link();
            update('smm_posts', [
                'status' => 'published', 'hooppy_post_id' => (int) $info,
                'vk_link' => $vk, 'error' => '', 'published_at' => date('Y-m-d H:i:s'),
            ], 'id = ?', [$id]);
            audit('smm_publish', 'smm_post', $id, ['hooppy' => $info]);
            flash('Опубликовано.' . ($vk !== '' ? ' ' . $vk : ''));
        } else {
            update('smm_posts', ['error' => (string) $info], 'id = ?', [$id]);
            flash('Не ушло: ' . $info, 'error');
        }
    }
    admin_redirect('smm');
}

/* ---------- Данные экрана ---------- */
$enabled = (int) setting('smm_enabled', '0') === 1;
$budget  = (float) setting('smm_image_budget_day', '0.5');
$pagesS  = (string) setting('smm_pages', '2543792,2561963');
$spent   = smm_spent_today();

$queue = all("SELECT * FROM smm_posts WHERE status IN ('draft','ready','failed')
           ORDER BY slot_date, slot_hour");
$done  = all("SELECT * FROM smm_posts WHERE status = 'published'
           ORDER BY published_at DESC LIMIT 30");

$totalPublished = (int) (scalar("SELECT COUNT(*) FROM smm_posts WHERE status='published'") ?? 0);

$badge = static function (string $st): string {
    return match ($st) {
        'ready'     => '<span class="badge badge--open">в очереди</span>',
        'draft'     => '<span class="badge">черновик</span>',
        'published' => '<span class="badge badge--open">опубликован</span>',
        'failed'    => '<span class="badge badge--closed">сбой</span>',
        'skipped'   => '<span class="badge">снят</span>',
        default     => h($st),
    };
};

ob_start(); ?>

<div class="card" style="margin-bottom:18px">
  <h2 style="margin:0 0 6px">Ежедневный конвейер постов</h2>
  <p style="color:var(--muted);margin:0 0 14px">
    Два поста в день — в 10:00 и 17:00 МСК, с понедельника по субботу.
    Воскресенье пропускается: наружу центр по выходным не пишет.
    Тема каждого поста проверяется против всех вышедших — повторов не бывает.
  </p>

  <form method="post" style="display:flex;gap:14px;flex-wrap:wrap;align-items:flex-end">
    <?= csrf_field() ?><input type="hidden" name="do" value="settings">

    <label style="display:flex;gap:8px;align-items:center">
      <input type="checkbox" name="enabled" value="1"<?= $enabled ? ' checked' : '' ?>>
      <b>Конвейер включён</b>
    </label>

    <label style="display:flex;flex-direction:column;gap:4px">
      <span style="font-size:.82rem;color:var(--muted)">Предел расхода на картинки в сутки</span>
      <input class="inp" name="budget" value="<?= h((string) $budget) ?>" style="max-width:120px">
    </label>

    <label style="display:flex;flex-direction:column;gap:4px">
      <span style="font-size:.82rem;color:var(--muted)">Страницы Hooppy (через запятую)</span>
      <input class="inp" name="pages" value="<?= h($pagesS) ?>" style="max-width:260px">
    </label>

    <button class="btn btn--primary">Сохранить</button>
  </form>

  <p style="margin:14px 0 0;font-size:.86rem;color:var(--muted)">
    Потрачено сегодня: <b><?= number_format($spent, 2, ',', ' ') ?></b> из <?= number_format($budget, 2, ',', ' ') ?>.
    Всего опубликовано: <b><?= $totalPublished ?></b>.
    <?php if ($budget <= 0): ?>
      <br>Предел нулевой — картинки не генерируются, посты остаются черновиками.
    <?php endif; ?>
  </p>
</div>

<h3 style="margin:0 0 10px">Очередь</h3>
<?php if (!$queue): ?>
  <div class="card" style="color:var(--muted)">
    Очередь пуста. Если конвейер включён, ближайший часовой запуск её наполнит.
  </div>
<?php endif; ?>

<?php foreach ($queue as $p): ?>
  <details class="card" style="margin-bottom:10px">
    <summary style="cursor:pointer;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <b><?= h(ru_date((string) $p['slot_date'])) ?>, <?= (int) $p['slot_hour'] ?>:00</b>
      <?= $badge((string) $p['status']) ?>
      <span><?= h((string) $p['topic']) ?></span>
      <span style="color:var(--muted);font-size:.82rem">
        <?= h((string) $p['layer']) ?> · ступень <?= (int) $p['stage'] ?> · <?= h((string) $p['ratio']) ?>
      </span>
    </summary>

    <?php if ((string) $p['error'] !== ''): ?>
      <p style="color:#b00;margin:10px 0 0"><?= h((string) $p['error']) ?></p>
    <?php endif; ?>

    <p style="margin:10px 0 0;font-size:.86rem;color:var(--muted)">
      Факт: <?= h((string) $p['fact']) ?><br>
      Источник: <?= h((string) $p['source']) ?>
    </p>

    <?php $img = (string) $p['image_path']; if ($img !== '' && is_file($img)): ?>
      <img src="<?= h(url('/admin/index.php?p=smm&img=' . (int) $p['id'])) ?>" alt=""
           style="max-width:420px;width:100%;border-radius:10px;margin:12px 0">
    <?php else: ?>
      <p style="margin:12px 0 0;color:var(--muted);font-size:.86rem">Картинки нет — пост не уйдёт, пока она не появится.</p>
    <?php endif; ?>

    <form method="post" style="margin:12px 0 0">
      <?= csrf_field() ?><input type="hidden" name="do" value="save"><input type="hidden" name="id" value="<?= (int) $p['id'] ?>">
      <textarea name="body" class="inp" rows="14" style="width:100%;font-family:inherit"><?= h((string) $p['body']) ?></textarea>
      <p style="margin:6px 0 10px;font-size:.8rem;color:var(--muted)">
        Тело поста, <?= mb_strlen((string) $p['body'], 'UTF-8') ?> знаков.
        Контакты и ссылки добавляются к нему автоматически.
      </p>
      <button class="btn">Сохранить текст</button>
    </form>

    <form method="post" style="margin:10px 0 0;display:flex;gap:8px;flex-wrap:wrap"
          onsubmit="return this.querySelector('[name=do]:focus')?.value!=='publish'||confirm('Опубликовать сейчас в сообщество и канал? Отменить публикацию нельзя.')">
      <?= csrf_field() ?><input type="hidden" name="id" value="<?= (int) $p['id'] ?>">
      <?php if ((string) $p['status'] !== 'ready'): ?>
        <button name="do" value="ready" class="btn">В очередь</button>
      <?php endif; ?>
      <button name="do" value="publish" class="btn btn--primary">Опубликовать сейчас</button>
      <button name="do" value="skip" class="btn">Снять</button>
    </form>
  </details>
<?php endforeach; ?>

<h3 style="margin:24px 0 10px">Вышло</h3>
<?php if (!$done): ?>
  <div class="card" style="color:var(--muted)">Пока ничего не опубликовано конвейером.</div>
<?php endif; ?>

<?php foreach ($done as $p): ?>
  <div class="card" style="margin-bottom:8px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
    <b style="min-width:150px"><?= h((string) $p['published_at']) ?></b>
    <span style="flex:1 1 240px"><?= h((string) $p['topic']) ?></span>
    <span style="color:var(--muted);font-size:.82rem"><?= h((string) $p['layer']) ?></span>
    <?php if ((string) $p['vk_link'] !== ''): ?>
      <a href="<?= h((string) $p['vk_link']) ?>" target="_blank" rel="noopener" class="btn btn--sm">ВКонтакте</a>
    <?php endif; ?>
  </div>
<?php endforeach; ?>

<?php
$content = ob_get_clean();
admin_layout('Соцсети', $content, 'smm');
