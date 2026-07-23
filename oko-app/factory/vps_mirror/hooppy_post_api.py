#!/usr/bin/env python3
# Hooppy API poster — upload media + create post to a TikTok page.
# Usage: hooppy_post_api.py <page_id> <video_path> [caption]
# Caption source priority: argv[3] if non-empty, else base64 env CAPB64 (cron-wipe-proof).
# NEVER read caption from a .txt file — the VPS cron wipes cfg/tmp *.txt between deploy and run.
# 23.07: добавлены РЕТРАИ на пустой/битый JSON-ответ (Hooppy изредка отдаёт пусто -> раньше
#         это роняло TikTok в slot-публикации с JSONDecodeError char 0 и ролик уходил без TikTok).
import os, sys, json, subprocess, time, base64
BASE='https://api.hooppy.ru/api'
TOK=os.environ['HOOPPY_API_TOKEN']
SRC=int(os.environ.get('HOOPPY_TT_SOURCE_ID','14'))  # 14 = TikTok
CA=os.environ.get('CURL_CA','')

def curl(args, timeout=180):
    b=['curl','-s','-m',str(timeout)]+(['--cacert',CA] if CA and os.path.exists(CA) else [])
    return subprocess.run(b+args, capture_output=True, text=True).stdout

def _jretry(fn, what, tries=4):
    # повторяем при пустом/битом ответе (транзиентные хиккапы API), backoff 3/6/12с
    last=''
    for i in range(tries):
        out=fn()
        last=out
        try:
            j=json.loads(out); return j
        except Exception:
            sys.stderr.write(f"[hooppy] {what}: пустой/битый ответ (попытка {i+1}/{tries}), ретрай… resp[:80]={out[:80]!r}\n")
            time.sleep(3*(2**i))
    raise SystemExit(f"HOOPPY {what} FAIL после {tries} попыток; последний ответ[:120]={last[:120]!r}")

def upload(video):
    fid=f"oko{int(time.time())}"
    j=_jretry(lambda: curl(['-X','POST',f'{BASE}/files/media/upload','-H',f'Authorization: Bearer {TOK}','-H','Accept: application/json',
              '-F',f'file=@{video};type=video/mp4','-F',f'file_id={fid}']), "upload")
    if 'photo' not in j: raise SystemExit(f"HOOPPY upload: нет 'photo' в ответе: {json.dumps(j)[:160]}")
    return j['photo']

def create(page_id, media_obj, caption):
    html="<p>"+caption.replace("\n","<br>")+"</p>"
    payload={"as_copy":0,"publication_when_type":1,"publication_how_type":1,"publication_where_type":1,"created_by":0,
        "texts":[{"text":html,"source_id":0}],
        "attachments":[{"type":"photos","data":[media_obj]}],
        "ids":"","selected_pages_by_source_ids":{str(SRC):[int(page_id)]},"selected_albums_by_source_ids":{}}
    j=_jretry(lambda: curl(['-X','POST',f'{BASE}/posts','-H',f'Authorization: Bearer {TOK}','-H','Accept: application/json',
              '-H','Content-Type: application/json','--data-binary',json.dumps(payload,ensure_ascii=False).encode('utf-8').decode('utf-8')]), "create")
    return j

if __name__=='__main__':
    page_id, video = sys.argv[1], sys.argv[2]
    caption = sys.argv[3] if len(sys.argv)>3 and sys.argv[3].strip() else \
              base64.b64decode(os.environ.get('CAPB64','')).decode('utf-8')
    if not caption.strip():
        print('ABORT: empty caption (pass argv[3] or CAPB64 env)'); sys.exit(2)
    m=upload(video); print('uploaded:', m.get('id'), m.get('type'), m.get('seconds'),'s')
    r=create(page_id, m, caption); print('post:', json.dumps(r)[:200])
