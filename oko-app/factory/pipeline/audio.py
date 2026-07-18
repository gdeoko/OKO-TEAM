import os,json,subprocess
W=os.path.dirname(os.path.abspath(__file__)); VO=W+"/vo"; SFX=W+"/sfx"
T=json.load(open(W+"/timing.json")); SS=T["seg_start"]; DUR=T["segdurs"]
ENDCARD=2.4
TOTAL=round(T["content_end"]+ENDCARD,3)
ORDER=["s1","s2","s3","s4","s5","s6"]
# --- inputs ---
inp=[]; f=[]; amix_labels=[]
def add(path): inp.extend(["-i",path]); return len(inp)//2-1
# music input 0
mi=add(f"{SFX}/music.mp3")
# VO segment inputs
voi={s:add(f"{VO}/{s}.mp3") for s in ORDER}
# SFX inputs (logical, varied). (file, offset, gain)
# aligned to the excavator accent layout (top-zone graphics per clip). Varied, logical, no water.
SFXPLAN=[
 ("whoosh_a", 1.0,  0.5),   # into hook
 ("pop",      1.5,  0.5),   # chip: АРЕНДА=СЕЗОН
 ("pop",      2.1,  0.5),   # chip: ПОКУПКА=ГОДЫ
 ("engine",   8.1,  0.24),  # excavator working bed (low) under process beat
 ("check",    8.8,  0.55),  # tick: роет траншеи
 ("check",    9.7,  0.55),  # tick: планирует площадку
 ("check",   10.6,  0.55),  # tick: грузит грунт
 ("whoosh_b",14.7,  0.5),   # transition -> reliability
 ("pop",     15.3,  0.55),  # chip: ДИЗЕЛЬ
 ("pop",     15.9,  0.55),  # chip: ГИДРАВЛИКА
 ("pop",     16.5,  0.55),  # chip: РЕСУРС
 ("tick",    18.2,  0.45),  # ring counts up: БЕЗ ПЕРЕГРЕВА
 ("whoosh_a",20.6,  0.5),   # transition -> logistics/route
 ("riser",   24.1,  0.5),   # build into ПОД КЛЮЧ stamp
 ("impact",  24.95, 0.7),   # stamp slam: ПОД КЛЮЧ
 ("check",   29.1,  0.55),  # tick: доставка
 ("check",   30.0,  0.55),  # tick: оформление
 ("check",   30.9,  0.55),  # tick: документы
 ("whoosh_b",34.9,  0.5),   # transition -> CTA
 ("impact",  35.35, 0.5),   # CTA badge appear
 ("shimmer", T["content_end"]+0.15,0.55), # endcard logo reveal
]
sfxi=[]
for name,off,g in SFXPLAN:
    sfxi.append((add(f"{SFX}/{name}.mp3"),off,g))
# --- filters ---
# music: loop-safe trim, fade in/out, base volume
f.append(f"[{mi}]atrim=0:{TOTAL},asetpts=N/SR/TB,"
         f"volume=0.16,afade=t=in:st=0:d=1.3,afade=t=out:st={TOTAL-1.6:.2f}:d=1.6[mus]")
# VO: delay each to its start, mix
volabels=[]
for s in ORDER:
    off=int(SS[s]*1000)
    f.append(f"[{voi[s]}]adelay={off}|{off},volume=1.35[vo{s}]"); volabels.append(f"[vo{s}]")
f.append("".join(volabels)+f"amix=inputs={len(volabels)}:normalize=0:dropout_transition=0,alimiter=limit=0.95,asplit=2[voduck][vo]")
# duck music under VO
f.append("[mus][voduck]sidechaincompress=threshold=0.04:ratio=7:attack=12:release=320:makeup=1[musd]")
# SFX delays
slabels=[]
for k,(i,off,g) in enumerate(sfxi):
    off_ms=max(0,int(off*1000))
    f.append(f"[{i}]adelay={off_ms}|{off_ms},volume={g}[sx{k}]")
    slabels.append(f"[sx{k}]")
# final mix: ducked music + VO + all SFX
allmix="[musd][vo]"+"".join(slabels)
f.append(allmix+f"amix=inputs={2+len(slabels)}:normalize=0:dropout_transition=0,"
         f"atrim=0:{TOTAL},alimiter=limit=0.97,aresample=48000[aout]")
fc=";".join(f)
cmd=["ffmpeg","-y"]+inp+["-filter_complex",fc,"-map","[aout]","-c:a","aac","-b:a","192k",W+"/audio.m4a","-loglevel","error"]
open(W+"/audio_cmd.txt","w").write(" ".join(cmd))
r=subprocess.run(cmd,capture_output=True,text=True)
if r.returncode!=0: print("AUDIO ERR:",r.stderr[-1200:])
else:
    d=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",W+"/audio.m4a"],capture_output=True,text=True).stdout.strip()
    print("AUDIO OK",d,"s | TOTAL",TOTAL)
