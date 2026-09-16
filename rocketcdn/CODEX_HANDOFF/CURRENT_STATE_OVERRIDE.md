# CURRENT STATE OVERRIDE — Rocket CDN

Дата фиксации: 2026-08-22.

Этот файл находится непосредственно в рабочей ветке PR #7. Сетевой доступ, sandbox-файл и отдельное клонирование для чтения handoff не нужны.

## Авторитетные ссылки

- Repository: `gdeoko/OKO-TEAM`
- PR: `#7`
- Working branch: `claude/rocket-cdn-website-admin-x5482k`
- Branch head перед добавлением handoff: `a2475e967d54e564f5ca63f9bee3e192419cdae1`
- PR state: open, draft, mergeable
- Project root: `rocketcdn/`
- Handoff root: `rocketcdn/CODEX_HANDOFF/`

Код в текущей ветке новее исходного среза `a450e335432e58ca7d3037eaafd516d6a4547da9`, указанного внутри master-handoff. Поэтому текущие файлы `rocketcdn/` являются источником правды для реализации, а документы handoff — источником требований, истории, доступов, инвентаря и launch-gates.

## Обязательный порядок для Codex

1. Не выполнять `git clone` и не пытаться открыть старый `sandbox:` URL.
2. Перейти в корень уже открытого repository.
3. Прочитать `ROCKETCDN_CODEX_START_HERE.md`.
4. Прочитать весь `rocketcdn/CODEX_HANDOFF/README.md`.
5. Прочитать `CODEX_MASTER_HANDOFF.md`, `ACCESS_RUNBOOK.md`, `LAUNCH_CHECKLIST.md` и `AGENTS.md`.
6. Проверить целостность package-parts по `package-parts/PACKAGE_PARTS.sha256`.
7. Сопоставить handoff с текущим `git log` и текущими файлами `rocketcdn/`.
8. До отдельной команды владельца не выполнять deploy, платные генерации, ротацию credential или внешние изменения.

## Локальная проверка

```bash
cd "$(git rev-parse --show-toplevel)"
test -d rocketcdn
test -f ROCKETCDN_CODEX_START_HERE.md
test -f rocketcdn/CODEX_HANDOFF/README.md
test -f rocketcdn/CODEX_HANDOFF/CODEX_MASTER_HANDOFF.md
test -f rocketcdn/CODEX_HANDOFF/ACCESS_RUNBOOK.md
test -f rocketcdn/CODEX_HANDOFF/LAUNCH_CHECKLIST.md
git status --short --branch
```

Actual credential values intentionally are not stored in Git. All known usernames, hostnames, paths, configuration key names and safe connection procedures are in `ACCESS_RUNBOOK.md`.
