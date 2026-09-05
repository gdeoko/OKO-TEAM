# -*- coding: utf-8 -*-
# Патчит футаж на надёжные запросы (техника+логистика, без мусора), вставляет уникальную музыку.
import json, os, subprocess
ROOT="/home/user/OKO-TEAM/oko-app/factory"; OUT=ROOT+"/specs"
FOOT={
 "R1":["atv quad bike riding","off road buggy desert","utility vehicle off road","quad bike sand dunes",
       "cargo container ship port","semi truck highway aerial","container terminal crane","4x4 offroad mud trail",
       "freight truck road","desert racing buggy","warehouse forklift logistics","dune buggy riding"],
 "R2":["container terminal crane","cargo container ship port","warehouse forklift logistics","semi truck highway aerial",
       "freight truck loading dock","atv quad bike riding","utility vehicle off road","container yard aerial",
       "truck driver cabin road","cargo containers port","off road buggy desert","warehouse boxes logistics"],
 "R3":["semi truck highway aerial","cargo container ship ocean","freight truck convoy road","container terminal crane",
       "atv quad bike riding","utility vehicle off road","truck highway night","snowmobile winter snow",
       "desert buggy riding","offroad 4x4 trail","warehouse forklift logistics","container yard aerial"],
 "R4":["utility vehicle off road","atv quad bike riding","snowmobile winter snow","jet ski water riding",
       "off road buggy desert","4x4 offroad mud trail","quad bike sand dunes","desert racing buggy",
       "cargo container ship port","semi truck highway aerial","container terminal crane","offroad vehicle trail"],
 "R5":["atv quad bike riding","utility vehicle off road","snowmobile winter snow","jet ski water riding",
       "off road buggy desert","quad bike sand dunes","4x4 offroad mud trail","desert racing buggy",
       "cargo container ship port","semi truck highway aerial","container terminal crane","dune buggy riding"],
}
BUCKET={"R1":"viral","R2":"useful","R3":"useful","R4":"sales","R5":"viral"}
for name in ["R1","R2","R3","R4","R5"]:
    p=f"{OUT}/{name}.json"; d=json.load(open(p))
    d["footage"]=FOOT[name]
    # уникальная музыка
    r=subprocess.run(["python3",f"{ROOT}/pipeline/pick_music.py",BUCKET[name],name.lower()],
                     capture_output=True,text=True,env={**os.environ,"FACTORY_ROOT":ROOT})
    mt=ms=None
    for l in r.stdout.splitlines():
        if l.startswith("MUSIC_TRACK="): mt=l.split("=",1)[1].strip()
        if l.startswith("MUSIC_SEED="): ms=int(l.split("=",1)[1].strip())
    d["music"]=mt; d["seed"]=ms or 300
    json.dump(d,open(p,"w"),ensure_ascii=False,indent=1)
    print(name,"music",os.path.basename(mt or "?"),"seed",ms)
