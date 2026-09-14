# -*- coding: utf-8 -*-
"""Агентства недвижимости из OpenStreetMap: по клеткам и через выход в NL.

Что выяснилось на прошлых заходах: Overpass не отвечает с московского адреса
сервера, зато открывается через Pantera ОБХОД № 16 (socks5 127.0.0.1:10840);
и он не любит длинные тела с --data-urlencode, зато нормально принимает
обычный --data. Один большой прямоугольник он тоже не отдаёт, поэтому режем
Москву и ближнюю область на клетки и идём по ним.
"""
import json, re, subprocess, sys, time

ТОЧКА = "https://overpass-api.de/api/interpreter"
СОКС = "127.0.0.1:10840"
ПОЧТА = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")

# Москва с областью: от 55.35 до 56.10 по широте, от 36.80 до 38.00 по долготе.
ШАГ = 0.15
ФИЛЬТРЫ = ["node[office=estate_agent]", "way[office=estate_agent]",
           "node[shop=estate_agent]", "way[shop=estate_agent]"]


def клетки():
    ш = 55.35
    while ш < 56.10:
        д = 36.80
        while д < 38.00:
            yield (round(ш, 2), round(д, 2), round(ш + ШАГ, 2), round(д + ШАГ, 2))
            д += ШАГ
        ш += ШАГ


def спросить(тело, ждать=90):
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


def почта_из(т):
    м = ПОЧТА.search(" ".join(str(т.get(к, "")) for к in
                              ("email", "contact:email", "operator:email")))
    return м.group(0).lower() if м else ""


if __name__ == "__main__":
    куда = sys.argv[1] if len(sys.argv) > 1 else "/opt/oko-poster/lead_osm.json"
    все, номер = [], 0
    список = list(клетки())
    for ш1, д1, ш2, д2 in список:
        номер += 1
        тело = "".join(f"{ф}({ш1},{д1},{ш2},{д2});" for ф in ФИЛЬТРЫ)
        э = спросить(тело)
        if э is None:
            print(f"клетка {номер}/{len(список)}: не ответила, повтор", flush=True)
            time.sleep(8)
            э = спросить(тело) or []
        все += э
        if номер % 10 == 0 or э:
            print(f"клетка {номер}/{len(список)}: +{len(э)}, всего {len(все)}", flush=True)
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
        записи.append({"имя": имя, "сайт": сайт, "телефон": телефон,
                       "почта": почта_из(т), "источник": "osm"})
    json.dump({"всего": len(записи), "записи": записи},
              open(куда, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"ИТОГО организаций: {len(записи)} | с сайтом: "
          f"{sum(1 for з in записи if з['сайт'])} | с почтой: "
          f"{sum(1 for з in записи if з['почта'])} | с телефоном: "
          f"{sum(1 for з in записи if з['телефон'])}", flush=True)
