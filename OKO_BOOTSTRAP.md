# OKO — универсальный бутстрап (ключи + VPS-агент в любой сессии)

Цель: в ЛЮБОЙ новой сессии Claude Code (любой репозиторий аккаунта) сразу были все
ключи/токены всех проектов (OKO, Tappio, DIESEL, EKAT/МЕТАНОЙА, Hooppy) и доступ к
VPS-агенту (стелс-браузер, постинг, аналитика).

## Как это работает (3 уровня, срабатывает первый доступный)

1. **SessionStart-хук репозитория** (`.claude/settings.json`).
   Если в репо есть `secrets.env.b64` — декодирует его в `secrets.env`, источит в shell,
   вписывает `source` в `~/.bashrc`/`~/.profile` с маркером на конкретный репо
   (идемпотентно, мультирепо). Затем, если есть `OKO_POSTER_TOKEN`, догружает свежие
   ключи с VPS (top-up) — репо-копия всегда актуальна.

2. **Аккаунтный Environment setup script** (ставится 1 раз в claude.ai → Environment).
   Для репозиториев БЕЗ `secrets.env.b64`. Одна строка тянет всё с VPS. Файл со строкой
   Даниэль хранит у себя (в ней боевой токен — не публиковать в открытом виде).

3. **Ручной запуск** в любом чате: `source <(base64 -d secrets.env.b64)` — если файл есть.

## vexec — запуск команд на VPS-агенте из любого чата

После загрузки секретов доступны `OKO_POSTER_URL` и `OKO_POSTER_TOKEN`. Обёртка:

```bash
vexec() {
  curl -s $([ -f /root/.ccr/ca-bundle.crt ] && echo --cacert /root/.ccr/ca-bundle.crt) -m 60 \
    -X POST "$OKO_POSTER_URL" \
    -H "Authorization: Bearer $OKO_POSTER_TOKEN" \
    -H "Content-Type: application/json" \
    --data-binary "$(python3 -c 'import json,sys;print(json.dumps({"cmd":sys.argv[1]}))' "$1")" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("stdout",""));sys.stderr.write(d.get("stderr",""))'
}
```

Примеры:
- `vexec 'cat /opt/oko-poster/cfg/secrets.env | wc -l'` — сколько ключей на VPS.
- `vexec 'systemctl status oko-agents --no-pager | head'` — статус агентов.
- Постинг/аналитика/браузер — команды к поднятым на VPS сервисам.

## Что где лежит
- Ключи (мастер-копия): VPS `/opt/oko-poster/cfg/secrets.env` (доступ закрыт).
- Ключи (репо-копия, base64): `secrets.env.b64` в OKO-TEAM (ветки `claude/adoring-tesla-fFKEd`
  и рабочая). Держится синхронной с VPS.
- Паспорт интеграций: `INTEGRATIONS.md`. Память проекта: `CLAUDE.md`.
- Скиллы: `.claude/skills/` (oko-magic, reels-machine).

## Правило синхронизации (для всех чатов)
Добавил ключ → допиши в `secrets.env` → `base64 -w0 secrets.env > secrets.env.b64` →
пуш в рабочую и дефолтную ветку → обнови VPS-копию (`vexec`), чтобы все 3 уровня совпадали.
