"""Разведка каналов-конкурентов: ищем на YouTube по запросам ниши и смежных ниш,
собираем хендлы каналов, чьи ролики выпадают в выдаче. Ничего не выдумываем -
берём только то, что YouTube реально показал.
"""
import json, re, sys, time, urllib.parse
from concurrent.futures import ThreadPoolExecutor
sys.path.insert(0, "/home/user/oko-agents")
from core import competitor_research as cr

ЗАПРОСЫ = [
    # ядро ниши: производство, заводы, цеха
    "экскурсия по заводу", "как работает завод", "производство в России",
    "свой цех производство", "открыл своё производство", "завод изнутри",
    "как делают на заводе", "станок чпу производство", "малый бизнес производство",
    "запустил производство с нуля", "цех аренда производство",
    # промышленная и коммерческая недвижимость
    "промышленная недвижимость", "аренда склада", "коммерческая недвижимость аренда",
    "склад класса А", "бизнес парк аренда", "промзона Москвы",
    "реновация промзоны", "апарт инвестиции склад", "индустриальный парк",
    # Москва, урбанистика, стройка
    "промзоны Москвы реновация", "КРТ Москва", "стройка метро Москва",
    "как строят завод", "стройка ангара", "каркас здания монтаж",
    # бизнес и предприниматели (смежная ниша, там миллионы)
    "бизнес с нуля производство", "предприниматель завод интервью",
    "сколько зарабатывает производство", "бизнес идеи производство",
    # инженерия и как это устроено (смежная, виральная)
    "как это сделано производство", "самое большое оборудование завод",
    "кран балка монтаж", "погрузка фуры склад", "логистика склад робот",
    # запад
    "factory tour", "how its made factory", "inside a factory",
    "industrial park tour", "warehouse tour business", "machine shop tour",
    "starting a manufacturing business", "industrial real estate investing",
    "abandoned factory tour", "biggest factory in the world",
    "warehouse automation robots", "steel fabrication shop",
    "small business manufacturing", "commercial real estate industrial",
]

RE_HANDLE = re.compile(r'"canonicalBaseUrl":"/(@[A-Za-z0-9._-]{2,40})"')
RE_OWNER = re.compile(r'"ownerText":\{"runs":\[\{"text":"[^"]*","navigationEndpoint".{0,400}?"canonicalBaseUrl":"/(@[A-Za-z0-9._-]{2,40})"')


def искать(q):
    найдено = set()
    for sp in ("EgIQAQ%3D%3D", "EgIQAg%3D%3D"):   # фильтр: видео, затем каналы
        url = ("https://www.youtube.com/results?search_query="
               + urllib.parse.quote(q) + "&sp=" + sp)
        html = cr._get(url)
        найдено |= set(RE_HANDLE.findall(html))
        time.sleep(0.4)
    return q, найдено


if __name__ == "__main__":
    все = {}
    with ThreadPoolExecutor(max_workers=6) as ex:
        for q, s in ex.map(искать, ЗАПРОСЫ):
            print(f"{q}: {len(s)}", flush=True)
            for h in s:
                все.setdefault(h, []).append(q)
    print("ВСЕГО каналов:", len(все), flush=True)
    json.dump(все, open("/tmp/claude-0/-home-user-oko-agents/"
                        "33fe8496-acfc-5a27-9b2b-b2000b0ee729/scratchpad/handles.json", "w"),
              ensure_ascii=False, indent=1)
