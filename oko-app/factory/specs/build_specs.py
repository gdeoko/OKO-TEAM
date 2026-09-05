# -*- coding: utf-8 -*-
# Генерирует 5 спек роликов DIESEL (боль/FAQ). Только факты паспорта в инфографике.
# Запреты клиента соблюдены: без выдуманных ТТХ, без дешёвых мотиков, без "цена дилера",
# без панды/лого в инсте (это ролики), без хештегов. Разнообразие: у каждого свой набор
# механик (уникальная сигнатура), свой стиль оверлея, свой бакет/музыка.
import json, os

OUT = os.path.dirname(os.path.abspath(__file__))
FUNNEL = "dieselcompany.pro"

# --- воронка + «для поиска» (не хэштеги) — общий хвост описания ---
def desc(title, body, keys):
    return (body.strip() +
            "\n\nНапишите город в личку — посчитаем под ключ.\n" + FUNNEL +
            "\n\n" + "для поиска: " + ", ".join(keys))

REELS = {
 "R1": {
  "bucket": "viral", "ovl_style": 0,
  "beats": [
   {"vo":"Боишься доплат при заказе техники из Китая?","title":["ЗАКАЗ ИЗ КИТАЯ","БЕЗ СЮРПРИЗОВ"],"y":760},
   {"vo":"Кажется, что сверху вылезет куча доплат.","title":["А ГДЕ ТУТ","ДОПЛАТЫ?"],"y":760},
   {"vo":"У нас цена под ключ уже всё включает.","title":["ЦЕНА","ПОД КЛЮЧ"],"y":760},
   {"vo":"Закупка, логистика и растаможка внутри.","title":["ВСЁ УЖЕ","ВНУТРИ"],"y":760},
   {"vo":"Из Китая через Монголию до Москвы.","title":["КИТАЙ","МОСКВА"],"y":760},
   {"vo":"Напиши город, и мы посчитаем.","title":["ГОРОД","В ЛИЧКУ"],"y":1180},
  ],
  "footage":["utility vehicle utv offroad","atv quad bike trail","cargo container ship port aerial",
   "semi truck highway aerial","warehouse forklift logistics","shipping containers crane terminal",
   "off road buggy dunes","side by side vehicle mud","truck driver cabin road",
   "money cash counting closeup","delivery truck city street","mountain offroad nature drive"],
  "accents":[
   {"t":1.0,"e":4.6,"type":"route","x":"c","data":{"a":"КИТАЙ","b":"МОСКВА"}},
   {"t":5.0,"e":8.6,"type":"iconrow","data":{"items":["ЗАКУПКА","ЛОГИСТИКА","ТАМОЖНЯ"]}},
   {"t":9.0,"e":12.6,"type":"donut","data":{"val":100,"label":"ПОД КЛЮЧ"}},
   {"t":13.0,"e":16.6,"type":"odometer","data":{"to":500,"suf":" 000 ₽","label":"ТЕХНИКА ОТ"}},
   {"t":17.0,"e":20.4,"type":"bigstat","data":{"num":"35","label":"ДНЕЙ ДО МОСКВЫ"}},
   {"t":20.8,"e":24.2,"type":"badge","x":"c","data":{"txt":"ЦЕНА ПОД КЛЮЧ","arrow":True}},
  ],
  "cover":{"eyebrow":"ТЕХНИКА · ИЗ КИТАЯ · ПОД КЛЮЧ","l1":"ЦЕНА","l2":"ПОД КЛЮЧ.",
   "pill":"ЗАКУПКА · ЛОГИСТИКА · ТАМОЖНЯ","sub":"без наценок сверху · растаможка в цене"},
  "meta_title":"Техника из Китая под ключ: почему нет доплат сверху",
  "meta_body":"Боишься, что закинешь предоплату, а потом сверху вылезет куча доплат. У нас цена под ключ уже собрана из закупки, логистики и растаможки. Из Китая через Монголию до Москвы, техника от 500 000 рублей.",
  "keys":["техника из китая под ключ","квадроцикл из китая","utv из китая","доставка техники из китая",
   "растаможка техники","техника из китая в москву","купить квадроцикл из китая цена","под ключ из китая",
   "спецтехника из китая","снегоход из китая","багги из китая","гидроцикл из китая","доставка через монголию",
   "техника из китая напрямую","мототехника из китая"],
 },
 "R2": {
  "bucket": "useful", "ovl_style": 2,
  "beats":[
   {"vo":"Почему техника не виснет на таможне неделями?","title":["ТАМОЖНЯ","БЕЗ ПРОСТОЯ"],"y":760},
   {"vo":"Обычно застревает та, что везут сами.","title":["САМ ВЕЗЁШЬ","САМ И ЖДЁШЬ"],"y":760},
   {"vo":"Мы оформляем всё по закону.","title":["ВСЁ","ПО ЗАКОНУ"],"y":760},
   {"vo":"Спортинвентарь или ЭПСМ и ЭПТС.","title":["ЭПСМ","ЭПТС"],"y":760},
   {"vo":"Растаможка уже сидит в цене.","title":["ТАМОЖНЯ","В ЦЕНЕ"],"y":760},
   {"vo":"Напиши город, расскажу по твоей технике.","title":["ГОРОД","В ЛИЧКУ"],"y":1180},
  ],
  "footage":["shipping containers crane terminal","customs warehouse forklift","cargo container ship port",
   "documents paperwork desk closeup","semi truck highway aerial","truck loading dock warehouse",
   "utility vehicle utv offroad","atv quad trail ride","container yard logistics aerial",
   "stamp document office","truck driver cabin","freight logistics night road"],
  "accents":[
   {"t":1.0,"e":4.6,"type":"ticks","data":{"items":["СПОРТИНВЕНТАРЬ","ЭПСМ","ЭПТС"]}},
   {"t":5.0,"e":8.6,"type":"route","x":"c","data":{"a":"КИТАЙ","b":"МОСКВА"}},
   {"t":9.0,"e":12.6,"type":"donut","data":{"val":100,"label":"ТАМОЖНЯ В ЦЕНЕ"}},
   {"t":13.0,"e":16.6,"type":"bigstat","data":{"num":"35","label":"ДНЕЙ С РАСТАМОЖКОЙ"}},
   {"t":17.0,"e":20.2,"type":"chips","data":{"items":["ЗАКОННО","ПОД КЛЮЧ"]}},
   {"t":20.6,"e":24.0,"type":"stamp","x":"c","data":{"a":"ПОД","b":"КЛЮЧ"}},
  ],
  "cover":{"eyebrow":"ТАМОЖНЯ · ДОКУМЕНТЫ · ПОД КЛЮЧ","l1":"НЕ ВИСНЕТ","l2":"НА ТАМОЖНЕ.",
   "pill":"СПОРТИНВЕНТАРЬ · ЭПСМ · ЭПТС","sub":"оформляем по закону · растаможка в цене"},
  "meta_title":"Как технику из Китая проводят через таможню без простоя",
  "meta_body":"Техника виснет на таможне, когда её везут сами. Мы оформляем всё по закону, как спортинвентарь или через ЭПСМ и ЭПТС, а растаможка уже сидит в цене под ключ. Из Китая через Монголию до Москвы.",
  "keys":["растаможка техники из китая","эптс на квадроцикл","эпсм документы","спортинвентарь растаможка",
   "как растаможить технику из китая","документы на квадроцикл","таможня техника из китая","utv растаможка",
   "снегоход документы","техника из китая под ключ","доставка техники из китая в москву","квадроцикл на учёт",
   "растаможка мототехники","техника из китая напрямую с завода","гидроцикл документы"],
 },
 "R3": {
  "bucket": "useful", "ovl_style": 4,
  "beats":[
   {"vo":"Какой реально срок доставки из Китая?","title":["СРОК","ИЗ КИТАЯ"],"y":760},
   {"vo":"Многие ждут чуть ли не полгода.","title":["ПОЛГОДА?","НЕ У НАС"],"y":760},
   {"vo":"У нас маршрут короткий и прозрачный.","title":["МАРШРУТ","ПРОЗРАЧНЫЙ"],"y":760},
   {"vo":"Из Китая через Монголию до Москвы.","title":["КИТАЙ · МОНГОЛИЯ","МОСКВА"],"y":760},
   {"vo":"От тридцати до тридцати пяти дней.","title":["30-35","ДНЕЙ"],"y":760},
   {"vo":"Напиши город, посчитаю сроки.","title":["ГОРОД","В ЛИЧКУ"],"y":1180},
  ],
  "footage":["semi truck highway aerial timelapse","cargo container ship ocean","freight train logistics",
   "truck convoy aerial road","warehouse logistics forklift","utility vehicle utv offroad",
   "atv quad trail","container terminal crane","map route travel","mountain road drive aerial",
   "delivery truck city","snowmobile snow riding"],
  "accents":[
   {"t":1.0,"e":4.6,"type":"route","x":"c","data":{"a":"КИТАЙ","b":"МОСКВА"}},
   {"t":5.0,"e":8.6,"type":"iconrow","data":{"items":["КИТАЙ","МОНГОЛИЯ","МОСКВА"]}},
   {"t":9.0,"e":12.6,"type":"bar","data":{"label":"СРОК ДОСТАВКИ","val":"30-35 ДНЕЙ","fill":0.55}},
   {"t":13.0,"e":16.6,"type":"ticks","data":{"items":["ЗАКУПКА","В ПУТИ","У ВАС"]}},
   {"t":17.0,"e":20.4,"type":"bigstat","data":{"num":"35","label":"ДНЕЙ МАКСИМУМ"}},
   {"t":20.8,"e":24.0,"type":"badge","x":"c","data":{"txt":"БЕЗ ПОСРЕДНИКОВ","arrow":True}},
  ],
  "cover":{"eyebrow":"СРОКИ · МАРШРУТ · ПОД КЛЮЧ","l1":"30-35","l2":"ДНЕЙ.",
   "pill":"КИТАЙ · МОНГОЛИЯ · МОСКВА","sub":"короткий маршрут · без посредников"},
  "meta_title":"Реальный срок доставки техники из Китая в Москву",
  "meta_body":"Многие ждут технику из Китая чуть ли не полгода из-за цепочек посредников. У нас маршрут короткий: из Китая через Монголию до Москвы, от 30 до 35 дней.",
  "keys":["срок доставки из китая","сколько идёт техника из китая","доставка квадроцикла из китая в москву",
   "техника из китая сроки","доставка через монголию","utv из китая срок","доставка техники из китая",
   "квадроцикл из китая в москву","снегоход из китая доставка","техника из китая под ключ","логистика из китая",
   "багги из китая","спецтехника из китая доставка","гидроцикл из китая","мототехника из китая срок"],
 },
 "R4": {
  "bucket": "sales", "ovl_style": 3,
  "beats":[
   {"vo":"А что, если техника вдруг сломается?","title":["А ЕСЛИ","СЛОМАЕТСЯ?"],"y":760},
   {"vo":"Этот страх держит перед заказом.","title":["ГЛАВНЫЙ","СТРАХ"],"y":760},
   {"vo":"Гарантия год от карго-компании.","title":["ГАРАНТИЯ","1 ГОД"],"y":760},
   {"vo":"Берём технику от пятисот тысяч.","title":["ОТ 500 000","РУБЛЕЙ"],"y":760},
   {"vo":"Бренды, которым доверяют.","title":["LONCIN · CF MOTO","BRP · AODES"],"y":760},
   {"vo":"Напиши город и модель в личку.","title":["ГОРОД","В ЛИЧКУ"],"y":1180},
  ],
  "footage":["utility vehicle utv workshop","atv quad garage service","offroad vehicle mud trail",
   "snowmobile snow winter","jet ski water riding","side by side buggy dunes",
   "mechanic workshop tools","utility vehicle showroom","cargo container ship port",
   "semi truck highway","warehouse forklift","offroad quad nature"],
  "accents":[
   {"t":1.0,"e":4.6,"type":"badge","x":"c","data":{"txt":"ГАРАНТИЯ 1 ГОД","arrow":True}},
   {"t":5.0,"e":8.6,"type":"stamp","x":"c","data":{"a":"1","b":"ГОД"}},
   {"t":9.0,"e":12.6,"type":"odometer","data":{"to":500,"suf":" 000 ₽","label":"ТЕХНИКА ОТ"}},
   {"t":13.0,"e":16.6,"type":"chips","data":{"items":["LONCIN","CF MOTO","BRP","AODES"]}},
   {"t":17.0,"e":20.6,"type":"donut","data":{"val":100,"label":"ПОД КЛЮЧ"}},
   {"t":21.0,"e":24.2,"type":"route","x":"c","data":{"a":"КИТАЙ","b":"МОСКВА"}},
  ],
  "cover":{"eyebrow":"ГАРАНТИЯ · БРЕНДЫ · ПОД КЛЮЧ","l1":"ГАРАНТИЯ","l2":"1 ГОД.",
   "pill":"LONCIN · CF MOTO · BRP · AODES","sub":"техника от 500 000 ₽ · год гарантии"},
  "meta_title":"Гарантия на технику из Китая: что если сломается",
  "meta_body":"Главный страх перед заказом техники из Китая, что сломается и некому предъявить. У нас гарантия год от карго-компании. Берём технику от 500 000 рублей: LONCIN, CF Moto, BRP, AODES.",
  "keys":["гарантия на технику из китая","квадроцикл из китая гарантия","loncin квадроцикл","cf moto из китая",
   "brp из китая","aodes квадроцикл","техника из китата под ключ","utv из китая с гарантией","снегоход из китая",
   "гидроцикл из китая","багги из китая","спецтехника из китая","доставка техники из китая в москву",
   "квадроцикл из китая цена","мототехника из китая под ключ"],
 },
 "R5": {
  "bucket": "viral", "ovl_style": 1,
  "beats":[
   {"vo":"Что мы реально возим из Китая?","title":["ЧТО ВОЗИМ","ИЗ КИТАЯ"],"y":760},
   {"vo":"Не только квадроциклы.","title":["НЕ ТОЛЬКО","КВАДРО"],"y":760},
   {"vo":"Гидро, снего, багги, спецтехника, электро.","title":["ГИДРО · СНЕГО","БАГГИ · ЭЛЕКТРО"],"y":760},
   {"vo":"Бренды, которым доверяют.","title":["LONCIN · CF MOTO","BRP · AODES"],"y":760},
   {"vo":"Из Китая через Монголию до Москвы.","title":["КИТАЙ","МОСКВА"],"y":760},
   {"vo":"Назови технику и город в личку.","title":["ГОРОД","В ЛИЧКУ"],"y":1180},
  ],
  "footage":["atv quad offroad trail","utility vehicle utv dunes","snowmobile snow riding",
   "jet ski water sport","side by side buggy offroad","electric offroad vehicle",
   "offroad quad mud","cargo container ship port","semi truck highway aerial",
   "warehouse logistics forklift","offroad vehicle mountain","container terminal crane"],
  "accents":[
   {"t":1.0,"e":4.6,"type":"iconrow","data":{"items":["КВАДРО","ГИДРО","СНЕГО"]}},
   {"t":5.0,"e":8.6,"type":"chips","data":{"items":["БАГГИ","СПЕЦТЕХНИКА","ЭЛЕКТРО"]}},
   {"t":9.0,"e":12.6,"type":"ticks","data":{"items":["LONCIN","CF MOTO","BRP"]}},
   {"t":13.0,"e":16.6,"type":"route","x":"c","data":{"a":"КИТАЙ","b":"МОСКВА"}},
   {"t":17.0,"e":20.4,"type":"bigstat","data":{"num":"35","label":"ДНЕЙ ПОД КЛЮЧ"}},
   {"t":20.8,"e":24.0,"type":"bar","data":{"label":"ТЕХНИКА ОТ","val":"500 000 ₽","fill":0.5}},
  ],
  "cover":{"eyebrow":"КВАДРО · ГИДРО · СНЕГО · БАГГИ","l1":"ВСЯ ТЕХНИКА","l2":"ИЗ КИТАЯ.",
   "pill":"LONCIN · CF MOTO · BRP · AODES","sub":"квадро, гидро, снего, багги, электро"},
  "meta_title":"Что возим из Китая: не только квадроциклы",
  "meta_body":"Из Китая под ключ везём не только квадроциклы. Гидроциклы, снегоходы, багги, спецтехнику и электро. Бренды LONCIN, CF Moto, BRP, AODES. Из Китая через Монголию до Москвы.",
  "keys":["техника из китая","квадроцикл из китая","гидроцикл из китая","снегоход из китая","багги из китая",
   "спецтехника из китая","электро техника из китая","utv из китая","loncin","cf moto из китая","brp из китая",
   "aodes","доставка техники из китая в москву","техника из китая под ключ","мототехника из китая напрямую"],
 },
}

def build_meta(r, key):
    return {
     "batch": "A" if r["bucket"]=="viral" else ("B" if r["bucket"]=="useful" else "C"),
     "bucket": r["bucket"],
     "title": r["meta_title"],
     "yt_desc": desc(r["meta_title"], r["meta_body"], r["keys"]),
     "caption": desc(r["meta_title"], r["meta_body"], r["keys"]),
    }

for name, r in REELS.items():
    spec = {
     "batch": "A" if r["bucket"]=="viral" else ("B" if r["bucket"]=="useful" else "C"),
     "bucket": r["bucket"],
     "music": "",  # инъекция pick_music в билд-скрипте
     "seed": 0,
     "beats": r["beats"],
     "footage": r["footage"],
     "accents": r["accents"],
     "ovl_style": r["ovl_style"],
     "cover": r["cover"],
     "meta": build_meta(r, name),
    }
    p = os.path.join(OUT, f"{name}.json")
    json.dump(spec, open(p,"w"), ensure_ascii=False, indent=1)
    print("wrote", p, "accents:", len(r["accents"]), "types:", sorted({a["type"] for a in r["accents"]}))
