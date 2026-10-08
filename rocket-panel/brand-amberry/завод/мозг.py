# -*- coding: utf-8 -*-
"""МОЗГ ЗАВОДА: день задумывает модель, а не список в коде.

Этот файл появился после прямого слова владельца: «тебе мозг и нужен, ты
же мимо ядра делаешь всё сама». Замер подтвердил упрёк числами: зовов
текстовой модели в заводе было НОЛЬ, а весь смысл держали мои литералы -
ШЕСТЬ хуков на тридцать единиц в сутки, каждый день одни и те же. Лента
из шести фраз это штамп по построению, сколько бы кадров под ними ни
менялось.

Форма двери взята у ядра ОКО (`core/apimodels.текст`), чтобы правило
чинилось в одном месте: тот же адрес, та же лестница моделей, тот же
json-ответ отдельным полем.

ТРИ ИСХОДА У КАЖДОГО ЗОВА, и третий главный: ответ / отказ с причиной /
НЕ ЗАМЕРЕНО. Молчащий мозг не имеет права выглядеть как «мозг сказал
пусто»: на пустом ответе день уходит на запасные списки, и это
ПОМЕТКА в отчёте, а не тихая подмена.
"""
import json, os, subprocess, time

БАЗА = os.getenv("APIMODELS_BASE", "https://api.apimodels.app/v1")
# Лестница та же, что у ядра: плохой день одной модели не должен быть
# мёртвым мозгом для всего завода.
ПОРЯДОК = tuple(м.strip() for м in (os.getenv("APIMODELS_TEXT_ORDER") or "").split(",")
                if м.strip()) or ("deepseek-v4-flash", "claude-sonnet-5",
                                  "claude-haiku-4-5-20251001")
ТАЙМАУТ = int(os.getenv("AMBERRY_MOZG_TIMEOUT", "240"))


def ключ():
    """Ключ ЗАВОДА, а не бота: счёт один, но дверь должна быть названа."""
    к = (os.environ.get("APIMODELS_KEY_ZAVOD") or "").strip()
    return к or (os.environ.get("APIMODELS_KEY") or "").strip()


def _зов(тело):
    к = ключ()
    if not к:
        return None, "ключа завода нет"
    try:
        п = subprocess.run(
            ["curl", "-sS", "--max-time", str(ТАЙМАУТ), "-X", "POST",
             БАЗА + "/chat/completions",
             "-H", "Authorization: Bearer " + к,
             "-H", "Content-Type: application/json",
             "-d", json.dumps(тело, ensure_ascii=False)],
            capture_output=True, text=True, timeout=ТАЙМАУТ + 30)
    except (OSError, subprocess.SubprocessError) as е:
        return None, "%s: %s" % (type(е).__name__, str(е)[:120])
    сырое = (п.stdout or "").strip()
    if not сырое:
        return None, "пусто: %s" % (п.stderr or "молча").strip()[:120]
    try:
        д = json.loads(сырое)
    except ValueError:
        return None, "ответ не json: %s" % сырое[:160]
    if д.get("error"):
        о = д["error"]
        return None, str(о.get("message") or о)[:160]
    выбор = (д.get("choices") or [{}])[0]
    текст_ = ((выбор.get("message") or {}).get("content") or "").strip()
    if not текст_:
        return None, "модель вернула пустой текст"
    return текст_, ""


def текст(запрос, система="", max_tokens=2000, json_ответ=False):
    """Ответ модели. Лестница сверху вниз, причина последней беды наружу."""
    беда = "не звали"
    for модель in ПОРЯДОК:
        сообщения = ([{"role": "system", "content": система}] if система else []) \
            + [{"role": "user", "content": запрос}]
        тело = {"model": модель, "messages": сообщения, "max_tokens": max_tokens}
        if json_ответ:
            тело["response_format"] = {"type": "json_object"}
        о, почему = _зов(тело)
        if о:
            return {"ок": True, "текст": о, "модель": модель}
        беда = "%s: %s" % (модель, почему)
    return {"ок": False, "почему": беда}


def _json_из(текст_):
    """JSON из ответа модели. Она любит обрамлять его разговором."""
    т = (текст_ or "").strip()
    if т.startswith("```"):
        т = т.split("```")[1] if "```" in т[3:] else т.strip("`")
        if т.lstrip().startswith("json"):
            т = т.lstrip()[4:]
    н, к = т.find("{"), т.rfind("}")
    if н < 0 or к <= н:
        return None, "фигурных скобок в ответе нет"
    try:
        д = json.loads(т[н:к + 1])
    except ValueError as е:
        return None, "json не разобрался: %s" % str(е)[:100]
    return _развернуть(д), ""


def _развернуть(д, глубина=3):
    """Снимаем обёртку провайдера вокруг настоящего ответа.

    ЗАМЕРЕНО ЖИВЬЁМ: `claude-sonnet-5` через APIMODELS при
    `response_format: json_object` отдаёт {"_noargs": "<наш json строкой>"}.
    Разбор видит законный объект с одним ключом и НОЛЬ замыслов, то есть
    готовый ответ выбрасывается, а причина звучит как «мозг не дал
    замысла» - беда, названная чужим именем. Разворачиваем, пока внутри
    одна строка с json.
    """
    for _ in range(глубина):
        if not isinstance(д, dict) or len(д) != 1:
            return д
        значение = list(д.values())[0]
        if not isinstance(значение, str):
            return д
        с = значение.strip()
        н, к = с.find("{"), с.rfind("}")
        if н < 0 or к <= н:
            return д
        try:
            д = json.loads(с[н:к + 1])
        except ValueError:
            return д
    return д

# ── ЗАМЫСЕЛ ДНЯ ────────────────────────────────────────────────────────
# ОДИН ВЫЗОВ НА ВЕСЬ ДЕНЬ, а не по единице. Модель между вызовами не
# помнит ничего, и пять отдельных заходов честно дадут пять похожих
# хуков: развести их можно только показав ей все пять разом.

СИСТЕМА = (
    "You write social copy for AMBERRY, an AI photo app that lives in a "
    "Telegram bot. The feed is English-only and must pass Instagram and "
    "TikTok moderation: suggestive is fine, explicit is not. Never use the "
    "words undress, nude, naked, nsfw, porn, onlyfans, strip, 18+. "
    "No hashtags anywhere. You answer with JSON only.")

ЗАПРЕТ = ("undress", "nude", "naked", "nsfw", "porn", "onlyfans", "strip",
          "18+", "xxx", "erotic")


def задание_дня(пачки, день):
    """Просьба к мозгу: пять разных замыслов на один день, по порядку."""
    лица = "\n".join(
        "%d. %s" % (i, (п.get("лицо") or "young woman"))
        for i, п in enumerate(пачки, 1))
    n = len(пачки)
    return (
        "Design today's content plan for " + str(n) + " separate "
        "Instagram/TikTok accounts of the same AI photo app. Date: "
        + str(день) + ".\n"
        "The accounts differ only by the woman who fronts them:\n"
        + лица + "\n\n"
        "Give exactly " + str(n) + " ideas, IN THE SAME ORDER as the list "
        "above. The ideas must not repeat each other's angle, wording or "
        "opening word, and each should suit the woman it belongs to.\n\n"
        'Return JSON: {"packs": [{"theme": str, "hook": str, "body": str, '
        '"frame_title": str, "search": [str]}]}\n\n'
        "Rules:\n"
        "- hook: the first line people see, 60 to 150 characters, a real "
        "sentence, no emoji, no hashtags, it must make someone stop;\n"
        "- body: one or two sentences, what they get, concrete;\n"
        "- frame_title: 3 to 22 characters, UPPERCASE, it is burned onto "
        "the cover image and must fit one line;\n"
        "- search: 6 to 10 short English search phrases about AI photo "
        "editing;\n"
        "- theme: 2 to 6 words, what this account talks about today.")


def проверить_замысел(з, пачки):
    """Судим ответ мозга КОДОМ, до первой траты. Красное возвращаем ему.

    Проверка стоит нуля, а круг производства стоит денег: замысел, который
    умрёт на двери, обязан умереть здесь.
    """
    беды = []
    пакеты = (з or {}).get("packs") or []
    # ПАРЫ СТАВИМ ПО ПОРЯДКУ, А НЕ ПО ИМЕНИ. Имя пачки это наш внутренний
    # ключ (кириллица), а не творчество: требовать от модели повторить его
    # дословно значит терять весь замысел из-за регистра одной буквы -
    # замерено живьём, пять готовых идей ушли в мусор ровно так. Порядок
    # она держит, и этого довольно.
    if len(пакеты) != len(пачки):
        беды.append("замыслов %d, а пачек %d" % (len(пакеты), len(пачки)))
    если = {(пачки[i].get("персона") if i < len(пачки) else "№%d" % i): п
            for i, п in enumerate(пакеты)}
    хуки, титры = [], []
    for имя, п in если.items():
        хук = (п.get("hook") or "").strip()
        тело = (п.get("body") or "").strip()
        титр = (п.get("frame_title") or "").strip()
        поиск = п.get("search") or []
        если_низ = (хук + " " + тело + " " + титр).lower()
        for с in ЗАПРЕТ:
            if с in если_низ:
                беды.append("%s: запрещённое слово «%s»" % (имя, с))
        if any("\u0400" <= з_ <= "\u04FF" for з_ in хук + тело + титр):
            беды.append("%s: кириллица, лента английская" % имя)
        if "#" in если_низ:
            беды.append("%s: хештег, их нет нигде" % имя)
        if not (60 <= len(хук) <= 150):
            беды.append("%s: хук %d знаков, норма 60-150" % (имя, len(хук)))
        if not (3 <= len(титр) <= 22):
            беды.append("%s: заголовок кадра %d знаков, норма 3-22" % (имя, len(титр)))
        if титр != титр.upper():
            беды.append("%s: заголовок кадра не заглавными" % имя)
        if len(поиск) < 6:
            беды.append("%s: фраз поиска %d, надо от 6" % (имя, len(поиск)))
        хуки.append(хук.lower())
        титры.append(титр.lower())
    if len(set(хуки)) < len(хуки):
        беды.append("хуки повторяются между пачками")
    if len(set(титры)) < len(титры):
        беды.append("заголовки кадров повторяются между пачками")
    первые = [х.split()[0] for х in хуки if х.split()]
    if len(set(первые)) < len(первые):
        беды.append("хуки начинаются одним словом: %s" % ", ".join(первые))
    return беды


def замысел_дня(пачки, день, кругов=2):
    """Замысел на весь день от мозга. Три исхода, круг правки один.

    Второй отказ ТОЙ ЖЕ проверки значит, что просьба невыполнима, а не
    что мозг плох: дальше крутить бессмысленно, день идёт на запасных
    списках И ГОВОРИТ ОБ ЭТОМ.
    """
    запрос = задание_дня(пачки, день)
    беды_прошлые = []
    for круг in range(1, кругов + 1):
        полный = запрос
        if беды_прошлые:
            полный += ("\n\nYOUR PREVIOUS ANSWER WAS REJECTED. Fix EXACTLY "
                       "these and keep everything else:\n- "
                       + "\n- ".join(беды_прошлые))
        # СТРОГИЙ JSON-РЕЖИМ НЕ ПРОСИМ, И ЭТО ЗАМЕР, А НЕ ВКУС. Одна и та
        # же просьба в четырёх заходах: `deepseek-v4-flash` с
        # `response_format` вернул ПУСТОЙ текст, `claude-sonnet-5` завернул
        # ответ в {"_noargs": "<json строкой>"}; без режима обе модели
        # отдали чистые пять замыслов. Форму держит само задание («answer
        # with JSON only») и терпимый разбор ниже.
        о = текст(полный, система=СИСТЕМА, max_tokens=2600)
        if not о.get("ок"):
            return {"ок": False, "почему": "мозг молчит: %s" % о.get("почему"),
                    "круг": круг}
        з, почему = _json_из(о["текст"])
        if з is None:
            беды_прошлые = ["answer was not valid JSON: %s" % почему]
            continue
        беды = проверить_замысел(з, пачки)
        if not беды:
            return {"ок": True, "замысел": з, "модель": о.get("модель"),
                    "круг": круг}
        беды_прошлые = беды
    return {"ок": False, "почему": "замысел не прошёл проверку: %s"
            % "; ".join(беды_прошлые[:6]), "круг": кругов}
