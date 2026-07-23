/* ================= FEED-ALGO: алгоритмы рекомендаций OKO ================= */
/* Скоринг как у больших соцсетей: интересы + свежесть + вовлечённость +
   персональные сигналы + сессионный шум. Реклама — вставкой каждые 4-5 позиций. */

const FA_TOPICS = {ai:'Нейросети', content:'Контент', business:'Бизнес', marketing:'Маркетинг', games:'Игры', crypto:'Крипта'};
const FA_RU2ID = {'нейросети':'ai','ии':'ai','контент':'content','reels':'content','рилс':'content',
  'бизнес':'business','маркетинг':'marketing','игры':'games','крипта':'crypto','ton':'crypto','тон':'crypto'};

const FA = {
  seed: ((Date.now() % 2147483647) ^ 0x9AFF00) >>> 0, /* сессионный seed шума */
  signals: {},      /* {topic: вес} — накопленные реакции пользователя по темам */
  authors: {},      /* {автор: вес} — аффинность: кого ты реально читаешь/лайкаешь */
  _ints: null,      /* кэш Set интересов из регистрации (парсим localStorage один раз) */
  page: 0,          /* сколько партий бесконечной ленты подгружено */
  maxPages: 8,
  loading: false,
  genId: 778000,    /* id генерируемых постов (ads занимает 9000+, пул — 777xxx) */
  usedCombos: {},   /* защита от повторов шаблон+автор в генераторе */
  io: null,
  infoOpen: false,  /* раскрыто ли пояснение «как работает лента» */
  now: Date.now(),  /* «замороженное сейчас» скоринга: одинаковый epoch на все ре-рендеры →
                       детерминированный порядок (нет дребезга). Обновляется на refresh/подгрузке. */
};

/* ---------- персист сигналов ---------- */
function faLoadSignals(){
  try{
    const s = JSON.parse(localStorage.getItem('oko-feed-signals') || 'null');
    if(s && typeof s.topics === 'object' && s.topics) FA.signals = s.topics;
  }catch(e){}
}
function faSaveSignals(){
  try{ localStorage.setItem('oko-feed-signals', JSON.stringify({topics:FA.signals, at:Date.now()})); }catch(e){}
}
function faSignal(topic, w){
  if(!topic || !FA_TOPICS[topic]) return;
  FA.signals[topic] = Math.min(40, Math.max(0, Math.round(((FA.signals[topic]||0) + w)*10)/10));
  faSaveSignals();
}

/* ---------- персист аффинности авторов (с кем ты взаимодействуешь) ---------- */
function faLoadAuthors(){
  try{
    const s = JSON.parse(localStorage.getItem('oko-feed-authors') || 'null');
    if(s && typeof s.authors === 'object' && s.authors) FA.authors = s.authors;
  }catch(e){}
}
function faSaveAuthors(){
  try{ localStorage.setItem('oko-feed-authors', JSON.stringify({authors:FA.authors, at:Date.now()})); }catch(e){}
}
function faAuthor(name, w){
  if(!name || !w) return;
  FA.authors[name] = Math.min(30, Math.max(0, Math.round(((FA.authors[name]||0) + w)*10)/10));
  faSaveAuthors();
}

/* ---------- интересы из регистрации (кэш: не парсим localStorage на каждый пост при сортировке) ---------- */
function faInterests(){
  if(FA._ints) return FA._ints;
  const out = new Set();
  try{
    const reg = JSON.parse(localStorage.getItem('oko-registration') || 'null');
    const raw = (reg && Array.isArray(reg.interests)) ? reg.interests : [];
    raw.forEach(x=>{
      const k = String(x).toLowerCase().trim();
      if(FA_TOPICS[k]) out.add(k); else if(FA_RU2ID[k]) out.add(FA_RU2ID[k]);
    });
  }catch(e){}
  FA._ints = out;
  return out;
}

/* ---------- детерминированный шум: seed сессии + id поста ---------- */
function faRand(id){
  let h = (FA.seed + (Math.abs(+id)||0) * 2654435761) >>> 0;
  h = Math.imul(h ^ (h >>> 15), h | 1);
  h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
  return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
}

/* ---------- сигналы поста: возраст, взвешенные реакции, скорость набора, watch-time ----------
   Все производные детерминированы от данных поста → порядок ленты стабилен между рендерами. */
function faAgeH(p){                       /* возраст в часах; пол 0.5ч, чтобы свежак не делил на ~0 */
  if(!p.ts) return p.promoted ? 2 : 96;
  return Math.max((FA.now - p.ts) / 36e5, 0.5);  /* FA.now заморожен → скор стабилен между рендерами */
}
function faReactions(p){                  /* взвешенная вовлечённость: коммент/репост весомее лайка */
  return (p.likes||0) + (Array.isArray(p.comments) ? p.comments.length : 0)*3 + (p.reposts||0)*2;
}
function faVelocity(p){                   /* engagement velocity — реакций в час (ядро тренда/виральности) */
  return faReactions(p) / faAgeH(p);
}
function faMediaSec(m){                   /* '1:12' -> секунды (watch-time прокси для видео) */
  if(!m) return 0;
  const a = String(m).split(':').map(x => parseInt(x, 10) || 0);
  return a.length === 2 ? a[0]*60 + a[1] : a[0];
}
function faIsTrending(p){                 /* виральный порог: быстро набирает и уже заметен */
  return !p.promoted && faVelocity(p) >= 100 && faReactions(p) >= 150;
}

/* ================= 1. ПУЛ КОНТЕНТА (12-15 демо-постов по интересам) ================= */
const FA_NOW = Date.now();
const FA_POOL = [
  {id:777001, topic:'ai', ageH:3, ava:'НД', name:'Нейро-дайджест', sub:'канал · 24.1к', media:'1:12',
   body:'Сравнили 4 модели на генерации сценариев для Reels: длинный контекст решает больше, чем «ум». Внутри — таблица промптов и разбор, где каждая ломается.',
   likes:512, views:18900, reposts:64, comments:[{a:'М',n:'Марк',t:'Таблица — золото, забрал в работу'},{a:'И',n:'Ира',t:'А на русских сценариях тестили?'}]},
  {id:777002, topic:'ai', ageH:9, ava:'Д', name:'Даниэль', sub:'канал · 8.1к', media:null,
   body:'Собрал пайплайн: тема → сценарий → озвучка → монтаж без единого клика. 30 роликов в месяц делает машина, я только утверждаю темы. Схему выложу завтра.',
   likes:341, views:6200, reposts:57, comments:[{a:'К',n:'Кирилл',t:'Жду схему, это же готовый бизнес'}]},
  {id:777003, topic:'ai', ageH:26, ava:'АМ', name:'Ася · ML на проде', sub:'канал · 5.7к', media:null,
   body:'Локальные модели уже тянут черновой монтаж и субтитры на ноутбуке с 16 ГБ. Посчитала стоимость: в 40 раз дешевле облака при потоке от 20 роликов в месяц.',
   likes:188, views:7400, reposts:22, comments:[]},
  {id:777004, topic:'content', ageH:5, ava:'РМ', name:'Reels-мастерская', sub:'канал · 18.3к', media:'0:47',
   body:'Хук первых 2 секунд: движение в кадре + вопрос без ответа. Прогнали 60 роликов — удержание выросло с 41% до 63%. Примеры до/после в ролике.',
   likes:693, views:31200, reposts:112, comments:[{a:'С',n:'Соня',t:'Проверила на своих — работает'},{a:'В',n:'Влад',t:'А для экспертного контента?'},{a:'Н',n:'Ника',t:'До/после очень наглядно'}]},
  {id:777005, topic:'content', ageH:14, ava:'O', name:'OKO Team', sub:'рекомендация', media:null,
   body:'Премодератор теперь ловит заезженные хуки: если начало ролика совпадает с сотней чужих — подсветим и предложим 3 свежие альтернативы до публикации.',
   likes:264, views:12800, reposts:31, comments:[{a:'А',n:'Артём',t:'Вот это фича, давно не хватало'}]},
  {id:777006, topic:'content', ageH:40, ava:'МК', name:'Монтажёрка', sub:'канал · 3.2к', media:null,
   body:'Караоке-субтитры без боли: пословный тайминг из распознавания + 3 пресета анимации. Шаблон в закрепе, сборка — 6 минут на ролик.',
   likes:97, views:4100, reposts:12, comments:[]},
  {id:777007, topic:'business', ageH:8, ava:'ББ', name:'Бизнес без воды', sub:'канал · 41к', media:null,
   body:'Юнит-экономика контент-завода: ролик стоит 240 ₽, заявка выходит 380 ₽, средний чек 18 000 ₽. Пока это самый дешёвый канал из всех, что мы считали.',
   likes:820, views:45600, reposts:178, comments:[{a:'П',n:'Пётр',t:'Какая ниша? У нас заявка дороже'},{a:'Е',n:'Егор',t:'Считали LTV или только первый чек?'}]},
  {id:777008, topic:'business', ageH:30, ava:'О', name:'Оля · считаю деньги', sub:'канал · 6.8к', media:null,
   body:'Три таблицы, которые спасают малый бизнес: движение денег, когорты клиентов и план-факт по неделям. Отдаю шаблоны — забирайте в закрепе.',
   likes:143, views:5900, reposts:26, comments:[]},
  {id:777009, topic:'marketing', ageH:6, ava:'МП', name:'Маркетинг на пальцах', sub:'канал · 12.9к', media:'0:58',
   body:'UGC-креативы обгоняют студийные в 4 из 5 тестов. Собрали 12 связок «хук + оффер», которые проходят модерацию и не выгорают неделями.',
   likes:447, views:20300, reposts:71, comments:[{a:'Т',n:'Тимур',t:'Связка №7 — просто пушка'}]},
  {id:777010, topic:'marketing', ageH:22, ava:'ТХ', name:'Трафик-хантер', sub:'канал · 4.5к', media:null,
   body:'Ретаргет на досмотревших 75% ролика дал CPL в 2.3 раза ниже холодного трафика. Настройка занимает вечер, инструкция по шагам — в посте.',
   likes:129, views:6800, reposts:18, comments:[]},
  {id:777011, topic:'games', ageH:12, ava:'ГП', name:'Геймдев-подвал', sub:'канал · 7.4к', media:'2:04',
   body:'Инди-командой из двух человек собрали демо за 6 недель: движок не важен, важен вертикальный срез. Разбор плана спринтов и что выкинули из бэклога.',
   likes:305, views:11500, reposts:44, comments:[{a:'Д',n:'Дэн',t:'Про вертикальный срез — в точку'}]},
  {id:777012, topic:'games', ageH:55, ava:'ПК', name:'Пиксель и код', sub:'канал · 2.9к', media:null,
   body:'Мини-игры в мессенджерах — недооценённый канал: сессия 4 минуты, возврат на день 38%. Подборка механик, которые реально держат ретеншн.',
   likes:76, views:3400, reposts:9, comments:[]},
  {id:777013, topic:'crypto', ageH:4, ava:'TR', name:'TON Radar', sub:'канал · 15.6к', media:'1:05',
   body:'Активность кошельков TON выросла на 34% за месяц: разбираем, куда идёт ликвидность и какие мини-аппы собирают аудиторию быстрее всех.',
   likes:578, views:26700, reposts:96, comments:[{a:'Л',n:'Лев',t:'Мини-аппы — новый трафик, факт'},{a:'Ю',n:'Юля',t:'Ждём разбор по стейкингу'}]},
  {id:777014, topic:'crypto', ageH:18, ava:'КС', name:'Крипто-скептик', sub:'канал · 9.2к', media:null,
   body:'Чек-лист перед покупкой любого токена: команда, разлоки, ликвидность, аудит. 4 пункта отсеивают 90% мусора. Сохрани — пригодится.',
   likes:211, views:9700, reposts:38, comments:[]},
  {id:777015, topic:'business', ageH:2, ava:'БО', name:'Биржа OKO', sub:'сервис OKO', media:null, promoted:true,
   body:'Нужен монтажёр, сценарист или таргетолог под проект? На бирже OKO — исполнители с рейтингом и безопасной сделкой: оплата уходит после приёмки.',
   likes:44, views:8100, reposts:6, comments:[]},
];

/* вливаем пул + проставляем ts/topic старым постам ядра */
(function faSeedContent(){
  FA_POOL.forEach(p=>{
    p.ts = FA_NOW - p.ageH*36e5; delete p.ageH;
    p.liked = false; p.saved = false;
    if(!POSTS.rec.some(x=>x.id===p.id)) POSTS.rec.push(p);
  });
  const stamp = {101:{h:6,t:'ai'}, 102:{h:21,t:'business'}, 201:{h:28,t:'content'}, 202:{h:46,t:'business'}};
  [...POSTS.sub, ...POSTS.rec].forEach(p=>{
    if(!p.ts){ const s = stamp[p.id]; p.ts = FA_NOW - ((s ? s.h : 24 + (p.id % 7) * 4)) * 36e5; }
    if(!p.topic && stamp[p.id]) p.topic = stamp[p.id].t;
  });

  /* демо-треды: показать, что ответы и лайки комментариев реально работают */
  const seedReplies = (pid, idx, likes, reps) => {
    const pp = POSTS.rec.find(x => x.id === pid);
    if(pp && pp.comments && pp.comments[idx]){
      if(likes != null) pp.comments[idx].likes = likes;
      if(reps) pp.comments[idx].replies = reps;
    }
  };
  seedReplies(777004, 0, 24, [
    {a:'РМ', n:'Reels-мастерская', t:'Соня, топ! Скинь пример в личку — добавим в подборку недели', likes:14},
    {a:'В',  n:'Влад', t:'+1, тоже хочу глянуть на экспертном контенте'}]);
  seedReplies(777004, 1, 8, [
    {a:'РМ', n:'Reels-мастерская', t:'Для экспертного работает мягче: вопрос-провокация вместо движения', likes:11}]);
  seedReplies(777007, 0, 31, [
    {a:'ББ', n:'Бизнес без воды', t:'Пётр, ниша — онлайн-образование. В доставке заявка правда дороже', likes:19},
    {a:'Р',  n:'Рома', t:'У нас в услугах вышло 520 ₽ — близко к вашим цифрам'}]);
  seedReplies(777001, 0, 17);
  seedReplies(777013, 0, 22, [
    {a:'TR', n:'TON Radar', t:'Лев, разбор стейкинга уже в работе — выйдет на неделе', likes:9}]);
})();

/* ================= 2. СКОРИНГ (chain поверх ядра) ================= */
const _faPrevFeedScore = feedScore;
feedScore = function(p){
  let s = _faPrevFeedScore(p);              /* базовый скор ядра (лайки/комменты/репосты/просмотры) */
  if(p.promoted) s -= 1e6;                  /* снимаем «всегда топ-1»: позицию рекламы задаёт вставка */

  const ints = faInterests();

  /* 1. СВЕЖЕСТЬ — экспоненциальный декей ~2 суток (свежее ранжируется выше) */
  s *= 0.35 + 0.65 * Math.exp(-faAgeH(p) / 42);

  /* 2. СОВПАДЕНИЕ ИНТЕРЕСОВ — сид из регистрации, сильный буст */
  if(p.topic && ints.has(p.topic)) s += 430;

  /* 3. ВОВЛЕЧЁННОСТЬ НА ПРОСМОТР (engagement rate) — качество, а не только объём */
  const er = faReactions(p) / Math.max(p.views||1, 1);
  s += Math.min(er, 0.22) * 2300;

  /* 4. СКОРОСТЬ НАБОРА (engagement velocity) — реакций в час, ядро тренда/виральности */
  s += Math.min(faVelocity(p), 220) * 2.4;

  /* 5. ПОХОЖЕ НА ЛАЙКНУТОЕ — накопленный интерес к теме (персонализация) */
  s += Math.min(FA.signals[p.topic]||0, 14) * 34;

  /* 6. АФФИННОСТЬ АВТОРА — кого ты реально читаешь/лайкаешь/комментируешь */
  s += Math.min(FA.authors[p.name]||0, 20) * 20;

  /* 7. WATCH-TIME ПРОКСИ — видео с длительностью удерживают дольше (лёгкий буст под охват) */
  if(p.media) s += Math.min(faMediaSec(p.media)/60, 3) * 26 * Math.min((p.views||0)/12000, 1.4);

  if(p.promoted) s += 90;                   /* реклама чуть выше органики */
  s += (faRand(p.id) - 0.5) * 90;           /* сессионный шум — лента «дышит», детерминирован по seed+id */
  s -= (p.faPage||0) * 1e4;                 /* подгруженные партии — ниже (стабильный порядок) */
  return s;
};

/* ================= 3. ПЕРСОНАЛЬНЫЕ СИГНАЛЫ (патчи реакций) ================= */
if(typeof likePost === 'function'){
  const _faPrevLikePost = likePost;
  likePost = function(id){
    const p = postById(id); const was = p ? !!p.liked : false;
    _faPrevLikePost(id);                          /* точечное обновление карточки — БЕЗ пересборки ленты */
    if(p && p.liked !== was){
      if(p.topic) faSignal(p.topic, p.liked ? 2 : -2);
      faAuthor(p.name, p.liked ? 1.5 : -1.5);     /* лайк усиливает аффинность к автору */
    }
  };
}
if(typeof repost === 'function'){
  const _faPrevRepost = repost;
  repost = function(id){
    const p = postById(id); const was = p ? !!p.reposted : false;
    _faPrevRepost(id);
    if(p && p.reposted !== was){
      if(p.topic) faSignal(p.topic, p.reposted ? 3 : -3);
      faAuthor(p.name, p.reposted ? 2 : -2);      /* репост — самый сильный сигнал доверия автору */
    }
  };
}
/* openComments/addComment полностью переопределены ниже (секция 6: комментарии-треды) —
   сигнал интереса от открытия/написания коммента учитывается там же. */

/* ================= 4. UI: «почему показано», реклама каждые 4-5, обновление ================= */
function faIdOf(art){
  const b = art.querySelector('.post-more');
  const m = b && (b.getAttribute('onclick')||'').match(/openPostMenu\((\d+)/);
  return m ? +m[1] : null;
}
/* многосигнальное «почему рекомендовано»: до 2 честных, человекочитаемых причин.
   Разные сигналы → своя иконка и подпись; порядок = приоритет прозрачности. */
function faReasons(p){
  if(p.promoted) return {cls:'ad', ico:'megaphone', parts:['Реклама']};
  const ints = faInterests();
  const parts = [];
  let cls = 'hot', ico = 'fire';
  /* 1 — интерес из регистрации (самый честный «почему») */
  if(p.topic && ints.has(p.topic)){ parts.push('Твой интерес: ' + FA_TOPICS[p.topic]); cls = 'int'; ico = 'star'; }
  /* 2 — скорость набора (виральность), в реакциях/час */
  const vel = Math.round(faVelocity(p));
  if(vel >= 40 && parts.length < 2){ parts.push('Набирает ' + vel + ' реакций/час'); if(cls === 'hot'){ cls = 'vel'; ico = 'bolt'; } }
  /* 3 — похоже на лайкнутое (накопленный интерес к теме) */
  if((FA.signals[p.topic]||0) >= 2 && parts.length < 2){ parts.push('Похоже на лайкнутое'); if(cls === 'hot'){ cls = 'like'; ico = 'heart'; } }
  /* 4 — автор, которого ты читаешь (аффинность) */
  if((FA.authors[p.name]||0) >= 3 && parts.length < 2){ parts.push('Автор, которого ты читаешь'); if(cls === 'hot'){ cls = 'aff'; ico = 'user'; } }
  if(!parts.length) parts.push('Популярно сейчас');
  return {cls, ico, parts};
}

/* диверсификация ленты: не более 2 постов одного автора подряд (как в TikTok/Instagram).
   Жадно и детерминированно переставляет уже отранжированные узлы → без «дребезга» при ре-рендере.
   items: [{el, name}] в порядке ранга; возвращает [el] в разнообразном порядке. */
function faDiversify(items){
  const remaining = items.slice(), out = [];
  while(remaining.length){
    let idx = 0;
    const n = out.length;
    if(n >= 2 && out[n-1]._n && out[n-1]._n === out[n-2]._n){
      const alt = remaining.findIndex(x => x.name !== out[n-1]._n);
      if(alt > -1) idx = alt;         /* если все оставшиеся того же автора — оставляем как есть */
    }
    const pick = remaining.splice(idx, 1)[0];
    pick.el._n = pick.name;           /* пометка автора для проверки соседей */
    out.push(pick.el);
  }
  return out;
}

function faDecorate(){
  const list = document.getElementById('feedList');
  if(!list || curFeedKind !== 'rec') return;

  /* убрать длинную текстовую врезку ядра «Ранжирует алгоритм OKO…» — её роль берёт на себя
     аккуратная шапка с раскрывающимся пояснением (никакого визуального шума над лентой) */
  const baseNote = list.querySelector(':scope > div:not([class])');
  if(baseNote) baseNote.remove();

  /* единая чистая шапка: «Умная лента» + (i) пояснение + «Обновить подборку» */
  if(!list.querySelector('.fa-bar')){
    const open = FA.infoOpen ? ' fa-open' : '';
    list.insertAdjacentHTML('afterbegin',
      `<div class="fa-head">`+
        `<div class="fa-bar">`+
          `<div class="fa-bar-l">`+
            `<span class="fa-dot"></span>`+
            `<span class="fa-title">Умная лента</span>`+
            `<button class="fa-info${open}" type="button" aria-label="Как работает лента" onclick="faToggleInfo(this)">${I('fa-info')}</button>`+
          `</div>`+
          `<button class="fa-refresh" type="button" onclick="faRefresh()">${I('fa-refresh')}<span>Обновить подборку</span></button>`+
        `</div>`+
        `<div class="fa-explain${open}"><p>Ранжирует алгоритм OKO: вовлечённость и свежесть — как в Instagram, в отличие от Telegram. Реагируй на посты — лента точнее подстроится под тебя.</p></div>`+
      `</div>`);
  }

  /* разбор карточек на органику и рекламу */
  const arts = [...list.querySelectorAll('article.post')];
  const ads = [], org = [];
  arts.forEach(a=>{ const p = postById(faIdOf(a)); if(p && p.promoted) ads.push(a); else org.push({el:a, name:(p && p.name)||''}); });

  /* диверсификация органики (без 3 подряд одного автора), затем вставка рекламы каждые 4-5 позиций.
     appendChild перемещает существующие узлы — это точечная перестановка, а не пересборка ленты. */
  let seq = faDiversify(org);
  if(ads.length && arts.length > 3){
    let pos = 2;
    ads.forEach((ad,i)=>{
      seq.splice(Math.min(pos, seq.length), 0, ad);
      pos += 5 + (faRand(9100 + i) < 0.5 ? 0 : 1);
    });
  }
  seq.forEach(el=>list.appendChild(el));

  /* метки «Канал»/«В тренде»/«Реклама» + чип «почему показано» + «растёт» + галочка verified — без дублей */
  list.querySelectorAll('article.post').forEach(art=>{
    const p = postById(faIdOf(art)); if(!p) return;
    const head = art.querySelector('.head');
    const nameEl = art.querySelector('.head .name');
    /* у рекламы уже есть бейдж «Реклама», у топ-поста — «В тренде» (ядро) */
    let nameChip = nameEl && nameEl.querySelector('.chip');
    const w = faReasons(p);
    const vel = faVelocity(p);
    /* «В тренде» — виральный бейдж по скорости набора (если у карточки ещё нет чипа) */
    if(nameEl && !nameChip && faIsTrending(p)){
      nameEl.insertAdjacentHTML('beforeend', ` <span class="chip fa-trend">${I('fa-trend')}<span>В тренде</span></span>`);
      nameChip = nameEl.querySelector('.fa-trend');
    }
    /* «Канал» — информ-метка для органических каналов без своего чипа и без персонального сигнала
       (заменяет собой безликое «Популярно», а не дублирует его) */
    if(nameEl && !nameChip && !p.promoted && w.cls === 'hot' && /канал/i.test(p.sub || '')){
      nameEl.insertAdjacentHTML('beforeend', ' <span class="chip fa-chan">Канал</span>');
      nameChip = nameEl.querySelector('.fa-chan');
    }
    /* «растёт» — тонкий индикатор восходящей вовлечённости (для набирающих, но ещё не топ-трендов) */
    const sub = art.querySelector('.head .sub');
    if(sub && !sub.querySelector('.fa-rise') && !p.promoted && !faIsTrending(p) && vel >= 45){
      sub.insertAdjacentHTML('beforeend', ` <span class="fa-rise">${I('fa-trend')}растёт</span>`);
    }
    /* чип «почему»: до 2 честных причин через · ; при наличии осмысленной метки «Популярно» не дублируем */
    if(head && !art.querySelector('.fa-why') && !p.promoted){
      if(!(w.cls === 'hot' && nameChip)){
        const inner = w.parts.map((t,i)=> (i ? '<b class="fa-sep">·</b>' : '') + '<span>' + esc(t) + '</span>').join('');
        head.insertAdjacentHTML('afterend', `<div class="fa-why ${w.cls}">${I(w.ico)}${inner}</div>`);
      }
    }
    /* verify-stickers (vsDecorateFeed) выполняется в цепочке рендера РАНЬШЕ и уже могла
       поставить .vs-badge — не дорисовываем вторую галочку поверх (устраняет дубль в rec) */
    if(nameEl && !nameEl.querySelector('.fa-vb, .vs-badge') && typeof vBadge === 'function' && VERIFIED.has(p.name)){
      const chip = nameEl.querySelector('.chip');
      const badge = `<span class="fa-vb">${vBadge(p.name)}</span>`;
      if(chip) chip.insertAdjacentHTML('beforebegin', badge); else nameEl.insertAdjacentHTML('beforeend', badge);
    }
  });

  /* сторожок бесконечной ленты */
  const old = list.querySelector('.fa-sentinel'); if(old) old.remove();
  const endNote = list.querySelector('.fa-end'); if(endNote) endNote.remove();
  if(FA.page < FA.maxPages){
    const s = document.createElement('div'); s.className = 'fa-sentinel'; list.appendChild(s);
    if(FA.io){ FA.io.disconnect(); FA.io.observe(s); }
  }else{
    list.insertAdjacentHTML('beforeend', `<div class="fa-end">Ты посмотрел всю подборку — нажми «Обновить подборку» сверху</div>`);
  }
}

/* ---------- красивое пустое состояние ленты (иллюстрация + CTA) ---------- */
function faEmptyArt(){
  return `<svg class="fa-empty-art" viewBox="0 0 120 120" fill="none" aria-hidden="true">`+
    `<rect x="22" y="30" width="76" height="62" rx="13" stroke="currentColor" stroke-width="4" opacity=".32"/>`+
    `<circle cx="40" cy="49" r="7.5" fill="var(--lime)"/>`+
    `<rect x="55" y="44" width="33" height="5" rx="2.5" fill="currentColor" opacity=".42"/>`+
    `<rect x="55" y="54" width="21" height="5" rx="2.5" fill="currentColor" opacity=".26"/>`+
    `<rect x="34" y="70" width="52" height="5" rx="2.5" fill="currentColor" opacity=".24"/>`+
    `<rect x="34" y="80" width="36" height="5" rx="2.5" fill="currentColor" opacity=".16"/>`+
    `<g class="fa-empty-wave" stroke="var(--lime)" stroke-width="4.4" stroke-linecap="round" fill="none">`+
      `<path d="M90 24a18 18 0 0 1 0 26"/>`+
      `<path d="M98 16a30 30 0 0 1 0 42" opacity=".55"/>`+
    `</g></svg>`;
}
function faGoRec(){
  const b = [...document.querySelectorAll('#screen-feed .feed-tabs button')]
    .find(x => /'rec'/.test(x.getAttribute('onclick') || ''));
  if(b) b.click();
}
function faRenderEmpty(list, kind){
  const rec = kind === 'rec';
  const title = rec ? 'Пока пусто' : 'Тут появятся посты';
  const text  = rec
    ? 'Мы не нашли свежих постов. Обнови подборку — алгоритм соберёт новую ленту под тебя.'
    : 'Подпишись на каналы и авторов — их посты появятся здесь. А пока загляни в рекомендации.';
  const cta = rec
    ? `<button class="fa-empty-cta" type="button" onclick="faRefresh()">${I('fa-refresh')}<span>Обновить подборку</span></button>`
    : `<button class="fa-empty-cta" type="button" onclick="faGoRec()">${I('compass')}<span>Открыть рекомендации</span></button>`;
  list.innerHTML = `<div class="fa-empty">${faEmptyArt()}<b>${title}</b><span>${text}</span>${cta}</div>`;
}

/* ---------- время публикации на карточке (короткий формат: «3 ч», «2 д») ---------- */
function faShortAge(ts){
  if(!ts) return '';
  const min = Math.max(0, Date.now() - ts) / 60000;
  if(min < 1) return 'сейчас';
  if(min < 60) return Math.floor(min) + ' мин';
  const h = min / 60;
  if(h < 24) return Math.floor(h) + ' ч';
  const days = h / 24;
  if(days < 7) return Math.floor(days) + ' д';
  try{ return new Date(ts).toLocaleDateString('ru-RU', {day:'numeric', month:'short'}); }
  catch(e){ return Math.floor(days) + ' д'; }
}
/* дорисовать метку времени в .sub каждой карточки (обе вкладки, без дублей).
   Посты поздних модулей (demo-content и т.п.) грузятся после faSeedContent и не имеют ts —
   проставляем детерминированный возраст по id (стабилен между рендерами, без «прыжков»). */
function faStampTimes(list){
  if(!list) return;
  list.querySelectorAll('article.post').forEach(art=>{
    const sub = art.querySelector('.head .sub');
    if(!sub || sub.querySelector('.fa-age')) return;
    const p = postById(faIdOf(art));
    if(!p) return;
    if(!p.ts) p.ts = Date.now() - (1 + Math.floor(faRand(p.id) * 47)) * 36e5;  /* 1–48 ч, стабильно */
    const a = faShortAge(p.ts);
    if(a) sub.insertAdjacentHTML('beforeend', `<span class="fa-age">· ${a}</span>`);
  });
}

const _faPrevRenderFeed = renderFeed;
renderFeed = function(kind){
  kind = kind || curFeedKind || 'sub';
  _faPrevRenderFeed(kind);           /* декор-«почему показано» — только для rec */
  const list = document.getElementById('feedList');
  if(list && !list.querySelector('article.post')){ faRenderEmpty(list, kind); return; }
  faStampTimes(list);                /* время публикации — на обеих вкладках */
  if(kind === 'rec') faDecorate();
};

/* раскрыть/свернуть тонкое пояснение «как работает лента» (тултип-строка) */
function faToggleInfo(btn){
  FA.infoOpen = !FA.infoOpen;
  const head = btn.closest('.fa-head'); if(!head) return;
  btn.classList.toggle('fa-open', FA.infoOpen);
  const ex = head.querySelector('.fa-explain');
  if(ex) ex.classList.toggle('fa-open', FA.infoOpen);
  try{ localStorage.setItem('oko-feed-info', FA.infoOpen ? '1' : '0'); }catch(e){}
}

function faRefresh(){
  FA.seed = (Math.random() * 4294967295) >>> 0;   /* новый шум → пересборка порядка */
  FA.now = Date.now();                             /* обновляем epoch свежести только по явному действию */
  FA._ints = null;                                 /* перечитать интересы регистрации (сид персонализации) */
  renderFeed('rec');
  const list = document.getElementById('feedList');
  if(list){ list.classList.remove('fa-anim'); void list.offsetWidth; list.classList.add('fa-anim');
    setTimeout(()=>list.classList.remove('fa-anim'), 900); }
  const m = document.querySelector('main'); if(m) m.scrollTo({top:0, behavior:'smooth'});
  toast('Подборка пересобрана');
}

/* ================= 5. БЕСКОНЕЧНАЯ ЛЕНТА: генератор вариаций ================= */
const FA_GEN = {
  ai:{a:[['НЦ','Нейро-цех'],['ПИ','Промпт-инженер'],['АК','Агенты и код'],['ЛБ','Лаборатория 42']], t:[
    n=>`Собрали агентный пайплайн из ${n(3,6)} шагов: тема, сценарий, озвучка, монтаж. На выходе ${n(20,40)} роликов в месяц без ручной рутины.`,
    n=>`Тест локальной модели на ноутбуке: черновые субтитры за ${n(2,6)} минуты вместо получаса. Стоимость потока упала в ${n(8,40)} раз против облака.`,
    n=>`Разобрали ${n(30,90)} промптов для обложек: побеждает связка «референс + свет + стиль». Таблица сэкономит ${n(3,10)} часов в неделю.`]},
  content:{a:[['КЛ','Контент-лаб'],['ВК','Вертикальный кадр'],['СЦ','Сценарный цех'],['ХК','Хук и кадр']], t:[
    n=>`Проверили ${n(30,80)} хуков: движение в кадре + незакрытый вопрос держат удержание до ${n(55,70)}%. Примеры — в карусели.`,
    n=>`Пересобрали монтаж под темп музыки: смена кадра каждые ${n(2,4)} секунды подняла досмотры на ${n(15,45)}%.`,
    n=>`Караоке-субтитры + звуковые акценты дают +${n(10,30)}% удержания на первых 10 секундах. Пресет — в закрепе.`]},
  business:{a:[['ДП','Дело и прибыль'],['ЮЭ','Юнит-экономика'],['СБ','Системный бизнес'],['МН','Маржа и налоги']], t:[
    n=>`Посчитали юнит-экономику: заявка из контента стоит ${n(250,600)} ₽ против ${n(900,1800)} ₽ из таргета. Цифры по неделям внутри.`,
    n=>`Система вместо вдохновения: план на ${n(20,40)} постов, батч-съёмка за ${n(1,3)} дня, автопостинг. Выручка выросла на ${n(20,60)}%.`,
    n=>`Чек-лист делегирования: ${n(5,9)} процессов, которые забирают у собственника ${n(10,25)} часов в неделю. Шаблон отдаём бесплатно.`]},
  marketing:{a:[['ПФ','Перформанс-клуб'],['ЛГ','Лидген-цех'],['КТ','Креатив-тест'],['ВР','Воронки и ретаргет']], t:[
    n=>`A/B на ${n(6,16)} креативах: UGC-формат обошёл студийный в ${n(3,5)} тестах из 5. CPL ниже на ${n(18,42)}%.`,
    n=>`Ретаргет на досмотревших 75% ролика: лид дешевле в ${n(2,4)} раза. Настройка — один вечер, схема в посте.`,
    n=>`Воронка из ленты: пост → лид-магнит → бот. Конверсия в заявку ${n(4,11)}% без бюджета на трафик.`]},
  games:{a:[['ИС','Инди-сборка'],['ГД','Гейм-дизайн вслух'],['ЛВ','Левел и код'],['ПТ','Плейтест']], t:[
    n=>`Вертикальный срез за ${n(4,8)} недель командой из ${n(2,4)} человек: что выкинули из бэклога и почему это спасло демо.`,
    n=>`Мини-игры в мессенджерах: сессия ${n(3,6)} минут, возврат на день ${n(25,45)}%. Подборка механик удержания внутри.`,
    n=>`Плейтест на ${n(20,60)} игроках: главная метрика — время до первого «ага-момента». У нас вышло ${n(20,90)} секунд.`]},
  crypto:{a:[['ЧО','Чейн-обзор'],['ДФ','DeFi по-русски'],['ТС','TON-сводка'],['ХВ','Холодный кошелёк']], t:[
    n=>`Активность кошельков TON за месяц +${n(12,40)}%: смотрим, какие мини-аппы забирают аудиторию быстрее всех.`,
    n=>`Комиссии в сети упали до минимума — окно для перекладки портфеля. Разбор ${n(3,7)} стратегий с расчётом рисков.`,
    n=>`Аудит перед покупкой токена: команда, разлоки, ликвидность. ${n(3,5)} пункта отсеивают 90% мусора.`]},
};
function faRndInt(a,b){ return a + Math.floor(Math.random()*(b-a+1)); }

function faGenerate(count, page){
  const ints = [...faInterests()];
  const sig = Object.keys(FA.signals).filter(k=>FA.signals[k] >= 2);
  const all = Object.keys(FA_GEN);
  const pool = [...ints, ...ints, ...sig, ...all];   /* интересы и сигналы — с большим весом */
  const out = [];
  for(let i=0; i<count; i++){
    const topic = pool[faRndInt(0, pool.length-1)] || all[i % all.length];
    const g = FA_GEN[topic];
    let ai = faRndInt(0, g.a.length-1), ti = faRndInt(0, g.t.length-1), guard = 0;
    while(FA.usedCombos[topic+ai+'_'+ti] && guard++ < 12){ ai = faRndInt(0, g.a.length-1); ti = faRndInt(0, g.t.length-1); }
    FA.usedCombos[topic+ai+'_'+ti] = 1;
    const views = faRndInt(1200, 34000);
    const likes = Math.round(views * (0.008 + Math.random()*0.05));
    out.push({
      id: FA.genId++, topic, faPage: page,
      ava: g.a[ai][0], name: g.a[ai][1], sub: 'канал · ' + (1 + Math.random()*24).toFixed(1) + 'к',
      body: g.t[ti](faRndInt), media: Math.random() < 0.3 ? '0:' + faRndInt(31,59) : null,
      likes, views, reposts: Math.round(likes * (0.05 + Math.random()*0.15)),
      liked:false, saved:false, comments:[], ts: Date.now() - faRndInt(1,36)*36e5,
    });
  }
  return out;
}

function faLoadMore(){
  if(FA.loading || FA.page >= FA.maxPages || curFeedKind !== 'rec') return;
  const list = document.getElementById('feedList'); if(!list) return;
  FA.loading = true;
  const skel = `<div class="fa-skel"><div class="fa-skel-head"><div class="fa-b fa-skel-ava"></div><div style="flex:1"><div class="fa-b fa-skel-l1"></div><div class="fa-b fa-skel-l2"></div></div></div><div class="fa-b fa-skel-body w1"></div><div class="fa-b fa-skel-body w2"></div><div class="fa-b fa-skel-body w3"></div></div>`;
  const sent = list.querySelector('.fa-sentinel');
  (sent || list).insertAdjacentHTML(sent ? 'beforebegin' : 'beforeend', skel + skel + skel);
  setTimeout(()=>{
    list.querySelectorAll('.fa-skel').forEach(x=>x.remove());
    FA.page++;
    FA.now = Date.now();               /* свежесть/скорость пересчитываются на новом epoch при подгрузке */
    faGenerate(5, FA.page).forEach(p=>POSTS.rec.push(p));
    const m = document.querySelector('main');
    const st = m ? m.scrollTop : 0;
    renderFeed('rec');                 /* партия ранжируется ниже за счёт faPage-штрафа */
    if(m) m.scrollTop = st;
    FA.loading = false;
  }, 500);
}

/* ================= 6. КОММЕНТАРИИ-ТРЕДЫ (аватар, ник, время, лайки, ответы) =================
   Ядро рендерит плоский список {a,n,t} в #cmtList. Здесь — красивый тред: аватар,
   имя+verified, относительное время, лайк коммента с анимацией, ответы (1 уровень),
   поле ввода с аватаром и контекстом «Ответ …». Модель дополняется на лету, session-only. */
FA.cidSeq = 900000;
FA.replyTo = null;
const FA_CMT_PAGE = 6;   /* сколько корневых комментариев показываем до «показать ещё» */

function faPlural(n, one, few, many){
  const m10 = n % 10, m100 = n % 100;
  if(m10 === 1 && m100 !== 11) return one;
  if(m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
function faTimeAgo(ts){
  if(!ts) return 'сейчас';
  const d = Math.max(0, Date.now() - ts), min = d / 60000;
  if(min < 1) return 'сейчас';
  if(min < 60){ const n = Math.floor(min); return n + ' ' + faPlural(n, 'минуту', 'минуты', 'минут') + ' назад'; }
  const h = min / 60;
  if(h < 24){ const n = Math.floor(h); return n + ' ' + faPlural(n, 'час', 'часа', 'часов') + ' назад'; }
  const days = h / 24;
  if(days < 7){ const n = Math.floor(days); return n + ' ' + faPlural(n, 'день', 'дня', 'дней') + ' назад'; }
  try{ return new Date(ts).toLocaleDateString('ru-RU', {day:'numeric', month:'short'}); }catch(e){ return Math.floor(days) + ' д'; }
}
function faPrepOne(c, p, i, isReply){
  if(!c || typeof c !== 'object') return;
  if(c.cid == null) c.cid = FA.cidSeq++;
  if(c.ts == null){
    const base = (p && p.ts) ? Math.min(Date.now() - i * 60000, p.ts + (i + 1) * faRndInt(3, 55) * 60000)
                             : Date.now() - faRndInt(2, 3200) * 60000;
    c.ts = Math.min(base, Date.now() - 30000);
  }
  if(c.likes == null) c.likes = faRndInt(0, isReply ? 12 : 54);
  if(c.liked == null) c.liked = false;
  if(!Array.isArray(c.replies)) c.replies = [];
  c.replies.forEach((r, j) => faPrepOne(r, p, j, true));
}
function faPrepComments(p){
  if(!p) return;
  if(!Array.isArray(p.comments)) p.comments = [];
  p.comments.forEach((c, i) => faPrepOne(c, p, i, false));
}
function faFindComment(p, cid){
  if(!p || !Array.isArray(p.comments)) return null;
  for(const c of p.comments){
    if(c.cid === cid) return c;
    if(Array.isArray(c.replies)) for(const r of c.replies) if(r.cid === cid) return r;
  }
  return null;
}
function faCount(p){
  if(!p || !Array.isArray(p.comments)) return 0;
  let n = p.comments.length;
  p.comments.forEach(c => { if(Array.isArray(c.replies)) n += c.replies.length; });
  return n;
}
function faVerified(name){
  try{ if(typeof VERIFIED !== 'undefined' && typeof vBadge === 'function' && VERIFIED.has(name)) return vBadge(name); }catch(e){}
  return '';
}
function faCommentHTML(postId, c, isReply){
  const meCls    = c.me ? ' fac-me' : '';
  const likeCls  = c.liked ? ' on' : '';
  const likeCnt  = c.likes > 0 ? `<i>${c.likes}</i>` : '';
  const badge    = faVerified(c.n);
  const initial  = esc(String(c.a || (c.n ? c.n[0] : '?')).slice(0, 2).toUpperCase());
  let thread = '';
  if(!isReply && Array.isArray(c.replies) && c.replies.length){
    const open  = c._open ? ' open' : '';
    const label = c._open ? 'Скрыть ответы'
      : 'Показать ' + c.replies.length + ' ' + faPlural(c.replies.length, 'ответ', 'ответа', 'ответов');
    thread =
      `<button class="fac-toggle${open}" type="button" onclick="faToggleReplies(this,${postId},${c.cid})">`+
        `<span class="fac-tline"></span><span class="fac-tl">${label}</span>${I('chev')}</button>`+
      `<div class="fac-replies${open}">${c.replies.map(r => faCommentHTML(postId, r, true)).join('')}</div>`;
  }
  return (
    `<div class="fac-item${isReply ? ' fac-r' : ''}" data-cid="${c.cid}">`+
      `<div class="fac-ava${meCls}">${initial}</div>`+
      `<div class="fac-main">`+
        `<div class="fac-row"><span class="fac-name">${esc(c.n || 'Гость')}</span>${badge}`+
          `<span class="fac-time">${faTimeAgo(c.ts)}</span></div>`+
        `<div class="fac-text">${esc(c.t || '')}</div>`+
        `<div class="fac-acts">`+
          `<button class="fac-like${likeCls}" type="button" aria-label="Нравится" onclick="faLikeComment(${postId},${c.cid})">${I('heart')}${likeCnt}</button>`+
          (isReply ? '' : `<button class="fac-reply" type="button" onclick="faReplyTo(${postId},${c.cid})">${I('reply')}<span>Ответить</span></button>`)+
        `</div>`+
        thread +
      `</div>`+
    `</div>`
  );
}
function faRenderComments(id){
  const p = postById(id), list = document.getElementById('cmtList');
  if(!p || !list) return;
  faPrepComments(p);
  const n = faCount(p);
  const h3 = document.querySelector('#sheet-comments h3');
  if(h3) h3.innerHTML = 'Комментарии' + (n ? ` <span class="fac-count">${n}</span>` : '');
  if(!p.comments.length){
    list.innerHTML = `<div class="fac-empty">${I('comment')}<b>Пока тихо</b><span>Стань первым, кто оставит комментарий</span></div>`;
    return;
  }
  const shown = Math.min(p.comments.length, p._cmtShown || FA_CMT_PAGE);
  const items = p.comments.slice(0, shown).map(c => faCommentHTML(id, c, false)).join('');
  const rest = p.comments.length - shown;
  const more = rest > 0
    ? `<button class="fac-more" type="button" onclick="faMoreComments(${id})">`+
        `<span>Показать ещё ${rest} ${faPlural(rest, 'комментарий', 'комментария', 'комментариев')}</span>${I('chev')}</button>`
    : '';
  list.innerHTML = `<div class="fac-wrap">${items}</div>${more}`;
}
function faMoreComments(id){
  const p = postById(id); if(!p) return;
  p._cmtShown = (p._cmtShown || FA_CMT_PAGE) + FA_CMT_PAGE;
  faRenderComments(id);
}
function faUpdateCardCount(p){
  if(!p) return;
  try{
    const card = feedCardEl(p.id), cc = card && card.querySelector('.act-cmt');
    if(cc) cc.textContent = faCount(p);
  }catch(e){}
}
function faLikeComment(postId, cid){
  const p = postById(postId); if(!p) return;
  const c = faFindComment(p, cid); if(!c) return;
  c.liked = !c.liked;
  c.likes = Math.max(0, (c.likes || 0) + (c.liked ? 1 : -1));
  if(p.topic) faSignal(p.topic, c.liked ? 0.4 : -0.4);
  faAuthor(p.name, c.liked ? 0.3 : -0.3);
  const btn = document.querySelector('#cmtList .fac-item[data-cid="' + cid + '"] .fac-like');
  if(btn){
    btn.classList.toggle('on', c.liked);
    let i = btn.querySelector('i');
    if(c.likes > 0){ if(!i){ i = document.createElement('i'); btn.appendChild(i); } i.textContent = c.likes; }
    else if(i){ i.remove(); }
    btn.classList.remove('fac-burst'); void btn.offsetWidth;
    if(c.liked) btn.classList.add('fac-burst');
  }
}
function faToggleReplies(btn, postId, cid){
  if(!btn) return;
  const wrap = btn.nextElementSibling;
  const p = postById(postId), c = p ? faFindComment(p, cid) : null;
  if(!wrap || !c) return;
  const open = wrap.classList.toggle('open');
  btn.classList.toggle('open', open);
  c._open = open;
  const lbl = btn.querySelector('.fac-tl');
  if(lbl) lbl.textContent = open ? 'Скрыть ответы'
    : 'Показать ' + c.replies.length + ' ' + faPlural(c.replies.length, 'ответ', 'ответа', 'ответов');
}
function faReplyTo(postId, cid){
  const p = postById(postId); if(!p) return;
  const c = faFindComment(p, cid); if(!c) return;
  FA.replyTo = {postId: postId, cid: cid, name: c.n};
  const chip = document.getElementById('facReplyChip');
  if(chip){ chip.hidden = false; const nm = chip.querySelector('.fac-rc-name'); if(nm) nm.textContent = c.n || 'комментарий'; }
  const inp = document.getElementById('cmtInput');
  if(inp){ inp.placeholder = 'Ответить ' + (c.n || '') + '…'; inp.focus(); }
}
function faClearReply(){
  FA.replyTo = null;
  const chip = document.getElementById('facReplyChip'); if(chip) chip.hidden = true;
  const inp = document.getElementById('cmtInput'); if(inp) inp.placeholder = 'Написать комментарий…';
}

/* полное переопределение ядра */
openComments = function(id){
  const p = postById(id); if(!p) return;
  commentsFor = id;
  p._cmtShown = FA_CMT_PAGE;          /* каждое открытие — с первой «страницы» */
  faClearReply();
  faRenderComments(id);
  openSheet('comments');
  if(p.topic) faSignal(p.topic, 0.5);
  faAuthor(p.name, 0.6);                 /* открыл обсуждение — интерес к автору */
};
addComment = function(){
  const inp = document.getElementById('cmtInput'); if(!inp) return;
  const t = inp.value.trim();
  if(!t || commentsFor == null) return;
  const p = postById(commentsFor); if(!p) return;
  const meName = (typeof PROFILE !== 'undefined' && PROFILE && PROFILE.name) ? PROFILE.name : 'Ты';
  const node = {a: meName[0], n: meName, t: t, ts: Date.now(), likes: 0, liked: false,
    cid: FA.cidSeq++, replies: [], me: true};
  if(FA.replyTo && FA.replyTo.postId === commentsFor){
    const parent = faFindComment(p, FA.replyTo.cid);
    if(parent){ if(!Array.isArray(parent.replies)) parent.replies = []; parent.replies.push(node); parent._open = true; }
    else p.comments.push(node);
  }else{
    p.comments.push(node);
  }
  inp.value = '';
  faClearReply();
  if(p.topic) faSignal(p.topic, 0.7);
  faAuthor(p.name, 1);                   /* написал коммент — сильный сигнал интереса к автору */
  p._cmtShown = Math.max(p._cmtShown || FA_CMT_PAGE, p.comments.length);  /* свой коммент всегда виден */
  faRenderComments(commentsFor);
  faUpdateCardCount(p);
  const list = document.getElementById('cmtList');
  const el = list && list.querySelector('.fac-item[data-cid="' + node.cid + '"]');
  if(el){ el.classList.add('fac-new'); el.scrollIntoView({block:'nearest', behavior:'smooth'}); }
};

/* ================= 7. ДВОЙНОЙ ТАП ПО КАРТОЧКЕ — ЛАЙК (как в Instagram) =================
   Двойной тап/клик по телу поста ставит лайк (никогда не снимает) и рисует
   всплывающее сердце в точке нажатия. Лайк точечный (likePost — без пересборки),
   поэтому моргания нет. Интерактив (кнопки/меню/чипы) исключён. */
function faHeartBurst(art, x, y){
  if(!art) return;
  const r = art.getBoundingClientRect();
  const h = document.createElement('span');
  h.className = 'fa-dtap-heart';
  h.innerHTML = I('heart');
  h.style.left = Math.round((x != null ? x : r.left + r.width / 2) - r.left) + 'px';
  h.style.top  = Math.round((y != null ? y : r.top + r.height / 2) - r.top) + 'px';
  art.appendChild(h);
  setTimeout(() => h.remove(), 760);
}
function faDoubleTapLike(){
  const list = document.getElementById('feedList');
  if(!list || list._faDtap) return; list._faDtap = 1;
  let lastT = 0, lastEl = null;
  const fire = (art, x, y) => {
    const pid = faIdOf(art); if(pid == null) return;
    const p = postById(pid); if(!p) return;
    if(!p.liked && typeof likePost === 'function') likePost(pid);  /* double-tap только ставит лайк */
    faHeartBurst(art, x, y);
    if(navigator.vibrate) try{ navigator.vibrate(12); }catch(e){}
  };
  list.addEventListener('click', e => {
    /* не мешаем интерактивным элементам и выделению текста */
    if(e.target.closest('button,a,input,textarea,.acts,.post-more,.fa-why,.fa-bar,.fa-explain,.fa-empty')) return;
    const sel = window.getSelection && window.getSelection();
    if(sel && String(sel).length > 1) return;
    const art = e.target.closest('article.post'); if(!art) return;
    const now = Date.now();
    if(now - lastT < 330 && lastEl === art){ lastT = 0; lastEl = null; fire(art, e.clientX, e.clientY); }
    else { lastT = now; lastEl = art; }
  });
}

/* ================= САМОИНИЦИАЛИЗАЦИЯ ================= */
(function faInit(){
  /* svg-иконка «обновить» в общие defs */
  const defs = document.querySelector('svg defs');
  const addSym = (id, inner)=>{
    if(defs && !document.getElementById(id)){
      const s = document.createElementNS('http://www.w3.org/2000/svg','symbol');
      s.setAttribute('id', id); s.setAttribute('viewBox','0 0 100 100');
      s.innerHTML = inner; defs.appendChild(s);
    }
  };
  addSym('i-fa-refresh', '<path d="M84 50a34 34 0 1 1-10-24" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><polyline points="76 10 76 27 59 26" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>');
  addSym('i-fa-info', '<circle cx="50" cy="50" r="38" fill="none" stroke="currentColor" stroke-width="7"/><line x1="50" y1="45" x2="50" y2="70" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><circle cx="50" cy="31" r="4.6" fill="currentColor"/>');
  addSym('i-fa-x', '<line x1="28" y1="28" x2="72" y2="72" stroke="currentColor" stroke-width="8" stroke-linecap="round"/><line x1="72" y1="28" x2="28" y2="72" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>');
  /* восходящий график — для бейджа «В тренде» и индикатора «растёт» */
  addSym('i-fa-trend', '<polyline points="16 64 40 42 56 56 84 26" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><polyline points="64 26 84 26 84 46" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>');
  /* i18n: чтобы EN-режим не оставлял русские строки шапки (авто-переводчик по ST_DICT) */
  if(typeof ST_DICT !== 'undefined'){
    const add = {
      'Умная лента':'Smart feed',
      'Обновить подборку':'Refresh feed',
      'Ранжирует алгоритм OKO: вовлечённость и свежесть — как в Instagram, в отличие от Telegram. Реагируй на посты — лента точнее подстроится под тебя.':
        'Ranked by the OKO algorithm: engagement and recency — like Instagram, unlike Telegram. React to posts and the feed tunes to you.',
      'Похоже на то, что ты лайкал':'Similar to what you liked',
      'Похоже на лайкнутое':'Similar to what you liked',
      'Автор, которого ты читаешь':'An author you follow',
      'В тренде':'Trending','растёт':'rising',
      'Популярно сейчас':'Trending now',
      'Подборка пересобрана':'Feed rebuilt',
      'Ты посмотрел всю подборку — нажми «Обновить подборку» сверху':'You have seen the whole feed — tap “Refresh feed” at the top',
      'Твой интерес: Нейросети':'Your interest: AI','Твой интерес: Контент':'Your interest: Content',
      'Твой интерес: Бизнес':'Your interest: Business','Твой интерес: Маркетинг':'Your interest: Marketing',
      'Твой интерес: Игры':'Your interest: Games','Твой интерес: Крипта':'Your interest: Crypto',
      'Ответить':'Reply','Скрыть ответы':'Hide replies','Пока тихо':'No comments yet',
      'Стань первым, кто оставит комментарий':'Be the first to comment',
      'Написать комментарий…':'Write a comment…','Комментарий добавлен':'Comment added',
      'Канал':'Channel','Открыть рекомендации':'Open recommendations',
      'Пока пусто':'Nothing here yet','Тут появятся посты':'Posts will appear here',
      'Мы не нашли свежих постов. Обнови подборку — алгоритм соберёт новую ленту под тебя.':
        'No fresh posts found. Refresh and the algorithm will build a new feed for you.',
      'Подпишись на каналы и авторов — их посты появятся здесь. А пока загляни в рекомендации.':
        'Follow channels and authors — their posts show up here. Meanwhile, check the recommendations.',
    };
    for(const k in add) if(!(k in ST_DICT)) ST_DICT[k] = add[k];
  }
  try{ FA.infoOpen = localStorage.getItem('oko-feed-info') === '1'; }catch(e){}
  faLoadSignals();
  faLoadAuthors();

  /* обогащение composer'а комментариев: аватар автора + плашка «Ответ …» (base.html не трогаем) */
  (function faWireCompose(){
    const compose = document.querySelector('#sheet-comments .cmt-compose');
    if(!compose) return;
    compose.classList.add('fac-compose');
    if(!compose.querySelector('.fac-compose-ava')){
      const me = document.createElement('div');
      me.className = 'fac-ava fac-me fac-compose-ava';
      me.textContent = (typeof PROFILE !== 'undefined' && PROFILE && PROFILE.name) ? PROFILE.name[0] : 'Я';
      compose.insertBefore(me, compose.firstChild);
    }
    if(!document.getElementById('facReplyChip') && compose.parentNode){
      const chip = document.createElement('div');
      chip.id = 'facReplyChip';
      chip.className = 'fac-reply-chip';
      chip.hidden = true;
      chip.innerHTML = I('reply') + '<span>Ответ <b class="fac-rc-name"></b></span>' +
        '<button type="button" class="fac-rc-x" aria-label="Отменить ответ" onclick="faClearReply()">' + I('fa-x') + '</button>';
      compose.parentNode.insertBefore(chip, compose);
    }
  })();
  if('IntersectionObserver' in window){
    FA.io = new IntersectionObserver(es=>{
      es.forEach(e=>{
        const feed = document.getElementById('screen-feed');
        if(e.isIntersecting && feed && feed.classList.contains('active')) faLoadMore();
      });
    }, {rootMargin:'240px'});
  }
  faDoubleTapLike();
  /* если лента уже открыта на рекомендациях — декорировать сразу */
  const feed = document.getElementById('screen-feed');
  if(feed && feed.classList.contains('active') && curFeedKind === 'rec') faDecorate();
})();

/* ============================================================================
   8. REELS VIEWER — иммерсивный вертикальный плеер «Клипы» (Instagram/TikTok)
   Новый ОВЕРЛЕЙ поверх ленты (список ленты НЕ трогаем). Открывается по тапу на
   видео-область карточки. Лайк/коммент/шер/сейв переиспользуют ФУНКЦИИ И СТЕЙТ
   ядра (likePost/openComments/repost/toggleSave) — реакция в клипе отражается на
   карточке ленты и наоборот (общий объект поста). ПЕРФ: только transform/opacity,
   прогресс — CSS-анимация (0 работы на кадр), бренд-движение живёт лишь на активном
   слайде. Всё в try/catch, префикс faReels/FAR.
   ============================================================================ */
const FAR = {
  open:false, idx:0, ids:[], paused:false,
  drag:null,          /* {y0,t0} во время свайпа */
  keyHandler:null,    /* document keydown — вешаем на открытие, снимаем на закрытие */
  wheelLock:0,        /* дебаунс колеса мыши */
  lastTap:0, lastX:0, lastY:0, /* распознавание двойного тапа по слайду */
};

/* бренд-градиенты фона по теме поста — все тёмные (чёрный + лайм-семья) */
const FA_REEL_G = {
  ai:       ['#16240a','#04060a'],
  content:  ['#1c2708','#050703'],
  business: ['#122011','#03060a'],
  marketing:['#231d07','#060404'],
  games:    ['#0d2216','#03070a'],
  crypto:   ['#0a1f28','#04060a'],
};
function faReelsBg(p){
  try{
    const g = FA_REEL_G[p && p.topic] || ['#16240a','#04060a'];
    return `--g1:${g[0]};--g2:${g[1]}`;
  }catch(e){ return '--g1:#16240a;--g2:#04060a'; }
}

/* заголовок «видео»: первое ёмкое предложение подписи (визуальный акцент кадра) */
function faReelsHeadline(p){
  try{
    const t = String((p && p.body) || '').split(/(?<=[.!?:])\s/)[0] || (p && p.body) || '';
    return esc(t.length > 64 ? t.slice(0, 62).trim() + '…' : t);
  }catch(e){ return ''; }
}

/* список видео-постов ленты: media != null, дедуп, в порядке ленты (rec-приоритет) */
function faReelsList(){
  try{
    const seen = {}, out = [];
    /* сначала — как отрисовано в текущей ленте (живой порядок ранжирования) */
    const dom = document.querySelectorAll('#feedList article.post');
    dom.forEach(a=>{
      const pid = faIdOf(a), p = pid != null ? postById(pid) : null;
      if(p && p.media && !seen[p.id]){ seen[p.id] = 1; out.push(p); }
    });
    /* добор из модели (посты вне текущей вкладки/непрорисованные) */
    [...POSTS.rec, ...POSTS.sub].forEach(p=>{
      if(p && p.media && !seen[p.id]){ seen[p.id] = 1; out.push(p); }
    });
    return out;
  }catch(e){ return []; }
}

/* разметка одного слайда */
function faReelsSlideHTML(p){
  try{
    const liked = !!p.liked, saved = !!p.saved, reposted = !!p.reposted;
    const cmt = (typeof faCount === 'function') ? faCount(p) : (Array.isArray(p.comments) ? p.comments.length : 0);
    const badge = (typeof faVerified === 'function') ? faVerified(p.name) : '';
    const topic = (typeof FA_TOPICS !== 'undefined' && FA_TOPICS[p.topic]) ? FA_TOPICS[p.topic] : 'Клип';
    const dur = p.media && /:/.test(String(p.media)) ? esc(p.media) : '';
    const views = (typeof fmtN === 'function') ? fmtN(p.views || 0) : (p.views || 0);
    return (
      `<div class="far-slide" data-pid="${p.id}" style="${faReelsBg(p)}">`+
        `<div class="far-bg"></div>`+
        `<div class="far-motion"></div><div class="far-motion two"></div>`+
        `<div class="far-hero"><span class="far-topic">${I('fire')}${esc(topic)}</span>`+
          `<h2>${faReelsHeadline(p)}</h2></div>`+
        (dur ? `<div class="far-dur">${I('circle-play')}<span>${dur}</span> · <svg class="i far-eye"><use href="#i-eye"/></svg>${views}</div>` : '')+
        `<div class="far-scrim top"></div><div class="far-scrim"></div>`+
        `<button class="far-tap" type="button" aria-label="Пауза/воспроизведение" onclick="faReelsTapZone(event)">`+
          `<span class="far-playbtn">${I('play')}</span></button>`+
        /* правый рельс */
        `<div class="far-rail">`+
          `<button class="far-act far-like${liked?' on':''}" type="button" aria-label="Нравится" onclick="faReelsLike(${p.id},event)">`+
            `<span class="far-ic">${I('heart')}</span><b class="far-n-like">${p.likes||0}</b></button>`+
          `<button class="far-act far-cmt" type="button" aria-label="Комментарии" onclick="faReelsComment(${p.id})">`+
            `<span class="far-ic">${I('comment')}</span><b class="far-n-cmt">${cmt}</b></button>`+
          `<button class="far-act far-share${reposted?' on':''}" type="button" aria-label="Поделиться" onclick="faReelsShare(${p.id})">`+
            `<span class="far-ic">${I('share')}</span><b class="far-n-share">${p.reposts||0}</b></button>`+
          `<button class="far-act far-save${saved?' on':''}" type="button" aria-label="Сохранить" onclick="faReelsSave(${p.id})">`+
            `<span class="far-ic">${I('bookmark')}</span><b>Сейв</b></button>`+
          `<button class="far-act far-more" type="button" aria-label="Ещё" onclick="faReelsMore(${p.id})">`+
            `<span class="far-ic">${I('more')}</span></button>`+
        `</div>`+
        /* нижняя инфо-панель */
        `<div class="far-info">`+
          `<div class="far-author"><div class="far-ava">${esc(p.ava || (p.name ? p.name[0] : '?'))}</div>`+
            `<span class="far-name"><b>${esc(p.name || 'Автор')}</b>${badge}</span>`+
            `<span class="far-sub">${esc(p.sub || '')}</span></div>`+
          `<div class="far-caption" onclick="faReelsCap(this)">${esc(p.body || '')}<span class="far-more-t"> ещё</span></div>`+
          `<div class="far-music">${I('mic')}<span>Озвучка OKO · ${esc(p.name || 'Оригинальный звук')}</span>`+
            `<span class="far-eq"><i></i><i></i><i></i></span></div>`+
        `</div>`+
      `</div>`
    );
  }catch(e){ return ''; }
}

/* сегменты прогресса по числу клипов */
function faReelsBuildSegs(n){
  try{
    const seg = document.getElementById('farSeg'); if(!seg) return;
    let h = '';
    for(let i=0;i<n;i++) h += `<button class="far-sg" type="button" data-i="${i}" onclick="faReelsSetActive(${i})"><i class="far-fill"></i></button>`;
    seg.innerHTML = h;
  }catch(e){}
}

/* открыть плеер начиная с поста pid (или с первого клипа) */
function faReelsOpen(pid){
  try{
    const list = faReelsList();
    if(!list.length){ if(typeof toast === 'function') toast('Пока нет клипов'); return; }
    FAR.ids = list.map(p=>p.id);
    let start = FAR.ids.indexOf(+pid);
    if(start < 0) start = 0;
    const track = document.getElementById('farTrack');
    const wrap = document.getElementById('faReels');
    if(!track || !wrap) return;
    track.innerHTML = list.map(faReelsSlideHTML).join('');
    faReelsBuildSegs(list.length);
    const cnt = document.getElementById('farCount'); if(cnt) cnt.textContent = (start+1) + '/' + list.length;
    wrap.hidden = false; wrap.setAttribute('aria-hidden','false');
    wrap.classList.remove('far-paused'); FAR.paused = false;
    wrap.classList.add('far-in');
    setTimeout(()=>{ try{ wrap.classList.remove('far-in'); }catch(e){} }, 320);
    FAR.open = true;
    document.documentElement.style.overflow = 'hidden';  /* фон не скроллится под плеером */
    faReelsSetActive(start, true);
    faReelsBindKeys();
    /* интеграция с общим стеком навигации: аппаратный/TG «назад» закроет плеер */
    if(typeof nvPush === 'function') try{ nvPush('reels', faReelsClose); }catch(e){}
  }catch(e){}
}
function faReelsOpenFirst(){ try{ const l = faReelsList(); if(l.length) faReelsOpen(l[0].id); else if(typeof toast==='function') toast('Пока нет клипов'); }catch(e){} }

/* активировать слайд idx: двигаем трек (один transform), пересобираем сегменты,
   перезапускаем прогресс-анимацию, снимаем паузу */
function faReelsSetActive(idx, instant){
  try{
    const n = FAR.ids.length; if(!n) return;
    idx = Math.max(0, Math.min(n-1, idx|0));
    FAR.idx = idx;
    const track = document.getElementById('farTrack'), wrap = document.getElementById('faReels');
    if(!track || !wrap) return;
    if(instant){ track.style.transition = 'none'; }
    track.style.transform = 'translate3d(0,' + (-idx*100) + '%,0)';
    if(instant){ void track.offsetWidth; track.style.transition = ''; }
    /* активный слайд — только ему бренд-движение/эквалайзер */
    const slides = track.children;
    for(let i=0;i<slides.length;i++) slides[i].classList.toggle('is-active', i === idx);
    /* сегменты: пройденные — залиты, будущие — пустые, активный — заново анимируем */
    const segs = document.querySelectorAll('#farSeg .far-sg');
    segs.forEach((s,i)=>{
      s.classList.remove('active','done');
      if(i < idx) s.classList.add('done');
      else if(i === idx) s.classList.add('active');
      const f = s.querySelector('.far-fill');
      if(f){ f.style.animation = 'none'; void f.offsetWidth; f.style.animation = ''; }  /* рестарт заливки */
    });
    /* снять паузу на переходе */
    wrap.classList.remove('far-paused'); FAR.paused = false;
    const cnt = document.getElementById('farCount'); if(cnt) cnt.textContent = (idx+1) + '/' + n;
    faReelsSyncCounts(FAR.ids[idx]);
    if(navigator.vibrate) try{ navigator.vibrate(6); }catch(e){}
  }catch(e){}
}
function faReelsNext(){ try{ if(FAR.idx < FAR.ids.length-1) faReelsSetActive(FAR.idx+1); else if(typeof toast==='function') toast('Это последний клип'); }catch(e){} }
function faReelsPrev(){ try{ if(FAR.idx > 0) faReelsSetActive(FAR.idx-1); }catch(e){} }

/* play/pause активного клипа (пауза замораживает прогресс и бренд-движение через CSS) */
function faReelsTogglePlay(){
  try{
    const wrap = document.getElementById('faReels'); if(!wrap) return;
    FAR.paused = !FAR.paused;
    wrap.classList.toggle('far-paused', FAR.paused);
  }catch(e){}
}

/* тап по центру: одиночный — play/pause, двойной — лайк с сердцем (Instagram) */
function faReelsTapZone(ev){
  try{
    /* если это был press-and-hold (пауза-подсмотр) — не переключаем play по клику-хвосту */
    if(FAR.didHold){ FAR.didHold = false; return; }
    const now = Date.now();
    const x = ev && (ev.clientX != null ? ev.clientX : (ev.changedTouches && ev.changedTouches[0] ? ev.changedTouches[0].clientX : 0));
    const y = ev && (ev.clientY != null ? ev.clientY : (ev.changedTouches && ev.changedTouches[0] ? ev.changedTouches[0].clientY : 0));
    if(now - FAR.lastTap < 320 && Math.abs(x-FAR.lastX) < 40 && Math.abs(y-FAR.lastY) < 40){
      FAR.lastTap = 0;
      const pid = FAR.ids[FAR.idx];
      const p = postById(pid);
      if(p && !p.liked && typeof likePost === 'function'){ likePost(pid); faReelsSyncCounts(pid); }
      faReelsHeart(x, y);
      if(navigator.vibrate) try{ navigator.vibrate(12); }catch(e){}
      return;
    }
    FAR.lastTap = now; FAR.lastX = x; FAR.lastY = y;
    /* одиночный тап отрабатываем с задержкой, чтобы не гасить play при дабл-тапе */
    setTimeout(()=>{ try{ if(FAR.lastTap === now) faReelsTogglePlay(); }catch(e){} }, 300);
  }catch(e){}
}
function faReelsHeart(x, y){
  try{
    const slide = document.querySelector('#farTrack .far-slide.is-active'); if(!slide) return;
    const r = slide.getBoundingClientRect();
    const h = document.createElement('span'); h.className = 'far-heart'; h.innerHTML = I('heart');
    h.style.left = Math.round((x != null ? x : r.left + r.width/2) - r.left) + 'px';
    h.style.top  = Math.round((y != null ? y : r.top + r.height/2) - r.top) + 'px';
    slide.appendChild(h);
    setTimeout(()=>{ try{ h.remove(); }catch(e){} }, 800);
  }catch(e){}
}

/* раскрыть/свернуть подпись */
function faReelsCap(el){ try{ if(el) el.classList.toggle('far-cap-open'); }catch(e){} }

/* ---- действия рельса: переиспользуют функции и стейт ленты ---- */
function faReelsLike(pid, ev){
  try{
    if(ev){ ev.stopPropagation(); }
    const p = postById(pid); if(!p) return;
    if(typeof likePost === 'function') likePost(pid);   /* общий стейт → карточка ленты обновится сама */
    /* обновляем кнопку клипа по актуальному объекту поста */
    const slide = document.querySelector('#farTrack .far-slide[data-pid="'+pid+'"]');
    const btn = slide && slide.querySelector('.far-like');
    if(btn){
      btn.classList.toggle('on', !!p.liked);
      const n = btn.querySelector('.far-n-like'); if(n) n.textContent = p.likes || 0;
      btn.classList.remove('far-burst'); void btn.offsetWidth;
      if(p.liked) btn.classList.add('far-burst');
    }
  }catch(e){}
}
function faReelsComment(pid){
  try{ if(typeof openComments === 'function') openComments(pid); }catch(e){}  /* существующая шторка поверх плеера */
}
function faReelsShare(pid){
  try{
    const p = postById(pid); if(!p) return;
    if(typeof repost === 'function') repost(pid);
    const slide = document.querySelector('#farTrack .far-slide[data-pid="'+pid+'"]');
    const btn = slide && slide.querySelector('.far-share');
    if(btn){ btn.classList.toggle('on', !!p.reposted); const n = btn.querySelector('.far-n-share'); if(n) n.textContent = p.reposts || 0; }
  }catch(e){}
}
function faReelsSave(pid){
  try{
    const p = postById(pid); if(!p) return;
    if(typeof toggleSave === 'function') toggleSave(pid);
    const slide = document.querySelector('#farTrack .far-slide[data-pid="'+pid+'"]');
    const btn = slide && slide.querySelector('.far-save');
    if(btn) btn.classList.toggle('on', !!p.saved);
  }catch(e){}
}
function faReelsMore(pid){
  try{ if(typeof openPostMenu === 'function') openPostMenu(pid); }catch(e){}
}

/* синхронизация счётчиков клипа с общим стейтом (лайк/коммент/шер/сейв из ленты) */
function faReelsSyncCounts(pid){
  try{
    if(!FAR.open || pid == null) return;
    const p = postById(pid); if(!p) return;
    const slide = document.querySelector('#farTrack .far-slide[data-pid="'+pid+'"]'); if(!slide) return;
    const like = slide.querySelector('.far-like');
    if(like){ like.classList.toggle('on', !!p.liked); const n = like.querySelector('.far-n-like'); if(n) n.textContent = p.likes || 0; }
    const cmtN = slide.querySelector('.far-n-cmt');
    if(cmtN) cmtN.textContent = (typeof faCount === 'function') ? faCount(p) : (Array.isArray(p.comments) ? p.comments.length : 0);
    const share = slide.querySelector('.far-share');
    if(share){ share.classList.toggle('on', !!p.reposted); const n = share.querySelector('.far-n-share'); if(n) n.textContent = p.reposts || 0; }
    const save = slide.querySelector('.far-save');
    if(save) save.classList.toggle('on', !!p.saved);
  }catch(e){}
}

/* закрытие плеера: чистим слайды (гасит все CSS-анимации), снимаем слушатели/стек */
function faReelsClose(){
  try{
    const wrap = document.getElementById('faReels'); if(!wrap) return;
    wrap.hidden = true; wrap.setAttribute('aria-hidden','true');
    wrap.classList.remove('far-paused','far-in');
    const track = document.getElementById('farTrack'); if(track){ track.innerHTML = ''; track.style.transform = 'translate3d(0,0,0)'; }
    const seg = document.getElementById('farSeg'); if(seg) seg.innerHTML = '';
    FAR.open = false; FAR.paused = false; FAR.drag = null;
    document.documentElement.style.overflow = '';
    faReelsUnbindKeys();
    if(typeof nvPop === 'function') try{ nvPop('reels'); }catch(e){}
  }catch(e){}
}

/* клавиатура: стрелки/space — навигация и пауза; Esc закрывает (если нет navstack) */
function faReelsBindKeys(){
  try{
    if(FAR.keyHandler) return;
    FAR.keyHandler = function(e){
      try{
        if(!FAR.open) return;
        /* не мешаем печатать в шторке комментариев поверх плеера */
        const t = e.target;
        if(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
        const sheet = document.getElementById('sheet-comments');
        if(sheet && sheet.classList.contains('open')) return;
        if(e.key === 'ArrowDown' || e.key === 'j'){ e.preventDefault(); faReelsNext(); }
        else if(e.key === 'ArrowUp' || e.key === 'k'){ e.preventDefault(); faReelsPrev(); }
        else if(e.key === ' '){ e.preventDefault(); faReelsTogglePlay(); }
        else if(e.key === 'Escape' && typeof nvPush !== 'function'){ e.preventDefault(); faReelsClose(); }
      }catch(err){}
    };
    document.addEventListener('keydown', FAR.keyHandler);
  }catch(e){}
}
function faReelsUnbindKeys(){
  try{ if(FAR.keyHandler){ document.removeEventListener('keydown', FAR.keyHandler); FAR.keyHandler = null; } }catch(e){}
}

/* автолистание по завершении прогресс-анимации активного сегмента (без JS-таймеров) */
(function faReelsWireProgress(){
  try{
    const seg = document.getElementById('farSeg'); if(!seg) return;
    seg.addEventListener('animationend', function(e){
      try{
        if(!FAR.open) return;
        if(e.animationName !== 'far-fill') return;
        const li = e.target.closest && e.target.closest('.far-sg');
        if(li && +li.getAttribute('data-i') === FAR.idx){
          if(FAR.idx < FAR.ids.length-1) faReelsNext(); else faReelsClose();  /* конец подборки — выходим */
        }
      }catch(err){}
    });
  }catch(e){}
})();

/* свайпы (touch) + колесо мыши по поверхности плеера */
(function faReelsWireGestures(){
  try{
    const wrap = document.getElementById('faReels'); if(!wrap) return;
    const TH = 56;  /* порог срабатывания, px */

    wrap.addEventListener('touchstart', function(e){
      try{
        if(!FAR.open || !e.touches || !e.touches.length) return;
        /* не перехватываем жесты рельса/инфо/хрома — только «пустое» видео-поле */
        if(e.target.closest('.far-rail,.far-info,.far-top,.far-back')) { FAR.drag = null; return; }
        FAR.drag = {y0:e.touches[0].clientY, t0:Date.now(), moved:0};
        wrap.classList.add('far-drag');
      }catch(err){}
    }, {passive:true});

    wrap.addEventListener('touchmove', function(e){
      try{
        if(!FAR.drag || !e.touches || !e.touches.length) return;
        const dy = e.touches[0].clientY - FAR.drag.y0;
        FAR.drag.moved = dy;
        /* лёгкое сопротивление на краях */
        let d = dy;
        if((FAR.idx === 0 && dy > 0) || (FAR.idx === FAR.ids.length-1 && dy < 0)) d = dy * 0.35;
        const track = document.getElementById('farTrack');
        if(track) track.style.transform = 'translate3d(0,calc(' + (-FAR.idx*100) + '% + ' + Math.round(d) + 'px),0)';
      }catch(err){}
    }, {passive:true});

    wrap.addEventListener('touchend', function(e){
      try{
        if(!FAR.drag) return;
        wrap.classList.remove('far-drag');
        const dy = FAR.drag.moved, dt = Date.now() - FAR.drag.t0;
        const fast = Math.abs(dy) > 24 && dt < 220;
        FAR.drag = null;
        if(dy < -TH || (fast && dy < 0)) faReelsSetActive(FAR.idx+1);
        else if((dy > TH || (fast && dy > 0))){
          if(FAR.idx === 0) faReelsClose();          /* свайп вниз на первом клипе — закрыть */
          else faReelsSetActive(FAR.idx-1);
        }
        else faReelsSetActive(FAR.idx);              /* недотянул — вернуть на место */
      }catch(err){}
    }, {passive:true});

    wrap.addEventListener('wheel', function(e){
      try{
        if(!FAR.open) return;
        if(e.target.closest('.far-info,.far-rail')) return;
        e.preventDefault();
        const now = Date.now();
        if(now - FAR.wheelLock < 500) return;
        if(Math.abs(e.deltaY) < 12) return;
        FAR.wheelLock = now;
        if(e.deltaY > 0) faReelsNext(); else faReelsPrev();
      }catch(err){}
    }, {passive:false});
  }catch(e){}
})();

/* вход в плеер: тап по видео-области карточки ленты (делегат, additive) + кнопка «Клипы» */
(function faReelsWireEntry(){
  try{
    const list = document.getElementById('feedList');
    if(list && !list._faReels){
      list._faReels = 1;
      list.addEventListener('click', function(e){
        try{
          const media = e.target.closest('.media');
          if(!media) return;
          const art = media.closest('article.post'); if(!art) return;
          const pid = faIdOf(art); if(pid == null) return;
          const p = postById(pid);
          if(p && p.media){ e.preventDefault(); e.stopPropagation(); faReelsOpen(pid); }
        }catch(err){}
      });
    }
    /* i18n для EN-режима */
    if(typeof ST_DICT !== 'undefined'){
      const add = {'Клипы':'Reels','Пока нет клипов':'No reels yet','Это последний клип':'That is the last reel','Сейв':'Save','ещё':'more'};
      for(const k in add) if(!(k in ST_DICT)) ST_DICT[k] = add[k];
    }
  }catch(e){}
})();

/* кнопка «Клипы» в шапке умной ленты — вставляется в fa-bar после его отрисовки.
   Оборачиваем faDecorate, чтобы не менять его тело (additive). */
try{
  if(typeof faDecorate === 'function'){
    const _faPrevDecorate = faDecorate;
    faDecorate = function(){
      _faPrevDecorate.apply(this, arguments);
      try{
        const bar = document.querySelector('#feedList .fa-bar');
        if(bar && !bar.querySelector('.fa-clips') && faReelsList().length){
          const b = document.createElement('button');
          b.type = 'button'; b.className = 'fa-clips';
          b.setAttribute('aria-label', 'Открыть клипы');
          b.innerHTML = I('circle-play') + '<span>Клипы</span>';
          b.onclick = faReelsOpenFirst;
          const refresh = bar.querySelector('.fa-refresh');
          if(refresh) bar.insertBefore(b, refresh); else bar.appendChild(b);
        }
      }catch(e){}
    };
  }
}catch(e){}

/* синхронизировать рельс клипа при изменении числа комментариев из шторки
   (faUpdateCardCount вызывается ядром комментариев — дополняем его, не переписывая) */
try{
  if(typeof faUpdateCardCount === 'function'){
    const _faPrevUpdCnt = faUpdateCardCount;
    faUpdateCardCount = function(p){
      _faPrevUpdCnt.apply(this, arguments);
      try{ if(FAR.open && p) faReelsSyncCounts(p.id); }catch(e){}
    };
  }
}catch(e){}

/* ============================================================================
   9. «НОВЫЕ ПОСТЫ» — плавающая пилюля обновления ленты (Instagram/Twitter)
   Пока пользователь листает рекомендации вниз, сверху всплывает лаймовая пилюля
   «N новых постов ↑». Тап — пересобрать подборку (faRefresh уже уводит наверх).
   Живая, «дышащая» лента: сигнал, что контент обновляется в реальном времени.
   ПЕРФ: один лёгкий интервал + rAF-throttle на скролл; работает ТОЛЬКО на вкладке
   рекомендаций активного экрана ленты. i18n — через ST_DICT (число и слово — разными
   текст-узлами, чтобы авто-переводчик (MutationObserver) перевёл слово в EN-режиме). */
(function faNewPostsPill(){
  try{
    /* стрелка вверх для пилюли — в общие defs */
    const defs = document.querySelector('svg defs');
    if(defs && !document.getElementById('i-fa-up')){
      const s = document.createElementNS('http://www.w3.org/2000/svg','symbol');
      s.setAttribute('id','i-fa-up'); s.setAttribute('viewBox','0 0 100 100');
      s.innerHTML = '<polyline points="26 48 50 24 74 48" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/><line x1="50" y1="27" x2="50" y2="78" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>';
      defs.appendChild(s);
    }
    if(typeof ST_DICT !== 'undefined'){
      const add = {'новый пост':'new post','новых поста':'new posts','новых постов':'new posts'};
      for(const k in add) if(!(k in ST_DICT)) ST_DICT[k] = add[k];
    }

    FA.newPosts = 0;
    let pill = null;

    function ensure(){
      if(pill) return pill;
      pill = document.createElement('button');
      pill.type = 'button'; pill.className = 'fa-newpill';
      pill.setAttribute('aria-live','polite');
      pill.setAttribute('aria-label','Показать новые посты');
      pill.addEventListener('click', onTap);
      document.body.appendChild(pill);
      return pill;
    }
    function word(n){
      return (typeof faPlural === 'function')
        ? faPlural(n, 'новый пост', 'новых поста', 'новых постов')
        : 'новых постов';
    }
    function show(){
      const p = ensure();
      /* число и слово — отдельными узлами: число не трогаем, слово переведётся авто-переводчиком */
      p.innerHTML = `<svg class="i fa-np-ic"><use href="#i-fa-up"/></svg><span class="fa-np-n">${FA.newPosts}</span> <span>${word(FA.newPosts)}</span>`;
      requestAnimationFrame(()=>{ try{ p.classList.add('show'); }catch(e){} });
    }
    function hide(){ if(pill) pill.classList.remove('show'); }
    function onTap(){
      hide(); FA.newPosts = 0;
      if(typeof faRefresh === 'function') faRefresh();  /* пересобирает подборку + уводит наверх */
    }
    function feedActive(){
      const f = document.getElementById('screen-feed');
      const kindOk = (typeof curFeedKind === 'undefined') || curFeedKind === 'rec';
      return !!(f && f.classList.contains('active') && kindOk);
    }

    /* один негромкий интервал: копит «новые» посты, пока пользователь ушёл вниз по ленте */
    setInterval(function(){
      try{
        const m = document.querySelector('main');
        if(!feedActive() || FA.loading){ hide(); return; }
        if(!m || m.scrollTop < 520){ if(FA.newPosts === 0) hide(); return; }
        FA.newPosts = Math.min(FA.newPosts + 1 + Math.floor(Math.random()*2), 24);
        show();
      }catch(e){}
    }, 13000);

    /* вернулся к самому верху — «новых» больше нет, прячем */
    const m = document.querySelector('main');
    if(m){
      let raf = 0;
      m.addEventListener('scroll', function(){
        if(raf) return;
        raf = requestAnimationFrame(function(){
          raf = 0;
          try{ if(m.scrollTop < 120){ FA.newPosts = 0; hide(); } }catch(e){}
        });
      }, {passive:true});
    }

    /* явное «Обновить подборку» тоже гасит счётчик и пилюлю */
    if(typeof faRefresh === 'function'){
      const _faPrevRefresh = faRefresh;
      faRefresh = function(){ FA.newPosts = 0; hide(); return _faPrevRefresh.apply(this, arguments); };
    }
  }catch(e){}
})();

/* ============================================================================
   10. REELS: ЗАЖАТЬ И ДЕРЖАТЬ = ПАУЗА-ПОДСМОТР (TikTok/Instagram press-and-hold)
   Зажал палец/курсор на видео-поле → прогресс и бренд-движение замирают, хром плавно
   уходит (чистый кадр). Отпустил → всё возвращается. Быстрый тап (< порога) НЕ триггерит
   удержание — обычные одиночный/двойной тап работают как прежде. Движение отменяет
   удержание, чтобы не мешать свайпу листания. Всё в try/catch, additive, без сети.
   ============================================================================ */
(function faReelsHold(){
  try{
    const wrap = document.getElementById('faReels'); if(!wrap) return;
    let timer = 0, sx = 0, sy = 0, armed = false;
    const HOLD = 250, MOVE = 12;

    function commentsOpen(){
      const s = document.getElementById('sheet-comments');
      return !!(s && s.classList.contains('open'));
    }
    function start(x, y, target){
      if(!FAR.open || commentsOpen()) return;
      if(!target || !target.closest || !target.closest('.far-tap')) return;  /* только центральное поле */
      sx = x; sy = y; armed = true;
      if(timer) clearTimeout(timer);
      timer = setTimeout(function(){
        try{
          if(!armed || !FAR.open) return;
          FAR.didHold = true;                 /* хвостовой click от faReelsTapZone гасится */
          wrap.classList.add('far-hold');
          if(navigator.vibrate) try{ navigator.vibrate(8); }catch(e){}
        }catch(e){}
      }, HOLD);
    }
    function move(x, y){
      if(!armed) return;
      if(Math.abs(x - sx) > MOVE || Math.abs(y - sy) > MOVE) cancel();
    }
    function cancel(){
      armed = false;
      if(timer){ clearTimeout(timer); timer = 0; }
      try{ if(wrap.classList.contains('far-hold')) wrap.classList.remove('far-hold'); }catch(e){}
    }

    if(window.PointerEvent){
      wrap.addEventListener('pointerdown', e=>{ try{ if(e.pointerType === 'mouse' && e.button !== 0) return; start(e.clientX, e.clientY, e.target); }catch(err){} }, {passive:true});
      wrap.addEventListener('pointermove', e=>{ try{ move(e.clientX, e.clientY); }catch(err){} }, {passive:true});
      ['pointerup','pointercancel','pointerleave'].forEach(t=> wrap.addEventListener(t, cancel, {passive:true}));
    }else{
      wrap.addEventListener('touchstart', e=>{ try{ const t = e.touches && e.touches[0]; if(t) start(t.clientX, t.clientY, e.target); }catch(err){} }, {passive:true});
      wrap.addEventListener('touchmove', e=>{ try{ const t = e.touches && e.touches[0]; if(t) move(t.clientX, t.clientY); }catch(err){} }, {passive:true});
      ['touchend','touchcancel'].forEach(t=> wrap.addEventListener(t, cancel, {passive:true}));
    }
  }catch(e){}
})();
