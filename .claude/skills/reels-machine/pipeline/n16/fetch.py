import os, json, subprocess, urllib.parse
KEY=os.environ['PEXELS_API_KEY']; CA='/root/.ccr/ca-bundle.crt'
# все ранее использованные id (n14, n15, промо, партии) — дедуп
USED=set([
 6872072,7234088,38410501,8038468,8056092,34826022,19598792,9465542,35847550,35313959,
 37446281,28599141,12330883,6201679,7822022,
 6100901,6930967,17512949,8903498,8814522,6326861,8126726,8688091,9046227,7685204,
 38161401,30742634,7984156,9898435,
 37903876,30742630,17652739,4318554,6324887,29380114,8100345,11884378,6878201,35134511,
])
QUERIES={
 'c1_empty':  'empty restaurant interior dim evening',
 'c2_night':  'quiet cafe at night few people',
 'c3_dough':  'chef stretching pizza dough hands',
 'c4_oven':   'pizza wood fired oven flames closeup',
 'c5_film':   'videographer filming food in restaurant',
 'c6_phone':  'person watching video on smartphone closeup',
 'c7_views':  'smartphone screen notification likes closeup',
 'c8_busy':   'crowded restaurant full of people dining',
 'c9_reserve':'hands booking reservation on phone',
 'c10_diners':'happy friends eating pizza laughing',
 'c11_studio':'studio softbox lighting video setup',
 'c12_camera':'cinema camera operator filming closeup',
 'c13_scroll':'scrolling instagram reels feed on phone',
 'c14_type':  'typing message on smartphone closeup hands',
}
def cj(u): return json.loads(subprocess.check_output(['curl','-s','--max-time','30','--cacert',CA,'-H',f'Authorization: {KEY}',u]))
picks={}
for name,q in QUERIES.items():
    got=None
    for page in (1,2,3):
        u=f"https://api.pexels.com/videos/search?query={urllib.parse.quote(q)}&orientation=portrait&size=medium&per_page=12&page={page}"
        try: data=cj(u)
        except Exception as e: print(name,'ERR',e); continue
        cands=[]
        for v in data.get('videos',[]):
            if v['id'] in USED: continue
            files=[f for f in v['video_files'] if f['height'] and f['width'] and f['height']>f['width'] and f['height']>=1900]
            if not files: continue
            files.sort(key=lambda f:abs(f['height']-2160))
            cands.append((v['id'],v['duration'],files[0]))
        cands=[c for c in cands if 3<=c[1]<=40]
        if cands: got=cands[0]; break
    if not got: print(name,'!! no clip'); continue
    vid,dur,f=got; USED.add(vid)
    picks[name]={'id':vid,'dur':dur,'url':f['link'],'w':f['width'],'h':f['height']}
    print(name,vid,dur,f"{f['width']}x{f['height']}")
json.dump(picks,open('n16/clips_manifest.json','w'),indent=1); print('TOTAL',len(picks))
