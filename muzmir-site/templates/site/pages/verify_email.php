<?php
/** Подтверждение почты: GET ?token= → находит users.verify_token, ставит email_verified=1, чистит токен, вход. */

$token = input('token');
if ($token !== '') {
    $u = one("SELECT * FROM users WHERE verify_token=? AND verify_token<>''", [$token]);
    if ($u) {
        update('users', ['email_verified' => 1, 'verify_token' => ''], 'id=:id', ['id' => (int)$u['id']]);
        audit('verify_email', 'user', (int)$u['id']);
        if (!current_user()) login_user((int)$u['id']);
        flash('Почта подтверждена. Личный кабинет полностью открыт.', 'success');
        redirect('/cabinet');
    }
}

// Токен пустой или недействительный.
$xicon = '<svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke="var(--gold-2)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>';

ob_start(); ?>
<section class="section auth-page">
  <div class="container" style="max-width:440px">
    <div class="card reveal auth-shell" style="padding:34px 26px 30px;text-align:center">
      <img src="<?= asset('img/logo_muzmir_256.png') ?>" alt="КЦ «Музыкальный Мир»" width="64" height="64"
           style="width:64px;height:64px;border-radius:50%;border:1px solid var(--glass-brd);margin:0 auto 12px;display:block">
      <p class="eyebrow" style="margin-bottom:2px">Личный кабинет</p>
      <h1 style="font-size:1.7rem;margin:0 0 14px">Ссылка недействительна</h1>
      <div style="margin-bottom:14px"><?= $xicon ?></div>
      <p style="margin:0 0 8px">Ссылка подтверждения устарела или уже была использована.</p>
      <p style="margin:0 0 22px;color:var(--muted)">Войдите в кабинет - если почта ещё не подтверждена, мы вышлем новое письмо.</p>
      <div style="display:grid;gap:12px">
        <a class="btn btn--primary btn--block" href="<?= url('/login') ?>">Войти</a>
        <a class="btn btn--ghost btn--block" href="<?= url('/register') ?>">Создать аккаунт</a>
      </div>
    </div>
  </div>
</section>
<?php
$content = ob_get_clean();
render_page('Подтверждение почты', $content, ['active' => '/login', 'meta' => 'Подтверждение адреса электронной почты участника КЦ «Музыкальный Мир».']);
