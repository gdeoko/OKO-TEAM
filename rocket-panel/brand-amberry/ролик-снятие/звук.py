#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Звук ролика: музыка на фоне и эффекты на нажатия кнопок.

Ролик без звука в ленте пролистывают: у зрителя включён звук, и тишина
читается как обрыв. Музыка берётся с Freesound, ТОЛЬКО CC0 (public
domain) - её можно класть в коммерческий ролик без подписи автора и без
риска снятия по авторским. Каждый ролик получает СВОЙ трек: набор
выбирается по семени (имя файла), и один и тот же ролик всегда звучит
одинаково, а соседние - по-разному.

По правилам контент-завода музыка не включается рубильником: в начале
она проявляется, в конце затухает (ПРОЯВКА/ЗАТУХАНИЕ ниже), иначе
обрезанный на полуноте трек слышно как брак.

    python3 звук.py <семя> [папка]    - скачать и показать, что выбрано
"""
import hashlib
import json
import os
import random
import subprocess
import sys
import urllib.parse
import urllib.request

ТУТ = os.path.dirname(os.path.abspath(__file__))
КЭШ = os.path.join(ТУТ, ".работа", "звук")

ПРОЯВКА, ЗАТУХАНИЕ = 0.9, 1.2
ГРОМКОСТЬ_МУЗЫКИ = -19.0        # LUFS: фон, а не солист
ГРОМКОСТЬ_ЭФФЕКТА = 0.55

# Запросы подобраны под ленту коротких роликов: ритм с первой секунды,
# без вступления на полминуты. Набор широкий - иначе вся пачка за день
# зазвучит одинаково. К каждому идут ОБЯЗАТЕЛЬНЫЕ теги: без них поиск по
# словам отдаёт что угодно - на «lofi beat loop» пришёл джазовый
# гитарный сэмпл, а под таким роликом он звучит как чужая дорожка.
ТЕМЫ = [
    ("upbeat electronic loop", ["electronic", "loop"]),
    ("phonk beat loop", ["phonk"]),
    ("deep house loop", ["house"]),
    ("trap beat loop", ["trap"]),
    ("synthwave loop", ["synthwave"]),
    ("future bass loop", ["bass"]),
    ("hip hop beat loop", ["hip-hop"]),
    ("dance beat loop", ["dance"]),
    ("edm loop", ["edm"]),
    ("club beat loop", ["club"]),
    ("techno loop", ["techno"]),
    ("drum and bass loop", ["drum-and-bass"]),
]

# Живые инструменты и «уютное» под таким роликом звучат мимо: нужен
# электронный бит, а не гитара у костра.
МИМО = ("jazz", "guitar", "acoustic", "piano", "violin", "flute", "choir",
        "ambient", "meditation", "lullaby", "classical", "orchestra",
        "birds", "rain", "nature", "speech", "voice", "talking")
ЭФФЕКТЫ = ["ui click", "interface tap", "button click soft", "pop click ui"]


def ключ():
    к = os.environ.get("FREESOUND_API_KEY", "")
    if not к:
        сек = os.path.join("/home/user/OKO-TEAM", "secrets.env.b64")
        if os.path.exists(сек):
            import base64
            for стр in base64.b64decode(open(сек, "rb").read()).decode(
                    "utf-8", "replace").splitlines():
                if стр.startswith("FREESOUND_API_KEY="):
                    к = стр.split("=", 1)[1].strip().strip('"').strip("'")
                    break
    return к


def искать(запрос, мин, макс, страница=1, теги=()):
    """CC0 и только оно: остальные лицензии требуют подписи автора в
    описании ролика, а её в ленте никто не ставит."""
    отбор = 'license:"Creative Commons 0" duration:[%d TO %d]' % (мин, макс)
    for т_ in теги:
        отбор += ' tag:%s' % т_
    адрес = "https://freesound.org/apiv2/search/text/?" + urllib.parse.urlencode({
        "query": запрос,
        "filter": отбор,
        "fields": "id,name,duration,previews,username,tags",
        "sort": "downloads_desc",
        "page_size": 25, "page": страница})
    зап = urllib.request.Request(адрес, headers={
        "Authorization": "Token " + ключ()})
    with urllib.request.urlopen(зап, timeout=45) as о:
        return json.loads(о.read().decode()).get("results", [])


def скачать(url, путь):
    if os.path.exists(путь) and os.path.getsize(путь) > 4096:
        return путь
    os.makedirs(os.path.dirname(путь), exist_ok=True)
    with urllib.request.urlopen(url, timeout=90) as о, open(путь, "wb") as ф:
        ф.write(о.read())
    return путь


def подходит_мимо(н):
    строка = (н.get("name", "") + " " + " ".join(н.get("tags", []))).lower()
    return any(с in строка for с in МИМО)


def из_кэша(семя):
    """Трек из уже скачанных. Freesound отвечает 429 при частых запросах
    (27.09.2026: лимит выбран за день сборок), и без запаса ролик уходил
    бы немым. Кэш живёт в `.работа/звук`, выбор по семени - значит у
    каждого ролика он всё равно свой."""
    if not os.path.isdir(КЭШ):
        return None
    свои = sorted(f for f in os.listdir(КЭШ) if f.startswith("муз-"))
    if not свои:
        return None
    сл = random.Random(hashlib.sha1(("кэш" + str(семя)).encode()).hexdigest())
    п = os.path.join(КЭШ, сл.choice(свои))
    print("музыка: из запаса, %s" % os.path.basename(п), flush=True)
    return п


def музыка(семя, длина):
    """Свой трек на каждый ролик. Возвращает путь или None: без музыки
    ролик всё равно выходит - падать из-за фонограммы нельзя."""
    сл = random.Random(hashlib.sha1(("муз" + str(семя)).encode()).hexdigest())
    темы = ТЕМЫ[:]
    сл.shuffle(темы)
    for тема, теги in темы[:5]:
        try:
            найдено = искать(тема, max(8, int(длина)), 90,
                             страница=сл.choice([1, 1, 2]), теги=теги)
        except Exception as e:
            print("музыка: поиск не удался (%s)" % e, flush=True)
            continue
        найдено = [н for н in найдено if н.get("previews")
                   and not подходит_мимо(н)]
        if not найдено:
            continue
        н = сл.choice(найдено)
        путь = os.path.join(КЭШ, "муз-%s.mp3" % н["id"])
        try:
            скачать(н["previews"]["preview-hq-mp3"], путь)
        except Exception as e:
            print("музыка: не скачалась (%s)" % e, flush=True)
            continue
        print("музыка: %s / %s (%.1f с, CC0)" % (н["name"], н["username"],
                                                 н["duration"]), flush=True)
        return путь
    return из_кэша(семя)


def эффект(семя):
    сл = random.Random(hashlib.sha1(("эфф" + str(семя)).encode()).hexdigest())
    for запрос in сл.sample(ЭФФЕКТЫ, len(ЭФФЕКТЫ)):
        try:
            найдено = [н for н in искать(запрос, 0, 2) if н.get("previews")]
        except Exception:
            continue
        if not найдено:
            continue
        н = сл.choice(найдено[:12])
        путь = os.path.join(КЭШ, "эфф-%s.mp3" % н["id"])
        try:
            скачать(н["previews"]["preview-hq-mp3"], путь)
        except Exception:
            continue
        print("эффект: %s / %s" % (н["name"], н["username"]), flush=True)
        return путь
    return None


def дорожка(семя, длина, нажатия, ffmpeg, выход):
    """Собирает звуковую дорожку ролика: музыка с проявкой и затуханием
    плюс щелчок на каждое нажатие кнопки. Возвращает путь или None."""
    муз = музыка(семя, длина)
    эфф = эффект(семя) if нажатия else None
    if not муз and not эфф:
        return None

    входы, ф, куски = [], [], []
    if муз:
        # МУЗЫКУ ЗАЦИКЛИВАЕМ. Трек бывает короче ролика (27.09.2026: в
        # сорокашестисекундную нарезку встал кусок на двенадцать секунд),
        # и тогда `-shortest` при сведении обрезает ПО ЗВУКУ - ролик
        # выходил втрое короче себя. `aloop` повторяет дорожку столько,
        # сколько нужно, а лишнее потом срезает atrim.
        входы += ["-stream_loop", "-1", "-i", муз]
        ф.append("[0:a]atrim=0:%.3f,asetpts=N/SR/TB,aformat=sample_fmts=fltp:"
                 "sample_rates=48000:channel_layouts=stereo,"
                 "afade=t=in:st=0:d=%.2f,afade=t=out:st=%.3f:d=%.2f,"
                 "loudnorm=I=%.1f:TP=-1.5:LRA=11[м]"
                 % (длина, ПРОЯВКА, max(0.0, длина - ЗАТУХАНИЕ), ЗАТУХАНИЕ,
                    ГРОМКОСТЬ_МУЗЫКИ))
        куски.append("[м]")
    if эфф:
        входы += ["-i", эфф]
        н_вход = 1 if муз else 0
        for i, т in enumerate(нажатия):
            ф.append("[%d:a]aformat=sample_fmts=fltp:sample_rates=48000:"
                     "channel_layouts=stereo,atrim=0:0.6,volume=%.2f,"
                     "adelay=%d|%d[щ%d]"
                     % (н_вход, ГРОМКОСТЬ_ЭФФЕКТА, int(т*1000), int(т*1000), i))
            куски.append("[щ%d]" % i)
    ф.append("%samix=inputs=%d:duration=longest:normalize=0,"
             "atrim=0:%.3f,aformat=sample_fmts=fltp:sample_rates=48000:"
             "channel_layouts=stereo[вых]" % ("".join(куски), len(куски), длина))

    subprocess.run([ffmpeg, "-y", "-hide_banner", "-loglevel", "error"] + входы
                   + ["-filter_complex", ";".join(ф), "-map", "[вых]",
                      "-c:a", "aac", "-b:a", "192k", выход], check=True)
    return выход


if __name__ == "__main__":
    а = sys.argv[1:]
    семя = а[0] if а else "проба"
    print("музыка:", музыка(семя, 8))
    print("эффект:", эффект(семя))
