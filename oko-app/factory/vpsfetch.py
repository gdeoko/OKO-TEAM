#!/usr/bin/env python3
# Надёжный перенос бинарника с VPS через мост: base64 на VPS -> чанки по 50000 симв -> склейка локально.
import sys, json, subprocess, os, base64
URL=os.environ["OKO_VPS_CTRL_URL"]; TOK=os.environ["OKO_VPS_CTRL_TOKEN"]
def exec_vps(cmd):
    r=subprocess.run(["curl","-s","--max-time","120","-X","POST",f"{URL}/exec",
        "-H",f"Authorization: Bearer {TOK}","-H","Content-Type: application/json",
        "-d",json.dumps({"cmd":cmd})],capture_output=True,text=True)
    try: return json.loads(r.stdout)
    except Exception as e: return {"stdout":"","stderr":f"PARSE {e}: {r.stdout[:200]}"}
def fetch(remote, local):
    # b64 file on VPS
    exec_vps(f"base64 -w0 '{remote}' > /tmp/_f.b64; wc -c < /tmp/_f.b64")
    n=exec_vps("wc -c < /tmp/_f.b64").get("stdout","0").strip()
    n=int(n) if n.isdigit() else 0
    if not n: 
        print("EMPTY", remote); return False
    CH=50000; parts=[]
    off=0
    while off<n:
        r=exec_vps(f"tail -c +{off+1} /tmp/_f.b64 | head -c {CH}")
        chunk=r.get("stdout","")
        if not chunk: break
        parts.append(chunk); off+=len(chunk)
    b64="".join(parts)
    try:
        data=base64.b64decode(b64)
        open(local,"wb").write(data)
        print("OK",local,len(data),"/",n)
        return True
    except Exception as e:
        print("DECERR",e,len(b64)); return False
if __name__=="__main__":
    fetch(sys.argv[1], sys.argv[2])
