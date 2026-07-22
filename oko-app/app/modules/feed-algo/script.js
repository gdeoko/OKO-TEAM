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
  return Math.max((Date.now() - p.ts) / 36e5, 0.5);
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
  let s = _faPrevFeedScore(p);              /* базовый скор ядра */
  if(p.promoted) s -= 1e6;                  /* снимаем «всегда топ-1»: позицию рекламы задаёт вставка */
  const ints = faInterests();
  if(p.topic && ints.has(p.topic)) s += 420;               /* сильный буст интереса */
  const age = p.ts ? (Date.now() - p.ts)/36e5 : (p.promoted ? 2 : 96);
  s *= 0.35 + 0.65*Math.exp(-age/42);                      /* свежесть: декей ~2 суток */
  const er = (p.likes*2 + p.comments.length*4 + (p.reposts||0)*3) / Math.max(p.views||1, 1);
  s += Math.min(er, 0.2) * 2400;                           /* вовлечённость на просмотр */
  s += Math.min(FA.signals[p.topic]||0, 12) * 38;          /* «похоже на то, что ты лайкал» */
  if(p.promoted) s += 90;                                  /* реклама чуть выше органики */
  s += (faRand(p.id) - 0.5) * 130;                         /* сессионный шум — лента «дышит» */
  s -= (p.faPage||0) * 1e4;                                /* подгруженные партии — ниже */
  return s;
};

/* ================= 3. ПЕРСОНАЛЬНЫЕ СИГНАЛЫ (патчи реакций) ================= */
if(typeof likePost === 'function'){
  const _faPrevLikePost = likePost;
  likePost = function(id){
    const p = postById(id); const was = p ? !!p.liked : false;
    _faPrevLikePost(id);
    if(p && p.topic) faSignal(p.topic, (p.liked && !was) ? 2 : ((!p.liked && was) ? -2 : 0));
  };
}
if(typeof repost === 'function'){
  const _faPrevRepost = repost;
  repost = function(id){
    const p = postById(id); const was = p ? !!p.reposted : false;
    _faPrevRepost(id);
    if(p && p.topic) faSignal(p.topic, (p.reposted && !was) ? 3 : ((!p.reposted && was) ? -3 : 0));
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
function faWhy(p){
  if(p.promoted) return {cls:'ad', ico:'megaphone', txt:'Реклама'};
  const ints = faInterests();
  if(p.topic && ints.has(p.topic)) return {cls:'int', ico:'star', txt:'Твой интерес: ' + FA_TOPICS[p.topic]};
  if(p.topic && (FA.signals[p.topic]||0) >= 2) return {cls:'like', ico:'heart', txt:'Похоже на то, что ты лайкал'};
  return {cls:'hot', ico:'fire', txt:'Популярно сейчас'};
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

  /* реклама: вынуть из органики и вставить каждые 4-5 позиций (первая — не топ-1) */
  const arts = [...list.querySelectorAll('article.post')];
  const ads = [], org = [];
  arts.forEach(a=>{ const p = postById(faIdOf(a)); (p && p.promoted ? ads : org).push(a); });
  if(ads.length && arts.length > 3){
    const merged = org.slice(); let pos = 2;
    ads.forEach((ad,i)=>{
      merged.splice(Math.min(pos, merged.length), 0, ad);
      pos += 5 + (faRand(9100 + i) < 0.5 ? 0 : 1);
    });
    merged.forEach(el=>list.appendChild(el));
  }

  /* метки «Канал»/«В тренде»/«Реклама» + чип «почему показано» + галочка verified — без дублей */
  list.querySelectorAll('article.post').forEach(art=>{
    const p = postById(faIdOf(art)); if(!p) return;
    const head = art.querySelector('.head');
    const nameEl = art.querySelector('.head .name');
    /* у рекламы уже есть бейдж «Реклама», у топ-поста — «В тренде» (ядро) */
    let nameChip = nameEl && nameEl.querySelector('.chip');
    const w = faWhy(p);
    /* «Канал» — информ-метка для органических каналов без своего чипа и без персонального сигнала
       (заменяет собой безликое «Популярно», а не дублирует его) */
    if(nameEl && !nameChip && !p.promoted && w.cls === 'hot' && /канал/i.test(p.sub || '')){
      nameEl.insertAdjacentHTML('beforeend', ' <span class="chip fa-chan">Канал</span>');
      nameChip = nameEl.querySelector('.fa-chan');
    }
    /* второй чип «почему» был бы дублем-шумом при наличии метки → показываем только осмысленный */
    if(head && !art.querySelector('.fa-why') && !p.promoted){
      if(!(w.cls === 'hot' && nameChip)){
        head.insertAdjacentHTML('afterend', `<div class="fa-why ${w.cls}">${I(w.ico)}<span>${w.txt}</span></div>`);
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
  FA.seed = (Math.random() * 4294967295) >>> 0;   /* новый шум */
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
  /* i18n: чтобы EN-режим не оставлял русские строки шапки (авто-переводчик по ST_DICT) */
  if(typeof ST_DICT !== 'undefined'){
    const add = {
      'Умная лента':'Smart feed',
      'Обновить подборку':'Refresh feed',
      'Ранжирует алгоритм OKO: вовлечённость и свежесть — как в Instagram, в отличие от Telegram. Реагируй на посты — лента точнее подстроится под тебя.':
        'Ranked by the OKO algorithm: engagement and recency — like Instagram, unlike Telegram. React to posts and the feed tunes to you.',
      'Похоже на то, что ты лайкал':'Similar to what you liked',
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
