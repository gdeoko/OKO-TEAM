import sys, os, json, subprocess
URL=os.environ["OKO_VPS_CTRL_URL"]; TOK=os.environ["OKO_VPS_CTRL_TOKEN"]
def upload(local):
    for _ in range(3):
        r=subprocess.run(["curl","-s","--max-time","150","-F","reqtype=fileupload","-F","time=1h",
            "-F","fileToUpload=@"+local,"https://litterbox.catbox.moe/resources/internals/api.php"],
            capture_output=True,text=True)
        u=r.stdout.strip()
        if u.startswith("http"): return u
    return None
def vps(cmd):
    import tempfile
    fd,pf=tempfile.mkstemp(suffix=".json")
    with os.fdopen(fd,"w") as f: json.dump({"cmd":cmd},f)
    try:
        r=subprocess.run(["curl","-s","--max-time","150","-X","POST",URL+"/exec","-H","Authorization: Bearer "+TOK,"-H","Content-Type: application/json","-d","@"+pf],capture_output=True,text=True)
    finally: os.unlink(pf)
    try: return json.loads(r.stdout)
    except: return {"stdout":""}
for pair in sys.argv[1:]:
    local,remote=pair.split("::")
    sz=os.path.getsize(local)
    u=upload(local)
    if not u: print("UPLOAD_FAIL",local); continue
    r=vps("curl -sL --max-time 150 -o '%s' '%s' && stat -c%%s '%s'"%(remote,u,remote))
    got=(r.get("stdout") or "").strip()
    print(("OK" if got==str(sz) else "MISMATCH"), os.path.basename(remote), got,"/",sz, flush=True)
print("RELAY_DONE")
