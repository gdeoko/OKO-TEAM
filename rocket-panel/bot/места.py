"""Обстановка как ОТДЕЛЬНЫЙ выбор, а не как отдельная кнопка каталога.

## Что изменилось и почему

Сначала «Другое место» было подразделом из десяти сценариев: «Шёлковая
постель», «Ночной отель», «У бассейна». Каждый нёс свою обстановку
внутри промпта, и поэтому обстановка была доступна ровно в этих десяти
сценариях — а в «Раздевании», в «Интиме» и в парных сценах её не было
вовсе.

Решение владельца 21.09.2026: место — это ДОБАВКА к любому промпту,
которая ставится, только когда человек хочет фон не такой, как на его
снимке. Тогда десять сценариев превращаются в десять мест, и каждое
работает с каждым вариантом: тринадцать вариантов на восемь мест — это
сто с лишним сочетаний вместо десяти кнопок.

Ничего из написанного владельцем при этом не пропало: в «Другом месте»
у него не было заполнено ни одной откровенной строки — там были только
названия, и они переезжают вместе с ключами.

## Ключи не менять

Ключи остались прежними (`sc_bed`, `sc_hotel`, …) нарочно: владелец уже
переименовал часть мест и спрятал три из них, и правки лежат в
`каталог.json` по этим ключам. Новый ключ означал бы потерянное
название.

## Что место даёт промпту

Только ОБСТАНОВКУ и СВЕТ. Ни позы, ни ракурса, ни объектива: их задаёт
вариант, и место не имеет права их перебивать — иначе «Крупный план в
душе» перестал бы быть крупным планом.
"""


class Место:
    """Обстановка, которую можно подставить к любому варианту."""

    def __init__(self, key, title, подпись, обстановка, свет="", ещё="",
                 референс=False, кратко=""):
        self.key = key
        self.title = title
        self.подпись = подпись          # человеку на экран выбора
        self.обстановка = обстановка
        self.свет = свет
        # КОРОТКАЯ ФОРМА — для парных сцен. Замер 22.09.2026: у пары
        # промпт на 5343 знака терял то место, то позу, то наготу, а на
        # 709 знаках всё встало сразу. Полное описание туда не влезает.
        # Не задано — берём по первому предложению обстановки и света.
        self._кратко = кратко
        self.ещё = ещё
        # «Как на твоём фото» — не место, а его отсутствие: обстановка
        # берётся с присланного снимка, и добавлять нечего.
        self.референс = референс

    @property
    def кратко(self):
        if self._кратко:
            return self._кратко
        куски = []
        for текст in (self.обстановка, self.свет):
            текст = (текст or "").strip()
            if текст:
                куски.append(текст.split(". ")[0].rstrip(".") + ".")
        return " ".join(куски)


# «Как на твоём фото» стоит первым и выбран по умолчанию. Это и самый
# частый выбор, и самый дешёвый по риску: своя комната на снимке уже
# есть, а выдуманная может не понравиться.
КАК_НА_ФОТО = Место(
    "ref", "Фон с референса", "Та же обстановка, что на присланном снимке",
    обстановка="", референс=True)


ВСЕ = [
    Место("sc_bed", "Шёлковая постель",
          "Утро, смятый шёлк, свет из-за штор",
          обстановка="A wide bed dressed in ivory silk, the sheets deeply "
                     "creased from a night of sleep, one pillow pushed "
                     "aside. A bedroom in soft focus behind: a low "
                     "headboard, a lamp switched off, sheer curtains "
                     "moving slightly.",
          свет="Morning sun through sheer curtains, diffuse and warm, "
               "throwing long soft shadows across the bedding."),

    Место("sc_studio", "Чёрная студия",
          "Один источник, всё остальное в темноте",
          обстановка="A professional photo studio against seamless black "
                     "paper, nothing else in frame.",
          свет="A single large softbox at forty-five degrees camera left, "
               "feathered so the far side of the body falls into deep "
               "shadow. A thin rim light from behind separates the "
               "shoulder and hair from the black."),

    Место("sc_hotel", "Ночной отель",
          "Город в окне, лампа у кровати",
          обстановка="A high-floor hotel room at night. A floor-to-ceiling "
                     "window fills one side of the frame with a city "
                     "skyline far below, out of focus into points of amber "
                     "and white. A wide bed with the covers turned down, a "
                     "single bedside lamp lit.",
          свет="Warm lamplight from inside, cool city light from the "
               "window, meeting on the skin — warm on one side, cool on "
               "the other."),

    Место("sc_pool", "У бассейна",
          "Вода, отражения, полуденное солнце",
          обстановка="The edge of a swimming pool at midday, turquoise "
                     "water throwing rippling caustic reflections onto "
                     "everything above it. Pale stone underfoot, a folded "
                     "towel, a sun lounger, nothing else.",
          свет="Hard overhead sun softened by a passing cloud, plus the "
               "moving reflected light from the water playing across the "
               "underside of the chin, the arms and the thighs."),

    # ФИРМЕННАЯ СТУДИЯ. Просьба владельца 22.09.2026: место в стиле
    # самого бота — чёрный фон и розовый неон, как на лого, — чтобы
    # такие кадры шли в примеры на витрину.
    #
    # Неон легко съедает тело: он красив, но красит кожу в свой цвет и
    # топит фигуру в темноте. Поэтому здесь неон отвечает ТОЛЬКО за
    # фон и за контур, а тела освещает отдельный мягкий белый источник
    # спереди — ради того, что владелец и просил: чтобы фигура и
    # действие читались чётко.
    Место("sc_amberry", "Студия AMBERRY",
          "Чёрный фон, розовый неон, тела в чистом свете",
          обстановка="A black studio set: seamless black walls and a "
                     "glossy black floor. Behind the subjects, a wall of "
                     "hot magenta-pink neon tubing — horizontal bars and "
                     "one broad glowing arc — burns against the black and "
                     "lays a pink reflection on the floor. Nothing else: "
                     "no furniture, no props, no text.",
          свет="The magenta neon is BEHIND them and only rims their "
               "shoulders, waist and thighs with hot pink, separating "
               "each body from the black. The bodies themselves are lit "
               "from the front by a large soft white light: skin keeps "
               "its own colour, and every curve and every point of "
               "contact stays clearly readable.",
          ещё="Glossy and expensive, a high-end studio shoot.",
          кратко="Black studio, a wall of hot pink neon tubes glowing "
                 "behind them, glossy black floor; the neon rims their "
                 "bodies from behind while a soft white light from the "
                 "front keeps the skin its own colour."),

    Место("sc_neon", "Неоновый переулок",
          "Мокрый асфальт, розовые вывески",
          обстановка="A narrow city alley at night after rain. Wet asphalt "
                     "mirrors a row of neon signs in magenta and cold "
                     "blue. Steam rising from a grate, brick walls close "
                     "on both sides.",
          свет="Hard coloured neon from two directions, magenta from the "
               "left and cold blue from behind, with deep unlit shadow "
               "between them.",
          ещё="Cinematic, charged, slightly dangerous in mood."),

    Место("sc_nature", "На природе",
          "Высокая трава, закатное солнце",
          обстановка="Outdoors in the open: a field of tall dry grass at "
                     "golden hour, the horizon low and distant, a line of "
                     "trees far behind in haze. No buildings, no road, no "
                     "other people anywhere in the frame.",
          свет="The sun low and behind, rimming hair and shoulders in "
               "gold, the front lit softly by bounce from the ground. "
               "Visible lens flare and warm atmospheric haze."),

    Место("sc_office", "В школе",
          "Пустой класс после уроков, свет из окон",
          обстановка="An empty classroom after the school day has ended. "
                     "Rows of plain wooden desks with chairs pushed in, a "
                     "large dark green chalkboard along one wall with "
                     "faint chalk traces on it, a teacher's desk in front "
                     "of it, tall windows down the opposite side. The room "
                     "is empty of other people.",
          свет="Late afternoon sun coming in low and warm through the tall "
               "windows, throwing long window-shaped rectangles across the "
               "floor and the desks. Those rectangles bend over whatever "
               "they fall on rather than staying flat. The far side of the "
               "room stays in cool shadow."),

    Место("sc_mirror", "У зеркала",
          "Отражение и спина в одном кадре",
          обстановка="A tall frameless mirror against a bedroom wall, the "
                     "room behind it softly out of focus.",
          свет="A warm bulb above the mirror lighting the reflected front, "
               "a cooler window light behind the camera grazing the back. "
               "Two colour temperatures, kept apart.",
          ещё="The mirror shows a TRUE reflection: same body, same pose, "
              "reversed correctly, lit from the same direction. "
              "Reflections are where identity usually breaks — the face in "
              "the glass must be the same face, and the body in the glass "
              "the same body. No second person."),

    Место("sc_shower", "В душе",
          "Мокрая кожа, пар, стекло в каплях",
          обстановка="A walk-in shower with dark stone and a glass screen "
                     "beaded with condensation, water running.",
          свет="A single overhead source through steam, so the light "
               "arrives soft and volumetric and every droplet carries its "
               "own tiny highlight.",
          ещё="Water behaves as water: it runs in continuous threads over "
              "the shoulders, pools in the collarbones, beads where it "
              "meets skin. Wet hair is heavy, separated into ropes, darker "
              "than dry hair — but the SAME colour and the same length as "
              "in the reference. Wet skin is glossier but still porous, "
              "never plastic."),

    Место("sc_car", "Заднее сиденье",
          "Салон ночью, свет фонарей по телу",
          обстановка="The back seat of a car at night, dark leather, the "
                     "city sliding past outside the window.",
          свет="Streetlights passing overhead sweep bands of warm light "
               "across the face and the seat, leaving everything else "
               "nearly black."),
]

ПО_КЛЮЧУ = {м.key: м for м in ВСЕ}
ПО_КЛЮЧУ[КАК_НА_ФОТО.key] = КАК_НА_ФОТО


def место(key):
    if key not in ПО_КЛЮЧУ:
        raise KeyError(f"неизвестное место: {key}")
    return ПО_КЛЮЧУ[key]
