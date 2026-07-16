#!/usr/bin/env python3
# Библиотека SFX по категориям (Freesound) — разнообразные, осмысленные, не обрубки.
# Категории мапятся на типы наложений/переходов в build4. Кэш: качаем один раз.
# Использование: python3 fetch_sfx.py aud_sfx
import os, sys, json, subprocess, urllib.parse
CA = '/root/.ccr/ca-bundle.crt'
FS = os.environ.get('FREESOUND_API_KEY', '')

CATS = {
    'pop':    ['pop ui clean', 'bubble pop soft ui'],
    'tick':   ['ui tick click soft', 'click interface subtle'],
    'sweep':  ['whoosh sweep up ui', 'transition sweep short'],
    'riser':  ['riser cinematic short', 'uplifter build short'],
    'impact': ['cinematic impact hit', 'boom hit deep short'],
    'ding':   ['notification chime positive', 'success ding bell'],
    'swish':  ['swish transition fast', 'whoosh fast clean'],
    'data':   ['digital blip ui', 'data beep interface'],
    'whoosh': ['whoosh cinematic transition', 'air whoosh deep'],
}
PER_CAT = 3

def curl(u, out=None):
    a = ['curl', '-s', '--max-time', '45', '--cacert', CA, u]
    if out: a += ['-o', out]
    return subprocess.run(a, capture_output=True, text=(out is None)).stdout

def search(q):
    flt = urllib.parse.quote("duration:[0.2 TO 3.5]", safe=":")
    u = (f"https://freesound.org/apiv2/search/text/?query={urllib.parse.quote(q)}"
         f"&filter={flt}&fields=id,name,previews&page_size=15&token={FS}")
    try:
        return json.loads(curl(u)).get('results', [])
    except Exception:
        return []

SEEN = set()  # ГЛОБАЛЬНЫЙ дедуп по id — ни один звук не повторяется между категориями

def main():
    outdir = sys.argv[1] if len(sys.argv) > 1 else 'aud_sfx'
    os.makedirs(outdir, exist_ok=True)
    pool = {}
    for cat, queries in CATS.items():
        got = []
        seen = SEEN
        for q in queries:
            for r in search(q):
                if len(got) >= PER_CAT: break
                if r['id'] in seen: continue
                dst = f"{outdir}/{cat}_{len(got)}.mp3"
                if os.path.exists(dst) and os.path.getsize(dst) > 4000:
                    got.append(dst); seen.add(r['id']); continue
                pv = r['previews'].get('preview-hq-mp3') or r['previews'].get('preview-lq-mp3')
                if not pv: continue
                curl(pv, dst)
                if os.path.exists(dst) and os.path.getsize(dst) > 4000:
                    # нормализуем громкость, чтобы категории звучали ровно
                    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', dst,
                                    '-af', 'loudnorm=I=-18:TP=-2', '-ar', '44100', dst + '.n.mp3'],
                                   capture_output=True)
                    if os.path.exists(dst + '.n.mp3'):
                        os.replace(dst + '.n.mp3', dst)
                    got.append(dst); seen.add(r['id']); print(cat, '<-', q, r['id'], r['name'][:32])
            if len(got) >= PER_CAT: break
        # фолбэк на старые сэмплы, если категория пустая
        if not got:
            fb = {'impact': 'work/spy_001/aud/impact.mp3', 'whoosh': 'work/spy_001/aud/whoosh.mp3',
                  'ding': 'work/spy_001/aud/click.mp3', 'tick': 'work/spy_001/aud/click.mp3'}.get(cat,
                  'work/spy_001/aud/whoosh.mp3')
            if os.path.exists(fb):
                subprocess.run(['cp', fb, f"{outdir}/{cat}_0.mp3"]); got.append(f"{outdir}/{cat}_0.mp3")
        pool[cat] = got
    json.dump(pool, open(f"{outdir}/_pool.json", "w"))
    print("sfx pool:", {k: len(v) for k, v in pool.items()})

main()
