# Set A-channel video titles from published/NNN/meta.json (full, correct) — fixes truncation fragments
import os,sys,json,urllib.request,urllib.parse
CFG="/opt/oko-poster/cfg"; PUB="/opt/oko-poster/published"
def http(u,data=None,H=None,method=None,timeout=40):
    req=urllib.request.Request(u,data=data,headers=H or {},method=method)
    return urllib.request.urlopen(req,timeout=timeout).read().decode()
def load_env(p):
    d={}
    for ln in open(p):
        ln=ln.strip()
        if ln.startswith("export "): ln=ln[7:]
        if "=" in ln and not ln.startswith("#"):
            k,v=ln.split("=",1); d[k.strip()]=v.strip().strip('"').strip("'")
    return d
def token(envf):
    e=load_env(envf)
    return json.loads(http("https://oauth2.googleapis.com/token",{}.__class__(client_id=e["YT_CLIENT_ID"],client_secret=e["YT_CLIENT_SECRET"],refresh_token=e["YT_REFRESH_TOKEN"],grant_type="refresh_token") and urllib.parse.urlencode({"client_id":e["YT_CLIENT_ID"],"client_secret":e["YT_CLIENT_SECRET"],"refresh_token":e["YT_REFRESH_TOKEN"],"grant_type":"refresh_token"}).encode()))["access_token"]
MAP=[l.split() for l in open(sys.argv[1]).read().strip().splitlines()]
tokA=token(CFG+"/yt_creds.env")
fixed=0; skip=0; nometa=0
for nnn,batch,vid in MAP:
    if batch!="A": continue
    mp=f"{PUB}/{nnn}/meta.json"
    if not os.path.exists(mp): nometa+=1; continue
    correct=json.load(open(mp)).get("title","")[:99]
    if not correct: nometa+=1; continue
    H={"Authorization":f"Bearer {tokA}"}
    cur=json.loads(http(f"https://www.googleapis.com/youtube/v3/videos?part=snippet&id={vid}",H=H))["items"]
    if not cur: continue
    sn=cur[0]["snippet"]; old=sn.get("title","")
    if old==correct: skip+=1; print(nnn,vid,"OK-exact"); continue
    body={"id":vid,"snippet":{"title":correct,"categoryId":sn.get("categoryId","2"),"description":sn.get("description","")}}
    Hu={**H,"Content-Type":"application/json; charset=UTF-8"}
    try:
        http("https://www.googleapis.com/youtube/v3/videos?part=snippet",data=json.dumps(body,ensure_ascii=False).encode("utf-8"),H=Hu,method="PUT")
        fixed+=1; print(nnn,vid,"SET ->",correct[:45])
    except Exception as ex: print(nnn,vid,"ERR",str(ex)[:60])
print(f"\nSUMMARY set={fixed} already_ok={skip} nometa={nometa}")
