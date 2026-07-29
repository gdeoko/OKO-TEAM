#!/usr/bin/env python3
"""TTS for 7 viral reels: DmitryNeural +50% assertive, WordBoundary timings."""
import asyncio, json, os, sys, edge_tts

FACTORY = "/tmp/claude-0/-home-user-OKO-TEAM/4d03047f-7a59-58cd-ac9b-80a55112aa48/scratchpad/factory"
VOICE = "ru-RU-DmitryNeural"
RATE = "+50%"
PITCH = "+12Hz"   # slightly higher = more energetic/assertive, NOT soft
TTS_DIR = os.path.join(FACTORY, "tts")
os.makedirs(TTS_DIR, exist_ok=True)

async def gen(rid, sid, text):
    mp3 = os.path.join(TTS_DIR, f"{rid}_{sid}.mp3")
    wj  = os.path.join(TTS_DIR, f"{rid}_{sid}_words.json")
    for attempt in range(5):
        try:
            comm = edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH, boundary="WordBoundary")
            words=[]; audio=bytearray()
            async for ch in comm.stream():
                if ch["type"]=="audio": audio.extend(ch["data"])
                elif ch["type"]=="WordBoundary":
                    words.append({"w":ch["text"],"t":ch["offset"]/1e7,"d":ch["duration"]/1e7})
            if not words: raise RuntimeError("no words")
            with open(mp3,"wb") as f: f.write(audio)
            with open(wj,"w") as f: json.dump({"words":words,"text":text},f,ensure_ascii=False)
            dur = words[-1]["t"]+words[-1]["d"]
            return {"mp3":mp3,"words":wj,"dur":dur,"wc":len(words)}
        except Exception as e:
            if attempt==4: raise
            await asyncio.sleep(1.5)

async def main():
    only = sys.argv[1] if len(sys.argv)>1 else None
    with open(os.path.join(FACTORY,"scenarios_v.json")) as f:
        sc=json.load(f)
    man = {}
    mpath = os.path.join(FACTORY,"tts_v_manifest.json")
    if os.path.exists(mpath):
        man=json.load(open(mpath))
    for rid in sorted(sc):
        if only and rid!=only: continue
        reel=sc[rid]; print(f"\n=== {rid}: {reel['title']} ===")
        segs=[]
        for s in reel["segments"]:
            r=await gen(rid,s["id"],s["text"])
            print(f"  {s['id']}: {r['wc']}w {r['dur']:.2f}s")
            segs.append({**s,"mp3":r["mp3"],"words":r["words"],"dur":r["dur"]})
        man[rid]={"title":reel["title"],"grade":reel["grade"],"cta":reel["cta"],
                  "desc_topic":reel["desc_topic"],"segments":segs}
        print(f"  TOTAL {sum(s['dur'] for s in segs):.1f}s")
        json.dump(man,open(mpath,"w"),ensure_ascii=False,indent=1)
    print("\nTTS done ->",mpath)

asyncio.run(main())
