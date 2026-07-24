/* ================= ACADEMY: Академия OKO (префикс ac-) =================
   Курс «Нейросети 2026»: 5 уроков (видео + слайды + тест + практика + мини-игра),
   per-урок прогресс и официальный сертификат за КАЖДЫЙ урок
   (canvas: печать + подпись из core-ext). */

const AC_VIDEO_URL = 'https://true-journey-418.higgsfield.app/media/oko_lesson1_web.mp4'; // урок 1, хостится на домене приложения
const AC_PASS = 70;

/* ================= РЕЕСТР ИНСТРУМЕНТОВ (реф-ссылки в кнопках уроков) =================
   Кнопки «Инструменты урока» авто-подставляются по инструментам, упомянутым в слайдах.
   url — куда ведёт кнопка. Реф-ссылки (наша выгода) добавлять сюда же в поле url:
   как только у OKO есть партнёрская ссылка на инструмент — меняем url на неё. */
const AC_TOOLS = {
  'chatgpt':     {name:'ChatGPT',       url:'https://chatgpt.com',            note:'Универсальный ИИ для текста'},
  'claude':      {name:'Claude',        url:'https://claude.ai',              note:'Король длинных текстов и кода'},
  'claude code': {name:'Claude Code',   url:'https://claude.com/claude-code', note:'Код по описанию словами'},
  'gemini':      {name:'Gemini',        url:'https://gemini.google.com',      note:'Свежий поиск + связка с Google'},
  'midjourney':  {name:'Midjourney',    url:'https://midjourney.com',         note:'Лучшая эстетика картинок'},
  'flux':        {name:'Flux',          url:'https://blackforestlabs.ai',     note:'Фотореализм почти бесплатно'},
  'nano banana': {name:'Nano Banana',   url:'https://gemini.google.com',      note:'Правки и текст прямо на картинке'},
  'higgsfield':  {name:'Higgsfield',    url:'https://higgsfield.ai',          note:'Все модели в одном окне'},
  'veo':         {name:'Veo',           url:'https://deepmind.google/models/veo/', note:'Видео премиум-качества + звук'},
  'kling':       {name:'Kling',         url:'https://klingai.com',            note:'Кино за копейки'},
  'runway':      {name:'Runway',        url:'https://runwayml.com',           note:'Видео под маркетинг и монтаж'},
  'elevenlabs':  {name:'ElevenLabs',    url:'https://elevenlabs.io',          note:'Премиум-озвучка'},
  'suno':        {name:'Suno',          url:'https://suno.com',               note:'Готовый трек по запросу'},
  'cursor':      {name:'Cursor',        url:'https://cursor.com',             note:'IDE с ИИ для кода'},
  'lovable':     {name:'Lovable',       url:'https://lovable.dev',            note:'Приложение по описанию'},
  'bolt':        {name:'Bolt',          url:'https://bolt.new',               note:'Сайт/приложение в браузере'},
  'vercel':      {name:'Vercel',        url:'https://vercel.com',             note:'Бесплатный деплой'},
  'cloudflare':  {name:'Cloudflare',    url:'https://cloudflare.com',         note:'Бесплатный хостинг/CDN'},
  'n8n':         {name:'n8n',           url:'https://n8n.io',                 note:'Автоматизация связок'},
  'make':        {name:'Make',          url:'https://make.com',               note:'Визуальная автоматизация'},
  'zapier':      {name:'Zapier',        url:'https://zapier.com',             note:'Связки 9000+ сервисов'},
};
/* Достаём инструменты, упомянутые в слайдах урока (в <b>…</b>), уникально и по порядку. */
function acLessonTools(L){
  const seen = new Set(), out = [];
  const hay = (L.slides||[]).map(s=>(s.pts||[]).join(' ')).join(' ').toLowerCase();
  // сначала многословные ключи (higgsfield soul → higgsfield), затем одиночные
  for(const key of Object.keys(AC_TOOLS)){
    if(seen.has(key)) continue;
    if(hay.includes(key)){ seen.add(key); out.push(AC_TOOLS[key]); }
  }
  return out;
}
function acToolsHtml(L){
  const tools = acLessonTools(L);
  if(!tools.length) return '';
  return `<h2 class="section-h" style="margin:24px 0 10px;font-size:21px">Инструменты урока</h2>
    <p class="dim" style="font-size:12.5px;line-height:1.5;margin:-2px 0 12px">Открывай прямо из урока — пробуй на практике.</p>
    <div class="ac-tools">${tools.map(t=>`
      <a class="ac-tool" href="${t.url}" target="_blank" rel="noopener noreferrer">
        <span class="ac-tool-b"><b>${esc(t.name)}</b><small>${esc(t.note)}</small></span>
        <span class="ac-tool-go">${I('chev')}</span>
      </a>`).join('')}</div>`;
}

/* ================= КУРС: 5 УРОКОВ ================= */
const AC_COURSE_AI = [

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
  sub:'3:05 · Midjourney v7 · Flux · Nano Banana',
  dur:'3:05', videoUrl:'https://true-journey-418.higgsfield.app/media/oko_lesson3_web.mp4',
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

/* ================= КУРС 2 (ПРЕМИУМ): «КОНТЕНТ И REELS» =================
   3 полноценных урока со слайдами, тестом, практикой и мини-игрой.
   Гейт: подписка PRO+ ИЛИ разовая покупка. */
const AC_COURSE_REELS = [

/* ---------- УРОК: Вирусный сценарий за 15 минут ---------- */
{
  title:'Вирусный сценарий за 15 минут',
  sub:'хук · удержание · триггеры репостов',
  dur:'', videoUrl:'',
  c1:'ВИРУСНЫЙ', c2:'СЦЕНАРИЙ',
  slides:[
  {t:'Анатомия вирусного ролика', pts:[
    'Сначала <b>структура</b>, потом съёмка — не наоборот',
    'Четыре блока: <b>хук → удержание → развязка → CTA</b>',
    'Один ролик — одна мысль, всё лишнее режь',
    'Длина под смысл: чаще 7–40 секунд'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="10" y="14" width="18" height="42" rx="4" fill="currentColor" fill-opacity=".18"/><rect x="34" y="14" width="18" height="42" rx="4"/><rect x="58" y="14" width="18" height="42" rx="4"/><rect x="82" y="14" width="18" height="42" rx="4"/><path d="M19 24v22M43 24v22M67 24v22M91 24v22" opacity=".6"/><path d="M104 20v30" opacity=".5"/><path d="M14 62h92" opacity=".4"/></svg>'},
  {t:'Хук: первые 2 секунды', pts:[
    'В первые 2 секунды — <b>обещание выгоды</b> или интрига',
    'Хук-текст на экране <b>плюс</b> голос — работают вместе',
    'Заходит: вопрос, цифра, конфликт, «не делай это»',
    'Никаких длинных заставок — сразу к сути'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M28 46 20 12l30 20-14 4 10 20z" fill="currentColor" stroke="none" opacity=".9"/><path d="M64 20h40M64 32h32M64 44h40" opacity=".75"/><circle cx="58" cy="20" r="2" fill="currentColor" stroke="none"/><circle cx="58" cy="32" r="2" fill="currentColor" stroke="none"/><circle cx="58" cy="44" r="2" fill="currentColor" stroke="none"/></svg>'},
  {t:'Удержание: петли внимания', pts:[
    'Микро-обещания: «дальше покажу, как…» — тянут дальше',
    'Смена плана каждые <b>2–3 секунды</b> — глазу не скучно',
    'Показывай визуальный прогресс к развязке',
    'Убирай паузы и «воздух» — плотность держит досмотр'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 40c14-30 30 30 44 0s30-30 44 0" opacity=".85"/><circle cx="12" cy="40" r="3" fill="currentColor" stroke="none"/><circle cx="34" cy="28" r="3" fill="currentColor" stroke="none"/><circle cx="56" cy="40" r="3" fill="currentColor" stroke="none"/><circle cx="78" cy="52" r="3" fill="currentColor" stroke="none"/><circle cx="100" cy="40" r="3" fill="currentColor" stroke="none"/></svg>'},
  {t:'Сторителлинг за 20 секунд', pts:[
    'Схемы, что цепляют: <b>было → стало</b>, ошибка → решение',
    'Конфликт в начале держит до самой развязки',
    'Эмоция важнее фактов — сначала прочувствовать',
    'Герой = зритель: он должен узнать себя'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="10" y="18" width="38" height="34" rx="6"/><path d="M18 44l10-9 7 6 5-5" opacity=".6"/><rect x="72" y="18" width="38" height="34" rx="6" fill="currentColor" fill-opacity=".15"/><path d="M80 44l9-12 7 8 6-6"/><path d="M52 35h16M62 30l6 5-6 5"/></svg>'},
  {t:'Триггеры репостов', pts:[
    'Люди делятся ради <b>пользы, статуса, эмоции, узнавания</b>',
    '«Сохрани, чтобы не потерять» — двигает в сохранения',
    'Спорное, но честное мнение = комментарии и споры',
    'Дай зрителю повод сказать: «это про меня»'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="26" cy="35" r="9"/><circle cx="90" cy="18" r="8"/><circle cx="90" cy="52" r="8"/><path d="M34 31l48-10M34 39l48 8"/><path d="M22 35l3 3 6-7" opacity=".7"/></svg>'},
  {t:'CTA без впаривания', pts:[
    'Один призыв на ролик — не распыляй внимание',
    'Мягко: «подпишись, если было полезно»',
    'Вопрос в конце — запускает комментарии',
    'Закреплённый комментарий продолжает воронку'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="24" y="24" width="72" height="26" rx="13" fill="currentColor" fill-opacity=".16"/><path d="M40 37h30" /><path d="M66 31l7 6-7 6"/><path d="M60 12v6M84 16l-4 5M36 16l4 5" opacity=".6"/></svg>'},
  {t:'Форматы, что залетают', pts:[
    'Обучалка, разбор, реакция, POV, листикл-подборка',
    'Бери тренд и <b>адаптируй под свою нишу</b>, а не копируй',
    'Серийность: «часть 1 из 3» — зритель ждёт продолжения',
    'Свой повторяемый формат = стабильные охваты'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="12" y="14" width="26" height="42" rx="5"/><rect x="47" y="14" width="26" height="42" rx="5" fill="currentColor" fill-opacity=".15"/><rect x="82" y="14" width="26" height="42" rx="5"/><path d="M20 26v18M55 26v18M90 26v18" opacity=".5"/><path d="M57 35l6-5v10z" fill="currentColor" stroke="none"/></svg>'},
  {t:'Чек-лист сценария', pts:[
    'Хук ≤ 2 секунд и одна ясная мысль',
    'Петли удержания и смена планов',
    'Эмоция и узнавание для репоста',
    'CTA-вопрос + караоке-субтитры'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="26" y="6" width="68" height="58" rx="8"/><path d="M36 20l4 4 7-8M36 36l4 4 7-8M36 52l4 4 7-8" stroke-width="2.8"/><path d="M54 21h28M54 37h28M54 53h20"/></svg>'},
  ],
  quiz:[
  {q:'С чего начинается вирусный ролик по уроку?', o:['Со съёмки красивых кадров','Со структуры: хук → удержание → развязка → CTA','С подбора музыки','С покупки рекламы'], a:1},
  {q:'Задача хука в первые 2 секунды —', o:['Показать логотип','Дать обещание выгоды или интригу','Перечислить регалии автора','Поставить длинную заставку'], a:1},
  {q:'Что удерживает зрителя до конца?', o:['Длинные паузы','Микро-обещания и смена планов каждые 2–3 с','Один статичный кадр','Отсутствие субтитров'], a:1},
  {q:'Фраза «сохрани, чтобы не потерять» работает на…', o:['Лайки','Сохранения','Отписки','Рекламу'], a:1},
  {q:'Сколько призывов (CTA) стоит давать в одном ролике?', o:['Как можно больше','Один чёткий','Ни одного','Ровно пять'], a:1},
  {q:'Правильная работа с трендом —', o:['Скопировать один в один','Адаптировать под свою нишу','Игнорировать тренды','Ждать, пока тренд умрёт'], a:1},
  ],
  pairs:[
  ['Хук','Первые 2 секунды: выгода или интрига'],
  ['Петля удержания','«Дальше покажу, как…»'],
  ['Триггер репоста','«Это же про меня»'],
  ['CTA','Один вопрос в конце ролика'],
  ['Серийность','«Часть 1 из 3»'],
  ],
  task:{
    intro:'Собери каркас вирусного ролика для своей ниши по структуре урока:',
    chips:['Хук','Удержание','Развязка','CTA'],
    ph:'Пример: Хук — «Три ошибки убивают ваши Reels» (текст + голос, 2 с). Удержание — разбираю каждую ошибку с примером, смена плана каждые 2 с. Развязка — как сделать правильно. CTA — «Какая ошибка была у тебя? Пиши в комментах».',
    verdict:'Структура собрана верно: сильный хук, петли удержания и один чёткий CTA. Совет куратора: вынеси хук-текст на экран крупно — так он сработает даже без звука.'
  }
},

/* ---------- УРОК: Монтаж Reels, который держит ---------- */
{
  title:'Монтаж Reels, который держит',
  sub:'ритм · караоке-субтитры · звук и цвет',
  dur:'', videoUrl:'',
  c1:'МОНТАЖ', c2:'REELS',
  slides:[
  {t:'Ритм решает всё', pts:[
    'Режь <b>по музыке и речи</b> — склейки на битах и словах',
    'Удаляй «воздух»: вдохи, паузы, запинки',
    'Средний план держи <b>1,5–2,5 секунды</b>',
    'Плотный ритм = высокий досмотр'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M10 35h8M22 22v26M30 30v10M38 16v38M46 26v18M54 20v30M62 32v6M70 18v34M78 28v14M86 22v26M94 30v10M102 24v22M110 35h0"/></svg>'},
  {t:'Джамп-каты и динамика', pts:[
    'Склейка на слове убирает лишнее и ускоряет темп',
    '<b>Zoom-панч</b> на акценте добавляет энергии',
    'Никаких «мёртвых» кадров, где ничего не происходит',
    'Движение в кадре — постоянно, под темп'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="20" width="40" height="30" rx="5"/><rect x="66" y="14" width="40" height="42" rx="5"/><path d="M78 26l16 18M94 26L78 44" opacity=".7"/><path d="M56 35h10M62 31l5 4-5 4"/></svg>'},
  {t:'Караоке-субтитры', pts:[
    '<b>90% смотрят без звука</b> — субтитры обязательны',
    'Крупно, с контрастом, читаемо на любом фоне',
    'Подсветка <b>по слову</b> в бренд-цвете держит взгляд',
    'Не перекрывай интерфейс площадки снизу'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="44" y="6" width="32" height="58" rx="8"/><rect x="50" y="40" width="12" height="7" rx="2" fill="currentColor" stroke="none"/><path d="M64 43h6" opacity=".7"/><path d="M50 50h20" opacity=".6"/><path d="M22 30c4 6 4 12 0 18M104 30c-4 6-4 12 0 18" opacity=".5"/></svg>'},
  {t:'Звук: музыка и SFX', pts:[
    'Музыка — <b>под смысл</b> сцены, а не просто фоном',
    'SFX под каждое движение — свуши, клики, удары',
    '<b>Дакинг</b>: приглушай музыку под голос',
    'Звук-хук в первую секунду цепляет ухо'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 28v14M22 22v26M30 32v6M38 18v34M46 26v18" stroke-width="2.8"/><path d="M70 46V18l22-6v28" stroke-linejoin="round"/><circle cx="64" cy="46" r="6"/><circle cx="86" cy="40" r="6"/></svg>'},
  {t:'Цвет и единый стиль', pts:[
    'Единый <b>пресет/LUT</b> на весь ролик — картинка «дорогая»',
    'Держи бренд-палитру: акцентный цвет узнаётся',
    'Контраст текста и фона — читаемость прежде всего',
    'Одинаковый стиль в серии = сильный бренд'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="40" cy="35" r="22"/><path d="M40 13a22 22 0 0 1 0 44z" fill="currentColor" stroke="none" opacity=".85"/><circle cx="86" cy="24" r="6" fill="currentColor" stroke="none" opacity=".9"/><circle cx="100" cy="38" r="6"/><circle cx="86" cy="50" r="6" fill="currentColor" stroke="none" opacity=".5"/></svg>'},
  {t:'B-roll и перебивки', pts:[
    'Иллюстрируй слова кадрами — «показывай, не рассказывай»',
    'Сток <b>4K</b> — уникальный, не заезженный',
    'Перебивка прячет склейку и держит темп',
    'Не повторяй один и тот же кадр в ролике'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="10" y="16" width="46" height="34" rx="5"/><circle cx="24" cy="28" r="5"/><path d="M14 46l14-12 10 8 8-7 10 9" opacity=".7"/><rect x="66" y="24" width="44" height="30" rx="5" fill="currentColor" fill-opacity=".14"/><path d="M82 32v14l12-7z" fill="currentColor" stroke="none"/></svg>'},
  {t:'Темп, длина, формат', pts:[
    'Держи плотность до конца — обрезай хвост',
    'Формат <b>1080×1920</b>, вертикаль 9:16',
    'Учитывай safe-зоны под интерфейс площадки',
    'Финал не тяни: закончил мысль — руби'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="46" y="6" width="28" height="58" rx="7"/><path d="M46 16h28M46 54h28" opacity=".45" stroke-dasharray="3 4"/><path d="M55 30v10l10-5z" fill="currentColor" stroke="none"/><path d="M20 24v22M100 24v22" opacity=".5"/></svg>'},
  {t:'Экспорт и превью', pts:[
    'Высокий битрейт — без «мыла» и артефактов',
    '<b>Первый кадр</b> = мини-хук: он же обложка',
    'Обложка с крупным текстом ловит на пролистывании',
    'Проверь ролик <b>на телефоне</b> — смотреть будут там'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="12" y="14" width="44" height="34" rx="5"/><path d="M20 42l12-10 8 7 6-6 10 9" opacity=".7"/><path d="M34 54v6M24 60h20" opacity=".6"/><path d="M70 31h30M86 20l14 11-14 11" /></svg>'},
  ],
  quiz:[
  {q:'По чему в первую очередь режут вирусный ролик?', o:['По таймеру каждые 10 с','По музыке и речи — на битах и словах','Наугад','По длине исходников'], a:1},
  {q:'Караоке-субтитры обязательны, потому что…', o:['Так требует закон','Большинство смотрит без звука','Иначе видео не загрузится','Это дешевле музыки'], a:1},
  {q:'«Дакинг» звука — это…', o:['Замена музыки на тишину','Приглушение музыки под голос','Ускорение трека','Добавление эха'], a:1},
  {q:'Зачем единый пресет/LUT на весь ролик?', o:['Чтобы файл был меньше','Чтобы картинка выглядела дорого и в едином стиле','Чтобы убрать субтитры','Чтобы ускорить экспорт'], a:1},
  {q:'Первый кадр ролика важен, потому что он…', o:['Не виден зрителю','Служит обложкой и мини-хуком','Задаёт длину видео','Отвечает за звук'], a:1},
  {q:'Где обязательно проверить готовый Reels?', o:['Только на большом мониторе','На телефоне — там его и смотрят','В распечатке','Нигде, и так сойдёт'], a:1},
  ],
  pairs:[
  ['Джамп-кат','Склейка на слове, ускоряет темп'],
  ['Караоке-субтитры','Подсветка по слову без звука'],
  ['Дакинг','Музыка тише под голос'],
  ['LUT/пресет','Единый «дорогой» цвет'],
  ['B-roll','Перебивка прячет склейку'],
  ],
  task:{
    intro:'Опиши монтажный план своего Reels по приёмам урока:',
    chips:['Ритм','Джамп-каты','Субтитры','Звук','Цвет'],
    ph:'Пример: Ритм — режу по биту трека, планы по 2 с. Джамп-каты на ключевых словах + zoom-панч на выводе. Субтитры караоке, лаймовый акцент. Звук — трек под энергию + свуш на переходах, дакинг под голос. Цвет — единый пресет, бренд-палитра.',
    verdict:'Монтажный план плотный: ритм по звуку, караоке-сабы и единый цвет. Совет куратора: заложи звук-хук в первую секунду — ухо цепляется раньше, чем глаз.'
  }
},

/* ---------- УРОК: Дистрибуция и алгоритмы 2026 ---------- */
{
  title:'Дистрибуция и алгоритмы 2026',
  sub:'удержание · A/B хуков · масштаб',
  dur:'', videoUrl:'',
  c1:'ДИСТРИБУЦИЯ', c2:'АЛГОРИТМЫ',
  slides:[
  {t:'Как думает алгоритм', pts:[
    'Главное — <b>удержание и досмотры</b>, а не лайки',
    'Репосты и сохранения весят больше лайков',
    'Первые часы после публикации решают судьбу ролика',
    'Алгоритм тестирует видео на малой аудитории'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="60" cy="35" r="12"/><path d="M55 35a5 5 0 0 1 10 0" opacity=".7"/><path d="M60 23V10M60 47v13M48 32 24 22M72 32l24-10M48 38 24 48M72 38l24 10"/><circle cx="20" cy="20" r="4"/><circle cx="100" cy="20" r="4"/><circle cx="20" cy="50" r="4"/><circle cx="100" cy="50" r="4"/></svg>'},
  {t:'Время и частота', pts:[
    '<b>Стабильность</b> важнее редких всплесков',
    'Публикуй регулярно — алгоритм любит ритм',
    'Тестируй окна времени под свою аудиторию',
    'Серия форматов приучает зрителя возвращаться'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="34" cy="35" r="20"/><path d="M34 22v13l9 6"/><path d="M70 20h34M70 32h28M70 44h34" opacity=".7"/><circle cx="64" cy="20" r="1.8" fill="currentColor" stroke="none"/><circle cx="64" cy="32" r="1.8" fill="currentColor" stroke="none"/><circle cx="64" cy="44" r="1.8" fill="currentColor" stroke="none"/></svg>'},
  {t:'Метрики, что смотреть', pts:[
    '<b>Удержание %</b> и среднее время просмотра — главное',
    'Дочитывания до CTA показывают силу концовки',
    'Репосты и сохранения — сигнал ценности',
    'Читай воронку ролика: где зритель уходит'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v52h96"/><rect x="24" y="20" width="12" height="40" rx="3" fill="currentColor" fill-opacity=".18"/><rect x="46" y="30" width="12" height="30" rx="3"/><rect x="68" y="26" width="12" height="34" rx="3"/><rect x="90" y="40" width="12" height="20" rx="3"/><path d="M24 18l22 6 22-2 22 12" opacity=".55" stroke-dasharray="3 4"/></svg>'},
  {t:'A/B хуков и обложек', pts:[
    'Готовь <b>3 варианта хука</b> на один ролик',
    'Меняй за раз только одно — иначе не понять причину',
    'Тестируй обложки: первый кадр решает клик',
    'Решай данными, а не «мне так больше нравится»'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="12" width="34" height="22" rx="5"/><rect x="14" y="38" width="34" height="22" rx="5" fill="currentColor" fill-opacity=".15"/><path d="M52 23h14M62 19l5 4-5 4M52 49h14M62 45l5 4-5 4" opacity=".7"/><rect x="72" y="24" width="34" height="22" rx="5"/><path d="M80 42l4 4 6-8" stroke-width="2.8"/></svg>'},
  {t:'Мультиплатформа', pts:[
    'Один сценарий → <b>Reels, Shorts, TikTok</b>',
    'Адаптируй под площадку, а не тупо копируй',
    'Убирай чужие водяные знаки — их душат алгоритмы',
    'Каждая площадка = дополнительный охват бесплатно'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="10" y="16" width="24" height="38" rx="5"/><rect x="48" y="16" width="24" height="38" rx="5" fill="currentColor" fill-opacity=".15"/><rect x="86" y="16" width="24" height="38" rx="5"/><path d="M18 30l6-4v8zM56 30l6-4v8zM94 30l6-4v8z" fill="currentColor" stroke="none"/></svg>'},
  {t:'Работа с комментариями', pts:[
    'Закрепляй лучший комментарий — продолжает воронку',
    'Отвечай <b>ролик-ответом</b> на частые вопросы',
    'Вовлечение в комментах поднимает охваты',
    'Комьюнити возвращается за новыми видео'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M16 16h54a8 8 0 0 1 8 8v16a8 8 0 0 1-8 8H40l-14 10V48h-2a8 8 0 0 1-8-8V16z"/><path d="M28 28h30M28 38h20" opacity=".7"/><circle cx="96" cy="30" r="10"/><path d="M92 30l3 3 6-7" opacity=".8"/></svg>'},
  {t:'Масштаб: контент-завод', pts:[
    'Снимай <b>пачками</b> — один съёмочный день на неделю',
    'Копи шаблоны приёмов, но <b>без повторов</b> в ленте',
    'Аналитика ежедневно — усиливай залетевшее',
    'Система важнее вдохновения: конвейер стабильнее'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="10" y="14" width="20" height="16" rx="3"/><rect x="10" y="40" width="20" height="16" rx="3"/><rect x="50" y="27" width="20" height="16" rx="3" fill="currentColor" fill-opacity=".16"/><rect x="90" y="14" width="20" height="16" rx="3"/><rect x="90" y="40" width="20" height="16" rx="3"/><path d="M30 22h10l10 9M30 48h10l10-9M70 35h20" opacity=".7"/></svg>'},
  {t:'Чек-лист роста', pts:[
    'Тестируй 3 хука на каждый ролик',
    'Держи удержание выше 50%',
    'CTA-вопрос + триггер репоста',
    'Каждый день — разбор метрик и выводы'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M16 54l22-18 16 10 30-30"/><path d="M74 16h16v16" /><circle cx="16" cy="54" r="3" fill="currentColor" stroke="none"/><circle cx="38" cy="36" r="3" fill="currentColor" stroke="none"/><circle cx="54" cy="46" r="3" fill="currentColor" stroke="none"/></svg>'},
  ],
  quiz:[
  {q:'Что для алгоритма важнее всего?', o:['Число лайков','Удержание и досмотры','Длина описания','Количество хэштегов'], a:1},
  {q:'Какие сигналы весят больше лайков?', o:['Просмотры профиля','Репосты и сохранения','Время публикации','Число подписок автора'], a:1},
  {q:'Как правильно проводить A/B-тест хука?', o:['Менять всё сразу','Менять за раз только одно','Не тестировать вовсе','Смотреть только на лайки'], a:1},
  {q:'Что даёт публикация на нескольких площадках?', o:['Штраф от алгоритма','Дополнительный охват бесплатно','Потерю качества','Ничего'], a:1},
  {q:'Зачем закреплять комментарий?', o:['Для красоты','Продолжить воронку и вовлечение','Скрыть критику','Ускорить загрузку'], a:1},
  {q:'Что важнее для стабильного роста?', o:['Ждать вдохновения','Система и ежедневная аналитика','Один вирусный ролик','Больше хэштегов'], a:1},
  ],
  pairs:[
  ['Удержание %','Главная метрика алгоритма'],
  ['Сохранения','Сигнал ценности контента'],
  ['A/B хука','3 варианта, меняем одно'],
  ['Мультиплатформа','Один сценарий на 3 площадки'],
  ['Контент-завод','Съёмка пачками + аналитика'],
  ],
  task:{
    intro:'Составь план дистрибуции и роста для своего аккаунта:',
    chips:['Частота','Метрика','A/B','Площадки','Разбор'],
    ph:'Пример: Частота — 1 ролик в день, окно 19:00. Метрика — удержание, цель >55%. A/B — 3 хука на ролик, меняю только первый кадр. Площадки — Reels + Shorts + TikTok. Разбор — каждый вечер смотрю воронку и усиливаю залетевший формат.',
    verdict:'План рабочий: стабильная частота, ясная метрика и ежедневный разбор. Совет куратора: заведи таблицу форматов — так быстро увидишь, какой приём стабильно даёт удержание.'
  }
},
];
/* ===== реальные уроки направлений (авторы OKO по методичке) ===== */
/* ============================================================
   ТРЕК 1. МЕДИЙНОСТЬ — уроки 1.1–1.3
   Формат данных Академии OKO (совместим с AC_COURSE).
   ============================================================ */
const MEDIA_LESSONS = [

/* ---------- УРОК 1: Мышление и старт ---------- */
{
  title:'Мышление и старт',
  sub:'1:27 · видео (голос Даниэля) + слайды + тест + игра',
  dur:'1:27',
  videoUrl:'https://okoteam.top/media/oko_media_l1.mp4',
  c1:'МЫШЛЕНИЕ', c2:'И СТАРТ',
  slides:[
  {t:'Курс для трёх типов', pts:[
    'Материал заходит трём аудиториям сразу: <b>новичкам</b>, <b>практикам</b> и <b>бизнесу</b>',
    'Новичку — с нуля собрать блог и первые деньги',
    'Практику — навести порядок в упаковке и контенте',
    'Бизнесу — превратить аккаунт в канал продаж, а не в витрину-заглушку'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="30" cy="24" r="8"/><path d="M17 52c1-11 6-16 13-16s12 5 13 16"/><circle cx="60" cy="20" r="9"/><path d="M45 54c1-13 7-19 15-19s14 6 15 19"/><circle cx="92" cy="24" r="8"/><path d="M79 52c1-11 6-16 13-16s12 5 13 16"/></svg>'},
  {t:'Кейс на себе — сразу', pts:[
    'Не жди конца курса — <b>веди свой аккаунт как полигон</b> с первого дня',
    'Каждый приём проверяешь на своём блоге, а не в теории',
    'Собственный результат = твой первый и главный кейс для продаж',
    'Учиться и делать — одновременно, иначе знания выветрятся'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="18" y="10" width="40" height="50" rx="7"/><path d="M26 22h24M26 31h18M26 40h22M26 49h14" opacity=".7"/><path d="M70 35h26" opacity=".8"/><path d="M88 27l10 8-10 8" opacity=".8"/><circle cx="106" cy="35" r="4" fill="currentColor" stroke="none"/></svg>'},
  {t:'Стадии обучения — это норма', pts:[
    'Энтузиазм → «дайте <b>новое</b>» → «все виноваты» → усталость — проходят все',
    'Спад мотивации не значит, что ты не тянешь — это этап, а не приговор',
    'Плато — момент, где большинство бросает, а ты просто продолжаешь',
    'Знаешь стадии наперёд — не пугаешься их, когда накрывает'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20l22 22 20-14 22 26 22-38"/><circle cx="34" cy="42" r="3" fill="currentColor" stroke="none"/><circle cx="54" cy="28" r="3" fill="currentColor" stroke="none"/><circle cx="76" cy="54" r="3" fill="currentColor" stroke="none"/><path d="M12 60h96" opacity=".4"/></svg>'},
  {t:'Просто начать и снимать', pts:[
    '<b>Кринж-этап проходят все</b> — первые видео всегда кажутся неловкими',
    'Идеальный старт не существует: качество приходит с количеством',
    'Первые 20–30 роликов — это тренировка, а не витрина',
    'Опубликованное «сойдёт» побеждает идеальное «в черновиках»'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="20" y="16" width="54" height="38" rx="7"/><path d="M74 28l24-12v38L74 42z"/><circle cx="38" cy="35" r="7"/><path d="M38 35l4 2" opacity=".7"/></svg>'},
  {t:'Мышление полигона', pts:[
    'Блог — <b>лаборатория</b>: гипотеза → пост → цифры → вывод',
    'Провалившийся формат — не поражение, а данные',
    'Смотри на реакцию аудитории, а не на «нравится мне самому»',
    'Регулярность важнее вдохновения: график бьёт настроение'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M50 8h20M56 8v14M64 8v14"/><path d="M56 22 34 52a8 8 0 0 0 7 12h38a8 8 0 0 0 7-12L64 22"/><path d="M46 44h28" opacity=".7"/><circle cx="55" cy="53" r="2.5" fill="currentColor" stroke="none"/><circle cx="68" cy="55" r="2" fill="currentColor" stroke="none"/></svg>'},
  {t:'Цель в цифрах, а не в мечтах', pts:[
    '«Хочу больше денег» — не цель. <b>Цель — это число и срок</b>',
    'Определи целевые цифры: подписчики, охваты, заявки, доход',
    'Пропиши, «как выглядит жизнь при цели» — образ тянет к действию',
    'Разбей большую цель на шаги с датами — так она перестаёт пугать'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="45" cy="35" r="26"/><circle cx="45" cy="35" r="16"/><circle cx="45" cy="35" r="6"/><path d="M45 35l40-22" /><path d="M78 9l10 4-2 10z" fill="currentColor" stroke="none"/></svg>'},
  {t:'Домашка задаёт вектор', pts:[
    'ДЗ модуля: <b>план действий на 10 пунктов</b>',
    'Каждый пункт — с конкретным сроком и измеримой цифрой',
    'Финальный пункт — описание «жизни при достигнутой цели»',
    'Этот план — навигатор на весь курс, к нему возвращаешься'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="30" y="8" width="60" height="54" rx="8"/><path d="M40 20l4 4 6-7M40 34l4 4 6-7M40 48l4 4 6-7" stroke-width="2.8"/><path d="M58 21h22M58 35h22M58 49h16" opacity=".8"/></svg>'},
  {t:'Чек-лист старта', pts:[
    'Понял свой тип: новичок / практик / бизнес',
    'Завёл аккаунт-полигон и снимаешь, не боясь кринжа',
    'Знаешь стадии обучения — не сольёшься на спаде',
    'Цель оцифрована: число + срок + образ жизни',
    'План на 10 пунктов написан'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="26" y="6" width="68" height="58" rx="8"/><path d="M36 20l4 4 7-8M36 36l4 4 7-8M36 52l4 4 7-8" stroke-width="2.8"/><path d="M54 21h28M54 37h28M54 53h20" opacity=".8"/></svg>'},
  ],
  quiz:[
  {q:'На какие три типа участников рассчитан курс «Медийность»?', o:['Дети, взрослые, пенсионеры','Новички, практики, бизнес','Блогеры, продавцы, инвесторы','Дизайнеры, авторы, операторы'], a:1},
  {q:'Когда начинать вести свой аккаунт по методу «кейс на себе»?', o:['После получения сертификата','Когда наберётся 1000 подписчиков','Сразу, с первого дня — как полигон','Только когда будет идеальный контент'], a:2},
  {q:'Что урок говорит про кринж-этап первых роликов?', o:['Его надо избегать любой ценой','Он бывает только у новичков','Его проходят все — просто снимай','Он означает, что съёмки не твоё'], a:2},
  {q:'Эмоциональные стадии обучения (энтузиазм → усталость) — это…', o:['Признак, что курс плохой','Норма, через это проходят все','Повод бросить обучение','Ошибка в планировании'], a:1},
  {q:'Какой должна быть правильно поставленная цель?', o:['Максимально амбициозной и абстрактной','Число и срок, а не просто «хочу больше»','Тайной, чтобы не сглазить','Такой же, как у конкурентов'], a:1},
  {q:'Из скольких пунктов состоит стартовое ДЗ-план действий?', o:['3','5','10','20'], a:2},
  ],
  pairs:[
  ['Новичок','Собрать блог и первые деньги с нуля'],
  ['Кейс на себе','Свой аккаунт как полигон с первого дня'],
  ['Кринж-этап','Проходят все — просто снимай дальше'],
  ['Цель','Число и срок, а не абстрактное «хочу»'],
  ['Стадии обучения','Энтузиазм, спад, усталость — это норма'],
  ],
  task:{
    intro:'Напиши свой стартовый план на 10 пунктов — навигатор на весь курс. Оцифруй цель и опиши, как выглядит твоя жизнь, когда цель достигнута:',
    chips:['Мой тип','Целевые цифры','Срок','Жизнь при цели','Первый шаг сегодня'],
    ph:'Пример: Тип — практик. Цель — 300 заявок и 150 000 ₽/мес за 3 месяца. Полигон — веду личный блог, 1 Reels в день. Жизнь при цели — работаю на себя, выбираю клиентов. Первый шаг сегодня — сниму и выложу первый ролик, не переснимая.',
    verdict:'Цель оцифрована и привязана к сроку — это уже сильнее «хочу больше подписчиков». Совет куратора: повесь этот план на видное место и раз в неделю сверяйся с цифрами, а не с настроением. Полигон запускай сегодня — первый кринжовый ролик приближает к цели больше, чем идеальный в черновиках.'
  }
},

/* ---------- УРОК 2: Упаковка профиля ---------- */
{
  title:'Упаковка профиля',
  sub:'1:24 · видео (голос Даниэля) + слайды + тест + игра',
  dur:'1:24',
  videoUrl:'https://okoteam.top/media/oko_media_l2.mp4',
  c1:'УПАКОВКА', c2:'ПРОФИЛЯ',
  slides:[
  {t:'3 секунды на впечатление', pts:[
    'Шапка профиля решает за <b>3 секунды</b>: остаться или уйти',
    'Цель шапки зависит от типа блога: <b>коммерческий</b>, <b>экспертный</b>, <b>лайфстайл</b>',
    'Коммерческий — продать; экспертный — вызвать доверие; лайфстайл — влюбить в личность',
    'Сначала определи тип и цель, потом пиши текст — не наоборот'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="60" cy="35" r="22"/><path d="M60 22v13l9 6"/><path d="M60 13V8M60 62v-5M38 35h-5M87 35h-5"/></svg>'},
  {t:'Элементы шапки', pts:[
    '<b>Ник</b> — как тебя ищут; <b>Имя</b> — жирная строка до 30 знаков',
    '<b>Описание</b> — до 150 знаков, работает каждое слово',
    '<b>Ссылка</b> — куда ведёшь тёплый трафик; вечные <b>истории</b> — витрина',
    'Пять элементов, и все пять должны работать на одну цель'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="30" cy="24" r="12"/><path d="M18 24a12 12 0 0 1 24 0"/><path d="M50 16h56M50 26h40M50 36h50" opacity=".85"/><circle cx="26" cy="56" r="7"/><circle cx="46" cy="56" r="7"/><circle cx="66" cy="56" r="7"/><circle cx="86" cy="56" r="7"/></svg>'},
  {t:'Ник, который запоминают', pts:[
    'Строй ник из <b>имени или тематики</b> — по нему тебя находят',
    'Должен легко читаться, произноситься и запоминаться',
    'Без «мусора»: цифр-заборов, подчёркиваний, случайных символов',
    'Хороший ник = меньше друзей потеряет тебя в поиске'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M34 30v10a10 10 0 1 0 4-8" opacity=".9"/><circle cx="30" cy="35" r="12"/><path d="M50 45h44a10 10 0 0 0 0-20H64" opacity=".85"/><path d="M50 45l-8-4M50 45l-6 6" opacity=".6"/></svg>'},
  {t:'Аватар: лицо блога', pts:[
    'Качественное фото, <b>однотонный фон</b>, крупный план',
    '<b>Открытый взгляд</b> в камеру — контакт с человеком по ту сторону',
    'Меняй аватар <b>не чаще 1–2 раз в год</b> — тебя узнают по нему',
    'Аватар — это не логотип для галочки, это первое рукопожатие'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="36" y="10" width="48" height="50" rx="12"/><circle cx="60" cy="30" r="9"/><path d="M44 56c2-11 8-15 16-15s14 4 16 15"/><path d="M52 30h.5M68 30h.5" stroke-width="3"/></svg>'},
  {t:'Описание — по формуле', pts:[
    'Экспертный: <b>кто ты → чем интересен → факты-цифры → выгода → CTA</b>',
    'Коммерческий: <b>продукт → выгода → уникальность → CTA</b>',
    'Каждая строка отвечает на вопрос читателя «а мне зачем?»',
    'Заканчивай призывом: подпишись, напиши, забери — дай следующий шаг'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M22 14h60M22 26h50M22 38h60M22 50h34"/><path d="M64 50h18a8 8 0 0 1 8 8v0" opacity=".7"/><path d="M84 52l8 6-8 6" opacity=".7"/></svg>'},
  {t:'Чего избегать в описании', pts:[
    'Пустые <b>шаблоны</b> без смысла: «делаю мир лучше», «люблю жизнь»',
    'Английский для русскоязычной аудитории — теряешь понятность',
    '<b>Некликабельные</b> контакты: телефон текстом, «пишите в директ» без ссылки',
    'Вода вместо фактов: цифры и конкретика продают, лозунги — нет'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="60" cy="35" r="26"/><path d="M42 17 78 53" stroke-width="3"/><path d="M32 40h12M76 30h12" opacity=".5"/></svg>'},
  {t:'Мультиссылка и вечные истории', pts:[
    '<b>Мультиссылка</b> собирает все ссылки в одну — не теряешь трафик',
    'Вечные истории — витрина блога: <b>О себе / Услуги-Прайс / Отзывы-кейсы</b>',
    'Дополни: <b>Примеры / Как заказать / Акции / Достижения</b>',
    'Обложки историй — в едином стиле бренда, а не хаос иконок'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="20" cy="18" r="9"/><circle cx="44" cy="18" r="9"/><circle cx="68" cy="18" r="9"/><circle cx="92" cy="18" r="9"/><path d="M60 40h40a6 6 0 0 1 6 6v0a6 6 0 0 1-6 6H60a6 6 0 0 1-6-6v0a6 6 0 0 1 6-6z"/><path d="M14 46h30" opacity=".7"/></svg>'},
  {t:'Чек-лист упаковки', pts:[
    'Тип блога и цель шапки определены',
    'Ник читаемый, имя-строка до 30, описание до 150',
    'Аватар: однотонный фон, крупный план, открытый взгляд',
    'Описание собрано по формуле и заканчивается CTA',
    'Мультиссылка стоит, вечные истории закрывают путь клиента'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="26" y="6" width="68" height="58" rx="8"/><path d="M36 20l4 4 7-8M36 36l4 4 7-8M36 52l4 4 7-8" stroke-width="2.8"/><path d="M54 21h28M54 37h28M54 53h20" opacity=".8"/></svg>'},
  ],
  quiz:[
  {q:'Сколько секунд есть у шапки профиля на первое впечатление?', o:['30 секунд','10 секунд','3 секунды','1 минута'], a:2},
  {q:'От чего зависит цель шапки профиля?', o:['От количества подписчиков','От типа блога: коммерческий/экспертный/лайфстайл','От времени суток','От числа сторис в день'], a:1},
  {q:'Какое ограничение по длине у строки с именем в шапке?', o:['До 30 знаков','До 150 знаков','До 500 знаков','Без ограничений'], a:0},
  {q:'Каким должен быть аватар по уроку?', o:['С ярким разноцветным фоном','Однотонный фон, крупный план, открытый взгляд','Обязательно логотип компании','Групповое фото команды'], a:1},
  {q:'Как выглядит формула описания для экспертного блога?', o:['Продукт → цена → скидка','Кто → чем интересен → факты-цифры → выгода → CTA','Хэштеги → эмодзи → ссылка','Приветствие → благодарность → подпись'], a:1},
  {q:'Что из перечисленного — ошибка в шапке профиля?', o:['Мультиссылка на все ресурсы','Кликабельные контакты','Английский текст для русской аудитории','Формула в описании'], a:2},
  ],
  pairs:[
  ['Шапка профиля','3 секунды на первое впечатление'],
  ['Имя-строка','Жирный текст до 30 знаков'],
  ['Описание','До 150 знаков, по формуле, с CTA'],
  ['Аватар','Однотонный фон, крупный план, открытый взгляд'],
  ['Мультиссылка','Все ссылки в одной — не теряешь трафик'],
  ],
  task:{
    intro:'Пересобери шапку своего профиля по формуле урока. Сначала определи тип блога, затем распиши каждый элемент — ник, имя, описание и структуру вечных историй:',
    chips:['Тип блога','Ник','Имя-строка (до 30)','Описание (до 150)','Вечные истории','CTA'],
    ph:'Пример: Тип — экспертный. Ник — anna.smm. Имя — Анна · SMM-специалист. Описание: веду блоги с 2020, +200 клиентов, средний рост охватов ×4. Разбираю упаковку бесплатно — пиши «шапка». Истории: О себе / Кейсы / Прайс / Как заказать.',
    verdict:'Формула соблюдена: есть кто ты, факты-цифры, выгода и понятный призыв. Совет куратора: проверь описание на «воду» — выкинь строки, которые подошли бы любому блогеру. Обложки вечных историй приведи к единому стилю бренда, чтобы шапка читалась как одно целое за те самые 3 секунды.'
  }
},

/* ---------- УРОК 3: Визуал и лента ---------- */
{
  title:'Визуал и лента',
  sub:'1:11 · видео (голос Даниэля) + слайды + тест + игра',
  dur:'1:11',
  videoUrl:'https://okoteam.top/media/oko_media_l3.mp4',
  c1:'ВИЗУАЛ', c2:'И ЛЕНТА',
  slides:[
  {t:'Зачем вообще визуал', pts:[
    '<b>51% людей судят о блоге по визуалу</b> — картинка говорит раньше слов',
    'Визуал держит внимание, транслирует ценности и отстраивает от других',
    'Единый стиль = доверие: «этот аккаунт ведут всерьёз»',
    '<b>Баннерная слепота</b> — враг: однотипные шаблоны глаз пролистывает не глядя'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M10 35C22 18 44 12 60 12s38 6 50 23c-12 17-34 23-50 23S22 52 10 35z"/><circle cx="60" cy="35" r="11"/><circle cx="60" cy="35" r="4" fill="currentColor" stroke="none"/></svg>'},
  {t:'Этапы: от смыслов к съёмке', pts:[
    'Шаг 1 — <b>сбор смыслов</b>: о чём блог, какие ценности показываешь',
    'Шаг 2 — <b>мудборд</b>: собираешь референсы, гамму, настроение',
    'Шаг 3 — <b>планирование</b>: 12–15 фото вперёд, единая гамма, ≤2 шрифта',
    'Шаг 4 — <b>съёмка → обработка → публикация</b> по плану, а не по настроению'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 56h20V42h20V28h20V14h24"/><circle cx="24" cy="50" r="3" fill="currentColor" stroke="none"/><circle cx="44" cy="36" r="3" fill="currentColor" stroke="none"/><circle cx="64" cy="22" r="3" fill="currentColor" stroke="none"/><rect x="92" y="8" width="16" height="12" rx="3" opacity=".8"/></svg>'},
  {t:'Мудборд — карта настроения', pts:[
    'Собери <b>референсы</b>: цвета, ракурсы, свет, объекты, шрифты',
    'Определи <b>гамму</b> — 2–3 базовых цвета, чтобы лента звучала в тон',
    'Мудборд экономит часы: снимаешь по образцу, а не наугад',
    'Он же — бриф для фотографа, дизайнера и для себя будущего'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="12" width="28" height="20" rx="4"/><rect x="48" y="12" width="24" height="20" rx="4"/><rect x="78" y="12" width="28" height="20" rx="4"/><rect x="14" y="40" width="24" height="18" rx="4"/><rect x="44" y="40" width="32" height="18" rx="4"/><rect x="82" y="40" width="24" height="18" rx="4"/></svg>'},
  {t:'Красивая лента: приёмы', pts:[
    'Чередуй <b>планы</b>: общий → средний → крупный → сверхкрупный',
    'Чередуй образы и сюжеты — рядом не должны стоять два похожих кадра',
    'Оставляй <b>«воздух»</b> — пустое пространство в кадре, не забивай всё',
    'Формат кадра <b>4:5</b> — забирает максимум площади в ленте'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="20" y="8" width="26" height="18" rx="3"/><rect x="50" y="8" width="26" height="18" rx="3"/><rect x="80" y="8" width="20" height="18" rx="3"/><rect x="20" y="30" width="20" height="18" rx="3"/><rect x="44" y="30" width="32" height="18" rx="3"/><rect x="80" y="30" width="20" height="18" rx="3"/><rect x="20" y="52" width="26" height="12" rx="3" opacity=".7"/><rect x="50" y="52" width="50" height="12" rx="3" opacity=".7"/></svg>'},
  {t:'Не больше двух шрифтов', pts:[
    'В визуале — <b>максимум 2 шрифта</b>: один акцентный, один для текста',
    'Больше шрифтов = каша и ощущение любительства',
    'Одна пара шрифтов на весь блог — это часть узнаваемости',
    'То же с цветом: держи гамму, а не «радугу на каждом посте»'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 16h30M35 16v40" stroke-width="3"/><path d="M66 24h34M83 24v32" stroke-width="2.4" opacity=".85"/><path d="M60 56h44" opacity=".5"/></svg>'},
  {t:'Личность продаёт', pts:[
    '<b>96% людей охотнее лайкают фото, где есть человек</b> — покажи лицо',
    'Блог без личности — безликая витрина, к ней не привязываются',
    'Личные кадры, эмоции, закулисье — то, что отличает тебя от конкурентов',
    'Люди подписываются на людей, а не на идеальные предметные раскладки'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="60" cy="26" r="12"/><path d="M38 60c2-15 10-22 22-22s20 7 22 22"/><path d="M84 20l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6-4.5-4 6-1z" fill="currentColor" stroke="none" opacity=".85"/></svg>'},
  {t:'Техника не главное', pts:[
    'Для качественного визуала хватает <b>iPhone 11–12 и новее</b>',
    'Дело не в дорогой камере, а в свете, кадре и обработке',
    'Следи за трендами, но <b>оставайся собой</b> — копия всегда слабее оригинала',
    'Тренд — это форма; твоя личность и смысл — содержание'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="40" y="8" width="40" height="54" rx="8"/><circle cx="60" cy="30" r="9"/><circle cx="60" cy="30" r="3.5"/><path d="M52 52h16" opacity=".7"/><path d="M96 22l2.5 5 5 .8-3.7 3.4.8 5-4.6-2.5-4.6 2.5.8-5-3.7-3.4 5-.8z" fill="currentColor" stroke="none" opacity=".8"/></svg>'},
  {t:'Чек-лист визуала', pts:[
    'Смыслы собраны, мудборд и гамма готовы',
    'Лента спланирована на 12–15 фото вперёд',
    'Чередуешь планы и образы, оставляешь «воздух»',
    'Не больше 2 шрифтов, кадр 4:5, есть личность в кадре',
    'Снимаешь на то, что есть, — техника не отговорка'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="26" y="6" width="68" height="58" rx="8"/><path d="M36 20l4 4 7-8M36 36l4 4 7-8M36 52l4 4 7-8" stroke-width="2.8"/><path d="M54 21h28M54 37h28M54 53h20" opacity=".8"/></svg>'},
  ],
  quiz:[
  {q:'Какой процент людей судит о блоге по визуалу?', o:['10%','25%','51%','90%'], a:2},
  {q:'Что такое «баннерная слепота» в контексте визуала?', o:['Плохое зрение у подписчиков','Глаз пролистывает однотипные шаблоны не глядя','Отсутствие баннеров в профиле','Слишком яркие цвета'], a:1},
  {q:'Сколько фото рекомендуется планировать вперёд на этапе планирования?', o:['3–4','12–15','50','Планировать не нужно'], a:1},
  {q:'Сколько шрифтов максимум стоит использовать в визуале?', o:['1','2','4','Без ограничений'], a:1},
  {q:'Какой формат кадра забирает максимум площади в ленте?', o:['1:1','16:9','4:5','3:1'], a:2},
  {q:'Почему в кадре важна личность (человек)?', o:['Так требуют алгоритмы','96% людей охотнее лайкают фото с человеком','Это дешевле предметной съёмки','Чтобы заполнить пустоту'], a:1},
  ],
  pairs:[
  ['51%','Судят о блоге по визуалу'],
  ['Мудборд','Референсы, гамма, настроение будущей ленты'],
  ['4:5','Формат кадра, забирающий максимум площади'],
  ['≤2 шрифта','Правило единого визуального стиля'],
  ['96%','Охотнее лайкают фото, где есть человек'],
  ],
  task:{
    intro:'Спланируй свою ленту как визуальную систему. Собери мудборд, задай гамму и шрифты и распиши сетку на ближайшие 12–15 кадров с чередованием планов и образов:',
    chips:['Гамма (2–3 цвета)','Шрифты (≤2)','Сетка 12–15 кадров','Чередование планов','Где личность в кадре'],
    ph:'Пример: Гамма — чёрный, лайм, светло-серый. Шрифты — Bebas Neue + Montserrat. Сетка: портрет крупный → предмет средний → закулисье общий → цитата → портрет… Личность — каждый 3-й кадр с лицом и эмоцией. Кадр 4:5, снимаю на iPhone.',
    verdict:'Система выстроена: гамма, пара шрифтов и чередование планов дают ленте узнаваемость. Совет куратора: разложи 12–15 кадров в раскладке заранее и проверь, чтобы рядом не стояли два похожих сюжета — именно это рождает «воздух» и убивает баннерную слепоту. И не жди идеальную камеру: свет и кадр важнее модели телефона.'
  }
}

];
/* ================= ТРЕК 2: МАРКЕТИНГ — 3 урока =================
   Источник: OKO_ACADEMY_CURRICULUM.md, модули 2.1–2.4
   (Копирайтинг · Структура продающего поста · Хуки/тизинг/сторителлинг · Триггеры).
   Формат один в один с AC_COURSE (academy/script.js). */

const MARKETING_LESSONS = [

/* ---------- УРОК 1: Копирайтинг ---------- */
{
  title:'Копирайтинг: тексты, которые покупают',
  sub:'4:10 · видео + слайды + тест + игра',
  dur:'4:10',
  c1:'ПИШИ КАК', c2:'ГОВОРИШЬ',
  slides:[
  {t:'Главный принцип', pts:[
    'Пиши <b>так, как разговариваешь</b> — текст это молчаливый аналог живой речи',
    'Никакого «пластика»: канцелярит и пафос убивают доверие',
    'Прочитал вслух и споткнулся — читатель споткнётся тоже',
    'Простой человеческий текст читают до конца, сложный закрывают'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14h48a8 8 0 0 1 8 8v18a8 8 0 0 1-8 8H40l-14 12v-12h-6a8 8 0 0 1-8-8V22a8 8 0 0 1 8-8Z"/><path d="M28 26h32M28 34h22"/><circle cx="98" cy="40" r="14"/><path d="M92 40h12M98 34v12" opacity=".7"/></svg>'},
  {t:'Признак 1: глаголы решают', pts:[
    'Причастия и деепричастия меняй на <b>глаголы</b>: «сделавший» → «сделал»',
    'Глагол двигает мысль, причастие её тормозит',
    '«Являющийся экспертом» → «эксперт». Проще и сильнее',
    'Живая речь — это цепочка действий, а не гроздь окончаний'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 35h74"/><path d="M74 25l14 10-14 10"/><circle cx="102" cy="35" r="10"/><path d="M97 35l4 4 6-7"/><path d="M20 20l-4 30M32 22l-3 26" opacity=".4"/></svg>'},
  {t:'Признаки 2 и 3: режь и усиливай', pts:[
    'Выкинь <b>каждое 3–5-е слово</b> — текст почти всегда не теряет смысл',
    'Каждое 3–5-е оставшееся замени <b>выразительным синонимом</b>',
    '«Очень хороший результат» → «сильный результат»',
    'Меньше слов, ярче слова — плотность внимания растёт'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 22h30M18 32h40M18 42h26M18 52h34" opacity=".85"/><path d="M56 16l14 14-30 30-14 0 0-14z"/><path d="M56 16l14 14" opacity=".5"/><path d="M92 30l4 8 8 1-6 6 1.5 8-7-4-7 4 1.5-8-6-6 8-1z" fill="currentColor" stroke="none" opacity=".9"/></svg>'},
  {t:'Признаки 4 и 5: начало текста', pts:[
    'Удали <b>вводный первый абзац</b> — почти всегда это разогрев ни о чём',
    'Первое предложение = <b>заголовок</b>, оно решает, читать дальше или нет',
    'Начинай сразу с сути, а не с «в современном мире…»',
    'Сильное начало вытаскивает даже слабую середину'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="20" y="10" width="80" height="14" rx="4" fill="currentColor" fill-opacity=".18"/><path d="M28 17h50"/><path d="M20 34h64M20 44h72M20 54h56" opacity=".7"/><path d="M104 30l-8 4 8 4" opacity=".6"/><path d="M100 17h10" opacity=".5"/></svg>'},
  {t:'Этапы: сначала пиши, потом правь', pts:[
    'Первый заход — <b>пиши потоком</b>, не редактируй по ходу',
    'Редактура — отдельный этап на свежую голову',
    'Финальная проверка — <b>перечитай вслух</b> и поправь всё, где споткнулся',
    'Смешаешь письмо и правку — застрянешь на первом абзаце'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 50l6-2 34-34-4-4-34 34z"/><path d="M52 12l4 4"/><path d="M70 40h34"/><path d="M70 50h26"/><circle cx="98" cy="20" r="9"/><path d="M94 20l3 3 6-6"/></svg>'},
  {t:'F- и Z-траектории чтения', pts:[
    'Глаз бежит по экрану буквой <b>F</b> (текст) или <b>Z</b> (визуал)',
    'Важное — в <b>начало строк и абзацев</b>, туда, куда падает взгляд',
    'Первые слова строки весят больше, чем середина',
    'Подгоняй текст под траекторию, а не заставляй читать всё подряд'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h30M22 12v46M22 34h24" stroke-width="3.2"/><path d="M70 14h30l-30 42h30" stroke-width="3.2" opacity=".85"/><circle cx="22" cy="12" r="3" fill="currentColor" stroke="none"/><circle cx="70" cy="14" r="3" fill="currentColor" stroke="none"/></svg>'},
  {t:'Чек-лист копирайтера', pts:[
    'Причастия → глаголы',
    'Выкинул лишнее, усилил синонимами',
    'Снёс вводный абзац, первое предложение — крючок',
    'Написал потоком → отредактировал → прочитал вслух',
    'Важное расставил по F/Z-траектории'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="26" y="6" width="68" height="58" rx="8"/><path d="M36 20l4 4 7-8M36 36l4 4 7-8M36 52l4 4 7-8" stroke-width="2.8"/><path d="M54 21h28M54 37h28M54 53h20"/></svg>'},
  ],
  quiz:[
  {q:'Главный принцип копирайтинга из урока:', o:['Писать максимально официально','Писать так, как разговариваешь','Использовать больше причастий','Начинать с длинного вступления'], a:1},
  {q:'Что делать с причастиями и деепричастиями?', o:['Добавлять больше','Менять на глаголы','Оставлять как есть','Выделять жирным'], a:1},
  {q:'По правилу «5 признаков» первый абзац-вступление нужно…', o:['Расширить','Удалить','Продублировать в конце','Перевести на английский'], a:1},
  {q:'Чем должно быть первое предложение текста?', o:['Дисклеймером','Приветствием','Заголовком-крючком','Списком источников'], a:2},
  {q:'Правильный порядок работы над текстом:', o:['Редактировать каждое слово по ходу','Сначала пиши потоком, потом редактируй','Сразу публиковать черновик','Писать только вслух'], a:1},
  {q:'Куда ставить самое важное по F/Z-траектории?', o:['В конец абзацев','В середину строк','В начало строк и абзацев','В подпись'], a:2},
  ],
  pairs:[
  ['Пиши как говоришь','Текст — молчаливый аналог живой речи'],
  ['Глаголы','Заменяют причастия и двигают мысль'],
  ['Первое предложение','Работает как заголовок-крючок'],
  ['Вслух','Финальная проверка текста на живость'],
  ['F/Z-траектория','Важное — в начало строк и абзацев'],
  ],
  task:{
    intro:'Возьми свой старый пост (3–5 предложений) и прогони через «5 признаков хорошего текста»:',
    chips:['Глаголы вместо причастий','Выкинь лишнее','Усиль синонимами','Снеси вводный абзац','Заголовок-крючок'],
    ph:'Пример: было — «Являясь опытным специалистом, я оказываю широкий спектр услуг…». Стало — «Веду блоги, которые продают. Пять лет, 40 клиентов, кейсы с ростом охватов в 3 раза».',
    verdict:'Причастия ушли, лишнее вырезано, первое предложение цепляет. Совет куратора: обязательно прочитай финал вслух — там всплывают последние шероховатости.'
  }
},

/* ---------- УРОК 2: Структура продающего поста ---------- */
{
  title:'Структура продающего поста',
  sub:'4:30 · видео + слайды + тест + игра',
  dur:'4:30',
  c1:'ПРОДАЮЩИЙ', c2:'ПОСТ',
  slides:[
  {t:'Универсальная структура', pts:[
    '<b>7 блоков подряд</b>: Заголовок → Лид → Оффер → Выгоды → Цена → Дедлайн → CTA',
    'Каждый блок ведёт читателя к следующему, как ступени',
    'Пропустил блок — воронка протекает и продажа рушится',
    'Работает для поста, сторис, лендинга и письма одинаково'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 12h84L84 32v20l-14 10V32z"/><path d="M40 22h40M48 32h24" opacity=".6"/><circle cx="60" cy="52" r="3" fill="currentColor" stroke="none"/></svg>'},
  {t:'Заголовок и лид', pts:[
    'Заголовок ловит внимание за <b>первые 3 секунды</b> — иначе пролистнут',
    'Лид сразу бьёт в <b>боль или проблему</b> читателя',
    '«Узнаёшь себя?» — читатель кивает и остаётся',
    'Без попадания в боль остальной текст никто не прочитает'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="16" y="10" width="70" height="14" rx="4" fill="currentColor" fill-opacity=".18"/><path d="M24 17h48"/><path d="M16 34h60M16 44h52" opacity=".65"/><circle cx="98" cy="46" r="14"/><path d="M98 40v8M98 52v.5" stroke-width="3"/></svg>'},
  {t:'Оффер: суть предложения', pts:[
    'Оффер — <b>что конкретно</b> ты предлагаешь и какой результат даёшь',
    'Не «услуги SMM», а «5 Reels в неделю + рост охватов за месяц»',
    'Конкретика и результат вместо размытых обещаний',
    'Хороший оффер понятен с одного прочтения'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M60 8l8 16 18 3-13 13 3 18-16-9-16 9 3-18-13-13 18-3z"/><path d="M52 40l6 6 12-13" stroke-width="2.6"/></svg>'},
  {t:'Продажа выгод', pts:[
    'Показывай <b>отзывы, кейсы и цифры</b> — доказательства вместо слов',
    'Говори не о свойствах, а о <b>выгоде</b> для клиента',
    '«До/После» и конкретные результаты снимают сомнения',
    'Факты и социальное доказательство продают сильнее прилагательных'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M16 58V38M40 58V26M64 58V32M88 58V16" stroke-width="3.2"/><path d="M12 58h96"/><path d="M100 22l6-6 6 6" opacity=".6"/><path d="M106 16v14" opacity=".6"/></svg>'},
  {t:'Продажа цены', pts:[
    'Объясни, <b>почему цена справедлива</b>, до того как её назвал',
    'Сравни с ценностью результата, а не с «рынком»',
    'Разложи, что входит — чтобы цифра не пугала в одиночку',
    'Цена без обоснования всегда кажется завышенной'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M60 12v46"/><path d="M60 20L28 30l32 10 32-10z" fill="currentColor" fill-opacity=".12"/><path d="M28 30l-8 16h16zM92 30l-8 16h16z"/><path d="M20 58h80" opacity=".7"/></svg>'},
  {t:'Дедлайн и CTA', pts:[
    'Дедлайн включает <b>дефицит</b>: «до пятницы», «5 мест» — но честно',
    'CTA — <b>одно ясное действие</b>: «пиши в личку», «жми ссылку»',
    'Без призыва читатель ставит лайк и уходит',
    'Один пост — один целевой шаг, не размазывай'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="34" cy="35" r="20"/><path d="M34 22v13l9 6" stroke-width="2.8"/><rect x="66" y="26" width="44" height="18" rx="9" fill="currentColor" fill-opacity=".15"/><path d="M76 35h20M90 30l6 5-6 5"/></svg>'},
  {t:'Вовлечение через восприятие', pts:[
    'Добавляй <b>вкусы, запахи, звуки, динамику</b> — текст оживает',
    '«Хрустящая корочка» продаёт лучше, чем «вкусный продукт»',
    'Свой <b>ритм и стиль</b> отстраивает от конкурентов',
    'Читатель проживает картинку — и остаётся в посте дольше'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="40" cy="35" r="18"/><path d="M34 32a3 3 0 0 1 6 0M46 32a3 3 0 0 0-6 0" opacity=".8"/><path d="M33 42c4 4 10 4 14 0" stroke-width="2.6"/><path d="M66 24c6 0 6 8 12 8s6-8 12-8M66 46c6 0 6-8 12-8s6 8 12 8" opacity=".6"/></svg>'},
  ],
  quiz:[
  {q:'Сколько блоков в универсальной структуре продающего поста?', o:['3','5','7','10'], a:2},
  {q:'Что идёт сразу после заголовка?', o:['Цена','Лид с болью/проблемой','CTA','Отзывы'], a:1},
  {q:'За сколько секунд заголовок должен поймать внимание?', o:['3 секунды','30 секунд','2 минуты','Неважно'], a:0},
  {q:'Чем лучше всего «продавать выгоды»?', o:['Красивыми прилагательными','Отзывами, кейсами и цифрами','Длинным вступлением','Списком свойств товара'], a:1},
  {q:'Зачем нужен блок дедлайна?', o:['Чтобы удлинить пост','Чтобы создать дефицит и подтолкнуть к действию','Для красоты','Чтобы указать дату публикации'], a:1},
  {q:'Каким должен быть призыв к действию (CTA)?', o:['Несколько разных действий сразу','Одно ясное действие','Скрытым намёком','Только в комментариях'], a:1},
  ],
  pairs:[
  ['Лид','Абзац, который бьёт в боль читателя'],
  ['Оффер','Что конкретно предлагаешь и с каким результатом'],
  ['Продажа выгод','Отзывы, кейсы и цифры вместо слов'],
  ['Дедлайн','Честный дефицит, толкающий к действию'],
  ['CTA','Одно ясное целевое действие'],
  ],
  task:{
    intro:'Собери один продающий пост по полной структуре из 7 блоков для своей услуги:',
    chips:['Заголовок','Лид (боль)','Оффер','Выгоды','Цена','Дедлайн','CTA'],
    ph:'Пример: Заголовок — «Твой блог не продаёт? Дело не в тебе». Лид — про слитый бюджет на рекламу. Оффер — 8 Reels в месяц + рост охватов. Выгоды — кейс с +230% просмотров. Цена — и что в неё входит. Дедлайн — 3 места до пятницы. CTA — «напиши “хочу” в личку».',
    verdict:'Все 7 блоков на месте, боль и выгода читаются, дефицит честный. Совет куратора: добавь одну деталь восприятия (звук, вкус, движение) в лид — пост станет живее и его дочитают.'
  }
},

/* ---------- УРОК 3: Хуки, тизинг, сторителлинг и триггеры ---------- */
{
  title:'Хуки, сторителлинг и 8 триггеров',
  sub:'4:50 · видео + слайды + тест + игра',
  dur:'4:50',
  c1:'ХУКИ И', c2:'ТРИГГЕРЫ',
  slides:[
  {t:'Первые 3 секунды: пощёчина', pts:[
    'Хук — это <b>«пощёчина» внимания</b> в первые 3 секунды',
    'Эмоции-крючки: <b>удивление, любопытство, гнев, страх, тёплые воспоминания</b>',
    'Нейтральное начало = мгновенный пролистывание',
    'Сначала останови палец, потом продавай'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M46 10l-8 26h16l-10 24 34-34H62l10-16z" fill="currentColor" fill-opacity=".15"/><path d="M92 20l4 6M100 32h8M92 46l5-4" opacity=".6"/></svg>'},
  {t:'Тизинг: дразни, не вываливай', pts:[
    '<b>Тизинг</b> — дразнить и не давать всё сразу, тянуть интригу',
    'Глубина просмотра влияет на <b>продвижение</b> — держи до конца',
    '5–10 секунд подогрева интриги, но <b>не пережать</b>',
    '«Совет, который сэкономит миллионы…» — и раскрываешь позже'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M16 35c14-18 44-18 58 0-14 18-44 18-58 0Z"/><circle cx="45" cy="35" r="9"/><circle cx="45" cy="35" r="3" fill="currentColor" stroke="none"/><path d="M84 24l8 4-8 4M92 40l8 4-8 4" opacity=".6"/></svg>'},
  {t:'Сторителлинг: скелет истории', pts:[
    'Схема: <b>герой → препятствие → действие → ошибки и новые попытки</b>',
    'Падения и провалы в истории вызывают доверие сильнее победы',
    'Читатель узнаёт себя в герое — и идёт за ним',
    'От навыка рассказывать истории напрямую зависит доход'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="52" r="6"/><path d="M24 52c8-2 10-18 20-18M44 34l-4-5M44 34l-6 3" opacity=".7"/><path d="M44 34c10 0 12 16 22 16M66 50c10 0 10-30 24-30" /><circle cx="90" cy="20" r="7"/><path d="M90 20l4 4 5-6" opacity=".8"/></svg>'},
  {t:'8 триггеров покупки', pts:[
    'Психология решения — <b>8 рычагов</b>, которые подталкивают к «да»',
    'Толпа · Эксклюзив · Дефицит · Халява',
    'Авторитет/статистика · Крутые кейсы · Страх · Новизна',
    'Один пост — <b>1–2 триггера</b>, не вали все сразу'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="60" cy="35" r="10"/><circle cx="60" cy="12" r="4"/><circle cx="60" cy="58" r="4"/><circle cx="37" cy="35" r="4"/><circle cx="83" cy="35" r="4"/><circle cx="44" cy="19" r="4"/><circle cx="76" cy="19" r="4"/><circle cx="44" cy="51" r="4"/><circle cx="76" cy="51" r="4"/><path d="M60 25V16M60 45v9M50 35h-9M70 35h9M53 28l-6-6M67 28l6-6M53 42l-6 6M67 42l6 6" opacity=".55"/></svg>'},
  {t:'Триггеры «как все / не как все»', pts:[
    '<b>Толпа</b>: «уже 3000 человек взяли» — страшно остаться в стороне',
    '<b>Эксклюзив</b>: «только для своих» — желание выделиться',
    '<b>Дефицит</b>: «осталось 5 мест» — страх упустить',
    '<b>Халява</b>: бесплатный тест-драйв затягивает в воронку'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="24" cy="24" r="6"/><circle cx="40" cy="24" r="6"/><circle cx="32" cy="40" r="6"/><path d="M14 56c0-8 6-12 10-12M50 56c0-8-6-12-10-12M22 56c0-8 5-12 10-12s10 4 10 12" opacity=".7"/><path d="M82 16l4 8 8 1-6 6 1.5 8-7.5-4-7 4 1.5-8-6-6 8-1z" fill="currentColor" stroke="none" opacity=".85"/></svg>'},
  {t:'Триггеры доверия и движения', pts:[
    '<b>Авторитет/статистика</b>: весомое мнение и цифры снимают сомнения',
    '<b>Крутые кейсы</b>: «хочу так же» — показал результат другого',
    '<b>Страх</b>: «боюсь, что будет хуже» — пугай с заботой, не давя',
    '<b>Новизна</b>: «будь первым» — свежее тянет само по себе'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M30 10l6 12 13 2-9.5 9 2.5 13-12-6.5-12 6.5 2.5-13L23 24l13-2z"/><path d="M30 12v22" opacity=".4"/><path d="M70 50V32M84 50V22M98 50V38" stroke-width="3"/><path d="M66 50h40" opacity=".7"/></svg>'},
  {t:'Как собрать всё вместе', pts:[
    'Хук ловит → тизинг держит → история вовлекает → триггер закрывает',
    'Триггеры работают в блоках выгод, цены и дедлайна из урока 2',
    'Проверяй честность: не «500 мест» при 100 подписчиках',
    'Практика важнее теории — тестируй крючки и смотри досмотры'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 40c0-6 4-10 10-10s10 4 10 10M22 40l4 6-4 6" opacity=".8"/><path d="M32 46h16M44 42l6 4-6 4"/><rect x="54" y="34" width="20" height="24" rx="5"/><path d="M60 44h8M60 50h6" opacity=".6"/><path d="M80 46h14M90 42l6 4-6 4"/><circle cx="104" cy="46" r="9"/><path d="M100 46l3 3 6-7"/></svg>'},
  ],
  quiz:[
  {q:'Что такое хук в первые 3 секунды?', o:['Подпись автора','«Пощёчина» вниманию через эмоцию','Ссылка на источник','Список хэштегов'], a:1},
  {q:'В чём суть тизинга?', o:['Сразу выдать всю пользу','Дразнить и тянуть интригу, не давая всё сразу','Публиковать без текста','Копировать конкурентов'], a:1},
  {q:'Правильный скелет истории:', o:['Реклама → цена → скидка','Герой → препятствие → действие → ошибки и попытки','Заголовок → хэштеги → ссылка','Отзыв → отзыв → отзыв'], a:1},
  {q:'«Осталось 5 мест» — какой это триггер?', o:['Триггер халявы','Триггер дефицита','Триггер новизны','Триггер авторитета'], a:1},
  {q:'«Уже 3000 человек взяли» — какой триггер?', o:['Триггер толпы','Триггер эксклюзива','Триггер страха','Триггер кейсов'], a:0},
  {q:'Как правильно использовать триггер страха?', o:['Давить и запугивать','Пугать с заботой, честно показывая последствия','Обещать катастрофу без причины','Не использовать вовсе'], a:1},
  ],
  pairs:[
  ['Хук','Первая фраза-пощёчина, ловит внимание за 3 секунды'],
  ['Тизинг','Дразнить и тянуть интригу, не давая всё сразу'],
  ['Сторителлинг','Герой → препятствие → действие → ошибки'],
  ['Триггер дефицита','«Осталось мало» — страх упустить'],
  ['Триггер толпы','«Как все уже взяли» — не остаться в стороне'],
  ],
  task:{
    intro:'Сделай связку «хук + тизинг + история + триггер» для своего поста или Reels:',
    chips:['3 хука под эмоции','Строка тизинга','Мини-история','1–2 триггера'],
    ph:'Пример: хук — «Я слил 40 000 на рекламу, чтобы ты не повторял». Тизинг — «одна ошибка съедала весь бюджет, расскажу в конце». История — герой (новичок) → препятствие (нет заявок) → действие (сменил оффер) → результат. Триггер кейса + триггер страха упустить.',
    verdict:'Хук цепляет, тизинг держит до конца, история читается, триггеры подобраны верно. Совет куратора: проверь честность цифр и дефицита — не «500 мест» при 100 подписчиках, иначе доверие рушится.'
  }
}

];
/* Единый плоский список в порядке направлений: Медийность (основы+Reels) → Маркетинг → Нейросети.
   Глобальные индексы: 0..5 Медийность, 6..8 Маркетинг, 9..13 Нейросети. */
/* ============================================================
   ТРЕК 1. МЕДИЙНОСТЬ — уроки 4–6 (продолжение)
   Источник: OKO_ACADEMY_CURRICULUM.md, модули 1.4–1.6
   (Типы контента и эмоции · Сторис, эфиры, вовлечение · Характер и архетипы бренда).
   Формат один в один с AC_COURSE (academy/script.js).
   ============================================================ */
const MEDIA_LESSONS2 = [

/* ---------- УРОК 4: Типы контента и эмоции ---------- */
{
  title:'Типы контента и эмоции',
  sub:'1:02 · видео (голос Даниэля) + слайды + тест + игра',
  dur:'1:02',
  videoUrl:'https://okoteam.top/media/oko_media_l4.mp4',
  c1:'КОНТЕНТ', c2:'И ЭМОЦИИ',
  slides:[
  {t:'Личный контент строит доверие', pts:[
    'Люди <b>покупают у тех, кому доверяют</b>, а доверяют — знакомым',
    'Личный контент делает тебя знакомым: имя, лицо, история, быт',
    'Экспертность отвечает «умеет ли он», личное — «свой ли он мне»',
    'Без личного слоя блог остаётся витриной, к которой не привязываются'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="42" cy="26" r="11"/><path d="M24 56c2-13 8-19 18-19s16 6 18 19"/><path d="M74 30l10 8 18-20" stroke-width="3"/></svg>'},
  {t:'Три опоры контента', pts:[
    '<b>Личный</b> — сближает и рождает доверие к человеку за блогом',
    '<b>Экспертный</b> — показывает, что ты решаешь проблему аудитории',
    '<b>Продающий</b> — прямо ведёт к продукту и заявке',
    'Здоровый блог держит баланс трёх типов, а не давит одним'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M60 10 96 60H24z"/><path d="M42 60V38M60 60V26M78 60V44" opacity=".7"/><circle cx="60" cy="20" r="3" fill="currentColor" stroke="none"/></svg>'},
  {t:'Шкала эмоций', pts:[
    'Эмоции широкие: <b>радость, восхищение, благодарность</b>, и злость тоже',
    'В работу идут и <b>разочарование, несогласие, сопереживание</b>',
    'Нельзя быть всегда <b>«хорошеньким»</b> — пресный образ не запоминают',
    'Разрешай себе весь спектр: живой человек чувствует по-разному'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 50h92" opacity=".4"/><path d="M14 50C30 20 44 20 60 38s30 20 46-8"/><circle cx="30" cy="34" r="3" fill="currentColor" stroke="none"/><circle cx="60" cy="38" r="3" fill="currentColor" stroke="none"/><circle cx="90" cy="30" r="3" fill="currentColor" stroke="none"/></svg>'},
  {t:'Плохая реакция — это никакая', pts:[
    '<b>Худшая реакция — нейтральность</b>: пролистали и забыли',
    'Любая эмоция — даже спор — лучше молчаливого равнодушия',
    '<b>Нельзя нравиться всем</b>: пытаясь угодить каждому, теряешь лицо',
    'Позиция притягивает своих и отсеивает чужих — это нормально'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 18h34a8 8 0 0 1 8 8v14a8 8 0 0 1-8 8H36l-12 10V48h-4a8 8 0 0 1-8-8V26a8 8 0 0 1 8-8z"/><path d="M74 30h30M74 42h22" opacity=".7"/><path d="M92 52l12 8-12 8" opacity=".5"/></svg>'},
  {t:'Приверженность и связь', pts:[
    '<b>Приверженность</b> — сильная эмоциональная связь с аудиторией',
    'Цель — чтобы по тебе <b>скучали</b>, когда ты пропадаешь из ленты',
    'Связь строится на регулярности, честности и общих ценностях',
    'Приверженный подписчик прощает промахи и рекомендует тебя сам'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M60 56S28 40 28 24a14 14 0 0 1 26-6 14 14 0 0 1 26 6c0 16-20 32-20 32z" transform="translate(0 2)"/><path d="M14 32h10M96 32h10" opacity=".5"/></svg>'},
  {t:'Контент-план под нишу', pts:[
    'У каждой ниши свой набор рубрик: <b>кондитер</b> и <b>дизайнер</b> — разные',
    'Кондитер: процесс, начинки, отзывы, закулисье кухни, акции',
    'Фриланс-дизайнер: кейсы до/после, разбор ошибок, будни, оффер',
    'Не копируй чужой план — <b>собери свой</b> из личного, экспертного, продающего'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="22" y="10" width="76" height="52" rx="6"/><path d="M22 24h76" opacity=".6"/><path d="M40 10v52M64 10v52M82 10v52" opacity=".5"/><rect x="26" y="30" width="10" height="8" rx="2" fill="currentColor" stroke="none" opacity=".8"/><rect x="46" y="42" width="10" height="8" rx="2" fill="currentColor" stroke="none" opacity=".8"/></svg>'},
  {t:'Блог как комьюнити', pts:[
    'Сильный блог — это <b>место общения</b>, а не лента-монолог',
    'Транслируй мысль <b>«вы не одни»</b> — люди ищут поддержку и своих',
    'Отвечай в комментариях и директе — диалог удерживает лучше охватов',
    'Комьюнити защищает тебя, спорит с хейтом и приводит новых людей'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="40" cy="24" r="9"/><circle cx="80" cy="24" r="9"/><circle cx="60" cy="46" r="9"/><path d="M46 30l10 10M74 30L64 40M40 33v13M80 33v13" opacity=".6"/></svg>'},
  {t:'Чек-лист контента и эмоций', pts:[
    'В блоге есть личный слой, а не только экспертиза и продажи',
    'Разрешаешь себе весь спектр эмоций, не только «хорошенькое»',
    'Не боишься спорной реакции — боишься равнодушия',
    'Строишь приверженность: регулярность, честность, ценности',
    'Контент-план собран под свою нишу, блог работает как комьюнити'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="26" y="6" width="68" height="58" rx="8"/><path d="M36 20l4 4 7-8M36 36l4 4 7-8M36 52l4 4 7-8" stroke-width="2.8"/><path d="M54 21h28M54 37h28M54 53h20" opacity=".8"/></svg>'},
  ],
  quiz:[
  {q:'Почему личный контент так важен для продаж?', o:['Он дешевле в производстве','Люди покупают у тех, кому доверяют','Так требуют алгоритмы','Он собирает больше лайков автоматически'], a:1},
  {q:'Какая реакция аудитории считается худшей?', o:['Злость','Несогласие и спор','Нейтральность — пролистали и забыли','Слишком бурная радость'], a:2},
  {q:'Что урок говорит про попытку нравиться всем?', o:['Это главная цель блога','Нельзя нравиться всем — потеряешь лицо','Так делают все успешные блогеры','Это возможно при хорошем визуале'], a:1},
  {q:'Что такое приверженность в контексте блога?', o:['Число подписчиков','Частота публикаций','Сильная эмоциональная связь, чтобы по тебе скучали','Количество рекламных интеграций'], a:2},
  {q:'Каким должен быть контент-план?', o:['Скопирован у топового конкурента','Собран под свою нишу из личного, экспертного, продающего','Только продающим','Только развлекательным'], a:1},
  {q:'Какую мысль транслирует блог-комьюнити?', o:['«Купи прямо сейчас»','«Я лучше конкурентов»','«Вы не одни» — место общения и поддержки','«Смотрите, как я живу»'], a:2},
  ],
  pairs:[
  ['Личный контент','Строит доверие: покупают у знакомых'],
  ['Нейтральность','Худшая реакция — пролистали и забыли'],
  ['Шкала эмоций','Весь спектр, а не всегда «хорошенькое»'],
  ['Приверженность','Связь, чтобы по тебе скучали'],
  ['Блог-комьюнити','Место общения с мыслью «вы не одни»'],
  ],
  task:{
    intro:'Собери свой контент-план на неделю с балансом типов и эмоций. Распиши рубрики под свою нишу и отметь, где личное, где экспертное, где продающее и какую эмоцию несёт каждый пост:',
    chips:['Моя ниша','Личные рубрики','Экспертные рубрики','Продающие рубрики','Эмоция каждого поста'],
    ph:'Пример: Ниша — кондитер. Пн — личное: как я пришла в дело (тепло). Вт — экспертное: 3 ошибки в начинках (польза). Ср — закулисье кухни (доверие). Чт — отзыв клиента (радость). Пт — продающее: набор к празднику + дедлайн. Каждый пост несёт одну явную эмоцию, а не «нейтралку».',
    verdict:'Баланс типов виден, и это уже сильнее, чем сплошные продажи. Совет куратора: проверь, чтобы в неделе был хотя бы один пост, который может вызвать спор или сильное чувство — именно он пробьёт равнодушие. И добавь личного: люди привязываются к человеку, а не к рубрикам. Строй приверженность регулярностью, чтобы по тебе начали скучать.'
  }
},

/* ---------- УРОК 5: Сторис, эфиры, вовлечение ---------- */
{
  title:'Сторис, эфиры, вовлечение',
  sub:'4:30 · видео + слайды + тест + игра',
  dur:'4:30',
  c1:'СТОРИС', c2:'И ЭФИРЫ',
  slides:[
  {t:'Зачем нужны сторис', pts:[
    'Сторис — <b>мост к посту</b>: прогреваешь и заводишь читателя в контент',
    'Это лента «здесь и сейчас»: события жизни, быт, закулисье',
    '<b>Прогрев</b> в сторис готовит аудиторию к продаже без давления',
    'Регулярные сторис держат тебя в верхних строчках у подписчиков'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="42" y="10" width="36" height="50" rx="8"/><circle cx="60" cy="20" r="6"/><path d="M50 34h20M50 42h14" opacity=".7"/><circle cx="20" cy="35" r="7" opacity=".7"/><circle cx="100" cy="35" r="7" opacity=".7"/></svg>'},
  {t:'Сторис ведут в пост', pts:[
    'Не давай всё в сторис — <b>дразни</b> и отправляй дочитать в посте',
    'Анонс, интрига, кусочек результата — и ссылка «подробнее в ленте»',
    'Так сторис поднимают охваты поста, а пост углубляет тему',
    'Связка сторис плюс пост работает сильнее, чем каждый по отдельности'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="12" width="30" height="46" rx="7"/><rect x="76" y="16" width="30" height="38" rx="5"/><path d="M48 35h22" opacity=".8"/><path d="M62 29l10 6-10 6" opacity=".8"/></svg>'},
  {t:'Эфиры — сильнейший инструмент', pts:[
    '<b>Эфир (Live)</b> — самый мощный формат сближения: ты живой, здесь и сейчас',
    'Живая обратная связь: вопросы, реакции, разбор в реальном времени',
    'Эфир снимает дистанцию сильнее любого поста — тебя видят настоящим',
    'После эфира доверие и лояльность растут скачком'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="30" y="14" width="60" height="42" rx="8"/><circle cx="60" cy="35" r="9"/><path d="M18 26a18 18 0 0 0 0 18M102 26a18 18 0 0 1 0 18" opacity=".6"/><circle cx="44" cy="22" r="2.5" fill="currentColor" stroke="none"/></svg>'},
  {t:'Как удерживать на эфире', pts:[
    '<b>Меняй ракурс</b> и картинку — статичная камера усыпляет',
    'Играй <b>тоном и темпом</b>: тише-громче, быстрее-медленнее',
    'Ставь <b>крючки</b>: «через минуту покажу главное», «дождитесь конца»',
    'Обращайся к зрителям по именам — живой диалог держит в эфире'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 50V30l16-10v40z"/><path d="M36 26l30-12v42L36 44" opacity=".85"/><path d="M80 24v22M90 30v16M100 20v30" opacity=".6"/></svg>'},
  {t:'Опросы: инструмент вовлечения', pts:[
    '<b>Опросы</b> вовлекают в один тап и оживляют охваты сторис',
    'Через опросы <b>выявляешь проблемы</b>, которые потом закрываешь продуктом',
    'Спрашивай о боли, выборе, предпочтениях — аудитория сама даёт ТЗ',
    'Ответивший чувствует, что его услышали, — растёт связь'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="22" y="16" width="76" height="16" rx="8"/><rect x="22" y="40" width="52" height="16" rx="8"/><path d="M22 24h50" opacity=".5"/><circle cx="90" cy="24" r="3" fill="currentColor" stroke="none"/></svg>'},
  {t:'Развлекательная форма', pts:[
    'Вовлекай <b>играючи</b>: тесты, «угадай», рубрики, интерактивные наклейки',
    'Развлечение снижает барьер — подписчик участвует, а не смотрит молча',
    'Даже сложную тему подавай легко: игра запоминается лучше лекции',
    'Чередуй пользу и развлечение, чтобы сторис не превращались в отчёт'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="26" y="18" width="34" height="34" rx="6" transform="rotate(-8 43 35)"/><rect x="60" y="18" width="34" height="34" rx="6" transform="rotate(8 77 35)"/><circle cx="43" cy="35" r="3" fill="currentColor" stroke="none"/><circle cx="72" cy="30" r="2.5" fill="currentColor" stroke="none"/><circle cx="82" cy="40" r="2.5" fill="currentColor" stroke="none"/></svg>'},
  {t:'Живой персонаж даже в коммерции', pts:[
    'Даже у <b>коммерческого</b> аккаунта должен быть живой персонаж',
    'За брендом — человек: голос, мнение, эмоции, а не безликий логотип',
    'Персонаж отличает тебя от десятков одинаковых магазинов в нише',
    'Люди возвращаются к личности, а к обезличенной витрине — нет'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="60" cy="24" r="11"/><path d="M40 58c2-13 9-19 20-19s18 6 20 19"/><path d="M52 24h.5M68 24h.5" stroke-width="3"/><path d="M54 30c4 4 8 4 12 0" opacity=".8"/></svg>'},
  {t:'Чек-лист вовлечения', pts:[
    'Ведёшь сторис регулярно и заводишь ими читателя в пост',
    'Проводишь эфиры и умеешь удерживать: ракурс, тон, крючки',
    'Используешь опросы, чтобы выявлять боли аудитории',
    'Подаёшь контент играючи, чередуешь пользу и развлечение',
    'У аккаунта есть живой персонаж, даже если он коммерческий'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="26" y="6" width="68" height="58" rx="8"/><path d="M36 20l4 4 7-8M36 36l4 4 7-8M36 52l4 4 7-8" stroke-width="2.8"/><path d="M54 21h28M54 37h28M54 53h20" opacity=".8"/></svg>'},
  ],
  quiz:[
  {q:'Какую основную роль играют сторис?', o:['Заменяют посты полностью','Вовлекают в пост, прогревают и показывают события жизни','Нужны только для рекламы','Служат архивом фотографий'], a:1},
  {q:'Почему эфиры называют сильнейшим инструментом?', o:['Их проще снимать, чем сторис','Дают живую обратную связь и снимают дистанцию','Их продвигают лучше всех форматов','Они не требуют подготовки'], a:1},
  {q:'Что помогает удерживать зрителя на эфире?', o:['Одна статичная камера и ровный тон','Смена ракурса, игра тоном и крючки','Максимально длинный монолог','Отключить комментарии'], a:1},
  {q:'Чем полезны опросы кроме вовлечения?', o:['Накручивают охваты','Выявляют проблемы, которые ты закрываешь продуктом','Заменяют аналитику','Повышают качество фото'], a:1},
  {q:'Нужен ли живой персонаж коммерческому аккаунту?', o:['Нет, коммерции хватает товара','Да — за брендом должен стоять человек','Только на старте','Только в лайфстайл-блогах'], a:1},
  {q:'Как лучше подавать вовлекающий контент?', o:['Строго и по-деловому','Играючи: тесты, интерактив, чередуя пользу и развлечение','Только через длинные тексты','Через сплошные продажи'], a:1},
  ],
  pairs:[
  ['Сторис','Мост к посту: прогрев и события жизни'],
  ['Эфир','Живая обратная связь, снимает дистанцию'],
  ['Крючки','Удержание на эфире: «дождитесь конца»'],
  ['Опросы','Выявляют боли, которые закрываешь продуктом'],
  ['Живой персонаж','Человек за брендом даже в коммерции'],
  ],
  task:{
    intro:'Спланируй вовлекающую цепочку на день: сторис, которые ведут в пост, тему эфира и опрос, выявляющий боль. Пропиши, как удержишь внимание и где проявится твой живой персонаж:',
    chips:['Сторис-прогрев','Ссылка в пост','Тема эфира','Крючки удержания','Опрос про боль'],
    ph:'Пример: Сторис — «сегодня разберу ошибку, из-за которой сливают бюджет», в конце «подробно в новом посте». Эфир вечером: разбор упаковки подписчиков вживую, крючки — «главный совет в конце». Опрос: «Что мешает вести блог? — нет времени / не знаю о чём / стесняюсь камеры». Персонаж — говорю прямо, шучу над собой.',
    verdict:'Цепочка связная: сторис прогревают, пост углубляет, эфир сближает. Совет куратора: в опросе спрашивай про конкретную боль, а не абстрактно, — ответы станут готовым ТЗ для твоего продукта. На эфире не держи одну статичную камеру: меняй ракурс и ставь крючок в начале, чтобы досидели до финала. И не прячь персонажа за пользой — люди остаются ради человека.'
  }
},

/* ---------- УРОК 6: Характер и архетипы бренда ---------- */
{
  title:'Характер и архетипы бренда',
  sub:'4:40 · видео + слайды + тест + игра',
  dur:'4:40',
  c1:'ХАРАКТЕР', c2:'БРЕНДА',
  slides:[
  {t:'Бренд как человек', pts:[
    'Сильный бренд общается с аудиторией <b>как человек</b>, а не как инструкция',
    'У него есть <b>характер</b>: манера речи, ценности, реакции, юмор',
    'Люди привязываются к характерам, а не к безличным названиям',
    'Определи характер один раз — и весь контент зазвучит в одном тоне'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="60" cy="26" r="12"/><path d="M40 58c2-14 9-20 20-20s18 6 20 20"/><path d="M18 30l6 6 8-10M96 30l-6 6-8-10" opacity=".6"/></svg>'},
  {t:'Что такое архетип', pts:[
    '<b>Архетип</b> — узнаваемый образ-роль, понятный без объяснений',
    'Он задаёт, как бренд говорит, что обещает и какие эмоции несёт',
    'Опора на архетип делает бренд <b>цельным и предсказуемым</b> для своих',
    'Аудитория считывает архетип интуитивно и быстро выбирает «свой» бренд'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M60 10l8 16 18 2-13 13 4 18-17-9-17 9 4-18-13-13 18-2z"/><circle cx="60" cy="34" r="4" fill="currentColor" stroke="none"/></svg>'},
  {t:'Стабильность и контроль', pts:[
    'Архетип <b>стабильности</b>: надёжность, порядок, забота, безопасность',
    'Обещание — «со мной спокойно и предсказуемо, я не подведу»',
    'Тон спокойный, уверенный, без крайностей и агрессии',
    'Подходит там, где клиент боится риска и ищет опору'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M60 10l32 12v14c0 18-14 28-32 34-18-6-32-16-32-34V22z"/><path d="M48 34l8 8 18-18" stroke-width="2.8"/></svg>'},
  {t:'Свобода', pts:[
    'Архетип <b>свободы</b>: независимость, путешествия, «живи по-своему»',
    'Обещание — «сними рамки, выбирай сам, будь автором своей жизни»',
    'Тон лёгкий, вдохновляющий, зовущий в движение и перемены',
    'Притягивает тех, кто устал от правил и хочет дышать'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M22 44c10-2 16-8 24-8s10 6 18 6 14-8 24-10" opacity=".7"/><path d="M60 12c-8 8-10 18-6 26 6-2 12-8 12-16 0 8 4 14 10 16 4-10 0-20-8-26" /><path d="M60 38v20" opacity=".6"/></svg>'},
  {t:'Вызов и трансформация', pts:[
    'Архетип <b>вызова</b>: рост, преодоление, «стань лучшей версией себя»',
    'Обещание — «через усилие и изменение я приведу тебя к результату»',
    'Тон энергичный, прямой, местами провокационный и требовательный',
    'Резонирует с теми, кто готов меняться и хочет прорыва'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M14 58h30l-8-20 22 6-6-22 26 8" /><path d="M86 14l6 4 4-6" opacity=".6"/><circle cx="44" cy="38" r="2.5" fill="currentColor" stroke="none"/></svg>'},
  {t:'Радость и тепло', pts:[
    'Архетип <b>радости</b>: лёгкость, юмор, забота, домашнее тепло',
    'Обещание — «со мной хорошо, тепло и по-доброму»',
    'Тон дружелюбный, живой, с улыбкой и человеческим отношением',
    'Собирает аудиторию, которая ищет позитив и принятие'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="60" cy="34" r="24"/><path d="M50 30h.5M70 30h.5" stroke-width="3.4"/><path d="M46 42c6 8 22 8 28 0" stroke-width="2.8"/></svg>'},
  {t:'Чистые характеры редки', pts:[
    'На практике <b>чистый архетип встречается редко</b> — обычно это смесь',
    'Например: стабильность + тепло, или свобода + вызов',
    'Именно <b>сочетание</b> делает бренд объёмным и уникальным',
    'Смесь — не каша: у неё есть ведущий архетип и один-два оттенка'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="48" cy="35" r="20"/><circle cx="72" cy="35" r="20"/><path d="M60 20a20 20 0 0 1 0 30 20 20 0 0 1 0-30z" opacity=".5"/></svg>'},
  {t:'ДЗ: характер твоего бренда', pts:[
    'Определи <b>ведущий архетип</b> и один-два поддерживающих оттенка',
    'Пропиши манеру речи, ценности и запретные для бренда темы',
    'Проверь: звучит ли твой последний контент в этом характере',
    'Характер — не украшение, а фильтр решений «наше / не наше»'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="30" y="8" width="60" height="54" rx="8"/><path d="M40 22l4 4 6-7M40 36l4 4 6-7M40 50l4 4 6-7" stroke-width="2.8"/><path d="M58 23h22M58 37h22M58 51h16" opacity=".8"/></svg>'},
  ],
  quiz:[
  {q:'Что значит «у бренда есть характер»?', o:['У него красивый логотип','Он общается как человек: манера речи, ценности, реакции','Он часто постит','У него много подписчиков'], a:1},
  {q:'Что такое архетип бренда?', o:['Шрифт и цвет','Узнаваемый образ-роль, задающий тон и обещание','Название компании','Формат сторис'], a:1},
  {q:'Какому архетипу соответствуют надёжность, порядок и забота?', o:['Свобода','Вызов и трансформация','Стабильность и контроль','Радость и тепло'], a:2},
  {q:'Что обещает архетип вызова и трансформации?', o:['Спокойствие и предсказуемость','Рост и преодоление, «стань лучшей версией себя»','Лёгкость и юмор','Независимость и путешествия'], a:1},
  {q:'Почему чистые архетипы встречаются редко?', o:['Их запрещают алгоритмы','Обычно бренд — смесь, и это делает его уникальнее','Их сложно нарисовать','Так дороже в производстве'], a:1},
  {q:'Чем на практике служит характер бренда?', o:['Украшением профиля','Фильтром решений «наше / не наше»','Заменой контент-плана','Способом накрутки'], a:1},
  ],
  pairs:[
  ['Характер бренда','Общение с аудиторией как с человеком'],
  ['Стабильность','Надёжность, порядок, забота, безопасность'],
  ['Свобода','Независимость, «живи по-своему»'],
  ['Вызов','Рост и трансформация, «стань лучше»'],
  ['Смесь архетипов','Ведущий плюс оттенки — уникальность бренда'],
  ],
  task:{
    intro:'Определи характер своего бренда как ДЗ модуля. Выбери ведущий архетип и один-два оттенка, пропиши манеру речи, ценности и запретные темы, а затем проверь последний контент на соответствие:',
    chips:['Ведущий архетип','Оттенки','Манера речи','Ценности','Запретные темы','Проверка контента'],
    ph:'Пример: Ведущий — вызов (рост и результат), оттенок — тепло. Манера речи: прямо, по делу, с поддержкой, без токсичности. Ценности: честность, дисциплина, забота о результате клиента. Запретные темы: обесценивание, пустой хайп. Проверка: последние 5 постов звучат в этом характере, кроме одного «нейтрального» — переписать.',
    verdict:'Характер собран правильно: есть ведущий архетип и оттенок, а не размытое «всё сразу». Совет куратора: держи этот паспорт характера рядом и сверяй каждый пост — он и есть фильтр «наше / не наше». Если контент выпадает из тона, дело не в теме, а в подаче: перепиши в голосе бренда. Смесь архетипов — твоё преимущество, не бойся сочетать, но всегда оставляй один ведущий.'
  }
}

];
/* ================= МАРКЕТИНГ: уроки 4-6 (продолжение) =================
   Модули 2.5 (Анализ конкурентов), 2.6 (Монетизация и продукт),
   2.7 (Продвижение и алгоритмы). Формат AC_COURSE. */

const MARKETING_LESSONS2 = [

/* ---------- УРОК 4: Анализ конкурентов ---------- */
{
  title:'Анализ конкурентов',
  sub:'4:12 · четыре типа · таблица · что делать с каждым',
  dur:'4:12',
  c1:'АНАЛИЗ', c2:'КОНКУРЕНТОВ',
  slides:[
  {t:'Зачем вообще смотреть на других', pts:[
    'Конкурент — не враг, а <b>бесплатная разведка</b>: он уже проверил спрос за свои деньги',
    'Ты видишь, какие офферы заходят, а какие проваливаются — до того, как вложился сам',
    'Цель анализа не «скопировать», а <b>найти щель</b>, куда никто не встал',
    'Не смотришь на рынок — работаешь вслепую и повторяешь чужие ошибки'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="46" cy="34" r="18"/><path d="M59 47l16 16"/><circle cx="46" cy="34" r="7"/><path d="M46 20v-6M46 54v6M32 34h-6M60 34h6" opacity=".6"/></svg>'},
  {t:'Две оси таблицы', pts:[
    'Строим сетку: по горизонтали — <b>товар</b> (похож / другой), по вертикали — <b>потребность</b> клиента',
    'Из двух осей рождаются четыре клетки конкурентов — от прямых до неявных',
    'Каждая клетка требует своей тактики, единого «списка врагов» не бывает',
    'Раскинул сетку — сразу видно, где тесно, а где пусто'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="30" y="12" width="60" height="46" rx="4"/><path d="M60 12v46M30 35h60"/><circle cx="45" cy="24" r="3" fill="currentColor" stroke="none"/><circle cx="75" cy="24" r="3" fill="currentColor" stroke="none"/><circle cx="45" cy="46" r="3" fill="currentColor" stroke="none"/><circle cx="75" cy="46" r="3" fill="currentColor" stroke="none"/></svg>'},
  {t:'Прямые конкуренты', pts:[
    '<b>Тот же товар — та же потребность.</b> Кофейня напротив другой кофейни',
    'Бьётесь за одного и того же клиента лоб в лоб — тут решает отстройка',
    'Смотри не на цену, а на то, чего у них <b>нет</b>: сервис, скорость, атмосфера',
    'Прямой конкурент задаёт планку — держи её и добавляй одно своё «зато»'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M30 50V26l16-10 16 10v24z"/><path d="M74 50V26l16-10 16 10v24z"/><path d="M46 50V38h-16v12M90 50V38H74v12"/><path d="M60 58h0" opacity=".4"/><path d="M58 34h4" opacity=".7"/></svg>'},
  {t:'Косвенные конкуренты', pts:[
    '<b>Похожий товар — другая цель.</b> Кофейня и чайная: напиток тот же жанр, повод разный',
    'Клиент выбирает между вами не всегда, а по настроению и ситуации',
    'Тактика — <b>перехватывать поводы</b>: «зашёл за чаем — попробуй наш раф»',
    'Косвенный конкурент расширяет рынок, а не делит его — учись у его аудитории'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M28 24h20v10a10 10 0 01-20 0z"/><path d="M48 26h5a4 4 0 010 8h-5" opacity=".7"/><path d="M38 44v8" opacity=".6"/><path d="M74 24h20v10a10 10 0 01-20 0z"/><path d="M80 14c0 4-3 4-3 8M88 14c0 4-3 4-3 8" opacity=".7"/><path d="M84 44v8" opacity=".6"/></svg>'},
  {t:'Неявные конкуренты', pts:[
    '<b>Другой товар — та же потребность.</b> С кофейней конкурирует и энергетик, и сон',
    'Клиент решает свою задачу (взбодриться) — и не всегда через твой продукт',
    'Самый опасный тип: ты его не видишь в лицо, а он забирает деньги',
    'Тактика — <b>продавать саму потребность</b>, а не форму: «нужна энергия — вот ритуал»'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M60 12l6 12 13 2-9 9 2 13-12-6-12 6 2-13-9-9 13-2z"/><circle cx="60" cy="41" r="4" fill="currentColor" stroke="none"/><path d="M22 30l4 4M94 30l-4 4M30 56l5-3M85 56l-5-3" opacity=".5"/></svg>'},
  {t:'Будущие и партнёры', pts:[
    '<b>Будущие</b> — те, кто вот-вот войдёт в нишу: сети, маркетплейсы, крупные игроки',
    '<b>Партнёры</b> — соседи по потребности, с кем можно дружить: пекарня рядом с кофейней',
    'Готовься к будущим заранее: строй базу лояльных, пока их ещё нет',
    'С партнёром <b>обмен трафиком</b> дешевле любой рекламы — ищи взаимную выгоду'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="38" cy="34" r="12"/><circle cx="82" cy="34" r="12"/><path d="M50 30h20M50 38h20" opacity=".7"/><path d="M62 26l8 4-8 4M58 34l-8 4 8 4" opacity=".8"/></svg>'},
  {t:'Как собрать анализ за вечер', pts:[
    'Выпиши <b>5-7 игроков</b> в каждую из четырёх клеток — руками, без автоматики',
    'По каждому: оффер, цена, сильное, слабое, чем цепляет в первые 3 секунды',
    'Найди <b>общую дыру</b> — то, чего нет ни у кого: это и есть твоё место',
    'Анализ живой: обновляй раз в квартал, ниши двигаются быстро'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="24" y="10" width="72" height="52" rx="6"/><path d="M34 24h20M34 34h20M34 44h14" opacity=".8"/><path d="M64 22l4 4 8-8M64 34l4 4 8-8" stroke-width="2.8"/><circle cx="72" cy="48" r="6"/><path d="M76 52l5 5"/></svg>'},
  ],
  quiz:[
  {q:'По каким двум осям строится таблица конкурентов?', o:['Цена и качество','Товар и потребность клиента','Возраст и доход','Онлайн и офлайн'], a:1},
  {q:'Кофейня напротив другой кофейни — это конкурент…', o:['Прямой','Косвенный','Неявный','Будущий'], a:0},
  {q:'Похожий товар, но другая цель использования — это…', o:['Прямой','Косвенный','Неявный','Партнёр'], a:1},
  {q:'Другой товар закрывает ту же потребность клиента — это…', o:['Прямой','Косвенный','Неявный','Будущий'], a:2},
  {q:'Пекарня рядом с кофейней, с которой выгоден обмен трафиком, — это…', o:['Прямой конкурент','Неявный конкурент','Партнёр','Будущий конкурент'], a:2},
  {q:'Главная цель анализа конкурентов по уроку:', o:['Скопировать сильнейшего','Найти незанятую щель на рынке','Снизить свою цену','Собрать список врагов'], a:1},
  ],
  pairs:[
  ['Прямые','Тот же товар, та же потребность'],
  ['Косвенные','Похожий товар, другая цель'],
  ['Неявные','Другой товар, та же потребность'],
  ['Партнёры','Сосед по потребности, обмен трафиком'],
  ['Будущие','Крупный игрок, который вот-вот войдёт'],
  ],
  task:{
    intro:'Разбери свой рынок по таблице урока — заполни все четыре клетки конкретными именами и решениями:',
    chips:['Прямые','Косвенные','Неявные','Партнёры/будущие','Свободная щель'],
    ph:'Пример: ниша — монтаж Reels. Прямые — другие монтажёры-фрилансеры. Косвенные — шаблонные приложения (CapCut-пресеты). Неявные — заказчик монтирует сам. Партнёры — сценаристы и таргетологи. Щель — никто не даёт монтаж + аналитику в одном пакете.',
    verdict:'Клетки заполнены по делу, неявный конкурент найден верно — это уже сильнее большинства. Совет куратора: сформулируй свою «щель» одной фразой-оффером, чтобы она сразу читалась в шапке профиля.'
  }
},

/* ---------- УРОК 5: Монетизация и продукт ---------- */
{
  title:'Монетизация и продукт',
  sub:'4:38 · немного пользы · каскад продукта · проверка спроса',
  dur:'4:38',
  c1:'МОНЕТИЗАЦИЯ', c2:'И ПРОДУКТ',
  slides:[
  {t:'Ошибка «откупиться пользой»', pts:[
    'Новичок вываливает <b>максимум бесплатного</b> — и клиент уходит сытым, но без покупки',
    'Бесплатно должно решать <b>маленькую</b> задачу, платно — большую',
    'Много пользы даром обесценивает продукт и приучает не платить',
    'Твоя щедрость — это <b>тест-драйв</b>, а не благотворительность'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M24 52h30l-4-26H28z"/><path d="M32 26c0-8 3-12 9-12s9 4 9 12" opacity=".7"/><path d="M74 20l6 12 12 2-9 9 2 12-11-6-11 6 2-12-9-9 12-2z" opacity=".85"/><path d="M39 40h0" opacity=".4"/></svg>'},
  {t:'Принцип «немного пользы»', pts:[
    'Дай бесплатно/за минимальный чек <b>первый шаг</b> — быстрый и осязаемый результат',
    'Клиент почувствовал «работает» → сам захотел следующий шаг за деньги',
    'Пример: бесплатный разбор одного Reels → платный монтаж серии',
    'Немного пользы = <b>крючок доверия</b>, а не весь улов'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M40 12c0 14 8 18 8 30a8 8 0 01-16 0"/><path d="M32 42a10 10 0 0020 0" opacity=".7"/><circle cx="40" cy="12" r="4"/><path d="M64 34h22M78 28l8 6-8 6" opacity=".8"/><path d="M96 26h14M96 34h10M96 42h14" opacity=".6"/></svg>'},
  {t:'Каскад продукта', pts:[
    'Каждая покупка <b>рождает новую потребность</b> — встраивайся на каждом этапе',
    'Купил камеру → нужен свет → нужен монтаж → нужен продвиженец',
    'Продавай не один продукт, а <b>лестницу решений</b> по пути клиента',
    'Клиент, прошедший каскад, приносит в разы больше, чем разовый'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 58h20V44h20V30h20V16h22"/><circle cx="28" cy="52" r="3" fill="currentColor" stroke="none"/><circle cx="48" cy="38" r="3" fill="currentColor" stroke="none"/><circle cx="68" cy="24" r="3" fill="currentColor" stroke="none"/><path d="M90 10l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6-4.5-4 6-1z" fill="currentColor" stroke="none" opacity=".9"/></svg>'},
  {t:'Начни с востребованного', pts:[
    'Не изобретай спрос — заходи с продуктом, который <b>уже покупают</b>',
    'Первая позиция в каскаде должна быть «горячей», чтобы завести поток',
    'Экзотику и «уникальное» подтягивай вторым-третьим шагом, на разогретой базе',
    'Востребованный вход = <b>дешёвый трафик</b> и быстрая проверка гипотез'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M60 54c-8-6-20-14-20-26a12 12 0 0120-6 12 12 0 0120 6c0 12-12 20-20 26z"/><path d="M84 18c3-2 8-2 10 2M88 12c2-4 8-4 10 0" opacity=".6"/><path d="M28 30c-3 0-7 2-7 7M24 22c-4 0-8 3-8 8" opacity=".6"/></svg>'},
  {t:'Проверь спрос через Wordstat', pts:[
    '<b>Wordstat</b> показывает, сколько людей в месяц ищут твою тему в Яндексе',
    'Тысячи запросов = спрос есть; десятки = рынка пока нет',
    'Смотри сезонность и смежные запросы — там подсказки для каскада',
    'Проверка спроса <b>до вложений</b> экономит месяцы работы вхолостую'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="42" cy="30" r="16"/><path d="M54 42l14 14"/><path d="M34 30h16M42 22v16" opacity=".7"/><path d="M78 58V40M90 58V30M102 58V46" stroke-width="3"/></svg>'},
  {t:'Критерии успеха продукта', pts:[
    'Продукт работает, если <b>растёт статистика И растёт доход</b> — оба сразу',
    'Лайки без денег — тщеславие; деньги без охватов — потолок',
    'Мнения людей <b>не из твоей ЦА</b> — в игнор, они искажают картину',
    'Считай не эмоции, а <b>цифры за период</b>: до / после каждой гипотезы'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M16 58h92" opacity=".5"/><path d="M22 50l18-16 14 10 30-28"/><path d="M84 16h10v10" stroke-linejoin="round"/><rect x="20" y="46" width="8" height="12" fill="currentColor" fill-opacity=".2" stroke="none"/><rect x="52" y="40" width="8" height="18" fill="currentColor" fill-opacity=".2" stroke="none"/></svg>'},
  {t:'Как выстроить свою монетизацию', pts:[
    'Шаг 1 — определи главную боль ЦА и <b>горячий вход</b> под неё',
    'Шаг 2 — дай «немного пользы» бесплатно, чтобы клиент увидел результат',
    'Шаг 3 — выстрой <b>каскад</b>: что человек захочет сразу после покупки',
    'Шаг 4 — держи руку на пульсе: статистика + доход, гипотеза за гипотезой'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="20" y="12" width="16" height="16" rx="4"/><rect x="52" y="12" width="16" height="16" rx="4"/><rect x="84" y="12" width="16" height="16" rx="4"/><path d="M36 20h16M68 20h16"/><rect x="52" y="44" width="16" height="16" rx="4"/><path d="M60 28v16" opacity=".7"/><path d="M56 50l3 3 6-6" stroke-width="2.8"/></svg>'},
  ],
  quiz:[
  {q:'Главная ошибка новичка в монетизации по уроку:', o:['Слишком высокая цена','Вываливает максимум пользы бесплатно','Мало рекламы','Нет логотипа'], a:1},
  {q:'Что должно решать бесплатное по принципу «немного пользы»?', o:['Всю задачу целиком','Маленькую задачу, как тест-драйв','Ничего, оно для галочки','Задачу конкурента'], a:1},
  {q:'«Купил камеру → нужен свет → нужен монтаж» — это пример…', o:['Прямой конкуренции','Каскада продукта','Демпинга','Сторителлинга'], a:1},
  {q:'С какого продукта советуют начинать каскад?', o:['С самого уникального','С самого дорогого','С уже востребованного','С бесплатного навсегда'], a:2},
  {q:'Каким сервисом проверяют спрос на тему?', o:['Wordstat','Photoshop','Suno','Kling'], a:0},
  {q:'Продукт считается успешным, когда…', o:['Много лайков','Растёт и статистика, и доход','Хвалят друзья','Низкая себестоимость'], a:1},
  ],
  pairs:[
  ['Немного пользы','Бесплатно — маленький результат, за большим платят'],
  ['Каскад продукта','Покупка рождает следующую потребность'],
  ['Горячий вход','Начинать с уже востребованного продукта'],
  ['Wordstat','Проверка спроса по числу запросов'],
  ['Критерий успеха','Рост статистики плюс рост дохода'],
  ],
  task:{
    intro:'Собери свою мини-воронку монетизации по шагам урока — от бесплатного крючка до каскада:',
    chips:['Горячий вход','Что даю бесплатно','Первый платный шаг','Следующий в каскаде','Как проверю спрос'],
    ph:'Пример: вход — монтаж Reels (востребовано). Бесплатно — разбор одного ролика клиента. Платный шаг — монтаж серии из 7 Reels. Каскад — ведение аккаунта → таргет. Спрос проверю по Wordstat: «монтаж reels» и смежные.',
    verdict:'Воронка логичная: бесплатное решает малую задачу, каскад ведёт клиента дальше. Совет куратора: замерь конверсию из бесплатного разбора в платный монтаж — это твоя ключевая цифра, по ней и оптимизируй оффер.'
  }
},

/* ---------- УРОК 6: Продвижение и алгоритмы ---------- */
{
  title:'Продвижение и алгоритмы',
  sub:'4:05 · масса · чаты активности · закуп трафика',
  dur:'4:05',
  c1:'ПРОДВИЖЕНИЕ', c2:'И АЛГОРИТМЫ',
  slides:[
  {t:'Масса задавливает алгоритмы', pts:[
    'Главный рычаг залёта — <b>объём</b>: 10-15 роликов в день, а не один «идеальный»',
    'Алгоритм тестирует контент на маленькой аудитории — дай ему много попыток',
    'Один ролик — лотерея; поток роликов — <b>система</b>, где что-то обязательно выстрелит',
    'Количество на дистанции рождает качество: набиваешь руку и попадаешь в тренд'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="14" y="12" width="18" height="26" rx="3"/><rect x="26" y="20" width="18" height="26" rx="3"/><rect x="38" y="28" width="18" height="26" rx="3"/><path d="M64 40h20M76 32l10 8-10 8" opacity=".8"/><path d="M94 24l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6-4.5-4 6-1z" fill="currentColor" stroke="none" opacity=".9"/></svg>'},
  {t:'Не гонись за «одним шедевром»', pts:[
    'Перфекционизм убивает поток: пока полируешь один ролик, конкурент выложил десять',
    'Готово и опубликовано <b>лучше идеального в черновиках</b>',
    'Каждый ролик — это гипотеза: выложил, замерил, усилил то, что зашло',
    'Скорость и регулярность алгоритм ценит <b>выше вылизанности</b>'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="46" cy="34" r="22"/><circle cx="46" cy="34" r="14" opacity=".6"/><circle cx="46" cy="34" r="6" fill="currentColor" stroke="none"/><path d="M78 20l8-8M84 12h-6v6" opacity=".7"/><path d="M86 40l-6 6M80 46h6v-6" opacity=".5"/></svg>'},
  {t:'Чаты активности: как надо', pts:[
    'Чат активности реально раскачивает блог — но <b>только осмысленными действиями</b>',
    'Развёрнутые комментарии, сохранения, дочитывания — сигнал «контент живой»',
    'Такая активность <b>похожа на органику</b>, и алгоритм ей доверяет',
    'Договорись с 10-20 такими же авторами и обменивайтесь <b>настоящей</b> реакцией'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 18h44a6 6 0 016 6v14a6 6 0 01-6 6H40l-12 10V44h-8a6 6 0 01-6-6V24a6 6 0 016-6z"/><path d="M28 28h28M28 36h18" opacity=".8"/><circle cx="92" cy="30" r="10"/><path d="M88 30l3 3 6-6" stroke-width="2.8"/></svg>'},
  {t:'Чаты активности: как НЕ надо', pts:[
    '«Огонёчки» и пустые «класс!» — это <b>засорение</b>, а не продвижение',
    'Массовая накрутка одинаковых реакций читается алгоритмом как <b>спам</b>',
    'Пустая активность роняет средние показатели: досмотр падает — охват режется',
    'Лучше 10 живых комментариев, чем 200 эмодзи от «мёртвых» аккаунтов'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="42" cy="34" r="22"/><path d="M30 22l24 24M54 22L30 46"/><path d="M78 18c0 5-4 5-4 10M90 18c0 5-4 5-4 10M84 46v6" opacity=".6"/></svg>'},
  {t:'Об алгоритмах — решай практикой', pts:[
    'Мнений об алгоритмах тысячи, <b>проверенных — единицы</b>: не верь на слово',
    'Спорные вопросы (новый аккаунт vs переучивание старого) решаются <b>тестом</b>',
    'Запусти два подхода параллельно и сравни цифры за 2-4 недели',
    'Твоя ниша уникальна — <b>твоя статистика</b> важнее любого гуру'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M60 14v10M60 24l-22 8v14c0 0 8 8 22 8s22-8 22-8V32z"/><path d="M38 32l22 8 22-8" opacity=".7"/><path d="M60 40v14" opacity=".5"/><circle cx="60" cy="12" r="4"/></svg>'},
  {t:'Трафик в Telegram: игра вдолгую', pts:[
    'Закуп рекламы в Telegram — <b>игра «в перспективу»</b>: окупается на объёме и дистанции',
    'Один разовый пост редко «отбивается» — считай серию закупов как систему',
    'Бери <b>объёмом каналов</b>, а не одним крупным: диверсифицируй риск',
    'Дешёвая подписка сегодня → прибыль через каскад продукта завтра'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M18 42l84-26-14 44-20-14-10 12-4-16z"/><path d="M40 42l28-18-40 12" opacity=".6"/><path d="M54 50l0 0" opacity=".4"/></svg>'},
  {t:'Куда закупать рекламу', pts:[
    'Реклама только в <b>целевые и смежные</b> по аудитории каналы — иначе слив бюджета',
    'Совпадение аудитории важнее размера канала: 5к «своих» бьют 50к «чужих»',
    'Проверяй канал: живые комментарии, ровный охват, отсутствие накрутки',
    'Смежная ниша (не прямой конкурент) даёт <b>тёплую</b> аудиторию по пути клиента'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="46" cy="35" r="20"/><circle cx="74" cy="35" r="20"/><path d="M46 35h28" opacity=".3"/><path d="M56 35a10 14 0 0018 0 10 14 0 00-18 0" fill="currentColor" fill-opacity=".18" stroke="none"/><circle cx="60" cy="35" r="3" fill="currentColor" stroke="none"/></svg>'},
  {t:'Система продвижения — итог', pts:[
    '<b>Масса</b>: держи поток 10-15 роликов/день, дай алгоритму много попыток',
    '<b>Осмысленная активность</b>: живые комментарии, никаких «огонёчков»',
    '<b>Практика вместо мифов</b>: спорное — тестируй на своих цифрах',
    '<b>Умный трафик</b>: закуп вдолгую, объёмом, только в целевые каналы'],
   svg:'<svg viewBox="0 0 120 70" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><rect x="26" y="8" width="68" height="56" rx="8"/><path d="M36 20l4 4 7-8M36 36l4 4 7-8M36 52l4 4 7-8" stroke-width="2.8"/><path d="M54 21h28M54 37h28M54 53h20"/></svg>'},
  ],
  quiz:[
  {q:'Что по уроку сильнее всего «задавливает» алгоритмы?', o:['Один идеальный ролик','Масса — 10-15 роликов в день','Платная накрутка лайков','Красивый логотип'], a:1},
  {q:'Какая активность в чатах реально продвигает блог?', o:['Пустые «огонёчки»','Одинаковые эмодзи пачкой','Осмысленные комментарии и сохранения','Массовые репосты ботами'], a:2},
  {q:'Почему «огонёчки» вредят?', o:['Их не видит алгоритм','Это засорение, читается как спам','Они платные','Их мало'], a:1},
  {q:'Как правильно решать спорные вопросы об алгоритмах?', o:['Верить популярному блогеру','Тестировать на своих цифрах','Игнорировать статистику','Копировать конкурента'], a:1},
  {q:'Закуп трафика в Telegram — это…', o:['Разовая быстрая окупаемость','Игра вдолгую, окупается на объёме','Бесплатный способ','Только для крупных каналов'], a:1},
  {q:'В какие каналы стоит закупать рекламу?', o:['В самые большие любые','В целевые и смежные по аудитории','В случайные для охвата','Только к прямым конкурентам'], a:1},
  ],
  pairs:[
  ['Масса','10-15 роликов в день дают залёт'],
  ['Осмысленный комментарий','Живой сигнал, которому алгоритм доверяет'],
  ['Огонёчки','Засорение и накрутка, вредит охвату'],
  ['Практика','Спорное решается тестом на своих цифрах'],
  ['Смежный канал','Тёплая аудитория по пути клиента'],
  ],
  task:{
    intro:'Собери свой план продвижения на неделю по принципам урока — конкретными цифрами и действиями:',
    chips:['Сколько роликов/день','Чат активности (кто, что делаем)','Что тестирую','Каналы для закупа','Как замерю результат'],
    ph:'Пример: 12 Reels/день. Чат активности — 15 авторов из смежной ниши, развёрнутые комментарии первые 2 часа после выхода. Тестирую два хука на одинаковую тему. Закуп — 5 целевых каналов по 5-15к. Замер — досмотр и подписки за неделю.',
    verdict:'План рабочий: есть масса, живая активность и понятный замер. Совет куратора: заведи простую таблицу «ролик — досмотр — подписки» и раз в неделю усиливай форматы, которые зашли, а провалившиеся не переделывай, а меняй полностью.'
  }
}

];
/* ================= НАПРАВЛЕНИЯ → БЛОКИ → УРОКИ =================
   Масштаб (утв. Даниэлем): 3 направления, в каждом 5 блоков, в блоке ~9 уроков (~135).
   Существующие уроки — сиды блоков; остальное дозаполняется пачками (файл academy/OKO_ACADEMY_BLOCK_MAP.md).
   AC_PACK_* — массивы доп.уроков блока (наполняются волнами производства). */
const AC_PACK = (typeof window!=='undefined' && window.AC_PACK) ? window.AC_PACK : {};
function acPack(id){ return Array.isArray(AC_PACK[id]) ? AC_PACK[id] : []; }

/* блоки: сид-уроки (уже готовые объекты) + пак дозаполнения по id блока */
const AC_DIRS = [
  { id:'media', title:'Медийность', tag:'Направление · база', free:true, minTier:'PRO', price:0,
    author:'OKO · по методологии ХЛБ', c1:'МЕДИЙ', c2:'НОСТЬ',
    outcomes:[
      'Упаковать профиль так, что за 3 секунды ясно — кто ты и зачем',
      'Собрать визуал и ленту, которым доверяют (51% судят по картинке)',
      'Понимать типы контента и эмоций — и попадать в свою аудиторию',
      'Вести аккаунт как полигон уже сейчас, а не «когда-нибудь»'],
    blocks:[
      {id:'m1', title:'Мышление и старт',           seed:[MEDIA_LESSONS[0]]},
      {id:'m2', title:'Упаковка профиля',           seed:[MEDIA_LESSONS[1]]},
      {id:'m3', title:'Визуал и лента',             seed:[MEDIA_LESSONS[2], AC_COURSE_REELS[1]]},
      {id:'m4', title:'Контент и эмоции',           seed:[MEDIA_LESSONS2[0], AC_COURSE_REELS[0]]},
      {id:'m5', title:'Сторис, эфиры, характер',    seed:[MEDIA_LESSONS2[1], MEDIA_LESSONS2[2]]},
    ]},
  { id:'marketing', title:'Маркетинг', tag:'Направление · продажи', free:false, minTier:'PRO', price:2900,
    author:'OKO · по методологии ХЛБ', c1:'МАРКЕ', c2:'ТИНГ',
    outcomes:[
      'Писать тексты, которые читают и покупают',
      'Собирать продающий пост по структуре из 7 блоков',
      'Ловить внимание хуком и усиливать 8 триггерами',
      'Превращать подписчика в клиента текстом'],
    blocks:[
      {id:'k1', title:'Копирайтинг',                        seed:[MARKETING_LESSONS[0]]},
      {id:'k2', title:'Продающий пост и хуки',              seed:[MARKETING_LESSONS[1], MARKETING_LESSONS[2]]},
      {id:'k3', title:'Триггеры (психология покупки)',      seed:[]},
      {id:'k4', title:'Стратегия: конкуренты и монетизация',seed:[MARKETING_LESSONS2[0], MARKETING_LESSONS2[1]]},
      {id:'k5', title:'Продвижение, продажи, деньги',       seed:[MARKETING_LESSONS2[2], AC_COURSE_REELS[2]]},
    ]},
  { id:'ai', title:'Нейросети', tag:'Направление · практика', free:false, minTier:'PRO', price:2900,
    author:'Команда OKO', c1:'НЕЙРО', c2:'СЕТИ',
    outcomes:[
      'Выбирать нейросеть под задачу за секунды по карте 2026',
      'Собирать сильные промпты по формуле: роль, задача, контекст, формат',
      'Генерировать картинки и видео уровня продакшн — дёшево',
      'Запустить своего ИИ-агента для бизнеса в Telegram'],
    blocks:[
      {id:'a1', title:'Старт и промптинг',        seed:[AC_COURSE_AI[0], AC_COURSE_AI[1]]},
      {id:'a2', title:'Контент нейросетями',      seed:[AC_COURSE_AI[2], AC_COURSE_AI[3]]},
      {id:'a3', title:'Вайбкодинг',               seed:[]},
      {id:'a4', title:'Автоматизация',            seed:[]},
      {id:'a5', title:'Бизнес и деньги на ИИ',    seed:[AC_COURSE_AI[4]]},
    ]},
];

/* ---- вычисляем плоский AC_COURSE, метаданные курсов AC_COURSES и границы блоков AC_BLOCKS ---- */
const AC_COURSE = [];
const AC_COURSES = [];
const AC_BLOCKS = [];
AC_DIRS.forEach(d=>{
  const from = AC_COURSE.length;
  d.blocks.forEach(b=>{
    const lessons = (b.seed||[]).concat(acPack(b.id));
    const bf = AC_COURSE.length;
    lessons.forEach(L=>AC_COURSE.push(L));
    AC_BLOCKS.push({dir:d.id, id:b.id, title:b.title, from:bf, count:lessons.length});
  });
  const count = AC_COURSE.length - from;
  const nb = d.blocks.length;
  AC_COURSES.push({
    id:d.id, title:d.title, tag:d.tag, free:d.free, minTier:d.minTier, price:d.price,
    author:d.author, outcomes:d.outcomes, c1:d.c1, c2:d.c2, from, count,
    blocks:d.blocks.map(b=>b.id),
    sub:`${nb} ${acPlural(nb,['блок','блока','блоков'])} · ${count} ${acPlural(count,['урок','урока','уроков'])} · сертификат за направление`,
  });
});
/* блоки конкретного курса */
function acCourseBlocks(ci){ const id=AC_COURSES[ci].id; return AC_BLOCKS.filter(b=>b.dir===id); }
const AC_FEE = 0.10;   // комиссия платформы OKO с продажи курса (как в каналах)

/* индекс курса по глобальному номеру урока */
function acCourseOf(i){
  for(let c=0;c<AC_COURSES.length;c++){
    const m=AC_COURSES[c];
    if(i>=m.from && i<m.from+m.count) return c;
  }
  return 0;
}
function acLocalNo(i){ return i - AC_COURSES[acCourseOf(i)].from + 1; }        // номер урока внутри курса (с 1)
function acCourseLen(ci){ return AC_COURSES[ci].count; }
function acCourseFirst(ci){ return AC_COURSES[ci].from; }
function acCourseIdx(ci){ const m=AC_COURSES[ci], a=[]; for(let i=0;i<m.count;i++) a.push(m.from+i); return a; }
/* доступ к курсу: бесплатный / куплен / открыт подпиской */
function acOwnsCourse(ci){ try{ return !!(acS.owned && acS.owned[AC_COURSES[ci].id]); }catch(e){ return false; } }
function acCourseAccessible(ci){
  const m=AC_COURSES[ci];
  if(m.free) return true;
  if(acOwnsCourse(ci)) return true;
  return (typeof okoHasSub==='function') ? okoHasSub(m.minTier) : false;
}
function acCoursePctOf(ci){
  const idx=acCourseIdx(ci); if(!idx.length) return 0;
  let s=0; idx.forEach(i=>s+=acLessonPct(i));
  return Math.round(s/idx.length);
}
function acCourseDone(ci){ return acCourseIdx(ci).every(i=>acLessonDone(i)); }
function acCourseCertCount(ci){ return acDirCert(ci) ? 1 : 0; }

/* агрегаты по курсу: сколько всего слайдов, вопросов, игр, видео, минут */
function acCourseStats(ci){
  const idx = acCourseIdx(ci);
  let slides=0, quiz=0, games=0, vids=0, mins=0;
  idx.forEach(i=>{
    const L = AC_COURSE[i];
    slides += L.slides.length;
    quiz   += L.quiz.length;
    if(L.pairs && L.pairs.length) games++;
    if(L.videoUrl) vids++;
    const m = /^(\d+):(\d+)$/.exec(L.dur||'');
    if(m) mins += (+m[1]) + (+m[2])/60;
  });
  return {lessons:idx.length, slides, quiz, games, vids, mins:Math.max(1,Math.round(mins))};
}

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
/* бэкфилл «освоено»: уже стопроцентные уроки не празднуем задним числом (иначе вау-оверлей
   всплыл бы при повторном прохождении теста/игры на давно пройденном уроке) */
try{ Object.keys(acS.lessons).forEach(k=>{ const ls=acS.lessons[k]; if(ls && !ls.mastered && acItems(+k).every(x=>x[1])) ls.mastered=true; }); acSave(); }catch(e){}

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

let acView = 'home';            // 'home' (каталог) | 'course' (уроки курса) | 'lesson'
let acL = 0;                    // глобальный индекс текущего урока
let acCourse = 0;               // индекс текущего курса (для страницы курса)
let acQuiz = null;              // сессия теста (не персистится)
let acG = null;                 // сессия мини-игры
let acTaskChecking = false;     // «Проверяется ИИ-куратором»
let acCertUrl = null;           // кэш PNG сертификата
let acCertShownNo = null;
let acBadgeNewIds = [];         // бейджи, открытые в этом ре-рендере (для pop-анимации)

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
function acLessonDone(i){ return acLessonPct(i) === 100; }
function acUnlocked(i){
  const ci = acCourseOf(i);
  return acCourseAccessible(ci);   // уроки ПРОПУСКАЕМЫЕ — внутри доступного направления открыты все, без жёстких ограничений
}
/* Сертификат — ЗА ВСЁ НАПРАВЛЕНИЕ (не за урок). Один именной диплом на направление. */
function acDirCert(ci){ try{ const id=AC_COURSES[ci].id; return (acS.certs||[]).find(c=>c && c.dir===id) || null; }catch(e){ return null; } }
function acCertEligible(){ const ci=acCourseOf(acL); return acCourseDone(ci) && !acDirCert(ci); }

/* ================= ДОСТУП К ПРЕМИУМ-КУРСУ (подписка / покупка) ================= */
function acFmtPrice(n){ return (typeof fmtRub==='function') ? fmtRub(n) : (n.toLocaleString('ru-RU')+' ₽'); }
/* открыть курс: если доступен — на страницу курса, иначе гейт */
function acOpenCourse(ci){
  if(!acCourseAccessible(ci)){ acCourseGate(ci); return; }
  acCourse = ci; acView = 'course'; acQuiz = null; acG = null; acTaskChecking = false;
  acRender();
  const m = document.querySelector('main'); if(m) m.scrollTop = 0;
}
/* продающий гейт премиум-курса: подписка ИЛИ разовая покупка */
function acCourseGate(ci){
  const c = AC_COURSES[ci];
  if(acCourseAccessible(ci)){ acOpenCourse(ci); return; }
  if(typeof showPopup !== 'function'){ toast('Курс «'+c.title+'» доступен по подписке '+c.minTier); return; }
  const fee = Math.round(c.price*AC_FEE), net = c.price - fee;
  showPopup({ico:'star', title:'Курс «'+c.title+'»',
    body:'Премиум-курс Академии OKO: <b>'+c.count+' '+acPlural(c.count,['урок','урока','уроков'])+'</b>, тесты, практика и именной сертификат за всё направление. Доступ навсегда.<br><br>Входит в подписку <b style="color:var(--accent)">'+c.minTier+'</b> и выше — либо разовая покупка за <b style="color:var(--accent)">'+acFmtPrice(c.price)+'</b>.<br><span style="font-size:11.5px;color:var(--dim);line-height:1.5">Автор курса получает '+acFmtPrice(net)+', комиссия платформы OKO — 10% ('+acFmtPrice(fee)+').</span>',
    actions:[
      {label:'Открыть по подписке '+c.minTier, onclick:()=>{
        if(typeof okoRequireSub === 'function'){
          okoRequireSub(c.minTier, 'Курс «'+c.title+'» входит в подписку '+c.minTier+'. Оформи её — и получишь этот курс и десятки других возможностей.', ()=>acOpenCourse(ci));
        } else { toast('Подписка временно недоступна'); }
      }},
      {label:'Купить за '+acFmtPrice(c.price), onclick:()=>acBuyCourse(ci)},
      {label:'Позже', ghost:true}
    ]});
}
/* разовая покупка курса за баланс (комиссия — доход владельца) */
function acBuyCourse(ci){
  const c = AC_COURSES[ci];
  if(acCourseAccessible(ci)){ acOpenCourse(ci); return; }
  if(typeof walletCharge !== 'function'){ toast('Кошелёк недоступен'); return; }
  if(walletCharge(c.price, 'Академия · курс «'+c.title+'»')){
    acS.owned = acS.owned || {};
    acS.owned[c.id] = true; acSave();
    const fee = Math.round(c.price*AC_FEE), net = c.price - fee;
    if(typeof okoEarn === 'function') okoEarn(c.price, 'Академия · продажа курса «'+c.title+'»');
    acBadgeSync();
    if(typeof showPopup === 'function'){
      showPopup({ico:'check2', title:'Курс открыт',
        body:'Курс «'+esc(c.title)+'» теперь твой навсегда. Списано <b>'+acFmtPrice(c.price)+'</b>: автору начислено '+acFmtPrice(net)+', комиссия платформы OKO 10% — '+acFmtPrice(fee)+'.',
        actions:[{label:'Начать курс', onclick:()=>acOpenCourse(ci)}]});
    } else { toast('Курс открыт: «'+c.title+'»'); acOpenCourse(ci); }
  } else {
    toast('Недостаточно средств — пополни счёт');
  }
}

/* ================= БЕЙДЖИ ДОСТИЖЕНИЙ ================= */
function acAnyLessonTest100(){ for(const k in acS.lessons){ if((acS.lessons[k].testScore||0) >= 100) return true; } return false; }
function acTasksDone(){ let n=0; for(const k in acS.lessons){ if(acS.lessons[k].task) n++; } return n; }
function acBadgeDefs(){
  const st = acStreak();
  return [
    {id:'first',  ic:'bolt',     t:'Первый шаг',     d:'Пройти первый урок',                on: AC_COURSE.some((_,i)=>acLessonPct(i)>=100) || acS.certs.length>0},
    {id:'cert1',  ic:'star',     t:'Сертификат',     d:'Получить первый сертификат',        on: acS.certs.length >= 1},
    {id:'ace',    ic:'poll',     t:'Отличник',       d:'Сдать тест на 100%',                on: acAnyLessonTest100()},
    {id:'prac',   ic:'edit',     t:'Практик',        d:'Зачесть 3 практики',                on: acTasksDone() >= 3},
    {id:'streak3',ic:'fire',     t:'В огне',         d:'3 дня подряд в учёбе',              on: (st.best||0) >= 3},
    {id:'media',  ic:'rocket',   t:'Медийщик OKO',   d:'Завершить направление «Медийность»', on: acCourseDone(0)},
    {id:'invest', ic:'money',    t:'Инвестор в себя',d:'Открыть премиум-направление',       on: (typeof okoHasSub==='function'&&okoHasSub('PRO')) || (acS.owned && Object.keys(acS.owned).length>0)},
    {id:'mkt',    ic:'briefcase',t:'Маркетолог OKO', d:'Завершить направление «Маркетинг»',  on: AC_COURSES.length>1 && acCourseDone(1)},
    {id:'ai',     ic:'crown',    t:'Нейро-мастер OKO',d:'Завершить направление «Нейросети»', on: AC_COURSES.length>2 && acCourseDone(2)},
    {id:'coll',   ic:'verified', t:'Коллекционер',   d:'Собрать 5 сертификатов',            on: acS.certs.length >= 5},
  ];
}
/* при первом заходе — «засчитать» уже заслуженные молча, чтобы не спамить тостами */
function acBadgeSync(){
  const defs = acBadgeDefs();
  if(!Array.isArray(acS.badgeSeen)){
    acS.badgeSeen = defs.filter(b=>b.on).map(b=>b.id);
    acBadgeNewIds = []; acSave(); return;
  }
  const fresh = defs.filter(b=>b.on && acS.badgeSeen.indexOf(b.id) < 0);
  acBadgeNewIds = fresh.map(b=>b.id);
  if(fresh.length){
    fresh.forEach(b=>acS.badgeSeen.push(b.id));
    acSave();
    fresh.forEach((b,k)=>setTimeout(()=>toast('Награда открыта: «'+b.t+'»'), 260*(k+1)));
  }
}
function acBadgesGridHtml(){
  const defs = acBadgeDefs();
  const earned = defs.filter(b=>b.on).length;
  return `
    <div class="ac-badges-head">
      <span class="ico">${I('verified')}</span>
      <div class="meta"><b>Достижения</b><span>Открыто ${earned} из ${defs.length} — учись и собирай награды</span></div>
    </div>
    <div class="ac-badges">${defs.map((b,i)=>`
      <div class="ac-badge ${b.on?'on':''} ${acBadgeNewIds.indexOf(b.id)>=0?'new':''}" style="animation-delay:${(i*0.045).toFixed(2)}s" title="${b.d}">
        <span class="ic">${I(b.ic)}</span>
        <span class="t">${b.t}</span>
        <span class="d">${b.on?'получено':b.d}</span>
      </div>`).join('')}</div>`;
}

/* ================= РЕНДЕР ================= */
function acRender(){
  const root = document.getElementById('acRoot');
  if(!root) return;
  acBadgeSync();  // до построения HTML — чтобы pop-анимация новых наград попала в разметку
  root.innerHTML = acView === 'lesson' ? acLessonHtml() : acView === 'course' ? acCourseHtml() : acHomeHtml();
  root.classList.remove('fade-in'); void root.offsetWidth; root.classList.add('fade-in');
  if(acView === 'lesson'){
    acRenderVideoBox(); acBindSlides(); acRenderTestBox();
    acRenderTaskBox(); acRenderGameBox(); acRenderProgressBox(); acRenderCertBox();
  } else {
    acAnimRings();
  }
}
/* сведение колец прогресса из «пустого» в цель — эффектный sweep при входе */
function acAnimRings(){
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    document.querySelectorAll('#acRoot .ac-ring .val, #acRoot .ac-mini-ring .val').forEach(c=>{
      const off = c.getAttribute('data-off');
      if(off !== null) c.style.strokeDashoffset = off;
    });
  }));
}

/* обложка курса (inline-SVG, самодостаточная, тёмная арт-панель в обеих темах).
   hero=true → без крупного текста (его дублирует заголовок-капшн под обложкой). */
function acCourseCover(ci, hero){
  const c = AC_COURSES[ci];
  const bigText = hero ? '' : `
    <text x="26" y="118" font-family="'Bebas Neue',Impact,sans-serif" font-size="30" fill="#fff" letter-spacing="1">${esc(c.c1)}</text>
    <text x="26" y="152" font-family="'Bebas Neue',Impact,sans-serif" font-size="36" fill="#9AFF00" letter-spacing="2">${esc(c.c2)}</text>
    <text x="26" y="176" font-family="Montserrat,sans-serif" font-size="9" font-weight="600" fill="rgba(255,255,255,.5)" letter-spacing="3">АКАДЕМИЯ OKO</text>`;
  return `<svg class="ac-cover-svg" viewBox="0 0 320 190" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="320" height="190" fill="#070a04"/>
    <g stroke="rgba(154,255,0,.10)" stroke-width="1">
      ${[40,80,120,160,200,240,280].map(x=>`<line x1="${x}" y1="0" x2="${x}" y2="190"/>`).join('')}
      ${[38,76,114,152].map(y=>`<line x1="0" y1="${y}" x2="320" y2="${y}"/>`).join('')}
    </g>
    <circle cx="266" cy="44" r="70" fill="rgba(154,255,0,.09)"/>
    <use href="#i-logo" x="238" y="16" width="64" height="64"/>${bigText}
  </svg>`;
}

/* карточка курса в каталоге */
function acCourseCardHtml(ci){
  const c = AC_COURSES[ci];
  const acc = acCourseAccessible(ci);
  const pct = acCoursePctOf(ci);
  const done = acCourseDone(ci);
  const CR = 2*Math.PI*15;
  const badge = c.free
    ? `<span class="ac-cc-tag free">${I('bolt')} Бесплатно</span>`
    : acc
      ? `<span class="ac-cc-tag open">${I('check2')} Открыт</span>`
      : `<span class="ac-cc-tag lock">${I('lock')} ${c.minTier}</span>`;
  const ring = acc
    ? `<span class="ac-mini-ring lg" title="Курс пройден на ${pct}%">
        <svg viewBox="0 0 36 36"><circle class="bg" cx="18" cy="18" r="15"/>
        <circle class="val" cx="18" cy="18" r="15" stroke-dasharray="${CR.toFixed(1)}" stroke-dashoffset="${CR.toFixed(1)}" data-off="${(CR*(1-pct/100)).toFixed(1)}"/></svg>
        <b>${done?I('check2'):pct}</b></span>`
    : `<span class="ac-cc-price">${acFmtPrice(c.price)}</span>`;
  const cta = acc
    ? (done ? `Открыть курс` : (pct>0 ? `Продолжить · ${pct}%` : `Начать курс`))
    : `Открыть доступ`;
  return `
    <div class="card ac-cc ${acc?'':'locked'}" style="animation-delay:${(ci*0.06).toFixed(2)}s" onclick="acCourseCardClick(${ci})">
      <div class="ac-cc-cover">${acCourseCover(ci)}${acc?'':`<span class="ac-cc-veil">${I('lock')}</span>`}</div>
      <div class="ac-cc-body">
        <div class="ac-cc-top">${badge}<span class="ac-cc-meta">${c.count} ${acPlural(c.count,['урок','урока','уроков'])}</span></div>
        <h3>${esc(c.title)}</h3>
        <p>${esc(c.sub)}</p>
        <div class="ac-cc-foot">${ring}<button class="btn sm ${acc?'':'ghost'} ac-cc-go" onclick="event.stopPropagation();acCourseCardClick(${ci})">${cta}</button></div>
      </div>
    </div>`;
}
function acCourseCardClick(ci){ acOpenCourse(ci); }

/* ---------- ГЛАВНАЯ АКАДЕМИИ: КАТАЛОГ КУРСОВ ---------- */
function acHomeHtml(){
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
    ? `<button class="ac-next-row" onclick="acOpenLesson(${nx})">${I('circle-play')}<span>Продолжить: <b>урок ${acLocalNo(nx)} — ${esc(AC_COURSE[nx].title)}</b></span><svg class="i go"><use href="#i-chev"/></svg></button>`
    : `<div class="ac-next-row done">${I('check2')}<span>Доступные уроки пройдены — открой премиум-курс</span></div>`;
  const courses = AC_COURSES.map((_,ci)=>acCourseCardHtml(ci)).join('');
  const certs = acS.certs.length ? acS.certs.map((c,i)=>`
    <div class="ac-cert-item" style="animation-delay:${i*.05}s">
      <span class="ico"><svg class="i"><use href="#i-file"/></svg></span>
      <span class="meta"><span class="t">${esc(acCertLabel(c))}</span><span class="s" style="display:block">${esc(c.no)} · ${esc(c.date)} · тест ${c.score}%</span></span>
      <button class="btn sm ghost ac-ico-btn" onclick="acCertShare(${i})" title="Поделиться" aria-label="Поделиться">${I('share')}</button>
      <button class="btn sm ghost" onclick="acCertShow(${i})">Показать</button>
    </div>`).join('')
    : `<p class="dim" style="font-size:12.5px;line-height:1.55">Пройди направление целиком — получи официальный сертификат OKO с печатью и подписью. Он появится здесь.</p>`;
  return `
    <div class="ac-hero"><h2>Академия OKO</h2><p>Курсы полного формата · официальные сертификаты</p></div>
    ${streak}
    ${nextRow}
    <h2 class="section-h" style="margin:20px 0 10px;font-size:21px">Каталог курсов</h2>
    <div class="ac-catalog">${courses}</div>

    <h2 class="section-h" style="margin:24px 0 10px;font-size:21px">Достижения</h2>
    <div class="card ac-badges-card">${acBadgesGridHtml()}</div>

    <h2 class="section-h" style="margin:24px 0 10px;font-size:21px">Мои сертификаты</h2>
    <div class="card" style="padding:6px 14px">${certs}</div>
    <div style="height:14px"></div>`;
}

/* подпись сертификата: «Курс · Урок N · Название» */
function acCertLabel(c){
  return 'Направление «' + (c.courseTitle || 'Академия OKO') + '» · сертификат';
}

/* ---------- «ЧТО ВНУТРИ КУРСА»: состав + чему научишься ---------- */
function acCourseInsideHtml(ci){
  const c = AC_COURSES[ci], st = acCourseStats(ci);
  const feats = [
    ['circle-play', (st.vids || st.lessons) + ' видео-' + acPlural(st.vids||st.lessons,['урок','урока','уроков']), st.mins>1 ? '~'+st.mins+' мин · озвучка' : 'озвучка + караоке'],
    ['file',  st.slides + ' ' + acPlural(st.slides,['слайд','слайда','слайдов']), 'наглядно и по делу'],
    ['poll',  'Тесты · ' + st.quiz + ' ' + acPlural(st.quiz,['вопрос','вопроса','вопросов']), 'порог зачёта ' + AC_PASS + '%'],
    ['edit',  'Практика', 'проверка ИИ-куратором'],
    ['bolt',  st.games + ' мини-' + acPlural(st.games,['игра','игры','игр']), 'закрепление на связках'],
    ['star',  'Сертификат', 'именной — за всё направление'],
  ];
  const outcomes = (c.outcomes||[]).map(o=>`<li>${I('check2')}<span>${esc(o)}</span></li>`).join('');
  return `
  <div class="card ac-inside" id="acWhatsIn">
    <div class="ac-inside-head">
      <span class="ico">${I('bolt')}</span>
      <div class="meta"><b>Что внутри курса</b><span>${c.author?('Автор — '+esc(c.author)+' · '):''}${st.lessons} ${acPlural(st.lessons,['урок','урока','уроков'])} полного формата</span></div>
    </div>
    <div class="ac-inside-grid">${feats.map(f=>`
      <div class="ac-inside-cell"><span class="ic">${I(f[0])}</span><b>${f[1]}</b><span>${f[2]}</span></div>`).join('')}</div>
    ${outcomes?`<div class="ac-inside-out"><div class="h">${I('flag')} Чему научишься</div><ul>${outcomes}</ul></div>`:''}
  </div>`;
}

/* ---------- СТРАНИЦА КУРСА (список уроков) ---------- */
function acCourseHtml(){
  const ci = acCourse, c = AC_COURSES[ci];
  const pct = acCoursePctOf(ci), C = 2*Math.PI*33, CR = 2*Math.PI*15;
  const idx = acCourseIdx(ci);
  const done = acCourseDone(ci);
  /* строка урока (номер — сквозной внутри направления) */
  const lessonRow = (i,k)=>{
    const local = acLocalNo(i);
    if(!acUnlocked(i)) return `<button class="ac-lesson-row locked ac-rise" style="animation-delay:${(k*0.04).toFixed(2)}s" onclick="acCourseGate(${ci})">
      <span class="ac-num">${local}</span>
      <span class="meta"><span class="t">${esc(AC_COURSE[i].title)}</span><span class="s" style="display:block">${esc(AC_COURSE[i].sub)}</span></span>
      <svg class="i"><use href="#i-lock"/></svg></button>`;
    const p = acLessonPct(i);
    const stg = (p > 0 ? `<span class="ac-mini-ring" title="Урок пройден на ${p}%">
          <svg viewBox="0 0 36 36"><circle class="bg" cx="18" cy="18" r="15"/>
          <circle class="val" cx="18" cy="18" r="15" stroke-dasharray="${CR.toFixed(1)}" stroke-dashoffset="${CR.toFixed(1)}" data-off="${(CR*(1-p/100)).toFixed(1)}"/></svg>
          <b>${p}</b></span>` : '');
    return `<button class="ac-lesson-row ac-rise" style="animation-delay:${(k*0.04).toFixed(2)}s" onclick="acOpenLesson(${i})">
      <span class="ac-num">${local}</span>
      <span class="meta"><span class="t">${esc(AC_COURSE[i].title)}</span><span class="s" style="display:block">${esc(AC_COURSE[i].sub)}</span></span>
      ${stg}
      <svg class="i go"><use href="#i-chev"/></svg></button>`;
  };
  /* группировка по блокам направления */
  const blocks = acCourseBlocks(ci);
  let rk = 0;
  const rows = blocks.map((b, bi)=>{
    const bIdx = []; for(let i=b.from;i<b.from+b.count;i++) bIdx.push(i);
    const bDone = b.count>0 && bIdx.every(i=>acLessonDone(i));
    const bPct = b.count>0 ? Math.round(bIdx.reduce((s,i)=>s+acLessonPct(i),0)/b.count) : 0;
    const head = `<div class="ac-block-head${bDone?' done':''}">
        <span class="ac-block-n">Блок ${bi+1}</span>
        <span class="ac-block-t">${esc(b.title)}</span>
        <span class="ac-block-meta">${b.count>0 ? (b.count+' '+acPlural(b.count,['урок','урока','уроков'])+(bPct>0?' · '+bPct+'%':'')) : 'готовится'}</span>
        ${bDone?`<span class="ac-block-done">${I('check2')}</span>`:''}
      </div>`;
    const body = b.count>0
      ? bIdx.map(i=>lessonRow(i, rk++)).join('')
      : `<div class="ac-block-soon">${I('clock')}<span>Уроки блока в производстве — скоро откроются</span></div>`;
    return `<div class="ac-block">${head}${body}</div>`;
  }).join('');
  let nx = idx.find(i=>acUnlocked(i) && !acLessonDone(i));
  if(nx===undefined && !done) nx = idx[0];   // защита: если курс не пройден, всегда есть куда вести
  const nextRow = (nx!==undefined)
    ? `<button class="ac-next-row" onclick="acOpenLesson(${nx})">${I('circle-play')}<span>${acLessonPct(nx)>0?'Продолжить':'Начать'}: <b>урок ${acLocalNo(nx)} — ${esc(AC_COURSE[nx].title)}</b></span><svg class="i go"><use href="#i-chev"/></svg></button>`
    : `<div class="ac-next-row done">${I('check2')}<span>Направление пройдено — именной сертификат у тебя</span></div>`;
  const certN = acCourseCertCount(ci);
  const finale = done
    ? `<div class="card ac-course-finale"><span class="ico">${I('crown')}</span>
        <div><h3>Курс завершён</h3><p>Ты прошёл все ${c.count} ${acPlural(c.count,['урок','урока','уроков'])} и получил ${certN} ${acPlural(certN,['сертификат','сертификата','сертификатов'])}. Так держать!</p></div></div>`
    : '';
  return `
    <button class="btn ghost sm ac-back" onclick="acBackHome()"><svg class="i"><use href="#i-back"/></svg> Каталог</button>
    <div class="ac-course-hero">
      <div class="ac-course-hero-cover">${acCourseCover(ci, true)}</div>
      <div class="ac-course-hero-cap">
        <span class="chip">${c.free?'Базовый курс':'Премиум · открыт'}</span>
        <h2>${esc(c.title)}</h2>
        <p>${esc(c.sub)}</p>
      </div>
    </div>
    ${acCourseInsideHtml(ci)}
    <div class="card">
      <div class="ac-course-top">
        <span class="ac-ring">
          <svg viewBox="0 0 80 80"><circle class="bg" cx="40" cy="40" r="33"/>
          <circle class="val" cx="40" cy="40" r="33" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}" data-off="${(C*(1-pct/100)).toFixed(1)}"/></svg>
          <b>${pct}%</b>
        </span>
        <div><h3>Прогресс курса</h3><p class="dim">${c.count} ${acPlural(c.count,['урок','урока','уроков'])} · ${certN} ${acPlural(certN,['сертификат','сертификата','сертификатов'])} получено</p></div>
      </div>
      ${nextRow}
      <div>${rows}</div>
    </div>
    ${finale}
    <div style="height:16px"></div>`;
}

/* ---------- СТРАНИЦА УРОКА ---------- */
function acOpenLesson(i){
  const k = (typeof i === 'number') ? i : 0;
  const ci = acCourseOf(k);
  if(!acCourseAccessible(ci)){ acCourseGate(ci); return; }
  if(!acUnlocked(k)){ toast('Урок '+acLocalNo(k)+' откроется после предыдущего'); return; }
  acL = k; acCourse = ci;
  acView = 'lesson'; acQuiz = null; acG = null; acTaskChecking = false;
  acRender();
  const m = document.querySelector('main'); if(m) m.scrollTop = 0;
}
/* назад: из урока → на страницу курса, со страницы курса → в каталог */
function acBackHome(){
  if(acView === 'lesson'){ acView = 'course'; acCourse = acCourseOf(acL); }
  else acView = 'home';
  acRender();
  const m = document.querySelector('main'); if(m) m.scrollTop = 0;
}

function acLessonHtml(){
  const L = acCur();
  const ci = acCourseOf(acL);
  const durLabel = L.videoUrl ? `${L.dur} видео` : 'видео в производстве';
  return `
    <button class="btn ghost sm ac-back" onclick="acBackHome()"><svg class="i"><use href="#i-back"/></svg> ${esc(AC_COURSES[ci].title)}</button>
    <div class="ac-lesson-head">
      <span class="chip">Урок ${acLocalNo(acL)} из ${AC_COURSES[ci].count}</span>
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

    ${acToolsHtml(L)}

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
/* Бренд-обложка урока (SVG) — общий макет постера и заглушки «скоро» */
function acVpCover(L){
  return `
      <svg class="ac-cover" viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="acPosterScrim" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#04060a" stop-opacity="0"/>
            <stop offset=".5" stop-color="#04060a" stop-opacity="0"/>
            <stop offset="1" stop-color="#000" stop-opacity=".84"/>
          </linearGradient>
        </defs>
        <rect width="640" height="360" fill="#070a04"/>
        <g stroke="rgba(154,255,0,.09)" stroke-width="1">
          ${[80,160,240,320,400,480,560].map(x=>`<line x1="${x}" y1="0" x2="${x}" y2="360"/>`).join('')}
          ${[72,144,216,288].map(y=>`<line x1="0" y1="${y}" x2="640" y2="${y}"/>`).join('')}
        </g>
        <circle cx="530" cy="80" r="120" fill="rgba(154,255,0,.07)"/>
        <use href="#i-logo" x="472" y="34" width="120" height="120"/>
        <!-- нижний скрим: держит центр постера чистым под кнопку play, а заголовок внизу — читаемым в обеих темах -->
        <rect x="0" y="150" width="640" height="210" fill="url(#acPosterScrim)"/>
        <!-- заголовок вынесен в НИЖНЮЮ треть постера: не пересекается с центральной кнопкой play (она в чистом поле выше) -->
        <text x="48" y="272" font-family="'Bebas Neue',Impact,sans-serif" font-weight="700" font-size="44" fill="#fff" letter-spacing="1">${L.c1}</text>
        <text x="48" y="320" font-family="'Bebas Neue',Impact,sans-serif" font-weight="700" font-size="52" fill="#9AFF00" letter-spacing="4">${L.c2}</text>
        <text x="48" y="346" font-family="Montserrat,sans-serif" font-size="14" font-weight="600" fill="rgba(255,255,255,.6)" letter-spacing="3">АКАДЕМИЯ OKO · УРОК ${acLocalNo(acL)}</text>
      </svg>`;
}
function acRenderVideoBox(){
  const box = document.getElementById('acVideoBox');
  if(!box) return;
  const L = acCur(), ls = acLS();
  // Заглушка «видео в производстве» (у урока пока нет ролика)
  const cover = `
    <div class="ac-player" onclick="acPlay()" id="acPlayer">
      ${acVpCover(L)}
      <div class="ac-play-btn"><svg class="i"><use href="#i-play"/></svg></div>
      <span class="dur">${L.dur || 'скоро'}</span>
    </div>`;
  // Кастомный бренд-плеер (без нативного <video controls>) — свой чёрно-лаймовый хром
  const player = L.videoUrl ? `
    <div class="ac-player ac-vp" id="acPlayer">
      <video class="ac-vp-video" id="acVpVideo" playsinline webkit-playsinline preload="metadata" controlsList="nodownload noremoteplayback noplaybackrate" disablePictureInPicture disableRemotePlayback oncontextmenu="return false" src="${L.videoUrl}" onclick="acVpTapArea(event)"></video>
      <div class="ac-vp-poster" id="acVpPoster" onclick="acVpBig(event)">
        ${acVpCover(L)}
        <button class="ac-vp-big" type="button" onclick="acVpBig(event)" aria-label="Смотреть урок">${I('play')}</button>
        <span class="dur">${L.dur || 'видео'}</span>
      </div>
      <button class="ac-vp-center" id="acVpCenter" type="button" onclick="acVpToggle(event)" aria-label="Пауза/пуск">${I('pause')}</button>
      <div class="ac-vp-bar" id="acVpBar" onclick="acVpBarStop(event)">
        <button class="ac-vp-btn" id="acVpPlay" type="button" onclick="acVpToggle(event)" aria-label="Пауза/пуск">${I('play')}</button>
        <div class="ac-vp-scrub" id="acVpScrub" onclick="acVpSeek(event)" role="slider" aria-label="Перемотка"><span class="trk"><i class="ac-vp-fill" id="acVpFill"></i></span></div>
        <span class="ac-vp-time" id="acVpTime">0:00 / ${L.dur || '0:00'}</span>
        <button class="ac-vp-btn" id="acVpMute" type="button" onclick="acVpMute(event)" aria-label="Звук">${I('megaphone')}</button>
        <button class="ac-vp-btn" type="button" onclick="acVpFull(event)" aria-label="На весь экран">${I('device')}</button>
      </div>
    </div>` : cover;
  box.innerHTML = player + `
    <div class="ac-video-actions">${ls.video
      ? `<span class="ac-done-chip">${I('check2')} Видео просмотрено</span>`
      : `<button class="btn" onclick="acMarkVideo()">${I('check2')} Отметить просмотренным</button>`}
    </div>`;
  if(L.videoUrl) acVpInit();
}
function acPlay(){
  if(acCur().videoUrl) return;
  showPopup({ico:'circle-play', title:'Видео урока в производстве',
    body:'Ролик урока «'+acCur().title+'» сейчас монтируется: озвучка, анимации и караоке-субтитры по стандарту Академии. Совсем скоро он появится прямо здесь. Пока изучи слайды ниже — в них весь материал урока.',
    actions:[{label:'Понятно'}]});
}

/* ---------- бренд-плеер: кастомный хром (без нативных controls) ---------- */
let acVpTimer = null;                       // таймер авто-скрытия панели
function acVpEl(){ return document.getElementById('acPlayer'); }
function acVpVid(){ return document.getElementById('acVpVideo'); }
function acVpFmt(s){                          // секунды -> m:ss
  if(!isFinite(s) || s < 0) s = 0;
  const m = Math.floor(s/60), z = Math.floor(s%60);
  return m + ':' + (z<10?'0':'') + z;
}
/* Привязка событий к видео после рендера. Всё в try/catch — оффлайн-источник не должен ломать хром */
function acVpInit(){
  try{
    const v = acVpVid(), p = acVpEl();
    if(!v || !p) return;
    v.addEventListener('loadedmetadata', acVpSync);
    v.addEventListener('durationchange', acVpSync);
    v.addEventListener('timeupdate', acVpSync);           // дёшево (~4/сек), без перерасчёта layout
    v.addEventListener('play',  ()=>{ p.classList.add('started','playing'); acVpSyncIcons(); acVpShow(false); });
    v.addEventListener('pause', ()=>{ p.classList.remove('playing'); acVpSyncIcons(); acVpShow(true); });
    v.addEventListener('ended', ()=>{ p.classList.remove('playing','started'); acVpSyncIcons(); acVpShow(true); });
    v.addEventListener('error', ()=>{ p.classList.remove('started','playing'); }); // источник не доступен — постер остаётся
    acVpSyncIcons();
  }catch(_){}
}
/* Показать панель управления; при проигрывании прячем сама через пару секунд */
function acVpShow(sticky){
  const p = acVpEl(); if(!p) return;
  p.classList.add('controls-on');
  clearTimeout(acVpTimer);
  if(!sticky && p.classList.contains('playing')){
    acVpTimer = setTimeout(()=>{ const q=acVpEl(); if(q) q.classList.remove('controls-on'); }, 2500);
  }
}
function acVpHide(){ const p=acVpEl(); if(p) p.classList.remove('controls-on'); clearTimeout(acVpTimer); }
/* Тап по области видео во время проигрывания — показать/скрыть управление */
function acVpTapArea(e){
  if(e) e.stopPropagation();
  const p = acVpEl(); if(!p || !p.classList.contains('started')) return;
  if(p.classList.contains('controls-on')) acVpHide(); else acVpShow(false);
}
function acVpBarStop(e){ if(e) e.stopPropagation(); acVpShow(false); } // клики по панели не сворачивают её
/* Большая лаймовая кнопка на постере — старт */
function acVpBig(e){
  if(e) e.stopPropagation();
  const v = acVpVid(); if(!v) return;
  try{ const pr = v.play(); if(pr && pr.catch) pr.catch(()=>{}); }catch(_){} // оффлайн: play отклонится — постер остаётся
}
/* Пуск/пауза (центр + нижняя панель) */
function acVpToggle(e){
  if(e) e.stopPropagation();
  const v = acVpVid(); if(!v) return;
  try{
    if(v.paused){ const pr = v.play(); if(pr && pr.catch) pr.catch(()=>{}); }
    else v.pause();
  }catch(_){}
  acVpShow(false);
}
/* Перемотка по клику на слим-скраббер */
function acVpSeek(e){
  if(e) e.stopPropagation();
  const v = acVpVid(), s = document.getElementById('acVpScrub');
  if(!v || !s) return;
  try{
    const r = s.getBoundingClientRect();
    const x = (e.clientX != null) ? e.clientX : (e.touches && e.touches[0] ? e.touches[0].clientX : r.left);
    let p = (x - r.left) / r.width; p = Math.max(0, Math.min(1, p));
    if(isFinite(v.duration) && v.duration > 0){ v.currentTime = p * v.duration; acVpSync(); }
  }catch(_){}
  acVpShow(false);
}
/* Тумблер звука */
function acVpMute(e){
  if(e) e.stopPropagation();
  const v = acVpVid(), b = document.getElementById('acVpMute');
  if(!v) return;
  try{ v.muted = !v.muted; if(b) b.classList.toggle('off', v.muted); }catch(_){}
  acVpShow(false);
}
/* На весь экран (fullscreen контейнера, iOS — самого видео) */
function acVpFull(e){
  if(e) e.stopPropagation();
  const p = acVpEl(), v = acVpVid();
  try{
    if(document.fullscreenElement){ if(document.exitFullscreen) document.exitFullscreen(); return; }
    if(p && p.requestFullscreen) p.requestFullscreen();
    else if(p && p.webkitRequestFullscreen) p.webkitRequestFullscreen();
    else if(v && v.webkitEnterFullscreen) v.webkitEnterFullscreen();
  }catch(_){}
  acVpShow(false);
}
/* Обновление скраббера и таймкода (transform:scaleX — без layout-thrash) */
function acVpSync(){
  const v = acVpVid(); if(!v) return;
  const fill = document.getElementById('acVpFill'), t = document.getElementById('acVpTime');
  const dur = (isFinite(v.duration) && v.duration > 0) ? v.duration : 0;
  const p = dur ? Math.max(0, Math.min(1, v.currentTime / dur)) : 0;
  if(fill) fill.style.transform = 'scaleX(' + p.toFixed(4) + ')';
  if(t){ let d; try{ d = acCur().dur; }catch(_){ d = ''; } t.textContent = acVpFmt(v.currentTime) + ' / ' + (dur ? acVpFmt(dur) : (d || '0:00')); }
}
/* Синхронизация иконок play/pause по состоянию видео */
function acVpSyncIcons(){
  const v = acVpVid(); if(!v) return;
  const ico = v.paused ? I('play') : I('pause');
  const b = document.getElementById('acVpPlay'), c = document.getElementById('acVpCenter');
  if(b) b.innerHTML = ico;
  if(c) c.innerHTML = ico;
}
function acMarkVideo(){
  acLS().video = true; acSave();
  toast('Видео засчитано · +20% к уроку');
  acRenderVideoBox(); acRenderProgressBox(); acRenderCertBox(); acAfterCheckpoint();
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
    acRenderProgressBox(); acRenderCertBox(); acAfterCheckpoint();
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
    const misses = acQuiz.misses || [];
    const review = misses.length
      ? `<div class="ac-review">
          <div class="ac-review-h">${I('poll')} Разбор ошибок · ${misses.length} ${acPlural(misses.length,['вопрос','вопроса','вопросов'])}</div>
          ${misses.map(m=>{ const qq=quiz[m.q]; return `
            <div class="ac-review-item">
              <div class="rq"><span class="rn">${m.q+1}</span><span>${qq.q}</span></div>
              <div class="ra bad"><span class="lb">${'АБВГ'[m.chosen]}</span><span>${qq.o[m.chosen]}</span></div>
              <div class="ra ok"><span class="lb">${'АБВГ'[qq.a]}</span><span>${qq.o[qq.a]}</span></div>
            </div>`; }).join('')}
        </div>`
      : `<div class="ac-review perfect">${I('star')} Идеально — ни одной ошибки${acQuiz.best>=3?` · лучшая серия ×${acQuiz.best}`:''}</div>`;
    box.innerHTML = `
      <div class="ac-score" id="acScoreNum" ${pass?'':'style="color:var(--danger);text-shadow:none"'}>0%</div>
      <div class="ac-score-sub">${pass
        ? `Порог ${AC_PASS}% пройден — <b>тест зачтён</b>. Верных ответов: ${acQuiz.hits} из ${quiz.length}.`
        : `<span class="fail">Не хватило до порога ${AC_PASS}%.</span> Верных: ${acQuiz.hits} из ${quiz.length}. Пролистай слайды и попробуй снова.`}</div>
      <button class="btn ${pass?'ghost':''}" onclick="acQuizStart()">Пройти заново</button>
      ${review}`;
    const el = document.getElementById('acScoreNum');
    acCountUp(el, score, '%');
    return;
  }
  const q = quiz[acQuiz.i];
  box.innerHTML = `
    <div class="ac-quiz-top"><span>Вопрос <b>${acQuiz.i+1}</b> из ${quiz.length}</span><span>${acQuiz.combo>=2?`<span class="ac-combo-live">${I('fire')} ×${acQuiz.combo}</span> · `:''}верных: <b>${acQuiz.hits}</b></span></div>
    <div class="progress" style="margin:0 0 4px"><i style="width:${(acQuiz.i/quiz.length*100)}%"></i></div>
    <div class="ac-q">${q.q}</div>
    ${q.o.map((o,i)=>`<button class="ac-opt" id="acOpt${i}" onclick="acAnswer(${i})"><span class="lb">${'АБВГ'[i]}</span><span>${o}</span></button>`).join('')}`;
}
function acQuizStart(){
  acQuiz = {i:0, hits:0, lock:false, done:false, score:0, misses:[], combo:0, best:0};
  acRenderTestBox();
}
/* всплывающий индикатор серии верных ответов (гейм-фидбек, не мешает потоку теста) */
function acComboPop(n){
  try{
    const box = document.getElementById('acTestBox'); if(!box) return;
    const el = document.createElement('div'); el.className = 'ac-combo-pop';
    el.innerHTML = I('fire') + '<span>серия ×' + n + '</span>';
    box.appendChild(el);
    requestAnimationFrame(()=>el.classList.add('go'));
    setTimeout(()=>{ try{ el.remove(); }catch(e){} }, 900);
  }catch(e){}
}
function acAnswer(i){
  if(!acQuiz || acQuiz.lock || acQuiz.done) return;
  acQuiz.lock = true;
  const quiz = acCur().quiz;
  const q = quiz[acQuiz.i];
  const right = i === q.a;
  if(right){ acQuiz.hits++; acQuiz.combo++; if(acQuiz.combo > acQuiz.best) acQuiz.best = acQuiz.combo; }
  else { acQuiz.combo = 0; acQuiz.misses.push({q:acQuiz.i, chosen:i}); }
  const ok = document.getElementById('acOpt'+q.a);
  if(ok) ok.classList.add('ok');
  if(!right){ const bad = document.getElementById('acOpt'+i); if(bad) bad.classList.add('bad'); }
  if(right && acQuiz.combo >= 3) acComboPop(acQuiz.combo);
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
      acRenderProgressBox(); acRenderCertBox(); acBadgeSync(); acAfterCheckpoint();
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
    acRenderTaskBox(); acRenderProgressBox(); acRenderCertBox(); acBadgeSync(); acAfterCheckpoint();
  }, 4000);
}

/* ---------- д) МИНИ-ИГРА ---------- */
function acShuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
/* Тип мини-игры на урок (анти-повтор: чередуется по индексу урока).
   Движки берут данные из уже готового контента урока (pairs / slides). */
const AC_GAMES = ['pairs','order','truefalse'];
function acGameType(){
  const L = acCur();
  let t = AC_GAMES[acL % AC_GAMES.length];
  if(t==='order' && (!L.slides || L.slides.length < 3)) t = 'pairs';
  if(t==='truefalse' && (!L.quiz || L.quiz.length < 3)) t = (L.slides && L.slides.length>=3) ? 'order' : 'pairs';
  if(t==='pairs' && (!L.pairs || !L.pairs.length)) t = (L.slides && L.slides.length>=3) ? 'order' : (L.quiz&&L.quiz.length>=3?'truefalse':'pairs');
  return t;
}
function acGameFinish(wrong){
  const ls = acLS(); ls.gameWrong = wrong;
  if(!ls.game){ ls.game = true; toast('Мини-игра пройдена · +20% к уроку'); }
  acG = null; acSave();
  acRenderGameBox(); acRenderProgressBox(); acRenderCertBox(); acBadgeSync(); acAfterCheckpoint();
}
function acRenderGameBox(){
  const box = document.getElementById('acGameBox');
  if(!box) return;
  const t = acGameType(), ls = acLS();
  if(!acG){
    if(ls.game){
      const label = t==='order' ? 'Порядок шагов восстановлен' : t==='truefalse' ? 'Все утверждения разобраны' : 'Все пары собраны';
      box.innerHTML = `<div class="ac-game-done"><div class="big">${I('check2')}</div>
         <p>${label}${ls.gameWrong!==null&&ls.gameWrong!==undefined?` · ошибок: ${ls.gameWrong}`:''}. Материал урока — в связке.</p>
         <button class="btn ghost" onclick="acGameStart()">Сыграть ещё раз</button></div>`;
    } else {
      const intro = t==='order'
        ? '<b>Расставь шаги по порядку.</b> Тапай карточки в правильной последовательности урока — верный шаг встаёт на место, неверный трясётся.'
        : t==='truefalse'
        ? '<b>Правда или ложь.</b> Для каждого утверждения реши, верный это ответ или нет. Ошибся — покажем, как на самом деле.'
        : '<b>Сопоставь пары.</b> Тапни элемент слева, затем его пару справа. Верная пара улетает, неверная — трясётся.';
      box.innerHTML = `<p style="font-size:13.5px;line-height:1.55">${intro}</p><div style="height:12px"></div>
         <button class="btn" onclick="acGameStart()">${I('play')} Играть</button>`;
    }
    return;
  }
  if(acG.type === 'order') return acRenderOrder(box);
  if(acG.type === 'truefalse') return acRenderTF(box);
  return acRenderPairs(box);
}
function acRenderPairs(box){
  const pairs = acCur().pairs;
  const left = acG.left.map(i=>`<button class="ac-tile ${acG.sel===i?'sel':''}" id="acGL${i}" onclick="acGPick(${i})">${pairs[i][0]}</button>`).join('');
  const right = acG.right.map(i=>`<button class="ac-tile" id="acGR${i}" onclick="acGMatch(${i})">${pairs[i][1]}</button>`).join('');
  box.innerHTML = `
    <div class="ac-game-score"><span>Собрано пар: <b>${acG.hits} / ${pairs.length}</b></span><span>ошибок: <b>${acG.wrong}</b></span></div>
    <div class="ac-game-cols">
      <div class="ac-game-col"><div class="h">Понятие</div>${left}</div>
      <div class="ac-game-col"><div class="h">Пара</div>${right}</div>
    </div>`;
}
function acRenderOrder(box){
  const S = acCur().slides;
  let placed = '';
  for(let k=0;k<acG.next;k++) placed += `<div class="ac-ord-step done"><span class="n">${k+1}</span><span>${esc(S[k].t)}</span></div>`;
  if(acG.next < S.length) placed += `<div class="ac-ord-step now"><span class="n">${acG.next+1}</span><span class="dim">Выбери следующий шаг…</span></div>`;
  const pool = acG.pool.filter(i=>i>=acG.next)
    .map(i=>`<button class="ac-ord-tile" id="acOrd${i}" onclick="acOrderPick(${i})">${esc(S[i].t)}</button>`).join('');
  box.innerHTML = `
    <div class="ac-game-score"><span>Шаг: <b>${acG.next} / ${S.length}</b></span><span>ошибок: <b>${acG.wrong}</b></span></div>
    <div class="ac-ord-seq">${placed}</div>
    <div class="ac-ord-pool">${pool}</div>`;
}
function acOrderPick(i){
  if(!acG || acG.lock) return;
  const S = acCur().slides;
  if(i === acG.next){
    acG.next++;
    if(acG.next >= S.length){ acGameFinish(acG.wrong); return; }
    acRenderOrder(document.getElementById('acGameBox'));
  } else {
    acG.wrong++;
    const el = document.getElementById('acOrd'+i);
    if(el){ el.classList.add('shake'); acG.lock = true; setTimeout(()=>{ el.classList.remove('shake'); acG.lock=false; acRenderOrder(document.getElementById('acGameBox')); }, 420); }
    else acRenderOrder(document.getElementById('acGameBox'));
  }
}
function acGameStart(){
  const t = acGameType();
  if(t === 'order'){
    const idx = acCur().slides.map((_,i)=>i);
    acG = {type:'order', pool:acShuffle(idx), next:0, wrong:0, lock:false};
  } else if(t === 'truefalse'){
    const q = acCur().quiz;
    const items = q.map(it=>{
      const showTrue = Math.random() < 0.5;
      if(showTrue) return {text:it.q, opt:it.o[it.a], isTrue:true};
      const wrongs = it.o.map((o,k)=>k).filter(k=>k!==it.a);
      const wk = wrongs[Math.floor(Math.random()*wrongs.length)];
      return {text:it.q, opt:it.o[wk], isTrue:false};
    });
    const order = acShuffle(items.map((_,i)=>i));
    acG = {type:'truefalse', items:order.map(i=>items[i]), cur:0, wrong:0, lock:false};
  } else {
    const idx = acCur().pairs.map((_,i)=>i);
    acG = {type:'pairs', left:idx.slice(), right:acShuffle(idx), sel:null, hits:0, wrong:0, lock:false};
  }
  acRenderGameBox();
}
function acRenderTF(box){
  const it = acG.items[acG.cur];
  if(!it){ acGameFinish(acG.wrong); return; }
  box.innerHTML = `
    <div class="ac-game-score"><span>Утверждение: <b>${acG.cur+1} / ${acG.items.length}</b></span><span>ошибок: <b>${acG.wrong}</b></span></div>
    <div class="ac-tf-card" id="acTFCard">
      <div class="q">${esc(it.text)}</div>
      <div class="opt">${esc(it.opt)}</div>
      <div class="ask">Это верный ответ?</div>
    </div>
    <div class="ac-tf-btns">
      <button class="ac-tf-btn no" onclick="acTFAnswer(false)">Ложь</button>
      <button class="ac-tf-btn yes" onclick="acTFAnswer(true)">Правда</button>
    </div>`;
}
function acTFAnswer(ans){
  if(!acG || acG.lock) return;
  const it = acG.items[acG.cur];
  const nextCard = ()=>{ acG.cur++; if(acG.cur>=acG.items.length){ acGameFinish(acG.wrong); return; } acRenderTF(document.getElementById('acGameBox')); };
  if(ans === it.isTrue){ nextCard(); }
  else {
    acG.wrong++; acG.lock = true;
    const c = document.getElementById('acTFCard'); if(c) c.classList.add('shake');
    toast(it.isTrue ? 'На самом деле это верный ответ' : 'На самом деле ответ неверный');
    setTimeout(()=>{ acG.lock = false; nextCard(); }, 780);
  }
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
        acRenderGameBox(); acRenderProgressBox(); acRenderCertBox(); acBadgeSync(); acAfterCheckpoint();
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
  const ci = acCourseOf(acL);
  const lastInCourse = (acL === acCourseFirst(ci) + AC_COURSES[ci].count - 1);
  const next = (!lastInCourse && acLessonDone(acL))
    ? `<p class="dim" style="font-size:12px;text-align:center;margin-top:4px">Урок ${acLocalNo(acL)+1} «${esc(AC_COURSE[acL+1].title)}» открыт</p>` : '';
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

/* ================= НАПОМИНАНИЕ (раз в сутки при входе) =================
   Показываем только при входе в приложение/Академию, раз в сутки, и НИКОГДА
   поверх активного действия: открытый sheet, игра, мини-апп, попап или
   полноэкранная вьюха → откладываем и пробуем позже. */
function acRemindBusy(){
  if(document.getElementById('okoPopup')) return true;         // уже показан попап
  if(document.querySelector('.sheet.open')) return true;       // открыт bottom-sheet
  /* открыта полноэкранная вьюха (звонок / регистрация / канал / профиль и т.п.) */
  if(document.querySelector('#callScreen.open, #regView.open, .ma-view.open')) return true;
  /* открыт мини-апп внутри хаба «Мини-аппы» (сетка спрятана — значит внутри вьюхи) */
  const mg = document.getElementById('maGrid');
  if(mg && mg.style.display === 'none') return true;
  /* пользователь в разделе Игры / Мини-аппы — не мешаем активному занятию */
  const act = document.querySelector('.screen.active');
  if(act && /^screen-(games|mini)$/.test(act.id)) return true;
  return false;
}
function acRemindCheck(){
  try{
    if(!localStorage.getItem('oko-auth')) return;            // ещё не в приложении
    /* контекст-осознанность: не чаще одного раза за сессию — постоянный флаг */
    try{ if(sessionStorage.getItem('oko-ac-nudge-shown')) return; }catch(e){}
    const scr = document.getElementById('screen-academy');
    if(scr && scr.classList.contains('active')) return;      // уже в академии — напоминать незачем
    /* показываем ТОЛЬКО на Ленте (или в Академии) — НИКОГДА поверх Кошелька / TON /
       Чатов / Рекламы / Игр / Настроек, чтобы не прерывать денежные и чат-задачи.
       Если пользователь на другом экране — тихо ждём перехода на Ленту, ничего не показывая. */
    const act = document.querySelector('.screen.active');
    if(!act || !/^screen-(feed|academy)$/.test(act.id)){ setTimeout(acRemindCheck, 15000); return; }
    const today = acDayStr();
    if(acS.remindDay === today) return;                      // раз в сутки
    const nx = acNextLesson();
    if(nx < 0) return;                                       // всё пройдено — не беспокоим
    if(acRemindBusy()){ setTimeout(acRemindCheck, 20000); return; }  // занят — отложить
    const pct = acLessonPct(nx), title = esc(AC_COURSE[nx].title), lno = acLocalNo(nx);
    let body, label;
    if(pct <= 0){
      body = 'Начни урок ' + lno + ' «' + title + '» — тебя ждёт разбор темы, слайды, тест и практика.';
      label = 'Начать урок';
    } else {
      body = 'Продолжи урок ' + lno + ' «' + title + '» — пройдено '
           + '<b style="color:var(--accent)">' + pct + '%</b>, осталось ' + (100 - pct) + '%.';
      label = 'Продолжить урок';
    }
    acS.remindDay = today; acSave();
    try{ sessionStorage.setItem('oko-ac-nudge-shown','1'); }catch(e){}  // максимум один раз за сессию
    showPopup({ico:'star', title:'Академия OKO', body:body,
      actions:[
        {label:label, onclick:()=>{ showTab('academy'); acOpenLesson(nx); }},
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
    + ' — ' + acCertLabel(c)
    + ' пройден, тест ' + c.score + '%. Учись со мной в OKO: https://true-journey-418.higgsfield.app';
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
  const ci = acCourseOf(acL);
  const dir = AC_COURSES[ci];
  const cert = acDirCert(ci);
  const idx = acCourseIdx(ci);
  const doneCnt = idx.filter(i=>acLessonDone(i)).length;
  const left = dir.count - doneCnt;
  if(cert){
    box.innerHTML = `
      <div class="card ac-cert-card ready">
        <div class="ac-cert-head">
          <span class="ico"><svg class="i"><use href="#i-star"/></svg></span>
          <div><h3>Сертификат направления получен</h3><p>Официальный диплом «${esc(dir.title)}» с печатью и подписью Академии OKO</p></div>
        </div>
        <span class="ac-cert-no">${esc(cert.no)} · ${esc(cert.date)} · тест ${cert.score}%</span>
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
          <div><h3>Сертификат направления готов</h3><p>Все ${dir.count} уроков «${esc(dir.title)}» пройдены — забирай именной диплом</p></div>
        </div>
        <button class="btn" onclick="acIssueCert()">${I('star')} Получить сертификат направления</button>
      </div>`;
    return;
  }
  box.innerHTML = `
    <div class="card ac-cert-card">
      <div class="ac-cert-head">
        <span class="ico" style="background:var(--raised);color:var(--dim)"><svg class="i"><use href="#i-lock"/></svg></span>
        <div><h3>Сертификат за направление «${esc(dir.title)}»</h3><p>Именной документ с печатью и подписью — за прохождение ВСЕГО направления</p></div>
      </div>
      <div class="ac-cert-req">
        <div class="${doneCnt>0?'ok':''}">${I(doneCnt>0?'check2':'circle-play')} Пройдено уроков: ${doneCnt} из ${dir.count}</div>
        <div>${I('poll')} Осталось ${left} ${acPlural(left,['урок','урока','уроков'])} — уроки можно проходить в любом порядке</div>
      </div>
    </div>`;
}

function acIssueCert(){
  const ci = acCourseOf(acL);
  if(acDirCert(ci) || !acCourseDone(ci)) return;          // диплом один на направление, и только когда всё пройдено
  const idx = acCourseIdx(ci);
  const avg = Math.round(idx.reduce((sum,i)=>sum + ((acS.lessons[i]&&acS.lessons[i].testScore)||0), 0) / idx.length);
  const cert = {
    no: 'OKO-CERT-' + String(Math.floor(1e5 + Math.random()*9e5)),
    date: new Date().toLocaleDateString('ru-RU'),
    score: avg,
    name: (typeof PROFILE!=='undefined' && PROFILE.name) ? PROFILE.name : 'Слушатель Академии',
    dir: AC_COURSES[ci].id,
    courseTitle: AC_COURSES[ci].title
  };
  acS.certs.unshift(cert);
  acSave();
  acCertUrl = null;
  toast('Сертификат направления «' + AC_COURSES[ci].title + '» выдан: ' + cert.no);
  acBadgeSync();
  acRenderCertBox(); acRenderProgressBox();
  acCertCelebrate(()=>acCertShow());
}

/* эффект выдачи сертификата: вспышка лаймовых лучей + печать, затем показ */
function acCertCelebrate(cb){
  try{
    const old = document.getElementById('acBurst'); if(old) old.remove();
    const el = document.createElement('div');
    el.id = 'acBurst'; el.className = 'ac-burst';
    let rays = '';
    for(let i=0;i<14;i++) rays += `<i style="--a:${(i*360/14)}deg;--d:${(i%3)*0.04}s"></i>`;
    let conf = '';
    for(let i=0;i<22;i++){
      const x = (Math.random()*100).toFixed(1), dl = (Math.random()*0.35).toFixed(2),
            rot = (Math.random()*360).toFixed(0), sx = (Math.random()*0.7+0.6).toFixed(2);
      conf += `<b style="left:${x}%;--dl:${dl}s;--rot:${rot}deg;--sx:${sx}"></b>`;
    }
    el.innerHTML = `<div class="ac-burst-core">
        <span class="ac-burst-rays">${rays}</span>
        <span class="ac-burst-seal">${I('star')}</span>
      </div>
      <div class="ac-burst-txt">Сертификат выдан</div>
      <div class="ac-burst-conf">${conf}</div>`;
    document.body.appendChild(el);
    requestAnimationFrame(()=>el.classList.add('go'));
    setTimeout(()=>{ try{ el.remove(); }catch(e){} if(typeof cb==='function') cb(); }, 1250);
  }catch(e){ if(typeof cb==='function') cb(); }
}

/* ================= ВАУ-МОМЕНТ: УРОК ОСВОЁН (все 5 этапов на 100%) =================
   Отдельный праздничный оверлей — срабатывает ровно один раз, когда закрыт ПОСЛЕДНИЙ
   из пяти чек-пойнтов урока. Не путать с выдачей сертификата (там свой burst-эффект). */
function acAfterCheckpoint(){
  try{
    const ls = acLS();
    if(acLessonPct(acL) === 100 && !ls.mastered){
      ls.mastered = true; acSave();
      acLessonMaster();
    }
  }catch(e){}
}
function acMasterClose(){
  const el = document.getElementById('acMaster'); if(!el) return;
  el.classList.remove('go');
  setTimeout(()=>{ try{ el.remove(); }catch(e){} }, 260);
}
function acMasterAct(kind, idx){
  acMasterClose();
  setTimeout(()=>{
    if(kind === 'cert') acIssueCert();
    else if(kind === 'next') acOpenLesson(idx);
  }, 180);
}
function acLessonMaster(){
  try{
    const old = document.getElementById('acMaster'); if(old) old.remove();
    const L = acCur(), ls = acLS(), ci = acCourseOf(acL);
    const lastInCourse = (acL === acCourseFirst(ci) + AC_COURSES[ci].count - 1);
    const nextIdx = acL + 1;
    /* умный CTA: сначала — забрать сертификат, иначе — следующий урок, иначе просто закрыть */
    let cta = '';
    if(acCertEligible())
      cta = `<button class="btn ac-master-cta" onclick="acMasterAct('cert')">${I('star')} Получить сертификат</button>`;
    else if(!lastInCourse && acUnlocked(nextIdx))
      cta = `<button class="btn ac-master-cta" onclick="acMasterAct('next',${nextIdx})">${I('circle-play')} Следующий урок</button>`;
    const pills = ['Видео','Слайды','Тест','Практика','Игра']
      .map((t,i)=>`<span class="ac-master-pill" style="--pd:${(i*0.06).toFixed(2)}s">${I('check2')}${t}</span>`).join('');
    let rays = ''; for(let i=0;i<12;i++) rays += `<i style="--a:${(i*360/12)}deg;--d:${(i%3)*0.05}s"></i>`;
    let conf = '';
    for(let i=0;i<20;i++){
      const x=(Math.random()*100).toFixed(1), dl=(Math.random()*0.4).toFixed(2),
            rot=(Math.random()*360).toFixed(0), sx=(Math.random()*0.7+0.6).toFixed(2);
      conf += `<b style="left:${x}%;--dl:${dl}s;--rot:${rot}deg;--sx:${sx}"></b>`;
    }
    const el = document.createElement('div');
    el.id = 'acMaster'; el.className = 'ac-master';
    el.innerHTML = `
      <div class="ac-master-conf">${conf}</div>
      <div class="ac-master-card" onclick="event.stopPropagation()">
        <div class="ac-master-badge">
          <span class="ac-master-rays">${rays}</span>
          <span class="ac-master-seal">${I('crown')}</span>
        </div>
        <div class="ac-master-kick">Урок пройден на 100%</div>
        <h3 class="ac-master-title">Урок освоен</h3>
        <p class="ac-master-sub">«${esc(L.title)}» — все пять этапов закрыты</p>
        <div class="ac-master-pills">${pills}</div>
        <div class="ac-master-stat">${I('poll')} Тест — <b>${ls.testScore||0}%</b></div>
        <div class="ac-master-actions">
          ${cta}
          <button class="btn ${cta?'ghost':''} ac-master-dismiss" onclick="acMasterClose()">${cta?'Позже':'Отлично'}</button>
        </div>
      </div>`;
    el.addEventListener('click', acMasterClose);   // тап по фону — закрыть
    document.body.appendChild(el);
    requestAnimationFrame(()=>el.classList.add('go'));
  }catch(e){}
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
    const gi = (typeof cert.lesson === 'number' ? cert.lesson : 0);
    const lessonNo = cert.localNo || (acLocalNo ? acLocalNo(gi) : gi+1);
    const courseTitle = cert.courseTitle || AC_COURSES[acCourseOf(gi)].title;
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
    ctx.fillText('курса «' + courseTitle + '» Академии OKO', W/2, 696);
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
  return (acView==='lesson' ? acDirCert(acCourseOf(acL)) : null) || acS.certs[0] || null;
}
function acCertShow(i){
  const cert = (typeof i === 'number') ? acS.certs[i] : (acDirCert(acCourseOf(acL)) || acCertRec());
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

/* ================= СЕРТИФИКАТЫ В ПРОФИЛЕ =================
   Именные сертификаты Академии показываем прямо в профиле (карточка после
   ачивок). Инъекция через chain-патч renderMyProfile: на каждый ре-рендер
   профиля пере-вставляем свежую карточку (старую удаляем — без дублей). */
function acProfileCertsHtml(){
  const n = acS.certs.length;
  const head = `
    <div class="ac-pcerts-head">
      <span class="ico">${I('star')}</span>
      <div class="meta"><b>Сертификаты Академии</b><span>${n
        ? n + ' ' + acPlural(n, ['официальный','официальных','официальных']) + ' · печать и подпись'
        : 'Пройди направление — получи именной документ'}</span></div>
      <button class="btn sm ghost" onclick="showTab('academy')">${n?'Все':'В Академию'}</button>
    </div>`;
  if(!n){
    return `<div class="card ac-pcerts empty" id="acProfCerts">${head}${acProfileBadgesHtml()}
      <p class="ac-pcerts-invite">Пройди все уроки направления (порог теста ${AC_PASS}%+) — и получи именной сертификат OKO с печатью и подписью руководителя Академии. Он появится здесь и в разделе «Академия».</p></div>`;
  }
  const show = acS.certs.slice(0, 3).map((c)=>{
    const gi = acS.certs.indexOf(c);
    return `<div class="ac-pcert-row">
      <span class="ico">${I('file')}</span>
      <span class="meta"><span class="t">${esc(acCertLabel(c))}</span>
      <span class="s">${esc(c.no)} · ${esc(c.date)} · тест ${c.score}%</span></span>
      <button class="btn sm ghost ac-ico-btn" onclick="acCertShare(${gi})" title="Поделиться" aria-label="Поделиться">${I('share')}</button>
      <button class="btn sm ghost" onclick="acCertShow(${gi})">Показать</button>
    </div>`;
  }).join('');
  const more = n > 3 ? `<button class="ac-pcerts-more" onclick="showTab('academy')">и ещё ${n-3} ${acPlural(n-3,['сертификат','сертификата','сертификатов'])} — в Академии ${I('chev')}</button>` : '';
  return `<div class="card ac-pcerts" id="acProfCerts">${head}${acProfileBadgesHtml()}<div class="ac-pcert-list">${show}</div>${more}</div>`;
}
/* компактная полоса заслуженных бейджей для профиля */
function acProfileBadgesHtml(){
  const on = acBadgeDefs().filter(b=>b.on);
  if(!on.length) return '';
  return `<div class="ac-pbadges">${on.map(b=>`<span class="ac-pbadge" title="${b.d}">${I(b.ic)}<span>${b.t}</span></span>`).join('')}</div>`;
}
function acPlural(n, forms){
  const a = Math.abs(n) % 100, b = a % 10;
  if(a > 10 && a < 20) return forms[2];
  if(b > 1 && b < 5) return forms[1];
  if(b === 1) return forms[0];
  return forms[2];
}
function acProfileInject(){
  try{
    const anchor = document.getElementById('profAch');
    if(!anchor || !anchor.parentNode) return;
    const old = document.getElementById('acProfCerts');
    if(old) old.remove();
    const wrap = document.createElement('div');
    wrap.innerHTML = acProfileCertsHtml();
    const node = wrap.firstElementChild;
    if(!node) return;
    node.style.marginTop = '14px';
    anchor.parentNode.insertBefore(node, anchor.nextSibling);
  }catch(e){}
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
  /* сертификаты в профиле: chain-патч renderMyProfile */
  if(typeof renderMyProfile === 'function'){
    const _acPrevRenderProfile = renderMyProfile;
    renderMyProfile = function(){
      _acPrevRenderProfile.apply(this, arguments);
      acProfileInject();
    };
  }
  const scr = document.getElementById('screen-academy');
  if(scr && scr.classList.contains('active')){ acStreakTouch(); acRender(); }
  /* если профиль уже открыт при инициализации — сразу вставим сертификаты */
  const sp = document.getElementById('screen-profile');
  if(sp && sp.classList.contains('active')) acProfileInject();
  setTimeout(acRemindCheck, 2200);           // напоминание об уроке — раз в сутки
})();
