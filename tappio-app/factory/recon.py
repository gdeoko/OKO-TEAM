#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
РАЗВЕДКА КОНКУРЕНТОВ (ежедневная, реальная) — YouTube через yt-dlp (метрики живые).
Для каждого приложения: ищет топ-ролики ниши, берёт самые просматриваемые (цель 1M+),
собирает title/views/likes/comments/channel/url/длительность, вытаскивает хук,
считает паттерны хуков → документ в бота @tappiorder_bot + сохраняет выводы в
analysis/latest_<app>.json (кормит генератор сценариев свежими хуками/ключами).

Честные пределы: скачивание чужих видео с дата-центр-IP часто 403 — берём метаданные+хуки
(этого достаточно для анализа); IG-метрики без API недоступны, поэтому источник — YouTube
(там ниша конкурентов пересекается). Дедуп по каналам/видео между запусками (recon_seen.json).

Использование: python3 recon.py [spy|brain|tape|all]
"""
import json, os, subprocess, sys, re, time, urllib.parse, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__))
AN = os.path.join(HERE, "analysis"); os.makedirs(AN, exist_ok=True)
SEEN = os.path.join(AN, "recon_seen.json")

QUERIES = {
 "spy": ["hidden camera detector airbnb","find hidden cameras hotel","spy camera finder app",
         "hidden camera in rental","how to detect hidden cameras travel","privacy hidden camera check"],
 "brain": ["improve memory fast","brain training app","memory test brain age",
           "focus concentration tips","remember names trick","brain exercises memory"],
 "tape": ["measure room with phone ar","ar measuring app","measure without tape",
          "will furniture fit room","phone tape measure","ar ruler app diy"],
}
NICHE = {"spy":"Spy Camera Finder / приватность","brain":"Brainova / память-фокус","tape":"3D Tape Measure / замеры-DIY"}

def load(p, d):
    try: return json.load(open(p))
    except Exception: return d

def ytsearch(q, n=8):
    """Топ-N видео по запросу с метаданными (без скачивания)."""
    fmt = "%(view_count)s\t%(like_count)s\t%(comment_count)s\t%(channel)s\t%(channel_follower_count)s\t%(duration)s\t%(id)s\t%(title)s"
    try:
        out = subprocess.run(
            ["yt-dlp","--skip-download","--no-warnings","--flat-playlist" if False else "--no-playlist",
             "--print", fmt, f"ytsearch{n}:{q}"],
            capture_output=True, text=True, timeout=120).stdout
    except Exception as e:
        return []
    rows=[]
    for ln in out.splitlines():
        p=ln.split("\t")
        if len(p)<8: continue
        def num(x):
            try: return int(x)
            except: return 0
        rows.append(dict(views=num(p[0]),likes=num(p[1]),comments=num(p[2]),channel=p[3],
                         followers=num(p[4]),dur=num(p[5]),id=p[6],title=p[7]))
    return rows

def hook_words(titles):
    stop=set("the a an of to in on for your you how why what with is are and or that this it".split())
    freq={}
    for t in titles:
        for w in re.findall(r"[a-zA-Z']+", t.lower()):
            if len(w)<3 or w in stop: continue
            freq[w]=freq.get(w,0)+1
    return [w for w,_ in sorted(freq.items(), key=lambda x:-x[1])[:12]]

def recon_app(app):
    seen = load(SEEN, {})
    seen_ids = set(seen.get(app, []))
    pool=[]
    for q in QUERIES[app]:
        pool += ytsearch(q, 8)
        time.sleep(1)
    # дедуп по id, сорт по просмотрам
    uniq={}
    for r in pool:
        if r["id"] and r["id"] not in uniq: uniq[r["id"]]=r
    ranked=sorted(uniq.values(), key=lambda r:-r["views"])
    # предпочитаем НОВЫЕ (не показанные ранее), добираем топом
    fresh=[r for r in ranked if r["id"] not in seen_ids]
    top=(fresh or ranked)[:10]
    millions=[r for r in top if r["views"]>=1_000_000]
    # обновляем seen (последние 200)
    seen[app]=list(dict.fromkeys(list(seen_ids)+[r["id"] for r in top]))[-200:]
    json.dump(seen, open(SEEN,"w"))
    hooks=hook_words([r["title"] for r in top])
    res=dict(app=app, niche=NICHE[app], top=top, millions=len(millions), hooks=hooks,
             avg_views=int(sum(r["views"] for r in top)/max(1,len(top))))
    json.dump(res, open(os.path.join(AN,f"latest_{app}.json"),"w"), ensure_ascii=False, indent=1)
    return res

def fmt_doc(res):
    a=res["app"]; L=[]
    L.append(f"<b>🔎 TAPPIO · разведка конкурентов — {res['niche']}</b>")
    L.append(f"Топ-{len(res['top'])} по просмотрам · роликов 1M+: <b>{res['millions']}</b> · средние просмотры: <b>{res['avg_views']:,}</b>".replace(","," "))
    L.append("")
    for i,r in enumerate(res["top"][:10],1):
        L.append(f"{i}. <b>{r['views']:,}</b> просм · {r['likes']:,}❤ · {r['comments']:,}💬".replace(","," "))
        L.append(f"   <i>{r['title'][:90]}</i>")
        L.append(f"   @{r['channel']} · youtu.be/{r['id']}")
    L.append("")
    L.append("<b>Паттерн хуков (частые слова в топе):</b> "+", ".join(res["hooks"]))
    L.append("<i>Выводы записаны — кормят генератор сценариев следующих роликов.</i>")
    return "\n".join(L)

def send_bot(text):
    tok=os.environ.get("TAPPIO_ANALYTICS_BOT_TOKEN"); chat=os.environ.get("TAPPIO_ANALYTICS_CHAT_ID","1966985736")
    if not tok: print("no bot token"); return
    ca="/root/.ccr/ca-bundle.crt"
    # телега лимит 4096 — шлём частями
    for i in range(0,len(text),3800):
        chunk=text[i:i+3800]
        data=urllib.parse.urlencode({"chat_id":chat,"text":chunk,"parse_mode":"HTML","disable_web_page_preview":"true"}).encode()
        cmd=["curl","-s","--cacert",ca,"-m","25",f"https://api.telegram.org/bot{tok}/sendMessage","--data",data.decode()]
        try: subprocess.run(cmd, capture_output=True, timeout=30)
        except Exception: pass
        time.sleep(0.5)

def main():
    which = sys.argv[1] if len(sys.argv)>1 else "all"
    apps = ["spy","brain","tape"] if which=="all" else [which]
    for app in apps:
        res=recon_app(app)
        doc=fmt_doc(res)
        send_bot(doc)
        print(f"RECON {app}: top={len(res['top'])} millions={res['millions']} avg={res['avg_views']} hooks={res['hooks'][:6]}")

if __name__=="__main__":
    main()
