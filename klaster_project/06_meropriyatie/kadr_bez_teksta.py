# -*- coding: utf-8 -*-
"""Кадр зала без надписи: под видео.

Правило владельца: для постов текст пишем внутри промпта, для видео текст
накладываем сами. Первый заход это подтвердил: Runway растворил заголовок
«СЕГОДНЯ В 11:00» к середине ролика. Значит оживляем чистый кадр, а надпись
кладём поверх готового ролика.
"""
import subprocess, os, sys
sys.path.insert(0, "/opt/oko-poster")
from promts_svet import СВЕТ, БРЕНД, БЕЗ_ВЫДУМАННОГО, КАЧЕСТВО

ПРОМПТ = (
 "A bright interior photograph of a new conference hall in a modern business "
 "park, shot from the back of the room towards the stage. Large floor to ceiling "
 "windows along the left wall flood the room with clean morning daylight and show "
 "green trees and light buildings outside. White ceiling with recessed "
 "luminaires and a slim projector, light acoustic wall panels, a large screen "
 "showing a neutral empty light slide, straight rows of comfortable dark grey "
 "chairs with about twenty people already seated in ordinary business clothes, "
 "two more people arriving down the central aisle towards a free row, a long "
 "table in the near foreground with water bottles and printed folders. The mood "
 "is the calm positive minute before a working meeting starts. "
 + СВЕТ + БРЕНД +
 "Camera: 28mm at f/5.6, camera height 1.7 metres, symmetrical composition along "
 "the central aisle, verticals strictly parallel, natural depth of field with the "
 "far screen slightly softer than the near chairs. Amber appears only as a thin "
 "accent line along the stage edge and on the floor guidance strip, nowhere else. "
 "This frame is prepared for video, so it must carry no typography at all: no "
 "headline, no caption, no watermark, no lettering of any kind anywhere in the "
 "image, and the lower right area over the chairs stays calm, clean and free of "
 "any graphic element so that text can be placed there later in editing. "
 + БЕЗ_ВЫДУМАННОГО + КАЧЕСТВО
)

куда = "/opt/oko-poster/klaster_svet/EV-04-zal-bez-teksta.png"
print(f"промпт {len(ПРОМПТ)} знаков", flush=True)
среда = dict(os.environ, CDP="http://127.0.0.1:9334",
             PROJECT="oko-klaster-ev-04-video", ПРОЕКТ="oko-klaster-ev-04-video")
r = subprocess.run(["node", "/opt/oko-poster/chatgpt_web.mjs", ПРОМПТ, куда],
                   capture_output=True, text=True, timeout=1500, env=среда,
                   cwd="/opt/oko-poster")
open("/tmp/gpt_ev04.log", "w").write((r.stdout or "") + (r.stderr or ""))
есть = os.path.exists(куда)
print(f"{'готово' if есть else 'НЕ ВЫШЛО'} {os.path.getsize(куда) if есть else 0} байт", flush=True)
print(((r.stdout or "") + (r.stderr or ""))[-300:], flush=True)
