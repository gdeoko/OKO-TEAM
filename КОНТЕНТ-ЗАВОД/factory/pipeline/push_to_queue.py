#!/usr/bin/env python3
# Резервная заливка ролика в очередь VPS БЕЗ CDN (когда Higgsfield CDN недоступен).
# /exec принимает cmd до ~128КБ → шлём base64 кусками по 100КБ с ретраями, склеиваем и декодируем на VPS.
# usage: python3 push_to_queue.py <local_file> <remote_path>   напр. reel.mp4 /opt/oko-poster/cfg/queue/NN.mp4
import os,base64,json,sys,urllib.request,time
URL=os.environ["OKO_VPS_CTRL_URL"].rstrip("/")+"/exec"; TOK=os.environ["OKO_VPS_CTRL_TOKEN"]
def ex(cmd,t=90):
    for a in range(6):
        try:
            r=urllib.request.Request(URL,data=json.dumps({"cmd":cmd}).encode(),method="POST",
                headers={"Authorization":f"Bearer {TOK}","Content-Type":"application/json"})
            return json.load(urllib.request.urlopen(r,timeout=t))
        except Exception:
            if a==5: raise
            time.sleep(1.5*(a+1))
def push(local,remote,chunk=100000):
    b=base64.b64encode(open(local,"rb").read()).decode(); ex(f"rm -f {remote}.b64 {remote}")
    n=(len(b)+chunk-1)//chunk
    for i in range(n):
        ex(f"printf '%s' '{b[i*chunk:(i+1)*chunk]}' >> {remote}.b64")
        if (i+1)%40==0: print(f"  {i+1}/{n}",flush=True)
    r=ex(f"base64 -d {remote}.b64 > {remote} && rm -f {remote}.b64 && wc -c < {remote}")
    got=int((r.get("stdout","0").strip() or "0")); exp=os.path.getsize(local)
    print(f"{remote}: got {got} / expected {exp} -> {'OK' if got==exp else 'MISMATCH'}"); return got==exp
if __name__=="__main__":
    ok=push(sys.argv[1],sys.argv[2]); sys.exit(0 if ok else 1)
