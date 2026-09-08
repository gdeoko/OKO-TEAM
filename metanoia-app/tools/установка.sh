#!/bin/bash
# Установка «Метанойи» на хостинг. Делает то, что иначе делается руками и
# с ошибками: проверяет окружение, заводит базу, кладёт конфиг, проверяет
# права и сразу дёргает сервер, чтобы убедиться, что он отвечает.
#
# Запускать из корня проекта на самом хостинге:
#     bash tools/установка.sh
#
# Скрипт ничего не удаляет и не перезаписывает существующий .env.

set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV="$ROOT/config/.env"
SCHEMA="$ROOT/db/schema.sql"
errors=0

say() { printf '%s\n' "$*"; }
bad()   { printf '  ✗ %s\n' "$*"; errors=$((errors + 1)); }
good()  { printf '  ✓ %s\n' "$*"; }

say ''
say '── 1. Что есть на хостинге ─────────────────────────'

if command -v php >/dev/null 2>&1; then
  ver=$(php -r 'echo PHP_VERSION;' 2>/dev/null)
  vernum=$(php -r 'echo PHP_MAJOR_VERSION * 100 + PHP_MINOR_VERSION;' 2>/dev/null)
  if [ "${vernum:-0}" -ge 801 ]; then good "PHP $ver"; else bad "PHP $ver, нужен 8.1 или новее"; fi
else
  bad 'PHP не найден'
fi

for ext in pdo_mysql mbstring json curl; do
  if php -m 2>/dev/null | grep -qi "^$ext$"; then good "расширение $ext"; else bad "нет расширения $ext"; fi
done

if command -v mysql >/dev/null 2>&1; then good 'клиент mysql'; else
  say '  · клиента mysql нет: базу заведите через панель хостинга'; fi

say ''
say '── 2. Конфиг ───────────────────────────────────────'

if [ -f "$ENV" ]; then
  good "config/.env уже есть, не трогаем"
else
  if [ ! -f "$ROOT/config/.env.example" ]; then
    bad 'нет config/.env.example, брать нечего'
  else
    cp "$ROOT/config/.env.example" "$ENV"
    # Секрет подписи генерируем сразу: пустой ключ сервер не пустит.
    secret=$(openssl rand -hex 32 2>/dev/null || head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')
    if [ -n "$secret" ]; then
      # BSD и GNU sed ведут себя по-разному, поэтому через временный файл.
      awk -v s="$secret" '/^JWT_SECRET=/{print "JWT_SECRET=" s; next} {print}' "$ENV" > "$ENV.tmp" && mv "$ENV.tmp" "$ENV"
      good 'создан config/.env со свежим JWT_SECRET'
    else
      good 'создан config/.env (JWT_SECRET впишите руками)'
    fi
    say '  · впишите в него DB_*, APP_URL, APP_ORIGIN, MAIL_FROM и токен бота'
  fi
fi
chmod 600 "$ENV" 2>/dev/null && good 'права на .env: 600'

say ''
say '── 3. База ─────────────────────────────────────────'

envget() { grep -E "^$1=" "$ENV" 2>/dev/null | head -1 | cut -d= -f2- | tr -d '"'; }
DB_HOST=$(envget DB_HOST); DB_NAME=$(envget DB_NAME)
DB_USER=$(envget DB_USER); DB_PASS=$(envget DB_PASS)

if [ -z "${DB_NAME:-}" ] || [ -z "${DB_USER:-}" ]; then
  say '  · доступы к базе ещё не вписаны, схему зальём позже'
elif ! command -v mysql >/dev/null 2>&1; then
  say "  · залейте $SCHEMA в базу $DB_NAME через панель хостинга"
else
  if mysql -h "${DB_HOST:-127.0.0.1}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -e 'SELECT 1' >/dev/null 2>&1; then
    good "база $DB_NAME отвечает"
    tables=$(mysql -h "${DB_HOST:-127.0.0.1}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -N -e 'SHOW TABLES' 2>/dev/null | wc -l)
    if [ "$tables" -ge 40 ]; then
      good "таблиц уже $tables, схему не трогаем"
    else
      if mysql -h "${DB_HOST:-127.0.0.1}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$SCHEMA" 2>/dev/null; then
        tables2=$(mysql -h "${DB_HOST:-127.0.0.1}" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" -N -e 'SHOW TABLES' | wc -l)
        good "схема залита, таблиц $tables2"
      else
        bad 'схема не залилась, смотрите права пользователя базы'
      fi
    fi
  else
    bad "база $DB_NAME не пускает пользователя $DB_USER"
  fi
fi

say ''
say '── 4. Права и защита ───────────────────────────────'

[ -f "$ROOT/public_html/.htaccess" ] && good 'корневой .htaccess на месте' || bad 'нет public_html/.htaccess: приложение Android не свяжется с сайтом, а семьи застрянут на старой версии'
[ -f "$ROOT/public_html/api/v1/.htaccess" ] && good 'api/.htaccess на месте' || bad 'нет public_html/api/v1/.htaccess'
[ -f "$ROOT/public_html/uploads/.htaccess" ] && good 'uploads/.htaccess на месте' || bad 'нет public_html/uploads/.htaccess'
mkdir -p "$ROOT/public_html/uploads" && chmod 755 "$ROOT/public_html/uploads" && good 'папка uploads готова'

case "$ROOT" in
  */public_html|*/public_html/*) bad 'проект лежит внутри public_html: config/.env будет виден из интернета' ;;
  *) good 'config лежит выше корня сайта' ;;
esac

say ''
say '── 5. Живая проверка ───────────────────────────────'

APP_URL=$(envget APP_URL)
if [ -n "${APP_URL:-}" ] && command -v curl >/dev/null 2>&1; then
  reply=$(curl -s -m 15 "${APP_URL%/}/api/v1/health" 2>/dev/null)
  case "$reply" in
    *'"status":"alive"'*) good "сервер отвечает: ${APP_URL%/}/api/v1/health" ;;
    '') bad "нет ответа от ${APP_URL%/}/api/v1/health" ;;
    *) bad "странный ответ здоровья: $(printf '%s' "$reply" | head -c 80)" ;;
  esac
else
  say '  · APP_URL не заполнен, живую проверку пропускаем'
fi

say ''
if [ "$errors" -eq 0 ]; then
  say 'Готово. Осталось: вписать mt-api, mt-bot и mt-google в public_html/index.html,'
  say 'а перед выходом в магазины ещё отпечаток ключа подписи в'
  say 'public_html/.well-known/assetlinks.json.'
else
  say "Осталось разобраться с $errors пунктами выше."
fi
exit 0
