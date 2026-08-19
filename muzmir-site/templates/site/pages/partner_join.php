<?php
/**
 * СОГЛАСИЕ НА ПАРТНЁРСТВО В ОДНО НАЖАТИЕ — страница /partner-join.
 *
 * Раньше учреждение становилось партнёром только так: получить письмо, написать
 * в ответ «согласны», дождаться, пока ответ разберёт почтовый робот. На тысячах
 * отправленных приглашений это не сработало ни разу — отвечать на письмо долго,
 * и делать это в школе обычно некому.
 *
 * Здесь тот же шаг занимает секунды. В письме стоит именная ссылка с подписью;
 * по ней открывается эта страница, где написано, что именно получает учреждение,
 * и стоит одна кнопка. После нажатия сразу выдаются номер соглашения, логин и
 * пароль от кабинета, а сертификат и приветственное письмо уходят на почту
 * учреждения — тем же порядком, что и при приёме через админку.
 *
 * Ссылку нельзя подобрать: подпись считается от id учреждения и секрета сайта.
 * Повторное нажатие ничего не ломает — учреждение уже принято, и страница просто
 * показывает его данные, не выдавая пароль второй раз.
 */
declare(strict_types=1);

require_once BASE_PATH . '/core/partner.php';
require_once BASE_PATH . '/core/mailer.php';

$instId = (int) input('i');
$sig    = trim((string) input('s'));
$inst   = partner_join_check($instId, $sig);

$done = false; $pass = ''; $already = false; $error = '';

if (!$inst) {
    $error = 'Ссылка недействительна или устарела. Напишите нам, и мы вышлем новую.';
} elseif (($inst['partner_status'] ?? '') === 'blocked') {
    $error = 'Партнёрство этого учреждения приостановлено. Свяжитесь с оргкомитетом.';
} elseif (($inst['partner_status'] ?? '') === 'accepted') {
    $already = true;
} elseif (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' && csrf_check()) {
    try {
        $res  = partner_accept($instId);
        $inst = $res['inst'];
        $pass = (string) $res['password_plain'];
        $done = true;
        // Сертификат, персональная ссылка, доступ в кабинет — одним письмом.
        try { partner_send_welcome($instId, $pass); } catch (\Throwable $e) {}
        if (function_exists('site_event')) site_event('partner_join', '/partner-join', ['inst' => $instId]);
    } catch (\Throwable $e) {
        $error = 'Не удалось оформить партнёрство. Попробуйте ещё раз или напишите нам.';
    }
}

$site  = rtrim((string) cfgv('base_url'), '/');
$phone = (string) cfgv('org_phone', '');
$email = (string) cfgv('org_email', '');

ob_start(); ?>
<section class="section">
  <div class="container" style="max-width:760px">

    <?php if ($error !== ''): ?>
      <div class="card" style="padding:26px">
        <h1 style="margin:0 0 10px;font-size:1.35rem">Партнёрская программа</h1>
        <p style="margin:0 0 14px"><?= h($error) ?></p>
        <p class="muted small" style="margin:0">
          <?= h($phone) ?><?= ($phone !== '' && $email !== '') ? ' · ' : '' ?><?= h($email) ?>
        </p>
      </div>

    <?php elseif ($done || $already): ?>
      <div class="card" style="padding:26px">
        <h1 style="margin:0 0 6px;font-size:1.35rem">
          <?= $already ? 'Учреждение уже в партнёрской программе' : 'Готово, вы в партнёрской программе' ?>
        </h1>
        <p style="margin:0 0 18px"><b><?= h((string) $inst['name']) ?></b></p>

        <div style="display:grid;gap:10px;margin:0 0 18px">
          <div><span class="muted small">Номер соглашения</span><br><b><?= h((string) $inst['partner_no']) ?></b></div>
          <div><span class="muted small">Персональная ссылка для ваших участников</span><br>
            <a href="<?= h($site . '/p/' . (string) $inst['partner_slug']) ?>"><?= h($site . '/p/' . (string) $inst['partner_slug']) ?></a>
          </div>
          <div><span class="muted small">Вход в кабинет партнёра</span><br>
            <?php /* Именно ?a=login: без него роутер отдаёт публичную страницу
                     программы, а не форму входа, и партнёр упирается в тупик. */ ?>
            <a href="<?= h($site . '/partner?a=login') ?>"><?= h($site . '/partner?a=login') ?></a>,
            логин — почта учреждения <b><?= h((string) $inst['email']) ?></b>
          </div>
          <?php if ($pass !== ''): ?>
            <div><span class="muted small">Пароль (показывается один раз, он же придёт на почту)</span><br>
              <b style="font-size:1.15rem;letter-spacing:.06em"><?= h($pass) ?></b></div>
          <?php endif; ?>
        </div>

        <p style="margin:0 0 14px">
          Сертификат партнёра и приветственное письмо отправлены на
          <b><?= h((string) $inst['email']) ?></b>. Заявки, поданные по вашей персональной
          ссылке, засчитываются учреждению: после пяти можно заказать благодарственные
          письма, после десяти открывается промокод со скидкой для ваших участников.
        </p>

        <a class="btn" href="<?= h($site . '/partner?a=login') ?>">Открыть кабинет партнёра</a>
      </div>

    <?php else: ?>
      <div class="card" style="padding:26px">
        <h1 style="margin:0 0 6px;font-size:1.35rem">Партнёрство с Культурным центром «Музыкальный Мир»</h1>
        <p style="margin:0 0 18px"><b><?= h((string) $inst['name']) ?></b><?php
          $where = trim(((string) $inst['city'] !== '' ? (string) $inst['city'] : (string) $inst['region']));
          if ($where !== '') echo ', ' . h($where); ?></p>

        <p style="margin:0 0 14px">Партнёрство бесплатное и ни к чему не обязывает. Что получает учреждение:</p>
        <ul style="margin:0 0 18px;padding-left:20px;line-height:1.75">
          <li>именной <b>сертификат партнёра</b> с номером в реестре и проверкой подлинности по QR;</li>
          <li><b>персональную ссылку</b>, по которой заявки ваших участников засчитываются учреждению;</li>
          <li><b>кабинет партнёра</b> на сайте: заявки, результаты, документы;</li>
          <li>после 5 заявок — <b>благодарственные письма</b> педагогам и руководителю;</li>
          <li>после 10 заявок — <b>промокод со скидкой</b> для ваших участников;</li>
          <li>приоритетную проверку работ и прямую связь с оргкомитетом.</li>
        </ul>

        <form method="post" style="margin:0">
          <?= csrf_field() ?>
          <button class="btn" type="submit" style="font-size:1.02rem;padding:13px 30px">
            Подтвердить участие в программе
          </button>
        </form>

        <p class="muted small" style="margin:14px 0 0">
          Нажатие означает согласие на партнёрство. Отказаться можно в любой момент,
          написав нам: <?= h($phone) ?><?= ($phone !== '' && $email !== '') ? ' · ' : '' ?><?= h($email) ?>.
        </p>
      </div>
    <?php endif; ?>

  </div>
</section>
<?php
$content = ob_get_clean();
render_page('Партнёрская программа', $content, [
    'active' => '/partner',
    'meta'   => 'Подтверждение партнёрства учреждения с Культурным центром «Музыкальный Мир»: '
              . 'сертификат, персональная ссылка, кабинет партнёра.',
]);
