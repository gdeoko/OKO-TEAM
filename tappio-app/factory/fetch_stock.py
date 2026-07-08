import os, json, subprocess, urllib.parse, sys
KEY=os.environ['PEXELS_API_KEY']; CA='/root/.ccr/ca-bundle.crt'
def cj(url): return json.loads(subprocess.check_output(['curl','-s','--max-time','40','--cacert',CA,'-H',f'Authorization: {KEY}',url]))
# scene -> query candidates (order = preference)
Q=json.loads(sys.argv[1]); outdir=sys.argv[2]; os.makedirs(outdir,exist_ok=True)
man={}
for scene,queries in Q.items():
    picked=None
    for q in queries:
        url=f"https://api.pexels.com/videos/search?query={urllib.parse.quote(q)}&orientation=portrait&size=medium&per_page=8"
        data=cj(url)
        cands=[]
        for v in data.get('videos',[]):
            fs=[f for f in v['video_files'] if f['height'] and f['width'] and f['height']>f['width'] and f['height']>=1900]
            if not fs: continue
            fs.sort(key=lambda f:f['height'])
            cands.append({'id':v['id'],'dur':v['duration'],'url':fs[0]['link'],'wh':f"{fs[0]['width']}x{fs[0]['height']}"})
        if cands: picked=(q,cands[:4]); break
    man[scene]=picked
    print(scene, picked[0] if picked else "NONE", len(picked[1]) if picked else 0)
json.dump(man,open(f'{outdir}/manifest.json','w'),indent=1)
