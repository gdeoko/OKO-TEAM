# TD-ART — редиректы td-art.ru → design.td-art.ru

**Клиент:** Антон, td-art.ru («Технологии дизайна»).
**Задача:** проставить 301-редиректы со старого сайта на новый `design.td-art.ru` по таблице (106 строк).
**Ветка:** `claude/td-art-redirects-p36xu6`.
**Папка задачи:** `jobs/td-art/`.
**Дата создания:** 2026-08-05.

---

## Файлы в папке

| Файл | Что | Кому |
|---|---|---|
| `redirects.csv` | **Исходник Антона** (106 строк, `source_url,target_url,301`). Не менять. | reference |
| `redirection_plugin.csv` | Готово к импорту в плагин **Redirection** (`source_url,target_url,regex,http_code`). 104 точных path + 1 regex catch-all. | нам/Антону |
| `redirects.json` | Родной формат экспорта плагина Redirection (v5). Для импорта через wp-admin или WP-CLI. | нам |
| `redirects.htaccess` | Apache mod_rewrite fallback. Полный набор + canonical (www→non-www, http→https). | на случай если WP-плагин не подойдёт |
| `gen.py` | Генератор трёх выше из `redirects.csv`. Перегенерить: `python3 gen.py`. | нам |

**Как трансформировался исходник:**
- 106 строк Антона → 104 точных path + 1 regex + 1 canonical www (в .htaccess). Дубль пути `/` (строки 7 + 24) — оставили первый.
- Источники приведены к path (`/design-project/dom/`), т.к. плагин Redirection на td-art.ru работает по path.
- Redirect `www.td-art.ru → …` и `http://td-art.ru → …` — на уровне .htaccess, не через плагин.
- Regex-строка `/(.*) → /folio` идёт **последней** (важно для порядка обработки).

---

## Доступы (от Антона в чате 2026-08-05)

- WP-admin: `https://td-art.ru/wp-admin/`
- login: `admin`
- password: `8B9#!Q3ScE$*S1880P!An#TM`
- Исходная таблица: https://docs.google.com/spreadsheets/d/1lfkydYnW9-2o7-gwu594qT1CjqUR4mb5axtlDF2Rb4c/edit?usp=drivesdk

> **⚠️ Пароль WP не подошёл** при попытке `curl` POST на `wp-login.php` (WP отвечает: «Введённый вами пароль пользователя admin неверен»). Пароль зашёл на wire корректно (24 символа, спецсимволы URL-encoded). Возможные причины: (а) пароль от Beget-панели / FTP, а не от WP; (б) активен Wordfence/iThemes с ограничением по IP; (в) опечатка в присланном пароле. Нужно уточнить у Антона. Если Даниэль зайдёт в админку сам вручную — импорт занимает 30 секунд (шаги ниже).

---

## Разведка целевого сайта td-art.ru (сделано 2026-08-05)

- Хостинг: **Beget** (nginx-reuseport, требуется JS-cookie `beget=begetok` перед любым HTTP-запросом — важно для тулинга).
- WordPress, юзер `admin` (ID=1) существует (проверено через `wp-json/wp/v2/users`).
- **Плагин Redirection НЕ установлен** (нет namespace `redirection/v1` в REST).
- Активные плагины (по REST namespaces): AIOSEO, Custom Permalinks, MonsterInsights, WP-Smush, WPMU DEV Sync, OptinMonster, Regenerate Thumbnails, wp-abilities.

> AIOSEO в Pro-версии имеет собственный модуль Redirects — можно использовать вместо установки Redirection. Формат импорта у них похожий, но не идентичный: `source_url` + `target_url` + `type=301` + `regex=false/true`. Наш `redirection_plugin.csv` подойдёт и туда с минимальной адаптацией.

---

## План работ (пошагово, для отдельной сессии)

### Правило 6h (напоминание)
Работа НЕ начинается без предоплаты. Инвойс — Lava, 50% предоплаты, в чат «Редиректы» через `acc2`.
Пока Lava-ссылка/peer чата не получены — файлы генерим и держим у себя, руками ничего в чужой WP не пушим.

### После оплаты:

**1. Пилот 5 URL** (согласовано Антоном: «Массовый импорт — только после моего ОК на пилот»).
   1. Зайти в `https://td-art.ru/wp-admin/` (auth: `admin` / пароль Антона).
   2. Plugins → Add New → искать «Redirection» (John Godley) → Install → Activate.
   3. Tools → Redirection → пройти wizard (снять галку «Monitor changes to WordPress permalinks» — не нужно; галка «Keep a log of all redirects» — по желанию, полезно для отладки).
   4. **Пилот:** добавить 5 первых редиректов из `redirection_plugin.csv` **вручную** (Add new):
      - `/design-project/dom/` → `https://design.td-art.ru/folio` (301)
      - `/design-project/kvartira/` → `https://design.td-art.ru/folio` (301)
      - `/design-project/avtorskiy-nadzor/` → `https://design.td-art.ru/complex` (301)
      - `/contacts/` → `https://design.td-art.ru/#contacts` (301)
      - `/portfolio/arbat/` → `https://design.td-art.ru/arbat` (301)
   5. Проверить curl'ом (у нас Beget-cookie нужен):
      ```bash
      for u in /design-project/dom/ /design-project/kvartira/ /design-project/avtorskiy-nadzor/ /contacts/ /portfolio/arbat/; do
        printf "%-40s → " "$u"
        curl -sSI -b "beget=begetok" "https://td-art.ru$u" | awk 'tolower($1)=="location:"{print $2}' | tr -d '\r'
      done
      ```
      Ожидаем 5 строк с целевыми URL из таблицы.
   6. Написать Антону: «Пилот 5 URL готов, вот curl-выхлоп — [пример]. Ждём ОК на массовый».

**2. Массовый импорт** (после ОК от Антона).
   - Tools → Redirection → **Import/Export** → **Import** → загрузить `redirection_plugin.csv`.
   - Группа: default («Redirections»).
   - Плагин при импорте автоматически распарсит колонку `regex` (0/1) и `http_code`.
   - **Убедиться, что regex-строка `/(.*) → /folio` — В САМОМ КОНЦЕ** (иначе поглотит точные редиректы). Если плагин отсортирует по алфавиту — вручную перетащить `/(.*)` вниз (drag в UI) или отредактировать `position` через WP-CLI.

**3. Верификация массового импорта.**
   ```bash
   # 10 случайных URL из таблицы + regex-проверка на несуществующем пути
   for u in $(shuf -n 10 <(cut -d, -f1 redirection_plugin.csv | tail -n +2 | grep -v '^/(.*)$')) /random-nonexistent-page/; do
     code=$(curl -sSI -b "beget=begetok" "https://td-art.ru$u" | awk 'NR==1{print $2}' | tr -d '\r')
     loc=$(curl -sSI -b "beget=begetok" "https://td-art.ru$u" | awk 'tolower($1)=="location:"{print $2}' | tr -d '\r')
     printf "%s %-50s → %s\n" "$code" "$u" "$loc"
   done
   ```
   Все не-regex — 301 на конкретный целевой URL. `/random-nonexistent-page/` — 301 на `https://design.td-art.ru/folio`.

**4. Canonical (www + http) — на уровне .htaccess.**
   Через WP-admin: File Manager → `.htaccess` в корне → добавить в самое начало (перед `# BEGIN WordPress`):
   ```apache
   <IfModule mod_rewrite.c>
   RewriteEngine On
   RewriteCond %{HTTP_HOST} ^www\.td-art\.ru$ [NC]
   RewriteRule ^(.*)$ https://td-art.ru/$1 [R=301,L]
   RewriteCond %{HTTPS} off
   RewriteRule ^(.*)$ https://td-art.ru/$1 [R=301,L]
   </IfModule>
   ```
   Проверить: `curl -sI -b beget=begetok http://td-art.ru/ → 301 → https://td-art.ru/ → 301 → https://design.td-art.ru/`
   (двойной redirect, но это норма; поисковики склеят).

**5. Отчёт Антону.**
   - Скриншот списка редиректов из wp-admin.
   - Полный curl-лог 106 URL (можно скриптом из шага 3).
   - Финальный счёт (вторые 50%) через Lava.

---

## Технические заметки

### Beget JS-cookie
Любой curl-запрос к `td-art.ru` без cookie `beget=begetok` возвращает JS-заглушку 274 байта.
Все проверки делать с `-b "beget=begetok"` (для .htaccess файла ничего не значит — только для нашего тулинга).

### `Custom Permalinks` конфликт
На сайте активен плагин `custom-permalinks` — он даёт возможность задавать произвольные URL постам/страницам. **Не мешает** плагину Redirection: Redirection работает раньше в цепочке WordPress hooks (`template_redirect` с приоритетом 1000). Но если Антон **удалит страницу** до импорта, Custom Permalinks может не среагировать — а Redirection точно перехватит.

### AIOSEO Redirects (альтернативный путь)
Если AIOSEO у Антона Pro и Redirection ставить не хочется — импорт CSV делается через AIOSEO → Redirects → Import. Формат:
- `source_url, target_url, type` (type = 301 / 302 / regex).
- Regex-строку `/(.*)` перед импортом заменить: `type=regex`, `source=/(.*)$`.

### Регенерация файлов
Правки в `redirects.csv` (например, ошибка в URL) — перегенерить:
```bash
cd jobs/td-art && python3 gen.py
```

### Проверка Google Sheet vs CSV
Google Sheet (`docs.google.com/spreadsheets/d/1lfky…`) требует авторизации — публично не скачивается. **Источник правды в этой задаче — `redirects.csv` из чата Антона** (2026-08-05). Если Антон изменит Sheet — попросить его перезалить CSV или выдать доступ к Sheet на `okoteam.top@gmail.com`.

---

## Паттерн `in_memory` сессии для acc2 (Lava-инвойс + чат «Редиректы»)

TODO Даниэль: когда пришлёшь Lava-ссылку и peer/chat_id чата «Редиректы» через `acc2` — впиши сюда команду `vexec`, я перезапушу.

Заготовка (когда данные будут):
```bash
# на VPS
vexec 'python3 -c "
from oko_agents.messengers.tg import send_photo
send_photo(peer=<PEER_ID>, acc=\"acc2\",
  photo_url=\"<QR_LAVA>\",
  caption=\"Антон, привет! Инвойс на 50% предоплаты по редиректам td-art.ru → design.td-art.ru: <LAVA_URL>. Работу стартуем сразу после оплаты, оценочный срок — X часов с момента импорта пилота. По регламенту без предоплаты не выхожу в WP.\")
"'
```

---

## Первый prompt для отдельной сессии

> Прочти `jobs/td-art/BRIEF.md` и выполни всю задачу по редиректам td-art.ru → design.td-art.ru пошагово. Начни с Lava-инвойса на 50% предоплаты в чат «Редиректы» через acc2 (шаблон в конце brief), работу в WP НЕ начинай до подтверждения оплаты (правило 6h). Все output-файлы уже сгенерированы — только импорт и верификация.

Название чата: **«td-art редиректы»** или **«Редиректы td-art»**.
