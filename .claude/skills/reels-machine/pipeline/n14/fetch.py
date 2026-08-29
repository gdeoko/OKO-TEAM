import os, json, subprocess, urllib.parse, sys
KEY=os.environ['PEXELS_API_KEY']; CA='/root/.ccr/ca-bundle.crt'
# уже занятые id (реестр) — d8 6872072 + защита
USED=set([6872072])
QUERIES={
 'c1_hook':   'person filming vertical video smartphone',
 'c2_hold':   'hand holding phone recording close up',
 'c3_window': 'woman near window natural light portrait',
 'c4_soft':   'soft window light face indoor',
 'c5_shadow': 'light and shadow blinds room',
 'c6_step':   'videographer walking with gimbal camera',
 'c7_feet':   'feet walking closer floor',
 'c8_frame':  'cinema camera viewfinder framing',
 'c9_clap':   'clapperboard film set action',
 'c10_edit':  'video editing timeline color grading screen',
 'c11_light': 'studio softbox lighting setup',
 'c12_mic':   'microphone recording studio closeup',
 'c13_owner': 'happy small business owner smiling shop',
 'c14_dm':    'typing message smartphone notification',
}
def cj(u):
    return json.loads(subprocess.check_output(['curl','-s','--max-time','30','--cacert',CA,'-H',f'Authorization: {KEY}',u]))
picks={}
for name,q in QUERIES.items():
    got=None
    for page in (1,2):
        u=f"https://api.pexels.com/videos/search?query={urllib.parse.quote(q)}&orientation=portrait&size=medium&per_page=12&page={page}"
        try: data=cj(u)
        except Exception as e: print(name,'ERR',e); continue
        cands=[]
        for v in data.get('videos',[]):
            if v['id'] in USED: continue
            files=[f for f in v['video_files'] if f['height'] and f['width'] and f['height']>f['width'] and f['height']>=1900]
            if not files: continue
            files.sort(key=lambda f:abs(f['height']-2160))  # ближе к 4К
            cands.append((v['id'],v['duration'],files[0]))
        cands=[c for c in cands if 3<=c[1]<=40]
        if cands: got=cands[0]; break
    if not got: print(name,'!! no clip'); continue
    vid,dur,f=got; USED.add(vid)
    picks[name]={'id':vid,'dur':dur,'url':f['link'],'w':f['width'],'h':f['height']}
    print(name,vid,dur,f"{f['width']}x{f['height']}")
json.dump(picks,open('n14/clips_manifest.json','w'),indent=1)
print('TOTAL',len(picks))
