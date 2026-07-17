# -*- coding: utf-8 -*- После успешной доставки: дописать реестры, used_ids, обновить state.
#   python3 register.py <DAY_ABS_DIR> <SPECID> <DATE>
import json, os, sys, datetime
D=os.path.dirname(os.path.abspath(__file__))
DAY, SPECID, DATE = sys.argv[1], sys.argv[2], sys.argv[3]
ROOT=os.path.dirname(os.path.dirname(D))
REF=f'{ROOT}/.claude/skills/reels-machine/reference'
spec=json.load(open(f'{D}/current_spec.json'))
new_ids=json.load(open(f'{DAY}/new_ids.json')) if os.path.exists(f'{DAY}/new_ids.json') else []
# used_ids
uidp=f'{D}/used_ids.json'; used_ids=json.load(open(uidp)) if os.path.exists(uidp) else []
used_ids=sorted(set(used_ids)|set(new_ids)); json.dump(used_ids, open(uidp,'w'))
# USED_FOOTAGE
with open(f'{REF}/USED_FOOTAGE.md','a') as f:
    f.write(f"\n## Автопилот {DATE} · {SPECID} — {len(new_ids)} уникальных Pexels\n")
    f.write("| дата | ролик | ист | id |\n|------|-------|-----|----|\n")
    for i in new_ids: f.write(f"| {DATE} | auto·{SPECID} | pex | {i} |\n")
# USED_ANIM
with open(f'{REF}/USED_ANIM.md','a') as f:
    f.write(f"\n## Автопилот {DATE} · {SPECID} ({spec.get('format','')}) — голос Silero eugene, обложка cover_flux, "
            f"fx/gl/3d/grade авто-ротацией по индексу; тема «{spec.get('segs',{}).get('s1','')[:50]}».\n")
# state
sp=f'{D}/state.json'; state=json.load(open(sp)) if os.path.exists(sp) else {'used':[],'count':0,'last_date':None}
if SPECID not in state['used']: state['used'].append(SPECID)
state['count']=state.get('count',0)+1; state['last_date']=DATE
json.dump(state, open(sp,'w'), ensure_ascii=False, indent=1)
print('registered', SPECID, 'count', state['count'], 'used_ids', len(used_ids))
