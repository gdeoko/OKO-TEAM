# -*- coding: utf-8 -*-
"""Звуковой банк сайта Rocket VPN. Снимается на ElevenLabs слоями.

ПОЧЕМУ БАНК, А НЕ СИНТЕЗ. Первая сборка звука была синтезированной:
осцилляторы, фильтры, ноль веса. Она честно вела фильм за прокруткой, но
звучала синтезатором, а не миром. Сайт продаёт защиту, и защита не может
звучать дёшево.

ЧТО ОСТАЛОСЬ ОТ СИНТЕЗА. Главное: звук ЕДЕТ за долей хода, а не
проигрывается кусками. Подложки идут петлями и перетекают одна в другую
по той же величине --д, что двигает картинку. Удары зовутся по месту в
акте. Прокрутка вверх звучит обратным ходом, а не повтором.

ПОЧЕМУ СЛОЯМИ, А НЕ ОДНИМ ПРОМПТОМ. У ElevenLabs жёсткий потолок промпта
в 450 знаков - проверено ответом сервера, обойти его нечем: длиннее не
принимает ни v1, ни v2. Полный разбор звука на полторы-две тысячи знаков
в этот потолок не влезает НИКОГДА.

Выход тот же, каким это делают в студии: звук не пишется одним дублем.
Он собирается из слоёв, и у каждого слоя своя задача - пол, тело,
материал, воздух, хвост. Один слой это одна мысль, и на одну мысль 450
знаков хватает с запасом. Дальше слои сводятся в ffmpeg с раздельной
громкостью, сдвигом и фильтром.

Это не обход ограничения, а лучший звук: слой, снятый прицельно,
попадает в задачу, а общий промпт всегда даёт усреднённое.

БРИФ. Полный разбор каждого звука лежит здесь же, в БРИФ. Он не уходит в
API и нужен людям: по нему видно, из чего звук собран и почему слои
именно такие. Меняешь звук - меняй сначала бриф.

Запуск на VPS:  bash тянуть.sh              # весь банк
                bash тянуть.sh impact gate  # только названные
                bash свести.sh              # сведение слоёв и замеры
"""
import json, os, subprocess, sys, time

КОРЕНЬ = os.path.dirname(os.path.abspath(__file__))
СЛОИ_ПУТЬ = os.path.join(КОРЕНЬ, "слои")
СОКС = os.environ.get("ELEVEN_SOCKS", "127.0.0.1:10840")
КЛЮЧ = os.environ.get("ELEVEN_KEY", "")

# ── Общий хвост промпта ────────────────────────────────────────
# Короткий: он съедает те же 450 знаков, что и полезное описание. Здесь
# только то, без чего модель портит дубль - подложка и голос.
ХВОСТ = " Clean, no music, no melody, no voice, no speech."

# ══════════════════════════════════════════════════════════════
# БРИФ: полный разбор звука. В API не уходит.
# ══════════════════════════════════════════════════════════════
БРИФ = {

"bed-net": """Подложка первого акта: открытая сеть.
Звук огромного объёма данных, идущего по чужой инфраструктуре. Четыре
слоя, и ни один не должен собраться в аккорд.
  ПОЛ - глубокий широкий электрический гул 48-60 Гц, серверный зал через
  бетонную стену, с очень медленным дрейфом громкости, чтобы ухо не
  зацепилось за постоянный тон.
  ТРАФИК - мелкая зернистая текстура из тиков и микрощелчков, десятки в
  секунду, неровно и без ритма: счётчики пакетов на множестве машин.
  Далеко в глубине, никогда не резко.
  ВОЗДУХ - холодное движение воздуха, давление вентиляции в комнате без
  окон, срезано выше 8 кГц, чтобы читалось расстоянием, а не шипением.
Итог: холодно, безразлично, огромно. Система работает вне зависимости от
того, смотрит на неё кто-нибудь или нет. Никакого нарастания к концу:
приезда здесь нет, есть состояние.""",

"bed-wall": """Подложка второго акта: стена блокпоста.
Тот же мир, что и в сети, но тяжелее, ближе и враждебнее. Стена стоит в
нескольких метрах от человека.
  ПОЛ - плотный дрон 38-46 Гц с медленными биениями между двумя
  расстроенными составляющими: очень большое оборудование под нагрузкой,
  давит на грудь, а не на уши.
  ДОСМОТР - медленный электромагнитный импульс раз в две-три секунды,
  глухой, скорее ощущаемый: что-то сканирует всё, что проходит мимо.
  МЕТАЛЛ - редкие отражения от твёрдых поверхностей, тики и щелчки реле
  с короткой бетонной пощёчиной эха, неровно по времени.
Итог: гнетуще, терпеливо, без единой тёплой ноты. Ниже и громче по низу,
чем подложка сети, потому что стена ближе. Напряжение держится ровно и
НЕ разрешается: разрешит его тишина в четвёртом акте.""",

"bed-shell": """Подложка третьего акта: оболочка.
Человек теперь ВНУТРИ защищённого канала, поэтому враждебный мир слышно,
но приглушённо, как через толстый корпус под давлением.
  КОМНАТА - тёплый ровный тон около 55 Гц, круглее и мягче заводского
  гула: спокойствие закрытого объёма с хорошей изоляцией.
  СНАРУЖИ - внешний мир, срезанный низким фильтром до давления и
  невнятного движения: ухо понимает, что там что-то происходит, и не
  может разобрать, что именно.
  ОБОЛОЧКА - очень тихое стеклянное мерцание в верхах, чистое и
  устойчивое, плюс редкий сухой электронный тик раз в три-четыре
  секунды: техника подтверждает сама себе, что всё держится.
Итог: облегчение без торжества. Тише и просторнее, чем блокпост, но всё
ещё техническое пространство, а не уютная комната.""",

"bed-tunnel": """Подложка после прокола: тоннель.
Огромная скорость, которая УЖЕ набрана и теперь держится. Слышно изнутри
аппарата.
  ПОТОК - широкий плотный воздушный ход, ближе к аэродинамической трубе,
  чем к погоде, энергия в нижней середине: движется масса, а не шипение.
  ТЯГА - ровный низкий рокот 40-70 Гц, мощный, с лёгкой медленной
  волной: коридор не идеально прямой.
  СТЕНЫ - длинные металлические доплеровские росчерки, каждый входит и
  уходит за одну-две секунды, неровно по времени и высоте, ритма не
  образуют: конструкции летят мимо быстрее, чем глаз их разбирает.
Итог: восторг, чистота, движение вперёд, дорого. Не хаос, не паника.
Ничего похожего на взрыв или тревогу. Громкость ровная по всей длине,
чтобы подложку можно было свободно перетекать.""",

"bed-open": """Подложка пятого акта: точка выхода.
Приход куда-то открытое и спокойное после тяжёлой дороги. Сцена
разрядки, поэтому заметно шире, выше и пустее всего, что было раньше.
  ПРОСТРАНСТВО - огромная тихая низкая открытость, скорее ощущаемая, чем
  слышимая, почти без механической фактуры: большой объём воздуха и
  расстояние во все стороны.
  СВЕТ - мягкое медленное воздушное мерцание в верхней середине и
  верхах, стеклянное, неспешное, живёт восемь-десять секунд, но никогда
  не становится аккордом.
  ТЕХНИКА - очень редкие далёкие чистые сигналы, один мягкий блик раз в
  три-пять секунд, спокойные: инфраструктура работает правильно и тихо.
Итог: облегчение, простор, компетентность, безопасность. Никакой
тревоги, никакого напряжения, ничего живого и природного.""",

"bed-bridge": """Подложка шестого акта: шлюзовая рубка.
Небольшое техническое помещение, где подключают устройства и разводят
трафик. Теплее серверного зала, чище промышленной площадки.
  ОБОРУДОВАНИЕ - устойчивый близкий электрический гул 60-80 Гц с
  небольшим гармоническим телом: хорошо сделанная техника работает без
  натуги, рядом с человеком, а не за стеной. Плюс ровный проток
  охлаждения без турбулентности и свиста.
  ПУЛЬТ - редкая работа консоли: сухие щелчки переключателей, мягкие
  срабатывания реле, аккуратные цифровые подтверждения, примерно одно
  событие в две секунды, каждое короткое и точное, ритма не образуют.
Итог: собранно, спокойно, дорого. Место, где кто-то компетентный держит
всё под рукой. Ни тревоги, ни спешки, ни перегруза.""",

"sweep": """Проход луча досмотра по стене и по человеку.
Одно движение слева направо, три части.
  ПОДХОД - узкая полоса фильтрованного шума приходит издалека, её центр
  плавно ползёт вверх, набирает присутствие и фокус, с электромагнитной
  кромкой: это машина ЧИТАЕТ, а не свет светит.
  ПРОХОД - в ближайшей точке полоса стягивается в жёсткий резонансный
  пик, коротко агрессивный и металлический, вместе с плотным всплеском
  зернистой цифровой фактуры (за раз считывается огромный объём) и
  небольшим толчком давления, когда луч пересекает человека.
  УХОД - полоса раскрывается обратно, теряет фокус и уходит с холодным
  металлическим звоном.
Итог: бесцеремонно и безлично, как досмотр техникой, которой всё равно,
кто ты. Янтарная тревожная кромка в районе 2-3 кГц: хочется, чтобы это
закончилось. Сухо и близко, длинного зала нет.""",

"shell-seal": """Смыкание оболочки вокруг соединения.
Две половины энергетического конверта сходятся и запечатываются, после
чего внешний мир проваливается.
  СХОД - короткое воздушное сближение, два тонких потока идут навстречу
  за четверть секунды, чуть повышаясь, чисто и стеклянно.
  ЗАМОК - одно решительное касание: точная механическая защёлка с
  настоящим телом, мягкое пневматическое поджатие и короткий яркий
  гармонический расцвет, подтверждающий целость конверта. Должно
  ощущаться дорого и инженерно, как деталь, севшая в посадочное место.
  ПОСЛЕДСТВИЕ (главное) - сразу после замка среда СЛЫШИМО закрывается:
  верхи схлопываются, будто между человеком и миром встал толстый
  корпус, остаётся тёплый глухой внутренний тон.
Итог: около двух секунд, сухо, близко, современно.""",

"pull": """Вытяжка воздуха перед ударом.
То, чем кино готовит большой удар. Работает как ВДОХ фильма, а не как
самостоятельное событие.
  ХОД - начинается уже в движении, обратный жест: энергия втягивается
  внутрь и вверх, сначала уходит низ, потом середина, потом верхи, будто
  окружающую среду засасывает в одну точку впереди. Тихое спиральное
  напряжение без фиксированной высоты и без мелодии, тонкое ощущение,
  что вместе с воздухом тянет и материал.
  КОНЕЦ - последние двести миллисекунд обязаны прийти в НАСТОЯЩУЮ
  тишину: жёсткий осознанный обрыв, без хвоста, без звона, без реверба,
  без остаточного шипения. Ради этой тишины файл и существует.
Удара в конце быть НЕ ДОЛЖНО: удар отдельным файлом, и предвосхищать его
здесь нельзя.""",

"impact": """Удар прокола. Подпись всего фильма.
Аппарат проходит сквозь ткань пространства, а не в обход. Самый низкий,
громкий и физический звук сайта, при этом чистый и управляемый. Четыре
составляющие почти без сдвига по времени.
  ТРЕСК - очень быстрый плотный переходный фронт давления, 3-5 мс,
  яркий, но не тонкий: разрыв давления, а не выстрел.
  ТЕЛО - глубокий суббасовый спуск от ~100 Гц ниже 30 за семьсот
  миллисекунд, огромный, круглый, без коробочной середины.
  МАТЕРИАЛ - короткий яростный срез металла и конструкции под нагрузкой,
  плотный, обрублен быстро, чтобы не превратиться в грохот обломков.
  ХВОСТ - долгий затухающий рокот с быстрым раскрытием реверба и тонким
  ионизированным мерцанием в верхах: проход открылся.
Итог: мощь и размах, дорого и кинематографично, но не грязно. Обязан
жить на телефонном динамике, поэтому энергия нужна и в 80-200 Гц.""",

"pick": """Выбор точки выхода. Маршрут назначен.
Три плотно сложенных составляющих внутри секунды.
  КАСАНИЕ - очень короткое сухое механическое срабатывание с настоящим
  телом, близкий микрофон, точное: ощущение хорошо сделанного органа
  управления, который стоит денег, а не мягкий интерфейсный блик.
  ПОДТВЕРЖДЕНИЕ - два чистых тона, второй чуть выше первого, яркие,
  стеклянные, без вибрато, разнесены на восемьдесят миллисекунд: ухо
  слышит намерение, а не мелодию.
  ОСАДКА - короткое тёплое гармоническое мерцание, раскрывается наружу и
  чисто затухает за полсекунды, плюс тихий низкий толчок под ним,
  который даёт действию вес и закрывает его.
Итог: решительно, спокойно, дорого. Выбор сделан и он будет держаться.
Никакой фанфары и никакой награды из игры.""",

"dock": """Стыковка устройства в шлюзовой рубке.
Железо приходит, садится и фиксируется. Четыре стадии внутри двух секунд.
  ПОСАДКА - короткий управляемый вход детали в гнездо, с настоящим весом
  материала и небольшим трением поверхности, без дребезга и люфта.
  ДАВЛЕНИЕ - компактный пневматический выпуск за двести миллисекунд,
  когда берётся уплотнение: сухо и плотно, не паровозный выхлоп.
  ЗАМОК - твёрдый механический захват, один решительный металлический
  стук с настоящей массой, близкий микрофон: инженерный металл принял
  нагрузку. Сразу за ним короткий щелчок подпружиненного фиксатора.
  ОТВЕТ - один чистый электронный сигнал подтверждения, сдержанный,
  тихий: соединение зарегистрировано.
Итог: тяжело, точно, надёжно. Техника, сделанная на годы ежедневной
работы. Сухо и близко, длинного зала нет.""",

"gate": """Ворота в соседний космос Rocket CDN.
Большие ворота открываются в нескольких метрах от человека, и через них
натекает другая атмосфера. Три движения за три секунды.
  РАССТОПОРКА - низкое механическое расцепление с настоящей массой,
  несколько крупных фиксаторов расходятся почти, но не совсем
  одновременно, следом глубокое выравнивание давления.
  ХОД - тяжёлое движение: огромные панели разъезжаются по направляющим,
  ровный низкий скрежет под нагрузкой, конструкционный рокот снизу и
  редкие металлические тики напряжения. Неспешно и уверенно: чувствуется
  размер и управляемая сила.
  РАСКРЫТИЕ - в расширяющийся проём вливается яркий воздушный поток
  новой атмосферы, холоднее и чище прежней, с далёким мерцанием
  открытого пространства за ним.
Итог: приглашение, а не угроза. Большое решило тебя пропустить.""",

"tap": """Касание органа управления на сайте.
Очень коротко, около двухсот пятидесяти миллисекунд, и ни в коем случае
не дежурный интерфейсный щелчок.
  МЕХАНИЗМ - маленький сухой тактильный щелчок с настоящим механическим
  телом, записан близко, с крошечным резонансом фрезерованного
  металлического корпуса: ближе к авиационному тумблеру, чем к клавише.
  ЭЛЕКТРОНИКА - мгновенное очень тихое синтетическое подтверждение,
  тонкий чистый фронт с намёком на гармонический блеск, ПОД механизмом,
  а не рядом с ним.
  ХВОСТ - очень короткое яркое затухание около восьмидесяти
  миллисекунд, чисто в тишину.
Итог: дорого, тихо, уверенно. То, что можно услышать сто раз за сеанс и
не начать раздражаться.""",

"hover": """Наведение внимания на элемент, до нажатия.
Едва различимо, скорее изменение воздуха, чем событие, и никогда не
спорит с подложкой под собой. Два слоя внутри двухсот миллисекунд.
  ВОЗДУХ - очень мягкое короткое воздушное мерцание с лёгким движением
  вверх, стеклянное и чистое, без выраженного центра высоты и без
  мелодии: будто тонкая поверхность слегка зарядилась.
  БЛИК - один крошечный высокий колокольный обертон, очень тихий,
  появляется и почти сразу гаснет, даёт точку фокуса, но не даёт ноты.
Итог: утончённо и почти подсознательно. Такую деталь замечают только
тогда, когда её убрали. Энергия выше 2 кГц, чтобы ничего не забивать.""",
}

# ══════════════════════════════════════════════════════════════
# СЛОИ: то, что реально уходит в API. Каждый промпт до 450 знаков.
# (имя_слоя, секунды, петля, влияние, промпт)
# Сведение: (громкость, сдвиг_сек, фильтр_ffmpeg или "")
# ══════════════════════════════════════════════════════════════
БАНК = {

"bed-net": [
  ("floor", 11.0, True, 0.42,
   "Deep wide electrical hum of a huge server hall heard through a thick concrete "
   "wall, around 50 Hz, steady and patient, very slow amplitude drift so no fixed "
   "tone settles, cold and indifferent, no mechanical detail, seamless loop",
   1.00, 0.0, ""),
  ("data", 11.0, True, 0.45,
   "Fine granular texture of tiny high frequency data ticks and micro clicks, dozens "
   "per second, irregular and non rhythmic, packet counters advancing on many "
   "machines at once, far back and airy, never sharp, seamless loop",
   0.34, 0.0, "highpass=f=900,lowpass=f=11000"),
  ("air", 11.0, True, 0.40,
   "Cold filtered air movement, the pressure of ventilation in a large windowless "
   "room, broadband but rolled off in the highs so it reads as distance rather than "
   "hiss, calm and even, seamless loop",
   0.42, 0.0, "lowpass=f=7000"),
],

"bed-wall": [
  ("floor", 11.0, True, 0.46,
   "Dense low frequency drone around 42 Hz with slow beating between two detuned "
   "components, very large industrial equipment under continuous load, oppressive, "
   "pressing on the chest, no warmth, seamless loop",
   1.00, 0.0, ""),
  ("scan", 11.0, True, 0.50,
   "Slow dull electromagnetic scanning pulse every two to three seconds, muffled and "
   "felt more than heard, machinery reading everything that passes a checkpoint, "
   "patient and impersonal, seamless loop",
   0.46, 0.0, "lowpass=f=3200"),
  ("metal", 11.0, True, 0.48,
   "Intermittent hard surface reflections in a corridor of hardware: small metallic "
   "ticks and distant relay clacks with a short concrete slap of reverb, irregularly "
   "spaced, sparse, cold, seamless loop",
   0.30, 0.0, "highpass=f=300"),
],

"bed-shell": [
  ("room", 11.0, True, 0.42,
   "Warm smooth low room tone around 55 Hz inside a well insulated pressurised hull, "
   "rounder and calmer than industrial machinery, the quiet of an enclosed volume, "
   "steady and reassuring, seamless loop",
   1.00, 0.0, ""),
  ("outside", 11.0, True, 0.44,
   "The outside world heard through a thick hull: heavy movement and pressure with "
   "all detail stripped away, muffled beyond recognition, something is happening out "
   "there and it cannot be made out, seamless loop",
   0.40, 0.0, "lowpass=f=600"),
  ("skin", 11.0, True, 0.40,
   "Very quiet clean glassy high frequency shimmer of a stable energy field holding "
   "its shape, slow subtle movement with no wobble, plus one small dry electronic "
   "tick every three seconds, seamless loop",
   0.30, 0.0, "highpass=f=1600"),
],

"bed-tunnel": [
  ("flow", 11.0, True, 0.46,
   "Broad dense rushing airflow inside a pressurised wind tunnel at enormous speed, "
   "smooth, energy centred in the low mids so it reads as moving mass rather than "
   "hiss, steady and confident, seamless loop",
   0.85, 0.0, ""),
  ("thrust", 11.0, True, 0.48,
   "Deep sustained thrust rumble between 40 and 70 Hz, powerful and even, with a "
   "slight slow undulation suggesting the corridor is not perfectly straight, "
   "controlled and clean, seamless loop",
   1.00, 0.0, "lowpass=f=260"),
  ("walls", 11.0, True, 0.50,
   "Long metallic doppler streaks passing a listener at extreme speed, each entering "
   "and leaving over one to two seconds, irregular in spacing and pitch, forming no "
   "rhythm, structures flying past, seamless loop",
   0.42, 0.0, "highpass=f=420"),
],

"bed-open": [
  ("space", 11.0, True, 0.40,
   "Vast quiet low frequency openness felt rather than heard, almost no mechanical "
   "texture, a huge volume of clear air and distance in every direction, calm, "
   "spacious and safe, seamless loop",
   1.00, 0.0, ""),
  ("light", 11.0, True, 0.40,
   "Gentle slow moving airy glassy shimmer in the upper mids and highs, smooth and "
   "unhurried, evolving over ten seconds, evoking sunlight on a surface, never "
   "becoming a chord or a pad, seamless loop",
   0.46, 0.0, "highpass=f=900"),
  ("beacons", 11.0, True, 0.44,
   "Very sparse distant clean electronic indications, one soft calm blip every four "
   "seconds, mixed far back with a long open tail, infrastructure working correctly "
   "and quietly, seamless loop",
   0.26, 0.0, ""),
],

"bed-bridge": [
  ("gear", 11.0, True, 0.44,
   "Stable close electrical hum of well built equipment running at ease, around 70 Hz "
   "with a little harmonic body, plus smooth continuous cooling airflow through vents "
   "with no whistling, seamless loop",
   1.00, 0.0, ""),
  ("console", 11.0, True, 0.48,
   "Sparse unhurried console activity: small dry switch actuations, soft relay "
   "engagements and delicate digital confirmations, about one event every two "
   "seconds, precise, forming no pattern, seamless loop",
   0.40, 0.0, "highpass=f=260"),
],

"sweep": [
  ("beam", 2.8, False, 0.52,
   "A narrow band of filtered noise sweeping past a listener: it approaches from a "
   "distance climbing in centre frequency, tightens into a hard resonant metallic "
   "peak at the closest point, then opens out and trails away with a cold metallic "
   "ring, one continuous invasive gesture, dry and close",
   1.00, 0.0, ""),
  ("read", 2.8, False, 0.50,
   "A short dense burst of granular digital data texture, a huge amount of "
   "information being read at once, with a small pressure thump at its centre, "
   "impersonal machine scanning, dry, no reverb tail",
   0.44, 0.25, "highpass=f=500"),
],

"shell-seal": [
  ("latch", 2.4, False, 0.55,
   "Two halves of a machined component meeting and sealing: a fast airy convergence, "
   "then one decisive contact made of a precise mechanical latch with real body, a "
   "soft pneumatic compression and a short bright harmonic bloom, expensive and "
   "engineered, dry and close",
   1.00, 0.0, ""),
  ("close", 2.4, False, 0.48,
   "Ambience audibly closing off as a thick hull comes between listener and world: "
   "high frequencies collapse away leaving a warm muffled interior tone with a very "
   "quiet glassy shimmer holding steady",
   0.62, 0.45, ""),
],

"pull": [
  ("vacuum", 1.8, False, 0.50,
   "Air being pulled out of a scene: a broad reverse gesture drawing energy inward "
   "and upward, low frequencies thinning first then mids then highs, with a quiet "
   "spiralling tension of no fixed pitch, ending in complete hard silence with no "
   "tail and no impact",
   1.00, 0.0, ""),
],

"impact": [
  ("crack", 3.6, False, 0.58,
   "A single very fast tight high energy pressure transient with real air in it, "
   "three to five milliseconds long, bright but not thin, a pressure rupture rather "
   "than a gunshot, followed by nothing",
   0.80, 0.0, "highpass=f=200"),
  ("body", 3.6, False, 0.58,
   "An enormous deep sub bass drop sweeping from about 100 Hz down below 30 Hz over "
   "seven hundred milliseconds, round and controlled with no boxy midrange honk and "
   "no woolly overhang, cinematic weight",
   1.00, 0.0, "lowpass=f=320"),
  ("tail", 3.6, False, 0.55,
   "A short violent shear of metal and structure taking a huge load, cut off quickly, "
   "resolving into a long decaying rumble with a fast opening reverb bloom and a thin "
   "ionised shimmer ringing in the highs",
   0.70, 0.05, ""),
],

"pick": [
  ("touch", 1.3, False, 0.52,
   "A very short dry tactile actuation of a well engineered control with a small "
   "amount of real mechanical body, close microphone, precise and expensive, plus a "
   "quiet low thump underneath giving it weight",
   1.00, 0.0, ""),
  ("confirm", 1.3, False, 0.48,
   "Two clean glassy synthetic confirmation tones, the second slightly higher, "
   "spaced about eighty milliseconds apart, bright with no vibrato, blooming smoothly "
   "and decaying cleanly within half a second, decisive not celebratory",
   0.56, 0.09, ""),
],

"dock": [
  ("seat", 2.2, False, 0.55,
   "A solid component sliding into its housing with real material weight and a little "
   "surface friction, no rattle, followed by a compact dry pneumatic hiss releasing "
   "over two hundred milliseconds as a seal takes",
   1.00, 0.0, ""),
  ("lock", 2.2, False, 0.56,
   "A firm mechanical clamp engaging: one decisive metallic clunk with genuine mass, "
   "close microphone, engineered metal accepting load, followed by a small spring "
   "loaded detent snap and one short quiet electronic acknowledgement",
   0.92, 0.55, ""),
],

"gate": [
  ("unlatch", 3.2, False, 0.52,
   "Low mechanical unlatching with real mass: several large securing elements "
   "disengaging almost but not exactly together, followed by a deep pressure "
   "equalisation as a seal breaks, heavy and unhurried",
   1.00, 0.0, ""),
  ("travel", 3.2, False, 0.52,
   "Enormous panels sliding apart on rails: a sustained heavy movement with a "
   "continuous low grinding load, a smooth structural rumble underneath and "
   "occasional metallic stress ticks, great size under control",
   0.90, 0.55, ""),
  ("open", 3.2, False, 0.48,
   "A bright airy rush of new atmosphere pouring through a widening gap, cooler and "
   "cleaner than the air before it, carrying a distant shimmer of open space beyond "
   "and settling into a wide calm openness",
   0.72, 1.45, "highpass=f=300"),
],

"tap": [
  ("key", 0.6, False, 0.55,
   "One small dry tactile snap of an aerospace grade toggle with a genuine mechanical "
   "body and the tiny resonance of a machined metal housing behind it, close "
   "microphone, precise and firm, decaying in eighty milliseconds, no reverb",
   1.00, 0.0, ""),
],

"hover": [
  ("air", 0.6, False, 0.42,
   "An extremely quiet very short airy glassy shimmer with a gentle upward motion and "
   "no defined pitch centre, plus one tiny high bell overtone appearing and fading "
   "almost immediately, subliminal, energy above 2 kHz, no reverb",
   1.00, 0.0, ""),
],
}


def тело(текст, сек, цикл, влияние):
    д = {"text": текст + ХВОСТ, "duration_seconds": сек, "prompt_influence": влияние}
    if цикл:
        д["loop"] = True
    return json.dumps(д, ensure_ascii=False)


def проверить():
    """Потолок промпта у сервиса 450 знаков. Ловим это ЗДЕСЬ, а не
    четырнадцатью отказами подряд после половины снятого банка."""
    беда = []
    for имя, слои in БАНК.items():
        if имя not in БРИФ:
            беда.append("нет брифа: " + имя)
        for с in слои:
            длина = len(с[4] + ХВОСТ)
            if длина > 450:
                беда.append("%s/%s: промпт %d знаков при потолке 450" % (имя, с[0], длина))
    return беда


def главное():
    беда = проверить()
    if беда:
        for б in беда:
            print("НЕЛЬЗЯ", б)
        sys.exit(2)
    os.makedirs(СЛОИ_ПУТЬ, exist_ok=True)
    только = set(sys.argv[1:])
    отчёт = []
    for имя, слои in БАНК.items():
        if только and имя not in только:
            continue
        for суф, сек, цикл, влияние, текст, _гр, _сдв, _ф in слои:
            файл = имя + "." + суф + ".mp3"
            путь = os.path.join(СЛОИ_ПУТЬ, файл)
            if os.path.exists(путь) and os.path.getsize(путь) > 4000:
                print("уже есть", файл, os.path.getsize(путь), flush=True)
                continue
            тмп = os.path.join(СЛОИ_ПУТЬ, "_тело.json")
            open(тмп, "w", encoding="utf-8").write(тело(текст, сек, цикл, влияние))
            код = subprocess.run(
                ["curl", "-s", "-m", "300", "--socks5-hostname", СОКС, "-X", "POST",
                 "https://api.elevenlabs.io/v1/sound-generation",
                 "-H", "xi-api-key: " + КЛЮЧ, "-H", "Content-Type: application/json",
                 "--data-binary", "@" + тмп, "-o", путь, "-w", "%{http_code}"],
                capture_output=True, text=True).stdout.strip()
            разм = os.path.getsize(путь) if os.path.exists(путь) else 0
            ок = код == "200" and разм > 4000
            print(("готово " if ок else "ОШИБКА "), файл, "HTTP", код, разм, "байт", flush=True)
            if not ок and разм:
                print("   ответ:", open(путь, "rb").read()[:300], flush=True)
                os.remove(путь)
            отчёт.append((файл, ок))
            time.sleep(1.2)
    плохо = [и for и, о in отчёт if not о]
    print("ИТОГ: снято", sum(1 for _, о in отчёт if о), "не вышло", плохо)


if __name__ == "__main__":
    главное()
