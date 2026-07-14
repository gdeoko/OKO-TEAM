import os, json, subprocess, sys
CA='/root/.ccr/ca-bundle.crt'
URL=os.environ['OKO_VPS_CTRL_URL'].rstrip('/'); TOK=os.environ['OKO_VPS_CTRL_TOKEN']
def vexec(cmd, timeout=120):
    body=json.dumps({"cmd":cmd})
    r=subprocess.run(['curl','-sS','--cacert',CA,'-m',str(timeout),'-X','POST',
        '-H',f'Authorization: Bearer {TOK}','-H','Content-Type: application/json',
        '--data-binary',body, f'{URL}/exec'], capture_output=True, text=True)
    try:
        d=json.loads(r.stdout); return d
    except: return {"raw": r.stdout[:1000], "err": r.stderr[:300]}
if __name__=="__main__":
    d=vexec(sys.argv[1], int(sys.argv[2]) if len(sys.argv)>2 else 120)
    print(d.get('stdout', d.get('raw','')))
    if d.get('stderr'): print("STDERR:", d['stderr'][:500])
