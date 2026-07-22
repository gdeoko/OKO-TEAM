import os,json,subprocess
W=os.path.dirname(os.path.abspath(__file__)); VO=W+"/vo"; SFX=W+"/sfx"
T=json.load(open(W+"/timing.json")); SS=T["seg_start"]; DUR=T["segdurs"]
ENDCARD=2.4
TOTAL=round(T["content_end"]+ENDCARD,3)
ORDER=["s1","s2","s3","s4","s5","s6"]
# --- inputs ---
inp=[]; f=[]; amix_labels=[]
def add(path): inp.extend(["-i",path]); return len(inp)//2-1
# music input 0 — PER-REEL unique track (env MUSIC_TRACK), never the single shared bed.
# ЗАКОН РАЗНООБРАЗИЯ: музыка выбирается pick_music.py под тему/сценарий/бакет и НЕ повторяется
# (реестр USED_MUSIC.md). Плюс лёгкая пер-ролик обработка (сдвиг секции/темп/EQ) в build_music().
_mtrack=os.environ.get("MUSIC_TRACK","").strip()
if not _mtrack or not os.path.exists(_mtrack):
    raise SystemExit("AUDIO ABORT: MUSIC_TRACK env not set/missing — каждый ролик берёт свой трек "
                     "через pick_music.py (никаких повторов одного бэда). Задай MUSIC_TRACK=<path>.")
mi=add(_mtrack)
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
# music: PER-REEL treatment so даже близкие треки звучат по-разному.
# seed -> section start offset, tempo, EQ-наклон, база громкости (детерминированно на ролик).
_seed=int(os.environ.get("MUSIC_SEED") or abs(hash(_mtrack))%997)
_mdur=float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",_mtrack],
            capture_output=True,text=True).stdout.strip() or TOTAL+30)
_start=round((_seed*7.3)% max(1.0,_mdur-TOTAL-2),2) if _mdur>TOTAL+4 else 0.0   # разная секция трека
_tempo=round(0.95+((_seed%9)*0.0125),3)                                          # 0.95..1.05
_lo=round(-2+((_seed//3)%5),1); _hi=round(-2+((_seed//7)%5),1)                    # EQ-наклон низ/верх дБ
_vol=round(0.145+((_seed%4)*0.006),3)                                             # 0.145..0.163
f.append(f"[{mi}]atrim=start={_start}:end={_start+ (TOTAL/_tempo)+2:.2f},asetpts=N/SR/TB,"
         f"atempo={_tempo},"
         f"equalizer=f=110:width_type=o:width=2:g={_lo},equalizer=f=7000:width_type=o:width=2:g={_hi},"
         f"atrim=0:{TOTAL},asetpts=N/SR/TB,"
         f"volume={_vol},afade=t=in:st=0:d=1.3,afade=t=out:st={TOTAL-1.6:.2f}:d=1.6[mus]")
print(f"MUSIC treat: {os.path.basename(_mtrack)} seed={_seed} start={_start}s tempo={_tempo} eq({_lo}/{_hi}) vol={_vol}")
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
