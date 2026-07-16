#!/usr/bin/env python3
# Tappio Analytics bot — long-polling, кнопочное меню снизу, живой статус.
# Запуск на VPS: TAPPIO_ANALYTICS_BOT_TOKEN=... HOOPPY_API_TOKEN=... setsid nohup python3 tappio_bot.py &
import os, json, time, subprocess, html

TOK = os.environ['TAPPIO_ANALYTICS_BOT_TOKEN']
HOOPPY = os.environ.get('HOOPPY_API_TOKEN', '')
API = f'https://api.telegram.org/bot{TOK}'
CFG = '/opt/oko-poster/cfg'
CHAT_FILE = f'{CFG}/bot_chat_id.txt'
REPORT = f'{CFG}/report_latest.txt'      # пишет ежедневная рутина
STATE  = f'{CFG}/bot_state.json'         # {reels_total, views_total, followers_total, updated}
GOAL_VIEWS, GOAL_FOLLOWERS, GOAL_REELS = 100_000_000, 20_000, 500

def api(method, **params):
    args = ['curl', '-s', '-m', '25', f'{API}/{method}']
    for k, v in params.items():
        args += ['--data-urlencode', f'{k}={v}']
    try: return json.loads(subprocess.run(args, capture_output=True, text=True).stdout or '{}')
    except: return {}

def hooppy(path):
    if not HOOPPY: return {}
    out = subprocess.run(['curl','-s','-m','20', f'https://api.hooppy.ru/api{path}',
                          '-H', f'Authorization: Bearer {HOOPPY}', '-H','Accept: application/json'],
                         capture_output=True, text=True).stdout
    try: return json.loads(out or '{}')
    except: return {}

def state():
    try: return json.load(open(STATE))
    except: return {}

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

def num(n):
    try: n=float(n)
    except: return str(n)
    for u,d in [('B',1e9),('M',1e6),('K',1e3)]:
        if n>=d: return f"{n/d:.1f}{u}".replace('.0','')
    return str(int(n))

def txt_start():
    return ("<b>TAPPIO · Автопилот соцсетей</b>\n"
            "Ежедневно веду Instagram · YouTube · TikTok: сборка роликов, постинг, "
            "аналитика и рост к цели <b>100M просмотров</b> и <b>20 000 подписчиков</b>.\n\n"
            "Отчёт приходит каждый день в <b>10:00 МСК</b>. Кнопки снизу — быстрый доступ.")

def txt_progress():
    s = state()
    rv, rf, rr = s.get('views_total',0), s.get('followers_total',0), s.get('reels_total',0)
    return ("<b>🎯 Прогресс к цели</b>\n\n"
            f"Просмотры\n{bar(rv,GOAL_VIEWS)}  {num(rv)} / {num(GOAL_VIEWS)}\n\n"
            f"Подписчики\n{bar(rf,GOAL_FOLLOWERS)}  {num(rf)} / {num(GOAL_FOLLOWERS)}\n\n"
            f"Ролики\n{bar(rr,GOAL_REELS)}  {rr} / {GOAL_REELS}\n\n"
            f"<i>Обновлено: {s.get('updated','—')}</i>")

def txt_accounts():
    return ("<b>🔗 Аккаунты Tappio</b>\n\n"
            "Instagram: <b>tappio.app.pro</b> — прямая сессия ✅\n"
            "YouTube: <b>TAPPIO</b> — Data API ✅\n"
            "TikTok: <b>@tappio.app</b> — через Hooppy ✅\n\n"
            "<i>Бот ведёт только проект Tappio.</i>")

def txt_report():
    try: return open(REPORT).read()[:3500]
    except: return "<b>📊 Аналитика за вчера</b>\n\nПервый отчёт — завтра в 10:00 МСК. Постинг стартует по графику (1/день → рост)."

def txt_week():
    return "<b>📅 Сводка за неделю</b>\n\nСобирается по мере накопления публикаций. Первая полная сводка — после недели постинга."

def txt_site():
    return ("<b>🌐 Сайт</b>\n\nАналитика сайта (визиты, клики, заявки) появится, как только подключим источник "
            "(Google Analytics / Метрика). Пришли доступ — включу в ежедневный отчёт.")

def txt_winners():
    try:
        w = open(f'{CFG}/winners.txt').read()[:2500]; return "<b>🏆 Что зашло</b>\n\n"+w
    except: return "<b>🏆 Что зашло</b>\n\nПока копим данные. Как только ролик выстрелит (просмотров выше среднего) — покажу формат и буду его усиливать."

def txt_status():
    return ("<b>⚙️ Статус системы</b>\n\n"
            "Постинг TikTok — API ✅\nInstagram — сессии ✅\nYouTube — API ✅\n"
            "Ежедневная рутина 10:00 МСК — активна ✅\nСборка роликов v6 — активна ✅\n\n"
            "Ограничения аккаунтов приходят сюда автоматически.")

def txt_help():
    return ("<b>ℹ️ Помощь</b>\n\n"
            "📊 За вчера — вчерашняя аналитика по всем соцсетям\n"
            "📅 За неделю — недельная сводка\n"
            "🎯 Прогресс — к 100M просмотров / 20k подписчиков / 500 роликов\n"
            "🏆 Что зашло — победившие форматы\n"
            "🔗 Аккаунты — подключённые соцсети\n"
            "🌐 Сайт — аналитика лендинга\n"
            "⚙️ Статус — состояние системы")

ROUTES = {
    "📊 За вчера": txt_report, "/today": txt_report,
    "📅 За неделю": txt_week, "/week": txt_week,
    "🎯 Прогресс": txt_progress, "/goals": txt_progress,
    "🏆 Что зашло": txt_winners, "/winners": txt_winners,
    "🔗 Аккаунты": txt_accounts, "/accounts": txt_accounts,
    "🌐 Сайт": txt_site, "/site": txt_site,
    "⚙️ Статус": txt_status, "/status": txt_status,
    "ℹ️ Помощь": txt_help, "/help": txt_help,
}

def setup():
    api('setMyDescription', description=("Автопилот соцсетей Tappio. Ежедневно в 10:00 МСК — аналитика по "
        "Instagram/YouTube/TikTok + сайт, прогресс к 100M просмотров и 20 000 подписчиков. Кнопки снизу — быстрый доступ."))
    api('setMyShortDescription', short_description="Аналитика и автопилот соцсетей Tappio · отчёт 10:00 МСК")
    api('setMyCommands', commands=json.dumps([
        {"command":"start","description":"Меню аналитики"},
        {"command":"today","description":"Аналитика за вчера"},
        {"command":"week","description":"Сводка за неделю"},
        {"command":"goals","description":"Прогресс к цели"},
        {"command":"accounts","description":"Аккаунты"},
        {"command":"status","description":"Статус системы"},
    ], ensure_ascii=False))

def send(chat, text):
    api('sendMessage', chat_id=chat, text=text, parse_mode='HTML', reply_markup=kb())

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
            open(CHAT_FILE,'w').write(str(chat))   # автосохранение chat_id
            t = (m.get('text') or '').strip()
            if t in ('/start','start','/menu'):
                send(chat, txt_start()); continue
            fn = ROUTES.get(t)
            send(chat, fn() if fn else txt_help())
        time.sleep(1)

if __name__ == '__main__':
    while True:
        try: main()
        except Exception as e:
            time.sleep(5)
