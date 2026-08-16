# Все цепочки автоматизации муз-мира — от триггера до результата

Каждая цепочка описана: КТО запускает → ЧТО происходит → КАКОЙ результат → ЧТО в БД.

---

## Цепочка 1: ПАРТНЁРСТВО (от обращения до благодарностей)

```
                    ┌─────────────────────────────────────────────┐
                    │  День 0: УЧРЕЖДЕНИЕ ПОЛУЧАЕТ ОБРАЩЕНИЕ     │
                    └─────────────────────────────────────────────┘

crontab: */15 8-18 * * * queue_institutions.php
  ↓
qi_target_depth() — считает норму глубины очереди
  ↓
invite_queue_institutions($limit)
  ↓
  Для каждого учреждения WHERE status='new' AND email!='' AND bounce_count<2:
  ↓
  invite_official_letter($inst, '', $comps, $unsubUrl)
     ├─ ol_create() — регистрирует в official_letters (номер DDMMYYYY/NNN + HMAC)
     ├─ pdf_letter_generate() — рендерит PDF обращения через bastion
     ├─ копирует афиши+положения в data/attach_cache/season-YYYY-MM/ (один раз)
     └─ возвращает {number, subject, html, pdf, attach: [9 файлов]}
  ↓
  insert('mail_queue', [
     'to_email' => $email,
     'to_name' => $inst['name'],
     'subject' => 'Приглашаем к участию в конкурсах — [Название] (исх. №...)',
     'body' => $html,
     'attach' => json_encode([9 файлов]),
     'priority' => 5,
     'campaign_type' => 'inst',
  ])

crontab: * * * * * process_newsletter_queue.php
  ↓
newsletter_process_queue()
  ↓
  фильтр: campaign_type='inst' → pool='cold' → box='unisender-cold' → from=novosti@муз-мир.рф
  ↓
  mail_send_failover($email, $subject, $body, ['pool'=>'cold', 'attach'=>[9 файлов]])
  ↓
  Unisender API POST /email/send.json
  ↓
  UPDATE mail_queue SET status='sent', sent_at=NOW, sent_via='unisender-cold'


                    ┌──────────────────────────────────────────┐
                    │  Дни 1-N: УЧРЕЖДЕНИЕ ОТВЕЧАЕТ           │
                    │  (ЭТА СТУПЕНЬКА - TODO для новой сессии) │
                    └──────────────────────────────────────────┘

TODO: crontab: */5 * * * * inbox_read.php
  ↓
  IMAP-читалка novosti@ через im_search(UNSEEN)
  ↓
  Для каждого нового письма:
    ├─ парсинг (im_parse) — тема, тело, вложения, headers
    ├─ детектор автоответчика (Auto-Submitted, X-Autoreply, "отсутствую")
    │     → если auto → is_autoresponder=1, handled_by='auto', игнор
    ├─ классификатор kind:
    │     ├─ "согласны/принимаем/готовы/да" → kind='partner_accept'
    │     ├─ "отказываемся/не интересно/нет" → kind='partner_decline'
    │     └─ иначе → kind='question'
    └─ INSERT INTO inbox_messages
  ↓
  IMAP помечает письмо SEEN

TODO: crontab: */2 * * * * inbox_actions.php
  ↓
  SELECT FROM inbox_messages WHERE handled_by='' AND is_autoresponder=0
  ↓
  Для kind='partner_accept':
    ├─ $inst = one("SELECT FROM institutions WHERE LOWER(email)=?")
    ├─ partner_accept($inst['id'])  ← готовая функция!
    │     ├─ генерит slug, номер ИП-2026-XXXXX, промокод PART-XXXXXXXX, пароль
    │     ├─ UPDATE institutions SET partner_status='accepted', ...
    │     └─ INSERT INTO partner_docs (cert), partner_events (accepted)
    ├─ partner_cert_pdf($inst['id'])  ← готовая функция! (генерит PDF через bastion)
    ├─ partner_send_welcome_email($inst['id'], $password_plain, $certPath)  ← НАПИСАТЬ
    │     └─ mail_send_failover(pool='awards', attach=[cert.pdf])
    └─ UPDATE inbox_messages SET handled_by='auto_accept', linked_partner_inst=$inst['id']


                    ┌──────────────────────────────────────────┐
                    │  День N+: ПАРТНЁР УСТАНАВЛИВАЕТ ЛИНК     │
                    │  Педагоги подают заявки → счётчик растёт  │
                    └──────────────────────────────────────────┘

Партнёр даёт ссылку /p/<slug> педагогам своего учреждения
  ↓
Педагог кликает → cookie partner_inst=<id> ставится на 30 дней
  ↓
Редирект на /apply?src=partner
  ↓
Педагог подаёт заявку с промокодом
  ↓
api/v1/apply.php:
  ├─ INSERT INTO applications
  ├─ partner_attach_application($aid, $instId)
  │     └─ UPDATE applications SET institution_id=$instId
  └─ partner_apply_promo($aid, $promoCode)
        └─ Транзакция: UPDATE institutions SET partner_promo_uses=+1 WHERE promo_uses<promo_max
              → если UPDATE 1 строку — применили, applications.discount=0.10
              → если 0 строк — лимит выбран или код неверный


                    ┌──────────────────────────────────────────┐
                    │  Дни N+5, N+10: АВТОТРИГГЕРЫ            │
                    └──────────────────────────────────────────┘

crontab: 15 * * * * partner_triggers.php
  ↓
Шаг 1: пересчёт счётчиков
  UPDATE institutions SET partner_apps_count = (SELECT COUNT FROM applications ...)
  ↓
Шаг 2: если partner_apps_count>=5 AND partner_notified_5=0
  ├─ собрать список педагогов (DISTINCT LOWER(TRIM(teacher)) из applications за 30 дней)
  ├─ partner_send_5apps_email() → mail_send_failover(pool='tx')
  │     Тема: "От Вашего учреждения — 5 заявок · открылась возможность заказать благодарности"
  ├─ UPDATE partner_notified_5=1
  └─ partner_log_event(kind='apps_5', payload={count:5})
  ↓
Шаг 3: если partner_apps_count>=10 AND partner_notified_10=0
  ├─ partner_send_10apps_email() → mail_send_failover(pool='tx')
  │     Тема: "Промокод −10% для Вашего учреждения — 10 заявок пройдено"
  ├─ UPDATE partner_notified_10=1, partner_promo_activated_at=NOW
  └─ partner_log_event(kind='apps_10')


                    ┌──────────────────────────────────────────┐
                    │  ПАРТНЁР ЗАКАЗЫВАЕТ БЛАГОДАРНОСТИ        │
                    │  через ЛК /partner?a=thanks              │
                    └──────────────────────────────────────────┘

Партнёр логинится /partner (email + password из приветственного письма)
  ↓
Открывает /partner?a=thanks
  ↓
Форма с автоподстановкой:
  ├─ автоматически: педагоги из applications.teacher DISTINCT (последние 30 дней)
  ├─ вручную: до 3 педагогов (ФИО + сколько работ)
  └─ чекбокс: "На директора учреждения" + поле ФИО (руководство один раз!)
  ↓
POST → валидация:
  ├─ ФИО не пусто, длина 5-100
  ├─ Директор ещё не был заказан (uniq index institution_id + LOWER(fio))
  └─ Педагог с этим ФИО ещё не был (уникальность)
  ↓
INSERT INTO partner_thanks (institution_id, role, fio, works_count, status='queued')
  ↓
partner_log_event(kind='thanks_form_sent')
  ↓
Показ "Заказ принят. Благодарности будут готовы в течение 3 рабочих дней."


                    ┌──────────────────────────────────────────┐
                    │  ГЕНЕРАЦИЯ И ОТПРАВКА БЛАГОДАРНОСТЕЙ    │
                    └──────────────────────────────────────────┘

crontab: 15 * * * * partner_triggers.php (тот же крон)
  ↓
Шаг 4: SELECT FROM partner_thanks WHERE status='queued'
  ↓
Группировка по institution_id (все благодарности одного учреждения в одно письмо)
  ↓
Для каждой группы:
  ├─ Для каждой записи partner_thanks:
  │     ├─ partner_thanks_next_no($instId, $role) — номер БЛГ-ИП-2026-XXXXX-РX/ПX
  │     ├─ partner_thanks_pdf($thanksId) — рендер PDF через bastion
  │     └─ INSERT INTO partner_docs (kind='thanks_manager'|'thanks_teacher', number, ...)
  ├─ Собрать письмо:
  │     ├─ subject: "Благодарственные письма — от Оргкомитета КЦ «Музыкальный Мир»"
  │     ├─ body: partner_email_thanks_body($inst, $listHtml, $count)
  │     └─ attach: [все PDF] (обычно до 4: 1 директор + 3 педагога)
  └─ mail_send_failover(pool='awards', attach=[...])
  ↓
UPDATE partner_thanks SET status='sent', sent_at=NOW WHERE id IN (...)
  ↓
partner_log_event(kind='thanks_delivered')


                    ┌──────────────────────────────────────────┐
                    │  ПРИОРИТЕТ 4 ДНЯ У ПАРТНЁРОВ            │
                    └──────────────────────────────────────────┘

crontab: * * * * * send_diplomas.php
  ↓
Для каждой заявки с готовым дипломом:
  ├─ проверяем institution_id → есть ли партнёр?
  ├─ $days = 5 (default)
  ├─ if partner_priority_days < $days → $days = partner_priority_days (= 4)
  └─ deadline = дата подачи + N рабочих дней
  ↓
Если дедлайн наступил — отправка диплома
```

---

## Цепочка 2: ВЕДОМСТВА / МИНИСТЕРСТВА (kc@)

```
                    ┌──────────────────────────────────────────┐
                    │  1-е ЧИСЛА МЕСЯЦА: РАССЫЛКА ВЕДОМСТВАМ  │
                    └──────────────────────────────────────────┘

crontab: 10 9 * * * ministry_letters.php
  ↓
Проверка: сегодня 1-3 число? Есть открытый бесплатный конкурс?
  ↓
SELECT FROM institutions WHERE kind='ministry' AND email!='' AND NOT already_sent_this_month
  ↓
Для каждого:
  ├─ lm_mail_ministry($ministry, $number, $comps, $unsubUrl)
  ├─ ol_create() — регистрирует в official_letters (kind='support')
  ├─ pdf_letter_generate() — PDF обращения (более официальный чем для учреждений)
  └─ insert('mail_queue', priority=5, campaign_type='official')
  ↓
Отправка через process_newsletter_queue → pool='official' → kc@ прямой SMTP


                    ┌──────────────────────────────────────────┐
                    │  ВЕДОМСТВО ОТВЕЧАЕТ (kc@)               │
                    │  Работает СЕЙЧАС (частично)              │
                    └──────────────────────────────────────────┘

crontab: 5 * * * * ministry_replies.php
  ↓
IMAP-скан kc@ (imap.yandex.ru:993)
  ↓
Для каждого нового письма:
  ├─ парсинг: тема, тело, вложения (сканы, PDF)
  ├─ проверка: from совпадает с адресом в institutions WHERE kind='ministry'?
  │     └─ если НЕТ → игнор
  ├─ извлечение вложений (сканы с бланком и подписью)
  ├─ конвертация PDF→JPG первой страницы (для галереи)
  ├─ mr_publish_scan() — публикация в раздел /support
  ├─ UPDATE official_letters SET replied_at=NOW, reply_file=<путь>
  ├─ уведомление владельцу в Telegram
  └─ подготовка поста в ВК

⚠️ TODO: расширить в новой сессии
  ├─ Если одобрение → ministry_send_thanks() (написать)
  │     └─ pool='official' → kc@, письмо "Благодарность за поддержку..."
  └─ Если отказ (по ключевым словам) → удалить из institutions WHERE kind='ministry'
```

---

## Цепочка 3: СВОЯ БАЗА / ЗАПУСК СЕЗОНА

```
                    ┌──────────────────────────────────────────┐
                    │  1-е ЧИСЛО МЕСЯЦА: MONTHLY LAUNCH        │
                    └──────────────────────────────────────────┘

crontab: 0 9 1 * * monthly_launch.php
  ↓
Открывает новый сезон:
  ├─ UPDATE competitions SET status='open' WHERE start_date='YYYY-MM-01'
  ├─ Генерит афиши через bastion
  └─ Записывает в launch_jobs расписание волн запуска

crontab: * * * * * launch_scheduler.php
  ↓
SELECT FROM launch_jobs WHERE run_at <= NOW AND status='pending'
  ↓
Для каждой задачи (типы: 'combo', 'vip', 'kabinet'):
  ├─ launch_combo_enqueue() → newsletter #2 в БД + mail_queue
  ├─ vk_publish() → пост в ВК
  └─ tg_notify() → уведомление в Telegram


                    ┌──────────────────────────────────────────┐
                    │  ВОЛНА COMBO (все 3-в-1: запуск + KO + VIP) │
                    └──────────────────────────────────────────┘

launch_combo_enqueue(false, $limit=30000)
  ↓
Аудитория:
  SELECT LOWER(email) FROM (
    subscribers WHERE active=1
    UNION
    users WHERE email!='' AND blocked=0 AND notify_email=1 AND role NOT IN ('owner','admin','orgcom')
  )
  ↓
Для каждого получателя:
  ├─ nl_ensure_subscriber() — гарантирует запись в subscribers с unsub_token
  ├─ Проверка идемпотентности: SELECT FROM mail_queue WHERE newsletter_id=2 AND email=?
  │     └─ если уже есть → skip
  ├─ Прикидка блоков:
  │     ├─ needCabinet = у юзера ещё не было last_login
  │     └─ needVip = не член клуба
  └─ INSERT INTO mail_queue (
       'build' = json_encode(['kind'=>'combo', 'nlid'=>2]),  ← рецепт, не тело!
       'priority' => 5,
       'campaign_type' => 'konkurs'
     )

⚠️ ВАЖНО: тело собирается НЕ здесь, а при отправке — актуальные пароли, конкурсы, статус клуба.


                    ┌──────────────────────────────────────────┐
                    │  ОТПРАВКА: тело собирается на лету        │
                    └──────────────────────────────────────────┘

crontab: * * * * * process_newsletter_queue.php → newsletter_process_queue()
  ↓
$row = SELECT FROM mail_queue WHERE priority>0 AND campaign_type='konkurs' AND status='queued'
  ↓
$built = nl_build_body($row)   ← магия
  ↓
  Разбирает build JSON: {kind:'combo', nlid:2}
  ↓
  Собирает:
    ├─ Здравствуйте, [person_greeting_name($email, $rawName)]!
    ├─ Хедер с брендом
    ├─ mmc_competition_card() для каждого открытого конкурса
    ├─ mmc_kabinet_block() если у юзера нет last_login (генерит новый временный пароль!)
    ├─ mmc_vip_perks_grid() если не член клуба
    └─ Футер + отписка
  ↓
  return ['subject' => $subject, 'body' => $html, 'after' => $callback]
     └─ $after — установка нового пароля юзеру ПОСЛЕ успешной отправки
  ↓
mail_send_failover($email, $subject, $body, ['pool'=>'bulk', 'unsubscribe_url'=>...])
  ↓
Unisender API → отправка через unisender box (news@)
  ↓
UPDATE mail_queue SET status='sent', sent_at=NOW, sent_via='unisender'
  ↓
Если $after callable → выполнить (сменить пароль юзеру)


                    ┌──────────────────────────────────────────┐
                    │  ОТКЛЮЧЕНО: волны "3 дня" и "последний"  │
                    │  (правило Даниэля: одна волна в месяц)  │
                    └──────────────────────────────────────────┘

crontab: 0 * * * * mailings.php
  ↓
Секция 2 (Осталось 3 дня): if (false && $hour === 10)   ← ОТКЛЮЧЕНО
Секция 3 (Последний день):  if (false && $hour === 9)    ← ОТКЛЮЧЕНО
Секция 3б (Приём закрыт):   работает — публикация в ВК/приложение о закрытии
```

---

## Цепочка 4: DRIP + ENGAGEMENT + REMINDERS (свои подписчики)

```
crontab: 30 10 * * * drip.php  (каждый день в 10:30)
  ↓
Шаг drip_d3 (через 3 дня после подписки):
  SELECT FROM subscribers WHERE created_at BETWEEN NOW-4d AND NOW-3d
                            AND active=1 AND NOT tags LIKE '%drip_d3%'
  ├─ subject: "Как подать заявку на конкурс — Культурный центр «Музыкальный Мир»"
  ├─ body: drip_body_apply($name)
  ├─ mail_queue() → воркер → news@
  └─ tags += 'drip_d3'

Шаг drip_d7 (через 7 дней):
  SELECT WHERE created_at BETWEEN NOW-8d AND NOW-7d
                AND NOT tags LIKE '%drip_d7%'
  ├─ subject: "Открытые конкурсы этого сезона"
  ├─ body: drip_body_competitions($name, $comps)
  └─ tags += 'drip_d7'


crontab: 0 12 * * * engagement.php  (каждый день в 12:00)
  ↓
Три ветки (по 300 юзеров max):
  ├─ Нет заявок вообще → notify_user('Участвуйте в конкурсе', ...)
  ├─ Открытый конкурс → notify_user('Открыт приём заявок', ...)
  └─ Обучающие подсказки (30 дней не повторяется, один тип за прогон)
  ↓
notify_user создаёт запись в notifications
  ↓
При следующей волне (или в следующем письме) — включается в тело


crontab: 0 10 * * * send_reminders.php  (каждый день в 10:00)
  ↓
Три ветки:
  1. Заявка без оплаты > N часов → напоминание "Не забудьте оплатить"
  2. Диплом отправлен, оригинал не заказан → "Ваш диплом готов — закажите оригинал"
  3. Через M дней после получения диплома → "Поделитесь впечатлением"
  ↓
reminder_enqueue() → mail_queue → воркер → news@
```

---

## Цепочка 5: РЕГИСТРАЦИЯ + ПОДАЧА ЗАЯВКИ + ОПЛАТА + ДИПЛОМ

```
                    ┌──────────────────────────────────────────┐
                    │  ЮЗЕР РЕГИСТРИРУЕТСЯ                     │
                    └──────────────────────────────────────────┘

POST /api/v1/auth_email.php action='register'
  ↓
Генерит код подтверждения → шлёт письмо "Код подтверждения: XXXX"
  ↓
POST action='verify' с кодом
  ↓
  ├─ INSERT INTO users
  ├─ nl_ensure_subscriber() → INSERT INTO subscribers WHERE active=1
  └─ Шлёт письмо "Добро пожаловать — ваш логин/пароль"


                    ┌──────────────────────────────────────────┐
                    │  ЮЗЕР ПОДАЁТ ЗАЯВКУ                     │
                    └──────────────────────────────────────────┘

POST /api/v1/apply.php
  ↓
  ├─ Валидация (ФИО, конкурс, номинация, работа/URL, педагог)
  ├─ Загрузка файла работы (если файл, не URL)
  ├─ INSERT INTO applications (status='new')
  ├─ Если partner_inst cookie: partner_attach_application($aid, $partInstId)
  ├─ Если промокод: partner_apply_promo($aid, $promoCode)
  │     └─ Транзакционно UPDATE partner_promo_uses (защита от гонки)
  ├─ Если платный конкурс: генерит платёжную ссылку ЮKassa
  └─ Ответ юзеру: {status: 'ok', number: 'MM-2026-XXXXX', pay_url: '...'}


                    ┌──────────────────────────────────────────┐
                    │  ОПЛАТА (ЮKassa)                        │
                    └──────────────────────────────────────────┘

Юзер платит через ЮKassa
  ↓
ЮKassa webhook → POST /api/v1/webhook_yukassa.php event='payment.succeeded'
  ↓
  ├─ UPDATE applications SET paid=1, paid_at=NOW
  ├─ Шлёт чек: subject "Чек об оплате — заявка на конкурс...", pool='awards'
  ├─ Партнёрская статистика: UPDATE institutions SET partner_apps_paid=+1
  │     (влияет на аналитику, не на триггеры)
  └─ Публикация "оплачена" в ленту (если настроено)


                    ┌──────────────────────────────────────────┐
                    │  ЖЮРИ ОЦЕНИВАЕТ                          │
                    └──────────────────────────────────────────┘

Админ или жюри в /admin/?p=grading (короткие)
                   или /admin/?p=longcomp (длинные)
                   ставит результат (Гран-при / Лауреат 1/2/3 / Дипломант...)
  ↓
UPDATE applications SET result=<звание>, judged_at=NOW


                    ┌──────────────────────────────────────────┐
                    │  ДИПЛОМ ГОТОВИТСЯ И ОТПРАВЛЯЕТСЯ         │
                    └──────────────────────────────────────────┘

crontab: * * * * * send_diplomas.php
  ↓
$days = 5 (default), или 4 для партнёров
$deadline = дата оплаты + N рабочих дней
  ↓
Если $deadline <= NOW:
  ├─ diploma_render() → генерит PDF через bastion (шаблон diploma_html.php)
  ├─ INSERT INTO diplomas (number='MM-YYYY-XXXXX', pdf_path, ...)
  ├─ mail_send_failover($email, "Ваш диплом...", $html, ['pool'=>'awards', 'attach'=>$pdf])
  └─ UPDATE diplomas SET sent_at=NOW


                    ┌──────────────────────────────────────────┐
                    │  НАПОМИНАНИЕ ЗАКАЗАТЬ ОРИГИНАЛ           │
                    └──────────────────────────────────────────┘

crontab: 0 10 * * * send_reminders.php
  ↓
Если диплом отправлен но оригинал не заказан (через M дней):
  → письмо "Ваш диплом готов — не забудьте заказать оригинал награды"
     (см. раздел send_reminders.php в ALL_EMAIL_TEMPLATES.md)
```

---

## Цепочка 6: ОТПИСКА + BOUNCE + ЧИСТКА БАЗЫ

```
                    ┌──────────────────────────────────────────┐
                    │  ЮЗЕР КЛИКНУЛ "ОТПИСАТЬСЯ"              │
                    └──────────────────────────────────────────┘

GET /api/v1/unsubscribe.php?token=XXX
  ↓
$sub = SELECT FROM subscribers WHERE unsub_token=?
  ↓
UPDATE subscribers SET active=0, tags += 'unsub' WHERE id=$sub['id']
  ↓
Показ страницы "Вы отписаны от рассылок"


                    ┌──────────────────────────────────────────┐
                    │  ПОЧТОВИК ОТВЕТИЛ BOUNCE                │
                    └──────────────────────────────────────────┘

crontab: */30 * * * * process_bounces.php  (каждые 30 мин)
  ↓
IMAP-скан news@ (INBOX) для отсева мёртвых адресов
  ↓
Для каждого нового письма:
  ├─ Ищет паттерны: "5.1.1", "does not exist", "user unknown", "mailbox unavailable"
  ├─ Извлекает email адрес из письма
  └─ Классифицирует hard vs soft:
        ├─ hard: nl_mark_bounced($email) → active=0, tag='bounced'
        └─ soft: пропуск (retry позже)
  ↓
Пометка письма SEEN в IMAP


                    ┌──────────────────────────────────────────┐
                    │  GUARD-СТРИК ПРИ МАССОВЫХ ОТКАЗАХ        │
                    └──────────────────────────────────────────┘

Внутри newsletter_process_queue():
  ↓
Счётчик hard-bounce за прогон
  ↓
Если > 30 подряд:
  ├─ mass_sending_set(false, 'guard_hard_streak')
  ├─ nl_log("СТОП: 30+ отказов подряд, канал сломан, из базы никого не выводим")
  └─ break out of loop
```

---

## Цепочка 7: ДИСК-ОЧИСТКА (защита от переполнения)

```
crontab: 0 * * * * disk_cleanup.php  (каждый час)
  ↓
Шаг 1: attach_cache
  Для каждой папки data/attach_cache/inv_*:
    ├─ Есть ли queued-письма которые ссылаются на неё?
    │     └─ SELECT COUNT FROM mail_queue WHERE status='queued' AND attach LIKE '%[basename]%'
    ├─ Если 0 → rm -rf папка
    └─ Иначе → оставить
  ↓
Шаг 2: обращения
  Для sent-писем старше 3 дней:
    ├─ SELECT DISTINCT o.file FROM official_letters o JOIN mail_queue m ...
    └─ Удалить PDF
  ↓
Шаг 3: бэкапы старше 10 дней (кроме weekly и before_cleanup)
  ↓
Всё логируется в data/logs/disk_cleanup.log
```

---

## Цепочка 8: ВИДЖЕТ ДАШБОРДА (быстрая пауза/возобновление)

```
Владелец заходит на /admin/?p=dashboard
  ↓
Виджет "Массовая рассылка" (в admin/dashboard.php)
  ├─ ВКЛ/ВЫКЛ индикатор
  ├─ Метрики (ушло сегодня, в очереди, план дня, лесенка)
  └─ Кнопки

Кнопка "▶ Возобновить" (когда ВЫКЛ):
  POST ?do=mass_toggle&act=resume + CSRF
  ↓
  ├─ UPDATE mail_queue SET status='queued' WHERE status='paused' AND priority>0
  ├─ mass_sending_set(true)
  └─ setting('mass_sending_off_reason', '')

Кнопка "⏸ Пауза" (когда ВКЛ):
  POST ?do=mass_toggle&act=pause + CSRF
  ↓
  ├─ UPDATE mail_queue SET status='paused' WHERE status='queued' AND priority>0
  └─ mass_sending_set(false, 'paused_by_owner_dashboard')
```
