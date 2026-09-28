#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Отправка готовой карусели в рабочий чат от @okontentbot.

ЧАТ НАЗЫВАЕТСЯ ЯВНО, ВСЕГДА. Раньше скрипт брал единственный видимый чат
сам - и 28.09.2026 отправил карусель 18+ в рабочий чат клиента
«ЗАЩИТНИК» (-1004302788900), потому что бот видел только его. Шесть
сообщений пришлось удалять руками, и между ними в чате уже успели
написать двое.

Вывод: «чат один, значит он и нужен» - это не признак нужного чата, а
признак того, что про остальные мы ничего не знаем. Теперь id либо
назван в командной строке, либо скрипт не отправляет ничего. Список
видимых чатов можно посмотреть (`--чаты`), но выбор из него делает
человек.

    python3 в_телеграм.py --чаты       показать, какие чаты бот видит
    python3 в_телеграм.py -1001234567  отправить в НАЗВАННЫЙ чат
    python3 в_телеграм.py --ждать --чаты   ждать, пока появится новый чат

ПОДПИСКА НА СОБЫТИЯ ШИРЕ, ЧЕМ ПО УМОЛЧАНИЮ. У бота стояли только
`message`, `edited_message` и `callback_query`, и событие о добавлении
его в чат Телеграм ПРОСТО ВЫБРОСИЛ: обновления вне allowed_updates не
копятся в очереди, их не существует. Поэтому список типов передаётся
явно при каждом опросе.
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


ТИПЫ = json.dumps(["message", "edited_message", "channel_post",
                   "callback_query", "my_chat_member", "chat_member"])


def чаты(токен, ожидание=0):
    """Групповые чаты, которые бот видел. Личные переписки не в счёт.

    ожидание - секунды длинного опроса. Бот-администратор видит в группе
    все сообщения, поэтому первое же слово в чате даёт нам его id.
    """
    о = зов(токен, "getUpdates",
            {"limit": "100", "allowed_updates": ТИПЫ,
             "timeout": str(ожидание)})
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
    арг = [а for а in sys.argv[1:] if not а.startswith("--")]
    видно = чаты(токен)
    if "--ждать" in sys.argv:
        while not видно:
            print("жду первого сообщения в чате...", flush=True)
            видно = чаты(токен, ожидание=50)
    if "--чаты" in sys.argv:
        print(json.dumps(видно, ensure_ascii=False, indent=1) if видно
              else "бот не видит ни одного группового чата")
        raise SystemExit
    if not арг:
        raise SystemExit(
            "id чата не назван, а сам я его не выбираю: один раз так уже "
            "ушла карусель не в тот чат.\nВидно сейчас: %s"
            % (json.dumps(видно, ensure_ascii=False) if видно
               else "ни одного группового чата"))
    чат = арг[0]
    if видно and str(чат) not in [str(к) for к in видно]:
        print("ВНИМАНИЕ: чата %s среди видимых нет, видно %s"
              % (чат, json.dumps(видно, ensure_ascii=False)), flush=True)
    print("отправлено картинок: %d" % отправить(токен, чат))
