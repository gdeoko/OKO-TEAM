# -*- coding: utf-8 -*-
"""Описания единиц. Всё по-английски, ссылка в каждом.

СЛОВО ВЛАДЕЛЬЦА: «во всех описаниях роликов должна быть ссылка на
приложение или на бота в тг, и всё должно быть на английском языке».
Лежавшие в `ОПИСАНИЯ.md` образцы были русскими - это и есть та правка.

ЧТО ДЕРЖИМ ИЗ ПРЕЖНИХ ПРАВИЛ (они не отменены, только переведены):
- метки «18+» нет НИГДЕ: площадка читает её как объявление взрослого
  контента и приходит с вопросами раньше, чем посмотрит сам ролик;
- хештегов нет ни одного: устарели на всех площадках с 02.09.2026, а
  решётка в конце читается как спам. Вместо них блок поиска живыми
  фразами, 15-30 штук;
- длина по замеру рынка: 272-720 знаков, цель 469; первая строка
  51-165, цель 81.

РАЗНООБРАЗИЕ ДЕРЖИТ ЖУРНАЛ, А НЕ СЛУЧАЙНОСТЬ. Хук, польза и воронка
берутся незанятыми через `журнал.свободное`: случайный выбор на пяти
лентах в один день даёт два одинаковых описания примерно каждый третий
день, и это видно именно тем, кто смотрит две наши ленты сразу.
"""
import re

ССЫЛКА_БОТА = "@theamberry_bot"
ССЫЛКА_САЙТА = "amberry.app"
ДЛИНА = (272, 720)
ПЕРВАЯ_СТРОКА = (51, 165)
ПОИСКА = (15, 30)

ХУКИ = {
 "формат1": [
  "This is not retouching and it is not an hour of somebody's work.",
  "One photo in, one photo back, and nothing else to learn.",
  "Everything you see on this screen is what the bot really shows.",
  "No editor, no subscription, no explaining what you wanted.",
  "The counter on the screen is real, and so is the result.",
  "She uploaded one picture, picked a button, and that was it.",
 ],
 "формат2": [
  "The blur here was put there by us. The bot does not add it.",
  "One take, one motion, and not a single cut anywhere in it.",
  "Where the platform stops, the blur starts. Underneath it keeps going.",
  "Nothing here was stitched together out of separate clips.",
  "All of this came out of one generation from a single photo.",
 ],
 "формат3": [
  "The first photo costs nothing, and that is not a marketing line.",
  "Bring any picture and get it back finished in under a minute.",
  "The rest of it lives in the bot, and the first one is free.",
  "You decide after the first one whether it is worth going on.",
 ],
 "серия": [
  "Episode %d. She still does not know who is watching.",
  "Episode %d. The message came in from her own number.",
  "Episode %d. Nobody in the room was supposed to see that photo.",
 ],
 "пост": [
  "On the left is the photo she sent, on the right what came back.",
  "Same girl, same frame, taken thirty seconds apart from it.",
  "One upload, one button, one result, and no editing at all.",
 ],
 "карусель": [
  "Swipe through to see what the bot actually does with a photo.",
  "Five screens, and every single one of them is the real app.",
  "Keep swiping if you want to see what the last screen holds.",
 ],
}

# ЗАГОЛОВОК В КАДРЕ - НЕ ОБРЕЗАННЫЙ ХУК. Первая проба резала хук по сорока
# знакам и дала на экране «THE FIRST PHOTO COSTS NOTHING, AND THAT » -
# фраза рвётся посреди мысли, и это тот самый обрывок, который канон
# запрещает ставить в кадр. Заголовок кадра живёт своим коротким списком:
# крупно в полосу влезает около дюжины знаков, двадцать два это потолок.
ЗАГОЛОВКИ_КАДРА = [
 "THE REST IS IN THE BOT",
 "FIRST ONE IS FREE",
 "ONE PHOTO, THAT IS ALL",
 "SHE SENT ONE PHOTO",
 "GUESS WHAT IT DOES",
 "TRY IT ON YOURS",
 "THIRTY SECONDS",
 "NO EDITOR NEEDED",
]

ПОЛЬЗА = [
 "You send a picture, pick what to do, and take the result back. "
 "The buttons and the wording are the same ones the app really has.",
 "There is no editor to learn and nothing to install. The bot lives "
 "inside Telegram and answers in under a minute.",
 "The first one is free, so you can see the quality before you decide "
 "anything else.",
 "Everything happens in the chat: photo in, photo out, nothing else to do.",
 "It works from one picture. No studio, no lighting, no second take.",
]

ВОРОНКА = [
 "Open it in Telegram: %s" % ССЫЛКА_БОТА,
 "The app is here: %s" % ССЫЛКА_САЙТА,
 "Try your own photo: %s" % ССЫЛКА_БОТА,
 "Full version in the app: %s" % ССЫЛКА_САЙТА,
]

ПОИСК = [
 "ai photo editing", "telegram photo bot", "ai image generator",
 "photo to video ai", "ai portrait editing", "neural network photo",
 "edit photo with ai", "ai photo app", "animate a photo with ai",
 "generative video from photo", "ai image app telegram",
 "photo editor bot", "free first photo edit", "ai selfie editor",
 "turn photo into video", "ai retouching app", "one photo ai result",
 "ai photo generator free", "image to video model", "ai content creator app",
]

# Слова, которых в описании не бывает НИКОГДА. Первые два - решение
# владельца 27.09, остальные читаются площадкой так же, а пишутся чаще.
ЗАПРЕЩЕНО = ("18+", "adult", "nsfw", "nude", "nudes", "porn", "xxx",
             "onlyfans", "undress", "strip")


def _кириллица(текст):
    return "".join(sorted({с for с in текст if "а" <= с.lower() <= "я" or с.lower() == "ё"}))


def проверить(текст):
    """Годно ли описание. Красное держит, жёлтое едет.

    Заслон стоит ДО постановки в слот: описание с меткой взрослого
    контента снимает не единицу, а аккаунт целиком, и чинить это потом
    нечем.
    """
    беды, пометки = [], []
    if not текст or not текст.strip():
        return {"ок": False, "беды": ["текст пуст"], "пометки": []}
    н = текст.lower()
    for с in ЗАПРЕЩЕНО:
        if re.search(r"(?<![a-z])%s(?![a-z])" % re.escape(с), н):
            беды.append("запрещённое слово «%s»" % с)
    if "#" in текст:
        беды.append("хештег: решётки в описании не бывает")
    к = _кириллица(текст)
    if к:
        беды.append("кириллица в английском описании: %s" % к)
    if ССЫЛКА_БОТА not in текст and ССЫЛКА_САЙТА not in текст:
        беды.append("ссылки нет: ни на бота, ни на приложение")
    д = len(текст)
    if not (ДЛИНА[0] <= д <= ДЛИНА[1]):
        пометки.append("длина %d вне рынка %d-%d" % (д, ДЛИНА[0], ДЛИНА[1]))
    первая = текст.strip().splitlines()[0]
    if not (ПЕРВАЯ_СТРОКА[0] <= len(первая) <= ПЕРВАЯ_СТРОКА[1]):
        пометки.append("первая строка %d зн., рынок %d-%d"
                       % (len(первая), ПЕРВАЯ_СТРОКА[0], ПЕРВАЯ_СТРОКА[1]))
    return {"ок": not беды, "беды": беды, "пометки": пометки, "знаков": д}


def собрать(вид, персона, журнал=None, серия_номер=0, слов_поиска=18,
            кроме=None):
    """Описание единицы: хук, польза, воронка, блок поиска.

    `журнал` это модуль `журнал` - через него берётся незанятое. Без него
    берём первое: проба не обязана вести живой журнал проекта.
    """
    хуки = ХУКИ.get(вид) or ХУКИ["формат1"]
    кроме = кроме if кроме is not None else {}

    def взять(раздел, список):
        # Развязка внутри дня: без неё пять лент выпускают один и тот же
        # хук - журнал помнит занятое по персоне, а не по дню.
        вне = кроме.get(раздел) or set()
        if журнал is None:
            свои = [з for з in список if з not in вне]
            взятое = (свои or список)[0]
        else:
            о = журнал.свободное(персона, раздел, список, кроме=вне)
            взятое = о.get("что") or список[0]
        кроме.setdefault(раздел, set()).add(взятое)
        return взятое
    хук = взять("хук_" + вид, хуки)
    if "%d" in хук:
        хук = хук % (серия_номер or 1)
    польза = взять("польза", ПОЛЬЗА)
    воронка = взять("воронка", ВОРОНКА)
    поиск = ПОИСК[:max(ПОИСКА[0], min(слов_поиска, ПОИСКА[1]))]
    текст = "%s\n\n%s\n\n%s\n\nfor search: %s" % (хук, польза, воронка,
                                                  ", ".join(поиск))
    о = проверить(текст)
    о.update({"текст": текст, "хук": хук, "польза": польза, "воронка": воронка})
    return о


def заголовок_кадра(персона, журнал=None, кроме=None):
    """Короткая надпись НА кадр. Мысль целиком, а не срез хука."""
    кроме = кроме if кроме is not None else {}
    вне = кроме.get("заголовок_кадра") or set()
    if журнал is None:
        свои = [з for з in ЗАГОЛОВКИ_КАДРА if з not in вне]
        взятое = (свои or ЗАГОЛОВКИ_КАДРА)[0]
    else:
        о = журнал.свободное(персона, "заголовок_кадра", ЗАГОЛОВКИ_КАДРА,
                             кроме=вне)
        взятое = о.get("что") or ЗАГОЛОВКИ_КАДРА[0]
        журнал.занять(персона, "заголовок_кадра", взятое)
    кроме.setdefault("заголовок_кадра", set()).add(взятое)
    return взятое


def занять(вид, персона, о, журнал):
    """Пометить взятое, когда описание ушло в дело."""
    if журнал is None:
        return
    журнал.занять(персона, "хук_" + вид, о.get("хук") or "")
    журнал.занять(персона, "польза", о.get("польза") or "")
    журнал.занять(персона, "воронка", о.get("воронка") or "")
