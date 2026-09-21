#!/usr/bin/env bash
# Разворачивание бота AMBERRY на чистой Ubuntu 24.04.
#
# Запускать от root на новом сервере:
#     bash setup_server.sh
#
# Скрипт МОЖНО гонять повторно: он ничего не ломает на второй запуск.
# Это не педантизм — разворачивание почти всегда идёт в два-три захода
# (забыли ключ, поправили конфиг), и скрипт, который на втором запуске
# затирает базу с людьми и их оплаченными коинами, страшнее любой
# недонастройки.
#
# Что здесь НЕ делается намеренно:
#   * генерация. Она живёт на арендованной видеокарте, этот сервер
#     только ходит к ней по сети. Смысл разделения в том, что карту
#     можно вернуть и взять другую, а бот, база, архив и статистика
#     останутся на месте;
#   * установка моделей. Их 52 ГБ, и место им на карте, а не здесь.

set -euo pipefail

ДОМ=/opt/amberry           # код
ДАННЫЕ=/srv/amberry        # база и архив работ — то, что нельзя терять
ПОЛЬЗОВАТЕЛЬ=amberry
РЕПО=https://github.com/gdeoko/OKO-TEAM.git
ВЕТКА=claude/rocket-webcam-sborka

шаг() { printf '\n=== %s ===\n' "$1"; }

[ "$(id -u)" = 0 ] || { echo "нужен root"; exit 1; }

шаг "Пакеты"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq --no-install-recommends \
    python3 python3-venv python3-pip git curl ca-certificates \
    ffmpeg sqlite3 ufw fail2ban unattended-upgrades

шаг "Пользователь и каталоги"
id -u "$ПОЛЬЗОВАТЕЛЬ" >/dev/null 2>&1 || useradd -r -m -d "$ДАННЫЕ" -s /usr/sbin/nologin "$ПОЛЬЗОВАТЕЛЬ"
mkdir -p "$ДОМ" "$ДАННЫЕ/works"
chown -R "$ПОЛЬЗОВАТЕЛЬ:$ПОЛЬЗОВАТЕЛЬ" "$ДАННЫЕ"

шаг "Код"
if [ -d "$ДОМ/.git" ]; then
    git -C "$ДОМ" fetch --depth 1 origin "$ВЕТКА"
    git -C "$ДОМ" reset --hard "origin/$ВЕТКА"
else
    git clone --depth 1 -b "$ВЕТКА" "$РЕПО" "$ДОМ"
fi

шаг "Питон"
[ -d "$ДОМ/.venv" ] || python3 -m venv "$ДОМ/.venv"
"$ДОМ/.venv/bin/pip" install -q --upgrade pip
"$ДОМ/.venv/bin/pip" install -q requests

шаг "Настройки"
# Файл с ключами кладётся отдельно и сюда не попадает: в git секретам
# не место, а перезапись этого файла скриптом стёрла бы рабочий токен.
if [ ! -f /etc/amberry.env ]; then
    cat > /etc/amberry.env <<'ENV'
# Заполнить и перезапустить: systemctl restart amberry
ROCKET_BOT_TOKEN=
ROCKET_BOT_NAME=theamberrybot
ROCKET_ADMINS=6547482131,1966985736
ROCKET_DB=/srv/amberry/amberry.db
AMBERRY_WORKS_DIR=/srv/amberry/works
ROCKET_GPU_URL=
ROCKET_GPU_USER=rocket
ROCKET_GPU_PASS=
AMBERRY_CRYPTOBOT_TOKEN=
AMBERRY_STARS_PER_RUB=0.60
ENV
    echo "создан /etc/amberry.env — вписать ключи"
else
    echo "/etc/amberry.env уже есть, не трогаю"
fi
chmod 600 /etc/amberry.env

шаг "Служба"
cat > /etc/systemd/system/amberry.service <<UNIT
[Unit]
Description=AMBERRY telegram bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$ПОЛЬЗОВАТЕЛЬ
WorkingDirectory=$ДОМ/rocket-panel/bot
EnvironmentFile=/etc/amberry.env
ExecStart=$ДОМ/.venv/bin/python bot.py
Restart=always
RestartSec=5

# Бот ходит в интернет и принимает чужие данные. Ограничиваем заранее:
# всё, что ему нужно писать, лежит в одном каталоге.
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$ДАННЫЕ
UNIT
systemctl daemon-reload
systemctl enable amberry >/dev/null

шаг "Брандмауэр"
# Правила ставятся до включения: иначе ufw enable обрывает текущую
# сессию SSH и сервер остаётся без доступа.
ufw allow 22/tcp >/dev/null
ufw --force enable >/dev/null
ufw status | head -5

шаг "Готово"
echo "Код:     $ДОМ"
echo "Данные:  $ДАННЫЕ (база + архив работ)"
echo "Ключи:   /etc/amberry.env"
echo
if grep -q '^ROCKET_BOT_TOKEN=$' /etc/amberry.env; then
    echo "ТОКЕН НЕ ВПИСАН — бот не запустится. Вписать и:"
    echo "  systemctl start amberry && journalctl -u amberry -f"
else
    systemctl restart amberry
    sleep 2
    systemctl is-active amberry && journalctl -u amberry -n 10 --no-pager
fi
