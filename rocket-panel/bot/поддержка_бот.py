#!/usr/bin/env python3
"""Бот поддержки @AMBERRYsupport_bot. Логика - в `поддержка.py`.

Запуск (служба amberry-support):
    AMBERRY_SUPPORT_TOKEN=...   токен бота поддержки
    AMBERRY_SUPPORT_GROUP=...   id группы менеджеров; пусто - бот узнает
                                её сам по первому сообщению владельца
    ROCKET_DB=...               та же база, что у основного бота: карточка
                                клиента берёт из неё баланс и покупки
    ROCKET_ADMINS=...           кто может назначить группу
"""

import json
import os
import time
import traceback

import requests

from store import Store
from поддержка import Поддержка

ТОКЕН = os.environ.get("AMBERRY_SUPPORT_TOKEN", "")
API = "https://api.telegram.org/bot" + ТОКЕН
АДМИНЫ = {int(x) for x in os.environ.get("ROCKET_ADMINS", "")
          .replace(" ", "").split(",") if x.isdigit()}


def tg(метод, **поля):
    файл = поля.pop("файл", None)
    try:
        if файл:
            with open(файл, "rb") as ф:
                r = requests.post(f"{API}/{метод}", data=поля,
                                  files={"photo": ф}, timeout=60)
        else:
            r = requests.post(f"{API}/{метод}", data=поля, timeout=40)
        о = r.json()
    except Exception as e:                                  # noqa: BLE001
        о = {"ok": False, "description": str(e)[:200]}
    if not о.get("ok"):
        print("tg", метод, о.get("description"), flush=True)
    return о


def main():
    if not ТОКЕН:
        raise SystemExit("нет AMBERRY_SUPPORT_TOKEN")
    store = Store(os.environ.get("ROCKET_DB", "rocket_bot.db"))
    п = Поддержка(store, tg,
                  группа=os.environ.get("AMBERRY_SUPPORT_GROUP") or None,
                  админы=АДМИНЫ,
                  бот=os.environ.get("ROCKET_BOT_NAME", "theamberrybot"),
                  подд=os.environ.get("AMBERRY_SUPPORT_NAME",
                                      "AMBERRYsupport_bot"),
                  обложка=os.path.join(os.environ.get(
                      "AMBERRY_COVERS_DIR", "/srv/amberry/экраны"), "sup.jpg"))
    if п.группа:
        п.настроить()
    print("поддержка запущена, группа:", п.группа, flush=True)
    смещение = 0
    напомнить_в = 0
    while True:
        try:
            r = requests.get(f"{API}/getUpdates", params={
                "offset": смещение, "timeout": 25,
                "allowed_updates": json.dumps(
                    ["message", "callback_query", "my_chat_member"])},
                timeout=40).json()
        except Exception as e:                              # noqa: BLE001
            print("getUpdates:", str(e)[:200], flush=True)
            time.sleep(3)
            continue
        for upd in r.get("result", []):
            смещение = upd["update_id"] + 1
            try:
                п.обновление(upd)
            except Exception:                               # noqa: BLE001
                traceback.print_exc()
        if time.time() > напомнить_в:
            напомнить_в = time.time() + 60
            try:
                п.напомнить()
            except Exception:                               # noqa: BLE001
                traceback.print_exc()


if __name__ == "__main__":
    main()
