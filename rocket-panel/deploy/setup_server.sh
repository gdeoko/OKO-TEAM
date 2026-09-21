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

# Имена переменных ЛАТИНИЦЕЙ. Bash принимает в имени только ASCII, и на
# кириллическом имени скрипт падает на первой же строке с невнятным
# «No such file or directory». Комментарии по-русски — их шелл не
# читает.

HOME_DIR=/opt/amberry           # код
DATA_DIR=/srv/amberry        # база и архив работ — то, что нельзя терять
BOT_USER=amberry
REPO=https://github.com/gdeoko/OKO-TEAM.git
BRANCH=claude/rocket-webcam-sborka

step() { printf '\n=== %s ===\n' "$1"; }

[ "$(id -u)" = 0 ] || { echo "нужен root"; exit 1; }

step "Пакеты"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq --no-install-recommends \
    python3 python3-venv python3-pip git curl ca-certificates \
    ffmpeg sqlite3 ufw fail2ban unattended-upgrades

step "Пользователь и каталоги"
id -u "$BOT_USER" >/dev/null 2>&1 || useradd -r -m -d "$DATA_DIR" -s /usr/sbin/nologin "$BOT_USER"
mkdir -p "$HOME_DIR" "$DATA_DIR/works"
chown -R "$BOT_USER:$BOT_USER" "$DATA_DIR"

step "Код"
if [ -d "$HOME_DIR/.git" ]; then
    git -C "$HOME_DIR" fetch --depth 1 origin "$BRANCH"
    git -C "$HOME_DIR" reset --hard "origin/$BRANCH"
else
    git clone --depth 1 -b "$BRANCH" "$REPO" "$HOME_DIR"
fi

step "Питон"
[ -d "$HOME_DIR/.venv" ] || python3 -m venv "$HOME_DIR/.venv"
"$HOME_DIR/.venv/bin/pip" install -q --upgrade pip
"$HOME_DIR/.venv/bin/pip" install -q requests

step "Настройки"
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
# Где лежит каталог.json — названия кнопок и строки владельца.
# ОБЯЗАТЕЛЬНО вне /opt: код там под ProtectSystem=strict и только для
# чтения, а страница каталога обязана в этот файл писать.
AMBERRY_DATA_DIR=/srv/amberry
ROCKET_GPU_URL=
ROCKET_GPU_USER=rocket
ROCKET_GPU_PASS=
AMBERRY_CRYPTOBOT_TOKEN=
AMBERRY_STARS_PER_RUB=0.60
# Страница каталога. Пароль пустой = страница закрыта наотрез.
AMBERRY_ADMIN_USER=amberry
AMBERRY_ADMIN_PASS=
AMBERRY_ADMIN_PORT=8090
AMBERRY_ADMIN_URL=
ENV
    echo "создан /etc/amberry.env — вписать ключи"
else
    echo "/etc/amberry.env уже есть, не трогаю"
fi
chmod 600 /etc/amberry.env

step "Служба"
cat > /etc/systemd/system/amberry.service <<UNIT
[Unit]
Description=AMBERRY telegram bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$BOT_USER
WorkingDirectory=$HOME_DIR/rocket-panel/bot
EnvironmentFile=/etc/amberry.env
ExecStart=$HOME_DIR/.venv/bin/python bot.py
Restart=always
RestartSec=5

# Бот ходит в интернет и принимает чужие данные. Ограничиваем заранее:
# всё, что ему нужно писать, лежит в одном каталоге.
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$DATA_DIR

# Без [Install] служба не включается в автозапуск: systemctl enable
# ругается, что юнит «не предназначен для включения», и бот тихо не
# поднимается после перезагрузки — а перезагрузку сервер переживёт
# когда-нибудь сам, без спроса.
[Install]
WantedBy=multi-user.target
UNIT
step "Страница каталога"
# Отдельная служба, а не поток внутри бота. Две причины.
#
# Первая: падение страницы не имеет права останавливать продажи. Бот
# принимает деньги, страница правит подписи — это разный вес.
#
# Вторая: страница ПИШЕТ каталог.json, бот его только читает. Разделив
# службы, можно однажды дать боту каталог в режиме чтения и не бояться,
# что чужой ввод через телеграм доберётся до файла.
cat > /etc/systemd/system/amberry-admin.service <<UNIT
[Unit]
Description=AMBERRY catalogue admin page
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$BOT_USER
WorkingDirectory=$HOME_DIR/rocket-panel/admin
EnvironmentFile=/etc/amberry.env
ExecStart=$HOME_DIR/.venv/bin/python admin.py
Restart=always
RestartSec=5

NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$DATA_DIR

[Install]
WantedBy=multi-user.target
UNIT

step "HTTPS"
# Страница спрашивает пароль. По открытому HTTP он уходит почти
# открытым текстом в каждом запросе — значит нужен сертификат, а
# значит нужно имя: сертификаты на голый IP не выдают.
#
# Домена у сервера нет, и покупать его ради одной внутренней страницы
# незачем. nip.io отдаёт A-запись прямо из имени: 62-112-10-168.nip.io
# указывает на 62.112.10.168. Это настоящий DNS, поэтому Let's Encrypt
# выдаёт на него настоящий сертификат, а Caddy забирает и продлевает
# его сам.
#
# Адрес получается ПОСТОЯННЫЙ — в отличие от быстрого туннеля
# cloudflared, который меняет имя при каждом перезапуске. Страницу
# владелец кладёт в закладки телефона один раз.
if ! command -v caddy >/dev/null 2>&1; then
    apt-get install -y -qq --no-install-recommends debian-keyring \
        debian-archive-keyring apt-transport-https
    curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
        | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    echo "deb [signed-by=/usr/share/keyrings/caddy-stable-archive-keyring.gpg] https://dl.cloudsmith.io/public/caddy/stable/deb/debian any-version main" \
        > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -qq
    apt-get install -y -qq caddy
fi

IP_PUB=$(curl -s -m 10 https://api.ipify.org || hostname -I | awk '{print $1}')
ADMIN_HOST="${IP_PUB//./-}.nip.io"
ADMIN_PORT=$(grep '^AMBERRY_ADMIN_PORT=' /etc/amberry.env | cut -d= -f2)
ADMIN_PORT=${ADMIN_PORT:-8090}

cat > /etc/caddy/Caddyfile <<CADDY
{
    email okoteam.top@gmail.com
}

$ADMIN_HOST {
    encode gzip
    reverse_proxy 127.0.0.1:$ADMIN_PORT
}
CADDY
systemctl restart caddy || true

# Адрес кладём в настройки: бот показывает его в /scenes, чтобы
# владельцу не приходилось искать ссылку по переписке.
if grep -q '^AMBERRY_ADMIN_URL=$' /etc/amberry.env; then
    sed -i "s#^AMBERRY_ADMIN_URL=\$#AMBERRY_ADMIN_URL=https://$ADMIN_HOST#" /etc/amberry.env
fi

systemctl daemon-reload
systemctl enable amberry amberry-admin >/dev/null

step "Брандмауэр"
# Правила ставятся до включения: иначе ufw enable обрывает текущую
# сессию SSH и сервер остаётся без доступа.
ufw allow 22/tcp >/dev/null
ufw allow 80/tcp >/dev/null     # нужен Let's Encrypt для проверки
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
ufw status | head -6

step "Готово"
echo "Код:      $HOME_DIR"
echo "Данные:   $DATA_DIR (база, архив работ, каталог.json)"
echo "Ключи:    /etc/amberry.env"
echo "Каталог:  https://$ADMIN_HOST"
echo
if grep -q '^AMBERRY_ADMIN_PASS=$' /etc/amberry.env; then
    echo "ПАРОЛЬ СТРАНИЦЫ НЕ ВПИСАН — каталог отвечает 503. Вписать"
    echo "AMBERRY_ADMIN_PASS и: systemctl restart amberry-admin"
fi
if grep -q '^ROCKET_BOT_TOKEN=$' /etc/amberry.env; then
    echo "ТОКЕН НЕ ВПИСАН — бот не запустится. Вписать и:"
    echo "  systemctl start amberry && journalctl -u amberry -f"
else
    systemctl restart amberry amberry-admin
    sleep 2
    systemctl is-active amberry amberry-admin
    journalctl -u amberry -n 10 --no-pager
fi
