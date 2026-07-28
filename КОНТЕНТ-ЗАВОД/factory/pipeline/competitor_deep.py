#!/usr/bin/env python3
# МЕТАНОЙА · НАСТОЯЩИЙ глубокий разбор конкурентов ПЕРЕД каждым роликом (Библия §3, на 100%).
# Не метаданные из головы — реальный материал КАЖДОГО ролика: раскадровка + транскрипт + метрики
# + комментарии. Из этого модель (Claude) пишет сценарий (хук-первым) и строит ролик.
#
# Обход блокировок (Библия §3.2, §11):
#   - облако блокирует googlevideo (403 на само видео), НО авто-субтитры и метрики/комменты — ок.
#   - VPS качает видео целиком (403 нет) → раскадровка (ffmpeg tile) + whisper (fallback транскрипт).
#   Гибрид: транскрипт = облачные авто-сабы (чисто, быстро) → если нет, VPS whisper.
#            раскадровка = VPS download+tile (чисто). метрики+комменты = YouTube Data API (облако).
#   Каждый шаг — отдельно, с обработкой ошибок (чтобы падение одного не рушило разбор).
#
# Итог: scratchpad/analysis_NN/<rank>_<id>/{metrics.json, transcript.txt, storyboard.jpg, comments.txt}
#       + INDEX.json + DOC.md (красивый документ-аналитика) → отправляется в Telegram-бота обоим админам.
#
# usage: python3 competitor_deep.py <reel_nn> [count=10]
import os, re, sys, json, email, base64, subprocess, urllib.request, urllib.parse, datetime

REPO="/home/user/OKO-TEAM"
FACT=f"{REPO}/КОНТЕНТ-ЗАВОД/factory"
STATE=f"{FACT}/analyzed_videos.txt"
SCRATCH="/tmp/claude-0/-home-user-OKO-TEAM/f6f2aa4f-e22a-54d1-83e7-29eece9e291a/scratchpad"
VPS_URL=os.environ["OKO_VPS_CTRL_URL"].rstrip("/")+"/exec"
VPS_TOK=os.environ["OKO_VPS_CTRL_TOKEN"]
BOT=os.environ.get("CLIENT_EKAT_ANALYTICS_BOT_TOKEN","")
ADMINS=["1966985736","765430195"]  # Даниэль + Екатерина (оба, Библия §7)

QUERIES=["воспитание детей","детская психология","православие семья","вера дети воспитание",
         "мама воспитание сын","как воспитывать ребёнка","многодетная семья","отношения родители дети",
         "духовное воспитание","дети и родители психология","христианские ценности семья","воспитание с любовью",
         "мама и дочь советы","детские капризы что делать","подросток и родители",
         "семейные ценности","мотивация для родителей","детское развитие","эмоции ребёнка",
         "как говорить с ребёнком","доброта детям","семейное счастье","мудрость для мам",
         "поддержка ребёнка","детские страхи","благодарность семья","совесть и дети"]
MIN_VIEWS=1_000_000
VPATH="export PATH=$PATH:/home/okoposter/.local/bin"

# ---------------- YouTube Data API (облако) ----------------
def yt_token():
    d=urllib.parse.urlencode({"client_id":os.environ["CLIENT_YT_CLIENT_ID"],
        "client_secret":os.environ["CLIENT_YT_CLIENT_SECRET"],
        "refresh_token":os.environ["CLIENT_EKAT_YT_REFRESH_TOKEN"],
        "grant_type":"refresh_token"}).encode()
    return json.load(urllib.request.urlopen(urllib.request.Request(
        "https://oauth2.googleapis.com/token",data=d),timeout=30))["access_token"]

def api(at,path,params):
    u=f"https://www.googleapis.com/youtube/v3/{path}?"+urllib.parse.urlencode(params)
    return json.load(urllib.request.urlopen(urllib.request.Request(u,
        headers={"Authorization":f"Bearer {at}"}),timeout=40))

def iso_dur(s):
    m=re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?",s or "")
    h,mi,se=(int(x) if x else 0 for x in (m.groups() if m else (0,0,0)))
    return h*3600+mi*60+se

def seen_ids():
    try: return set(open(STATE).read().split())
    except: return set()

def collect(at, exclude):
    vids={}
    for q in QUERIES:
        try: d=api(at,"search",{"part":"snippet","type":"video","order":"viewCount",
            "maxResults":10,"relevanceLanguage":"ru","q":q})
        except Exception: continue
        ids=[it["id"]["videoId"] for it in d.get("items",[])
             if it.get("id",{}).get("videoId") and it["id"]["videoId"] not in exclude]
        if not ids: continue
        for i in range(0,len(ids),50):
            try: st=api(at,"videos",{"part":"statistics,snippet,contentDetails","id":",".join(ids[i:i+50])})
            except Exception: continue
            for v in st.get("items",[]):
                s=v["statistics"]; views=int(s.get("viewCount",0)); dur=iso_dur(v["contentDetails"]["duration"])
                if views<MIN_VIEWS or v["id"] in exclude: continue
                lk=int(s.get("likeCount",0)); cm=int(s.get("commentCount",0))
                vids[v["id"]]={"id":v["id"],"title":v["snippet"]["title"],"ch":v["snippet"]["channelTitle"],
                    "chid":v["snippet"]["channelId"],"views":views,"likes":lk,"comments":cm,"dur":dur,
                    "date":v["snippet"].get("publishedAt","")[:10],"er":round((lk+cm)/max(1,views)*100,2),
                    "url":f"https://youtu.be/{v['id']}","is_short":dur<=65}
    return vids

def subs_for(at, chids):
    out={}; cl=list(chids)
    for i in range(0,len(cl),40):
        try:
            d=api(at,"channels",{"part":"statistics","id":",".join(cl[i:i+40])})
            for c in d.get("items",[]): out[c["id"]]=int(c["statistics"].get("subscriberCount",0))
        except: pass
    return out

def top_comments(at, vid, n=5):
    try:
        d=api(at,"commentThreads",{"part":"snippet","videoId":vid,"maxResults":n,"order":"relevance","textFormat":"plainText"})
        out=[]
        for it in d.get("items",[]):
            c=it["snippet"]["topLevelComment"]["snippet"]
            out.append(f"({c.get('likeCount',0)}👍) {c.get('textDisplay','').strip()[:180]}")
        return out
    except Exception: return []

# ---------------- транскрипт: облачные авто-сабы ----------------
def clean_vtt(txt):
    lines=[]
    for ln in txt.split("\n"):
        if "-->" in ln or ln.strip().isdigit() or ln.startswith(("WEBVTT","Kind","Language")) or not ln.strip(): continue
        ln=re.sub(r"<[^>]+>","",ln).strip()
        if ln and (not lines or lines[-1]!=ln): lines.append(ln)
    return " ".join(lines)

def cloud_transcript(vid, wd):
    for lang in ("ru","en"):
        try:
            subprocess.run(["yt-dlp","--skip-download","--write-auto-subs","--sub-lang",lang,
                "--sub-format","vtt","-o",f"{wd}/{vid}","--quiet","--no-warnings",
                f"https://youtu.be/{vid}"],cwd=wd,timeout=90,capture_output=True)
        except Exception: pass
        for f in os.listdir(wd):
            if f.startswith(vid) and f.endswith(".vtt"):
                t=clean_vtt(open(f"{wd}/{f}",encoding="utf-8",errors="ignore").read())
                if len(t)>40: return t
    return ""

# ---------------- VPS: download + storyboard + whisper ----------------
def vexec(cmd, timeout=300):
    body=json.dumps({"cmd":cmd}).encode()
    req=urllib.request.Request(VPS_URL,data=body,method="POST",
        headers={"Authorization":f"Bearer {VPS_TOK}","Content-Type":"application/json"})
    return json.load(urllib.request.urlopen(req,timeout=timeout))

def vps_download(vid):
    d=f"/tmp/deep/{vid}"
    cmd=(f'{VPATH}; rm -rf {d}; mkdir -p {d}; cd {d}; '
         f'yt-dlp -q --no-warnings -f "bv*[height<=720][ext=mp4]+ba[ext=m4a]/b[height<=720][ext=mp4]/b[height<=720]/b" '
         f'--max-filesize 130M -o v.mp4 "https://youtu.be/{vid}" 2>&1 | tail -1; '
         f'[ -f v.mp4 ] && echo OK || echo FAIL')
    r=vexec(cmd,240); return r.get("stdout","").strip().endswith("OK")

def vps_storyboard(vid, dur):
    d=f"/tmp/deep/{vid}"; every=max(1,(dur or 40)//20)
    cmd=(f'cd {d}; ffmpeg -v error -y -i v.mp4 -vf "fps=1/{every},scale=176:-1,tile=5x4" -frames:v 1 sb.jpg 2>&1 | tail -1; '
         f'[ -f sb.jpg ] && base64 -w0 sb.jpg | head -c 118000 || echo NOSB')
    r=vexec(cmd,180); out=r.get("stdout","").strip()
    if not out or out=="NOSB": return None
    try: return base64.b64decode(out+"="*(-len(out)%4))
    except Exception: return None

def vps_whisper(vid):
    d=f"/tmp/deep/{vid}"
    cmd=(f'{VPATH}; cd {d}; ffmpeg -v error -y -i v.mp4 -ar 16000 -ac 1 -t 100 a.wav 2>&1 | tail -1; '
         f'python3 -c "from faster_whisper import WhisperModel; m=WhisperModel(\'base\',device=\'cpu\',compute_type=\'int8\'); '
         f's,_=m.transcribe(\'a.wav\',language=\'ru\',vad_filter=False); print(\' \'.join(x.text.strip() for x in s))" 2>/dev/null')
    r=vexec(cmd,300); return (r.get("stdout","") or "").strip()

# ---------------- документ + бот ----------------
def num(n):
    n=int(n); return f"{n/1_000_000:.1f}M" if n>=1_000_000 else (f"{n/1_000:.1f}K" if n>=1_000 else str(n))

def build_doc(reel_nn, day, done):
    L=[f"# ДОКУМЕНТ-АНАЛИТИКА КОНКУРЕНТОВ — МЕТАНОЙА · ролик {reel_nn}",
       f"_{day} · настоящий разбор: раскадровка + транскрипт + метрики + комментарии · только 1M+ · всегда новые_\n",
       "Из этого документа собирается НОВЫЙ уникальный ролик (хук-первым, кадры под смысл, ноль повторов).\n","---\n"]
    for v in done:
        L.append(f"## {v['rank']}. {v['title']}")
        L.append(f"- Канал: **{v['ch']}** — {num(v.get('subs',0))} подписчиков · {v['date']} · {v['dur']}с · [{v['url']}]({v['url']})")
        L.append(f"- Метрики: 👁 {num(v['views'])} · ❤ {num(v['likes'])} · 💬 {num(v['comments'])} · **ER {v['er']}%**")
        L.append(f"- Транскрипт: {'есть ('+str(len(v.get('txt','')))+' зн.)' if v.get('txt') and v['txt']!='[нет речи]' else 'нет речи (музыка/мем)'}"
                 f" · раскадровка: {'есть' if v.get('sb') else 'нет'}")
        if v.get("txt") and v["txt"]!="[нет речи]":
            L.append(f"  - _хук/начало:_ «{v['txt'][:160]}…»")
        if v.get("cmts"):
            L.append("  - Комментарии (что зацепило):")
            for c in v["cmts"][:3]: L.append(f"    - {c}")
        L.append("")
    return "\n".join(L)

def tg_send_doc(path, caption):
    if not BOT: return "нет токена бота"
    res=[]
    for chat in ADMINS:
        try:
            import mimetypes
            boundary="----okodeep"; data=open(path,"rb").read(); fn=os.path.basename(path)
            body=b""
            for k,val in [("chat_id",chat),("caption",caption[:1000]),("parse_mode","HTML")]:
                body+=f"--{boundary}\r\nContent-Disposition: form-data; name=\"{k}\"\r\n\r\n{val}\r\n".encode()
            body+=f"--{boundary}\r\nContent-Disposition: form-data; name=\"document\"; filename=\"{fn}\"\r\n".encode()
            body+=b"Content-Type: text/markdown\r\n\r\n"+data+f"\r\n--{boundary}--\r\n".encode()
            req=urllib.request.Request(f"https://api.telegram.org/bot{BOT}/sendDocument",data=body,
                headers={"Content-Type":f"multipart/form-data; boundary={boundary}"})
            d=json.load(urllib.request.urlopen(req,timeout=60)); res.append(f"{chat}:{'ok' if d.get('ok') else d}")
        except Exception as e: res.append(f"{chat}:ERR {e}")
    return " | ".join(res)

# ---------------- main ----------------
def main():
    reel_nn=sys.argv[1] if len(sys.argv)>1 else "NN"
    count=int(sys.argv[2]) if len(sys.argv)>2 else 10
    outroot=f"{SCRATCH}/analysis_{reel_nn}"; os.makedirs(outroot,exist_ok=True)
    vtmp=f"{outroot}/_vtt"; os.makedirs(vtmp,exist_ok=True)
    day=datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M")
    print(f"[deep] reel {reel_nn} · цель {count} конкурентов · discovery…",flush=True)
    at=yt_token(); seen=seen_ids(); vids=collect(at,seen)
    top=sorted(vids.values(), key=lambda x:(-int(x["is_short"]),-x["views"]))[:count*2]
    subs=subs_for(at,{v["chid"] for v in top})
    print(f"[deep] найдено {len(vids)} свежих 1M+ · разбираю до {count}",flush=True)
    done=[]; used=[]
    for v in top:
        if len(done)>=count: break
        v["subs"]=subs.get(v["chid"],0)
        print(f"[deep] ⤵ {v['id']} · {num(v['views'])} · ER{v['er']}% · {v['dur']}s · {v['title'][:46]}",flush=True)
        # транскрипт: облако авто-сабы
        txt=cloud_transcript(v["id"], vtmp)
        # VPS: download → storyboard → (если нет транскрипта) whisper
        sb=None
        if vps_download(v["id"]):
            sb=vps_storyboard(v["id"], v["dur"])
            if not txt:
                txt=vps_whisper(v["id"])
        else:
            print("[deep]   ⚠ VPS download fail — беру только облачные данные",flush=True)
        cmts=top_comments(at, v["id"])
        v["txt"]=txt or "[нет речи]"; v["sb"]=bool(sb); v["cmts"]=cmts
        rank=len(done)+1; v["rank"]=rank
        od=f"{outroot}/{rank:02d}_{v['id']}"; os.makedirs(od,exist_ok=True)
        json.dump({k:v[k] for k in v if k!="sb"}, open(f"{od}/metrics.json","w"), ensure_ascii=False, indent=1)
        open(f"{od}/transcript.txt","w").write(v["txt"])
        if cmts: open(f"{od}/comments.txt","w").write("\n".join(cmts))
        if sb: open(f"{od}/storyboard.jpg","wb").write(sb)
        print(f"[deep]   ✓ {rank:02d} txt={len(v['txt'])} sb={'y' if sb else 'n'} cmts={len(cmts)}",flush=True)
        done.append(v); used.append(v["id"])
    if used:
        open(STATE,"a").write("\n"+"\n".join(used)+"\n")
    json.dump({"reel":reel_nn,"date":day,"analyzed":[{k:v[k] for k in
        ("rank","id","title","views","likes","comments","er","dur","url","date","subs")} for v in done]},
        open(f"{outroot}/INDEX.json","w"), ensure_ascii=False, indent=1)
    doc=build_doc(reel_nn, day, done); docpath=f"{outroot}/DOC_{reel_nn}.md"; open(docpath,"w").write(doc)
    with_txt=sum(1 for v in done if v["txt"]!="[нет речи]"); with_sb=sum(1 for v in done if v["sb"])
    cap=(f"<b>МЕТАНОЙА · разбор конкурентов для ролика {reel_nn}</b>\n"
         f"Разобрано {len(done)} роликов 1M+ · транскрипт у {with_txt} · раскадровка у {with_sb} · комменты собраны.\n"
         f"Файл-основа для сборки ролика. {day} UTC")
    sent=tg_send_doc(docpath, cap)
    print(f"\n[deep] ГОТОВО: {len(done)} разборов · транскрипт {with_txt}/{len(done)} · раскадровка {with_sb}/{len(done)}",flush=True)
    print(f"[deep] документ → бот: {sent}",flush=True)
    print(f"[deep] материал: {outroot} (INDEX.json + DOC + <rank>_<id>/*)",flush=True)

if __name__=="__main__":
    main()
