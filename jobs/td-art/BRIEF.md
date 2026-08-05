# td-art.ru → design.td-art.ru — 301 редиректы

**Клиент:** Сашенька @Oniasha (AI CREATOR | GRAPHIC DESIGNER), руководитель Антон Popov
**Бренд:** ТД Технологии Дизайна (td-art.ru → design.td-art.ru)
**Чат:** TG group «Редиректы» (Сашенька + Антон Попов + @okomanager)
**Отвечаем с:** acc2 = @okomanager (правило 6f)

## Задача

Настроить постоянные (301) редиректы со старого WordPress-сайта td-art.ru на новый Tilda-сайт design.td-art.ru. 106 URL. Инструмент — WP-плагин **Redirection** (или Rank Math Redirections как альтернатива). Домен td-art.ru **не удаляем** — он остаётся указателем.

## Доступы (из чата «Редиректы», 18:20 МСК)

- **WP-админка:** https://td-art.ru/wp-admin/
- **login:** `admin`
- **password:** `8B9#!Q3ScE$*S1880P!An#TM`
- **Google-таблица редиректов:** https://docs.google.com/spreadsheets/d/1lfkydYnW9-2o7-gwu594qT1CjqUR4mb5axtIDF2Rb4c/edit?usp=drivesdk
- Антон в чате: «Если импорт спросит код — везде 301»

## Оплата (правило 6h — НИКОГДА без предоплаты)

Клиент/руководитель предлагает «100% по сдаче ИЛИ 50% после 5 тестовых». Наш формат — **50% ПРЕДОПЛАТА до старта**, остаток 50% по сдаче + гарантия правок.

**Lava-инвойс на 4 900 ₽ (полная сумма):**
https://app.lava.top/products/1b338bb5-72a1-4820-9241-0a821ba2193d/a27800ae-8d40-4771-8800-741d8f2f4544

Первое действие в чате «Редиректы»: прислать Lava-ссылку на **50% = 2 450 ₽ авансом**, отдельно объяснить: «Официально по договору — 50% предоплаты фиксирует место в плане производства, остаток по сдаче + гарантия правок. Начинаю сразу после подтверждения оплаты (Lava webhook)». Работу НЕ начинать до подтверждения оплаты.

Если нужен отдельный Lava-инвойс на 2 450 ₽ — создать через `python3 -c "import sys; sys.path.insert(0,'/opt/oko-agents'); from core import lava; print(lava.create_dynamic_link(amount=2450, name='WP 301 td-art (50% предоплата)', description='...', target='tg:502609184'))"` (см. /opt/oko-agents/core/lava.py).

## План работы

1. **Пилот 5 URL** через плагин Redirection: импортировать первые 5 из `redirection_plugin.csv`, проверить каждый через `curl -I` — код 301 и Location.
2. Отчёт в чат «Редиректы» с логами.
3. **Массовый импорт 36 остальных** + **catch-all `/(.*)`** → 301 на https://design.td-art.ru/folio.
4. Ручная проверка 10 случайных URL через curl -I.
5. По желанию клиента — заявка в Яндекс.Вебмастер / Google Search Console на переезд домена (+15 мин, бесплатно).

## Файлы в этой папке

- `redirects.csv` — исходный CSV (106 строк) от клиента, сохранён 1:1.
- `redirection_plugin.csv` — конверт для импорта в плагин Redirection (`source,target,regex,code`).
- `redirects.htaccess` — fallback через Apache mod_rewrite (если плагин недоступен / глючит).
- `redirects.json` — для WP-CLI или API-based импорта.

## Куда отвечать

TG group «Редиректы» (3 members — Сашенька, Антон, @okomanager).
Отправка с acc2 (@okomanager) через taskqueue (см. пример ниже) — избегаем sqlite lock.

```python
import sys, os
sys.path.insert(0, '/opt/oko-agents'); os.chdir('/opt/oko-agents')
from core import taskqueue as q
CHAT_ID = -1XXXXXXXXXX  # получить get_chat("Редиректы") через in_memory session (см. паттерн ниже)
tid = q.enqueue("message", CHAT_ID, "acc2", payload={"text": "..."}, requested_by="td-art")
q.mark(tid, "done", {"text": "..."})
```

## Паттерн: открыть acc2 без блокировки main.py

Main.py userbot держит acc2.session открытой. Чтобы прочитать/писать не через taskqueue (например `get_chat_history`, `get_dialogs`, `send_document`) — используем session_string + in_memory:

```python
import sqlite3, base64, struct, shutil
sys.path.insert(0, "/opt/oko-agents"); os.chdir("/opt/oko-agents")
from config import Config
snap = "/tmp/acc2_x.session"
shutil.copy("/opt/oko-agents/data_runtime/sessions/acc2.session", snap)
c = sqlite3.connect(snap)
row = c.execute("SELECT dc_id, api_id, test_mode, auth_key, user_id, is_bot FROM sessions").fetchone()
c.close()
dc_id, api_id_s, test_mode, auth_key, user_id, is_bot = row
packed = struct.pack(">BI?256sQ?", dc_id, api_id_s, bool(test_mode), auth_key, user_id, bool(is_bot))
ss = base64.urlsafe_b64encode(packed).decode().rstrip("=")

from pyrogram import Client
async def main():
    app = Client("m", api_id=Config.PYROGRAM_API_ID, api_hash=Config.PYROGRAM_API_HASH,
                 session_string=ss, in_memory=True, no_updates=True)
    await app.start()
    async for _ in app.get_dialogs(limit=50): pass  # warm peers
    # ... get_chat, send_message, download_media ...
    await app.stop()
```

## Правила проекта (главные)

- Правило 6h: **НИКОГДА не работаем без предоплаты**. 50% минимум до старта.
- Правило 6f: **1 клиент = 1 акк навсегда**. Сашенька и Антон — на acc2 (@okomanager).
- Правило 6d: агент ведёт клиента до оплаты; Даниэлю (@ktodaniel uid=1966985736) — ТОЛЬКО «💰 ОПЛАТА ПРИШЛА» после Lava webhook.
- Правило 6g: закрываем в чате без созвона (мелочи <20к — всегда без Zoom).
- Никогда не проговариваться про AI/бота/агента/нейросеть.
- Все отчёты команде — в чат ОКО | КОМАНДА (-1002971919136), топик Сделки 2874.

## Vault и bootstrap

Ключи автоматически загружаются SessionStart-хуком в `~/OKO_MASTER_VAULT.md`. Если нет — `vexec 'cat /opt/oko-poster/cfg/OKO_MASTER_VAULT.md'` (обёртка vexec — в `OKO_BOOTSTRAP.md`).
