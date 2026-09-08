#!/bin/bash
# Проверки, которым нужен настоящий сервер: база, PHP, вход, перенос
# прогресса между устройствами. Поднимает всё сам, на чистой базе.
#
#     bash сервер.sh
#
# Что делает: заводит базу metanoya, заливает db/schema.sql, пишет
# config/.env со свежим ключом подписи, поднимает PHP на 8099, делает
# копию index.html под именем _t.html с адресом этого сервера и гоняет
# по нему проверки. Ничего из этого в git не попадает.

set -u
cd "$(dirname "$0")" || exit 1
ROOT="$(cd .. && pwd)"
PORT=8099
fails=0

say() { printf '%s\n' "$*"; }

# ── база ──────────────────────────────────────────────────────
if ! mysql -u root -e 'SELECT 1' >/dev/null 2>&1; then
  mkdir -p /run/mysqld && chown -R mysql:mysql /run/mysqld /var/lib/mysql 2>/dev/null
  ( setsid mariadbd --user=mysql >/tmp/mysqld.log 2>&1 & )
  for i in $(seq 1 30); do mysql -u root -e 'SELECT 1' >/dev/null 2>&1 && break; sleep 2; done
fi
mysql -u root -e 'SELECT 1' >/dev/null 2>&1 || { say 'база не поднялась, смотрите /tmp/mysqld.log'; exit 1; }

mysql -u root -e "DROP DATABASE IF EXISTS metanoya;
  CREATE DATABASE metanoya CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER IF NOT EXISTS 'mt'@'localhost' IDENTIFIED BY 'mt';
  GRANT ALL ON metanoya.* TO 'mt'@'localhost';" || exit 1
mysql -u root metanoya < "$ROOT/db/schema.sql" || exit 1
say "база готова, таблиц $(mysql -u root -N -e 'SELECT COUNT(*) FROM information_schema.tables WHERE table_schema="metanoya"')"

# ── конфиг ────────────────────────────────────────────────────
python3 - "$ROOT" "$PORT" <<'PY'
import re, secrets, sys
root, port = sys.argv[1], sys.argv[2]
s = open(root + '/config/.env.example').read()
s = s.replace('DB_NAME=metanoia', 'DB_NAME=metanoya')
s = s.replace('DB_USER=', 'DB_USER=mt', 1).replace('DB_PASS=', 'DB_PASS=mt', 1)
s = re.sub(r'^APP_ORIGIN=.*$', 'APP_ORIGIN=http://127.0.0.1:8777', s, flags=re.M)
s = re.sub(r'^JWT_SECRET=.*$', 'JWT_SECRET=' + secrets.token_hex(32), s, flags=re.M)
open(root + '/config/.env', 'w').write(s)
PY

# ── сервер и копия страницы под него ──────────────────────────
pkill -f "php -S 127.0.0.1:$PORT" 2>/dev/null
( cd "$ROOT/public_html" && setsid php -S 127.0.0.1:$PORT -t . >/tmp/php.log 2>&1 & )
for i in $(seq 1 15); do
  curl -s "http://127.0.0.1:$PORT/api/v1/health" | grep -q alive && break; sleep 1
done
curl -s "http://127.0.0.1:$PORT/api/v1/health" | grep -q alive || { say 'сервер не отвечает, смотрите /tmp/php.log'; exit 1; }
say 'сервер отвечает'

python3 - "$ROOT" "$PORT" <<'PY'
import sys
root, port = sys.argv[1], sys.argv[2]
адрес = '<meta name="mt-api" content="http://127.0.0.1:%s/api/v1">' % port
s = open(root + '/public_html/index.html').read()
open(root + '/public_html/_t.html', 'w').write(
    s.replace('<meta name="mt-api" content="">', адрес))
a = open(root + '/public_html/admin/index.html').read()
open(root + '/public_html/admin/_t.html', 'w').write(
    a.replace('<meta name="mt-api" content="">', адрес))
PY

# Часть проверок открывает обычную страницу школы на 8777: письмо о новом
# пароле, например, приходит семье, которая сидит на сайте, а не на копии.
if ! curl -s -o /dev/null "http://127.0.0.1:8777/index.html"; then
  ( cd "$ROOT/public_html" && setsid python3 -m http.server 8777 >/dev/null 2>&1 & )
  for i in $(seq 1 10); do curl -s -o /dev/null "http://127.0.0.1:8777/index.html" && break; sleep 1; done
fi

rm -rf /tmp/metanoia-rl     # счётчик попыток входа, иначе наши же проверки его выбирают

# ── прогон ────────────────────────────────────────────────────
run() {
  out=$(timeout 200 node "$1.mjs" ${2:-} 2>&1)
  line=$(printf '%s' "$out" | grep -E 'ОШИБОК|ОШИБКИ' | tail -1)
  [ -z "$line" ] && line=$(printf '%s' "$out" | tail -1 | cut -c1-60)
  case "$line" in
    *": 0"*) printf '%-10s ok\n' "$1" >&2 ;;
    *) printf '%-10s %s\n' "$1" "$line" >&2; fails=$((fails + 1)) ;;
  esac
  printf '%s' "$out"
}

for t in konflikt tyazhelo token synclive parol parol2 parol3 pochta tgfull; do run "$t" >/dev/null; done

# svoi3 продолжает работу svoi2: ему нужна почта заведённой семьи.
out=$(run svoi2)
mail=$(printf '%s' "$out" | grep 'ПОЧТА:' | awk '{print $2}')
[ -n "$mail" ] && run svoi3 "$mail" >/dev/null || { say 'svoi3 пропущен: svoi2 не отдал почту'; fails=$((fails + 1)); }

# Панели нужен педагог школы: заводим его и поднимаем до superadmin.
PEDAGOG="ekat$(date +%s)@test.ru"
curl -s -X POST "http://127.0.0.1:$PORT/api/v1/auth/register" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$PEDAGOG\",\"password\":\"Parol12345\",\"name\":\"Екатерина Павленко\",\"role\":\"parent\"}" >/dev/null
mysql -u root metanoya -e "UPDATE users SET role='superadmin' WHERE email='$PEDAGOG'"
run panel "$PEDAGOG" >/dev/null

say "--- с замечаниями: $fails"
exit 0
