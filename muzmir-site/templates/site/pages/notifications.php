<?php
/** Уведомления пользователя (in-app), с кнопкой «Отметить все прочитанными». */
require_login();
require_once BASE_PATH . '/core/notifications.php';
$user = current_user();
$uid  = (int) $user['id'];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (csrf_check()) {
        if (input('action') === 'read_all') notify_mark_read_all($uid);
        elseif (input('action') === 'read_one') notify_mark_read($uid, (int) input('id'));
    }
    redirect('/notifications');
}

// При открытии — считаем показанные как «прочитанные» через 3 сек JS-таймером (см. ниже)
$list = notify_list($uid, 100);
$unread = notify_unread_count($uid);

$iconSvgs = [
  'bell'    => '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/>',
  'trophy'  => '<path d="M6 4h12v4a6 6 0 0 1-12 0zM4 6h2v2a3 3 0 0 1-2 0zm14 0h2v2a3 3 0 0 1-2 0z"/><path d="M9 15h6v3H9zM7 18h10v3H7z"/>',
  'diploma' => '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15l2 2 4-4"/>',
  'pay'     => '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M6 15h4"/>',
  'star'    => '<path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/>',
];

ob_start(); ?>
<section class="section" style="padding-top:22px">
  <div class="container" style="max-width:640px">
    <a class="aw-back" href="<?= url('/menu') ?>"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>Назад</a>
    <div class="section-head" style="text-align:left;margin-bottom:18px">
      <p class="eyebrow">Активность</p>
      <h1 style="font-family:var(--ff-display);font-size:clamp(1.6rem,5vw,2.2rem);margin:0 0 6px;
        background:var(--grad-gold);-webkit-background-clip:text;background-clip:text;color:transparent">Уведомления</h1>
      <?php if ($unread > 0): ?>
        <p style="color:var(--muted);margin:0 0 12px"><?= (int)$unread ?> непрочитанных</p>
        <form method="post" action="<?= url('/notifications') ?>" style="margin:0">
          <?= csrf_field() ?><input type="hidden" name="action" value="read_all">
          <button class="btn btn--ghost btn--sm" type="submit" style="min-height:36px">Отметить все прочитанными</button>
        </form>
      <?php endif; ?>
    </div>

    <?php if (!$list): ?>
      <div class="card" style="text-align:center;padding:44px 20px">
        <svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke="currentColor" stroke-width="1.5" style="opacity:.4;margin-bottom:14px" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>
        <p style="color:var(--muted);margin:0">Пока пусто. Как только придёт статус по заявке — покажем здесь.</p>
      </div>
    <?php else: ?>
      <div class="notif-list">
        <?php foreach ($list as $n):
          $svg = $iconSvgs[$n['icon'] ?? 'bell'] ?? $iconSvgs['bell'];
          $unreadCls = (int)$n['is_read'] ? '' : ' unread';
        ?>
          <?php $tag = !empty($n['url']) ? 'a' : 'div'; ?>
          <<?= $tag ?> class="notif-item<?= $unreadCls ?>"<?php if (!empty($n['url'])): ?> href="<?= h($n['url']) ?>"<?php endif; ?>>
            <div class="notif-ic">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><?= $svg ?></svg>
            </div>
            <div class="notif-body">
              <b><?= h($n['title']) ?></b>
              <?php if (!empty($n['body'])): ?><span><?= h($n['body']) ?></span><?php endif; ?>
              <time><?= h(ru_relative_time($n['created_at'] ?? '')) ?></time>
            </div>
            <?php if (!(int)$n['is_read']): ?><span class="notif-dot" aria-label="Не прочитано"></span><?php endif; ?>
          </<?= $tag ?>>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>
</section>

<script>
// Автоматически помечаем показанные уведомления прочитанными через 3 секунды
setTimeout(function(){
  if (document.querySelector('.notif-item.unread')) {
    fetch('/notifications', {
      method:'POST',
      credentials:'same-origin',
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body: 'action=read_all&_csrf=' + encodeURIComponent(document.querySelector('meta[name=csrf-token]')?.content || '')
    }).catch(function(){});
  }
}, 3000);
</script>
<?php
$content = ob_get_clean();
render_page('Уведомления', $content, ['active' => '/notifications', 'meta' => 'Активность и уведомления по Вашим заявкам, дипломам, оплатам — КЦ «Музыкальный Мир».']);
