# Source provenance и результаты аудита

## Git source

- Repository: `gdeoko/OKO-TEAM`
- PR: `#7`
- Head branch: `claude/rocket-cdn-website-admin-x5482k`
- Base branch: `claude/adoring-tesla-fFKEd`
- Snapshot commit: `a450e335432e58ca7d3037eaafd516d6a4547da9`
- Commit title: `Rocket CDN: publish P6L planetary material marker`
- Snapshot time: 22.08.2026.
- Checkout method: public Git clone с partial/sparse checkout каталога `rocketcdn/`.
- `.git` directory не включён в пакет.

## PR metadata

- State: open.
- Draft: true.
- Mergeable: true.
- Commits: 184.
- Changed files: 133.
- Additions: 50 462.
- Deletions: 0.
- PR comments: none.
- Reviews: none.
- Review threads: none.
- Workflow runs for head: none.
- Combined status checks: none.

## Local snapshot checks

- `rocketcdn/`: 131 files, около 18 MiB.
- Все собственные JavaScript files проверены `node --check`: pass.
- Все MP4/WebM/M4A files проверены `ffprobe`: container headers pass.
- Типовые patterns private keys/GitHub/OpenAI/AWS/Google/Telegram tokens в `rocketcdn/` не найдены.
- `rocketcdn/config.local.php`: не tracked.
- `rocketcdn/data/`: не tracked.
- `.gitignore`: `config.local.php`, `data/`, `*.log`.

PHP CLI и Chromium в сборочном container отсутствовали, поэтому historical PHP/browser statements из PR не были повторно подтверждены после P6L.

## Live check

На момент проверки:

- `https://rocketcdn.ru/` → HTTP 200.
- `https://www.rocketcdn.ru/` → HTTP 200.
- `https://lk.rocketcdn.ru/` → HTTP 200.
- Live main HTML size: 88 045 bytes.
- Live main HTML SHA-256: `d0e012908ff81a55a0ccd9017f0a9ccf2e7a6fa4606ff1d634905d5e3a493880`.
- Head `rocketcdn/index.html` SHA-256: тот же.

Эта проверка подтверждает parity главного HTML, но не всех assets/runtime data.

## Library reference source

В `references/generated-library/` включены model-generated images, найденные среди файлов пользователя по Rocket CDN. В `references/screenshots/` включены мобильные screenshots от 22.08.2026, относящиеся к текущему состоянию интерфейса.

В пакет не включены:

- credentials;
- Library IDs и transfer metadata;
- временные download files;
- unrelated generated art;
- root `secrets.env.b64`;
- другие проекты монорепозитория.

## Security note

Репозиторий public и отслеживает корневой `secrets.env.b64`. Его содержимое не читалось и не копировалось. Base64 не является шифрованием; rotation/revocation связанных credentials указан как P0.

