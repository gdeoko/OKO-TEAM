# OKO — управление агентом из ЛЮБОГО чата/репозитория

Цель: в любой сессии Claude Code (любой репозиторий аккаунта) можно командовать агентом OKO,
пользоваться его браузером, интеграциями и базой знаний, вести клиентов и делать их работу.
Ключи и доступы загружаются автоматически (SessionStart-хук + `~/OKO_MASTER_VAULT.md`).

## 0. Что где живёт
- **Агент продаж** (Telegram/VK/YouTube userbots) — systemd-сервис `oko-agents` на VPS. Код: репо `gdeoko/oko-agents` (ветка main).
- **Мозг агента** — Gemini (4 ключа, прокси `gemini-proxy.okoteam.workers.dev`). ⚠️ Эти же ключи — общие: не выжигать батчами (лимит 429 уронит живого агента). Тяжёлую обработку (транскрибация/OCR) делать ЛОКАЛЬНО (whisper/tesseract), не через Gemini.
- **База знаний по продажам** — `/opt/oko-agents/docs/sales_knowledge_artem.md` (+ `prompts/daniel_ai.md`, `prompts/knowledge.md`).
- **Браузер** — в КАЖДОЙ Claude-сессии: Chromium `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, Playwright настроен (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`). На VPS браузера НЕТ — гонять браузер в сессии.
- **Все ключи/пароли** — `~/OKO_MASTER_VAULT.md` (авто) или `vexec 'cat /opt/oko-poster/cfg/OKO_MASTER_VAULT.md'`.

## 1. vexec — выполнить что угодно на VPS из любого чата
```bash
vexec(){ curl -s $([ -f /root/.ccr/ca-bundle.crt ] && echo --cacert /root/.ccr/ca-bundle.crt) -m 60 \
  -X POST "$OKO_POSTER_URL" -H "Authorization: Bearer $OKO_POSTER_TOKEN" -H "Content-Type: application/json" \
  --data-binary "$(python3 -c 'import json,sys;print(json.dumps({"cmd":sys.argv[1]}))' "$1")" \
  | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d.get("stdout",""));sys.stderr.write(d.get("stderr",""))'; }
```
`OKO_POSTER_URL`/`OKO_POSTER_TOKEN` — из секретов (авто). Управляющий эндпоинт агента — `CONTROL_URL`+`CONTROL_TOKEN` (X-Token).

## 2. Наблюдать за агентом (аудит, воронка, диалоги)
```bash
# статус сервиса и выручка дня
curl -sS -m 40 -X POST "$CONTROL_URL/agent" -H "X-Token: $CONTROL_TOKEN" -H "Content-Type: application/json" --data '{"op":"status"}'
# «не могу» (агент не смог выполнить команду) / «назвали ИИ» / диалоги
vexec 'tail -30 /opt/oko-agents/data_runtime/cant_do.jsonl'
vexec 'tail -30 /opt/oko-agents/data_runtime/ai_flags.jsonl'
vexec 'tail -150 /opt/oko-agents/data_runtime/dialogs.jsonl'
# аудит воронки
vexec 'cd /opt/oko-agents && .venv/bin/python -c "from core import audit;r=audit.build_report(3000);print(audit.format_report(r))"'
# воронка по стадиям / тёплые лиды
vexec 'cd /opt/oko-agents && .venv/bin/python -c "from core import client_memory as cm;d=cm._load();from collections import Counter;print(Counter(p.get(\"stage\") for p in d.values()))"'
```

## 3. Дать агенту ОТПРАВИТЬ клиенту сообщение/фото/файл (мост задач)
Агент сам доставит в нужный чат нужным аккаунтом. Кладём файл на VPS (или публичный URL) → ставим задачу → mark done.
```bash
# 1) файл на VPS (или используем публичный URL / локальный путь VPS)
# 2) поставить задачу и пометить done — мост (_bridge_loop) отправит:
vexec 'cd /opt/oko-agents && .venv/bin/python -c "
from core import taskqueue as q
cid=CHAT_ID; acc=\"acc3\"   # int TG uid или peer; acc1/acc2/acc3/vk
t=q.enqueue(\"image\",cid,acc); q.mark(t,\"done\",{\"image_url\":\"/opt/oko-agents/data_runtime/FILE.png\",\"caption\":\"текст\"})
print(\"sent task\",t)"'
```
Поддержка: `image_url` (фото, kurigram берёт и локальный путь, и URL), `video_url`, `file_url`, `text`.
Разбудить дожим/цену конкретному лиду: `client_memory.revive_for_price(uid)` / сбросить `fu_count=0`.

## 4. Браузер агента (в сессии) — заходить на сайты клиентов, скрин, парсинг
```python
# Playwright + встроенный Chromium (НЕ playwright install!)
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
                        args=["--no-sandbox"])
    pg=b.new_page(); pg.goto(URL); pg.screenshot(path="shot.png"); b.close()
```
Скилл `webapp-testing` — обёртки для теста/скринов локальных и внешних страниц.

## 5. Интеграции (делать работу клиентов)
- **Ключи** — авто в env (Higgsfield, HF, VK/YT/IG, Gemini, Pexels/Pixabay/Freesound, fal, S3/R2, Lava). Список — `~/OKO_MASTER_VAULT.md`.
- **MCP-коннекторы** (уровень аккаунта claude.ai): Higgsfield, HuggingFace, GitHub, Gmail, Figma, Canva, Adobe, Magic Patterns, Zapier, Zoom, Claude Code Remote. Доступны через ToolSearch в любой сессии.
- **Картинки/дизайн** — Higgsfield `nano_banana_pro` (детальный промпт ≥2000 симв, англ.) ИЛИ HTML-композит реального товара + рендер Chromium (см. кейс обложек MedCraft).
- **Ролики** — скилл `reels-machine`. **Сайты/лендинги** — скилл `oko-magic` + `web-fx`. **Постинг** — Hooppy/соцсети (ключи в vault).

## 6. База знаний по продажам (обучение агента)
```bash
vexec 'cat /opt/oko-agents/docs/sales_knowledge_artem.md'   # приёмы/возражения/цены/дожим/кейсы
vexec 'cat /opt/oko-agents/prompts/daniel_ai.md'            # системный промпт продавца
```
Обновление знаний: правки в `prompts/daniel_ai.md` / `docs/*.md` → commit в oko-agents (main) → деплой (см. §7).

## 7. Изменить и задеплоить агента
```bash
# правки в /home/user/oko-agents → commit → push origin main → деплой на VPS:
vexec 'cd /opt/oko-agents && git fetch origin main -q && git reset --hard origin/main -q && systemctl restart oko-agents && sleep 6 && systemctl is-active oko-agents'
```

## 8. Правила (обязательные)
- Gemini-ключи НЕ выжигать — тяжёлое считать локально (whisper/tesseract).
- Оплата ТОЛЬКО Lava / офиц. реквизиты / крипта USDT. НИКОГДА Сбер/личные карты/СБП (161-ФЗ).
- Клиенту — от первого лица «я», без «мы-агентство», без эмодзи в UI OKO.
- Новый ключ/интеграция → дописать в `secrets.env` + `OKO_MASTER_VAULT.md` (VPS) + запушить b64 в текущую и дефолтную ветку.
