#!/usr/bin/env python3
import os,sys,json,urllib.request,urllib.parse
CREDS=os.environ.get("YT_CREDS_FILE", os.path.join(os.path.dirname(__file__),"cfg/yt_creds.env"))
def load_env(p):
    d={}
    for l in open(p):
        l=l.strip()
        if l and "=" in l and not l.startswith("#"): k,v=l.split("=",1); d[k]=v
    return d
E=load_env(CREDS)
def refresh():
    data=urllib.parse.urlencode({"client_id":E["YT_CLIENT_ID"],"client_secret":E["YT_CLIENT_SECRET"],
        "refresh_token":E["YT_REFRESH_TOKEN"],"grant_type":"refresh_token"}).encode()
    return json.load(urllib.request.urlopen("https://oauth2.googleapis.com/token",data=data,timeout=60))["access_token"]
def set_thumb(tok,vid,cover):
    try:
        img=open(cover,"rb").read()
        req=urllib.request.Request(
            "https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId="+vid,
            data=img,method="POST",
            headers={"Authorization":f"Bearer {tok}","Content-Type":"image/jpeg","Content-Length":str(len(img))})
        urllib.request.urlopen(req,timeout=120)
        print("THUMB_SET",vid)
    except Exception as e:
        print("THUMB_FAIL",str(e)[:120])
def main():
    video,title,descf=sys.argv[1],sys.argv[2],sys.argv[3]
    cover=sys.argv[4] if len(sys.argv)>4 else os.environ.get("COVER","")
    desc=open(descf,encoding="utf-8").read(); tok=refresh(); sz=os.path.getsize(video)
    meta={"snippet":{"title":title[:99],"description":desc,"categoryId":"2",
        "tags":["спецтехника из китая","мото из китая","квадроцикл из китая","гидроцикл из китая","DIESEL CARGO"]},
        "status":{"privacyStatus":"public","selfDeclaredMadeForKids":False}}
    req=urllib.request.Request("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
        data=json.dumps(meta).encode("utf-8"),
        headers={"Authorization":f"Bearer {tok}","Content-Type":"application/json; charset=UTF-8",
                 "X-Upload-Content-Length":str(sz),"X-Upload-Content-Type":"video/mp4"})
    loc=urllib.request.urlopen(req,timeout=120).headers["Location"]
    put=urllib.request.Request(loc,data=open(video,"rb").read(),method="PUT",
        headers={"Authorization":f"Bearer {tok}","Content-Type":"video/mp4","Content-Length":str(sz)})
    d=json.load(urllib.request.urlopen(put,timeout=300)); vid=d.get("id")
    print("VIDEO_ID",vid); print("URL https://youtube.com/shorts/"+str(vid))
    if cover and os.path.exists(cover) and vid: set_thumb(tok,vid,cover)
# standalone thumbnail mode: yt_upload.py --thumb <videoId> <cover>
if __name__=="__main__":
    if len(sys.argv)>1 and sys.argv[1]=="--thumb":
        set_thumb(refresh(),sys.argv[2],sys.argv[3])
    else: main()
