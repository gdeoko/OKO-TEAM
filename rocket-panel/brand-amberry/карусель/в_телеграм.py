#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Отправка готовой карусели в рабочий чат от @okontentbot.

ЧАТ НАХОДИТСЯ САМ. Бот не умеет входить по ссылке-приглашению: в Bot API
такого метода нет, добавить его может только админ чата. Зато в момент
добавления Телеграм шлёт боту `my_chat_member`, и чат становится виден в
getUpdates - отсюда и берётся id, без угадывания.

Угадывать здесь нельзя вовсе: карусель 18+, и промах отправит её в чужой
рабочий чат, откуда её уже не вернуть.

    python3 в_телеграм.py              найти чат и отправить
    python3 в_телеграм.py -1001234567  отправить в названный чат
    python3 в_телеграм.py --чаты       только показать, что бот видит
"""
import json
import os
import subprocess
import sys

ТУТ = os.path.dirname(os.path.abspath(__file__))
API = "https://api.telegram.org/bot%s/%s"

СЛАЙДЫ = ["1-хук.png", "2-меню.png", "3-выбор.png",
          "4-кнопки.png", "5-ждём.png", "6-финал.jpg"]

ПОДПИСЬ = (
    "AMBERRY - карусель, модель Ника\n\n"
    "Шесть слайдов 1080x1350. Слайды 1-5 - генерация gpt-image-2 через "
    "APIMODELS: заголовок, подзаголовок, нумерация и надписи интерфейса "
    "написаны внутри промпта, руками не ставилось ничего. Референсами "
    "уходили знак бренда и фото модели дня.\n\n"
    "Шестой собран кодом: настоящий результат бота под мутью, поверх - "
    "аутро с лого, ником и призывом.\n\n"
    "Кнопки в кадрах взяты из каталога бота: РАЗДЕТЬ, СОЛО, ГРУППОВОЕ, "
    "РАЗДЕВАНИЕ, четыре ракурса. Человек увидит в боте ровно эти слова."
)


def зов(токен, метод, данные=None, файлы=None):
    cmd = ["curl", "-s", "-m", "180", API % (токен, метод)]
    for к, з in (данные or {}).items():
        cmd += ["-F", "%s=%s" % (к, з)]
    for к, п in (файлы or {}).items():
        cmd += ["-F", "%s=@%s" % (к, п)]
    р = subprocess.run(cmd, capture_output=True, text=True, timeout=210)
    return json.loads(р.stdout or "{}")


def чаты(токен):
    """Групповые чаты, которые бот видел. Личные переписки не в счёт."""
    о = зов(токен, "getUpdates", {"limit": "100"})
    найдено = {}
    for у in о.get("result", []):
        for к in ("message", "my_chat_member", "channel_post",
                  "edited_message", "callback_query"):
            м = у.get(к) or {}
            ч = (м.get("chat") or (м.get("message") or {}).get("chat"))
            if ч and ч.get("type") in ("group", "supergroup", "channel"):
                найдено[ч["id"]] = ч.get("title") or str(ч["id"])
    return найдено


def отправить(токен, чат):
    пути = [os.path.join(ТУТ, и) for и in СЛАЙДЫ]
    нет = [п for п in пути if not os.path.exists(п)]
    if нет:
        raise SystemExit("нет слайдов: %s" % ", ".join(os.path.basename(п) for п in нет))
    # Альбомом, а не по одной: в ленте чата шесть отдельных картинок
    # выглядят свалкой, а карусель - это порядок слайдов.
    опись, файлы = [], {}
    for н, п in enumerate(пути):
        имя = "ф%d" % н
        файлы[имя] = п
        э = {"type": "photo", "media": "attach://" + имя}
        if н == 0:
            э["caption"] = ПОДПИСЬ
        опись.append(э)
    о = зов(токен, "sendMediaGroup",
            {"chat_id": str(чат), "media": json.dumps(опись, ensure_ascii=False)},
            файлы)
    if not о.get("ok"):
        raise SystemExit("Телеграм отказал: %s" % о.get("description"))
    return len(о.get("result", []))


if __name__ == "__main__":
    токен = os.environ.get("OKONTENT_BOT_TOKEN", "")
    if not токен:
        raise SystemExit("нет OKONTENT_BOT_TOKEN")
    арг = [а for а in sys.argv[1:] if а != "--чаты"]
    видно = чаты(токен)
    if "--чаты" in sys.argv:
        print(json.dumps(видно, ensure_ascii=False, indent=1) if видно
              else "бот не видит ни одного группового чата")
        raise SystemExit
    if арг:
        чат = арг[0]
    elif len(видно) == 1:
        чат, имя = list(видно.items())[0]
        print("чат один, беру его: %s (%s)" % (имя, чат))
    elif not видно:
        raise SystemExit(
            "бот не видит ни одного чата. Добавьте @okontentbot в рабочий "
            "чат - в этот момент Телеграм пришлёт боту событие, и чат "
            "найдётся сам. Войти по ссылке-приглашению бот не может: в "
            "Bot API такого метода нет.")
    else:
        raise SystemExit("чатов несколько, назовите id: %s"
                         % json.dumps(видно, ensure_ascii=False))
    print("отправлено картинок: %d" % отправить(токен, чат))
