#!/usr/bin/env python3
# v3: качает МНОГО уникальных вертикальных 4К-клипов (по одному на shot),
# дедуп по pexels video id — ни одного повтора кадра внутри ролика.
import os, json, subprocess, urllib.parse, sys
KEY = os.environ['PEXELS_API_KEY']; CA = '/root/.ccr/ca-bundle.crt'

def cj(u):
    return json.loads(subprocess.check_output(
        ['curl', '-s', '--max-time', '40', '--cacert', CA, '-H', f'Authorization: {KEY}', u]))

def pick_file(v):
    fs = [f for f in v['video_files'] if f.get('height') and f.get('width')
          and f['height'] > f['width'] and f['height'] >= 1900]
    if not fs: return None
    fs.sort(key=lambda f: f['height'])
    return fs[0]  # smallest >=1900 vertical = enough для 1080p, быстрее качать

def fetch_one(queries, used, wd, name):
    dst0 = f"{wd}/stock/{name}.mp4"
    if os.path.exists(dst0) and os.path.getsize(dst0) > 180000:
        print(name, 'cached'); return True  # переиспользуем уже скачанный клип
    for q in queries:
        for page in (1, 2):
            u = (f"https://api.pexels.com/videos/search?query={urllib.parse.quote(q)}"
                 f"&orientation=portrait&size=medium&per_page=15&page={page}")
            for v in cj(u).get('videos', []):
                if v['id'] in used: continue
                f = pick_file(v)
                if not f: continue
                dst = f"{wd}/stock/{name}.mp4"
                subprocess.run(['curl', '-s', '--max-time', '120', '--cacert', CA,
                                '-o', dst, f['link']], check=True)
                if os.path.getsize(dst) > 180000:
                    used.add(v['id'])
                    print(name, '<-', q, 'id', v['id'], v['duration'], 's')
                    return True
    print(name, 'NONE', queries)
    return False

def main():
    d = json.load(open(sys.argv[1])); wd = sys.argv[2]
    os.makedirs(f"{wd}/stock", exist_ok=True)
    used = set()
    # cover
    covq = d.get("cover", {}).get("q") or d["shots"][0].get("q", ["dark cinematic atmosphere"])
    fetch_one(covq, used, wd, "cover")
    # каждый визуальный shot (кроме DEMO) — свой уникальный клип
    for i, sh in enumerate(d["shots"]):
        if str(sh.get("visual", "")).startswith("DEMO:"): continue
        fetch_one(sh["q"], used, wd, f"shot_{i:02d}")
    print("stock done, unique clips:", len(used))

main()
