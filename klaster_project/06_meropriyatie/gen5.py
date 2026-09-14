# -*- coding: utf-8 -*-
"""Пересъём пятого кадра: подпись под новый текст поста.

На первом кадре стояло «25 аргументов, которыми брокер закрывает клиента».
Доберман попросил не разворачивать пост: пять блоков и раскрытие на встрече.
Значит и на картинке должно быть пять блоков, иначе картинка обещает то,
чего в тексте нет.
"""
import os, subprocess, sys
sys.path.insert(0, "/opt/oko-poster")
from promts_svet import СВЕТ, БРЕНД, БЕЗ_ВЫДУМАННОГО, КИРИЛЛИЦА, КАЧЕСТВО

ПРОМПТ = (
 "A bright daylight photograph of a working negotiation moment inside a modern "
 "production hall: a broker in a light shirt stands half turned towards a client "
 "in a dark jacket, holding a tablet with a simple floor plan on the screen, and "
 "points with an open hand towards the depth of the hall. The client follows the "
 "gesture and looks convinced rather than polite. Both are ordinary business "
 "people in their forties, no models, natural faces partly turned away from the "
 "camera. Behind them the unit is white and airy: a clean high ceiling with white "
 "steel trusses, rows of daylight battens, a polished light grey floor with fresh "
 "amber traffic lines, a wide open sectional gate on the right pouring in morning "
 "sun, a clean forklift and neatly stacked new pallets far in the background. "
 + СВЕТ + БРЕНД +
 "Camera: 35mm at f/4, camera height 1.6 metres, the two figures on the left "
 "third in sharp focus, the depth of the hall softly falling off, verticals "
 "parallel. The frame must feel like a real photograph taken during a viewing, "
 "not a staged stock shot: slightly imperfect posture, a folder under the arm, a "
 "lanyard on the neck. Composition: the upper right quadrant is calm bright wall "
 "and open air, kept clear for the type. "
 "Typography in the upper right: a headline in Russian reading exactly "
 "«ИСКУССТВО ИЛИ НАВЫК?», and under it a small line reading exactly "
 "«Пять блоков аргументов для вашего клиента». Headline in deep graphite with a "
 "short amber rule above it, the small line in graphite at about one quarter of "
 "the headline size. Nothing else is written anywhere in the frame. "
 + БЕЗ_ВЫДУМАННОГО + КИРИЛЛИЦА + КАЧЕСТВО
)

куда = "/opt/oko-poster/klaster_svet/EV-05-svet-sdelki-v2.png"
print(f"промпт {len(ПРОМПТ)} знаков", flush=True)
среда = dict(os.environ, CDP="http://127.0.0.1:9334", ЖДАТЬ="900",
             PROJECT="oko-klaster-ev-05-v2", ПРОЕКТ="oko-klaster-ev-05-v2")
r = subprocess.run(["node", "/opt/oko-poster/chatgpt_web.mjs", ПРОМПТ, куда],
                   capture_output=True, text=True, timeout=1500, env=среда,
                   cwd="/opt/oko-poster")
open("/tmp/gpt_ev05v2.log", "w").write((r.stdout or "") + (r.stderr or ""))
есть = os.path.exists(куда)
print(("готово " if есть else "НЕ ВЫШЛО ") + (str(os.path.getsize(куда)) if есть else ""), flush=True)
print(((r.stdout or "") + (r.stderr or ""))[-200:], flush=True)
