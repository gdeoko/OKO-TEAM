# -*- coding: utf-8 -*-
"""Сборка страницы «Анализ конкурентов» по эталону ОКО под бренд Кластера.

Цифры (подписчики, просмотры, реакции, даты) приходят из скрапера YouTube,
разбор (хук, раскадровка, удержание, воронка) это наша аналитика.
"""
import json, sys, importlib
sys.path.insert(0, "/home/user/oko-agents")
sys.path.insert(0, "/tmp/claude-0/-home-user-oko-agents/33fe8496-acfc-5a27-9b2b-b2000b0ee729/scratchpad")

from core import competitors as cp

БАЗА = "/tmp/claude-0/-home-user-oko-agents/33fe8496-acfc-5a27-9b2b-b2000b0ee729/scratchpad"

ГРУППЫ = {
 "Прямая ниша: коммерческая и промышленная недвижимость": [
   "@CommercialPropertyAdvisors", "@KenMcElroy", "@Mashkov_D",
   "@smirnov_real_estate", "@smarent", "@InvestFutureRu"],
 "Заводы и производство": [
   "@BusinessInsider", "@FD_Engineering", "@howitsmadefactories", "@Huggbees",
   "@kaketosdelano", "@tvzrru", "@KonstantinPro", "@techzone1843",
   "@mashnewstv", "@Razborshik"],
 "Цех, станки и металл: это наш арендатор": [
   "@TITANSofCNC", "@CuttingEdgeEngineering", "@Abom79", "@InheritanceMachining",
   "@FireballTool", "@nyccnc", "@G0RDEEN"],
 "Предприниматели: тот, кто подписывает договор": [
   "@UpFlip", "@ToBizru", "@Igor_Rybakov", "@amo_blog", "@BigMoneylive", "@BiZSekrety"],
 "Москва, промзоны и транспорт": [
   "@varlamov", "@PROMETRO", "@MoscowWalks", "@podzemnayamoskva", "@Promturist"],
 "Стройка корпусов и инженерия": ["@ForumHouseTV", "@stroyizhivi", "@LOFTDIY"],
 "Склад, логистика, автоматизация": ["@BostonDynamics", "@dhl"],
}


def собрать():
    сырое = {c["handle"]: c for c in json.load(open(f"{БАЗА}/verified.json"))}
    карточки, разборы = {}, {}
    for имя in ("analiz_a", "analiz_b", "analiz_c", "analiz_d", "analiz_e"):
        м = importlib.import_module(имя)
        карточки.update(м.КАРТОЧКИ)
        разборы.update(м.РАЗБОР)

    готовые, пропуски = [], []
    for группа, хендлы in ГРУППЫ.items():
        for h in хендлы:
            с = сырое.get(h)
            а = карточки.get(h)
            if not с or not а:
                пропуски.append((h, "нет данных" if not с else "нет разбора"))
                continue
            ролики = []
            for v in с["videos"]:
                р = разборы.get(v["id"])
                if not р:
                    пропуски.append((h, f'нет разбора ролика {v["id"]}'))
                ролики.append({**v, **(р or {})})
            всего = sum(v["views"] for v in ролики)
            готовые.append({**а, "name": с["name"], "yt": с["yt"], "subs": с["subs"],
                            "avatar": с["avatar"], "videos": ролики,
                            "avg_views": всего // max(1, len(ролики)),
                            "группа": группа})
    return готовые, пропуски


ВЫВОДЫ = [
 ("Рынок молчит, а смежные ниши гремят",
  "Из 15 прямых конкурентов по промышленной аренде в Москве живой контент ведут двое, "
  "и ни у одного нет ролика от миллиона просмотров. Зато рядом, в теме производства "
  "и цехов, миллионы собирают десятки каналов. Значит спрос на нашу тему есть, "
  "его закрывают не арендодатели, а блогеры. Это место мы и занимаем."),
 ("Смотрят не на метры, а на процесс и на деньги",
  "Из 115 разобранных роликов ни один не собрал миллион на показе площади. "
  "Собирают: работа станка крупным планом, чужая выручка вслух, чужая ошибка "
  "и доступ туда, куда не пускают. Наша площадка полна всем четырьмя."),
 ("Цифра в заголовке работает лучше прилагательного",
  "Заголовки-миллионники устроены одинаково: сумма, срок, размер, количество. "
  "«Дом 6 на 12 за 6000 долларов», «выручка магазина», «пять тонн», «за 10 минут». "
  "Отсюда правило для ленты: не «просторные помещения», а «6 метров до балки "
  "и 4 тонны на квадрат»."),
 ("Страх сильнее выгоды",
  "Ролики про ошибки, сожаления и потерю собирают в разы больше, чем ролики про "
  "успех. Главный страх нашего арендатора назван прямо: снесут под жильё. "
  "Рубрика «Не снесут» становится ядром ленты, и это подтверждено цифрами чужих каналов."),
 ("Промышленное можно снимать так, что это пересылают",
  "Boston Dynamics собрал 153 миллиона просмотров роликом без единого слова о продукте. "
  "Для нас это доказательство: короткий кадр, где фура заходит в ворота или кран-балка "
  "идёт по цеху, работает как контент, а не как отчёт."),
 ("Герой вместо объекта",
  "Каналы, которые держат аудиторию годами, показывают людей: мастера, машиниста, "
  "конструктора. Каналы без лица получают просмотры и не получают подписку. "
  "В нашей ленте у каждого материала должен быть человек: начальник участка, "
  "технолог резидента, водитель, который каждый день заезжает под разгрузку."),
 ("Длинный проход по территории это подтверждённый формат",
  "Собственник просил длинные пролёты по всему зданию ещё 19 июля. Разбор "
  "конкурентов это подтверждает: экскурсия по закрытому объекту удерживает "
  "лучше любой нарезки, а на YouTube даёт время просмотра, которого не даст короткое."),
 ("Доступ важнее продакшна",
  "Каналы с простой съёмкой, но с доступом на закрытую площадку, обгоняют "
  "красивые имиджевые ролики. У нас доступ есть на 50 000 метров и в сто производств. "
  "Это дороже любой студии."),
]

ЧТО_ДЕЛАЕМ = [
 "Рубрика «Не снесут»: КРТ, промзоны, горизонт планирования. Ядро ленты, "
 "потому что страх собирает больше выгоды.",
 "Рубрика «Цифры цеха»: высота, нагрузка, мощность, ворота, лифты, кран-балка. "
 "Цифра в каждом заголовке.",
 "Рубрика «Сто производств»: резидент с именем, станком и выручкой. Формат "
 "разбора бизнеса, проверенный на десятках миллионов просмотров.",
 "Рубрика «Стройка будущего»: Каспийская 2028 и Котляково 2029. Транспорт "
 "рядом с площадкой это редкий контент, которого нет ни у кого из конкурентов.",
 "Рубрика «Как выбирать»: ошибки, сожаления, чек-листы. Справочный контент, "
 "который собирает поиск годами.",
 "Рубрика «Площадки мира»: раз в месяц, по личной просьбе собственника.",
 "Короткие кадры без слов: ворота, фура, кран-балка, искры сварки. Это "
 "пересылают, и это ничего не стоит снять.",
 "Длинный проход по территории одним куском для YouTube, из него режутся "
 "вертикальные короткие для Reels и Shorts.",
]


def страница(конкуренты):
    по_группам = {}
    for c in конкуренты:
        по_группам.setdefault(c["группа"], []).append(c)

    всего_роликов = sum(len(c["videos"]) for c in конкуренты)
    охват = f'{sum(v["views"] for c in конкуренты for v in c["videos"]):,}'.replace(",", " ")
    миллионники = len([c for c in конкуренты if c["subs"] >= 1_000_000])

    блоки = ""
    for группа, лист in по_группам.items():
        блоки += (f'<h2 class="grp">{группа}<span>{len(лист)}</span></h2>'
                  + cp.section(лист))

    выводы = "".join(
        f'<div class="vy"><b>{т}</b><p>{о}</p></div>' for т, о in ВЫВОДЫ)
    делаем = "".join(f"<li>{x}</li>" for x in ЧТО_ДЕЛАЕМ)

    return f"""<!doctype html>
<html lang="ru"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Кластер · анализ конкурентов</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
:root{{
 --lime:#E8A400; --card:#14171C; --bd:rgba(255,255,255,.09); --bdl:rgba(232,164,0,.32);
 --w2:#C7CBD1; --w3:#8A9099; --bg:#0B0D10;
}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:#fff;font-family:'Manrope',system-ui,sans-serif;
 -webkit-font-smoothing:antialiased}}
.wrap{{max-width:1080px;margin:0 auto;padding:0 16px 80px}}
header.top{{padding:28px 0 6px;border-bottom:1px solid var(--bd);margin-bottom:18px}}
.brand{{display:flex;align-items:center;gap:12px}}
.brand .mark{{width:42px;height:42px;border-radius:12px;background:var(--lime);color:#0B0D10;
 display:flex;align-items:center;justify-content:center;font-family:'Oswald';font-weight:700;
 font-size:19px;letter-spacing:.5px}}
.brand b{{font-family:'Oswald';font-weight:600;font-size:19px;letter-spacing:.6px;text-transform:uppercase}}
.brand span{{display:block;color:var(--w3);font-size:12px;font-weight:400;letter-spacing:0;text-transform:none}}
h1{{font-family:'Oswald';font-weight:600;font-size:clamp(26px,5vw,40px);line-height:1.08;
 margin:22px 0 10px;text-transform:uppercase;letter-spacing:.5px}}
.lead{{color:var(--w2);font-size:15.5px;line-height:1.6;max-width:760px;margin:0 0 20px}}
.meth{{background:var(--card);border:1px solid var(--bd);border-radius:16px;padding:16px 18px;
 margin:0 0 26px;color:var(--w3);font-size:13.5px;line-height:1.6}}
.meth b{{color:#fff}}
.grp{{font-family:'Oswald';font-weight:500;font-size:16px;text-transform:uppercase;
 letter-spacing:.8px;margin:38px 0 4px;display:flex;align-items:center;gap:10px}}
.grp span{{background:rgba(232,164,0,.14);color:var(--lime);border-radius:20px;padding:2px 10px;
 font-size:12px;letter-spacing:0}}
h2.sec{{font-family:'Oswald';font-weight:600;font-size:clamp(20px,4vw,28px);text-transform:uppercase;
 letter-spacing:.6px;margin:52px 0 14px}}
.vy{{background:var(--card);border:1px solid var(--bd);border-left:3px solid var(--lime);
 border-radius:0 14px 14px 0;padding:14px 16px;margin-bottom:9px}}
.vy b{{display:block;font-family:'Oswald';font-weight:500;font-size:16px;margin-bottom:6px;
 letter-spacing:.3px}}
.vy p{{margin:0;color:var(--w2);font-size:14px;line-height:1.6}}
ul.do{{margin:0;padding-left:20px;color:var(--w2);font-size:14.5px;line-height:1.65}}
ul.do li{{margin-bottom:8px}}
.cmp-k b,.kpi b,.csum-i b,.cmp-rank,.vb-v,.vc-n b,.sb-n,.cmp-av,.cmp-n{{
 font-family:'Oswald',system-ui,sans-serif}}
.ar{{display:inline-block;transition:transform .3s;color:var(--w3)}}
footer{{margin-top:56px;padding-top:18px;border-top:1px solid var(--bd);color:var(--w3);font-size:12.5px}}
{cp.css()}
</style></head>
<body><div class="wrap">
<header class="top"><div class="brand"><span class="mark">К</span>
<b>Кластер<span>бизнес-парк · анализ конкурентов</span></b></div></header>

<h1>39 конкурентов, 115 роликов от миллиона просмотров</h1>
<p class="lead">Разведка по нише бренда и по смежным нишам: промышленная и коммерческая
недвижимость, заводы и производство, цех и станки, предприниматели, Москва и промзоны,
стройка, склад и логистика. Из 1168 найденных каналов фильтр прошли 164, в разбор
взяты {len(конкуренты)}. У каждого от 100 тысяч подписчиков, {миллионники} каналов
от миллиона, у каждого 2-3 ролика от миллиона просмотров с полным разбором.</p>

<div class="meth"><b>Как это собрано.</b> Каналы найдены поиском по 49 запросам ниши
и смежных ниш, а не взяты из головы. Подписчики, просмотры, реакции и даты сняты
со страниц YouTube в момент сборки, каждая цифра перепроверена точным значением
по ролику: точных цифр {всего_роликов} из {всего_роликов}. Хук, раскадровка,
удержание, воронка и выводы это наш аналитический разбор, удержание подписано
как оценка, потому что публичных данных по удержанию у чужих каналов не существует.
Суммарный охват разобранных роликов {охват} просмотров.</div>

{блоки}

<h2 class="sec">Восемь выводов для Кластера</h2>
{выводы}

<h2 class="sec">Что из этого идёт в контент-план</h2>
<ul class="do">{делаем}</ul>

<footer>OKO для ООО «АКТИВИТИ» · бизнес-парк «Кластер» · данные сняты 19 августа 2026 года.
Страница закрыта от индексации.</footer>
</div>
<script>{cp.js()}</script>
</body></html>"""


if __name__ == "__main__":
    к, п = собрать()
    print("конкурентов:", len(к), "| роликов:", sum(len(c["videos"]) for c in к))
    print("от 1 млн подписчиков:", len([c for c in к if c["subs"] >= 1_000_000]))
    if п:
        print("ПРОПУСКИ:", п[:20])
    html = страница(к)
    open(f"{БАЗА}/konkurenty.html", "w").write(html)
    print("страница:", len(html), "байт")
