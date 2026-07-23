export const meta = {
  name: 'oko-polish-wave',
  description: 'Волна улучшений OKO: агент-владелец модуля возвращает точечные правки (маркетинг, продажи, UX, вау)',
  phases: [ { title: 'Аудит и правки модулей' } ],
};

const ROOT = '/home/user/OKO-TEAM/oko-app/app';
/* высокоценные, изолированные модули (разные файлы → без конфликтов при интеграции) */
const MODULES = [
  { id:'feed-algo',      area:'Лента и алгоритмы рекомендаций' },
  { id:'chats-plus',     area:'Мессенджер: статусы, поиск, голосовые, свайп-ответ' },
  { id:'market-pro',     area:'Биржа услуг: кабинет продавца, пакеты, эскроу' },
  { id:'paywall',        area:'Паволлы, тарифы, триггеры подписки' },
  { id:'profile-social', area:'Профиль, соцграф, подписки' },
  { id:'ads',            area:'Рекламный кабинет' },
];

const EDIT = {
  type:'object', additionalProperties:false, required:['file','oldString','newString','why'],
  properties:{
    file:{type:'string', description:'Путь к файлу относительно репо, напр. oko-app/app/modules/feed-algo/script.js'},
    oldString:{type:'string', description:'ТОЧНАЯ строка из файла (уникальная, копировать дословно с отступами)'},
    newString:{type:'string', description:'Замена'},
    why:{type:'string', description:'Одна фраза: что улучшает (маркетинг/продажи/UX/вау/адаптация)'}
  }};
const OUT = { type:'object', additionalProperties:false, required:['module','edits'],
  properties:{ module:{type:'string'}, edits:{type:'array', maxItems:6, items:EDIT} } };

const RULES = `
Ты — владелец модуля приложения OKO (супер-апп: мессенджер+лента+биржа+ИИ+академия, бренд чёрный+лайм #9AFF00, Bebas Neue+Montserrat, тёмная и светлая темы, БЕЗ ЭМОДЗИ, только SVG-иконки, mobile-first, на русском).

ЗАДАЧА: сделать 3–6 ТОЧЕЧНЫХ, БЕЗОПАСНЫХ улучшений своего модуля. Приоритет — то, что двигает бизнес:
- маркетинг/продажи: сильнее продающая микрокопия, офферы, CTA, триггеры (дефицит/соцдоказательство/выгода), понятная ценность;
- медийность/вовлечение: живые формулировки, эмоция, ясные выгоды;
- UX/адаптация: убрать невнятные подписи, улучшить пустые состояния, подсказки;
- вау: маленькие приятные детали (без тяжёлого кода).

ЖЁСТКИЕ ПРАВИЛА:
- Меняй ТОЛЬКО текстовые строки/микрокопию/подписи/небольшие стили. НЕ трогай логику, имена функций, структуру, обработчики.
- НИКАКИХ эмодзи. Тон бренда: уверенно, по делу, продающе, по-русски.
- oldString — ДОСЛОВНАЯ уникальная строка из файла (проверь grep, что встречается ровно один раз). Копируй с точными отступами и кавычками.
- newString не должен ломать JS: сохраняй кавычки/экранирование, длину держи разумной, без переносов строк внутри строковых литералов.
- Если строка на русском есть в i18n-переводах (modules/i18n-settings/script.js) как ключ — НЕ меняй её (иначе сломаешь перевод). Выбирай строки, которых нет в i18n, либо возвращай также правку соответствующего ключа перевода.
- Лучше 3 сильных правки, чем 6 слабых. Не выдумывай — работай по реальному коду файла.

Твой модуль: читай файлы в ${ROOT}/modules/<id>/ (script.js, style.css, screen.html, overlay.html — какие есть). Верни {module, edits:[...]}.
`;

const results = await pipeline(
  MODULES,
  (m) => agent(
    `${RULES}

МОДУЛЬ: ${m.id}
ЗОНА: ${m.area}
Каталог файлов: ${ROOT}/modules/${m.id}/
Сначала прочитай файлы модуля (Read), при необходимости grep по строке для проверки уникальности oldString. Затем верни точечные правки.`,
    { label:m.id, phase:'Аудит и правки модулей', schema:OUT, agentType:'general-purpose' }
  ).then(r => ({ id:m.id, edits:(r&&r.edits)?r.edits:[] }))
);

const all = {};
let total=0;
for(const r of results){ if(r&&r.id){ all[r.id]=r.edits; total+=r.edits.length; } }
log(`Правок собрано: ${total} из ${Object.keys(all).length} модулей`);
return { edits: all, total };
