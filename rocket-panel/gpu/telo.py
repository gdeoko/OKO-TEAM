# -*- coding: utf-8 -*-
"""Дорисовать тело реалистичной NSFW-моделью SDXL поверх кадра Qwen.

## Зачем вторая модель

Владелец 30.09.2026, крупно: «на всём теле квадратики и рябь, на письке
есть, на сиськах есть, на лице нету, на фоне нету; соски не похожи на
настоящие, очка вообще нету». Разобрали по шагам:

- Qwen-Rapid (дистиллят на восемь шагов) держит позу, свет и лицо, но
  микрофактуры кожи не рисует: ровные места тела выходят пятнами и
  мазками, органы - гладкой формой без складок.
- Лицо чистое потому, что его отдельно перерисовывает восстановитель,
  обученный на лицах. У тела такого шага не было.
- Плёночное зерно рябь прячет, но органов не добавляет - владелец его
  отверг сразу: «это же брак».

LUSTIFY SDXL v2.0 обучена на живой обнажёнке и рисует ровно то, чего нет
у Qwen: поры, соски с бугорками, малые и большие губы, анус. Qwen
остаётся главным - поза, лицо и сцена его, - а SDXL проходит поверх с
частичным denoise и только дорисовывает.

Замер на «Крупном плане» с Юки, 30.09.2026:

    кожа 0.30, зоны 0.45   губы и анус появились, складки на животе остались
    кожа 0.40, зоны 0.55   складки ушли, в промежности лишняя влага
    кожа 0.45, зоны 0.50   складки ушли, губы и анус живые  <- принято

Складки ушли только после запрета «abs, horizontal skin folds» в
негативе: без него SDXL честно дорисовывает рельеф, который нарисовал Qwen.

## Как

1. Кадр увеличивается вдвое lanczos'ом.
2. Кожа всего кадра: плитки 1024 с нахлёстом 192, denoise КОЖА.
3. Зоны по скелету (грудь, промежность): кроп поднимается до 1024 и
   считается сильнее, denoise ЗОНЫ, свой текст про анатомию.
4. Лицо возвращается исходное по эллипсу. SDXL на нём меняет черты, а
   сходство держит Qwen со вторым референсом и восстановитель после.
"""
import json
import os
import time
import urllib.request
import uuid

import cv2
import numpy as np

COMFY = os.environ.get("ROCKET_COMFY", "http://127.0.0.1:8188")
IN = os.environ.get("ROCKET_COMFY_IN", "/root/ComfyUI/input")
OUT = os.environ.get("ROCKET_COMFY_OUT", "/root/ComfyUI/output")
CKPT = os.environ.get("ROCKET_TELO_CKPT", "lustify_v20.safetensors")
КОЖА = float(os.environ.get("ROCKET_TELO_KOZHA", "0.45"))
ЗОНЫ = float(os.environ.get("ROCKET_TELO_ZONY", "0.50"))
ПОЗА = os.environ.get("ROCKET_POSE_TASK", "/root/models/pose_landmarker_heavy.task")

НЕГ = ("painting, illustration, cgi, 3d render, plastic skin, airbrushed, "
       "smooth waxy skin, blurry, lowres, jpeg artifacts, banding, "
       "posterization, deformed, extra fingers, text, watermark, clothes, "
       "underwear, abs, six pack, muscular belly, horizontal skin folds, "
       "wrinkled belly, creases, tattoo, tattoos, ink drawings on skin")
ТЕКСТ_КОЖА = ("raw amateur photo of a nude adult woman, real skin with fine "
              "pores and natural texture, clean skin without tattoos, natural "
              "soft light, sharp focus, photorealistic")
ТЕКСТ_ГРУДЬ = ("close-up photo of natural breasts, realistic nipples and "
               "areolae with fine skin texture and bumps, real skin pores")
ТЕКСТ_ПАХ = ("close-up explicit photo of a real shaved vulva, detailed natural "
             "labia minora and majora, clitoral hood, visible anus below, "
             "natural skin folds and texture, realistic anatomy, sharp focus")


def _comfy(кадр, текст, сила, зерно):
    """Один проход img2img SDXL. Кадр туда, кадр обратно."""
    имя = "telo_" + uuid.uuid4().hex[:10] + ".png"
    cv2.imwrite(os.path.join(IN, имя), кадр)
    g = {"1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CKPT}},
         "2": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": текст}},
         "3": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["1", 1], "text": НЕГ}},
         "4": {"class_type": "LoadImage", "inputs": {"image": имя}},
         "5": {"class_type": "VAEEncode", "inputs": {"pixels": ["4", 0], "vae": ["1", 2]}},
         "6": {"class_type": "KSampler", "inputs": {
             "model": ["1", 0], "positive": ["2", 0], "negative": ["3", 0],
             "latent_image": ["5", 0], "seed": int(зерно), "steps": 30, "cfg": 5.0,
             "sampler_name": "dpmpp_2m", "scheduler": "karras", "denoise": float(сила)}},
         "7": {"class_type": "VAEDecode", "inputs": {"samples": ["6", 0], "vae": ["1", 2]}},
         "8": {"class_type": "SaveImage", "inputs": {"images": ["7", 0], "filename_prefix": "telo"}}}
    запрос = urllib.request.Request(
        COMFY + "/prompt", data=json.dumps({"prompt": g}).encode(),
        headers={"Content-Type": "application/json"})
    pid = json.loads(urllib.request.urlopen(запрос).read())["prompt_id"]
    т = time.time()
    try:
        while time.time() - т < 300:
            time.sleep(0.7)
            h = json.loads(urllib.request.urlopen(COMFY + "/history/" + pid).read())
            if pid not in h:
                continue
            if h[pid].get("status", {}).get("status_str") == "error":
                raise RuntimeError(json.dumps(h[pid]["status"])[:300])
            f = h[pid]["outputs"]["8"]["images"][0]["filename"]
            готово = cv2.imread(os.path.join(OUT, f))
            try:
                os.remove(os.path.join(OUT, f))
            except OSError:
                pass
            return готово
        raise RuntimeError("SDXL не ответила за пять минут")
    finally:
        try:
            os.remove(os.path.join(IN, имя))
        except OSError:
            pass


def _вклеить(холст, кусок, x, y, край):
    """Кусок в холст с мягким краем: без шва на границе плитки."""
    h, w = кусок.shape[:2]
    м = np.ones((h, w), np.float32)
    for i in range(край):
        v = (i + 1) / (край + 1)
        м[i, :] = np.minimum(м[i, :], v)
        м[h - 1 - i, :] = np.minimum(м[h - 1 - i, :], v)
        м[:, i] = np.minimum(м[:, i], v)
        м[:, w - 1 - i] = np.minimum(м[:, w - 1 - i], v)
    м = м[..., None]
    холст[y:y + h, x:x + w] = холст[y:y + h, x:x + w] * (1 - м) + кусок.astype(np.float32) * м


def _зоны(кадр):
    """Центры и размеры зон груди и промежности по скелету. [] если нет."""
    if not os.path.exists(ПОЗА):
        return []
    import mediapipe as mp
    from mediapipe.tasks.python import BaseOptions, vision
    дет = vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=ПОЗА)))
    try:
        р = дет.detect(mp.Image(image_format=mp.ImageFormat.SRGB,
                                data=cv2.cvtColor(кадр, cv2.COLOR_BGR2RGB)))
    finally:
        дет.close()
    if not р.pose_landmarks:
        return []
    H, W = кадр.shape[:2]
    L = р.pose_landmarks[0]

    def т(i):
        return np.array([L[i].x * W, L[i].y * H])
    # Грудь и таз видны не всегда: у вида сзади груди в кадре нет, и
    # рисовать её там нельзя. Порог видимости скелета отсекает такие.
    видно = lambda *и: all((L[i].visibility or 0) > 0.5 for i in и)  # noqa: E731
    плечи = (т(11) + т(12)) / 2
    бёдра = (т(23) + т(24)) / 2
    шир = max(np.linalg.norm(т(11) - т(12)), np.linalg.norm(т(23) - т(24)))
    зоны = []
    if видно(11, 12, 23, 24):
        зоны.append(("грудь", плечи + (бёдра - плечи) * 0.28, шир * 1.25, ТЕКСТ_ГРУДЬ))
    if видно(23, 24):
        зоны.append(("пах", бёдра + (бёдра - плечи) * 0.18, шир * 1.1, ТЕКСТ_ПАХ))
    return зоны


_ЛИЦА = [None]


def _лица(кадр):
    """Рамки всех уверенных лиц (RetinaFace). Пустой список, если нет."""
    try:
        import torch
        if _ЛИЦА[0] is None:
            from facexlib.detection import init_detection_model
            _ЛИЦА[0] = init_detection_model("retinaface_resnet50", half=False, device="cuda")
        with torch.no_grad():
            лица = _ЛИЦА[0].detect_faces(кадр, 0.8)
        return [] if лица is None else [л[:4] for л in лица]
    except Exception as e:                                  # noqa: BLE001
        print("тело: лица не нашлись:", str(e)[:120], flush=True)
        return []


def _лицо(кадр):
    """Рамка крупнейшего лица (RetinaFace) или None."""
    try:
        import torch
        if _ЛИЦА[0] is None:
            from facexlib.detection import init_detection_model
            _ЛИЦА[0] = init_detection_model("retinaface_resnet50", half=False, device="cuda")
        with torch.no_grad():
            лица = _ЛИЦА[0].detect_faces(кадр, 0.8)
        if лица is None or len(лица) == 0:
            return None
        return max(лица, key=lambda f: (f[2] - f[0]) * (f[3] - f[1]))[:4]
    except Exception as e:                                  # noqa: BLE001
        print("тело: лицо не нашлось:", str(e)[:120], flush=True)
        return None


def дорисовать(кадр, кожа=None, зоны=None, зерно=11, сзади=False, пара=False):
    """Кадр BGR -> кадр BGR вдвое больше, с кожей и органами от SDXL."""
    кожа = КОЖА if кожа is None else float(кожа)
    зоны_сила = ЗОНЫ if зоны is None else float(зоны)
    H0, W0 = кадр.shape[:2]
    большой = cv2.resize(кадр, (W0 * 2, H0 * 2), interpolation=cv2.INTER_LANCZOS4)
    H, W = большой.shape[:2]
    холст = большой.astype(np.float32)

    if кожа > 0:
        T, НАХ = 1024, 192
        xs = list(range(0, max(1, W - T) + 1, T - НАХ))
        ys = list(range(0, max(1, H - T) + 1, T - НАХ))
        xs[-1], ys[-1] = max(0, W - T), max(0, H - T)
        for y in ys:
            for x in xs:
                кус = большой[y:y + T, x:x + T]
                _вклеить(холст, _comfy(кус, ТЕКСТ_КОЖА, кожа, зерно + x + y), x, y, 64)

    # У пары зон нет: скелет находит одного человека, и текст «vulva»
    # лёг бы на промежность мужчины.
    if зоны_сила > 0 and not пара:
        for имя, ц, р, текст in _зоны(кадр):
            if сзади and имя == "грудь":
                continue
            ц = ц * 2
            р = int(max(256, min(р * 2, min(W, H) * 0.6)))
            x0 = int(np.clip(ц[0] - р / 2, 0, W - р))
            y0 = int(np.clip(ц[1] - р / 2, 0, H - р))
            кус = холст[y0:y0 + р, x0:x0 + р].clip(0, 255).astype(np.uint8)
            кус = cv2.resize(кус, (1024, 1024), interpolation=cv2.INTER_LANCZOS4)
            нов = cv2.resize(_comfy(кус, текст, зоны_сила, зерно + 66),
                             (р, р), interpolation=cv2.INTER_AREA)
            _вклеить(холст, нов, x0, y0, max(24, р // 6))

    # Лица обратно исходные - ВСЕ, у пары оба: сходство держит Qwen, а
    # не SDXL.
    for р in _лица(большой):
        x0, y0, x1, y1 = [float(v) for v in р]
        cx, cy, r = (x0 + x1) / 2, (y0 + y1) / 2, max(x1 - x0, y1 - y0) * 0.8
        м = np.zeros((H, W), np.float32)
        cv2.ellipse(м, (int(cx), int(cy)), (int(r), int(r * 1.2)), 0, 0, 360, 1, -1)
        м = cv2.GaussianBlur(м, (0, 0), max(2.0, r / 5))[..., None]
        холст = холст * (1 - м) + большой.astype(np.float32) * м
    return холст.clip(0, 255).astype(np.uint8)
