# PROJECT CONFIG — МЕТАНОЙА (для social-autopilot)

> Конфиг проекта для скилла `social-autopilot`. Секреты — в `secrets.env`
> (`CLIENT_EKAT_*`, `HOOPPY_*`, `CLIENT_YT_*`). Тут — только неизменные параметры операции.

```
project: МЕТАНОЙА — христианская онлайн-школа для детей 5–14 (эксперт Екатерина Павленко)
niche: духовное/нравственное воспитание детей, семья, вера × наука о мозге/памяти
brand_voice: тёплый, спокойный, поддерживающий, «на равных» с родителем. Без пафоса,
             запугивания, вины, политики. Голос от школы/команды (не раскрывать кухню).
app_demo: https://nimble-bean-709.higgsfield.app   # можно снимать экраны в демо-ролики

accounts:
  instagram: mama_s_bogom — стелс-сессия на VPS (/opt/oko-poster/cfg/ig_ekat_state.json,
             профиль ig_ekat_profile). Постинг Reels + активность + Insights.
             Логин/пароль: CLIENT_EKAT_IG / CLIENT_EKAT_PASSWORD. Коды входа → почта Екатерины.
  youtube:   канал «Екатерина» CLIENT_EKAT_YT_CHANNEL_ID (UCHQL8pDtCadNY-m1b8H_AaQ),
             Data API: общий app CLIENT_YT_CLIENT_ID/_SECRET + CLIENT_EKAT_YT_REFRESH_TOKEN. Shorts.
  tiktok:    @mama.s.bogom через Hooppy — HOOPPY_TT_PAGE_EKAT (2352065), source_id 14,
             общий HOOPPY_API_TOKEN. Постинг: hooppy_post_api.py 2352065 <mp4> "<caption>".

brand_profile: .claude/skills/reels-machine/reference/BRAND_PROFILE.md (Метанойя)
logo: brand/metanoia-logo.png (μ + золотые крылья, navy/gold, кремовый фон)

goal: набор аудитории к ЗАПУСКУ ШКОЛЫ В СЕНТЯБРЕ 2026. Всё продвижение ведёт в школу/
      приложение «Метанойя». Рост подписчиков, охвата и переходов в приложение.
cadence: РОВНО 1 ролик в день, ВСЕГДА (не больше), на протяжении года. Без наращивания,
      без цели «500 роликов». Одна сборка/день → кросс-пост IG Reels + YouTube Shorts +
      TikTok. Плюс сторис/посты/карусели по аналитике (на усмотрение).

report_bot: CLIENT_EKAT_ANALYTICS_BOT_TOKEN (@metanoiaorder_bot). Отчёт ежедневно 10:00 МСК
            (07:00 UTC). Админы/получатели: CLIENT_EKAT_ANALYTICS_ADMINS (Екатерина 765430195;
            владельца добавить после его /start). chat_id владельца — из getUpdates, в секрет.
bot_backend: factory/metanoia_bot.py задеплоен на VPS /opt/oko-poster/metanoia_bot.py
            (long-polling, reply-keyboard: За вчера/За неделю/Прогресс/Что зашло/Аккаунты/
            Сайт/Статус/Помощь), keepalive в cron каждую минуту. Ежедневная рутина ПИШЕТ в
            /opt/oko-poster/cfg/ (через VPS /exec): metanoia_report_latest.txt (за вчера),
            metanoia_week.txt, metanoia_winners.txt, metanoia_site.txt, metanoia_state.json
            ({reels_total,views_total,followers_total,updated}) — бот отдаёт их по кнопкам.
            Рассылка отчёта: всем chat_id из /opt/oko-poster/cfg/metanoia_recipients.txt
            (бот автособирает при /start). Тексты бота — HTML parse_mode.
site: metanoia-180.ru (по ТЗ) — аналитика визитов/переходов/кликов/заявок в тот же отчёт.
      Уточнить у владельца рабочий домен лендинга и метрику (Я.Метрика/GA) для доступа.

infra: VPS okoagents.okoteam.top через OKO_VPS_CTRL_URL/_TOKEN (POST /exec) —
       браузер-агент patchright: постинг IG, разведка конкурентов, скачивание роликов,
       транскрипт, аналитика через Instagram Insights / YouTube Studio.
       Бесплатная генерация: HF FLUX/Z-Image (картинки/обложки), Pexels/Pixabay (стоки),
       Freesound (звук), Sketchfab/HF (3D GLB). Higgsfield — точечно.
```

## Правила ниши (жёсткие, из мастер-брифа §14)
1. Голос от школы/команды. Не раскрывать инструменты сборки.
2. Тон всегда тёплый и спокойный. Без запугивания/вины/агрессии/политики.
3. Не задевать «своих» (воцерковлённых) в лоб.
4. Точность в вере: цитаты Писания сверять; спорное толкование — не давать без
   согласования с Екатериной (флажок в отчёте, если сценарий на грани).
5. Дети — бережно (страх/смерть/буллинг — аккуратно, с поддержкой, отсылка к родителям).
6. Единый визуал: navy/terra/gold, Playfair+Montserrat, метафора маяка/света.

## Микс рубрик (из 02-ПЛАН-90-ДНЕЙ.md — банк, чередовать)
Путь Екатерины · «Мама, а…?» · Миф недели · Герой веры (демо) · Как говорить о… ·
Бытовое богословие · Семейный ритуал · Внутри Метанойи · Отзывы семей (с нед. 8).
Форматы: говорящая голова · закадр+видеоряд · текст на экране · разбор/реакция · демо приложения.
