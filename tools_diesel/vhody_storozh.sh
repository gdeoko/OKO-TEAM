#!/bin/bash
# Сторож входов DIESEL. Держит дорогу к Instagram живой, чтобы вход не вылетал.
#
# Ломается тут ровно одно место: мобильный модем провайдера. 08.09.2026 он
# молчал семнадцать часов, аренда при этом была оплачена, а перезагрузка не
# помогала. Лечится сменой самого оборудования, и это бесплатно в рамках аренды.
#
# id_country ОБЯЗАТЕЛЕН. Без него провайдер даёт любой свободный модем, и в
# первый же раз выпал tele2 в России, где Instagram закрыт наглухо: соединение
# обрывается на CONNECT. Казахстан это 82.
#
# Сессии сторож НЕ трогает: профили браузера чинить нечем, их дело бэкап.
set -u
B=/opt/oko-poster
L=$B/logs/vhody_storozh.log
COUNTRY=82                      # Казахстан, Kcell. Аккаунт живёт на нём
TRIES=2

cd "$B" || exit 1
set -a; . "$B/cfg/secrets.env" 2>/dev/null; set +a
say(){ echo "$(date -u +%F\ %T) $*" >> "$L"; }

road_alive(){
  # спрашиваем сам Instagram, а не ipinfo: у российского модема ipinfo отвечает,
  # а Instagram нет, и по ipinfo сторож считал бы всё исправным
  local code
  code=$(timeout 45 curl -s -o /dev/null -w "%{http_code}" --max-time 40 \
        -x "${IG_PROXY_HTTP:-}" https://www.instagram.com/ 2>/dev/null)
  [ "$code" = "200" ] || [ "$code" = "302" ]
}

if road_alive; then
  exit 0                        # молча: сторож пишет, только когда есть что сказать
fi

say "дорога к Instagram молчит, меняю оборудование"
for i in $(seq 1 $TRIES); do
  ANSWER=$(timeout 45 curl -s --max-time 40 \
    "https://mobileproxy.space/api.html?command=change_equipment&proxy_id=${IG_PROXY_ID}&id_country=${COUNTRY}" \
    -H "Authorization: Bearer ${IG_PROXY_API_TOKEN}" 2>&1 | head -c 200)
  say "смена оборудования ($i): $ANSWER"
  sleep 70
  # адрес, порты, логин и пароль после смены другие: тянем из кабинета
  timeout 120 python3 "$B/ig_proxy_fix.py" >> "$L" 2>&1
  set -a; . "$B/cfg/secrets.env" 2>/dev/null; set +a
  if road_alive; then
    say "дорога поднялась: $(timeout 40 curl -s --max-time 35 -x "$IG_PROXY_HTTP" https://ipinfo.io/json 2>/dev/null | tr -d '\n' | head -c 120)"
    exit 0
  fi
  say "после смены ($i) всё ещё молчит"
done
say "ТРЕВОГА: дорога к Instagram не поднялась за $TRIES смены оборудования"
exit 1
