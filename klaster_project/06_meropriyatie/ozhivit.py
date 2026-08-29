# -*- coding: utf-8 -*-
"""Оживление светлых кадров брокер-тура через Runway.

Правило владельца: сначала фото, потом видео по этому фото. Стартовым кадром
идёт наша же картинка из поста, поэтому ролик и пост совпадают до пикселя.

Движение только настоящее: техника едет, люди идут, листва и облака двигаются,
камера ползёт на пару метров. Никаких скоростных наездов и подмены кадра.
"""
import subprocess, os, time

КАДРЫ = "/opt/oko-poster/klaster_svet"
КУДА = "/opt/oko-poster/klaster_svet_video"

ОБЩЕЕ = (
 "Physical correctness is the highest priority: shadows stay consistent with a "
 "fixed sun, objects never morph or change scale, straight lines stay straight, "
 "faces are never re-rendered in close detail. All lettering already present in "
 "the frame stays perfectly still, sharp and unchanged, letter for letter, with "
 "no warping, no flicker, no re-spelling of a single Russian character. "
 "Absolutely forbidden: new objects or people appearing or vanishing, buildings "
 "changing shape, windows multiplying, colour shifts, night falling, lens flares, "
 "floating particles, smoke, speed ramps, cuts, camera shake, zoom snaps. "
 "Colour and light stay exactly as in the source photograph: bright natural "
 "daylight, light architecture, amber accent only where it already is. "
 "25 frames per second, natural motion blur, one continuous take, the last frame "
 "matching the first so the clip loops cleanly."
)

РАБОТЫ = [
 ("EV-01-svet-tur",
  "Animate this exact photograph into one calm cinematic aerial shot, eight "
  "seconds. The architecture does not change at all: same buildings, same roads, "
  "same parked cars, same trees, same sky. Only believable motion is added, slow "
  "and ordinary. A single truck rolls forward at walking pace along the internal "
  "road towards the loading aprons. Two small figures continue walking unhurried "
  "towards the glazed entrance canopy. Tree canopies and mown lawn move gently in "
  "a light breeze. Thin high cumulus drifts slowly across the blue sky. Sunlight "
  "stays constant, it is ten in the morning throughout. Camera movement, one "
  "phrase only: an extremely slow aerial push forward of about two metres with a "
  "barely perceptible descent, locked and level, no orbit, no roll. " + ОБЩЕЕ),

 ("EV-04-svet-zal",
  "Animate this exact photograph into one calm cinematic interior shot, eight "
  "seconds. The hall, its architecture, chairs, screen and furniture stay exactly "
  "as they are. Only believable human motion is added: the two people arriving "
  "down the aisle keep walking slowly away from camera towards a free row, one "
  "seated person turns their head slightly towards the stage, a hand moves on a "
  "printed folder, daylight through the tall windows shifts almost imperceptibly "
  "as a cloud passes outside. The screen at the front keeps its neutral light "
  "slide unchanged. Camera movement, one phrase only: a very slow dolly forward "
  "along the aisle of about one metre, perfectly level, no shake, no zoom, no "
  "rotation. " + ОБЩЕЕ),
]

os.makedirs(КУДА, exist_ok=True)
for имя, промпт in РАБОТЫ:
    кадр = f"{КАДРЫ}/{имя}.png"
    файл = f"{КУДА}/{имя}.mp4"
    print(f"=== {имя} · промпт {len(промпт)} знаков ===", flush=True)
    if not os.path.exists(кадр):
        print("нет стартового кадра", flush=True)
        continue
    среда = dict(os.environ, RW_METKA="кадр", RW_ZHDAT="900",
                 CDP="http://127.0.0.1:9254", CHROME_CDP="http://127.0.0.1:9254")
    т = time.time()
    r = subprocess.run(["node", "/opt/oko-poster/runway_web.mjs", "gen4.5",
                        промпт, файл, "8", "16:9", кадр],
                       capture_output=True, text=True, timeout=1800, env=среда,
                       cwd="/opt/oko-poster")
    вывод = (r.stdout or "") + (r.stderr or "")
    open(f"/tmp/rw_{имя}.log", "w").write(вывод)
    есть = os.path.exists(файл)
    print(f"{имя}: {'готово' if есть else 'НЕ ВЫШЛО'} "
          f"{os.path.getsize(файл) if есть else 0} байт за {round(time.time()-т)} с",
          flush=True)
    print(вывод[-400:], flush=True)
