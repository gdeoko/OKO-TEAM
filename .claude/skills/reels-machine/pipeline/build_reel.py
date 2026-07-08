#!/usr/bin/env python3
"""
Reels Machine — оркестратор сборки ролика (3 этапа ffmpeg).
Портируемый каркас: пути к ассетам берутся из reel.json проекта, а не хардкодятся.

Это ЭТАЛОН-СКЕЛЕТ. Под каждый ролик агент готовит:
  - vo/s1..sN.mp3 + .json (edge-tts, шаг озвучки)
  - shots: список (clip_path, seek, dur) — стоки/секвенции
  - overlays: список (png_dir_or_pattern, start_time, [scale], [pos]) — моушн/инфографика/3D
  - transitions: список (name, at_bound) — gl-transitions между сценами
  - audio: music, sfx-хиты
Затем вызывает три стадии. Тайминги окон = паузы между сегментами озвучки.

КРИТИЧНЫЕ ПРАВИЛА (проверены болью):
  * -loop 1 картинкам ВСЕГДА -framerate 30 и конечный -t (иначе 25fps ломает framesync)
  * блик/лики: blend=screen ТОЛЬКО через format=gbrp, иначе кадр фиолетовый
  * оверлеи не должны накладываться по времени — разносить, проверять расписание
  * точный QC-сик: ffmpeg -i FILE -ss T (а не -ss до -i — там keyframe-ложь)
  * PNG-секвенции входят с -framerate 30 -i dir/%03d.png, накладываются setpts=PTS+T/TB
"""
import json, subprocess, sys, os

def probe(p):
    return float(subprocess.check_output(
        ['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0', p]).strip())

def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        sys.stderr.write(r.stderr[-2500:]); raise SystemExit(1)

def timeline(vo_dir, segs, cover=0.30, lead2=0.45, gap=0.35, tail=0.9, endcard=2.2):
    """Тайминги окон сцен из длительностей озвучки."""
    durs = {s: probe(f'{vo_dir}/{s}.mp3') for s in segs}
    starts, t = {}, cover + lead2
    for s in segs:
        starts[s] = t; t += durs[s] + gap
    main_end = t - gap + tail
    total = main_end + endcard
    bounds = [cover]
    for s in segs[:-1]:
        bounds.append(starts[s] + durs[s] + gap / 2)
    bounds.append(main_end)
    windows = [(bounds[i], bounds[i + 1]) for i in range(len(segs))]
    return dict(durs=durs, starts=starts, main_end=main_end, total=total,
                bounds=bounds, windows=windows,
                cover=cover, endcard=endcard)

# --- STAGE 1: шоты + движение + грейд + вотермарк + прогресс-бар ---
# 4 режима движения чередуются: zoom-in / zoom-out / pan-right / pan-left
ZOOM_MODES = [
    "z='min(1.03+0.0024*on,1.20)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'",
    "z='max(1.20-0.0024*on,1.03)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'",
    "z=1.13:x='(iw-iw/zoom)*min(on/{fr},1)':y='ih/2-(ih/zoom/2)'",
    "z=1.13:x='(iw-iw/zoom)*(1-min(on/{fr},1))':y='ih/2-(ih/zoom/2)'",
]

# грейды под ниши — выбирать по смыслу (см. reference/GRADES.md)
GRADES = {
    'warm_cine':  "eq=contrast=1.06:saturation=1.12:brightness=0.01,colorbalance=rs=.03:bs=-.02,vignette=PI/5,noise=alls=4:allf=t",
    'teal_orange':"curves=r='0/0.05 0.5/0.52 1/1':b='0/0 0.5/0.44 1/0.92',eq=saturation=1.3:contrast=1.1,vignette=PI/4.6",
    'clean_ad':   "eq=contrast=1.05:saturation=1.1:brightness=0.008,colorbalance=rs=.02:bs=.015,vignette=PI/4.8,noise=alls=3:allf=t",
    'flower_soft':"eq=contrast=1.045:saturation=1.16:brightness=0.012,colorbalance=rs=.03:bs=-.02:rm=.015,vignette=PI/5,noise=alls=4:allf=t",
    'noir_bw':    "hue=s=0,eq=contrast=1.35:brightness=-0.03,noise=alls=12:allf=t,vignette=PI/4.2",
}

def stage1(shots, tl, cover_jpg, logo_png, out='stage1.mp4', grade='clean_ad',
           watermark=True, progress_bar=True, brand_bar='0xe8842a'):
    """shots: [(clip_or_SEQ, seek, dur)]. SEQ:<dir> => PNG-секвенция как шот."""
    N = len(shots); total = tl['total']; main_end = tl['main_end']; endcard = tl['endcard']
    inputs = []
    for cid, ss, d in shots:
        if isinstance(cid, str) and cid.startswith('SEQ:'):
            inputs += ['-framerate','30','-i', f'{cid[4:]}/%03d.png']
        else:
            inputs += ['-ss', f'{ss:.2f}', '-t', f'{d+0.3:.2f}', '-i', cid]
    inputs += ['-loop','1','-framerate','30','-t',f'{tl["cover"]:.2f}','-i', cover_jpg]
    inputs += ['-loop','1','-framerate','30','-t','2.5','-i', logo_png]
    fc = []
    for i,(cid, ss, d) in enumerate(shots):
        if isinstance(cid, str) and cid.startswith('SEQ:'):
            fc.append(f"[{i}:v]trim=0:{d:.3f},setpts=PTS-STARTPTS,scale=1080:1920,fps=30,setsar=1[v{i}]")
            continue
        fr = max(1, int(d*30))
        zp = ZOOM_MODES[i % 4].format(fr=fr)
        glitch = ",chromashift=crh=-9:cbh=9:enable='lt(t,0.10)'" if (i and i % 2 == 0) else ""
        fc.append(f"[{i}:v]trim=0:{d:.3f},setpts=PTS-STARTPTS,"
                  f"scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30,"
                  f"zoompan={zp}:d=1:s=1080x1920:fps=30,setsar=1{glitch}[v{i}]")
    fc.append(f"[{N}:v]scale=1080:1920,fps=30,setsar=1[vcov]")
    fc.append(f"color=c=0x0d0d0d:s=1080x1920:r=30:d={endcard}[cbg]")
    fc.append(f"[{N+1}:v]split=2[lga][lgb]")
    fc.append("[lga]scale=560:-1,fps=30[lgbig]")
    fc.append("[cbg][lgbig]overlay=(W-w)/2:600:shortest=1[card]")
    fc.append("[vcov]" + "".join(f"[v{i}]" for i in range(N)) + "[card]concat=n=" + str(N+2) + ":v=1:a=0[allv]")
    if watermark:
        fc.append("[lgb]scale=150:-1,fps=30,format=rgba,colorchannelmixer=aa=0.85[lgsm]")
        fc.append(f"[allv][lgsm]overlay=W-w-40:52:enable='between(t,{tl['cover']},{main_end:.2f})':eof_action=repeat[wm]")
    else:
        fc.append("[allv]null[wm]")
    if progress_bar:
        fc.append(f"color=c={brand_bar}:s=1080x8:r=30:d={total:.2f},format=rgba,colorchannelmixer=aa=0.9[bar]")
        fc.append(f"[wm][bar]overlay=y=0:x='-W+W*min(t/{main_end:.2f},1)':shortest=0[pb]")
    else:
        fc.append("[wm]null[pb]")
    fc.append(f"[pb]{GRADES[grade]}[vout]")
    run(['ffmpeg','-y','-v','error'] + inputs + ['-filter_complex', ';'.join(fc),
         '-map','[vout]','-t',f'{total:.2f}','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p', out])
    print('stage1 ok', probe(out))

# --- STAGE 2: gl-переходы + оверлеи (строго без наложений по времени) ---
def make_gl_transitions(stage1_mp4, gl_list, bounds, gln=18, runner='motion/transitions_gl.cjs'):
    """gl_list: [(transition_name, out_dir)] по границам сцен bounds[1:]."""
    pairs = []
    for (name, out), tb in zip(gl_list, bounds[1:]):
        fa, fb = f'{out}_A.png', f'{out}_B.png'
        run(['ffmpeg','-y','-v','error','-i',stage1_mp4,'-ss',f'{tb-(gln/2)/30-0.02:.3f}','-frames:v','1',fa])
        run(['ffmpeg','-y','-v','error','-i',stage1_mp4,'-ss',f'{tb+(gln/2)/30+0.02:.3f}','-frames:v','1',fb])
        pairs.append({'transition': name, 'from': fa, 'to': fb, 'out': out, 'frames': gln})
    json.dump(pairs, open('pairs.json','w'))
    r = subprocess.run(['node', runner, 'pairs.json'], capture_output=True, text=True)
    print(r.stdout[-300:])
    for _, out in gl_list:
        assert os.path.exists(f'{out}/{gln-1:03d}.png'), f'{out} transition failed'

if __name__ == '__main__':
    print(__doc__)
