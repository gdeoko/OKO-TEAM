# SECURITY: устранение утечки секретов

Дата обнаружения: 2026-07-16. Ветка: `claude/security-credential-exposure-6ky56m`.

## Что произошло
Файл `secrets.env.b64` коммитился в git и содержал живые ключи в base64.
**base64 — это кодирование, а не шифрование:** любой, у кого есть доступ к репозиторию
(или к его git-истории), декодирует всё одной командой `base64 -d`. Ключи попали в
историю коммитов обеих веток (`claude/adoring-tesla-fFKEd`, рабочей) и на origin.

Дополнительно SessionStart-хук в `.claude/settings.json`:
- дёргал удалённый эндпоинт `OKO_POSTER_URL`, передавая произвольную shell-команду
  (`{"cmd":"cat /opt/oko-poster/cfg/secrets.env"}`) со статичным Bearer-токеном —
  это фактически RCE-бэкдор для «дозагрузки» секретов с VPS;
- прописывал `source .../secrets.env` в `~/.bashrc` и `~/.profile` (персистентность).

Токен `OKO_POSTER_TOKEN` вдобавок утёк открытым текстом в лог сессии.

## Что уже исправлено в этой ветке
- `secrets.env.b64` убран из git (`git rm --cached`) и добавлен в `.gitignore`
  (вместе с `secrets.env`, `*.secret*`).
- SessionStart-хук переписан: **без** сетевого fetch и **без** записи в `~/.bashrc`/`~/.profile`;
  теперь он только подхватывает локальный (gitignored) `secrets.env`, если тот есть,
  и только на время сессии.
- Инъекции в `~/.bashrc`/`~/.profile` и файл `~/.oko-secrets.env` удалены.
- CLAUDE.md исправлен: правило «коммитить b64» заменено на «секреты только в
  Environment variables окружения, в git — никогда».

## ЧТО ОБЯЗАН СДЕЛАТЬ ВЛАДЕЛЕЦ (эти шаги код сделать не может)

### 1. Ротировать ВСЕ ключи ниже — они скомпрометированы навсегда
Даже после удаления из рабочего дерева значения остаются в git-истории на origin.
Единственная надёжная защита — перевыпустить/сменить каждый секрет.

**Инфраструктура и хранилища**
- [ ] `OKO_POSTER_TOKEN` / `OKO_POSTER_URL` — RCE-эндпоинт постинг-VPS (высший приоритет: отозвать токен, закрыть эндпоинт, убрать приём произвольных `cmd`)
- [ ] `OKO_VPS_CTRL_TOKEN` / `OKO_VPS_CTRL_URL` / `CONTROL_TOKEN` / `CONTROL_URL`
- [ ] `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_TOKEN_OLD`, `CLOUDFLARE_ACCOUNT_ID`
- [ ] `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_ENDPOINT` (S3-хранилище)
- [ ] `HF_S3_ACCESS_KEY_ID` / `HF_S3_SECRET_ACCESS_KEY` / `HF_S3_ENDPOINT`
- [ ] `HF_TOKEN`

**API генераций/медиа**
- [ ] `FAL_KEY`, `TWENTY_FIRST_API_KEY`, `SKETCHFAB_API_TOKEN`
- [ ] `PEXELS_API_KEY`, `PIXABAY_API_KEY`, `FREESOUND_CLIENT_ID`, `FREESOUND_API_KEY`

**Telegram-боты**
- [ ] `VCODE_MEDIA_BOT_TOKEN`, `VCODE_ANALYTICS_BOT_TOKEN`, `TAPPIO_ANALYTICS_BOT_TOKEN` (перевыпустить у @BotFather)

**Почта / соцсети (в истории лежали пароли и OAuth-токены)**
- [ ] `GMAIL_PASS`, `GMAIL_PASS2`, `SITE_GMAIL_PASS` (app-пароли Gmail — отозвать)
- [ ] `VK_TOKEN`
- [ ] YouTube OAuth: `YT_CLIENT_ID`/`YT_CLIENT_SECRET`/`YT_REFRESH_TOKEN`,
      `CLIENT_YT_CLIENT_ID`/`CLIENT_YT_CLIENT_SECRET`,
      `TAPPIO_YT_CLIENT_ID`/`TAPPIO_YT_CLIENT_SECRET`/`TAPPIO_YT_REFRESH_TOKEN`,
      `CLIENT_EKAT_YT_REFRESH_TOKEN`, `CLIENT_DIESEL_YT_REFRESH_TOKEN`
      (в Google Cloud Console отозвать client secret и все refresh-токены)
- [ ] Instagram/TikTok логины+пароли клиентов: `TAPPIO_IG_*`, `TAPPIO_TT_*`,
      `CLIENT_EKAT_PASSWORD`, `CLIENT_DIESEL_PASSWORD`, `HOOPPY_LOGIN`/`HOOPPY_PASSWORD`,
      `HOOPPY_API_TOKEN` (сменить пароли аккаунтов, включить 2FA)

> Логины/ID/username/каналы (`*_LOGIN`, `*_EMAIL`, `*_CHAT_ID`, `*_PAGE_*`, `VCODE_ADMIN_IDS`)
> не являются секретами сами по себе, но были опубликованы вместе с паролями — при
> смене паролей это учтено автоматически.

### 2. Где хранить ключи вместо git
Прописать все ключи в **Environment variables окружения** Claude Code
(настройки окружения). Хук подхватывает локальный `secrets.env` только если он лежит
рядом вне git — но канонично именно окружение, как и сказано в CLAUDE.md.

### 3. (Опционально) вычистить git-историю
Ротация выше — обязательна и достаточна. Если нужно ещё и стереть значения из истории:
```
git filter-repo --path secrets.env.b64 --invert-paths   # на свежем клоне
git push --force --all                                    # перезапишет origin (согласовать!)
```
Это переписывает общую историю обеих веток — делать осознанно и после ротации.
