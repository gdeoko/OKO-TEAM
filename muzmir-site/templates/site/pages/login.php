<?php
/** Вход в личный кабинет: email + пароль. POST обрабатывается здесь. */

// Уже авторизованы - в кабинет.
if (current_user()) redirect('/cabinet');

$next = input('next');
if ($next === '' || $next[0] !== '/' || str_starts_with($next, '//')) $next = '/cabinet';

$email = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = input('email');
    $password = (string)($_POST['password'] ?? '');
    if (!csrf_check()) {
        flash('Сессия устарела. Обновите страницу и попробуйте снова.', 'error');
    } elseif (!rate_ok('login:' . client_ip(), 20, 900)) {
        flash('Слишком много попыток входа. Подождите немного и попробуйте снова.', 'error');
    } else {
        $u = attempt_login($email, $password);
        if ($u) {
            login_user((int)$u['id']);
            audit('login', 'user', (int)$u['id']);
            redirect($next);
        }
        flash('Неверная почта или пароль. Проверьте данные и повторите вход.', 'error');
    }
}

$gicon = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-3l-3.9-3a7.2 7.2 0 0 1-10.7-3.8H1.4v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.4 14.2a7.1 7.1 0 0 1 0-4.5V6.6H1.4a12 12 0 0 0 0 10.8z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8z"/></svg>';
$ticon = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m22 3-9.5 9.5M22 3l-6.5 18-3.5-8-8-3.5L22 3z"/></svg>';

ob_start(); ?>
<section class="section">
  <div class="container" style="max-width:460px">
    <div class="section-head reveal" style="margin-bottom:28px">
      <p class="eyebrow">Личный кабинет</p>
      <h2>Вход</h2>
      <div class="gold-rule"></div>
      <p>Войдите, чтобы отслеживать заявки, результаты и наградные документы.</p>
    </div>

    <div class="card reveal" style="padding:28px">
      <form method="post" action="<?= url('/login') ?>" novalidate>
        <?= csrf_field() ?>
        <input type="hidden" name="next" value="<?= h($next) ?>">
        <div class="field">
          <label for="email">Электронная почта</label>
          <input type="email" id="email" name="email" value="<?= h($email) ?>" placeholder="you@example.ru" autocomplete="email" required>
        </div>
        <div class="field">
          <label for="password">Пароль</label>
          <input type="password" id="password" name="password" placeholder="Ваш пароль" autocomplete="current-password" required>
          <div class="hint"><a href="<?= url('/forgot') ?>">Забыли пароль?</a></div>
        </div>
        <button class="btn btn--primary btn--block btn--lg" type="submit">Войти</button>
      </form>

      <div style="display:flex;align-items:center;gap:12px;margin:22px 0;color:var(--muted);font-size:.85rem">
        <span style="flex:1;height:1px;background:var(--line)"></span>или<span style="flex:1;height:1px;background:var(--line)"></span>
      </div>

      <div style="display:grid;gap:12px">
        <button type="button" class="btn btn--ghost btn--block" onclick="alert('Вход через Google будет доступен в ближайшее время.')"><?= $gicon ?> Войти через Google</button>
        <button type="button" class="btn btn--ghost btn--block" onclick="alert('Вход через Telegram будет доступен в ближайшее время.')"><?= $ticon ?> Войти через Telegram</button>
      </div>

      <p style="text-align:center;margin:20px 0 0;color:var(--muted)">
        Нет аккаунта? <a href="<?= url('/register') ?>">Зарегистрируйтесь</a>
      </p>
    </div>
  </div>
</section>
<?php
$content = ob_get_clean();
render_page('Вход', $content, ['active' => '/login', 'meta' => 'Вход в личный кабинет участника КЦ «Музыкальный Мир».']);
