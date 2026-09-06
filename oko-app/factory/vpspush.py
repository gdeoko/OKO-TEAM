#!/usr/bin/env python3
# Заливка локального файла на VPS через мост: base64 -> чанки -> склейка+decode.
# Payload пишем во ВРЕМЕННЫЙ ФАЙЛ и передаём curl -d @file (MAX_ARG_STRLEN=128КБ не позволяет большой -d аргумент).
import sys, json, subprocess, os, base64, tempfile
URL=os.environ["OKO_VPS_CTRL_URL"]; TOK=os.environ["OKO_VPS_CTRL_TOKEN"]

def ex(cmd, tmo=120):
    fd,pf=tempfile.mkstemp(suffix=".json")
    with os.fdopen(fd,"w") as f: json.dump({"cmd":cmd}, f)
    try:
        r=subprocess.run(["curl","-s","--max-time",str(tmo),"-X","POST",f"{URL}/exec",
            "-H",f"Authorization: Bearer {TOK}","-H","Content-Type: application/json",
            "-d","@"+pf], capture_output=True, text=True)
    finally:
        os.unlink(pf)
    try: return json.loads(r.stdout)
    except Exception as e: return {"stdout":"","stderr":"PARSE %s: %s"%(e, r.stdout[:200])}

def push(local, remote):
    b=open(local,"rb").read(); b64=base64.b64encode(b).decode()
    rb=remote+".b64"
    ex("rm -f '%s' '%s'"%(rb,remote))
    CH=900000
    n=0
    for i in range(0,len(b64),CH):
        ex("printf '%%s' '%s' >> '%s'"%(b64[i:i+CH], rb)); n+=1
    r=ex("base64 -d '%s' > '%s' && rm -f '%s' && stat -c%%s '%s'"%(rb,remote,rb,remote))
    got=(r.get("stdout") or "").strip()
    ok=got.isdigit() and int(got)==len(b)
    print(("OK" if ok else "MISMATCH"), os.path.basename(remote), got, "/", len(b), "chunks", n, flush=True)
    return ok

if __name__=="__main__":
    for pair in sys.argv[1:]:
        l,rp=pair.split("::"); push(l,rp)
    print("PUSH_DONE", flush=True)
