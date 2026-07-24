#!/usr/bin/env python3
# МЕТАНОЙА · НАСТОЯЩИЙ глубокий разбор конкурентов ПЕРЕД каждым роликом.
# Не метаданные из головы, а реальный материал: скачивает N свежих 1M+ роликов ниши,
# делает раскадровку и транскрипт КАЖДОГО — чтобы модель прочитала и построила ролик из этого.
#
# Архитектура (облако блокирует googlevideo CDN, VPS — нет):
#   1) discovery: YouTube Data API находит свежие 1M+ ролики ниши (дедуп по analyzed_videos.txt)
#   2) на VPS через /exec: yt-dlp качает ролик → ffmpeg раскадровка (tile) + аудио 16kHz mono
#      → faster-whisper транскрипт. Наружу идёт только маленький текст + сжатая раскадровка (base64).
#   3) в scratchpad/analysis_NN/<rank>_<id>/ пишем: metrics.json, transcript.txt, storyboard.jpg
#   4) печатаем индекс — модель (Claude) читает раскадровки+транскрипты и пишет НАСТОЯЩИЙ разбор,
#      затем строит ролик ИЗ него (хук, темп, кадры, структура, воронка), по DIVERSITY_LEDGER.
#
# usage: python3 competitor_deep.py <reel_nn> [count=6]
import os, json, re, sys, base64, urllib.request, urllib.parse, datetime

REPO="/home/user/OKO-TEAM"
FACT=f"{REPO}/КОНТЕНТ-ЗАВОД/factory"
STATE=f"{FACT}/analyzed_videos.txt"
VPS_URL=os.environ["OKO_VPS_CTRL_URL"].rstrip("/")+"/exec"
VPS_TOK=os.environ["OKO_VPS_CTRL_TOKEN"]

QUERIES=["воспитание детей","детская психология","православие семья","вера дети воспитание",
         "мама воспитание сын","как воспитывать ребёнка","многодетная семья","отношения родители дети",
         "духовное воспитание","дети и родители психология","христианские ценности семья","воспитание с любовью"]
MIN_VIEWS=1_000_000

# ---------- YouTube Data API (discovery на облаке) ----------
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
                s=v["statistics"]; views=int(s.get("viewCount",0))
                dur=iso_dur(v["contentDetails"]["duration"])
                if views<MIN_VIEWS or v["id"] in exclude: continue
                vids[v["id"]]={"id":v["id"],"title":v["snippet"]["title"],"ch":v["snippet"]["channelTitle"],
                    "views":views,"likes":int(s.get("likeCount",0)),"comments":int(s.get("commentCount",0)),
                    "dur":dur,"date":v["snippet"].get("publishedAt","")[:10],
                    "er":round((int(s.get("likeCount",0))+int(s.get("commentCount",0)))/max(1,views)*100,2),
                    "url":f"https://youtu.be/{v['id']}","is_short":dur<=65}
    return vids

# ---------- VPS orchestration ----------
def vexec(cmd, timeout=300):
    body=json.dumps({"cmd":cmd}).encode()
    req=urllib.request.Request(VPS_URL,data=body,method="POST",
        headers={"Authorization":f"Bearer {VPS_TOK}","Content-Type":"application/json"})
    return json.load(urllib.request.urlopen(req,timeout=timeout))

def deep_one(v, outdir):
    """Скачать+раскадровка+транскрипт одного ролика НА VPS. Вернуть (ok, transcript, sb_bytes)."""
    vid=v["id"]; d=f"/tmp/deep/{vid}"
    # 1) download (Shorts или обычное, ≤720p, ограничим 90с чтобы не тянуть длинные)
    cmd=(f'export PATH=$PATH:/home/okoposter/.local/bin; rm -rf {d}; mkdir -p {d}; cd {d}; '
         f'yt-dlp -q --no-warnings -f "best[height<=720][ext=mp4]/best[height<=720]/best" '
         f'--max-filesize 120M -o v.mp4 "https://youtu.be/{vid}" 2>&1 | tail -1; '
         f'ls -la v.mp4 2>/dev/null | wc -l')
    r=vexec(cmd, 240)
    if r.get("exit")!=0 or "1" not in r.get("stdout","").strip().split("\n")[-1]:
        return False, f"[download failed] {r.get('stdout','')[:120]}", None
    # 2) storyboard (tile 5x4 по кадру каждые dur/20с) + 3) audio + 4) whisper — одним заходом
    every=max(1, v["dur"]//20) if v["dur"] else 3
    cmd=(f'export PATH=$PATH:/home/okoposter/.local/bin; cd {d}; '
         f'ffmpeg -v error -y -i v.mp4 -vf "fps=1/{every},scale=176:-1,tile=5x4" -frames:v 1 sb.jpg 2>&1 | tail -1; '
         f'ffmpeg -v error -y -i v.mp4 -ar 16000 -ac 1 -t 90 a.wav 2>&1 | tail -1; '
         f'python3 -c "from faster_whisper import WhisperModel; m=WhisperModel(\'base\',device=\'cpu\',compute_type=\'int8\'); '
         f's,_=m.transcribe(\'a.wav\',language=\'ru\',vad_filter=False); '
         f'print(\'@@TXT@@\'); print(\' \'.join(x.text.strip() for x in s))" 2>/dev/null; '
         f'echo "@@SB@@"; base64 -w0 sb.jpg | head -c 120000')
    r=vexec(cmd, 300)
    out=r.get("stdout","")
    txt=""; sb_b64=""
    if "@@TXT@@" in out:
        rest=out.split("@@TXT@@",1)[1]
        if "@@SB@@" in rest:
            txt, sb_b64 = rest.split("@@SB@@",1)
        else:
            txt=rest
    txt=txt.strip()
    sb=None
    try:
        if sb_b64.strip(): sb=base64.b64decode(sb_b64.strip()+"="*(-len(sb_b64.strip())%4))
    except Exception: sb=None
    return True, (txt or "[no speech]"), sb

def main():
    reel_nn=sys.argv[1] if len(sys.argv)>1 else "NN"
    count=int(sys.argv[2]) if len(sys.argv)>2 else 6
    outroot=f"/tmp/claude-0/-home-user-OKO-TEAM/f6f2aa4f-e22a-54d1-83e7-29eece9e291a/scratchpad/analysis_{reel_nn}"
    os.makedirs(outroot, exist_ok=True)
    print(f"[deep] reel {reel_nn} · target {count} competitors · discovery…", flush=True)
    at=yt_token()
    seen=seen_ids()
    vids=collect(at, seen)
    # приоритет: Shorts/короткие (наш формат) сначала, потом по просмотрам
    top=sorted(vids.values(), key=lambda x:(-int(x["is_short"]), -x["views"]))[:count*2]
    print(f"[deep] найдено {len(vids)} свежих 1M+ · беру до {count} для разбора", flush=True)
    done=[]; used=[]
    for v in top:
        if len(done)>=count: break
        print(f"[deep] ⤵ {v['id']} · {v['views']:,} views · {v['dur']}s · {v['title'][:50]}", flush=True)
        try:
            ok, txt, sb = deep_one(v, outroot)
        except Exception as e:
            print(f"[deep]   ✗ {e}", flush=True); continue
        if not ok:
            print(f"[deep]   ✗ {txt[:80]}", flush=True); continue
        rank=len(done)+1
        od=f"{outroot}/{rank:02d}_{v['id']}"; os.makedirs(od,exist_ok=True)
        json.dump(v, open(f"{od}/metrics.json","w"), ensure_ascii=False, indent=1)
        open(f"{od}/transcript.txt","w").write(txt)
        if sb: open(f"{od}/storyboard.jpg","wb").write(sb)
        print(f"[deep]   ✓ {rank:02d} sb={'ok' if sb else 'no'} txt={len(txt)}ch", flush=True)
        done.append(v); used.append(v["id"])
    # дедуп-стейт: помечаем разобранные
    if used:
        with open(STATE,"a") as f: f.write("\n"+"\n".join(used)+"\n")
    idx={"reel":reel_nn,"date":datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M"),
         "analyzed":[{"rank":i+1,"id":v["id"],"title":v["title"],"views":v["views"],
                      "er":v["er"],"dur":v["dur"],"url":v["url"],"date":v["date"]}
                     for i,v in enumerate(done)]}
    json.dump(idx, open(f"{outroot}/INDEX.json","w"), ensure_ascii=False, indent=1)
    print(f"\n[deep] ГОТОВО: {len(done)} разборов в {outroot}", flush=True)
    print(f"[deep] читай INDEX.json + <rank>_<id>/{{storyboard.jpg,transcript.txt,metrics.json}}", flush=True)
    for v in done:
        print(f"  · {v['id']} | {v['views']:,} | ER {v['er']}% | {v['dur']}s | {v['title'][:60]}")

if __name__=="__main__":
    main()
