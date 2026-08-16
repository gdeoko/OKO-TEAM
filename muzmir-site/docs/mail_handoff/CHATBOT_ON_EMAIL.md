# Чат-бот на письмах — как подключить

Не путать с чат-ботом на сайте (тот уже работает через `chat_brain.php` и Gemini). Здесь речь о том чтобы **тот же мозг** отвечал на входящие письма.

## Инфраструктура готова

### 1. Мозг существует
Файл: `03_prod_files/core/chat_brain.php` (85 КБ).

Ключевые функции:
- `chat_system_prompt()` — системный промпт про Музмир (что мы, какие конкурсы, тарифы, партнёрство)
- `chat_official_kb()` — база знаний в MD-формате
- `chat_gemini_keys()` — список API ключей Gemini
- `chat_gemini_reply($apiKey, $sessionKey, $text)` — синхронный ответ
- `chat_gemini_mark_exhausted($key)` / `chat_gemini_is_exhausted($key)` — обход исчерпанных ключей
- `chat_user_context(?int $uid)` — контекст пользователя (его заявки, оплаты)

### 2. Ротация ключей
Функция `chat_gemini_reply()` уже умеет:
- Пытаться отправить через ключ
- Если 429 (rate limit) — помечать ключ exhausted на N часов
- Брать следующий из `chat_gemini_keys()`
- Возвращать `null` если все ключи исчерпаны (в этом случае бот молчит, письмо остаётся с `handled_by=''` для повторной попытки)

### 3. Гуманизатор
Файл `core/humanize.php` (был на проде — проверил, файл существует но 0 байт — надо восстановить или переписать!).

Правила гуманизации из корневого CLAUDE.md:
- Никаких длинных тире
- Никаких «важно отметить», «таким образом», «комплексный подход»
- Обращение по имени
- Не звучать как реклама

Если `humanize.php` пуст — новая сессия должна восстановить из бэкапа `core/humanize.php.bak-*` или переписать с нуля по правилам из CLAUDE.md.

## Как использовать в inbox_actions.php

```php
require_once BASE_PATH.'/core/chat_brain.php';

foreach ($inboxRows as $row) {
    // Пропускаем автоответчики, петли, отписки
    if ($row['is_autoresponder']) continue;
    if (in_array($row['from_email'], ['noreply@', 'postmaster@', 'mailer-daemon@'], true)) continue;
    if (str_ends_with($row['from_email'], '@муз-мир.рф')) continue;
    if ($row['kind'] !== 'question') continue;   // партнёрство/ведомства — отдельная логика

    // Дедуп: не отвечать на этот email чаще 1 раза в 30 мин
    $lastReply = one("SELECT reply_sent_at FROM inbox_messages
                       WHERE from_email=? AND reply_sent_at IS NOT NULL
                       ORDER BY reply_sent_at DESC LIMIT 1", [$row['from_email']]);
    if ($lastReply && strtotime($lastReply['reply_sent_at']) > time() - 1800) {
        update inbox_messages SET handled_by='dedup' WHERE id=$row['id'];
        continue;
    }

    // Формируем sessionKey из email + треда (чтобы бот помнил предыдущие сообщения)
    $sessionKey = 'inbox:' . md5($row['from_email'] . '|' . $row['thread_key']);

    // Контекст: если это ответ на письмо — добавить в промпт информацию про исходное
    $context = "Получено письмо на ящик {$row['mailbox']}@муз-мир.рф от {$row['from_email']}.\n";
    $context .= "Тема: {$row['subject']}\n";
    $context .= "Тело:\n{$row['body_text']}\n";

    // Специальный контекст под ящик
    if ($row['mailbox'] === 'nagradi') {
        // Найти заявки этого email
        $apps = all("SELECT id, work_title, competition_id, result, created_at FROM applications WHERE LOWER(email)=? ORDER BY id DESC LIMIT 5", [strtolower($row['from_email'])]);
        if ($apps) {
            $context .= "\nЗаявки этого пользователя:\n";
            foreach ($apps as $a) $context .= "- #{$a['id']} \"{$a['work_title']}\" ({$a['result']})\n";
        }
    }

    // Спрашиваем мозг
    $reply = null;
    foreach (chat_gemini_keys() as $k) {
        if (chat_gemini_is_exhausted($k)) continue;
        $reply = chat_gemini_reply($k, $sessionKey, $context);
        if ($reply) break;
    }

    if (!$reply) {
        // Все ключи исчерпаны — оставляем письмо на потом
        continue;
    }

    // Гуманизация (если функция есть)
    if (function_exists('humanize_clean')) $reply = humanize_clean($reply);

    // Обёртка в HTML с брендом
    $html = mm_email_layout($reply);

    // Отправка ответом (с In-Reply-To для правильного threading в почтовике адресата)
    $ok = mail_send($row['from_email'], 'Re: ' . $row['subject'], $html, [
        'account' => mail_account_by_name($row['mailbox'] === 'novosti' ? 'news2' : $row['mailbox']),
        'in_reply_to' => $row['message_id'],
        'references' => $row['message_id'],
    ]);

    if ($ok) {
        q("UPDATE inbox_messages SET handled_by='bot', reply_text=?, reply_sent_at=datetime('now') WHERE id=?", [$reply, $row['id']]);
    }
}
```

## Специальный контекст по ящикам (важно)

### news@ — общие вопросы участников
Контекст: список открытых конкурсов, дедлайны, правила участия, ЛК.
Промпт: «Ты — оператор поддержки. Отвечай коротко, дружелюбно, всегда по делу. Если не знаешь — предлагай форму связи (kc@)».

### novosti@ — вопросы учреждений (не согласие/отказ)
Уже отфильтровано классификатором. Сюда попадают только уточнения («Что вы за организация», «А у вас есть госконтракт», «Пришлите ещё раз положения»).
Промпт: «Ты — оператор партнёрского отдела. Отвечай формально, кратко. Приложи ссылку на положения и обращение. Если сложный вопрос — переадресуй kc@».

### kc@ — вопросы ведомств (не одобрение/отказ)
Официальные вопросы («уточните регистрационный номер», «пришлите копию лицензии»).
Промпт: «Ты — секретарь оргкомитета. Отвечай подчёркнуто официально. Приводи регистрационные данные центра. Если запрашивают документы, которых у нас нет — пиши «переадресую руководству, ответ в течение 3 рабочих дней» и ставь флаг «нужен человек»».

### nagradi.on@ — вопросы про награды
«Где мой диплом», «когда придёт», «неправильные данные в дипломе».
Промпт: «Ты — оператор наградного отдела. Ищи заявку по email отправителя, отвечай по факту (когда должно быть готово, где скачать). Если диплом с ошибкой — извинись, ставь флаг «нужен человек» для перевыпуска».

Контекст обязателен: список заявок этого email из `applications`.

## Petля (петлевая защита)

Три уровня:
1. **Не отвечать на наши ящики** — если from_email в списке `[news@, novosti@, kc@, nagradi@]`
2. **Не отвечать по петле References** — если References содержит наш Message-ID (мы уже отвечали в этой цепочке за последние 24ч)
3. **Rate limit per-email**: 1 ответ бота на этот адрес в 30 минут

## Логирование в inbox_messages

Каждый ответ бота:
- `handled_by = 'bot'`
- `reply_text = <текст>`
- `reply_sent_at = now()`

Для админки: показываем thread'ы где `handled_by IN ('bot', 'auto_accept', 'auto_thanks', 'human')`. Автоответчики и dedup — скрыть.

## Формат ответа бота

Не одна строка — короткое письмо на 5-10 строк:
```
Здравствуйте!

<Ответ по существу вопроса, 2-3 предложения>

<Опционально: ссылка, инструкция>

С уважением,
Оргкомитет Культурного центра «Музыкальный Мир»
+7 (999) 504-88-99, https://муз-мир.рф
```

Оборачивание в `mm_email_layout()` даст бренд-хедер + футер с отпиской. НО отписку показывать не надо в личных ответах — только в массовых. Использовать `mm_email_layout($inner, ['no_unsub' => true])` или писать `$inner` без layout.

## Метрики для дашборда

Добавить в виджет:
- «Ответил бот сегодня»: `COUNT WHERE handled_by='bot' AND reply_sent_at >= today()`
- «Ждут ручного ответа»: `COUNT WHERE handled_by='human_needed'`
- «Не удалось ответить (ключи исчерпаны)»: `COUNT WHERE handled_by='' AND kind='question' AND received_at < now-1h`

## Что делать НЕЛЬЗЯ

- **Не отвечать на автоответчики** (бесконечная петля)
- **Не отвечать на bounces** (сам bounce уже обрабатывает `process_bounces.php`)
- **Не обсуждать в ответах** цены выше 10 000₽ (регистрация как ИП, налоги — только человек)
- **Не давать обещания сроков** типа «отвечу через час» — только «в рабочее время»
- **Не признаваться что бот** (правило из CLAUDE.md: на прямой вопрос «ты бот?» → «на связи, что по задаче?»)
