"""Два языка интерфейса: русский и английский.

## Почему вообще два

Бот продаёт картинки, а не тексты, и рынок у него не кончается на
русском. Английский интерфейс стоит один раз написанного словаря и
открывает всё остальное. Обратное неверно: англоязычный человек,
попавший на русские кнопки, не разбирается - он уходит.

## Как выбирается

Телеграм присылает `language_code` в каждом сообщении. По нему язык
ставится ОДИН раз, при заведении человека, и дальше не трогается
никогда: он приходит с каждым сообщением, и перезаписывать им
сохранённый выбор значило бы отменять выбор при каждом нажатии.

Дальше человек меняет язык сам, кнопкой в кабинете.

Правило выбора нарочно тупое: `ru` - русский, всё остальное -
английский. Угадывать, что казах или украинец «наверняка читает
по-русски», не наше дело: это предположение о человеке, которое легко
оказывается оскорбительным, а кнопка переключения стоит рядом и решает
вопрос одним нажатием.

## Что здесь лежит и чего здесь нет

ЗДЕСЬ: весь интерфейс - кнопки, экраны, ошибки, названия сценариев,
ракурсы, места. Всё, что пишу я.

НЕ ЗДЕСЬ: откровенные строки владельца. У них своя пара полей на
странице каталога, потому что пишет их он, а не код: `строка_рус`
русскому клиенту и `строка` - модели. Английскому клиенту
показывается вторая: он уже написан, писать его ещё раз для подписи
незачем.

НЕ ЗДЕСЬ: промпты. Они ВСЕГДА на английском, независимо от языка
интерфейса - это язык модели, а не человека.
"""

ЯЗЫКИ = ("ru", "en")
ПО_УМОЛЧАНИЮ = "ru"


def по_телеграму(код):
    """`language_code` от телеграма -> наш язык."""
    код = (код or "").lower()
    return "ru" if код == "ru" or код.startswith("ru-") else "en"


def нормальный(яз):
    return яз if яз in ЯЗЫКИ else ПО_УМОЛЧАНИЮ


def t(ключ, яз=ПО_УМОЛЧАНИЮ, **поля):
    """Строка по ключу. Нет перевода - возвращается русская.

    Падать на отсутствующем переводе нельзя: строка нужна человеку
    прямо сейчас, и русская фраза в английском интерфейсе - неприятно,
    но это работающий бот, а исключение - неработающий.
    """
    пара = СТРОКИ.get(ключ)
    if not пара:
        return ключ
    текст = пара.get(нормальный(яз)) or пара.get("ru") or ключ
    return текст.format(**поля) if поля else текст


def склонить(n, одна, две, много):
    """Русские окончания: 1 работа, 2 работы, 5 работ."""
    n = abs(int(n))
    if n % 10 == 1 and n % 100 != 11:
        return одна
    if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14:
        return две
    return много


def работ(n, яз):
    if нормальный(яз) == "en":
        return "work" if n == 1 else "works"
    return склонить(n, "работа", "работы", "работ")


def снимков(n, яз):
    if нормальный(яз) == "en":
        return "photo" if n == 1 else "photos"
    return склонить(n, "снимок", "снимка", "снимков")


def вариантов(n, яз):
    if нормальный(яз) == "en":
        return "option" if n == 1 else "options"
    return склонить(n, "вариант", "варианта", "вариантов")


# ---------------------------------------------------------------------
# НАЗВАНИЯ ВИДОВ РАБОТЫ
#
# Живут здесь, а не в прайсе: в прайсе цена, и она от языка не зависит.
# ---------------------------------------------------------------------

JOBS_EN = {
    "i2i":    ("Photo from photo", "up to 3 references, pose and place change"),
    "i2v_5":  ("Bring a photo to life, 5 s", "second frame optional"),
    "i2v_10": ("Bring a photo to life, 10 s", "second frame optional"),
    "sound":  ("Video with sound", "the photo speaks your words"),
}


def job_title(job, яз):
    if нормальный(яз) == "en" and job.key in JOBS_EN:
        return JOBS_EN[job.key][0]
    return job.title


def job_note(job, яз):
    if нормальный(яз) == "en" and job.key in JOBS_EN:
        return JOBS_EN[job.key][1]
    return job.note


# ---------------------------------------------------------------------
# КАТАЛОГ ПО-АНГЛИЙСКИ
#
# Русские названия и подписи живут в catalog.py рядом со сценарием -
# там они читаются вместе с тем, что описывают. Английские собраны
# здесь одной таблицей: так видно, что ничего не забыто, и перевод
# правится не в двадцати местах.
#
# Ключ -> (название кнопки, подпись-ракурс).
# ---------------------------------------------------------------------

# Узлы дерева: ключ -> (название кнопки, подзаголовок).
УЗЛЫ_EN = {
    "undress":   ("Undress", "Your photo, without the clothes"),
    "un_solo":   ("Solo", "One woman"),
    "un_here":   ("Undressing", "Angle, framing, pose - without the clothes"),
    "un_intim":  ("Intimate", "What the clips do, as a photograph"),
    "un_group":  ("Couples", "Two people. Two photos needed - one per person"),
    "un_mf":     ("M+F couple", "a man and a woman"),
    "un_ff":     ("F+F lesbian", "two women"),
    "un_mm":     ("M+M gay", "two men"),
    "video":     ("Video", "The photo starts moving"),
    "vi_solo":   ("Solo", "One woman"),
    "vi_group":  ("Couples", "Two people. Two photos needed - one per person"),
    "vi_mf":     ("M+F couple", "a man and a woman"),
    "vi_ff":     ("F+F lesbian", "two women"),
    "vi_mm":     ("M+M gay", "two men"),
    "own":       ("Your own prompt", "Describe it yourself"),
    "own_photo": ("Photo", "A reference and a description - you get a photo"),
    "own_video": ("Video", "A reference and a description - you get a clip"),
    "top":       ("Most wanted", "What gets ordered most"),
}

# Места: ключ -> (название кнопки, подпись).
МЕСТА_КНОПКИ_EN = {
    "ref":       ("As in your photo", "The setting stays as on your shot"),
    "sc_bed":    ("Silk sheets", "Morning, crumpled silk, light through the curtains"),
    "sc_studio": ("Black studio", "One light, everything else in darkness"),
    "sc_hotel":  ("Hotel at night", "The city in the window, a lamp by the bed"),
    "sc_pool":   ("By the pool", "Water, reflections, midday sun"),
    "sc_amberry": ("AMBERRY studio",
                  "Black set, pink neon, bodies in clean light"),
    "sc_neon":   ("Neon alley", "Wet asphalt, pink signs"),
    "sc_nature": ("Outdoors", "Tall grass, sunset light"),
    "sc_office": ("At school", "An empty classroom after lessons, light from the windows"),
    "sc_mirror": ("At the mirror", "Reflection and back in one frame"),
    "sc_shower": ("In the shower", "Wet skin, steam, beaded glass"),
    "sc_car":    ("Back seat", "Night interior, streetlights across the body"),
}

СОСТАВЫ_EN = {
    "мужчина и женщина": "a man and a woman",
    "две женщины": "two women",
    "двое мужчин": "two men",
}

СЦЕНАРИИ_EN = {
    # Раздеть · Где сняли
    "un_close": ("Close-up", "From the chest up"),
    "un_full":  ("Full length", "The whole figure"),
    "un_back":  ("From behind", "Back and shoulders, a look over the shoulder"),
    "un_three": ("Three-quarter", "Half-turned, the most flattering angle"),
    "un_sit":   ("Seated", "Sitting on whatever is there"),
    "un_kneel": ("Kneeling", "Low point, light from above"),
    "un_low":   ("From below", "Shot from a low angle"),
    "un_over":  ("From above", "Shot from a high angle"),
    "un_lie":   ("Lying down", "Horizontal, camera above her"),
    "un_lean":  ("Leaning", "Standing, leaning on what is nearby"),
    # Видео · Соло
    "ac_pov":    ("Point of view", "The camera is the viewer, hands in frame"),
    "ac_close":  ("Close-up", "Face and shoulders fill the frame"),
    "ac_side":   ("From the side", "Profile, the silhouette reads as a contour"),
    "ac_above":  ("From above", "Shot looking down"),
    "ac_below":  ("From below", "Shot from a low angle"),
    "ac_push":   ("Push in", "The camera moves slowly closer"),
    "ac_pull":   ("Pull out", "The camera pulls back, revealing the scene"),
    "ac_back":   ("From behind", "Back in frame, a look over the shoulder"),
    "ac_mirror": ("In the mirror", "Reflection and back at once"),
    "ac_slow":   ("Slow motion", "Everything at half speed"),

    # ПОСТАВЛЕННЫЕ КНОПКИ — те, что владелец принял по кадру и
    # переименовал сам. Русское имя он написал на странице каталога,
    # английского там нет вовсе, и до 23.09.2026 англичанин видел
    # умолчание из кода: «Секс раком» приходил к нему как «Side by
    # side», а «Кунилингус» у ЖЖ — как то же самое «Side by side», хотя
    # это разные кнопки с разными кадрами. Имена ниже описывают ТОТ ЖЕ
    # принятый кадр, что и русские.
    #
    # Ключи парных — `pr_*`: это `ключ_правок`, общий у фотографии и
    # ролика. Поиск по нему идёт ПЕРЕД `РАССТАНОВКИ_EN`, поэтому общая
    # геометрия сюда больше не подставляется.
    "un_close":  ("Close-up", "Lying back, legs apart, close on the hips"),
    "un_three":  ("On all fours", "On all fours, half-turned, face to the lens"),
    "un_sit":    ("Legs apart", "Sitting, knees apart, skirt pushed up"),
    "un_lie":    ("On her back", "On her back, camera level with the hips"),
    "ac_close":  ("Touching herself, close",
                  "Sitting facing the camera, hand between her legs"),
    "ac_side":   ("Touching herself, from the side",
                  "On her side along the frame, hand between her legs"),
    "ac_above":  ("Touching herself on all fours",
                  "On all fours from the side, hand behind between her legs"),
    "ac_back":   ("With a toy", "Sitting three-quarter, with a toy"),
    "ac_below":  ("Taking her top off",
                  "Standing, pulling the top over her head"),
    "ac_push":   ("Taking her panties off",
                  "From behind, bent forward, sliding them down"),
    "pr_mf_near":   ("From behind",
                     "She is on all fours, he kneels behind her"),
    "pr_mf_face":   ("Riding him",
                     "He lies on his back, she is on top facing the camera"),
    "pr_mf_behind": ("Going down on her",
                     "She half-sits, he is between her legs"),
    "pr_mf_pov":    ("Going down on him",
                     "He stands, she kneels in front of him"),
    "pr_ff_near":   ("Going down on her",
                     "One sits on the edge of the bed, the other kneels"),
    "pr_ff_face":   ("From behind, lying",
                     "One lies on her side, the other behind her"),
    "pr_ff_behind": ("Both on all fours",
                     "Both on all fours, camera behind and low"),
    "pr_ff_close":  ("From behind, standing",
                     "One bent over, the other behind, side view"),
    "pr_ff_pov":    ("Going down on her, lying",
                     "One half-sits on pillows, the other between her legs"),
}

# Расстановки пар: ключ расстановки -> (название, подпись). Состав
# приписывается отдельно, поэтому здесь его нет.
РАССТАНОВКИ_EN = {
    "near":   ("Side by side", "The two of them side by side, camera facing"),
    "face":   ("Face to face", "Facing each other, profiles"),
    "behind": ("One behind", "The second one behind, both toward the camera"),
    "above":  ("From above", "Shot from a high angle"),
    "close":  ("Close-up", "Two faces fill the frame"),
    "pov":    ("Point of view", "The camera is one of the two"),
}


# ---------------------------------------------------------------------
# ИНТЕРФЕЙС
# ---------------------------------------------------------------------

СТРОКИ = {
    # --- нижнее меню ---
    # Значки нижних кнопок - простые эмодзи, выбор владельца
    # 21.09.2026. Премиум-иконку в reply-клавиатуру не поставить так,
    # как в сообщение, а подпись без значка владелец забраковал.
    "низ.создать":  {"ru": "🫦 Создать", "en": "🫦 Create"},
    "низ.файлы":    {"ru": "🗂️ Файлы",   "en": "🗂️ Files"},
    "низ.кабинет":  {"ru": "🛠️ Кабинет", "en": "🛠️ Account"},
    "низ.пополнить": {"ru": "🩷 Пополнить", "en": "🩷 Top up"},
    "низ.вернул": {
        "ru": "Меню снизу на месте.",
        "en": "The menu below is back.",
    },
    "низ.обновлено": {
        "ru": "Меню снизу обновилось.",
        "en": "The menu below has been updated.",
    },

    # --- кнопки, встречающиеся везде ---
    "кн.назад":     {"ru": "Назад",  "en": "Back"},
    "кн.меню":      {"ru": "Меню",   "en": "Menu"},
    "кн.отмена":    {"ru": "Отмена", "en": "Cancel"},
    "кн.баланс":    {"ru": "Баланс", "en": "Balance"},
    "кн.пополнить": {"ru": "Пополнить", "en": "Top up"},
    "кн.сделать":   {"ru": "Сделать · {цена}", "en": "Make it · {цена}"},
    "кн.другой":    {"ru": "Другой вариант", "en": "Another option"},
    "кн.место":     {"ru": "Другой фон", "en": "Another background"},
    "кн.поехали":   {"ru": "Хватит, поехали · {цена}",
                     "en": "That's enough, go · {цена}"},
    "кн.убрать":    {"ru": "Убрать последнее", "en": "Remove the last one"},
    "кн.заново":    {"ru": "Начать заново", "en": "Start over"},
    "кн.ещё_раз":   {"ru": "Ещё раз", "en": "Again"},
    "кн.оживить":   {"ru": "Оживить это · {цена}",
                     "en": "Bring this to life · {цена}"},
    "кн.работы":    {"ru": "Мои работы", "en": "My works"},
    "кн.друзья":    {"ru": "Позвать друзей", "en": "Invite friends"},
    "кн.удалить":   {"ru": "Удалить мои данные", "en": "Delete my data"},
    "кн.удалить_да": {"ru": "Да, удалить всё", "en": "Yes, delete everything"},
    "кн.язык":      {"ru": "Language · English", "en": "Язык · русский"},
    "кн.звёзды":    {"ru": "Telegram Stars", "en": "Telegram Stars"},
    "кн.крипта":    {"ru": "Криптовалютой", "en": "Crypto"},
    "кн.оплатить":  {"ru": "Оплатить", "en": "Pay"},
    "кн.проверь":   {"ru": "Я оплатил, проверь", "en": "I paid, check it"},

    # --- главный экран ---
    "гл.шапка": {
        "ru": "{привет}пришли фото - и оно оживёт, переоденется или заговорит.",
        "en": "{привет}send a photo - and it will move, change or speak.",
    },
    "гл.баланс":  {"ru": "Баланс: <b>{баланс}</b>", "en": "Balance: <b>{баланс}</b>"},
    "гл.цены":    {"ru": "1 {символ} - одно фото. Ролик 5 секунд - 5 {символ}.",
                   "en": "1 {символ} - one photo. A 5-second clip - 5 {символ}."},
    "гл.что_делаем": {"ru": "Что делаем?", "en": "What are we making?"},
    "гл.что_дальше": {"ru": "Что дальше?", "en": "What next?"},
    "гл.добро": {"ru": "Добро пожаловать. Дарю <b>{подарок}</b> на пробу.",
                 "en": "Welcome. Here is <b>{подарок}</b> to try it out."},
    "гл.сначала_выбери": {"ru": "Сначала выбери, что делаем.",
                          "en": "Pick what we are making first."},
    "гл.сначала_сценарий": {"ru": "Сначала выбери сценарий или режим.",
                            "en": "Pick a scenario or a mode first."},
    "гл.пусто": {"ru": "Тут пока пусто.", "en": "Nothing here yet."},
    # ПОДДЕРЖКА. Раньше на любую вольную строку бот отвечал «Сначала
    # выбери, что делаем» — и человек, который писал «не пришла оплата»,
    # получал в ответ инструкцию по меню. Теперь такое письмо уходит
    # владельцу, а человеку честно говорится, что оно ушло.
    "подд.приняли": {
        "ru": "Передала твоё сообщение. Ответим сюда же.",
        "en": "Your message is with us. We will answer right here."},
    "подд.ответ": {"ru": "Ответ поддержки:", "en": "Support:"},

    # --- ФРАНШИЗА: свой бот клиента на нашем движке ---
    "фр.кнопка": {"ru": "Свой бот", "en": "Your own bot"},
    "фр.экран": {
        "ru": ("<b>СВОЙ БОТ НА НАШЕМ ДВИЖКЕ</b>\n\n"
               "Тот же движок, те же кнопки, те же кадры - но твоё имя, "
               "твоя аватарка, твои клиенты.\n\n"
               "<b>Что делаешь ты:</b> заводишь бота у @BotFather и "
               "присылаешь сюда его токен. Одно сообщение.\n"
               "<b>Что делаем мы:</b> сервер, видеокарта, модели, каталог, "
               "оплаты, панель, обновления. Всё уже стоит и работает.\n\n"
               "<b>Деньги:</b> {доля}% выручки твоего бота остаётся тебе. "
               "Считаем помесячно, платим на твои реквизиты.\n\n"
               "<b>Цена:</b> {рублей} ₽ или {долларов} $ - один раз."),
        "en": ("<b>YOUR OWN BOT ON OUR ENGINE</b>\n\n"
               "Same engine, same buttons, same frames - your name, your "
               "avatar, your clients.\n\n"
               "<b>Your part:</b> create a bot with @BotFather and send us "
               "its token. One message.\n"
               "<b>Our part:</b> server, GPU, models, catalogue, payments, "
               "admin panel, updates. All of it already runs.\n\n"
               "<b>Money:</b> {доля}% of your bot's revenue stays with you. "
               "Counted monthly, paid to your details.\n\n"
               "<b>Price:</b> {долларов} $ or {рублей} ₽ - once."),
    },
    "фр.купить": {"ru": "Хочу свой бот", "en": "I want my own bot"},
    "фр.обложка_под": {
        "ru": "Франшиза AMBERRY · {долларов} $ или {рублей} ₽",
        "en": "AMBERRY franchise · {долларов} $ or {рублей} RUB"},
    "фр.обложка_низ": {
        "ru": "Тот же движок, твоё имя, {доля}% выручки твои",
        "en": "Same engine, your name, {доля}% of the revenue is yours"},
    "фр.как_платим": {
        "ru": "Чем платишь? {рублей} ₽ звёздами или {долларов} $ криптой.",
        "en": "How do you pay? {рублей} RUB in Stars or {долларов} USD in crypto."},
    "фр.уже_куплено": {
        "ru": "Франшиза у тебя уже есть. Состояние: {состояние}.",
        "en": "You already have the franchise. State: {состояние}."},
    "фр.жду_токен": {
        "ru": ("Оплата прошла. Теперь пришли <b>токен бота</b> из "
               "@BotFather одним сообщением - он выглядит так:\n"
               "<code>1234567890:AAH...</code>\n\n"
               "Токен видим только мы, в переписке он не останется."),
        "en": ("Paid. Now send the <b>bot token</b> from @BotFather in one "
               "message - it looks like this:\n"
               "<code>1234567890:AAH...</code>\n\n"
               "Only we see the token, it will not stay in the chat.")},
    "фр.токен_принят": {
        "ru": ("Принято, бот {бот} подключён к очереди на запуск. "
               "Напишем сюда, когда он оживёт."),
        "en": ("Got it, bot {бот} is queued for launch. We will write here "
               "when it goes live.")},
    "фр.токен_не_тот": {
        "ru": "Не вышло: {почему}. Пришли токен ещё раз.",
        "en": "Did not work: {почему}. Send the token again."},
    "фр.запущен": {
        "ru": "Твой бот {бот} запущен. Работай.",
        "en": "Your bot {бот} is live. Go ahead."},
    "гл.убрано": {
        "ru": "Этого больше нет в боте. Вот что есть сейчас.",
        "en": "That is no longer in the bot. Here is what there is now.",
    },

    # --- раздел и подраздел ---
    "разд.вариантов": {"ru": "{n} {слово}", "en": "{n} {слово}"},
    "разд.свой_промпт_бесплатно": {
        "ru": "У конкурента свой промпт - платная функция под замком. "
              "У нас доступна всем.",
        "en": "Elsewhere your own prompt is a paid feature behind a lock. "
              "Here it is open to everyone.",
    },
    # Цена НАЗЫВАЕТСЯ ОДИН РАЗ — строкой над списком. С кнопок владелец
    # её снял 21.09.2026: в подразделе вид работы один, и «· 1 💞»
    # повторялось на каждой из тринадцати кнопок.
    "подр.сценариев": {
        "ru": "{n} {слово}, любой - {что} за {цена}.",
        "en": "{n} {слово}, any of them - {что} for {цена}.",
    },
    "подр.сценариев_просто": {
        "ru": "{n} {слово}. Цена - на экране варианта, до оплаты.",
        "en": "{n} {слово}. The price is on the variant screen, before you pay.",
    },

    # --- экран сценария ---
    "сц.в_кадре":     {"ru": "В кадре: <b>{что}</b>", "en": "In frame: <b>{что}</b>"},
    "сц.расстановка": {"ru": "Расстановка: <b>{что}</b>",
                       "en": "Arrangement: <b>{что}</b>"},
    "сц.место":       {"ru": "Фон: <b>{что}</b>", "en": "Background: <b>{что}</b>"},
    "место.заголовок": {"ru": "<b>Фон · {что}</b>",
                        "en": "<b>Background · {что}</b>"},
    "место.цена_та_же": {
        "ru": "<i>Место на цену не влияет - выбирай любое.</i>",
        "en": "<i>The place does not change the price - pick any.</i>",
    },
    "сц.место_и":     {"ru": "Место: <b>{что}</b> - {подпись}",
                       "en": "Place: <b>{что}</b> - {подпись}"},
    "сц.ракурс":      {"ru": "Ракурс: <b>{что}</b>", "en": "Framing: <b>{что}</b>"},
    "сц.действие":    {"ru": "Действие: <b>{что}</b>", "en": "Action: <b>{что}</b>"},
    "сц.спишем": {
        "ru": "Спишем <b>{цена}</b>, останется {остаток}.",
        "en": "We will take <b>{цена}</b>, leaving {остаток}.",
    },
    "сц.не_хватает": {
        "ru": "Нужно <b>{цена}</b>, на балансе {баланс}. {значок} Пополни - и сделаем.",
        "en": "You need <b>{цена}</b>, your balance is {баланс}. {значок} Top up and we will.",
    },
    "сц.мало_коинов": {"ru": "Нужно {цена}, на балансе {баланс}",
                       "en": "You need {цена}, your balance is {баланс}"},

    # --- сколько фото ---
    "фото.нет":   {"ru": "Фото не нужно - хватит описания.",
                   "en": "No photo needed - a description is enough."},
    "фото.один":  {"ru": "Нужен <b>один</b> снимок.",
                   "en": "One photo needed."},
    # --- ФИГУРА ---
    #
    # Читать сложение со снимка машиной не вышло: CLIP на проверке
    # 22.09.2026 отвечал «маленькая» на что угодно, разброс 0.58-0.83 и
    # никакой связи с тем, что на фото. Значит, выбирает человек.
    "фиг.кнопка":   {"ru": "Фигура: {что}", "en": "Figure: {что}"},
    "фиг.как_на_фото": {"ru": "Как на фото",
                        "en": "As in the photo"},
    "фиг.стройная": {"ru": "Стройная, маленькая грудь",
                     "en": "Slim, small breasts"},
    "фиг.средняя":  {"ru": "Обычная, средняя грудь",
                     "en": "Average, medium breasts"},
    "фиг.пышная":   {"ru": "Пышная, большая грудь",
                     "en": "Full figured, large breasts"},
    "фиг.заголовок": {
        "ru": "<b>Фигура на результате</b>\n\nБери ту, что на твоём снимке. "
              "Не выберешь - сделаю стройную: ошибается модель всегда в "
              "большую сторону, и лишнюю грудь дорисовать проще, чем убрать.",
        "en": "<b>The figure in the result</b>\n\nPick the one in your photo. "
              "If you skip it I use slim: the model always errs on the big "
              "side, and adding is easier than taking away.",
    },
    "фиг.сменено": {"ru": "Фигура: {что}", "en": "Figure: {что}"},

    "фото.порядок_мж": {
        "ru": "Порядок важен: <b>первым пришли мужчину</b>, вторым - женщину.",
        "en": "The order matters: <b>send the man first</b>, the woman second.",
    },
    "фото.порядок_равный": {
        "ru": "Порядок любой - в кадре оба будут на своих местах.",
        "en": "Any order - both will be placed correctly.",
    },
    "фото.пара": {
        "ru": "Нужны <b>два</b> снимка - по одному на человека. "
              "Первым пришли того, кто в сценарии первый.",
        "en": "Two photos needed - one per person. Send the one who comes "
              "first in the scenario first.",
    },
    "фото.видео": {
        "ru": "Нужен <b>один</b> снимок - с него возьмём героиню. "
              "Можно прислать <b>второй</b> ракурс: лицо выйдет точнее.",
        "en": "One photo needed - we take her from it. You may send a "
              "<b>second</b> angle: the face comes out more accurate.",
    },
    "фото.до_трёх": {
        "ru": "Можно прислать до <b>{макс}</b> снимков: чем больше "
              "ракурсов, тем точнее лицо. Хватит и одного.",
        "en": "You may send up to <b>{макс}</b> photos: more angles, more "
              "accurate face. One is enough too.",
    },
    "фото.пришли":  {"ru": "Пришли фото.", "en": "Send the photo."},
    "фото.принято": {"ru": "Принято снимков: <b>{есть}</b> из {всего}.",
                     "en": "Photos received: <b>{есть}</b> of {всего}."},
    "фото.ещё_нужен": {
        "ru": "Нужен ещё {сколько} - второй человек берётся со своего снимка.",
        "en": "{сколько} more needed - the second person comes from their own photo.",
    },
    "фото.можно_ещё": {
        "ru": "Можно добавить ещё {сколько} - или жми «Хватит, поехали».",
        "en": "You may add {сколько} more - or press “That's enough, go”.",
    },
    "фото.хватит": {"ru": "Больше модель не возьмёт. Запускаю?",
                    "en": "The model will not take more. Shall I start?"},
    "фото.перебор": {"ru": "Больше {макс} модель не возьмёт.",
                     "en": "The model will not take more than {макс}."},
    "фото.не_забрала": {"ru": "Не смогла забрать фото, пришли ещё раз.",
                        "en": "Could not fetch the photo, send it again."},
    "фото.не_приняла": {"ru": "Не приняла фото: {почему}",
                        "en": "Photo rejected: {почему}"},
    "фото.сколько_нести": {"ru": "Нужно снимков: {сколько}",
                           "en": "Photos needed: {сколько}"},
    "фото.теперь_текст": {
        "ru": "Снимков принято: {сколько}. Теперь напиши, что с ними "
              "сделать - <b>по-английски</b>.",
        "en": "Photos received: {сколько}. Now write what to do with "
              "them - <b>in English</b>.",
    },
    "фото.убрала": {"ru": "Убрала", "en": "Removed"},

    # --- свой промпт ---
    "свой.заголовок": {"ru": "<b>Свой промпт · {что}</b>",
                       "en": "<b>Your own prompt · {что}</b>"},
    "свой.цена":      {"ru": "{цена} за работу.", "en": "{цена} per job."},
    "свой.один_кадр": {"ru": "Нужен <b>один</b> снимок - с него возьмём героиню.",
                       "en": "One photo needed - we take her from it."},
    "свой.как": {
        "ru": "Сначала фото, потом описание. Описание - <b>по-английски</b>: "
              "модели обучены на нём, русский даёт мусор.",
        "en": "Photo first, then the description. In <b>English</b>: that is "
              "what the models were trained on.",
    },

    # --- генерация ---
    # --- ЭКРАН ОЖИДАНИЯ ---
    #
    # «Считаю фото по фото…» владелец забраковал 21.09.2026, и он прав:
    # это название пункта в прайсе, а не то, чего человек ждёт. Он ждёт,
    # что с его снимка снимут одежду.
    #
    # Строки сменяют друг друга по ходу счёта (`ui.ожидание`). Они не
    # врут: раздевание, лицо, кожа и свет — это ровно то, что собрано в
    # промпте, в этом порядке. Обещать проценты готовности мы не можем —
    # карта их не сообщает, и выдуманная полоска «87 %», застрявшая на
    # минуту, злит сильнее честного «идёт счёт».
    "ген.шаг.раздеваю": {"ru": "Раздеваю твоё фото…",
                         "en": "Taking the clothes off your photo…"},
    "ген.шаг.лицо":     {"ru": "Слежу, чтобы лицо осталось твоим…",
                         "en": "Making sure the face stays yours…"},
    "ген.шаг.тело":     {"ru": "Сверяю фигуру и кожу с референсом…",
                         "en": "Matching the figure and the skin to the reference…"},
    "ген.шаг.свет":     {"ru": "Довожу свет и тени…",
                         "en": "Settling the light and the shadows…"},
    "ген.шаг.почти":    {"ru": "Почти готово…", "en": "Almost there…"},
    "ген.шаг.кадр":     {"ru": "Готовлю первый кадр…",
                         "en": "Preparing the first frame…"},
    "ген.шаг.оживляю":  {"ru": "Оживляю кадр…", "en": "Bringing the frame to life…"},
    "ген.шаг.движение": {"ru": "Ставлю дыхание и движение…",
                         "en": "Adding the breathing and the motion…"},
    "ген.шаг.склейка":  {"ru": "Собираю ролик…", "en": "Assembling the clip…"},
    "ген.секунд":       {"ru": "{сек} с", "en": "{сек} s"},
    "ген.кадр_готов":   {"ru": "Кадр готов. Оживляю…",
                         "en": "Frame ready. Bringing it to life…"},
    "ген.подпись":     {"ru": "{что} · {сек} с · осталось {баланс}",
                        "en": "{что} · {сек} s · {баланс} left"},
    # КАРТА ПРОСЫПАЕТСЯ. Человеку говорим правду и говорим коротко.
    #
    # Соблазн написать «идёт подготовка» велик, но первый за вечер
    # заказчик ждёт минуты, а не секунды, и молчаливая полоска читается
    # как поломка. Поэтому называем срок вслух и показываем счётчик.
    "ген.бужу": {
        "ru": "Включаю видеокарту. Она выключается, когда никто не "
              "работает, поэтому первый запуск за вечер занимает пару "
              "минут. Коины пока не списаны.",
        "en": "Starting the graphics card. It shuts down when nobody is "
              "working, so the first run of the evening takes a couple of "
              "minutes. No coins spent yet.",
    },
    "ген.бужу_идёт": {
        "ru": "Включаю видеокарту… {сек} с",
        "en": "Starting the graphics card… {сек}s",
    },
    "ген.карта_не_встала": {
        "ru": "Сейчас нет свободной видеокарты. Такое бывает в часы "
              "нагрузки. Коины не списаны, попробуй через десять минут.",
        "en": "No free graphics card right now. It happens at peak hours. "
              "No coins spent, try again in ten minutes.",
    },
    "ген.карта_сломалась": {
        "ru": "Не получилось включить видеокарту. Коины не списаны, мы "
              "уже смотрим, в чём дело.",
        "en": "Could not start the graphics card. No coins spent, we are "
              "already looking into it.",
    },
    "ген.занято": {
        "ru": "Одно задание уже считается. Дождись его, потом запускай следующее.",
        "en": "One job is already running. Wait for it, then start the next.",
    },
    "ген.не_хватает": {
        "ru": "Не хватает коинов: нужно <b>{нужно}</b>, есть <b>{есть}</b>.",
        "en": "Not enough coins: <b>{нужно}</b> needed, <b>{есть}</b> available.",
    },
    "ген.осечка": {
        "ru": "Не получилось: {почему}\n\nКоины вернула - <b>{баланс}</b>.",
        "en": "It did not work out: {почему}\n\nCoins refunded - <b>{баланс}</b>.",
    },
    "ген.сломалось": {
        "ru": "Что-то сломалось у меня. Коины вернула - <b>{баланс}</b>.",
        "en": "Something broke on my side. Coins refunded - <b>{баланс}</b>.",
    },
    "ген.кадр_не_ушёл": {"ru": "Не смогла отправить кадр на карту: {почему}",
                         "en": "Could not send the frame to the card: {почему}"},

    # --- мои работы ---
    "раб.пусто":  {"ru": "Работ пока нет. Сделаем первую?",
                   "en": "No works yet. Shall we make the first one?"},
    "раб.список": {"ru": "<b>Твои работы</b> - последние {сколько}",
                   "en": "<b>Your works</b> - the last {сколько}"},
    "раб.нет_файла": {"ru": "· {что} - файл не сохранился, показать нечем.",
                      "en": "· {что} - the file is gone, nothing to show."},
    "раб.не_найдена": {"ru": "Эта работа не найдена.", "en": "That work was not found."},
    "раб.нечем_оживить": {
        "ru": "Файл не сохранился, оживить нечем. Сделай кадр заново.",
        "en": "The file is gone, nothing to animate. Make the frame again.",
    },

    # --- кабинет ---
    "каб.заголовок": {"ru": "<b>Личный кабинет</b>", "en": "<b>Your account</b>"},
    "каб.сделано": {"ru": "Сделано работ: <b>{сколько}</b>",
                    "en": "Works made: <b>{сколько}</b>"},
    "каб.осечек": {"ru": ", осечек {сколько} - коины за них вернулись",
                   "en": ", {сколько} misfires - those coins came back"},
    "каб.потрачено": {"ru": "Потрачено: <b>{потрачено}</b> {символ}, куплено: <b>{куплено}</b> {символ}",
                      "en": "Spent: <b>{потрачено}</b> {символ}, bought: <b>{куплено}</b> {символ}"},
    "каб.друзья": {
        "ru": "Приведено друзей: <b>{сколько}</b>, заработано <b>{коинов}</b> {символ}",
        "en": "Friends brought: <b>{сколько}</b>, earned <b>{коинов}</b> {символ}",
    },
    "каб.зови": {
        "ru": "Зови друзей: <code>{ссылка}</code>\nЗа каждого - <b>{ему}</b> {символ}, "
              "ему самому - <b>{другу}</b>.",
        "en": "Invite friends: <code>{ссылка}</code>\nFor each one - <b>{ему}</b> {символ}, "
              "and <b>{другу}</b> for them.",
    },
    "кн.позвать":   {"ru": "Отправить другу", "en": "Send to a friend"},
    "кн.ещё_друзья": {"ru": "Позвать друзей - бесплатно",
                      "en": "Invite friends - free"},

    # Текст приглашения. Уходит В ЧУЖОЙ ЧАТ, поэтому написан от лица
    # человека, а не бота: «я нашёл», а не «мы предлагаем». Приглашение
    # от рекламы отличается ровно этим.
    "пригл.заголовок": {
        "ru": "<b>Позови друзей</b>",
        "en": "<b>Invite your friends</b>",
    },
    "пригл.как": {
        "ru": "Жми кнопку, выбери кому - текст и ссылка подставятся сами.\n"
              "За каждого, кто придёт: тебе <b>{ему}</b>, ему <b>{другу}</b>.",
        "en": "Tap the button, pick a chat - the text and the link fill "
              "themselves in.\nFor everyone who joins: <b>{ему}</b> for you, "
              "<b>{другу}</b> for them.",
    },
    "пригл.текст": {
        "ru": "Нашёл бота, который делает из обычного фото то, что обычно "
              "не показывают. Присылаешь снимок - получаешь другой: другая "
              "поза, другой фон, без одежды. Или ролик.\n\n"
              "Лицо и фигура остаются ровно те же, это главное.\n\n"
              "По моей ссылке дают {другу} на пробу: {ссылка}",
        "en": "Found a bot that turns an ordinary photo into the kind you "
              "do not usually get shown. Send a shot - get another one: "
              "different pose, different background, no clothes. Or a clip."
              "\n\nThe face and the figure stay exactly the same, that is "
              "the point.\n\nMy link gives you {другу} to try: {ссылка}",
    },
    "пригл.ссылка_моя": {"ru": "Твоя ссылка: <code>{ссылка}</code>",
                         "en": "Your link: <code>{ссылка}</code>"},

    "каб.пришёл_друг": {"ru": "По твоей ссылке пришёл человек. +{сколько} {символ}.",
                        "en": "Someone came through your link. +{сколько} {символ}."},
    "каб.язык_сменён": {"ru": "Язык интерфейса: русский.",
                        "en": "Interface language: English."},

    # --- удаление ---
    "уд.заголовок": {"ru": "<b>Удалить мои данные</b>", "en": "<b>Delete my data</b>"},
    "уд.что_сотрётся": {
        "ru": "Сотрутся: работ - <b>{работ}</b>, записей о коинах - <b>{записей}</b>, "
              "баланс, история, приглашения.",
        "en": "This erases: works - <b>{работ}</b>, coin records - <b>{записей}</b>, "
              "balance, history, invitations.",
    },
    "уд.необратимо": {
        "ru": "<b>Вернуть будет нельзя.</b> Непотраченные коины сгорят: "
              "деньги за них возвращает владелец руками, напиши ему до, а не после.",
        "en": "<b>This cannot be undone.</b> Unspent coins are lost: refunds are "
              "made by hand, so write before, not after.",
    },
    "уд.готово": {
        "ru": "Удалено: работ - <b>{работ}</b>, записей - <b>{записей}</b>.\n"
              "Файлы работ стёрты с диска.\n\n<i>/start заведёт всё заново, с нуля.</i>",
        "en": "Deleted: works - <b>{работ}</b>, records - <b>{записей}</b>.\n"
              "The files are wiped from disk.\n\n<i>/start starts it all over.</i>",
    },

    # --- деньги ---
    "оп.коины":   {"ru": "<b>Коины</b>", "en": "<b>Coins</b>"},
    "оп.сколько_стоит": {"ru": "<b>Сколько стоит</b>", "en": "<b>What it costs</b>"},
    "оп.строка_вида": {"ru": "{что} - <b>{цена}</b> {символ}",
                       "en": "{что} - <b>{цена}</b> {символ}"},
    "оп.строка_вида_нота": {"ru": "{что} - <b>{цена}</b> {символ} · {нота}",
                            "en": "{что} - <b>{цена}</b> {символ} · {нота}"},
    "оп.одна_цена": {
        "ru": "Одна цена за работу. Разрешение поднимаем всем и всегда - "
              "доплат за качество нет.",
        "en": "One price per job. We upscale for everyone, always - no quality "
              "surcharges.",
    },
    "оп.подписки_нет": {
        "ru": "<b>Подписки нет.</b> Платишь только за то, что сделал: ни "
              "абонентской платы, ни сгорающих остатков, ни функций за замком.",
        "en": "<b>No subscription.</b> You pay only for what you make: no monthly "
              "fee, no expiring balance, no features behind a lock.",
    },
    "оп.пакеты": {"ru": "<b>Пакеты</b> - не сгорают никогда. Чем больше, "
                        "тем дешевле коин.",
                  "en": "<b>Packs</b> - they never expire. The bigger, the "
                        "cheaper the coin."},
    "оп.пакет_строка": {"ru": "{коинов} {символ} - <b>{рублей} ₽</b>   <s>{рынок} ₽ у других</s>",
                        "en": "{коинов} {символ} - <b>{рублей} ₽</b>   <s>{рынок} ₽ elsewhere</s>"},
    "оп.вилка": {"ru": "<i>Коин стоит от {дешевле} до {дороже} ₽ - смотря какой пакет.</i>",
                 "en": "<i>A coin costs from {дешевле} to {дороже} ₽ - depending on the pack.</i>"},
    "оп.пакет_кнопка": {"ru": "{коинов} - {рублей} ₽", "en": "{коинов} - {рублей} ₽"},
    "оп.пакет_кнопка_скидка": {"ru": "{коинов} - {рублей} ₽ · -{скидка}%",
                               "en": "{коинов} - {рублей} ₽ · -{скидка}%"},
    "оп.пакет_заголовок": {"ru": "<b>{коинов} коинов</b> за <b>{рублей} ₽</b>",
                           "en": "<b>{коинов} coins</b> for <b>{рублей} ₽</b>"},
    "оп.у_других": {"ru": "<s>{рынок} ₽ у других</s>", "en": "<s>{рынок} ₽ elsewhere</s>"},
    "оп.не_сгорают": {"ru": "Не сгорают никогда.", "en": "They never expire."},
    "оп.способы": {"ru": "Звёздами - {звёзд} ★, криптой - по курсу.",
                   "en": "Stars - {звёзд} ★, crypto - at the going rate."},
    "оп.крипта_нет": {"ru": "Крипта пока недоступна", "en": "Crypto is unavailable"},
    "оп.крипта_не_настроена": {
        "ru": "Оплата криптой не настроена: {почему}\n\nПока можно оплатить звёздами.",
        "en": "Crypto payment is not set up: {почему}\n\nStars work for now.",
    },
    "оп.счёт": {"ru": "Счёт на <b>${сумма}</b> создан. Живёт час.",
                "en": "An invoice for <b>${сумма}</b> is ready. It lives for an hour."},
    "оп.не_проверила": {"ru": "Не смогла проверить", "en": "Could not check"},
    "оп.ещё_не_пришла": {"ru": "Оплата ещё не пришла", "en": "Payment has not arrived yet"},
    "оп.счёт_истёк": {"ru": "Счёт истёк", "en": "The invoice expired"},
    "оп.зачислено": {"ru": "Зачислено", "en": "Credited"},
    "оп.уже_зачислено": {"ru": "Уже зачислено раньше", "en": "Already credited earlier"},
    "оп.пришла": {"ru": "Оплата пришла. Баланс: <b>{баланс}</b>",
                  "en": "Payment received. Balance: <b>{баланс}</b>"},
    "оп.спасибо": {"ru": "Спасибо. Зачислено <b>{сколько}</b>.\nБаланс: <b>{баланс}</b>",
                   "en": "Thank you. Credited <b>{сколько}</b>.\nBalance: <b>{баланс}</b>"},
    "оп.пакет_не_узнан": {
        "ru": "Оплата прошла, но я не поняла, какой пакет. Напиши в поддержку - "
              "разберёмся руками, деньги не пропадут.",
        "en": "The payment went through but I could not tell which pack it was. "
              "Write to support - we will sort it out by hand, the money is safe.",
    },
}
