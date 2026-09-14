# -*- coding: utf-8 -*-
"""Сводная база брокеров: карта плюс почты с сайтов, без повторов.

Собираем четыре куска: организации Москвы и России из открытых карт и то,
что удалось снять с их сайтов. Один и тот же ящик встречается у сети офисов,
поэтому чистим по самой почте, а не по названию.

Общие ящики вроде info@ оставляем: у агентства это рабочий адрес отдела,
письмо туда доходит. Личные почты сотрудников из выдачи не берём вовсе.
"""
import csv, json, os, re, sys

ФАЙЛЫ = [
 ("/opt/oko-poster/lead_osm.json", "Москва"),
 ("/opt/oko-poster/lead_pochty_msk.json", "Москва"),
 ("/opt/oko-poster/lead_osm_rf.json", "Россия"),
 ("/opt/oko-poster/lead_pochty_rf.json", "Россия"),
]
ВЫХОД_JSON = "/opt/oko-poster/baza_brokerov.json"
ВЫХОД_CSV = "/opt/oko-poster/baza_brokerov.csv"
ПОЧТА = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")


def читать(п):
    if not os.path.exists(п):
        return []
    д = json.load(open(п, encoding="utf-8"))
    return д.get("записи", д if isinstance(д, list) else [])


def почты_записи(з):
    из = []
    if з.get("почта"):
        из.append(з["почта"])
    из += з.get("почты", []) or []
    return [п.lower().strip() for п in из if ПОЧТА.match(п.lower().strip() or "x")]


if __name__ == "__main__":
    по_почте, без_почты = {}, []
    всего_записей = 0
    for путь, откуда in ФАЙЛЫ:
        for з in читать(путь):
            всего_записей += 1
            почты = почты_записи(з)
            имя = (з.get("имя") or "").strip()
            строка = {"организация": имя, "город": з.get("город") or откуда,
                      "сайт": з.get("сайт", ""), "телефон": з.get("телефон", ""),
                      "регион": откуда}
            if not почты:
                if имя:
                    без_почты.append(строка)
                continue
            for п in почты:
                if п not in по_почте:
                    по_почте[п] = dict(строка, почта=п)

    # Своих и наши же ящики в базу не берём.
    свои = ("okoteam", "clusterspace", "activity.su", "ktodaniel")
    по_почте = {п: з for п, з in по_почте.items() if not any(с in п for с in свои)}

    домены = {}
    for п in по_почте:
        домены.setdefault(п.split("@")[1], 0)
        домены[п.split("@")[1]] += 1

    json.dump({"почт": len(по_почте), "организаций_без_почты": len(без_почты),
               "записи": list(по_почте.values()), "без_почты": без_почты[:2000]},
              open(ВЫХОД_JSON, "w", encoding="utf-8"), ensure_ascii=False, indent=1)

    with open(ВЫХОД_CSV, "w", encoding="utf-8", newline="") as ф:
        п = csv.DictWriter(ф, fieldnames=["почта", "организация", "город", "регион",
                                          "сайт", "телефон"])
        п.writeheader()
        for з in по_почте.values():
            п.writerow({к: з.get(к, "") for к in п.fieldnames})

    топ = sorted(домены.items(), key=lambda x: -x[1])[:8]
    print(f"обработано записей: {всего_записей}")
    print(f"уникальных почт: {len(по_почте)}")
    print(f"организаций с контактами, но без почты: {len(без_почты)}")
    print("частые домены:", ", ".join(f"{д} {н}" for д, н in топ))
    print("файлы:", ВЫХОД_JSON, ВЫХОД_CSV)
