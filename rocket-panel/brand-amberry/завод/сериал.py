# -*- coding: utf-8 -*-
"""СЕРИАЛ: один эпизод в сутки, один файл на все пять пачек.

ПОРЯДОК ВЛАДЕЛЬЦА: три сериала по десять серий на месяц, серия собирается
ПЕРВОЙ и уходит на все пять лент одним файлом - разная только музыка,
обложка, хук и кодовое слово. У сериала СВОИ персонажи: лица лент в нём
не участвуют, и это решение владельца, а не упрощение.

ЭПИЗОД: 18 кадров по 3 секунды, около минуты. Шесть моментов арки, каждый
даёт три кадра - общий, деталь, реакция. Это кинематографическое правило,
и оно же даёт разнообразие без того, чтобы писать 540 описаний кадров
руками: арка несёт смысл, раскладка несёт ритм.

КОНЕЦ СЕРИИ - НЕ АУТРО. Клиффхэнгер титром на 2 секунды, размытие 0,6 и
брендовый экран на 3,4 секунды со словами про следующую серию. Аутро
закрывает ролик, а серия обязана оставить человека открытым.

МУЗЫКА ИДЁТ ТЕМ ЖЕ ЗАВОДСКИМ КЛЮЧОМ. `suno-v5` живёт прямо в APIMODELS
(замер каталога: modality audio, endpoint /v1/audio/generations), поэтому
отдельного ключа Suno не нужно вовсе. Пять треков на сериал - по одному
на пачку: это и есть «разная музыка на фоне», и стоит она $1.30 раз в
десять дней, то есть тринадцать центов в сутки.
"""
import datetime, json, os, subprocess, sys, time, urllib.request, urllib.error

ТУТ = os.path.dirname(os.path.abspath(__file__))
АРКИ = os.path.join(ТУТ, "сериалы.json")
КАДРОВ = 18
СЕКУНД_КАДРА = 3
# ЧАСТОТА КАДРОВ НАЗЫВАЕТСЯ ЯВНО. Титр и брендовый экран подаются
# картинками (`-loop 1`), частоты у картинки нет, и фильтр `concat` берёт
# своё умолчание - 25. Проба монтажа дала ровно это: 18 клипов по 30 к/с
# склеились в ролик 25 к/с, а канон держит 30. Расхождение тихое: длина
# сходится, файл читается, и видно только замером.
FPS = 30
КАДРОВ_НА_МОМЕНТ = 3
# У каждого вида кадра своя оптика и своя композиция: без них три кадра
# одного момента выходят одним кадром с разной подписью. Промпт кинокадру
# нужен точный, а не длинный - длину просит текстовый визуал, где буквы.
ВИДЫ_КАДРА = ("wide establishing shot", "tight detail shot",
              "close reaction shot of her face")
ОПТИКА = {
 "wide establishing shot":
   "24mm lens, deep focus, she is small inside the room, strong leading "
   "lines, the space tells the story, available light only",
 "tight detail shot":
   "100mm macro, shallow focus on the single object that matters, "
   "background dissolved, one hard highlight, dust in the air",
 "close reaction shot of her face":
   "85mm portrait lens, eyes in sharp focus, shoulders cropped, "
   "soft falloff, she is holding something back",
}
ТИТР_СЕК = 2.0
МУТЬ_СЕК = 0.6
БРЕНД_СЕК = 3.4
МОДЕЛЬ_КАДРА = "qwen3-image"
МОДЕЛЬ_МУЗЫКИ = "suno-v5"
БАЗА = os.environ.get("APIMODELS_BASE", "https://api.apimodels.app/v1")


def _сосед(имя):
    import importlib.util
    с = importlib.util.spec_from_file_location(имя, os.path.join(ТУТ, имя + ".py"))
    м = importlib.util.module_from_spec(с)
    с.loader.exec_module(м)
    return м


Ж = _сосед("журнал")
С = _сосед("смета")
И = _сосед("исполнить")


def арки():
    with open(АРКИ, encoding="utf-8") as ф:
        д = json.load(ф)
    return {к: з for к, з in д.items() if not к.startswith("_")}


def сегодня(день=None):
    """Какой сериал и какая серия идут сегодня.

    СЧЁТ НЕПРЕРЫВНЫЙ, А НЕ ПО ДНЮ МЕСЯЦА. Считая декадами месяца, я
    получила на 31-е число серию 1 третьего сериала - ту же, что вышла
    21-го: тридцать серий в месяц из 31 дня не раскладываются, и лишний
    день честно повторял уже вышедшее. Цикл идёт по порядковому номеру
    дня (`toordinal`), поэтому тридцатидневное колесо катится без дырок
    и без повторов, какой бы длины ни был месяц.
    """
    д = datetime.date.fromisoformat(день) if день else datetime.date.today()
    имена = sorted(арки())
    серий = len((арки()[имена[0]].get("серии") or [])) or 10
    всего = len(имена) * серий
    индекс = д.toordinal() % всего
    return имена[индекс // серий], (индекс % серий) + 1


def план(ключ, номер):
    """Восемнадцать кадров серии. Три исхода."""
    а = арки().get(ключ)
    if not а:
        return {"ок": False, "почему": "сериала «%s» нет" % ключ}
    серии = а.get("серии") or []
    if not (1 <= номер <= len(серии)):
        return {"ок": False, "почему": "у «%s» серий %d, просят %d"
                % (ключ, len(серии), номер)}
    с = серии[номер - 1]
    моменты = с.get("моменты") or []
    если_мало = КАДРОВ // КАДРОВ_НА_МОМЕНТ
    if len(моменты) < если_мало:
        return {"ок": False, "почему": "моментов %d, на %d кадров нужно %d"
                % (len(моменты), КАДРОВ, если_мало)}
    общее = ("Cinematic still, vertical 9:16, %s. Heroine: %s, %s. "
             "Photorealistic, film grain, natural light, no text, no logo, "
             "no watermark, no second heroine."
             % (а["мир"], а["героиня"], а["внешность"]))
    кадры = []
    for i in range(КАДРОВ):
        момент = моменты[(i // КАДРОВ_НА_МОМЕНТ) % len(моменты)]
        вид = ВИДЫ_КАДРА[i % КАДРОВ_НА_МОМЕНТ]
        кадры.append({"номер": i + 1, "момент": момент, "вид": вид,
                      "промпт": "%s %s: %s. %s. Colour: muted, cold shadows, "
                      "one warm source. Composition: rule of thirds, room "
                      "for a subtitle at the bottom."
                      % (общее, вид, момент, ОПТИКА[вид])})
    return {"ок": True, "сериал": ключ, "имя": а["имя"], "серия": номер,
            "тема": с.get("тема"), "клиффхэнгер": с.get("клиффхэнгер"),
            "кадры": кадры,
            "$": round(КАДРОВ * С.ЦЕНЫ["кадр_серии"]
                       + КАДРОВ * С.ЦЕНЫ["клип_3с"], 4)}


def музыка(промпт, выход, секунд=70):
    """Трек Suno через APIMODELS. Ключ ЗАВОДА, другого тут не бывает."""
    ц = С.ЦЕНЫ["музыка_suno"]
    в = С.влезет(ц, Ж.потрачено())
    if not в.get("ок"):
        return {"ок": False, "почему": "потолок: %s" % в.get("почему")}
    е, почему = И.окружение_ленты()
    if е is None:
        return {"ок": False, "почему": почему}
    ключ = е["APIMODELS_KEY"]
    # ЗАПРОС ИДЁТ ПОЛНЫМ, А НА ОТКАЗ ПО ПОЛЮ УПРОЩАЕТСЯ. Поле `duration`
    # у этой модели не замерено живым вызовом (вызов = трата), и если
    # сервис его не знает, полный запрос умрёт отказом, а серия останется
    # без музыки на все пять пачек. Спросить дешевле, чем решить за
    # сервис: отказ стоит нуля, а второй заход уже без спорного поля.
    т0 = time.time()
    д, последняя = None, ""
    for поля in ({"model": МОДЕЛЬ_МУЗЫКИ, "prompt": промпт, "duration": int(секунд)},
                 {"model": МОДЕЛЬ_МУЗЫКИ, "prompt": промпт}):
        зап = urllib.request.Request(
            БАЗА + "/audio/generations",
            data=json.dumps(поля).encode(), method="POST")
        зап.add_header("Authorization", "Bearer " + ключ)
        зап.add_header("Content-Type", "application/json")
        try:
            with urllib.request.urlopen(зап, timeout=300) as о:
                д = json.loads(о.read().decode("utf-8", "replace"))
            break
        except urllib.error.HTTPError as e:
            тело_о = ""
            try:
                тело_о = e.read().decode("utf-8", "replace")[:300]
            except Exception:
                pass
            последняя = "код %s: %s" % (e.code, тело_о or e.reason)
            # Упрощаемся только на отказе ПО ЗАПРОСУ. Пятисотая, отказ по
            # деньгам или по правам вторым заходом не лечатся, и повторять
            # их значит ждать впустую.
            if e.code != 400:
                return {"ок": False, "почему": последняя}
        except Exception as e:
            return {"ок": False, "почему": "%s: %s" % (type(e).__name__, e)}
    if д is None:
        return {"ок": False, "почему": последняя or "сервис не принял запрос"}
    задача = д.get("taskId") or д.get("task_id") or д.get("id")
    ссылки = д.get("resultUrls") or ([д["resultUrl"]] if д.get("resultUrl") else [])
    # Задача бывает длинной: спрашиваем, пока не отдаст ссылку.
    предел = time.time() + 600
    while not ссылки and задача and time.time() < предел:
        time.sleep(5)
        зап2 = urllib.request.Request(
            "%s/audio/generations?task_id=%s" % (БАЗА, задача))
        зап2.add_header("Authorization", "Bearer " + ключ)
        try:
            with urllib.request.urlopen(зап2, timeout=60) as о:
                д2 = json.loads(о.read().decode("utf-8", "replace"))
            ссылки = (д2.get("resultUrls")
                      or ([д2["resultUrl"]] if д2.get("resultUrl") else []))
            if str(д2.get("state") or "").lower() in ("err", "error", "failed"):
                return {"ок": False, "почему": "суно отказало: %s"
                        % str(д2.get("error"))[:200]}
        except Exception:
            pass
    if not ссылки:
        return {"ок": False, "почему": "трек не пришёл за 10 минут"}
    try:
        with urllib.request.urlopen(ссылки[0], timeout=300) as о:
            данные = о.read()
    except Exception as e:
        return {"ок": False, "почему": "трек не скачался: %s" % type(e).__name__}
    with open(выход + ".part", "wb") as ф:
        ф.write(данные)
    os.replace(выход + ".part", выход)
    Ж.расход_записать("музыка suno", ц, os.path.basename(выход))
    return {"ок": True, "файл": выход, "сек": round(time.time() - т0, 1),
            "$факт": ц, "как": "по прайсу (счёт суно отдельный)"}


# ── СБОРКА ЭПИЗОДА ──────────────────────────────────────────────────────
def _ffmpeg():
    return ("/usr/local/bin/ffmpeg" if os.path.exists("/usr/local/bin/ffmpeg")
            else "ffmpeg")


def финальный_экран(клиффхэнгер, папка, ширина=1080, высота=1920):
    """Клиффхэнгер титром, размытие, брендовый экран.

    ЭТО НЕ АУТРО, и разница смысловая: аутро закрывает ролик призывом, а
    серия обязана оставить человека открытым - потому и держим на экране
    не «подпишись», а «следующая серия уже ждёт».
    """
    try:
        from PIL import Image, ImageDraw, ImageFont
    except Exception as e:
        return {"ок": False, "почему": "PIL нет: %s" % type(e).__name__}
    шрифт_путь = None
    for п in (os.path.join(os.path.dirname(ТУТ), "ролик-показ"),
              os.path.join(os.path.dirname(ТУТ), "обложки"),
              "/usr/share/fonts"):
        if not os.path.isdir(п):
            continue
        for корень, _, файлы in os.walk(п):
            for ф in файлы:
                if ф.lower().endswith((".ttf", ".otf")):
                    шрифт_путь = os.path.join(корень, ф)
                    break
            if шрифт_путь:
                break
        if шрифт_путь:
            break

    def кадр(строки, размеры, цвет=(154, 255, 0)):
        им = Image.new("RGB", (ширина, высота), (8, 8, 10))
        р = ImageDraw.Draw(им)
        y = высота // 2 - sum(размеры) - 40
        for текст, кегль in zip(строки, размеры):
            ш = (ImageFont.truetype(шрифт_путь, кегль) if шрифт_путь
                 else ImageFont.load_default())
            рамка = р.textbbox((0, 0), текст, font=ш)
            р.text(((ширина - (рамка[2] - рамка[0])) // 2, y), текст,
                   font=ш, fill=цвет)
            y += кегль + 30
            цвет = (235, 235, 240)
        return им

    титр = os.path.join(папка, "titr.png")
    бренд = os.path.join(папка, "brand.png")
    кадр([(клиффхэнгер or "").upper()], [64]).save(титр)
    кадр(["NEXT EPISODE", "IS ALREADY WAITING", "link in profile"],
         [78, 60, 44]).save(бренд)
    return {"ок": True, "титр": титр, "бренд": бренд}


def собрать(план_, папка, api, трек=None):
    """Эпизод целиком: кадры, клипы, монтаж, финал. Без музыки пачки.

    Музыка кладётся ВЕЕРОМ, а не здесь: файл один на пять пачек, и
    вшивать в него трек значит делать пять эпизодов вместо одного.
    """
    if not план_.get("ок"):
        return план_
    os.makedirs(папка, exist_ok=True)
    т0 = time.time()
    потрачено, беды = 0.0, []
    клипы = []
    кадры = план_["кадры"]
    for i, к in enumerate(кадры):
        путь = os.path.join(папка, "k%02d.png" % к["номер"])
        if not os.path.exists(путь):
            о = И.кадр(api, к["промпт"], путь, буквы=False,
                       цена=С.ЦЕНЫ["кадр_серии"])
            if not о.get("ок"):
                return {"ок": False, "почему": "кадр %d: %s"
                        % (к["номер"], о.get("почему")), "$факт": потрачено}
            потрачено += float(о.get("$факт") or 0)
        # ПЕРВЫЙ И ПОСЛЕДНИЙ КАДР У КЛИПА РАЗНЫЕ: клип идёт ОТ своего кадра
        # К следующему, и тогда серия течёт, а не дёргается встык.
        след = os.path.join(папка, "k%02d.png" % кадры[(i + 1) % len(кадры)]["номер"])
        вых = os.path.join(папка, "c%02d.mp4" % к["номер"])
        if not os.path.exists(вых):
            о = И.клип(api, "%s, slow steady camera, natural pace, no slow "
                       "motion, no speed up" % к["момент"], путь,
                       след if os.path.exists(след) else путь,
                       СЕКУНД_КАДРА, вых)
            if not о.get("ок"):
                return {"ок": False, "почему": "клип %d: %s"
                        % (к["номер"], о.get("почему")), "$факт": потрачено}
            потрачено += float(о.get("$факт") or 0)
        клипы.append(вых)
    ф = финальный_экран(план_.get("клиффхэнгер"), папка)
    if not ф.get("ок"):
        беды.append("финальный экран: %s" % ф.get("почему"))
    список = os.path.join(папка, "склейка.txt")
    with open(список, "w", encoding="utf-8") as сф:
        for к in клипы:
            сф.write("file '%s'\n" % к)
    основа = os.path.join(папка, "osnova.mp4")
    subprocess.run([_ffmpeg(), "-y", "-hide_banner", "-loglevel", "error",
                    "-nostdin", "-f", "concat", "-safe", "0", "-i", список,
                    "-r", str(FPS), "-c:v", "libx264", "-crf", "19",
                    "-preset", "fast", "-pix_fmt", "yuv420p", "-an", основа],
                   capture_output=True, text=True)
    if not os.path.exists(основа):
        return {"ок": False, "почему": "склейка не дала файла", "$факт": потрачено}
    выход = os.path.join(папка, "episode.mp4")
    if ф.get("ок"):
        # Титр, размытие и бренд приклеиваются ОДНИМ проходом: отдельные
        # проходы на каждый кусок трижды перекодируют один и тот же файл.
        # fps НА КАЖДОМ входе и -r на выходе: `concat` сводит потоки с
        # одной частотой, и молча берёт 25, если её не назвать.
        фильтр = (
            "[0:v]scale=1080:1920,setsar=1,fps=%d[v0];"
            "[1:v]scale=1080:1920,setsar=1,loop=loop=%d:size=1:start=0,"
            "trim=duration=%.2f,setpts=PTS-STARTPTS,fps=%d[t];"
            "[2:v]scale=1080:1920,setsar=1,loop=loop=%d:size=1:start=0,"
            "trim=duration=%.2f,setpts=PTS-STARTPTS,fps=%d[b];"
            "[v0][t][b]concat=n=3:v=1:a=0[v]"
            % (FPS, int(ТИТР_СЕК * FPS), ТИТР_СЕК, FPS,
               int(БРЕНД_СЕК * FPS), БРЕНД_СЕК, FPS))
        subprocess.run([_ffmpeg(), "-y", "-hide_banner", "-loglevel", "error",
                        "-nostdin", "-i", основа, "-loop", "1", "-i", ф["титр"],
                        "-loop", "1", "-i", ф["бренд"], "-filter_complex",
                        фильтр, "-map", "[v]", "-r", str(FPS), "-c:v",
                        "libx264", "-crf", "19", "-preset", "fast",
                        "-pix_fmt", "yuv420p", выход],
                       capture_output=True, text=True)
    if not os.path.exists(выход):
        # Финал не встал - эпизод всё равно есть, и это надо сказать, а не
        # потерять минуту готового видео.
        беды.append("финал не приклеился, эпизод без него")
        выход = основа
    return {"ок": True, "файл": выход, "кадров": len(кадры),
            "$факт": round(потрачено, 4), "сек": round(time.time() - т0, 1),
            "беды": беды}


def веер(эпизод, пачки, папка, промпт_музыки=None):
    """Один эпизод -> пять файлов, у каждого своя музыка.

    Файл ОДИН, и это слово владельца: «по факту один и тот же файл просто
    с разной музыкой». Поэтому видео копируется потоком без перекодировки
    (`-c:v copy`): перекодировать пять раз одну минуту значит пять раз
    потерять качество за просто так.
    """
    if not os.path.exists(эпизод):
        return {"ок": False, "почему": "эпизода нет: %s" % эпизод}
    итог, беды = {}, []
    for н, пачка in enumerate(пачки, 1):
        трек = os.path.join(папка, "track-%s.mp3" % пачка)
        if not os.path.exists(трек):
            о = музыка(промпт_музыки or _промпт_музыки(н),
                       трек, секунд=70)
            if not о.get("ок"):
                беды.append("%s: музыка %s" % (пачка, о.get("почему")))
                continue
        вых = os.path.join(папка, "episode-%s.mp4" % пачка)
        subprocess.run([_ffmpeg(), "-y", "-hide_banner", "-loglevel", "error",
                        "-nostdin", "-i", эпизод, "-i", трек, "-map", "0:v",
                        "-map", "1:a", "-c:v", "copy", "-c:a", "aac",
                        "-b:a", "160k", "-shortest", вых],
                       capture_output=True, text=True)
        if os.path.exists(вых):
            итог[пачка] = вых
        else:
            беды.append("%s: музыка не вшилась" % пачка)
    return {"ок": bool(итог), "файлы": итог, "беды": беды}


НАСТРОЕНИЯ = ("tense cinematic underscore, low strings, slow pulse",
              "cold synth drone, distant piano, unresolved",
              "minimal dark electronic, muted kick, wide reverb",
              "lonely guitar harmonics, tape hiss, slow swell",
              "hollow ambient pads, single repeated note, unease")


def _промпт_музыки(номер):
    """Пять настроений - по одному на пачку. Инструментал без вокала:
    голос в фоне спорит с титрами и с речью серии."""
    н = НАСТРОЕНИЯ[(номер - 1) % len(НАСТРОЕНИЯ)]
    return ("%s, instrumental only, no vocals, no lyrics, 70 seconds, "
            "loopable, mixed quiet to sit under dialogue" % н)
