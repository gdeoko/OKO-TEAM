#!/usr/bin/env python3
"""Create an isolated public review route with synthetic API data only."""
from pathlib import Path
import shutil,subprocess,re,json
release=Path('/var/www/rocket-releases/20260908-r2')
stage=Path('/var/www/rocket-stage/20260908-r2')
data=Path('/var/lib/rocket-stage-r2')
if not stage.exists():shutil.copytree(release,stage,symlinks=True)
data.mkdir(parents=True,exist_ok=True)
(stage/'rocketcdn/config.local.php').write_text("<?php return ['data_dir'=>'/var/lib/rocket-stage-r2','admin_key'=>'isolated-stage-r2-only','tg_token'=>'','tg_admins'=>[],'mail_user'=>'','mail_pass'=>'','mail_to'=>''];")
# Preview analytics and forms are confined to the isolated stage API.
for p in (stage/'rocketvpn').rglob('*'):
 if p.is_file() and p.suffix in ['.js','.html']:
  text=p.read_text();text=text.replace('https://rocketcdn.ru/api.php','https://rocketcdn.ru/_rocket-r2/cdn/api.php')
  p.write_text(text)
for p in (stage/'rocketcdn').rglob('*'):
 if p.is_file() and p.suffix in ['.js','.html']:
  text=p.read_text().replace('https://rocketcdn.ru/api.php','https://rocketcdn.ru/_rocket-r2/cdn/api.php')
  p.write_text(text)
subprocess.run(['chown','-R','www-data:www-data',str(data),str(stage)],check=True)
for p in stage.rglob('*'):
 if p.is_file():p.chmod(0o640 if p.name=='config.local.php' else 0o644)
 elif p.is_dir():p.chmod(0o755)
backup=Path('/var/backups/rocket/pre-r2-stage');backup.mkdir(parents=True,exist_ok=True)
conf=Path('/etc/nginx/sites-available/rocketcdn');original=conf.read_text()
if not (backup/'rocketcdn.nginx').exists():shutil.copy2(conf,backup/'rocketcdn.nginx')
snippet=Path('/etc/nginx/snippets/rocket-review-r2.conf')
lines=['# Rocket isolated review; no runtime data is exposed.']
def static(url,path):
 if url.endswith('/'):
  lines.append(f'location = {url} {{ rewrite ^ {url}index.html last; }}')
  url += 'index.html'
 lines.append(f'location = {url} {{ alias {path}; add_header X-Robots-Tag "noindex, nofollow" always; }}')
def assets(url,path):
 lines.append(f'location ^~ {url} {{ alias {path}/; }}')
def php(url,path,vpn=False):
 lines.append(f'location = {url} {{ include fastcgi_params; fastcgi_param SCRIPT_FILENAME {path}; fastcgi_pass unix:/run/php/php8.3-fpm.sock;'+(' fastcgi_param RV_SITE_OPEN 1; fastcgi_param RV_CONTENT_PATH /var/lib/rocket-stage-r2/content-vpn.json;' if vpn else '')+' add_header X-Robots-Tag "noindex, nofollow" always; }')
static('/_rocket-r2/cdn/',stage/'rocketcdn/index.html')
static('/_rocket-r2/cdn/admin.html',stage/'rocketcdn/admin.html')
php('/_rocket-r2/cdn/api.php',stage/'rocketcdn/api.php')
assets('/_rocket-r2/cdn/assets/',stage/'rocketcdn/assets')
php('/_rocket-r2/vpn/',stage/'rocketvpn/index.php',True)
assets('/_rocket-r2/vpn/assets/',stage/'rocketvpn/assets')
static('/_rocket-r2/admin-preview.html',stage/'review/admin.html')
static('/_rocket-r2/cards-preview.html',stage/'review/cards.html')
static('/_rocket-r2/mobile-preview.html',stage/'review/mobile.html')
lines.append('location /_rocket-r2/ { return 404; }')
snippet.write_text('\n'.join(lines)+'\n')
marker='include /etc/nginx/snippets/rocket-review-r2.conf;'
if marker not in original:
 modified,n=re.subn(r'(root\s+/var/www/rocketcdn;)',r'\1\n    '+marker,original,count=1)
 assert n==1,'Live CDN root not matched'
 conf.write_text(modified)
try:
 subprocess.run(['nginx','-t'],check=True,capture_output=True)
 subprocess.run(['systemctl','reload','nginx'],check=True)
except Exception:
 conf.write_text(original);raise
print(json.dumps({'stage_ready':True,'vpn':'https://rocketcdn.ru/_rocket-r2/vpn/','cdn':'https://rocketcdn.ru/_rocket-r2/cdn/','admin_review':'https://rocketcdn.ru/_rocket-r2/admin-preview.html','production_unchanged':True}))
