<?php
/**
 * ВКОНТАКТЕ — ПОДКЛЮЧЕНИЕ КЛЮЧА ДЛЯ СТЕНЫ, БЕЗ ВОЗНИ СО ССЫЛКАМИ.
 *
 * Зачем страница. Ключей у сообщества три, и умеют они разное: ключ из «Работа
 * с API» ведёт переписку, но публиковать на стену им нельзя (ВК отвечает
 * 15/1133), а публикует только OAuth-ключ сообщества. Когда он перестаёт
 * работать, встают итоги конкурсов — вместе с письмами участникам. Раньше ключ
 * добывался вручную: собрать ссылку, вписать номер приложения, поймать адрес с
 * белой страницы, отдать разработчику. Здесь то же самое делается кнопкой.
 *
 * Что делает страница:
 *   • показывает состояние всех трёх ключей — не по нашим записям, а по ответу
 *     самого ВКонтакте;
 *   • собирает ссылку авторизации из номера приложения (ничего править руками);
 *   • принимает адрес с белой страницы, сам вынимает из него ключ;
 *   • ПРОВЕРЯЕТ ключ настоящей публикацией — отложенным постом, который тут же
 *     удаляет. Отложенный не виден подписчикам, но проходит весь путь до стены;
 *   • сохраняет ключ, ТОЛЬКО если публикация прошла. Нерабочий ключ в настройки
 *     не попадёт: молчаливо сломанный ключ — это снова вставшие итоги.
 */
declare(strict_types=1);
require_once BASE_PATH . '/core/vk.php';

const VK_APP_HINT = 'dev.vk.ru → Мои приложения → Создать → Standalone';

/** Прочитать локальные секреты (в git их нет). */
function vkadm_local(): array {
    $f = BASE_PATH . '/config.local.php';
    if (!is_file($f)) return [];
    $a = require $f;
    return is_array($a) ? $a : [];
}

/**
 * Записать секрет, не потеряв остальные и не оставив обрезанный файл.
 * Пишем во временный и переименовываем: обрыв на середине записи оставил бы
 * сайт без всех доступов сразу.
 */
function vkadm_save_secret(string $key, string $value): string {
    $f   = BASE_PATH . '/config.local.php';
    $cur = vkadm_local();
    if (!$cur) return 'не читается config.local.php';
    $cur[$key] = $value;
    $php = "<?php\n/** Локальные секреты. В git не попадает. */\nreturn " . var_export($cur, true) . ";\n";
    $tmp = $f . '.tmp';
    if (@file_put_contents($tmp, $php) === false) return 'нет прав на запись';
    if (!@rename($tmp, $f)) { @unlink($tmp); return 'не удалось заменить файл'; }
    @chmod($f, 0640);
    return '';
}

/** Ключ из адреса белой страницы: годится и полный адрес, и просто ключ. */
function vkadm_extract_token(string $raw): string {
    $raw = trim($raw);
    if ($raw === '') return '';
    if (preg_match('~access_token(?:_\d+)?=([A-Za-z0-9._\-]+)~', $raw, $m)) return $m[1];
    return preg_match('~^vk1\.a\.[A-Za-z0-9._\-]+$~', $raw) ? $raw : '';
}

/** Что ВК говорит о ключе: права или причина отказа. */
function vkadm_probe(string $token): array {
    if (trim($token) === '') return ['ok' => false, 'msg' => 'не задан'];
    $r = vk_api_with('groups.getTokenPermissions', [], $token, 'vk_probe');
    if (isset($r['response']['permissions'])) {
        $names = array_map(static fn(array $p): string => (string) $p['name'], $r['response']['permissions']);
        return ['ok' => true, 'msg' => 'права: ' . implode(', ', $names), 'perms' => $names];
    }
    /* У ЛИЧНОГО КЛЮЧА ПРАВА СПРАШИВАЮТ ДРУГИМ МЕТОДОМ.
     *
     * groups.getTokenPermissions — метод для ключей сообщества, личному он
     * отвечает отказом. Без этой ветки рабочий личный ключ показывался бы на
     * странице как сломанный, и владелец менял бы его впустую. */
    $u = vk_api_with('account.getAppPermissions', [], $token, 'vk_probe');
    if (isset($u['response'])) {
        return ['ok' => true, 'msg' => 'личный ключ, маска прав: ' . (int) $u['response']];
    }
    $e = $r['error'] ?? [];
    $e2 = $u['error'] ?? [];
    // Показываем ту причину, которая говорит по делу: отказ личного метода
    // информативнее, когда ключ личный.
    $msg = (string) ($e2['error_msg'] ?? $e['error_msg'] ?? 'нет ответа');
    $code = (int) ($e2['error_code'] ?? $e['error_code'] ?? 0);
    return ['ok' => false, 'msg' => 'ВК: ' . $msg . ($code ? ' (код ' . $code . ')' : '')];
}

/**
 * Настоящая проверка: публикуем отложенный пост и сразу удаляем.
 * Права в ответе ВК не значат, что публикация пройдёт — у ключа сообщества из
 * «Работа с API» право «стена» есть, а пост он не ставит. Верим только делу.
 */
function vkadm_try_post(string $token): array {
    $gid = (int) cfgv('vk_group_id', 211325055);
    $r = vk_api_with('wall.post', [
        'owner_id'     => -$gid,
        'from_group'   => 1,
        'publish_date' => time() + 86400,
        'message'      => 'Проверка подключения. Эта запись удаляется сразу и подписчикам не видна.',
    ], $token, 'vk_probe');
    $pid = (int) ($r['response']['post_id'] ?? 0);
    if ($pid > 0) {
        vk_api_with('wall.delete', ['owner_id' => -$gid, 'post_id' => $pid], $token, 'vk_probe');
        return ['ok' => true, 'msg' => 'публикация прошла, проверочная запись удалена'];
    }
    $e = $r['error'] ?? [];
    return ['ok' => false, 'msg' => (string) ($e['error_msg'] ?? 'нет ответа')
                                  . (isset($e['error_code']) ? ' (код ' . (int) $e['error_code'] . ')' : '')];
}

/* ---------- Действия ---------- */
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    if (!csrf_check()) { flash('Сессия устарела, повторите.', 'error'); admin_redirect('vk'); }
    $do = (string) input('do');

    if ($do === 'save_app') {
        $id = (string) preg_replace('~\D~', '', (string) input('app_id'));
        set_setting('vk_oauth_app_id', $id);
        flash($id !== '' ? 'Номер приложения сохранён.' : 'Номер приложения очищен.', 'success');
        admin_redirect('vk');
    }

    if ($do === 'connect') {
        $tok = vkadm_extract_token((string) input('paste'));
        if ($tok === '') {
            flash('В строке нет ключа. Вставьте адрес целиком — он начинается с https://oauth.vk.ru/blank.html#', 'error');
            admin_redirect('vk');
        }
        $probe = vkadm_probe($tok);
        $post  = vkadm_try_post($tok);
        if (!$post['ok']) {
            /* Не сохраняем. Иначе разберёмся об этом через неделю — когда снова
             * встанут итоги и никто не вспомнит, что ключ меняли. */
            flash('Ключ НЕ сохранён: публикация не прошла. ' . $post['msg']
                . ($probe['ok'] ? ' (' . $probe['msg'] . ')' : ' — ' . $probe['msg']), 'error');
            admin_redirect('vk');
        }
        $err = vkadm_save_secret('MUZMIR_VK_WALL_TOKEN', $tok);
        flash($err === ''
            ? 'Готово: ключ проверен публикацией и сохранён. Итоги конкурсов снова могут публиковаться.'
            : ('Ключ рабочий, но сохранить не удалось: ' . $err), $err === '' ? 'success' : 'error');
        admin_redirect('vk');
    }
}

/* ---------- Данные страницы ---------- */
$appId = (string) setting('vk_oauth_app_id', '');
$gid   = (int) cfgv('vk_group_id', 211325055);
$keys  = [
    ['Ключ сообщества (переписка)', (string) cfgv('vk_group_token', ''), 'Работа с API в настройках сообщества. Им отвечает чат-бот.'],
    ['Ключ для стены (OAuth)',      (string) cfgv('vk_wall_token', ''),  'Им публикуются итоги конкурсов. Его и подключаем ниже.'],
    ['Личный ключ владельца',       (string) cfgv('vk_token', ''),       'Запасной. Нужен там, куда сообщество не пускают.'],
];
$state = [];
foreach ($keys as [$title, $tok, $note]) $state[] = [$title, $note, vkadm_probe($tok)];

$authUrl = $appId === '' ? '' :
    'https://oauth.vk.ru/authorize?client_id=' . rawurlencode($appId)
    . '&scope=wall,photos,docs,stories,manage&group_ids=' . $gid
    . '&redirect_uri=https://oauth.vk.ru/blank.html&display=page&response_type=token&revoke=1';

ob_start(); ?>
<div class="page-head">
  <h1>ВКонтакте</h1>
  <p class="muted small">Ключ для стены — то, чем публикуются итоги конкурсов. Пока он не работает,
     вместе с постом стоят и письма участникам с результатами.</p>
</div>

<div class="card" style="margin-bottom:16px">
  <h2 class="card__title">Что отвечает ВКонтакте прямо сейчас</h2>
  <div class="table-wrap"><table class="tbl">
    <thead><tr><th>Ключ</th><th>Состояние</th><th>Для чего</th></tr></thead>
    <tbody>
    <?php foreach ($state as [$title, $note, $pr]): ?>
      <tr>
        <td><b><?= h($title) ?></b></td>
        <td class="small"><span class="badge badge--<?= $pr['ok'] ? 'made' : 'judging' ?>"><?= $pr['ok'] ? 'работает' : 'не работает' ?></span>
            <div class="muted" style="margin-top:4px"><?= h($pr['msg']) ?></div></td>
        <td class="small muted"><?= h($note) ?></td>
      </tr>
    <?php endforeach; ?>
    </tbody>
  </table></div>
</div>

<div class="card">
  <h2 class="card__title">Подключить ключ для стены</h2>

  <p class="small muted" style="margin:0 0 14px">
    Нужен номер приложения ВКонтакте. Если его ещё нет: <b><?= h(VK_APP_HINT) ?></b>,
    тип — Standalone, название любое. Номер вписывается один раз и запоминается.
  </p>

  <form method="post" action="<?= url('/admin/?p=vk') ?>" style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-bottom:18px">
    <?= csrf_field() ?><input type="hidden" name="do" value="save_app">
    <div class="field" style="margin:0;min-width:220px">
      <label>Номер приложения</label>
      <input type="text" name="app_id" inputmode="numeric" value="<?= h($appId) ?>" placeholder="например 51234567">
    </div>
    <button class="btn btn--ghost">Сохранить номер</button>
  </form>

  <?php if ($authUrl === ''): ?>
    <p class="small" style="color:#C0392B">Впишите номер приложения — после этого здесь появится кнопка подключения.</p>
  <?php else: ?>
    <p class="small" style="margin:0 0 8px"><b>Шаг 1.</b> Нажмите кнопку и разрешите доступ. Открывать с российского адреса, VPN выключен.</p>
    <p style="margin:0 0 18px">
      <a class="btn btn--primary" href="<?= h($authUrl) ?>" target="_blank" rel="noopener">Подключить ВКонтакте</a>
    </p>
    <p class="small" style="margin:0 0 8px"><b>Шаг 2.</b> Откроется пустая белая страница. Скопируйте её адрес целиком и вставьте сюда.</p>
    <form method="post" action="<?= url('/admin/?p=vk') ?>">
      <?= csrf_field() ?><input type="hidden" name="do" value="connect">
      <div class="field" style="margin:0 0 10px">
        <label>Адрес с белой страницы</label>
        <input type="text" name="paste" placeholder="https://oauth.vk.ru/blank.html#access_token...=vk1.a...." autocomplete="off">
      </div>
      <div class="field" style="margin:0 0 10px">
        <p class="small muted" style="margin:0">Подойдёт и ключ сообщества (<code>access_token_<?= $gid ?>=</code>),
           и личный ключ владельца (<code>access_token=</code>) — страница разберёт сама и проверит одинаково: публикацией.</p>
      </div>
      <button class="btn btn--primary">Проверить и подключить</button>
      <p class="small muted" style="margin:10px 0 0">
        Ключ проверяется настоящей публикацией — отложенной записью, которая тут же удаляется
        и подписчикам не видна. Не прошло — ключ не сохраняется, и Вы сразу видите причину.
      </p>
    </form>
  <?php endif; ?>
</div>
<?php
$content = ob_get_clean();
admin_layout('ВКонтакте', $content, 'vk');
