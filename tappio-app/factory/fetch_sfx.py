#!/usr/bin/env python3
# Профессиональная библиотека SFX (Freesound): курированные чистые звуки, сортировка по
# популярности (downloads = качество), CC0, фильтр от harsh. 5 вариантов на категорию —
# в ролике ротуются без повторов подряд. Кэш: качаем один раз.
# Использование: python3 fetch_sfx.py aud_sfx
import os, sys, json, subprocess, urllib.parse
CA = '/root/.ccr/ca-bundle.crt'
FS = os.environ.get('FREESOUND_API_KEY', '')

# 4 семейства (без внутренней конкуренции за одни звуки), профессиональные чистые сэмплы.
# trans — много вариантов, ротуются на переходах; reveal — на цифрах/данных; impact — акцент;
# ding — CTA/позитив; riser — рост (linechart).
CATS = {
    'trans':  ['cinematic whoosh transition', 'smooth swoosh transition', 'swipe whoosh transition',
               'soft air whoosh', 'reverse whoosh transition', 'clean swish transition', 'woosh transition short'],
    'reveal': ['ui pop notification', 'soft pop reveal ui', 'digital blip ui clean', 'notification pop soft',
               'bubble pop ui', 'ui confirm sound', 'message pop clean'],
    'impact': ['cinematic sub boom soft', 'deep impact hit clean', 'soft low impact cinematic', 'boom hit deep'],
    'ding':   ['positive notification chime', 'success bell soft', 'reward chime clean', 'notification bell soft'],
    'riser':  ['cinematic riser swell short', 'tension riser build', 'riser whoosh up', 'build up sweep short'],
}
PER = {'trans': 8, 'reveal': 4, 'impact': 3, 'ding': 2, 'riser': 2}
BAD = ('horror', 'glitch', 'spooki', '8bit', '8-bit', 'scream', 'distort', 'harsh', 'noise burst',
       'error', 'buzzer', 'alarm', 'siren', 'creepy', 'dark ambient', 'stinger')

def curl(u, out=None):
    a = ['curl', '-s', '--max-time', '45', '--cacert', CA, u]
    if out: a += ['-o', out]
    return subprocess.run(a, capture_output=True, text=(out is None)).stdout

def search(q):
    # CC0 + Attribution (обе годятся для коммерции; NonCommercial исключаем) — шире выбор, больше вариантов
    flt = urllib.parse.quote('duration:[0.3 TO 4] (license:"Creative Commons 0" OR license:"Attribution")', safe=':')
    u = (f"https://freesound.org/apiv2/search/text/?query={urllib.parse.quote(q)}"
         f"&filter={flt}&sort=downloads_desc&fields=id,name,previews,avg_rating,num_downloads"
         f"&page_size=15&token={FS}")
    try:
        return json.loads(curl(u)).get('results', [])
    except Exception:
        return []

SEEN = set()  # глобальный дедуп по id

def main():
    outdir = sys.argv[1] if len(sys.argv) > 1 else 'aud_sfx'
    os.makedirs(outdir, exist_ok=True)
    pool = {}
    for cat, queries in CATS.items():
        got = []; need = PER[cat]
        for q in queries:
            for r in search(q):
                if len(got) >= need: break
                if r['id'] in SEEN: continue
                if any(b in r['name'].lower() for b in BAD): continue
                if r.get('avg_rating', 0) and r['avg_rating'] < 3.0: continue
                dst = f"{outdir}/{cat}_{len(got)}.mp3"
                pv = r['previews'].get('preview-hq-mp3') or r['previews'].get('preview-lq-mp3')
                if not pv: continue
                curl(pv, dst)
                if os.path.exists(dst) and os.path.getsize(dst) > 4000:
                    # выравниваем громкость категорий (без обрезки атаки)
                    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', dst,
                                    '-af', 'loudnorm=I=-20:TP=-2', '-ar', '44100', dst + '.n.mp3'],
                                   capture_output=True)
                    if os.path.exists(dst + '.n.mp3'):
                        os.replace(dst + '.n.mp3', dst)
                    got.append(dst); SEEN.add(r['id'])
                    print(cat, len(got), '<-', r['id'], round(r.get('avg_rating', 0), 1),
                          r.get('num_downloads'), r['name'][:38])
            if len(got) >= need: break
        if not got:  # фолбэк
            fb = {'impact': 'work/spy_001/aud/impact.mp3'}.get(cat, 'work/spy_001/aud/whoosh.mp3')
            if os.path.exists(fb):
                subprocess.run(['cp', fb, f"{outdir}/{cat}_0.mp3"]); got.append(f"{outdir}/{cat}_0.mp3")
        pool[cat] = got
    json.dump(pool, open(f"{outdir}/_pool.json", "w"))
    print("sfx pool:", {k: len(v) for k, v in pool.items()})

main()
