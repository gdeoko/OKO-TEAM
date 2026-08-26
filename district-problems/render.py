# -*- coding: utf-8 -*-
import json, html
d = json.load(open("problems-map.json"))
cats = d["by_category"]; zones = d["by_zone"]; pts = d["points"]
maxc = cats[0]["count"]; maxz = zones[0]["count"]
e = html.escape

def top_addr(cat):
    rows=[]
    for p in pts:
        for pr in p["problems"]:
            if pr["category"]==cat: rows.append((p["address"],pr["count"]))
    rows.sort(key=lambda r:(-r[1],r[0]))
    return ", ".join(f"{a}" + (f" ({n})" if n>1 else "") for a,n in rows[:6])

cat_rows="".join(
 f'''<tr><td class="n">{i+1}</td><td class="c"><b>{e(c["category"])}</b>
 <div class="bar"><i style="width:{c["count"]/maxc*100:.1f}%"></i></div>
 <div class="where">{e(top_addr(c["category"]))}</div></td>
 <td class="v">{c["count"]}</td></tr>'''
 for i,c in enumerate(cats))

zone_rows="".join(
 f'''<tr><td class="c"><b>{e(z["zone"])}</b>
 <div class="bar"><i style="width:{z["count"]/maxz*100:.1f}%"></i></div></td>
 <td class="v">{z["count"]}</td></tr>'''
 for z in zones if z["zone"]!="Не указан")

addr_cards="".join(
 f'''<div class="card"><div class="ch"><span class="addr">{e(p["address"])}</span>
 <span class="cnt">{p["requests_total"]}</span></div>
 <div class="zone">{e(p["zone"])}</div>
 <ul>''' + "".join(
   f'<li><span class="tag">{e(pr["category"])}</span> <b>{pr["count"]}</b>'
   f'<div class="ex">{e(" · ".join(pr["examples"]))}</div></li>' for pr in p["problems"]
 ) + "</ul></div>"
 for p in pts)

HTML = f'''<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Проблемы жителей по адресам</title>
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif;
color:#111;background:#fff;padding:20px 16px 60px;max-width:820px;margin:0 auto;
-webkit-text-size-adjust:100%}}
h1{{font-size:26px;line-height:1.15;letter-spacing:-.02em;margin-bottom:8px}}
h2{{font-size:20px;margin:36px 0 12px;padding-bottom:8px;border-bottom:3px solid #111}}
.sub{{color:#555;font-size:14px;margin-bottom:20px}}
.kpis{{display:flex;gap:8px;margin:18px 0 4px}}
.kpi{{flex:1;background:#111;color:#fff;border-radius:12px;padding:12px 10px;text-align:center}}
.kpi b{{display:block;font-size:26px;line-height:1;color:#9AFF00}}
.kpi span{{font-size:11px;text-transform:uppercase;letter-spacing:.06em;opacity:.85}}
table{{width:100%;border-collapse:collapse;margin-top:4px}}
td{{padding:10px 4px;border-bottom:1px solid #eee;vertical-align:top}}
td.n{{width:26px;color:#999;font-size:13px;padding-top:12px}}
td.v{{width:48px;text-align:right;font-size:20px;font-weight:700;white-space:nowrap}}
.bar{{height:6px;background:#f0f0f0;border-radius:3px;margin:6px 0 5px;overflow:hidden}}
.bar i{{display:block;height:100%;background:#9AFF00;border-radius:3px}}
.where{{font-size:12.5px;color:#666;line-height:1.35}}
.note{{background:#f7f7f5;border-left:4px solid #9AFF00;padding:12px 14px;border-radius:0 8px 8px 0;
font-size:14px;margin:14px 0}}
ul.ins{{margin:10px 0 0 18px}} ul.ins li{{margin-bottom:9px;font-size:15px}}
.card{{border:1px solid #e6e6e6;border-radius:12px;padding:12px 14px;margin-bottom:10px}}
.ch{{display:flex;justify-content:space-between;align-items:baseline;gap:10px}}
.addr{{font-weight:700;font-size:16px}}
.cnt{{background:#111;color:#9AFF00;border-radius:20px;padding:2px 10px;font-size:13px;font-weight:700}}
.zone{{font-size:12px;color:#888;text-transform:uppercase;letter-spacing:.05em;margin:2px 0 8px}}
.card ul{{list-style:none}}
.card li{{padding:6px 0;border-top:1px dashed #eee}}
.tag{{font-weight:600}}
.ex{{font-size:13px;color:#666;margin-top:2px}}
@media print{{body{{padding:0}} .card{{break-inside:avoid}} h2{{break-after:avoid}}}}
</style></head><body>

<h1>Проблемы жителей по адресам</h1>
<div class="sub">Обход, поселение Сосенское и соседние территории НАО. Персональные данные (ФИО, телефоны) исключены — в карту идут только проблема, адрес и количество заявок.</div>

<div class="kpis">
<div class="kpi"><b>{d["totals"]["requests"]}</b><span>заявок</span></div>
<div class="kpi"><b>{d["totals"]["addresses"]}</b><span>адресов</span></div>
<div class="kpi"><b>{d["totals"]["categories"]}</b><span>категорий</span></div>
</div>
<div class="note">Дубли убраны: блок по Скандинавскому и Липовому в исходном списке был вставлен дважды (те же люди и телефоны) — учтён один раз. Одна заявка может относиться сразу к нескольким категориям («крысы и парковки»), поэтому сумма по категориям больше числа заявок.</div>

<h2>Проблемы по частоте</h2>
<table>{cat_rows}</table>

<h2>Где горит: по территориям</h2>
<table>{zone_rows}</table>

<h2>Главное для повестки</h2>
<ul class="ins">
<li><b>Парковки — проблема номер один с огромным отрывом:</b> 47 заявок из 175, четверть всех обращений, и почти на каждом адресе.</li>
<li><b>Липовый парк, 4к1 — готовый адресный кейс по УК:</b> ДУ МКД, потопы, плесень, лифты, невывоз мусора, жителям не дают сменить управляющую компанию.</li>
<li><b>Крысы — следствие мусора:</b> адреса по крысам и по невывозу мусора совпадают (Липовый парк 8, 9, 10, 4к1).</li>
<li><b>Запахи локализованы жёстко:</b> бульвар Веласкеса 1, 3/2, 5к2, 6 — Фуд Сити и промзона; отдельно Фитаревская 15 и 19 — канализация и ливнёвка.</li>
<li><b>Дубы — единая тема всей Коммунарки:</b> 9 адресов, формулировка «вырубка дубов-аборигенов без ухода за оставшимися насаждениями».</li>
<li><b>Питбайки и ночные гонки — 18 заявок вместе:</b> вечерний шум по Липовому парку и Скандинавскому бульвару.</li>
<li><b>Лифты — точечно, но остро:</b> Липовый парк 2 (застревают на два часа), 4к1, 8к1, Фитаревская 17, Лазурная 14.</li>
</ul>

<h2>Все адреса ({len(pts)})</h2>
<div class="sub">Отсортировано по количеству заявок. Это и есть содержимое точек на карте.</div>
{addr_cards}

</body></html>'''
open("Справка_проблемы_по_адресам.html","w").write(HTML)
print("ok", len(HTML))
