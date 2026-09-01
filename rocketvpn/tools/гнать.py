#!/usr/bin/env python3
"""Гоняем задание через ComfyUI на поде и ждём результат.

   Работает ВНУТРИ пода: ComfyUI слушает только localhost, наружу
   ничего не открыто, и это правильно - на публичном адресе такой
   сервис это открытая дверь.

   Порядок: кладём задание, ждём его в истории, печатаем файлы, которые
   оно родило. Дальше их забирает мост.
"""
import json, sys, time, urllib.request, uuid

БАЗА = "http://127.0.0.1:8188"

def запрос(путь, тело=None):
    д = json.dumps(тело).encode() if тело is not None else None
    з = urllib.request.Request(БАЗА + путь, data=д,
                               headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(з, timeout=120).read().decode())

def главная():
    задание = json.load(open(sys.argv[1]))
    ид = str(uuid.uuid4())
    о = запрос("/prompt", {"prompt": задание, "client_id": ид})
    номер = о.get("prompt_id")
    if not номер:
        print("НЕ ПРИНЯТО", json.dumps(о)[:600]); sys.exit(2)
    print("принято", номер, flush=True)
    ждём = int(sys.argv[2]) if len(sys.argv) > 2 else 1800
    начало = time.time()
    while time.time() - начало < ждём:
        time.sleep(5)
        ист = запрос("/history/" + номер)
        if номер in ист:
            з = ист[номер]
            сост = (з.get("status") or {}).get("status_str", "?")
            print("состояние", сост, "за", int(time.time() - начало), "сек", flush=True)
            файлы = []
            for узел, вых in (з.get("outputs") or {}).items():
                for вид, список in вых.items():
                    if isinstance(список, list):
                        for э in список:
                            if isinstance(э, dict) and э.get("filename"):
                                файлы.append((вид, э.get("subfolder", ""), э["filename"]))
            for в, п, ф in файлы:
                print("ФАЙЛ", в, п, ф, flush=True)
            if сост == "error":
                print(json.dumps(з.get("status"), ensure_ascii=False)[:1500])
                sys.exit(3)
            return
        if int(time.time() - начало) % 60 < 5:
            print("ждём", int(time.time() - начало), "сек", flush=True)
    print("НЕ ДОЖДАЛИСЬ"); sys.exit(4)

главная()
