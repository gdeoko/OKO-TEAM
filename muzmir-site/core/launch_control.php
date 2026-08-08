<?php
/**
 * ПАНЕЛЬ УПРАВЛЕНИЯ ЗАПУСКОМ (режим «кампания идёт»).
 *
 * Пульт запуска (launch_panel_html) отвечает на вопрос «как стартовать».
 * Эта панель отвечает на вопрос «что происходит сейчас и как этим управлять»:
 *
 *   • состояние кампании: идёт / на паузе, дата старта, главный выключатель
 *     массовых коммуникаций (стоп-кран);
 *   • лента волн месяца (открытие → 3 дня → последний день → закрытие → результаты):
 *     что выполнено, что запланировано и на когда, с действиями по каждой волне —
 *     выполнить сейчас, перенести, отменить, вернуть в план;
 *   • рассылки: сколько ушло сегодня и всего по каждому типу (конкурсы/ВИП/кабинет),
 *     дневные квоты, остаток очереди, состояние почтовых ящиков;
 *   • итоги кампании: посты, письма, уведомления, заявки за период.
 *
 * Панель ничего не отправляет сама — только показывает и передаёт команды
 * в launch_fire()/launch_jobs. Все действия идут через admin/launch.php.
 */
declare(strict_types=1);

require_once __DIR__ . '/launch_run.php';

/** Идёт ли сейчас кампания: есть выполненные или запланированные задания. */
function launch_campaign_active(): bool {
    launch_migrate();
    return (int) scalar("SELECT COUNT(*) FROM launch_jobs WHERE status IN ('scheduled','done')") > 0;
}

/** Дата старта текущей кампании (первое выполненное задание) или ''. */
function launch_campaign_started_at(): string {
    launch_migrate();
    return (string) (scalar("SELECT MIN(COALESCE(done_at, run_at)) FROM launch_jobs WHERE status='done'") ?? '');
}

/** Человеческое имя волны для панели управления. */
function launch_wave_title(string $wave): string {
    return [
        'launch_vk'        => 'Посты ВКонтакте: открытие конкурсов',
        'launch_mail'      => 'Письмо по базе: новые конкурсы (афиши)',
        'campaign_vip'     => 'Письмо по базе: ВИП-клуб',
        'campaign_kabinet' => 'Письмо по базе: личный кабинет',
        'launch'           => 'Открытие · приём заявок',
        'd3'               => 'Осталось 3 дня (22-е, 09:00)',
        'last'             => 'Последний день (25-е, 09:00)',
        'closed'           => 'Приём закрыт (25-е, 18:00)',
        'results'          => 'Результаты длинного конкурса (28-е, 09:00)',
    ][$wave] ?? $wave;
}

/** Пояснение, что именно делает волна — чтобы не держать это в голове. */
function launch_wave_note(string $wave): string {
    return [
        'launch_vk'        => 'По одному посту на конкурс: стена сообщества, сторис и рассылка в личку — с афишей и текстом конкурса.',
        'launch_mail'      => 'Одно письмо со всеми афишами месяца по всей базе + уведомление в личный кабинет. Квота — своя, см. ниже.',
        'campaign_vip'     => 'Приглашение в ВИП-клуб по всей базе (кроме действующих членов клуба).',
        'campaign_kabinet' => 'Разовая волна: логин и пароль от личного кабинета. В следующем месяце не повторяется.',
        'd3'               => 'Напоминание, что до конца приёма три дня: ВК и уведомления в кабинете.',
        'last'             => 'Последний день приёма заявок: ВК и уведомления.',
        'closed'           => 'Приём закрывается автоматически: конкурсы уходят с афиши, из календаря и из формы подачи. Заказ наград остаётся открытым 60 дней.',
        'results'          => 'Итоги длинного конкурса: пост ВК со списком, персональные письма участникам, публикация списка на сайте и уведомления в кабинете.',
    ][$wave] ?? '';
}

/** Все задания текущей кампании, сгруппированные по волне. */
function launch_jobs_grouped(): array {
    launch_migrate();
    $rows = all("SELECT j.*, c.name AS comp_name
                   FROM launch_jobs j LEFT JOIN competitions c ON c.id = j.competition_id
                  WHERE j.status IN ('scheduled','done','cancelled')
                  ORDER BY j.run_at ASC, j.id ASC");
    $order = ['launch_vk' => 1, 'launch_mail' => 2, 'campaign_vip' => 3, 'campaign_kabinet' => 4,
              'launch' => 5, 'd3' => 6, 'last' => 7, 'closed' => 8, 'results' => 9];
    $g = [];
    foreach ($rows as $r) {
        $w = (string) $r['wave'];
        if (!isset($g[$w])) $g[$w] = ['wave' => $w, 'items' => [], 'done' => 0, 'scheduled' => 0, 'cancelled' => 0, 'run_at' => (string) $r['run_at']];
        $g[$w]['items'][] = $r;
        $g[$w][(string) $r['status']]++;
        if ((string) $r['status'] === 'scheduled' && (string) $r['run_at'] < $g[$w]['run_at']) $g[$w]['run_at'] = (string) $r['run_at'];
    }
    uasort($g, fn($a, $b) => ($order[$a['wave']] ?? 99) <=> ($order[$b['wave']] ?? 99));
    return $g;
}

/** Сводка по массовым рассылкам: квоты, отправлено, остаток. */
function launch_mail_stats(): array {
    if (!function_exists('nl_daily_split')) require_once __DIR__ . '/newsletter.php';
    $split = nl_daily_split();
    $out = [];
    foreach (['konkurs' => 'Новые конкурсы', 'vip' => 'ВИП-клуб', 'kabinet' => 'Личный кабинет'] as $t => $lbl) {
        $quota = (int) ($split[$t] ?? 0);
        if ($quota <= 0 && $t === 'kabinet') continue;      // волна кабинета уже отработала
        $sentToday = function_exists('nl_bulk_sent_today_type') ? (int) nl_bulk_sent_today_type($t) : 0;
        $queued = (int) (scalar(
            "SELECT COUNT(*) FROM mail_queue q LEFT JOIN newsletters n ON n.id = q.newsletter_id
              WHERE q.status IN ('queued','paused') AND COALESCE(q.priority,0) > 0
                AND COALESCE(q.campaign_type, n.campaign_type, 'konkurs') = ?", [$t]) ?? 0);
        $sentAll = (int) (scalar(
            "SELECT COUNT(*) FROM mail_queue q LEFT JOIN newsletters n ON n.id = q.newsletter_id
              WHERE q.status = 'sent' AND COALESCE(q.priority,0) > 0
                AND COALESCE(q.campaign_type, n.campaign_type, 'konkurs') = ?", [$t]) ?? 0);
        $out[$t] = ['label' => $lbl, 'quota' => $quota, 'today' => $sentToday,
                    'queued' => $queued, 'sent_all' => $sentAll];
    }
    return $out;
}

/** Состояние почтовых ящиков (кто в карантине). */
function launch_mailbox_stats(): array {
    if (!function_exists('mail_fallback_accounts')) require_once __DIR__ . '/mailer.php';
    $out = [];
    foreach (mail_fallback_accounts() as $a) {
        $u = mb_strtolower((string) ($a['user'] ?? ''));
        if ($u === '') continue;
        $out[] = [
            'user'  => $u,
            'fails' => (int) setting('mailfail:' . $u, '0'),
            'quarantined' => function_exists('mail_account_penalty') ? (bool) mail_account_penalty($a) : false,
        ];
    }
    return $out;
}

/** Короткая дата-время для панели. */
function lc_dt(string $s): string {
    $s = trim($s);
    if ($s === '') return '—';
    $ts = strtotime($s);
    return $ts ? date('d.m.Y H:i', $ts) : $s;
}

/**
 * HTML панели управления запуском.
 * Все действия отправляются в admin/launch.php (do=ctl_*).
 */
function launch_control_html(): string {
    $active   = mass_sending_enabled();
    $started  = launch_campaign_started_at();
    $groups   = launch_jobs_grouped();
    $mail     = launch_mail_stats();
    $boxes    = launch_mailbox_stats();
    $comps    = launch_open_comps();
    $csrf     = function_exists('csrf_field') ? csrf_field() : '';

    // Итоги кампании.
    $doneJobs = (int) scalar("SELECT COUNT(*) FROM launch_jobs WHERE status='done'");
    $planJobs = (int) scalar("SELECT COUNT(*) FROM launch_jobs WHERE status='scheduled'");
    $appsAfter = $started !== ''
        ? (int) (scalar("SELECT COUNT(*) FROM applications WHERE created_at >= ?", [$started]) ?? 0)
        : 0;
    $mailsSent = (int) (scalar("SELECT COUNT(*) FROM mail_queue WHERE status='sent'" . ($started !== '' ? " AND sent_at >= ?" : ''),
                               $started !== '' ? [$started] : []) ?? 0);

    ob_start(); ?>
<div class="page-head">
  <h1>Управление запуском</h1>
  <p class="muted small">
    Кампания месяца: что уже отработало, что стоит в плане и как этим управлять.
    Ничего не уходит само, пока массовые коммуникации выключены.
  </p>
</div>

<!-- ============ ГЛАВНЫЙ ВЫКЛЮЧАТЕЛЬ ============ -->
<div class="card" style="margin-bottom:18px;border-left:4px solid <?= $active ? '#1E9E5A' : '#C0392B' ?>">
  <div style="display:flex;gap:18px;flex-wrap:wrap;align-items:center;justify-content:space-between">
    <div style="min-width:0">
      <b style="font-size:1.05rem"><?= $active ? 'Массовые коммуникации включены' : 'Массовые коммуникации выключены' ?></b>
      <div class="small muted" style="margin-top:4px;max-width:640px">
        <?php if ($active): ?>
          Рассылки по базе, посты ВК и волны кампании идут по расписанию.
          Личные письма (результаты, дипломы, счета) работают всегда — независимо от этого выключателя.
        <?php else: ?>
          Наружу не уходит ничего массового: рассылки ждут в очереди, посты и волны не публикуются.
          Личные письма участникам при этом отправляются как обычно.
        <?php endif; ?>
      </div>
      <?php if ($started !== ''): ?>
        <div class="small muted" style="margin-top:6px">Кампания стартовала <?= h(lc_dt($started)) ?></div>
      <?php endif; ?>
    </div>
    <form method="post" action="<?= url('/admin/?p=launch') ?>" style="display:flex;gap:8px;align-items:center">
      <?= $csrf ?><input type="hidden" name="do" value="ctl_mass">
      <?php if ($active): ?>
        <button name="on" value="0" class="btn btn--ghost" style="color:#C0392B;border-color:#C0392B"
                onclick="return confirm('Остановить все массовые рассылки и посты? Личные письма продолжат работать.')">
          Остановить всё
        </button>
      <?php else: ?>
        <button name="on" value="1" class="btn btn--primary"
                onclick="return confirm('Включить массовые рассылки и публикации? Начнётся отправка по расписанию и квотам.')">
          Включить рассылки
        </button>
      <?php endif; ?>
    </form>
  </div>
</div>

<!-- ============ ИТОГИ ============ -->
<div class="stats" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:18px">
  <div class="card" style="text-align:center"><b style="font-size:1.6rem"><?= $doneJobs ?></b><div class="small muted">волн выполнено</div></div>
  <div class="card" style="text-align:center"><b style="font-size:1.6rem"><?= $planJobs ?></b><div class="small muted">в плане</div></div>
  <div class="card" style="text-align:center"><b style="font-size:1.6rem"><?= $mailsSent ?></b><div class="small muted">писем отправлено</div></div>
  <div class="card" style="text-align:center"><b style="font-size:1.6rem"><?= $appsAfter ?></b><div class="small muted">заявок с начала</div></div>
  <div class="card" style="text-align:center"><b style="font-size:1.6rem"><?= count($comps) ?></b><div class="small muted">конкурсов в приёме</div></div>
</div>

<!-- ============ ЛЕНТА ВОЛН ============ -->
<div class="card" style="margin-bottom:18px">
  <div class="section-title"><h3>План кампании</h3></div>
  <p class="small muted" style="margin:-4px 0 14px">
    Каждая волна выполняется автоматически в своё время. Можно выполнить раньше, перенести или убрать из плана.
  </p>

  <?php if (!$groups): ?>
    <p class="muted">Кампания ещё не запланирована.</p>
  <?php else: foreach ($groups as $w => $g):
    $isDone = $g['done'] > 0 && $g['scheduled'] === 0;
    $isCancelled = $g['cancelled'] > 0 && $g['done'] === 0 && $g['scheduled'] === 0;
    $tone = $isDone ? 'made' : ($isCancelled ? 'rejected' : 'making');
    $lbl  = $isDone ? 'Выполнено' : ($isCancelled ? 'Убрано из плана' : 'В плане');
    $first = $g['items'][0]; ?>
    <div style="border:1px solid var(--a-line);border-radius:12px;padding:14px 16px;margin-bottom:12px">
      <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start;justify-content:space-between">
        <div style="min-width:0;flex:1 1 320px">
          <b><?= h(launch_wave_title($w)) ?></b>
          <span class="badge badge--<?= $tone ?>" style="margin-left:8px"><?= $lbl ?></span>
          <?php if (count($g['items']) > 1): ?>
            <span class="small muted">· <?= count($g['items']) ?> шт.</span>
          <?php endif; ?>
          <div class="small muted" style="margin-top:5px;line-height:1.5"><?= h(launch_wave_note($w)) ?></div>
          <div class="small" style="margin-top:6px">
            <?php if ($isDone): ?>
              Отработало <?= h(lc_dt((string) ($first['done_at'] ?? $first['run_at']))) ?>
            <?php else: ?>
              Запланировано на <b><?= h(lc_dt((string) $g['run_at'])) ?></b>
            <?php endif; ?>
            <span class="muted">· каналы: <?= h(str_replace(
                ['vk_wall','vk_dm','email','inapp'],
                ['ВК стена','ВК личка','почта','кабинет'],
                (string) $first['channels'])) ?></span>
          </div>
        </div>

        <?php if (!$isDone): ?>
        <form method="post" action="<?= url('/admin/?p=launch') ?>" style="display:flex;gap:6px;flex-wrap:wrap;align-items:center">
          <?= $csrf ?><input type="hidden" name="wave" value="<?= h($w) ?>">
          <?php if (!$isCancelled): ?>
            <input type="datetime-local" name="run_at" value="<?= h(date('Y-m-d\TH:i', strtotime((string) $g['run_at']) ?: time())) ?>">
            <button name="do" value="ctl_move" class="btn btn--ghost btn--sm">Перенести</button>
            <button name="do" value="ctl_now" class="btn btn--primary btn--sm"
                    onclick="return confirm('Выполнить волну прямо сейчас? Публикации и письма уйдут немедленно.')">Выполнить сейчас</button>
            <button name="do" value="ctl_cancel" class="btn btn--ghost btn--sm" style="color:#C0392B;border-color:#C0392B"
                    onclick="return confirm('Убрать волну из плана?')">Убрать</button>
          <?php else: ?>
            <input type="datetime-local" name="run_at" value="<?= h(date('Y-m-d\TH:i', strtotime((string) $g['run_at']) ?: time())) ?>">
            <button name="do" value="ctl_restore" class="btn btn--navy btn--sm">Вернуть в план</button>
          <?php endif; ?>
        </form>
        <?php endif; ?>
      </div>

      <?php if (count($g['items']) > 1): ?>
        <div class="small muted" style="margin-top:8px">
          <?php foreach ($g['items'] as $it): ?>
            <span class="tag" style="margin:2px 4px 2px 0"><?= h((string) ($it['comp_name'] ?? ('#' . $it['competition_id']))) ?></span>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>
    </div>
  <?php endforeach; endif; ?>
</div>

<!-- ============ РАССЫЛКИ ============ -->
<div class="card" style="margin-bottom:18px">
  <div class="section-title"><h3>Рассылки по базе</h3></div>
  <p class="small muted" style="margin:-4px 0 12px">
    Каждый шаблон идёт по всей базе со своей дневной нормой. Пока норма не исчерпана, письма уходят;
    остаток ждёт следующего дня — база проходится постепенно, без риска для репутации.
  </p>
  <div class="table-wrap"><table class="tbl">
    <thead><tr><th>Шаблон</th><th>Норма в день</th><th>Ушло сегодня</th><th>Ждут в очереди</th><th>Отправлено всего</th><th></th></tr></thead>
    <tbody>
    <?php foreach ($mail as $t => $m):
      $pct = $m['quota'] > 0 ? min(100, (int) round($m['today'] / $m['quota'] * 100)) : 0; ?>
      <tr>
        <td><b><?= h($m['label']) ?></b></td>
        <td><?= (int) $m['quota'] ?></td>
        <td>
          <?= (int) $m['today'] ?>
          <div style="height:5px;background:var(--a-line);border-radius:3px;margin-top:5px;overflow:hidden;max-width:120px">
            <i style="display:block;height:100%;width:<?= $pct ?>%;background:var(--a-navy)"></i>
          </div>
        </td>
        <td><?= (int) $m['queued'] ?></td>
        <td><?= (int) $m['sent_all'] ?></td>
        <td>
          <a class="btn btn--ghost btn--sm" target="_blank" rel="noopener"
             href="<?= a_link('launch', ['do' => 'email_preview_campaign', 'ctype' => $t]) ?>">Посмотреть письмо</a>
        </td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table></div>
</div>

<!-- ============ ПОЧТОВЫЕ ЯЩИКИ ============ -->
<div class="card" style="margin-bottom:18px">
  <div class="section-title"><h3>Почтовые ящики</h3></div>
  <p class="small muted" style="margin:-4px 0 12px">
    Письмо уходит с первого рабочего ящика. Если почтовик отказывает подряд, ящик уходит в конец очереди
    на час — канал сам обходит проблему, письма не теряются.
  </p>
  <div class="table-wrap"><table class="tbl">
    <thead><tr><th>Ящик</th><th>Отказов подряд</th><th>Состояние</th></tr></thead>
    <tbody>
    <?php foreach ($boxes as $b): ?>
      <tr>
        <td class="small"><?= h($b['user']) ?></td>
        <td class="small"><?= (int) $b['fails'] ?></td>
        <td class="small">
          <?php if ($b['quarantined']): ?>
            <span class="badge badge--rejected">в карантине — идёт последним</span>
          <?php elseif ($b['fails'] > 0): ?>
            <span class="badge badge--making">есть отказы</span>
          <?php else: ?>
            <span class="badge badge--made">рабочий</span>
          <?php endif; ?>
        </td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table></div>
</div>

<!-- ============ ЗАВЕРШЕНИЕ ============ -->
<div class="card">
  <div class="section-title"><h3>Завершить кампанию</h3></div>
  <p class="small muted" style="margin:-4px 0 12px">
    Убирает из плана всё невыполненное и возвращает пульт в режим подготовки следующего запуска.
    История выполненных волн сохраняется.
  </p>
  <form method="post" action="<?= url('/admin/?p=launch') ?>">
    <?= $csrf ?>
    <button name="do" value="ctl_finish" class="btn btn--ghost" style="color:#C0392B;border-color:#C0392B"
            onclick="return confirm('Завершить кампанию и вернуться к пульту запуска? Незавершённые волны будут убраны из плана.')">
      Завершить и вернуться к пульту запуска
    </button>
  </form>
</div>
<?php
    return (string) ob_get_clean();
}
