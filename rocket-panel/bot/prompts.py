"""Сборка промптов. Сценарий описывает СВОЁ, остальное добавляется само.

## Зачем сборщик, а не сорок готовых текстов

Требование владельца — промпт от 3000 знаков на каждую кнопку. Сорок
сценариев по три тысячи это сто двадцать тысяч знаков. Написанные
стеной, они превращаются в мёртвый груз: поправить освещение во всех
сразу нельзя, забытый кусок видно только на готовой картинке, а новый
сценарий стоит полдня.

Поэтому сценарий объявляет только то, чем он отличается: гардероб,
поза, обстановка, свет, объектив, настроение. Всё общее — качество
кожи, анатомия рук, запреты — живёт здесь в одном экземпляре. Длина
получается сама и проверяется тестом.

## Порядок блоков не случаен

Модели внимательнее к началу промпта. Поэтому сначала идёт главное
(кто и что делает), потом обстановка и свет, и только в конце
технические слова про резкость и разрешение. Негатив уходит отдельным
полем, а не в конец текста: смешанный с описанием, он начинает
работать как описание.

## Про русский

Промпты только на английском. Модель обучена на английском, русский
даёт мусор — проверено, тест `test_промпты_на_английском_и_не_пустые`
сторожит это отдельно.
"""

МИН_ДЛИНА = 3000

# Общее для всех кадров. Один экземпляр: разойдётся по сценариям —
# и правка освещения превратится в сорок правок.
ТЕЛО = (
    "The woman from the uploaded reference photograph, her face preserved "
    "exactly: same bone structure, same eye shape and colour, same nose, "
    "same lips, same eyebrows, same hairline, same skin tone and the same "
    "individual marks, moles and freckles. Identity must be unmistakable — "
    "someone who knows her recognises her instantly. Do not beautify, do "
    "not slim, do not symmetrise, do not change her apparent age."
)

КОЖА = (
    "Skin rendered as real skin: visible pores across the nose and cheeks, "
    "fine vellus hair catching the light along the jaw and forearms, subtle "
    "unevenness in tone, a faint flush where blood runs close to the "
    "surface at the cheeks, collarbone and knuckles. Natural subsurface "
    "scattering so light passes a millimetre into the flesh and returns "
    "warm, especially at the ears, fingers and the bridge of the nose. "
    "Soft natural shine on the forehead and nose, matte elsewhere. No "
    "airbrushing, no plastic smoothing, no wax finish, no uniform poreless "
    "surface, no beauty-filter skin."
)

АНАТОМИЯ = (
    "Anatomy strictly correct. Exactly five fingers on each hand, thumbs "
    "opposed correctly, knuckles and nail beds clearly formed, fingers of "
    "believable length with natural curl. Both hands fully visible or "
    "deliberately and cleanly out of frame — never a hand merging into "
    "fabric or into the body. Limbs of consistent thickness along their "
    "length, joints bending only where joints bend. Shoulders, clavicles, "
    "ribcage and hips in anatomically sound relation. Teeth, when visible, "
    "individually formed and even in number."
)

ТКАНЬ = (
    "Fabric behaves like real fabric under gravity: it has weight, it "
    "creases where the body bends, it stretches across the widest point "
    "and gathers at the narrowest. Weave and knit visible at close range, "
    "edges hemmed or finished, seams following the body. Where the cloth "
    "touches skin it compresses it slightly. No painted-on clothing, no "
    "texture floating above the surface."
)

КАМЕРА_ОБЩЕЕ = (
    "Shot on a full-frame camera with a fast prime lens. Focus locked on "
    "the eyes with the nearer eye critically sharp; falloff natural and "
    "progressive, never a uniform blur pasted behind the subject. Gentle "
    "optical vignetting at the corners, faint chromatic aberration at high "
    "contrast edges, fine natural grain consistent across the whole frame. "
    "Correct perspective for the stated focal length: no wide-angle "
    "distortion of the face, no flattening of the body."
)

ЦВЕТ = (
    "Colour graded like a magazine editorial: deep but open shadows that "
    "keep detail, highlights that roll off instead of clipping to white, "
    "believable warm-to-cool separation between key light and shadow. "
    "White balance consistent across the frame."
)

КОМПОЗИЦИЯ = (
    "Vertical 9:16 frame, composed for a phone screen held upright. The "
    "subject occupies the frame decisively: no dead space above the head, "
    "no accidental amputation at a joint — crop through the thigh or the "
    "upper arm, never at the wrist, knee or ankle. Eyeline placed near the "
    "upper third. The body reads as a clear silhouette against the "
    "background at a glance, before any detail is examined. Background "
    "elements arranged so that nothing sprouts from behind the head. "
    "Horizon, wall lines and furniture edges level unless the scenario "
    "asks otherwise."
)

КАЧЕСТВО = (
    "Photorealistic. Ultra sharp where focus lands, 8K detail, high "
    "dynamic range, professional retouching standard — the level of a "
    "paid editorial shoot, not a snapshot and not a render."
)

НЕГАТИВ = (
    "cartoon, anime, illustration, painting, 3d render, cgi, doll, "
    "plastic skin, waxy skin, airbrushed, beauty filter, poreless, "
    "deformed hands, extra fingers, missing fingers, fused fingers, "
    "extra limbs, malformed limbs, bad anatomy, broken proportions, "
    "distorted face, changed face, different person, asymmetric eyes, "
    "crossed eyes, extra teeth, watermark, signature, text, caption, "
    "logo, username, frame, border, jpeg artifacts, oversaturated, "
    "blown highlights, crushed blacks, blurry, out of focus, lowres, "
    "duplicate, cropped head, floating limbs, mutated"
)

# Куски, которые добавляются по виду работы, а не по сценарию.
ПО_ВИДУ = {
    "photo": (
        "A single still photograph. The whole frame is one exposure: one "
        "light direction, one white balance, one grain structure."
    ),
    "inpaint": (
        "Change ONLY what this scenario describes. Everything else in the "
        "uploaded photograph stays byte-for-byte as it was: the face, the "
        "hair, the pose, the background, the light direction, the grain. "
        "The edited region must match the surrounding frame in colour "
        "temperature, noise and sharpness so the seam is invisible at full "
        "resolution."
    ),
    "animate": (
        "Animate the uploaded photograph into a short vertical clip, 9:16. "
        "The first frame is the photograph itself, unchanged. Motion is "
        "small, continuous and physically plausible: breathing that lifts "
        "the chest, a slow blink, hair settling, fabric shifting with the "
        "body. The face must stay the same face in every single frame — no "
        "drift, no morph, no identity change between the first frame and "
        "the last. No cuts, no teleporting, no sudden speed changes."
    ),
    "sound": (
        "Animate the uploaded photograph into a vertical clip with speech, "
        "9:16. Lips must match the audio precisely: closures on b, p and m, "
        "teeth on f and v, an open jaw on broad vowels. Jaw, cheeks and "
        "throat move with the mouth; the whole face participates, not the "
        "mouth alone. Eyes stay alive between phrases with natural blinks "
        "and micro-movements. The face must stay the same face throughout."
    ),
}


class Блок:
    """Одна грань сценария. Пустые не попадают в текст."""

    __slots__ = ("гардероб", "поза", "обстановка", "свет", "камера",
                 "настроение", "ещё")

    def __init__(self, гардероб="", поза="", обстановка="", свет="",
                 камера="", настроение="", ещё=""):
        self.гардероб = гардероб
        self.поза = поза
        self.обстановка = обстановка
        self.свет = свет
        self.камера = камера
        self.настроение = настроение
        self.ещё = ещё


def собрать(вид, блок):
    """Сценарий + общие блоки -> готовый промпт.

    Порядок намеренный: модели внимательнее к началу, поэтому сначала
    кто и что, потом где и при каком свете, и только в конце техника.
    """
    if вид not in ПО_ВИДУ:
        raise KeyError(f"неизвестный вид работы: {вид}")

    куски = [ТЕЛО, ПО_ВИДУ[вид]]
    for поле in ("гардероб", "поза", "обстановка", "свет", "камера",
                 "настроение", "ещё"):
        значение = getattr(блок, поле)
        if значение:
            куски.append(значение.strip())
    куски += [КОЖА, АНАТОМИЯ, ТКАНЬ, КОМПОЗИЦИЯ, КАМЕРА_ОБЩЕЕ, ЦВЕТ, КАЧЕСТВО]
    return "\n\n".join(куски)


def длина_ок(текст):
    return len(текст) >= МИН_ДЛИНА
