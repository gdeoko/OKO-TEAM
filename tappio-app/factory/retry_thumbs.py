#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Самозаживающий добор обложек YouTube. У свежеверифицированного канала YouTube
жёстко лимитирует частоту set-thumbnail (HTTP 429) — поэтому не ставим все разом,
а держим список «ждут обложку» (analysis/pending_thumbs.json) и на каждом тике
автопилота дотягиваем по чуть-чуть, пока не встанут все. 200 -> убираем из списка.

Вызов: python3 retry_thumbs.py [rid ...]   # без аргументов — просто дожать pending
"""
import os, json, subprocess, sys, time
HERE = os.path.dirname(os.path.abspath(__file__))
AN = os.path.join(HERE, "analysis"); os.makedirs(AN, exist_ok=True)
PEND = os.path.join(AN, "pending_thumbs.json")
COOL = os.path.join(AN, "thumbs_cooldown.json")   # метка: раньше этого времени не пробуем (окно rate-limit остывает)
REG = os.path.join(HERE, "posted_reels.json")
CA = os.environ.get('CURL_CA', '/root/.ccr/ca-bundle.crt')
COOLDOWN_S = 4 * 3600   # 4 часа между попытками — иначе окно uploadRateLimitExceeded не остывает


def curl(a, t=90):
    base = ['curl', '-s', '-m', str(t)] + (['--cacert', CA] if os.path.exists(CA) else [])
    return subprocess.run(base + a, capture_output=True, text=True)


def load(p, d):
    try: return json.load(open(p))
    except Exception: return d


def token():
    cid = os.environ['TAPPIO_YT_CLIENT_ID']; csec = os.environ['TAPPIO_YT_CLIENT_SECRET']; refr = os.environ['TAPPIO_YT_REFRESH_TOKEN']
    r = curl(['-X', 'POST', 'https://oauth2.googleapis.com/token', '-d', f'client_id={cid}',
              '-d', f'client_secret={csec}', '-d', f'refresh_token={refr}', '-d', 'grant_type=refresh_token'])
    return json.loads(r.stdout)['access_token']


def cover_of(rid):
    for c in [f'output/{rid}.mp4', f'work/{rid}/stage_v.mp4', f'work/{rid}/output.mp4']:
        p = os.path.join(HERE, c)
        if os.path.exists(p):
            out = f'/tmp/{rid}_thumb.jpg'
            subprocess.run(['ffmpeg', '-y', '-ss', '0.05', '-i', p, '-vframes', '1',
                            '-vf', 'scale=1080:1920', '-q:v', '2', out], capture_output=True)
            if os.path.exists(out):
                return out
    return None


def main():
    pend = set(load(PEND, []))
    newargs = set(sys.argv[1:])
    pend |= newargs                    # добавить новые из аргументов
    if not pend:
        print("thumbs: pending пусто"); return
    # КУЛДАУН: если недавно уже пробовали и упёрлись в rate-limit — ждём, окно остывает.
    # Новые id (из аргументов) пробуем сразу — вдруг окно уже открыто.
    now = time.time()
    nxt = load(COOL, {}).get("next", 0)
    if not newargs and now < nxt:
        print(f"thumbs: кулдаун ещё {int((nxt-now)/60)}мин (ждём остывания rate-limit), {sorted(pend)}"); return
    reg = load(REG, {})
    if not os.environ.get('TAPPIO_YT_CLIENT_ID'):
        print("thumbs: нет ключей YouTube — пропуск"); return
    try:
        tok = token()
    except Exception as e:
        print("thumbs: токен не получен", e); return
    still = set()
    done = 0; hit_limit = False
    for rid in sorted(pend):
        vid = reg.get(rid, {}).get('yt_id')
        if not vid:
            continue                    # ролик без валидного yt_id — молча выкидываем
        cov = cover_of(rid)
        if not cov:
            still.add(rid); continue
        r = curl(['-X', 'POST', f'https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId={vid}',
                  '-H', f'Authorization: Bearer {tok}', '-H', 'Content-Type: image/jpeg',
                  '--data-binary', f'@{cov}', '-w', 'H:%{http_code}'])
        code = r.stdout.split('H:')[-1].strip()
        try: os.remove(cov)
        except Exception: pass
        if code == '200':
            done += 1
        else:
            still.add(rid)              # 429/прочее — оставляем на следующую попытку
            if code == '429':
                hit_limit = True
                break                   # упёрлись в лимит — дальше не долбим, ждём кулдаун
    json.dump(sorted(still), open(PEND, "w"))
    # если поймали rate-limit — назначаем паузу; если что-то поставилось — тоже пауза (не частить)
    if hit_limit or done:
        json.dump({"next": time.time() + COOLDOWN_S}, open(COOL, "w"))
    print(f"thumbs: поставлено={done} ещё_ждут={len(still)} лимит={hit_limit} {sorted(still)}")


if __name__ == "__main__":
    main()
