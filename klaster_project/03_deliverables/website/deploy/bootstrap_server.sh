#!/usr/bin/env bash
# ============================================================================
# Настройка сервера под сайт «Кластер»: nginx + PHP-FPM + SSL + фаервол
# Запускать НА СЕРВЕРЕ от root:
#   bash bootstrap_server.sh clusterspace.ru
# ============================================================================
set -euo pipefail

DOMAIN="${1:?Укажите домен, например: bash bootstrap_server.sh clusterspace.ru}"
WEBROOT="/var/www/${DOMAIN}"
EMAIL="${LE_EMAIL:-aktiviti.official@gmail.com}"

say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

say "Обновление системы"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y

say "Установка nginx, PHP-FPM, утилит"
apt-get install -y nginx php8.3-fpm php8.3-curl php8.3-mbstring php8.3-xml \
                   certbot python3-certbot-nginx ufw fail2ban curl unzip git

say "Каталог сайта"
mkdir -p "${WEBROOT}"
chown -R www-data:www-data "${WEBROOT}"

say "Конфигурация nginx"
cat > "/etc/nginx/sites-available/${DOMAIN}" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};
    root ${WEBROOT};
    index index.html index.php;

    # Сжатие — критично для 3D-сцены и вшитого Three.js
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/javascript application/javascript
               application/json image/svg+xml application/wasm;

    # Долгий кэш для статики
    location ~* \.(js|css|png|jpg|jpeg|gif|svg|webp|avif|woff2|ico|glb|gltf|hdr|mp3|mp4|webm)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # HTML — без кэша, чтобы правки долетали сразу
    location ~* \.html$ {
        add_header Cache-Control "no-cache, must-revalidate";
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Бэкенд формы заявки
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
    }

    # Закрываем служебное
    location ~ /\.(?!well-known) { deny all; }
    location ~ ^/(data|logs)/ { deny all; }

    client_max_body_size 32m;
}
NGINX

ln -sf "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}"
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

say "Фаервол"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

say "SSL (Let's Encrypt)"
echo "Если DNS ещё не указывает на этот сервер — выпуск сертификата упадёт, это нормально."
echo "Повторите после прописки A-записи:  certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
certbot --nginx -d "${DOMAIN}" -d "www.${DOMAIN}" \
        --non-interactive --agree-tos -m "${EMAIL}" --redirect || \
  echo "SSL отложен — выпустите вручную, когда DNS прорастёт."

say "Автопродление сертификата"
systemctl enable --now certbot.timer || true

say "ГОТОВО"
cat <<EOF
  Домен   : ${DOMAIN}
  Корень  : ${WEBROOT}
  PHP     : 8.3-fpm
  Дальше  : залейте сайт  ->  bash push_site.sh <IP>
EOF
