import asyncio, edge_tts, json, sys, os, re
async def synth(text, voice, rate, mp3):
    sents=[]
    comm=edge_tts.Communicate(text, voice, rate=rate, proxy=os.environ.get("HTTPS_PROXY"))
    with open(mp3,"wb") as f:
        async for ch in comm.stream():
            if ch["type"]=="audio": f.write(ch["data"])
            elif ch["type"]=="SentenceBoundary":
                sents.append((ch["offset"]/1e7, ch["duration"]/1e7, ch["text"]))
    return sents
def words_from_sents(sents):
    """Distribute each sentence's duration across its words by char length + punct pause."""
    out=[]
    for off,dur,txt in sents:
        toks=[t for t in re.findall(r"\S+", txt)]
        if not toks: continue
        weights=[len(re.sub(r'[^\w]','',t))+ (2.2 if re.search(r'[.,;:!?]$',t) else 0)+1 for t in toks]
        tot=sum(weights); t=off
        for tok,wt in zip(toks,weights):
            d=dur*wt/tot
            out.append({"w":tok,"t":round(t,3),"d":round(d,3)})
            t+=d
    return out
async def main():
    d=json.load(open(sys.argv[1])); wd=sys.argv[2]; os.makedirs(wd,exist_ok=True)
    voice=d["voice"]; rate=d.get("rate","+0%")
    segs=list(d["segments"])+[{"id":"cta","text":d["cta"]["text"]+" The code word is "+d["cta"]["code"]+"."}]
    for s in segs:
        for a in range(5):
            try:
                sents=await synth(s["text"],voice,rate,f'{wd}/{s["id"]}.mp3')
                if os.path.getsize(f'{wd}/{s["id"]}.mp3')>1200 and sents:
                    w=words_from_sents(sents); json.dump(w,open(f'{wd}/{s["id"]}.json',"w"))
                    print(s["id"],"ok",len(w),"words"); break
            except Exception as e: print(s["id"],"retry",a,repr(e)[:80])
        else: raise SystemExit(f'VO failed {s["id"]}')
asyncio.run(main())
