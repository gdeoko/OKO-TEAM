#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ротатор ФОРМАТА и ТЕМЫ для разнообразия: держит пропорцию виральные 50% / польза 30% /
продажи 20% и не повторяет угол темы. Читает историю USED_TOPICS.md, выдаёт следующий {format, angle}.
Ниша V.CODE — разработка/ИИ/карьера в IT, но УГЛЫ разные (не только «нейросети для кода»).
  python plan_next.py   -> печатает JSON {format, angle, hint}
"""
import os,sys,json,random,collections,datetime
REG=os.path.join(os.path.dirname(__file__),"USED_TOPICS.md")
RATIO={"viral":0.5,"useful":0.3,"selling":0.2}
# разнообразные УГЛЫ (не повторять тему-в-тему)
ANGLES={
 "viral":["провокация: профессия под угрозой ИИ","миф против реальности в IT","до/после: джун→сеньор",
   "шокирующая зарплата в IT","абсурдный вайб-кодинг фейл","что скрывают senior-разработчики",
   "AI против человека: кто быстрее","история провала стартапа за 30 сек","реакция кода на баг (мем-формат)"],
 "useful":["N бесплатных инструментов для X","3 ошибки джуна","как ускорить работу за минуту",
   "лайфхак по продуктивности разработчика","чеклист перед собесом","как читать чужой код",
   "настройка окружения за 60 сек","5 расширений VS Code"],
 "selling":["почему стоит учиться у нас","кейс ученика: результат за месяц","что даёт наш продукт",
   "разбор: сделали клиенту X","оффер: бесплатный урок/консультация"]}

def hist():
    if not os.path.exists(REG): return []
    out=[]
    for l in open(REG,encoding="utf-8"):
        l=l.strip()
        if l.startswith("- "):
            parts=l[2:].split("|")
            if parts: out.append(parts[0].strip())
    return out

def pick():
    h=hist(); recent=h[-10:]
    c=collections.Counter(recent); n=max(1,len(recent))
    # выбрать формат с наибольшим дефицитом до целевой доли
    deficit={f:RATIO[f]-c.get(f,0)/n for f in RATIO}
    fmt=max(deficit,key=deficit.get) if recent else "viral"
    used_angles=set(a for a in h)  # угол-строки уже писались (грубо)
    pool=[a for a in ANGLES[fmt] if a not in [x.split("::")[-1] for x in h]] or ANGLES[fmt]
    ang=random.Random(len(h)).choice(pool)
    return {"format":fmt,"angle":ang,
      "hint":f"Формат {fmt} (держим 50/30/20). Тема НОВАЯ под угол «{ang}», связка с брендом V.CODE. НЕ повторять прошлые."}

def mark(fmt,angle):
    d=datetime.datetime.utcnow().strftime("%Y-%m-%d")
    open(REG,"a",encoding="utf-8").write(f"- {fmt} | {d} | {angle}\n")

if __name__=="__main__":
    p=pick()
    if "--mark" in sys.argv: mark(p["format"],p["angle"])
    print(json.dumps(p,ensure_ascii=False))
