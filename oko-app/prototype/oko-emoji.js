/* ============================================================================
   OKO · ЭМОДЗИ, СТИКЕРЫ И GIF У ПОЛЯ ВВОДА          (classic script, не модуль)
   Правка Даниэля 09.08: «клава и смайлики в чатах одновременно не могут быть
   открыты, по высоте одинаково должно быть обе Клавы и со смайлами и с текстом.
   добавить больше настоящих эмодзи стикеров и тд из Телеграм».

   Что делает файл:
   1. ВЗАИМОИСКЛЮЧЕНИЕ. Панель и системная клавиатура никогда не открыты вместе:
      открыли панель — поле ввода теряет фокус (клавиатура уезжает); коснулись
      поля — панель закрывается. Вставка эмодзи НЕ фокусирует поле, поэтому
      клавиатура не выскакивает поверх панели (как в Telegram).
   2. ОДИНАКОВАЯ ВЫСОТА. Высоту системной клавиатуры меряем по
      window.visualViewport (innerHeight − visualViewport.height − offsetTop),
      запоминаем в localStorage и задаём панели ровно её. Пока не измерили —
      разумный дефолт min(46vh, 320px), но не меньше 260px.
      Панель встроена в поток НАД композером, поэтому сам композер при открытии
      и закрытии панели не сдвигается ни на пиксель — «не прыгает».
   3. КОНТЕНТ. Восемь категорий настоящих эмодзи + «Недавние» (копятся реально),
      поиск по русским и английским ключам, горизонтальные вкладки категорий
      (только SVG из спрайта index.html — эмодзи в интерфейсе запрещены),
      бренд-стикеры OKO (лайм на чёрном, знак глаза из мастер-логотипа),
      свои стикеры из файла и честный empty-state на вкладке GIF.
   4. ВЫХОД ОТОВСЮДУ: Escape, системная «назад» (nvPush), тап вне панели,
      повторный тап по кнопке-смайлу.

   Файл перехватывает старую панель chats-plus (#cpPanel / #cpSmile из app.js):
   удаляет её узлы и подменяет глобальные cpBuildPanel / cpOpenPanel /
   cpClosePanel / cpTogglePanel, чтобы вторая панель не плодилась.
   Кнопки #micBtn и #sendBtn (oko-rec.js) не трогаются вообще.
   ========================================================================= */
(function () {
  if (window.__okoEmojiReady) return;
  window.__okoEmojiReady = 1;

  /* ======================================================================
     0. ХРАНИЛИЩЕ
     ==================================================================== */
  var LS_KB   = 'oko-emoji-kbh';     /* измеренная высота клавиатуры, px      */
  var LS_REC  = 'oko-emoji-recent';  /* недавние эмодзи                       */
  var LS_MY   = 'oko-emoji-mystk';   /* свои стикеры (dataURL)                */
  var LS_TAB  = 'oko-emoji-tab';     /* последняя открытая вкладка            */

  function lsGet(k, def) {
    try { var v = localStorage.getItem(k); return v == null ? def : JSON.parse(v); }
    catch (e) { return def; }
  }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }

  /* ======================================================================
     1. ДАННЫЕ ЭМОДЗИ
     Формат строки: «<эмодзи> ключ ключ ключ». Ключи — для поиска (рус + англ).
     ==================================================================== */
  var D_SMILE = `😀 улыбка grin смех
😃 улыбка smile радость
😄 смех happy радость
😁 ухмылка beam зубы
😆 хохот laugh смех
😅 неловко sweat облегчение
🤣 ржу rofl хохот
😂 слёзы joy смех
🙂 улыбка slight
🙃 перевёрнутый upside ирония
😉 подмигивание wink
😊 смущение blush румянец
😇 ангел halo невинность
🥰 влюблён hearts любовь
😍 сердечки heart глаза
🤩 звёзды star восторг
😘 поцелуй kiss
😗 чмок kissing
😚 поцелуй closed
😙 поцелуй smiling
🥲 слеза tear улыбка
😋 вкусно yum язык
😛 язык tongue
😜 дурачусь zany язык
🤪 безумие crazy
😝 язык squint
🤑 деньги money рот
🤗 обнимаю hug объятия
🤭 ой hand ухмылка
🤫 тише shush молчи
🤔 думаю think мысли
🤐 молчу zipper молния
🤨 бровь eyebrow сомнение
😐 нейтрально neutral
😑 без эмоций expressionless
😶 без рта mouthless
😏 хитро smirk
😒 недовольство unamused
🙄 закатил глаза roll
😬 гримаса grimace
🤥 враньё lying нос
😌 облегчение relieved
😔 грусть pensive
😪 сонный sleepy
🤤 слюни drool
😴 сплю sleep zzz
😷 маска mask
🤒 температура sick болезнь
🤕 бинт bandage травма
🤢 тошнит nausea
🤮 рвота vomit
🤧 чихаю sneeze
🥵 жарко hot жара
🥶 холодно cold мороз
🥴 пьяный woozy
😵 обморок dizzy звёзды
🤯 взрыв мозга explode
🤠 ковбой cowboy
🥳 праздник party шляпа
🥸 маскировка disguise усы
😎 крутой cool очки
🤓 ботаник nerd
🧐 монокль monocle
😕 растерян confused
😟 обеспокоен worried
🙁 хмурюсь frown
☹️ грусть frowning
😮 ох open
😯 удивление hushed
😲 шок astonished
😳 покраснел flushed
🥺 умоляю pleading
😦 хмурый frowning
😧 мучение anguished
😨 страх fearful
😰 холодный пот anxious
😥 печаль sad
😢 плачу cry слеза
😭 рыдаю sob
😱 крик scream ужас
😖 мучение confounded
😣 упорство persevere
😞 разочарован disappointed
😓 пот downcast
😩 устал weary
😫 уставший tired
🥱 зевота yawn
😤 пар triumph злость
😡 злой pout ярость
😠 сердитый angry
🤬 ругань curse мат
😈 чертёнок devil злой
👿 чёрт imp
💀 череп skull
☠️ кости crossbones
💩 какашка poop
🤡 клоун clown
👹 огр ogre
👺 гоблин goblin
👻 привидение ghost
👽 инопланетянин alien
👾 монстр invader игра
🤖 робот robot
😺 кот cat улыбка
😸 кот grin
😹 кот joy слёзы
😻 кот love сердечки
😼 кот smirk
😽 кот kiss
🙀 кот weary шок
😿 кот cry
😾 кот pouting
🙈 не вижу see monkey
🙉 не слышу hear monkey
🙊 молчу speak monkey
💋 губы kiss поцелуй
💌 письмо love letter
💘 стрела cupid сердце
💝 подарок сердце gift
💖 сердце sparkle
💗 сердце growing
💓 сердце beating
💞 сердца revolving
💕 два сердца two
💟 сердце decoration
❣️ сердце exclamation
💔 разбитое broken сердце
❤️ красное сердце red love
🧡 оранжевое сердце orange
💛 жёлтое сердце yellow
💚 зелёное сердце green
💙 синее сердце blue
💜 фиолетовое сердце purple
🖤 чёрное сердце black
🤍 белое сердце white
🤎 коричневое сердце brown
👍 класс like палец
👎 не нравится dislike палец
👌 окей ok
✌️ виктория victory peace
🤞 скрещенные fingers crossed
🤟 люблю love you
🤘 рок rock
🤙 звони call
👈 налево left
👉 направо right
👆 вверх up
👇 вниз down
☝️ указатель index
✋ ладонь stop рука
🤚 рука back
🖐️ пальцы splayed
🖖 вулкан vulcan
👋 привет wave пока
🤝 рукопожатие handshake
🙏 спасибо pray молитва
✍️ пишу writing
💅 маникюр nail
🤳 селфи selfie
💪 сила muscle бицепс
🦾 протез mechanical
🦿 нога mechanical
🦵 нога leg
🦶 ступня foot
👂 ухо ear
🦻 слуховой hearing
👃 нос nose
🧠 мозг brain
🫀 сердце anatomical
🫁 лёгкие lungs
🦷 зуб tooth
🦴 кость bone
👀 глаза eyes
👁️ глаз eye
👅 язык tongue
👄 губы lips
👶 малыш baby
🧒 ребёнок child
👦 мальчик boy
👧 девочка girl
🧑 человек person
👨 мужчина man
👩 женщина woman
🧔 борода beard
👱 блондин blond
👴 дедушка old
👵 бабушка old
🙍 хмурится frowning
🙎 дуется pouting
🙅 нет no жест
🙆 да ok жест
💁 подсказка tipping
🙋 руку поднял raising
🧏 глухой deaf
🙇 поклон bow
🤦 фейспалм facepalm
🤷 пожимаю shrug
👮 полицейский police
🕵️ детектив detective
💂 гвардеец guard
👷 строитель worker
🤴 принц prince
👸 принцесса princess
👳 тюрбан turban
👲 шапка cap
🧕 хиджаб headscarf
🤵 смокинг tuxedo
👰 невеста bride
🤰 беременная pregnant
🤱 кормление breast
🎅 дед мороз santa
🤶 миссис клаус claus
🦸 супергерой superhero
🦹 суперзлодей supervillain
🧙 маг mage волшебник
🧚 фея fairy
🧛 вампир vampire
🧜 русалка merperson
🧝 эльф elf
🧞 джинн genie
🧟 зомби zombie
💆 массаж massage
💇 стрижка haircut
🚶 иду walking
🧍 стою standing
🧎 колени kneeling
🏃 бегу running
💃 танцую dancing
🕺 танец dancing
👯 уши кролика bunny
🧖 сауна sauna
👤 силуэт silhouette
👥 силуэты busts
🗣️ говорит speaking
👣 следы footprints`;

  var D_NATURE = `🐶 собака dog пёс
🐱 кошка cat кот
🐭 мышь mouse
🐹 хомяк hamster
🐰 кролик rabbit заяц
🦊 лиса fox
🐻 медведь bear
🐼 панда panda
🐨 коала koala
🐯 тигр tiger
🦁 лев lion
🐮 корова cow
🐷 свинья pig
🐽 пятачок pig нос
🐸 лягушка frog
🐵 обезьяна monkey
🐒 обезьяна monkey
🐔 курица chicken
🐧 пингвин penguin
🐦 птица bird
🐤 цыплёнок chick
🦆 утка duck
🦅 орёл eagle
🦉 сова owl
🦇 летучая мышь bat
🐺 волк wolf
🐗 кабан boar
🐴 лошадь horse
🦄 единорог unicorn
🐝 пчела bee
🪲 жук beetle
🐛 гусеница caterpillar
🦋 бабочка butterfly
🐌 улитка snail
🐞 божья коровка ladybug
🐜 муравей ant
🦟 комар mosquito
🦗 сверчок cricket
🕷️ паук spider
🕸️ паутина web
🦂 скорпион scorpion
🐢 черепаха turtle
🐍 змея snake
🦎 ящерица lizard
🦖 динозавр rex
🦕 динозавр sauropod
🐙 осьминог octopus
🦑 кальмар squid
🦐 креветка shrimp
🦞 омар lobster
🦀 краб crab
🐡 рыба fugu
🐠 рыба tropical
🐟 рыба fish
🐬 дельфин dolphin
🐳 кит whale
🐋 кит whale
🦈 акула shark
🐊 крокодил crocodile
🐅 тигр tiger
🦓 зебра zebra
🦍 горилла gorilla
🦧 орангутан orangutan
🐘 слон elephant
🦛 бегемот hippo
🦏 носорог rhino
🐪 верблюд camel
🦒 жираф giraffe
🦘 кенгуру kangaroo
🐃 буйвол buffalo
🐄 корова cow
🐎 конь horse
🐖 свинья pig
🐏 баран ram
🐑 овца sheep
🦙 лама llama
🐐 коза goat
🦌 олень deer
🐕 пёс dog
🐩 пудель poodle
🦮 поводырь guide
🐈 кот cat
🐓 петух rooster
🦃 индейка turkey
🦚 павлин peacock
🦜 попугай parrot
🦢 лебедь swan
🦩 фламинго flamingo
🕊️ голубь dove мир
🐇 кролик rabbit
🦝 енот raccoon
🦨 скунс skunk
🦔 ёж hedgehog
🐾 лапки paw
🌵 кактус cactus
🎄 ёлка tree новыйгод
🌲 ель evergreen
🌳 дерево tree
🌴 пальма palm
🌱 росток seedling
🌿 трава herb
☘️ клевер shamrock
🍀 четырёхлистник clover удача
🎋 бамбук tanabata
🍃 листья leaves
🍂 листопад fallen
🍁 клён maple
🍄 гриб mushroom
🐚 ракушка shell
🪨 камень rock
🌾 колос rice
💐 букет bouquet
🌷 тюльпан tulip
🌹 роза rose
🥀 увядшая wilted
🌺 гибискус hibiscus
🌸 сакура blossom
🌼 ромашка daisy
🌻 подсолнух sunflower
🌞 солнце sun
🌝 луна moon
🌚 луна moon
🌛 месяц moon
🌜 месяц moon
🌙 полумесяц crescent
🌍 земля europe планета
🌎 земля americas планета
🌏 земля asia планета
💫 звезда dizzy
⭐ звезда star
🌟 звезда glowing
✨ искры sparkles
⚡ молния zap
☄️ комета comet
💥 взрыв boom
🔥 огонь fire
🌪️ торнадо tornado
🌈 радуга rainbow
☀️ солнце sun
🌤️ солнце облако sun
⛅ облачно cloud
☁️ облако cloud
🌧️ дождь rain
⛈️ гроза thunder
🌩️ молния lightning
🌨️ снег snow
❄️ снежинка snowflake
☃️ снеговик snowman
⛄ снеговик snowman
🌬️ ветер wind
💨 порыв dash
💧 капля droplet
💦 брызги sweat
🌊 волна wave`;

  var D_FOOD = `🍏 яблоко green apple
🍎 яблоко apple
🍐 груша pear
🍊 мандарин tangerine
🍋 лимон lemon
🍌 банан banana
🍉 арбуз watermelon
🍇 виноград grapes
🍓 клубника strawberry
🫐 черника blueberries
🍈 дыня melon
🍒 вишня cherries
🍑 персик peach
🥭 манго mango
🍍 ананас pineapple
🥥 кокос coconut
🥝 киви kiwi
🍅 помидор tomato
🍆 баклажан eggplant
🥑 авокадо avocado
🥦 брокколи broccoli
🥬 салат leafy
🥒 огурец cucumber
🌶️ перец chili острый
🫑 перец bell
🌽 кукуруза corn
🥕 морковь carrot
🧄 чеснок garlic
🧅 лук onion
🥔 картофель potato
🍠 батат sweet
🥐 круассан croissant
🥯 бейгл bagel
🍞 хлеб bread
🥖 багет baguette
🥨 крендель pretzel
🧀 сыр cheese
🥚 яйцо egg
🍳 яичница cooking
🧈 масло butter
🥞 блины pancakes
🧇 вафля waffle
🥓 бекон bacon
🥩 стейк steak мясо
🍗 ножка poultry
🍖 мясо meat
🌭 хотдог hotdog
🍔 бургер burger
🍟 картошка фри fries
🍕 пицца pizza
🥪 сэндвич sandwich
🥙 шаурма flatbread
🧆 фалафель falafel
🌮 тако taco
🌯 буррито burrito
🥗 салат salad
🥘 паэлья pan
🍝 паста spaghetti
🍜 лапша ramen
🍲 суп stew
🍛 карри curry
🍣 суши sushi
🍱 бенто bento
🥟 пельмени dumpling
🦪 устрица oyster
🍤 креветка fried
🍙 онигири rice
🍚 рис rice
🍥 камабоко cake
🥠 печенье fortune
🥮 лунный пирог mooncake
🍢 одэн oden
🍡 данго dango
🍧 лёд shaved
🍨 мороженое ice
🍦 мороженое soft
🥧 пирог pie
🧁 капкейк cupcake
🍰 торт shortcake
🎂 торт birthday
🍮 пудинг custard
🍭 леденец lollipop
🍬 конфета candy
🍫 шоколад chocolate
🍿 попкорн popcorn
🍩 пончик donut
🍪 печенье cookie
🌰 каштан chestnut
🥜 арахис peanuts
🍯 мёд honey
🥛 молоко milk
🍼 бутылочка bottle
☕ кофе coffee
🍵 чай tea
🧃 сок juice
🥤 напиток cup
🧋 бабл ти bubble
🍶 саке sake
🍺 пиво beer
🍻 пиво beers
🥂 шампанское clink
🍷 вино wine
🥃 виски whisky
🍸 коктейль cocktail
🍹 тропический tropical
🧉 мате mate
🧊 лёд ice
🥄 ложка spoon
🍴 вилка нож fork
🍽️ тарелка plate
🥣 миска bowl
🥡 коробка takeout
🧂 соль salt`;

  var D_ACT = `⚽ футбол soccer мяч
🏀 баскетбол basketball
🏈 американский футбол football
⚾ бейсбол baseball
🥎 софтбол softball
🎾 теннис tennis
🏐 волейбол volleyball
🏉 регби rugby
🥏 фрисби frisbee
🎱 бильярд pool
🪀 йойо yoyo
🏓 пинпонг table tennis
🏸 бадминтон badminton
🏒 хоккей hockey
🏑 хоккей field
🥍 лакросс lacrosse
🏏 крикет cricket
🥅 ворота goal
⛳ гольф golf
🪁 змей kite
🏹 лук bow стрела
🎣 рыбалка fishing
🤿 дайвинг diving
🥊 бокс boxing
🥋 кимоно martial
🎽 майка running
🛹 скейт skateboard
🛼 ролики roller
🛷 санки sled
⛸️ коньки skate
🥌 кёрлинг curling
🎿 лыжи ski
🏂 сноуборд snowboard
🪂 парашют parachute
🏋️ штанга lifting
🤼 борьба wrestling
🤸 гимнастика cartwheel
⛹️ баскетболист bouncing
🤺 фехтование fencing
🤾 гандбол handball
🏌️ гольфист golfing
🏇 скачки horse
🧘 йога lotus медитация
🏄 сёрфер surfing
🏊 пловец swimming
🤽 поло polo
🚣 гребец rowing
🧗 скалолазание climbing
🚵 велоспорт mountain
🚴 велосипедист biking
🏆 кубок trophy
🥇 золото gold медаль
🥈 серебро silver
🥉 бронза bronze
🏅 медаль medal
🎖️ военная military
🏵️ розетка rosette
🎗️ лента ribbon
🎫 билет ticket
🎟️ билеты admission
🎪 цирк circus
🤹 жонглирование juggling
🎭 театр performing
🩰 пуанты ballet
🎨 палитра art
🎬 хлопушка clapper кино
🎤 микрофон microphone
🎧 наушники headphone
🎼 ноты score
🎹 пианино keyboard
🥁 барабан drum
🎷 саксофон saxophone
🎺 труба trumpet
🎸 гитара guitar
🪕 банджо banjo
🎻 скрипка violin
🎲 кубик dice
♟️ шахматы chess
🎯 дартс target
🎳 боулинг bowling
🎮 геймпад game
🕹️ джойстик joystick
🎰 автомат slot
🧩 пазл puzzle`;

  var D_TRAVEL = `🚗 машина car авто
🚕 такси taxi
🚙 внедорожник suv
🚌 автобус bus
🚎 троллейбус trolleybus
🏎️ гонка racing
🚓 полиция police
🚑 скорая ambulance
🚒 пожарная fire
🚐 минивэн minibus
🛻 пикап pickup
🚚 грузовик truck
🚛 фура lorry
🚜 трактор tractor
🦽 коляска wheelchair
🛴 самокат scooter
🚲 велосипед bicycle
🛵 мопед motor
🏍️ мотоцикл motorcycle
🛺 тук тук rickshaw
🚨 мигалка light
🚔 полиция police
🚍 автобус bus
🚘 машина car
🚖 такси taxi
🚡 фуникулёр tram
🚠 канатка cableway
🚟 подвесная suspension
🚃 вагон railway
🚋 трамвай tram
🚞 горная дорога railway
🚝 монорельс monorail
🚄 скоростной bullet
🚅 синкансэн bullet
🚈 электричка rail
🚂 паровоз locomotive
🚆 поезд train
🚇 метро metro
🚊 трамвай tram
🚉 станция station
✈️ самолёт airplane
🛫 взлёт departure
🛬 посадка arrival
🛩️ самолётик plane
💺 кресло seat
🛰️ спутник satellite
🚀 ракета rocket
🛸 нло ufo
🚁 вертолёт helicopter
🛶 каноэ canoe
⛵ парусник sailboat
🚤 катер speedboat
🛥️ яхта boat
🛳️ лайнер ship
⛴️ паром ferry
🚢 корабль ship
⚓ якорь anchor
🪝 крюк hook
⛽ заправка fuel
🚧 стройка construction
🚦 светофор traffic
🚥 светофор traffic
🗺️ карта map
🗿 моаи moai
🗽 статуя свободы liberty
🗼 башня tower
🏰 замок castle
🏯 замок japanese
🏟️ стадион stadium
🎡 колесо обозрения ferris
🎢 горки coaster
🎠 карусель carousel
⛲ фонтан fountain
⛱️ зонт umbrella
🏖️ пляж beach
🏝️ остров island
🏜️ пустыня desert
🌋 вулкан volcano
⛰️ гора mountain
🏔️ снежная гора mountain
🗻 фудзи fuji
🏕️ кемпинг camping
⛺ палатка tent
🏠 дом house
🏡 дом сад house
🏘️ дома houses
🏚️ развалины derelict
🏗️ стройка crane
🏭 завод factory
🏢 офис office
🏬 универмаг department
🏣 почта post
🏥 больница hospital
🏦 банк bank
🏨 отель hotel
🏪 магазин store
🏫 школа school
💒 венчание wedding
🏛️ классика classical
⛪ церковь church
🕌 мечеть mosque
🕍 синагога synagogue
🛕 храм temple
🕋 кааба kaaba
🌁 туман foggy
🌃 ночь night
🏙️ город city
🌄 рассвет sunrise
🌅 восход sunrise
🌆 закат dusk
🌇 закат sunset
🌉 мост bridge
🎇 бенгальский sparkler
🎆 фейерверк fireworks`;

  var D_OBJ = `⌚ часы watch
📱 телефон phone
💻 ноутбук laptop
⌨️ клавиатура keyboard
🖥️ монитор desktop
🖨️ принтер printer
🖱️ мышь mouse
💾 дискета floppy
💿 диск cd
📀 двд dvd
🧮 счёты abacus
🎥 камера movie
📷 фотоаппарат camera
📸 вспышка flash
📹 видеокамера video
📼 кассета videocassette
🔍 лупа magnifying поиск
🔎 лупа magnifying
🕯️ свеча candle
💡 лампочка bulb идея
🔦 фонарик flashlight
🏮 фонарь lantern
📔 блокнот notebook
📕 книга book
📖 книга open
📚 книги books
📓 тетрадь notebook
📒 журнал ledger
📃 страница page
📜 свиток scroll
📄 документ page
📰 газета newspaper
🗞️ газета rolled
📑 закладки tabs
🔖 закладка bookmark
🏷️ ярлык label
💰 мешок денег money
🪙 монета coin
💴 иена yen
💵 доллар dollar
💶 евро euro
💷 фунт pound
💸 деньги wings
💳 карта card
🧾 чек receipt
💹 график chart
✉️ конверт envelope
📧 почта email
📨 входящее incoming
📩 письмо envelope
📤 исходящий outbox
📥 входящий inbox
📦 посылка package
📫 ящик mailbox
📮 почтовый ящик postbox
🗳️ урна ballot
✏️ карандаш pencil
✒️ перо nib
🖋️ ручка fountain
🖊️ ручка pen
🖌️ кисть paintbrush
🖍️ мелок crayon
📝 заметка memo
💼 портфель briefcase
📁 папка folder
📂 папка open
🗂️ разделители dividers
📅 календарь calendar
📆 календарь calendar
🗒️ блокнот spiral
🗓️ календарь spiral
📇 картотека index
📈 рост chart up
📉 падение chart down
📊 диаграмма bar
📋 планшет clipboard
📌 кнопка pushpin
📍 булавка pin
📎 скрепка paperclip
🖇️ скрепки linked
📏 линейка ruler
📐 треугольник ruler
✂️ ножницы scissors
🗃️ ящик file
🗄️ шкаф cabinet
🗑️ корзина trash
🔒 замок lock
🔓 открыт unlock
🔏 замок ручка lock
🔐 замок ключ lock
🔑 ключ key
🗝️ ключ old
🔨 молоток hammer
🪓 топор axe
⛏️ кирка pick
⚒️ молотки hammer
🛠️ инструменты tools
🗡️ кинжал dagger
⚔️ мечи swords
🛡️ щит shield
🔧 гаечный ключ wrench
🔩 болт bolt
⚙️ шестерёнка gear
⚖️ весы balance
🔗 ссылка link
⛓️ цепь chains
🧰 ящик инструментов toolbox
🧲 магнит magnet
🧪 пробирка tube
🧫 чашка петри petri
🧬 днк dna
🔬 микроскоп microscope
🔭 телескоп telescope
📡 антенна antenna
💉 шприц syringe
🩸 кровь blood
💊 таблетка pill
🩹 пластырь bandage
🩺 стетоскоп stethoscope
🚪 дверь door
🛗 лифт elevator
🪑 стул chair
🚽 туалет toilet
🚿 душ shower
🛁 ванна bathtub
🧴 лосьон lotion
🧷 булавка pin
🧹 метла broom
🧺 корзина basket
🧻 бумага paper
🧼 мыло soap
🧽 губка sponge
🧯 огнетушитель extinguisher
🛒 тележка cart
⚰️ гроб coffin`;

  var D_SYM = `❤️ сердце heart
💯 сто hundred
✅ галочка check да
❌ крест cross нет
❗ восклицание exclamation
❓ вопрос question
‼️ двойное восклицание double
⁉️ вопрос восклицание interrobang
⭕ круг circle
🔴 красный red
🟠 оранжевый orange
🟡 жёлтый yellow
🟢 зелёный green
🔵 синий blue
🟣 фиолетовый purple
🟤 коричневый brown
⚫ чёрный black
⚪ белый white
🟥 красный квадрат square
🟧 оранжевый квадрат square
🟨 жёлтый квадрат square
🟩 зелёный квадрат square
🟦 синий квадрат square
🟪 фиолетовый квадрат square
⬛ чёрный квадрат square
⬜ белый квадрат square
🔶 ромб diamond
🔷 ромб diamond
🔸 ромбик small
🔹 ромбик small
🔺 треугольник triangle
🔻 треугольник triangle
💠 алмаз diamond
🔘 радиокнопка radio
♠️ пики spades
♥️ черви hearts
♦️ бубны diamonds
♣️ трефы clubs
🃏 джокер joker
🀄 маджонг mahjong
🎴 карты cards
🔇 без звука mute
🔈 динамик speaker
🔉 звук volume
🔊 громко loud
📢 громкоговоритель loudspeaker
📣 мегафон megaphone
📯 рожок horn
🔔 колокол bell
🔕 без звонка bell
🎵 нота note
🎶 ноты notes
🏧 банкомат atm
🚮 урна litter
🚰 вода water
♿ доступность wheelchair
🚹 мужской men
🚺 женский women
🚻 туалет restroom
🚼 малыш baby
🛂 паспорт passport
🛃 таможня customs
🛄 багаж baggage
🛅 камера хранения luggage
⚠️ внимание warning
🚸 дети children
⛔ запрет entry
🚫 запрещено prohibited
🚭 не курить smoking
🔞 восемнадцать under
☢️ радиация radioactive
☣️ биологическая biohazard
⬆️ вверх up
↗️ вправо вверх up
➡️ вправо right
↘️ вправо вниз down
⬇️ вниз down
↙️ влево вниз down
⬅️ влево left
↖️ влево вверх up
↕️ вертикально updown
↔️ горизонтально leftright
↩️ назад hook
↪️ вперёд hook
🔃 обновить clockwise
🔄 обновить counterclockwise
🔙 назад back
🔚 конец end
🔛 включено on
🔜 скоро soon
🔝 наверх top
🛐 молитва worship
⚛️ атом atom
🕉️ ом om
✡️ звезда давида david
☸️ дхарма dharma
☯️ инь ян yin
✝️ крест latin
☦️ православный orthodox
☪️ полумесяц crescent
☮️ мир peace
🔯 гексаграмма six
♈ овен aries
♉ телец taurus
♊ близнецы gemini
♋ рак cancer
♌ лев leo
♍ дева virgo
♎ весы libra
♏ скорпион scorpio
♐ стрелец sagittarius
♑ козерог capricorn
♒ водолей aquarius
♓ рыбы pisces
⛎ змееносец ophiuchus
🔀 перемешать shuffle
🔁 повтор repeat
🔂 повтор один repeat
▶️ играть play
⏩ вперёд forward
⏭️ следующий next
⏯️ пауза playpause
◀️ назад reverse
⏪ перемотка rewind
⏮️ предыдущий previous
🔼 вверх up
⏫ вверх fast
🔽 вниз down
⏬ вниз fast
⏸️ пауза pause
⏹️ стоп stop
⏺️ запись record
⏏️ извлечь eject
🎦 кино cinema
🔅 яркость dim
🔆 яркость bright
📶 сигнал antenna
📳 вибрация vibration
📴 выключен off
♻️ переработка recycle
⚜️ лилия fleur
🔱 трезубец trident
📛 бейдж badge
🔰 новичок beginner
✳️ звёздочка asterisk
✴️ звезда eight
❇️ искра sparkle
©️ копирайт copyright
®️ зарегистрировано registered
™️ торговая марка trademark
#️⃣ решётка hash
*️⃣ звёздочка asterisk
0️⃣ ноль zero
1️⃣ один one
2️⃣ два two
3️⃣ три three
4️⃣ четыре four
5️⃣ пять five
6️⃣ шесть six
7️⃣ семь seven
8️⃣ восемь eight
9️⃣ девять nine
🔟 десять ten
🆒 круто cool
🆕 новое new
🆓 бесплатно free
🆗 окей ok
🆙 апгрейд up
🅰️ а a
🅱️ б b
🅾️ о o
🆎 аб ab
💤 сон zzz`;

  var D_FLAG = `🏳️ белый флаг white
🏴 чёрный флаг black
🏁 финиш chequered
🚩 флажок triangular
🏳️‍🌈 радужный rainbow
🏴‍☠️ пиратский pirate
🇷🇺 россия russia
🇧🇾 беларусь belarus
🇰🇿 казахстан kazakhstan
🇺🇦 украина ukraine
🇺🇿 узбекистан uzbekistan
🇰🇬 киргизия kyrgyzstan
🇹🇯 таджикистан tajikistan
🇦🇲 армения armenia
🇦🇿 азербайджан azerbaijan
🇬🇪 грузия georgia
🇲🇩 молдова moldova
🇹🇲 туркмения turkmenistan
🇺🇸 сша usa america
🇬🇧 великобритания uk britain
🇩🇪 германия germany
🇫🇷 франция france
🇮🇹 италия italy
🇪🇸 испания spain
🇵🇹 португалия portugal
🇳🇱 нидерланды netherlands
🇧🇪 бельгия belgium
🇨🇭 швейцария switzerland
🇦🇹 австрия austria
🇸🇪 швеция sweden
🇳🇴 норвегия norway
🇫🇮 финляндия finland
🇩🇰 дания denmark
🇵🇱 польша poland
🇨🇿 чехия czech
🇬🇷 греция greece
🇹🇷 турция turkey
🇦🇪 оаэ emirates
🇸🇦 саудовская saudi
🇮🇱 израиль israel
🇪🇬 египет egypt
🇮🇳 индия india
🇨🇳 китай china
🇯🇵 япония japan
🇰🇷 корея korea
🇹🇭 таиланд thailand
🇻🇳 вьетнам vietnam
🇮🇩 индонезия indonesia
🇸🇬 сингапур singapore
🇦🇺 австралия australia
🇳🇿 новая зеландия zealand
🇨🇦 канада canada
🇲🇽 мексика mexico
🇧🇷 бразилия brazil
🇦🇷 аргентина argentina
🇨🇱 чили chile
🇿🇦 юар africa
🇷🇸 сербия serbia
🇭🇷 хорватия croatia
🇷🇴 румыния romania
🇧🇬 болгария bulgaria
🇭🇺 венгрия hungary
🇸🇰 словакия slovakia
🇸🇮 словения slovenia
🇱🇹 литва lithuania
🇱🇻 латвия latvia
🇪🇪 эстония estonia
🇮🇪 ирландия ireland
🇮🇸 исландия iceland
🇨🇺 куба cuba
🇨🇾 кипр cyprus`;

  function parse(src) {
    var out = [], lines = src.split('\n');
    for (var i = 0; i < lines.length; i++) {
      var ln = lines[i].trim();
      if (!ln) continue;
      var sp = ln.indexOf(' ');
      if (sp < 0) { out.push({ e: ln, k: '' }); continue; }
      out.push({ e: ln.slice(0, sp), k: ln.slice(sp + 1).toLowerCase() });
    }
    return out;
  }

  /* Категории. ic — id символа из спрайта index.html (эмодзи в UI запрещены). */
  var CATS = [
    { id: 'recent', name: 'Недавние',           ic: 'clock',    items: null },
    { id: 'smile',  name: 'Смайлы и люди',      ic: 'em-smile', items: parse(D_SMILE) },
    { id: 'nature', name: 'Животные и природа', ic: 'em-paw',   items: parse(D_NATURE) },
    { id: 'food',   name: 'Еда',                ic: 'em-food',  items: parse(D_FOOD) },
    { id: 'act',    name: 'Активность',         ic: 'em-ball',  items: parse(D_ACT) },
    { id: 'travel', name: 'Путешествия',        ic: 'em-plane', items: parse(D_TRAVEL) },
    { id: 'obj',    name: 'Предметы',           ic: 'em-bulb',  items: parse(D_OBJ) },
    { id: 'sym',    name: 'Символы',            ic: 'em-sym',   items: parse(D_SYM) },
    { id: 'flag',   name: 'Флаги',              ic: 'flag',     items: parse(D_FLAG) }
  ];
  function catById(id) { for (var i = 0; i < CATS.length; i++) if (CATS[i].id === id) return CATS[i]; return null; }

  /* ======================================================================
     2. БРЕНД-СТИКЕРЫ OKO
     Лайм #9AFF00 на чёрной плашке. Знак глаза — только официальный мастер
     из спрайта (<use href="#i-logo">), от руки логотип не рисуем.
     ==================================================================== */
  var STK = [
    { id: 'oko',     label: 'OKO',       logo: '<use href="#i-logo" x="26" y="10" width="68" height="68"/>', g: '', t: 'OKO' },
    { id: 'watch',   label: 'Смотрим',   logo: '<use href="#i-logo" x="40" y="26" width="40" height="40"/>',
      g: '<circle cx="60" cy="46" r="31"/><path d="M60 5v9M60 78v9M15 46h9M96 46h9"/>', t: 'СМОТРИМ' },
    { id: 'yes',     label: 'Да',        logo: '', g: '<circle cx="60" cy="48" r="31"/><path d="M45 48l11 12 21-24"/>', t: 'ДА' },
    { id: 'no',      label: 'Нет',       logo: '', g: '<circle cx="60" cy="48" r="31"/><path d="M48 36l24 24M72 36 48 60"/>', t: 'НЕТ' },
    { id: 'top',     label: 'Топ',       logo: '', g: '<path d="M60 82V20M38 42 60 20l22 22M32 92h56"/>', t: 'ТОП' },
    { id: 'power',   label: 'Мощь',      logo: '',
      g: '<path d="M70 12 40 54h17l-5 32 31-44H64z" fill="#9AFF00" stroke="#9AFF00" stroke-width="4"/>', t: 'МОЩЬ' },
    { id: 'wait',    label: 'Жду',       logo: '', g: '<circle cx="60" cy="48" r="31"/><path d="M60 28v22l14 8"/>', t: 'ЖДУ' },
    { id: 'hundred', label: 'В точку',   logo: '', g: '', big: '100%', t: 'В ТОЧКУ' },
    { id: 'deal',    label: 'В деле',    logo: '<use href="#i-logo" x="44" y="12" width="32" height="32"/>',
      g: '<path d="M26 82h68"/>', big: 'В ДЕЛЕ', bigY: 70, t: '' },
    { id: 'online',  label: 'На связи',  logo: '<use href="#i-logo" x="42" y="24" width="36" height="36"/>',
      g: '<path d="M28 30a34 34 0 0 0 0 48M92 30a34 34 0 0 1 0 48M16 20a48 48 0 0 0 0 68M104 20a48 48 0 0 1 0 68"/>', t: 'НА СВЯЗИ' },
    { id: 'secret',  label: 'Секрет',    logo: '',
      g: '<rect x="34" y="44" width="52" height="38" rx="10"/><path d="M46 44V34a14 14 0 0 1 28 0v10"/><path d="M60 58v10"/>', t: 'СЕКРЕТ' },
    { id: 'team',    label: 'OKO TEAM',  logo: '<use href="#i-logo" x="45" y="10" width="30" height="30"/>',
      g: '', big: 'TEAM', bigY: 70, t: 'OKO TEAM' }
  ];
  var LIME = '#9AFF00';
  function stkById(id) { for (var i = 0; i < STK.length; i++) if (STK[i].id === id) return STK[i]; return null; }
  function stkSvg(id, size) {
    var s = stkById(id); if (!s) return '';
    var big = s.big
      ? '<text x="60" y="' + (s.bigY || 60) + '" text-anchor="middle" font-family="\'Bebas Neue\',Impact,sans-serif" ' +
        'font-size="34" letter-spacing="1" fill="' + LIME + '">' + s.big + '</text>' : '';
    var cap = s.t
      ? '<text x="60" y="107" text-anchor="middle" font-family="\'Bebas Neue\',Impact,sans-serif" ' +
        'font-size="17" letter-spacing="1.6" fill="' + LIME + '">' + s.t + '</text>' : '';
    return '<svg class="okoem-stkart" viewBox="0 0 120 120" width="' + size + '" height="' + size + '" role="img" aria-label="Стикер ' + s.label + '">' +
      '<rect x="3" y="3" width="114" height="114" rx="26" fill="#0b0b0b" stroke="' + LIME + '" stroke-width="2"/>' +
      (s.g ? '<g fill="none" stroke="' + LIME + '" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">' + s.g + '</g>' : '') +
      s.logo + big + cap + '</svg>';
  }

  /* Свои стикеры пользователя */
  function myStk() { var v = lsGet(LS_MY, []); return Array.isArray(v) ? v : []; }
  function myStkSave(a) { return lsSet(LS_MY, a.slice(0, 40)); }

  /* ======================================================================
     3. СТИЛИ
     ==================================================================== */
  var CSS = `
.okoem{flex:0 0 auto;height:0;overflow:hidden;display:flex;flex-direction:column;
  background:var(--surface);box-shadow:inset 0 1px 0 var(--border);pointer-events:none;
  padding-left:var(--oko-safe-left,0px);padding-right:var(--oko-safe-right,0px);
  transition:height .2s cubic-bezier(.3,1,.4,1)}
.okoem.on{pointer-events:auto}
@media(prefers-reduced-motion:reduce){.okoem{transition:none}}

.okoem-top{flex:0 0 auto;display:flex;align-items:center;gap:7px;padding:8px 12px 5px}
.okoem-find{flex:1;min-width:0;display:flex;align-items:center;gap:7px;height:34px;padding:0 10px;
  background:var(--raised);border:1px solid var(--border);border-radius:12px}
.okoem-find svg.i{width:15px;height:15px;color:var(--dim);stroke-width:8}
.okoem-find input{flex:1;min-width:0;height:32px;background:none;border:0;outline:none;
  color:var(--text);font-family:inherit;font-size:13.5px}
.okoem-find input::placeholder{color:var(--dim)}
.okoem-act{flex:0 0 auto;width:34px;height:34px;border-radius:11px;display:flex;align-items:center;
  justify-content:center;color:var(--dim);background:var(--raised);border:1px solid var(--border);
  padding:0;cursor:pointer;transition:color .14s,background .14s}
.okoem-act svg.i{width:17px;height:17px}
.okoem-act:hover{color:var(--text)}
.okoem-act:active{color:var(--accent);background:var(--lime-dim)}

.okoem-body{flex:1 1 auto;min-height:0;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;
  -webkit-overflow-scrolling:touch;padding:2px 10px 10px;scrollbar-width:thin}
.okoem-body::-webkit-scrollbar{width:5px}
.okoem-body::-webkit-scrollbar-thumb{background:var(--border);border-radius:9px}
.okoem-sec{font-size:10.5px;font-weight:800;color:var(--dim);text-transform:uppercase;
  letter-spacing:.06em;margin:9px 2px 6px}
.okoem-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(38px,1fr));gap:1px}
.okoem-e{height:40px;min-width:0;border:0;background:none;padding:0;border-radius:10px;cursor:pointer;
  display:flex;align-items:center;justify-content:center;line-height:1;font-size:24px;
  font-family:'Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji','Twemoji Mozilla',sans-serif;
  transition:background .14s,transform .1s}
.okoem-e:hover{background:var(--lime-dim)}
.okoem-e:active{transform:scale(1.22);background:var(--lime-dim)}

.okoem-stkgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(74px,1fr));gap:8px}
.okoem-stk{position:relative;display:flex;flex-direction:column;align-items:center;gap:4px;
  padding:6px 2px;border:0;background:none;border-radius:14px;cursor:pointer;
  transition:background .14s,transform .12s}
.okoem-stk:hover{background:var(--lime-dim)}
.okoem-stk:active{transform:scale(.93)}
.okoem-stk .okoem-stkart,.okoem-stk img{width:64px;height:64px;display:block;object-fit:contain}
.okoem-stk small{font-size:9.5px;font-weight:700;color:var(--dim);text-align:center;line-height:1.2;
  max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.okoem-del{position:absolute;top:0;right:0;width:20px;height:20px;border-radius:50%;padding:0;
  background:var(--raised);border:1px solid var(--border);color:var(--dim);
  display:flex;align-items:center;justify-content:center;cursor:pointer}
.okoem-del svg.i{width:9px;height:9px;stroke-width:11}
.okoem-add{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;
  min-height:74px;border-radius:14px;border:0;background:none;color:var(--dim);cursor:pointer;
  font-size:9.5px;font-weight:700;transition:color .14s,background .14s}
.okoem-add svg.i{width:30px;height:30px}
.okoem-add:hover{color:var(--accent);background:var(--lime-dim)}

.okoem-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:9px;
  text-align:center;color:var(--dim);font-size:12.5px;line-height:1.45;padding:22px 16px;
  max-width:340px;margin:0 auto}
.okoem-empty svg.i{width:30px;height:30px;color:var(--border)}
.okoem-empty b{display:block;color:var(--text);font-size:13.5px;margin-bottom:2px}
.okoem-mini{margin-top:2px;height:32px;padding:0 14px;border-radius:11px;border:1px solid var(--border);
  background:var(--raised);color:var(--text);font-family:inherit;font-size:12.5px;font-weight:700;cursor:pointer}
.okoem-mini:active{border-color:var(--lime);color:var(--accent)}

.okoem-cats{flex:0 0 auto;display:flex;align-items:center;gap:2px;overflow-x:auto;overflow-y:hidden;
  padding:5px 8px;box-shadow:inset 0 1px 0 var(--border);scrollbar-width:none;
  -webkit-overflow-scrolling:touch}
.okoem-cats::-webkit-scrollbar{display:none}
.okoem-cat{flex:0 0 auto;width:38px;height:34px;border-radius:10px;border:0;background:none;padding:0;
  cursor:pointer;color:var(--dim);display:flex;align-items:center;justify-content:center;
  transition:color .14s,background .14s}
.okoem-cat svg.i{width:19px;height:19px}
.okoem-cat:hover{color:var(--text)}
.okoem-cat.on{color:var(--accent);background:var(--lime-dim)}
.okoem-divi{flex:0 0 auto;width:1px;height:20px;background:var(--border);margin:0 5px}

#okoEmBtn.on{color:var(--accent)}
.okoem-hidden{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}

/* Отправленный стикер в ленте сообщений */
.okoem-msg .okoem-stkart,.okoem-msg img{width:128px;height:128px;display:block;object-fit:contain}
.okoem-msg{animation:okoemStkIn .34s cubic-bezier(.34,1.56,.44,1)}
@keyframes okoemStkIn{from{opacity:0;transform:scale(.7)}to{opacity:1;transform:scale(1)}}
@media(prefers-reduced-motion:reduce){.okoem-msg{animation:none}}
`;

  function injectCss() {
    if (document.getElementById('okoEmojiCss')) return;
    var st = document.createElement('style');
    st.id = 'okoEmojiCss';
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* ======================================================================
     4. ВЫСОТА = ВЫСОТА КЛАВИАТУРЫ
     ==================================================================== */
  function savedKb() {
    var v = parseInt(lsGet(LS_KB, 0), 10);
    return (v >= 160 && v <= 700) ? v : 0;
  }
  /* Сколько места реально можно отдать панели: высота диалога минус шапка,
     композер, панель ответа и минимальный кусок ленты сообщений. */
  function availH() {
    var body = document.getElementById('convBody');
    var comp = document.querySelector('#convBody .composer');
    var head = document.querySelector('#convBody .conv-head');
    var bar  = document.getElementById('composeBar');
    var total = body && body.getBoundingClientRect().height > 100
      ? body.getBoundingClientRect().height : window.innerHeight;
    var used = (comp ? comp.getBoundingClientRect().height : 64) +
               (head ? head.getBoundingClientRect().height : 56);
    if (bar && bar.classList.contains('open')) used += bar.getBoundingClientRect().height;
    return Math.max(200, Math.round(total - used - 110));
  }
  function targetH() {
    var kb = savedKb();
    var h = kb ? Math.max(200, kb) : Math.max(260, Math.min(Math.round(window.innerHeight * 0.46), 320));
    return Math.round(Math.min(h, availH()));
  }
  /* Замер клавиатуры: только пока панель закрыта и фокус в поле ввода. */
  (function watchKb() {
    var vv = window.visualViewport;
    if (!vv) return;
    function onVV() {
      if (state.open) return;
      var inp = document.getElementById('msgInput');
      if (!inp || document.activeElement !== inp) return;
      var d = Math.round(window.innerHeight - vv.height - (vv.offsetTop || 0));
      if (d >= 160 && d <= window.innerHeight * 0.72) {
        if (Math.abs(savedKb() - d) > 4) lsSet(LS_KB, d);
      }
    }
    vv.addEventListener('resize', onVV);
    vv.addEventListener('scroll', onVV);
  })();

  /* ======================================================================
     5. СОСТОЯНИЕ И DOM
     ==================================================================== */
  var state = { open: false, tab: lsGet(LS_TAB, 'recent') || 'recent', q: '', caret: 0 };
  var TABS_OK = { recent: 1, smile: 1, nature: 1, food: 1, act: 1, travel: 1, obj: 1, sym: 1, flag: 1, 'stk:oko': 1, 'stk:my': 1, gif: 1 };
  if (!TABS_OK[state.tab]) state.tab = 'recent';

  function el() { return document.getElementById('okoEm'); }
  function btn() { return document.getElementById('okoEmBtn'); }
  function bodyEl() { return document.getElementById('okoEmBody'); }
  function inputEl() { return document.getElementById('msgInput'); }
  function ico(n) { return '<svg class="i"><use href="#i-' + n + '"/></svg>'; }
  function escHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function build() {
    injectCss();
    var composer = document.querySelector('#convBody .composer');
    if (!composer) return;

    /* Сносим старую панель chats-plus, чтобы не было двух наборов сразу. */
    var oldP = document.getElementById('cpPanel'); if (oldP) oldP.remove();
    var oldB = document.getElementById('cpSmile'); if (oldB) oldB.remove();

    if (!document.getElementById('okoEmBtn')) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tool';
      b.id = 'okoEmBtn';
      b.title = 'Эмодзи и стикеры';
      b.setAttribute('aria-label', 'Эмодзи и стикеры');
      b.setAttribute('aria-expanded', 'false');
      b.innerHTML = ico('em-smile');
      b.addEventListener('click', function (e) { e.preventDefault(); toggle(); });
      composer.insertBefore(b, composer.firstChild);
    }

    if (!document.getElementById('okoEm')) {
      var p = document.createElement('div');
      p.className = 'okoem';
      p.id = 'okoEm';
      p.setAttribute('aria-hidden', 'true');
      p.innerHTML =
        '<div class="okoem-top">' +
          '<label class="okoem-find">' + ico('search') +
            '<input id="okoEmQ" type="search" autocomplete="off" placeholder="Поиск эмодзи" aria-label="Поиск эмодзи">' +
          '</label>' +
          '<button type="button" class="okoem-act" id="okoEmBksp" title="Стереть символ" aria-label="Стереть символ">' + ico('em-bksp') + '</button>' +
          '<button type="button" class="okoem-act" id="okoEmClose" title="Закрыть панель" aria-label="Закрыть панель">' + ico('x') + '</button>' +
        '</div>' +
        '<div class="okoem-body" id="okoEmBody"></div>' +
        '<div class="okoem-cats" id="okoEmCats" role="tablist"></div>' +
        '<input type="file" id="okoEmFile" class="okoem-hidden" accept="image/png,image/jpeg,image/webp,image/svg+xml" tabindex="-1">';
      composer.parentNode.insertBefore(p, composer);

      renderCats();
      p.querySelector('#okoEmQ').addEventListener('input', function () {
        state.q = this.value.trim().toLowerCase();
        render();
      });
      /* Enter в поиске — вставить первый найденный эмодзи, как в Telegram. */
      p.querySelector('#okoEmQ').addEventListener('keydown', function (e) {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        var first = bodyEl() && bodyEl().querySelector('.okoem-e');
        if (first) pick(first.getAttribute('data-e'));
      });
      p.querySelector('#okoEmBksp').addEventListener('click', function (e) { e.preventDefault(); backspace(); });
      p.querySelector('#okoEmClose').addEventListener('click', function (e) { e.preventDefault(); close(); });
      p.querySelector('#okoEmFile').addEventListener('change', onFile);

      bodyEl().addEventListener('click', onBodyClick);
      document.getElementById('okoEmCats').addEventListener('click', onCatsClick);
    }
  }

  /* ======================================================================
     6. ОТКРЫТИЕ / ЗАКРЫТИЕ (взаимоисключение с клавиатурой)
     ==================================================================== */
  function scrollMsgs() {
    var m = document.getElementById('msgs');
    if (m) requestAnimationFrame(function () { m.scrollTop = m.scrollHeight; });
  }
  function syncLegacyFlag(v) { try { cpPanelOpen = v; } catch (e) { /* let из app.js может быть недоступен */ } }

  function open() {
    build();
    var p = el(); if (!p) return;
    var inp = inputEl();
    if (inp) {
      syncCaret();
      /* Гасим системную клавиатуру: одновременно с панелью она не живёт. */
      try { inp.blur(); } catch (e) {}
    }
    state.open = true;
    p.classList.add('on');
    p.setAttribute('aria-hidden', 'false');
    p.style.height = targetH() + 'px';
    var b = btn(); if (b) { b.classList.add('on'); b.setAttribute('aria-expanded', 'true'); }
    syncLegacyFlag(true);
    render();
    scrollMsgs();
    if (typeof nvPush === 'function') nvPush('cp:panel', function () { close(true); });
  }

  function close(fromNav) {
    var p = el();
    var was = state.open;
    state.open = false;
    if (p) {
      p.classList.remove('on');
      p.style.height = '0px';
      p.setAttribute('aria-hidden', 'true');
    }
    var b = btn(); if (b) { b.classList.remove('on'); b.setAttribute('aria-expanded', 'false'); }
    syncLegacyFlag(false);
    if (was) {
      if (!fromNav && typeof nvPop === 'function') nvPop('cp:panel');
      scrollMsgs();
    }
  }
  function toggle() { state.open ? close() : open(); }

  /* ======================================================================
     7. РЕНДЕР
     ==================================================================== */
  function recent() { var v = lsGet(LS_REC, []); return Array.isArray(v) ? v : []; }

  function renderCats() {
    var wrap = document.getElementById('okoEmCats'); if (!wrap) return;
    var html = '';
    for (var i = 0; i < CATS.length; i++) {
      var c = CATS[i];
      html += '<button type="button" class="okoem-cat" role="tab" data-tab="' + c.id + '" title="' + escHtml(c.name) +
              '" aria-label="' + escHtml(c.name) + '">' + ico(c.ic) + '</button>';
    }
    html += '<span class="okoem-divi"></span>' +
      '<button type="button" class="okoem-cat" role="tab" data-tab="stk:oko" title="Стикеры OKO" aria-label="Стикеры OKO">' + ico('sticker') + '</button>' +
      '<button type="button" class="okoem-cat" role="tab" data-tab="stk:my" title="Мои стикеры" aria-label="Мои стикеры">' + ico('em-add') + '</button>' +
      '<span class="okoem-divi"></span>' +
      '<button type="button" class="okoem-cat" role="tab" data-tab="gif" title="GIF" aria-label="GIF">' + ico('em-gif') + '</button>';
    wrap.innerHTML = html;
  }

  function markCats() {
    var wrap = document.getElementById('okoEmCats'); if (!wrap) return;
    var kids = wrap.querySelectorAll('.okoem-cat');
    for (var i = 0; i < kids.length; i++) {
      var on = kids[i].getAttribute('data-tab') === state.tab && !state.q;
      kids[i].classList.toggle('on', on);
      kids[i].setAttribute('aria-selected', on ? 'true' : 'false');
    }
  }

  function gridHtml(list) {
    var h = '';
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      var e = typeof it === 'string' ? it : it.e;
      var k = typeof it === 'string' ? '' : (it.k || '');
      h += '<button type="button" class="okoem-e" data-e="' + escHtml(e) + '" title="' + escHtml(k.split(' ')[0] || '') + '">' + escHtml(e) + '</button>';
    }
    return '<div class="okoem-grid">' + h + '</div>';
  }

  function searchHtml() {
    var q = state.q, res = [], seen = {};
    for (var i = 1; i < CATS.length && res.length < 240; i++) {
      var arr = CATS[i].items;
      for (var j = 0; j < arr.length && res.length < 240; j++) {
        if (seen[arr[j].e]) continue;
        if (arr[j].k.indexOf(q) >= 0) { seen[arr[j].e] = 1; res.push(arr[j]); }
      }
    }
    if (!res.length) {
      return '<div class="okoem-empty">' + ico('search') +
        '<span><b>Ничего не нашли</b>Попробуй другое слово — поиск понимает русские и английские названия.</span></div>';
    }
    return '<div class="okoem-sec">Найдено: ' + res.length + '</div>' + gridHtml(res);
  }

  function stkOkoHtml() {
    var h = '';
    for (var i = 0; i < STK.length; i++) {
      h += '<button type="button" class="okoem-stk" data-stk="' + STK[i].id + '" title="' + escHtml(STK[i].label) + '">' +
        stkSvg(STK[i].id, 64) + '<small>' + escHtml(STK[i].label) + '</small></button>';
    }
    return '<div class="okoem-sec">Стикеры OKO</div><div class="okoem-stkgrid">' + h + '</div>';
  }

  function stkMyHtml() {
    var my = myStk(), h = '';
    for (var i = 0; i < my.length; i++) {
      h += '<button type="button" class="okoem-stk" data-my="' + escHtml(my[i].id) + '" title="Мой стикер">' +
        '<img src="' + escHtml(my[i].src) + '" alt="Мой стикер">' +
        '<span class="okoem-del" data-del="' + escHtml(my[i].id) + '" role="button" title="Удалить стикер" aria-label="Удалить стикер">' + ico('x') + '</span>' +
        '</button>';
    }
    h += '<button type="button" class="okoem-add" data-add="1">' + ico('em-add') + 'ДОБАВИТЬ</button>';
    var head = '<div class="okoem-sec">Мои стикеры' + (my.length ? ' · ' + my.length : '') + '</div>';
    var hint = my.length ? '' :
      '<div class="okoem-empty">' + ico('sticker') +
      '<span><b>Своих стикеров пока нет</b>Загрузи PNG, JPG, WEBP или SVG — картинка сохранится в этом браузере и станет стикером.</span></div>';
    return head + hint + '<div class="okoem-stkgrid">' + h + '</div>';
  }

  function gifHtml() {
    return '<div class="okoem-empty">' + ico('em-gif') +
      '<span><b>GIF-каталог ещё не подключён</b>Нужен внешний источник гифок — подключим его отдельно. ' +
      'Сейчас GIF можно отправить файлом через скрепку: он придёт собеседнику как есть.</span>' +
      '<button type="button" class="okoem-mini" data-attach="1">Открыть вложения</button></div>';
  }

  function render() {
    var b = bodyEl(); if (!b) return;
    markCats();
    if (state.q) { b.innerHTML = searchHtml(); b.scrollTop = 0; return; }
    if (state.tab === 'stk:oko') { b.innerHTML = stkOkoHtml(); b.scrollTop = 0; return; }
    if (state.tab === 'stk:my')  { b.innerHTML = stkMyHtml();  b.scrollTop = 0; return; }
    if (state.tab === 'gif')     { b.innerHTML = gifHtml();    b.scrollTop = 0; return; }
    if (state.tab === 'recent') {
      var r = recent();
      if (!r.length) {
        b.innerHTML = '<div class="okoem-empty">' + ico('clock') +
          '<span><b>Тут появятся недавние</b>Выбери любой эмодзи — он запомнится и будет первым под рукой.</span></div>' +
          '<div class="okoem-sec">Смайлы и люди</div>' + gridHtml(catById('smile').items.slice(0, 64));
      } else {
        b.innerHTML = '<div class="okoem-sec">Недавние</div>' + gridHtml(r) +
          '<div class="okoem-sec">Смайлы и люди</div>' + gridHtml(catById('smile').items.slice(0, 64));
      }
      b.scrollTop = 0; return;
    }
    var c = catById(state.tab) || catById('smile');
    b.innerHTML = '<div class="okoem-sec">' + escHtml(c.name) + '</div>' + gridHtml(c.items);
    b.scrollTop = 0;
  }

  function setTab(id) {
    if (!TABS_OK[id]) id = 'recent';
    state.tab = id;
    lsSet(LS_TAB, id);
    var q = document.getElementById('okoEmQ');
    if (q && q.value) { q.value = ''; state.q = ''; }
    var p = el();
    if (q) q.placeholder = (id === 'stk:oko' || id === 'stk:my') ? 'Поиск эмодзи' : 'Поиск эмодзи';
    render();
  }

  /* ======================================================================
     8. ВСТАВКА В ПОЛЕ (без фокуса — иначе выскочит клавиатура)
     ==================================================================== */
  function syncCaret() {
    var inp = inputEl(); if (!inp) return;
    var s = inp.selectionStart;
    state.caret = (typeof s === 'number' && s >= 0) ? s : inp.value.length;
  }
  function insert(text) {
    var inp = inputEl(); if (!inp) return;
    var s = state.caret, e = state.caret;
    if (document.activeElement === inp) {
      s = typeof inp.selectionStart === 'number' ? inp.selectionStart : inp.value.length;
      e = typeof inp.selectionEnd === 'number' ? inp.selectionEnd : s;
    }
    var len = inp.value.length;
    s = Math.min(Math.max(0, s), len);
    e = Math.min(Math.max(s, e), len);
    inp.value = inp.value.slice(0, s) + text + inp.value.slice(e);
    state.caret = s + text.length;
    try { inp.setSelectionRange(state.caret, state.caret); } catch (_) {}
    try { inp.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
    if (typeof syncComposer === 'function') syncComposer();
    else if (typeof syncSendIcon === 'function') syncSendIcon();
  }
  function backspace() {
    var inp = inputEl(); if (!inp) return;
    var s = state.caret;
    if (document.activeElement === inp && typeof inp.selectionStart === 'number') s = inp.selectionStart;
    s = Math.min(Math.max(0, s), inp.value.length);
    if (!s) return;
    var pre = inp.value.slice(0, s), cut = 1;
    try {
      if (window.Intl && Intl.Segmenter) {
        var seg = Array.from(new Intl.Segmenter('ru', { granularity: 'grapheme' }).segment(pre));
        if (seg.length) cut = seg[seg.length - 1].segment.length;
      } else {
        var arr = Array.from(pre);
        if (arr.length) cut = arr[arr.length - 1].length;
      }
    } catch (_) {}
    inp.value = pre.slice(0, s - cut) + inp.value.slice(s);
    state.caret = s - cut;
    try { inp.setSelectionRange(state.caret, state.caret); } catch (_) {}
    try { inp.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
    if (typeof syncComposer === 'function') syncComposer();
  }
  function pick(e) {
    if (!e) return;
    insert(e);
    var r = recent();
    r = [e].concat(r.filter(function (x) { return x !== e; })).slice(0, 36);
    lsSet(LS_REC, r);
    if (window.okoHaptic) try { okoHaptic('selection'); } catch (_) {}
  }

  /* ======================================================================
     9. ОТПРАВКА СТИКЕРА
     ==================================================================== */
  function canSend() {
    return typeof pushMsg === 'function' && typeof currentChat !== 'undefined' && currentChat;
  }
  function sendStk(payload) {
    if (!canSend()) { if (typeof toast === 'function') toast('Открой чат, чтобы отправить стикер'); return; }
    pushMsg({ in: 0, t: (typeof nowT === 'function' ? nowT() : ''), kind: 'sticker', okoStk: payload });
    if (window.okoHaptic) try { okoHaptic('impact'); } catch (_) {}
  }

  /* Свой стикер из файла: уменьшаем до 256px и кладём в localStorage. */
  function onFile(ev) {
    var f = ev.target.files && ev.target.files[0];
    ev.target.value = '';
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) { if (typeof toast === 'function') toast('Файл больше 4 МБ — возьми поменьше'); return; }
    var fr = new FileReader();
    fr.onload = function () {
      var src = String(fr.result || '');
      if (f.type === 'image/svg+xml') { storeStk(src); return; }
      var img = new Image();
      img.onload = function () {
        try {
          var max = 256, k = Math.min(1, max / Math.max(img.width || max, img.height || max));
          var cw = Math.max(1, Math.round((img.width || max) * k));
          var ch = Math.max(1, Math.round((img.height || max) * k));
          var cv = document.createElement('canvas');
          cv.width = cw; cv.height = ch;
          cv.getContext('2d').drawImage(img, 0, 0, cw, ch);
          storeStk(cv.toDataURL('image/png'));
        } catch (e) { storeStk(src); }
      };
      img.onerror = function () { if (typeof toast === 'function') toast('Не смогли прочитать картинку'); };
      img.src = src;
    };
    fr.onerror = function () { if (typeof toast === 'function') toast('Не смогли прочитать файл'); };
    fr.readAsDataURL(f);
  }
  function storeStk(src) {
    var my = myStk();
    my.unshift({ id: 'my' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), src: src });
    if (!myStkSave(my)) {
      if (typeof toast === 'function') toast('Память браузера заполнена — удали пару стикеров');
      return;
    }
    setTab('stk:my');
  }

  /* ======================================================================
     10. СОБЫТИЯ ПАНЕЛИ
     ==================================================================== */
  function onBodyClick(ev) {
    var t = ev.target;
    if (!t || !t.closest) return;

    var del = t.closest('[data-del]');
    if (del) {
      ev.preventDefault(); ev.stopPropagation();
      var id = del.getAttribute('data-del');
      myStkSave(myStk().filter(function (x) { return x.id !== id; }));
      render();
      return;
    }
    var add = t.closest('[data-add]');
    if (add) { ev.preventDefault(); var f = document.getElementById('okoEmFile'); if (f) f.click(); return; }

    var att = t.closest('[data-attach]');
    if (att) {
      ev.preventDefault();
      close();
      if (typeof openSheet === 'function') openSheet('attach');
      return;
    }
    var e = t.closest('.okoem-e');
    if (e) { ev.preventDefault(); pick(e.getAttribute('data-e')); return; }

    var so = t.closest('[data-stk]');
    if (so) { ev.preventDefault(); sendStk({ type: 'oko', id: so.getAttribute('data-stk') }); return; }

    var sm = t.closest('[data-my]');
    if (sm) {
      ev.preventDefault();
      var mid = sm.getAttribute('data-my');
      var rec = myStk().filter(function (x) { return x.id === mid; })[0];
      if (rec) sendStk({ type: 'img', src: rec.src });
      return;
    }
  }
  function onCatsClick(ev) {
    var b = ev.target && ev.target.closest ? ev.target.closest('.okoem-cat') : null;
    if (!b) return;
    ev.preventDefault();
    setTab(b.getAttribute('data-tab'));
  }

  /* ======================================================================
     11. ВЗАИМОИСКЛЮЧЕНИЕ И ВЫХОДЫ
     ==================================================================== */
  (function wireInput() {
    function attach() {
      var inp = document.getElementById('msgInput');
      if (!inp || inp.dataset.okoem === '1') return !!inp;
      inp.dataset.okoem = '1';
      /* Коснулись поля -> панель уходит, остаётся только клавиатура. */
      inp.addEventListener('pointerdown', function () { if (state.open) close(); });
      inp.addEventListener('focus', function () { if (state.open) close(); syncCaret(); });
      ['keyup', 'click', 'select', 'input'].forEach(function (n) {
        inp.addEventListener(n, syncCaret);
      });
      return true;
    }
    if (!attach()) {
      var t = setInterval(function () { if (attach()) clearInterval(t); }, 300);
      setTimeout(function () { clearInterval(t); }, 15000);
    }
  })();

  /* Тап вне панели закрывает. Кнопки композера (смайл, микрофон, отправка)
     исключены: отправка стикера/текста не должна схлопывать панель. */
  document.addEventListener('pointerdown', function (ev) {
    if (!state.open) return;
    var t = ev.target;
    if (t && t.closest && (t.closest('#okoEm') || t.closest('#okoEmBtn') ||
        t.closest('#sendBtn') || t.closest('#micBtn'))) return;
    close();
  }, true);

  /* Escape и системная «назад» приходят через nvBack (nvPush выше).
     Страховка на случай, если навигационный стек недоступен. */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || !state.open) return;
    if (typeof nvPush === 'function') return; /* закроет nvBack */
    e.preventDefault();
    close();
  });

  window.addEventListener('resize', function () {
    if (!state.open) return;
    var p = el(); if (p) p.style.height = targetH() + 'px';
  });

  /* ======================================================================
     12. СТЫКОВКА С ЯДРОМ
     ==================================================================== */
  /* Рендер стикера-сообщения: свои и бренд-стикеры OKO. */
  if (typeof msgHtml === 'function') {
    var _prevMsgHtml = msgHtml;
    window.msgHtml = function (m, idx) {
      if (m && m.kind === 'sticker' && m.okoStk) {
        var art = m.okoStk.type === 'img'
          ? '<img src="' + escHtml(m.okoStk.src) + '" alt="Стикер">'
          : stkSvg(m.okoStk.id, 128);
        if (!art) art = stkSvg('oko', 128);
        var checks = m.in ? '' : ico('check2');
        var rx = (typeof reactHtml === 'function') ? reactHtml(m, idx) : '';
        return '<div class="msg sticker-msg okoem-msg ' + (m.in ? 'in' : 'out') + '" style="align-self:' +
          (m.in ? 'flex-start' : 'flex-end') + '" onclick="reactBar(event,' + idx + ')">' + art +
          '<span class="t">' + escHtml(m.t || '') + checks + '</span>' + rx + '</div>';
      }
      return _prevMsgHtml.apply(this, arguments);
    };
  }

  /* После отправки текста каретка снова в начале пустого поля. */
  if (typeof sendText === 'function') {
    var _prevSendText = sendText;
    window.sendText = function () {
      var r = _prevSendText.apply(this, arguments);
      var inp = inputEl();
      state.caret = inp ? inp.value.length : 0;
      return r;
    };
  }

  /* Подменяем старую панель chats-plus: ядро продолжает звать те же имена. */
  window.cpBuildPanel  = build;
  window.cpOpenPanel   = open;
  window.cpClosePanel  = function (fromNav) { close(fromNav); };
  window.cpTogglePanel = toggle;
  window.cpPanelTab    = function (t) {
    setTab(t === 'emoji' ? 'recent' : (t === 'stickers' || t === 'oko' || t === 'ton') ? 'stk:oko' : t);
  };

  /* Публичный API (используется пробником oko-app/tools/probe-emoji.mjs). */
  window.okoEmoji = {
    open: open, close: close, toggle: toggle,
    isOpen: function () { return state.open; },
    tab: function () { return state.tab; },
    setTab: setTab,
    targetHeight: targetH,
    availHeight: availH,
    savedKb: savedKb,
    setKb: function (v) { lsSet(LS_KB, v); if (state.open) { var p = el(); if (p) p.style.height = targetH() + 'px'; } },
    recent: recent,
    insert: insert,
    count: function () { var n = 0; for (var i = 1; i < CATS.length; i++) n += CATS[i].items.length; return n; },
    stickers: function () { return STK.length; }
  };

  function boot() {
    build();
    var p = el(); if (p && !state.open) p.style.height = '0px';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
