# Канал генерации в кабинете ChatGPT (Кластер и остальные проекты)

**26.08.2026: мобильный прокси провайдера лёг.** `aus.mobileproxy.space:2413` и
`fproxy.site:13047` не отвечают (код 000 на любой запрос), перезагрузка
оборудования через их API проходит, но канал не поднимается. Прямой выход
Cloudflare не пускает: «Unable to load site».

**Рабочий обход:** на сервере крутится служба `oko-vpn-usa.service`, она даёт
socks5 на `127.0.0.1:10840` (есть ещё `10811`). Через него кабинет открывается
и аккаунт остаётся залогиненным.

Браузер Кластера:

    DISPLAY=:99 google-chrome \
      --user-data-dir=/opt/oko-poster/profiles/klaster \
      --proxy-server=socks5://127.0.0.1:10840 \
      --remote-debugging-port=9335 \
      --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader \
      --no-first-run --no-default-browser-check --disable-session-crashed-bubble \
      about:blank

Очередь: `CDP_URL=http://127.0.0.1:9335 SPISOK=<файл> LOGFILE=<лог> python3 ochered_m1.py`

**Грабли:**
- копия профиля восстанавливает вкладки прошлого сеанса и копит их до отказа;
  в `Default/Preferences` выставлено `session.restore_on_startup = 5`;
- закрывать вкладки через CDP до последней нельзя, Chrome закрывается следом;
- аккаунт кабинета делят несколько задач, поэтому драйвер ищет собственное
  сообщение по хвосту задачи и берёт снимки только после него;
- Enter отправляет не всегда, драйвер добивает кнопкой отправки.

## Порт браузера задаётся очереди явно

`gpt_ref.mjs` без переменной `CDP_URL` идёт на порт 9333, а это чужой браузер
другого проекта: страница там своя, поля вложения нет, и очередь падает с
`waiting for locator('input[type="file"]')` на каждой попытке. Запускать только так:

```
screen -dmS n234 bash -lc "cd /opt/oko-poster && CDP_URL=http://127.0.0.1:9335 \
  SPISOK=promts_nedeli_234.json LOGFILE=/tmp/ochered_n234.log VYHOD=klaster_n234 \
  python3 ochered_m1.py"
```

## Сторож браузера

`/opt/oko-poster/storozh_klaster.sh` в screen `storozh3` проверяет порт 9335 раз в
минуту и поднимает Chrome заново, если тот лёг. Лог `/tmp/storozh_klaster.log`.
После подъёма вкладка ChatGPT остаётся на старом чате: драйвер открывает свою,
поэтому вмешиваться не нужно.

## Канал Runway: мобильный прокси провайдера лёг

`aus.mobileproxy.space:2413` отдаёт код 000, и браузер Runway на профиле `rwreal`
получал `ERR_EMPTY_RESPONSE`. Рабочий канал тот же, что у генерации картинок:
socks5 `127.0.0.1:10840` от службы `oko-vpn-usa`, Runway по нему отвечает 200 и
сессия в профиле сохраняется. Поднимать так:

```
screen -dmS rwbr bash -lc "DISPLAY=:95 google-chrome \
  --proxy-server=socks5://127.0.0.1:10840 \
  --user-data-dir=/opt/oko-poster/browser/rwreal --remote-debugging-port=9254 \
  --no-first-run --no-default-browser-check --disable-gpu --start-maximized \
  --lang=en-US https://app.runwayml.com/"
```

Грабли:
- `setsid ... &` через мост не выживает: мост гасит фоновые процессы, когда
  команда вернулась. Только `screen -dmS`.
- `exec google-chrome ... > лог 2>&1` внутри screen молча падает. Работает
  простая форма без `exec` и без перенаправления, как у браузера картинок.
- `pkill -f "user-data-dir=..."` убивает сам мост: шаблон попадает в его
  собственную командную строку. Гасить по PID через `pgrep` с отсевом `$$`.
- Кириллица в именах переменных окружения bash запрещена. Переменная `ПРОЕКТ`,
  которую ждёт `runway_web.mjs`, ставится только через `env 'ПРОЕКТ=klaster'`.

## Runway сменил интерфейс: Gen-4.5 не выбирается

С 27.08.2026 кабинет открывается на чат-домашней странице, модель по умолчанию
Seedance 2.5, и драйвер `runway_web.mjs` сообщает «модель Gen-4.5 выбрать не
вышло» и прекращает работу. Рабочий путь до починки драйвера: запускать с
моделью `seedance`, она берёт опорный кадр тем же полем.
