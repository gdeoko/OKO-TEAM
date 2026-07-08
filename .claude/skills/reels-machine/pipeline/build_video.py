import json, subprocess

def probe(p):
    return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',p]).strip())
def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(r.stderr[-1500:]); raise SystemExit(1)

segs = ['s1','s2','s3','s4','s5']
durs = {s: probe(f'vo/{s}.mp3') for s in segs}
words = {s: json.load(open(f'vo/{s}.json')) for s in segs}
COVER, LEAD2, GAP, TAIL, ENDCARD = 0.30, 0.45, 0.35, 0.9, 2.2
starts, t = {}, COVER + LEAD2
for s in segs:
    starts[s] = t
    t += durs[s] + GAP
main_end = t - GAP + TAIL
total = main_end + ENDCARD
bounds = [COVER]
for s in segs[:-1]:
    bounds.append(starts[s] + durs[s] + GAP/2)
bounds.append(main_end)
windows = [(bounds[i], bounds[i+1]) for i in range(5)]
SCENE_SHOTS = [
    [('px_knead',2.0), ('px_flour',3.0), ('px_baker',4.0)],
    [('px_record',6.0), ('px_knead',10.0), ('px_flour',12.0)],
    [('px_phone',3.0), ('px_edit',8.0), ('px_phone',18.0), ('px_edit',20.0)],
    [('px_shop',2.0), ('px_oven',2.0), ('px_fresh',1.0)],
    [('1512',3.0), ('px_camera',0.4), ('px_edit',24.0), ('px_record',22.0)],
]
shots = []
for (w0,w1), sc in zip(windows, SCENE_SHOTS):
    d = (w1-w0)/len(sc)
    for cid, ss in sc:
        shots.append((cid, ss, d))
N = len(shots)
print('total', round(total,2))

# ============ STAGE 1: montage (concat+zoom+glitch+watermark+bar+grade) ============
inputs = []
for cid, ss, d in shots:
    inputs += ['-ss', f'{ss:.2f}', '-t', f'{d+0.3:.2f}', '-i', (f'clips_px/{cid}.mp4' if cid.startswith('px_') else f'clips/{cid}.mp4')]
inputs += ['-loop','1','-framerate','30','-t',f'{COVER:.2f}','-i','v001_cover4.jpg']
inputs += ['-loop','1','-framerate','30','-t','2.5','-i','logo_hd.png']
fc = []
for i,(cid, ss, d) in enumerate(shots):
    zoom = "'min(1.02+0.0022*on,1.18)'" if i % 2 == 0 else "'max(1.18-0.0022*on,1.02)'"
    glitch = ",chromashift=crh=-9:cbh=9:enable='lt(t,0.10)'" if i else ""
    fc.append(f"[{i}:v]trim=0:{d:.3f},setpts=PTS-STARTPTS,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,zoompan=z={zoom}:d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1080x1920:fps=30,setsar=1{glitch}[v{i}]")
fc.append(f"[{N}:v]scale=1080:1920,fps=30,setsar=1[vcov]")
fc.append(f"color=c=0x0d0d0d:s=1080x1920:r=30:d={ENDCARD}[cbg]")
fc.append(f"[{N+1}:v]split=2[lga][lgb]")
fc.append("[lga]scale=560:-1,fps=30[lgbig]")
fc.append("[cbg][lgbig]overlay=(W-w)/2:600:shortest=1[card]")
fc.append("[vcov]" + "".join(f"[v{i}]" for i in range(N)) + "[card]concat=n=" + str(N+2) + ":v=1:a=0[allv]")
fc.append("[lgb]scale=150:-1,fps=30,format=rgba,colorchannelmixer=aa=0.85[lgsm]")
fc.append(f"[allv][lgsm]overlay=W-w-40:52:enable='between(t,{COVER},{main_end:.2f})':eof_action=repeat[wm]")
fc.append(f"color=c=0xe8842a:s=1080x8:r=30:d={total:.2f},format=rgba,colorchannelmixer=aa=0.9[bar]")
fc.append(f"[wm][bar]overlay=y=0:x='-W+W*min(t/{main_end:.2f},1)':shortest=0[pb]")
fc.append("[pb]eq=contrast=1.05:saturation=1.12:brightness=-0.01,vignette=PI/4.5,noise=alls=5:allf=t[vout]")
run(['ffmpeg','-y','-v','error'] + inputs + ['-filter_complex', ';'.join(fc),
     '-map','[vout]','-t',f'{total:.2f}','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','stage1.mp4'])
print('stage1 ok', probe('stage1.mp4'))

# ============ STAGE 2: fx overlays (wipes, leak, viewfinder, sting, counter, plates) ============
inputs = ['-i','stage1.mp4']
for _ in range(5): inputs += ['-framerate','30','-i','ov_wipe/%03d.png']
inputs += ['-loop','1','-framerate','30','-t',f'{total:.2f}','-i','leak.png']
inputs += ['-loop','1','-framerate','30','-t',f'{total:.2f}','-i','viewfinder.png']
inputs += ['-loop','1','-framerate','30','-t',f'{total:.2f}','-i','recdot.png']
inputs += ['-framerate','30','-i','ov_sting2/%03d.png']
inputs += ['-framerate','30','-i','ov_counter/%03d.png']
inputs += ['-framerate','30','-i','ov_chart/%03d.png']
inputs += ['-loop','1','-framerate','30','-t','3.2','-i','lt_phone.png']
inputs += ['-loop','1','-framerate','30','-t','3.2','-i','lt_cam.png']
inputs += ['-framerate','30','-i','ov_stamp/%03d.png']
inputs += ['-framerate','30','-i','ov_msgs/%03d.png']
inputs += ['-framerate','30','-i','ov_confetti/%03d.png']
inputs += ['-framerate','30','-i','ov_clock/%03d.png']
inputs += ['-framerate','30','-i','ov_pin/%03d.png']
inputs += ['-framerate','30','-i','ov_scroll/%03d.png']
T_CNT = starts['s3'] + 1.0
fc = []
flash_ts = bounds[1:-1] + [main_end]
src = "0:v"
for k, tb in enumerate(flash_ts):
    fc.append(f"[{1+k}:v]format=rgba,setpts=PTS+{tb-7/30:.3f}/TB[wp{k}]")
    fc.append(f"[{src}][wp{k}]overlay=0:0:eof_action=pass[f{k}]")
    src = f"f{k}"
fc.append(f"color=c=black:s=1080x1920:r=30:d={total:.2f}[lbase]")
fc.append("[6:v]colorchannelmixer=rr=0.30:gg=0.30:bb=0.30[blob]")
fc.append("[lbase][blob]overlay=x='-260+240*sin(t/3.5)':y='-350+260*cos(t/4.5)':eval=frame:shortest=0,fps=30,format=gbrp[leak]")
fc.append(f"[{src}]format=gbrp[gA]")
fc.append("[gA][leak]blend=all_mode=screen,format=yuv420p[bl]")
fc.append("[7:v]format=rgba[vfp]")
fc.append(f"[bl][vfp]overlay=0:0:enable='between(t,{windows[4][0]:.2f},{main_end:.2f})':eof_action=repeat[gvf]")
fc.append("[8:v]format=rgba[recp]")
fc.append(f"[gvf][recp]overlay=0:0:enable='between(t,{windows[4][0]:.2f},{main_end:.2f})*lt(mod(t,1),0.55)':eof_action=repeat[grec]")
fc.append("[9:v]format=rgba,setpts=PTS+0.35/TB[sting]")
fc.append("[grec][sting]overlay=0:0:eof_action=pass[g1]")
fc.append(f"[10:v]format=rgba,setpts=PTS+{T_CNT:.2f}/TB[cnt]")
fc.append("[g1][cnt]overlay=0:0:eof_action=pass[g2]")
fc.append(f"[12:v]format=rgba,fade=t=in:st=0:d=0.28:alpha=1,fade=t=out:st=2.85:d=0.32:alpha=1,setpts=PTS+{windows[1][0]+0.25:.2f}/TB[lt1]")
fc.append("[g2][lt1]overlay=0:0:eof_action=pass[g3]")
fc.append(f"[11:v]format=rgba,setpts=PTS+{bounds[3]+0.7:.2f}/TB[cht]")
fc.append("[g3][cht]overlay=0:0:eof_action=pass[g4]")
fc.append(f"[13:v]format=rgba,fade=t=in:st=0:d=0.28:alpha=1,fade=t=out:st=2.85:d=0.32:alpha=1,setpts=PTS+{windows[4][0]+0.25:.2f}/TB[lt2]")
fc.append("[g4][lt2]overlay=0:0:eof_action=pass[g5]")
w_prodan = next(starts['s1'] + w['t'] for w in words['s1'] if w['w'].startswith('продан'))
fc.append(f"[14:v]format=rgba,setpts=PTS+{w_prodan-0.05:.2f}/TB[stmp]")
fc.append("[g5][stmp]overlay=0:0:eof_action=pass[g6]")
fc.append(f"[15:v]format=rgba,setpts=PTS+{bounds[3]+2.9:.2f}/TB[msgs]")
fc.append("[g6][msgs]overlay=0:0:eof_action=pass[g7]")
fc.append(f"[16:v]format=rgba,setpts=PTS+{main_end+0.05:.2f}/TB[conf]")
fc.append("[g7][conf]overlay=0:0:eof_action=pass[g8]")
w_devjati = next(starts['s1'] + w['t'] for w in words['s1'] if w['w'].startswith('девяти'))
w_rostov  = next(starts['s1'] + w['t'] for w in words['s1'] if w['w'].startswith('Ростов'))
fc.append(f"[17:v]format=rgba,setpts=PTS+{w_devjati-0.15:.2f}/TB[clk]")
fc.append("[g8][clk]overlay=0:0:eof_action=pass[g9]")
fc.append(f"[18:v]format=rgba,setpts=PTS+{w_rostov+0.45:.2f}/TB[pin]")
fc.append("[g9][pin]overlay=0:0:eof_action=pass[g10]")
fc.append(f"[19:v]format=rgba,setpts=PTS+{starts['s3']+6.9:.2f}/TB[scr]")
fc.append("[g10][scr]overlay=0:0:eof_action=pass[vfx]")
run(['ffmpeg','-y','-v','error'] + inputs + ['-filter_complex', ';'.join(fc),
     '-map','[vfx]','-t',f'{total:.2f}','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','stage2.mp4'])
print('stage2 ok', probe('stage2.mp4'))

# ============ STAGE 3: subs + audio ============
GREEN = '&H06F89C&'
WHITE = '&HFFFFFF&'
def fmt(ts):
    h=int(ts//3600); m=int(ts%3600//60); sec=ts%60
    return f"{h}:{m:02d}:{sec:05.2f}"
lines = []
for s in segs:
    ws, base = words[s], starts[s]
    i = 0
    while i < len(ws):
        chunk = [ws[i]]; chars = len(ws[i]['w']); j = i+1
        while j < len(ws) and len(chunk) < 3 and chars + len(ws[j]['w']) <= 16:
            chunk.append(ws[j]); chars += len(ws[j]['w']); j += 1
        wl = [(w['w'].lower(), base + w['t'], base + w['t'] + w['d']) for w in chunk]
        lines.append([wl[0][1]-0.03, wl[-1][2]+0.16, wl])
        i = j
for L in range(len(lines)-1):
    nxt = lines[L+1][2][0][1] - 0.05
    if lines[L][1] > nxt:
        lines[L][1] = max(lines[L][2][-1][1] + 0.05, nxt)
dialogues = []
for st, en, wl in lines:
    for k in range(len(wl)):
        ev_st = wl[k][1] - 0.03 if k == 0 else wl[k][1]
        ev_en = wl[k+1][1] if k+1 < len(wl) else en
        if ev_en <= ev_st: ev_en = ev_st + 0.05
        crisp, glow = [], []
        for j2 in range(len(wl)):
            if j2 > k: continue
            word = wl[j2][0]
            col = GREEN if j2 == k else WHITE
            pop = r'\t(0,70,\fscx100\fscy100)' if j2 == k else ''
            scale = r'\fscx82\fscy82' if (j2 == k and k > 0) else ''
            crisp.append(('{\\c'+col+scale+pop+'}')+word)
            galpha = r'\alpha&HC8&' if j2 == k else r'\alpha&HFF&'
            glow.append(('{\\c'+GREEN+galpha+'}')+word)
        dialogues.append((1, ev_st, ev_en, r'{\blur1.2}' + ' '.join(crisp)))
        dialogues.append((0, ev_st, ev_en, r'{\blur14}' + ' '.join(glow)))
dialogues.append((1, main_end+0.35, total-0.15, r'{\fad(150,120)\an5\pos(540,1230)\fnMontserrat Black\fs60\c&H2A84E8&\blur0.8}НАПИШИТЕ СЪЕМКА'))
dialogues.append((1, main_end+0.55, total-0.15, r'{\fad(150,120)\an5\pos(540,1325)\fnMontserrat Black\fs34\c&HDDDDDD&\blur0.8}видеопродакшн студия · Ставрополь'))
ass = """[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Soyuz Grotesk,76,&H00FFFFFF,&H00FFFFFF,&H00000000,&H78000000,0,0,0,0,100,100,1,0,1,0,4,2,40,40,470,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
for lay, st, en, tx in dialogues:
    ass += f"Dialogue: {lay},{fmt(st)},{fmt(en)},Sub,,0,0,0,,{tx}\n"
open('subs7.ass','w').write(ass)

inputs = ['-i','stage2.mp4']
idx = 1
def add(*args):
    global idx
    inputs.extend(args); i = idx; idx += 1; return i
I_VO0 = idx
for s in segs: add('-i', f'vo/{s}.mp3')
I_MUS = add('-i','audio/music3.mp3')
WH = ['audio/sfx_1492.mp3','audio/sfx_1489.mp3','audio/sfx_1486.mp3','audio/sfx_1714.mp3','audio/sfx_1490.mp3']
I_WH0 = idx
for w in WH: add('-i', w)
I_SHUT = add('-i','audio/sfx_1133.mp3')
I_NTF  = add('-i','audio/sfx_2354.mp3')
I_CRWD = add('-i','audio/fs_bakery.mp3')
T_CNT = starts['s3'] + 1.0
fc = ["[0:v]ass=subs7.ass:fontsdir=fonts[vout]"]
vo_in = []
for i,s in enumerate(segs):
    ms = int(starts[s]*1000)
    fc.append(f"[{I_VO0+i}:a]adelay={ms}|{ms}[a{i}]"); vo_in.append(f"[a{i}]")
fc.append("".join(vo_in) + f"amix=inputs={len(vo_in)}:normalize=0,dynaudnorm=f=250:g=15,asplit=2[vo][vosc]")
fc.append(f"[{I_MUS}:a]atrim=3:{10+total:.2f},asetpts=PTS-STARTPTS,volume=0.15,afade=t=in:d=1.0,afade=t=out:st={total-2.3:.2f}:d=2.2[musraw]")
fc.append("[musraw][vosc]sidechaincompress=threshold=0.03:ratio=5:attack=12:release=420:makeup=1[mus]")
sfx = []
flash_ts = bounds[1:-1] + [main_end]
wh_ts = [(0.32, 0)] + [(tb-0.25, 1+k%4) for k, tb in enumerate(flash_ts)]
for k, (tw, wi) in enumerate(wh_ts):
    ms = max(0, int(tw*1000))
    fc.append(f"[{I_WH0+wi}:a]atrim=0:0.9,adelay={ms}|{ms},volume=0.45[whd{k}]"); sfx.append(f"[whd{k}]")
ms = int(starts['s2']*1000)
fc.append(f"[{I_SHUT}:a]atrim=0:1.2,adelay={ms}|{ms},volume=0.5[shut]"); sfx.append("[shut]")
ms = int((T_CNT+1.35)*1000)
fc.append(f"[{I_NTF}:a]atrim=0:1.5,adelay={ms}|{ms},volume=0.45[ntf]"); sfx.append("[ntf]")
ms = int(bounds[3]*1000)
fc.append(f"[{I_CRWD}:a]atrim=4:11,volume=0.10,adelay={ms}|{ms}[crw]"); sfx.append("[crw]")
inputs += ['-i','audio/fs_crunch.mp3']
I_CRN = idx
ms = int((bounds[3]+5.4)*1000)
fc.append(f"[{I_CRN}:a]atrim=0.3:2.2,volume=0.5,adelay={ms}|{ms}[crn]"); sfx.append("[crn]")
fc.append("[vo][mus]" + "".join(sfx) + f"amix=inputs={2+len(sfx)}:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[aout]")
run(['ffmpeg','-y','-v','error'] + inputs + ['-filter_complex', ';'.join(fc),
     '-map','[vout]','-map','[aout]','-t',f'{total:.2f}',
     '-c:v','libx264','-preset','medium','-crf','22','-pix_fmt','yuv420p',
     '-c:a','aac','-b:a','192k','-movflags','+faststart','v001_bakery_v12.mp4'])
print('stage3 ok', probe('v001_bakery_v12.mp4'))
