/* ================= I18N-SETTINGS: язык интерфейса RU/EN + авто-перевод чатов =================
   Префикс st-. Опирается на i18n-ядро core-ext: LANG, regT, t, onLangChange, setLang, regTitle. */

/* ---------- состояние модуля ---------- */
const ST_STATE = (()=>{ try{ return JSON.parse(localStorage.getItem('oko-i18n-settings'))||{}; }catch(e){ return {}; } })();
if(typeof ST_STATE.auto !== 'boolean') ST_STATE.auto = false;
function stSave(){ try{ localStorage.setItem('oko-i18n-settings', JSON.stringify(ST_STATE)); }catch(e){} }

/* ---------- словарь хрома (регистрация в i18n-ядре) ---------- */
regT({
  /* вкладки нижней навигации */
  'st.nav.feed':    {ru:'Лента',        en:'Feed'},
  'st.nav.chats':   {ru:'Чаты',         en:'Chats'},
  'st.nav.mini':    {ru:'Мини-аппы',    en:'Hub'},
  'st.nav.wallet':  {ru:'Кошелёк',      en:'Wallet'},
  'st.nav.profile': {ru:'Профиль',      en:'Profile'},
  /* заголовки экранов (TITLES) */
  'st.title.feed':    {ru:'Лента',       en:'Feed'},
  'st.title.chats':   {ru:'Чаты',        en:'Chats'},
  'st.title.mini':    {ru:'Мини-аппы',   en:'Hub'},
  'st.title.partner': {ru:'Партнёрка',   en:'Partner Hub'},
  'st.title.profile': {ru:'Профиль',     en:'Profile'},
  'st.title.wallet':  {ru:'Кошелёк',     en:'Wallet'},
  'st.title.games':   {ru:'Игры',        en:'Games'},
  'st.title.academy': {ru:'Академия',    en:'Academy'},
  'st.title.ads':     {ru:'Реклама',     en:'Ads'},
  /* статичные заголовки и кнопки */
  'st.h.services':    {ru:'Сервисы OKO',           en:'OKO Services'},
  'st.h.servicesSub': {ru:'Мессенджер, лента, биржа и ИИ-инструменты', en:'Messenger, feed, marketplace & AI tools'},
  'st.h.partner':     {ru:'Партнёрский кабинет',   en:'Partner Hub'},
  'st.h.plans':       {ru:'Тарифы',                en:'Plans'},
  'st.w.account':     {ru:'Лицевой счёт',          en:'Account'},
  'st.w.topup':       {ru:'Пополнить',             en:'Top up'},
  'st.w.withdraw':    {ru:'Вывести',               en:'Withdraw'},
  'st.w.history':     {ru:'История',               en:'History'},
  'st.w.spending':    {ru:'Расходы по категориям', en:'Spending by category'},
  'st.w.ops':         {ru:'История операций',      en:'Transaction history'},
  'st.w.fAll':        {ru:'Все',                   en:'All'},
  'st.w.fIn':         {ru:'Пополнения',            en:'Deposits'},
  'st.w.fOut':        {ru:'Списания',              en:'Charges'},
  /* строки профиля */
  'st.p.theme':       {ru:'Светлая тема',          en:'Light theme'},
  'st.p.profile':     {ru:'Профиль',               en:'Profile'},
  'st.p.notif':       {ru:'Уведомления',           en:'Notifications'},
  'st.p.privacy':     {ru:'Конфиденциальность',    en:'Privacy'},
  'st.p.progress':    {ru:'Прогресс сборки',       en:'Build progress'},
  'st.p.admin':       {ru:'Админка OKO',           en:'OKO Admin'},
  'st.p.logout':      {ru:'Выйти',                 en:'Log out'},
  /* плейсхолдеры поиска */
  'st.ph.gsearch':    {ru:'Люди, каналы, услуги, посты', en:'People, channels, services, posts'},
  'st.ph.search':     {ru:'Поиск',                 en:'Search'},
  /* собственные строки модуля */
  'st.row.lang':      {ru:'Язык · Language',       en:'Language'},
  'st.row.auto':      {ru:'Авто-перевод чатов',    en:'Auto-translate chats'},
  'st.sheet.title':   {ru:'Язык · Language',       en:'Language'},
  'st.sheet.note':    {ru:'Интерфейс переключается мгновенно. Контент пользователей остаётся на языке оригинала — включи авто-перевод чатов в профиле.',
                       en:'The interface switches instantly. User content stays in its original language — enable chat auto-translation in your profile.'},
  'st.opt.ruSub':     {ru:'Основной язык OKO',     en:'Default OKO language'},
  'st.opt.enSub':     {ru:'Интерфейс на английском', en:'English interface'},
  'st.badge':         {ru:'Переведено · OKO AI',   en:'Translated · OKO AI'},
  'st.toast.autoOn':  {ru:'Авто-перевод включён — входящие переводит OKO AI', en:'Auto-translation on — incoming messages translated by OKO AI'},
  'st.toast.autoOff': {ru:'Авто-перевод выключен', en:'Auto-translation off'},
  'st.doc.title':     {ru:'OKO — приложение',        en:'OKO — the app'}
});

/* ключи TITLES, которые модуль умеет переводить (обновляются только если экран существует) */
const ST_TITLE_KEYS = ['feed','chats','mini','partner','profile','wallet','games','academy','ads'];

/* статичные элементы хрома: селектор -> ключ словаря (переводим только реально существующие) */
const ST_STATIC = [
  {sel:'#maHero h2',                                   key:'st.h.services'},
  {sel:'#maHero p',                                    key:'st.h.servicesSub'},
  {sel:'.svc-h',                                       key:'st.h.services'},
  {sel:'#screen-partner .section-h',                   key:'st.h.partner'},
  {sel:'#screen-profile .section-h',                   key:'st.h.plans'},
  {sel:'#screen-wallet .wal-acc-label',                key:'st.w.account'},
  {sel:'#screen-wallet .wal-act[onclick^="walOpenTopup"]',    key:'st.w.topup'},
  {sel:'#screen-wallet .wal-act[onclick^="walOpenWithdraw"]', key:'st.w.withdraw'},
  {sel:'#screen-wallet .wal-act[onclick^="walScrollHistory"]',key:'st.w.history'},
  {sel:'#screen-wallet .section-h:not(#walHistAnchor)',key:'st.w.spending'},
  {sel:'#walHistAnchor',                               key:'st.w.ops'},
  {sel:'#walFilters [data-f="all"]',                   key:'st.w.fAll'},
  {sel:'#walFilters [data-f="in"]',                    key:'st.w.fIn'},
  {sel:'#walFilters [data-f="out"]',                   key:'st.w.fOut'},
  {sel:'#screen-profile .prow[onclick="toggleTheme()"]',        key:'st.p.theme'},
  {sel:'#screen-profile .prow[onclick="openEdit()"]',           key:'st.p.profile'},
  {sel:"#screen-profile .prow[onclick=\"openSettings('notif')\"]",   key:'st.p.notif'},
  {sel:"#screen-profile .prow[onclick=\"openSettings('privacy')\"]", key:'st.p.privacy'},
  {sel:"#screen-profile .prow[onclick=\"openSheet('progress')\"]",   key:'st.p.progress'},
  {sel:'#prowAdmin',                                   key:'st.p.admin'},
  {sel:'#screen-profile .prow[onclick="doLogout()"]',  key:'st.p.logout'}
];

/* заменить первый значимый текстовый узел элемента (не трогая svg/switch/chev внутри) */
function stSetText(el, txt){
  if(!el) return;
  for(const n of el.childNodes){
    if(n.nodeType === 3 && n.nodeValue.trim()){ n.nodeValue = ' ' + txt + ' '; return; }
  }
}

/* ---------- обработчик смены языка (регистрируется в onLangChange) ---------- */
function stApplyLang(l){
  /* 0. заголовок документа/вкладки браузера */
  try{ document.title = t('st.doc.title'); }catch(e){}
  /* 1. подписи вкладок нижней навигации (текстовый узел после svg) */
  document.querySelectorAll('#tabs>button[data-t]').forEach(b=>{
    const key = 'st.nav.' + b.dataset.t;
    if(I18N[key]) stSetText(b, t(key));
  });
  /* 2. TITLES всех известных экранов — только реально зарегистрированных */
  if(typeof TITLES === 'object'){
    ST_TITLE_KEYS.forEach(k=>{
      if(TITLES[k] !== undefined && I18N['st.title.'+k]) regTitle(k, t('st.title.'+k));
    });
    /* текущий заголовок шапки */
    const act = document.querySelector('main .screen.active');
    const head = document.getElementById('screenTitle');
    if(act && head){
      const k = act.id.replace('screen-','');
      if(TITLES[k]) head.textContent = TITLES[k];
    }
  }
  /* 3. статичные заголовки/кнопки — с проверкой существования */
  ST_STATIC.forEach(o=>{
    document.querySelectorAll(o.sel).forEach(el=>{
      if(el.children.length === 0) el.textContent = t(o.key);
      else stSetText(el, t(o.key));
    });
  });
  /* 4. плейсхолдеры поиска */
  const gs = document.getElementById('gSearchInput'); if(gs) gs.placeholder = t('st.ph.gsearch');
  const cs = document.getElementById('chatSearch');   if(cs) cs.placeholder = t('st.ph.search');
  /* 5. собственные элементы модуля */
  const lt = document.getElementById('stLangText'); if(lt) lt.textContent = t('st.row.lang');
  const lc = document.getElementById('stLangCur');  if(lc) lc.textContent = l==='en' ? 'English' : 'Русский';
  const ar = document.getElementById('stAutoRow');  if(ar) stSetText(ar, t('st.row.auto'));
  const sh = document.getElementById('stLangTitle'); if(sh) sh.textContent = t('st.sheet.title');
  const sn = document.getElementById('stLangNote');  if(sn) sn.textContent = t('st.sheet.note');
  stRenderLangList();
  /* 6. перерисовать открытый чат, чтобы бейджи перевода сменили язык */
  stRerenderChat();
  /* 7. словарный DOM-переводчик: EN — полный проход + observer; RU — откат */
  stSyncDomLang(l);
}

/* ---------- sheet выбора языка ---------- */
function stRenderLangList(){
  const box = document.getElementById('stLangList');
  if(!box) return;
  const L = (typeof LANG === 'string') ? LANG : 'ru';
  box.innerHTML = [
    ['ru','Русский','РУ','st.opt.ruSub'],
    ['en','English','EN','st.opt.enSub']
  ].map(([code,label,tag,sub])=>`
    <button class="sheet-item st-lang-opt ${L===code?'on':''}" onclick="stPickLang('${code}')">
      <span class="st-lang-tag">${tag}</span>
      <span>${label}<small>${t(sub)}</small></span>
      ${L===code ? `<span class="st-check">${I('check2')}</span>` : ''}
    </button>`).join('');
}
function stOpenLang(){ stRenderLangList(); openSheet('stLang'); }
function stPickLang(l){
  if(l === LANG){ closeSheet(); return; }
  setLang(l);                 // персист (oko-lang) + все onLangChange-хуки, включая stApplyLang
  stRenderLangList();         // галочка перескакивает с анимацией
  setTimeout(closeSheet, 260);
}

/* ---------- авто-перевод чатов ---------- */
function stToggleAuto(){
  ST_STATE.auto = !ST_STATE.auto;
  stSave();
  const sw = document.getElementById('stAutoSwitch');
  if(sw) sw.classList.toggle('on', ST_STATE.auto);
  toast(t(ST_STATE.auto ? 'st.toast.autoOn' : 'st.toast.autoOff'));
  stRerenderChat();
}
function stRerenderChat(){
  if(typeof renderMsgs !== 'function') return;
  if(typeof currentChat === 'undefined' || !currentChat) return;
  const box = document.getElementById('msgs');
  if(!box || !box.children.length) return;
  try{ renderMsgs(); }catch(e){}
}
/* DOM-проход: тонкий бейдж «Переведено · OKO AI» под входящими текстовыми сообщениями */
function stMarkTranslated(){
  if(!ST_STATE.auto) return;
  const box = document.getElementById('msgs');
  if(!box) return;
  box.querySelectorAll('.msg.in').forEach(m=>{
    if(m.dataset.stDone) return;
    if(m.classList.contains('sys') || m.classList.contains('sticker-msg') || m.classList.contains('has-vnote')) return;
    if(m.querySelector('.voice,.filemsg,.photomsg,.pollmsg,.moneymsg')) return; // только текст
    const b = document.createElement('div');
    b.className = 'st-trans';
    b.innerHTML = `${I('globe')}<span>${t('st.badge')}</span>`;
    m.appendChild(b);
    m.dataset.stDone = '1';
  });
}

/* ================= СЛОВАРНЫЙ DOM-ПЕРЕВОДЧИК (полный перевод интерфейса RU→EN) =================
   Точные видимые строки всех модулей. Ключ — trim + схлопнутые пробелы.
   Оригиналы хранятся в WeakMap (без загрязнения DOM), реестр узлов — в Set для отката. */
const ST_DICT = {
  /* --- общие кнопки и слова --- */
  'Назад':'Back','Далее':'Next','Готово':'Done','Отмена':'Cancel','Отлично':'Great','Понятно':'Got it',
  'Позже':'Later','Создать':'Create','Показать':'Show','Закрыть':'Close','Выбрать':'Choose','Сохранить':'Save',
  'Удалить':'Delete','Изменить':'Edit','Копировать':'Copy','Пропустить':'Skip','Отправить':'Send','Опубликовать':'Publish',
  'Продолжить':'Continue','Подтвердить':'Confirm','Войти':'Log in','Выйти':'Log out','Включить':'Enable','Установить':'Install',
  'Дальше':'Next','Ответить':'Reply','Прочитать':'Read','Сбросить':'Reset','Снять':'Unpublish','Запустить':'Launch',
  'Остановить':'Stop','Одобрить':'Approve','Отклонить':'Reject','Подробнее':'Learn more','Купить':'Buy','Подписаться':'Follow',
  'сегодня':'today','вчера':'yesterday','Сегодня':'Today','Вчера':'Yesterday','сейчас':'just now','скоро':'soon',
  'Все':'All','Вкл':'On','Поиск':'Search','Название':'Title','Категория':'Category','Описание':'Description',
  'Цена':'Price','Тип':'Type','от':'from','до':'to','и':'and','Имя':'Name','Пароль':'Password','Почта':'Email',
  'Телефон':'Phone','Никнейм':'Username','никнейм':'username','Статус':'Status','Тариф':'Plan','Тарифы':'Plans',
  'Вопрос':'Question','Опрос':'Poll','Файл':'File','Камера':'Camera','Тема':'Theme','изм.':'edited','24ч':'24h',
  '7д':'7d','30д':'30d','90д':'90d','владелец':'owner','Эскалация':'Escalation','Безопасность':'Security',
  /* --- нижняя навигация / заголовки экранов / хаб --- */
  'Лента':'Feed','Чаты':'Chats','Мини-аппы':'Hub','Кошелёк':'Wallet','Профиль':'Profile','Партнёрка':'Partner Hub',
  'Игры':'Games','Академия':'Academy','Реклама':'Ads','Биржа':'Marketplace','Биржа OKO':'OKO Marketplace',
  'Сервисы OKO':'OKO Services','Мессенджер, лента, биржа и ИИ-инструменты':'Messenger, feed, marketplace & AI tools',
  'Нажми на сервис — откроется внутри OKO':'Tap a service — it opens inside OKO','Биржа услуг':'Marketplace',
  'Контент-завод':'Content Factory','Система роста':'Growth System','Проверка видео':'Video Check','Поддержка':'Support',
  'Поддержка OKO':'OKO Support','Система роста по анкете':'Growth system from your brief',
  'Автопостинг в 3 соцсети':'Auto-posting to 3 networks','Кабинет продавца':'Seller Hub','Документы OKO':'OKO Documents',
  'Верификация':'Verification','Стикеры OKO':'OKO Stickers','Рекламный кабинет':'Ads Manager',
  /* --- экран входа / онбординг --- */
  'Медийность, контент, маркетинг и бизнес — в одном приложении':'Media, content, marketing and business — in one app',
  'Продолжить в Telegram':'Continue with Telegram','Телефон или почта':'Phone or email',
  'Продолжая, ты принимаешь условия сервиса и политику конфиденциальности':'By continuing you accept the Terms of Service and Privacy Policy',
  /* --- регистрация --- */
  'Регистрация':'Sign up','Шаг':'Step','из 3':'of 3','Создай аккаунт':'Create your account',
  'Почта или телефон и пароль — этого достаточно для старта в OKO.':'Email or phone plus a password — that is all you need to start with OKO.',
  'Электронная почта':'Email address','Номер телефона':'Phone number','Минимум 6 символов':'At least 6 characters',
  'Показать пароль':'Show password','Надёжность пароля':'Password strength','Слабый пароль':'Weak password',
  'Нормальный пароль':'Okay password','Хороший пароль':'Good password','Отличный пароль':'Strong password',
  'Данные шифруются и не передаются третьим лицам':'Your data is encrypted and never shared with third parties',
  'Код подтверждения':'Verification code','Мы отправили 4-значный код':'We sent a 4-digit code',
  'Отправить код повторно':'Resend code','Твой профиль':'Your profile',
  'Как тебя показывать в OKO и что тебе интересно.':'How to show you in OKO and what you are into.',
  'Как к тебе обращаться':'What should we call you','Дата рождения':'Date of birth','Интересы':'Interests',
  'Выбери хотя бы один — лента и рекомендации подстроятся под тебя.':'Pick at least one — your feed and recommendations will adapt.',
  'Принимаю':'I accept','условия сервиса':'terms of service','политику конфиденциальности':'privacy policy',
  'Создать аккаунт':'Create account','Проверяю никнейм…':'Checking username…',
  'Слишком короткий — минимум 3 символа':'Too short — at least 3 characters','уже занят, попробуй другой':'is taken, try another',
  'свободен':'is available','Укажи имя — так тебя увидят в OKO':'Enter a name — this is how people will see you in OKO',
  'Нужен свободный никнейм':'You need an available username',
  'Выбери хотя бы один интерес — без него лента будет пустой':'Pick at least one interest — otherwise your feed will be empty',
  'Прими условия сервиса, чтобы продолжить':'Accept the terms of service to continue',
  'Добро пожаловать в OKO':'Welcome to OKO','Забрать бонус':'Claim bonus',
  'Бонус на лицевом счёте — кошелёк уже в сборке':'Bonus credited to your account — the wallet is on its way',
  'Открой OKO PRO':'Unlock OKO PRO','Оформить PRO':'Get PRO','Тарифы скоро откроются':'Plans are coming soon',
  'Включи уведомления':'Turn on notifications','Уведомления включены':'Notifications enabled',
  'Похоже, в почте опечатка — проверь адрес':'Looks like a typo in the email — check the address',
  'Введи номер полностью — 11 цифр с +7':'Enter the full number — 11 digits starting with +7',
  'Пароль слишком короткий — минимум 6 символов':'Password is too short — at least 6 characters',
  'Введи все 4 цифры кода':'Enter all 4 digits of the code',
  'Код не подходит — проверь и попробуй ещё раз':'Wrong code — check and try again','Код подтверждён':'Code confirmed',
  'В приложение':'Open the app','Проверяю доступ…':'Checking access…','Доступ владельца':'Owner access',
  'Неверный пароль владельца':'Wrong owner password','Нейросети':'AI','Бизнес':'Business','Маркетинг':'Marketing',
  'Крипта':'Crypto','Контент':'Content','нейросети':'AI','бизнес':'business','маркетинг':'marketing',
  'крипта':'crypto','контент':'content','игры':'gaming','Условия сервиса откроются в разделе «Документы»':'The Terms of Service open in the Documents section',
  'Политика конфиденциальности откроется в разделе «Документы»':'The Privacy Policy opens in the Documents section',
  /* --- чаты --- */
  'Новый чат':'New chat','Выбери чат или создай новый':'Pick a chat or start a new one','онлайн':'online',
  'Онлайн':'Online','был(а) недавно':'last seen recently','Сообщение':'Message','Аудиозвонок':'Voice call',
  'Видеозвонок':'Video call','Собеседник':'Contact','Соединение…':'Connecting…','Микрофон':'Mic','Динамик':'Speaker',
  'Завершить':'End','Личный чат':'Direct chat','Диалог один на один':'One-on-one conversation','Группа':'Group',
  'До 200 000 участников':'Up to 200,000 members','Канал':'Channel','Посты в ленту подписчиков':'Posts to your subscribers',
  'Сообщество':'Community','Канал + чаты + мини-аппы':'Channel + chats + mini-apps','Прикрепить':'Attach',
  'Фото с устройства':'Photo from device','Free до 100 МБ · Start/Pro до 2 ГБ':'Free up to 100 MB · Start/Pro up to 2 GB',
  'Голосование в чате':'Chat poll','Перевести деньги':'Send money','Мгновенно, без комиссии':'Instant, no fee',
  'Фирменный набор':'Brand pack','Геопозиция':'Location','Отправить точку на карте':'Send a point on the map',
  'Выбрать изображение и отправить':'Pick an image and send','Новый опрос':'New poll','Вариант 1':'Option 1',
  'Вариант 2':'Option 2','Вариант 3 (необязательно)':'Option 3 (optional)','Создать опрос':'Create poll',
  'Перевод':'Transfer','Доставлен':'Delivered','Сумма, ₽':'Amount, ₽',
  'Мок: в проде — кошелёк OKO, вывод на карту':'Mock: in production — OKO wallet, card payout',
  'Опрос · выбери вариант':'Poll · pick an option','Ничего не нашлось':'Nothing found',
  'Попробуй другой запрос или фильтр':'Try another query or filter','Попробуй другой запрос':'Try another query',
  'Здесь пока пусто':'Nothing here yet','Создай чат кнопкой + внизу':'Start one with the + button below',
  'живой чат':'live chat','Пишут все участники':'Everyone can post','Быстрый доступ':'Quick access',
  /* --- лента / истории --- */
  'Подписки':'Following','Рекомендации':'For you','В тренде':'Trending',
  'Ранжирует алгоритм OKO: вовлечённость и свежесть — как в Instagram, в отличие от Telegram':'Ranked by the OKO algorithm: engagement and recency — like Instagram, unlike Telegram',
  'Новый пост':'New post','Что нового? Поделись с подписчиками…':'What is new? Share it with your subscribers…',
  'Комментарии':'Comments','Написать комментарий…':'Write a comment…',
  'Пока нет комментариев — будь первым':'No comments yet — be the first','Продвинуть пост':'Promote post',
  'Не интересно':'Not interested','Пожаловаться':'Report','Продвижение поста':'Post promotion',
  'Алгоритм OKO покажет пост тем, кому он интересен':'The OKO algorithm will show the post to people who care',
  'Показ в рекомендациях целевой аудитории':'Shown in recommendations to the target audience',
  'В топе рекомендаций + похожие интересы':'Top of recommendations + similar interests',
  'Максимальный охват + продвижение канала':'Maximum reach + channel promotion',
  'Пост продвигается — охват растёт':'Post is being promoted — reach is growing','Пост удалён':'Post deleted',
  'Больше не покажем такое':'We will not show this again','Жалоба отправлена на модерацию':'Report sent to moderation',
  'Репост в твою ленту':'Reposted to your feed','Сохранено в закладки':'Saved to bookmarks',
  'Убрано из закладок':'Removed from bookmarks','Новая история':'New story','История на 24 часа':'A story for 24 hours',
  'Текст истории (необязательно)':'Story text (optional)','Опубликовать текст':'Publish text','Пока тихо':'Quiet for now',
  'Тут появятся лайки, заявки и начисления':'Likes, requests and payouts will appear here',
  /* --- канал / сообщество --- */
  'подписчиков':'followers','охват/нед':'reach/wk','новых/нед':'new/wk','вовлечённость':'engagement',
  'Посты в ленте':'Posts in feed','Алгоритмы OKO':'OKO algorithms','участников':'members','участники':'members',
  'сообщений':'messages','антиспам':'anti-spam','Написать':'Message','Продвижение канала':'Channel promotion',
  'Продвинуть канал':'Promote channel','Показываем целевой аудитории по нише канала':'Shown to a target audience in your channel niche',
  /* --- каналы: создание, доступ, управление (channels) --- */
  'Создать канал':'Create channel','Удалить канал':'Delete channel','Действие необратимо':'This action is irreversible',
  'Канал, клуб или видео-курс · открытый/закрытый, платный/бесплатный':'Channel, club or video course · public/private, paid/free',
  'Тип, доступ и цена':'Type, access and price','Тип и доступ':'Type and access','Видео-курс':'Video course',
  'Открытый':'Public','Виден и читается всем':'Visible and readable to everyone',
  'Закрытый':'Private','Витрина + доступ по заявке/оплате':'Showcase + access by request/payment',
  'Бесплатно':'Free','Без платы за доступ':'No access fee','Платно':'Paid','Доступ по подписке/оплате':'Access by subscription/payment',
  'Прогресс курса':'Course progress','Публичная ссылка-приглашение':'Public invite link','Загрузить фото поста':'Upload post photo',
  'Написать автору':'Message the author','Постов пока нет':'No posts yet','Обсудить':'Discuss','Нажми, чтобы проголосовать':'Tap to vote',
  'Бесплатное вступление — доступ откроется сразу':'Free to join — access opens right away','· по заявке':'· by request',
  'Оформи доступ, чтобы видеть все материалы':'Get access to see all materials',
  'аватар · обложка · фон':'avatar · cover · background','Обсуждения':'Discussions','Реакции':'Reactions','Статистика':'Statistics',
  'включены':'on','выключены':'off','графики':'charts','всего':'total','доступ':'access','оплата':'payment',
  'за неделю':'per week','прирост/нед':'growth/wk','подписок':'subscriptions','пик: сб':'peak: Sat','опрос':'poll','видео':'video',
  /* --- каналы: тосты и уведомления --- */
  'Аватар обновлён':'Avatar updated','Обложка обновлена':'Cover updated','Администратор разжалован':'Admin demoted',
  'Введите название урока':'Enter a lesson title','Введите название':'Enter a title','Урок добавлен':'Lesson added',
  'Видео-плеер урока — подключается к Академии OKO':'Lesson video player — connects to OKO Academy',
  'Вы вступили в канал':'You joined the channel','Выберите изображение':'Choose an image','Добавьте текст или фото':'Add text or a photo',
  'Доступ открыт':'Access granted','Доступ отменён':'Access revoked','Задай цену в «Тип и доступ»':'Set a price in "Type and access"',
  'Канал удалён':'Channel deleted','Кошелёк недоступен':'Wallet unavailable','Курс всегда закрытый':'A course is always private',
  'Курс всегда платный':'A course is always paid','Курс всегда закрытый — уроки открываются после покупки.':'A course is always private — lessons open after purchase.',
  'Мессенджер недоступен':'Messenger unavailable','Не удалось прочитать изображение':'Could not read the image',
  'Нет участников для назначения':'No members to assign','Открываю чаты':'Opening chats','Ошибка чтения файла':'File read error',
  'Обсуждения включены — комментарии подключатся с бэкендом':'Discussions enabled — comments will connect with the backend',
  'Пока нечего выводить — продаж не было':'Nothing to withdraw yet — no sales',
  'Пост опубликован — он уже в ленте рекомендаций':'Post published — it is already in the recommendations feed',
  'Урок пройден — прогресс обновлён':'Lesson completed — progress updated',
  /* --- проверка видео --- */
  'Видео-премодератор':'Video pre-moderator',
  'Ролик до 10 ГБ. Исходник автоудаляется через 24 часа после анализа.':'Video up to 10 GB. The source auto-deletes 24 hours after analysis.',
  'Загрузить ролик':'Upload video','Загрузка…':'Uploading…',
  'Gemini анализирует хук, динамику, риски и технические параметры':'Gemini analyzes the hook, pacing, risks and technical parameters',
  'готовность':'readiness','Вероятность рекомендаций':'Recommendation probability','Метрики':'Metrics',
  'Проверка рисков':'Risk check','Рекомендации ИИ':'AI recommendations','Исправить одним кликом':'Fix in one click',
  'Опубликовать во все сети':'Publish to all networks','Проверить другой ролик':'Check another video',
  'Хороший ролик. Исправь 2 риска ниже — и готовность вырастет до ~90%.':'Good video. Fix the 2 risks below and readiness grows to ~90%.',
  /* --- система роста --- */
  'Моя система роста':'My growth system','Claude собирает твою систему…':'Claude is building your system…',
  'Анализ ниши, целей и ресурсов по мастер-методике OKO':'Analyzing your niche, goals and resources with the OKO master method',
  'персональная система роста':'personal growth system','Профиль:':'Profile:','Твой план на 30 дней':'Your 30-day plan',
  'Открыть полную систему':'Open full system','Позиционирование':'Positioning','Контент-стратегия':'Content strategy',
  'Формат-ядро':'Core format','Ритм':'Cadence','Площадка':'Platform','Автопостинг':'Auto-posting',
  'План на 30 дней':'30-day plan','Цель по метрикам':'Metric goals','Что дальше':'What is next',
  'Сохранить систему':'Save system','Скачать PDF':'Download PDF','Ниша / тема канала':'Niche / channel topic',
  'Например: маркетинг для салонов красоты':'E.g.: marketing for beauty salons','Куда публиковать':'Where to publish',
  'Темп':'Pace','Пройти заново':'Start over',
  /* --- контент-завод --- */
  'Запустить завод':'Launch the factory','Claude собирает контент-план…':'Claude is building your content plan…',
  'В эфире':'Live','в производстве':'in production','готово':'done','опубликовано':'published',
  'Конвейер производства':'Production pipeline','Новый канал':'New channel','Контент-завод: 30 роликов в месяц':'Content factory: 30 videos a month',
  /* --- партнёрка --- */
  'Партнёрский кабинет':'Partner hub','регистрации':'sign-ups','оплаты':'payments','к выплате':'payable',
  'Доход за период':'Earnings for period','Твоя реф-ссылка':'Your referral link',
  '15% с оплат твоих клиентов (первые 6 мес, далее 5%) + 5% со второго уровня':'15% of your clients payments (first 6 mo, then 5%) + 5% from the second level',
  'Последние начисления':'Recent accruals','Доступно к выводу':'Available to withdraw','мин. $20':'min $20',
  'История выплат':'Payout history','Заявка на выплату':'Payout request','Июнь · на карту':'June · to card',
  'Май · USDT':'May · USDT','Заявка принята':'Request accepted','PRO · год · уровень 1':'PRO · year · level 1',
  'START · мес · уровень 1':'START · month · level 1','BUSINESS · 6м · уровень 2':'BUSINESS · 6 mo · level 2',
  /* --- тарифы --- */
  '3 мес −10%':'3 mo −10%','6 мес −15%':'6 mo −15%','Год −20%':'Year −20%',
  '/мес при оплате за год · ~1190₽':'/mo billed yearly · ~1190₽','/мес при оплате за год · ~3890₽':'/mo billed yearly · ~3890₽',
  '/мес при оплате за год · ~15900₽':'/mo billed yearly · ~15900₽','Все чаты и сообщества':'All chats & communities',
  '10 проверок видео/мес':'10 video checks/mo','30 проверок видео/мес':'30 video checks/mo',
  'Обучение нейронкам':'AI training','Активация партнёрки':'Partner program activation','Флагман':'Flagship',
  'CRM-лайт':'CRM lite','Полная Система + сайт по клику':'Full System + one-click website',
  'Контент-завод: 30 роликов/мес':'Content factory: 30 videos/mo','Автопостинг во все сети':'Auto-posting to all networks',
  'Приоритетная поддержка':'Priority support','К оплате':'Total','Способ оплаты':'Payment method',
  'Безопасная оплата. Автопродление можно отключить в любой момент.':'Secure payment. Auto-renewal can be turned off anytime.',
  'Проводим оплату…':'Processing payment…','Активация мгновенно после оплаты':'Activated instantly after payment',
  'Лимиты обновлены, партнёрка включена. Спасибо!':'Limits updated, partner program enabled. Thanks!',
  /* --- кошелёк --- */
  'Динамика · 30 дней':'Trend · 30 days','Подписка PRO — автопродление':'PRO subscription — auto-renewal',
  'Выключено — тариф не продлевается сам':'Off — the plan does not renew itself','Выключено':'Off',
  'Лицевой счёт':'Account','Пополнить':'Top up','Вывести':'Withdraw','История':'History',
  'Расходы по категориям':'Spending by category','История операций':'Transaction history','Пополнения':'Deposits',
  'Списания':'Charges','Карта РФ':'Russian card','Крипта USDT':'USDT crypto','Переводы':'Transfers','Прочее':'Other',
  'Продвижение':'Promotion','Комиссия вывода':'Withdrawal fee','Комиссия Биржи 10%':'Marketplace fee 10%',
  'В холде (эскроу):':'On hold (escrow):','Эскроу-защита:':'Escrow protection:',
  'в холде до выполнения заказа':'held until the order is completed','Расходов пока нет — всё в плюсе':'No spending yet — all in the black',
  'Пополнений пока нет':'No deposits yet','Списаний пока нет':'No charges yet','Операций пока нет':'No transactions yet',
  'Номер счёта скопирован:':'Account number copied:','Пополнение счёта':'Top up account','Способ пополнения':'Top-up method',
  'Без комиссии. Мок: в проде — платёжный шлюз OKO.':'No fee. Mock: payment gateway in production.',
  'Укажи сумму пополнения':'Enter a top-up amount','Создаём платёж…':'Creating payment…','Вывод средств':'Withdraw funds',
  'Доступно:':'Available:','Комиссия вывода 2%. Поступление 1–3 рабочих дня.':'2% withdrawal fee. Arrives in 1–3 business days.',
  'Сумма вывода':'Withdrawal amount','Сумма вывода, ₽':'Withdrawal amount, ₽','Комиссия 2%':'2% fee','К получению':'You receive',
  'Укажи сумму вывода':'Enter a withdrawal amount','Оформляем заявку…':'Processing request…',
  'Заявка на вывод создана':'Withdrawal request created','Куда вывести':'Withdraw to',
  'Пополни кошелёк и вернись к оплате.':'Top up your wallet and come back to payment.','Назад к оплате':'Back to payment',
  'Приветственный бонус OKO':'OKO welcome bonus','Недостаточно средств — пополни кошелёк':'Insufficient funds — top up your wallet',
  'Пополнение · Карта РФ':'Deposit · Russian card','Тариф START · 1 мес':'START plan · 1 mo',
  'Игра «Рулетка» · ставка':'Roulette game · bet','Покупка на Бирже: Монтаж Reels под ключ':'Marketplace purchase: Turnkey Reels editing',
  'Продвижение объявления · Турбо':'Listing promotion · Turbo','Перевод в чате · Марк Волков':'Chat transfer · Mark Volkov',
  /* --- игры --- */
  'Игры OKO':'OKO Games','Рулетка OKO':'OKO Roulette','Дорога OKO':'OKO Road','Крутить колесо':'Spin the wheel',
  'Ставка, ₽':'Bet, ₽','История игр':'Game history','Дневной лимит ставок':'Daily bet limit',
  'Ставки — только с кошелька OKO':'Bets come from your OKO wallet only',
  '12 секторов · до ×10 · выплата сразу на кошелёк':'12 sectors · up to ×10 · instant wallet payout',
  'Забрать':'Cash out','Шанс шага':'Step odds','Сейчас':'Now','В кошелёк':'To wallet',
  'Минимальная ставка — 10 ₽':'Minimum bet is 10 ₽','Колесо ещё крутится':'The wheel is still spinning',
  'Ставка в рулетке':'Roulette bet','Выигрыш в рулетке':'Roulette win','Ставка: Дорога OKO':'Bet: OKO Road',
  'Выигрыш: Дорога OKO':'Win: OKO Road','Провал':'Bust','Ставка':'Bet','сектор':'sector','проигрыш':'loss',
  'Ставка сгорела — колесо ждёт реванша':'Bet lost — the wheel awaits a rematch',
  'Ещё нет сыгранных раундов — сделай первую ставку':'No rounds played yet — place your first bet',
  'Ответственная игра.':'Responsible gaming.',
  'Игры OKO доступны только пользователям старше 18 лет. Дневной лимит ставок — 10 000 ₽, сбрасывается в полночь. Это развлечение, а не заработок: на дистанции преимущество всегда у казино. Играй в удовольствие и останавливайся вовремя.':'OKO Games are for users 18+. The daily bet limit is 10,000 ₽ and resets at midnight. This is entertainment, not income: over time the house always has the edge. Play for fun and stop in time.',
  /* --- академия --- */
  'Академия OKO':'OKO Academy','Уроки полного формата · официальные сертификаты':'Full-format lessons · official certificates',
  'Нейросети 2026':'Neural Networks 2026','5 уроков · тесты и практика · сертификат за каждый урок':'5 lessons · quizzes and practice · a certificate for every lesson',
  'Контент и Reels':'Content & Reels','Сценарии, монтаж и вирусные форматы':'Scripts, editing and viral formats',
  'Мои сертификаты':'My certificates',
  'Пройди урок — получи официальный сертификат OKO с печатью и подписью. Он появится здесь.':'Complete a lesson to earn an official OKO certificate with seal and signature. It will appear here.',
  'Карта нейросетей 2026':'Neural network map 2026','Промпт-инжиниринг':'Prompt engineering',
  'Генерация картинок PRO':'Image generation PRO','Видео-нейросети':'Video neural networks','Свой ИИ-ассистент':'Your own AI assistant',
  'формула промпта · few-shot · chain-of-thought':'prompt formula · few-shot · chain-of-thought',
  'агент под бизнес · RAG · Telegram':'business agent · RAG · Telegram','Слайды урока':'Lesson slides',
  'Тест по материалу':'Knowledge quiz','Практика':'Practice','Мини-игра':'Mini-game','мини-игра':'mini-game',
  'Прогресс урока':'Lesson progress','видео в производстве':'video in production','Видео просмотрено':'Video watched',
  'Отметить просмотренным':'Mark as watched','Видео урока в производстве':'Lesson video in production',
  'Сертификат получен':'Certificate earned','Сертификат ещё не выдан':'Certificate not issued yet',
  'Сертификат готов к выдаче':'Certificate ready to issue','Сертификат урока':'Lesson certificate',
  'Получить сертификат':'Get certificate','Скачать PNG':'Download PNG','Проверяется ИИ-куратором':'Checked by the AI curator',
  'Сыграть ещё раз':'Play again','Сопоставь пары.':'Match the pairs.','тест зачтён':'quiz passed','Начать тест':'Start quiz',
  'Сдать работу':'Submit work','Раскрой подробнее — минимум 40 символов':'Add more detail — at least 40 characters',
  'Сначала выбери элемент слева':'Pick an item on the left first','Понятие':'Term','Пара':'Match',
  'Видео засчитано · +20% к уроку':'Video counted · +20% to the lesson','Слайды пройдены · +20% к уроку':'Slides completed · +20% to the lesson',
  'Тест сдан · +20% к уроку':'Quiz passed · +20% to the lesson','Практика зачтена · +20% к уроку':'Practice counted · +20% to the lesson',
  'Мини-игра пройдена · +20% к уроку':'Mini-game completed · +20% to the lesson',
  'Курс «Контент и Reels» уже в производстве':'The Content & Reels course is already in production',
  /* --- реклама --- */
  'метрики live':'live metrics','Создать кампанию':'Create campaign','Модерация ИИ-агентом':'AI-agent moderation',
  'Кампании':'Campaigns','Новая кампания':'New campaign','Заголовок':'Headline','Текст объявления':'Ad text',
  'Контент-завод за 7 дней':'Content factory in 7 days',
  'Что получит человек и почему стоит нажать кнопку':'What the person gets and why they should tap the button',
  'Кнопка (CTA)':'Button (CTA)','Ссылка':'Link','География':'Geography','Возраст':'Age','Прогноз охвата':'Reach forecast',
  'человек в выбранной аудитории':'people in the selected audience','Дневной бюджет, ₽':'Daily budget, ₽',
  'Показы':'Impressions','Клики (CTR 1–4%)':'Clicks (CTR 1–4%)','Списание с лицевого счёта':'Charged to your account',
  'Модерация':'In review','Активна':'Active','Пауза':'Paused','Отклонена':'Rejected','Завершена':'Completed',
  'показы':'impressions','клики':'clicks','потрачено':'spent','спонсировано':'sponsored','Весь мир':'Worldwide',
  'РФ':'Russia','СНГ':'CIS','широкая аудитория':'broad audience','все возрасты':'all ages',
  'Добавь заголовок объявления':'Add a headline','Добавь текст объявления':'Add ad text',
  'Минимальный бюджет — 100 ₽':'Minimum budget is 100 ₽','Кампания отправлена на модерацию ИИ-агенту':'Campaign sent to AI moderation',
  'Реклама отклонена':'Ad rejected','Объявление не активно':'Ad is not active','Клик засчитан':'Click counted',
  'Кампания на паузе — показы остановлены':'Campaign paused — impressions stopped','Бюджет уже исчерпан':'Budget already spent',
  'Кампания снова активна':'Campaign active again','Остановить кампанию?':'Stop the campaign?',
  'Кампания завершена':'Campaign completed','Кампания удалена':'Campaign deleted',
  'OKO Академия — поток №4':'OKO Academy — cohort #4','Партнёрка OKO — 15% с оборота':'OKO partner program — 15% of turnover',
  /* --- биржа / market-pro --- */
  'Поиск услуг и товаров':'Search services & goods','Категории':'Categories','Рекомендуем':'Recommended',
  'Фильтры':'Filters','Цена, ₽':'Price, ₽','Рейтинг продавца':'Seller rating','Мои объявления':'My listings',
  'У тебя пока нет объявлений':'You have no listings yet','ТОП':'TOP','На модерации':'In review','Продано':'Sold',
  'Активно':'Active','Продвижение объявления':'Listing promotion','Продвинуть объявление':'Promote listing',
  'Оплата разовая, списывается с баланса OKO':'One-time payment, charged to your OKO balance','Добавить фото':'Add photo',
  'Например: Монтаж Reels под ключ':'E.g.: Turnkey Reels editing','Например: от 500 ₽':'E.g.: from 500 ₽',
  'Что входит, сроки, условия':'What is included, timeline, terms','Разместить объявление':'Post a listing',
  'Проверка занимает пару минут. Против спама и запрещёнки.':'Review takes a couple of minutes. Against spam and prohibited goods.',
  'Заказать через OKO · безопасно':'Order via OKO · secure','Подтвердить получение':'Confirm delivery',
  'Открыть рабочий чат':'Open work chat','Продажа':'Sale','Покупка':'Purchase','В работе':'In progress',
  'Ожидает подтверждения':'Awaiting confirmation','Работа сдана — ждём подтверждения покупателя':'Work delivered — waiting for buyer confirmation',
  'Получение подтверждено — эскроу снят, деньги ушли исполнителю':'Delivery confirmed — escrow released, funds sent to the seller',
  'Баланс продаж пуст — заверши активные сделки':'Sales balance is empty — finish active deals',
  'Объявлений нет — размести первое на Бирже':'No listings yet — post your first on the Marketplace',
  'Выручка Биржи':'Marketplace revenue','Комиссия OKO 10%':'OKO fee 10%','К выводу':'To withdraw',
  'К выводу после комиссии':'To withdraw after fee','Выручка с завершённых сделок':'Revenue from completed deals',
  'просмотры':'views','контакты':'contacts','заказы':'orders','выручка ₽':'revenue ₽',
  'Пакеты услуг':'Service packages','СТАРТ':'START','БИЗНЕС':'BUSINESS','ФЛАГМАН':'FLAGSHIP',
  'Контент-завод на месяц':'Content factory for a month','30 роликов в месяц под ключ':'30 turnkey videos a month',
  'Что получаешь по неделям':'What you get week by week',
  'Оплата с кошелька OKO · рабочий чат с командой сразу после оплаты':'Paid from your OKO wallet · a team work chat right after payment',
  'Индивидуальный':'Custom','Нестандартная задача или другой масштаб — соберём пакет под тебя.':'A custom task or different scale — we will build a package for you.',
  'Обсудим задачу':'Let us discuss','К оплате с кошелька':'Due from wallet','Баланс кошелька':'Wallet balance',
  'Вернуться к пакетам':'Back to packages',
  'После оплаты создадим рабочий чат: личный ассистент, бриф и ветки работ.':'After payment we create a work chat: personal assistant, brief and work threads.',
  'Личный ассистент OKO':'OKO personal assistant','Контент-завод, дизайн, сайт и реклама командой OKO':'Content factory, design, website and ads by the OKO team',
  'Дизайн':'Design','Сайт':'Website','Отчёты':'Reports','сценарии, съёмка, монтаж, автопостинг':'scripts, shooting, editing, auto-posting',
  'обложки, оформление профиля, креативы':'covers, profile design, creatives','лендинг, домен, воронка продаж':'landing page, domain, sales funnel',
  'кампании, таргет, ретаргет, трафик':'campaigns, targeting, retargeting, traffic',
  'аналитика, метрики, еженедельные итоги':'analytics, metrics, weekly summaries',
  /* --- профиль / настройки --- */
  'Светлая тема':'Light theme','Уведомления':'Notifications','Конфиденциальность':'Privacy','Прогресс сборки':'Build progress',
  'Админка OKO':'OKO Admin','Редактирование':'Edit profile','Изменить фото':'Change photo','О себе':'About',
  'Пара слов о тебе':'A few words about you','Настройки сохраняются автоматически':'Settings save automatically',
  'Прогресс сборки OKO':'OKO build progress','Запуск — 15 июля 2026. Обновляется с каждым этапом.':'Launch — July 15, 2026. Updated at every stage.',
  /* --- верификация --- */
  'Не верифицирован':'Not verified','На рассмотрении':'Under review','Верифицирован':'Verified',
  'Синяя галочка подтверждает подлинность аккаунта для всех в OKO':'The blue check confirms account authenticity for everyone in OKO',
  'Модерация проверяет аккаунт и активность — обычно до 24 часов':'Moderation reviews the account and activity — usually within 24 hours',
  'Аккаунт подтверждён — галочка видна в профиле, ленте и чатах':'Account confirmed — the check shows in your profile, feed and chats',
  'Тариф PRO или BUSINESS':'PRO or BUSINESS plan','Активная подписка на момент подачи и проверки заявки':'An active subscription when applying and during review',
  'Живой аккаунт':'Active account','30+ дней в OKO, регулярные посты и реальная активность':'30+ days in OKO, regular posts and real activity',
  'Либо официальный бизнес':'Or an official business','Подтверждение юрлица или ИП документами — без требования к тарифу':'Company or sole-proprietor documents — no plan required',
  'Подать заявку':'Apply','Проверяем аккаунт…':'Reviewing account…','Условия':'Requirements',
  'Заявка отправлена на модерацию':'Application sent to moderation','Аккаунт верифицирован':'Account verified',
  'Заявка отклонена':'Application rejected','Верифицированный аккаунт':'Verified account',
  'Стикеры TON — в подписке PRO':'TON stickers — with PRO','необязательно':'optional','проверка':'review',
  /* --- PWA --- */
  'OKO на главный экран':'Add OKO to your home screen',
  'Установи OKO как приложение: значок на рабочем столе, полный экран, работает быстрее.':'Install OKO as an app: home screen icon, full screen, runs faster.',
  /* --- админка (владелец) --- */
  'Штаб HQ':'HQ','Доходы':'Revenue','Доход OKO — всего':'OKO revenue — total','за этот месяц':'this month',
  'По источникам':'By source','Сводка за сутки':'Daily summary','Быстрые действия':'Quick actions','Выплаты':'Payouts',
  'Логи агентов':'Agent logs','Последние пользователи':'Recent users','Экспорт CSV':'Export CSV',
  'Партнёры и выплаты':'Partners & payouts','Очередь модерации':'Moderation queue','Пусто — всё проверено.':'Empty — all reviewed.',
  'Логи ИИ-агентов':'AI agent logs','Фича-флаги':'Feature flags','Регистрации':'Sign-ups','Выручка':'Revenue',
  'ИИ-поддержка':'AI support','Email владельца':'Owner email','Раздел владельца':'Owner area','Проверка…':'Checking…',
  'Владелец подтверждён':'Owner confirmed','Доступ запрещён':'Access denied',
  'Пока нет операций — доход копится из комиссий, тарифов и рекламы.':'No transactions yet — revenue accrues from fees, plans and ads.',
  /* --- хаб / категории биржи --- */
  'Документы':'Documents','Избранное':'Saved','Услуги':'Services','Видео и монтаж':'Video & editing',
  'Реклама и трафик':'Ads & traffic','Сайты и приложения':'Websites & apps','Тексты и переводы':'Copy & translation',
  'SMM и ведение':'SMM & management','Аудио и озвучка':'Audio & voiceover','3D и графика':'3D & graphics',
  'Консалтинг и обучение':'Consulting & training',
  /* --- профиль: статистика и бейджи --- */
  'постов':'posts','реакций':'reactions','дней в OKO':'days in OKO','Ранний':'Early','Партнёр':'Partner',
  '100+ реакций':'100+ reactions','Автор':'Author','нет':'no','есть':'yes','Штаб OKO HQ':'OKO HQ','Твоя':'You',
  'Открыть 3D-штаб':'Open the 3D HQ',
  /* --- игры / реклама: добивка --- */
  'Старт — выйти на дорогу':'Start — hit the road',
  'Каждое объявление проверяется автоматически за ~3 секунды: запрещённые тематики, скам, азартные игры. Отклонили — бюджет вернётся на лицевой счёт мгновенно.':'Every ad is checked automatically in ~3 seconds: prohibited topics, scams, gambling. If rejected, the budget returns to your account instantly.',
  'Контент-завод за 7 дней: 30 роликов в месяц на автомате. Старт 20 июля, осталось 14 мест из 50.':'Content factory in 7 days: 30 videos a month on autopilot. Starts July 20, only 14 of 50 seats left.',
  'Приводи авторов и получай 15% с их подписки + 5% со второй линии. Выплаты сразу на лицевой счёт.':'Refer creators and earn 15% of their subscription + 5% from the second line. Paid instantly to your account.',
  /* --- демо-объявления биржи (сид-контент приложения) --- */
  'Монтаж Reels и Shorts под ключ':'Turnkey Reels & Shorts editing','Сайт-визитка и лендинг за 3 дня':'Business card site & landing in 3 days',
  'Дизайн обложек и карточек товара':'Cover & product card design','3D-графика и анимация логотипа':'3D graphics & logo animation',
  'Монтаж Reels под ключ':'Turnkey Reels editing','Лендинг под ключ за 5 дней':'Turnkey landing page in 5 days',
  'Разбор и стратегия роста канала':'Channel audit & growth strategy',
  /* --- шелл / базовый хром (шапка, паволл-баннеры, партнёрка) --- */
  'OKO · экосистема медийности и бизнеса':'OKO · media & business ecosystem',
  'Контент-завод, система и команда OKO':'Content factory, system and the OKO team',
  'Партнёрка 15% + 5%':'Partner program 15% + 5%',
  'Приглашай — получай с каждой продажи':'Invite and earn on every sale',
  'Разблокируй всё — тариф MAX':'Unlock everything — MAX plan',
  /* --- рекламный кабинет (ads) --- */
  'A/B тест':'A/B test','· фото, картинка или видео':'· photo, image or video','Аудитории':'Audiences',
  'Биллинг':'Billing','Биллинг рекламы':'Ad billing','Бюджет кампании, ₽':'Campaign budget, ₽',
  'Вечер':'Evening','Видео':'Video','Время показа':'Time of day','Города':'Cities','День':'Day',
  'Женский':'Female','Картинка':'Image','Любой':'Any','Медиа креатива':'Creative media',
  'Модель оплаты':'Pricing model','Мужской':'Male','Ночь':'Night','Открыть':'Open','ПК':'Desktop',
  'Пол':'Gender','Прогноз кампании':'Campaign forecast','Сохранить аудиторию':'Save audience',
  'Устройства':'Devices','Утро':'Morning','Формат рекламы':'Ad format','Фото':'Photo',
  'Цена 1000 показов (CPM)':'Cost per 1000 impressions (CPM)','Цена клика (CPC)':'Cost per click (CPC)',
  'агрессивнее':'more aggressive',
  'второй вариант заголовка — OKO покажет оба и найдёт лучший по CTR':'a second headline variant — OKO shows both and picks the best by CTR',
  'дешевле':'cheaper','за 1000 показов':'per 1000 impressions','за клик':'per click',
  'образование':'education','рекомендуемая':'recommended','узкая':'narrow','финансы':'finance','широкая':'broad',
  /* --- кошелёк (лимиты, выписка, ПИН) --- */
  'Выключен — включи для защиты вывода':'Off — enable to protect withdrawals','Выписка':'Statement',
  'Выписка по счёту':'Account statement',
  'До 5 000 ₽ — мгновенно, выше — с подтверждением операции':'Up to 5,000 ₽ instantly, above that with confirmation',
  'Лимиты и безопасность':'Limits & security','ПИН-код на вывод':'Withdrawal PIN',
  'Покупки без подтверждения':'Purchases without confirmation','Скачать выписку (.txt)':'Download statement (.txt)',
  'Суточный лимит вывода':'Daily withdrawal limit',
  /* --- регистрация (баннеры шагов) --- */
  'Бесплатный старт':'Free start',
  'Тебе меньше 18 — разделы 18+ (казино-игры, часть биржи и рекламы) будут ограничены до совершеннолетия.':'You are under 18 — 18+ sections (casino games, part of the marketplace and ads) will be limited until you come of age.',
  /* --- профиль / соцграф --- */
  'Аккаунты':'Accounts','Добавить аккаунт':'Add account','Люди':'People','Подписчики':'Followers',
  /* --- игры (колесо призов) --- */
  'Выбери крутку и запусти колесо — приз попадёт в «Мои призы»':'Pick a spin and launch the wheel — the prize lands in "My prizes"',
  'Крути колесо — каждая крутка даёт приз':'Spin the wheel — every spin gives a prize',
  'Лидеры недели':'Weekly leaders','Мои призы':'My prizes','Честная механика.':'Fair mechanics.',
  'Приз выпадает случайно по взвешенным шансам, но каждая крутка гарантированно приносит приз — «сгораний» ставки нет. Средний приз крутки показан заранее. Крути в удовольствие.':'Prizes drop at random by weighted odds, but every spin is guaranteed to win — no burned bets. The average spin prize is shown up front. Spin for fun.',
  /* --- каналы / настройки / академия / сторис --- */
  'Мои каналы':'My channels','Настройки':'Settings','Поделиться':'Share',
  'Опубликовать историю':'Publish story','Просмотры':'Views',
  /* --- TON / подарки (verify-stickers) --- */
  'История TON':'TON history','Мой подарок':'My gift','Подарить другу':'Gift to a friend',
  'Подарок':'Gift','Пополнить TON':'Top up TON','Получить':'Receive',
  'Баланс':'Balance','Адрес получателя':'Recipient address','UQ… адрес TON-кошелька':'UQ… TON wallet address',
  'Вставить':'Paste','Купить ещё':'Buy more','В коллекции:':'In collection:','МАКС':'MAX',
  'Прототип: перевод списывает TON с локального кошелька и попадает в историю. Реальные переводы в сети TON подключатся в релизе через TON Connect.':'Prototype: the transfer deducts TON from your local wallet and lands in history. Real TON network transfers will connect at release via TON Connect.',
  'Честная заглушка: настоящие переводы TON и NFT-подарки подключатся в релизе через TON Connect. Баланс и коллекция хранятся локально на устройстве.':'Honest placeholder: real TON transfers and NFT gifts will connect at release via TON Connect. Balance and collection are stored locally on your device.'
};

/* --- шаблоны для строк с числами (применяются, если точного совпадения нет) --- */
const ST_RX = [
  [/^([\d\s.,]*\d) ?₽ из ([\d\s.,]*\d) ?₽$/, '$1 ₽ of $2 ₽'],
  [/^Урок (\d+) из (\d+)$/, 'Lesson $1 of $2'],
  [/^Урок (\d+) · (.+)$/, (m,a,b)=>'Lesson '+a+' · '+(ST_DICT[b]||b)],
  [/^Урок (\d+)$/, 'Lesson $1'],
  [/^(\d+) уроков?$/, '$1 lessons'],
  [/^Слайд (\d+) \/ (\d+)$/, 'Slide $1 / $2'],
  [/^(\d+) слайдов$/, '$1 slides'],
  [/^тест из (\d+) вопросов$/, 'quiz · $1 questions'],
  [/^Вопрос (\d+) из (\d+)$/, 'Question $1 of $2'],
  [/^Шаг (\d+) из (\d+)$/, 'Step $1 of $2'],
  [/^сборка v([\d.]+)$/, 'build v$1'],
  [/^([\d:]+) · видео \+ слайды \+ тест \+ игра$/, '$1 · video + slides + quiz + game'],
  [/^(\d+) участников$/, '$1 members'],
  [/^(\d+) подписчиков$/, '$1 followers'],
  [/^(\d+) сообщений$/, '$1 messages'],
  [/^(\d+) отзывов$/, '$1 reviews'],
  [/^Отзывы \((\d+)\)$/, 'Reviews ($1)'],
  [/^(\d+) голосов · анонимный$/, '$1 votes · anonymous'],
  [/^(\d+) мин назад$/, '$1 min ago'],
  [/^(\d+) (?:час|часа|часов) назад$/, '$1 h ago'],
  [/^(\d+) (?:день|дня|дней) назад$/, '$1 d ago'],
  [/^(\d+) мин$/, '$1 min'],
  [/^(\d+) сек$/, '$1 sec'],
  [/^(\d+) дней$/, '$1 days'],
  [/^1 день$/, '1 day'],
  [/^([\d\s]+) показов$/, '$1 impressions'],
  [/^от ([\d\s.,]+) ₽$/, 'from $1 ₽'],
  [/^от ([\d\s.,]+) ₽\/мес$/, 'from $1 ₽/mo'],
  [/^Оплатить ([\d\s.,]+ ?₽)$/, 'Pay $1'],
  [/^Заказать пакет · ([\d\s.,]+ ?₽)$/, 'Order package · $1'],
  [/^Пополнить на ([\d\s.,]+ ?₽)$/, 'Top up $1'],
  [/^Следующее списание (.+)$/, 'Next charge $1'],
  [/^Кошелёк пополнен на ([\d\s.,]+ ?₽)$/, 'Wallet topped up by $1'],
  [/^Тест сдан\. Лучший результат — (\d+)%$/, 'Quiz passed. Best score — $1%'],
  [/^Урок пройден на (\d+)%$/, 'Lesson completed at $1%'],
  [/^Сдать тест на (\d+)% и выше$/, 'Pass the quiz at $1%+'],
  [/^Собрано пар: (\d+) · ошибок: (\d+)$/, 'Pairs matched: $1 · mistakes: $2'],
  [/^Медиа (\d+)$/, 'Media $1'],
  [/^Файлы (\d+)$/, 'Files $1'],
  [/^Ссылки (\d+)$/, 'Links $1'],
  [/^PRO до ([\d.]+)$/, 'PRO until $1'],
  [/^Отправить код повторно \((\d+) с\)$/, 'Resend code ($1 s)'],
  [/^([\d.,]+)к$/, '$1k'],
  [/^забрал на ×([\d.,]+)$/, 'cashed out at ×$1'],
  [/^(\d+) объявл\.$/, '$1 listings'],
  [/^сегодня (\d{1,2}:\d{2})$/, 'today $1'],
  [/^вчера (\d{1,2}:\d{2})$/, 'yesterday $1'],
  [/^([\d.,]+)к₽$/, '$1k ₽'],
  [/^из ([\d.,]+)к₽$/, 'of $1k ₽'],
  [/^из ([\d\s.,]+ ?₽)$/, 'of $1'],
  [/^(\d+) агентов$/, '$1 agents'],
  [/^([\d.,]+) · Онлайн$/, '$1 · Online'],
  [/^([\d\s.,]*\d) ?₽ за сегодня$/, '$1 ₽ today'],
  [/^([\d\s.,]*\d) ?₽ бонус$/, '$1 ₽ bonus'],
  [/^(\d+) минут[аоуы]?$/, '$1 min'],
  [/^(\d+) объявлений$/, '$1 listings'],
  [/^(\d+) аккаунтов$/, '$1 accounts'],
  [/^(\d+) каналов$/, '$1 channels'],
  [/^(\d+) просмотров$/, '$1 views'],
  [/^(\d+) призов$/, '$1 prizes'],
  [/^Отправить ([\d\s.,]+) TON$/, 'Send $1 TON'],
  [/^Пополнить TON на ([\d\s.,]+ ?₽)$/, 'Top up TON by $1']
];

/* --- что НЕ переводим: контент пользователей + свои переключатели --- */
const ST_SKIP_TAGS = {SCRIPT:1, STYLE:1, NOSCRIPT:1, IFRAME:1, TEMPLATE:1, VIDEO:1, AUDIO:1, CANVAS:1};
const ST_SKIP_SEL = '.msg, .preview, #legalView, .post .body, .pm-title, #stLangList';
function stSkipEl(el){
  if(ST_SKIP_TAGS[(el.tagName||'').toUpperCase()]) return true;
  try{ if(el.matches && el.matches(ST_SKIP_SEL)) return true; }catch(e){}
  return false;
}

/* --- хранилища оригиналов: WeakMap (значения) + Set (реестр для отката) --- */
let stTxOrig = new WeakMap();      /* текстовый узел -> исходный nodeValue */
let stTxAttrOrig = new WeakMap();  /* элемент -> {attr: исходное значение} */
let stTxNodes = new Set();         /* переведённые текстовые узлы */
let stTxEls = new Set();           /* элементы с переведёнными атрибутами */
const ST_TX_ATTRS = ['placeholder','title','aria-label'];
const ST_CYR = /[А-Яа-яЁё]/;

/* перевод одной строки: точный словарь -> regex-шаблоны; null если перевода нет */
function stTx(s){
  const key = s.replace(/\s+/g,' ').trim();
  if(!key || !ST_CYR.test(key)) return null;
  const hit = ST_DICT[key];
  if(hit !== undefined) return hit;
  if(/\d/.test(key)){
    for(const [re, tpl] of ST_RX){
      if(re.test(key)) return key.replace(re, tpl);
    }
  }
  return null;
}

function stTxTextNode(n){
  const raw = n.nodeValue;
  const tr = stTx(raw);
  if(tr === null) return;
  if(!stTxOrig.has(n)) stTxOrig.set(n, raw);
  stTxNodes.add(n);
  const lead = (raw.match(/^\s*/)||[''])[0], tail = (raw.match(/\s*$/)||[''])[0];
  n.nodeValue = lead + tr + tail;
}

function stTxAttrsOf(el){
  if(!el.getAttribute) return;
  for(const a of ST_TX_ATTRS){
    const v = el.getAttribute(a);
    if(!v) continue;
    const tr = stTx(v);
    if(tr === null) continue;
    let store = stTxAttrOrig.get(el);
    if(!store){ store = {}; stTxAttrOrig.set(el, store); }
    if(!(a in store)) store[a] = v;
    stTxEls.add(el);
    el.setAttribute(a, tr);
  }
}

/* полный проход по DOM (включая скрытые экраны — переключение вкладок не мигает по-русски) */
function stTranslateDom(root){
  root = root || document.body;
  if(!root) return;
  if(root.nodeType === 3){ stTxTextNode(root); return; }
  if(root.nodeType !== 1 && root.nodeType !== 11) return;
  if(root.nodeType === 1){
    if(stSkipEl(root)) return;
    stTxAttrsOf(root);
  }
  const w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(n){
      if(n.nodeType === 1){
        if(stSkipEl(n)) return NodeFilter.FILTER_REJECT;
        stTxAttrsOf(n);           /* placeholder/title/aria-label по пути */
        return NodeFilter.FILTER_SKIP;
      }
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  let n; while((n = w.nextNode())) stTxTextNode(n);
}

/* мгновенный и точный откат на русский */
function stRestoreAll(){
  stTxNodes.forEach(n=>{ const o = stTxOrig.get(n); if(o !== undefined) n.nodeValue = o; });
  stTxEls.forEach(el=>{
    const s = stTxAttrOrig.get(el);
    if(s) for(const a in s) el.setAttribute(a, s[a]);
  });
  stTxNodes = new Set(); stTxEls = new Set();
  stTxOrig = new WeakMap(); stTxAttrOrig = new WeakMap();
}

/* --- MutationObserver: только childList+subtree (БЕЗ characterData — не зациклится), debounce 120мс.
       Активен только при LANG==='en'; покрывает попапы/шиты/экраны, появившиеся после переключения. --- */
let stMo = null, stMoTimer = 0;
const stMoQueue = new Set();
function stMoFlush(){
  stMoTimer = 0;
  if(typeof LANG !== 'undefined' && LANG !== 'en'){ stMoQueue.clear(); return; }
  stMoQueue.forEach(n=>{ if(n.isConnected) stTranslateDom(n); });
  stMoQueue.clear();
}
function stObserverOn(){
  if(stMo) return;
  stMo = new MutationObserver(recs=>{
    for(const r of recs) for(const n of r.addedNodes) stMoQueue.add(n);
    if(stMoQueue.size && !stMoTimer) stMoTimer = setTimeout(stMoFlush, 120);
  });
  stMo.observe(document.body, {childList:true, subtree:true});
}
function stObserverOff(){
  if(stMo){ stMo.disconnect(); stMo = null; }
  if(stMoTimer){ clearTimeout(stMoTimer); stMoTimer = 0; }
  stMoQueue.clear();
}

/* связка с setLang: EN -> полный проход + observer; RU -> откат + observer выкл */
function stSyncDomLang(l){
  if(l === 'en'){ stTranslateDom(document.body); stObserverOn(); }
  else { stObserverOff(); stRestoreAll(); }
}

/* ---------- вставка строк в профиль ---------- */
function stInsertRows(){
  if(document.getElementById('stLangRow')) return;
  const admin = document.getElementById('prowAdmin');
  const card = admin ? admin.parentElement : document.querySelector('#screen-profile .card');
  if(!card) return;

  const langRow = document.createElement('button');
  langRow.className = 'prow'; langRow.id = 'stLangRow';
  langRow.onclick = stOpenLang;
  langRow.innerHTML = `${I('globe')} <span id="stLangText">${t('st.row.lang')}</span>` +
    `<span class="st-cur" id="stLangCur">${LANG==='en'?'English':'Русский'}</span>` +
    `<span class="chev">${I('chev')}</span>`;

  const autoRow = document.createElement('button');
  autoRow.className = 'prow'; autoRow.id = 'stAutoRow';
  autoRow.onclick = stToggleAuto;
  autoRow.innerHTML = `${I('st-translate')} ${t('st.row.auto')} ` +
    `<span class="switch ${ST_STATE.auto?'on':''}" id="stAutoSwitch"><i></i></span>`;

  if(admin){ card.insertBefore(langRow, admin); card.insertBefore(autoRow, admin); }
  else { card.appendChild(langRow); card.appendChild(autoRow); }
}

/* ---------- своя SVG-иконка «перевод» (штрих как у ядра: stroke 7, округлые концы) ---------- */
function stAddIcon(){
  const defs = document.querySelector('svg defs');
  if(!defs || document.getElementById('i-st-translate')) return;
  const s = document.createElementNS('http://www.w3.org/2000/svg','symbol');
  s.setAttribute('id','i-st-translate'); s.setAttribute('viewBox','0 0 100 100');
  s.innerHTML = '<g fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M14 70 L30 26 L46 70"/><path d="M20 55 h20"/>' +
    '<path d="M60 32 h28"/><path d="M60 46 h28"/><path d="M60 60 h18"/>' +
    '<path d="M84 60 l-7 12"/></g>';
  defs.appendChild(s);
}

/* ---------- самоинициализация ---------- */
(function stInit(){
  stAddIcon();
  stInsertRows();

  /* chain-патч renderMsgs ядра: после каждого рендера — DOM-проход бейджей */
  if(typeof renderMsgs === 'function'){
    const _stPrevRenderMsgs = renderMsgs;
    renderMsgs = function(){
      _stPrevRenderMsgs.apply(this, arguments);
      stMarkTranslated();
    };
  }

  onLangChange(stApplyLang);

  /* язык уже персистится в setLang (oko-lang); при загрузке применяем сохранённый EN напрямую */
  if(LANG === 'en') stApplyLang('en');
})();
