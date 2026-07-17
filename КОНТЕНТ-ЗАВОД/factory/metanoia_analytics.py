#!/usr/bin/env python3
# МЕТАНОЙА · ежедневная аналитика (детерминированно, на VPS, БЕЗ LLM/контейнеров).
# Тянет YouTube (Data API) + Instagram (instagrapi) + TikTok (Hooppy), пишет отчёт-файлы
# и рассылает в бота. Запуск: cron 07:00 UTC (10:00 МСК). Всё best-effort — не падает.
import os, json, time, subprocess, urllib.request, urllib.parse, datetime, traceback
CFG="/opt/oko-poster/cfg"
def env(k,d=""):
    return os.environ.get(k,d)
def http(url, data=None, headers=None, method=None, timeout=30):
    if isinstance(data,dict): data=urllib.parse.urlencode(data).encode()
    r=urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    with urllib.request.urlopen(r, timeout=timeout) as resp: return resp.read().decode()
def num(n):
    try: n=float(n)
    except: return str(n)
    for u,d in [('M',1e6),('K',1e3)]:
        if n>=d: return f"{n/d:.1f}{u}".replace('.0','')
    return str(int(n))

out={"yt":{},"ig":{},"tt":{},"err":[]}

# ---- YouTube ----
try:
    tok=json.loads(http("https://oauth2.googleapis.com/token", {
        "client_id":env("CLIENT_YT_CLIENT_ID"),"client_secret":env("CLIENT_YT_CLIENT_SECRET"),
        "refresh_token":env("CLIENT_EKAT_YT_REFRESH_TOKEN"),"grant_type":"refresh_token"}))["access_token"]
    H={"Authorization":f"Bearer {tok}"}
    ch=json.loads(http("https://www.googleapis.com/youtube/v3/channels?part=statistics,contentDetails&mine=true",headers=H))["items"][0]
    st=ch["statistics"]; out["yt"]["subs"]=int(st.get("subscriberCount",0)); out["yt"]["views"]=int(st.get("viewCount",0))
    up=ch["contentDetails"]["relatedPlaylists"]["uploads"]
    pl=json.loads(http(f"https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=10&playlistId={up}",headers=H))
    vids=",".join(i["contentDetails"]["videoId"] for i in pl.get("items",[]))
    out["yt"]["reels"]=len(pl.get("items",[]))
    if vids:
        vs=json.loads(http(f"https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id={vids}",headers=H))
        items=[{"t":v["snippet"]["title"][:38],"v":int(v["statistics"].get("viewCount",0)),
                "l":int(v["statistics"].get("likeCount",0)),"id":v["id"]} for v in vs.get("items",[])]
        out["yt"]["last"]=items[:5]
        out["yt"]["reel_views"]=sum(i["v"] for i in items)
except Exception as e: out["err"].append("YT:"+str(e))

# ---- Instagram ----
try:
    from instagrapi import Client
    d=json.load(open(f"{CFG}/ig_ekat_state.json"))
    sid=[c["value"] for c in d["cookies"] if c["name"]=="sessionid"][0]
    c=Client(); c.delay_range=[1,3]; c.login_by_sessionid(sid)
    u=c.user_info(c.user_id)
    out["ig"]["followers"]=u.follower_count; out["ig"]["posts"]=u.media_count
    meds=c.user_medias(c.user_id, amount=5)
    out["ig"]["last"]=[{"v":m.play_count or m.view_count or 0,"l":m.like_count,"c":m.comment_count,"code":m.code} for m in meds]
    out["ig"]["reel_views"]=sum(x["v"] for x in out["ig"]["last"])
except Exception as e: out["err"].append("IG:"+str(e))

# ---- TikTok (Hooppy, best-effort) ----
try:
    tt=env("HOOPPY_TT_PAGE_EKAT"); tk=env("HOOPPY_API_TOKEN")
    r=http(f"https://api.hooppy.ru/api/social/pages/{tt}", headers={"Authorization":f"Bearer {tk}","Accept":"application/json"})
    p=json.loads(r); p=p.get("page",p)
    out["tt"]["followers"]=p.get("followers") or p.get("followers_count")
except Exception as e: out["err"].append("TT:"+str(e))

# ---- свод + дельты ----
today=datetime.datetime.utcnow().strftime("%d.%m.%Y")
prev={}
try: prev=json.load(open(f"{CFG}/metanoia_state.json"))
except: pass
foll=(out["yt"].get("subs",0))+(out["ig"].get("followers",0))+(out["tt"].get("followers") or 0)
views=(out["yt"].get("views",0))+(out["ig"].get("reel_views",0))
reels=out["yt"].get("reels",0)
def dlt(cur,key):
    p=prev.get(key); return f" (+{num(cur-p)})" if isinstance(p,(int,float)) and cur>=p else ""
state={"reels_total":reels,"views_total":views,"followers_total":foll,"updated":today}
json.dump(state, open(f"{CFG}/metanoia_state.json","w"))

# ---- HTML-отчёт ----
ytl="".join(f"• {i['t']} — {num(i['v'])}👁 {num(i['l'])}❤\n" for i in out["yt"].get("last",[])[:3])
igl="".join(f"• reel/{i['code']} — {num(i['v'])}👁 {num(i['l'])}❤ {num(i['c'])}💬\n" for i in out["ig"].get("last",[])[:3])
rep=(f"<b>📊 МЕТАНОЙА · аналитика {today}</b>\n\n"
     f"<b>Итого:</b> 👥 {num(foll)}{dlt(foll,'followers_total')} подписчиков · 👁 {num(views)}{dlt(views,'views_total')} просмотров · 🎬 {reels} роликов\n\n"
     f"<b>▶️ YouTube</b> — подписчиков {num(out['yt'].get('subs',0))}, просмотров {num(out['yt'].get('views',0))}\n{ytl}\n"
     f"<b>📸 Instagram</b> — подписчиков {num(out['ig'].get('followers',0))}\n{igl}\n"
     f"<b>🎵 TikTok</b> — подписчиков {num(out['tt'].get('followers') or '—')}\n")
if out["err"]: rep+=f"\n<i>Недоступно: {'; '.join(out['err'])[:200]}</i>"
open(f"{CFG}/metanoia_report_latest.txt","w",encoding="utf-8").write(rep)
open(f"{CFG}/metanoia_week.txt","a",encoding="utf-8").write(f"{today}: 👥{num(foll)} 👁{num(views)} 🎬{reels}\n")

# ---- рассылка в бота ----
tokb=env("CLIENT_EKAT_ANALYTICS_BOT_TOKEN")
sent=0
if tokb:
    try: recips=[x for x in open(f"{CFG}/metanoia_recipients.txt").read().split() if x.strip()]
    except: recips=[]
    for chat in recips:
        try:
            http(f"https://api.telegram.org/bot{tokb}/sendMessage",
                 {"chat_id":chat,"text":rep,"parse_mode":"HTML","disable_web_page_preview":"true"}); sent+=1
        except Exception as e: out["err"].append("send:"+str(e))
print(json.dumps({"foll":foll,"views":views,"reels":reels,"sent":sent,"err":out["err"]},ensure_ascii=False))
