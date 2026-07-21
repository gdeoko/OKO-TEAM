#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
СТАДИЯ 2 — ГЕЙТ СЦЕНАРИЯ. Прогоняет сценарий ролика через проверки маркетинга/хука/
виральности/структуры/Humanizer(анти-ИИ)/дедуп. Возвращает pass + score + список правок.

Claude пишет сценарий по анализу конкурентов (стадия 1) в scenario.json:
  {"topic":"...", "kind":"viral|useful|selling",
   "hook":"первая фраза (0.5-1с, паттерн-разрыв)",
   "segments":["s1","s2",...],           # 5-6 фраз озвучки
   "cta":"призыв", "description":"текст под ролик", "hashtags":["#..",...],
   "cover_prompt":"промпт обложки", "funnel":"куда ведём"}

  python scenario_check.py scenario.json            # печатает отчёт JSON, код 0=pass 1=fail
Гейт НЕ пишет сценарий — он ПРОВЕРЯЕТ и говорит, что переписать. Пока не pass — Claude правит.
"""
import sys, json, re, os

REG = os.path.join(os.path.dirname(__file__), "USED_SCENARIOS.md")

# --- сигналы ИИ-письма (Humanizer) — рус+общие ---
AI_SIGNS = [
    (r"—",                         "длинное тире — убрать (ИИ-признак), заменить на точку/запятую"),
    (r"\bне\s+[^,.]{1,40}\s+а\s+", "конструкция «не X, а Y» — переписать живо"),
    (r"\b(в мире|в эпоху|в наше время|в современном мире)\b", "надутый зачин-клише — убрать"),
    (r"\b(поистине|воистину|поразительн|невероятн\w* важн|краеугольн)\w*", "напыщенное слово — убрать"),
    (r"\b(раскрой|раскройте|погрузись|погрузитесь|откройте для себя|откройся)\b", "инфостиль-клише — живее"),
    (r"\b(являеться|является)\b",   "канцелярит «является» — заменить"),
    (r"\b(данный|осуществля\w+|реализаци\w+|в рамках|посредством)\b", "канцелярит — заменить"),
    (r"[!]{2,}",                    "несколько «!» подряд — оставить один"),
    (r"\b(и т\.?д\.?|и т\.?п\.?)\b","«и т.д.» в озвучке — конкретизировать"),
]
# триггеры сильного хука
HOOK_TRIGGERS = [
    (r"\d", "цифра"), (r"\?", "вопрос"),
    (r"\b(как|почему|что если|секрет|ошибк|никогда|перестань|хватит|правда о|на самом деле|вот почему|мало кто)\b", "curiosity/паттерн-разрыв"),
    (r"\b(бесплатн|за \d+ (секунд|минут)|за минуту|мгновенн)\w*", "обещание скорости/выгоды"),
]

def _norm(t): return re.sub(r"\s+"," ",(t or "").strip().lower())

def _used():
    if not os.path.exists(REG): return set()
    return set(l.strip().lower() for l in open(REG,encoding="utf-8") if l.strip() and not l.startswith("#"))

def check(sc):
    issues=[]; score=50
    hook=sc.get("hook",""); segs=sc.get("segments",[]) or []
    kind=sc.get("kind","viral"); desc=sc.get("description",""); cta=sc.get("cta","")
    full=" ".join([hook]+segs+[cta,desc])

    # 1) хук
    if not hook: issues.append("НЕТ хука"); score-=25
    else:
        hl=len(hook)
        if hl>90: issues.append(f"хук длинный ({hl} симв) — до 1с, короче/резче"); score-=8
        trig=[name for rx,name in HOOK_TRIGGERS if re.search(rx,hook,re.I)]
        if not trig: issues.append("в хуке нет триггера (цифра/вопрос/паттерн-разрыв/скорость)"); score-=15
        else: score+=min(15,5*len(trig))

    # 2) структура (+ баллы за полноту)
    if len(segs)<4: issues.append(f"мало сегментов ({len(segs)}) — надо 5-6 фраз"); score-=10
    elif 5<=len(segs)<=6: score+=6
    if len(segs)>7: issues.append("слишком много сегментов — 5-6 оптимум"); score-=4
    if cta: score+=6
    elif kind!="viral": issues.append("нет CTA (для useful/selling обязателен)"); score-=8
    if kind=="selling" and not sc.get("funnel"): issues.append("selling без воронки — добавь funnel"); score-=8
    elif sc.get("funnel"): score+=4

    # 3) Humanizer (анти-ИИ)
    ai=[]
    for rx,msg in AI_SIGNS:
        if re.search(rx,full,re.I): ai.append(msg)
    if ai: issues+= ["Humanizer: "+m for m in ai]; score-=min(20,4*len(ai))

    # 4) длина озвучки (~ролик 15-45с: 0.55с/слово)
    words=len(re.findall(r"\w+"," ".join(segs)))
    est=round(words*0.55,1)
    if est<12: issues.append(f"озвучка коротка (~{est}с) — добавь смысла")
    if est>55: issues.append(f"озвучка длинна (~{est}с) — режь")

    # 5) описание + хэштеги + обложка (+ баллы за полноту)
    if len(desc)<40: issues.append("описание бедное (<40 симв) — раскрой ценность/воронку"); score-=5
    else: score+=5
    if len(sc.get("hashtags",[]) or [])<3: issues.append("мало хэштегов (<3)"); score-=3
    else: score+=3
    if not sc.get("cover_prompt"): issues.append("нет cover_prompt под обложку"); score-=5
    else: score+=4

    # 6) дедуп по реестру (тема/хук не повторять)
    key=_norm(sc.get("topic","")+" "+hook)[:120]
    if key in _used(): issues.append("тема/хук уже были — взять ДРУГОЙ угол (Закон разнообразия)"); score-=20

    score=max(0,min(100,score))
    passed = score>=70 and not any(i.startswith(("НЕТ хука","Humanizer")) for i in issues)
    return {"pass":passed,"score":score,"est_sec":est,"kind":kind,"issues":issues,"key":key}

def mark_used(key):
    with open(REG,"a",encoding="utf-8") as f: f.write(key+"\n")

def main():
    sc=json.load(open(sys.argv[1],encoding="utf-8"))
    r=check(sc)
    print(json.dumps(r,ensure_ascii=False,indent=2))
    if r["pass"] and "--commit" in sys.argv: mark_used(r["key"]); print("[записан в USED_SCENARIOS]")
    sys.exit(0 if r["pass"] else 1)

if __name__=="__main__": main()
