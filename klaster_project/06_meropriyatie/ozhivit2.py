# -*- coding: utf-8 -*-
"""Пересборка EV-01: камера закреплена, вывеска из кадра убрана.

Первый заход показал две беды: камера уехала вперёд сильнее, чем просили,
и вывеска «КЛАСТЕР» на фасаде превратилась в «СПАСТЕР» уже на первой секунде.
Мелкий текст видеомодель перерисовывает, крупный заголовок поста держит.
Значит камеру фиксируем совсем, а вывеску из стартового кадра убираем.
"""
import subprocess, os, time

ПРОМПТ = (
 "Animate this exact photograph into one calm eight second shot with a completely "
 "locked camera. This is the single most important instruction: the camera does "
 "not move at all, no push in, no pull back, no drift, no pan, no tilt, no zoom, "
 "no parallax, no handheld shake. Treat it as a tripod locked off shot where the "
 "framing at second eight is identical to the framing at second zero. "
 "The architecture does not change in any way: same buildings, same rooflines, "
 "same windows, same parked cars, same trees, same sky, same road markings. "
 "Only small believable motion is added inside the frame. A single white truck "
 "rolls forward at walking pace along the internal road towards the loading "
 "aprons. Two small figures continue walking unhurried along the pavement towards "
 "the glazed entrance canopy. Tree canopies and the mown lawn move gently in a "
 "light breeze. Thin high cumulus drifts slowly across the blue sky. Sunlight "
 "stays constant, it is ten in the morning throughout the shot. "
 "The administrative block carries no lettering on its facade and none must be "
 "invented: leave the light panels blank. The headline text in the lower left of "
 "the frame stays perfectly still, sharp and unchanged, letter for letter, with "
 "no warping, no flicker, no re-spelling of a single Russian character. "
 "Physical correctness is the highest priority: shadows stay consistent with a "
 "fixed sun, objects never morph or change scale, straight lines stay straight, "
 "the perspective of the buildings is frozen. Absolutely forbidden: new vehicles "
 "or people appearing or vanishing, buildings changing shape, windows "
 "multiplying, any signage or logotype appearing on a wall, colour shifts, night "
 "falling, lens flares, floating particles, smoke, speed ramps, cuts. "
 "Colour and light stay exactly as in the source photograph: bright natural "
 "daylight, light grey and white architecture, green lawns, blue sky, amber "
 "accent only where it already is. 25 frames per second, natural motion blur, "
 "one continuous take, the last frame matching the first so the clip loops cleanly."
)

кадр = "/opt/oko-poster/klaster_svet/EV-01-svet-tur-bez-vyveski.png"
файл = "/opt/oko-poster/klaster_svet_video/EV-01-svet-tur.mp4"
if os.path.exists(файл):
    os.rename(файл, файл.replace(".mp4", "-заход1.mp4"))

print(f"промпт {len(ПРОМПТ)} знаков", flush=True)
среда = dict(os.environ, RW_METKA="кадр", RW_ZHDAT="900",
             CDP="http://127.0.0.1:9254", CHROME_CDP="http://127.0.0.1:9254")
т = time.time()
r = subprocess.run(["node", "/opt/oko-poster/runway_web.mjs", "gen4.5",
                    ПРОМПТ, файл, "8", "16:9", кадр],
                   capture_output=True, text=True, timeout=1800, env=среда,
                   cwd="/opt/oko-poster")
open("/tmp/rw_ev01_2.log", "w").write((r.stdout or "") + (r.stderr or ""))
есть = os.path.exists(файл)
print(f"EV-01 заход 2: {'готово' if есть else 'НЕ ВЫШЛО'} "
      f"{os.path.getsize(файл) if есть else 0} байт за {round(time.time()-т)} с", flush=True)
