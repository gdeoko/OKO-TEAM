# -*- coding: utf-8 -*-
"""Телеграм-канал AMBERRY: одна пачка в сутки, без цензуры.

СЛОВО ВЛАДЕЛЬЦА: в канал идут серия, формат 1, формат 2 и пост одной
пачки, и там они БЕЗ ЦЕНЗУРЫ - в отличие от лент, где муть обязательна.
Пачка чередуется по дням, поэтому за пять дней канал обходит все пять
лиц ровно по разу.

ПОЧЕМУ СВОЯ ДВЕРЬ, А НЕ ZERNIO. Канал наш, бот у него уже админ, и
гонять его через сервис планирования значит платить за посредника там,
где достаточно `sendVideo` своим токеном. Плюс Zernio про «без цензуры»
ничего не знает: ему всё равно, какой файл мы дали, а нам - нет.

ЧТО ЭТА ДВЕРЬ НЕ ДЕЛАЕТ: она не выбирает, что слать. Выбор - дело дня,
и путать их нельзя: иначе «без цензуры» однажды уедет в ленту.
"""
import json, mimetypes, os, urllib.request

ТОКЕН = lambda: (os.environ.get("ROCKET_BOT_TOKEN") or "").strip()
КАНАЛ = lambda: (os.environ.get("AMBERRY_CHANNEL_ID") or "").strip()
ПРЕДЕЛ_ПОДПИСИ = 1024          # предел Телеграма на подпись к медиа


def _зов(метод, поля, файл=None, имя_поля="video"):
    """Многочастный запрос к Телеграму. Без внешних библиотек."""
    т = ТОКЕН()
    if not т:
        return None, "ROCKET_BOT_TOKEN не задан: НЕ ЗАМЕРЕНО"
    граница = "----amberry" + os.urandom(8).hex()
    куски = []
    for к, в in поля.items():
        куски.append(("--%s\r\nContent-Disposition: form-data; name=\"%s\"\r\n\r\n%s\r\n"
                      % (граница, к, в)).encode())
    if файл:
        тип = mimetypes.guess_type(файл)[0] or "application/octet-stream"
        куски.append(("--%s\r\nContent-Disposition: form-data; name=\"%s\"; "
                      "filename=\"%s\"\r\nContent-Type: %s\r\n\r\n"
                      % (граница, имя_поля, os.path.basename(файл), тип)).encode())
        with open(файл, "rb") as ф:
            куски.append(ф.read())
        куски.append(b"\r\n")
    куски.append(("--%s--\r\n" % граница).encode())
    тело = b"".join(куски)
    зап = urllib.request.Request(
        "https://api.telegram.org/bot%s/%s" % (т, метод), data=тело)
    зап.add_header("Content-Type", "multipart/form-data; boundary=" + граница)
    try:
        with urllib.request.urlopen(зап, timeout=300) as о:
            д = json.loads(о.read().decode("utf-8", "replace"))
    except Exception as e:
        подробно = ""
        try:
            подробно = e.read().decode("utf-8", "replace")[:300]
        except Exception:
            pass
        return None, "%s: %s" % (type(e).__name__, подробно or e)
    if not д.get("ok"):
        return None, "телеграм отказал: %s" % str(д.get("description"))[:200]
    return д.get("result") or {}, ""


def подпись(описание):
    """Подпись к медиа. Блок поиска в канал не идёт.

    «for search» это корм площадкам с поиском по описанию; в Телеграме он
    не работает и читается как мусор под постом.
    """
    строки = []
    for с in (описание or "").splitlines():
        if с.strip().lower().startswith("for search:"):
            break
        строки.append(с)
    т = "\n".join(строки).strip()
    return т[:ПРЕДЕЛ_ПОДПИСИ]


def отправить(файл, описание, вид="ролик"):
    """Один файл в канал. Три исхода."""
    ч = КАНАЛ()
    if not ч:
        return {"ок": False, "почему": "AMBERRY_CHANNEL_ID не задан"}
    if not файл or not os.path.exists(файл):
        return {"ок": False, "почему": "файла нет: %s" % файл}
    видео = str(файл).lower().endswith((".mp4", ".mov", ".webm"))
    метод = "sendVideo" if видео else "sendPhoto"
    поля = {"chat_id": ч, "caption": подпись(описание)}
    if видео:
        поля["supports_streaming"] = "true"
    о, почему = _зов(метод, поля, файл, "video" if видео else "photo")
    if о is None:
        return {"ок": False, "почему": почему, "вид": вид}
    return {"ок": True, "ид": о.get("message_id"), "вид": вид,
            "файл": os.path.basename(файл)}


def пачкой(единицы):
    """Несколько единиц подряд. Порядок задаёт вызывающий.

    Отправляем по одной, а не альбомом: у альбома одна подпись на всё, и
    тогда у трёх разных единиц пропадают их собственные хуки.
    """
    ушло, беды = [], []
    for е in единицы:
        о = отправить(е.get("файл"), е.get("описание"), е.get("вид", "ролик"))
        if о.get("ок"):
            ушло.append(о)
        else:
            беды.append("%s: %s" % (е.get("вид"), о.get("почему")))
    return {"ок": bool(ушло), "ушло": ушло, "беды": беды}
