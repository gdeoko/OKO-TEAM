"""
EXORA Telegram Bot — обмен криптовалют
aiogram 3.x, long-polling, SQLite для заявок, курс Binance/CoinGecko.

Запуск:
    export EXORA_BOT_TOKEN=8896081639:AAG0W8CNdCD-cRL-GtcSN6BNiHShoCyL6fU
    export EXORA_MINIAPP_URL=https://exora-app.higgsfield.app
    export EXORA_ADMIN_IDS=123456789,987654321
    export EXORA_SUPPORT=@exora_support
    python3 bot.py
"""
import os, json, asyncio, sqlite3, logging, time, re, urllib.parse
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

import aiohttp
from aiohttp import web
from aiogram import Bot, Dispatcher, F, Router, types
from aiogram.enums import ParseMode, ChatAction
from aiogram.filters import Command, CommandStart, CommandObject
from aiogram.client.default import DefaultBotProperties
from aiogram.types import (
    InlineKeyboardMarkup, InlineKeyboardButton, ReplyKeyboardMarkup, KeyboardButton,
    WebAppInfo, MenuButtonWebApp, BotCommand, BotCommandScopeDefault,
    Message, CallbackQuery, ContentType,
)

# ----- config -----
BOT_TOKEN     = os.environ["EXORA_BOT_TOKEN"]
MINIAPP_URL   = os.environ.get("EXORA_MINIAPP_URL", "https://exora-app.higgsfield.app")
ADMIN_IDS     = [int(x) for x in os.environ.get("EXORA_ADMIN_IDS", "").split(",") if x.strip().isdigit()]
SUPPORT_HANDLE= os.environ.get("EXORA_SUPPORT", "@exora_support")
BRAND_NAME    = os.environ.get("EXORA_BRAND", "Exora")
COMPANY_ADDR  = os.environ.get("EXORA_ADDR", "Россия · онлайн 24/7")

DB_PATH       = Path(os.environ.get("EXORA_DB", "/opt/exora-bot/data/exora.sqlite"))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

API_PORT      = int(os.environ.get("EXORA_API_PORT", "8093"))
API_TOKEN     = os.environ.get("EXORA_API_TOKEN", "exora-admin-2026")

LOG_LEVEL = os.environ.get("EXORA_LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=LOG_LEVEL, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("exora")

# ----- storage -----
def db_conn():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL")
    return con

def db_init():
    con = db_conn()
    con.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        tg_id       INTEGER PRIMARY KEY,
        username    TEXT,
        first_name  TEXT,
        last_name   TEXT,
        created_at  INTEGER,
        last_seen   INTEGER,
        source      TEXT,
        ref_by      INTEGER,
        lang        TEXT DEFAULT 'ru'
    );
    CREATE TABLE IF NOT EXISTS orders (
        id           TEXT PRIMARY KEY,
        tg_id        INTEGER,
        created_at   INTEGER,
        direction    TEXT,
        network      TEXT,
        give_amount  REAL,
        give_cur     TEXT,
        get_amount   REAL,
        get_cur      TEXT,
        rate         REAL,
        wallet       TEXT,
        contact      TEXT,
        status       TEXT DEFAULT 'new',
        admin_note   TEXT,
        raw          TEXT
    );
    CREATE TABLE IF NOT EXISTS settings (
        key   TEXT PRIMARY KEY,
        value TEXT
    );
    """)
    con.commit()
    # defaults
    defaults = {
        "markup_buy":  "1.02",
        "markup_sell": "0.98",
        "min_usdt":    "300",
        "max_usdt":    "100000",
        "welcome_text": "",
        "about_text":   "",
    }
    for k, v in defaults.items():
        con.execute("INSERT OR IGNORE INTO settings(key,value) VALUES(?,?)", (k, v))
    con.commit()
    con.close()

def upsert_user(u: types.User, source: str = "", ref_by: Optional[int] = None):
    now = int(time.time())
    con = db_conn()
    con.execute("""
        INSERT INTO users(tg_id, username, first_name, last_name, created_at, last_seen, source, ref_by)
        VALUES(?,?,?,?,?,?,?,?)
        ON CONFLICT(tg_id) DO UPDATE SET
          username=excluded.username,
          first_name=excluded.first_name,
          last_name=excluded.last_name,
          last_seen=excluded.last_seen
    """, (u.id, u.username or "", u.first_name or "", u.last_name or "", now, now, source, ref_by))
    con.commit()
    con.close()

def save_order(order: dict, tg_id: int) -> str:
    oid = order.get("id") or ("EX-" + hex(int(time.time()))[2:].upper())
    con = db_conn()
    con.execute("""
        INSERT OR REPLACE INTO orders(id, tg_id, created_at, direction, network,
            give_amount, give_cur, get_amount, get_cur, rate, wallet, contact, status, raw)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    """, (oid, tg_id, int(time.time()),
          order.get("direction"), order.get("network"),
          float(order.get("give") or 0), order.get("giveCur"),
          float(order.get("get") or 0), order.get("getCur"),
          float(order.get("rate") or 0), order.get("wallet"), order.get("contact"),
          "new", json.dumps(order, ensure_ascii=False)))
    con.commit()
    con.close()
    return oid

def list_orders(tg_id: Optional[int] = None, limit: int = 20):
    con = db_conn()
    if tg_id:
        rows = con.execute("SELECT * FROM orders WHERE tg_id=? ORDER BY created_at DESC LIMIT ?", (tg_id, limit)).fetchall()
    else:
        rows = con.execute("SELECT * FROM orders ORDER BY created_at DESC LIMIT ?", (limit,)).fetchall()
    con.close()
    return rows

def get_setting(key, default=""):
    con = db_conn()
    row = con.execute("SELECT value FROM settings WHERE key=?", (key,)).fetchone()
    con.close()
    return row["value"] if row else default

def set_setting(key, value):
    con = db_conn()
    con.execute("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, str(value)))
    con.commit()
    con.close()

# ----- rate fetcher -----
_rate_cache = {"ts": 0, "value": 0.0, "src": ""}

async def fetch_rate() -> tuple[float, str]:
    now = time.time()
    if now - _rate_cache["ts"] < 20 and _rate_cache["value"]:
        return _rate_cache["value"], _rate_cache["src"]
    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=8)) as s:
        # 1. Binance
        try:
            async with s.get("https://api.binance.com/api/v3/ticker/price?symbol=USDTRUB") as r:
                j = await r.json()
                if "price" in j:
                    v = float(j["price"])
                    _rate_cache.update(ts=now, value=v, src="Binance"); return v, "Binance"
        except Exception as e:
            log.warning(f"binance fail: {e}")
        # 2. CoinGecko
        try:
            async with s.get("https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=rub") as r:
                j = await r.json()
                v = float(j["tether"]["rub"])
                _rate_cache.update(ts=now, value=v, src="CoinGecko"); return v, "CoinGecko"
        except Exception as e:
            log.warning(f"coingecko fail: {e}")
    return _rate_cache["value"] or 100.0, _rate_cache["src"] or "резерв"

# ----- keyboards -----
def kb_main() -> ReplyKeyboardMarkup:
    return ReplyKeyboardMarkup(
        keyboard=[
            [KeyboardButton(text="💱 Обмен USDT", web_app=WebAppInfo(url=MINIAPP_URL))],
            [KeyboardButton(text="📊 Курс"), KeyboardButton(text="📋 Мои заявки")],
            [KeyboardButton(text="🛡 AML проверка"), KeyboardButton(text="💬 Поддержка")],
            [KeyboardButton(text="ℹ️ О нас")],
        ],
        resize_keyboard=True, input_field_placeholder="Выберите действие"
    )

def kb_open_app() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text="💱 Открыть Exora", web_app=WebAppInfo(url=MINIAPP_URL))],
        [InlineKeyboardButton(text="💬 Поддержка", url=f"https://t.me/{SUPPORT_HANDLE.lstrip('@')}")],
    ])

def kb_admin_order(order_id: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[
        [
            InlineKeyboardButton(text="✅ В работу",  callback_data=f"ord:process:{order_id}"),
            InlineKeyboardButton(text="🎯 Готово",    callback_data=f"ord:done:{order_id}"),
        ],
        [InlineKeyboardButton(text="❌ Отмена",     callback_data=f"ord:cancel:{order_id}")],
    ])

# ----- texts -----
def fmt_money(n, d=2):
    try:
        s = f"{float(n):,.{d}f}".replace(",", " ").replace(".", ",")
    except Exception:
        s = str(n)
    if d == 2 and s.endswith(",00"): s = s[:-3]
    return s

def net_ru(n): return {"TRC20":"TRC-20","ERC20":"ERC-20","BEP20":"BEP-20","TON":"TON"}.get(n, n)

def welcome_text(user: types.User, rate: float, src: str) -> str:
    hi = f"Здравствуйте, <b>{user.first_name or 'друг'}</b>! 👋"
    custom = get_setting("welcome_text", "")
    if custom.strip():
        return f"{hi}\n\n{custom}"
    return (
        f"{hi}\n\n"
        f"Добро пожаловать в <b>{BRAND_NAME}</b> — обмен криптовалют онлайн 🪙\n\n"
        f"📍 <b>Где мы:</b> {COMPANY_ADDR}\n"
        f"🕐 <b>Режим работы:</b> 24/7, без выходных\n"
        f"💵 <b>Работаем с:</b> RUB / USDT (TRC-20, ERC-20, BEP-20, TON)\n"
        f"📈 <b>Лучший курс:</b> {fmt_money(rate)} ₽ за 1 USDT · <i>{src}</i>\n"
        f"💯 <b>Комиссия сервиса:</b> 0%\n"
        f"⚡ <b>Скорость обмена:</b> 10–30 минут\n\n"
        f"👇 Нажмите <b>«💱 Обмен USDT»</b>, чтобы создать заявку в мини-приложении.\n"
        f"Или воспользуйтесь кнопками ниже."
    )

def about_text() -> str:
    custom = get_setting("about_text", "")
    if custom.strip(): return custom
    return (
        f"<b>{BRAND_NAME}</b> — сервис быстрого обмена криптовалют.\n\n"
        f"🕐 Работаем 24/7\n"
        f"💯 Без комиссий\n"
        f"📈 Лучший курс USDT\n"
        f"🛡 AML-проверка кошельков\n"
        f"⚡ Оператор, а не бот\n"
        f"🌐 Сети: TRC-20, ERC-20, BEP-20, TON\n\n"
        f"<b>Лимиты:</b>\n"
        f"• Мин. сумма: 300 USDT\n"
        f"• Макс. сумма: 100 000 USDT\n\n"
        f"<b>Поддержка:</b> {SUPPORT_HANDLE}"
    )

def order_client_text(o: dict, oid: str) -> str:
    dir_ru = "Купить USDT" if o.get("direction") == "buy" else "Продать USDT"
    give_cur = o.get("giveCur", "")
    get_cur  = o.get("getCur", "")
    return (
        f"🎉 <b>Заявка #{oid} создана!</b>\n\n"
        f"<b>Направление:</b> {dir_ru}\n"
        f"<b>Сеть:</b> {net_ru(o.get('network'))}\n"
        f"<b>Отдаёте:</b> {fmt_money(o.get('give'), 4 if give_cur!='RUB' else 2)} {give_cur}\n"
        f"<b>Получаете:</b> {fmt_money(o.get('get'), 4 if get_cur!='RUB' else 2)} {get_cur}\n"
        f"<b>Курс:</b> {fmt_money(o.get('rate'))} ₽/USDT\n\n"
        f"⏱ <b>Оператор свяжется с вами в течение 5–15 минут</b>\n"
        f"через: <code>{o.get('contact','')}</code>\n\n"
        f"⚠️ <b>Важно:</b>\n"
        f"• Не переводите средства до подтверждения оператором\n"
        f"• Проверьте адрес и сеть — ошибка приведёт к потере средств\n\n"
        f"💬 Вопросы: {SUPPORT_HANDLE}"
    )

def order_admin_text(o: dict, oid: str, user: dict) -> str:
    dir_ru = "🟢 Купить USDT" if o.get("direction") == "buy" else "🔴 Продать USDT"
    uname = f"@{user.get('username')}" if user.get("username") else f"id{user.get('id')}"
    fname = user.get("first_name") or ""
    return (
        f"🔔 <b>НОВАЯ ЗАЯВКА #{oid}</b>\n\n"
        f"<b>{dir_ru}</b>\n"
        f"<b>Клиент:</b> {fname} ({uname}, <code>{user.get('id')}</code>)\n"
        f"<b>Сеть:</b> {net_ru(o.get('network'))}\n\n"
        f"<b>Отдаёт:</b> {fmt_money(o.get('give'), 4 if o.get('giveCur')!='RUB' else 2)} {o.get('giveCur','')}\n"
        f"<b>Получает:</b> {fmt_money(o.get('get'), 4 if o.get('getCur')!='RUB' else 2)} {o.get('getCur','')}\n"
        f"<b>Курс:</b> {fmt_money(o.get('rate'))} ₽/USDT\n\n"
        f"<b>Реквизиты клиента:</b>\n<code>{o.get('wallet','')}</code>\n\n"
        f"<b>Контакт:</b> <code>{o.get('contact','')}</code>\n"
        f"<i>{datetime.now(timezone(timedelta(hours=3))).strftime('%d.%m.%Y %H:%M МСК')}</i>"
    )

# ----- bot -----
bot = Bot(BOT_TOKEN, default=DefaultBotProperties(parse_mode=ParseMode.HTML))
dp  = Dispatcher()
router = Router()
dp.include_router(router)


@router.message(CommandStart(deep_link=True))
@router.message(CommandStart())
async def cmd_start(msg: Message, command: CommandObject = None):
    args = command.args if command else ""
    source, ref_by = "direct", None
    if args:
        if args.startswith("ref_"):
            source = "referral"
            try: ref_by = int(args[4:])
            except: pass
        elif args == "support":
            source = "support_link"
        else:
            source = args[:32]
    upsert_user(msg.from_user, source=source, ref_by=ref_by)
    r, src = await fetch_rate()
    await msg.answer(welcome_text(msg.from_user, r, src), reply_markup=kb_main())
    await msg.answer("Готовы обменять USDT? Нажмите кнопку ниже 👇", reply_markup=kb_open_app())


@router.message(F.web_app_data)
async def h_web_app(msg: Message):
    try:
        data = json.loads(msg.web_app_data.data)
    except Exception as e:
        await msg.answer(f"⚠️ Ошибка данных от мини-приложения: {e}")
        return
    if data.get("type") != "order":
        await msg.answer("Действие принято.")
        return
    o = data.get("order") or {}
    upsert_user(msg.from_user)
    oid = save_order(o, msg.from_user.id)
    # Ответ клиенту
    await msg.answer(order_client_text(o, oid))
    # Уведомление админам
    user = {"id": msg.from_user.id, "username": msg.from_user.username, "first_name": msg.from_user.first_name}
    for aid in ADMIN_IDS:
        try:
            await bot.send_message(aid, order_admin_text(o, oid, user), reply_markup=kb_admin_order(oid))
        except Exception as e:
            log.warning(f"admin notify {aid}: {e}")


@router.message(Command("rate"))
@router.message(F.text == "📊 Курс")
async def h_rate(msg: Message):
    await bot.send_chat_action(msg.chat.id, ChatAction.TYPING)
    r, src = await fetch_rate()
    now = datetime.now(timezone(timedelta(hours=3))).strftime('%H:%M МСК')
    txt = (
        f"📊 <b>Актуальный курс {BRAND_NAME}</b>\n\n"
        f"🪙 <b>1 USDT = {fmt_money(r)} ₽</b>\n"
        f"📈 Покупка (клиент отдаёт RUB): {fmt_money(r * float(get_setting('markup_buy','1.02')))} ₽\n"
        f"📉 Продажа (клиент получает RUB): {fmt_money(r * float(get_setting('markup_sell','0.98')))} ₽\n\n"
        f"<i>Обновлено {now} · источник: {src}</i>\n\n"
        f"💯 Комиссия сервиса — 0%\n"
        f"⚡ Курс обновляется каждые 30 секунд"
    )
    await msg.answer(txt, reply_markup=kb_open_app())


@router.message(Command("myorders"))
@router.message(F.text == "📋 Мои заявки")
async def h_orders(msg: Message):
    rows = list_orders(tg_id=msg.from_user.id, limit=10)
    if not rows:
        await msg.answer("У вас пока нет заявок. Создайте первую в мини-приложении 👇", reply_markup=kb_open_app())
        return
    lines = [f"📋 <b>Ваши заявки</b> · всего {len(rows)}\n"]
    status_ru = {"new":"🆕 Новая", "processing":"⏳ В работе", "completed":"✅ Выполнена", "cancelled":"❌ Отменена"}
    for r in rows:
        d = "Купить USDT" if r["direction"] == "buy" else "Продать USDT"
        when = datetime.fromtimestamp(r["created_at"], timezone(timedelta(hours=3))).strftime('%d.%m %H:%M')
        lines.append(
            f"<b>#{r['id']}</b> · {when}\n"
            f"{d} · {net_ru(r['network'])}\n"
            f"{fmt_money(r['give_amount'], 4 if r['give_cur']!='RUB' else 2)} {r['give_cur']} → "
            f"<b>{fmt_money(r['get_amount'], 4 if r['get_cur']!='RUB' else 2)} {r['get_cur']}</b>\n"
            f"{status_ru.get(r['status'], r['status'])}\n"
        )
    await msg.answer("\n".join(lines))


@router.message(Command("about"))
@router.message(F.text == "ℹ️ О нас")
async def h_about(msg: Message):
    await msg.answer(about_text(), reply_markup=kb_open_app())


@router.message(Command("support"))
@router.message(F.text == "💬 Поддержка")
async def h_support(msg: Message):
    await msg.answer(
        f"💬 <b>Поддержка {BRAND_NAME}</b>\n\n"
        f"Пишите нам в любое время — оператор ответит в течение 5–15 минут.\n\n"
        f"🔗 {SUPPORT_HANDLE}\n\n"
        f"Или создайте заявку в мини-приложении — оператор свяжется по указанному контакту 👇",
        reply_markup=kb_open_app()
    )


@router.message(Command("aml"))
@router.message(F.text == "🛡 AML проверка")
async def h_aml(msg: Message, command: CommandObject = None):
    args = (command.args if command else "").strip() if command else ""
    if not args and msg.text and " " in msg.text:
        args = msg.text.split(maxsplit=1)[1].strip()
    if args:
        result = await aml_check_full(args)
        await msg.answer(format_aml_result(args, result), disable_web_page_preview=True)
        return
    await msg.answer(
        "🛡 <b>AML проверка кошелька — автоматически</b>\n\n"
        "Пришлите адрес кошелька — я мгновенно проверю через открытые источники:\n"
        "• <b>TRC-20</b> (Tron) → TronScan\n"
        "• <b>ERC-20 / BEP-20</b> (Ethereum / BSC) → GoPlus Security\n"
        "• <b>TON</b> → TON Center\n\n"
        "Результат: возраст кошелька, кол-во транзакций, чёрные списки, риск-скор.\n\n"
        "Или используйте команду: <code>/aml TXxxxxxxxx…</code>"
    )


ADDR_PATTERNS = [
    ("TRC20", re.compile(r"\b(T[a-km-zA-HJ-NP-Z1-9]{33})\b")),
    ("ERC20", re.compile(r"\b(0x[a-fA-F0-9]{40})\b")),
    ("TON",   re.compile(r"\b((?:UQ|EQ)[A-Za-z0-9_-]{46})\b")),
]

def detect_address(text: str):
    for net, p in ADDR_PATTERNS:
        m = p.search(text or "")
        if m: return net, m.group(1)
    return None, None


async def aml_check_full(address: str, network: str = None) -> dict:
    """Auto AML check via public APIs. Returns {risk:0-100, age_days, tx_count, balance, source, verdict}."""
    if not network:
        net, addr = detect_address(address)
        network = net or "TRC20"
        address = addr or address

    result = {"risk": 50, "age_days": None, "tx_count": None, "balance": None,
              "source": "unknown", "verdict": "unknown", "network": network, "address": address}

    async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=8)) as s:
        try:
            if network == "TRC20":
                # TronScan API
                async with s.get(f"https://apilist.tronscan.org/api/account?address={address}") as r:
                    j = await r.json()
                    age_days = None
                    if j.get("date_created"):
                        age_days = int((time.time() * 1000 - int(j["date_created"])) / 86400000)
                    tx_count = j.get("totalTransactionCount", 0) or 0
                    balance = (j.get("balance", 0) or 0) / 1_000_000
                    is_black = bool(j.get("blackListInfo")) or bool(j.get("blackList"))
                    risk = 5
                    if is_black: risk = 95
                    elif tx_count == 0 and (age_days is None or age_days < 1): risk = 55
                    elif age_days is not None and age_days < 7: risk = 40
                    elif tx_count < 5: risk = 25
                    result.update({
                        "risk": risk, "age_days": age_days, "tx_count": tx_count,
                        "balance": balance, "source": "TronScan",
                        "verdict": "danger" if risk >= 65 else ("warn" if risk >= 30 else "safe"),
                    })
                    return result

            if network in ("ERC20", "BEP20"):
                # GoPlus Security
                chain = "1" if network == "ERC20" else "56"
                async with s.get(f"https://api.gopluslabs.io/api/v1/address_security/{address}?chain_id={chain}") as r:
                    j = await r.json()
                    d = j.get("result", {}) if j else {}
                    risk = 5
                    flags = ["blacklist_doubt", "blackmail_activities", "cybercrime",
                             "darkweb_transactions", "money_laundering", "phishing_activities",
                             "sanctioned", "stealing_attack", "financial_crime"]
                    matched = [f for f in flags if str(d.get(f, "0")) == "1"]
                    if matched:
                        risk = 95
                    elif str(d.get("honeypot_related_address", "0")) == "1":
                        risk = 70
                    elif str(d.get("fake_kyc", "0")) == "1":
                        risk = 60
                    elif str(d.get("mixer", "0")) == "1":
                        risk = 55
                    result.update({
                        "risk": risk, "source": "GoPlus",
                        "flags": matched,
                        "verdict": "danger" if risk >= 65 else ("warn" if risk >= 30 else "safe"),
                    })
                    return result

            if network == "TON":
                # TON Center
                async with s.get(f"https://toncenter.com/api/v2/getAddressInformation?address={address}") as r:
                    j = await r.json()
                    rr = j.get("result", {}) if j else {}
                    balance = int(rr.get("balance", 0) or 0) / 1_000_000_000
                    state = rr.get("state", "")
                    risk = 20 if state == "uninitialized" else 8
                    result.update({
                        "risk": risk, "balance": balance, "source": "TON Center",
                        "verdict": "safe" if risk < 30 else "warn",
                    })
                    return result
        except Exception as e:
            log.warning(f"aml {network} {address}: {e}")
            result["error"] = str(e)

    return result


def format_aml_result(query: str, r: dict) -> str:
    if r.get("error") or not r.get("source"):
        return (f"🛡 <b>AML проверка</b>\n\n"
                f"<code>{query}</code>\n\n"
                f"Не удалось получить данные из открытых источников. "
                f"Пришлите адрес в поддержку {SUPPORT_HANDLE} — оператор проверит через профессиональный сервис.")
    verdict = r.get("verdict", "unknown")
    emoji = {"safe":"🟢", "warn":"🟡", "danger":"🔴"}.get(verdict, "⚪")
    label = {"safe":"Кошелёк чистый", "warn":"Требует внимания", "danger":"Высокий риск"}.get(verdict, "Неопределено")
    net = r.get("network", "?")
    risk = r.get("risk", 0)
    lines = [f"🛡 <b>AML проверка · {net}</b>\n",
             f"<code>{r.get('address', query)}</code>\n",
             f"{emoji} <b>{label}</b>  ·  риск <b>{risk}%</b>\n"]
    if r.get("age_days") is not None:
        lines.append(f"📅 Возраст: <b>{r['age_days']} дней</b>")
    if r.get("tx_count") is not None:
        lines.append(f"🔄 Транзакций: <b>{r['tx_count']:,}</b>".replace(",", " "))
    if r.get("balance") is not None:
        lines.append(f"💰 Баланс: <b>{r['balance']:.4f}</b>")
    if r.get("flags"):
        lines.append(f"⚠️ Флаги: <b>{', '.join(r['flags'])}</b>")
    lines.append(f"\n<i>Источник: {r.get('source','?')} · автоматически</i>")
    if verdict != "safe":
        lines.append(f"\n💬 Для профессиональной AML — {SUPPORT_HANDLE}")
    return "\n".join(lines)


@router.callback_query(F.data.startswith("ord:"))
async def h_admin_action(cb: CallbackQuery):
    if cb.from_user.id not in ADMIN_IDS:
        await cb.answer("Только для админов", show_alert=True); return
    _, action, oid = cb.data.split(":", 2)
    new_status = {"process":"processing", "done":"completed", "cancel":"cancelled"}.get(action)
    if not new_status:
        await cb.answer("?"); return
    con = db_conn()
    row = con.execute("SELECT * FROM orders WHERE id=?", (oid,)).fetchone()
    if not row: await cb.answer("Заявка не найдена", show_alert=True); con.close(); return
    con.execute("UPDATE orders SET status=? WHERE id=?", (new_status, oid))
    con.commit(); con.close()
    # уведомить клиента
    if row["tg_id"]:
        try:
            emoji = {"processing":"⏳", "completed":"✅", "cancelled":"❌"}[new_status]
            label = {"processing":"взята в работу", "completed":"выполнена", "cancelled":"отменена"}[new_status]
            await bot.send_message(row["tg_id"], f"{emoji} Ваша заявка <b>#{oid}</b> {label}.")
        except Exception as e:
            log.warning(f"notify client {row['tg_id']}: {e}")
    await cb.answer(f"Статус: {new_status}", show_alert=False)
    try:
        await cb.message.edit_reply_markup(reply_markup=None)
        await cb.message.reply(f"Статус заявки <b>#{oid}</b> → <b>{new_status}</b>")
    except Exception: pass


@router.message(Command("admin"))
async def h_admin(msg: Message):
    if msg.from_user.id not in ADMIN_IDS:
        await msg.answer("Доступ только для админов."); return
    con = db_conn()
    stats = con.execute("SELECT COUNT(*) c, SUM(CASE WHEN status='new' THEN 1 ELSE 0 END) new_c, SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) done_c FROM orders").fetchone()
    users = con.execute("SELECT COUNT(*) c FROM users").fetchone()
    con.close()
    r, src = await fetch_rate()
    await msg.answer(
        f"👨‍💻 <b>Админ-панель {BRAND_NAME}</b>\n\n"
        f"👥 Пользователей: <b>{users['c']}</b>\n"
        f"📋 Заявок всего: <b>{stats['c']}</b>\n"
        f"🆕 Новых: <b>{stats['new_c'] or 0}</b>\n"
        f"✅ Выполнено: <b>{stats['done_c'] or 0}</b>\n\n"
        f"💵 Текущий курс: <b>{fmt_money(r)} ₽</b> ({src})\n"
        f"📈 Наценка buy: <b>{get_setting('markup_buy','1.02')}</b>\n"
        f"📉 Наценка sell: <b>{get_setting('markup_sell','0.98')}</b>\n\n"
        f"Команды:\n"
        f"/admin_orders — все заявки\n"
        f"/admin_set markup_buy 1.02 — правка настройки\n"
        f"/admin_broadcast — рассылка\n"
    )


@router.message(Command("admin_orders"))
async def h_admin_orders(msg: Message):
    if msg.from_user.id not in ADMIN_IDS: return
    rows = list_orders(limit=15)
    if not rows: await msg.answer("Заявок пока нет."); return
    lines = [f"📋 <b>Последние {len(rows)} заявок</b>\n"]
    st = {"new":"🆕", "processing":"⏳", "completed":"✅", "cancelled":"❌"}
    for r in rows:
        when = datetime.fromtimestamp(r["created_at"], timezone(timedelta(hours=3))).strftime('%d.%m %H:%M')
        d = "Buy" if r["direction"] == "buy" else "Sell"
        lines.append(f"{st.get(r['status'],'?')} <b>#{r['id']}</b> · {when} · {d} · {fmt_money(r['give_amount'])} {r['give_cur']} → {fmt_money(r['get_amount'])} {r['get_cur']}")
    await msg.answer("\n".join(lines))


@router.message(Command("admin_set"))
async def h_admin_set(msg: Message, command: CommandObject):
    if msg.from_user.id not in ADMIN_IDS: return
    if not command.args:
        await msg.answer("Использование: <code>/admin_set key value</code>"); return
    parts = command.args.strip().split(maxsplit=1)
    if len(parts) != 2: await msg.answer("Нужно ключ и значение"); return
    k, v = parts
    set_setting(k, v)
    await msg.answer(f"✅ <code>{k}</code> = <code>{v}</code>")


@router.message(Command("admin_broadcast"))
async def h_admin_broadcast(msg: Message, command: CommandObject):
    if msg.from_user.id not in ADMIN_IDS: return
    text = command.args or ""
    if not text.strip():
        await msg.answer("Использование: <code>/admin_broadcast Текст сообщения</code>"); return
    con = db_conn()
    rows = con.execute("SELECT tg_id FROM users").fetchall()
    con.close()
    ok, fail = 0, 0
    await msg.answer(f"Рассылка на <b>{len(rows)}</b> пользователей…")
    for r in rows:
        try:
            await bot.send_message(r["tg_id"], text)
            ok += 1
            await asyncio.sleep(0.05)  # rate-limit
        except Exception:
            fail += 1
    await msg.answer(f"✅ Готово: {ok} отправлено, {fail} ошибок")


@router.message(F.text)
async def fallback(msg: Message):
    # Auto-detect crypto address in text → run AML
    net, addr = detect_address(msg.text)
    if addr:
        await bot.send_chat_action(msg.chat.id, ChatAction.TYPING)
        r = await aml_check_full(addr, net)
        await msg.answer(format_aml_result(addr, r), disable_web_page_preview=True)
        return
    await msg.answer(
        "Не понял вопрос 🤔\n\nВоспользуйтесь меню внизу или откройте мини-приложение. "
        "Также можете прислать адрес кошелька — я мгновенно проверю через AML.",
        reply_markup=kb_open_app()
    )


async def setup_bot_meta():
    """Setup commands, description, menu button."""
    try:
        await bot.set_my_commands([
            BotCommand(command="start", description="Начать · открыть меню"),
            BotCommand(command="rate", description="Актуальный курс USDT"),
            BotCommand(command="aml", description="AML-проверка кошелька"),
            BotCommand(command="myorders", description="Мои заявки"),
            BotCommand(command="about", description="О компании"),
            BotCommand(command="support", description="Связаться с поддержкой"),
        ], scope=BotCommandScopeDefault())
        log.info("commands set ok")
    except Exception as e:
        log.warning(f"commands: {e}")
    try:
        await bot.set_my_description(
            f"Exora — быстрый обмен USDT ⇄ RUB онлайн. Работаем 24/7, комиссия 0%, курс лучший в регионе. "
            f"Поддержка сетей TRC-20 / ERC-20 / BEP-20 / TON. Оператор, а не бот."
        )
        await bot.set_my_short_description("Обмен криптовалют · 24/7 · 0% комиссии · лучший курс USDT")
        log.info("descriptions set ok")
    except Exception as e:
        log.warning(f"desc: {e}")
    try:
        await bot.set_chat_menu_button(menu_button=MenuButtonWebApp(
            text="💱 Обмен USDT",
            web_app=WebAppInfo(url=MINIAPP_URL),
        ))
        log.info(f"menu button → {MINIAPP_URL}")
    except Exception as e:
        log.warning(f"menu button: {e}")


# ============================================================
#  REST API for admin panel
# ============================================================

def _auth(request: web.Request) -> bool:
    tok = request.headers.get("X-Admin-Token") or request.query.get("token")
    return bool(tok) and tok == API_TOKEN

def _cors(resp: web.Response) -> web.Response:
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Admin-Token"
    resp.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    return resp

async def api_options(request):
    return _cors(web.Response(status=204))

async def api_stats(request):
    if not _auth(request): return _cors(web.json_response({"error":"auth"}, status=401))
    con = db_conn()
    users = con.execute("SELECT COUNT(*) c FROM users").fetchone()["c"]
    tot   = con.execute("SELECT COUNT(*) c FROM orders").fetchone()["c"]
    new_c = con.execute("SELECT COUNT(*) c FROM orders WHERE status='new'").fetchone()["c"]
    done  = con.execute("SELECT COUNT(*) c FROM orders WHERE status='completed'").fetchone()["c"]
    week  = int(time.time()) - 7*86400
    day   = int(time.time()) - 86400
    today = con.execute("SELECT COUNT(*) c FROM orders WHERE created_at>=?", (day,)).fetchone()["c"]
    vol_row = con.execute("""SELECT
        COALESCE(SUM(CASE WHEN get_cur='USDT' THEN get_amount WHEN give_cur='USDT' THEN give_amount ELSE 0 END),0) v
        FROM orders WHERE created_at>=?""", (week,)).fetchone()
    vol = vol_row["v"] or 0
    con.close()
    r, src = await fetch_rate()
    return _cors(web.json_response({
        "users": users, "orders_total": tot, "orders_new": new_c,
        "orders_done": done, "orders_today": today, "volume_7d": vol,
        "rate": r, "rate_source": src,
    }))

async def api_orders_list(request):
    if not _auth(request): return _cors(web.json_response({"error":"auth"}, status=401))
    limit = min(int(request.query.get("limit", "50")), 500)
    con = db_conn()
    rows = con.execute("""
        SELECT o.*, u.username, u.first_name FROM orders o
        LEFT JOIN users u ON u.tg_id=o.tg_id
        ORDER BY o.created_at DESC LIMIT ?
    """, (limit,)).fetchall()
    con.close()
    out = []
    for r in rows:
        out.append({
            "id": r["id"],
            "ts": r["created_at"] * 1000,
            "direction": r["direction"],
            "network": r["network"],
            "give": r["give_amount"], "giveCur": r["give_cur"],
            "get":  r["get_amount"],  "getCur":  r["get_cur"],
            "rate": r["rate"], "wallet": r["wallet"], "contact": r["contact"],
            "status": r["status"], "note": r["admin_note"],
            "uid": r["tg_id"],
            "user": ("@" + r["username"]) if r["username"] else (r["first_name"] or f"id{r['tg_id']}"),
        })
    return _cors(web.json_response({"orders": out}))

async def api_order_patch(request):
    if not _auth(request): return _cors(web.json_response({"error":"auth"}, status=401))
    oid = request.match_info["oid"]
    body = await request.json()
    new_status = body.get("status")
    if new_status not in ("new","processing","completed","cancelled"):
        return _cors(web.json_response({"error":"bad status"}, status=400))
    con = db_conn()
    row = con.execute("SELECT tg_id FROM orders WHERE id=?", (oid,)).fetchone()
    if not row: con.close(); return _cors(web.json_response({"error":"not found"}, status=404))
    con.execute("UPDATE orders SET status=? WHERE id=?", (new_status, oid))
    con.commit(); con.close()
    if row["tg_id"]:
        try:
            emoji = {"processing":"⏳", "completed":"✅", "cancelled":"❌", "new":"🆕"}[new_status]
            label = {"processing":"взята в работу", "completed":"выполнена", "cancelled":"отменена", "new":"возвращена в очередь"}[new_status]
            await bot.send_message(row["tg_id"], f"{emoji} Ваша заявка <b>#{oid}</b> {label}.")
        except Exception as e:
            log.warning(f"notify {row['tg_id']}: {e}")
    return _cors(web.json_response({"ok": True, "id": oid, "status": new_status}))

async def api_settings_get(request):
    if not _auth(request): return _cors(web.json_response({"error":"auth"}, status=401))
    con = db_conn()
    rows = con.execute("SELECT key, value FROM settings").fetchall()
    con.close()
    return _cors(web.json_response({"settings": {r["key"]: r["value"] for r in rows}}))

async def api_setting_put(request):
    if not _auth(request): return _cors(web.json_response({"error":"auth"}, status=401))
    key = request.match_info["key"]
    body = await request.json()
    set_setting(key, str(body.get("value", "")))
    return _cors(web.json_response({"ok": True, "key": key}))

async def api_broadcast(request):
    if not _auth(request): return _cors(web.json_response({"error":"auth"}, status=401))
    body = await request.json()
    text = (body.get("text") or "").strip()
    target = body.get("target", "all")
    if not text: return _cors(web.json_response({"error":"empty"}, status=400))
    con = db_conn()
    if target == "active":
        cutoff = int(time.time()) - 30*86400
        rows = con.execute("SELECT tg_id FROM users WHERE last_seen>=?", (cutoff,)).fetchall()
    else:
        rows = con.execute("SELECT tg_id FROM users").fetchall()
    con.close()
    ok, fail = 0, 0
    for r in rows:
        try:
            await bot.send_message(r["tg_id"], text)
            ok += 1
            await asyncio.sleep(0.05)
        except Exception:
            fail += 1
    return _cors(web.json_response({"ok": ok, "fail": fail, "total": len(rows)}))

async def api_health(request):
    return _cors(web.json_response({"ok": True, "service": "exora-bot", "ts": int(time.time())}))


async def api_aml_check(request):
    # PUBLIC endpoint (no auth) — используется mini-app
    address = request.query.get("address", "").strip()
    network = request.query.get("network", "").strip().upper() or None
    if not address:
        return _cors(web.json_response({"error": "address required"}, status=400))
    r = await aml_check_full(address, network)
    return _cors(web.json_response(r))


def build_api_app() -> web.Application:
    app = web.Application()
    app.router.add_route("OPTIONS", "/{tail:.*}", api_options)
    app.router.add_get ("/api/health",           api_health)
    app.router.add_get ("/api/aml-check",        api_aml_check)
    app.router.add_get ("/api/stats",            api_stats)
    app.router.add_get ("/api/orders",           api_orders_list)
    app.router.add_patch("/api/orders/{oid}",    api_order_patch)
    app.router.add_get ("/api/settings",         api_settings_get)
    app.router.add_put ("/api/settings/{key}",   api_setting_put)
    app.router.add_post("/api/broadcast",        api_broadcast)
    return app


async def main():
    db_init()
    log.info(f"Exora bot starting. Mini-app: {MINIAPP_URL}. Admins: {ADMIN_IDS}. DB: {DB_PATH}")
    await bot.delete_webhook(drop_pending_updates=False)
    await setup_bot_meta()

    # Start REST API server for admin panel
    api = build_api_app()
    runner = web.AppRunner(api)
    await runner.setup()
    site = web.TCPSite(runner, "127.0.0.1", API_PORT)
    await site.start()
    log.info(f"REST API listening on 127.0.0.1:{API_PORT}")

    await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())


if __name__ == "__main__":
    asyncio.run(main())
