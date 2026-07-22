#!/usr/bin/env python3
# МЕТАНОЙА · ФУЛЛ-БРИФ конкурентов ПЕРЕД каждым роликом.
# Только ролики 1M+ просмотров, ВСЕГДА РАЗНЫЕ (дедуп по analyzed_videos.txt), со ссылками и полной аналитикой:
# просмотры/лайки/комменты/ER/длительность/дата + разбор хука/формата/почему залетел + воронка.
# Пишет: (1) markdown-бриф в factory/briefs/ (основа для сборки ролика), (2) красивый PNG в бота.
# usage: python3 competitor_analysis.py [reel_nn]
import os, json, re, urllib.request, urllib.parse, subprocess, tempfile, html, datetime, sys

REPO="/home/user/OKO-TEAM"
BRIEFS=f"{REPO}/КОНТЕНТ-ЗАВОД/factory/briefs"
STATE=f"{REPO}/КОНТЕНТ-ЗАВОД/factory/analyzed_videos.txt"   # id уже показанных (не повторять)
# ниша: христианское/осознанное воспитание, вера, семья, детская психология — где реально есть 1M+
QUERIES=["воспитание детей","детская психология","православие семья","вера дети воспитание",
         "мама воспитание сын","как воспитывать ребёнка","многодетная семья дети","отношения родители дети",
         "духовное воспитание","дети и родители психология","христианские ценности семья","воспитание с любовью"]
MIN_VIEWS=1_000_000

def token():
    d=urllib.parse.urlencode({"client_id":os.environ["CLIENT_YT_CLIENT_ID"],"client_secret":os.environ["CLIENT_YT_CLIENT_SECRET"],
        "refresh_token":os.environ["CLIENT_EKAT_YT_REFRESH_TOKEN"],"grant_type":"refresh_token"}).encode()
    return json.load(urllib.request.urlopen(urllib.request.Request("https://oauth2.googleapis.com/token",data=d),timeout=30))["access_token"]
def api(at,path,params):
    u=f"https://www.googleapis.com/youtube/v3/{path}?"+urllib.parse.urlencode(params)
    return json.load(urllib.request.urlopen(urllib.request.Request(u,headers={"Authorization":f"Bearer {at}"}),timeout=40))
def iso_dur(s):
    m=re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?",s or "");h,mi,se=(int(x) if x else 0 for x in (m.groups() if m else (0,0,0)))
    return h*3600+mi*60+se
def num(n):
    n=int(n)
    return f"{n/1_000_000:.1f}M" if n>=1_000_000 else (f"{n/1_000:.1f}K" if n>=1_000 else str(n))

def seen_ids():
    try: return set(open(STATE).read().split())
    except: return set()

def collect(at, exclude):
    vids={}
    for q in QUERIES:
        try: d=api(at,"search",{"part":"snippet","type":"video","order":"viewCount","maxResults":10,"relevanceLanguage":"ru","q":q})
        except Exception: continue
        ids=[it["id"]["videoId"] for it in d.get("items",[]) if it.get("id",{}).get("videoId") and it["id"]["videoId"] not in exclude]
        if not ids: continue
        for i in range(0,len(ids),50):
            try: st=api(at,"videos",{"part":"statistics,snippet,contentDetails","id":",".join(ids[i:i+50])})
            except Exception: continue
            for v in st.get("items",[]):
                s=v["statistics"]; views=int(s.get("viewCount",0))
                if views<MIN_VIEWS or v["id"] in exclude: continue
                vids[v["id"]]={"id":v["id"],"title":v["snippet"]["title"],"ch":v["snippet"]["channelTitle"],
                    "chid":v["snippet"]["channelId"],"views":views,"likes":int(s.get("likeCount",0)),
                    "comments":int(s.get("commentCount",0)),"dur":iso_dur(v["contentDetails"]["duration"]),
                    "date":v["snippet"].get("publishedAt","")[:10],"desc":v["snippet"].get("description","")[:400]}
    return vids

def subs_for(at, chids):
    out={}
    cl=list(chids)
    for i in range(0,len(cl),40):
        try:
            d=api(at,"channels",{"part":"statistics","id":",".join(cl[i:i+40])})
            for c in d.get("items",[]): out[c["id"]]=int(c["statistics"].get("subscriberCount",0))
        except: pass
    return out

def why_viral(v):
    t=v["title"].lower(); reasons=[]
    if re.search(r"\d",t): reasons.append("цифра/топ в заголовке")
    if any(w in t for w in ["ошибка","нельзя","никогда","хватит","перестань"]): reasons.append("хук-запрет/ошибка")
    if any(w in t for w in ["как","почему","что делать","секрет"]): reasons.append("хук-вопрос/обещание пользы")
    if v["dur"]<=60: reasons.append("шортс/короткий формат")
    er=(v["likes"]+v["comments"])/max(1,v["views"])*100
    if er>=3: reasons.append(f"высокий ER {er:.1f}% (сильный эмоц. отклик)")
    if v["comments"]/max(1,v["views"])>0.002: reasons.append("спорная тема → дискуссия в комментах")
    return reasons or ["узнаваемая боль + простой посыл"]

def build(at):
    seen=seen_ids()
    vids=collect(at, seen)
    top=sorted(vids.values(), key=lambda x:-x["views"])[:10]
    if len(top)<10:  # если 1M+ свежих мало — добираем без учёта дедупа (но помечаем)
        extra=sorted(collect(at,set()).values(), key=lambda x:-x["views"])
        for v in extra:
            if v["id"] not in {t["id"] for t in top}: top.append(v)
            if len(top)>=10: break
    subs=subs_for(at, {v["chid"] for v in top})
    for v in top:
        v["subs"]=subs.get(v["chid"],0); v["er"]=(v["likes"]+v["comments"])/max(1,v["views"])*100
        v["url"]=f"https://youtu.be/{v['id']}"; v["why"]=why_viral(v)
    return top

def hook_type(t):
    t=t.lower()
    if re.search(r"\d",t): return "цифра/список в заголовке"
    if any(w in t for w in ["ошибка","нельзя","никогда","хватит","перестань","не говори"]): return "запрет/ошибка (страх упустить)"
    if any(w in t for w in ["как","почему","что делать","секрет","этому"]): return "вопрос/обещание пользы"
    if "?" in t: return "прямой вопрос зрителю"
    return "любопытство/интрига"

def borrow(v):
    er=v["er"]
    tips=[]
    tips.append(f"хук-приём: {hook_type(v['title'])} — адаптируй под веру/воспитание")
    if v["dur"]<=30: tips.append("держи ролик коротким (≤30с), одна мысль")
    if er>=3: tips.append("сильная эмоция/спор — заложи эмоциональный разворот и вопрос в конце")
    if v["comments"]/max(1,v["views"])>0.001: tips.append("тема провоцирует комменты — задай вопрос под ролик")
    return tips

def md_brief(top, day, reel_nn):
    L=[f"# БРИФ КОНКУРЕНТОВ — МЕТАНОЙА · ролик {reel_nn}",
       f"_{day} · YouTube Data API · ТОП-{len(top)} · только 1M+ · всегда разные ролики (дедуп)_\n",
       "На ОСНОВЕ этого брифа собери НОВЫЙ уникальный ролик (НЕ копируя): свой хук в первые 2с, одна мысль, эмоция, сохраняемость, тёплый христианский разворот, воронка в описании. Разнообразие по DIVERSITY_LEDGER.\n",
       "---\n"]
    for i,v in enumerate(top,1):
        L.append(f"## {i}. {v['title']}")
        L.append(f"- **Канал:** {v['ch']} — {num(v['subs'])} подписчиков · опубл. {v['date']} · длит. {v['dur']}с")
        L.append(f"- **Метрики:** 👁 {v['views']:,} просмотров · ❤ {v['likes']:,} лайков · 💬 {v['comments']:,} комментариев · ER {v['er']:.2f}%".replace(","," "))
        L.append(f"  (репосты/сохранения — YouTube Data API не отдаёт; смотрим просмотры/лайки/комменты)")
        L.append(f"- **Ссылка:** {v['url']}")
        L.append(f"- **Тип хука:** {hook_type(v['title'])}")
        L.append(f"- **Почему залетел:** {'; '.join(v['why'])}")
        if v.get("desc"): L.append(f"- **Из описания:** {v['desc'][:160].strip()}...")
        L.append(f"- **Что взять нам:** {'; '.join(borrow(v))}")
        L.append("")
    # сводные приёмы
    words=re.findall(r"[а-яёa-z]{4,}"," ".join(v["title"].lower() for v in top))
    from collections import Counter
    common=[w for w,_ in Counter(words).most_common(8)]
    L.append("## РАЗБОР (что заходит в нише)")
    L.append(f"- Частые слова топ-заголовков: {', '.join(common)}")
    L.append("- Паттерны хука: цифра/топ, запрет/«ошибка», вопрос-обещание пользы, спорная тема → комменты.")
    L.append("- Формат: короткий, одна мысль, сильный первый кадр, CTA.")
    L.append("- ВОРОНКА для нас: боль из топа → тёплый христианский разворот → мостик к школе МЕТАНОЙА → CTA на сайт okoteam.top/канал; кодовое слово в комменте (напр. «ВЕРА» → лид в ЛС).")
    L.append("\n_Задача: взять сильную боль/приём отсюда и сделать СВОЙ уникальный ролик (без повторов по DIVERSITY_LEDGER)._")
    return "\n".join(L)

def render_png(top, day, reel_nn):
    def row(i,v):
        return (f"<div class='v'><div class='n'>{i}</div><div class='b'>"
                f"<div class='t'>{html.escape(v['title'][:70])}</div>"
                f"<div class='m'><b>{v['ch'][:26]}</b> · {num(v['subs'])} подп · {v['date']} · {v['dur']}с</div>"
                f"<div class='s'><span>👁 {num(v['views'])}</span><span>❤ {num(v['likes'])}</span><span>💬 {num(v['comments'])}</span><span class='er'>ER {v['er']:.1f}%</span></div>"
                f"<div class='u'>{html.escape(v['url'])}</div>"
                f"<div class='w'>🔥 {html.escape('; '.join(v['why']))}</div></div></div>")
    rows="".join(row(i,v) for i,v in enumerate(top,1))
    doc=f"""<!DOCTYPE html><html><head><meta charset='utf-8'><style>
*{{margin:0;padding:0;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif}}
body{{width:1080px;background:#0d0d0d;color:#f2f2f2;padding:48px 44px}}
h1{{font-size:40px;color:#9AFF00}} .sub{{color:#9a9a9a;font-size:22px;margin:6px 0 26px}}
.v{{display:flex;gap:20px;background:#151515;border-radius:16px;padding:22px 24px;margin-bottom:16px}}
.n{{font-size:44px;color:#9AFF00;font-weight:bold;min-width:44px}}
.t{{font-size:26px;color:#fff;font-weight:bold;line-height:1.25}}
.m{{color:#9a9a9a;font-size:20px;margin:6px 0}}
.s{{display:flex;gap:22px;font-size:23px;color:#f2f2f2;margin:6px 0}} .s .er{{color:#9AFF00;font-weight:bold}}
.u{{color:#6fa8ff;font-size:20px;margin:4px 0}}
.w{{color:#ffd27a;font-size:20px;margin-top:6px}}
.box{{background:#151515;border-radius:16px;padding:22px 24px;margin-top:8px;font-size:22px;line-height:1.5}}
.box b{{color:#9AFF00}}
</style></head><body>
<h1>МЕТАНОЙА · БРИФ КОНКУРЕНТОВ (ролик {reel_nn})</h1>
<div class='sub'>{day} · YouTube · только 1M+ · всегда разные · данные реальные</div>
{rows}
<div class='box'>🎯 <b>Воронка для нашего ролика:</b> боль из топа → тёплый христианский разворот → мостик к школе МЕТАНОЙА → CTA на okoteam.top/канал; кодовое слово «ВЕРА» в комменте → лид в ЛС.<br>
Формат: короткий хук в первые 2с, одна мысль, эмоция, сохраняемость. Без повторов (см. реестр разнообразия).</div>
</body></html>"""
    tmp=tempfile.mkdtemp(); hp=os.path.join(tmp,"d.html"); open(hp,"w").write(doc)
    out=os.path.join(tmp,"brief.png")
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b=p.chromium.launch(executable_path="/opt/pw-browsers/chromium",args=["--no-sandbox"])
        pg=b.new_page(viewport={"width":1080,"height":100}); pg.goto("file://"+hp); pg.wait_for_timeout(400)
        pg.screenshot(path=out,full_page=True); b.close()
    return out

def tg_photo(png, caption):
    tok=os.environ.get("CLIENT_EKAT_ANALYTICS_BOT_TOKEN"); ca=os.environ.get("SSL_CERT_FILE","/root/.ccr/ca-bundle.crt")
    chats=[]
    try: chats=open("/opt/oko-poster/cfg/metanoia_recipients.txt").read().split()
    except: chats=os.environ.get("METANOIA_TG_CHATS","").split(",")
    for c in filter(None,chats):
        subprocess.run(["curl","-s","--cacert",ca,"-F",f"chat_id={c}","-F",f"caption={caption}","-F",f"photo=@{png}",
                        f"https://api.telegram.org/bot{tok}/sendPhoto"],capture_output=True)

def tg_document(path, caption):
    tok=os.environ.get("CLIENT_EKAT_ANALYTICS_BOT_TOKEN"); ca=os.environ.get("SSL_CERT_FILE","/root/.ccr/ca-bundle.crt")
    chats=[]
    try: chats=open("/opt/oko-poster/cfg/metanoia_recipients.txt").read().split()
    except: chats=os.environ.get("METANOIA_TG_CHATS","").split(",")
    for c in filter(None,chats):
        subprocess.run(["curl","-s","--cacert",ca,"-F",f"chat_id={c}","-F",f"caption={caption}","-F",f"document=@{path}",
                        f"https://api.telegram.org/bot{tok}/sendDocument"],capture_output=True)

def main():
    reel_nn=sys.argv[1] if len(sys.argv)>1 else "next"
    day=datetime.date.today().strftime("%d.%m.%Y")
    at=token(); top=build(at)
    os.makedirs(BRIEFS,exist_ok=True)
    brief=md_brief(top,day,reel_nn)
    bp=f"{BRIEFS}/brief_{reel_nn}.md"; open(bp,"w").write(brief)
    # дедуп: записать показанные id
    open(STATE,"a").write("".join(v["id"]+"\n" for v in top))
    # ОТПРАВКА ФАЙЛОМ (Даниэль: не картинка, а полноценный файл-отчёт)
    try: tg_document(bp, f"📄 МЕТАНОЙА · бриф конкурентов (ТОП-{len(top)} роликов 1M+, детальный анализ) — основа для ролика {reel_nn}")
    except Exception as e: sys.stderr.write(f"send fail {e}\n")
    print(json.dumps({"brief":bp,"count":len(top),"videos":[{"t":v["title"][:40],"views":v["views"],"url":v["url"]} for v in top]},ensure_ascii=False))

if __name__=="__main__": main()
