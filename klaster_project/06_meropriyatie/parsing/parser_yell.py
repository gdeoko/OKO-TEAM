# -*- coding: utf-8 -*-
"""Агентства недвижимости из каталога Yell: телефоны, Телеграм, сайты.

Почты в карточках Yell почти нет, зато есть телефон, ссылки на мессенджеры и
иногда сайт. Для брокер-тура это ценнее почты: с человеком можно связаться
там, где он и так сидит.

    python3 parser_yell.py [город] [страниц] [файл]
"""
import concurrent.futures as futures
import json, re, subprocess, sys, time

БРАУЗЕР = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
           "(KHTML, like Gecko) Chrome/126 Safari/537.36")
КАРТОЧКА = re.compile(r'/([a-z-]+)/com/([a-z0-9_-]+)')
ТЕЛЕФОН = re.compile(r"\+7[\s0-9()-]{10,18}")
ПОЧТА = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
ССЫЛКА = re.compile(r'href="(https?://[^"]+)"[^>]*rel="nofollow"')
ИМЯ = re.compile(r"<h1[^>]*>(.*?)</h1>", re.S)
СВОИ = ("yell.ru", "vk.com/yellru", "twitter.com/yellru", "sk.ru", "facebook.com/yell")


def взять(адрес, ждать=20):
    r = subprocess.run(["curl", "-sL", "--max-time", str(ждать), "--compressed",
                        "-A", БРАУЗЕР, адрес],
                       capture_output=True, text=True, errors="ignore")
    return r.stdout or ""


def карточки_со_страницы(город, номер):
    адрес = (f"https://www.yell.ru/{город}/top/agentstva-nedvizhimosti/"
             + (f"?page={номер}" if номер > 1 else ""))
    html = взять(адрес)
    if not html:
        return []
    из = set()
    for г, слаг in КАРТОЧКА.findall(html):
        if г == город:
            из.add(f"https://www.yell.ru/{город}/com/{слаг}/")
    return sorted(из)


def разобрать_карточку(адрес):
    html = взять(адрес)
    if not html:
        return None
    имя = ""
    м = ИМЯ.search(html)
    if м:
        имя = re.sub(r"<[^>]+>", " ", м.group(1))
        имя = " ".join(имя.split())
    телефоны = sorted({re.sub(r"\D", "", т) for т in ТЕЛЕФОН.findall(html)})
    почты = sorted({п.lower() for п in ПОЧТА.findall(html)
                    if not any(с in п.lower() for с in ("yell.ru", "sentry", "example"))})
    ссылки = [с for с in ССЫЛКА.findall(html) if not any(х in с for х in СВОИ)]
    телега = next((с for с in ссылки if "t.me" in с), "")
    вк = next((с for с in ссылки if "vk.com" in с), "")
    сайт = next((с for с in ссылки
                 if not any(х in с for х in ("t.me", "vk.com", "instagram", "wa.me",
                                             "youtube", "ok.ru", "twitter"))), "")
    if not имя:
        return None
    return {"имя": имя, "телефон": телефоны[0] if телефоны else "",
            "телефоны": телефоны[:3], "почта": почты[0] if почты else "",
            "телеграм": телега, "вк": вк,
            "сайт": сайт.replace("https://", "").replace("http://", "").split("/")[0] if сайт else "",
            "источник": "yell", "ссылка": адрес}


if __name__ == "__main__":
    город = sys.argv[1] if len(sys.argv) > 1 else "moscow"
    страниц = int(sys.argv[2]) if len(sys.argv) > 2 else 40
    файл = sys.argv[3] if len(sys.argv) > 3 else f"/opt/oko-poster/lead_yell_{город}.json"

    адреса = set()
    for н in range(1, страниц + 1):
        новые = карточки_со_страницы(город, н)
        было = len(адреса)
        адреса.update(новые)
        print(f"страница {н}: карточек {len(новые)}, всего {len(адреса)}", flush=True)
        if not новые or len(адреса) == было:
            print("новые карточки кончились", flush=True)
            break
        time.sleep(1.5)

    записи = []
    with futures.ThreadPoolExecutor(max_workers=8) as пул:
        задачи = {пул.submit(разобрать_карточку, а): а for а in sorted(адреса)}
        for н, з in enumerate(futures.as_completed(задачи), 1):
            try:
                итог = з.result()
            except Exception:
                итог = None
            if итог:
                записи.append(итог)
            if н % 50 == 0:
                print(f"карточек разобрано {н}/{len(задачи)}, годных {len(записи)}", flush=True)

    json.dump({"всего": len(записи), "записи": записи},
              open(файл, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"ИТОГО {город}: {len(записи)} | с телефоном "
          f"{sum(1 for з in записи if з['телефон'])} | с телеграмом "
          f"{sum(1 for з in записи if з['телеграм'])} | с сайтом "
          f"{sum(1 for з in записи if з['сайт'])} | с почтой "
          f"{sum(1 for з in записи if з['почта'])}", flush=True)
