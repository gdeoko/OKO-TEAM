/* ================= LEGAL: юридические документы OKO (префикс lg-) =================
   Оферта / Политика конфиденциальности / Пользовательское соглашение, RU + EN.
   Печать (sealSvg) и подпись (signatureImg) — из core-ext. openLegalDoc(kind) — публичное API. */

/* ---------- состояние (localStorage oko-legal) ---------- */
const lgS = (()=>{ try{ return JSON.parse(localStorage.getItem('oko-legal'))||null; }catch(e){ return null; } })() || { lang: (typeof LANG!=='undefined'?LANG:'ru') };
function lgSave(){ try{ localStorage.setItem('oko-legal', JSON.stringify(lgS)); }catch(e){} }
let lgKind = 'offer'; // offer | privacy | terms | consent

const LG_TABS = [
  {k:'offer',   ru:'Оферта',            en:'Offer'},
  {k:'privacy', ru:'Конфиденциальность',en:'Privacy'},
  {k:'terms',   ru:'Соглашение',        en:'Terms'},
  {k:'consent', ru:'Согласие на ПД',    en:'Data consent'}
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
`<table class="lg-table">
<tr><th>Тариф</th><th>Цена / мес*</th><th>Состав</th></tr>
<tr><td>START</td><td>$12</td><td>Все чаты и сообщества, 10 проверок видео в месяц, обучение нейросетям, активация партнёрской программы.</td></tr>
<tr><td>PRO</td><td>$39</td><td>Полный доступ к Бирже и Академии, расширенная аналитика, приоритетная модерация контента.</td></tr>
<tr><td>BUSINESS</td><td>$158</td><td>Рекламный кабинет без ограничений, командные аккаунты, персональный менеджер и приоритетная поддержка.</td></tr>
</table>
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
`<table class="lg-table">
<tr><th>Plan</th><th>Price / mo*</th><th>Includes</th></tr>
<tr><td>START</td><td>$12</td><td>All chats and communities, 10 video checks per month, AI training courses, affiliate program activation.</td></tr>
<tr><td>PRO</td><td>$39</td><td>Full access to the Marketplace and Academy, advanced analytics, priority content moderation.</td></tr>
<tr><td>BUSINESS</td><td>$158</td><td>Unlimited advertising cabinet, team accounts, dedicated manager and priority support.</td></tr>
</table>
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
{h:'ИИ-модерация и блокировки', b:
`<p>Загружаемый контент (видео, изображения, тексты) проходит автоматическую премодерацию с использованием ИИ-моделей. При выявлении признаков нарушения контент может быть скрыт до проверки; спорные случаи эскалируются модератору-человеку.</p>
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
{h:'AI Moderation and Restrictions', b:
`<p>Uploaded content (video, images, texts) undergoes automatic pre-moderation using AI models. If signs of a violation are detected, the content may be hidden pending review; disputed cases are escalated to a human moderator.</p>
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
<p>Обработка осуществляется как с использованием средств автоматизации (включая ИИ-модели премодерации контента), так и без таковых. Запись, систематизация, накопление, хранение, уточнение и извлечение персональных данных граждан РФ осуществляются с использованием баз данных на территории Российской Федерации (ч. 5 ст. 18 152-ФЗ).</p>`},
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
<p>Processing is carried out both by automated means (including AI content pre-moderation models) and without them. Recording, systematisation, accumulation, storage, clarification and retrieval of personal data of Russian citizens are performed using databases located in the Russian Federation (Art. 18(5) of Law 152-FZ).</p>`},
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

/* ---------- рендер ---------- */
function lgDocHtml(kind, lang){
  const d = LG_DOCS[kind][lang];
  const r = LG_REQ[lang];
  const opLabel   = lang==='en' ? 'Operator'  : 'Оператор';
  const tocLabel  = lang==='en' ? 'Contents'  : 'Содержание';
  const reqLabel  = lang==='en' ? 'Operator details' : 'Реквизиты Оператора';
  const topLabel  = lang==='en' ? 'to contents' : 'к содержанию';
  const revLabel  = lang==='en' ? d.rev + ' · effective ' + r.date : d.rev + ' · дата вступления в силу: ' + r.date;
  const sid = (i)=>'lg-s-'+kind+'-'+i;
  const toc = `<nav class="lg-toc" aria-label="${tocLabel}">
      <div class="lg-toc-h">${I('file')}<b>${tocLabel}</b></div>
      <ol>${d.secs.map((s,i)=>`<li><button type="button" class="lg-toc-a" onclick="lgJump('${sid(i)}')"><span class="lg-toc-n">${i+1}</span><span>${s.h}</span></button></li>`).join('')}</ol>
    </nav>`;
  return `<div class="lg-doc" id="lgDoc">
    <div class="lg-doc-head">
      <svg class="lg-doc-logo"><use href="#i-logo"/></svg>
      <div>
        <h1>${d.title}</h1>
        <div class="lg-doc-meta"><b>OKO PROJECT</b> · ${revLabel}</div>
        <div class="lg-doc-meta">${opLabel}: ${r.op}, ${r.inn}</div>
      </div>
    </div>
    ${toc}
    ${d.secs.map((s,i)=>`<section class="lg-sec" id="${sid(i)}"><h2><span class="lg-sec-n">${i+1}.</span> ${s.h}<button type="button" class="lg-sec-top" onclick="lgJump('lgDoc')" title="${topLabel}">${I('chev')}</button></h2>${s.b}</section>`).join('')}
    <div class="lg-req">
      <div class="lg-req-h">${reqLabel}</div>
      <b>${r.op}</b><br>${r.brand}<br>${r.inn}<br>${r.geo}<br>E-mail: ${r.mail}
    </div>
    <div class="doc-sign-block">
      <div class="lg-seal">${sealSvg(150)}</div>
      <div class="lg-sig-wrap">
        <div class="sig">${signatureImg(150)}</div>
        <div class="lg-sig-line"></div>
        <div class="lg-sig-cap">${r.sig}</div>
      </div>
    </div>
  </div>`;
}

/* плавный скролл к секции/оглавлению внутри контейнера документа */
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

/* ---------- scroll-spy: подсветка активного пункта оглавления при прокрутке ----------
   Лёгкий, пассивный, throttle через rAF — не создаёт лага и не мешает перф-слою. */
let _lgSpyBound = false;
function lgSpyUpdate(){
  try{
    const box = document.getElementById('lgBody');
    const doc = document.getElementById('lgDoc');
    if(!box || !doc) return;
    const secs = doc.querySelectorAll('.lg-sec');
    const links = doc.querySelectorAll('.lg-toc-a');
    if(!secs.length || !links.length) return;
    const bt = box.getBoundingClientRect().top;
    let cur = 0;
    secs.forEach((s,i)=>{ if(s.getBoundingClientRect().top - bt <= 90) cur = i; });
    links.forEach((a,i)=>a.classList.toggle('on', i===cur));
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

function lgRender(){
  const head = document.getElementById('lgHeadTitle');
  if(head) head.textContent = lgS.lang==='en' ? 'OKO Legal' : 'Документы OKO';
  const ru = document.getElementById('lgLangRu'), en = document.getElementById('lgLangEn');
  if(ru) ru.classList.toggle('on', lgS.lang==='ru');
  if(en) en.classList.toggle('on', lgS.lang==='en');
  const tabs = document.getElementById('lgTabs');
  if(tabs) tabs.innerHTML = LG_TABS.map(t0=>
    `<button class="lg-tab ${t0.k===lgKind?'on':''}" onclick="lgGo('${t0.k}')">${I('file')} ${t0[lgS.lang]||t0.ru}</button>`).join('');
  const body = document.getElementById('lgBody');
  if(body){ body.innerHTML = lgDocHtml(lgKind, lgS.lang); body.scrollTop = 0; }
  /* привязать scroll-spy (единожды) и подсветить первый пункт оглавления */
  lgBindSpy(); lgSpyUpdate();
}

/* ---------- публичное API ---------- */
function openLegalDoc(kind){
  if(LG_DOCS[kind]) lgKind = kind;
  lgRender();
  const v = document.getElementById('legalView');
  if(v) v.classList.add('open');
}
function closeLegalDoc(){
  const v = document.getElementById('legalView');
  if(v) v.classList.remove('open');
}
function lgGo(kind){ if(LG_DOCS[kind]){ lgKind = kind; lgRender(); } }
function lgSetLang(l){
  if(l!=='ru' && l!=='en') return;
  lgS.lang = l; lgSave(); lgRender();
}

/* строка юр-ссылок на экране входа — на текущем языке приложения */
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
      b.onclick = ()=>openLegalDoc('offer');
      logoutRow.parentNode.insertBefore(b, logoutRow);
    }
  }catch(e){}

  /* б) тайл в хабе «Мини-аппы» */
  if(typeof addSvcTile==='function'){
    addSvcTile({id:'legal', label:'Документы', ico:'file', onclick:()=>openLegalDoc('offer')});
  }

  /* в) кликабельные ссылки на экране входа — на текущем языке */
  try{ lgRenderAuthLegal(typeof LANG!=='undefined'?LANG:'ru'); }catch(e){}

  /* следовать за глобальным переключением языка (если пользователь меняет язык приложения) */
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

  /* i18n-регистрация подписей (ядро i18n) */
  if(typeof regT==='function'){
    regT({ 'lg.docs': {ru:'Документы OKO', en:'OKO Legal'} });
  }
})();
