# -*- coding: utf-8 -*-
"""Агентства недвижимости по всей России из OpenStreetMap.

Тот же приём, что и по Москве: выход в Нидерландах, обычный --data, клетки.
Страна большая, поэтому клетка крупнее, а пустых мест много: над Сибирью
и Севером ответы приходят почти мгновенно.
"""
import json, re, subprocess, sys, time

ТОЧКА = "https://overpass-api.de/api/interpreter"
СОКС = "127.0.0.1:10840"
ПОЧТА = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
ФИЛЬТРЫ = ["node[office=estate_agent]", "way[office=estate_agent]",
           "node[shop=estate_agent]", "way[shop=estate_agent]"]

# Европейская часть и Урал, где живёт основная масса агентств.
ШИРОТА = (43.0, 61.0)
ДОЛГОТА = (27.0, 65.0)
ШАГ = 2.0


def клетки():
    ш = ШИРОТА[0]
    while ш < ШИРОТА[1]:
        д = ДОЛГОТА[0]
        while д < ДОЛГОТА[1]:
            yield (round(ш, 2), round(д, 2), round(ш + ШАГ, 2), round(д + ШАГ, 2))
            д += ШАГ
        ш += ШАГ


def спросить(тело, ждать=120):
    запрос = f"[out:json][timeout:{ждать}];({тело});out center tags;"
    r = subprocess.run(["curl", "-s", "--socks5-hostname", СОКС,
                        "--max-time", str(ждать + 30), "-X", "POST", ТОЧКА,
                        "--data", f"data={запрос}"],
                       capture_output=True, text=True)
    вывод = (r.stdout or "").strip()
    if not вывод:
        return None
    try:
        return json.loads(вывод).get("elements", [])
    except Exception:
        return None


if __name__ == "__main__":
    куда = sys.argv[1] if len(sys.argv) > 1 else "/opt/oko-poster/lead_osm_rf.json"
    список = list(клетки())
    все = []
    for н, (ш1, д1, ш2, д2) in enumerate(список, 1):
        тело = "".join(f"{ф}({ш1},{д1},{ш2},{д2});" for ф in ФИЛЬТРЫ)
        э = спросить(тело)
        if э is None:
            time.sleep(10)
            э = спросить(тело) or []
        все += э
        if н % 20 == 0 or len(э) > 30:
            print(f"клетка {н}/{len(список)}: +{len(э)}, всего {len(все)}", flush=True)
        time.sleep(2)

    записи, видели = [], set()
    for э in все:
        т = э.get("tags", {})
        имя = (т.get("name") or "").strip()
        if not имя:
            continue
        сайт = (т.get("website") or т.get("contact:website") or т.get("url") or "").strip()
        телефон = (т.get("phone") or т.get("contact:phone") or "").strip()
        ключ = (имя.lower(), сайт.lower(), телефон)
        if ключ in видели:
            continue
        видели.add(ключ)
        м = ПОЧТА.search(" ".join(str(т.get(к, "")) for к in
                                  ("email", "contact:email", "operator:email")))
        записи.append({"имя": имя, "сайт": сайт, "телефон": телефон,
                       "почта": м.group(0).lower() if м else "",
                       "город": т.get("addr:city", ""), "источник": "osm-рф"})
    json.dump({"всего": len(записи), "записи": записи},
              open(куда, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"ИТОГО по России: {len(записи)} | с сайтом: "
          f"{sum(1 for з in записи if з['сайт'])} | с почтой: "
          f"{sum(1 for з in записи if з['почта'])}", flush=True)
