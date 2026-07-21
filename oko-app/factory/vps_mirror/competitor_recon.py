#!/usr/bin/env python3
# DIESEL competitor recon: YouTube niche -> videos 1M+ -> metrics + hook analysis -> doc.
# Usage: competitor_recon.py <out_txt>  (dedup registry: recon_seen.json next to out)
import sys,json,subprocess,os,datetime
OUT=sys.argv[1] if len(sys.argv)>1 else "recon.txt"
SEEN=os.path.join(os.path.dirname(os.path.abspath(OUT)) or ".","recon_seen.json")
QUERIES=["квадроцикл из китая","мотоцикл из китая обзор","купить квадроцикл","atv from china",
         "гидроцикл обзор","эндуро из китая","квадроцикл тест","мотоцикл китай распаковка"]
def ytdlp(args,to=120):
    r=subprocess.run(["yt-dlp","--no-warnings","--socket-timeout","20"]+args,capture_output=True,text=True,timeout=to)
    return r.stdout
seen=set()
if os.path.exists(SEEN):
    try: seen=set(json.load(open(SEEN)))
    except: pass
# 1) gather candidate ids from flat searches
cand=[]
for q in QUERIES:
    try:
        d=json.loads(ytdlp(["--flat-playlist","-J",f"ytsearch8:{q}"],90) or "{}")
        for e in d.get("entries",[]):
            vid=e.get("id")
            if vid and vid not in seen and vid not in [c[0] for c in cand]: cand.append((vid,q))
    except Exception as ex: print("q fail",q,str(ex)[:50])
print("candidates",len(cand))
# 2) full metadata, filter >=1M views
rows=[]
for vid,q in cand[:40]:
    try:
        m=json.loads(ytdlp(["-J","--skip-download",f"https://www.youtube.com/watch?v={vid}"],60) or "{}")
        vc=m.get("view_count") or 0
        if vc<1_000_000: continue
        rows.append({"id":vid,"q":q,"title":m.get("title",""),"chan":m.get("channel") or m.get("uploader",""),
            "subs":m.get("channel_follower_count") or 0,"views":vc,"likes":m.get("like_count") or 0,
            "comments":m.get("comment_count") or 0,"dur":m.get("duration") or 0,"url":f"https://youtu.be/{vid}"})
    except Exception: continue
rows.sort(key=lambda r:-r["views"]); rows=rows[:10]
print("1M+ found",len(rows))
# 3) build doc
def fnum(n):
    for u,d in [("M",1e6),("K",1e3)]:
        if n>=d: return f"{n/d:.1f}{u}"
    return str(n)
L=[]
L.append("АНАЛИЗ КОНКУРЕНТОВ DIESEL CARGO — YouTube, ролики 1M+")
L.append(datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")+" · ниша: техника из Китая (квадро/мото/гидро)")
L.append("="*48)
for i,r in enumerate(rows,1):
    er=(r["likes"]+r["comments"])/r["views"]*100 if r["views"] else 0
    L.append(f"\n{i}. {r['title'][:80]}")
    L.append(f"   канал: {r['chan']} ({fnum(r['subs'])} подп.)")
    L.append(f"   👁 {fnum(r['views'])}  ❤ {fnum(r['likes'])}  💬 {fnum(r['comments'])}  ER {er:.2f}%  ⏱{r['dur']}с")
    L.append(f"   {r['url']}")
# hook analysis
L.append("\n"+"="*48)
L.append("РАЗБОР ХУКОВ (что заходит):")
words={}
for r in rows:
    for w in r["title"].lower().replace("!"," ").replace("?"," ").split():
        if len(w)>4: words[w]=words.get(w,0)+1
top=sorted(words.items(),key=lambda x:-x[1])[:10]
L.append("частые слова в заголовках-миллионниках: "+", ".join(f"{w}({c})" for w,c in top))
L.append("паттерны: цифры/топы, «из Китая», цена/выгода, тест-драйв, распаковка.")
L.append("ВЫВОД для наших роликов: хук через конкретную выгоду/цифру + слово «из Китая» в первые 2 сек;")
L.append("формат обзор/сравнение; CTA на расчёт. Тянуть за счёт узнаваемых моделей и честной цены.")
open(OUT,"w",encoding="utf-8").write("\n".join(L))
# 4) update seen
seen|={r["id"] for r in rows}
json.dump(sorted(seen),open(SEEN,"w"))
print("DOC_WRITTEN",OUT,"rows",len(rows))
