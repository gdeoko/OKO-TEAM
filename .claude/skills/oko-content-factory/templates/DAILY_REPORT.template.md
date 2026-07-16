# DAILY_REPORT — шаблон утреннего отчёта в бота (10:00 МСК)

Формат Telegram-сообщения (HTML parse_mode).

```
📊 <b>ОТЧЁТ ЗА {yesterday_date}</b> — {brand_name}

🎬 <b>Опубликовано:</b> {published_count} ролик{суффикс}
👁️ <b>Просмотров всего:</b> {total_views:,} ({delta_pct:+d}% к среднему)
❤️ <b>Лайки:</b> {likes:,} | 💬 <b>Комменты:</b> {comments:,} | 🔖 <b>Сохранения:</b> {saves:,} | 📤 <b>Репосты:</b> {shares:,}
👥 <b>Прирост подписчиков:</b> +{followers_delta}

🏆 <b>Лидер дня:</b>
   «{top_video_title}»
   {top_video_views:,} просмотров ({top_platform})

📉 <b>Слабее среднего:</b>
   «{weak_video_title}» — {weak_video_views:,} просмотров
   Причина: {weak_reason}

{hit_section}

📈 <b>Просмотры за неделю:</b>
{sparkline_ascii or ссылка на график}

🌐 <b>Сайт:</b>
   {site_visits} переходов | {form_submits} заявок | {ctr}% CTR

📅 <b>Завтра публикуем:</b> {tomorrow_count} ролик{суффикс}
Темы:
{tomorrow_topics_list}

{alerts_section}
```

## Секции-опции

### `{hit_section}` — если есть залёт
```
🔥 <b>ЗАЛЕТЕЛО:</b>
   Ролик #{n} — {hit_views:,} за {hours}ч
   Формат: <code>{format_name}</code>
   → Добавлен в очередь усиления, {planned_count} продолжений запланировано
```

Если нет — секцию не показываем.

### `{alerts_section}`
- Если всё ок: `✅ Уведомлений о блокировках нет`
- Если есть блокировка: см. SKILL §9.3

## Правила краткости
- Итого ≤ 15 строк.
- Числа с разделителями тысяч (пробел или запятая).
- Дельты процентов со знаком.
- Никаких длинных абзацев, только буллеты.
- Никаких длинных тире.
