/* ================= FEED-ALGO: алгоритмы рекомендаций OKO ================= */
/* Скоринг как у больших соцсетей: интересы + свежесть + вовлечённость +
   персональные сигналы + сессионный шум. Реклама — вставкой каждые 4-5 позиций. */

const FA_TOPICS = {ai:'Нейросети', content:'Контент', business:'Бизнес', marketing:'Маркетинг', games:'Игры', crypto:'Крипта'};
const FA_RU2ID = {'нейросети':'ai','ии':'ai','контент':'content','reels':'content','рилс':'content',
  'бизнес':'business','маркетинг':'marketing','игры':'games','крипта':'crypto','ton':'crypto','тон':'crypto'};

const FA = {
  seed: ((Date.now() % 2147483647) ^ 0x9AFF00) >>> 0, /* сессионный seed шума */
  signals: {},      /* {topic: вес} — накопленные реакции пользователя */
  page: 0,          /* сколько партий бесконечной ленты подгружено */
  maxPages: 8,
  loading: false,
  genId: 778000,    /* id генерируемых постов (ads занимает 9000+, пул — 777xxx) */
  usedCombos: {},   /* защита от повторов шаблон+автор в генераторе */
  io: null,
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

/* ---------- интересы из регистрации ---------- */
function faInterests(){
  const out = new Set();
  try{
    const reg = JSON.parse(localStorage.getItem('oko-registration') || 'null');
    const raw = (reg && Array.isArray(reg.interests)) ? reg.interests : [];
    raw.forEach(x=>{
      const k = String(x).toLowerCase().trim();
      if(FA_TOPICS[k]) out.add(k); else if(FA_RU2ID[k]) out.add(FA_RU2ID[k]);
    });
  }catch(e){}
  return out;
}

/* ---------- детерминированный шум: seed сессии + id поста ---------- */
function faRand(id){
  let h = (FA.seed + (Math.abs(+id)||0) * 2654435761) >>> 0;
  h = Math.imul(h ^ (h >>> 15), h | 1);
  h ^= h + Math.imul(h ^ (h >>> 7), h | 61);
  return ((h ^ (h >>> 14)) >>> 0) / 4294967296;
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
if(typeof openComments === 'function'){
  const _faPrevOpenComments = openComments;
  openComments = function(id){
    const p = postById(id);
    _faPrevOpenComments(id);
    if(p && p.topic) faSignal(p.topic, 0.5);
  };
}

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

  /* кнопка-чип «Обновить подборку» сверху */
  if(!list.querySelector('.fa-toolbar')){
    list.insertAdjacentHTML('afterbegin',
      `<div class="fa-toolbar"><button class="fa-refresh" onclick="faRefresh()"><svg class="i"><use href="#i-fa-refresh"/></svg><span>Обновить подборку</span></button><span class="fa-algo-note">умная лента</span></div>`);
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

  /* чип «почему показано» + галочка verified — DOM-проходом, без дублей */
  list.querySelectorAll('article.post').forEach(art=>{
    const p = postById(faIdOf(art)); if(!p) return;
    const head = art.querySelector('.head');
    if(head && !art.querySelector('.fa-why')){
      const w = faWhy(p);
      head.insertAdjacentHTML('afterend', `<div class="fa-why ${w.cls}">${I(w.ico)}<span>${w.txt}</span></div>`);
    }
    const nameEl = art.querySelector('.head .name');
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

const _faPrevRenderFeed = renderFeed;
renderFeed = function(kind){
  kind = kind || curFeedKind || 'sub';
  _faPrevRenderFeed(kind);           /* «Подписки» не трогаем — декор только для rec */
  if(kind === 'rec') faDecorate();
};

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

/* ================= САМОИНИЦИАЛИЗАЦИЯ ================= */
(function faInit(){
  /* svg-иконка «обновить» в общие defs */
  const defs = document.querySelector('svg defs');
  if(defs && !document.getElementById('i-fa-refresh')){
    const s = document.createElementNS('http://www.w3.org/2000/svg','symbol');
    s.setAttribute('id','i-fa-refresh'); s.setAttribute('viewBox','0 0 100 100');
    s.innerHTML = '<path d="M84 50a34 34 0 1 1-10-24" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/><polyline points="76 10 76 27 59 26" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>';
    defs.appendChild(s);
  }
  faLoadSignals();
  if('IntersectionObserver' in window){
    FA.io = new IntersectionObserver(es=>{
      es.forEach(e=>{
        const feed = document.getElementById('screen-feed');
        if(e.isIntersecting && feed && feed.classList.contains('active')) faLoadMore();
      });
    }, {rootMargin:'240px'});
  }
  /* если лента уже открыта на рекомендациях — декорировать сразу */
  const feed = document.getElementById('screen-feed');
  if(feed && feed.classList.contains('active') && curFeedKind === 'rec') faDecorate();
})();
