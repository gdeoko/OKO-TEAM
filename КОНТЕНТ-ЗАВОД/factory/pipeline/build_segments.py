import subprocess,os
WD="/tmp/claude-0/-home-user-OKO-TEAM/f6f2aa4f-e22a-54d1-83e7-29eece9e291a/scratchpad/reel02"
FPS=30; DUR=2.9; W,H=1080,1920
# (clip, motion) — порядок по сюжету, движения РАЗНЫЕ, без повторов подряд
plan=[
 ("12750785","pushin"),   # хук: мама+ребёнок вечер
 ("7505756","panright"),  # «как дела» — ребёнок закрылся
 ("6565085","pullout"),   # переход к тёплому вопросу — чтение/разговор
 ("6952622","panup"),     # Q1 радость — руки/ребёнок
 ("9116017","driftin"),   # Q2 доброта — молитвенные руки
 ("6321589","panleft"),   # Q3 спасибо — семья вечер
 ("7494861","static"),    # наука — окно/ночь
 ("12750790","pandown"),  # сон
 ("5814437","pushin"),    # тепло дома
 ("12750787","panright"), # мама укрывает
 ("5895198","pullout"),   # близость
 ("7495061","driftin"),   # CTA — семья вечер
]
def motion(m):
    # исходник масштабируем с запасом 1.18, затем crop с движением по t в пределах DUR
    sc=1.18
    base=f"scale={int(W*sc)}:{int(H*sc)}:force_original_aspect_ratio=increase,crop={int(W*sc)}:{int(H*sc)}"
    ow,oh=int(W*sc),int(H*sc)
    mx=ow-W; my=oh-H
    z0,z1={"pushin":(1.0,1.10),"pullout":(1.10,1.0),"driftin":(1.03,1.09)}.get(m,(1.05,1.05))
    # реализуем через zoompan? нет — через crop с time-var. Проще: scale up + crop c выражением
    if m in("pushin","pullout","driftin"):
        # плавный зум через scale по t не идёт в фильтре crop; используем zoompan на кадрах
        d=int(DUR*FPS)
        zexpr={"pushin":f"1.0+0.10*on/{d}","pullout":f"1.10-0.10*on/{d}","driftin":f"1.03+0.06*on/{d}"}[m]
        return f"scale={W*4}:{H*4},zoompan=z='{zexpr}':d={d}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={W}x{H}:fps={FPS}"
    # панорамы: crop движется
    if m=="panright": xexpr=f"'(iw-{W})*t/{DUR}'"; yexpr=f"'(ih-{H})/2'"
    elif m=="panleft": xexpr=f"'(iw-{W})*(1-t/{DUR})'"; yexpr=f"'(ih-{H})/2'"
    elif m=="panup": xexpr=f"'(iw-{W})/2'"; yexpr=f"'(ih-{H})*(1-t/{DUR})'"
    elif m=="pandown": xexpr=f"'(iw-{W})/2'"; yexpr=f"'(ih-{H})*t/{DUR}'"
    else: xexpr=f"'(iw-{W})/2+30*sin(t)'"; yexpr=f"'(ih-{H})/2'"  # static drift
    return f"{base},crop={W}:{H}:x={xexpr}:y={yexpr}"
# грейд вечерний (тёплый low + cool тени, мягкий) — иной, чем warm ролика 01
GRADE="eq=contrast=1.06:saturation=1.08:gamma=0.98,colorbalance=rs=0.03:gs=0.01:bs=-0.04:rm=0.04:bm=-0.03:rh=0.05:bh=-0.02,vignette=PI/4.5"
for i,(cid,m) in enumerate(plan):
    vf=f"{motion(m)},{GRADE},format=yuv420p"
    out=f"{WD}/seg/s{i:02d}.mp4"
    cmd=["ffmpeg","-y","-i",f"{WD}/clips/{cid}.mp4","-t",str(DUR),"-an","-vf",vf,"-r",str(FPS),
         "-c:v","libx264","-preset","veryfast","-crf","20",out]
    r=subprocess.run(cmd,capture_output=True,text=True)
    ok=os.path.exists(out) and os.path.getsize(out)>1000
    print(f"s{i:02d} {cid} {m}: {'OK' if ok else 'FAIL '+r.stderr[-160:]}")
