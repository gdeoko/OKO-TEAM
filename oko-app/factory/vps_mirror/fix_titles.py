import os,sys,json,urllib.request,urllib.parse
CFG="/opt/oko-poster/cfg"
def http(u,data=None,H=None,method=None,timeout=40):
    if isinstance(data,dict): data=urllib.parse.urlencode(data).encode()
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
    return json.loads(http("https://oauth2.googleapis.com/token",{"client_id":e["YT_CLIENT_ID"],"client_secret":e["YT_CLIENT_SECRET"],"refresh_token":e["YT_REFRESH_TOKEN"],"grant_type":"refresh_token"}))["access_token"]
import re
def fixtitle(t):
    if "\\u" not in t: return None
    d=re.sub(r"\\u([0-9a-fA-F]{4})", lambda m: chr(int(m.group(1),16)), t)
    if d!=t and any(0x400<=ord(c)<=0x4ff for c in d): return d
    return None
MAP=[l.split() for l in open(sys.argv[1]).read().strip().splitlines()]
toks={"A":token(CFG+"/yt_creds.env"),"B":token(CFG+"/ytnew_b.env")}
fixed=0; skip=0; err=0; e403=0
for nnn,batch,vid in MAP:
    try:
        H={"Authorization":f"Bearer {toks[batch]}"}
        it=json.loads(http(f"https://www.googleapis.com/youtube/v3/videos?part=snippet&id={vid}",H=H))["items"]
        if not it: err+=1; print(nnn,batch,vid,"NOTFOUND"); continue
        sn=it[0]["snippet"]; old=sn.get("title","")
        nt=fixtitle(old)
        if not nt: skip+=1; print(nnn,batch,vid,"OK:",old[:28]); continue
        body={"id":vid,"snippet":{"title":nt[:99],"categoryId":sn.get("categoryId","2"),"description":sn.get("description","")}}
        Hu={**H,"Content-Type":"application/json; charset=UTF-8"}
        try:
            http("https://www.googleapis.com/youtube/v3/videos?part=snippet",data=json.dumps(body,ensure_ascii=False).encode("utf-8"),H=Hu,method="PUT")
            fixed+=1; print(nnn,batch,vid,"FIXED ->",nt[:38])
        except urllib.error.HTTPError as he:
            if he.code==403: e403+=1; print(nnn,batch,vid,"403 (scope/owner) title-would-be:",nt[:30])
            else: raise
    except Exception as ex:
        err+=1; print(nnn,batch,vid,"ERR",str(ex)[:70])
print(f"\nSUMMARY fixed={fixed} already_ok={skip} err403={e403} err={err}")
