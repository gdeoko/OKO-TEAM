#!/usr/bin/env python3
"""Контакт для покупки рекламы - глубоко по ленте канала.

В описании контакт есть не всегда. Тогда он почти всегда стоит в самих
постах: «По рекламе: @...», «Прайс - @...», подпись менеджера под
рекламным постом. Листаем публичную ленту t.me/s/<канал> назад до 12
страниц (~240 постов) и собираем @ники и t.me-ссылки из строк, где
рядом слова про рекламу. Ник, встреченный в таких строках чаще других,
и есть рекламный контакт.
"""
import collections, json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from лента import get, txt

ПРО_РЕКЛАМУ = re.compile(r"реклам|сотруднич|прайс|по вопросам|вп\b|взаимопиар|менеджер|"
                         r"админ|купить рекл|advert|\bads?\b|\badv\b|promo|связь|контакт",
                         re.I)
НИК = re.compile(r"(?:@|t\.me/)([A-Za-z][A-Za-z0-9_]{3,31})\b")
НЕ_ЛЮДИ = {"joinchat", "addstickers", "share", "proxy", "iv", "s", "c", "addlist",
           "boost", "setlanguage", "contact"}


def глубоко(u, страниц=12):
    счёт = collections.Counter()
    до = None
    for _ in range(страниц):
        s = get("https://t.me/s/%s%s" % (u, "?before=%d" % до if до else ""))
        if not s:
            break
        for блок in re.findall(r'tgme_widget_message_text[^>]*>(.*?)</div>', s, re.S):
            сырой = блок
            текст = txt(блок)
            for строка in текст.split("\n"):
                if ПРО_РЕКЛАМУ.search(строка):
                    for н in НИК.findall(строка):
                        счёт[н] += 1
            # ссылки внутри рекламных строк
            if ПРО_РЕКЛАМУ.search(текст):
                for н in re.findall(r'href="https?://t\.me/([A-Za-z][A-Za-z0-9_]{3,31})"', сырой):
                    счёт[н] += 0.3
        ид = [int(x) for x in re.findall(r'data-post="[^/]+/(\d+)"', s)]
        if not ид or (до and min(ид) >= до):
            break
        до = min(ид)
    return [(н, round(ч, 1)) for н, ч in счёт.most_common(8)
            if н.lower() != u.lower() and н.lower() not in НЕ_ЛЮДИ]


if __name__ == "__main__":
    путь = os.path.join(os.path.dirname(os.path.abspath(__file__)), "каналы.json")
    д = json.load(open(путь))
    import concurrent.futures as cf
    with cf.ThreadPoolExecutor(6) as ex:
        итоги = dict(zip([к["u"] for к in д["каналы"]],
                         ex.map(lambda к: глубоко(к["u"]), д["каналы"])))
    json.dump(итоги, open("/tmp/глубоко.json", "w"), ensure_ascii=False, indent=1)
    for u, н in итоги.items():
        print(u, н[:5])
