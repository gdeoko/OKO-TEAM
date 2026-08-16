# База контактов — правила Даниэля

Даниэль дал жёсткое правило:

> Каждый кто попадает в базу (подал заявку, зарегистрировался, ввёл email в любой форме) — автоматически:
> - в `subscribers` с `active=1`
> - в `users` с `notify_email=1`
> - НЕ считается «отписанным», «неактивным», «без уведомлений»

Уже сделано (в этом чате):
- Прогнал миграцию: для каждого users с email → INSERT OR IGNORE в subscribers active=1
- Реактивировал 20 подписчиков что были active=0 без bounce-тега
- Проверил 12 точек входа — все вызывают `nl_ensure_subscriber` корректно

Итог: **27 046 активных подписчиков + 40 609 институций = 67 655 адресатов одной волны**.

## Что должно продолжать работать (не сломать)

Точки входа, которые уже правильно ставят активную подписку:

1. `api/v1/apply.php` — при подаче заявки создаёт users + subscribers
2. `api/v1/subscribe.php` — попап-подписка
3. `api/v1/auth_email.php` — регистрация по email
4. `api/v1/auth_phone.php` — регистрация по телефону
5. `api/v1/tg_login.php` — Telegram OAuth
6. `api/v1/tma_auth.php` — Telegram Mini App
7. `api/v1/oauth_vk.php`, `api/v1/oauth_max.php` — соцсети
8. `api/v1/order.php`, `api/v1/order_manage.php` — заказ наград
9. `core/auth.php` — общая функция регистрации
10. `core/newsletter.php` — `nl_ensure_subscriber` (главная точка)

## Правила отключения из базы

**Автоматическое удаление** (пользователь ничего не делает):
- Hard-bounce от почтовика (5.1.1, user unknown) → `nl_mark_bounced()` → active=0, tag=bounced
- Написал ОТКАЗ по партнёрству (novosti@) → email удаляется навсегда из institutions
- Написал ОТКАЗ на обращение ведомства (kc@) → удаляется из institutions kind='ministry'

**Ручное отписание**:
- Клик по «Отписаться» в письме → `/api/v1/unsubscribe.php?token=...` → active=0, tag=unsub

**Что НЕ должно снимать активность**:
- Один soft-bounce (временный сбой почтовика — retry)
- Отсутствие открытий/кликов (не отписываем неактивных, они могут ещё открыть)

## Что НЕ делать

- НЕ реактивировать `active=0` с тегом `bounced` или `unsub` (это осознанные отписки/невалидные адреса)
- НЕ создавать `subscribers` для наших собственных ящиков (kc@/news@/novosti@/nagradi@) — они в исключении по email
- НЕ создавать `subscribers` для `role IN ('owner','admin','orgcom','moderator','jury','designer')` — это персонал
