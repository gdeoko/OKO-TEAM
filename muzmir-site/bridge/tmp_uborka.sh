#!/bin/bash
# УБОРКА /tmp НА МОСТУ.
#
# /tmp здесь — tmpfs на 8 ГБ, то есть оперативная память. Когда он заполняется,
# Chromium не может записать свои временные файлы и падает с ошибкой сегментации:
# рендер бланков встаёт молча, а по логу видно только «browser has been closed».
# Ровно так 05.09 встала перерисовка наградных материалов: /tmp был занят на
# 100%, из них 6.7 ГБ — два заброшенных файла-заготовки видеосборки.
#
# Трогаем ТОЛЬКО заведомо временное и ТОЛЬКО заведомо остывшее. Ничего, что
# может оказаться чужой работой в процессе, не удаляется: пороги с большим
# запасом (самая долгая сборка ролика — меньше часа).
set -u
LOG=/tmp/tmp_uborka.log
say(){ echo "$(date '+%F %H:%M') $*" >> "$LOG"; }

before=$(df --output=pcent /tmp | tail -1 | tr -dc '0-9')

# 1. Наши временные бланки: живут секунды, всё старше двух часов — мусор.
find /tmp -maxdepth 1 -name 'dip_*.pdf' -mmin +120 -delete 2>/dev/null

# 2. Разметка и снимки выверки бланка.
find /tmp -maxdepth 1 \( -name 'sample_*' -o -name 'dbg_*' -o -name 't[0-9]*.png' \
     -o -name 't[0-9]*.json' -o -name 't[0-9]*.res' \) -mmin +720 -delete 2>/dev/null

# 3. Заготовки видеосборки: сборка ролика идёт минуты, полсуток — заброшено.
find /tmp -maxdepth 1 -type d -name 'gf_*' -mmin +720 -exec rm -rf {} + 2>/dev/null

# 4. Осиротевшие профили и распаковки Chromium.
find /tmp -maxdepth 1 -type d \( -name 'playwright*' -o -name '.org.chromium.*' \) \
     -mmin +720 -exec rm -rf {} + 2>/dev/null

after=$(df --output=pcent /tmp | tail -1 | tr -dc '0-9')
[ "$before" != "$after" ] && say "занято было ${before}%, стало ${after}%"

# Если и после уборки тесно — это уже повод посмотреть руками.
if [ "$after" -ge 85 ]; then
  say "ВНИМАНИЕ: /tmp занят на ${after}% — рендер бланков может падать"
  du -sh /tmp/* 2>/dev/null | sort -rh | head -5 >> "$LOG"
fi
# Журнал не должен сам стать проблемой.
tail -500 "$LOG" > "$LOG.tmp" 2>/dev/null && mv "$LOG.tmp" "$LOG"
