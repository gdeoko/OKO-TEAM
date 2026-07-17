# -*- coding: utf-8 -*- Выбор следующей темы из очереди. Печатает "SPECID N LOWFLAG",
# пишет current_spec.json. n = state.count (индекс ротации разнообразия). Никогда не падает:
# если все темы использованы — циклит с начала (свежие кадры + ротация fx всё равно уникальны).
import json, os, sys
D=os.path.dirname(os.path.abspath(__file__))
queue=json.load(open(f'{D}/queue.json'))
state=json.load(open(f'{D}/state.json')) if os.path.exists(f'{D}/state.json') else {'used':[],'count':0,'last_date':None}
used=state.get('used',[]); count=state.get('count',0)
unused=[s for s in queue if s['id'] not in used]
low = len(unused) <= 3
if unused: spec=unused[0]
else:
    # все темы пройдены — берём наименее недавнюю (первую в очереди), сбрасываем цикл
    spec=queue[count % len(queue)]
json.dump(spec, open(f'{D}/current_spec.json','w'), ensure_ascii=False)
print(f"{spec['id']} {count} {'LOW' if low else 'OK'}")
