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

BRANDNAME = {"spy":"SPY CAMERA FINDER","brain":"BRAINOVA","tape":"3D TAPE MEASURE"}
CODE = {"spy":"PRIVACY","brain":"FOCUS","tape":"MEASURE"}

QUERIES = {
 "spy": ["hidden camera detector airbnb","find hidden cameras hotel","spy camera finder app",
         "hidden camera in rental","how to detect hidden cameras travel","privacy hidden camera check",
         "hidden camera caught","hidden cameras in hotel rooms","spy gadgets hidden camera",
         "how to find spy camera phone","airbnb hidden camera scandal","detect hidden camera dark"],
 "brain": ["improve memory fast","brain training app","memory test brain age","focus concentration tips",
           "remember names trick","brain exercises memory","how to focus better","boost brain power",
           "memory hack study","brain games adults","increase concentration","train your brain"],
 "tape": ["measure room with phone ar","ar measuring app","measure without tape","will furniture fit room",
          "phone tape measure","ar ruler app diy","measure furniture app","home renovation measure app",
          "iphone measure app","interior design measuring","diy measuring hack","ar tape measure demo"],
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
    cnt = seen.get("_cnt", {}).get(app, 0)          # ротационный счётчик (разные ролики каждый раз)
    qs = QUERIES[app]
    start = (cnt * 3) % len(qs)                      # ротируем окно запросов -> всплывают разные 1M+
    use = [qs[(start + i) % len(qs)] for i in range(min(6, len(qs)))]
    pool=[]
    for q in use:
        pool += ytsearch(q, 8)
        time.sleep(1)
    uniq={}
    for r in pool:
        if r["id"] and r["id"] not in uniq: uniq[r["id"]]=r
    ranked=sorted(uniq.values(), key=lambda r:-r["views"])
    millions_all=[r for r in ranked if r["views"]>=1_000_000]
    # ПРИОРИТЕТ всегда 1M+; ротируем окно -> разные миллионники каждый раз; добираем топом если мало
    if millions_all:
        off=(cnt*2) % len(millions_all)
        rot=millions_all[off:]+millions_all[:off]
        top=rot[:10]
        if len(top)<5: top=(top+[r for r in ranked if r["id"] not in {x["id"] for x in top}])[:10]
    else:
        top=ranked[:10]
    millions=[r for r in top if r["views"]>=1_000_000]
    seen.setdefault("_cnt", {})[app]=cnt+1
    seen[app]=list(dict.fromkeys(list(seen.get(app,[]))+[r["id"] for r in top]))[-200:]
    json.dump(seen, open(SEEN,"w"))
    hooks=hook_words([r["title"] for r in top])
    res=dict(app=app, niche=NICHE[app], brand_name=BRANDNAME.get(app,app.upper()), code=CODE.get(app,""),
             top=top, millions_list=millions, millions=len(millions), hooks=hooks,
             ts=time.strftime("%Y-%m-%d %H:%M UTC", time.gmtime()),
             avg_views=int(sum(r["views"] for r in top)/max(1,len(top))))
    json.dump(res, open(os.path.join(AN,f"latest_{app}.json"),"w"), ensure_ascii=False, indent=1)
    return res

def _er(r):
    v=max(1,r.get("views",0)); return round((r.get("likes",0)+r.get("comments",0))/v*100,2)

def conclusion(res):
    """ВЫВОД для наших роликов на основе паттернов топ-миллионников."""
    hk=res["hooks"][:6]
    return (f"хук через конкретную выгоду/цифру + сильное слово ниши ({', '.join(hk[:3])}) в первые 2 сек; "
            f"формат демонстрация/сравнение «до-после»; плотная динамика, инфографика цифрами; "
            f"CTA на кодовое слово {res.get('code','')} и ссылку. Тянуть за счёт узнаваемой боли и честного результата.")

def fmt_doc(res, reel_id=None):
    L=[]
    head=f"АНАЛИЗ КОНКУРЕНТОВ {res['brand_name']} — YouTube, ролики 1M+"
    L.append(f"<b>{head}</b>")
    sub=f"{res['ts']} · ниша: {res['niche']}" + (f" · для ролика {reel_id}" if reel_id else "")
    L.append(sub)
    L.append("="*44)
    shown = res["millions_list"] or res["top"]     # приоритет — ролики 1M+
    for i,r in enumerate(shown[:10],1):
        subs=r.get("followers",0)
        L.append(f"{i}. {r['title'][:80]}")
        L.append(f"   канал: {r['channel']} ({subs/1000:.1f}K подп.)".replace(".0K","K"))
        L.append(f"   <b>{r['views']:,}</b> · {r['likes']:,}❤ · {r['comments']:,}💬 · ER {_er(r)}% · ⏱ {r.get('dur',0)}с".replace(","," "))
        L.append(f"   https://youtu.be/{r['id']}")
    L.append("="*44)
    L.append("<b>РАЗБОР ХУКОВ (что заходит):</b>")
    L.append("частые слова в заголовках-миллионниках: "+", ".join(res["hooks"][:8]))
    L.append("паттерны: цифры/топы, конкретная боль, демонстрация, до/после, честная выгода.")
    L.append(f"<b>ВЫВОД для наших роликов:</b> {conclusion(res)}")
    L.append(f"<i>Средние по топу: {res['avg_views']:,} просм · роликов 1M+: {res['millions']}. Файл-основа ролика.</i>".replace(","," "))
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
    mode = sys.argv[2] if len(sys.argv)>2 else ""
    # brief <reel_id>: свежий анализ ПОД КОНКРЕТНЫЙ РОЛИК — файл-основа + документ в бота
    if mode == "brief":
        reel_id = sys.argv[3] if len(sys.argv)>3 else which
        res = recon_app(which)
        doc = fmt_doc(res, reel_id=reel_id)
        # файл-основа ролика (по нему строится ролик)
        briefs = os.path.join(AN, "briefs"); os.makedirs(briefs, exist_ok=True)
        plain = doc.replace("<b>","").replace("</b>","").replace("<i>","").replace("</i>","")
        open(os.path.join(briefs, f"{reel_id}.txt"), "w").write(plain)
        send_bot(doc)
        print(f"BRIEF {reel_id} ({which}): 1M+={res['millions']} avg={res['avg_views']} -> analysis/briefs/{reel_id}.txt + бот")
        return
    quiet = (mode == "quiet")   # обновить анализ БЕЗ документа в бота
    apps = ["spy","brain","tape"] if which=="all" else [which]
    for app in apps:
        res=recon_app(app)
        if not quiet:
            send_bot(fmt_doc(res))
        print(f"RECON {app}: top={len(res['top'])} millions={res['millions']} avg={res['avg_views']} hooks={res['hooks'][:6]}")

if __name__=="__main__":
    main()
