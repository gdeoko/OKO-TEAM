#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Фоновая музыка: Freesound (FREESOUND_API_KEY) → скачать → микс под голос с fade+ducking.
  fetch(query, out_mp3)  -> путь трека
  mix(video, voice, music, out, vol=0.11) -> видео с озвучкой+музыкой"""
import os,sys,json,subprocess,urllib.request,urllib.parse
def fetch(query, out_mp3):
    K=os.environ["FREESOUND_API_KEY"]
    for q in [query,"electronic background music","upbeat loop","energetic beat"]:
        p={"query":q,"fields":"id,name,previews,duration","page_size":"8","token":K}
        try: d=json.loads(urllib.request.urlopen("https://freesound.org/apiv2/search/text/?"+urllib.parse.urlencode(p),timeout=30).read())
        except Exception: continue
        for r in d.get("results",[]):
            if 15<=r.get("duration",0)<=180 and r["previews"].get("preview-hq-mp3"):
                urllib.request.urlretrieve(r["previews"]["preview-hq-mp3"],out_mp3); return out_mp3
    return None
def mix(video, voice, music, out, vol=0.11):
    vlen=float(subprocess.check_output(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",video]).strip())
    fo=round(vlen-1.2,2)
    subprocess.run(["ffmpeg","-y","-v","error","-i",video,"-i",voice,"-stream_loop","-1","-i",music,
      "-filter_complex",f"[1:a]apad[vo];[2:a]atrim=0:{vlen},volume={vol},afade=t=in:st=0:d=0.6,afade=t=out:st={fo}:d=1.2[mu];[vo][mu]amix=inputs=2:duration=first:normalize=0[a]",
      "-map","0:v","-map","[a]","-c:v","libx264","-pix_fmt","yuv420p","-c:a","aac","-shortest",out],check=True,timeout=200)
    return out
if __name__=="__main__":
    print(fetch(sys.argv[1] if len(sys.argv)>1 else "electronic background", sys.argv[2] if len(sys.argv)>2 else "/tmp/music.mp3"))
