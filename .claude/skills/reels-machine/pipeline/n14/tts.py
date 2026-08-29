import json, asyncio, edge_tts, os, subprocess, unicodedata, re
segs=json.load(open('n14/segs.json'))
VOICE="ru-RU-DmitryNeural"; RATE="+6%"
def dur(p): return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',p]).strip())
def strip_acc(s): return ''.join(c for c in s if c not in ('́','̀'))  # убираем ТОЛЬКО ударения, й/ё сохраняем
async def synth(sid,text):
    for a in range(6):
        try:
            with open(f'n14/vo/{sid}.mp3','wb') as f:
                async for ch in edge_tts.Communicate(text,VOICE,rate=RATE).stream():
                    if ch['type']=='audio': f.write(ch['data'])
            if os.path.getsize(f'n14/vo/{sid}.mp3')>2500: return
        except Exception as e: print(sid,'retry',a,e)
        await asyncio.sleep(1.5)
    raise SystemExit(f'{sid} tts failed')
def timings(sid,text):
    D=dur(f'n14/vo/{sid}.mp3')
    words=[strip_acc(w) for w in re.findall(r'[^\s]+',text)]
    # вес слова = длина без пунктуации + 0.6 за знак препинания (пауза)
    wt=[]
    for w in words:
        core=re.sub(r'[^\wёЁа-яА-Я]','',w)
        pause=0.35 if re.search(r'[.,!?:;]',w) else 0.0
        wt.append(max(1,len(core))+pause*4)
    tot=sum(wt); t=0.0; out=[]
    lead=0.12*D  # небольшой заход голоса
    span=D-lead-0.05
    for w,ww in zip(words,wt):
        d=span*ww/tot
        out.append({'w':re.sub(r'[.,!?:;]+$','',w),'t':round(lead+t,3),'d':round(d,3)})
        t+=d
    json.dump(out,open(f'n14/vo/{sid}.json','w'),ensure_ascii=False)
    return len(out),round(D,2)
async def main():
    for sid,t in segs.items():
        await synth(sid,t); n,D=timings(sid,t); print(sid,'ok',n,'words',D,'s')
asyncio.run(main())
