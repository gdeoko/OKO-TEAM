/* ================= DEMO-CONTENT: живое наполнение OKO ================= */
/* Диалоги, каналы, сторис, посты и уведомления, чтобы приложение выглядело
   населённым. CHATS/POSTS/STORIES/NOTIFS ядром НЕ персистятся, поэтому пуш
   выполняется при каждой загрузке; от двойного пуша в одной сессии защищает
   проверка по id (CHATS c.id===9001). Чаты — id 9001..9008 (market-pro
   занимает 9101+, ads-посты 9000+ в другом пространстве POSTS). */

const DC_CHATS = [
  {id:9001, ava:'МВ', name:'Марк Волков', kind:'direct', nick:'markvolkov', kindIcon:null,
   preview:'Оплатил через OKO, удобно вышло. Жду черновик!', time:'14:21', unread:2, online:true,
   msgs:[
     {in:1, t:'вчера', kind:'text', body:'Привет! Нашёл тебя на бирже OKO. Нужен монтаж шести Reels для сети кофеен: исходники уже сняты, хронометраж 30–40 секунд каждый. Возьмёшься на этой неделе?'},
     {in:0, t:'вчера', kind:'text', body:'Привет, Марк! Возьмусь. Шесть роликов с караоке-субтитрами, цветокором и звуковым дизайном — 4 800 ₽ пакетом, срок три дня. Первый черновик пришлю завтра к вечеру.'},
     {in:1, t:'вчера', kind:'voice', dur:'0:42', seed:5},
     {in:1, t:'вчера', kind:'photo'},
     {in:1, t:'вчера', kind:'text', body:'Это референс по стилю: динамика как здесь, но цвета теплее — под интерьер кофейни. И логотип в финальном кадре, пожалуйста.'},
     {in:0, t:'13:58', kind:'text', body:'Принял, референс отличный. Условия в силе: 4 800 ₽, сдача в четверг. Счёт выставил прямо в чате — оплатить можно из кошелька OKO в один тап.'},
     {in:1, t:'14:20', kind:'money', amount:'4 800'},
     {in:1, t:'14:21', kind:'text', body:'Оплатил через OKO, удобно вышло. Жду черновик!', reacts:{fire:1}},
   ]},
  {id:9002, ava:'АК', name:'Алина Крид', kind:'direct', nick:'alinakrid', kindIcon:null,
   preview:'Опрос', time:'вчера', unread:0, online:true,
   msgs:[
     {in:1, t:'вчера', kind:'text', body:'Слушай, идея для твоей кофейни: серия «бариста отвечает» — вертикалки по 20 секунд, вопросы берём прямо из комментариев. Такой формат сейчас отлично держит досмотры.'},
     {in:0, t:'вчера', kind:'text', body:'Нравится. Я бы добавил второй формат — бэкстейдж обжарки с закадровым текстом. Чередуем: два экспертных, один атмосферный.'},
     {in:1, t:'вчера', kind:'text', body:'Да, микс форматов и по метрикам живее. Давай решим, с чего стартуем — закинула опрос.', reacts:{thumb:1}},
     {in:1, t:'вчера', kind:'poll', q:'С какого формата стартуем?', opts:['«Бариста отвечает»','Бэкстейдж обжарки','Reels с трендовым звуком'], votes:[5,3,4], voted:0},
   ]},
  {id:9003, ava:'ОК', name:'OKO Креаторы', kind:'group', members:12, kindIcon:'users',
   preview:'Игорь: собрал первый черновик, вечером покажу', time:'15:47', unread:4, online:true,
   msgs:[
     {kind:'sys', body:'12 участников · нейросети и контент'},
     {in:1, who:'Игорь', t:'12:02', kind:'text', body:'Кто уже пробовал новые видеомодели для B-roll? Хочу собрать ролик целиком из генераций, без стоков.'},
     {in:1, who:'Настя', t:'12:05', kind:'text', body:'Пробовала на прошлой неделе. Статика — отлично, длинные проезды камеры пока разваливаются. Держи планы по 2–3 секунды и склеивай чаще.', reacts:{thumb:3}},
     {in:1, who:'Лера', t:'12:11', kind:'text', body:'Добавлю: если в промпте одинаково описывать свет и палитру, серия кадров смотрится как один сет. Экономит цветокор.'},
     {in:0, t:'12:24', kind:'text', body:'Подтверждаю про короткие планы. Я так собрал интро для урока академии — девять генераций, склейка под бит, никто не заметил, что это не съёмка.', reacts:{fire:5, wow:2}},
     {in:1, who:'Тимур', t:'12:26', kind:'text', body:'Скинь потом сравнение с обычным стоком — интересно по деньгам и времени.'},
     {in:1, who:'Настя', t:'12:31', kind:'text', body:'И меня добавьте в рассылку сравнения. Кстати, кто идёт на разбор клуба в четверг?'},
     {in:1, who:'Игорь', t:'15:47', kind:'text', body:'Собрал первый черновик, вечером покажу тут. Спасибо за наводки!', reacts:{heart:2}},
   ]},
  {id:9004, ava:'МР', name:'Монтажёры RU', kind:'group', members:340, kindIcon:'users',
   preview:'transitions-pack-v3.zip', time:'11:32', unread:0, online:false,
   msgs:[
     {kind:'sys', body:'340 участников · монтаж и моушн-дизайн'},
     {in:1, who:'Паша', t:'10:44', kind:'text', body:'Народ, как делаете переход «через объект», чтобы не было рывка на стыке? Маска дрожит на быстрых панорамах.'},
     {in:1, who:'Оля', t:'10:51', kind:'text', body:'Стабилизируй оба клипа до маски, а не после. И моушн-блюр добавляй последним слоем — стык съедается полностью.', reacts:{thumb:4}},
     {in:0, t:'11:03', kind:'text', body:'Ещё помогает резать на пике движения: глаз в этот момент не успевает считать кадр. Я так прячу даже грубые маски.', reacts:{fire:2}},
     {in:1, who:'Паша', t:'11:30', kind:'text', body:'Заработало, спасибо! Закинул свой пак переходов — пользуйтесь.'},
     {in:1, who:'Паша', t:'11:32', kind:'file', fname:'transitions-pack-v3.zip', fsize:'18.4 МБ'},
   ]},
  {id:9005, avaIcon:'logo', name:'OKO Новости', kind:'channel', nick:'okonews', subs:'48.2к',
   writeAll:false, kindIcon:'megaphone', pinned:true,
   preview:'Игры уже в мини-аппах: рулетка и «Дорога»', time:'13:05', unread:1, online:false,
   msgs:[
     {in:1, t:'13 июля', kind:'text', body:'Кошелёк OKO запущен. Лицевой счёт, пополнение, переводы прямо в чатах и оплата услуг биржи — всё внутри приложения, без сторонних сервисов. История операций — в разделе «Кошелёк».', reacts:{fire:96}},
     {in:1, t:'14 июля', kind:'text', body:'Академия OKO открыта. Первые курсы по контенту и нейросетям, тест после каждого урока и именной сертификат с печатью в финале. Учиться можно с телефона, прогресс сохраняется автоматически.', reacts:{heart:143}},
     {in:1, t:'вчера', kind:'text', body:'Обновили ленту: алгоритм рекомендаций учитывает интересы из регистрации и твои реакции. Чем активнее читаешь — тем точнее подборка. Кнопка «Пересобрать» — в шапке ленты.'},
     {in:1, t:'13:05', kind:'text', body:'Игры уже в мини-аппах: рулетка и «Дорога». Играем на внутренний баланс кошелька, турнирная таблица — на подходе. Заходи в раздел «Мини-аппы».', reacts:{wow:38}},
   ]},
  {id:9006, ava:'НД', name:'Нейросети Daily', kind:'channel', nick:'aidaily', subs:'21.7к',
   writeAll:false, kindIcon:'megaphone', preview:'Дайджест: локальные модели догоняют облако', time:'09:40', unread:0, online:false,
   msgs:[
     {in:1, t:'13 июля', kind:'text', body:'Дайджест дня. Видеомодели научились держать персонажа между кадрами — серийный контент без пересъёмок стал реальностью. Тесты показывают стабильность на роликах до минуты.'},
     {in:1, t:'14 июля', kind:'text', body:'Дайджест дня. Голосовые модели теперь передают интонацию и паузы почти неотличимо от диктора. Для озвучки уроков и рекламы это минус целая статья расходов.', reacts:{fire:57}},
     {in:1, t:'вчера', kind:'text', body:'Дайджест дня. Агентные пайплайны собирают ролик от сценария до монтажа за один прогон. Ручной труд смещается в контроль качества — и это главный навык года.'},
     {in:1, t:'09:40', kind:'text', body:'Дайджест дня. Локальные модели догоняют облако: субтитры и черновой перевод на ноутбуке уже быстрее, чем через API. Экономика потокового контента меняется на глазах.'},
   ]},
  {id:9007, ava:'БО', name:'Бизнес в OKO', kind:'group', members:2300, kindIcon:'users',
   preview:'Модератор: комиссия только с закрытой сделки', time:'вчера', unread:0, online:true,
   msgs:[
     {kind:'sys', body:'Группа предпринимателей OKO · 2 300 участников'},
     {in:1, who:'Бизнес в OKO', t:'12 июля', kind:'text', body:'Анонс недели: в четверг открытый разбор «Первые заказы на бирже OKO за 7 дней» — профиль, портфолио, отклики, цены. Вопросы собираем в этой ветке.', reacts:{fire:21}},
     {in:1, who:'Кирилл', t:'вчера', kind:'text', body:'Вопрос: беру заказы на монтаж как самозанятый. Какая комиссия у биржи и когда она списывается?'},
     {in:1, who:'Модератор', t:'вчера', kind:'text', body:'Комиссия 10% и только с закрытой сделки: пока заказ в работе, деньги лежат на холде кошелька. Отменился заказ — вернётся вся сумма.', reacts:{thumb:6}},
     {in:1, who:'Кирилл', t:'вчера', kind:'text', body:'Понял, спасибо. Тогда переношу все сделки из личных переписок сюда — с холдом спокойнее.'},
   ]},
];

/* Поддержка OKO — только если её ещё нет в CHATS (в базе есть, id:1) */
const DC_SUPPORT = {id:9008, avaIcon:'logo', name:'Поддержка OKO', kind:'direct', nick:'okohelp', kindIcon:null,
  preview:'Чем помочь?', time:'12:40', unread:0, online:true,
  msgs:[{in:1, t:'12:40', kind:'text', body:'Привет! Я ИИ-поддержка OKO. Отвечу на вопросы о приложении, а деньги и возвраты передам человеку.'}]};

const DC_STORIES = [
  {avaIcon:'logo', name:'OKO Team', text:'Новая сборка уже в приложении: кошелёк, академия с сертификатами и игры. Обнови вкладку и посмотри.', bg:'linear-gradient(155deg,#131f04 0%,#060606 55%,#0e1a03 100%)'},
  {ava:'МВ', name:'Марк Волков', text:'Забрал шесть роликов для кофейни за три дня. Заказ, правки и оплата — всё внутри OKO.', bg:'linear-gradient(160deg,#0a1a10 0%,#050505 60%,#08240e 100%)'},
  {ava:'АК', name:'Алина Крид', text:'Тестирую три формата Reels на этой неделе. Цифры и выводы — здесь в пятницу.', bg:'linear-gradient(150deg,#151f08 0%,#070707 55%,#0c1f14 100%)'},
  {ava:'КЛ', name:'Клуб OKO', text:'В четверг открытый разбор: первые заказы на бирже OKO за неделю. Вход свободный, вопросы — в сообщество.', bg:'linear-gradient(165deg,#0d2003 0%,#060606 50%,#141f05 100%)'},
];

const DC_POSTS = [
  {id:9101, ava:'O', name:'OKO Team', sub:'канал · 48.2к',
   body:'Академия OKO открыта: курсы по контенту, нейросетям и продвижению. После каждого урока — тест, в конце курса — именной сертификат с печатью, который виден в профиле. Первые два курса бесплатны для всех до конца месяца.',
   media:'1:04', likes:326, views:19400, liked:false, saved:false, reposts:41,
   comments:[{a:'МВ', n:'Марк Волков', t:'Прошёл первый урок — подача отличная'},{a:'АК', n:'Алина Крид', t:'Сертификаты с печатью — сильный ход'}]},
  {id:9102, ava:'МВ', name:'Марк Волков', sub:'монтаж · 3.4к',
   body:'Кейс: шесть Reels для сети кофеен за три дня. Формула — хук в первые две секунды, склейка на пике движения, караоке-субтитры и звуковой дизайн под каждый переход. Итог: средний досмотр 68%, два ролика ушли в рекомендации.',
   media:'0:47', likes:118, views:6200, liked:false, saved:false, reposts:14,
   comments:[{a:'О', n:'Оля', t:'Досмотр 68% на локальном бизнесе — очень достойно'}]},
  {id:9103, ava:'АК', name:'Алина Крид', sub:'SMM · 5.9к',
   body:'Разбор алгоритмов в пяти пунктах: первые три секунды решают всё; досмотры важнее лайков; комментарии-вопросы разгоняют охват; стабильность выхода сильнее «вирусных» всплесков; один формат — одна метрика. Сохраняй, пригодится при планировании недели.',
   media:null, likes:245, views:11800, liked:false, saved:false, reposts:52,
   comments:[{a:'И', n:'Игорь', t:'Пункт про досмотры — золото'},{a:'Т', n:'Тимур', t:'Забрал в закладки, спасибо'}]},
  {id:9104, ava:'КЛ', name:'Клуб OKO', sub:'сообщество · 12.4к',
   body:'В четверг открытый разбор в клубе: как получить первые заказы на бирже OKO за неделю — профиль, портфолио, отклики, цены. Приходи с вопросами, самые сильные кейсы разберём в прямом эфире. Вход свободный для участников приложения.',
   media:null, likes:97, views:5400, liked:false, saved:false, reposts:23,
   comments:[{a:'Н', n:'Настя', t:'Буду, тема — боль'}]},
];

const DC_NOTIFS = [
  {ic:'user',    who:'Марк Волков', t:'подписался на твои обновления', time:'4 мин',  g:'Сегодня', unread:true, act:()=>{ showTab('feed'); }},
  {ic:'comment', who:'Алина Крид',  t:'прокомментировала кейс: «Забираю формулу хука себе»', time:'19 мин', g:'Сегодня', unread:true, act:()=>{ showTab('feed'); }},
  {ic:'money',   who:'Партнёрка',   t:'начисление +$24.90 за оплату PRO по твоей ссылке', time:'27 мин', g:'Сегодня', unread:true, act:()=>{ showTab('partner'); }},
];

/* ---------- закреплённые чаты: сортировка + иконка булавки ---------- */
function dcPatchChatList(){
  if(typeof renderChatList !== 'function' || renderChatList._dcPatched) return;
  const _dcPrevRenderChatList = renderChatList;
  renderChatList = function(filter=''){
    try{ /* живой чат всегда первым, затем закреплённые, остальные — как были */
      CHATS.sort((a,b)=>((b.id==='live'?1:0)-(a.id==='live'?1:0)) || ((b.pinned?1:0)-(a.pinned?1:0)));
    }catch(e){}
    _dcPrevRenderChatList(filter);
    try{
      CHATS.filter(c=>c.pinned).forEach(c=>{
        const t = document.querySelector('#chatList .chat-item[onclick="openConv('+c.id+')"] .time');
        if(t && !t.querySelector('.dc-pin'))
          t.insertAdjacentHTML('afterbegin','<span class="dc-pin" style="display:inline-flex;align-items:center;margin-right:5px;color:var(--lime)">'+I('pin')+'</span>');
      });
    }catch(e){}
  };
  renderChatList._dcPatched = true;
}

/* ---------- сторис с градиент-фоном бренда (поле bg) ---------- */
function dcPatchStory(){
  if(typeof showStory !== 'function' || showStory._dcPatched) return;
  const _dcPrevShowStory = showStory;
  showStory = function(){
    _dcPrevShowStory();
    try{
      const st = STORIES[curStory];
      const card = document.getElementById('svCard');
      if(!card) return;
      if(st && st.bg && !st.src){
        card.style.background = st.bg;
        card.style.borderRadius = '20px';
        card.style.border = '1px solid rgba(154,255,0,.18)';
        card.style.padding = '38px 24px';
      } else {
        card.style.background = ''; card.style.borderRadius = '';
        card.style.border = ''; card.style.padding = '';
      }
    }catch(e){}
  };
  showStory._dcPatched = true;
}

/* ---------- наполнение (при каждой загрузке; защита — по id 9001) ---------- */
function dcSeed(){
  if(typeof CHATS === 'undefined' || CHATS.find(c=>c.id===9001)) return false;

  /* чаты — сразу после живого чата, чтобы список выглядел свежим */
  const at = Math.min(1, CHATS.length);
  CHATS.splice(at, 0, ...DC_CHATS);
  if(!CHATS.some(c=>c.name==='Поддержка OKO')) CHATS.push(DC_SUPPORT);

  /* сторис — в общий ряд после существующих */
  if(typeof STORIES !== 'undefined' && !STORIES.some(s=>s.name==='OKO Team'))
    STORIES.push(...DC_STORIES);

  /* лента «Подписки» — свежие посты сверху */
  if(typeof POSTS !== 'undefined' && POSTS.sub && !POSTS.sub.some(p=>p.id===9101))
    POSTS.sub.unshift(...DC_POSTS);

  /* уведомления — непрочитанные, в начало */
  if(typeof NOTIFS !== 'undefined' && !NOTIFS.some(n=>n.who==='Марк Волков'))
    NOTIFS.unshift(...DC_NOTIFS);

  return true;
}

function dcRenderAll(){
  try{
    if(typeof renderChatList === 'function' && document.getElementById('chatList')){
      const s = document.getElementById('chatSearch');
      renderChatList(s ? s.value : '');
    }
  }catch(e){}
  try{ if(typeof renderFolders === 'function' && document.getElementById('folders')) renderFolders(); }catch(e){}
  try{ if(typeof renderStories === 'function' && document.getElementById('storiesRow')) renderStories(); }catch(e){}
  try{ if(typeof renderFeed === 'function' && document.getElementById('feedList')) renderFeed(typeof curFeedKind !== 'undefined' ? curFeedKind : 'sub'); }catch(e){}
  try{ if(typeof updateNotifDot === 'function') updateNotifDot(); }catch(e){}
}

/* ---------- самоинициализация ---------- */
(function dcInit(){
  try{
    dcPatchChatList();
    dcPatchStory();
    if(dcSeed()) dcRenderAll();
  }catch(e){ console.warn('demo-content init:', e); }
})();
