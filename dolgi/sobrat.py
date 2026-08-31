# -*- coding: utf-8 -*-
"""Собирает страницу okoteam.top/dolg из dolgi.json.
Запуск: python3 sobrat.py   → пишет index.php в /var/www/okoteam/dolg/"""
import json, os, html, datetime

BAZA = "/opt/oko-agents/data_runtime/dolgi"
VYHOD = "/var/www/okoteam/dolg/index.php"
ZAPAS = os.path.join(BAZA, "index.php")

STATUSY = {
 "rekvizity": ("РЕКВИЗИТЫ ЕСТЬ",  "t-deal", "deal"),
 "melkiy":    ("МЕЛКИЙ · ЗАКРЫТЬ", "t-wait", ""),
 "protuhlo":  ("УСЛОВИЕ ПРОТУХЛО", "t-hot",  "hot"),
 "sud":       ("СУД",              "t-hot",  "hot"),
 "molchat":   ("МОЛЧАТ",           "t-warn", "warn"),
 "zakryt":    ("ЗАКРЫТ",           "t-deal", "deal"),
 "oplachen":  ("ОПЛАЧЕН · ЖДЁМ СПРАВКУ", "t-warn", "warn"),
}

def rub(n):
    return f"{n:,}".replace(",", " ") + " ₽"

def e(s):
    return html.escape(str(s or ""))

def karta(k):
    tag, tcls, ccls = STATUSY.get(k.get("status"), ("", "t-wait", ""))
    o = [f'<div class="card {ccls}" id="{e(k["id"])}">']
    o.append(f'<div class="top"><span class="name">{e(k["name"])}</span>'
             f'<span class="tag {tcls}">{tag}</span></div>')
    o.append('<div class="nums">')
    o.append(f'<div><b class="strike">{rub(k["trebuyut"])}</b><span>требуют</span></div>')
    if k.get("telo"):
        o.append(f'<div><b>{rub(k["telo"])}</b><span>тело долга</span></div>')
    if k.get("nasha"):
        o.append(f'<div class="offer"><b>{rub(k["nasha"])}</b><span>наша позиция</span></div>')
    o.append('</div>')
    o.append(f'<div class="meta">{e(k["dogovor"])}</div>')
    kont = []
    if k.get("pochta"):   kont.append("почта " + e(k["pochta"]))
    if k.get("telefon"):  kont.append(e(k["telefon"]))
    if k.get("lk"):       kont.append(f'<a href="{e(k["lk"])}" target="_blank">личный кабинет</a>')
    if kont:
        o.append('<div class="meta">' + " &middot; ".join(kont) + '</div>')
    if k.get("rekvizity"):
        o.append('<div class="rekv">' + e(k["rekvizity"]) + '</div>')
        o.append('<button class="copy" data-t="' + e(k["rekvizity"]) + '">Скопировать реквизиты</button>')
    else:
        o.append('<div class="net">Реквизитов нет. Запрошены вместе с подтверждением скидки — '
                 'как придут, встанут сюда сами.</div>')
    if k.get("oplata"):
        o.append(f'<a class="pay" href="{e(k["oplata"])}" target="_blank">Оплатить {rub(k.get("nasha") or k["trebuyut"])}</a>')
    if k.get("kommentariy"):
        o.append(f'<div class="note">{e(k["kommentariy"])}</div>')
    o.append('<div class="spravka"><b>Справка о закрытии обязательна.</b> После оплаты требуем на почту '
             'официальную справку об отсутствии задолженности с печатью и подписью: номер договора, '
             'дата закрытия, формулировка «обязательства исполнены в полном объёме, претензий нет». '
             'Скан-копия по почте, оригинал по адресу. Без неё долг не считается закрытым.</div>')
    o.append(f'<div class="akt">данные актуальны на {e(k.get("aktualno"))}</div>')
    o.append('</div>')
    return "\n".join(o)


def sobrat():
    d = json.load(open(os.path.join(BAZA, "dolgi.json"), encoding="utf-8"))
    ks = d["kreditory"]
    vsego = sum(k["trebuyut"] for k in ks)
    nasha = sum((k.get("nasha") or 0) for k in ks if k.get("nasha"))
    melkie = [k for k in ks if k["status"] in ("melkiy", "rekvizity")]
    summa_melkih = sum(k["nasha"] for k in melkie)
    trebuyut_melkih = sum(k["trebuyut"] for k in melkie)

    poryadok = ["rekvizity", "melkiy", "protuhlo", "sud", "molchat", "oplachen", "zakryt"]
    ks_sort = sorted(ks, key=lambda k: (poryadok.index(k["status"]) if k["status"] in poryadok else 9,
                                        k["trebuyut"]))

    pisma = d.get("pisma", [])
    now = datetime.datetime.now().strftime("%d.%m.%Y %H:%M")

    B = []
    B.append(f'''<h1>Долги · сводка</h1>
<div class="sub">{e(d["vladelec"])} &middot; страница обновляется сама &middot; последняя сборка {now} МСК</div>

<div class="stats">
<div class="stat"><b>{len(ks)}</b><span>кредиторов</span></div>
<div class="stat"><b>{rub(vsego)}</b><span>требуют всего</span></div>
<div class="stat"><b>{rub(summa_melkih)}</b><span>закрывает {len(melkie)} мелких</span></div>
<div class="stat"><b>{rub(trebuyut_melkih - summa_melkih)}</b><span>экономия на мелких</span></div>
</div>''')

    if pisma:
        B.append('<h2>Новые письма</h2>')
        for p in pisma[:20]:
            B.append(f'<div class="pismo"><b>{e(p.get("ot"))}</b> &middot; {e(p.get("data"))}'
                     f'<div class="meta">{e(p.get("tema"))}</div>'
                     f'<div class="meta">{e(p.get("kusok"))}</div></div>')
    else:
        B.append('<h2>Новые письма</h2><div class="card"><div class="meta">'
                 'С последней проверки новых писем от кредиторов не приходило. '
                 'Почта опрашивается автоматически.</div></div>')

    B.append('<h2>Кредиторы</h2>')
    for k in ks_sort:
        B.append(karta(k))

    B.append('<h2>Банки — отдельный трек, реструктуризация, не дисконт</h2><div class="card"><table class="banks">')
    for b in d.get("banki", []):
        nm = f'<b>{e(b["name"])}</b>' + (f' — {e(b["note"])}' if b.get("note") else "")
        cl = f' class="{e(b["cvet"])}"' if b.get("cvet") else ""
        B.append(f'<tr><td>{nm}</td><td{cl}>{e(b["sum"])}</td></tr>')
    B.append('</table><div class="note">По банкам дисконта не бывает, работает только '
             'реструктуризация или кредитные каникулы. ВТБ первый: там залог, машину забирают '
             'быстрее, чем идут суды по МФО.</div></div>')

    B.append('<h2>Как это работает</h2>')
    B.append('''<div class="step"><b>1.</b> Открываешь карточку, жмёшь «Оплатить» или копируешь реквизиты и платишь.</div>
<div class="step"><b>2.</b> Кидаешь мне чек. Я отправляю его кредитору и требую справку о закрытии.</div>
<div class="step"><b>3.</b> Справка приходит тебе на почту, я вижу её при опросе и перевожу карточку в «закрыт».</div>
<div class="step"><b>4.</b> Оплаченное без справки висит отдельно и не забывается: МФО обязаны выдать
документ, и без него закрытие потом не доказать.</div>''')

    B.append('<h2>История</h2><div class="card"><div class="hist">')
    for s in d.get("sobytiya", []):
        B.append(f'<div><b>{e(s["d"])}</b> {e(s["t"])}</div>')
    B.append('</div></div>')

    telo = "\n".join(B)

    php = '''<?php
// Страница по долгам. Данные личные, поэтому вход по ключу:
// первый заход okoteam.top/dolg/?k=КЛЮЧ — дальше кука на год.
$KEY = trim(@file_get_contents(__DIR__ . '/.kluch'));
$ok = false;
if ($KEY !== '') {
  if (isset($_GET['k']) && hash_equals($KEY, (string)$_GET['k'])) {
    setcookie('dolg', $KEY, time() + 31536000, '/dolg', '', true, true);
    $ok = true;
  } elseif (isset($_COOKIE['dolg']) && hash_equals($KEY, (string)$_COOKIE['dolg'])) {
    $ok = true;
  }
}
if (!$ok) { http_response_code(404); exit('Not Found'); }
header('Content-Type: text/html; charset=utf-8');
header('X-Robots-Tag: noindex, nofollow', true);
header('Cache-Control: no-store');
?>
<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Долги · сводка</title>
<style>
:root{--bg:#050505;--card:#0d0d0d;--line:#1e1e1e;--lime:#9AFF00;--txt:#e8e8e8;--dim:#8a8a8a;--red:#ff5c5c;--amber:#ffc04a;--blue:#6db3ff}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--bg);color:var(--txt);font:15px/1.5 'Onest',-apple-system,Segoe UI,Roboto,sans-serif;padding:20px 14px 60px}
h1{font-size:22px;letter-spacing:.5px;margin-bottom:4px}
.sub{color:var(--dim);font-size:13px;margin-bottom:18px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:22px}
.stat{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px}
.stat b{display:block;font-size:20px;color:var(--lime)}
.stat span{font-size:12px;color:var(--dim)}
h2{font-size:15px;color:var(--lime);margin:26px 0 10px;text-transform:uppercase;letter-spacing:1px}
.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:16px;margin-bottom:12px}
.card.hot{border-color:var(--red)}
.card.deal{border-color:var(--lime)}
.card.warn{border-color:var(--amber)}
.top{display:flex;justify-content:space-between;gap:10px;align-items:baseline;flex-wrap:wrap}
.name{font-weight:700;font-size:16px}
.tag{font-size:11px;padding:3px 10px;border-radius:20px;white-space:nowrap}
.t-deal{background:rgba(154,255,0,.12);color:var(--lime)}
.t-wait{background:rgba(109,179,255,.12);color:var(--blue)}
.t-hot{background:rgba(255,92,92,.14);color:var(--red)}
.t-warn{background:rgba(255,192,74,.14);color:var(--amber)}
.nums{display:flex;gap:18px;margin:10px 0;flex-wrap:wrap}
.nums div b{display:block;font-size:17px}
.nums div span{font-size:11px;color:var(--dim);text-transform:uppercase}
.strike{color:var(--dim);text-decoration:line-through}
.offer b{color:var(--lime)}
.meta{font-size:13px;color:var(--dim);margin-top:6px}
.meta a{color:var(--blue);text-decoration:none;word-break:break-all}
.rekv{background:#080808;border:1px solid var(--line);border-left:2px solid var(--lime);border-radius:10px;padding:10px 12px;margin-top:10px;font:12px/1.7 ui-monospace,SFMono-Regular,Menlo,monospace;color:#cfcfcf;white-space:pre-wrap;word-break:break-all}
.net{background:#080808;border:1px dashed var(--line);border-radius:10px;padding:10px 12px;margin-top:10px;font-size:12px;color:var(--dim)}
.copy{margin-top:8px;background:transparent;border:1px solid var(--lime);color:var(--lime);padding:8px 14px;border-radius:10px;font-size:13px;cursor:pointer;font-family:inherit}
.copy:active{background:rgba(154,255,0,.15)}
.pay{display:inline-block;margin-top:10px;background:var(--lime);color:#000;font-weight:700;padding:10px 18px;border-radius:12px;text-decoration:none;font-size:14px}
.note{font-size:13px;color:var(--amber);margin-top:8px}
.spravka{font-size:12px;color:var(--blue);margin-top:10px;border-top:1px solid var(--line);padding-top:8px;line-height:1.6}
.spravka b{color:var(--blue)}
.akt{font-size:11px;color:#5a5a5a;margin-top:6px}
.pismo{background:var(--card);border:1px solid var(--lime);border-radius:14px;padding:12px 14px;margin-bottom:10px;font-size:14px}
.step{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:10px;font-size:14px}
.step b{color:var(--lime)}
.hist div{font-size:13px;color:var(--dim);padding:5px 0;border-bottom:1px solid var(--line)}
.hist div:last-child{border-bottom:none}
.hist b{color:var(--lime)}
table.banks{width:100%;border-collapse:collapse;font-size:14px}
table.banks td{padding:8px 6px;border-bottom:1px solid var(--line)}
table.banks td:last-child{text-align:right}
.red{color:var(--red)}.amber{color:var(--amber)}.lime{color:var(--lime)}
</style>
</head>
<body>
__TELO__
<script>
document.querySelectorAll('.copy').forEach(function(b){
  b.addEventListener('click', function(){
    navigator.clipboard.writeText(b.dataset.t).then(function(){
      var s=b.textContent; b.textContent='Скопировано';
      setTimeout(function(){b.textContent=s;},1500);
    });
  });
});
</script>
</body>
</html>
'''
    php = php.replace("__TELO__", telo)
    open(ZAPAS, "w", encoding="utf-8").write(php)
    try:
        os.makedirs(os.path.dirname(VYHOD), exist_ok=True)
        open(VYHOD, "w", encoding="utf-8").write(php)
        print("страница выложена:", VYHOD)
    except Exception as ex:
        print("в корень сайта не записалось (" + type(ex).__name__ + "), лежит запасом:", ZAPAS)
    print("кредиторов:", len(ks), "| требуют:", vsego, "| мелкие закрываются за:", summa_melkih)

if __name__ == "__main__":
    sobrat()
