# ВКонтакте — бот сообщества, посты и сторис

Сообщество: **211325055** (vk.com/music_world.online). Токены — только в
`config.local.php` на сервере (`MUZMIR_VK_TOKEN` — основной, права manage+messages+stories;
`MUZMIR_VK_GROUP_TOKEN` — запасной токен сообщества). В git токены НЕ хранятся.

## 1. Авто-ответы в сообщениях сообщества (Callback API)
Когда пользователь пишет в сообщество, ВК шлёт событие на вебхук, бот отвечает
тем же «мозгом», что и чат на сайте (Gemini → Claude → rule-based).

- Эндпоинт: `api/v1/webhook_vk.php` → URL `https://<домен>/api/v1/webhook_vk`.
- Общий «мозг»: `core/chat_brain.php` (`chat_brain_reply()`), знания — из БД
  (конкурсы, цены, награды) + `org_*` из config. Диалоги ВК пишутся в
  `chat_messages` c `session_key = vk_<peer_id>` (видны в админке, есть контекст).
- Быстрый `ok` (fastcgi_finish_request) + дедуп по `event_id` (таблица `vk_cb_events`).
- Уникальный `random_id` на каждый ответ (иначе ВК глушит повтор).

**Настройка (разово, идемпотентно):**
```
php scripts/vk_setup_callback.php
```
Скрипт сам: берёт код подтверждения, пишет `MUZMIR_VK_CONFIRM` и
`MUZMIR_VK_CALLBACK_SECRET` в `config.local.php`, регистрирует сервер и включает
событие `message_new`. Проверка вручную:
```
curl -s -X POST https://<домен>/api/v1/webhook_vk -d '{"type":"confirmation","group_id":211325055}'
# должно вернуть строку подтверждения
```
Статус сервера должен быть `ok` (в выводе скрипта или в настройках сообщества →
Работа с API → Callback API).

## 2. Посты на стену + дубль в сторис
Функции в `core/vk.php`:
- `vk_wall_post($text)` / `vk_wall_post_with_photo($text,$img)` — пост на стену.
- `vk_story_photo($img, $link='')` — история сообщества (картинка 1080×1920, 9:16;
  ссылка добавляется, только если у сообщества есть право на ссылки в историях).
- `vk_publish_post($text, $img, $alsoStory=true, $link='')` — пост на стену **и**
  дубль в сторис одной командой. Возвращает `['wall'=>…, 'story'=>…]`.

Пример (CLI на сервере):
```
php -r 'define("BASE_PATH",__DIR__); require "config.php"; require "core/db.php";
 require "core/helpers.php"; require "core/vk.php";
 print_r(vk_publish_post("Текст анонса «...»", "/путь/к/картинке.jpg", true, "https://<домен>/apply"));'
```

## 3. Микро-рассылка подписчикам (5000+ открытых диалогов)
Легальная рассылка тем, кто сам писал/разрешил сообщения (сейчас ~5238).
- Очередь: `vk_dm_enqueue_dialogs($text,$attachment,$kind,$ref)` (core/vk.php).
- Воркер: `cron/vk_dm_worker.php` (раз в минуту), темп `settings.vk_dm_per_run`
  (по умолчанию 20/запуск), выключатель `settings.vk_dm_enabled` (`0` = стоп).
- 5 тыс. уходят за ~4–5 часов. Ошибки приватности — skip, флуд-контроль — пауза.

## 4. Большая рассылка по всей базе (6.9 млн) — вне агента
Через сервис «Рассылки» (broadcast.vkforms.ru). Нужен ключ сервиса
(`MUZMIR_VK_BROADCAST_TOKEN`, создаётся в приложении сообщества: Управление
сервисом → Настройки → Создать ключ). Код готов: `vk_broadcast()` в core/vk.php.
Результаты длинных конкурсов в эту базу НЕ шлём — только в приложении + на почту
участникам конкретного конкурса.
