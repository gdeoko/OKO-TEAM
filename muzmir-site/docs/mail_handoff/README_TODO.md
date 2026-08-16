# TODO — что делать в новой сессии

Дорожная карта в порядке приоритета.

## Читать в таком порядке

1. `../CONTEXT_FULL.md` — общая хронология (10 мин)
2. `CHRONOLOGY_TIMELINE.md` — по-часовая лента 14-15 августа (5 мин)
3. `PARTNER_FULL_PIPELINE.md` — конвейер партнёрки от А до Я (15 мин)
4. `MAIL_ROUTING_FULL.md` — маршрутизация 4 ящиков + пулы (10 мин)
5. `TEMPLATES_INDEX.md` — все шаблоны писем и PDF (10 мин)
6. `DASHBOARD_WIDGET.md` — виджет «Массовая рассылка» (5 мин)
7. `INBOX_SPEC.md` — ГЛАВНАЯ задача: IMAP-мониторинг + чат-бот на письмах (20 мин)
8. `CHATBOT_ON_EMAIL.md` — как подключить `chat_brain.php` для ответов (10 мин)
9. `MINISTRY_KC_AUTOMATION.md` — автоматизация ответов ведомств (10 мин)
10. `BASE_MERGE_RULES.md` — правила единой базы (5 мин)

## Приоритеты работы (P0 → P3)

### P0 — сделать первым (без этого потери в бизнесе)
- IMAP-читалка для novosti@ (партнёрские согласия/отказы теряются в никуда)
- Автопринятие партнёров: если ответили «согласны» → `partner_accept($instId)` сразу (сертификат + логин уходят автоматом)
- Автоудаление отказников: если ответили «отказываемся» → удалить email из institutions
- Детектор автоответчиков (иначе бесконечный спам-петля)

### P1 — сразу после P0
- IMAP-читалка для остальных 3 ящиков (news@, kc@, nagradi@)
- Расширить `ministry_replies.php`: благодарность за одобрение + автоудаление при отказе
- Chat-бот на письмах (использовать `chat_brain.php`)
- Guard от петли + rate limit

### P2 — админка
- Раздел `/admin/?p=inbox` — диалоги (только где бот ответил, автоответчики не показывать)
- Метрики на дашборд (входящих сегодня, партнёров принято, ведомств одобрило)
- Кнопка «Ответить вручную» / «Взять на человека»

### P3 — качество
- Восстановить `core/humanize.php` (файл 0 байт, нужен для гуманизации ответов бота)
- Специальный контекст для чат-бота по каждому ящику
- Публикация одобрений ведомств в /support галерею (частично уже работает)

## Что НЕ трогать (уже работает — сломаешь всё)

- `partner_accept()`, `partner_decline()`, `partner_apply_promo()` — только расширяем, не меняем
- `newsletter_process_queue()` — патч маршрутизации пулов (см. `MAIL_ROUTING_FULL.md`), не откатывай
- `invite_official_letter()` — общий сезонный кэш вложений, не переделывай в per-письмо
- `cron/disk_cleanup.php` — не удаляй, диск иначе за сутки забьётся
- `mailings.php` секции 2 и 3 — отключены осознанно (одна волна в месяц)
- `letter_mail.php`/`invite_queue.php` — ФИО убрано намеренно (обращения безличные)

## Регресс-тесты после ЛЮБОЙ правки

```bash
# Партнёрская программа (72 теста)
php /var/www/muzmir/scripts/audit_partner.php
php /var/www/muzmir/scripts/audit_partner_extended.php

# Живой чек рассылки (проверь что не встала)
sqlite3 /var/www/muzmir/data/muzmir.sqlite \
  "SELECT sent_via, COUNT(*), MAX(sent_at) FROM mail_queue
   WHERE status='sent' AND priority>0 AND sent_at>=date('now')
   GROUP BY sent_via;"

# Диск
df -h /

# Ошибки последнего часа
sqlite3 /var/www/muzmir/data/muzmir.sqlite \
  "SELECT status, error, COUNT(*) FROM mail_queue
   WHERE priority>0 AND created_at>=datetime('now','-1 hour')
   GROUP BY status, error;"
```

## Красные флаги (что-то пошло не так)

- `mass_sending=0` при поднятом rубильнике → guard-стрик сработал, смотри `newsletter.log`
- Диск >85% → attach_cache растёт быстрее чем чистится, разбирайся с крон-очисткой
- Failed >20 за час → почтовик отказывает, смотри mail.log
- `partner_events kind='accepted'` без последующего `thanks_delivered` в 5+ днях → крон `partner_triggers` встал
- Ответы приходят на novosti@ но `partner_docs` не растёт → inbox_reader молчит, смотри логи

## Ключевые люди и адреса

- Даниэль (владелец): `@ktodaniel`, `okoteam.top@gmail.com`
- Домен: `музыкальный-мир.рф` = `xn----7sbugdeiegh1b0a9hen.xn--p1ai`
- Телефон центра: `+7 (999) 504-88-99`
- Регистрация: Роскомнадзор № 094084 от 24.06.2025
- Собственные ящики: `news@, novosti@, kc@, nagradi.on@ @xn----7sbugdeiegh1b0a9hen.xn--p1ai`
- Приём (не отвечаем): `kulturniy.centr.mir@gmail.com`
