# Rocket CDN — безопасный runbook доступов и запуска

Документ перечисляет все необходимые классы доступа, известные публичные endpoints, имена конфигурационных ключей и процедуры проверки. Значения секретов в нём отсутствуют.

## 1. Правило доступа

Codex никогда не просит вставить пароль, токен, API-key или private SSH key в чат, prompt, Markdown, ZIP или Git.

Допустимы:

- уже подключённый GitHub connector;
- уже авторизованная browser session;
- SSH agent/credential, заранее подключённый к runtime;
- runtime/environment secret, значение которого команда не печатает;
- ручной login пользователем в браузере, после которого Codex продолжает в той же сессии.

Проверяется факт доступа, а не значение credential.

---

## 2. GitHub

### Известно

- Repo: `gdeoko/OKO-TEAM`
- PR: `https://github.com/gdeoko/OKO-TEAM/pull/7`
- Branch: `claude/rocket-cdn-website-admin-x5482k`
- Expected snapshot SHA: `a450e335432e58ca7d3037eaafd516d6a4547da9`
- Repo публичный; read возможен без секрета, write требует авторизованного владельцем доступа.

### Как получить доступ

Предпочтительно подключить GitHub app/connector в рабочей среде Codex. Если connector отсутствует, пользователь авторизует его через интерфейс; PAT в чат не передаётся.

### Harmless verification

```bash
git ls-remote https://github.com/gdeoko/OKO-TEAM.git \
  refs/heads/claude/rocket-cdn-website-admin-x5482k
```

Для рабочего clone:

```bash
git clone --single-branch \
  --branch claude/rocket-cdn-website-admin-x5482k \
  https://github.com/gdeoko/OKO-TEAM.git
cd OKO-TEAM
git rev-parse HEAD
git status --short --branch
```

Если head отличается от snapshot, считать свежий remote head источником правды и сначала изучить новые commits.

### Write check

Проверять permission через connector/API, не делать тестовый мусорный commit. Перед push убедиться, что branch именно PR head и изменения только в `rocketcdn/`.

---

## 3. VPS Rocket CDN

### Известная публичная конфигурация

| Поле | Значение |
|---|---|
| Host | `217.19.122.132` |
| SSH user | `ubuntu` |
| OS | Ubuntu 24.04 |
| CPU/RAM | 4 cores / 4 GiB |
| Site root | `/var/www/rocketcdn` |
| External data | `/var/www/rocketcdn-data` |
| Nginx config | `/etc/nginx/sites-available/rocketcdn` |
| PHP | 8.3-FPM |
| PHP socket expected | `/run/php/php8.3-fpm.sock` |
| Cron | `/etc/cron.d/rocketcdn` |
| TLS | Let's Encrypt / certbot |
| Site | `https://rocketcdn.ru` |

### Credential required

- private SSH credential, доступный как SSH agent/managed session;
- право пользователя `ubuntu` выполнять необходимые `sudo` команды;
- если прямой порт 22 недоступен из среды, уже авторизованный bastion/VPS bridge.

Не использовать `sshpass`, пароль в command line, base64 transfer секрета или приватный ключ внутри ZIP.

### Read-only access test

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 ubuntu@217.19.122.132 \
  'hostname; id; uname -a; test -d /var/www/rocketcdn && echo SITE_DIR_OK'
```

Не запускать `env`, `printenv`, `cat config.local.php` или команды, выводящие секреты.

### Read-only production inventory

```bash
ssh ubuntu@217.19.122.132 '
  sudo -n nginx -t &&
  systemctl is-active nginx php8.3-fpm &&
  stat -c "%U:%G %a %n" /var/www/rocketcdn /var/www/rocketcdn-data &&
  find /var/www/rocketcdn -type f -printf "%P\n" | sort
'
```

Для конфигурации проверять только наличие требуемых keys отдельным server-side script, возвращающим `present/missing`, но не values.

### Backup перед deploy

Код и живые данные резервируются отдельно. Не складывать `config.local.php` в передаваемый archive.

Минимальная схема:

1. snapshot текущего `/var/www/rocketcdn` на сервере;
2. snapshot `/var/www/rocketcdn-data`;
3. записать timestamp и deployed commit SHA;
4. проверить, что backup читается;
5. только затем распаковывать новую версию.

### Deploy

Передавать только `rocketcdn/` без `data/`, `config.local.php`, log и локальных временных файлов.

Безопасный шаблон:

```bash
rsync -az --delete \
  --exclude data/ \
  --exclude config.local.php \
  --exclude '*.log' \
  ./rocketcdn/ ubuntu@217.19.122.132:/tmp/rocketcdn-release/
```

Дальше на VPS:

1. сравнить release manifest;
2. сделать backup;
3. перенести code tree атомарно или через проверенную release directory;
4. сохранить внешний data dir и local config;
5. `nginx -t`;
6. reload, не blind restart;
7. smoke tests;
8. записать deployed SHA.

Не применять `rsync --delete` напрямую к `/var/www/rocketcdn`, пока не доказано, что живые данные и local config действительно находятся вне этой папки.

### Rollback

Rollback target должен быть выбран до deploy. Возврат включает code snapshot, но не откатывает новые заявки целиком. Данные объединяются/сохраняются отдельно.

---

## 4. Runtime configuration keys

### Обязательные секретные значения

| Key | Назначение | Кто выдаёт/где подключается | Проверка без вывода значения |
|---|---|---|---|
| `admin_key` | admin.html/admin API | владелец создаёт новый уникальный secret | login succeeds; default/empty rejected |
| `mail_pass` | Gmail app password | Google account owner после 2FA | test email succeeds |
| `tg_token` | Telegram bot token | `@BotFather` в авторизованной Telegram session | `getMe`/bot self-test succeeds |
| SSH credential | VPS login | server owner/SSH agent | BatchMode SSH succeeds |
| GitHub write auth | push/PR updates | GitHub app/connector owner | repo permission says push |

### Идентификаторы и настройки

| Key | Текущее/ожидаемое назначение |
|---|---|
| `site_url` | `https://rocketcdn.ru` |
| `lk_url` | `https://lk.rocketcdn.ru` |
| `mail_user` | Gmail sender account; production docs называют `forwardrocketcdn@gmail.com` |
| `mail_to` | inbox для заявок; подтвердить владельцем |
| `mail_name` | Rocket CDN |
| `tg_username` | `rocket_cdn_bot` |
| `tg_admins` | verified Telegram user IDs администраторов; значения не копировать из старого шаблона без проверки |
| `tg_chat` | записывается через `/bindchat` |
| `tg_ips` | optional Telegram IPv4 overrides |
| `tg_proxy` | optional curl proxy; может быть секретным URL, не выводить |
| `contest_active` | enable/disable contest |
| `contest_title` | display title |
| `contest_channel` | обязательный channel handle/id |
| `contest_channel_url` | public/private join URL |
| `contest_top_prizes` | count of winners |
| `lead_remind_hours` | reminder threshold |
| `report_hour` | daily report hour |
| `trusted_proxies` | exact proxy IP allowlist |
| `data_dir` | production должен указывать на подтверждённый external data path |

### Local config

Проект ожидает `rocketcdn/config.local.php`, исключённый Git. В production он создаётся только на сервере с правами `640` и владельцем/группой, позволяющими PHP читать, но не отдавать его веб-сервером.

Codex не должен копировать production config в локальную рабочую папку. Для тестов создаётся отдельный test config с фиктивными значениями и отключённой внешней отправкой.

---

## 5. Google/Gmail

Нужно:

- авторизованный владелец аккаунта;
- включённая 2FA;
- отдельный Gmail app password для SMTP;
- подтверждённые sender и recipient.

Доступ получается через ручную авторизацию владельца. Пароль приложения не передаётся Codex текстом; он подключается к production runtime. Обычный пароль Google не используется.

Smoke test: одно тестовое письмо на подтверждённый адрес через admin self-test; затем lead email владельцу и optional confirmation клиенту.

---

## 6. Telegram / BotFather

Нужно:

- авторизованная Telegram session владельца;
- бот `@rocket_cdn_bot`;
- новый/действующий bot token, подключённый production runtime;
- verified admin user IDs;
- права бота в общем чате и contest channel;
- menu button → `https://rocketcdn.ru/app.html`;
- `/bindchat` и `/bindtopic` mappings.

Нельзя выводить token или `bindings.json`. Проверка — `getMe`, `/start`, admin commands, test lead, mini app, two-account contest flow.

---

## 7. DNS и TLS

Нужна авторизованная session регистратора/DNS provider, если потребуется менять записи.

Проверить:

- apex и `www` ведут на правильный production origin;
- `lk` остаётся на владельце личного кабинета;
- HTTP→HTTPS;
- сертификат содержит apex и www;
- certbot renewal timer active;
- certificate private key никогда не копируется из `/etc/letsencrypt`.

22.08.2026 все три HTTPS host отвечали 200, что противоречит ранним notes в `DEPLOY.md`; сначала подтвердить правильность содержимого, затем обновить документацию.

---

## 8. GPT Image 2

### Получение доступа

Предпочтительный путь — уже авторизованная ChatGPT Work/ChatGPT browser session пользователя и встроенная image generation capability. API key в пакет не нужен.

Если сессия не авторизована, пользователь выполняет login вручную. Codex не принимает пароль/2FA code в чат.

### Harmless check

Проверить наличие image generation UI/model selection и доступность требуемого качества без запуска платной серии. Перед фактическими генерациями получить разрешение на количество вариантов.

### Производственный режим

- high/4K;
- detailed English prompt ≥2000 chars;
- 3–4 continuity refs;
- сохранить исходники в reference folder;
- runtime integration только после A/B approval.

---

## 9. Runway / Runvay

### Получение доступа

Использовать авторизованную browser session Runway. Если login wall — пользователь входит вручную; credentials/2FA не принимаются в чат.

Если сервис/план не даёт Gen-4.5, зафиксировать blocker и предложить Minimax как заранее разрешённый fallback, но не переключаться молча.

### Проверка

- account session active;
- доступна требуемая модель;
- видна quota/credit state;
- разрешены image references и нужный export;
- платная генерация не стартует без согласованного batch.

### Production output

Сохранять source download, MP4/WebM web transcodes, poster и prompt/provenance. Не использовать экранную запись UI как master.

---

## 10. ElevenLabs

### Получение доступа

Использовать уже авторизованную browser session ElevenLabs; при login wall пользователь входит вручную. API key в ZIP/Git не нужен.

### Проверка

- account/plan active;
- доступны нужные voice/SFX models;
- license допускает коммерческий сайт;
- quota понятна до запуска batch.

### Требуемые входные данные

- утверждённый voiceover text, если речь вообще нужна;
- voice owner/permission;
- scene-by-scene cue sheet;
- язык/тембр/скорость/эмоция;
- loudness target.

Без этих данных не генерировать случайную озвучку.

---

## 11. Агентные сессии

Codex может разделять работу, но доступы остаются capability-scoped:

- read-only auditor не получает production write;
- asset agent работает через browser session, не видит VPS config;
- deploy agent не получает AI account credential;
- единственный lead объединяет изменения.

Передать агенту можно alias переменной или факт `connected`, но не её значение.

---

## 12. Launch smoke sequence

После deploy:

1. `GET /`, `/app.html`, `/privacy.html`, `/offer.html`, `/admin.html`.
2. Desktop/mobile full visual path.
3. JS console/network/WebGL context.
4. RU/EN, dark/light.
5. Lead and callback.
6. Admin login/stats/leads/content/export/selftest.
7. Telegram `/start`, `/health`, `/stats`, lead notification.
8. Gmail owner/client messages.
9. Cron `--now` в controlled mode, report/backup.
10. DNS/TLS/cert days.
11. Live manifest vs release.
12. Rollback command готов, но не выполняется без необходимости.

