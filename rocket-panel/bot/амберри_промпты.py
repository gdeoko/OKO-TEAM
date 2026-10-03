# -*- coding: utf-8 -*-
"""Промпты всех кнопок под `z-image-spicy-pro`. Один файл на весь бот.

## Почему отдельный файл, а не правка старых блоков

Прежние промпты собирались из двух десятков блоков под FLUX с картой
глубины: там кадр держала карта, а текст лишь дополнял её. У z-image
карты нет вовсе, он не принимает ни референса, ни маски, и всё держит
ОДИН текст. Значит текст обязан нести то, что раньше несла карта: кто
где лежит, куда смотрит камера, сколько в кадре тел и конечностей.

## Что внутри каждого промпта и почему именно это

    счёт        «ровно двое, две головы, четыре руки» - ЧИСЛОМ, а не
                запретом в негативе. Отрицание движок читает слабо,
                число жёстко. Лишний третий человек уходит отсюда
    сцена       кто где и что делает, с местом В КАДРЕ («слева»,
                «в середине»), а не относительно партнёра
    раздельно   между телами просвет и тень, каждая рука из своего
                плеча. Тела срастаются там, где перекрываются
    рама        лицо в раме из бёдер, нос касается, подбородок поднят.
                Слово «между ног» слабое: голова уезжает в сторону
    камера      сторона, высота, наклон. Ракурс сбоку там, где касание
                лежит на силуэте, иначе его не видно
    влажность   обязательна везде, где рука между ног: органы блестят,
                влага настоящая, нити света на коже
    качество    объектив, поры, резкость

## Правила, купленные браком

1. **Ракурс выбирается по тому, куда смотрит точка касания.** Касание
   на силуэте - камера сбоку. Касание смотрит назад - камера сзади и
   выше. Фронт ломает всё: тела перекрываются и срастаются.
2. **Симметричную сцену движок зеркалит.** Валетом (обе головы в паху
   друг у друга) из двух тел вышло четыре, оба зерна, оба расклада.
   Поэтому у каждой своя роль, и позы несимметричные.
3. **Ориентация кадра по тому, как лежат люди.** Вертикальный кадр под
   горизонтальную сцену движок заполняет ТРЕТЬИМ человеком.
4. **Внешность каждого пишется рядом с её телом**, а не общим списком
   в начале: общий список раскладывается на обоих, и выходят два
   одинаковых лица.
5. **Текст держит фигуру, волосы и тон кожи.** Референса у движка нет,
   и всё это приходит из описания, которое снял описатель с фото
   клиентки. Подстановки `{ОНА}`, `{ОН}`, `{ВТОРАЯ}` - его место.

Снято с кнопок 03.10.2026 словом владельца: `ff_face` («отлизывает
сзади лёжа») и `ff_behind` («вдвоём раком») - обе позы он вернул, и обе
сняты целиком, а не переписаны. Вместо них одна новая, `ff_69`.
"""

# ---------- общие куски ----------

СЧЁТ_ОДНА = ("Exactly one naked woman alone in the picture and nobody "
             "else: one head, two arms, two hands, two legs, two feet. ")
СЧЁТ_ДВОЕ = ("Exactly two people in the picture and nobody else: two "
             "heads, four arms, four hands, four legs, four feet. ")
РАЗДЕЛЬНО = ("Their two bodies are clearly separate in the frame with "
             "visible space and shadow between them, every arm grows "
             "from its own shoulder and every leg from its own hip. ")
КАЧЕСТВО = ("Explicit photograph, photorealistic, razor sharp focus, "
            "visible skin pores and fine skin texture, natural skin "
            "with real tone variation, genitals in sharp anatomical "
            "detail, soft warm bedside light with gentle falloff, shot "
            "on a full frame camera with an 85mm lens at f2.8, high "
            "dynamic range, no retouching.")
ГОЛАЯ = ("She is completely nude, bare skin everywhere, no clothing "
         "anywhere in the picture. ")
ГОЛЫЕ = ("Both are completely nude, bare skin everywhere, no clothing "
         "anywhere in the picture. ")

# ВЛАЖНОСТЬ. Слово владельца: везде, где рука между ног, органы влажные.
# Пишется тремя приметами сразу, иначе движок рисует сухую кожу: сам
# блеск, нити света и влага на пальцах.
ВЛАЖНОСТЬ = ("Her vulva is visibly wet and glistening with her own "
             "clear natural arousal fluid, the inner lips shine with "
             "moisture, thin wet highlights catch the light along them, "
             "her fingertips are slick and wet where they touch her, "
             "and the wetness looks like real body fluid, not oil and "
             "not water. ")
# ТЕЧКА. Там, где она давно возбуждена и поза это показывает.
#
# ПЕРЕПИСАНО ПОСЛЕ ПЕРВОГО ПРОГОНА. Прежняя строка просила «мокрое
# пятно на простыне под бёдрами» и «след по внутренней стороне бедра»,
# и движок нарисовал жёлтую лужу с подтёком: кадр читался не как
# возбуждение, а как лужа мочи. Теперь называем ровно то, что должно
# быть видно: тонкий ПРОЗРАЧНЫЙ блеск на коже у входа, без пятен на
# ткани и без цвета вовсе.
# ОТРИЦАНИЕ ВНУТРИ ПОЛОЖИТЕЛЬНОГО ТЕКСТА НЕ РАБОТАЕТ. Второй заход
# просил «никаких пятен и луж» прямо здесь - лужа всё равно
# нарисовалась. Движок читает существительные, а не «нет». Поэтому
# здесь осталось ТОЛЬКО то, что должно быть видно, а пятна, лужи и
# жёлтый цвет живут в негативе, где отрицание и работает.
ТЕЧКА = ("She has clearly been aroused for a while: a thin colourless "
         "glistening film of her own natural wetness on the skin right "
         "around her vulva and at the very top of her inner thighs, "
         "barely there, catching the light. The sheet under her is "
         "clean and dry. ")


def РАМА(чья):
    """Голову держит рама из бёдер, а не слово «между ног».

    На ракурсе сзади голова уезжала вбок, потому что «between her
    thighs» движок читает как направление, а не как место. Бедро с
    каждой стороны щеки - это геометрия, и её он исполняет.
    """
    return ("Her face is framed by %s thighs, one thigh on each side of "
            "her cheeks, her nose touching the skin, her chin tilted "
            "up, her lips and her tongue pressed onto the vulva, and "
            "nothing at all between her mouth and the vulva. " % чья)


НЕГАТИВ = (
    "third person, three people, four people, extra person in the "
    "background, mirrored composition, symmetrical duplicate, extra "
    "arm, third arm, extra leg, extra hand, extra foot, six fingers, "
    "fused fingers, missing hand, missing arm, duplicated body, two "
    "torsos, two pairs of breasts, man with breasts, conjoined bodies, "
    "fused bodies, merged torsos, overlapping bodies, same face twice, "
    "floating limb, detached limb, head turned away from the groin, "
    "face away from the groin, deformed anatomy, broken spine, "
    "clothing, underwear, bra, panties, lingerie, stockings, jewellery, "
    "yellow stain, yellow liquid, urine, puddle, puddle on the "
    "sheet, wet patch on fabric, stained sheet, spilled liquid, "
    "censored, blurred genitals, smooth featureless crotch, plastic "
    "skin, airbrushed skin, doll face, blurry, low detail, watermark, "
    "text, logo, 3d render, cgi, cartoon, painting")
НЕГАТИВ_ОДНА = НЕГАТИВ + ", second person, two people, couple, partner"

# КАДРИРОВКА. Отдельным блоком, потому что камера её не держит.
#
# На первом прогоне `mf_near` кадр вышел чистым, но голова мужчины
# оказалась ЗА верхним краем: распознаватель нашёл одно лицо из двух, и
# лицо Марка ставить было некуда (сходство 0.15 против 0.92 у неё).
# Движок кадрирует по главному телу, и о втором человеке надо сказать
# отдельно и числом: сколько места над самой высокой головой.
# ТРЕБУЕМ ГОЛОВЫ, А НЕ ВСЕ ЧЕТЫРЕ СТУПНИ. Первая редакция просила и
# ступни тоже, и на позах, где тело второго человека НАРОЧНО уходит за
# край (буква Т, крест), движок складывал обоих в кадр целиком и
# ломал геометрию: на `ff_69` лежащая оказалась головой у груди, а не
# в паху, на `mf_behind` тела срослись. Головы требовать надо, ступни
# нет.
КАДР_ДВОЕ = ("FRAMING: both heads and both faces are fully inside the "
             "frame and clearly visible, with a clear margin of empty "
             "space above the higher head; no head and no face is cut "
             "off by any edge of the picture. ")
# КАДРИРОВКА У КАЖДОЙ ПАРНОЙ КНОПКИ СВОЯ, И ЭТО НЕ ПРИДИРКА.
#
# Общее требование «оба целиком в кадре» ломает ровно те позы, где тело
# второго человека НАРОЧНО уходит за край: на `ff_69` движок поднимал
# лежащую, чтобы показать её целиком, и её голова оказывалась у груди
# вместо паха; на `mf_behind` он сводил двоих в кадр и тела срастались.
# А без этого требования на `mf_near` у мужчины срезало голову.
# Значит кадрировка называется отдельно под каждую геометрию.
КАДР_ШИРЕ = ("FRAMING: the shot is wide enough that the kneeling man's "
             "whole head is well inside the top of the picture with "
             "empty wall above it, and her head is inside the left part "
             "of the picture; neither head touches any edge. ")
КАДР_Т = ("FRAMING: her whole body and her face are inside the frame "
          "with space above her head. His head is at the centre of the "
          "picture between her open thighs and his face is clearly "
          "visible in profile; his body continues to the right and "
          "leaves the picture at the right edge, and that is correct. ")
КАДР_Т_Ж = ("FRAMING: the first woman's whole body and her face are "
            "inside the frame with space above her head. The second "
            "woman's head is at the centre of the picture between the "
            "first woman's open thighs and her face is clearly visible; "
            "her body continues to the right and leaves the picture at "
            "the right edge, and that is correct. ")
КАДР_КРЕСТ = ("FRAMING: the woman on all fours is fully inside the "
              "frame with space above her head. The lying woman's head "
              "and shoulders are in the lower middle of the picture, "
              "directly under the other one's lifted hips, and the rest "
              "of her body continues away from the camera and leaves "
              "the picture at the lower edge, and that is correct. ")
КАДР_ОДНА = ("FRAMING: she is completely inside the frame, her whole "
             "head and face visible with a clear margin of empty space "
             "above her hair, and her feet inside the lower edge; "
             "nothing is cut off by any edge of the picture. ")


# ---------- камеры ----------

СБОКУ_Г = ("CAMERA: horizontal frame, camera two metres to the side of "
           "the bed at mattress height, level, both of them seen in "
           "profile from the side. ")
СБОКУ_В = ("CAMERA: vertical frame, camera two metres to the side, "
           "level, both of them seen in profile from the side. ")


# ---------- одиннадцать соло-кнопок ----------
#
# Лист у каждой тот, каким владелец принял кадр: вертикаль у всех,
# кроме «сбоку». Горизонт под вертикальную сцену движок заполняет
# вторым телом, вертикаль под горизонтальную режет ноги.

СОЛО = {

 # «Крупный план»: лёжа, ноги врозь, кадр от бёдер.
 "un_close": ("vert",
   "She lies on her back on a wide bed with her head on a pillow at the "
   "top of the picture, her knees bent and wide apart, her thighs open "
   "towards the camera, her hips tilted slightly up, her hands resting "
   "on her own thighs. She is {ОНА}. Her vulva is at the centre of the "
   "picture in sharp anatomical detail, the inner and outer lips "
   "clearly separated and naturally shaped, and above it her belly, her "
   "breasts and her face are all inside the frame, her chin lifted, "
   "looking straight into the lens. " + ТЕЧКА +
   "CAMERA: vertical frame, camera one metre above the foot of the bed "
   "at the height of her knees, tilted down along her body, her whole "
   "body from her feet to the top of her head inside the frame. "),

 # «В полный рост»: стоя лицом к камере.
 "un_full": ("vert",
   "She stands upright in the middle of the room facing the camera, her "
   "weight on one leg, the other knee slightly bent, her shoulders "
   "back, one hand loose at her side and the other in her hair, her "
   "chin level, looking straight into the lens. She is {ОНА}. Her whole "
   "body is inside the frame from the top of her head to her bare feet "
   "on the floor, her breasts, her waist, her hips and her vulva all "
   "clearly visible and sharp, her legs long and straight. "
   "CAMERA: vertical frame, camera three metres in front of her at the "
   "height of her navel, level, full length portrait. "),

 # «Со спины»: наклонилась вперёд, смотрит через плечо.
 "un_back": ("vert",
   "She stands with her back to the camera and bends forward from the "
   "waist, her hands on the edge of a low table in front of her, her "
   "back arched, her hips pushed back towards the camera, her head "
   "turned back over her shoulder so that her face is clearly visible "
   "in the frame. She is {ОНА}. Her buttocks fill the middle of the "
   "picture, her vulva is visible between her thighs from behind in "
   "sharp detail, her spine and shoulder blades read clearly along her "
   "back, her long hair falls over one shoulder. " + ТЕЧКА +
   "CAMERA: vertical frame, camera two metres behind her at the height "
   "of her hips, level, her whole body inside the frame. "),

 # «В три четверти»: на четвереньках вполоборота, лицо в камеру.
 "un_three": ("vert",
   "She is on all fours on the bed, her body turned three quarters "
   "towards the camera, her back arched, her hips lifted, her weight on "
   "her hands and knees, her head turned to the lens with her chin "
   "lifted. She is {ОНА}. Her hanging breasts, her waist, her raised "
   "buttocks and her vulva between her thighs are all inside the frame "
   "and sharp, her hair falls forward past her shoulder. " + ТЕЧКА +
   "CAMERA: vertical frame, camera two metres away at the height of the "
   "mattress, level, her whole body from her hands to her feet inside "
   "the frame. "),

 # «Сидя»: колени врозь, лицом к камере.
 "un_sit": ("vert",
   "She sits on the edge of the bed facing the camera, leaning back on "
   "her hands behind her, her knees wide apart and her thighs open "
   "towards the lens, her back straight, her chest forward, her chin "
   "up, looking into the lens. She is {ОНА}. Her vulva is open and at "
   "the centre of the picture in sharp anatomical detail, her breasts "
   "and her face clearly visible above it, her feet flat on the floor. "
   + ТЕЧКА +
   "CAMERA: vertical frame, camera two metres in front of her at the "
   "height of her navel, level, her whole body from her head to her "
   "feet inside the frame. "),

 # «Лёжа»: на спине, камера на уровне бёдер.
 "un_lie": ("vert",
   "She lies on her back along the bed with her head on a pillow, one "
   "knee drawn up and fallen open to the side and the other leg "
   "stretched out, one arm above her head on the pillow and the other "
   "hand resting on her own belly, her head turned to the lens. She is "
   "{ОНА}. Her breasts fall naturally to the sides of her chest, her "
   "ribs and her belly catch the light, her open vulva is clearly "
   "visible between her thighs in sharp detail. " + ТЕЧКА +
   "CAMERA: vertical frame, camera one and a half metres to the side of "
   "the bed at the height of her hips, tilted slightly down, her whole "
   "body inside the frame. "),

 # «На коленях»: сидит на пятках, лицом к камере.
 "un_kneel": ("vert",
   "She kneels upright on the bed sitting back on her heels, her knees "
   "apart, her spine long, her shoulders open and back, her hands "
   "resting palm down on her own thighs, her chin level and her eyes on "
   "the lens. She is {ОНА}. Her breasts, her belly, her thighs and her "
   "vulva between them are all clearly visible and sharp. "
   "CAMERA: vertical frame, camera two metres in front of her at the "
   "height of her chest, level, her whole body inside the frame. "),

 # «Снизу вверх»: стоит, камера от колена.
 "un_low": ("vert",
   "She stands upright above the camera with her feet apart and her "
   "weight even, one hand in her hair and the other at her hip, her "
   "chin level, looking down into the lens. She is {ОНА}. Seen from "
   "this low point her thighs, her vulva, her belly and the undersides "
   "of her breasts are all in the frame and sharp, her body long and "
   "undistorted. " + ТЕЧКА +
   "CAMERA: vertical frame, camera just above knee height one and a "
   "half metres in front of her, tilted up, 35mm lens so the body is "
   "not stretched. "),

 # «Сверху вниз»: камера над ней под шестьдесят градусов.
 "un_over": ("vert",
   "She lies on her back on the bed seen from above, her face turned up "
   "to the lens, one shoulder forward, one knee drawn up and fallen "
   "open, one arm above her head, the other hand on her own belly. She "
   "is {ОНА}. Her breasts, her belly, her hips and her open vulva are "
   "all clearly visible from this high angle and sharp. " + ТЕЧКА +
   "CAMERA: vertical frame, camera two metres above her at about sixty "
   "degrees, held steady, her whole body inside the frame. "),

 # «Опираясь»: стоя, спиной к стене.
 "un_lean": ("vert",
   "She stands leaning back against the wall, her shoulder blades and "
   "her buttocks touching it, one foot flat against the wall behind her "
   "so that knee comes forward and her thighs part, her chin dropped a "
   "little and her eyes up to the lens, one hand flat on the wall "
   "beside her hip. She is {ОНА}. Her breasts, her belly and her vulva "
   "between her parted thighs are clearly visible and sharp. "
   "CAMERA: vertical frame, camera two metres in front of her at the "
   "height of her chest, level, her whole body inside the frame. "),

 # «От первого лица»: камера на месте зрителя, её руки на нём нет.
 "ph_pov": ("vert",
   "The picture is what the viewer sees looking down his own body at "
   "her: she kneels on the floor between his knees in the lower middle "
   "of the frame, her face lifted to the lens, her mouth open and her "
   "tongue out at the tip of his erect penis which enters the frame "
   "from the bottom edge, one of her hands around the base of it and "
   "the other on his thigh. She is {ОНА}. Her bare breasts and "
   "shoulders are in the frame below her face. Only her face and body "
   "belong to a person in this picture; of the viewer only the thighs "
   "and the penis are visible at the bottom edge, no second face. "
   "CAMERA: vertical frame, point of view from the viewer's eyes at "
   "head height, 28mm wide, looking down. "),

 # «Общий план»: весь кадр с обстановкой.
 "ph_pull": ("vert",
   "She stands in the middle of the bedroom seen in full, the bed, the "
   "window and the floor around her all in the frame, her weight on one "
   "leg, one hand in her hair, her body turned three quarters to the "
   "lens, her face to the camera. She is {ОНА}. Her whole naked body "
   "from her hair to her bare feet is in the frame and sharp, her "
   "breasts and her vulva clearly visible. "
   "CAMERA: vertical frame, 28mm lens, camera four metres away at the "
   "height of her hips, level, the whole room around her in the shot. "),

 # «В зеркале»: отражение и спина одновременно.
 "ph_mirror": ("vert",
   "She stands naked in front of a tall mirror that fills most of the "
   "picture, her back to the camera and her reflection facing it, so "
   "her bare back and buttocks are seen directly and her face, her "
   "breasts and her belly are seen in the glass. She is {ОНА}. The "
   "reflection is true: the same body in the same pose, correctly "
   "reversed, lit from the same side; the same woman twice and not two "
   "different women. One hand rests on the surface of the mirror. "
   "CAMERA: vertical frame, 50mm lens two metres behind her and "
   "slightly off to one side so the camera itself never appears in the "
   "glass, level with her shoulder blades. "),

 # «Вблизи и мягко»: тесный кадр, мягкий свет.
 "ph_slow": ("vert",
   "A tight close frame of her body from her collarbones down to the "
   "tops of her thighs as she lies back, her breasts and her belly "
   "filling most of the picture, one of her hands sliding slowly down "
   "across her own belly towards her groin, the edge of her vulva at "
   "the bottom of the frame, her chin and parted lips just inside the "
   "top of the frame. She is {ОНА}. Fine skin texture, small hairs, "
   "soft shadow under the curve of each breast. " + ВЛАЖНОСТЬ +
   "CAMERA: vertical frame, 85mm lens at f1.8 very close, lens at the "
   "height of her ribs, level, one large soft light close by so no "
   "shadow has a hard edge. "),

 # «Мастурбация крупно»: сидя лицом к камере, рука между ног.
 "ph_close": ("vert",
   "She sits propped against the headboard facing the camera, her knees "
   "bent and wide apart, her thighs open towards the lens, her head "
   "tipped back against the wood and her lips parted, her free hand "
   "squeezing her own breast. She is {ОНА}. Her other hand is between "
   "her open thighs, two fingers parting her labia and rubbing her "
   "clitoris, the whole hand and the vulva in sharp close detail at the "
   "centre of the picture. " + ВЛАЖНОСТЬ + ТЕЧКА +
   "CAMERA: vertical frame, camera one metre in front of her at the "
   "height of her hips, tilted slightly up so her face stays in the "
   "frame above her body. "),

 # «Мастурбация сбоку»: лёжа на боку вдоль кадра.
 "ph_side": ("horiz",
   "She lies on her side along the whole width of the picture, her head "
   "on a pillow on the left and her feet to the right, her upper knee "
   "drawn up towards her chest so that her groin is fully open towards "
   "the camera, her lower arm under her head, her eyes half closed and "
   "her mouth open. She is {ОНА}. Her upper hand is between her thighs, "
   "her fingers working on her clitoris, her wrist bent, the vulva and "
   "the hand both clearly visible in profile at the centre of the "
   "picture. " + ВЛАЖНОСТЬ +
   "CAMERA: horizontal frame, camera two metres to the side of the bed "
   "at mattress height, level, her whole body seen from the side. "),

 # «Мастурбация раком»: на четвереньках, рука сзади между ног.
 "ph_above": ("vert",
   "She kneels on the bed with her knees wide apart under her hips and "
   "her thighs vertical, so that her buttocks are raised high above the "
   "mattress, and she lowers her chest and one cheek down onto the "
   "sheet in front of her, her back deeply arched downwards, her "
   "shoulders low and her hips the highest point of her body, her face "
   "turned to the lens. She is {ОНА}. "
   "One arm reaches back between her own legs from behind, her fingers "
   "on her vulva, and the hand, the fingers and the vulva are all in "
   "sharp detail at the centre of the picture, her buttocks raised "
   "above them. " + ВЛАЖНОСТЬ + ТЕЧКА +
   "CAMERA: vertical frame, camera one and a half metres behind her and "
   "slightly above the level of her hips, tilted down, her whole body "
   "from her head to her feet inside the frame. "),

 # «Снимает лифчик»: стоя, тянет верх через голову.
 "ph_below": ("vert",
   "She stands facing the camera and pulls her top up over her head "
   "with both arms, the fabric already bunched above her chest and "
   "covering her raised arms, her bare breasts just uncovered and her "
   "chin lifted behind the cloth, her belly stretched and her hips "
   "turned a little to one side. She is {ОНА}. Her breasts are bare and "
   "her own nipples are in plain sight, her waist and her bare hips "
   "below are in the frame, nothing covers her body below the chest. "
   "CAMERA: vertical frame, camera two metres in front of her at the "
   "height of her chest, level, her body from her raised hands to her "
   "knees inside the frame. "),

 # «Стягивает трусики»: со спины, наклонилась.
 "ph_push": ("vert",
   "She stands with her back to the camera and bends forward from the "
   "waist, both hands hooked in the waistband of her panties and "
   "pushing them down her thighs, the panties already halfway down and "
   "stretched between her legs, her head turned back over her shoulder "
   "to the lens. She is {ОНА}. Her bare buttocks are uncovered and fill "
   "the middle of the picture, her vulva is visible between her thighs "
   "from behind in sharp detail, her back is bare from her shoulders "
   "down and nothing else is on her body. "
   "CAMERA: vertical frame, camera two metres behind her at the height "
   "of her hips, level, her whole body inside the frame. "),
}


# ---------- восемь парных кнопок ----------
#
# Было девять. `ff_face` и `ff_behind` сняты владельцем 03.10.2026
# вместе с позами: их не переписывают, их больше нет. Вместо них
# `ff_69`, собранная заново и принятая им же.
#
# `{ОНА}` - клиентка, `{ОН}` - наш партнёр Марк, `{ВТОРАЯ}` - наша
# партнёрша Юлия. Внешность стоит ВНУТРИ фразы про своего человека: в
# общем списке она растекается на обоих и выходят два одинаковых лица.

ПАРНЫЕ = {

 # «Секс раком». Касание лежит на силуэте, камера сбоку его видит.
 "mf_near": ("horiz",
   "The woman is on all fours across the picture, her body stretched "
   "from left to right, her head and shoulders low on the left, her "
   "back deeply arched, her hips lifted on the right, her hanging "
   "breasts swaying under her. She is {ОНА}. The man kneels upright "
   "behind her on the right, his thighs against the backs of hers, both "
   "hands holding her hips, his erect penis inside her from behind and "
   "the place where they are joined clearly visible between their "
   "bodies. He is {ОН}. Both of their faces are inside the frame and "
   "turned enough to be seen. " + СБОКУ_Г, КАДР_ШИРЕ),

 # «Наездница». Переписана 03.10.2026: вертикальный кадр давал третьего
 # человека, а вход закрывало её же бедро. Горизонт плюс поднятое
 # ближнее бедро выводят место соединения на силуэт.
 "mf_face": ("horiz",
   "The man lies flat on his back along the whole width of the picture, "
   "his head on a pillow on the left and his feet at the right edge, "
   "his whole body seen in profile. He is {ОН}. The woman sits astride "
   "his hips in the middle of the picture, upright, her back straight, "
   "her breasts and her face seen in profile, her near thigh lifted off "
   "the mattress and her knee raised so that the gap under her hip is "
   "open and his erect penis entering her vulva is clearly visible "
   "through that gap. She is {ОНА}. Her body stands vertically and his "
   "lies horizontally, the two of them make a cross shape. "
   "CAMERA: horizontal frame, camera one metre to the side of the bed "
   "and slightly below the mattress line, tilted a little up, both of "
   "them in profile. ", КАДР_ДВОЕ),

 # «Кунилингус МЖ». Тела буквой Т: касание смотрит вбок и видно сбоку.
 "mf_behind": ("horiz",
   "The woman lies on her back across the picture, her head on a pillow "
   "on the left, her shoulders propped on the pillow, her knees bent "
   "and her thighs open towards the right, her belly and breasts in "
   "profile. She is {ОНА}. The man lies on his stomach at a right angle "
   "to her with his head between her open thighs on the right, his "
   "hands holding her thighs, his body stretching away to the right "
   "edge. He is {ОН}. " + РАМА("her") +
   "Their bodies form a T shape. " + СБОКУ_Г, КАДР_Т),

 # «Минет». Он стоит, она на коленях, касание на силуэте.
 "mf_pov": ("vert",
   "The man stands upright on the right side of the picture, his whole "
   "body visible in profile from his head to his feet, one hand resting "
   "in her hair. He is {ОН}. The woman kneels on the floor in front of "
   "him on the left, upright on her knees, her back straight, her face "
   "in profile at the height of his hips, her lips closed around his "
   "erect penis, one hand at the base of it and the other on his thigh, "
   "her eyes raised to him. She is {ОНА}. " + СБОКУ_В, КАДР_ДВОЕ),

 # «Кунилингус ЖЖ». Та же буква Т, роли разные.
 "ff_near": ("horiz",
   "The first woman lies on her back across the picture, her head on a "
   "pillow on the left, her knees bent and her thighs open towards the "
   "right, one hand in the other woman's hair. She is {ОНА}. The second "
   "woman lies on her stomach at a right angle to her, her head between "
   "the first woman's open thighs on the right, her body stretching "
   "away to the right edge. She is {ВТОРАЯ}. "
   + РАМА("the first woman's") + "Their bodies form a T shape. "
   + СБОКУ_Г, КАДР_Т_Ж),

 # «Отлизывает раком стоя». Касание смотрит назад, но лежит на краю
 # силуэта: камера сбоку берёт и его, и оба лица.
 "ff_close": ("vert",
   "The first woman stands bent forward at the waist on the left, her "
   "hands on the bed, her back horizontal, her hips pushed back, her "
   "head turned back over her shoulder. She is {ОНА}. The second woman "
   "kneels on the floor behind her on the right, upright on her knees, "
   "her hands holding the first woman's buttocks open, her face pressed "
   "in between them from behind, her tongue on the vulva from behind. "
   "She is {ВТОРАЯ}. Her nose touches the skin, her chin is lifted, and "
   "nothing is between her mouth and the vulva. " + СБОКУ_В, КАДР_ДВОЕ),

 # «Кунилингус лёжа». Одна полусидит на подушках, вторая вытянута.
 "ff_pov": ("horiz",
   "The first woman half sits against a pile of pillows on the left of "
   "the picture, leaning back on her elbows, her knees bent and her "
   "thighs open towards the right, her chin down and her eyes on the "
   "other woman. She is {ОНА}. The second woman lies on her stomach "
   "along the bed on the right, her body stretching to the right edge, "
   "her head between the first woman's open thighs. She is {ВТОРАЯ}. "
   + РАМА("the first woman's") + СБОКУ_Г, КАДР_Т_Ж),


 # «Сверху» МЖ: камера прямо над кроватью.
 #
 # ТЕЛО НА ТЕЛЕ СВЕРХУ НЕ ВЫХОДИТ. Два захода подряд дали двоих ЛЕЖАЩИХ
 # РЯДОМ, а не одного на другом: с высокой точки движок разводит тела
 # по сторонам, потому что иначе ему нечем показать второго. Значит
 # берём ту геометрию, которая сверху читается сама: она лежит, он
 # стоит на коленях между её ног, тела буквой Т и не перекрываются.
 "mf_above": ("horiz",
   "Seen from straight above the bed: the woman lies on her back with "
   "her head on the pillow at the LEFT of the picture, her arms up "
   "beside her head, her knees bent and her thighs wide open towards "
   "the right, her face turned up to the lens. She is {ОНА}. The man "
   "kneels upright between her open thighs on the RIGHT of the "
   "picture, sitting back on his heels, both hands holding her hips "
   "and lifting them to him, his erect penis inside her, his head "
   "tipped back and his face turned up to the lens. He is {ОН}. Their "
   "bodies make a T shape and do not lie on top of each other. The "
   "place where they are joined is at the centre of the picture. "
   "CAMERA: horizontal frame, camera two metres directly above the bed "
   "looking straight down, level. ", КАДР_ДВОЕ),

 # «Крупный план» МЖ: два лица во весь кадр.
 "mf_close": ("horiz",
   "Her face and his face fill the whole picture, cheek to cheek and "
   "tilted opposite ways, their lips parted and almost touching, her "
   "eyes on the lens and his eyes closed, his hand flat against her "
   "cheek and jaw, her bare shoulder and the top of her bare breast in "
   "the lower part of the frame. She is {ОНА}. He is {ОН}. Two clearly "
   "different faces, different features, different skin tone, no "
   "blending of one face into the other. "
   "CAMERA: horizontal frame, 85mm lens very close, at their eye "
   "level, focus on her nearer eye, his face still sharp. ", ""),

 # «Сверху» ЖЖ: одна лежит, вторая между её ног, камера сверху.
 "ff_above": ("horiz",
   "The first woman lies flat on her back along the picture with her "
   "head to the left, her knees bent and her thighs wide open, her "
   "hands on her own breasts, her face turned up towards the lens. She "
   "is {ОНА}. The second woman lies on her stomach between the first "
   "one's open thighs, her head down at her groin, her back and "
   "buttocks towards the lens, her face in profile against the first "
   "woman's vulva, her tongue on it, her hands under the first woman's "
   "thighs. She is {ВТОРАЯ}. "
   "CAMERA: horizontal frame, camera two metres directly above the bed "
   "looking straight down at them. ", КАДР_ДВОЕ),

 # «Куни 69». НОВАЯ, принята владельцем 03.10.2026 взамен двух снятых.
 # Валетом движок зеркалит и лепит четыре тела, поэтому роли разные:
 # одна сверху раком, вторая лежит под ней головой в паху.
 "ff_69": ("horiz",
   "The first woman is on all fours across the picture, her body "
   "stretched from left to right, her back arched, her hips lifted high "
   "in the middle of the picture. She is {ОНА}. The second woman lies "
   "flat on her back underneath her at a right angle, her body "
   "stretching away from the camera, only her shoulders and her head in "
   "the picture, her head directly under the first woman's lifted hips, "
   "her face turned up into her groin. She is {ВТОРАЯ}. "
   + РАМА("the first woman's") +
   "Their bodies make a cross shape. "
   "CAMERA: horizontal frame, camera two metres to the side of the bed "
   "at mattress height, level, the first woman seen in profile from the "
   "side. ", ""),
}

# Кнопки, которых больше нет. Список нужен коду, который чистит меню и
# старые кнопки из переписки: нажатие на снятую кнопку обязано дать
# понятный ответ, а не осечку.
СНЯТЫ = {
    "ff_face": "поза снята владельцем 03.10.2026, вместо неё «Куни 69»",
    "ff_behind": "поза снята владельцем 03.10.2026, вместо неё «Куни 69»",
}

НАЗВАНИЯ = {
    "ff_69": "Куни 69",
}


def промпт(ключ, она="", он="", вторая=""):
    """Полный текст модели по ключу кнопки.

    `она`, `он`, `вторая` - описания внешности от описателя. Пустые
    заменяются общим описанием: кадр выйдет, но человек в нём будет
    чужой, и это честнее осечки.
    """
    ключ = str(ключ or "")
    for приставка in ("pr_", "pf_", "ac_", "vi_", "un_", "ph_"):
        if ключ.startswith(приставка) and ключ[len(приставка):] in ПАРНЫЕ:
            ключ = ключ[len(приставка):]
            break
    if ключ.startswith(("pr_", "pf_")):
        ключ = ключ[3:]
    if ключ.startswith("ac_"):
        ключ = "ph_" + ключ[3:]
    она = она or ("mid-20s, oval face, long dark-brown wavy hair, fair "
                  "warm skin, slim build, medium round breasts")
    он = он or ("mid-20s, square jaw, short dark-brown hair, light "
                "stubble, fair skin, lean athletic build")
    вторая = вторая or ("mid-20s, heart-shaped face, long light-blonde "
                        "straight hair, fair skin, slim build, small "
                        "round breasts")
    if ключ in СОЛО:
        лист, сцена = СОЛО[ключ]
        текст = ("Explicit photograph of one naked woman. " + СЧЁТ_ОДНА
                 + сцена.format(ОНА=она) + КАДР_ОДНА + ГОЛАЯ + КАЧЕСТВО)
        return {"ключ": ключ, "лист": лист, "промпт": текст,
                "негатив": НЕГАТИВ_ОДНА, "пара": False}
    if ключ in ПАРНЫЕ:
        лист, сцена, кадрировка = ПАРНЫЕ[ключ]
        текст = ("Explicit photograph of exactly two naked people. "
                 + СЧЁТ_ДВОЕ + сцена.format(ОНА=она, ОН=он, ВТОРАЯ=вторая)
                 + РАЗДЕЛЬНО + кадрировка + ГОЛЫЕ + КАЧЕСТВО)
        return {"ключ": ключ, "лист": лист, "промпт": текст,
                "негатив": НЕГАТИВ, "пара": True}
    if ключ in СНЯТЫ:
        raise KeyError("кнопка %s снята: %s" % (ключ, СНЯТЫ[ключ]))
    raise KeyError("нет промпта для кнопки %s" % ключ)


РАЗМЕРЫ = {"horiz": "1920x1280", "vert": "1280x1920"}


def размер(лист):
    return РАЗМЕРЫ.get(лист, РАЗМЕРЫ["vert"])


# ---------- ролик ----------
#
# `minimax-h3-lite`, 768p, фото первым И последним кадром. Правила
# владельца 03.10.2026, и каждое закрывает то, что он вернул:
#
# 1. КАМЕРА СТОИТ. Ни наездов, ни облётов, ни панорам. Движется только
#    то, что в кадре. Движок любит «оживить» сцену проездом, и тогда
#    кадрирование уезжает, а вместе с ним лицо и поза, которые мы
#    только что поставили.
# 2. ЗВУК ПО СМЫСЛУ СЦЕНЫ. Дыхание, стоны, шлепки, влажные звуки,
#    скрип кровати. Музыки нет вовсе: она выдаёт ролик как рекламу и
#    перебивает то, ради чего его смотрят.
# 3. НИЧЕГО ЛИШНЕГО В КАДРЕ. Ни надписей, ни рук оператора, ни третьих
#    людей, ни смены комнаты. Кадр тот же, что на фотографии.
# 4. ЛИЦО ВИДНО ЦЕЛИКОМ. Голова не уходит за край и не отворачивается:
#    ролик продаёт узнавание, а не анонимное тело.

ВИДЕО_КАМЕРА = (
    "CAMERA: the camera does not move at all. It is locked off on a "
    "tripod: no zoom, no push in, no pull out, no dolly, no pan, no "
    "tilt, no handheld shake, no orbit, no focus pull, no crop change. "
    "The framing stays exactly as it is in the supplied photograph from "
    "the first frame to the last. Only the people inside the frame "
    "move. ")
ВИДЕО_ДЕРЖАТЬ = (
    "Everything that is already in the photograph stays as it is: the "
    "same two faces, the same hair, the same skin, the same bodies, the "
    "same bed and the same room and the same light. Nobody gets "
    "dressed, no clothing appears, no new person enters the frame, no "
    "object appears or disappears. Every face that is visible in the "
    "photograph stays fully visible and recognisable for the whole "
    "clip. ")
ВИДЕО_ЗВУК_ОБЩЕЕ = (
    "SOUND: real location audio recorded in the room, no music of any "
    "kind, no soundtrack, no beat, no voiceover, no narration. ")
ВИДЕО_КАЧЕСТВО = (
    "Photorealistic live action footage, natural motion with real "
    "weight and inertia, skin moves and settles the way real skin does, "
    "24 frames per second, no slow motion, no speed ramp, no text, no "
    "watermark, no logo, no split screen.")
ВИДЕО_НЕГАТИВ = (
    "camera movement, zoom, push in, pull out, dolly, pan, tilt, orbit, "
    "handheld shake, focus pull, scene change, cut, new shot, music, "
    "soundtrack, background music, voiceover, subtitles, text, "
    "watermark, logo, clothing appearing, third person, extra person, "
    "extra arm, extra leg, deformed hands, face leaving the frame, "
    "head cropped, morphing face, changing hair, slow motion, "
    "time lapse, cartoon, 3d render")

# Движение и звук у каждой кнопки свои. Звук называется ПРИМЕТАМИ, а не
# словом «стоны»: модель кладёт то, что названо конкретно.
ВИДЕО = {
 # соло
 "un_close": ("Her hips tilt and shift slowly towards the lens, her "
   "thighs open a little wider and settle, her belly rises and falls "
   "with her breathing, her fingers move on her own thigh, her head "
   "lifts and her lips part.",
   "slow deep breathing, a soft sigh, the quiet rustle of the sheet "
   "under her hips, the room tone of a quiet bedroom"),
 "un_full": ("Her weight shifts slowly from one leg to the other, her "
   "hips roll with it, the hand in her hair slides down past her neck "
   "to her breast, her chest rises with her breath, her hair settles.",
   "quiet breathing, bare feet shifting on the floor, faint room tone"),
 "un_back": ("She rocks her hips slowly back towards the lens and "
   "settles again, her back arching a little deeper, one hand slides "
   "along her own thigh, her head turns further over her shoulder to "
   "hold the lens.",
   "slow breathing, a soft sigh, the creak of the table under her "
   "hands, faint room tone"),
 "un_three": ("She rocks forward and back on her hands and knees in a "
   "slow rhythm, her back arching and settling, her hanging breasts "
   "swaying with her, her head staying turned to the lens.",
   "slow breathing through parted lips, the rustle of the sheet under "
   "her knees, faint room tone"),
 "un_sit": ("Her knees open a little wider and settle, her hips tilt "
   "forward, she leans back a fraction further on her hands, her chest "
   "rises with her breath, her chin lifts.",
   "slow breathing, a soft sigh, the mattress creaking under her "
   "weight, faint room tone"),
 "un_lie": ("Her raised knee falls open a little wider, her belly rises "
   "and falls, the hand on her belly slides slowly down over her hip, "
   "her head turns on the pillow towards the lens.",
   "slow deep breathing, the rustle of the pillow, faint room tone"),
 "ph_close": ("Her hand between her thighs keeps working in a steady "
   "unhurried rhythm, two fingers circling, her wrist turning; her hips "
   "lift to meet her own hand, her other hand squeezes her breast, her "
   "head tips back against the headboard and her mouth opens.",
   "quick shallow breathing turning into soft moans, the wet sound of "
   "her fingers moving on her slick vulva, the headboard knocking "
   "gently against the wall"),
 "ph_side": ("Her hand between her thighs keeps moving in a steady "
   "rhythm, her fingers working, her upper knee drawing a little higher "
   "towards her chest and settling, her hips rocking, her eyes closing "
   "and opening, her mouth staying open.",
   "soft moans and uneven breathing, the wet sound of her fingers on "
   "her slick vulva, the sheet rustling under her shoulder"),
 "ph_above": ("Her hand between her legs keeps working from behind in a "
   "steady rhythm, her hips pushing back against her own fingers, her "
   "back arching deeper and settling, her cheek sliding on the sheet, "
   "her face staying turned to the lens.",
   "muffled moans against the sheet, fast breathing, the wet sound of "
   "her fingers on her slick vulva, the mattress creaking"),
 "ph_below": ("She pulls the top the rest of the way up over her head "
   "and lets it drop out of frame, her breasts settling free as her "
   "arms come down, her hair falling back into place, her chin lowering "
   "and her eyes finding the lens.",
   "fabric sliding over skin and hair, a short laugh, quiet breathing"),
 "ph_push": ("She pushes the panties further down her thighs and lets "
   "them fall to her knees, her hips swaying with the movement, her "
   "back arching deeper, her head staying turned over her shoulder to "
   "the lens.",
   "elastic fabric sliding down bare skin, slow breathing, faint room "
   "tone"),
 "mf_above": ("He thrusts into her from above in a steady unhurried "
   "rhythm, his hips rising and pressing down again, her knees falling "
   "wider with each push, her breasts moving under him, her hands "
   "sliding on his back, both faces staying turned up to the lens.",
   "skin meeting skin in rhythm, her moans, his breathing above her, "
   "wet sounds where they are joined, the mattress creaking"),
 "mf_close": ("Their lips meet and part again slowly, her chin lifting "
   "to him, his hand sliding from her cheek into her hair, her eyes "
   "closing and opening on the lens, both of them breathing harder.",
   "soft wet kissing sounds, two people breathing close to the "
   "microphone, a quiet sigh"),
 "ff_above": ("The second woman's head moves slowly at the first one's "
   "vulva, her tongue working; the first one's hips lift towards that "
   "mouth, her belly rising and falling, her hands squeezing her own "
   "breasts, her face staying turned up to the lens.",
   "wet licking sounds, her moans, both breathing unevenly, the sheet "
   "rustling"),
 "un_kneel": ("She settles back on her heels and rises a little "
   "again, her knees opening wider, her hands sliding up her own "
   "thighs, her chest rising with her breath, her chin staying level "
   "on the lens.",
   "slow breathing, the sheet shifting under her knees, faint room "
   "tone"),
 "un_low": ("Her weight shifts from one foot to the other, her hips "
   "roll with it, the hand in her hair slides down her neck, her chin "
   "stays level on the lens.",
   "quiet breathing, bare feet on the floor, faint room tone"),
 "un_over": ("Her raised knee falls open wider and settles, her belly "
   "rises and falls, the hand on her belly slides down over her hip, "
   "her face stays turned up to the lens.",
   "slow deep breathing, a soft sigh, the pillow rustling"),
 "un_lean": ("She pushes off the wall a little and settles back "
   "against it, her raised knee opening further, the hand on the wall "
   "sliding down, her chin dropping and her eyes staying on the lens.",
   "quiet breathing, skin brushing the wall, faint room tone"),
 "ph_pov": ("Her mouth closes over him and moves slowly down and back "
   "up, her hand moving with her lips, her eyes lifting to the lens "
   "between movements, her breasts shifting with her shoulders.",
   "wet sucking sounds in rhythm, her breathing through her nose, a "
   "low groan from the viewer close to the microphone"),
 "ph_pull": ("She shifts her weight slowly from one leg to the other, "
   "turns a few degrees towards the lens and back, the hand in her "
   "hair drops to her hip, her chest rises with her breath.",
   "quiet breathing, bare feet on the floor, faint traffic through the "
   "window, room tone"),
 "ph_mirror": ("She shifts her weight and turns a little so the "
   "reflection turns with her exactly, the hand on the glass slides "
   "down, her eyes find the lens in the mirror, her breathing lifts "
   "her ribs.",
   "quiet breathing, a palm sliding on glass, faint room tone"),
 "ph_slow": ("Her hand keeps sliding slowly down across her belly to "
   "her groin and begins to move there, her belly rising and falling "
   "faster, her ribs lifting, her lips parting at the top of the "
   "frame.",
   "slow breathing turning uneven, a soft moan, the wet sound of her "
   "fingers, the sheet rustling"),
 # парные
 "mf_near": ("He thrusts into her from behind in a steady unhurried "
   "rhythm, his hips meeting her buttocks each time, her whole body "
   "rocking forward with every thrust, her hanging breasts swaying "
   "underneath her, her hair moving with her head. His hands stay on "
   "her hips. They stay joined the whole time.",
   "skin slapping against skin in rhythm, her moans on each thrust, his "
   "heavy breathing, wet slick sounds where they are joined, the "
   "mattress creaking"),
 "mf_face": ("She rides him, her hips rising and settling down onto him "
   "again in a steady unhurried rhythm, her breasts moving with her "
   "body, her hair falling forward and back, her head tipping back. He "
   "stays on his back beneath her, his hands on her hips, his chest "
   "rising faster.",
   "wet rhythmic sounds where they are joined, her moans, his breathing "
   "under her, the mattress creaking in the same rhythm"),
 "mf_behind": ("His head moves slowly against her vulva, his tongue "
   "working, his jaw and lips in motion; her hips lift and press "
   "towards his mouth, her belly rises and falls, her head tips back "
   "and her lips part, her fingers tighten in his hair.",
   "soft wet licking sounds, her moans growing, her uneven breathing, "
   "the sheet rustling under her"),
 "mf_pov": ("Her head moves forward and back along him in a steady "
   "unhurried rhythm, her lips closed around him, her cheeks hollowing, "
   "her hand moving with her mouth, her eyes lifting to his face. He "
   "stands still, his hand resting in her hair, his chest rising.",
   "wet sucking sounds in rhythm, her breathing through her nose, his "
   "low groans"),
 "ff_near": ("The second woman's head moves slowly at the first one's "
   "vulva, her tongue working; the first one's hips press towards that "
   "mouth, her belly rises and falls, her head tips back and her lips "
   "part, her hand tightens in the other one's hair.",
   "soft wet licking sounds, her moans, both women breathing unevenly, "
   "the sheet rustling"),
 "ff_close": ("The kneeling one works at the standing one's vulva from "
   "behind, her head moving slowly; the standing one pushes her "
   "buttocks back towards that mouth in a slow rhythm, her hanging "
   "breasts swaying, her face staying turned back over her shoulder.",
   "wet licking sounds, the standing woman's moans, both breathing "
   "hard, the bed creaking under her hands"),
 "ff_pov": ("The one lying on her stomach moves her head slowly at the "
   "other's vulva, her tongue working; the half-sitting one presses her "
   "hips towards that mouth, her belly rising and falling, her head "
   "tipping back, her elbows sliding on the pillows.",
   "soft wet licking sounds, her moans, uneven breathing, the pillows "
   "shifting under her"),
 "ff_69": ("The lying woman's head moves at the kneeling one's groin, "
   "her tongue working; the kneeling one rocks her hips down towards "
   "that mouth in a slow rhythm, her back arching and settling, her "
   "hanging breasts swaying, her face staying turned to the lens.",
   "wet licking sounds, moans from both of them, fast uneven breathing, "
   "the mattress creaking in rhythm"),
}


def видео(ключ):
    """Текст ролика по кнопке: движение, звук, стоящая камера."""
    ключ = str(ключ or "")
    for приставка in ("pr_", "pf_", "vi_", "ac_"):
        if ключ.startswith(приставка):
            ост = ключ[len(приставка):]
            ключ = ("ph_" + ост) if приставка == "ac_" else ост
            break
    if ключ not in ВИДЕО:
        raise KeyError("нет движения для кнопки %s" % ключ)
    движение, звук = ВИДЕО[ключ]
    пара = ключ in ПАРНЫЕ
    текст = ("Live action video that starts from the supplied "
             "photograph and continues it. " + ВИДЕО_ДЕРЖАТЬ
             + "THE MOTION: " + движение + " " + ВИДЕО_КАМЕРА
             + ВИДЕО_ЗВУК_ОБЩЕЕ + "The audio is exactly this: " + звук
             + ". " + ВИДЕО_КАЧЕСТВО)
    return {"ключ": ключ, "промпт": текст, "негатив": ВИДЕО_НЕГАТИВ,
            "пара": пара}
