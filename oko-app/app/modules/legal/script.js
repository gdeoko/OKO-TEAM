/* ================= LEGAL: юридические документы OKO (префикс lg-) =================
   Оферта / Политика конфиденциальности / Пользовательское соглашение / Согласие на ПД /
   Политика возврата / Лицензионное соглашение — RU + EN.
   Публичное API:
     openLegalHub()               — открыть главный экран Legal (карточки-документы)
     openLegalDoc(kind)           — открыть конкретный документ (kind ∈ LG_DOCS)
     openLegalDeal({...})         — открыть авто-заполненный договор-акт по сделке
     closeLegalDoc()              — закрыть вьюху Legal целиком
   Печать (sealSvg) и подпись (signatureImg) — из core-ext. */

/* ---------- состояние (localStorage oko-legal) ---------- */
const lgS = (()=>{ try{ return JSON.parse(localStorage.getItem('oko-legal'))||null; }catch(e){ return null; } })() || { lang: (typeof LANG!=='undefined'?LANG:'ru') };
function lgSave(){ try{ localStorage.setItem('oko-legal', JSON.stringify(lgS)); }catch(e){} }
let lgKind = null;         // текущий открытый документ; null → показан hub
let lgDealCtx = null;      // контекст авто-договора по сделке (для kind === 'deal')

const LG_TABS = [
  {k:'offer',   ru:'Оферта',            en:'Offer'},
  {k:'privacy', ru:'Конфиденциальность',en:'Privacy'},
  {k:'terms',   ru:'Соглашение',        en:'Terms'},
  {k:'refund',  ru:'Возврат',           en:'Refund'},
  {k:'license', ru:'Лицензия ПО',       en:'Software licence'},
  {k:'consent', ru:'Согласие на ПД',    en:'Data consent'}
];

/* карточки на hub — иконка + короткое описание */
const LG_HUB_CARDS = [
  {k:'offer',   ico:'money',   ru:{t:'Публичная оферта',                s:'Договор возмездных услуг сервиса OKO'},                 en:{t:'Public Offer',                  s:'Paid-services agreement for the OKO service'}},
  {k:'privacy', ico:'lock',    ru:{t:'Политика конфиденциальности',      s:'Обработка и защита персональных данных'},               en:{t:'Privacy Policy',                s:'Processing and protection of personal data'}},
  {k:'terms',   ru:{t:'Пользовательское соглашение',                    s:'Правила использования платформы'},                       en:{t:'Terms of Service',              s:'Rules of using the platform'},                        ico:'file'},
  {k:'refund',  ru:{t:'Политика возврата',                              s:'Порядок возврата подписок и внутренних платежей'},       en:{t:'Refund Policy',                 s:'Refunds for subscriptions and in-app charges'},        ico:'card'},
  {k:'license', ru:{t:'Лицензия на ПО',                                 s:'Условия использования приложения OKO'},                  en:{t:'Software Licence',              s:'Terms of use for the OKO application'},                ico:'bolt'},
  {k:'consent', ru:{t:'Согласие на обработку ПД',                       s:'152-ФЗ: цели, сроки, отзыв согласия'},                   en:{t:'Personal-data Consent',         s:'FZ-152: purposes, terms, withdrawal'},                 ico:'check'}
];

/* ---------- общие реквизиты ---------- */
const LG_REQ = {
  ru: {
    op: 'Индивидуальный предприниматель Ильясов Даниэль Альбертович',
    brand: 'Проект «ОКО PROJECT»',
    inn: 'ИНН 682016634349',
    geo: 'г. Москва, Российская Федерация · представительство: г. Дубай, ОАЭ',
    mail: 'okoteam.top@gmail.com',
    sig: 'Ильясов Д.А. / Индивидуальный предприниматель',
    date: '21 июля 2026 г.'
  },
  en: {
    op: 'Sole Proprietor Ilyasov Daniel Albertovich',
    brand: '"OKO PROJECT"',
    inn: 'Taxpayer ID (INN) 682016634349',
    geo: 'Moscow, Russian Federation · representative office: Dubai, UAE',
    mail: 'okoteam.top@gmail.com',
    sig: 'D. A. Ilyasov / Sole Proprietor',
    date: 'July 21, 2026'
  }
};

/* ================================================================
   ТЕКСТЫ ДОКУМЕНТОВ. secs: массив {h, b} — заголовок и HTML-тело.
   ================================================================ */
const LG_DOCS = {

/* ============================ ОФЕРТА ============================ */
offer: {
ru: { title:'Публичная оферта', rev:'Редакция № 4', secs:[
{h:'Общие положения и акцепт', b:
`<p>Настоящий документ является официальным предложением (публичной офертой) Индивидуального предпринимателя Ильясова Даниэля Альбертовича (ИНН 682016634349, г. Москва, Российская Федерация; представительство: г. Дубай, ОАЭ), далее — <b>«Оператор»</b>, заключить договор возмездного оказания услуг сервиса OKO на изложенных ниже условиях в соответствии со ст. 435, 437 и 438 Гражданского кодекса РФ.</p>
<p>Полным и безоговорочным акцептом оферты признаётся любое из действий: регистрация аккаунта в приложении OKO, оплата тарифа, пополнение лицевого счёта либо фактическое использование любой функции Сервиса. С момента акцепта договор считается заключённым.</p>`},
{h:'Термины', b:
`<ul>
<li><b>Сервис (OKO)</b> — программный комплекс Оператора: мобильное и веб-приложение OKO, включая мессенджер, социальную ленту, биржу услуг, академию, игровой раздел, рекламный кабинет, партнёрскую программу и лицевой счёт.</li>
<li><b>Пользователь</b> — дееспособное физическое лицо либо представитель юридического лица, акцептовавшие оферту.</li>
<li><b>Лицевой счёт</b> — внутренний учётный счёт Пользователя в Сервисе, отражающий баланс средств для оплаты услуг.</li>
<li><b>Биржа</b> — раздел Сервиса для заключения сделок между заказчиками и исполнителями услуг.</li>
<li><b>Эскроу</b> — механика блокировки средств заказчика до подтверждения приёмки работы.</li>
<li><b>Тариф</b> — объём платного функционала (START, PRO, BUSINESS) на выбранный период.</li>
</ul>`},
{h:'Предмет договора', b:
`<p>Оператор предоставляет Пользователю право использования Сервиса в пределах его функциональных возможностей: обмен сообщениями и звонки, публикация контента в социальной ленте, размещение и заказ услуг на Бирже, обучение в Академии, участие в играх (18+), размещение рекламы через рекламный кабинет, участие в партнёрской программе и операции по лицевому счёту.</p>
<p>Базовый функционал предоставляется бесплатно. Расширенный функционал предоставляется по подписке согласно выбранному Тарифу.</p>`},
{h:'Тарифы и порядок оплаты', b:
`<div class="lg-table-wrap"><table class="lg-table">
<tr><th>Тариф</th><th>Цена / мес*</th><th>Состав</th></tr>
<tr><td>START</td><td>990&nbsp;₽</td><td>Мессенджер Premium (файлы до 4 ГБ, транскрипция голосовых), магазин шаблонов, каталог трендов, 30 проверок видео в месяц, активация партнёрской программы.</td></tr>
<tr><td>PRO</td><td>4&nbsp;900&nbsp;₽</td><td>Персональная система роста, личный помощник OKO (300 обращений), студия контента (100 генераций), 100 проверок видео и 20 автоправок в месяц, аналитика 3 каналов.</td></tr>
<tr><td>BUSINESS</td><td>19&nbsp;900&nbsp;₽</td><td>Контент-производство 30–50 роликов в месяц, команда специалистов OKO под проект, автопостинг во все привязанные соцсети, приоритетная поддержка, командные аккаунты (до 3).</td></tr>
<tr><td>BUSINESS&nbsp;PRO</td><td>49&nbsp;900&nbsp;₽</td><td>Контент-производство 100 роликов в месяц, персональный образ (двойник голоса и лица), безлимитные помощник и студия, API-доступ, до 5 командных аккаунтов, бонус: лендинг и бот при годовой оплате.</td></tr>
<tr><td>MAX</td><td>149&nbsp;900&nbsp;₽</td><td>Контент-производство 300 роликов в месяц, полная команда специалистов OKO с персональным менеджером, полный digital-запуск (сайт, бот, автоматизации) при годовой оплате, до 15 командных аккаунтов, white-label.</td></tr>
</table></div>
<p class="lg-note">* Указана цена за месяц при оплате за год. Скидки периодов от базовой месячной цены: 3 месяца — 10%, 6 месяцев — 15%, 12 месяцев — 20%.</p>
<p>Способы оплаты: банковские карты РФ, криптовалюта, платёжная платформа Lava.top. Цены могут указываться в долларах США; фактическое списание производится в валюте платёжного метода по курсу на дату платежа. Подписка продлевается автоматически на аналогичный период; автопродление отключается в настройках до даты списания.</p>`},
{h:'Лицевой счёт и списания', b:
`<p>Пополнение лицевого счёта производится способами, указанными в разделе 4. Все внутренние платежи (услуги Биржи, реклама, игровой раздел, платные функции) списываются с лицевого счёта в момент подтверждения операции Пользователем.</p>
<p>Средства на лицевом счёте не являются вкладом, на них не начисляются проценты; лицевой счёт не является банковским счётом или электронным средством платежа кредитной организации. История операций доступна Пользователю в разделе «Кошелёк» без ограничения срока.</p>`},
{h:'Биржа услуг: комиссия и эскроу', b:
`<p>При оформлении заказа на Бирже сумма сделки блокируется на лицевом счёте заказчика (эскроу) и перечисляется исполнителю после подтверждения заказчиком приёмки работы либо автоматически по истечении 7 дней с момента сдачи работы при отсутствии претензий.</p>
<p>Комиссия Сервиса составляет <b>10%</b> от суммы сделки и удерживается с исполнителя при успешном завершении. При споре стороны обязаны пройти арбитраж Сервиса; решение арбитража о распределении заблокированных средств обязательно для сторон в рамках Сервиса.</p>
<p>Вывод средств с лицевого счёта на внешние реквизиты — комиссия <b>2%</b> от суммы вывода, срок исполнения до 5 рабочих дней. Оператор вправе запросить подтверждение личности при выводе.</p>`},
{h:'Партнёрская программа', b:
`<p>Пользователь получает вознаграждение от платежей приглашённых им пользователей: <b>15%</b> — от платежей рефералов первого уровня, <b>5%</b> — от платежей рефералов второго уровня. Вознаграждение начисляется на лицевой счёт в момент успешного платежа реферала.</p>
<p>Запрещены самореферальство, накрутка, спам-привлечение и иной фрод. Нарушение влечёт аннулирование начисленных вознаграждений и отключение от программы.</p>`},
{h:'Возвраты', b:
`<p>Пользователь вправе отказаться от оплаченной подписки в течение 14 календарных дней с момента оплаты при условии, что платный функционал фактически не использовался, — возврат производится в полном объёме тем же способом оплаты.</p>
<p>При технической невозможности оказания услуг по вине Оператора возврат производится пропорционально неиспользованному периоду. Средства, израсходованные на сделки Биржи, рекламу и игровой раздел, возврату не подлежат, за исключением случаев, прямо предусмотренных законом.</p>
<p>Заявление о возврате направляется на okoteam.top@gmail.com; срок рассмотрения — 10 рабочих дней.</p>`},
{h:'Ответственность сторон', b:
`<p>Сервис предоставляется «как есть». Оператор не отвечает за содержание пользовательского контента, а также за исполнение обязательств между заказчиками и исполнителями Биржи, кроме функций эскроу и арбитража.</p>
<p>Совокупная ответственность Оператора по договору ограничена суммой платежей Пользователя за последние 3 месяца. Пользователь несёт ответственность за достоверность предоставленных данных и сохранность доступа к своему аккаунту.</p>`},
{h:'Форс-мажор', b:
`<p>Стороны освобождаются от ответственности за неисполнение обязательств вследствие обстоятельств непреодолимой силы: стихийные бедствия, военные действия, акты органов власти, аварии сетей связи и энергоснабжения, массовые сбои платёжных систем. Сторона, для которой наступили такие обстоятельства, уведомляет другую сторону в разумный срок.</p>`},
{h:'Срок действия и изменение оферты', b:
`<p>Договор действует с момента акцепта бессрочно. Оператор вправе изменять условия оферты, публикуя новую редакцию в приложении; о существенных изменениях Пользователи уведомляются не позднее чем за 10 дней до вступления в силу. Продолжение использования Сервиса после вступления изменений в силу означает согласие с новой редакцией.</p>`},
{h:'Реквизиты Оператора', b:
`<p><b>ИП Ильясов Даниэль Альбертович</b> · ИНН 682016634349 · г. Москва, Российская Федерация · представительство: г. Дубай, ОАЭ · e-mail: okoteam.top@gmail.com.</p>`}
]},
en: { title:'Public Offer Agreement', rev:'Revision No. 4', secs:[
{h:'General Provisions and Acceptance', b:
`<p>This document is an official proposal (public offer) of Sole Proprietor Ilyasov Daniel Albertovich (Taxpayer ID 682016634349, Moscow, Russian Federation; representative office: Dubai, UAE), hereinafter the <b>"Operator"</b>, to conclude a paid services agreement for the OKO service on the terms below, pursuant to Articles 435, 437 and 438 of the Civil Code of the Russian Federation.</p>
<p>Full and unconditional acceptance of this offer is any of the following: registering an account in the OKO app, paying for a plan, topping up the personal account, or actually using any feature of the Service. The agreement is deemed concluded upon acceptance.</p>`},
{h:'Definitions', b:
`<ul>
<li><b>Service (OKO)</b> — the Operator's software suite: the OKO mobile and web application, including the messenger, social feed, services marketplace, academy, games section, advertising cabinet, affiliate program and personal account.</li>
<li><b>User</b> — a legally capable individual or a representative of a legal entity who has accepted this offer.</li>
<li><b>Personal Account</b> — the User's internal ledger within the Service reflecting the balance of funds for paying for services.</li>
<li><b>Marketplace</b> — the section of the Service for transactions between clients and service providers.</li>
<li><b>Escrow</b> — the mechanism of holding the client's funds until acceptance of the work is confirmed.</li>
<li><b>Plan</b> — the scope of paid functionality (START, PRO, BUSINESS) for a selected period.</li>
</ul>`},
{h:'Subject Matter', b:
`<p>The Operator grants the User the right to use the Service within its functionality: messaging and calls, publishing content in the social feed, offering and ordering services on the Marketplace, learning in the Academy, participation in games (18+), placing advertising via the advertising cabinet, participation in the affiliate program, and operations on the personal account.</p>
<p>Basic functionality is free of charge. Extended functionality is provided by subscription according to the selected Plan.</p>`},
{h:'Plans and Payment', b:
`<div class="lg-table-wrap"><table class="lg-table">
<tr><th>Plan</th><th>Price / mo*</th><th>Includes</th></tr>
<tr><td>START</td><td>990&nbsp;RUB (~$10)</td><td>Premium messenger (files up to 4 GB, voice transcription), templates marketplace, trends catalog, 30 video checks per month, affiliate program activation.</td></tr>
<tr><td>PRO</td><td>4&nbsp;900&nbsp;RUB (~$49)</td><td>Personal growth system, OKO Personal Assistant (300 requests), Content Studio (100 generations), 100 video checks and 20 auto-fixes per month, analytics for 3 channels.</td></tr>
<tr><td>BUSINESS</td><td>19&nbsp;900&nbsp;RUB (~$199)</td><td>Content production 30–50 videos per month, dedicated OKO specialists on your project, autoposting to all connected social networks, priority support, up to 3 team accounts.</td></tr>
<tr><td>BUSINESS&nbsp;PRO</td><td>49&nbsp;900&nbsp;RUB (~$499)</td><td>Content production 100 videos per month, Personal Image (voice and face twin), unlimited assistant and studio, API access, up to 5 team accounts, bonus: landing page and bot with annual payment.</td></tr>
<tr><td>MAX</td><td>149&nbsp;900&nbsp;RUB (~$1499)</td><td>Content production 300 videos per month, full OKO specialists team with a dedicated manager, complete digital launch (website, bot, automations) with annual payment, up to 15 team accounts, white-label.</td></tr>
</table></div>
<p class="lg-note">* Monthly price with annual billing. Period discounts off the base monthly price: 3 months — 10%, 6 months — 15%, 12 months — 20%.</p>
<p>Payment methods: Russian bank cards, cryptocurrency, and the Lava.top payment platform. Prices may be quoted in US dollars; the actual charge is made in the currency of the payment method at the exchange rate on the payment date. Subscriptions renew automatically for the same period; auto-renewal can be disabled in the settings before the billing date.</p>`},
{h:'Personal Account and Charges', b:
`<p>The personal account is topped up using the methods listed in Section 4. All internal payments (Marketplace services, advertising, games, paid features) are debited from the personal account at the moment the User confirms the operation.</p>
<p>Funds on the personal account are not a deposit and bear no interest; the personal account is not a bank account or an electronic payment instrument of a credit institution. The transaction history is available to the User in the Wallet section without any time limit.</p>`},
{h:'Marketplace: Commission and Escrow', b:
`<p>When an order is placed on the Marketplace, the transaction amount is held on the client's personal account (escrow) and transferred to the provider after the client confirms acceptance of the work, or automatically 7 days after delivery if no claims are raised.</p>
<p>The Service commission is <b>10%</b> of the transaction amount, withheld from the provider upon successful completion. In case of a dispute the parties must use the Service arbitration; its decision on the distribution of the held funds is binding within the Service.</p>
<p>Withdrawal of funds from the personal account to external details is subject to a <b>2%</b> fee and is processed within 5 business days. The Operator may request identity verification upon withdrawal.</p>`},
{h:'Affiliate Program', b:
`<p>The User receives remuneration from payments made by the users they invite: <b>15%</b> of first-level referral payments and <b>5%</b> of second-level referral payments. Remuneration is credited to the personal account at the moment of the referral's successful payment.</p>
<p>Self-referrals, artificial inflation, spam acquisition and other fraud are prohibited and result in cancellation of accrued remuneration and exclusion from the program.</p>`},
{h:'Refunds', b:
`<p>The User may cancel a paid subscription within 14 calendar days of payment provided the paid functionality has not actually been used — a full refund is issued via the original payment method.</p>
<p>If the services cannot be provided for technical reasons attributable to the Operator, a refund is issued pro rata for the unused period. Funds spent on Marketplace transactions, advertising and the games section are non-refundable except as expressly required by law.</p>
<p>Refund requests are sent to okoteam.top@gmail.com; processing time is 10 business days.</p>`},
{h:'Liability', b:
`<p>The Service is provided "as is". The Operator is not responsible for user-generated content or for the performance of obligations between Marketplace clients and providers, except for the escrow and arbitration functions.</p>
<p>The Operator's aggregate liability under the agreement is limited to the amount of the User's payments over the last 3 months. The User is responsible for the accuracy of the data provided and for safeguarding access to their account.</p>`},
{h:'Force Majeure', b:
`<p>The parties are released from liability for non-performance caused by force majeure: natural disasters, military actions, acts of public authorities, failures of communication and power networks, and mass outages of payment systems. The affected party shall notify the other party within a reasonable time.</p>`},
{h:'Term and Amendments', b:
`<p>The agreement takes effect upon acceptance and remains in force indefinitely. The Operator may amend the offer by publishing a new revision in the app; Users are notified of material changes at least 10 days before they take effect. Continued use of the Service after the changes take effect constitutes consent to the new revision.</p>`},
{h:'Operator Details', b:
`<p><b>Sole Proprietor Ilyasov Daniel Albertovich</b> · Taxpayer ID (INN) 682016634349 · Moscow, Russian Federation · representative office: Dubai, UAE · e-mail: okoteam.top@gmail.com.</p>`}
]}
},

/* ===================== КОНФИДЕНЦИАЛЬНОСТЬ ===================== */
privacy: {
ru: { title:'Политика конфиденциальности', rev:'Редакция № 4', secs:[
{h:'Общие положения', b:
`<p>Настоящая Политика определяет порядок обработки и защиты персональных данных пользователей приложения OKO. Оператор персональных данных — ИП Ильясов Даниэль Альбертович (ИНН 682016634349, г. Москва, РФ; представительство: г. Дубай, ОАЭ).</p>
<p>Обработка ведётся в соответствии с Федеральным законом от 27.07.2006 № 152-ФЗ «О персональных данных»; для пользователей из Европейской экономической зоны дополнительно применяются принципы GDPR: законность, минимизация данных, ограничение целей и сроков хранения, прозрачность.</p>`},
{h:'Состав обрабатываемых данных', b:
`<ul>
<li><b>Данные аккаунта:</b> имя, никнейм, адрес электронной почты, номер телефона, аватар, идентификаторы входа (Telegram ID, Google, Apple).</li>
<li><b>Данные профиля и анкеты:</b> сведения о деятельности, навыках и целях, заполняемые пользователем добровольно.</li>
<li><b>Платёжные метаданные:</b> суммы, даты и статусы операций, идентификаторы транзакций платёжных провайдеров. Полные номера банковских карт Оператор не получает и не хранит.</li>
<li><b>Контент:</b> сообщения, посты, отклики на Бирже, материалы, загружаемые в Сервис.</li>
<li><b>Технические данные:</b> IP-адрес, тип устройства и ОС, язык, cookies, журналы событий (логи).</li>
<li><b>Статистика использования:</b> обезличенные метрики активности в разделах Сервиса.</li>
</ul>`},
{h:'Цели обработки', b:
`<ul>
<li>Регистрация, аутентификация и работа аккаунта.</li>
<li>Исполнение договора: подписки, сделки Биржи, эскроу, выводы средств, партнёрские начисления.</li>
<li>Модерация контента и обеспечение безопасности, предотвращение мошенничества.</li>
<li>Поддержка пользователей и обратная связь.</li>
<li>Улучшение Сервиса на основе обезличенной аналитики.</li>
<li>Информирование о работе Сервиса; рекламные рассылки — только с отдельного согласия, с возможностью отказа в один клик.</li>
</ul>`},
{h:'Правовые основания', b:
`<p>Основаниями обработки являются: исполнение договора (публичной оферты), согласие субъекта персональных данных, законные интересы Оператора (безопасность, защита от фрода) и исполнение требований законодательства (бухгалтерский и налоговый учёт).</p>`},
{h:'Cookies и аналитика', b:
`<p>Сервис использует cookies и аналогичные технологии: обязательные (сессия, безопасность), функциональные (настройки темы и языка) и аналитические (обезличенная статистика). Пользователь может ограничить cookies в настройках браузера или устройства; обязательные cookies необходимы для работы Сервиса.</p>`},
{h:'Передача данных третьим лицам', b:
`<p>Данные передаются только в объёме, необходимом для конкретной цели:</p>
<ul>
<li>Платёжным провайдерам (Lava.top, банковские и криптовалютные процессинги) — для проведения платежей.</li>
<li>Поставщикам облачной инфраструктуры и хостинга — для хранения и обработки данных по поручению Оператора.</li>
<li>Telegram — при входе через Telegram-аккаунт.</li>
<li>Государственным органам — исключительно по законному запросу.</li>
</ul>
<p>Оператор не продаёт персональные данные и не передаёт их третьим лицам для их собственных маркетинговых целей.</p>`},
{h:'Хранение и сроки', b:
`<p>Запись, систематизация, накопление, хранение, уточнение и извлечение персональных данных граждан РФ осуществляются с использованием баз данных на территории РФ (ч. 5 ст. 18 152-ФЗ).</p>
<p>Сроки: данные аккаунта — на период действия аккаунта и 3 года после его удаления (для разрешения споров и по требованиям закона); документы об операциях — 5 лет; технические логи — 12 месяцев. По истечении сроков данные удаляются либо обезличиваются.</p>`},
{h:'Права пользователя', b:
`<ul>
<li>Получить сведения об обработке и копию своих данных.</li>
<li>Требовать уточнения, блокирования или удаления данных («право быть забытым»).</li>
<li>Отозвать согласие на обработку в любой момент.</li>
<li>Получить данные в структурированном машиночитаемом формате (переносимость).</li>
<li>Возразить против обработки, основанной на законном интересе.</li>
<li>Обжаловать действия Оператора в Роскомнадзоре либо ином надзорном органе по месту нахождения пользователя.</li>
</ul>
<p>Запросы направляются на okoteam.top@gmail.com; срок ответа — 30 дней.</p>`},
{h:'Защита данных', b:
`<p>Применяются организационные и технические меры: шифрование каналов связи (TLS), хеширование паролей, разграничение доступа сотрудников по принципу минимальной необходимости, резервное копирование, журналирование доступа. При инциденте, создающем угрозу правам субъектов, Оператор уведомляет надзорный орган и затронутых пользователей в установленные законом сроки.</p>`},
{h:'Возрастные ограничения', b:
`<p>Сервис предназначен для лиц старше 16 лет; игровой раздел — строго 18+. Оператор не осуществляет намеренный сбор данных детей. При обнаружении аккаунта, созданного лицом младше допустимого возраста, аккаунт и связанные данные удаляются.</p>`},
{h:'Изменения и контакты', b:
`<p>Оператор вправе обновлять Политику; новая редакция публикуется в приложении с указанием даты. Продолжение использования Сервиса означает согласие с обновлённой Политикой.</p>
<p>Вопросы по обработке персональных данных: <b>okoteam.top@gmail.com</b>.</p>`}
]},
en: { title:'Privacy Policy', rev:'Revision No. 4', secs:[
{h:'General Provisions', b:
`<p>This Policy defines how personal data of OKO app users is processed and protected. The data controller is Sole Proprietor Ilyasov Daniel Albertovich (Taxpayer ID 682016634349, Moscow, Russian Federation; representative office: Dubai, UAE).</p>
<p>Processing is carried out in accordance with Russian Federal Law No. 152-FZ "On Personal Data" of 27.07.2006; for users from the European Economic Area the GDPR principles additionally apply: lawfulness, data minimisation, purpose and storage limitation, and transparency.</p>`},
{h:'Data We Process', b:
`<ul>
<li><b>Account data:</b> name, nickname, e-mail address, phone number, avatar, sign-in identifiers (Telegram ID, Google, Apple).</li>
<li><b>Profile data:</b> information about activities, skills and goals provided voluntarily by the user.</li>
<li><b>Payment metadata:</b> amounts, dates and statuses of operations, transaction identifiers of payment providers. The Operator never receives or stores full bank card numbers.</li>
<li><b>Content:</b> messages, posts, Marketplace bids, and materials uploaded to the Service.</li>
<li><b>Technical data:</b> IP address, device and OS type, language, cookies, event logs.</li>
<li><b>Usage statistics:</b> anonymised activity metrics across the Service.</li>
</ul>`},
{h:'Purposes of Processing', b:
`<ul>
<li>Registration, authentication and account operation.</li>
<li>Performance of the agreement: subscriptions, Marketplace transactions, escrow, withdrawals, affiliate accruals.</li>
<li>Content moderation, security and fraud prevention.</li>
<li>User support and feedback.</li>
<li>Improving the Service based on anonymised analytics.</li>
<li>Service notifications; marketing communications — only with separate consent, with one-click opt-out.</li>
</ul>`},
{h:'Legal Bases', b:
`<p>Processing is based on: performance of the agreement (the public offer), the data subject's consent, the Operator's legitimate interests (security, fraud prevention), and compliance with legal obligations (accounting and tax requirements).</p>`},
{h:'Cookies and Analytics', b:
`<p>The Service uses cookies and similar technologies: essential (session, security), functional (theme and language preferences) and analytical (anonymised statistics). Users may restrict cookies in their browser or device settings; essential cookies are required for the Service to operate.</p>`},
{h:'Disclosure to Third Parties', b:
`<p>Data is shared only to the extent necessary for a specific purpose:</p>
<ul>
<li>Payment providers (Lava.top, bank and cryptocurrency processors) — to process payments.</li>
<li>Cloud infrastructure and hosting providers — to store and process data on behalf of the Operator.</li>
<li>Telegram — when signing in with a Telegram account.</li>
<li>Public authorities — solely upon a lawful request.</li>
</ul>
<p>The Operator does not sell personal data and does not share it with third parties for their own marketing purposes.</p>`},
{h:'Storage and Retention', b:
`<p>Recording, systematisation, accumulation, storage, clarification and retrieval of personal data of Russian citizens are performed using databases located in the Russian Federation (Art. 18(5) of Law 152-FZ).</p>
<p>Retention periods: account data — for the lifetime of the account plus 3 years after deletion (for dispute resolution and legal requirements); transaction records — 5 years; technical logs — 12 months. Upon expiry, data is deleted or anonymised.</p>`},
{h:'Your Rights', b:
`<ul>
<li>Obtain information about processing and a copy of your data.</li>
<li>Request rectification, restriction or erasure of data (the "right to be forgotten").</li>
<li>Withdraw consent to processing at any time.</li>
<li>Receive your data in a structured, machine-readable format (portability).</li>
<li>Object to processing based on legitimate interest.</li>
<li>Lodge a complaint with Roskomnadzor or another supervisory authority at your location.</li>
</ul>
<p>Requests are sent to okoteam.top@gmail.com; the response time is 30 days.</p>`},
{h:'Data Security', b:
`<p>Organisational and technical measures are applied: encryption of communication channels (TLS), password hashing, least-privilege staff access, backups, and access logging. In the event of an incident endangering the rights of data subjects, the Operator notifies the supervisory authority and affected users within the timeframes required by law.</p>`},
{h:'Age Restrictions', b:
`<p>The Service is intended for persons over 16; the games section is strictly 18+. The Operator does not knowingly collect children's data. If an account created by an underage person is discovered, the account and related data are deleted.</p>`},
{h:'Amendments and Contact', b:
`<p>The Operator may update this Policy; the new revision is published in the app with its date. Continued use of the Service constitutes acceptance of the updated Policy.</p>
<p>Personal data enquiries: <b>okoteam.top@gmail.com</b>.</p>`}
]}
},

/* ======================= СОГЛАШЕНИЕ ======================= */
terms: {
ru: { title:'Пользовательское соглашение', rev:'Редакция № 4', secs:[
{h:'Общие положения', b:
`<p>Настоящее Соглашение устанавливает правила пользования платформой OKO и действует совместно с Публичной офертой и Политикой конфиденциальности. Регистрируясь в Сервисе, Пользователь подтверждает, что ознакомился с Соглашением и обязуется его соблюдать.</p>
<p>Оператор платформы — ИП Ильясов Даниэль Альбертович (ИНН 682016634349, г. Москва, РФ; представительство: г. Дубай, ОАЭ).</p>`},
{h:'Аккаунт и верификация', b:
`<p>Пользователь обязан указывать достоверные данные и поддерживать их актуальность. Допускается один личный аккаунт на человека; передача аккаунта третьим лицам запрещена.</p>
<p>Сервис предоставляет добровольную верификацию (отметка подлинности). Для верификации, а также при выводе средств и в спорных ситуациях Оператор вправе запросить документы, подтверждающие личность или полномочия. Верификация может быть отозвана при нарушении правил.</p>`},
{h:'Общие правила поведения', b:
`<ul>
<li>Уважительное общение: запрещены травля, угрозы, оскорбления и дискриминация по любому признаку.</li>
<li>Запрещено выдавать себя за другое лицо, организацию или представителя Сервиса.</li>
<li>Запрещены массовые рассылки, спам, накрутка метрик и автоматизированный сбор данных без согласия Оператора.</li>
<li>Запрещены попытки взлома, обхода технических ограничений и вмешательства в работу Сервиса.</li>
</ul>`},
{h:'Запрещённый контент', b:
`<p>На платформе запрещено размещать, рекламировать и распространять:</p>
<ul>
<li>Наркотические средства, психотропные вещества и их пропаганду.</li>
<li>Порнографию; материалы 18+ без соответствующей маркировки и возрастного ограничения доступа.</li>
<li>Мошеннические схемы, финансовые пирамиды, фишинг и вводящие в заблуждение предложения.</li>
<li>Экстремистские и террористические материалы, призывы к насилию.</li>
<li>Контент, нарушающий законодательство: незаконный оборот оружия, персональные данные третьих лиц без их согласия, вредоносное ПО.</li>
<li>Контент, нарушающий интеллектуальные права третьих лиц.</li>
</ul>`},
{h:'Автомодерация и блокировки', b:
`<p>Загружаемый контент (видео, изображения, тексты) проходит автоматическую премодерацию по внутренним правилам платформы. При выявлении признаков нарушения контент может быть скрыт до проверки; спорные случаи эскалируются модератору-человеку.</p>
<p>Меры при нарушениях (применяются соразмерно тяжести): предупреждение, удаление контента, ограничение функций, временная блокировка, удаление аккаунта. При блокировке за грубые нарушения средства, полученные преступным путём, могут быть заморожены до выяснения обстоятельств.</p>
<p>Пользователь вправе подать апелляцию на решение модерации через поддержку в течение 30 дней; апелляция рассматривается человеком.</p>`},
{h:'Игры и ответственная игра (18+)', b:
`<p>Игровой раздел доступен только пользователям, достигшим 18 лет. Игры Сервиса — развлекательные механики с использованием внутреннего баланса лицевого счёта.</p>
<ul>
<li>Пользователь может установить дневные и месячные лимиты трат в игровом разделе.</li>
<li>Доступна функция самоисключения — временного или постоянного отключения игрового раздела.</li>
<li>Запрещено участие в играх с чужих аккаунтов и использование ботов.</li>
<li>Игровые механики не гарантируют выигрыш; трать только те средства, потерю которых можешь себе позволить.</li>
</ul>`},
{h:'Интеллектуальная собственность', b:
`<p>Исключительные права на платформу OKO, её код, дизайн, логотип и товарные знаки принадлежат Оператору. Использование элементов платформы вне Сервиса без письменного разрешения запрещено.</p>
<p>Права на пользовательский контент сохраняются за Пользователем. Размещая контент, Пользователь предоставляет Оператору неисключительную безвозмездную лицензию на его хранение, отображение и техническую обработку в целях работы Сервиса. Правообладатели могут направить жалобу о нарушении своих прав на okoteam.top@gmail.com — контент-нарушитель удаляется после проверки.</p>`},
{h:'Правила Биржи услуг', b:
`<ul>
<li>Сделки заключаются только через эскроу-механику Сервиса; обход комиссии и увод сделок «мимо кассы» запрещены.</li>
<li>Исполнитель обязан выполнять работу в заявленный срок и с заявленным качеством; заказчик — принимать работу или мотивированно её отклонять.</li>
<li>Запрещены фиктивные сделки, накрутка отзывов и рейтинга.</li>
<li>Споры разрешаются арбитражем Сервиса на основании переписки и материалов сделки.</li>
</ul>`},
{h:'Санкции и порядок применения', b:
`<p>При нарушении Соглашения Оператор вправе применить меры из раздела 5 без предварительного уведомления, если нарушение создаёт угрозу другим пользователям или Сервису. Повторные и грубые нарушения ведут к необратимому удалению аккаунта. Остаток средств на лицевом счёте (кроме средств, полученных с нарушением) возвращается Пользователю по реквизитам после верификации личности.</p>`},
{h:'Разрешение споров', b:
`<p>Стороны применяют обязательный претензионный порядок: претензия направляется на okoteam.top@gmail.com, срок ответа — 30 дней. При недостижении согласия спор передаётся в суд по месту нахождения Оператора в соответствии с законодательством РФ. Для пользователей вне РФ возможен арбитраж в согласованной сторонами юрисдикции.</p>`},
{h:'Заключительные положения', b:
`<p>Недействительность отдельного положения Соглашения не влечёт недействительности остальных. Оператор вправе обновлять Соглашение в порядке, аналогичном изменению Публичной оферты. Актуальная редакция всегда доступна в приложении в разделе «Документы OKO».</p>`}
]},
en: { title:'Terms of Service', rev:'Revision No. 4', secs:[
{h:'General Provisions', b:
`<p>These Terms establish the rules for using the OKO platform and apply together with the Public Offer and the Privacy Policy. By registering in the Service, the User confirms that they have read the Terms and undertake to comply with them.</p>
<p>The platform operator is Sole Proprietor Ilyasov Daniel Albertovich (Taxpayer ID 682016634349, Moscow, Russian Federation; representative office: Dubai, UAE).</p>`},
{h:'Account and Verification', b:
`<p>The User must provide accurate data and keep it up to date. One personal account per person is allowed; transferring an account to third parties is prohibited.</p>
<p>The Service offers voluntary verification (authenticity badge). For verification, as well as for withdrawals and in disputes, the Operator may request documents confirming identity or authority. Verification may be revoked for violations of the rules.</p>`},
{h:'General Conduct Rules', b:
`<ul>
<li>Respectful communication: harassment, threats, insults and discrimination on any grounds are prohibited.</li>
<li>Impersonating another person, organisation or a Service representative is prohibited.</li>
<li>Mass mailings, spam, metric manipulation and automated data collection without the Operator's consent are prohibited.</li>
<li>Hacking attempts, circumvention of technical restrictions and interference with the Service are prohibited.</li>
</ul>`},
{h:'Prohibited Content', b:
`<p>It is prohibited to post, advertise or distribute on the platform:</p>
<ul>
<li>Narcotic drugs, psychotropic substances and their promotion.</li>
<li>Pornography; 18+ materials without proper labelling and age-restricted access.</li>
<li>Fraudulent schemes, financial pyramids, phishing and misleading offers.</li>
<li>Extremist and terrorist materials, incitement to violence.</li>
<li>Content violating the law: illegal arms trafficking, third parties' personal data without their consent, malware.</li>
<li>Content infringing third-party intellectual property rights.</li>
</ul>`},
{h:'Auto-moderation and Restrictions', b:
`<p>Uploaded content (video, images, texts) undergoes automatic pre-moderation according to the platform's internal rules. If signs of a violation are detected, the content may be hidden pending review; disputed cases are escalated to a human moderator.</p>
<p>Enforcement measures (applied proportionately to severity): warning, content removal, feature restriction, temporary suspension, account deletion. In case of suspension for gross violations, funds obtained unlawfully may be frozen pending investigation.</p>
<p>The User may appeal a moderation decision via support within 30 days; appeals are reviewed by a human.</p>`},
{h:'Games and Responsible Play (18+)', b:
`<p>The games section is available only to users aged 18 and over. The Service's games are entertainment mechanics using the internal personal account balance.</p>
<ul>
<li>The User may set daily and monthly spending limits in the games section.</li>
<li>A self-exclusion feature is available — temporary or permanent disabling of the games section.</li>
<li>Playing from other users' accounts and using bots is prohibited.</li>
<li>Game mechanics do not guarantee winnings; only spend what you can afford to lose.</li>
</ul>`},
{h:'Intellectual Property', b:
`<p>Exclusive rights to the OKO platform, its code, design, logo and trademarks belong to the Operator. Use of platform elements outside the Service without written permission is prohibited.</p>
<p>Rights to user content remain with the User. By posting content, the User grants the Operator a non-exclusive royalty-free licence to store, display and technically process it for the operation of the Service. Rights holders may report infringement to okoteam.top@gmail.com — infringing content is removed after review.</p>`},
{h:'Marketplace Rules', b:
`<ul>
<li>Transactions are concluded only through the Service's escrow mechanism; commission circumvention and taking deals off-platform are prohibited.</li>
<li>The provider must deliver the work on time and to the declared quality; the client must accept the work or reject it with justification.</li>
<li>Fake transactions and manipulation of reviews and ratings are prohibited.</li>
<li>Disputes are resolved by the Service arbitration based on correspondence and transaction materials.</li>
</ul>`},
{h:'Sanctions and Enforcement', b:
`<p>In case of a violation of the Terms, the Operator may apply the measures listed in Section 5 without prior notice if the violation endangers other users or the Service. Repeated and gross violations lead to irreversible account deletion. The remaining personal account balance (except funds obtained through violations) is returned to the User after identity verification.</p>`},
{h:'Dispute Resolution', b:
`<p>The parties apply a mandatory pre-trial claim procedure: claims are sent to okoteam.top@gmail.com, with a 30-day response period. If no agreement is reached, the dispute is referred to the court at the Operator's location under the laws of the Russian Federation. For users outside Russia, arbitration in a jurisdiction agreed by the parties is possible.</p>`},
{h:'Final Provisions', b:
`<p>The invalidity of any individual provision of the Terms does not invalidate the remaining provisions. The Operator may update the Terms in the same manner as the Public Offer. The current revision is always available in the app under "OKO Legal".</p>`}
]}
},

/* ============ ПОЛИТИКА ВОЗВРАТА ============ */
refund: {
ru: { title:'Политика возврата', rev:'Редакция № 2', secs:[
{h:'Общие положения', b:
`<p>Настоящая Политика возврата определяет условия и порядок возврата средств Пользователю по договору Публичной оферты Сервиса OKO. Оператор — ИП Ильясов Даниэль Альбертович (ИНН 682016634349, г. Москва, РФ; представительство: г. Дубай, ОАЭ).</p>
<p>Политика применяется во всех операциях: подписки на тарифы, сделки Биржи, рекламный кабинет, игровой раздел, покупки в мессенджере (стикеры, каналы) и пополнения лицевого счёта. Приоритет над Политикой имеют требования действующего законодательства РФ (в т.ч. Закон «О защите прав потребителей» и ст. 32 ГК РФ).</p>`},
{h:'Подписки на тарифы', b:
`<p><b>«Период охлаждения».</b> В течение 14 календарных дней с момента первой оплаты подписки Пользователь вправе отказаться от неё и получить полный возврат при условии, что платный функционал фактически не использовался (не осуществлялись платные операции, не расходовались лимиты Тарифа).</p>
<p><b>Пропорциональный возврат.</b> Если платный функционал уже использовался и на момент отказа остаётся неистёкший период, Оператор возвращает пропорциональную часть стоимости за неиспользованные полные календарные дни. Из суммы возврата вычитаются: (а) стоимость фактически потреблённых лимитов Тарифа по тарифной сетке, (б) банковская или платёжная комиссия, если её не удаётся вернуть провайдером.</p>
<p><b>Автопродление.</b> Заявление, поданное до даты автопродления и включающее просьбу об отключении автопродления, принимается автоматически: следующее списание не производится, а уже оплаченный период не возвращается частично, если платный функционал использовался в нём.</p>`},
{h:'Сделки Биржи услуг', b:
`<p>Средства, заблокированные в эскроу, возвращаются Заказчику полностью, если:</p>
<ul>
<li>Исполнитель не приступил к работе в согласованный срок и не согласовал перенос;</li>
<li>Стороны расторгли сделку по взаимному согласию до сдачи работы;</li>
<li>Арбитраж Сервиса вынес решение о возврате.</li>
</ul>
<p>После сдачи работы Исполнителем и её принятия Заказчиком (в т.ч. автоматически по истечении 7 дней при отсутствии претензий) средства перечисляются Исполнителю и возврату не подлежат, за исключением случаев обмана, установленных арбитражем.</p>`},
{h:'Реклама и игровой раздел', b:
`<p>Средства, потраченные на показы рекламы, продвижение постов и ставки/покупки в игровом разделе, возврату не подлежат, поскольку услуга считается оказанной в момент фактического расхода. Исключение — техническая ошибка Сервиса, приведшая к некорректному списанию: такие списания возвращаются на лицевой счёт в полном объёме по обращению Пользователя.</p>`},
{h:'Пополнения лицевого счёта', b:
`<p>Пользователь вправе запросить возврат неизрасходованного остатка лицевого счёта в любой момент. Возврат производится за вычетом комиссии платёжного метода вывода (2% для банковских карт РФ, до 5% для международных методов) и налоговых удержаний, если такие применимы. Срок исполнения — до 10 рабочих дней после верификации личности заявителя.</p>`},
{h:'Каналы, стикеры и цифровые товары', b:
`<p>Оплаты подписок на платные каналы возвращаются в течение 24 часов с момента первой оплаты при условии, что Пользователь не открыл в канале ни одного закрытого материала. По истечении 24 часов возврат производится по решению владельца канала; Оператор в этом случае возвращает свою комиссию.</p>
<p>Стикеры, эмодзи и иные цифровые товары возврату не подлежат после активации на аккаунте, за исключением случаев некачественного контента (нарушение авторских прав, повреждённый файл): в этом случае возврат производится в полном объёме.</p>`},
{h:'Порядок обращения и сроки', b:
`<p>Заявление о возврате направляется на <b>okoteam.top@gmail.com</b> с темой «Возврат» и содержит: имя Пользователя и ID в Сервисе, дату и сумму операции, идентификатор транзакции, реквизиты возврата (при выводе), краткое описание причины.</p>
<p>Срок рассмотрения — до <b>10 рабочих дней</b>. Возврат производится тем же способом, каким был совершён платёж; в случае невозможности возврата исходным методом Оператор согласовывает альтернативный способ. Срок зачисления средств зависит от платёжного провайдера и обычно составляет от 1 до 10 рабочих дней после утверждения возврата.</p>`},
{h:'Отказ в возврате', b:
`<p>Оператор вправе отказать в возврате, если:</p>
<ul>
<li>Заявление подано с нарушением сроков, установленных настоящей Политикой;</li>
<li>Услуга фактически оказана в полном объёме и претензии к её качеству отсутствуют;</li>
<li>Аккаунт Пользователя заблокирован за нарушение Пользовательского соглашения (в этом случае возврат остатка средств рассматривается индивидуально);</li>
<li>Заявление содержит недостоверные сведения или подано неуполномоченным лицом.</li>
</ul>
<p>Отказ в возврате может быть обжалован в порядке, предусмотренном разделом «Разрешение споров» Пользовательского соглашения.</p>`}
]},
en: { title:'Refund Policy', rev:'Revision No. 2', secs:[
{h:'General Provisions', b:
`<p>This Refund Policy sets out the conditions and procedure for refunding funds to the User under the Public Offer of the OKO Service. Operator: Sole Proprietor Ilyasov Daniel Albertovich (Taxpayer ID 682016634349, Moscow, Russian Federation; representative office: Dubai, UAE).</p>
<p>The Policy applies to all operations: plan subscriptions, Marketplace transactions, the advertising cabinet, the games section, in-messenger purchases (stickers, channels) and personal-account top-ups. Applicable law (including the Russian Consumer Protection Law and Art. 32 of the Civil Code) prevails over this Policy.</p>`},
{h:'Plan Subscriptions', b:
`<p><b>Cooling-off period.</b> Within 14 calendar days of the initial subscription payment, the User may cancel and obtain a full refund provided the paid functionality has not actually been used (no paid operations were performed and no plan limits were consumed).</p>
<p><b>Pro-rata refund.</b> If the paid functionality has already been used and an unused period remains at the moment of cancellation, the Operator refunds a pro-rata share of the price for the unused full calendar days. The refund amount is reduced by (a) the cost of the actually consumed plan limits at published rates and (b) the bank or payment fee that cannot be reversed by the provider.</p>
<p><b>Auto-renewal.</b> A request submitted before the auto-renewal date that asks to disable auto-renewal is accepted automatically: the next charge is not made; the paid period already in effect is not partially refunded if the paid functionality was used during it.</p>`},
{h:'Marketplace Transactions', b:
`<p>Funds held in escrow are fully refunded to the Client if:</p>
<ul>
<li>the Provider has not started the work within the agreed timeframe and has not agreed to postpone;</li>
<li>the parties have terminated the transaction by mutual consent before delivery;</li>
<li>the Service arbitration has ruled in favour of a refund.</li>
</ul>
<p>Once the work is delivered by the Provider and accepted by the Client (including automatically after 7 days if no claims are raised), the funds are transferred to the Provider and are non-refundable, except for cases of proven fraud established by arbitration.</p>`},
{h:'Advertising and Games', b:
`<p>Funds spent on ad impressions, post promotion and bets/purchases in the games section are non-refundable, as the service is considered rendered at the moment of actual expenditure. Exception: a technical error of the Service that led to an incorrect charge — such charges are refunded to the personal account in full upon request.</p>`},
{h:'Personal-account Top-ups', b:
`<p>The User may request a refund of the unspent personal-account balance at any time. The refund is issued net of the withdrawal-method fee (2% for Russian bank cards, up to 5% for international methods) and applicable tax withholdings. Processing time — up to 10 business days after identity verification.</p>`},
{h:'Channels, Stickers and Digital Goods', b:
`<p>Subscriptions to paid channels are refunded within 24 hours of the initial payment provided the User has not opened any private content in the channel. After 24 hours the refund is at the channel owner's discretion; in that case the Operator refunds its own commission.</p>
<p>Stickers, emoji and other digital goods are non-refundable once activated on the account, except for cases of defective content (copyright infringement, corrupted file), in which case a full refund is issued.</p>`},
{h:'Request Procedure and Timelines', b:
`<p>Refund requests are sent to <b>okoteam.top@gmail.com</b> with the subject "Refund" and must include: the User's name and Service ID, the date and amount of the operation, the transaction identifier, refund details (if a withdrawal is requested), and a brief description of the reason.</p>
<p>Processing time — up to <b>10 business days</b>. The refund is issued using the same method as the original payment; where this is not possible, the Operator agrees an alternative method. The time for funds to arrive depends on the payment provider and usually ranges from 1 to 10 business days after the refund is approved.</p>`},
{h:'Refund Denial', b:
`<p>The Operator may deny a refund if:</p>
<ul>
<li>the request was submitted outside the timelines of this Policy;</li>
<li>the service has been rendered in full and no quality complaints exist;</li>
<li>the User's account is blocked for violation of the Terms of Service (in that case the balance refund is reviewed individually);</li>
<li>the request contains inaccurate information or was submitted by an unauthorised person.</li>
</ul>
<p>A refund denial can be appealed under the "Dispute Resolution" section of the Terms of Service.</p>`}
]}
},

/* ============ ЛИЦЕНЗИОННОЕ СОГЛАШЕНИЕ (EULA) ============ */
license: {
ru: { title:'Лицензионное соглашение на ПО', rev:'Редакция № 2', secs:[
{h:'Стороны и предмет', b:
`<p>Настоящее лицензионное соглашение (далее — <b>«Лицензия»</b>) регулирует условия использования Пользователем программного обеспечения «OKO» — мобильного и веб-приложения, включая обновления, дополнительные модули, документацию и связанные сервисы (далее — <b>«ПО»</b>).</p>
<p>Лицензиар — ИП Ильясов Даниэль Альбертович (ИНН 682016634349, г. Москва, РФ; представительство: г. Дубай, ОАЭ). Устанавливая, копируя или иным образом используя ПО, Пользователь принимает условия Лицензии.</p>`},
{h:'Предоставляемые права', b:
`<p>Лицензиар предоставляет Пользователю простую (неисключительную) безвозмездную лицензию на:</p>
<ul>
<li>установку и запуск ПО на неограниченном числе принадлежащих Пользователю устройств;</li>
<li>использование ПО по прямому функциональному назначению в личных и профессиональных целях;</li>
<li>получение обновлений и патчей ПО, публикуемых Лицензиаром;</li>
<li>использование бесплатных функций ПО без ограничений; платные функции — при активной подписке.</li>
</ul>
<p>Территория действия Лицензии — весь мир. Срок — на период существования соответствующей версии ПО в публичном доступе.</p>`},
{h:'Ограничения', b:
`<p>Пользователю запрещается:</p>
<ul>
<li>распространять, продавать, сдавать в аренду или сублицензировать ПО третьим лицам;</li>
<li>декомпилировать, дизассемблировать, вносить изменения в исходный или бинарный код ПО, за исключением случаев, прямо разрешённых законом;</li>
<li>удалять или изменять уведомления об авторских правах, товарные знаки и иные обозначения правообладателя;</li>
<li>использовать ПО для обхода технических средств защиты, взлома или атак на инфраструктуру Сервиса и третьих лиц;</li>
<li>создавать производные продукты, воспроизводящие существенную часть функциональности или интерфейса ПО.</li>
</ul>`},
{h:'Открытые компоненты (Open-source)', b:
`<p>ПО может включать компоненты с открытым исходным кодом, распространяемые под лицензиями MIT, Apache-2.0, BSD, ISC, LGPL и иными совместимыми лицензиями. Полный перечень таких компонентов и текстов их лицензий доступен по запросу на okoteam.top@gmail.com. Права на open-source компоненты регулируются соответствующими лицензиями и не ограничиваются настоящим документом в пределах, установленных этими лицензиями.</p>`},
{h:'Обновления и совместимость', b:
`<p>Лицензиар вправе публиковать обновления ПО с исправлениями ошибок, улучшениями и новыми возможностями. Некоторые функции могут требовать новой версии ПО и/или совместимого оборудования. Прекращение поддержки устаревших версий не является нарушением Лицензии; актуальная версия ПО доступна для установки в официальных магазинах приложений и на сайте okoteam.top.</p>`},
{h:'Данные и телеметрия', b:
`<p>ПО может собирать техническую информацию (тип устройства, версия ОС, идентификатор установки, логи сбоев) для обеспечения работоспособности и улучшения качества. Обработка персональных данных производится в соответствии с Политикой конфиденциальности. Пользователь может отключить необязательную телеметрию в настройках приложения.</p>`},
{h:'Гарантии и ответственность', b:
`<p>ПО предоставляется <b>«как есть»</b> и <b>«как доступно»</b>. Лицензиар не гарантирует полного отсутствия ошибок, беспрерывной работы или соответствия ПО конкретным ожиданиям Пользователя. В максимально допустимой законом степени Лицензиар не несёт ответственности за косвенные, случайные или последующие убытки, включая упущенную выгоду.</p>
<p>Совокупная ответственность Лицензиара за прямые убытки ограничена суммой платежей Пользователя за подписки за последние 3 календарных месяца.</p>`},
{h:'Прекращение действия', b:
`<p>Лицензия действует до её прекращения. Пользователь может прекратить Лицензию в любой момент, удалив ПО со всех устройств. Лицензиар вправе прекратить Лицензию при существенном нарушении её условий с направлением уведомления по электронной почте, привязанной к аккаунту. После прекращения Лицензии Пользователь обязан прекратить использование ПО и удалить его копии.</p>`},
{h:'Применимое право', b:
`<p>К настоящей Лицензии применяется законодательство Российской Федерации. Споры разрешаются в порядке, установленном Пользовательским соглашением. Недействительность отдельного положения Лицензии не влечёт недействительности остальных.</p>`}
]},
en: { title:'Software Licence Agreement', rev:'Revision No. 2', secs:[
{h:'Parties and Subject', b:
`<p>This licence agreement (the <b>"Licence"</b>) governs the terms of use of the "OKO" software — a mobile and web application, including updates, additional modules, documentation and related services (the <b>"Software"</b>).</p>
<p>Licensor: Sole Proprietor Ilyasov Daniel Albertovich (Taxpayer ID 682016634349, Moscow, Russian Federation; representative office: Dubai, UAE). By installing, copying or otherwise using the Software, the User accepts this Licence.</p>`},
{h:'Rights Granted', b:
`<p>The Licensor grants the User a simple (non-exclusive) royalty-free licence to:</p>
<ul>
<li>install and run the Software on an unlimited number of devices owned by the User;</li>
<li>use the Software for its intended purpose for personal and professional use;</li>
<li>receive Software updates and patches published by the Licensor;</li>
<li>use the free features of the Software without limits; paid features — while a subscription is active.</li>
</ul>
<p>Territory: worldwide. Term: for the period during which the corresponding version of the Software is publicly available.</p>`},
{h:'Restrictions', b:
`<p>The User is prohibited from:</p>
<ul>
<li>distributing, selling, renting or sublicensing the Software to third parties;</li>
<li>decompiling, disassembling or modifying the source or binary code of the Software, except as expressly permitted by law;</li>
<li>removing or altering copyright notices, trademarks and other markings of the rights holder;</li>
<li>using the Software to circumvent technical protection measures or to hack or attack the Service or third-party infrastructure;</li>
<li>creating derivative products that reproduce a substantial part of the functionality or interface of the Software.</li>
</ul>`},
{h:'Open-source Components', b:
`<p>The Software may include open-source components distributed under MIT, Apache-2.0, BSD, ISC, LGPL and other compatible licences. A full list of such components and their licence texts is available upon request at okoteam.top@gmail.com. Rights to open-source components are governed by the corresponding licences and are not restricted by this document beyond the extent permitted by those licences.</p>`},
{h:'Updates and Compatibility', b:
`<p>The Licensor may publish Software updates with bug fixes, improvements and new features. Some features may require a new Software version and/or compatible hardware. Discontinuation of support for outdated versions is not a breach of the Licence; the current Software version is available for installation from the official app stores and at okoteam.top.</p>`},
{h:'Data and Telemetry', b:
`<p>The Software may collect technical information (device type, OS version, installation identifier, crash logs) to ensure operability and improve quality. Processing of personal data is carried out in accordance with the Privacy Policy. The User may opt out of optional telemetry in the app settings.</p>`},
{h:'Warranties and Liability', b:
`<p>The Software is provided <b>"as is"</b> and <b>"as available"</b>. The Licensor does not warrant the complete absence of errors, uninterrupted operation, or the Software's fitness for a User's specific expectations. To the maximum extent permitted by law, the Licensor is not liable for indirect, incidental or consequential damages, including lost profits.</p>
<p>The Licensor's aggregate liability for direct damages is limited to the amount of the User's subscription payments over the last 3 calendar months.</p>`},
{h:'Termination', b:
`<p>The Licence remains in force until terminated. The User may terminate the Licence at any time by removing the Software from all devices. The Licensor may terminate the Licence upon a material breach of its terms by sending a notice to the e-mail linked to the account. Upon termination, the User must cease using the Software and destroy its copies.</p>`},
{h:'Governing Law', b:
`<p>This Licence is governed by the laws of the Russian Federation. Disputes are resolved in the manner set out in the Terms of Service. The invalidity of any individual provision of the Licence does not invalidate the remaining provisions.</p>`}
]}
},

/* ============ СОГЛАСИЕ НА ОБРАБОТКУ ПЕРСОНАЛЬНЫХ ДАННЫХ ============ */
consent: {
ru: { title:'Согласие на обработку персональных данных', rev:'Редакция № 4', secs:[
{h:'Субъект и Оператор', b:
`<p>Настоящим я, дееспособное физическое лицо — пользователь приложения OKO (далее — <b>«Субъект»</b>), действуя своей волей и в своём интересе, в соответствии со ст. 9 Федерального закона от 27.07.2006 № 152-ФЗ «О персональных данных» даю согласие на обработку моих персональных данных Оператору — <b>Индивидуальному предпринимателю Ильясову Даниэлю Альбертовичу</b> (проект «ОКО PROJECT», ИНН 682016634349, г. Москва, Российская Федерация; представительство: г. Дубай, ОАЭ), e-mail: okoteam.top@gmail.com.</p>
<p>Согласие даётся в момент регистрации в Сервисе путём проставления соответствующей отметки и является конкретным, предметным, информированным, сознательным и однозначным.</p>`},
{h:'Цели обработки', b:
`<p>Персональные данные обрабатываются в следующих целях:</p>
<ul>
<li>регистрация, аутентификация и ведение аккаунта в Сервисе;</li>
<li>исполнение Публичной оферты: подписки, сделки Биржи, эскроу, вывод средств, партнёрские начисления;</li>
<li>обеспечение связи, поддержки и обратной связи с Субъектом;</li>
<li>модерация контента, обеспечение безопасности и предотвращение мошенничества;</li>
<li>улучшение Сервиса на основе обезличенной аналитики;</li>
<li>направление информационных и — при отдельном согласии — рекламных сообщений.</li>
</ul>`},
{h:'Перечень персональных данных', b:
`<p>Субъект даёт согласие на обработку следующих персональных данных:</p>
<ul>
<li>фамилия, имя, отчество (при указании), отображаемое имя и никнейм;</li>
<li>адрес электронной почты и номер телефона;</li>
<li>дата рождения, изображение профиля (аватар), сведения «о себе», интересы;</li>
<li>идентификаторы входа (Telegram ID, Google, Apple) и данные аккаунта;</li>
<li>платёжные метаданные (суммы, даты, статусы и идентификаторы операций — без полных номеров карт);</li>
<li>технические данные: IP-адрес, тип устройства и ОС, язык, cookies, журналы событий.</li>
</ul>`},
{h:'Перечень действий и способы обработки', b:
`<p>Согласие распространяется на любые действия (операции) с персональными данными: сбор, запись, систематизацию, накопление, хранение, уточнение (обновление, изменение), извлечение, использование, передачу (предоставление, доступ) в объёме, указанном в разделе 5, обезличивание, блокирование, удаление и уничтожение.</p>
<p>Обработка осуществляется как с использованием средств автоматизации, так и без таковых. Запись, систематизация, накопление, хранение, уточнение и извлечение персональных данных граждан РФ осуществляются с использованием баз данных на территории Российской Федерации (ч. 5 ст. 18 152-ФЗ).</p>`},
{h:'Передача третьим лицам (поручение обработки)', b:
`<p>Субъект соглашается на поручение обработки его персональных данных в минимально необходимом объёме следующим категориям лиц, действующим по поручению Оператора и обязанным соблюдать конфиденциальность:</p>
<ul>
<li>платёжным провайдерам (Lava.top, банковские и криптовалютные процессинги) — для проведения платежей;</li>
<li>поставщикам облачной инфраструктуры и хостинга — для хранения и технической обработки данных;</li>
<li>Telegram — при входе через Telegram-аккаунт;</li>
<li>государственным органам — исключительно по законному запросу.</li>
</ul>
<p>Оператор не продаёт персональные данные и не передаёт их третьим лицам для их собственных маркетинговых целей.</p>`},
{h:'Срок действия и порядок отзыва', b:
`<p>Согласие действует с момента его предоставления в течение всего срока использования Сервиса и <b>3 (три) года</b> после удаления аккаунта либо до достижения целей обработки, если иное не предусмотрено законом (документы об операциях хранятся 5 лет, технические логи — 12 месяцев).</p>
<p>Согласие может быть отозвано в любой момент путём направления письменного заявления на okoteam.top@gmail.com либо через функцию удаления аккаунта в приложении. После отзыва Оператор прекращает обработку и уничтожает (обезличивает) данные в срок, не превышающий 30 дней, за исключением данных, обработка которых продолжается на иных законных основаниях (исполнение договора, требования учёта, защита прав).</p>`},
{h:'Права субъекта и подтверждение', b:
`<p>Субъект подтверждает, что ознакомлен со своими правами, предусмотренными 152-ФЗ (получение сведений об обработке, уточнение, блокирование, удаление данных, отзыв согласия, обжалование в Роскомнадзоре), а также с Политикой конфиденциальности Оператора.</p>
<p>Проставляя отметку о согласии при регистрации, Субъект подтверждает достоверность предоставленных данных и своё согласие с условиями настоящего документа. Настоящее согласие является электронным документом и не требует проставления собственноручной подписи Субъекта.</p>`}
]},
en: { title:'Consent to Personal Data Processing', rev:'Revision No. 4', secs:[
{h:'Data Subject and Operator', b:
`<p>I, a legally capable individual and user of the OKO app (the <b>"Data Subject"</b>), acting of my own free will and in my own interest, in accordance with Article 9 of Russian Federal Law No. 152-FZ "On Personal Data" of 27.07.2006, consent to the processing of my personal data by the Operator — <b>Sole Proprietor Ilyasov Daniel Albertovich</b> ("OKO PROJECT", Taxpayer ID 682016634349, Moscow, Russian Federation; representative office: Dubai, UAE), e-mail: okoteam.top@gmail.com.</p>
<p>This consent is given upon registration in the Service by ticking the relevant box and is specific, informed, conscious and unambiguous.</p>`},
{h:'Purposes of Processing', b:
`<p>Personal data is processed for the following purposes:</p>
<ul>
<li>registration, authentication and maintenance of the Service account;</li>
<li>performance of the Public Offer: subscriptions, Marketplace transactions, escrow, withdrawals, affiliate accruals;</li>
<li>communication, support and feedback with the Data Subject;</li>
<li>content moderation, security and fraud prevention;</li>
<li>improving the Service based on anonymised analytics;</li>
<li>sending service messages and — with separate consent — marketing messages.</li>
</ul>`},
{h:'Categories of Personal Data', b:
`<p>The Data Subject consents to the processing of the following personal data:</p>
<ul>
<li>surname, first name, patronymic (if provided), display name and nickname;</li>
<li>e-mail address and phone number;</li>
<li>date of birth, profile picture (avatar), "about" information, interests;</li>
<li>sign-in identifiers (Telegram ID, Google, Apple) and account data;</li>
<li>payment metadata (amounts, dates, statuses and transaction identifiers — without full card numbers);</li>
<li>technical data: IP address, device and OS type, language, cookies, event logs.</li>
</ul>`},
{h:'Actions and Methods of Processing', b:
`<p>This consent covers any actions (operations) with personal data: collection, recording, systematisation, accumulation, storage, clarification (updating, modification), retrieval, use, transfer (provision, access) to the extent set out in Section 5, anonymisation, blocking, deletion and destruction.</p>
<p>Processing is carried out both by automated means and without them. Recording, systematisation, accumulation, storage, clarification and retrieval of personal data of Russian citizens are performed using databases located in the Russian Federation (Art. 18(5) of Law 152-FZ).</p>`},
{h:'Transfer to Third Parties (Processing Instruction)', b:
`<p>The Data Subject consents to instructing the processing of their personal data, to the minimum necessary extent, to the following categories of persons acting on the Operator's behalf and bound by confidentiality:</p>
<ul>
<li>payment providers (Lava.top, bank and cryptocurrency processors) — to process payments;</li>
<li>cloud infrastructure and hosting providers — to store and technically process data;</li>
<li>Telegram — when signing in with a Telegram account;</li>
<li>public authorities — solely upon a lawful request.</li>
</ul>
<p>The Operator does not sell personal data and does not share it with third parties for their own marketing purposes.</p>`},
{h:'Validity and Withdrawal', b:
`<p>This consent is valid from the moment it is given, throughout the entire period of use of the Service and for <b>3 (three) years</b> after account deletion, or until the purposes of processing are achieved, unless otherwise provided by law (transaction records are kept for 5 years, technical logs for 12 months).</p>
<p>The consent may be withdrawn at any time by sending a written request to okoteam.top@gmail.com or via the account deletion feature in the app. After withdrawal, the Operator ceases processing and destroys (anonymises) the data within no more than 30 days, except for data whose processing continues on other lawful grounds (performance of the agreement, accounting requirements, protection of rights).</p>`},
{h:'Data Subject Rights and Confirmation', b:
`<p>The Data Subject confirms awareness of their rights under Law 152-FZ (obtaining information about processing, rectification, blocking, deletion of data, withdrawal of consent, lodging a complaint with Roskomnadzor), as well as familiarity with the Operator's Privacy Policy.</p>
<p>By ticking the consent box during registration, the Data Subject confirms the accuracy of the data provided and their agreement with the terms of this document. This consent is an electronic document and does not require the Data Subject's handwritten signature.</p>`}
]}
}
};

/* ================================================================
   HUB — сетка карточек «Документов OKO»
   ================================================================ */
function lgHubHtml(lang){
  const r = LG_REQ[lang];
  const intro = lang==='en'
    ? {t:'OKO Legal', s:'The full set of documents governing your use of the OKO service and platform. Available in Russian and English. Each document opens as a separate page with a table of contents, an operator seal, and a signature. Save any document as PDF via the download button.'}
    : {t:'Документы OKO', s:'Полный набор документов, регулирующих использование сервиса и платформы OKO. Доступны на русском и английском. Каждый документ открывается отдельной страницей — с оглавлением, официальной печатью и подписью. Любой документ можно сохранить в PDF по кнопке скачивания.'};
  const opCaption = lang==='en' ? 'Operator' : 'Оператор';
  const cards = LG_HUB_CARDS.map(c=>{
    const d = LG_DOCS[c.k][lang];
    const l = c[lang];
    return `<button class="lg-card" type="button" onclick="openLegalDoc('${c.k}')" aria-label="${l.t}">
      <span class="lg-card-ver">${d.rev.replace('Редакция №','v').replace('Revision No.','v').trim()}</span>
      <span class="lg-card-ico">${I(c.ico||'file')}</span>
      <span class="lg-card-t">${l.t}</span>
      <span class="lg-card-s">${l.s}</span>
    </button>`;
  }).join('');
  return `<div class="lg-hub">
    <div class="lg-hub-intro">
      <h2>${intro.t}</h2>
      <p>${intro.s}</p>
      <div class="lg-hub-op"><b>${opCaption}:</b> ${r.op} · ${r.inn} · ${r.geo} · ${r.mail}</div>
    </div>
    <div class="lg-hub-grid">${cards}</div>
  </div>`;
}

/* ================================================================
   DOC — рендер одной юр-страницы
   ================================================================ */
function lgDocHtml(kind, lang){
  const d = LG_DOCS[kind][lang];
  const r = LG_REQ[lang];
  const opLabel   = lang==='en' ? 'Operator'  : 'Оператор';
  const tocLabel  = lang==='en' ? 'Contents'  : 'Содержание';
  const reqLabel  = lang==='en' ? 'Operator details' : 'Реквизиты Оператора';
  const topLabel  = lang==='en' ? 'to contents' : 'к содержанию';
  const revLabel  = lang==='en' ? d.rev + ' · effective ' + r.date : d.rev + ' · дата вступления в силу: ' + r.date;
  const updLabel  = lang==='en' ? 'Updated ' + r.date : 'Обновлено ' + r.date;
  const pdfLabel  = lang==='en' ? 'Download PDF' : 'Скачать PDF';
  const dlLabel   = lang==='en' ? 'Download HTML' : 'Скачать HTML';
  const shLabel   = lang==='en' ? 'Share link'    : 'Поделиться ссылкой';
  const cnT       = lang==='en' ? 'I have read and I agree' : 'Прочитано, согласен';
  const cnS       = lang==='en' ? 'The consent is saved locally and used at registration.' : 'Согласие сохраняется локально и учитывается при регистрации.';
  const sid = (i)=>'lg-s-'+kind+'-'+i;
  const toc = `<nav class="lg-toc" aria-label="${tocLabel}">
      <div class="lg-toc-h">${I('file')}<b>${tocLabel}</b></div>
      <ol>${d.secs.map((s,i)=>`<li><button type="button" class="lg-toc-a" onclick="lgJump('${sid(i)}')"><span class="lg-toc-n">${i+1}</span><span>${s.h}</span></button></li>`).join('')}</ol>
    </nav>`;
  const agreed = lgIsAgreed(kind);
  return `<div class="lg-doc" id="lgDoc">
    <div class="lg-progress" aria-hidden="true"><span id="lgProgFill"></span></div>
    <div class="lg-doc-head">
      <svg class="lg-doc-logo"><use href="#i-logo"/></svg>
      <div>
        <h1>${d.title}</h1>
        <div class="lg-doc-meta"><b>OKO PROJECT</b> · ${revLabel}</div>
        <div class="lg-doc-meta">${opLabel}: ${r.op}, ${r.inn}</div>
        <span class="lg-updated">${I('check')} ${updLabel}</span>
      </div>
    </div>
    <div class="lg-actions">
      <button type="button" class="lg-btn-pdf" onclick="lgDownloadPdf()" title="${pdfLabel}">${I('file')}<span>${pdfLabel}</span></button>
      <button type="button" onclick="lgDownloadHtml()" title="${dlLabel}">${I('copy')}<span>${dlLabel}</span></button>
      <button type="button" onclick="lgShareLink()" title="${shLabel}">${I('share')}<span>${shLabel}</span></button>
    </div>
    ${toc}
    ${d.secs.map((s,i)=>`<section class="lg-sec" id="${sid(i)}"><h2><span class="lg-sec-n">${i+1}.</span> ${s.h}<button type="button" class="lg-sec-top" onclick="lgJump('lgDoc')" title="${topLabel}" aria-label="${topLabel}">${I('chev')}</button></h2>${s.b}</section>`).join('')}
    <div class="lg-req">
      <div class="lg-req-h">${reqLabel}</div>
      <b>${r.op}</b><br>${r.brand}<br>${r.inn}<br>${r.geo}<br>E-mail: ${r.mail}
    </div>
    <div class="doc-sign-block">
      <div class="lg-seal">${sealSvg(150)}</div>
      <div class="lg-sig-wrap">
        <div class="sig">${signatureImg(180)}</div>
        <div class="lg-sig-line"></div>
        <div class="lg-sig-cap">${r.sig}</div>
      </div>
    </div>
    <button type="button" class="lg-consent ${agreed?'on':''}" id="lgConsent" onclick="lgToggleAgreed()" aria-pressed="${agreed?'true':'false'}">
      <span class="lg-consent-box">${I('check2')||I('check')}</span>
      <span class="lg-consent-txt">
        <span class="lg-consent-t">${cnT}</span>
        <span class="lg-consent-s">${cnS}</span>
      </span>
    </button>
  </div>`;
}

/* ================================================================
   DEAL — договор-акт по конкретной сделке (авто-заполнение)
   ================================================================ */
function lgFmtRub(n){ try{ return Number(n||0).toLocaleString('ru-RU').replace(/,/g,' '); }catch(e){ return String(n||0); } }
function lgFmtDate(d, lang){
  try{
    const dt = d instanceof Date ? d : new Date(d||Date.now());
    if(lang==='en') return dt.toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'});
    return dt.toLocaleDateString('ru-RU',{day:'2-digit',month:'long',year:'numeric'}) + ' г.';
  }catch(e){ return ''+d; }
}
function lgDealHtml(ctx, lang){
  const r = LG_REQ[lang];
  const en = lang==='en';
  const buyer   = ctx.buyer || (typeof PROFILE!=='undefined' && PROFILE && PROFILE.name) || (en?'Buyer':'Покупатель');
  const plan    = ctx.plan  || ctx.tier || 'START';
  const period  = ctx.period || 12; // месяцев
  const currency= ctx.currency || 'RUB';
  const amount  = (ctx.amount != null) ? ctx.amount : 0;
  const tx      = ctx.tx || ('OKO-' + Date.now().toString(36).toUpperCase());
  const dt      = ctx.date || new Date();
  const dateStr = lgFmtDate(dt, lang);
  const method  = ctx.method || (en?'bank card':'банковская карта');
  const title = en ? 'Deal certificate' : 'Договор-акт по сделке';
  const subT  = en ? `Confirmation of acceptance of the OKO "${plan}" plan under the Public Offer` : `Подтверждение акцепта тарифа OKO «${plan}» по Публичной оферте`;
  const facts = en ? [
    ['Certificate No.', `<b>${tx}</b>`],
    ['Date', dateStr],
    ['Buyer', buyer],
    ['Plan', `<b>${plan}</b>, ${period} months`],
    ['Amount', `<b>${lgFmtRub(amount)} ${currency}</b>`],
    ['Payment method', method]
  ] : [
    ['№ акта', `<b>${tx}</b>`],
    ['Дата', dateStr],
    ['Покупатель', buyer],
    ['Тариф', `<b>${plan}</b>, ${period} мес.`],
    ['Сумма', `<b>${lgFmtRub(amount)} ${currency==='RUB'?'₽':currency}</b>`],
    ['Способ оплаты', method]
  ];
  const body = en ? `
    <p>This certificate confirms that the Buyer has entered into an agreement with the Operator on the terms of the OKO Public Offer (Revision No. 4) and paid for the <b>${plan}</b> plan for a period of ${period} months. The paid functionality of the plan is activated on the Buyer's account from the date indicated above.</p>
    <p>By making the payment, the Buyer confirms full and unconditional acceptance of the Public Offer and the Refund Policy. The right to a refund is exercised in accordance with the Refund Policy under the conditions set out therein.</p>
    <p>The parties have no mutual claims regarding the fact of payment and activation. The certificate is generated electronically and does not require a handwritten signature of the Buyer.</p>
  ` : `
    <p>Настоящим Оператор подтверждает, что Покупатель заключил договор с Оператором на условиях Публичной оферты сервиса OKO (Редакция № 4) и оплатил тариф <b>${plan}</b> на срок ${period} мес. Платный функционал тарифа активирован на аккаунте Покупателя с даты, указанной выше.</p>
    <p>Внесением оплаты Покупатель подтверждает полный и безоговорочный акцепт Публичной оферты и Политики возврата. Право на возврат осуществляется в порядке и на условиях, установленных Политикой возврата.</p>
    <p>Стороны не имеют взаимных претензий относительно факта оплаты и активации. Акт сформирован электронно и не требует собственноручной подписи Покупателя.</p>
  `;
  const opLabel = en ? 'Operator' : 'Оператор';
  const reqLabel= en ? 'Operator details' : 'Реквизиты Оператора';
  const pdfLabel= en ? 'Download PDF' : 'Скачать PDF';
  const dlLabel = en ? 'Download HTML' : 'Скачать HTML';
  return `<div class="lg-doc" id="lgDoc">
    <div class="lg-progress" aria-hidden="true"><span id="lgProgFill"></span></div>
    <div class="lg-doc-head">
      <svg class="lg-doc-logo"><use href="#i-logo"/></svg>
      <div>
        <h1>${title}</h1>
        <div class="lg-doc-meta"><b>OKO PROJECT</b> · ${subT}</div>
        <div class="lg-doc-meta">${opLabel}: ${r.op}, ${r.inn}</div>
        <span class="lg-updated">${I('check')} ${dateStr}</span>
      </div>
    </div>
    <div class="lg-actions">
      <button type="button" class="lg-btn-pdf" onclick="lgDownloadPdf()" title="${pdfLabel}">${I('file')}<span>${pdfLabel}</span></button>
      <button type="button" onclick="lgDownloadHtml()" title="${dlLabel}">${I('copy')}<span>${dlLabel}</span></button>
    </div>
    <dl class="lg-deal-facts">
      ${facts.map(f=>`<dt>${f[0]}</dt><dd>${f[1]}</dd>`).join('')}
    </dl>
    <section class="lg-sec">
      <h2><span class="lg-sec-n">1.</span> ${en?'Subject and confirmation':'Предмет и подтверждение'}</h2>
      ${body}
    </section>
    <div class="lg-req">
      <div class="lg-req-h">${reqLabel}</div>
      <b>${r.op}</b><br>${r.brand}<br>${r.inn}<br>${r.geo}<br>E-mail: ${r.mail}
    </div>
    <div class="doc-sign-block">
      <div class="lg-seal">${sealSvg(150)}</div>
      <div class="lg-sig-wrap">
        <div class="sig">${signatureImg(180)}</div>
        <div class="lg-sig-line"></div>
        <div class="lg-sig-cap">${r.sig}</div>
      </div>
    </div>
  </div>`;
}

/* ---------- согласие «прочитано» — хранится в localStorage ---------- */
function lgIsAgreed(kind){ try{ return !!(lgS.agreed && lgS.agreed[kind]); }catch(e){ return false; } }
function lgToggleAgreed(){
  if(!lgS.agreed) lgS.agreed = {};
  const cur = !!lgS.agreed[lgKind];
  lgS.agreed[lgKind] = !cur;
  if(!cur) lgS.agreed[lgKind+'_at'] = new Date().toISOString();
  lgSave();
  const el = document.getElementById('lgConsent');
  if(el){ el.classList.toggle('on', !cur); el.setAttribute('aria-pressed', (!cur).toString()); }
}

/* ---------- Скачать PDF — окно печати браузера (Save as PDF) ---------- */
function lgDownloadPdf(){
  try{
    const box = document.getElementById('lgBody');
    if(box) box.scrollTop = 0;
    lgToast(lgS.lang==='en' ? 'Opening print dialog' : 'Открываю окно печати');
    setTimeout(()=>{ try{ window.print(); }catch(e){ console.warn('lgDownloadPdf', e); } }, 240);
  }catch(e){ console.warn('lgDownloadPdf', e); }
}

/* ---------- скачать документ как самодостаточный HTML ---------- */
function lgDownloadHtml(){
  try{
    const doc = document.getElementById('lgDoc');
    if(!doc) return;
    const clone = doc.cloneNode(true);
    ['#lgProgFill','.lg-actions','.lg-consent','.lg-sec-top','.lg-progress'].forEach(sel=>{
      clone.querySelectorAll(sel).forEach(n=>n.remove());
    });
    const css = 'body{font:14px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#111;background:#fff;max-width:760px;margin:32px auto;padding:0 20px}h1{font-family:Impact,Bebas Neue,sans-serif;letter-spacing:.05em;margin:0 0 6px}h2{color:#0f8b00;font-family:Impact,Bebas Neue,sans-serif;letter-spacing:.06em;margin:26px 0 6px}.lg-doc-head{border:1px solid #0f8b00;background:#fafafa;padding:16px 18px;margin-bottom:22px;display:flex;gap:14px;align-items:flex-start;border-radius:8px}.lg-doc-logo{width:44px;height:44px;color:#0f8b00}.lg-doc-meta{font-size:11.5px;color:#555;margin-top:3px}.lg-updated{display:inline-block;margin-top:8px;padding:4px 10px;border:1px solid #0f8b00;color:#0f8b00;border-radius:99px;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.lg-toc{background:#f4f4f4;border-left:3px solid #0f8b00;padding:12px 14px;margin:16px 0 22px;border-radius:6px}.lg-toc ol{list-style:decimal;padding-left:22px;margin:0}.lg-toc li{margin:3px 0;font-size:12.5px;color:#333}.lg-toc-a{background:none;border:0;padding:0;text-align:left;color:#333;font:inherit;cursor:default}.lg-sec{margin-bottom:20px}.lg-sec ul{list-style:disc;padding-left:20px}.lg-table-wrap{overflow-x:auto;border:1px solid #999;border-radius:6px}.lg-table{width:100%;border-collapse:collapse;font-size:12px;min-width:520px}.lg-table th,.lg-table td{border:1px solid #999;padding:6px 8px;text-align:left;vertical-align:top}.lg-table th{background:#eee;text-transform:uppercase;font-size:10.5px;letter-spacing:.04em;color:#0f8b00}.lg-note{font-size:11px;color:#666}.lg-req{background:#f4f4f4;border:1px solid #ddd;border-radius:6px;padding:12px 14px;font-size:12.5px;color:#333;margin-top:22px}.lg-req-h{font-family:Impact,Bebas Neue,sans-serif;letter-spacing:.08em;color:#0f8b00;margin-bottom:6px}.doc-sign-block{margin-top:24px;padding-top:16px;border-top:1px dashed #999;display:flex;gap:24px;align-items:flex-end;flex-wrap:wrap}.lg-sig-cap{font-size:11px;color:#555;margin-top:5px}.lg-sig-line{height:1px;background:#999;margin-top:-8px}.lg-seal{width:150px;height:150px}.lg-seal img{width:100%;height:100%;object-fit:contain}.lg-deal-facts{display:grid;grid-template-columns:auto 1fr;gap:8px 14px;background:#f4f4f4;border:1px solid #ddd;border-radius:6px;padding:12px 14px;font-size:12.5px}.lg-deal-facts dt{color:#555}.lg-deal-facts dd{margin:0;font-weight:700}';
    const isDeal = (lgKind === 'deal');
    const title = isDeal ? (lgS.lang==='en' ? 'OKO — Deal Certificate' : 'OKO — Договор-акт по сделке') : (LG_DOCS[lgKind][lgS.lang].title + ' — OKO');
    const iso = new Date().toISOString().slice(0,10);
    const fnKind = isDeal ? 'deal' : lgKind;
    const fn = 'oko-'+fnKind+'-'+lgS.lang+'-'+iso+'.html';
    const html = '<!doctype html><html lang="'+lgS.lang+'"><head><meta charset="utf-8"><title>'+title+'</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>'+css+'</style></head><body>'+clone.outerHTML+'</body></html>';
    const blob = new Blob([html], {type:'text/html;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fn; document.body.appendChild(a); a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 800);
    lgToast(lgS.lang==='en' ? 'Downloaded' : 'Файл скачан');
  }catch(e){ console.warn('lgDownloadHtml', e); }
}

/* ---------- поделиться ссылкой ---------- */
function lgShareLink(){
  try{
    const slug = { offer:'oferta', privacy:'privacy', terms:'terms', consent:'consent', refund:'refund', license:'license' }[lgKind] || lgKind;
    const url  = 'https://okoteam.top/legal/' + slug;
    const d    = LG_DOCS[lgKind] && LG_DOCS[lgKind][lgS.lang];
    const title= (d && d.title) || 'OKO Legal';
    const done = ()=> lgToast(lgS.lang==='en' ? 'Link copied' : 'Ссылка скопирована');
    if(navigator.share){
      navigator.share({ title:'OKO — '+title, text:title, url }).catch(()=>{
        if(navigator.clipboard) navigator.clipboard.writeText(url).then(done).catch(()=>{});
      });
    } else if(navigator.clipboard){
      navigator.clipboard.writeText(url).then(done).catch(()=>{});
    } else {
      const t = document.createElement('textarea'); t.value = url;
      document.body.appendChild(t); t.select();
      try{ document.execCommand('copy'); done(); }catch(e){}
      t.remove();
    }
  }catch(e){ console.warn('lgShareLink', e); }
}

/* мини-тост (использует core toast если есть, иначе временный чип) */
function lgToast(msg){
  try{ if(typeof toast==='function'){ toast(msg); return; } }catch(e){}
  try{
    let t = document.getElementById('lgToast');
    if(!t){
      t = document.createElement('div'); t.id = 'lgToast';
      t.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:var(--raised,#141414);color:var(--accent,#9AFF00);border:1px solid var(--accent,#9AFF00);padding:8px 16px;border-radius:99px;font:600 12.5px/1 Montserrat,sans-serif;letter-spacing:.04em;z-index:9999;box-shadow:0 6px 24px rgba(0,0,0,.35);opacity:0;transition:opacity .2s';
      document.body.appendChild(t);
    }
    t.textContent = msg; t.style.opacity = '1';
    clearTimeout(t._to); t._to = setTimeout(()=>{ t.style.opacity = '0'; }, 1600);
  }catch(e){}
}

/* плавный скролл к секции внутри контейнера документа */
function lgJump(id){
  const el = document.getElementById(id);
  const box = document.getElementById('lgBody');
  if(!el || !box) return;
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const r1 = el.getBoundingClientRect(), r2 = box.getBoundingClientRect();
  const top = box.scrollTop + (r1.top - r2.top) - 14;
  box.scrollTo({top: top<0?0:top, behavior: reduce ? 'auto' : 'smooth'});
  el.classList.add('lg-flash');
  setTimeout(()=>el.classList.remove('lg-flash'), 900);
}

/* ---------- scroll-spy: подсветка активного пункта оглавления при прокрутке ---------- */
let _lgSpyBound = false;
function lgSpyUpdate(){
  try{
    const box = document.getElementById('lgBody');
    const doc = document.getElementById('lgDoc');
    if(!box || !doc) return;
    const secs = doc.querySelectorAll('.lg-sec');
    const links = doc.querySelectorAll('.lg-toc-a');
    if(secs.length && links.length){
      const bt = box.getBoundingClientRect().top;
      let cur = 0;
      secs.forEach((s,i)=>{ if(s.getBoundingClientRect().top - bt <= 90) cur = i; });
      links.forEach((a,i)=>a.classList.toggle('on', i===cur));
    }
    const fill = document.getElementById('lgProgFill');
    if(fill){
      const max = Math.max(1, box.scrollHeight - box.clientHeight);
      const p = Math.max(0, Math.min(100, (box.scrollTop / max) * 100));
      fill.style.width = p.toFixed(2) + '%';
    }
  }catch(e){}
}
function lgBindSpy(){
  const box = document.getElementById('lgBody');
  if(!box || _lgSpyBound) return;
  _lgSpyBound = true;
  let tick = false;
  box.addEventListener('scroll', ()=>{
    if(tick) return; tick = true;
    requestAnimationFrame(()=>{ lgSpyUpdate(); tick = false; });
  }, {passive:true});
}

/* ---------- рендер (hub / doc / deal) ---------- */
function lgRender(){
  const v = document.getElementById('legalView');
  const head = document.getElementById('lgHeadTitle');
  const ru = document.getElementById('lgLangRu'), en = document.getElementById('lgLangEn');
  if(ru) ru.classList.toggle('on', lgS.lang==='ru');
  if(en) en.classList.toggle('on', lgS.lang==='en');
  const tabs = document.getElementById('lgTabs');
  const body = document.getElementById('lgBody');
  if(!v || !body) return;

  const isHub = !lgKind;
  const isDeal = (lgKind === 'deal');
  v.classList.toggle('hub',  isHub);
  v.classList.toggle('doc', !isHub);

  if(isHub){
    if(head) head.textContent = lgS.lang==='en' ? 'OKO Legal' : 'Документы OKO';
    if(tabs) tabs.innerHTML = '';
    body.innerHTML = lgHubHtml(lgS.lang);
    body.scrollTop = 0;
    return;
  }

  /* режим doc / deal */
  if(head){
    if(isDeal){
      head.textContent = lgS.lang==='en' ? 'Deal certificate' : 'Договор-акт';
    } else {
      const d = LG_DOCS[lgKind][lgS.lang];
      head.textContent = d.title;
    }
  }
  if(tabs){
    // табы показываем только для «обычных» документов; для сделки — скрываем
    if(isDeal){
      tabs.innerHTML = '';
    } else {
      tabs.innerHTML = LG_TABS.map(t0=>
        `<button type="button" class="lg-tab ${t0.k===lgKind?'on':''}" onclick="lgGo('${t0.k}')">${I('file')} ${t0[lgS.lang]||t0.ru}</button>`).join('');
    }
  }
  body.innerHTML = isDeal ? lgDealHtml(lgDealCtx||{}, lgS.lang) : lgDocHtml(lgKind, lgS.lang);
  body.scrollTop = 0;
  lgBindSpy(); lgSpyUpdate();
}

/* ---------- публичное API ---------- */
function openLegalHub(){
  lgKind = null; lgDealCtx = null;
  lgRender();
  const v = document.getElementById('legalView'); if(v) v.classList.add('open');
}
function openLegalDoc(kind){
  if(!LG_DOCS[kind]){ return openLegalHub(); }
  lgKind = kind; lgDealCtx = null;
  lgRender();
  const v = document.getElementById('legalView'); if(v) v.classList.add('open');
}
function openLegalDeal(ctx){
  lgKind = 'deal'; lgDealCtx = ctx || {};
  lgRender();
  const v = document.getElementById('legalView'); if(v) v.classList.add('open');
}
function closeLegalDoc(){
  const v = document.getElementById('legalView');
  if(v) v.classList.remove('open');
}
function lgBackToHub(){ lgKind = null; lgDealCtx = null; lgRender(); }
function lgGo(kind){ if(LG_DOCS[kind]){ lgKind = kind; lgDealCtx = null; lgRender(); } }
function lgSetLang(l){
  if(l!=='ru' && l!=='en') return;
  lgS.lang = l; lgSave(); lgRender();
}

/* строка юр-ссылок на экране входа */
function lgRenderAuthLegal(l){
  const al = document.querySelector('.auth-legal');
  if(!al) return;
  const en = l==='en';
  const pre  = en ? 'By continuing you accept the ' : 'Продолжая, ты принимаешь ';
  const mid  = en ? ' and the ' : ' и ';
  const terms= en ? 'Terms of Service' : 'условия сервиса';
  const priv = en ? 'Privacy Policy' : 'политику конфиденциальности';
  al.innerHTML = `${pre}<span class="lg-a" onclick="openLegalDoc('terms')">${terms}</span>${mid}<span class="lg-a" onclick="openLegalDoc('privacy')">${priv}</span>`;
}

/* ---------- самоинициализация ---------- */
(function lgInit(){
  /* а) строка «Документы OKO» в профиле — перед «Выйти» */
  try{
    const rows = document.querySelectorAll('#screen-profile .prow');
    let logoutRow = null;
    rows.forEach(r=>{ if((r.getAttribute('onclick')||'').indexOf('doLogout')>-1) logoutRow = r; });
    if(logoutRow && !document.getElementById('prowLegal')){
      const b = document.createElement('button');
      b.className = 'prow'; b.id = 'prowLegal';
      b.innerHTML = `${I('file')} Документы OKO <span class="chev">${I('chev')}</span>`;
      b.onclick = ()=>openLegalHub();
      logoutRow.parentNode.insertBefore(b, logoutRow);
    }
  }catch(e){}

  /* б) тайл в хабе «Мини-аппы» */
  if(typeof addSvcTile==='function'){
    addSvcTile({id:'legal', label:'Документы', ico:'file', onclick:()=>openLegalHub()});
  }

  /* в) кликабельные ссылки на экране входа */
  try{ lgRenderAuthLegal(typeof LANG!=='undefined'?LANG:'ru'); }catch(e){}

  /* следовать за глобальным переключением языка */
  if(typeof onLangChange==='function'){
    onLangChange(l=>{
      if(l==='ru'||l==='en'){
        lgS.lang = l; lgSave();
        const v = document.getElementById('legalView');
        if(v && v.classList.contains('open')) lgRender();
        try{ lgRenderAuthLegal(l); }catch(e){}
      }
    });
  }

  /* i18n-регистрация подписей */
  if(typeof regT==='function'){
    regT({ 'lg.docs': {ru:'Документы OKO', en:'OKO Legal'} });
  }

  /* г) авто-открытие договора-акта после успешной оплаты подписки.
     Обёртываем doPay откладывая до полной загрузки всех модулей (paywall/wallet/games тоже могут его перехватывать). */
  setTimeout(function(){
    try{
      if(typeof doPay !== 'function') return;
      const _prevDoPay = doPay;
      window.doPay = function(){
        const st = (typeof payState !== 'undefined') ? payState : null;
        let plan  = 'START', period = 12, amount = 0, method = 'card';
        try{
          if(st){
            plan   = st.plan   || plan;
            period = st.period || period;
            method = st.method || method;
            if(typeof payPrice === 'function'){ const pp = payPrice(); if(pp && pp.total != null) amount = pp.total; }
            if(!amount && typeof PLANS !== 'undefined' && PLANS[plan]){
              amount = (PLANS[plan].price||0) * period;
            }
          }
        }catch(e){}
        const r = _prevDoPay.apply(this, arguments);
        /* открываем договор после закрытия sheet «Оплата» с задержкой,
           чтобы не мешать анимации «Оплата успешна». */
        try{
          setTimeout(function(){
            const buyer = (typeof PROFILE !== 'undefined' && PROFILE && PROFILE.name) ? PROFILE.name : 'Покупатель';
            const methodLbl = ({card:'банковская карта РФ', crypto:'криптовалюта', lava:'Lava.top'})[method] || method;
            openLegalDeal({buyer, plan, period, amount, currency:'RUB', method:methodLbl});
          }, 2600);
        }catch(e){}
        return r;
      };
    }catch(e){}
  }, 1200);
})();
