# -*- coding: utf-8 -*-
"""Парсер сырых списков обхода.
Кладём любые .txt в inbox/ -> получаем данные для карты без ФИО и телефонов.
Телефоны используются ТОЛЬКО чтобы разбить текст на заявки и убрать дубли,
в выходные файлы не попадают."""
import re, os, json, csv, collections, hashlib, sys

BASE = os.path.dirname(os.path.abspath(__file__))
PHONE = re.compile(r'(?:\+?7|8)?[\s\-\(]*\d{3}[\s\-\)]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}\b')

# --- категории: (название, регулярка) — порядок важен, сверху специфичное ---
CATS = [
 ("Парковки", r'парковочн|парковк|паркинг|эвакуир|штрафстоян|парковок|парковки|машины паркуются'),
 ("Крысы и насекомые", r'крыс|таракан|грызун'),
 ("Лифты", r'лифт'),
 ("Борщевик", r'борщевик'),
 ("Шлагбаумы и доступ во двор", r'шлагбаум|шлакбаум'),
 ("Питбайки и мотошум", r'питбайк|мопед|мотоцикл'),
 ("Площадки для выгула собак", r'выгул|собачь|дог.?френдли|dog'),
 ("Опасные собаки", r'намордник|бойцовск'),
 ("Свалка", r'свалк'),
 ("Вырубка дубов", r'дуб|вырубк|вырез(ают|али)|срез(ают|али)|срубают'),
 ("Запахи и Фуд Сити / промзона", r'воня|запах|фуд.?сити|фудзи|промзон|канализац|ливнев|ливнёв'),
 ("Мигранты и общественный порядок", r'мигрант|таджик|киргиз|молдован|резинов|нелегальн|средней азии'),
 ("Наркомания, алкоголь, бездомные", r'наркоман|алкаш|алкогол|бомж|пьян'),
 ("Транспорт и автобусы", r'автобус|маршрутк|метро|\b992\b|\b983\b|транспорт'),
 ("Самокаты и доставщики", r'самокат|доставщик|шумахер|курьер'),
 ("Спортивные площадки", r'баскетбол|футбольн|теннис|скейт|стадион|спортивн|спортпло'),
 ("Школы, сады и поликлиники", r'школ|детск(ий|ие) сад|детсад|поликлиник|образоват'),
 ("Доступная среда", r'маломобильн|слабовидящ|инвалид|пандус'),
 ("Электроснабжение", r'электричеств|электроэнерг|свет (выключ|отключ)|отключ\w* (свет|электр)'),
 ("Освещение", r'освещен|фонар|темно|не работает свет'),
 ("Управляющая компания и ЖКХ", r'управляющ|\bук\b|жилищник|ду мкд|протечк|плесен|потоп|заявк|гвс|хвс|подъезд'),
 ("Мусор и уборка", r'мусор|помойк|уборщиц|убира|уборк|грязь|бычк|урн|контейнер|вывоз|голуб'),
 ("Дороги и тротуары", r'дорог|тротуар|\bям|плитк|светофор|перекопан|заковыр|асфальт|знак'),
 ("Озеленение и уход за газонами", r'озелен|газон|цвет(ы|ов)|кусты|насаждени|зелен'),
 ("Благоустройство и детские площадки", r'детск\w* площадк|лавочк|скамей|качел|аттракцион|благоустройств|биотуалет|прогулочн|парков\b|парк(и|ов) '),
 ("Безопасность и охрана", r'охран|росгвард|\bчоп\b|буллинг|скорая|опасн|пристаю|кис.?кис|конфиденциальн'),
 ("Шум и ночные гонки", r'шум|громк|музык|гоня|жигули|кричат|драк|ночам'),
 ("Точечная застройка", r'застра|застройк|точечн'),
 ("Досуг и культура", r'кинотеатр|развлечен|забавы|досуг'),
 ("Экология и водоёмы", r'озер|пруд|болот|эколог|лес\b'),
 ("Госуслуги и ведомства", r'\bмвд\b|записаться|госуслуг|прокуратур|министерств'),
 ("Прочее / федеральные темы", r'ипотек|мобилизац|цифров\w* рубл|утилизационн|макс\b|налог'),
]
CATS = [(n, re.compile(p, re.I)) for n, p in CATS]

# --- распознавание адреса ---
STREETS = (r'липовый|скандинавск|веласкес|фитаревск|фиторевск|фмтаревск|бачуринск|бачюрин|'
           r'лазурн|ясн(ая|ой)|эдварда григ|монахов|манахов|соседск|коммунарк|сальвадор|сервантес|'
           r'николо.?хованск|прокшин|воскресенск|саларьев|потапов|газопровод|академическ|'
           r'идальго|эдальго|гарден|лобановск|дзен|квартал|бульвар|улиц|проспект|проезд|'
           r'аллея|шоссе|переулок|посел|посёл|мкр|жк\b|дом\b')
STREETS = re.compile(STREETS, re.I)
LBL_DROP = re.compile(r'^\s*(фио|ф\.?и\.?о\.?|имя)\s*[:\-]\s*', re.I)
LBL_ADDR = re.compile(r'^\s*(район|адрес|улица|местоположение)\s*[:\-]\s*', re.I)
LBL_TEXT = re.compile(r'^\s*(комментарий|проблема|запрос|обращение|пожелание)\s*[:\-]\s*', re.I)
LBL_TEL  = re.compile(r'^\s*(телефон|тел\.?|номер|контакт)\s*[:\-]\s*', re.I)
PATRON   = re.compile(r'(ович|евич|ьевич|овна|евна|ична|инична|кызы|оглы|заде|зода)\s*$', re.I)

def is_fio(line):
    """Строка похожа на ФИО -> выбрасываем, в выгрузку персональные данные не идут."""
    l = line.strip(' .,;')
    if not l or re.search(r'\d', l) or STREETS.search(l): return False
    if any(rx.search(l) for _, rx in CATS): return False       # это описание проблемы
    w = l.split()
    if not (2 <= len(w) <= 4): return False
    if not all(re.fullmatch(r'[А-Яа-яЁё\-]+', x) for x in w): return False
    return bool(PATRON.search(l)) or len(w) >= 3 or all(x[0].isupper() for x in w)

def norm_addr(a):
    a = re.sub(r'\s+', ' ', a).strip(' .,;')
    m = list(re.finditer(r'(ул\.|улица|бульвар|б-р|проспект|пр-т)\s*', a, re.I))
    if m: a = a[m[-1].start():]                 # берём последний «ул. X, N» из длинной строки
    a = re.sub(r'^(ул\.|улица)\s*', '', a, flags=re.I)
    r = [(r'липов(ый|ый парк|ая|ый)?\s*парк|липовый', 'Липовый парк'),
         (r'скандинавск\w*(\s*бульвар)?', 'Скандинавский бульвар'),
         (r'(бульвар\s*)?веласкеса', 'Бульвар Веласкеса'),
         (r'ф[иа]т[оа]ревск\w*|фмтаревск\w*', 'Фитаревская'),
         (r'бач[юу]рин\w*', 'Бачуринская'),
         (r'(улица\s*)?(александры\s*)?м[ао]нахов\w*', 'Улица Александры Монаховой'),
         (r'эдальго|идальго', 'ЖК Идальго'),
         (r'соседск\w*\s*стан', 'Соседский Стан'),
         (r'лазурн\w*', 'Лазурная'), (r'ясн\w*', 'Ясная'),
         (r'эдварда\s*григ\w*', 'Эдварда Грига')]
    low = a.lower()
    for pat, name in r:
        m = re.match(r'\s*(?:ул\.?|улица|бульвар|б-р)?\s*' + pat, low)
        if m:
            tail = a[m.end():].strip(' .,;')
            tail = re.sub(r'^(дом|д\.)\s*', '', tail, flags=re.I)
            tail = tail.replace('/', 'к').replace(' к', 'к').replace('корпус', 'к')
            tail = re.sub(r'\s+', '', tail)
            return f'{name}, {tail}' if tail else name
    return a[:1].upper() + a[1:]

def classify(text):
    out = [n for n, rx in CATS if rx.search(text)]
    return out or ["Не размечено — проверить вручную"]

def parse(raw):
    """Режем текст на заявки: одна заявка = блок вокруг одного телефона."""
    lines = [l.strip() for l in raw.splitlines()]
    recs, cur = [], []
    for l in lines:
        if not l:
            if cur: recs.append(cur); cur = []
            continue
        if PHONE.fullmatch(l.replace(' ', '')) or (PHONE.search(l) and len(l) < 25):
            if any(PHONE.search(x) for x in cur):   # второй телефон -> новая заявка
                recs.append(cur); cur = []
        cur.append(l)
    if cur: recs.append(cur)

    out, skipped = [], []
    for block in recs:
        body = [l for l in block if not re.fullmatch(r'\d+[.)]?', l)]
        phone = next((PHONE.search(l).group() for l in body if PHONE.search(l)), None)
        marked_addr, marked_text, rest = [], [], []
        for l in body:
            l = re.sub(r'^\d+[.)]\s*', '', l).strip()
            if not l or LBL_DROP.match(l) or LBL_TEL.match(l): continue   # ФИО и телефон - в мусор
            if PHONE.search(l) and len(re.sub(r'\D', '', l)) >= 10: continue
            if LBL_ADDR.match(l):  marked_addr.append(LBL_ADDR.sub('', l)); continue
            if LBL_TEXT.match(l):  marked_text.append(LBL_TEXT.sub('', l)); continue
            if is_fio(l): continue                                        # ФИО без метки
            rest.append(l)
        if marked_addr or marked_text:
            addr = marked_addr[0] if marked_addr else next((l for l in reversed(rest) if STREETS.search(l)), None)
            prob = marked_text + [l for l in rest if l is not addr]
        else:
            addr = next((l for l in reversed(rest) if STREETS.search(l)), None)
            prob = [l for l in rest if l is not addr]
        text = ' '.join(prob).strip(' .,;')
        if not text:
            skipped.append(' | '.join(block)); continue
        out.append(dict(address=norm_addr(addr) if addr else "Адрес не указан",
                        text=text, categories=classify(text),
                        key=hashlib.md5(((phone or '') + text.lower()).encode()).hexdigest()))
    return out, skipped

def aggregate(recs, out_prefix="problems"):
    seen, uniq = set(), []
    for r in recs:
        if r["key"] in seen: continue
        seen.add(r["key"]); uniq.append(r)
    by_cat, by_addr = collections.Counter(), collections.Counter()
    addr_cat = collections.defaultdict(collections.Counter)
    ex = collections.defaultdict(list)
    for r in uniq:
        by_addr[r["address"]] += 1
        for c in r["categories"]:
            by_cat[c] += 1; addr_cat[r["address"]][c] += 1
            ex[(r["address"], c)].append(r["text"])
    points = [dict(address=a, requests_total=by_addr[a],
                   geocode_query="Москва, Новомосковский АО, " + a,
                   problems=[dict(category=c, count=n, examples=sorted(set(ex[(a, c)]))[:3])
                             for c, n in addr_cat[a].most_common()])
              for a in sorted(addr_cat, key=lambda a: (-by_addr[a], a))]
    return uniq, dict(totals=dict(requests=len(uniq), addresses=len(points)),
                      by_category=[dict(category=c, count=n) for c, n in by_cat.most_common()],
                      points=points)

if __name__ == "__main__":
    raw = ""
    for fn in sorted(os.listdir(BASE + "/inbox")):
        if fn.endswith(".txt"):
            raw += open(BASE + "/inbox/" + fn, encoding="utf-8").read() + "\n\n"
    recs, skipped = parse(raw)
    uniq, agg = aggregate(recs)
    json.dump(agg, open(BASE + "/inbox-result.json", "w"), ensure_ascii=False, indent=1)
    print(f"Разобрано записей: {len(recs)} | уникальных: {len(uniq)} | дублей снято: {len(recs)-len(uniq)}")
    print(f"Без адреса: {sum(1 for r in uniq if r['address']=='Адрес не указан')} | "
          f"без категории: {sum(1 for r in uniq if r['categories']==['Не размечено — проверить вручную'])} | "
          f"пропущено пустых блоков: {len(skipped)}")
    print("\nТоп категорий:")
    for c in agg["by_category"][:12]: print(f'{c["count"]:>4}  {c["category"]}')
