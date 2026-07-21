#!/usr/bin/env python3
# МЕТАНОЙА · анализ конкурентов + миллионники (реальные цифры YouTube Data API) → красивый документ в бота.
# usage: python3 competitor_analysis.py            (шлёт документ в бота, печатает JSON-сводку)
# Требует в окружении: CLIENT_YT_CLIENT_ID/SECRET, CLIENT_EKAT_YT_REFRESH_TOKEN, CLIENT_EKAT_ANALYTICS_BOT_TOKEN,
#   SSL_CERT_FILE, playwright+chromium. Получатели — /opt/oko-poster/... нет локально → из env METANOIA_TG_CHATS (через запятую) или аргумента.
import os, json, urllib.request, urllib.parse, subprocess, tempfile, html, datetime, sys

QUERIES=["христианское воспитание детей","воспитание в вере ребёнок","православная семья дети",
         "детская психология мама","мама с богом воспитание","как воспитывать ребёнка вера",
         "духовное воспитание детей","дети и бог семья"]

def yt_token():
    d=urllib.parse.urlencode({"client_id":os.environ["CLIENT_YT_CLIENT_ID"],"client_secret":os.environ["CLIENT_YT_CLIENT_SECRET"],
        "refresh_token":os.environ["CLIENT_EKAT_YT_REFRESH_TOKEN"],"grant_type":"refresh_token"}).encode()
    return json.load(urllib.request.urlopen(urllib.request.Request("https://oauth2.googleapis.com/token",data=d),timeout=30))["access_token"]

def api(at,path,params):
    u=f"https://www.googleapis.com/youtube/v3/{path}?"+urllib.parse.urlencode(params)
    return json.load(urllib.request.urlopen(urllib.request.Request(u,headers={"Authorization":f"Bearer {at}"}),timeout=40))

def collect(at, seed):
    vids={}; chans=set()
    for q in QUERIES:
        try:
            d=api(at,"search",{"part":"snippet","type":"video","order":"viewCount","maxResults":8,
                               "relevanceLanguage":"ru","q":q})
        except Exception: continue
        ids=[it["id"]["videoId"] for it in d.get("items",[]) if it.get("id",{}).get("videoId")]
        if not ids: continue
        try: st=api(at,"videos",{"part":"statistics,snippet","id":",".join(ids)})
        except Exception: continue
        for v in st.get("items",[]):
            s=v["statistics"]; vid=v["id"]
            vids[vid]={"id":vid,"title":v["snippet"]["title"],"ch":v["snippet"]["channelId"],
                       "chtitle":v["snippet"]["channelTitle"],
                       "views":int(s.get("viewCount",0)),"likes":int(s.get("likeCount",0)),
                       "comments":int(s.get("commentCount",0))}
            chans.add(v["snippet"]["channelId"])
    # каналы: подписчики
    chinfo={}
    cl=list(chans)
    for i in range(0,len(cl),40):
        try:
            d=api(at,"channels",{"part":"statistics,snippet","id":",".join(cl[i:i+40])})
            for c in d.get("items",[]):
                chinfo[c["id"]]={"title":c["snippet"]["title"],
                    "subs":int(c["statistics"].get("subscriberCount",0)),
                    "videos":int(c["statistics"].get("videoCount",0)),
                    "views":int(c["statistics"].get("viewCount",0))}
        except Exception: pass
    return vids, chinfo

def num(n):
    n=int(n)
    if n>=1_000_000: return f"{n/1_000_000:.1f}M"
    if n>=1_000: return f"{n/1_000:.1f}K"
    return str(n)

def build_doc(vids, chinfo, seed):
    top_videos=sorted(vids.values(), key=lambda x:-x["views"])
    millions=[v for v in top_videos if v["views"]>=1_000_000][:5] or top_videos[:5]
    top_chans=sorted(chinfo.items(), key=lambda x:-x[1]["subs"])[:10]
    day=datetime.date.today().strftime("%d.%m.%Y")
    def vrow(v):
        er=(v["likes"]+v["comments"])/max(1,v["views"])*100
        return (f"<tr><td class='t'>{html.escape(v['title'][:52])}</td><td>{html.escape(v['chtitle'][:22])}</td>"
                f"<td class='n'>{num(v['views'])}</td><td class='n'>{num(v['likes'])}</td>"
                f"<td class='n'>{num(v['comments'])}</td><td class='n'>{er:.1f}%</td></tr>")
    def crow(cid,c):
        return f"<tr><td class='t'>{html.escape(c['title'][:30])}</td><td class='n'>{num(c['subs'])}</td><td class='n'>{c['videos']}</td><td class='n'>{num(c['views'])}</td></tr>"
    vrows="".join(vrow(v) for v in millions)
    crows="".join(crow(cid,c) for cid,c in top_chans)
    avgv=sum(v["views"] for v in millions)//max(1,len(millions))
    doc=f"""<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{{margin:0;padding:0;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif}}
body{{width:1080px;background:#0d0d0d;color:#f2f2f2;padding:52px 46px}}
h1{{font-size:44px;color:#9AFF00;letter-spacing:1px}} .sub{{color:#9a9a9a;font-size:24px;margin:8px 0 30px}}
h2{{font-size:30px;margin:34px 0 14px;color:#fff;border-left:6px solid #9AFF00;padding-left:14px}}
table{{width:100%;border-collapse:collapse;font-size:22px}}
th{{text-align:left;color:#9AFF00;border-bottom:2px solid #2a2a2a;padding:10px 8px;font-size:20px}}
td{{padding:11px 8px;border-bottom:1px solid #1c1c1c}} td.n{{text-align:right;color:#9AFF00;font-weight:bold;white-space:nowrap}}
td.t{{color:#eee}} .box{{background:#151515;border-radius:16px;padding:24px 26px;margin-top:12px;font-size:24px;line-height:1.5}}
.k{{color:#9AFF00;font-weight:bold}} .foot{{margin-top:34px;color:#777;font-size:20px}}
</style></head><body>
<h1>МЕТАНОЙА · АНАЛИЗ НИШИ</h1><div class="sub">Христианское воспитание · {day} · данные YouTube Data API</div>
<h2>ТОП роликов-миллионников</h2>
<table><tr><th>Ролик</th><th>Канал</th><th>Просмотры</th><th>Лайки</th><th>Комм.</th><th>ER</th></tr>{vrows}</table>
<h2>ТОП-10 конкурентов по подписчикам</h2>
<table><tr><th>Канал</th><th>Подписчики</th><th>Видео</th><th>Всего просмотров</th></tr>{crows}</table>
<h2>Выводы для нашего ролика</h2>
<div class="box">
• Заходят <span class="k">эмоциональные хуки-утверждения</span> и темы «ошибки в воспитании», «наказание», «вера ребёнка».<br>
• Средние просмотры топ-роликов: <span class="k">{num(avgv)}</span> — планка задаёт формат: короткий хук в первые 2с, одна мысль, тёплый вывод.<br>
• Высокий ER там, где есть <span class="k">спорный вопрос + мягкий ответ</span> и призыв сохранить.<br>
• Наш ход: взять сильную боль из топа и дать христианский тёплый разворот + фирменная инфографика.
</div>
<div class="foot">Сгенерировано контент-заводом МЕТАНОЙА автоматически.</div>
</body></html>"""
    return doc, {"millions":millions,"avg_views":avgv,"top_channels":[c[1]["title"] for c in top_chans]}

def render_png(doc):
    from playwright.sync_api import sync_playwright
    tmp=tempfile.mkdtemp(); hp=os.path.join(tmp,"d.html"); open(hp,"w").write(doc)
    out=os.path.join(tmp,"analysis.png")
    with sync_playwright() as p:
        b=p.chromium.launch(executable_path="/opt/pw-browsers/chromium",args=["--no-sandbox"])
        pg=b.new_page(viewport={"width":1080,"height":100})
        pg.goto("file://"+hp); pg.wait_for_timeout(400)
        pg.screenshot(path=out,full_page=True); b.close()
    return out

def tg_photo(png, caption):
    tok=os.environ.get("CLIENT_EKAT_ANALYTICS_BOT_TOKEN")
    chats=[]
    for src in ["/opt/oko-poster/cfg/metanoia_recipients.txt"]:
        try: chats=open(src).read().split()
        except Exception: pass
    if not chats: chats=os.environ.get("METANOIA_TG_CHATS","").split(",")
    for c in filter(None,chats):
        cmd=["curl","-s","--cacert",os.environ.get("SSL_CERT_FILE","/root/.ccr/ca-bundle.crt"),
             "-F",f"chat_id={c}","-F",f"caption={caption}","-F",f"photo=@{png}",
             f"https://api.telegram.org/bot{tok}/sendPhoto"]
        subprocess.run(cmd,capture_output=True)

def main():
    seed=int(sys.argv[1]) if len(sys.argv)>1 else 739000  # порядковый день; передавать args для детерминизма
    at=yt_token()
    vids,chinfo=collect(at,seed)
    doc,summ=build_doc(vids,chinfo,seed)
    png=render_png(doc)
    tg_photo(png, "📊 МЕТАНОЙА · анализ ниши и миллионников (авто)")
    print(json.dumps({"videos":len(vids),"channels":len(chinfo),"millions":len(summ["millions"]),"avg_views":summ["avg_views"]},ensure_ascii=False))

if __name__=="__main__": main()
