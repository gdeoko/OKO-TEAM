#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Ротатор ФОРМАТА и ТЕМЫ для разнообразия: держит пропорцию виральные 50% / польза 30% /
продажи 20% и не повторяет угол темы. Читает историю USED_TOPICS.md, выдаёт следующий {format, angle}.
Ниша V.CODE — видеопродакшн/подкасты/монтаж/свет/нейросети для видео/медийность.
  python plan_next.py   -> печатает JSON {format, angle, hint}
"""
import os,sys,json,random,collections,datetime
REG=os.path.join(os.path.dirname(__file__),"USED_TOPICS.md")
RATIO={"viral":0.5,"useful":0.3,"selling":0.2}
ANGLES={
 "viral":["провокация: нейросеть заменит оператора?","мифы про подкасты: почему все делают неправильно",
   "до/после: любительский кадр→кинокадр за 30 сек","шокирующая разница: телефон vs студия",
   "абсурдная ошибка в монтаже (и как починить)","что скрывают успешные видеографы",
   "ИИ против монтажёра: кто быстрее","история провала ролика за 30 сек",
   "один приём который делает видео дорогим","почему 90% роликов никто не досматривает",
   "3 секунды которые решают судьбу ролика","как снять кино-кадр на телефон"],
 "useful":["3 бесплатных нейросети для монтажа","5 ошибок начинающего видеографа",
   "как ускорить монтаж за минуту","лайфхак по свету: один софтбокс","чеклист съёмки для бизнеса",
   "как записать подкаст дома за 8000 рублей","настройка камеры за 60 сек для идеального кадра",
   "5 приёмов монтажа которые держат внимание","как сделать звук на видео идеальным",
   "цветокоррекция за 2 минуты: пошагово","контент-план для бизнеса: что снимать"],
 "selling":["почему бизнесу нужна профессиональная съёмка","кейс: ролик принёс клиенту 200 заявок",
   "что даёт подкаст бизнесу","разбор: сняли за день — результат за месяц",
   "зачем бизнесу студия а не телефон","сколько стоит профессиональное видео (и почему это дёшево)"]}

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
    deficit={f:RATIO[f]-c.get(f,0)/n for f in RATIO}
    fmt=max(deficit,key=deficit.get) if recent else "viral"
    used_angles=set(a for a in h)
    pool=[a for a in ANGLES[fmt] if a not in [x.split("::")[-1] for x in h]] or ANGLES[fmt]
    ang=random.Random(len(h)).choice(pool)
    return {"format":fmt,"angle":ang,
      "hint":f"Формат {fmt} (держим 50/30/20). Тема НОВАЯ под угол «{ang}», связка с V.CODE видеопродакшн. НЕ повторять прошлые."}

def mark(fmt,angle):
    d=datetime.datetime.utcnow().strftime("%Y-%m-%d")
    open(REG,"a",encoding="utf-8").write(f"- {fmt} | {d} | {angle}\n")

if __name__=="__main__":
    p=pick()
    if "--mark" in sys.argv: mark(p["format"],p["angle"])
    print(json.dumps(p,ensure_ascii=False))
