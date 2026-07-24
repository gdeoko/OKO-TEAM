#!/usr/bin/env python3
# diesel_analytics.py — ежедневная аналитика DIESEL CARGO (обе пачки), шлёт в DIESEL-бот.
# Тянет YouTube A (cfg/yt_creds.env) + YouTube B (cfg/ytnew_b.env). TT/IG — best-effort.
# Запуск: cron 07:00 UTC. Всё best-effort, не падает. Заменяет ошибочный metanoia_analytics.
import os, json, glob, subprocess, urllib.request, urllib.parse, datetime
CFG = "/opt/oko-poster/cfg"

def http(u, data=None, H=None, timeout=30):
    if isinstance(data, dict):
        data = urllib.parse.urlencode(data).encode()
    return urllib.request.urlopen(urllib.request.Request(u, data=data, headers=H or {}), timeout=timeout).read().decode()

def load_env(path):
    d = {}
    if not os.path.exists(path):
        return d
    for ln in open(path):
        ln = ln.strip()
        if ln.startswith("export "):
            ln = ln[7:]
        if "=" in ln and not ln.startswith("#"):
            k, v = ln.split("=", 1)
            d[k.strip()] = v.strip().strip('"').strip("'")
    return d

def num(n):
    try:
        n = float(n)
    except Exception:
        return str(n)
    for u, dv in [('M', 1e6), ('K', 1e3)]:
        if n >= dv:
            return (f"{n/dv:.1f}{u}").replace('.0', '')
    return str(int(n))

def yt(envfile, label):
    e = load_env(envfile)
    cid = e.get("YT_CLIENT_ID"); cs = e.get("YT_CLIENT_SECRET"); rt = e.get("YT_REFRESH_TOKEN")
    if not (cid and cs and rt):
        return f"• {label}: нет токена"
    try:
        tok = json.loads(http("https://oauth2.googleapis.com/token", {"client_id": cid, "client_secret": cs, "refresh_token": rt, "grant_type": "refresh_token"}))["access_token"]
        H = {"Authorization": f"Bearer {tok}"}
        ch = json.loads(http("https://www.googleapis.com/youtube/v3/channels?part=statistics,contentDetails,snippet&mine=true", H=H))["items"][0]
        st = ch["statistics"]; title = ch["snippet"]["title"]
        subs = int(st.get("subscriberCount", 0)); views = int(st.get("viewCount", 0)); nv = st.get("videoCount", 0)
        up = ch["contentDetails"]["relatedPlaylists"]["uploads"]
        pl = json.loads(http(f"https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&maxResults=6&playlistId={up}", H=H))
        vids = [i["contentDetails"]["videoId"] for i in pl["items"]]
        stt = json.loads(http("https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=" + ",".join(vids), H=H))
        rows = []
        for v in stt["items"][:4]:
            s = v["statistics"]
            rows.append(f"    {v['snippet']['title'][:34]} — {num(s.get('viewCount',0))}👁 {num(s.get('likeCount',0))}❤")
        return f"• {label} «{title}»: {subs} подп · {num(views)} просм · {nv} видео\n" + "\n".join(rows)
    except Exception as ex:
        return f"• {label}: ошибка {str(ex)[:80]}"

today = datetime.datetime.now(datetime.timezone.utc).strftime("%d.%m.%Y")
reels = len(glob.glob("/opt/oko-poster/published/*/reel.mp4"))
lines = [f"📊 DIESEL CARGO · аналитика {today} (10:00 МСК)", ""]
lines += [f"Опубликовано роликов (VPS): {reels} из 450.", ""]
lines += ["▶️ YouTube", yt(CFG + "/yt_creds.env", "Пачка A"), yt(CFG + "/ytnew_b.env", "Пачка B"), ""]
lines += ["🎵 TikTok: постинг в оба (A 2350915 · B 2363201); статистику Hooppy по API не отдаёт."]
lines += ["📸 Instagram: A diesel_cargo — заблокирован (нужна верификация ID); B diesel_kitay — живой."]
report = "\n".join(lines)
p = CFG + "/diesel_report_am.txt"
open(p, "w", encoding="utf-8").write(report)
r = subprocess.run(["python3", "/opt/oko-poster/send_to_bot.py", p, f"DIESEL · аналитика {today}"], capture_output=True, text=True)
print("DIESEL_ANALYTICS_DONE", (r.stdout or r.stderr)[:120])
