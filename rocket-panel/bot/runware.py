# -*- coding: utf-8 -*-
"""Runware - откровенные кнопки в два прохода.

## Зачем появился третий движок

APIMODELS считает быстро и дёшево, но режет откровенный промпт и рисует
гладкий пах: кнопки `un_*`, `ph_*`, `ac_*`, `pf_*`, `pr_*` она
отрабатывает наполовину. fal.ai отказывает на любую наготу, RunPod
запрещает такое договором. Перебрали весь каталог Runware (3544
чекпоинта, 23 модели на двух кнопках, 40 кадров) и остановились на нём:
эталонный текст кнопки «Крупный план» в 1680 знаков про половые органы
прошёл целиком, без возражений и без укорачивания.

Карта и APIMODELS при этом никуда не деваются. Переключатель в
`движок.py` остаётся тот же, у него появляется третье значение.

## ОДНОЙ МОДЕЛИ, КОТОРАЯ ДЕЛАЕТ ВСЁ, НЕТ. Это устройство, а не плохой поиск

Схожесть лица и детальную анатомию натренировали в разные семьи моделей,
и никакой перебор их не соединит: reference-движков в каталоге ровно
семь, и это число не изменилось после ПОЛНОЙ выгрузки. Дальше можно
найти лучшего рисовальщика органов, но никогда - схожесть. Поэтому
проходов два:

    1. лицо, фигура, поза   qwen-image-edit@2511 + unchained   13,5 с
    2. орган по маске паха  LUSTIFY v8, strength 0.85          10,2 с

Итого около 24 секунд на кадр, 34 на паре с двумя референсами. Лимит
бота - минута, запас двукратный даже на паре.

## Второй проход идёт НЕ ВСЕГДА, и это про деньги и про время

Он нужен там, где пах в кадре крупно: интимное соло, обе пары и три
ракурса ню (крупно, снизу, сверху). На «ню в полный рост» и «со спины»
он только тратит десять секунд и рискует испортить кадр правкой по
маске там, где правка не нужна.

## Грабли, оплаченные часом и кадрами

- **IP-Adapter кормить КРОПОМ ЛИЦА.** С фигуры в полный рост (лицо на
  сотую часть кадра) адаптер выдал постороннюю блондинку. Выглядит как
  «лицо не переносится вообще», а дело в подготовке снимка.
- **PuLID наоборот**: ровно один снимок, и это фигура или голова с
  полями; плотный кроп он отбивает `objectNotFound`.
- **Анатомические LoRA к Qwen-Edit не цепляются вовсе**
  (`unsupportedLoraModel`): они собраны под `qwen_image`
  text-to-image, а не под `qwen_image_edit_plus`.
- **Инпейнт-чекпоинт LUSTIFY `620440@916648` ХУЖЕ обычного**: уводит
  кожу в зелёно-коричневый и портит фактуру вокруг маски. Для второго
  прохода только `573152@1094291`.
- **img2img для кнопок не годится**: держит лицо, но намертво держит и
  позу исходного фото, а поза - это и есть обещание кнопки.
- `runware:108@20` требует РОВНО ОДИН референс, два дают
  `invalidReferenceImagesCount`.
- Листы ракурсов персонажа (коллаж из семи видов) подавать нельзя:
  модель получит коллаж. Резать на кадр фигуры и крупный план лица.
- **`cost` в ответе всегда `null`.** Сколько ушло, по API не видно,
  только в их панели. Поэтому баланс здесь не спрашивается, а
  `free_vram` честно отвечает «неизвестно» вместо выдуманного числа.
- **Скачивание по `imageURL` иногда отдаёт 502 от прокси.** Ответ в сто
  байт - это HTML, а не PNG. Тянем с повтором и проверяем размер: кадр
  к этому моменту уже посчитан и оплачен.

    python3 -m bot.runware проба <снимок.png> [кнопка]
"""
import base64
import hashlib
import io
import json
import os
import subprocess
import tempfile
import threading
import time
import urllib.error
import urllib.request
import uuid

import cv2
import numpy as np

from gpu import GpuError

try:
    import konveyer as конвейер
    import лицо_выбор
except Exception as _e:                                     # noqa: BLE001
    # Конвейер по эталону не обязателен: без него бот работает прежним
    # путём, а не падает при старте.
    print("RUNWARE: конвейер по эталону недоступен: %s" % str(_e)[:160],
          flush=True)
    конвейер = None
    лицо_выбор = None

try:
    import кнопка_сборка as сборка_кнопки
except Exception as _e2:                                    # noqa: BLE001
    # Новая сборка требует ultralytics: без него бот считает кадры
    # прежним путём, а не падает при старте. Прежний путь хуже - он не
    # ловит сросшиеся тела и ставит одно лицо на парной кнопке, - но
    # это работающий бот вместо неработающего.
    print("RUNWARE: новая сборка кнопки недоступна: %s" % str(_e2)[:160],
          flush=True)
    сборка_кнопки = None

БАЗА = os.environ.get("RUNWARE_URL", "https://api.runware.ai/v1")
КЛЮЧ_СРЕДЫ = "RUNWARE_KEY"

# ---------- рецепт (проверен живьём 02.10.2026) ----------

МОДЕЛЬ_ЛИЦО = "alibaba:qwen-image-edit@2511"
ЛОРА_ЛИЦО = "watisha:166@166"            # qwen_2509_unchained
ЛОРА_ВЕС = 0.9
ШАГИ_ЛИЦО = 30
CFG_ЛИЦО = 4.0

МОДЕЛЬ_ОРГАН = "civitai:573152@1094291"  # LUSTIFY! v8, SDXL
ШАГИ_ОРГАН = 30
CFG_ОРГАН = 5.5
СИЛА_ОРГАН = 0.85

# Размеры кратны 64: иначе сервис округляет сам и кадр едет.
РАЗМЕРЫ = {"vert": (832, 1216), "horiz": (1216, 832), "sq": (1024, 1024)}

# Эллипс маски в долях кадра: центр и полуоси. Числа от прогона 02.10,
# когда скелета нет. Со скелетом маска считается по бёдрам.
МАСКА_ЦЕНТР = (0.50, 0.72)
МАСКА_ОСИ = (0.26, 0.17)
МАСКА_БЛЮР = 14

# Кнопки, которым нужен второй проход: пах в кадре крупно.
ОРГАН_НАДО = set(("""
un_close un_low un_over
ph_pov ph_close ph_side ph_above ph_below ph_push ph_pull ph_mirror ph_slow
ac_pov ac_close ac_side ac_above ac_below ac_push ac_pull ac_mirror ac_slow
pf_mf_near pf_mf_face pf_mf_behind pf_mf_above pf_mf_close pf_mf_pov
pr_mf_near pr_mf_face pr_mf_behind pr_mf_above pr_mf_close pr_mf_pov
pf_ff_near pf_ff_face pf_ff_behind pf_ff_above pf_ff_close pf_ff_pov
pr_ff_near pr_ff_face pr_ff_behind pr_ff_above pr_ff_close pr_ff_pov
""").split())

# Промпт второго прохода. Он НЕ повторяет текст кнопки: тот описывает
# сцену, свет и позу, а здесь работа идёт по маске размером с ладонь, и
# всё, что не про анатомию, только отвлекает модель.
ОРГАН_ТЕКСТ = (
    "extreme macro photography of female genitals, anatomically correct "
    "vulva with clearly separated outer and inner labia, visible clitoral "
    "hood, natural asymmetry, fine skin folds and creases, realistic skin "
    "pores and texture, soft natural moisture, subsurface scattering, "
    "shallow depth of field, sharp focus, photorealistic, 8k detail")
ОРГАН_ТЕКСТ_ПАРА = (
    "extreme macro photography of explicit intercourse, anatomically "
    "correct genitals of both partners in contact, clearly separated labia, "
    "realistic skin folds, pores and texture, natural moisture, "
    "subsurface scattering, sharp focus, photorealistic, 8k detail")
ОРГАН_НЕГАТИВ = (
    "smooth featureless crotch, doll anatomy, plastic skin, airbrushed, "
    "blurry, deformed, extra limbs, text, watermark, cartoon, painting")

ЖИВОСТЬ_ЖИВЁТ = 60              # секунд верим прошлому ответу про ключ
ХРАНИМ = 400                    # байтов скольких файлов держим в памяти
СКАЧАТЬ_ПОВТОРОВ = 3
МИНИМУМ_ФАЙЛА = 2048            # меньше - это HTML ошибки, а не картинка


class Runware:
    def __init__(self, key=None, base=БАЗА, timeout=180, store=None):
        self.key = key or os.environ.get(КЛЮЧ_СРЕДЫ) or ""
        self.base = base
        self.timeout = timeout
        self.store = store
        self._замок = threading.Lock()
        self._байты = {}
        self._счёт = 0
        self._задачи = {}
        self._поток = threading.local()
        self._жив = (None, 0.0)
        self._лица_память = {}

    # ---------- то же, что у карты и у APIMODELS ----------

    @property
    def настроена(self):
        return bool(self.key)

    def карты(self):
        return [self.base] if self.настроена else []

    def выбрать(self, род=None):
        """Выбирать нечего: задачи считаются параллельно, очереди нет."""
        return self.base

    def отпустить(self):
        return None

    def alive(self):
        """Ключ рабочий. Спрашиваем ПОИСКОМ ПО КАТАЛОГУ: он бесплатен, а
        баланса в их API нет вовсе. Генерацией проверять живость нельзя -
        это платный ответ на бесплатный вопрос.

        Ответ держим минуту. Переключатель движка спрашивает живость на
        каждом задании, и без памяти к каждому кадру добавлялся бы лишний
        поход в сеть - полсекунды там, где человек и так ждёт.
        """
        if not self.настроена:
            return False
        знач, когда = self._жив
        if знач is not None and time.time() - когда < ЖИВОСТЬ_ЖИВЁТ:
            return знач
        try:
            о = self._зов([{"taskType": "modelSearch",
                            "taskUUID": str(uuid.uuid4()),
                            "search": "LUSTIFY", "category": "checkpoint",
                            "limit": 1}])
            знач = bool(о)
        except GpuError:
            знач = False
        self._жив = (знач, time.time())
        return знач

    def free_vram(self):
        """(остаток, всего, очередь). Остатка сервис не отдаёт - `cost`
        приходит `null`, баланса в API нет. Возвращаем None вместо
        выдуманного числа: ноль бот прочитал бы как «денег нет»."""
        return None, None, 0

    def лицо(self, filename, content, сила=0.5):
        """Восстановителя лиц нет: лицо держит первый проход."""
        return None

    def тело(self, filename, content, кожа=None, зоны=None, сзади=False,
             пара=False):
        """Дорисовки нет отдельным вызовом: её делает второй проход."""
        return None

    def upload(self, filename, content):
        with self._замок:
            self._счёт += 1
            имя = "%04d_%s" % (self._счёт,
                               os.path.basename(filename or "in.png"))
            self._положить(имя, content)
        return имя

    def start(self, **params):
        """Запустить задание. Возвращает (id, seed), как карта.

        Генерация у Runware синхронная, а бот ждёт через `poll`/`wait` и
        показывает человеку счёт секунд. Поэтому проходы считает фоновый
        поток, а `poll` отвечает из его состояния. Иначе бот замер бы на
        двадцать четыре секунды без единого признака жизни.
        """
        if (params.get("mode") or "photo") == "video":
            raise GpuError("видео на Runware не проверяли, его считает API")
        tid = "rw_%s" % uuid.uuid4().hex[:12]
        with self._замок:
            self._задачи[tid] = {"т0": time.time(), "готово": None,
                                 "отказ": None}
        поток = threading.Thread(target=self._работа, args=(tid, params),
                                 daemon=True)
        поток.start()
        print("RUNWARE: задание %s, кнопка %s"
              % (tid, params.get("сцена") or "-"), flush=True)
        return tid, params.get("seed") or 0

    def poll(self, job_id):
        with self._замок:
            з = self._задачи.get(job_id)
        if not з:
            raise GpuError("задача %s не наша" % str(job_id)[:40])
        сек = int(time.time() - з["т0"])
        if з.get("готово"):
            return з["готово"]
        if з.get("отказ"):
            return {"state": "err", "sec": сек, "error": з["отказ"]}
        return {"state": "run", "sec": сек}

    def повторяемый(self, job_id):
        """Отказ был на канале, а не по делу.

        Повторяем только сетевые обрывы и таймауты. Отказ модели -
        неподдерживаемая лора, кривое поле, пустая маска - повторится
        слово в слово, а человек прождёт вдвое дольше.
        """
        with self._замок:
            з = self._задачи.get(job_id) or {}
        текст = str(з.get("отказ") or "").lower()
        if not текст:
            return False
        return any(с in текст for с in
                   ("timed out", "timeout", "connection", "502", "503",
                    "504", "сеть", "reset"))

    def wait(self, job_id, limit=900, on_tick=None):
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
            time.sleep(1)
        raise GpuError("слишком долго, отменяю")

    def fetch(self, filename):
        with self._замок:
            данные = self._байты.get(filename)
        if данные is None:
            raise GpuError("файла %s уже нет" % str(filename)[:60])
        return данные

    # ---------- два прохода ----------

    def _работа(self, tid, params):
        """Фоновая часть задания: кадр кнопки от начала до конца."""
        try:
            if сборка_кнопки is not None and конвейер is not None \
                    and конвейер.есть_гайд(params.get("сцена") or ""):
                кадр = self._новой_сборкой(params)
            elif конвейер is not None and конвейер.есть_гайд(
                    params.get("сцена") or ""):
                кадр = self._по_эталону(params)
            else:
                # Кнопки без принятого эталона («оживить свой снимок»)
                # идут прежним путём: там нет позы, которую надо
                # повторить, и карте глубины взяться неоткуда.
                кадр = self._проход_лицо(params)
                if нужен_орган(params.get("сцена")):
                    try:
                        кадр = self._проход_орган(кадр, params)
                    except GpuError as e:
                        # ВТОРОЙ ПРОХОД НЕ ВАЛИТ ЗАДАНИЕ. Кадр с лицом,
                        # фигурой и позой уже посчитан и оплачен: отдать
                        # его честнее, чем вернуть человеку осечку из-за
                        # правки, которая всего лишь не удалась.
                        print("RUNWARE: второй проход не вышел, отдаю "
                              "первый: %s" % str(e)[:160], flush=True)
            имя = "out_%s.png" % tid[3:]
            with self._замок:
                self._положить(имя, кадр)
                сек = int(time.time() - self._задачи[tid]["т0"])
                self._задачи[tid]["готово"] = {
                    "state": "ok", "sec": сек, "files": [имя]}
        except Exception as e:                              # noqa: BLE001
            with self._замок:
                self._задачи[tid]["отказ"] = str(e)[:400]


    # ---------- кадр новой сборкой ----------

    def _новой_сборкой(self, params):
        """Кадр кнопки сборкой, собранной прогоном семисот кадров.

        Отличия от `_по_эталону`, и каждое стоит замера:
        модель, вес гайда и кадрирование у каждой кнопки свои; приёмка
        считает скелеты, а не маску силуэта; поза сверяется с силуэтом
        карты глубины; на парной кнопке ставятся ДВА лица - клиентки и
        нашего партнёра; голова встраивается по градиенту, а не
        вставляется эллипсом.

        Старый путь остаётся рядом и работает: он включается, если
        новая сборка не поднялась (нет ultralytics или моделей лиц).
        """
        ключ = params.get("сцена") or ""
        рефы = self._рефы(params)
        кнп = self._кнопка()
        осн = кнп.основа(ключ, найти_лица=self._найти_лица)
        if осн["дефекты"]:
            print("RUNWARE %s: отдаю лучшую основу, осталось: %s"
                  % (ключ, "; ".join(осн["дефекты"])), flush=True)
        if not рефы:
            return осн["байты"]
        # Руки чинятся ДО лица: правка идёт по маске предплечий, и
        # делать её после сборки головы значит рисковать уже готовым
        # лицом, если маска заденет край подбородка.
        основа_кадр = кнп.доводка(осн["кадр"])
        if основа_кадр is not осн["кадр"]:
            осн["байты"] = cv2.imencode(".png", основа_кадр)[1].tobytes()
            осн["кадр"] = основа_кадр
        готово, беда = кнп.поставить_лица(ключ, осн["байты"], осн["кадр"],
                                          рефы[0], self._найти_лица)
        if беда:
            print("RUNWARE %s: лица не встали (%s), отдаю основу"
                  % (ключ, беда), flush=True)
        return cv2.imencode(".png", готово)[1].tobytes()

    def _кнопка(self):
        if getattr(self, "_кнп", None) is None:
            self._кнп = сборка_кнопки.Кнопка(рв=self)
        return self._кнп

    def _найти_лица(self, кадр):
        """Лица отдельным процессом: своё окружение, свой protobuf.

        Ответ запоминается по кадру. Приёмка спрашивает лица у каждого
        зерна, а потом их спрашивает ещё и сборка лиц: без памяти это
        четыре запуска распознавателя на одну кнопку, каждый со своей
        загрузкой весов. Запоминаем немного: кадры тяжёлые.

        Переменной `OKO_FACE_PY` нет - шаг молча пропускается, и кадр
        уходит с одним лицом. Это хуже, но это кадр, а не осечка.
        """
        питон = os.environ.get("OKO_FACE_PY")
        if not питон or not os.path.exists(питон):
            return []
        метка = hashlib.md5(cv2.imencode(".png", кадр)[1].tobytes()).hexdigest()
        если_помним = self._лица_память.get(метка)
        if если_помним is not None:
            return если_помним
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as ф:
            cv2.imwrite(ф.name, кадр)
            путь = ф.name
        try:
            о = subprocess.run(
                [питон, os.path.join(os.path.dirname(os.path.abspath(__file__)),
                                     "лица_процесс.py"), путь],
                capture_output=True, timeout=180)
            строки = (о.stdout or b"").decode().strip().splitlines()
            найдено = json.loads(строки[-1]) if строки else []
            if len(self._лица_память) > 16:
                self._лица_память.clear()
            self._лица_память[метка] = найдено
            return найдено
        except Exception as e:                              # noqa: BLE001
            print("RUNWARE: лица не разобрались: %s" % str(e)[:140],
                  flush=True)
            return []
        finally:
            os.unlink(путь)

    # ---------- кадр по принятому эталону ----------

    def _по_эталону(self, params):
        """Основа по эталону, потом лицо клиентки, потом сборка.

        Основа пересчитывается с другим зерном, пока приёмка не примет
        её или не кончатся попытки: дефект вроде лишней ноги или
        срезанной головы зависит именно от зерна, и двадцать секунд
        пересчёта дешевле круга правок с человеком.

        Лицо считается несколькими зёрнами сразу и берётся лучшее:
        разброс узнаваемости у Klein большой, и первый ответ это
        лотерея, а не выбор.
        """
        import priyomka_kadra as ПК

        ключ = params.get("сцена") or ""
        ш, в = РАЗМЕРЫ.get(params.get("size") or "vert", РАЗМЕРЫ["vert"])
        if конвейер.пара(ключ) and (params.get("size") or "vert") == "vert":
            # Ориентацию парных поз знает каталог, и она не всегда
            # вертикальная: горизонтальный эталон в вертикальном кадре
            # обрезает одного из двоих.
            try:
                import catalog
                if catalog.ЖЁСТКИЙ_ЛИСТ.get(конвейер.короткий(ключ)) == "horiz":
                    ш, в = РАЗМЕРЫ["horiz"]
            except Exception:                               # noqa: BLE001
                pass

        эталон_сил = None
        путь_эт = os.path.join(конвейер.ГАЙДЫ, конвейер.короткий(ключ)
                               + ".jpg")
        if os.path.exists(путь_эт):
            # Силуэт берём с карты глубины: сам эталон на машине бота не
            # лежит, а карта повторяет фигуру достаточно точно.
            карта = cv2.imread(путь_эт, cv2.IMREAD_GRAYSCALE)
            if карта is not None:
                эталон_сил = cv2.resize(карта, (208, 304)) > 40

        зерно = int(params.get("seed") or 0)
        зёрна = ([зерно] if зерно else []) + [
            з for з in конвейер.ЗЁРНА if з != зерно]
        лучшая, лучбалл, лучбеды = None, 1e9, []
        for н, з in enumerate(зёрна[:конвейер.ПОПЫТОК]):
            т0 = time.time()
            кадр = self._кадр(конвейер.тело_основы(
                ключ, ш, в, з, _дата_ури, params.get("prompt") or None,
                params.get("neg") or None))
            к = cv2.imdecode(np.frombuffer(кадр, np.uint8), cv2.IMREAD_COLOR)
            беды, балл = ПК.проверить(к, эталон_сил, конвейер.пара(ключ))
            print("RUNWARE основа %s, круг %d: %.1f с, %s"
                  % (ключ, н + 1, time.time() - т0,
                     "чисто" if not беды else "; ".join(беды)), flush=True)
            if балл < лучбалл:
                лучшая, лучбалл, лучбеды = кадр, балл, беды
            if not беды:
                break
        if лучшая is None:
            raise GpuError("основу посчитать не вышло")
        if лучбеды:
            print("RUNWARE: отдаю лучшую из %d, осталось: %s"
                  % (min(len(зёрна), конвейер.ПОПЫТОК), "; ".join(лучбеды)),
                  flush=True)

        рефы = self._рефы(params)
        if not рефы:
            return лучшая
        осн = cv2.imdecode(np.frombuffer(лучшая, np.uint8), cv2.IMREAD_COLOR)
        л = ПК.лицо(осн)
        доля = (л[2] * л[3]) / float(ш * в) if л else 0.0
        сколько = конвейер.попыток_лица(доля)
        варианты = []
        for з in конвейер.ЗЁРНА_ЛИЦА[:сколько]:
            try:
                б = self._кадр(конвейер.тело_лица(лучшая, рефы[0], ш, в, з,
                                                  _дата_ури))
            except GpuError as e:
                print("RUNWARE лицо: зерно %d не вышло: %s"
                      % (з, str(e)[:120]), flush=True)
                continue
            нов = cv2.imdecode(np.frombuffer(б, np.uint8), cv2.IMREAD_COLOR)
            варианты.append(конвейер.собрать_голову(осн, нов))
        if not варианты:
            # Лицо не встало - отдаём основу: поза, анатомия и комната в
            # ней верные, а это уже оплаченная работа.
            print("RUNWARE: лицо не встало ни на одном зерне, отдаю основу",
                  flush=True)
            return лучшая
        снимки = self._рефы_кадры(params)
        итог = лицо_выбор.лучший(варианты, рефы_кадры=снимки)
        # Последний шаг: черты клиентки поверх. Включается переменной
        # OKO_SWAP и мягко пропускается, если модели нет.
        try:
            import лицо_своп
            if лицо_своп.доступен() and снимки:
                т0 = time.time()
                правленый = лицо_своп.наложить(итог, снимки[0])
                if правленый is not None:
                    итог = правленый
                    print("RUNWARE лицо: черты клиентки наложены за %.1f с"
                          % (time.time() - т0), flush=True)
        except Exception as e:                              # noqa: BLE001
            print("RUNWARE: шаг черт лица пропущен: %s" % str(e)[:140],
                  flush=True)
        return cv2.imencode(".png", итог)[1].tobytes()

    def _рефы_кадры(self, params):
        """Снимки клиента картинками: по ним и меряется узнаваемость."""
        кадры = []
        имена = list(params.get("images") or [])
        if not имена and params.get("image"):
            имена = [params["image"]]
        for имя in имена:
            данные = self._байты.get(имя) if isinstance(имя, str) else имя
            if not данные:
                continue
            к = cv2.imdecode(np.frombuffer(данные, np.uint8),
                             cv2.IMREAD_COLOR)
            if к is not None:
                кадры.append(к)
        return кадры

    def _проход_лицо(self, params):
        """Проход 1: лицо, фигура, поза клиента. Возвращает байты кадра."""
        ш, в = РАЗМЕРЫ.get(params.get("size") or "vert", РАЗМЕРЫ["vert"])
        тело = {"taskType": "imageInference",
                "taskUUID": str(uuid.uuid4()),
                "model": МОДЕЛЬ_ЛИЦО,
                "positivePrompt": params.get("prompt") or "",
                "width": ш, "height": в,
                "steps": ШАГИ_ЛИЦО, "CFGScale": CFG_ЛИЦО,
                "numberResults": 1,
                "outputType": "URL", "outputFormat": "PNG",
                "lora": [{"model": ЛОРА_ЛИЦО, "weight": ЛОРА_ВЕС}]}
        if params.get("neg"):
            тело["negativePrompt"] = params["neg"]
        if params.get("seed"):
            тело["seed"] = int(params["seed"])
        рефы = self._рефы(params)
        if рефы:
            тело["referenceImages"] = рефы
        т0 = time.time()
        кадр = self._кадр(тело)
        print("RUNWARE проход 1: %.1f с, референсов %d"
              % (time.time() - т0, len(рефы)), flush=True)
        return кадр

    def _проход_орган(self, кадр, params):
        """Проход 2: орган по маске паха. Возвращает байты кадра."""
        ш, в = РАЗМЕРЫ.get(params.get("size") or "vert", РАЗМЕРЫ["vert"])
        пара = (params.get("сцена") or "").startswith(("pf_", "pr_"))
        тело = {"taskType": "imageInference",
                "taskUUID": str(uuid.uuid4()),
                "model": МОДЕЛЬ_ОРГАН,
                "positivePrompt": ОРГАН_ТЕКСТ_ПАРА if пара else ОРГАН_ТЕКСТ,
                "negativePrompt": ОРГАН_НЕГАТИВ,
                "width": ш, "height": в,
                "steps": ШАГИ_ОРГАН, "CFGScale": CFG_ОРГАН,
                "strength": СИЛА_ОРГАН,
                "numberResults": 1,
                "outputType": "URL", "outputFormat": "PNG",
                "seedImage": _дата_ури(кадр),
                "maskImage": _дата_ури(маска_паха(кадр, ш, в))}
        т0 = time.time()
        итог = self._кадр(тело)
        print("RUNWARE проход 2: %.1f с" % (time.time() - т0), flush=True)
        return итог

    # ---------- разговор с сервисом ----------

    def _кадр(self, задача):
        """Одна задача генерации -> байты картинки."""
        о = self._зов([задача])
        ссылка = ""
        for д in о:
            ссылка = д.get("imageURL") or д.get("imageUrl") or ""
            if ссылка:
                break
            if д.get("imageBase64Data"):
                return base64.b64decode(д["imageBase64Data"])
        if not ссылка:
            raise GpuError("сервис не отдал картинку: %s"
                           % json.dumps(о, ensure_ascii=False)[:200])
        return self._скачать(ссылка)

    def _зов(self, задачи):
        """POST массивом задач. Возвращает список `data` или своя ошибка."""
        if not self.настроена:
            raise GpuError("нет ключа RUNWARE_KEY")
        данные = json.dumps(задачи).encode()
        зап = urllib.request.Request(
            self.base, data=данные, method="POST",
            headers={"Content-Type": "application/json",
                     "Authorization": "Bearer " + self.key})
        try:
            with urllib.request.urlopen(зап, timeout=self.timeout) as от:
                ответ = json.loads(от.read().decode("utf-8", "ignore"))
        except urllib.error.HTTPError as e:
            тело = e.read().decode("utf-8", "ignore")[:400]
            raise GpuError("Runware %s: %s" % (e.code, _почему(тело)))
        except Exception as e:                              # noqa: BLE001
            raise GpuError("Runware: сеть не пустила (%s)" % str(e)[:120])
        # ОШИБКИ ЛЕЖАТ РЯДОМ С ДАННЫМИ, А НЕ В КОДЕ ОТВЕТА. Задача может
        # не выполниться при HTTP 200: сервис кладёт причину в `errors`.
        if isinstance(ответ, dict) and ответ.get("errors"):
            raise GpuError("Runware: %s" % _почему(
                json.dumps(ответ["errors"], ensure_ascii=False)))
        данные = (ответ or {}).get("data") if isinstance(ответ, dict) else None
        if not данные:
            raise GpuError("Runware: пустой ответ %s"
                           % json.dumps(ответ, ensure_ascii=False)[:200])
        return данные

    def _рефы(self, params):
        """Имена снимков -> data-URI. Имя, которого у нас нет, это ошибка:
        считать кадр без референса значит отдать чужое лицо за деньги
        человека.

        ПЕРВЫМ ИДЁТ КРОП ЛИЦА, И БЕЗ НЕГО СХОЖЕСТИ НЕТ. Текстовый
        энкодер Qwen режет каждый снимок до 384 на 384 суммарно
        (`лицо_реф`): у человека, снятого в полный рост, на лицо
        остаётся около тридцати пикселей, и это не лицо, а пятно.
        Живая проба 02.10.2026 ровно это и показала - фигура Марии
        перенеслась, а лицо вышло чужим и старше. Лечится входом, а не
        промптом: кроп забирает весь бюджет слота себе.
        """
        имена = list(params.get("images") or [])
        if not имена and params.get("image"):
            имена = [params["image"]]
        итог = []
        for имя in имена:
            if isinstance(имя, str) and имя.startswith(("http", "data:")):
                итог.append(имя)
                continue
            итог.append(_дата_ури(self.fetch(имя)))
        # Кроп добавляем только к ОДИНОЧНОМУ снимку. На паре лиц два, и
        # кроп одного из них перетянул бы на себя обоих персонажей.
        if len(итог) == 1 and not итог[0].startswith("http"):
            лицо = кроп_лица_ури(итог[0])
            if лицо:
                итог.insert(0, лицо)
        return итог

    def _скачать(self, ссылка):
        """Забрать кадр с раздачи. Повтор обязателен: раздача иногда
        отдаёт 502 от прокси, а кадр уже посчитан и оплачен. Ответ
        короче двух килобайт - это страница ошибки, а не картинка."""
        беды = []
        for n in range(СКАЧАТЬ_ПОВТОРОВ):
            try:
                with urllib.request.urlopen(ссылка, timeout=self.timeout) as о:
                    данные = о.read()
                if len(данные) >= МИНИМУМ_ФАЙЛА:
                    return данные
                беды.append("пришло %d байт, это не картинка" % len(данные))
            except Exception as e:                          # noqa: BLE001
                беды.append(str(e)[:80])
            time.sleep(1 + n)
        raise GpuError("кадр посчитан, но не скачался: %s" % "; ".join(беды))

    def _положить(self, имя, данные):
        """Байты под именем. Вызывать под замком."""
        if len(self._байты) >= ХРАНИМ:
            self._байты.pop(next(iter(self._байты)), None)
        self._байты[имя] = данные


# ---------- маска паха ----------

def нужен_орган(сцена):
    """Нужен ли второй проход этой кнопке."""
    return bool(сцена) and сцена in ОРГАН_НАДО


def маска_паха(кадр, ш, в):
    """Белый размытый эллипс на чёрном: где дорисовывать орган.

    Сначала пробуем СКЕЛЕТ: у кнопок есть сидящие, лежащие и снятые
    снизу позы, и у них пах лежит совсем не там, где у стоящей. Эллипс
    по долям кадра на таких кадрах правит бедро или простыню, то есть
    тратит десять секунд и портит то, что было хорошо.

    Скелета нет (mediapipe не поставлен, человека не нашли) - встаёт
    эллипс из прогона 02.10. Это хуже, но это работает, и промолчать
    здесь нельзя: тихий откат к худшему и есть то, что потом ищут часами.
    """
    import numpy as np
    узлы = _скелет(кадр)
    if узлы:
        цх, цу, ох, оу = _эллипс_по_скелету(узлы)
    else:
        цх, цу = МАСКА_ЦЕНТР
        ох, оу = МАСКА_ОСИ
        print("RUNWARE: скелета нет, маска паха по долям кадра", flush=True)
    маска = np.zeros((в, ш), dtype=np.uint8)
    import cv2
    cv2.ellipse(маска, (int(цх * ш), int(цу * в)),
                (max(8, int(ох * ш)), max(8, int(оу * в))),
                0, 0, 360, 255, -1)
    k = МАСКА_БЛЮР * 2 + 1
    маска = cv2.GaussianBlur(маска, (k, k), 0)
    ок, буфер = cv2.imencode(".png", маска)
    if not ок:
        raise GpuError("маску не удалось собрать")
    return буфер.tobytes()


def _эллипс_по_скелету(узлы):
    """Центр и полуоси паха по бёдрам и коленям, в долях кадра.

    Пах лежит чуть НИЖЕ линии бёдер, в сторону колен: на этой линии сам
    таз. Сдвиг берём долей от расстояния бедро-колено, а не числом -
    иначе крупный план и полный рост разъедутся.
    """
    бл, бп = узлы["бедро_л"], узлы["бедро_п"]
    цх = (бл[0] + бп[0]) / 2.0
    цу = (бл[1] + бп[1]) / 2.0
    колени = [узлы[и] for и in ("колено_л", "колено_п")
              if узлы.get(и) and узлы[и][2] > 0.3]
    длина = max([abs(к[1] - цу) for к in колени] or [0.0])
    цу += 0.18 * длина if длина else 0.04
    ширина = abs(бл[0] - бп[0])
    ох = max(0.10, min(0.30, ширина * 0.75))
    оу = max(0.08, min(0.22, (длина * 0.35) if длина else 0.14))
    return цх, цу, ох, оу


def _скелет(кадр):
    """Узлы первого человека кадра или None. Молчит на любой беде:
    скелет это улучшение маски, а не условие работы."""
    import tempfile
    try:
        import поза_сверка
    except Exception:                                       # noqa: BLE001
        return None
    try:
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as ф:
            ф.write(кадр)
            путь = ф.name
        try:
            люди = (поза_сверка._скелеты(путь) or {}).get(путь)
        finally:
            os.unlink(путь)
    except Exception:                                       # noqa: BLE001
        return None
    if not люди:
        return None
    # Один скелет из нескольких: берём того, у кого бёдра виднее. На
    # парной сцене это и есть тот, чей пах в кадре крупно.
    люди.sort(key=lambda ч: -(ч["бедро_л"][2] + ч["бедро_п"][2]))
    return люди[0]


def кроп_лица_ури(ури):
    """Плотный кроп лица со снимка, data-URI или None.

    Молчит на любой беде: лица на снимке может не быть вовсе (кадр со
    спины, предмет вместо человека), и это не повод валить задание -
    фигура и поза от референса всё равно перенесутся.
    """
    import tempfile
    try:
        import лицо_реф
    except Exception:                                       # noqa: BLE001
        return None
    try:
        данные = base64.b64decode(ури.split(",", 1)[1])
    except Exception:                                       # noqa: BLE001
        return None
    путь = кроп = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as ф:
            ф.write(данные)
            путь = ф.name
        кроп = лицо_реф.кроп_лица(путь)
        if not кроп:
            print("RUNWARE: лица на снимке нет, иду без кропа", flush=True)
            return None
        return _дата_ури(open(кроп, "rb").read())
    except Exception as e:                                  # noqa: BLE001
        print("RUNWARE: кроп лица не вышел (%s)" % str(e)[:120], flush=True)
        return None
    finally:
        for п in (путь, кроп):
            if п and os.path.exists(п):
                try:
                    os.unlink(п)
                except OSError:
                    pass


# ---------- мелочи ----------

def _дата_ури(данные):
    return "data:image/png;base64," + base64.b64encode(данные).decode()


def _почему(текст):
    """Короткая причина из ответа сервиса, без простыни JSON."""
    т = (текст or "").strip()
    for ключ in ("\"message\":", "\"error\":"):
        if ключ in т:
            кусок = т.split(ключ, 1)[1].strip().strip("\"")
            return кусок.split("\"")[0][:200] or т[:200]
    return т[:200]


if __name__ == "__main__":
    import sys
    if len(sys.argv) > 2 and sys.argv[1] == "проба":
        снимок = sys.argv[2]
        кнопка = sys.argv[3] if len(sys.argv) > 3 else "un_close"
        r = Runware()
        имя = r.upload(os.path.basename(снимок), open(снимок, "rb").read())
        текст = ("photorealistic nude woman, slim body, standing in neon lit "
                 "room, full body, looking at camera")
        tid, _ = r.start(mode="photo", prompt=текст, images=[имя],
                         сцена=кнопка, size="vert")
        итог = r.wait(tid, limit=300, on_tick=lambda с: None)
        файл = "/tmp/runware_проба.png"
        open(файл, "wb").write(r.fetch(итог["files"][0]))
        print("готово за %s с: %s" % (итог["sec"], файл))
    else:
        print(__doc__)
