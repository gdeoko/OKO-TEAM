#!/usr/bin/env python3
# Уникальная фоновая музыка на КАЖДЫЙ ролик. Источники: Jamendo (полные треки,
# royalty-free) → Freesound (беды/лупы). Выбор по mood-запросам сценария + seed
# ролика, чтобы между роликами не повторялось. Пишет aud/music.mp3.
import os, sys, json, subprocess, urllib.parse, hashlib
CA = '/root/.ccr/ca-bundle.crt'
JAM = os.environ.get('JAMENDO_CLIENT_ID', '2c9a11b9')  # публичный демо-клиент как фолбэк
FS = os.environ.get('FREESOUND_API_KEY', '')

def curl(u, out=None):
    a = ['curl', '-s', '--max-time', '60', '--cacert', CA, u]
    if out: a += ['-o', out]
    return subprocess.run(a, capture_output=True, text=(out is None)).stdout

USED = os.path.join(os.path.dirname(os.path.abspath(__file__)), "analysis", "used_music.json")

def load_used():
    try: return set(json.load(open(USED)))
    except Exception: return set()

def save_used(s):
    try:
        os.makedirs(os.path.dirname(USED), exist_ok=True)
        json.dump(list(s)[-800:], open(USED, "w"))
    except Exception: pass

def jamendo(mood, seed, out, used):
    u = (f"https://api.jamendo.com/v3.0/tracks/?client_id={JAM}&format=json&limit=40"
         f"&audioformat=mp32&include=musicinfo&fuzzytags={urllib.parse.quote(mood)}"
         f"&durationbetween=40_240&order=popularity_total")
    try:
        r = json.loads(curl(u)); res = r.get('results', [])
    except Exception:
        return None
    if not res: return None
    # берём ПЕРВЫЙ неиспользованный трек (ротация по seed), чтобы музыка НИКОГДА не повторялась
    order = [res[(seed + k) % len(res)] for k in range(len(res))]
    for t in order:
        tid = "jam_" + str(t.get('id'))
        if tid in used: continue
        dl = t.get('audiodownload') or t.get('audio')
        if not dl: continue
        curl(dl, out)
        if os.path.exists(out) and os.path.getsize(out) > 200000:
            print("music jamendo <-", mood, "|", t.get('name', '')[:40], "by", t.get('artist_name', ''))
            return tid
    return None

def freesound(mood, seed, out, used):
    if not FS: return None
    u = (f"https://freesound.org/apiv2/search/text/?query={urllib.parse.quote(mood)}"
         f"&filter=duration:[30 TO 180]&fields=id,name,previews&page_size=30&token={FS}")
    try:
        res = json.loads(curl(u)).get('results', [])
    except Exception:
        return None
    if not res: return None
    order = [res[(seed + k) % len(res)] for k in range(len(res))]
    for t in order:
        tid = "fs_" + str(t.get('id'))
        if tid in used: continue
        pv = t['previews'].get('preview-hq-mp3') or t['previews'].get('preview-lq-mp3')
        curl(pv, out)
        if os.path.exists(out) and os.path.getsize(out) > 120000:
            print("music freesound <-", mood, "|", t['name'][:40])
            return tid
    return None

def main():
    d = json.load(open(sys.argv[1])); wd = sys.argv[2]
    os.makedirs(f"{wd}/aud", exist_ok=True)
    out = f"{wd}/aud/music.mp3"
    moods = d.get("music", {}).get("queries") or ["cinematic underscore"]
    seed = int(hashlib.md5(d["id"].encode()).hexdigest(), 16)
    used = load_used()
    # 3 попытки по всем mood'ам, ВСЕГДА неиспользованный трек (глобальный дедуп музыки)
    for attempt in range(3):
        for i, mood in enumerate(moods):
            tid = jamendo(mood, seed + i + attempt, out, used) or freesound(mood, seed + i + attempt, out, used)
            if tid:
                used.add(tid); save_used(used)
                return
        print(f"music retry {attempt+1}/3 (транзиентный сбой источников)")
    # фолбэк — старый общий трек, чтобы сборка не падала (крайний случай)
    fb = "work/spy_001/aud/music.mp3"
    if os.path.exists(fb):
        subprocess.run(['cp', fb, out]); print("music FALLBACK shared track")

main()
