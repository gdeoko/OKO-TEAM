# Rocket CDN — безопасный launch-checklist

Статусы: `[x]` подтверждено этим аудитом; `[~]` было проверено раньше или реализовано, но требует повторной проверки; `[ ]` необходимо до launch.

## A. Уже готово/подтверждено

- [x] PR #7 открыт и mergeable.
- [x] Head snapshot зафиксирован: `a450e335432e58ca7d3037eaafd516d6a4547da9`.
- [x] Полный `rocketcdn/` включён в пакет.
- [x] Generated repo media, Library references и screenshots включены.
- [x] Live main HTML совпадает с head по SHA-256.
- [x] `rocketcdn/config.local.php` не отслеживается Git.
- [x] `rocketcdn/data/` не отслеживается Git.
- [x] `rocketcdn/.gitignore` исключает local config/data/log.
- [x] Собственные JS-файлы синтаксически корректны.
- [x] MP4/WebM/M4A читаются `ffprobe`.
- [x] P6G–P6L присутствуют в code/commit history.
- [x] `rocketcdn.ru`, `www.rocketcdn.ru`, `lk.rocketcdn.ru` отвечали HTTPS 200 на момент среза.
- [~] Исторический PR body сообщает об успешных PHP/API/Chromium тестах до последних P6-итераций.

## B. Можно закрыть прямо сейчас как документальную работу

- [x] Зафиксировать единый scope: только Rocket CDN.
- [x] Зафиксировать frozen visual requirements.
- [x] Зафиксировать один source branch/PR/head.
- [x] Отделить «код реализован» от «визуально принят».
- [x] Создать media inventory и reference contact sheets.
- [x] Создать access matrix без credential values.
- [x] Указать exact server paths, config key names и safe verification.
- [x] Зафиксировать, что Runway/GPT Image 2/ElevenLabs — offline production tools, а не runtime secrets сайта.
- [x] Запретить дальнейший scope creep до closure acceptance defects.

## C. P0 blockers — launch запрещён

- [ ] Отозвать/заменить все действующие credentials, которые могли находиться в публичном `secrets.env.b64` или Git history.
- [ ] Удалить active secret container из публичного branch process и закрыть повторное попадание secret-like files.
- [ ] Подтвердить GitHub write access для PR head.
- [ ] Подтвердить VPS SSH agent и `sudo` без вывода ключа/пароля.
- [ ] Подтвердить DNS ownership/session.
- [ ] Проверить production config наличием keys `present/missing`, не печатать values.
- [ ] Проверить, что `admin_key` не пустой и не repository default.
- [ ] Проверить Gmail app password и test delivery.
- [ ] Проверить bot token/admin IDs/chat bindings.
- [ ] Подтвердить `data_dir=/var/www/rocketcdn-data` либо фактический путь.
- [ ] Проверить production backup и restore sample.
- [ ] Сверить полный live asset manifest с head.
- [ ] Исправить PHP 8.2/8.3 discrepancy в nginx example.
- [ ] Обновить устаревшие DNS/lk notes в `DEPLOY.md` после подтверждения владельца.

## D. Visual launch-gate

Обязательные viewport минимум:

- [ ] 1920×1080 desktop Chrome.
- [ ] 1440×900 desktop Chrome/Safari equivalent.
- [ ] 1024×1366 tablet portrait.
- [ ] 390×844 mobile portrait.
- [ ] 360×800 low-width mobile.
- [ ] mobile landscape spot check.

На каждом:

- [ ] Загрузка без flash/black screen.
- [ ] Ракета видна и не подменяется другой моделью.
- [ ] Full forward scroll от первого экрана до игры.
- [ ] Full reverse scroll обратно до начала.
- [ ] Люк/тамбур/cabin transition физически непрерывен.
- [ ] Нет второго cockpit/duplicate layers.
- [ ] Window mask — граница HUD/контролов.
- [ ] Физический console занимает допустимую зону и не закрывает космос.
- [ ] HUD taps/clicks работают; background holograms не крадут events.
- [ ] Солнце, 8 планет и Луна имеют физические материалы, не выглядят окрашенными шарами.
- [ ] Млечный Путь/galactic filaments имеют реальную глубину.
- [ ] Asteroids не пересекают cockpit/planets неверно.
- [ ] Camera mass не создаёт рывков/укачивания.
- [ ] DOM/content не налезает на критическую геометрию.
- [ ] RU/EN не ломают композицию.
- [ ] Dark/light не делают cockpit/controls нечитаемыми.
- [ ] LOD сохраняет сюжет; 3D не исчезает на обычном mobile.
- [ ] True no-WebGL fallback остаётся функциональным.
- [ ] Нет console errors, WebGL loss и unhandled promises.

## E. Functional launch-gate

- [ ] Все PHP-файлы проходят `php -l` на PHP 8.3.
- [ ] API `track`, `lead`, `callback`.
- [ ] Invalid contact rejected.
- [ ] Honeypot rejected.
- [ ] Rate limiting/trusted proxy behavior.
- [ ] Admin default/empty password rejected.
- [ ] Admin login with runtime credential.
- [ ] Stats/leads/status/delete/export/content save/reset/errors/selftest.
- [ ] Lead visible in admin.
- [ ] Owner email arrives.
- [ ] Client confirmation arrives when email provided.
- [ ] Bot `/start`, `/help`, `/health`, `/stats`, `/leads`, `/report`.
- [ ] `/bindchat`, topics, fallback to admin DMs.
- [ ] Mini app menu button.
- [ ] Contest two-account referral test.
- [ ] Self-referral/duplicate rejected.
- [ ] Winner subscription recheck.
- [ ] Cron report/reminder/health/backup.
- [ ] Restore one backup in isolated test directory.

## F. AI/media launch-gate

- [ ] Создать asset registry для новых и критичных existing assets.
- [ ] Указать provenance/license для music/theme.
- [ ] Решить contradiction «zero audio files» vs current theme files.
- [ ] Утвердить, нужна ли ElevenLabs voiceover.
- [ ] Если нужна речь — получить финальный текст и permission на voice.
- [ ] Утвердить sound cue sheet.
- [ ] Проверить autoplay after gesture, mute, suspend on hidden.
- [ ] Проверить громкость на телефоне и в наушниках.
- [ ] Для новых GPT Image refs сохранить prompt ≥2000 chars и 3–4 continuity images.
- [ ] Для новых Runway clips сохранить input refs/prompt/master/transcodes/poster.
- [ ] Не использовать generated still как плоский основной 3D-мир.

## G. Performance/accessibility/SEO

- [ ] Record FPS/frame-time on all required devices.
- [ ] Record peak memory and WebGL context count.
- [ ] Simulate context loss and recovery/fallback.
- [ ] Slow 3G transition 70→80% no black frame.
- [ ] Fast scroll/end-to-start no unfinished state.
- [ ] `visibilitychange` pauses audio/render as designed.
- [ ] Keyboard path reaches native form without entering 3D controls.
- [ ] Visible focus, labels, autocomplete/inputmode.
- [ ] JavaScript disabled: all content visible and form usable.
- [ ] `prefers-reduced-motion`: accessible and coherent without removing essential story.
- [ ] Schema/FAQ matches visible current content.
- [ ] Sitemap/robots/OG/manifest correct on apex/www.

## H. Release/rollback

- [ ] Final commit SHA recorded.
- [ ] Code backup created/readable.
- [ ] Data backup created/readable.
- [ ] Release archive/manifest generated.
- [ ] Deploy excludes config/data/log.
- [ ] `nginx -t` passes.
- [ ] PHP-FPM/nginx/cron active.
- [ ] TLS certificate includes apex/www and renew timer active.
- [ ] Smoke sequence complete.
- [ ] Live manifest equals release.
- [ ] Rollback target and command recorded.
- [ ] PR body updated to current state.
- [ ] CI/status checks green or signed manual release report attached.
- [ ] Reviewer assigned.
- [ ] Только после этого снять draft.

## Go/No-Go

`GO` допустим только при нуле незакрытых P0, полном visual+functional gate и готовом rollback. Наличие красивого live-кадра само по себе не является launch approval.

