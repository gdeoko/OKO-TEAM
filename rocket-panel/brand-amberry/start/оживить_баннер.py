#!/usr/bin/env python3
"""Оживить стартовый баннер: 5 секунд, зацикленно, ГОРИЗОНТАЛЬНО.

ЛИСТ ГОРИЗОНТАЛЬНЫЙ, и это не вкус. Телеграм показывает под
картинкой текст и кнопки, а высокую картинку при этом подрезает:
вертикальная заставка теряла и логотип, и подпись. 1280x704
(`SZ["video"]["horiz"]`) помещается целиком.

Движение здесь НЕ должно быть сюжетом. Это заставка, её увидят при
каждом входе и увидят много раз подряд: всё, что бросается в глаза,
на третий раз начинает раздражать. Поэтому просят только дыхание
неона, рябь на мокром полу и едва заметное живое движение модели.

ЗАЦИКЛЕННОСТЬ делается не моделью, а сборкой: Wan не умеет замкнуть
ролик сам, и попытка попросить его словами даёт рывок на стыке.
Готовые кадры склеиваются «туда и обратно» (boomerang) — последний
кадр переходит в предпоследний и так до первого. Стык исчезает
математически, а не по везению.
"""
import json
import os
import subprocess
import sys
import time
import urllib.parse
import urllib.request

ПАНЕЛЬ = "http://127.0.0.1:8090"
ВЫХОД = "/root/ComfyUI/output"
КАДР = "ban169.jpg"

ДВИЖЕНИЕ = (
    "cinematic looping motion of a neon night studio scene. The vertical "
    "neon tubes in the background pulse and flicker very gently, their "
    "magenta glow breathing slowly brighter and dimmer. Thin haze drifts "
    "slowly through the light beams. On the wet mirror floor the "
    "reflections shimmer and fine concentric ripples spread outward and "
    "fade. The young woman stays exactly where she is and keeps her pose: "
    "only a soft natural breath lifting her chest, a slow blink, a few "
    "strands of her long blonde hair stirring slightly, and the faintest "
    "shift of her smile. The neon sign text and the berry logo stay "
    "perfectly still, sharp and unchanged. Camera locked off, no zoom, no "
    "pan. Photorealistic, stable facial features, smooth continuous "
    "motion"
)
ОТРИЦАНИЕ = (
    "text changing, letters morphing, garbled text, logo deforming, "
    "camera movement, zoom, pan, person walking, large body movement, "
    "changing pose, blurry, distorted face, extra limbs, deformed hands, "
    "morphing, flickering artifacts, duplicate person, warped anatomy"
)


def дай(путь, данные=None, таймаут=120):
    тело = json.dumps(данные).encode() if данные is not None else None
    з = urllib.request.Request(ПАНЕЛЬ + urllib.parse.quote(путь, safe="/"),
                               data=тело,
                               headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(з, timeout=таймаут) as о:
        return json.load(о)


заказ = {"mode": "video", "prompt": ДВИЖЕНИЕ, "neg": ОТРИЦАНИЕ,
         "secs": 5, "size": "horiz", "seed": 202509,
         "images": [КАДР],
         # euler_ancestral: на этой карте он в полтора раза быстрее
         # dpmpp_sde при том же числе шагов, а заставке хватает.
         "сэмплер": "euler_ancestral", "планировщик": "beta"}

н = time.time()
о = дай("/api/gen", заказ)
jid = о.get("job")
print("задание:", jid or json.dumps(о, ensure_ascii=False)[:200], flush=True)
if not jid:
    raise SystemExit(1)

исходник = None
while time.time() - н < 1800:
    time.sleep(5)
    try:
        с = дай("/api/job/" + jid, таймаут=40)
    except Exception:
        continue
    if с.get("state") == "ok":
        исходник = (с.get("files") or [None])[0]
        print("ролик готов за %.1f мин: %s" % ((time.time() - н) / 60, исходник),
              flush=True)
        break
    if с.get("state") in ("err", "error"):
        print("ОШИБКА:", str(с.get("error"))[:300], flush=True)
        raise SystemExit(1)
else:
    print("не дождалась", flush=True)
    raise SystemExit(1)

путь = os.path.join(ВЫХОД, исходник)
петля = os.path.join(ВЫХОД, "amberry_start_loop.mp4")

# ЗАЦИКЛИВАНИЕ. `reverse` делает копию задом наперёд, `concat` клеит её
# следом. Итог длиннее вдвое и замкнут: последний кадр петли — он же
# первый. Звука в исходнике нет, поэтому дорожку не трогаем.
subprocess.run(
    ["ffmpeg", "-y", "-v", "error", "-i", путь,
     "-filter_complex",
     "[0:v]split[a][b];[b]reverse[r];[a][r]concat=n=2:v=1[v]",
     "-map", "[v]", "-an",
     "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20",
     "-movflags", "+faststart", петля],
    check=True)
print("петля собрана: %s, %d КБ"
      % (петля, os.path.getsize(петля) // 1024), flush=True)

# Телеграм показывает mp4 без звука как «видео»; чтобы он крутил его
# сам и по кругу, отдавать надо как АНИМАЦИЮ (sendAnimation). Формат
# тот же mp4 — отдельная gif не нужна и весила бы втрое больше.
print("ВЫХОДНОЙ ФАЙЛ:", петля, flush=True)
