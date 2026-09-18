# Подпись входа в мини-приложение Телеграма для проверок.
#
# Сервер проверяет initData так: секрет = HMAC(«WebAppData», токен бота),
# подпись = HMAC(секрет, строка полей по алфавиту). Здесь собираем ровно
# это тем же выдуманным токеном, что сервер.sh кладёт в config/.env.
# Настоящий ключ школы в проверках не нужен и не используется.

import hashlib
import hmac
import json
import time
import urllib.parse

ТОКЕН = '111222333:PROVERKA-metanoya-test-bot-token'
ФАЙЛ = '/tmp/initdata.txt'

поля = {
    'auth_date': str(int(time.time())),
    'query_id': 'AAF_proverka',
    'user': json.dumps(
        {'id': 7788, 'first_name': 'Соня', 'language_code': 'ru'},
        ensure_ascii=False, separators=(',', ':')),
}

строка = '\n'.join('%s=%s' % (к, поля[к]) for к in sorted(поля))
секрет = hmac.new(b'WebAppData', ТОКЕН.encode(), hashlib.sha256).digest()
поля['hash'] = hmac.new(секрет, строка.encode(), hashlib.sha256).hexdigest()

open(ФАЙЛ, 'w', encoding='utf-8').write(urllib.parse.urlencode(поля))
print('подпись собрана: ' + ФАЙЛ)
