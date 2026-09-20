"""Экраны бота: клавиатуры, шапки, премиум-иконки на кнопках.

Держится отдельно от bot.py нарочно. В bot.py — что происходит, здесь —
как это выглядит. Иначе правка одной подписи требует лезть в разбор
callback'ов, а переименование кнопки тихо ломает переход.

## Премиум-эмодзи на кнопках

У InlineKeyboardButton и KeyboardButton есть поле `icon_custom_emoji_id`
с ограничением:

    Can only be used by bots that purchased additional usernames on
    Fragment or in the messages directly sent by the bot to private,
    group and supergroup chats if the owner of the bot has a Telegram
    Premium subscription.

Мы во втором случае: бот пишет в личку, у владельца Premium. Но
ограничение хрупкое — Premium может кончиться, и тогда Телеграм
откажется рисовать иконку. Поэтому иконка НИКОГДА не несёт смысла
сама: подпись кнопки полна и понятна без неё. Пропадут иконки —
интерфейс станет скучнее, но не сломается.

## Нижнее меню

Reply-клавиатура снизу (`НИЖНЕЕ`) висит всегда и ведёт к четырём
главным вещам. Она не заменяет inline-кнопки, а страхует их: inline
живут в конкретном сообщении, и стоит человеку пролистать чат вверх,
как он остаётся без навигации. Нижнее меню на месте всегда.
"""

import json

import catalog
import emoji
import pricing


def кнопка(текст, данные=None, иконка=None, стиль=None, url=None):
    """Одна inline-кнопка. Иконка и стиль необязательны."""
    b = {"text": текст}
    if данные:
        b["callback_data"] = данные
    if url:
        b["url"] = url
    if иконка:
        b["icon_custom_emoji_id"] = иконка
    if стиль:
        b["style"] = стиль          # danger | success | primary
    return b


def клава(ряды):
    """ряды — списки кортежей (текст, данные) или готовых словарей."""
    out = []
    for ряд in ряды:
        r = []
        for к in ряд:
            r.append(к if isinstance(к, dict) else кнопка(*к))
        out.append(r)
    return {"inline_keyboard": out}


# Нижнее меню. Четыре кнопки: больше в один ряд не влезает читаемо, а
# второй ряд снизу занимает пол-экрана телефона.
НИЖНЕЕ = {
    "keyboard": [[
        {"text": "Создать", "icon_custom_emoji_id": emoji.БЛЁСТКИ},
        {"text": "Баланс", "icon_custom_emoji_id": emoji.СЕРДЦЕ},
    ], [
        {"text": "Мои работы", "icon_custom_emoji_id": emoji.ПАПКА},
        {"text": "Позвать друзей", "icon_custom_emoji_id": emoji.БАНТ},
    ]],
    "resize_keyboard": True,
    "is_persistent": True,
}

# Иконки категорий берутся по имени из emoji.py: в каталоге лежит
# строка, а не сам id, чтобы каталог не зависел от набора эмодзи.
def иконка_категории(cat):
    return getattr(emoji, cat.иконка, None) if cat.иконка else None


def главное_меню():
    ряды = [[кнопка(c.title, f"c:{c.key}", иконка_категории(c))]
            for c in catalog.ВИДИМЫЕ]
    ряды.append([кнопка("Свой промпт", "m:free", emoji.НОУТ)])
    ряды.append([
        кнопка("Баланс", "m:balance", emoji.СЕРДЦЕ),
        кнопка("Пополнить", "m:buy", emoji.СЕРДЦА, стиль="primary"),
    ])
    return клава(ряды)


def меню_категории(cat):
    ряды = [[кнопка(s.button(), f"sc:{s.key}")] for s in cat.scenes]
    ряды.append([кнопка("Назад", "m:menu", emoji.ВЛЕВО)])
    return клава(ряды)


def меню_сценария(sc):
    return клава([
        [кнопка(f"Сделать · {sc.hearts} ♥", f"go:{sc.key}",
                emoji.ПАЛЕЦ, стиль="primary")],
        [кнопка("Другой сценарий", f"c:{_категория_сценария(sc).key}", emoji.ВЛЕВО),
         кнопка("Меню", "m:menu")],
    ])


def _категория_сценария(sc):
    for c in catalog.CATEGORIES:
        if sc in c.scenes:
            return c
    raise KeyError(f"сценарий {sc.key} не в одной категории")


def меню_оплаты():
    ряды = [[кнопка(f"{p['hearts']} ♥ — {p['rub']} ₽", f"buy:{p['id']}",
                    emoji.СЕРДЦА)] for p in pricing.PACKS]
    ряды.append([кнопка("Назад", "m:menu", emoji.ВЛЕВО)])
    return клава(ряды)


# ---------- тексты ----------

def шапка_главного(баланс, имя=None):
    привет = f"{имя}, " if имя else ""
    return (
        f"{emoji.шапка()}\n\n"
        f"{привет}пришли фото — и оно оживёт, переоденется или заговорит.\n\n"
        f"Баланс: <b>{emoji.баланс(баланс)}</b>\n"
        f"<i>1 ♥ — одно фото. Ролик 5 секунд — 5 ♥.</i>"
    )


def шапка_категории(cat):
    ик = иконка_категории(cat)
    значок = emoji.тег(ик, "•") + " " if ик else ""
    return (f"{значок}<b>{cat.title}</b>\n"
            f"<i>{cat.подзаголовок}</i>\n\n"
            f"{len(cat.scenes)} сценариев. Цена на каждой кнопке.")


def шапка_сценария(sc, баланс):
    хватает = баланс >= sc.hearts
    итог = (f"Спишем <b>{sc.hearts} ♥</b>, останется {баланс - sc.hearts}."
            if хватает else
            f"Нужно <b>{sc.hearts} ♥</b>, на балансе {баланс}. "
            f"{emoji.тег(emoji.СЕРДЦЕ_КОНТУР, '♡')} Пополни — и сделаем.")
    return (f"<b>{sc.title}</b>\n"
            f"<i>{sc.подпись}</i>\n\n"
            f"{pricing.job(sc.job).title} · {sc.hearts} ♥\n\n{итог}")


def текст_оплаты():
    строки = [f"{emoji.тег(emoji.СЕРДЦА, '♥')} <b>Сердечки</b>", ""]
    for j in pricing.JOBS.values():
        строки.append(f"{j.title} — <b>{j.hearts}</b> ♥")
    строки += ["", "<b>Подписки нет.</b> Платишь только за то, что сделал: "
                   "ни абонентской платы, ни сгорающих остатков, "
                   "ни функций за замком.", "",
               "<b>Пакеты</b> — не сгорают никогда", ""]
    for p in pricing.PACKS:
        строки.append(f"{p['hearts']} ♥ — <b>{p['rub']} ₽</b>   "
                      f"<s>{p['market_rub']} ₽ у других</s>")
    return "\n".join(строки)


def разметка(клавиатура):
    return json.dumps(клавиатура)
