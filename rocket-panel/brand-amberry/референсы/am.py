# -*- coding: utf-8 -*-
"""Тонкий клиент APIMODELS. Ключ берётся из окружения, в файл не пишется."""
import json
import os
import time
import urllib.request

БАЗА = os.environ.get("APIMODELS_BASE", "https://api.apimodels.app/v1")
КЛЮЧ = os.environ["APIMODELS_KEY"]


def зов(путь, тело=None, метод=None):
    з = urllib.request.Request(
        БАЗА + путь,
        data=json.dumps(тело).encode() if тело is not None else None,
        method=метод or ("POST" if тело is not None else "GET"),
        headers={"Authorization": f"Bearer {КЛЮЧ}",
                 "Content-Type": "application/json"})
    try:
        return json.load(urllib.request.urlopen(з, timeout=120))
    except urllib.error.HTTPError as e:
        # Тело ответа объясняет отказ: без него «400» не говорит ничего.
        return {"__ошибка": e.code, "__тело": e.read().decode("utf-8", "ignore")[:900]}


def дождаться(tid, предел=600, шаг=5):
    т = time.time()
    while time.time() - т < предел:
        о = зов(f"/images/generations?task_id={tid}")
        с = (о.get("data") or о).get("state") or (о.get("data") or о).get("status")
        if с in ("completed","succeeded","success","failed","error","fail"):
            return о, time.time() - т
        time.sleep(шаг)
    return {"__таймаут": предел}, предел
