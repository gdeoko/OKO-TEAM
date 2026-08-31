#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Сборщик метрик площадок бизнес-парка «Кластер» (ООО АКТИВИТИ).

Раз в час обходит площадки, снимает живые числа и кладёт их в
    /var/www/klaster-data/social.json          - текущий срез для админки
    /var/www/klaster-data/social_history.jsonl - история по дням для графиков

Главное правило: выдуманных чисел не бывает. Площадка не ответила - в json
идёт null и текст ошибки. Старое значение НИКОГДА не переносится как свежее,
переносится только метка «когда последний раз удалось снять».

Запуск:
    python3 klaster_collect.py                  # обойти всё
    python3 klaster_collect.py --only telegram,site
    python3 klaster_collect.py --dry-run        # посчитать, но ничего не писать
"""

import argparse
import errno
import fcntl
import json
import logging
import os
import re
import subprocess
import sys
import tempfile
import time
from datetime import datetime, date
from logging.handlers import RotatingFileHandler

try:
    from zoneinfo import ZoneInfo
    TZ = ZoneInfo("Europe/Moscow")
except Exception:
    TZ = None

# ---------------------------------------------------------------- настройки

ДАННЫЕ = "/var/www/klaster-data"
СРЕЗ = os.path.join(ДАННЫЕ, "social.json")
ИСТОРИЯ = os.path.join(ДАННЫЕ, "social_history.jsonl")
ЛОГ = os.path.join(ДАННЫЕ, "collect.log")
ЗАМОК = os.path.join(ДАННЫЕ, ".collect.lock")
ЗАЯВКИ = os.path.join(ДАННЫЕ, "leads.json")
ВИЗИТЫ = os.path.join(ДАННЫЕ, "visits.jsonl")   # наш трекер, пишет PHP-приёмник

CDP = "http://127.0.0.1:9333"                   # живой браузер клиента на VPS
VENV_PY = "/opt/oko-agents/.venv/bin/python3"   # там может стоять playwright
POSTER = "/opt/oko-poster"                      # там лежит node + playwright
АГЕНТЫ = "/opt/oko-agents"                      # оттуда берём pyrogram-акки

IG_ЛОГИН = "klasterofficial"
IG_ID = "36556912320"
IG_APP_ID = "936619743392459"                   # публичный web app id инстаграма

YT_КАНАЛ = "UCe-vzDDsK0-0gDtnVOzDVMQ"
YT_ХЭНДЛ = "klasterofficial"
YT_КЛЮЧ = os.environ.get("YOUTUBE_API_KEY") or os.environ.get("YT_API_KEY") or ""

ДЗЕН_ID = "6a7efef4e6a5266cd0d106ba"
VC_ID = "6a7f018cae352"

TG_КАНАЛ = -1001532539431                       # @radialnya, наш acc1 админ

ТАЙМАУТ_БРАУЗЕРА = 45_000                       # мс
ЛОГ_РАЗМЕР = 2 * 1024 * 1024                    # 2 МБ на файл
ЛОГ_КОПИЙ = 5

log = logging.getLogger("klaster")


# ---------------------------------------------------------------- служебное

def настроить_лог(в_консоль=False):
    log.setLevel(logging.INFO)
    os.makedirs(ДАННЫЕ, exist_ok=True)
    формат = logging.Formatter("%(asctime)s %(levelname)-7s %(message)s",
                               "%Y-%m-%d %H:%M:%S")
    файл = RotatingFileHandler(ЛОГ, maxBytes=ЛОГ_РАЗМЕР,
                               backupCount=ЛОГ_КОПИЙ, encoding="utf-8")
    файл.setFormatter(формат)
    log.addHandler(файл)
    if в_консоль:
        консоль = logging.StreamHandler(sys.stdout)
        консоль.setFormatter(формат)
        log.addHandler(консоль)


def сейчас():
    return datetime.now(TZ).isoformat(timespec="seconds") if TZ \
        else datetime.now().astimezone().isoformat(timespec="seconds")


def сегодня():
    return (datetime.now(TZ) if TZ else datetime.now()).strftime("%Y-%m-%d")


def записать_атомарно(путь, текст):
    """Пишем через временный файл и os.replace, чтобы админка никогда
    не поймала полуготовый json."""
    каталог = os.path.dirname(путь)
    fd, врем = tempfile.mkstemp(dir=каталог, prefix=".tmp_", suffix=".json")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(текст)
            f.flush()
            os.fsync(f.fileno())
        os.chmod(врем, 0o644)          # php-fpm должен уметь прочитать
        os.replace(врем, путь)
    except Exception:
        try:
            os.unlink(врем)
        except OSError:
            pass
        raise


class Занято(Exception):
    pass


class Замок:
    """Один процесс за раз. Два сборщика в один браузер клиента лезть не должны -
    аккаунт этого не любит, да и вкладки друг у друга воруют."""

    def __init__(self, путь):
        self.путь = путь
        self.f = None

    def __enter__(self):
        os.makedirs(os.path.dirname(self.путь), exist_ok=True)
        self.f = open(self.путь, "w")
        try:
            fcntl.flock(self.f, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError as e:
            self.f.close()
            self.f = None
            if e.errno in (errno.EACCES, errno.EAGAIN):
                raise Занято("предыдущий обход ещё идёт")
            raise
        self.f.write(f"{os.getpid()} {сейчас()}\n")
        self.f.flush()
        return self

    def __exit__(self, *_):
        if self.f:
            try:
                fcntl.flock(self.f, fcntl.LOCK_UN)
            finally:
                self.f.close()


# ------------------------------------------------- работа с браузером по CDP
#
# Три правила, нарушать нельзя:
#   1. browser.close() и context.close() на CDP-подключении НЕ ЗВАТЬ НИКОГДА -
#      это убивает живые вкладки и сессии клиента.
#   2. Своя новая вкладка, page.close() только на ней.
#   3. Одна задача в браузер за раз (держится замком выше плюс тем, что
#      сборщики идут последовательно).

_ЯДРО_JS = """
(async () => {
  const данные = %(js)s;
  return данные;
})()
"""


def браузер_есть_playwright(интерпретатор=None):
    if интерпретатор is None:
        try:
            import playwright.sync_api  # noqa: F401
            return True
        except Exception:
            return False
    if not os.path.exists(интерпретатор):
        return False
    try:
        r = subprocess.run([интерпретатор, "-c", "import playwright.sync_api"],
                           capture_output=True, timeout=30)
        return r.returncode == 0
    except Exception:
        return False


def _браузер_здесь(url, js, ожидание="domcontentloaded"):
    """Playwright прямо в этом интерпретаторе."""
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        br = p.chromium.connect_over_cdp(CDP)
        if not br.contexts:
            raise RuntimeError("в браузере на 9333 нет живого контекста")
        ctx = br.contexts[0]
        # если такая вкладка уже открыта, берём её: там сессия прогрета
        своя = None
        for г in ctx.pages:
            try:
                if url.split("//")[-1].split("/")[0] in г.url:
                    своя = г
                    break
            except Exception:
                pass
        page = своя or ctx.new_page()
        свежая = своя is None
        try:
            if свежая:
                page.goto(url, wait_until=ожидание, timeout=ТАЙМАУТ_БРАУЗЕРА)
            page.wait_for_timeout(4000)     # даём странице поднять сессию
            try:
                return page.evaluate(_ЯДРО_JS % {"js": js})
            except Exception:
                page.wait_for_timeout(4000)  # второй заход, сайты любят тормозить
                return page.evaluate(_ЯДРО_JS % {"js": js})
        finally:
            if свежая:
                try:
                    page.close()      # закрываем ТОЛЬКО свою вкладку
                except Exception:
                    pass
            # br.close() / ctx.close() не зовём принципиально


def _браузер_через_venv(url, js, ожидание):
    """Playwright есть в /opt/oko-agents/.venv - переспрашиваем сами себя
    тем интерпретатором."""
    задача = json.dumps({"url": url, "js": js, "wait": ожидание},
                        ensure_ascii=False)
    r = subprocess.run([VENV_PY, os.path.abspath(__file__), "--browser-job", задача],
                       capture_output=True, timeout=180)
    вывод = r.stdout.decode("utf-8", "replace").strip()
    if r.returncode != 0 or not вывод:
        raise RuntimeError("venv-playwright: " +
                           (r.stderr.decode("utf-8", "replace")[-400:] or "пустой ответ"))
    ответ = json.loads(вывод)
    if not ответ.get("ok"):
        raise RuntimeError("venv-playwright: " + str(ответ.get("error"))[:400])
    return ответ.get("data")


_NODE_ШАБЛОН = """
import { chromium } from 'playwright-core';
const задача = JSON.parse(process.argv[2]);
const br = await chromium.connectOverCDP(%(cdp)r.replace(/^'|'$/g, ''));
const ctx = br.contexts()[0];
if (!ctx) { console.error('нет живого контекста'); process.exit(2); }
const page = await ctx.newPage();
try {
  await page.goto(задача.url, { waitUntil: задача.wait, timeout: %(timeout)d });
  const данные = await page.evaluate(new Function('return (' + задача.js + ')()'));
  console.log(JSON.stringify({ ok: true, data: данные }));
} catch (e) {
  console.log(JSON.stringify({ ok: false, error: String(e && e.message || e) }));
} finally {
  await page.close();           // только своя вкладка
  // br.close() не зовём - это браузер клиента
}
"""


def _браузер_через_node(url, js, ожидание):
    """Последний рубеж: node из /opt/oko-poster, где playwright точно живёт
    (им ходит akt_lib.mjs)."""
    код = _NODE_ШАБЛОН % {"cdp": f"'{CDP}'", "timeout": ТАЙМАУТ_БРАУЗЕРА}
    fd, путь = tempfile.mkstemp(suffix=".mjs", prefix="klaster_cdp_")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(код)
        окружение = dict(os.environ)
        окружение["NODE_PATH"] = os.path.join(POSTER, "node_modules")
        задача = json.dumps({"url": url, "js": js, "wait": ожидание},
                            ensure_ascii=False)
        r = subprocess.run(["node", путь, задача], cwd=POSTER, env=окружение,
                           capture_output=True, timeout=180)
        вывод = r.stdout.decode("utf-8", "replace").strip().splitlines()
        if not вывод:
            raise RuntimeError("node: " +
                               (r.stderr.decode("utf-8", "replace")[-400:] or "пустой ответ"))
        ответ = json.loads(вывод[-1])
        if not ответ.get("ok"):
            raise RuntimeError("node: " + str(ответ.get("error"))[:400])
        return ответ.get("data")
    finally:
        try:
            os.unlink(путь)
        except OSError:
            pass


_БЭКЕНД = None


def браузер(url, js, ожидание="domcontentloaded"):
    """Открыть свою вкладку в браузере клиента, выполнить js, вернуть результат.
    js - строка вида 'async () => {...}', возвращающая json-совместимое."""
    global _БЭКЕНД
    if _БЭКЕНД is None:
        if браузер_есть_playwright():
            _БЭКЕНД = "здесь"
        elif браузер_есть_playwright(VENV_PY):
            _БЭКЕНД = "venv"
        else:
            _БЭКЕНД = "node"
        log.info("браузерный бэкенд: %s", _БЭКЕНД)
    if _БЭКЕНД == "здесь":
        return _браузер_здесь(url, js, ожидание)
    if _БЭКЕНД == "venv":
        return _браузер_через_venv(url, js, ожидание)
    return _браузер_через_node(url, js, ожидание)


# ------------------------------------------------------------------ сборщики
#
# Каждый возвращает (метрики: dict, источник: str) либо кидает исключение.
# Возвращать частично снятое нельзя: либо число живое, либо ошибка.


def собрать_instagram():
    js = ("""async () => {
      const r = await fetch(
        '/api/v1/users/web_profile_info/?username=%s',
        { headers: { 'x-ig-app-id': '%s' }, credentials: 'include' });
      if (!r.ok) throw new Error('http ' + r.status);
      const j = await r.json();
      const u = j && j.data && j.data.user;
      if (!u) throw new Error('в ответе нет user');
      return {
        подписчики: u.edge_followed_by ? u.edge_followed_by.count : null,
        подписки:   u.edge_follow ? u.edge_follow.count : null,
        публикации: u.edge_owner_to_timeline_media
                      ? u.edge_owner_to_timeline_media.count : null
      };
    }""" % (IG_ЛОГИН, IG_APP_ID))
    д = браузер(f"https://www.instagram.com/{IG_ЛОГИН}/", js)
    if not isinstance(д, dict) or д.get("подписчики") is None:
        raise RuntimeError("инстаграм вернул ответ без счётчиков "
                           "(скорее всего слетела сессия в браузере)")
    return ({"подписчики": int(д["подписчики"]),
             "публикации": int(д.get("публикации") or 0),
             "подписки": int(д.get("подписки") or 0)},
            "web_profile_info через живой браузер на 9333")


def собрать_youtube():
    # Путь первый - официальный Data API v3, если есть ключ. Он же самый честный.
    if YT_КЛЮЧ:
        import urllib.request
        url = ("https://www.googleapis.com/youtube/v3/channels"
               f"?part=statistics&id={YT_КАНАЛ}&key={YT_КЛЮЧ}")
        with urllib.request.urlopen(url, timeout=30) as r:
            j = json.loads(r.read().decode("utf-8"))
        items = j.get("items") or []
        if not items:
            raise RuntimeError("Data API не вернул канал (проверить id и ключ)")
        s = items[0].get("statistics") or {}
        return ({"подписчики": int(s.get("subscriberCount", 0)),
                 "видео": int(s.get("videoCount", 0)),
                 "просмотры": int(s.get("viewCount", 0))},
                "YouTube Data API v3, channels.statistics")

    # Путь второй - публичная страница канала через браузер.
    # Даёт только подписчиков и число видео, просмотры остаются неизвестны.
    js = """async () => {
      const html = document.documentElement.innerHTML;
      const m = html.match(/"subscriberCountText":\\{".*?"simpleText":"([^"]+)"/);
      const v = html.match(/"videosCountText":.*?"text":"([\\d\\s\\u00a0]+)"/);
      return { подписчики_текст: m ? m[1] : null, видео_текст: v ? v[1] : null };
    }"""
    д = браузер(f"https://www.youtube.com/@{YT_ХЭНДЛ}", js)
    текст = (д or {}).get("подписчики_текст")
    if not текст:
        raise RuntimeError("на странице канала не нашлось счётчика подписчиков; "
                           "нужен ключ YOUTUBE_API_KEY")
    return ({"подписчики": _разобрать_число_ru(текст),
             "видео": _разобрать_число_ru((д or {}).get("видео_текст")),
             "просмотры": None},
            "публичная страница канала через браузер (без ключа API)")


def _разобрать_число_ru(текст):
    """'1,2 тыс. подписчиков' -> 1200. Ноль остаётся нулём."""
    if not текст:
        return None
    т = текст.replace("\u00a0", " ").replace(",", ".").lower()
    m = re.search(r"([\d.]+)\s*(тыс|млн|k|m)?", т)
    if not m:
        return None
    ч = float(m.group(1))
    множ = {"тыс": 1000, "k": 1000, "млн": 1_000_000, "m": 1_000_000}.get(m.group(2) or "", 1)
    return int(ч * множ)


def собрать_dzen():
    # ТРЕБУЕТ ПРОВЕРКИ на VPS. Внутренние ручки Дзен-студии не документированы
    # и меняются. Пока не сверено с /opt/oko-poster - при любой осечке пишем null,
    # число наугад не сочиняем.
    js = ("""async () => {
      const тексты = [];
      for (const s of document.querySelectorAll('script')) {
        if (s.textContent && s.textContent.length > 200) тексты.push(s.textContent);
      }
      const всё = тексты.join('\\n') + '\\n' + document.documentElement.innerHTML;
      const п = всё.match(/"subscribers"\\s*:\\s*(\\d+)/)
             || всё.match(/"subscribersCount"\\s*:\\s*(\\d+)/);
      const пуб = всё.match(/"publicationsCount"\\s*:\\s*(\\d+)/)
              || всё.match(/"publicationCount"\\s*:\\s*(\\d+)/);
      return { подписчики: п ? Number(п[1]) : null,
               публикации: пуб ? Number(пуб[1]) : null };
    }""")
    д = браузер(f"https://dzen.ru/id/{ДЗЕН_ID}", js, ожидание="load")
    if not isinstance(д, dict) or д.get("подписчики") is None:
        raise RuntimeError("на странице канала Дзена не нашлось счётчика "
                           "(разметка сменилась либо канал ещё пуст) - "
                           "сверить с /opt/oko-poster/klaster_gen2.mjs")
    return ({"подписчики": int(д["подписчики"]),
             "публикации": int(д.get("публикации") or 0)},
            "страница канала Дзена через браузер (ручка не документирована)")


def собрать_vc():
    # ТРЕБУЕТ ПРОВЕРКИ. Ходим из вкладки на vc.ru, чтобы ушли куки и токен
    # устройства - без них публичный api.vc.ru отдаёт 401.
    js = ("""async () => {
      const r = await fetch('https://api.vc.ru/v2.1/subsite?id=%s',
                            { credentials: 'include' });
      if (!r.ok) throw new Error('http ' + r.status);
      const j = await r.json();
      const d = (j && j.result) || (j && j.data) || j;
      if (!d) throw new Error('пустой ответ');
      return {
        подписчики: d.subscribersCount != null ? d.subscribersCount
                   : (d.counters && d.counters.subscribers != null
                      ? d.counters.subscribers : null),
        публикации: d.entriesCount != null ? d.entriesCount
                   : (d.counters && d.counters.entries != null
                      ? d.counters.entries : null)
      };
    }""" % VC_ID)
    д = браузер("https://vc.ru/", js)
    if not isinstance(д, dict) or д.get("подписчики") is None:
        raise RuntimeError("api.vc.ru не отдал счётчики подписки "
                           "(проверить авторизацию во вкладке vc.ru)")
    return ({"подписчики": int(д["подписчики"]),
             "публикации": int(д.get("публикации") or 0)},
            "api.vc.ru v2.1 /subsite из вкладки браузера")


def собрать_telegram():
    import asyncio
    if АГЕНТЫ not in sys.path:
        sys.path.insert(0, АГЕНТЫ)
    from core.tg_stories import _client        # наш acc1 - админ @radialnya

    async def прогон():
        cli = _client("acc1")
        свой_запуск = False
        if not getattr(cli, "is_connected", False):
            await cli.start()
            свой_запуск = True
        try:
            chat = await cli.get_chat(TG_КАНАЛ)
            n = getattr(chat, "members_count", None)
            if n is None:
                raise RuntimeError("get_chat вернул чат без members_count")
            return int(n)
        finally:
            if свой_запуск:
                try:
                    await cli.stop()
                except Exception:
                    pass

    n = asyncio.run(прогон())
    return ({"подписчики": n}, "pyrogram, acc1 (админ канала @radialnya)")


def собрать_site():
    """Заявки с формы и посещаемость с нашего трекера.
    Трекер не установлен - посещаемость null, а не ноль: неизвестно и ноль
    это разные вещи, руководству клиента их путать нельзя."""
    метрики = {}

    # Заявки: файл наш, отсутствие файла честно означает «заявок не было».
    if os.path.exists(ЗАЯВКИ):
        try:
            with open(ЗАЯВКИ, encoding="utf-8") as f:
                данные = json.load(f)
            метрики["заявки_всего"] = len(данные) if isinstance(данные, list) \
                else len(данные.get("заявки", []))
        except (ValueError, OSError) as e:
            raise RuntimeError(f"leads.json не читается: {e}")
    else:
        метрики["заявки_всего"] = 0

    # Посещаемость: JSONL от нашего PHP-приёмника.
    if os.path.exists(ВИЗИТЫ):
        день = сегодня()
        визитов = 0
        гостей = set()
        with open(ВИЗИТЫ, encoding="utf-8", errors="replace") as f:
            for строка in f:
                строка = строка.strip()
                if not строка:
                    continue
                try:
                    з = json.loads(строка)
                except ValueError:
                    continue
                if str(з.get("время", ""))[:10] != день:
                    continue
                визитов += 1
                if з.get("гость"):
                    гостей.add(з["гость"])
        метрики["визиты_сегодня"] = визитов
        метрики["посетители_сегодня"] = len(гостей)
    else:
        метрики["визиты_сегодня"] = None
        метрики["посетители_сегодня"] = None

    return метрики, "файлы сайта в /var/www/klaster-data (форма и свой трекер)"


# ---------------------------------------------------------------- реестр

ПЛОЩАДКИ = [
    {"ключ": "instagram", "название": "Instagram klasterofficial",
     "ссылка": f"https://www.instagram.com/{IG_ЛОГИН}/",
     "метрики": ["подписчики", "публикации", "подписки"],
     "браузер": True, "fn": собрать_instagram},

    {"ключ": "youtube", "название": "YouTube @klasterofficial",
     "ссылка": f"https://www.youtube.com/@{YT_ХЭНДЛ}",
     "метрики": ["подписчики", "видео", "просмотры"],
     "браузер": not bool(YT_КЛЮЧ), "fn": собрать_youtube},

    {"ключ": "dzen", "название": "Дзен, канал Кластера",
     "ссылка": f"https://dzen.ru/id/{ДЗЕН_ID}",
     "метрики": ["подписчики", "публикации"],
     "браузер": True, "fn": собрать_dzen},

    {"ключ": "vc", "название": "vc.ru, блог Кластера",
     "ссылка": f"https://vc.ru/id{VC_ID}",
     "метрики": ["подписчики", "публикации"],
     "браузер": True, "fn": собрать_vc},

    {"ключ": "telegram", "название": "Telegram-канал @radialnya",
     "ссылка": "https://t.me/radialnya",
     "метрики": ["подписчики"],
     "браузер": False, "fn": собрать_telegram},

    {"ключ": "site", "название": "Сайт clusterspace.ru",
     "ссылка": "https://clusterspace.ru",
     "метрики": ["заявки_всего", "визиты_сегодня", "посетители_сегодня"],
     "браузер": False, "fn": собрать_site},
]


# ---------------------------------------------------------------- сборка среза

def прошлый_срез():
    try:
        with open(СРЕЗ, encoding="utf-8") as f:
            return json.load(f)
    except (OSError, ValueError):
        return {}


def прошлая_удача(prev, ключ):
    """Из старого файла берём ТОЛЬКО метку времени. Числа не переносим никогда."""
    try:
        return prev["площадки"][ключ].get("последняя_удачная_попытка")
    except (KeyError, TypeError, AttributeError):
        return None


def запись_удачи(площадка, метрики, источник):
    т = сейчас()
    return {
        "название": площадка["название"],
        "ссылка": площадка["ссылка"],
        "статус": "ок",
        "ошибка": None,
        "снято": т,
        "последняя_удачная_попытка": т,
        "источник": источник,
        "метрики": {имя: {"значение": метрики.get(имя),
                          "снято": т if метрики.get(имя) is not None else None,
                          "источник": источник}
                    for имя in площадка["метрики"]},
    }


def запись_ошибки(площадка, ошибка, прошлая):
    return {
        "название": площадка["название"],
        "ссылка": площадка["ссылка"],
        "статус": "ошибка",
        "ошибка": ошибка,
        "снято": None,
        "последняя_удачная_попытка": прошлая,
        "источник": "не удалось снять",
        "метрики": {имя: {"значение": None, "снято": None,
                          "источник": "не удалось снять"}
                    for имя in площадка["метрики"]},
    }


def дописать_историю(срез):
    """Одна строка на площадку в сутки, пишем только удачные снятия.
    Если за сегодня по площадке уже лежат те же числа - не дублируем."""
    день = сегодня()
    уже = {}
    if os.path.exists(ИСТОРИЯ):
        try:
            with open(ИСТОРИЯ, encoding="utf-8", errors="replace") as f:
                хвост = f.readlines()[-3000:]
            for строка in хвост:
                try:
                    з = json.loads(строка)
                except ValueError:
                    continue
                if з.get("дата") == день:
                    уже[з.get("площадка")] = з.get("метрики")
        except OSError:
            pass

    новые = []
    for ключ, п in срез["площадки"].items():
        if п["статус"] != "ок":
            continue
        значения = {и: м["значение"] for и, м in п["метрики"].items()}
        if уже.get(ключ) == значения:
            continue
        новые.append({"дата": день, "время": п["снято"], "площадка": ключ,
                      "метрики": значения, "источник": п["источник"]})

    if новые:
        with open(ИСТОРИЯ, "a", encoding="utf-8") as f:
            for з in новые:
                f.write(json.dumps(з, ensure_ascii=False) + "\n")
        try:
            os.chmod(ИСТОРИЯ, 0o644)
        except OSError:
            pass
    return len(новые)


def обойти(только=None, всухую=False):
    prev = прошлый_срез()
    срез = {
        "версия": 1,
        "обновлено": сейчас(),
        "часовой_пояс": "Europe/Moscow",
        "как_читать": ("значение null означает, что площадка не ответила. "
                       "Старые числа не переносятся, переносится только метка "
                       "последней удачной попытки."),
        "площадки": {},
    }

    for площадка in ПЛОЩАДКИ:
        ключ = площадка["ключ"]
        if только and ключ not in только:
            старое = (prev.get("площадки") or {}).get(ключ)
            if старое:
                срез["площадки"][ключ] = старое
            continue
        начало = time.time()
        try:
            метрики, источник = площадка["fn"]()
            срез["площадки"][ключ] = запись_удачи(площадка, метрики, источник)
            log.info("%s: снято за %.1fс, %s", ключ, time.time() - начало,
                     ", ".join(f"{и}={з}" for и, з in метрики.items()))
        except Exception as e:                       # noqa: BLE001
            текст = f"{type(e).__name__}: {e}"[:500]
            срез["площадки"][ключ] = запись_ошибки(площадка, текст,
                                                   прошлая_удача(prev, ключ))
            log.warning("%s: не снялось за %.1fс - %s", ключ,
                        time.time() - начало, текст)
        # Пауза между браузерными заходами: подряд бегать по вкладкам не надо.
        if площадка["браузер"]:
            time.sleep(3)

    удачных = sum(1 for п in срез["площадки"].values() if п["статус"] == "ок")
    срез["сводка"] = {"площадок": len(срез["площадки"]),
                      "снялось": удачных,
                      "не снялось": len(срез["площадки"]) - удачных}

    if всухую:
        print(json.dumps(срез, ensure_ascii=False, indent=2))
        return срез

    записать_атомарно(СРЕЗ, json.dumps(срез, ensure_ascii=False, indent=2))
    добавлено = дописать_историю(срез)
    log.info("готово: снялось %d из %d, в историю добавлено %d строк",
             удачных, len(срез["площадки"]), добавлено)
    return срез


# ---------------------------------------------------------------- точка входа

def режим_браузерной_задачи(сырое):
    """Служебный режим: сюда сам себя зовёт основной процесс, когда playwright
    живёт только в /opt/oko-agents/.venv."""
    try:
        з = json.loads(сырое)
        данные = _браузер_здесь(з["url"], з["js"], з.get("wait", "domcontentloaded"))
        print(json.dumps({"ok": True, "data": данные}, ensure_ascii=False))
    except Exception as e:                            # noqa: BLE001
        print(json.dumps({"ok": False, "error": f"{type(e).__name__}: {e}"},
                         ensure_ascii=False))
        return 1
    return 0


def main():
    p = argparse.ArgumentParser(description="сборщик метрик площадок Кластера")
    p.add_argument("--only", help="через запятую: instagram,youtube,dzen,vc,telegram,site")
    p.add_argument("--dry-run", action="store_true", help="посчитать и показать, ничего не писать")
    p.add_argument("--verbose", action="store_true", help="лог ещё и в консоль")
    p.add_argument("--browser-job", help=argparse.SUPPRESS)
    a = p.parse_args()

    if a.browser_job:
        return режим_браузерной_задачи(a.browser_job)

    настроить_лог(в_консоль=a.verbose or a.dry_run)
    только = {с.strip() for с in a.only.split(",")} if a.only else None

    try:
        with Замок(ЗАМОК):
            log.info("обход начат%s", f" (только {', '.join(sorted(только))})" if только else "")
            обойти(только=только, всухую=a.dry_run)
    except Занято as e:
        log.warning("пропускаю обход: %s", e)
        return 0
    except Exception as e:                            # noqa: BLE001
        log.exception("обход упал целиком: %s", e)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
