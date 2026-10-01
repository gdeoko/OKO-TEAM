"""Генерация через APIMODELS — вместо своей видеокарты.

## Зачем это появилось

Своя карта на Vast стоит около 780 $ в месяц, гаснет в простое,
поднимается четыре минуты и держит ОДНУ работу за раз: вторая встаёт в
очередь и человек ждёт чужой ролик. APIMODELS считает чужими картами,
сразу, параллельно и по факту: кадр 0,039, шесть секунд видео 0,12.
Решение владельца 01.10.2026: боевой движок — API, карта остаётся на
запас, переключатель в админке.

## Как это подключено, не переписывая бота

У бота тридцать с лишним обращений к объекту `gpu`: `upload`, `start`,
`wait`, `fetch`, `poll`, `free_vram`, `выбрать`, `отпустить`, `alive`,
`настроена`. Класс `Api` отвечает на ТЕ ЖЕ вызовы и теми же типами, что
`gpu.Gpu` — поэтому подмена объекта (`движок.py`) ничего в боте не
ломает и правкой тридцати мест не является.

Два вызова карты повторить нечем, и они честно возвращают None:

- `лицо()` — восстановитель лиц живёт на карте рядом с генерацией;
- `тело()` — SDXL LUSTIFY дорисовывает кожу и органы, тоже на карте.

Бот от None не падает: кадр без них просто хуже (`_починить_лицо`,
`_дорисовать_тело` ловят неудачу и отдают кадр как есть).

## Чего API не умеет вовсе

`mode="inpaint"` — правка по маске (раздевание по маске, `РАЗДЕТЬ`).
Своя ошибка на него поднимается нарочно: вызов обёрнут в try в боте и
кадр уходит общим проходом, как до появления маски.

## Грабли, оплаченные деньгами

- Задача идёт `pending → processing → completed`; `success` не бывает.
  Готовность вернее смотреть по `resultUrls`, а не по слову состояния:
  имена состояний у моделей разные, а ссылка либо есть, либо нет.
- Кадр в видео уходит полем `images` (СПИСОК). Поля `image`,
  `image_url`, `first_frame_image` сервис молча выбрасывает: ответ 200,
  задача принята, а ролик снят с нуля по тексту. Первый такой заход
  стоил 0,12 и дал другую женщину в другой комнате.
- Без `ratio` у видео выходит горизонталь 1344×768, а не вертикаль.
- `resolution` у видео строчными: `768p`.
- У фото референс уходит СРАЗУ двумя полями, `image` и `image_urls`, и
  оба списками — так он проверен в `кадр_снятия.py`.
- НЕГАТИВ ОТПРАВЛЯЕТСЯ. Первая версия этого клиента его выбрасывала —
  «поля для него тут нет» было моим предположением, а не проверкой, и
  стоило оно одетых кадров на боевом 01.10.2026. В негативе кнопки лежит
  ровно список «не одевай её»: clothed, dressed, underwear, bra,
  lingerie, panties, bikini, swimsuit. На карте он уходит вместе с
  промптом, и без него модель спокойно оставляет одежду с референса.
  Поле называется `negative_prompt`; модель, которая его не знает,
  отвечает четырёхсотой — тогда мы запоминаем это и дальше шлём без него
  (отказ стоит ноль, кадра он не тратит).
"""

import base64
import json
import os
import subprocess
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

from gpu import GpuError

БАЗА = os.environ.get("APIMODELS_BASE", "https://api.apimodels.app/v1")

# МОДЕЛИ. Выбор владельца 01.10.2026: фото — `qwen3-image` в 2K (78 с,
# 0,039, 1152×2048, держит лицо по референсу), видео — `minimax-h3-lite`
# в 768p (0,02 за секунду).
#
# Вынесено в окружение НАРОЧНО: модель подбирается глазами на живых
# кадрах, и менять её перевыкладкой бота — лишний риск ради одной
# строки. Рядом в каталоге APIMODELS лежат `z-image-spicy`,
# `z-image-spicy-pro` (фото) и `wan-2.7-i2v-spicy`, `wan-2.2-i2v-spicy`
# (видео) — ветка без модерации, на случай если общая модель откажется
# считать откровенную кнопку.
МОДЕЛЬ_ФОТО = os.environ.get("ROCKET_API_PHOTO", "qwen3-image")
МОДЕЛЬ_ВИДЕО = os.environ.get("ROCKET_API_VIDEO", "minimax-h3-lite")

# РАЗРЕШЕНИЕ КАДРА: 1K, а не 2K. Решение владельца 01.10.2026 — ради
# скорости. Замер на эталонной героине: 2K выходит за 78-85 секунд, 1K
# примерно вдвое быстрее и вдвое дешевле. В Телеграм картинка всё равно
# уходит пережатой, и разницу в деталях там видно не всегда; если на
# коже и лице она окажется заметной, вернуть 2K — это одна переменная
# окружения, без перевыкладки.
РАЗМЕР_ФОТО = os.environ.get("ROCKET_API_SIZE", "1K")
КАЧЕСТВО_ВИДЕО = os.environ.get("ROCKET_API_QUALITY", "768p")

# Стороны листа. Бот знает «vert» и «horiz» (`catalog.лист`), API —
# отношение сторон.
СТОРОНЫ = {"vert": "9:16", "horiz": "16:9", "sq": "1:1"}

ГОТОВО = ("completed", "success", "succeeded", "finished")
ПРОВАЛ = ("failed", "error", "fail", "cancelled", "canceled", "rejected")

# СКОЛЬКО ДЕРЖИМ БАЙТОВ В ПАМЯТИ. Снимки человека и готовые кадры лежат
# у нас, потому что у API нет своего хранилища имён: он принимает
# картинку в теле запроса и отдаёт ссылку на результат. Байты снимка
# нужны от загрузки до запуска задания, байты результата — от готовности
# до отправки в Телеграм, то есть минуты. Предел нужен от утечки, а не
# для экономии: 24 работы по десятку мегабайт это худший случай.
ХРАНИМ = int(os.environ.get("ROCKET_API_KEEP", "24"))

# Ниже этого остатка на счёте не берёмся за работу вовсе. Задача,
# принятая на пустом балансе, отвалится уже после списания коинов — а
# человек заплатил.
МИНИМУМ = float(os.environ.get("ROCKET_API_MIN", "0.2"))

# Сколько секунд верим прошлому ответу про баланс. `alive()` бот
# спрашивает перед каждой кнопкой, и гонять за этим сеть незачем.
БАЛАНС_ЖИВЁТ = 30

# ЧЕМ ПРЕДСТАВЛЯЕМСЯ, КОГДА ЗАБИРАЕМ ГОТОВЫЙ ФАЙЛ.
#
# Задача считается на стороне сервиса, а готовый файл лежит на раздаче, и
# раздача - это не API: ключ ей не нужен, зато она смотрит, кто пришёл.
# `urllib` по умолчанию представляется `Python-urllib/3.12`, и такому
# гостю раздача отвечает 403 - ровно это и поймал владелец 01.10.2026 на
# первой же кнопке: кадр посчитался за 85 секунд, деньги за него списаны,
# а файл не отдали. Наш же контент-завод всё это время качал результаты
# `curl`-ом и не знал беды - у него другое имя гостя, вот и вся разница.
БРАУЗЕР = {
    "User-Agent": ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
                   "(KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36"),
    "Accept": "image/avif,image/webp,image/*,video/*,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

# Сколько раз пробуем забрать файл. Отказ раздачи бывает и мгновенным
# (не понравился гость), и случайным - у края сети, через который нас
# пустили. Первый лечится заголовками, второй - повтором; обходятся они
# одинаково дёшево, а несчитанный кадр стоит уже уплаченных денег.
СКАЧАТЬ_ПОПЫТОК = int(os.environ.get("ROCKET_API_FETCH_TRIES", "3"))


class Api:
    def __init__(self, key=None, base=БАЗА, timeout=180):
        self.key = key if key is not None else os.environ.get("APIMODELS_KEY", "")
        self.base = (base or БАЗА).rstrip("/")
        self.timeout = timeout
        self.модель_фото = МОДЕЛЬ_ФОТО
        self.модель_видео = МОДЕЛЬ_ВИДЕО
        self._замок = threading.Lock()
        self._байты = {}              # имя -> содержимое (снимки и результаты)
        self._задачи = {}             # task_id -> {вид, т0, готово}
        self._счёт = 0
        self._баланс = (0.0, 0.0)     # (сколько, когда спрашивали)
        # Берёт ли этот вид запроса негатив. None — ещё не пробовали,
        # False — ответил отказом, больше не предлагаем. Спрашивается
        # один раз за жизнь процесса и ничего не стоит: запрос, который
        # не приняли, кадра не тратит.
        self._негатив = {}

    # ---------- то же, что у карты ----------

    @property
    def настроена(self):
        return bool(self.key)

    def карты(self):
        """У API нет карт. Один «адрес» — чтобы бот не считал движок
        ненастроенным там, где он смотрит на список."""
        return [self.base] if self.настроена else []

    def выбрать(self, род=None):
        """Выбирать нечего: задачи считаются параллельно и очереди нет.
        Метод оставлен, потому что бот зовёт его на каждом задании."""
        return self.base

    def отпустить(self):
        return None

    def alive(self):
        """Ключ рабочий и на счёте есть деньги."""
        if not self.настроена:
            return False
        try:
            return self.баланс() > МИНИМУМ
        except GpuError:
            return False

    def free_vram(self):
        """(остаток в долларах, он же, очередь). Памяти у API нет, а
        очередь всегда ноль: работы идут параллельно."""
        try:
            б = self.баланс()
        except GpuError:
            б = None
        return б, б, 0

    def лицо(self, filename, content, сила=0.5):
        """Восстановителя лиц в API нет. None — бот отдаст кадр как есть."""
        return None

    def тело(self, filename, content, кожа=None, зоны=None, сзади=False,
             пара=False):
        """Дорисовки кожи и органов в API нет. None — кадр как есть."""
        return None

    def upload(self, filename, content):
        """«Залить» снимок. У API нет хранилища имён, поэтому байты
        остаются у нас, а наружу уходит имя — его бот и передаёт в
        `start`, как передавал имя на карте."""
        with self._замок:
            self._счёт += 1
            имя = "%04d_%s" % (self._счёт, os.path.basename(filename or "in.png"))
            self._положить(имя, content)
        return имя

    def start(self, **params):
        """Запустить задачу. Возвращает (task_id, seed) — как карта."""
        вид, тело = self._запрос(params)
        try:
            о = self._зов("/%s/generations" % вид, тело)
        except GpuError as e:
            # Модель не знает поля негатива — повторяем без него и
            # запоминаем. Отказ стоит ноль, кадра он не тратит, поэтому
            # спросить дешевле, чем заранее решить за сервис (ровно на
            # таком «решении за сервис» 01.10.2026 и вышли одетые кадры).
            if "negative_prompt" not in тело or not _про_негатив(e):
                raise
            print("APIMODELS: %s не берёт negative_prompt, дальше без него"
                  % вид, flush=True)
            self._негатив[вид] = False
            тело.pop("negative_prompt")
            о = self._зов("/%s/generations" % вид, тело)
        tid = о.get("taskId") or о.get("task_id") or о.get("id")
        if not tid:
            raise GpuError("задачу не приняли: %s" % json.dumps(
                о, ensure_ascii=False)[:200])
        with self._замок:
            self._задачи[tid] = {"вид": вид, "т0": time.time(), "готово": None}
        return tid, params.get("seed") or 0

    def poll(self, job_id):
        """Состояние задачи словарём бота: state ok/err/run, files, sec."""
        with self._замок:
            з = self._задачи.get(job_id)
        if not з:
            raise GpuError("задача %s не наша" % str(job_id)[:40])
        if з["готово"]:
            return з["готово"]
        о = self._зов("/%s/generations?task_id=%s" % (з["вид"], job_id))
        сек = int(time.time() - з["т0"])
        сост = str(о.get("state") or о.get("status") or "").lower()
        ссылки = [с for с in (о.get("resultUrls") or о.get("result_urls") or [])
                  if с]
        if not ссылки:
            один = о.get("resultUrl") or о.get("url")
            if один:
                ссылки = [один]
        # Готовность по ССЫЛКЕ, а не по слову: названия состояний у
        # моделей разные, ссылка одна и та же.
        if ссылки or сост in ГОТОВО:
            if not ссылки:
                raise GpuError("задача готова, но файла нет: %s"
                               % json.dumps(о, ensure_ascii=False)[:200])
            имя = self._забрать(job_id, ссылки[0])
            итог = {"state": "ok", "sec": сек, "files": [имя],
                    "цена": self._цена(о)}
            with self._замок:
                self._задачи[job_id]["готово"] = итог
            return итог
        if сост in ПРОВАЛ:
            почему = (о.get("failReason") or о.get("error")
                      or о.get("msg") or сост)
            return {"state": "err", "sec": сек, "error": str(почему)[:300]}
        return {"state": сост or "run", "sec": сек}

    def wait(self, job_id, limit=900, on_tick=None):
        """Ждать результат. on_tick(секунд) — чтобы бот показывал счёт."""
        т0 = time.time()
        прошлый = -1
        while time.time() - т0 < limit:
            j = self.poll(job_id)
            if j.get("state") == "ok":
                return j
            if j.get("state") == "err":
                raise GpuError(j.get("error") or "генерация не удалась")
            сек = int(j.get("sec") or 0)
            if on_tick and сек != прошлый:
                on_tick(сек)
                прошлый = сек
            time.sleep(3)
        raise GpuError("слишком долго, отменяю")

    def fetch(self, filename):
        """Отдать байты по имени — снимка или готового файла."""
        with self._замок:
            данные = self._байты.get(filename)
        if данные is None:
            raise GpuError("файла %s уже нет" % str(filename)[:60])
        return данные

    # ---------- своё ----------

    def баланс(self, свежий=False):
        сколько, когда = self._баланс
        if not свежий and время_прошло(когда) < БАЛАНС_ЖИВЁТ:
            return сколько
        д = self._зов("/balance")
        сколько = float(д.get("balance") or 0)
        self._баланс = (сколько, time.time())
        return сколько

    def _запрос(self, params):
        """Параметры бота -> тело запроса APIMODELS."""
        режим = params.get("mode") or "photo"
        if режим == "inpaint":
            raise GpuError("правка по маске есть только на карте")
        стороны = СТОРОНЫ.get(params.get("size") or "vert", "9:16")
        рефы = self._рефы(params)
        промпт = params.get("prompt") or ""
        if режим == "video":
            вид = "video"
            тело = {"model": self.модель_видео, "prompt": промпт,
                    "resolution": КАЧЕСТВО_ВИДЕО, "ratio": стороны,
                    "duration": int(params.get("secs") or 5)}
            # ТОЛЬКО `images`, и только списком: см. грабли в шапке.
            if рефы:
                тело["images"] = рефы
        else:
            вид = "images"
            тело = {"model": self.модель_фото, "prompt": промпт,
                    "aspect_ratio": стороны, "resolution": РАЗМЕР_ФОТО}
            if рефы:
                тело["image"] = рефы
                тело["image_urls"] = рефы
        # НЕГАТИВ — ПОЛОВИНА РАБОТЫ, А НЕ УКРАШЕНИЕ. В нём список
        # «не одевай её», и без него модель оставляет одежду с референса.
        негатив = params.get("neg")
        if негатив and self._негатив.get(вид) is not False:
            тело["negative_prompt"] = негатив
        return вид, тело

    def _рефы(self, params):
        """Имена снимков -> data-URI. Имя, которого у нас нет, — ошибка:
        молча считать кадр без референса значит отдать человеку чужое
        лицо за его деньги."""
        имена = list(params.get("images") or [])
        if not имена and params.get("image"):
            имена = [params["image"]]
        итог = []
        for имя in имена:
            if isinstance(имя, str) and имя.startswith(("http", "data:")):
                итог.append(имя)
                continue
            итог.append("data:image/png;base64," + base64.b64encode(
                self.fetch(имя)).decode())
        return итог

    def _положить(self, имя, данные):
        """Байты под именем. Вызывать под замком."""
        if len(self._байты) >= ХРАНИМ:
            self._байты.pop(next(iter(self._байты)), None)
        self._байты[имя] = данные

    def _забрать(self, tid, ссылка):
        """Скачать результат и положить под нашим именем."""
        расш = ".mp4" if ".mp4" in ссылка.lower() else ".png"
        for гадать in (".jpg", ".jpeg", ".webp", ".webm"):
            if гадать in ссылка.lower():
                расш = гадать
                break
        имя = "out_%s%s" % (str(tid)[:16], расш)
        данные = self._скачать(ссылка)
        with self._замок:
            self._положить(имя, данные)
        return имя

    def _скачать(self, ссылка):
        """Забрать файл с раздачи. Байты или своя ошибка с разбором.

        Два разных способа подряд, и это не перестраховка. Кадр к этому
        моменту УЖЕ ПОСЧИТАН И ОПЛАЧЕН: не донеся его, мы теряем деньги
        и отдаём человеку осечку за них же. `curl` ходит своей
        библиотекой TLS и со своими умолчаниями - там, где споткнулся
        питон, он часто проходит, и наоборот.

        В ошибку кладётся ХОЗЯИН ссылки и причина каждой попытки:
        «403 от раздачи» и «сеть не пустила» лечатся по-разному, а общее
        «не скачался» их не различает. Сама ссылка подписанная и длинная,
        целиком её в переписку не тащим.
        """
        хозяин = urllib.parse.urlsplit(ссылка).netloc or "?"
        заголовки = dict(БРАУЗЕР)
        # Своей же раздаче показываем ключ: часть ответов сервиса лежит
        # за той же дверью, что и API.
        if хозяин.endswith("apimodels.app"):
            заголовки["Authorization"] = "Bearer " + self.key
        беды = []
        for попытка in range(1, СКАЧАТЬ_ПОПЫТОК + 1):
            try:
                з = urllib.request.Request(ссылка, headers=заголовки)
                with urllib.request.urlopen(з, timeout=self.timeout) as р:
                    данные = р.read()
                if данные:
                    return данные
                беды.append("%d/питон: пусто" % попытка)
            except Exception as e:                          # noqa: BLE001
                беды.append("%d/питон: %s" % (попытка, str(e)[:90]))
            try:
                п = subprocess.run(
                    ["curl", "-sL", "--max-time", str(self.timeout),
                     "-A", БРАУЗЕР["User-Agent"], ссылка],
                    capture_output=True, timeout=self.timeout + 30)
                if п.returncode == 0 and п.stdout:
                    return п.stdout
                беды.append("%d/curl: код %s" % (попытка, п.returncode))
            except Exception as e:                          # noqa: BLE001
                беды.append("%d/curl: %s" % (попытка, str(e)[:90]))
            if попытка < СКАЧАТЬ_ПОПЫТОК:
                time.sleep(2)
        raise GpuError("результат не скачался с %s: %s"
                       % (хозяин, "; ".join(беды)[:300]))

    @staticmethod
    def _цена(о):
        for к in ("credits", "cost", "price", "consume"):
            if isinstance(о.get(к), (int, float)):
                return о[к]
        return None

    def _зов(self, путь, тело=None):
        if not self.настроена:
            raise GpuError("APIMODELS не подключён (нет APIMODELS_KEY)")
        з = urllib.request.Request(
            self.base + путь,
            data=json.dumps(тело).encode() if тело is not None else None,
            method="POST" if тело is not None else "GET",
            headers={"Authorization": "Bearer " + self.key,
                     "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(з, timeout=self.timeout) as р:
                о = json.loads(р.read() or b"{}")
        except urllib.error.HTTPError as e:
            # Текст отказа модерации приходит ИМЕННО ЗДЕСЬ, и он нужен
            # целиком: «не вышло» про откровенную кнопку и «кончились
            # деньги» — разные беды с разным лечением.
            raise GpuError("%s: %s" % (
                e.code, e.read()[:300].decode("utf-8", "replace"))) from None
        except Exception as e:                              # noqa: BLE001
            raise GpuError(str(e)[:200]) from None
        if о.get("code") not in (200, None, 0):
            raise GpuError("APIMODELS %s: %s"
                           % (о.get("code"), str(о.get("msg"))[:200]))
        д = о.get("data")
        return д if isinstance(д, dict) else (о if isinstance(о, dict) else {})


def время_прошло(когда):
    return time.time() - (когда or 0)


def _про_негатив(ошибка):
    """Отказ именно про поле негатива, а не про что-нибудь ещё.

    Делить обязательно: на «кончились деньги» или «модерация» повторять
    запрос без негатива значит заплатить второй раз за тот же отказ — и
    получить одетый кадр там, где он был бы правильным.
    """
    т = str(ошибка).lower()
    return "negative" in т and ("400" in т or "unknown" in т
                                or "unsupported" in т or "invalid" in т
                                or "unexpected" in т or "not allowed" in т)
