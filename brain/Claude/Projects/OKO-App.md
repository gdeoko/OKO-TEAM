# OKO App

#проект/око-апп #статус/в-работе

Ветка: `claude/new-session-w2ptqy`. Мастер-доки: `oko-app/docs/OKO_APP_CONTEXT.txt`, `oko-app/docs/OKO_APP_TZ.md`.
Прототип (витрина прогресса): https://true-journey-418.higgsfield.app (website_id 5426760c-49ec-46c4-b3ff-b22a6dd598a5).
Источник правды: `oko-app/prototype/index.html`, версия — чип «сборка vX.Y», экран PROGRESS обновлять при деплое.
Бренд: чёрный + лайм #9AFF00, Bebas Neue + Montserrat. Без эмодзи в UI, только SVG.
Инфра: Supabase tkjewndtlzhnmqwmrnil (28 таблиц, SQL через Management API+PAT, порт 5432 закрыт),
бот @okoappbot, S3 twcstorage (oko-media, oko-tmp), Gemini 3 ключа. Ключи — в env сессии, в git не класть.
Сервер: `oko-app/server` (Fastify+Supabase).
