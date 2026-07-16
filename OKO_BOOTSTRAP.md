# OKO · Универсальный бутстрап (агент + все ключи в ЛЮБОЙ сессии/репозитории)

Проблема: секреты грузятся только в чатах репо OKO-TEAM (через SessionStart-хук). В других
репозиториях/сессиях аккаунта их нет. Решение — один источник правды на VPS + бутстрап-строка,
которая тянет ВСЕ ключи и доступ к VPS-агенту из любой сессии.

## Как работает
- Плейнтекст-секреты лежат на VPS: `/opt/oko-poster/cfg/secrets.env` (chmod 600).
- Бутстрап-строка через `$OKO_VPS_CTRL_URL/exec` (Bearer `$OKO_VPS_CTRL_TOKEN`) читает их и
  `source`-ит в текущий shell. Работает из любой сессии (исходящий HTTPS есть везде).

## Куда вставить (чтобы работало ВЕЗДЕ автоматически)
Claude Code → настройки **Environment** твоего аккаунта → **Setup script** (или переменная,
запускающая команду на старте) → вставить ОДНУ строку бутстрапа. Тогда КАЖДАЯ новая сессия в этом
окружении (любой репозиторий) сама загрузит все ключи + получит VPS-агента.
Также строку можно выполнить вручную в любом чате разово.

Готовая строка (с токеном) — выдана Даниэлю в чат/файлом (содержит боевой токен, поэтому в git тут
только шаблон). Шаблон:
```
source <(curl -s $([ -f /root/.ccr/ca-bundle.crt ] && echo --cacert /root/.ccr/ca-bundle.crt) -m 30 \
  -X POST "$OKO_VPS_CTRL_URL/exec" -H "Authorization: Bearer $OKO_VPS_CTRL_TOKEN" \
  -H "Content-Type: application/json" --data-binary '{"cmd":"cat /opt/oko-poster/cfg/secrets.env"}' \
  | python3 -c 'import sys,json;print(json.load(sys.stdin).get("stdout",""))')
```

## Что даёт после загрузки
- Все 68+ ключей: соцсети (IG/YT/TikTok все проекты), Hooppy, HF/Pexels/Freesound/Sketchfab,
  бот-токен, page_id, refresh-токены и т.д.
- Доступ к **VPS-агенту** (patchright-браузер, постинг, аналитика): `$OKO_VPS_CTRL_URL` + токен.
  Мини-обёртка для запуска команд на VPS из любой сессии:
```
vexec(){ curl -s $([ -f /root/.ccr/ca-bundle.crt ] && echo --cacert /root/.ccr/ca-bundle.crt) -m "${2:-120}" \
  -X POST "$OKO_VPS_CTRL_URL/exec" -H "Authorization: Bearer $OKO_VPS_CTRL_TOKEN" \
  -H "Content-Type: application/json" --data-binary "{\"cmd\":$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$1")}" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("stdout",""));sys.stderr.write(d.get("stderr","") or "")'; }
```

## Синхронизация секретов
Источник правды секретов — `secrets.env.b64` (дефолтная ветка) И `/opt/oko-poster/cfg/secrets.env`
на VPS. При добавлении/смене ключа обновлять ОБА (append-only). Обновление VPS-копии:
`base64 -d secrets.env.b64 | base64 -w0` → передать на VPS и `base64 -d > cfg/secrets.env`.

## Полный доступ между чатами
Память/паспорт/скиллы проекта живут в репо OKO-TEAM (дефолтная ветка): `INTEGRATIONS.md`,
`brain/Claude/Projects/`, `.claude/skills/`. Любая сессия может клонировать OKO-TEAM (если у аккаунта
есть доступ) или тянуть нужные файлы с VPS тем же `vexec`.
