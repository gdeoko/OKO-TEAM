#!/usr/bin/env python3
# Hooppy API poster — upload media + create post to a TikTok page.
# Usage: hooppy_post_api.py <page_id> <video_path> <caption>
# API (reverse-engineered 15.07.2026):
#   1) POST /api/files/media/upload  (multipart: file, file_id) -> {"photo": {media_obj}}
#   2) POST /api/posts  with payload below. Account field = selected_pages_by_source_ids {source_id:[page_id]}
#      page_id != account_id; get via GET /api/posts/0/edit?as_copy=0 -> social_pages_by_accounts[].pages[].id
import os, sys, json, subprocess, time
BASE='https://api.hooppy.ru/api'
TOK=os.environ['HOOPPY_API_TOKEN']
SRC=int(os.environ.get('HOOPPY_TT_SOURCE_ID','14'))  # 14 = TikTok
CA=os.environ.get('CURL_CA','')  # agent-proxy CA only; empty on the VPS (normal internet)

def curl(args, timeout=90):
    base=['curl','-s','-m',str(timeout)]+(['--cacert',CA] if CA and os.path.exists(CA) else [])
    r=subprocess.run(base+args, capture_output=True, text=True)
    return r.stdout

def upload(video):
    fid=f"oko{int(time.time())}"
    out=curl(['-X','POST',f'{BASE}/files/media/upload','-H',f'Authorization: Bearer {TOK}','-H','Accept: application/json',
              '-F',f'file=@{video};type=video/mp4','-F',f'file_id={fid}'])
    d=json.loads(out); return d['photo']

def create(page_id, media_obj, caption):
    payload={
        "as_copy":0,"publication_when_type":1,"publication_how_type":1,"publication_where_type":1,"created_by":0,
        "texts":[{"text":f"<p>{caption}</p>","source_id":0}],
        "attachments":[{"type":"photos","data":[media_obj]}],
        "ids":"","selected_pages_by_source_ids":{str(SRC):[int(page_id)]},"selected_albums_by_source_ids":{}
    }
    out=curl(['-X','POST',f'{BASE}/posts','-H',f'Authorization: Bearer {TOK}','-H','Accept: application/json',
              '-H','Content-Type: application/json','--data-binary',json.dumps(payload)])
    return json.loads(out)

if __name__=='__main__':
    page_id, video, caption = sys.argv[1], sys.argv[2], sys.argv[3]
    m=upload(video); print('uploaded:', m.get('id'), m.get('type'), m.get('seconds'),'s')
    r=create(page_id, m, caption); print('post:', json.dumps(r)[:200])
