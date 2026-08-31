# -*- coding: utf-8 -*-
"""Единая база под брокер-тур: организации и живые люди из чатов.

Складываем всё, что собрали: агентства из открытых карт с почтами, карточки
каталога Yell с телефонами и Телеграмом, и людей из профильных чатов. Ключ
у каждого свой: у организации почта или телефон, у человека его id.
"""
import csv, json, os

ИСТОЧНИКИ_ОРГ = [
 "/opt/oko-poster/baza_brokerov.json",
 "/opt/oko-poster/lead_yell_moscow.json",
]
ИСТОЧНИКИ_ЛЮДИ = [
 "/opt/oko-poster/tg_ludi.json",
 "/opt/oko-poster/tg_ludi_gluboko.json",
]


def читать(п, ключ):
    if not os.path.exists(п):
        return []
    д = json.load(open(п, encoding="utf-8"))
    return д.get(ключ, [])


орг_по_почте, орг_по_телефону = {}, {}
for п in ИСТОЧНИКИ_ОРГ:
    for з in читать(п, "записи"):
        почта = (з.get("почта") or "").lower().strip()
        телефон = "".join(filter(str.isdigit, з.get("телефон") or ""))
        строка = {"организация": з.get("организация") or з.get("имя", ""),
                  "почта": почта, "телефон": телефон,
                  "телеграм": з.get("телеграм", ""), "сайт": з.get("сайт", ""),
                  "город": з.get("город", ""), "источник": з.get("источник", "")}
        if почта and почта not in орг_по_почте:
            орг_по_почте[почта] = строка
        elif телефон and телефон not in орг_по_телефону:
            орг_по_телефону[телефон] = строка

люди = {}
for п in ИСТОЧНИКИ_ЛЮДИ:
    for ч in читать(п, "люди"):
        к = str(ч.get("id"))
        если = люди.get(к, {"сообщений": 0, "чаты": []})
        если["ник"] = ч.get("ник", "") or если.get("ник", "")
        если["имя"] = ч.get("имя", "") or если.get("имя", "")
        если["id"] = ч.get("id")
        если["сообщений"] = если["сообщений"] + ч.get("сообщений", 0)
        если["чаты"] = sorted(set(если["чаты"] + ч.get("чаты", [])))
        если["последнее"] = max(если.get("последнее", ""), ч.get("последнее", ""))
        люди[к] = если

с_ником = [ч for ч in люди.values() if ч.get("ник")]
активные = [ч for ч in с_ником if ч["сообщений"] >= 3]

json.dump({"организаций_с_почтой": len(орг_по_почте),
           "организаций_с_телефоном": len(орг_по_телефону),
           "людей_из_чатов": len(люди),
           "почты": list(орг_по_почте.values()),
           "телефоны": list(орг_по_телефону.values()),
           "люди": sorted(люди.values(), key=lambda ч: -ч["сообщений"])},
          open("/opt/oko-poster/baza_tur.json", "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

with open("/opt/oko-poster/baza_tur_pochty.csv", "w", encoding="utf-8", newline="") as ф:
    п = csv.DictWriter(ф, fieldnames=["почта", "организация", "город", "сайт", "телефон"])
    п.writeheader()
    for з in орг_по_почте.values():
        п.writerow({к: з.get(к, "") for к in п.fieldnames})

with open("/opt/oko-poster/baza_tur_telefony.csv", "w", encoding="utf-8", newline="") as ф:
    п = csv.DictWriter(ф, fieldnames=["телефон", "организация", "телеграм", "город", "сайт"])
    п.writeheader()
    for з in орг_по_телефону.values():
        п.writerow({к: з.get(к, "") for к in п.fieldnames})

with open("/opt/oko-poster/baza_tur_telegram.csv", "w", encoding="utf-8", newline="") as ф:
    п = csv.DictWriter(ф, fieldnames=["ник", "имя", "id", "сообщений", "чаты", "последнее"])
    п.writeheader()
    for ч in sorted(с_ником, key=lambda ч: -ч["сообщений"]):
        п.writerow({"ник": ч["ник"], "имя": ч.get("имя", ""), "id": ч["id"],
                    "сообщений": ч["сообщений"], "чаты": ",".join(ч["чаты"]),
                    "последнее": ч.get("последнее", "")})

print(f"организаций с почтой:    {len(орг_по_почте)}")
print(f"организаций с телефоном: {len(орг_по_телефону)}")
print(f"людей из чатов:          {len(люди)}, с ником {len(с_ником)}, "
      f"активных {len(активные)}")
print("файлы: baza_tur.json, baza_tur_pochty.csv, baza_tur_telefony.csv, baza_tur_telegram.csv")
