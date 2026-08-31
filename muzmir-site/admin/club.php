<?php
/**
 * ВИП-КЛУБ: КТО КУПИЛ, ДО КАКОГО ЧИСЛА И ЧТО У НЕГО ПРОИСХОДИТ.
 *
 * Членство в клубе видно было только по галочке рядом с фамилией: чтобы узнать,
 * когда человек вступил, до какого числа действует членство и что у него в работе,
 * приходилось открывать четыре разных раздела и сводить руками.
 *
 * Здесь всё в одном месте:
 *   • список членов клуба — когда вступил, до какого числа, автопродление, период;
 *   • по каждому — заявки на участие, заказы электронных наград и оригиналов;
 *   • карточка участника: все его заявки со званиями и переход прямо в оценку
 *     (короткие конкурсы — «Оценка коротких», длинные — «Оценка длинных»),
 *     а также его заказы наград со ссылками в нужный раздел.
 *
 * Только чтение и переходы: продлевать и отменять членство отсюда нельзя —
 * это движение денег, оно живёт в оплате и в разделе «Пользователи».
 */
declare(strict_types=1);

require_once BASE_PATH . '/core/club.php';
require_once BASE_PATH . '/core/orders.php';
club_boot();
orders_migrate();

/** Дата членства → человеческий вид. В базе она в UTC (см. core/club.php). */
$clubDate = static function (?string $utc, bool $withTime = false): string {
    $utc = trim((string) $utc);
    if ($utc === '') return '—';
    $ts = function_exists('club_ts') ? club_ts($utc) : (int) strtotime($utc);
    if ($ts <= 0) return '—';
    return date($withTime ? 'd.m.Y H:i' : 'd.m.Y', $ts);
};

/** Сколько дней осталось (отрицательное — сколько прошло с окончания). */
$daysLeft = static function (?string $utc): ?int {
    $utc = trim((string) $utc);
    if ($utc === '') return null;
    $ts = function_exists('club_ts') ? club_ts($utc) : (int) strtotime($utc);
    if ($ts <= 0) return null;
    return (int) floor(($ts - time()) / 86400);
};

/** Раздел оценки под конкурс: длинные (results_mode='list') — свой раздел. */
$gradeLink = static function (array $a): string {
    return (string) ($a['results_mode'] ?? '') === 'list'
        ? a_link('longcomp', ['comp' => (int) ($a['competition_id'] ?? 0), 'id' => (int) $a['id']])
        : a_link('grading', ['id' => (int) $a['id']]);
};

/** Заказы наград одного участника, разложенные на электронные и оригиналы. */
$ordersOf = static function (int $uid, string $email): array {
    $out = ['digital' => [], 'original' => [], 'club' => [], 'sum' => 0];
    if ($uid <= 0 && $email === '') return $out;
    try {
        $rows = all("SELECT * FROM awards_orders
                      WHERE (user_id = ? OR (? <> '' AND mb_lower(COALESCE(email,'')) = ?))
                      ORDER BY id DESC", [$uid, $email, mb_strtolower($email)]);
    } catch (\Throwable $e) { return $out; }
    foreach ($rows as $o) {
        $paid = in_array((string) $o['status'], ['paid', 'made', 'shipped', 'delivered'], true);
        if ($paid) $out['sum'] += (int) $o['amount'] - (int) ($o['refund_amount'] ?? 0);
        $kinds = [];
        foreach ((array) json_decode((string) ($o['items'] ?? '[]'), true) as $it) {
            if (is_array($it)) $kinds[(string) ($it['kind'] ?? '')] = true;
        }
        /* Покупка самого членства — не наградный материал: она сюда попадала и
         * читалась как «заказал электронную награду». Её место в оплате клуба. */
        if (isset($kinds['club'])) { $out['club'][] = $o; continue; }
        // Смешанный заказ попадает в оба списка: в нём есть и то, и другое.
        if (isset($kinds['digital'])) $out['digital'][] = $o;
        if (isset($kinds['original'])) $out['original'][] = $o;
        if (!isset($kinds['digital']) && !isset($kinds['original'])) $out['digital'][] = $o;
    }
    return $out;
};

/** Короткая подпись состава заказа. */
$itemsBrief = static function (array $o): string {
    $names = [];
    foreach ((array) json_decode((string) ($o['items'] ?? '[]'), true) as $it) {
        if (!is_array($it)) continue;
        $n = trim((string) ($it['item'] ?? ''));
        if ($n === '') continue;
        $names[] = $n . ((string) ($it['kind'] ?? '') === 'original' ? ' (оригинал)' : '');
    }
    return $names ? implode(', ', $names) : '—';
};

/** Русская подпись статуса заказа. */
$statusRu = static function (string $s): array {
    return match ($s) {
        'paid'      => ['Оплачен', 'badge--gold'],
        'made'      => ['Изготовлен', 'badge--gold'],
        'shipped'   => ['Отправлен', 'badge--gold'],
        'delivered' => ['Доставлен', 'badge--gold'],
        'canceled'  => ['Отменён', 'badge--rejected'],
        default     => ['Ожидает оплаты', ''],
    };
};

/* ==================== КАРТОЧКА ОДНОГО УЧАСТНИКА КЛУБА ==================== */
$viewUid = (int) input('user');
if ($viewUid > 0) {
    $u = one("SELECT * FROM users WHERE id=?", [$viewUid]);
    if (!$u) { flash('Участник не найден.', 'error'); admin_redirect('club'); }
    $st    = club_status($viewUid);
    $email = mb_strtolower(trim((string) ($u['email'] ?? '')));
    $apps  = all("SELECT a.*, c.name AS comp, c.results_mode, c.is_paid AS comp_paid
                    FROM applications a LEFT JOIN competitions c ON c.id = a.competition_id
                   WHERE a.user_id = ? ORDER BY a.id DESC", [$viewUid]);
    $ord   = $ordersOf($viewUid, $email);
    $left  = $daysLeft($st['expires_at'] ?? null);
    ?>
    <div class="page-head">
      <div>
        <h1><?= h(trim((string) ($u['full_name'] ?? '')) ?: (string) $u['email']) ?></h1>
        <div class="small muted">
          <?= h((string) $u['email']) ?>
          <?php if (trim((string) ($u['phone'] ?? '')) !== ''): ?> · <?= h((string) $u['phone']) ?><?php endif; ?>
          · карта <?= h(club_card_no($viewUid)) ?>
        </div>
      </div>
      <a class="btn btn--ghost" href="<?= a_link('club') ?>"><?= admin_icon('back') ?>К списку клуба</a>
    </div>

    <div class="cards" style="margin-bottom:18px">
      <div class="card">
        <div class="card__t">Членство</div>
        <div class="card__v">
          <?php if (!empty($st['staff'])): ?>
            <span class="badge badge--gold">Команда центра</span>
          <?php elseif (!empty($st['active'])): ?>
            <span class="badge badge--gold">Действует</span>
          <?php else: ?>
            <span class="badge badge--rejected">Не действует</span>
          <?php endif; ?>
        </div>
        <div class="small muted">
          скидка <?= (int) ($st['discount'] ?? 0) ?>%<?php
            if (($st['period'] ?? '') !== '') echo ' · ' . h(match ((string) $st['period']) {
                'year' => 'годовое', 'month' => 'месячное', 'unlimited' => 'без срока', default => (string) $st['period'] });
          ?>
        </div>
      </div>
      <div class="card">
        <div class="card__t">Куплено</div>
        <div class="card__v"><?= h($clubDate($st['started_at'] ?? null)) ?></div>
        <div class="small muted">источник: <?= h((string) ($st['source'] ?? '—')) ?></div>
      </div>
      <div class="card">
        <div class="card__t">Действует до</div>
        <div class="card__v"><?= h($clubDate($st['expires_at'] ?? null)) ?></div>
        <div class="small muted">
          <?php if ($left === null): ?>без срока
          <?php elseif ($left >= 0): ?>осталось <?= (int) $left ?> дн.
          <?php else: ?>истекло <?= abs((int) $left) ?> дн. назад<?php endif; ?>
          · автопродление: <?= !empty($st['auto_renew']) ? 'включено' : 'выключено' ?>
        </div>
      </div>
      <div class="card">
        <div class="card__t">Оплачено наград</div>
        <div class="card__v"><?= (int) $ord['sum'] ?> ₽</div>
        <div class="small muted">заказов: <?= count($ord['digital']) + count($ord['original']) ?></div>
      </div>
    </div>

    <h2 class="sec-t">Заявки на участие (<?= count($apps) ?>)</h2>
    <?php if (!$apps): ?>
      <p class="muted">Заявок пока нет.</p>
    <?php else: ?>
    <div class="table-wrap"><table class="tbl">
      <thead><tr><th>Заявка</th><th>Конкурс</th><th>Номер</th><th>Состояние</th><th style="width:250px"></th></tr></thead>
      <tbody>
      <?php foreach ($apps as $a):
          $who = (int) ($a['is_group'] ?? 0) === 1 && trim((string) ($a['group_name'] ?? '')) !== ''
                   ? (string) $a['group_name'] : (string) $a['full_name'];
          $rej = (string) $a['status'] === 'rejected';
      ?>
        <tr>
          <td>
            <b><?= h($who) ?></b>
            <div class="small muted"><?= h((string) $a['number']) ?><?= (int) ($a['is_group'] ?? 0) === 1 ? ' · коллектив' : '' ?></div>
          </td>
          <td class="small"><?= h((string) ($a['comp'] ?? '')) ?></td>
          <td class="small"><?= h((string) ($a['work_title'] ?? '')) ?></td>
          <td>
            <?php if ($rej): ?>
              <span class="badge badge--rejected">Отклонена</span>
            <?php elseif (trim((string) ($a['result'] ?? '')) !== ''): ?>
              <span class="badge badge--gold"><?= h((string) $a['result']) ?></span>
              <?php if (trim((string) ($a['extra_diploma'] ?? '')) !== ''): ?>
                <div class="small muted">доп: <?= h((string) $a['extra_diploma']) ?></div>
              <?php endif; ?>
            <?php else: ?>
              <span class="badge">Ждёт оценки</span>
            <?php endif; ?>
          </td>
          <td style="white-space:nowrap">
            <a class="btn btn--primary btn--sm" href="<?= $gradeLink($a) ?>"><?= admin_icon('grading') ?>Оценить</a>
            <a class="btn btn--ghost btn--sm" href="<?= a_link('applications', ['id' => (int) $a['id']]) ?>">Заявка</a>
          </td>
        </tr>
      <?php endforeach; ?>
      </tbody>
    </table></div>
    <?php endif; ?>

    <?php
    /* Заказы наград: электронные и оригиналы отдельными таблицами — они
     * исполняются по-разному и живут в разных разделах админки. */
    foreach ([['digital', 'Заказы электронных наград', 'digital'],
              ['original', 'Заказы оригиналов', 'orders']] as [$key, $title, $section]):
        $list = $ord[$key];
    ?>
      <h2 class="sec-t"><?= h($title) ?> (<?= count($list) ?>)</h2>
      <?php if (!$list): ?>
        <p class="muted">Заказов нет.</p>
      <?php else: ?>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>Заказ</th><th>Состав</th><th>Сумма</th><th>Состояние</th><th style="width:150px"></th></tr></thead>
        <tbody>
        <?php foreach ($list as $o): [$sLbl, $sCls] = $statusRu((string) $o['status']); ?>
          <tr>
            <td>
              <b>№<?= (int) $o['id'] ?></b>
              <div class="small muted"><?= h(date('d.m.y H:i', strtotime((string) $o['created_at']))) ?></div>
            </td>
            <td class="small"><?= h($itemsBrief($o)) ?></td>
            <td class="small">
              <?= (int) $o['amount'] ?> ₽
              <?php if ((int) ($o['refund_amount'] ?? 0) > 0): ?>
                <div class="small muted">возвращено <?= (int) $o['refund_amount'] ?> ₽</div>
              <?php endif; ?>
            </td>
            <td><span class="badge <?= h($sCls) ?>"><?= h($sLbl) ?></span></td>
            <td style="white-space:nowrap">
              <?php
              /* Раздел «Заказы оригиналов» ищет по номеру заказа, а «Заказы
               * электронных» сгруппирован по ЗАЯВКЕ — туда номер заказа
               * бессмысленно передавать, ведём по номеру заявки. */
              $goQ = $section === 'orders'
                  ? (string) $o['id']
                  : (string) (scalar("SELECT number FROM applications WHERE id=?", [(int) ($o['application_id'] ?? 0)])
                              // Заказ без заявки ищем по участнику: номер заказа в разделе
                              // электронных ничего не найдёт — он сгруппирован по заявкам.
                              ?: (string) ($o['email'] ?? ''));
              ?>
              <a class="btn btn--ghost btn--sm" href="<?= a_link($section, ['q' => $goQ]) ?>">Открыть</a>
            </td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table></div>
      <?php endif; ?>
    <?php endforeach; ?>
    <?php if ($ord['club']): ?>
      <h2 class="sec-t">Оплата членства (<?= count($ord['club']) ?>)</h2>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>Заказ</th><th>Период</th><th>Сумма</th><th>Состояние</th></tr></thead>
        <tbody>
        <?php foreach ($ord['club'] as $o): [$sLbl, $sCls] = $statusRu((string) $o['status']);
            $per = '';
            foreach ((array) json_decode((string) ($o['items'] ?? '[]'), true) as $it) {
                if (is_array($it) && (string) ($it['kind'] ?? '') === 'club') {
                    $per = (string) ($it['period'] ?? '');
                    break;
                }
            }
        ?>
          <tr>
            <td><b>№<?= (int) $o['id'] ?></b>
              <div class="small muted"><?= h(date('d.m.y H:i', strtotime((string) $o['created_at']))) ?></div></td>
            <td class="small"><?= h(match ($per) { 'year' => 'годовое', 'month' => 'месячное', default => '—' }) ?></td>
            <td class="small"><?= (int) $o['amount'] ?> ₽</td>
            <td><span class="badge <?= h($sCls) ?>"><?= h($sLbl) ?></span></td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table></div>
    <?php endif; ?>
    <?php
    return;
}

/* ============================ СПИСОК ЧЛЕНОВ КЛУБА ============================ */
$q      = trim((string) input('q'));
$filter = (string) input('f');            // all | active | expired

$rows = all("SELECT m.*, u.email, u.full_name, u.phone
               FROM club_members m LEFT JOIN users u ON u.id = m.user_id
              ORDER BY COALESCE(m.expires_at,'') DESC, m.id DESC");

$list = [];
$cntActive = 0; $cntExpired = 0; $cntSoon = 0;
foreach ($rows as $r) {
    $uid = (int) $r['user_id'];
    $st  = club_status($uid);
    $r['_st']   = $st;
    $r['_left'] = $daysLeft($r['expires_at'] ?? null);
    if (!empty($st['active'])) {
        $cntActive++;
        if ($r['_left'] !== null && $r['_left'] <= 7) $cntSoon++;
    } else {
        $cntExpired++;
    }
    if ($q !== '') {
        $hay = mb_strtolower(($r['full_name'] ?? '') . ' ' . ($r['email'] ?? '') . ' ' . ($r['phone'] ?? ''));
        if (mb_strpos($hay, mb_strtolower($q)) === false) continue;
    }
    if ($filter === 'active'  && empty($st['active'])) continue;
    if ($filter === 'expired' && !empty($st['active'])) continue;
    $list[] = $r;
}
?>
<div class="page-head">
  <div>
    <h1>ВИП-клуб</h1>
    <div class="small muted">Кто состоит в клубе, до какого числа действует членство и что у каждого в работе.</div>
  </div>
</div>

<div class="cards" style="margin-bottom:18px">
  <div class="card"><div class="card__t">Всего членов</div><div class="card__v"><?= count($rows) ?></div></div>
  <div class="card"><div class="card__t">Членство действует</div><div class="card__v"><?= $cntActive ?></div></div>
  <div class="card">
    <div class="card__t">Заканчивается</div><div class="card__v"><?= $cntSoon ?></div>
    <div class="small muted">в ближайшие 7 дней</div>
  </div>
  <div class="card"><div class="card__t">Истекло</div><div class="card__v"><?= $cntExpired ?></div></div>
</div>

<form method="get" class="filters" style="margin-bottom:14px">
  <input type="hidden" name="p" value="club">
  <input type="text" name="q" value="<?= h($q) ?>" placeholder="Фамилия, почта или телефон"
         style="padding:8px 11px;border:1px solid var(--a-line);border-radius:9px;min-width:240px">
  <select name="f" style="padding:8px 11px;border:1px solid var(--a-line);border-radius:9px">
    <option value=""        <?= $filter === ''        ? 'selected' : '' ?>>Все</option>
    <option value="active"  <?= $filter === 'active'  ? 'selected' : '' ?>>Членство действует</option>
    <option value="expired" <?= $filter === 'expired' ? 'selected' : '' ?>>Истекло</option>
  </select>
  <button class="btn btn--primary btn--sm">Показать</button>
  <?php if ($q !== '' || $filter !== ''): ?>
    <a class="btn btn--ghost btn--sm" href="<?= a_link('club') ?>">Сброс</a>
  <?php endif; ?>
</form>

<?php if (!$list): ?>
  <p class="muted">Ничего не найдено.</p>
<?php else: ?>
<div class="table-wrap"><table class="tbl">
  <thead><tr>
    <th>Участник</th><th>Куплено</th><th>Действует до</th><th>Период</th>
    <th>Заявки</th><th>Награды</th><th style="width:150px"></th>
  </tr></thead>
  <tbody>
  <?php foreach ($list as $r):
      $uid   = (int) $r['user_id'];
      $st    = $r['_st'];
      $left  = $r['_left'];
      $email = mb_strtolower(trim((string) ($r['email'] ?? '')));
      $apps  = (int) scalar("SELECT COUNT(*) FROM applications WHERE user_id=?", [$uid]);
      $graded = (int) scalar("SELECT COUNT(*) FROM applications
                               WHERE user_id=? AND COALESCE(result,'') <> ''", [$uid]);
      $ord   = $ordersOf($uid, $email);
  ?>
    <tr>
      <td>
        <b><?= h(trim((string) ($r['full_name'] ?? '')) ?: (string) ($r['email'] ?? '#' . $uid)) ?></b>
        <div class="small muted"><?= h((string) ($r['email'] ?? '')) ?></div>
      </td>
      <td class="small"><?= h($clubDate($r['started_at'] ?? null)) ?></td>
      <td class="small">
        <?= h($clubDate($r['expires_at'] ?? null)) ?>
        <div class="small <?= !empty($st['active']) ? 'muted' : '' ?>">
          <?php if (!empty($st['staff'])): ?>
            <span class="badge badge--gold">команда</span>
          <?php elseif (!empty($st['active'])): ?>
            осталось <?= (int) $left ?> дн.
          <?php else: ?>
            <span class="badge badge--rejected">истекло</span>
          <?php endif; ?>
        </div>
      </td>
      <td class="small">
        <?= h(match ((string) ($r['period'] ?? 'month')) {
            'year' => 'годовой', 'month' => 'месячный', default => (string) ($r['period'] ?? '') }) ?>
        <div class="small muted">автопродление: <?= (int) ($r['auto_renew'] ?? 0) === 1 ? 'да' : 'нет' ?></div>
      </td>
      <td class="small">
        всего <?= $apps ?>
        <div class="small muted">оценено <?= $graded ?></div>
      </td>
      <td class="small">
        эл. <?= count($ord['digital']) ?> · ориг. <?= count($ord['original']) ?>
        <div class="small muted"><?= (int) $ord['sum'] ?> ₽</div>
      </td>
      <td style="white-space:nowrap">
        <a class="btn btn--primary btn--sm" href="<?= a_link('club', ['user' => $uid]) ?>">Открыть</a>
      </td>
    </tr>
  <?php endforeach; ?>
  </tbody>
</table></div>
<?php endif; ?>
