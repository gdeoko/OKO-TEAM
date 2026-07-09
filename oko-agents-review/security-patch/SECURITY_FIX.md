# 🔴 SECURITY FIX — okoteam.top (api.php / cron.php / polling.php)

Дата аудита: 09.07.2026. Все находки — по загруженным файлам живого сайта.
Приоритет: **применить сегодня**. Каждая правка ниже — точечная, copy-paste.

> Деплой: файлы okoteam.top не в этом гите. Применяет тот, у кого доступ к
> хостингу (FTP/SSH/панель). Дай доступ — применю сам.

---

## Сводка находок

| # | Проблема | Что утекает / ломается | Критичность |
|---|----------|------------------------|-------------|
| 1 | `ADMIN_KEY = '2002'` — 4 цифры | слив всей базы лидов, спам с Gmail, «оплаты» | 🔴 критично |
| 2 | Второй ключ `'oko2026'` в confirmPayment | тот же обход | 🔴 |
| 3 | Lava-webhook без проверки подписи | любой POST → «клиент оплатил» | 🔴 |
| 4 | `downloadAnketa` без авторизации | скачивание анкет с медиа по id | 🟠 |
| 5 | Хардкод Gmail-пароля и TG-токена в коде | попали в zip/чат → скомпрометированы | 🔴 ротация |
| 6 | Секреты в 3 файлах продублированы | рассинхрон при смене | 🟠 |
| 7 | `anketas.json`/`data.json` — гонки записи | потеря данных при параллельных заявках | 🟡 |

---

## Шаг 0. Ротация секретов (СНАЧАЛА, вне кода)

Считать текущие значения скомпрометированными — они уехали в архив/чат.

1. **Gmail app-password** `xoitcjrufqsqoljj` → отозвать в
   Google Account → Security → App passwords, создать новый.
2. **TG-бот** `8681257013:...` → @BotFather → `/revoke` → новый токен.
   (В `docs/` пакета есть ещё один токен `8919721178:...` — тоже отозвать,
   если не используется.)
3. **ADMIN_KEY** → сгенерировать: `openssl rand -hex 24`.

---

## Шаг 1. Вынести секреты из кода в один защищённый файл

Создать `secrets.php` рядом с `api.php` (НЕ в git):

```php
<?php
// secrets.php — НЕ коммитить, права 600. Подключается require_once.
return [
  'GMAIL'      => 'daniel.okoteam@gmail.com',
  'GMAIL_PASS' => 'НОВЫЙ_APP_PASSWORD',          // из шага 0
  'TG_TOKEN'   => 'НОВЫЙ_ТОКЕН_БОТА',            // из шага 0
  'ADMIN_KEY'  => 'ПАСТА_ИЗ_openssl_rand_hex_24',// из шага 0
  'LAVA_SECRET'=> 'секрет_из_личного_кабинета_Lava', // для подписи вебхука
];
```

Закрыть его в `.htaccess` (добавить к существующему блоку `FilesMatch`):

```apache
<FilesMatch "^(data\.json|anketas\.json|\.env|secrets\.php|cron\.php|polling\.php|polling_offset\.txt|bot_state\.json)$">
  Order Allow,Deny
  Deny from all
</FilesMatch>
# Закрыть партиалы дожимов целиком
RewriteRule ^partials/ - [F,L]
```

В начале `api.php`, `cron.php`, `polling.php` заменить блок `define(...)` на:

```php
$S = require __DIR__ . '/secrets.php';
define('GMAIL',      $S['GMAIL']);
define('GMAIL_PASS', $S['GMAIL_PASS']);
define('TG_TOKEN',   $S['TG_TOKEN']);   // в polling.php: BOT_TOKEN
define('ADMIN_KEY',  $S['ADMIN_KEY']);
define('LAVA_SECRET',$S['LAVA_SECRET']);
```

---

## Шаг 2. Убрать второй ключ и слабую проверку (api.php, confirmPayment)

Найти в `case 'confirmPayment':`

```php
$validKeys = [ADMIN_KEY, 'oko2026'];
if ($secret && !in_array($secret, $validKeys) && !in_array($apiKey, $validKeys)) {
```

Заменить всю проверку на подпись Lava + fallback на сильный ключ:

```php
// Проверка подлинности вебхука Lava по HMAC-подписи.
$raw = file_get_contents('php://input');
$sigHeader = $_SERVER['HTTP_X_API_KEY'] ?? ($_SERVER['HTTP_X_SIGNATURE'] ?? '');
$expected  = hash_hmac('sha256', $raw, LAVA_SECRET);
$manualKey = $_GET['secret'] ?? ($body['secret'] ?? '');

$isLava   = hash_equals($expected, (string)$sigHeader);
$isManual = hash_equals(ADMIN_KEY, (string)$manualKey);   // ручное подтверждение
if (!$isLava && !$isManual) {
    http_response_code(403);
    echo json_encode(['ok'=>false,'error'=>'Unauthorized']); break;
}
```

> Точное имя заголовка подписи уточнить в кабинете Lava.top (обычно
> `X-Api-Key`/`X-Signature`). Если Lava шлёт свой формат — сверять по их
> доке; главное — **не принимать оплату без валидной подписи**.

---

## Шаг 3. Защитить downloadAnketa (api.php)

Сейчас скачать анкету может любой, кто угадает `id` (`ank_<unixtime>`).
Добавить подписанный токен. В начало `case 'downloadAnketa':`:

```php
$aid = $_GET['id'] ?? '';
$tok = $_GET['t']  ?? '';
$goodTok = substr(hash_hmac('sha256', $aid, ADMIN_KEY), 0, 16);
$isAdmin = hash_equals(ADMIN_KEY, (string)($_GET['key'] ?? ''));
if (!$aid || (!hash_equals($goodTok, (string)$tok) && !$isAdmin)) {
    http_response_code(403); echo 'Доступ запрещён'; exit;
}
```

И там, где формируется `$downloadUrl` (в saveAnketa), добавить токен:

```php
$tok = substr(hash_hmac('sha256', $anketa_id, ADMIN_KEY), 0, 16);
$downloadUrl = SITE_URL . '/api.php?action=downloadAnketa&id=' . urlencode($anketa_id) . '&t=' . $tok;
```

Теперь ссылка в письме/боте работает, а перебор id — нет.

---

## Шаг 4. Защита от гонок при записи JSON (api.php, saveData / saveAnketa)

Обернуть запись во flock, чтобы параллельные заявки не затирали друг друга:

```php
function saveData($d) {
    $fp = fopen(DATA_FILE, 'c+');
    if ($fp && flock($fp, LOCK_EX)) {
        ftruncate($fp, 0); rewind($fp);
        fwrite($fp, json_encode($d, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
        fflush($fp); flock($fp, LOCK_UN);
    }
    if ($fp) fclose($fp);
}
```

> Средне-срочно: `anketas.json` с base64-медиа внутри будет пухнуть без
> предела. Медиа выносить в S3 (`oko-media`, уже подключён — см. INTEGRATIONS),
> в JSON держать только ссылки. Ещё лучше — перевести лиды/оплаты/анкеты на
> Supabase (28 таблиц уже развёрнуты), см. CONSOLIDATION.md.

---

## Шаг 5. Проверка после деплоя

```bash
# 1) Старый ключ больше не работает (ждём 403/Unauthorized):
curl -s "https://okoteam.top/api.php?action=getSubscribers&key=2002"
# 2) Слепой вебхук оплаты отбивается (ждём 403):
curl -s -X POST "https://okoteam.top/api.php?action=confirmPayment" \
     -H "Content-Type: application/json" -d '{"status":"success","email":"x@x.ru"}'
# 3) Анкета без токена не качается (ждём 403):
curl -s "https://okoteam.top/api.php?action=downloadAnketa&id=ank_1"
# 4) Секретные файлы закрыты (ждём 403):
curl -s -o /dev/null -w "%{http_code}\n" "https://okoteam.top/secrets.php"
curl -s -o /dev/null -w "%{http_code}\n" "https://okoteam.top/anketas.json"
```

Все четыре должны отдавать отказ. Если что-то отвечает 200 с данными —
правка не применилась.
