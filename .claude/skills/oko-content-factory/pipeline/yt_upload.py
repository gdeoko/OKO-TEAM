#!/usr/bin/env python3
# YouTube Short uploader (direct REST, curl через агент-прокси).
# Usage: yt_upload.py <client_id_env> <client_secret_env> <refresh_env> <video> <title> <description> [tags_csv]
import os, sys, json, subprocess
CA = os.environ.get('CURL_CA', '/root/.ccr/ca-bundle.crt')

def curl(args, timeout=180):
    base = ['curl', '-s', '-m', str(timeout)] + (['--cacert', CA] if CA and os.path.exists(CA) else [])
    return subprocess.run(base + args, capture_output=True, text=True)

def access_token(cid, csec, refresh):
    r = curl(['-X', 'POST', 'https://oauth2.googleapis.com/token',
              '-d', f'client_id={cid}', '-d', f'client_secret={csec}',
              '-d', f'refresh_token={refresh}', '-d', 'grant_type=refresh_token'])
    return json.loads(r.stdout)['access_token']

def upload(tok, video, title, desc, tags):
    meta = {"snippet": {"title": title[:100], "description": desc, "tags": tags, "categoryId": "28"},
            "status": {"privacyStatus": "public", "selfDeclaredMadeForKids": False}}
    # 1) start resumable session
    r = curl(['-X', 'POST',
              'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
              '-H', f'Authorization: Bearer {tok}', '-H', 'Content-Type: application/json',
              '-D', '-', '-o', '/dev/null', '--data-binary', json.dumps(meta)])
    loc = None
    for line in r.stdout.splitlines():
        if line.lower().startswith('location:'):
            loc = line.split(':', 1)[1].strip()
    if not loc:
        print("no upload URL:", r.stdout[:400]); return None
    # 2) PUT the bytes
    r2 = curl(['-X', 'PUT', loc, '-H', f'Authorization: Bearer {tok}',
               '-H', 'Content-Type: video/mp4', '--data-binary', f'@{video}'], timeout=600)
    try:
        d = json.loads(r2.stdout); return d
    except Exception:
        print("upload resp:", r2.stdout[:400]); return None

def main():
    cid = os.environ[sys.argv[1]]; csec = os.environ[sys.argv[2]]; refresh = os.environ[sys.argv[3]]
    video, title, desc = sys.argv[4], sys.argv[5], sys.argv[6]
    tags = sys.argv[7].split(',') if len(sys.argv) > 7 else []
    tok = access_token(cid, csec, refresh)
    d = upload(tok, video, title, desc, tags)
    if d and d.get('id'):
        print("YT OK https://youtube.com/shorts/" + d['id'])
    else:
        print("YT FAIL", json.dumps(d)[:300] if d else "none")

main()
