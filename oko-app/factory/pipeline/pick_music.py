#!/usr/bin/env python3
# pick_music.py <bucket> <theme-slug>
# Выбирает УНИКАЛЬНЫЙ музыкальный трек под ролик (по бакету/настроению) БЕЗ повторов.
# Печатает: MUSIC_TRACK=<path> и MUSIC_SEED=<int>. Реестр использованного — music/used_music.json.
# Пул: music/*.mp3 + music/manifest.json {"file":{"mood":[...], "energy":0-1, "bpm":n}}.
# bucket: viral|useful|sales -> целевое настроение. Дедуп: не повторять, пока пул не исчерпан.
import os,sys,json,glob,hashlib
ROOT=os.environ.get("FACTORY_ROOT", os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MUS=os.path.join(ROOT,"music")
bucket=(sys.argv[1] if len(sys.argv)>1 else "viral").lower()
theme=(sys.argv[2] if len(sys.argv)>2 else "reel")
# целевые настроения по бакету
WANT={"viral":["energetic","driving","hype","tension","bold"],
      "useful":["confident","clean","focused","corporate","steady"],
      "sales":["uplifting","warm","confident","hopeful","bold"]}.get(bucket,["driving"])
man_path=os.path.join(MUS,"manifest.json")
manifest=json.load(open(man_path)) if os.path.exists(man_path) else {}
tracks=sorted(glob.glob(os.path.join(MUS,"*.mp3")))
if not tracks:
    sys.stderr.write("PICK_MUSIC: пул music/ ПУСТ — добавь треки (см. RULES: источник музыки).\n")
    sys.exit(3)
used_path=os.path.join(MUS,"used_music.json")
used=json.load(open(used_path)) if os.path.exists(used_path) else []
used_set=set(used)
# кандидаты = ещё не использованные; если все использованы — сбросить (пул исчерпан)
fresh=[t for t in tracks if os.path.basename(t) not in used_set]
if not fresh:
    used=[]; used_set=set(); fresh=tracks[:]
# ранжируем по совпадению настроения с бакетом
def score(t):
    meta=manifest.get(os.path.basename(t),{})
    moods=[m.lower() for m in meta.get("mood",[])]
    s=sum(1 for w in WANT if w in moods)
    return s
fresh.sort(key=lambda t:(-score(t), os.path.basename(t)))
pick=fresh[0]
seed=int(hashlib.md5((os.path.basename(pick)+theme).encode()).hexdigest(),16)%997
used.append(os.path.basename(pick)); json.dump(used,open(used_path,"w"),ensure_ascii=False,indent=0)
print(f"MUSIC_TRACK={pick}")
print(f"MUSIC_SEED={seed}")
sys.stderr.write(f"[pick_music] bucket={bucket} -> {os.path.basename(pick)} (moods {manifest.get(os.path.basename(pick),{}).get('mood',[])}), used {len(used)}/{len(tracks)}\n")
