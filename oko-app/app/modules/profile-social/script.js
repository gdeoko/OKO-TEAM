/* ================= PROFILE-SOCIAL (ps-): чужие профили, подписки, соцграф ================= */
/* Fullscreen-профиль любого автора (#psView): аватар, имя + verified, ник, био,
   статистика, Подписаться/Отписаться (персист oko-social), Написать (личный чат),
   лента постов автора. Точки входа: имя/аватар в ленте (делегирование на #feedList),
   аватар в шапке конва (кроме своих/каналов), автор в глобальном поиске.
   Подписки поднимают посты автора выше во вкладке «Подписки» (стабильная
   пересортировка POSTS.sub) и дают буст в рекомендациях (chain feedScore). */

const PS = {
  cur: null,      /* имя автора, чей профиль открыт */
  follow: {},     /* {имя: ts подписки} — персист в oko-social */
};

/* ---------- персист ---------- */
function psLoadState(){
  try{
    const s = JSON.parse(localStorage.getItem('oko-social') || 'null');
    if(s && s.follow && typeof s.follow === 'object') PS.follow = s.follow;
  }catch(e){}
}
function psSaveState(){
  try{ localStorage.setItem('oko-social', JSON.stringify({follow: PS.follow, at: Date.now()})); }catch(e){}
}
function psIsFollowing(name){ return !!PS.follow[name]; }

/* ---------- утилиты ---------- */
function psHash(s){
  let h = 2166136261;
  for(let i = 0; i < String(s).length; i++){ h ^= String(s).charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function psFmt(n){ try{ return Math.round(n).toLocaleString('ru-RU'); }catch(e){ return String(n); } }
function psAttr(s){ return esc(s).replace(/'/g, '&#39;'); }
function psInitials(name){
  return String(name).trim().split(/\s+/).slice(0, 2).map(w => (w[0]||'').toUpperCase()).join('') || 'U';
}
const PS_TRANSLIT = {'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'h','ц':'c','ч':'ch','ш':'sh','щ':'sch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'};
function psNick(name){
  const raw = String(name).toLowerCase().replace(/[^a-zа-яё0-9]+/g, '')
    .split('').map(ch => PS_TRANSLIT[ch] !== undefined ? PS_TRANSLIT[ch] : ch).join('');
  return (raw.slice(0, 14) || 'user' + (psHash(name) % 999));
}
function psAgo(p){
  if(!p.ts) return 'недавно';
  const h = Math.max(1, Math.round((Date.now() - p.ts) / 36e5));
  if(h < 24) return h + ' ч назад';
  const d = Math.round(h / 24);
  return d + ' ' + (d === 1 ? 'день' : (d < 5 ? 'дня' : 'дней')) + ' назад';
}
/* id поста из карточки ленты (по onclick кнопки меню — не ломая чужой DOM) */
function psPostIdOf(art){
  const b = art && art.querySelector('.post-more');
  const m = b && (b.getAttribute('onclick') || '').match(/openPostMenu\((\d+)/);
  return m ? +m[1] : null;
}

/* ---------- био: рукописные для известных авторов + генератор ---------- */
const PS_BIOS = {
  'Марк Волков':      'Монтажёр вертикальных форматов. Собираю Reels для локального бизнеса: хук, ритм, караоке-субтитры. Кейсы и цифры досмотров — в постах.',
  'Алина Крид':       'SMM-стратег. Разбираю алгоритмы простыми словами и превращаю метрики в план публикаций. Тесты форматов — каждую неделю.',
  'OKO Team':         'Официальная команда OKO. Анонсы сборок, новые разделы приложения и разборы фич — из первых рук.',
  'OKO · Официальный':'Официальный канал OKO в ленте: обновления премодератора, алгоритмов и сервисов приложения.',
  'Даниэль / рост':   'Канал о росте на системе: контент-заводы, автоматизация и цифры вместо вдохновения.',
  'Даниэль':          'Основатель OKO. Строю приложение, где мессенджер, лента и заработок живут в одном месте.',
  'Клуб OKO':         'Сообщество практиков OKO: открытые разборы, эфиры и первые заказы на бирже.',
  'Клуб OKO · Рост':  'Закрытый клуб роста: еженедельные разборы роликов и воронок участников.',
  'Кейс недели':      'Подборка живых кейсов из OKO: цифры, воронки и что реально сработало.',
  'OKO Партнёрам':    'Всё про партнёрскую программу OKO: ставки, выплаты и топы месяца.',
  'Поддержка OKO':    'ИИ-поддержка OKO. Отвечает на вопросы о приложении круглосуточно; сложные случаи передаёт команде.',
  'Аня':              'Дизайнер обложек и визуала. Люблю чистую сетку, лайм и тёмные темы.',
  'Биржа OKO':        'Сервис безопасных сделок OKO: исполнители с рейтингом, оплата после приёмки.',
};
const PS_BIO_TOPIC = {
  ai:       'Пишу про нейросети без магии: пайплайны, промпты и локальные модели в деле.',
  content:  'Контент как система: хуки, монтаж, удержание. Разбираю на живых роликах.',
  business: 'Считаю юнит-экономику и строю процессы, которые работают без собственника.',
  marketing:'Перформанс и креативы: связки, тесты, CPL. Только то, что пережило A/B.',
  games:    'Геймдев маленькой командой: прототипы, плейтесты и честные цифры ретеншна.',
  crypto:   'Слежу за TON и ончейн-метриками. Без сигналов — только данные и риски.',
};
const PS_BIO_POOL = [
  'Автор OKO. Делюсь опытом и цифрами из своих проектов — без воды.',
  'Веду канал о своём деле: процессы, ошибки и что в итоге сработало.',
  'Практик, а не теоретик: каждый пост — из реальной задачи.',
  'Собираю здесь то, что помогает расти: приёмы, инструменты, разборы.',
];
function psBio(name, topic, sub){
  if(PS_BIOS[name]) return PS_BIOS[name];
  if(topic && PS_BIO_TOPIC[topic]) return PS_BIO_TOPIC[topic];
  const s = String(sub || '').toLowerCase();
  if(s.indexOf('smm') > -1) return PS_BIO_TOPIC.marketing;
  if(s.indexOf('монтаж') > -1) return PS_BIO_TOPIC.content;
  if(s.indexOf('сообщество') > -1) return 'Живое сообщество в OKO: обсуждения, разборы и взаимопомощь участников.';
  return PS_BIO_POOL[psHash(name) % PS_BIO_POOL.length];
}

/* ---------- модель автора: посты + чаты + детерминированная статистика ---------- */
function psAuthor(name){
  const posts = [];
  try{ [...POSTS.sub, ...POSTS.rec].forEach(p => { if(p.name === name) posts.push(p); }); }catch(e){}
  posts.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const p0 = posts[0] || null;
  const chat = (typeof CHATS !== 'undefined') ? CHATS.find(c => c.kind === 'direct' && c.name === name) : null;
  const anyChat = chat || ((typeof CHATS !== 'undefined') ? CHATS.find(c => c.name === name) : null);
  const h = psHash(name);
  const sub = (p0 && p0.sub) || '';

  let followers = 0;
  const m = sub.match(/(\d+(?:[.,]\d+)?)\s*к/i);
  if(m) followers = Math.round(parseFloat(m[1].replace(',', '.')) * 1000);
  else if(anyChat && anyChat.subs){
    const mm = String(anyChat.subs).match(/(\d+(?:[.,]\d+)?)\s*к/i);
    if(mm) followers = Math.round(parseFloat(mm[1].replace(',', '.')) * 1000);
  }
  if(!followers) followers = 300 + h % 4200;

  return {
    name, posts, sub,
    nick: (chat && chat.nick) ? chat.nick : psNick(name),
    online: chat ? !!chat.online : (h % 3 === 0),
    followers,
    followingN: 12 + h % 480,
    ava: (p0 && p0.ava) || (anyChat && anyChat.ava) || psInitials(name),
    avaIcon: (!(p0 && p0.ava) && anyChat && anyChat.avaIcon) ? anyChat.avaIcon : null,
    topic: (posts.map(p => p.topic).find(Boolean)) || null,
  };
}

/* ---------- рендер профиля ---------- */
function psPostsHtml(a){
  if(!a.posts.length) return `<div class="ps-empty">${I('feed')}<p>Пока нет постов</p><span>Публикации автора появятся здесь</span></div>`;
  return a.posts.map(p => `
    <article class="ps-post fade-in">
      <div class="ps-post-time">${psAgo(p)}${p.promoted ? ' · реклама' : ''}</div>
      <div class="ps-post-body">${p.body}</div>
      ${p.media ? `<div class="ps-post-media">${I('circle-play')}<span>${p.media}</span></div>` : ''}
      <div class="ps-post-meta">
        <button class="ps-like ${p.liked ? 'on' : ''}" onclick="psLike(${p.id})">${I('heart')}<span>${p.likes}</span></button>
        <span>${I('comment')}${p.comments ? p.comments.length : 0}</span>
        <span>${I('share')}${p.reposts || 0}</span>
        <span class="ps-views">${I('eye')}${typeof fmtN === 'function' ? fmtN(p.views || 0) : (p.views || 0)}</span>
      </div>
    </article>`).join('');
}
function psRender(name){
  const a = psAuthor(name);
  const f = psIsFollowing(name);
  const head = document.getElementById('psHeadName');
  if(head) head.textContent = '@' + a.nick;
  const body = document.getElementById('psBody');
  if(!body) return;
  body.innerHTML = `
    <div class="ps-top fade-in">
      <div class="ps-ava">${a.avaIcon ? I(a.avaIcon) : esc(a.ava)}</div>
      <h3 class="ps-name">${esc(a.name)}${typeof vBadge === 'function' ? vBadge(a.name) : ''}</h3>
      <div class="ps-nick">@${esc(a.nick)}${a.online ? ' · <span class="ps-on">в сети</span>' : ''}</div>
      <p class="ps-bio">${esc(psBio(a.name, a.topic, a.sub))}</p>
      <div class="ps-stats">
        <div class="ps-stat"><b>${a.posts.length}</b><small>постов</small></div>
        <div class="ps-stat"><b id="psFollowers">${psFmt(a.followers + (f ? 1 : 0))}</b><small>подписчиков</small></div>
        <div class="ps-stat"><b>${psFmt(a.followingN)}</b><small>подписок</small></div>
      </div>
      <div class="ps-actions">
        <button class="btn ${f ? 'ghost' : ''}" id="psFollowBtn" onclick="psToggleFollow()">${I(f ? 'check' : 'plus')} ${f ? 'Отписаться' : 'Подписаться'}</button>
        <button class="btn ghost" onclick="psMessage()">${I('chat')} Написать</button>
      </div>
    </div>
    <div class="ps-sec">Посты автора <span class="ps-cnt">${a.posts.length}</span></div>
    <div id="psPosts">${psPostsHtml(a)}</div>`;
}

/* ---------- открыть/закрыть вьюху ---------- */
function psOpenProfile(name){
  if(!name) return;
  if(typeof PROFILE !== 'undefined' && name === PROFILE.name){ /* свой профиль — родная вкладка */
    if(typeof showTab === 'function') showTab('profile');
    return;
  }
  PS.cur = name;
  psRender(name);
  const v = document.getElementById('psView');
  if(v && !v.classList.contains('open')){
    v.classList.add('open');
    if(typeof nvPush === 'function') nvPush('view:psProfile', psClose);
  }
}
function psClose(){
  const v = document.getElementById('psView');
  if(v) v.classList.remove('open');
  PS.cur = null;
  if(typeof nvPop === 'function') nvPop('view:psProfile');
}

/* ---------- подписка / отписка ---------- */
function psGoSubFeed(){
  psClose();
  if(typeof showTab === 'function') showTab('feed');
  const btn = document.querySelector('.feed-tabs button');
  if(btn && typeof feedTab === 'function') feedTab(btn, 'sub');
  else if(typeof renderFeed === 'function') renderFeed('sub');
}
function psToggleFollow(){
  const name = PS.cur;
  if(!name) return;
  const f = !psIsFollowing(name);
  if(f) PS.follow[name] = Date.now(); else delete PS.follow[name];
  psSaveState();

  /* счётчик подписчиков — с бампом */
  const a = psAuthor(name);
  const el = document.getElementById('psFollowers');
  if(el){
    el.textContent = psFmt(a.followers + (f ? 1 : 0));
    el.classList.remove('ps-bump'); void el.offsetWidth; el.classList.add('ps-bump');
  }
  const btn = document.getElementById('psFollowBtn');
  if(btn){
    btn.classList.toggle('ghost', f);
    btn.innerHTML = I(f ? 'check' : 'plus') + ' ' + (f ? 'Отписаться' : 'Подписаться');
  }
  /* лента «Подписки» пересортировывается сразу, если открыта */
  if(typeof renderFeed === 'function' && typeof curFeedKind !== 'undefined' && curFeedKind === 'sub'){
    try{ renderFeed('sub'); }catch(e){}
  }
  if(f && typeof showPopup === 'function'){
    showPopup({ico:'users', title:'Подписка оформлена',
      body:`Теперь его посты — выше в твоей ленте «Подписки». Ты подписан на <b>${esc(name)}</b>.`,
      actions:[{label:'В ленту', onclick: psGoSubFeed}, {label:'Понятно', ghost:true}]});
  } else if(!f && typeof toast === 'function'){
    toast('Ты отписался от ' + name);
  }
}

/* ---------- «Написать»: найти/создать личный чат + openConv ---------- */
function psMessage(){
  const name = PS.cur;
  if(!name || typeof CHATS === 'undefined') return;
  const a = psAuthor(name);
  let c = CHATS.find(x => x.kind === 'direct' && x.name === name);
  if(!c){
    c = {id: Date.now(), name, kind:'direct', nick: a.nick, kindIcon: null,
      preview:'Чат создан', time:(typeof nowT === 'function' ? nowT() : ''), unread:0, online: !!a.online,
      msgs:[{kind:'sys', body:'Личный чат с ' + name + ' создан'}]};
    if(a.avaIcon) c.avaIcon = a.avaIcon; else c.ava = a.ava;
    CHATS.unshift(c);
  }
  psClose();
  if(typeof showTab === 'function') showTab('chats');
  try{
    if(typeof renderChatList === 'function'){
      const s = document.getElementById('chatSearch');
      renderChatList(s ? s.value : '');
    }
  }catch(e){}
  if(typeof openConv === 'function') openConv(c.id);
}

/* ---------- лайк из профиля (через ядро — сигналы feed-algo сохраняются) ---------- */
function psLike(id){
  if(typeof likePost === 'function') likePost(id);
  const wrap = document.getElementById('psPosts');
  if(wrap && PS.cur) wrap.innerHTML = psPostsHtml(psAuthor(PS.cur));
}

/* ================= ТОЧКА ВХОДА 1: лента (делегирование на #feedList) ================= */
function psFeedTap(e){
  const hit = e.target.closest && e.target.closest('#feedList .post .head .ava, #feedList .post .head .name, #feedList .post .head .sub');
  if(!hit) return;
  if(e.target.closest('.post-more') || e.target.closest('.chip')) return; /* меню и чипы — не трогаем */
  const art = hit.closest('article.post');
  const id = psPostIdOf(art);
  const p = (id != null && typeof postById === 'function') ? postById(id) : null;
  if(!p || !p.name) return;
  psOpenProfile(p.name);
}

/* ================= ТОЧКА ВХОДА 2: аватар в шапке конва (кроме своих/каналов) ================= */
function psConvAvaTap(e){
  const ava = e.target.closest && e.target.closest('#convAva');
  if(!ava) return;
  const c = (typeof currentChat !== 'undefined') && currentChat;
  if(!c || c.kind !== 'direct' || c.id === 'live') return;              /* каналы/группы/живой чат — прежнее поведение */
  if(typeof PROFILE !== 'undefined' && c.name === PROFILE.name) return; /* свой чат — прежнее поведение */
  e.stopPropagation(); e.preventDefault();
  psOpenProfile(c.name);
}

/* ================= ТОЧКА ВХОДА 3: глобальный поиск (chain renderSearch) ================= */
function psDecorateSearch(){
  const body = document.getElementById('searchBody');
  if(!body || typeof CHATS === 'undefined') return;
  const inp = document.getElementById('gSearchInput');
  const q = ((inp && inp.value) || '').trim().toLowerCase();
  if(!q) return;

  /* 1) «Люди»: тап ведёт в профиль (оттуда — «Написать» в чат) */
  body.querySelectorAll('.nt-item').forEach(btn => {
    const oc = btn.getAttribute('onclick') || '';
    if(oc.indexOf('openConv(') < 0 || oc.indexOf('openListing') > -1) return;
    const m = oc.match(/openConv\((?:'([^']+)'|(\d+))\)/);
    if(!m) return;
    const id = m[2] !== undefined ? +m[2] : m[1];
    const c = CHATS.find(x => x.id === id);
    if(!c || c.kind !== 'direct' || c.id === 'live') return;
    if(typeof PROFILE !== 'undefined' && c.name === PROFILE.name) return;
    btn.setAttribute('onclick', `closeSearch();psOpenProfile('${psAttr(c.name)}')`);
  });

  /* 2) секция «Авторы» — авторы постов ленты по запросу */
  try{
    const inChats = new Set(CHATS.filter(c => c.kind === 'direct').map(c => c.name));
    const seen = new Set(); const authors = [];
    [...POSTS.sub, ...POSTS.rec].forEach(p => {
      if(!p.name || seen.has(p.name)) return; seen.add(p.name);
      if(typeof PROFILE !== 'undefined' && p.name === PROFILE.name) return;
      if(inChats.has(p.name)) return; /* уже в секции «Люди» */
      if(p.name.toLowerCase().includes(q)) authors.push(p);
    });
    if(!authors.length) return;
    const html = `<p class="nt-group">Авторы</p>` + authors.slice(0, 5).map(p =>
      `<button class="nt-item" onclick="closeSearch();psOpenProfile('${psAttr(p.name)}')">
        <span class="nt-ic">${esc(p.ava || p.name[0])}</span>
        <div class="nt-b"><span><b>${esc(p.name)}</b>${typeof vBadge === 'function' ? vBadge(p.name) : ''}</span><small>${esc(p.sub || 'автор в OKO')}</small></div>
      </button>`).join('');
    const empty = body.querySelector('.empty-state');
    if(empty) body.innerHTML = html;
    else body.insertAdjacentHTML('beforeend', html);
  }catch(e){}
}

/* ================= ПОДПИСКИ ПОДНИМАЮТ ПОСТЫ: сортировка sub + буст rec ================= */
/* стабильная пересортировка POSTS.sub: подписки выше, исходный порядок помним в _psIdx */
function psSortSub(){
  if(typeof POSTS === 'undefined' || !Array.isArray(POSTS.sub)) return;
  let min = Infinity;
  POSTS.sub.forEach(p => { if(typeof p._psIdx === 'number' && p._psIdx < min) min = p._psIdx; });
  if(min === Infinity) min = 0;
  const fresh = POSTS.sub.filter(p => typeof p._psIdx !== 'number');
  fresh.forEach((p, i) => { p._psIdx = min - fresh.length + i; }); /* новые посты — сверху своей группы */
  POSTS.sub.sort((a, b) =>
    ((psIsFollowing(b.name) ? 1 : 0) - (psIsFollowing(a.name) ? 1 : 0)) || (a._psIdx - b._psIdx));
}
/* декор вкладки «Подписки»: verified-галочка + чип «Подписка» */
function psDecorateSub(){
  const list = document.getElementById('feedList');
  if(!list) return;
  list.querySelectorAll('article.post').forEach(art => {
    const id = psPostIdOf(art);
    const p = (id != null && typeof postById === 'function') ? postById(id) : null;
    if(!p) return;
    const nameEl = art.querySelector('.head .name');
    if(!nameEl) return;
    if(typeof vBadge === 'function' && typeof VERIFIED !== 'undefined' && VERIFIED.has(p.name) && !nameEl.querySelector('.ps-vb'))
      nameEl.insertAdjacentHTML('beforeend', `<span class="ps-vb">${vBadge(p.name)}</span>`);
    if(psIsFollowing(p.name) && !nameEl.querySelector('.ps-fchip'))
      nameEl.insertAdjacentHTML('beforeend', ` <span class="chip ps-fchip">${I('check')}Подписка</span>`);
  });
}

/* ================= САМОИНИЦИАЛИЗАЦИЯ И ПАТЧИ (chain) ================= */
(function psInit(){
  psLoadState();

  /* chain renderFeed: сортировка «Подписок» перед рендером ядра + декор после */
  if(typeof renderFeed === 'function'){
    const _psPrevRenderFeed = renderFeed;
    renderFeed = function(kind){
      kind = kind || (typeof curFeedKind !== 'undefined' ? curFeedKind : 'sub') || 'sub';
      if(kind === 'sub'){ try{ psSortSub(); }catch(e){} }
      _psPrevRenderFeed(kind);
      if(kind === 'sub'){ try{ psDecorateSub(); }catch(e){} }
    };
  }

  /* chain feedScore: подписки чуть выше и в рекомендациях */
  if(typeof feedScore === 'function'){
    const _psPrevFeedScore = feedScore;
    feedScore = function(p){
      let s = _psPrevFeedScore(p);
      if(p && p.name && psIsFollowing(p.name)) s += 180;
      return s;
    };
  }

  /* chain renderSearch: авторы в поиске */
  if(typeof renderSearch === 'function'){
    const _psPrevRenderSearch = renderSearch;
    renderSearch = function(){
      _psPrevRenderSearch();
      try{ psDecorateSearch(); }catch(e){}
    };
  }

  /* делегирование кликов: лента + аватар конва (capture — раньше onclick-атрибутов) */
  const fl = document.getElementById('feedList');
  if(fl && !fl._psTap){ fl.addEventListener('click', psFeedTap); fl._psTap = true; }
  document.addEventListener('click', psConvAvaTap, true);

  /* применить сортировку/декор к уже отрисованной ленте */
  try{
    if(typeof curFeedKind !== 'undefined' && curFeedKind === 'sub' && document.getElementById('feedList'))
      renderFeed('sub');
  }catch(e){}
})();
