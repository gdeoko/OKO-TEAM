#!/usr/bin/env python3
"""Send 7 finished reels to Daniel (1966985736) via sendVideo, then post full descriptions."""
import json, os, subprocess, time, sys

FAC="/tmp/claude-0/-home-user-OKO-TEAM/4d03047f-7a59-58cd-ac9b-80a55112aa48/scratchpad/factory"
OUT=os.path.join(FAC,"out")
BOT="8871345918:AAG6yPl7XgUiAiRVadDpNK1QsUgFt6bSwXM"
DAN="1966985736"
descs=json.load(open(os.path.join(FAC,"descriptions.json")))
titles=json.load(open(os.path.join(FAC,"tts_v_manifest.json")))

def send_video(path,caption):
    for attempt in range(4):
        r=subprocess.run(["curl","-s","--max-time","300",
            "-F",f"chat_id={DAN}","-F","supports_streaming=true",
            "-F","width=1080","-F","height=1920",
            "-F",f"caption={caption}",
            "-F",f"video=@{path};type=video/mp4",
            f"https://api.telegram.org/bot{BOT}/sendVideo"],
            capture_output=True,text=True,timeout=320)
        try:
            d=json.loads(r.stdout)
            if d.get("ok"): return True
            print("  err:",str(d)[:150])
        except: print("  parse err:",r.stdout[:150])
        time.sleep(3*(attempt+1))
    return False

def send_msg(text):
    subprocess.run(["curl","-s","-F",f"chat_id={DAN}","-F",f"text={text}",
        f"https://api.telegram.org/bot{BOT}/sendMessage"],capture_output=True,text=True,timeout=60)

only=sys.argv[1:] or ["v1","v2","v3","v4","v5","v6","v7"]
send_msg("Готовы 7 роликов V.CODE на 29 июля. Собраны по анализу конкурентов (проверенные виральные заходы). Каждый: голос, инфографика синхронно, смена кадров, xfade-переходы, караоке-субтитры, обложка, музыка. Ниже — видео + описание для публикации.")
for rid in only:
    path=os.path.join(OUT,f"{rid}_final.mp4")
    if not os.path.exists(path):
        print(f"{rid}: MISSING"); continue
    sz=os.path.getsize(path)/1e6
    cap=descs[rid]["cap"]
    print(f"send {rid} ({sz:.1f}MB)...")
    ok=send_video(path,cap)
    print(f"  video: {'OK' if ok else 'FAIL'}")
    if ok:
        time.sleep(1)
        send_msg(descs[rid]["full"])
    time.sleep(2)
print("ALL SENT")
