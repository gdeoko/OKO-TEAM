#!/usr/bin/env python3
"""Панель генерации ROCKET. Второе поколение моделей.

    фото  — Qwen-Rapid-AIO-NSFW-v23  (база Qwen-Image-Edit-2511), 28,4 ГБ
    видео — wan2.2-rapid-mega-aio-nsfw-v12.2 (база Wan 2.2 A14B), 23,3 ГБ

Обе сборки Apache 2.0 и обе «всё в одном»: ускорители, кодировщик и VAE
уже внутри, поэтому грузятся ОДНИМ узлом CheckpointLoaderSimple, а не
тремя. Прежние Chroma и Wan 2.2 5B удалены — эти две их заменяют
целиком, освободилось 33 ГБ.

## Две вещи, на которых легко обжечься

**CFG=1 и 4 шага — не опечатка.** Ускорители влиты в сборку. Обычные
26 шагов при CFG 4 их ЛОМАЮТ: картинка выходит пережжённой, а время
растёт в шесть раз. Это про ВИДЕО. У ФОТО с 23.09.2026 свои восемь
шагов и CFG 2.0 — ровно те, на которых сняты все эталонные кадры,
отобранные владельцем; см. большой комментарий у `CFG_ФОТО`.

**Референс идёт в УСЛОВИЕ, а не в латент.** У классической перерисовки
исходник задаёт каркас кадра, и сменить позу нельзя. Здесь снимки
попадают в `TextEncodeQwenImageEditPlus` как часть условия — каркас
модель строит заново. Проверено: из портрета в кафе по запросу «та же
женщина в полный рост на пляже» вышел полный рост на пляже с тем же
лицом. Отличие от исходника 77,2 против 28,7 у прежнего способа.

Узел берёт РОВНО ТРИ снимка: image1, image2, image3 — отсюда потолок в
три референса, он не выдуман.

## Память

Замеры на нашей A6000 (47,4 ГБ): фото 1536×1536 — 46,5 ГБ, вертикальное
видео 720×1280 — 45,5 ГБ. Карта забита на 97 %. Фото и видео на одной
карте держать можно, мозг с голосом — уже нет.

С 23.09.2026 работаем на A100 80 ГБ: фото 10 с вместо 19, видео на пять
секунд 92 с вместо четырёх минут.

## SageAttention НА A100 ВКЛЮЧАТЬ НЕЛЬЗЯ

На A6000 ключ `--use-sage-attention` давал +11 % и стоял в службе. На
A100 (sm_80) он молча отдаёт ПОЛНОСТЬЮ ЧЁРНЫЕ кадры: ошибки нет,
задание считается успешным, время обычное, среднее по картинке ровно
ноль. Проверено 23.09.2026 — восемь кадров подряд чёрные, тот же граф
без ключа считается нормально. Если карта опять сменится, проверять это
ПЕРВЫМ делом: чёрный кадр без ошибки выглядит как поломка промпта, и
искать его можно долго.
"""
import json, time, uuid, os, shutil, subprocess, threading, urllib.request
from flask import Flask, request, jsonify, send_file, Response

COMFY="http://127.0.0.1:8188"
OUT="/home/ubuntu/ComfyUI/output"; IN="/home/ubuntu/ComfyUI/input"
UPSCALE_DIR="/home/ubuntu/ComfyUI/models/upscale_models"
CKPT_DIR="/home/ubuntu/ComfyUI/models/checkpoints"
CN_DIR="/home/ubuntu/ComfyUI/models/controlnet"
app=Flask(__name__); app.config["MAX_CONTENT_LENGTH"]=48*1024*1024
JOBS={}

# Имена файлов сборок. Меняются при обновлении — держим в одном месте.
CKPT_PHOTO="Qwen-Rapid-AIO-NSFW-v23.safetensors"
CKPT_VIDEO="wan2.2-rapid-mega-aio-nsfw-v12.2.safetensors"

# Ускорители внутри сборок: больше шагов и выше CFG их ломают.
STEPS=4
CFG=1.0

# CFG У ФОТО — 1.5, И ЭТО НЕ ПРОТИВОРЕЧИЕ СКАЗАННОМУ ВЫШЕ.
#
# При CFG=1.0 классификаторной подсказки нет вовсе, а значит НЕГАТИВНЫЙ
# ПРОМПТ МОДЕЛЬ НЕ ВИДИТ. Шестьдесят слов «не увеличивай грудь, не
# старь лицо» лежали мёртвым грузом — считался только положительный.
#
# Замерено на карте 21.09.2026, один снимок и один промпт:
#     cfg 1.0  негатив не работает
#     cfg 1.5  негатив работает, картинка целая, +4 с
#     cfg 2.5  картинка пережжена и постеризована — ускоритель сломан
#
# ЗАМЕР ПЕРЕСНЯТ 23.09.2026 — И 2.5 ОКАЗАЛОСЬ НЕ ПОТОЛКОМ, А ОБРЫВОМ.
#
# Прежний замер делался одним снимком по одному промпту и на четырёх
# шагах. Все эталонные кадры, которые владелец отбирал два дня
# (раздевание, интим, ЖЖ, МЖ), сняты на ВОСЬМИ шагах и CFG 2.0 — то
# есть бот отдавал клиенту НЕ ТО, что владелец утверждал.
#
# Сверка 23.09.2026, «Наездница», четыре зерна, одинаковые промпт и
# референсы, 4/1.5 против 8/2.0: композиция и поза совпадают, на 8/2.0
# чище анатомия и лучше держится соединение. Ни пережога, ни
# постеризации — они начинаются выше, к 2.5.
#
# Требование владельца после сверки: «8/2.0, чтобы всегда с первого
# раза». Фото теперь считается ровно так же, как снимались эталоны.
# ВИДЕО НЕ ТРОГАЕМ: у wan своя сборка со своим ускорителем, там
# по-прежнему STEPS/CFG сверху.
CFG_ФОТО=2.0
STEPS_ФОТО=8

# Wan обучен на китайском негативе — он работает лучше английского
WAN_NEG=("色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，"
         "最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，"
         "画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，"
         "杂乱的背景，三条腿，背景人很多，倒着走")
PHOTO_NEG=("low quality, worst quality, blurry, out of focus, jpeg artifacts, deformed, "
           "disfigured, bad anatomy, mutated hands, fused fingers, extra fingers, extra limbs, "
           "malformed limbs, asymmetric eyes, watermark, signature, text")

MAX_REF=3          # столько снимков берёт TextEncodeQwenImageEditPlus

# ОПОРА — КАРТА ГЛУБИНЫ С ПРИНЯТОГО ВЛАДЕЛЬЦЕМ КАДРА.
#
# Владелец отобрал 21 кадр и потребовал: «чтобы бот выдавал именно
# такие позы и ракурсы в 10 из 10 случаев». Текстом этого не сделать —
# сборка читает около первой тысячи знаков и дальше сочиняет. Жёсткая
# постановка (дословный текст принятого кадра) подняла попадание до
# шести-семи из десяти, и это её потолок.
#
# ControlNet задаёт геометрию не словами, а картинкой, поэтому потолка
# текста у него нет.
#
# ПОЧЕМУ ГЛУБИНА, А НЕ СКЕЛЕТ. Скелет (DWPose) — первый выбор: он несёт
# только «где локоть, где колено» и ничего не знает о фигуре. Но на
# наших кадрах он разваливается ровно там, где он нужнее всего: замер
# 23.09.2026 по 21 эталону — «Минет» и «Кунилингус ЖЖ» сняты отлично, а
# у «Секса раком», «Вдвоём раком» и «Наездницы» тела сложены и
# перекрывают друг друга, и DWPose находит одну голову вместо двух
# человек (1,3 % ненулевых точек против 4 %). Карта глубины
# (Depth-Anything-V2) читает любую позу: на тех же кадрах видно обоих
# целиком, включая руки.
#
# ЧЕМ ГЛУБИНА ОПАСНА И КАК ЭТО СНЯТО. Она несёт не только позу, но и
# силуэт — то есть сложение человека с эталона. Клиенту нужно СВОЁ
# тело. Поэтому опора работает не весь прогон, а только начало
# (`ОПОРА_ДО`): композиция решается на первых шагах, дальше опора
# отпускается, и тело с лицом достраиваются по снимкам клиента.
# СИЛА И СРОК ПОДОБРАНЫ ЗАМЕРОМ, а не взяты из головы.
#
# Проба 23.09.2026 на «Поставить раком» — кнопке, где опора сперва не
# сработала вовсе: те же промпт, снимок и зерно, менялись только эти
# две цифры.
#
#     0,75 / 0,40   поза НЕ та: сидит, а не стоит на четвереньках
#     1,00 / 0,50   то же самое
#     1,00 / 0,80   то же самое, хотя опора держит почти весь прогон
#     1,40 / 0,60   принятый кадр повторён
#
# Отсюда главное: решает СИЛА, а не длительность. При силе 1,0 опора
# не перебивает текст с референсами, сколько её ни держи. Проверено на
# «Вдвоём раком», где опора работала и на 0,75: подъём до 1,4 её не
# сломал, кадр тот же.
CN_UNION="Qwen-Image-InstantX-ControlNet-Union.safetensors"
ОПОРЫ="/home/ubuntu/ГЛУБИНА"
ОПОРА_СИЛА=1.4
ОПОРА_ДО=0.60

# КНОПКИ, У КОТОРЫХ СВОЯ ОПОРА — сила, срок или вид другие.
#
# Пусто, и это хорошая новость: ни одной кнопке подпорка не
# понадобилась. «Снимает лифчик» долго не давалась (второе тело внизу
# кадра на всех зёрнах), и под неё перебирались сила 0,8…1,4, срок 0,3
# и 0,6, погашенный пол на карте глубины и опора скелетом. Не помогло
# ничего, потому что дело было НЕ В ОПОРЕ: в собранном промпте стояло
# «shows her tits CLOSE-UP» при кадре в полный рост, и сборка рисовала
# и то и другое — полный рост плюс крупный план отдельным телом.
# Строку переписали, и кнопка пошла с первого зерна.
#
# ВЫВОД, который стоил вечера: упрямо не тот кадр — сперва читать
# СОБРАННЫЙ промпт целиком и искать противоречие в нём. Противоречие в
# тексте опорой не лечится, сколько её ни крути.
#
# Если исключение всё-таки понадобится, вид бывает двух родов:
#   {"ключ": {"вид": "поза"|"глубина", "сила": 1.4, "до": 0.6}}
ОПОРА_СВОЯ={}

# Где лежат опоры каждого вида и как он называется у ControlNet Union.
ВИДЫ_ОПОР={"глубина":("/home/ubuntu/ГЛУБИНА","depth"),
           "поза":("/home/ubuntu/ПОЗЫ","openpose")}
ОПОР_ЖДЁМ=21          # столько кадров принял владелец


def шаги_под_denoise(denoise):
    """Сколько шагов просить, чтобы РЕАЛЬНО прошло STEPS_ФОТО.

    KSampler при denoise<1 стартует не с нуля и отрабатывает только
    хвост расписания: при steps=8 и denoise=0.5 сэмплер делает ЧЕТЫРЕ
    шага. На обычной модели это просто грязнее, на быстрой сборке —
    каша. Поэтому шаги поднимаем обратно.
    """
    denoise=max(0.05,min(1.0,float(denoise)))
    return max(STEPS_ФОТО, int(round(STEPS_ФОТО/denoise)))


def _фото_база(p, neg, seed, images=None, denoise=1.0):
    """Общий каркас фото-графа. images — до трёх имён файлов.

    `denoise` — СКОЛЬКО ОТ ИСХОДНИКА ОСТАВИТЬ, и это не тонкая
    настройка, а разница между двумя товарами.

    При denoise=1.0 стартовый латент стирается целиком: снимок влияет
    на кадр только через `TextEncodeQwenImageEditPlus`, то есть через
    условие. Лицо модель старается сохранить, а комнату сочиняет
    заново — сколько ни пиши в промпте «оставь ту же обстановку».
    Ровно это и случилось у владельца 21.09.2026: он не выбирал место,
    а героиня оказалась в чужом помещении.

    При denoise<1 исходник переживает часть шагов, и обстановка, поза и
    сложение остаются узнаваемыми. Это и есть «фон с референса».
    """
    g={
     "1":{"class_type":"CheckpointLoaderSimple","inputs":{"ckpt_name":CKPT_PHOTO}},
     "5":{"class_type":"CLIPTextEncode","inputs":{"clip":["1",1],"text":neg or PHOTO_NEG}},
     "7":{"class_type":"KSampler","inputs":{"model":["1",0],"positive":["4",0],"negative":["5",0],
          "seed":seed,"steps":шаги_под_denoise(denoise),"cfg":CFG_ФОТО,
          "sampler_name":"euler","scheduler":"simple",
          "denoise":max(0.05,min(1.0,float(denoise)))}},
     "8":{"class_type":"VAEDecode","inputs":{"samples":["7",0],"vae":["1",2]}},
    }
    images=[x for x in (images or []) if x][:MAX_REF]
    if images:
        # Снимки идут в УСЛОВИЕ: так модель держит лицо и сложение.
        # Каркас кадра (обстановка, поза) приходит не отсюда, а из
        # стартового латента — и только при denoise<1, см. `_фото_база`.
        узел={"clip":["1",1],"prompt":p,"vae":["1",2]}
        for i,имя in enumerate(images,1):
            g[f"3{i}"]={"class_type":"LoadImage","inputs":{"image":имя,"upload":"image"}}
            узел[f"image{i}"]=[f"3{i}",0]
        g["4"]={"class_type":"TextEncodeQwenImageEditPlus","inputs":узел}
    else:
        g["4"]={"class_type":"CLIPTextEncode","inputs":{"clip":["1",1],"text":p}}
    return g


def опора_файл(ключ, вид="глубина"):
    """Ключ кнопки → имя файла опоры внутри `input` ComfyUI.

    Опоры лежат отдельными папками по видам, а `LoadImage` умеет читать
    только из `input`, поэтому нужная переносится туда при первом
    обращении. Переносится копией, а не ссылкой: ComfyUI чистит `input`
    сам, и по ссылке он удалил бы оригинал.
    """
    ключ=(ключ or "").strip()
    if not ключ or "/" in ключ or "\\" in ключ:
        return None
    папка=ВИДЫ_ОПОР.get(вид,ВИДЫ_ОПОР["глубина"])[0]
    откуда=os.path.join(папка,ключ+".png")
    if not os.path.exists(откуда):
        return None
    имя="opora_%s_%s.png" % (вид,ключ)
    куда=os.path.join(IN,имя)
    if not os.path.exists(куда) or os.path.getmtime(куда)<os.path.getmtime(откуда):
        shutil.copy(откуда,куда)
    return имя


def _опора(g,w,h,имя,сила,до,вид="глубина"):
    """Прицепить карту глубины к обоим условиям. См. «ОПОРА» в шапке.

    Узлы нумеруются с 50: ниже заняты каркасом фото, снимками (31–33) и
    апскейлом (90+). Пересечение номеров ComfyUI не ловит — он молча
    берёт последний, и граф считается не тот, что задуман.
    """
    g["50"]={"class_type":"ControlNetLoader",
             "inputs":{"control_net_name":CN_UNION}}
    g["51"]={"class_type":"SetUnionControlNetType",
             "inputs":{"control_net":["50",0],
                       "type":ВИДЫ_ОПОР.get(вид,ВИДЫ_ОПОР["глубина"])[1]}}
    g["52"]={"class_type":"LoadImage","inputs":{"image":имя,"upload":"image"}}
    # Опора приводится к размеру кадра. `crop:"center"` обязателен:
    # эталон и заказанный лист бывают разной пропорции, а растянутая
    # опора — это растянутый человек.
    g["53"]={"class_type":"ImageScale",
             "inputs":{"image":["52",0],"width":w,"height":h,
                       "upscale_method":"lanczos","crop":"center"}}
    g["54"]={"class_type":"ControlNetApplyAdvanced",
             "inputs":{"positive":["4",0],"negative":["5",0],
                       "control_net":["51",0],"image":["53",0],
                       "strength":float(сила),"start_percent":0.0,
                       "end_percent":float(до),"vae":["1",2]}}
    g["7"]["inputs"]["positive"]=["54",0]
    g["7"]["inputs"]["negative"]=["54",1]
    return g


def wf_photo(p,w,h,seed,images=None,neg=None,denoise=1.0,
             опора=None,опора_сила=None,опора_до=None,ключ_опоры=""):
    """Текст в фото и фото в фото — один граф, разница в наличии снимков."""
    # Без снимков стартового латента нет вовсе, и частичный denoise
    # означал бы недосчитанный шум вместо картинки.
    if not images:
        denoise=1.0
    g=_фото_база(p,neg,seed,images,denoise)
    if опора:
        своя=ОПОРА_СВОЯ.get(ключ_опоры or "",{})
        g=_опора(g,w,h,опора,
                 своя.get("сила",ОПОРА_СИЛА) if опора_сила is None else опора_сила,
                 своя.get("до",ОПОРА_ДО) if опора_до is None else опора_до,
                 своя.get("вид","глубина"))
    g,выход=_апскейл(g,["8",0],лист=(w,h))
    g["9"]={"class_type":"SaveImage","inputs":{"images":выход,"filename_prefix":"photo"}}
    if not images:
        g["6"]={"class_type":"EmptySD3LatentImage","inputs":{"width":w,"height":h,"batch_size":1}}
        g["7"]["inputs"]["latent_image"]=["6",0]
    else:
        # Размер задаёт первый снимок, растянутый до нужного кадра.
        g["40"]={"class_type":"ImageScale","inputs":{"image":["31",0],"width":w,"height":h,
                 "upscale_method":"lanczos","crop":"center"}}
        g["41"]={"class_type":"VAEEncode","inputs":{"pixels":["40",0],"vae":["1",2]}}
        g["7"]["inputs"]["latent_image"]=["41",0]
    return g


def wf_inpaint(p,seed,image,mask,feather=24,grow=8,neg=None):
    """Правка по области: белое в маске переписывается, остальное остаётся
    пиксель в пиксель. Композит в конце обязателен — без него модель
    подменяет и то, что не просили."""
    g=_фото_база(p,neg,seed,[image])
    g["20"]={"class_type":"LoadImage","inputs":{"image":mask,"upload":"image"}}
    g["21"]={"class_type":"ImageToMask","inputs":{"image":["20",0],"channel":"red"}}
    g["22"]={"class_type":"GrowMask","inputs":{"mask":["21",0],"expand":int(grow),
             "tapered_corners":True}}
    g["23"]={"class_type":"FeatherMask","inputs":{"mask":["22",0],"left":int(feather),
             "top":int(feather),"right":int(feather),"bottom":int(feather)}}
    g["41"]={"class_type":"VAEEncode","inputs":{"pixels":["31",0],"vae":["1",2]}}
    g["24"]={"class_type":"SetLatentNoiseMask","inputs":{"samples":["41",0],"mask":["23",0]}}
    g["7"]["inputs"]["latent_image"]=["24",0]
    g["25"]={"class_type":"ImageCompositeMasked","inputs":{"destination":["31",0],
             "source":["8",0],"mask":["23",0],"x":0,"y":0,"resize_source":False}}
    # Апскейл ПОСЛЕ композита. Наоборот нельзя: композит склеивает
    # правку с исходником пиксель в пиксель, а у поднятой картинки и
    # исходника размеры разные — шов пойдёт по всей маске.
    #
    # `лист` не передаётся, и подъёма у правки НЕТ вовсе. Размер здесь
    # задаёт присланный файл, а он уже поднят нами при выдаче; прежний
    # код приводил правку к жёстким 1152×2048 с обрезкой по центру — то
    # есть клиент отправлял на правку свой кадр и получал его обрезком.
    g,выход=_апскейл(g,["25",0])
    g["9"]={"class_type":"SaveImage","inputs":{"images":выход,"filename_prefix":"inpaint"}}
    return g


def wf_video(p,w,h,frames,seed,images=None,neg=None,shift=8.0):
    """Три режима одним графом, по числу снимков:

        нет снимков  — текст в видео
        один         — оживление снимка
        два          — ролик с двумя людьми, оба с референсов

    СНИМКИ ИДУТ ЧЕРЕЗ VACE, И ЭТО ЕДИНСТВЕННЫЙ ПУТЬ, КОТОРЫЙ РАБОТАЕТ.
    Замеры на карте 22.09.2026, один и тот же кадр, один текст, одно
    зерно, отличался ровно узел:

        WanImageToVideo(start_image)        чужая женщина с нулевого
                                            кадра
        WanFirstLastFrameToVideo(start/end) то же самое, чужая
        WanVaceToVideo(reference_image)     она же: лицо, грудь, фон —
                                            и держится до конца

    Сборка грузится как WAN21_Vace и снимок принимает только своим
    входом; мимо него кадр до модели не доходит вовсе. Поэтому режима
    «первый и последний кадр» больше нет: эта сборка его обещание не
    держит. Два снимка теперь значат двух ЛЮДЕЙ — оба уходят в
    `reference_image` одним пакетом, и оба остаются собой. Ровно так
    их и присылает бот в парных роликах.
    """
    images=[x for x in (images or []) if x][:2]
    g={
     "1":{"class_type":"CheckpointLoaderSimple","inputs":{"ckpt_name":CKPT_VIDEO}},
     "12":{"class_type":"ModelSamplingSD3","inputs":{"model":["1",0],"shift":float(shift)}},
     "4":{"class_type":"CLIPTextEncode","inputs":{"clip":["1",1],"text":p}},
     "5":{"class_type":"CLIPTextEncode","inputs":{"clip":["1",1],"text":neg or WAN_NEG}},
     "7":{"class_type":"KSampler","inputs":{"model":["12",0],"seed":seed,"steps":STEPS,"cfg":CFG,
          "sampler_name":"uni_pc","scheduler":"simple","denoise":1.0}},
     "8":{"class_type":"VAEDecode","inputs":{"samples":["7",0],"vae":["1",2]}},
     # КАДРАМИ, А НЕ АНИМИРОВАННЫМ WEBP.
     #
     # `SaveAnimatedWEBP` — единственный узел для роликов в голом
     # ComfyUI, и он отдаёт файл, который телеграм показывает вложением,
     # а не видео. Перегнать его в mp4 не выходит: ffmpeg не читает
     # анимированный webp от ComfyUI («invalid TIFF header in Exif
     # data», проверено на карте 22.09.2026).
     #
     # Поэтому webp не появляется вовсе: кадры ложатся отдельными PNG, а
     # mp4 собирается из них (`собрать_mp4`). Заодно уходит лишнее
     # сжатие с потерями посередине.
     "9":{"class_type":"SaveImage","inputs":{"images":["8",0],
          "filename_prefix":ВИДЕО_ПРЕФИКС}},
    }
    общее={"positive":["4",0],"negative":["5",0],"vae":["1",2],
           "width":w,"height":h,"length":frames,"batch_size":1}
    for i,имя in enumerate(images,1):
        g[f"3{i}"]={"class_type":"LoadImage","inputs":{"image":имя,"upload":"image"}}
        g[f"4{i}"]={"class_type":"ImageScale","inputs":{"image":[f"3{i}",0],"width":w,"height":h,
                    "upscale_method":"lanczos","crop":"center"}}
    if len(images)>=2:
        # Оба снимка одним пакетом: VACE берёт reference_image как
        # набор, и каждый человек в наборе остаётся собой.
        g["43"]={"class_type":"ImageBatch",
                 "inputs":{"image1":["41",0],"image2":["42",0]}}
        g["6"]={"class_type":"WanVaceToVideo",
                "inputs":{**общее,"strength":1.0,"reference_image":["43",0]}}
    elif images:
        # VACE, А НЕ ОБЫЧНЫЙ i2v. Замер на карте 22.09.2026, один кадр,
        # один текст, одно зерно, отличался только этот узел:
        #
        #   WanImageToVideo(start_image)  чужая женщина УЖЕ НА НУЛЕВОМ
        #                                 кадре: другое лицо, другая
        #                                 грудь, другая комната
        #   WanVaceToVideo(reference_image)  она же: то же лицо, та же
        #                                 грудь, тот же фон, и держится
        #                                 до конца ролика
        #
        # Сборка `wan2.2-rapid-mega-aio` грузится как WAN21_Vace, и
        # снимок она принимает только через вход VACE. Через start_image
        # кадр до неё просто не доходил — отсюда и «вообще другой
        # человек», на который жаловался владелец.
        g["6"]={"class_type":"WanVaceToVideo",
                "inputs":{**общее,"strength":1.0,"reference_image":["41",0]}}
    else:
        g["6"]={"class_type":"WanImageToVideo","inputs":общее}
    g["7"]["inputs"]["positive"]=["6",0]
    g["7"]["inputs"]["negative"]=["6",1]
    g["7"]["inputs"]["latent_image"]=["6",2]
    return g

# По этой приставке в имени файла видно, что это КАДРЫ РОЛИКА, а не
# фотография: `run` собирает из них mp4 и удаляет исходники.
ВИДЕО_ПРЕФИКС="vfr"
ВИДЕО_FPS=24


def собрать_mp4(кадры, ждём=None):
    """Список PNG-кадров -> один mp4. Возвращает [имя mp4] или кадры.

    `ждём` — сколько кадров заказывали. VACE отдаёт БОЛЬШЕ: впереди
    приезжает сам опорный снимок, развёрнутый в четыре кадра (у VAE
    сжатие по времени четырёхкратное). В ролике это выглядит как
    полсекунды стоп-кадра в начале, поэтому лишнее спереди срезается.

    Кадры уходят в ffmpeg списком, а не маской `%05d`: нумерация в
    ComfyUI сквозная по всем заданиям, и маска поймала бы чужие кадры
    соседнего ролика.

    H.264 + yuv420p + faststart — то, что играет везде, включая
    телеграм на айфоне. Не собралось — отдаём кадры как есть: пусть
    человек получит хоть что-то, работа уже оплачена.
    """
    if not кадры:
        return кадры
    лишние=[]
    if ждём and len(кадры)>ждём:
        лишние=кадры[:len(кадры)-ждём]
        кадры=кадры[len(кадры)-ждём:]
    список=os.path.join(OUT, f"кадры_{uuid.uuid4().hex[:8]}.txt")
    mp4=f"{ВИДЕО_ПРЕФИКС}_{uuid.uuid4().hex[:8]}.mp4"
    try:
        with open(список,"w",encoding="utf-8") as f:
            for к in кадры:
                f.write(f"file '{os.path.join(OUT,к)}'\n")
                f.write(f"duration {1.0/ВИДЕО_FPS}\n")
            # Последний кадр в concat-демуксере надо назвать дважды,
            # иначе его длительность теряется и ролик короче на кадр.
            f.write(f"file '{os.path.join(OUT,кадры[-1])}'\n")
        subprocess.run(["ffmpeg","-y","-loglevel","error","-f","concat",
                        "-safe","0","-i",список,"-fps_mode","cfr",
                        "-r",str(ВИДЕО_FPS),"-c:v","libx264",
                        "-pix_fmt","yuv420p","-crf","20",
                        "-movflags","+faststart",
                        "-vf","scale=trunc(iw/2)*2:trunc(ih/2)*2",
                        os.path.join(OUT,mp4)],check=True,timeout=600)
        if os.path.getsize(os.path.join(OUT,mp4))>0:
            for к in кадры+лишние:
                try: os.remove(os.path.join(OUT,к))
                except OSError: pass
            return [mp4]
    except Exception as e:
        print("mp4 не собрался:", str(e)[:200], flush=True)
    finally:
        try: os.remove(список)
        except OSError: pass
    return кадры


def в_mp4(имя):
    """Анимированный WEBP -> MP4. Возвращает имя файла, который отдавать.

    ComfyUI без сторонних узлов умеет сохранять ролик только
    анимированным WEBP (`SaveAnimatedWEBP`), и владелец получил в
    телеграме файл `video_00003_.webp` на 3,8 МБ: телефон показывает
    его вложением, а не видео, перемотки нет, в галерею не сохраняется.
    Ставить ради этого VideoHelperSuite не нужно — ffmpeg на карте уже
    есть, и один вызов решает дело.

    H.264 + yuv420p + faststart — то, что играет везде, включая
    телеграм на айфоне. Не вышло — возвращаем исходный webp: отдать
    хоть что-то лучше, чем уронить работу, за которую списаны коины.
    """
    if not имя.lower().endswith(".webp"):
        return имя
    исх=os.path.join(OUT,имя)
    mp4=имя[:-5]+".mp4"
    цель=os.path.join(OUT,mp4)
    try:
        subprocess.run(["ffmpeg","-y","-loglevel","error","-i",исх,
                        "-c:v","libx264","-pix_fmt","yuv420p","-crf","20",
                        "-movflags","+faststart",
                        # Ширина и высота обязаны быть чётными, иначе
                        # libx264 отказывается вовсе.
                        "-vf","scale=trunc(iw/2)*2:trunc(ih/2)*2",
                        цель],check=True,timeout=300)
        if os.path.getsize(цель)>0:
            return mp4
    except Exception as e:
        print("mp4 не собрался:", str(e)[:200], flush=True)
    return имя


# ПРИЁМКА НА КАРТЕ, А НЕ В ОБЛАКЕ.
#
# Облачную пробовали: у Gemini «платный» ключ оказался на бесплатном
# тарифе (20 запросов в сутки), у Claude API нулевой баланс. Проверка,
# которая работает первые двадцать кадров в сутки, — не проверка.
# Карта уже оплачена, и CLIP на ПРОЦЕССОРЕ считает одну картинку
# меньше секунды: быстрее, чем генерация, ради которой всё и затевалось.
#
# Смотрим только там, где есть с чем сравнивать, то есть у кнопок с
# опорой. У своего промпта эталона нет и быть не может.
#
# Приёмка НИКОГДА не роняет задание: её осечка — это наша беда, а не
# человека, который уже заплатил. Не сошлось — отдаём кадр как есть и
# пишем причину в ответ, дальше решает бот.
def принять(файлы, ключ):
    if not ключ or not файлы:
        return None
    имя=файлы[0]
    if имя.lower().endswith((".mp4",".webp",".gif")):
        return None          # ролик приёмка не оценит: он про движение
    try:
        import приёмка as оценка
        годен,причины=оценка.проверить(os.path.join(OUT,имя),ключ)
        return {"ок":bool(годен),"причины":причины}
    except Exception as e:
        print("приёмка не сработала:", str(e)[:200], flush=True)
        return None


def run(jid, graph):
    j=JOBS[jid]
    try:
        r=urllib.request.urlopen(urllib.request.Request(COMFY+"/prompt",
          data=json.dumps({"prompt":graph,"client_id":jid}).encode(),
          headers={"Content-Type":"application/json"}), timeout=60)
        b=json.load(r)
        if "error" in b:
            j.update(state="err", error=json.dumps(b["error"],ensure_ascii=False)[:400]); return
        pid=b["prompt_id"]; t0=time.time()
        while time.time()-t0<3600:
            try: h=json.load(urllib.request.urlopen(f"{COMFY}/history/{pid}",timeout=30))
            except Exception: time.sleep(2); continue
            if pid in h:
                st=h[pid].get("status",{}); files=[]
                for _,v in h[pid].get("outputs",{}).items():
                    for k in ("images","gifs","videos"):
                        for f in (v.get(k) or []):
                            if f.get("type")=="output": files.append(f["filename"])
                if st.get("status_str")=="success" and files:
                    if files[0].startswith(ВИДЕО_ПРЕФИКС+"_"):
                        files=собрать_mp4(files, j.get("кадров"))
                    else:
                        files=[в_mp4(f) for f in files]
                    j.update(state="ok",files=files,sec=round(time.time()-t0,1),
                             приёмка=принять(files, j.get("опора")))
                else:
                    j.update(state="err",error=" ".join(str(x)[:300] for x in st.get("messages",[])[-3:]) or "не получилось")
                return
            j["sec"]=round(time.time()-t0,1); time.sleep(2)
        j.update(state="err",error="слишком долго")
    except Exception as e:
        j.update(state="err",error=str(e)[:400])

SZ={"photo":{"vert":(768,1344),"sq":(1024,1024),"horiz":(1344,768)},
    "video":{"vert":(704,1280),"sq":(960,960),"horiz":(1280,704)},
    # ДЛИННЫЙ РОЛИК СЧИТАЕТСЯ МЕЛЬЧЕ, И ЭТО НЕ ЭКОНОМИЯ.
    #
    # У видеомодели внимание идёт по всему ролику разом, поэтому цена
    # растёт не вдвое от удвоения длины, а гораздо круче. Замер на
    # A100 23.09.2026, один кадр, один текст, одно зерно:
    #
    #     121 кадр (5 с), 1280×704     412 с
    #     241 кадр (10 с), 1280×704    БОЛЬШЕ 20 МИНУТ
    #
    # Двадцать минут человек не ждёт: он решит, что бот сломался, и
    # напишет в поддержку - а у бота ещё и своё ожидание кончалось на
    # пятнадцатой минуте, то есть за восемь коинов он получал ошибку.
    #
    # На 960×544 кадров столько же, а точек вдвое меньше. В телеграме,
    # который жмёт видео сам, разницы почти не видно; двадцати минут
    # ожидания - видно очень.
    "video_длинное":{"vert":(544,960),"sq":(704,704),"horiz":(960,544)}}

# С какой длины ролик считается мельче.
ДЛИННОЕ_С=7.0

# ПОДЪЁМ РАЗРЕШЕНИЯ — один, для всех и всегда.
#
# Ступеней 2K/4K/8K с доплатой нет: владелец счёл лишним выбор, который
# человек делает перед каждой работой и за который ещё и платит. Вместо
# них одно качество, сразу лучшее из того, что умеем, и уже в цене.
#
# Диффузия идёт в РОДНОМ разрешении модели и только в нём. Просить у
# Qwen-Image-Edit кадр вдвое выше обучающего — это швы, вторые головы и
# растянутые лица; дороже и хуже одновременно. Разрешение поднимается
# после, отдельным проходом через 4x-UltraSharp, а лишнее снимается
# lanczos'ом до точной цифры.
# ВО СКОЛЬКО РАЗ ПОДНИМАЕМ. Раньше здесь стояла ЦИФРА — 1152×2048, и
# апскейл приводил к ней ЛЮБОЙ кадр с `crop:"center"`. Для вертикальных
# кнопок это ровно полтора раза и ничего не режется, а горизонтальный
# лист 1344×768 обрезался в вертикаль 9:16: у «Секса раком» и
# «Кунилингуса» от кадра оставалась середина, головы уезжали за край.
# Владелец эти кадры отбирал целиком — и требовал «без обрезаний».
# Поэтому теперь множитель, а не цифра: пропорция листа сохраняется.
ПОДЪЁМ=1.5
АПСКЕЙЛЕР="4x-UltraSharp.pth"


def _апскейл(g, вход, узел=90, лист=None):
    """Досыпает узлы подъёма разрешения и отдаёт (граф, новый выход).

    `вход` — пара [узел, слот] с готовой картинкой. `лист` — (ширина,
    высота) заказанного кадра; без него подъём не делается, потому что
    без пропорции его не к чему привести.

    Апскейлера нет на диске — возвращаем вход как есть: отдать кадр в
    родном разрешении лучше, чем уронить задание, за которое уже
    списаны коины.
    """
    if not лист or not all(лист):
        return g, вход
    if not os.path.exists(os.path.join(UPSCALE_DIR, АПСКЕЙЛЕР)):
        print(f"апскейлер {АПСКЕЙЛЕР} не найден — отдаю родное разрешение", flush=True)
        return g, вход
    g[str(узел)]={"class_type":"UpscaleModelLoader",
                  "inputs":{"model_name":АПСКЕЙЛЕР}}
    g[str(узел+1)]={"class_type":"ImageUpscaleWithModel",
                    "inputs":{"upscale_model":[str(узел),0],"image":вход}}
    # Кратно восьми: не кратный размер ломает часть узлов и даёт
    # однопиксельную кайму по краю.
    w=int(лист[0]*ПОДЪЁМ)//8*8
    h=int(лист[1]*ПОДЪЁМ)//8*8
    g[str(узел+2)]={"class_type":"ImageScale",
                    "inputs":{"image":[str(узел+1),0],"width":w,"height":h,
                              "upscale_method":"lanczos","crop":"disabled"}}
    return g, [str(узел+2),0]

@app.post("/api/gen")
def gen():
    """Запуск задания.

    Снимки принимаются списком `images`; одиночный `image` понимается
    тоже — так старый вызывающий код не ломается на первом же запросе.
    Шаги и CFG из запроса НЕ берём: ускорители внутри сборок, и чужие
    значения их ломают. Пусть лучше панель будет упрямой, чем выдаст
    пережжённый кадр за деньги клиента.
    """
    d=request.get_json(force=True)
    mode=d.get("mode","photo"); p=(d.get("prompt") or "").strip()
    if not p: return jsonify(error="Не написан запрос"),400
    seed=int(d.get("seed") or 0) or int(time.time()*1000)%(10**9)
    neg=(d.get("neg") or "").strip() or None
    images=d.get("images") or ([d["image"]] if d.get("image") else [])
    images=[x for x in images if x]
    # Подъём разрешения — только у фото. У видео его нет вовсе:
    # апскейлить каждый кадр десятисекундного ролика это минуты карты и
    # файл, который телеграм всё равно не пропустит.
    if mode=="inpaint":
        if not images or not d.get("mask"):
            return jsonify(error="Нужны фото и обведённая область"),400
        g=wf_inpaint(p,seed,images[0],d["mask"],
                     int(d.get("feather",24)),int(d.get("grow",8)),neg)
        w=h=0
    elif mode=="photo":
        if len(images)>MAX_REF:
            return jsonify(error=f"Модель берёт не больше {MAX_REF} снимков"),400
        w,h=SZ["photo"].get(d.get("size","vert"),(768,1344))
        # `denoise` — единственное, что мы берём у вызывающего кроме
        # текста и снимков: это не настройка сэмплера, а выбор товара
        # (см. `_фото_база`). Шаги и CFG по-прежнему наши.
        g=wf_photo(p,w,h,seed,images,neg,
                   max(0.3,min(1.0,float(d.get("denoise",1.0)))),
                   опора_файл(d.get("опора"),
                              ОПОРА_СВОЯ.get(str(d.get("опора") or ""),{})
                              .get("вид", d.get("опора_вид") or "глубина")),
                   d.get("опора_сила"),d.get("опора_до"),
                   str(d.get("опора") or ""))
    else:
        if len(images)>2:
            return jsonify(error="Видео берёт не больше двух снимков"),400
        # Длина кратна 4 плюс 1 — требование узлов Wan.
        сек=max(1.0,min(10.0,float(d.get("secs",5))))
        лист="video_длинное" if сек>=ДЛИННОЕ_С else "video"
        w,h=SZ[лист].get(d.get("size","vert"),SZ[лист]["vert"])
        frames=int(сек*24)//4*4+1
        g=wf_video(p,w,h,frames,seed,images,neg,float(d.get("shift",8.0)))
    jid=uuid.uuid4().hex[:8]
    JOBS[jid]={"state":"run","sec":0,"mode":mode,"seed":seed,"w":w,"h":h,
               "refs":len(images),"кадров":frames if mode=="video" else None,
               # Ключ кнопки нужен приёмке: по нему она берёт эталон.
               "опора":(d.get("опора") or "") if mode=="photo" else ""}
    threading.Thread(target=run,args=(jid,g),daemon=True).start()
    return jsonify(job=jid,seed=seed)

@app.get("/api/job/<jid>")
def job(jid): return jsonify(JOBS.get(jid,{"state":"err","error":"нет такой задачи"}))

@app.post("/api/upload")
def upload():
    f=request.files.get("file")
    if not f: return jsonify(error="нет файла"),400
    os.makedirs(IN,exist_ok=True)
    safe="".join(c for c in (f.filename or "img.png") if c.isalnum() or c in "._-")[-40:]
    name=f"up_{uuid.uuid4().hex[:8]}_{safe or 'img.png'}"
    f.save(os.path.join(IN,name))
    return jsonify(name=name)

@app.get("/in/<path:n>")
def infile(n):
    p=os.path.join(IN,n); return send_file(p) if os.path.exists(p) else ("нет",404)

@app.get("/file/<path:n>")
def outfile(n):
    p=os.path.join(OUT,n); return send_file(p) if os.path.exists(p) else ("нет",404)

@app.get("/api/recent")
def recent():
    try:
        fs=[(os.path.getmtime(os.path.join(OUT,f)),f) for f in os.listdir(OUT)
            if f.lower().endswith((".png",".webp",".jpg"))]
        fs.sort(reverse=True); return jsonify(files=[f for _,f in fs[:30]])
    except Exception: return jsonify(files=[])

# ГОТОВНОСТЬ КАРТЫ. Заведено 23.09.2026 после переезда на A100.
#
# Карта арендуется почасово и меняется целиком: модели переезжают
# копией, а всё, что ставилось руками, молча остаётся на прежней. Так и
# вышло — на новой карте не оказалось ffmpeg, и ролик уходил бы клиенту
# СОТНЕЙ PNG вместо видео. Ошибки при этом нет: задание успешно, файлы
# отданы, в журнале одна строка «mp4 не собрался».
#
# Поэтому список того, без чего карта не работает, лежит в коде и
# проверяется при запуске и по запросу.
def готовность():
    беды=[]
    if not shutil.which("ffmpeg"):
        беды.append("нет ffmpeg: ролик уйдёт кадрами вместо видео")
    for имя,путь in (("сборка фото", os.path.join(CKPT_DIR,CKPT_PHOTO)),
                     ("сборка видео", os.path.join(CKPT_DIR,CKPT_VIDEO)),
                     ("апскейлер", os.path.join(UPSCALE_DIR,АПСКЕЙЛЕР)),
                     ("ControlNet", os.path.join(CN_DIR,CN_UNION))):
        if not os.path.exists(путь):
            беды.append(f"нет файла «{имя}»: {путь}")
    сколько=len([f for f in os.listdir(ОПОРЫ)
                 if f.endswith(".png")]) if os.path.isdir(ОПОРЫ) else 0
    for ключ,своя in ОПОРА_СВОЯ.items():
        п=os.path.join(ВИДЫ_ОПОР[своя["вид"]][0],ключ+".png")
        if not os.path.exists(п):
            беды.append(f"нет опоры «{своя['вид']}» у {ключ}: {п}")
    if сколько < ОПОР_ЖДЁМ:
        беды.append(f"опор по глубине {сколько} из {ОПОР_ЖДЁМ}: "
                    f"кнопки без опоры выдадут не ту позу")
    return {"готова": not беды, "беды": беды}


@app.get("/api/готовность")
def готовность_ответ():
    return jsonify(готовность())

@app.get("/api/stats")
def stats():
    try:
        s=json.load(urllib.request.urlopen(COMFY+"/system_stats",timeout=10))
        dv=(s.get("devices") or [{}])[0]
        q=json.load(urllib.request.urlopen(COMFY+"/queue",timeout=10))
        return jsonify(free=round(dv.get("vram_free",0)/1024**3,1),
                       total=round(dv.get("vram_total",0)/1024**3,1),
                       queue=len(q.get("queue_running",[]))+len(q.get("queue_pending",[])))
    except Exception as e: return jsonify(error=str(e)[:120])

@app.get("/")
def index():
    return Response(open("/home/ubuntu/panel.html",encoding="utf-8").read(),
                    mimetype="text/html; charset=utf-8")

if __name__=="__main__":
    # Ругаемся при запуске, а не при первом заказе: беду видно в
    # журнале службы сразу после переезда на новую карту, а не через
    # день, когда клиент получит ролик кадрами.
    _г=готовность()
    for _б in _г["беды"]:
        print("КАРТА НЕ ГОТОВА:", _б, flush=True)
    if _г["готова"]:
        print("карта готова: ffmpeg, сборки, апскейлер, ControlNet, опоры",
              flush=True)
    app.run(host="127.0.0.1",port=8090,threaded=True)
