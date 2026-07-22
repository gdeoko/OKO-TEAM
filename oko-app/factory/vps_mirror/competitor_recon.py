#!/usr/bin/env python3
# DIESEL полный анализ конкурентов ПОД РОЛИК. Usage: competitor_recon.py <out.txt> "<тема>" [niche]
# Стратегия: широкие нишевые запросы -> префильтр по view_count из flat-поиска (быстро) ->
#   глубокие метаданные+транскрипт только у роликов 1M+. Дедуп recon_seen.json.
import sys,json,subprocess,os,datetime,re,glob
OUT=sys.argv[1] if len(sys.argv)>1 else "recon.txt"
THEME=sys.argv[2] if len(sys.argv)>2 else "квадроцикл из китая"
NICHE=sys.argv[3] if len(sys.argv)>3 else THEME.split()[0]
BASE=os.path.dirname(os.path.abspath(OUT)) or "."
SEEN=os.path.join(BASE,"recon_seen.json")
# широкие запросы под нишу (там реально есть 1M+), микс RU/EN
NQ={"квадроцикл":["atv offroad","quad bike","квадроцикл","atv fail","quad bike jump","atv mud","квадроцикл прикол","utv offroad","atv review","四轮车"],
    "мотоцикл":["motorcycle","superbike","motorcycle stunt","мотоцикл","motorcycle fail","moto ride","motorcycle review","biker","cafe racer","motorcycle crash"],
    "эндуро":["enduro","dirt bike","motocross","эндуро","dirt bike jump","hard enduro","motocross fail","dirt bike fail","enduro mountain","питбайк"],
    "гидроцикл":["jet ski","jetski","гидроцикл","jet ski fail","jetski stunt","personal watercraft","jet ski race","水上摩托","aquabike","jet ski flip"]}
key=next((k for k in NQ if k in NICHE.lower()),"квадроцикл")
Q=NQ[key]
def yt(args,to=90):
    try: return subprocess.run(["yt-dlp","--no-warnings","--socket-timeout","20"]+args,capture_output=True,text=True,timeout=to).stdout
    except: return ""
seen=set()
if os.path.exists(SEEN):
    try: seen=set(json.load(open(SEEN)))
    except: pass
# 1) flat-поиск -> берём view_count сразу, префильтр >=1M
big=[]
for q in Q:
    d=json.loads(yt(["--flat-playlist","-J",f"ytsearch15:{q}"],80) or "{}") or {}
    for e in d.get("entries",[]) or []:
        vid=e.get("id"); vc=e.get("view_count") or 0
        if vid and vc>=1_000_000 and vid not in seen and vid not in [b[0] for b in big]:
            big.append((vid,vc,e.get("title") or "",e.get("channel") or e.get("uploader") or "",e.get("duration") or 0,q))
big.sort(key=lambda x:-x[1]); big=big[:10]
# 2) глубокие метаданные только у прошедших
rows=[]
for vid,vc,ftitle,fchan,fdur,q in big:
    m=json.loads(yt(["-J","--skip-download",f"https://www.youtube.com/watch?v={vid}"],45) or "{}") or {}
    rows.append({"id":vid,"q":q,"title":(m.get("title") or ftitle or "")[:0] or ftitle or m.get("title") or "(без названия)",
        "chan":m.get("channel") or m.get("uploader") or fchan or "",
        "subs":m.get("channel_follower_count") or 0,"views":m.get("view_count") or vc,"likes":m.get("like_count") or 0,
        "comments":m.get("comment_count") or 0,"dur":m.get("duration") or fdur or 0,"url":f"https://youtu.be/{vid}"})
rows.sort(key=lambda r:-r["views"]); rows=rows[:8]
# 3) транскрипт-хук топ-3
def hook_of(vid):
    tmp=f"{BASE}/_sub_{vid}"
    yt(["--skip-download","--write-auto-sub","--write-sub","--sub-lang","ru,en","--sub-format","vtt","-o",tmp,f"https://youtu.be/{vid}"],70)
    words=[]; seen_ph=set()
    for f in glob.glob(tmp+"*.vtt"):
        try:
            for l in open(f,encoding="utf-8"):
                l=l.strip()
                if not l or "-->" in l or l.isdigit(): continue
                if l.startswith(("WEBVTT","Kind:","Language:","NOTE")) or "align:" in l or "position:" in l: continue
                l=re.sub(r"<[^>]+>","",l).strip()
                if not l or l in seen_ph: continue
                seen_ph.add(l); words.append(l)
                if sum(len(x) for x in words)>200: break
        except: pass
        try: os.remove(f)
        except: pass
    return re.sub(r"\s+"," "," ".join(words)).strip()[:200]
for r in rows[:3]: r["hook"]=hook_of(r["id"])
def fn(n):
    for u,dv in [("M",1e6),("K",1e3)]:
        if n>=dv: return f"{n/dv:.1f}{u}"
    return str(n)
L=[f"АНАЛИЗ КОНКУРЕНТОВ DIESEL — тема ролика: {THEME.upper()} (ниша: {key})",
   datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")+f" · YouTube · только ролики 1M+ · найдено {len(rows)}","="*54]
for i,r in enumerate(rows,1):
    er=(r["likes"]+r["comments"])/r["views"]*100 if r["views"] else 0
    fmt="Shorts/вертикаль" if r["dur"]<=65 else ("средний" if r["dur"]<=180 else "длинный обзор")
    L+=[f"\n{i}. {r['title'][:90]}",
        f"   канал: {r['chan']} · {fn(r['subs'])} подп. · {fmt} ({r['dur']}с)",
        f"   МЕТРИКИ: 👁 {fn(r['views'])} · ❤ {fn(r['likes']) if r['likes'] else 'н/д'} · 💬 {fn(r['comments']) if r['comments'] else 'н/д'}",
        f"   ссылка: {r['url']}"]
    if r.get("hook"): L.append(f"   ХУК (транскрипт начала): «{r['hook']}»")
    t=r["title"].lower(); why=[]
    if re.search(r"\d",t): why.append("цифра/топ")
    if any(w in t for w in ["fail","crash","прикол","fun","эпик","wtf"]): why.append("эмоция/фейл-момент")
    if any(w in t for w in ["vs","challenge","битва","сравн"]): why.append("сравнение/интрига")
    if any(w in t for w in ["unbox","распаков","обзор","review","test","тест"]): why.append("обзор/распаковка")
    if any(w in t for w in ["stunt","jump","стант","трюк","flip"]): why.append("трюк/зрелище")
    if er>3: why.append(f"очень высокий ER {er:.1f}%")
    L.append(f"   ПОЧЕМУ ЗАЛЕТЕЛ: {', '.join(why) or 'сильный визуал/аудитория канала'}")
L.append("\n"+"="*54)
avg_er=sum((r["likes"]+r["comments"])/r["views"]*100 for r in rows)/len(rows) if rows else 0
allw={}
for r in rows:
    for w in re.sub(r"[^\w\s]"," ",r["title"].lower()).split():
        if len(w)>4: allw[w]=allw.get(w,0)+1
top=sorted(allw.items(),key=lambda x:-x[1])[:12]
L+=["СВОДНЫЙ РАЗБОР:",
    "• Частые слова заголовков-миллионников: "+", ".join(f"{w}({c})" for w,c in top),
    f"• Средний ER топа: {avg_er:.2f}% · средние просмотры: {fn(sum(r['views'] for r in rows)//max(1,len(rows)))}",
    "• Что объединяет виралы: сильная эмоция/зрелище в первые секунды, понятный визуальный конфликт, динамика.",
    "• Честно: YouTube не отдаёт репосты/сохранения (только просмотры/лайки/комменты); IG-метрики — из кабинета аккаунта.",
    "\nПРИЁМЫ ДЛЯ НАШЕГО РОЛИКА (адаптировать под DIESEL, НЕ копировать):",
    "1) Хук в первые 2 сек: зрелище/цифра/конфликт (салон vs завод, цена, возможности) + «из Китая».",
    "2) Формат по топу: обзор/сравнение/демонстрация — держать динамику как у виралов.",
    "3) Воронка: боль → решение → честная цена (без выдуманных сумм) → CTA «город и задача в комментарии».",
    "4) Взять сильный приём топа (эмоция/сравнение/трюк) и переложить на нашу технику и оффер."]
open(OUT,"w",encoding="utf-8").write("\n".join(L))
seen|={r["id"] for r in rows}; json.dump(sorted(seen),open(SEEN,"w"))
print("RECON_DONE rows",len(rows))
