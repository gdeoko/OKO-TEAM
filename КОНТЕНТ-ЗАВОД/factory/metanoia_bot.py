#!/usr/bin/env python3
# МЕТАНОЙА · analytics bot — long-polling, кнопочное меню снизу, живой статус.
# Запуск на VPS: CLIENT_EKAT_ANALYTICS_BOT_TOKEN=... setsid nohup python3 metanoia_bot.py &
# Отдельные cfg-файлы (metanoia_*) — не конфликтует с tappio_bot.py на том же VPS.
import os, json, time, subprocess, datetime

TOK = os.environ['CLIENT_EKAT_ANALYTICS_BOT_TOKEN']
API = f'https://api.telegram.org/bot{TOK}'
CFG = '/opt/oko-poster/cfg'
CHAT_FILE  = f'{CFG}/metanoia_chat_id.txt'         # последний chat
RECIP_FILE = f'{CFG}/metanoia_recipients.txt'      # все, кто нажал /start (рассылка отчёта)
REPORT = f'{CFG}/metanoia_report_latest.txt'       # пишет ежедневная рутина 10:00 МСК
WEEK   = f'{CFG}/metanoia_week.txt'
WINNERS= f'{CFG}/metanoia_winners.txt'
SITE   = f'{CFG}/metanoia_site.txt'
STATE  = f'{CFG}/metanoia_state.json'              # {reels_total, views_total, followers_total, updated}
LAUNCH = datetime.date(2026, 9, 1)                 # запуск школы
GOAL_FOLLOWERS = 20_000                            # ориентир по аудитории к запуску

def api(method, **params):
    args = ['curl', '-s', '-m', '25', f'{API}/{method}']
    for k, v in params.items():
        args += ['--data-urlencode', f'{k}={v}']
    try: return json.loads(subprocess.run(args, capture_output=True, text=True).stdout or '{}')
    except: return {}

def state():
    try: return json.load(open(STATE))
    except: return {}

def readf(p, default=''):
    try: return open(p, encoding='utf-8').read()
    except: return default

def num(n):
    try: n=float(n)
    except: return str(n)
    for u,d in [('M',1e6),('K',1e3)]:
        if n>=d: return f"{n/d:.1f}{u}".replace('.0','')
    return str(int(n))

def bar(cur, goal, width=10):
    f = 0 if not goal else min(width, int(width * cur / goal))
    return '▓'*f + '░'*(width-f)

def kb():
    return json.dumps({
        "keyboard": [
            [{"text":"📊 За вчера"}, {"text":"📅 За неделю"}],
            [{"text":"🎯 Прогресс"}, {"text":"🏆 Что зашло"}],
            [{"text":"🔗 Аккаунты"}, {"text":"🌐 Сайт"}],
            [{"text":"⚙️ Статус"}, {"text":"ℹ️ Помощь"}],
        ], "resize_keyboard": True, "is_persistent": True
    }, ensure_ascii=False)

def days_to_launch():
    try: return (LAUNCH - datetime.date.today()).days
    except: return None

def txt_start():
    return ("<b>🕊 МЕТАНОЙА · Аналитика</b>\n"
            "Веду соцсети школы: Instagram · YouTube · TikTok. Каждый день — один тёплый ролик, "
            "разбор аналитики и рост аудитории к <b>запуску школы в сентябре</b>.\n\n"
            "Отчёт приходит каждый день в <b>10:00 МСК</b>. Кнопки снизу — быстрый доступ.")

def txt_report():
    return readf(REPORT, "<b>📊 Аналитика за вчера</b>\n\nПервый отчёт — завтра в 10:00 МСК. "
                         "Постинг стартует по графику: 1 ролик в день.")

def txt_week():
    return readf(WEEK, "<b>📅 Сводка за неделю</b>\n\nСобирается по мере публикаций. "
                       "Первая полная сводка — после недели постинга.")

def txt_progress():
    s = state()
    rv, rf, rr = s.get('views_total',0), s.get('followers_total',0), s.get('reels_total',0)
    d = days_to_launch()
    launch = f"\n\n⏳ До запуска школы: <b>{d} дн.</b>" if d is not None and d>0 else ""
    return ("<b>🎯 Прогресс</b>\n\n"
            f"👥 Подписчики (все сети)\n{bar(rf,GOAL_FOLLOWERS)}  {num(rf)} / {num(GOAL_FOLLOWERS)}\n\n"
            f"👁 Просмотры суммарно: <b>{num(rv)}</b>\n"
            f"🎬 Роликов выпущено: <b>{rr}</b>  (темп: 1/день)"
            f"{launch}\n\n"
            f"<i>Обновлено: {s.get('updated','—')}</i>")

def txt_accounts():
    ig = 'https://www.instagram.com/mama_s_bogom/'
    yt = 'https://www.youtube.com/channel/UCHQL8pDtCadNY-m1b8H_AaQ'
    tt = 'https://www.tiktok.com/@mama.s.bogom'
    return ("<b>🔗 Аккаунты школы</b>\n\n"
            f"📸 Instagram: <a href=\"{ig}\">@mama_s_bogom</a> ✅\n"
            f"▶️ YouTube: <a href=\"{yt}\">Екатерина</a> ✅\n"
            f"🎵 TikTok: <a href=\"{tt}\">@mama.s.bogom</a> ✅\n\n"
            "<i>Нажми на ссылку — откроется профиль.</i>")

def txt_winners():
    return readf(WINNERS, "<b>🏆 Что зашло</b>\n\nПока копим данные. Как ролик выстрелит "
                          "(просмотров выше среднего) — покажу формат и буду его усиливать.")

def txt_site():
    return readf(SITE, "<b>🌐 Сайт</b>\n\nАналитика сайта (визиты, переходы из профиля, клики, заявки) "
                       "появится, как подключим источник (Я.Метрика / Google Analytics) на metanoia-180.ru. "
                       "Пришли доступ — включу в ежедневный отчёт.")

def txt_status():
    return ("<b>⚙️ Статус системы</b>\n\n"
            "TikTok — Hooppy API ✅\nInstagram — стелс-сессия ✅\nYouTube — Data API ✅\n"
            "Ежедневная рутина 10:00 МСК — активна ✅\nСборка роликов — активна ✅\n\n"
            "Ограничения аккаунтов приходят сюда автоматически.")

def txt_help():
    return ("<b>ℹ️ Помощь</b>\n\n"
            "📊 За вчера — вчерашняя аналитика по всем соцсетям\n"
            "📅 За неделю — недельная сводка\n"
            "🎯 Прогресс — подписчики, просмотры, ролики, дни до запуска\n"
            "🏆 Что зашло — победившие форматы\n"
            "🔗 Аккаунты — профили школы\n"
            "🌐 Сайт — аналитика лендинга\n"
            "⚙️ Статус — состояние системы\n\n"
            "<i>Отчёт автоматически — каждый день в 10:00 МСК.</i>")

ROUTES = {
    "📊 За вчера": txt_report, "/today": txt_report,
    "📅 За неделю": txt_week, "/week": txt_week,
    "🎯 Прогресс": txt_progress, "/goals": txt_progress, "/stats": txt_progress,
    "🏆 Что зашло": txt_winners, "/winners": txt_winners,
    "🔗 Аккаунты": txt_accounts, "/accounts": txt_accounts,
    "🌐 Сайт": txt_site, "/site": txt_site,
    "⚙️ Статус": txt_status, "/status": txt_status,
    "ℹ️ Помощь": txt_help, "/help": txt_help,
}

def setup():
    api('setMyDescription', description=("МЕТАНОЙА · analytics — ежедневная аналитика соцсетей школы "
        "(Instagram/YouTube/TikTok) и сайта, прогресс аудитории к запуску. Отчёт каждый день в 10:00 МСК."))
    api('setMyShortDescription', short_description="Аналитика соцсетей школы Метанойя · отчёт 10:00 МСК")
    api('setMyCommands', commands=json.dumps([
        {"command":"start","description":"Меню аналитики"},
        {"command":"today","description":"Аналитика за вчера"},
        {"command":"week","description":"Сводка за неделю"},
        {"command":"stats","description":"Прогресс"},
        {"command":"accounts","description":"Аккаунты"},
        {"command":"status","description":"Статус системы"},
        {"command":"help","description":"Как это работает"},
    ], ensure_ascii=False))

def add_recipient(chat):
    try:
        ids = set(readf(RECIP_FILE).split())
        if str(chat) not in ids:
            ids.add(str(chat)); open(RECIP_FILE,'w').write("\n".join(sorted(ids)))
    except: pass

def send(chat, text):
    api('sendMessage', chat_id=chat, text=text, parse_mode='HTML',
        disable_web_page_preview='true', reply_markup=kb())

def main():
    setup()
    offset = 0
    while True:
        upd = api('getUpdates', offset=offset, timeout=50)
        for u in upd.get('result', []):
            offset = u['update_id'] + 1
            m = u.get('message') or u.get('edited_message')
            if not m: continue
            chat = m['chat']['id']
            open(CHAT_FILE,'w').write(str(chat)); add_recipient(chat)
            t = (m.get('text') or '').strip()
            if t in ('/start','start','/menu'):
                send(chat, txt_start()); continue
            fn = ROUTES.get(t)
            send(chat, fn() if fn else txt_help())
        time.sleep(1)

if __name__ == '__main__':
    while True:
        try: main()
        except Exception:
            time.sleep(5)
