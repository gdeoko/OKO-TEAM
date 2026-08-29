import os, json, subprocess, urllib.parse
KEY=os.environ['PEXELS_API_KEY']; CA='/root/.ccr/ca-bundle.crt'
USED=set([6872072,7234088,38410501,8038468,8056092,34826022,19598792,9465542,35847550,35313959,37446281,28599141,12330883,6201679,7822022])
QUERIES={
 'c1_hook':   'confident business owner talking to camera',
 'c2_think':  'thoughtful businessman doubt office window',
 'c3_scroll': 'people scrolling social media phone street',
 'c4_screen': 'person watching video on smartphone closeup',
 'c5_deal':   'business handshake deal success office',
 'c6_ads':    'money cash counting burning',
 'c7_shoot':  'filming business promo video studio',
 'c8_trust':  'entrepreneur speaking confident portrait',
 'c9_client': 'happy customer smiling small business',
 'c10_team':  'creative team working laptop office',
 'c11_studio':'studio lighting softbox video setup',
 'c12_camera':'cinema camera operator filming closeup',
 'c13_watch': 'group people watching screen attentively',
 'c14_type':  'typing message on smartphone hands',
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
json.dump(picks,open('n15/clips_manifest.json','w'),indent=1); print('TOTAL',len(picks))
