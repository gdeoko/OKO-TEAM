# -*- coding: utf-8 -*-
# Генератор страницы дня DIESEL для okoteam.top/diesel: 5 роликов+описания, пост, карусель.
# Бренд клиента: амбер #EA5920 + near-black. Без OKO-лайма, без панды. Витрина прогресса (не лента клиента).
import os, shutil, html, glob
ROOT="/home/user/OKO-TEAM/oko-app/factory"
OUT=ROOT+"/dieselpage"; os.makedirs(OUT+"/media", exist_ok=True)

REELS=[
 ("R1","виральный · эмоция","Тридцать пять дней ждал. Вот оно.",
  "Показываем реальный момент получения техники из Китая под ключ - приезжает целой, без царапин, таможня уже пройдена. Снимаем страх «довезут ли, целым ли».",
  "напишите свой город в личку - скажем срок доставки именно до вас. Сайт dieselcompany.pro",
  "техника из китая под ключ, квадроцикл из китая, доставка техники из китая в москву, как привозят технику из китая, распаковка техники из китая, квадроцикл под ключ, техника из китая целая, доставка квадроцикла из китая, техника из китая отзывы, привезти квадроцикл из китая, utv из китая, снегоход из китая, багги из китая, гидроцикл из китая, доставка через монголию, техника из китая напрямую, мототехника из китая, квадроцикл из китая цена, сколько идёт техника из китая, растаможка в цене"),
 ("R2","новость · шок-факт","Скрытых доплат на таможне ноль.",
  "Разрушаем главный миф - растаможка это не второй счёт через месяц, а часть фикс-цены. Разбираем, из чего складывается цена под ключ и почему сюрпризов нет.",
  "напишите город - посчитаем цену под ключ до вас. Сайт dieselcompany.pro",
  "растаможка техники из китая, таможня квадроцикл из китая, доплата на таможне техника, скрытые платежи китай доставка, цена под ключ из китая, три доллара за кг доставка, растаможка мототехники, сколько стоит растаможить квадроцикл, таможня техника из китая цена, наценка карго китай, честная цена техника из китая, техника из китая без переплат, купить квадроцикл из китая под ключ, эпсм эптс растаможка, таможенное оформление техники, техника из китая в москву цена, карго из китая техника, доставка utv из китая цена"),
 ("R3","полезный · инструкция","Купил технику - а документы где?",
  "Пошаговая инструкция, как технику из Китая законно оформить на учёт - спортинвентарь или ЭПСМ и ЭПТС, пакет готовится параллельно с дорогой. Сохраняйте.",
  "напишите город - подскажем под вашу технику. Сайт dieselcompany.pro",
  "документы на квадроцикл из китая, эптс на квадроцикл, эпсм документы техника, как оформить квадроцикл из китая, поставить на учёт квадроцикл из китая, документы на технику из китая, спортинвентарь оформление техники, растаможить и оформить квадроцикл, учёт мототехники из китая, снегоход документы учёт, багги на учёт документы, техника из китая с документами, оформление utv из китая, гидроцикл документы, как поставить на учёт технику из китая, квадроцикл без документов что делать, легально ввезти технику из китая"),
 ("R4","разбор-кейс · цифра","Одиннадцать тысяч долларов. За что?",
  "Разбираем реальный кейс LONCIN xwolf 1000 MUD слоями - из чего складывается цена под ключ до Москвы: техника с завода, доставка, таможня, наценка. Никакого воздуха.",
  "напишите город - соберём такую же цифру до вас. Сайт dieselcompany.pro",
  "loncin xwolf 1000, квадроцикл loncin из китая, цена квадроцикла из китая под ключ, из чего складывается цена техника из китая, разбор цены квадроцикл китай, loncin из китая цена, квадроцикл 1000 кубов из китая, купить loncin xwolf, техника из китая под ключ до москвы, сколько стоит квадроцикл из китая, доставка loncin из китая, mud версия квадроцикла, квадроцикл из китая реальная цена, техника из китая с завода, cf moto из китая цена, квадроцикл из китая без наценки"),
 ("R5","продающий · оффер","Назови город - посчитаем под ключ.",
  "Что возим и от какой суммы это имеет смысл - квадро, гидро, снегоходы, багги, спецтехника, электро от 500 000; бренды LONCIN, CF Moto, BRP, AODES; гарантия год, таможня в цене.",
  "напишите город в личку или зайдите на dieselcompany.pro - посчитаем сегодня.",
  "техника из китая под ключ, квадроцикл из китая купить, гидроцикл из китая, снегоход из китая, багги из китая, спецтехника из китая, электро квадроцикл из китая, cf moto из китая, loncin из китая, brp из китая, aodes квадроцикл, техника из китая от 500000, доставка техники из китая в москву, мототехника из китая напрямую, квадроцикл из китая с гарантией, купить снегоход из китая, utv из китая под ключ, техника из китая оптом"),
]

POST_TEXT="""Каждый второй, кто пишет нам первый раз, боится трёх вещей. Скажу честно про каждую.

Первый страх - кинут или привезут битое. Понимаю. Поэтому техника идёт напрямую с завода, а не через десятые руки. Маршрут один и тот же, Китай, Монголия, Москва, тридцать-тридцать пять дней. И приезжает как с завода, а не «как получилось».

Второй страх - таможня выставит доплату сверху, и конечная цена станет сюрпризом. Не станет. Доставка это три с половиной доллара за килограмм, фикс. Таможня уже внутри цены. Вы видите сумму под ключ ДО старта, а не после.

Третий страх - привезут без документов, и техника мёртвым грузом встанет в гараже. Нет. Оформляем как спортинвентарь или ЭПСМ и ЭПТС, пакет готовится, пока техника едет. Плюс гарантия год.

Мы возим то, что реально стоит везти. Квадроциклы, гидроциклы, снегоходы, багги, спецтехнику, электро. Технику от пятисот тысяч, минимальный заказ от ста тысяч рублей. LONCIN, CF Moto, BRP, AODES.

Если страх остался, это нормально. Просто напишите свой город в личку, посчитаем под ключ именно до вас. Или загляните на dieselcompany.pro."""
POST_SEARCH="техника из китая под ключ, страхи заказа техники из китая, как везут технику из китая, доставка квадроцикла из китая, растаможка техника китай, документы на технику из китая, техника из китая отзывы, купить квадроцикл из китая, гарантия техника из китая, техника из китая напрямую с завода"

CAROUSEL=[
 ("s1","Твоя техника едет 30–35 дней. Показываю весь путь."),
 ("s2","Старт - завод в Китае. Напрямую с завода, не перекуп. LONCIN, CF Moto, BRP, AODES."),
 ("s3","Упаковка и цена. Считаем доставку просто: 3,5 $ за килограмм, фикс. Никакой магии."),
 ("s4","Граница - Монголия. Проходим транзит. Таможня уже в цене, доплат сверху нет."),
 ("s5","Документы в дороге. Пока техника едет, готовим бумаги. Спортинвентарь или ЭПСМ и ЭПТС."),
 ("s6","Финиш - Москва. Приезжает под ключ. Гарантия год. Дальше довозим до твоего города."),
 ("s7","Назови город - соберём цену под ключ до тебя. Или dieselcompany.pro."),
]
CAROUSEL_SEARCH="путь техники из китая, маршрут доставки из китая, доставка через монголию, срок доставки из китая, техника из китая под ключ, этапы доставки квадроцикла, как везут технику из китая в москву, растаможка в цене, документы в дороге техника, гарантия год техника из китая"

def esc(s): return html.escape(s)

def copy_media():
    # reels + covers
    for R,_,_,_,_,_ in REELS:
        r=f"{ROOT}/webreels/{R}.mp4"  # web-версия (crf24, faststart) для витрины
        if not os.path.exists(r): r=f"{ROOT}/builds2/{R}/reel.mp4"
        if os.path.exists(r): shutil.copy(r, f"{OUT}/media/{R}.mp4")
        c=f"{ROOT}/covers/{R}_cover.jpg"
        if os.path.exists(c): shutil.copy(c, f"{OUT}/media/{R}_cover.jpg")
    # post + carousel (fetched separately into these dirs)
    for f in glob.glob(f"{ROOT}/postcar/post.jpg"): shutil.copy(f, f"{OUT}/media/post.jpg")
    for f in glob.glob(f"{ROOT}/postcar/s*.jpg"): shutil.copy(f, f"{OUT}/media/"+os.path.basename(f))

def build():
    copy_media()
    P=[]
    P.append("""<!doctype html><html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>DIESEL CARGO - контент-день</title>
<style>
:root{--amb:#EA5920;--amb2:#FF7A3C;--ink:#0E0E0E;--pan:#17130f;--pan2:#1e1915;--wht:#F6F4F1;--mut:#b9b0a6}
*{box-sizing:border-box;margin:0;padding:0}
body{background:var(--ink);color:var(--wht);font-family:'Montserrat','Segoe UI',system-ui,Arial,sans-serif;line-height:1.5}
.wrap{max-width:1180px;margin:0 auto;padding:0 18px}
header{padding:46px 0 30px;border-bottom:1px solid #2a231d}
.brand{display:flex;align-items:center;gap:14px}
.mark{width:52px;height:52px;object-fit:contain}
.brand h1{font-size:30px;font-weight:900;letter-spacing:1px}
.brand .amb{color:var(--amb)}
.sub{color:var(--mut);margin-top:10px;font-size:15px}
h2.sec{font-size:14px;letter-spacing:3px;text-transform:uppercase;color:var(--amb2);margin:46px 0 18px;font-weight:800}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:26px}
.card{background:var(--pan);border:1px solid #2a231d;border-radius:18px;overflow:hidden;display:flex;flex-direction:column}
.card video{width:100%;aspect-ratio:9/16;background:#000;display:block}
.card .body{padding:16px 16px 18px}
.tag{display:inline-block;font-size:11px;letter-spacing:1.5px;text-transform:uppercase;color:var(--ink);background:var(--amb);padding:4px 10px;border-radius:20px;font-weight:800}
.hook{font-size:18px;font-weight:800;margin:12px 0 8px}
.benefit{color:var(--mut);font-size:14px}
.funnel{margin-top:12px;font-size:13px;color:var(--wht);border-left:3px solid var(--amb);padding-left:10px}
details{margin-top:12px}details summary{cursor:pointer;color:var(--amb2);font-size:12px;letter-spacing:1px;text-transform:uppercase;font-weight:700}
.search{color:#8f877e;font-size:12px;margin-top:8px;line-height:1.7}
.post{display:grid;grid-template-columns:340px 1fr;gap:26px;background:var(--pan);border:1px solid #2a231d;border-radius:18px;padding:20px}
.post img{width:100%;border-radius:12px;background:#000}
.post .txt{white-space:pre-wrap;font-size:15px;color:#e8e2da}
.crow{display:flex;gap:16px;overflow-x:auto;padding-bottom:10px;scroll-snap-type:x mandatory}
.crow figure{flex:0 0 260px;scroll-snap-align:start}
.crow img{width:260px;aspect-ratio:4/5;object-fit:cover;border-radius:14px;background:#000;border:1px solid #2a231d}
.crow figcaption{font-size:13px;color:var(--mut);margin-top:8px}
.cdesc{color:var(--mut);font-size:14px;margin-top:6px}
footer{margin:56px 0 40px;color:#6f675e;font-size:12px;text-align:center}
@media(max-width:700px){.post{grid-template-columns:1fr}}
</style></head><body><div class="wrap">
<header><div class="brand"><img class="mark" src="media/mark.png" alt=""><h1>DIESEL <span class="amb">CARGO</span></h1></div>
<div class="sub">Контент-день: 5 роликов · пост · карусель. Техника из Китая под ключ. dieselcompany.pro</div></header>
""")
    # reels
    P.append('<h2 class="sec">Ролики</h2><div class="grid">')
    for R,tag,hook,benefit,funnel,search in REELS:
        vid=f'<video src="media/{R}.mp4" poster="media/{R}_cover.jpg" controls preload="metadata" playsinline></video>' if os.path.exists(f"{OUT}/media/{R}.mp4") else '<div style="aspect-ratio:9/16;background:#000;display:flex;align-items:center;justify-content:center;color:#555">рендерится…</div>'
        P.append(f'''<div class="card">{vid}<div class="body">
<span class="tag">{esc(tag)}</span>
<div class="hook">{esc(hook)}</div>
<div class="benefit">{esc(benefit)}</div>
<div class="funnel">{esc(funnel)}</div>
<details><summary>для поиска</summary><div class="search">{esc(search)}</div></details>
</div></div>''')
    P.append('</div>')
    # post
    postimg='<img src="media/post.jpg" alt="" onerror="this.style.display=\'none\'">'
    P.append(f'''<h2 class="sec">Пост - «Три страха»</h2>
<div class="post"><div>{postimg}</div><div><div class="txt">{esc(POST_TEXT)}</div>
<details><summary>для поиска</summary><div class="search">{esc(POST_SEARCH)}</div></details></div></div>''')
    # carousel
    P.append('<h2 class="sec">Карусель - «Путь Китай → Монголия → Москва»</h2><div class="crow">')
    for sid,cap in CAROUSEL:
        img=f'<img src="media/{sid}.jpg" alt="" onerror="this.closest(\'figure\').style.display=\'none\'">'
        P.append(f'<figure>{img}<figcaption>{esc(cap)}</figcaption></figure>')
    P.append('</div>')
    P.append(f'<div class="cdesc"><details><summary style="color:var(--amb2);cursor:pointer">для поиска</summary><div class="search">{esc(CAROUSEL_SEARCH)}</div></details></div>')
    P.append('<footer>DIESEL CARGO · dieselcompany.pro · напишите город в личку</footer></div></body></html>')
    open(f"{OUT}/index.html","w").write("\n".join(P))
    # brand mark copy
    for cand in [f"{ROOT}/diesel_mark.png","/opt/oko-poster/cfg/diesel_mark.png"]:
        if os.path.exists(cand): shutil.copy(cand, f"{OUT}/media/mark.png"); break
    print("PAGE built", os.path.getsize(f"{OUT}/index.html"),"bytes; media:", len(os.listdir(f"{OUT}/media")))

if __name__=="__main__": build()
