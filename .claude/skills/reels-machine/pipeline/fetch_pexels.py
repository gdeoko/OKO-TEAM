import os, json, subprocess, urllib.parse

KEY = os.environ['PEXELS_API_KEY']
CA = '/root/.ccr/ca-bundle.crt'

QUERIES = {
    'px_knead':  'kneading dough hands close up',
    'px_flour':  'flour baking dough',
    'px_baker':  'baker bakery bread making',
    'px_phone':  'scrolling phone night',
    'px_record': 'phone recording video food',
    'px_oven':   'bread baking oven',
    'px_fresh':  'fresh bread loaf',
    'px_shop':   'bakery shop counter',
    'px_camera': 'professional video camera studio',
    'px_edit':   'video editing computer screen',
}

def curl_json(url):
    out = subprocess.check_output(['curl','-s','--max-time','30','--cacert',CA,'-H',f'Authorization: {KEY}',url])
    return json.loads(out)

manifest = {}
for name, q in QUERIES.items():
    url = f"https://api.pexels.com/videos/search?query={urllib.parse.quote(q)}&orientation=portrait&size=medium&per_page=6"
    try:
        data = curl_json(url)
    except Exception as e:
        print(name, 'ERR', e); continue
    picks = []
    for v in data.get('videos', []):
        # choose best file: portrait, height>=1920, smallest above threshold
        files = [f for f in v['video_files'] if f['height'] and f['width'] and f['height'] > f['width'] and f['height'] >= 1900]
        if not files: continue
        files.sort(key=lambda f: f['height'])
        picks.append({'id': v['id'], 'dur': v['duration'], 'url': files[0]['link'],
                      'w': files[0]['width'], 'h': files[0]['height'], 'page': v['url']})
    manifest[name] = picks[:3]
    print(name, len(picks), [ (p['id'], p['dur'], f"{p['w']}x{p['h']}") for p in picks[:3] ])

json.dump(manifest, open('pexels_manifest.json','w'), indent=1)
