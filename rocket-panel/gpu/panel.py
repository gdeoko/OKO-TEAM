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
растёт в шесть раз.

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
"""
import json, time, uuid, os, subprocess, threading, urllib.request
from flask import Flask, request, jsonify, send_file, Response

COMFY="http://127.0.0.1:8188"
OUT="/home/ubuntu/ComfyUI/output"; IN="/home/ubuntu/ComfyUI/input"
UPSCALE_DIR="/home/ubuntu/ComfyUI/models/upscale_models"
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
# Полтора — ровно столько, сколько эта сборка терпит. Поднимать выше
# нельзя, и проверять это заново не надо: результат выше.
CFG_ФОТО=1.5

# Wan обучен на китайском негативе — он работает лучше английского
WAN_NEG=("色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，"
         "最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，"
         "画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，"
         "杂乱的背景，三条腿，背景人很多，倒着走")
PHOTO_NEG=("low quality, worst quality, blurry, out of focus, jpeg artifacts, deformed, "
           "disfigured, bad anatomy, mutated hands, fused fingers, extra fingers, extra limbs, "
           "malformed limbs, asymmetric eyes, watermark, signature, text")

MAX_REF=3          # столько снимков берёт TextEncodeQwenImageEditPlus


def шаги_под_denoise(denoise):
    """Сколько шагов просить, чтобы РЕАЛЬНО прошло STEPS.

    KSampler при denoise<1 стартует не с нуля и отрабатывает только
    хвост расписания: при steps=4 и denoise=0.5 сэмплер делает ДВА шага.
    На обычной модели это просто грязнее, на четырёхшаговой сборке —
    каша. Поэтому шаги поднимаем обратно.
    """
    denoise=max(0.05,min(1.0,float(denoise)))
    return max(STEPS, int(round(STEPS/denoise)))


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


def wf_photo(p,w,h,seed,images=None,neg=None,denoise=1.0):
    """Текст в фото и фото в фото — один граф, разница в наличии снимков."""
    # Без снимков стартового латента нет вовсе, и частичный denoise
    # означал бы недосчитанный шум вместо картинки.
    if not images:
        denoise=1.0
    g=_фото_база(p,neg,seed,images,denoise)
    g,выход=_апскейл(g,["8",0])
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
    g,выход=_апскейл(g,["25",0])
    g["9"]={"class_type":"SaveImage","inputs":{"images":выход,"filename_prefix":"inpaint"}}
    return g


def wf_video(p,w,h,frames,seed,images=None,neg=None,shift=8.0):
    """Три режима одним графом, по числу снимков:

        нет снимков  — текст в видео
        один         — оживление, снимок становится ПЕРВЫМ кадром
        два          — первый и последний кадр, движение приходит ко второму

    Второй случай берёт WanFirstLastFrameToVideo: у сборки VACE внутри,
    и это её главное умение поверх обычного i2v.
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
        g["6"]={"class_type":"WanFirstLastFrameToVideo",
                "inputs":{**общее,"start_image":["41",0],"end_image":["42",0]}}
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
                    j.update(state="ok",files=files,sec=round(time.time()-t0,1))
                else:
                    j.update(state="err",error=" ".join(str(x)[:300] for x in st.get("messages",[])[-3:]) or "не получилось")
                return
            j["sec"]=round(time.time()-t0,1); time.sleep(2)
        j.update(state="err",error="слишком долго")
    except Exception as e:
        j.update(state="err",error=str(e)[:400])

SZ={"photo":{"vert":(768,1344),"sq":(1024,1024),"horiz":(1344,768)},
    "video":{"vert":(704,1280),"sq":(960,960),"horiz":(1280,704)}}

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
ВЫХОД=(1152,2048)             # вертикаль 9:16
АПСКЕЙЛЕР="4x-UltraSharp.pth"


def _апскейл(g, вход, узел=90):
    """Досыпает узлы подъёма разрешения и отдаёт (граф, новый выход).

    `вход` — пара [узел, слот] с готовой картинкой. Апскейлера нет на
    диске — возвращаем вход как есть: отдать кадр в родном разрешении
    лучше, чем уронить задание, за которое уже списаны коины.
    """
    if not os.path.exists(os.path.join(UPSCALE_DIR, АПСКЕЙЛЕР)):
        print(f"апскейлер {АПСКЕЙЛЕР} не найден — отдаю родное разрешение", flush=True)
        return g, вход
    g[str(узел)]={"class_type":"UpscaleModelLoader",
                  "inputs":{"model_name":АПСКЕЙЛЕР}}
    g[str(узел+1)]={"class_type":"ImageUpscaleWithModel",
                    "inputs":{"upscale_model":[str(узел),0],"image":вход}}
    w,h=ВЫХОД
    g[str(узел+2)]={"class_type":"ImageScale",
                    "inputs":{"image":[str(узел+1),0],"width":w,"height":h,
                              "upscale_method":"lanczos","crop":"center"}}
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
                   max(0.3,min(1.0,float(d.get("denoise",1.0)))))
    else:
        if len(images)>2:
            return jsonify(error="Видео берёт первый и последний кадр, не больше"),400
        w,h=SZ["video"].get(d.get("size","vert"),(704,1280))
        # Длина кратна 4 плюс 1 — требование узлов Wan.
        сек=max(1.0,min(10.0,float(d.get("secs",5))))
        frames=int(сек*24)//4*4+1
        g=wf_video(p,w,h,frames,seed,images,neg,float(d.get("shift",8.0)))
    jid=uuid.uuid4().hex[:8]
    JOBS[jid]={"state":"run","sec":0,"mode":mode,"seed":seed,"w":w,"h":h,
               "refs":len(images),"кадров":frames if mode=="video" else None}
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
    app.run(host="127.0.0.1",port=8090,threaded=True)
