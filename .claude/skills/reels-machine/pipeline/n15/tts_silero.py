# -*- coding: utf-8 -*- Озвучка Silero v4_ru (встроенный словарь ударений, put_accent).
# Голос eugene (натуральный мужской). Кормим ЧИСТЫЙ текст (без ручных U+0301) — Silero
# сам ставит ударения и ё. Тайминги слов — пропорционально длине по длительности mp3.
import json, os, subprocess, re, wave, unicodedata, sys
import torch, numpy as np

DAY='n15'; VOICE='eugene'; SR=48000; SPEED=0.97  # лёгкая энергия (аналог +6%)
MODEL='models/v4_ru.pt'
segs=json.load(open(f'{DAY}/segs.json'))
def strip_acc(s): return ''.join(c for c in s if c not in ('́','̀'))  # убрать ручные ударения, й/ё сохранить
def dur(p): return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',p]).strip())

torch.set_num_threads(max(1,(os.cpu_count() or 2)))
if not os.path.exists(MODEL):  # авто-скачивание модели (torch.hub не ходит через прокси — качаем curl'ом)
    os.makedirs(os.path.dirname(MODEL),exist_ok=True)
    subprocess.run(['curl','-sL','--cacert','/root/.ccr/ca-bundle.crt','-o',MODEL,
                    'https://models.silero.ai/models/tts/ru/v4_ru.pt'],check=True)
model=torch.package.PackageImporter(MODEL).load_pickle("tts_models","model"); model.to('cpu')

def synth(sid, text):
    clean=strip_acc(text)
    for a in range(4):
        try:
            wav=model.apply_tts(text=clean, speaker=VOICE, sample_rate=SR, put_accent=True, put_yo=True)
            pcm=(wav.numpy()*32767).astype('<i2')
            raw=f'{DAY}/vo/{sid}.wav'
            with wave.open(raw,'wb') as w:
                w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
            # темп + в mp3
            subprocess.run(['ffmpeg','-y','-v','error','-i',raw,'-filter:a',f'atempo={SPEED}','-ar','44100',f'{DAY}/vo/{sid}.mp3'],check=True)
            os.remove(raw)
            if os.path.getsize(f'{DAY}/vo/{sid}.mp3')>2500: return
        except Exception as e:
            print(sid,'retry',a,str(e)[:120])
    raise SystemExit(f'{sid} silero failed')

def timings(sid, text):
    D=dur(f'{DAY}/vo/{sid}.mp3')
    words=[strip_acc(w) for w in re.findall(r'[^\s]+',text)]
    wt=[]
    for w in words:
        core=re.sub(r'[^\wёЁа-яА-Я]','',w); pause=0.35 if re.search(r'[.,!?:;]',w) else 0.0
        wt.append(max(1,len(core))+pause*4)
    tot=sum(wt); t=0.0; out=[]; lead=0.10*D; span=D-lead-0.05
    for w,ww in zip(words,wt):
        d=span*ww/tot
        out.append({'w':re.sub(r'[.,!?:;]+$','',w),'t':round(lead+t,3),'d':round(d,3)}); t+=d
    json.dump(out,open(f'{DAY}/vo/{sid}.json','w'),ensure_ascii=False)
    return len(out),round(D,2)

os.makedirs(f'{DAY}/vo',exist_ok=True)
for sid,t in segs.items():
    synth(sid,t); n,D=timings(sid,t); print(sid,'ok',n,'words',D,'s')
