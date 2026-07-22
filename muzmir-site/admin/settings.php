<?php
/** Настройки: токены/ключи (маскировано), SMTP, ЮKassa, TG, VK, YouTube, Dadata, reCAPTCHA, Metrika, роли, PIN. */
declare(strict_types=1);

/** Группы настроек: ключ => [подпись, секрет?, плейсхолдер]. */
function settings_schema(): array {
    return [
        'Почта (SMTP)' => [
            'smtp_host' => ['SMTP-хост', false, 'smtp.gmail.com'],
            'smtp_port' => ['Порт', false, '465'],
            'smtp_user' => ['Логин', false, 'user@gmail.com'],
            'smtp_pass' => ['Пароль приложения', true, ''],
        ],
        'ЮKassa' => [
            'yukassa_shop'   => ['shopId', false, ''],
            'yukassa_secret' => ['Секретный ключ', true, ''],
        ],
        'Telegram' => [
            'tg_bot_token'  => ['Токен бота', true, ''],
            'tg_admin_chat' => ['Chat ID администратора', false, ''],
        ],
        'Соцсети' => [
            'vk_token'      => ['VK API токен', true, ''],
            'youtube_key'   => ['YouTube API key', true, ''],
        ],
        'Внешние сервисы' => [
            'dadata_token'     => ['Dadata токен', true, ''],
            'dadata_secret'    => ['Dadata секрет', true, ''],
            'recaptcha_site'   => ['reCAPTCHA site key', false, ''],
            'recaptcha_secret' => ['reCAPTCHA secret', true, ''],
            'metrika_id'       => ['Яндекс.Метрика ID', false, ''],
        ],
        'Подписанты диплома' => [
            'sign1_name' => ['Подпись 1 — ФИО/роль', false, 'Председатель оргкомитета'],
            'sign1_desc' => ['Подпись 1 — должность/регалии', false, ''],
            'sign2_name' => ['Подпись 2 — ФИО', false, 'Ильясов Альберт Ильясович'],
            'sign2_desc' => ['Подпись 2 — должность/регалии', false, 'Генеральный директор'],
        ],
        'Безопасность' => [
            'admin_pin' => ['PIN администратора', true, ''],
        ],
    ];
}

/** Маска для секретов: показываем только хвост. */
function mask_secret(string $v): string {
    if ($v === '') return '';
    $len = mb_strlen($v);
    return $len <= 4 ? str_repeat('•', $len) : str_repeat('•', 6) . mb_substr($v, -4);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'save') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('settings'); }
    $changed = [];
    foreach (settings_schema() as $fields) {
        foreach ($fields as $key => [$label, $secret]) {
            if (!array_key_exists($key, $_POST)) continue;
            $val = trim((string)$_POST[$key]);
            // Секрет с пустым вводом — не затираем сохранённое значение.
            if ($secret && $val === '') continue;
            if ($secret && $val === '__keep__') continue;
            $old = (string) setting($key, '');
            if ($val !== $old) { set_setting($key, $val); $changed[] = $key; }
        }
    }
    audit('settings_save', 'settings', null, ['keys'=>$changed]);
    flash($changed ? 'Настройки сохранены (' . count($changed) . ').' : 'Изменений нет.', $changed ? 'success' : 'info');
    admin_redirect('settings');
}

ob_start(); ?>
<div class="section-title"><h2>Настройки</h2></div>
<div class="flash flash--warning">Секретные значения хранятся в таблице настроек и показаны маской. Оставьте поле пустым, чтобы сохранить текущее значение. Ключи из окружения (config.php) имеют приоритет для боевой работы.</div>

<form method="post" action="<?= url('/admin/') ?>">
  <?= csrf_field() ?><input type="hidden" name="do" value="save">
  <div class="grid grid-2">
    <?php foreach (settings_schema() as $group => $fields): ?>
      <div class="card">
        <h3><?= h($group) ?></h3>
        <?php foreach ($fields as $key => [$label, $secret, $ph]):
          $val = (string) setting($key, '');
          $has = $val !== ''; ?>
          <div class="field">
            <label><?= h($label) ?> <?php if ($secret): ?><span class="small muted">(секрет)</span><?php endif; ?></label>
            <?php if ($secret): ?>
              <input type="password" name="<?= h($key) ?>" placeholder="<?= $has ? 'Сохранено: '.h(mask_secret($val)) : ($ph ?: 'не задано') ?>" autocomplete="new-password">
              <?php if ($has): ?><div class="hint">Текущее: <span class="mask"><?= h(mask_secret($val)) ?></span> — оставьте пустым, чтобы не менять.</div><?php endif; ?>
            <?php else: ?>
              <input name="<?= h($key) ?>" value="<?= h($val) ?>" placeholder="<?= h($ph) ?>">
            <?php endif; ?>
          </div>
        <?php endforeach; ?>
      </div>
    <?php endforeach; ?>
  </div>
  <div class="toolbar" style="margin-top:20px"><button class="btn btn--primary"><?= admin_icon('check') ?>Сохранить настройки</button></div>
</form>

<div class="card" style="margin-top:20px">
  <h3>Роли и права</h3>
  <p class="small muted">Иерархия ролей (ранг): выше ранг — шире доступ. Назначение ролей — в разделе «Пользователи».</p>
  <div class="table-wrap"><table class="tbl">
    <thead><tr><th>Роль</th><th class="num">Ранг</th><th>Доступ к разделам панели</th></tr></thead>
    <tbody>
      <?php foreach (ROLE_RANK as $role => $rank):
        $mods = [];
        foreach (admin_modules() as [$lbl, $min]) if (($rank) >= (ROLE_RANK[$min] ?? 99)) $mods[] = $lbl; ?>
        <tr>
          <td><span class="badge badge--<?= $role==='owner'?'gold':'muted' ?>"><?= h(role_ru($role)) ?></span></td>
          <td class="num"><?= $rank ?></td>
          <td class="small"><?= $mods ? h(implode(', ', $mods)) : '<span class="muted">нет доступа к панели</span>' ?></td>
        </tr>
      <?php endforeach; ?>
    </tbody>
  </table></div>
</div>
<?php
$content = ob_get_clean();
admin_layout('Настройки', $content, 'settings');
