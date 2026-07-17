/* ================= ACADEMY: Академия OKO (префикс ac-) =================
   Курс «Нейросети 2026»: 5 уроков (видео + слайды + тест + практика + мини-игра),
   per-урок прогресс и официальный сертификат за КАЖДЫЙ урок
   (canvas: печать + подпись из core-ext). */

const AC_VIDEO_URL = 'https://true-journey-418.higgsfield.app/media/oko_lesson1_web.mp4'; // урок 1, хостится на домене приложения
const AC_PASS = 70;

/* ================= КУРС: 5 УРОКОВ ================= */
const AC_COURSE = [

/* ---------- УРОК 1: Карта нейросетей 2026 ---------- */
{
  title:'Карта нейросетей 2026',
  sub:'3:24 · видео + слайды + тест + игра',
  dur:'3:24',
  videoUrl: AC_VIDEO_URL,
  c1:'КАРТА НЕЙРОСЕТЕЙ', c2:'2026',
  slides:[
  {t:'Карта категорий', pts:[
    'Правило №1: сначала <b>задача</b>, потом модель',
    'Все нейросети — всего <b>7 семей</b>: текст, картинки, видео, код, озвучка, музыка, автоматизация',
    'Понял, к какой семье относится задача — полдела сделано',
    'Новинки выходят каждую неделю — карта важнее списка'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="60" cy="35" r="10"/><circle cx="60" cy="35" r="3.5" fill="currentColor" stroke="none"/><path d="M60 25V10M60 45v15M50 32 22 20M70 32l28-12M50 39 22 52M70 39l28 13M48 35H30M72 35h18" opacity=".8"/><circle cx="22" cy="19" r="5"/><circle cx="98" cy="19" r="5"/><circle cx="22" cy="52" r="5"/><circle cx="98" cy="52" r="5"/><circle cx="60" cy="9" r="5"/><circle cx="60" cy="61" r="5"/><circle cx="28" cy="35" r="5"/></svg>'},
  {t:'Текст: рабочий конь', pts:[
    '<b>ChatGPT</b> — универсальный солдат, хорош почти во всём',
    '<b>Claude</b> — король больших текстов и кода, контекст на десятки страниц',
    '<b>Gemini</b> — свежий поиск и связка с Google',
    'Код или длинный документ → Claude · факт из сети → Gemini · остальное → ChatGPT'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="14" y="10" width="66" height="42" rx="9"/><path d="M26 24h42M26 33h34M26 42h40"/><path d="M34 52 28 62l16-10" stroke-linejoin="round"/><rect x="88" y="26" width="22" height="30" rx="6" opacity=".7"/><path d="M93 34h12M93 41h9M93 48h12" opacity=".7"/></svg>'},
  {t:'Картинки: тут крутятся деньги', pts:[
    '<b>Midjourney</b> — лучшая эстетика, арт и «вау»',
    '<b>Flux</b> — фотореализм почти бесплатно, ~5¢ за кадр',
    '<b>Nano Banana</b> — правки и текст прямо на картинке, без перегенерации',
    '<b>Higgsfield</b> собирает все модели в одном окне'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="20" y="8" width="80" height="54" rx="8"/><circle cx="43" cy="24" r="6"/><path d="M20 54l24-20 16 13 18-16 22 20"/><path d="M104 12l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6-4.5-4 6-1z" fill="currentColor" stroke="none" opacity=".9"/></svg>'},
  {t:'Видео: дорого и зрелищно', pts:[
    '<b>Veo</b> — лучшее качество + родной звук, почти продакшн',
    '<b>Kling</b> — кино за копейки, ~10¢ за секунду',
    '<b>Runway</b> — заточен под маркетинг и монтаж',
    'Тест идеи → Kling · финалка клиенту → Veo'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="18" y="8" width="84" height="46" rx="8"/><path d="M52 22v18l16-9z" fill="currentColor" stroke="none"/><path d="M18 62h84" opacity=".6"/><circle cx="34" cy="62" r="3" fill="currentColor" stroke="none"/><path d="M26 16h6M26 46h6M88 16h6M88 46h6" opacity=".6"/></svg>'},
  {t:'Озвучка и музыка', pts:[
    '<b>ElevenLabs</b> — премиум-голос для витринных проектов',
    '<b>Локальные нейро-TTS</b> — бесплатно и безлимит (этот урок озвучен именно так)',
    '<b>Suno</b> — готовый трек по одному запросу',
    'Музыку всегда подбирай под смысл ролика'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M14 35v0M22 28v14M30 20v30M38 26v18M46 14v42M54 24v22M62 30v10M70 22v26M78 28v14"/><path d="M96 46V16l14-4v26" stroke-linejoin="round"/><circle cx="91" cy="46" r="5.5"/><circle cx="105" cy="38" r="5.5"/></svg>'},
  {t:'Код без программиста', pts:[
    '<b>Cursor</b>, <b>Lovable</b>, <b>Claude Code</b> — тройка лидеров',
    'Описываешь словами → получаешь рабочее приложение',
    'MVP за вечер вместо недель разработки',
    'Чем точнее ТЗ, тем меньше правок'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M38 18 18 35l20 17M82 18l20 17-20 17M68 12 52 58"/></svg>'},
  {t:'Как выбирать: формула', pts:[
    '<b>Задача → Категория → Модель</b> — три шага, пара секунд',
    'Лазейка: <b>Higgsfield Ultra</b> — десятки топ-моделей одной подпиской',
    'Связка «локальные голоса + n8n на своём сервере» роняет себестоимость до копеек',
    'Не плати каждой модели по отдельности'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M16 12h88L74 34v22l-12 8V34z"/><path d="M60 10v0" opacity=".5"/><circle cx="99" cy="52" r="9"/><path d="M96 52l2.5 2.5 5-5"/></svg>'},
  {t:'Чек-лист урока', pts:[
    'Текст → Claude и компания',
    'Картинки → Flux (объём) / Midjourney (вау)',
    'Видео → Kling (тест) / Veo (финал)',
    'Музыка → Suno · Озвучка → локальные TTS',
    'Экономия → агрегаторы и связки'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="26" y="6" width="68" height="58" rx="8"/><path d="M36 20l4 4 7-8M36 36l4 4 7-8M36 52l4 4 7-8" stroke-width="2.8"/><path d="M54 21h28M54 37h28M54 53h20"/></svg>'},
  ],
  quiz:[
  {q:'С чего начинается выбор нейросети по карте из урока?', o:['С названия самой хайповой модели','С формулировки задачи','С цены подписки','С обзоров блогеров'], a:1},
  {q:'Кому отдать длинный документ или код?', o:['Midjourney','Suno','Claude','Kling'], a:2},
  {q:'Фотореализм почти бесплатно (~5 центов за кадр) — это…', o:['Flux','Veo','ChatGPT','Runway'], a:0},
  {q:'«Кино за копейки» — примерно 10 центов за секунду видео — это…', o:['Veo','Kling','Nano Banana','Cursor'], a:1},
  {q:'Готовый музыкальный трек по одному запросу делает…', o:['ElevenLabs','Gemini','Lovable','Suno'], a:3},
  {q:'Главная формула карты нейросетей 2026:', o:['Модель → Цена → Задача','Категория → Модель → Задача','Задача → Категория → Модель','Промпт → Модель → Результат'], a:2},
  ],
  pairs:[
  ['Claude','Длинный документ и код'],
  ['Flux','Фотореализм за копейки'],
  ['Kling','Дёшево протестировать видео-идею'],
  ['Suno','Трек под ролик за один запрос'],
  ['Nano Banana','Поправить текст на готовой картинке'],
  ],
  task:{
    intro:'Возьми свою реальную задачу и разложи её по формуле урока — так, как отдал бы нейросети в работу:',
    chips:['Задача','Категория','Модель','Почему именно она'],
    ph:'Пример: Задача — обложка для урока. Категория — картинки. Модель — Flux: нужен фотореализм и объём дёшево. Формат — вертикаль 2:3, тёмный фон, лаймовый акцент.',
    verdict:'Категория выбрана верно, модель соответствует бюджету задачи. Совет куратора: добавляй в промпт ожидаемый формат результата — модель ответит точнее.'
  }
},

/* ---------- УРОК 2: Промпт-инжиниринг ---------- */
{
  title:'Промпт-инжиниринг',
  sub:'2:37 · формула промпта · few-shot · chain-of-thought',
  dur:'2:37', videoUrl:'https://true-journey-418.higgsfield.app/media/oko_lesson2_web.mp4',
  c1:'ПРОМПТ', c2:'ИНЖИНИРИНГ',
  slides:[
  {t:'Формула сильного промпта', pts:[
    '<b>Роль → Задача → Контекст → Формат → Ограничения</b> — пять блоков',
    'Слабый промпт: «напиши пост». Сильный — закрывает все пять блоков',
    'Чем меньше модель догадывается, тем точнее результат',
    'Формула работает в любой нейросети: ChatGPT, Claude, Gemini'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="26" width="16" height="18" rx="4"/><rect x="30" y="26" width="16" height="18" rx="4"/><rect x="54" y="26" width="16" height="18" rx="4"/><rect x="78" y="26" width="16" height="18" rx="4"/><rect x="100" y="26" width="16" height="18" rx="4"/><path d="M23 35h5M47 35h5M71 35h5M95 35h3" opacity=".7"/><path d="M14 20v-8h94v46h-6" opacity=".35"/><circle cx="14" cy="52" r="2" fill="currentColor" stroke="none"/><circle cx="38" cy="52" r="2" fill="currentColor" stroke="none"/><circle cx="62" cy="52" r="2" fill="currentColor" stroke="none"/></svg>'},
  {t:'Роль и задача', pts:[
    '«Ты — маркетолог с 10-летним опытом» — роль включает нужный пласт знаний',
    'Задача — <b>глаголом</b>: напиши, сравни, разложи, предложи 5 вариантов',
    'Одна задача = один промпт. Несколько — режь на шаги',
    'Роль меняет и стиль, и глубину ответа'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="30" cy="22" r="9"/><path d="M14 58c2-14 8-20 16-20s14 6 16 20"/><path d="M52 35h28" opacity=".8"/><path d="M74 29l8 6-8 6" opacity=".8"/><circle cx="98" cy="35" r="14"/><circle cx="98" cy="35" r="8"/><circle cx="98" cy="35" r="2.5" fill="currentColor" stroke="none"/></svg>'},
  {t:'Контекст решает всё', pts:[
    'Дай факты: продукт, аудитория, цена, тон бренда',
    'Модель <b>не телепат</b> — что не сказал, то она выдумает',
    'Вставляй примеры своих текстов — стиль скопируется',
    'Большие документы и таблицы отдавай целиком, не пересказом'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="22" y="20" width="52" height="42" rx="6"/><path d="M30 14h52v42" opacity=".55"/><path d="M38 8h52v42" opacity=".3"/><path d="M32 32h32M32 41h24M32 50h30"/><circle cx="98" cy="52" r="10"/><path d="M105 59l9 9"/></svg>'},
  {t:'Формат и ограничения', pts:[
    'Проси конкретно: <b>таблица</b>, нумерованный список, JSON',
    'Ограничь объём: «до 500 знаков», «ровно 3 варианта»',
    '«Без воды, без вступлений, без клише» — негативные ограничения',
    'Заданный формат = результат сразу готов к использованию'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="10" width="66" height="50" rx="6"/><path d="M14 26h66M14 42h66M36 10v50M58 10v50"/><path d="M92 18h18M92 30h14M92 42h18M92 54h10" opacity=".7"/><path d="M88 51l-4 10" opacity=".7"/></svg>'},
  {t:'Few-shot: покажи примеры', pts:[
    '2–3 пары <b>«вход → выход»</b> прямо в промпте',
    'Модель копирует паттерн точнее любых описаний',
    'Лучший способ передать стиль, структуру и тон',
    'Работает для заголовков, писем, карточек товаров'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="20" height="14" rx="4"/><path d="M32 15h10M38 11l6 4-6 4"/><rect x="48" y="8" width="20" height="14" rx="4" fill="currentColor" fill-opacity=".15"/><rect x="8" y="28" width="20" height="14" rx="4"/><path d="M32 35h10M38 31l6 4-6 4"/><rect x="48" y="28" width="20" height="14" rx="4" fill="currentColor" fill-opacity=".15"/><rect x="80" y="14" width="32" height="24" rx="6"/><path d="M88 22h16M88 30h12"/><path d="M96 44v10M92 50l4 4 4-4"/></svg>'},
  {t:'Chain-of-thought', pts:[
    '«<b>Рассуждай по шагам</b>» — и точность на логике резко растёт',
    'Сложную задачу дели на этапы: сначала план, потом исполнение',
    'Попроси модель проверить собственный ответ перед выдачей',
    'Расчёты, стратегия, договоры — всегда через шаги'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 58h22V44h22V30h22V16h24"/><circle cx="23" cy="52" r="3" fill="currentColor" stroke="none"/><circle cx="45" cy="38" r="3" fill="currentColor" stroke="none"/><circle cx="67" cy="24" r="3" fill="currentColor" stroke="none"/><path d="M96 10l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6-4.5-4 6-1z" fill="currentColor" stroke="none" opacity=".9"/></svg>'},
  {t:'Итерация и типовые ошибки', pts:[
    'Первый ответ — <b>черновик</b>: уточняй «короче», «жёстче», «под B2B»',
    'Ошибка №1: несколько задач в одном промпте',
    'Ошибка №2: нет формата — получаешь простыню текста',
    'Ошибка №3: нет примеров там, где важен стиль'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M60 12a23 23 0 1 1-21 14"/><path d="M32 14l6 12 13-4"/><circle cx="60" cy="35" r="8" opacity=".7"/><path d="M100 22v14M100 44v.5" stroke-width="3"/></svg>'},
  {t:'Промпты для бизнеса', pts:[
    'Собери <b>библиотеку промптов</b> компании — как регламенты',
    'Шаблоны с переменными: {товар}, {аудитория}, {акция}',
    'Один отлаженный промпт экономит часы каждый день',
    'Прогони новый промпт 3–5 раз — проверь стабильность результата'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="26" y="22" width="68" height="38" rx="8"/><path d="M48 22v-6a6 6 0 0 1 6-6h12a6 6 0 0 1 6 6v6"/><path d="M26 38h28M66 38h28"/><rect x="54" y="33" width="12" height="10" rx="3" fill="currentColor" fill-opacity=".2"/><path d="M104 14l2.5 5 5 .8-3.7 3.4.8 5-4.6-2.5-4.6 2.5.8-5-3.7-3.4 5-.8z" fill="currentColor" stroke="none" opacity=".85"/></svg>'},
  ],
  quiz:[
  {q:'Правильный порядок блоков сильного промпта:', o:['Формат → Роль → Задача → Контекст','Роль → Задача → Контекст → Формат → Ограничения','Контекст → Роль → Ограничения → Задача','Задача → Формат → Роль → Контекст'], a:1},
  {q:'Few-shot — это…', o:['Попросить ответ покороче','Показать 2–3 примера «вход → выход»','Запустить промпт несколько раз подряд','Урезать контекст до минимума'], a:1},
  {q:'Chain-of-thought повышает точность, потому что модель…', o:['Отвечает быстрее','Тратит меньше токенов','Рассуждает по шагам, а не выдаёт ответ сразу','Подключается к интернету'], a:2},
  {q:'Негативное ограничение в промпте — это…', o:['Грубый тон запроса','Указание, чего НЕ делать: «без воды и клише»','Жалоба на прошлый ответ','Отключение истории чата'], a:1},
  {q:'Первый ответ модели правильнее всего воспринимать как…', o:['Финальный результат','Случайный шум','Черновик для итераций','Ошибку модели'], a:2},
  {q:'Типовая ошибка промпта из урока:', o:['Указать модели роль','Несколько задач в одном промпте без формата','Добавить примеры «вход → выход»','Ограничить объём ответа'], a:1},
  ],
  pairs:[
  ['Роль','«Ты — юрист с 10-летним опытом»'],
  ['Few-shot','2–3 примера «вход → выход»'],
  ['Chain-of-thought','«Рассуждай по шагам»'],
  ['Негативное ограничение','«Без воды и клише»'],
  ['Формат','«Ответ — таблицей из 3 колонок»'],
  ],
  task:{
    intro:'Собери промпт под свою реальную бизнес-задачу по формуле урока:',
    chips:['Роль','Задача','Контекст','Формат','Ограничения'],
    ph:'Пример: Роль — опытный SMM-маркетолог. Задача — напиши 5 заголовков для поста о скидке 20%. Контекст — кофейня в центре, аудитория 20–35. Формат — нумерованный список до 60 знаков. Ограничения — без клише и капслока.',
    verdict:'Все пять блоков формулы на месте — промпт готов к работе. Совет куратора: добавь 1–2 примера «вход → выход», и стиль ответов станет твоим на 100%.'
  }
},

/* ---------- УРОК 3: Генерация картинок PRO ---------- */
{
  title:'Генерация картинок PRO',
  sub:'Midjourney v7 · Flux · Nano Banana',
  dur:'', videoUrl:'',
  c1:'ГЕНЕРАЦИЯ КАРТИНОК', c2:'PRO',
  slides:[
  {t:'Три топ-модели 2026', pts:[
    '<b>Midjourney v7</b> — эстетика, арт-направление, «вау»-кадры',
    '<b>Flux</b> — фотореализм, дёшево, открытая модель',
    '<b>Nano Banana</b> (Gemini) — правки, текст на картинке, точное следование ТЗ',
    'Выбирай модель под задачу, а не наоборот'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="14" width="30" height="42" rx="6"/><rect x="45" y="8" width="30" height="48" rx="6"/><rect x="82" y="14" width="30" height="42" rx="6"/><path d="M14 48l8-8 6 5 4-4" opacity=".8"/><circle cx="60" cy="22" r="4"/><path d="M50 48l9-10 7 6 4-5" opacity=".8"/><path d="M90 26h14M90 34h10M90 42h14" opacity=".8"/><path d="M56 60l4 4 6-8" stroke-width="2.8"/></svg>'},
  {t:'Анатомия промпта картинки', pts:[
    '<b>Субъект → Стиль → Свет → Камера → Композиция</b>',
    'Порядок слов = приоритет: главное — в начало',
    'Коротко и конкретно бьёт длинно и расплывчато',
    'Один промпт — одна сцена, без «и ещё…»'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="10" width="58" height="50" rx="7"/><circle cx="34" cy="28" r="7"/><path d="M14 52l16-13 12 9 12-11 12 12"/><path d="M84 14h26M84 26h20M84 38h24M84 50h16" opacity=".75"/><circle cx="80" cy="14" r="1.8" fill="currentColor" stroke="none"/><circle cx="80" cy="26" r="1.8" fill="currentColor" stroke="none"/><circle cx="80" cy="38" r="1.8" fill="currentColor" stroke="none"/><circle cx="80" cy="50" r="1.8" fill="currentColor" stroke="none"/></svg>'},
  {t:'Субъект и стиль', pts:[
    'Конкретика: не «собака», а «щенок корги, 3 месяца, мокрая шерсть»',
    'Стиль: photo, 3D render, flat illustration, oil painting',
    'Эстетики <b>editorial / cinematic / minimalist</b> задают настроение',
    'Материалы и фактуры добавляют реализма: matte, glossy, velvet'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="38" cy="35" r="20"/><circle cx="38" cy="29" r="7"/><path d="M25 48c3-8 7-11 13-11s10 3 13 11"/><path d="M74 18c14-6 26-2 30 6-6 2-10 8-18 8s-14-6-12-14z"/><path d="M78 32l-8 26" opacity=".8"/><circle cx="99" cy="52" r="3" fill="currentColor" stroke="none"/><circle cx="88" cy="58" r="2.4" fill="currentColor" stroke="none" opacity=".6"/></svg>'},
  {t:'Свет и камера', pts:[
    'Свет — половина кадра: <b>golden hour, softbox, neon glow</b>',
    'Объектив: 85mm portrait — лица, wide angle — пространство',
    'Глубина резкости: shallow depth of field, bokeh',
    'Ракурс: eye level, low angle (мощь), top-down (флэтлей)'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="26" cy="20" r="9"/><path d="M26 5v4M26 31v4M11 20h4M37 20h4M15 9l3 3M37 31l-3-3M37 9l-3 3M15 31l3-3"/><rect x="54" y="26" width="52" height="34" rx="7"/><path d="M68 26l5-8h14l5 8"/><circle cx="80" cy="43" r="10"/><circle cx="80" cy="43" r="4" opacity=".7"/><circle cx="99" cy="34" r="1.8" fill="currentColor" stroke="none"/></svg>'},
  {t:'Композиция и формат', pts:[
    'Rule of thirds, negative space, close-up / full shot',
    'Соотношение сторон под площадку: <b>9:16</b> сторис, <b>1:1</b> лента, <b>16:9</b> обложка',
    'Оставляй место под текст, если кадр пойдёт в баннер',
    'Центральная симметрия — приём премиальных брендов'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="18" y="8" width="84" height="54" rx="7"/><path d="M46 8v54M74 8v54M18 26h84M18 44h84" opacity=".4"/><circle cx="74" cy="26" r="6" fill="currentColor" fill-opacity=".25"/><circle cx="74" cy="26" r="2.5" fill="currentColor" stroke="none"/></svg>'},
  {t:'Референсы и consistency', pts:[
    'Image reference — прикладывай образец стиля или продукта',
    'Один герой в серии: <b>character reference</b> + фиксированный seed',
    'Бренд-кит в каждом промпте: фирменные цвета, логотип отдельным слоем',
    'Серия в едином стиле перформит лучше одиночных кадров'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="10" y="16" width="34" height="38" rx="6"/><circle cx="27" cy="30" r="6"/><path d="M17 48c2-6 5-9 10-9s8 3 10 9"/><rect x="76" y="16" width="34" height="38" rx="6"/><circle cx="93" cy="30" r="6"/><path d="M83 48c2-6 5-9 10-9s8 3 10 9"/><path d="M50 32h20M50 40h20" opacity=".7"/><path d="M64 26l6 6-6 6M56 34l-6 6 6 6" opacity=".7"/></svg>'},
  {t:'Апскейл и правки', pts:[
    'Генерируй в базовом разрешении, финалку — <b>апскейл до 2K/4K</b>',
    'Руки, текст, мелочи — не перегенерация, а точечная правка (inpaint)',
    'Nano Banana правит словами: «замени надпись, остальное не трогай»',
    'Противоречия в промпте («минимализм, много деталей») ломают кадр'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="12" y="30" width="26" height="20" rx="4"/><path d="M44 40h14M52 34l6 6-6 6"/><rect x="66" y="12" width="44" height="46" rx="6"/><path d="M72 50l12-12 8 6 10-10 8 8" opacity=".8"/><path d="M100 18l2 4 4 .6-3 2.8.7 4-3.7-2-3.7 2 .7-4-3-2.8 4-.6z" fill="currentColor" stroke="none" opacity=".85"/></svg>'},
  {t:'Коммерческое использование', pts:[
    'Права на коммерцию — почти всегда на <b>платных тарифах</b>: проверь лицензию',
    'Чужие лица, персонажи и логотипы — нельзя без прав',
    'Храни промпты и исходники — пригодятся для серий и споров',
    'На потоке считай юнит-экономику: цена кадра × объём'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="12" width="56" height="46" rx="7"/><circle cx="32" cy="26" r="5"/><path d="M14 50l18-14 12 9 10-9 16 14" opacity=".8"/><circle cx="94" cy="42" r="16"/><path d="M94 33v18M99 37c-1.5-2-8-2.5-8 1.5s9 2 9 6.5-7 3.5-9 1.5"/></svg>'},
  ],
  quiz:[
  {q:'Фотореализм дёшево и на открытой модели — это…', o:['Midjourney v7','Flux','Nano Banana','Suno'], a:1},
  {q:'Анатомия промпта картинки из урока:', o:['Стиль → Свет → Субъект → Формат','Субъект → Стиль → Свет → Камера → Композиция','Камера → Субъект → Формат → Свет','Композиция → Свет → Стиль → Камера'], a:1},
  {q:'Поправить надпись на готовой картинке, не трогая остальное, лучше всего умеет…', o:['Kling','Midjourney','Nano Banana','Wan'], a:2},
  {q:'Один и тот же герой во всей серии картинок — это…', o:['Апскейл','Character reference + фиксированный seed','Негативный промпт','Reframe'], a:1},
  {q:'Апскейл нужен, чтобы…', o:['Ускорить генерацию','Поднять разрешение финалки до 2K/4K','Сменить стиль кадра','Убрать фон'], a:1},
  {q:'Что проверить перед коммерческим использованием картинки?', o:['Количество лайков','Лицензию тарифа и отсутствие чужих брендов/лиц','Размер файла','Название модели'], a:1},
  ],
  pairs:[
  ['Midjourney v7','Арт и «вау»-эстетика'],
  ['Flux','Фотореализм за копейки'],
  ['Nano Banana','Правки и текст на картинке'],
  ['85mm portrait','Портрет с мягким боке'],
  ['Апскейл','Финалка в 4K для печати'],
  ],
  task:{
    intro:'Разложи промпт картинки для своего проекта по анатомии из урока:',
    chips:['Субъект','Стиль','Свет','Камера','Композиция'],
    ph:'Пример: Субъект — чашка латте с арт-пенкой. Стиль — editorial photo. Свет — мягкий утренний из окна. Камера — 85mm, shallow depth of field. Композиция — rule of thirds, место под текст справа, формат 4:5.',
    verdict:'Анатомия выдержана: субъект конкретный, свет и камера заданы. Совет куратора: зафиксируй seed и палитру бренда — получишь консистентную серию, а не разрозненные кадры.'
  }
},

/* ---------- УРОК 4: Видео-нейросети ---------- */
{
  title:'Видео-нейросети',
  sub:'Veo 3 · Kling 2 · Runway · Wan',
  dur:'', videoUrl:'',
  c1:'ВИДЕО', c2:'НЕЙРОСЕТИ',
  slides:[
  {t:'Кто есть кто в видео', pts:[
    '<b>Veo 3</b> — топ-качество + родной звук и речь',
    '<b>Kling 2</b> — лучшая цена/качество, идеален для тестов',
    '<b>Runway</b> — контроль, маркетинг, инструменты монтажа',
    '<b>Wan</b> — открытая модель, бесплатно на своём железе'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="30" width="24" height="28" rx="4"/><rect x="36" y="18" width="24" height="40" rx="4"/><rect x="64" y="26" width="24" height="32" rx="4"/><rect x="92" y="36" width="20" height="22" rx="4"/><path d="M45 32v12l10-6z" fill="currentColor" stroke="none"/><path d="M48 8l2 4 4 .6-3 2.8.7 4-3.7-2-3.7 2 .7-4-3-2.8 4-.6z" fill="currentColor" stroke="none" opacity=".9"/></svg>'},
  {t:'Text-to-video vs Image-to-video', pts:[
    'Text-to-video: быстро, но результат — лотерея',
    '<b>Image-to-video</b>: сначала идеальный кадр, потом «оживление»',
    'Для бренда почти всегда i2v — полный контроль первого кадра',
    'Картинку кадра готовь по анатомии из урока 3'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 14h26M10 22h20M10 30h24" opacity=".7"/><path d="M40 22h10M46 18l5 4-5 4" opacity=".7"/><rect x="10" y="42" width="26" height="20" rx="4"/><circle cx="18" cy="49" r="2.4"/><path d="M10 58l8-7 6 5 4-4 8 6" opacity=".8"/><path d="M40 52h10M46 48l5 4-5 4"/><rect x="58" y="18" width="52" height="36" rx="7"/><path d="M78 28v16l14-8z" fill="currentColor" stroke="none"/></svg>'},
  {t:'Первый и последний кадр', pts:[
    'Задаёшь <b>начало и конец</b> — модель строит переход между ними',
    'Связка клипов: последний кадр клипа = первый кадр следующего',
    'Так собирается бесшовный ролик из коротких генераций',
    'Резкие смены сцены прячь за монтажным переходом'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="20" width="32" height="30" rx="5"/><rect x="80" y="20" width="32" height="30" rx="5"/><path d="M44 35c10-14 22 14 32 0" stroke-dasharray="4 5"/><circle cx="24" cy="32" r="4"/><path d="M16 44l8-7 8 6" opacity=".8"/><circle cx="96" cy="30" r="4"/><path d="M88 44l8-8 8 7" opacity=".8"/></svg>'},
  {t:'Липсинк и звук', pts:[
    '<b>Veo 3</b> генерирует речь и шумы прямо в кадре',
    'Отдельный липсинк: готовая озвучка + лицо героя',
    'Звуковые эффекты под каждое движение — кадр оживает',
    'Музыка — под смысл сцены, не «фоном»'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="34" cy="32" r="18"/><circle cx="28" cy="27" r="2" fill="currentColor" stroke="none"/><circle cx="41" cy="27" r="2" fill="currentColor" stroke="none"/><ellipse cx="34" cy="40" rx="6" ry="4"/><path d="M64 24v22M74 18v34M84 26v18M94 14v42M104 24v22" stroke-width="2.8"/></svg>'},
  {t:'Вертикальный контент', pts:[
    '<b>9:16</b> — Reels, Shorts, TikTok: основной формат 2026',
    'Хук в первые 1,5 секунды — иначе свайп',
    'Субтитры обязательны: большинство смотрит без звука',
    'Лучше генерить сразу 9:16, а не спасать горизонталь reframe-ом'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="44" y="4" width="32" height="62" rx="8"/><path d="M55 26v14l12-7z" fill="currentColor" stroke="none"/><path d="M52 52h16M52 58h10" opacity=".8"/><path d="M20 22c4 8 4 18 0 26M12 28c2.5 5 2.5 9 0 14" opacity=".6"/><path d="M100 22c-4 8-4 18 0 26M108 28c-2.5 5-2.5 9 0 14" opacity=".6"/></svg>'},
  {t:'Пайплайн ролика', pts:[
    '<b>Сценарий → раскадровка → кадры-картинки → i2v-клипы → монтаж</b>',
    'Один клип — 5–8 секунд: дальше модель «плывёт»',
    'Озвучка и субтитры — после сборки видеоряда',
    'Финальный проход: цвет, темп под музыку, логотип'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="14" cy="35" r="7"/><circle cx="60" cy="35" r="7"/><circle cx="106" cy="35" r="7"/><circle cx="37" cy="35" r="7" fill="currentColor" fill-opacity=".18"/><circle cx="83" cy="35" r="7" fill="currentColor" fill-opacity=".18"/><path d="M21 35h9M44 35h9M67 35h9M90 35h9"/><path d="M103 32l4 3 4-3" opacity="0"/><path d="M14 20v-8h92v8" opacity=".35"/></svg>'},
  {t:'Экономика продакшна', pts:[
    'Тестируй идею на дешёвой модели, финал — на топовой',
    'Не генери 20 дублей — правь промпт после каждого',
    '30-сек ролик = 4–6 клипов: планируй бюджет заранее',
    'Неудачные клипы — в библиотеку: пригодятся в другом монтаже'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14l40 12-8 10-40-12z"/><path d="M14 26h44v28a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6z"/><path d="M28 44v6M36 40v10M44 44v6" opacity=".8"/><circle cx="92" cy="40" r="16"/><path d="M92 31v18M97 35c-1.5-2-8-2.5-8 1.5s9 2 9 6.5-7 3.5-9 1.5"/></svg>'},
  {t:'Типовые ошибки', pts:[
    'Длинные сцены: режь всё на клипы по 5–8 секунд',
    'Морфинг рук и лиц — меняй ракурс или план',
    'Скачки стиля между клипами — фиксируй референс и палитру',
    'Проверяй результат на телефоне: смотреть будут там'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M60 10 96 58H24z"/><path d="M60 28v14M60 50v.5" stroke-width="3"/><path d="M12 20l10 10M22 20l-10 10" opacity=".6"/><path d="M98 18l10 10M108 18l-10 10" opacity=".6"/></svg>'},
  ],
  quiz:[
  {q:'Родной звук и речь прямо при генерации видео даёт…', o:['Kling 2','Wan','Veo 3','Flux'], a:2},
  {q:'Для брендового ролика с контролем каждого кадра выбирают…', o:['Text-to-video','Image-to-video','Апскейл','Липсинк'], a:1},
  {q:'Бесшовная склейка нейро-клипов — это когда…', o:['Все клипы одной длины','Последний кадр клипа = первый кадр следующего','Одна модель на все клипы','Музыка без пауз'], a:1},
  {q:'Субтитры в вертикальном ролике обязательны, потому что…', o:['Так требует платформа','Большинство смотрит без звука','Иначе не пройти модерацию','Это просто красиво'], a:1},
  {q:'Оптимальная длина одного нейро-клипа:', o:['1–2 секунды','5–8 секунд','20–30 секунд','1 минута'], a:1},
  {q:'Дёшево протестировать видео-идею лучше всего в…', o:['Veo 3','Kling 2','ElevenLabs','Nano Banana'], a:1},
  ],
  pairs:[
  ['Veo 3','Качество + родной звук'],
  ['Kling 2','Цена/качество для тестов'],
  ['Runway','Контроль и инструменты монтажа'],
  ['Image-to-video','Оживить готовый кадр'],
  ['Первый-последний кадр','Бесшовный переход между клипами'],
  ],
  task:{
    intro:'Распиши пайплайн 30-секундного ролика о своём продукте:',
    chips:['Сценарий','Кадры','Модель','Клипы 5–8 с','Звук'],
    ph:'Пример: Сценарий — 3 сцены о доставке за 15 минут. Кадры — Flux, 9:16. Модель — тест в Kling 2, финал в Veo 3. Клипы — 5 по 6 секунд, склейка «первый-последний кадр». Звук — озвучка + караоке-сабы.',
    verdict:'Пайплайн рабочий: сцены короткие, склейка по кадрам, звук после сборки. Совет куратора: заложи один запасной клип на сцену — сэкономишь время, когда генерация «поплывёт».'
  }
},

/* ---------- УРОК 5: Свой ИИ-ассистент ---------- */
{
  title:'Свой ИИ-ассистент',
  sub:'агент под бизнес · RAG · Telegram',
  dur:'', videoUrl:'',
  c1:'СВОЙ', c2:'ИИ-АССИСТЕНТ',
  slides:[
  {t:'Зачем бизнесу агент', pts:[
    'Отвечает <b>24/7 за секунды</b> — клиент не ждёт утра',
    'Снимает 60–80% типовых вопросов с людей',
    'Не болеет, не выгорает, помнит все регламенты',
    'Окупается уже на зарплате первого оператора поддержки'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="20" y="18" width="44" height="34" rx="10"/><circle cx="34" cy="33" r="3.5" fill="currentColor" stroke="none"/><circle cx="50" cy="33" r="3.5" fill="currentColor" stroke="none"/><path d="M34 43c2.5 3 9.5 3 13 0"/><path d="M42 18v-8M38 10h8" opacity=".7"/><circle cx="92" cy="35" r="17"/><path d="M92 25v10l7 5"/></svg>'},
  {t:'Как устроен агент', pts:[
    '<b>LLM + системный промпт + база знаний + интеграции</b>',
    'Это не чат-бот по кнопкам: понимает свободную речь',
    'LLM — «мозг», база знаний — «память», интеграции — «руки»',
    'Собирается без программиста: конструкторы + API'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="60" cy="35" r="13"/><path d="M55 35a5 5 0 0 1 10 0" opacity=".7"/><path d="M60 22V8M60 48v14M47 32 20 20M73 32l27-12M47 40 20 52M73 40l27 12"/><rect x="10" y="12" width="16" height="12" rx="3"/><rect x="94" y="12" width="16" height="12" rx="3"/><rect x="10" y="46" width="16" height="12" rx="3"/><rect x="94" y="46" width="16" height="12" rx="3"/></svg>'},
  {t:'База знаний (RAG)', pts:[
    'FAQ, прайсы, регламенты, скрипты продаж → база знаний',
    'Агент ищет релевантный фрагмент и отвечает <b>по фактам</b>',
    'Обновил документ — агент сразу «поумнел»',
    'Золотое правило: не знаешь — не выдумывай, зови человека'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="42" cy="16" rx="26" ry="8"/><path d="M16 16v38c0 4.4 11.6 8 26 8s26-3.6 26-8V16"/><path d="M16 35c0 4.4 11.6 8 26 8s26-3.6 26-8" opacity=".6"/><circle cx="94" cy="44" r="11"/><path d="M102 52l10 10"/></svg>'},
  {t:'Системный промпт агента', pts:[
    'Личность и тон бренда: как здоровается, как отвечает',
    'Жёсткие правила: что нельзя обещать и обсуждать',
    'Сценарии эскалации: когда переключать на менеджера',
    'Примеры идеальных диалогов — few-shot из урока 2'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M34 6h40l14 14v44H34z"/><path d="M74 6v14h14" opacity=".7"/><path d="M44 30h32M44 39h24M44 48h30"/><circle cx="24" cy="24" r="8" opacity=".7"/><path d="M21 24l2.5 2.5 4.5-5" opacity=".7"/></svg>'},
  {t:'Подключение к Telegram', pts:[
    'Бот создаётся через <b>BotFather</b> за две минуты',
    'Схема: сообщение → webhook → сервер → LLM → ответ',
    'Кнопки для сценариев + свободный диалог для всего остального',
    'Клиенты уже в мессенджере — не надо загонять их на сайт'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 32 104 8 82 60 56 44z"/><path d="M56 44l10-16" opacity=".7"/><path d="M56 44v14l10-9" opacity=".7"/></svg>'},
  {t:'Продажи и поддержка на автомате', pts:[
    'Квалификация лида: агент сам задаёт уточняющие вопросы',
    'Запись на встречу и оплата — прямо в чате',
    'Горячий лид мгновенно улетает менеджеру с резюме диалога',
    'Ночные заявки больше не теряются'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10h60l-18 20v18l-14 8V30z"/><circle cx="96" cy="22" r="9"/><path d="M82 52c2-9 7-13 14-13s12 4 14 13" opacity=".9"/><path d="M62 52h8" opacity=".7"/><path d="M66 48l4 4-4 4" opacity=".7"/></svg>'},
  {t:'Метрики качества', pts:[
    '<b>Доля решённых без человека</b> — главная метрика',
    'Точность: прогоняй агента по тест-набору вопросов',
    'Время ответа и CSAT — оценка клиента после диалога',
    'Еженедельно читай логи: там готовый список улучшений'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 8v52h94"/><rect x="26" y="38" width="12" height="22" rx="3"/><rect x="48" y="26" width="12" height="34" rx="3"/><rect x="70" y="32" width="12" height="28" rx="3"/><rect x="92" y="16" width="12" height="44" rx="3" fill="currentColor" fill-opacity=".18"/><path d="M26 30l22-10 22 6 22-14" opacity=".6" stroke-dasharray="3 4"/></svg>'},
  {t:'Безопасность', pts:[
    'Персональные данные клиентов — не в промпты и не в логи',
    '<b>Prompt-injection</b>: «забудь инструкции» — агент должен устоять',
    'Ограничивай полномочия: скидки и возвраты подтверждает человек',
    'Тестируй агента как злоумышленник до запуска'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M60 6 92 16v18c0 16-13 27-32 32C41 61 28 50 28 34V16z"/><path d="M48 34l8 8 16-16" stroke-width="2.8"/></svg>'},
  ],
  quiz:[
  {q:'Главная выгода ИИ-агента для бизнеса:', o:['Заменяет сайт компании','Снимает 60–80% типовых вопросов 24/7','Ведёт бухгалтерию','Пишет код за разработчика'], a:1},
  {q:'База знаний (RAG) нужна, чтобы агент…', o:['Отвечал быстрее','Отвечал по фактам компании, а не выдумывал','Работал без интернета','Экономил токены'], a:1},
  {q:'Что задаёт системный промпт агента?', o:['Скорость сервера','Тон бренда, правила и сценарии эскалации','Дизайн окна чата','Цену подписки'], a:1},
  {q:'Бот в Telegram создаётся через…', o:['BotFather','Госуслуги','App Store','Настройки телефона'], a:0},
  {q:'Главная метрика качества агента:', o:['Длина ответов','Доля вопросов, решённых без человека','Число кнопок в меню','Количество стикеров'], a:1},
  {q:'Prompt-injection — это…', o:['Способ ускорить ответ','Попытка вредоносным сообщением перехватить управление агентом','Обновление базы знаний','Платная функция LLM'], a:1},
  ],
  pairs:[
  ['База знаний (RAG)','Ответы по фактам компании'],
  ['Системный промпт','Тон бренда и жёсткие правила'],
  ['BotFather','Создание Telegram-бота'],
  ['Эскалация','Передача сложного кейса человеку'],
  ['CSAT','Оценка клиента после диалога'],
  ],
  task:{
    intro:'Спроектируй своего ИИ-агента: ниша, типовые вопросы, тон, эскалация:',
    chips:['Ниша','5 вопросов','Тон','База знаний','Эскалация'],
    ph:'Пример: Ниша — студия маникюра. Вопросы — цены, запись, адрес, мастера, уход. Тон — тёплый, на «вы». База — прайс и FAQ. Эскалация — жалобы и переносы записи → администратору.',
    verdict:'Каркас агента готов: типовые вопросы покрыты, эскалация продумана. Совет куратора: собери тест-набор из 20 реальных диалогов и прогоняй его после каждого изменения промпта.'
  }
},
];

/* ---------- состояние (localStorage oko-academy, per-урок) ---------- */
function acNewLS(){
  return {video:false, slides:false, test:false, testScore:0, task:false, taskText:'',
          game:false, gameWrong:null, slideMax:0, cert:null};
}
function acLoadState(){
  let s = null;
  try{ s = JSON.parse(localStorage.getItem('oko-academy')); }catch(e){}
  if(!s) return {lessons:{}, certs:[]};
  if(s.lessons){ if(!Array.isArray(s.certs)) s.certs = []; return s; }
  /* миграция старого одноурочного формата → урок 0 */
  const l0 = Object.assign(acNewLS(), {
    video:!!s.video, slides:!!s.slides, test:!!s.test, testScore:s.testScore||0,
    task:!!s.task, taskText:s.taskText||'', game:!!s.game,
    gameWrong:(s.gameWrong===undefined?null:s.gameWrong), slideMax:s.slideMax||0,
    cert:s.cert||null
  });
  const fix = c => c ? Object.assign({lesson:0, lessonTitle:AC_COURSE[0].title}, c) : c;
  l0.cert = fix(l0.cert);
  const certs = (s.certs||[]).map(fix);
  return {lessons:{0:l0}, certs};
}
const acS = acLoadState();
function acSave(){ try{ localStorage.setItem('oko-academy', JSON.stringify(acS)); }catch(e){} }
acSave(); // сразу персистим мигрированный формат

/* ---------- стрик: дни подряд в учёбе ---------- */
function acDayStr(d){
  const x = d || new Date();
  return x.getFullYear() + '-' + String(x.getMonth()+1).padStart(2,'0') + '-' + String(x.getDate()).padStart(2,'0');
}
function acStreak(){
  if(!acS.streak) acS.streak = {last:'', days:0, best:0};
  return acS.streak;
}
function acStreakTouch(){
  const st = acStreak(), today = acDayStr();
  if(st.last === today) return st.days;
  const y = new Date(); y.setDate(y.getDate()-1);
  st.days = (st.last === acDayStr(y)) ? st.days + 1 : 1;
  st.last = today;
  if(st.days > (st.best||0)) st.best = st.days;
  acSave();
  return st.days;
}

/* ---------- следующий урок (первый открытый и не завершённый) ---------- */
function acNextLesson(){
  for(let i=0; i<AC_COURSE.length; i++)
    if(acUnlocked(i) && !acLessonDone(i)) return i;
  return -1;
}

let acView = 'home';            // 'home' | 'lesson'
let acL = 0;                    // индекс текущего урока
let acQuiz = null;              // сессия теста (не персистится)
let acG = null;                 // сессия мини-игры
let acTaskChecking = false;     // «Проверяется ИИ-куратором»
let acCertUrl = null;           // кэш PNG сертификата
let acCertShownNo = null;

function acCur(){ return AC_COURSE[acL]; }
function acLS(i){
  const k = (i===undefined ? acL : i);
  if(!acS.lessons[k]) acS.lessons[k] = acNewLS();
  return acS.lessons[k];
}

/* ---------- прогресс ---------- */
function acItems(i){
  const ls = acS.lessons[i===undefined?acL:i] || {};
  return [
    ['Видео просмотрено', !!ls.video],
    ['Слайды пролистаны', !!ls.slides],
    ['Тест сдан на '+AC_PASS+'%+', !!ls.test],
    ['Практика зачтена', !!ls.task],
    ['Мини-игра пройдена', !!ls.game],
  ];
}
function acLessonPct(i){ return acItems(i).filter(x=>x[1]).length * 20; }
function acCoursePct(){
  let sum = 0;
  for(let i=0; i<AC_COURSE.length; i++) sum += acLessonPct(i);
  return Math.round(sum / AC_COURSE.length);
}
function acLessonDone(i){
  const ls = acS.lessons[i];
  return !!(ls && ls.cert) || acLessonPct(i) === 100;
}
function acUnlocked(i){ return i === 0 || acLessonDone(i-1); }
function acCertEligible(){ const ls = acLS(); return ls.video && ls.testScore >= AC_PASS; }

/* ================= РЕНДЕР ================= */
function acRender(){
  const root = document.getElementById('acRoot');
  if(!root) return;
  root.innerHTML = acView === 'home' ? acHomeHtml() : acLessonHtml();
  root.classList.remove('fade-in'); void root.offsetWidth; root.classList.add('fade-in');
  if(acView === 'lesson'){
    acRenderVideoBox(); acBindSlides(); acRenderTestBox();
    acRenderTaskBox(); acRenderGameBox(); acRenderProgressBox(); acRenderCertBox();
  }
}

/* ---------- ГЛАВНАЯ АКАДЕМИИ ---------- */
function acHomeHtml(){
  const pct = acCoursePct(), C = 2*Math.PI*33;
  const rows = AC_COURSE.map((l,i)=>{
    if(!acUnlocked(i)) return `<button class="ac-lesson-row locked" onclick="toast('Урок ${i+1} откроется после сертификата урока ${i}')">
      <span class="ac-num">${i+1}</span>
      <span class="meta"><span class="t">${l.title}</span><span class="s" style="display:block">${l.sub}</span></span>
      <svg class="i"><use href="#i-lock"/></svg></button>`;
    const ls = acS.lessons[i], p = acLessonPct(i);
    const st = (ls && ls.cert)
      ? `<span class="ac-mini-cert" title="Сертификат получен"><svg class="i"><use href="#i-star"/></svg></span>`
      : (p > 0 ? `<span class="ac-mini-pct">${p}%</span>` : '');
    return `<button class="ac-lesson-row" onclick="acOpenLesson(${i})">
      <span class="ac-num">${i+1}</span>
      <span class="meta"><span class="t">${l.title}</span><span class="s" style="display:block">${l.sub}</span></span>
      ${st}
      <svg class="i go"><use href="#i-chev"/></svg></button>`;
  }).join('');
  const certs = acS.certs.length ? acS.certs.map((c,i)=>`
    <div class="ac-cert-item" style="animation-delay:${i*.05}s">
      <span class="ico"><svg class="i"><use href="#i-file"/></svg></span>
      <span class="meta"><span class="t">Урок ${(c.lesson||0)+1} · ${esc(c.lessonTitle||AC_COURSE[c.lesson||0].title)}</span><span class="s" style="display:block">${esc(c.no)} · ${esc(c.date)} · тест ${c.score}%</span></span>
      <button class="btn sm ghost ac-ico-btn" onclick="acCertShare(${i})" title="Поделиться" aria-label="Поделиться">${I('share')}</button>
      <button class="btn sm ghost" onclick="acCertShow(${i})">Показать</button>
    </div>`).join('')
    : `<p class="dim" style="font-size:12.5px;line-height:1.55">Пройди урок — получи официальный сертификат OKO с печатью и подписью. Он появится здесь.</p>`;
  const st = acStreak();
  const hot = st.days >= 3;
  const streak = `
    <div class="card ac-streak ${hot?'hot':''}">
      <span class="ac-flame">${I('fire')}</span>
      <div class="meta"><b>Дней подряд в учёбе: ${st.days||0}</b>
        <span>${hot ? 'Серия в огне — так держать!' : 'Заходи каждый день, чтобы разжечь серию'}${st.best>1?` · рекорд: ${st.best}`:''}</span></div>
      ${hot?`<span class="ac-hot-chip">${I('fire')} ${st.days}</span>`:''}
    </div>`;
  const nx = acNextLesson();
  const nextRow = nx >= 0
    ? `<button class="ac-next-row" onclick="acOpenLesson(${nx})">${I('circle-play')}<span>Следующий: <b>урок ${nx+1} — ${AC_COURSE[nx].title}</b></span><svg class="i go"><use href="#i-chev"/></svg></button>`
    : `<div class="ac-next-row done">${I('check2')}<span>Все уроки курса пройдены — сертификаты у тебя</span></div>`;
  return `
    <div class="ac-hero"><h2>Академия OKO</h2><p>Уроки полного формата · официальные сертификаты</p></div>
    ${streak}
    <div class="card">
      <div class="ac-course-top">
        <span class="ac-ring">
          <svg viewBox="0 0 80 80"><circle class="bg" cx="40" cy="40" r="33"/>
          <circle class="val" cx="40" cy="40" r="33" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C*(1-pct/100)).toFixed(1)}"/></svg>
          <b>${pct}%</b>
        </span>
        <div><h3>Нейросети 2026</h3><p class="dim">5 уроков · тесты и практика · сертификат за каждый урок</p></div>
      </div>
      ${nextRow}
      <div>${rows}</div>
    </div>

    <div class="card ac-soon" style="margin-top:12px" onclick="toast('Курс «Контент и Reels» уже в производстве')">
      <span class="ico"><svg class="i"><use href="#i-camera"/></svg></span>
      <div style="flex:1"><h3>Контент и Reels</h3><p>Сценарии, монтаж и вирусные форматы</p></div>
      <span class="chip">скоро</span>
    </div>

    <h2 class="section-h" style="margin:24px 0 10px;font-size:21px">Мои сертификаты</h2>
    <div class="card" style="padding:6px 14px">${certs}</div>
    <div style="height:14px"></div>`;
}

/* ---------- СТРАНИЦА УРОКА ---------- */
function acOpenLesson(i){
  const k = (typeof i === 'number') ? i : 0;
  if(!acUnlocked(k)){ toast('Урок '+(k+1)+' откроется после сертификата урока '+k); return; }
  acL = k;
  acView = 'lesson'; acQuiz = null; acG = null; acTaskChecking = false;
  acRender();
  const m = document.querySelector('main'); if(m) m.scrollTop = 0;
}
function acBackHome(){ acView='home'; acRender(); }

function acLessonHtml(){
  const L = acCur();
  const durLabel = L.videoUrl ? `${L.dur} видео` : 'видео в производстве';
  return `
    <button class="btn ghost sm ac-back" onclick="acBackHome()"><svg class="i"><use href="#i-back"/></svg> Академия</button>
    <div class="ac-lesson-head">
      <span class="chip">Урок ${acL+1} из ${AC_COURSE.length}</span>
      <h2>${L.title}</h2>
      <div class="m"><span>${I('clock')} ${durLabel}</span><span>·</span><span>${L.slides.length} слайдов</span><span>·</span><span>тест из ${L.quiz.length} вопросов</span><span>·</span><span>мини-игра</span></div>
    </div>

    <div id="acVideoBox"></div>

    <h2 class="section-h" style="margin:24px 0 10px;font-size:21px">Слайды урока</h2>
    <div id="acSlidesBox">
      <div class="ac-slides" id="acSlides">${L.slides.map((s,i)=>`
        <div class="ac-slide ${i===0?'cur':''}" data-i="${i}">
          <span class="n">Слайд ${i+1} / ${L.slides.length}</span>
          <h3>${s.t}</h3>
          <div class="pic">${s.svg}</div>
          <ul>${s.pts.map(p=>`<li>${p}</li>`).join('')}</ul>
        </div>`).join('')}
      </div>
      <div class="ac-slides-nav">
        <button class="ac-arrow" onclick="acSlideGo(-1)"><svg class="i"><use href="#i-back"/></svg></button>
        <span class="ac-dots" id="acDots">${L.slides.map((_,i)=>`<i class="${i===0?'on':''}"></i>`).join('')}</span>
        <button class="ac-arrow next" onclick="acSlideGo(1)"><svg class="i"><use href="#i-back"/></svg></button>
      </div>
    </div>

    <h2 class="section-h" style="margin:24px 0 10px;font-size:21px">Конспект</h2>
    ${acNotesHtml()}

    <h2 class="section-h" style="margin:24px 0 10px;font-size:21px">Тест по материалу</h2>
    <div class="card" id="acTestBox"></div>

    <h2 class="section-h" style="margin:24px 0 10px;font-size:21px">Практика</h2>
    <div class="card" id="acTaskBox"></div>

    <h2 class="section-h" style="margin:24px 0 10px;font-size:21px">Мини-игра</h2>
    <div class="card" id="acGameBox"></div>

    <h2 class="section-h" style="margin:24px 0 10px;font-size:21px">Прогресс урока</h2>
    <div class="card" style="padding:8px 16px 14px" id="acProgressBox"></div>

    <div style="height:14px"></div>
    <div id="acCertBox"></div>
    <div style="height:16px"></div>`;
}

/* ---------- а) ВИДЕО ---------- */
function acRenderVideoBox(){
  const box = document.getElementById('acVideoBox');
  if(!box) return;
  const L = acCur(), ls = acLS();
  const cover = `
    <div class="ac-player" onclick="acPlay()" id="acPlayer">
      <svg class="ac-cover" viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice">
        <rect width="640" height="360" fill="#070a04"/>
        <g stroke="rgba(154,255,0,.09)" stroke-width="1">
          ${[80,160,240,320,400,480,560].map(x=>`<line x1="${x}" y1="0" x2="${x}" y2="360"/>`).join('')}
          ${[72,144,216,288].map(y=>`<line x1="0" y1="${y}" x2="640" y2="${y}"/>`).join('')}
        </g>
        <circle cx="530" cy="80" r="120" fill="rgba(154,255,0,.07)"/>
        <use href="#i-logo" x="472" y="34" width="120" height="120"/>
        <text x="48" y="238" font-family="'Bebas Neue',Impact,sans-serif" font-weight="700" font-size="47" fill="#fff" letter-spacing="1">${L.c1}</text>
        <text x="48" y="302" font-family="'Bebas Neue',Impact,sans-serif" font-weight="700" font-size="58" fill="#9AFF00" letter-spacing="4">${L.c2}</text>
        <text x="48" y="330" font-family="Montserrat,sans-serif" font-size="15" font-weight="600" fill="rgba(255,255,255,.55)" letter-spacing="3">АКАДЕМИЯ OKO · УРОК ${acL+1}</text>
      </svg>
      <div class="ac-play-btn"><svg class="i"><use href="#i-play"/></svg></div>
      <span class="dur">${L.dur || 'скоро'}</span>
    </div>`;
  const player = L.videoUrl
    ? `<div class="ac-player" style="cursor:default"><video controls playsinline src="${L.videoUrl}"></video></div>`
    : cover;
  box.innerHTML = player + `
    <div class="ac-video-actions">${ls.video
      ? `<span class="ac-done-chip">${I('check2')} Видео просмотрено</span>`
      : `<button class="btn" onclick="acMarkVideo()">${I('check2')} Отметить просмотренным</button>`}
    </div>`;
}
function acPlay(){
  if(acCur().videoUrl) return;
  showPopup({ico:'circle-play', title:'Видео урока в производстве',
    body:'Ролик урока «'+acCur().title+'» сейчас монтируется: озвучка, анимации и караоке-субтитры по стандарту Академии. Совсем скоро он появится прямо здесь. Пока изучи слайды ниже — в них весь материал урока.',
    actions:[{label:'Понятно'}]});
}
function acMarkVideo(){
  acLS().video = true; acSave();
  toast('Видео засчитано · +20% к уроку');
  acRenderVideoBox(); acRenderProgressBox(); acRenderCertBox();
}

/* ---------- б) СЛАЙДЫ ---------- */
let acSlideIdx = 0;
function acBindSlides(){
  const el = document.getElementById('acSlides');
  if(!el) return;
  acSlideIdx = 0;
  let raf = null;
  el.addEventListener('scroll', ()=>{
    if(raf) return;
    raf = requestAnimationFrame(()=>{
      raf = null;
      const kids = el.children;
      if(!kids.length) return;
      const step = kids[0].offsetWidth + 12;
      const i = Math.max(0, Math.min(acCur().slides.length-1, Math.round(el.scrollLeft / step)));
      if(i !== acSlideIdx){ acSlideIdx = i; acSlideSync(); }
    });
  }, {passive:true});
}
function acSlideSync(){
  const dots = document.querySelectorAll('#acDots i');
  dots.forEach((d,i)=>d.classList.toggle('on', i===acSlideIdx));
  document.querySelectorAll('#acSlides .ac-slide').forEach((s,i)=>s.classList.toggle('cur', i===acSlideIdx));
  const ls = acLS();
  if(acSlideIdx > ls.slideMax){ ls.slideMax = acSlideIdx; acSave(); }
  if(ls.slideMax >= acCur().slides.length-1 && !ls.slides){
    ls.slides = true; acSave();
    toast('Слайды пройдены · +20% к уроку');
    acRenderProgressBox(); acRenderCertBox();
  }
}
function acSlideGo(d){
  const el = document.getElementById('acSlides');
  if(!el || !el.children.length) return;
  const step = el.children[0].offsetWidth + 12;
  const i = Math.max(0, Math.min(acCur().slides.length-1, acSlideIdx + d));
  el.scrollTo({left: i*step, behavior:'smooth'});
  acSlideIdx = i; acSlideSync();
}

/* ---------- в) ТЕСТ ---------- */
function acRenderTestBox(){
  const box = document.getElementById('acTestBox');
  if(!box) return;
  const quiz = acCur().quiz, ls = acLS();
  if(!acQuiz){
    box.innerHTML = ls.test
      ? `<div class="ac-score" style="font-size:52px">${ls.testScore}%</div>
         <div class="ac-score-sub">Тест сдан. Лучший результат — <b>${ls.testScore}%</b> при пороге ${AC_PASS}%.</div>
         <button class="btn ghost" onclick="acQuizStart()">Пройти заново</button>`
      : `<p style="font-size:13.5px;line-height:1.55">${quiz.length} вопросов по материалу урока. По одному на экран, порог зачёта — <b style="color:var(--accent)">${AC_PASS}%</b>.${ls.testScore?` Прошлая попытка: ${ls.testScore}%.`:''}</p>
         <div style="height:12px"></div>
         <button class="btn" onclick="acQuizStart()">${I('bolt')} ${ls.testScore?'Попробовать ещё раз':'Начать тест'}</button>`;
    return;
  }
  if(acQuiz.done){
    const score = acQuiz.score, pass = score >= AC_PASS;
    box.innerHTML = `
      <div class="ac-score" id="acScoreNum" ${pass?'':'style="color:var(--danger);text-shadow:none"'}>0%</div>
      <div class="ac-score-sub">${pass
        ? `Порог ${AC_PASS}% пройден — <b>тест зачтён</b>. Верных ответов: ${acQuiz.hits} из ${quiz.length}.`
        : `<span class="fail">Не хватило до порога ${AC_PASS}%.</span> Верных: ${acQuiz.hits} из ${quiz.length}. Пролистай слайды и попробуй снова.`}</div>
      <button class="btn ${pass?'ghost':''}" onclick="acQuizStart()">Пройти заново</button>`;
    const el = document.getElementById('acScoreNum');
    acCountUp(el, score, '%');
    return;
  }
  const q = quiz[acQuiz.i];
  box.innerHTML = `
    <div class="ac-quiz-top"><span>Вопрос <b>${acQuiz.i+1}</b> из ${quiz.length}</span><span>верных: <b>${acQuiz.hits}</b></span></div>
    <div class="progress" style="margin:0 0 4px"><i style="width:${(acQuiz.i/quiz.length*100)}%"></i></div>
    <div class="ac-q">${q.q}</div>
    ${q.o.map((o,i)=>`<button class="ac-opt" id="acOpt${i}" onclick="acAnswer(${i})"><span class="lb">${'АБВГ'[i]}</span><span>${o}</span></button>`).join('')}`;
}
function acQuizStart(){
  acQuiz = {i:0, hits:0, lock:false, done:false, score:0};
  acRenderTestBox();
}
function acAnswer(i){
  if(!acQuiz || acQuiz.lock || acQuiz.done) return;
  acQuiz.lock = true;
  const quiz = acCur().quiz;
  const q = quiz[acQuiz.i];
  const right = i === q.a;
  if(right) acQuiz.hits++;
  const ok = document.getElementById('acOpt'+q.a);
  if(ok) ok.classList.add('ok');
  if(!right){ const bad = document.getElementById('acOpt'+i); if(bad) bad.classList.add('bad'); }
  setTimeout(()=>{
    acQuiz.lock = false;
    acQuiz.i++;
    if(acQuiz.i >= quiz.length){
      acQuiz.done = true;
      acQuiz.score = Math.round(acQuiz.hits / quiz.length * 100);
      const ls = acLS();
      if(acQuiz.score > ls.testScore) ls.testScore = acQuiz.score;
      if(acQuiz.score >= AC_PASS && !ls.test){
        ls.test = true;
        toast('Тест сдан · +20% к уроку');
      }
      acSave();
      acRenderProgressBox(); acRenderCertBox();
    }
    acRenderTestBox();
  }, right ? 700 : 1100);
}
function acCountUp(el, to, suffix){
  if(!el) return;
  const t0 = performance.now(), dur = 950;
  (function step(t){
    const k = Math.min(1, (t-t0)/dur), e = 1 - Math.pow(1-k, 3);
    el.textContent = Math.round(to*e) + (suffix||'');
    if(k < 1) requestAnimationFrame(step);
  })(t0);
}

/* ---------- г) ПРАКТИКА ---------- */
function acRenderTaskBox(){
  const box = document.getElementById('acTaskBox');
  if(!box) return;
  const T = acCur().task, ls = acLS();
  if(acTaskChecking){
    box.innerHTML = `<div class="ac-checking"><span class="ac-spin"></span>
      <div><p>Проверяется ИИ-куратором<small>Сверяю ответ с материалом урока…</small></p></div></div>`;
    return;
  }
  if(ls.task){
    box.innerHTML = `
      <div class="ac-verdict">
        <div class="h">${I('check2')} Зачтено</div>
        <p>${T.verdict}</p>
      </div>
      <div style="height:10px"></div>
      <p class="dim" style="font-size:12px;line-height:1.5">Твой ответ: «${esc(ls.taskText.slice(0,140))}${ls.taskText.length>140?'…':''}»</p>`;
    return;
  }
  box.innerHTML = `
    <p style="font-size:13.5px;line-height:1.55">${T.intro}</p>
    <div class="ac-task-formula">${T.chips.map((c,i)=>(i? I('chev'):'')+`<span>${c}</span>`).join('')}</div>
    <textarea class="ac-task-ta" id="acTaskTa" placeholder="${esc(T.ph)}">${esc(ls.taskText)}</textarea>
    <div style="height:10px"></div>
    <button class="btn" onclick="acTaskSend()">${I('send')} Отправить на проверку</button>`;
}
function acTaskSend(){
  const ta = document.getElementById('acTaskTa');
  const v = (ta && ta.value || '').trim();
  if(v.length < 40){ toast('Раскрой подробнее — минимум 40 символов'); return; }
  const ls = acLS();
  ls.taskText = v; acSave();
  acTaskChecking = true;
  acRenderTaskBox();
  setTimeout(()=>{
    acTaskChecking = false;
    ls.task = true; acSave();
    toast('Практика зачтена · +20% к уроку');
    acRenderTaskBox(); acRenderProgressBox(); acRenderCertBox();
  }, 4000);
}

/* ---------- д) МИНИ-ИГРА ---------- */
function acShuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
function acRenderGameBox(){
  const box = document.getElementById('acGameBox');
  if(!box) return;
  const pairs = acCur().pairs, ls = acLS();
  if(!acG){
    box.innerHTML = ls.game
      ? `<div class="ac-game-done"><div class="big">${pairs.length} / ${pairs.length}</div>
         <p>Все пары собраны${ls.gameWrong!==null?` · ошибок: ${ls.gameWrong}`:''}. Материал урока — в связке.</p>
         <button class="btn ghost" onclick="acGameStart()">Сыграть ещё раз</button></div>`
      : `<p style="font-size:13.5px;line-height:1.55"><b>Сопоставь пары.</b> Тапни элемент слева, затем его пару справа. Верная пара улетает, неверная — трясётся.</p>
         <div style="height:12px"></div>
         <button class="btn" onclick="acGameStart()">${I('play')} Играть</button>`;
    return;
  }
  const left = acG.left.map(i=>`<button class="ac-tile ${acG.sel===i?'sel':''}" id="acGL${i}" onclick="acGPick(${i})">${pairs[i][0]}</button>`).join('');
  const right = acG.right.map(i=>`<button class="ac-tile" id="acGR${i}" onclick="acGMatch(${i})">${pairs[i][1]}</button>`).join('');
  box.innerHTML = `
    <div class="ac-game-score"><span>Собрано пар: <b>${acG.hits} / ${pairs.length}</b></span><span>ошибок: <b>${acG.wrong}</b></span></div>
    <div class="ac-game-cols">
      <div class="ac-game-col"><div class="h">Понятие</div>${left}</div>
      <div class="ac-game-col"><div class="h">Пара</div>${right}</div>
    </div>`;
}
function acGameStart(){
  const idx = acCur().pairs.map((_,i)=>i);
  acG = {left:idx.slice(), right:acShuffle(idx), sel:null, hits:0, wrong:0, lock:false};
  acRenderGameBox();
}
function acGPick(i){
  if(!acG || acG.lock) return;
  acG.sel = acG.sel === i ? null : i;
  acG.left.forEach(k=>{
    const el = document.getElementById('acGL'+k);
    if(el) el.classList.toggle('sel', acG.sel===k);
  });
}
function acGMatch(i){
  if(!acG || acG.lock) return;
  if(acG.sel === null){ toast('Сначала выбери элемент слева'); return; }
  const L = document.getElementById('acGL'+acG.sel), R = document.getElementById('acGR'+i);
  if(acG.sel === i){
    acG.lock = true;
    if(L) L.classList.add('hit');
    if(R) R.classList.add('hit');
    setTimeout(()=>{
      acG.left = acG.left.filter(k=>k!==i);
      acG.right = acG.right.filter(k=>k!==i);
      acG.hits++; acG.sel = null; acG.lock = false;
      if(!acG.left.length){
        const wrong = acG.wrong;
        acG = null;
        const ls = acLS();
        ls.gameWrong = wrong;
        if(!ls.game){ ls.game = true; toast('Мини-игра пройдена · +20% к уроку'); }
        acSave();
        acRenderGameBox(); acRenderProgressBox(); acRenderCertBox();
      } else acRenderGameBox();
    }, 560);
  } else {
    acG.wrong++;
    if(L) L.classList.add('shake');
    if(R) R.classList.add('shake');
    acG.lock = true;
    setTimeout(()=>{
      acG.lock = false; acG.sel = null;
      acRenderGameBox();
    }, 460);
  }
}

/* ---------- прогресс: чек-лист 5 пунктов ---------- */
function acRenderProgressBox(){
  const box = document.getElementById('acProgressBox');
  if(!box) return;
  const pct = acLessonPct(acL);
  const next = (acL < AC_COURSE.length-1 && acLessonDone(acL))
    ? `<p class="dim" style="font-size:12px;text-align:center;margin-top:4px">Урок ${acL+2} «${AC_COURSE[acL+1].title}» открыт</p>` : '';
  box.innerHTML = acItems(acL).map(([label,done])=>`
    <div class="ac-check-row ${done?'done':''}">
      <span class="ac-check-ic"><svg class="i"><use href="#i-check2"/></svg></span>
      <span>${label}</span><span class="pct">${done?'+20%':'—'}</span>
    </div>`).join('') + `
    <div class="progress" style="margin:12px 0 6px"><i style="width:${pct}%"></i></div>
    <p class="dim" style="font-size:12px;text-align:center">Урок пройден на <b style="color:var(--accent)">${pct}%</b></p>` + next;
}

/* ================= КОНСПЕКТ УРОКА (лонгрид из слайдов) ================= */
function acNotesStrip(h){ return String(h).replace(/<[^>]+>/g,''); }
function acNotesWords(){
  return acCur().slides.reduce((n,s)=>n + acNotesStrip(s.t + ' ' + s.pts.join(' ')).split(/\s+/).length, 0);
}
function acNotesHtml(){
  const L = acCur();
  const mins = Math.max(2, Math.round(acNotesWords() / 150));
  const secs = L.slides.map((s,i)=>{
    const p = s.pts.map(t=>t.trim().replace(/[.!…]+\s*$/,'')).join('. ') + '.';
    return `<div class="ac-note-sec"><span class="n">${String(i+1).padStart(2,'0')}</span><h4>${s.t}</h4><p>${p}</p></div>`;
  }).join('');
  return `
  <div class="card ac-notes" id="acNotes">
    <button class="ac-notes-head" onclick="acNotesToggle()">
      <span class="ico">${I('file')}</span>
      <span class="meta"><b>Текстовая версия урока</b><span>${L.slides.length} разделов · ~${mins} мин чтения · весь материал без видео</span></span>
      <svg class="i chev"><use href="#i-chev"/></svg>
    </button>
    <div class="ac-notes-body">
      <p class="ac-notes-intro">Полный конспект урока «${L.title}» — все тезисы слайдов, собранные в один читабельный текст. Удобно повторить перед тестом или сохранить себе.</p>
      ${secs}
      <div style="height:14px"></div>
      <button class="btn ghost" style="width:100%" onclick="acNotesDownload()">${I('file')} Скачать .txt</button>
    </div>
  </div>`;
}
function acNotesToggle(){
  const el = document.getElementById('acNotes');
  if(el) el.classList.toggle('open');
}
function acNotesTxt(){
  const L = acCur();
  let out = 'АКАДЕМИЯ OKO · КУРС «НЕЙРОСЕТИ 2026»\r\n'
          + 'КОНСПЕКТ · УРОК ' + (acL+1) + ' — ' + L.title.toUpperCase() + '\r\n'
          + '='.repeat(46) + '\r\n\r\n';
  L.slides.forEach((s,i)=>{
    out += (i+1) + '. ' + acNotesStrip(s.t).toUpperCase() + '\r\n';
    s.pts.forEach(p=>{ out += '   — ' + acNotesStrip(p) + '\r\n'; });
    out += '\r\n';
  });
  out += '-'.repeat(46) + '\r\nПройди тест и получи официальный сертификат OKO:\r\nhttps://true-journey-418.higgsfield.app\r\n';
  return out;
}
function acNotesDownload(){
  try{
    const blob = new Blob(['\ufeff' + acNotesTxt()], {type:'text/plain;charset=utf-8'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'OKO-урок-' + (acL+1) + '-конспект.txt';
    document.body.appendChild(a); a.click();
    setTimeout(()=>{ try{ URL.revokeObjectURL(a.href); }catch(e){} a.remove(); }, 800);
    toast('Конспект сохранён: урок ' + (acL+1) + '.txt');
  }catch(e){
    acCopyText(acNotesTxt(), 'Скачивание недоступно — конспект скопирован в буфер');
  }
}

/* ================= НАПОМИНАНИЕ (раз в сутки при входе) ================= */
function acRemindCheck(){
  try{
    if(!localStorage.getItem('oko-auth')) return;            // ещё не в приложении
    if(document.getElementById('okoPopup')) return;          // другой попап — не мешаем, покажем в след. заход
    const scr = document.getElementById('screen-academy');
    if(scr && scr.classList.contains('active')) return;      // уже в академии
    const today = acDayStr();
    if(acS.remindDay === today) return;                      // раз в сутки
    const nx = acNextLesson();
    if(nx < 0) return;                                       // всё пройдено — не беспокоим
    const left = 100 - acLessonPct(nx);
    acS.remindDay = today; acSave();
    showPopup({ico:'star', title:'Академия OKO',
      body:'Продолжи урок ' + (nx+1) + ' «' + esc(AC_COURSE[nx].title) + '» — осталось <b style="color:var(--accent)">' + left + '%</b> до полного прохождения.',
      actions:[
        {label:'Продолжить урок', onclick:()=>{ showTab('academy'); acOpenLesson(nx); }},
        {label:'Позже', ghost:true}
      ]});
  }catch(e){}
}

/* ================= ПОДЕЛИТЬСЯ СЕРТИФИКАТОМ ================= */
function acCopyText(t, okMsg){
  const done = ()=>toast(okMsg || 'Скопировано в буфер');
  const fallback = ()=>{
    try{
      const ta = document.createElement('textarea');
      ta.value = t; ta.style.cssText = 'position:fixed;top:-200px;opacity:0';
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove(); done();
    }catch(e){ toast('Не удалось скопировать'); }
  };
  if(navigator.clipboard && navigator.clipboard.writeText)
    navigator.clipboard.writeText(t).then(done).catch(fallback);
  else fallback();
}
function acCertShare(i){
  const c = (typeof i === 'number') ? acS.certs[i] : acCertRec();
  if(!c){ toast('Сертификат ещё не выдан'); return; }
  const text = 'Официальный сертификат Академии OKO ' + c.no
    + ' — урок ' + ((c.lesson||0)+1) + ' «' + (c.lessonTitle || AC_COURSE[c.lesson||0].title)
    + '» пройден, тест ' + c.score + '%. Учись со мной в OKO: https://true-journey-418.higgsfield.app';
  if(navigator.share){
    navigator.share({title:'Сертификат Академии OKO', text:text}).catch(()=>{});
  } else {
    acCopyText(text, 'Текст сертификата скопирован — вставь в любой чат');
  }
}

/* ================= СЕРТИФИКАТ ================= */
function acRenderCertBox(){
  const box = document.getElementById('acCertBox');
  if(!box) return;
  const ls = acLS();
  const okV = ls.video, okT = ls.testScore >= AC_PASS;
  if(ls.cert){
    box.innerHTML = `
      <div class="card ac-cert-card ready">
        <div class="ac-cert-head">
          <span class="ico"><svg class="i"><use href="#i-star"/></svg></span>
          <div><h3>Сертификат получен</h3><p>Официальный документ Академии OKO с печатью и подписью</p></div>
        </div>
        <span class="ac-cert-no">${esc(ls.cert.no)} · ${esc(ls.cert.date)} · тест ${ls.cert.score}%</span>
        <div class="ac-cert-actions">
          <button class="btn" onclick="acCertDownload()">${I('file')} Скачать PNG</button>
          <button class="btn ghost" onclick="acCertShow()">${I('eye')} Показать</button>
          <button class="btn ghost ac-ico-btn" onclick="acCertShare()" title="Поделиться" aria-label="Поделиться">${I('share')}</button>
        </div>
      </div>`;
    return;
  }
  if(acCertEligible()){
    box.innerHTML = `
      <div class="card ac-cert-card ready">
        <div class="ac-cert-head">
          <span class="ico"><svg class="i"><use href="#i-star"/></svg></span>
          <div><h3>Сертификат готов к выдаче</h3><p>Видео просмотрено, тест сдан на ${ls.testScore}% — условия выполнены</p></div>
        </div>
        <button class="btn" onclick="acIssueCert()">${I('star')} Получить сертификат</button>
      </div>`;
    return;
  }
  box.innerHTML = `
    <div class="card ac-cert-card">
      <div class="ac-cert-head">
        <span class="ico" style="background:var(--raised);color:var(--dim)"><svg class="i"><use href="#i-lock"/></svg></span>
        <div><h3>Сертификат урока</h3><p>Официальный документ с печатью и подписью — за реальный результат</p></div>
      </div>
      <div class="ac-cert-req">
        <div class="${okV?'ok':''}">${I(okV?'check2':'circle-play')} Отметить видео просмотренным</div>
        <div class="${okT?'ok':''}">${I(okT?'check2':'poll')} Сдать тест на ${AC_PASS}% и выше${ls.testScore?` (сейчас ${ls.testScore}%)`:''}</div>
      </div>
    </div>`;
}

function acIssueCert(){
  const ls = acLS();
  const cert = {
    no: 'OKO-CERT-' + String(Math.floor(1e5 + Math.random()*9e5)),
    date: new Date().toLocaleDateString('ru-RU'),
    score: ls.testScore,
    name: (typeof PROFILE!=='undefined' && PROFILE.name) ? PROFILE.name : 'Слушатель Академии',
    lesson: acL,
    lessonTitle: acCur().title
  };
  ls.cert = cert;
  acS.certs.unshift(cert);
  acSave();
  acCertUrl = null;
  toast(acL < AC_COURSE.length-1
    ? 'Сертификат выдан · урок ' + (acL+2) + ' открыт'
    : 'Сертификат выдан: ' + cert.no);
  acRenderCertBox(); acRenderProgressBox();
  acCertShow();
}

/* --- отрисовка canvas 1600×1131 --- */
function acSigImage(cb){
  if(typeof SIGNATURE_B64 === 'undefined'){ cb(null); return; }
  const img = new Image();
  img.onload = ()=>{
    try{
      const c = document.createElement('canvas');
      c.width = img.width; c.height = img.height;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
      for(let i=0; i<p.length; i+=4){
        const lum = (p[i]+p[i+1]+p[i+2]) / 3;
        p[i+3] = Math.round(p[i+3] * (1 - lum/255)); // тёмный штрих → непрозрачный
        p[i]=232; p[i+1]=240; p[i+2]=255;            // перекрас в светлый (для тёмного фона)
      }
      x.putImageData(d, 0, 0);
      cb(c);
    }catch(e){ cb(img); }
  };
  img.onerror = ()=>cb(null);
  img.src = 'data:image/png;base64,' + SIGNATURE_B64;
}
function acRingText(ctx, cx, cy, r, text, font){
  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const step = (Math.PI*2) / text.length;
  for(let i=0; i<text.length; i++){
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(i*step);
    ctx.translate(0, -r);
    ctx.fillText(text[i], 0, 0);
    ctx.restore();
  }
  ctx.restore();
}
function acDrawSeal(ctx, cx, cy, r){
  const blue = '#2b4fd8';
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.12);
  ctx.translate(-cx, -cy);
  // лёгкая подложка, чтобы синяя печать читалась на тёмном
  ctx.beginPath(); ctx.arc(cx, cy, r+6, 0, 7);
  ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fill();
  ctx.strokeStyle = blue; ctx.fillStyle = blue; ctx.globalAlpha = .96;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.lineWidth = 4; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r-7, 0, 7); ctx.lineWidth = 1.5; ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, r*0.6, 0, 7); ctx.lineWidth = 2; ctx.stroke();
  acRingText(ctx, cx, cy, r-24, SEAL_REQ.fio + ' · ' + SEAL_REQ.inn + ' · ', '700 14px Montserrat, Arial');
  acRingText(ctx, cx, cy, r*0.6 - 15, SEAL_REQ.geo + ' · ОФИЦИАЛЬНЫЙ ДОКУМЕНТ · ', '600 9px Montserrat, Arial');
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = '800 21px Montserrat, Arial';
  ctx.fillText(SEAL_REQ.brand, cx, cy-6);
  ctx.font = '600 11px Montserrat, Arial';
  ctx.fillText('АКАДЕМИЯ', cx, cy+16);
  ctx.restore();
}
function acMakeCert(cert, cb){
  const ready = (document.fonts && document.fonts.load)
    ? Promise.all([
        document.fonts.load('100px "Bebas Neue"'),
        document.fonts.load('700 30px Montserrat'),
      ]).catch(()=>{})
    : Promise.resolve();
  ready.then(()=>acSigImage(sig=>{
    const W = 1600, H = 1131;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const lime = '#9AFF00';
    // фон + тонкая сетка
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(154,255,0,.05)'; ctx.lineWidth = 1;
    for(let x=0; x<=W; x+=64){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for(let y=0; y<=H; y+=64){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    // мягкое свечение в углу
    const g = ctx.createRadialGradient(W-220, 180, 40, W-220, 180, 560);
    g.addColorStop(0, 'rgba(154,255,0,.10)'); g.addColorStop(1, 'rgba(154,255,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // двойная лаймовая рамка
    ctx.strokeStyle = lime; ctx.lineWidth = 5; ctx.strokeRect(38, 38, W-76, H-76);
    ctx.lineWidth = 1.5; ctx.globalAlpha = .65; ctx.strokeRect(58, 58, W-116, H-116); ctx.globalAlpha = 1;
    // уголки
    ctx.lineWidth = 5;
    [[38,38,1,1],[W-38,38,-1,1],[38,H-38,1,-1],[W-38,H-38,-1,-1]].forEach(([x,y,dx,dy])=>{
      ctx.beginPath(); ctx.moveTo(x+dx*44, y); ctx.lineTo(x, y); ctx.lineTo(x, y+dy*44); ctx.stroke();
    });
    try{ ctx.letterSpacing = '6px'; }catch(e){}
    ctx.textAlign = 'center';
    // шапка
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.font = '42px "Bebas Neue", Impact, sans-serif';
    ctx.fillText('А К А Д Е М И Я   O K O', W/2, 148);
    // заголовок
    ctx.fillStyle = lime;
    ctx.shadowColor = 'rgba(154,255,0,.45)'; ctx.shadowBlur = 34;
    ctx.font = '150px "Bebas Neue", Impact, sans-serif';
    ctx.fillText('СЕРТИФИКАТ', W/2, 300);
    ctx.shadowBlur = 0;
    try{ ctx.letterSpacing = '2px'; }catch(e){}
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.font = '500 27px Montserrat, Arial';
    ctx.fillText('подтверждает, что', W/2, 372);
    // имя
    ctx.fillStyle = '#fff';
    ctx.font = '96px "Bebas Neue", Impact, sans-serif';
    ctx.fillText(cert.name.toUpperCase(), W/2, 486);
    ctx.strokeStyle = 'rgba(154,255,0,.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(W/2-260, 512); ctx.lineTo(W/2+260, 512); ctx.stroke();
    // курс / урок
    const lessonNo = (typeof cert.lesson === 'number' ? cert.lesson : 0) + 1;
    const lessonTitle = '«' + (cert.lessonTitle || AC_COURSE[0].title).toUpperCase() + '»';
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.font = '500 26px Montserrat, Arial';
    ctx.fillText('успешно прошёл урок ' + lessonNo, W/2, 566);
    ctx.fillStyle = lime;
    let fs = 64;
    ctx.font = fs + 'px "Bebas Neue", Impact, sans-serif';
    while(fs > 40 && ctx.measureText(lessonTitle).width > W-260){
      fs -= 4;
      ctx.font = fs + 'px "Bebas Neue", Impact, sans-serif';
    }
    ctx.fillText(lessonTitle, W/2, 646);
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.font = '500 24px Montserrat, Arial';
    ctx.fillText('курса «Нейросети 2026» Академии OKO', W/2, 696);
    // чип результата
    const chipT = 'Результат теста: ' + cert.score + '%';
    ctx.font = '700 26px Montserrat, Arial';
    const cw = ctx.measureText(chipT).width + 66;
    ctx.fillStyle = 'rgba(154,255,0,.13)';
    ctx.beginPath();
    if(ctx.roundRect) ctx.roundRect(W/2-cw/2, 730, cw, 58, 29); else ctx.rect(W/2-cw/2, 730, cw, 58);
    ctx.fill();
    ctx.strokeStyle = lime; ctx.lineWidth = 1.6; ctx.stroke();
    ctx.fillStyle = lime;
    ctx.fillText(chipT, W/2, 768);
    // дата и номер (слева внизу)
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.font = '600 19px Montserrat, Arial';
    ctx.fillText('ДАТА ВЫДАЧИ', 120, 878);
    ctx.fillStyle = '#fff';
    ctx.font = '46px "Bebas Neue", Impact, sans-serif';
    ctx.fillText(cert.date, 120, 928);
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.font = '600 19px Montserrat, Arial';
    ctx.fillText('НОМЕР', 120, 972);
    ctx.fillStyle = lime;
    ctx.font = '700 26px Montserrat, Arial';
    ctx.fillText('№ ' + cert.no, 120, 1004);
    // подпись (по центру-слева внизу)
    const sx1 = 560, sx2 = 880, sy = 952;
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(sx1, sy); ctx.lineTo(sx2, sy); ctx.stroke();
    if(sig){
      const sw = 300, sh = sw * (sig.height / sig.width);
      ctx.drawImage(sig, (sx1+sx2)/2 - sw/2, sy - sh*0.82, sw, sh);
    }
    ctx.fillStyle = '#fff';
    ctx.font = '600 24px Montserrat, Arial';
    ctx.fillText('/ Ильясов Д.А. /', sx2 + 18, sy + 8);
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    ctx.font = '500 16px Montserrat, Arial';
    ctx.fillText('подпись руководителя Академии', sx1, sy + 32);
    // печать (справа внизу)
    acDrawSeal(ctx, 1350, 900, 138);
    // реквизиты снизу мелко
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,.34)';
    ctx.font = '500 15px Montserrat, Arial';
    ctx.fillText(SEAL_REQ.fio + ' · ' + SEAL_REQ.inn + ' · ' + SEAL_REQ.brand + ' · okoteam.top@gmail.com', W/2, 1076);
    cb(cv.toDataURL('image/png'));
  }));
}

function acCertRec(i){
  if(typeof i === 'number' && acS.certs[i]) return acS.certs[i];
  if(acCertShownNo){
    const shown = acS.certs.find(c=>c.no===acCertShownNo);
    if(shown) return shown;
  }
  return (acView==='lesson' ? acLS().cert : null) || acS.certs[0] || null;
}
function acCertShow(i){
  const cert = (typeof i === 'number') ? acS.certs[i] : (acLS().cert || acCertRec());
  if(!cert){ toast('Сертификат ещё не выдан'); return; }
  const open = url=>{
    const full = document.getElementById('acCertFull');
    const img = document.getElementById('acCertFullImg');
    if(!full || !img) return;
    img.src = url;
    full.classList.add('open');
  };
  if(acCertUrl && acCertShownNo === cert.no){ open(acCertUrl); return; }
  acMakeCert(cert, url=>{ acCertUrl = url; acCertShownNo = cert.no; open(url); });
}
function acCertFullClose(){
  const full = document.getElementById('acCertFull');
  if(full) full.classList.remove('open');
}
function acCertDownload(){
  const cert = acCertRec();
  if(!cert){ toast('Сертификат ещё не выдан'); return; }
  const dl = url=>{
    const a = document.createElement('a');
    a.href = url; a.download = cert.no + '.png';
    document.body.appendChild(a); a.click(); a.remove();
    toast('PNG сохранён: ' + cert.no + '.png');
  };
  if(acCertUrl && acCertShownNo === cert.no){ dl(acCertUrl); return; }
  acMakeCert(cert, url=>{ acCertUrl = url; acCertShownNo = cert.no; dl(url); });
}

/* ================= САМОИНИЦИАЛИЗАЦИЯ ================= */
(function acInit(){
  regTitle('academy', 'Академия');
  addSvcTile({id:'academy', label:'Академия', ico:'star', first:true, onclick:()=>showTab('academy')});
  const _prevShowTabAc = showTab;
  showTab = function(t){
    _prevShowTabAc(t);
    if(t === 'academy'){ acStreakTouch(); acRender(); }
  };
  const scr = document.getElementById('screen-academy');
  if(scr && scr.classList.contains('active')){ acStreakTouch(); acRender(); }
  setTimeout(acRemindCheck, 2200);           // напоминание об уроке — раз в сутки
})();
