import os,json,subprocess,urllib.parse,sys
KEY=os.environ['PEXELS_API_KEY']; CA='/root/.ccr/ca-bundle.crt'
def cj(u): return json.loads(subprocess.check_output(['curl','-s','--max-time','40','--cacert',CA,'-H',f'Authorization: {KEY}',u]))
d=json.load(open(sys.argv[1])); wd=sys.argv[2]; os.makedirs(f"{wd}/stock",exist_ok=True)
# cover uses first seg's stock or a dedicated cover query
covq=d.get("cover",{}).get("q") or (d["segments"][0].get("q") if d["segments"][0].get("visual","stock")=="stock" else ["dark cinematic atmosphere"])
targets=[("cover",covq)]
for s in d["segments"]:
    if s.get("visual","stock")=="stock": targets.append((s["id"],s["q"]))
for sid,queries in targets:
    got=False
    for q in queries:
        u=f"https://api.pexels.com/videos/search?query={urllib.parse.quote(q)}&orientation=portrait&size=medium&per_page=10"
        for v in cj(u).get('videos',[]):
            fs=[f for f in v['video_files'] if f['height'] and f['width'] and f['height']>f['width'] and f['height']>=1900]
            if not fs: continue
            fs.sort(key=lambda f:f['height'])
            subprocess.run(['curl','-s','--max-time','120','--cacert',CA,'-o',f"{wd}/stock/{sid}.mp4",fs[0]['link']],check=True)
            if os.path.getsize(f"{wd}/stock/{sid}.mp4")>200000: print(sid,q,'->',v['id'],v['duration'],'s'); got=True; break
        if got: break
    if not got: print(sid,'NONE',queries)
