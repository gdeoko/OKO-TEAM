import re, os, subprocess, urllib.parse
UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'
URL = ('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800'
       '&family=Manrope:wght@400;500;600;700;800&display=swap')
DST = '/var/www/muzmir/public/assets/fonts'
os.makedirs(DST, exist_ok=True)
css = subprocess.run(['curl','-s','-m','30','-A',UA,URL], capture_output=True, text=True).stdout
print('css получен:', len(css), 'символов')
urls = sorted(set(re.findall(r'url\((https://fonts\.gstatic\.com/[^)]+)\)', css)))
print('файлов шрифтов:', len(urls))
mapping = {}
for u in urls:
    name = re.sub(r'[^A-Za-z0-9._-]', '_', urllib.parse.urlparse(u).path.strip('/').replace('/', '_'))
    p = os.path.join(DST, name)
    if not os.path.exists(p):
        subprocess.run(['curl','-s','-m','60','-A',UA,'-o',p,u], check=False)
    mapping[u] = '/assets/fonts/' + name
    print('  ', name, os.path.getsize(p) if os.path.exists(p) else 'НЕТ')
out = css
for u, local in mapping.items():
    out = out.replace(u, local)
head = ("/* ШРИФТЫ ПАНЕЛИ — СО СВОЕГО СЕРВЕРА, А НЕ С GOOGLE.\n"
        " * Ссылка на fonts.googleapis.com блокирует отрисовку: пока таблица стилей\n"
        " * не пришла, браузер не показывает страницу вообще. Из дата-центра Google\n"
        " * отвечает за 80 мс, с мобильного интернета в России — как повезёт, и\n"
        " * админка выглядит как «не открывается».\n"
        " * Собрано скриптом scripts/fonts_localize.py; обновлять там же. */\n")
with open('/var/www/muzmir/public/assets/css/fonts.css','w',encoding='utf-8') as f:
    f.write(head + out)
print('готово:', os.path.getsize('/var/www/muzmir/public/assets/css/fonts.css'), 'байт')
