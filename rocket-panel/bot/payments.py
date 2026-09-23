"""Приём оплаты. Два канала: Telegram Stars и CryptoBot.

Карты и СБП здесь нет намеренно. У конкурента они есть («Карты, СБП,
криптовалюта, Telegram Stars — подключено и работает»), но карточный
эквайринг для 18+ — отдельный разговор с банком, а не строчка в коде.
Пока не выясним, чей у него эквайринг, делать вид, что он у нас есть,
нельзя: заявка на оплату, которая не проходит, хуже отсутствия кнопки.

## Telegram Stars

Самый простой канал: человек платит внутри Телеграма, ничего не
подключая. Из документации Bot API дословно:

    provider_token — Pass an empty string for payments in Telegram Stars
    currency       — Pass "XTR" for payments in Telegram Stars

Три правила, нарушение каждого стоит платежа:

1. **На pre_checkout_query надо ответить за 10 секунд.** «The Bot API
   must receive an answer within 10 seconds». Не ответили — платёж
   отменяется. Поэтому отвечаем ПЕРВЫМ делом и только потом зачисляем.
2. **Суммы в звёздах целые.** `total_amount` — «in the smallest units
   of the currency»; у звезды дробных единиц нет, так что 100 значит
   сто звёзд, а не рубль.
3. **`telegram_payment_charge_id` надо сохранить.** Без него
   `refundStarPayment` невозможен, а возврат звёзд делается только так.

## CryptoBot

Crypto Pay API, `https://pay.crypt.bot/api/`. Счёт создаётся заранее,
человек уходит по ссылке и платит. Подтверждение приходит вебхуком —
либо опрашиваем `getInvoices` сами, если вебхук не поднят.

## Курс звезды к рублю

Цена звезды у Телеграма меняется и зависит от страны покупателя, а
выплата разработчику отличается от того, что заплатил человек. Поэтому
курс здесь — НАСТРАИВАЕМЫЙ, а не вшитый: `AMBERRY_STARS_PER_RUB`.
Значение по умолчанию заведомо осторожное; сверить с реальной ценой в
кабинете бота и поправить.

Пересчёт округляется ВВЕРХ — в отличие от всего остального прайса, где
мы округляем вниз. Причина: вниз здесь означает продать пакет дешевле
объявленного рубля, а объявленная цена в рублях — та, на которой мы
обещали скидку в четверть.
"""

import hashlib
import hmac
import json
import math
import os
import time
import urllib.parse
import urllib.request

import pricing
import франшиза

# Сколько звёзд в рубле. Сверить с кабинетом бота и поправить: цена
# звезды у Телеграма зависит от страны и меняется.
ЗВЁЗД_ЗА_РУБЛЬ = float(os.environ.get("AMBERRY_STARS_PER_RUB", "0.60"))

CRYPTOBOT_ТОКЕН = os.environ.get("AMBERRY_CRYPTOBOT_TOKEN", "")
CRYPTOBOT_API = "https://pay.crypt.bot/api"

# Курс рубля к доллару для счёта в крипте. Отдельно от pricing.USD_RUB
# нарочно: там он нужен для расчёта себестоимости, здесь — для цены
# клиенту, и меняются они по разным поводам.
USD_RUB = float(os.environ.get("AMBERRY_USD_RUB", str(pricing.USD_RUB)))

ВАЛЮТА_ЗВЁЗД = "XTR"


class ОшибкаОплаты(Exception):
    pass


def звёзд_за(рублей):
    """Рубли -> звёзды, всегда вверх и не меньше одной.

    Вверх — потому что вниз означало бы продать пакет дешевле
    объявленной рублёвой цены, а именно на ней держится обещание
    «на четверть дешевле».
    """
    return max(1, math.ceil(рублей * ЗВЁЗД_ЗА_РУБЛЬ))


def счёт_звёздами(pack_id):
    """Готовые поля для sendInvoice. Отдаёт словарь, а не шлёт сам:
    отправкой занимается bot.py, здесь только деньги."""
    p = pricing.pack(pack_id)
    звёзд = звёзд_за(p["rub"])
    return {
        "title": f"{p['coins']} коинов",
        "description": (f"{p['coins']} {pricing.СИМВОЛ} на баланс AMBERRY. "
                        f"Не сгорают. У других тот же объём — "
                        f"{p['market_rub']} ₽."),
        # payload возвращается в successful_payment — по нему и узнаём,
        # что зачислять. Кладём id пакета и метку времени, чтобы два
        # одинаковых платежа не слиплись в один.
        "payload": f"pack:{p['id']}:{int(time.time())}",
        "provider_token": "",             # пусто = звёзды
        "currency": ВАЛЮТА_ЗВЁЗД,
        "prices": [{"label": f"{p['coins']} {pricing.СИМВОЛ}", "amount": звёзд}],
    }


def счёт_звёздами_франшизы():
    """Франшиза — не коины, и считать её пакетом нельзя: коины сгорают
    в генерациях, а свой бот покупается один раз навсегда."""
    звёзд = звёзд_за(франшиза.РУБЛЕЙ)
    return {
        "title": "Свой бот AMBERRY",
        "description": (f"Твой бот на нашем движке: те же кнопки, те же "
                        f"кадры, твоё имя. {франшиза.ДОЛЯ}% выручки "
                        f"остаётся тебе."),
        "payload": f"fr:{int(time.time())}",
        "provider_token": "",
        "currency": ВАЛЮТА_ЗВЁЗД,
        "prices": [{"label": "Свой бот", "amount": звёзд}],
    }


def счёт_криптой_франшизы(tg_id):
    r = _крипто(
        "createInvoice",
        currency_type="fiat", fiat="USD", amount=str(франшиза.ДОЛЛАРОВ),
        description="Свой бот AMBERRY (франшиза)",
        payload=f"fr:{tg_id}:{int(time.time())}",
        allow_comments=False, allow_anonymous=False,
        expires_in=3600,
    )
    return {"url": r.get("bot_invoice_url") or r.get("pay_url"),
            "invoice_id": r["invoice_id"], "usd": франшиза.ДОЛЛАРОВ}


def это_франшиза(payload):
    return (payload or "").split(":")[0] == "fr"


def разобрать_payload(payload):
    """payload из successful_payment -> пакет. Падает явно: зачислить
    непонятно что хуже, чем не зачислить ничего.

    Франшизу сюда НЕ пускаем: у неё нет пакета и зачислять по ней
    нечего. Её отлавливает `это_франшиза` до вызова.
    """
    части = (payload or "").split(":")
    if len(части) < 2 or части[0] != "pack":
        raise ОшибкаОплаты(f"непонятный payload: {payload!r}")
    return pricing.pack(части[1])


# ---------- CryptoBot ----------

def _крипто(метод, **параметры):
    if not CRYPTOBOT_ТОКЕН:
        raise ОшибкаОплаты("CryptoBot не настроен: нет AMBERRY_CRYPTOBOT_TOKEN")
    тело = json.dumps(параметры).encode()
    req = urllib.request.Request(
        f"{CRYPTOBOT_API}/{метод}", data=тело, method="POST",
        headers={"Crypto-Pay-API-Token": CRYPTOBOT_ТОКЕН,
                 "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as f:
        о = json.load(f)
    if not о.get("ok"):
        raise ОшибкаОплаты(f"CryptoBot: {о.get('error')}")
    return о["result"]


def счёт_криптой(pack_id, tg_id):
    """Создаёт счёт и возвращает ссылку, по которой человек платит."""
    p = pricing.pack(pack_id)
    долларов = round(p["rub"] / USD_RUB, 2)
    r = _крипто(
        "createInvoice",
        currency_type="fiat", fiat="USD", amount=str(долларов),
        description=f"{p['coins']} коинов AMBERRY",
        payload=f"pack:{p['id']}:{tg_id}:{int(time.time())}",
        allow_comments=False, allow_anonymous=False,
        expires_in=3600,
    )
    return {"url": r.get("bot_invoice_url") or r.get("pay_url"),
            "invoice_id": r["invoice_id"], "usd": долларов}


def проверить_счёт(invoice_id):
    """Оплачен ли счёт. Нужен там, где вебхук не поднят."""
    r = _крипто("getInvoices", invoice_ids=str(invoice_id))
    счета = r.get("items") or []
    if not счета:
        return None
    return счета[0].get("status")        # active | paid | expired


def подпись_вебхука_верна(тело_байты, подпись):
    """Проверка подписи вебхука CryptoBot.

    Ключ — SHA-256 от токена, дальше HMAC по телу запроса. Без этой
    проверки зачислить коины может кто угодно, послав нам поддельный
    «оплачено».
    """
    if not CRYPTOBOT_ТОКЕН or not подпись:
        return False
    ключ = hashlib.sha256(CRYPTOBOT_ТОКЕН.encode()).digest()
    свой = hmac.new(ключ, тело_байты, hashlib.sha256).hexdigest()
    return hmac.compare_digest(свой, подпись)
