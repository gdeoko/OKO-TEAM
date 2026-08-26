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
